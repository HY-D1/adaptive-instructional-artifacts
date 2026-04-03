/**
 * Hint Service Refined Hints
 *
 * Resolution of refined (cached, pre-generated) hints for problems.
 */

import type { GuidanceRung } from '../guidance-ladder';
import { getProblemById } from '../../../data/problems';
import { getRefinedHintsForConcept, loadConceptMap } from '../../content/concept-loader';
import { scoreRefinedHintCandidate } from './safety';
import type { RefinedHintResolution } from './types';

/**
 * Resolve refined hint for a problem if available
 *
 * Checks all concepts associated with a problem for refined hints
 * and returns the best matching hint for the current rung.
 */
export async function resolveRefinedHintForProblem(
  problemId: string,
  rung: GuidanceRung,
  errorSubtypeId: string
): Promise<RefinedHintResolution> {
  await loadConceptMap();

  const problem = getProblemById(problemId);
  if (!problem) {
    return { content: null, rejectReason: 'problem_not_found' };
  }

  // Check each concept associated with the problem
  for (const conceptId of problem.concepts) {
    const refined = getRefinedHintsForConcept(conceptId);
    if (!refined) continue;

    // Select appropriate hint variant based on rung
    const candidateText =
      rung === 1 ? refined.hintV1 : rung === 2 ? refined.hintV2 : refined.hintEscalation;

    if (!candidateText) {
      continue;
    }

    // Score the candidate for quality and safety
    const scored = scoreRefinedHintCandidate(candidateText || '', rung, errorSubtypeId);

    if (!scored.accepted) {
      continue;
    }

    return {
      content: scored.content,
      sourceChunkIds: refined.refinementSourceChunkIds ?? [],
      refinementModel: refined.refinementModel,
      refinementConfidence: refined.refinementConfidence,
    };
  }

  return { content: null, rejectReason: 'refined_hint_unavailable' };
}
