import { LLMGenerationParams } from '../../types';
import { isDemoMode, shouldAttemptLLM } from '../utils/demo-mode';
import { isHostedMode, getLLMUnavailableError } from '../runtime-config';

export const OLLAMA_MODEL = 'qwen3:4b';
export const OLLAMA_FALLBACK_MODEL = 'llama3.2:3b';
export const GROQ_MODEL = 'openai/gpt-oss-20b';

export type LLMProvider = 'ollama' | 'groq';

const HEALTHCHECK_TIMEOUT_MS = 8000;
const PROBE_PROMPT = 'Reply with exactly: OLLAMA_OK';
const PROBE_TIMEOUT_MS = 12000;
const PROBE_WARMUP_TIMEOUT_MS = 30000;

/**
 * Base URL for API requests
 * In development, this is empty (same origin with Vite proxy)
 * In production, this should point to the backend server
 */
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

/**
 * Options for Ollama generation
 */
export type OllamaGenerateOptions = {
  /** Model to use for generation */
  model?: string;
  /** Generation parameters */
  params?: Partial<LLMGenerationParams>;
};

/**
 * Health status for Ollama service
 */
export type OllamaHealthStatus = {
  /** Whether service is healthy */
  ok: boolean;
  /** Status message (user-friendly for UI) */
  message: string;
  /** Technical details for debugging (console only) */
  details?: string;
  /** List of available models */
  availableModels?: string[];
  /** Response from probe prompt */
  probeResponse?: string;
  /** Whether LLM is enabled on backend */
  enabled?: boolean;
};

/**
 * Error type for Ollama client failures
 */
export type OllamaClientError = Error & {
  /** HTTP status code if applicable */
  status?: number;
  /** Error code category */
  code: 'NETWORK' | 'TIMEOUT' | 'HTTP' | 'INVALID_RESPONSE' | 'NOT_ENABLED';
};

const DEFAULT_PARAMS: LLMGenerationParams = {
  temperature: 0,
  top_p: 1,
  stream: false,
  timeoutMs: 25000
};

function buildClientError(
  code: OllamaClientError['code'],
  message: string,
  status?: number
): OllamaClientError {
  const error = new Error(message) as OllamaClientError;
  error.code = code;
  error.status = status;
  return error;
}

function getErrorMessage(error: unknown): string {
  const clientError = error as Partial<OllamaClientError>;
  if (clientError.code === 'TIMEOUT') return clientError.message || 'request timed out';
  if (clientError.code === 'NETWORK') return clientError.message || 'network error';
  if (clientError.code === 'HTTP') return clientError.message || `HTTP ${clientError.status || 'error'}`;
  if (clientError.code === 'INVALID_RESPONSE') return clientError.message || 'invalid response payload';
  if (clientError.code === 'NOT_ENABLED') return clientError.message || 'LLM not enabled';
  const genericMessage = (error as Error)?.message;
  return genericMessage || 'unknown error';
}

function compactMessage(message: string): string {
  return message
    .replace(/\s+/g, ' ')
    .trim();
}

function formatAvailableModels(models: string[]): string {
  if (models.length === 0) return 'none reported';
  const preview = models.slice(0, 4).join(', ');
  return models.length > 4 ? `${preview}, ...` : preview;
}

function buildServiceDownMessage(details: string): { userMessage: string; technicalDetails: string } {
  const normalizedDetails = compactMessage(details);
  const technicalDetails = `Could not reach LLM backend.${normalizedDetails ? ` Details: ${normalizedDetails}.` : ''}`;
  const userMessage = 'AI features are not available. The backend LLM service is not running.';
  return { userMessage, technicalDetails };
}

async function readResponseText(response: Response): Promise<string> {
  try {
    const text = await response.text();
    return compactMessage(text).slice(0, 220);
  } catch {
    return '';
  }
}

function normalizeProbeResponse(text: string): string {
  return compactMessage(text).slice(0, 120);
}

function isTimeoutError(error: unknown): boolean {
  return (error as Partial<OllamaClientError>)?.code === 'TIMEOUT';
}

