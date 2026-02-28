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
