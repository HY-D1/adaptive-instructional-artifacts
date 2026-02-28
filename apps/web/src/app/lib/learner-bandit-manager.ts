/**
 * Learner Bandit Manager
 *
 * Manages per-learner multi-armed bandit instances for adaptive escalation
 * profile selection. Maps bandit arms to escalation profiles and provides
 * a clean API for profile selection and outcome tracking.
 *
 * Policy Version: learner-bandit-v1
 */

import { MultiArmedBandit, BanditArm } from './multi-armed-bandit';
import { calculateReward, RewardComponents } from './reward-calculator';
import {
  FAST_ESCALATOR,
  SLOW_ESCALATOR,
  ADAPTIVE_ESCALATOR,
  type EscalationProfile,
} from './escalation-profiles';
import type { InteractionEvent } from '../types';

/**
 * Bandit arm IDs and their corresponding escalation profiles
 */
export const BANDIT_ARM_PROFILES = {
  aggressive: FAST_ESCALATOR,
  conservative: SLOW_ESCALATOR,
  'explanation-first': {
    // Special profile that skips hint ladder
    id: 'explanation-first' as const,
    name: 'Explanation First',
    description: 'Skip hint ladder, go straight to explanation',
    thresholds: { escalate: 1, aggregate: 3 },
    triggers: { timeStuck: 60000, rungExhausted: 1, repeatedError: 1 },
  },
  adaptive: ADAPTIVE_ESCALATOR,
} as const;

export type BanditArmId = keyof typeof BANDIT_ARM_PROFILES;

/**
 * Helper function to calculate independent success reward component
 * @param usedExplanation - Whether learner used explanation
 * @param solved - Whether problem was solved
 * @returns Reward component value (-1 to 1)
 */
function calculateIndependentSuccess(usedExplanation: boolean, solved: boolean): number {
  if (!solved) return -1;
  return usedExplanation ? 0.5 : 1;
}

/**
 * Helper function to calculate error reduction reward component
 * @param errorCount - Number of errors made
 * @param baselineErrors - Expected baseline error count
 * @returns Reward component value (0 to 1)
 */
function calculateErrorReduction(errorCount: number, baselineErrors: number): number {
  if (baselineErrors <= 0) return errorCount === 0 ? 1 : 0;
  const reduction = Math.max(0, baselineErrors - errorCount) / baselineErrors;
  return reduction;
}

/**
 * Helper function to calculate time efficiency reward component
 * @param timeSpentMs - Actual time spent in milliseconds
 * @param medianTimeMs - Median expected time in milliseconds
 * @returns Reward component value (0 to 1)
 */
function calculateTimeEfficiency(timeSpentMs: number, medianTimeMs: number): number {
  if (medianTimeMs <= 0) return 0.5;
  const ratio = timeSpentMs / medianTimeMs;
  // Optimal ratio is around 1.0 (not too fast, not too slow)
  // Score decreases as we deviate from optimal
  if (ratio < 0.5) {
    // Too fast - may indicate guessing
    return 0.5 + ratio;
  } else if (ratio <= 2.0) {
    // Good range
    return 1 - Math.abs(ratio - 1) * 0.5;
  } else {
    // Too slow
    return Math.max(0, 1 - (ratio - 2) * 0.3);
  }
}

/**
 * Outcome data for recording a learning interaction result
 */
export interface LearningOutcome {
  /** Whether the learner solved the problem */
  solved: boolean;
  /** Whether the learner used explanation to solve */
  usedExplanation: boolean;
  /** Number of errors made during the attempt */
  errorCount: number;
  /** Expected baseline error count for comparison */
  baselineErrors: number;
  /** Time spent on the problem in milliseconds */
  timeSpentMs: number;
  /** Median expected time for this problem */
  medianTimeMs: number;
  /** HDI (Hint Dependency Index) score - higher means more dependent on hints */
  hdiScore: number;
}

/**
 * Statistics for a single bandit arm
 */
export interface ArmStatistics {
  armId: BanditArmId;
  profileName: string;
  meanReward: number;
  pullCount: number;
}

/**
 * Manager for per-learner bandit instances
 *
 * This class maintains a map of learner IDs to their individual
 * multi-armed bandit instances, allowing each learner to have
 * their own exploration/exploitation profile.
 */
export class LearnerBanditManager {
  private bandits: Map<string, MultiArmedBandit> = new Map();
  private armIds: string[] = ['aggressive', 'conservative', 'explanation-first', 'adaptive'];

  /**
   * Get or create a bandit for a learner
   *
   * If the learner doesn't have a bandit yet, creates a new one
   * with all four escalation profile arms.
   *
   * @param learnerId - Unique identifier for the learner
   * @returns MultiArmedBandit instance for this learner
   */
  getBanditForLearner(learnerId: string): MultiArmedBandit {
    if (!this.bandits.has(learnerId)) {
      this.bandits.set(learnerId, new MultiArmedBandit(this.armIds));
    }
    return this.bandits.get(learnerId)!;
  }

