/**
 * Replay Metrics Framework
 * 
 * Comprehensive metrics calculation for experimental replay analysis.
 * Computes coverage, dependency, efficiency, and learning outcome metrics.
 * 
 * Version: replay-metrics-v1
 * 
 * @module replay/replay-metrics
 */

import type { InteractionEvent, HDIComponents } from '../../types';
import { calculateHDI, calculateHDIComponents } from '../ml/hdi-calculator';

/**
 * Comprehensive replay metrics for policy comparison
 */
export interface ReplayMetrics {
  // Coverage metrics
  /** Rate of concept coverage (0-1) */
  conceptCoverageRate: number;
  /** Total unique concepts encountered */
  conceptsEncountered: string[];
  /** Concepts considered mastered (based on successful attempts) */
  conceptsMastered: string[];
  
  // Explanation metrics
  /** Rate of explanation requests vs total help requests (0-1) */
  explanationRequestRate: number;
  /** Average rung reached (1-3, normalized 0-1) */
  averageEscalationDepth: number;
  /** Total help requests made */
  totalHelpRequests: number;
  
  // Dependency metrics
  /** Hint Dependency Index (0-1, higher = more dependent) */
  hintDependencyIndex: number;
  /** Rate of success without hints (0-1) */
  independentSuccessRate: number;
  /** Detailed HDI components */
  hdiComponents: HDIComponents;
  
  // Efficiency proxies
  /** Average time from error to success in ms */
  averageTimeToSuccess: number;
  /** Total session time in ms */
  totalSessionTime: number;
  /** Average interactions per problem */
  interactionsPerProblem: number;
  /** Time to first success per problem */
  timeToFirstSuccess: number;
  
  // Learning outcomes
  /** Rate of error reduction (later vs earlier, 0-1) */
  errorReductionRate: number;
  /** Estimated retention score based on reinforcement (0-1) */
  retentionEstimate: number;
  /** Success rate on first attempt per problem */
  firstAttemptSuccessRate: number;
  
  // Problem statistics
  /** Total problems attempted */
  totalProblems: number;
  /** Problems solved successfully */
  problemsSolved: number;
  /** Total errors made */
  totalErrors: number;
  /** Total hints viewed */
  totalHintsViewed: number;
  /** Total explanations viewed */
  totalExplanationsViewed: number;
}

/**
 * Problem-level statistics for detailed analysis
 */
export interface ProblemMetrics {
  problemId: string;
  attempts: number;
  errors: number;
  hintsViewed: number;
  explanationsViewed: number;
  timeSpent: number;
  solved: boolean;
  firstAttemptSuccess: boolean;
  conceptsEncountered: string[];
}

/**
 * Learner-level aggregated metrics
 */
export interface LearnerMetrics {
  learnerId: string;
  sessionCount: number;
  totalInteractions: number;
  overallHDI: number;
  hdiTrend: 'improving' | 'stable' | 'declining';
  averageSessionMetrics: ReplayMetrics;
  problemMetrics: ProblemMetrics[];
}

/**
 * Policy comparison result
 */
export interface PolicyComparisonResult {
  policyId: string;
  traceCount: number;
  aggregateMetrics: ReplayMetrics;
  learnerMetrics: LearnerMetrics[];
  problemLevelStats: Record<string, {
    attempts: number;
    successRate: number;
    averageTime: number;
  }>;
}

/**
 * Compute comprehensive metrics from an interaction trace
 * 
 * @param trace - Array of interaction events
 * @returns Complete metrics object
 */
