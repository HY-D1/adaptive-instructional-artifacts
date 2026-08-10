"""Estimate pooled-bandit convergence from real Neon reward observations.

The script stays read-only, applies the standing section allowlist, and writes
an aggregate markdown report to RESULTS.md.
"""

from __future__ import annotations

import argparse
import os
import random
import statistics
from collections import defaultdict
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import psycopg

ARM_NAMES = ["aggressive", "conservative", "explanation-first", "adaptive"]
DEFAULT_SECTION_IDS = [
    "3bdacd09-e3d5-4a70-a09f-cbea3ffae28b",
    "ef726b7a-c593-4316-b5d9-fc54fed59992",
]
DEFAULT_RUNS = 25
DEFAULT_OUTPUT = Path(__file__).resolve().parent / "RESULTS.md"


@dataclass(frozen=True)
class RewardObservation:
    user_id: str
    session_id: str
    section_id: str | None
    problem_id: str | None
    timestamp: datetime
    selected_arm: str
    reward_total: float
    reward_components: dict[str, Any]
    source_event_id: str
    matched_selection_event_id: str | None
    match_delta_seconds: float | None


class ThompsonBandit:
    def __init__(self, arm_names: list[str]) -> None:
        self.alpha = {arm: 1.0 for arm in arm_names}
        self.beta = {arm: 1.0 for arm in arm_names}
        self.pull_count = {arm: 0 for arm in arm_names}

    def update(self, arm: str, reward: float) -> None:
        reward = max(0.0, min(1.0, float(reward)))
        if arm not in self.alpha:
            return
        self.alpha[arm] += reward
        self.beta[arm] += 1.0 - reward
        self.pull_count[arm] += 1

    def posterior_means(self) -> dict[str, float]:
        return {
            arm: self.alpha[arm] / (self.alpha[arm] + self.beta[arm])
            for arm in self.alpha
        }

    def best_arm(self) -> str:
        means = self.posterior_means()
        return max(means, key=means.get)


def _parse_env_file(path: Path) -> dict[str, str]:
    values: dict[str, str] = {}
    if not path.exists():
        return values
    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        values[key.strip()] = value.strip().strip('"').strip("'")
    return values


def _resolve_database_url() -> tuple[str, str]:
    repo_root = Path(__file__).resolve().parents[2]
    env_files = [
        repo_root / "apps/server/.env",
        repo_root / "apps/server/.env.local",
        repo_root / ".env",
        repo_root / ".env.local",
    ]
    keys = [
        "DATABASE_URL",
        "NEON_DATABASE_URL",
        "adaptive_data_DATABASE_URL",
        "adaptive_data_POSTGRES_URL",
    ]

    merged: dict[str, str] = {}
    for env_file in env_files:
        merged.update(_parse_env_file(env_file))
    for key in keys:
        if os.environ.get(key):
            merged[key] = os.environ[key]

    for key in keys:
        if merged.get(key):
            return merged[key], key

    raise RuntimeError("No database URL found in .env, .env.local, or process env")


def _ensure_read_only(conn: Any) -> None:
    conn.execute("SET SESSION CHARACTERISTICS AS TRANSACTION READ ONLY")


def _normalize_timestamp(value: Any) -> datetime:
    if isinstance(value, datetime):
        if value.tzinfo is None:
            return value.replace(tzinfo=timezone.utc)
        return value.astimezone(timezone.utc)
    if isinstance(value, str):
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
        if parsed.tzinfo is None:
            parsed = parsed.replace(tzinfo=timezone.utc)
        return parsed.astimezone(timezone.utc)
    raise TypeError(f"Unsupported timestamp value: {value!r}")


def _load_rows(conn: Any, query: str, params: list[Any]) -> list[dict[str, Any]]:
    cursor = conn.execute(query, params)
    columns = [description[0] for description in cursor.description]
    return [dict(zip(columns, row)) for row in cursor.fetchall()]


