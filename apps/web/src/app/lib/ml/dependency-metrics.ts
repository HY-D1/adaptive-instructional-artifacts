/**
 * dependency-metrics.ts
 *
 * Deterministic, replayable dependency metrics for adaptive textbook experiments.
 *
 * Computes HDI-style scores using only observable event fields. All formulas are
 * explicit and versioned for reproducibility in paper figures/tables.
 *
 * Version: dependency-metrics-v1
 */

import type { InteractionEvent, HDIComponents } from '../../types';

/**
 * Comprehensive dependency metric result with explicit formulas
 */
export interface DependencyMetrics {
  /** HDI: Hint Dependency Index (0-1, higher = more dependent on help) */
  hdi: number;
  /** HDI formula version for reproducibility */
  hdiVersion: string;
  /** Component breakdown of HDI */
  components: HDIComponents;
  /** Component weights used in HDI calculation */
  componentWeights: {
    hpa: number;  // Hints Per Attempt
    aed: number;  // Average Escalation Depth
    er: number;   // Explanation Rate
    reae: number; // Repeated Error After Explanation
    iwh: number;  // Improvement Without Hint
  };
  /** Raw counts for transparency */
  rawCounts: {
    totalAttempts: number;
    totalHints: number;
    totalExplanations: number;
    totalErrors: number;
    errorsAfterExplanation: number;
    successfulProblems: number;
    successfulWithoutHints: number;
  };
  /**
   * Formula description for paper methodology section.
   * This is the canonical reference for how HDI is computed.
   */
  formulaDescription: string;
}

/**
 * Reinforcement outcome metrics for a set of traces
 */
export interface ReinforcementMetrics {
  /** Total reinforcement prompts shown */
  promptsShown: number;
  /** Total reinforcement responses recorded */
  responsesRecorded: number;
  /** Number of correct responses */
  correctCount: number;
  /** Accuracy rate (correct / responsesRecorded) */
  accuracyRate: number;
  /** Average response latency in ms */
  averageLatencyMs: number;
  /** Breakdown by delay bucket */
  byDelayBucket: Record<string, {
    promptsShown: number;
    responsesRecorded: number;
    correctCount: number;
    accuracyRate: number;
    averageLatencyMs: number;
  }>;
  /** Breakdown by source concept */
  byConcept: Record<string, {
    promptsShown: number;
    correctCount: number;
    accuracyRate: number;
  }>;
}

/**
 * Policy comparison summary for paper tables
 */
export interface PolicyComparisonSummary {
  policyId: string;
  policyName: string;
  /** Orchestration outcomes */
  outcomes: {
    explanationsShown: number;
    textbookUnitsUpserted: number;
    reinforcementPromptsShown: number;
    reinforcementCorrectCount: number;
  };
  /** Dependency metrics */
  dependency: {
    hdi: number;
    hdiComponents: HDIComponents;
  };
  /** Coverage metrics */
  coverage: {
    conceptsEncountered: number;
    conceptsMastered: number;
    coverageRate: number;
  };
  /** Efficiency metrics */
  efficiency: {
    averageTimeToSuccessMs: number;
    firstAttemptSuccessRate: number;
    errorReductionRate: number;
  };
}

// ── Component Weights (canonical for dependency-metrics-v1) ───────────────────

const COMPONENT_WEIGHTS = {
  hpa: 0.30,  // Hints Per Attempt: direct measure of hint seeking
  aed: 0.15,  // Average Escalation Depth: how deep into help ladder
  er: 0.25,   // Explanation Rate: tendency to escalate to explanations
  reae: 0.15, // Repeated Error After Explanation: help effectiveness
  iwh: 0.15,  // Improvement Without Hint: independence (inverted in HDI)
} as const;

/**
 * Get the canonical formula description for documentation.
 */
function getFormulaDescription(): string {
  return `HDI = ${COMPONENT_WEIGHTS.hpa}·HPA + ${COMPONENT_WEIGHTS.aed}·AED + ${COMPONENT_WEIGHTS.er}·ER + ${COMPONENT_WEIGHTS.reae}·REAE + ${COMPONENT_WEIGHTS.iwh}·(1−IWH)

Where:
  HPA  = min(hints / attempts, 1.0)
  AED  = clamp((avg_hint_level − 1) / 2, 0, 1)
  ER   = min(explanations / attempts, 1.0)
  REAE = errors_after_explanation / total_errors
  IWH  = successes_without_hints / total_successes

All components normalized to [0, 1]. Higher HDI indicates greater dependency on instructional support.`;
}

