"""Data loading helpers for off-policy simulation."""

from __future__ import annotations

import copy
import json
import random
from collections.abc import Iterable, Sequence
from datetime import datetime, timedelta, timezone
from typing import Any

ARM_NAMES = ["aggressive", "conservative", "explanation-first", "adaptive"]
DEFAULT_EVENT_COLUMNS = [
    "event_id",
    "user_id",
    "session_id",
    "section_id",
    "problem_id",
    "problem_difficulty",
    "event_type",
    "timestamp",
    "selected_arm",
    "arm_stats_at_selection",
    "reward_total",
    "reward_components",
    "error_type",
    "attempt_number",
]

DEFAULT_EVENT_QUERY = "SELECT * FROM interaction_events"


def _maybe_json_parse(value: Any) -> Any:
    if isinstance(value, str):
        value = value.strip()
        if value.startswith("{") or value.startswith("["):
            try:
                return json.loads(value)
            except json.JSONDecodeError:
                return value
    return value


def _is_dataframe_like(source: Any) -> bool:
    return hasattr(source, "to_dict") and source.__class__.__name__ == "DataFrame"


def _normalize_timestamp(value: Any) -> Any:
    if isinstance(value, datetime):
        return value.astimezone(timezone.utc)
    if isinstance(value, str):
        try:
            parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
        except ValueError:
            return value
        if parsed.tzinfo is None:
            parsed = parsed.replace(tzinfo=timezone.utc)
        return parsed.astimezone(timezone.utc)
    return value


def _normalize_rows(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    normalized: list[dict[str, Any]] = []
    for row in rows:
        item = copy.deepcopy(row)
        for column in ("arm_stats_at_selection", "reward_components"):
            if column in item:
                item[column] = _maybe_json_parse(item[column])
        if "timestamp" in item:
            item["timestamp"] = _normalize_timestamp(item["timestamp"])
        normalized.append(item)
    return normalized


def load_events(
    source: Any,
    query: str | None = None,
    params: Iterable[Any] | None = None,
) -> list[dict[str, Any]]:
    """Load event rows from either a DataFrame or a DB connection.

    The DB path intentionally uses pandas.read_sql_query so this function can be
    pointed at SQLite, Postgres, or Neon later without changing the call sites.
    """

    if _is_dataframe_like(source):
        rows = source.to_dict(orient="records")
        return _normalize_rows(rows)

    if isinstance(source, Sequence) and all(isinstance(item, dict) for item in source):
        return _normalize_rows(list(source))

    if hasattr(source, "cursor") or hasattr(source, "execute"):
        if hasattr(source, "execute"):
            cursor = source.execute(query or DEFAULT_EVENT_QUERY, params or [])
        else:
            cursor = source.cursor()
            cursor.execute(query or DEFAULT_EVENT_QUERY, params or [])
        columns = [description[0] for description in cursor.description]
        rows = [dict(zip(columns, row)) for row in cursor.fetchall()]
        return _normalize_rows(rows)

    raise TypeError("Unsupported data source type for load_events")


def load_mock_events(
    seed: int = 7,
    n_sessions: int = 3,
    attempts_per_session: int = 4,
    section_ids: list[str] | None = None,
) -> list[dict[str, Any]]:
    """Generate a deterministic synthetic event set for local testing."""

    rng = random.Random(seed)
    section_ids = section_ids or ["section-a", "section-b"]
    base_time = datetime(2026, 1, 1, tzinfo=timezone.utc)
    rows: list[dict[str, Any]] = []

    for session_index in range(n_sessions):
        user_id = f"student-{session_index + 1}"
        session_id = f"session-{session_index + 1}"
        section_id = section_ids[session_index % len(section_ids)]

        for attempt_number in range(1, attempts_per_session + 1):
            problem_id = f"problem-{attempt_number}"
            difficulty = ["easy", "medium", "hard"][attempt_number % 3]
            timestamp = base_time + timedelta(minutes=session_index * 10 + attempt_number)

            arm_stats = {
                arm: {
                    "mean": max(0.01, min(0.99, 0.25 + 0.15 * idx + 0.05 * session_index)),
                    "pulls": int(1 + attempt_number + idx),
                }
                for idx, arm in enumerate(ARM_NAMES)
            }
            selected_arm = ARM_NAMES[(attempt_number + session_index) % len(ARM_NAMES)]
            reward_total = max(0.0, min(1.0, 0.35 + 0.1 * rng.random() + 0.05 * attempt_number))
            reward_components = {
                "independentSuccess": float(1.0 if attempt_number % 2 == 0 else 0.5),
                "errorReduction": float(0.2 * attempt_number),
                "delayedRetention": float(0.1 * session_index),
                "dependencyPenalty": float(-0.05 * (attempt_number - 1)),
                "timeEfficiency": float(0.25 + 0.05 * session_index),
            }
            error_type = "syntax_error" if attempt_number % 2 == 1 else "logic_error"

            rows.append(
                {
                    "event_id": f"evt-{session_index + 1}-{attempt_number}-selected",
                    "user_id": user_id,
                    "session_id": session_id,
                    "section_id": section_id,
                    "problem_id": problem_id,
                    "problem_difficulty": difficulty,
                    "event_type": "bandit_arm_selected",
                    "timestamp": timestamp,
                    "selected_arm": selected_arm,
                    "arm_stats_at_selection": arm_stats,
                    "reward_total": reward_total,
                    "reward_components": reward_components,
                    "error_type": error_type,
                    "attempt_number": attempt_number,
                }
            )

            rows.append(
                {
                    "event_id": f"evt-{session_index + 1}-{attempt_number}-reward",
                    "user_id": user_id,
                    "session_id": session_id,
                    "section_id": section_id,
                    "problem_id": problem_id,
                    "problem_difficulty": difficulty,
                    "event_type": "bandit_reward_observed",
                    "timestamp": timestamp + timedelta(seconds=30),
                    "selected_arm": selected_arm,
                    "arm_stats_at_selection": arm_stats,
                    "reward_total": reward_total,
                    "reward_components": reward_components,
                    "error_type": error_type,
                    "attempt_number": attempt_number,
                }
            )

    if section_ids:
        rows = [row for row in rows if row["section_id"] in section_ids]
    return _normalize_rows(rows)
