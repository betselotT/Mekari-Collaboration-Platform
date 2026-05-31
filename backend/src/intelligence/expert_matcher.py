"""Match and rank experts for a given question context."""

from __future__ import annotations

from database import users
from models import ExpertMatch, QuestionContext
from scoring import score_expert


def _build_reasons(factors: dict, expert: dict) -> list[str]:
    reasons: list[str] = []

    if factors["tag_overlap"] >= 0.5:
        reasons.append("Strong tag alignment with question domain")
    elif factors["tag_overlap"] >= 0.2:
        reasons.append("Partial tag match")

    avail = expert.get("availability", "offline")
    if avail == "online":
        reasons.append("Currently online")
    elif avail == "busy":
        reasons.append("Available but busy")

    if factors["past_accuracy"] >= 0.7:
        reasons.append("High past answer accuracy")

    if factors["response_speed"] >= 0.7:
        reasons.append("Fast average response time")

    if not reasons:
        reasons.append("Subject area match")

    return reasons


async def find_experts(
    subject: str,
    tags: list[str],
    context: QuestionContext | None = None,
    requester_id: str | None = None,
    availability_preference: str = "online_or_busy",
    limit: int = 5,
) -> list[ExpertMatch]:
    # Query verified experts/admins, then rank by topic and availability.
    query: dict = {
        "role": {"$in": ["expert", "admin"]},
        "$or": [
            {"role": "admin"},
            {"expertVerification.status": "approved"},
        ],
    }
    if requester_id:
        query["_id"] = {"$ne": requester_id}

    cursor = users().find(query).limit(50)

    candidates: list[ExpertMatch] = []
    async for expert in cursor:
        factors = score_expert(expert, tags, availability_preference)

        # Skip completely unavailable experts unless forced
        avail = expert.get("availabilityStatus") or expert.get("availability", "offline")
        if avail == "offline" and availability_preference != "any":
            continue

        reasons = _build_reasons(factors, expert)

        candidates.append(
            ExpertMatch(
                expert_id=str(expert["_id"]),
                name=expert.get("name") or expert.get("email") or "Expert",
                avatar_url=expert.get("avatarUrl"),
                score=factors["score"],
                availability=avail,
                specialization=factors["specialization"],
                past_accuracy=factors["past_accuracy"],
                response_speed=factors["response_speed"],
                tag_overlap=factors["tag_overlap"],
                reasons=reasons,
            )
        )

    candidates.sort(key=lambda e: e.score, reverse=True)
    return candidates[:limit]
