from __future__ import annotations

import re
from dataclasses import dataclass

from .embedding_backends import embed_texts_with_fallback


@dataclass(frozen=True)
class ChunkWindow:
    index: int
    text: str


LOW_SIGNAL_LINE_RE = re.compile(r"^(?:[jil1|]{1,3}\s*)+$", re.IGNORECASE)
NOISY_PUNCT_RE = re.compile(r"^[\W_]{4,}$")


def normalize_whitespace(text: str) -> str:
    return re.sub(r"\s+", " ", text).strip()


def split_words(text: str) -> list[str]:
    return [tok for tok in normalize_whitespace(text).split(" ") if tok]


def clean_extracted_text(text: str) -> str:
    if not text:
        return ""

    filtered_lines: list[str] = []
    for raw_line in text.replace("\x0c", "\n").splitlines():
        line = raw_line.strip()
        if not line:
            continue
        if LOW_SIGNAL_LINE_RE.fullmatch(line):
            continue
        if NOISY_PUNCT_RE.fullmatch(line):
            continue
        if re.fullmatch(r"\d{1,3}", line):
            continue
        filtered_lines.append(line)

    collapsed = " ".join(filtered_lines)
    collapsed = re.sub(r"\s+", " ", collapsed).strip()
    return collapsed


def is_low_signal_text(text: str) -> bool:
    normalized = normalize_whitespace(text)
    if len(normalized) < 30:
        return True

    words = split_words(normalized.lower())
    if not words:
        return True

    unique_ratio = len(set(words)) / len(words)
    if len(words) >= 10 and unique_ratio < 0.25:
        return True
    if re.fullmatch(r"(?:[a-zA-Z0-9]\s*){20,}", normalized):
        return True
    return False


def chunk_text(text: str, chunk_words: int, chunk_overlap: int) -> list[ChunkWindow]:
    if chunk_overlap >= chunk_words:
        raise ValueError("chunk_overlap must be less than chunk_words")

    cleaned = clean_extracted_text(text)
    words = split_words(cleaned)
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
        segment_text = " ".join(segment)
        if is_low_signal_text(segment_text):
            cursor += step
            continue
        windows.append(ChunkWindow(index=idx, text=segment_text))
        idx += 1
        cursor += step

    if not windows and not is_low_signal_text(cleaned):
        windows.append(ChunkWindow(index=0, text=" ".join(words[:chunk_words])))
    return windows


def embed_texts(
    texts: list[str],
    model: str,
    dimension: int,
) -> tuple[list[list[float]], str]:
    return embed_texts_with_fallback(
        texts,
        model=model,
        expected_dimension=dimension,
    )
