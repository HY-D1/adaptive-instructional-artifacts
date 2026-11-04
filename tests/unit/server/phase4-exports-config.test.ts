/* @vitest-environment node */
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { pseudonymizeLearner, rekeyEmailHash, toCsvCell } from '../../../apps/server/src/lib/research-export';
import { convertInteractionsToCsv } from '../../../apps/server/src/routes/research';
import { INSTRUCTOR_ANALYTICS_CONCEPT_TOTAL } from '../../../apps/server/src/routes/instructor';
import { isTestSeedAllowed } from '../../../apps/server/src/routes/auth';
import { consumeRateLimit } from '../../../apps/server/src/db/signup-rate-limit';
import { clientErrorMessage } from '../../../apps/server/src/lib/client-error';

describe('CSV cells', () => {
  it('escapes commas, quotes, CR and LF in every cell', () => {
    expect(toCsvCell('a,b')).toBe('"a,b"');
    expect(toCsvCell('say "hi"')).toBe('"say ""hi"""');
    expect(toCsvCell('line\r\nbreak')).toBe('"line\r\nbreak"');
  });

  it('neutralizes spreadsheet formulas in strings but keeps numbers numeric', () => {
    expect(toCsvCell('=HYPERLINK("http://x")')).toBe(`"'=HYPERLINK(""http://x"")"`);
    expect(toCsvCell('+1')).toBe("'+1");
    expect(toCsvCell('@SUM(A1)')).toBe("'@SUM(A1)");
    expect(toCsvCell(-0.5)).toBe('-0.5');
  });

  it('serializes objects as JSON and dates as ISO', () => {
    expect(toCsvCell({ a: 1 })).toBe('"{""a"":1}"');
    expect(toCsvCell(new Date('2026-01-02T03:04:05.000Z'))).toBe('2026-01-02T03:04:05.000Z');
    expect(toCsvCell(null, '[]')).toBe('[]');
  });

  it('keeps a student-controlled problemId from shifting columns', () => {
    const csv = convertInteractionsToCsv([{
      id: 'e1', learnerId: 'l1', timestamp: 't', eventType: 'execution',
      problemId: 'p1,injected', code: '=cmd()', createdAt: 'c',
    } as never]);
    const [header, row] = csv.split('\n');
    expect(row).toContain('"p1,injected"');
    expect(row).toContain("'=cmd()");
    expect(header.split(',')).toHaveLength(37);
  });
});

describe('research export pseudonymization', () => {
  it('drops real names unless explicitly requested', () => {
    const learner = { id: 'u1', name: 'Real Name', username: 'student-abc123', role: 'student' };
    expect(pseudonymizeLearner(learner, false)).toEqual({ id: 'u1', username: 'student-abc123', role: 'student' });
    expect(pseudonymizeLearner(learner, true)).toEqual(learner);
  });

  it('re-keys email hashes with the export secret and omits them without one', () => {
    expect(rekeyEmailHash('abc', '')).toBeNull();
    const keyed = rekeyEmailHash('abc', 'secret');
    expect(keyed).toMatch(/^[0-9a-f]{64}$/);
    expect(keyed).not.toBe(rekeyEmailHash('abc', 'other'));
  });
});

describe('instructor analytics', () => {
  it('divides by the number of concepts coverage can actually record', () => {
    const storage = readFileSync(resolve('apps/web/src/app/lib/storage/storage.ts'), 'utf8');
    const block = storage.match(/VALID_CONCEPT_IDS = new Set\(\[([\s\S]*?)\]\)/);
    expect(block).not.toBeNull();
    const ids = block![1].match(/'[^']+'/g) ?? [];
    expect(INSTRUCTOR_ANALYTICS_CONCEPT_TOTAL).toBe(ids.length);
  });
});

