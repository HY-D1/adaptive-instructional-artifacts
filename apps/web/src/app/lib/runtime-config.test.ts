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
});
