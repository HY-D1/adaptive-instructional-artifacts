from __future__ import annotations

import hashlib
import os
import platform
import time
from dataclasses import dataclass
from pathlib import Path

LOCAL_CORPUS_PIPELINE_VERSION = os.getenv("LOCAL_CORPUS_PIPELINE_VERSION", "v1")
SOURCE_POLICY = "local_only_raw_remote_processed"
PARSER_BACKEND = "docling"
DEFAULT_EMBEDDING_MODEL = "embeddinggemma"
DEFAULT_EMBEDDING_DIMENSION = 768
DEFAULT_CHUNK_WORDS = 180
DEFAULT_CHUNK_OVERLAP = 30
DEFAULT_APPROX_PAGES_PER_CHAPTER = 25


@dataclass(frozen=True)
class ExtractConfig:
    input_pdf: Path
    output_dir: Path
    chapter_start: int
    chapter_end: int
    approx_pages_per_chapter: int = DEFAULT_APPROX_PAGES_PER_CHAPTER
    chunk_words: int = DEFAULT_CHUNK_WORDS
    chunk_overlap: int = DEFAULT_CHUNK_OVERLAP
    mlx_enabled: bool = False
    mlx_model: str = ""
    embedding_model: str = DEFAULT_EMBEDDING_MODEL
    embedding_dimension: int = DEFAULT_EMBEDDING_DIMENSION


@dataclass(frozen=True)
class UploadConfig:
    bundle_dir: Path
    database_url: str


@dataclass(frozen=True)
class HostMetadata:
    machine: str
    os: str
    python_version: str


def parse_chapter_range(chapter_range: str) -> tuple[int, int]:
    raw = chapter_range.strip()
    if "-" not in raw:
        raise ValueError("chapter range must be in form start-end")
    start_str, end_str = raw.split("-", 1)
    start = int(start_str)
    end = int(end_str)
    if start < 1 or end < start:
        raise ValueError("invalid chapter range")
    return start, end


def chapter_range_to_page_range(
    chapter_start: int,
    chapter_end: int,
    approx_pages_per_chapter: int = DEFAULT_APPROX_PAGES_PER_CHAPTER,
) -> tuple[int, int]:
    start_page = ((chapter_start - 1) * approx_pages_per_chapter) + 1
    end_page = chapter_end * approx_pages_per_chapter
    return start_page, end_page


def ensure_directory(path: Path) -> None:
    path.mkdir(parents=True, exist_ok=True)


def compute_file_sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def generate_run_id(input_path: Path) -> str:
    ts = int(time.time())
    suffix = hashlib.sha1(str(input_path).encode("utf-8")).hexdigest()[:8]
    return f"run-{ts}-{suffix}"


def collect_host_metadata() -> HostMetadata:
    return HostMetadata(
        machine=platform.machine(),
        os=platform.platform(),
        python_version=platform.python_version(),
    )
