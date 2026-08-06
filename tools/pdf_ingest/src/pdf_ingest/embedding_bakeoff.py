from __future__ import annotations

import argparse
import json
import math
import os
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import psycopg

from .embedding_backends import embed_texts_strict, expected_dimension_for_model
from .eval_queries import EMBEDDING_QUERYSET_VERSION, EvalQuery, default_eval_queries, validate_eval_queries
from .product_fit_rules import compute_noise_score, has_sql_signals

EMBEDDING_BAKEOFF_VERSION = "v1"
DB_ENV_PRIORITY = (
    "DATABASE_URL",
    "NEON_DATABASE_URL",
    "adaptive_data_DATABASE_URL",
    "adaptive_data_POSTGRES_URL",
)


@dataclass(frozen=True)
class CorpusChunk:
    chunk_id: str
    unit_id: str
    doc_id: str
    page: int
    chunk_text: str
    unit_title: str
    unit_summary: str


@dataclass(frozen=True)
class RetrievalHit:
    chunk_id: str
    unit_id: str
    page: int
    score: float
    chunk_text: str
    unit_title: str
    unit_summary: str


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


def resolve_database_url(explicit_database_url: str = "") -> tuple[str, str | None]:
    explicit = explicit_database_url.strip()
    if explicit:
        return explicit, "--database-url"

    for key in DB_ENV_PRIORITY:
        value = (os.getenv(key) or "").strip()
        if value:
            return value, key

    merged_file_env: dict[str, str] = {}
    for candidate in (Path.cwd() / ".env.local", Path.cwd() / ".env.development.local"):
        merged_file_env.update(_read_env_file(candidate))

    for key in DB_ENV_PRIORITY:
        value = (merged_file_env.get(key) or "").strip()
        if value:
            return value, f"{key} (from .env file)"

    return "", None


def cosine_similarity(left: list[float], right: list[float]) -> float:
    if len(left) == 0 or len(right) == 0 or len(left) != len(right):
        return 0.0

    dot_product = 0.0
    left_norm = 0.0
    right_norm = 0.0

    for idx in range(len(left)):
        dot_product += left[idx] * right[idx]
        left_norm += left[idx] * left[idx]
        right_norm += right[idx] * right[idx]

    if left_norm <= 0 or right_norm <= 0:
        return 0.0
    return dot_product / (math.sqrt(left_norm) * math.sqrt(right_norm))


def _bounded_length_score(text: str, min_chars: int, max_chars: int) -> float:
    normalized = " ".join((text or "").split())
    length = len(normalized)
    if length <= 0:
        return 0.0
    if length < min_chars:
        return max(0.0, length / float(min_chars))
    if length > max_chars:
        return max(0.0, max_chars / float(length))
    return 1.0


def _is_sentence_like(text: str) -> bool:
    normalized = " ".join((text or "").split())
    punctuation = sum(1 for ch in normalized if ch in ".!?")
    return len(normalized) >= 80 and punctuation >= 1


def surface_suitability(hit: RetrievalHit, surface: str) -> float:
    title = " ".join((hit.unit_title or "").split())
    summary = " ".join((hit.unit_summary or "").split())
    content = " ".join((hit.chunk_text or "").split())
    noise = compute_noise_score(f"{title} {summary} {content}")

    if surface == "hints":
        score = 0.0
        score += 0.45 * _bounded_length_score(content, 70, 220)
        score += 0.35 * (1.0 if has_sql_signals(f"{summary} {content}") else 0.3)
        score += 0.20 * (1.0 - noise)
        return max(0.0, min(1.0, score))

    if surface == "explanations":
        score = 0.0
        score += 0.5 * _bounded_length_score(f"{summary} {content}", 180, 500)
        score += 0.25 * (1.0 if _is_sentence_like(f"{summary} {content}") else 0.35)
        score += 0.25 * (1.0 - noise)
        return max(0.0, min(1.0, score))

    score = 0.0
    score += 0.35 * (1.0 if title and not title.lower().startswith("page ") else 0.25)
    score += 0.35 * _bounded_length_score(summary or content, 70, 240)
    score += 0.30 * (1.0 - noise)
    return max(0.0, min(1.0, score))


