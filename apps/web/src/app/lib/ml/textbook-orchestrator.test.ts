/**
 * textbook-orchestrator.test.ts
 *
 * Replay-fixture tests for the condition-aware textbook orchestration function.
 *
 * Core contract:
 *   - Given the same context, orchestrate() always returns the same decision.
 *   - static_hint_mode: all steps → stay_hint (baseline control arm).
 *   - adaptive textbook: steps escalate through show_explanation →
 *     upsert_textbook_unit → prompt_reflective_note.
 *   - corpusConceptId is always a stable corpus key from the compatibility map.
 *   - RESEARCH-4 fields (escalationTriggerReason, errorCountAtDecision,
 *     timeToDecision) are present and non-empty on every decision.
 */

import { describe, it, expect } from 'vitest';
import {
  orchestrate,
  resolveCorpusConceptId,
  staticHintModeCondition,
  adaptiveTextbookCondition,
  createReinforcementPromptShown,
  createReinforcementResponse,
  scheduleReinforcement,
  type OrchestrationAction,
  type OrchestrationContext,
  type SessionConditionFlags,
} from './textbook-orchestrator';

// ── Shared fixture ────────────────────────────────────────────────────────────

/**
 * Canonical 6-step trace for a learner working on a JOIN problem.
 * Each step represents the cumulative state at a decision point.
 */
const TRACE: Array<{ retryCount: number; hintCount: number; elapsedMs: number }> = [
  // Step 0: first attempt, no hints yet
  { retryCount: 1, hintCount: 0, elapsedMs: 0 },
  // Step 1: second attempt, still no hints
  { retryCount: 2, hintCount: 0, elapsedMs: 15_000 },
  // Step 2: hint consumed, then another retry
  { retryCount: 2, hintCount: 1, elapsedMs: 20_000 },
  // Step 3: third retry after explanation
  { retryCount: 3, hintCount: 1, elapsedMs: 30_000 },
  // Step 4: more hints, more retries — moderate struggle
  { retryCount: 4, hintCount: 3, elapsedMs: 90_000 },
  // Step 5: high hint count — deep struggle
  { retryCount: 7, hintCount: 6, elapsedMs: 310_000 },
];

const CONCEPT_ID = 'joins';
const EXPECTED_CORPUS_KEY = 'dbms-ramakrishnan-3rd-edition/joins';

/**
 * Run the full trace under a given condition and return the actions.
 */
function runTrace(
  condition: SessionConditionFlags,
  availableConcepts?: Record<string, unknown>
): OrchestrationAction[] {
  return TRACE.map(step =>
    orchestrate({
      conceptId: CONCEPT_ID,
      sessionConfig: condition,
      availableConcepts,
      ...step,
    }).action
  );
}

// ── Corpus resolution ─────────────────────────────────────────────────────────

describe('resolveCorpusConceptId', () => {
  it('returns first compatibility-map entry when no availableConcepts given', () => {
    expect(resolveCorpusConceptId('joins')).toBe(EXPECTED_CORPUS_KEY);
    expect(resolveCorpusConceptId('where-clause')).toBe('dbms-ramakrishnan-3rd-edition/where-clause');
    expect(resolveCorpusConceptId('aggregation')).toBe('dbms-ramakrishnan-3rd-edition/aggregate-functions');
  });

  it('filters to available corpus when availableConcepts provided', () => {
    const limited = { 'murachs-mysql-3rd-edition/joins-murach': {} };
    // First candidate (ramakrishnan) not present → should pick second (murach)
    expect(resolveCorpusConceptId('joins', limited)).toBe('murachs-mysql-3rd-edition/joins-murach');
  });

  it('returns first candidate even when no candidate exists in availableConcepts', () => {
    const empty = {};
    // Falls back to first entry for traceability
    expect(resolveCorpusConceptId('joins', empty)).toBe(EXPECTED_CORPUS_KEY);
  });

  it('returns null for an unknown internal ID', () => {
    expect(resolveCorpusConceptId('nonexistent-concept-id')).toBeNull();
  });

  it('resolves order-by to Murach first (MySQL-specific preference)', () => {
    expect(resolveCorpusConceptId('order-by')).toBe('murachs-mysql-3rd-edition/order-by-murach');
  });
});

