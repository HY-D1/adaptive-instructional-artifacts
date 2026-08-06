/* @vitest-environment node */

import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const getDatabaseReadinessMock = vi.hoisted(() => vi.fn());

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

vi.mock('../../../apps/server/src/db/readiness.js', async (importOriginal) => {
  const original = await importOriginal<typeof import('../../../apps/server/src/db/readiness')>();
  return {
    ...original,
    getDatabaseReadiness: getDatabaseReadinessMock,
  };
});

type ExpressLayer = {
  route?: {
    path?: string;
    methods?: Record<string, boolean>;
    stack?: Array<{ handle?: Function }>;
  };
};

function getRouteHandler(
  app: { _router?: { stack?: ExpressLayer[] } },
  path: string,
): Function {
  const route = app._router?.stack?.find(
    (layer) => layer.route?.path === path && layer.route.methods?.get,
  );
  const handler = route?.route?.stack?.at(-1)?.handle;
  if (!handler) {
    throw new Error(`GET ${path} handler not found`);
  }
  return handler;
}

async function invokeJsonHandler(handler: Function): Promise<{ status: number; body: Record<string, unknown> }> {
  let statusCode = 200;
  let body: Record<string, unknown> = {};
  const response = {
    status(code: number) {
      statusCode = code;
      return this;
    },
    json(payload: Record<string, unknown>) {
      body = payload;
      return this;
    },
  };

  await handler({}, response);
  return { status: statusCode, body };
}

