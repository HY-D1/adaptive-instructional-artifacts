/* @vitest-environment node */

import { readFileSync } from 'node:fs';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../../../apps/server/src/middleware/rate-limit.js', () => {
  const passThrough = (_request: unknown, _response: unknown, next: Function) => next();
  return {
    generalApiLimiter: passThrough,
    researchRateLimiter: passThrough,
    loginRateLimiter: passThrough,
    signupRateLimiter: passThrough,
    strictRateLimiter: passThrough,
    authRateLimiter: passThrough,
  };
});

async function getPrepareFunction(): Promise<Function | undefined> {
  const appModule = await import('../../../apps/server/src/app');
  return (appModule as Record<string, unknown>).prepareDatabaseRuntime as Function | undefined;
}

describe('database runtime startup policy', () => {
  it('keeps every Neon runtime startup inspection-only even when auto-init is requested', async () => {
    const prepare = await getPrepareFunction();
    const inspectReadiness = vi.fn().mockResolvedValue({ state: 'unavailable' });
    const initializeSchema = vi.fn();

    if (prepare) {
      await prepare({
        usingNeon: true,
        env: { AUTO_SCHEMA_INIT: 'true', VERCEL: '1' },
        inspectReadiness,
        initializeSchema,
      });
    }

    expect(prepare).toBeTypeOf('function');
    expect(inspectReadiness).toHaveBeenCalledTimes(1);
    expect(initializeSchema).not.toHaveBeenCalled();
  });

  it('auto-initializes SQLite locally unless explicitly disabled', async () => {
    const prepare = await getPrepareFunction();
    const initializeSchema = vi.fn().mockResolvedValue(undefined);
    const inspectReadiness = vi.fn();

    if (prepare) {
      await prepare({
        usingNeon: false,
        env: {},
        inspectReadiness,
        initializeSchema,
      });
      await prepare({
        usingNeon: false,
        env: { AUTO_SCHEMA_INIT: 'false' },
        inspectReadiness,
        initializeSchema,
      });
    }

    expect(prepare).toBeTypeOf('function');
    expect(initializeSchema).toHaveBeenCalledTimes(1);
    expect(inspectReadiness).not.toHaveBeenCalled();
  });

  it('pins backend Vercel runtime to AUTO_SCHEMA_INIT=false', () => {
    const vercelConfig = JSON.parse(
      readFileSync(join(process.cwd(), 'apps/server/vercel.json'), 'utf8'),
    ) as { env?: Record<string, string> };

    expect(vercelConfig.env?.AUTO_SCHEMA_INIT).toBe('false');
  });

  it('blocks an unconfigured Vercel runtime instead of reporting an empty SQLite database as ready', async () => {
    const temporaryDirectory = await mkdtemp(join(tmpdir(), 'sql-adapt-readiness-'));
    const databasePath = join(temporaryDirectory, 'empty.db');
    await writeFile(databasePath, '');

    for (const key of [
      'DATABASE_URL',
      'NEON_DATABASE_URL',
      'adaptive_data_DATABASE_URL',
      'adaptive_data_POSTGRES_URL',
    ]) {
      vi.stubEnv(key, '');
    }
    vi.stubEnv('VERCEL', '1');
    vi.stubEnv('VERCEL_ENV', 'preview');
    vi.stubEnv('AUTO_SCHEMA_INIT', 'false');
    vi.stubEnv('DATABASE_PATH', databasePath);
    vi.resetModules();

    try {
      const { default: app } = await import('../../../apps/server/src/app');
      const health = await requestApp(app, '/health');
      const healthBody = await health.json() as Record<string, unknown>;
      const databaseRoute = await requestApp(app, '/api/learners');
      const routeBody = await databaseRoute.json() as Record<string, unknown>;

      expect(health.status).toBe(503);
      expect(healthBody).toMatchObject({
        status: 'degraded',
        db: { mode: 'sqlite', status: 'error' },
        readiness: {
          state: 'unavailable',
          researchReady: false,
          connectivityReady: false,
          schemaReady: null,
        },
      });
      expect(databaseRoute.status).toBe(503);
      expect(routeBody).toMatchObject({
        success: false,
        readiness: { state: 'unavailable' },
      });
    } finally {
      const { closeDb } = await import('../../../apps/server/src/db/index');
      await closeDb();
      vi.unstubAllEnvs();
      vi.resetModules();
      await rm(temporaryDirectory, { recursive: true, force: true });
    }
  });

  it('keeps the legacy db:init command SQLite-only so Neon cannot bypass the branch guard', () => {
    const initSource = readFileSync(
      join(process.cwd(), 'apps/server/src/db/init.ts'),
      'utf8',
    );
    const neonGuardIndex = initSource.indexOf('if (isUsingNeon())');
    const initializeIndex = initSource.indexOf('await initializeSchema()');

    expect(neonGuardIndex).toBeGreaterThan(-1);
    expect(neonGuardIndex).toBeLessThan(initializeIndex);
    expect(initSource).toContain('db:init:neon');
  });
});

async function requestApp(
  app: { listen: Function },
  path: string,
): Promise<Response> {
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const { port } = server.address() as AddressInfo;
  try {
    return await fetch(`http://127.0.0.1:${port}${path}`);
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error?: Error) => error ? reject(error) : resolve());
    });
  }
}