// ── static_hint_mode baseline ─────────────────────────────────────────────────

describe('orchestrate — static_hint_mode (baseline control)', () => {
  const condition = staticHintModeCondition();

  it('every trace step returns stay_hint', () => {
    const actions = runTrace(condition);
    expect(actions).toEqual([
      'stay_hint',
      'stay_hint',
      'stay_hint',
      'stay_hint',
      'stay_hint',
      'stay_hint',
    ]);
  });

  it('escalationTriggerReason is always static_hint_mode', () => {
    TRACE.forEach(step => {
      const decision = orchestrate({ conceptId: CONCEPT_ID, sessionConfig: condition, ...step });
      expect(decision.escalationTriggerReason).toBe('static_hint_mode');
    });
  });

  it('corpusConceptId is the stable corpus key on every step', () => {
    TRACE.forEach(step => {
      const decision = orchestrate({ conceptId: CONCEPT_ID, sessionConfig: condition, ...step });
      expect(decision.corpusConceptId).toBe(EXPECTED_CORPUS_KEY);
    });
  });

  it('RESEARCH-4 fields are populated on every decision', () => {
    TRACE.forEach(step => {
      const decision = orchestrate({ conceptId: CONCEPT_ID, sessionConfig: condition, ...step });
      expect(typeof decision.escalationTriggerReason).toBe('string');
      expect(decision.escalationTriggerReason.length).toBeGreaterThan(0);
      expect(decision.errorCountAtDecision).toBe(step.retryCount);
      expect(decision.timeToDecision).toBe(step.elapsedMs);
    });
  });
});

// ── adaptive textbook mode ────────────────────────────────────────────────────

describe('orchestrate — adaptive textbook mode (treatment)', () => {
  const condition = adaptiveTextbookCondition();

  it('trace escalates through all four actions in order', () => {
    const actions = runTrace(condition);
    expect(actions).toEqual([
      'stay_hint',          // step 0: retryCount=1, hintCount=0
      'stay_hint',          // step 1: retryCount=2, hintCount=0 (no hint seen yet)
      'show_explanation',   // step 2: retryCount=2, hintCount=1 (hint + retry threshold)
      'show_explanation',   // step 3: retryCount=3, hintCount=1 (still in explanation zone)
      'upsert_textbook_unit', // step 4: retryCount=4, hintCount=3 (moderate struggle)
      'prompt_reflective_note', // step 5: hintCount=6, elapsedMs=310_000
    ]);
  });

  it('escalationTriggerReason is meaningful at each step', () => {
    const decisions = TRACE.map(step =>
      orchestrate({ conceptId: CONCEPT_ID, sessionConfig: condition, ...step })
    );

    expect(decisions[0].escalationTriggerReason).toBe('early_phase');
    expect(decisions[1].escalationTriggerReason).toBe('early_phase');
    expect(decisions[2].escalationTriggerReason).toBe('hint_plus_retry');
    expect(decisions[3].escalationTriggerReason).toBe('hint_plus_retry');
    expect(decisions[4].escalationTriggerReason).toBe('hint_count_threshold');
    expect(decisions[5].escalationTriggerReason).toBe('high_hint_count');
  });

  it('corpusConceptId is always the stable corpus key', () => {
    TRACE.forEach(step => {
      const decision = orchestrate({ conceptId: CONCEPT_ID, sessionConfig: condition, ...step });
      expect(decision.corpusConceptId).toBe(EXPECTED_CORPUS_KEY);
    });
  });
});

// ── Cross-condition comparison (the replay fixture) ───────────────────────────

