import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import { constants as fsConstants, accessSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..');

const CONVERTER_POLICY_VERSION = 'hintwise-converter-v1';
const POLICY_SEMANTICS_VERSION = 'hintwise-level-order-v1';
const OUTPUT_PATH = path.join(REPO_ROOT, 'dist/hintwise/hintwise-ladder-map.v1.json');

const SOURCE_CANDIDATES = [
  {
    assetId: 'zip:HintWise-main/hints_dataset.json',
    read: () => readZipEntry('dist/HintWise.zip', 'HintWise-main/hints_dataset.json')
  },
  {
    assetId: 'zip:HintWise-main/app/api/hints/hints_dataset.json',
    read: () => readZipEntry('dist/HintWise.zip', 'HintWise-main/app/api/hints/hints_dataset.json')
  },
  {
    assetId: 'file:HintWise-main/hints_dataset.json',
    read: () => readLocalFile('HintWise-main/hints_dataset.json')
  },
  {
    assetId: 'file:HintWise-main/app/api/hints/hints_dataset.json',
    read: () => readLocalFile('HintWise-main/app/api/hints/hints_dataset.json')
  }
];

function stableHash(input) {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash * 31 + input.charCodeAt(i)) >>> 0;
  }
  return hash;
}

function stableHashHex(input) {
  return stableHash(input).toString(16).padStart(8, '0');
}

function sha256(input) {
  return crypto.createHash('sha256').update(input).digest('hex');
}

function normalizeText(value) {
  return String(value || '')
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .trim();
}

function parseHintLevel(label) {
  const match = String(label || '').trim().match(/^H(\d+)$/i);
  if (!match) return undefined;
  return Number.parseInt(match[1], 10);
}

function sortByText(a, b) {
  return a.localeCompare(b, 'en');
}

function readZipEntry(zipRelPath, entryPath) {
  const zipPath = path.join(REPO_ROOT, zipRelPath);
  if (!existsSync(zipPath)) return undefined;
  const entries = execFileSync('unzip', ['-Z1', zipPath], { encoding: 'utf8' })
    .split(/\r?\n/)
    .filter(Boolean);
  if (!entries.includes(entryPath)) return undefined;
  return execFileSync('unzip', ['-p', zipPath, entryPath], {
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024
  });
}

function readLocalFile(relPath) {
  const absPath = path.join(REPO_ROOT, relPath);
  if (!existsSync(absPath)) return undefined;
  return readFile(absPath, 'utf8');
}

function existsSync(absPath) {
  try {
    accessSync(absPath, fsConstants.R_OK);
    return true;
  } catch {
    return false;
  }
}

async function loadAvailableDatasets() {
  const datasets = [];

  for (let i = 0; i < SOURCE_CANDIDATES.length; i += 1) {
    const candidate = SOURCE_CANDIDATES[i];
    let raw;
    try {
      raw = await candidate.read();
    } catch {
      raw = undefined;
    }
    if (!raw) continue;

    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (error) {
      throw new Error(`Failed to parse ${candidate.assetId} as JSON: ${error.message}`);
    }
    if (!Array.isArray(parsed)) {
      throw new Error(`Dataset ${candidate.assetId} is not a JSON array.`);
    }
    if (parsed.length === 0) {
      continue;
    }

    datasets.push({
      assetId: candidate.assetId,
      sourcePriority: i,
      rawSha256: sha256(raw),
      records: parsed
    });
  }

  return datasets;
}

function normalizeRecords(datasets) {
  const normalized = [];

  for (const dataset of datasets) {
    dataset.records.forEach((record, index) => {
      const topic = normalizeText(record.topic);
      const challenge = normalizeText(record.challenge);
      const personality = normalizeText(record.personality);

      if (!topic || !challenge) return;

      const levelMap = new Map();
      const hints = Array.isArray(record.hints) ? record.hints : [];
      hints.forEach((entry) => {
        const level = parseHintLevel(entry?.label);
        const hintText = normalizeText(entry?.hint);
        if (!level || !hintText) return;
        if (!levelMap.has(level)) {
          levelMap.set(level, hintText);
        }
      });

      if (levelMap.size === 0) return;

      const levels = [...levelMap.entries()]
        .map(([level, hint]) => ({ level, label: `H${level}`, hint }))
        .sort((a, b) => a.level - b.level);

      const seed = `${topic}|${challenge}|${personality}`;
      normalized.push({
        recordId: `hintwise:${stableHashHex(`${dataset.assetId}|${index + 1}|${seed}`)}`,
        challengeKey: `hintwise:challenge:${stableHashHex(`${topic}|${challenge}|${personality}`)}`,
        topic,
        challenge,
        personality,
        sourceAssetId: dataset.assetId,
        sourcePriority: dataset.sourcePriority,
        sourceRowNumber: index + 1,
        hintLevels: levels,
        maxHintLevel: levels[levels.length - 1].level,
        deterministic_seed: seed
      });
    });
  }

  return normalized.sort((a, b) => {
    if (a.topic !== b.topic) return sortByText(a.topic, b.topic);
    if (a.challenge !== b.challenge) return sortByText(a.challenge, b.challenge);
    if (a.personality !== b.personality) return sortByText(a.personality, b.personality);
    if (a.sourcePriority !== b.sourcePriority) return a.sourcePriority - b.sourcePriority;
    return a.sourceRowNumber - b.sourceRowNumber;
  });
}

