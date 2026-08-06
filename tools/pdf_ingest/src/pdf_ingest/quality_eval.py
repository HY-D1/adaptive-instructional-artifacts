from __future__ import annotations

import argparse
import json
import os
import re
from collections import defaultdict
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from urllib import error as url_error
from urllib import parse as url_parse
from urllib import request as url_request

import psycopg

from .product_fit_rules import (
    PRODUCT_FIT_EVAL_VERSION,
    SURFACE_THRESHOLDS,
    ChunkForEval,
    UnitForEval,
    UnitProductFitResult,
    evaluate_unit,
    gate_results,
    near_duplicate_chunk_ids,
    result_quality_flags,
)

DB_ENV_PRIORITY = (
    "DATABASE_URL",
    "NEON_DATABASE_URL",
    "adaptive_data_DATABASE_URL",
    "adaptive_data_POSTGRES_URL",
)


@dataclass(frozen=True)
class CorpusRows:
    units: list[UnitForEval]
    chunks_by_unit: dict[str, list[ChunkForEval]]


@dataclass(frozen=True)
class CorpusSources:
    neon: dict[str, Any]
    bundle: dict[str, Any]
    api: dict[str, Any]


def _read_env_file(path: Path) -> dict[str, str]:
    if not path.exists():
        return {}
    values: dict[str, str] = {}
    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        if key:
            values[key] = value
    return values


def _resolve_database_url(explicit_database_url: str = "") -> tuple[str, str | None]:
    explicit = explicit_database_url.strip()
    if explicit:
        return explicit, "--database-url"

    for key in DB_ENV_PRIORITY:
        value = (os.getenv(key) or "").strip()
        if value:
            return value, key

    repo_root = Path.cwd()
    merged_file_env: dict[str, str] = {}
    for candidate in (repo_root / ".env.local", repo_root / ".env.development.local"):
        merged_file_env.update(_read_env_file(candidate))
    for key in DB_ENV_PRIORITY:
        value = (merged_file_env.get(key) or "").strip()
        if value:
            return value, f"{key} (from .env file)"
    return "", None


def _read_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def _read_jsonl(path: Path) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    if not path.exists():
        return rows
    for line in path.read_text(encoding="utf-8").splitlines():
        raw = line.strip()
        if not raw:
            continue
        rows.append(json.loads(raw))
    return rows


def load_bundle_rows(bundle_dir: Path, *, doc_id: str, run_id: str) -> tuple[CorpusRows, dict[str, Any]]:
    if not bundle_dir.exists():
        return CorpusRows(units=[], chunks_by_unit={}), {
            "present": False,
            "bundleDir": str(bundle_dir),
            "unitCount": 0,
            "chunkCount": 0,
            "matchDocId": False,
            "matchRunId": False,
        }

    manifest_path = bundle_dir / "manifest.json"
    units_path = bundle_dir / "units.jsonl"
    chunks_path = bundle_dir / "chunks.jsonl"

    manifest = _read_json(manifest_path) if manifest_path.exists() else {}
    unit_rows = _read_jsonl(units_path)
    chunk_rows = _read_jsonl(chunks_path)

    filtered_units = [
        row
        for row in unit_rows
        if row.get("doc_id") == doc_id and row.get("run_id") == run_id
    ]
    filtered_chunks = [
        row
        for row in chunk_rows
        if row.get("doc_id") == doc_id and row.get("run_id") == run_id
    ]

    rows = rows_to_eval(filtered_units, filtered_chunks)
    evidence = {
        "present": True,
        "bundleDir": str(bundle_dir),
        "manifestRunId": manifest.get("run_id"),
        "manifestDocCount": manifest.get("doc_count"),
        "unitCount": len(filtered_units),
        "chunkCount": len(filtered_chunks),
        "matchDocId": len(filtered_units) > 0,
        "matchRunId": manifest.get("run_id") == run_id,
    }
    return rows, evidence