// ── HDI Calculation ───────────────────────────────────────────────────────────

/**
 * Calculate Hint Dependency Index from a trace of interaction events.
 *
 * FORMULA (canonical for dependency-metrics-v1):
 * ─────────────────────────────────────────────
 *
 * HDI = w₁·HPA + w₂·AED + w₃·ER + w₄·REAE + w₅·(1−IWH)
 *
 * Where:
 *   HPA  = min(hints / attempts, 1.0)
 *   AED  = clamp((avg_hint_level − 1) / 2, 0, 1)
 *   ER   = min(explanations / attempts, 1.0)
 *   REAE = errors_after_explanation / total_errors  [0 if no errors]
 *   IWH  = successes_without_hints / total_successes [0 if no successes]
 *
 * Weights (w):
 *   HPA  = 0.30
 *   AED  = 0.15
 *   ER   = 0.25
 *   REAE = 0.15
 *   IWH  = 0.15
 *
 * All components normalized to [0, 1].
 *
 * @param trace - Array of interaction events sorted by timestamp
 * @returns HDI and component breakdown with formula documentation
 */
export function calculateDependencyMetrics(
  trace: InteractionEvent[]
): DependencyMetrics {
  // Empty trace returns zero metrics
  if (trace.length === 0) {
    return {
      hdi: 0,
      hdiVersion: 'dependency-metrics-v1',
      components: { hpa: 0, aed: 0, er: 0, reae: 0, iwh: 0 },
      componentWeights: { ...COMPONENT_WEIGHTS },
      rawCounts: {
        totalAttempts: 0,
        totalHints: 0,
        totalExplanations: 0,
        totalErrors: 0,
        errorsAfterExplanation: 0,
        successfulProblems: 0,
        successfulWithoutHints: 0,
      },
      formulaDescription: getFormulaDescription(),
    };
  }

  const sorted = [...trace].sort((a, b) => a.timestamp - b.timestamp);

  // Raw counts
  const hints = sorted.filter(
    e => e.eventType === 'hint_view' || e.eventType === 'guidance_view'
  );
  const attempts = sorted.filter(e => e.eventType === 'execution');
  const explanations = sorted.filter(e => e.eventType === 'explanation_view');
  const errors = sorted.filter(e => e.eventType === 'error');

  // HPA: Hints Per Attempt
  const hpa = attempts.length > 0
    ? Math.min(hints.length / attempts.length, 1.0)
    : 0;

  // AED: Average Escalation Depth (normalize hint levels 1-3 to 0-1)
  const hintLevels = hints
    .filter(h => h.hintLevel !== undefined)
    .map(h => h.hintLevel ?? 1);
  const avgLevel = hintLevels.length > 0
    ? hintLevels.reduce((a, b) => (a ?? 0) + (b ?? 0), 0) / hintLevels.length
    : 1;
  const aed = Math.min(Math.max((avgLevel - 1) / 2, 0), 1);

  // ER: Explanation Rate
  const er = attempts.length > 0
    ? Math.min(explanations.length / attempts.length, 1.0)
    : 0;

  // REAE: Repeated Error After Explanation
  let explanationSeen = false;
  let errorsAfterExplanation = 0;
  for (const event of sorted) {
    if (event.eventType === 'explanation_view') {
      explanationSeen = true;
    } else if (event.eventType === 'error' && explanationSeen) {
      errorsAfterExplanation++;
    }
  }
  const reae = errors.length > 0 ? errorsAfterExplanation / errors.length : 0;

  // IWH: Improvement Without Hint
  const problemEvents: Record<string, InteractionEvent[]> = {};
  sorted.forEach(e => {
    if (!problemEvents[e.problemId]) problemEvents[e.problemId] = [];
    problemEvents[e.problemId].push(e);
  });

  let successfulProblems = 0;
  let successfulWithoutHints = 0;
  for (const [_, events] of Object.entries(problemEvents)) {
    const hasSuccess = events.some(e => e.eventType === 'execution' && e.successful);
    if (hasSuccess) {
      successfulProblems++;
      const hadHints = events.some(
        e => e.eventType === 'hint_request' || e.eventType === 'hint_view'
      );
      if (!hadHints) {
        successfulWithoutHints++;
      }
    }
  }
  const iwh = successfulProblems > 0 ? successfulWithoutHints / successfulProblems : 0;

  // Weighted HDI
  const hdi = Math.min(Math.max(
    hpa * COMPONENT_WEIGHTS.hpa +
    aed * COMPONENT_WEIGHTS.aed +
    er * COMPONENT_WEIGHTS.er +
    reae * COMPONENT_WEIGHTS.reae +
    (1 - iwh) * COMPONENT_WEIGHTS.iwh,
    0
  ), 1);

  return {
    hdi,
    hdiVersion: 'dependency-metrics-v1',
    components: {
      hpa,
      aed,
      er,
      reae,
      iwh,
    },
    componentWeights: { ...COMPONENT_WEIGHTS },
    rawCounts: {
      totalAttempts: attempts.length,
      totalHints: hints.length,
      totalExplanations: explanations.length,
      totalErrors: errors.length,
      errorsAfterExplanation,
      successfulProblems,
      successfulWithoutHints,
    },
    formulaDescription: getFormulaDescription(),
  };
}