async function runHealthProbe(model: string): Promise<{
  response: string;
  usedWarmupRetry: boolean;
}> {
  try {
    const probe = await generateWithOllama(PROBE_PROMPT, {
      model,
      params: {
        temperature: 0,
        top_p: 1,
        stream: false,
        timeoutMs: PROBE_TIMEOUT_MS
      }
    });
    return {
      response: normalizeProbeResponse(probe.text),
      usedWarmupRetry: false
    };
  } catch (firstError) {
    if (!isTimeoutError(firstError)) {
      throw firstError;
    }

    const warmupProbe = await generateWithOllama(PROBE_PROMPT, {
      model,
      params: {
        temperature: 0,
        top_p: 1,
        stream: false,
        timeoutMs: PROBE_WARMUP_TIMEOUT_MS
      }
    });

    return {
      response: normalizeProbeResponse(warmupProbe.text),
      usedWarmupRetry: true
    };
  }
}

function validateLLMParams(params: LLMGenerationParams): LLMGenerationParams {
  const validated = { ...params };
  
  // Clamp temperature to valid range [0, 2]
  if (typeof validated.temperature !== 'number' || !Number.isFinite(validated.temperature)) {
    validated.temperature = DEFAULT_PARAMS.temperature;
  } else {
    validated.temperature = Math.max(0, Math.min(2, validated.temperature));
  }
  
  // Clamp top_p to valid range [0, 1]
  if (typeof validated.top_p !== 'number' || !Number.isFinite(validated.top_p)) {
    validated.top_p = DEFAULT_PARAMS.top_p;
  } else {
    validated.top_p = Math.max(0, Math.min(1, validated.top_p));
  }
  
  // Ensure timeout is a positive integer
  if (typeof validated.timeoutMs !== 'number' || !Number.isFinite(validated.timeoutMs) || validated.timeoutMs <= 0) {
    validated.timeoutMs = DEFAULT_PARAMS.timeoutMs;
  }
  
  // Ensure stream is boolean
  if (typeof validated.stream !== 'boolean') {
    validated.stream = DEFAULT_PARAMS.stream;
  }
  
  return validated;
}

/**
 * Get the selected model from localStorage or use default
 */
function getSelectedModel(): string {
  // Guard for SSR - localStorage is not available on server
  if (typeof window === 'undefined') {
    return OLLAMA_MODEL;
  }
  try {
    const saved = localStorage.getItem('sql-adapt-llm-settings');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed.model && typeof parsed.model === 'string') {
        return parsed.model;
      }
    }
  } catch {
    // Ignore parse errors, fall back to default
  }
  return OLLAMA_MODEL;
}

/**
 * Generate text using Ollama LLM service via backend proxy
 * @param prompt - Prompt text to send
 * @param options - Generation options
 * @returns Promise resolving to generated text and metadata
 * @throws OllamaClientError on failure
 */
export async function generateWithOllama(prompt: string, options?: OllamaGenerateOptions): Promise<{
  text: string;
  model: string;
  params: LLMGenerationParams;
}> {
  // Skip hosted/demo mode gates when a backend API is configured
  const hasBackend = !!import.meta.env.VITE_API_BASE_URL;

  if (!hasBackend) {
    // In hosted mode without backend, immediately throw a network error so fallback kicks in
    if (isHostedMode()) {
      throw buildClientError('NOT_ENABLED', getLLMUnavailableError());
    }

    // In demo mode without backend, immediately throw a network error so fallback kicks in
    if (!shouldAttemptLLM()) {
      throw buildClientError('NOT_ENABLED', 'Demo mode: LLM not available, using fallback hints.');
    }
  }
  
  // Check if LLM is enabled on backend
  const isEnabled = await isLLMEnabled();
  if (!isEnabled) {
    throw buildClientError('NOT_ENABLED', 'LLM is not enabled on the backend. Set ENABLE_LLM=true to enable.');
  }
  
  const model = options?.model || getSelectedModel();
  const rawParams: LLMGenerationParams = {
    ...DEFAULT_PARAMS,
    ...(options?.params || {})
  };
  const params = validateLLMParams(rawParams);
  const candidateModels = model === OLLAMA_FALLBACK_MODEL
    ? [model]
    : [model, OLLAMA_FALLBACK_MODEL];

  let lastError: OllamaClientError | null = null;

  for (const candidateModel of candidateModels) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), params.timeoutMs);

    try {
      const response = await fetch(`${API_BASE_URL}/api/llm/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: candidateModel,
          prompt,
          stream: params.stream,
          options: {
            temperature: params.temperature,
            top_p: params.top_p
          }
        }),
        signal: controller.signal
      });

      if (!response.ok) {
        if (response.status === 503) {
          throw buildClientError('NOT_ENABLED', 'LLM is not enabled on the backend.', response.status);
        }
        const body = await response.text();
        throw buildClientError('HTTP', `LLM backend HTTP ${response.status}: ${body}`, response.status);
      }

      const payload = await response.json();

      if (!payload.success || !payload.data || typeof payload.data.response !== 'string') {
        throw buildClientError('INVALID_RESPONSE', 'LLM backend returned an unexpected response payload.');
      }

      return {
        text: payload.data.response,
        model: candidateModel,
        params
      };
    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        lastError = buildClientError('TIMEOUT', `LLM request timed out after ${params.timeoutMs}ms.`);
      } else if ((error as OllamaClientError).code) {
        lastError = error as OllamaClientError;
      } else {
        lastError = buildClientError('NETWORK', (error as Error).message || 'Failed to reach LLM backend.');
      }

      if (lastError.code === 'NOT_ENABLED') {
        throw lastError;
      }

      if (candidateModel !== candidateModels[candidateModels.length - 1]) {
        console.warn('[LLM] Primary model failed, trying fallback model', {
          failedModel: candidateModel,
          fallbackModel: OLLAMA_FALLBACK_MODEL,
          reason: lastError.code,
        });
        continue;
      }
    } finally {
      clearTimeout(timeoutId);
    }
  }

  throw (lastError ?? buildClientError('NETWORK', 'Failed to reach LLM backend.'));
}

/**
 * Check if LLM is enabled on the backend
 * @returns Promise<boolean> indicating if LLM is enabled
 */
export async function isLLMEnabled(): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/llm/status`, {
      method: 'GET',
      signal: AbortSignal.timeout(5000),
    });
    
    if (!response.ok) {
      return false;
    }
    
    const data = await response.json();
    return data.data?.enabled === true;
  } catch {
    return false;
  }
}

