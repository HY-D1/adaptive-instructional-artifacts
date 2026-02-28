/**
 * Adaptive Threshold Calculator
 *
 * Dynamically adjusts escalation and aggregation thresholds based on
 * learner history, struggle patterns, concept difficulty, and cognitive strain.
 *
 * @module adaptive-threshold
 * @version escalation-profiles-v1
 */

import type { InteractionEvent } from '../types';

/**
 * Factors used to calculate threshold adjustments
 */
export interface AdjustmentFactors {
  /** Historical recovery rate (0-1), learner's ability to recover from errors */
  historicalRecoveryRate: number;
  /** Pattern of recent errors */
  recentStrugglePattern: 'persistent' | 'oscillatory' | 'improving';
  /** Difficulty level of the current concept */
  conceptDifficulty: 'beginner' | 'intermediate' | 'advanced';
  /** Cognitive Strain Index (optional) - 0-1 scale */
  currentCSI?: number;
}

/**
 * Result of threshold adjustment calculation
 */
export interface AdjustmentResult {
  /** The final adjusted threshold value (minimum 2) */
  adjustedThreshold: number;
  /** The original base threshold */
  baseThreshold: number;
  /** The calculated adjustment amount */
  adjustment: number;
  /** Human-readable reasons for the adjustment */
  reasons: string[];
  /** The factors that influenced the calculation */
  factors: AdjustmentFactors;
}

/**
 * Summary of learner's historical performance
 */
export interface LearnerHistorySummary {
  /** Total number of errors encountered */
  totalErrors: number;
  /** Number of errors where learner recovered without hints */
  errorsRecoveredIndependently: number;
  /** Recent error subtype IDs (last 5) */
  recentErrors: string[];
  /** Average time to recovery in milliseconds */
  averageTimeToRecovery: number;
}

/**
 * Calculate adaptive threshold based on learner factors
 *
 * @param baseThreshold - The starting threshold value
 * @param factors - Adjustment factors from learner analysis
 * @returns AdjustmentResult with the calculated threshold and reasoning
 *
 * @example
 * ```typescript
 * const result = calculateAdaptiveThreshold(4, {
 *   historicalRecoveryRate: 0.8,
 *   recentStrugglePattern: 'improving',
 *   conceptDifficulty: 'intermediate'
 * });
 * // result.adjustedThreshold might be 5 (increased due to good recovery rate)
 * ```
 */
export function calculateAdaptiveThreshold(
  baseThreshold: number,
  factors: AdjustmentFactors
): AdjustmentResult {
  let adjustment = 0;
  const reasons: string[] = [];

  // Factor 1: Historical recovery rate (±30% adjustment)
  // If recoveryRate > 0.7: increase threshold (learner can handle more struggle)
  // If recoveryRate < 0.3: decrease threshold (learner needs more help)
  if (factors.historicalRecoveryRate > 0.7) {
    const recoveryAdjustment = baseThreshold * 0.3;
    adjustment += recoveryAdjustment;
    reasons.push(
      `High recovery rate (${(factors.historicalRecoveryRate * 100).toFixed(0)}%) increases threshold by ${recoveryAdjustment.toFixed(1)}`
    );
  } else if (factors.historicalRecoveryRate < 0.3) {
    const recoveryAdjustment = baseThreshold * 0.3;
    adjustment -= recoveryAdjustment;
    reasons.push(
      `Low recovery rate (${(factors.historicalRecoveryRate * 100).toFixed(0)}%) decreases threshold by ${recoveryAdjustment.toFixed(1)}`
    );
  }

  // Factor 2: Recent struggle pattern (±20% adjustment)
  // If persistent: decrease threshold (need intervention sooner)
  // If improving: increase threshold (learner is making progress)
  if (factors.recentStrugglePattern === 'persistent') {
    const patternAdjustment = baseThreshold * 0.2;
    adjustment -= patternAdjustment;
    reasons.push(
      `Persistent error pattern decreases threshold by ${patternAdjustment.toFixed(1)}`
    );
  } else if (factors.recentStrugglePattern === 'improving') {
    const patternAdjustment = baseThreshold * 0.2;
    adjustment += patternAdjustment;
    reasons.push(
      `Improving pattern increases threshold by ${patternAdjustment.toFixed(1)}`
    );
  }

  // Factor 3: Concept difficulty (±10% adjustment)
  // Advanced concepts: slightly decrease threshold (more scaffolding needed)
  // Beginner concepts: slightly increase threshold (allow more exploration)
  if (factors.conceptDifficulty === 'advanced') {
    const difficultyAdjustment = baseThreshold * 0.1;
    adjustment -= difficultyAdjustment;
    reasons.push(
      `Advanced concept difficulty decreases threshold by ${difficultyAdjustment.toFixed(1)}`
    );
  } else if (factors.conceptDifficulty === 'beginner') {
    const difficultyAdjustment = baseThreshold * 0.1;
    adjustment += difficultyAdjustment;
    reasons.push(
      `Beginner concept difficulty increases threshold by ${difficultyAdjustment.toFixed(1)}`
    );
  }

  // Factor 4: Current CSI (optional, ±20% adjustment)
  // High CSI (>0.7): decrease threshold (speed up help to reduce strain)
  // Low CSI (<0.3): increase threshold (learner not strained)
  if (factors.currentCSI !== undefined) {
    if (factors.currentCSI > 0.7) {
      const csiAdjustment = baseThreshold * 0.2;
      adjustment -= csiAdjustment;
      reasons.push(
        `High cognitive strain (${(factors.currentCSI * 100).toFixed(0)}%) decreases threshold by ${csiAdjustment.toFixed(1)}`
      );
    } else if (factors.currentCSI < 0.3) {
      const csiAdjustment = baseThreshold * 0.2;
      adjustment += csiAdjustment;
      reasons.push(
        `Low cognitive strain (${(factors.currentCSI * 100).toFixed(0)}%) increases threshold by ${csiAdjustment.toFixed(1)}`
      );
    }
  }

  // Ensure minimum threshold of 2 (never go below this)
  const adjustedThreshold = Math.max(2, Math.round(baseThreshold + adjustment));

  return {
    adjustedThreshold,
    baseThreshold,
    adjustment,
    reasons,
    factors,
  };
}

