import { InstructionalUnit, InteractionEvent } from '../../types';
import { conceptNodes, getConceptById, getConceptIdsForSqlEngageSubtype } from '../../data/sql-engage';
import { 
  buildConceptGraph, 
  CONCEPT_GRAPH, 
  getPrerequisites, 
  type ConceptNode 
} from '../../data/concept-graph';
import { checkPrerequisites, getPrerequisiteChain } from '../content/prerequisite-checker';
import { storage } from '../storage';

/**
 * Card displaying a common misconception pattern
 */
export type MisconceptionCard = {
  /** Card identifier */
  id: string;
  /** Error subtype */
  subtype: string;
  /** Number of occurrences */
  count: number;
  /** Timestamp of last occurrence */
  lastSeenAt: number;
  /** Associated concept names */
  conceptNames: string[];
  /** IDs of evidence interactions */
  evidenceIds: string[];
};

/**
 * Spaced repetition review prompt
 */
export type SpacedReviewPrompt = {
  /** Prompt identifier */
  id: string;
  /** Prompt title */
  title: string;
  /** Display message */
  message: string;
  /** When review is due */
  dueAt: number;
  /** Last seen timestamp */
  lastSeenAt: number;
  /** Evidence interaction IDs */
  evidenceIds: string[];
};

/**
 * Blocked unit info - unit whose prerequisites are not met
 */
export type BlockedUnitInfo = {
  unit: InstructionalUnit;
  conceptId: string;
  missingPrerequisites: string[];
  blockedByChain: string[];
  readinessScore: number;
  recommendedUnlockOrder: string[];
};

/**
 * Prerequisite strength info for a unit
 */
export type PrerequisiteStrengthInfo = {
  unit: InstructionalUnit;
  conceptId: string;
  prerequisiteScores: Map<string, number>;
  weakestPrerequisite: { conceptId: string; score: number } | null;
  averagePrerequisiteScore: number;
  confidencePenalty: number; // 0-1, higher means more penalty from weak prerequisites
};

/**
 * Enhanced textbook insights with concept graph integration
 */
export type TextbookInsights = {
  /** Units ordered by selected sort mode */
  orderedUnits: InstructionalUnit[];
  /** Units that are blocked (prerequisites not met) */
  blockedUnits: BlockedUnitInfo[];
  /** Prerequisite strength analysis for accessible units */
  prerequisiteStrengths: PrerequisiteStrengthInfo[];
  /** Common misconception cards */
  misconceptionCards: MisconceptionCard[];
  /** Spaced review prompts */
  spacedReviewPrompts: SpacedReviewPrompt[];
  /** Summary statistics */
  summary: {
    totalUnits: number;
    accessibleUnits: number;
    blockedUnitsCount: number;
    averagePrerequisiteStrength: number;
  };
};

/**
 * Sorting mode for textbook units
 */
export type SortMode = 'prerequisite' | 'quality' | 'newest' | 'oldest';

/**
 * Sort units by quality score (highest first), then by timestamp
 */
function orderUnitsByQuality(units: InstructionalUnit[]): InstructionalUnit[] {
  return [...units].sort((a, b) => {
    const scoreA = a.qualityScore ?? 0;
    const scoreB = b.qualityScore ?? 0;
    if (scoreB !== scoreA) {
      return scoreB - scoreA; // Higher score first
    }
    // Tie-breaker: newer units first
    return (b.updatedTimestamp ?? b.addedTimestamp) - (a.updatedTimestamp ?? a.addedTimestamp);
  });
}

/**
 * Sort units by timestamp (newest first)
 */
function orderUnitsByNewest(units: InstructionalUnit[]): InstructionalUnit[] {
  return [...units].sort((a, b) => {
    const timeA = a.updatedTimestamp ?? a.addedTimestamp;
    const timeB = b.updatedTimestamp ?? b.addedTimestamp;
    return timeB - timeA;
  });
}

/**
 * Sort units by timestamp (oldest first)
 */
function orderUnitsByOldest(units: InstructionalUnit[]): InstructionalUnit[] {
  return [...units].sort((a, b) => {
    const timeA = a.updatedTimestamp ?? a.addedTimestamp;
    const timeB = b.updatedTimestamp ?? b.addedTimestamp;
    return timeA - timeB;
  });
}

function sanitizeId(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'unknown';
}

