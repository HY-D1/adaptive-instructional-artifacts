#!/usr/bin/env node
import { neon } from '@neondatabase/serverless';

const DB_ENV_KEYS = [
  'DATABASE_URL',
  'NEON_DATABASE_URL',
  'adaptive_data_DATABASE_URL',
  'adaptive_data_POSTGRES_URL',
];

function resolveDatabaseUrl() {
  for (const key of DB_ENV_KEYS) {
    const value = (process.env[key] || '').trim();
    if (value) {
      return { url: value, source: key };
    }
  }
  return { url: '', source: '' };
}

function parseArgs(argv) {
  const out = {
    docId: '',
    runId: '',
    updatedBy: 'scripts/set-corpus-active-run.mjs',
  };

  for (let i = 2; i < argv.length; i += 1) {
    const token = argv[i];
    const next = argv[i + 1];
    if (token === '--doc-id' && next) {
      out.docId = next.trim();
      i += 1;
      continue;
    }
    if (token === '--run-id' && next) {
      out.runId = next.trim();
      i += 1;
      continue;
    }
    if (token === '--updated-by' && next) {
      out.updatedBy = next.trim() || out.updatedBy;
      i += 1;
      continue;
    }
  }

  return out;
}

async function main() {
  const args = parseArgs(process.argv);
  if (!args.docId || !args.runId) {
    console.error('Usage: node scripts/set-corpus-active-run.mjs --doc-id <docId> --run-id <runId> [--updated-by <actor>]');
    process.exit(1);
  }

  const { url: databaseUrl, source } = resolveDatabaseUrl();
  if (!databaseUrl) {
    console.error(`Missing Neon database URL. Set one of: ${DB_ENV_KEYS.join(', ')}`);
    process.exit(1);
  }

  const sql = neon(databaseUrl);

  const [docRow] = await sql`
    SELECT doc_id
    FROM corpus_documents
    WHERE doc_id = ${args.docId}
    LIMIT 1
  `;
  if (!docRow) {
    console.error(`Unknown doc_id: ${args.docId}`);
    process.exit(2);
  }

  const [runRow] = await sql`
    SELECT unit_id
    FROM corpus_units
    WHERE doc_id = ${args.docId}
      AND run_id = ${args.runId}
    LIMIT 1
  `;
  if (!runRow) {
    console.error(`Run ${args.runId} has no units for doc ${args.docId}`);
    process.exit(2);
  }

  const [result] = await sql`
    INSERT INTO corpus_active_runs (doc_id, run_id, updated_at, updated_by)
    VALUES (${args.docId}, ${args.runId}, NOW(), ${args.updatedBy})
    ON CONFLICT (doc_id) DO UPDATE
    SET run_id = EXCLUDED.run_id,
        updated_at = NOW(),
        updated_by = EXCLUDED.updated_by
    RETURNING doc_id, run_id, updated_at, updated_by
  `;

  console.log(
    JSON.stringify(
      {
        success: true,
        envSource: source,
        activeRun: {
          docId: result.doc_id,
          runId: result.run_id,
          updatedAt: new Date(result.updated_at).toISOString(),
          updatedBy: result.updated_by ?? null,
        },
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
