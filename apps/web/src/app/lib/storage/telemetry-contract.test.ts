import { afterEach, describe, expect, it } from 'vitest';

import { storage } from './storage';

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
});
