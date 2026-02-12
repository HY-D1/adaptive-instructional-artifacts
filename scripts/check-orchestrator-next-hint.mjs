import { readFile, mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..');
const ORCHESTRATOR_ENTRY = path.join(REPO_ROOT, 'apps/web/src/app/lib/adaptive-orchestrator.ts');
const EXPECTED_KEYS = [
  'hintText',
  'sqlEngageSubtype',
  'sqlEngageRowId',
  'hintLevel',
  'policyVersion',
  'shouldEscalate'
];

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

const rawCsvPlugin = {
  name: 'raw-csv-loader',
  setup(esbuild) {
    esbuild.onResolve({ filter: /\.csv\?raw$/ }, (args) => ({
      path: path.resolve(args.resolveDir, args.path.replace(/\?raw$/, '')),
      namespace: 'raw-csv'
    }));

    esbuild.onLoad({ filter: /\.csv$/, namespace: 'raw-csv' }, async (args) => {
      const csv = await readFile(args.path, 'utf8');
      return {
        contents: `export default ${JSON.stringify(csv)};`,
        loader: 'js'
      };
    });
  }
};

async function loadOrchestratorModule() {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'orchestrator-contract-check-'));
  const outfile = path.join(tempDir, 'adaptive-orchestrator.bundle.mjs');
  try {
    await build({
      entryPoints: [ORCHESTRATOR_ENTRY],
      outfile,
      bundle: true,
      format: 'esm',
      platform: 'node',
      target: ['node18'],
      logLevel: 'silent',
      plugins: [rawCsvPlugin]
    });

    const moduleUrl = `${pathToFileURL(outfile).href}?ts=${Date.now()}`;
    const mod = await import(moduleUrl);
    return { mod, tempDir };
  } catch (error) {
    await rm(tempDir, { recursive: true, force: true });
    throw error;
  }
}

function assertShape(result) {
  const actualKeys = Object.keys(result);
  assert(
    actualKeys.length === EXPECTED_KEYS.length,
    `getNextHint returned ${actualKeys.length} keys, expected ${EXPECTED_KEYS.length}: ${actualKeys.join(', ')}`
  );

  const missing = EXPECTED_KEYS.filter((key) => !actualKeys.includes(key));
  assert(missing.length === 0, `getNextHint missing required keys: ${missing.join(', ')}`);

  const extra = actualKeys.filter((key) => !EXPECTED_KEYS.includes(key));
  assert(extra.length === 0, `getNextHint returned unexpected keys: ${extra.join(', ')}`);

  assert(typeof result.hintText === 'string' && result.hintText.trim().length > 0, 'hintText must be a non-empty string');
  assert(typeof result.sqlEngageSubtype === 'string' && result.sqlEngageSubtype.trim().length > 0, 'sqlEngageSubtype must be a non-empty string');
  assert(typeof result.sqlEngageRowId === 'string' && result.sqlEngageRowId.trim().length > 0, 'sqlEngageRowId must be a non-empty string');
  assert([1, 2, 3].includes(result.hintLevel), `hintLevel must be 1..3, got ${result.hintLevel}`);
  assert(typeof result.policyVersion === 'string' && result.policyVersion.trim().length > 0, 'policyVersion must be a non-empty string');
  assert(typeof result.shouldEscalate === 'boolean', 'shouldEscalate must be boolean');
}

function assertStableRowId(orchestrator, args, label) {
  const runs = Array.from({ length: 5 }, () => orchestrator.getNextHint(...args));
  const baselineRowId = runs[0].sqlEngageRowId;
  runs.forEach((result, index) => {
    assertShape(result);
    assert(
      result.sqlEngageRowId === baselineRowId,
      `${label} run ${index + 1} rowId drifted: ${result.sqlEngageRowId} vs ${baselineRowId}`
    );
  });
  return baselineRowId;
}

async function main() {
  const { mod, tempDir } = await loadOrchestratorModule();
  try {
    const orchestrator = mod?.orchestrator;
    assert(orchestrator && typeof orchestrator.getNextHint === 'function', 'orchestrator.getNextHint not found');

    const profile = {
      id: 'learner-contract-check',
      name: 'Contract Check',
      conceptsCovered: new Set(),
      errorHistory: new Map(),
      interactionCount: 0,
      currentStrategy: 'adaptive-medium',
      preferences: {
        escalationThreshold: 3,
        aggregationDelay: 6
      }
    };

    const level1Args = [
      'undefined column',
      0,
      profile,
      'problem-contract-check',
      {
        knownSubtypeOverride: undefined,
        isSubtypeOverrideActive: false
      }
    ];
    const level2Args = [
      'undefined column',
      1,
      profile,
      'problem-contract-check',
      {
        knownSubtypeOverride: undefined,
        isSubtypeOverrideActive: false
      }
    ];

    const level1RowId = assertStableRowId(orchestrator, level1Args, 'L1');
    const level2RowId = assertStableRowId(orchestrator, level2Args, 'L2');

    console.log(`[orchestrator-next-hint] contract_keys=${EXPECTED_KEYS.join(',')}`);
    console.log(`[orchestrator-next-hint] stable_row_id_L1=${level1RowId}`);
    console.log(`[orchestrator-next-hint] stable_row_id_L2=${level2RowId}`);
    console.log('[orchestrator-next-hint] PASS');
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(`[orchestrator-next-hint] FAIL: ${error.message}`);
  process.exitCode = 1;
});
