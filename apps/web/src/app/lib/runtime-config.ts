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

// RESEARCH CONTRACT VERSION - Bump when deployment semantics change
// v2.2.0: Exact backend confirmation, durable pagehide/session_end barriers, bounded hint cache, production batch validation
export const RESEARCH_CONTRACT_VERSION = 'v2.2.0';

/**
 * Research Runtime Mode
 * - 'research-safe': Backend configured and healthy, data durability guaranteed
 * - 'research-unsafe': Production without backend, data loss risk (BLOCKED)
 * - 'dev-demo': Explicit dev/demo mode allowed for local development
 */
export type ResearchRuntimeMode = 'research-safe' | 'research-unsafe' | 'dev-demo';

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
 * Check if LLM features are available.
 * Backend-configured deployments can use Groq or Ollama via the server proxy.
 */
export function isLLMAvailable(): boolean {
  const enableLLM = import.meta.env.VITE_ENABLE_LLM;

  // If explicitly disabled, respect that
  if (enableLLM === 'false') return false;

  // Available if a backend API is configured (uses backend LLM proxy)
  if (isBackendConfigured()) {
    return true;
  }

  // In hosted mode without backend, LLM is not available
  if (isHostedMode()) {
    return false;
  }

  // Legacy local-dev support: available if an explicit Ollama URL is configured
  const ollamaUrl = import.meta.env.VITE_OLLAMA_URL;
  return !!ollamaUrl;
}

/**
 * Check if PDF index features are available
 * Note: PDF index requires backend support, not available on static hosting
 */
export function isPDFIndexAvailable(): boolean {
  // Available when a backend API is configured (PDF index is backend-driven)
  if (isBackendConfigured()) {
    return true;
  }

  // In hosted mode without backend, PDF index features are unavailable
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
  // If a backend API is configured, we are NOT in restricted hosted mode
  if (isBackendConfigured()) {
    return false;
  }

  // Detect common hosting platforms without backend
  const isVercel = !!import.meta.env.VERCEL;
  const isNetlify = !!import.meta.env.NETLIFY;

  // Also check if we're in production without backend API configured
  const isProd = import.meta.env.PROD;

  return isVercel || isNetlify || isProd;
}

/**
 * Check if backend API is configured
 */
export function isBackendConfigured(): boolean {
  const apiUrl = import.meta.env.VITE_API_BASE_URL;
  return !!apiUrl && apiUrl.length > 0;
}

/**
 * Check if explicit dev/demo mode is enabled
 * This allows local-only mode for development/testing
 */
export function isDevDemoModeEnabled(): boolean {
  return import.meta.env.VITE_ALLOW_DEV_DEMO_MODE === 'true' || import.meta.env.DEV;
}

/**
 * Get the research runtime mode
 * In production, requires VITE_API_BASE_URL or explicit dev/demo flag
 */
export function getResearchRuntimeMode(): ResearchRuntimeMode {
  const backendConfigured = isBackendConfigured();
  const devDemoEnabled = isDevDemoModeEnabled();
  const isProd = import.meta.env.PROD;

  if (backendConfigured) {
    return 'research-safe';
  }

  if (isProd && !devDemoEnabled) {
    return 'research-unsafe';
  }

  return 'dev-demo';
}

/**
 * Check if research-safe mode is active
 * Data durability is guaranteed in this mode
 */
export function isResearchSafe(): boolean {
  return getResearchRuntimeMode() === 'research-safe';
}

/**
 * Check if running in a test environment (Playwright, Cypress, etc.)
 * Used to bypass research-unsafe blocking for E2E tests
 */
export function isTestEnvironment(): boolean {
  // Check for Playwright
  if (typeof window !== 'undefined' && (window as any).__PLAYWRIGHT__) {
    return true;
  }
  // Check for Cypress
  if (typeof window !== 'undefined' && (window as any).Cypress) {
    return true;
  }
  // Check for test runner via env var (set in CI)
  if (import.meta.env.VITE_TEST_MODE === 'true') {
    return true;
  }
  return false;
}

