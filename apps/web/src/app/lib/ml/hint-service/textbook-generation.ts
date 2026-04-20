/**
 * Hint Service Textbook Generation
 *
 * Textbook-enhanced hint generation (no LLM required).
 */

import type { GuidanceRung } from '../guidance-ladder';
import type { EnhancedHint, HintGenerationOptions, RetrievalSignalMeta } from './types';
import type { AvailableResources } from './types';
import type { EnhancedRetrievalBundle } from './types';
import { applyHintSafetyLayer } from './safety';
import { generateSqlEngageFallbackHint } from './fallback';

/**
 * Generate hint enhanced with textbook content
 *
 * Used when:
 * - Textbook has relevant units
 * - LLM is not available
 * - Retrieval confidence is sufficient
 */
export function generateTextbookEnhancedHint(
  options: HintGenerationOptions,
  retrievalBundle: EnhancedRetrievalBundle,
  _resources: AvailableResources,
  retrievalSignals: RetrievalSignalMeta
): EnhancedHint {
  const { rung, errorSubtypeId } = options;
  const { textbookUnits } = retrievalBundle;

  // Build hint from SQL-Engage base + textbook references
  let content = '';

  if (errorSubtypeId) {
    // Start with SQL-Engage hint as base
    const fallback = generateSqlEngageFallbackHint(errorSubtypeId, rung, {
      ...retrievalSignals,
      fallbackReason: null,
    });
    content = fallback.content;
  } else {
    content = `Review your approach to this problem.`;
  }

  // Append textbook references if available
  if (textbookUnits && textbookUnits.length > 0) {
    const unitRefs = textbookUnits
      .slice(0, 2)
      .map((u: { title: string }) => `"${u.title}"`)
      .join(' and ');
    content += ` See ${unitRefs} in your Textbook for related examples.`;
  }

  const safety = applyHintSafetyLayer(content, rung, errorSubtypeId || 'unknown');

  return {
    content: safety.content,
    rung,
    sources: {
      sqlEngage: true,
      textbook: (textbookUnits?.length ?? 0) > 0,
      llm: false,
      pdfPassages: retrievalSignals.retrievedChunkIds.length > 0,
    },
    conceptIds: retrievalBundle.conceptCandidates.map((c: { id: string }) => c.id),
    sourceRefIds: retrievalSignals.retrievedSourceIds,
    textbookUnits: textbookUnits?.slice(0, 2),
    llmGenerated: false,
    confidence: Math.max(0.6, retrievalSignals.retrievalConfidence),
    retrievalConfidence: retrievalSignals.retrievalConfidence,
    fallbackReason: safety.fallbackReason,
    safetyFilterApplied: safety.safetyFilterApplied,
    retrievedSourceIds: retrievalSignals.retrievedSourceIds,
    retrievedChunkIds: retrievalSignals.retrievedChunkIds,
  };
}