/**
 * Check if LLM is available (enabled and Ollama reachable)
 * @returns Promise<boolean> indicating if LLM is available
 */
export async function isLLMAvailable(): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/llm/status`, {
      method: 'GET',
      signal: AbortSignal.timeout(5000),
    });
    
    if (!response.ok) {
      return false;
    }
    
    const data = await response.json();
    return data.data?.available === true;
  } catch {
    return false;
  }
}

/**
 * Check Ollama service health and model availability
 * @param model - Model to check (defaults to OLLAMA_MODEL)
 * @returns Health status with message and available models
 */
export async function checkOllamaHealth(model: string = OLLAMA_MODEL): Promise<OllamaHealthStatus> {
  // In hosted mode, return a clear message that LLM is unavailable
  if (isHostedMode()) {
    return {
      ok: true,
      message: '🌐 Hosted Mode: AI features use deterministic content. Run locally for LLM.',
      availableModels: [],
      probeResponse: 'HOSTED_MODE_ACTIVE',
      enabled: false,
    };
  }
  
  // In demo mode, return a friendly message immediately
  if (isDemoMode()) {
    return {
      ok: true,
      message: '🎓 Demo Mode: AI features use pre-built content. No local setup needed!',
      availableModels: [OLLAMA_MODEL],
      probeResponse: 'DEMO_MODE_ACTIVE',
      enabled: false,
    };
  }
  
  // Check backend LLM status
  try {
    const response = await fetch(`${API_BASE_URL}/api/llm/status`, {
      method: 'GET',
      signal: AbortSignal.timeout(HEALTHCHECK_TIMEOUT_MS),
    });

    if (!response.ok) {
      const body = await readResponseText(response);
      const details = body ? `status ${response.status}: ${body}` : `status ${response.status}`;
      const { userMessage, technicalDetails } = buildServiceDownMessage(details);
      return {
        ok: false,
        message: userMessage,
        details: technicalDetails,
        enabled: false,
      };
    }

    const payload = await response.json();
    
    if (!payload.success) {
      return {
        ok: false,
        message: payload.message || 'LLM backend returned an error',
        enabled: payload.data?.enabled ?? false,
      };
    }

    const status = payload.data;
    const availableModels = status.models || [];

    // Check if LLM is enabled
    if (!status.enabled) {
      return {
        ok: false,
        message: 'LLM is not enabled on the backend. Set ENABLE_LLM=true to enable AI features.',
        availableModels: [],
        enabled: false,
      };
    }

    // Check if Ollama is available
    if (!status.available) {
      return {
        ok: false,
        message: status.message || 'Ollama is not reachable',
        availableModels,
        enabled: true,
      };
    }

    // If model is available, run a health probe
    if (availableModels.includes(model)) {
      try {
        const probe = await runHealthProbe(model);
        const probeResponse = probe.response;
        const warmupSuffix = probe.usedWarmupRetry ? ' after warm-up retry' : '';
        return {
          ok: true,
          message: `Connected. Model '${model}' is available and replied: "${probeResponse || '[empty response]'}"${warmupSuffix}.`,
          availableModels,
          probeResponse,
          enabled: true,
        };
      } catch (error) {
        if (isTimeoutError(error)) {
          return {
            ok: false,
            message: `Connected and model '${model}' is available, but test generation timed out (${PROBE_TIMEOUT_MS}ms + warm-up retry ${PROBE_WARMUP_TIMEOUT_MS}ms). The model is likely still loading; retry Test LLM or run "ollama run ${model} \\"${PROBE_PROMPT}\\"" once to warm it up.`,
            availableModels,
            enabled: true,
          };
        }

        const details = getErrorMessage(error);
        return {
          ok: false,
          message: `Connected and model '${model}' is available, but test generation failed: ${details}.`,
          availableModels,
          enabled: true,
        };
      }
    }

    return {
      ok: false,
      message: `Model '${model}' not found. Run 'ollama pull ${model}'.`,
      details: `Model '${model}' not available. Available models: ${formatAvailableModels(availableModels)}.`,
      availableModels,
      enabled: true,
    };
  } catch (error) {
    if ((error as Error).name === 'AbortError') {
      const { userMessage, technicalDetails } = buildServiceDownMessage(`timed out after ${HEALTHCHECK_TIMEOUT_MS}ms while calling /api/llm/status`);
      return {
        ok: false,
        message: userMessage,
        details: technicalDetails,
        enabled: false,
      };
    }
    const { userMessage, technicalDetails } = buildServiceDownMessage(getErrorMessage(error));
    return {
      ok: false,
      message: userMessage,
      details: technicalDetails,
      enabled: false,
    };
  }
}

/**
 * Check if LLM feature is enabled via environment
 * This is a client-side check that reads the VITE_ENABLE_LLM env var
 * Note: The actual enforcement happens on the backend
 */
export function isLLMFeatureEnabled(): boolean {
  return import.meta.env.VITE_ENABLE_LLM === 'true';
}

/**
 * Provider-agnostic LLM health status
 */
export interface LLMHealthStatus {
  ok: boolean;
  provider: LLMProvider;
  message: string;
  details?: string;
  availableModels: string[];
  enabled: boolean;
}

/**
 * Get provider from backend status
 */
export async function getProvider(): Promise<LLMProvider> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/llm/status`, {
      method: 'GET',
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      return 'ollama';
    }

    const data = await response.json();
    return data.data?.provider || 'ollama';
  } catch {
    return 'ollama';
  }
}

