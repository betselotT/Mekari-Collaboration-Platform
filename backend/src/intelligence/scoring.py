"""Foundational scoring utilities — no I/O, pure computation."""

from __future__ import annotations
import math
import re
from collections import Counter
from datetime import datetime, timezone

from models import (
    KnowledgeQualityFactors,
    KnowledgeQualityScore,
    ResponseQualityScore,
)


# ── Text helpers ───────────────────────────────────────────────────────────────

def _tokenize(text: str) -> list[str]:
    return re.findall(r"[a-z0-9]+", text.lower())


def jaccard(a: set[str], b: set[str]) -> float:
    if not a and not b:
        return 0.0
    return len(a & b) / len(a | b)


def token_cosine(text_a: str, text_b: str) -> float:
    """Bag-of-words cosine similarity between two strings."""
    va = Counter(_tokenize(text_a))
    vb = Counter(_tokenize(text_b))
    keys = set(va) | set(vb)
    if not keys:
        return 0.0
    dot = sum(va[k] * vb[k] for k in keys)
    mag_a = math.sqrt(sum(v * v for v in va.values()))
    mag_b = math.sqrt(sum(v * v for v in vb.values()))
    if mag_a == 0 or mag_b == 0:
        return 0.0
    return dot / (mag_a * mag_b)


# ── Knowledge doc quality ──────────────────────────────────────────────────────

def score_knowledge_doc(doc: dict) -> KnowledgeQualityScore:
    solution = doc.get("solution") or ""
    summary = doc.get("threadSummary") or ""
    tags: list[str] = doc.get("tags") or []
    created_at = doc.get("createdAt")

    has_solution = 1.0 if solution.strip() else 0.0
    has_summary = 1.0 if summary.strip() else 0.0

    sol_len = len(solution.split())
    solution_length = min(1.0, sol_len / 100)

    tag_coverage = min(1.0, len(tags) / 5)

    recency = 0.5
    if created_at:
        try:
            if isinstance(created_at, str):
                created_at = datetime.fromisoformat(created_at.replace("Z", "+00:00"))
            now = datetime.now(timezone.utc)
            if created_at.tzinfo is None:
                created_at = created_at.replace(tzinfo=timezone.utc)
            age_days = (now - created_at).days
            recency = max(0.0, 1.0 - age_days / 365)
        except Exception:
            pass

    total = (
        has_solution * 0.35
        + has_summary * 0.20
        + solution_length * 0.20
        + tag_coverage * 0.10
        + recency * 0.15
    )

    return KnowledgeQualityScore(
        total=round(total, 4),
        factors=KnowledgeQualityFactors(
            has_solution=has_solution,
            has_summary=has_summary,
            solution_length=round(solution_length, 4),
            tag_coverage=round(tag_coverage, 4),
            recency=round(recency, 4),
        ),
    )


# ── AI response quality ────────────────────────────────────────────────────────

def score_ai_response(
    explanation: str,
    steps: list[str],
    suggested_solution: str,
    confidence: float,
    query_text: str = "",
) -> ResponseQualityScore:
    has_explanation = 1.0 if explanation.strip() else 0.0
    has_steps = 1.0 if steps else 0.0
    has_solution = 1.0 if suggested_solution.strip() else 0.0

    combined = " ".join([explanation, suggested_solution] + steps)
    if query_text:
        specificity_score = min(1.0, token_cosine(combined, query_text) * 2)
    else:
        word_count = len(combined.split())
        specificity_score = min(1.0, word_count / 200)

    # Penalise extreme confidence values
    if confidence < 0.3 or confidence > 0.95:
        confidence_calibration = 0.5
    else:
        confidence_calibration = 1.0

    total = (
        has_explanation * 0.30
        + has_steps * 0.20
        + has_solution * 0.25
        + specificity_score * 0.15
        + confidence_calibration * 0.10
    )

    return ResponseQualityScore(
        total=round(total, 4),
        has_explanation=has_explanation,
        has_steps=has_steps,
        has_solution=has_solution,
        specificity_score=round(specificity_score, 4),
        confidence_calibration=round(confidence_calibration, 4),
    )


# ── Expert scoring factors ─────────────────────────────────────────────────────

def score_expert(
    expert: dict,
    query_tags: list[str],
    availability_preference: str = "online_or_busy",
) -> dict:
    """Return per-factor scores (0-1) for a single expert candidate."""
    expert_tags: list[str] = expert.get("skillTags") or []
    availability: str = expert.get("availability") or "offline"

    tag_overlap = jaccard(set(query_tags), set(expert_tags))

    avail_score_map = {
        "online": 1.0,
        "busy": 0.6,
        "in_session": 0.3,
        "offline": 0.0,
    }
    availability_score = avail_score_map.get(availability, 0.0)
    if availability_preference == "online_only" and availability != "online":
        availability_score *= 0.5

    # Past accuracy from FeedbackEvent stats stored on user doc (if present)
    past_accuracy = float(expert.get("pastAccuracy") or 0.5)

    # Response speed inversely proportional to avg response time in minutes
    avg_mins = float(expert.get("avgResponseMinutes") or 60)
    response_speed = max(0.0, 1.0 - avg_mins / 120)

    # Specialization: ratio of matching tags to total expert tags
    specialization = (
        len(set(query_tags) & set(expert_tags)) / max(len(expert_tags), 1)
    )

    composite = (
        tag_overlap * 0.35
        + availability_score * 0.25
        + past_accuracy * 0.20
        + response_speed * 0.10
        + specialization * 0.10
    )

    return {
        "score": round(composite * 100, 2),
        "tag_overlap": round(tag_overlap, 4),
        "availability_score": round(availability_score, 4),
        "past_accuracy": round(past_accuracy, 4),
        "response_speed": round(response_speed, 4),
        "specialization": round(specialization, 4),
    }
