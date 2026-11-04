/**
 * Reward Calculator for Multi-Armed Bandit
 * 
 * Calculates weighted rewards from interaction history for policy optimization.
 * Part of the Multi-Armed Bandit research component (Component 8).
 * 
 * @version reward-calc-v1
 */

/**
 * Individual reward components calculated from learner interactions
 */
export interface RewardComponents {
  /** 
   * Independent problem solving
   * +1.0 if solved without reaching explanation
   * +0.5 if solved with explanation
   * 0.0 if not solved
   */
  independentSuccess: number;
  
  /**
   * Error reduction compared to learner's baseline
   * +1.0 if fewer errors than average
   * -1.0 if more errors than average
   * 0.0 if same as average
   */
  errorReduction: number;
  
  /**
   * Delayed retention from spaced reinforcement
   * +1.0 if answered correctly in delayed quiz
   * 0.0 if incorrect or not tested
   */
  delayedRetention: number;
  
  /**
   * Dependency avoidance (negative weight)
   * -1.0 * HDI (higher HDI = lower reward)
   * Range: [-1.0, 0]
   */
  dependencyPenalty: number;
  
  /**
   * Time efficiency
   * +1.0 if solved faster than median
   * Scaled by problem difficulty
   */
  timeEfficiency: number;
}

/**
 * Single reward formula used by the shared server bandit pool, the local
 * fallback bandit, and the logged bandit_reward_observed value (decision
 * 2026-11-04: keep the equal-weight formula the pool has always used).
 *
 * reward = clamp((independentSuccess + errorReduction + delayedRetention
 *                 + dependencyPenalty + timeEfficiency) / 5, 0, 1)
 *
 * With delayedRetention = 0 and dependencyPenalty = -HDI, the maximum reachable
 * reward is 0.6.
 */
export function calculateReward(components: RewardComponents): number {
  const total =
    components.independentSuccess +
    components.errorReduction +
    components.delayedRetention +
    components.dependencyPenalty +
    components.timeEfficiency;
  return Math.max(0, Math.min(1, total / 5));
}

/** Baselines used by the shared reward components. */
export const REWARD_BASELINE_ERRORS = 3;
export const REWARD_BASELINE_TIME_MS = 300_000;

export interface RewardOutcome {
  solved: boolean;
  usedExplanation: boolean;
  errorCount: number;
  timeSpentMs: number;
  hdiScore: number;
}

/** Components exactly as the shared pool has computed them since launch. */
export function buildRewardComponents(outcome: RewardOutcome): RewardComponents {
  return {
    independentSuccess: outcome.solved && !outcome.usedExplanation ? 1 : 0,
    errorReduction: Math.max(0, 1 - outcome.errorCount / REWARD_BASELINE_ERRORS),
    delayedRetention: 0,
    dependencyPenalty: -outcome.hdiScore,
    timeEfficiency: Math.min(1, REWARD_BASELINE_TIME_MS / Math.max(outcome.timeSpentMs, 1000)),
  };
}

/**
 * Calculate independent success component from interaction history
 * 
 * @param usedExplanation - Whether the learner reached the explanation rung
 * @param solved - Whether the problem was solved correctly
 * @returns 1.0 if solved without explanation, 0.5 if solved with explanation, 0.0 if not solved
 */
export function calculateIndependentSuccess(
  usedExplanation: boolean,
  solved: boolean
): number {
  if (!solved) return 0;
  return usedExplanation ? 0.5 : 1.0;
}

/**
 * Calculate error reduction component
 * 
 * Compares current error count against learner's baseline to measure improvement.
 * Positive values indicate fewer errors than baseline.
 * 
 * @param currentErrors - Number of errors in current attempt
 * @param baselineErrors - Learner's average error count for this problem type
 * @returns Normalized value in [-1, 1] range
 */
export function calculateErrorReduction(
  currentErrors: number,
  baselineErrors: number
): number {
  if (baselineErrors === 0) return 0;
  const ratio = (baselineErrors - currentErrors) / baselineErrors;
  return Math.max(-1, Math.min(1, ratio));
}

/**
 * Calculate time efficiency component
 * 
 * Compares time spent against median time for this problem difficulty.
 * Positive values indicate faster solving than median.
 * 
 * @param timeSpentMs - Time spent on problem in milliseconds
 * @param medianTimeMs - Median time for this problem/difficulty
 * @returns Normalized value in [-1, 1] range
 */
export function calculateTimeEfficiency(
  timeSpentMs: number,
  medianTimeMs: number
): number {
  if (medianTimeMs === 0) return 0;
  const ratio = (medianTimeMs - timeSpentMs) / medianTimeMs;
  return Math.max(-1, Math.min(1, ratio));
}

/**
 * Version identifier for reward calculator
 * Used for policy reproducibility and A/B testing
 */
export const REWARD_CALCULATOR_VERSION = 'reward-calc-v2-equal-weight';
