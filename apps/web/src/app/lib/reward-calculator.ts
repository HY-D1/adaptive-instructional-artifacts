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
 * Weights for combining reward components
 */
export interface RewardWeights {
  /** Weight for independent success component */
  independentSuccess: number;
  /** Weight for error reduction component */
  errorReduction: number;
  /** Weight for delayed retention component */
  delayedRetention: number;
  /** Weight for dependency penalty (typically negative) */
  dependency: number;
  /** Weight for time efficiency component */
  timeEfficiency: number;
}

/**
 * Default reward weights based on pedagogical priorities
 * 
 * - Independent success: 35% (highest - encourage self-sufficiency)
 * - Error reduction: 25% (improvement over baseline)
 * - Delayed retention: 20% (long-term learning)
 * - Dependency: -15% (penalty for over-reliance on hints)
 * - Time efficiency: 5% (minor factor)
 */
export const DEFAULT_REWARD_WEIGHTS: RewardWeights = {
  independentSuccess: 0.35,
  errorReduction: 0.25,
  delayedRetention: 0.20,
  dependency: -0.15,  // Negative penalty
  timeEfficiency: 0.05,
};

/**
 * Calculate weighted reward from components
 * 
 * Formula: sum of (weight * component) for all components
 * Then normalize to [0, 1] range for Beta distribution updates
 * 
 * @param components - Individual reward components
 * @param weights - Weights for each component (defaults to DEFAULT_REWARD_WEIGHTS)
 * @returns Normalized reward in [0, 1] range
 * 
 * @example
 * ```typescript
 * const reward = calculateReward({
 *   independentSuccess: 1.0,
 *   errorReduction: 0.5,
 *   delayedRetention: 0,
 *   dependencyPenalty: -0.3,
 *   timeEfficiency: 0.8
 * });
 * // Returns normalized value between 0 and 1
 * ```
 */
export function calculateReward(
  components: RewardComponents,
  weights: RewardWeights = DEFAULT_REWARD_WEIGHTS
): number {
  // Calculate weighted sum
  const rawReward = 
    weights.independentSuccess * components.independentSuccess +
    weights.errorReduction * components.errorReduction +
    weights.delayedRetention * components.delayedRetention +
    weights.dependency * (-components.dependencyPenalty) +  // Flip sign: high penalty (negative) should reduce reward
    weights.timeEfficiency * components.timeEfficiency;
  
  // Normalize to [0, 1]
  // Theoretical bounds: [-1.0, 1.0] based on component ranges
  return (rawReward + 1) / 2;
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
export const REWARD_CALCULATOR_VERSION = 'reward-calc-v1';
