from __future__ import annotations

import re
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path

from docling.document_converter import DocumentConverter
from pypdf import PdfReader

from .chunking import chunk_text, embed_texts
from .config import (
    ExtractConfig,
    LOCAL_CORPUS_PIPELINE_VERSION,
    PARSER_BACKEND,
    SOURCE_POLICY,
    chapter_range_to_page_range,
    collect_host_metadata,
    compute_file_sha256,
    generate_run_id,
)
from .mlx_enricher import enrich_text
from .schemas import (
    ChunkRecord,
    DiagnosticsRecord,
    SourceDocRecord,
    UnitRecord,
)


@dataclass(frozen=True)
class ExtractResult:
    source_doc: SourceDocRecord
    units: list[UnitRecord]
    chunks: list[ChunkRecord]
    diagnostics: DiagnosticsRecord


def _slugify(value: str) -> str:
    text = value.strip().lower()
    text = re.sub(r"[^a-z0-9]+", "-", text)
    text = text.strip("-")
    return text or "untitled"


def _split_markdown_sections(markdown: str) -> list[tuple[str, str]]:
    sections: list[tuple[str, str]] = []
    current_title = "Overview"
    current_lines: list[str] = []

    for line in markdown.splitlines():
        if line.startswith("#"):
            if current_lines:
                sections.append((current_title, "\n".join(current_lines).strip()))
            current_title = line.lstrip("# ").strip() or "Untitled"
            current_lines = []
            continue
        current_lines.append(line)

    if current_lines:
        sections.append((current_title, "\n".join(current_lines).strip()))

    return [(title, body) for title, body in sections if body]


def extract_with_docling(config: ExtractConfig) -> ExtractResult:
    started = datetime.now(timezone.utc)
    run_id = generate_run_id(config.input_pdf)

    if not config.input_pdf.exists():
        raise FileNotFoundError(f"input pdf not found: {config.input_pdf}")

    input_sha256 = compute_file_sha256(config.input_pdf)
    page_count = len(PdfReader(str(config.input_pdf)).pages)
    page_start, page_end = chapter_range_to_page_range(
        config.chapter_start,
        config.chapter_end,
        approx_pages_per_chapter=config.approx_pages_per_chapter,
    )
    page_end = min(page_end, page_count)
    max_num_pages = max(1, page_end - page_start + 1)

    converter = DocumentConverter()
    conversion = converter.convert(
        str(config.input_pdf),
        page_range=(page_start, page_end),
        max_num_pages=max_num_pages,
        raises_on_error=False,
    )

    markdown = conversion.document.export_to_markdown() if conversion.document else ""
    markdown = markdown.strip()
    if not markdown:
        raise RuntimeError(
            "Docling conversion produced empty markdown. "
            f"status={conversion.status}, file={config.input_pdf.name}"
        )

    doc_id = _slugify(config.input_pdf.stem)
    source_doc = SourceDocRecord(
        doc_id=doc_id,
        filename=config.input_pdf.name,
        title=config.input_pdf.stem,
        sha256=input_sha256,
        page_count=page_count,
        parser_backend=PARSER_BACKEND,
        pipeline_version=LOCAL_CORPUS_PIPELINE_VERSION,
        run_id=run_id,
    )

    sections = _split_markdown_sections(markdown)
    if not sections:
        sections = [("Overview", markdown)]

    units: list[UnitRecord] = []
    chunks: list[ChunkRecord] = []

    for section_index, (title, body) in enumerate(sections, start=1):
        concept_slug = _slugify(title)
        unit_id = f"{doc_id}/{concept_slug}"
        enrichment = enrich_text(body, enabled=config.mlx_enabled, model=config.mlx_model)

        unit = UnitRecord(
            unit_id=unit_id,
            doc_id=doc_id,
            source_doc_id=doc_id,
            concept_id=unit_id,
            title=title,
            summary=enrichment.summary,
            content_markdown=body,
            difficulty=None,
            page_start=page_start,
            page_end=page_end,
            parser_backend=PARSER_BACKEND,
            pipeline_version=LOCAL_CORPUS_PIPELINE_VERSION,
            run_id=run_id,
            metadata={
                "section_index": section_index,
                "chapter_range": f"{config.chapter_start}-{config.chapter_end}",
                "mlx_backend": enrichment.backend,
                "hint_draft": enrichment.hint_draft,
            },
        )
        units.append(unit)

        windows = chunk_text(body, chunk_words=config.chunk_words, chunk_overlap=config.chunk_overlap)
        if not windows:
            continue

        embeddings, embedding_backend = embed_texts(
            [window.text for window in windows],
            model=config.embedding_model,
            dimension=config.embedding_dimension,
        )

        page_span = max(1, page_end - page_start + 1)
        for idx, window in enumerate(windows):
            rel = idx / max(1, len(windows) - 1)
            approx_page = page_start + int(rel * (page_span - 1))
            chunk_id = f"{unit_id}/chunk-{idx + 1:04d}"
            chunk = ChunkRecord(
                chunk_id=chunk_id,
                unit_id=unit_id,
                doc_id=doc_id,
                source_doc_id=doc_id,
                page=approx_page,
                chunk_text=window.text,
                embedding=embeddings[idx],
                embedding_model=config.embedding_model,
                embedding_dimension=config.embedding_dimension,
                parser_backend=PARSER_BACKEND,
                pipeline_version=LOCAL_CORPUS_PIPELINE_VERSION,
                run_id=run_id,
                metadata={
                    "chunk_index": idx,
                    "section_index": section_index,
                    "embedding_backend": embedding_backend,
                },
            )
            chunks.append(chunk)

    host = collect_host_metadata()
    completed = datetime.now(timezone.utc)
    diagnostics = DiagnosticsRecord(
        run_id=run_id,
        input_path=str(config.input_pdf),
        input_sha256=input_sha256,
        chapter_range=f"{config.chapter_start}-{config.chapter_end}",
        page_range=f"{page_start}-{page_end}",
        page_count=page_count,
        parser_backend=PARSER_BACKEND,
        pipeline_version=LOCAL_CORPUS_PIPELINE_VERSION,
        source_policy=SOURCE_POLICY,
        embedding_model=config.embedding_model,
        embedding_dimension=config.embedding_dimension,
        mlx_enabled=config.mlx_enabled,
        mlx_model=config.mlx_model or None,
        started_at=started,
        completed_at=completed,
        machine=host.machine,
        os=host.os,
        python_version=host.python_version,
        notes=[
            "chapter range uses approximate page mapping",
            f"docling_status={conversion.status}",
            "raw pdf bytes were not emitted to bundle outputs",
        ],
    )

    return ExtractResult(
        source_doc=source_doc,
        units=units,
        chunks=chunks,
        diagnostics=diagnostics,
    )
