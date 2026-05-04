"""Shared async LLM caller. All intelligence modules import from here."""

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
    Call the configured OpenAI-compatible API.

    If OPENAI_API_KEY is absent:
    - returns dev_fallback when provided
    - raises RuntimeError otherwise
    """
    if not settings.openai_api_key:
        if dev_fallback is not None:
            return dev_fallback
        raise RuntimeError("OPENAI_API_KEY is not set and no dev_fallback was provided")

    body: dict = {
        "model": settings.openai_model,
        "messages": messages,
        "max_tokens": max_tokens,
    }
    if json_mode:
        body["response_format"] = {"type": "json_object"}

    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.post(
            f"{settings.openai_base_url}/chat/completions",
            json=body,
            headers={
                "Authorization": f"Bearer {settings.openai_api_key}",
                "Content-Type": "application/json",
            },
        )

    if resp.status_code != 200:
        raise RuntimeError(f"LLM API error {resp.status_code}: {resp.text[:300]}")

    data = resp.json()
    return data["choices"][0]["message"]["content"]


def is_llm_available() -> bool:
    return bool(settings.openai_api_key)