export function computeMetrics(trace: InteractionEvent[]): ReplayMetrics {
  if (!trace || trace.length === 0) {
    return getEmptyMetrics();
  }

  // Sort by timestamp for chronological analysis
  const sorted = [...trace].sort((a, b) => a.timestamp - b.timestamp);
  
  // Problem-level aggregation
  const problemStats = computeProblemStats(sorted);
  
  // Coverage metrics
  const coverage = computeCoverageMetrics(sorted);
  
  // Explanation metrics
  const explanation = computeExplanationMetrics(sorted);
  
  // Dependency metrics (HDI)
  const hdi = calculateHDI(sorted);
  
  // Efficiency metrics
  const efficiency = computeEfficiencyMetrics(sorted, problemStats);
  
  // Learning outcomes
  const outcomes = computeLearningOutcomes(sorted, problemStats);
  
  // Basic counts
  const counts = computeBasicCounts(sorted);
  
  return {
    // Coverage
    conceptCoverageRate: coverage.coverageRate,
    conceptsEncountered: coverage.encountered,
    conceptsMastered: coverage.mastered,
    
    // Explanation
    explanationRequestRate: explanation.requestRate,
    averageEscalationDepth: explanation.avgDepth,
    totalHelpRequests: explanation.totalRequests,
    
    // Dependency
    hintDependencyIndex: hdi.hdi,
    independentSuccessRate: hdi.components.iwh,
    hdiComponents: hdi.components,
    
    // Efficiency
    averageTimeToSuccess: efficiency.avgTimeToSuccess,
    totalSessionTime: efficiency.totalTime,
    interactionsPerProblem: efficiency.interactionsPerProblem,
    timeToFirstSuccess: efficiency.timeToFirstSuccess,
    
    // Learning outcomes
    errorReductionRate: outcomes.errorReduction,
    retentionEstimate: outcomes.retention,
    firstAttemptSuccessRate: outcomes.firstAttemptSuccess,
    
    // Problem stats
    totalProblems: Object.keys(problemStats).length,
    problemsSolved: Object.values(problemStats).filter(p => p.solved).length,
    totalErrors: counts.errors,
    totalHintsViewed: counts.hints,
    totalExplanationsViewed: counts.explanations
  };
}

/**
 * Compute metrics for a specific policy across multiple traces
 * 
 * @param traces - Array of interaction traces
 * @param policyId - Policy being evaluated
 * @returns Policy comparison result
 */
export function computePolicyMetrics(
  traces: InteractionEvent[][],
  policyId: string
): PolicyComparisonResult {
  const individualMetrics = traces.map(trace => computeMetrics(trace));
  
  // Aggregate across all traces
  const aggregate = aggregateMetrics(individualMetrics);
  
  // Compute learner-level metrics
  const learnerMetrics = computeLearnerMetrics(traces);
  
  // Problem-level statistics
  const allEvents = traces.flat();
  const problemStats = computeProblemStats(allEvents.sort((a, b) => a.timestamp - b.timestamp));
  const problemLevelStats: Record<string, { attempts: number; successRate: number; averageTime: number }> = {};
  
  for (const [problemId, stats] of Object.entries(problemStats)) {
    problemLevelStats[problemId] = {
      attempts: stats.attempts,
      successRate: stats.attempts > 0 ? (stats.solved ? 1 : 0) : 0,
      averageTime: stats.timeSpent
    };
  }
  
  return {
    policyId,
    traceCount: traces.length,
    aggregateMetrics: aggregate,
    learnerMetrics,
    problemLevelStats
  };
}

/**
 * Aggregate metrics across multiple traces
 */
