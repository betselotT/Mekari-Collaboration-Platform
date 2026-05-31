"""Escalation decision engine for routing learner questions."""

from __future__ import annotations

import re
from typing import Literal

from config import settings
from models import (
    ChatEscalationRequest,
    ChatEscalationResponse,
    Complexity,
    EscalationDecision,
    EscalationMode,
    ExpertMatch,
    Intent,
    QuestionContext,
    Urgency,
)
from expert_matcher import find_experts
from tag_recommendation import recommend_tags

_HUMAN_REVIEW_INTENTS = {Intent.security, Intent.architecture}
_EXPERT_FRIENDLY_INTENTS = {Intent.debugging, Intent.performance}
_AI_FRIENDLY_INTENTS = {Intent.conceptual, Intent.how_to}


def _clamp(value: float, minimum: float = 0.0, maximum: float = 1.0) -> float:
    return max(minimum, min(maximum, value))


def _complexity_risk(complexity: Complexity) -> float:
    return {
        Complexity.low: 0.05,
        Complexity.medium: 0.22,
        Complexity.high: 0.42,
    }[complexity]


def _urgency_risk(urgency: Urgency) -> float:
    return {
        Urgency.low: 0.0,
        Urgency.medium: 0.18,
        Urgency.high: 0.35,
    }[urgency]


def _intent_risk(intent: Intent) -> float:
    if intent in _HUMAN_REVIEW_INTENTS:
        return 0.38
    if intent in _EXPERT_FRIENDLY_INTENTS:
        return 0.18
    if intent in _AI_FRIENDLY_INTENTS:
        return -0.08
    return 0.08


def _evidence_risk(context: QuestionContext) -> float:
    risk = 0.0
    if context.has_error:
        risk += 0.12
    if context.has_code:
        risk += 0.08
    if len(context.entities) >= 5:
        risk += 0.05
    return risk


def _urgency_label(context: QuestionContext, risk: float) -> Literal["immediate", "soon", "whenever"]:
    if context.urgency == Urgency.high or risk >= 0.78:
        return "immediate"
    if context.urgency == Urgency.medium or risk >= 0.42:
        return "soon"
    return "whenever"


def _mode_for(context: QuestionContext, risk: float, ai_confidence: float) -> EscalationMode:
    if context.urgency == Urgency.high and context.complexity == Complexity.high:
        return EscalationMode.live_session_suggested
    if context.intent in _HUMAN_REVIEW_INTENTS:
        return EscalationMode.expert_now
    if risk >= 0.72 or ai_confidence < 0.35:
        return EscalationMode.expert_now
    return EscalationMode.ai_with_expert_standby


def _reason(
    context: QuestionContext,
    ai_confidence: float,
    ai_resolved: bool,
    risk: float,
) -> str:
    reasons: list[str] = []
    if context.intent in _HUMAN_REVIEW_INTENTS:
        reasons.append(f"{context.intent.value} questions need human review")
    if context.complexity == Complexity.high:
        reasons.append("high complexity")
    if context.urgency != Urgency.low:
        reasons.append(f"{context.urgency.value} urgency")
    if context.has_error:
        reasons.append("error/debugging signals")
    if not ai_resolved:
        reasons.append("AI did not fully resolve")
    if ai_confidence < settings.ai_confidence_threshold:
        reasons.append(f"AI confidence {ai_confidence:.0%} is below threshold")

    if not reasons:
        reasons.append(f"risk score {risk:.0%}")
    return "; ".join(reasons)


def decide_escalation(
    context: QuestionContext,
    ai_confidence: float,
    ai_resolved: bool,
) -> EscalationDecision:
    """Decide whether a learner question needs expert involvement.

    The decision is intentionally risk-based rather than a single confidence
    threshold. Confidence matters, but security, architecture, urgency,
    complexity, code/error evidence, and whether the AI actually resolved the
    issue all contribute to routing.
    """

    confidence = _clamp(ai_confidence)
    confidence_gap = max(0.0, settings.ai_standalone_threshold - confidence)
    risk = _clamp(
        confidence_gap
        + _intent_risk(context.intent)
        + _complexity_risk(context.complexity)
        + _urgency_risk(context.urgency)
        + _evidence_risk(context)
        + (0.22 if not ai_resolved else 0.0)
    )

    can_stay_ai_only = (
        ai_resolved
        and confidence >= settings.ai_standalone_threshold
        and context.intent not in _HUMAN_REVIEW_INTENTS
        and context.urgency != Urgency.high
        and context.complexity != Complexity.high
    )

    if can_stay_ai_only:
        return EscalationDecision(
            should_escalate=False,
            mode=EscalationMode.ai_only,
            reason="AI resolved with strong confidence and low routing risk",
            urgency="whenever",
            decision_confidence=round(max(confidence, 1.0 - risk), 3),
        )

    should_escalate = (
        context.intent in _HUMAN_REVIEW_INTENTS
        or context.urgency == Urgency.high
        or context.complexity == Complexity.high
        or not ai_resolved
        or confidence < settings.ai_confidence_threshold
        or risk >= 0.38
    )

    if not should_escalate:
        return EscalationDecision(
            should_escalate=False,
            mode=EscalationMode.ai_only,
            reason="AI answer is adequate and routing risk is low",
            urgency="whenever",
            decision_confidence=round(max(confidence, 1.0 - risk), 3),
        )

    mode = _mode_for(context, risk, confidence)
    return EscalationDecision(
        should_escalate=True,
        mode=mode,
        reason=_reason(context, confidence, ai_resolved, risk),
        urgency=_urgency_label(context, risk),
        decision_confidence=round(max(risk, 1.0 - confidence), 3),
    )


