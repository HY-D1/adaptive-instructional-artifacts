from __future__ import annotations

from analysis.off_policy_simulation.counterfactual_policies import FixedSchedulePolicy, RandomPolicy


def test_fixed_schedule_switches_after_threshold() -> None:
    policy = FixedSchedulePolicy()

    state = {"problem_id": "problem-a", "attempt_history": [{"event_type": "bandit_arm_selected"}]}
    assert policy.choose_arm(state) == "conservative"

    state = {"problem_id": "problem-a", "attempt_history": [
        {"event_type": "bandit_arm_selected"},
        {"event_type": "bandit_arm_selected"},
    ]}
    assert policy.choose_arm(state) == "explanation-first"


def test_fixed_schedule_counts_attempts_per_problem() -> None:
    policy = FixedSchedulePolicy()
    state = {
        "problem_id": "problem-b",
        "attempt_history": [
            {"problem_id": "problem-a", "event_type": "bandit_arm_selected"},
            {"problem_id": "problem-b", "event_type": "bandit_arm_selected"},
        ],
    }

    assert policy.choose_arm(state) == "conservative"


def test_random_policy_stays_within_arm_set() -> None:
    policy = RandomPolicy(seed=7)
    choices = {policy.choose_arm({}) for _ in range(20)}

    assert choices.issubset({"aggressive", "conservative", "explanation-first", "adaptive"})
