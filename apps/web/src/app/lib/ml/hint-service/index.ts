/**
 * Hint Service
 *
 * Modular hint generation system with retrieval-first design.
 *
 * @example
 * ```typescript
 * import { generateEnhancedHint, checkAvailableResources } from './hint-service';
 *
 * const resources = checkAvailableResources(learnerId);
 * const hint = await generateEnhancedHint({
 *   learnerId,
 *   problemId,
 *   rung: 1,
 *   recentInteractions: []
 * });
 * ```
 */

// Types
export type {
  AvailableResources,
  EnhancedHint,
  HintGenerationOptions,
  AdaptiveHintContext,
  AdaptiveHintOutput,
  SafetyLayerResult,
  ScoredHintCandidate,
  EnhancedRetrievalBundle,
  RetrievalSignalMeta,
  RefinedHintResolution,
} from './types';

export { MIN_RETRIEVAL_CONFIDENCE, ENHANCED_HINT_SERVICE_VERSION } from './types';

// Core functions
export { generateEnhancedHint, preloadHintContext } from './generator';
export { checkAvailableResources, checkAvailableResourcesAsync, findRelevantTextbookUnits, getHintStrategyDescription } from './resources';
export { applyHintSafetyLayer, scoreRefinedHintCandidate, getGenericFallbackHint } from './safety';
export { buildEnhancedRetrievalBundle, extractRetrievalSignals } from './retrieval';
export { generateSqlEngageFallbackHint } from './fallback';
export { generateTextbookEnhancedHint } from './textbook-generation';
export { generateLLMEnhancedHint } from './llm-generation';

// Legacy re-exports for backward compatibility
export { saveHintToTextbook } from './textbook-persistence';
