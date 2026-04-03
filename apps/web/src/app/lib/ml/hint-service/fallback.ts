/**
 * Hint Service Fallback
 *
 * Fallback hint generation when LLM or textbook resources are unavailable.
 */

import type { GuidanceRung } from '../guidance-ladder';
import {
  canonicalizeSqlEngageSubtype,
  getProgressiveSqlEngageHintText,
  getSqlEngageRowsBySubtype,
} from '../../../data/sql-engage';
import type { EnhancedHint, RetrievalSignalMeta } from './types';
import { applyHintSafetyLayer, getGenericFallbackHint, mergeFallbackReasons } from './safety';

/**
 * Generate fallback hint from SQL-Engage CSV only
 *
 * Used when:
 * - Retrieval confidence is below threshold
 * - No LLM or textbook resources available
 * - Refined hints are unavailable
 */
export function generateSqlEngageFallbackHint(
  errorSubtypeId: string,
  rung: GuidanceRung,
  retrievalMeta?: Partial<RetrievalSignalMeta> & {
    fallbackReason?: string | null;
    safetyFilterApplied?: boolean;
  }
): EnhancedHint {
  const canonicalSubtype = canonicalizeSqlEngageSubtype(errorSubtypeId);
  const records = getSqlEngageRowsBySubtype(canonicalSubtype);

  // Get hint text based on rung
  let content: string;

  if (records.length > 0) {
    // Use progressive hint from SQL-Engage
    const record = records[0];
    content = getProgressiveSqlEngageHintText(canonicalSubtype, rung, record);
  } else {
    // Ultimate fallback: generic hint based on rung
    content = getGenericFallbackHint(rung, errorSubtypeId);
  }

  const safety = applyHintSafetyLayer(content, rung, errorSubtypeId);

  return {
    content: safety.content,
    rung,
    sources: {
      sqlEngage: true,
      textbook: false,
      llm: false,
      pdfPassages: false,
    },
    conceptIds: [],
    llmGenerated: false,
    confidence: Math.max(0.5, retrievalMeta?.retrievalConfidence ?? 0.5),
    retrievalConfidence: retrievalMeta?.retrievalConfidence ?? 0.5,
    fallbackReason: retrievalMeta?.fallbackReason ?? safety.fallbackReason ?? null,
    safetyFilterApplied:
      (retrievalMeta?.safetyFilterApplied ?? false) || safety.safetyFilterApplied,
    retrievedSourceIds: retrievalMeta?.retrievedSourceIds ?? [],
    retrievedChunkIds: retrievalMeta?.retrievedChunkIds ?? [],
  };
}

/**
 * Create ultimate fallback hint when all else fails
 */
export function createUltimateFallbackHint(
  rung: GuidanceRung,
  retrievalConfidence: number
): EnhancedHint {
  return {
    content: 'Review your SQL syntax and try again.',
    rung,
    sources: {
      sqlEngage: false,
      textbook: false,
      llm: false,
      pdfPassages: false,
    },
    conceptIds: [],
    llmGenerated: false,
    confidence: retrievalConfidence,
    retrievalConfidence,
    fallbackReason: 'ultimate_fallback',
    safetyFilterApplied: false,
    retrievedSourceIds: [],
    retrievedChunkIds: [],
  };
}

export { mergeFallbackReasons };
