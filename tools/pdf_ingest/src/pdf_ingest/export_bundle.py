from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterable

from .config import LOCAL_CORPUS_PIPELINE_VERSION, SOURCE_POLICY, ensure_directory
from .schemas import (
    BundleRecord,
    ChunkRecord,
    DiagnosticsRecord,
    ManifestRecord,
    SourceDocRecord,
    UnitRecord,
)


def _write_json(path: Path, payload: dict) -> None:
    path.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def _write_jsonl(path: Path, rows: Iterable[dict]) -> None:
    with path.open("w", encoding="utf-8") as f:
        for row in rows:
            f.write(json.dumps(row, ensure_ascii=False) + "\n")


def write_bundle(
    output_dir: Path,
    source_doc: SourceDocRecord,
    units: list[UnitRecord],
    chunks: list[ChunkRecord],
    diagnostics: DiagnosticsRecord,
) -> BundleRecord:
    ensure_directory(output_dir)

    source_docs_path = output_dir / "source_docs.json"
    units_path = output_dir / "units.jsonl"
    chunks_path = output_dir / "chunks.jsonl"
    diagnostics_path = output_dir / "diagnostics.json"
    manifest_path = output_dir / "manifest.json"

    _write_json(source_docs_path, {"docs": [source_doc.model_dump(mode="json")]})
    _write_jsonl(units_path, [unit.model_dump(mode="json") for unit in units])
    _write_jsonl(chunks_path, [chunk.model_dump(mode="json") for chunk in chunks])
    _write_json(diagnostics_path, diagnostics.model_dump(mode="json"))

    manifest = ManifestRecord(
        run_id=diagnostics.run_id,
        schema_version="local-corpus-bundle-v1",
        pipeline_version=LOCAL_CORPUS_PIPELINE_VERSION,
        source_policy=SOURCE_POLICY,
        parser_backend=source_doc.parser_backend,
        embedding_model=diagnostics.embedding_model,
        embedding_dimension=diagnostics.embedding_dimension,
        doc_count=1,
        unit_count=len(units),
        chunk_count=len(chunks),
        created_at=datetime.now(timezone.utc),
        diagnostics_file=diagnostics_path.name,
        source_docs_file=source_docs_path.name,
        units_file=units_path.name,
        chunks_file=chunks_path.name,
    )

    _write_json(manifest_path, manifest.model_dump(mode="json"))

    bundle = BundleRecord(
        manifest=manifest,
        source_docs=[source_doc],
        units=units,
        chunks=chunks,
        diagnostics=diagnostics,
    )
    return bundle


def load_bundle(bundle_dir: Path) -> BundleRecord:
    manifest = ManifestRecord.model_validate_json((bundle_dir / "manifest.json").read_text(encoding="utf-8"))
    source_docs_payload = json.loads((bundle_dir / manifest.source_docs_file).read_text(encoding="utf-8"))
    diagnostics = DiagnosticsRecord.model_validate_json(
        (bundle_dir / manifest.diagnostics_file).read_text(encoding="utf-8")
    )

    units: list[UnitRecord] = []
    for line in (bundle_dir / manifest.units_file).read_text(encoding="utf-8").splitlines():
        if line.strip():
            units.append(UnitRecord.model_validate_json(line))

    chunks: list[ChunkRecord] = []
    for line in (bundle_dir / manifest.chunks_file).read_text(encoding="utf-8").splitlines():
        if line.strip():
            chunks.append(ChunkRecord.model_validate_json(line))

    source_docs = [SourceDocRecord.model_validate(doc) for doc in source_docs_payload.get("docs", [])]
    bundle = BundleRecord(
        manifest=manifest,
        source_docs=source_docs,
        units=units,
        chunks=chunks,
        diagnostics=diagnostics,
    )
    return bundle
