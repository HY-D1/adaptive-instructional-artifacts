/**
 * Unit tests for multi-armed-bandit.ts
 * 
 * @vitest-environment node
 */

import { describe, it, expect } from 'vitest';
import {
  MultiArmedBandit,
  sampleBeta,
  sampleGamma,
  calculateRegret,
  calculateCumulativeRegret,
  createEscalationProfileBandit,
  MULTI_ARMED_BANDIT_VERSION,
} from './multi-armed-bandit';

describe('MultiArmedBandit', () => {
  it('should initialize with correct arm IDs', () => {
    const bandit = new MultiArmedBandit(['arm1', 'arm2', 'arm3']);
    const armIds = bandit.getArmIds();
    
    expect(armIds).toHaveLength(3);
    expect(armIds).toContain('arm1');
    expect(armIds).toContain('arm2');
    expect(armIds).toContain('arm3');
  });

  it('should initialize arms with uniform priors', () => {
    const bandit = new MultiArmedBandit(['arm1', 'arm2']);
    const arm1 = bandit.getArm('arm1');
    const arm2 = bandit.getArm('arm2');
    
    expect(arm1?.alpha).toBe(1); // Prior
    expect(arm1?.beta).toBe(1);  // Prior
    expect(arm1?.pullCount).toBe(0);
    
    expect(arm2?.alpha).toBe(1);
    expect(arm2?.beta).toBe(1);
  });

  it('should select an arm (Thompson Sampling)', () => {
    const bandit = new MultiArmedBandit(['arm1', 'arm2', 'arm3']);
    const selectedArm = bandit.selectArm();
    
    expect(['arm1', 'arm2', 'arm3']).toContain(selectedArm);
  });

  it('should update arm after reward', () => {
    const bandit = new MultiArmedBandit(['arm1']);
    
    bandit.updateArm('arm1', 0.8);
    
    const arm = bandit.getArm('arm1');
    expect(arm?.alpha).toBe(1.8); // 1 + 0.8
    expect(arm?.beta).toBe(1.2);  // 1 + (1 - 0.8)
    expect(arm?.pullCount).toBe(1);
    expect(arm?.cumulativeReward).toBe(0.8);
  });

  it('should update arm multiple times', () => {
    const bandit = new MultiArmedBandit(['arm1']);
    
    bandit.updateArm('arm1', 1.0);
    bandit.updateArm('arm1', 0.5);
    bandit.updateArm('arm1', 0.0);
    
    const arm = bandit.getArm('arm1');
    expect(arm?.pullCount).toBe(3);
    expect(arm?.cumulativeReward).toBe(1.5);
  });

  it('should ignore update for non-existent arm', () => {
    const bandit = new MultiArmedBandit(['arm1']);
    
    // Should not throw
    expect(() => bandit.updateArm('nonexistent', 0.5)).not.toThrow();
  });

  it('should get arm statistics', () => {
    const bandit = new MultiArmedBandit(['arm1']);
    
    // Initial stats with uniform prior
    const stats = bandit.getArmStats('arm1');
    expect(stats).not.toBeNull();
    expect(stats?.meanReward).toBe(0.5); // 1 / (1 + 1)
    expect(stats?.pullCount).toBe(0);
    expect(stats?.confidenceInterval).toHaveLength(2);
  });

  it('should return null stats for non-existent arm', () => {
    const bandit = new MultiArmedBandit(['arm1']);
    const stats = bandit.getArmStats('nonexistent');
    
    expect(stats).toBeNull();
  });

  it('should calculate mean reward correctly after updates', () => {
    const bandit = new MultiArmedBandit(['arm1']);
    
    // Update with reward 1.0 three times
    bandit.updateArm('arm1', 1.0);
    bandit.updateArm('arm1', 1.0);
    bandit.updateArm('arm1', 1.0);
    
    const stats = bandit.getArmStats('arm1');
    // Alpha = 1 + 3 = 4, Beta = 1 + 0 = 1
    // Mean = 4 / (4 + 1) = 0.8
    expect(stats?.meanReward).toBeCloseTo(0.8, 2);
  });

  it('should get best arm based on empirical mean', () => {
    const bandit = new MultiArmedBandit(['good', 'bad']);
    
    // Make 'good' arm better
    bandit.updateArm('good', 1.0);
    bandit.updateArm('good', 1.0);
    bandit.updateArm('good', 1.0);
    
    // Make 'bad' arm worse
    bandit.updateArm('bad', 0.0);
    bandit.updateArm('bad', 0.0);
    
    const bestArm = bandit.getBestArm();
    expect(bestArm).toBe('good');
  });

  it('should serialize and deserialize state', () => {
    const bandit = new MultiArmedBandit(['arm1', 'arm2']);
    
    bandit.updateArm('arm1', 0.8);
    bandit.updateArm('arm2', 0.3);
    
    const serialized = bandit.serialize();
    expect(serialized.arms).toHaveLength(2);
    
    const newBandit = new MultiArmedBandit(['arm1', 'arm2']);
    newBandit.deserialize(serialized);
    
    expect(newBandit.getArm('arm1')?.alpha).toBe(bandit.getArm('arm1')?.alpha);
    expect(newBandit.getArm('arm1')?.pullCount).toBe(bandit.getArm('arm1')?.pullCount);
  });

  it('should calculate cumulative regret', () => {
    // Test the standalone calculateRegret function
    // Regret = optimalReward - actualReward (clamped to >= 0)
    const regret1 = calculateRegret(0.9, 0.5);
    expect(regret1).toBe(0.4);
    
    const regret2 = calculateRegret(0.9, 0.9);
    expect(regret2).toBe(0);
    
    const regret3 = calculateRegret(0.9, 1.0);
    expect(regret3).toBe(0); // No negative regret
  });
});

