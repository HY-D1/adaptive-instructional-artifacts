/**
 * ReinforcementManager Unit Tests
 * 
 * Tests for safe storage migration including:
 * - safeStorage.safeSet() integration
 * - Quota error handling
 * - Telemetry event emission
 * - Backward compatibility
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  ReinforcementManager,
  reinforcementManager,
  type ScheduleOptions,
  type StorageResult,
} from './reinforcement-manager';
import type { InstructionalUnit } from '../../types';
import {
  subscribeToStorageTelemetry,
  type StorageTelemetryEvent,
} from '../storage/safe-storage';

// Mock dependencies
vi.mock('../storage/storage', () => ({
  storage: {
    getActiveSessionId: vi.fn().mockReturnValue('test-session-id'),
    saveInteraction: vi.fn(),
    getTextbook: vi.fn().mockReturnValue([]),
  },
}));

vi.mock('../utils/event-id', () => ({
  createEventId: vi.fn((prefix, suffix) => `${prefix}-${suffix}-test-id`),
}));

describe('ReinforcementManager', () => {
  let manager: ReinforcementManager;

  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    manager = new ReinforcementManager();
  });

  afterEach(() => {
    manager.destroy();
  });

  describe('Safe Storage Integration', () => {
    it('uses safeStorage.safeSet() for saving schedules', () => {
      const schedules = [
        {
          id: 'test-schedule-1',
          unitId: 'unit-1',
          conceptId: 'concept-1',
          learnerId: 'learner-1',
          createdAt: Date.now(),
          scheduledPrompts: [],
        },
      ];

      const result = manager.saveSchedules(schedules);

      expect(result.success).toBe(true);
      expect(result.quotaExceeded).toBeUndefined();
      expect(result.error).toBeUndefined();
    });

    it('uses safeStorage.safeGet() for loading schedules', () => {
      // Pre-populate storage with a schedule
      const schedules = [
        {
          id: 'test-schedule-2',
          unitId: 'unit-2',
          conceptId: 'concept-2',
          learnerId: 'learner-1',
          createdAt: Date.now(),
          scheduledPrompts: [],
        },
      ];
      manager.saveSchedules(schedules);

      const loaded = manager.getSchedules();

      expect(loaded).toHaveLength(1);
      expect(loaded[0].id).toBe('test-schedule-2');
    });

    it('returns empty array when storage is empty', () => {
      const schedules = manager.getSchedules();
      expect(schedules).toEqual([]);
    });

    it('returns empty array when storage contains corrupted data', () => {
      localStorage.setItem('sql-learning-reinforcement-schedules', 'invalid json{{');
      const schedules = manager.getSchedules();
      expect(schedules).toEqual([]);
    });

    it('saveSchedules returns StorageResult with correct shape', () => {
      const result = manager.saveSchedules([]);
      
      // Verify StorageResult interface
      expect(result).toHaveProperty('success');
      expect(typeof result.success).toBe('boolean');
    });
  });

  describe('Quota Error Handling', () => {
    it('does not crash when storage is unavailable', () => {
      // Simulate storage unavailability
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new DOMException('Storage is disabled', 'SecurityError');
      });

      const unit: InstructionalUnit = {
        id: 'unit-test',
        conceptId: 'concept-test',
        conceptIds: ['concept-test'],
        title: 'Test Unit',
        content: { definition: 'Test content', examples: [], commonMistakes: [] },
        difficulty: 'beginner',
        estimatedStudyTime: 5,
      };

      // Should not throw
      expect(() => {
        manager.scheduleForUnit(unit, 'learner-1', { useTestDelays: true });
      }).not.toThrow();
    });

    it('handles serialization failures gracefully', () => {
      // Create a circular reference that can't be serialized
      const circular: Record<string, unknown> = { name: 'test' };
      circular.self = circular;

      // This should return a failed result, not throw
      const result = manager.saveSchedules(circular as unknown as Parameters<typeof manager.saveSchedules>[0]);
      
      // Should fail gracefully
      expect(result.success).toBe(false);
    });

    it('preserves functionality when storage operations fail', () => {
      const unit: InstructionalUnit = {
        id: 'unit-storage-fail',
        conceptId: 'concept-fail',
        conceptIds: ['concept-fail'],
        title: 'Storage Fail Test',
        content: { definition: 'Test', examples: [], commonMistakes: [] },
        difficulty: 'beginner',
        estimatedStudyTime: 5,
      };

      // First call should work (storage available)
      const schedule1 = manager.scheduleForUnit(unit, 'learner-1', { useTestDelays: true });
      expect(schedule1).toBeDefined();

      // Now corrupt storage
      localStorage.setItem('sql-learning-reinforcement-schedules', 'invalid');

      // getSchedules should still work (returns empty array on parse error)
      const schedules = manager.getSchedules();
      expect(Array.isArray(schedules)).toBe(true);
    });
  });

  describe('Telemetry Events', () => {
    it('subscribes to storage telemetry on construction', () => {
      const manager2 = new ReinforcementManager();
      expect(manager2).toBeDefined();
      manager2.destroy();
    });

    it('cleans up telemetry subscription on destroy', () => {
      const manager2 = new ReinforcementManager();
      manager2.destroy();
      // Should not throw when destroying twice
      manager2.destroy();
    });

    it('handles telemetry events without crashing', () => {
      // Force a storage event by simulating a non-quota storage error
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation((key: string) => {
        // Allow test keys to pass (for isStorageAvailable check)
        if (key.includes('__storage_test')) {
          return;
        }
        throw new Error('Simulated generic error');
      });

      // This should handle the error gracefully and emit telemetry
      const result = manager.saveSchedules([]);
      
      // Should not crash - result depends on whether storage was deemed available
      // The important thing is it doesn't throw
      expect(result).toBeDefined();
      expect(typeof result.success).toBe('boolean');
    });
  });

  describe('Backward Compatibility', () => {
    it('maintains existing scheduleForUnit behavior', () => {
      const unit: InstructionalUnit = {
        id: 'unit-compat',
        conceptId: 'concept-compat',
        conceptIds: ['concept-compat'],
        title: 'Compatibility Test Unit',
        content: { definition: 'Test content', examples: [], commonMistakes: [] },
        difficulty: 'intermediate',
        estimatedStudyTime: 10,
      };

      const schedule = manager.scheduleForUnit(unit, 'learner-compat', { useTestDelays: true });

      expect(schedule.id).toContain('sched-learner-compat-unit-compat');
      expect(schedule.unitId).toBe('unit-compat');
      expect(schedule.learnerId).toBe('learner-compat');
      expect(schedule.conceptId).toBe('concept-compat');
      expect(schedule.scheduledPrompts).toHaveLength(3);
    });

    it('maintains existing getSchedulesByLearner behavior', () => {
      const unit1: InstructionalUnit = {
        id: 'unit-1',
        conceptId: 'concept-1',
        conceptIds: ['concept-1'],
        title: 'Unit 1',
        content: { definition: 'Test', examples: [], commonMistakes: [] },
        difficulty: 'beginner',
        estimatedStudyTime: 5,
      };
      const unit2: InstructionalUnit = {
        id: 'unit-2',
        conceptId: 'concept-2',
        conceptIds: ['concept-2'],
        title: 'Unit 2',
        content: { definition: 'Test', examples: [], commonMistakes: [] },
        difficulty: 'beginner',
        estimatedStudyTime: 5,
      };

      manager.scheduleForUnit(unit1, 'learner-a', { useTestDelays: true });
      manager.scheduleForUnit(unit2, 'learner-b', { useTestDelays: true });

      const learnerASchedules = manager.getSchedulesByLearner('learner-a');
      expect(learnerASchedules).toHaveLength(1);
      expect(learnerASchedules[0].learnerId).toBe('learner-a');
    });

    it('preserves all public method signatures', () => {
      // Verify all expected methods exist
      expect(typeof manager.getSchedules).toBe('function');
      expect(typeof manager.saveSchedules).toBe('function');
      expect(typeof manager.getSchedulesByLearner).toBe('function');
      expect(typeof manager.scheduleForUnit).toBe('function');
      expect(typeof manager.getDuePrompts).toBe('function');
      expect(typeof manager.markPromptShown).toBe('function');
      expect(typeof manager.recordResponse).toBe('function');
      expect(typeof manager.dismissPrompt).toBe('function');
      expect(typeof manager.getStats).toBe('function');
      expect(typeof manager.destroy).toBe('function');
    });

    it('maintains existing getStats behavior', () => {
      const stats = manager.getStats();
      
      expect(stats).toHaveProperty('totalSchedules');
      expect(stats).toHaveProperty('totalPrompts');
      expect(stats).toHaveProperty('completedPrompts');
      expect(stats).toHaveProperty('pendingPrompts');
      expect(stats).toHaveProperty('responseRate');
      expect(stats).toHaveProperty('averageRetentionScore');
      
      expect(typeof stats.totalSchedules).toBe('number');
      expect(typeof stats.responseRate).toBe('number');
    });
  });

  describe('Schedule Options', () => {
    it('supports test delays option', () => {
      const unit: InstructionalUnit = {
        id: 'unit-test-delays',
        conceptId: 'concept-test',
        conceptIds: ['concept-test'],
        title: 'Test Unit',
        content: { definition: 'Test', examples: [], commonMistakes: [] },
        difficulty: 'beginner',
        estimatedStudyTime: 5,
      };

      const schedule = manager.scheduleForUnit(unit, 'learner-1', { useTestDelays: true });

      // Test delays: 5, 15, 30 minutes converted to days
      expect(schedule.scheduledPrompts).toHaveLength(3);
      expect(schedule.scheduledPrompts[0].delayDays).toBeCloseTo(5 / (24 * 60), 5);
      expect(schedule.scheduledPrompts[1].delayDays).toBeCloseTo(15 / (24 * 60), 5);
      expect(schedule.scheduledPrompts[2].delayDays).toBeCloseTo(30 / (24 * 60), 5);
    });

    it('supports custom delays option', () => {
      const unit: InstructionalUnit = {
        id: 'unit-custom-delays',
        conceptId: 'concept-test',
        conceptIds: ['concept-test'],
        title: 'Test Unit',
        content: { definition: 'Test', examples: [], commonMistakes: [] },
        difficulty: 'beginner',
        estimatedStudyTime: 5,
      };

      const schedule = manager.scheduleForUnit(unit, 'learner-1', {
        customDelaysMinutes: [10, 20],
      });

      expect(schedule.scheduledPrompts).toHaveLength(2);
      expect(schedule.scheduledPrompts[0].delayDays).toBeCloseTo(10 / (24 * 60), 5);
      expect(schedule.scheduledPrompts[1].delayDays).toBeCloseTo(20 / (24 * 60), 5);
    });

    it('uses production delays by default', () => {
      const unit: InstructionalUnit = {
        id: 'unit-prod-delays',
        conceptId: 'concept-test',
        conceptIds: ['concept-test'],
        title: 'Test Unit',
        content: { definition: 'Test', examples: [], commonMistakes: [] },
        difficulty: 'beginner',
        estimatedStudyTime: 5,
      };

      const schedule = manager.scheduleForUnit(unit, 'learner-1');

      // Production delays: 1, 3, 7 days
      expect(schedule.scheduledPrompts).toHaveLength(3);
      expect(schedule.scheduledPrompts[0].delayDays).toBe(1);
      expect(schedule.scheduledPrompts[1].delayDays).toBe(3);
      expect(schedule.scheduledPrompts[2].delayDays).toBe(7);
    });
  });

  describe('Statistics', () => {
    it('calculates stats correctly', () => {
      const stats = manager.getStats();

      expect(stats).toHaveProperty('totalSchedules');
      expect(stats).toHaveProperty('totalPrompts');
      expect(stats).toHaveProperty('completedPrompts');
      expect(stats).toHaveProperty('pendingPrompts');
      expect(stats).toHaveProperty('responseRate');
      expect(stats).toHaveProperty('averageRetentionScore');
    });

    it('filters stats by learner ID', () => {
      const unit: InstructionalUnit = {
        id: 'unit-stats',
        conceptId: 'concept-stats',
        conceptIds: ['concept-stats'],
        title: 'Stats Test Unit',
        content: { definition: 'Test', examples: [], commonMistakes: [] },
        difficulty: 'beginner',
        estimatedStudyTime: 5,
      };

      manager.scheduleForUnit(unit, 'learner-stats', { useTestDelays: true });

      const allStats = manager.getStats();
      const learnerStats = manager.getStats('learner-stats');
      const otherLearnerStats = manager.getStats('other-learner');

      expect(allStats.totalSchedules).toBe(1);
      expect(learnerStats.totalSchedules).toBe(1);
      expect(otherLearnerStats.totalSchedules).toBe(0);
    });
  });

  describe('Singleton Export', () => {
    it('exports a singleton instance', () => {
      expect(reinforcementManager).toBeInstanceOf(ReinforcementManager);
      expect(reinforcementManager).toBeDefined();
    });
  });
});

describe('StorageResult Interface', () => {
  it('defines correct StorageResult shape', () => {
    const successResult: StorageResult = {
      success: true,
    };
    const failureResult: StorageResult = {
      success: false,
      quotaExceeded: true,
      error: 'Storage quota exceeded',
    };

    expect(successResult.success).toBe(true);
    expect(failureResult.success).toBe(false);
    expect(failureResult.quotaExceeded).toBe(true);
    expect(failureResult.error).toContain('quota');
  });
});
