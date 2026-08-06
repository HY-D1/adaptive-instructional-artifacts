from __future__ import annotations

from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from pdf_ingest.eval_queries import EMBEDDING_QUERYSET_VERSION, default_eval_queries, validate_eval_queries


def test_default_eval_queries_meet_surface_requirements() -> None:
    queries = default_eval_queries()
    validate_eval_queries(queries)

    assert EMBEDDING_QUERYSET_VERSION == "v1"
    assert len(queries) >= 30

    counts = {"hints": 0, "explanations": 0, "learning_page": 0}
    for query in queries:
        counts[query.surface] += 1
        assert query.id
        assert query.text.strip()
        assert len(query.expected_unit_ids) >= 1

    assert counts["hints"] >= 10
    assert counts["explanations"] >= 10
    assert counts["learning_page"] >= 10


def test_query_ids_are_unique() -> None:
    queries = default_eval_queries()
    ids = [query.id for query in queries]
    assert len(ids) == len(set(ids))
