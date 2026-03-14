#!/usr/bin/env node
/**
 * Real Trace Replay
 * 
 * Replays real learner traces against canonical escalation policies.
 * Aligned with policy-definitions.ts for consistent experimental vocabulary.
 * 
 * Usage:
 *   node scripts/replay-real.mjs [options]
 * 
 * Options:
 *   --input <path>              Input trace file (default: dist/replay/real/export.json)
 *   --output <path>             Output file (default: dist/replay/real/replay-output.json)
 *   --policy <id>               Policy to simulate (default: adaptive)
 *   --auto-escalation-mode <m>  Auto-escalation mode (default: always-after-hint-threshold)
 * 
 * @version real-replay-harness-v2
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..');

const DEFAULT_INPUT = path.join(REPO_ROOT, 'dist/replay/real/export.json');
const DEFAULT_OUTPUT = path.join(REPO_ROOT, 'dist/replay/real/replay-output.json');
const POLICIES_JSON_PATH = path.join(REPO_ROOT, 'dist/policies.json');

const REPLAY_HARNESS_VERSION = 'real-replay-harness-v2';

// Auto-escalation modes
const AUTO_ESCALATION_MODES = new Set(['always-after-hint-threshold', 'threshold-gated']);

/**
 * Load canonical policies
 */
async function loadPolicies() {
  try {
    const raw = await readFile(POLICIES_JSON_PATH, 'utf8');
    const exported = JSON.parse(raw);
    return {
      policies: exported.policies,
      policyIds: exported.policyIds,
      policyVersion: exported.policyVersion
    };
  } catch (error) {
    // Fallback to embedded definitions
    return {
      policies: {
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
      },
      policyIds: ['aggressive', 'conservative', 'explanation_first', 'adaptive', 'no_hints'],
      policyVersion: 'policy-definitions-v1'
    };
  }
}

function parseArgs(argv) {
  const args = {
    input: DEFAULT_INPUT,
    output: DEFAULT_OUTPUT,
    policy: 'adaptive',
    autoEscalationMode: 'always-after-hint-threshold'
  };

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === '--input') {
      args.input = argv[i + 1] || args.input;
      i += 1;
      continue;
    }
    if (token === '--output') {
      args.output = argv[i + 1] || args.output;
      i += 1;
      continue;
    }
    if (token === '--policy') {
      args.policy = argv[i + 1] || args.policy;
      i += 1;
      continue;
    }
    if (token === '--auto-escalation-mode') {
      args.autoEscalationMode = argv[i + 1] || args.autoEscalationMode;
      i += 1;
      continue;
    }
  }

  return args;
}

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

function sha256(data) {
  return crypto.createHash('sha256').update(data).digest('hex');
}

const POLICY_REPLAY_EVENT_TYPES = new Set([
  'execution', 
  'error', 
  'hint_view', 
  'explanation_view',
  'guidance_view',
  'guidance_escalate'
]);

function analyzeContext(interactions, problemId, nowTimestamp) {
  const problemInteractions = interactions.filter((i) => i.problemId === problemId);
  const errors = problemInteractions.filter((i) => i.eventType === 'error');
  const hints = problemInteractions.filter((i) => i.eventType === 'hint_view' || i.eventType === 'guidance_view');

  return {
    errorCount: errors.length,
    retryCount: Math.max(0, errors.length - 1),
    timeSpent: problemInteractions.length > 0 ? nowTimestamp - problemInteractions[0].timestamp : 0,
    currentHintLevel: Math.min(hints.length, 3),
    recentErrors: errors.slice(-5).map((entry) => entry.errorSubtypeId).filter(Boolean)
  };
}

