#!/usr/bin/env node
/**
 * Replay Checksum Gate
 * 
 * Regression gate for replay reproducibility. Validates that replay outputs
 * match expected checksums when inputs are unchanged.
 * 
 * Supports both toy replay and real/experiment replay paths.
 * 
 * Usage:
 *   npm run replay:gate              # Run toy replay gate
 *   npm run replay:gate:real         # Run real replay gate (placeholder)
 *   npm run replay:gate:experiment   # Run experiment replay gate (placeholder)
 *   npm run replay:gate:update       # Update baseline
 * 
 * @version replay-checksum-gate-v2
 */

import { readFile, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..');

// Script paths
const REPLAY_SCRIPTS = {
  toy: path.join(REPO_ROOT, 'scripts/replay-toy.mjs'),
  real: path.join(REPO_ROOT, 'scripts/replay-real.mjs'),
  experiment: path.join(REPO_ROOT, 'scripts/replay-experiment.mjs')
};

// Output paths
const OUTPUT_PATHS = {
  toy: path.join(REPO_ROOT, 'dist/replay/toy-replay-output.json'),
  real: path.join(REPO_ROOT, 'dist/replay/real/replay-output.json'),
  experiment: path.join(REPO_ROOT, 'dist/replay/experiment/experiment-results.json')
};

// Baseline paths
const BASELINE_PATHS = {
  toy: path.join(REPO_ROOT, 'scripts/replay-checksum-baseline.json'),
  real: path.join(REPO_ROOT, 'scripts/replay-checksum-baseline-real.json'),
  experiment: path.join(REPO_ROOT, 'scripts/replay-checksum-baseline-experiment.json')
};

// Input file paths for each mode
const INPUT_FILE_PATHS = {
  toy: {
    fixture: path.join(REPO_ROOT, 'apps/web/src/app/data/toy-replay-fixture.json'),
    sql_engage_ts: path.join(REPO_ROOT, 'apps/web/src/app/data/sql-engage.ts'),
    sql_engage_csv: path.join(REPO_ROOT, 'apps/web/src/app/data/sql_engage_dataset.csv'),
    replay_harness: REPLAY_SCRIPTS.toy
  },
  real: {
    policies: path.join(REPO_ROOT, 'dist/policies.json'),
    sql_engage_ts: path.join(REPO_ROOT, 'apps/web/src/app/data/sql-engage.ts'),
    sql_engage_csv: path.join(REPO_ROOT, 'apps/web/src/app/data/sql_engage_dataset.csv'),
    replay_harness: REPLAY_SCRIPTS.real,
    normalize_script: path.join(REPO_ROOT, 'scripts/normalize-real-traces.mjs')
  },
  experiment: {
    policies: path.join(REPO_ROOT, 'dist/policies.json'),
    sql_engage_ts: path.join(REPO_ROOT, 'apps/web/src/app/data/sql-engage.ts'),
    sql_engage_csv: path.join(REPO_ROOT, 'apps/web/src/app/data/sql_engage_dataset.csv'),
    replay_harness: REPLAY_SCRIPTS.experiment
  }
};

function sha256(content) {
  return crypto.createHash('sha256').update(content).digest('hex');
}

async function sha256File(filePath) {
  const content = await readFile(filePath);
  return sha256(content);
}

function runReplay(mode) {
  const script = REPLAY_SCRIPTS[mode];
  if (!script) {
    throw new Error(`Unknown replay mode: ${mode}`);
  }
  
  console.log(`Running ${mode} replay...`);
  const result = spawnSync(process.execPath, [script], {
    cwd: REPO_ROOT,
    stdio: 'inherit'
  });
  
  if (result.status !== 0) {
    throw new Error(`${mode} replay failed with exit code ${result.status}`);
  }
}

async function getCurrentInputDigests(mode) {
  const paths = INPUT_FILE_PATHS[mode];
  const entries = await Promise.all(
    Object.entries(paths).map(async ([key, filePath]) => {
      try {
        return [key, await sha256File(filePath)];
      } catch (error) {
        console.warn(`Warning: Could not read ${filePath}`);
        return [key, 'missing'];
      }
    })
  );
  return Object.fromEntries(entries);
}

async function readReplayOutput(mode) {
  const outputPath = OUTPUT_PATHS[mode];
  const raw = await readFile(outputPath, 'utf8');
  const output = JSON.parse(raw);
  
  const checksumField = mode === 'experiment' ? 'policyOnlyChecksum' : 'policy_only_checksum_sha256';
  
  if (!output?.[checksumField]) {
    throw new Error(
      `Missing ${checksumField} in replay output: ${outputPath}`
    );
  }
  return output;
}

async function readBaseline(mode) {
  const baselinePath = BASELINE_PATHS[mode];
  try {
    const raw = await readFile(baselinePath, 'utf8');
    return JSON.parse(raw);
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
      throw new Error(
        `Replay checksum baseline not found: ${baselinePath}. Run \`npm run replay:gate:update\` to create it.`
      );
    }
    throw error;
  }
}

