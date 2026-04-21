import { afterEach, describe, expect, it } from 'vitest';

import { storage } from './storage';
import type { InteractionEvent } from '../../types';

afterEach(() => {
  localStorage.clear();
});

describe('telemetry export contract', () => {
  it('retains hintId for hint_view exports', () => {
    storage.saveInteraction({
      id: 'hint-event-1',
      learnerId: 'learner-1',
      sessionId: 'session-1',
      timestamp: 1_700_000_000_000,
      eventType: 'hint_view',
      problemId: 'problem-1',
      hintId: 'sql-engage:joins:hint:sql-engage:joins:1:L2',
      hintLevel: 2,
      sqlEngageSubtype: 'joins',
      sqlEngageRowId: 'sql-engage:joins:1',
    });

    const exported = storage.exportData({ allHistory: true });

    expect(exported.interactions).toHaveLength(1);
    expect(exported.interactions[0]).toMatchObject({
      eventType: 'hint_view',
      hintId: 'sql-engage:joins:hint:sql-engage:joins:1:L2',
    });
  });

  it('logs explicit concept_view events for textbook unit selection', () => {
    storage.logConceptView({
      learnerId: 'learner-1',
      sessionId: 'session-1',
      unitId: 'unit-1',
      conceptId: 'joins',
      source: 'textbook',
      problemId: 'problem-joins-1',
    });

    const exported = storage.exportData({ allHistory: true });

    expect(exported.interactions).toHaveLength(1);
    expect(exported.interactions[0]).toMatchObject({
      eventType: 'concept_view',
      learnerId: 'learner-1',
      sessionId: 'session-1',
      unitId: 'unit-1',
      problemId: 'problem-joins-1',
      conceptId: 'joins',
      conceptIds: ['joins'],
      source: 'textbook',
    });
  });

  // RESEARCH-4: Concept exposure analysis requires lossless logging
  // Each concept surfacing must create a distinct event for time-based analysis
  it('creates distinct concept_view events for repeated surfacing (no dedupe)', () => {
    // First surfacing
    storage.logConceptView({
      learnerId: 'learner-1',
      sessionId: 'session-1',
      problemId: 'problem-1',
      conceptId: 'joins',
      source: 'hint',
    });

    // Same concept surfaced again in same session/problem/source
    storage.logConceptView({
      learnerId: 'learner-1',
      sessionId: 'session-1',
      problemId: 'problem-1',
      conceptId: 'joins',
      source: 'hint',
    });

    // Third surfacing
    storage.logConceptView({
      learnerId: 'learner-1',
      sessionId: 'session-1',
      problemId: 'problem-1',
      conceptId: 'joins',
      source: 'hint',
    });

    const exported = storage.exportData({ allHistory: true });

    // Should have 3 distinct events, not 1
    expect(exported.interactions).toHaveLength(3);

    // All should be concept_view with correct conceptId and source
    exported.interactions.forEach((interaction) => {
      expect(interaction).toMatchObject({
        eventType: 'concept_view',
        conceptId: 'joins',
        source: 'hint',
      });
    });

    // Each event should have unique id
    const ids = exported.interactions.map((i) => i.id);
    expect(new Set(ids).size).toBe(3); // All unique

    // Timestamps should be non-decreasing
    const timestamps = exported.interactions.map((i) => i.timestamp);
    expect(timestamps[0]).toBeLessThanOrEqual(timestamps[1]);
    expect(timestamps[1]).toBeLessThanOrEqual(timestamps[2]);
  });

  it('creates distinct concept_view events across different sources', () => {
    // Same concept from problem source
    storage.logConceptView({
      learnerId: 'learner-1',
      sessionId: 'session-1',
      problemId: 'problem-1',
      conceptId: 'joins',
      source: 'problem',
    });

    // Same concept from hint source
    storage.logConceptView({
      learnerId: 'learner-1',
      sessionId: 'session-1',
      problemId: 'problem-1',
      conceptId: 'joins',
      source: 'hint',
    });

    // Same concept from textbook source
    storage.logConceptView({
      learnerId: 'learner-1',
      sessionId: 'session-1',
      problemId: 'problem-1',
      conceptId: 'joins',
      source: 'textbook',
    });

    const exported = storage.exportData({ allHistory: true });

    expect(exported.interactions).toHaveLength(3);

    const sources = exported.interactions.map((i) => i.source);
    expect(sources).toContain('problem');
    expect(sources).toContain('hint');
    expect(sources).toContain('textbook');
  });

  it('auto-injects problemNumber from difficulty rank when not provided', () => {
    storage.saveInteraction({
      id: 'exec-event-1',
      learnerId: 'learner-1',
      sessionId: 'session-1',
      timestamp: 1_700_000_000_000,
      eventType: 'execution',
      problemId: 'problem-1',
      successful: true,
    });

    const exported = storage.exportData({ allHistory: true });
    expect(exported.interactions).toHaveLength(1);
    // problem-1 is the globally easiest problem, so its rank is 1
    expect(exported.interactions[0].problemNumber).toBe(1);
  });

  it('preserves explicit problemNumber when provided', () => {
    storage.saveInteraction({
      id: 'exec-event-2',
      learnerId: 'learner-1',
      sessionId: 'session-1',
      timestamp: 1_700_000_000_000,
      eventType: 'execution',
      problemId: 'problem-1',
      problemNumber: 42,
      successful: true,
    });

    const exported = storage.exportData({ allHistory: true });
    expect(exported.interactions).toHaveLength(1);
    expect(exported.interactions[0].problemNumber).toBe(42);
  });

  it('does not inject problemNumber when problemId is missing', () => {
    storage.saveInteraction({
      id: 'session-end-1',
      learnerId: 'learner-1',
      sessionId: 'session-1',
      timestamp: 1_700_000_000_000,
      eventType: 'session_end',
    } as unknown as InteractionEvent);

    const exported = storage.exportData({ allHistory: true });
    expect(exported.interactions).toHaveLength(1);
    expect(exported.interactions[0].problemNumber).toBeUndefined();
  });
});
