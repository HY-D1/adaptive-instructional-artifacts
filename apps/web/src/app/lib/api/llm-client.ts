import { LLMGenerationParams } from '../../types';
import { isDemoMode, shouldAttemptLLM } from '../utils/demo-mode';
import { isBackendConfigured, isHostedMode, getLLMUnavailableError } from '../runtime-config';

export const OLLAMA_MODEL = 'qwen3:4b';
export const OLLAMA_FALLBACK_MODEL = 'llama3.2:3b';
export const GROQ_MODEL = 'openai/gpt-oss-20b';

export type LLMProvider = 'ollama' | 'groq';
export interface LLMStatus {
  enabled: boolean;
  available: boolean;
  provider?: LLMProvider;
  models: string[];
  message: string;
}

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
 * Options for LLM generation
 */
export type LLMGenerateOptions = {
  /** Model to use for generation */
  model?: string;
  /** Generation parameters */
  params?: Partial<LLMGenerationParams>;
};
export type OllamaGenerateOptions = LLMGenerateOptions;

/**
 * Health status for LLM service
 */
export type LLMHealthStatus = {
  /** Whether service is healthy */
  ok: boolean;
  /** Provider if known from backend status */
  provider?: LLMProvider;
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
export type OllamaHealthStatus = LLMHealthStatus;

/**
 * Error type for LLM client failures
 */
export type LLMClientError = Error & {
  /** HTTP status code if applicable */
  status?: number;
  /** Error code category */
  code: 'NETWORK' | 'TIMEOUT' | 'HTTP' | 'INVALID_RESPONSE' | 'NOT_ENABLED';
};
export type OllamaClientError = LLMClientError;

const DEFAULT_PARAMS: LLMGenerationParams = {
  temperature: 0,
  top_p: 1,
  stream: false,
  timeoutMs: 25000
};

function buildClientError(
  code: LLMClientError['code'],
  message: string,
  status?: number
): LLMClientError {
  const error = new Error(message) as LLMClientError;
  error.code = code;
  error.status = status;
  return error;
}

function getErrorMessage(error: unknown): string {
  const clientError = error as Partial<LLMClientError>;
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
  return (error as Partial<LLMClientError>)?.code === 'TIMEOUT';
}

function canReachBackendProxy(): boolean {
  return Boolean(API_BASE_URL) || Boolean(import.meta.env.DEV);
}

function parseProvider(value: unknown): LLMProvider | undefined {
  return value === 'ollama' || value === 'groq' ? value : undefined;
}

function getFallbackProvider(): LLMProvider {
  const savedProvider = getStoredProvider();
  if (savedProvider) {
    return savedProvider;
  }
  return isBackendConfigured() ? 'groq' : 'ollama';
}

function getStoredProvider(): LLMProvider | undefined {
  if (typeof window === 'undefined') {
    return undefined;
  }
  try {
    const saved = localStorage.getItem('sql-adapt-llm-settings');
    if (!saved) return undefined;
    const parsed = JSON.parse(saved);
    return parseProvider(parsed.provider);
  } catch {
    return undefined;
  }
}

async function runHealthProbe(model: string): Promise<{
  response: string;
  usedWarmupRetry: boolean;
}> {
  try {
    const probe = await generateWithLLM(PROBE_PROMPT, {
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

    const warmupProbe = await generateWithLLM(PROBE_PROMPT, {
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
 * Get the default model for a provider
 */
export function getDefaultModelForProvider(provider: LLMProvider): string {
  return provider === 'groq' ? GROQ_MODEL : OLLAMA_MODEL;
}

/**
 * Get the selected model from localStorage or use provider-appropriate default
 * This function ensures the model matches the backend provider configuration
 */
function getSelectedModel(): string {
  // Guard for SSR - localStorage is not available on server
  if (typeof window === 'undefined') {
    return getDefaultModelForProvider(getFallbackProvider());
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
  return getDefaultModelForProvider(getFallbackProvider());
}

/**
 * Get the appropriate model based on backend provider
 * This should be used when the provider is known from backend status
 */
export function getModelForProvider(provider: LLMProvider): string {
  const savedModel = getSelectedModel();

  // If the saved model is appropriate for the provider, use it
  if (provider === 'groq' && savedModel === GROQ_MODEL) {
    return savedModel;
  }
  if (provider === 'ollama' && savedModel !== GROQ_MODEL) {
    return savedModel;
  }

  // Otherwise return the provider-appropriate default
  return getDefaultModelForProvider(provider);
}

/**
 * Fetch provider-neutral backend LLM status.
 */
export async function getLLMStatus(): Promise<LLMStatus> {
  if (!canReachBackendProxy()) {
    return {
      enabled: false,
      available: false,
      provider: undefined,
      models: [],
      message: isDemoMode()
        ? 'Demo mode uses deterministic content instead of live LLM generation.'
        : getLLMUnavailableError(),
    };
  }

  try {
    const response = await fetch(`${API_BASE_URL}/api/llm/status`, {
      method: 'GET',
      signal: AbortSignal.timeout(HEALTHCHECK_TIMEOUT_MS),
    });

    if (!response.ok) {
      const body = await readResponseText(response);
      const details = body ? `status ${response.status}: ${body}` : `status ${response.status}`;
      const { userMessage } = buildServiceDownMessage(details);
      return {
        enabled: false,
        available: false,
        provider: undefined,
        models: [],
        message: userMessage,
      };
    }

    const payload = await response.json();
    if (!payload?.success || !payload.data) {
      return {
        enabled: false,
        available: false,
        provider: undefined,
        models: [],
        message: payload?.message || 'Failed to read backend LLM status.',
      };
    }

    const status = payload.data;
    return {
      enabled: status.enabled === true,
      available: status.available === true,
      provider: parseProvider(status.provider),
      models: Array.isArray(status.models) ? status.models : [],
      message: payload.message || status.message || 'LLM status available.',
    };
  } catch (error) {
    const { userMessage } = buildServiceDownMessage(getErrorMessage(error));
    return {
      enabled: false,
      available: false,
      provider: undefined,
      models: [],
      message: userMessage,
    };
  }
}

/**
 * Generate text using the configured backend LLM provider via /api/llm/generate.
 * @param prompt - Prompt text to send
 * @param options - Generation options
 * @returns Promise resolving to generated text and metadata
 * @throws LLMClientError on failure
 */
export async function generateWithLLM(prompt: string, options?: LLMGenerateOptions): Promise<{
  text: string;
  model: string;
  params: LLMGenerationParams;
}> {
  if (!canReachBackendProxy()) {
    const unavailableMessage = !shouldAttemptLLM()
      ? 'Demo mode: LLM not available, using fallback hints.'
      : getLLMUnavailableError();
    throw buildClientError('NOT_ENABLED', unavailableMessage);
  }

  const status = await getLLMStatus();
  if (!status.enabled) {
    throw buildClientError('NOT_ENABLED', status.message || 'LLM is not enabled on the backend.');
  }
  if (!status.available) {
    throw buildClientError('NOT_ENABLED', status.message || 'LLM backend is unavailable.');
  }

  const backendProvider = status.provider ?? getFallbackProvider();
  const defaultModel = getDefaultModelForProvider(backendProvider);
  const model = options?.model || defaultModel;

  const rawParams: LLMGenerationParams = {
    ...DEFAULT_PARAMS,
    ...(options?.params || {})
  };
  const params = validateLLMParams(rawParams);

  // Only use Ollama fallback for Ollama provider
  const candidateModels = backendProvider === 'groq'
    ? [model]
    : (model === OLLAMA_FALLBACK_MODEL
        ? [model]
        : [model, OLLAMA_FALLBACK_MODEL]);

  let lastError: LLMClientError | null = null;

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
      } else if ((error as LLMClientError).code) {
        lastError = error as LLMClientError;
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
 * @deprecated Use generateWithLLM for new code.
 */
export async function generateWithOllama(prompt: string, options?: OllamaGenerateOptions): Promise<{
  text: string;
  model: string;
  params: LLMGenerationParams;
}> {
  return generateWithLLM(prompt, options);
}

/**
 * Check if LLM is enabled on the backend
 * @returns Promise<boolean> indicating if LLM is enabled
 */
export async function isLLMEnabled(): Promise<boolean> {
  const status = await getLLMStatus();
  return status.enabled;
}

/**
 * Check if LLM is available (enabled and Ollama reachable)
 * @returns Promise<boolean> indicating if LLM is available
 */
export async function isLLMAvailable(): Promise<boolean> {
  const status = await getLLMStatus();
  return status.available;
}

/**
 * Check Ollama service health and model availability
 * @param model - Model to check (defaults to OLLAMA_MODEL)
 * @returns Health status with message and available models
 */
export async function checkLLMHealth(model?: string): Promise<LLMHealthStatus> {
  const status = await getLLMStatus();
  const provider = status.provider;
  const availableModels = status.models || [];

  if (!status.enabled) {
    return {
      ok: false,
      provider,
      message: status.message,
      availableModels,
      enabled: false,
    };
  }

  if (!status.available) {
    return {
      ok: false,
      provider,
      message: status.message,
      availableModels,
      enabled: true,
    };
  }

  if (provider !== 'ollama') {
    return {
      ok: true,
      provider,
      message: status.message || 'Connected to backend LLM provider.',
      availableModels,
      enabled: true,
    };
  }

  const targetModel = model || getModelForProvider('ollama');
  if (!availableModels.includes(targetModel)) {
    return {
      ok: false,
      provider: 'ollama',
      message: `Model '${targetModel}' not found. Run 'ollama pull ${targetModel}'.`,
      details: `Model '${targetModel}' not available. Available models: ${formatAvailableModels(availableModels)}.`,
      availableModels,
      enabled: true,
    };
  }

  try {
    const probe = await runHealthProbe(targetModel);
    const probeResponse = probe.response;
    const warmupSuffix = probe.usedWarmupRetry ? ' after warm-up retry' : '';
    return {
      ok: true,
      provider: 'ollama',
      message: `Connected. Model '${targetModel}' is available and replied: "${probeResponse || '[empty response]'}"${warmupSuffix}.`,
      availableModels,
      probeResponse,
      enabled: true,
    };
  } catch (error) {
    if (isTimeoutError(error)) {
      return {
        ok: false,
        provider: 'ollama',
        message: `Connected and model '${targetModel}' is available, but test generation timed out (${PROBE_TIMEOUT_MS}ms + warm-up retry ${PROBE_WARMUP_TIMEOUT_MS}ms). The model is likely still loading; retry Test LLM or run "ollama run ${targetModel} \\"${PROBE_PROMPT}\\"" once to warm it up.`,
        availableModels,
        enabled: true,
      };
    }

    return {
      ok: false,
      provider: 'ollama',
      message: `Connected and model '${targetModel}' is available, but test generation failed: ${getErrorMessage(error)}.`,
      availableModels,
      enabled: true,
    };
  }
}

/**
 * @deprecated Use checkLLMHealth for new code.
 */
export async function checkOllamaHealth(model: string = OLLAMA_MODEL): Promise<OllamaHealthStatus> {
  return checkLLMHealth(model);
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
 * Get provider from backend status
 */
export async function getProvider(): Promise<LLMProvider> {
  const status = await getLLMStatus();
  return status.provider ?? getFallbackProvider();
}

/**
 * Check LLM health (provider-agnostic).
 * @returns Health status with provider info
 */
export { checkLLMHealth as checkProviderAgnosticLLMHealth };
