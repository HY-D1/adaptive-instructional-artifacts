from __future__ import annotations

from analysis.off_policy_simulation.propensity import (
    estimate_propensity,
    estimate_propensity_by_matching,
)


def test_estimate_propensity_uses_thompson_sampling_posteriors() -> None:
    stats = {
        "aggressive": {"mean": 0.85, "pulls": 25},
        "conservative": {"mean": 0.35, "pulls": 25},
        "explanation-first": {"mean": 0.25, "pulls": 25},
        "adaptive": {"mean": 0.20, "pulls": 25},
    }

    aggressive = estimate_propensity(stats, "aggressive", n_simulations=2000, random_seed=5)
    conservative = estimate_propensity(stats, "conservative", n_simulations=2000, random_seed=5)

    assert 0.0 <= aggressive <= 1.0
    assert 0.0 <= conservative <= 1.0
    assert aggressive > conservative


def test_estimate_propensity_by_matching_returns_binary_value() -> None:
    assert estimate_propensity_by_matching("adaptive", "adaptive") == 1.0
    assert estimate_propensity_by_matching("adaptive", "conservative") == 0.0
