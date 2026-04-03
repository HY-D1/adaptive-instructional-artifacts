/**
 * LLM Provider Abstraction Layer
 *
 * Defines the interface for LLM providers (Ollama, Groq, etc.)
 * to enable seamless switching between local and hosted LLMs.
 */

export type LLMProviderType = 'ollama' | 'groq';

export interface LLMGenerationParams {
  temperature: number;
  top_p: number;
  stream: boolean;
  timeoutMs: number;
}

export interface LLMGenerateRequest {
  model?: string;
  prompt: string;
  params: LLMGenerationParams;
  structuredOutput?: {
    format: 'json';
    schema: Record<string, unknown>;
  };
}

export interface LLMGenerateResponse {
  text: string;
  model: string;
  provider: LLMProviderType;
  usage?: {
    inputTokens: number;
    outputTokens: number;
  };
  latencyMs: number;
}

export interface LLMModelInfo {
  name: string;
  size?: number;
  parameterCount?: string;
  modifiedAt?: string;
}

export interface LLMHealthStatus {
  ok: boolean;
  provider: LLMProviderType;
  message: string;
  details?: string;
  models: LLMModelInfo[];
  enabled: boolean;
}

/**
 * Base interface for all LLM providers
 */
export interface LLMProvider {
  /** Provider type identifier */
  readonly provider: LLMProviderType;

  /** Default model for this provider */
  readonly defaultModel: string;

  /**
   * Generate text using the LLM
   * @param request - Generation request parameters
   * @returns Promise resolving to generated text and metadata
   */
  generate(request: LLMGenerateRequest): Promise<LLMGenerateResponse>;

  /**
   * Check provider health and available models
   * @returns Health status with available models
   */
  health(): Promise<LLMHealthStatus>;

  /**
   * List available models for this provider
   * @returns List of available models
   */
  listModels(): Promise<LLMModelInfo[]>;

  /**
   * Check if this provider is properly configured
   * @returns True if provider can be used
   */
  isConfigured(): boolean;
}

/**
 * Factory function to create providers
 */
export interface LLMProviderFactory {
  createProvider(type: LLMProviderType): LLMProvider;
  getDefaultProvider(): LLMProvider;
}
