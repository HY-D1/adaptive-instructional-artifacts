"""Propensity estimation helpers for logged bandit events."""

from __future__ import annotations

import random
from typing import Any


def _posterior_parameters(stats: dict[str, Any], arm_name: str) -> tuple[float, float]:
    arm_stats = stats.get(arm_name)
    if not isinstance(arm_stats, dict):
        raise KeyError(f"Missing arm stats for {arm_name}")

    mean = float(arm_stats.get("mean", 0.5))
    pulls = float(arm_stats.get("pulls", 0.0))

    # Thompson sampling in the app uses Beta(1, 1) priors and updates alpha/beta.
    # Reconstruct the posterior from mean + pulls using alpha + beta = pulls + 2.
    total = max(pulls + 2.0, 2.0)
    alpha = max(mean * total, 1e-6)
    beta = max((1.0 - mean) * total, 1e-6)
    return alpha, beta


def estimate_propensity(
    arm_stats_at_selection: dict[str, Any],
    selected_arm: str,
    *,
    n_simulations: int = 5000,
    random_seed: int | None = None,
) -> float:
    """Estimate P(selected_arm wins) under Thompson sampling.

    Confirmed against apps/web/src/app/lib/ml/multi-armed-bandit.ts:
    the real selector samples Beta(alpha, beta) for each arm and chooses the
    largest sample.

    Confirmed algorithm: Thompson sampling over Beta posteriors.
    """

    if not arm_stats_at_selection:
        raise ValueError("arm_stats_at_selection is required for propensity estimation")

    rng = random.Random(random_seed)
    arms = list(arm_stats_at_selection.keys())
    if selected_arm not in arms:
        raise KeyError(f"selected_arm {selected_arm!r} not present in arm stats")

    wins = 0
    for _ in range(max(1, n_simulations)):
        samples = {}
        for arm in arms:
            alpha, beta = _posterior_parameters(arm_stats_at_selection, arm)
            samples[arm] = rng.betavariate(alpha, beta)
        if max(samples, key=samples.get) == selected_arm:
            wins += 1

    return wins / max(1, n_simulations)


def estimate_propensity_by_matching(counterfactual_choice: str, observed_choice: str) -> float:
    """Fallback propensity when the selection model cannot be reconstructed."""

    return 1.0 if counterfactual_choice == observed_choice else 0.0


# TODO: Use Thompson-sampling Monte Carlo as the primary estimator unless the
# real Neon rows show missing arm_stats_at_selection, in which case fall back to
# matching for those records only.