/**
 * Check LLM health (provider-agnostic)
 * @returns Health status with provider info
 */
export async function checkLLMHealth(): Promise<LLMHealthStatus> {
  // In hosted mode
  if (isHostedMode()) {
    return {
      ok: true,
      provider: 'groq',
      message: '🌐 Hosted Mode: AI features use deterministic content. Run locally for LLM.',
      availableModels: [],
      enabled: false,
    };
  }

  // In demo mode
  if (isDemoMode()) {
    return {
      ok: true,
      provider: 'ollama',
      message: '🎓 Demo Mode: AI features use pre-built content. No local setup needed!',
      availableModels: [OLLAMA_MODEL],
      enabled: false,
    };
  }

  try {
    const response = await fetch(`${API_BASE_URL}/api/llm/status`, {
      method: 'GET',
      signal: AbortSignal.timeout(HEALTHCHECK_TIMEOUT_MS),
    });

    if (!response.ok) {
      return {
        ok: false,
        provider: 'ollama',
        message: 'Failed to check LLM status',
        availableModels: [],
        enabled: false,
      };
    }

    const payload = await response.json();
    const status = payload.data;

    return {
      ok: status.available,
      provider: status.provider || 'ollama',
      message: payload.message || status.message,
      availableModels: status.models || [],
      enabled: status.enabled,
    };
  } catch (error) {
    return {
      ok: false,
      provider: 'ollama',
      message: `LLM health check failed: ${(error as Error).message}`,
      availableModels: [],
      enabled: false,
    };
  }
}
