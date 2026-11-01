import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { captureSnapshot, compareSnapshots, writeSnapshot } from './verify-migration-data.mjs';

const table = { schema: 'public', name: 'learners', columns: [{ name: 'id', type: 'text', nullable: false }], rowCount: 2, sha256: 'a'.repeat(64) };
const baseline = { format: 'migration-fingerprint-v1', tables: [table] };

test('captures all table fingerprints in one repeatable-read read-only transaction', async () => {
  let options;
  const sql = { query: (query, params) => ({ query, params }), transaction: async (queries, opts) => {
    options = opts; assert.equal(queries.length, 1); assert.match(queries[0].query, /query_to_xml/); assert.equal(queries[0].params[0], null);
    return [[{ table_schema: table.schema, table_name: table.name, columns: table.columns, row_count: '2', row_hash: table.sha256, rls_active: false }]];
  } };
  assert.deepEqual(await captureSnapshot(sql), baseline);
  assert.deepEqual(options, { isolationLevel: 'RepeatableRead', readOnly: true });
});

test('compares original tables/columns and values while permitting additive nullable columns and new tables', () => {
  const after = { format: baseline.format, tables: [{ ...table, columns: [...table.columns, { name: 'extra', type: 'text', nullable: true }] }, { ...table, name: 'new_table' }] };
  assert.deepEqual(compareSnapshots(baseline, after), []);
  assert.ok(compareSnapshots(baseline, { ...after, tables: [{ ...after.tables[0], sha256: 'b'.repeat(64) }] }).length);
  assert.ok(compareSnapshots(baseline, { ...after, tables: [{ ...after.tables[0], columns: [] }] }).length);
  assert.ok(compareSnapshots(baseline, { ...after, tables: [{ ...after.tables[0], columns: [...table.columns, { name: 'extra', type: 'text', nullable: false }] }] }).length);
  assert.throws(() => compareSnapshots({ ...baseline, tables: [{ ...table, sha256: null }] }, after));
  assert.throws(() => compareSnapshots({ ...baseline, tables: [] }, after));
});

test('fails closed if row-level security limits visibility', async () => {
  const sql = { query: () => ({}), transaction: async () => [[{ table_schema: 'public', table_name: 'learners', columns: table.columns, row_count: '2', row_hash: table.sha256, rls_active: true }]] };
  await assert.rejects(captureSnapshot(sql), /Row-level security/);
});

test('uses the original column manifest and ignores a new nullable column', async () => {
  const sql = { query: (query, params) => ({ query, params }), transaction: async ([query], options) => {
    assert.deepEqual(JSON.parse(query.params[0]), baseline);
    assert.equal(options.readOnly, true);
    return [[{ table_schema: 'public', table_name: 'learners', columns: [...table.columns, { name: 'new_field', type: 'text', nullable: true }], row_count: '2', row_hash: table.sha256, rls_active: false }, { table_schema: 'public', table_name: 'new_table', columns: [], row_count: null, row_hash: null, rls_active: true }]];
  } };
  const after = await captureSnapshot(sql, baseline);
  assert.deepEqual(compareSnapshots(baseline, after), []);
});

test('writes a new private snapshot and does not overwrite existing files', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'migration-fingerprint-'));
  try {
    const out = path.join(dir, 'snapshot.json'); writeSnapshot(out, baseline);
    assert.equal(statSync(out).mode & 0o777, 0o600);
    assert.deepEqual(JSON.parse(readFileSync(out, 'utf8')), baseline);
    assert.throws(() => writeSnapshot(out, baseline));
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('does not print an invalid database credential or create evidence', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'migration-fingerprint-'));
  try {
    const out = path.join(dir, 'snapshot.json');
    const secret = 'synthetic-invalid-credential';
    const result = spawnSync(process.execPath, ['scripts/deploy/verify-migration-data.mjs', '--output', out], {
      encoding: 'utf8', env: { ...process.env, DATABASE_URL: secret },
    });
    assert.notEqual(result.status, 0);
    assert.ok(!(result.stdout + result.stderr).includes(secret));
    assert.throws(() => statSync(out), { code: 'ENOENT' });
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
