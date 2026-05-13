"""Analyse a question and produce a QuestionContext."""

from __future__ import annotations
import json
import re

from models import Complexity, Intent, QuestionContext, Urgency
from llm_client import call_llm, is_llm_available

# ── Rule-based signals ─────────────────────────────────────────────────────────

_INTENT_KEYWORDS: dict[Intent, list[str]] = {
    Intent.debugging: [
        "error", "exception", "traceback", "bug", "crash", "fail", "broken",
        "undefined", "null", "typeerror", "not working", "issue", "problem",
    ],
    Intent.how_to: [
        "how to", "how do i", "how can i", "how do you", "steps to",
        "tutorial", "guide", "example",
    ],
    Intent.conceptual: [
        "what is", "explain", "difference between", "why does", "meaning of",
        "concept", "understand",
    ],
    Intent.architecture: [
        "design", "architecture", "structure", "pattern", "best practice",
        "scalable", "microservice", "monolith", "database schema",
    ],
    Intent.performance: [
        "slow", "performance", "optimize", "latency", "throughput", "memory",
        "cpu", "bottleneck", "faster",
    ],
    Intent.security: [
        "vulnerability", "exploit", "injection", "xss", "csrf", "auth",
        "permission", "token", "secret", "encrypt", "decrypt",
    ],
}

_URGENCY_HIGH = [
    "urgent", "asap", "immediately", "production down", "outage", "critical",
    "emergency", "broken in prod",
]
_URGENCY_MED = ["today", "soon", "need this", "deadline", "waiting"]

_CODE_FENCE = re.compile(r"```")
_ERROR_PATTERNS = re.compile(
    r"(error|exception|traceback|at line|undefined|null pointer|stacktrace)",
    re.I,
)

_LANG_HINTS: dict[str, list[str]] = {
    "python": ["python", "def ", "import ", "pip ", ".py"],
    "javascript": ["javascript", "const ", "let ", "npm ", ".js", "node"],
    "typescript": ["typescript", ".ts", "interface ", "type "],
    "java": ["java", "public class", "throws ", ".java"],
    "go": ["golang", "go ", "func ", "goroutine"],
    "rust": ["rust", "fn ", "cargo ", "unwrap("],
    "sql": ["sql", "select ", "insert ", "update ", "create table"],
}


def _detect_intent(text: str) -> Intent:
    lower = text.lower()
    scores: dict[Intent, int] = {}
    for intent, kws in _INTENT_KEYWORDS.items():
        scores[intent] = sum(1 for kw in kws if kw in lower)
    best = max(scores, key=lambda i: scores[i])
    return best if scores[best] > 0 else Intent.unknown


def _detect_language(text: str) -> str | None:
    lower = text.lower()
    for lang, hints in _LANG_HINTS.items():
        if any(h in lower for h in hints):
            return lang
    return None


def _detect_urgency(text: str) -> Urgency:
    lower = text.lower()
    if any(kw in lower for kw in _URGENCY_HIGH):
        return Urgency.high
    if any(kw in lower for kw in _URGENCY_MED):
        return Urgency.medium
    return Urgency.low


def _estimate_complexity(text: str, has_code: bool, has_error: bool) -> Complexity:
    word_count = len(text.split())
    if word_count > 300 or (has_code and has_error):
        return Complexity.high
    if word_count > 100 or has_code or has_error:
        return Complexity.medium
    return Complexity.low


def _extract_entities(text: str, tags: list[str]) -> list[str]:
    """Return plausible entity tokens (capitalised words + tags)."""
    caps = re.findall(r"\b[A-Z][a-zA-Z0-9]+\b", text)
    combined = list(dict.fromkeys(tags + caps))
    return combined[:10]


# ── LLM-enhanced analysis ──────────────────────────────────────────────────────

_SYSTEM_PROMPT = (
    "You are a technical question analyser. "
    "Given a question, return a JSON object with these keys:\n"
    "  intent: one of debugging|how_to|conceptual|architecture|performance|security|unknown\n"
    "  domain: short domain label (e.g. 'python', 'kubernetes', 'sql')\n"
    "  complexity: low|medium|high\n"
    "  entities: list of up to 8 key technical entities mentioned\n"
    "  language_detected: programming language or null\n"
    "Return ONLY the JSON object, no markdown."
)

_DEV_FALLBACK = json.dumps({
    "intent": "unknown",
    "domain": "general",
    "complexity": "medium",
    "entities": [],
    "language_detected": None,
})


async def understand_question(
    title: str,
    body: str,
    subject: str,
    tags: list[str],
) -> QuestionContext:
    full_text = f"{title}\n{body}"

    has_code = bool(_CODE_FENCE.search(full_text))
    has_error = bool(_ERROR_PATTERNS.search(full_text))
    urgency = _detect_urgency(full_text)

    # Rule-based baseline
    rule_intent = _detect_intent(full_text)
    rule_lang = _detect_language(full_text)
    rule_complexity = _estimate_complexity(full_text, has_code, has_error)
    rule_entities = _extract_entities(full_text, tags)

    if is_llm_available():
        prompt = (
            f"Subject: {subject}\nTitle: {title}\n"
            f"Tags: {', '.join(tags)}\n\nBody:\n{body[:1000]}"
        )
        raw = await call_llm(
            [
                {"role": "system", "content": _SYSTEM_PROMPT},
                {"role": "user", "content": prompt},
            ],
            max_tokens=300,
            json_mode=True,
            dev_fallback=_DEV_FALLBACK,
        )
        try:
            parsed = json.loads(raw)
            intent = Intent(parsed.get("intent", rule_intent.value))
            domain = parsed.get("domain") or subject or "general"
            complexity = Complexity(parsed.get("complexity", rule_complexity.value))
            entities = parsed.get("entities") or rule_entities
            language_detected = parsed.get("language_detected") or rule_lang
        except Exception:
            intent, domain, complexity = rule_intent, subject, rule_complexity
            entities, language_detected = rule_entities, rule_lang
    else:
        intent, domain, complexity = rule_intent, subject or "general", rule_complexity
        entities, language_detected = rule_entities, rule_lang

    return QuestionContext(
        intent=intent,
        domain=domain,
        complexity=complexity,
        entities=entities,
        detected_tags=tags,
        language_detected=language_detected,
        has_code=has_code,
        has_error=has_error,
        urgency=urgency,
    )