// ============================================================================
// Concept Graph Integration - Blocked Node Detection & Prerequisite Propagation
// ============================================================================

/**
 * Get learner's covered concepts with scores from profile
 * @param learnerId - Learner identifier
 * @returns Map of concept ID to coverage score
 */
function getLearnerConceptCoverage(learnerId: string): Map<string, number> {
  const profile = storage.getProfile(learnerId);
  if (!profile) return new Map();
  
  const coverage = new Map<string, number>();
  for (const [conceptId, evidence] of profile.conceptCoverageEvidence.entries()) {
    coverage.set(conceptId, evidence.score);
  }
  return coverage;
}

/**
 * Calculate prerequisite strength for a unit
 * @param unit - Instructional unit
 * @param learnerCoverage - Map of concept IDs to coverage scores
 * @returns Prerequisite strength info
 */
function calculatePrerequisiteStrength(
  unit: InstructionalUnit,
  learnerCoverage: Map<string, number>
): PrerequisiteStrengthInfo {
  const conceptId = unit.conceptId;
  const graph = buildConceptGraph();
  const node = graph.get(conceptId);
  
  if (!node || node.prerequisites.length === 0) {
    return {
      unit,
      conceptId,
      prerequisiteScores: new Map(),
      weakestPrerequisite: null,
      averagePrerequisiteScore: 100,
      confidencePenalty: 0
    };
  }
  
  // Get all prerequisite scores (direct and indirect)
  const prerequisiteScores = new Map<string, number>();
  const allPrereqs = getPrerequisiteChain(conceptId);
  
  for (const prereqId of allPrereqs) {
    const score = learnerCoverage.get(prereqId) || 0;
    prerequisiteScores.set(prereqId, score);
  }
  
  // Find weakest prerequisite
  let weakestPrerequisite: { conceptId: string; score: number } | null = null;
  let totalScore = 0;
  let minScore = 100;
  
  for (const [prereqId, score] of prerequisiteScores) {
    totalScore += score;
    if (score < minScore) {
      minScore = score;
      weakestPrerequisite = { conceptId: prereqId, score };
    }
  }
  
  const averagePrerequisiteScore = prerequisiteScores.size > 0 
    ? totalScore / prerequisiteScores.size 
    : 100;
  
  // Calculate confidence penalty (0-1 scale)
  // Weak prerequisites reduce confidence in learning this concept
  const confidencePenalty = Math.max(0, 1 - (averagePrerequisiteScore / 100));
  
  return {
    unit,
    conceptId,
    prerequisiteScores,
    weakestPrerequisite,
    averagePrerequisiteScore,
    confidencePenalty
  };
}

/**
 * Check if a unit is blocked (prerequisites not met)
 * @param unit - Instructional unit
 * @param learnerCoverage - Map of concept IDs to coverage scores
 * @param threshold - Minimum score to consider prerequisite "met" (default: 40)
 * @returns Blocked unit info or null if not blocked
 */
function checkUnitBlocked(
  unit: InstructionalUnit,
  learnerCoverage: Map<string, number>,
  threshold: number = 40
): BlockedUnitInfo | null {
  const conceptId = unit.conceptId;
  const graph = buildConceptGraph();
  const node = graph.get(conceptId);
  
  if (!node || node.prerequisites.length === 0) {
    return null; // No prerequisites = not blocked
  }
  
  // Check direct prerequisites
  const missingPrerequisites: string[] = [];
  for (const prereqId of node.prerequisites) {
    const score = learnerCoverage.get(prereqId) || 0;
    if (score < threshold) {
      missingPrerequisites.push(prereqId);
    }
  }
  
  if (missingPrerequisites.length === 0) {
    return null; // All prerequisites met
  }
  
  // Get full blocked chain (missing prerequisites and their prerequisites)
  const blockedByChain = getPrerequisiteChain(conceptId)
    .filter(prereqId => {
      const score = learnerCoverage.get(prereqId) || 0;
      return score < threshold;
    });
  
  // Calculate readiness score (0-100)
  const totalPrereqs = node.prerequisites.length;
  const metPrereqs = totalPrereqs - missingPrerequisites.length;
  const readinessScore = Math.round((metPrereqs / totalPrereqs) * 100);
  
  // Get recommended unlock order (topological sort of missing prerequisites)
  const recommendedUnlockOrder = [...new Set(blockedByChain)].reverse();
  
  return {
    unit,
    conceptId,
    missingPrerequisites,
    blockedByChain: [...new Set(blockedByChain)],
    readinessScore,
    recommendedUnlockOrder
  };
}

