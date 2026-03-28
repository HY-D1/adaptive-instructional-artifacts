from __future__ import annotations

import json
import re
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from docling.document_converter import DocumentConverter
from pypdf import PdfReader

from .chunking import clean_extracted_text, chunk_text, embed_texts, is_low_signal_text
from .config import (
    ExtractConfig,
    LOCAL_CORPUS_PIPELINE_VERSION,
    PARSER_BACKEND,
    SOURCE_POLICY,
    chapter_range_to_page_range,
    collect_host_metadata,
    compute_file_sha256,
    ensure_directory,
    generate_run_id,
)
from .mlx_enricher import enrich_text
from .product_fit_rules import (
    UnitForEval,
    compute_noise_score,
    derive_display_summary,
    derive_display_title,
    derive_explanation_context,
    derive_hint_source_excerpt,
)
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
    diagnostics_path: Path
    resolved_input_path: Path


class ExtractFailure(RuntimeError):
    def __init__(self, message: str, *, run_id: str, resolved_input_path: Path, diagnostics_path: Path):
        super().__init__(message)
        self.run_id = run_id
        self.resolved_input_path = resolved_input_path
        self.diagnostics_path = diagnostics_path


def _slugify(value: str) -> str:
    text = value.strip().lower()
    text = re.sub(r"[^a-z0-9]+", "-", text)
    text = text.strip("-")
    return text or "untitled"


def _extract_page_number(label: str) -> int | None:
    match = re.search(r"\bpage\s+(\d+)\b", label, flags=re.IGNORECASE)
    if not match:
        return None
    return int(match.group(1))


def _split_markdown_sections(markdown: str) -> list[tuple[str, str, int | None]]:
    sections: list[tuple[str, str, int | None]] = []
    current_title = "Overview"
    current_lines: list[str] = []
    current_page: int | None = None

    for line in markdown.splitlines():
        if line.startswith("#"):
            if current_lines:
                sections.append((current_title, "\n".join(current_lines).strip(), current_page))
            current_title = line.lstrip("# ").strip() or "Untitled"
            current_page = _extract_page_number(current_title)
            current_lines = []
            continue
        current_lines.append(line)

    if current_lines:
        sections.append((current_title, "\n".join(current_lines).strip(), current_page))

    return [(title, body, page) for title, body, page in sections if body]


def _status_to_text(status: Any) -> str:
    if status is None:
        return "unknown"
    value = getattr(status, "value", None)
    if isinstance(value, str) and value:
        return value
    return str(status)


def _status_is_success(status: Any) -> bool:
    normalized = _status_to_text(status).strip().lower()
    return normalized.endswith("success") or normalized == "success"


def _safe_readable(path: Path) -> bool:
    try:
        with path.open("rb") as handle:
            handle.read(1)
        return True
    except Exception:
        return False


def _run_artifact_dir(run_id: str) -> Path:
    return Path(".local/ingest-runs").resolve() / run_id


def _write_json(path: Path, payload: dict[str, Any]) -> None:
    ensure_directory(path.parent)
    path.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def _write_optional_docling_artifacts(conversion: Any, artifact_dir: Path) -> dict[str, str]:
    artifacts: dict[str, str] = {}
    ensure_directory(artifact_dir)

    if conversion is None:
        return artifacts

    try:
        conversion_payload = conversion.model_dump(mode="json")
        conversion_path = artifact_dir / "docling_conversion.json"
        _write_json(conversion_path, conversion_payload)
        artifacts["docling_conversion"] = str(conversion_path)
    except Exception:
        pass

    document = getattr(conversion, "document", None)
    if document is None:
        return artifacts

    if hasattr(document, "export_to_text"):
        try:
            text_payload = document.export_to_text()
            if isinstance(text_payload, str) and text_payload.strip():
                text_path = artifact_dir / "docling_document_text.txt"
                text_path.write_text(text_payload, encoding="utf-8")
                artifacts["docling_document_text"] = str(text_path)
        except Exception:
            pass

    if hasattr(document, "export_to_doctags"):
        try:
            doctags_payload = document.export_to_doctags()
            if isinstance(doctags_payload, str) and doctags_payload.strip():
                doctags_path = artifact_dir / "docling_document_doctags.txt"
                doctags_path.write_text(doctags_payload, encoding="utf-8")
                artifacts["docling_document_doctags"] = str(doctags_path)
        except Exception:
            pass

    if hasattr(document, "model_dump"):
        try:
            doc_payload = document.model_dump(mode="json")
            doc_path = artifact_dir / "docling_document.json"
            _write_json(doc_path, doc_payload)
            artifacts["docling_document_json"] = str(doc_path)
        except Exception:
            pass

    return artifacts


