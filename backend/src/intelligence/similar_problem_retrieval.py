"""Retrieve and rank knowledge docs similar to a given question."""

from __future__ import annotations

from database import knowledge_docs, threads, messages
from models import SimilarProblem
from scoring import jaccard, token_cosine, score_knowledge_doc


async def find_similar(
    title: str,
    tags: list[str],
    subject: str,
    body: str = "",
    thread_id: str | None = None,
    limit: int = 5,
) -> list[SimilarProblem]:
    query_text = f"{title} {body} {subject} {' '.join(tags)}"
    query_tags = set(tags)

    # Fetch candidate docs — prefer tag overlap, fallback to recent
    filter_: dict = {}
    if tags:
        filter_["tags"] = {"$in": tags}

    docs = await knowledge_docs().find(filter_).sort("createdAt", -1).limit(100).to_list(length=100)
    if not docs and tags:
        docs = await knowledge_docs().find({}).sort("createdAt", -1).limit(120).to_list(length=120)

    results: list[SimilarProblem] = []

    def add_candidate(
        *,
        doc_id: str,
        candidate_thread_id: str,
        candidate_title: str,
        candidate_tags: list[str],
        candidate_body: str,
        solution: str,
        summary: str,
        quality_doc: dict | None = None,
        min_similarity: float = 0.08,
    ) -> None:
        if thread_id and candidate_thread_id == thread_id:
            return
        doc_tags = set(candidate_tags)
        doc_text = " ".join([candidate_title, candidate_body, summary, solution, " ".join(candidate_tags)])
        tag_sim = jaccard(query_tags, doc_tags)
        text_sim = token_cosine(query_text, doc_text)
        similarity = tag_sim * 0.35 + text_sim * 0.65

        if similarity < min_similarity:
            return

        quality = score_knowledge_doc(
            quality_doc
            or {
                "tags": candidate_tags,
                "solution": solution,
                "threadSummary": summary,
            }
        )

        combined = similarity * 0.9 + quality.total * 0.1

        results.append(
            SimilarProblem(
                doc_id=doc_id,
                thread_id=candidate_thread_id,
                title=candidate_title or "Untitled",
                tags=list(doc_tags),
                solution=solution,
                thread_summary=summary,
                similarity=round(similarity, 4),
                quality_score=round(quality.total, 4),
                combined_score=round(combined, 4),
            )
        )

    for doc in docs:
        doc_tags = set(doc.get("tags") or [])
        add_candidate(
            doc_id=str(doc["_id"]),
            candidate_thread_id=str(doc.get("questionId") or doc["_id"]),
            candidate_title=doc.get("title") or "Untitled",
            candidate_tags=list(doc_tags),
            candidate_body=doc.get("body") or "",
            solution=doc.get("solution") or "",
            summary=doc.get("threadSummary") or "",
            quality_doc=doc,
            min_similarity=0.12,
        )

    thread_docs = await threads().find(
        {"_id": {"$ne": thread_id}} if thread_id else {}
    ).sort("updatedAt", -1).limit(160).to_list(length=160)
    thread_ids = [thread["_id"] for thread in thread_docs]
    message_docs = await messages().find({"thread": {"$in": thread_ids}}).sort("createdAt", 1).to_list(length=640)
    message_map: dict[str, list[str]] = {}
    for message in message_docs:
        if message.get("type") == "SYSTEM_EVENT":
            continue
        key = str(message.get("thread"))
        message_map.setdefault(key, [])
        if len(message_map[key]) < 4:
            message_map[key].append(message.get("body") or "")

    for thread in thread_docs:
        tid = str(thread["_id"])
        message_text = "\n".join(message_map.get(tid, []))
        candidate_tags = list({thread.get("subject") or "", *((thread.get("tags") or []))})
        summary = (
            (thread.get("aiResponse") or {}).get("explanation")
            or " ".join([thread.get("title") or "", thread.get("body") or "", message_text])[:300]
        )
        add_candidate(
            doc_id=tid,
            candidate_thread_id=tid,
            candidate_title=thread.get("title") or "Untitled",
            candidate_tags=[tag for tag in candidate_tags if tag],
            candidate_body=" ".join([thread.get("body") or "", message_text]),
            solution="",
            summary=summary,
            min_similarity=0.08,
        )

    results.sort(key=lambda r: r.combined_score, reverse=True)
    deduped: list[SimilarProblem] = []
    seen_threads: set[str] = set()
    for result in results:
        if result.thread_id in seen_threads:
            continue
        seen_threads.add(result.thread_id)
        deduped.append(result)
    return deduped[:limit]
