from __future__ import annotations

from analysis.off_policy_simulation.data_loader import load_mock_events
from analysis.off_policy_simulation.state_reconstruction import reconstruct_student_state


def test_reconstruct_student_state_returns_history_and_error_type() -> None:
    frame = load_mock_events(seed=21, n_sessions=1, attempts_per_session=3)
    selection_events = [row for row in frame if row["event_type"] == "bandit_arm_selected"]
    selection_event = selection_events[1]
    session_events = [row for row in frame if row["session_id"] == selection_event["session_id"]]

    state = reconstruct_student_state(selection_event, session_events)

    assert state["session_id"] == selection_event["session_id"]
    assert state["problem_id"] == selection_event["problem_id"]
    assert len(state["attempt_history"]) >= 1
    assert state["prior_interactions"]
    assert state["error_type"] in {"syntax_error", "logic_error"}
