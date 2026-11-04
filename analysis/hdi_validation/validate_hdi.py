"""Validate the HDI on filtered Neon events.

The component formulas here mirror the live app implementation in
apps/web/src/app/lib/ml/hdi-calculator.ts, which is canonical (decision
2026-11-04). tests/fixtures/hdi-parity.json pins both implementations to the
same expected values (see analysis/hdi_validation/tests/test_hdi_parity.py and
tests/unit/web/hdi-parity.test.ts).
"""
from __future__ import annotations

import math
import os
import statistics
from collections import defaultdict
from pathlib import Path
from typing import Any

MODULE_DIR = Path(__file__).resolve().parent


def pearson(xs: list[float], ys: list[float]) -> float | None:
    if len(xs) < 2 or len(xs) != len(ys):
        return None
    x_mean, y_mean = statistics.mean(xs), statistics.mean(ys)
    numerator = sum((x - x_mean) * (y - y_mean) for x, y in zip(xs, ys))
    denominator = math.sqrt(sum((x - x_mean) ** 2 for x in xs) * sum((y - y_mean) ** 2 for y in ys))
    return numerator / denominator if denominator else None


# Event types, matching hdi-calculator.ts exactly.
HINT_REQUEST_TYPES = {"hint_request", "guidance_request"}
AED_TYPES = {"hint_request", "guidance_request", "guidance_view", "hint_view"}
IWH_HINT_TYPES = {"hint_request", "guidance_request", "hint_view"}
HIGH_HDI_THRESHOLD_IS_STRICT = True  # app: hdi > 0.6 is "high"


def components(events: list[dict[str, Any]]) -> dict[str, float]:
    """HPA, AED, ER, REAE, IWH as computed by the app's hdi-calculator.ts."""
    if not events:
        return {"hpa": 0.0, "aed": 0.0, "er": 0.0, "reae": 0.0, "iwh": 0.0}
    sorted_events = sorted(events, key=lambda row: row["timestamp"])
    executions = [row for row in sorted_events if row["event_type"] == "execution"]

    # HPA: help requests per execution, capped at 1.
    hint_requests = sum(1 for row in sorted_events if row["event_type"] in HINT_REQUEST_TYPES)
    hpa = min(hint_requests / len(executions), 1.0) if executions else 0.0

    # AED: mean hint level over hint events that carry a level, (L - 1) / 2 in [0, 1].
    levels = [float(row["hint_level"] or 1) for row in sorted_events
              if row["event_type"] in AED_TYPES and row.get("hint_level") is not None]
    aed = min(max((statistics.mean(levels) - 1.0) / 2.0, 0.0), 1.0) if levels else 0.0

    # ER: explanation views per execution, capped at 1.
    explanations = sum(1 for row in sorted_events if row["event_type"] == "explanation_view")
    er = min(explanations / len(executions), 1.0) if executions else 0.0

    # REAE: share of errors that came after the first explanation view.
    explanation_seen = False
    errors = 0
    errors_after_explanation = 0
    for row in sorted_events:
        if row["event_type"] == "explanation_view":
            explanation_seen = True
        elif row["event_type"] == "error":
            errors += 1
            if explanation_seen:
                errors_after_explanation += 1
    reae = errors_after_explanation / errors if errors else 0.0

    # IWH: solved problems with no hint before a successful execution.
    hinted: set[Any] = set()
    solved: set[Any] = set()
    hinted_before_success: set[Any] = set()
    for row in sorted_events:
        if row["event_type"] in IWH_HINT_TYPES:
            hinted.add(row["problem_id"])
        if row["event_type"] == "execution" and row.get("successful"):
            solved.add(row["problem_id"])
            if row["problem_id"] in hinted:
                hinted_before_success.add(row["problem_id"])
    iwh = (len(solved) - len(hinted_before_success)) / len(solved) if solved else 0.0

    return {"hpa": hpa, "aed": aed, "er": er, "reae": reae, "iwh": iwh}


def is_high(hdi: float, threshold: float) -> bool:
    return hdi > threshold if HIGH_HDI_THRESHOLD_IS_STRICT else hdi >= threshold


def score(parts: dict[str, float], weights: dict[str, float]) -> float:
    raw = sum(parts[name] * weights[name] for name in ("hpa", "aed", "er", "reae")) + weights["iwh"] * (1.0 - parts["iwh"])
    return min(max(raw, 0.0), 1.0)  # app clamps to [0, 1]


def load_config() -> dict[str, Any]:
    import yaml

    with (MODULE_DIR / "config.yaml").open(encoding="utf-8") as handle:
        return yaml.safe_load(handle)


