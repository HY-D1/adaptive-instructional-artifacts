from __future__ import annotations

from dataclasses import dataclass
import json
import os
import re
import urllib.error
import urllib.request

OLLAMA_GENERATE_ENDPOINT = os.getenv("PDF_INGEST_OLLAMA_URL", "http://127.0.0.1:11434") + "/api/generate"
DEFAULT_REFINEMENT_MODEL = os.getenv("PDF_INGEST_REFINEMENT_MODEL", "qwen3:4b")
DEFAULT_REFINEMENT_FALLBACK_MODEL = os.getenv("PDF_INGEST_REFINEMENT_FALLBACK_MODEL", "llama3.2:3b")
DEFAULT_REFINEMENT_VERSION = "grounded-refinement-v1"
SQL_LEAK_REGEX = re.compile(r"\bselect\s+.+\s+from\s+.+", re.IGNORECASE)
SQL_CANDIDATE_REGEX = re.compile(
    r"\b(select|insert\s+into|update|delete\s+from)\b[\s\S]{20,320}?(?:;|$)",
    re.IGNORECASE,
)


@dataclass(frozen=True)
class MlxEnrichmentResult:
    summary: str
    explanation: str
    hint_draft: str
    backend: str
    definition_refined: str
    example_refined: str
    common_mistakes_refined: str
    display_summary_refined: str
    hintable_excerpt_refined: str
    hint_v1: str
    hint_v2: str
    hint_escalation: str
    refinement_model: str
    refinement_confidence: float
    refinement_fallback_reason: str | None
    refinement_version: str


def _normalize_text(text: str) -> str:
    return re.sub(r"\s+", " ", text).strip()


def _clip_for_display(text: str, max_chars: int) -> str:
    normalized = _normalize_text(text)
    if len(normalized) <= max_chars:
        return normalized

    clipped = normalized[: max_chars + 1]
    sentence_break = max(clipped.rfind("."), clipped.rfind(";"), clipped.rfind(":"))
    if sentence_break >= max(40, max_chars // 2):
        return clipped[: sentence_break + 1].strip()
    return clipped[:max_chars].rstrip(" ,.;") + "..."


def _grounded_overlap(candidate: str, source: str) -> float:
    candidate_words = {token for token in re.findall(r"[a-zA-Z][a-zA-Z0-9_]{2,}", candidate.lower())}
    source_words = {token for token in re.findall(r"[a-zA-Z][a-zA-Z0-9_]{2,}", source.lower())}
    if not candidate_words or not source_words:
        return 0.0
    overlap = candidate_words & source_words
    return len(overlap) / len(candidate_words)


def _extract_sql_candidate(text: str) -> str:
    match = SQL_CANDIDATE_REGEX.search(text)
    if not match:
        return ""
    raw = _normalize_text(match.group(0))
    clipped = _clip_for_display(raw, 180)
    return clipped if clipped.endswith(";") else f"{clipped};"


def _deterministic_hints(summary: str, excerpt: str) -> tuple[str, str, str]:
    v1 = _clip_for_display(
        f"Start by identifying what data the question asks for before writing SQL. {summary}",
        110,
    )
    v2 = _clip_for_display(
        f"Which table holds the needed rows, and which condition narrows the result set? {excerpt}",
        210,
    )
    escalation = _clip_for_display(
        "Use a scaffold with blanks and fill them from the prompt: SELECT ___ FROM ___ WHERE ___.",
        280,
    )
    return v1, v2, escalation


def _fallback_enrichment(text: str, *, fallback_reason: str | None, model: str) -> MlxEnrichmentResult:
    clean = _normalize_text(text)
    summary = _clip_for_display(clean, 220) if clean else "Review the concept statement and key SQL terms in this section."
    explanation = _clip_for_display(clean, 420) if clean else summary
    definition_refined = _clip_for_display(summary, 260)
    display_summary_refined = _clip_for_display(summary, 200)
    hintable_excerpt_refined = _clip_for_display(clean or summary, 180)
    sql_example = _extract_sql_candidate(clean)
    if sql_example:
        example_refined = f"Example query pattern: {sql_example}"
    else:
        example_refined = _clip_for_display(
            f"Example focus: apply the concept to one table first, then add filters only after the base query runs.",
            220,
        )
    common_mistakes_refined = (
        "- Skipping the FROM source before adding filters.\n"
        "- Mixing multiple clauses before validating a minimal query.\n"
        "- Forgetting to verify column names against the schema."
    )
    hint_v1, hint_v2, hint_escalation = _deterministic_hints(display_summary_refined, hintable_excerpt_refined)
    hint = hint_v1
    return MlxEnrichmentResult(
        summary=summary,
        explanation=explanation,
        hint_draft=hint,
        backend="deterministic_fallback",
        definition_refined=definition_refined,
        example_refined=example_refined,
        common_mistakes_refined=common_mistakes_refined,
        display_summary_refined=display_summary_refined,
        hintable_excerpt_refined=hintable_excerpt_refined,
        hint_v1=hint_v1,
        hint_v2=hint_v2,
        hint_escalation=hint_escalation,
        refinement_model=model,
        refinement_confidence=0.45,
        refinement_fallback_reason=fallback_reason,
        refinement_version=DEFAULT_REFINEMENT_VERSION,
    )


def _extract_json_block(value: str) -> dict | None:
    normalized = value.strip()
    if not normalized:
        return None
    try:
        parsed = json.loads(normalized)
        if isinstance(parsed, dict):
            return parsed
    except json.JSONDecodeError:
        pass

    first = normalized.find("{")
    last = normalized.rfind("}")
    if first >= 0 and last > first:
        try:
            parsed = json.loads(normalized[first : last + 1])
            if isinstance(parsed, dict):
                return parsed
        except json.JSONDecodeError:
            return None
    return None


def _build_prompt(text: str) -> str:
    return (
        "You refine SQL teaching content. Stay grounded only in the provided passage.\n"
        "Do not invent tables, columns, or facts not present in the passage.\n"
        "Return JSON only with keys:\n"
        "definition_refined, example_refined, common_mistakes_refined, "
        "display_summary_refined, hintable_excerpt_refined, hint_v1, hint_v2, hint_escalation, refinement_confidence.\n"
        "Constraints:\n"
        "- definition_refined <= 260 chars.\n"
        "- display_summary_refined <= 200 chars.\n"
        "- hintable_excerpt_refined <= 180 chars.\n"
        "- hint_v1 <= 110 chars, no direct SQL solution.\n"
        "- hint_v2 <= 220 chars, ask a guiding question.\n"
        "- hint_escalation <= 320 chars, may use blanks like SELECT ___ FROM ___.\n"
        "- common_mistakes_refined must be 2-4 short bullet lines with '- ' prefixes.\n"
        "- example_refined should be concrete and concise.\n"
        f"PASSAGE:\n{text[:3200]}"
    )


def _call_ollama_json(prompt: str, model: str) -> dict | None:
    payload = {"model": model, "prompt": prompt, "stream": False}
    request = urllib.request.Request(
        OLLAMA_GENERATE_ENDPOINT,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=45) as response:
            body = json.loads(response.read().decode("utf-8"))
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError):
        return None

    response_text = body.get("response")
    if not isinstance(response_text, str):
        return None
    return _extract_json_block(response_text)


