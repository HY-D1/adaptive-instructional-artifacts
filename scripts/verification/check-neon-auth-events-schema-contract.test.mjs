#!/usr/bin/env node

import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  REQUIRED_AUTH_EVENT_COLUMNS,
  verifyAuthEventsSchemaContract,
} from './check-neon-auth-events-schema-contract.mjs';

test('verifyAuthEventsSchemaContract passes for the checked-in Neon schema definitions', () => {
  const result = verifyAuthEventsSchemaContract();

  assert.equal(result.ok, true, result.errors.join('\n'));
  assert.equal(result.errors.length, 0);
});

test('verifyAuthEventsSchemaContract fails when a required auth_events column is missing', () => {
  const fixtureDir = mkdtempSync(join(tmpdir(), 'auth-events-schema-contract-'));

  try {
    const runtimePath = join(fixtureDir, 'neon.ts');
    const migrationPath = join(fixtureDir, 'migrate-neon.sql');

    writeFileSync(
      runtimePath,
      `await db\`
        CREATE TABLE IF NOT EXISTS auth_events (
          id TEXT PRIMARY KEY,
          timestamp TIMESTAMPTZ NOT NULL,
          email_hash TEXT NOT NULL,
          account_id TEXT,
          learner_id TEXT,
          role TEXT,
          outcome TEXT NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      \`;`,
      'utf8',
    );

    writeFileSync(
      migrationPath,
      `CREATE TABLE IF NOT EXISTS auth_events (
        id TEXT PRIMARY KEY,
        timestamp TIMESTAMPTZ NOT NULL,
        email_hash TEXT NOT NULL,
        account_id TEXT,
        learner_id TEXT,
        role TEXT,
        outcome TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );`,
      'utf8',
    );

    const result = verifyAuthEventsSchemaContract({
      runtimePath,
      migrationPath,
    });

    assert.equal(result.ok, false);
    assert.ok(
      result.errors.some(error => error.includes('failure_reason')),
      `expected missing-column error, got: ${result.errors.join('\n')}`,
    );
    assert.deepEqual(result.requiredColumns, REQUIRED_AUTH_EVENT_COLUMNS);
  } finally {
    rmSync(fixtureDir, { recursive: true, force: true });
  }
});
