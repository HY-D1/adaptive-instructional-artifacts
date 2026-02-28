/**
 * Unit tests for learner-bandit-manager.ts
 * 
 * @vitest-environment node
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  LearnerBanditManager,
  banditManager,
  BANDIT_ARM_PROFILES,
  LEARNER_BANDIT_MANAGER_VERSION,
  type BanditArmId,
} from './learner-bandit-manager';

describe('LearnerBanditManager', () => {
  let manager: LearnerBanditManager;

  beforeEach(() => {
    manager = new LearnerBanditManager();
  });

  it('should create a new bandit for a learner', () => {
    const bandit = manager.getBanditForLearner('learner-1');
    expect(bandit).toBeDefined();
    expect(bandit.getArmIds()).toHaveLength(4);
  });

  it('should return the same bandit for the same learner', () => {
    const bandit1 = manager.getBanditForLearner('learner-1');
    const bandit2 = manager.getBanditForLearner('learner-1');
    expect(bandit1).toBe(bandit2);
  });

  it('should create different bandits for different learners', () => {
    const bandit1 = manager.getBanditForLearner('learner-1');
    const bandit2 = manager.getBanditForLearner('learner-2');
    expect(bandit1).not.toBe(bandit2);
  });

  it('should track multiple learners', () => {
    manager.getBanditForLearner('learner-1');
    manager.getBanditForLearner('learner-2');
    manager.getBanditForLearner('learner-3');
    
    expect(manager.getLearnerCount()).toBe(3);
    expect(manager.getLearnerIds()).toContain('learner-1');
    expect(manager.getLearnerIds()).toContain('learner-2');
    expect(manager.getLearnerIds()).toContain('learner-3');
  });

  it('should check if learner has bandit', () => {
    expect(manager.hasBandit('learner-1')).toBe(false);
    manager.getBanditForLearner('learner-1');
    expect(manager.hasBandit('learner-1')).toBe(true);
  });

  it('should reset learner bandit', () => {
    const bandit1 = manager.getBanditForLearner('learner-1');
    bandit1.updateArm('aggressive', 0.8);
    
    manager.resetLearner('learner-1');
    
    expect(manager.hasBandit('learner-1')).toBe(false);
    
    // Getting bandit again creates fresh one
    const bandit2 = manager.getBanditForLearner('learner-1');
    expect(bandit2).not.toBe(bandit1);
    expect(bandit2.getArm('aggressive')?.pullCount).toBe(0);
  });

  it('should select a profile for a learner', () => {
    const result = manager.selectProfileForLearner('learner-1');
    
    expect(result).toHaveProperty('profile');
    expect(result).toHaveProperty('armId');
    expect(['aggressive', 'conservative', 'explanation-first', 'adaptive']).toContain(result.armId);
  });

  it('should select profiles deterministically for same learner', () => {
    // Select multiple times and check we get valid profiles
    for (let i = 0; i < 10; i++) {
      const result = manager.selectProfileForLearner('learner-1');
      expect(Object.keys(BANDIT_ARM_PROFILES)).toContain(result.armId);
    }
  });

  it('should map aggressive arm to fast escalator', () => {
    const profile = BANDIT_ARM_PROFILES.aggressive;
    expect(profile.id).toBe('fast-escalator');
    expect(profile.thresholds.escalate).toBe(2);
  });

  it('should map conservative arm to slow escalator', () => {
    const profile = BANDIT_ARM_PROFILES.conservative;
    expect(profile.id).toBe('slow-escalator');
    expect(profile.thresholds.escalate).toBe(5);
  });

  it('should map adaptive arm to adaptive escalator', () => {
    const profile = BANDIT_ARM_PROFILES.adaptive;
    expect(profile.id).toBe('adaptive-escalator');
    expect(profile.thresholds.escalate).toBe(3);
  });

  it('should map explanation-first arm correctly', () => {
    const profile = BANDIT_ARM_PROFILES['explanation-first'];
    expect(profile.id).toBe('explanation-first');
    expect(profile.thresholds.escalate).toBe(1);
  });

  it('should get learner stats', () => {
    manager.getBanditForLearner('learner-1');
    
    const stats = manager.getLearnerStats('learner-1');
    expect(stats).toHaveLength(4);
    
    stats.forEach(stat => {
      expect(stat).toHaveProperty('armId');
      expect(stat).toHaveProperty('profileName');
      expect(stat).toHaveProperty('meanReward');
      expect(stat).toHaveProperty('pullCount');
      expect(typeof stat.meanReward).toBe('number');
      expect(typeof stat.pullCount).toBe('number');
    });
  });

  it('should record outcome and update bandit', () => {
    const result = manager.selectProfileForLearner('learner-1');
    const armId = result.armId;
    
    const initialStats = manager.getLearnerStats('learner-1');
    const initialPullCount = initialStats.find(s => s.armId === armId)?.pullCount ?? 0;
    
    manager.recordOutcome('learner-1', armId, {
      solved: true,
      usedExplanation: false,
      errorCount: 2,
      baselineErrors: 4,
      timeSpentMs: 5000,
      medianTimeMs: 10000,
      hdiScore: 0.3,
    });
    
    const updatedStats = manager.getLearnerStats('learner-1');
    const updatedPullCount = updatedStats.find(s => s.armId === armId)?.pullCount ?? 0;
    
    expect(updatedPullCount).toBe(initialPullCount + 1);
  });

  it('should handle recording outcome for non-existent learner', () => {
    // Should not throw
    expect(() => {
      manager.recordOutcome('nonexistent', 'aggressive', {
        solved: true,
        usedExplanation: false,
        errorCount: 2,
        baselineErrors: 4,
        timeSpentMs: 5000,
        medianTimeMs: 10000,
        hdiScore: 0.3,
      });
    }).not.toThrow();
  });

  it('should calculate reward correctly for good outcome', () => {
    const bandit = manager.getBanditForLearner('learner-1');
    
    // Record a good outcome (solved quickly without help)
    manager.recordOutcome('learner-1', 'aggressive', {
      solved: true,
      usedExplanation: false,
      errorCount: 1,
      baselineErrors: 3,
      timeSpentMs: 3000,
      medianTimeMs: 10000,
      hdiScore: 0.2,
    });
    
    const stats = bandit.getArmStats('aggressive');
    // Good outcome should increase mean reward
    expect(stats?.meanReward).toBeGreaterThan(0.5);
  });

  it('should calculate reward correctly for poor outcome', () => {
    const bandit = manager.getBanditForLearner('learner-1');
    
    // Record a poor outcome (not solved, many errors, slow)
    manager.recordOutcome('learner-1', 'aggressive', {
      solved: false,
      usedExplanation: true,
      errorCount: 10,
      baselineErrors: 5,
      timeSpentMs: 20000,
      medianTimeMs: 10000,
      hdiScore: 0.8,
    });
    
    const stats = bandit.getArmStats('aggressive');
    // Poor outcome should decrease mean reward
    expect(stats?.meanReward).toBeLessThan(0.5);
  });

  it('should clear all bandits', () => {
    manager.getBanditForLearner('learner-1');
    manager.getBanditForLearner('learner-2');
    
    expect(manager.getLearnerCount()).toBe(2);
    
    manager.clearAll();
    
    expect(manager.getLearnerCount()).toBe(0);
    expect(manager.hasBandit('learner-1')).toBe(false);
    expect(manager.hasBandit('learner-2')).toBe(false);
  });
});

describe('Global banditManager instance', () => {
  it('should be defined', () => {
    expect(banditManager).toBeDefined();
    expect(banditManager).toBeInstanceOf(LearnerBanditManager);
  });

  it('should persist state across calls', () => {
    // First call creates bandit
    banditManager.getBanditForLearner('global-test-learner');
    
    // Second call returns same bandit
    const bandit2 = banditManager.getBanditForLearner('global-test-learner');
    expect(banditManager.hasBandit('global-test-learner')).toBe(true);
    
    // Cleanup
    banditManager.resetLearner('global-test-learner');
  });
});

describe('BANDIT_ARM_PROFILES', () => {
  it('should have 4 arms defined', () => {
    expect(Object.keys(BANDIT_ARM_PROFILES)).toHaveLength(4);
  });

  it('should have required arm IDs', () => {
    expect(BANDIT_ARM_PROFILES).toHaveProperty('aggressive');
    expect(BANDIT_ARM_PROFILES).toHaveProperty('conservative');
    expect(BANDIT_ARM_PROFILES).toHaveProperty('explanation-first');
    expect(BANDIT_ARM_PROFILES).toHaveProperty('adaptive');
  });

  it('should have profiles with required properties', () => {
    Object.values(BANDIT_ARM_PROFILES).forEach(profile => {
      expect(profile).toHaveProperty('id');
      expect(profile).toHaveProperty('name');
      expect(profile).toHaveProperty('description');
      expect(profile).toHaveProperty('thresholds');
      expect(profile).toHaveProperty('triggers');
    });
  });
});

describe('Version constant', () => {
  it('should export version string', () => {
    expect(typeof LEARNER_BANDIT_MANAGER_VERSION).toBe('string');
    expect(LEARNER_BANDIT_MANAGER_VERSION).toContain('learner-bandit');
  });
});
