import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..');

const FIXTURE_PATH = path.join(REPO_ROOT, 'apps/web/src/app/data/toy-replay-fixture.json');
const SQL_ENGAGE_TS_PATH = path.join(REPO_ROOT, 'apps/web/src/app/data/sql-engage.ts');
const SQL_ENGAGE_CSV_PATH = path.join(REPO_ROOT, 'apps/web/src/app/data/sql_engage_dataset.csv');
const OUTPUT_PATH = path.join(REPO_ROOT, 'dist/replay/toy-replay-output.json');
const REPLAY_HARNESS_VERSION = 'toy-replay-harness-v2';
const REPLAY_POLICY_SEMANTICS_VERSION = 'orchestrator-aligned-v1';

const ALIASES = {
  'unknown column': 'undefined column',
  'no such column': 'undefined column',
  'unknown table': 'undefined table',
  'no such table': 'undefined table',
  'unknown function': 'undefined function',
  'ambiguous column': 'ambiguous reference'
};

const SUBTYPE_LADDER_GUIDANCE = {
  'incomplete query': [
    'Start by completing the missing part of your SQL statement.',
    'Check whether each clause is present and complete before running again.',
    'Build the query incrementally: SELECT -> FROM -> WHERE/JOIN/GROUP BY, validating each step.'
  ],
  'undefined table': [
    'The table reference is likely incorrect.',
    'Verify the exact table name from the schema and use that spelling.',
    'Match every table in your query to a real schema table, then retry.'
  ],
  'undefined column': [
    'One or more column names do not match the schema.',
    'Compare your selected/filtered columns against the exact column names in the table.',
    'Rewrite the query with only verified column names, then add extra fields one at a time.'
  ],
  'undefined function': [
    'A function in the query is not recognized.',
    'Replace unsupported function names with functions available in this SQL dialect.',
    'Confirm function signatures and test the function on a small query first.'
  ],
  'ambiguous reference': [
    'A column reference is ambiguous across multiple tables.',
    'Prefix overlapping columns with table names or aliases.',
    'Use explicit aliases throughout SELECT, WHERE, GROUP BY, and ORDER BY.'
  ],
  'wrong positioning': [
    'A clause appears in the wrong order.',
    'Reorder clauses to standard SQL order.',
    'Use a fixed skeleton (SELECT -> FROM -> JOIN -> WHERE -> GROUP BY -> HAVING -> ORDER BY).'
  ]
};

const POLICIES = [
  {
    id: 'hint-only-baseline',
    strategy: 'hint-only',
    policyVersion: 'hint-only-baseline-v2'
  },
  {
    id: 'adaptive-textbook',
    strategy: 'adaptive-medium',
    policyVersion: 'adaptive-textbook-v2'
  }
];

const STRATEGY_THRESHOLDS = {
  'hint-only': { escalate: Number.POSITIVE_INFINITY, aggregate: Number.POSITIVE_INFINITY },
  adaptive: { escalate: 3, aggregate: 6 },
  'adaptive-low': { escalate: 5, aggregate: 10 },
  'adaptive-medium': { escalate: 3, aggregate: 6 },
  'adaptive-high': { escalate: 2, aggregate: 4 }
};

function stableHash(input) {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash * 31 + input.charCodeAt(i)) >>> 0;
  }
  return hash;
}

function deterministicId(prefix, seed) {
  return `${prefix}-${stableHash(seed).toString(16).padStart(8, '0')}`;
}

function parseCsvLine(line) {
  const values = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    const next = line[i + 1];

    if (ch === '"' && inQuotes && next === '"') {
      current += '"';
      i += 1;
      continue;
    }
    if (ch === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (ch === ',' && !inQuotes) {
      values.push(current.trim());
      current = '';
      continue;
    }
    current += ch;
  }

  values.push(current.trim());
  return values;
}

function parseSqlEngageRows(csvRaw) {
  const lines = csvRaw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length === 0) return [];

  const headers = parseCsvLine(lines[0]);
  const idx = {
    error_subtype: headers.indexOf('error_subtype'),
    feedback_target: headers.indexOf('feedback_target'),
    intended_learning_outcome: headers.indexOf('intended_learning_outcome')
  };

  if (Object.values(idx).some((n) => n < 0)) {
    throw new Error('CSV headers are missing expected SQL-Engage fields');
  }

  return lines.slice(1).map((line, i) => {
    const cols = parseCsvLine(line);
    const rowNum = i + 2;
    return {
      rowId: `sql-engage:${rowNum}`,
      error_subtype: cols[idx.error_subtype] || '',
      feedback_target: cols[idx.feedback_target] || '',
      intended_learning_outcome: cols[idx.intended_learning_outcome] || ''
    };
  });
}

