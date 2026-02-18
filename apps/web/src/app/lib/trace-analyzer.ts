/**
 * Trace Analyzer - Continuous Background Concept Extraction
 * 
 * This module provides background analysis of interaction traces to identify
 * patterns and emerging concepts. It periodically scans interactions to:
 * - Detect repeated error patterns (>3 same subtype)
 * - Identify concept gaps (concepts with no textbook units)
 * - Suggest new units based on pattern frequency
 */

import {
  InteractionEvent,
  InstructionalUnit,
  AnalysisResult,
  PatternMatch,
  ConceptGap,
  UnitRecommendation
} from '../types';
import { storage } from './storage';
import { createEventId } from './event-id';
import { canonicalizeSqlEngageSubtype, getConceptIdsForSqlEngageSubtype } from '../data/sql-engage';

// Constants for analysis configuration
const ANALYSIS_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
const MIN_PATTERN_FREQUENCY = 3; // Minimum occurrences to be considered a pattern
const ERROR_SUBTYPE_WINDOW_MS = 30 * 60 * 1000; // 30 minutes window for recent errors

// Background analysis state
interface BackgroundAnalysisState {
  intervalId: number | null;
  lastAnalysisTime: number;
  isRunning: boolean;
  analyzedPatterns: Set<string>; // Track already-analyzed pattern signatures
}

const state: BackgroundAnalysisState = {
  intervalId: null,
  lastAnalysisTime: 0,
  isRunning: false,
  analyzedPatterns: new Set()
};

/**
 * Analyze interaction traces to identify patterns and concept gaps.
 * 
 * Algorithm:
 * 1. Group errors by subtype
 * 2. Find subtypes with >3 occurrences and no textbook unit
 * 3. Recommend unit creation for gaps
 * 4. Return recommendations
 */
export function analyzeInteractionTraces(
  interactions: InteractionEvent[],
  textbookUnits: InstructionalUnit[],
  options?: {
    minFrequency?: number;
    timeWindowMs?: number;
    learnerId?: string;
  }
): AnalysisResult {
  const minFrequency = options?.minFrequency ?? MIN_PATTERN_FREQUENCY;
  const timeWindowMs = options?.timeWindowMs ?? ERROR_SUBTYPE_WINDOW_MS;
  const learnerId = options?.learnerId;
  const now = Date.now();
  
  // Filter interactions by time window and learner
  const cutoffTime = now - timeWindowMs;
  const relevantInteractions = interactions.filter(i => {
    if (i.timestamp < cutoffTime) return false;
    if (learnerId && i.learnerId !== learnerId) return false;
    return true;
  });

  // 1. Group errors by subtype
  const errorPatterns = extractErrorPatterns(relevantInteractions, minFrequency);
  
  // 2. Detect concept gaps
  const conceptGaps = detectConceptGaps(relevantInteractions, textbookUnits, errorPatterns);
  
  // 3. Generate recommendations based on patterns and gaps
  const recommendations = generateRecommendations(errorPatterns, conceptGaps, textbookUnits);
  
  // 4. Calculate summary statistics
  const summary = calculateSummary(errorPatterns, conceptGaps, recommendations, relevantInteractions);

  return {
    timestamp: now,
    learnerId,
    patterns: errorPatterns,
    conceptGaps,
    recommendations,
    summary
  };
}

/**
 * Extract error patterns from interactions, grouping by subtype and frequency.
 */
