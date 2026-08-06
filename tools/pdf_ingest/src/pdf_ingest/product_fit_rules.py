from __future__ import annotations

import re
from dataclasses import dataclass
from difflib import SequenceMatcher
from typing import Iterable

PRODUCT_FIT_EVAL_VERSION = "v1"

SURFACE_THRESHOLDS = {
    "hints": 0.65,
    "explanations": 0.70,
    "learning_page": 0.70,
    "overall": 0.70,
}

NOISE_PATTERNS: tuple[re.Pattern[str], ...] = (
    re.compile(r"\bj\s+j\s+j\b", re.IGNORECASE),
    re.compile(r"\b1\s+1\s+1\b"),
    re.compile(r"OucTlJ|SyslcTns|vVe|ar;;|DBl\\/IS|11ANAGE", re.IGNORECASE),
    re.compile(r"\.{3,}|~{2,}|;{2,}|,{3,}"),
)

SQL_KEYWORD_RE = re.compile(
    r"\b(select|from|where|join|group\s+by|order\s+by|insert|update|delete|schema|relation|dbms|query)\b",
    re.IGNORECASE,
)


@dataclass(frozen=True)
class UnitForEval:
    unit_id: str
    title: str
    summary: str
    content_markdown: str
    page_start: int
    page_end: int


@dataclass(frozen=True)
class ChunkForEval:
    chunk_id: str
    unit_id: str
    page: int
    chunk_text: str


@dataclass(frozen=True)
class UnitProductFitResult:
    unit_id: str
    title: str
    page_start: int
    page_end: int
    chunk_ids: list[str]
    display_title: str
    display_summary: str
    hint_source_excerpt: str
    explanation_context: str
    noise_score: float
    structure_pass: bool
    hintability: float
    explainability: float
    learning_page: float
    overall: float
    failures: list[str]
    critical_failures: list[str]


@dataclass(frozen=True)
class ProductFitGateResult:
    pass_status: bool
    scores: dict[str, float]
    structural_pass_rate: float
    critical_failure_count: int
    failure_counts: dict[str, int]
    top_failure_reasons: list[tuple[str, int]]


def normalize_text(text: str | None) -> str:
    return re.sub(r"\s+", " ", (text or "")).strip()


def split_words(text: str) -> list[str]:
    return [token for token in normalize_text(text).split(" ") if token]


def extract_page_from_unit_id(unit_id: str) -> int | None:
    match = re.search(r"/page-(\d+)$", unit_id)
    if not match:
        return None
    return int(match.group(1))


def has_sql_signals(text: str) -> bool:
    return bool(SQL_KEYWORD_RE.search(text))


def sentence_like(text: str) -> bool:
    normalized = normalize_text(text)
    punctuation = len(re.findall(r"[.!?]", normalized))
    return len(normalized) >= 80 and punctuation >= 1


def is_low_signal_text(text: str) -> bool:
    normalized = normalize_text(text)
    if len(normalized) < 40:
        return True
    words = split_words(normalized.lower())
    if not words:
        return True
    unique_words = len(set(words))
    if unique_words <= 2:
        return True
    if len(words) >= 12 and unique_words / len(words) < 0.2:
        return True
    if re.fullmatch(r"(?:[a-zA-Z0-9]\s*){20,}", normalized):
        return True
    return False


def compute_noise_score(text: str) -> float:
    normalized = normalize_text(text)
    if not normalized:
        return 1.0

    score = 0.0
    for pattern in NOISE_PATTERNS:
        if pattern.search(normalized):
            score += 0.2

    letters = len(re.findall(r"[A-Za-z]", normalized))
    weird = len(re.findall(r"[^\w\s.,:;()\-]", normalized))
    if letters > 0 and weird / letters > 0.03:
        score += 0.2

    if is_low_signal_text(normalized):
        score += 0.2

    return min(score, 1.0)


def _bounded_length_score(text: str, min_chars: int, max_chars: int) -> float:
    length = len(normalize_text(text))
    if length <= 0:
        return 0.0
    if length < min_chars:
        return max(0.0, length / float(min_chars))
    if length > max_chars:
        return max(0.0, max_chars / float(length))
    return 1.0


def derive_display_title(unit: UnitForEval) -> str:
    title = normalize_text(unit.title)
    if title and not re.fullmatch(r"Page\s+\d+", title, flags=re.IGNORECASE):
        return title

    content = normalize_text(unit.content_markdown)
    if not content:
        return title or unit.unit_id

    first_sentence = re.split(r"(?<=[.!?])\s+", content, maxsplit=1)[0].strip()
    if not first_sentence:
        first_sentence = " ".join(split_words(content)[:10])

    first_sentence = first_sentence[:80].strip(" -_.,:;")
    if len(first_sentence) < 8:
        return title or unit.unit_id

    return first_sentence


