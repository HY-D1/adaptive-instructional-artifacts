/* @vitest-environment node */
import express from 'express';
import type { Server } from 'node:http';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { maintenanceGuard } from '../../../apps/server/src/middleware/maintenance';
import { requireAuth } from '../../../apps/server/src/middleware/auth';

describe('maintenance guard', () => {
  let server: Server;
  let baseUrl: string;
  const ollamaHandler = vi.fn((_req, res) => res.sendStatus(200));

  beforeAll(async () => {
    const app = express();
    app.use(maintenanceGuard);
    app.get('/health', (_req, res) => res.sendStatus(200));
    app.get('/api/system/persistence-status', (_req, res) => res.sendStatus(200));
    app.all('/api/surveys/complete', (_req, res) => res.sendStatus(200));
    app.all('/api/protected', requireAuth, (_req, res) => res.sendStatus(200));
    app.get('/ollama/api/tags', ollamaHandler);
    app.post('/ollama/api/generate', ollamaHandler);
    server = await new Promise<Server>(resolve => {
      const listening = app.listen(0, '127.0.0.1', () => resolve(listening));
    });
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('Missing test port');
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterEach(() => { vi.unstubAllEnvs(); ollamaHandler.mockClear(); });
  afterAll(async () => {
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  });

  it('defaults off', async () => {
    vi.stubEnv('MAINTENANCE_MODE', '');
    expect((await fetch(`${baseUrl}/api/surveys/complete`)).status).toBe(200);
  });

  it('blocks API reads, writes, and the survey callback with a retry hint', async () => {
    vi.stubEnv('MAINTENANCE_MODE', 'true');
    for (const [method, route] of [['GET', '/api/protected'], ['POST', '/api/protected'],
      ['GET', '/api/surveys/complete?token=synthetic']] as const) {
      const response = await fetch(`${baseUrl}${route}`, { method });
      expect(response.status).toBe(503);
      expect(response.headers.get('retry-after')).toBe('60');
    }
  });

  it('allows health and read-only persistence checks, but not a write to that path', async () => {
    vi.stubEnv('MAINTENANCE_MODE', 'true');
    for (const method of ['GET', 'HEAD']) {
      expect((await fetch(`${baseUrl}/health`, { method })).status).toBe(200);
      expect((await fetch(`${baseUrl}/api/system/persistence-status`, { method })).status).toBe(200);
    }
    expect((await fetch(`${baseUrl}/api/system/persistence-status`, { method: 'POST' })).status).toBe(503);
    expect((await fetch(`${baseUrl}/api/protected`, { method: 'OPTIONS' })).status).not.toBe(503);
  });

  it('blocks legacy Ollama aliases before their handlers during maintenance', async () => {
    vi.stubEnv('MAINTENANCE_MODE', 'true');
    expect((await fetch(`${baseUrl}/ollama/api/tags`)).status).toBe(503);
    expect((await fetch(`${baseUrl}/ollama/api/generate`, { method: 'POST' })).status).toBe(503);
    expect(ollamaHandler).not.toHaveBeenCalled();
  });

  it('keeps legacy aliases available with maintenance disabled or a valid bypass', async () => {
    vi.stubEnv('MAINTENANCE_MODE', '');
    expect((await fetch(`${baseUrl}/ollama/api/tags`)).status).toBe(200);
    vi.stubEnv('MAINTENANCE_MODE', 'true');
    vi.stubEnv('MAINTENANCE_BYPASS_KEY', 'synthetic-operator-key');
    expect((await fetch(`${baseUrl}/ollama/api/generate`, { method: 'POST', headers: { 'x-maintenance-key': 'synthetic-operator-key' } })).status).toBe(200);
  });

  it('rejects missing, empty, and incorrect keys and preserves auth for a valid bypass', async () => {
    vi.stubEnv('MAINTENANCE_MODE', 'true');
    for (const configuredKey of ['', '   ']) {
      vi.stubEnv('MAINTENANCE_BYPASS_KEY', configuredKey);
      expect((await fetch(`${baseUrl}/api/surveys/complete`, { headers: { 'x-maintenance-key': configuredKey } })).status).toBe(503);
    }
    vi.stubEnv('MAINTENANCE_BYPASS_KEY', 'synthetic-operator-key');
    expect((await fetch(`${baseUrl}/api/surveys/complete`)).status).toBe(503);
    expect((await fetch(`${baseUrl}/api/surveys/complete`, { headers: { 'x-maintenance-key': 'wrong' } })).status).toBe(503);
    expect((await fetch(`${baseUrl}/api/surveys/complete`, { headers: { 'x-maintenance-key': 'synthetic-operator-key' } })).status).toBe(200);
    expect((await fetch(`${baseUrl}/api/protected`, { headers: { 'x-maintenance-key': 'synthetic-operator-key' } })).status).toBe(401);
  });
});

describe('maintenance guard in the application stack', () => {
  it('runs after CORS and before schema initialization while keeping authorization in force', async () => {
    vi.stubEnv('MAINTENANCE_MODE', 'true');
    vi.stubEnv('MAINTENANCE_BYPASS_KEY', 'synthetic-operator-key');
    vi.stubEnv('AUTO_SCHEMA_INIT', 'true');
    const db = await import('../../../apps/server/src/db/index');
    const initialize = vi.spyOn(db, 'initializeSchema').mockRejectedValue(new Error('unexpected schema access'));
    const { default: app } = await import('../../../apps/server/src/app');
    const server = await new Promise<Server>(resolve => {
      const listening = app.listen(0, '127.0.0.1', () => resolve(listening));
    });
    try {
      const address = server.address();
      if (!address || typeof address === 'string') throw new Error('Missing test port');
      const base = `http://127.0.0.1:${address.port}`;
      const preflight = await fetch(`${base}/api/research`, {
        method: 'OPTIONS', headers: {
          Origin: 'http://localhost:5173',
          'Access-Control-Request-Method': 'POST',
          'Access-Control-Request-Headers': 'x-maintenance-key',
        },
      });
      expect(preflight.status).toBe(204);
      expect(preflight.headers.get('access-control-allow-headers')).toContain('x-maintenance-key');
      expect((await fetch(`${base}/api/surveys/complete`)).status).toBe(503);
      expect(initialize).not.toHaveBeenCalled();
      vi.stubEnv('AUTO_SCHEMA_INIT', 'false');
      expect((await fetch(`${base}/api/system/persistence-status`)).status).toBe(200);
      expect((await fetch(`${base}/api/research`, { headers: { 'x-maintenance-key': 'synthetic-operator-key' } })).status).toBe(401);
    } finally {
      await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
      vi.restoreAllMocks();
      vi.unstubAllEnvs();
    }
  });
});
