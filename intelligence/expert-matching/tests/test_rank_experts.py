"""
Tests for rank_experts module.

Run:  pytest tests/test_rank_experts.py -v
      (from the intelligence/matching-expert directory)

  or from anywhere:
      pytest intelligence/matching-expert/tests/test_rank_experts.py -v

Scenario
--------
One React-related question is tested against a small pool of experts with
varying skill sets, ratings, and availability to exercise every tier of
decision logic and the core scoring properties.
"""

from __future__ import annotations

import sys
import os

# Put intelligence/matching-expert/ first on sys.path (for rank_experts, config).
# Put intelligence/ second (for utils.similarity used by rank_experts internally).
_MATCHING_EXPERT_DIR = os.path.dirname(os.path.dirname(__file__))
_INTELLIGENCE_DIR = os.path.dirname(_MATCHING_EXPERT_DIR)
sys.path.insert(0, _INTELLIGENCE_DIR)
sys.path.insert(0, _MATCHING_EXPERT_DIR)

import pytest

from rank_experts import (
    AvailableResult,
    DefaultScorer,
    Expert,
    NoneResult,
    OfflineResult,
    Question,
    RankedExpert,
    RankResult,
    Scorer,
    rankExperts,
)
from config import MIN_SCORE_THRESHOLD, RankWeights


# ===========================================================================
# Shared fixtures
# ===========================================================================

@pytest.fixture
def react_question() -> Question:
    return Question(
        text="How do I manage side effects in a React functional component using hooks?",
        tags=["react", "hooks", "javascript"],
    )


@pytest.fixture
def expert_pool() -> list[Expert]:
    """
    Four experts covering different skill sets and availability states.

    e-react   — React specialist, available, high rating, rich React history.
    e-ts      — TypeScript / React, offline, very high rating.
    e-backend — Node/Python backend, available, medium rating, no React history.
    e-cold    — Brand-new expert, no pastSolvedTags, offline.
    """
    return [
        Expert(
            id="e-react",
            skills=["react", "javascript", "hooks", "redux"],
            rating=4.7,
            availability="available",
            pastSolvedTags=["react", "hooks", "useState", "useEffect", "context-api"],
        ),
        Expert(
            id="e-ts",
            skills=["react", "typescript", "next.js", "javascript"],
            rating=4.9,
            availability="offline",
            pastSolvedTags=["react", "typescript", "hooks", "zustand"],
        ),
        Expert(
            id="e-backend",
            skills=["node.js", "python", "django", "postgresql"],
            rating=4.2,
            availability="available",
            pastSolvedTags=["rest-api", "authentication", "sql"],
        ),
        Expert(
            id="e-cold",
            skills=["javascript"],
            rating=3.0,
            availability="offline",
            pastSolvedTags=[],
        ),
    ]


# ===========================================================================
# Tier: available
# ===========================================================================

class TestAvailableTier:
    def test_returns_available_tier_when_expert_reachable(
        self, react_question, expert_pool
    ):
        result = rankExperts(react_question, expert_pool)
        assert isinstance(result, AvailableResult)
        assert result.tier == "available"

    def test_only_available_experts_returned(
        self, react_question, expert_pool
    ):
        result = rankExperts(react_question, expert_pool)
        assert isinstance(result, AvailableResult)
        available_ids = {e.id for e in expert_pool if e.availability == "available"}
        returned_ids = {r.id for r in result.experts}
        assert returned_ids.issubset(available_ids), (
            "Result must not include offline experts when tier is available"
        )

    def test_react_expert_ranked_above_backend_expert(
        self, react_question, expert_pool
    ):
        """e-react has strong React skills & history; e-backend has none."""
        result = rankExperts(react_question, expert_pool)
        assert isinstance(result, AvailableResult)
        ids = [r.id for r in result.experts]
        assert ids.index("e-react") < ids.index("e-backend"), (
            "React expert should rank above backend expert for a React question"
        )

    def test_experts_sorted_descending_by_score(
        self, react_question, expert_pool
    ):
        result = rankExperts(react_question, expert_pool)
        assert isinstance(result, AvailableResult)
        scores = [r.score for r in result.experts]
        assert scores == sorted(scores, reverse=True)


# ===========================================================================
# Tier: offline
# ===========================================================================

class TestOfflineTier:
    @pytest.fixture
    def offline_pool(self, expert_pool) -> list[Expert]:
        """Make all experts offline."""
        return [
            Expert(
                id=e.id,
                skills=e.skills,
                rating=e.rating,
                availability="offline",
                pastSolvedTags=e.pastSolvedTags,
            )
            for e in expert_pool
        ]

    def test_returns_offline_tier_when_no_expert_available(
        self, react_question, offline_pool
    ):
        result = rankExperts(react_question, offline_pool)
        assert isinstance(result, OfflineResult)
        assert result.tier == "offline"

    def test_eta_hint_is_present(self, react_question, offline_pool):
        result = rankExperts(react_question, offline_pool)
        assert isinstance(result, OfflineResult)
        assert isinstance(result.etaHint, str) and len(result.etaHint) > 0

    def test_all_experts_included_in_offline_result(
        self, react_question, offline_pool
    ):
        result = rankExperts(react_question, offline_pool)
        assert isinstance(result, OfflineResult)
        assert len(result.experts) == len(offline_pool)

    def test_offline_experts_sorted_descending(
        self, react_question, offline_pool
    ):
        result = rankExperts(react_question, offline_pool)
        assert isinstance(result, OfflineResult)
        scores = [r.score for r in result.experts]
        assert scores == sorted(scores, reverse=True)


