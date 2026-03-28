from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class MlxEnrichmentResult:
    summary: str
    explanation: str
    hint_draft: str
    backend: str


def _fallback_enrichment(text: str) -> MlxEnrichmentResult:
    clean = " ".join(text.split())
    summary = clean[:280] if clean else ""
    explanation = clean[:560] if clean else ""
    hint = f"Start with a smaller query that validates one predicate, then expand: {summary[:140]}"
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
