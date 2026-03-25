const CSRF_COOKIE_NAME = 'sql_adapt_csrf';
let csrfTokenOverride: string | null = null;

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

function isMutatingMethod(method?: string): boolean {
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

export function setCsrfToken(token: string | null | undefined): void {
  csrfTokenOverride = normalizeToken(token);
}

export function clearCsrfToken(): void {
  csrfTokenOverride = null;
}