/**
 * Analyze learner interaction history to extract performance metrics
 *
 * @param interactions - Array of learner interaction events
 * @returns Summary of learner's historical performance
 *
 * @example
 * ```typescript
 * const history = analyzeLearnerHistory(interactions);
 * console.log(history.historicalRecoveryRate); // 0.75
 * ```
 */
export function analyzeLearnerHistory(
  interactions: InteractionEvent[]
): LearnerHistorySummary {
  // Handle edge case: empty history
  if (!interactions || interactions.length === 0) {
    return {
      totalErrors: 0,
      errorsRecoveredIndependently: 0,
      recentErrors: [],
      averageTimeToRecovery: 0,
    };
  }

  // Sort by timestamp to process chronologically
  const sortedInteractions = [...interactions].sort(
    (a, b) => a.timestamp - b.timestamp
  );

  // Find all error events
  const errorEvents = sortedInteractions.filter(
    (event) => event.eventType === 'error' && event.errorSubtypeId
  );

  // Count independent recoveries (success without hint after error)
  let independentRecoveries = 0;
  const recoveryTimes: number[] = [];

  for (let i = 0; i < sortedInteractions.length; i++) {
    const event = sortedInteractions[i];

    if (event.eventType === 'error') {
      // Look for subsequent successful execution without hint
      for (let j = i + 1; j < sortedInteractions.length; j++) {
        const nextEvent = sortedInteractions[j];

        // If we see a hint request or explanation view, not independent
        if (
          nextEvent.eventType === 'hint_request' ||
          nextEvent.eventType === 'explanation_view' ||
          nextEvent.eventType === 'guidance_request'
        ) {
          break;
        }

        // If successful execution without help, count as independent recovery
        if (
          nextEvent.eventType === 'execution' &&
          nextEvent.successful === true
        ) {
          independentRecoveries++;
          const recoveryTime = nextEvent.timestamp - event.timestamp;
          if (recoveryTime > 0) {
            recoveryTimes.push(recoveryTime);
          }
          break;
        }

        // If another error occurs, stop looking for this error's recovery
        if (nextEvent.eventType === 'error') {
          break;
        }
      }
    }
  }

  // Extract recent error subtypes (last 5 unique errors)
  const recentErrors = errorEvents
    .slice(-5)
    .map((event) => event.errorSubtypeId!)
    .filter((id): id is string => id !== undefined);

  // Calculate average time to recovery
  const averageTimeToRecovery =
    recoveryTimes.length > 0
      ? recoveryTimes.reduce((sum, time) => sum + time, 0) /
        recoveryTimes.length
      : 0;

  return {
    totalErrors: errorEvents.length,
    errorsRecoveredIndependently: independentRecoveries,
    recentErrors,
    averageTimeToRecovery,
  };
}

