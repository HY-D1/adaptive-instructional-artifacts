/**
 * Runtime Configuration
 * 
 * Centralized access to environment variables with safe fallbacks.
 * All Vite env vars are available at build time only.
 * 
 * IMPORTANT: VITE_ prefixed variables are embedded in the frontend bundle
 * at build time. They are NOT runtime-configurable on Vercel without
 * a rebuild after environment variable changes.
 */

/**
 * Check if instructor mode is available
 * Requires VITE_INSTRUCTOR_PASSCODE to be set at build time
 */
export function isInstructorModeAvailable(): boolean {
  const passcode = import.meta.env.VITE_INSTRUCTOR_PASSCODE;
  // In dev mode, fallback is available. In production, must be explicitly set.
  const isDev = import.meta.env.DEV;
  return !!(passcode || isDev);
}

/**
 * Check if LLM features are available (Ollama)
 * Note: Ollama is only available in local development, not on Vercel
 */
export function isLLMAvailable(): boolean {
  // In hosted mode, LLM is never available (no hosted Ollama)
  if (isHostedMode()) {
    return false;
  }
  
  // LLM requires a backend proxy or local Ollama instance
  // On Vercel static hosting, this is not available
  const ollamaUrl = import.meta.env.VITE_OLLAMA_URL;
  const enableLLM = import.meta.env.VITE_ENABLE_LLM;
  
  // If explicitly disabled, respect that
  if (enableLLM === 'false') return false;
  
  // Available if Ollama URL is configured (typically local dev only)
  return !!ollamaUrl;
}

/**
 * Check if PDF index features are available
 * Note: PDF index requires backend support, not available on static hosting
 */
export function isPDFIndexAvailable(): boolean {
  // In hosted mode, PDF index features are unavailable
  if (isHostedMode()) {
    return false;
  }
  
  const enablePDF = import.meta.env.VITE_ENABLE_PDF_INDEX;
  return enablePDF === 'true';
}

/**
 * Check if running in hosted mode (Vercel/Netlify static hosting)
 * This affects feature availability for backend-dependent features
 */
export function isHostedMode(): boolean {
  // Detect common hosting platforms
  const isVercel = !!import.meta.env.VERCEL;
  const isNetlify = !!import.meta.env.NETLIFY;
  
  // Also check if we're in production without backend API configured
  const isProd = import.meta.env.PROD;
  const apiUrl = import.meta.env.VITE_API_BASE_URL;
  const hasBackend = !!apiUrl && apiUrl.length > 0;
  
  return isVercel || isNetlify || (isProd && !hasBackend);
}

/**
 * Check if backend API is configured
 */
export function isBackendConfigured(): boolean {
  const apiUrl = import.meta.env.VITE_API_BASE_URL;
  return !!apiUrl && apiUrl.length > 0;
}

/**
 * Get the backend API base URL
 */
export function getApiBaseUrl(): string | undefined {
  return import.meta.env.VITE_API_BASE_URL;
}

/**
 * Get the Ollama URL (for local development)
 */
export function getOllamaUrl(): string {
  return import.meta.env.VITE_OLLAMA_URL || 'http://127.0.0.1:11434';
}

/**
 * Runtime configuration object
 * Use this for feature flags and configuration checks
 */
export interface RuntimeConfig {
  /** Instructor mode requires VITE_INSTRUCTOR_PASSCODE */
  instructorModeAvailable: boolean;
  /** LLM features (Ollama) - local dev only */
  llmAvailable: boolean;
  /** PDF index features - requires backend */
  pdfIndexAvailable: boolean;
  /** Running on static hosting (Vercel/Netlify) */
  isHostedMode: boolean;
  /** Backend API is configured */
  backendConfigured: boolean;
  /** API base URL if configured */
  apiBaseUrl: string | undefined;
  /** Build mode info */
  mode: {
    isDev: boolean;
    isProd: boolean;
  };
}

/**
 * Get complete runtime configuration
 */
export function getRuntimeConfig(): RuntimeConfig {
  return {
    instructorModeAvailable: isInstructorModeAvailable(),
    llmAvailable: isLLMAvailable(),
    pdfIndexAvailable: isPDFIndexAvailable(),
    isHostedMode: isHostedMode(),
    backendConfigured: isBackendConfigured(),
    apiBaseUrl: getApiBaseUrl(),
    mode: {
      isDev: import.meta.env.DEV,
      isProd: import.meta.env.PROD,
    },
  };
}

/**
 * Log runtime configuration to console (for debugging)
 * Only logs in development mode
 */
export function logRuntimeConfig(): void {
  if (!import.meta.env.DEV) return;
  
  const config = getRuntimeConfig();
  // eslint-disable-next-line no-console
  console.group('🔧 Runtime Configuration');
  // eslint-disable-next-line no-console
  console.log('Instructor Mode:', config.instructorModeAvailable ? '✅ Available' : '❌ Not configured');
  // eslint-disable-next-line no-console
  console.log('LLM Features:', config.llmAvailable ? '✅ Available' : '❌ Not available (local dev only)');
  // eslint-disable-next-line no-console
  console.log('PDF Index:', config.pdfIndexAvailable ? '✅ Enabled' : '❌ Disabled');
  // eslint-disable-next-line no-console
  console.log('Backend API:', config.backendConfigured ? `✅ ${config.apiBaseUrl}` : '❌ Not configured');
  // eslint-disable-next-line no-console
  console.log('Hosted Mode:', config.isHostedMode ? '☁️ Yes (Vercel/Netlify)' : '🖥️ No (full-stack)');
  // eslint-disable-next-line no-console
  console.groupEnd();
}

// ============================================================================
// Hosted Mode Utility Functions
// ============================================================================

/**
 * Get a user-friendly message explaining hosted mode limitations
 */
export function getHostedModeMessage(): string {
  return 'Research features use deterministic mode. PDF indexing and LLM require local deployment.';
}

/**
 * Get error message when PDF features are unavailable
 */
export function getPDFUnavailableError(): string {
  return 'PDF upload and index building are not available in hosted mode. Run the app locally with "npm run dev" to use these features.';
}

/**
 * Get error message when LLM features are unavailable
 */
export function getLLMUnavailableError(): string {
  return 'LLM features are not available in hosted mode. Run the app locally with Ollama installed to use AI-powered explanations.';
}
