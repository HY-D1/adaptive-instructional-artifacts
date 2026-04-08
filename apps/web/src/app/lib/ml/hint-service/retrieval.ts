/**
 * Hint Service Retrieval
 *
 * Retrieval bundle building and signal extraction for hint generation.
 */

import { buildRetrievalBundle, type RetrievalBundle } from '../../content/retrieval-bundle';
import { getProblemById } from '../../../data/problems';
import type { EnhancedRetrievalBundle, RetrievalSignalMeta } from './types';
import type { AvailableResources } from './types';
import type { HintGenerationOptions } from './types';
import { findRelevantTextbookUnits } from './resources';
import { MIN_RETRIEVAL_CONFIDENCE } from './types';

/**
 * Build enhanced retrieval bundle with textbook content
 */
export function buildEnhancedRetrievalBundle(
  options: HintGenerationOptions,
  resources: AvailableResources
): EnhancedRetrievalBundle | null {
  const { learnerId, problemId, errorSubtypeId, recentInteractions } = options;

  // Start with standard retrieval bundle
  const problem = getProblemById(problemId);
  if (!problem) {
    return null;
  }

  const baseBundle = buildRetrievalBundle({
    learnerId,
    problem,
    interactions: recentInteractions,
    lastErrorSubtypeId: errorSubtypeId,
  });

  // Add textbook units if available
  let textbookUnits;
  if (resources.textbook && errorSubtypeId) {
    const conceptIds = baseBundle.conceptCandidates.map((c) => c.id);
    textbookUnits = findRelevantTextbookUnits(learnerId, errorSubtypeId, conceptIds);
  }

  return {
    ...baseBundle,
    problem,
    textbookUnits,
  };
}

/**
 * Extract retrieval signals from a bundle
 *
 * Calculates confidence based on available sources:
 * - PDF passages (35% weight)
 * - Source passages (20% weight)
 * - Concept candidates (20% weight)
 * - Hint history (5% weight)
 * - Base confidence (20%)
 */
export function extractRetrievalSignals(bundle: RetrievalBundle): RetrievalSignalMeta {
  const retrievedChunkIds = Array.from(
    new Set([
      ...bundle.pdfPassages.map((passage) => passage.chunkId).filter(Boolean),
      ...bundle.sourcePassages.map((passage) => passage.chunkId).filter(Boolean),
    ])
  );

  const retrievedSourceIds = Array.from(
    new Set([...bundle.retrievedSourceIds, ...retrievedChunkIds])
  );

  // Calculate component signals (0-1 based on count, capped at 3)
  const pdfSignal = Math.min(bundle.pdfPassages.length, 3) / 3;
  const sourceSignal = Math.min(bundle.sourcePassages.length, 3) / 3;
  const conceptSignal = Math.min(bundle.conceptCandidates.length, 3) / 3;
  const historySignal = Math.min(bundle.hintHistory.length, 3) / 3;

  // Weighted confidence calculation
  const retrievalConfidence = Math.max(
    0,
    Math.min(
      1,
      0.2 +
        0.35 * pdfSignal +
        0.2 * sourceSignal +
        0.2 * conceptSignal +
        0.05 * historySignal
    )
  );

  return {
    retrievalConfidence: Number(retrievalConfidence.toFixed(4)),
    retrievedSourceIds,
    retrievedChunkIds,
  };
}

export { MIN_RETRIEVAL_CONFIDENCE };
