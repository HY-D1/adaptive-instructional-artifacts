#!/usr/bin/env node
/**
 * Replay Experiment Framework
 * 
 * Research-grade replay system for comparing escalation policies.
 * Simulates multiple policies against the same learner traces and generates
 * comprehensive comparison reports with statistical analysis.
 * 
 * Usage:
 *   node scripts/replay-experiment.mjs [options]
 * 
 * Options:
 *   --input <path>           Input trace file (default: dist/replay/real/export.json)
 *   --output <path>          Output directory (default: dist/replay/experiment)
 *   --policies <list>        Comma-separated policy IDs (default: all)
 *   --format <format>        Output format: json, csv, both (default: both)
 *   --help                   Show this help message
 * 
 * Example:
 *   node scripts/replay-experiment.mjs --policies aggressive,conservative --format csv
 * 
 * @version replay-experiment-v1
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..');

// Configuration
const DEFAULT_INPUT = path.join(REPO_ROOT, 'dist/replay/real/export.json');
const DEFAULT_OUTPUT = path.join(REPO_ROOT, 'dist/replay/experiment');
const REPLAY_VERSION = 'replay-experiment-v1';
const POLICY_SEMANTICS_VERSION = 'policy-definitions-v1';

// All available policies
const ALL_POLICIES = [
  'aggressive',
  'conservative', 
  'explanation_first',
  'adaptive',
  'no_hints'
];

// Policy definitions (mirrored from TypeScript for replay)
const POLICY_DEFINITIONS = {
  aggressive: {
    id: 'aggressive',
    name: 'Aggressive Escalation',
    description: 'Fast to explanation, low hint dependency',
    thresholds: { escalate: 1, aggregate: 2 },
    triggers: { timeStuck: 60000, rungExhausted: 1, repeatedError: 1 },
    hintsEnabled: true,
    usesBandit: false
  },
  conservative: {
    id: 'conservative',
    name: 'Conservative Escalation',
    description: 'Maximize hint exploration before explanation',
    thresholds: { escalate: 3, aggregate: 4 },
    triggers: { timeStuck: 300000, rungExhausted: 3, repeatedError: 3 },
    hintsEnabled: true,
    usesBandit: false
  },
  explanation_first: {
    id: 'explanation_first',
    name: 'Explanation-First',
    description: 'Skip hints, go straight to explanation',
    thresholds: { escalate: 0, aggregate: 2 },
    triggers: { timeStuck: 0, rungExhausted: 0, repeatedError: 0 },
    hintsEnabled: false,
    usesBandit: false
  },
  adaptive: {
    id: 'adaptive',
    name: 'Adaptive (Bandit)',
    description: 'Bandit-optimized per learner',
    thresholds: { escalate: 2, aggregate: 3 },
    triggers: { timeStuck: 120000, rungExhausted: 2, repeatedError: 2 },
    hintsEnabled: true,
    usesBandit: true
  },
  no_hints: {
    id: 'no_hints',
    name: 'No Hints (Control)',
    description: 'No assistance provided',
    thresholds: { escalate: -1, aggregate: -1 },
    triggers: { timeStuck: Infinity, rungExhausted: Infinity, repeatedError: Infinity },
    hintsEnabled: false,
    usesBandit: false
  }
};

// Event types relevant for replay
const REPLAY_EVENT_TYPES = new Set([
  'execution',
  'error',
  'hint_request',
  'hint_view',
  'explanation_view',
  'guidance_request',
  'guidance_view',
  'guidance_escalate',
  'textbook_add',
  'textbook_unit_upsert',
  'reinforcement_response'
]);

/**
 * Parse command line arguments
 */