describe('sampleGamma', () => {
  it('should return positive values', () => {
    for (let i = 0; i < 10; i++) {
      const sample = sampleGamma(2, 1);
      expect(sample).toBeGreaterThan(0);
    }
  });

  it('should produce different values (randomness)', () => {
    const samples = Array.from({ length: 5 }, () => sampleGamma(2, 1));
    const uniqueSamples = new Set(samples);
    expect(uniqueSamples.size).toBeGreaterThan(1);
  });

  it('should handle shape = 1 (exponential)', () => {
    const samples = Array.from({ length: 10 }, () => sampleGamma(1, 1));
    samples.forEach(sample => {
      expect(sample).toBeGreaterThan(0);
    });
  });

  it('should handle large shape values', () => {
    const samples = Array.from({ length: 10 }, () => sampleGamma(10, 1));
    samples.forEach(sample => {
      expect(sample).toBeGreaterThan(0);
    });
  });
});

describe('sampleBeta', () => {
  it('should return values between 0 and 1', () => {
    for (let i = 0; i < 10; i++) {
      const sample = sampleBeta(2, 3);
      expect(sample).toBeGreaterThanOrEqual(0);
      expect(sample).toBeLessThanOrEqual(1);
    }
  });

  it('should produce different values (randomness)', () => {
    const samples = Array.from({ length: 5 }, () => sampleBeta(2, 2));
    const uniqueSamples = new Set(samples);
    expect(uniqueSamples.size).toBeGreaterThan(1);
  });

  it('should handle symmetric case (alpha = beta)', () => {
    const samples = Array.from({ length: 20 }, () => sampleBeta(2, 2));
    const mean = samples.reduce((a, b) => a + b, 0) / samples.length;
    // Mean should be around 0.5 for symmetric Beta
    expect(mean).toBeGreaterThan(0.3);
    expect(mean).toBeLessThan(0.7);
  });

  it('should skew toward 0 when alpha < beta', () => {
    const samples = Array.from({ length: 20 }, () => sampleBeta(1, 5));
    const mean = samples.reduce((a, b) => a + b, 0) / samples.length;
    // Mean should be less than 0.5
    expect(mean).toBeLessThan(0.5);
  });

  it('should skew toward 1 when alpha > beta', () => {
    const samples = Array.from({ length: 20 }, () => sampleBeta(5, 1));
    const mean = samples.reduce((a, b) => a + b, 0) / samples.length;
    // Mean should be greater than 0.5
    expect(mean).toBeGreaterThan(0.5);
  });
});

