import { LLMGenerationParams } from '../types';

export const OLLAMA_MODEL = 'qwen2.5:1.5b-instruct';
const OLLAMA_PROXY_BASE = '/ollama';
const OLLAMA_LOCAL_URL = 'http://127.0.0.1:11434';
const HEALTHCHECK_TIMEOUT_MS = 8000;
const PROBE_PROMPT = 'Reply with exactly: OLLAMA_OK';
const PROBE_TIMEOUT_MS = 12000;
const PROBE_WARMUP_TIMEOUT_MS = 30000;

export type OllamaGenerateOptions = {
  model?: string;
  params?: Partial<LLMGenerationParams>;
};

export type OllamaHealthStatus = {
  ok: boolean;
  message: string;
  availableModels?: string[];
  probeResponse?: string;
};

export type OllamaClientError = Error & {
  status?: number;
  code: 'NETWORK' | 'TIMEOUT' | 'HTTP' | 'INVALID_RESPONSE';
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

function buildServiceDownMessage(details: string): string {
  const normalizedDetails = compactMessage(details);
  const suffix = normalizedDetails ? ` Details: ${normalizedDetails}.` : '';
  return `Could not reach local Ollama via ${OLLAMA_PROXY_BASE} -> ${OLLAMA_LOCAL_URL}.${suffix} Start Ollama (macOS: open app or run "ollama serve"; Windows: start Ollama app/service) and verify with "ollama list".`;
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

export async function generateWithOllama(prompt: string, options?: OllamaGenerateOptions): Promise<{
  text: string;
  model: string;
  params: LLMGenerationParams;
}> {
  const model = options?.model || OLLAMA_MODEL;
  const params: LLMGenerationParams = {
    ...DEFAULT_PARAMS,
    ...(options?.params || {})
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), params.timeoutMs);

  try {
    const response = await fetch('/ollama/api/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model,
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
      const body = await response.text();
      throw buildClientError('HTTP', `Ollama HTTP ${response.status}: ${body}`, response.status);
    }

    const payload = await response.json();
    if (!payload || typeof payload.response !== 'string') {
      throw buildClientError('INVALID_RESPONSE', 'Ollama returned an unexpected response payload.');
    }

    return {
      text: payload.response,
      model,
      params
    };
  } catch (error) {
    if ((error as Error).name === 'AbortError') {
      throw buildClientError('TIMEOUT', `Ollama request timed out after ${params.timeoutMs}ms.`);
    }
    if ((error as OllamaClientError).code) {
      throw error;
    }
    throw buildClientError('NETWORK', (error as Error).message || 'Failed to reach Ollama.');
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function checkOllamaHealth(model: string = OLLAMA_MODEL): Promise<OllamaHealthStatus> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), HEALTHCHECK_TIMEOUT_MS);

  try {
    const response = await fetch('/ollama/api/tags', {
      method: 'GET',
      signal: controller.signal
    });

    if (!response.ok) {
      const body = await readResponseText(response);
      const details = body ? `status ${response.status}: ${body}` : `status ${response.status}`;
      return {
        ok: false,
        message: buildServiceDownMessage(details)
      };
    }

    const payload = await response.json();
    const availableModels = Array.isArray(payload?.models)
      ? payload.models.map((entry: { name?: string }) => entry?.name).filter(Boolean)
      : [];

    if (availableModels.includes(model)) {
      try {
        const probe = await runHealthProbe(model);
        const probeResponse = probe.response;
        const warmupSuffix = probe.usedWarmupRetry ? ' after warm-up retry' : '';
        return {
          ok: true,
          message: `Connected. Model '${model}' is available and replied: "${probeResponse || '[empty response]'}"${warmupSuffix}.`,
          availableModels,
          probeResponse
        };
      } catch (error) {
        if (isTimeoutError(error)) {
          return {
            ok: false,
            message: `Connected and model '${model}' is available, but test generation timed out (${PROBE_TIMEOUT_MS}ms + warm-up retry ${PROBE_WARMUP_TIMEOUT_MS}ms). The model is likely still loading; retry Test LLM or run "ollama run ${model} \\"${PROBE_PROMPT}\\"" once to warm it up.`,
            availableModels
          };
        }

        const details = getErrorMessage(error);
        return {
          ok: false,
          message: `Connected and model '${model}' is available, but test generation failed: ${details}.`,
          availableModels
        };
      }
    }

    return {
      ok: false,
      message: `Connected, but model '${model}' is not available. Run "ollama pull ${model}". Available models: ${formatAvailableModels(availableModels)}.`,
      availableModels
    };
  } catch (error) {
    if ((error as Error).name === 'AbortError') {
      return {
        ok: false,
        message: buildServiceDownMessage(`timed out after ${HEALTHCHECK_TIMEOUT_MS}ms while calling /api/tags`)
      };
    }
    return {
      ok: false,
      message: buildServiceDownMessage(getErrorMessage(error))
    };
  } finally {
    clearTimeout(timeoutId);
  }
}
