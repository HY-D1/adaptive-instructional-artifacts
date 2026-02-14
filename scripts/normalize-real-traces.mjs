import { mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { extractCyberneticSabotageRecords } from './lib/trace-adapters/cybernetic-sabotage.mjs';
import { extractSqlbeyondRecords } from './lib/trace-adapters/sqlbeyond.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..');
const SQL_ENGAGE_TS_PATH = path.join(REPO_ROOT, 'apps/web/src/app/data/sql-engage.ts');
const SQL_ENGAGE_CSV_PATH = path.join(REPO_ROOT, 'apps/web/src/app/data/sql_engage_dataset.csv');

const NORMALIZER_POLICY_VERSION = 'week2-real-trace-normalize-v1';
const EXPORT_POLICY_VERSION = 'week2-real-trace-export-v1';
const DEFAULT_OUTPUT_PATH = path.join(REPO_ROOT, 'dist/replay/real/export.json');

const EVENT_TYPE_ALIASES = {
  hint: 'hint_view',
  hintview: 'hint_view',
  hint_view: 'hint_view',
  explanation: 'explanation_view',
  explanationview: 'explanation_view',
  explanation_view: 'explanation_view',
  error: 'error',
  execution: 'execution',
  run: 'execution',
  code_change: 'code_change',
  codechange: 'code_change',
  hint_request: 'hint_request',
  hintrequest: 'hint_request',
  llm_generate: 'llm_generate',
  llmgenerate: 'llm_generate',
  textbook_add: 'textbook_add',
  textbookadd: 'textbook_add',
  textbook_update: 'textbook_update',
  textbookupdate: 'textbook_update'
};

const SUBTYPE_ALIASES = {
  'unknown column': 'undefined column',
  'no such column': 'undefined column',
  'unknown table': 'undefined table',
  'no such table': 'undefined table',
  'unknown function': 'undefined function',
  'ambiguous column': 'ambiguous reference'
};

const ALLOWED_EVENT_TYPES = new Set([
  'code_change',
  'execution',
  'error',
  'hint_request',
  'hint_view',
  'explanation_view',
  'llm_generate',
  'textbook_add',
  'textbook_update'
]);

function parseArgs(argv) {
  const args = {
    adapter: '',
    input: '',
    output: DEFAULT_OUTPUT_PATH
  };

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === '--adapter') {
      args.adapter = argv[i + 1] || '';
      i += 1;
      continue;
    }
    if (token === '--input') {
      args.input = argv[i + 1] || '';
      i += 1;
      continue;
    }
    if (token === '--output') {
      args.output = argv[i + 1] || '';
      i += 1;
      continue;
    }
  }

  return args;
}

function usageAndExit(message) {
  if (message) {
    console.error(message);
  }
  console.error('Usage: node scripts/normalize-real-traces.mjs --adapter <cybernetic-sabotage|sqlbeyond> --input <raw-file-or-dir> [--output dist/replay/real/export.json]');
  process.exit(1);
}

function readFirstString(...values) {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }
  return '';
}

function readFirstValue(...values) {
  for (const value of values) {
    if (value !== undefined && value !== null && value !== '') {
      return value;
    }
  }
  return undefined;
}

function readFirstNumber(...values) {
  for (const value of values) {
    const numeric = Number(value);
    if (Number.isFinite(numeric)) {
      return numeric;
    }
  }
  return undefined;
}

