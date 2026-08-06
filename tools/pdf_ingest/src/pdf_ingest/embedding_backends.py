from __future__ import annotations

import hashlib
import json
import math
import time
import urllib.error
import urllib.request
from dataclasses import dataclass
from typing import Iterable

DEFAULT_OLLAMA_ENDPOINT = "http://localhost:11434/api/embed"

MODEL_DIMENSIONS: dict[str, int] = {
    "embeddinggemma": 768,
    "embeddinggemma:latest": 768,
    "nomic-embed-text-v2-moe": 768,
    "nomic-embed-text-v2-moe:latest": 768,
    "qwen3-embedding:0.6b": 1024,
    "qwen3-embedding:4b": 2560,
}


def normalize_whitespace(text: str) -> str:
    return " ".join(text.split())


def split_words(text: str) -> list[str]:
    return [token for token in normalize_whitespace(text).split(" ") if token]


def expected_dimension_for_model(model: str) -> int | None:
    normalized = model.strip().lower()
    if normalized in MODEL_DIMENSIONS:
        return MODEL_DIMENSIONS[normalized]
    if ":" not in normalized:
        return MODEL_DIMENSIONS.get(f"{normalized}:latest")
    return None


def deterministic_hash_embedding(text: str, dimension: int) -> list[float]:
    vector = [0.0] * dimension
    if not text:
        return vector

    for token in split_words(text.lower()):
        digest = hashlib.sha256(token.encode("utf-8")).digest()
        index = int.from_bytes(digest[:4], "big") % dimension
        sign = -1.0 if digest[4] % 2 else 1.0
        vector[index] += sign

    norm = math.sqrt(sum(value * value for value in vector))
    if norm > 0:
        vector = [value / norm for value in vector]
    return vector


def deterministic_hash_embeddings(texts: Iterable[str], dimension: int) -> list[list[float]]:
    return [deterministic_hash_embedding(text, dimension) for text in texts]


@dataclass(frozen=True)
class EmbeddingBatchResult:
    model: str
    backend: str
    embeddings: list[list[float]]
    dimension: int
    latency_ms: float


@dataclass(frozen=True)
class EmbeddingBatchFailure:
    model: str
    backend: str
    error: str
    latency_ms: float


class EmbeddingBackendError(RuntimeError):
    pass


def _parse_ollama_embeddings(payload: dict, model: str) -> list[list[float]]:
    if payload.get("error"):
        raise EmbeddingBackendError(str(payload.get("error")))

    raw_embeddings = payload.get("embeddings")
    if not isinstance(raw_embeddings, list) or not raw_embeddings:
        raise EmbeddingBackendError("ollama embed response missing embeddings")

    rows: list[list[float]] = []
    for row in raw_embeddings:
        if not isinstance(row, list):
            raise EmbeddingBackendError("ollama embed response row is not a list")
        rows.append([float(value) for value in row])

    dim = len(rows[0])
    if dim <= 0:
        raise EmbeddingBackendError("ollama embed response has empty vectors")
    for idx, row in enumerate(rows):
        if len(row) != dim:
            raise EmbeddingBackendError(
                f"ollama embed response has mixed dimensions: row 0={dim}, row {idx}={len(row)}"
            )
    return rows


def embed_with_ollama(
    texts: Iterable[str],
    *,
    model: str,
    endpoint: str = DEFAULT_OLLAMA_ENDPOINT,
    timeout_seconds: int = 180,
) -> EmbeddingBatchResult:
    batch = list(texts)
    payload = {
        "model": model,
        "input": batch,
    }

    started = time.perf_counter()
    request = urllib.request.Request(
        endpoint,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )

    try:
        with urllib.request.urlopen(request, timeout=timeout_seconds) as response:
            response_payload = json.loads(response.read().decode("utf-8"))
    except urllib.error.URLError as exc:
        elapsed_ms = (time.perf_counter() - started) * 1000
        raise EmbeddingBackendError(f"ollama request failed: {exc}") from exc

    embeddings = _parse_ollama_embeddings(response_payload, model=model)
    elapsed_ms = (time.perf_counter() - started) * 1000
    return EmbeddingBatchResult(
        model=model,
        backend="ollama",
        embeddings=embeddings,
        dimension=len(embeddings[0]),
        latency_ms=round(elapsed_ms, 3),
    )


def embed_texts_strict(
    texts: list[str],
    *,
    model: str,
    expected_dimension: int | None = None,
    endpoint: str = DEFAULT_OLLAMA_ENDPOINT,
) -> EmbeddingBatchResult:
    result = embed_with_ollama(texts, model=model, endpoint=endpoint)
    if expected_dimension is not None and result.dimension != expected_dimension:
        raise EmbeddingBackendError(
            f"embedding dimension mismatch for {model}: expected {expected_dimension}, got {result.dimension}"
        )
    return result


def embed_texts_with_fallback(
    texts: list[str],
    *,
    model: str,
    expected_dimension: int,
    endpoint: str = DEFAULT_OLLAMA_ENDPOINT,
    fallback_models: list[str] | None = None,
) -> tuple[list[list[float]], str, str, int]:
    candidates = [model]
    if fallback_models:
        for candidate in fallback_models:
            trimmed = candidate.strip()
            if trimmed and trimmed not in candidates:
                candidates.append(trimmed)

    for index, candidate_model in enumerate(candidates):
        candidate_expected_dimension = (
            expected_dimension
            if index == 0
            else expected_dimension_for_model(candidate_model) or expected_dimension
        )
        try:
            result = embed_texts_strict(
                texts,
                model=candidate_model,
                expected_dimension=candidate_expected_dimension,
                endpoint=endpoint,
            )
            return (
                result.embeddings,
                f"{result.backend}:{candidate_model}",
                candidate_model,
                result.dimension,
            )
        except Exception:
            continue

    return (
        deterministic_hash_embeddings(texts, expected_dimension),
        "deterministic_hash_fallback",
        model,
        expected_dimension,
    )
