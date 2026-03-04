/**
 * Unit Tests for Reinforcement Scheduler
 * 
 * Tests all functionality of the spaced repetition scheduling system
 * including schedule creation, prompt lifecycle, and content generation.
 */

import { describe, it, expect } from 'vitest';
import type { InstructionalUnit } from '../types';
import type { PromptType } from './reinforcement-scheduler';

import {
  REINFORCEMENT_SCHEDULER_VERSION,
  SPACED_REPETITION_DELAYS,
  scheduleReinforcement,
  getDuePrompts,
  markPromptShown,
  markPromptCompleted,
  markPromptDismissed,
  generatePromptContent,
  getScheduleStats,
  getSchedulesByLearner,
  getSchedulesByUnit,
  hasDuePrompts,
  getNextDuePrompt,
} from './reinforcement-scheduler';

// Test helper to create mock units
function createMockUnit(partial: Partial<InstructionalUnit> = {}): InstructionalUnit {
  return {
    id: `unit-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
    conceptId: 'test-concept',
    conceptIds: ['test-concept'],
    type: 'summary',
    title: 'Test Unit',
    content: 'This is a test unit about WHERE clauses.',
    prerequisites: [],
    addedTimestamp: Date.now(),
    sourceInteractionIds: ['evt-1'],
    ...partial,
  };
}

describe('Reinforcement Scheduler', () => {
  describe('scheduleReinforcement', () => {
    it('creates a schedule with 3 default prompts', () => {
      const unit = createMockUnit();
      const schedule = scheduleReinforcement(unit, 'learner-1');

      expect(schedule.unitId).toBe(unit.id);
      expect(schedule.learnerId).toBe('learner-1');
      expect(schedule.conceptId).toBe(unit.conceptId);
      expect(schedule.scheduledPrompts).toHaveLength(3);
    });

    it('uses correct default delays [1, 3, 7]', () => {
      const unit = createMockUnit();
      const baseTime = Date.now();
      const schedule = scheduleReinforcement(unit, 'learner-1', { baseTime });

      expect(schedule.scheduledPrompts[0].delayDays).toBe(1);
      expect(schedule.scheduledPrompts[1].delayDays).toBe(3);
      expect(schedule.scheduledPrompts[2].delayDays).toBe(7);
    });

    it('cycles through prompt types by default', () => {
      const unit = createMockUnit();
      const schedule = scheduleReinforcement(unit, 'learner-1');

      expect(schedule.scheduledPrompts[0].promptType).toBe('mcq');
      expect(schedule.scheduledPrompts[1].promptType).toBe('sql_completion');
      expect(schedule.scheduledPrompts[2].promptType).toBe('concept_explanation');
    });

    it('sets all prompts to pending status initially', () => {
      const unit = createMockUnit();
      const schedule = scheduleReinforcement(unit, 'learner-1');

      schedule.scheduledPrompts.forEach(prompt => {
        expect(prompt.status).toBe('pending');
      });
    });

    it('calculates correct scheduled times', () => {
      const unit = createMockUnit();
      const baseTime = 1000000000000; // Fixed timestamp
      const schedule = scheduleReinforcement(unit, 'learner-1', { baseTime });

      const oneDayMs = 24 * 60 * 60 * 1000;
      expect(schedule.scheduledPrompts[0].scheduledTime).toBe(baseTime + 1 * oneDayMs);
      expect(schedule.scheduledPrompts[1].scheduledTime).toBe(baseTime + 3 * oneDayMs);
      expect(schedule.scheduledPrompts[2].scheduledTime).toBe(baseTime + 7 * oneDayMs);
    });

    it('accepts custom delays', () => {
      const unit = createMockUnit();
      const customDelays = [2, 5, 10];
      const schedule = scheduleReinforcement(unit, 'learner-1', { delays: customDelays });

      expect(schedule.scheduledPrompts).toHaveLength(3);
      expect(schedule.scheduledPrompts[0].delayDays).toBe(2);
      expect(schedule.scheduledPrompts[1].delayDays).toBe(5);
      expect(schedule.scheduledPrompts[2].delayDays).toBe(10);
    });

    it('accepts custom prompt types', () => {
      const unit = createMockUnit();
      const customTypes: PromptType[] = ['mcq', 'mcq', 'mcq'];
      const schedule = scheduleReinforcement(unit, 'learner-1', { promptTypes: customTypes });

      schedule.scheduledPrompts.forEach(prompt => {
        expect(prompt.promptType).toBe('mcq');
      });
    });

    it('generates unique IDs for schedule and prompts', () => {
      const unit = createMockUnit();
      const schedule = scheduleReinforcement(unit, 'learner-1');

      expect(schedule.id).toBeDefined();
      expect(schedule.id.length).toBeGreaterThan(0);
      
      const promptIds = schedule.scheduledPrompts.map(p => p.id);
      const uniqueIds = new Set(promptIds);
      expect(uniqueIds.size).toBe(promptIds.length);
    });
  });

  describe('getDuePrompts', () => {
    it('returns empty array when no schedules', () => {
      const due = getDuePrompts([], Date.now());
      expect(due).toEqual([]);
    });

    it('returns empty array when no prompts are due', () => {
      const unit = createMockUnit();
      const baseTime = Date.now();
      const schedule = scheduleReinforcement(unit, 'learner-1', { baseTime });
      
      // Check before any prompts are due
      const due = getDuePrompts([schedule], baseTime);
      expect(due).toEqual([]);
    });

    it('returns due prompts when scheduled time has passed', () => {
      const unit = createMockUnit();
      const baseTime = Date.now() - 2 * 24 * 60 * 60 * 1000; // 2 days ago
      const schedule = scheduleReinforcement(unit, 'learner-1', { baseTime });
      
      const currentTime = Date.now();
      const due = getDuePrompts([schedule], currentTime);
      
      // First prompt (1 day) should be due
      expect(due.length).toBeGreaterThanOrEqual(1);
      expect(due[0].prompt.delayDays).toBe(1);
    });

    it('only returns pending prompts', () => {
      const unit = createMockUnit();
      const baseTime = Date.now() - 10 * 24 * 60 * 60 * 1000; // 10 days ago
      let schedule = scheduleReinforcement(unit, 'learner-1', { baseTime });
      
      // Mark first prompt as completed
      schedule = markPromptCompleted(schedule, schedule.scheduledPrompts[0].id);
      
      const currentTime = Date.now();
      const due = getDuePrompts([schedule], currentTime);
      
      // Should not include the completed prompt
      const completedId = schedule.scheduledPrompts[0].id;
      expect(due.every(d => d.prompt.id !== completedId)).toBe(true);
    });

    it('sorts by scheduled time', () => {
      const unit = createMockUnit();
      const baseTime = Date.now() - 10 * 24 * 60 * 60 * 1000; // 10 days ago
      const schedule = scheduleReinforcement(unit, 'learner-1', { baseTime });
      
      const currentTime = Date.now();
      const due = getDuePrompts([schedule], currentTime);
      
      for (let i = 1; i < due.length; i++) {
        expect(due[i].prompt.scheduledTime).toBeGreaterThanOrEqual(due[i - 1].prompt.scheduledTime);
      }
    });

    it('returns prompts from multiple schedules', () => {
      const unit1 = createMockUnit({ id: 'unit-1', conceptId: 'concept-1' });
      const unit2 = createMockUnit({ id: 'unit-2', conceptId: 'concept-2' });
      const baseTime = Date.now() - 2 * 24 * 60 * 60 * 1000; // 2 days ago
      
      const schedule1 = scheduleReinforcement(unit1, 'learner-1', { baseTime });
      const schedule2 = scheduleReinforcement(unit2, 'learner-1', { baseTime });
      
      const currentTime = Date.now();
      const due = getDuePrompts([schedule1, schedule2], currentTime);
      
      expect(due.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('markPromptShown', () => {
    it('updates prompt status to shown', () => {
      const unit = createMockUnit();
      const schedule = scheduleReinforcement(unit, 'learner-1');
      const promptId = schedule.scheduledPrompts[0].id;
      
      const updated = markPromptShown(schedule, promptId);
      
      const prompt = updated.scheduledPrompts.find(p => p.id === promptId);
      expect(prompt?.status).toBe('shown');
      expect(prompt?.shownTime).toBeDefined();
    });

    it('throws error for invalid prompt ID', () => {
      const unit = createMockUnit();
      const schedule = scheduleReinforcement(unit, 'learner-1');
      
      expect(() => markPromptShown(schedule, 'invalid-id')).toThrow('not found');
    });

    it('does not mutate original schedule', () => {
      const unit = createMockUnit();
      const schedule = scheduleReinforcement(unit, 'learner-1');
      const promptId = schedule.scheduledPrompts[0].id;
      const originalStatus = schedule.scheduledPrompts[0].status;
      
      markPromptShown(schedule, promptId);
      
      expect(schedule.scheduledPrompts[0].status).toBe(originalStatus);
    });
  });

  describe('markPromptCompleted', () => {
    it('updates prompt status to completed', () => {
      const unit = createMockUnit();
      const schedule = scheduleReinforcement(unit, 'learner-1');
      const promptId = schedule.scheduledPrompts[0].id;
      
      const updated = markPromptCompleted(schedule, promptId);
      
      const prompt = updated.scheduledPrompts.find(p => p.id === promptId);
      expect(prompt?.status).toBe('completed');
      expect(prompt?.completedTime).toBeDefined();
    });

    it('stores response data when provided', () => {
      const unit = createMockUnit();
      const schedule = scheduleReinforcement(unit, 'learner-1');
      const promptId = schedule.scheduledPrompts[0].id;
      
      const response = {
        correct: true,
        timeSpentMs: 5000,
        content: 'Test response',
      };
      
      const updated = markPromptCompleted(schedule, promptId, response);
      
      const prompt = updated.scheduledPrompts.find(p => p.id === promptId);
      expect(prompt?.response).toEqual(response);
    });

    it('throws error for invalid prompt ID', () => {
      const unit = createMockUnit();
      const schedule = scheduleReinforcement(unit, 'learner-1');
      
      expect(() => markPromptCompleted(schedule, 'invalid-id')).toThrow('not found');
    });
  });

  describe('markPromptDismissed', () => {
    it('updates prompt status to dismissed', () => {
      const unit = createMockUnit();
      const schedule = scheduleReinforcement(unit, 'learner-1');
      const promptId = schedule.scheduledPrompts[0].id;
      
      const updated = markPromptDismissed(schedule, promptId);
      
      const prompt = updated.scheduledPrompts.find(p => p.id === promptId);
      expect(prompt?.status).toBe('dismissed');
      expect(prompt?.completedTime).toBeDefined();
    });

    it('throws error for invalid prompt ID', () => {
      const unit = createMockUnit();
      const schedule = scheduleReinforcement(unit, 'learner-1');
      
      expect(() => markPromptDismissed(schedule, 'invalid-id')).toThrow('not found');
    });
  });

  describe('generatePromptContent', () => {
    it('generates MCQ content', () => {
      const unit = createMockUnit({
        title: 'WHERE Clause',
        content: 'The WHERE clause filters rows. Example: ```sql\nSELECT * FROM users WHERE age > 18;\n```',
        summary: 'WHERE filters data based on conditions',
      });
      
      const content = generatePromptContent(unit, 'mcq');
      
      expect(content.title).toContain('WHERE Clause');
      expect(content.question).toBeDefined();
      expect(content.options).toBeDefined();
      expect(content.options?.length).toBe(4);
      expect(content.correctAnswer).toBeDefined();
      expect(content.explanation).toBeDefined();
      expect(content.sourceUnitId).toBe(unit.id);
      expect(content.conceptIds).toEqual(unit.conceptIds);
    });

    it('generates SQL completion content', () => {
      const unit = createMockUnit({
        title: 'SELECT Statement',
        minimalExample: 'SELECT name FROM users WHERE age > 18;',
      });
      
      const content = generatePromptContent(unit, 'sql_completion');
      
      expect(content.title).toContain('Complete the Query');
      expect(content.question).toContain('filling in the blanks');
      expect(content.partialQuery).toContain('___');
      expect(content.correctAnswer).toBeDefined();
      expect(content.explanation).toContain('complete query');
    });

    it('generates concept explanation content', () => {
      const unit = createMockUnit({
        title: 'JOIN Operations',
        content: 'JOINs combine data from multiple tables.',
      });
      
      const content = generatePromptContent(unit, 'concept_explanation');
      
      expect(content.title).toContain('Explain: JOIN Operations');
      expect(content.question).toContain('in your own words');
      expect(content.question).toContain('What it does');
      expect(content.question).toContain('When to use it');
      expect(content.correctAnswer).toBeDefined();
    });

    it('throws for invalid prompt type', () => {
      const unit = createMockUnit();
      
      // @ts-expect-error Testing invalid type
      expect(() => generatePromptContent(unit, 'invalid')).toThrow('Unknown prompt type');
    });
  });

  describe('getScheduleStats', () => {
    it('returns correct stats for new schedule', () => {
      const unit = createMockUnit();
      const schedule = scheduleReinforcement(unit, 'learner-1');
      
      const stats = getScheduleStats(schedule);
      
      expect(stats.total).toBe(3);
      expect(stats.completed).toBe(0);
      expect(stats.pending).toBe(3);
      expect(stats.shown).toBe(0);
      expect(stats.dismissed).toBe(0);
      expect(stats.completionRate).toBe(0);
      expect(stats.isComplete).toBe(false);
    });

    it('calculates completion rate correctly', () => {
      const unit = createMockUnit();
      let schedule = scheduleReinforcement(unit, 'learner-1');
      
      // Complete 2 out of 3
      schedule = markPromptCompleted(schedule, schedule.scheduledPrompts[0].id);
      schedule = markPromptCompleted(schedule, schedule.scheduledPrompts[1].id);
      
      const stats = getScheduleStats(schedule);
      
      expect(stats.completed).toBe(2);
      expect(stats.completionRate).toBe(2 / 3);
      expect(stats.isComplete).toBe(false);
    });

    it('recognizes complete schedule', () => {
      const unit = createMockUnit();
      let schedule = scheduleReinforcement(unit, 'learner-1');
      
      // Complete all prompts
      schedule = markPromptCompleted(schedule, schedule.scheduledPrompts[0].id);
      schedule = markPromptCompleted(schedule, schedule.scheduledPrompts[1].id);
      schedule = markPromptCompleted(schedule, schedule.scheduledPrompts[2].id);
      
      const stats = getScheduleStats(schedule);
      
      expect(stats.completed).toBe(3);
      expect(stats.completionRate).toBe(1);
      expect(stats.isComplete).toBe(true);
    });

    it('counts dismissed prompts', () => {
      const unit = createMockUnit();
      let schedule = scheduleReinforcement(unit, 'learner-1');
      
      schedule = markPromptDismissed(schedule, schedule.scheduledPrompts[0].id);
      
      const stats = getScheduleStats(schedule);
      
      expect(stats.dismissed).toBe(1);
      expect(stats.pending).toBe(2);
    });
  });

  describe('getSchedulesByLearner', () => {
    it('filters schedules by learner ID', () => {
      const unit = createMockUnit();
      const schedule1 = scheduleReinforcement(unit, 'learner-1');
      const schedule2 = scheduleReinforcement(unit, 'learner-2');
      
      const learner1Schedules = getSchedulesByLearner([schedule1, schedule2], 'learner-1');
      
      expect(learner1Schedules).toHaveLength(1);
      expect(learner1Schedules[0].learnerId).toBe('learner-1');
    });

    it('returns empty array when no matches', () => {
      const unit = createMockUnit();
      const schedule = scheduleReinforcement(unit, 'learner-1');
      
      const result = getSchedulesByLearner([schedule], 'nonexistent');
      
      expect(result).toEqual([]);
    });
  });

  describe('getSchedulesByUnit', () => {
    it('filters schedules by unit ID', () => {
      const unit1 = createMockUnit({ id: 'unit-1' });
      const unit2 = createMockUnit({ id: 'unit-2' });
      const schedule1 = scheduleReinforcement(unit1, 'learner-1');
      const schedule2 = scheduleReinforcement(unit2, 'learner-1');
      
      const unit1Schedules = getSchedulesByUnit([schedule1, schedule2], 'unit-1');
      
      expect(unit1Schedules).toHaveLength(1);
      expect(unit1Schedules[0].unitId).toBe('unit-1');
    });
  });

  describe('hasDuePrompts', () => {
    it('returns true when prompts are due', () => {
      const unit = createMockUnit();
      const baseTime = Date.now() - 2 * 24 * 60 * 60 * 1000; // 2 days ago
      const schedule = scheduleReinforcement(unit, 'learner-1', { baseTime });
      
      expect(hasDuePrompts(schedule, Date.now())).toBe(true);
    });

    it('returns false when no prompts are due', () => {
      const unit = createMockUnit();
      const schedule = scheduleReinforcement(unit, 'learner-1');
      
      expect(hasDuePrompts(schedule, Date.now())).toBe(false);
    });

    it('returns false when all prompts completed', () => {
      const unit = createMockUnit();
      const baseTime = Date.now() - 10 * 24 * 60 * 60 * 1000; // 10 days ago
      let schedule = scheduleReinforcement(unit, 'learner-1', { baseTime });
      
      // Complete all prompts
      schedule = markPromptCompleted(schedule, schedule.scheduledPrompts[0].id);
      schedule = markPromptCompleted(schedule, schedule.scheduledPrompts[1].id);
      schedule = markPromptCompleted(schedule, schedule.scheduledPrompts[2].id);
      
      expect(hasDuePrompts(schedule, Date.now())).toBe(false);
    });
  });

  describe('getNextDuePrompt', () => {
    it('returns next due prompt for learner', () => {
      const unit = createMockUnit();
      const baseTime = Date.now() - 2 * 24 * 60 * 60 * 1000; // 2 days ago
      const schedule = scheduleReinforcement(unit, 'learner-1', { baseTime });
      
      const next = getNextDuePrompt([schedule], 'learner-1', Date.now());
      
      expect(next).toBeDefined();
      expect(next?.prompt.delayDays).toBe(1);
    });

    it('returns undefined when no due prompts', () => {
      const unit = createMockUnit();
      const schedule = scheduleReinforcement(unit, 'learner-1');
      
      const next = getNextDuePrompt([schedule], 'learner-1', Date.now());
      
      expect(next).toBeUndefined();
    });

    it('returns undefined for different learner', () => {
      const unit = createMockUnit();
      const baseTime = Date.now() - 2 * 24 * 60 * 60 * 1000; // 2 days ago
      const schedule = scheduleReinforcement(unit, 'learner-1', { baseTime });
      
      const next = getNextDuePrompt([schedule], 'learner-2', Date.now());
      
      expect(next).toBeUndefined();
    });
  });

  describe('Constants', () => {
    it('exports correct version', () => {
      expect(REINFORCEMENT_SCHEDULER_VERSION).toBe('reinforcement-scheduler-v1');
    });

    it('exports correct delays', () => {
      expect(SPACED_REPETITION_DELAYS).toEqual([1, 3, 7]);
    });
  });

  describe('Edge Cases', () => {
    it('handles empty unit content gracefully', () => {
      const unit = createMockUnit({ content: '', summary: undefined, minimalExample: undefined });
      
      // Should not throw
      expect(() => generatePromptContent(unit, 'mcq')).not.toThrow();
      expect(() => generatePromptContent(unit, 'sql_completion')).not.toThrow();
      expect(() => generatePromptContent(unit, 'concept_explanation')).not.toThrow();
    });

    it('handles unit with only conceptIds array', () => {
      const unit = createMockUnit({ conceptId: 'main', conceptIds: ['main', 'related'] });
      const schedule = scheduleReinforcement(unit, 'learner-1');
      
      expect(schedule.conceptId).toBe('main');
      
      const content = generatePromptContent(unit, 'mcq');
      expect(content.conceptIds).toEqual(['main', 'related']);
    });

    it('handles missing conceptIds (fallback to conceptId)', () => {
      const unit = createMockUnit({ conceptIds: undefined });
      const content = generatePromptContent(unit, 'mcq');
      
      expect(content.conceptIds).toEqual([unit.conceptId]);
    });

    it('handles custom ID generator', () => {
      const unit = createMockUnit();
      const customId = 'custom-schedule-id';
      const schedule = scheduleReinforcement(unit, 'learner-1', {}, () => customId);
      
      expect(schedule.id).toBe(customId);
    });

    it('preserves schedule immutability through operations', () => {
      const unit = createMockUnit();
      const schedule = scheduleReinforcement(unit, 'learner-1');
      const promptId = schedule.scheduledPrompts[0].id;
      
      const shown = markPromptShown(schedule, promptId);
      const completed = markPromptCompleted(shown, promptId);
      
      // Original should be unchanged
      expect(schedule.scheduledPrompts[0].status).toBe('pending');
      expect(shown.scheduledPrompts[0].status).toBe('shown');
      expect(completed.scheduledPrompts[0].status).toBe('completed');
    });
  });
});
