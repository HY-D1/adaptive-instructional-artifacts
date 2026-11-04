/* @vitest-environment node */
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { parseMigrateArgs, planMarkApplied, planMigrations, readManifest } from '../../../apps/server/src/db/migrate';
import { sanitizeUploadFilename } from '../../../apps/server/src/routes/pdf-index';
import { sanitizeUploadFilename as sanitizeDevUploadFilename } from '../../../apps/web/src/server/pdf-index-server';

describe('migration runner', () => {
  it('reads every manifest entry with a checksum, in order', () => {
    const manifest = readManifest();
    expect(manifest.map((entry) => entry.filename)).toEqual([
      '20261031-interaction-event-fields.sql',
      '20261031-signup-rate-limits.sql',
      '20261031-problem-progress-events.sql',
      '20261101-learner-profile-events.sql',
      '20261104-interaction-retrievals.sql',
      '20261104-survey-verification.sql',
      '20261105-protect-research-deletes.sql',
    ]);
    expect(manifest.every((entry) => /^[0-9a-f]{64}$/.test(entry.checksum))).toBe(true);
  });

  it('separates applied, pending, and edited-after-apply migrations', () => {
    const manifest = [
      { filename: 'a.sql', checksum: 'aaa', sql: '' },
      { filename: 'b.sql', checksum: 'bbb', sql: '' },
      { filename: 'c.sql', checksum: 'ccc', sql: '' },
    ];
    const plan = planMigrations(manifest, [
      { filename: 'a.sql', checksum: 'aaa' },
      { filename: 'b.sql', checksum: 'old' },
    ]);
    expect(plan.applied).toEqual(['a.sql']);
    expect(plan.changed).toEqual([{ filename: 'b.sql', applied: 'old', current: 'bbb' }]);
    expect(plan.pending.map((entry) => entry.filename)).toEqual(['c.sql']);
  });

  it('manifest lists 20261105-protect-research-deletes.sql after the 20261104 files', () => {
    const names = readManifest().map((entry) => entry.filename);
    const guard = names.indexOf('20261105-protect-research-deletes.sql');
    expect(guard).toBeGreaterThan(names.indexOf('20261104-survey-verification.sql'));
    expect(guard).toBeGreaterThan(names.indexOf('20261104-interaction-retrievals.sql'));
    expect(guard).toBe(names.length - 1);
  });

  it('parses --mark-applied lists and refuses combining modes', () => {
    expect(parseMigrateArgs(['--mark-applied', 'a.sql,b.sql']).markApplied).toEqual(['a.sql', 'b.sql']);
    expect(parseMigrateArgs([]).apply).toBe(false);
    expect(() => parseMigrateArgs(['--mark-applied'])).toThrow(/requires/);
    expect(() => parseMigrateArgs(['--mark-applied', 'a.sql', '--apply'])).toThrow(/only one/i);
    expect(() => parseMigrateArgs(['--baseline', '--apply'])).toThrow(/only one/i);
  });

  it('--mark-applied rejects a file not in the manifest', () => {
    const manifest = readManifest();
    expect(() => planMarkApplied(manifest, ['not-in-manifest.sql'], [])).toThrow(/not in the manifest/);
    expect(() => planMarkApplied(manifest, ['20261031-interaction-event-fields.sql', 'nope.sql'], [])).toThrow(/nope\.sql/);
  });

  it('--mark-applied records sha256 of raw file content and does not execute it', () => {
    const raw = readFileSync(resolve('apps/server/src/db/migrations/20261105-protect-research-deletes.sql'), 'utf8');
    const plan = planMarkApplied(readManifest(), ['20261105-protect-research-deletes.sql'], []);
    expect(plan.record).toEqual([
      { filename: '20261105-protect-research-deletes.sql', checksum: createHash('sha256').update(raw).digest('hex') },
    ]);
    expect(plan.alreadyRecorded).toEqual([]);
    // plan carries only filename+checksum: there is no SQL to execute.
    expect(Object.keys(plan.record[0]).sort()).toEqual(['checksum', 'filename']);
  });

  it('--mark-applied is idempotent for the same checksum and refuses a mismatch', () => {
    const manifest = readManifest();
    const entry = manifest[0];
    const same = planMarkApplied(manifest, [entry.filename], [{ filename: entry.filename, checksum: entry.checksum }]);
    expect(same.record).toEqual([]);
    expect(same.alreadyRecorded).toEqual([entry.filename]);
    expect(() => planMarkApplied(manifest, [entry.filename], [{ filename: entry.filename, checksum: 'stale' }])).toThrow(/checksum/i);
  });

  it('protect-deletes migration SQL is additive and guards the 4 tables against DELETE and TRUNCATE', () => {
    const sql = readFileSync(resolve('apps/server/src/db/migrations/20261105-protect-research-deletes.sql'), 'utf8')
      .split('\n').filter((line) => !line.trim().startsWith('--')).join('\n');
    expect(sql).not.toMatch(/DELETE\s+FROM/i);
    expect(sql).not.toMatch(/UPDATE\s+\S+\s+SET/i);
    expect(sql).not.toMatch(/ALTER\s+COLUMN\s+\S+\s+(SET\s+DATA\s+)?TYPE/i);
    expect(sql).not.toMatch(/DROP\s+TABLE/i);
    expect(sql).not.toMatch(/DROP\s+COLUMN/i);
    // TRUNCATE only as trigger-event keyword, never as a statement.
    expect(sql).not.toMatch(/(^|;)\s*TRUNCATE\b/im);
    expect(sql.replace(/BEFORE\s+TRUNCATE/gi, '')).not.toMatch(/\bTRUNCATE\b/i);
    expect(sql).toContain('sql_adapt.allow_research_delete');
    expect(sql).toContain('research rows are protected');
    expect(sql).toContain("ARRAY['users', 'course_sections', 'section_enrollments', 'interaction_events']");
    expect(sql).toContain('protect_research_delete');
    expect(sql).toContain('protect_research_truncate');
    expect(sql).toMatch(/BEFORE DELETE ON public\.%I FOR EACH ROW/);
    expect(sql).toMatch(/BEFORE TRUNCATE ON public\.%I FOR EACH STATEMENT/);
    expect(sql).toMatch(/BEGIN;\s*SET LOCAL lock_timeout = '5s';/);
    expect(sql).toMatch(/ELSE\s+RAISE EXCEPTION/i); // missing table must fail the migration
  });

  it('is wired to npm run db:migrate', () => {
    const pkg = JSON.parse(readFileSync(resolve('apps/server/package.json'), 'utf8'));
    expect(pkg.scripts['db:migrate']).toBe('tsx src/db/migrate.ts');
  });
});

