/**
 * Mastery Engine
 * 
 * Defines mastery levels per concept, propagates mastery when prerequisites are met,
 * decays mastery for unused concepts, and updates learner profile with mastery state.
 * 
 * Mastery Levels:
 * - none: No exposure to concept
 * - exposed: Has seen/heard of concept (0-25)
 * - practicing: Has attempted but not mastered (26-60)
 * - mastered: Has demonstrated competency (61-100)
 * 
 * Features:
 * - Define mastery levels per concept
 * - Propagate mastery when prerequisites are met
 * - Decay mastery for unused concepts
 * - Update learner profile with mastery state
 */

import type { LearnerProfile, ConceptCoverageEvidence, InteractionEvent } from '../../types';
import { buildConceptGraph, type ConceptGraph } from '../../data/concept-graph';
import { storage } from '../storage/storage';
import { createEventId } from '../utils/event-id';

export type MasteryLevel = 'none' | 'exposed' | 'practicing' | 'mastered';

export interface ConceptMastery {
  conceptId: string;
  level: MasteryLevel;
  score: number;           // 0-100 mastery score
  confidence: 'low' | 'medium' | 'high';
  lastUpdated: number;
  lastAccessed: number;
  evidence: ConceptCoverageEvidence;
  decayFactor: number;     // 0-1, lower = more decay
}

export interface MasteryUpdate {
  conceptId: string;
  previousLevel: MasteryLevel;
  newLevel: MasteryLevel;
  previousScore: number;
  newScore: number;
  reason: string;
  timestamp: number;
}

export interface MasteryPropagationResult {
  updates: MasteryUpdate[];
  newlyMastered: string[];
  demoted: string[];       // Concepts that dropped a level
  propagatedScores: Map<string, number>; // Additional score from propagation
}

export interface MasterySnapshot {
  learnerId: string;
  timestamp: number;
  masteries: Map<string, ConceptMastery>;
  summary: {
    totalConcepts: number;
    none: number;
    exposed: number;
    practicing: number;
    mastered: number;
    averageScore: number;
  };
}

// Mastery level thresholds
const MASTERY_THRESHOLDS = {
  exposed: 1,      // Any exposure
  practicing: 26,  // Has attempted
  mastered: 61     // Demonstrated competency
};

// Score thresholds for confidence levels
const CONFIDENCE_THRESHOLDS = {
  high: { score: 75, minExecutions: 3 },
  medium: { score: 40, minExecutions: 1 },
  low: { score: 0, minExecutions: 0 }
};

// Decay configuration
const DECAY_CONFIG = {
  enabled: true,
  checkIntervalDays: 7,      // Check for decay weekly
  decayRatePerWeek: 0.05,    // Lose 5% per week of inactivity
  maxDecay: 0.5,             // Max 50% decay
  practiceResetsDecay: true  // Successful practice resets decay
};

// Propagation configuration
const PROPAGATION_CONFIG = {
  enabled: true,
  baseBoost: 10,             // Base score boost for prerequisites met
  multiplier: 0.2,           // 20% of prerequisite score transfers
  maxBonus: 20               // Max bonus from propagation
};

/**
 * Get mastery level from score
 */
export function getMasteryLevel(score: number): MasteryLevel {
  if (score >= MASTERY_THRESHOLDS.mastered) return 'mastered';
  if (score >= MASTERY_THRESHOLDS.practicing) return 'practicing';
  if (score >= MASTERY_THRESHOLDS.exposed) return 'exposed';
  return 'none';
}

/**
 * Get mastery for a specific concept
 * @param conceptId - Concept identifier
 * @param learnerId - Learner identifier
 * @returns Concept mastery or null
 */
export function getConceptMastery(
  conceptId: string,
  learnerId: string
): ConceptMastery | null {
  const profile = storage.getProfile(learnerId);
  if (!profile) return null;
  
  const evidence = profile.conceptCoverageEvidence.get(conceptId);
  if (!evidence) return null;
  
  return buildConceptMastery(conceptId, evidence, profile);
}

