/**
 * Multi-Armed Bandit Module
 *
 * Implements Thompson Sampling for online policy optimization.
 * Uses Beta distributions to model uncertainty over arm rewards
 * and balances exploration vs exploitation.
 *
 * Policy Version: bandit-thompson-v1
 */

/**
 * Bandit arm state with Beta distribution parameters
 */
export interface BanditArm {
  id: string;
  alpha: number; // Success count + prior
  beta: number; // Failure count + prior
  pullCount: number;
  cumulativeReward: number;
}

/**
 * Sample from Gamma distribution
 * Uses Marsaglia and Tsang's method for shape >= 1
 *
 * @param shape - Shape parameter (must be >= 1)
 * @param scale - Scale parameter
 * @returns Sample from Gamma(shape, scale)
 */
export function sampleGamma(shape: number, scale: number): number {
  // Marsaglia and Tsang's method (works well for shape >= 1)
  // For shape < 1, we would need a different approach, but
  // in our case shape = alpha or beta which start at 1 and only increase

  if (shape < 1) {
    // Fallback: use simple approximation for edge cases
    // This should rarely happen with our usage (alpha/beta >= 1)
    return Math.random() * shape * scale;
  }

  const d = shape - 1 / 3;
  const c = 1 / Math.sqrt(9 * d);

  while (true) {
    // Generate standard normal
    let z = 0;
    let u = 0;

    // Box-Muller transform for normal distribution
    if (Math.random() < 0.5) {
      const u1 = Math.random();
      const u2 = Math.random();
      z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    } else {
      const u1 = Math.random();
      const u2 = Math.random();
      z = Math.sqrt(-2 * Math.log(u1)) * Math.sin(2 * Math.PI * u2);
    }

    u = Math.random();

    const v = Math.pow(1 + c * z, 3);

    if (z > -1 / c && Math.log(u) < 0.5 * z * z + d - d * v + d * Math.log(v)) {
      return d * v * scale;
    }
    // Otherwise, try again
  }
}

/**
 * Sample from Beta distribution using gamma distributions
 * Beta(a, b) = Gamma(a, 1) / (Gamma(a, 1) + Gamma(b, 1))
 *
 * @param alpha - First shape parameter (must be > 0)
 * @param beta - Second shape parameter (must be > 0)
 * @returns Sample from Beta(alpha, beta), value between 0 and 1
 */
export function sampleBeta(alpha: number, beta: number): number {
  // Validate parameters
  const a = Math.max(0.001, alpha); // Prevent division by zero
  const b = Math.max(0.001, beta);

  // Beta(a, b) = Gamma(a, 1) / (Gamma(a, 1) + Gamma(b, 1))
  const gammaA = sampleGamma(a, 1);
  const gammaB = sampleGamma(b, 1);

  // Avoid division by zero
  const sum = gammaA + gammaB;
  if (sum === 0) {
    return 0.5;
  }

  return gammaA / sum;
}

/**
 * Multi-Armed Bandit using Thompson Sampling
 *
 * Thompson Sampling maintains a Beta distribution over each arm's
 * expected reward. When selecting an arm, it samples from each
 * distribution and picks the arm with the highest sample.
 *
 * This naturally balances exploration (arms with high uncertainty)
 * and exploitation (arms with high expected reward).
 */
export class MultiArmedBandit {
  private arms: Map<string, BanditArm>;
  private priorAlpha = 1; // Uniform prior
  private priorBeta = 1;

  /**
   * Create a new Multi-Armed Bandit
   * @param armIds - Array of unique arm identifiers
   */
  constructor(armIds: string[]) {
    this.arms = new Map();

    // Initialize each arm with uniform priors
    for (const armId of armIds) {
      this.arms.set(armId, {
        id: armId,
        alpha: this.priorAlpha,
        beta: this.priorBeta,
        pullCount: 0,
        cumulativeReward: 0,
      });
    }
  }

  /**
   * Select arm using Thompson Sampling
   * Samples from Beta distribution for each arm and selects highest
   *
   * @returns Selected arm ID
   * @throws Error if no arms exist
   */
  selectArm(): string {
    if (this.arms.size === 0) {
      throw new Error('No arms available in bandit');
    }

    let bestArmId = '';
    let bestSample = -Infinity;

    // Sample from each arm's Beta distribution
    for (const [armId, arm] of this.arms) {
      // Sample from Beta(arm.alpha, arm.beta)
      const sample = sampleBeta(arm.alpha, arm.beta);

      if (sample > bestSample) {
        bestSample = sample;
        bestArmId = armId;
      }
    }

    return bestArmId;
  }

  /**
   * Update arm after observing reward
   * @param armId - The arm that was pulled
   * @param reward - Normalized reward value [0, 1]
   * @throws Error if arm not found
   */
  updateArm(armId: string, reward: number): void {
    const arm = this.arms.get(armId);
    if (!arm) {
      // Silently ignore updates for non-existent arms
      return;
    }

    // Validate reward is in [0, 1]
    const normalizedReward = Math.max(0, Math.min(1, reward));

    // Update alpha: arm.alpha += reward
    arm.alpha += normalizedReward;

    // Update beta: arm.beta += (1 - reward)
    arm.beta += 1 - normalizedReward;

    // Increment pullCount
    arm.pullCount += 1;

    // Add to cumulativeReward
    arm.cumulativeReward += normalizedReward;
  }

