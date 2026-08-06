import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const originalLocation = window.location;

function setWindowLocation(href: string): void {
  const url = new URL(href);
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: {
      ...originalLocation,
      href: url.href,
      protocol: url.protocol,
      host: url.host,
      hostname: url.hostname,
      origin: url.origin,
      pathname: url.pathname,
      search: url.search,
      hash: url.hash,
    },
  });
}

describe('runtime-config and demo-mode deployment detection', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
    setWindowLocation('http://localhost/');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: originalLocation,
    });
  });

  it('does not force demo mode on hosted full-stack deployments that have a backend API configured', async () => {
    vi.stubEnv('VITE_API_BASE_URL', 'https://api.example.com');
    vi.stubEnv('VERCEL', '1');
    setWindowLocation('https://adaptive-instructional-artifacts.vercel.app/');

    const demoMode = await import('./utils/demo-mode');

    expect(demoMode.isDemoMode()).toBe(false);
  });

  it('keeps frontend-only hosted deployments in demo mode', async () => {
    vi.stubEnv('VERCEL', '1');
    setWindowLocation('https://adaptive-instructional-artifacts.vercel.app/');

    const demoMode = await import('./utils/demo-mode');

    expect(demoMode.isDemoMode()).toBe(true);
  });

  it('stops telling backend-configured deployments to run locally with Ollama', async () => {
    vi.stubEnv('VITE_API_BASE_URL', 'https://api.example.com');
    vi.stubEnv('VERCEL', '1');

    const runtimeConfig = await import('./runtime-config');

    expect(runtimeConfig.isLLMAvailable()).toBe(true);
    expect(runtimeConfig.getLLMUnavailableError().toLowerCase()).not.toContain('ollama');
    expect(runtimeConfig.getLLMUnavailableError().toLowerCase()).not.toContain('run the app locally');
  });

  it('bypasses research readiness blocking in E2E test mode', async () => {
    vi.stubEnv('VITE_TEST_MODE', 'true');
    vi.stubEnv('PROD', true);

    const runtimeConfig = await import('./runtime-config');

    await expect(runtimeConfig.checkResearchReadiness()).resolves.toMatchObject({
      ready: true,
      diagnostics: {
        envConfigured: false,
        backendReachable: false,
        isNeon: false,
        persistenceEnabled: false,
      },
    });
  });

  it('requires matched authoritative readiness instead of inferring safety from legacy fields', async () => {
    vi.stubEnv('VITE_API_BASE_URL', 'https://api.example.com');
    vi.stubEnv('PROD', true);
    vi.stubGlobal('fetch', vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      const body = url.endsWith('/health')
        ? {
            status: 'ok',
            timestamp: '2026-08-05T00:00:00.000Z',
            version: '1.0.0',
            db: { mode: 'neon', envSource: 'DATABASE_URL' },
            readiness: {
              contractVersion: 'v1.0.0',
              schemaContractVersion: 'v1.2.0',
              state: 'unverified',
              researchReady: false,
              connectivityReady: true,
              branchValidation: 'unconfigured',
              schemaReady: true,
              writePrivilegesReady: true,
              requiredTableCount: 17,
              missingTableCount: 0,
            },
          }
        : {
            backendReachable: true,
            dbMode: 'neon',
            resolvedEnvSource: 'DATABASE_URL',
            persistenceRoutesEnabled: true,
            researchContractVersion: 'v2.3.0',
            readiness: {
              contractVersion: 'v1.0.0',
              schemaContractVersion: 'v1.2.0',
              state: 'unverified',
              researchReady: false,
              connectivityReady: true,
              branchValidation: 'unconfigured',
              schemaReady: true,
              writePrivilegesReady: true,
              requiredTableCount: 17,
              missingTableCount: 0,
            },
          };
      return {
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => body,
      } as Response;
    }));

    const runtimeConfig = await import('./runtime-config');
    const readiness = await runtimeConfig.checkResearchReadiness();

    expect(runtimeConfig.RESEARCH_CONTRACT_VERSION).toBe('v2.3.0');
    expect(readiness.ready).toBe(false);
    expect(readiness.reason).toMatch(/unverified/i);
    expect(readiness.diagnostics).toMatchObject({
      backendReachable: true,
      isNeon: true,
      persistenceEnabled: true,
      readinessState: 'unverified',
      branchValidation: 'unconfigured',
      researchReady: false,
    });
  });

  it('accepts only matched readiness even when legacy route flags disagree', async () => {
    vi.stubEnv('VITE_API_BASE_URL', 'https://api.example.com');
    vi.stubGlobal('fetch', vi.fn(async (input: string | URL | Request) => {
      const isHealth = String(input).endsWith('/health');
      const readiness = {
        contractVersion: 'v1.0.0',
        schemaContractVersion: 'v1.2.0',
        state: 'ready',
        researchReady: true,
        connectivityReady: true,
        branchValidation: 'matched',
        schemaReady: true,
        writePrivilegesReady: true,
        requiredTableCount: 17,
        missingTableCount: 0,
      };
      return {
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => isHealth
          ? {
              status: 'ok',
              timestamp: '2026-08-05T00:00:00.000Z',
              version: '1.0.0',
              db: { mode: 'neon', envSource: 'DATABASE_URL' },
              readiness,
            }
          : {
              backendReachable: true,
              dbMode: 'neon',
              resolvedEnvSource: 'DATABASE_URL',
              persistenceRoutesEnabled: false,
              researchContractVersion: 'v2.3.0',
              readiness,
            },
      } as Response;
    }));

    const runtimeConfig = await import('./runtime-config');

    await expect(runtimeConfig.checkResearchReadiness()).resolves.toMatchObject({
      ready: true,
      diagnostics: {
        readinessState: 'ready',
        branchValidation: 'matched',
        researchReady: true,
      },
    });
  });

  it.each([
    {
      label: 'SQLite database mode',
      dbMode: 'sqlite',
      healthDbMode: 'sqlite',
      researchContractVersion: 'v2.3.0',
      readinessContractVersion: 'v1.0.0',
      schemaContractVersion: 'v1.2.0',
      reason: /neon/i,
    },
    {
      label: 'stale research contract',
      dbMode: 'neon',
      healthDbMode: 'neon',
      researchContractVersion: 'v2.2.0',
      readinessContractVersion: 'v1.0.0',
      schemaContractVersion: 'v1.2.0',
      reason: /research contract/i,
    },
    {
      label: 'stale readiness contract',
      dbMode: 'neon',
      healthDbMode: 'neon',
      researchContractVersion: 'v2.3.0',
      readinessContractVersion: 'v0.9.0',
      schemaContractVersion: 'v1.2.0',
      reason: /readiness contract/i,
    },
    {
      label: 'stale schema contract',
      dbMode: 'neon',
      healthDbMode: 'neon',
      researchContractVersion: 'v2.3.0',
      readinessContractVersion: 'v1.0.0',
      schemaContractVersion: 'v1.1.0',
      reason: /schema contract/i,
    },
  ])('rejects research-safe mode for $label', async (scenario) => {
    vi.stubEnv('VITE_API_BASE_URL', 'https://api.example.com');
    vi.stubGlobal('fetch', vi.fn(async (input: string | URL | Request) => {
      const isHealth = String(input).endsWith('/health');
      const readiness = {
        contractVersion: scenario.readinessContractVersion,
        schemaContractVersion: scenario.schemaContractVersion,
        state: 'ready',
        researchReady: true,
        connectivityReady: true,
        branchValidation: 'matched',
        schemaReady: true,
        writePrivilegesReady: true,
        requiredTableCount: 17,
        missingTableCount: 0,
      };
      return {
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => isHealth
          ? {
              status: 'ok',
              timestamp: '2026-08-06T00:00:00.000Z',
              version: '1.0.0',
              db: { mode: scenario.healthDbMode, envSource: 'DATABASE_URL' },
              readiness,
            }
          : {
              backendReachable: true,
              dbMode: scenario.dbMode,
              resolvedEnvSource: 'DATABASE_URL',
              persistenceRoutesEnabled: true,
              researchContractVersion: scenario.researchContractVersion,
              readiness,
            },
      } as Response;
    }));
    const runtimeConfig = await import('./runtime-config');

    const result = await runtimeConfig.checkResearchReadiness();

    expect(result.ready).toBe(false);
    expect(result.reason).toMatch(scenario.reason);
  });

  it('parses structured HTTP 503 diagnostics as reachable but not research-safe', async () => {
    vi.stubEnv('VITE_API_BASE_URL', 'https://api.example.com');
    const readiness = {
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
    };
    vi.stubGlobal('fetch', vi.fn(async (input: string | URL | Request) => ({
      ok: false,
      status: 503,
      statusText: 'Service Unavailable',
      json: async () => String(input).endsWith('/health')
        ? {
            status: 'degraded',
            timestamp: '2026-08-06T00:00:00.000Z',
            version: '1.0.0',
            db: { mode: 'neon', envSource: 'DATABASE_URL' },
            readiness,
          }
        : {
            backendReachable: true,
            dbMode: 'neon',
            resolvedEnvSource: 'DATABASE_URL',
            persistenceRoutesEnabled: false,
            researchContractVersion: 'v2.3.0',
            readiness,
          },
    } as Response)));
    const runtimeConfig = await import('./runtime-config');

    const result = await runtimeConfig.checkResearchReadiness();

    expect(result).toMatchObject({
      ready: false,
      reason: expect.stringMatching(/branch-mismatch/i),
      diagnostics: {
        backendReachable: true,
        isNeon: true,
        readinessState: 'branch-mismatch',
        branchValidation: 'mismatched',
        researchReady: false,
        healthError: 'HTTP 503 Service Unavailable',
        persistenceError: 'HTTP 503 Service Unavailable',
      },
    });
  });
});
