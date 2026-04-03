/**
 * Guidance Ladder Tests
 *
 * Comprehensive test coverage for escalation logic, trigger conditions,
 * and state management in the guidance ladder system.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import type { InteractionEvent } from '../../types';
import type { EscalationProfile } from './escalation-profiles';
import {
  GUIDANCE_LADDER_PROFILE_VERSION,
  type GuidanceRung,
  type GuidanceLadderState,
  type EscalationTrigger,
  RUNG_DEFINITIONS,
  TRIGGER_CONDITIONS,
  createInitialLadderState,
  canEscalate,
  escalate,
  recordRungAttempt,
  getCurrentRungInfo,
  determineNextAction,
} from './guidance-ladder';

const TEST_LEARNER_ID = 'test-learner-1';
const TEST_PROBLEM_ID = 'test-problem-1';

describe('guidance-ladder', () => {

  describe('constants', () => {
    it('should have correct version', () => {
      expect(GUIDANCE_LADDER_PROFILE_VERSION).toBe('guidance-ladder-profile-v1');
    });

    it('should define rung boundaries correctly', () => {
      expect(RUNG_DEFINITIONS[1].maxLength).toBe(150);
      expect(RUNG_DEFINITIONS[2].maxLength).toBe(800);
      expect(RUNG_DEFINITIONS[3].maxLength).toBe(2000);

      expect(RUNG_DEFINITIONS[1].mustInclude).toContain('contextual_clue');
      expect(RUNG_DEFINITIONS[2].mustInclude).toContain('concept_reference');
      expect(RUNG_DEFINITIONS[3].mustInclude).toContain('concept_tags');
    });

    it('should define trigger thresholds correctly', () => {
      expect(TRIGGER_CONDITIONS.rung_exhausted.threshold.rung1).toBe(3);
      expect(TRIGGER_CONDITIONS.rung_exhausted.threshold.rung2).toBe(2);
      expect(TRIGGER_CONDITIONS.repeated_error.threshold.sameSubtypeCount).toBe(2);
      expect(TRIGGER_CONDITIONS.time_stuck.threshold.milliseconds).toBe(5 * 60 * 1000); // 5 minutes
    });
  });

  describe('createInitialLadderState', () => {
    it('should create state at rung 1', () => {
      const state = createInitialLadderState(TEST_LEARNER_ID, TEST_PROBLEM_ID);

      expect(state.learnerId).toBe(TEST_LEARNER_ID);
      expect(state.problemId).toBe(TEST_PROBLEM_ID);
      expect(state.currentRung).toBe(1);
      expect(state.rungAttempts[1]).toBe(0);
      expect(state.rungAttempts[2]).toBe(0);
      expect(state.rungAttempts[3]).toBe(0);
      expect(state.escalationHistory).toEqual([]);
      expect(state.currentConceptIds).toEqual([]);
      expect(state.groundedInSources).toBe(false);
    });
  });

  describe('canEscalate', () => {
    let baseState: GuidanceLadderState;
    let emptyInteractions: InteractionEvent[];

    beforeEach(() => {
      baseState = createInitialLadderState(TEST_LEARNER_ID, TEST_PROBLEM_ID);
      emptyInteractions = [];
    });

    describe('learner_request trigger', () => {
      it('should always allow escalation on explicit request', () => {
        const result = canEscalate(baseState, 'learner_request', emptyInteractions);

        expect(result.allowed).toBe(true);
        expect(result.reason).toContain('explicitly requested');
      });

      it('should not allow escalation beyond rung 3', () => {
        const maxState: GuidanceLadderState = {
          ...baseState,
          currentRung: 3,
        };

        const result = canEscalate(maxState, 'learner_request', emptyInteractions);

        expect(result.allowed).toBe(false);
        expect(result.reason).toContain('maximum rung');
      });
    });

    describe('rung_exhausted trigger', () => {
      it('should allow escalation after 3 attempts at rung 1', () => {
        const state: GuidanceLadderState = {
          ...baseState,
          rungAttempts: { 1: 3, 2: 0, 3: 0 },
        };

        const result = canEscalate(state, 'rung_exhausted', emptyInteractions);

        expect(result.allowed).toBe(true);
        expect(result.reason).toContain('exhausted');
        expect(result.evidence).toMatchObject({ currentAttempts: 3, threshold: 3 });
      });

      it('should allow escalation after 2 attempts at rung 2', () => {
        const state: GuidanceLadderState = {
          ...baseState,
          currentRung: 2,
          rungAttempts: { 1: 3, 2: 2, 3: 0 },
        };

        const result = canEscalate(state, 'rung_exhausted', emptyInteractions);

        expect(result.allowed).toBe(true);
        expect(result.reason).toContain('exhausted');
      });

      it('should not allow escalation before threshold', () => {
        const state: GuidanceLadderState = {
          ...baseState,
          rungAttempts: { 1: 2, 2: 0, 3: 0 },
        };

        const result = canEscalate(state, 'rung_exhausted', emptyInteractions);

        expect(result.allowed).toBe(false);
        expect(result.reason).toContain('not yet exhausted');
      });

      it('should respect profile-aware thresholds', () => {
        const fastProfile: EscalationProfile = {
          id: 'fast-escalator',
          name: 'Fast Escalator',
          description: 'Aggressive escalation',
          thresholds: { escalate: 2, aggregate: 3 },
        };

        const state: GuidanceLadderState = {
          ...baseState,
          rungAttempts: { 1: 2, 2: 0, 3: 0 },
        };

        const result = canEscalate(state, 'rung_exhausted', emptyInteractions, fastProfile);

        expect(result.allowed).toBe(true);
        expect(result.profileAware).toBe(true);
        expect(result.evidence?.threshold).toBe(2);
      });
    });

    describe('repeated_error trigger', () => {
      it('should allow escalation on repeated same error subtype', () => {
        const interactions: InteractionEvent[] = [
          createMockInteraction('error', 'syntax-error'),
          createMockInteraction('execution', null, true),
          createMockInteraction('error', 'syntax-error'),
        ];

        const result = canEscalate(baseState, 'repeated_error', interactions);

        expect(result.allowed).toBe(true);
        expect(result.reason).toContain('Same error subtype repeated');
      });

      it('should not allow escalation without enough errors', () => {
        const interactions: InteractionEvent[] = [
          createMockInteraction('error', 'syntax-error'),
        ];

        const result = canEscalate(baseState, 'repeated_error', interactions);

        expect(result.allowed).toBe(false);
        expect(result.reason).toContain('Not enough recent errors');
      });

      it('should not allow escalation on different error subtypes', () => {
        const interactions: InteractionEvent[] = [
          createMockInteraction('error', 'syntax-error'),
          createMockInteraction('error', 'missing-where'),
          createMockInteraction('error', 'table-not-found'),
        ];

        const result = canEscalate(baseState, 'repeated_error', interactions);

        expect(result.allowed).toBe(false);
        expect(result.reason).toContain('No repeated error subtype');
      });
    });

    describe('time_stuck trigger', () => {
      it('should allow escalation after 5 minutes without success', () => {
        const now = Date.now();
        const sixMinutesAgo = now - 6 * 60 * 1000;

        const interactions: InteractionEvent[] = [
          createMockInteractionAt('code_change', null, sixMinutesAgo),
          createMockInteractionAt('error', 'syntax-error', sixMinutesAgo + 1000),
          createMockInteractionAt('hint_request', null, now - 1000),
        ];

        const result = canEscalate(baseState, 'time_stuck', interactions);

        expect(result.allowed).toBe(true);
        expect(result.reason).toContain('No success');
      });

      it('should not allow escalation if successful execution exists', () => {
        const now = Date.now();
        const sixMinutesAgo = now - 6 * 60 * 1000;

        const interactions: InteractionEvent[] = [
          createMockInteractionAt('code_change', null, sixMinutesAgo),
          createMockInteractionAt('execution', null, now - 1000, true),
        ];

        const result = canEscalate(baseState, 'time_stuck', interactions);

        expect(result.allowed).toBe(false);
        expect(result.reason).toContain('Successful execution found');
      });

      it('should not allow escalation before 5 minutes', () => {
        const now = Date.now();
        const twoMinutesAgo = now - 2 * 60 * 1000;

        const interactions: InteractionEvent[] = [
          createMockInteractionAt('code_change', null, twoMinutesAgo),
        ];

        const result = canEscalate(baseState, 'time_stuck', interactions);

        expect(result.allowed).toBe(false);
        expect(result.reason).toMatch(/Only \d+s elapsed/);
      });

      it('should not allow escalation with no interactions', () => {
        const result = canEscalate(baseState, 'time_stuck', []);

        expect(result.allowed).toBe(false);
        expect(result.reason).toContain('No interactions recorded');
      });
    });

    describe('hint_reopened trigger', () => {
      it('should not allow escalation (not implemented)', () => {
        const result = canEscalate(baseState, 'hint_reopened', emptyInteractions);

        expect(result.allowed).toBe(false);
        expect(result.reason).toContain('not reopened');
      });
    });

    describe('auto_escalation_eligible trigger', () => {
      it('should check auto-escalation eligibility', () => {
        // This depends on the canAutoEscalate function from data module
        // which we can't easily mock here, so we test the structure
        const interactions: InteractionEvent[] = [
          createMockInteraction('error', 'ambiguous-column-name'),
        ];

        const result = canEscalate(baseState, 'auto_escalation_eligible', interactions);

        // Result depends on canAutoEscalate, but structure should be valid
        expect(typeof result.allowed).toBe('boolean');
        expect(typeof result.reason).toBe('string');
      });
    });
  });

  describe('escalate', () => {
    it('should escalate from rung 1 to rung 2', () => {
      const state = createInitialLadderState(TEST_LEARNER_ID, TEST_PROBLEM_ID);

      const newState = escalate(state, 'rung_exhausted', {
        errorCount: 3,
        timeSpentMs: 120000,
        hintCount: 2,
      });

      expect(newState.currentRung).toBe(2);
      expect(newState.lastEscalationTrigger).toBe('rung_exhausted');
      expect(newState.escalationHistory).toHaveLength(1);
      expect(newState.escalationHistory[0].fromRung).toBe(1);
      expect(newState.escalationHistory[0].toRung).toBe(2);
      expect(newState.groundedInSources).toBe(true); // Rungs 2+ are grounded
    });

    it('should escalate from rung 2 to rung 3', () => {
      const state: GuidanceLadderState = {
        ...createInitialLadderState(TEST_LEARNER_ID, TEST_PROBLEM_ID),
        currentRung: 2,
      };

      const newState = escalate(state, 'repeated_error', {
        errorSubtypeId: 'syntax-error',
        errorCount: 5,
        timeSpentMs: 300000,
        hintCount: 3,
      });

      expect(newState.currentRung).toBe(3);
      expect(newState.escalationHistory).toHaveLength(1);
      expect(newState.escalationHistory[0].evidence.errorSubtypeId).toBe('syntax-error');
    });

    it('should not escalate beyond rung 3', () => {
      const state: GuidanceLadderState = {
        ...createInitialLadderState(TEST_LEARNER_ID, TEST_PROBLEM_ID),
        currentRung: 3,
      };

      const newState = escalate(state, 'learner_request', {
        errorCount: 0,
        timeSpentMs: 0,
        hintCount: 0,
      });

      expect(newState.currentRung).toBe(3);
      expect(newState.escalationHistory).toHaveLength(0);
    });

    it('should preserve escalation history', () => {
      const state: GuidanceLadderState = {
        ...createInitialLadderState(TEST_LEARNER_ID, TEST_PROBLEM_ID),
        currentRung: 2,
        escalationHistory: [
          {
            fromRung: 1,
            toRung: 2,
            trigger: 'rung_exhausted',
            timestamp: Date.now() - 10000,
            evidence: { errorCount: 3, timeSpentMs: 120000, hintCount: 2 },
          },
        ],
      };

      const newState = escalate(state, 'repeated_error', {
        errorCount: 5,
        timeSpentMs: 300000,
        hintCount: 3,
      });

      expect(newState.escalationHistory).toHaveLength(2);
      expect(newState.escalationHistory[0].fromRung).toBe(1);
      expect(newState.escalationHistory[0].toRung).toBe(2);
      expect(newState.escalationHistory[1].fromRung).toBe(2);
      expect(newState.escalationHistory[1].toRung).toBe(3);
    });
  });

  describe('recordRungAttempt', () => {
    it('should increment attempt count for current rung', () => {
      const state = createInitialLadderState(TEST_LEARNER_ID, TEST_PROBLEM_ID);

      const newState = recordRungAttempt(state);

      expect(newState.rungAttempts[1]).toBe(1);
      expect(newState.rungAttempts[2]).toBe(0);
      expect(newState.rungAttempts[3]).toBe(0);
    });

    it('should increment multiple times', () => {
      let state = createInitialLadderState(TEST_LEARNER_ID, TEST_PROBLEM_ID);

      state = recordRungAttempt(state);
      state = recordRungAttempt(state);
      state = recordRungAttempt(state);

      expect(state.rungAttempts[1]).toBe(3);
    });

    it('should track attempts at different rungs', () => {
      const state: GuidanceLadderState = {
        ...createInitialLadderState(TEST_LEARNER_ID, TEST_PROBLEM_ID),
        currentRung: 2,
        rungAttempts: { 1: 3, 2: 1, 3: 0 },
      };

      const newState = recordRungAttempt(state);

      expect(newState.rungAttempts[1]).toBe(3);
      expect(newState.rungAttempts[2]).toBe(2);
      expect(newState.rungAttempts[3]).toBe(0);
    });
  });

  describe('getCurrentRungInfo', () => {
    it('should return correct info at rung 1', () => {
      const state = createInitialLadderState(TEST_LEARNER_ID, TEST_PROBLEM_ID);

      const info = getCurrentRungInfo(state);

      expect(info.rung).toBe(1);
      expect(info.name).toBe('Micro-hint');
      expect(info.attemptsAtRung).toBe(0);
      expect(info.canEscalateTo).toBe(2);
      expect(info.groundedInSources).toBe(false);
    });

    it('should return correct info at rung 2', () => {
      const state: GuidanceLadderState = {
        ...createInitialLadderState(TEST_LEARNER_ID, TEST_PROBLEM_ID),
        currentRung: 2,
        rungAttempts: { 1: 3, 2: 1, 3: 0 },
        groundedInSources: true,
      };

      const info = getCurrentRungInfo(state);

      expect(info.rung).toBe(2);
      expect(info.name).toBe('Explanation');
      expect(info.attemptsAtRung).toBe(1);
      expect(info.canEscalateTo).toBe(3);
      expect(info.groundedInSources).toBe(true);
    });

    it('should return null escalation at rung 3', () => {
      const state: GuidanceLadderState = {
        ...createInitialLadderState(TEST_LEARNER_ID, TEST_PROBLEM_ID),
        currentRung: 3,
      };

      const info = getCurrentRungInfo(state);

      expect(info.rung).toBe(3);
      expect(info.canEscalateTo).toBeNull();
    });
  });

  describe('determineNextAction', () => {
    it('should escalate on explicit learner request', () => {
      const state = createInitialLadderState(TEST_LEARNER_ID, TEST_PROBLEM_ID);
      const interactions: InteractionEvent[] = [
        { ...createMockInteraction('guidance_request'), metadata: { escalationRequested: true } },
      ];

      const action = determineNextAction(state, interactions);

      expect(action.action).toBe('escalate');
      expect(action.rung).toBe(2);
      expect(action.trigger).toBe('learner_request');
    });

    it('should escalate when rung is exhausted', () => {
      const state: GuidanceLadderState = {
        ...createInitialLadderState(TEST_LEARNER_ID, TEST_PROBLEM_ID),
        rungAttempts: { 1: 3, 2: 0, 3: 0 },
      };

      const action = determineNextAction(state, []);

      expect(action.action).toBe('escalate');
      expect(action.rung).toBe(2);
      expect(action.trigger).toBe('rung_exhausted');
    });

    it('should escalate on repeated errors', () => {
      const state = createInitialLadderState(TEST_LEARNER_ID, TEST_PROBLEM_ID);
      const interactions: InteractionEvent[] = [
        createMockInteraction('error', 'syntax-error'),
        createMockInteraction('error', 'syntax-error'),
      ];

      const action = determineNextAction(state, interactions);

      expect(action.action).toBe('escalate');
      expect(action.rung).toBe(2);
      expect(action.trigger).toBe('repeated_error');
    });

    it('should stay at current rung when no triggers met', () => {
      const state = createInitialLadderState(TEST_LEARNER_ID, TEST_PROBLEM_ID);
      const interactions: InteractionEvent[] = [createMockInteraction('code_change')];

      const action = determineNextAction(state, interactions);

      expect(action.action).toBe('stay');
      expect(action.rung).toBe(1);
      expect(action.trigger).toBeUndefined();
    });

    it('should use profile for threshold calculation', () => {
      const fastProfile: EscalationProfile = {
        id: 'fast-escalator',
        name: 'Fast Escalator',
        description: 'Aggressive escalation',
        thresholds: { escalate: 2, aggregate: 3 },
      };

      const state: GuidanceLadderState = {
        ...createInitialLadderState(TEST_LEARNER_ID, TEST_PROBLEM_ID),
        rungAttempts: { 1: 2, 2: 0, 3: 0 },
      };

      const action = determineNextAction(state, [], fastProfile);

      expect(action.action).toBe('escalate');
      expect(action.trigger).toBe('rung_exhausted');
    });
  });
});

// Helper functions

function createMockInteraction(
  eventType: InteractionEvent['eventType'],
  errorSubtypeId: string | null = null,
  successful: boolean = false
): InteractionEvent {
  return {
    id: `test-${Math.random().toString(36).slice(2)}`,
    learnerId: TEST_LEARNER_ID,
    timestamp: Date.now(),
    eventType,
    problemId: TEST_PROBLEM_ID,
    errorSubtypeId: errorSubtypeId || undefined,
    successful,
  };
}

function createMockInteractionAt(
  eventType: InteractionEvent['eventType'],
  errorSubtypeId: string | null,
  timestamp: number,
  successful: boolean = false
): InteractionEvent {
  return {
    ...createMockInteraction(eventType, errorSubtypeId, successful),
    timestamp,
  };
}
