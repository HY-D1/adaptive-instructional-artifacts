#!/usr/bin/env node
/**
 * Replay Paper Tables Generator
 *
 * Generates machine-readable JSON and CSV summaries suitable for paper
 * figures and tables. Compares multiple policies on the same trace and
 * outputs dependency metrics, reinforcement outcomes, and coverage scores.
 *
 * This script is the canonical replay command for the Week 6 experiment
 * pipeline with delayed reinforcement and dependency metrics.
 *
 * Usage:
 *   node scripts/replay-paper-tables.mjs [options]
 *
 * Options:
 *   --output-dir <path>   Output directory (default: dist/replay/paper-tables)
 *   --format <format>     Output format: json, csv, both (default: both)
 *   --help, -h            Show help
 *
 * Output Artifacts:
 *   - policy-comparison.json    Full machine-readable summary
 *   - policy-comparison.csv     Table-friendly CSV format
 *   - hdi-components.json       HDI breakdown by policy
 *   - reinforcement-outcomes.csv Reinforcement metrics by bucket
 *   - experiment-manifest.json  Metadata and checksums
 *
 * @version replay-paper-tables-v1
 */

import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import {
  orchestrate,
  staticHintModeCondition,
  adaptiveTextbookCondition,
  explanationFirstCondition,
} from './textbook-orchestrator-esm.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..');

const DEFAULT_OUTPUT_DIR = path.join(REPO_ROOT, 'dist/replay/paper-tables');
const REPLAY_VERSION = 'replay-paper-tables-v1';

// ═══════════════════════════════════════════════════════════════════════════════
// CANONICAL 6-STEP TRACE (matches textbook-orchestrator.test.ts)
// ═══════════════════════════════════════════════════════════════════════════════

const CANONICAL_TRACE = [
  { retryCount: 1, hintCount: 0, elapsedMs: 0 },
  { retryCount: 2, hintCount: 0, elapsedMs: 15_000 },
  { retryCount: 2, hintCount: 1, elapsedMs: 20_000 },
  { retryCount: 3, hintCount: 1, elapsedMs: 30_000 },
  { retryCount: 4, hintCount: 3, elapsedMs: 90_000 },
  { retryCount: 7, hintCount: 6, elapsedMs: 310_000 },
];

const CONCEPT_ID = 'joins';
const CORPUS_CONCEPT_ID = 'dbms-ramakrishnan-3rd-edition/joins';
const BASE_TIMESTAMP = 1_000_000;
const LEARNER_ID = 'canonical-learner-1';
const SESSION_ID = 'canonical-session-1';
const PROBLEM_ID = 'joins-problem-1';

// ═══════════════════════════════════════════════════════════════════════════════
// POLICY DEFINITIONS (canonical for Week 6 experiments)
// ═══════════════════════════════════════════════════════════════════════════════

