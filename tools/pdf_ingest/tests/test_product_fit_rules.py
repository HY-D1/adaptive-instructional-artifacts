from __future__ import annotations

from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from pdf_ingest.product_fit_rules import (
    ChunkForEval,
    UnitForEval,
    evaluate_unit,
    gate_results,
    near_duplicate_chunk_ids,
)


def _unit(
    *,
    unit_id: str = "doc/page-10",
    title: str = "Relational Model",
    summary: str = "The relational model organizes data into relations and tuples.",
    content: str = (
        "The relational model describes data in tables with rows and columns. "
        "A query can select, project, and join relations to answer questions."
    ),
    page_start: int = 10,
    page_end: int = 10,
) -> UnitForEval:
    return UnitForEval(
        unit_id=unit_id,
        title=title,
        summary=summary,
        content_markdown=content,
        page_start=page_start,
        page_end=page_end,
    )


def _chunk(*, chunk_id: str, unit_id: str = "doc/page-10", page: int = 10, text: str) -> ChunkForEval:
    return ChunkForEval(
        chunk_id=chunk_id,
        unit_id=unit_id,
        page=page,
        chunk_text=text,
    )


def test_product_fit_rules_happy_path() -> None:
    unit = _unit()
    chunks = [
        _chunk(
            chunk_id="doc/page-10/chunk-1",
            text=(
                "A SELECT query retrieves tuples from a relation and a WHERE clause filters rows by predicates."
            ),
        ),
        _chunk(
            chunk_id="doc/page-10/chunk-2",
            text=(
                "JOIN combines tuples from two relations based on matching keys so queries can explain relationships."
            ),
        ),
    ]

    duplicates = near_duplicate_chunk_ids(chunks)
    result = evaluate_unit(unit, chunks, duplicates)
    gate = gate_results([result])

    assert result.structure_pass is True
    assert "missing_chunks" not in result.failures
    assert result.hintability >= 0.65
    assert result.explainability >= 0.70
    assert result.learning_page >= 0.70
    assert gate.pass_status is True


def test_product_fit_rules_flags_noisy_extraction() -> None:
    unit = _unit(
        title="Page 3",
        summary="j j j j j j j j j j j j j",
        content="j j j j j j j j j j j j j",
    )
    chunks = [
        _chunk(chunk_id="doc/page-3/chunk-1", unit_id="doc/page-3", page=3, text="j j j j j j j j"),
    ]

    result = evaluate_unit(unit, chunks, near_duplicate_chunk_ids(chunks))

    assert "generic_page_title" in result.failures
    assert "chunk_too_short" in result.failures
    assert result.overall < 0.70


def test_product_fit_rules_flags_duplicate_chunk_path() -> None:
    unit = _unit(unit_id="doc/page-12", page_start=12, page_end=12)
    text = "SELECT name FROM employees WHERE salary > 70000 ORDER BY name;"
    chunks = [
        _chunk(chunk_id="doc/page-12/chunk-1", unit_id="doc/page-12", page=12, text=text),
        _chunk(chunk_id="doc/page-12/chunk-2", unit_id="doc/page-12", page=12, text=text),
    ]

    duplicates = near_duplicate_chunk_ids(chunks)
    result = evaluate_unit(unit, chunks, duplicates)

    assert len(duplicates) == 2
    assert "duplicate_or_high_overlap_chunk" in result.failures


def test_product_fit_rules_flags_chunk_length_extremes() -> None:
    unit = _unit(unit_id="doc/page-20", page_start=20, page_end=20)
    short_text = "SELECT 1"
    long_text = "word " * 2000
    chunks = [
        _chunk(chunk_id="doc/page-20/chunk-short", unit_id="doc/page-20", page=20, text=short_text),
        _chunk(chunk_id="doc/page-20/chunk-long", unit_id="doc/page-20", page=20, text=long_text),
    ]

    result = evaluate_unit(unit, chunks, near_duplicate_chunk_ids(chunks))

    assert "chunk_too_short" in result.failures
    assert "chunk_too_long" in result.failures