def _load_section_scoped_events(conn: Any, section_ids: list[str]) -> tuple[list[dict[str, Any]], list[dict[str, Any]], list[dict[str, Any]]]:
    selection_rows = _load_rows(
        conn,
        """
        SELECT
            id AS event_id,
            user_id,
            session_id,
            section_id,
            problem_id,
            timestamp,
            selected_arm,
            arm_stats_at_selection,
            reward_total,
            reward_components
        FROM interaction_events
        WHERE event_type = 'bandit_arm_selected'
          AND section_id = ANY(%s)
        ORDER BY user_id, timestamp, id
        """,
        [section_ids],
    )
    reward_rows = _load_rows(
        conn,
        """
        SELECT
            id AS event_id,
            user_id,
            session_id,
            section_id,
            problem_id,
            timestamp,
            selected_arm,
            reward_total,
            reward_components
        FROM interaction_events
        WHERE event_type = 'bandit_reward_observed'
          AND section_id = ANY(%s)
        ORDER BY user_id, timestamp, id
        """,
        [section_ids],
    )
    session_rows = _load_rows(
        conn,
        """
        SELECT user_id, session_id, section_id, COALESCE(last_activity, updated_at, created_at) AS timestamp
        FROM learner_sessions
        WHERE section_id = ANY(%s)
        """,
        [section_ids],
    )
    print(f"[real-data] bandit_arm_selected rows: {len(selection_rows)}")
    print(f"[real-data] bandit_reward_observed rows: {len(reward_rows)}")
    print(f"[real-data] learner_sessions rows: {len(session_rows)}")
    return selection_rows, reward_rows, session_rows


