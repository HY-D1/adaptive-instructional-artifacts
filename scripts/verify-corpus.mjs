#!/usr/bin/env node
import { neon } from '@neondatabase/serverless';

const databaseUrl = process.env.DATABASE_URL || process.env.NEON_DATABASE_URL || process.env.adaptive_data_DATABASE_URL || process.env.adaptive_data_POSTGRES_URL;

if (!databaseUrl) {
  console.error('DATABASE_URL (or Neon alias env var) is required');
  process.exit(1);
}

const sql = neon(databaseUrl);

async function main() {
  const [docCountRow] = await sql`SELECT COUNT(*)::int AS count FROM corpus_documents`;
  const [unitCountRow] = await sql`SELECT COUNT(*)::int AS count FROM corpus_units`;
  const [chunkCountRow] = await sql`SELECT COUNT(*)::int AS count FROM corpus_chunks`;
  const [missingProvenanceRow] = await sql`
    SELECT COUNT(*)::int AS count
    FROM corpus_units
    WHERE run_id IS NULL OR parser_backend IS NULL OR pipeline_version IS NULL
  `;
  const [duplicateUnitIdsRow] = await sql`
    SELECT COALESCE(SUM(c), 0)::int AS count
    FROM (
      SELECT GREATEST(COUNT(*) - 1, 0) AS c
      FROM corpus_units
      GROUP BY unit_id
    ) t
  `;
  const [nullChunkTextRow] = await sql`
    SELECT COUNT(*)::int AS count
    FROM corpus_chunks
    WHERE chunk_text IS NULL OR LENGTH(TRIM(chunk_text)) = 0
  `;

  const summary = {
    documents: Number(docCountRow?.count ?? 0),
    units: Number(unitCountRow?.count ?? 0),
    chunks: Number(chunkCountRow?.count ?? 0),
    missingUnitProvenance: Number(missingProvenanceRow?.count ?? 0),
    duplicateUnitIds: Number(duplicateUnitIdsRow?.count ?? 0),
    emptyChunks: Number(nullChunkTextRow?.count ?? 0),
  };

  console.log(JSON.stringify(summary, null, 2));

  const ok =
    summary.documents >= 1 &&
    summary.units >= 1 &&
    summary.chunks >= 1 &&
    summary.missingUnitProvenance === 0 &&
    summary.duplicateUnitIds === 0 &&
    summary.emptyChunks === 0;

  if (!ok) {
    process.exit(2);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
