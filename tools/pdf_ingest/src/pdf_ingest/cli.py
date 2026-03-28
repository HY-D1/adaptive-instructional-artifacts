from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path
from typing import Mapping

import psycopg

from .config import (
    DEFAULT_EMBEDDING_DIMENSION,
    DEFAULT_EMBEDDING_MODEL,
    ExtractConfig,
    LOCAL_CORPUS_PIPELINE_VERSION,
    SOURCE_POLICY,
    UploadConfig,
    parse_chapter_range,
)
from .docling_pipeline import ExtractFailure, extract_with_docling
from .export_bundle import load_bundle, write_bundle

DB_ENV_PRIORITY = (
    "DATABASE_URL",
    "NEON_DATABASE_URL",
    "adaptive_data_DATABASE_URL",
    "adaptive_data_POSTGRES_URL",
)


def _parse_bool(value: str) -> bool:
    normalized = value.strip().lower()
    if normalized in {"1", "true", "yes", "y", "on"}:
        return True
    if normalized in {"0", "false", "no", "n", "off"}:
        return False
    raise ValueError(f"invalid boolean value: {value}")


def _vector_literal(values: list[float]) -> str:
    return "[" + ",".join(f"{v:.8f}" for v in values) + "]"


def _ensure_corpus_schema(conn: psycopg.Connection) -> None:
    with conn.cursor() as cur:
        cur.execute("CREATE EXTENSION IF NOT EXISTS vector")
        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS corpus_documents (
              doc_id TEXT PRIMARY KEY,
              title TEXT NOT NULL,
              filename TEXT NOT NULL,
              sha256 TEXT NOT NULL,
              page_count INT NOT NULL,
              parser_backend TEXT NOT NULL,
              pipeline_version TEXT NOT NULL,
              run_id TEXT,
              created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
              UNIQUE (doc_id, sha256, pipeline_version)
            )
            """
        )
        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS corpus_units (
              unit_id TEXT PRIMARY KEY,
              doc_id TEXT NOT NULL REFERENCES corpus_documents(doc_id) ON DELETE CASCADE,
              concept_id TEXT,
              title TEXT NOT NULL,
              summary TEXT NOT NULL,
              content_markdown TEXT NOT NULL,
              difficulty TEXT,
              page_start INT NOT NULL,
              page_end INT NOT NULL,
              parser_backend TEXT NOT NULL,
              pipeline_version TEXT NOT NULL,
              run_id TEXT,
              metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
              created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
            """
        )
        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS corpus_chunks (
              chunk_id TEXT PRIMARY KEY,
              unit_id TEXT NOT NULL REFERENCES corpus_units(unit_id) ON DELETE CASCADE,
              doc_id TEXT NOT NULL REFERENCES corpus_documents(doc_id) ON DELETE CASCADE,
              page INT NOT NULL,
              chunk_text TEXT NOT NULL,
              embedding vector(768) NOT NULL,
              embedding_model TEXT NOT NULL,
              parser_backend TEXT NOT NULL,
              pipeline_version TEXT NOT NULL,
              run_id TEXT,
              metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
              created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
            """
        )
        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS corpus_ingest_runs (
              run_id TEXT PRIMARY KEY,
              source_policy TEXT NOT NULL,
              parser_backend TEXT NOT NULL,
              embedding_backend TEXT NOT NULL,
              embedding_model TEXT NOT NULL,
              embedding_dimension INT NOT NULL,
              mlx_model TEXT,
              pipeline_version TEXT NOT NULL,
              diagnostics JSONB NOT NULL,
              created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
            """
        )


def _resolve_database_url(
    explicit_database_url: str = "",
    env: Mapping[str, str | None] = os.environ,
) -> tuple[str, str | None]:
    explicit = (explicit_database_url or "").strip()
    if explicit:
        return explicit, "--database-url"

    for key in DB_ENV_PRIORITY:
        value = (env.get(key) or "").strip()
        if value:
            return value, key
    return "", None


