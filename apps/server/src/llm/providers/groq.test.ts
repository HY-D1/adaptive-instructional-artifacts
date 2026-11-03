import { afterEach, describe, expect, it, vi } from 'vitest';
import { GroqProvider } from './groq.js';

const params = {
  temperature: 0,
  top_p: 1,
  stream: false,
  timeoutMs: 1000,
};

const deepInfraModels = {
  object: 'list',
  data: [
    {
      id: 'openai/gpt-oss-20b',
      object: 'model',
      created: 0,
      owned_by: 'deepinfra',
      metadata: {},
    },
  ],
};

function jsonResponse(body: unknown): Response {
  return {
    ok: true,
    status: 200,
    json: async () => body,
  } as Response;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('GroqProvider', () => {
  it('uses the configured base URL for completions and models', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(jsonResponse({
        model: 'requested-model',
        choices: [{ message: { content: 'answer' } }],
        usage: {},
      }))
      .mockResolvedValueOnce(jsonResponse(deepInfraModels));
    const provider = new GroqProvider({
      apiKey: 'key',
      defaultModel: 'default-model',
      baseUrl: 'https://api.deepinfra.com/v1/openai',
    });

    await provider.generate({ prompt: 'prompt', params });
    await provider.listModels();

    expect(fetchMock.mock.calls[0]?.[0]).toBe('https://api.deepinfra.com/v1/openai/chat/completions');
    expect(fetchMock.mock.calls[1]?.[0]).toBe('https://api.deepinfra.com/v1/openai/models');
  });

  it('falls back to the Groq base URL', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse(deepInfraModels));
    const provider = new GroqProvider({ apiKey: 'key', defaultModel: 'default-model' });

    await provider.listModels();

    expect(fetchMock.mock.calls[0]?.[0]).toBe('https://api.groq.com/openai/v1/models');
  });

  it('lets the request model override the default model', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse({
      model: 'requested-model',
      choices: [{ message: { content: 'answer' } }],
      usage: {},
    }));
    const provider = new GroqProvider({ apiKey: 'key', defaultModel: 'default-model' });

    await provider.generate({ model: 'requested-model', prompt: 'prompt', params });

    const request = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body));
    expect(request.model).toBe('requested-model');
  });

  it('returns content without reading reasoning_content', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse({
      model: 'default-model',
      choices: [{
        message: {
          content: 'answer',
          reasoning_content: 'private reasoning',
        },
      }],
      usage: {},
    }));
    const provider = new GroqProvider({ apiKey: 'key', defaultModel: 'default-model' });

    const result = await provider.generate({ prompt: 'prompt', params });

    expect(result.text).toBe('answer');
  });

  it('does not send response_format for normal requests', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse({
      model: 'default-model',
      choices: [{ message: { content: 'answer' } }],
      usage: {},
    }));
    const provider = new GroqProvider({ apiKey: 'key', defaultModel: 'default-model' });

    await provider.generate({ prompt: 'prompt', params });

    const request = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body));
    expect(request).not.toHaveProperty('response_format');
  });

  it('keeps models and health available when created is absent', async () => {
    const models = {
      ...deepInfraModels,
      data: [{ ...deepInfraModels.data[0], created: undefined }],
    };
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse(models));
    const provider = new GroqProvider({ apiKey: 'key', defaultModel: 'missing-model' });

    const listed = await provider.listModels();
    const health = await provider.health();

    expect(listed).toMatchObject([{ name: 'openai/gpt-oss-20b', modifiedAt: undefined }]);
    expect(health.ok).toBe(true);
    expect(health.models).toHaveLength(1);
  });

  it('does not require the default model to appear in the models response', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse(deepInfraModels));
    const provider = new GroqProvider({ apiKey: 'key', defaultModel: 'absent-model' });

    const health = await provider.health();

    expect(health.ok).toBe(true);
  });
});
