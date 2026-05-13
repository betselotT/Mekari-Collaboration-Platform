from __future__ import annotations
from enum import Enum
from typing import Any, Literal, Optional
from pydantic import BaseModel, Field


# ── Enums ─────────────────────────────────────────────────────────────────────

class Intent(str, Enum):
    debugging = "debugging"
    how_to = "how_to"
    conceptual = "conceptual"
    architecture = "architecture"
    performance = "performance"
    security = "security"
    unknown = "unknown"


class Complexity(str, Enum):
    low = "low"
    medium = "medium"
    high = "high"


class EscalationMode(str, Enum):
    ai_only = "ai_only"
    ai_with_expert_standby = "ai_with_expert_standby"
    expert_now = "expert_now"
    live_session_suggested = "live_session_suggested"


class Urgency(str, Enum):
    low = "low"
    medium = "medium"
    high = "high"


# ── Core domain models ────────────────────────────────────────────────────────

class QuestionContext(BaseModel):
    intent: Intent = Intent.unknown
    domain: str = "general"
    complexity: Complexity = Complexity.medium
    entities: list[str] = Field(default_factory=list)
    detected_tags: list[str] = Field(default_factory=list)
    language_detected: Optional[str] = None
    has_code: bool = False
    has_error: bool = False
    urgency: Urgency = Urgency.low


class AIResponse(BaseModel):
    explanation: str = ""
    steps: list[str] = Field(default_factory=list)
    suggested_solution: str = ""
    confidence: float = 0.0
    resolved: bool = False


class SimilarProblem(BaseModel):
    doc_id: str
    thread_id: str
    title: str
    tags: list[str]
    solution: str
    thread_summary: str
    similarity: float
    quality_score: float
    combined_score: float


class ExpertMatch(BaseModel):
    expert_id: str
    name: str
    avatar_url: Optional[str] = None
    score: float          # 0–100
    availability: str
    specialization: float
    past_accuracy: float
    response_speed: float
    tag_overlap: float
    reasons: list[str]


class EscalationDecision(BaseModel):
    should_escalate: bool
    mode: EscalationMode
    reason: str
    urgency: Literal["immediate", "soon", "whenever"]
    decision_confidence: float


class TagSuggestion(BaseModel):
    tag: str
    source: Literal["keyword", "cooccurrence", "llm"]
    confidence: float


class KnowledgeQualityFactors(BaseModel):
    has_solution: float
    has_summary: float
    solution_length: float
    tag_coverage: float
    recency: float


class KnowledgeQualityScore(BaseModel):
    total: float
    factors: KnowledgeQualityFactors


class ResponseQualityScore(BaseModel):
    total: float
    has_explanation: float
    has_steps: float
    has_solution: float
    specificity_score: float
    confidence_calibration: float


class RankedAIResponse(BaseModel):
    explanation: str
    steps: list[str]
    suggested_solution: str
    confidence: float
    resolved: bool
    quality_score: float
    adjusted_confidence: float
    quality_factors: ResponseQualityScore


class RankedMessage(BaseModel):
    message_id: str
    body: str
    score: float
    reasons: list[str]


class FeedbackEventPayload(BaseModel):
    type: str
    thread_id: Optional[str] = None
    user_id: Optional[str] = None
    target_id: Optional[str] = None
    metadata: dict[str, Any] = Field(default_factory=dict)


class SystemHealthStats(BaseModel):
    ai_resolution_rate: float
    avg_confidence_error: float
    top_domains: list[dict[str, Any]]
    expert_response_rate: float


# ── Request / Response bodies for API endpoints ───────────────────────────────

class AnalyzeRequest(BaseModel):
    thread_id: str
    title: str
    body: str = ""
    subject: str
    tags: list[str] = Field(default_factory=list)


class AnalyzeResponse(BaseModel):
    context: QuestionContext
    ai_response: AIResponse
    ranked_ai_response: RankedAIResponse
    similar_problems: list[SimilarProblem]
    escalation: EscalationDecision
    suggested_tags: list[str]
    new_status: str   # OPEN | PENDING_EXPERT | AI_RESOLVED


class TagRequest(BaseModel):
    title: str
    body: str = ""
    subject: str
    existing_tags: list[str] = Field(default_factory=list)


class SimilarRequest(BaseModel):
    title: str
    tags: list[str]
    subject: str
    limit: int = 5


class ExpertRequest(BaseModel):
    subject: str
    tags: list[str]
    context: Optional[QuestionContext] = None
    requester_id: Optional[str] = None
    availability_preference: str = "online_or_busy"
    limit: int = 5


class ScoreResponseRequest(BaseModel):
    response: AIResponse
    context: Optional[QuestionContext] = None
    query_text: str = ""


class RankMessagesRequest(BaseModel):
    messages: list[dict[str, Any]]
    question_text: str
    context: Optional[QuestionContext] = None
