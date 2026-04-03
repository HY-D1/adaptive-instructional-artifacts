/**
 * Hint Service Safety Layer
 *
 * Content filtering and safety checks for hint generation.
 */

import type { GuidanceRung } from '../guidance-ladder';
import type { SafetyLayerResult, ScoredHintCandidate } from './types';

/**
 * Apply safety filtering to hint content
 *
 * Ensures hints follow pedagogical guidelines:
 * - Rung 1: No SQL keywords, brief nudges only
 * - All rungs: No full answer leaks, no front-matter styles
 */
export function applyHintSafetyLayer(
  content: string,
  rung: GuidanceRung,
  errorSubtypeId: string
): SafetyLayerResult {
  let next = content.trim();
  let safetyFilterApplied = false;
  let fallbackReason: string | null = null;

  // Remove front-matter style headers (## Summary, ## Common Mistakes, etc.)
  const frontMatterRegex =
    /^(#{1,3}\s*(summary|common mistakes|key takeaway|answer)\b.*|(?:summary|common mistakes|key takeaway)\s*:.*)$/gim;
  if (frontMatterRegex.test(next)) {
    next = next.replace(frontMatterRegex, '').replace(/\n{3,}/g, '\n\n').trim();
    safetyFilterApplied = true;
    fallbackReason = fallbackReason ?? 'front_matter_suppressed';
  }

  // Rung 1: Block SQL keywords to prevent giving away answers
  const sqlKeywordRegex = /\b(select|from|where|join|group\s+by|order\s+by|having|insert|update|delete)\b/i;
  if (rung === 1 && sqlKeywordRegex.test(next)) {
    return {
      content: getGenericFallbackHint(rung, errorSubtypeId),
      safetyFilterApplied: true,
      fallbackReason: 'rung1_sql_keyword_blocked',
    };
  }

  // Block full answer SQL patterns (SELECT ... FROM ... without placeholders)
  const fullAnswerRegex = /\bselect\s+.+\s+from\s+.+\b/i;
  if (fullAnswerRegex.test(next) && !next.includes('___')) {
    return {
      content: getGenericFallbackHint(rung, errorSubtypeId),
      safetyFilterApplied: true,
      fallbackReason: 'answer_leak_blocked',
    };
  }

  // Clamp content length to rung-specific maximums
  const maxLengths: Record<GuidanceRung, number> = { 1: 100, 2: 220, 3: 420 };
  const maxLength = maxLengths[rung];
  if (next.length > maxLength) {
    next = `${next.slice(0, maxLength).trimEnd()}...`;
    safetyFilterApplied = true;
    fallbackReason = fallbackReason ?? 'length_clamped';
  }

  // Final safety check: if content is empty after filtering, return fallback
  if (!next) {
    return {
      content: getGenericFallbackHint(rung, errorSubtypeId),
      safetyFilterApplied: true,
      fallbackReason: 'empty_after_safety_filter',
    };
  }

  return {
    content: next,
    safetyFilterApplied,
    fallbackReason,
  };
}

/**
 * Score a refined hint candidate for quality and safety
 */
export function scoreRefinedHintCandidate(
  value: string,
  rung: GuidanceRung,
  errorSubtypeId: string
): ScoredHintCandidate {
  if (!value || value.trim().length === 0) {
    return {
      accepted: false,
      content: '',
      fallbackReason: 'refined_hint_missing',
      safetyFilterApplied: false,
    };
  }

  const safety = applyHintSafetyLayer(value, rung, errorSubtypeId);
  if (!safety.content.trim()) {
    return {
      accepted: false,
      content: '',
      fallbackReason: mergeFallbackReasons('refined_hint_empty', safety.fallbackReason),
      safetyFilterApplied: true,
    };
  }

  // Rung 2+ hints should have meaningful length
  if (rung >= 2 && safety.content.trim().length < 40) {
    return {
      accepted: false,
      content: '',
      fallbackReason: mergeFallbackReasons('refined_hint_too_short', safety.fallbackReason),
      safetyFilterApplied: true,
    };
  }

  return {
    accepted: true,
    content: safety.content,
    fallbackReason: safety.fallbackReason,
    safetyFilterApplied: safety.safetyFilterApplied,
  };
}

/**
 * Get generic fallback hint when specific hints are unavailable
 */
export function getGenericFallbackHint(rung: GuidanceRung, errorSubtypeId: string): string {
  const normalizedSubtype = errorSubtypeId.replace(/-/g, ' ');

  if (rung === 1) {
    return `Focus on the ${normalizedSubtype} part of your query.`;
  }

  if (rung === 2) {
    return `Which step in ${normalizedSubtype} is missing? Use your notes to verify the needed clause.`;
  }

  return `Address the ${normalizedSubtype} issue first, then re-run. Use a blank pattern like "SELECT ___ FROM ___" to guide your fix.`;
}

/**
 * Merge multiple fallback reasons into a single string
 */
export function mergeFallbackReasons(
  ...reasons: Array<string | null | undefined>
): string | null {
  const normalized = reasons
    .map((reason) => (reason || '').trim())
    .filter((reason) => reason.length > 0);
  if (normalized.length === 0) return null;
  return Array.from(new Set(normalized)).join(',');
}
