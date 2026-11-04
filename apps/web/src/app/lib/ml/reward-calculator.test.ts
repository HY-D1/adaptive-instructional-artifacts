/**
 * Unit tests for reward-calculator.ts
 * 
 * @vitest-environment node
 */

import { describe, it, expect } from 'vitest';
import {
  calculateReward,
  calculateIndependentSuccess,
  calculateErrorReduction,
  calculateTimeEfficiency,
  buildRewardComponents,
  REWARD_CALCULATOR_VERSION,
  type RewardComponents,
} from './reward-calculator';

describe('calculateReward (shared equal-weight formula)', () => {
  const c = (overrides: Partial<RewardComponents> = {}): RewardComponents => ({
    independentSuccess: 0, errorReduction: 0, delayedRetention: 0, dependencyPenalty: 0, timeEfficiency: 0,
    ...overrides,
  });

  it('is the mean of the five components', () => {
    expect(calculateReward(c({ independentSuccess: 1, errorReduction: 0.5, timeEfficiency: 1 }))).toBeCloseTo(0.5, 10);
  });

  it('clamps to [0, 1]', () => {
    expect(calculateReward(c({ independentSuccess: -1, errorReduction: -1, timeEfficiency: -1 }))).toBe(0);
    expect(calculateReward(c({ independentSuccess: 5, errorReduction: 5 }))).toBe(1);
  });

  it('reaches at most 0.6 with no retention signal and zero HDI', () => {
    expect(calculateReward(c({ independentSuccess: 1, errorReduction: 1, timeEfficiency: 1 }))).toBeCloseTo(0.6, 10);
  });

  it('penalizes dependency through -HDI', () => {
    const independent = calculateReward(c({ independentSuccess: 1, errorReduction: 1, timeEfficiency: 1 }));
    const dependent = calculateReward(c({ independentSuccess: 1, errorReduction: 1, timeEfficiency: 1, dependencyPenalty: -0.8 }));
    expect(dependent).toBeLessThan(independent);
  });
});

describe('buildRewardComponents', () => {
  it('reproduces the shared pool components (values used since launch)', () => {
    expect(buildRewardComponents({ solved: true, usedExplanation: false, errorCount: 1, timeSpentMs: 600_000, hdiScore: 0.25 }))
      .toEqual({ independentSuccess: 1, errorReduction: 1 - 1 / 3, delayedRetention: 0, dependencyPenalty: -0.25, timeEfficiency: 0.5 });
  });

  it('gives no independent-success credit after an explanation or without a solve', () => {
    expect(buildRewardComponents({ solved: true, usedExplanation: true, errorCount: 0, timeSpentMs: 1, hdiScore: 0 }).independentSuccess).toBe(0);
    expect(buildRewardComponents({ solved: false, usedExplanation: false, errorCount: 0, timeSpentMs: 1, hdiScore: 0 }).independentSuccess).toBe(0);
  });

  it('floors error reduction at 0 and caps time efficiency at 1', () => {
    const parts = buildRewardComponents({ solved: true, usedExplanation: false, errorCount: 9, timeSpentMs: 10, hdiScore: 0 });
    expect(parts.errorReduction).toBe(0);
    expect(parts.timeEfficiency).toBe(1);
  });
});

describe('calculateIndependentSuccess', () => {
  it('should return 1.0 for success without explanation', () => {
    expect(calculateIndependentSuccess(false, true)).toBe(1.0);
  });

  it('should return 0.5 for success with explanation', () => {
    expect(calculateIndependentSuccess(true, true)).toBe(0.5);
  });

  it('should return 0 for not solved', () => {
    expect(calculateIndependentSuccess(false, false)).toBe(0);
    expect(calculateIndependentSuccess(true, false)).toBe(0);
  });
});

describe('calculateErrorReduction', () => {
  it('should return 0 for zero baseline errors', () => {
    expect(calculateErrorReduction(5, 0)).toBe(0);
  });

  it('should return 1 for 100% error reduction', () => {
    expect(calculateErrorReduction(0, 10)).toBe(1);
  });

  it('should return -1 for 100% error increase', () => {
    expect(calculateErrorReduction(20, 10)).toBe(-1);
  });

  it('should return 0 for no change', () => {
    expect(calculateErrorReduction(10, 10)).toBe(0);
  });

  it('should calculate 50% reduction correctly', () => {
    expect(calculateErrorReduction(5, 10)).toBe(0.5);
  });

  it('should clamp to [-1, 1]', () => {
    expect(calculateErrorReduction(100, 10)).toBe(-1);
    expect(calculateErrorReduction(-10, 10)).toBe(1);
  });
});

describe('calculateTimeEfficiency', () => {
  it('should return 0 for zero median time', () => {
    expect(calculateTimeEfficiency(5000, 0)).toBe(0);
  });

  it('should return 1 for instantaneous completion', () => {
    expect(calculateTimeEfficiency(0, 10000)).toBe(1);
  });

  it('should return -1 for very slow completion', () => {
    expect(calculateTimeEfficiency(20000, 10000)).toBe(-1);
  });

  it('should return 0 for median time', () => {
    expect(calculateTimeEfficiency(10000, 10000)).toBe(0);
  });

  it('should calculate 50% faster correctly', () => {
    expect(calculateTimeEfficiency(5000, 10000)).toBe(0.5);
  });

  it('should calculate 50% slower correctly', () => {
    expect(calculateTimeEfficiency(15000, 10000)).toBe(-0.5);
  });

  it('should clamp to [-1, 1]', () => {
    expect(calculateTimeEfficiency(100000, 10000)).toBe(-1);
    expect(calculateTimeEfficiency(-10000, 10000)).toBe(1);
  });
});

describe('Version constant', () => {
  it('should export version string', () => {
    expect(typeof REWARD_CALCULATOR_VERSION).toBe('string');
    expect(REWARD_CALCULATOR_VERSION).toContain('reward');
  });
});

describe('Reward calculation edge cases', () => {
  it('should handle all zeros', () => {
    const components: RewardComponents = {
      independentSuccess: 0,
      errorReduction: 0,
      delayedRetention: 0,
      dependencyPenalty: 0,
      timeEfficiency: 0,
    };
    
    const reward = calculateReward(components);
    expect(reward).toBe(0);
  });

  it('should handle mixed positive and negative', () => {
    const components: RewardComponents = {
      independentSuccess: 1,
      errorReduction: 0.5,
      delayedRetention: 0,
      dependencyPenalty: -0.5,
      timeEfficiency: 0.5,
    };

    const reward = calculateReward(components);
    expect(reward).toBeCloseTo(0.3, 10); // (1 + 0.5 + 0 - 0.5 + 0.5) / 5
  });
});
