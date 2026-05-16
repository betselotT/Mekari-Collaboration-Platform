"""Shared async Gemini caller. All intelligence modules import from here."""

from __future__ import annotations
import json
import httpx
from config import settings


_DEV_FALLBACK_ANALYSIS = json.dumps({
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


async def call_llm(
    messages: list[dict[str, str]],
    *,
    max_tokens: int = 1200,
    json_mode: bool = False,
    dev_fallback: str | None = None,
) -> str:
    """
    Call the configured Gemini API.

    If GEMINI_API_KEY is absent:
    - returns dev_fallback when provided
    - raises RuntimeError otherwise
    """
    if not settings.gemini_api_key:
        if dev_fallback is not None:
            return dev_fallback
        raise RuntimeError("GEMINI_API_KEY is not set and no dev_fallback was provided")

    system_parts = [
        {"text": msg["content"]}
        for msg in messages
        if msg.get("role") == "system" and msg.get("content")
    ]
    contents = [
        {
            "role": "model" if msg.get("role") == "assistant" else "user",
            "parts": [{"text": msg.get("content", "")}],
        }
        for msg in messages
        if msg.get("role") != "system" and msg.get("content")
    ]

    body: dict = {
        "contents": contents,
        "generationConfig": {
            "maxOutputTokens": max_tokens,
        },
    }
    if system_parts:
        body["systemInstruction"] = {"parts": system_parts}
    if json_mode:
        body["generationConfig"]["responseMimeType"] = "application/json"

    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.post(
            f"{settings.gemini_base_url}/models/{settings.gemini_model}:generateContent",
            params={"key": settings.gemini_api_key},
            json=body,
            headers={
                "Content-Type": "application/json",
            },
        )

    if resp.status_code != 200:
        raise RuntimeError(f"LLM API error {resp.status_code}: {resp.text[:300]}")

    data = resp.json()
    try:
        parts = data["candidates"][0]["content"]["parts"]
        return "".join(part.get("text", "") for part in parts).strip()
    except (KeyError, IndexError, TypeError) as exc:
        raise RuntimeError("Gemini API response did not contain text output") from exc


def is_llm_available() -> bool:
    return bool(settings.gemini_api_key)
