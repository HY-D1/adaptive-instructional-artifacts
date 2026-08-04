from __future__ import annotations

from analysis.off_policy_simulation.counterfactual_policies import FixedSchedulePolicy, RandomPolicy


def test_fixed_schedule_switches_after_threshold() -> None:
    policy = FixedSchedulePolicy(first_n_attempts=2)

    state = {"attempt_history": [1]}
    assert policy.choose_arm(state) == "conservative"

    state = {"attempt_history": [1, 2]}
    assert policy.choose_arm(state) == "explanation-first"


def test_random_policy_stays_within_arm_set() -> None:
    policy = RandomPolicy(seed=7)
    choices = {policy.choose_arm({}) for _ in range(20)}

    assert choices.issubset({"aggressive", "conservative", "explanation-first", "adaptive"})
