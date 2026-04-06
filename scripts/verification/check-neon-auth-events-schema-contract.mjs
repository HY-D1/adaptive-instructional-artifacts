#!/usr/bin/env node

import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '..', '..');

const DEFAULT_RUNTIME_PATH = join(repoRoot, 'apps/server/src/db/neon.ts');
const DEFAULT_MIGRATION_PATH = join(repoRoot, 'apps/server/src/db/migrate-neon.sql');

export const REQUIRED_AUTH_EVENT_COLUMNS = [
  ['id', 'TEXT'],
  ['timestamp', 'TIMESTAMPTZ'],
  ['email_hash', 'TEXT'],
  ['account_id', 'TEXT'],
  ['learner_id', 'TEXT'],
  ['role', 'TEXT'],
  ['outcome', 'TEXT'],
  ['failure_reason', 'TEXT'],
  ['created_at', 'TIMESTAMPTZ'],
];

function extractAuthEventsBlock(source, filePath) {
  const match = source.match(/CREATE TABLE IF NOT EXISTS auth_events\s*\(([\s\S]*?)\)\s*(?:`|;)/m);
  if (!match) {
    throw new Error(`Could not find auth_events CREATE TABLE block in ${filePath}`);
  }
  return match[1];
}

function findMissingColumns(block) {
  return REQUIRED_AUTH_EVENT_COLUMNS.filter(([columnName, columnType]) => {
    const pattern = new RegExp(`\\b${columnName}\\s+${columnType}\\b`, 'm');
    return !pattern.test(block);
  });
}

export function verifyAuthEventsSchemaContract({
  runtimePath = DEFAULT_RUNTIME_PATH,
  migrationPath = DEFAULT_MIGRATION_PATH,
} = {}) {
  const errors = [];
  const checkedFiles = [
    ['runtime schema', runtimePath],
    ['SQL migration', migrationPath],
  ];

  for (const [label, filePath] of checkedFiles) {
    if (!existsSync(filePath)) {
      errors.push(`${label} file missing: ${filePath}`);
      continue;
    }

    const source = readFileSync(filePath, 'utf8');
    let block;
    try {
      block = extractAuthEventsBlock(source, filePath);
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
      continue;
    }

    const missing = findMissingColumns(block);
    for (const [columnName, columnType] of missing) {
      errors.push(`${label} missing auth_events column: ${columnName} ${columnType}`);
    }
  }

  return {
    ok: errors.length === 0,
    errors,
    requiredColumns: REQUIRED_AUTH_EVENT_COLUMNS,
  };
}

function main() {
  const result = verifyAuthEventsSchemaContract();

  if (!result.ok) {
    console.error('Neon auth_events schema contract check failed:');
    for (const error of result.errors) {
      console.error(`- ${error}`);
    }
    process.exit(1);
  }

  console.log('Neon auth_events schema contract guard passed.');
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  main();
}
