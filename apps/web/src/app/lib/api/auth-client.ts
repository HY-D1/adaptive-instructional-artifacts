/**
 * Auth API Client
 *
 * Calls backend auth endpoints. Uses httpOnly cookies for session persistence
 * (credentials: 'include' is required for cross-origin cookie handling).
 *
 * Only active when VITE_API_BASE_URL is set. In static/localStorage mode,
 * these functions return no-op results and the app falls back to passcode auth.
 */

const _API_BASE = import.meta.env.VITE_API_BASE_URL;
const AUTH_BASE = _API_BASE ? `${_API_BASE}/api/auth` : 'http://localhost:3001/api/auth';

/** True only when a backend API is configured */
export const AUTH_ENABLED = !!_API_BASE || import.meta.env.DEV;

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
}

export interface AuthResult {
  success: boolean;
  user?: AuthUser;
  error?: string;
  details?: Record<string, string[]>;
}

// ============================================================================
// HTTP helper
// ============================================================================

async function authFetch(path: string, init: RequestInit = {}): Promise<Response> {
  return fetch(`${AUTH_BASE}${path}`, {
    ...init,
    credentials: 'include',         // send/receive httpOnly cookies
    headers: {
      'Content-Type': 'application/json',
      ...init.headers,
    },
  });
}

// ============================================================================
// Auth API calls
// ============================================================================

export async function signup(params: {
  name: string;
  email: string;
  password: string;
  role: 'student' | 'instructor';
  instructorCode?: string;
}): Promise<AuthResult> {
  try {
    const res = await authFetch('/signup', {
      method: 'POST',
      body: JSON.stringify(params),
    });
    const data = await res.json();
    if (!res.ok) {
      return { success: false, error: data.error ?? `HTTP ${res.status}`, details: data.details };
    }
    return { success: true, user: data.user };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}

export async function login(email: string, password: string): Promise<AuthResult> {
  try {
    const res = await authFetch('/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) {
      return { success: false, error: data.error ?? `HTTP ${res.status}` };
    }
    return { success: true, user: data.user };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}

export async function logout(): Promise<void> {
  try {
    await authFetch('/logout', { method: 'POST' });
  } catch {
    // Ignore errors on logout
  }
}

export async function getMe(): Promise<AuthUser | null> {
  try {
    const res = await authFetch('/me');
    if (!res.ok) return null;
    const data = await res.json();
    return data.success ? data.user : null;
  } catch {
    return null;
  }
}