  /**
   * Select the best escalation profile for a learner
   *
   * Uses Thompson Sampling to balance exploration/exploitation,
   * selecting arms based on their posterior probability of being optimal.
   *
   * @param learnerId - Unique identifier for the learner
   * @returns Selected profile and arm ID
   */
  selectProfileForLearner(learnerId: string): {
    profile: EscalationProfile;
    armId: BanditArmId;
  } {
    const bandit = this.getBanditForLearner(learnerId);
    const selectedArm = bandit.selectArm() as BanditArmId;

    return {
      profile: BANDIT_ARM_PROFILES[selectedArm],
      armId: selectedArm,
    };
  }

  /**
   * Record the outcome of using a profile
   *
   * Updates the bandit with the observed reward based on learning outcome.
   * Higher rewards are given for:
   * - Independent success (without explanation)
   * - Error reduction compared to baseline
   * - Efficient time usage
   * Lower rewards (penalties) for:
   * - High hint dependency (HDI)
   * - Failure to solve
   *
   * @param learnerId - Unique identifier for the learner
   * @param armId - Bandit arm that was used
   * @param outcome - Learning outcome data
   */
  recordOutcome(learnerId: string, armId: BanditArmId, outcome: LearningOutcome): void {
    const bandit = this.getBanditForLearner(learnerId);

    // Calculate reward components
    const components: RewardComponents = {
      independentSuccess: calculateIndependentSuccess(outcome.usedExplanation, outcome.solved),
      errorReduction: calculateErrorReduction(outcome.errorCount, outcome.baselineErrors),
      delayedRetention: 0, // Not available immediately
      dependencyPenalty: -outcome.hdiScore, // Negative because it's a penalty
      timeEfficiency: calculateTimeEfficiency(outcome.timeSpentMs, outcome.medianTimeMs),
    };

    // Calculate reward
    const reward = calculateReward(components);

    // Update bandit
    bandit.updateArm(armId, reward);

    // Log event (if storage is available)
    // This would be done by the caller with proper event logging
  }

  /**
   * Get statistics for all arms for a learner
   *
   * Returns current statistics for each arm including mean reward
   * and number of pulls (trials).
   *
   * @param learnerId - Unique identifier for the learner
   * @returns Array of arm statistics
   */
  getLearnerStats(learnerId: string): ArmStatistics[] {
    const bandit = this.getBanditForLearner(learnerId);

    return this.armIds.map((armId) => {
      const stats = bandit.getArmStats(armId);
      return {
        armId: armId as BanditArmId,
        profileName: BANDIT_ARM_PROFILES[armId as BanditArmId].name,
        meanReward: stats?.meanReward ?? 0,
        pullCount: stats?.pullCount ?? 0,
      };
    });
  }

  /**
   * Reset a learner's bandit (e.g., for a new session)
   *
   * Removes the learner's bandit from the manager, causing a new
   * one to be created on next access.
   *
   * @param learnerId - Unique identifier for the learner
   */
  resetLearner(learnerId: string): void {
    this.bandits.delete(learnerId);
  }

  /**
   * Get all learner IDs with bandits
   *
   * @returns Array of learner IDs
   */
  getLearnerIds(): string[] {
    return Array.from(this.bandits.keys());
  }

  /**
   * Check if a learner has a bandit
   *
   * @param learnerId - Unique identifier for the learner
   * @returns True if learner has a bandit
   */
  hasBandit(learnerId: string): boolean {
    return this.bandits.has(learnerId);
  }

  /**
   * Get the total number of learners managed
   *
   * @returns Number of learners
   */
  getLearnerCount(): number {
    return this.bandits.size;
  }

  /**
   * Clear all learner bandits
   *
   * Removes all bandits from the manager. Use with caution.
   */
  clearAll(): void {
    this.bandits.clear();
  }
}

/**
 * Global bandit manager instance
 *
 * Use this for all bandit operations in the app.
 * This singleton ensures consistent bandit state across the application.
 *
 * @example
 * ```typescript
 * import { banditManager } from './learner-bandit-manager';
 *
 * // Select a profile for a learner
 * const { profile, armId } = banditManager.selectProfileForLearner('learner-123');
 *
 * // Record outcome after learning session
 * banditManager.recordOutcome('learner-123', armId, {
 *   solved: true,
 *   usedExplanation: false,
 *   errorCount: 1,
 *   baselineErrors: 3,
 *   timeSpentMs: 120000,
 *   medianTimeMs: 180000,
 *   hdiScore: 0.2,
 * });
 * ```
 */
export const banditManager = new LearnerBanditManager();

/**
 * Version constant for the learner bandit manager
 *
 * This should be updated when the implementation changes
 * to ensure reproducibility.
 */
export const LEARNER_BANDIT_MANAGER_VERSION = 'learner-bandit-v1';
