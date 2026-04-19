"""
rank_experts — Mekari expert ranking module
==========================================

Public API
----------
    from rank_experts import rankExperts, Question, Expert

    result = rankExperts(
        question=Question(text="How do I use React hooks?", tags=["react", "hooks"]),
        experts=[
            Expert(id="e1", skills=["react", "javascript"], rating=4.5,
                   availability="available", pastSolvedTags=["react", "redux"]),
        ],
    )
    # result.tier  →  "available" | "offline" | "none"

Overview
--------
Given a question (text + tags) and a list of expert profiles, this module:

  1. Scores ALL experts using a weighted combination of:
       • TF-IDF cosine similarity  (question text vs expert skill document)
       • Jaccard overlap           (question.tags vs expert.pastSolvedTags)
       • Normalised rating         (expert.rating / 5)
  2. Attaches a rough confidence interval to every score.
  3. Applies decision logic and returns a typed, tiered result:

       AvailableResult  – ≥1 expert is currently reachable; returns only them.
       OfflineResult    – none available but ≥1 expert meets MIN_SCORE_THRESHOLD.
       NoneResult       – no expert meets the minimum threshold.

Modularity / ML upgrade path
-----------------------------
Scoring is delegated to a ``Scorer`` (Protocol below).  Pass any conforming
object to rankExperts(scorer=…) to swap in an embedding model or cross-encoder
without changing the rest of the pipeline.

Determinism
-----------
Identical inputs always produce identical outputs.  Tie-breaking on score is
by expert id (lexicographic ascending) so results are stable across runs.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Dict, List, Optional, Protocol, Tuple, Union, runtime_checkable

from config import (
    AVAILABLE_STATUSES,
    ETA_HINT,
    MIN_SCORE_THRESHOLD,
    RankWeights,
)
from utils.similarity import clamp, jaccard_similarity, tfidf_cosine_similarity


# ===========================================================================
# Domain types
# ===========================================================================

@dataclass
class Question:
    """A user-submitted technical question."""

    text: str
    tags: List[str]


@dataclass
class Expert:
    """A candidate expert profile from the Mekari user pool."""

    id: str
    skills: List[str]           # Declared skill / technology tags
    rating: float               # Star rating, 0–5
    availability: str           # "available" | "online" | "offline" | "busy" …
    pastSolvedTags: List[str]   # Tags of previously solved questions


@dataclass
class RankedExpert:
    """An expert with a composite relevance score and a rough confidence range."""

    id: str
    score: float            # Composite score, normalised to [0, 1]
    confidence_low: float   # Lower bound of rough confidence interval
    confidence_high: float  # Upper bound of rough confidence interval


# ---------------------------------------------------------------------------
# Result types — discriminated union on `tier`
# ---------------------------------------------------------------------------

@dataclass
class AvailableResult:
    """Returned when ≥1 expert is currently reachable."""

    experts: List[RankedExpert]
    tier: str = field(default="available", init=False)


@dataclass
class OfflineResult:
    """
    Returned when no expert is available right now, but ≥1 is relevant enough
    (score ≥ MIN_SCORE_THRESHOLD) to surface for an async reply.
    """

    experts: List[RankedExpert]
    etaHint: str = ETA_HINT
    tier: str = field(default="offline", init=False)


@dataclass
class NoneResult:
    """Returned when no expert meets the minimum relevance threshold."""

    reason: str = "No experts found for these tags"
    tier: str = field(default="none", init=False)


RankResult = Union[AvailableResult, OfflineResult, NoneResult]


# ===========================================================================
# Scorer protocol — the extension point for ML models
# ===========================================================================

@runtime_checkable
class Scorer(Protocol):
    """
    Interface for expert scoring strategies.

    Implement this to replace DefaultScorer with an embedding model,
    fine-tuned ranker, or any other mechanism.  The only contract is:

      • Accepts (question, experts, weights) and returns a ``List[float]``
        of the same length as ``experts``, each value in [0, 1].
      • Must be deterministic: equal inputs → equal output list.
    """

    def score(
        self,
        question: Question,
        experts: List[Expert],
        weights: RankWeights,
    ) -> List[float]:
        """Return a raw score in [0, 1] for each expert, in the same order."""
        ...


# ===========================================================================
# Default scorer: TF-IDF + Jaccard + rating
# ===========================================================================

class DefaultScorer:
    """
    Stateless, deterministic expert scorer.

    Scoring formula:
        score = w_text   * tfidf_cosine_sim(question.text, expert_doc)
              + w_tags   * jaccard(question.tags, expert.pastSolvedTags)
              + w_rating * (expert.rating / 5.0)

    expert_doc is the expert's skills ∪ pastSolvedTags, lowercased and sorted
    before joining so the TF-IDF corpus is canonical for any input ordering.
    """

    def score(
        self,
        question: Question,
        experts: List[Expert],
        weights: RankWeights,
    ) -> List[float]:
        if not experts:
            return []

        # Normalise question tags once (lowercase, stripped, deduplicated)
        question_tags = {t.lower().strip() for t in question.tags}

        # --- Feature 1: TF-IDF cosine similarity ---
        # Each expert is represented as a single document combining their
        # skills and past-solved tags.  Sorting ensures the corpus is
        # identical regardless of the input list order (determinism).
        expert_docs: List[str] = [
            " ".join(
                sorted({tok.lower().strip() for tok in e.skills + e.pastSolvedTags})
            )
            for e in experts
        ]
        text_sims: List[float] = tfidf_cosine_similarity(question.text, expert_docs)

        # --- Feature 2: pastSolvedTags overlap (Jaccard) ---
        tag_overlaps: List[float] = [
            jaccard_similarity(
                question_tags,
                {t.lower().strip() for t in e.pastSolvedTags},
            )
            for e in experts
        ]

        # --- Feature 3: Normalised star rating (0–5 → 0–1) ---
        rating_norms: List[float] = [clamp(e.rating / 5.0) for e in experts]

        # --- Weighted combination ---
        w = weights
        return [
            clamp(
                w.text_similarity * text_sims[i]
                + w.tag_overlap * tag_overlaps[i]
                + w.rating * rating_norms[i]
            )
            for i in range(len(experts))
        ]


# ===========================================================================
# Internal helpers
# ===========================================================================

def _confidence_margin(score: float) -> float:
    """
    Rough uncertainty margin for a given composite score.

    Higher scores mean multiple signals are in agreement → narrower interval.
    Lower scores indicate sparse or conflicting evidence → wider interval.

    Zones:
        score ≥ 0.60  →  ±0.06  (high-confidence)
        score ≥ 0.30  →  ±0.10  (moderate confidence)
        score  < 0.30  →  ±0.14  (low confidence / cold-start)
    """
    if score >= 0.60:
        return 0.06
    if score >= 0.30:
        return 0.10
    return 0.14


def _build_ranked_expert(expert: Expert, score: float) -> RankedExpert:
    margin = _confidence_margin(score)
    return RankedExpert(
        id=expert.id,
        score=round(score, 4),
        confidence_low=round(clamp(score - margin), 4),
        confidence_high=round(clamp(score + margin), 4),
    )


# ===========================================================================
# Public API
# ===========================================================================

def rankExperts(
    question: Question,
    experts: List[Expert],
    *,
    scorer: Optional[Scorer] = None,
    weights: Optional[RankWeights] = None,
) -> RankResult:
    """
    Score all experts for a question and apply tiered decision logic.

    Parameters
    ----------
    question  : Question(text, tags) — the user's technical question.
    experts   : Full list of candidate experts (NOT pre-filtered).
    scorer    : Scoring strategy.  Defaults to DefaultScorer (TF-IDF + Jaccard +
                rating).  Pass any Scorer-conforming object to plug in an ML model
                without changing this function or the decision logic.
    weights   : Feature weights.  Defaults to config values in config.py.
                Override per call-site without modifying config files.

    Returns
    -------
    AvailableResult
        When ≥1 expert's ``availability`` is in AVAILABLE_STATUSES.
        Contains only the available experts, ranked by score (highest first).

    OfflineResult
        When no expert is currently available but the best score in the pool
        meets or exceeds MIN_SCORE_THRESHOLD.
        Contains ALL ranked experts (highest first) plus an ETA hint.

    NoneResult
        When no expert's score meets the threshold — the pool is irrelevant
        to this question.

    The function is deterministic: ties in score are broken by expert id
    (lexicographic ascending).
    """
    _scorer: Scorer = scorer if scorer is not None else DefaultScorer()
    _weights: RankWeights = weights if weights is not None else RankWeights()

    # Step 1 — Score ALL experts without pre-filtering
    raw_scores: List[float] = _scorer.score(question, experts, _weights)

    # Step 2 — Pair each expert with its RankedExpert (score + confidence)
    pairs: List[Tuple[RankedExpert, Expert]] = [
        (_build_ranked_expert(expert, score), expert)
        for expert, score in zip(experts, raw_scores)
    ]

    # Step 3 — Sort by score DESC, then by id ASC for deterministic tie-breaking
    pairs.sort(key=lambda p: (-p[0].score, p[1].id))

    # Step 4 — Decision logic
    available_pairs = [
        (r, e) for r, e in pairs if e.availability in AVAILABLE_STATUSES
    ]

    if available_pairs:
        # Tier: available — surface only reachable experts, already ranked
        return AvailableResult(experts=[r for r, _ in available_pairs])

    all_ranked: List[RankedExpert] = [r for r, _ in pairs]
    best_score: float = all_ranked[0].score if all_ranked else 0.0

    if best_score >= MIN_SCORE_THRESHOLD:
        # Tier: offline — relevant experts exist but no one is online right now
        return OfflineResult(experts=all_ranked)

    # Tier: none — pool has no experts relevant to this question
    return NoneResult()