/**
 * Calculate reinforcement outcome metrics from a trace.
 *
 * @param trace - Array of interaction events
 * @returns Reinforcement metrics with bucket/concept breakdowns
 */
export function calculateReinforcementMetrics(
  trace: InteractionEvent[]
): ReinforcementMetrics {
  const prompts = trace.filter(e => e.eventType === 'reinforcement_prompt_shown');
  const responses = trace.filter(e => e.eventType === 'reinforcement_response');

  // Aggregate latency
  const latencies = responses
    .map(r => r.reinforcementLatencyMs)
    .filter((ms): ms is number => ms !== undefined && !isNaN(ms));
  const averageLatencyMs = latencies.length > 0
    ? latencies.reduce((a, b) => a + b, 0) / latencies.length
    : 0;

  // By delay bucket
  const bucketNames = ['immediate', '3d', '7d', '14d', '21d'] as const;
  const byDelayBucket: Record<string, {
    promptsShown: number;
    responsesRecorded: number;
    correctCount: number;
    accuracyRate: number;
    averageLatencyMs: number;
  }> = {};

  for (const bucket of bucketNames) {
    const bucketPrompts = prompts.filter(p => p.delayBucket === bucket);
    const bucketResponses = responses.filter(r => r.delayBucket === bucket);
    const bucketCorrect = bucketResponses.filter(r => r.reinforcementCorrect ?? r.isCorrect).length;
    const bucketLatencies = bucketResponses
      .map(r => r.reinforcementLatencyMs)
      .filter((ms): ms is number => ms !== undefined && !isNaN(ms));

    byDelayBucket[bucket] = {
      promptsShown: bucketPrompts.length,
      responsesRecorded: bucketResponses.length,
      correctCount: bucketCorrect,
      accuracyRate: bucketResponses.length > 0 ? bucketCorrect / bucketResponses.length : 0,
      averageLatencyMs: bucketLatencies.length > 0
        ? bucketLatencies.reduce((a, b) => a + b, 0) / bucketLatencies.length
        : 0,
    };
  }

  // By source concept
  const conceptStats: Record<string, { prompts: number; correct: number }> = {};
  for (const response of responses) {
    const conceptId = response.sourceConceptId || 'unknown';
    if (!conceptStats[conceptId]) {
      conceptStats[conceptId] = { prompts: 0, correct: 0 };
    }
    conceptStats[conceptId].prompts++;
    if (response.reinforcementCorrect ?? response.isCorrect) {
      conceptStats[conceptId].correct++;
    }
  }
  // Add prompts without responses
  for (const prompt of prompts) {
    const conceptId = prompt.sourceConceptId || 'unknown';
    if (!conceptStats[conceptId]) {
      conceptStats[conceptId] = { prompts: 0, correct: 0 };
    }
    // Only count if not already counted from responses
    const hasResponse = responses.some(
      r => r.sourceUnitId === prompt.sourceUnitId && r.sourceConceptId === conceptId
    );
    if (!hasResponse) {
      conceptStats[conceptId].prompts++;
    }
  }

  const byConcept: Record<string, { promptsShown: number; correctCount: number; accuracyRate: number }> = {};
  for (const [conceptId, stats] of Object.entries(conceptStats)) {
    byConcept[conceptId] = {
      promptsShown: stats.prompts,
      correctCount: stats.correct,
      accuracyRate: stats.prompts > 0 ? stats.correct / stats.prompts : 0,
    };
  }

  const correctCount = responses.filter(r => r.reinforcementCorrect ?? r.isCorrect).length;

  return {
    promptsShown: prompts.length,
    responsesRecorded: responses.length,
    correctCount,
    accuracyRate: responses.length > 0 ? correctCount / responses.length : 0,
    averageLatencyMs,
    byDelayBucket,
    byConcept,
  };
}