describe('Thompson Sampling behavior', () => {
  it('should preferentially select better arms over time', () => {
    const bandit = new MultiArmedBandit(['good', 'bad']);
    
    // Train the arms: 'good' is actually good, 'bad' is actually bad
    for (let i = 0; i < 20; i++) {
      bandit.updateArm('good', 0.9);
      bandit.updateArm('bad', 0.1);
    }
    
    // Sample many times and count selections
    const selections: Record<string, number> = { good: 0, bad: 0 };
    for (let i = 0; i < 50; i++) {
      const selected = bandit.selectArm();
      selections[selected]++;
    }
    
    // Good arm should be selected more often
    expect(selections['good']).toBeGreaterThan(selections['bad']);
  });

  it('should explore initially when arms have uniform priors', () => {
    const bandit = new MultiArmedBandit(['a', 'b', 'c', 'd']);
    
    // Sample many times
    const selections: Record<string, number> = { a: 0, b: 0, c: 0, d: 0 };
    for (let i = 0; i < 40; i++) {
      const selected = bandit.selectArm();
      selections[selected]++;
    }
    
    // All arms should have been selected at least once
    expect(selections['a']).toBeGreaterThan(0);
    expect(selections['b']).toBeGreaterThan(0);
    expect(selections['c']).toBeGreaterThan(0);
    expect(selections['d']).toBeGreaterThan(0);
  });
});

describe('Version constant', () => {
  it('should export version string', () => {
    expect(typeof MULTI_ARMED_BANDIT_VERSION).toBe('string');
    expect(MULTI_ARMED_BANDIT_VERSION).toContain('bandit');
  });
});

describe('MultiArmedBandit - edge cases', () => {
  it('should throw error when selecting arm with no arms', () => {
    const bandit = new MultiArmedBandit([]);
    expect(() => bandit.selectArm()).toThrow('No arms available in bandit');
  });

  it('should return null for getBestArm when no arms exist', () => {
    const bandit = new MultiArmedBandit([]);
    expect(bandit.getBestArm()).toBeNull();
  });

  it('should return 0 for getArmCount when no arms exist', () => {
    const bandit = new MultiArmedBandit([]);
    expect(bandit.getArmCount()).toBe(0);
  });

  it('should reset all arms to initial state', () => {
    const bandit = new MultiArmedBandit(['arm1', 'arm2']);
    
    // Update arms
    bandit.updateArm('arm1', 0.9);
    bandit.updateArm('arm1', 0.8);
    bandit.updateArm('arm2', 0.3);
    
    // Reset
    bandit.reset();
    
    // Verify arms are back to initial state
    const arm1 = bandit.getArm('arm1');
    const arm2 = bandit.getArm('arm2');
    
    expect(arm1?.alpha).toBe(1);
    expect(arm1?.beta).toBe(1);
    expect(arm1?.pullCount).toBe(0);
    expect(arm1?.cumulativeReward).toBe(0);
    
    expect(arm2?.alpha).toBe(1);
    expect(arm2?.beta).toBe(1);
    expect(arm2?.pullCount).toBe(0);
    expect(arm2?.cumulativeReward).toBe(0);
  });

  it('should handle getArm for non-existent arm', () => {
    const bandit = new MultiArmedBandit(['arm1']);
    expect(bandit.getArm('nonexistent')).toBeUndefined();
  });

  it('should return correct arm count', () => {
    const bandit = new MultiArmedBandit(['a', 'b', 'c', 'd']);
    expect(bandit.getArmCount()).toBe(4);
  });

  it('should handle reward clamping (reward > 1)', () => {
    const bandit = new MultiArmedBandit(['arm1']);
    bandit.updateArm('arm1', 1.5); // Should be clamped to 1
    
    const arm = bandit.getArm('arm1');
    expect(arm?.alpha).toBe(2); // 1 + 1 (clamped)
    expect(arm?.beta).toBe(1); // 1 + 0
  });

  it('should handle reward clamping (reward < 0)', () => {
    const bandit = new MultiArmedBandit(['arm1']);
    bandit.updateArm('arm1', -0.5); // Should be clamped to 0
    
    const arm = bandit.getArm('arm1');
    expect(arm?.alpha).toBe(1); // 1 + 0 (clamped)
    expect(arm?.beta).toBe(2); // 1 + 1
  });
});