describe('database readiness diagnostic contract', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
    for (const key of [
      'DATABASE_URL',
      'NEON_DATABASE_URL',
      'adaptive_data_DATABASE_URL',
      'adaptive_data_POSTGRES_URL',
    ]) {
      vi.stubEnv(key, '');
    }
    getDatabaseReadinessMock.mockReset().mockResolvedValue({
      contractVersion: 'v1.0.0',
      schemaContractVersion: 'v1.2.0',
      state: 'local-only',
      researchReady: false,
      connectivityReady: true,
      branchValidation: 'not-applicable',
      schemaReady: true,
      writePrivilegesReady: true,
      requiredTableCount: 17,
      missingTableCount: 0,
    });
  });

  it('publishes identical local-only readiness on both diagnostics while retaining legacy fields', async () => {
    const { default: app } = await import('../../../apps/server/src/app');
    const health = await invokeJsonHandler(getRouteHandler(app, '/health'));
    const persistence = await invokeJsonHandler(
      getRouteHandler(app, '/api/system/persistence-status'),
    );

    const expectedReadiness = {
      contractVersion: 'v1.0.0',
      schemaContractVersion: 'v1.2.0',
      state: 'local-only',
      researchReady: false,
      connectivityReady: true,
      branchValidation: 'not-applicable',
      schemaReady: true,
      writePrivilegesReady: true,
      requiredTableCount: 17,
      missingTableCount: 0,
    };

    expect(health.status).toBe(200);
    expect(health.body).toMatchObject({
      status: 'ok',
      version: '1.0.0',
      environment: expect.any(String),
      db: {
        mode: 'sqlite',
        envSource: null,
        target: 'local',
        status: 'ok',
      },
      features: expect.any(Object),
      readiness: expectedReadiness,
    });

    expect(persistence.status).toBe(200);
    expect(persistence.body).toMatchObject({
      backendReachable: true,
      dbMode: 'sqlite',
      resolvedEnvSource: null,
      dbTarget: 'local',
      environment: expect.any(String),
      persistenceRoutesEnabled: true,
      researchContractVersion: 'v2.3.0',
      readiness: expectedReadiness,
    });
  });

  it.each([
    {
      state: 'ready',
      status: 200,
      branchValidation: 'matched',
      schemaReady: true,
      writePrivilegesReady: true,
      missingTableCount: 0,
      routesEnabled: true,
      researchReady: true,
    },
    {
      state: 'unverified',
      status: 200,
      branchValidation: 'unconfigured',
      schemaReady: true,
      writePrivilegesReady: true,
      missingTableCount: 0,
      routesEnabled: true,
      researchReady: false,
    },
    {
      state: 'unavailable',
      status: 503,
      branchValidation: 'unavailable',
      schemaReady: null,
      writePrivilegesReady: null,
      missingTableCount: null,
      routesEnabled: false,
      researchReady: false,
    },
    {
      state: 'branch-mismatch',
      status: 503,
      branchValidation: 'mismatched',
      schemaReady: null,
      writePrivilegesReady: null,
      missingTableCount: null,
      routesEnabled: false,
      researchReady: false,
    },
    {
      state: 'schema-incomplete',
      status: 503,
      branchValidation: 'matched',
      schemaReady: false,
      writePrivilegesReady: null,
      missingTableCount: 1,
      routesEnabled: false,
      researchReady: false,
    },
    {
      state: 'insufficient-privileges',
      status: 503,
      branchValidation: 'matched',
      schemaReady: true,
      writePrivilegesReady: false,
      missingTableCount: 0,
      routesEnabled: false,
      researchReady: false,
    },
  ] as const)(
    'maps Neon $state readiness to HTTP $status on both diagnostics without removing legacy fields',
    async ({
      state,
      status,
      branchValidation,
      schemaReady,
      writePrivilegesReady,
      missingTableCount,
      routesEnabled,
      researchReady,
    }) => {
      vi.stubEnv('DATABASE_URL', 'postgresql://placeholder.invalid/example');
      getDatabaseReadinessMock.mockResolvedValue({
        contractVersion: 'v1.0.0',
        schemaContractVersion: 'v1.2.0',
        state,
        researchReady,
        connectivityReady: state !== 'unavailable',
        branchValidation,
        schemaReady,
        writePrivilegesReady,
        requiredTableCount: 17,
        missingTableCount,
      });

      const { default: app } = await import('../../../apps/server/src/app');
      const health = await invokeJsonHandler(getRouteHandler(app, '/health'));
      const persistence = await invokeJsonHandler(
        getRouteHandler(app, '/api/system/persistence-status'),
      );

      expect(health.status).toBe(status);
      expect(health.body).toMatchObject({
        status: status === 200 ? 'ok' : 'degraded',
        db: {
          mode: 'neon',
          status: status === 200 ? 'ok' : 'error',
        },
        readiness: {
          contractVersion: 'v1.0.0',
          schemaContractVersion: 'v1.2.0',
          state,
          researchReady,
          branchValidation,
          schemaReady,
          writePrivilegesReady,
          requiredTableCount: 17,
          missingTableCount,
        },
      });

      expect(persistence.status).toBe(status);
      expect(persistence.body).toMatchObject({
        backendReachable: true,
        dbMode: 'neon',
        resolvedEnvSource: 'DATABASE_URL',
        dbTarget: 'production',
        environment: 'development',
        persistenceRoutesEnabled: routesEnabled,
        researchContractVersion: 'v2.3.0',
        readiness: {
          contractVersion: 'v1.0.0',
          schemaContractVersion: 'v1.2.0',
          state,
          researchReady,
          branchValidation,
          schemaReady,
          writePrivilegesReady,
          requiredTableCount: 17,
          missingTableCount,
        },
      });
    },
  );

  it('registers diagnostics before one gate covering every database-backed route', async () => {
    const appModule = await import('../../../apps/server/src/app');
    const app = appModule.default as unknown as {
      _router?: { stack?: Array<ExpressLayer & { name?: string; handle?: { name?: string } }> };
    };
    const stack = app._router?.stack ?? [];
    const routeIndex = (path: string) => stack.findIndex((layer) => layer.route?.path === path);
    const gateIndex = stack.findIndex(
      (layer) => layer.name === 'databaseReadinessGate'
        || layer.handle?.name === 'databaseReadinessGate',
    );

    expect((appModule as Record<string, unknown>).DATABASE_BACKED_ROUTE_PREFIXES).toEqual([
      '/api/learners',
      '/api/interactions',
      '/api/textbooks',
      '/api/sessions',
      '/api/auth',
      '/api/research',
      '/api/instructor',
      '/api/corpus',
    ]);
    expect(gateIndex).toBeGreaterThan(routeIndex('/'));
    expect(gateIndex).toBeGreaterThan(routeIndex('/health'));
    expect(gateIndex).toBeGreaterThan(routeIndex('/api/system/persistence-status'));
  });

  it('blocks a branch mismatch before a database route handler can run', async () => {
    vi.stubEnv('DATABASE_URL', 'postgresql://placeholder.invalid/example');
    getDatabaseReadinessMock.mockResolvedValue({
      contractVersion: 'v1.0.0',
      schemaContractVersion: 'v1.2.0',
      state: 'branch-mismatch',
      researchReady: false,
      connectivityReady: true,
      branchValidation: 'mismatched',
      schemaReady: null,
      writePrivilegesReady: null,
      requiredTableCount: 17,
      missingTableCount: null,
    });
    const appModule = await import('../../../apps/server/src/app');
    const gate = (appModule as Record<string, unknown>).databaseReadinessGate as Function | undefined;
    const next = vi.fn();
    const result = gate
      ? await invokeMiddleware(gate, { method: 'POST', path: '/api/interactions' }, next)
      : undefined;

    expect(result).toMatchObject({
      status: 503,
      body: {
        success: false,
        readiness: {
          state: 'branch-mismatch',
          branchValidation: 'mismatched',
        },
      },
    });
    expect(next).not.toHaveBeenCalled();
  });

  it.each(['branch-mismatch', 'unavailable'] as const)(
    'lets POST /api/auth/logout clear cookies while readiness is %s',
    async (state) => {
      vi.stubEnv('DATABASE_URL', 'postgresql://placeholder.invalid/example');
      getDatabaseReadinessMock.mockResolvedValue({
        contractVersion: 'v1.0.0',
        schemaContractVersion: 'v1.2.0',
        state,
        researchReady: false,
        connectivityReady: state !== 'unavailable',
        branchValidation: state === 'unavailable' ? 'unavailable' : 'mismatched',
        schemaReady: null,
        writePrivilegesReady: null,
        requiredTableCount: 17,
        missingTableCount: null,
      });
      const { default: app } = await import('../../../apps/server/src/app');

      const response = await requestApp(app, '/api/auth/logout', {
        method: 'POST',
        headers: {
          cookie: 'sql_adapt_auth=expired; sql_adapt_csrf=csrf-token',
          'x-csrf-token': 'csrf-token',
        },
      });
      const body = await response.json() as Record<string, unknown>;
      const setCookie = response.headers.get('set-cookie') ?? '';

      expect(response.status).toBe(200);
      expect(body).toEqual({ success: true });
      expect(setCookie).toContain('sql_adapt_auth=');
      expect(setCookie).toContain('sql_adapt_csrf=');
      expect(getDatabaseReadinessMock).not.toHaveBeenCalled();
    },
  );

  it.each([
    { label: 'POST /api/auth/login', request: { method: 'POST', baseUrl: '/api/auth', path: '/login' } },
    { label: 'POST /api/auth/signup', request: { method: 'POST', baseUrl: '/api/auth', path: '/signup' } },
    { label: 'GET /api/auth/me', request: { method: 'GET', baseUrl: '/api/auth', path: '/me' } },
    { label: 'POST /api/auth/test-seed', request: { method: 'POST', baseUrl: '/api/auth', path: '/test-seed' } },
    { label: 'GET /api/auth/logout', request: { method: 'GET', baseUrl: '/api/auth', path: '/logout' } },
  ])('keeps $label behind degraded readiness', async ({ request }) => {
    getDatabaseReadinessMock.mockResolvedValue({
      contractVersion: 'v1.0.0',
      schemaContractVersion: 'v1.2.0',
      state: 'branch-mismatch',
      researchReady: false,
      connectivityReady: true,
      branchValidation: 'mismatched',
      schemaReady: null,
      writePrivilegesReady: null,
      requiredTableCount: 17,
      missingTableCount: null,
    });
    const appModule = await import('../../../apps/server/src/app');
    const gate = (appModule as Record<string, unknown>).databaseReadinessGate as Function;
    const next = vi.fn();

    const result = await invokeMiddleware(gate, request, next);

    expect(result.status).toBe(503);
    expect(next).not.toHaveBeenCalled();
  });
});

async function requestApp(
  app: { listen: Function },
  path: string,
  init?: RequestInit,
): Promise<Response> {
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const { port } = server.address() as AddressInfo;
  try {
    return await fetch(`http://127.0.0.1:${port}${path}`, init);
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error?: Error) => error ? reject(error) : resolve());
    });
  }
}

async function invokeMiddleware(
  middleware: Function,
  request: Record<string, unknown>,
  next: Function,
): Promise<{ status: number; body: Record<string, unknown> }> {
  let statusCode = 200;
  let body: Record<string, unknown> = {};
  const response = {
    status(code: number) {
      statusCode = code;
      return this;
    },
    json(payload: Record<string, unknown>) {
      body = payload;
      return this;
    },
  };
  await middleware(request, response, next);
  return { status: statusCode, body };
}