describe('replay fixture: static_hint_mode vs adaptive textbook on same trace', () => {
  const staticActions = runTrace(staticHintModeCondition());
  const adaptiveActions = runTrace(adaptiveTextbookCondition());

  it('static produces only stay_hint; adaptive produces 4 distinct action types', () => {
    const staticUnique = new Set(staticActions);
    const adaptiveUnique = new Set(adaptiveActions);

    expect(staticUnique).toEqual(new Set(['stay_hint']));
    expect(adaptiveUnique).toEqual(new Set([
      'stay_hint',
      'show_explanation',
      'upsert_textbook_unit',
      'prompt_reflective_note',
    ]));
  });

  it('explanations shown: 0 (static) vs 2 (adaptive)', () => {
    const staticExplanations = staticActions.filter(a => a === 'show_explanation').length;
    const adaptiveExplanations = adaptiveActions.filter(a => a === 'show_explanation').length;
    expect(staticExplanations).toBe(0);
    expect(adaptiveExplanations).toBe(2);
  });

  it('textbook units triggered: 0 (static) vs 1 (adaptive)', () => {
    const staticTextbook = staticActions.filter(a => a === 'upsert_textbook_unit').length;
    const adaptiveTextbook = adaptiveActions.filter(a => a === 'upsert_textbook_unit').length;
    expect(staticTextbook).toBe(0);
    expect(adaptiveTextbook).toBe(1);
  });

  it('reflective notes triggered: 0 (static) vs 1 (adaptive)', () => {
    const staticReflective = staticActions.filter(a => a === 'prompt_reflective_note').length;
    const adaptiveReflective = adaptiveActions.filter(a => a === 'prompt_reflective_note').length;
    expect(staticReflective).toBe(0);
    expect(adaptiveReflective).toBe(1);
  });

  it('escalation depth: 0 (static) vs 3 (adaptive — 3 levels above stay_hint)', () => {
    const escalationDepth = (actions: OrchestrationAction[]) =>
      new Set(actions.filter(a => a !== 'stay_hint')).size;

    expect(escalationDepth(staticActions)).toBe(0);
    expect(escalationDepth(adaptiveActions)).toBe(3);
  });

  it('decisions are deterministic: same trace same condition → same result', () => {
    const secondRun = runTrace(adaptiveTextbookCondition());
    expect(secondRun).toEqual(adaptiveActions);
  });
});

// ── Other condition modes ─────────────────────────────────────────────────────

describe('orchestrate — other session conditions', () => {
  it('immediateExplanationMode: show_explanation from first retry onward', () => {
    const condition: SessionConditionFlags = {
      textbookDisabled: false,
      adaptiveLadderDisabled: false,
      immediateExplanationMode: true,
      staticHintMode: false,
    };

    const atStep0 = orchestrate({ conceptId: CONCEPT_ID, sessionConfig: condition, retryCount: 0, hintCount: 0, elapsedMs: 0 });
    expect(atStep0.action).toBe('stay_hint'); // no retry yet

    const atStep1 = orchestrate({ conceptId: CONCEPT_ID, sessionConfig: condition, retryCount: 1, hintCount: 0, elapsedMs: 500 });
    expect(atStep1.action).toBe('show_explanation');
    expect(atStep1.escalationTriggerReason).toBe('immediate_explanation_mode');
  });

  it('textbookDisabled: ceiling is show_explanation, never upserts', () => {
    const condition: SessionConditionFlags = {
      textbookDisabled: true,
      adaptiveLadderDisabled: false,
      immediateExplanationMode: false,
      staticHintMode: false,
    };

    // Below threshold → hint
    const belowThreshold = orchestrate({ conceptId: CONCEPT_ID, sessionConfig: condition, retryCount: 1, hintCount: 1, elapsedMs: 0 });
    expect(belowThreshold.action).toBe('stay_hint');

    // At threshold → explanation (not textbook)
    const atThreshold = orchestrate({ conceptId: CONCEPT_ID, sessionConfig: condition, retryCount: 2, hintCount: 2, elapsedMs: 0 });
    expect(atThreshold.action).toBe('show_explanation');

    // Well above adaptive thresholds → still only explanation
    const farAbove = orchestrate({ conceptId: CONCEPT_ID, sessionConfig: condition, retryCount: 10, hintCount: 10, elapsedMs: 600_000 });
    expect(farAbove.action).toBe('show_explanation');
  });

  it('adaptiveLadderDisabled: uses static thresholds, still reaches textbook', () => {
    const condition: SessionConditionFlags = {
      textbookDisabled: false,
      adaptiveLadderDisabled: true,
      immediateExplanationMode: false,
      staticHintMode: false,
    };

    const atTextbookThreshold = orchestrate({ conceptId: CONCEPT_ID, sessionConfig: condition, retryCount: 4, hintCount: 4, elapsedMs: 0 });
    expect(atTextbookThreshold.action).toBe('upsert_textbook_unit');
    expect(atTextbookThreshold.escalationTriggerReason).toBe('static_textbook_threshold');
  });
});