function extractErrorPatterns(
  interactions: InteractionEvent[],
  minFrequency: number
): PatternMatch[] {
  const subtypeCounts = new Map<string, {
    count: number;
    interactions: InteractionEvent[];
    conceptIds: Set<string>;
  }>();

  // Count error occurrences by subtype
  for (const interaction of interactions) {
    if (interaction.eventType !== 'error') continue;
    
    const subtype = canonicalizeSqlEngageSubtype(
      interaction.sqlEngageSubtype || interaction.errorSubtypeId
    );
    if (!subtype) continue;

    const existing = subtypeCounts.get(subtype);
    if (existing) {
      existing.count++;
      existing.interactions.push(interaction);
      // Track associated concept IDs
      const conceptIds = getConceptIdsForSqlEngageSubtype(subtype);
      conceptIds.forEach(id => existing.conceptIds.add(id));
    } else {
      const conceptIds = getConceptIdsForSqlEngageSubtype(subtype);
      subtypeCounts.set(subtype, {
        count: 1,
        interactions: [interaction],
        conceptIds: new Set(conceptIds)
      });
    }
  }

  // Convert to pattern matches (only those meeting frequency threshold)
  const patterns: PatternMatch[] = [];
  for (const [subtype, data] of subtypeCounts.entries()) {
    if (data.count >= minFrequency) {
      patterns.push({
        type: 'error_subtype',
        key: subtype,
        frequency: data.count,
        confidence: calculatePatternConfidence(data.count, data.interactions),
        interactions: data.interactions.map(i => i.id),
        conceptIds: Array.from(data.conceptIds),
        firstSeen: Math.min(...data.interactions.map(i => i.timestamp)),
        lastSeen: Math.max(...data.interactions.map(i => i.timestamp))
      });
    }
  }

  // Sort by frequency (descending)
  return patterns.sort((a, b) => b.frequency - a.frequency);
}

/**
 * Calculate confidence level for a pattern based on frequency and spread.
 */
function calculatePatternConfidence(
  count: number,
  interactions: InteractionEvent[]
): 'high' | 'medium' | 'low' {
  // High confidence: frequent and spread across time (not clustered)
  if (count >= 5) {
    const timestamps = interactions.map(i => i.timestamp).sort((a, b) => a - b);
    const timeSpan = timestamps[timestamps.length - 1] - timestamps[0];
    // If spread over more than 5 minutes, high confidence
    if (timeSpan > 5 * 60 * 1000) return 'high';
  }
  
  // Medium confidence: meets minimum threshold
  if (count >= MIN_PATTERN_FREQUENCY) return 'medium';
  
  return 'low';
}

/**
 * Detect concept gaps - concepts that have error patterns but no textbook units.
 */
function detectConceptGaps(
  interactions: InteractionEvent[],
  textbookUnits: InstructionalUnit[],
  patterns: PatternMatch[]
): ConceptGap[] {
  // Build set of concept IDs covered by existing textbook units
  const coveredConcepts = new Set<string>();
  for (const unit of textbookUnits) {
    coveredConcepts.add(unit.conceptId);
    if (unit.conceptIds) {
      unit.conceptIds.forEach(id => coveredConcepts.add(id));
    }
  }

  // Build concept frequency map from interactions
  const conceptFrequency = new Map<string, {
    count: number;
    relatedSubtypes: Set<string>;
    interactions: Set<string>;
  }>();

  for (const interaction of interactions) {
    const subtype = canonicalizeSqlEngageSubtype(
      interaction.sqlEngageSubtype || interaction.errorSubtypeId
    );
    if (!subtype) continue;

    const conceptIds = getConceptIdsForSqlEngageSubtype(subtype);
    for (const conceptId of conceptIds) {
      const existing = conceptFrequency.get(conceptId);
      if (existing) {
        existing.count++;
        existing.relatedSubtypes.add(subtype);
        existing.interactions.add(interaction.id);
      } else {
        conceptFrequency.set(conceptId, {
          count: 1,
          relatedSubtypes: new Set([subtype]),
          interactions: new Set([interaction.id])
        });
      }
    }
  }

  // Identify gaps: concepts with interactions but no textbook coverage
  const gaps: ConceptGap[] = [];
  for (const [conceptId, data] of conceptFrequency.entries()) {
    if (!coveredConcepts.has(conceptId) && data.count >= 2) {
      gaps.push({
        conceptId,
        relatedSubtypes: Array.from(data.relatedSubtypes),
        interactionCount: data.count,
        interactionIds: Array.from(data.interactions),
        priority: calculateGapPriority(data.count, data.relatedSubtypes.size)
      });
    }
  }

  // Sort by priority (descending)
  return gaps.sort((a, b) => {
    const priorityOrder = { high: 3, medium: 2, low: 1 };
    return priorityOrder[b.priority] - priorityOrder[a.priority];
  });
}

/**
 * Calculate priority level for a concept gap.
 */
