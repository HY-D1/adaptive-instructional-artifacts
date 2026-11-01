#!/usr/bin/env node
/**
 * Read-only migration rehearsal fingerprints. Never emits rows or SQL values.
 * Run after intentionally seeded fixtures and before migration/application traffic:
 *   node scripts/deploy/verify-migration-data.mjs --output /tmp/before.json
 * Run after the migration, before application traffic:
 *   node scripts/deploy/verify-migration-data.mjs --baseline /tmp/before.json --output /tmp/after.json
 * The URL must be supplied through the environment, never as a CLI argument.
 * A mismatch exits 1. Snapshots are private, new files under an OS temp directory.
 */
import { neon } from '@neondatabase/serverless';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// A single statement discovers the catalog and hashes selected columns within
// one repeatable-read snapshot. Identifiers are quoted by PostgreSQL itself;
// manifest contents are bound as a JSON parameter rather than interpolated.
const FINGERPRINT_SQL = `
WITH catalog AS (
  SELECT c.oid, n.nspname AS table_schema, c.relname AS table_name,
    row_security_active(c.oid) AS rls_active,
    COALESCE((SELECT jsonb_agg(jsonb_build_object(
      'name', a.attname, 'type', format_type(a.atttypid, a.atttypmod),
      'nullable', NOT (a.attnotnull OR typ.typnotnull)) ORDER BY a.attnum)
      FROM pg_attribute a JOIN pg_type typ ON typ.oid = a.atttypid
      WHERE a.attrelid = c.oid AND a.attnum > 0 AND NOT a.attisdropped), '[]'::jsonb) AS columns,
    (SELECT entry FROM jsonb_array_elements(COALESCE($1::jsonb->'tables', '[]'::jsonb)) entry
      WHERE entry->>'schema' = n.nspname AND entry->>'name' = c.relname) AS baseline_table
  FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p')
), selected AS (
  SELECT *, CASE WHEN $1::jsonb IS NULL THEN columns ELSE baseline_table->'columns' END AS selected_columns
  FROM catalog
), checks AS (
  SELECT *, NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements(COALESCE(selected_columns, '[]'::jsonb)) original
    WHERE NOT EXISTS (SELECT 1 FROM jsonb_array_elements(columns) current_col
      WHERE current_col->>'name' = original->>'name')
  ) AS has_original_columns
  FROM selected
), calculated AS (
  SELECT *, CASE WHEN selected_columns IS NOT NULL AND has_original_columns AND NOT rls_active THEN
    query_to_xml(format(
      'SELECT count(*) AS row_count, encode(sha256(convert_to(COALESCE(string_agg(row_digest, '''' ORDER BY row_digest COLLATE "C"), ''''), ''UTF8'')), ''hex'') AS row_hash FROM (SELECT encode(sha256(convert_to(row_to_json(t)::text, ''UTF8'')), ''hex'') AS row_digest FROM (SELECT %s FROM %I.%I) t) fingerprint_rows',
      COALESCE((SELECT string_agg(format('%I', column_value->>'name'), ', ' ORDER BY ord)
        FROM jsonb_array_elements(selected_columns) WITH ORDINALITY AS col(column_value, ord)), ''),
      table_schema, table_name), true, false, '')
    ELSE NULL END AS fingerprint
  FROM checks
)
SELECT table_schema, table_name, columns, rls_active,
  CASE WHEN fingerprint IS NULL THEN NULL ELSE ((xpath('/table/row/row_count/text()', fingerprint))[1]::text)::bigint END AS row_count,
  CASE WHEN fingerprint IS NULL THEN NULL ELSE (xpath('/table/row/row_hash/text()', fingerprint))[1]::text END AS row_hash
FROM calculated ORDER BY table_schema COLLATE "C", table_name COLLATE "C"
`;

function validateManifest(snapshot) {
  if (!snapshot || snapshot.format !== 'migration-fingerprint-v1' || !Array.isArray(snapshot.tables)) throw new Error('Invalid snapshot format');
  const names = new Set();
  for (const table of snapshot.tables) {
    if (!table || table.schema !== 'public' || typeof table.name !== 'string' || !table.name || names.has(table.name) || !Array.isArray(table.columns)) throw new Error('Invalid snapshot table metadata');
    names.add(table.name);
    const columns = new Set();
    for (const column of table.columns) {
      if (!column || typeof column.name !== 'string' || !column.name || columns.has(column.name) || typeof column.type !== 'string' || typeof column.nullable !== 'boolean') throw new Error('Invalid snapshot column metadata');
      columns.add(column.name);
    }
    if (table.rowCount !== null && (!Number.isSafeInteger(table.rowCount) || table.rowCount < 0)) throw new Error('Invalid snapshot row count');
    if (table.sha256 !== null && (typeof table.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(table.sha256))) throw new Error('Invalid snapshot hash');
  }
}