_MATERIAL_ESCALATION_PATTERNS: list[tuple[re.Pattern[str], str, list[str], Literal["immediate", "soon"]]] = [
    (
        re.compile(
            r"\b(hacked|breach(?:ed)?|compromised|credential(?:s)?|password(?:s)?|leak(?:ed)?|"
            r"sql injection|sqli|data leak|attacker|exploit|vulnerability|incident response)\b",
            re.I,
        ),
        "Security incident or credential exposure risk needs human expert review",
        ["security", "incident-response", "sql-injection", "credentials"],
        "immediate",
    ),
    (
        re.compile(r"\b(production down|outage|data loss|corrupt(?:ed|ion)|rollback|hotfix|sev[ -]?[0-2])\b", re.I),
        "Production or data-loss risk needs expert support",
        ["incident-response", "production"],
        "immediate",
    ),
    (
        re.compile(r"\b(load-bearing|structural failure|high voltage|mains voltage|medical|legal|financial advice)\b", re.I),
        "High-impact safety, legal, medical, or financial advice should be reviewed by a qualified human",
        ["high-stakes"],
        "soon",
    ),
]

_UNCERTAINTY_PATTERNS: list[re.Pattern[str]] = [
    re.compile(r"\bi (?:can'?t|cannot|do not|don't) (?:safely |reliably )?(?:answer|determine|verify|access)\b", re.I),
    re.compile(r"\bi (?:need|would need) (?:private|production|system|repository|database|environment) (?:context|access|details)\b", re.I),
    re.compile(r"\bconsult (?:a|an) (?:human|expert|professional|qualified)\b", re.I),
    re.compile(r"\bbeyond my (?:ability|scope|capabilities)\b", re.I),
]

_MATERIAL_CONTEXT_PATTERN = re.compile(
    r"\b(production|prod|customer|user data|credentials?|passwords?|security|breach|hacked|"
    r"incident|outage|data loss|private repo|confidential|payment|medical|legal|financial|"
    r"high voltage|load-bearing|structural)\b",
    re.I,
)


def _infer_chat_subject(text: str) -> str:
    if re.search(r"\b(security|breach|hacked|sql injection|credential|password|vulnerability|exploit)\b", text, re.I):
        return "Cybersecurity"
    if re.search(r"\b(circuit|electrical|electronics|embedded|microcontroller|arduino|voltage|current)\b", text, re.I):
        return "Electrical Engineering"
    if re.search(r"\b(mechanical|thermodynamics|fluid|beam|cad|solidworks|autocad)\b", text, re.I):
        return "Mechanical Engineering"
    if re.search(r"\b(civil|structural|concrete|load-bearing|foundation)\b", text, re.I):
        return "Civil Engineering"
    if re.search(r"\b(algorithm|data structure|dsa|dynamic programming|graph|tree|complexity)\b", text, re.I):
        return "Data Structures & Algorithms"
    if re.search(r"\b(ai|llm|machine learning|rag|embedding|agentic|gemini|openai)\b", text, re.I):
        return "Artificial Intelligence"
    return "Software Engineering"


def _chat_history_text(messages: list[dict]) -> str:
    lines: list[str] = []
    for message in messages[-6:]:
        text = str(message.get("text", "")).strip()
        if text:
            lines.append(f"{message.get('role', 'user')}: {text}")
    return "\n".join(lines)


def _chat_signal(prompt: str, response_text: str) -> tuple[str, Literal["immediate", "soon"], list[str]] | None:
    for pattern, reason, tags, urgency in _MATERIAL_ESCALATION_PATTERNS:
        if pattern.search(prompt):
            return reason, urgency, tags

    has_material_context = bool(_MATERIAL_CONTEXT_PATTERN.search(prompt))
    ai_is_uncertain = any(pattern.search(response_text) for pattern in _UNCERTAINTY_PATTERNS)
    if has_material_context and ai_is_uncertain:
        return (
            "The assistant needs human judgment for a high-impact or private-context question",
            "soon",
            ["expert-help"],
        )

    return None


async def decide_chatbot_escalation(req: ChatEscalationRequest) -> ChatEscalationResponse:
    """Escalate chatbot answers only for material risk, not routine questions."""
    context_text = "\n".join(
        part for part in [_chat_history_text(req.messages), req.prompt, req.response_text] if part
    )
    subject = _infer_chat_subject(context_text)
    signal = _chat_signal(req.prompt, req.response_text)

    if signal is None:
        return ChatEscalationResponse(
            should_escalate=False,
            reason="No material escalation trigger detected",
            urgency="soon",
            subject=subject,
            tags=[],
            experts=[],
        )

    reason, urgency, seed_tags = signal
    generated_tags = await recommend_tags(
        title=req.prompt[:120],
        body=context_text,
        subject=subject,
        existing_tags=seed_tags,
    )
    tags = list(dict.fromkeys(seed_tags + generated_tags))
    experts: list[ExpertMatch] = await find_experts(
        subject=subject,
        tags=tags,
        requester_id=req.requester_id,
        availability_preference="online_or_busy" if urgency == "immediate" else "any",
        limit=req.limit,
    )

    return ChatEscalationResponse(
        should_escalate=True,
        reason=reason,
        urgency=urgency,
        subject=subject,
        tags=tags,
        experts=experts,
    )
