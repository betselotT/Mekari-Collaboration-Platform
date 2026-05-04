"""Pure-function escalation decision — no I/O."""

from __future__ import annotations
from typing import Literal

from config import settings
from models import (
    Complexity,
    EscalationDecision,
    EscalationMode,
    Intent,
    QuestionContext,
)

# Intents that warrant human review even at high AI confidence
_ALWAYS_ESCALATE_INTENTS = {Intent.security, Intent.architecture}

# Intents where AI can resolve without escalation
_LOW_ESCALATION_INTENTS = {Intent.how_to, Intent.conceptual}


def decide_escalation(
    context: QuestionContext,
    ai_confidence: float,
    ai_resolved: bool,
) -> EscalationDecision:
    urgency: Literal["immediate", "soon", "whenever"]

    # Force escalation for security/architecture regardless of confidence
    if context.intent in _ALWAYS_ESCALATE_INTENTS:
        return EscalationDecision(
            should_escalate=True,
            mode=EscalationMode.expert_now,
            reason=f"Intent '{context.intent.value}' requires human expert review",
            urgency="soon",
            decision_confidence=0.95,
        )

    # AI says resolved and confidence is high → no escalation needed
    if ai_resolved and ai_confidence >= settings.ai_standalone_threshold:
        return EscalationDecision(
            should_escalate=False,
            mode=EscalationMode.ai_only,
            reason="AI resolved with high confidence",
            urgency="whenever",
            decision_confidence=round(ai_confidence, 3),
        )

    # Medium confidence zone → keep expert on standby
    if ai_confidence >= settings.ai_confidence_threshold:
        if context.complexity == Complexity.high:
            return EscalationDecision(
                should_escalate=True,
                mode=EscalationMode.ai_with_expert_standby,
                reason="High complexity warrants expert standby despite adequate AI confidence",
                urgency="soon",
                decision_confidence=round(ai_confidence * 0.9, 3),
            )
        return EscalationDecision(
            should_escalate=False,
            mode=EscalationMode.ai_only,
            reason="AI confidence meets threshold; complexity is manageable",
            urgency="whenever",
            decision_confidence=round(ai_confidence, 3),
        )

    # Low confidence — decide urgency based on urgency field + complexity
    from models import Urgency  # local import to avoid circular at module load

    if context.urgency == Urgency.high or context.complexity == Complexity.high:
        urgency = "immediate"
        mode = EscalationMode.expert_now
    elif context.complexity == Complexity.medium:
        urgency = "soon"
        mode = EscalationMode.ai_with_expert_standby
    else:
        urgency = "soon"
        mode = EscalationMode.ai_with_expert_standby

    # Suggest live session for very complex or urgent situations
    if context.urgency == Urgency.high and context.complexity == Complexity.high:
        mode = EscalationMode.live_session_suggested
        urgency = "immediate"

    return EscalationDecision(
        should_escalate=True,
        mode=mode,
        reason=f"AI confidence {ai_confidence:.0%} below threshold; escalating to expert",
        urgency=urgency,
        decision_confidence=round(1.0 - ai_confidence, 3),
    )