/**
 * Sort units by prerequisite strength (weakest prerequisites first for remediation)
 * @param units - Instructional units
 * @param learnerId - Learner identifier
 * @returns Units sorted by prerequisite weakness (weakest first)
 */
function orderUnitsByPrerequisiteWeakness(
  units: InstructionalUnit[],
  learnerId: string
): InstructionalUnit[] {
  const learnerCoverage = getLearnerConceptCoverage(learnerId);
  
  const strengthInfos = units.map(unit => 
    calculatePrerequisiteStrength(unit, learnerCoverage)
  );
  
  return strengthInfos
    .sort((a, b) => a.averagePrerequisiteScore - b.averagePrerequisiteScore)
    .map(info => info.unit);
}

/**
 * Get accessible vs blocked units
 * @param units - All instructional units
 * @param learnerId - Learner identifier
 * @param threshold - Minimum prerequisite score to be "accessible"
 * @returns Tuple of [accessibleUnits, blockedUnits]
 */
function partitionUnitsByAccessibility(
  units: InstructionalUnit[],
  learnerId: string,
  threshold: number = 40
): [InstructionalUnit[], BlockedUnitInfo[]] {
  const learnerCoverage = getLearnerConceptCoverage(learnerId);
  const accessible: InstructionalUnit[] = [];
  const blocked: BlockedUnitInfo[] = [];
  
  for (const unit of units) {
    const blockedInfo = checkUnitBlocked(unit, learnerCoverage, threshold);
    if (blockedInfo) {
      blocked.push(blockedInfo);
    } else {
      accessible.push(unit);
    }
  }
  
  return [accessible, blocked];
}

/**
 * Propagate confidence reduction from weak prerequisites to advanced concepts
 * @param units - Instructional units to adjust
 * @param learnerId - Learner identifier
 * @returns Map of unit ID to confidence penalty (0-1)
 */
function calculateConfidencePropagation(
  units: InstructionalUnit[],
  learnerId: string
): Map<string, number> {
  const learnerCoverage = getLearnerConceptCoverage(learnerId);
  const penalties = new Map<string, number>();
  const graph = buildConceptGraph();
  
  // BFS from root concepts to propagate weakness forward
  const visited = new Set<string>();
  const queue: Array<{ conceptId: string; inheritedWeakness: number }> = [];
  
  // Start with root concepts (no prerequisites)
  for (const [conceptId, node] of graph) {
    if (node.prerequisites.length === 0) {
      const score = learnerCoverage.get(conceptId) || 0;
      const weakness = Math.max(0, 1 - (score / 100));
      queue.push({ conceptId, inheritedWeakness: weakness });
    }
  }
  
  while (queue.length > 0) {
    const { conceptId, inheritedWeakness } = queue.shift()!;
    
    if (visited.has(conceptId)) continue;
    visited.add(conceptId);
    
    const node = graph.get(conceptId);
    if (!node) continue;
    
    // Apply penalty to units with this concept
    for (const unit of units) {
      if (unit.conceptId === conceptId && inheritedWeakness > 0) {
        const currentPenalty = penalties.get(unit.id) || 0;
        penalties.set(unit.id, Math.max(currentPenalty, inheritedWeakness));
      }
    }
    
    // Propagate to unlocked concepts
    for (const unlockedId of node.unlocks) {
      const unlockedNode = graph.get(unlockedId);
      if (!unlockedNode) continue;
      
      // Calculate new inherited weakness
      const unlockedScore = learnerCoverage.get(unlockedId) || 0;
      const unlockedWeakness = Math.max(0, 1 - (unlockedScore / 100));
      
      // Weakness compounds: parent's weakness + child's weakness (capped at 1)
      const compoundedWeakness = Math.min(1, inheritedWeakness * 0.5 + unlockedWeakness);
      
      queue.push({ conceptId: unlockedId, inheritedWeakness: compoundedWeakness });
    }
  }
  
  return penalties;
}

