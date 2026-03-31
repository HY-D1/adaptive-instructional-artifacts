/**
 * LLM API Routes
 * Provider-agnostic LLM API using the provider abstraction layer
 * Supports both Ollama (local) and Groq (hosted) providers
 */

import { Router, Request, Response } from 'express';
import type { ApiResponse } from '../types.js';
import {
  ENABLE_LLM,
  LLM_PROVIDER,
  OLLAMA_BASE_URL,
  OLLAMA_DEFAULT_MODEL,
  OLLAMA_FALLBACK_MODEL,
  GROQ_API_KEY,
  GROQ_MODEL,
} from '../config.js';
import {
  createLLMProvider,
  LLMProvider,
  LLMGenerationParams,
} from '../llm/index.js';

const router = Router();

// ============================================================================
// Provider Instance
// ============================================================================

function getProvider(): LLMProvider {
  if (LLM_PROVIDER === 'groq') {
    return createLLMProvider({
      type: 'groq',
      groqConfig: {
        apiKey: GROQ_API_KEY,
        defaultModel: GROQ_MODEL,
        timeoutMs: 30000,
      },
    });
  }

  return createLLMProvider({
    type: 'ollama',
    ollamaConfig: {
      baseUrl: OLLAMA_BASE_URL,
      defaultModel: OLLAMA_DEFAULT_MODEL,
      fallbackModel: OLLAMA_FALLBACK_MODEL,
      timeoutMs: 60000,
    },
  });
}

// ============================================================================
// Types
// ============================================================================

interface GenerateRequest {
  model?: string;
  prompt: string;
  stream?: boolean;
  options?: {
    temperature?: number;
    top_p?: number;
  };
  structuredOutput?: {
    format: 'json';
    schema: Record<string, unknown>;
  };
}

interface GenerateResponse {
  model: string;
  response: string;
  done: boolean;
  usage?: {
    inputTokens: number;
    outputTokens: number;
  };
  latencyMs: number;
  provider: string;
  fallbackUsed?: boolean;
}

// ============================================================================
// Validation
// ============================================================================

function validateGenerateRequest(body: unknown): { valid: boolean; error?: string; data?: GenerateRequest } {
  if (!body || typeof body !== 'object') {
    return { valid: false, error: 'Request body must be an object' };
  }

  const req = body as Record<string, unknown>;

  if (typeof req.prompt !== 'string' || req.prompt.length === 0) {
    return { valid: false, error: 'prompt is required and must be a non-empty string' };
  }

  const result: GenerateRequest = {
    model: typeof req.model === 'string' && req.model.trim().length > 0 ? req.model.trim() : undefined,
    prompt: req.prompt,
    stream: typeof req.stream === 'boolean' ? req.stream : false,
  };

  if (req.options && typeof req.options === 'object') {
    const opts = req.options as Record<string, unknown>;
    result.options = {};

    if (typeof opts.temperature === 'number') {
      result.options.temperature = Math.max(0, Math.min(2, opts.temperature));
    }
    if (typeof opts.top_p === 'number') {
      result.options.top_p = Math.max(0, Math.min(1, opts.top_p));
    }
  }

  // Validate structured output if provided
  if (req.structuredOutput && typeof req.structuredOutput === 'object') {
    const so = req.structuredOutput as Record<string, unknown>;
    if (so.format === 'json' && so.schema && typeof so.schema === 'object') {
      result.structuredOutput = {
        format: 'json',
        schema: so.schema as Record<string, unknown>,
      };
    }
  }

  return { valid: true, data: result };
}

// ============================================================================
// GET /api/llm/status - Get LLM service status
// ============================================================================

router.get('/status', async (_req: Request, res: Response) => {
  try {
    if (!ENABLE_LLM) {
      const response: ApiResponse<{
        enabled: boolean;
        available: boolean;
        provider: string;
        models: string[];
      }> = {
        success: true,
        data: {
          enabled: false,
          available: false,
          provider: LLM_PROVIDER,
          models: [],
        },
        message: 'LLM is disabled (set ENABLE_LLM=true to enable)',
      };
      res.json(response);
      return;
    }

    const provider = getProvider();
    const health = await provider.health();

    const response: ApiResponse<{
      enabled: boolean;
      available: boolean;
      provider: string;
      models: string[];
    }> = {
      success: true,
      data: {
        enabled: health.enabled,
        available: health.ok,
        provider: health.provider,
        models: health.models.map((m) => m.name),
      },
      message: health.message,
    };
    res.json(response);
  } catch (error) {
    const response: ApiResponse<never> = {
      success: false,
      error: 'Failed to get LLM status',
      message: error instanceof Error ? error.message : 'Unknown error',
    };
    res.status(500).json(response);
  }
});