describe('PDF upload filenames', () => {
  for (const [label, sanitize] of [['server', sanitizeUploadFilename], ['dev server', sanitizeDevUploadFilename]] as const) {
    it(`${label}: strips directory traversal and unsafe characters`, () => {
      expect(sanitize('../../../etc/evil.pdf')).toBe('evil.pdf');
      expect(sanitize('..\\..\\win\\evil.pdf')).toBe('evil.pdf');
      expect(sanitize('my notes (v2).pdf')).toBe('my_notes__v2_.pdf');
      expect(sanitize('.hidden.pdf')).toBe('hidden.pdf');
      expect(sanitize('noext')).toBe('noext.pdf');
    });
  }
});

describe('token corruption scanner', () => {
  const scanner = resolve('scripts/verification/check-token-corruption.sh');

  it('passes on the repository defaults (now including scripts, tests, .github)', () => {
    const result = spawnSync('bash', [scanner], { encoding: 'utf8' });
    expect(result.status, result.stdout + result.stderr).toBe(0);
    expect(result.stdout).toContain('scripts tests .github');
  });

  it('fails on a file with the interleaved signature', () => {
    const dir = mkdtempSync(join(tmpdir(), 'corrupt-'));
    writeFileSync(join(dir, 'x.sh'), `e${'-03-24'}c${'-03-24'}h${'-03-24'}o\n`);
    expect(spawnSync('bash', [scanner, dir], { encoding: 'utf8' }).status).toBe(1);
  });

  it('keeps the restored dev-start.sh clean and valid bash', () => {
    expect(readFileSync(resolve('scripts/dev-start.sh'), 'utf8')).not.toContain('-03-24');
    expect(spawnSync('bash', ['-n', resolve('scripts/dev-start.sh')]).status).toBe(0);
  });
});