def load_corpus_chunks(*, database_url: str, doc_id: str, run_id: str) -> list[CorpusChunk]:
    with psycopg.connect(database_url, autocommit=True) as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT
                  c.chunk_id,
                  c.unit_id,
                  c.doc_id,
                  c.page,
                  c.chunk_text,
                  u.title,
                  u.summary
                FROM corpus_chunks c
                INNER JOIN corpus_units u ON u.unit_id = c.unit_id
                WHERE c.doc_id = %s AND c.run_id = %s
                ORDER BY c.page ASC, c.chunk_id ASC
                """,
                (doc_id, run_id),
            )
            rows = cur.fetchall()

    return [
        CorpusChunk(
            chunk_id=str(row[0]),
            unit_id=str(row[1]),
            doc_id=str(row[2]),
            page=int(row[3] or 0),
            chunk_text=str(row[4] or ""),
            unit_title=str(row[5] or ""),
            unit_summary=str(row[6] or ""),
        )
        for row in rows
    ]


def evaluate_query(
    *,
    query: EvalQuery,
    query_embedding: list[float],
    chunks: list[CorpusChunk],
    chunk_embeddings: list[list[float]],
    top_k: int,
) -> dict[str, Any]:
    hits: list[RetrievalHit] = []
    for chunk, chunk_embedding in zip(chunks, chunk_embeddings, strict=True):
        score = cosine_similarity(query_embedding, chunk_embedding)
        hits.append(
            RetrievalHit(
                chunk_id=chunk.chunk_id,
                unit_id=chunk.unit_id,
                page=chunk.page,
                score=score,
                chunk_text=chunk.chunk_text,
                unit_title=chunk.unit_title,
                unit_summary=chunk.unit_summary,
            )
        )

    ranked = sorted(hits, key=lambda item: (-item.score, item.page, item.chunk_id))[:top_k]
    top1_units = {ranked[0].unit_id} if ranked else set()
    top3_units = {row.unit_id for row in ranked[:3]}
    top5_units = {row.unit_id for row in ranked[:5]}
    expected_units = set(query.expected_unit_ids)

    top1_relevance = 1.0 if expected_units & top1_units else 0.0
    top3_relevance = 1.0 if expected_units & top3_units else 0.0
    top5_relevance = 1.0 if expected_units & top5_units else 0.0

    concept_hits = len(expected_units & top5_units)
    concept_match_correctness = concept_hits / max(1, min(len(expected_units), 5))

    top_noise_scores = [compute_noise_score(row.chunk_text) for row in ranked[:5]]
    noise_penalty = sum(top_noise_scores) / len(top_noise_scores) if top_noise_scores else 1.0

    top_unit_ids = [row.unit_id for row in ranked[:5]]
    unique_top_units = len(set(top_unit_ids))
    duplication_penalty = (len(top_unit_ids) - unique_top_units) / max(1, len(top_unit_ids) - 1)

    hint_suitability = sum(surface_suitability(row, "hints") for row in ranked[:3]) / max(1, min(3, len(ranked)))
    explanation_suitability = sum(surface_suitability(row, "explanations") for row in ranked[:3]) / max(1, min(3, len(ranked)))
    learning_page_suitability = sum(surface_suitability(row, "learning_page") for row in ranked[:3]) / max(1, min(3, len(ranked)))

    surface_suitability_map = {
        "hints": hint_suitability,
        "explanations": explanation_suitability,
        "learning_page": learning_page_suitability,
    }
    selected_surface_suitability = surface_suitability_map[query.surface]

    score = (
        0.30 * top1_relevance
        + 0.25 * top3_relevance
        + 0.15 * top5_relevance
        + 0.10 * concept_match_correctness
        + 0.20 * selected_surface_suitability
    ) - (0.10 * noise_penalty + 0.10 * duplication_penalty)
    score = max(0.0, min(1.0, score))

    return {
        "queryId": query.id,
        "surface": query.surface,
        "text": query.text,
        "expectedUnitIds": list(query.expected_unit_ids),
        "expectedTerms": list(query.expected_terms),
        "top1Relevance": round(top1_relevance, 4),
        "top3Relevance": round(top3_relevance, 4),
        "top5Relevance": round(top5_relevance, 4),
        "conceptMatchCorrectness": round(concept_match_correctness, 4),
        "noisePenalty": round(noise_penalty, 4),
        "duplicationPenalty": round(duplication_penalty, 4),
        "hintSuitability": round(hint_suitability, 4),
        "explanationSuitability": round(explanation_suitability, 4),
        "learningPageSuitability": round(learning_page_suitability, 4),
        "queryScore": round(score, 4),
        "topK": [
            {
                "rank": idx + 1,
                "chunkId": hit.chunk_id,
                "unitId": hit.unit_id,
                "page": hit.page,
                "score": round(hit.score, 6),
                "title": hit.unit_title,
                "snippet": hit.chunk_text[:220],
            }
            for idx, hit in enumerate(ranked)
        ],
    }


def summarize_surface(rows: list[dict[str, Any]]) -> dict[str, float | int]:
    if not rows:
        return {
            "queryCount": 0,
            "avgQueryScore": 0.0,
            "avgTop1": 0.0,
            "avgTop3": 0.0,
            "avgTop5": 0.0,
            "avgConceptMatch": 0.0,
            "avgNoisePenalty": 0.0,
            "avgDuplicationPenalty": 0.0,
            "avgHintSuitability": 0.0,
            "avgExplanationSuitability": 0.0,
            "avgLearningPageSuitability": 0.0,
        }

    def avg(key: str) -> float:
        return round(sum(float(row[key]) for row in rows) / len(rows), 4)

    return {
        "queryCount": len(rows),
        "avgQueryScore": avg("queryScore"),
        "avgTop1": avg("top1Relevance"),
        "avgTop3": avg("top3Relevance"),
        "avgTop5": avg("top5Relevance"),
        "avgConceptMatch": avg("conceptMatchCorrectness"),
        "avgNoisePenalty": avg("noisePenalty"),
        "avgDuplicationPenalty": avg("duplicationPenalty"),
        "avgHintSuitability": avg("hintSuitability"),
        "avgExplanationSuitability": avg("explanationSuitability"),
        "avgLearningPageSuitability": avg("learningPageSuitability"),
    }


def top_examples(rows: list[dict[str, Any]]) -> dict[str, list[dict[str, Any]]]:
    if not rows:
        return {"best": [], "worst": []}
    ordered = sorted(rows, key=lambda row: (-row["queryScore"], row["queryId"]))
    best = ordered[:2]
    worst = sorted(rows, key=lambda row: (row["queryScore"], row["queryId"]))[:2]
    return {
        "best": best,
        "worst": worst,
    }


def evaluate_model(
    *,
    model: str,
    queries: list[EvalQuery],
    chunks: list[CorpusChunk],
    top_k: int,
) -> dict[str, Any]:
    chunk_texts = [chunk.chunk_text for chunk in chunks]
    query_texts = [query.text for query in queries]

    expected_dim = expected_dimension_for_model(model)

    chunk_result = embed_texts_strict(
        chunk_texts,
        model=model,
        expected_dimension=expected_dim,
    )
    query_result = embed_texts_strict(
        query_texts,
        model=model,
        expected_dimension=chunk_result.dimension,
    )

    if len(query_result.embeddings) != len(queries):
        raise RuntimeError(
            f"query embedding count mismatch for {model}: expected {len(queries)}, got {len(query_result.embeddings)}"
        )

    query_rows = [
        evaluate_query(
            query=query,
            query_embedding=query_embedding,
            chunks=chunks,
            chunk_embeddings=chunk_result.embeddings,
            top_k=top_k,
        )
        for query, query_embedding in zip(queries, query_result.embeddings, strict=True)
    ]

    by_surface = {
        surface: [row for row in query_rows if row["surface"] == surface]
        for surface in ("hints", "explanations", "learning_page")
    }

    surface_summary = {
        surface: summarize_surface(rows)
        for surface, rows in by_surface.items()
    }

    overall_adaptive_score = round(
        (
            float(surface_summary["hints"]["avgQueryScore"])
            + float(surface_summary["explanations"]["avgQueryScore"])
            + float(surface_summary["learning_page"]["avgQueryScore"])
        ) / 3.0,
        4,
    )

    return {
        "model": model,
        "status": "ok",
        "backend": chunk_result.backend,
        "embeddingDimension": chunk_result.dimension,
        "latencyMs": {
            "chunks": chunk_result.latency_ms,
            "queries": query_result.latency_ms,
            "total": round(chunk_result.latency_ms + query_result.latency_ms, 3),
            "perChunk": round(chunk_result.latency_ms / max(1, len(chunks)), 3),
            "perQuery": round(query_result.latency_ms / max(1, len(queries)), 3),
        },
        "surfaceSummary": surface_summary,
        "overallAdaptiveScore": overall_adaptive_score,
        "queryResults": query_rows,
        "topKExamples": {
            surface: top_examples(rows)
            for surface, rows in by_surface.items()
        },
    }


def to_markdown(report: dict[str, Any]) -> str:
    lines: list[str] = []
    lines.append(f"# Embedding Bake-off ({report['docId']})")
    lines.append("")
    lines.append(f"- `EMBEDDING_BAKEOFF_VERSION={report['bakeoffVersion']}`")
    lines.append(f"- `EMBEDDING_QUERYSET_VERSION={report['querysetVersion']}`")
    lines.append(f"- `runId={report['runId']}`")
    lines.append(f"- generated: `{report['generatedAt']}`")
    lines.append("")

    ranking = report.get("ranking", {})
    lines.append("## Recommendation")
    lines.append("")
    lines.append(f"- winner: `{ranking.get('winnerModel')}`")
    lines.append(f"- runner_up: `{ranking.get('runnerUpModel')}`")
    lines.append(f"- fallback: `{ranking.get('fallbackModel')}`")
    lines.append(f"- note: {ranking.get('note', '')}")
    lines.append("")

    lines.append("## Model Summary")
    lines.append("")
    lines.append("| Model | Status | Dim | Total Latency (ms) | Hints | Explanations | Learning Page | Overall |")
    lines.append("| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |")
    for model_row in report.get("modelResults", []):
        if model_row.get("status") != "ok":
            lines.append(f"| {model_row['model']} | failed | - | - | - | - | - | - |")
            continue
        summary = model_row["surfaceSummary"]
        lines.append(
            "| {model} | ok | {dim} | {latency:.2f} | {h:.4f} | {e:.4f} | {l:.4f} | {o:.4f} |".format(
                model=model_row["model"],
                dim=model_row["embeddingDimension"],
                latency=float(model_row["latencyMs"]["total"]),
                h=float(summary["hints"]["avgQueryScore"]),
                e=float(summary["explanations"]["avgQueryScore"]),
                l=float(summary["learning_page"]["avgQueryScore"]),
                o=float(model_row["overallAdaptiveScore"]),
            )
        )
    lines.append("")

    failures = [row for row in report.get("modelResults", []) if row.get("status") != "ok"]
    if failures:
        lines.append("## Failures / Unsupported")
        lines.append("")
        for row in failures:
            lines.append(f"- `{row['model']}`: {row.get('error', 'unknown error')}")
        lines.append("")

    return "\n".join(lines).rstrip() + "\n"


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(prog="python -m pdf_ingest.embedding_bakeoff")
    parser.add_argument("--doc-id", required=True)
    parser.add_argument("--run-id", required=True)
    parser.add_argument(
        "--models",
        default="embeddinggemma:latest,qwen3-embedding:0.6b,qwen3-embedding:4b",
        help="Comma-separated embedding models",
    )
    parser.add_argument("--database-url", default="")
    parser.add_argument("--output-dir", default="")
    parser.add_argument("--top-k", type=int, default=5)
    return parser.parse_args(argv)


def run(argv: list[str] | None = None) -> int:
    args = parse_args(argv)
    database_url, database_env_source = resolve_database_url(args.database_url)
    if not database_url:
        raise RuntimeError(
            "database url is required (use --database-url or set one of: "
            + ", ".join(DB_ENV_PRIORITY)
            + ")"
        )

    queries = default_eval_queries()
    validate_eval_queries(queries)

    chunks = load_corpus_chunks(database_url=database_url, doc_id=args.doc_id, run_id=args.run_id)
    if not chunks:
        raise RuntimeError(f"no corpus chunks found for doc_id={args.doc_id} run_id={args.run_id}")

    models = [model.strip() for model in args.models.split(",") if model.strip()]
    if not models:
        raise RuntimeError("no models provided")

    model_results: list[dict[str, Any]] = []
    for model in models:
        try:
            model_results.append(
                evaluate_model(
                    model=model,
                    queries=queries,
                    chunks=chunks,
                    top_k=max(1, min(10, args.top_k)),
                )
            )
        except Exception as exc:
            model_results.append(
                {
                    "model": model,
                    "status": "failed",
                    "error": str(exc),
                }
            )

    successful = [row for row in model_results if row.get("status") == "ok"]
    successful_sorted = sorted(
        successful,
        key=lambda row: (
            -float(row.get("overallAdaptiveScore", 0.0)),
            float((row.get("latencyMs") or {}).get("total", float("inf"))),
        ),
    )

    winner = successful_sorted[0] if successful_sorted else None
    runner_up = successful_sorted[1] if len(successful_sorted) > 1 else None

    ranking = {
        "winnerModel": winner["model"] if winner else None,
        "runnerUpModel": runner_up["model"] if runner_up else None,
        "fallbackModel": (runner_up["model"] if runner_up else (winner["model"] if winner else None)),
        "note": (
            "Best adaptive retrieval score wins; latency used only as tie-breaker."
            if winner
            else "No model completed successfully."
        ),
    }

    generated_at = datetime.now(timezone.utc)
    output_dir = (
        Path(args.output_dir)
        if args.output_dir
        else Path(".local/embedding-bakeoff") / generated_at.strftime("%Y%m%d-%H%M%S")
    )
    output_dir.mkdir(parents=True, exist_ok=True)

    report = {
        "bakeoffVersion": EMBEDDING_BAKEOFF_VERSION,
        "querysetVersion": EMBEDDING_QUERYSET_VERSION,
        "generatedAt": generated_at.isoformat(),
        "docId": args.doc_id,
        "runId": args.run_id,
        "databaseEnvSource": database_env_source,
        "modelsRequested": models,
        "corpus": {
            "chunkCount": len(chunks),
            "unitCount": len({chunk.unit_id for chunk in chunks}),
        },
        "querySet": {
            "count": len(queries),
            "surfaceCounts": {
                "hints": len([query for query in queries if query.surface == "hints"]),
                "explanations": len([query for query in queries if query.surface == "explanations"]),
                "learning_page": len([query for query in queries if query.surface == "learning_page"]),
            },
        },
        "modelResults": model_results,
        "ranking": ranking,
    }

    json_path = output_dir / "embedding-bakeoff-report.json"
    md_path = output_dir / "embedding-bakeoff-report.md"
    json_path.write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    md_path.write_text(to_markdown(report), encoding="utf-8")

    print(
        json.dumps(
            {
                "doc_id": args.doc_id,
                "run_id": args.run_id,
                "winner": ranking["winnerModel"],
                "runner_up": ranking["runnerUpModel"],
                "fallback": ranking["fallbackModel"],
                "output_json": str(json_path),
                "output_md": str(md_path),
                "EMBEDDING_BAKEOFF_VERSION": EMBEDDING_BAKEOFF_VERSION,
                "EMBEDDING_QUERYSET_VERSION": EMBEDDING_QUERYSET_VERSION,
            },
            indent=2,
        )
    )

    return 0


if __name__ == "__main__":
    raise SystemExit(run())
