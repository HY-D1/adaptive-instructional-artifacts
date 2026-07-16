/**
 * Cookie Configuration
 *
 * Centralizes the SameSite / Secure attributes used for the auth (sql_adapt_auth)
 * and CSRF (sql_adapt_csrf) cookies so both stay in lockstep.
 *
 * Defaults preserve the previous behavior exactly:
 *   - production  -> SameSite=None; Secure  (works for cross-site frontend/backend)
 *   - non-prod    -> SameSite=Lax;  not Secure
 *
 * Overrides (opt-in, for the first-party / same-origin deployment model):
 *   - AUTH_COOKIE_SAMESITE = 'lax' | 'strict' | 'none'
 *   - AUTH_COOKIE_SECURE   = 'true' | 'false'
 *
 * IMPORTANT: only set AUTH_COOKIE_SAMESITE=lax once the frontend calls the API
 * on its own origin (a Vercel rewrite + VITE_API_BASE_URL=same-origin). A Lax
 * cookie is not sent on cross-site requests, so flipping this while the frontend
 * still calls a different backend origin will break auth for everyone.
 */

export type SameSiteOption = 'lax' | 'strict' | 'none';

function isProd(): boolean {
  return process.env.NODE_ENV === 'production';
}

function resolveSameSite(): SameSiteOption {
  const raw = process.env.AUTH_COOKIE_SAMESITE?.trim().toLowerCase();
  if (raw === 'lax' || raw === 'strict' || raw === 'none') {
    return raw;
  }
  // Default preserves prior behavior: cross-site in prod, lax locally.
  return isProd() ? 'none' : 'lax';
}

function resolveSecure(sameSite: SameSiteOption): boolean {
  const raw = process.env.AUTH_COOKIE_SECURE?.trim().toLowerCase();
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  // SameSite=None is only honored by browsers when Secure is also set.
  if (sameSite === 'none') return true;
  // Otherwise mirror prior behavior: Secure in production, plain locally.
  return isProd();
}

export interface CookieSecurityOptions {
  sameSite: SameSiteOption;
  secure: boolean;
}

/**
 * Resolve the SameSite/Secure attributes for auth-related cookies.
 * Read at call time so env changes take effect without recompilation.
 */
export function getCookieBaseOptions(): CookieSecurityOptions {
  const sameSite = resolveSameSite();
  return { sameSite, secure: resolveSecure(sameSite) };
}
