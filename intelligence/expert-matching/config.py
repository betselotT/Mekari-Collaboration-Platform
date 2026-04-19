"""
Configuration for the rankExperts scoring formula.

score = w_text  * tfidf_similarity(question.text, expert_skills_doc)
      + w_tags  * jaccard(question.tags, expert.pastSolvedTags)
      + w_rating * (expert.rating / 5.0)

All three positive weights must sum to 1.0.  Adjust them here (or pass a custom
RankWeights instance to rankExperts) without touching scoring logic.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, FrozenSet


@dataclass
class RankWeights:
    """
    Configurable feature weights for the rankExperts scoring formula.

    Swap values here or instantiate with overrides per call-site:

        rankExperts(q, experts, weights=RankWeights(tag_overlap=0.50, rating=0.10, text_similarity=0.40))
    """

    text_similarity: float = 0.40   # TF-IDF cosine: question text vs expert doc
    tag_overlap: float = 0.35       # Jaccard: question.tags vs expert.pastSolvedTags
    rating: float = 0.25            # Normalised star rating (0–5 → 0–1)

    def as_dict(self) -> Dict[str, float]:
        return {
            "text_similarity": self.text_similarity,
            "tag_overlap": self.tag_overlap,
            "rating": self.rating,
        }


# ---------------------------------------------------------------------------
# Decision thresholds
# ---------------------------------------------------------------------------

# Minimum composite score required for an expert pool to qualify as "offline"
# (rather than "none").  Experts whose entire pool scores below this signal
# that no one is relevant enough to recommend — even asynchronously.
MIN_SCORE_THRESHOLD: float = 0.15

# Availability string values that count as "currently reachable".
# Covers both the frontend convention ("available") and the backend
# User model convention ("online").
AVAILABLE_STATUSES: FrozenSet[str] = frozenset({"available", "online"})

# Human-readable ETA hint surfaced when all experts are offline.
ETA_HINT: str = "typically responds within 2h"
