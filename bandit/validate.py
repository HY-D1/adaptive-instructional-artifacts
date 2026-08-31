"""Run the pooled contextual bandit validation replay."""
from __future__ import annotations

import json
from pathlib import Path

import yaml

from .replay import load_and_replay

MODULE_DIR = Path(__file__).resolve().parent


def main() -> None:
    with (MODULE_DIR / "config.yaml").open(encoding="utf-8") as handle:
        config = yaml.safe_load(handle)
    result = load_and_replay(config)
    trajectory = result["trajectory"]
    first_best = trajectory[0]["best_arm"] if trajectory else None
    last_best = trajectory[-1]["best_arm"] if trajectory else None
    changes = sum(1 for previous, current in zip(trajectory, trajectory[1:]) if previous["best_arm"] != current["best_arm"])
    result["diagnostics"].update({"initial_best_arm": first_best, "final_best_arm": last_best, "best_arm_changes": changes})
    output = MODULE_DIR / "validation.json"
    public_result = {
        "event_count": result["event_count"],
        "diagnostics": result["diagnostics"],
        "final_stats": result["final_stats"],
    }
    output.write_text(json.dumps(public_result, indent=2, default=str), encoding="utf-8")
    print(json.dumps({"event_count": result["event_count"], "diagnostics": result["diagnostics"], "final_stats": result["final_stats"]}, indent=2))
    print(f"[report] wrote {output}")


if __name__ == "__main__":
    main()
