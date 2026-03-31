#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';

function parseArgs(argv) {
  const out = {
    docId: '',
    runId: '',
    databaseUrl: process.env.DATABASE_URL || '',
    bundleDir: '.local/ingest-runs/ramakrishnan-smoke',
    apiBaseUrl: process.env.VITE_API_BASE_URL || 'http://127.0.0.1:3001',
    outputDir: '',
    source: 'neon',
  };

  for (let i = 2; i < argv.length; i += 1) {
    const token = argv[i];
    const next = argv[i + 1];
    if (token === '--doc-id' && next) {
      out.docId = next;
      i += 1;
      continue;
    }
    if (token === '--run-id' && next) {
      out.runId = next;
      i += 1;
      continue;
    }
    if (token === '--database-url' && next) {
      out.databaseUrl = next;
      i += 1;
      continue;
    }
    if (token === '--bundle-dir' && next) {
      out.bundleDir = next;
      i += 1;
      continue;
    }
    if (token === '--api-base-url' && next) {
      out.apiBaseUrl = next;
      i += 1;
      continue;
    }
    if (token === '--output-dir' && next) {
      out.outputDir = next;
      i += 1;
      continue;
    }
    if (token === '--source' && next) {
      out.source = next;
      i += 1;
      continue;
    }
  }

  return out;
}

const options = parseArgs(process.argv);
if (!options.docId || !options.runId) {
  console.error('Usage: node scripts/evaluate-corpus-product-fit.mjs --doc-id <docId> --run-id <runId> [--source neon|bundle|api]');
  process.exit(1);
}

const repoRoot = process.cwd();
const defaultPython = path.join(repoRoot, 'tools/pdf_ingest/.venv/bin/python');
const pythonBin = process.env.PDF_INGEST_PYTHON || (existsSync(defaultPython) ? defaultPython : 'python3');

const moduleArgs = [
  '-m',
  'pdf_ingest.quality_eval',
  '--doc-id',
  options.docId,
  '--run-id',
  options.runId,
  '--bundle-dir',
  options.bundleDir,
  '--api-base-url',
  options.apiBaseUrl,
  '--source',
  options.source,
];

if (options.databaseUrl) {
  moduleArgs.push('--database-url', options.databaseUrl);
}
if (options.outputDir) {
  moduleArgs.push('--output-dir', options.outputDir);
}

const env = {
  ...process.env,
  PYTHONPATH: process.env.PYTHONPATH
    ? `${path.join(repoRoot, 'tools/pdf_ingest/src')}:${process.env.PYTHONPATH}`
    : path.join(repoRoot, 'tools/pdf_ingest/src'),
};

const result = spawnSync(pythonBin, moduleArgs, {
  cwd: repoRoot,
  env,
  stdio: 'inherit',
});

process.exit(result.status ?? 1);
