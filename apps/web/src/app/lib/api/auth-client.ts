/**
 * Auth API Client
 *
 * Calls backend auth endpoints. Uses httpOnly cookies for session persistence
 * (credentials: 'include' is required for cross-origin cookie handling).
 *
 * Only active when VITE_API_BASE_URL is set. In static/localStorage mode,
 * these functions return no-op results and the app falls back to passcode auth.
 */

import { withCsrfHeader, setCsrfToken, clearCsrfToken } from './csrf-client';
import { isResearchSafe, getResearchRuntimeMode } from '../runtime-config';

const _API_BASE = import.meta.env.VITE_API_BASE_URL;
const AUTH_BASE = _API_BASE ? `${_API_BASE}/api/auth` : 'http://localhost:3001/api/auth';

/** True only when a backend API is configured */
export const AUTH_BACKEND_CONFIGURED = !!_API_BASE;
export const AUTH_ENABLED = AUTH_BACKEND_CONFIGURED || import.meta.env.DEV;

/** Research-safe flag - true when backend is configured for data durability */
export const AUTH_RESEARCH_SAFE = isResearchSafe();

/**
 * Get research runtime mode for auth
 * @returns 'research-safe' | 'research-unsafe' | 'dev-demo'
 */
export function getAuthResearchMode(): ReturnType<typeof getResearchRuntimeMode> {
  return getResearchRuntimeMode();
}

/**
 * Check if auth is in research-safe mode
 * Data durability is guaranteed when this returns true
 */
export function isAuthResearchSafe(): boolean {
  return isResearchSafe();
}

function formatNetworkError(error: Error): string {
  const base = error.message || 'Network request failed';
  const diagnostic = AUTH_BACKEND_CONFIGURED
    ? `Unable to reach ${AUTH_BASE}. Check deployment URL, browser network requests, and current origin.`
    : 'Backend API base URL is not configured.';
  return `${base}. ${diagnostic}`;
}

// ============================================================================
// Types
// ============================================================================

export interface AuthUser {
  id: string;           // auth_accounts.id
  email: string;
  role: 'student' | 'instructor';
  learnerId: string;    // users.id — used for all data operations
  name: string;
  createdAt: string;
  sectionId?: string | null;
  sectionName?: string | null;
  ownedSections?: Array<{
    id: string;
    name: string;
    studentSignupCode: string;
  }>;
}

export interface AuthResult {
  success: boolean;
  user?: AuthUser;
  error?: string;
  details?: Record<string, string[]>;
}

export interface LogoutResult {
  success: boolean;
  status?: number;
  error?: string;
}

// ============================================================================
// HTTP helper
// ============================================================================

async function authFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const requestInit = withCsrfHeader(init);
  const headers = new Headers(requestInit.headers || {});
  if (!headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  // Add Vercel bypass secret for E2E testing on protected previews
  // @ts-expect-error - global injected by E2E tests
  const bypassSecret = typeof window !== 'undefined' ? window.__VERCEL_BYPASS_SECRET__ : undefined;
  if (bypassSecret && !headers.has('x-vercel-protection-bypass')) {
    headers.set('x-vercel-protection-bypass', bypassSecret);
    headers.set('x-vercel-set-bypass-cookie', 'true');
  }

  // Add timeout to prevent hanging on cross-origin requests in E2E tests
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

  try {
    const response = await fetch(`${AUTH_BASE}${path}`, {
      ...requestInit,
      credentials: 'include',         // send/receive httpOnly cookies
      headers,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

// ============================================================================
// Auth API calls
// ============================================================================

export async function signup(params: {
  name: string;
  email: string;
  password: string;
  role: 'student' | 'instructor';
  classCode?: string;
  instructorCode?: string;
}): Promise<AuthResult> {
  try {
    const res = await authFetch('/signup', {
      method: 'POST',
      body: JSON.stringify(params),
    });
    const data = await res.json();
    setCsrfToken(data?.csrfToken);
    if (!res.ok) {
      return { success: false, error: data.error ?? `HTTP ${res.status}`, details: data.details };
    }
    return { success: true, user: data.user };
  } catch (err) {
    return { success: false, error: formatNetworkError(err as Error) };
  }
}

export async function login(email: string, password: string): Promise<AuthResult> {
  try {
    const res = await authFetch('/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    setCsrfToken(data?.csrfToken);
    if (!res.ok) {
      return { success: false, error: data.error ?? `HTTP ${res.status}` };
    }
    return { success: true, user: data.user };
  } catch (err) {
    return { success: false, error: formatNetworkError(err as Error) };
  }
}

export async function logout(): Promise<LogoutResult> {
  if (!AUTH_BACKEND_CONFIGURED) {
    return { success: true };
  }

  try {
    const res = await authFetch('/logout', { method: 'POST' });
    if (!res.ok) {
      const data = await res.json().catch(() => ({} as { error?: string }));
      if (res.status === 401) {
        clearCsrfToken();
      }
      return {
        success: false,
        status: res.status,
        error: data.error ?? `HTTP ${res.status}`,
      };
    }
    clearCsrfToken();
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: formatNetworkError(err as Error),
    };
  }
}

export async function getMe(): Promise<AuthUser | null> {
  try {
    const res = await authFetch('/me');
    if (!res.ok) {
      if (res.status === 401) {
        clearCsrfToken();
      }
      return null;
    }
    const data = await res.json();
    setCsrfToken(data?.csrfToken);
    return data.success ? data.user : null;
  } catch {
    return null;
  }
}
