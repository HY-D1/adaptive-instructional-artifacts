/**
 * dependency-metrics.test.ts
 *
 * Tests for deterministic dependency metrics with explicit formulas.
 *
 * These tests verify:
 * 1. HDI components are calculated correctly per the canonical formula
 * 2. Metrics are deterministic (same trace → same result)
 * 3. Raw counts are transparent and verifiable
 * 4. Reinforcement metrics handle delay buckets and concept tracking
 */

import { describe, it, expect } from 'vitest';
import {
  calculateDependencyMetrics,
  calculateReinforcementMetrics,
  comparePoliciesOnTrace,
  generatePaperSummary,
  comparisonsToCsv,
  type DependencyMetrics,
} from './dependency-metrics';
import type { InteractionEvent } from '../../types';

// ── Test Fixtures ─────────────────────────────────────────────────────────────

const BASE_TIMESTAMP = 1_000_000;

function makeEvent(
  eventType: InteractionEvent['eventType'],
  overrides: Partial<InteractionEvent> = {}
): InteractionEvent {
  return {
    id: `test-${Math.random().toString(36).slice(2)}`,
    learnerId: 'learner-1',
    timestamp: BASE_TIMESTAMP,
    eventType,
    problemId: 'problem-1',
    ...overrides,
  } as InteractionEvent;
}

// Canonical 6-step trace (matches textbook-orchestrator.test.ts)
const CANONICAL_TRACE: InteractionEvent[] = [
  { ...makeEvent('error', { timestamp: BASE_TIMESTAMP, problemId: 'p1' }), retryCount: 1 },
  { ...makeEvent('error', { timestamp: BASE_TIMESTAMP + 15_000, problemId: 'p1' }), retryCount: 2 },
  { ...makeEvent('hint_view', { timestamp: BASE_TIMESTAMP + 20_000, problemId: 'p1', hintLevel: 1 }) },
  { ...makeEvent('error', { timestamp: BASE_TIMESTAMP + 30_000, problemId: 'p1' }), retryCount: 3 },
  { ...makeEvent('explanation_view', { timestamp: BASE_TIMESTAMP + 35_000, problemId: 'p1' }) },
  { ...makeEvent('error', { timestamp: BASE_TIMESTAMP + 90_000, problemId: 'p1' }), retryCount: 4 },
  { ...makeEvent('hint_view', { timestamp: BASE_TIMESTAMP + 95_000, problemId: 'p1', hintLevel: 2 }) },
  { ...makeEvent('hint_view', { timestamp: BASE_TIMESTAMP + 100_000, problemId: 'p1', hintLevel: 3 }) },
  { ...makeEvent('textbook_unit_upsert', { timestamp: BASE_TIMESTAMP + 120_000, problemId: 'p1', corpusConceptId: 'dbms-ramakrishnan-3rd-edition/joins' }) },
  { ...makeEvent('execution', { timestamp: BASE_TIMESTAMP + 180_000, problemId: 'p1', successful: true }) },
];

// High-dependency trace (lots of hints, explanations, errors after explanation)
const HIGH_DEPENDENCY_TRACE: InteractionEvent[] = [
  { ...makeEvent('error', { timestamp: BASE_TIMESTAMP, problemId: 'p1' }) },
  { ...makeEvent('hint_view', { timestamp: BASE_TIMESTAMP + 5_000, problemId: 'p1', hintLevel: 1 }) },
  { ...makeEvent('error', { timestamp: BASE_TIMESTAMP + 10_000, problemId: 'p1' }) },
  { ...makeEvent('hint_view', { timestamp: BASE_TIMESTAMP + 15_000, problemId: 'p1', hintLevel: 2 }) },
  { ...makeEvent('explanation_view', { timestamp: BASE_TIMESTAMP + 20_000, problemId: 'p1' }) },
  { ...makeEvent('error', { timestamp: BASE_TIMESTAMP + 25_000, problemId: 'p1' }) },
  { ...makeEvent('hint_view', { timestamp: BASE_TIMESTAMP + 30_000, problemId: 'p1', hintLevel: 3 }) },
  { ...makeEvent('error', { timestamp: BASE_TIMESTAMP + 35_000, problemId: 'p1' }) },
  { ...makeEvent('explanation_view', { timestamp: BASE_TIMESTAMP + 40_000, problemId: 'p1' }) },
  { ...makeEvent('error', { timestamp: BASE_TIMESTAMP + 45_000, problemId: 'p1' }) },
  { ...makeEvent('execution', { timestamp: BASE_TIMESTAMP + 60_000, problemId: 'p1', successful: true }) },
];