function aggregateMetrics(metrics: ReplayMetrics[]): ReplayMetrics {
  if (metrics.length === 0) return getEmptyMetrics();
  if (metrics.length === 1) return metrics[0];
  
  const avg = (vals: number[]): number => vals.reduce((a, b) => a + b, 0) / vals.length;
  
  // Combine concept lists (union)
  const allConcepts = new Set<string>();
  const allMastered = new Set<string>();
  metrics.forEach(m => {
    m.conceptsEncountered.forEach(c => allConcepts.add(c));
    m.conceptsMastered.forEach(c => allMastered.add(c));
  });
  
  // Aggregate HDI components
  const hdiComponents: HDIComponents = {
    hpa: avg(metrics.map(m => m.hdiComponents.hpa)),
    aed: avg(metrics.map(m => m.hdiComponents.aed)),
    er: avg(metrics.map(m => m.hdiComponents.er)),
    reae: avg(metrics.map(m => m.hdiComponents.reae)),
    iwh: avg(metrics.map(m => m.hdiComponents.iwh))
  };
  
  return {
    conceptCoverageRate: avg(metrics.map(m => m.conceptCoverageRate)),
    conceptsEncountered: Array.from(allConcepts),
    conceptsMastered: Array.from(allMastered),
    
    explanationRequestRate: avg(metrics.map(m => m.explanationRequestRate)),
    averageEscalationDepth: avg(metrics.map(m => m.averageEscalationDepth)),
    totalHelpRequests: metrics.reduce((sum, m) => sum + m.totalHelpRequests, 0),
    
    hintDependencyIndex: avg(metrics.map(m => m.hintDependencyIndex)),
    independentSuccessRate: avg(metrics.map(m => m.independentSuccessRate)),
    hdiComponents,
    
    averageTimeToSuccess: avg(metrics.map(m => m.averageTimeToSuccess)),
    totalSessionTime: metrics.reduce((sum, m) => sum + m.totalSessionTime, 0),
    interactionsPerProblem: avg(metrics.map(m => m.interactionsPerProblem)),
    timeToFirstSuccess: avg(metrics.map(m => m.timeToFirstSuccess)),
    
    errorReductionRate: avg(metrics.map(m => m.errorReductionRate)),
    retentionEstimate: avg(metrics.map(m => m.retentionEstimate)),
    firstAttemptSuccessRate: avg(metrics.map(m => m.firstAttemptSuccessRate)),
    
    totalProblems: metrics.reduce((sum, m) => sum + m.totalProblems, 0),
    problemsSolved: metrics.reduce((sum, m) => sum + m.problemsSolved, 0),
    totalErrors: metrics.reduce((sum, m) => sum + m.totalErrors, 0),
    totalHintsViewed: metrics.reduce((sum, m) => sum + m.totalHintsViewed, 0),
    totalExplanationsViewed: metrics.reduce((sum, m) => sum + m.totalExplanationsViewed, 0)
  };
}

/**
 * Compute problem-level statistics
 */
function computeProblemStats(events: InteractionEvent[]): Record<string, ProblemMetrics> {
  const problems: Record<string, ProblemMetrics> = {};
  const problemEvents: Record<string, InteractionEvent[]> = {};
  
  // Group events by problem
  events.forEach(event => {
    if (!problemEvents[event.problemId]) {
      problemEvents[event.problemId] = [];
    }
    problemEvents[event.problemId].push(event);
  });
  
  // Compute stats per problem
  for (const [problemId, pevents] of Object.entries(problemEvents)) {
    const sorted = pevents.sort((a, b) => a.timestamp - b.timestamp);
    const firstEvent = sorted[0];
    const lastEvent = sorted[sorted.length - 1];
    
    const attempts = sorted.filter(e => e.eventType === 'execution').length;
    const errors = sorted.filter(e => e.eventType === 'error').length;
    const hints = sorted.filter(e => e.eventType === 'hint_view' || e.eventType === 'guidance_view').length;
    const explanations = sorted.filter(e => e.eventType === 'explanation_view').length;
    const successfulExecs = sorted.filter(e => e.eventType === 'execution' && e.successful);
    
    const concepts = new Set<string>();
    sorted.forEach(e => {
      if (e.conceptIds) e.conceptIds.forEach(c => concepts.add(c));
      if (e.errorSubtypeId) concepts.add(e.errorSubtypeId);
    });
    
    problems[problemId] = {
      problemId,
      attempts,
      errors,
      hintsViewed: hints,
      explanationsViewed: explanations,
      timeSpent: lastEvent.timestamp - firstEvent.timestamp,
      solved: successfulExecs.length > 0,
      firstAttemptSuccess: attempts > 0 && successfulExecs.length > 0 && 
        sorted.findIndex(e => e.eventType === 'execution') === 
        sorted.findIndex(e => e.eventType === 'execution' && e.successful),
      conceptsEncountered: Array.from(concepts)
    };
  }
  
  return problems;
}

/**
 * Compute concept coverage metrics
 */
function computeCoverageMetrics(events: InteractionEvent[]): {
  coverageRate: number;
  encountered: string[];
  mastered: string[];
} {
  const concepts = new Set<string>();
  const mastered = new Set<string>();
  
  events.forEach(event => {
    if (event.conceptIds) {
      event.conceptIds.forEach(c => concepts.add(c));
      // Consider mastered if successful execution with this concept
      if (event.eventType === 'execution' && event.successful) {
        event.conceptIds.forEach(c => mastered.add(c));
      }
    }
  });
  
  const encountered = Array.from(concepts);
  const masteredList = Array.from(mastered);
  
  return {
    coverageRate: encountered.length > 0 ? masteredList.length / encountered.length : 0,
    encountered,
    mastered: masteredList
  };
}