// ============================================================================
// GET /api/llm/models - Get available models
// ============================================================================

router.get('/models', async (_req: Request, res: Response) => {
  try {
    if (!ENABLE_LLM) {
      const response: ApiResponse<{ models: string[] }> = {
        success: true,
        data: { models: [] },
        message: 'LLM is disabled',
      };
      res.json(response);
      return;
    }

    const provider = getProvider();
    const models = await provider.listModels();

    const response: ApiResponse<{ models: string[] }> = {
      success: true,
      data: { models: models.map((m) => m.name) },
    };
    res.json(response);
  } catch (error) {
    const response: ApiResponse<{ models: string[] }> = {
      success: true,
      data: { models: [] },
      message: `Failed to get models: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
    res.json(response);
  }
});

// ============================================================================
// POST /api/llm/generate - Generate text using configured provider
// ============================================================================

router.post('/generate', async (req: Request, res: Response) => {
  try {
    if (!ENABLE_LLM) {
      const response: ApiResponse<never> = {
        success: false,
        error: 'LLM not enabled',
        message: 'Set ENABLE_LLM=true and configure LLM_PROVIDER to enable LLM features',
      };
      res.status(503).json(response);
      return;
    }

    const validation = validateGenerateRequest(req.body);

    if (!validation.valid) {
      const response: ApiResponse<never> = {
        success: false,
        error: 'Validation failed',
        message: validation.error || 'Invalid request',
      };
      res.status(400).json(response);
      return;
    }

    const { model, prompt, options, structuredOutput } = validation.data!;

    const params: LLMGenerationParams = {
      temperature: options?.temperature ?? 0,
      top_p: options?.top_p ?? 1,
      stream: false,
      timeoutMs: LLM_PROVIDER === 'groq' ? 30000 : 60000,
    };

    const provider = getProvider();
    const result = await provider.generate({
      model,
      prompt,
      params,
      structuredOutput: structuredOutput ? {
        format: 'json',
        schema: structuredOutput.schema,
      } : undefined,
    });

    const requestedModel = model || provider.defaultModel;
    const fallbackUsed = result.model !== requestedModel;

    const response: ApiResponse<GenerateResponse> = {
      success: true,
      data: {
        model: result.model,
        response: result.text,
        done: true,
        usage: result.usage,
        latencyMs: result.latencyMs,
        provider: result.provider,
        fallbackUsed,
      },
      message: fallbackUsed ? `Primary model unavailable; served by fallback ${result.model}.` : undefined,
    };
    res.json(response);
  } catch (error) {
    const response: ApiResponse<never> = {
      success: false,
      error: 'Failed to generate text',
      message: error instanceof Error ? error.message : 'Unknown error',
    };
    res.status(500).json(response);
  }
});

// ============================================================================
// POST /api/llm/generate/validate - Validate prompt without generating
// ============================================================================

router.post('/generate/validate', (req: Request, res: Response) => {
  try {
    const validation = validateGenerateRequest(req.body);

    if (!validation.valid) {
      const response: ApiResponse<{
        valid: boolean;
        errors: string[];
      }> = {
        success: true,
        data: {
          valid: false,
          errors: [validation.error || 'Validation failed'],
        },
      };
      res.json(response);
      return;
    }

    const provider = ENABLE_LLM ? getProvider() : null;

    const response: ApiResponse<{
      valid: boolean;
      errors: string[];
      model: string;
      promptLength: number;
    }> = {
      success: true,
      data: {
        valid: true,
        errors: [],
        model: validation.data!.model || (provider?.defaultModel ?? OLLAMA_DEFAULT_MODEL),
        promptLength: validation.data!.prompt.length,
      },
    };
    res.json(response);
  } catch (error) {
    const response: ApiResponse<never> = {
      success: false,
      error: 'Validation failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    };
    res.status(500).json(response);
  }
});

export { router as llmRouter };
