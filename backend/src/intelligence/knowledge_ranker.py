"""Quality-gate and ranking for knowledge doc capture."""

from __future__ import annotations
import json

from database import knowledge_docs
from models import KnowledgeQualityScore
from scoring import score_knowledge_doc
from llm_client import call_llm, is_llm_available

# Minimum quality score to persist a knowledge doc
_CAPTURE_THRESHOLD = 0.35

_SUMMARY_SYS = (
    "You are a technical knowledge summariser. "
    "Summarise the thread in exactly 3 sentences focusing on: "
    "(1) the problem, (2) root cause, (3) solution. "
    "Be concise and precise. Return plain text only."
)

_DEV_SUMMARY = (
    "A technical question was raised on this thread. "
    "The community investigated the issue and identified the root cause. "
    "A solution was marked and the thread was resolved."
)


async def generate_summary(title: str, body: str, solution: str) -> str:
    if not is_llm_available():
        return _DEV_SUMMARY
    prompt = (
        f"Thread title: {title}\n\n"
        f"Original question:\n{body[:600]}\n\n"
        f"Accepted solution:\n{solution[:600]}"
    )
    return await call_llm(
        [
            {"role": "system", "content": _SUMMARY_SYS},
            {"role": "user", "content": prompt},
        ],
        max_tokens=200,
        dev_fallback=_DEV_SUMMARY,
    )


def rank_docs(docs: list[dict]) -> list[tuple[dict, KnowledgeQualityScore]]:
    """Return docs paired with their scores, sorted best-first."""
    scored = [(doc, score_knowledge_doc(doc)) for doc in docs]
    scored.sort(key=lambda x: x[1].total, reverse=True)
    return scored


def should_capture(doc: dict) -> bool:
    """Return True if this doc meets the quality threshold for persistence."""
    score = score_knowledge_doc(doc)
    return score.total >= _CAPTURE_THRESHOLD


async def capture_knowledge(
    thread_id: str,
    title: str,
    body: str,
    tags: list[str],
    ai_response: dict,
    solution: str,
) -> dict | None:
    """
    Persist a KnowledgeDoc for a solved thread.
    Guards against duplicate capture.
    Returns the inserted doc or None if below threshold / already exists.
    """
    existing = await knowledge_docs().find_one({"questionId": thread_id})
    if existing:
        return None

    summary = await generate_summary(title, body, solution)

    candidate = {
        "questionId": thread_id,
        "title": title,
        "tags": tags,
        "body": body,
        "aiResponse": ai_response,
        "solution": solution,
        "threadSummary": summary,
    }

    if not should_capture(candidate):
        return None

    result = await knowledge_docs().insert_one(candidate)
    candidate["_id"] = result.inserted_id
    return candidate