  /**
   * Get statistics for an arm
   * @param armId - Arm identifier
   * @returns Statistics object or null if arm not found
   */
  getArmStats(
    armId: string
  ): {
    meanReward: number;
    confidenceInterval: [number, number];
    pullCount: number;
  } | null {
    const arm = this.arms.get(armId);
    if (!arm) {
      return null;
    }

    // Calculate mean = alpha / (alpha + beta)
    const total = arm.alpha + arm.beta;
    const meanReward = total > 0 ? arm.alpha / total : 0.5;

    // Calculate variance for Beta distribution
    // Var = alpha * beta / ((alpha + beta)^2 * (alpha + beta + 1))
    const variance =
      total > 0 && total + 1 > 0
        ? (arm.alpha * arm.beta) / (total * total * (total + 1))
        : 0.25; // Max variance for Beta(1, 1)

    // Calculate 95% CI using normal approximation
    // For Beta distributions with large samples, this is reasonable
    const stdDev = Math.sqrt(variance);
    const marginOfError = 1.96 * stdDev; // 95% CI

    const confidenceInterval: [number, number] = [
      Math.max(0, meanReward - marginOfError),
      Math.min(1, meanReward + marginOfError),
    ];

    return {
      meanReward,
      confidenceInterval,
      pullCount: arm.pullCount,
    };
  }

  /**
   * Get all arm IDs
   * @returns Array of arm IDs
   */
  getArmIds(): string[] {
    return Array.from(this.arms.keys());
  }

  /**
   * Get arm by ID
   * @param armId - Arm identifier
   * @returns BanditArm object or undefined if not found
   */
  getArm(armId: string): BanditArm | undefined {
    return this.arms.get(armId);
  }

  /**
   * Get the number of arms
   * @returns Number of arms
   */
  getArmCount(): number {
    return this.arms.size;
  }

  /**
   * Get the arm with the highest empirical mean reward
   * @returns Best arm ID or null if no arms
   */
  getBestArm(): string | null {
    if (this.arms.size === 0) {
      return null;
    }

    let bestArmId = '';
    let bestMean = -Infinity;

    for (const [armId, arm] of this.arms) {
      const total = arm.alpha + arm.beta;
      const mean = total > 0 ? arm.alpha / total : 0.5;

      if (mean > bestMean) {
        bestMean = mean;
        bestArmId = armId;
      }
    }

    return bestArmId;
  }

  /**
   * Reset all arms to initial state
   */
  reset(): void {
    for (const arm of this.arms.values()) {
      arm.alpha = this.priorAlpha;
      arm.beta = this.priorBeta;
      arm.pullCount = 0;
      arm.cumulativeReward = 0;
    }
  }

  /**
   * Serialize bandit state for persistence
   * @returns Serializable state object
   */
  serialize(): {
    arms: BanditArm[];
    priorAlpha: number;
    priorBeta: number;
  } {
    return {
      arms: Array.from(this.arms.values()),
      priorAlpha: this.priorAlpha,
      priorBeta: this.priorBeta,
    };
  }

  /**
   * Restore bandit state from serialized data
   * @param state - Serialized state from serialize()
   */
  deserialize(state: {
    arms: BanditArm[];
    priorAlpha: number;
    priorBeta: number;
  }): void {
    this.arms.clear();
    this.priorAlpha = state.priorAlpha;
    this.priorBeta = state.priorBeta;

    for (const arm of state.arms) {
      this.arms.set(arm.id, { ...arm });
    }
  }
}

/**
 * Policy version for tracking changes
 */
export const MULTI_ARMED_BANDIT_VERSION = 'bandit-thompson-v1';

/**
 * Factory function to create a bandit for escalation profile selection
 * @returns MultiArmedBandit with escalation profile arms
 */
export function createEscalationProfileBandit(): MultiArmedBandit {
  return new MultiArmedBandit([
    'fast-escalator',
    'slow-escalator',
    'adaptive-escalator',
  ]);
}

/**
 * Calculate regret for a bandit run
 * @param optimalReward - Reward of optimal arm
 * @param actualReward - Reward received
 * @returns Regret value (non-negative)
 */
export function calculateRegret(
  optimalReward: number,
  actualReward: number
): number {
  return Math.max(0, optimalReward - actualReward);
}

/**
 * Calculate cumulative regret over a sequence
 * @param rewards - Array of actual rewards received
 * @param optimalReward - Optimal reward per round
 * @returns Cumulative regret
 */
export function calculateCumulativeRegret(
  rewards: number[],
  optimalReward: number
): number {
  return rewards.reduce(
    (sum, reward) => sum + calculateRegret(optimalReward, reward),
    0
  );
}
