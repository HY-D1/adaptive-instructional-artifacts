from __future__ import annotations

from analysis.off_policy_simulation.data_loader import load_events, load_mock_events


def test_load_mock_events_has_expected_columns() -> None:
    frame = load_mock_events(seed=11, n_sessions=2, attempts_per_session=2)

    assert not frame.empty
    required = {
        "event_id",
        "user_id",
        "session_id",
        "section_id",
        "event_type",
        "timestamp",
        "selected_arm",
        "arm_stats_at_selection",
        "reward_total",
        "reward_components",
    }
    assert required.issubset(set(frame.columns))
    assert {row["event_type"] for row in frame} <= {"bandit_arm_selected", "bandit_reward_observed"}


def test_load_events_accepts_dataframe_input() -> None:
    frame = load_mock_events(seed=13, n_sessions=1, attempts_per_session=1)
    loaded = load_events(frame)

    assert len(loaded) == len(frame)
    assert loaded[0]["arm_stats_at_selection"] == frame[0]["arm_stats_at_selection"]
    assert loaded[0]["timestamp"].tzinfo is not None
