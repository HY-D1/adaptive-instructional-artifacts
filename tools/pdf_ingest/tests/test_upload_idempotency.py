from __future__ import annotations

from argparse import Namespace
from datetime import datetime, timezone
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from pdf_ingest import cli
from pdf_ingest.export_bundle import write_bundle
from pdf_ingest.schemas import ChunkRecord, DiagnosticsRecord, SourceDocRecord, UnitRecord


class FakeCursor:
    def __init__(self, executed: list[str]):
        self.executed = executed

    def execute(self, query: str, _params=None):
        self.executed.append(" ".join(query.split()))

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, tb):
        return False


class FakeConn:
    def __init__(self, executed: list[str]):
        self.executed = executed

    def cursor(self):
        return FakeCursor(self.executed)

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, tb):
        return False


def _make_bundle(tmp_path: Path) -> Path:
    source_doc = SourceDocRecord(
        doc_id="doc-1",
        filename="doc-1.pdf",
        title="Doc 1",
        sha256="abc",
        page_count=10,
        parser_backend="docling",
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
            content_markdown="Body",
            difficulty="beginner",
            page_start=1,
            page_end=2,
            parser_backend="docling",
            pipeline_version="v1",
            run_id="run-1",
            metadata={},
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
            parser_backend="docling",
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
        parser_backend="docling",
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
        notes=[],
    )

    write_bundle(tmp_path, source_doc, units, chunks, diagnostics)
    return tmp_path


def test_upload_uses_upserts_for_idempotency(monkeypatch, tmp_path: Path) -> None:
    bundle_dir = _make_bundle(tmp_path)
    executed: list[str] = []

    def fake_connect(_database_url: str, autocommit: bool = True):
        assert autocommit is True
        return FakeConn(executed)

    monkeypatch.setattr(cli.psycopg, "connect", fake_connect)

    args = Namespace(bundle=str(bundle_dir), database_url="postgres://example")
    assert cli.cmd_upload(args) == 0
    assert cli.cmd_upload(args) == 0

    statements = "\n".join(executed)
    assert "INSERT INTO corpus_documents" in statements
    assert "ON CONFLICT (doc_id) DO UPDATE" in statements
    assert "INSERT INTO corpus_units" in statements
    assert "ON CONFLICT (unit_id) DO UPDATE" in statements
    assert "INSERT INTO corpus_chunks" in statements
    assert "ON CONFLICT (chunk_id) DO UPDATE" in statements


def test_resolve_database_url_uses_runtime_priority() -> None:
    url, source = cli._resolve_database_url(
        "",
        {
            "adaptive_data_POSTGRES_URL": "postgres://prefixed-postgres",
            "adaptive_data_DATABASE_URL": "postgres://prefixed-db",
            "NEON_DATABASE_URL": "postgres://neon",
        },
    )
    assert url == "postgres://neon"
    assert source == "NEON_DATABASE_URL"

    url2, source2 = cli._resolve_database_url(
        "",
        {
            "adaptive_data_POSTGRES_URL": "postgres://prefixed-postgres",
            "adaptive_data_DATABASE_URL": "postgres://prefixed-db",
        },
    )
    assert url2 == "postgres://prefixed-db"
    assert source2 == "adaptive_data_DATABASE_URL"

    explicit_url, explicit_source = cli._resolve_database_url(
        "postgres://explicit",
        {"DATABASE_URL": "postgres://ignored"},
    )
    assert explicit_url == "postgres://explicit"
    assert explicit_source == "--database-url"