def cmd_doctor(_args: argparse.Namespace) -> int:
    print(f"LOCAL_CORPUS_PIPELINE_VERSION={LOCAL_CORPUS_PIPELINE_VERSION}")
    print(f"source_policy={SOURCE_POLICY}")
    try:
        import docling  # noqa: F401
        print("docling=ok")
    except Exception as exc:
        print(f"docling=error:{exc}")
        return 1

    try:
        import mlx  # noqa: F401
        print("mlx=ok")
    except Exception as exc:
        print(f"mlx=error:{exc}")
        return 1

    try:
        from mlx_lm import load  # noqa: F401
        print("mlx_lm=ok")
    except Exception as exc:
        print(f"mlx_lm=warning:{exc}")

    return 0


def cmd_extract(args: argparse.Namespace) -> int:
    chapter_start, chapter_end = parse_chapter_range(args.chapter_range)
    config = ExtractConfig(
        input_pdf=Path(args.input).expanduser().resolve(),
        output_dir=Path(args.output).expanduser().resolve(),
        chapter_start=chapter_start,
        chapter_end=chapter_end,
        mlx_enabled=_parse_bool(str(args.mlx_enabled)),
        mlx_model=args.mlx_model,
        embedding_model=args.embedding_model,
        embedding_dimension=args.embedding_dimension,
    )

    print(json.dumps({
        "resolved_input_path": str(config.input_pdf),
    }, indent=2))

    try:
        result = extract_with_docling(config)
    except ExtractFailure as exc:
        print(json.dumps({
            "run_id": exc.run_id,
            "resolved_input_path": str(exc.resolved_input_path),
            "diagnostics_path": str(exc.diagnostics_path),
        }, indent=2))
        print(f"error: {exc}", file=sys.stderr)
        return 1

    bundle = write_bundle(
        output_dir=config.output_dir,
        source_doc=result.source_doc,
        units=result.units,
        chunks=result.chunks,
        diagnostics=result.diagnostics,
    )

    print(json.dumps({
        "run_id": bundle.manifest.run_id,
        "output_dir": str(config.output_dir),
        "doc_count": bundle.manifest.doc_count,
        "unit_count": bundle.manifest.unit_count,
        "chunk_count": bundle.manifest.chunk_count,
        "embedding_model": bundle.manifest.embedding_model,
        "embedding_dimension": bundle.manifest.embedding_dimension,
        "resolved_input_path": str(result.resolved_input_path),
        "diagnostics_path": str(result.diagnostics_path),
        "parser_backend": result.source_doc.parser_backend,
    }, indent=2))
    return 0


