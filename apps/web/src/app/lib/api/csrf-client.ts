const CSRF_COOKIE_NAME = 'sql_adapt_csrf';
const AUTH_ME_REFRESH_TIMEOUT_MS = 10_000;
let csrfTokenOverride: string | null = null;
let authTransportTail: Promise<void> = Promise.resolve();

function normalizeToken(token: string | null | undefined): string | null {
  if (!token) return null;
  const trimmed = token.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const encodedName = encodeURIComponent(name);
  const segments = document.cookie.split(';');
  for (const rawSegment of segments) {
    const segment = rawSegment.trim();
    if (!segment) continue;
    if (!segment.startsWith(`${encodedName}=`)) continue;
    const value = segment.slice(encodedName.length + 1);
    return decodeURIComponent(value);
  }
  return null;
}

export function isMutatingMethod(method?: string): boolean {
  if (!method) return false;
  const normalized = method.toUpperCase();
  return normalized === 'POST' || normalized === 'PUT' || normalized === 'PATCH' || normalized === 'DELETE';
}

export function withCsrfHeader(init: RequestInit = {}): RequestInit {
  if (!isMutatingMethod(init.method)) {
    return init;
  }

  const token = csrfTokenOverride ?? getCookie(CSRF_COOKIE_NAME);
  if (!token) {
    return init;
  }

  const headers = new Headers(init.headers || {});
  headers.set('x-csrf-token', token);

  return {
    ...init,
    headers,
  };
}

/**
 * Get CSRF headers for keepalive-safe fetch requests
 * Returns headers object that can be spread into fetch init
 * RESEARCH-3: Required for pagehide/logout flush with Neon auth+CSRF
 */
export function getCsrfHeaders(): Record<string, string> {
  const token = csrfTokenOverride ?? getCookie(CSRF_COOKIE_NAME);
  if (!token) {
    return {};
  }
  return { 'x-csrf-token': token };
}

export function setCsrfToken(token: string | null | undefined): void {
  csrfTokenOverride = normalizeToken(token);
}

export function clearCsrfToken(): void {
  csrfTokenOverride = null;
}

type AuthMeResponse = {
  csrfToken?: string;
  user?: {
    id?: string;
    learnerId?: string;
  };
};

export interface ExpectedAuthIdentity {
  accountId: string;
  learnerId: string;
}

export interface CsrfRefreshOptions {
  expectedIdentity?: ExpectedAuthIdentity;
  isCurrent?: () => boolean;
  onRefreshed?: () => Promise<void>;
}

/**
 * Serialize auth-cookie and CSRF-token transitions in one browser tab.
 * The rejection-proof tail keeps later operations usable after a network error.
 */
export function runAuthTransportExclusive<T>(operation: () => Promise<T>): Promise<T> {
  const result = authTransportTail.then(operation);
  authTransportTail = result.then(
    () => undefined,
    () => undefined,
  );
  return result;
}

function matchesExpectedIdentity(
  body: AuthMeResponse | null,
  expectedIdentity: ExpectedAuthIdentity | undefined,
): boolean {
  if (!expectedIdentity) return true;
  return body?.user?.id === expectedIdentity.accountId
    && body.user.learnerId === expectedIdentity.learnerId;
}

async function refreshCsrfTokenFromAuthMeWithinLane(
  authMeUrl: string,
  options: CsrfRefreshOptions,
): Promise<boolean> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), AUTH_ME_REFRESH_TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetch(authMeUrl, {
      method: 'GET',
      credentials: 'include',
      signal: controller.signal,
    });
  } catch {
    return false;
  } finally {
    clearTimeout(timeoutId);
  }

  if (!response.ok) {
    if (response.status === 401) {
      clearCsrfToken();
    }
    return false;
  }

  const body = await response.json().catch(() => null as AuthMeResponse | null);
  if (!matchesExpectedIdentity(body, options.expectedIdentity) || options.isCurrent?.() === false) {
    return false;
  }
  const token = normalizeToken(body?.csrfToken);
  if (!token) {
    return false;
  }

  setCsrfToken(token);
  if (options.onRefreshed) {
    await options.onRefreshed();
  }
  return true;
}

export function refreshCsrfTokenFromAuthMe(
  authMeUrl: string,
  options: CsrfRefreshOptions = {},
): Promise<boolean> {
  return runAuthTransportExclusive(
    () => refreshCsrfTokenFromAuthMeWithinLane(authMeUrl, options),
  );
}
