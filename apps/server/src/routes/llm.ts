/**
 * LLM API Routes
 * Proxies requests to Ollama for LLM generation
 * Never exposes Ollama directly to public
 */

import { Router, Request, Response, NextFunction } from 'express';
import type { ApiResponse } from '../types.js';
import {
  ENABLE_LLM,
  OLLAMA_BASE_URL,
  OLLAMA_DEFAULT_MODEL,
  OLLAMA_FALLBACK_MODEL,
} from '../config.js';

const router = Router();

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
}

interface OllamaTagsResponse {
  models?: Array<{ name?: string }>;
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

  return { valid: true, data: result };
}

// ============================================================================
// Middleware: Check if LLM is enabled
// ============================================================================

const checkEnabled = (_req: Request, res: Response, next: NextFunction): void => {
  if (!ENABLE_LLM) {
    const response: ApiResponse<never> = {
      success: false,
      error: 'LLM not enabled',
      message: 'Set ENABLE_LLM=true and configure OLLAMA_BASE_URL to enable LLM features',
    };
    res.status(503).json(response);
    return;
  }
  next();
};

// ============================================================================
// GET /api/llm/status - Get LLM service status
// ============================================================================

router.get('/status', async (_req: Request, res: Response) => {
  try {
    if (!ENABLE_LLM) {
      const response: ApiResponse<{
        enabled: boolean;
        available: boolean;
        ollamaUrl: string;
        models: string[];
      }> = {
        success: true,
        data: {
          enabled: false,
          available: false,
          ollamaUrl: '',
          models: [],
        },
        message: 'LLM is disabled (set ENABLE_LLM=true to enable)',
      };
      res.json(response);
      return;
    }

    // Check Ollama availability
    try {
      const ollamaResponse = await fetch(`${OLLAMA_BASE_URL}/api/tags`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000),
      });

      if (!ollamaResponse.ok) {
        const response: ApiResponse<{
          enabled: boolean;
          available: boolean;
          ollamaUrl: string;
          models: string[];
        }> = {
          success: true,
          data: {
            enabled: true,
            available: false,
            ollamaUrl: OLLAMA_BASE_URL,
            models: [],
          },
          message: `Ollama responded with status ${ollamaResponse.status}`,
        };
        res.json(response);
        return;
      }

      const data = await ollamaResponse.json() as OllamaTagsResponse;
      const models = Array.isArray(data?.models)
        ? data.models.map((entry: { name?: string }) => entry?.name).filter((name): name is string => Boolean(name))
        : [];

      const response: ApiResponse<{
        enabled: boolean;
        available: boolean;
        ollamaUrl: string;
        models: string[];
      }> = {
        success: true,
        data: {
          enabled: true,
          available: true,
          ollamaUrl: OLLAMA_BASE_URL,
          models,
        },
        message: `Ollama connected with ${models.length} model(s) available`,
      };
      res.json(response);
    } catch (error) {
      const response: ApiResponse<{
        enabled: boolean;
        available: boolean;
        ollamaUrl: string;
        models: string[];
      }> = {
        success: true,
        data: {
          enabled: true,
          available: false,
          ollamaUrl: OLLAMA_BASE_URL,
          models: [],
        },
        message: `Ollama not reachable at ${OLLAMA_BASE_URL}: ${(error as Error).message}`,
      };
      res.json(response);
    }
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
// GET /api/llm/models - Get available models (alias for /api/llm/status)
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

    try {
      const ollamaResponse = await fetch(`${OLLAMA_BASE_URL}/api/tags`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000),
      });

      if (!ollamaResponse.ok) {
        const response: ApiResponse<{ models: string[] }> = {
          success: true,
          data: { models: [] },
          message: `Ollama responded with status ${ollamaResponse.status}`,
        };
        res.json(response);
        return;
      }

      const data = await ollamaResponse.json() as OllamaTagsResponse;
      const models = Array.isArray(data?.models)
        ? data.models.map((entry: { name?: string }) => entry?.name).filter((name): name is string => Boolean(name))
        : [];

      const response: ApiResponse<{ models: string[] }> = {
        success: true,
        data: { models },
      };
      res.json(response);
    } catch (error) {
      const response: ApiResponse<{ models: string[] }> = {
        success: true,
        data: { models: [] },
        message: `Ollama not reachable: ${(error as Error).message}`,
      };
      res.json(response);
    }
  } catch (error) {
    const response: ApiResponse<never> = {
      success: false,
      error: 'Failed to get models',
      message: error instanceof Error ? error.message : 'Unknown error',
    };
    res.status(500).json(response);
  }
});