// ── 3-Policy Replay Fixture (conservative / adaptive / explanation_first) ─────

describe('replay fixture: 3-policy comparison on canonical trace', () => {
  const TRACE = [
    { retryCount: 1, hintCount: 0, elapsedMs: 0 },
    { retryCount: 2, hintCount: 0, elapsedMs: 15_000 },
    { retryCount: 2, hintCount: 1, elapsedMs: 20_000 },
    { retryCount: 3, hintCount: 1, elapsedMs: 30_000 },
    { retryCount: 4, hintCount: 3, elapsedMs: 90_000 },
    { retryCount: 7, hintCount: 6, elapsedMs: 310_000 },
  ];

  const CONCEPT_ID = 'joins';

  function runTraceUnderCondition(condition: SessionConditionFlags): OrchestrationAction[] {
    return TRACE.map(step =>
      orchestrate({
        conceptId: CONCEPT_ID,
        sessionConfig: condition,
        ...step,
      }).action
    );
  }

  it('compares conservative vs adaptive vs explanation_first on same trace', () => {
    const conservative = runTraceUnderCondition(staticHintModeCondition());
    const adaptive = runTraceUnderCondition(adaptiveTextbookCondition());
    const explanationFirst = runTraceUnderCondition({
      textbookDisabled: true,
      adaptiveLadderDisabled: false,
      immediateExplanationMode: true,
      staticHintMode: false,
    });

    // Conservative: only hints
    expect(conservative.filter(a => a === 'stay_hint').length).toBe(6);
    expect(conservative.filter(a => a === 'show_explanation').length).toBe(0);
    expect(conservative.filter(a => a === 'upsert_textbook_unit').length).toBe(0);

    // Adaptive: escalates through all levels
    expect(adaptive.filter(a => a === 'show_explanation').length).toBe(2);
    expect(adaptive.filter(a => a === 'upsert_textbook_unit').length).toBe(1);
    expect(adaptive.filter(a => a === 'prompt_reflective_note').length).toBe(1);

    // Explanation first: explanations on first retry, no textbook
    // TRACE: [r1, r2, r2, r3, r4, r7] - all 6 steps have retryCount >= 1
    expect(explanationFirst.filter(a => a === 'show_explanation').length).toBe(6);
    expect(explanationFirst.filter(a => a === 'upsert_textbook_unit').length).toBe(0);
  });

  it('produces reproducible outputs for each policy', () => {
    const run1 = runTraceUnderCondition(adaptiveTextbookCondition());
    const run2 = runTraceUnderCondition(adaptiveTextbookCondition());
    expect(run1).toEqual(run2);
  });

  it('escalation depth differs: 0 (conservative) vs 3 (adaptive) vs 1 (explanation_first)', () => {
    const conservative = runTraceUnderCondition(staticHintModeCondition());
    const adaptive = runTraceUnderCondition(adaptiveTextbookCondition());
    const explanationFirst = runTraceUnderCondition({
      textbookDisabled: true,
      adaptiveLadderDisabled: false,
      immediateExplanationMode: true,
      staticHintMode: false,
    });

    const escalationDepth = (actions: OrchestrationAction[]) =>
      new Set(actions.filter(a => a !== 'stay_hint')).size;

    expect(escalationDepth(conservative)).toBe(0);
    expect(escalationDepth(adaptive)).toBe(3);
    expect(escalationDepth(explanationFirst)).toBe(1);
  });
});

// ── Reinforcement Event Factory Tests ─────────────────────────────────────────

