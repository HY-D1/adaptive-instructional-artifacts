from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field, field_validator


class SourceDocRecord(BaseModel):
    doc_id: str
    filename: str
    title: str
    sha256: str
    page_count: int = Field(ge=1)
    parser_backend: str
    pipeline_version: str
    run_id: str


class UnitRecord(BaseModel):
    unit_id: str
    doc_id: str
    source_doc_id: str
    concept_id: str
    title: str
    summary: str
    content_markdown: str
    difficulty: str | None = None
    page_start: int = Field(ge=1)
    page_end: int = Field(ge=1)
    parser_backend: str
    pipeline_version: str
    run_id: str
    metadata: dict[str, Any] = Field(default_factory=dict)

    @field_validator("page_end")
    @classmethod
    def validate_page_order(cls, value: int, info):
        start = info.data.get("page_start")
        if isinstance(start, int) and value < start:
            raise ValueError("page_end must be >= page_start")
        return value


class ChunkRecord(BaseModel):
    chunk_id: str
    unit_id: str
    doc_id: str
    source_doc_id: str
    page: int = Field(ge=1)
    chunk_text: str
    embedding: list[float]
    embedding_model: str
    embedding_dimension: int
    parser_backend: str
    pipeline_version: str
    run_id: str
    metadata: dict[str, Any] = Field(default_factory=dict)

    @field_validator("embedding")
    @classmethod
    def validate_embedding(cls, value: list[float], info):
        dim = info.data.get("embedding_dimension")
        if isinstance(dim, int) and len(value) != dim:
            raise ValueError(f"embedding length {len(value)} does not match embedding_dimension {dim}")
        return value


class DiagnosticsRecord(BaseModel):
    run_id: str
    input_path: str
    input_sha256: str
    chapter_range: str
    page_range: str
    page_count: int
    parser_backend: str
    pipeline_version: str
    source_policy: str
    embedding_model: str
    embedding_dimension: int
    mlx_enabled: bool
    mlx_model: str | None = None
    started_at: datetime
    completed_at: datetime
    machine: str
    os: str
    python_version: str
    notes: list[str] = Field(default_factory=list)


class ManifestRecord(BaseModel):
    run_id: str
    schema_version: str
    pipeline_version: str
    source_policy: str
    parser_backend: str
    embedding_model: str
    embedding_dimension: int
    doc_count: int
    unit_count: int
    chunk_count: int
    created_at: datetime
    diagnostics_file: str
    source_docs_file: str
    units_file: str
    chunks_file: str


class BundleRecord(BaseModel):
    manifest: ManifestRecord
    source_docs: list[SourceDocRecord]
    units: list[UnitRecord]
    chunks: list[ChunkRecord]
    diagnostics: DiagnosticsRecord