/**
 * Compare multiple policies on the same trace for replay analysis.
 *
 * @param trace - The canonical trace to replay
 * @param policyResults - Map of policy ID to their event traces
 * @returns Comparison summaries for each policy
 */
export function comparePoliciesOnTrace(
  trace: InteractionEvent[],
  policyResults: Record<string, InteractionEvent[]>
): PolicyComparisonSummary[] {
  const baseConcepts = new Set<string>();
  trace.forEach(e => {
    if (e.conceptIds) e.conceptIds.forEach(c => baseConcepts.add(c));
    if (e.corpusConceptId) baseConcepts.add(e.corpusConceptId);
  });

  return Object.entries(policyResults).map(([policyId, policyTrace]) => {
    const depMetrics = calculateDependencyMetrics(policyTrace);
    const reinMetrics = calculateReinforcementMetrics(policyTrace);

    // Count concepts encountered in this policy trace
    const policyConcepts = new Set<string>();
    const masteredConcepts = new Set<string>();
    policyTrace.forEach(e => {
      if (e.conceptIds) e.conceptIds.forEach(c => policyConcepts.add(c));
      if (e.corpusConceptId) policyConcepts.add(e.corpusConceptId);
      if (e.eventType === 'execution' && e.successful) {
        if (e.conceptIds) e.conceptIds.forEach(c => masteredConcepts.add(c));
        if (e.corpusConceptId) masteredConcepts.add(e.corpusConceptId);
      }
    });

    // Calculate efficiency metrics
    const problems: Record<string, { solved: boolean; timeSpent: number; firstAttemptSuccess: boolean }> = {};
    const problemEvents: Record<string, InteractionEvent[]> = {};
    policyTrace.forEach(e => {
      if (!problemEvents[e.problemId]) problemEvents[e.problemId] = [];
      problemEvents[e.problemId].push(e);
    });

    for (const [pid, events] of Object.entries(problemEvents)) {
      const sorted = events.sort((a, b) => a.timestamp - b.timestamp);
      const solved = events.some(e => e.eventType === 'execution' && e.successful);
      const timeSpent = sorted.length > 0 ? sorted[sorted.length - 1].timestamp - sorted[0].timestamp : 0;
      const firstExecIdx = events.findIndex(e => e.eventType === 'execution');
      const firstSuccessIdx = events.findIndex(e => e.eventType === 'execution' && e.successful);
      problems[pid] = {
        solved,
        timeSpent,
        firstAttemptSuccess: firstSuccessIdx === firstExecIdx && firstExecIdx >= 0,
      };
    }

    const problemList = Object.values(problems);
    const solvedProblems = problemList.filter(p => p.solved);
    const avgTimeToSuccess = solvedProblems.length > 0
      ? solvedProblems.reduce((sum, p) => sum + p.timeSpent, 0) / solvedProblems.length
      : 0;
    const firstAttemptSuccessRate = problemList.length > 0
      ? problemList.filter(p => p.firstAttemptSuccess).length / problemList.length
      : 0;

    // Error reduction: first half vs second half
    const sorted = [...policyTrace].sort((a, b) => a.timestamp - b.timestamp);
    const mid = Math.floor(sorted.length / 2);
    const firstHalfErrors = sorted.slice(0, mid).filter(e => e.eventType === 'error').length;
    const secondHalfErrors = sorted.slice(mid).filter(e => e.eventType === 'error').length;
    const errorReductionRate = firstHalfErrors > 0
      ? Math.max(0, (firstHalfErrors - secondHalfErrors) / firstHalfErrors)
      : 0;

    return {
      policyId,
      policyName: policyId, // Caller should map to friendly name
      outcomes: {
        explanationsShown: policyTrace.filter(e => e.eventType === 'explanation_view').length,
        textbookUnitsUpserted: policyTrace.filter(e => e.eventType === 'textbook_unit_upsert').length,
        reinforcementPromptsShown: reinMetrics.promptsShown,
        reinforcementCorrectCount: reinMetrics.correctCount,
      },
      dependency: {
        hdi: depMetrics.hdi,
        hdiComponents: depMetrics.components,
      },
      coverage: {
        conceptsEncountered: policyConcepts.size,
        conceptsMastered: masteredConcepts.size,
        coverageRate: policyConcepts.size > 0 ? masteredConcepts.size / policyConcepts.size : 0,
      },
      efficiency: {
        averageTimeToSuccessMs: avgTimeToSuccess,
        firstAttemptSuccessRate,
        errorReductionRate,
      },
    };
  });
}

