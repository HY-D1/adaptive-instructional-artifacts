import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..');

const DEFAULT_INPUT = path.join(REPO_ROOT, 'dist/replay/real/export.json');
const DEFAULT_OUTPUT = path.join(REPO_ROOT, 'dist/replay/real/replay-output.json');

const REPLAY_HARNESS_VERSION = 'real-replay-harness-v1';
const REPLAY_POLICY_SEMANTICS_VERSION = 'orchestrator-auto-escalation-variant-v2';

const STRATEGY_THRESHOLDS = {
  'hint-only': { escalate: Number.POSITIVE_INFINITY, aggregate: Number.POSITIVE_INFINITY },
  'adaptive-low': { escalate: 5, aggregate: 10 },
  'adaptive-medium': { escalate: 3, aggregate: 6 },
  'adaptive-high': { escalate: 2, aggregate: 4 }
};

const POLICIES = [
  {
    id: 'hint-only-baseline',
    strategy: 'hint-only',
    policyVersion: 'hint-only-baseline-v3'
  },
  {
    id: 'adaptive-textbook',
    strategy: 'adaptive-medium',
    policyVersion: 'adaptive-textbook-v3'
  }
];

const POLICY_REPLAY_EVENT_TYPES = new Set(['execution', 'error', 'hint_view', 'explanation_view']);
const AUTO_ESCALATION_MODES = new Set(['always-after-hint-threshold', 'threshold-gated']);

function parseArgs(argv) {
  const args = {
    input: DEFAULT_INPUT,
    output: DEFAULT_OUTPUT,
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

function analyzeContext(interactions, problemId, nowTimestamp) {
  const problemInteractions = interactions.filter((i) => i.problemId === problemId);
  const errors = problemInteractions.filter((i) => i.eventType === 'error');
  const hints = problemInteractions.filter((i) => i.eventType === 'hint_view');

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
  const hintViews = problemInteractions.filter((interaction) => interaction.eventType === 'hint_view');

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

function selectDecision(context, thresholds, autoEscalation, autoEscalationMode) {
  if (context.errorCount === 0) {
    return {
      decision: 'show_hint',
      ruleFired: 'no-errors-show-hint',
      reasoning: 'No errors detected, showing basic hint'
    };
  }

  const thresholdMet = context.errorCount >= thresholds.escalate && context.retryCount >= 2;

  if (
    Number.isFinite(thresholds.escalate) &&
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
      reasoning: `Error count (${context.errorCount}) and retries (${context.retryCount}) exceed escalation threshold (${thresholds.escalate})`
    };
  }

  if (context.errorCount >= thresholds.aggregate || context.timeSpent > 600000) {
    return {
      decision: 'add_to_textbook',
      ruleFired: 'aggregation-threshold-met',
      reasoning: `High error count (${context.errorCount}) or extended time (${Math.round(context.timeSpent / 1000)}s) suggests need for comprehensive notes`
    };
  }

  return {
    decision: 'show_hint',
    ruleFired: 'progressive-hint',
    reasoning: `Below escalation threshold (${thresholds.escalate}), showing level ${context.currentHintLevel + 1} hint`
  };
}

function replayDecisions(interactions, strategy, autoEscalationMode) {
  const thresholds = STRATEGY_THRESHOLDS[strategy];
  const running = [];

  return interactions.map((event, index) => {
    running.push(event);
    const context = analyzeContext(running, event.problemId, event.timestamp);
    const autoEscalation = getAutoEscalationState(running, event.problemId);
    const selection = selectDecision(context, thresholds, autoEscalation, autoEscalationMode);

    return {
      index: index + 1,
      eventId: event.id,
      learnerId: event.learnerId,
      timestamp: event.timestamp,
      problemId: event.problemId,
      eventType: event.eventType,
      errorSubtypeId: event.errorSubtypeId,
      strategy,
      thresholds: { ...thresholds },
      context,
      decision: selection.decision,
      ruleFired: selection.ruleFired,
      reasoning: selection.reasoning,
      policySemanticsVersion: REPLAY_POLICY_SEMANTICS_VERSION,
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
      return acc;
    },
    {
      total: 0,
      show_hint: 0,
      show_explanation: 0,
      add_to_textbook: 0
    }
  );
}

function changedDecisionsCount(decisions, baseline) {
  const baselineByIndex = new Map(baseline.map((entry) => [entry.index, entry]));
  let changed = 0;
  for (const decision of decisions) {
    const paired = baselineByIndex.get(decision.index);
    if (paired && paired.decision !== decision.decision) {
      changed += 1;
    }
  }
  return changed;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (!AUTO_ESCALATION_MODES.has(args.autoEscalationMode)) {
    throw new Error(`Unsupported auto escalation mode: ${args.autoEscalationMode}`);
  }

  const inputPath = path.resolve(REPO_ROOT, args.input);
  const outputPath = path.resolve(REPO_ROOT, args.output);

  const raw = await readFile(inputPath, 'utf8');
  const payload = JSON.parse(raw);
  const interactions = Array.isArray(payload.interactions) ? payload.interactions : [];

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

  const policyResults = [];
  let baseline = [];

  for (const policy of POLICIES) {
    const decisions = replayDecisions(replayInput, policy.strategy, args.autoEscalationMode);
    if (policy.strategy === 'hint-only') {
      baseline = decisions;
    }

    policyResults.push({
      policy_id: policy.id,
      strategy: policy.strategy,
      policy_version: policy.policyVersion,
      auto_escalation_mode: args.autoEscalationMode,
      policy_semantics_version: REPLAY_POLICY_SEMANTICS_VERSION,
      thresholds: { ...STRATEGY_THRESHOLDS[policy.strategy] },
      summary: summarize(decisions),
      changed_decisions_vs_hint_only: 0,
      decisions
    });
  }

  policyResults.forEach((result) => {
    result.changed_decisions_vs_hint_only = changedDecisionsCount(result.decisions, baseline);
  });

  const output = {
    input_path: path.relative(REPO_ROOT, inputPath),
    replay_harness_version: REPLAY_HARNESS_VERSION,
    replay_policy_semantics_version: REPLAY_POLICY_SEMANTICS_VERSION,
    auto_escalation_mode: args.autoEscalationMode,
    sql_engage_policy_version: replayInput.find((event) => typeof event.policyVersion === 'string' && event.policyVersion.trim())?.policyVersion || 'unknown',
    input_trace_count: replayInput.length,
    policy_results: policyResults
  };

  output.policy_only_checksum_sha256 = crypto
    .createHash('sha256')
    .update(stableSerialize({
      replay_policy_semantics_version: output.replay_policy_semantics_version,
      auto_escalation_mode: output.auto_escalation_mode,
      policy_results: output.policy_results
    }))
    .digest('hex');

  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`, 'utf8');

  console.log(`Replay export written: ${path.relative(REPO_ROOT, outputPath)}`);
  console.log(`Policy-only checksum sha256: ${output.policy_only_checksum_sha256}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
