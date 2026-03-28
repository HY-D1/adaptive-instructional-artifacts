from __future__ import annotations

import hashlib
import json
import math
import re
import urllib.request
from dataclasses import dataclass
from typing import Iterable


@dataclass(frozen=True)
class ChunkWindow:
    index: int
    text: str


def normalize_whitespace(text: str) -> str:
    return re.sub(r"\s+", " ", text).strip()


def split_words(text: str) -> list[str]:
    return [tok for tok in normalize_whitespace(text).split(" ") if tok]


def chunk_text(text: str, chunk_words: int, chunk_overlap: int) -> list[ChunkWindow]:
    if chunk_overlap >= chunk_words:
        raise ValueError("chunk_overlap must be less than chunk_words")

    words = split_words(text)
    if not words:
        return []

    windows: list[ChunkWindow] = []
    step = chunk_words - chunk_overlap
    cursor = 0
    idx = 0
    while cursor < len(words):
        segment = words[cursor : cursor + chunk_words]
        if not segment:
            break
        windows.append(ChunkWindow(index=idx, text=" ".join(segment)))
        idx += 1
        cursor += step
    return windows


def _hash_embedding(text: str, dim: int) -> list[float]:
    vector = [0.0] * dim
    if not text:
        return vector
    for token in split_words(text.lower()):
        digest = hashlib.sha256(token.encode("utf-8")).digest()
        index = int.from_bytes(digest[:4], "big") % dim
        sign = -1.0 if digest[4] % 2 else 1.0
        vector[index] += sign
    norm = math.sqrt(sum(v * v for v in vector))
    if norm > 0:
        vector = [v / norm for v in vector]
    return vector


def embed_with_ollama(
    texts: Iterable[str],
    model: str,
    dimension: int,
    endpoint: str = "http://localhost:11434/api/embed",
) -> list[list[float]]:
    payload = {"model": model, "input": list(texts)}
    req = urllib.request.Request(
        endpoint,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=120) as response:
        data = json.loads(response.read().decode("utf-8"))
    embeddings = data.get("embeddings") or []
    rows: list[list[float]] = []
    for emb in embeddings:
        row = [float(v) for v in emb]
        if len(row) != dimension:
            raise ValueError(
                f"Embedding dimension mismatch from Ollama: expected {dimension}, got {len(row)}"
            )
        rows.append(row)
    return rows


def embed_texts(
    texts: list[str],
    model: str,
    dimension: int,
) -> tuple[list[list[float]], str]:
    try:
        return embed_with_ollama(texts, model=model, dimension=dimension), "ollama"
    except Exception:
        return [_hash_embedding(text, dimension) for text in texts], "deterministic_hash_fallback"
