/* @vitest-environment node */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  NEON_REQUIRED_TABLES,
  SCHEMA_CONTRACT_VERSION,
} from '../../../apps/server/src/db/schema-contract';

const repoRoot = process.cwd();

function readRepoFile(path: string): string {
  return readFileSync(join(repoRoot, path), 'utf8');
}

function extractCreatedTables(sql: string): string[] {
  return Array.from(
    sql.matchAll(/CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+([a-z_][a-z0-9_]*)/gi),
    (match) => match[1].toLowerCase(),
  );
}

function extractActiveRunSeed(sql: string): string {
  const match = sql.match(
    /INSERT\s+INTO\s+corpus_active_runs[\s\S]*?ON\s+CONFLICT\s*\(doc_id\)\s+DO\s+NOTHING/i,
  );
  return match?.[0] ?? '';
}

describe('authoritative Neon schema contract', () => {
  it('keeps the runtime initializer and migration SQL in exact 17-table parity', () => {
    const runtimeSource = [
      readRepoFile('apps/server/src/db/neon.ts'),
      readRepoFile('apps/server/src/db/auth.ts'),
    ].join('\n');
    const migrationSource = readRepoFile('apps/server/src/db/migrate-neon.sql');
    const expected = [...NEON_REQUIRED_TABLES].sort();

    expect(SCHEMA_CONTRACT_VERSION).toBe('v1.2.0');
    expect(new Set(NEON_REQUIRED_TABLES).size).toBe(17);
    expect([...new Set(extractCreatedTables(runtimeSource))].sort()).toEqual(expected);
    expect([...new Set(extractCreatedTables(migrationSource))].sort()).toEqual(expected);
    expect(migrationSource).not.toMatch(/ADD\s+CONSTRAINT\s+IF\s+NOT\s+EXISTS/i);
    for (const source of [runtimeSource, migrationSource]) {
      expect(source).toMatch(
        /CREATE\s+UNIQUE\s+INDEX\s+IF\s+NOT\s+EXISTS\s+idx_retrievals_event_unit/i,
      );
    }
  });

  it('routes both Neon provisioning commands through real TypeScript entrypoints', () => {
    const serverPackage = JSON.parse(readRepoFile('apps/server/package.json')) as {
      scripts: Record<string, string>;
    };

    expect(serverPackage.scripts['db:init:neon']).toBe('tsx src/db/init-neon.ts');
    expect(serverPackage.scripts['db:migrate']).toBe('tsx src/db/migrate.ts');
    expect(existsSync(join(repoRoot, 'apps/server/src/db/init-neon.ts'))).toBe(true);
    expect(existsSync(join(repoRoot, 'apps/server/src/db/migrate.ts'))).toBe(true);

    const initSource = readRepoFile('apps/server/src/db/init-neon.ts');
    const migrateSource = readRepoFile('apps/server/src/db/migrate.ts');
    expect(initSource).toContain('provisionNeonSchema');
    expect(initSource).not.toContain('SELECT NOW()');
    expect(migrateSource).toContain("import './init-neon.js'");
  });

  it('conditions the active-run seed on an existing corpus parent before learner profile DDL', () => {
    const sources = [
      readRepoFile('apps/server/src/db/neon.ts'),
      readRepoFile('apps/server/src/db/migrate-neon.sql'),
    ];

    for (const source of sources) {
      const seed = extractActiveRunSeed(source);
      const seedIndex = source.indexOf(seed);
      const learnerProfilesIndex = source.indexOf('CREATE TABLE IF NOT EXISTS learner_profiles');

      expect(seed).toMatch(/INSERT\s+INTO\s+corpus_active_runs[\s\S]*?SELECT/i);
      expect(seed).toMatch(/FROM\s+corpus_documents/i);
      expect(seed).toMatch(/WHERE[\s\S]*?doc_id/i);
      expect(seed).not.toMatch(/\bVALUES\s*\(/i);
      expect(seedIndex).toBeGreaterThan(-1);
      expect(learnerProfilesIndex).toBeGreaterThan(seedIndex);
    }
  });
});