// Independent success trace (success without hints)
const INDEPENDENT_TRACE: InteractionEvent[] = [
  { ...makeEvent('execution', { timestamp: BASE_TIMESTAMP, problemId: 'p1', successful: true }) },
  { ...makeEvent('execution', { timestamp: BASE_TIMESTAMP + 30_000, problemId: 'p2', successful: true }) },
  { ...makeEvent('execution', { timestamp: BASE_TIMESTAMP + 60_000, problemId: 'p3', successful: true }) },
];

// Reinforcement trace with delay buckets
const REINFORCEMENT_TRACE: InteractionEvent[] = [
  { ...makeEvent('textbook_unit_upsert', { timestamp: BASE_TIMESTAMP, problemId: 'p1', unitId: 'unit-1', corpusConceptId: 'concept-a' }) },
  { ...makeEvent('reinforcement_prompt_shown', { timestamp: BASE_TIMESTAMP + 1000, problemId: 'p1', sourceUnitId: 'unit-1', sourceConceptId: 'concept-a', delayBucket: 'immediate' }) },
  { ...makeEvent('reinforcement_response', { timestamp: BASE_TIMESTAMP + 5000, problemId: 'p1', sourceUnitId: 'unit-1', sourceConceptId: 'concept-a', delayBucket: 'immediate', reinforcementCorrect: true, reinforcementLatencyMs: 4000 }) },
  { ...makeEvent('reinforcement_prompt_shown', { timestamp: BASE_TIMESTAMP + 259_200_000, problemId: 'p2', sourceUnitId: 'unit-1', sourceConceptId: 'concept-a', delayBucket: '3d' }) },
  { ...makeEvent('reinforcement_response', { timestamp: BASE_TIMESTAMP + 259_205_000, problemId: 'p2', sourceUnitId: 'unit-1', sourceConceptId: 'concept-a', delayBucket: '3d', reinforcementCorrect: false, reinforcementLatencyMs: 5000 }) },
];

// ── HDI Component Tests ───────────────────────────────────────────────────────

describe('calculateDependencyMetrics - Component Tests', () => {
  it('HPA: calculates hints per attempt correctly', () => {
    const trace: InteractionEvent[] = [
      makeEvent('execution', { successful: true }),
      makeEvent('hint_view', { hintLevel: 1 }),
      makeEvent('execution'),
      makeEvent('hint_view', { hintLevel: 1 }),
      makeEvent('hint_view', { hintLevel: 2 }),
      makeEvent('execution', { successful: true }),
    ];
    const metrics = calculateDependencyMetrics(trace);
    // 3 hints / 3 attempts = 1.0, clamped to 1.0
    expect(metrics.components.hpa).toBe(1.0);
    expect(metrics.rawCounts.totalHints).toBe(3);
    expect(metrics.rawCounts.totalAttempts).toBe(3);
  });

  it('AED: normalizes average hint level to [0, 1]', () => {
    const trace: InteractionEvent[] = [
      makeEvent('hint_view', { hintLevel: 1 }),
      makeEvent('hint_view', { hintLevel: 2 }),
      makeEvent('hint_view', { hintLevel: 3 }),
    ];
    const metrics = calculateDependencyMetrics(trace);
    // avg level = 2, normalized: (2-1)/2 = 0.5
    expect(metrics.components.aed).toBe(0.5);
  });

  it('ER: calculates explanation rate correctly', () => {
    const trace: InteractionEvent[] = [
      makeEvent('execution'),
      makeEvent('explanation_view'),
      makeEvent('execution'),
      makeEvent('explanation_view'),
    ];
    const metrics = calculateDependencyMetrics(trace);
    // 2 explanations / 2 attempts = 1.0, clamped to 1.0
    expect(metrics.components.er).toBe(1.0);
  });

  it('REAE: tracks errors after explanation', () => {
    const trace: InteractionEvent[] = [
      makeEvent('error'),                     // error 1 (before explanation)
      makeEvent('explanation_view'),          // explanation seen
      makeEvent('error'),                     // error 2 (after explanation)
      makeEvent('error'),                     // error 3 (after explanation)
    ];
    const metrics = calculateDependencyMetrics(trace);
    // 2 errors after explanation / 3 total errors
    expect(metrics.components.reae).toBeCloseTo(2 / 3, 5);
    expect(metrics.rawCounts.errorsAfterExplanation).toBe(2);
  });

  it('IWH: measures independent success rate', () => {
    const trace: InteractionEvent[] = [
      makeEvent('execution', { problemId: 'p1', successful: true }),  // success without hints
      makeEvent('execution', { problemId: 'p2', successful: true }),  // success without hints
      makeEvent('hint_view', { problemId: 'p3', hintLevel: 1 }),
      makeEvent('execution', { problemId: 'p3', successful: true }),  // success with hints
    ];
    const metrics = calculateDependencyMetrics(trace);
    // 2 successes without hints / 3 total successes
    expect(metrics.components.iwh).toBeCloseTo(2 / 3, 5);
    expect(metrics.rawCounts.successfulWithoutHints).toBe(2);
  });
});