function buildSubtypeIndex(rows) {
  return rows.reduce((acc, row) => {
    const key = row.error_subtype.trim().toLowerCase();
    if (!key) return acc;
    if (!acc[key]) acc[key] = [];
    acc[key].push(row);
    return acc;
  }, {});
}

function canonicalizeSubtype(subtype, canonicalSet) {
  const raw = (subtype || '').trim().toLowerCase();
  if (!raw) return 'incomplete query';
  const aliased = ALIASES[raw] || raw;
  if (canonicalSet.has(aliased)) return aliased;
  return 'incomplete query';
}

function getAnchorRow(subtype, seed, subtypeIndex, canonicalSet) {
  const canonicalSubtype = canonicalizeSubtype(subtype, canonicalSet);
  const rows = subtypeIndex[canonicalSubtype] || [];
  if (rows.length === 0) return undefined;
  const rowIndex = stableHash(`${canonicalSubtype}|${seed}`) % rows.length;
  return rows[rowIndex];
}

function normalizeSpacing(text) {
  return text.replace(/\s+/g, ' ').trim();
}

function scrubSpecificIdentifiers(text) {
  return normalizeSpacing(
    text
      .replace(/'([A-Za-z0-9_.]+)'/g, 'the referenced item')
      .replace(/"([A-Za-z0-9_.]+)"/g, 'the referenced item')
  );
}

function appendSupportSentence(base, addon) {
  const cleaned = normalizeSpacing(addon);
  if (!cleaned) return base;
  const punctuated = /[.!?]$/.test(cleaned) ? cleaned : `${cleaned}.`;
  return `${base} ${punctuated}`;
}

function getProgressiveHintText(subtype, hintLevel, row, canonicalSet) {
  const canonicalSubtype = canonicalizeSubtype(subtype, canonicalSet);
  const ladder = SUBTYPE_LADDER_GUIDANCE[canonicalSubtype] || SUBTYPE_LADDER_GUIDANCE['incomplete query'];
  const level = Math.max(1, Math.min(3, hintLevel));

  if (level === 1) return ladder[0];
  if (level === 2) {
    const outcome = scrubSpecificIdentifiers(row?.intended_learning_outcome || '');
    return appendSupportSentence(ladder[1], outcome);
  }
  const feedback = scrubSpecificIdentifiers(row?.feedback_target || '');
  return appendSupportSentence(ladder[2], feedback);
}

function parseSqlEngagePolicyVersion(sqlEngageTsRaw) {
  const match = sqlEngageTsRaw.match(/const SQL_ENGAGE_POLICY_VERSION = '([^']+)'/);
  if (!match) {
    throw new Error('Could not parse SQL_ENGAGE_POLICY_VERSION from apps/web/src/app/data/sql-engage.ts');
  }
  return match[1];
}

function analyzeContext(problemInteractions, nowTimestamp) {
  const errorInteractions = problemInteractions.filter((i) => i.eventType === 'error');
  const executionAttempts = problemInteractions.filter(
    (i) => i.eventType === 'execution' || i.eventType === 'error'
  );
  const hintViews = problemInteractions.filter((i) => i.eventType === 'hint_view');
  const recentErrors = errorInteractions
    .slice(-5)
    .map((i) => i.errorSubtypeId)
    .filter(Boolean);

  const timeSpent = problemInteractions.length > 0
    ? nowTimestamp - problemInteractions[0].timestamp
    : 0;

  return {
    errorCount: errorInteractions.length,
    retryCount: Math.max(0, executionAttempts.length - 1),
    timeSpent,
    currentHintLevel: Math.min(hintViews.length, 3),
    recentErrors
  };
}

function getAutoEscalationState(problemInteractions, hintThreshold = 3) {
  const sorted = [...problemInteractions].sort((a, b) => a.timestamp - b.timestamp);
  const hintViews = sorted.filter((interaction) => interaction.eventType === 'hint_view');

  if (hintViews.length < hintThreshold) {
    return { shouldEscalate: false, hintCount: hintViews.length };
  }

  const thresholdHint = hintViews[hintThreshold - 1];
  const errorsAfterThreshold = sorted.filter(
    (interaction) =>
      interaction.eventType === 'error' &&
      interaction.timestamp > thresholdHint.timestamp
  );
  const latestErrorAfterThreshold = errorsAfterThreshold[errorsAfterThreshold.length - 1];
  const latestInteraction = sorted[sorted.length - 1];

  if (!latestErrorAfterThreshold || !latestInteraction || latestInteraction.id !== latestErrorAfterThreshold.id) {
    return {
      shouldEscalate: false,
      triggerErrorId: latestErrorAfterThreshold?.id,
      hintCount: hintViews.length
    };
  }

  const explanationAfterError = sorted.some(
    (interaction) =>
      interaction.eventType === 'explanation_view' &&
      interaction.timestamp >= latestErrorAfterThreshold.timestamp
  );

  return {
    shouldEscalate: !explanationAfterError,
    triggerErrorId: latestErrorAfterThreshold.id,
    hintCount: hintViews.length
  };
}