# ===========================================================================
# Tier: none
# ===========================================================================

class TestNoneTier:
    def test_returns_none_tier_when_pool_irrelevant(self, react_question):
        """Experts with no React overlap and low ratings should score below threshold."""
        irrelevant_pool = [
            Expert(
                id="e-mech",
                skills=["mechanical engineering", "cad", "solidworks"],
                rating=1.0,
                availability="offline",
                pastSolvedTags=["beam-design", "stress-analysis", "materials"],
            ),
            Expert(
                id="e-bio",
                skills=["biology", "genomics", "r-language"],
                rating=1.0,
                availability="offline",
                pastSolvedTags=["rna-seq", "bioinformatics"],
            ),
        ]
        result = rankExperts(react_question, irrelevant_pool)
        assert isinstance(result, NoneResult)
        assert result.tier == "none"
        assert isinstance(result.reason, str) and len(result.reason) > 0

    def test_returns_none_tier_for_empty_pool(self, react_question):
        result = rankExperts(react_question, [])
        assert isinstance(result, NoneResult)
        assert result.tier == "none"


# ===========================================================================
# Score and confidence properties
# ===========================================================================

class TestScoreProperties:
    def test_scores_in_unit_range(self, react_question, expert_pool):
        """Every score must be within [0, 1]."""
        result = rankExperts(react_question, expert_pool)
        experts_out: list[RankedExpert] = (
            result.experts if hasattr(result, "experts") else []
        )
        for r in experts_out:
            assert 0.0 <= r.score <= 1.0, f"Score out of range: {r.id}={r.score}"

    def test_confidence_bounds_are_valid(self, react_question, expert_pool):
        """confidence_low <= score <= confidence_high, all in [0, 1]."""
        result = rankExperts(react_question, expert_pool)
        experts_out: list[RankedExpert] = (
            result.experts if hasattr(result, "experts") else []
        )
        for r in experts_out:
            assert 0.0 <= r.confidence_low <= r.score, (
                f"{r.id}: confidence_low ({r.confidence_low}) > score ({r.score})"
            )
            assert r.score <= r.confidence_high <= 1.0, (
                f"{r.id}: confidence_high ({r.confidence_high}) < score ({r.score})"
            )

    def test_high_scorer_has_narrower_confidence_than_low_scorer(
        self, react_question, expert_pool
    ):
        """e-react (high relevance) should have a tighter interval than e-backend."""
        all_offline_pool = [
            Expert(id=e.id, skills=e.skills, rating=e.rating,
                   availability="offline", pastSolvedTags=e.pastSolvedTags)
            for e in expert_pool
        ]
        result = rankExperts(react_question, all_offline_pool)
        assert isinstance(result, OfflineResult)
        by_id = {r.id: r for r in result.experts}
        react_width = by_id["e-react"].confidence_high - by_id["e-react"].confidence_low
        backend_width = by_id["e-backend"].confidence_high - by_id["e-backend"].confidence_low
        assert react_width <= backend_width, (
            "High-scoring React expert should have narrower confidence interval"
        )


# ===========================================================================
# Determinism
# ===========================================================================

class TestDeterminism:
    def test_identical_inputs_produce_identical_outputs(
        self, react_question, expert_pool
    ):
        result_a = rankExperts(react_question, expert_pool)
        result_b = rankExperts(react_question, expert_pool)
        assert type(result_a) is type(result_b)
        if hasattr(result_a, "experts") and hasattr(result_b, "experts"):
            ids_a = [r.id for r in result_a.experts]
            ids_b = [r.id for r in result_b.experts]
            assert ids_a == ids_b, "Order must be identical across runs"
            scores_a = [r.score for r in result_a.experts]
            scores_b = [r.score for r in result_b.experts]
            assert scores_a == scores_b, "Scores must be identical across runs"


# ===========================================================================
# Configurability
# ===========================================================================

class TestConfigurableWeights:
    def test_custom_weights_accepted(self, react_question, expert_pool):
        """rankExperts must accept a custom RankWeights without error."""
        custom = RankWeights(text_similarity=0.60, tag_overlap=0.20, rating=0.20)
        result = rankExperts(react_question, expert_pool, weights=custom)
        assert result.tier in ("available", "offline", "none")

    def test_custom_scorer_accepted(self, react_question, expert_pool):
        """Any object satisfying the Scorer protocol can be plugged in."""

        class ConstantScorer:
            """Trivial scorer that gives every expert a fixed score of 0.5."""

            def score(self, question, experts, weights):
                return [0.5] * len(experts)

        result = rankExperts(react_question, expert_pool, scorer=ConstantScorer())
        # All experts score 0.5 → above threshold → either available or offline
        assert result.tier in ("available", "offline")

    def test_scorer_protocol_conformance(self):
        """DefaultScorer must satisfy the Scorer runtime-checkable Protocol."""
        assert isinstance(DefaultScorer(), Scorer)