// ── HDI Integration Tests ─────────────────────────────────────────────────────

describe('calculateDependencyMetrics - HDI Integration', () => {
  it('produces deterministic results for same trace', () => {
    const m1 = calculateDependencyMetrics(CANONICAL_TRACE);
    const m2 = calculateDependencyMetrics(CANONICAL_TRACE);
    expect(m1.hdi).toBe(m2.hdi);
    expect(m1.components).toEqual(m2.components);
  });

  it('high dependency trace produces higher HDI than independent trace', () => {
    const highDep = calculateDependencyMetrics(HIGH_DEPENDENCY_TRACE);
    const independent = calculateDependencyMetrics(INDEPENDENT_TRACE);
    expect(highDep.hdi).toBeGreaterThan(independent.hdi);
    expect(highDep.hdi).toBeGreaterThan(0.5);
    expect(independent.hdi).toBeLessThan(0.5);
  });

  it('includes explicit formula description', () => {
    const metrics = calculateDependencyMetrics(CANONICAL_TRACE);
    expect(metrics.formulaDescription).toContain('HDI =');
    expect(metrics.formulaDescription).toContain('HPA');
    expect(metrics.formulaDescription).toContain('AED');
    expect(metrics.formulaDescription).toContain('ER');
    expect(metrics.formulaDescription).toContain('REAE');
    expect(metrics.formulaDescription).toContain('IWH');
  });

  it('includes version identifier for reproducibility', () => {
    const metrics = calculateDependencyMetrics(CANONICAL_TRACE);
    expect(metrics.hdiVersion).toBe('dependency-metrics-v1');
  });

  it('includes component weights for transparency', () => {
    const metrics = calculateDependencyMetrics(CANONICAL_TRACE);
    expect(metrics.componentWeights.hpa).toBe(0.30);
    expect(metrics.componentWeights.aed).toBe(0.15);
    expect(metrics.componentWeights.er).toBe(0.25);
    expect(metrics.componentWeights.reae).toBe(0.15);
    expect(metrics.componentWeights.iwh).toBe(0.15);
  });

  it('HDI is bounded to [0, 1]', () => {
    const metrics = calculateDependencyMetrics(CANONICAL_TRACE);
    expect(metrics.hdi).toBeGreaterThanOrEqual(0);
    expect(metrics.hdi).toBeLessThanOrEqual(1);
  });

  it('empty trace produces zero metrics', () => {
    const metrics = calculateDependencyMetrics([]);
    expect(metrics.hdi).toBe(0);
    expect(metrics.components.hpa).toBe(0);
    expect(metrics.components.aed).toBe(0);
    expect(metrics.components.er).toBe(0);
    expect(metrics.components.reae).toBe(0);
    expect(metrics.components.iwh).toBe(0);
  });
});

// ── Reinforcement Metrics Tests ───────────────────────────────────────────────

