/**
 * Enhanced Hint Service (Legacy Adapter)
 *
 * This file provides backward compatibility for code importing from
 * the original enhanced-hint-service.ts location.
 *
 * The implementation has been refactored into modular files in the
 * hint-service/ directory for better maintainability.
 *
 * @deprecated Import from './hint-service' instead for new code
 */

// Re-export all types and functions from the modular implementation
export {
  // Types
  type AvailableResources,
  type EnhancedHint,
  type HintGenerationOptions,
  type AdaptiveHintContext,
  type AdaptiveHintOutput,
  type SafetyLayerResult,
  type ScoredHintCandidate,
  type EnhancedRetrievalBundle,
  type RetrievalSignalMeta,
  type RefinedHintResolution,

  // Constants
  MIN_RETRIEVAL_CONFIDENCE,
  ENHANCED_HINT_SERVICE_VERSION,

  // Core functions
  generateEnhancedHint,
  preloadHintContext,
  checkAvailableResources,
  checkAvailableResourcesAsync,
  findRelevantTextbookUnits,
  getHintStrategyDescription,
  applyHintSafetyLayer,
  scoreRefinedHintCandidate,
  getGenericFallbackHint,
  buildEnhancedRetrievalBundle,
  extractRetrievalSignals,
  generateSqlEngageFallbackHint,
  generateTextbookEnhancedHint,
  generateLLMEnhancedHint,
  saveHintToTextbook,
} from './hint-service';

// Legacy version constant for backward compatibility
export const ENHANCED_HINT_SERVICE_VERSION_LEGACY = 'enhanced-hint-v2.0.0-adaptive';
