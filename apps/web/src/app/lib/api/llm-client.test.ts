import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const envRef = import.meta.env as unknown as Record<string, string | boolean | undefined>;
const originalEnv = {
  VITE_API_BASE_URL: envRef.VITE_API_BASE_URL,
  VITE_OLLAMA_URL: envRef.VITE_OLLAMA_URL,
  VITE_ENABLE_LLM: envRef.VITE_ENABLE_LLM,
  VERCEL: envRef.VERCEL,
  NETLIFY: envRef.NETLIFY,
  DEV: envRef.DEV,
  PROD: envRef.PROD,
};

function mockJsonResponse(data: unknown, ok = true): Response {
  return {
    ok,
    json: async () => data,
    text: async () => JSON.stringify(data),
  } as Response;
}

describe('llm-client provider-neutral runtime', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
    localStorage.clear();
    sessionStorage.clear();
    envRef.VITE_API_BASE_URL = undefined;
    envRef.VITE_OLLAMA_URL = undefined;
    envRef.VITE_ENABLE_LLM = undefined;
    envRef.VERCEL = undefined;
    envRef.NETLIFY = undefined;
    envRef.DEV = false;
    envRef.PROD = true;
  });

  afterEach(() => {
    envRef.VITE_API_BASE_URL = originalEnv.VITE_API_BASE_URL;
    envRef.VITE_OLLAMA_URL = originalEnv.VITE_OLLAMA_URL;
    envRef.VITE_ENABLE_LLM = originalEnv.VITE_ENABLE_LLM;
    envRef.VERCEL = originalEnv.VERCEL;
    envRef.NETLIFY = originalEnv.NETLIFY;
    envRef.DEV = originalEnv.DEV;
    envRef.PROD = originalEnv.PROD;
    vi.unstubAllGlobals();
  });

  it('surfaces groq-backed backend status through getLLMStatus', async () => {
    envRef.VITE_API_BASE_URL = 'https://api.example.com';

    const fetchMock = vi.fn().mockResolvedValue(
      mockJsonResponse({
        success: true,
        data: {
          enabled: true,
          available: true,
          provider: 'groq',
          models: ['openai/gpt-oss-20b'],
          message: 'Groq ready',
        },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const llmClient = await import('./llm-client');
    expect(typeof (llmClient as Record<string, unknown>).getLLMStatus).toBe('function');

    const status = await (llmClient as Record<string, () => Promise<unknown>>).getLLMStatus();

    expect(status).toMatchObject({
      enabled: true,
      available: true,
      provider: 'groq',
      models: ['openai/gpt-oss-20b'],
      message: 'Groq ready',
    });
  });

  it('uses the backend provider default model when generateWithLLM is called without an explicit model', async () => {
    envRef.VITE_API_BASE_URL = 'https://api.example.com';

    const fetchMock = vi.fn()
      .mockResolvedValueOnce(
        mockJsonResponse({
          success: true,
          data: {
            enabled: true,
            available: true,
            provider: 'groq',
            models: ['openai/gpt-oss-20b'],
            message: 'Groq ready',
          },
        }),
      )
      .mockResolvedValueOnce(
        mockJsonResponse({
          success: true,
          data: {
            response: 'Short answer',
          },
        }),
      );
    vi.stubGlobal('fetch', fetchMock);

    const llmClient = await import('./llm-client');
    expect(typeof (llmClient as Record<string, unknown>).generateWithLLM).toBe('function');

    const result = await (llmClient as Record<string, (prompt: string) => Promise<unknown>>).generateWithLLM('Explain this');

    expect(result).toMatchObject({ text: 'Short answer' });
    const request = fetchMock.mock.calls[1]?.[1] as RequestInit;
    expect(request).toBeDefined();
    expect(JSON.parse(String(request.body))).toMatchObject({
      model: 'openai/gpt-oss-20b',
      prompt: 'Explain this',
    });
  });

  it('returns a generic unavailable state when backend status cannot be reached', async () => {
    envRef.VITE_API_BASE_URL = 'https://api.example.com';

    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')));

    const llmClient = await import('./llm-client');
    expect(typeof (llmClient as Record<string, unknown>).getLLMStatus).toBe('function');

    const status = await (llmClient as Record<string, () => Promise<Record<string, unknown>>>).getLLMStatus();

    expect(status.enabled).toBe(false);
    expect(status.available).toBe(false);
    expect(status.provider).toBeUndefined();
    expect(String(status.message).toLowerCase()).not.toContain('ollama');
  });
});