describe('test-seed environment gate', () => {
  it('allows only explicit preview, development, or test environments', () => {
    expect(isTestSeedAllowed({ VERCEL_ENV: 'preview' } as NodeJS.ProcessEnv)).toBe(true);
    expect(isTestSeedAllowed({ NODE_ENV: 'development' } as NodeJS.ProcessEnv)).toBe(true);
    expect(isTestSeedAllowed({} as NodeJS.ProcessEnv)).toBe(false);
    expect(isTestSeedAllowed({ VERCEL_ENV: 'production' } as NodeJS.ProcessEnv)).toBe(false);
    expect(isTestSeedAllowed({ NODE_ENV: 'production' } as NodeJS.ProcessEnv)).toBe(false);
  });

  it('refuses the Vercel production Neon integration database', () => {
    expect(isTestSeedAllowed({ VERCEL_ENV: 'preview', adaptive_data_DATABASE_URL: 'postgres://prod' } as NodeJS.ProcessEnv)).toBe(false);
    expect(isTestSeedAllowed({ VERCEL_ENV: 'preview', DATABASE_URL: 'postgres://preview' } as NodeJS.ProcessEnv)).toBe(true);
  });
});

describe('shared rate limiter', () => {
  it('reports over-limit attempts and occasionally prunes expired rows', async () => {
    const calls: string[] = [];
    const db = vi.fn(async (strings: TemplateStringsArray) => {
      const sql = strings.join('?');
      calls.push(sql);
      return sql.includes('INSERT') ? [{ attempts: 11 }] : [];
    });
    expect(await consumeRateLimit(db as never, 'login', ['a', 'b'], 10, 15, () => 0.5)).toBe(false);
    expect(calls.some((sql) => sql.includes('DELETE'))).toBe(false);
    expect(await consumeRateLimit(db as never, 'login', ['a', 'b'], 20, 15, () => 0)).toBe(true);
    expect(calls.some((sql) => sql.includes('DELETE FROM signup_rate_limits'))).toBe(true);
  });
});

describe('client error messages', () => {
  it('hides internal error text outside development', () => {
    vi.stubEnv('NODE_ENV', 'production');
    expect(clientErrorMessage(new Error('password=hunter2'))).toBe('Unexpected server error');
    vi.stubEnv('NODE_ENV', 'development');
    expect(clientErrorMessage(new Error('details'))).toBe('details');
    vi.unstubAllEnvs();
  });
});

describe('server env loading', () => {
  const serverSrc = resolve('apps/server/src');
  const tsx = resolve('apps/server/node_modules/.bin/tsx');

  function runWithEnvFile(imports: string[]) {
    const dir = mkdtempSync(join(tmpdir(), 'load-env-'));
    writeFileSync(join(dir, '.env'), 'ENABLE_LLM=true\n');
    const script = join(dir, 'check.mjs');
    writeFileSync(script, [...imports, 'console.log(JSON.stringify({ ENABLE_LLM }));'].join('\n'));
    const env = { ...process.env, SQL_ADAPT_SERVER_ENV_DIR: dir };
    delete env.ENABLE_LLM;
    const result = spawnSync(tsx, [script], { env, encoding: 'utf8' });
    expect(result.status, result.stderr).toBe(0);
    return JSON.parse(result.stdout.trim().split('\n').pop()!);
  }

  it('applies .env values to config when load-env is imported first', () => {
    expect(runWithEnvFile([
      `import '${join(serverSrc, 'load-env.ts')}';`,
      `import { ENABLE_LLM } from '${join(serverSrc, 'config.ts')}';`,
    ])).toEqual({ ENABLE_LLM: true });
  });

  it('shows the old ordering bug when config is evaluated first (control)', () => {
    expect(runWithEnvFile([
      `import { ENABLE_LLM } from '${join(serverSrc, 'config.ts')}';`,
      `import '${join(serverSrc, 'load-env.ts')}';`,
    ])).toEqual({ ENABLE_LLM: false });
  });

  it('keeps load-env as the first import of both entrypoints', () => {
    for (const file of ['app.ts', 'index.ts']) {
      const source = readFileSync(join(serverSrc, file), 'utf8');
      expect(source.split('\n').find((line) => line.startsWith('import '))).toBe("import './load-env.js';");
    }
  });
});
