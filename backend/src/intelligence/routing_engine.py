"""
Main orchestrator — calls all intelligence modules in order and returns
the fully assembled AnalyzeResponse.
"""

from __future__ import annotations
import json
from datetime import datetime, timezone

from database import knowledge_docs, threads
from models import (
    AIResponse,
    AnalyzeRequest,
    AnalyzeResponse,
    FeedbackEventPayload,
    QuestionContext,
)
from context_understanding import understand_question
from tag_recommendation import recommend_tags
from similar_problem_retrieval import find_similar
from expert_matcher import find_experts
from escalation_decider import decide_escalation
from response_ranker import rank_ai_response
from feedback_loop import record_feedback
from llm_client import call_llm, is_llm_available

_AI_SYS = (
    "You are an expert technical assistant. "
    "Given a question with optional similar solved threads as context, "
    "return a JSON object with keys:\n"
    "  explanation: string (detailed explanation)\n"
    "  steps: list of strings (ordered action steps)\n"
    "  suggestedSolution: string (concrete solution)\n"
    "  confidence: float 0-1 (how confident you are)\n"
    "  resolved: bool (true if this fully resolves the question)\n"
    "Return ONLY the JSON object."
)

_DEV_AI_RESPONSE = json.dumps({
    "explanation": (
        "This is a technical question that requires careful analysis. "
        "Review the relevant documentation, check for similar solved threads, "
        "and apply a step-by-step debugging approach."
    ),
    "steps": [
        "Identify the exact error or unexpected behaviour",
        "Review the relevant documentation or specification",
        "Check the knowledge base for similar solved questions",
        "Test your solution in isolation before applying it",
    ],
    "suggestedSolution": (
        "Please include specific error messages, code snippets, and "
        "environment details for a more targeted solution."
    ),
    "confidence": 0.40,
    "resolved": False,
})


async def _generate_ai_response(
    title: str,
    body: str,
    subject: str,
    similar_context: list[dict],
) -> AIResponse:
    context_block = ""
    if similar_context:
        snippets = []
        for doc in similar_context[:3]:
            snippets.append(
                f"Problem: {doc.get('title', '')}\n"
                f"Solution: {doc.get('solution', '')[:300]}"
            )
        context_block = "\n\n---\nRelated solved problems:\n" + "\n\n".join(snippets)

    prompt = (
        f"Subject: {subject}\nTitle: {title}\n\nQuestion:\n{body[:1200]}"
        f"{context_block}"
    )

    raw = await call_llm(
        [
            {"role": "system", "content": _AI_SYS},
            {"role": "user", "content": prompt},
        ],
        max_tokens=1200,
        json_mode=True,
        dev_fallback=_DEV_AI_RESPONSE,
    )

    try:
        parsed = json.loads(raw)
        return AIResponse(
            explanation=parsed.get("explanation") or "",
            steps=parsed.get("steps") or [],
            suggested_solution=parsed.get("suggestedSolution") or "",
            confidence=float(parsed.get("confidence") or 0.4),
            resolved=bool(parsed.get("resolved") or False),
        )
    except Exception:
        return AIResponse(
            explanation="Analysis unavailable.",
            steps=[],
            suggested_solution="",
            confidence=0.4,
            resolved=False,
        )


async def route_question(req: AnalyzeRequest) -> AnalyzeResponse:
    # 1. Understand question
    context: QuestionContext = await understand_question(
        title=req.title,
        body=req.body,
        subject=req.subject,
        tags=req.tags,
    )

    # 2. Suggest tags
    suggested_tags = await recommend_tags(
        title=req.title,
        body=req.body,
        subject=req.subject,
        existing_tags=req.tags,
        context=context,
    )

    # 3. Find similar problems
    similar = await find_similar(
        title=req.title,
        tags=list(set(req.tags + suggested_tags)),
        subject=req.subject,
    )

    # 4. Generate AI response using similar problems as context
    similar_docs = [
        {"title": s.title, "solution": s.solution} for s in similar
    ]
    ai_response = await _generate_ai_response(
        title=req.title,
        body=req.body,
        subject=req.subject,
        similar_context=similar_docs,
    )

    # 5. Rank/score AI response
    ranked_ai = rank_ai_response(
        response=ai_response,
        context=context,
        query_text=f"{req.title} {req.body}",
    )

    # 6. Escalation decision
    escalation = decide_escalation(
        context=context,
        ai_confidence=ranked_ai.adjusted_confidence,
        ai_resolved=ai_response.resolved,
    )

    # 7. Match experts if escalating
    experts = []
    if escalation.should_escalate:
        experts = await find_experts(
            subject=req.subject,
            tags=list(set(req.tags + suggested_tags)),
            context=context,
        )

    # 8. Determine new thread status
    if not escalation.should_escalate and ai_response.resolved:
        new_status = "AI_RESOLVED"
    elif escalation.should_escalate:
        new_status = "PENDING_EXPERT"
    else:
        new_status = "OPEN"

    # 9. Record initial analysis feedback event
    await record_feedback(FeedbackEventPayload(
        type="initial_analysis",
        thread_id=req.thread_id,
        metadata={
            "confidence": ranked_ai.adjusted_confidence,
            "escalated": escalation.should_escalate,
            "new_status": new_status,
        },
    ))

    return AnalyzeResponse(
        context=context,
        ai_response=ai_response,
        ranked_ai_response=ranked_ai,
        similar_problems=similar,
        escalation=escalation,
        suggested_tags=suggested_tags,
        new_status=new_status,
    )
