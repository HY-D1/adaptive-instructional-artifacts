/**
 * LLM Module Index
 *
 * Exports the provider interface and factory for creating LLM providers
 */

export type {
  LLMProvider,
  LLMProviderType,
  LLMGenerateRequest,
  LLMGenerateResponse,
  LLMModelInfo,
  LLMHealthStatus,
  LLMGenerationParams,
} from './provider.js';

export { OllamaProvider, type OllamaConfig } from './providers/ollama.js';
export { GroqProvider, type GroqConfig } from './providers/groq.js';

import type {
  LLMProvider,
  LLMProviderType,
} from './provider.js';
import { OllamaProvider, type OllamaConfig } from './providers/ollama.js';
import { GroqProvider, type GroqConfig } from './providers/groq.js';

export interface LLMProviderFactoryConfig {
  type: LLMProviderType;
  ollamaConfig?: OllamaConfig;
  groqConfig?: GroqConfig;
}

/**
 * Factory function to create an LLM provider based on type
 */
export function createLLMProvider(config: LLMProviderFactoryConfig): LLMProvider {
  switch (config.type) {
    case 'ollama':
      if (!config.ollamaConfig) {
        throw new Error('Ollama config is required for ollama provider');
      }
      return new OllamaProvider(config.ollamaConfig);
    case 'groq':
      if (!config.groqConfig) {
        throw new Error('Groq config is required for groq provider');
      }
      return new GroqProvider(config.groqConfig);
    default:
      throw new Error(`Unknown provider type: ${config.type}`);
  }
}

/**
 * Get the default provider based on environment configuration
 */
export function getDefaultProvider(
  llmProviderType: LLMProviderType,
  ollamaConfig: OllamaConfig,
  groqConfig: GroqConfig
): LLMProvider {
  if (llmProviderType === 'groq') {
    return new GroqProvider(groqConfig);
  }
  return new OllamaProvider(ollamaConfig);
}