def _extract_text_with_pymupdf(input_pdf: Path, page_start: int, page_end: int) -> tuple[str, dict[str, Any]]:
    details: dict[str, Any] = {
        "backend": "pymupdf",
        "requested_page_start": page_start,
        "requested_page_end": page_end,
        "status": "not_run",
        "character_count": 0,
        "pages_with_text": 0,
    }

    try:
        import fitz  # type: ignore
    except Exception as exc:
        details["status"] = "backend_unavailable"
        details["error"] = str(exc)
        return "", details

    document = None
    try:
        document = fitz.open(str(input_pdf))
        total_pages = int(getattr(document, "page_count", 0))
        start = max(1, page_start)
        end = min(page_end, total_pages) if total_pages > 0 else page_end
        if end < start:
            details["status"] = "empty_range"
            details["total_pages"] = total_pages
            return "", details

        page_blocks: list[str] = []
        pages_with_text = 0
        for page_number in range(start, end + 1):
            page = document.load_page(page_number - 1)
            page_text = page.get_text("text")
            normalized = page_text.strip() if isinstance(page_text, str) else ""
            if not normalized:
                continue
            pages_with_text += 1
            page_blocks.append(f"## Page {page_number}\n\n{normalized}")

        markdown = "\n\n".join(page_blocks).strip()
        details["status"] = "success" if markdown else "empty"
        details["total_pages"] = total_pages
        details["effective_page_start"] = start
        details["effective_page_end"] = end
        details["character_count"] = len(markdown)
        details["pages_with_text"] = pages_with_text
        return markdown, details
    except Exception as exc:
        details["status"] = "error"
        details["error"] = str(exc)
        return "", details
    finally:
        if document is not None:
            document.close()


def _extract_text_with_pypdf(input_pdf: Path, page_start: int, page_end: int) -> tuple[str, dict[str, Any]]:
    details: dict[str, Any] = {
        "backend": "pypdf",
        "requested_page_start": page_start,
        "requested_page_end": page_end,
        "status": "not_run",
        "character_count": 0,
        "pages_with_text": 0,
    }

    try:
        reader = PdfReader(str(input_pdf))
        total_pages = len(reader.pages)
        start = max(1, page_start)
        end = min(page_end, total_pages) if total_pages > 0 else page_end
        if end < start:
            details["status"] = "empty_range"
            details["total_pages"] = total_pages
            return "", details

        page_blocks: list[str] = []
        pages_with_text = 0
        for page_number in range(start, end + 1):
            page_text = reader.pages[page_number - 1].extract_text() or ""
            normalized = page_text.strip()
            if not normalized:
                continue
            pages_with_text += 1
            page_blocks.append(f"## Page {page_number}\n\n{normalized}")

        markdown = "\n\n".join(page_blocks).strip()
        details["status"] = "success" if markdown else "empty"
        details["total_pages"] = total_pages
        details["effective_page_start"] = start
        details["effective_page_end"] = end
        details["character_count"] = len(markdown)
        details["pages_with_text"] = pages_with_text
        return markdown, details
    except Exception as exc:
        details["status"] = "error"
        details["error"] = str(exc)
        return "", details


def _persist_diagnostics(diagnostics: DiagnosticsRecord, diagnostics_path: Path) -> Path:
    _write_json(diagnostics_path, diagnostics.model_dump(mode="json"))
    return diagnostics_path


