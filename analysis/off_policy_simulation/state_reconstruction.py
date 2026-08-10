"""State reconstruction helpers for replaying learner decisions."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any


def _row_to_dict(row: Any) -> dict[str, Any]:
    if hasattr(row, "to_dict"):
        try:
            return row.to_dict()
        except TypeError:
            return row.to_dict()
    return dict(row)


def _normalize_timestamp(value: Any) -> Any:
    if value is None:
        return datetime.min.replace(tzinfo=timezone.utc)
    return value


def reconstruct_student_state(event: Any, session_events: list[dict[str, Any]]) -> dict[str, Any]:
    """Reconstruct the minimal student state available at a selection event."""

    event_row = _row_to_dict(event)
    event_timestamp = event_row.get("timestamp")
    session_rows = sorted(
        session_events,
        key=lambda row: row.get("timestamp") or datetime.min.replace(tzinfo=timezone.utc),
    )

    if event_timestamp is not None:
        prior_events = [row for row in session_rows if row.get("timestamp") is None or row.get("timestamp") <= event_timestamp]
    else:
        prior_events = list(session_rows)

    # TODO: confirm which production columns define a "same problem" join once Neon data is wired in.
    problem_id = event_row.get("problem_id")
    if problem_id is not None:
        problem_history = [row for row in prior_events if row.get("problem_id") == problem_id]
    else:
        problem_history = list(prior_events)

    # TODO: confirm the canonical error subtype field from the real interaction schema.
    error_type = event_row.get("error_type")
    if error_type is None:
        past_error_rows = [row for row in problem_history if row.get("error_type") is not None]
        if past_error_rows:
            error_type = past_error_rows[-1]["error_type"]

    attempt_history: list[dict[str, Any]] = []
    for row in problem_history:
        attempt_history.append(
            {
                "event_id": row.get("event_id"),
                "event_type": row.get("event_type"),
                "selected_arm": row.get("selected_arm"),
                "timestamp": _normalize_timestamp(row.get("timestamp")),
                "attempt_number": row.get("attempt_number"),
                "reward_total": row.get("reward_total"),
            }
        )

    prior_interactions = []
    for row in prior_events:
        prior_interactions.append(
            {
                "event_id": row.get("event_id"),
                "event_type": row.get("event_type"),
                "problem_id": row.get("problem_id"),
                "selected_arm": row.get("selected_arm"),
                "timestamp": _normalize_timestamp(row.get("timestamp")),
            }
        )

    return {
        "event_id": event_row.get("event_id"),
        "session_id": event_row.get("session_id"),
        "section_id": event_row.get("section_id"),
        "problem_id": problem_id,
        "problem_difficulty": event_row.get("problem_difficulty"),
        "attempt_history": attempt_history,
        "error_type": error_type,
        "prior_interactions": prior_interactions,
    }


def reconstruct_student_state_sample(
    events: list[dict[str, Any]],
    sample_size: int = 20,
) -> list[dict[str, Any]]:
    """Return reconstructed state previews for a small real-data sample."""

    selection_events = [row for row in events if row.get("event_type") == "bandit_arm_selected"]
    sample_events = selection_events[: max(0, sample_size)]
    previews: list[dict[str, Any]] = []

    for event in sample_events:
        session_key = event.get("session_id") or event.get("user_id")
        session_events = [
            row
            for row in events
            if (row.get("session_id") or row.get("user_id")) == session_key
        ]
        previews.append(reconstruct_student_state(event, session_events))

    return previews
