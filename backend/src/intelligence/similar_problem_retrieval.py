"""Retrieve and rank knowledge docs similar to a given question."""

from __future__ import annotations

from database import knowledge_docs
from models import SimilarProblem
from scoring import jaccard, token_cosine, score_knowledge_doc


async def find_similar(
    title: str,
    tags: list[str],
    subject: str,
    limit: int = 5,
) -> list[SimilarProblem]:
    query_text = f"{title} {subject}"
    query_tags = set(tags)

    # Fetch candidate docs — prefer tag overlap, fallback to recent
    filter_: dict = {}
    if tags:
        filter_["tags"] = {"$in": tags}

    cursor = knowledge_docs().find(filter_).sort("createdAt", -1).limit(100)

    results: list[SimilarProblem] = []
    async for doc in cursor:
        doc_tags = set(doc.get("tags") or [])
        doc_text = " ".join([
            doc.get("title") or "",
            doc.get("body") or "",
            doc.get("threadSummary") or "",
        ])

        tag_sim = jaccard(query_tags, doc_tags)
        text_sim = token_cosine(query_text, doc_text)
        similarity = tag_sim * 0.4 + text_sim * 0.6

        if similarity < 0.05:
            continue

        quality = score_knowledge_doc(doc)

        combined = similarity * 0.6 + quality.total * 0.4

        results.append(
            SimilarProblem(
                doc_id=str(doc["_id"]),
                thread_id=str(doc.get("questionId") or doc["_id"]),
                title=doc.get("title") or "Untitled",
                tags=list(doc_tags),
                solution=doc.get("solution") or "",
                thread_summary=doc.get("threadSummary") or "",
                similarity=round(similarity, 4),
                quality_score=round(quality.total, 4),
                combined_score=round(combined, 4),
            )
        )

    results.sort(key=lambda r: r.combined_score, reverse=True)
    return results[:limit]
