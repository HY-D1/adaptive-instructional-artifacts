import { readFile, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..');

const REPLAY_SCRIPT_PATH = path.join(REPO_ROOT, 'scripts/replay-toy.mjs');
const REPLAY_OUTPUT_PATH = path.join(REPO_ROOT, 'dist/replay/toy-replay-output.json');
const BASELINE_PATH = path.join(REPO_ROOT, 'scripts/replay-checksum-baseline.json');

const INPUT_FILE_PATHS = {
  fixture: path.join(REPO_ROOT, 'apps/web/src/app/data/toy-replay-fixture.json'),
  sql_engage_ts: path.join(REPO_ROOT, 'apps/web/src/app/data/sql-engage.ts'),
  sql_engage_csv: path.join(REPO_ROOT, 'apps/web/src/app/data/sql_engage_dataset.csv'),
  replay_harness: REPLAY_SCRIPT_PATH
};

function sha256(content) {
  return crypto.createHash('sha256').update(content).digest('hex');
}

async function sha256File(filePath) {
  const content = await readFile(filePath);
  return sha256(content);
}

function runReplayToy() {
  const result = spawnSync(process.execPath, [REPLAY_SCRIPT_PATH], {
    cwd: REPO_ROOT,
    stdio: 'inherit'
  });
  if (result.status !== 0) {
    process.exit(result.status || 1);
  }
}

async function getCurrentInputDigests() {
  const entries = await Promise.all(
    Object.entries(INPUT_FILE_PATHS).map(async ([key, filePath]) => [key, await sha256File(filePath)])
  );
  return Object.fromEntries(entries);
}

async function readReplayOutput() {
  const raw = await readFile(REPLAY_OUTPUT_PATH, 'utf8');
  const output = JSON.parse(raw);
  if (!output?.policy_only_checksum_sha256) {
    throw new Error(
      `Missing policy_only_checksum_sha256 in replay output: ${REPLAY_OUTPUT_PATH}`
    );
  }
  return output;
}

async function readBaseline() {
  try {
    const raw = await readFile(BASELINE_PATH, 'utf8');
    return JSON.parse(raw);
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
      throw new Error(
        `Replay checksum baseline not found: ${BASELINE_PATH}. Run \`npm run replay:gate:update\` to create it.`
      );
    }
    throw error;
  }
}

async function writeBaseline(payload) {
  await writeFile(BASELINE_PATH, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
}

function sameInputs(current, baseline) {
  const keys = new Set([...Object.keys(current), ...Object.keys(baseline || {})]);
  for (const key of keys) {
    if (current[key] !== baseline?.[key]) return false;
  }
  return true;
}

async function main() {
  const shouldUpdate = process.argv.includes('--update');

  runReplayToy();

  const [inputDigests, replayOutput] = await Promise.all([
    getCurrentInputDigests(),
    readReplayOutput()
  ]);

  if (shouldUpdate) {
    await writeBaseline({
      schema_version: 1,
      description:
        'Replay checksum regression baseline. Enforce exact checksum only when fixture/policy input digests are unchanged.',
      fixture_policy_input_digests_sha256: inputDigests,
      expected: {
        policy_only_checksum_sha256: replayOutput.policy_only_checksum_sha256,
        replay_harness_version: replayOutput.replay_harness_version,
        replay_policy_semantics_version: replayOutput.replay_policy_semantics_version,
        sql_engage_policy_version: replayOutput.sql_engage_policy_version
      },
      updated_at: new Date().toISOString()
    });
    console.log(`Replay checksum baseline updated: ${BASELINE_PATH}`);
    return;
  }

  const baseline = await readBaseline();
  const unchangedInputs = sameInputs(
    inputDigests,
    baseline.fixture_policy_input_digests_sha256
  );
  if (!unchangedInputs) {
    console.log('Replay checksum gate skipped: fixture/policy inputs changed.');
    console.log('Run `npm run replay:gate:update` after reviewing intended replay changes.');
    return;
  }

  const expectedChecksum = baseline?.expected?.policy_only_checksum_sha256;
  const actualChecksum = replayOutput.policy_only_checksum_sha256;
  if (!expectedChecksum) {
    throw new Error(`Baseline missing expected.policy_only_checksum_sha256: ${BASELINE_PATH}`);
  }

  if (actualChecksum !== expectedChecksum) {
    console.error('Replay checksum regression gate FAILED.');
    console.error(`Expected: ${expectedChecksum}`);
    console.error(`Actual:   ${actualChecksum}`);
    console.error('Inputs are unchanged, so this indicates non-deterministic or unintended replay drift.');
    process.exit(1);
  }

  console.log('Replay checksum regression gate PASSED.');
  console.log(`Policy-only checksum: ${actualChecksum}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
