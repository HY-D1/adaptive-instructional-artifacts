from __future__ import annotations

from pathlib import Path
import sys

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from pdf_ingest import mlx_enricher


def test_enrich_text_sanitizes_list_literal_common_mistakes(monkeypatch: pytest.MonkeyPatch) -> None:
    payload = {
        "definition_refined": "Use SELECT with WHERE to filter rows from employees.",
        "display_summary_refined": "Use WHERE to filter rows from employees.",
        "hintable_excerpt_refined": "Filter employees by department using WHERE.",
        "example_refined": "SELECT name FROM employees WHERE department = 'Sales';",
        "common_mistakes_refined": "['- Missing WHERE clause conditions.', '- Forgetting to verify column names.']",
        "hint_v1": "Identify the filter you need before writing SQL.",
        "hint_v2": "Which column should your WHERE clause target?",
        "hint_escalation": "Use SELECT ___ FROM employees WHERE ___.",
        "refinement_confidence": 0.91,
    }

    monkeypatch.setattr(mlx_enricher, "_call_ollama_json", lambda _prompt, _model: payload)

    source_text = (
        "Employees table includes department and salary columns. "
        "Use WHERE conditions to filter rows before expanding the query, and verify column names."
    )
    result = mlx_enricher.enrich_text(
        source_text,
        enabled=True,
        model="qwen3:4b",
        fallback_model="llama3.2:3b",
    )

    assert "- Missing WHERE clause conditions." in result.common_mistakes_refined
    assert "- Forgetting to verify column names." in result.common_mistakes_refined
    assert "[" not in result.common_mistakes_refined
    assert "']" not in result.common_mistakes_refined


def test_detects_the_error_class_a_passage_teaches() -> None:
    assert mlx_enricher._detect_error_class("Use GROUP BY with COUNT to aggregate per department.") == "grouping"
    assert mlx_enricher._detect_error_class("An inner join matches rows on a foreign key.") == "joining"
    assert mlx_enricher._detect_error_class("ORDER BY sorts the result set ascending or descending.") == "ordering"
    assert mlx_enricher._detect_error_class("SELECT DISTINCT removes duplicate rows.") == "duplicates"
    assert mlx_enricher._detect_error_class("A relation is a set of tuples.") is None


def test_deterministic_hints_speak_to_the_detected_error_class() -> None:
    grouping = mlx_enricher._deterministic_hints(
        "Aggregate sales per region.",
        "GROUP BY collapses rows that share a value.",
        error_class="grouping",
    )
    generic = mlx_enricher._deterministic_hints(
        "A relation is a set of tuples.",
        "Relations hold tuples.",
        error_class=None,
    )

    rung_one, rung_two, rung_three = grouping
    # The three rungs are the guidance ladder: a nudge, a question, then an
    # explicit scaffold. Identical text across rungs would flatten escalation
    # depth, which the papers measure.
    assert len({rung_one, rung_two, rung_three}) == 3
    assert rung_two.rstrip().endswith("?")
    assert "___" in rung_three
    assert len(rung_one) <= 110
    assert len(rung_two) <= 210

    # A grouping passage must not fall back to the generic opener.
    assert "group" in rung_one.lower() or "group" in rung_two.lower()
    assert grouping[0] != generic[0]


def test_prompt_states_the_ladder_and_the_detected_error_class() -> None:
    prompt = mlx_enricher._build_prompt("Use GROUP BY with COUNT to aggregate per department.")

    # Rung semantics have to be in the prompt or the model returns three
    # paraphrases of the same hint.
    assert "micro-hint" in prompt
    assert "guiding question" in prompt
    assert "grouping" in prompt
    # L4 is the runtime RAG/LLM rung, so ingest must not invent a fourth hint.
    assert "hint_v4" not in prompt


def test_enrich_text_uses_deterministic_fallback_when_models_unavailable(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(mlx_enricher, "_call_ollama_json", lambda _prompt, _model: None)

    result = mlx_enricher.enrich_text(
        "SELECT name FROM employees WHERE salary > 70000;",
        enabled=True,
        model="qwen3:4b",
        fallback_model="llama3.2:3b",
    )

    assert result.backend == "deterministic_fallback"
    assert result.refinement_model == "qwen3:4b"
    assert result.refinement_fallback_reason is not None
    assert "model_unavailable:qwen3:4b" in result.refinement_fallback_reason
    assert "model_unavailable:llama3.2:3b" in result.refinement_fallback_reason
