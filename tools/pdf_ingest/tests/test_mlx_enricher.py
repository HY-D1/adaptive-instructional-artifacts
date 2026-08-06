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
