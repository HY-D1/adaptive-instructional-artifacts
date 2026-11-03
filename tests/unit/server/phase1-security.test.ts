/* @vitest-environment node */
import type { Server } from 'node:http';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { wildcardPatternToRegExp } from '../../../apps/server/src/lib/cors-patterns';
import {
  MAX_PROMPT_CHARS,
  resolveAllowedModel,
  validateGenerateRequest,
} from '../../../apps/server/src/routes/llm';

async function withApp<T>(run: (base: string) => Promise<T>): Promise<T> {
  vi.resetModules();
  const { default: app } = await import('../../../apps/server/src/app');
  const server = await new Promise<Server>((resolve) => {
    const listening = app.listen(0, '127.0.0.1', () => resolve(listening));
  });
  try {
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('Missing test port');
    return await run(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('CORS wildcard patterns', () => {
  const pattern = wildcardPatternToRegExp('https://adaptive-instructional-artifacts-*-team.vercel.app');

  it('matches a single hostname fragment', () => {
    expect(pattern.test('https://adaptive-instructional-artifacts-abc123-team.vercel.app')).toBe(true);
  });

  it('rejects lookalike origins that add dots, paths, or another scope', () => {
    expect(pattern.test('https://adaptive-instructional-artifacts-x.evil.com-team.vercel.app')).toBe(false);
    expect(pattern.test('https://adaptive-instructional-artifacts-abc-evilteam.vercel.app.evil.com')).toBe(false);
    expect(pattern.test('https://adaptive-instructional-artifacts--team.vercel.app')).toBe(false);
  });

  it('has no default wildcard, so another Vercel scope is not trusted', async () => {
    vi.stubEnv('AUTO_SCHEMA_INIT', 'false');
    await withApp(async (base) => {
      const preflight = await fetch(`${base}/api/auth/login`, {
        method: 'OPTIONS',
        headers: {
          Origin: 'https://adaptive-instructional-artifacts-x-evil.vercel.app',
          'Access-Control-Request-Method': 'POST',
        },
      });
      expect(preflight.headers.get('access-control-allow-origin')).toBeNull();
    });
  });
});

describe('LLM proxy hardening', () => {
  it('requires authentication for generate and status', async () => {
    vi.stubEnv('AUTO_SCHEMA_INIT', 'false');
    await withApp(async (base) => {
      const generate = await fetch(`${base}/api/llm/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: 'hello' }),
      });
      expect(generate.status).toBe(401);
      expect((await fetch(`${base}/api/llm/status`)).status).toBe(401);
    });
  });

  it('requires a CSRF token for authenticated generate requests', async () => {
    vi.stubEnv('AUTO_SCHEMA_INIT', 'false');
    const { signToken } = await import('../../../apps/server/src/middleware/auth');
    const token = signToken({ accountId: 'a1', learnerId: 's1', email: 's@example.test', role: 'student', name: 'S' });
    await withApp(async (base) => {
      const response = await fetch(`${base}/api/llm/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: `sql_adapt_auth=${token}` },
        body: JSON.stringify({ prompt: 'hello' }),
      });
      expect(response.status).toBe(403);
    });
  });

  it('removes the unguarded Ollama alias routes', async () => {
    vi.stubEnv('AUTO_SCHEMA_INIT', 'false');
    await withApp(async (base) => {
      expect((await fetch(`${base}/ollama/api/generate`, { method: 'POST' })).status).toBe(404);
      expect((await fetch(`${base}/ollama/api/tags`)).status).toBe(404);
    });
  });

  it('rejects oversize prompts', () => {
    expect(validateGenerateRequest({ prompt: 'x'.repeat(MAX_PROMPT_CHARS + 1) }).valid).toBe(false);
    expect(validateGenerateRequest({ prompt: 'x'.repeat(MAX_PROMPT_CHARS) }).valid).toBe(true);
  });

  it('only passes allowlisted models through', () => {
    const allowed = new Set(['openai/gpt-oss-20b']);
    expect(resolveAllowedModel('openai/gpt-oss-20b', allowed)).toBe('openai/gpt-oss-20b');
    expect(resolveAllowedModel('some/expensive-model', allowed)).toBeUndefined();
    expect(resolveAllowedModel(42, allowed)).toBeUndefined();
  });
});

describe('fail-closed database configuration', () => {
  it('returns 503 from /api in a hosted environment without a database URL', async () => {
    vi.stubEnv('AUTO_SCHEMA_INIT', 'false');
    vi.stubEnv('VERCEL_ENV', 'preview');
    for (const key of ['DATABASE_URL', 'NEON_DATABASE_URL', 'adaptive_data_DATABASE_URL', 'adaptive_data_POSTGRES_URL']) {
      vi.stubEnv(key, '');
    }
    await withApp(async (base) => {
      expect((await fetch(`${base}/api/learners/s1`)).status).toBe(503);
      expect((await fetch(`${base}/api/system/persistence-status`)).status).toBe(200);
    });
  });
});
