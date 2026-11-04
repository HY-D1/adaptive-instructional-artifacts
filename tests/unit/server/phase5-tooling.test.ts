/* @vitest-environment node */
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { planMigrations, readManifest } from '../../../apps/server/src/db/migrate';
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