function getConceptDepthMap(): Map<string, number> {
  const byId = new Map(conceptNodes.map((node) => [node.id, node]));
  const memo = new Map<string, number>();

  const visit = (conceptId: string, stack: Set<string>): number => {
    if (memo.has(conceptId)) {
      return memo.get(conceptId)!;
    }
    if (stack.has(conceptId)) {
      return 0;
    }

    const concept = byId.get(conceptId);
    if (!concept || concept.prerequisites.length === 0) {
      memo.set(conceptId, 0);
      return 0;
    }

    stack.add(conceptId);
    const depth = Math.max(
      ...concept.prerequisites.map((prereq) => visit(prereq, stack) + 1),
      0
    );
    stack.delete(conceptId);

    memo.set(conceptId, depth);
    return depth;
  };

  for (const concept of conceptNodes) {
    visit(concept.id, new Set<string>());
  }

  return memo;
}

function orderUnitsByPrerequisite(units: InstructionalUnit[]): InstructionalUnit[] {
  const depthMap = getConceptDepthMap();

  return [...units].sort((a, b) => {
    const depthA = depthMap.get(a.conceptId) ?? 999;
    const depthB = depthMap.get(b.conceptId) ?? 999;
    if (depthA !== depthB) {
      return depthA - depthB;
    }

    const titleDelta = (a.title || '').localeCompare(b.title || '');
    if (titleDelta !== 0) {
      return titleDelta;
    }

    return a.addedTimestamp - b.addedTimestamp;
  });
}

function formatDuration(ms: number): string {
  const minutes = Math.max(1, Math.round(ms / 60000));
  if (minutes < 60) {
    return `${minutes}m`;
  }
  const hours = Math.round(minutes / 60);
  if (hours < 24) {
    return `${hours}h`;
  }
  const days = Math.round(hours / 24);
  return `${days}d`;
}

function buildMisconceptionCards(interactions: InteractionEvent[]): MisconceptionCard[] {
  const grouped = new Map<string, { count: number; lastSeenAt: number; evidenceIds: string[] }>();

  interactions
    .filter((interaction) => interaction.eventType === 'error' || interaction.eventType === 'hint_view' || interaction.eventType === 'explanation_view')
    .forEach((interaction) => {
      const subtype = (interaction.sqlEngageSubtype || interaction.errorSubtypeId || 'unknown-subtype').trim();
      const key = subtype || 'unknown-subtype';
      const current = grouped.get(key) || { count: 0, lastSeenAt: 0, evidenceIds: [] };
      current.count += 1;
      current.lastSeenAt = Math.max(current.lastSeenAt, interaction.timestamp);
      current.evidenceIds.push(interaction.id);
      grouped.set(key, current);
    });

  return [...grouped.entries()]
    .filter(([, stats]) => stats.count >= 2)
    .sort((a, b) => {
      if (a[1].count !== b[1].count) {
        return b[1].count - a[1].count;
      }
      return b[1].lastSeenAt - a[1].lastSeenAt;
    })
    .slice(0, 4)
    .map(([subtype, stats]) => {
      const conceptNames = getConceptIdsForSqlEngageSubtype(subtype)
        .map((conceptId) => getConceptById(conceptId)?.name || conceptId)
        .filter(Boolean);

      return {
        id: `misconception-${sanitizeId(subtype)}`,
        subtype,
        count: stats.count,
        lastSeenAt: stats.lastSeenAt,
        conceptNames,
        evidenceIds: stats.evidenceIds
      };
    });
}

function buildSpacedReviewPrompts(cards: MisconceptionCard[], nowTimestamp: number): SpacedReviewPrompt[] {
  return cards.slice(0, 3).map((card) => {
    const intervalMs = card.count >= 5 ? 60 * 60 * 1000 : card.count >= 3 ? 6 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000;
    const dueAt = card.lastSeenAt + intervalMs;
    const remaining = dueAt - nowTimestamp;
    const isDueNow = remaining <= 0;

    return {
      id: `review-${sanitizeId(card.subtype)}`,
      title: `Review ${card.subtype}`,
      message: isDueNow
        ? `Ready now. You revisited this ${card.count} times.`
        : `Review in ${formatDuration(remaining)} based on recent attempts (${card.count}).`,
      dueAt,
      lastSeenAt: card.lastSeenAt,
      evidenceIds: card.evidenceIds.slice(-6)
    };
  });
}

/**
 * Build comprehensive textbook insights from units and interactions
 * @param options - Units, interactions, sort configuration, and learner info
 * @returns Textbook insights with sorted units, blocked nodes, prerequisite analysis, misconceptions, and review prompts
 */
