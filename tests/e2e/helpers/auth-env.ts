import type { APIRequestContext, Playwright } from '@playwright/test';

const DEFAULT_FRONTEND_BASE_URL = 'http://127.0.0.1:4173';
const DEFAULT_API_BASE_URL = 'http://127.0.0.1:3001';

function isLocalUrl(url: string): boolean {
  return /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(url);
}

function trimTrailingSlash(url: string): string {
  let value = url;
  while (value.endsWith('/')) {
    value = value.slice(0, -1);
  }
  return value;
}

function extractShareToken(candidate: string | undefined): string | undefined {
  if (!candidate || candidate.trim().length === 0) return undefined;
  const trimmed = candidate.trim();
  try {
    const parsed = new URL(trimmed);
    const token = parsed.searchParams.get('_vercel_share');
    return token && token.trim().length > 0 ? token.trim() : undefined;
  } catch {
    return undefined;
  }
}

function getApiShareToken(): string | undefined {
  return (
    process.env.PLAYWRIGHT_API_SHARE_TOKEN?.trim() ||
    extractShareToken(process.env.PLAYWRIGHT_API_SHARE_URL)
  );
}

function extractCookiePair(setCookieHeader: string | null): string {
  if (!setCookieHeader) return '';
  const firstPair = setCookieHeader.split(';')[0]?.trim();
  return firstPair || '';
}

let cachedPreviewApiCookie: string | null = null;

async function getPreviewApiCookie(): Promise<string> {
  if (cachedPreviewApiCookie !== null) {
    return cachedPreviewApiCookie;
  }

  // First try share URL if available
  const shareUrl = process.env.PLAYWRIGHT_API_SHARE_URL?.trim();
  if (shareUrl) {
    try {
      const response = await fetch(shareUrl, {
        method: 'GET',
        redirect: 'manual',
      });
      cachedPreviewApiCookie = extractCookiePair(response.headers.get('set-cookie'));
      return cachedPreviewApiCookie;
    } catch {
      cachedPreviewApiCookie = '';
      return '';
    }
  }

  // Otherwise, use bypass secret to get a cookie from the API base URL
  const apiBase = resolveApiBaseUrl();
  const secret = getVercelBypassSecret();
  if (!secret || isLocalUrl(apiBase)) {
    cachedPreviewApiCookie = '';
    return '';
  }

  try {
    const response = await fetch(`${apiBase}/health`, {
      method: 'GET',
      redirect: 'manual',
      headers: {
        'x-vercel-protection-bypass': secret,
        'x-vercel-set-bypass-cookie': 'true',
      },
    });
    cachedPreviewApiCookie = extractCookiePair(response.headers.get('set-cookie'));
  } catch {
    cachedPreviewApiCookie = '';
  }

  return cachedPreviewApiCookie;
}

export function resolveFrontendBaseUrl(): string {
  return trimTrailingSlash(process.env.PLAYWRIGHT_BASE_URL ?? DEFAULT_FRONTEND_BASE_URL);
}

export function resolveApiBaseUrl(): string {
  const configured = process.env.PLAYWRIGHT_API_BASE_URL ?? process.env.VITE_API_BASE_URL;
  if (configured && configured.trim().length > 0) {
    return trimTrailingSlash(configured.trim());
  }

  const explicitFrontendBase = process.env.PLAYWRIGHT_BASE_URL;
  if (explicitFrontendBase && !isLocalUrl(trimTrailingSlash(explicitFrontendBase))) {
    throw new Error(
      '[auth-env] PLAYWRIGHT_API_BASE_URL is required for deployed targets. ' +
      'Set PLAYWRIGHT_API_BASE_URL (or VITE_API_BASE_URL) to the deployed backend URL.',
    );
  }

  return DEFAULT_API_BASE_URL;
}

export function apiUrl(path: string, apiBase = resolveApiBaseUrl()): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const base = new URL(trimTrailingSlash(apiBase));
  const basePath = base.pathname === '/' ? '' : base.pathname.replace(/\/+$/, '');
  base.pathname = `${basePath}${normalizedPath}`;

  const shareToken = getApiShareToken();
  const origin = `${base.protocol}//${base.host}`;
  if (shareToken && !isLocalUrl(origin)) {
    base.searchParams.set('_vercel_share', shareToken);
  }

  return base.toString();
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
  const previewCookie = await getPreviewApiCookie();
  const cookieHeaders = previewCookie ? { Cookie: previewCookie } : {};
  return playwright.request.newContext({
    baseURL,
    ...(
      Object.keys(extraHTTPHeaders).length > 0 || Object.keys(cookieHeaders).length > 0
        ? { extraHTTPHeaders: { ...extraHTTPHeaders, ...cookieHeaders } }
        : {}
    ),
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
  const previewCookie = await getPreviewApiCookie();
  const cookieHeaders = previewCookie ? { Cookie: previewCookie } : {};
  const fetchInit = {
    method: 'GET',
    headers: {
      ...headers,
      ...cookieHeaders,
    },
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