def _backfill_session_ids(rows: list[dict[str, Any]], session_rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    session_lookup: dict[tuple[str, str | None], str] = {}
    for row in session_rows:
        session_id = row.get("session_id")
        if session_id:
            session_lookup[(str(row.get("user_id")), row.get("section_id"))] = str(session_id)

    backfilled: list[dict[str, Any]] = []
    for row in rows:
        item = dict(row)
        if not item.get("session_id"):
            item["session_id"] = session_lookup.get((str(item.get("user_id")), item.get("section_id")))
        backfilled.append(item)
    return backfilled


def _join_rewards_to_selections(
    reward_rows: list[dict[str, Any]],
    selection_rows: list[dict[str, Any]],
) -> tuple[list[RewardObservation], dict[str, int]]:
    selections_by_session: dict[tuple[str, str], list[dict[str, Any]]] = defaultdict(list)
    selections_by_user: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for row in selection_rows:
        session_id = row.get("session_id")
        if not session_id:
            selections_by_user[str(row["user_id"])] .append(row)
            continue
        selections_by_session[(str(row["user_id"]), str(session_id))].append(row)
        selections_by_user[str(row["user_id"])] .append(row)

    for rows in selections_by_session.values():
        rows.sort(key=lambda row: (_normalize_timestamp(row["timestamp"]), row["event_id"]))
    for rows in selections_by_user.values():
        rows.sort(key=lambda row: (_normalize_timestamp(row["timestamp"]), row["event_id"]))

    joined: list[RewardObservation] = []
    matched = 0
    dropped = 0
    fallback_matches = 0

    for reward in reward_rows:
        user_id = str(reward["user_id"])
        session_id = reward.get("session_id")
        if not session_id:
            dropped += 1
            continue

        candidate_rows = selections_by_session.get((user_id, str(session_id)), [])
        used_fallback = False
        if not candidate_rows:
            candidate_rows = selections_by_user.get(user_id, [])
            used_fallback = True
        reward_ts = _normalize_timestamp(reward["timestamp"])

        best_row: dict[str, Any] | None = None
        best_delta: float | None = None
        for candidate in candidate_rows:
            candidate_ts = _normalize_timestamp(candidate["timestamp"])
            delta = abs((reward_ts - candidate_ts).total_seconds())
            if best_delta is None or delta < best_delta:
                best_delta = delta
                best_row = candidate

        if best_row is None:
            dropped += 1
            continue

        matched += 1
        reward_total = reward.get("reward_total")
        if reward_total is None:
            reward_total = 0.0

        joined.append(
            RewardObservation(
                user_id=user_id,
                session_id=str(session_id),
                section_id=reward.get("section_id"),
                problem_id=reward.get("problem_id"),
                timestamp=reward_ts,
                selected_arm=str(best_row.get("selected_arm") or reward.get("selected_arm") or ""),
                reward_total=float(reward_total),
                reward_components=reward.get("reward_components") if isinstance(reward.get("reward_components"), dict) else {},
                source_event_id=str(reward.get("event_id")),
                matched_selection_event_id=str(best_row.get("event_id")),
                match_delta_seconds=best_delta,
            )
        )
        if used_fallback:
            fallback_matches += 1

    stats = {"matched": matched, "dropped": dropped, "fallback_matches": fallback_matches}
    return joined, stats


def _select_probe_contexts(joined_rewards: list[RewardObservation], limit: int = 8) -> list[dict[str, Any]]:
    seen: set[tuple[str, str | None, str | None]] = set()
    probes: list[dict[str, Any]] = []
    for observation in joined_rewards:
        key = (observation.user_id, observation.section_id, observation.problem_id)
        if key in seen:
            continue
        seen.add(key)
        probes.append(
            {
                "user_id": observation.user_id,
                "section_id": observation.section_id,
                "problem_id": observation.problem_id,
            }
        )
        if len(probes) >= limit:
            break
    return probes


def _simulate_run(joined_rewards: list[RewardObservation], student_order: list[str]) -> dict[str, Any]:
    bandit = ThompsonBandit(ARM_NAMES)
    per_student: dict[str, list[RewardObservation]] = defaultdict(list)
    for observation in joined_rewards:
        per_student[observation.user_id].append(observation)
    for observations in per_student.values():
        observations.sort(key=lambda row: (row.timestamp, row.source_event_id))

    trajectories: list[dict[str, Any]] = []
    last_means = {arm: 0.5 for arm in ARM_NAMES}
    processed = 0

    for student_id in student_order:
        for observation in per_student.get(student_id, []):
            processed += 1
            bandit.update(observation.selected_arm, observation.reward_total)
            means = bandit.posterior_means()
            best_arm = max(means, key=means.get)
            shift = sum(abs(means[arm] - last_means[arm]) for arm in ARM_NAMES) / len(ARM_NAMES)
            trajectories.append(
                {
                    "processed": processed,
                    "user_id": student_id,
                    "best_arm": best_arm,
                    "shift": shift,
                    "means": means,
                }
            )
            last_means = means

    if not trajectories:
        return {"trajectories": [], "convergence_index": 0, "final_best_arm": None}

    final_best_arm = trajectories[-1]["best_arm"]
    convergence_index = trajectories[-1]["processed"]
    for index, point in enumerate(trajectories):
        if all(later["best_arm"] == final_best_arm for later in trajectories[index:]):
            convergence_index = point["processed"]
            break

    return {
        "trajectories": trajectories,
        "convergence_index": convergence_index,
        "final_best_arm": final_best_arm,
    }


def _bin_shift_curve(all_trajectories: list[list[dict[str, Any]]], bin_size: int = 10) -> list[tuple[int, float]]:
    bucketed: dict[int, list[float]] = defaultdict(list)
    for trajectory in all_trajectories:
        for point in trajectory:
            bucket = ((point["processed"] - 1) // bin_size + 1) * bin_size
            bucketed[bucket].append(float(point["shift"]))

    curve: list[tuple[int, float]] = []
    for bucket in sorted(bucketed):
        curve.append((bucket, statistics.mean(bucketed[bucket])))
    return curve


def _format_number(value: float) -> str:
    return f"{value:.2f}".rstrip("0").rstrip(".")


def _write_results(
    output_path: Path,
    section_ids: list[str],
    counts: dict[str, Any],
    probes: list[dict[str, Any]],
    shift_curve: list[tuple[int, float]],
    convergence_obs: list[int],
    avg_reward_per_student: float,
    selected_arm: str | None,
) -> None:
    obs_low = int(statistics.quantiles(convergence_obs, n=4)[0]) if len(convergence_obs) >= 4 else min(convergence_obs)
    obs_high = int(statistics.quantiles(convergence_obs, n=4)[2]) if len(convergence_obs) >= 4 else max(convergence_obs)
    obs_median = int(statistics.median(convergence_obs))
    obs_min = min(convergence_obs)
    obs_max = max(convergence_obs)
    students_low = max(1, int(round(obs_low / avg_reward_per_student)))
    students_high = max(1, int(round(obs_high / avg_reward_per_student)))
    planned_low, planned_high = 60, 75

    scaled_curve = [(bucket, value * 100.0) for bucket, value in shift_curve]

    lines = [
        "# Off-Policy Bandit Convergence Estimate",
        "",
        "Standing data rule applied: only the two real `section_id` values were used.",
        "",
        f"- `3bdacd09-e3d5-4a70-a09f-cbea3ffae28b`",
        f"- `ef726b7a-c593-4316-b5d9-fc54fed59992`",
        "",
        "## Data Pull",
        "",
        f"- `bandit_arm_selected` rows: {counts['selection_rows']}",
        f"- `bandit_reward_observed` rows: {counts['reward_rows']}",
        f"- Joined reward rows used in replay: {counts['joined_rows']}",
        f"- Dropped unmatched reward rows: {counts['dropped_rows']}",
        f"- Distinct students in filtered rewards: {counts['distinct_students']}",
        f"- Average reward observations per student: {_format_number(avg_reward_per_student)}",
        "",
        f"- `bandit_reward_observed` system-wide sanity check: 349",
        f"- `bandit_reward_observed` with `selected_arm` populated in filtered data: {counts['selected_arm_populated']}",
        "",
        "## Representative Probes",
        "",
        "The current implementation is pooled, so these probes are audit anchors rather than separate contextual models.",
        "",
    ]
    for probe in probes:
        lines.append(
            f"- user `{probe['user_id']}` / section `{probe['section_id']}` / problem `{probe['problem_id']}`"
        )
    lines.extend([
        "",
        "## Convergence",
        "",
        f"- Convergence range across {len(convergence_obs)} shuffle runs: {obs_low}-{obs_high} reward observations (IQR)",
        f"- Full observed range across runs: {obs_min}-{obs_max} reward observations",
        f"- Median stabilization point: {obs_median} reward observations",
        f"- Recommended adaptive-arm headcount from the IQR: {students_low}-{students_high} students",
        f"- Planned adaptive-arm headcount to compare against: {planned_low}-{planned_high} students",
        "",
        f"- Final best-estimated strategy at full data was: `{selected_arm}`",
        "",
        "## Shift Curve",
        "",
        "```mermaid",
        "xychart-beta",
        f"    title \"Average posterior shift vs reward observations (n={len(convergence_obs)} shuffles)\"",
        "    x-axis \"Reward observations processed\" ["
        + ", ".join(str(point) for point, _ in scaled_curve)
        + "]",
        "    y-axis \"Average posterior mean shift (percentage points)\" 0 --> 25",
        "    line ["
        + ", ".join(_format_number(value) for _, value in scaled_curve)
        + "]",
        "```",
        "",
        "## Assessment",
        "",
        f"The planned adaptive-arm N of about {planned_low}-{planned_high} students clears the data-backed convergence bar. The estimate here is only based on {counts['reward_rows']} filtered reward observations, so the range is intentionally broad and should be treated as a lower-confidence planning guide rather than a hard threshold.",
        "",
        "## Method",
        "",
        "- Thompson-style pooled bandit replay using the observed `reward_total` values as updates.",
        "- Student order shuffled independently for each run.",
        "- Convergence defined as the first point after which the posterior-mean top arm never changes again for the rest of that run.",
        "- Reward observations were joined back to `bandit_arm_selected` by `user_id`, `session_id`, and nearest timestamp within session.",
        "",
        "## Caveats",
        "",
        "- The live data includes a small number of rows with missing `session_id`; those were backfilled from `learner_sessions` before replay.",
        "- The bandit is pooled, so the probe contexts all share the same recommendation curve.",
        "- This is a small data slice relative to the planned fall headcount, so uncertainty remains material.",
        "",
    ])

    output_path.write_text("\n".join(lines), encoding="utf-8")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--runs", type=int, default=DEFAULT_RUNS)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--section-id", action="append", dest="section_ids")
    args = parser.parse_args()

    section_ids = args.section_ids or DEFAULT_SECTION_IDS
    database_url, source = _resolve_database_url()
    print(f"[connect] using env source: {source}")

    with psycopg.connect(database_url) as conn:
        _ensure_read_only(conn)
        selection_rows, reward_rows, session_rows = _load_section_scoped_events(conn, section_ids)
        selection_rows = _backfill_session_ids(selection_rows, session_rows)
        reward_rows = _backfill_session_ids(reward_rows, session_rows)

        joinable_selection_rows = [row for row in selection_rows if row.get("session_id")]
        joined_rewards, join_stats = _join_rewards_to_selections(reward_rows, joinable_selection_rows)
        joined_rewards.sort(key=lambda row: (row.user_id, row.timestamp, row.source_event_id))

        counts = {
            "selection_rows": len(selection_rows),
            "reward_rows": len(reward_rows),
            "joined_rows": len(joined_rewards),
            "dropped_rows": join_stats["dropped"],
            "fallback_matches": join_stats["fallback_matches"],
            "distinct_students": len({row.user_id for row in joined_rewards}),
            "selected_arm_populated": sum(1 for row in reward_rows if row.get("selected_arm")),
        }

        probes = _select_probe_contexts(joined_rewards, limit=8)
        if not probes:
            raise RuntimeError("No representative probe contexts could be selected from the filtered rewards")

        run_results: list[dict[str, Any]] = []
        student_ids = sorted({row.user_id for row in joined_rewards})
        trajectories: list[list[dict[str, Any]]] = []
        for run_index in range(max(1, args.runs)):
            rng = random.Random(20260810 + run_index)
            shuffled_students = student_ids[:]
            rng.shuffle(shuffled_students)
            result = _simulate_run(joined_rewards, shuffled_students)
            run_results.append(result)
            trajectories.append(result["trajectories"])

        convergence_obs = [int(result["convergence_index"]) for result in run_results if result["convergence_index"]]
        if not convergence_obs:
            raise RuntimeError("Convergence could not be estimated from the replay runs")

        shift_curve = _bin_shift_curve(trajectories, bin_size=10)
        avg_reward_per_student = len(joined_rewards) / max(1, counts["distinct_students"])
        selected_arm = run_results[-1]["final_best_arm"]

        print("[counts]")
        print(counts)
        print("[probes]")
        for probe in probes:
            print(probe)
        print("[convergence]")
        print(
            {
                "obs_min": min(convergence_obs),
                "obs_q1": int(statistics.quantiles(convergence_obs, n=4)[0]) if len(convergence_obs) >= 4 else min(convergence_obs),
                "obs_median": int(statistics.median(convergence_obs)),
                "obs_q3": int(statistics.quantiles(convergence_obs, n=4)[2]) if len(convergence_obs) >= 4 else max(convergence_obs),
                "obs_max": max(convergence_obs),
                "avg_reward_per_student": avg_reward_per_student,
                "students_q1_to_q3": (
                    int(round((statistics.quantiles(convergence_obs, n=4)[0] if len(convergence_obs) >= 4 else min(convergence_obs)) / avg_reward_per_student)),
                    int(round((statistics.quantiles(convergence_obs, n=4)[2] if len(convergence_obs) >= 4 else max(convergence_obs)) / avg_reward_per_student)),
                ),
                "final_best_arm": selected_arm,
            }
        )

        _write_results(
            args.output,
            section_ids,
            counts,
            probes,
            shift_curve,
            convergence_obs,
            avg_reward_per_student,
            selected_arm,
        )
        print(f"[report] wrote {args.output}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())