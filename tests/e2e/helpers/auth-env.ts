import type { APIRequestContext, Playwright } from '@playwright/test';

const DEFAULT_FRONTEND_BASE_URL = 'http://127.0.0.1:4173';
const DEFAULT_API_BASE_URL = 'http://127.0.0.1:3001';

function trimTrailingSlash(url: string): string {
  let value = url;
  while (value.endsWith('/')) {
    value = value.slice(0, -1);
  }
  return value;
}

export function resolveFrontendBaseUrl(): string {
  return trimTrailingSlash(process.env.PLAYWRIGHT_BASE_URL ?? DEFAULT_FRONTEND_BASE_URL);
}

export function resolveApiBaseUrl(): string {
  const configured = process.env.PLAYWRIGHT_API_BASE_URL ?? process.env.VITE_API_BASE_URL;
  if (configured && configured.trim().length > 0) {
    return trimTrailingSlash(configured.trim());
  }
  return DEFAULT_API_BASE_URL;
}

export function apiUrl(path: string, apiBase = resolveApiBaseUrl()): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${trimTrailingSlash(apiBase)}${normalizedPath}`;
}

export function getVercelBypassSecret(): string | undefined {
  return process.env.VERCEL_AUTOMATION_BYPASS_SECRET ?? process.env.E2E_VERCEL_BYPASS_SECRET;
}

export function getVercelBypassHeaders(): Record<string, string> {
  const bypassSecret = getVercelBypassSecret();
  if (!bypassSecret) return {};
  return {
    'x-vercel-protection-bypass': bypassSecret,
    'x-vercel-set-bypass-cookie': 'true',
  };
}

export async function createApiContext(
  playwright: Playwright,
  baseURL = resolveApiBaseUrl(),
): Promise<APIRequestContext> {
  const extraHTTPHeaders = getVercelBypassHeaders();
  return playwright.request.newContext({
    baseURL,
    ...(Object.keys(extraHTTPHeaders).length > 0 ? { extraHTTPHeaders } : {}),
  });
}

export interface NeonPreflightResult {
  health: Record<string, unknown>;
  persistenceStatus: {
    dbMode?: string;
    resolvedEnvSource?: string | null;
    backendReachable?: boolean;
    persistenceRoutesEnabled?: boolean;
    [key: string]: unknown;
  };
}

export async function runNeonPreflight(apiBase = resolveApiBaseUrl()): Promise<NeonPreflightResult> {
  const headers = getVercelBypassHeaders();
  const fetchInit = {
    method: 'GET',
    headers,
    signal: AbortSignal.timeout(10_000),
  } satisfies RequestInit;

  const healthResponse = await fetch(apiUrl('/health', apiBase), fetchInit).catch((error) => {
    throw new Error(
      `[auth-setup] Backend health check failed for ${apiBase}: ${(error as Error).message}`,
    );
  });

  if (!healthResponse.ok) {
    throw new Error(
      `[auth-setup] /health failed for ${apiBase} with HTTP ${healthResponse.status}`,
    );
  }

  const health = await healthResponse.json().catch(() => {
    throw new Error(`[auth-setup] /health returned non-JSON response for ${apiBase}`);
  }) as Record<string, unknown>;

  const persistenceResponse = await fetch(apiUrl('/api/system/persistence-status', apiBase), fetchInit).catch((error) => {
    throw new Error(
      `[auth-setup] persistence-status check failed for ${apiBase}: ${(error as Error).message}`,
    );
  });

  if (!persistenceResponse.ok) {
    throw new Error(
      `[auth-setup] /api/system/persistence-status failed for ${apiBase} with HTTP ${persistenceResponse.status}`,
    );
  }

  const persistenceStatus = await persistenceResponse.json().catch(() => {
    throw new Error(`[auth-setup] /api/system/persistence-status returned non-JSON for ${apiBase}`);
  }) as NeonPreflightResult['persistenceStatus'];

  const authReachabilityResponse = await fetch(apiUrl('/api/auth/me', apiBase), fetchInit).catch((error) => {
    throw new Error(
      `[auth-setup] auth reachability check failed for ${apiBase}: ${(error as Error).message}`,
    );
  });

  if (![200, 401].includes(authReachabilityResponse.status)) {
    throw new Error(
      `[auth-setup] /api/auth/me returned unexpected HTTP ${authReachabilityResponse.status} for ${apiBase}`,
    );
  }

  if (persistenceStatus.dbMode !== 'neon') {
    throw new Error(
      `[auth-setup] Neon proof requires dbMode="neon" but got "${String(persistenceStatus.dbMode)}". ` +
      'Set PLAYWRIGHT_API_BASE_URL/VITE_API_BASE_URL to a Neon-backed backend.',
    );
  }

  if (!persistenceStatus.resolvedEnvSource) {
    throw new Error(
      '[auth-setup] Neon proof requires resolvedEnvSource to be non-null. ' +
      'Set one of DATABASE_URL/NEON_DATABASE_URL/adaptive_data_DATABASE_URL/adaptive_data_POSTGRES_URL.',
    );
  }

  if (persistenceStatus.backendReachable !== true) {
    throw new Error('[auth-setup] backendReachable is not true in persistence-status response.');
  }

  if (persistenceStatus.persistenceRoutesEnabled !== true) {
    throw new Error('[auth-setup] persistenceRoutesEnabled is not true in persistence-status response.');
  }

  return {
    health,
    persistenceStatus,
  };
}