/**
 * Check if research-unsafe mode is active
 * This is a BLOCKING state in production - app should not allow interactions
 * Test environments are allowed to bypass this for E2E testing
 */
export function isResearchUnsafe(): boolean {
  // Allow tests to run without backend configuration
  if (isTestEnvironment()) {
    return false;
  }
  return getResearchRuntimeMode() === 'research-unsafe';
}

// ============================================================================
// RESEARCH-4: Backend Readiness Checks
// ============================================================================

export interface ResearchReadiness {
  ready: boolean;
  reason?: string;
  diagnostics: {
    envConfigured: boolean;
    backendReachable: boolean;
    dbMode?: string;
    isNeon: boolean;
    persistenceEnabled: boolean;
    backendContractVersion?: string;
  };
}

export interface PersistenceStatus {
  backendReachable: boolean;
  dbMode: 'neon' | 'sqlite';
  resolvedEnvSource: string;
  persistenceRoutesEnabled: boolean;
  researchContractVersion?: string;
}

export interface BackendHealth {
  status: string;
  timestamp: string;
  version: string;
  db: {
    mode: 'neon' | 'sqlite';
    envSource: string;
  };
}

/**
 * Check backend persistence status
 * RESEARCH-4: Used for startup readiness verification
 */
async function checkPersistenceStatus(apiUrl: string): Promise<PersistenceStatus | null> {
  try {
    const response = await fetch(`${apiUrl}/system/persistence-status`, {
      method: 'GET',
      credentials: 'include',
    });
    
    if (!response.ok) {
      return null;
    }
    
    return await response.json();
  } catch {
    return null;
  }
}

/**
 * Fetch detailed backend health
 * RESEARCH-4: Used for startup readiness verification
 */
async function fetchBackendHealth(apiBase: string): Promise<BackendHealth | null> {
  try {
    const response = await fetch(`${apiBase}/health`, {
      method: 'GET',
    });
    
    if (!response.ok) {
      return null;
    }
    
    return await response.json();
  } catch {
    return null;
  }
}

/**
 * Check research readiness at app startup
 * RESEARCH-4: Verifies backend is reachable, using Neon, and actually writable
 * This is more robust than just checking if VITE_API_BASE_URL exists
 */
export async function checkResearchReadiness(): Promise<ResearchReadiness> {
  const envConfigured = isBackendConfigured();
  const apiBase = getApiBaseUrl();
  const apiUrl = apiBase ? `${apiBase}/api` : undefined;

  if (isTestEnvironment()) {
    return {
      ready: true,
      diagnostics: {
        envConfigured,
        backendReachable: false,
        isNeon: false,
        persistenceEnabled: false,
      },
    };
  }
  
  if (!envConfigured || !apiUrl) {
    return {
      ready: false,
      reason: 'Backend not configured (VITE_API_BASE_URL missing)',
      diagnostics: {
        envConfigured: false,
        backendReachable: false,
        isNeon: false,
        persistenceEnabled: false,
      }
    };
  }
  
  const [health, persistence] = await Promise.all([
    fetchBackendHealth(apiBase),
    checkPersistenceStatus(apiUrl),
  ]);
  
  const backendReachable = !!health;
  const isNeon = persistence?.dbMode === 'neon';
  const persistenceEnabled = persistence?.persistenceRoutesEnabled ?? false;
  
  if (!backendReachable) {
    return {
      ready: false,
      reason: 'Backend unreachable',
      diagnostics: {
        envConfigured: true,
        backendReachable: false,
        isNeon: false,
        persistenceEnabled: false,
      }
    };
  }
  
  if (!isNeon) {
    return {
      ready: false,
      reason: `Database mode is ${persistence?.dbMode}, expected neon for research-safe mode`,
      diagnostics: {
        envConfigured: true,
        backendReachable: true,
        dbMode: persistence?.dbMode,
        isNeon: false,
        persistenceEnabled,
        backendContractVersion: persistence?.researchContractVersion,
      }
    };
  }
  
  if (!persistenceEnabled) {
    return {
      ready: false,
      reason: 'Persistence routes disabled',
      diagnostics: {
        envConfigured: true,
        backendReachable: true,
        dbMode: persistence?.dbMode,
        isNeon: true,
        persistenceEnabled: false,
        backendContractVersion: persistence?.researchContractVersion,
      }
    };
  }
  
  return {
    ready: true,
    diagnostics: {
      envConfigured: true,
      backendReachable: true,
      dbMode: 'neon',
      isNeon: true,
      persistenceEnabled: true,
      backendContractVersion: persistence?.researchContractVersion,
    }
  };
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
  /** LLM features via backend proxy or local Ollama */
  llmAvailable: boolean;
  /** PDF index features - requires backend */
  pdfIndexAvailable: boolean;
  /** Running on static hosting (Vercel/Netlify) */
  isHostedMode: boolean;
  /** Backend API is configured */
  backendConfigured: boolean;
  /** API base URL if configured */
  apiBaseUrl: string | undefined;
  /** Research runtime mode for data durability guarantees */
  researchRuntimeMode: ResearchRuntimeMode;
  /** Research contract version */
  researchContractVersion: string;
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
    researchRuntimeMode: getResearchRuntimeMode(),
    researchContractVersion: RESEARCH_CONTRACT_VERSION,
    mode: {
      isDev: import.meta.env.DEV,
      isProd: import.meta.env.PROD,
    },
  };
}

