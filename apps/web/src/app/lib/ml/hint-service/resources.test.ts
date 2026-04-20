import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

function mockJsonResponse(data: unknown, ok = true): Response {
  return {
    ok,
    json: async () => data,
    text: async () => JSON.stringify(data),
  } as Response;
}

describe('hint-service resource availability', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
    localStorage.clear();
    sessionStorage.clear();
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('treats backend-configured deployments as LLM-capable even without a VITE_OLLAMA_URL', async () => {
    vi.stubEnv('VITE_API_BASE_URL', 'https://api.example.com');

    const resourcesModule = await import('./resources');
    const resources = resourcesModule.checkAvailableResources('learner-1');

    expect(resources.llm).toBe(true);
  });

  it('does not mark LLM as available when neither backend nor Ollama is configured', async () => {
    const resourcesModule = await import('./resources');
    const resources = resourcesModule.checkAvailableResources('learner-1');

    expect(resources.llm).toBe(false);
  });

  it('refines llm availability from backend status in checkAvailableResourcesAsync', async () => {
    vi.stubEnv('VITE_API_BASE_URL', 'https://api.example.com');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      mockJsonResponse({
        success: true,
        data: {
          enabled: true,
          available: false,
          provider: 'groq',
          models: [],
          message: 'Groq unavailable',
        },
      }),
    ));

    const resourcesModule = await import('./resources');
    expect(typeof (resourcesModule as Record<string, unknown>).checkAvailableResourcesAsync).toBe('function');

    const resources = await (resourcesModule as unknown as Record<string, (learnerId: string) => Promise<Record<string, boolean>>>).checkAvailableResourcesAsync('learner-1');

    expect(resources.llm).toBe(false);
  });
});
