import { describe, it, expect } from 'vitest';
import {
  computeMetrics,
  computePolicyMetrics,
  computeStatistics,
  getReplayMetricsVersion
} from './replay-metrics';
import type { InteractionEvent } from '../../types';

describe('@weekly Replay Metrics', () => {
  // Helper to create test events
  const createEvent = (overrides: Partial<InteractionEvent> = {}): InteractionEvent => ({
    id: `event-${Math.random().toString(36).substr(2, 9)}`,
    learnerId: 'learner-123',
    timestamp: Date.now(),
    eventType: 'execution',
    problemId: 'problem-1',
    ...overrides
  });

  describe('computeMetrics', () => {
    it('should return empty metrics for empty trace', () => {
      const metrics = computeMetrics([]);
      
      expect(metrics.conceptCoverageRate).toBe(0);
      expect(metrics.hintDependencyIndex).toBe(0);
      expect(metrics.totalProblems).toBe(0);
    });

    it('should calculate basic counts correctly', () => {
      const trace: InteractionEvent[] = [
        createEvent({ eventType: 'error', timestamp: 1000 }),
        createEvent({ eventType: 'hint_view', hintLevel: 1, timestamp: 2000 }),
        createEvent({ eventType: 'execution', successful: true, timestamp: 3000 })
      ];
      
      const metrics = computeMetrics(trace);
      
      expect(metrics.totalErrors).toBe(1);
      expect(metrics.totalHintsViewed).toBe(1);
      expect(metrics.problemsSolved).toBe(1);
    });

    it('should calculate concept coverage', () => {
      const trace: InteractionEvent[] = [
        createEvent({ eventType: 'error', conceptIds: ['concept-a', 'concept-b'], timestamp: 1000 }),
        createEvent({ eventType: 'execution', successful: true, conceptIds: ['concept-a'], timestamp: 2000 })
      ];
      
      const metrics = computeMetrics(trace);
      
      expect(metrics.conceptsEncountered).toContain('concept-a');
      expect(metrics.conceptsEncountered).toContain('concept-b');
      expect(metrics.conceptsMastered).toContain('concept-a');
      expect(metrics.conceptsMastered).not.toContain('concept-b');
      expect(metrics.conceptCoverageRate).toBe(0.5);
    });

    it('should calculate explanation request rate', () => {
      const trace: InteractionEvent[] = [
        createEvent({ eventType: 'hint_view', timestamp: 1000 }),
        createEvent({ eventType: 'hint_view', timestamp: 2000 }),
        createEvent({ eventType: 'explanation_view', timestamp: 3000 })
      ];
      
      const metrics = computeMetrics(trace);
      
      expect(metrics.totalHelpRequests).toBe(3);
      expect(metrics.explanationRequestRate).toBe(1 / 3);
    });

    it('should calculate HDI components', () => {
      const trace: InteractionEvent[] = [
        createEvent({ eventType: 'execution', timestamp: 1000 }),
        createEvent({ eventType: 'hint_request', timestamp: 1500 }),
        createEvent({ eventType: 'hint_view', hintLevel: 1, timestamp: 2000 }),
        createEvent({ eventType: 'execution', successful: true, timestamp: 3000 })
      ];
      
      const metrics = computeMetrics(trace);
      
      expect(metrics.hintDependencyIndex).toBeGreaterThanOrEqual(0);
      expect(metrics.hintDependencyIndex).toBeLessThanOrEqual(1);
      expect(metrics.hdiComponents.hpa).toBeGreaterThan(0);
      expect(metrics.independentSuccessRate).toBe(0); // Used hint before success
    });

    it('should calculate average escalation depth', () => {
      const trace: InteractionEvent[] = [
        createEvent({ eventType: 'hint_view', hintLevel: 1, timestamp: 1000 }),
        createEvent({ eventType: 'hint_view', hintLevel: 2, timestamp: 2000 }),
        createEvent({ eventType: 'hint_view', hintLevel: 3, timestamp: 3000 })
      ];
      
      const metrics = computeMetrics(trace);
      
      // Average level = 2, normalized = (2-1)/2 = 0.5
      expect(metrics.averageEscalationDepth).toBe(0.5);
    });

    it('should calculate time metrics', () => {
      const trace: InteractionEvent[] = [
        createEvent({ eventType: 'error', timestamp: 1000 }),
        createEvent({ eventType: 'execution', successful: true, timestamp: 6000 })
      ];
      
      const metrics = computeMetrics(trace);
      
      expect(metrics.totalSessionTime).toBe(5000);
      expect(metrics.averageTimeToSuccess).toBe(5000);
      expect(metrics.timeToFirstSuccess).toBe(5000);
    });

    it('should calculate error reduction rate', () => {
      const trace: InteractionEvent[] = [
        createEvent({ eventType: 'error', timestamp: 1000 }),
        createEvent({ eventType: 'error', timestamp: 2000 }),
        createEvent({ eventType: 'error', timestamp: 3000 }),
        createEvent({ eventType: 'execution', successful: true, timestamp: 4000 })
      ];
      
      const metrics = computeMetrics(trace);
      
      // First half: 2 errors, second half: 1 error
      // Reduction = (2-1)/2 = 0.5
      expect(metrics.errorReductionRate).toBe(0.5);
    });

    it('should calculate retention estimate from reinforcements', () => {
      const trace: InteractionEvent[] = [
        createEvent({ eventType: 'reinforcement_response', isCorrect: true, timestamp: 1000 }),
        createEvent({ eventType: 'reinforcement_response', isCorrect: true, timestamp: 2000 }),
        createEvent({ eventType: 'reinforcement_response', isCorrect: false, timestamp: 3000 })
      ];
      
      const metrics = computeMetrics(trace);
      
      expect(metrics.retentionEstimate).toBe(2 / 3);
    });

    it('should default retention to 0.5 when no reinforcements', () => {
      const trace: InteractionEvent[] = [
        createEvent({ eventType: 'execution', timestamp: 1000 })
      ];
      
      const metrics = computeMetrics(trace);
      
      expect(metrics.retentionEstimate).toBe(0.5);
    });

    it('should calculate first attempt success rate', () => {
      const trace: InteractionEvent[] = [
        createEvent({ eventType: 'execution', successful: true, problemId: 'p1', timestamp: 1000 }),
        createEvent({ eventType: 'execution', successful: false, problemId: 'p2', timestamp: 2000 }),
        createEvent({ eventType: 'execution', successful: true, problemId: 'p2', timestamp: 3000 })
      ];
      
      const metrics = computeMetrics(trace);
      
      // p1: first execution was successful = first attempt success
      // p2: first execution was unsuccessful = not first attempt success
      expect(metrics.totalProblems).toBe(2);
      expect(metrics.firstAttemptSuccessRate).toBe(0.5);
    });

    it('should handle multiple problems', () => {
      const trace: InteractionEvent[] = [
        createEvent({ eventType: 'execution', problemId: 'p1', timestamp: 1000 }),
        createEvent({ eventType: 'execution', problemId: 'p2', timestamp: 2000 }),
        createEvent({ eventType: 'execution', problemId: 'p3', timestamp: 3000 })
      ];
      
      const metrics = computeMetrics(trace);
      
      expect(metrics.totalProblems).toBe(3);
      expect(metrics.interactionsPerProblem).toBe(1);
    });
  });

  describe('computePolicyMetrics', () => {
    it('should aggregate metrics across traces', () => {
      const traces: InteractionEvent[][] = [
        [
          createEvent({ eventType: 'execution', successful: true, timestamp: 1000 }),
          createEvent({ eventType: 'hint_view', timestamp: 2000 })
        ],
        [
          createEvent({ eventType: 'execution', successful: true, timestamp: 3000 }),
          createEvent({ eventType: 'explanation_view', timestamp: 4000 })
        ]
      ];
      
      const result = computePolicyMetrics(traces, 'test-policy');
      
      expect(result.policyId).toBe('test-policy');
      expect(result.traceCount).toBe(2);
      expect(result.aggregateMetrics.totalProblems).toBe(2);
    });

    it('should include learner metrics', () => {
      const traces: InteractionEvent[][] = [
        [createEvent({ learnerId: 'learner-a', eventType: 'execution', timestamp: 1000 })],
        [createEvent({ learnerId: 'learner-b', eventType: 'execution', timestamp: 2000 })]
      ];
      
      const result = computePolicyMetrics(traces, 'test-policy');
      
      expect(result.learnerMetrics).toHaveLength(2);
      expect(result.learnerMetrics[0].learnerId).toBe('learner-a');
      expect(result.learnerMetrics[1].learnerId).toBe('learner-b');
    });

    it('should include problem-level statistics', () => {
      const traces: InteractionEvent[][] = [
        [createEvent({ problemId: 'problem-1', eventType: 'execution', successful: true, timestamp: 1000 })]
      ];
      
      const result = computePolicyMetrics(traces, 'test-policy');
      
      expect(result.problemLevelStats['problem-1']).toBeDefined();
      expect(result.problemLevelStats['problem-1'].attempts).toBe(1);
    });
  });

  describe('computeStatistics', () => {
    it('should calculate mean', () => {
      const stats = computeStatistics([1, 2, 3, 4, 5]);
      expect(stats.mean).toBe(3);
    });

    it('should calculate standard deviation', () => {
      const stats = computeStatistics([2, 4, 4, 4, 5, 5, 7, 9]);
      expect(stats.stdDev).toBeCloseTo(2, 0);
    });

    it('should calculate min and max', () => {
      const stats = computeStatistics([3, 1, 4, 1, 5, 9, 2, 6]);
      expect(stats.min).toBe(1);
      expect(stats.max).toBe(9);
    });

    it('should calculate 95% confidence interval', () => {
      const stats = computeStatistics([1, 2, 3, 4, 5]);
      expect(stats.confidence95[0]).toBeLessThan(stats.mean);
      expect(stats.confidence95[1]).toBeGreaterThan(stats.mean);
    });

    it('should handle empty array', () => {
      const stats = computeStatistics([]);
      expect(stats.mean).toBe(0);
      expect(stats.stdDev).toBe(0);
    });

    it('should handle single value', () => {
      const stats = computeStatistics([5]);
      expect(stats.mean).toBe(5);
      expect(stats.stdDev).toBe(0);
      expect(stats.confidence95).toEqual([5, 5]);
    });
  });

  describe('getReplayMetricsVersion', () => {
    it('should return version string', () => {
      expect(getReplayMetricsVersion()).toBe('replay-metrics-v1');
    });
  });
});