function getAutoEscalationState(interactions, problemId, hintThreshold = 3) {
  const problemInteractions = interactions
    .filter((interaction) => interaction.problemId === problemId)
    .sort((a, b) => a.timestamp - b.timestamp);
  const hintViews = problemInteractions.filter((interaction) => 
    interaction.eventType === 'hint_view' || interaction.eventType === 'guidance_view'
  );

  if (hintViews.length < hintThreshold) {
    return { shouldEscalate: false, hintCount: hintViews.length };
  }

  const thresholdHint = hintViews[hintThreshold - 1];
  const explanationAfterThreshold = problemInteractions.some(
    (interaction) => interaction.eventType === 'explanation_view' && interaction.timestamp >= thresholdHint.timestamp
  );
  const latestErrorAfterThreshold = [...problemInteractions]
    .reverse()
    .find(
      (interaction) =>
        interaction.eventType === 'error' &&
        interaction.timestamp >= thresholdHint.timestamp
    );
  const triggerInteractionId = latestErrorAfterThreshold?.id || thresholdHint.id;

  return {
    shouldEscalate: !explanationAfterThreshold,
    triggerErrorId: triggerInteractionId,
    hintCount: hintViews.length
  };
}

function selectDecision(context, policy, autoEscalation, autoEscalationMode) {
  // Handle no_hints policy
  if (!policy.hintsEnabled && policy.id === 'no_hints') {
    return {
      decision: 'no_help',
      ruleFired: 'no-hints-policy',
      reasoning: 'No hints policy - no assistance provided'
    };
  }

  // Handle explanation_first policy
  if (!policy.hintsEnabled && policy.id === 'explanation_first') {
    if (context.errorCount > 0) {
      return {
        decision: 'show_explanation',
        ruleFired: 'explanation-first-immediate',
        reasoning: 'Explanation-first policy - immediate explanation on error'
      };
    }
    return {
      decision: 'wait',
      ruleFired: 'explanation-first-wait',
      reasoning: 'Explanation-first policy - waiting for error'
    };
  }

  // Standard policy logic
  if (context.errorCount === 0) {
    return {
      decision: 'show_hint',
      ruleFired: 'no-errors-show-hint',
      reasoning: 'No errors detected, showing basic hint'
    };
  }

  const threshold = policy.thresholds.escalate;
  const thresholdMet = context.errorCount >= threshold && context.retryCount >= 2;

  if (
    Number.isFinite(threshold) &&
    threshold >= 0 &&
    autoEscalation.shouldEscalate &&
    (autoEscalationMode === 'always-after-hint-threshold' || thresholdMet)
  ) {
    return {
      decision: 'show_explanation',
      ruleFired: 'auto-escalation-after-hints',
      reasoning:
        autoEscalationMode === 'threshold-gated'
          ? `Threshold-gated auto-escalation triggered after ${autoEscalation.hintCount} hints and threshold match`
          : `Auto-escalation triggered after ${autoEscalation.hintCount} hints with no explanation yet`
    };
  }

  if (thresholdMet) {
    return {
      decision: 'show_explanation',
      ruleFired: 'escalation-threshold-met',
      reasoning: `Error count (${context.errorCount}) and retries (${context.retryCount}) exceed escalation threshold (${threshold})`
    };
  }

  if (context.errorCount >= policy.thresholds.aggregate || context.timeSpent > 600000) {
    return {
      decision: 'add_to_textbook',
      ruleFired: 'aggregation-threshold-met',
      reasoning: `High error count (${context.errorCount}) or extended time (${Math.round(context.timeSpent / 1000)}s) suggests need for comprehensive notes`
    };
  }

  return {
    decision: 'show_hint',
    ruleFired: 'progressive-hint',
    reasoning: `Below escalation threshold (${threshold}), showing level ${context.currentHintLevel + 1} hint`
  };
}

function replayDecisions(interactions, policy, autoEscalationMode) {
  const running = [];

  return interactions.map((event, index) => {
    running.push(event);
    const context = analyzeContext(running, event.problemId, event.timestamp);
    const autoEscalation = getAutoEscalationState(running, event.problemId);
    const selection = selectDecision(context, policy, autoEscalation, autoEscalationMode);

    return {
      index: index + 1,
      eventId: event.id,
      learnerId: event.learnerId,
      timestamp: event.timestamp,
      problemId: event.problemId,
      eventType: event.eventType,
      errorSubtypeId: event.errorSubtypeId,
      policyId: policy.id,
      policyName: policy.name,
      thresholds: { ...policy.thresholds },
      context,
      decision: selection.decision,
      ruleFired: selection.ruleFired,
      reasoning: selection.reasoning,
      policySemanticsVersion: policy.version || 'policy-definitions-v1',
      harnessVersion: REPLAY_HARNESS_VERSION,
      autoEscalationMode
    };
  });
}