def extract_with_docling(config: ExtractConfig) -> ExtractResult:
    started = datetime.now(timezone.utc)
    run_id = generate_run_id(config.input_pdf)
    resolved_input = config.input_pdf.expanduser().resolve()
    diagnostics_dir = _run_artifact_dir(run_id)
    diagnostics_path = diagnostics_dir / "diagnostics.json"

    chapter_page_start, chapter_page_end = chapter_range_to_page_range(
        config.chapter_start,
        config.chapter_end,
        approx_pages_per_chapter=config.approx_pages_per_chapter,
    )

    preflight: dict[str, Any] = {
        "resolved_input_path": str(resolved_input),
        "exists": resolved_input.exists(),
        "readable": False,
        "size_bytes": 0,
        "size_nonzero": False,
        "pdf_page_count": None,
        "errors": [],
    }

    input_sha256 = ""
    page_count = 0

    if preflight["exists"]:
        preflight["readable"] = _safe_readable(resolved_input)
        try:
            size_bytes = int(resolved_input.stat().st_size)
        except Exception as exc:
            size_bytes = 0
            preflight["errors"].append(f"stat_failed:{exc}")
        preflight["size_bytes"] = size_bytes
        preflight["size_nonzero"] = size_bytes > 0

        if preflight["readable"] and preflight["size_nonzero"]:
            try:
                page_count = len(PdfReader(str(resolved_input)).pages)
                preflight["pdf_page_count"] = page_count
            except Exception as exc:
                preflight["errors"].append(f"pypdf_page_count_failed:{exc}")
            try:
                input_sha256 = compute_file_sha256(resolved_input)
            except Exception as exc:
                preflight["errors"].append(f"sha256_failed:{exc}")
    else:
        preflight["errors"].append("input_missing")

    if not preflight["readable"]:
        preflight["errors"].append("input_not_readable")
    if not preflight["size_nonzero"]:
        preflight["errors"].append("input_empty")
    if preflight.get("pdf_page_count") is None:
        preflight["errors"].append("pdf_page_count_unavailable")

    effective_page_start = chapter_page_start
    effective_page_end = chapter_page_end
    if page_count > 0:
        effective_page_end = min(chapter_page_end, page_count)

    if page_count > 0 and effective_page_start > page_count:
        preflight["errors"].append("page_range_starts_after_document")

    preflight["requested_page_range"] = {
        "start": chapter_page_start,
        "end": chapter_page_end,
    }
    preflight["effective_page_range"] = {
        "start": effective_page_start,
        "end": effective_page_end,
    }

    docling_details: dict[str, Any] = {
        "status": "not_run",
        "errors": [],
        "error_count": 0,
        "timings": {},
        "markdown_char_count": 0,
    }
    fallback_details: dict[str, Any] = {
        "triggered": False,
        "selected_backend": None,
        "attempts": [],
    }
    artifacts: dict[str, Any] = {
        "run_directory": str(diagnostics_dir),
    }

    host = collect_host_metadata()

    if preflight["errors"]:
        diagnostics = DiagnosticsRecord(
            run_id=run_id,
            input_path=str(resolved_input),
            input_sha256=input_sha256,
            chapter_range=f"{config.chapter_start}-{config.chapter_end}",
            page_range=f"{effective_page_start}-{effective_page_end}",
            page_count=page_count,
            parser_backend=PARSER_BACKEND,
            pipeline_version=LOCAL_CORPUS_PIPELINE_VERSION,
            source_policy=SOURCE_POLICY,
            embedding_model=config.embedding_model,
            embedding_dimension=config.embedding_dimension,
            mlx_enabled=config.mlx_enabled,
            mlx_model=config.mlx_model or None,
            started_at=started,
            completed_at=datetime.now(timezone.utc),
            machine=host.machine,
            os=host.os,
            python_version=host.python_version,
            preflight=preflight,
            docling=docling_details,
            fallback=fallback_details,
            artifacts=artifacts,
            notes=[
                "preflight_failed",
                "raw pdf bytes were not emitted to bundle outputs",
            ],
        )
        _persist_diagnostics(diagnostics, diagnostics_path)
        raise ExtractFailure(
            "Preflight validation failed",
            run_id=run_id,
            resolved_input_path=resolved_input,
            diagnostics_path=diagnostics_path,
        )

    converter = DocumentConverter()
    conversion = converter.convert(
        str(resolved_input),
        page_range=(effective_page_start, effective_page_end),
        max_num_pages=max(1, effective_page_end - effective_page_start + 1),
        raises_on_error=False,
    )

    conversion_status = getattr(conversion, "status", None)
    conversion_errors = list(getattr(conversion, "errors", []) or [])
    conversion_timings = getattr(conversion, "timings", {})
    conversion_document = getattr(conversion, "document", None)
    markdown = conversion_document.export_to_markdown() if conversion_document else ""
    markdown = markdown.strip() if isinstance(markdown, str) else ""

    docling_details = {
        "status": _status_to_text(conversion_status),
        "errors": [str(error) for error in conversion_errors],
        "error_count": len(conversion_errors),
        "timings": conversion_timings if isinstance(conversion_timings, dict) else str(conversion_timings),
        "markdown_char_count": len(markdown),
    }

    parser_backend = PARSER_BACKEND
    selected_markdown = markdown

    if not markdown:
        docling_artifacts = _write_optional_docling_artifacts(conversion, diagnostics_dir)
        if docling_artifacts:
            artifacts.update(docling_artifacts)

    if (not _status_is_success(conversion_status)) or not markdown:
        fallback_details["triggered"] = True

        pymupdf_markdown, pymupdf_attempt = _extract_text_with_pymupdf(
            resolved_input,
            effective_page_start,
            effective_page_end,
        )
        fallback_details["attempts"].append(pymupdf_attempt)

        if pymupdf_markdown:
            selected_markdown = pymupdf_markdown
            parser_backend = "docling_fallback_pymupdf"
            fallback_details["selected_backend"] = "pymupdf"
        else:
            pypdf_markdown, pypdf_attempt = _extract_text_with_pypdf(
                resolved_input,
                effective_page_start,
                effective_page_end,
            )
            fallback_details["attempts"].append(pypdf_attempt)

            if pypdf_markdown:
                selected_markdown = pypdf_markdown
                parser_backend = "docling_fallback_pypdf"
                fallback_details["selected_backend"] = "pypdf"

    if not selected_markdown:
        diagnostics = DiagnosticsRecord(
            run_id=run_id,
            input_path=str(resolved_input),
            input_sha256=input_sha256,
            chapter_range=f"{config.chapter_start}-{config.chapter_end}",
            page_range=f"{effective_page_start}-{effective_page_end}",
            page_count=page_count,
            parser_backend=parser_backend,
            pipeline_version=LOCAL_CORPUS_PIPELINE_VERSION,
            source_policy=SOURCE_POLICY,
            embedding_model=config.embedding_model,
            embedding_dimension=config.embedding_dimension,
            mlx_enabled=config.mlx_enabled,
            mlx_model=config.mlx_model or None,
            started_at=started,
            completed_at=datetime.now(timezone.utc),
            machine=host.machine,
            os=host.os,
            python_version=host.python_version,
            preflight=preflight,
            docling=docling_details,
            fallback=fallback_details,
            artifacts=artifacts,
            notes=[
                f"docling_status={docling_details['status']}",
                "fallback_failed_or_empty",
                "raw pdf bytes were not emitted to bundle outputs",
            ],
        )
        _persist_diagnostics(diagnostics, diagnostics_path)
        raise ExtractFailure(
            "No extractable markdown produced by docling or fallbacks",
            run_id=run_id,
            resolved_input_path=resolved_input,
            diagnostics_path=diagnostics_path,
        )

    doc_id = _slugify(resolved_input.stem)
    source_doc = SourceDocRecord(
        doc_id=doc_id,
        filename=resolved_input.name,
        title=resolved_input.stem,
        sha256=input_sha256,
        page_count=page_count,
        parser_backend=parser_backend,
        pipeline_version=LOCAL_CORPUS_PIPELINE_VERSION,
        run_id=run_id,
    )

    sections = _split_markdown_sections(selected_markdown)
    if not sections:
        sections = [("Overview", selected_markdown, None)]

    units: list[UnitRecord] = []
    chunks: list[ChunkRecord] = []
    dropped_low_signal_sections = 0

    for section_index, (title, raw_body, section_page) in enumerate(sections, start=1):
        body = clean_extracted_text(raw_body)
        if not body:
            dropped_low_signal_sections += 1
            continue
        if is_low_signal_text(body) and not re.search(
            r"\b(select|from|where|join|database|dbms|query|relation|schema)\b",
            body,
            flags=re.IGNORECASE,
        ):
            dropped_low_signal_sections += 1
            continue

        concept_slug = _slugify(title)
        unit_id = f"{doc_id}/{concept_slug}"
        enrichment = enrich_text(body, enabled=config.mlx_enabled, model=config.mlx_model)
        if section_page is not None and effective_page_start <= section_page <= effective_page_end:
            unit_page_start = section_page
            unit_page_end = section_page
        else:
            unit_page_start = effective_page_start
            unit_page_end = effective_page_end

        unit_seed = UnitForEval(
            unit_id=unit_id,
            title=title,
            summary=enrichment.summary,
            content_markdown=body,
            page_start=unit_page_start,
            page_end=unit_page_end,
        )
        display_title = derive_display_title(unit_seed)
        display_summary = derive_display_summary(unit_seed)
        hint_source_excerpt = derive_hint_source_excerpt(unit_seed)
        explanation_context = derive_explanation_context(unit_seed)
        noise_score = round(compute_noise_score(f"{enrichment.summary} {body}"), 4)
        quality_flags: list[str] = []
        if re.fullmatch(r"Page\s+\d+", title, flags=re.IGNORECASE):
            quality_flags.append("generic_title")
        if noise_score >= 0.5:
            quality_flags.append("high_noise")
        if is_low_signal_text(body):
            quality_flags.append("low_signal_body")

        windows = chunk_text(body, chunk_words=config.chunk_words, chunk_overlap=config.chunk_overlap)
        if not windows:
            continue

        unit = UnitRecord(
            unit_id=unit_id,
            doc_id=doc_id,
            source_doc_id=doc_id,
            concept_id=unit_id,
            title=title,
            summary=enrichment.summary,
            content_markdown=body,
            difficulty=None,
            page_start=unit_page_start,
            page_end=unit_page_end,
            parser_backend=parser_backend,
            pipeline_version=LOCAL_CORPUS_PIPELINE_VERSION,
            run_id=run_id,
            metadata={
                "section_index": section_index,
                "chapter_range": f"{config.chapter_start}-{config.chapter_end}",
                "mlx_backend": enrichment.backend,
                "hint_draft": enrichment.hint_draft,
                "display_title": display_title,
                "display_summary": display_summary,
                "hint_source_excerpt": hint_source_excerpt,
                "explanation_context": explanation_context,
                "quality_flags": quality_flags,
                "noise_score": noise_score,
                "product_fit_score": round(max(0.0, 1.0 - noise_score), 4),
            },
        )
        units.append(unit)

        embeddings, embedding_backend = embed_texts(
            [window.text for window in windows],
            model=config.embedding_model,
            dimension=config.embedding_dimension,
        )

        page_span = max(1, unit_page_end - unit_page_start + 1)
        for idx, window in enumerate(windows):
            rel = idx / max(1, len(windows) - 1)
            approx_page = unit_page_start + int(rel * (page_span - 1))
            chunk_quality_flags: list[str] = []
            if len(window.text) < 60:
                chunk_quality_flags.append("too_short_for_hints")
            if len(window.text) > 1400:
                chunk_quality_flags.append("too_long_for_hints")
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
                parser_backend=parser_backend,
                pipeline_version=LOCAL_CORPUS_PIPELINE_VERSION,
                run_id=run_id,
                metadata={
                    "chunk_index": idx,
                    "section_index": section_index,
                    "embedding_backend": embedding_backend,
                    "hintable_span": window.text[:180],
                    "quality_flags": chunk_quality_flags,
                },
            )
            chunks.append(chunk)

    completed = datetime.now(timezone.utc)
    diagnostics = DiagnosticsRecord(
        run_id=run_id,
        input_path=str(resolved_input),
        input_sha256=input_sha256,
        chapter_range=f"{config.chapter_start}-{config.chapter_end}",
        page_range=f"{effective_page_start}-{effective_page_end}",
        page_count=page_count,
        parser_backend=parser_backend,
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
        preflight=preflight,
        docling=docling_details,
        fallback=fallback_details,
        artifacts=artifacts,
        notes=[
            "chapter range uses approximate page mapping",
            f"docling_status={docling_details['status']}",
            f"dropped_low_signal_sections={dropped_low_signal_sections}",
            "raw pdf bytes were not emitted to bundle outputs",
        ],
    )
    _persist_diagnostics(diagnostics, diagnostics_path)

    return ExtractResult(
        source_doc=source_doc,
        units=units,
        chunks=chunks,
        diagnostics=diagnostics,
        diagnostics_path=diagnostics_path,
        resolved_input_path=resolved_input,
    )
