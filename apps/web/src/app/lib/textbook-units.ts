/**
 * My Textbook Unit Schema + Dedupe/Upsert Rules (Week 3 D6)
 * 
 * Handles creation and updating of textbook units with:
 * - Dedupe by conceptId (same concept → update existing)
 * - Provenance preservation
 * - Revision tracking
 */

import type { InstructionalUnit, SaveTextbookUnitResult, TextbookUnitStatus } from '../types';
import type { LLMGuidanceOutput } from './llm-contracts';

// Quality score weights (must sum to 1.0)
export const QUALITY_SCORE_WEIGHTS = {
  sourceRichness: 0.4, // Based on count of sources / max 5
  contentSummary: 0.2, // Has summary field
  contentExamples: 0.2, // Has minimalExample field
  contentMistakes: 0.2 // Has commonMistakes field
} as const;

// Maximum source count for richness calculation
export const MAX_SOURCE_COUNT = 5;

// Quality threshold for "Best" badge
export const BEST_QUALITY_THRESHOLD = 0.8;

// Quality thresholds for competition
const COMPETITION_THRESHOLDS = {
  REPLACE_MARGIN: 0.2, // New unit must be 20% better to replace
  SIMILAR_MARGIN: 0.1  // Within 10% is considered similar quality
} as const;

/**
 * Calculate quality score for an instructional unit (0-1 scale)
 * 
 * Formula:
 * - Source richness: (sourceCount / 5) * 0.4
 * - Content completeness: 0.2 each for summary, examples, mistakes
 */
export function calculateQualityScore(unit: Partial<InstructionalUnit>): number {
  // Source richness (0-0.4)
  const sourceCount = (unit.sourceRefIds?.length || 0) + (unit.provenance?.retrievedSourceIds?.length || 0);
  const uniqueSourceCount = new Set([
    ...(unit.sourceRefIds || []),
    ...(unit.provenance?.retrievedSourceIds || [])
  ]).size;
  const sourceRichness = Math.min(uniqueSourceCount / MAX_SOURCE_COUNT, 1) * QUALITY_SCORE_WEIGHTS.sourceRichness;
  
  // Content completeness (0-0.6)
  const hasSummary = Boolean(unit.summary?.trim());
  const hasExamples = Boolean(unit.minimalExample?.trim());
  const hasMistakes = Array.isArray(unit.commonMistakes) && unit.commonMistakes.length > 0;
  
  const contentScore = (
    (hasSummary ? QUALITY_SCORE_WEIGHTS.contentSummary : 0) +
    (hasExamples ? QUALITY_SCORE_WEIGHTS.contentExamples : 0) +
    (hasMistakes ? QUALITY_SCORE_WEIGHTS.contentMistakes : 0)
  );
  
  const totalScore = sourceRichness + contentScore;
  
  // Round to 3 decimal places for consistency
  return Math.round(totalScore * 1000) / 1000;
}

/**
 * Check if a unit qualifies as a "Best" explanation
 */
export function isBestQualityUnit(unit: InstructionalUnit): boolean {
  return (unit.qualityScore ?? 0) >= BEST_QUALITY_THRESHOLD;
}

/**
 * Get quality tier label for a unit
 */
export function getQualityTierLabel(unit: InstructionalUnit): 'best' | 'good' | 'average' | 'basic' {
  const score = unit.qualityScore ?? 0;
  if (score >= BEST_QUALITY_THRESHOLD) return 'best';
  if (score >= 0.6) return 'good';
  if (score >= 0.4) return 'average';
  return 'basic';
}

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

/**
 * Input for creating or updating a textbook unit
 */
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
  // Proactive unit creation flag
  autoCreated?: boolean;
  // Week 3 D8: Callback for logging upsert event
  onUpsert?: (params: {
    unitId: string;
    action: 'created' | 'updated';
    dedupeKey: string;
    revisionCount: number;
  }) => void;
};

/**
 * Key used for deduplicating textbook units
 */