def derive_display_summary(unit: UnitForEval, max_chars: int = 220) -> str:
    summary = normalize_text(unit.summary)
    if not summary:
        summary = normalize_text(unit.content_markdown)
    if len(summary) <= max_chars:
        return summary

    clipped = summary[: max_chars + 1]
    sentence_break = max(clipped.rfind("."), clipped.rfind(";"), clipped.rfind(":"))
    if sentence_break >= 80:
        clipped = clipped[: sentence_break + 1]
    else:
        clipped = clipped[:max_chars].rstrip() + "..."
    return clipped.strip()


def derive_hint_source_excerpt(unit: UnitForEval, max_chars: int = 180) -> str:
    source = normalize_text(unit.content_markdown)
    if not source:
        source = normalize_text(unit.summary)

    if len(source) <= max_chars:
        return source

    words = split_words(source)
    clipped = " ".join(words[: min(len(words), 32)])
    return clipped[:max_chars].rstrip(" ,.;")


def derive_explanation_context(unit: UnitForEval, max_chars: int = 420) -> str:
    summary = derive_display_summary(unit, max_chars=220)
    body = normalize_text(unit.content_markdown)
    if not body:
        return summary

    explanation = f"{summary}\n\n{body}" if summary else body
    if len(explanation) <= max_chars:
        return explanation
    return explanation[:max_chars].rstrip() + "..."


def near_duplicate_chunk_ids(chunks: Iterable[ChunkForEval], threshold: float = 0.94) -> set[str]:
    rows = list(chunks)
    marked: set[str] = set()

    normalized = [(row.chunk_id, normalize_text(row.chunk_text).lower()) for row in rows]
    for idx, (chunk_id, text_a) in enumerate(normalized):
        if not text_a:
            marked.add(chunk_id)
            continue
        for other_id, text_b in normalized[idx + 1 :]:
            if not text_b:
                continue
            similarity = SequenceMatcher(None, text_a, text_b).ratio()
            if similarity >= threshold:
                marked.add(chunk_id)
                marked.add(other_id)
    return marked


def evaluate_unit(unit: UnitForEval, chunks: list[ChunkForEval], duplicate_chunk_ids: set[str]) -> UnitProductFitResult:
    chunk_ids = [chunk.chunk_id for chunk in chunks]
    combined_chunk_text = " ".join(normalize_text(chunk.chunk_text) for chunk in chunks)

    title = normalize_text(unit.title)
    summary = normalize_text(unit.summary)
    content = normalize_text(unit.content_markdown)

    failures: list[str] = []
    critical_failures: list[str] = []

    if not title:
        failures.append("missing_title")
        critical_failures.append("missing_title")
    if not summary:
        failures.append("missing_summary")
        critical_failures.append("missing_summary")
    if not content:
        failures.append("missing_content")
        critical_failures.append("missing_content")
    if unit.page_start <= 0 or unit.page_end < unit.page_start:
        failures.append("invalid_page_range")
        critical_failures.append("invalid_page_range")

    expected_page = extract_page_from_unit_id(unit.unit_id)
    if expected_page is not None and (unit.page_start != expected_page or unit.page_end != expected_page):
        failures.append("page_span_not_unit_scoped")
        critical_failures.append("page_span_not_unit_scoped")

    if re.fullmatch(r"Page\s+\d+", title, flags=re.IGNORECASE):
        failures.append("generic_page_title")

    if compute_noise_score(summary) >= 0.5:
        failures.append("summary_noise_high")
    if compute_noise_score(content) >= 0.5:
        failures.append("content_noise_high")

    if not chunks:
        failures.append("missing_chunks")
        critical_failures.append("missing_chunks")

    chunk_lengths = [len(normalize_text(chunk.chunk_text)) for chunk in chunks]
    if chunk_lengths:
        if min(chunk_lengths) < 60:
            failures.append("chunk_too_short")
        if max(chunk_lengths) > 1400:
            failures.append("chunk_too_long")

    if any(chunk.chunk_id in duplicate_chunk_ids for chunk in chunks):
        failures.append("duplicate_or_high_overlap_chunk")

    display_title = derive_display_title(unit)
    display_summary = derive_display_summary(unit)
    hint_excerpt = derive_hint_source_excerpt(unit)
    explanation_context = derive_explanation_context(unit)

    noise_score = compute_noise_score(" ".join((summary, content, combined_chunk_text)))

    hintability = 0.0
    hintability += 0.45 * _bounded_length_score(hint_excerpt, 80, 220)
    hintability += 0.35 * (1.0 if has_sql_signals(" ".join((summary, combined_chunk_text))) else 0.25)
    hintability += 0.20 * (1.0 - noise_score)
    hintability = max(0.0, min(1.0, hintability))

    explainability = 0.0
    explainability += 0.50 * _bounded_length_score(explanation_context, 180, 500)
    explainability += 0.25 * (1.0 if sentence_like(content) else 0.35)
    explainability += 0.25 * (1.0 - noise_score)
    explainability = max(0.0, min(1.0, explainability))

    learning_page = 0.0
    learning_page += 0.35 * (1.0 if len(display_title) >= 8 else 0.2)
    learning_page += 0.35 * _bounded_length_score(display_summary, 70, 240)
    learning_page += 0.30 * (1.0 - noise_score)
    learning_page = max(0.0, min(1.0, learning_page))

    structure_pass = not any(reason in {
        "missing_title",
        "missing_summary",
        "missing_content",
        "invalid_page_range",
        "missing_chunks",
    } for reason in failures)

    overall = (hintability + explainability + learning_page) / 3.0

    return UnitProductFitResult(
        unit_id=unit.unit_id,
        title=title,
        page_start=unit.page_start,
        page_end=unit.page_end,
        chunk_ids=chunk_ids,
        display_title=display_title,
        display_summary=display_summary,
        hint_source_excerpt=hint_excerpt,
        explanation_context=explanation_context,
        noise_score=round(noise_score, 4),
        structure_pass=structure_pass,
        hintability=round(hintability, 4),
        explainability=round(explainability, 4),
        learning_page=round(learning_page, 4),
        overall=round(overall, 4),
        failures=sorted(set(failures)),
        critical_failures=sorted(set(critical_failures)),
    )


