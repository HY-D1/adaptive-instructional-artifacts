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

  // Check for common error subtypes and provide targeted guidance
  const subtypeLower = errorSubtypeId.toLowerCase();

  if (rung === 1) {
    if (subtypeLower.includes('group') || subtypeLower.includes('aggregat')) {
      return 'Check which column(s) need grouping.';
    }
    if (subtypeLower.includes('join')) {
      return 'Think about which tables need to be connected.';
    }
    if (subtypeLower.includes('where') || subtypeLower.includes('filter')) {
      return 'Re-read the filtering condition required.';
    }
    if (subtypeLower.includes('alias') || subtypeLower.includes('column')) {
      return 'Check the column names in your output.';
    }
    if (subtypeLower.includes('order') || subtypeLower.includes('sort')) {
      return 'Consider the required ordering of results.';
    }
    return `Re-read the problem and check the ${normalizedSubtype} part of your query.`;
  }

  if (rung === 2) {
    if (subtypeLower.includes('group') || subtypeLower.includes('aggregat')) {
      return 'Are all non-aggregated columns included in your GROUP BY? What function summarizes the data?';
    }
    if (subtypeLower.includes('join')) {
      return 'Which two tables share a common column? How should they connect?';
    }
    if (subtypeLower.includes('where') || subtypeLower.includes('filter')) {
      return 'What condition should rows satisfy? Which comparison operator fits?';
    }
    if (subtypeLower.includes('alias') || subtypeLower.includes('column')) {
      return 'Does your output column name match what the problem expects? Try using AS.';
    }
    return `What specifically about ${normalizedSubtype} needs to change? Compare your output with the expected result.`;
  }

  // Rung 3 — most specific
  if (subtypeLower.includes('group') || subtypeLower.includes('aggregat')) {
    return `Your query needs a GROUP BY clause. Pattern: SELECT ___, AGG(___) FROM ___ GROUP BY ___. Check if HAVING is also needed.`;
  }
  if (subtypeLower.includes('join')) {
    return `Connect the tables using: SELECT ___ FROM table1 JOIN table2 ON table1.___ = table2.___`;
  }
  if (subtypeLower.includes('alias') || subtypeLower.includes('column')) {
    return `Rename your output column: SELECT expression AS expected_name FROM ___`;
  }
  return `Fix the ${normalizedSubtype} issue. Pattern: SELECT ___ FROM ___ WHERE ___. Compare your result with the expected output.`;
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