def load_neon_rows(
    *,
    doc_id: str,
    run_id: str,
    database_url: str,
) -> tuple[CorpusRows, dict[str, Any]]:
    if not database_url:
        return CorpusRows(units=[], chunks_by_unit={}), {
            "connected": False,
            "reason": "database_url_missing",
            "unitCount": 0,
            "chunkCount": 0,
        }

    with psycopg.connect(database_url, autocommit=True) as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT
                  unit_id,
                  title,
                  summary,
                  content_markdown,
                  page_start,
                  page_end
                FROM corpus_units
                WHERE doc_id = %s AND run_id = %s
                ORDER BY page_start ASC, page_end ASC, unit_id ASC
                """,
                (doc_id, run_id),
            )
            units = cur.fetchall()

            cur.execute(
                """
                SELECT
                  chunk_id,
                  unit_id,
                  page,
                  chunk_text
                FROM corpus_chunks
                WHERE doc_id = %s AND run_id = %s
                ORDER BY page ASC, chunk_id ASC
                """,
                (doc_id, run_id),
            )
            chunks = cur.fetchall()

    unit_rows = [
        {
            "unit_id": row[0],
            "title": row[1],
            "summary": row[2],
            "content_markdown": row[3],
            "page_start": row[4],
            "page_end": row[5],
        }
        for row in units
    ]
    chunk_rows = [
        {
            "chunk_id": row[0],
            "unit_id": row[1],
            "page": row[2],
            "chunk_text": row[3],
        }
        for row in chunks
    ]

    rows = rows_to_eval(unit_rows, chunk_rows)
    evidence = {
        "connected": True,
        "unitCount": len(unit_rows),
        "chunkCount": len(chunk_rows),
        "docId": doc_id,
        "runId": run_id,
    }
    return rows, evidence


def _api_json(url: str, method: str = "GET", payload: dict[str, Any] | None = None) -> tuple[int, dict[str, Any] | None]:
    data = None
    headers = {"Accept": "application/json"}
    if payload is not None:
        headers["Content-Type"] = "application/json"
        data = json.dumps(payload).encode("utf-8")
    req = url_request.Request(url, data=data, method=method, headers=headers)

    try:
        with url_request.urlopen(req, timeout=30) as response:
            body = response.read().decode("utf-8")
            parsed = json.loads(body) if body else None
            return int(response.status), parsed
    except url_error.HTTPError as exc:
        body = exc.read().decode("utf-8") if exc.fp is not None else ""
        parsed = json.loads(body) if body else None
        return int(exc.code), parsed
    except Exception:
        return 0, None


def load_api_evidence(*, api_base_url: str, doc_id: str, run_id: str) -> dict[str, Any]:
    base = api_base_url.rstrip("/")
    manifest_url = f"{base}/api/corpus/manifest"
    unit_url = f"{base}/api/corpus/unit/{url_parse.quote(doc_id + '/page-50', safe='')}"
    search_url = f"{base}/api/corpus/search"

    manifest_status, manifest_payload = _api_json(manifest_url)
    unit_status, unit_payload = _api_json(unit_url)
    search_status, search_payload = _api_json(
        search_url,
        method="POST",
        payload={"query": "data independence", "limit": 5},
    )

    documents = (((manifest_payload or {}).get("data") or {}).get("documents") or [])
    units = (((manifest_payload or {}).get("data") or {}).get("units") or [])

    matching_docs = [d for d in documents if d.get("docId") == doc_id and d.get("runId") == run_id]

    return {
        "baseUrl": base,
        "manifestStatus": manifest_status,
        "unitStatus": unit_status,
        "searchStatus": search_status,
        "manifestDocuments": len(documents),
        "manifestUnits": len(units),
        "manifestMatchCount": len(matching_docs),
        "unitChunkCount": len((((unit_payload or {}).get("data") or {}).get("chunks") or [])),
        "searchResultCount": len((((search_payload or {}).get("data") or {}).get("results") or [])),
    }


def load_api_rows(*, api_base_url: str, doc_id: str, run_id: str) -> tuple[CorpusRows, dict[str, Any]]:
    base = api_base_url.rstrip("/")
    manifest_url = f"{base}/api/corpus/manifest"
    manifest_status, manifest_payload = _api_json(manifest_url)
    units_payload = (((manifest_payload or {}).get("data") or {}).get("units") or [])
    filtered_units = [
        unit for unit in units_payload
        if unit.get("docId") == doc_id and unit.get("runId") == run_id
    ]

    chunk_rows: list[dict[str, Any]] = []
    for unit in filtered_units:
        unit_id = str(unit.get("unitId", ""))
        if not unit_id:
            continue
        unit_url = f"{base}/api/corpus/unit/{url_parse.quote(unit_id, safe='')}"
        status, payload = _api_json(unit_url)
        if status != 200:
            continue
        chunks = (((payload or {}).get("data") or {}).get("chunks") or [])
        for chunk in chunks:
            chunk_rows.append({
                "chunk_id": chunk.get("chunkId"),
                "unit_id": chunk.get("unitId"),
                "page": chunk.get("page"),
                "chunk_text": chunk.get("chunkText"),
            })

    unit_rows = [
        {
            "unit_id": unit.get("unitId"),
            "title": unit.get("displayTitle") or unit.get("title"),
            "summary": unit.get("displaySummary") or unit.get("summary"),
            "content_markdown": unit.get("contentMarkdown") or unit.get("explanationContext") or "",
            "page_start": unit.get("pageStart"),
            "page_end": unit.get("pageEnd"),
        }
        for unit in filtered_units
    ]
    rows = rows_to_eval(unit_rows, chunk_rows)
    evidence = {
        "manifestStatus": manifest_status,
        "unitCountFromApi": len(unit_rows),
        "chunkCountFromApi": len(chunk_rows),
    }
    return rows, evidence


def rows_to_eval(unit_rows: list[dict[str, Any]], chunk_rows: list[dict[str, Any]]) -> CorpusRows:
    units: list[UnitForEval] = []
    for row in unit_rows:
        units.append(
            UnitForEval(
                unit_id=str(row.get("unit_id", "")),
                title=str(row.get("title", "")),
                summary=str(row.get("summary", "")),
                content_markdown=str(row.get("content_markdown", "")),
                page_start=int(row.get("page_start", 0) or 0),
                page_end=int(row.get("page_end", 0) or 0),
            )
        )

    chunks_by_unit: dict[str, list[ChunkForEval]] = defaultdict(list)
    for row in chunk_rows:
        unit_id = str(row.get("unit_id", ""))
        chunks_by_unit[unit_id].append(
            ChunkForEval(
                chunk_id=str(row.get("chunk_id", "")),
                unit_id=unit_id,
                page=int(row.get("page", 0) or 0),
                chunk_text=str(row.get("chunk_text", "")),
            )
        )

    for rows in chunks_by_unit.values():
        rows.sort(key=lambda item: (item.page, item.chunk_id))

    return CorpusRows(units=units, chunks_by_unit=dict(chunks_by_unit))


def evaluate_rows(corpus: CorpusRows) -> tuple[list[UnitProductFitResult], dict[str, Any]]:
    duplicate_chunk_ids = near_duplicate_chunk_ids(
        chunk
        for chunks in corpus.chunks_by_unit.values()
        for chunk in chunks
    )

    results: list[UnitProductFitResult] = []
    for unit in sorted(corpus.units, key=lambda row: (row.page_start, row.page_end, row.unit_id)):
        unit_chunks = corpus.chunks_by_unit.get(unit.unit_id, [])
        results.append(evaluate_unit(unit, unit_chunks, duplicate_chunk_ids))

    gate = gate_results(results)

    surface_breakdown = {
        "hints": {
            "score": gate.scores["hints"],
            "threshold": SURFACE_THRESHOLDS["hints"],
            "pass": gate.scores["hints"] >= SURFACE_THRESHOLDS["hints"],
        },
        "explanations": {
            "score": gate.scores["explanations"],
            "threshold": SURFACE_THRESHOLDS["explanations"],
            "pass": gate.scores["explanations"] >= SURFACE_THRESHOLDS["explanations"],
        },
        "learning_page": {
            "score": gate.scores["learning_page"],
            "threshold": SURFACE_THRESHOLDS["learning_page"],
            "pass": gate.scores["learning_page"] >= SURFACE_THRESHOLDS["learning_page"],
        },
        "overall": {
            "score": gate.scores["overall"],
            "threshold": SURFACE_THRESHOLDS["overall"],
            "pass": gate.scores["overall"] >= SURFACE_THRESHOLDS["overall"],
        },
    }

    bundle = {
        "passStatus": gate.pass_status,
        "scores": gate.scores,
        "structuralPassRate": gate.structural_pass_rate,
        "criticalFailureCount": gate.critical_failure_count,
        "failureCounts": gate.failure_counts,
        "topFailureReasons": [{"reason": reason, "count": count} for reason, count in gate.top_failure_reasons],
        "surfaceBreakdown": surface_breakdown,
    }
    return results, bundle


def _sample_results(results: list[UnitProductFitResult], count: int = 15) -> list[UnitProductFitResult]:
    if not results:
        return []
    if len(results) <= count:
        return results

    sorted_rows = sorted(results, key=lambda row: (row.page_start, row.page_end, row.unit_id))
    indexes = [round(i * (len(sorted_rows) - 1) / (count - 1)) for i in range(count)]
    seen = set()
    sampled: list[UnitProductFitResult] = []
    for idx in indexes:
        if idx in seen:
            continue
        seen.add(idx)
        sampled.append(sorted_rows[idx])
    while len(sampled) < count:
        for row in sorted_rows:
            if row not in sampled:
                sampled.append(row)
                if len(sampled) == count:
                    break
    return sampled


def _pick_examples(results: list[UnitProductFitResult]) -> tuple[list[UnitProductFitResult], list[UnitProductFitResult]]:
    bad = sorted(
        results,
        key=lambda row: (
            -len(row.critical_failures),
            -len(row.failures),
            -row.noise_score,
            row.overall,
        ),
    )[:10]

    acceptable_pool = [
        row for row in results if not row.critical_failures and row.noise_score < 0.5
    ]
    if len(acceptable_pool) < 10:
        acceptable_pool = sorted(results, key=lambda row: (-row.overall, len(row.failures)))
    acceptable = sorted(acceptable_pool, key=lambda row: (-row.overall, len(row.failures)))[:10]
    return bad, acceptable


def _serialize_result(result: UnitProductFitResult) -> dict[str, Any]:
    return {
        "unitId": result.unit_id,
        "title": result.title,
        "pageStart": result.page_start,
        "pageEnd": result.page_end,
        "chunkIds": result.chunk_ids,
        "displayTitle": result.display_title,
        "displaySummary": result.display_summary,
        "hintSourceExcerpt": result.hint_source_excerpt,
        "explanationContext": result.explanation_context,
        "scores": {
            "hintability": result.hintability,
            "explainability": result.explainability,
            "learningPage": result.learning_page,
            "overall": result.overall,
            "noise": result.noise_score,
        },
        "structurePass": result.structure_pass,
        "failures": result.failures,
        "criticalFailures": result.critical_failures,
        "qualityFlags": result_quality_flags(result),
    }


def build_report(
    *,
    doc_id: str,
    run_id: str,
    source_of_truth: str,
    results: list[UnitProductFitResult],
    score_bundle: dict[str, Any],
    sources: CorpusSources,
) -> dict[str, Any]:
    sampled = _sample_results(results, count=15)
    bad_examples, acceptable_examples = _pick_examples(results)

    return {
        "version": PRODUCT_FIT_EVAL_VERSION,
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "docId": doc_id,
        "runId": run_id,
        "sourceOfTruth": source_of_truth,
        "thresholds": SURFACE_THRESHOLDS,
        "counts": {
            "units": len(results),
            "chunks": sum(len(row.chunk_ids) for row in results),
        },
        **score_bundle,
        "samples": {
            "sampledUnits": [_serialize_result(row) for row in sampled],
            "badExamples": [_serialize_result(row) for row in bad_examples],
            "acceptableExamples": [_serialize_result(row) for row in acceptable_examples],
        },
        "sources": {
            "bundle": sources.bundle,
            "neon": sources.neon,
            "api": sources.api,
        },
    }


def _score_verdict(score: float, threshold: float, pass_status: bool) -> str:
    if pass_status and score >= threshold:
        return "usable now"
    if score >= max(0.55, threshold - 0.12):
        return "usable with caveats"
    return "not yet usable"


def format_markdown_report(report: dict[str, Any]) -> str:
    score_bundle = report
    surfaces = score_bundle.get("surfaceBreakdown", {})

    lines: list[str] = []
    lines.append(f"# Corpus Product-Fit Report ({report['docId']})")
    lines.append("")
    lines.append(f"- `PRODUCT_FIT_EVAL_VERSION={report['version']}`")
    lines.append(f"- `runId={report['runId']}`")
    lines.append(f"- generated: `{report['generatedAt']}`")
    lines.append(f"- source_of_truth: `{report['sourceOfTruth']}`")
    lines.append(f"- pass_status: `{score_bundle['passStatus']}`")
    lines.append(f"- structural_pass_rate: `{score_bundle['structuralPassRate']}`")
    lines.append(f"- critical_failure_count: `{score_bundle['criticalFailureCount']}`")
    lines.append("")

    lines.append("## Scores")
    lines.append("")
    lines.append("| Surface | Score | Threshold | Pass | Verdict |")
    lines.append("| --- | ---: | ---: | :---: | --- |")
    for key in ("hints", "explanations", "learning_page", "overall"):
        surface = surfaces.get(key, {})
        score = float(surface.get("score", 0.0))
        threshold = float(surface.get("threshold", 0.0))
        passed = bool(surface.get("pass", False))
        verdict = _score_verdict(score, threshold, passed)
        lines.append(
            f"| {key} | {score:.4f} | {threshold:.2f} | {'yes' if passed else 'no'} | {verdict} |"
        )
    lines.append("")

    top_failure_reasons = score_bundle.get("topFailureReasons", [])
    lines.append("## Top Failure Reasons")
    lines.append("")
    if top_failure_reasons:
        for row in top_failure_reasons:
            lines.append(f"- `{row['reason']}`: {row['count']}")
    else:
        lines.append("- none")
    lines.append("")

    def emit_section(title: str, rows: list[dict[str, Any]]) -> None:
        lines.append(f"## {title}")
        lines.append("")
        lines.append("| unit_id | pages | overall | hint | explain | learning | failures | chunk_ids |")
        lines.append("| --- | --- | ---: | ---: | ---: | ---: | --- | --- |")
        for row in rows:
            scores = row["scores"]
            failures = ", ".join(row["failures"]) if row["failures"] else "-"
            chunk_ids = ", ".join(row["chunkIds"][:3])
            lines.append(
                "| {unit} | {start}-{end} | {overall:.4f} | {hint:.4f} | {explain:.4f} | {learn:.4f} | {fail} | {chunks} |".format(
                    unit=row["unitId"],
                    start=row["pageStart"],
                    end=row["pageEnd"],
                    overall=scores["overall"],
                    hint=scores["hintability"],
                    explain=scores["explainability"],
                    learn=scores["learningPage"],
                    fail=failures,
                    chunks=chunk_ids,
                )
            )
        lines.append("")

    samples = report.get("samples", {})
    emit_section("Sampled Units (15)", samples.get("sampledUnits", []))
    emit_section("Bad Examples (10)", samples.get("badExamples", []))
    emit_section("Acceptable Examples (10)", samples.get("acceptableExamples", []))

    lines.append("## Source Evidence")
    lines.append("")
    lines.append("### Neon")
    lines.append("")
    lines.append(f"- connected: `{report['sources']['neon'].get('connected', False)}`")
    lines.append(f"- units: `{report['sources']['neon'].get('unitCount', 0)}`")
    lines.append(f"- chunks: `{report['sources']['neon'].get('chunkCount', 0)}`")
    lines.append("")
    lines.append("### Bundle")
    lines.append("")
    lines.append(f"- present: `{report['sources']['bundle'].get('present', False)}`")
    lines.append(f"- bundle_dir: `{report['sources']['bundle'].get('bundleDir', '')}`")
    lines.append(f"- units: `{report['sources']['bundle'].get('unitCount', 0)}`")
    lines.append(f"- chunks: `{report['sources']['bundle'].get('chunkCount', 0)}`")
    lines.append("")
    lines.append("### API")
    lines.append("")
    lines.append(f"- base_url: `{report['sources']['api'].get('baseUrl', '')}`")
    lines.append(f"- manifest_status: `{report['sources']['api'].get('manifestStatus', 0)}`")
    lines.append(f"- unit_status: `{report['sources']['api'].get('unitStatus', 0)}`")
    lines.append(f"- search_status: `{report['sources']['api'].get('searchStatus', 0)}`")
    lines.append("")

    return "\n".join(lines).rstrip() + "\n"


def write_report_files(output_dir: Path, report: dict[str, Any]) -> tuple[Path, Path]:
    output_dir.mkdir(parents=True, exist_ok=True)
    json_path = output_dir / "product-fit-report.json"
    md_path = output_dir / "product-fit-report.md"

    json_path.write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    md_path.write_text(format_markdown_report(report), encoding="utf-8")
    return json_path, md_path


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(prog="python -m pdf_ingest.quality_eval")
    parser.add_argument("--doc-id", required=True)
    parser.add_argument("--run-id", required=True)
    parser.add_argument("--database-url", default="")
    parser.add_argument("--bundle-dir", default=".local/ingest-runs/ramakrishnan-smoke")
    parser.add_argument("--api-base-url", default=os.getenv("VITE_API_BASE_URL", "http://127.0.0.1:3001"))
    parser.add_argument("--output-dir", default="")
    parser.add_argument(
        "--source",
        default="neon",
        choices=("neon", "bundle", "api"),
        help="Primary source used for scoring.",
    )
    return parser.parse_args(argv)


def run(argv: list[str] | None = None) -> int:
    args = parse_args(argv)

    database_url, database_env_source = _resolve_database_url(args.database_url)
    bundle_rows, bundle_evidence = load_bundle_rows(
        Path(args.bundle_dir),
        doc_id=args.doc_id,
        run_id=args.run_id,
    )

    try:
        neon_rows, neon_evidence = load_neon_rows(
            doc_id=args.doc_id,
            run_id=args.run_id,
            database_url=database_url,
        )
    except Exception as exc:
        neon_rows = CorpusRows(units=[], chunks_by_unit={})
        neon_evidence = {
            "connected": False,
            "reason": str(exc),
            "databaseEnvSource": database_env_source,
            "unitCount": 0,
            "chunkCount": 0,
        }

    api_evidence = load_api_evidence(
        api_base_url=args.api_base_url,
        doc_id=args.doc_id,
        run_id=args.run_id,
    )
    api_rows, api_row_evidence = load_api_rows(
        api_base_url=args.api_base_url,
        doc_id=args.doc_id,
        run_id=args.run_id,
    )
    api_evidence = {**api_evidence, **api_row_evidence}

    if args.source == "bundle":
        corpus_rows = bundle_rows
    elif args.source == "api":
        corpus_rows = api_rows if api_rows.units else (neon_rows if neon_rows.units else bundle_rows)
    else:
        corpus_rows = neon_rows if neon_rows.units else bundle_rows

    results, score_bundle = evaluate_rows(corpus_rows)

    report = build_report(
        doc_id=args.doc_id,
        run_id=args.run_id,
        source_of_truth=args.source if results else "none",
        results=results,
        score_bundle=score_bundle,
        sources=CorpusSources(
            neon={
                **neon_evidence,
                "databaseEnvSource": database_env_source,
            },
            bundle=bundle_evidence,
            api=api_evidence,
        ),
    )

    output_dir = Path(args.output_dir) if args.output_dir else Path(".local/ingest-runs") / args.run_id
    json_path, md_path = write_report_files(output_dir, report)

    summary = {
        "doc_id": args.doc_id,
        "run_id": args.run_id,
        "source": report["sourceOfTruth"],
        "pass_status": report["passStatus"],
        "scores": report["scores"],
        "structural_pass_rate": report["structuralPassRate"],
        "critical_failure_count": report["criticalFailureCount"],
        "top_failure_reasons": report["topFailureReasons"][:5],
        "output_json": str(json_path),
        "output_md": str(md_path),
        "product_fit_eval_version": PRODUCT_FIT_EVAL_VERSION,
    }
    print(json.dumps(summary, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(run())
