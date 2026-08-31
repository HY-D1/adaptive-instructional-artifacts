"""Shared contextual Thompson Sampling model for SQL-Adapt."""
from __future__ import annotations

import math
import random
from dataclasses import dataclass
from typing import Iterable


def _solve(matrix: list[list[float]], vector: list[float]) -> list[float]:
    size = len(vector)
    augmented = [row[:] + [vector[index]] for index, row in enumerate(matrix)]
    for column in range(size):
        pivot = max(range(column, size), key=lambda row: abs(augmented[row][column]))
        if abs(augmented[pivot][column]) < 1e-12:
            raise ValueError("Posterior precision matrix is singular")
        augmented[column], augmented[pivot] = augmented[pivot], augmented[column]
        divisor = augmented[column][column]
        augmented[column] = [value / divisor for value in augmented[column]]
        for row in range(size):
            if row == column:
                continue
            factor = augmented[row][column]
            augmented[row] = [left - factor * right for left, right in zip(augmented[row], augmented[column])]
    return [augmented[index][-1] for index in range(size)]


def _inverse(matrix: list[list[float]]) -> list[list[float]]:
    size = len(matrix)
    identity = [[1.0 if row == column else 0.0 for column in range(size)] for row in range(size)]
    return [_solve(matrix, identity[column]) for column in range(size)]


def _cholesky(matrix: list[list[float]]) -> list[list[float]]:
    size = len(matrix)
    lower = [[0.0] * size for _ in range(size)]
    for row in range(size):
        for column in range(row + 1):
            value = matrix[row][column] - sum(lower[row][k] * lower[column][k] for k in range(column))
            if row == column:
                lower[row][column] = math.sqrt(max(value, 1e-12))
            else:
                lower[row][column] = value / lower[column][column]
    return lower


@dataclass
class BayesianArm:
    dimension: int
    prior_precision: float
    observation_noise: float
    posterior_scale: float

    def __post_init__(self) -> None:
        self.precision = [[self.prior_precision if row == col else 0.0 for col in range(self.dimension)] for row in range(self.dimension)]
        self.b = [0.0] * self.dimension
        self.pull_count = 0

    def update(self, features: list[float], reward: float) -> None:
        noise_precision = 1.0 / (self.observation_noise ** 2)
        for row in range(self.dimension):
            self.b[row] += noise_precision * features[row] * reward
            for col in range(self.dimension):
                self.precision[row][col] += noise_precision * features[row] * features[col]
        self.pull_count += 1

    def posterior_mean(self) -> list[float]:
        return _solve(self.precision, self.b)

    def sample_coefficients(self, rng: random.Random, sample_scale: float) -> list[float]:
        mean = self.posterior_mean()
        covariance = _inverse(self.precision)
        scale = self.posterior_scale * sample_scale
        covariance = [[value * scale * scale for value in row] for row in covariance]
        lower = _cholesky(covariance)
        normals = [rng.gauss(0.0, 1.0) for _ in mean]
        return [mean[row] + sum(lower[row][col] * normals[col] for col in range(row + 1)) for row in range(len(mean))]


class PooledContextualThompsonBandit:
    """One shared Bayesian linear reward model per arm, updated by all students."""

    def __init__(self, arm_names: Iterable[str], feature_dimension: int, model_config: dict[str, float], seed: int) -> None:
        self.arm_names = list(arm_names)
        self.feature_dimension = feature_dimension
        self.sample_scale = float(model_config["sample_scale"])
        self.rng = random.Random(seed)
        self.arms = {
            arm: BayesianArm(
                feature_dimension,
                float(model_config["prior_precision"]),
                float(model_config["observation_noise"]),
                float(model_config["posterior_scale"]),
            )
            for arm in self.arm_names
        }

    def update(self, arm: str, features: list[float], reward: float) -> None:
        if arm not in self.arms:
            raise ValueError(f"Unknown arm: {arm}")
        if len(features) != self.feature_dimension:
            raise ValueError("Feature vector has the wrong dimension")
        self.arms[arm].update(features, max(0.0, min(1.0, float(reward))))

    def select_arm(self, features: list[float]) -> str:
        if len(features) != self.feature_dimension:
            raise ValueError("Feature vector has the wrong dimension")
        scores = {
            arm: sum(coefficient * value for coefficient, value in zip(state.sample_coefficients(self.rng, self.sample_scale), features))
            for arm, state in self.arms.items()
        }
        return max(scores, key=scores.get)

    def estimated_rewards(self, features: list[float]) -> dict[str, float]:
        return {
            arm: max(0.0, min(1.0, sum(coefficient * value for coefficient, value in zip(state.posterior_mean(), features))))
            for arm, state in self.arms.items()
        }

    def best_arm(self, features: list[float]) -> str:
        return max(self.estimated_rewards(features), key=self.estimated_rewards(features).get)

    def arm_stats(self) -> dict[str, dict[str, int]]:
        return {arm: {"pulls": state.pull_count} for arm, state in self.arms.items()}
