from __future__ import annotations

import json
from pathlib import Path
import sys

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from pdf_ingest import embedding_backends


class _FakeResponse:
    def __init__(self, payload: dict):
        self._payload = payload

    def read(self) -> bytes:
        return json.dumps(self._payload).encode("utf-8")

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, tb):
        return False


def test_expected_dimension_for_known_models() -> None:
    assert embedding_backends.expected_dimension_for_model("embeddinggemma") == 768
    assert embedding_backends.expected_dimension_for_model("qwen3-embedding:0.6b") == 1024
    assert embedding_backends.expected_dimension_for_model("qwen3-embedding:4b") == 2560


def test_deterministic_hash_embeddings_dimension_and_stability() -> None:
    one = embedding_backends.deterministic_hash_embeddings(["data independence"], 8)
    two = embedding_backends.deterministic_hash_embeddings(["data independence"], 8)
    assert len(one) == 1
    assert len(one[0]) == 8
    assert one == two


def test_embed_texts_strict_success(monkeypatch: pytest.MonkeyPatch) -> None:
    def fake_urlopen(request, timeout=0):
        _ = request
        _ = timeout
        return _FakeResponse(
            {
                "model": "embeddinggemma:latest",
                "embeddings": [[0.1, 0.2], [0.2, 0.1]],
            }
        )

    monkeypatch.setattr(embedding_backends.urllib.request, "urlopen", fake_urlopen)

    result = embedding_backends.embed_texts_strict(
        ["q1", "q2"],
        model="embeddinggemma:latest",
        expected_dimension=2,
    )

    assert result.backend == "ollama"
    assert result.dimension == 2
    assert len(result.embeddings) == 2


def test_embed_texts_strict_dimension_mismatch(monkeypatch: pytest.MonkeyPatch) -> None:
    def fake_urlopen(request, timeout=0):
        _ = request
        _ = timeout
        return _FakeResponse(
            {
                "model": "embeddinggemma:latest",
                "embeddings": [[0.1, 0.2, 0.3]],
            }
        )

    monkeypatch.setattr(embedding_backends.urllib.request, "urlopen", fake_urlopen)

    with pytest.raises(embedding_backends.EmbeddingBackendError):
        embedding_backends.embed_texts_strict(
            ["q1"],
            model="embeddinggemma:latest",
            expected_dimension=2,
        )


def test_embed_texts_with_fallback(monkeypatch: pytest.MonkeyPatch) -> None:
    def fail_strict(*args, **kwargs):
        _ = args
        _ = kwargs
        raise embedding_backends.EmbeddingBackendError("model unavailable")

    monkeypatch.setattr(embedding_backends, "embed_texts_strict", fail_strict)

    embeddings, backend, model_used, dimension_used = embedding_backends.embed_texts_with_fallback(
        ["schema versus instance"],
        model="embeddinggemma:latest",
        expected_dimension=6,
    )

    assert backend == "deterministic_hash_fallback"
    assert model_used == "embeddinggemma:latest"
    assert dimension_used == 6
    assert len(embeddings) == 1
    assert len(embeddings[0]) == 6


def test_embed_texts_with_fallback_model_chain(monkeypatch: pytest.MonkeyPatch) -> None:
    attempts: list[str] = []

    def strict_with_secondary(texts: list[str], *, model: str, expected_dimension: int | None = None, endpoint: str = ""):
        _ = texts
        _ = endpoint
        attempts.append(model)
        if model == "qwen3-embedding:4b":
            raise embedding_backends.EmbeddingBackendError("primary unavailable")
        return embedding_backends.EmbeddingBatchResult(
            model=model,
            backend="ollama",
            embeddings=[[0.1] * (expected_dimension or 768)],
            dimension=expected_dimension or 768,
            latency_ms=1.0,
        )

    monkeypatch.setattr(embedding_backends, "embed_texts_strict", strict_with_secondary)

    embeddings, backend, model_used, dimension_used = embedding_backends.embed_texts_with_fallback(
        ["join condition"],
        model="qwen3-embedding:4b",
        expected_dimension=2560,
        fallback_models=["nomic-embed-text-v2-moe:latest"],
    )

    assert attempts == ["qwen3-embedding:4b", "nomic-embed-text-v2-moe:latest"]
    assert backend == "ollama:nomic-embed-text-v2-moe:latest"
    assert model_used == "nomic-embed-text-v2-moe:latest"
    assert dimension_used == 768
    assert len(embeddings) == 1
