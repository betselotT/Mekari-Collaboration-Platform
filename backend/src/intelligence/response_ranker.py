"""Score and rank AI responses and thread messages."""

from __future__ import annotations
import json

from models import (
    AIResponse,
    QuestionContext,
    RankedAIResponse,
    RankedMessage,
    ResponseQualityScore,
)
from scoring import score_ai_response, token_cosine
from llm_client import call_llm, is_llm_available


# ── AI response scoring ────────────────────────────────────────────────────────

def rank_ai_response(
    response: AIResponse,
    context: QuestionContext | None = None,
    query_text: str = "",
) -> RankedAIResponse:
    quality = score_ai_response(
        explanation=response.explanation,
        steps=response.steps,
        suggested_solution=response.suggested_solution,
        confidence=response.confidence,
        query_text=query_text,
    )

    # Adjust confidence downward when quality is poor
    adjusted = response.confidence * (0.5 + quality.total * 0.5)

    return RankedAIResponse(
        explanation=response.explanation,
        steps=response.steps,
        suggested_solution=response.suggested_solution,
        confidence=response.confidence,
        resolved=response.resolved,
        quality_score=quality.total,
        adjusted_confidence=round(adjusted, 4),
        quality_factors=quality,
    )


# ── Message ranking ────────────────────────────────────────────────────────────

_MSG_SYS = (
    "You are a technical answer ranker. "
    "Given a list of messages and a question, return a JSON object with key 'rankings': "
    "a list of objects {message_id, score (0-1), reasons (list of short strings)}. "
    "Rank by how well each message addresses the question. "
    "Return ONLY the JSON object."
)

_DEV_FALLBACK_MSGS = json.dumps({"rankings": []})


async def rank_messages(
    messages: list[dict],
    question_text: str,
    context: QuestionContext | None = None,
) -> list[RankedMessage]:
    if not messages:
        return []

    # Rule-based baseline using text similarity
    rule_ranked: list[RankedMessage] = []
    for msg in messages:
        body = msg.get("body") or msg.get("content") or ""
        sim = token_cosine(question_text, body)
        upvotes = len(msg.get("upvotes") or [])
        score = sim * 0.6 + min(upvotes * 0.05, 0.4)
        reasons: list[str] = []
        if sim > 0.3:
            reasons.append("Semantically relevant to question")
        if upvotes > 0:
            reasons.append(f"Received {upvotes} upvote(s)")
        if not reasons:
            reasons.append("Content match")
        rule_ranked.append(
            RankedMessage(
                message_id=str(msg.get("_id") or msg.get("id") or ""),
                body=body[:200],
                score=round(score, 4),
                reasons=reasons,
            )
        )

    if not is_llm_available() or len(messages) > 20:
        rule_ranked.sort(key=lambda m: m.score, reverse=True)
        return rule_ranked

    # LLM reranking for manageable sets
    msg_list = [
        {"id": str(m.get("_id") or m.get("id") or i), "body": (m.get("body") or "")[:300]}
        for i, m in enumerate(messages)
    ]
    prompt = (
        f"Question: {question_text[:500]}\n\n"
        f"Messages:\n{json.dumps(msg_list, indent=2)}"
    )
    raw = await call_llm(
        [
            {"role": "system", "content": _MSG_SYS},
            {"role": "user", "content": prompt},
        ],
        max_tokens=600,
        json_mode=True,
        dev_fallback=_DEV_FALLBACK_MSGS,
    )

    try:
        rankings = json.loads(raw).get("rankings", [])
        llm_ranked: list[RankedMessage] = []
        for r in rankings:
            llm_ranked.append(
                RankedMessage(
                    message_id=str(r.get("message_id") or ""),
                    body="",
                    score=float(r.get("score", 0)),
                    reasons=r.get("reasons") or ["LLM ranked"],
                )
            )
        llm_ranked.sort(key=lambda m: m.score, reverse=True)
        return llm_ranked
    except Exception:
        rule_ranked.sort(key=lambda m: m.score, reverse=True)
        return rule_ranked
