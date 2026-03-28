from __future__ import annotations

from dataclasses import dataclass
import re


@dataclass(frozen=True)
class MlxEnrichmentResult:
    summary: str
    explanation: str
    hint_draft: str
    backend: str


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


def _fallback_enrichment(text: str) -> MlxEnrichmentResult:
    clean = _normalize_text(text)
    summary = _clip_for_display(clean, 220) if clean else ""
    explanation = _clip_for_display(clean, 420) if clean else ""
    hint_core = _clip_for_display(summary or clean, 140)
    hint = f"Start with a smaller query that validates one predicate, then expand: {hint_core}".strip()
    return MlxEnrichmentResult(
        summary=summary,
        explanation=explanation,
        hint_draft=hint,
        backend="deterministic_fallback",
    )


def enrich_text(text: str, enabled: bool, model: str = "") -> MlxEnrichmentResult:
    if not enabled:
        return _fallback_enrichment(text)

    try:
        from mlx_lm import generate, load  # type: ignore

        model_id = model or "mlx-community/Qwen2.5-0.5B-Instruct-4bit"
        tokenizer_model, tokenizer = load(model_id)
        prompt = (
            "Rewrite the following SQL learning content for a beginner. "
            "Return exactly three lines with prefixes SUMMARY:, EXPLANATION:, HINT:.\n\n"
            f"CONTENT:\n{text[:2000]}"
        )
        output = generate(
            tokenizer_model,
            tokenizer,
            prompt=prompt,
            max_tokens=220,
            verbose=False,
        )
        lines = [ln.strip() for ln in output.splitlines() if ln.strip()]
        summary = next((ln.removeprefix("SUMMARY:").strip() for ln in lines if ln.startswith("SUMMARY:")), "")
        explanation = next(
            (ln.removeprefix("EXPLANATION:").strip() for ln in lines if ln.startswith("EXPLANATION:")),
            "",
        )
        hint = next((ln.removeprefix("HINT:").strip() for ln in lines if ln.startswith("HINT:")), "")
        if not summary or not explanation:
            return _fallback_enrichment(text)
        return MlxEnrichmentResult(
            summary=summary,
            explanation=explanation,
            hint_draft=hint or f"Try decomposing the query into smaller steps: {summary[:120]}",
            backend="mlx_lm",
        )
    except Exception:
        return _fallback_enrichment(text)
