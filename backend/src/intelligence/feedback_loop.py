"""Record feedback events and surface system health metrics."""

from __future__ import annotations
from datetime import datetime, timezone

from database import feedback_events, threads, point_events
from models import FeedbackEventPayload, SystemHealthStats


async def record_feedback(payload: FeedbackEventPayload) -> None:
    doc = payload.model_dump()
    doc["createdAt"] = datetime.now(timezone.utc)
    await feedback_events().insert_one(doc)


async def get_system_health() -> SystemHealthStats:
    # AI resolution rate: threads resolved by AI / total closed threads
    total_closed = await threads().count_documents(
        {"status": {"$in": ["AI_RESOLVED", "SOLVED", "CLOSED"]}}
    )
    ai_resolved = await threads().count_documents({"status": "AI_RESOLVED"})
    ai_resolution_rate = (ai_resolved / total_closed) if total_closed else 0.0

    # Average confidence error: difference between predicted confidence and actual resolution
    pipeline_conf = [
        {"$match": {"aiResponse.confidence": {"$exists": True}}},
        {
            "$project": {
                "conf": "$aiResponse.confidence",
                "resolved": {
                    "$cond": [{"$eq": ["$status", "AI_RESOLVED"]}, 1, 0]
                },
            }
        },
        {
            "$group": {
                "_id": None,
                "avg_error": {
                    "$avg": {
                        "$abs": {"$subtract": ["$conf", "$resolved"]}
                    }
                },
            }
        },
    ]
    conf_result = await threads().aggregate(pipeline_conf).to_list(1)
    avg_confidence_error = conf_result[0]["avg_error"] if conf_result else 0.0

    # Top domains by thread count
    domain_pipeline = [
        {"$group": {"_id": "$subject", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
        {"$limit": 5},
    ]
    domain_docs = await threads().aggregate(domain_pipeline).to_list(5)
    top_domains = [{"domain": d["_id"], "count": d["count"]} for d in domain_docs]

    # Expert response rate: expert_accepted / (expert_accepted + expert_rejected)
    accepted = await feedback_events().count_documents({"type": "expert_accepted"})
    rejected = await feedback_events().count_documents({"type": "expert_rejected"})
    total_exp = accepted + rejected
    expert_response_rate = (accepted / total_exp) if total_exp else 0.0

    return SystemHealthStats(
        ai_resolution_rate=round(ai_resolution_rate, 4),
        avg_confidence_error=round(avg_confidence_error, 4),
        top_domains=top_domains,
        expert_response_rate=round(expert_response_rate, 4),
    )
