from __future__ import annotations

from analysis.off_policy_simulation.data_loader import load_mock_events
from analysis.off_policy_simulation.simulate import load_config, simulate_off_policy


def test_load_config_reads_yaml() -> None:
    config = load_config()

    assert config["fixed_schedule"]["first_n_attempts"] == 2
    assert config["propensity"]["method"] == "thompson_sampling_monte_carlo"


def test_simulate_off_policy_returns_summary_table() -> None:
    events = load_mock_events(seed=9, n_sessions=2, attempts_per_session=3)
    config = load_config()
    config["section_id_allowlist"] = ["section-a", "section-b"]
    summary = simulate_off_policy(events, config=config)

    assert summary
    assert {"adaptive", "simulated_fixed", "simulated_random"}.issubset({row["policy"] for row in summary})
    assert all("difficulty" in row for row in summary)
    assert all(row["ipw_estimate"] >= 0 for row in summary)
    assert all(row["ipw_ci95_low"] <= row["ipw_ci95_high"] for row in summary)
    assert all(row["ipw_ess"] >= 0 for row in summary)
