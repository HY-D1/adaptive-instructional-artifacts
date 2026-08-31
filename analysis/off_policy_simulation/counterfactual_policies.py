"""Counterfactual policies for off-policy simulation."""

from __future__ import annotations

import random
from dataclasses import dataclass
from typing import Any

ARM_NAMES = ["aggressive", "conservative", "explanation-first", "adaptive"]

@dataclass
class FixedSchedulePolicy:
    """Use conservative on attempts 1-2, then explanation-first per problem."""

    first_n_attempts: int = 2
    first_arm: str = "conservative"
    second_arm: str = "explanation-first"

    def choose_arm(self, state: dict[str, Any]) -> str:
        attempt_history = state.get("attempt_history") or []
        problem_id = state.get("problem_id")
        attempts_on_problem = sum(
            1
            for entry in attempt_history
            if isinstance(entry, dict)
            and entry.get("event_type") == "bandit_arm_selected"
            and (problem_id is None or entry.get("problem_id", problem_id) == problem_id)
        )
        if attempts_on_problem < self.first_n_attempts:
            return self.first_arm
        return self.second_arm


@dataclass
class RandomPolicy:
    """Select uniformly at random across the four arms."""

    seed: int | None = None

    def __post_init__(self) -> None:
        self._rng = random.Random(self.seed)

    def choose_arm(self, state: dict[str, Any] | None = None) -> str:
        return self._rng.choice(ARM_NAMES)
