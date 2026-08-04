"""Replay loop for off-policy simulation against synthetic or injected data."""

from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import yaml

from .counterfactual_policies import FixedSchedulePolicy, RandomPolicy
from .data_loader import load_events, load_mock_events
from .propensity import estimate_propensity, estimate_propensity_by_matching
from .state_reconstruction import reconstruct_student_state

MODULE_DIR = Path(__file__).resolve().parent
DEFAULT_CONFIG_PATH = MODULE_DIR / "config.yaml"


def _timestamp_sort_key(row: dict[str, Any]) -> Any:
    return row.get("timestamp") or datetime.min.replace(tzinfo=timezone.utc)


def load_config(config_path: str | Path | None = None) -> dict[str, Any]:
    path = Path(config_path) if config_path is not None else DEFAULT_CONFIG_PATH
    with path.open("r", encoding="utf-8") as handle:
        return yaml.safe_load(handle) or {}


def _resolve_observed_reward(event: dict[str, Any], session_events: list[dict[str, Any]]) -> float:
    reward_total = event.get("reward_total")
    if reward_total is not None:
        return float(reward_total)

    reward_events = [
        row
        for row in session_events
        if row.get("event_type") == "bandit_reward_observed"
        and row.get("selected_arm") == event.get("selected_arm")
        and row.get("problem_id") == event.get("problem_id")
    ]
    if not reward_events:
        return 0.0
    return float(reward_events[-1].get("reward_total") or 0.0)


def _propensity_from_config(
    config: dict[str, Any],
    arm_stats_at_selection: dict[str, Any],
    selected_arm: str,
) -> float:
    propensity_cfg = config.get("propensity", {})
    method = propensity_cfg.get("method", "thompson_sampling_monte_carlo")
    if method == "matching":
        return estimate_propensity_by_matching(selected_arm, selected_arm)

    return estimate_propensity(
        arm_stats_at_selection,
        selected_arm,
        n_simulations=int(propensity_cfg.get("n_simulations", 5000)),
        random_seed=config.get("random_seed"),
    )


def simulate_off_policy(
    events: list[dict[str, Any]] | None = None,
    *,
    config: dict[str, Any] | None = None,
    data_source: Any | None = None,
) -> list[dict[str, Any]]:
    """Replay a set of bandit decisions and evaluate counterfactual policies."""

    config = config or load_config()
    if events is None:
        if data_source is None:
            events = load_mock_events(
                seed=int(config.get("random_seed", 7)),
                n_sessions=int(config.get("mock_data", {}).get("n_sessions", 3)),
                attempts_per_session=int(config.get("mock_data", {}).get("attempts_per_session", 4)),
            )
        else:
            events = load_events(data_source)

    frame = sorted(list(events), key=_timestamp_sort_key)

    section_allowlist = config.get("section_id_allowlist") or []
    if section_allowlist:
        frame = [row for row in frame if row.get("section_id") in section_allowlist]

    selection_events = [row for row in frame if row.get("event_type") == "bandit_arm_selected"]
    if not selection_events:
        return []

    fixed_cfg = config.get("fixed_schedule", {})
    fixed_policy = FixedSchedulePolicy(
        first_n_attempts=int(fixed_cfg.get("first_n_attempts", 3)),
        first_arm=str(fixed_cfg.get("first_arm", "conservative")),
        second_arm=str(fixed_cfg.get("second_arm", "explanation-first")),
    )
    random_policy = RandomPolicy(seed=int(config.get("random_seed", 7)))

    rows: list[dict[str, Any]] = []
    for event in selection_events:
        session_events = [row for row in frame if row.get("session_id") == event.get("session_id")]
        state = reconstruct_student_state(event, session_events)
        observed_reward = _resolve_observed_reward(event, session_events)
        observed_arm = str(event.get("selected_arm"))
        difficulty = event.get("problem_difficulty") or "unknown"

        arm_stats = event.get("arm_stats_at_selection") or {}
        behavior_propensity = _propensity_from_config(config, arm_stats, observed_arm)
        if behavior_propensity <= 0:
            behavior_propensity = 1.0

        policy_choices = {
            "adaptive": observed_arm,
            "simulated_fixed": fixed_policy.choose_arm(state),
            "simulated_random": random_policy.choose_arm(state),
        }

        for policy_name, policy_choice in policy_choices.items():
            matches = policy_choice == observed_arm
            ipw_weight = (1.0 / behavior_propensity) if matches else 0.0
            rows.append(
                {
                    "policy": policy_name,
                    "difficulty": difficulty,
                    "event_id": event.get("event_id"),
                    "session_id": event.get("session_id"),
                    "selected_arm": observed_arm,
                    "policy_choice": policy_choice,
                    "reward_total": observed_reward,
                    "behavior_propensity": behavior_propensity,
                    "matches_observed": matches,
                    "ipw_weight": ipw_weight,
                    "weighted_reward": observed_reward * ipw_weight,
                }
            )

    if not rows:
        return []

    aggregates: dict[tuple[str, str], dict[str, Any]] = {}
    for row in rows:
        key = (row["policy"], row["difficulty"])
        bucket = aggregates.setdefault(
            key,
            {
                "policy": row["policy"],
                "difficulty": row["difficulty"],
                "n_events": 0,
                "matches_observed": 0,
                "reward_total_sum": 0.0,
                "weighted_reward_sum": 0.0,
                "behavior_propensity_sum": 0.0,
            },
        )
        bucket["n_events"] += 1
        bucket["matches_observed"] += 1 if row["matches_observed"] else 0
        bucket["reward_total_sum"] += float(row["reward_total"])
        bucket["weighted_reward_sum"] += float(row["weighted_reward"])
        bucket["behavior_propensity_sum"] += float(row["behavior_propensity"])

    summary: list[dict[str, Any]] = []
    for bucket in aggregates.values():
        n_events = max(1, bucket["n_events"])
        mean_reward = bucket["reward_total_sum"] / n_events
        ipw_estimate = bucket["weighted_reward_sum"] / n_events
        if bucket["policy"] == "adaptive":
            ipw_estimate = mean_reward
        summary.append(
            {
                "policy": bucket["policy"],
                "difficulty": bucket["difficulty"],
                "n_events": bucket["n_events"],
                "matches_observed": bucket["matches_observed"],
                "mean_reward": mean_reward,
                "ipw_estimate": ipw_estimate,
                "average_behavior_propensity": bucket["behavior_propensity_sum"] / n_events,
            }
        )

    return sorted(summary, key=lambda row: (row["policy"], row["difficulty"]))


if __name__ == "__main__":
    for row in simulate_off_policy():
        print(row)