/**
 * Get mastery snapshot for a learner
 * @param learnerId - Learner identifier
 * @returns Complete mastery snapshot
 */
export function getMasterySnapshot(learnerId: string): MasterySnapshot {
  const profile = storage.getProfile(learnerId);
  const graph = buildConceptGraph();
  
  const masteries = new Map<string, ConceptMastery>();
  let noneCount = 0;
  let exposedCount = 0;
  let practicingCount = 0;
  let masteredCount = 0;
  let totalScore = 0;
  
  for (const conceptId of graph.keys()) {
    const evidence = profile?.conceptCoverageEvidence.get(conceptId);
    
    if (evidence) {
      const mastery = buildConceptMastery(conceptId, evidence, profile);
      masteries.set(conceptId, mastery);
      totalScore += mastery.score;
      
      switch (mastery.level) {
        case 'none': noneCount++; break;
        case 'exposed': exposedCount++; break;
        case 'practicing': practicingCount++; break;
        case 'mastered': masteredCount++; break;
      }
    } else {
      noneCount++;
      masteries.set(conceptId, {
        conceptId,
        level: 'none',
        score: 0,
        confidence: 'low',
        lastUpdated: 0,
        lastAccessed: 0,
        evidence: createEmptyEvidence(conceptId),
        decayFactor: 1
      });
    }
  }
  
  const total = graph.size;
  
  return {
    learnerId,
    timestamp: Date.now(),
    masteries,
    summary: {
      totalConcepts: total,
      none: noneCount,
      exposed: exposedCount,
      practicing: practicingCount,
      mastered: masteredCount,
      averageScore: total > 0 ? Math.round(totalScore / total) : 0
    }
  };
}

/**
 * Update mastery based on interaction
 * @param event - Interaction event
 * @param learnerId - Learner identifier
 * @returns Mastery updates
 */
export function updateMasteryFromInteraction(
  event: InteractionEvent,
  learnerId: string
): MasteryUpdate[] {
  const profile = storage.getProfile(learnerId);
  if (!profile || !event.conceptIds) return [];
  
  const updates: MasteryUpdate[] = [];
  
  for (const conceptId of event.conceptIds) {
    const previousEvidence = profile.conceptCoverageEvidence.get(conceptId);
    const previousScore = previousEvidence?.score || 0;
    const previousLevel = getMasteryLevel(previousScore);
    
    // Calculate new score based on event type
    let scoreDelta = 0;
    switch (event.eventType) {
      case 'execution':
        if (event.successful) {
          scoreDelta = 15; // Successful execution
        } else {
          scoreDelta = 5;  // Attempted but failed
        }
        break;
      case 'error':
        scoreDelta = 3; // Learning from errors
        break;
      case 'hint_view':
        scoreDelta = 1; // Exposure
        break;
      case 'explanation_view':
        scoreDelta = 2; // Learning from explanation
        break;
      case 'textbook_add':
        scoreDelta = 8; // Taking notes
        break;
    }
    
    // Update evidence in profile
    const newScore = Math.min(100, previousScore + scoreDelta);
    const newLevel = getMasteryLevel(newScore);
    
    if (newScore !== previousScore) {
      const evidence: ConceptCoverageEvidence = {
        conceptId,
        score: newScore,
        confidence: calculateConfidence(newScore, (previousEvidence?.evidenceCounts.successfulExecution || 0) + (event.successful ? 1 : 0)),
        lastUpdated: event.timestamp,
        evidenceCounts: {
          successfulExecution: (previousEvidence?.evidenceCounts.successfulExecution || 0) + (event.successful ? 1 : 0),
          hintViewed: (previousEvidence?.evidenceCounts.hintViewed || 0) + (event.eventType === 'hint_view' ? 1 : 0),
          explanationViewed: (previousEvidence?.evidenceCounts.explanationViewed || 0) + (event.eventType === 'explanation_view' ? 1 : 0),
          errorEncountered: (previousEvidence?.evidenceCounts.errorEncountered || 0) + (event.eventType === 'error' ? 1 : 0),
          notesAdded: (previousEvidence?.evidenceCounts.notesAdded || 0) + (event.eventType === 'textbook_add' ? 1 : 0)
        },
        streakCorrect: event.successful 
          ? (previousEvidence?.streakCorrect || 0) + 1 
          : 0,
        streakIncorrect: !event.successful 
          ? (previousEvidence?.streakIncorrect || 0) + 1 
          : 0
      };
      
      profile.conceptCoverageEvidence.set(conceptId, evidence);
      
      // Track in conceptsCovered if practicing or above
      if (newLevel !== 'none') {
        profile.conceptsCovered.add(conceptId);
      }
      
      // Log update if level changed
      if (newLevel !== previousLevel) {
        const update: MasteryUpdate = {
          conceptId,
          previousLevel,
          newLevel,
          previousScore,
          newScore,
          reason: `Interaction: ${event.eventType}`,
          timestamp: event.timestamp
        };
        updates.push(update);
        logMasteryUpdate(update, learnerId, event.problemId);
      }
    }
  }
  
  // Save updated profile
  storage.saveProfile(profile);
  
  return updates;
}

