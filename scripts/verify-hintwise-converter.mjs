import { readFile } from 'node:fs/promises';
import { accessSync, constants as fsConstants } from 'node:fs';
import { spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..');
const CONVERTER_PATH = path.join(REPO_ROOT, 'scripts/convert-hintwise.mjs');
const OUTPUT_PATH = path.join(REPO_ROOT, 'dist/hintwise/hintwise-ladder-map.v1.json');
const EXPECTED_CONVERTER_VERSION = 'hintwise-converter-v1';
const EXPECTED_SEMANTICS_VERSION = 'hintwise-level-order-v1';

function sha256(text) {
  return crypto.createHash('sha256').update(text).digest('hex');
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function runConverter() {
  const result = spawnSync('node', [CONVERTER_PATH], {
    cwd: REPO_ROOT,
    encoding: 'utf8'
  });

  if (result.status !== 0) {
    throw new Error(
      `convert-hintwise failed with exit ${result.status}\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`
    );
  }

  const combined = `${result.stdout}\n${result.stderr}`;
  const shaMatch = combined.match(/sha256=([a-f0-9]{64})/i);
  return {
    stdout: result.stdout.trim(),
    loggedSha: shaMatch?.[1]?.toLowerCase()
  };
}

function assertSequentialHintLevels(challengeMap) {
  challengeMap.forEach((entry, idx) => {
    assert(Array.isArray(entry.hint_levels), `challenge_map[${idx}] missing hint_levels`);
    assert(entry.hint_levels.length > 0, `challenge_map[${idx}] has no hint_levels`);

    entry.hint_levels.forEach((row, levelIdx) => {
      const expectedLevel = levelIdx + 1;
      assert(
        row.level === expectedLevel,
        `challenge_map[${idx}] has non-consecutive level sequence at position ${levelIdx} (expected ${expectedLevel}, got ${row.level})`
      );
      assert(row.label === `H${row.level}`, `challenge_map[${idx}] has mismatched label ${row.label}`);
      assert(typeof row.hint === 'string' && row.hint.trim().length > 0, `challenge_map[${idx}] has empty hint text`);
    });
  });
}

async function main() {
  accessSync(CONVERTER_PATH, fsConstants.R_OK);

  const run1 = runConverter();
  const outputRaw1 = await readFile(OUTPUT_PATH, 'utf8');
  const fileSha1 = sha256(outputRaw1);

  const run2 = runConverter();
  const outputRaw2 = await readFile(OUTPUT_PATH, 'utf8');
  const fileSha2 = sha256(outputRaw2);

  assert(fileSha1 === fileSha2, `converter output hash changed across runs: ${fileSha1} vs ${fileSha2}`);
  if (run1.loggedSha) assert(run1.loggedSha === fileSha1, `logged sha mismatch on run1: ${run1.loggedSha} vs ${fileSha1}`);
  if (run2.loggedSha) assert(run2.loggedSha === fileSha2, `logged sha mismatch on run2: ${run2.loggedSha} vs ${fileSha2}`);

  let parsed;
  try {
    parsed = JSON.parse(outputRaw2);
  } catch (error) {
    throw new Error(`converter output is not valid JSON: ${error.message}`);
  }

  assert(parsed.converter_policy_version === EXPECTED_CONVERTER_VERSION, `converter policy version changed: ${parsed.converter_policy_version}`);
  assert(parsed.policy_semantics_version === EXPECTED_SEMANTICS_VERSION, `semantics version changed: ${parsed.policy_semantics_version}`);

  assert(Array.isArray(parsed.source_assets) && parsed.source_assets.length > 0, 'source_assets missing or empty');
  parsed.source_assets.forEach((asset, idx) => {
    assert(typeof asset.asset_id === 'string' && asset.asset_id.length > 0, `source_assets[${idx}] missing asset_id`);
    assert(typeof asset.raw_sha256 === 'string' && /^[a-f0-9]{64}$/i.test(asset.raw_sha256), `source_assets[${idx}] invalid raw_sha256`);
  });

  assert(Array.isArray(parsed.challenge_map) && parsed.challenge_map.length > 0, 'challenge_map missing or empty');
  assertSequentialHintLevels(parsed.challenge_map);

  const challengeKeySet = new Set(parsed.challenge_map.map((row) => row.challenge_key));
  assert(challengeKeySet.size === parsed.challenge_map.length, 'duplicate challenge_key detected in challenge_map');

  assert(parsed.stats?.unique_challenge_keys === parsed.challenge_map.length, 'stats.unique_challenge_keys does not match challenge_map length');

  console.log(`[hintwise-verify] converter_policy_version=${parsed.converter_policy_version}`);
  console.log(`[hintwise-verify] policy_semantics_version=${parsed.policy_semantics_version}`);
  console.log(`[hintwise-verify] challenge_map_size=${parsed.challenge_map.length}`);
  console.log(`[hintwise-verify] stable_output_sha256=${fileSha2}`);
}

main().catch((error) => {
  console.error(`[hintwise-verify] failed: ${error.message}`);
  process.exitCode = 1;
});
