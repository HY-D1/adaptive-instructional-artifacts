/**
 * My Textbook Unit Schema + Dedupe/Upsert Rules (Week 3 D6)
 * 
 * Handles creation and updating of textbook units with:
 * - Dedupe by conceptId (same concept → update existing)
 * - Provenance preservation
 * - Revision tracking
 */

import type { InstructionalUnit, SaveTextbookUnitResult } from '../types';
import type { LLMGuidanceOutput } from './llm-contracts';

// Configuration for dedupe/upsert
export const TEXTBOOK_UNIT_CONFIG = {
  // Dedupe key fields - units with same values are considered the same unit
  dedupeKeyFields: ['conceptIds', 'type'] as const,
  
  // Fields to merge on update (accumulate rather than replace)
  mergeableFields: ['sourceInteractionIds', 'createdFromInteractionIds', 'sourceRefIds'] as const,
  
  // Fields that should be replaced on update (new version wins)
  replaceableFields: [
    'content', 'title', 'summary', 'commonMistakes', 'minimalExample'
  ] as const,
  
  // Max revision count before creating new unit
  maxRevisions: 10,
  
  // Schema version for migrations
  schemaVersion: 'textbook-unit-v2'
} as const;

// Input for creating/updating a unit
export type CreateUnitInput = {
  learnerId: string;
  sessionId: string;
  conceptIds: string[];
  type: InstructionalUnit['type'];
  title: string;
  content: string;
  sourceInteractionIds: string[];
  // Week 3 D6 fields
  summary?: string;
  commonMistakes?: string[];
  minimalExample?: string;
  sourceRefIds?: string[];
  // From LLM output
  llmOutput?: LLMGuidanceOutput;
  // Provenance
  errorSubtypeId?: string;
  // Week 3 D8: Callback for logging upsert event
  onUpsert?: (params: {
    unitId: string;
    action: 'created' | 'updated';
    dedupeKey: string;
    revisionCount: number;
  }) => void;
};

// Dedupe key for finding existing units
export type UnitDedupeKey = {
  conceptIds: string[];
  type: InstructionalUnit['type'];
};

// Generate a dedupe key from input or unit
export function generateDedupeKey(
  input: UnitDedupeKey | InstructionalUnit
): string {
  const conceptIds = 'conceptIds' in input && Array.isArray(input.conceptIds) 
    ? input.conceptIds 
    : [input.conceptId];
  const type = input.type;
  
  // Sort concept IDs for consistent key generation
  const sortedConceptIds = [...conceptIds].sort().join(',');
  return `${sortedConceptIds}::${type}`;
}

// Find existing unit by dedupe key
export function findExistingUnit(
  units: InstructionalUnit[],
  dedupeKey: string
): InstructionalUnit | undefined {
  return units.find((unit) => generateDedupeKey(unit) === dedupeKey);
}

// Check if unit should be updated (same concept) or created new
export function shouldUpdateUnit(
  existing: InstructionalUnit,
  newInput: CreateUnitInput
): { shouldUpdate: boolean; reason: string } {
  // Check if revision limit reached
  if ((existing.revisionCount || 0) >= TEXTBOOK_UNIT_CONFIG.maxRevisions) {
    return {
      shouldUpdate: false,
      reason: `Revision limit (${TEXTBOOK_UNIT_CONFIG.maxRevisions}) reached - creating new unit`
    };
  }
  
  // Same concept IDs - should update
  const existingKey = generateDedupeKey(existing);
  const newKey = generateDedupeKey(newInput);
  
  if (existingKey === newKey) {
    return {
      shouldUpdate: true,
      reason: 'Same conceptIds and type - updating existing unit'
    };
  }
  
  return {
    shouldUpdate: false,
    reason: 'Different conceptIds or type - creating new unit'
  };
}

// Merge mergeable fields (deduplicate arrays)
function mergeFields(
  existing: string[] | undefined,
  incoming: string[] | undefined
): string[] {
  const combined = [...(existing || []), ...(incoming || [])];
  return Array.from(new Set(combined));
}

