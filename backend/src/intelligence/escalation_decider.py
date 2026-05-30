"""Escalation decision engine for routing learner questions."""

from __future__ import annotations

from typing import Literal

from config import settings
from models import (
    Complexity,
    EscalationDecision,
    EscalationMode,
    Intent,
    QuestionContext,
    Urgency,
)

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