/**
 * Compute explanation-related metrics
 */
function computeExplanationMetrics(events: InteractionEvent[]): {
  requestRate: number;
  avgDepth: number;
  totalRequests: number;
} {
  const hints = events.filter(e => e.eventType === 'hint_view' || e.eventType === 'guidance_view');
  const explanations = events.filter(e => e.eventType === 'explanation_view');
  const totalRequests = hints.length + explanations.length;
  
  const requestRate = totalRequests > 0 ? explanations.length / totalRequests : 0;
  
  // Average escalation depth (hint level 1-3 normalized to 0-1)
  const avgLevel = hints.length > 0
    ? hints.reduce((sum, h) => sum + (h.hintLevel || 1), 0) / hints.length
    : 1;
  const avgDepth = Math.min(Math.max((avgLevel - 1) / 2, 0), 1);
  
  return { requestRate, avgDepth, totalRequests };
}

/**
 * Compute efficiency metrics
 */
function computeEfficiencyMetrics(
  events: InteractionEvent[],
  problemStats: Record<string, ProblemMetrics>
): {
  avgTimeToSuccess: number;
  totalTime: number;
  interactionsPerProblem: number;
  timeToFirstSuccess: number;
} {
  if (events.length === 0) {
    return { avgTimeToSuccess: 0, totalTime: 0, interactionsPerProblem: 0, timeToFirstSuccess: 0 };
  }
  
  const sorted = [...events].sort((a, b) => a.timestamp - b.timestamp);
  const firstEvent = sorted[0];
  const lastEvent = sorted[sorted.length - 1];
  const totalTime = lastEvent.timestamp - firstEvent.timestamp;
  
  const problems = Object.values(problemStats);
  const solvedProblems = problems.filter(p => p.solved);
  
  const avgTimeToSuccess = solvedProblems.length > 0
    ? solvedProblems.reduce((sum, p) => sum + p.timeSpent, 0) / solvedProblems.length
    : 0;
  
  const interactionsPerProblem = problems.length > 0
    ? events.length / problems.length
    : 0;
  
  // Time to first successful execution
  const firstSuccess = sorted.find(e => e.eventType === 'execution' && e.successful);
  const timeToFirstSuccess = firstSuccess 
    ? firstSuccess.timestamp - firstEvent.timestamp 
    : 0;
  
  return { avgTimeToSuccess, totalTime, interactionsPerProblem, timeToFirstSuccess };
}

/**
 * Compute learning outcome metrics
 */
function computeLearningOutcomes(
  events: InteractionEvent[],
  problemStats: Record<string, ProblemMetrics>
): {
  errorReduction: number;
  retention: number;
  firstAttemptSuccess: number;
} {
  // Error reduction: compare first half vs second half
  const sorted = [...events].sort((a, b) => a.timestamp - b.timestamp);
  const mid = Math.floor(sorted.length / 2);
  const firstHalf = sorted.slice(0, mid);
  const secondHalf = sorted.slice(mid);
  
  const firstHalfErrors = firstHalf.filter(e => e.eventType === 'error').length;
  const secondHalfErrors = secondHalf.filter(e => e.eventType === 'error').length;
  
  const errorReduction = firstHalfErrors > 0
    ? Math.max(0, (firstHalfErrors - secondHalfErrors) / firstHalfErrors)
    : 0;
  
  // Retention estimate based on reinforcement responses
  const reinforcements = events.filter(e => e.eventType === 'reinforcement_response');
  const correctReinforcements = reinforcements.filter(e => e.isCorrect);
  const retention = reinforcements.length > 0
    ? correctReinforcements.length / reinforcements.length
    : 0.5; // Neutral if no data
  
  // First attempt success rate
  const problems = Object.values(problemStats);
  const firstAttemptSuccess = problems.length > 0
    ? problems.filter(p => p.firstAttemptSuccess).length / problems.length
    : 0;
  
  return { errorReduction, retention, firstAttemptSuccess };
}