/**
 * Generate a machine-readable summary artifact suitable for paper tables.
 *
 * @param comparisons - Policy comparison results
 * @returns JSON-serializable summary object
 */
export function generatePaperSummary(
  comparisons: PolicyComparisonSummary[]
): Record<string, unknown> {
  const version = 'dependency-metrics-v1';
  const generatedAt = new Date().toISOString();

  // Create table-friendly rows
  const tableRows = comparisons.map(c => ({
    policy: c.policyId,
    // Outcomes
    explanations: c.outcomes.explanationsShown,
    textbook_units: c.outcomes.textbookUnitsUpserted,
    reinforcement_prompts: c.outcomes.reinforcementPromptsShown,
    reinforcement_correct: c.outcomes.reinforcementCorrectCount,
    reinforcement_accuracy: c.outcomes.reinforcementPromptsShown > 0
      ? c.outcomes.reinforcementCorrectCount / c.outcomes.reinforcementPromptsShown
      : 0,
    // Dependency
    hdi: c.dependency.hdi,
    hdi_hpa: c.dependency.hdiComponents.hpa,
    hdi_aed: c.dependency.hdiComponents.aed,
    hdi_er: c.dependency.hdiComponents.er,
    hdi_reae: c.dependency.hdiComponents.reae,
    hdi_iwh: c.dependency.hdiComponents.iwh,
    // Coverage
    concepts_encountered: c.coverage.conceptsEncountered,
    concepts_mastered: c.coverage.conceptsMastered,
    coverage_rate: c.coverage.coverageRate,
    // Efficiency
    time_to_success_ms: c.efficiency.averageTimeToSuccessMs,
    first_attempt_success_rate: c.efficiency.firstAttemptSuccessRate,
    error_reduction_rate: c.efficiency.errorReductionRate,
  }));

  // HDI formula for methods section
  const formula = `HDI = ${COMPONENT_WEIGHTS.hpa}*HPA + ${COMPONENT_WEIGHTS.aed}*AED + ${COMPONENT_WEIGHTS.er}*ER + ${COMPONENT_WEIGHTS.reae}*REAE + ${COMPONENT_WEIGHTS.iwh}*(1-IWH)`;

  return {
    version,
    generatedAt,
    formula,
    componentWeights: COMPONENT_WEIGHTS,
    policies: tableRows,
  };
}

/**
 * Convert policy comparison to CSV format for paper tables.
 *
 * @param comparisons - Policy comparison results
 * @returns CSV string
 */
export function comparisonsToCsv(comparisons: PolicyComparisonSummary[]): string {
  const headers = [
    'policy_id',
    'explanations_shown',
    'textbook_units_upserted',
    'reinforcement_prompts_shown',
    'reinforcement_correct_count',
    'reinforcement_accuracy',
    'hdi',
    'hdi_hpa',
    'hdi_aed',
    'hdi_er',
    'hdi_reae',
    'hdi_iwh',
    'concepts_encountered',
    'concepts_mastered',
    'coverage_rate',
    'avg_time_to_success_ms',
    'first_attempt_success_rate',
    'error_reduction_rate',
  ];

  const rows = comparisons.map(c => [
    c.policyId,
    c.outcomes.explanationsShown,
    c.outcomes.textbookUnitsUpserted,
    c.outcomes.reinforcementPromptsShown,
    c.outcomes.reinforcementCorrectCount,
    (c.outcomes.reinforcementPromptsShown > 0
      ? c.outcomes.reinforcementCorrectCount / c.outcomes.reinforcementPromptsShown
      : 0).toFixed(4),
    c.dependency.hdi.toFixed(4),
    c.dependency.hdiComponents.hpa.toFixed(4),
    c.dependency.hdiComponents.aed.toFixed(4),
    c.dependency.hdiComponents.er.toFixed(4),
    c.dependency.hdiComponents.reae.toFixed(4),
    c.dependency.hdiComponents.iwh.toFixed(4),
    c.coverage.conceptsEncountered,
    c.coverage.conceptsMastered,
    c.coverage.coverageRate.toFixed(4),
    Math.round(c.efficiency.averageTimeToSuccessMs),
    c.efficiency.firstAttemptSuccessRate.toFixed(4),
    c.efficiency.errorReductionRate.toFixed(4),
  ].join(','));

  return [headers.join(','), ...rows].join('\n');
}
