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

REAL_SELECTION_QUERY = """
SELECT
        id AS event_id,
        user_id,
        session_id,
        section_id,
        problem_id,
        NULL::text AS problem_difficulty,
        event_type,
        timestamp,
        selected_arm,
        arm_stats_at_selection,
        reward_total,
        reward_components,
        error_subtype_id AS error_type,
        help_request_index,
        sql_engage_subtype,
        sql_engage_row_id,
        policy_version,
        created_at
FROM interaction_events
WHERE event_type = 'bandit_arm_selected'
    AND section_id = ANY(%s)
ORDER BY timestamp, id
"""

REAL_REWARD_QUERY = """
SELECT
        id AS event_id,
        user_id,
        session_id,
        section_id,
        problem_id,
        NULL::text AS problem_difficulty,
        event_type,
        timestamp,
        selected_arm,
        arm_stats_at_selection,
        reward_total,
        reward_components,
        error_subtype_id AS error_type,
        help_request_index,
        sql_engage_subtype,
        sql_engage_row_id,
        policy_version,
        created_at
FROM interaction_events
WHERE event_type = 'bandit_reward_observed'
    AND section_id = ANY(%s)
ORDER BY timestamp, id
"""

REAL_LEARNER_SESSION_QUERY = """
SELECT
        id AS event_id,
        user_id,
        session_id,
        section_id,
        current_problem_id AS problem_id,
        NULL::text AS problem_difficulty,
        'learner_session_snapshot' AS event_type,
        COALESCE(last_activity, updated_at, created_at) AS timestamp,
        NULL::text AS selected_arm,
        bandit_state AS arm_stats_at_selection,
        NULL::numeric AS reward_total,
        NULL::text AS reward_components,
        NULL::text AS error_type,
        NULL::integer AS attempt_number,
        current_code,
        guidance_state,
        hdi_state,
        bandit_state,
        condition_id,
        escalation_policy,
        created_at,
        updated_at
FROM learner_sessions
WHERE section_id = ANY(%s)
ORDER BY COALESCE(last_activity, updated_at, created_at), id
"""

REAL_PROBLEM_PROGRESS_QUERY = """
SELECT
        CONCAT('problem-progress-', pp.id) AS event_id,
        pp.user_id,
        (
                SELECT ls.session_id
                FROM learner_sessions ls
                WHERE ls.user_id = pp.user_id
                    AND ls.section_id = ANY(%s)
                ORDER BY COALESCE(ls.last_activity, ls.updated_at, ls.created_at) DESC, ls.id DESC
                LIMIT 1
        ) AS session_id,
        (
                SELECT ls.section_id
                FROM learner_sessions ls
                WHERE ls.user_id = pp.user_id
                    AND ls.section_id = ANY(%s)
                ORDER BY COALESCE(ls.last_activity, ls.updated_at, ls.created_at) DESC, ls.id DESC
                LIMIT 1
        ) AS section_id,
        pp.problem_id,
        NULL::text AS problem_difficulty,
        'problem_progress_snapshot' AS event_type,
        COALESCE(pp.updated_at, pp.solved_at, pp.first_attempted_at, pp.created_at) AS timestamp,
        NULL::text AS selected_arm,
        NULL::text AS arm_stats_at_selection,
        NULL::numeric AS reward_total,
        NULL::text AS reward_components,
        NULL::text AS error_type,
        pp.attempts_count AS attempt_number,
        pp.solved,
        pp.hints_used,
        pp.last_code,
        pp.first_attempted_at,
        pp.solved_at,
        pp.created_at,
        pp.updated_at
FROM problem_progress pp
WHERE pp.user_id IN (
        SELECT DISTINCT ls.user_id
        FROM learner_sessions ls
        WHERE ls.section_id = ANY(%s)
)
ORDER BY COALESCE(pp.updated_at, pp.solved_at, pp.first_attempted_at, pp.created_at), pp.id
"""


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
        for column in (
            "arm_stats_at_selection",
            "reward_components",
            "bandit_state",
            "hdi_state",
            "previous_thresholds",
            "new_thresholds",
            "hdi_components",
            "textbook_units_retrieved",
            "retrieved_source_ids",
        ):
            if column in item:
                item[column] = _maybe_json_parse(item[column])
        if "timestamp" in item:
            item["timestamp"] = _normalize_timestamp(item["timestamp"])
        normalized.append(item)
    return normalized


def _ensure_read_only_connection(conn: Any) -> None:
    """Force the connection into read-only mode before any query runs."""

    if hasattr(conn, "set_session"):
        conn.set_session(readonly=True)
        return

    if hasattr(conn, "execute"):
        conn.execute("SET SESSION CHARACTERISTICS AS TRANSACTION READ ONLY")
        return

    raise TypeError("Connection does not support read-only session enforcement")


def _fetch_rows(conn: Any, query: str, params: Sequence[Any] | None = None) -> list[dict[str, Any]]:
    if hasattr(conn, "execute"):
        cursor = conn.execute(query, params or [])
    elif hasattr(conn, "cursor"):
        cursor = conn.cursor()
        cursor.execute(query, params or [])
    else:
        raise TypeError("Unsupported connection type for real event loading")

    columns = [description[0] for description in cursor.description]
    rows = [dict(zip(columns, row)) for row in cursor.fetchall()]
    return _normalize_rows(rows)