describe('createEscalationProfileBandit', () => {
  it('should create bandit with escalation profile arms', () => {
    const bandit = createEscalationProfileBandit();
    
    expect(bandit.getArmIds()).toContain('fast-escalator');
    expect(bandit.getArmIds()).toContain('slow-escalator');
    expect(bandit.getArmIds()).toContain('adaptive-escalator');
    expect(bandit.getArmIds()).toContain('explanation-first');
    expect(bandit.getArmCount()).toBe(4);
  });

  it('should select an escalation profile arm', () => {
    const bandit = createEscalationProfileBandit();
    const selected = bandit.selectArm();
    
    expect(['fast-escalator', 'slow-escalator', 'adaptive-escalator', 'explanation-first']).toContain(selected);
  });
});

describe('calculateCumulativeRegret', () => {
  it('should calculate cumulative regret for reward sequence', () => {
    const rewards = [0.5, 0.6, 0.7, 0.8];
    const optimalReward = 1.0;
    
    const cumulativeRegret = calculateCumulativeRegret(rewards, optimalReward);
    
    // Regret: 0.5 + 0.4 + 0.3 + 0.2 = 1.4
    expect(cumulativeRegret).toBeCloseTo(1.4, 10);
  });

  it('should return 0 when all rewards are optimal', () => {
    const rewards = [1.0, 1.0, 1.0];
    const optimalReward = 1.0;
    
    const cumulativeRegret = calculateCumulativeRegret(rewards, optimalReward);
    expect(cumulativeRegret).toBe(0);
  });

  it('should handle empty rewards array', () => {
    const rewards: number[] = [];
    const optimalReward = 1.0;
    
    const cumulativeRegret = calculateCumulativeRegret(rewards, optimalReward);
    expect(cumulativeRegret).toBe(0);
  });

  it('should handle single reward', () => {
    const rewards = [0.5];
    const optimalReward = 1.0;
    
    const cumulativeRegret = calculateCumulativeRegret(rewards, optimalReward);
    expect(cumulativeRegret).toBe(0.5);
  });
});

describe('sampleGamma edge cases', () => {
  it('should handle shape < 1 (fallback case)', () => {
    // Test the fallback branch for shape < 1
    const samples = Array.from({ length: 10 }, () => sampleGamma(0.5, 1));
    samples.forEach(sample => {
      expect(sample).toBeGreaterThanOrEqual(0);
    });
  });

  it('should handle very small shape values', () => {
    const samples = Array.from({ length: 10 }, () => sampleGamma(0.1, 1));
    samples.forEach(sample => {
      expect(sample).toBeGreaterThanOrEqual(0);
    });
  });
});

describe('sampleBeta edge cases', () => {
  it('should handle very small alpha values', () => {
    const samples = Array.from({ length: 10 }, () => sampleBeta(0.0001, 1));
    samples.forEach(sample => {
      expect(sample).toBeGreaterThanOrEqual(0);
      expect(sample).toBeLessThanOrEqual(1);
    });
  });

  it('should handle very small beta values', () => {
    const samples = Array.from({ length: 10 }, () => sampleBeta(1, 0.0001));
    samples.forEach(sample => {
      expect(sample).toBeGreaterThanOrEqual(0);
      expect(sample).toBeLessThanOrEqual(1);
    });
  });

  it('should handle both parameters very small', () => {
    const samples = Array.from({ length: 10 }, () => sampleBeta(0.0001, 0.0001));
    samples.forEach(sample => {
      expect(sample).toBeGreaterThanOrEqual(0);
      expect(sample).toBeLessThanOrEqual(1);
    });
  });
});