function buildDeterministicChallengeMap(records) {
  const byChallenge = new Map();

  records.forEach((record) => {
    const existing = byChallenge.get(record.challengeKey);
    if (!existing) {
      byChallenge.set(record.challengeKey, record);
      return;
    }

    const a = existing;
    const b = record;
    if (b.sourcePriority < a.sourcePriority) {
      byChallenge.set(record.challengeKey, b);
      return;
    }
    if (b.sourcePriority === a.sourcePriority && b.sourceRowNumber < a.sourceRowNumber) {
      byChallenge.set(record.challengeKey, b);
    }
  });

  return [...byChallenge.values()].sort((a, b) => {
    if (a.topic !== b.topic) return sortByText(a.topic, b.topic);
    if (a.challenge !== b.challenge) return sortByText(a.challenge, b.challenge);
    return sortByText(a.challengeKey, b.challengeKey);
  });
}

function assertSemantics(records) {
  const invalid = records.filter((record) => {
    const levelSequence = record.hintLevels.map((levelRow) => levelRow.level);
    return !levelSequence.every((level, idx) => level === idx + 1);
  });
  if (invalid.length > 0) {
    const example = invalid[0];
    throw new Error(
      `Non-consecutive hint level order detected for ${example.recordId} (${example.sourceAssetId}).`
    );
  }
}

async function ensureOutputParent(outputPath) {
  await mkdir(path.dirname(outputPath), { recursive: true });
  try {
    await access(path.dirname(outputPath), fsConstants.W_OK);
  } catch (error) {
    throw new Error(`Output directory is not writable: ${path.dirname(outputPath)} (${error.message})`);
  }
}

async function main() {
  const datasets = await loadAvailableDatasets();
  if (datasets.length === 0) {
    console.warn(
      '[hintwise-converter] SKIP: No local HintWise dataset found. Expected dist/HintWise.zip or extracted HintWise-main JSON assets. Skipping conversion (exit 0).'
    );
    process.exitCode = 0;
    return;
  }

  const normalizedRecords = normalizeRecords(datasets);
  if (normalizedRecords.length === 0) {
    throw new Error('HintWise assets were found, but no valid hint records could be normalized.');
  }
  assertSemantics(normalizedRecords);

  const challengeMap = buildDeterministicChallengeMap(normalizedRecords);
  const output = {
    converter_policy_version: CONVERTER_POLICY_VERSION,
    policy_semantics_version: POLICY_SEMANTICS_VERSION,
    deterministic_selection: {
      seed_fields: ['topic', 'challenge', 'personality'],
      record_id_hash: 'stableHash31',
      challenge_selection_rule:
        'select record with minimum sourcePriority, then minimum sourceRowNumber for each challengeKey'
    },
    source_assets: datasets
      .map((dataset) => ({
        asset_id: dataset.assetId,
        source_priority: dataset.sourcePriority,
        raw_sha256: dataset.rawSha256,
        record_count: dataset.records.length
      }))
      .sort((a, b) => a.source_priority - b.source_priority),
    stats: {
      normalized_records: normalizedRecords.length,
      unique_challenge_keys: challengeMap.length,
      max_hint_level_seen: Math.max(...normalizedRecords.map((record) => record.maxHintLevel))
    },
    challenge_map: challengeMap.map((record) => ({
      challenge_key: record.challengeKey,
      record_id: record.recordId,
      topic: record.topic,
      challenge: record.challenge,
      personality: record.personality,
      source_asset_id: record.sourceAssetId,
      source_row_number: record.sourceRowNumber,
      hint_levels: record.hintLevels
    }))
  };

  const outputJson = `${JSON.stringify(output, null, 2)}\n`;
  await ensureOutputParent(OUTPUT_PATH);
  await writeFile(OUTPUT_PATH, outputJson, 'utf8');

  const outputSha = sha256(outputJson);
  const relativeOutput = path.relative(REPO_ROOT, OUTPUT_PATH);
  console.log(`[hintwise-converter] converter_policy_version=${CONVERTER_POLICY_VERSION}`);
  console.log(`[hintwise-converter] policy_semantics_version=${POLICY_SEMANTICS_VERSION}`);
  console.log(
    `[hintwise-converter] source_assets=${datasets.length} normalized_records=${normalizedRecords.length} unique_challenges=${challengeMap.length}`
  );
  console.log(`[hintwise-converter] output=${relativeOutput} sha256=${outputSha}`);
}

main().catch((error) => {
  console.error(`[hintwise-converter] failed: ${error.message}`);
  process.exitCode = 1;
});
