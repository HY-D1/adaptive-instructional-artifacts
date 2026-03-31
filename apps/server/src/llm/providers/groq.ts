/**
 * Groq Provider Implementation
 *
 * Implements the LLMProvider interface for Groq API (hosted LLM)
 * Uses GPT OSS 20B as the default model
 */

import {
  LLMProvider,
  LLMProviderType,
  LLMGenerateRequest,
  LLMGenerateResponse,
  LLMModelInfo,
  LLMHealthStatus,
  LLMGenerationParams,
} from '../provider.js';

export interface GroqConfig {
  apiKey: string;
  defaultModel: string;
  timeoutMs?: number;
  baseUrl?: string;
}

interface GroqChatCompletionResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

interface GroqModelInfo {
  id: string;
  object: string;
  created: number;
  owned_by: string;
  active: boolean;
  context_window: number;
}

interface GroqModelsResponse {
  object: string;
  data: GroqModelInfo[];
}

export class GroqProvider implements LLMProvider {
  readonly provider: LLMProviderType = 'groq';
  readonly defaultModel: string;
  private config: GroqConfig;

  constructor(config: GroqConfig) {
    this.config = {
      baseUrl: 'https://api.groq.com/openai/v1',
      timeoutMs: 30000,
      ...config,
    };
    this.defaultModel = config.defaultModel;
  }

  isConfigured(): boolean {
    return Boolean(this.config.apiKey) && Boolean(this.config.defaultModel);
  }

  private mapParamsToGroqOptions(params: LLMGenerationParams): Record<string, unknown> {
    const options: Record<string, unknown> = {};

    if (params.temperature !== undefined) {
      options.temperature = Math.max(0, Math.min(2, params.temperature));
    }
    if (params.top_p !== undefined) {
      options.top_p = Math.max(0, Math.min(1, params.top_p));
    }

    return options;
  }

  async generate(request: LLMGenerateRequest): Promise<LLMGenerateResponse> {
    const startTime = Date.now();
    const { model, prompt, params, structuredOutput } = request;
    const requestedModel = model || this.defaultModel;

    const body: Record<string, unknown> = {
      model: requestedModel,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
      ...this.mapParamsToGroqOptions(params),
    };

    // Add structured output support
    if (structuredOutput) {
      body.response_format = {
        type: 'json_object',
      };
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), params.timeoutMs || this.config.timeoutMs);

    try {
      const response = await fetch(`${this.config.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.apiKey}`,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Groq API key is invalid');
        }
        if (response.status === 429) {
          throw new Error('Groq rate limit exceeded');
        }
        const errorText = await response.text().catch(() => 'Unknown error');
        throw new Error(`Groq returned status ${response.status}: ${errorText}`);
      }

      const data = await response.json() as GroqChatCompletionResponse;
      const latencyMs = Date.now() - startTime;

      const content = data.choices[0]?.message?.content || '';

      return {
        text: content,
        model: data.model,
        provider: 'groq',
        usage: {
          inputTokens: data.usage?.prompt_tokens || 0,
          outputTokens: data.usage?.completion_tokens || 0,
        },
        latencyMs,
      };
    } catch (error) {
      clearTimeout(timeoutId);

      if ((error as Error).name === 'AbortError') {
        throw new Error(`Groq request timed out after ${params.timeoutMs || this.config.timeoutMs}ms`);
      }

      throw error;
    }
  }

  async listModels(): Promise<LLMModelInfo[]> {
    try {
      const response = await fetch(`${this.config.baseUrl}/models`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`,
        },
        signal: AbortSignal.timeout(5000),
      });

      if (!response.ok) {
        return [];
      }

      const data = await response.json() as GroqModelsResponse;
      return Array.isArray(data?.data)
        ? data.data.map((entry) => ({
            name: entry.id,
            size: undefined,
            parameterCount: undefined,
            modifiedAt: new Date(entry.created * 1000).toISOString(),
          }))
        : [];
    } catch {
      return [];
    }
  }

  async health(): Promise<LLMHealthStatus> {
    try {
      const response = await fetch(`${this.config.baseUrl}/models`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`,
        },
        signal: AbortSignal.timeout(5000),
      });

      if (!response.ok) {
        if (response.status === 401) {
          return {
            ok: false,
            provider: 'groq',
            message: 'Groq API key is invalid',
            models: [],
            enabled: true,
          };
        }
        return {
          ok: false,
          provider: 'groq',
          message: `Groq responded with status ${response.status}`,
          models: [],
          enabled: true,
        };
      }

      const data = await response.json() as GroqModelsResponse;
      const models = Array.isArray(data?.data)
        ? data.data.map((entry) => ({
            name: entry.id,
            size: undefined,
            parameterCount: undefined,
            modifiedAt: new Date(entry.created * 1000).toISOString(),
          }))
        : [];

      const activeModels = data.data?.filter((m) => m.active) || [];

      return {
        ok: true,
        provider: 'groq',
        message: `Groq connected with ${models.length} model(s) available (${activeModels.length} active)`,
        models,
        enabled: true,
      };
    } catch (error) {
      return {
        ok: false,
        provider: 'groq',
        message: `Groq API not reachable: ${(error as Error).message}`,
        details: (error as Error).message,
        models: [],
        enabled: true,
      };
    }
  }
}