def main() -> None:
    import psycopg

    from analysis.off_policy_simulation.estimate_bandit_convergence import _resolve_database_url

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
        parts = components(user_events)
        attempts = [row for row in user_events if row["event_type"] == "execution"]
        final_correctness = float(attempts[-1].get("successful") is True) if attempts else None
        time_values = [float(row["time_spent"]) for row in attempts if row.get("time_spent") is not None]
        users.append({"user_id": user_id, "components": parts, "hdi": score(parts, base_weights), "final_correctness": final_correctness, "time_on_task": sum(time_values) if time_values else None})

    def corr(field: str) -> tuple[float | None, int]:
        paired = [(row["hdi"], row[field]) for row in users if row[field] is not None]
        return pearson([x for x, _ in paired], [y for _, y in paired]), len(paired)

    flagged = {row["user_id"] for row in users if is_high(row["hdi"], config["high_hdi_threshold"])}
    sensitivity: list[dict[str, Any]] = []
    for variation in config["sensitivity"]:
        variation_flagged = {row["user_id"] for row in users if is_high(score(row["components"], variation), config["high_hdi_threshold"])}
        sensitivity.append({"name": variation["name"], "flagged": len(variation_flagged), "overlap_with_base": len(flagged & variation_flagged), "jaccard": len(flagged & variation_flagged) / len(flagged | variation_flagged) if flagged | variation_flagged else 1.0})

    correctness_corr, correctness_n = corr("final_correctness")
    time_corr, time_n = corr("time_on_task")
    hdi_values = [row["hdi"] for row in users]
    report = [
        "# HDI Validation Results", "", "## Formula and availability", "",
        "Standing data rule applied: only the two real section IDs were used.", "",
        "Component formulas mirror the live app (`apps/web/src/app/lib/ml/hdi-calculator.ts`): HPA = help requests per execution (cap 1), AED = (mean hint level - 1)/2, ER = explanations per execution (cap 1), REAE = share of errors after the first explanation, IWH = solved problems with no hint before success.", "",
        "Professor-confirmed formula: `HDI = 0.3*HPA + 0.133*AED + 0.3*ER + 0.133*REAE + 0.134*(1-IWH)`.", "",
        "`dependencyPenalty = -HDI`, clipped to `[-1, 0]`, is one signal by design and is used directly in the reward; it is not an independent sixth component.", "",
        f"Rows: {len(events)} events, {len(users)} students. Database source: `{source}`. Transaction was read-only.", "",
        "## Student results", "", "| Metric | Value |", "|---|---:|", f"| Students | {len(users)} |", f"| High-HDI students (> {config['high_hdi_threshold']}) | {len(flagged)} |", "", f"HDI score distribution: min `{min(hdi_values):.3f}`, median `{statistics.median(hdi_values):.3f}`, max `{max(hdi_values):.3f}`.", "",
        "| Signal | Pearson r | Paired students |", "|---|---:|---:|", f"| Final correctness | {correctness_corr if correctness_corr is not None else 'n/a'} | {correctness_n} |", f"| Time-on-task | {time_corr if time_corr is not None else 'n/a'} | {time_n} |", "| Survey-reported difficulty | n/a | 0 |", "",
        "## Sensitivity", "", "| Weight variation | Flagged | Overlap with base | Jaccard |", "|---|---:|---:|---:|",
    ]
    for result in sensitivity:
        report.append(f"| {result['name']} | {result['flagged']} | {result['overlap_with_base']} | {result['jaccard']:.3f} |")
    variation_summary = "; ".join(f"{result['name']}: {result['flagged']}" for result in sensitivity)
    report += ["", "## Notes", "",
               f"High-HDI students under the base weights: {len(flagged)}. Under the sensitivity variations: {variation_summary or 'none configured'}. Compare these counts before treating the flagged set as definitive.",
               "Correlations are descriptive, not causal, and are not a validation of construct validity.", "",
               "Known limitation shared with the app: HPA and ER divide by `execution` events only, so a learner whose submissions all raise SQL errors scores 0 on both.", "",
               "## Open question", "", "The error-taxonomy choice remains unresolved: retain SQL-Adapt's existing taxonomy or align with the alternative six-category scheme.", ""]
    (MODULE_DIR / "RESULTS.md").write_text("\n".join(report), encoding="utf-8")
    print("[report] wrote", MODULE_DIR / "RESULTS.md")
    print("[summary]", {"events": len(events), "students": len(users), "high_hdi": len(flagged), "correctness_r": correctness_corr, "time_r": time_corr, "sensitivity": sensitivity})


if __name__ == "__main__":
    main()
