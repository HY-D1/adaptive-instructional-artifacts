/**
 * Unit tests for HDI Debug utilities
 * 
 * @module hdi-debug.test
 */

import { describe, it, expect } from 'vitest';
import {
  calculateHDIData,
  filterOutHDIEvents,
  formatHDIScore,
  formatHDIDetailed,
  isHDIEvent,
  createMockHDIEvent,
  createMockHDITrajectory,
  HDI_EVENT_TYPES,
} from './hdi-debug';
import type { InteractionEvent } from '../types';

describe('HDI Debug Utilities', () => {
  const mockLearnerId = 'test-learner-123';
  const otherLearnerId = 'other-learner-456';

  // =============================================================================
  // calculateHDIData
  // =============================================================================
  describe('calculateHDIData', () => {
    it('should return null score and 0 events when no interactions exist', () => {
      const result = calculateHDIData([], mockLearnerId);
      expect(result.score).toBeNull();
      expect(result.eventCount).toBe(0);
      expect(result.events).toEqual([]);
    });

    it('should calculate HDI score from hdi_calculated event', () => {
      const interactions: InteractionEvent[] = [
        {
          id: 'event-1',
          learnerId: mockLearnerId,
          timestamp: Date.now(),
          eventType: 'hdi_calculated',
          problemId: 'problem-1',
          hdi: 0.75,
        } as InteractionEvent,
      ];

      const result = calculateHDIData(interactions, mockLearnerId);
      expect(result.score).toBe(0.75);
      expect(result.eventCount).toBe(1);
    });

    it('should use latest HDI score when multiple events exist', () => {
      const now = Date.now();
      const interactions: InteractionEvent[] = [
        {
          id: 'event-1',
          learnerId: mockLearnerId,
          timestamp: now - 2000,
          eventType: 'hdi_calculated',
          problemId: 'problem-1',
          hdi: 0.50,
        } as InteractionEvent,
        {
          id: 'event-2',
          learnerId: mockLearnerId,
          timestamp: now - 1000,
          eventType: 'hdi_trajectory_updated',
          problemId: 'problem-2',
          hdi: 0.65,
        } as InteractionEvent,
        {
          id: 'event-3',
          learnerId: mockLearnerId,
          timestamp: now,
          eventType: 'hdi_calculated',
          problemId: 'problem-3',
          hdi: 0.80,
        } as InteractionEvent,
      ];

      const result = calculateHDIData(interactions, mockLearnerId);
      expect(result.score).toBe(0.80);
      expect(result.eventCount).toBe(3);
    });

    it('should ignore events without hdi property', () => {
      const interactions: InteractionEvent[] = [
        {
          id: 'event-1',
          learnerId: mockLearnerId,
          timestamp: Date.now(),
          eventType: 'hdi_trajectory_updated',
          problemId: 'problem-1',
          // No hdi property
        } as InteractionEvent,
      ];

      const result = calculateHDIData(interactions, mockLearnerId);
      expect(result.score).toBeNull();
      expect(result.eventCount).toBe(1); // Still counts as HDI event
    });

    it('should ignore events from other learners', () => {
      const interactions: InteractionEvent[] = [
        {
          id: 'event-1',
          learnerId: otherLearnerId,
          timestamp: Date.now(),
          eventType: 'hdi_calculated',
          problemId: 'problem-1',
          hdi: 0.90,
        } as InteractionEvent,
      ];

      const result = calculateHDIData(interactions, mockLearnerId);
      expect(result.score).toBeNull();
      expect(result.eventCount).toBe(0);
    });

    it('should handle dependency_intervention_triggered events', () => {
      const interactions: InteractionEvent[] = [
        {
          id: 'event-1',
          learnerId: mockLearnerId,
          timestamp: Date.now(),
          eventType: 'dependency_intervention_triggered',
          problemId: 'problem-1',
          hdi: 0.70,
        } as InteractionEvent,
      ];

      const result = calculateHDIData(interactions, mockLearnerId);
      expect(result.score).toBe(0.70);
      expect(result.eventCount).toBe(1);
    });
  });

  // =============================================================================
  // filterOutHDIEvents
  // =============================================================================
  describe('filterOutHDIEvents', () => {
    it('should remove all HDI events for specified learner', () => {
      const interactions: InteractionEvent[] = [
        {
          id: 'event-1',
          learnerId: mockLearnerId,
          timestamp: Date.now(),
          eventType: 'hdi_calculated',
          problemId: 'problem-1',
          hdi: 0.75,
        } as InteractionEvent,
        {
          id: 'event-2',
          learnerId: mockLearnerId,
          timestamp: Date.now(),
          eventType: 'hdi_trajectory_updated',
          problemId: 'problem-2',
          hdi: 0.80,
        } as InteractionEvent,
        {
          id: 'event-3',
          learnerId: mockLearnerId,
          timestamp: Date.now(),
          eventType: 'hint_view',
          problemId: 'problem-3',
        } as InteractionEvent,
      ];

      const result = filterOutHDIEvents(interactions, mockLearnerId);
      expect(result.length).toBe(1);
      expect(result[0].eventType).toBe('hint_view');
    });

    it('should preserve HDI events for other learners', () => {
      const interactions: InteractionEvent[] = [
        {
          id: 'event-1',
          learnerId: mockLearnerId,
          timestamp: Date.now(),
          eventType: 'hdi_calculated',
          problemId: 'problem-1',
          hdi: 0.75,
        } as InteractionEvent,
        {
          id: 'event-2',
          learnerId: otherLearnerId,
          timestamp: Date.now(),
          eventType: 'hdi_calculated',
          problemId: 'problem-2',
          hdi: 0.90,
        } as InteractionEvent,
      ];

      const result = filterOutHDIEvents(interactions, mockLearnerId);
      expect(result.length).toBe(1);
      expect(result[0].learnerId).toBe(otherLearnerId);
    });

    it('should preserve non-HDI events for the learner', () => {
      const interactions: InteractionEvent[] = [
        {
          id: 'event-1',
          learnerId: mockLearnerId,
          timestamp: Date.now(),
          eventType: 'hint_view',
          problemId: 'problem-1',
        } as InteractionEvent,
        {
          id: 'event-2',
          learnerId: mockLearnerId,
          timestamp: Date.now(),
          eventType: 'execution',
          problemId: 'problem-2',
        } as InteractionEvent,
      ];

      const result = filterOutHDIEvents(interactions, mockLearnerId);
      expect(result.length).toBe(2);
    });
  });

  // =============================================================================
  // formatHDIScore
  // =============================================================================
  describe('formatHDIScore', () => {
    it('should format score as percentage', () => {
      expect(formatHDIScore(0.75)).toBe('75%');
      expect(formatHDIScore(0.5)).toBe('50%');
      expect(formatHDIScore(1)).toBe('100%');
      expect(formatHDIScore(0)).toBe('0%');
    });

    it('should return N/A for null', () => {
      expect(formatHDIScore(null)).toBe('N/A');
    });

    it('should return N/A for undefined', () => {
      expect(formatHDIScore(undefined as unknown as null)).toBe('N/A');
    });
  });

  // =============================================================================
  // formatHDIDetailed
  // =============================================================================
  describe('formatHDIDetailed', () => {
    it('should format score with 3 decimal places', () => {
      expect(formatHDIDetailed(0.75)).toBe('0.750');
      expect(formatHDIDetailed(0.5)).toBe('0.500');
      expect(formatHDIDetailed(1)).toBe('1.000');
      expect(formatHDIDetailed(0)).toBe('0.000');
    });

    it('should return N/A for null', () => {
      expect(formatHDIDetailed(null)).toBe('N/A');
    });

    it('should return N/A for undefined', () => {
      expect(formatHDIDetailed(undefined as unknown as null)).toBe('N/A');
    });
  });

  // =============================================================================
  // isHDIEvent
  // =============================================================================
  describe('isHDIEvent', () => {
    it('should return true for hdi_calculated', () => {
      const event = { eventType: 'hdi_calculated' } as InteractionEvent;
      expect(isHDIEvent(event)).toBe(true);
    });

    it('should return true for hdi_trajectory_updated', () => {
      const event = { eventType: 'hdi_trajectory_updated' } as InteractionEvent;
      expect(isHDIEvent(event)).toBe(true);
    });

    it('should return true for dependency_intervention_triggered', () => {
      const event = { eventType: 'dependency_intervention_triggered' } as InteractionEvent;
      expect(isHDIEvent(event)).toBe(true);
    });

    it('should return false for other event types', () => {
      const event = { eventType: 'hint_view' } as InteractionEvent;
      expect(isHDIEvent(event)).toBe(false);
    });
  });

  // =============================================================================
  // createMockHDIEvent
  // =============================================================================
  describe('createMockHDIEvent', () => {
    it('should create a valid hdi_calculated event', () => {
      const event = createMockHDIEvent(mockLearnerId, 0.75);
      
      expect(event.learnerId).toBe(mockLearnerId);
      expect(event.hdi).toBe(0.75);
      expect(event.eventType).toBe('hdi_calculated');
      expect(event.id).toContain('mock-hdi');
      expect(event.problemId).toBe('mock-problem');
    });

    it('should use custom timestamp if provided', () => {
      const customTimestamp = 1234567890;
      const event = createMockHDIEvent(mockLearnerId, 0.75, customTimestamp);
      
      expect(event.timestamp).toBe(customTimestamp);
    });

    it('should set hdiLevel based on score', () => {
      const lowEvent = createMockHDIEvent(mockLearnerId, 0.2);
      expect(lowEvent.hdiLevel).toBe('low');

      const mediumEvent = createMockHDIEvent(mockLearnerId, 0.5);
      expect(mediumEvent.hdiLevel).toBe('medium');

      const highEvent = createMockHDIEvent(mockLearnerId, 0.8);
      expect(highEvent.hdiLevel).toBe('high');
    });
  });

  // =============================================================================
  // createMockHDITrajectory
  // =============================================================================
  describe('createMockHDITrajectory', () => {
    it('should create multiple events with increasing timestamps', () => {
      const scores = [0.5, 0.6, 0.7];
      const events = createMockHDITrajectory(mockLearnerId, scores);
      
      expect(events.length).toBe(3);
      expect(events[0].timestamp).toBeLessThan(events[1].timestamp);
      expect(events[1].timestamp).toBeLessThan(events[2].timestamp);
    });

    it('should set correct HDI values', () => {
      const scores = [0.5, 0.6, 0.7];
      const events = createMockHDITrajectory(mockLearnerId, scores);
      
      expect(events[0].hdi).toBe(0.5);
      expect(events[1].hdi).toBe(0.6);
      expect(events[2].hdi).toBe(0.7);
    });

    it('should set trend based on score changes', () => {
      const increasingScores = [0.5, 0.6];
      const increasingEvents = createMockHDITrajectory(mockLearnerId, increasingScores);
      expect(increasingEvents[1].trend).toBe('increasing');

      const decreasingScores = [0.6, 0.5];
      const decreasingEvents = createMockHDITrajectory(mockLearnerId, decreasingScores);
      expect(decreasingEvents[1].trend).toBe('decreasing');
    });

    it('should mark last event as hdi_trajectory_updated', () => {
      const scores = [0.5, 0.6, 0.7];
      const events = createMockHDITrajectory(mockLearnerId, scores);
      
      expect(events[0].eventType).toBe('hdi_calculated');
      expect(events[1].eventType).toBe('hdi_calculated');
      expect(events[2].eventType).toBe('hdi_trajectory_updated');
    });
  });

  // =============================================================================
  // HDI_EVENT_TYPES constant
  // =============================================================================
  describe('HDI_EVENT_TYPES', () => {
    it('should contain all HDI event types', () => {
      expect(HDI_EVENT_TYPES).toContain('hdi_calculated');
      expect(HDI_EVENT_TYPES).toContain('hdi_trajectory_updated');
      expect(HDI_EVENT_TYPES).toContain('dependency_intervention_triggered');
      expect(HDI_EVENT_TYPES.length).toBe(3);
    });
  });
});