/**
 * Detect the pattern of recent errors
 *
 * @param recentErrors - Array of recent error subtype IDs
 * @returns The detected struggle pattern
 *
 * Pattern definitions:
 * - persistent: All errors are the same subtype (stuck on one concept)
 * - oscillatory: Cycling between 2-3 subtypes (confusion between concepts)
 * - improving: Fewer unique errors or single error (learning in progress)
 *
 * @example
 * ```typescript
 * const pattern = detectStrugglePattern(['syntax', 'syntax', 'syntax']);
 * // pattern === 'persistent'
 * ```
 */
export function detectStrugglePattern(
  recentErrors: string[]
): 'persistent' | 'oscillatory' | 'improving' {
  // Handle edge cases
  if (!recentErrors || recentErrors.length === 0) {
    return 'improving';
  }

  if (recentErrors.length === 1) {
    return 'improving';
  }

  // Count occurrences of each error subtype
  const errorCounts = new Map<string, number>();
  for (const error of recentErrors) {
    errorCounts.set(error, (errorCounts.get(error) || 0) + 1);
  }

  const uniqueErrors = Array.from(errorCounts.keys());
  const uniqueCount = uniqueErrors.length;

  // Check for persistent pattern (all same subtype)
  if (uniqueCount === 1) {
    return 'persistent';
  }

  // Check for oscillatory pattern (2-3 subtypes cycling)
  if (uniqueCount >= 2 && uniqueCount <= 3) {
    // Check if errors are evenly distributed (suggesting oscillation)
    const counts = Array.from(errorCounts.values());
    const maxCount = Math.max(...counts);
    const minCount = Math.min(...counts);

    // If relatively balanced distribution, it's oscillatory
    if (maxCount - minCount <= 1 && recentErrors.length >= 4) {
      return 'oscillatory';
    }
  }

  // Default to improving (either few errors or showing variety that suggests learning)
  return 'improving';
}

/**
 * Calculate recovery rate from history summary
 *
 * @param history - Learner history summary
 * @returns Recovery rate between 0 and 1
 */
function calculateRecoveryRate(history: LearnerHistorySummary): number {
  if (history.totalErrors === 0) {
    return 0.5; // Neutral default when no history
  }

  return history.errorsRecoveredIndependently / history.totalErrors;
}

/**
 * Complete adaptive profile calculation
 *
 * Analyzes learner history and current problem context to calculate
 * adjusted thresholds for escalation and aggregation.
 *
 * @param learnerHistory - Array of learner interaction events
 * @param currentProblem - Current problem with difficulty level
 * @returns Object containing adjusted thresholds and reasoning
 *
 * @example
 * ```typescript
 * const thresholds = getAdaptiveProfileThresholds(
 *   interactions,
 *   { difficulty: 'intermediate' }
 * );
 * // thresholds.escalate might be 3 (adjusted from base 4)
 * // thresholds.aggregate might be 6 (adjusted from base 8)
 * ```
 */
export function getAdaptiveProfileThresholds(
  learnerHistory: InteractionEvent[],
  currentProblem: { difficulty: 'beginner' | 'intermediate' | 'advanced' }
): {
  escalate: number;
  aggregate: number;
  adjustmentReasons: string[];
} {
  // Analyze learner history
  const history = analyzeLearnerHistory(learnerHistory);

  // Calculate recovery rate
  const recoveryRate = calculateRecoveryRate(history);

  // Detect struggle pattern from recent errors
  const strugglePattern = detectStrugglePattern(history.recentErrors);

  // Build adjustment factors
  const factors: AdjustmentFactors = {
    historicalRecoveryRate: recoveryRate,
    recentStrugglePattern: strugglePattern,
    conceptDifficulty: currentProblem.difficulty,
  };

  // Base thresholds for escalation and aggregate
  const baseEscalateThreshold = 4;
  const baseAggregateThreshold = 8;

  // Calculate adjusted thresholds
  const escalateResult = calculateAdaptiveThreshold(
    baseEscalateThreshold,
    factors
  );
  const aggregateResult = calculateAdaptiveThreshold(
    baseAggregateThreshold,
    factors
  );

  // Combine reasons
  const adjustmentReasons = [
    `Escalation: ${escalateResult.reasons.join('; ') || 'No adjustment'}`,
    `Aggregate: ${aggregateResult.reasons.join('; ') || 'No adjustment'}`,
    `Based on ${history.totalErrors} total errors, ` +
      `${history.errorsRecoveredIndependently} independent recoveries, ` +
      `pattern: ${strugglePattern}`,
  ];

  return {
    escalate: escalateResult.adjustedThreshold,
    aggregate: aggregateResult.adjustedThreshold,
    adjustmentReasons,
  };
}

/**
 * CSI components breakdown
 */
