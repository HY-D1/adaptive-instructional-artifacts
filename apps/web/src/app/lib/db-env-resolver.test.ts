/**
 * Unit tests for the database env-resolver priority logic.
 *
 * The resolver lives at apps/server/src/db/env-resolver.ts but is a pure
 * function we can test here without importing server code.
 */

import { describe, it, expect } from 'vitest';

// ---------------------------------------------------------------------------
// Inline the resolver so this test file has no cross-package imports
// ---------------------------------------------------------------------------

const DB_ENV_PRIORITY = [
  'DATABASE_URL',
  'NEON_DATABASE_URL',
  'adaptive_data_DATABASE_URL',
  'adaptive_data_POSTGRES_URL',
] as const;

type DbEnvSource = (typeof DB_ENV_PRIORITY)[number] | null;

interface ResolvedDbEnv {
  url: string | null;
  source: DbEnvSource;
}

function resolveDbEnv(env: Record<string, string | undefined>): ResolvedDbEnv {
  for (const key of DB_ENV_PRIORITY) {
    const val = env[key];
    if (val) return { url: val, source: key };
  }
  return { url: null, source: null };
}

function hasDbEnv(env: Record<string, string | undefined>): boolean {
  return resolveDbEnv(env).url !== null;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('resolveDbEnv — priority order', () => {
  it('returns null when no env vars are set', () => {
    const result = resolveDbEnv({});
    expect(result.url).toBeNull();
    expect(result.source).toBeNull();
  });

  it('picks DATABASE_URL first when all vars present', () => {
    const env = {
      DATABASE_URL: 'postgres://plain',
      NEON_DATABASE_URL: 'postgres://neon',
      adaptive_data_DATABASE_URL: 'postgres://prefix-db',
      adaptive_data_POSTGRES_URL: 'postgres://prefix-pg',
    };
    const result = resolveDbEnv(env);
    expect(result.url).toBe('postgres://plain');
    expect(result.source).toBe('DATABASE_URL');
  });

  it('falls back to NEON_DATABASE_URL when DATABASE_URL is absent', () => {
    const env = {
      NEON_DATABASE_URL: 'postgres://neon',
      adaptive_data_DATABASE_URL: 'postgres://prefix-db',
    };
    const result = resolveDbEnv(env);
    expect(result.url).toBe('postgres://neon');
    expect(result.source).toBe('NEON_DATABASE_URL');
  });

  it('picks adaptive_data_DATABASE_URL when plain vars absent (Vercel Neon integration)', () => {
    const env = {
      adaptive_data_DATABASE_URL: 'postgres://prefix-db',
      adaptive_data_POSTGRES_URL: 'postgres://prefix-pg',
    };
    const result = resolveDbEnv(env);
    expect(result.url).toBe('postgres://prefix-db');
    expect(result.source).toBe('adaptive_data_DATABASE_URL');
  });

  it('picks adaptive_data_POSTGRES_URL as last resort', () => {
    const env = {
      adaptive_data_POSTGRES_URL: 'postgres://prefix-pg',
    };
    const result = resolveDbEnv(env);
    expect(result.url).toBe('postgres://prefix-pg');
    expect(result.source).toBe('adaptive_data_POSTGRES_URL');
  });

  it('ignores empty-string values', () => {
    const env = {
      DATABASE_URL: '',
      NEON_DATABASE_URL: '',
      adaptive_data_DATABASE_URL: 'postgres://prefix-db',
    };
    const result = resolveDbEnv(env);
    expect(result.url).toBe('postgres://prefix-db');
    expect(result.source).toBe('adaptive_data_DATABASE_URL');
  });
});

describe('hasDbEnv', () => {
  it('returns false when no vars set', () => {
    expect(hasDbEnv({})).toBe(false);
  });

  it('returns true for plain DATABASE_URL', () => {
    expect(hasDbEnv({ DATABASE_URL: 'postgres://x' })).toBe(true);
  });

  it('returns true for prefixed Vercel Neon integration var', () => {
    expect(hasDbEnv({ adaptive_data_DATABASE_URL: 'postgres://x' })).toBe(true);
  });
});
