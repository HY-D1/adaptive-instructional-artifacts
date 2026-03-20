/**
 * RESEARCH-4: Canonical Study Field Tests
 *
 * Verifies that the four representative event types emit the correct canonical
 * study fields at log time, so fields are present in stored events without any
 * post-hoc computation.
 *
 * Covered events:
 *   - profile_assigned       → learnerProfileId, strategyAssigned
 *   - escalation_triggered   → learnerProfileId, escalationTriggerReason, errorCountAtEscalation, timeToEscalation
 *   - bandit_reward_observed → selectedArm, rewardValue
 *   - bandit_updated         → selectedArm, strategyUpdated
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// ============================================================================
// Minimal mock for localStorage (JSDOM not guaranteed in this test env)
// ============================================================================

const store: Record<string, string> = {};

const localStorageMock = {
  getItem: (key: string) => store[key] ?? null,
  setItem: (key: string, value: string) => { store[key] = value; },
  removeItem: (key: string) => { delete store[key]; },
  clear: () => { Object.keys(store).forEach(k => delete store[k]); },
  get length() { return Object.keys(store).length; },
  key: (i: number) => Object.keys(store)[i] ?? null,
};

Object.defineProperty(globalThis, 'localStorage', {
  value: localStorageMock,
  writable: true,
});

// ============================================================================
// Import after mock is in place
// ============================================================================

import { storage } from '../storage/storage';

// Helper: grab the most recently stored interaction
function getLastInteraction() {
  const raw = localStorage.getItem('sql-learning-interactions');
  if (!raw) return null;
  const arr = JSON.parse(raw);
  return arr[arr.length - 1];
}

// ============================================================================
// Tests
// ============================================================================

describe('RESEARCH-4 canonical fields — profile_assigned', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('sets learnerProfileId to the profileId argument', () => {
    storage.logProfileAssigned('learner-1', 'slow-escalator', 'bandit', 'problem-1');
    const event = getLastInteraction();
    expect(event).not.toBeNull();
    expect(event.eventType).toBe('profile_assigned');
    expect(event.learnerProfileId).toBe('slow-escalator');
  });

  it('sets strategyAssigned to the profileId argument', () => {
    storage.logProfileAssigned('learner-1', 'aggressive-escalator', 'bandit', 'problem-1');
    const event = getLastInteraction();
    expect(event.strategyAssigned).toBe('aggressive-escalator');
  });

  it('both canonical fields present on same event', () => {
    storage.logProfileAssigned('learner-1', 'conservative', 'static', 'problem-2');
    const event = getLastInteraction();
    expect(event.learnerProfileId).toBeDefined();
    expect(event.strategyAssigned).toBeDefined();
    expect(event.learnerProfileId).toBe(event.strategyAssigned);
  });
});

describe('RESEARCH-4 canonical fields — escalation_triggered', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('sets learnerProfileId', () => {
    storage.logEscalationTriggered('learner-2', 'slow-escalator', 3, 'problem-1');
    const event = getLastInteraction();
    expect(event.eventType).toBe('escalation_triggered');
    expect(event.learnerProfileId).toBe('slow-escalator');
  });

  it('sets escalationTriggerReason (default: threshold_met)', () => {
    storage.logEscalationTriggered('learner-2', 'slow-escalator', 3, 'problem-1');
    const event = getLastInteraction();
    expect(event.escalationTriggerReason).toBe('threshold_met');
  });

  it('sets escalationTriggerReason when explicitly provided', () => {
    storage.logEscalationTriggered('learner-2', 'slow-escalator', 3, 'problem-1', 'manual_override');
    const event = getLastInteraction();
    expect(event.escalationTriggerReason).toBe('manual_override');
  });

  it('sets errorCountAtEscalation', () => {
    storage.logEscalationTriggered('learner-2', 'slow-escalator', 5, 'problem-1');
    const event = getLastInteraction();
    expect(event.errorCountAtEscalation).toBe(5);
  });

  it('sets timeToEscalation when provided', () => {
    storage.logEscalationTriggered('learner-2', 'slow-escalator', 3, 'problem-1', 'threshold_met', 12345);
    const event = getLastInteraction();
    expect(event.timeToEscalation).toBe(12345);
  });

  it('omits timeToEscalation when not provided', () => {
    storage.logEscalationTriggered('learner-2', 'slow-escalator', 3, 'problem-1');
    const event = getLastInteraction();
    expect(event.timeToEscalation).toBeUndefined();
  });
});

describe('RESEARCH-4 canonical fields — bandit_reward_observed', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  const sampleComponents = {
    independentSuccess: 1,
    errorReduction: 0.5,
    delayedRetention: 0,
    dependencyPenalty: 0,
    timeEfficiency: 1,
  };

  it('sets selectedArm to the armId argument', () => {
    storage.logBanditRewardObserved('learner-3', 'adaptive', 0.7, sampleComponents);
    const event = getLastInteraction();
    expect(event.eventType).toBe('bandit_reward_observed');
    expect(event.selectedArm).toBe('adaptive');
  });

  it('sets rewardValue to the reward total', () => {
    storage.logBanditRewardObserved('learner-3', 'conservative', 0.4, sampleComponents);
    const event = getLastInteraction();
    expect(event.rewardValue).toBe(0.4);
  });

  it('rewardValue matches reward.total', () => {
    storage.logBanditRewardObserved('learner-3', 'aggressive', 0.85, sampleComponents);
    const event = getLastInteraction();
    expect(event.rewardValue).toBe(event.reward.total);
  });

  it('both canonical fields are present', () => {
    storage.logBanditRewardObserved('learner-3', 'adaptive', 0.6, sampleComponents);
    const event = getLastInteraction();
    expect(event.selectedArm).toBeDefined();
    expect(event.rewardValue).toBeDefined();
  });
});

describe('RESEARCH-4 canonical fields — bandit_updated', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('sets selectedArm', () => {
    storage.logBanditUpdated('learner-4', 'adaptive', 3, 1, 4);
    const event = getLastInteraction();
    expect(event.eventType).toBe('bandit_updated');
    expect(event.selectedArm).toBe('adaptive');
  });

  it('sets strategyUpdated to the armId', () => {
    storage.logBanditUpdated('learner-4', 'conservative', 2, 1, 3);
    const event = getLastInteraction();
    expect(event.strategyUpdated).toBe('conservative');
  });

  it('selectedArm and strategyUpdated match', () => {
    storage.logBanditUpdated('learner-4', 'aggressive', 5, 2, 7);
    const event = getLastInteraction();
    expect(event.selectedArm).toBe(event.strategyUpdated);
  });

  it('still stores newAlpha and newBeta for backward compatibility', () => {
    storage.logBanditUpdated('learner-4', 'adaptive', 4, 2, 6);
    const event = getLastInteraction();
    expect(event.newAlpha).toBe(4);
    expect(event.newBeta).toBe(2);
  });
});
