"""Suggest tags for a thread using keyword matching, co-occurrence, and LLM."""

from __future__ import annotations
import json
from collections import Counter

from database import knowledge_docs
from models import QuestionContext, TagSuggestion
from llm_client import call_llm, is_llm_available
from scoring import _tokenize

# ── Keyword → tag dictionary ───────────────────────────────────────────────────

_KEYWORD_MAP: dict[str, str] = {
    "python": "python", "django": "django", "flask": "flask",
    "fastapi": "fastapi", "javascript": "javascript", "typescript": "typescript",
    "react": "react", "nextjs": "nextjs", "node": "nodejs", "express": "express",
    "mongodb": "mongodb", "postgres": "postgresql", "mysql": "mysql",
    "redis": "redis", "docker": "docker", "kubernetes": "kubernetes",
    "aws": "aws", "gcp": "gcp", "azure": "azure",
    "sql": "sql", "nosql": "nosql", "graphql": "graphql", "rest": "rest-api",
    "authentication": "auth", "authorization": "auth", "jwt": "jwt",
    "git": "git", "github": "github", "ci": "ci-cd", "cd": "ci-cd",
    "tensorflow": "machine-learning", "pytorch": "machine-learning",
    "pandas": "pandas", "numpy": "numpy",
    "error": "debugging", "exception": "debugging", "bug": "debugging",
    "performance": "performance", "optimize": "performance",
    "security": "security", "vulnerability": "security",
}


def _keyword_tags(text: str) -> list[TagSuggestion]:
    tokens = set(_tokenize(text))
    seen: set[str] = set()
    results: list[TagSuggestion] = []
    for token, tag in _KEYWORD_MAP.items():
        if token in tokens and tag not in seen:
            seen.add(tag)
            results.append(TagSuggestion(tag=tag, source="keyword", confidence=0.85))
    return results


# ── Co-occurrence from KnowledgeDocs ──────────────────────────────────────────

async def _cooccurrence_tags(
    text_tokens: set[str],
    existing_tags: list[str],
    limit: int = 5,
) -> list[TagSuggestion]:
    """Find tags that frequently co-occur with existing tags in the knowledge base."""
    if not existing_tags:
        return []

    cursor = knowledge_docs().find(
        {"tags": {"$in": existing_tags}},
        {"tags": 1},
    ).limit(200)

    co_counter: Counter[str] = Counter()
    async for doc in cursor:
        for tag in doc.get("tags", []):
            if tag not in existing_tags:
                co_counter[tag] += 1

    suggestions: list[TagSuggestion] = []
    for tag, count in co_counter.most_common(limit):
        confidence = min(0.80, 0.40 + count * 0.05)
        suggestions.append(
            TagSuggestion(tag=tag, source="cooccurrence", confidence=round(confidence, 3))
        )
    return suggestions


# ── LLM tag suggestion ─────────────────────────────────────────────────────────

_SYS = (
    "You are a tag recommender for a technical Q&A platform. "
    "Given a question, return a JSON object with key 'tags': "
    "a list of up to 6 lowercase hyphenated tags (e.g. 'rest-api', 'nodejs'). "
    "Return ONLY the JSON object."
)
_DEV_FALLBACK = json.dumps({"tags": []})


async def _llm_tags(
    title: str, body: str, subject: str, existing: list[str]
) -> list[TagSuggestion]:
    if not is_llm_available():
        return []
    prompt = (
        f"Subject: {subject}\nTitle: {title}\n"
        f"Existing tags: {', '.join(existing)}\n\nBody:\n{body[:800]}"
    )
    raw = await call_llm(
        [
            {"role": "system", "content": _SYS},
            {"role": "user", "content": prompt},
        ],
        max_tokens=150,
        json_mode=True,
        dev_fallback=_DEV_FALLBACK,
    )
    try:
        tags = json.loads(raw).get("tags", [])
        return [
            TagSuggestion(tag=t.lower(), source="llm", confidence=0.75)
            for t in tags
            if isinstance(t, str)
        ]
    except Exception:
        return []


# ── Public interface ───────────────────────────────────────────────────────────

async def recommend_tags(
    title: str,
    body: str,
    subject: str,
    existing_tags: list[str],
    context: QuestionContext | None = None,
) -> list[str]:
    full_text = f"{title} {body} {subject}"
    text_tokens = set(_tokenize(full_text))

    kw = _keyword_tags(full_text)
    co = await _cooccurrence_tags(text_tokens, existing_tags)
    llm = await _llm_tags(title, body, subject, existing_tags)

    # Merge, deduplicate, sort by confidence
    seen: set[str] = set(existing_tags)
    merged: list[TagSuggestion] = []
    for suggestion in kw + co + llm:
        if suggestion.tag not in seen:
            seen.add(suggestion.tag)
            merged.append(suggestion)

    merged.sort(key=lambda s: s.confidence, reverse=True)
    return [s.tag for s in merged[:8]]