function calculateGapPriority(
  interactionCount: number,
  subtypeVariety: number
): 'high' | 'medium' | 'low' {
  // High priority: many interactions or multiple error subtypes
  if (interactionCount >= 5 || subtypeVariety >= 2) return 'high';
  // Medium priority: moderate interaction count
  if (interactionCount >= 3) return 'medium';
  return 'low';
}

/**
 * Generate recommendations for unit creation based on patterns and gaps.
 */
function generateRecommendations(
  patterns: PatternMatch[],
  gaps: ConceptGap[],
  textbookUnits: InstructionalUnit[]
): UnitRecommendation[] {
  const recommendations: UnitRecommendation[] = [];
  const now = Date.now();

  // Generate recommendations from high-frequency patterns
  for (const pattern of patterns) {
    // Skip if we already have a unit for this concept
    const hasExistingUnit = pattern.conceptIds.some(conceptId =>
      textbookUnits.some(unit => 
        unit.conceptId === conceptId || 
        (unit.conceptIds?.includes(conceptId) ?? false)
      )
    );

    if (!hasExistingUnit) {
      recommendations.push({
        id: `rec-pattern-${pattern.key}-${now}`,
        type: 'pattern_based',
        conceptIds: pattern.conceptIds,
        priority: pattern.confidence === 'high' ? 'high' : 'medium',
        reason: `Error pattern "${pattern.key}" occurred ${pattern.frequency} times`,
        sourcePattern: pattern,
        suggestedTemplate: pattern.frequency >= 5 ? 'explanation.v1' : 'notebook_unit.v1',
        estimatedImpact: pattern.frequency * 10 // Rough impact score
      });
    }
  }

  // Generate recommendations from concept gaps
  for (const gap of gaps) {
    // Check if this gap is already covered by a pattern-based recommendation
    const alreadyRecommended = recommendations.some(rec =>
      rec.conceptIds.includes(gap.conceptId)
    );

    if (!alreadyRecommended) {
      recommendations.push({
        id: `rec-gap-${gap.conceptId}-${now}`,
        type: 'concept_gap',
        conceptIds: [gap.conceptId],
        priority: gap.priority,
        reason: `Concept "${gap.conceptId}" has ${gap.interactionCount} interactions but no textbook unit`,
        sourceGap: gap,
        suggestedTemplate: 'notebook_unit.v1',
        estimatedImpact: gap.interactionCount * 5
      });
    }
  }

  // Sort by priority and impact
  const priorityOrder = { high: 3, medium: 2, low: 1 };
  return recommendations.sort((a, b) => {
    const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority];
    if (priorityDiff !== 0) return priorityDiff;
    return b.estimatedImpact - a.estimatedImpact;
  });
}

/**
 * Calculate summary statistics for the analysis.
 */
function calculateSummary(
  patterns: PatternMatch[],
  gaps: ConceptGap[],
  recommendations: UnitRecommendation[],
  interactions: InteractionEvent[]
) {
  const errorCount = interactions.filter(i => i.eventType === 'error').length;
  const uniqueSubtypes = new Set(
    interactions
      .filter(i => i.eventType === 'error')
      .map(i => canonicalizeSqlEngageSubtype(i.sqlEngageSubtype || i.errorSubtypeId))
      .filter(Boolean)
  ).size;

  return {
    totalInteractionsAnalyzed: interactions.length,
    errorCount,
    uniqueErrorSubtypes: uniqueSubtypes,
    patternsDetected: patterns.length,
    conceptGapsFound: gaps.length,
    recommendationsGenerated: recommendations.length,
    highPriorityRecommendations: recommendations.filter(r => r.priority === 'high').length
  };
}

/**
 * Log analysis results to storage with 'concept_extraction' event type.
 */