/**
 * Propagate mastery through the concept graph
 * When prerequisites are mastered, boost dependent concepts
 * @param learnerId - Learner identifier
 * @returns Propagation results
 */
export function propagateMastery(learnerId: string): MasteryPropagationResult {
  if (!PROPAGATION_CONFIG.enabled) {
    return { updates: [], newlyMastered: [], demoted: [], propagatedScores: new Map() };
  }
  
  const profile = storage.getProfile(learnerId);
  const graph = buildConceptGraph();
  
  if (!profile) {
    return { updates: [], newlyMastered: [], demoted: [], propagatedScores: new Map() };
  }
  
  const updates: MasteryUpdate[] = [];
  const newlyMastered: string[] = [];
  const propagatedScores = new Map<string, number>();
  
  // Find concepts whose prerequisites are all mastered
  for (const [conceptId, node] of graph) {
    const currentEvidence = profile.conceptCoverageEvidence.get(conceptId);
    if (!currentEvidence) continue;
    
    // Check if all prerequisites are mastered
    const prereqScores = node.prerequisites.map(prereqId => {
      const prereqEvidence = profile.conceptCoverageEvidence.get(prereqId);
      return prereqEvidence?.score || 0;
    });
    
    const allPrereqsMastered = prereqScores.every(score => 
      score >= MASTERY_THRESHOLDS.mastered
    );
    
    if (allPrereqsMastered && node.prerequisites.length > 0) {
      // Calculate propagation bonus
      const avgPrereqScore = prereqScores.reduce((a, b) => a + b, 0) / prereqScores.length;
      const bonus = Math.min(
        PROPAGATION_CONFIG.maxBonus,
        PROPAGATION_CONFIG.baseBoost + avgPrereqScore * PROPAGATION_CONFIG.multiplier
      );
      
      const previousScore = currentEvidence.score;
      const newScore = Math.min(100, previousScore + bonus);
      
      if (newScore > previousScore) {
        propagatedScores.set(conceptId, bonus);
        
        const previousLevel = getMasteryLevel(previousScore);
        const newLevel = getMasteryLevel(newScore);
        
        // Update evidence
        currentEvidence.score = newScore;
        currentEvidence.lastUpdated = Date.now();
        
        // Track updates
        if (newLevel !== previousLevel) {
          const update: MasteryUpdate = {
            conceptId,
            previousLevel,
            newLevel,
            previousScore,
            newScore,
            reason: 'Prerequisite mastery propagation',
            timestamp: Date.now()
          };
          updates.push(update);
          logMasteryUpdate(update, learnerId, 'propagation');
          
          if (newLevel === 'mastered' && previousLevel !== 'mastered') {
            newlyMastered.push(conceptId);
          }
        }
      }
    }
  }
  
  // Save updated profile
  storage.saveProfile(profile);
  
  return {
    updates,
    newlyMastered,
    demoted: [], // TODO: Implement demotion logic
    propagatedScores
  };
}

