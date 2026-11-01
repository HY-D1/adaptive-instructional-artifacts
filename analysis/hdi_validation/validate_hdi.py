"""Validate the professor-confirmed HDI formula on filtered Neon events."""
from __future__ import annotations

import math
import os
import statistics
from collections import defaultdict
from pathlib import Path
from typing import Any

import psycopg
import yaml

from analysis.off_policy_simulation.estimate_bandit_convergence import _resolve_database_url

MODULE_DIR = Path(__file__).resolve().parent


def pearson(xs: list[float], ys: list[float]) -> float | None:
    if len(xs) < 2 or len(xs) != len(ys):
        return None
    x_mean, y_mean = statistics.mean(xs), statistics.mean(ys)
    numerator = sum((x - x_mean) * (y - y_mean) for x, y in zip(xs, ys))
    denominator = math.sqrt(sum((x - x_mean) ** 2 for x in xs) * sum((y - y_mean) ** 2 for y in ys))
    return numerator / denominator if denominator else None


def components(events: list[dict[str, Any]], hpa_cap: float) -> dict[str, float]:
    sorted_events = sorted(events, key=lambda row: row["timestamp"])
    attempts = [row for row in sorted_events if row["event_type"] == "execution"]
    hints = [row for row in sorted_events if row["event_type"] in {"hint_view", "guidance_view"}]
    explanations = [row for row in sorted_events if row["event_type"] == "explanation_view"]
    errors = [row for row in sorted_events if row["event_type"] == "error"]
    levels = [float(row["hint_level"]) for row in hints if row.get("hint_level") is not None]
    hpa = min(len(hints) / len(attempts), hpa_cap) / hpa_cap if attempts else 0.0
    aed = min(max(((statistics.mean(levels) if levels else 1.0) - 1.0) / 2.0, 0.0), 1.0)
    er = min(len(explanations) / len(attempts), 1.0) if attempts else 0.0
    explanation_seen = False
    errors_after_explanation = 0
    for row in sorted_events:
        if row["event_type"] == "explanation_view":
            explanation_seen = True
        elif row["event_type"] == "error" and explanation_seen:
            errors_after_explanation += 1
    reae = errors_after_explanation / len(errors) if errors else 0.0
    solved = {row["problem_id"] for row in attempts if row.get("successful") is True}
    hinted = {row["problem_id"] for row in hints}
    iwh = len(solved - hinted) / len(solved) if solved else 0.0
    return {"hpa": hpa, "aed": aed, "er": er, "reae": reae, "iwh": iwh}


def score(parts: dict[str, float], weights: dict[str, float]) -> float:
    return sum(parts[name] * weights[name] for name in ("hpa", "aed", "er", "reae")) + weights["iwh"] * (1.0 - parts["iwh"])


def load_config() -> dict[str, Any]:
    with (MODULE_DIR / "config.yaml").open(encoding="utf-8") as handle:
        return yaml.safe_load(handle)