async function writeBaseline(mode, payload) {
  const baselinePath = BASELINE_PATHS[mode];
  await writeFile(baselinePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
}

function sameInputs(current, baseline) {
  const keys = new Set([...Object.keys(current), ...Object.keys(baseline || {})]);
  for (const key of keys) {
    if (current[key] !== baseline?.[key]) return false;
  }
  return true;
}

async function runGate(mode, shouldUpdate) {
  console.log(`\n=== ${mode.toUpperCase()} Replay Checksum Gate ===\n`);
  
  // For real/experiment modes, we need a placeholder since we don't have fixtures
  if (mode !== 'toy') {
    console.log(`${mode} replay gate: SKIPPED`);
    console.log(`Reason: No fixture input available for ${mode} replay.`);
    console.log(`The ${mode} replay requires real trace input which is not available in CI.`);
    console.log(`Toy replay gate provides coverage for replay logic correctness.`);
    return { status: 'skipped', mode };
  }
  
  runReplay(mode);

  const [inputDigests, replayOutput] = await Promise.all([
    getCurrentInputDigests(mode),
    readReplayOutput(mode)
  ]);

  const checksumField = mode === 'experiment' ? 'policyOnlyChecksum' : 'policy_only_checksum_sha256';
  const versionField = mode === 'experiment' ? 'policySemanticsVersion' : 'replay_policy_semantics_version';

  if (shouldUpdate) {
    await writeBaseline(mode, {
      schema_version: 2,
      mode,
      description:
        'Replay checksum regression baseline. Enforce exact checksum only when fixture/policy input digests are unchanged.',
      fixture_policy_input_digests_sha256: inputDigests,
      expected: {
        [checksumField]: replayOutput[checksumField],
        replay_harness_version: replayOutput.replay_harness_version,
        [versionField]: replayOutput[versionField],
        sql_engage_policy_version: replayOutput.sql_engage_policy_version
      },
      updated_at: new Date().toISOString()
    });
    console.log(`Replay checksum baseline updated: ${BASELINE_PATHS[mode]}`);
    return { status: 'updated', mode };
  }

  const baseline = await readBaseline(mode);
  const unchangedInputs = sameInputs(
    inputDigests,
    baseline.fixture_policy_input_digests_sha256
  );
  
  if (!unchangedInputs) {
    console.log('Replay checksum gate skipped: fixture/policy inputs changed.');
    console.log('Run `npm run replay:gate:update` after reviewing intended replay changes.');
    return { status: 'skipped', mode, reason: 'inputs_changed' };
  }

  const expectedChecksum = baseline?.expected?.[checksumField];
  const actualChecksum = replayOutput[checksumField];
  
  if (!expectedChecksum) {
    throw new Error(`Baseline missing expected.${checksumField}: ${BASELINE_PATHS[mode]}`);
  }

  if (actualChecksum !== expectedChecksum) {
    console.error('Replay checksum regression gate FAILED.');
    console.error(`Expected: ${expectedChecksum}`);
    console.error(`Actual:   ${actualChecksum}`);
    console.error('Inputs are unchanged, so this indicates non-deterministic or unintended replay drift.');
    process.exitCode = 1;
    return { status: 'failed', mode };
  }

  console.log('Replay checksum regression gate PASSED.');
  console.log(`Policy-only checksum: ${actualChecksum}`);
  return { status: 'passed', mode };
}

async function main() {
  const args = process.argv.slice(2);
  const shouldUpdate = args.includes('--update');
  
  // Determine mode
  let mode = 'toy';
  if (args.includes('--real')) mode = 'real';
  if (args.includes('--experiment')) mode = 'experiment';
  
  // Run single mode or all
  const modes = (mode === 'toy' && !args.includes('--all')) 
    ? ['toy'] 
    : ['toy', 'real', 'experiment'];
  
  const results = [];
  
  for (const m of modes) {
    try {
      const result = await runGate(m, shouldUpdate);
      results.push(result);
    } catch (error) {
      console.error(`${m} gate error: ${error.message}`);
      results.push({ status: 'error', mode: m, error: error.message });
      process.exitCode = 1;
    }
  }
  
  // Summary
  console.log('\n=== Checksum Gate Summary ===');
  for (const r of results) {
    console.log(`${r.mode}: ${r.status.toUpperCase()}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