/**
 * Apply mastery decay for unused concepts
 * @param learnerId - Learner identifier
 * @returns Concepts that were decayed
 */
export function applyMasteryDecay(learnerId: string): Array<{
  conceptId: string;
  previousScore: number;
  newScore: number;
  weeksInactive: number;
}> {
  if (!DECAY_CONFIG.enabled) return [];
  
  const profile = storage.getProfile(learnerId);
  if (!profile) return [];
  
  const now = Date.now();
  const decayed: Array<{
    conceptId: string;
    previousScore: number;
    newScore: number;
    weeksInactive: number;
  }> = [];
  
  for (const [conceptId, evidence] of profile.conceptCoverageEvidence) {
    const weeksInactive = (now - evidence.lastUpdated) / (7 * 24 * 60 * 60 * 1000);
    
    if (weeksInactive >= 1) {
      const decayAmount = Math.min(
        DECAY_CONFIG.maxDecay * 100,
        weeksInactive * DECAY_CONFIG.decayRatePerWeek * 100
      );
      
      const previousScore = evidence.score;
      const newScore = Math.max(0, previousScore - decayAmount);
      
      if (newScore < previousScore) {
        evidence.score = newScore;
        evidence.lastUpdated = now;
        
        decayed.push({
          conceptId,
          previousScore,
          newScore,
          weeksInactive: Math.floor(weeksInactive)
        });
        
        // Log decay
        logMasteryUpdate({
          conceptId,
          previousLevel: getMasteryLevel(previousScore),
          newLevel: getMasteryLevel(newScore),
          previousScore,
          newScore,
          reason: `Inactivity decay (${Math.floor(weeksInactive)} weeks)`,
          timestamp: now
        }, learnerId, 'decay');
      }
    }
  }
  
  if (decayed.length > 0) {
    storage.saveProfile(profile);
  }
  
  return decayed;
}

/**
 * Get concepts needing review (decayed or weak)
 * @param learnerId - Learner identifier
 * @returns Concepts needing review
 */
export function getConceptsNeedingReview(
  learnerId: string
): Array<{
  conceptId: string;
  currentLevel: MasteryLevel;
  score: number;
  lastAccessed: number;
  reason: string;
}> {
  const profile = storage.getProfile(learnerId);
  if (!profile) return [];
  
  const review: Array<{
    conceptId: string;
    currentLevel: MasteryLevel;
    score: number;
    lastAccessed: number;
    reason: string;
  }> = [];
  
  const now = Date.now();
  
  for (const [conceptId, evidence] of profile.conceptCoverageEvidence) {
    const weeksSincePractice = (now - evidence.lastUpdated) / (7 * 24 * 60 * 60 * 1000);
    const level = getMasteryLevel(evidence.score);
    
    // Check for decay risk
    if (weeksSincePractice >= 2 && evidence.score >= MASTERY_THRESHOLDS.mastered) {
      review.push({
        conceptId,
        currentLevel: level,
        score: evidence.score,
        lastAccessed: evidence.lastUpdated,
        reason: `${Math.floor(weeksSincePractice)} weeks since last practice`
      });
    }
    // Check for weak mastery
    else if (evidence.score < MASTERY_THRESHOLDS.practicing && evidence.score > 0) {
      review.push({
        conceptId,
        currentLevel: level,
        score: evidence.score,
        lastAccessed: evidence.lastUpdated,
        reason: 'Weak mastery - needs reinforcement'
      });
    }
  }
  
  // Sort by urgency (lower score = more urgent)
  return review.sort((a, b) => a.score - b.score);
}

