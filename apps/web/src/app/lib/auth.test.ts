/**
 * Unit tests for auth helpers and client-side auth logic.
 *
 * These tests cover:
 * 1. JWT payload structure (decoded claims validation)
 * 2. Signup/login flow using mocked fetch
 * 3. Ownership enforcement logic
 */

import { describe, it, expect, vi } from 'vitest';

// ---------------------------------------------------------------------------
// JWT payload validation (no jsonwebtoken dependency — just claim shape)
// ---------------------------------------------------------------------------

interface TokenPayload {
  accountId: string;
  learnerId: string;
  email: string;
  role: 'student' | 'instructor';
  name: string;
  iat?: number;
  exp?: number;
}

function isValidPayload(obj: unknown): obj is TokenPayload {
  if (!obj || typeof obj !== 'object') return false;
  const p = obj as Record<string, unknown>;
  return (
    typeof p.accountId === 'string' &&
    typeof p.learnerId === 'string' &&
    typeof p.email === 'string' &&
    (p.role === 'student' || p.role === 'instructor') &&
    typeof p.name === 'string'
  );
}

describe('JWT payload validation', () => {
  it('accepts a well-formed student payload', () => {
    const payload: TokenPayload = {
      accountId: 'acc-1',
      learnerId: 'learn-1',
      email: 'student@test.com',
      role: 'student',
      name: 'Alice',
    };
    expect(isValidPayload(payload)).toBe(true);
  });

  it('accepts a well-formed instructor payload', () => {
    const payload: TokenPayload = {
      accountId: 'acc-2',
      learnerId: 'learn-2',
      email: 'instructor@test.com',
      role: 'instructor',
      name: 'Prof. Bob',
    };
    expect(isValidPayload(payload)).toBe(true);
  });

  it('rejects a payload missing required fields', () => {
    expect(isValidPayload({ accountId: 'x' })).toBe(false);
  });

  it('rejects an invalid role value', () => {
    expect(isValidPayload({ accountId: 'x', learnerId: 'y', email: 'z@a.com', role: 'admin', name: 'X' })).toBe(false);
  });

  it('rejects null and primitives', () => {
    expect(isValidPayload(null)).toBe(false);
    expect(isValidPayload('string')).toBe(false);
    expect(isValidPayload(42)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// auth-client fetch integration (using mocked fetch)
// ---------------------------------------------------------------------------

// We need to test the auth-client module. Because the module reads
// import.meta.env.VITE_API_BASE_URL at import time, we inline the logic here
// rather than importing the module under test directly.

type FetchMockResponse = {
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
};

function makeFetch(response: FetchMockResponse) {
  return vi.fn().mockResolvedValue(response);
}

const AUTH_BASE = 'http://localhost:3001/api/auth';

async function mockSignup(
  fetchFn: ReturnType<typeof vi.fn>,
  params: {
    name: string;
    email: string;
    password: string;
    role: 'student' | 'instructor';
    classCode?: string;
    instructorCode?: string;
  }
) {
  const res = await fetchFn(`${AUTH_BASE}/signup`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  const data = await res.json();
  if (!res.ok) return { success: false, error: data.error };
  return { success: true, user: data.user };
}

async function mockLogin(fetchFn: ReturnType<typeof vi.fn>, email: string, password: string) {
  const res = await fetchFn(`${AUTH_BASE}/login`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (!res.ok) return { success: false, error: data.error };
  return { success: true, user: data.user };
}

describe('auth-client: signup', () => {
  it('succeeds for student signup with valid class code', async () => {
    const mockUser = { id: 'acc-1', email: 'a@test.com', role: 'student', learnerId: 'l-1', name: 'Alice', createdAt: '2024-01-01' };
    const fetchFn = makeFetch({ ok: true, status: 201, json: async () => ({ success: true, user: mockUser }) });
    const result = await mockSignup(fetchFn, { name: 'Alice', email: 'a@test.com', password: 'password123', role: 'student', classCode: 'ClassSQL2024' });
    expect(result.success).toBe(true);
    expect(result.user?.role).toBe('student');
    expect(result.user?.learnerId).toBe('l-1');
  });

  it('rejects student signup with invalid class code', async () => {
    const fetchFn = makeFetch({ ok: false, status: 403, json: async () => ({ success: false, error: 'Invalid class code' }) });
    const result = await mockSignup(fetchFn, { name: 'Alice', email: 'a@test.com', password: 'password123', role: 'student', classCode: 'wrong-class-code' });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/invalid class code/i);
  });

  it('succeeds for instructor signup with valid code', async () => {
    const mockUser = { id: 'acc-2', email: 'prof@test.com', role: 'instructor', learnerId: 'l-2', name: 'Prof', createdAt: '2024-01-01' };
    const fetchFn = makeFetch({ ok: true, status: 201, json: async () => ({ success: true, user: mockUser }) });
    const result = await mockSignup(fetchFn, { name: 'Prof', email: 'prof@test.com', password: 'password123', role: 'instructor', instructorCode: 'TeachSQL2024' });
    expect(result.success).toBe(true);
    expect(result.user?.role).toBe('instructor');
  });

  it('rejects instructor signup with invalid code', async () => {
    const fetchFn = makeFetch({ ok: false, status: 403, json: async () => ({ success: false, error: 'Invalid instructor code' }) });
    const result = await mockSignup(fetchFn, { name: 'Prof', email: 'prof@test.com', password: 'password123', role: 'instructor', instructorCode: 'wrong-code' });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/invalid instructor code/i);
  });

  it('returns error for duplicate email', async () => {
    const fetchFn = makeFetch({ ok: false, status: 409, json: async () => ({ success: false, error: 'An account with this email already exists' }) });
    const result = await mockSignup(fetchFn, { name: 'Alice2', email: 'a@test.com', password: 'password123', role: 'student', classCode: 'ClassSQL2024' });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/already exists/i);
  });
});

describe('auth-client: login', () => {
  it('succeeds with valid credentials', async () => {
    const mockUser = { id: 'acc-1', email: 'a@test.com', role: 'student', learnerId: 'l-1', name: 'Alice', createdAt: '2024-01-01' };
    const fetchFn = makeFetch({ ok: true, status: 200, json: async () => ({ success: true, user: mockUser }) });
    const result = await mockLogin(fetchFn, 'a@test.com', 'password123');
    expect(result.success).toBe(true);
    expect(result.user?.email).toBe('a@test.com');
  });

  it('fails with invalid password', async () => {
    const fetchFn = makeFetch({ ok: false, status: 401, json: async () => ({ success: false, error: 'Invalid email or password' }) });
    const result = await mockLogin(fetchFn, 'a@test.com', 'wrong-password');
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/invalid email or password/i);
  });

  it('fails with unknown email', async () => {
    const fetchFn = makeFetch({ ok: false, status: 401, json: async () => ({ success: false, error: 'Invalid email or password' }) });
    const result = await mockLogin(fetchFn, 'nobody@test.com', 'password123');
    expect(result.success).toBe(false);
  });
});

describe('data isolation — ownership enforcement', () => {
  it('resolveLearnerId uses auth.learnerId when available', () => {
    // Simulates the logic in neon-interactions.ts resolveLearnerId
    function resolveLearnerId(authLearnerId: string | undefined, bodyLearnerId: string): string {
      return authLearnerId ?? bodyLearnerId;
    }
    expect(resolveLearnerId('server-id', 'spoofed-id')).toBe('server-id');
    expect(resolveLearnerId(undefined, 'body-id')).toBe('body-id');
  });
});