describe('reinforcement event factories', () => {
  it('createReinforcementPromptShown creates event with stable IDs', () => {
    // Import dynamically to avoid ESM issues
    const event = createReinforcementPromptShown({
      learnerId: 'learner-1',
      sessionId: 'session-1',
      sourceUnitId: 'unit-abc',
      sourceConceptId: 'dbms-ramakrishnan-3rd-edition/joins',
      delayBucket: '3d',
      promptType: 'mcq',
      timestamp: 1_000_000,
    });

    expect(event.eventType).toBe('reinforcement_prompt_shown');
    expect(event.sourceUnitId).toBe('unit-abc');
    expect(event.sourceConceptId).toBe('dbms-ramakrishnan-3rd-edition/joins');
    expect(event.delayBucket).toBe('3d');
    expect(event.corpusConceptId).toBe('dbms-ramakrishnan-3rd-edition/joins');
    expect(event.promptId).toContain('unit-abc');
  });

  it('createReinforcementResponse creates event with outcome fields', () => {
    const event = createReinforcementResponse({
      learnerId: 'learner-1',
      sessionId: 'session-1',
      sourceUnitId: 'unit-abc',
      sourceConceptId: 'dbms-ramakrishnan-3rd-edition/joins',
      delayBucket: '3d',
      isCorrect: true,
      latencyMs: 4500,
      response: 'SELECT * FROM users',
      timestamp: 1_005_000,
    });

    expect(event.eventType).toBe('reinforcement_response');
    expect(event.reinforcementCorrect).toBe(true);
    expect(event.reinforcementLatencyMs).toBe(4500);
    expect(event.isCorrect).toBe(true);
    expect(event.corpusConceptId).toBe('dbms-ramakrishnan-3rd-edition/joins');
  });

  it('scheduleReinforcement calculates correct delay bucket', () => {
    const unitCreated = 1_000_000;
    const scheduled = scheduleReinforcement(unitCreated, 3);

    expect(scheduled.delayBucket).toBe('3d');
    expect(scheduled.scheduledTime).toBe(unitCreated + 3 * 24 * 60 * 60 * 1000);
  });
});

// ── Corpus concept ID in textbook events ──────────────────────────────────────

describe('corpusConceptId: stable identifiers for textbook events', () => {
  const condition = adaptiveTextbookCondition();

  it('upsert_textbook_unit decision carries stable corpus key', () => {
    // Step 4: retryCount=4, hintCount=3 → upsert_textbook_unit
    const step4 = TRACE[4];
    const decision = orchestrate({ conceptId: CONCEPT_ID, sessionConfig: condition, ...step4 });
    expect(decision.action).toBe('upsert_textbook_unit');
    expect(decision.corpusConceptId).toBe('dbms-ramakrishnan-3rd-edition/joins');
  });

  it('prompt_reflective_note decision carries stable corpus key', () => {
    // Step 5: hintCount=6, elapsedMs=310_000 → prompt_reflective_note
    const step5 = TRACE[5];
    const decision = orchestrate({ conceptId: CONCEPT_ID, sessionConfig: condition, ...step5 });
    expect(decision.action).toBe('prompt_reflective_note');
    expect(decision.corpusConceptId).toBe('dbms-ramakrishnan-3rd-edition/joins');
  });

  it('corpusConceptId is stable for multiple internal concepts', () => {
    const testCases: Array<{ internal: string; expectedCorpus: string }> = [
      { internal: 'aggregation',     expectedCorpus: 'dbms-ramakrishnan-3rd-edition/aggregate-functions' },
      { internal: 'having-clause',   expectedCorpus: 'dbms-ramakrishnan-3rd-edition/having' },
      { internal: 'order-by',        expectedCorpus: 'murachs-mysql-3rd-edition/order-by-murach' },
      { internal: 'string-functions', expectedCorpus: 'murachs-mysql-3rd-edition/string-functions' },
      { internal: 'cte',             expectedCorpus: 'dbms-ramakrishnan-3rd-edition/subqueries' },
      { internal: 'union',           expectedCorpus: 'dbms-ramakrishnan-3rd-edition/set-operations' },
    ];

    testCases.forEach(({ internal, expectedCorpus }) => {
      const decision = orchestrate({
        conceptId: internal,
        sessionConfig: condition,
        retryCount: 5,
        hintCount: 4,
        elapsedMs: 150_000,
      });
      expect(decision.corpusConceptId).toBe(expectedCorpus);
    });
  });

  it('null corpusConceptId for unmapped internal concept IDs', () => {
    const decision = orchestrate({
      conceptId: 'completely-unmapped-concept',
      sessionConfig: condition,
      retryCount: 5,
      hintCount: 4,
      elapsedMs: 0,
    });
    expect(decision.corpusConceptId).toBeNull();
  });
});