describe('calculateReinforcementMetrics', () => {
  it('counts prompts and responses correctly', () => {
    const metrics = calculateReinforcementMetrics(REINFORCEMENT_TRACE);
    expect(metrics.promptsShown).toBe(2);
    expect(metrics.responsesRecorded).toBe(2);
    expect(metrics.correctCount).toBe(1);
    expect(metrics.accuracyRate).toBe(0.5);
  });

  it('calculates average latency correctly', () => {
    const metrics = calculateReinforcementMetrics(REINFORCEMENT_TRACE);
    // (4000 + 5000) / 2 = 4500
    expect(metrics.averageLatencyMs).toBe(4500);
  });

  it('breaks down by delay bucket', () => {
    const metrics = calculateReinforcementMetrics(REINFORCEMENT_TRACE);
    expect(metrics.byDelayBucket.immediate.promptsShown).toBe(1);
    expect(metrics.byDelayBucket.immediate.responsesRecorded).toBe(1);
    expect(metrics.byDelayBucket.immediate.correctCount).toBe(1);
    expect(metrics.byDelayBucket['3d'].promptsShown).toBe(1);
    expect(metrics.byDelayBucket['3d'].correctCount).toBe(0);
  });

  it('breaks down by source concept', () => {
    const metrics = calculateReinforcementMetrics(REINFORCEMENT_TRACE);
    expect(metrics.byConcept['concept-a'].promptsShown).toBe(2);
    expect(metrics.byConcept['concept-a'].correctCount).toBe(1);
    expect(metrics.byConcept['concept-a'].accuracyRate).toBe(0.5);
  });

  it('handles empty trace gracefully', () => {
    const metrics = calculateReinforcementMetrics([]);
    expect(metrics.promptsShown).toBe(0);
    expect(metrics.responsesRecorded).toBe(0);
    expect(metrics.accuracyRate).toBe(0);
    expect(metrics.averageLatencyMs).toBe(0);
  });
});

// ── Policy Comparison Tests ───────────────────────────────────────────────────

describe('comparePoliciesOnTrace', () => {
  it('compares multiple policies on same base trace', () => {
    const policyResults = {
      conservative: CANONICAL_TRACE.filter(e => e.eventType !== 'textbook_unit_upsert'),
      adaptive: CANONICAL_TRACE,
    };

    const comparisons = comparePoliciesOnTrace(CANONICAL_TRACE, policyResults);
    expect(comparisons).toHaveLength(2);

    const conservative = comparisons.find(c => c.policyId === 'conservative')!;
    const adaptive = comparisons.find(c => c.policyId === 'adaptive')!;

    expect(conservative.outcomes.textbookUnitsUpserted).toBe(0);
    expect(adaptive.outcomes.textbookUnitsUpserted).toBe(1);
  });

  it('includes all required comparison fields', () => {
    const policyResults = { adaptive: CANONICAL_TRACE };
    const comparisons = comparePoliciesOnTrace(CANONICAL_TRACE, policyResults);
    const comp = comparisons[0];

    expect(comp.policyId).toBeDefined();
    expect(comp.outcomes.explanationsShown).toBeDefined();
    expect(comp.outcomes.textbookUnitsUpserted).toBeDefined();
    expect(comp.outcomes.reinforcementPromptsShown).toBeDefined();
    expect(comp.dependency.hdi).toBeDefined();
    expect(comp.dependency.hdiComponents).toBeDefined();
    expect(comp.coverage.conceptsEncountered).toBeDefined();
    expect(comp.efficiency.averageTimeToSuccessMs).toBeDefined();
  });
});

// ── Paper Summary Tests ───────────────────────────────────────────────────────