const POLICIES = {
  conservative: {
    id: 'conservative',
    name: 'Conservative (Hints Only)',
    description: 'Static hint mode — no escalation to explanation or textbook',
    condition: staticHintModeCondition(),
  },
  adaptive: {
    id: 'adaptive',
    name: 'Adaptive Textbook',
    description: 'Fully adaptive with time/count-based escalation to textbook and reflection',
    condition: adaptiveTextbookCondition(),
  },
  explanation_first: {
    id: 'explanation_first',
    name: 'Explanation First',
    description: 'Immediate explanation on first retry — skips hint phase',
    condition: explanationFirstCondition(),
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// SIMULATION FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Build a synthetic event trace for a given policy.
 * Uses the canonical orchestrate() function from textbook-orchestrator-esm.mjs —
 * no independent threshold logic here.
 */
function buildPolicyTrace(policy) {
  const events = [];
  let eventId = 1;
  let textbookUnitCreated = false;
  let unitId = null;

  CANONICAL_TRACE.forEach((step, idx) => {
    const timestamp = BASE_TIMESTAMP + step.elapsedMs;

    // Log the error event
    events.push({
      id: `evt-${eventId++}`,
      learnerId: LEARNER_ID,
      sessionId: SESSION_ID,
      timestamp,
      eventType: 'error',
      problemId: PROBLEM_ID,
      retryCount: step.retryCount,
      hintCount: step.hintCount,
      corpusConceptId: CORPUS_CONCEPT_ID,
    });

    // Get policy decision from the canonical orchestrator (single source of truth)
    const decision = orchestrate({
      conceptId: CONCEPT_ID,
      retryCount: step.retryCount,
      hintCount: step.hintCount,
      elapsedMs: step.elapsedMs,
      sessionConfig: policy.condition,
    });

    // Emit intervention events based on decision
    if (decision.action === 'stay_hint' && step.hintCount > 0) {
      events.push({
        id: `evt-${eventId++}`,
        learnerId: LEARNER_ID,
        sessionId: SESSION_ID,
        timestamp: timestamp + 100,
        eventType: 'hint_view',
        problemId: PROBLEM_ID,
        hintLevel: Math.min(step.hintCount, 3),
        corpusConceptId: CORPUS_CONCEPT_ID,
      });
    } else if (decision.action === 'show_explanation') {
      events.push({
        id: `evt-${eventId++}`,
        learnerId: LEARNER_ID,
        sessionId: SESSION_ID,
        timestamp: timestamp + 200,
        eventType: 'explanation_view',
        problemId: PROBLEM_ID,
        corpusConceptId: CORPUS_CONCEPT_ID,
        escalationTriggerReason: decision.escalationTriggerReason,
      });
    } else if (decision.action === 'upsert_textbook_unit') {
      unitId = `unit-${policy.id}-${CONCEPT_ID}`;
      events.push({
        id: `evt-${eventId++}`,
        learnerId: LEARNER_ID,
        sessionId: SESSION_ID,
        timestamp: timestamp + 300,
        eventType: 'textbook_unit_upsert',
        problemId: PROBLEM_ID,
        unitId,
        action: textbookUnitCreated ? 'updated' : 'created',
        corpusConceptId: CORPUS_CONCEPT_ID,
        escalationTriggerReason: decision.escalationTriggerReason,
      });
      textbookUnitCreated = true;
    } else if (decision.action === 'prompt_reflective_note') {
      events.push({
        id: `evt-${eventId++}`,
        learnerId: LEARNER_ID,
        sessionId: SESSION_ID,
        timestamp: timestamp + 400,
        eventType: 'textbook_unit_shown',
        problemId: PROBLEM_ID,
        corpusConceptId: CORPUS_CONCEPT_ID,
        escalationTriggerReason: decision.escalationTriggerReason,
      });
    }
  });

  // Add reinforcement events for adaptive policy only
  if (policy.id === 'adaptive' && textbookUnitCreated) {
    const finalTimestamp = BASE_TIMESTAMP + 310_000;

    // Immediate reinforcement (same session)
    events.push({
      id: `evt-${eventId++}`,
      learnerId: LEARNER_ID,
      sessionId: SESSION_ID,
      timestamp: finalTimestamp + 60_000, // 1 minute later
      eventType: 'reinforcement_prompt_shown',
      problemId: PROBLEM_ID,
      sourceUnitId: unitId,
      sourceConceptId: CORPUS_CONCEPT_ID,
      delayBucket: 'immediate',
      promptType: 'mcq',
      corpusConceptId: CORPUS_CONCEPT_ID,
    });

    events.push({
      id: `evt-${eventId++}`,
      learnerId: LEARNER_ID,
      sessionId: SESSION_ID,
      timestamp: finalTimestamp + 65_000,
      eventType: 'reinforcement_response',
      problemId: PROBLEM_ID,
      sourceUnitId: unitId,
      sourceConceptId: CORPUS_CONCEPT_ID,
      delayBucket: 'immediate',
      reinforcementCorrect: true,
      reinforcementLatencyMs: 5000,
      response: 'SELECT * FROM users JOIN orders ON users.id = orders.user_id',
      corpusConceptId: CORPUS_CONCEPT_ID,
    });

    // 3-day delayed reinforcement
    const threeDaysMs = 3 * 24 * 60 * 60 * 1000;
    events.push({
      id: `evt-${eventId++}`,
      learnerId: LEARNER_ID,
      sessionId: SESSION_ID,
      timestamp: finalTimestamp + threeDaysMs,
      eventType: 'reinforcement_prompt_shown',
      problemId: PROBLEM_ID,
      sourceUnitId: unitId,
      sourceConceptId: CORPUS_CONCEPT_ID,
      delayBucket: '3d',
      promptType: 'sql_completion',
      corpusConceptId: CORPUS_CONCEPT_ID,
    });

    events.push({
      id: `evt-${eventId++}`,
      learnerId: LEARNER_ID,
      sessionId: SESSION_ID,
      timestamp: finalTimestamp + threeDaysMs + 8000,
      eventType: 'reinforcement_response',
      problemId: PROBLEM_ID,
      sourceUnitId: unitId,
      sourceConceptId: CORPUS_CONCEPT_ID,
      delayBucket: '3d',
      reinforcementCorrect: false,
      reinforcementLatencyMs: 8000,
      response: 'SELECT users.*, orders.* FROM users, orders',
      corpusConceptId: CORPUS_CONCEPT_ID,
    });
  }

  return events.sort((a, b) => a.timestamp - b.timestamp);
}

// ═══════════════════════════════════════════════════════════════════════════════
// METRIC CALCULATIONS (canonical formulas from dependency-metrics.ts)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Calculate HDI components using the canonical formula.
 */
function calculateHDI(trace) {
  const hints = trace.filter(
    (e) => e.eventType === 'hint_view' || e.eventType === 'guidance_view'
  );
  const attempts = trace.filter((e) => e.eventType === 'execution');
  const explanations = trace.filter((e) => e.eventType === 'explanation_view');
  const errors = trace.filter((e) => e.eventType === 'error');

  // HPA: Hints Per Attempt
  const hpa = attempts.length > 0 ? Math.min(hints.length / attempts.length, 1.0) : 0;

  // AED: Average Escalation Depth
  const hintLevels = hints.filter((h) => h.hintLevel !== undefined).map((h) => h.hintLevel || 1);
  const avgLevel = hintLevels.length > 0 ? hintLevels.reduce((a, b) => a + b, 0) / hintLevels.length : 1;
  const aed = Math.min(Math.max((avgLevel - 1) / 2, 0), 1);

  // ER: Explanation Rate
  const er = attempts.length > 0 ? Math.min(explanations.length / attempts.length, 1.0) : 0;

  // REAE: Repeated Error After Explanation
  let explanationSeen = false;
  let errorsAfterExplanation = 0;
  for (const event of trace.sort((a, b) => a.timestamp - b.timestamp)) {
    if (event.eventType === 'explanation_view') {
      explanationSeen = true;
    } else if (event.eventType === 'error' && explanationSeen) {
      errorsAfterExplanation++;
    }
  }
  const reae = errors.length > 0 ? errorsAfterExplanation / errors.length : 0;

  // IWH: Improvement Without Hint
  const problemEvents = {};
  trace.forEach((e) => {
    if (!problemEvents[e.problemId]) problemEvents[e.problemId] = [];
    problemEvents[e.problemId].push(e);
  });

  let successfulProblems = 0;
  let successfulWithoutHints = 0;
  for (const [_, events] of Object.entries(problemEvents)) {
    const hasSuccess = events.some((e) => e.eventType === 'execution' && e.successful);
    if (hasSuccess) {
      successfulProblems++;
      const hadHints = events.some((e) => e.eventType === 'hint_view' || e.eventType === 'hint_request');
      if (!hadHints) {
        successfulWithoutHints++;
      }
    }
  }
  const iwh = successfulProblems > 0 ? successfulWithoutHints / successfulProblems : 0;

  // Weighted HDI (canonical weights)
  const weights = { hpa: 0.3, aed: 0.15, er: 0.25, reae: 0.15, iwh: 0.15 };
  const hdi = Math.min(
    Math.max(
      hpa * weights.hpa + aed * weights.aed + er * weights.er + reae * weights.reae + (1 - iwh) * weights.iwh,
      0
    ),
    1
  );

  return {
    hdi,
    hdiVersion: 'dependency-metrics-v1',
    components: { hpa, aed, er, reae, iwh },
    componentWeights: weights,
    rawCounts: {
      totalAttempts: attempts.length,
      totalHints: hints.length,
      totalExplanations: explanations.length,
      totalErrors: errors.length,
      errorsAfterExplanation,
      successfulProblems,
      successfulWithoutHints,
    },
  };
}

/**
 * Calculate reinforcement metrics.
 */
function calculateReinforcementMetrics(trace) {
  const prompts = trace.filter((e) => e.eventType === 'reinforcement_prompt_shown');
  const responses = trace.filter((e) => e.eventType === 'reinforcement_response');

  // By delay bucket
  const bucketNames = ['immediate', '3d', '7d', '14d', '21d'];
  const byDelayBucket = {};

  for (const bucket of bucketNames) {
    const bucketPrompts = prompts.filter((p) => p.delayBucket === bucket);
    const bucketResponses = responses.filter((r) => r.delayBucket === bucket);
    const bucketCorrect = bucketResponses.filter((r) => r.reinforcementCorrect !== undefined ? r.reinforcementCorrect : r.isCorrect).length;
    const bucketLatencies = bucketResponses
      .map((r) => r.reinforcementLatencyMs)
      .filter((ms) => ms !== undefined && !isNaN(ms));

    byDelayBucket[bucket] = {
      promptsShown: bucketPrompts.length,
      responsesRecorded: bucketResponses.length,
      correctCount: bucketCorrect,
      accuracyRate: bucketResponses.length > 0 ? bucketCorrect / bucketResponses.length : 0,
      averageLatencyMs: bucketLatencies.length > 0 ? bucketLatencies.reduce((a, b) => a + b, 0) / bucketLatencies.length : 0,
    };
  }

  const correctCount = responses.filter((r) => r.reinforcementCorrect !== undefined ? r.reinforcementCorrect : r.isCorrect).length;
  const latencies = responses.map((r) => r.reinforcementLatencyMs).filter((ms) => ms !== undefined && !isNaN(ms));

  return {
    promptsShown: prompts.length,
    responsesRecorded: responses.length,
    correctCount,
    accuracyRate: responses.length > 0 ? correctCount / responses.length : 0,
    averageLatencyMs: latencies.length > 0 ? latencies.reduce((a, b) => a + b, 0) / latencies.length : 0,
    byDelayBucket,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// OUTPUT GENERATORS
// ═══════════════════════════════════════════════════════════════════════════════

function generatePolicyComparison(policyTraces) {
  const comparisons = [];

  for (const [policyId, trace] of Object.entries(policyTraces)) {
    const policy = POLICIES[policyId];
    const hdi = calculateHDI(trace);
    const reinforcement = calculateReinforcementMetrics(trace);

    // Count concepts
    const concepts = new Set();
    const mastered = new Set();
    trace.forEach((e) => {
      if (e.corpusConceptId) {
        concepts.add(e.corpusConceptId);
        if (e.eventType === 'execution' && e.successful) {
          mastered.add(e.corpusConceptId);
        }
      }
    });

    comparisons.push({
      policyId,
      policyName: policy.name,
      outcomes: {
        explanationsShown: trace.filter((e) => e.eventType === 'explanation_view').length,
        textbookUnitsUpserted: trace.filter((e) => e.eventType === 'textbook_unit_upsert').length,
        reinforcementPromptsShown: reinforcement.promptsShown,
        reinforcementCorrectCount: reinforcement.correctCount,
        reinforcementAccuracy: reinforcement.accuracyRate,
      },
      dependency: {
        hdi: hdi.hdi,
        hdiComponents: hdi.components,
        formula: `HDI = ${hdi.componentWeights.hpa}*HPA + ${hdi.componentWeights.aed}*AED + ${hdi.componentWeights.er}*ER + ${hdi.componentWeights.reae}*REAE + ${hdi.componentWeights.iwh}*(1-IWH)`,
      },
      coverage: {
        conceptsEncountered: concepts.size,
        conceptsMastered: mastered.size,
        coverageRate: concepts.size > 0 ? mastered.size / concepts.size : 0,
      },
      reinforcement: reinforcement.byDelayBucket,
      traceMetadata: {
        eventCount: trace.length,
        errorEvents: trace.filter((e) => e.eventType === 'error').length,
        interventionEvents: trace.filter((e) =>
          ['hint_view', 'explanation_view', 'textbook_unit_upsert', 'textbook_unit_shown'].includes(e.eventType)
        ).length,
      },
    });
  }

  return comparisons;
}

function comparisonsToCsv(comparisons) {
  const headers = [
    'policy_id',
    'policy_name',
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
  ];

  const rows = comparisons.map((c) =>
    [
      c.policyId,
      c.policyName,
      c.outcomes.explanationsShown,
      c.outcomes.textbookUnitsUpserted,
      c.outcomes.reinforcementPromptsShown,
      c.outcomes.reinforcementCorrectCount,
      c.outcomes.reinforcementAccuracy.toFixed(4),
      c.dependency.hdi.toFixed(4),
      c.dependency.hdiComponents.hpa.toFixed(4),
      c.dependency.hdiComponents.aed.toFixed(4),
      c.dependency.hdiComponents.er.toFixed(4),
      c.dependency.hdiComponents.reae.toFixed(4),
      c.dependency.hdiComponents.iwh.toFixed(4),
      c.coverage.conceptsEncountered,
      c.coverage.conceptsMastered,
      c.coverage.coverageRate.toFixed(4),
    ].join(',')
  );

  return [headers.join(','), ...rows].join('\n');
}

function reinforcementToCsv(comparisons) {
  const headers = [
    'policy_id',
    'delay_bucket',
    'prompts_shown',
    'responses_recorded',
    'correct_count',
    'accuracy_rate',
    'average_latency_ms',
  ];

  const rows = [];
  for (const comp of comparisons) {
    for (const [bucket, metrics] of Object.entries(comp.reinforcement)) {
      if (metrics.promptsShown > 0) {
        rows.push(
          [
            comp.policyId,
            bucket,
            metrics.promptsShown,
            metrics.responsesRecorded,
            metrics.correctCount,
            metrics.accuracyRate.toFixed(4),
            Math.round(metrics.averageLatencyMs),
          ].join(',')
        );
      }
    }
  }

  return [headers.join(','), ...rows].join('\n');
}

function generateManifest(comparisons, checksums) {
  return {
    version: REPLAY_VERSION,
    generatedAt: new Date().toISOString(),
    trace: {
      steps: CANONICAL_TRACE.length,
      conceptId: CONCEPT_ID,
      corpusConceptId: CORPUS_CONCEPT_ID,
      learnerId: LEARNER_ID,
      sessionId: SESSION_ID,
    },
    policies: Object.values(POLICIES).map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description,
    })),
    formula: {
      hdi: 'HDI = 0.30*HPA + 0.15*AED + 0.25*ER + 0.15*REAE + 0.15*(1-IWH)',
      components: {
        HPA: 'Hints Per Attempt = min(hints / attempts, 1.0)',
        AED: 'Average Escalation Depth = clamp((avg_hint_level - 1) / 2, 0, 1)',
        ER: 'Explanation Rate = min(explanations / attempts, 1.0)',
        REAE: 'Repeated Error After Explanation = errors_after_explanation / total_errors',
        IWH: 'Improvement Without Hint = successes_without_hints / total_successes',
      },
    },
    checksums,
    outputs: {
      json: 'policy-comparison.json',
      csv: 'policy-comparison.csv',
      hdi: 'hdi-components.json',
      reinforcement: 'reinforcement-outcomes.csv',
    },
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════════════════

function parseArgs(argv) {
  const args = {
    outputDir: DEFAULT_OUTPUT_DIR,
    format: 'both',
    help: false,
  };

  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];

    if (token === '--help' || token === '-h') {
      args.help = true;
      continue;
    }

    if (token === '--output-dir' && i + 1 < argv.length) {
      args.outputDir = argv[i + 1];
      i += 1;
      continue;
    }

    if (token === '--format' && i + 1 < argv.length) {
      args.format = argv[i + 1];
      i += 1;
      continue;
    }
  }

  return args;
}

function printHelp() {
  console.log(`
Replay Paper Tables Generator
=============================

Generates JSON and CSV summaries for paper figures/tables.

Usage: node scripts/replay-paper-tables.mjs [options]

Options:
  --output-dir <path>   Output directory (default: dist/replay/paper-tables)
  --format <format>     Output format: json, csv, both (default: both)
  --help, -h            Show this help

Output Files:
  policy-comparison.json      Full machine-readable comparison
  policy-comparison.csv       Table-friendly CSV format
  hdi-components.json         HDI breakdown by policy
  reinforcement-outcomes.csv  Reinforcement metrics by delay bucket
  experiment-manifest.json    Metadata and checksums

Policies Compared:
  - conservative:     Hints only (control)
  - adaptive:         Full escalation ladder (treatment)
  - explanation_first: Immediate explanation, no textbook

Example:
  node scripts/replay-paper-tables.mjs --format csv
`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    printHelp();
    return;
  }

  console.log('Replay Paper Tables Generator');
  console.log(`Version: ${REPLAY_VERSION}`);
  console.log('');

  // Build traces for each policy
  console.log('Building policy traces...');
  const policyTraces = {
    conservative: buildPolicyTrace(POLICIES.conservative),
    adaptive: buildPolicyTrace(POLICIES.adaptive),
    explanation_first: buildPolicyTrace(POLICIES.explanation_first),
  };

  // Generate comparisons
  console.log('Calculating metrics...');
  const comparisons = generatePolicyComparison(policyTraces);

  // Calculate checksums
  const checksums = {
    conservative: crypto.createHash('sha256').update(JSON.stringify(policyTraces.conservative)).digest('hex').slice(0, 16),
    adaptive: crypto.createHash('sha256').update(JSON.stringify(policyTraces.adaptive)).digest('hex').slice(0, 16),
    explanation_first: crypto.createHash('sha256').update(JSON.stringify(policyTraces.explanation_first)).digest('hex').slice(0, 16),
  };

  // Ensure output directory
  const outputDir = path.resolve(args.outputDir);
  await mkdir(outputDir, { recursive: true });

  // Write JSON output
  if (args.format === 'json' || args.format === 'both') {
    // Main comparison JSON
    const jsonPath = path.join(outputDir, 'policy-comparison.json');
    await writeFile(
      jsonPath,
      JSON.stringify(
        {
          version: REPLAY_VERSION,
          generatedAt: new Date().toISOString(),
          formula: comparisons[0]?.dependency?.formula,
          comparisons,
        },
        null,
        2
      )
    );
    console.log(`JSON: ${jsonPath}`);

    // HDI components JSON
    const hdiPath = path.join(outputDir, 'hdi-components.json');
    await writeFile(
      hdiPath,
      JSON.stringify(
        {
          version: REPLAY_VERSION,
          hdiVersion: 'dependency-metrics-v1',
          policies: comparisons.map((c) => ({
            policyId: c.policyId,
            hdi: c.dependency.hdi,
            components: c.dependency.hdiComponents,
            weights: { hpa: 0.3, aed: 0.15, er: 0.25, reae: 0.15, iwh: 0.15 },
          })),
        },
        null,
        2
      )
    );
    console.log(`HDI:  ${hdiPath}`);

    // Manifest
    const manifestPath = path.join(outputDir, 'experiment-manifest.json');
    await writeFile(manifestPath, JSON.stringify(generateManifest(comparisons, checksums), null, 2));
    console.log(`Manifest: ${manifestPath}`);
  }

  // Write CSV output
  if (args.format === 'csv' || args.format === 'both') {
    // Main comparison CSV
    const csvPath = path.join(outputDir, 'policy-comparison.csv');
    await writeFile(csvPath, comparisonsToCsv(comparisons));
    console.log(`CSV:  ${csvPath}`);

    // Reinforcement outcomes CSV
    const reinforcementPath = path.join(outputDir, 'reinforcement-outcomes.csv');
    await writeFile(reinforcementPath, reinforcementToCsv(comparisons));
    console.log(`Reinforcement: ${reinforcementPath}`);
  }

  // Print summary
  console.log('');
  console.log('Policy Comparison Summary');
  console.log('=========================');
  for (const comp of comparisons) {
    console.log(`${comp.policyName}:`);
    console.log(`  Explanations: ${comp.outcomes.explanationsShown}`);
    console.log(`  Textbook units: ${comp.outcomes.textbookUnitsUpserted}`);
    console.log(`  Reinforcement prompts: ${comp.outcomes.reinforcementPromptsShown}`);
    console.log(`  Reinforcement correct: ${comp.outcomes.reinforcementCorrectCount}`);
    console.log(`  HDI: ${comp.dependency.hdi.toFixed(4)}`);
    console.log('');
  }

  console.log('Output directory:', outputDir);
  console.log('Done!');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