export function logAnalysisResults(
  result: AnalysisResult,
  sessionId?: string
): void {
  const event: InteractionEvent = {
    id: createEventId('analysis', 'concept-extraction'),
    sessionId,
    learnerId: result.learnerId || 'system',
    timestamp: Date.now(),
    eventType: 'concept_extraction',
    problemId: 'analysis',
    inputs: {
      interactions_analyzed: result.summary.totalInteractionsAnalyzed,
      error_count: result.summary.errorCount,
      unique_subtypes: result.summary.uniqueErrorSubtypes,
      analysis_window_ms: ERROR_SUBTYPE_WINDOW_MS
    },
    outputs: {
      patterns_detected: result.patterns.length,
      concept_gaps_found: result.conceptGaps.length,
      recommendations_generated: result.recommendations.length,
      high_priority_recommendations: result.summary.highPriorityRecommendations,
      pattern_keys: result.patterns.map(p => p.key),
      gap_concept_ids: result.conceptGaps.map(g => g.conceptId),
      recommendation_ids: result.recommendations.map(r => r.id)
    },
    conceptIds: [
      ...result.patterns.flatMap(p => p.conceptIds),
      ...result.conceptGaps.map(g => g.conceptId)
    ].filter((id, idx, arr) => arr.indexOf(id) === idx) // Deduplicate
  };

  storage.saveInteraction(event);
}

/**
 * Start continuous background analysis.
 * Call this when a session starts.
 */
export function startBackgroundAnalysis(
  learnerId: string,
  sessionId: string,
  options?: {
    intervalMs?: number;
    onAnalysisComplete?: (result: AnalysisResult) => void;
  }
): () => void {
  // Stop any existing analysis
  stopBackgroundAnalysis();

  const intervalMs = options?.intervalMs ?? ANALYSIS_INTERVAL_MS;
  state.isRunning = true;
  state.lastAnalysisTime = Date.now();

  // Perform initial analysis immediately
  performAnalysis(learnerId, sessionId, options?.onAnalysisComplete);

  // Schedule periodic analysis
  state.intervalId = window.setInterval(() => {
    performAnalysis(learnerId, sessionId, options?.onAnalysisComplete);
  }, intervalMs);

  // Return cleanup function
  return () => stopBackgroundAnalysis();
}

/**
 * Stop the background analysis interval.
 */
export function stopBackgroundAnalysis(): void {
  if (state.intervalId !== null) {
    window.clearInterval(state.intervalId);
    state.intervalId = null;
  }
  state.isRunning = false;
}

/**
 * Check if background analysis is currently running.
 */
export function isBackgroundAnalysisRunning(): boolean {
  return state.isRunning;
}

/**
 * Get the last analysis timestamp.
 */
export function getLastAnalysisTime(): number {
  return state.lastAnalysisTime;
}

/**
 * Perform a single analysis run.
 */
function performAnalysis(
  learnerId: string,
  sessionId: string,
  onComplete?: (result: AnalysisResult) => void
): void {
  if (state.isRunning && document.hidden) {
    // Skip analysis when tab is not visible to save resources
    return;
  }

  state.lastAnalysisTime = Date.now();

  // Get data from storage
  const allInteractions = storage.getInteractionsByLearner(learnerId);
  const textbookUnits = storage.getTextbook(learnerId);

  // Run analysis
  const result = analyzeInteractionTraces(allInteractions, textbookUnits, {
    learnerId,
    minFrequency: MIN_PATTERN_FREQUENCY,
    timeWindowMs: ERROR_SUBTYPE_WINDOW_MS
  });

  // Log results
  if (result.patterns.length > 0 || result.conceptGaps.length > 0) {
    logAnalysisResults(result, sessionId);
  }

  // Call completion callback
  if (onComplete) {
    onComplete(result);
  }

  // Log to console in development
  if (process.env.NODE_ENV === 'development') {
    console.log('[TraceAnalyzer] Analysis complete:', {
      patterns: result.patterns.length,
      gaps: result.conceptGaps.length,
      recommendations: result.recommendations.length
    });
  }
}

/**
 * Run analysis once (for manual triggers or testing).
 */
export function runAnalysisOnce(
  learnerId: string,
  sessionId?: string
): AnalysisResult {
  const allInteractions = storage.getInteractionsByLearner(learnerId);
  const textbookUnits = storage.getTextbook(learnerId);

  const result = analyzeInteractionTraces(allInteractions, textbookUnits, {
    learnerId,
    minFrequency: MIN_PATTERN_FREQUENCY,
    timeWindowMs: ERROR_SUBTYPE_WINDOW_MS
  });

  logAnalysisResults(result, sessionId);
  return result;
}

/**
 * Clear analyzed patterns cache (useful for testing).
 */
export function clearAnalyzedPatternsCache(): void {
  state.analyzedPatterns.clear();
}