function selectDecision(context, thresholds, autoEscalation) {
  if (context.errorCount === 0) {
    return {
      decision: 'show_hint',
      ruleFired: 'no-errors-show-hint',
      reasoning: 'No errors detected, showing basic hint'
    };
  }

  if (Number.isFinite(thresholds.escalate) && autoEscalation.shouldEscalate) {
    return {
      decision: 'show_explanation',
      ruleFired: 'auto-escalation-after-hints',
      reasoning: `Auto-escalation triggered after ${autoEscalation.hintCount} hints and another failed run`
    };
  }

  if (context.errorCount >= thresholds.escalate && context.retryCount >= 2) {
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

function serializeThresholds(thresholds) {
  const normalize = (value) => (Number.isFinite(value) ? value : 'Infinity');
  return {
    escalate: normalize(thresholds.escalate),
    aggregate: normalize(thresholds.aggregate)
  };
}

function replayForPolicy(policy, fixture, sqlEngagePolicyVersion, subtypeIndex, canonicalSet) {
  const interventions = [];
  const summaries = {
    total_events: 0,
    hint_shown: 0,
    escalations: 0,
    notes_recommended: 0,
    successful_attempts: 0
  };

  for (const learnerTrace of fixture.learners) {
    const policyEvents = [];
    const thresholds = STRATEGY_THRESHOLDS[policy.strategy];
    const hintSeed = `${learnerTrace.learnerId}:${learnerTrace.problemId}`;

    for (const attempt of learnerTrace.attempts) {
      summaries.total_events += 1;
      const timestamp = fixture.baseTimestampMs + attempt.offsetMs;

      if (attempt.outcome === 'success') {
        policyEvents.push({
          id: attempt.attemptId,
          timestamp,
          eventType: 'execution',
          problemId: learnerTrace.problemId,
          successful: true
        });

        const context = analyzeContext(policyEvents, timestamp);
        summaries.successful_attempts += 1;
        interventions.push({
          event_id: attempt.attemptId,
          learner_id: learnerTrace.learnerId,
          problem_id: learnerTrace.problemId,
          timestamp,
          policy_id: policy.id,
          strategy: policy.strategy,
          policy_version: policy.policyVersion,
          knowledge_policy_version: sqlEngagePolicyVersion,
          rule_fired: 'terminal.success',
          reasoning: 'Execution succeeded; no intervention emitted.',
          inputs: {
            retry_count: context.retryCount,
            hint_count: context.currentHintLevel,
            time_spent_ms: context.timeSpent,
            error_subtype: null
          },
          outputs: {
            action: 'no_intervention',
            hint_level: null,
            hint_text: null,
            sql_engage_subtype: null,
            sql_engage_row_id: null,
            explanation_id: null,
            note_id: null
          }
        });
        continue;
      }

      const subtype = canonicalizeSubtype(attempt.errorSubtype, canonicalSet);
      policyEvents.push({
        id: attempt.attemptId,
        timestamp,
        eventType: 'error',
        problemId: learnerTrace.problemId,
        errorSubtypeId: subtype
      });

      const context = analyzeContext(policyEvents, timestamp);
      const autoEscalation = getAutoEscalationState(policyEvents);
      const selection = selectDecision(context, thresholds, autoEscalation);

      let action = selection.decision;
      let hintLevel = null;
      let explanationId = null;
      let noteId = null;
      let hintText = null;
      let anchorRowId = null;

      if (selection.decision === 'show_hint') {
        hintLevel = Math.min(context.currentHintLevel + 1, 3);
        const row = getAnchorRow(subtype, hintSeed, subtypeIndex, canonicalSet);
        hintText = getProgressiveHintText(subtype, hintLevel, row, canonicalSet);
        anchorRowId = row?.rowId || null;
        summaries.hint_shown += 1;
        policyEvents.push({
          id: `hint-${policy.id}-${attempt.attemptId}`,
          timestamp: timestamp + 1,
          eventType: 'hint_view',
          problemId: learnerTrace.problemId,
          hintLevel,
          sqlEngageSubtype: subtype,
          sqlEngageRowId: anchorRowId,
          policyVersion: sqlEngagePolicyVersion
        });
      } else if (selection.decision === 'show_explanation') {
        explanationId = deterministicId(
          'explain',
          `${policy.id}|${learnerTrace.learnerId}|${learnerTrace.problemId}|${attempt.attemptId}|${subtype}`
        );
        summaries.escalations += 1;
        policyEvents.push({
          id: `explain-${policy.id}-${attempt.attemptId}`,
          timestamp: timestamp + 1,
          eventType: 'explanation_view',
          problemId: learnerTrace.problemId,
          errorSubtypeId: subtype,
          policyVersion: sqlEngagePolicyVersion
        });
      } else if (selection.decision === 'add_to_textbook') {
        noteId = deterministicId(
          'note',
          `${policy.id}|${learnerTrace.learnerId}|${learnerTrace.problemId}|${attempt.attemptId}|${subtype}`
        );
        summaries.notes_recommended += 1;
      }

      interventions.push({
        event_id: attempt.attemptId,
        learner_id: learnerTrace.learnerId,
        problem_id: learnerTrace.problemId,
        timestamp,
        policy_id: policy.id,
        strategy: policy.strategy,
        thresholds: serializeThresholds(thresholds),
        policy_version: policy.policyVersion,
        knowledge_policy_version: sqlEngagePolicyVersion,
        rule_fired: selection.ruleFired,
        reasoning: selection.reasoning,
        inputs: {
          retry_count: context.retryCount,
          hint_count: context.currentHintLevel,
          time_spent_ms: context.timeSpent,
          error_subtype: subtype
        },
        outputs: {
          action,
          hint_level: hintLevel,
          hint_text: hintText,
          sql_engage_subtype: subtype,
          sql_engage_row_id: anchorRowId,
          explanation_id: explanationId,
          note_id: noteId
        }
      });
    }
  }

  return {
    policy_id: policy.id,
    strategy: policy.strategy,
    policy_version: policy.policyVersion,
    decisions: interventions,
    summary: summaries
  };
}

async function main() {
  const [fixtureRaw, sqlEngageTsRaw, sqlEngageCsvRaw] = await Promise.all([
    readFile(FIXTURE_PATH, 'utf8'),
    readFile(SQL_ENGAGE_TS_PATH, 'utf8'),
    readFile(SQL_ENGAGE_CSV_PATH, 'utf8')
  ]);

  const fixture = JSON.parse(fixtureRaw);
  const sqlEngagePolicyVersion = parseSqlEngagePolicyVersion(sqlEngageTsRaw);
  const rows = parseSqlEngageRows(sqlEngageCsvRaw);
  const subtypeIndex = buildSubtypeIndex(rows);
  const canonicalSet = new Set(Object.keys(subtypeIndex));

  const replayResults = POLICIES.map((policy) =>
    replayForPolicy(policy, fixture, sqlEngagePolicyVersion, subtypeIndex, canonicalSet)
  );

  const exportPayload = {
    fixture_id: fixture.fixtureId,
    replay_harness_version: REPLAY_HARNESS_VERSION,
    replay_policy_semantics_version: REPLAY_POLICY_SEMANTICS_VERSION,
    semantic_alignment: {
      aligned_with: {
        decision_layer: 'apps/web/src/app/lib/adaptive-orchestrator.ts',
        hint_selection: 'apps/web/src/app/lib/adaptive-orchestrator.ts#getNextHint',
        sql_engage_policy_stamp: 'apps/web/src/app/data/sql-engage.ts#SQL_ENGAGE_POLICY_VERSION'
      },
      intentional_divergences: [
        {
          id: 'replay-001-note-write-is-not-mutating',
          description: 'The app requires a user action to add/update notes; replay logs deterministic note_id recommendations for add_to_textbook decisions but does not mutate textbook state.'
        },
        {
          id: 'replay-002-attempt-boundary-evaluation',
          description: 'Replay computes decisions only at attempt boundaries from fixture traces, then emits synthetic hint/explanation events for deterministic context updates.'
        }
      ]
    },
    sql_engage_policy_version: sqlEngagePolicyVersion,
    input_trace_count: fixture.learners.reduce((acc, learner) => acc + learner.attempts.length, 0),
    policy_results: replayResults
  };

  const outputJson = `${JSON.stringify(exportPayload, null, 2)}\n`;
  await mkdir(path.dirname(OUTPUT_PATH), { recursive: true });
  await writeFile(OUTPUT_PATH, outputJson, 'utf8');

  const checksum = crypto.createHash('sha256').update(outputJson).digest('hex');
  console.log(`Replay export written: ${OUTPUT_PATH}`);
  console.log(`Replay export sha256: ${checksum}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
