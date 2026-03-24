import { describe, it, expect, beforeEach } from 'vitest';
import {
  hashString,
  generateSessionId,
  assignCondition,
  reconstructSessionConfig,
  getConditionDistribution,
  validateSessionConfig,
  getExperimentalConditions,
  getConditionAssignmentVersion
} from './condition-assignment';
import type { SessionConfig } from '../../types';

describe('@weekly Condition Assignment', () => {
  describe('hashString', () => {
    it('should return consistent hash for same input', () => {
      const hash1 = hashString('test-learner-123');
      const hash2 = hashString('test-learner-123');
      expect(hash1).toBe(hash2);
    });

    it('should return different hashes for different inputs', () => {
      const hash1 = hashString('learner-a');
      const hash2 = hashString('learner-b');
      expect(hash1).not.toBe(hash2);
    });

    it('should return 0 for empty string', () => {
      expect(hashString('')).toBe(0);
    });

    it('should return 0 for non-string input', () => {
      expect(hashString(null as unknown as string)).toBe(0);
      expect(hashString(undefined as unknown as string)).toBe(0);
    });

    it('should produce positive integers', () => {
      const hash = hashString('any-string');
      expect(Number.isInteger(hash)).toBe(true);
      expect(hash).toBeGreaterThanOrEqual(0);
    });
  });

  describe('generateSessionId', () => {
    it('should generate unique IDs', () => {
      const id1 = generateSessionId();
      const id2 = generateSessionId();
      expect(id1).not.toBe(id2);
    });

    it('should start with session-', () => {
      const id = generateSessionId();
      expect(id.startsWith('session-')).toBe(true);
    });
  });

  describe('assignCondition', () => {
    it('should return valid SessionConfig', () => {
      const config = assignCondition('learner-123');
      
      expect(config.sessionId).toBeDefined();
      expect(config.learnerId).toBe('learner-123');
      expect(config.conditionId).toBeDefined();
      expect(config.escalationPolicy).toBeDefined();
      expect(config.createdAt).toBeGreaterThan(0);
    });

    it('should assign consistent condition for same learner', () => {
      const config1 = assignCondition('learner-abc');
      const config2 = assignCondition('learner-abc');
      
      expect(config1.conditionId).toBe(config2.conditionId);
      expect(config1.escalationPolicy).toBe(config2.escalationPolicy);
    });

    it('should assign escalationPolicy matching conditionId', () => {
      const config = assignCondition('learner-test');
      expect(config.escalationPolicy).toBe(config.conditionId);
    });

    it('should respect forceCondition option', () => {
      const config = assignCondition('learner-xyz', { forceCondition: 'aggressive' });
      expect(config.conditionId).toBe('aggressive');
      expect(config.escalationPolicy).toBe('aggressive');
    });

    it('should set correct toggles for aggressive policy', () => {
      const config = assignCondition('any', { forceCondition: 'aggressive' });
      expect(config.textbookDisabled).toBe(false);
      expect(config.adaptiveLadderDisabled).toBe(false);
      expect(config.immediateExplanationMode).toBe(false);
      expect(config.staticHintMode).toBe(false);
    });

    it('should set correct toggles for conservative policy', () => {
      const config = assignCondition('any', { forceCondition: 'conservative' });
      expect(config.textbookDisabled).toBe(false);
      expect(config.adaptiveLadderDisabled).toBe(true);
      expect(config.staticHintMode).toBe(true);
    });

    it('should set correct toggles for explanation_first policy', () => {
      const config = assignCondition('any', { forceCondition: 'explanation_first' });
      expect(config.immediateExplanationMode).toBe(true);
      expect(config.adaptiveLadderDisabled).toBe(true);
      expect(config.textbookDisabled).toBe(true);  // No textbook in explanation-first
    });

    it('should set correct toggles for no_hints policy', () => {
      const config = assignCondition('any', { forceCondition: 'no_hints' });
      expect(config.textbookDisabled).toBe(false);  // Textbook still available
      expect(config.adaptiveLadderDisabled).toBe(true);
    });

    it('should filter by availableConditions', () => {
      const config = assignCondition('learner-test', {
        availableConditions: ['aggressive', 'conservative']
      });
      expect(['aggressive', 'conservative']).toContain(config.conditionId);
    });

    it('should use provided timestamp', () => {
      const timestamp = 1234567890;
      const config = assignCondition('learner-test', { timestamp });
      expect(config.createdAt).toBe(timestamp);
    });
  });

  describe('reconstructSessionConfig', () => {
    it('should reconstruct from partial config', () => {
      const partial: Partial<SessionConfig> = {
        learnerId: 'learner-123',
        conditionId: 'adaptive'
      };
      
      const config = reconstructSessionConfig(partial);
      expect(config.learnerId).toBe('learner-123');
      expect(config.conditionId).toBe('adaptive');
      expect(config.sessionId).toBeDefined();
    });

    it('should preserve existing sessionId', () => {
      const partial: Partial<SessionConfig> = {
        sessionId: 'existing-session-id',
        learnerId: 'learner-123',
        conditionId: 'aggressive'
      };
      
      const config = reconstructSessionConfig(partial);
      expect(config.sessionId).toBe('existing-session-id');
    });

    it('should re-assign if no conditionId', () => {
      const partial: Partial<SessionConfig> = {
        learnerId: 'learner-123'
      };
      
      const config = reconstructSessionConfig(partial);
      expect(config.conditionId).toBeDefined();
      expect(config.escalationPolicy).toBeDefined();
    });
  });

  describe('getConditionDistribution', () => {
    it('should return distribution for all learners', () => {
      const learnerIds = Array.from({ length: 100 }, (_, i) => `learner-${i}`);
      const distribution = getConditionDistribution(learnerIds);
      
      expect(distribution.distribution).toBeDefined();
      expect(distribution.percentages).toBeDefined();
      expect(Object.values(distribution.distribution).reduce((a, b) => a + b, 0)).toBe(100);
    });

    it('should be approximately balanced', () => {
      const learnerIds = Array.from({ length: 300 }, (_, i) => `learner-${i}`);
      const distribution = getConditionDistribution(learnerIds);
      
      // With 300 learners and 3 conditions, each should have ~100
      const counts = Object.values(distribution.distribution);
      counts.forEach(count => {
        expect(count).toBeGreaterThan(80);  // Allow 20% variance
        expect(count).toBeLessThan(120);
      });
    });

    it('should report isBalanced based on chi-square', () => {
      const learnerIds = Array.from({ length: 300 }, (_, i) => `learner-${i}`);
      const distribution = getConditionDistribution(learnerIds);
      
      expect(typeof distribution.isBalanced).toBe('boolean');
      expect(distribution.chiSquare).toBeGreaterThanOrEqual(0);
    });

    it('should use custom conditions when provided', () => {
      const learnerIds = ['a', 'b', 'c', 'd'];
      const distribution = getConditionDistribution(learnerIds, ['cond1', 'cond2']);
      
      expect(Object.keys(distribution.distribution)).toContain('cond1');
      expect(Object.keys(distribution.distribution)).toContain('cond2');
    });
  });

  describe('validateSessionConfig', () => {
    it('should validate complete config', () => {
      const config = assignCondition('learner-123');
      const validation = validateSessionConfig(config);
      
      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('should detect missing sessionId', () => {
      const config = { ...assignCondition('learner-123'), sessionId: '' };
      const validation = validateSessionConfig(config);
      
      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('Missing sessionId');
    });

    it('should detect missing learnerId', () => {
      const config = { ...assignCondition('learner-123'), learnerId: '' };
      const validation = validateSessionConfig(config);
      
      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('Missing learnerId');
    });

    it('should detect missing conditionId', () => {
      const config = { ...assignCondition('learner-123'), conditionId: '' };
      const validation = validateSessionConfig(config);
      
      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('Missing conditionId');
    });

    it('should detect mismatched condition and policy', () => {
      const config = assignCondition('learner-123');
      config.escalationPolicy = 'conservative' as const;
      // conditionId and escalationPolicy now differ
      
      const validation = validateSessionConfig(config);
      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('conditionId does not match escalationPolicy');
    });

    it('should detect invalid escalationPolicy', () => {
      const config = assignCondition('learner-123');
      (config as unknown as { escalationPolicy: string }).escalationPolicy = 'invalid';
      
      const validation = validateSessionConfig(config);
      expect(validation.valid).toBe(false);
      expect(validation.errors.some(e => e.includes('Invalid escalationPolicy'))).toBe(true);
    });
  });

  describe('getExperimentalConditions', () => {
    it('should return 4 conditions', () => {
      const conditions = getExperimentalConditions();
      expect(conditions).toHaveLength(4);
    });

    it('should not include no_hints', () => {
      const conditions = getExperimentalConditions();
      expect(conditions).not.toContain('no_hints');
    });

    it('should include all other policies', () => {
      const conditions = getExperimentalConditions();
      expect(conditions).toContain('aggressive');
      expect(conditions).toContain('conservative');
      expect(conditions).toContain('explanation_first');
      expect(conditions).toContain('adaptive');
    });
  });

  describe('getConditionAssignmentVersion', () => {
    it('should return version string', () => {
      expect(getConditionAssignmentVersion()).toBe('condition-assignment-v1');
    });
  });
});