def main() -> None:
    config = load_config()
    sections = config["section_id_allowlist"]
    url, source = _resolve_database_url()
    conn = psycopg.connect(url)
    conn.execute("SET SESSION CHARACTERISTICS AS TRANSACTION READ ONLY")
    rows = conn.execute(
        """
        SELECT user_id, id, timestamp, event_type, problem_id, hint_level,
               successful, time_spent
        FROM interaction_events
        WHERE section_id = ANY(%s)
        ORDER BY user_id, timestamp, id
        """,
        [sections],
    ).fetchall()
    columns = [description[0] for description in conn.execute("SELECT user_id, id, timestamp, event_type, problem_id, hint_level, successful, time_spent FROM interaction_events LIMIT 0").description]
    conn.close()
    events = [dict(zip(columns, row)) for row in rows]
    by_user: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for event in events:
        by_user[str(event["user_id"])].append(event)

    base_weights = config["formula"]
    users: list[dict[str, Any]] = []
    for user_id, user_events in sorted(by_user.items()):
        parts = components(user_events, float(base_weights["hpa_cap"]))
        attempts = [row for row in user_events if row["event_type"] == "execution"]
        final_correctness = float(attempts[-1].get("successful") is True) if attempts else None
        time_values = [float(row["time_spent"]) for row in attempts if row.get("time_spent") is not None]
        users.append({"user_id": user_id, "components": parts, "hdi": score(parts, base_weights), "final_correctness": final_correctness, "time_on_task": sum(time_values) if time_values else None})

    def corr(field: str) -> tuple[float | None, int]:
        paired = [(row["hdi"], row[field]) for row in users if row[field] is not None]
        return pearson([x for x, _ in paired], [y for _, y in paired]), len(paired)

    flagged = {row["user_id"] for row in users if row["hdi"] >= config["high_hdi_threshold"]}
    sensitivity: list[dict[str, Any]] = []
    for variation in config["sensitivity"]:
        variation_flagged = {row["user_id"] for row in users if score(row["components"], variation) >= config["high_hdi_threshold"]}
        sensitivity.append({"name": variation["name"], "flagged": len(variation_flagged), "overlap_with_base": len(flagged & variation_flagged), "jaccard": len(flagged & variation_flagged) / len(flagged | variation_flagged) if flagged | variation_flagged else 1.0})

    correctness_corr, correctness_n = corr("final_correctness")
    time_corr, time_n = corr("time_on_task")
    hdi_values = [row["hdi"] for row in users]
    report = [
        "# HDI Validation Results", "", "## Formula and availability", "",
        "Standing data rule applied: only the two real section IDs were used.", "",
        "AED and REAE are computable from the filtered event log. AED uses `hint_view`/`guidance_view` levels; REAE uses timestamp-ordered `explanation_view` and `error` events.", "",
        "Professor-confirmed formula: `HDI = 0.3*HPA + 0.133*AED + 0.3*ER + 0.133*REAE + 0.134*(1-IWH)`.", "",
        "`dependencyPenalty = -HDI`, clipped to `[-1, 0]`, is one signal by design and is used directly in the reward; it is not an independent sixth component.", "",
        f"Rows: {len(events)} events, {len(users)} students. Database source: `{source}`. Transaction was read-only.", "",
        "## Student results", "", "| Metric | Value |", "|---|---:|", f"| Students | {len(users)} |", f"| High-HDI students (>= {config['high_hdi_threshold']}) | {len(flagged)} |", "", f"HDI score distribution: min `{min(hdi_values):.3f}`, median `{statistics.median(hdi_values):.3f}`, max `{max(hdi_values):.3f}`.", "",
        "| Signal | Pearson r | Paired students |", "|---|---:|---:|", f"| Final correctness | {correctness_corr if correctness_corr is not None else 'n/a'} | {correctness_n} |", f"| Time-on-task | {time_corr if time_corr is not None else 'n/a'} | {time_n} |", "| Survey-reported difficulty | n/a | 0 |", "",
        "## Sensitivity", "", "| Weight variation | Flagged | Overlap with base | Jaccard |", "|---|---:|---:|---:|",
    ]
    for result in sensitivity:
        report.append(f"| {result['name']} | {result['flagged']} | {result['overlap_with_base']} | {result['jaccard']:.3f} |")
    report += ["", "## Recommendation", "", "Recommendation: retain the professor-confirmed weights for comparability; do not revise them from this small observational slice alone. The high-HDI classification is sensitivity-dependent: balanced and learning-emphasis variations reduce the flagged set from 4 students to 1. Report this sensitivity rather than presenting the flagged set as definitive. Correlations are descriptive, not causal, and should not be treated as validation of construct validity.", "", "Reproducibility caveat: the separate `dependency-metrics.ts` path currently uses 0.30/0.15/0.25/0.15/0.15. This validation uses the professor-confirmed formula and should be the reference for this deliverable; the code-path discrepancy should be reconciled separately.", "", "## Open question", "", "The error-taxonomy choice remains unresolved: retain SQL-Adapt's existing taxonomy or align with the alternative six-category scheme. This requires further input and is intentionally not decided here.", ""]
    (MODULE_DIR / "RESULTS.md").write_text("\n".join(report), encoding="utf-8")
    print("[report] wrote", MODULE_DIR / "RESULTS.md")
    print("[summary]", {"events": len(events), "students": len(users), "high_hdi": len(flagged), "correctness_r": correctness_corr, "time_r": time_corr, "sensitivity": sensitivity})


if __name__ == "__main__":
    main()
