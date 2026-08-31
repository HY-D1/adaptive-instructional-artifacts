"""Feature construction and read-only replay for the pooled contextual bandit."""
from __future__ import annotations

import re
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from analysis.off_policy_simulation.data_loader import load_real_events
from analysis.off_policy_simulation.estimate_bandit_convergence import _resolve_database_url
from .pooled_bandit import PooledContextualThompsonBandit

ROOT = Path(__file__).resolve().parents[1]
PROBLEMS_PATH = ROOT / "apps/web/src/app/data/problems.ts"


def load_problem_difficulties(path: Path = PROBLEMS_PATH) -> dict[str, str]:
    text = path.read_text(encoding="utf-8")
    pairs = re.findall(r"id:\s*'([^']+)'[\s\S]{0,500}?difficulty:\s*'([^']+)'", text)
    return dict(pairs)


def difficulty_value(problem_id: str, difficulties: dict[str, str], encoding: dict[str, float]) -> float:
    if problem_id not in difficulties:
        raise KeyError(f"No local difficulty for {problem_id}")
    return float(encoding[difficulties[problem_id]])


def _event_time(row: dict[str, Any]) -> datetime:
    value = row.get("timestamp")
    if isinstance(value, datetime):
        return value if value.tzinfo else value.replace(tzinfo=timezone.utc)
    return datetime.fromisoformat(str(value).replace("Z", "+00:00"))


def _reward_for_selection(selection: dict[str, Any], rewards: list[dict[str, Any]]) -> float:
    candidates = [row for row in rewards if row.get("user_id") == selection.get("user_id") and row.get("session_id") == selection.get("session_id") and row.get("selected_arm") == selection.get("selected_arm")]
    if not candidates:
        return 0.0
    same_problem = [row for row in candidates if row.get("problem_id") == selection.get("problem_id")]
    candidates = same_problem or candidates
    selection_time = _event_time(selection)
    following = [row for row in candidates if _event_time(row) >= selection_time]
    candidates = following or candidates
    return float(min(candidates, key=lambda row: abs((_event_time(row) - selection_time).total_seconds())).get("reward_total") or 0.0)


def build_features(events: list[dict[str, Any]], config: dict[str, Any]) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    difficulties = load_problem_difficulties()
    feature_config = config["features"]
    encoding = feature_config["problem_difficulty"]["encoding"]
    selections = sorted((row for row in events if row.get("event_type") == "bandit_arm_selected"), key=lambda row: (_event_time(row), str(row.get("event_id"))))
    rewards = [row for row in events if row.get("event_type") == "bandit_reward_observed"]
    histories: dict[str, list[tuple[str, bool, datetime]]] = defaultdict(list)
    records: list[dict[str, Any]] = []
    joined_problem_ids = {str(row.get("problem_id")) for row in selections}
    missing_difficulty = sorted(joined_problem_ids - set(difficulties))

    for selection in selections:
        user_id = str(selection["user_id"])
        problem_id = str(selection["problem_id"])
        prior = histories[user_id]
        window = int(feature_config["rolling_accuracy"]["window_problems"])
        recent = prior[-window:]
        accuracy = sum(1.0 if solved else 0.0 for _, solved, _ in recent) / len(recent) if recent else float(feature_config["rolling_accuracy"]["default"])
        features = []
        if feature_config.get("intercept"):
            features.append(1.0)
        if feature_config["rolling_accuracy"].get("enabled"):
            features.append(accuracy)
        if feature_config["problem_difficulty"].get("enabled"):
            features.append(difficulty_value(problem_id, difficulties, encoding))
        records.append({"selection": selection, "features": features, "reward": _reward_for_selection(selection, rewards), "history_size": len(recent)})
        problem_events = [row for row in events if str(row.get("user_id")) == user_id and str(row.get("problem_id")) == problem_id and _event_time(row) <= _event_time(selection)]
        executions = [row for row in problem_events if row.get("event_type") == "execution"]
        if executions and problem_id not in {item[0] for item in prior}:
            histories[user_id].append((problem_id, bool(executions[-1].get("successful")), _event_time(selection)))

    return records, {"difficulty_count": len(joined_problem_ids) - len(missing_difficulty), "missing_difficulty": missing_difficulty, "students": len(histories), "selections": len(records)}


def replay(events: list[dict[str, Any]], config: dict[str, Any]) -> dict[str, Any]:
    records, diagnostics = build_features(events, config)
    model_config = config["model"]
    bandit = PooledContextualThompsonBandit(config["arms"], len(records[0]["features"]), model_config, int(config["random_seed"])) if records else None
    trajectory: list[dict[str, Any]] = []
    for index, record in enumerate(records, start=1):
        selection = record["selection"]
        estimated = bandit.estimated_rewards(record["features"]) if bandit else {}
        bandit.update(str(selection["selected_arm"]), record["features"], record["reward"])
        trajectory.append({"processed": index, "user_id": selection["user_id"], "problem_id": selection["problem_id"], "features": record["features"], "reward": record["reward"], "observed_arm": selection["selected_arm"], "best_arm": bandit.best_arm(record["features"]), "estimated_rewards_before_update": estimated})
    return {"diagnostics": diagnostics, "trajectory": trajectory, "final_stats": bandit.arm_stats() if bandit else {}}


def load_and_replay(config: dict[str, Any]) -> dict[str, Any]:
    url, source = _resolve_database_url()
    sections = config["validation"]["section_id_allowlist"]
    import psycopg
    with psycopg.connect(url) as conn:
        events = load_real_events(conn, sections)
    result = replay(events, config)
    result["database_source"] = source
    result["event_count"] = len(events)
    return result
