#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';

function parseArgs(argv) {
  const out = {
    docId: '',
    runId: '',
    databaseUrl: process.env.DATABASE_URL || '',
    models: 'embeddinggemma:latest,qwen3-embedding:0.6b,qwen3-embedding:4b',
    outputDir: '',
    topK: '5',
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
    if (token === '--models' && next) {
      out.models = next;
      i += 1;
      continue;
    }
    if (token === '--output-dir' && next) {
      out.outputDir = next;
      i += 1;
      continue;
    }
    if (token === '--top-k' && next) {
      out.topK = next;
      i += 1;
      continue;
    }
  }

  return out;
}

const options = parseArgs(process.argv);
if (!options.docId || !options.runId) {
  console.error('Usage: node scripts/run-embedding-bakeoff.mjs --doc-id <docId> --run-id <runId> [--models <csv>] [--database-url <url>] [--output-dir <path>] [--top-k <n>]');
  process.exit(1);
}

const repoRoot = process.cwd();
const defaultPython = path.join(repoRoot, 'tools/pdf_ingest/.venv/bin/python');
const pythonBin = process.env.PDF_INGEST_PYTHON || (existsSync(defaultPython) ? defaultPython : 'python3');

const moduleArgs = [
  '-m',
  'pdf_ingest.embedding_bakeoff',
  '--doc-id',
  options.docId,
  '--run-id',
  options.runId,
  '--models',
  options.models,
  '--top-k',
  options.topK,
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