// Create update history entry
function createUpdateHistoryEntry(
  newInput: CreateUnitInput,
  previousRevisionCount: number
): NonNullable<InstructionalUnit['updateHistory']>[number] {
  return {
    timestamp: Date.now(),
    reason: previousRevisionCount === 0 
      ? 'Initial creation' 
      : `Update revision ${previousRevisionCount + 1}`,
    addedInteractionIds: newInput.sourceInteractionIds
  };
}

// Build updated unit from existing + new input
export function buildUpdatedUnit(
  existing: InstructionalUnit,
  newInput: CreateUnitInput
): InstructionalUnit {
  const revisionCount = (existing.revisionCount || 0) + 1;
  
  // Build update history
  const existingHistory = existing.updateHistory || [];
  const newHistoryEntry = createUpdateHistoryEntry(newInput, existing.revisionCount || 0);
  
  return {
    ...existing,
    
    // Replaceable fields: new content wins
    title: newInput.title,
    content: newInput.content,
    summary: newInput.summary ?? existing.summary,
    commonMistakes: newInput.commonMistakes ?? existing.commonMistakes,
    minimalExample: newInput.minimalExample ?? existing.minimalExample,
    
    // Mergeable fields: accumulate
    sourceInteractionIds: mergeFields(
      existing.sourceInteractionIds,
      newInput.sourceInteractionIds
    ),
    createdFromInteractionIds: mergeFields(
      existing.createdFromInteractionIds,
      newInput.sourceInteractionIds
    ),
    sourceRefIds: mergeFields(existing.sourceRefIds, newInput.sourceRefIds),
    
    // Update tracking
    updatedTimestamp: Date.now(),
    revisionCount,
    updateHistory: [...existingHistory, newHistoryEntry],
    
    // Session tracking
    updatedSessionIds: Array.from(new Set([
      ...(existing.updatedSessionIds || []),
      newInput.sessionId
    ])),
    
    // Preserve provenance but add to it
    provenance: existing.provenance,
    lastErrorSubtypeId: newInput.errorSubtypeId ?? existing.lastErrorSubtypeId
  };
}

// Build new unit from input
export function buildNewUnit(
  input: CreateUnitInput,
  unitId: string
): InstructionalUnit {
  const now = Date.now();
  
  return {
    id: unitId,
    sessionId: input.sessionId,
    updatedSessionIds: [input.sessionId],
    type: input.type,
    conceptId: input.conceptIds[0] || 'unknown',
    conceptIds: input.conceptIds,
    title: input.title,
    content: input.content,
    prerequisites: [], // Would be populated from concept registry
    addedTimestamp: now,
    updatedTimestamp: now,
    sourceInteractionIds: input.sourceInteractionIds,
    createdFromInteractionIds: input.sourceInteractionIds,
    sourceRefIds: input.sourceRefIds,
    summary: input.summary,
    commonMistakes: input.commonMistakes,
    minimalExample: input.minimalExample,
    revisionCount: 0,
    updateHistory: [createUpdateHistoryEntry(input, 0)],
    lastErrorSubtypeId: input.errorSubtypeId
  };
}

