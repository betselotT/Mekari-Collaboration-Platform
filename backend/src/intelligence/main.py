"""FastAPI entrypoint for the MEKARI intelligence microservice."""

from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from config import settings
from models import (
    AIResponse,
    AnalyzeRequest,
    AnalyzeResponse,
    ExpertRequest,
    FeedbackEventPayload,
    QuestionContext,
    RankMessagesRequest,
    ScoreResponseRequest,
    SimilarRequest,
    TagRequest,
)
from routing_engine import route_question
from tag_recommendation import recommend_tags
from similar_problem_retrieval import find_similar
from expert_matcher import find_experts
from response_ranker import rank_ai_response, rank_messages
from feedback_loop import record_feedback, get_system_health
from knowledge_ranker import capture_knowledge
from llm_client import is_llm_available


@asynccontextmanager
async def lifespan(app: FastAPI):
    yield


app = FastAPI(
    title="MEKARI Intelligence Service",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Health ─────────────────────────────────────────────────────────────────────

@app.get("/health")
async def health():
    return {"status": "ok", "llm_available": is_llm_available()}


# ── Main pipeline ──────────────────────────────────────────────────────────────

@app.post("/analyze", response_model=AnalyzeResponse)
async def analyze(req: AnalyzeRequest):
    """Full AI pipeline: context → tags → similar → AI response → escalation."""
    try:
        return await route_question(req)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


# ── Individual capabilities ────────────────────────────────────────────────────

@app.post("/tags")
async def suggest_tags(req: TagRequest):
    tags = await recommend_tags(
        title=req.title,
        body=req.body,
        subject=req.subject,
        existing_tags=req.existing_tags,
    )
    return {"tags": tags}


@app.post("/similar")
async def similar_problems(req: SimilarRequest):
    problems = await find_similar(
        title=req.title,
        body=req.body,
        tags=req.tags,
        subject=req.subject,
        limit=req.limit,
    )
    return {"problems": [p.model_dump() for p in problems]}


@app.post("/experts")
async def match_experts(req: ExpertRequest):
    experts = await find_experts(
        subject=req.subject,
        tags=req.tags,
        context=req.context,
        requester_id=req.requester_id,
        availability_preference=req.availability_preference,
        limit=req.limit,
    )
    return {"experts": [e.model_dump() for e in experts]}


@app.post("/score-response")
async def score_response(req: ScoreResponseRequest):
    ranked = rank_ai_response(
        response=req.response,
        context=req.context,
        query_text=req.query_text,
    )
    return ranked.model_dump()


@app.post("/rank-messages")
async def rank_messages_endpoint(req: RankMessagesRequest):
    ranked = await rank_messages(
        messages=req.messages,
        question_text=req.question_text,
        context=req.context,
    )
    return {"messages": [m.model_dump() for m in ranked]}


# ── Feedback & knowledge ───────────────────────────────────────────────────────

@app.post("/feedback")
async def feedback(payload: FeedbackEventPayload):
    await record_feedback(payload)
    return {"ok": True}


@app.get("/health/system")
async def system_health():
    stats = await get_system_health()
    return stats.model_dump()


class CaptureRequest(AnalyzeRequest):
    solution: str = ""
    ai_response_dict: dict = {}


@app.post("/capture")
async def capture(req: CaptureRequest):
    doc = await capture_knowledge(
        thread_id=req.thread_id,
        title=req.title,
        body=req.body,
        tags=req.tags,
        ai_response=req.ai_response_dict,
        solution=req.solution,
    )
    if doc is None:
        return {"captured": False, "reason": "below_threshold_or_duplicate"}
    return {"captured": True, "doc_id": str(doc.get("_id"))}


# ── Entry point ────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host=settings.intelligence_host,
        port=settings.intelligence_port,
        reload=False,
    )