// ============================================================================
// POST /api/llm/generate - Generate text using Ollama
// ============================================================================

router.post('/generate', checkEnabled, async (req: Request, res: Response) => {
  try {
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

    const { model, prompt, stream, options } = validation.data!;
    const requestedModel = model || OLLAMA_DEFAULT_MODEL;
    const candidateModels = stream
      ? [requestedModel]
      : Array.from(new Set([requestedModel, OLLAMA_FALLBACK_MODEL].filter(Boolean)));

    const attemptErrors: string[] = [];
    for (const candidateModel of candidateModels) {
      const ollamaBody: Record<string, unknown> = {
        model: candidateModel,
        prompt,
        stream: stream || false,
      };

      if (options) {
        if (options.temperature !== undefined) {
          ollamaBody.temperature = options.temperature;
        }
        if (options.top_p !== undefined) {
          ollamaBody.top_p = options.top_p;
        }
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000);

      try {
        const ollamaResponse = await fetch(`${OLLAMA_BASE_URL}/api/generate`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(ollamaBody),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!ollamaResponse.ok) {
          const errorText = await ollamaResponse.text().catch(() => 'Unknown error');
          attemptErrors.push(`${candidateModel}:${ollamaResponse.status}:${errorText}`);
          if (candidateModel !== candidateModels[candidateModels.length - 1]) {
            continue;
          }
          const response: ApiResponse<never> = {
            success: false,
            error: 'Ollama generation failed',
            message: `Ollama returned status ${ollamaResponse.status}: ${errorText}`,
          };
          res.status(502).json(response);
          return;
        }

        // If streaming, pipe the response
        if (stream) {
          res.setHeader('Content-Type', 'application/x-ndjson');
          res.setHeader('Transfer-Encoding', 'chunked');
          
          const reader = ollamaResponse.body?.getReader();
          if (!reader) {
            const response: ApiResponse<never> = {
              success: false,
              error: 'Stream error',
              message: 'Failed to get response stream from Ollama',
            };
            res.status(502).json(response);
            return;
          }

          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              res.write(value);
            }
            res.end();
          } catch (error) {
            console.error('Stream error:', error);
            res.end();
          }
          return;
        }

        // Non-streaming: return the full response
        const data = await ollamaResponse.json() as OllamaGenerateResponse;
        
        const response: ApiResponse<{
          model: string;
          response: string;
          done: boolean;
          context?: number[];
          total_duration?: number;
          load_duration?: number;
          prompt_eval_count?: number;
          eval_count?: number;
        }> = {
          success: true,
          data: {
            model: data.model,
            response: data.response,
            done: data.done,
            context: data.context,
            total_duration: data.total_duration,
            load_duration: data.load_duration,
            prompt_eval_count: data.prompt_eval_count,
            eval_count: data.eval_count,
          },
          message:
            candidateModel === requestedModel
              ? undefined
              : `Primary model unavailable; served by fallback ${candidateModel}.`,
        };
        res.json(response);
        return;
      } catch (error) {
        clearTimeout(timeoutId);
        
        if ((error as Error).name === 'AbortError') {
          attemptErrors.push(`${candidateModel}:timeout`);
          if (candidateModel !== candidateModels[candidateModels.length - 1]) {
            continue;
          }
          const response: ApiResponse<never> = {
            success: false,
            error: 'Timeout',
            message: 'LLM generation timed out after 60 seconds',
          };
          res.status(504).json(response);
          return;
        }

        attemptErrors.push(`${candidateModel}:${error instanceof Error ? error.message : 'unknown_error'}`);
        if (candidateModel !== candidateModels[candidateModels.length - 1]) {
          continue;
        }
      }
    }

    const response: ApiResponse<never> = {
      success: false,
      error: 'Failed to generate text',
      message: attemptErrors.length > 0
        ? `All model attempts failed (${attemptErrors.join(' | ')})`
        : 'Unknown error',
    };
    res.status(500).json(response);
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
        model: validation.data!.model || OLLAMA_DEFAULT_MODEL,
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