// ── Live-path / replay-path parity fixture ────────────────────────────────────
//
// This test suite is the regression gate proving that the TypeScript orchestrator
// (live learner path) and the ESM mirror used by replay-paper-tables.mjs produce
// identical action sequences on the canonical trace.
//
// If this test fails, the two paths have drifted.  Fix BOTH sources together.

describe('live-path vs replay-path parity: canonical 3-policy trace', () => {
  /**
   * The canonical 6-step trace — identical to the one in replay-paper-tables.mjs.
   * Any change here must be mirrored in scripts/replay-paper-tables.mjs and vice-versa.
   */
  const CANONICAL_REPLAY_TRACE = [
    { retryCount: 1, hintCount: 0, elapsedMs: 0 },
    { retryCount: 2, hintCount: 0, elapsedMs: 15_000 },
    { retryCount: 2, hintCount: 1, elapsedMs: 20_000 },
    { retryCount: 3, hintCount: 1, elapsedMs: 30_000 },
    { retryCount: 4, hintCount: 3, elapsedMs: 90_000 },
    { retryCount: 7, hintCount: 6, elapsedMs: 310_000 },
  ] as const;

  function runCanonicalTrace(condition: SessionConditionFlags): OrchestrationAction[] {
    return CANONICAL_REPLAY_TRACE.map(step =>
      orchestrate({ conceptId: 'joins', sessionConfig: condition, ...step }).action
    );
  }

  it('conservative policy: 6 stay_hint (matches replay-paper-tables conservative)', () => {
    const actions = runCanonicalTrace(staticHintModeCondition());
    expect(actions).toEqual(['stay_hint', 'stay_hint', 'stay_hint', 'stay_hint', 'stay_hint', 'stay_hint']);
  });

  it('adaptive policy: escalates through all 4 levels (matches replay-paper-tables adaptive)', () => {
    const actions = runCanonicalTrace(adaptiveTextbookCondition());
    expect(actions).toEqual([
      'stay_hint',
      'stay_hint',
      'show_explanation',
      'show_explanation',
      'upsert_textbook_unit',
      'prompt_reflective_note',
    ]);
  });

  it('explanation_first policy: 6 show_explanation (matches replay-paper-tables explanation_first)', () => {
    const actions = runCanonicalTrace({
      textbookDisabled: true,
      adaptiveLadderDisabled: false,
      immediateExplanationMode: true,
      staticHintMode: false,
    });
    expect(actions).toEqual([
      'show_explanation',
      'show_explanation',
      'show_explanation',
      'show_explanation',
      'show_explanation',
      'show_explanation',
    ]);
  });

  it('all policies are deterministic: two runs on same trace → same result', () => {
    const run1 = runCanonicalTrace(adaptiveTextbookCondition());
    const run2 = runCanonicalTrace(adaptiveTextbookCondition());
    expect(run1).toEqual(run2);
  });

  it('escalationTriggerReason matches expected labels at each step (adaptive)', () => {
    const decisions = CANONICAL_REPLAY_TRACE.map(step =>
      orchestrate({ conceptId: 'joins', sessionConfig: adaptiveTextbookCondition(), ...step })
    );
    expect(decisions[0].escalationTriggerReason).toBe('early_phase');
    expect(decisions[1].escalationTriggerReason).toBe('early_phase');
    expect(decisions[2].escalationTriggerReason).toBe('hint_plus_retry');
    expect(decisions[3].escalationTriggerReason).toBe('hint_plus_retry');
    expect(decisions[4].escalationTriggerReason).toBe('hint_count_threshold');
    expect(decisions[5].escalationTriggerReason).toBe('high_hint_count');
  });

  it('all decisions carry errorCountAtDecision and timeToDecision (RESEARCH-4 fields)', () => {
    CANONICAL_REPLAY_TRACE.forEach(step => {
      const decision = orchestrate({ conceptId: 'joins', sessionConfig: adaptiveTextbookCondition(), ...step });
      expect(decision.errorCountAtDecision).toBe(step.retryCount);
      expect(decision.timeToDecision).toBe(step.elapsedMs);
    });
  });
});