describe('generatePaperSummary', () => {
  it('produces valid JSON-serializable output', () => {
    const comparisons: PolicyComparisonSummary[] = [
      {
        policyId: 'conservative',
        policyName: 'Conservative',
        outcomes: { explanationsShown: 0, textbookUnitsUpserted: 0, reinforcementPromptsShown: 0, reinforcementCorrectCount: 0 },
        dependency: { hdi: 0.3, hdiComponents: { hpa: 0.2, aed: 0.1, er: 0.3, reae: 0.2, iwh: 0.8 } },
        coverage: { conceptsEncountered: 5, conceptsMastered: 3, coverageRate: 0.6 },
        efficiency: { averageTimeToSuccessMs: 60000, firstAttemptSuccessRate: 0.5, errorReductionRate: 0.3 },
      },
      {
        policyId: 'adaptive',
        policyName: 'Adaptive',
        outcomes: { explanationsShown: 2, textbookUnitsUpserted: 1, reinforcementPromptsShown: 1, reinforcementCorrectCount: 1 },
        dependency: { hdi: 0.5, hdiComponents: { hpa: 0.4, aed: 0.2, er: 0.4, reae: 0.3, iwh: 0.6 } },
        coverage: { conceptsEncountered: 5, conceptsMastered: 4, coverageRate: 0.8 },
        efficiency: { averageTimeToSuccessMs: 45000, firstAttemptSuccessRate: 0.6, errorReductionRate: 0.4 },
      },
    ];

    const summary = generatePaperSummary(comparisons);

    expect(summary.version).toBe('dependency-metrics-v1');
    expect(summary.generatedAt).toBeDefined();
    expect(summary.formula).toContain('HDI =');
    expect(summary.componentWeights).toBeDefined();
    expect(summary.policies).toHaveLength(2);
    expect(summary.policies[0]).toHaveProperty('policy');
    expect(summary.policies[0]).toHaveProperty('explanations');
    expect(summary.policies[0]).toHaveProperty('hdi');
  });
});

describe('comparisonsToCsv', () => {
  it('produces valid CSV with headers', () => {
    const comparisons: PolicyComparisonSummary[] = [
      {
        policyId: 'test-policy',
        policyName: 'Test',
        outcomes: { explanationsShown: 1, textbookUnitsUpserted: 2, reinforcementPromptsShown: 3, reinforcementCorrectCount: 2 },
        dependency: { hdi: 0.5, hdiComponents: { hpa: 0.3, aed: 0.2, er: 0.3, reae: 0.1, iwh: 0.7 } },
        coverage: { conceptsEncountered: 5, conceptsMastered: 4, coverageRate: 0.8 },
        efficiency: { averageTimeToSuccessMs: 50000, firstAttemptSuccessRate: 0.6, errorReductionRate: 0.4 },
      },
    ];

    const csv = comparisonsToCsv(comparisons);
    const lines = csv.split('\n');

    expect(lines[0]).toContain('policy_id');
    expect(lines[0]).toContain('explanations_shown');
    expect(lines[0]).toContain('hdi');
    expect(lines[1]).toContain('test-policy');
  });
});

// ── Replay Fixture Tests ──────────────────────────────────────────────────────