/**
 * Build concept mastery from evidence
 */
function buildConceptMastery(
  conceptId: string,
  evidence: ConceptCoverageEvidence,
  profile: LearnerProfile
): ConceptMastery {
  const level = getMasteryLevel(evidence.score);
  
  // Calculate decay factor based on last access
  const weeksSinceAccess = (Date.now() - evidence.lastUpdated) / (7 * 24 * 60 * 60 * 1000);
  const decayFactor = Math.max(0, 1 - weeksSinceAccess * DECAY_CONFIG.decayRatePerWeek);
  
  return {
    conceptId,
    level,
    score: evidence.score,
    confidence: evidence.confidence,
    lastUpdated: evidence.lastUpdated,
    lastAccessed: evidence.lastUpdated,
    evidence,
    decayFactor
  };
}

/**
 * Create empty evidence for concepts with no data
 */
function createEmptyEvidence(conceptId: string): ConceptCoverageEvidence {
  return {
    conceptId,
    score: 0,
    confidence: 'low',
    lastUpdated: 0,
    evidenceCounts: {
      successfulExecution: 0,
      hintViewed: 0,
      explanationViewed: 0,
      errorEncountered: 0,
      notesAdded: 0
    },
    streakCorrect: 0,
    streakIncorrect: 0
  };
}

/**
 * Calculate confidence level from score and executions
 */
function calculateConfidence(
  score: number,
  successfulExecutions: number
): 'low' | 'medium' | 'high' {
  if (score >= CONFIDENCE_THRESHOLDS.high.score && 
      successfulExecutions >= CONFIDENCE_THRESHOLDS.high.minExecutions) {
    return 'high';
  }
  if (score >= CONFIDENCE_THRESHOLDS.medium.score && 
      successfulExecutions >= CONFIDENCE_THRESHOLDS.medium.minExecutions) {
    return 'medium';
  }
  return 'low';
}

/**
 * Log mastery update event
 */
function logMasteryUpdate(
  update: MasteryUpdate,
  learnerId: string,
  problemId: string
): void {
  const event: InteractionEvent = {
    id: createEventId('mastery', 'update'),
    sessionId: storage.getActiveSessionId(),
    learnerId,
    timestamp: update.timestamp,
    eventType: 'mastery_updated',
    problemId,
    conceptIds: [update.conceptId],
    metadata: {
      previousLevel: update.previousLevel,
      newLevel: update.newLevel,
      previousScore: update.previousScore,
      newScore: update.newScore,
      reason: update.reason
    }
  };
  
  storage.saveInteraction(event);
}

/**
 * Get mastery statistics
 * @param learnerId - Learner identifier
 * @returns Mastery statistics
 */
export function getMasteryStats(learnerId: string): {
  totalConcepts: number;
  byLevel: Record<MasteryLevel, number>;
  averageScore: number;
  conceptsAtRisk: number;
  recentlyMastered: number;
} {
  const snapshot = getMasterySnapshot(learnerId);
  
  const now = Date.now();
  const recentlyMastered = Array.from(snapshot.masteries.values()).filter(m => {
    return m.level === 'mastered' && 
           (now - m.lastUpdated) < (7 * 24 * 60 * 60 * 1000); // Within last week
  }).length;
  
  const conceptsAtRisk = Array.from(snapshot.masteries.values()).filter(m => {
    const weeksSinceAccess = (now - m.lastUpdated) / (7 * 24 * 60 * 60 * 1000);
    return m.level === 'mastered' && weeksSinceAccess >= 2;
  }).length;
  
  return {
    totalConcepts: snapshot.summary.totalConcepts,
    byLevel: {
      none: snapshot.summary.none,
      exposed: snapshot.summary.exposed,
      practicing: snapshot.summary.practicing,
      mastered: snapshot.summary.mastered
    },
    averageScore: snapshot.summary.averageScore,
    conceptsAtRisk,
    recentlyMastered
  };
}
