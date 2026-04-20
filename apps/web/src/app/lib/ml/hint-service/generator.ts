/**
 * Hint Service Generator
 *
 * Main entry point for hint generation with retrieval-first design.
 */

import type { GuidanceRung } from '../guidance-ladder';
import type { EnhancedHint, HintGenerationOptions, RetrievalSignalMeta } from './types';
import { checkAvailableResources } from './resources';
import { buildEnhancedRetrievalBundle, extractRetrievalSignals, MIN_RETRIEVAL_CONFIDENCE } from './retrieval';
import { generateSqlEngageFallbackHint, createUltimateFallbackHint, mergeFallbackReasons } from './fallback';
import { generateTextbookEnhancedHint } from './textbook-generation';
import { generateLLMEnhancedHint } from './llm-generation';
import { resolveRefinedHintForProblem } from './refined-hints';
import { loadConceptMap } from '../../content/concept-loader';
import { getProblemById } from '../../../data/problems';

/**
 * Generate enhanced hint using available resources
 *
 * DECISION MATRIX:
 * 1. LLM available: use Groq/backend LLM for every rung
 * 2. Refined hints (cached, high-quality) after LLM failure/unavailable
 * 3. Check retrieval confidence - fallback if too low
 * 4. Textbook available: Use textbook-enhanced
 * 5. Default: SQL-Engage CSV fallback
 *
 * @param options - Hint generation options
 * @returns Promise resolving to enhanced hint
 */
export async function generateEnhancedHint(options: HintGenerationOptions): Promise<EnhancedHint> {
  const { learnerId, rung, errorSubtypeId, forceLLM } = options;

  // Check available resources
  const resources = checkAvailableResources(learnerId);

  // Build enhanced retrieval bundle
  const retrievalBundle = buildEnhancedRetrievalBundle(options, resources);
  if (!retrievalBundle) {
    // Fallback to SQL-Engage hint if bundle creation fails
    if (errorSubtypeId) {
      return generateSqlEngageFallbackHint(errorSubtypeId, rung, {
        retrievalConfidence: 0,
        fallbackReason: 'retrieval_bundle_unavailable',
        safetyFilterApplied: true,
      });
    }
    return createUltimateFallbackHint(rung, 0);
  }

  const retrievalSignals = extractRetrievalSignals(retrievalBundle);

  // Groq/backend LLM is the first-choice generator for all guidance rungs.
  // Retrieval still builds context first, but low confidence/refined hints are fallback paths.
  const canUseLLM = resources.llm || Boolean(forceLLM);
  let llmFallbackReason: string | null = null;
  if (canUseLLM) {
    try {
      const llmHint = await generateLLMEnhancedHint(options, retrievalBundle, resources, retrievalSignals);
      if (llmHint.llmGenerated || !llmHint.fallbackReason?.includes('llm')) {
        return llmHint;
      }
      llmFallbackReason = llmHint.fallbackReason;
    } catch (error) {
      llmFallbackReason = 'llm_error';
      console.warn('[HintService] LLM hint failed; falling back to grounded static paths:', error);
    }
  }

  // Try refined hints after LLM fails/unavailable (cached, high-quality hints)
  const refinedHintResult = errorSubtypeId
    ? await resolveRefinedHintForProblem(options.problemId, rung, errorSubtypeId)
    : { content: null, rejectReason: 'missing_error_subtype' as const };

  if (refinedHintResult.content) {
    return buildRefinedHint(rung, refinedHintResult, retrievalSignals, retrievalBundle);
  }

  const refinedFallbackReason = mergeFallbackReasons(
    llmFallbackReason,
    'rejectReason' in refinedHintResult ? refinedHintResult.rejectReason : undefined
  );

  // Check retrieval confidence - if too low, use fallback
  if (retrievalSignals.retrievalConfidence < MIN_RETRIEVAL_CONFIDENCE) {
    if (errorSubtypeId) {
      return generateSqlEngageFallbackHint(errorSubtypeId, rung, {
        ...retrievalSignals,
        fallbackReason: mergeFallbackReasons('low_retrieval_confidence', refinedFallbackReason),
        safetyFilterApplied: true,
      });
    }
    return createUltimateFallbackHint(rung, retrievalSignals.retrievalConfidence);
  }

  // Decision: Do we have textbook content?
  const hasTextbookContent = retrievalBundle.textbookUnits && retrievalBundle.textbookUnits.length > 0;

  // CASE 1: No usable LLM but Textbook available → Enhanced SQL-Engage with textbook refs
  if (hasTextbookContent && errorSubtypeId) {
    return generateTextbookEnhancedHint(options, retrievalBundle, resources, {
      ...retrievalSignals,
      fallbackReason: refinedFallbackReason,
    });
  }

  // CASE 2: Neither LLM nor Textbook → SQL-Engage CSV fallback
  if (errorSubtypeId) {
    return generateSqlEngageFallbackHint(errorSubtypeId, rung, {
      ...retrievalSignals,
      fallbackReason: mergeFallbackReasons('no_llm_or_textbook', refinedFallbackReason),
    });
  }

  // Ultimate fallback
  return createUltimateFallbackHint(rung, retrievalSignals.retrievalConfidence);
}

/**
 * Build hint from refined hint result
 */
function buildRefinedHint(
  rung: GuidanceRung,
  refinedHintResult: {
    content: string;
    sourceChunkIds: string[];
    refinementModel?: string;
    refinementConfidence?: number;
  },
  retrievalSignals: RetrievalSignalMeta,
  retrievalBundle: { conceptCandidates: Array<{ id: string }> }
): EnhancedHint {
  const refinedSourceIds = Array.from(
    new Set([...retrievalSignals.retrievedSourceIds, ...refinedHintResult.sourceChunkIds])
  );
  const refinedChunkIds = Array.from(
    new Set([...retrievalSignals.retrievedChunkIds, ...refinedHintResult.sourceChunkIds])
  );

  return {
    content: refinedHintResult.content,
    rung,
    sources: {
      sqlEngage: false,
      textbook: true,
      llm: false,
      pdfPassages: false,
    },
    conceptIds: getProblemById(retrievalBundle.conceptCandidates[0]?.id)?.concepts ?? [],
    sourceRefIds: refinedHintResult.sourceChunkIds,
    llmGenerated: false,
    confidence: Number(
      Math.max(
        retrievalSignals.retrievalConfidence,
        Math.min(refinedHintResult.refinementConfidence ?? 0.75, 0.95)
      ).toFixed(4)
    ),
    retrievalConfidence: retrievalSignals.retrievalConfidence,
    fallbackReason: null,
    safetyFilterApplied: false,
    retrievedSourceIds: refinedSourceIds,
    retrievedChunkIds: refinedChunkIds,
  };
}

/**
 * Preload hint context for an error subtype
 *
 * Used to warm up caches and improve hint generation performance
 */
export async function preloadHintContext(learnerId: string, errorSubtypeId: string): Promise<void> {
  // Check resources to trigger any lazy loading
  checkAvailableResources(learnerId);

  // Preload concept map if available
  try {
    await loadConceptMap();
  } catch {
    // Concept map loading is optional
  }

  // Log preload for analytics
  if (import.meta.env.DEV) {
    // eslint-disable-next-line no-console
    console.log(`[HintService] Preloaded context for ${errorSubtypeId}`);
  }
}
