#!/usr/bin/env node

import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  REQUIRED_RESEARCH_COLUMNS,
  verifyInteractionSchemaContract,
} from './check-neon-interaction-schema-contract.mjs';

test('verifyInteractionSchemaContract passes for the checked-in Neon schema definitions', () => {
  const result = verifyInteractionSchemaContract();

  assert.equal(result.ok, true, result.errors.join('\n'));
  assert.equal(result.errors.length, 0);
});

test('verifyInteractionSchemaContract fails when a required RESEARCH-4 column is missing', () => {
  const fixtureDir = mkdtempSync(join(tmpdir(), 'neon-schema-contract-'));

  try {
    const runtimePath = join(fixtureDir, 'neon.ts');
    const migrationPath = join(fixtureDir, 'migrate-neon.sql');

    writeFileSync(
      runtimePath,
      `await db\`
        CREATE TABLE IF NOT EXISTS interaction_events (
          learner_profile_id TEXT,
          escalation_trigger_reason TEXT,
          error_count_at_escalation INTEGER,
          time_to_escalation INTEGER,
          strategy_assigned TEXT,
          strategy_updated TEXT,
          reward_value NUMERIC
        )
      \`;`,
      'utf8',
    );

    writeFileSync(
      migrationPath,
      `CREATE TABLE IF NOT EXISTS interaction_events (
        learner_profile_id TEXT,
        escalation_trigger_reason TEXT,
        error_count_at_escalation INTEGER,
        time_to_escalation INTEGER,
        strategy_updated TEXT,
        reward_value NUMERIC
      );`,
      'utf8',
    );

    const result = verifyInteractionSchemaContract({
      runtimePath,
      migrationPath,
    });

    assert.equal(result.ok, false);
    assert.ok(
      result.errors.some(error => error.includes('strategy_assigned')),
      `expected missing-column error, got: ${result.errors.join('\n')}`,
    );
    assert.deepEqual(result.requiredColumns, REQUIRED_RESEARCH_COLUMNS);
  } finally {
    rmSync(fixtureDir, { recursive: true, force: true });
  }
});