export type UnitDedupeKey = {
  conceptIds: string[];
  type: InstructionalUnit['type'];
};

/**
 * Generate a dedupe key from input or unit
 * @param input - Unit or input to generate key from
 * @returns String dedupe key
 */
export function generateDedupeKey(
  input: UnitDedupeKey | InstructionalUnit
): string {
  const conceptIds = 'conceptIds' in input && Array.isArray(input.conceptIds) 
    ? input.conceptIds 
    : [input.conceptId];
  const type = input.type;
  
  // Sort concept IDs for consistent key generation (normalize case)
  const sortedConceptIds = [...conceptIds].map(c => c.toLowerCase()).sort().join(',');
  return `${sortedConceptIds}::${type}`;
}

/**
 * Find existing unit by dedupe key
 * @param units - Array of units to search
 * @param dedupeKey - Key to match
 * @returns Matching unit or undefined
 */
export function findExistingUnit(
  units: InstructionalUnit[],
  dedupeKey: string
): InstructionalUnit | undefined {
  return units.find((unit) => generateDedupeKey(unit) === dedupeKey);
}

/**
 * Check if unit should be updated or created as new
 * @param existing - Existing unit to check
 * @param newInput - New input being considered
 * @returns Decision with shouldUpdate flag and reason
 */
function shouldUpdateUnit(
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

/**
 * Build updated unit from existing unit and new input
 * @param existing - Existing unit to update
 * @param newInput - New input with changes
 * @returns Updated unit with merged data
 */
function buildUpdatedUnit(
  existing: InstructionalUnit,
  newInput: CreateUnitInput
): InstructionalUnit {
  const revisionCount = (existing.revisionCount || 0) + 1;
  
  // Build update history
  const existingHistory = existing.updateHistory || [];
  const newHistoryEntry = createUpdateHistoryEntry(newInput, existing.revisionCount || 0);
  
  // Build the updated unit first (without quality score)
  const updatedUnit: InstructionalUnit = {
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
    lastErrorSubtypeId: newInput.errorSubtypeId ?? existing.lastErrorSubtypeId,
    
    // Preserve autoCreated flag
    autoCreated: existing.autoCreated ?? newInput.autoCreated ?? false
  };
  
  // Calculate and set quality score based on updated content
  updatedUnit.qualityScore = calculateQualityScore(updatedUnit);
  
  return updatedUnit;
}

/**
 * Build new unit from input
 * @param input - Creation input
 * @param unitId - ID for the new unit
 * @returns New instructional unit
 */
export function buildNewUnit(
  input: CreateUnitInput,
  unitId: string
): InstructionalUnit {
  const now = Date.now();
  
  // Build the unit first (without quality score)
  const newUnit: InstructionalUnit = {
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
    lastErrorSubtypeId: input.errorSubtypeId,
    retrievalCount: 0,
    autoCreated: input.autoCreated ?? false
  };
  
  // Calculate and set quality score
  newUnit.qualityScore = calculateQualityScore(newUnit);
  
  return newUnit;
}

/**
 * Main upsert function for textbook units
 * Creates new or updates existing based on dedupe key
 * @param existingUnits - Current units array
 * @param input - Input for creation/update
 * @param generateUnitId - Function to generate new unit IDs
 * @returns Result with action taken and unit
 */
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

/**
 * Competition result from comparing a new unit against existing units
 */
export type CompetitionResult = {
  action: 'replace' | 'keep_both' | 'mark_alternative' | 'no_competition';
  primaryUnit: InstructionalUnit;
  archivedUnit?: InstructionalUnit; // If replaced
  reason: string;
  qualityDiff: number;
};

/**
 * Compare quality scores and determine competition outcome
 */
function determineCompetitionOutcome(
  newScore: number,
  existingScore: number
): 'replace' | 'keep_both' | 'mark_alternative' {
  const diff = newScore - existingScore;
  
  if (diff > COMPETITION_THRESHOLDS.REPLACE_MARGIN) {
    return 'replace';
  }
  
  if (Math.abs(diff) <= COMPETITION_THRESHOLDS.SIMILAR_MARGIN) {
    return 'keep_both';
  }
  
  return 'mark_alternative';
}

/**
 * Find the primary unit for a concept
 */
function findPrimaryUnit(
  units: InstructionalUnit[],
  conceptId: string,
  type?: InstructionalUnit['type']
): InstructionalUnit | undefined {
  return units.find(
    (u) =>
      u.conceptId === conceptId &&
      (u.status === 'primary' || !u.status) &&
      (type === undefined || u.type === type)
  );
}

/**
 * Archive a unit (mark as superseded)
 */
function archiveUnit(
  unit: InstructionalUnit,
  supersededById: string,
  reason: 'superseded' | 'user_deleted' | 'quality_threshold'
): InstructionalUnit {
  return {
    ...unit,
    status: 'archived',
    archivedReason: reason,
    archivedAt: Date.now(),
    archivedByUnitId: supersededById
  };
}

/**
 * Mark a unit as primary
 */
function markAsPrimary(unit: InstructionalUnit): InstructionalUnit {
  return {
    ...unit,
    status: 'primary'
  };
}

/**
 * Compete a new unit against existing units for the same concept
 * 
 * Rules:
 * 1. If new quality > existing quality by 0.2+: new becomes primary, existing archived
 * 2. If similar quality (within 0.1): keep both, existing stays primary, new is alternative
 * 3. If new quality < existing: new marked as alternative
 * 
 * Returns updated units array and competition result
 */
export function competeAndSelectBestUnit(
  existingUnits: InstructionalUnit[],
  newUnit: InstructionalUnit
): {
  updatedUnits: InstructionalUnit[];
  result: CompetitionResult;
} {
  const primaryUnit = findPrimaryUnit(existingUnits, newUnit.conceptId, newUnit.type);
  
  // No competition - no existing primary unit
  if (!primaryUnit) {
    const markedNewUnit = markAsPrimary(newUnit);
    return {
      updatedUnits: [...existingUnits, markedNewUnit],
      result: {
        action: 'no_competition',
        primaryUnit: markedNewUnit,
        reason: 'No existing primary unit for this concept',
        qualityDiff: 0
      }
    };
  }
  
  const newScore = newUnit.qualityScore ?? 0;
  const existingScore = primaryUnit.qualityScore ?? 0;
  const outcome = determineCompetitionOutcome(newScore, existingScore);
  const qualityDiff = newScore - existingScore;
  
  switch (outcome) {
    case 'replace': {
      // New unit wins - archive old primary, new becomes primary
      const archivedPrimary = archiveUnit(primaryUnit, newUnit.id, 'superseded');
      const markedNewUnit = markAsPrimary(newUnit);
      
      const updatedUnits = existingUnits.map((u) =>
        u.id === primaryUnit.id ? archivedPrimary : u
      );
      updatedUnits.push(markedNewUnit);
      
      return {
        updatedUnits,
        result: {
          action: 'replace',
          primaryUnit: markedNewUnit,
          archivedUnit: archivedPrimary,
          reason: `New unit quality (${(newScore * 100).toFixed(0)}%) is significantly better than existing (${(existingScore * 100).toFixed(0)}%)`,
          qualityDiff
        }
      };
    }
    
    case 'keep_both': {
      // Similar quality - keep both, mark new as alternative
      const markedNewUnit: InstructionalUnit = {
        ...newUnit,
        status: 'alternative'
      };
      
      return {
        updatedUnits: [...existingUnits, markedNewUnit],
        result: {
          action: 'keep_both',
          primaryUnit,
          reason: `Similar quality (new: ${(newScore * 100).toFixed(0)}%, existing: ${(existingScore * 100).toFixed(0)}%) - keeping both`,
          qualityDiff
        }
      };
    }
    
    case 'mark_alternative':
    default: {
      // New unit is worse - mark as alternative
      const markedNewUnit: InstructionalUnit = {
        ...newUnit,
        status: 'alternative'
      };
      
      return {
        updatedUnits: [...existingUnits, markedNewUnit],
        result: {
          action: 'mark_alternative',
          primaryUnit,
          reason: `New unit quality (${(newScore * 100).toFixed(0)}%) is lower than existing (${(existingScore * 100).toFixed(0)}%)`,
          qualityDiff
        }
      };
    }
  }
}

/**
 * Get the display status for a unit (for UI badges)
 */
export function getUnitDisplayStatus(unit: InstructionalUnit): {
  status: TextbookUnitStatus;
  badge: 'Best' | 'Alternative' | 'Archived' | 'New' | 'Auto-Created';
  color: 'amber' | 'blue' | 'gray' | 'green' | 'purple';
} {
  const status = unit.status || 'primary';
  
  // Auto-created units get special badge
  if (unit.autoCreated) {
    return { status, badge: 'Auto-Created', color: 'purple' };
  }
  
  switch (status) {
    case 'primary':
      return isBestQualityUnit(unit)
        ? { status, badge: 'Best', color: 'amber' }
        : { status, badge: 'New', color: 'green' };
    case 'alternative':
      return { status, badge: 'Alternative', color: 'blue' };
    case 'archived':
      return { status, badge: 'Archived', color: 'gray' };
    default:
      return { status: 'primary', badge: 'New', color: 'green' };
  }
}

/**
 * Filter units by status
 */
export function filterUnitsByStatus(
  units: InstructionalUnit[],
  statuses: TextbookUnitStatus[]
): InstructionalUnit[] {
  return units.filter((u) => {
    const unitStatus = u.status || 'primary';
    return statuses.includes(unitStatus);
  });
}

/**
 * Get primary units only (for default display)
 */
export function getPrimaryUnits(units: InstructionalUnit[]): InstructionalUnit[] {
  return filterUnitsByStatus(units, ['primary']);
}

/**
 * Get alternative units for a concept
 */
export function getAlternativeUnits(
  units: InstructionalUnit[],
  conceptId: string,
  type?: InstructionalUnit['type']
): InstructionalUnit[] {
  return units.filter(
    (u) =>
      u.conceptId === conceptId &&
      u.status === 'alternative' &&
      (type === undefined || u.type === type)
  );
}

// Get unit statistics for display
export function getUnitStats(unit: InstructionalUnit): {
  age: number;
  revisionCount: number;
  sourceCount: number;
  isFresh: boolean;
  qualityScore: number;
  qualityTier: 'best' | 'good' | 'average' | 'basic';
  isAutoCreated: boolean;
} {
  const now = Date.now();
  const age = now - unit.addedTimestamp;
  const revisionCount = unit.revisionCount || 0;
  const sourceCount = (unit.sourceRefIds || []).length;
  const isFresh = age < 7 * 24 * 60 * 60 * 1000; // Less than 7 days
  const qualityScore = unit.qualityScore ?? 0;
  const isAutoCreated = unit.autoCreated ?? false;
  
  return { 
    age, 
    revisionCount, 
    sourceCount, 
    isFresh, 
    qualityScore,
    qualityTier: getQualityTierLabel(unit),
    isAutoCreated
  };
}

/**
 * Check if a unit was auto-created by the trace analyzer
 */
export function isAutoCreatedUnit(unit: InstructionalUnit): boolean {
  return unit.autoCreated ?? false;
}

/**
 * Get all auto-created units from a list
 */
export function getAutoCreatedUnits(units: InstructionalUnit[]): InstructionalUnit[] {
  return units.filter((u) => u.autoCreated === true);
}

/**
 * Get the count of auto-created units
 */
export function getAutoCreatedUnitCount(units: InstructionalUnit[]): number {
  return units.filter((u) => u.autoCreated === true).length;
}