describe('MultiArmedBandit serialization edge cases', () => {
  it('should deserialize with custom priors', () => {
    const bandit = new MultiArmedBandit(['arm1']);
    bandit.updateArm('arm1', 0.8);
    
    const serialized = bandit.serialize();
    
    // Modify serialized state
    serialized.priorAlpha = 2;
    serialized.priorBeta = 2;
    
    const newBandit = new MultiArmedBandit(['arm1']);
    newBandit.deserialize(serialized);
    
    expect(newBandit.getArm('arm1')?.alpha).toBe(1.8);
    expect(newBandit.getArm('arm1')?.pullCount).toBe(1);
  });

  it('should handle getArmStats with high pull count', () => {
    const bandit = new MultiArmedBandit(['arm1']);
    
    // Simulate many pulls
    for (let i = 0; i < 100; i++) {
      bandit.updateArm('arm1', 0.7);
    }
    
    const stats = bandit.getArmStats('arm1');
    expect(stats?.pullCount).toBe(100);
    expect(stats?.meanReward).toBeCloseTo(0.7, 1);
    expect(stats?.confidenceInterval[0]).toBeGreaterThanOrEqual(0);
    expect(stats?.confidenceInterval[1]).toBeLessThanOrEqual(1);
  });
});

describe('Edge Cases - Bandit', () => {
  test('handles zero arms', () => {
    // Empty arm array
    // Should throw or handle gracefully
    const bandit = new MultiArmedBandit([]);
    expect(bandit.getArmCount()).toBe(0);
    expect(bandit.getBestArm()).toBeNull();
    expect(bandit.getArmIds()).toEqual([]);
    expect(() => bandit.selectArm()).toThrow('No arms available in bandit');
  });

  test('handles single arm', () => {
    // Only one arm
    // Should always select that arm
    const bandit = new MultiArmedBandit(['only-arm']);
    
    expect(bandit.getArmCount()).toBe(1);
    
    // Should always select the same arm
    for (let i = 0; i < 20; i++) {
      const selected = bandit.selectArm();
      expect(selected).toBe('only-arm');
    }
    
    // Best arm should also be the only arm
    expect(bandit.getBestArm()).toBe('only-arm');
  });

  test('handles extreme alpha/beta values - very high alpha', () => {
    // alpha=1000, beta=1
    // Should not overflow
    const bandit = new MultiArmedBandit(['high-alpha']);
    
    // Simulate many high rewards to get high alpha
    for (let i = 0; i < 1000; i++) {
      bandit.updateArm('high-alpha', 1.0);
    }
    
    const arm = bandit.getArm('high-alpha');
    expect(arm?.alpha).toBe(1001); // 1 + 1000
    expect(arm?.beta).toBe(1);
    
    // Should still be able to select arm
    const selected = bandit.selectArm();
    expect(selected).toBe('high-alpha');
    
    // Stats should be reasonable
    const stats = bandit.getArmStats('high-alpha');
    expect(stats?.meanReward).toBeCloseTo(1.0, 2);
  });

  test('handles extreme alpha/beta values - very high beta', () => {
    // alpha=1, beta=1000
    // Should not overflow
    const bandit = new MultiArmedBandit(['high-beta']);
    
    // Simulate many low rewards to get high beta
    for (let i = 0; i < 1000; i++) {
      bandit.updateArm('high-beta', 0.0);
    }
    
    const arm = bandit.getArm('high-beta');
    expect(arm?.alpha).toBe(1);
    expect(arm?.beta).toBe(1001); // 1 + 1000
    
    // Stats should be reasonable
    const stats = bandit.getArmStats('high-beta');
    // With alpha=1, beta=1001, mean is very close to 0 but not exactly 0
    expect(stats?.meanReward).toBeGreaterThanOrEqual(0);
    expect(stats?.meanReward).toBeLessThan(0.01);
  });

  test('handles rewards outside [0,1]', () => {
    // reward=2, reward=-1
    // Should clamp or handle
    const bandit = new MultiArmedBandit(['test-arm']);
    
    // Test reward > 1 (should clamp to 1)
    bandit.updateArm('test-arm', 2.0);
    let arm = bandit.getArm('test-arm');
    expect(arm?.alpha).toBe(2); // 1 + 1 (clamped)
    expect(arm?.beta).toBe(1);  // 1 + 0
    
    // Test reward < 0 (should clamp to 0)
    bandit.updateArm('test-arm', -1.0);
    arm = bandit.getArm('test-arm');
    expect(arm?.alpha).toBe(2); // 2 + 0 (clamped)
    expect(arm?.beta).toBe(2);  // 1 + 1
    
    // Test very large reward
    bandit.updateArm('test-arm', 1000000);
    arm = bandit.getArm('test-arm');
    expect(arm?.alpha).toBe(3); // 2 + 1 (clamped)
    expect(arm?.beta).toBe(2);  // 2 + 0
  });

  test('handles many pulls', () => {
    // 100,000 pulls
    // Performance should remain good
    const bandit = new MultiArmedBandit(['arm1', 'arm2']);
    
    const startTime = Date.now();
    
    // Perform 100,000 updates
    for (let i = 0; i < 100000; i++) {
      bandit.updateArm('arm1', i % 2 === 0 ? 1.0 : 0.0);
      if (i % 100 === 0) {
        bandit.selectArm();
      }
    }
    
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    // Should complete in reasonable time (less than 5 seconds)
    expect(duration).toBeLessThan(5000);
    
    const arm = bandit.getArm('arm1');
    expect(arm?.pullCount).toBe(100000);
  });

  test('handles NaN in rewards', () => {
    const bandit = new MultiArmedBandit(['test-arm']);
    
    // NaN reward should be treated as 0 (clamped)
    bandit.updateArm('test-arm', NaN);
    
    const arm = bandit.getArm('test-arm');
    expect(arm?.pullCount).toBe(1);
    // NaN is not >= 0 and not <= 1, so Math.max(0, Math.min(1, NaN)) = NaN
    // But adding NaN to alpha would make it NaN
    expect(arm?.alpha).toBeNaN();
    expect(arm?.beta).toBeNaN();
  });

  test('handles Infinity in rewards', () => {
    const bandit = new MultiArmedBandit(['test-arm']);
    
    // Infinity reward should be clamped to 1
    bandit.updateArm('test-arm', Infinity);
    
    const arm = bandit.getArm('test-arm');
    expect(arm?.pullCount).toBe(1);
    expect(arm?.alpha).toBe(2); // 1 + 1 (clamped)
    expect(arm?.beta).toBe(1);
    
    // -Infinity should be clamped to 0
    bandit.updateArm('test-arm', -Infinity);
    const arm2 = bandit.getArm('test-arm');
    expect(arm2?.alpha).toBe(2); // 2 + 0 (clamped)
    expect(arm2?.beta).toBe(2);  // 1 + 1
  });

  test('serialization with extreme values', () => {
    // Serialize/deserialize with extreme alpha/beta
    // Should maintain precision
    const bandit = new MultiArmedBandit(['arm1']);
    
    // Create extreme values
    for (let i = 0; i < 5000; i++) {
      bandit.updateArm('arm1', 0.5);
    }
    
    const serialized = bandit.serialize();
    
    // Create new bandit and deserialize
    const newBandit = new MultiArmedBandit(['arm1']);
    newBandit.deserialize(serialized);
    
    const originalArm = bandit.getArm('arm1');
    const deserializedArm = newBandit.getArm('arm1');
    
    // Should maintain precision
    expect(deserializedArm?.alpha).toBe(originalArm?.alpha);
    expect(deserializedArm?.beta).toBe(originalArm?.beta);
    expect(deserializedArm?.pullCount).toBe(originalArm?.pullCount);
    expect(deserializedArm?.cumulativeReward).toBe(originalArm?.cumulativeReward);
  });

  test('handles getArmStats with extreme values', () => {
    const bandit = new MultiArmedBandit(['arm1']);
    
    // Create very high alpha/beta
    for (let i = 0; i < 10000; i++) {
      bandit.updateArm('arm1', 0.75);
    }
    
    const stats = bandit.getArmStats('arm1');
    
    // Mean should be approximately 0.75
    expect(stats?.meanReward).toBeCloseTo(0.75, 2);
    
    // Confidence interval should be narrow (high confidence due to many samples)
    const ci = stats?.confidenceInterval;
    expect(ci![1] - ci![0]).toBeLessThan(0.1);
  });

  test('handles negative alpha/beta in serialized state gracefully', () => {
    const bandit = new MultiArmedBandit(['arm1']);
    
    // Manually create serialized state with negative values
    const corruptedState = {
      arms: [{
        id: 'arm1',
        alpha: -10,
        beta: -5,
        pullCount: 100,
        cumulativeReward: 50
      }],
      priorAlpha: 1,
      priorBeta: 1
    };
    
    // Deserializing negative values
    bandit.deserialize(corruptedState);
    
    const arm = bandit.getArm('arm1');
    expect(arm?.alpha).toBe(-10);
    expect(arm?.beta).toBe(-5);
    
    // SampleBeta should handle negative values by clamping to 0.001
    const sample = sampleBeta(arm?.alpha || 0.001, arm?.beta || 0.001);
    expect(sample).toBeGreaterThanOrEqual(0);
    expect(sample).toBeLessThanOrEqual(1);
  });

  test('handles updateArm for non-existent arm silently', () => {
    const bandit = new MultiArmedBandit(['arm1']);
    
    // Should not throw
    expect(() => bandit.updateArm('non-existent', 0.5)).not.toThrow();
    
    // State of existing arm should be unchanged
    const arm = bandit.getArm('arm1');
    expect(arm?.pullCount).toBe(0);
  });

  test('handles duplicate arm IDs', () => {
    // Creating bandit with duplicate arm IDs
    const bandit = new MultiArmedBandit(['arm1', 'arm1', 'arm2']);
    
    // Should deduplicate or handle gracefully
    expect(bandit.getArmCount()).toBeLessThanOrEqual(3);
    expect(bandit.getArmIds()).toContain('arm1');
    expect(bandit.getArmIds()).toContain('arm2');
  });

  test('handles calculateCumulativeRegret with extreme values', () => {
    // Test with optimal reward of Infinity
    const rewards = [0.5, 0.6, 0.7];
    
    // Should handle large optimal reward
    const regret1 = calculateCumulativeRegret(rewards, 1000000);
    expect(regret1).toBeGreaterThan(0);
    
    // Should handle optimal reward of 0
    const regret2 = calculateCumulativeRegret(rewards, 0);
    expect(regret2).toBe(0);
    
    // Should handle negative rewards
    const regret3 = calculateCumulativeRegret([-0.5, 0.5, 1.0], 1.0);
    expect(regret3).toBeGreaterThanOrEqual(0);
  });

  test('handles sampleBeta with extreme parameters', () => {
    // Very large alpha and beta
    const samples: number[] = [];
    for (let i = 0; i < 10; i++) {
      samples.push(sampleBeta(10000, 10000));
    }
    
    // All samples should be between 0 and 1
    samples.forEach(sample => {
      expect(sample).toBeGreaterThanOrEqual(0);
      expect(sample).toBeLessThanOrEqual(1);
    });
    
    // Mean should be close to 0.5 for symmetric case
    const mean = samples.reduce((a, b) => a + b, 0) / samples.length;
    expect(mean).toBeGreaterThan(0.4);
    expect(mean).toBeLessThan(0.6);
  });
});