// Main upsert function - returns action taken and result
export function upsertTextbookUnit(
  existingUnits: InstructionalUnit[],
  input: CreateUnitInput,
  generateUnitId: () => string
): SaveTextbookUnitResult & { 
  action: 'created' | 'updated';
  why: string;
} {
  // Find existing unit by dedupe key
  const dedupeKey = generateDedupeKey(input);
  const existing = findExistingUnit(existingUnits, dedupeKey);
  
  if (existing) {
    // Check if we should update or create new
    const updateDecision = shouldUpdateUnit(existing, input);
    
    if (updateDecision.shouldUpdate) {
      // Update existing unit
      const updated = buildUpdatedUnit(existing, input);
      
      // Week 3 D8: Log upsert event
      input.onUpsert?.({
        unitId: updated.id,
        action: 'updated',
        dedupeKey,
        revisionCount: updated.revisionCount || 0
      });
      
      return {
        action: 'updated',
        unit: updated,
        success: true,
        why: updateDecision.reason
      };
    }
    
    // Revision limit reached - create new unit
    const newUnit = buildNewUnit(input, generateUnitId());
    
    // Week 3 D8: Log upsert event
    input.onUpsert?.({
      unitId: newUnit.id,
      action: 'created',
      dedupeKey,
      revisionCount: 0
    });
    
    return {
      action: 'created',
      unit: newUnit,
      success: true,
      why: updateDecision.reason
    };
  }
  
  // No existing unit - create new
  const newUnit = buildNewUnit(input, generateUnitId());
  
  // Week 3 D8: Log upsert event
  input.onUpsert?.({
    unitId: newUnit.id,
    action: 'created',
    dedupeKey,
    revisionCount: 0
  });
  
  return {
    action: 'created',
    unit: newUnit,
    success: true,
    why: 'No existing unit with matching conceptIds and type'
  };
}

// Create unit input from LLM guidance output (rung 3)
export function createUnitInputFromRung3(
  learnerId: string,
  sessionId: string,
  llmOutput: LLMGuidanceOutput,
  sourceInteractionIds: string[],
  errorSubtypeId?: string
): CreateUnitInput {
  // Parse rung 3 content for sections
  const parsed = parseRung3Content(llmOutput.content);
  
  return {
    learnerId,
    sessionId,
    conceptIds: llmOutput.conceptIds,
    type: 'summary', // Rung 3 creates summary units
    title: parsed.title || 'Reflective Note',
    content: llmOutput.content,
    sourceInteractionIds,
    summary: parsed.summary,
    commonMistakes: parsed.commonMistakes,
    minimalExample: parsed.minimalExample,
    sourceRefIds: llmOutput.sourceRefIds,
    llmOutput,
    errorSubtypeId
  };
}

// Parse Rung 3 content into sections
function parseRung3Content(content: string): {
  title?: string;
  summary?: string;
  commonMistakes?: string[];
  minimalExample?: string;
} {
  const result: ReturnType<typeof parseRung3Content> = {};
  
  // Extract summary
  const summaryMatch = content.match(/##?\s*Summary\s*\n([^#]+)/i);
  if (summaryMatch) {
    result.summary = summaryMatch[1].trim();
  }
  
  // Extract common mistakes
  const mistakesMatch = content.match(/##?\s*Common\s*(?:Mistakes|Errors)\s*\n([^#]+)/i);
  if (mistakesMatch) {
    const mistakesText = mistakesMatch[1];
    result.commonMistakes = mistakesText
      .split('\n')
      .map((line) => line.replace(/^[-*]\s*/, '').trim())
      .filter((line) => line.length > 0);
  }
  
  // Extract minimal example (SQL code block)
  const exampleMatch = content.match(/##?\s*(?:Minimal\s*)?Example\s*\n```sql\s*\n([\s\S]*?)```/i);
  if (exampleMatch) {
    result.minimalExample = exampleMatch[1].trim();
  }
  
  // Extract title from first line if it looks like a heading
  const lines = content.split('\n');
  const firstLine = lines[0].trim();
  if (firstLine.startsWith('#') && !firstLine.startsWith('##')) {
    result.title = firstLine.replace(/^#\s*/, '');
  }
  
  return result;
}

// Get unit statistics for display
export function getUnitStats(unit: InstructionalUnit): {
  age: number;
  revisionCount: number;
  sourceCount: number;
  isFresh: boolean;
} {
  const now = Date.now();
  const age = now - unit.addedTimestamp;
  const revisionCount = unit.revisionCount || 0;
  const sourceCount = (unit.sourceRefIds || []).length;
  const isFresh = age < 7 * 24 * 60 * 60 * 1000; // Less than 7 days
  
  return { age, revisionCount, sourceCount, isFresh };
}
