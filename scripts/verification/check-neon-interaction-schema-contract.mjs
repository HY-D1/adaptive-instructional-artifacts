#!/usr/bin/env node

import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '..', '..');

const DEFAULT_RUNTIME_PATH = join(repoRoot, 'apps/server/src/db/neon.ts');
const DEFAULT_MIGRATION_PATH = join(repoRoot, 'apps/server/src/db/migrate-neon.sql');
const DEFAULT_EVENT_FIELDS_MIGRATION_PATH = join(repoRoot, 'apps/server/src/db/migrations/20261031-interaction-event-fields.sql');

const EVENT_FIELDS_COLUMNS = [
  ['condition_id', 'TEXT'],
  ['execution_time_ms', 'DOUBLE PRECISION'],
  ['metadata', 'TEXT'],
];

export const REQUIRED_RESEARCH_COLUMNS = [
  ['hint_id', 'TEXT'],
  ['concept_id', 'TEXT'],
  ['source', 'TEXT'],
  ['total_time', 'INTEGER'],
  ['problems_attempted', 'INTEGER'],
  ['problems_solved', 'INTEGER'],
  ['learner_profile_id', 'TEXT'],
  ['escalation_trigger_reason', 'TEXT'],
  ['error_count_at_escalation', 'INTEGER'],
  ['time_to_escalation', 'INTEGER'],
  ['strategy_assigned', 'TEXT'],
  ['strategy_updated', 'TEXT'],
  ['reward_value', 'NUMERIC'],
];

function extractInteractionEventsBlock(source, filePath) {
  const match = source.match(/CREATE TABLE IF NOT EXISTS interaction_events\s*\(([\s\S]*?)\)\s*(?:`|;)/m);
  if (!match) {
    throw new Error(`Could not find interaction_events CREATE TABLE block in ${filePath}`);
  }
  return match[1];
}

function findMissingColumns(block) {
  return REQUIRED_RESEARCH_COLUMNS.filter(([columnName, columnType]) => {
    const pattern = new RegExp(`\\b${columnName}\\s+${columnType}\\b`, 'm');
    return !pattern.test(block);
  });
}

export function verifyInteractionSchemaContract({
  runtimePath = DEFAULT_RUNTIME_PATH,
  migrationPath = DEFAULT_MIGRATION_PATH,
  eventFieldsMigrationPath = DEFAULT_EVENT_FIELDS_MIGRATION_PATH,
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
      block = extractInteractionEventsBlock(source, filePath);
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
      continue;
    }

    const missing = findMissingColumns(block);
    for (const [columnName, columnType] of missing) {
      errors.push(`${label} missing interaction_events column: ${columnName} ${columnType}`);
    }
  }

  for (const [label, filePath] of [['runtime schema', runtimePath], ['event fields migration', eventFieldsMigrationPath]]) {
    if (!existsSync(filePath)) {
      errors.push(`${label} file missing: ${filePath}`);
      continue;
    }
    const source = readFileSync(filePath, 'utf8');
    for (const [name, type] of EVENT_FIELDS_COLUMNS) {
      const pattern = new RegExp(`ALTER TABLE interaction_events ADD COLUMN IF NOT EXISTS ${name}\\s+${type}\\b`, 'i');
      if (!pattern.test(source)) errors.push(`${label} missing additive interaction_events column: ${name} ${type}`);
    }
  }

  return {
    ok: errors.length === 0,
    errors,
    requiredColumns: REQUIRED_RESEARCH_COLUMNS,
  };
}

function main() {
  const result = verifyInteractionSchemaContract();

  if (!result.ok) {
    console.error('Neon interaction_events schema contract check failed:');
    for (const error of result.errors) {
      console.error(`- ${error}`);
    }
    process.exit(1);
  }

  console.log('Neon interaction_events schema contract guard passed.');
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  main();
}