def _sanitize_refined_text(value: str, source: str, max_chars: int, min_overlap: float) -> str:
    normalized = _clip_for_display(_normalize_text(value), max_chars)
    if not normalized:
        return ""
    overlap = _grounded_overlap(normalized, source)
    if overlap < min_overlap:
        return ""
    return normalized


def _sanitize_hint(text: str, rung_max_chars: int) -> str:
    normalized = _clip_for_display(_normalize_text(text), rung_max_chars)
    if SQL_LEAK_REGEX.search(normalized) and "___" not in normalized:
        return ""
    return normalized


def _extract_common_mistake_lines(raw_value: str) -> list[str]:
    raw = raw_value.strip()
    if not raw:
        return []

    candidates: list[str] = []
    try:
        parsed = json.loads(raw)
        if isinstance(parsed, list):
            candidates.extend(str(item) for item in parsed if str(item).strip())
        elif isinstance(parsed, str):
            raw = parsed.strip()
    except json.JSONDecodeError:
        pass

    if not candidates:
        normalized_raw = raw.replace("\\n", "\n").strip()
        if normalized_raw.startswith("[") and normalized_raw.endswith("]"):
            normalized_raw = normalized_raw[1:-1].strip()
        quoted_items = re.findall(r"""['"]([^'"]{3,})['"]""", normalized_raw)
        if len(quoted_items) >= 2:
            candidates.extend(quoted_items)
        else:
            candidates.extend(line for line in normalized_raw.splitlines() if line.strip())

    cleaned: list[str] = []
    seen: set[str] = set()
    for candidate in candidates:
        normalized_line = _normalize_text(str(candidate))
        normalized_line = normalized_line.removeprefix("- ").strip()
        normalized_line = re.sub(r"^[\[\]\"'`,\-:\s]+", "", normalized_line)
        normalized_line = re.sub(r"[\[\]\"'`,;:\s]+$", "", normalized_line)
        clipped_line = _clip_for_display(normalized_line, 150)
        if not clipped_line:
            continue
        dedupe_key = clipped_line.lower()
        if dedupe_key in seen:
            continue
        seen.add(dedupe_key)
        cleaned.append(clipped_line)
    return cleaned


