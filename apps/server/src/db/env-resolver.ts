/**
 * Database Environment Variable Resolver
 *
 * Resolves the Neon PostgreSQL connection URL from several possible env var
 * names in priority order. Vercel's Neon integration injects prefixed variables
 * (e.g. adaptive_data_DATABASE_URL) rather than the plain names this code
 * originally expected, so we probe all known names before giving up.
 *
 * Priority order (first match wins):
 *   1. DATABASE_URL                   — manually set, always preferred
 *   2. NEON_DATABASE_URL              — legacy secondary name
 *   3. adaptive_data_DATABASE_URL     — Vercel Neon integration (project prefix)
 *   4. adaptive_data_POSTGRES_URL     — Vercel Neon integration (postgres alias)
 */

export const DB_ENV_PRIORITY = [
  'DATABASE_URL',
  'NEON_DATABASE_URL',
  'adaptive_data_DATABASE_URL',
  'adaptive_data_POSTGRES_URL',
] as const;

export type DbEnvSource = (typeof DB_ENV_PRIORITY)[number] | null;

export interface ResolvedDbEnv {
  /** The connection URL, or null if none found */
  url: string | null;
  /** Which env var name provided the URL, or null */
  source: DbEnvSource;
}

/**
 * Probe env vars in priority order and return the first non-empty value.
 * Accepts an optional env dictionary (defaults to process.env) for testability.
 */
export function resolveDbEnv(
  env: Record<string, string | undefined> = process.env
): ResolvedDbEnv {
  for (const key of DB_ENV_PRIORITY) {
    const val = env[key];
    if (val) return { url: val, source: key };
  }
  return { url: null, source: null };
}

/**
 * Returns true if any known database env var is set.
 * Used for mode-switching throughout the server.
 */
export function hasDbEnv(
  env: Record<string, string | undefined> = process.env
): boolean {
  return resolveDbEnv(env).url !== null;
}

/**
 * Resolve the deployment environment.
 * Uses VERCEL_ENV first, falls back to NODE_ENV.
 */
export function resolveEnvironment(
  env: Record<string, string | undefined> = process.env
): 'production' | 'preview' | 'development' {
  const vercelEnv = env.VERCEL_ENV;
  if (vercelEnv === 'production') return 'production';
  if (vercelEnv === 'preview') return 'preview';
  if (env.NODE_ENV === 'production') return 'production';
  return 'development';
}

/**
 * Determine the logical database target based on environment and env var source.
 * This helps verify preview/prod isolation.
 */
export function resolveDbTarget(
  env: Record<string, string | undefined> = process.env
): 'production' | 'preview' | 'local' | 'unknown' {
  const environment = resolveEnvironment(env);
  const { source } = resolveDbEnv(env);

  // If using DATABASE_URL explicitly, check if we're in preview
  if (source === 'DATABASE_URL') {
    return environment === 'preview' ? 'preview' : 'production';
  }

  // Vercel Neon integration variables
  if (source === 'adaptive_data_DATABASE_URL' || source === 'adaptive_data_POSTGRES_URL') {
    // These typically point to production database
    return 'production';
  }

  // No env var set - likely local SQLite
  if (!source) {
    return 'local';
  }

  return 'unknown';
}
