from __future__ import annotations

import json
from pathlib import Path
import sys

import pytest
from pypdf import PdfWriter

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from pdf_ingest.chunking import ChunkWindow
from pdf_ingest.config import ExtractConfig
from pdf_ingest.docling_pipeline import ExtractFailure, extract_with_docling
from pdf_ingest.mlx_enricher import MlxEnrichmentResult


class _FakeDocument:
    def __init__(self, markdown: str):
        self._markdown = markdown

    def export_to_markdown(self) -> str:
        return self._markdown

    def model_dump(self, mode: str = "json") -> dict[str, str]:
        return {"markdown": self._markdown, "mode": mode}


class _FakeConversion:
    def __init__(self, *, status: str, markdown: str):
        self.status = status
        self.errors: list[str] = []
        self.timings: dict[str, float] = {}
        self.document = _FakeDocument(markdown)

    def model_dump(self, mode: str = "json") -> dict[str, str]:
        return {
            "status": self.status,
            "mode": mode,
        }


class _FakeConverter:
    def __init__(self, conversion: _FakeConversion):
        self._conversion = conversion

    def convert(self, *_args, **_kwargs) -> _FakeConversion:
        return self._conversion


def _write_fixture_pdf(path: Path) -> None:
    writer = PdfWriter()
    writer.add_blank_page(width=612, height=792)
    with path.open("wb") as handle:
        writer.write(handle)


def _make_config(tmp_path: Path, pdf_path: Path) -> ExtractConfig:
    return ExtractConfig(
        input_pdf=pdf_path,
        output_dir=tmp_path / "bundle-output",
        chapter_start=1,
        chapter_end=1,
        mlx_enabled=False,
        mlx_model="",
        embedding_model="embeddinggemma",
        embedding_dimension=768,
    )


def _stub_enrichment(
    _text: str,
    enabled: bool,
    model: str = "",
    fallback_model: str = "",
) -> MlxEnrichmentResult:
    _ = enabled
    _ = model
    _ = fallback_model
    return MlxEnrichmentResult(
        summary="summary",
        explanation="explanation",
        hint_draft="hint",
        backend="deterministic_fallback",
        definition_refined="definition",
        example_refined="example",
        common_mistakes_refined="- mistake",
        display_summary_refined="summary",
        hintable_excerpt_refined="excerpt",
        hint_v1="hint one",
        hint_v2="hint two",
        hint_escalation="hint escalation",
        refinement_model="qwen3:4b",
        refinement_confidence=0.7,
        refinement_fallback_reason=None,
        refinement_version="grounded-refinement-v1",
    )


def _stub_chunk_text(_text: str, chunk_words: int, chunk_overlap: int) -> list[ChunkWindow]:
    _ = chunk_words
    _ = chunk_overlap
    return [ChunkWindow(index=0, text="SELECT * FROM employees")]


def _stub_embeddings(
    _texts: list[str],
    model: str,
    dimension: int,
    fallback_models: list[str] | None = None,
) -> tuple[list[list[float]], str, str, int]:
    _ = model
    _ = fallback_models
    return ([[0.0] * dimension], "deterministic_hash_fallback", model, dimension)