/**
 * Log runtime configuration to console (for debugging)
 * Logs in both dev and production for research tracking
 */
export function logRuntimeConfig(): void {
  const config = getRuntimeConfig();
  const isResearchUnsafe = config.researchRuntimeMode === 'research-unsafe';
  
  // eslint-disable-next-line no-console
  console.group('🔧 Runtime Configuration');
  // eslint-disable-next-line no-console
  console.log('Instructor Mode:', config.instructorModeAvailable ? '✅ Available' : '❌ Not configured');
  // eslint-disable-next-line no-console
  console.log('LLM Features:', config.llmAvailable ? '✅ Available' : '❌ Not available');
  // eslint-disable-next-line no-console
  console.log('PDF Index:', config.pdfIndexAvailable ? '✅ Enabled' : '❌ Disabled');
  // eslint-disable-next-line no-console
  console.log('Backend API:', config.backendConfigured ? `✅ ${config.apiBaseUrl}` : '❌ Not configured');
  // eslint-disable-next-line no-console
  console.log('Hosted Mode:', config.isHostedMode ? '☁️ Yes (Vercel/Netlify)' : '🖥️ No (full-stack)');
  // eslint-disable-next-line no-console
  console.log('Research Mode:', isResearchUnsafe ? '🔴 UNSAFE - BLOCKING' : `🟢 ${config.researchRuntimeMode}`);
  // eslint-disable-next-line no-console
  console.log('Contract Version:', config.researchContractVersion);
  // eslint-disable-next-line no-console
  console.groupEnd();

  // Log research mode for telemetry (always in production)
  if (import.meta.env.PROD || isResearchUnsafe) {
    // eslint-disable-next-line no-console
    console.info('[telemetry_research_runtime_mode]', {
      mode: config.researchRuntimeMode,
      contractVersion: config.researchContractVersion,
      backendConfigured: config.backendConfigured,
      isProd: config.mode.isProd,
    });
  }
}

/**
 * Get error message for research-unsafe mode
 */
export function getResearchUnsafeError(): string {
  return 'This deployment is not configured for research data collection. Please contact the research team or use the demo mode flag for local development.';
}

// ============================================================================
// Hosted Mode Utility Functions
// ============================================================================

/**
 * Get a user-friendly message explaining hosted mode limitations
 */
export function getHostedModeMessage(): string {
  return 'Research features use deterministic mode in frontend-only hosted deployments. Connect the backend API to enable live LLM-backed features.';
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
  if (isBackendConfigured()) {
    return 'AI features are temporarily unavailable because the backend LLM service is unreachable or disabled.';
  }
  return 'AI features are not available in this frontend-only hosted deployment. Connect the backend API or use a local Ollama-backed development setup to enable live explanations.';
}