function parseArgs(argv) {
  const args = {
    input: DEFAULT_INPUT,
    output: DEFAULT_OUTPUT,
    policies: ALL_POLICIES,
    format: 'both',
    help: false
  };

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    
    if (token === '--help' || token === '-h') {
      args.help = true;
      continue;
    }
    
    if (token === '--input' && i + 1 < argv.length) {
      args.input = argv[i + 1];
      i += 1;
      continue;
    }
    
    if (token === '--output' && i + 1 < argv.length) {
      args.output = argv[i + 1];
      i += 1;
      continue;
    }
    
    if (token === '--policies' && i + 1 < argv.length) {
      args.policies = argv[i + 1].split(',').map(p => p.trim());
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

/**
 * Print help message
 */
function printHelp() {
  console.log(`
Replay Experiment Framework

Usage: node scripts/replay-experiment.mjs [options]

Options:
  --input <path>        Input trace file (default: dist/replay/real/export.json)
  --output <path>       Output directory (default: dist/replay/experiment)
  --policies <list>     Comma-separated policy IDs (default: all)
  --format <format>     Output format: json, csv, both (default: both)
  --help, -h            Show this help message

Available Policies:
  ${ALL_POLICIES.join('\n  ')}

Examples:
  # Run all policies
  node scripts/replay-experiment.mjs

  # Compare specific policies
  node scripts/replay-experiment.mjs --policies aggressive,conservative

  # JSON output only
  node scripts/replay-experiment.mjs --format json
`);
}

/**
 * Stable serialization for checksums
 */
function stableSerialize(value) {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableSerialize(item)).join(',')}]`;
  }
  if (value && typeof value === 'object') {
    const entries = Object.entries(value).sort(([a], [b]) => a.localeCompare(b));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableSerialize(v)}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

/**
 * Compute hash for deterministic assignment
 */
function hashString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
}

/**
 * Load traces from input file
 */
async function loadTraces(inputPath) {
  const raw = await readFile(inputPath, 'utf8');
  const payload = JSON.parse(raw);
  
  if (!Array.isArray(payload.interactions)) {
    throw new Error('Invalid input format: expected interactions array');
  }
  
  // Filter and sort relevant events
  const events = payload.interactions
    .filter(i => i?.problemId && REPLAY_EVENT_TYPES.has(i.eventType))
    .sort((a, b) => {
      const timeDelta = Number(a.timestamp) - Number(b.timestamp);
      if (timeDelta !== 0) return timeDelta;
      const learnerDelta = String(a.learnerId || '').localeCompare(String(b.learnerId || ''));
      if (learnerDelta !== 0) return learnerDelta;
      return String(a.problemId || '').localeCompare(String(b.problemId || ''));
    });
  
  // Group by learner
  const byLearner = {};
  events.forEach(event => {
    const learnerId = event.learnerId || 'unknown';
    if (!byLearner[learnerId]) {
      byLearner[learnerId] = [];
    }
    byLearner[learnerId].push(event);
  });
  
  return Object.values(byLearner);
}

/**
 * Calculate HDI (Hint Dependency Index) components
 */
function calculateHDI(interactions) {
  if (!interactions || interactions.length === 0) {
    return { hdi: 0, components: { hpa: 0, aed: 0, er: 0, reae: 0, iwh: 0 } };
  }
  
  const hintRequests = interactions.filter(
    i => i.eventType === 'hint_request' || i.eventType === 'guidance_request'
  ).length;
  const attempts = interactions.filter(i => i.eventType === 'execution').length;
  const hpa = attempts > 0 ? Math.min(hintRequests / attempts, 1.0) : 0;
  
  const hintEvents = interactions.filter(
    i => (i.eventType === 'hint_view' || i.eventType === 'guidance_view') && i.hintLevel !== undefined
  );
  const avgLevel = hintEvents.length > 0
    ? hintEvents.reduce((sum, i) => sum + (i.hintLevel || 1), 0) / hintEvents.length
    : 1;
  const aed = Math.min(Math.max((avgLevel - 1) / 2, 0), 1);
  
  const explanationViews = interactions.filter(i => i.eventType === 'explanation_view').length;
  const er = attempts > 0 ? Math.min(explanationViews / attempts, 1.0) : 0;
  
  // REAE: Repeated Error After Explanation
  const sorted = [...interactions].sort((a, b) => a.timestamp - b.timestamp);
  let explanationSeen = false;
  let errorsAfterExplanation = 0;
  let totalErrors = 0;
  for (const interaction of sorted) {
    if (interaction.eventType === 'explanation_view') {
      explanationSeen = true;
    } else if (interaction.eventType === 'error') {
      totalErrors++;
      if (explanationSeen) errorsAfterExplanation++;
    }
  }
  const reae = totalErrors > 0 ? errorsAfterExplanation / totalErrors : 0;
  
  // IWH: Improvement Without Hint
  const problemsWithHints = new Set();
  const successfulProblems = new Set();
  for (const interaction of sorted) {
    const pid = interaction.problemId;
    if (interaction.eventType === 'hint_request' || interaction.eventType === 'hint_view') {
      problemsWithHints.add(pid);
    }
    if (interaction.eventType === 'execution' && interaction.successful) {
      successfulProblems.add(pid);
    }
  }
  const iwh = successfulProblems.size > 0
    ? (successfulProblems.size - [...successfulProblems].filter(p => problemsWithHints.has(p)).length) / successfulProblems.size
    : 0;
  
  // Weighted HDI
  const weights = { hpa: 0.3, aed: 0.133, er: 0.3, reae: 0.133, iwh: 0.134 };
  const hdi = Math.min(Math.max(
    hpa * weights.hpa +
    aed * weights.aed +
    er * weights.er +
    reae * weights.reae +
    (1 - iwh) * weights.iwh,
    0
  ), 1);
  
  return { hdi, components: { hpa, aed, er, reae, iwh } };
}

/**
 * Compute comprehensive metrics from trace
 */
function computeMetrics(trace) {
  if (!trace || trace.length === 0) {
    return getEmptyMetrics();
  }
  
  const sorted = [...trace].sort((a, b) => a.timestamp - b.timestamp);
  const firstEvent = sorted[0];
  const lastEvent = sorted[sorted.length - 1];
  
  // Problem grouping
  const problemEvents = {};
  sorted.forEach(event => {
    if (!problemEvents[event.problemId]) problemEvents[event.problemId] = [];
    problemEvents[event.problemId].push(event);
  });
  
  // Basic counts
  const errors = sorted.filter(e => e.eventType === 'error').length;
  const hints = sorted.filter(e => e.eventType === 'hint_view' || e.eventType === 'guidance_view').length;
  const explanations = sorted.filter(e => e.eventType === 'explanation_view').length;
  const helpRequests = hints + explanations;
  
  // Concepts
  const conceptsEncountered = new Set();
  const conceptsMastered = new Set();
  sorted.forEach(e => {
    if (e.conceptIds) {
      e.conceptIds.forEach(c => conceptsEncountered.add(c));
      if (e.eventType === 'execution' && e.successful) {
        e.conceptIds.forEach(c => conceptsMastered.add(c));
      }
    }
  });
  
  // Problems solved
  const problems = Object.entries(problemEvents).map(([pid, events]) => {
    const solved = events.some(e => e.eventType === 'execution' && e.successful);
    const attempts = events.filter(e => e.eventType === 'execution').length;
    const firstExecIdx = events.findIndex(e => e.eventType === 'execution');
    const firstSuccessIdx = events.findIndex(e => e.eventType === 'execution' && e.successful);
    const timeSpent = events[events.length - 1].timestamp - events[0].timestamp;
    return { pid, solved, attempts, firstAttemptSuccess: firstSuccessIdx === firstExecIdx, timeSpent };
  });
  
  const solvedProblems = problems.filter(p => p.solved);
  
  // HDI
  const hdi = calculateHDI(sorted);
  
  // Average escalation depth
  const hintEvents = sorted.filter(e => (e.eventType === 'hint_view' || e.eventType === 'guidance_view') && e.hintLevel);
  const avgLevel = hintEvents.length > 0
    ? hintEvents.reduce((sum, h) => sum + h.hintLevel, 0) / hintEvents.length
    : 1;
  const avgEscalationDepth = Math.min(Math.max((avgLevel - 1) / 2, 0), 1);
  
  // Time metrics
  const totalTime = lastEvent.timestamp - firstEvent.timestamp;
  const avgTimeToSuccess = solvedProblems.length > 0
    ? solvedProblems.reduce((sum, p) => sum + p.timeSpent, 0) / solvedProblems.length
    : 0;
  const firstSuccess = sorted.find(e => e.eventType === 'execution' && e.successful);
  const timeToFirstSuccess = firstSuccess ? firstSuccess.timestamp - firstEvent.timestamp : 0;
  
  // Error reduction (first half vs second half)
  const mid = Math.floor(sorted.length / 2);
  const firstHalfErrors = sorted.slice(0, mid).filter(e => e.eventType === 'error').length;
  const secondHalfErrors = sorted.slice(mid).filter(e => e.eventType === 'error').length;
  const errorReduction = firstHalfErrors > 0
    ? Math.max(0, (firstHalfErrors - secondHalfErrors) / firstHalfErrors)
    : 0;
  
  // Retention estimate from reinforcement responses
  const reinforcements = sorted.filter(e => e.eventType === 'reinforcement_response');
  const correctReinforcements = reinforcements.filter(e => e.isCorrect);
  const retention = reinforcements.length > 0
    ? correctReinforcements.length / reinforcements.length
    : 0.5;
  
  // First attempt success rate
  const firstAttemptSuccess = problems.length > 0
    ? problems.filter(p => p.firstAttemptSuccess).length / problems.length
    : 0;
  
  return {
    conceptCoverageRate: conceptsEncountered.size > 0 ? conceptsMastered.size / conceptsEncountered.size : 0,
    conceptsEncountered: Array.from(conceptsEncountered),
    conceptsMastered: Array.from(conceptsMastered),
    explanationRequestRate: helpRequests > 0 ? explanations / helpRequests : 0,
    averageEscalationDepth: avgEscalationDepth,
    totalHelpRequests: helpRequests,
    hintDependencyIndex: hdi.hdi,
    independentSuccessRate: hdi.components.iwh,
    hdiComponents: hdi.components,
    averageTimeToSuccess: avgTimeToSuccess,
    totalSessionTime: totalTime,
    interactionsPerProblem: problems.length > 0 ? sorted.length / problems.length : 0,
    timeToFirstSuccess: timeToFirstSuccess,
    errorReductionRate: errorReduction,
    retentionEstimate: retention,
    firstAttemptSuccessRate: firstAttemptSuccess,
    totalProblems: problems.length,
    problemsSolved: solvedProblems.length,
    totalErrors: errors,
    totalHintsViewed: hints,
    totalExplanationsViewed: explanations
  };
}

/**
 * Get empty metrics object
 */
function getEmptyMetrics() {
  return {
    conceptCoverageRate: 0,
    conceptsEncountered: [],
    conceptsMastered: [],
    explanationRequestRate: 0,
    averageEscalationDepth: 0,
    totalHelpRequests: 0,
    hintDependencyIndex: 0,
    independentSuccessRate: 0,
    hdiComponents: { hpa: 0, aed: 0, er: 0, reae: 0, iwh: 0 },
    averageTimeToSuccess: 0,
    totalSessionTime: 0,
    interactionsPerProblem: 0,
    timeToFirstSuccess: 0,
    errorReductionRate: 0,
    retentionEstimate: 0,
    firstAttemptSuccessRate: 0,
    totalProblems: 0,
    problemsSolved: 0,
    totalErrors: 0,
    totalHintsViewed: 0,
    totalExplanationsViewed: 0
  };
}

/**
 * Simulate a policy against a set of traces
 */
async function simulatePolicy(traces, policyId) {
  const policy = POLICY_DEFINITIONS[policyId];
  if (!policy) {
    throw new Error(`Unknown policy: ${policyId}`);
  }
  
  const results = [];
  const allMetrics = [];
  
  for (const trace of traces) {
    // Simulate the policy against this trace
    const simulated = simulateTrace(trace, policy);
    const metrics = computeMetrics(simulated.events);
    
    results.push({
      learnerId: trace[0]?.learnerId || 'unknown',
      originalEventCount: trace.length,
      simulatedEventCount: simulated.events.length,
      escalationsTriggered: simulated.escalations,
      explanationsShown: simulated.explanations,
      hintsShown: simulated.hints,
      metrics
    });
    
    allMetrics.push(metrics);
  }
  
  // Aggregate metrics
  const aggregate = aggregateMetrics(allMetrics);
  
  // Statistical summary
  const stats = computeStatistics(allMetrics.map(m => m.hintDependencyIndex));
  
  return {
    policyId,
    policy,
    traceCount: traces.length,
    results,
    aggregateMetrics: aggregate,
    statistics: {
      hdi: stats,
      coverage: computeStatistics(allMetrics.map(m => m.conceptCoverageRate)),
      successRate: computeStatistics(allMetrics.map(m => m.problemsSolved / Math.max(m.totalProblems, 1))),
      timeToSuccess: computeStatistics(allMetrics.map(m => m.averageTimeToSuccess))
    }
  };
}

/**
 * Simulate a single trace with a policy
 */
function simulateTrace(trace, policy) {
  const events = [];
  let escalations = 0;
  let explanations = 0;
  let hints = 0;
  
  const problemStats = {};
  
  for (const event of trace) {
    const pid = event.problemId;
    if (!problemStats[pid]) {
      problemStats[pid] = { errors: 0, hints: 0, lastHintTime: 0, firstEventTime: event.timestamp };
    }
    const stats = problemStats[pid];
    
    // Copy the event
    const simulatedEvent = { ...event };
    
    // Apply policy logic
    if (event.eventType === 'error') {
      stats.errors++;
      
      // Check if policy would escalate
      const shouldEscalate = checkEscalation(policy, stats, event.timestamp);
      
      if (shouldEscalate && policy.hintsEnabled) {
        escalations++;
        // Add an escalation event
        events.push({
          id: `sim-esc-${event.id}`,
          learnerId: event.learnerId,
          timestamp: event.timestamp + 100,
          eventType: 'guidance_escalate',
          problemId: pid,
          fromRung: Math.min(stats.hints, 3),
          toRung: 3,
          trigger: 'auto_escalation_eligible'
        });
      }
    }
    
    if (event.eventType === 'hint_view' || event.eventType === 'guidance_view') {
      stats.hints++;
      hints++;
      
      // For explanation_first, convert hints to explanations
      if (policy.id === 'explanation_first') {
        simulatedEvent.eventType = 'explanation_view';
        explanations++;
      }
    }
    
    if (event.eventType === 'explanation_view') {
      explanations++;
      
      // For no_hints, skip explanations
      if (policy.id === 'no_hints') {
        continue; // Skip this event
      }
    }
    
    // For no_hints policy, skip all help events
    if (policy.id === 'no_hints' && 
        (event.eventType === 'hint_request' || 
         event.eventType === 'hint_view' ||
         event.eventType === 'guidance_request' ||
         event.eventType === 'guidance_view')) {
      continue;
    }
    
    events.push(simulatedEvent);
  }
  
  return { events, escalations, explanations, hints };
}

/**
 * Check if policy would trigger escalation
 */
function checkEscalation(policy, stats, currentTime) {
  // Disabled escalation
  if (policy.thresholds.escalate < 0) return false;
  
  // Immediate escalation (explanation_first)
  if (policy.thresholds.escalate === 0) return stats.errors > 0;
  
  // Error threshold
  if (stats.errors >= policy.thresholds.escalate) return true;
  
  // Time stuck
  const timeSpent = currentTime - stats.firstEventTime;
  if (timeSpent >= policy.triggers.timeStuck) return true;
  
  // Rung exhausted
  if (stats.hints >= policy.triggers.rungExhausted) return true;
  
  return false;
}

/**
 * Aggregate metrics across traces
 */
function aggregateMetrics(metrics) {
  if (metrics.length === 0) return getEmptyMetrics();
  if (metrics.length === 1) return metrics[0];
  
  const avg = (vals) => vals.reduce((a, b) => a + b, 0) / vals.length;
  
  const allConcepts = new Set();
  const allMastered = new Set();
  metrics.forEach(m => {
    m.conceptsEncountered.forEach(c => allConcepts.add(c));
    m.conceptsMastered.forEach(c => allMastered.add(c));
  });
  
  return {
    conceptCoverageRate: avg(metrics.map(m => m.conceptCoverageRate)),
    conceptsEncountered: Array.from(allConcepts),
    conceptsMastered: Array.from(allMastered),
    explanationRequestRate: avg(metrics.map(m => m.explanationRequestRate)),
    averageEscalationDepth: avg(metrics.map(m => m.averageEscalationDepth)),
    totalHelpRequests: metrics.reduce((sum, m) => sum + m.totalHelpRequests, 0),
    hintDependencyIndex: avg(metrics.map(m => m.hintDependencyIndex)),
    independentSuccessRate: avg(metrics.map(m => m.independentSuccessRate)),
    hdiComponents: {
      hpa: avg(metrics.map(m => m.hdiComponents.hpa)),
      aed: avg(metrics.map(m => m.hdiComponents.aed)),
      er: avg(metrics.map(m => m.hdiComponents.er)),
      reae: avg(metrics.map(m => m.hdiComponents.reae)),
      iwh: avg(metrics.map(m => m.hdiComponents.iwh))
    },
    averageTimeToSuccess: avg(metrics.map(m => m.averageTimeToSuccess)),
    totalSessionTime: metrics.reduce((sum, m) => sum + m.totalSessionTime, 0),
    interactionsPerProblem: avg(metrics.map(m => m.interactionsPerProblem)),
    timeToFirstSuccess: avg(metrics.map(m => m.timeToFirstSuccess)),
    errorReductionRate: avg(metrics.map(m => m.errorReductionRate)),
    retentionEstimate: avg(metrics.map(m => m.retentionEstimate)),
    firstAttemptSuccessRate: avg(metrics.map(m => m.firstAttemptSuccessRate)),
    totalProblems: metrics.reduce((sum, m) => sum + m.totalProblems, 0),
    problemsSolved: metrics.reduce((sum, m) => sum + m.problemsSolved, 0),
    totalErrors: metrics.reduce((sum, m) => sum + m.totalErrors, 0),
    totalHintsViewed: metrics.reduce((sum, m) => sum + m.totalHintsViewed, 0),
    totalExplanationsViewed: metrics.reduce((sum, m) => sum + m.totalExplanationsViewed, 0)
  };
}

/**
 * Compute statistics (mean, stdDev, confidence interval)
 */
function computeStatistics(values) {
  if (values.length === 0) {
    return { mean: 0, stdDev: 0, min: 0, max: 0, confidence95: [0, 0] };
  }
  
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
  const stdDev = Math.sqrt(variance);
  const min = Math.min(...values);
  const max = Math.max(...values);
  
  const standardError = stdDev / Math.sqrt(values.length);
  const margin = 1.96 * standardError;
  
  return { mean, stdDev, min, max, confidence95: [mean - margin, mean + margin] };
}

/**
 * Generate comparison report
 */
function generateReport(results) {
  const report = {
    version: REPLAY_VERSION,
    policySemanticsVersion: POLICY_SEMANTICS_VERSION,
    generatedAt: new Date().toISOString(),
    summary: {
      totalPolicies: results.length,
      totalTraces: results[0]?.traceCount || 0,
      policies: results.map(r => ({
        id: r.policyId,
        name: r.policy.name,
        description: r.policy.description,
        metrics: r.aggregateMetrics,
        statistics: r.statistics
      }))
    },
    comparisons: generateComparisons(results),
    policyResults: results
  };
  
  return report;
}

/**
 * Generate policy comparisons
 */
function generateComparisons(results) {
  const comparisons = [];
  
  // Pairwise comparisons
  for (let i = 0; i < results.length; i++) {
    for (let j = i + 1; j < results.length; j++) {
      const a = results[i];
      const b = results[j];
      
      comparisons.push({
        policyA: a.policyId,
        policyB: b.policyId,
        hdiDifference: a.aggregateMetrics.hintDependencyIndex - b.aggregateMetrics.hintDependencyIndex,
        coverageDifference: a.aggregateMetrics.conceptCoverageRate - b.aggregateMetrics.conceptCoverageRate,
        successRateDifference: 
          (a.aggregateMetrics.problemsSolved / Math.max(a.aggregateMetrics.totalProblems, 1)) -
          (b.aggregateMetrics.problemsSolved / Math.max(b.aggregateMetrics.totalProblems, 1)),
        timeDifference: a.aggregateMetrics.averageTimeToSuccess - b.aggregateMetrics.averageTimeToSuccess
      });
    }
  }
  
  return comparisons;
}

/**
 * Convert metrics to CSV format
 */
function metricsToCsv(policyResults) {
  const headers = [
    'policy_id',
    'policy_name',
    'trace_count',
    'concept_coverage_rate',
    'concepts_encountered_count',
    'concepts_mastered_count',
    'explanation_request_rate',
    'average_escalation_depth',
    'total_help_requests',
    'hint_dependency_index',
    'independent_success_rate',
    'hdi_hpa',
    'hdi_aed',
    'hdi_er',
    'hdi_reae',
    'hdi_iwh',
    'average_time_to_success',
    'total_session_time',
    'interactions_per_problem',
    'time_to_first_success',
    'error_reduction_rate',
    'retention_estimate',
    'first_attempt_success_rate',
    'total_problems',
    'problems_solved',
    'total_errors',
    'total_hints_viewed',
    'total_explanations_viewed'
  ];
  
  const rows = policyResults.map(r => {
    const m = r.aggregateMetrics;
    return [
      r.policyId,
      r.policy.name,
      r.traceCount,
      m.conceptCoverageRate.toFixed(4),
      m.conceptsEncountered.length,
      m.conceptsMastered.length,
      m.explanationRequestRate.toFixed(4),
      m.averageEscalationDepth.toFixed(4),
      m.totalHelpRequests,
      m.hintDependencyIndex.toFixed(4),
      m.independentSuccessRate.toFixed(4),
      m.hdiComponents.hpa.toFixed(4),
      m.hdiComponents.aed.toFixed(4),
      m.hdiComponents.er.toFixed(4),
      m.hdiComponents.reae.toFixed(4),
      m.hdiComponents.iwh.toFixed(4),
      m.averageTimeToSuccess.toFixed(0),
      m.totalSessionTime.toFixed(0),
      m.interactionsPerProblem.toFixed(2),
      m.timeToFirstSuccess.toFixed(0),
      m.errorReductionRate.toFixed(4),
      m.retentionEstimate.toFixed(4),
      m.firstAttemptSuccessRate.toFixed(4),
      m.totalProblems,
      m.problemsSolved,
      m.totalErrors,
      m.totalHintsViewed,
      m.totalExplanationsViewed
    ].join(',');
  });
  
  return [headers.join(','), ...rows].join('\n');
}

/**
 * Convert statistics to CSV
 */
function statisticsToCsv(policyResults) {
  const headers = [
    'policy_id',
    'metric',
    'mean',
    'std_dev',
    'min',
    'max',
    'ci_95_lower',
    'ci_95_upper'
  ];
  
  const rows = [];
  
  for (const result of policyResults) {
    const metrics = [
      { name: 'hdi', stats: result.statistics.hdi },
      { name: 'coverage', stats: result.statistics.coverage },
      { name: 'success_rate', stats: result.statistics.successRate },
      { name: 'time_to_success', stats: result.statistics.timeToSuccess }
    ];
    
    for (const metric of metrics) {
      rows.push([
        result.policyId,
        metric.name,
        metric.stats.mean.toFixed(4),
        metric.stats.stdDev.toFixed(4),
        metric.stats.min.toFixed(4),
        metric.stats.max.toFixed(4),
        metric.stats.confidence95[0].toFixed(4),
        metric.stats.confidence95[1].toFixed(4)
      ].join(','));
    }
  }
  
  return [headers.join(','), ...rows].join('\n');
}

/**
 * Main experiment runner
 */
async function runExperiment() {
  const args = parseArgs(process.argv.slice(2));
  
  if (args.help) {
    printHelp();
    return;
  }
  
  console.log('Replay Experiment Framework');
  console.log(`Version: ${REPLAY_VERSION}`);
  console.log(`Policies: ${args.policies.join(', ')}`);
  console.log('');
  
  // Validate policies
  const invalidPolicies = args.policies.filter(p => !ALL_POLICIES.includes(p));
  if (invalidPolicies.length > 0) {
    throw new Error(`Invalid policies: ${invalidPolicies.join(', ')}`);
  }
  
  // Load traces
  console.log(`Loading traces from: ${args.input}`);
  const traces = await loadTraces(path.resolve(REPO_ROOT, args.input));
  console.log(`Loaded ${traces.length} learner traces`);
  console.log('');
  
  // Run simulation for each policy
  const results = [];
  for (const policyId of args.policies) {
    console.log(`Simulating policy: ${policyId}...`);
    const result = await simulatePolicy(traces, policyId);
    results.push(result);
    console.log(`  HDI: ${result.aggregateMetrics.hintDependencyIndex.toFixed(4)}`);
    console.log(`  Problems solved: ${result.aggregateMetrics.problemsSolved}/${result.aggregateMetrics.totalProblems}`);
    console.log(`  Avg time to success: ${result.aggregateMetrics.averageTimeToSuccess.toFixed(0)}ms`);
    console.log('');
  }
  
  // Generate report
  console.log('Generating comparison report...');
  const report = generateReport(results);
  
  // Ensure output directory exists
  const outputDir = path.resolve(REPO_ROOT, args.output);
  await mkdir(outputDir, { recursive: true });
  
  // Write JSON output
  if (args.format === 'json' || args.format === 'both') {
    const jsonPath = path.join(outputDir, 'experiment-results.json');
    await writeFile(jsonPath, JSON.stringify(report, null, 2), 'utf8');
    console.log(`JSON report: ${path.relative(REPO_ROOT, jsonPath)}`);
    
    // Write full trace reconstruction
    const tracesPath = path.join(outputDir, 'trace-reconstruction.json');
    await writeFile(tracesPath, JSON.stringify({
      version: REPLAY_VERSION,
      traces: results.map(r => ({
        policyId: r.policyId,
        learnerResults: r.results
      }))
    }, null, 2), 'utf8');
    console.log(`Trace reconstruction: ${path.relative(REPO_ROOT, tracesPath)}`);
  }
  
  // Write CSV output
  if (args.format === 'csv' || args.format === 'both') {
    const metricsCsv = metricsToCsv(results);
    const metricsPath = path.join(outputDir, 'metrics.csv');
    await writeFile(metricsPath, metricsCsv, 'utf8');
    console.log(`Metrics CSV: ${path.relative(REPO_ROOT, metricsPath)}`);
    
    const statsCsv = statisticsToCsv(results);
    const statsPath = path.join(outputDir, 'statistics.csv');
    await writeFile(statsPath, statsCsv, 'utf8');
    console.log(`Statistics CSV: ${path.relative(REPO_ROOT, statsPath)}`);
  }
  
  // Write summary
  const summaryPath = path.join(outputDir, 'summary.txt');
  const summaryText = generateTextSummary(report);
  await writeFile(summaryPath, summaryText, 'utf8');
  console.log(`Summary: ${path.relative(REPO_ROOT, summaryPath)}`);
  
  // Compute and log checksum
  const checksum = crypto
    .createHash('sha256')
    .update(stableSerialize({
      version: REPLAY_VERSION,
      policyResults: results.map(r => ({
        policyId: r.policyId,
        aggregateMetrics: r.aggregateMetrics
      }))
    }))
    .digest('hex');
  
  console.log('');
  console.log(`Policy-only checksum: ${checksum}`);
  console.log('');
  console.log('Experiment complete!');
}

/**
 * Generate text summary
 */
function generateTextSummary(report) {
  const lines = [
    'Replay Experiment Results',
    '========================',
    '',
    `Version: ${report.version}`,
    `Generated: ${report.generatedAt}`,
    `Total Policies: ${report.summary.totalPolicies}`,
    `Total Traces: ${report.summary.totalTraces}`,
    '',
    'Policy Results',
    '--------------',
    ''
  ];
  
  for (const policy of report.summary.policies) {
    lines.push(`Policy: ${policy.name} (${policy.id})`);
    lines.push(`  Description: ${policy.description}`);
    lines.push(`  HDI: ${policy.metrics.hintDependencyIndex.toFixed(4)}`);
    lines.push(`  Concept Coverage: ${(policy.metrics.conceptCoverageRate * 100).toFixed(2)}%`);
    lines.push(`  Explanation Rate: ${(policy.metrics.explanationRequestRate * 100).toFixed(2)}%`);
    lines.push(`  Problems Solved: ${policy.metrics.problemsSolved}/${policy.metrics.totalProblems}`);
    lines.push(`  Avg Time to Success: ${policy.metrics.averageTimeToSuccess.toFixed(0)}ms`);
    lines.push(`  First Attempt Success: ${(policy.metrics.firstAttemptSuccessRate * 100).toFixed(2)}%`);
    lines.push(`  Error Reduction: ${(policy.metrics.errorReductionRate * 100).toFixed(2)}%`);
    lines.push('');
  }
  
  if (report.comparisons.length > 0) {
    lines.push('Policy Comparisons');
    lines.push('------------------');
    lines.push('');
    
    for (const comp of report.comparisons) {
      lines.push(`${comp.policyA} vs ${comp.policyB}:`);
      lines.push(`  HDI Diff: ${comp.hdiDifference > 0 ? '+' : ''}${comp.hdiDifference.toFixed(4)}`);
      lines.push(`  Coverage Diff: ${(comp.coverageDifference * 100).toFixed(2)}%`);
      lines.push(`  Success Rate Diff: ${(comp.successRateDifference * 100).toFixed(2)}%`);
      lines.push(`  Time Diff: ${comp.timeDifference.toFixed(0)}ms`);
      lines.push('');
    }
  }
  
  return lines.join('\n');
}

// Run the experiment
runExperiment().catch((error) => {
  console.error('Error:', error.message);
  process.exit(1);
});