def gate_results(unit_results: list[UnitProductFitResult]) -> ProductFitGateResult:
    if not unit_results:
        empty_scores = {"hints": 0.0, "explanations": 0.0, "learning_page": 0.0, "overall": 0.0}
        return ProductFitGateResult(
            pass_status=False,
            scores=empty_scores,
            structural_pass_rate=0.0,
            critical_failure_count=0,
            failure_counts={},
            top_failure_reasons=[],
        )

    total = len(unit_results)
    scores = {
        "hints": round(sum(result.hintability for result in unit_results) / total, 4),
        "explanations": round(sum(result.explainability for result in unit_results) / total, 4),
        "learning_page": round(sum(result.learning_page for result in unit_results) / total, 4),
        "overall": round(sum(result.overall for result in unit_results) / total, 4),
    }

    structure_pass_rate = round(sum(1 for result in unit_results if result.structure_pass) / total, 4)

    failure_counts: dict[str, int] = {}
    critical_failure_count = 0
    for result in unit_results:
        if result.critical_failures:
            critical_failure_count += len(result.critical_failures)
        for failure in result.failures:
            failure_counts[failure] = failure_counts.get(failure, 0) + 1

    top_failure_reasons = sorted(failure_counts.items(), key=lambda row: (-row[1], row[0]))[:10]

    pass_status = (
        structure_pass_rate == 1.0
        and critical_failure_count == 0
        and scores["hints"] >= SURFACE_THRESHOLDS["hints"]
        and scores["explanations"] >= SURFACE_THRESHOLDS["explanations"]
        and scores["learning_page"] >= SURFACE_THRESHOLDS["learning_page"]
        and scores["overall"] >= SURFACE_THRESHOLDS["overall"]
    )

    return ProductFitGateResult(
        pass_status=pass_status,
        scores=scores,
        structural_pass_rate=structure_pass_rate,
        critical_failure_count=critical_failure_count,
        failure_counts=failure_counts,
        top_failure_reasons=top_failure_reasons,
    )


def result_quality_flags(result: UnitProductFitResult) -> list[str]:
    flags: list[str] = []
    if result.noise_score >= 0.5:
        flags.append("high_noise")
    if "page_span_not_unit_scoped" in result.failures:
        flags.append("bad_page_provenance")
    if "generic_page_title" in result.failures:
        flags.append("generic_title")
    if "chunk_too_short" in result.failures or "chunk_too_long" in result.failures:
        flags.append("chunk_length_out_of_bounds")
    if result.hintability < SURFACE_THRESHOLDS["hints"]:
        flags.append("hintability_low")
    if result.explainability < SURFACE_THRESHOLDS["explanations"]:
        flags.append("explainability_low")
    if result.learning_page < SURFACE_THRESHOLDS["learning_page"]:
        flags.append("learning_page_low")
    if result.critical_failures:
        flags.append("critical_fail")
    return flags
