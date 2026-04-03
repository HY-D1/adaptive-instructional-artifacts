/**
 * Hint Service Textbook Persistence
 *
 * Saving generated hints to the learner's textbook for future reference.
 */

import { storage } from '../../storage/storage';
import { createEventId } from '../../utils/event-id';
import type { InstructionalUnit } from '../../../types';

/**
 * Save generated hint to My Textbook for future reference
 *
 * Organized by problem for easy lookup
 */
export async function saveHintToTextbook(
  learnerId: string,
  problemId: string,
  rung: 1 | 2 | 3,
  hintContent: string,
  errorSubtype: string,
  conceptIds: string[],
  sourceRefIds: string[]
): Promise<void> {
  // Build a descriptive title based on rung and error
  const rungLabels: Record<number, string> = { 1: 'Quick Hint', 2: 'Guidance', 3: 'Detailed Help' };
  const title = `${rungLabels[rung]}: ${errorSubtype}`;

  // Create the instructional unit
  const unit: InstructionalUnit = {
    id: createEventId('hint'),
    type: 'hint',
    conceptId: conceptIds[0] || 'general',
    conceptIds: conceptIds.length > 0 ? conceptIds : ['general'],
    title,
    content: hintContent,
    contentFormat: 'markdown',
    prerequisites: [],
    addedTimestamp: Date.now(),
    sourceInteractionIds: [],
    sourceRefIds: sourceRefIds,
    lastErrorSubtypeId: errorSubtype,
    problemId, // Store which problem this hint belongs to
    provenance: {
      templateId: `adaptive-hint-rung-${rung}`,
      model: 'llm-local',
      params: { temperature: 0.7, top_p: 0.9, stream: false, timeoutMs: 30000 },
      inputHash: '',
      retrievedSourceIds: [],
      createdAt: Date.now(),
    },
  };

  // Save to textbook - use saveTextbookUnitV2 for deduplication
  const result = storage.saveTextbookUnitV2(
    learnerId,
    {
      type: 'hint',
      conceptIds: unit.conceptIds || [unit.conceptId],
      title: unit.title,
      content: unit.content,
      sourceInteractionIds: unit.sourceInteractionIds,
      sourceRefIds: unit.sourceRefIds,
      errorSubtypeId: errorSubtype,
      problemId,
      provenance: unit.provenance,
    },
    problemId // Pass problemId for organization
  );

  if (result.success) {
    // Hint saved to textbook
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.log(`[HintService] Saved hint to textbook: ${result.unit.id}`);
    }
  }
}
