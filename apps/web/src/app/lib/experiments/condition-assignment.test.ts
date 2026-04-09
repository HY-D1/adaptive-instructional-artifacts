import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  hashString,
  generateSessionId,
  assignCondition,
  reconstructSessionConfig,
  getConditionDistribution,
  validateSessionConfig,
  getExperimentalConditions,
  getConditionAssignmentVersion,
  saveSessionConfig,
  loadSessionConfig,
  safeClearSessionConfig,
  loadSessionConfigAsync,
  SESSION_CONFIG_STORAGE_KEY,
} from './condition-assignment';
import type { SessionConfig } from '../../types';
import { storageClient } from '../api/storage-client';

// Mock storage-client
vi.mock('../api/storage-client', () => ({
  storageClient: {
    getSession: vi.fn(),
  },
  isBackendAvailable: vi.fn(() => true),
}));

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
    it('should return v2 version string', () => {
      expect(getConditionAssignmentVersion()).toBe('condition-assignment-v2');
    });
  });

  // ============================================================================
  // Session Config Persistence Tests (Workstream 3/6)
  // ============================================================================

  describe('Session Config Persistence (Workstream 3/6)', () => {
    beforeEach(() => {
      // Clear sessionStorage before each test
      sessionStorage.clear();
      localStorage.clear();
      vi.clearAllMocks();
    });

    describe('saveSessionConfig', () => {
      it('should save valid config to sessionStorage', () => {
        const config = assignCondition('learner-123');
        const result = saveSessionConfig(config);
        
        expect(result.success).toBe(true);
        expect(sessionStorage.getItem(SESSION_CONFIG_STORAGE_KEY)).not.toBeNull();
      });

      it('should return success=false for invalid config', () => {
        const invalidConfig = { ...assignCondition('learner-123'), sessionId: '' };
        const result = saveSessionConfig(invalidConfig);
        
        expect(result.success).toBe(false);
      });

      it('should not crash on storage quota exceeded', () => {
        // Mock sessionStorage to throw QuotaExceededError
        const originalSetItem = sessionStorage.setItem;
        sessionStorage.setItem = vi.fn(() => {
          throw new DOMException('Quota exceeded', 'QuotaExceededError');
        });
        
        const config = assignCondition('learner-123');
        const result = saveSessionConfig(config);
        
        expect(result.success).toBe(false);
        expect(result.quotaExceeded).toBe(true);
        
        // Restore
        sessionStorage.setItem = originalSetItem;
      });

      it('should not crash on unexpected storage errors', () => {
        // Mock sessionStorage to throw generic error
        const originalSetItem = sessionStorage.setItem;
        sessionStorage.setItem = vi.fn(() => {
          throw new Error('Unexpected error');
        });
        
        const config = assignCondition('learner-123');
        const result = saveSessionConfig(config);
        
        expect(result.success).toBe(false);
        expect(result.quotaExceeded).toBeUndefined();
        
        // Restore
        sessionStorage.setItem = originalSetItem;
      });
    });

    describe('loadSessionConfig', () => {
      it('should load config from sessionStorage', () => {
        const config = assignCondition('learner-123');
        saveSessionConfig(config);
        
        const loaded = loadSessionConfig();
        expect(loaded).not.toBeNull();
        expect(loaded?.learnerId).toBe('learner-123');
        expect(loaded?.conditionId).toBe(config.conditionId);
      });

      it('should return null for non-existent config', () => {
        const loaded = loadSessionConfig();
        expect(loaded).toBeNull();
      });

      it('should return null and clear corrupted config', () => {
        sessionStorage.setItem(SESSION_CONFIG_STORAGE_KEY, 'invalid json');
        
        const loaded = loadSessionConfig();
        expect(loaded).toBeNull();
        expect(sessionStorage.getItem(SESSION_CONFIG_STORAGE_KEY)).toBeNull();
      });

      it('should return null for invalid config and clear it', () => {
        const invalidConfig = { 
          sessionId: '',
          learnerId: '',
          conditionId: '',
          escalationPolicy: 'adaptive',
          createdAt: 0,
        };
        sessionStorage.setItem(SESSION_CONFIG_STORAGE_KEY, JSON.stringify(invalidConfig));
        
        const loaded = loadSessionConfig();
        expect(loaded).toBeNull();
        expect(sessionStorage.getItem(SESSION_CONFIG_STORAGE_KEY)).toBeNull();
      });

      it('should not crash when sessionStorage is unavailable', () => {
        const originalGetItem = sessionStorage.getItem;
        sessionStorage.getItem = vi.fn(() => {
          throw new Error('sessionStorage disabled');
        });
        
        const loaded = loadSessionConfig();
        expect(loaded).toBeNull();
        
        // Restore
        sessionStorage.getItem = originalGetItem;
      });
    });

    describe('safeClearSessionConfig', () => {
      it('should clear config from sessionStorage', () => {
        const config = assignCondition('learner-123');
        saveSessionConfig(config);
        
        const result = safeClearSessionConfig();
        expect(result).toBe(true);
        expect(loadSessionConfig()).toBeNull();
      });

      it('should return false on clear error', () => {
        const originalRemoveItem = sessionStorage.removeItem;
        sessionStorage.removeItem = vi.fn(() => {
          throw new Error('Cannot remove');
        });
        
        const result = safeClearSessionConfig();
        expect(result).toBe(false);
        
        // Restore
        sessionStorage.removeItem = originalRemoveItem;
      });

      it('should also clear legacy localStorage keys', () => {
        localStorage.setItem(SESSION_CONFIG_STORAGE_KEY, 'legacy-data');
        
        safeClearSessionConfig();
        
        expect(localStorage.getItem(SESSION_CONFIG_STORAGE_KEY)).toBeNull();
      });
    });

    describe('loadSessionConfigAsync', () => {
      it('should assign new condition for fresh learner', async () => {
        vi.mocked(storageClient.getSession).mockResolvedValue(null);
        
        const result = await loadSessionConfigAsync('fresh-learner-123');
        
        expect(result.isNewAssignment).toBe(true);
        expect(result.source).toBe('assigned');
        expect(result.config.learnerId).toBe('fresh-learner-123');
        expect(result.config.conditionId).toBeDefined();
      });

      it('should restore from sessionStorage for returning learner', async () => {
        const config = assignCondition('returning-learner-456');
        saveSessionConfig(config);
        vi.mocked(storageClient.getSession).mockResolvedValue(null);
        
        const result = await loadSessionConfigAsync('returning-learner-456');
        
        expect(result.isNewAssignment).toBe(false);
        expect(result.source).toBe('sessionStorage');
        expect(result.config.learnerId).toBe('returning-learner-456');
        expect(result.config.conditionId).toBe(config.conditionId);
      });

      it('should prefer backend over sessionStorage', async () => {
        const backendSession = {
          sessionId: 'backend-session-123',
          conditionId: 'aggressive',
          escalationPolicy: 'aggressive' as const,
          textbookDisabled: false,
          adaptiveLadderDisabled: false,
          startTime: new Date().toISOString(),
        };
        
        // Pre-populate sessionStorage with different condition
        const sessionConfig = assignCondition('learner-789');
        sessionConfig.conditionId = 'conservative';
        saveSessionConfig(sessionConfig);
        
        vi.mocked(storageClient.getSession).mockResolvedValue(backendSession);
        
        const result = await loadSessionConfigAsync('learner-789');
        
        expect(result.source).toBe('backend');
        expect(result.config.conditionId).toBe('aggressive');
      });

      it('should continue without crash on backend failure', async () => {
        vi.mocked(storageClient.getSession).mockRejectedValue(new Error('Network error'));
        
        const result = await loadSessionConfigAsync('learner-abc');
        
        expect(result.isNewAssignment).toBe(true);
        expect(result.source).toBe('assigned');
        expect(result.config.learnerId).toBe('learner-abc');
      });

      it('should handle corrupted sessionStorage gracefully', async () => {
        sessionStorage.setItem(SESSION_CONFIG_STORAGE_KEY, 'invalid-json');
        vi.mocked(storageClient.getSession).mockResolvedValue(null);
        
        const result = await loadSessionConfigAsync('learner-def');
        
        expect(result.isNewAssignment).toBe(true);
        expect(result.source).toBe('assigned');
      });

      it('should not use sessionStorage config for different learner', async () => {
        const config = assignCondition('learner-original');
        saveSessionConfig(config);
        vi.mocked(storageClient.getSession).mockResolvedValue(null);
        
        const result = await loadSessionConfigAsync('learner-different');
        
        expect(result.isNewAssignment).toBe(true);
        expect(result.source).toBe('assigned');
        expect(result.config.learnerId).toBe('learner-different');
      });

      it('should maintain condition assignment determinism', async () => {
        vi.mocked(storageClient.getSession).mockResolvedValue(null);
        
        // First assignment
        const result1 = await loadSessionConfigAsync('deterministic-learner');
        
        // Clear sessionStorage to force re-assignment
        safeClearSessionConfig();
        
        // Second assignment should be identical
        const result2 = await loadSessionConfigAsync('deterministic-learner');
        
        expect(result1.config.conditionId).toBe(result2.config.conditionId);
        expect(result1.config.escalationPolicy).toBe(result2.config.escalationPolicy);
        expect(result1.config.textbookDisabled).toBe(result2.config.textbookDisabled);
        expect(result1.config.adaptiveLadderDisabled).toBe(result2.config.adaptiveLadderDisabled);
      });

      it('should handle backend session with missing conditionId', async () => {
        const invalidBackendSession = {
          sessionId: 'session-123',
          // Missing conditionId
          escalationPolicy: 'adaptive' as const,
        };
        
        vi.mocked(storageClient.getSession).mockResolvedValue(invalidBackendSession);
        
        const result = await loadSessionConfigAsync('learner-ghi');
        
        expect(result.isNewAssignment).toBe(true);
        expect(result.source).toBe('assigned');
      });

      it('should handle backend session with invalid escalationPolicy', async () => {
        const invalidBackendSession = {
          sessionId: 'session-123',
          conditionId: 'aggressive',
          escalationPolicy: 'invalid-policy',
        } as const;
        
        vi.mocked(storageClient.getSession).mockResolvedValue(invalidBackendSession as unknown as Awaited<ReturnType<typeof storageClient.getSession>>);
        
        const result = await loadSessionConfigAsync('learner-jkl');
        
        expect(result.isNewAssignment).toBe(true);
        expect(result.source).toBe('assigned');
      });

      it('should save assigned config to sessionStorage', async () => {
        vi.mocked(storageClient.getSession).mockResolvedValue(null);
        
        await loadSessionConfigAsync('learner-mno');
        
        // Should have saved to sessionStorage
        const saved = sessionStorage.getItem(SESSION_CONFIG_STORAGE_KEY);
        expect(saved).not.toBeNull();
        
        const parsed = JSON.parse(saved!);
        expect(parsed.learnerId).toBe('learner-mno');
      });

      it('should emit telemetry event on storage failure', async () => {
        const telemetryEvents: Array<{ detail: unknown }> = [];
        window.addEventListener('session_config_storage_failure', (e) => {
          telemetryEvents.push({ detail: (e as CustomEvent).detail });
        });
        
        // Mock sessionStorage to fail
        const originalSetItem = sessionStorage.setItem;
        sessionStorage.setItem = vi.fn(() => {
          throw new DOMException('Quota exceeded', 'QuotaExceededError');
        });
        
        vi.mocked(storageClient.getSession).mockResolvedValue(null);
        
        // Should not throw
        await loadSessionConfigAsync('learner-pqr');
        
        // Restore before assertions
        sessionStorage.setItem = originalSetItem;
      });
    });
  });
});
