/**
 * Ollama Provider Implementation
 *
 * Implements the LLMProvider interface for Ollama (local LLM)
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

export interface OllamaConfig {
  baseUrl: string;
  defaultModel: string;
  fallbackModel?: string;
  timeoutMs?: number;
}

interface OllamaTagsResponse {
  models?: Array<{
    name?: string;
    size?: number;
    parameter_count?: string;
    modified_at?: string;
  }>;
}

interface OllamaGenerateResponse {
  model: string;
  response: string;
  done: boolean;
  context?: number[];
  total_duration?: number;
  load_duration?: number;
  prompt_eval_count?: number;
  eval_count?: number;
}

export class OllamaProvider implements LLMProvider {
  readonly provider: LLMProviderType = 'ollama';
  readonly defaultModel: string;
  private config: OllamaConfig;

  constructor(config: OllamaConfig) {
    this.config = {
      timeoutMs: 60000,
      ...config,
    };
    this.defaultModel = config.defaultModel;
  }

  isConfigured(): boolean {
    return Boolean(this.config.baseUrl) && Boolean(this.config.defaultModel);
  }

  private buildOllamaBody(
    model: string,
    prompt: string,
    params: LLMGenerationParams
  ): Record<string, unknown> {
    const body: Record<string, unknown> = {
      model,
      prompt,
      stream: params.stream,
    };

    if (params.temperature !== undefined) {
      body.temperature = Math.max(0, Math.min(2, params.temperature));
    }
    if (params.top_p !== undefined) {
      body.top_p = Math.max(0, Math.min(1, params.top_p));
    }

    return body;
  }

  async generate(request: LLMGenerateRequest): Promise<LLMGenerateResponse> {
    const startTime = Date.now();
    const { model, prompt, params } = request;
    const requestedModel = model || this.defaultModel;
    const candidateModels = params.stream
      ? [requestedModel]
      : Array.from(new Set([requestedModel, this.config.fallbackModel].filter(Boolean) as string[]));

    const attemptErrors: string[] = [];

    for (const candidateModel of candidateModels) {
      const ollamaBody = this.buildOllamaBody(candidateModel, prompt, params);
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), params.timeoutMs || this.config.timeoutMs);

      try {
        const response = await fetch(`${this.config.baseUrl}/api/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(ollamaBody),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const errorText = await response.text().catch(() => 'Unknown error');
          attemptErrors.push(`${candidateModel}:${response.status}:${errorText}`);
          if (candidateModel !== candidateModels[candidateModels.length - 1]) {
            continue;
          }
          throw new Error(`Ollama returned status ${response.status}: ${errorText}`);
        }

        const data = await response.json() as OllamaGenerateResponse;
        const latencyMs = Date.now() - startTime;

        return {
          text: data.response,
          model: data.model,
          provider: 'ollama',
          usage: {
            inputTokens: data.prompt_eval_count || 0,
            outputTokens: data.eval_count || 0,
          },
          latencyMs,
        };
      } catch (error) {
        clearTimeout(timeoutId);

        if ((error as Error).name === 'AbortError') {
          attemptErrors.push(`${candidateModel}:timeout`);
          if (candidateModel !== candidateModels[candidateModels.length - 1]) {
            continue;
          }
          throw new Error(`LLM generation timed out after ${params.timeoutMs || this.config.timeoutMs}ms`);
        }

        attemptErrors.push(`${candidateModel}:${error instanceof Error ? error.message : 'unknown_error'}`);
        if (candidateModel !== candidateModels[candidateModels.length - 1]) {
          continue;
        }
      }
    }

    throw new Error(`All model attempts failed (${attemptErrors.join(' | ')})`);
  }

  async listModels(): Promise<LLMModelInfo[]> {
    try {
      const response = await fetch(`${this.config.baseUrl}/api/tags`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000),
      });

      if (!response.ok) {
        return [];
      }

      const data = await response.json() as OllamaTagsResponse;
      return Array.isArray(data?.models)
        ? data.models.map((entry) => ({
            name: entry.name || 'unknown',
            size: entry.size,
            parameterCount: entry.parameter_count,
            modifiedAt: entry.modified_at,
          }))
        : [];
    } catch {
      return [];
    }
  }

  async health(): Promise<LLMHealthStatus> {
    try {
      const response = await fetch(`${this.config.baseUrl}/api/tags`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000),
      });

      if (!response.ok) {
        return {
          ok: false,
          provider: 'ollama',
          message: `Ollama responded with status ${response.status}`,
          models: [],
          enabled: true,
        };
      }

      const data = await response.json() as OllamaTagsResponse;
      const models = Array.isArray(data?.models)
        ? data.models.map((entry) => ({
            name: entry.name || 'unknown',
            size: entry.size,
            parameterCount: entry.parameter_count,
            modifiedAt: entry.modified_at,
          }))
        : [];

      return {
        ok: true,
        provider: 'ollama',
        message: `Ollama connected with ${models.length} model(s) available`,
        models,
        enabled: true,
      };
    } catch (error) {
      return {
        ok: false,
        provider: 'ollama',
        message: `Ollama not reachable at ${this.config.baseUrl}: ${(error as Error).message}`,
        details: (error as Error).message,
        models: [],
        enabled: true,
      };
    }
  }
}
