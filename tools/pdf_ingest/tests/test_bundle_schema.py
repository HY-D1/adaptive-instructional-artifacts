from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from pdf_ingest.export_bundle import load_bundle, write_bundle
from pdf_ingest.schemas import ChunkRecord, DiagnosticsRecord, SourceDocRecord, UnitRecord


def test_bundle_roundtrip(tmp_path: Path) -> None:
    source_doc = SourceDocRecord(
        doc_id="doc-1",
        filename="doc-1.pdf",
        title="Doc 1",
        sha256="abc",
        page_count=10,
        parser_backend="docling_fallback_pymupdf",
        pipeline_version="v1",
        run_id="run-1",
    )
    units = [
        UnitRecord(
            unit_id="doc-1/unit-a",
            doc_id="doc-1",
            source_doc_id="doc-1",
            concept_id="doc-1/unit-a",
            title="Unit A",
            summary="Summary",
            content_markdown="# Unit A\nBody",
            difficulty="beginner",
            page_start=1,
            page_end=2,
            parser_backend="docling_fallback_pymupdf",
            pipeline_version="v1",
            run_id="run-1",
            metadata={"chapter": 1},
        )
    ]
    chunks = [
        ChunkRecord(
            chunk_id="doc-1/unit-a/chunk-0001",
            unit_id="doc-1/unit-a",
            doc_id="doc-1",
            source_doc_id="doc-1",
            page=1,
            chunk_text="hello world",
            embedding=[0.0] * 768,
            embedding_model="embeddinggemma",
            embedding_dimension=768,
            parser_backend="docling_fallback_pymupdf",
            pipeline_version="v1",
            run_id="run-1",
            metadata={"embedding_backend": "deterministic_hash_fallback"},
        )
    ]
    diagnostics = DiagnosticsRecord(
        run_id="run-1",
        input_path="/tmp/doc-1.pdf",
        input_sha256="abc",
        chapter_range="1-1",
        page_range="1-25",
        page_count=10,
        parser_backend="docling_fallback_pymupdf",
        pipeline_version="v1",
        source_policy="local_only_raw_remote_processed",
        embedding_model="embeddinggemma",
        embedding_dimension=768,
        mlx_enabled=False,
        started_at=datetime.now(timezone.utc),
        completed_at=datetime.now(timezone.utc),
        machine="arm64",
        os="macos",
        python_version="3.11.0",
        preflight={"exists": True, "size_nonzero": True, "pdf_page_count": 10},
        docling={"status": "failure", "markdown_char_count": 0},
        fallback={"triggered": True, "selected_backend": "pymupdf"},
        artifacts={"diagnostics_path": ".local/ingest-runs/run-1/diagnostics.json"},
        notes=[],
    )

    bundle = write_bundle(tmp_path, source_doc, units, chunks, diagnostics)
    assert bundle.manifest.unit_count == 1
    assert bundle.manifest.chunk_count == 1

    loaded = load_bundle(tmp_path)
    assert loaded.manifest.run_id == "run-1"
    assert loaded.source_docs[0].doc_id == "doc-1"
    assert loaded.units[0].unit_id == "doc-1/unit-a"
    assert len(loaded.chunks[0].embedding) == 768