def test_extract_uses_pymupdf_fallback(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    pdf_path = tmp_path / "sample.pdf"
    _write_fixture_pdf(pdf_path)

    conversion = _FakeConversion(status="failure", markdown="")
    monkeypatch.setattr("pdf_ingest.docling_pipeline.DocumentConverter", lambda: _FakeConverter(conversion))
    monkeypatch.setattr(
        "pdf_ingest.docling_pipeline._extract_text_with_pymupdf",
        lambda *_args, **_kwargs: (
            "# Unit\n\nFallback content from pymupdf",
            {"backend": "pymupdf", "status": "success", "character_count": 36},
        ),
    )
    monkeypatch.setattr(
        "pdf_ingest.docling_pipeline._extract_text_with_pypdf",
        lambda *_args, **_kwargs: ("", {"backend": "pypdf", "status": "not_run"}),
    )
    monkeypatch.setattr("pdf_ingest.docling_pipeline.enrich_text", _stub_enrichment)
    monkeypatch.setattr("pdf_ingest.docling_pipeline.chunk_text", _stub_chunk_text)
    monkeypatch.setattr("pdf_ingest.docling_pipeline.embed_texts", _stub_embeddings)
    monkeypatch.setattr("pdf_ingest.docling_pipeline._run_artifact_dir", lambda run_id: tmp_path / "ingest-runs" / run_id)

    result = extract_with_docling(_make_config(tmp_path, pdf_path))

    assert result.source_doc.parser_backend == "docling_fallback_pymupdf"
    assert result.units[0].parser_backend == "docling_fallback_pymupdf"
    assert result.chunks[0].parser_backend == "docling_fallback_pymupdf"
    assert result.diagnostics.fallback is not None
    assert result.diagnostics.fallback["selected_backend"] == "pymupdf"
    assert result.diagnostics_path.exists()


def test_extract_uses_pypdf_fallback_after_pymupdf_empty(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    pdf_path = tmp_path / "sample.pdf"
    _write_fixture_pdf(pdf_path)

    conversion = _FakeConversion(status="failure", markdown="")
    monkeypatch.setattr("pdf_ingest.docling_pipeline.DocumentConverter", lambda: _FakeConverter(conversion))
    monkeypatch.setattr(
        "pdf_ingest.docling_pipeline._extract_text_with_pymupdf",
        lambda *_args, **_kwargs: ("", {"backend": "pymupdf", "status": "empty", "character_count": 0}),
    )
    monkeypatch.setattr(
        "pdf_ingest.docling_pipeline._extract_text_with_pypdf",
        lambda *_args, **_kwargs: (
            "# Unit\n\nFallback content from pypdf",
            {"backend": "pypdf", "status": "success", "character_count": 34},
        ),
    )
    monkeypatch.setattr("pdf_ingest.docling_pipeline.enrich_text", _stub_enrichment)
    monkeypatch.setattr("pdf_ingest.docling_pipeline.chunk_text", _stub_chunk_text)
    monkeypatch.setattr("pdf_ingest.docling_pipeline.embed_texts", _stub_embeddings)
    monkeypatch.setattr("pdf_ingest.docling_pipeline._run_artifact_dir", lambda run_id: tmp_path / "ingest-runs" / run_id)

    result = extract_with_docling(_make_config(tmp_path, pdf_path))

    assert result.source_doc.parser_backend == "docling_fallback_pypdf"
    assert result.diagnostics.fallback is not None
    assert result.diagnostics.fallback["selected_backend"] == "pypdf"


def test_extract_failure_persists_diagnostics(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    pdf_path = tmp_path / "sample.pdf"
    _write_fixture_pdf(pdf_path)

    conversion = _FakeConversion(status="failure", markdown="")
    monkeypatch.setattr("pdf_ingest.docling_pipeline.DocumentConverter", lambda: _FakeConverter(conversion))
    monkeypatch.setattr(
        "pdf_ingest.docling_pipeline._extract_text_with_pymupdf",
        lambda *_args, **_kwargs: ("", {"backend": "pymupdf", "status": "empty", "character_count": 0}),
    )
    monkeypatch.setattr(
        "pdf_ingest.docling_pipeline._extract_text_with_pypdf",
        lambda *_args, **_kwargs: ("", {"backend": "pypdf", "status": "empty", "character_count": 0}),
    )
    monkeypatch.setattr("pdf_ingest.docling_pipeline._run_artifact_dir", lambda run_id: tmp_path / "ingest-runs" / run_id)

    with pytest.raises(ExtractFailure) as error_info:
        extract_with_docling(_make_config(tmp_path, pdf_path))

    failure = error_info.value
    assert failure.diagnostics_path.exists()

    payload = json.loads(failure.diagnostics_path.read_text(encoding="utf-8"))
    assert payload["fallback"]["triggered"] is True
    assert payload["fallback"]["selected_backend"] is None
    assert payload["docling"]["status"] == "failure"