function normalizeTimestamp(value, fallback) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value > 1e12 ? Math.round(value) : Math.round(value * 1000);
  }
  if (typeof value === 'string' && value.trim()) {
    const asNumber = Number(value);
    if (Number.isFinite(asNumber)) {
      return asNumber > 1e12 ? Math.round(asNumber) : Math.round(asNumber * 1000);
    }
    const parsed = Date.parse(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return fallback;
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

function stableHash(input) {
  return crypto.createHash('sha256').update(input).digest('hex').slice(0, 12);
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

function parseSqlEngagePolicyVersion(raw) {
  const match = raw.match(/const SQL_ENGAGE_POLICY_VERSION = '([^']+)'/);
  if (!match) {
    throw new Error('Could not parse SQL_ENGAGE_POLICY_VERSION from apps/web/src/app/data/sql-engage.ts');
  }
  return match[1];
}

function buildSqlEngageSubtypeIndex(csvRaw) {
  const lines = csvRaw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    return new Map();
  }

  const headers = parseCsvLine(lines[0]);
  const subtypeIdx = headers.indexOf('error_subtype');
  if (subtypeIdx < 0) {
    return new Map();
  }

  const index = new Map();

  for (let i = 1; i < lines.length; i += 1) {
    const cols = parseCsvLine(lines[i]);
    const subtype = (cols[subtypeIdx] || '').trim().toLowerCase();
    if (!subtype) continue;
    const row = {
      rowId: `sql-engage:${i + 1}`,
      errorSubtype: subtype
    };
    if (!index.has(subtype)) {
      index.set(subtype, []);
    }
    index.get(subtype).push(row);
  }

  return index;
}

function canonicalizeSubtype(subtype, subtypeIndex) {
  const raw = (subtype || '').trim().toLowerCase();
  const aliased = SUBTYPE_ALIASES[raw] || raw;
  if (aliased && subtypeIndex.has(aliased)) {
    return aliased;
  }
  if (subtypeIndex.has('incomplete query')) {
    return 'incomplete query';
  }
  const fallback = subtypeIndex.keys().next();
  return fallback.done ? 'incomplete query' : fallback.value;
}

function getDeterministicAnchorRowId(subtype, seed, subtypeIndex) {
  const canonicalSubtype = canonicalizeSubtype(subtype, subtypeIndex);
  const rows = subtypeIndex.get(canonicalSubtype) || [];
  if (rows.length === 0) {
    return 'sql-engage:fallback-synthetic';
  }
  const hash = Number.parseInt(stableHash(`${canonicalSubtype}|${seed}`), 16);
  const idx = Number.isFinite(hash) ? hash % rows.length : 0;
  return rows[idx].rowId;
}

function normalizeEventType(record) {
  const raw = readFirstString(
    record.eventType,
    record.event_type,
    record.type,
    record.action,
    record.outcome
  ).toLowerCase();

  const candidate = EVENT_TYPE_ALIASES[raw] || raw;
  if (ALLOWED_EVENT_TYPES.has(candidate)) {
    return candidate;
  }

  if (raw === 'success' || raw === 'passed') {
    return 'execution';
  }
  if (raw === 'failed' || raw === 'failure') {
    return 'error';
  }

  if (typeof record.error === 'string' && record.error.trim()) {
    return 'error';
  }

  if (typeof record.hintText === 'string' && record.hintText.trim()) {
    return 'hint_view';
  }

  return null;
}

function normalizeRawRecord(record, index, subtypeIndex) {
  const eventType = normalizeEventType(record);
  if (!eventType) {
    return null;
  }

  const learnerId = readFirstString(
    record.learnerId,
    record.learner_id,
    record.userId,
    record.user_id,
    record.studentId,
    record.student_id,
    'learner-unknown'
  );

  const problemId = readFirstString(
    record.problemId,
    record.problem_id,
    record.challengeId,
    record.challenge_id,
    record.exerciseId,
    record.exercise_id,
    'problem-unknown'
  );

  const timestamp = normalizeTimestamp(
    readFirstValue(record.timestamp, record.created_at, record.createdAt, record.time),
    1700000000000 + index
  );

  const sourceRecordId = readFirstString(record.id, record.event_id, record.interaction_id, record.attemptId, record.attempt_id);
  const deterministicId = sourceRecordId || `event-${stableHash(stableSerialize({ index, eventType, learnerId, problemId, timestamp, source: record.__sourceFile || '' }))}`;

  const event = {
    id: deterministicId,
    sessionId: readFirstString(record.sessionId, record.session_id, record.session),
    learnerId,
    timestamp,
    eventType,
    problemId
  };

  const code = readFirstString(record.code, record.query, record.sql, record.statement);
  if (code) {
    event.code = code;
  }

  const errorMessage = readFirstString(record.error, record.errorMessage, record.error_message, record.message);
  if (errorMessage) {
    event.error = errorMessage;
  }

  const subtype = canonicalizeSubtype(
    readFirstString(record.sqlEngageSubtype, record.sql_engage_subtype, record.errorSubtypeId, record.errorSubtype, record.error_subtype),
    subtypeIndex
  );

  if (eventType === 'error' || eventType === 'hint_view' || eventType === 'explanation_view') {
    event.errorSubtypeId = subtype;
  }

  if (eventType === 'execution') {
    const successful =
      record.successful === true ||
      String(record.outcome || '').toLowerCase() === 'success' ||
      String(record.status || '').toLowerCase() === 'success';
    event.successful = Boolean(successful);
  }

  const hintText = readFirstString(record.hintText, record.hint_text, record.feedback, record.feedback_target);
  if (eventType === 'hint_view' && hintText) {
    event.hintText = hintText;
  }

  const hintLevel = readFirstNumber(record.hintLevel, record.hint_level, record.level);
  if (eventType === 'hint_view' && Number.isFinite(hintLevel)) {
    event.hintLevel = Math.max(1, Math.min(3, Math.round(hintLevel)));
  }

  const helpRequestIndex = readFirstNumber(record.helpRequestIndex, record.help_request_index, record.requestIndex, record.request_index);
  if ((eventType === 'hint_view' || eventType === 'explanation_view') && Number.isFinite(helpRequestIndex)) {
    event.helpRequestIndex = Math.max(1, Math.round(helpRequestIndex));
  }

  const sqlEngageSubtype = readFirstString(record.sqlEngageSubtype, record.sql_engage_subtype);
  if ((eventType === 'hint_view' || eventType === 'explanation_view') && sqlEngageSubtype) {
    event.sqlEngageSubtype = canonicalizeSubtype(sqlEngageSubtype, subtypeIndex);
  }

  const sqlEngageRowId = readFirstString(record.sqlEngageRowId, record.sql_engage_row_id);
  if ((eventType === 'hint_view' || eventType === 'explanation_view') && sqlEngageRowId) {
    event.sqlEngageRowId = sqlEngageRowId;
  }

  const policyVersion = readFirstString(record.policyVersion, record.policy_version);
  if ((eventType === 'hint_view' || eventType === 'explanation_view') && policyVersion) {
    event.policyVersion = policyVersion;
  }

  return event;
}

function assignSessionAndHelpMetadata(events, sqlEngagePolicyVersion, subtypeIndex) {
  const sessionByLearnerProblem = new Map();
  const helpCounter = new Map();

  for (const event of events) {
    const learnerKey = `${event.learnerId}|${event.problemId}`;
    if (!event.sessionId) {
      if (!sessionByLearnerProblem.has(learnerKey)) {
        const fallback = `session-${event.learnerId}-${stableHash(`${learnerKey}|${event.timestamp}`)}`;
        sessionByLearnerProblem.set(learnerKey, fallback);
      }
      event.sessionId = sessionByLearnerProblem.get(learnerKey);
    }

    if (!event.sessionId || !String(event.sessionId).trim()) {
      event.sessionId = `session-${stableHash(`${event.learnerId}|${event.problemId}|${event.timestamp}|${event.id}`)}`;
    }

    if (event.eventType !== 'hint_view' && event.eventType !== 'explanation_view') {
      continue;
    }

    const helpKey = `${event.sessionId}|${event.problemId}`;
    const current = helpCounter.get(helpKey) || 0;
    let helpIndex = Number.isFinite(Number(event.helpRequestIndex))
      ? Math.max(1, Math.round(Number(event.helpRequestIndex)))
      : current + 1;

    if (event.eventType === 'explanation_view') {
      helpIndex = Math.max(helpIndex, 4);
    }

    helpCounter.set(helpKey, Math.max(current, helpIndex));
    event.helpRequestIndex = helpIndex;

    const subtype = canonicalizeSubtype(event.sqlEngageSubtype || event.errorSubtypeId || '', subtypeIndex);
    event.errorSubtypeId = subtype;
    event.sqlEngageSubtype = subtype;

    if (event.eventType === 'hint_view') {
      const requestedHintLevel = Number.isFinite(Number(event.hintLevel))
        ? Number(event.hintLevel)
        : helpIndex;
      event.hintLevel = Math.max(1, Math.min(3, Math.round(requestedHintLevel)));
    }

    if (!event.sqlEngageRowId || !String(event.sqlEngageRowId).trim()) {
      const seed = `${event.learnerId}|${event.problemId}|${helpIndex}|${event.hintLevel || 'na'}`;
      event.sqlEngageRowId = getDeterministicAnchorRowId(subtype, seed, subtypeIndex);
    }

    if (!event.policyVersion || !String(event.policyVersion).trim()) {
      event.policyVersion = sqlEngagePolicyVersion;
    }

    if (event.eventType === 'hint_view') {
      const hintLevel = Number.isFinite(Number(event.hintLevel))
        ? Math.max(1, Math.min(3, Math.round(Number(event.hintLevel))))
        : 1;
      const rowId = String(event.sqlEngageRowId || '').trim() || getDeterministicAnchorRowId(
        subtype,
        `${event.learnerId}|${event.problemId}|${helpIndex}|${hintLevel}`,
        subtypeIndex
      );
      event.hintId = String(event.hintId || '').trim()
        || `sql-engage:${subtype}:L${hintLevel}:${rowId}`;
    }
  }

  return events;
}

async function listInputFiles(inputPath) {
  const absoluteInputPath = path.resolve(REPO_ROOT, inputPath);
  const metadata = await stat(absoluteInputPath);

  if (metadata.isFile()) {
    return [absoluteInputPath];
  }

  if (!metadata.isDirectory()) {
    return [];
  }

  const all = [];
  const queue = [absoluteInputPath];

  while (queue.length > 0) {
    const dir = queue.shift();
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const resolved = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        queue.push(resolved);
        continue;
      }
      if (!entry.isFile()) {
        continue;
      }
      if (resolved.endsWith('.json') || resolved.endsWith('.jsonl')) {
        all.push(resolved);
      }
    }
  }

  return all.sort((a, b) => a.localeCompare(b));
}

