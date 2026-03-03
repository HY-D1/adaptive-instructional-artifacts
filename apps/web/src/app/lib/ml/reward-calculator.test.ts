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
  DEFAULT_REWARD_WEIGHTS,
  REWARD_CALCULATOR_VERSION,
  type RewardComponents,
} from './reward-calculator';

describe('calculateReward', () => {
  it('should return 0.5 for neutral components', () => {
    const components: RewardComponents = {
      independentSuccess: 0,
      errorReduction: 0,
      delayedRetention: 0,
      dependencyPenalty: 0,
      timeEfficiency: 0,
    };
    
    const reward = calculateReward(components);
    expect(reward).toBe(0.5); // (0 + 1) / 2
  });

  it('should return 1 for maximum positive components', () => {
    const components: RewardComponents = {
      independentSuccess: 1,
      errorReduction: 1,
      delayedRetention: 1,
      dependencyPenalty: 0, // No penalty
      timeEfficiency: 1,
    };
    
    const reward = calculateReward(components);
    // With default weights: (0.35*1 + 0.25*1 + 0.20*1 - 0.15*0 + 0.05*1 + 1) / 2
    expect(reward).toBeGreaterThan(0.8);
    expect(reward).toBeLessThanOrEqual(1);
  });

  it('should return 0 for maximum negative components', () => {
    const components: RewardComponents = {
      independentSuccess: -1,
      errorReduction: -1,
      delayedRetention: -1,
      dependencyPenalty: -1, // Maximum penalty
      timeEfficiency: -1,
    };
    
    const reward = calculateReward(components);
    expect(reward).toBeGreaterThanOrEqual(0);
    expect(reward).toBeLessThan(0.3);
  });

  it('should normalize to [0, 1] range', () => {
    const randomComponents: RewardComponents = {
      independentSuccess: Math.random() * 2 - 1,
      errorReduction: Math.random() * 2 - 1,
      delayedRetention: Math.random() * 2 - 1,
      dependencyPenalty: -(Math.random()), // Negative penalty
      timeEfficiency: Math.random() * 2 - 1,
    };
    
    const reward = calculateReward(randomComponents);
    expect(reward).toBeGreaterThanOrEqual(0);
    expect(reward).toBeLessThanOrEqual(1);
  });

  it('should use default weights when not specified', () => {
    const components: RewardComponents = {
      independentSuccess: 1,
      errorReduction: 0,
      delayedRetention: 0,
      dependencyPenalty: 0,
      timeEfficiency: 0,
    };
    
    const reward = calculateReward(components);
    // With default weights, independentSuccess has 0.35 weight
    // Expected: (0.35 * 1 + 1) / 2 = 0.675
    expect(reward).toBeCloseTo(0.675, 2);
  });

  it('should use custom weights when specified', () => {
    const components: RewardComponents = {
      independentSuccess: 1,
      errorReduction: 0,
      delayedRetention: 0,
      dependencyPenalty: 0,
      timeEfficiency: 0,
    };
    
    const customWeights = {
      independentSuccess: 0.1,
      errorReduction: 0.2,
      delayedRetention: 0.3,
      dependency: -0.2,
      timeEfficiency: 0.2,
    };
    
    const reward = calculateReward(components, customWeights);
    // With custom weights: (0.1 * 1 + 1) / 2 = 0.55
    expect(reward).toBeCloseTo(0.55, 2);
  });

  it('should reward independent success without explanation higher', () => {
    const withoutExplanation: RewardComponents = {
      independentSuccess: 1.0, // Solved without explanation
      errorReduction: 0,
      delayedRetention: 0,
      dependencyPenalty: 0,
      timeEfficiency: 0,
    };
    
    const withExplanation: RewardComponents = {
      independentSuccess: 0.5, // Solved with explanation
      errorReduction: 0,
      delayedRetention: 0,
      dependencyPenalty: 0,
      timeEfficiency: 0,
    };
    
    const rewardWithout = calculateReward(withoutExplanation);
    const rewardWith = calculateReward(withExplanation);
    
    expect(rewardWithout).toBeGreaterThan(rewardWith);
  });

  it('should penalize high dependency', () => {
    const lowDependency: RewardComponents = {
      independentSuccess: 0.5,
      errorReduction: 0,
      delayedRetention: 0,
      dependencyPenalty: -0.1,
      timeEfficiency: 0,
    };
    
    const highDependency: RewardComponents = {
      independentSuccess: 0.5,
      errorReduction: 0,
      delayedRetention: 0,
      dependencyPenalty: -0.9,
      timeEfficiency: 0,
    };
    
    const rewardLow = calculateReward(lowDependency);
    const rewardHigh = calculateReward(highDependency);
    
    expect(rewardLow).toBeGreaterThan(rewardHigh);
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

describe('DEFAULT_REWARD_WEIGHTS', () => {
  it('should have correct default weights', () => {
    expect(DEFAULT_REWARD_WEIGHTS.independentSuccess).toBe(0.35);
    expect(DEFAULT_REWARD_WEIGHTS.errorReduction).toBe(0.25);
    expect(DEFAULT_REWARD_WEIGHTS.delayedRetention).toBe(0.20);
    expect(DEFAULT_REWARD_WEIGHTS.dependency).toBe(-0.15);
    expect(DEFAULT_REWARD_WEIGHTS.timeEfficiency).toBe(0.05);
  });

  it('should have weights that sum to 1.0 (absolute value)', () => {
    const sum = Math.abs(DEFAULT_REWARD_WEIGHTS.independentSuccess) +
      Math.abs(DEFAULT_REWARD_WEIGHTS.errorReduction) +
      Math.abs(DEFAULT_REWARD_WEIGHTS.delayedRetention) +
      Math.abs(DEFAULT_REWARD_WEIGHTS.dependency) +
      Math.abs(DEFAULT_REWARD_WEIGHTS.timeEfficiency);
    expect(sum).toBeCloseTo(1.0, 2);
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
    expect(reward).toBe(0.5);
  });

  it('should handle mixed positive and negative', () => {
    const components: RewardComponents = {
      independentSuccess: 1,    // +0.35 * 1
      errorReduction: -1,       // +0.25 * -1
      delayedRetention: 0,
      dependencyPenalty: -0.5,  // -0.15 * -0.5 = +0.075
      timeEfficiency: 0,
    };
    
    const reward = calculateReward(components);
    expect(reward).toBeGreaterThan(0);
    expect(reward).toBeLessThan(1);
  });
});