describe('canonical replay fixture: 3-policy comparison', () => {
  const TRACE = [
    { retryCount: 1, hintCount: 0, elapsedMs: 0 },
    { retryCount: 2, hintCount: 0, elapsedMs: 15_000 },
    { retryCount: 2, hintCount: 1, elapsedMs: 20_000 },
    { retryCount: 3, hintCount: 1, elapsedMs: 30_000 },
    { retryCount: 4, hintCount: 3, elapsedMs: 90_000 },
    { retryCount: 7, hintCount: 6, elapsedMs: 310_000 },
  ];

  function buildPolicyTrace(
    baseTrace: typeof TRACE,
    policy: 'conservative' | 'adaptive' | 'explanation_first'
  ): InteractionEvent[] {
    const events: InteractionEvent[] = [];
    let ts = BASE_TIMESTAMP;

    baseTrace.forEach((step, idx) => {
      ts = BASE_TIMESTAMP + step.elapsedMs;

      // Always log error/attempt
      events.push({
        ...makeEvent('error', { timestamp: ts, problemId: 'joins-problem' }),
        retryCount: step.retryCount,
        hintCount: step.hintCount,
        corpusConceptId: 'dbms-ramakrishnan-3rd-edition/joins',
      });

      // Policy-specific interventions
      if (policy === 'conservative') {
        // Hints only, no escalation
        if (step.hintCount > 0) {
          events.push({
            ...makeEvent('hint_view', { timestamp: ts + 100, problemId: 'joins-problem', hintLevel: Math.min(step.hintCount, 3) as 1 | 2 | 3 }),
            corpusConceptId: 'dbms-ramakrishnan-3rd-edition/joins',
          });
        }
      } else if (policy === 'adaptive') {
        // Adaptive escalation
        if (step.hintCount >= 1 && step.retryCount >= 2) {
          events.push({
            ...makeEvent('explanation_view', { timestamp: ts + 200, problemId: 'joins-problem' }),
            corpusConceptId: 'dbms-ramakrishnan-3rd-edition/joins',
          });
        }
        if (step.hintCount >= 3 || step.retryCount >= 4) {
          events.push({
            ...makeEvent('textbook_unit_upsert', { timestamp: ts + 300, problemId: 'joins-problem' }),
            corpusConceptId: 'dbms-ramakrishnan-3rd-edition/joins',
          });
        }
      } else if (policy === 'explanation_first') {
        // Skip hints, go to explanation immediately
        if (step.retryCount >= 1) {
          events.push({
            ...makeEvent('explanation_view', { timestamp: ts + 200, problemId: 'joins-problem' }),
            corpusConceptId: 'dbms-ramakrishnan-3rd-edition/joins',
          });
        }
      }
    });

    // Add successful execution at end for all policies
    events.push({
      ...makeEvent('execution', {
        timestamp: ts + 500_000,
        problemId: 'joins-problem',
        successful: true,
      }),
      corpusConceptId: 'dbms-ramakrishnan-3rd-edition/joins',
    });

    // Add reinforcement for adaptive policy only
    if (policy === 'adaptive') {
      events.push({
        ...makeEvent('reinforcement_prompt_shown', {
          timestamp: ts + 86400000,
          problemId: 'joins-problem',
          sourceUnitId: 'unit-1',
          sourceConceptId: 'dbms-ramakrishnan-3rd-edition/joins',
          delayBucket: '3d',
        }),
        corpusConceptId: 'dbms-ramakrishnan-3rd-edition/joins',
      });
      events.push({
        ...makeEvent('reinforcement_response', {
          timestamp: ts + 86405000,
          problemId: 'joins-problem',
          sourceUnitId: 'unit-1',
          sourceConceptId: 'dbms-ramakrishnan-3rd-edition/joins',
          delayBucket: '3d',
          reinforcementCorrect: true,
          reinforcementLatencyMs: 5000,
        }),
        corpusConceptId: 'dbms-ramakrishnan-3rd-edition/joins',
      });
    }

    return events.sort((a, b) => a.timestamp - b.timestamp);
  }

  const conservativeTrace = buildPolicyTrace(TRACE, 'conservative');
  const adaptiveTrace = buildPolicyTrace(TRACE, 'adaptive');
  const explanationFirstTrace = buildPolicyTrace(TRACE, 'explanation_first');

  it('produces different HDI scores for different policies', () => {
    const conservativeMetrics = calculateDependencyMetrics(conservativeTrace);
    const adaptiveMetrics = calculateDependencyMetrics(adaptiveTrace);
    const explanationFirstMetrics = calculateDependencyMetrics(explanationFirstTrace);

    // Explanation-first should have higher ER (explanation rate)
    expect(explanationFirstMetrics.components.er).toBeGreaterThan(conservativeMetrics.components.er);

    // Conservative should have higher HPA (more hints per attempt)
    expect(conservativeMetrics.components.hpa).toBeGreaterThan(explanationFirstMetrics.components.hpa);
  });

  it('adaptive policy shows reinforcement prompts', () => {
    const adaptiveReinforcement = calculateReinforcementMetrics(adaptiveTrace);
    const conservativeReinforcement = calculateReinforcementMetrics(conservativeTrace);

    expect(adaptiveReinforcement.promptsShown).toBeGreaterThan(0);
    expect(conservativeReinforcement.promptsShown).toBe(0);
  });

  it('comparison output includes all 3 policies', () => {
    const policyResults = {
      conservative: conservativeTrace,
      adaptive: adaptiveTrace,
      explanation_first: explanationFirstTrace,
    };

    const comparisons = comparePoliciesOnTrace(conservativeTrace, policyResults);
    expect(comparisons).toHaveLength(3);

    const policyIds = comparisons.map(c => c.policyId);
    expect(policyIds).toContain('conservative');
    expect(policyIds).toContain('adaptive');
    expect(policyIds).toContain('explanation_first');
  });
});