async function parseInputFile(filePath) {
  const raw = await readFile(filePath, 'utf8');
  if (filePath.endsWith('.jsonl')) {
    return raw
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => JSON.parse(line));
  }
  return JSON.parse(raw);
}

function extractAdapterRecords(adapter, payload, sourceLabel) {
  if (adapter === 'cybernetic-sabotage') {
    return extractCyberneticSabotageRecords(payload, sourceLabel);
  }
  if (adapter === 'sqlbeyond') {
    return extractSqlbeyondRecords(payload, sourceLabel);
  }
  throw new Error(`Unsupported adapter: ${adapter}`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (!args.adapter) {
    usageAndExit('Missing required --adapter argument.');
  }
  if (!args.input) {
    usageAndExit('Missing required --input argument.');
  }

  if (args.adapter !== 'cybernetic-sabotage' && args.adapter !== 'sqlbeyond') {
    usageAndExit(`Unsupported adapter '${args.adapter}'.`);
  }

  const [sqlEngageTsRaw, sqlEngageCsvRaw] = await Promise.all([
    readFile(SQL_ENGAGE_TS_PATH, 'utf8'),
    readFile(SQL_ENGAGE_CSV_PATH, 'utf8')
  ]);

  const sqlEngagePolicyVersion = parseSqlEngagePolicyVersion(sqlEngageTsRaw);
  const subtypeIndex = buildSqlEngageSubtypeIndex(sqlEngageCsvRaw);

  const inputFiles = await listInputFiles(args.input);
  if (inputFiles.length === 0) {
    throw new Error(`No input JSON/JSONL files found at: ${args.input}`);
  }

  const extractedRecords = [];
  for (const filePath of inputFiles) {
    const payload = await parseInputFile(filePath);
    const relativePath = path.relative(REPO_ROOT, filePath);
    const records = extractAdapterRecords(args.adapter, payload, args.adapter).map((record) => ({
      ...record,
      __sourceFile: relativePath
    }));
    extractedRecords.push(...records);
  }

  const normalized = extractedRecords
    .map((record, index) => normalizeRawRecord(record, index, subtypeIndex))
    .filter(Boolean)
    .sort((a, b) => {
      const timeDelta = a.timestamp - b.timestamp;
      if (timeDelta !== 0) return timeDelta;
      const learnerDelta = a.learnerId.localeCompare(b.learnerId);
      if (learnerDelta !== 0) return learnerDelta;
      const problemDelta = a.problemId.localeCompare(b.problemId);
      if (problemDelta !== 0) return problemDelta;
      const typeDelta = a.eventType.localeCompare(b.eventType);
      if (typeDelta !== 0) return typeDelta;
      return a.id.localeCompare(b.id);
    });

  const interactions = assignSessionAndHelpMetadata(normalized, sqlEngagePolicyVersion, subtypeIndex);

  const activeSessionId = interactions.length > 0
    ? interactions[interactions.length - 1].sessionId
    : 'session-unknown';

  const exportPayload = {
    interactions,
    profiles: [],
    textbooks: {},
    llmCache: {},
    replayMode: true,
    pdfIndex: null,
    activeSessionId,
    exportScope: 'all-history',
    exportPolicyVersion: EXPORT_POLICY_VERSION,
    normalizerAdapter: args.adapter,
    normalizerPolicyVersion: NORMALIZER_POLICY_VERSION,
    sqlEngagePolicyVersion,
    sourceFiles: inputFiles.map((filePath) => path.relative(REPO_ROOT, filePath))
  };

  const policyOnlyChecksum = crypto
    .createHash('sha256')
    .update(stableSerialize(exportPayload))
    .digest('hex');

  exportPayload.policyOnlyChecksumSha256 = policyOnlyChecksum;

  const outputPath = path.resolve(REPO_ROOT, args.output);
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(exportPayload, null, 2)}\n`, 'utf8');

  console.log(`[normalize-real-traces] adapter=${args.adapter}`);
  console.log(`[normalize-real-traces] input_files=${inputFiles.length}`);
  console.log(`[normalize-real-traces] interactions=${interactions.length}`);
  console.log(`[normalize-real-traces] output=${path.relative(REPO_ROOT, outputPath)}`);
  console.log(`[normalize-real-traces] policy_only_checksum_sha256=${policyOnlyChecksum}`);
}

main().catch((error) => {
  console.error(`[normalize-real-traces] failed: ${error.message}`);
  process.exit(1);
});