def cmd_upload(args: argparse.Namespace) -> int:
    database_url, database_env_source = _resolve_database_url(args.database_url)
    cfg = UploadConfig(
        bundle_dir=Path(args.bundle).expanduser().resolve(),
        database_url=database_url,
    )
    if not cfg.database_url:
        raise ValueError(
            "--database-url or one of "
            + ", ".join(DB_ENV_PRIORITY)
            + " is required"
        )

    bundle = load_bundle(cfg.bundle_dir)
    embedding_backends = {
        chunk.metadata.get("embedding_backend", "unknown")
        for chunk in bundle.chunks
    }

    with psycopg.connect(cfg.database_url, autocommit=True) as conn:
        _ensure_corpus_schema(conn)
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO corpus_ingest_runs (
                  run_id, source_policy, parser_backend, embedding_backend,
                  embedding_model, embedding_dimension, mlx_model,
                  pipeline_version, diagnostics
                ) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s::jsonb)
                ON CONFLICT (run_id) DO UPDATE
                SET diagnostics = EXCLUDED.diagnostics
                """,
                (
                    bundle.diagnostics.run_id,
                    bundle.diagnostics.source_policy,
                    bundle.diagnostics.parser_backend,
                    ",".join(sorted(str(x) for x in embedding_backends)),
                    bundle.diagnostics.embedding_model,
                    bundle.diagnostics.embedding_dimension,
                    bundle.diagnostics.mlx_model,
                    bundle.diagnostics.pipeline_version,
                    json.dumps(bundle.diagnostics.model_dump(mode="json")),
                ),
            )

            for doc in bundle.source_docs:
                cur.execute(
                    """
                    INSERT INTO corpus_documents (
                      doc_id, title, filename, sha256, page_count,
                      parser_backend, pipeline_version, run_id
                    ) VALUES (%s,%s,%s,%s,%s,%s,%s,%s)
                    ON CONFLICT (doc_id) DO UPDATE
                    SET title = EXCLUDED.title,
                        filename = EXCLUDED.filename,
                        sha256 = EXCLUDED.sha256,
                        page_count = EXCLUDED.page_count,
                        parser_backend = EXCLUDED.parser_backend,
                        pipeline_version = EXCLUDED.pipeline_version,
                        run_id = EXCLUDED.run_id
                    """,
                    (
                        doc.doc_id,
                        doc.title,
                        doc.filename,
                        doc.sha256,
                        doc.page_count,
                        doc.parser_backend,
                        doc.pipeline_version,
                        doc.run_id,
                    ),
                )

            for unit in bundle.units:
                cur.execute(
                    """
                    INSERT INTO corpus_units (
                      unit_id, doc_id, concept_id, title, summary,
                      content_markdown, difficulty, page_start, page_end,
                      parser_backend, pipeline_version, run_id, metadata
                    ) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s::jsonb)
                    ON CONFLICT (unit_id) DO UPDATE
                    SET summary = EXCLUDED.summary,
                        content_markdown = EXCLUDED.content_markdown,
                        page_start = EXCLUDED.page_start,
                        page_end = EXCLUDED.page_end,
                        run_id = EXCLUDED.run_id,
                        metadata = EXCLUDED.metadata
                    """,
                    (
                        unit.unit_id,
                        unit.doc_id,
                        unit.concept_id,
                        unit.title,
                        unit.summary,
                        unit.content_markdown,
                        unit.difficulty,
                        unit.page_start,
                        unit.page_end,
                        unit.parser_backend,
                        unit.pipeline_version,
                        unit.run_id,
                        json.dumps(unit.metadata),
                    ),
                )

            for chunk in bundle.chunks:
                cur.execute(
                    """
                    INSERT INTO corpus_chunks (
                      chunk_id, unit_id, doc_id, page, chunk_text, embedding,
                      embedding_model, parser_backend, pipeline_version,
                      run_id, metadata
                    ) VALUES (%s,%s,%s,%s,%s,%s::vector,%s,%s,%s,%s,%s::jsonb)
                    ON CONFLICT (chunk_id) DO UPDATE
                    SET chunk_text = EXCLUDED.chunk_text,
                        embedding = EXCLUDED.embedding,
                        page = EXCLUDED.page,
                        run_id = EXCLUDED.run_id,
                        metadata = EXCLUDED.metadata
                    """,
                    (
                        chunk.chunk_id,
                        chunk.unit_id,
                        chunk.doc_id,
                        chunk.page,
                        chunk.chunk_text,
                        _vector_literal(chunk.embedding),
                        chunk.embedding_model,
                        chunk.parser_backend,
                        chunk.pipeline_version,
                        chunk.run_id,
                        json.dumps(chunk.metadata),
                    ),
                )

    print(json.dumps({
        "run_id": bundle.manifest.run_id,
        "docs_uploaded": len(bundle.source_docs),
        "units_uploaded": len(bundle.units),
        "chunks_uploaded": len(bundle.chunks),
        "bundle_dir": str(cfg.bundle_dir),
        "database_env_source": database_env_source,
    }, indent=2))
    return 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="pdf_ingest.cli")
    subparsers = parser.add_subparsers(dest="command", required=True)

    doctor = subparsers.add_parser("doctor", help="verify local toolchain")
    doctor.set_defaults(func=cmd_doctor)

    extract = subparsers.add_parser("extract", help="extract local PDF into processed bundle")
    extract.add_argument("--input", required=True)
    extract.add_argument("--output", required=True)
    extract.add_argument("--chapter-range", required=True)
    extract.add_argument("--mlx-enabled", default="false")
    extract.add_argument("--mlx-model", default="")
    extract.add_argument("--embedding-model", default=DEFAULT_EMBEDDING_MODEL)
    extract.add_argument("--embedding-dimension", type=int, default=DEFAULT_EMBEDDING_DIMENSION)
    extract.set_defaults(func=cmd_extract)

    upload = subparsers.add_parser("upload", help="upload processed bundle to Neon")
    upload.add_argument("--bundle", required=True)
    upload.add_argument("--database-url", default="")
    upload.set_defaults(func=cmd_upload)

    return parser


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    try:
        return int(args.func(args))
    except Exception as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