export interface CSIComponents {
  rapidResubmission: number;
  shortIntervalErrors: number;
  longPauseBeforeHelp: number;
  burstErrorClusters: number;
  escalationDensity: number;
}

/**
 * CSI calculation result
 */
export interface CSIResult {
  csi: number;
  level: 'low' | 'medium' | 'high';
  components: CSIComponents;
}

/**
 * Calculate the Cognitive Strain Index (CSI) from recent interactions
 *
 * CSI is a proxy metric derived from interaction patterns that indicate
 * cognitive load (rapid errors, frequent help requests, long pauses).
 *
 * @param recentInteractions - Recent interaction events (last 10-20)
 * @returns CSIResult with score, level, and component breakdown
 */
export function calculateCSI(
  recentInteractions: InteractionEvent[]
): CSIResult {
  const defaultResult: CSIResult = {
    csi: 0,
    level: 'low',
    components: {
      rapidResubmission: 0,
      shortIntervalErrors: 0,
      longPauseBeforeHelp: 0,
      burstErrorClusters: 0,
      escalationDensity: 0,
    },
  };

  if (!recentInteractions || recentInteractions.length === 0) {
    return defaultResult;
  }

  const interactions = recentInteractions.slice(-10); // Last 10 interactions

  // Factor 1: Rapid re-submission rate (panic/guessing)
  let rapidSubmissions = 0;
  const submissions = interactions.filter((e) => e.eventType === 'execution');
  for (let i = 1; i < submissions.length; i++) {
    const timeDelta = submissions[i].timestamp - submissions[i - 1].timestamp;
    if (timeDelta < 5000) {
      rapidSubmissions++;
    }
  }
  const rapidResubmission =
    submissions.length > 1 ? rapidSubmissions / (submissions.length - 1) : 0;

  // Factor 2: Short interval repeated errors
  const errors = interactions.filter((e) => e.eventType === 'error');
  let shortIntervalErrors = 0;
  for (let i = 1; i < errors.length; i++) {
    const timeDelta = errors[i].timestamp - errors[i - 1].timestamp;
    if (timeDelta < 10000) {
      shortIntervalErrors++;
    }
  }
  const shortIntervalErrorRate =
    errors.length > 1 ? shortIntervalErrors / (errors.length - 1) : 0;

  // Factor 3: Long pause before help
  const helpRequests = interactions.filter(
    (e) =>
      e.eventType === 'hint_request' ||
      e.eventType === 'explanation_view' ||
      e.eventType === 'guidance_request'
  );
  let longPauses = 0;
  for (const help of helpRequests) {
    const previousErrors = interactions.filter(
      (e) => e.eventType === 'error' && e.timestamp < help.timestamp
    );
    if (previousErrors.length > 0) {
      const lastError = previousErrors[previousErrors.length - 1];
      const pause = help.timestamp - lastError.timestamp;
      if (pause > 30000) {
        longPauses++;
      }
    }
  }
  const longPauseBeforeHelp =
    helpRequests.length > 0 ? longPauses / helpRequests.length : 0;

  // Factor 4: Burst error clusters (3+ errors in 60 seconds)
  let burstCount = 0;
  for (let i = 0; i < errors.length; i++) {
    const windowEnd = errors[i].timestamp + 60000;
    const errorsInWindow = errors.filter(
      (e) => e.timestamp >= errors[i].timestamp && e.timestamp <= windowEnd
    ).length;
    if (errorsInWindow >= 3) {
      burstCount++;
    }
  }
  const burstErrorClusters = Math.min(1, burstCount / 3);

  // Factor 5: Escalation density
  const escalations = interactions.filter(
    (e) => e.eventType === 'guidance_escalate'
  ).length;
  const problems = new Set(interactions.map((e) => e.problemId)).size;
  const escalationDensity = problems > 0 ? Math.min(1, escalations / problems) : 0;

  // Calculate weighted CSI
  const csi =
    rapidResubmission * 0.25 +
    shortIntervalErrorRate * 0.25 +
    longPauseBeforeHelp * 0.15 +
    burstErrorClusters * 0.2 +
    escalationDensity * 0.15;

  const normalizedCsi = Math.min(1, Math.max(0, csi));

  return {
    csi: normalizedCsi,
    level: normalizedCsi < 0.3 ? 'low' : normalizedCsi < 0.6 ? 'medium' : 'high',
    components: {
      rapidResubmission,
      shortIntervalErrors: shortIntervalErrorRate,
      longPauseBeforeHelp,
      burstErrorClusters,
      escalationDensity,
    },
  };
}

/**
 * Policy version constant for tracking
 */
export const ADAPTIVE_THRESHOLD_VERSION = 'adaptive-threshold-v1';