function summarize(decisions) {
  return decisions.reduce(
    (acc, decision) => {
      acc.total += 1;
      if (decision.decision === 'show_hint') acc.show_hint += 1;
      if (decision.decision === 'show_explanation') acc.show_explanation += 1;
      if (decision.decision === 'add_to_textbook') acc.add_to_textbook += 1;
      if (decision.decision === 'no_help') acc.no_help += 1;
      return acc;
    },
    {
      total: 0,
      show_hint: 0,
      show_explanation: 0,
      add_to_textbook: 0,
      no_help: 0
    }
  );
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  
  // Load canonical policies
  const { policies, policyIds, policyVersion } = await loadPolicies();
  
  if (!AUTO_ESCALATION_MODES.has(args.autoEscalationMode)) {
    throw new Error(`Unsupported auto escalation mode: ${args.autoEscalationMode}`);
  }
  
  if (!policyIds.includes(args.policy)) {
    throw new Error(`Unknown policy: ${args.policy}. Available: ${policyIds.join(', ')}`);
  }
  
  const policy = policies[args.policy];

  const inputPath = path.resolve(REPO_ROOT, args.input);
  const outputPath = path.resolve(REPO_ROOT, args.output);

  const raw = await readFile(inputPath, 'utf8');
  const payload = JSON.parse(raw);
  const interactions = Array.isArray(payload.interactions) ? payload.interactions : [];
  
  // Compute input checksum
  const inputChecksum = sha256(stableSerialize(interactions));

  const replayInput = interactions
    .filter((interaction) => interaction?.problemId && POLICY_REPLAY_EVENT_TYPES.has(interaction.eventType))
    .sort((a, b) => {
      const timeDelta = Number(a.timestamp) - Number(b.timestamp);
      if (timeDelta !== 0) return timeDelta;
      const learnerDelta = String(a.learnerId || '').localeCompare(String(b.learnerId || ''));
      if (learnerDelta !== 0) return learnerDelta;
      const problemDelta = String(a.problemId || '').localeCompare(String(b.problemId || ''));
      if (problemDelta !== 0) return problemDelta;
      return String(a.id || '').localeCompare(String(b.id || ''));
    });

  const decisions = replayDecisions(replayInput, policy, args.autoEscalationMode);
  const summary = summarize(decisions);

  const output = {
    input_path: path.relative(REPO_ROOT, inputPath),
    input_checksum_sha256: inputChecksum,
    replay_harness_version: REPLAY_HARNESS_VERSION,
    policy_semantics_version: policyVersion,
    auto_escalation_mode: args.autoEscalationMode,
    sql_engage_policy_version: replayInput.find((event) => typeof event.policyVersion === 'string' && event.policyVersion.trim())?.policyVersion || 'unknown',
    input_trace_count: replayInput.length,
    policy: {
      id: policy.id,
      name: policy.name,
      description: policy.description,
      thresholds: policy.thresholds,
      hints_enabled: policy.hintsEnabled,
      uses_bandit: policy.usesBandit
    },
    summary,
    decisions
  };
  
  // Compute policy-only checksum
  output.policy_only_checksum_sha256 = sha256(
    stableSerialize({
      policy_semantics_version: output.policy_semantics_version,
      auto_escalation_mode: output.auto_escalation_mode,
      policy: output.policy,
      summary: output.summary
    })
  );

  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`, 'utf8');

  console.log(`Real replay export written: ${path.relative(REPO_ROOT, outputPath)}`);
  console.log(`Policy: ${policy.name} (${policy.id})`);
  console.log(`Input checksum: ${inputChecksum}`);
  console.log(`Policy-only checksum: ${output.policy_only_checksum_sha256}`);
  console.log(`Decisions: ${summary.total} total, ${summary.show_explanation} explanations, ${summary.show_hint} hints`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
