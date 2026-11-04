/**
 * Dated-migration runner for Neon.
 *
 * Applies apps/server/src/db/migrations/production-manifest.txt entries in
 * order and records each one in a schema_migrations ledger (filename + sha256).
 *
 *   npm run db:migrate                 # dry run (default): show pending/changed
 *   npm run db:migrate -- --apply      # execute pending migrations
 *   npm run db:migrate -- --baseline   # record all listed files as applied
 *                                      # WITHOUT running them (for databases
 *                                      # where they were applied by hand)
 *
 * Target: MIGRATE_DATABASE_URL, else the normal DATABASE_URL resolution.
 * Each file must be idempotent (IF NOT EXISTS / ON CONFLICT); files may carry
 * their own BEGIN/COMMIT, so the ledger row is written after the file succeeds.
 */
import '../load-env.js';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Pool } from '@neondatabase/serverless';
import { resolveDbEnv } from './env-resolver.js';

export const MIGRATIONS_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), 'migrations');

export interface ManifestEntry {
  filename: string;
  checksum: string;
  sql: string;
}

export interface AppliedRow {
  filename: string;
  checksum: string;
}

export interface MigrationPlan {
  pending: ManifestEntry[];
  changed: Array<{ filename: string; applied: string; current: string }>;
  applied: string[];
}

export function readManifest(dir: string = MIGRATIONS_DIR): ManifestEntry[] {
  return readFileSync(path.join(dir, 'production-manifest.txt'), 'utf8')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'))
    .map((filename) => {
      if (!/^[\w.-]+\.sql$/.test(filename)) {
        throw new Error(`Invalid manifest entry: ${filename}`);
      }
      const sql = readFileSync(path.join(dir, filename), 'utf8');
      return { filename, sql, checksum: createHash('sha256').update(sql).digest('hex') };
    });
}

export function planMigrations(manifest: ManifestEntry[], appliedRows: AppliedRow[]): MigrationPlan {
  const applied = new Map(appliedRows.map((row) => [row.filename, row.checksum]));
  const plan: MigrationPlan = { pending: [], changed: [], applied: [] };
  for (const entry of manifest) {
    const appliedChecksum = applied.get(entry.filename);
    if (appliedChecksum === undefined) {
      plan.pending.push(entry);
    } else if (appliedChecksum !== entry.checksum) {
      plan.changed.push({ filename: entry.filename, applied: appliedChecksum, current: entry.checksum });
    } else {
      plan.applied.push(entry.filename);
    }
  }
  return plan;
}

const LEDGER_DDL = `
  CREATE TABLE IF NOT EXISTS schema_migrations (
    filename TEXT PRIMARY KEY,
    checksum TEXT NOT NULL,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )
`;

async function main(): Promise<void> {
  const args = new Set(process.argv.slice(2));
  const apply = args.has('--apply');
  const baseline = args.has('--baseline');
  if (apply && baseline) throw new Error('Use either --apply or --baseline, not both');

  const url = process.env.MIGRATE_DATABASE_URL || resolveDbEnv().url;
  if (!url) throw new Error('Set MIGRATE_DATABASE_URL or DATABASE_URL');
  console.log(`Target host: ${new URL(url).hostname}`);
  console.log(`Mode: ${apply ? 'APPLY' : baseline ? 'BASELINE (record only)' : 'DRY RUN'}`);

  const pool = new Pool({ connectionString: url });
  try {
    if (apply || baseline) await pool.query(LEDGER_DDL);
    const ledgerExists = (await pool.query(`SELECT to_regclass('public.schema_migrations') AS t`)).rows[0]?.t;
    const appliedRows: AppliedRow[] = ledgerExists
      ? (await pool.query('SELECT filename, checksum FROM schema_migrations')).rows
      : [];
    const plan = planMigrations(readManifest(), appliedRows);

    for (const name of plan.applied) console.log(`  applied  ${name}`);
    for (const change of plan.changed) console.log(`  CHANGED  ${change.filename} (ledger ${change.applied.slice(0, 12)} != file ${change.current.slice(0, 12)})`);
    for (const entry of plan.pending) console.log(`  pending  ${entry.filename}`);

    if (plan.changed.length > 0 && (apply || baseline)) {
      throw new Error('Applied migration files changed; add a new dated migration instead of editing old ones');
    }
    if (!apply && !baseline) {
      console.log('Dry run only. Re-run with --apply to execute pending migrations.');
      return;
    }

    for (const entry of plan.pending) {
      if (apply) {
        console.log(`Applying ${entry.filename} ...`);
        await pool.query(entry.sql);
      }
      await pool.query(
        'INSERT INTO schema_migrations (filename, checksum) VALUES ($1, $2) ON CONFLICT (filename) DO NOTHING',
        [entry.filename, entry.checksum],
      );
      console.log(`Recorded ${entry.filename}`);
    }
  } finally {
    await pool.end();
  }
}

const invokedDirectly = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