/**
 * Compute basic counts
 */
function computeBasicCounts(events: InteractionEvent[]): {
  errors: number;
  hints: number;
  explanations: number;
} {
  return {
    errors: events.filter(e => e.eventType === 'error').length,
    hints: events.filter(e => e.eventType === 'hint_view' || e.eventType === 'guidance_view').length,
    explanations: events.filter(e => e.eventType === 'explanation_view').length
  };
}

/**
 * Compute learner-level metrics across traces
 */
function computeLearnerMetrics(traces: InteractionEvent[][]): LearnerMetrics[] {
  const byLearner: Record<string, InteractionEvent[][]> = {};
  
  traces.forEach(trace => {
    const learnerId = trace[0]?.learnerId;
    if (learnerId) {
      if (!byLearner[learnerId]) byLearner[learnerId] = [];
      byLearner[learnerId].push(trace);
    }
  });
  
  return Object.entries(byLearner).map(([learnerId, learnerTraces]) => {
    const allEvents = learnerTraces.flat().sort((a, b) => a.timestamp - b.timestamp);
    const allProblemStats = computeProblemStats(allEvents);
    
    // Calculate HDI trend
    const hdiResults = learnerTraces.map(t => calculateHDI(t));
    const hdiValues = hdiResults.map(h => h.hdi);
    const firstHDI = hdiValues[0] || 0;
    const lastHDI = hdiValues[hdiValues.length - 1] || 0;
    const hdiTrend: 'improving' | 'stable' | 'declining' = 
      lastHDI < firstHDI - 0.1 ? 'improving' :
      lastHDI > firstHDI + 0.1 ? 'declining' : 'stable';
    
    return {
      learnerId,
      sessionCount: learnerTraces.length,
      totalInteractions: allEvents.length,
      overallHDI: hdiValues.reduce((a, b) => a + b, 0) / hdiValues.length,
      hdiTrend,
      averageSessionMetrics: aggregateMetrics(learnerTraces.map(t => computeMetrics(t))),
      problemMetrics: Object.values(allProblemStats)
    };
  });
}

/**
 * Get empty metrics object (for initialization)
 */
function getEmptyMetrics(): ReplayMetrics {
  return {
    conceptCoverageRate: 0,
    conceptsEncountered: [],
    conceptsMastered: [],
    explanationRequestRate: 0,
    averageEscalationDepth: 0,
    totalHelpRequests: 0,
    hintDependencyIndex: 0,
    independentSuccessRate: 0,
    hdiComponents: { hpa: 0, aed: 0, er: 0, reae: 0, iwh: 0 },
    averageTimeToSuccess: 0,
    totalSessionTime: 0,
    interactionsPerProblem: 0,
    timeToFirstSuccess: 0,
    errorReductionRate: 0,
    retentionEstimate: 0,
    firstAttemptSuccessRate: 0,
    totalProblems: 0,
    problemsSolved: 0,
    totalErrors: 0,
    totalHintsViewed: 0,
    totalExplanationsViewed: 0
  };
}

/**
 * Generate statistical summary (mean, std dev, confidence intervals)
 * 
 * @param values - Array of numeric values
 * @returns Statistical summary
 */
export function computeStatistics(values: number[]): {
  mean: number;
  stdDev: number;
  min: number;
  max: number;
  confidence95: [number, number];
} {
  if (values.length === 0) {
    return { mean: 0, stdDev: 0, min: 0, max: 0, confidence95: [0, 0] };
  }
  
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
  const stdDev = Math.sqrt(variance);
  const min = Math.min(...values);
  const max = Math.max(...values);
  
  // 95% confidence interval (using t-distribution approximation)
  const standardError = stdDev / Math.sqrt(values.length);
  const margin = 1.96 * standardError; // z-score for 95% CI
  
  return {
    mean,
    stdDev,
    min,
    max,
    confidence95: [mean - margin, mean + margin]
  };
}

/**
 * Get the replay metrics version
 */
export function getReplayMetricsVersion(): string {
  return 'replay-metrics-v1';
}
