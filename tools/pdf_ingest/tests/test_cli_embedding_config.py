from __future__ import annotations

from pathlib import Path
import sys

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from pdf_ingest.cli import _resolve_embedding_dimension


def test_resolve_embedding_dimension_infers_known_model() -> None:
    assert _resolve_embedding_dimension("embeddinggemma:latest", 0) == 768
    assert _resolve_embedding_dimension("qwen3-embedding:0.6b", 0) == 1024
    assert _resolve_embedding_dimension("qwen3-embedding:4b", 0) == 2560


def test_resolve_embedding_dimension_prefers_explicit_value() -> None:
    assert _resolve_embedding_dimension("embeddinggemma:latest", 2048) == 2048


def test_resolve_embedding_dimension_rejects_unknown_without_value() -> None:
    with pytest.raises(ValueError):
        _resolve_embedding_dimension("custom-model:latest", 0)