def _coerce_section_ids(section_ids: Sequence[str]) -> list[str]:
    unique_ids = [section_id for section_id in section_ids if section_id]
    if not unique_ids:
        raise ValueError("section_ids must contain at least one section id")
    return list(dict.fromkeys(unique_ids))


def diagnose_real_data(conn: Any, section_ids: Sequence[str]) -> dict[str, Any]:
    """Check which identifiers stay consistent across the live tables."""

    _ensure_read_only_connection(conn)
    scoped_section_ids = _coerce_section_ids(section_ids)

    query = """
    SELECT
        COUNT(*) AS selection_rows,
        COUNT(*) FILTER (
            WHERE EXISTS (
                SELECT 1
                FROM learner_sessions ls
                WHERE ls.user_id = ie.user_id
            )
        ) AS user_in_sessions_rows,
        COUNT(*) FILTER (
            WHERE EXISTS (
                SELECT 1
                FROM problem_progress pp
                WHERE pp.user_id = ie.user_id
            )
        ) AS user_in_progress_rows,
        COUNT(*) FILTER (WHERE ie.session_id IS NULL) AS missing_session_id_rows,
        COUNT(*) FILTER (
            WHERE ie.session_id IS NOT NULL
              AND EXISTS (
                  SELECT 1
                  FROM learner_sessions ls
                  WHERE ls.user_id = ie.user_id
                    AND ls.session_id = ie.session_id
              )
        ) AS matched_session_context_rows
    FROM interaction_events ie
    WHERE ie.event_type = 'bandit_arm_selected'
      AND ie.section_id = ANY(%s)
    """

    rows = _fetch_rows(conn, query, [scoped_section_ids])
    result = rows[0] if rows else {}

    summary = {
        "selection_rows": int(result.get("selection_rows", 0) or 0),
        "user_in_sessions_rows": int(result.get("user_in_sessions_rows", 0) or 0),
        "user_in_progress_rows": int(result.get("user_in_progress_rows", 0) or 0),
        "missing_session_id_rows": int(result.get("missing_session_id_rows", 0) or 0),
        "matched_session_context_rows": int(result.get("matched_session_context_rows", 0) or 0),
        "student_key": "user_id",
        "session_key": "session_id (partial; missing on some events)",
        "problem_key": "problem_id",
    }

    print(
        "[diagnostic] user_id present in learner_sessions: "
        f"{summary['user_in_sessions_rows']}/{summary['selection_rows']}"
    )
    print(
        "[diagnostic] user_id present in problem_progress: "
        f"{summary['user_in_progress_rows']}/{summary['selection_rows']}"
    )
    print(
        "[diagnostic] selection rows missing session_id: "
        f"{summary['missing_session_id_rows']}/{summary['selection_rows']}"
    )
    print(
        "[diagnostic] selection rows with matched session context: "
        f"{summary['matched_session_context_rows']}/{summary['selection_rows']}"
    )

    return summary


def load_real_events(
    conn: Any,
    section_ids: Sequence[str],
) -> list[dict[str, Any]]:
    """Load real Neon rows for the off-policy replay pipeline."""

    _ensure_read_only_connection(conn)
    scoped_section_ids = _coerce_section_ids(section_ids)

    selection_rows = _fetch_rows(conn, REAL_SELECTION_QUERY, [scoped_section_ids])
    print(f"[real-data] bandit_arm_selected rows: {len(selection_rows)}")

    reward_rows = _fetch_rows(conn, REAL_REWARD_QUERY, [scoped_section_ids])
    print(f"[real-data] bandit_reward_observed rows: {len(reward_rows)}")

    session_rows = _fetch_rows(conn, REAL_LEARNER_SESSION_QUERY, [scoped_section_ids])
    print(f"[real-data] learner_sessions rows: {len(session_rows)}")

    session_lookup: dict[tuple[str, str | None], str | None] = {}
    for row in session_rows:
        key = (str(row.get("user_id")), row.get("section_id"))
        if row.get("session_id"):
            session_lookup[key] = str(row.get("session_id"))

    def _backfill_session_id(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
        updated_rows: list[dict[str, Any]] = []
        for row in rows:
            item = dict(row)
            if not item.get("session_id"):
                lookup_key = (str(item.get("user_id")), item.get("section_id"))
                item["session_id"] = session_lookup.get(lookup_key)
            updated_rows.append(item)
        return updated_rows

    selection_rows = _backfill_session_id(selection_rows)
    reward_rows = _backfill_session_id(reward_rows)

    progress_rows = _fetch_rows(
        conn,
        REAL_PROBLEM_PROGRESS_QUERY,
        [scoped_section_ids, scoped_section_ids, scoped_section_ids],
    )
    print(f"[real-data] problem_progress rows: {len(progress_rows)}")

    rows = selection_rows + reward_rows + session_rows + progress_rows
    rows.sort(key=lambda row: row.get("timestamp") or datetime.min.replace(tzinfo=timezone.utc))
    return rows


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