def enrich_text(
    text: str,
    enabled: bool,
    model: str = "",
    fallback_model: str = "",
) -> MlxEnrichmentResult:
    primary_model = model or DEFAULT_REFINEMENT_MODEL
    backup_model = fallback_model or DEFAULT_REFINEMENT_FALLBACK_MODEL

    if not enabled:
        return _fallback_enrichment(text, fallback_reason="refinement_disabled", model=primary_model)

    prompt = _build_prompt(text)
    source = _normalize_text(text)
    deterministic = _fallback_enrichment(source, fallback_reason=None, model=primary_model)

    fallback_reasons: list[str] = []
    chosen_model = primary_model
    parsed_payload: dict | None = None
    for candidate_model in [primary_model, backup_model]:
        if not candidate_model:
            continue
        parsed_payload = _call_ollama_json(prompt, candidate_model)
        if parsed_payload:
            chosen_model = candidate_model
            break
        fallback_reasons.append(f"model_unavailable:{candidate_model}")

    if not parsed_payload:
        fallback_reason = ",".join(fallback_reasons) if fallback_reasons else "ollama_generation_failed"
        return _fallback_enrichment(source, fallback_reason=fallback_reason, model=chosen_model)

    definition_refined = _sanitize_refined_text(
        str(parsed_payload.get("definition_refined", "")),
        source,
        260,
        0.25,
    ) or deterministic.definition_refined
    display_summary_refined = _sanitize_refined_text(
        str(parsed_payload.get("display_summary_refined", "")),
        source,
        200,
        0.25,
    ) or deterministic.display_summary_refined
    hintable_excerpt_refined = _sanitize_refined_text(
        str(parsed_payload.get("hintable_excerpt_refined", "")),
        source,
        180,
        0.3,
    ) or deterministic.hintable_excerpt_refined
    example_refined = _sanitize_refined_text(
        str(parsed_payload.get("example_refined", "")),
        source,
        260,
        0.2,
    ) or deterministic.example_refined

    raw_common_mistakes = str(parsed_payload.get("common_mistakes_refined", "")).strip()
    common_lines = [
        line
        for line in _extract_common_mistake_lines(raw_common_mistakes)
        if _grounded_overlap(line, source) >= 0.2
    ]
    if not common_lines:
        common_mistakes_refined = deterministic.common_mistakes_refined
        fallback_reasons.append("common_mistakes_ungrounded")
    else:
        common_mistakes_refined = "\n".join(f"- {line}" for line in common_lines[:4])

    hint_v1 = _sanitize_hint(str(parsed_payload.get("hint_v1", "")), 110) or deterministic.hint_v1
    hint_v2 = _sanitize_hint(str(parsed_payload.get("hint_v2", "")), 220) or deterministic.hint_v2
    hint_escalation = _sanitize_hint(str(parsed_payload.get("hint_escalation", "")), 320) or deterministic.hint_escalation

    if hint_v1 == deterministic.hint_v1:
        fallback_reasons.append("hint_v1_guarded")
    if hint_v2 == deterministic.hint_v2:
        fallback_reasons.append("hint_v2_guarded")
    if hint_escalation == deterministic.hint_escalation:
        fallback_reasons.append("hint_escalation_guarded")

    try:
        refinement_confidence = float(parsed_payload.get("refinement_confidence", 0.75))
    except (TypeError, ValueError):
        refinement_confidence = 0.75
    refinement_confidence = max(0.0, min(1.0, refinement_confidence))

    summary = display_summary_refined
    explanation = _clip_for_display(
        f"{definition_refined}\n\n{common_mistakes_refined.replace('- ', '')}",
        420,
    )
    fallback_reason = ",".join(sorted(set(fallback_reasons))) if fallback_reasons else None

    return MlxEnrichmentResult(
        summary=summary,
        explanation=explanation,
        hint_draft=hint_v1,
        backend="ollama_refinement",
        definition_refined=definition_refined,
        example_refined=example_refined,
        common_mistakes_refined=common_mistakes_refined,
        display_summary_refined=display_summary_refined,
        hintable_excerpt_refined=hintable_excerpt_refined,
        hint_v1=hint_v1,
        hint_v2=hint_v2,
        hint_escalation=hint_escalation,
        refinement_model=chosen_model,
        refinement_confidence=round(refinement_confidence, 4),
        refinement_fallback_reason=fallback_reason,
        refinement_version=DEFAULT_REFINEMENT_VERSION,
    )