export function buildTextbookInsights(options: {
  units: InstructionalUnit[];
  interactions: InteractionEvent[];
  nowTimestamp?: number;
  sortMode?: SortMode;
  learnerId?: string; // Required for prerequisite-aware features
  prerequisiteThreshold?: number; // Minimum score to consider prerequisite "met" (default: 40)
}): TextbookInsights {
  const nowTimestamp = options.nowTimestamp ?? Date.now();
  const learnerId = options.learnerId;
  const prerequisiteThreshold = options.prerequisiteThreshold ?? 40;

  // DEBUG: Log inputs
  if (import.meta.env.DEV) {
    console.log('[buildTextbookInsights] DEBUG:', {
      learnerId,
      unitCount: options.units.length,
      interactionCount: options.interactions.length,
      sortMode: options.sortMode
    });
  }

  // Get learner coverage if learnerId provided
  const learnerCoverage = learnerId ? getLearnerConceptCoverage(learnerId) : new Map();

  // DEBUG: Log coverage
  if (import.meta.env.DEV) {
    console.log('[buildTextbookInsights] learnerCoverage.size:', learnerCoverage.size);
  }

  // Partition units into accessible and blocked
  let accessibleUnits: InstructionalUnit[];
  let blockedUnits: BlockedUnitInfo[];
  let prerequisiteStrengths: PrerequisiteStrengthInfo[];

  // When learner has no concept coverage (new learner), treat all units as accessible
  // Don't block units just because prerequisites haven't been recorded yet
  if (learnerId && learnerCoverage.size > 0) {
    if (import.meta.env.DEV) {
      console.log('[buildTextbookInsights] Using partitionUnitsByAccessibility');
    }
    [accessibleUnits, blockedUnits] = partitionUnitsByAccessibility(
      options.units,
      learnerId,
      prerequisiteThreshold
    );

    // Calculate prerequisite strengths for accessible units
    prerequisiteStrengths = accessibleUnits.map(unit =>
      calculatePrerequisiteStrength(unit, learnerCoverage)
    );
  } else {
    // New learner or no coverage data: all units are accessible
    if (import.meta.env.DEV) {
      console.log('[buildTextbookInsights] New learner - all units accessible');
    }
    accessibleUnits = options.units;
    blockedUnits = [];
    prerequisiteStrengths = [];
  }

  // DEBUG: Log accessible units
  if (import.meta.env.DEV) {
    console.log('[buildTextbookInsights] accessibleUnits:', accessibleUnits.length);
  }
  
  // Sort based on selected mode (default to quality-based sorting)
  let orderedUnits: InstructionalUnit[];
  switch (options.sortMode) {
    case 'prerequisite':
      // Enhanced prerequisite ordering that considers learner's current mastery
      if (learnerId) {
        orderedUnits = [
          ...orderUnitsByPrerequisiteWeakness(accessibleUnits, learnerId),
          ...blockedUnits.map(b => b.unit)
        ];
      } else {
        orderedUnits = orderUnitsByPrerequisite(accessibleUnits);
      }
      break;
    case 'newest':
      orderedUnits = orderUnitsByNewest(accessibleUnits);
      break;
    case 'oldest':
      orderedUnits = orderUnitsByOldest(accessibleUnits);
      break;
    case 'quality':
    default:
      orderedUnits = orderUnitsByQuality(accessibleUnits);
      break;
  }
  
  const misconceptionCards = buildMisconceptionCards(options.interactions);
  const spacedReviewPrompts = buildSpacedReviewPrompts(misconceptionCards, nowTimestamp);
  
  // Calculate summary statistics
  const averageStrength = prerequisiteStrengths.length > 0
    ? prerequisiteStrengths.reduce((sum, s) => sum + s.averagePrerequisiteScore, 0) / prerequisiteStrengths.length
    : 100;

  // DEBUG: Log ordered units
  if (import.meta.env.DEV) {
    console.log('[buildTextbookInsights] orderedUnits:', orderedUnits.length);
  }

  return {
    orderedUnits,
    blockedUnits,
    prerequisiteStrengths,
    misconceptionCards,
    spacedReviewPrompts,
    summary: {
      totalUnits: options.units.length,
      accessibleUnits: accessibleUnits.length,
      blockedUnitsCount: blockedUnits.length,
      averagePrerequisiteStrength: Math.round(averageStrength)
    }
  };
}