export async function captureSnapshot(sql, baseline = null) {
  if (baseline !== null) {
    validateManifest(baseline);
    if (!baseline.tables.length || baseline.tables.some((table) => table.rowCount === null || table.sha256 === null)) throw new Error('Baseline must contain complete table fingerprints');
  }
  const [rows] = await sql.transaction([sql.query(FINGERPRINT_SQL, [baseline === null ? null : JSON.stringify(baseline)])], { isolationLevel: 'RepeatableRead', readOnly: true });
  // After migration, new tables are outside the original manifest and are
  // intentionally ignored, including any row-level security they introduce.
  const originalNames = baseline ? new Set(baseline.tables.map((table) => `${table.schema}.${table.name}`)) : null;
  const relevantRows = originalNames ? rows.filter((row) => originalNames.has(`${row.table_schema}.${row.table_name}`)) : rows;
  const tables = relevantRows.map((row) => {
    if (row.rls_active !== false) throw new Error(`Row-level security prevents a complete fingerprint for ${row.table_schema}.${row.table_name}`);
    const count = row.row_count === null ? null : Number(row.row_count);
    return { schema: row.table_schema, name: row.table_name, columns: row.columns, rowCount: count, sha256: row.row_hash };
  });
  const snapshot = { format: 'migration-fingerprint-v1', tables };
  validateManifest(snapshot);
  if (!baseline && (!tables.length || tables.some((table) => table.rowCount === null || table.sha256 === null))) throw new Error('Incomplete baseline fingerprint');
  return snapshot;
}

export function compareSnapshots(before, after) {
  validateManifest(before); validateManifest(after);
  if (!before.tables.length || before.tables.some((table) => table.rowCount === null || table.sha256 === null)) throw new Error('Baseline must contain complete table fingerprints');
  const differences = [];
  const current = new Map(after.tables.map((table) => [table.name, table]));
  for (const original of before.tables) {
    const actual = current.get(original.name);
    if (!actual) { differences.push(`${original.schema}.${original.name}: table missing`); continue; }
    const columns = new Map(actual.columns.map((column) => [column.name, column]));
    const oldNames = new Set(original.columns.map((column) => column.name));
    for (const column of original.columns) {
      const now = columns.get(column.name);
      if (!now || now.type !== column.type || now.nullable !== column.nullable) differences.push(`${original.schema}.${original.name}: original column changed or missing: ${column.name}`);
    }
    for (const column of actual.columns) if (!oldNames.has(column.name) && !column.nullable) differences.push(`${original.schema}.${original.name}: new non-nullable column: ${column.name}`);
    if (actual.rowCount !== original.rowCount || actual.sha256 !== original.sha256) differences.push(`${original.schema}.${original.name}: original rows changed`);
  }
  return differences;
}

function temporaryPath(file, existing = false) {
  if (!path.isAbsolute(file)) throw new Error('Snapshot path must be absolute');
  const parent = fs.realpathSync(path.dirname(file));
  const roots = [fs.realpathSync(os.tmpdir()), fs.realpathSync('/tmp')];
  if (!roots.some((root) => parent === root || parent.startsWith(root + path.sep))) throw new Error('Snapshot path must be in an OS temporary directory');
  const resolved = path.join(parent, path.basename(file));
  if (existing && fs.lstatSync(resolved).isSymbolicLink()) throw new Error('Snapshot file must not be a symbolic link');
  return resolved;
}

export function writeSnapshot(file, snapshot) {
  validateManifest(snapshot);
  const output = temporaryPath(file);
  const fd = fs.openSync(output, fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_NOFOLLOW, 0o600);
  try { fs.writeFileSync(fd, JSON.stringify(snapshot, null, 2) + '\n'); } finally { fs.closeSync(fd); }
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length !== 2 && args.length !== 4) throw new Error('Use --output /tmp/snapshot.json [--baseline /tmp/before.json]');
  const outputIndex = args.indexOf('--output');
  const baselineIndex = args.indexOf('--baseline');
  if (outputIndex < 0 || (args.length === 4 && baselineIndex < 0) || args.filter((value) => value === '--output').length !== 1 || args.filter((value) => value === '--baseline').length > 1) throw new Error('Invalid arguments');
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');
  let baseline = null;
  if (baselineIndex >= 0) {
    try { baseline = JSON.parse(fs.readFileSync(temporaryPath(args[baselineIndex + 1], true), 'utf8')); }
    catch { throw new Error('Baseline snapshot could not be read as JSON'); }
  }
  if (baseline) validateManifest(baseline);
  // Check output path before issuing any remote read; do not overwrite evidence.
  const out = temporaryPath(args[outputIndex + 1]);
  if (fs.existsSync(out)) throw new Error('Output file already exists');
  let sql;
  try { sql = neon(process.env.DATABASE_URL); } catch { throw new Error('Invalid DATABASE_URL'); }
  let snapshot;
  try { snapshot = await captureSnapshot(sql, baseline); } catch { throw new Error('Read-only snapshot failed; verify database access, row security, and schema compatibility'); }
  writeSnapshot(out, snapshot);
  const differences = baseline ? compareSnapshots(baseline, snapshot) : [];
  console.log(JSON.stringify({ status: differences.length ? 'mismatch' : baseline ? 'match' : 'captured', tables: snapshot.tables.length, differences }));
  if (differences.length) process.exitCode = 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => { console.error(JSON.stringify({ status: 'error', error: error.message })); process.exitCode = 1; });
}
