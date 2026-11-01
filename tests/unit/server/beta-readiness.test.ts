/* @vitest-environment node */
import { describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const script = path.resolve('scripts/beta/beta-50-student-readiness.mjs');
const fakeBackend = `
const sessions = new Map(), notes = new Map(), events = new Map(), claims = new Map(), firstSignals = new Map();
let signupCount = 0;
if (process.env.SLOW_REQUESTS) { let clock = 0; Object.defineProperty(globalThis, 'performance', { value: { now: () => (clock += 6001) } }); }
globalThis.fetch = async (url, options = {}) => {
  const request = new URL(url), body = options.body ? JSON.parse(options.body) : {};
  const headers = new Headers(options.headers || {}), cookie = headers.get('cookie') || '';
  const response = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });
  if (process.env.REQUIRE_BYPASS && headers.get('x-vercel-protection-bypass') !== 'fixture-bypass') return response({success:false}, 403);
  if (request.pathname === '/api/auth/signup') { if (body.role === 'student') signupCount++; if (process.env.FORCE_429 && body.email?.endsWith('-0@sql-adapt.test')) return response({success:false},429); return response({ success: true }, 201); }
  if (request.pathname === '/api/auth/login') {
    const user = body.email.includes('instructor') ? 'instructor' : body.email.split('@')[0];
    if (user !== 'instructor' && signupCount !== 50) return response({success:false}, 409);
    const h = new Headers({ 'content-type': 'application/json' });
    h.append('set-cookie', 'sql_adapt_auth=' + user + '; HttpOnly; Path=/');
    h.append('set-cookie', 'sql_adapt_csrf=fixture; Path=/');
    return new Response(JSON.stringify({ success: true, csrfToken: 'fixture' }), { status: 200, headers: h });
  }
  if (!cookie.includes('sql_adapt_auth=') || !cookie.includes('sql_adapt_csrf=fixture')) return response({ success: false }, 401);
  const auth = cookie.match(/sql_adapt_auth=([^;]+)/)[1];
  if (request.pathname === '/api/auth/me') {
    if (auth === 'instructor') return response({ success: true, user: { ownedSections: [{ studentSignupCode: 'class-code' }] } });
    return response({ success: true, user: { learnerId: process.env.MISSING_LEARNER ? '' : auth } });
  }
  if (options.method === 'POST' && headers.get('x-crf-token') && !headers.get('x-csrf-token')) return response({ success: false }, 403);
  if (options.method === 'POST' && headers.get('x-csrf-token') !== 'fixture') return response({ success: false }, 403);
  if (request.pathname.startsWith('/api/sessions/')) {
    if (options.method === 'POST') sessions.set(auth, body);
    return response({ success: true, data: process.env.BAD_READBACK && options.method === 'GET' ? null : sessions.get(auth) || null });
  }
  if (request.pathname === '/api/interactions' && options.method === 'POST') {
    if (body.learnerId !== auth || body.problemId !== 'problem-1') return response({success:false},400);
    if (!events.has(body.id)) { events.set(body.id, body); firstSignals.set(body.id, options.signal); claims.set(auth, (claims.get(auth) || 0) + 1); }
    else if (!firstSignals.get(body.id).aborted) return response({success:false},409);
    return response({ success: true }, 201);
  }
  if (request.pathname === '/api/interactions' && options.method === 'GET') return response({ success: true, data: [...events.values()].filter(x => x.learnerId === auth && x.sessionId === request.searchParams.get('sessionId')) });
  if (request.pathname.startsWith('/api/learners/')) {
    const user = decodeURIComponent(request.pathname.split('/')[3]);
    if (auth !== user) return response({ success: false }, 403);
    if (request.pathname.endsWith('/profile/events')) {
      if (!events.has(body.event?.eventId) || body.event.learnerId !== auth) return response({success:false},400);
      return response({success:true, data:{interactionCount: claims.get(auth)}});
    }
    return response({success:true, data:{ attemptsCount: (claims.get(auth) || 0) + (process.env.DUPLICATE_PROGRESS ? 1 : 0), solved:true }});
  }
  if (request.pathname === '/api/textbooks/' + auth + '/units' && options.method === 'POST' && body.unitId && body.type && body.title && body.content) {
    notes.set(auth, body); return response({ success: true, data: body }, 201);
  }
  if (request.pathname.startsWith('/api/textbooks/' + auth + '/units/')) return response({ success: true, data: notes.get(auth) });
  return response({ success: false }, 404);
};
process.argv = [process.argv[0], ${JSON.stringify(script)}, '--mode', 'local', '--api-base-url', 'http://127.0.0.1:3001', '--duration-ms', '20', '--interval-ms', '10'];
await import(${JSON.stringify(script)});
`;

function runFake(extra: Record<string, string> = {}) {
  const dir = mkdtempSync(path.join(tmpdir(), 'sql-adapt-harness-test-'));
  const credentials = path.join(dir, 'credentials.json');
  const result = spawnSync(process.execPath, ['--input-type=module', '-e', fakeBackend], {
    encoding: 'utf8', timeout: 30000,
    env: { ...process.env, INSTRUCTOR_SIGNUP_CODE: 'fixture', PILOT_CREDENTIALS_FILE: credentials, PILOT_INSTRUCTOR_EMAIL: '', PILOT_INSTRUCTOR_PASSWORD: '', PILOT_CLASS_CODE: '', VERCEL_AUTOMATION_BYPASS_SECRET: '', ...extra },
  });
  let saved: { mode: number; data: { students: unknown[]; classCode: string; instructor: { password: string } } } | undefined;
  try { saved = { mode: statSync(credentials).mode & 0o777, data: JSON.parse(readFileSync(credentials, 'utf8')) }; } catch { /* failure may precede creation */ }
  rmSync(dir, { recursive: true, force: true });
  return { result, saved };
}

describe('50-student readiness harness', () => {
  it('uses synchronized signup/login, retries idempotently, and keeps credentials private', () => {
    const { result, saved } = runFake();
    expect(result.status, result.stderr + result.stdout).toBe(1); // short tests cannot qualify
    expect(result.stdout).toMatch(/signup: requests=50 failures=0/);
    expect(result.stdout).toMatch(/login: requests=50 failures=0/);
    expect(result.stdout).toMatch(/event-response-interrupted: requests=100 failures=0/);
    expect(result.stdout).toMatch(/progress-retry: requests=100 failures=0/);
    expect(result.stdout).toMatch(/profile-write: requests=100 failures=0/);
    expect(result.stdout).toMatch(/cross-user-write-denied: requests=50 failures=0/);
    expect(result.stdout).toMatch(/Qualifying API run: false/);
    expect(result.stdout).toMatch(/p99=/);
    expect(saved?.mode).toBe(0o600);
    expect(saved?.data.students).toHaveLength(50);
    expect(saved?.data.classCode).toBe('class-code');
    expect(result.stdout + result.stderr).not.toContain('class-code');
    expect(result.stdout + result.stderr).not.toContain(saved?.data.instructor.password);
  });
  it('fails when learner identity is missing', () => {
    const { result } = runFake({ MISSING_LEARNER: '1' });
    expect(result.status).not.toBe(0);
    expect(result.stdout).toMatch(/Failure: Required student stage failed/);
  });
  it('fails when session readback is incorrect', () => {
    const { result } = runFake({ BAD_READBACK: '1' });
    expect(result.status).not.toBe(0);
    expect(result.stdout).toMatch(/Failure: Required student stage failed/);
  });
  it('detects duplicate progress increments', () => {
    const { result } = runFake({ DUPLICATE_PROGRESS: '1' });
    expect(result.status).not.toBe(0);
    expect(result.stdout).toMatch(/Failure: Required student stage failed/);
  });
  it('flags operations exceeding the p95 target', () => {
    const { result } = runFake({ SLOW_REQUESTS: '1' });
    expect(result.status).not.toBe(0);
    expect(result.stdout).toMatch(/p95 > 5000ms/);
  });
  it('reports rate-limit failures instead of qualifying', () => {
    const { result } = runFake({ FORCE_429: '1' });
    expect(result.status).not.toBe(0);
    expect(result.stdout).toMatch(/signup: requests=50 failures=1 429=1/);
  });
  it('supports an existing private instructor and protected preview headers', () => {
    const { result, saved } = runFake({ PILOT_INSTRUCTOR_EMAIL: 'existing-instructor@example.test', PILOT_INSTRUCTOR_PASSWORD: 'fixture-password', PILOT_CLASS_CODE: 'class-code', VERCEL_AUTOMATION_BYPASS_SECRET: 'fixture-bypass', REQUIRE_BYPASS: '1' });
    expect(result.stdout).toMatch(/signup: requests=50 failures=0/);
    expect(result.stdout).not.toContain('instructor-signup:');
    expect(result.stdout + result.stderr).not.toContain('fixture-password');
    expect(result.stdout + result.stderr).not.toContain('fixture-bypass');
    expect(saved?.mode).toBe(0o600);
    expect(saved?.data.instructor.password).toBe('fixture-password');
  });
  it('never treats successful public endpoints as a qualifying pilot', () => {
    const program = `globalThis.fetch = async () => new Response('{}', {status:200}); process.argv = [process.argv[0], ${JSON.stringify(script)}, '--mode', 'production']; await import(${JSON.stringify(script)});`;
    const result = spawnSync(process.execPath, ['--input-type=module', '-e', program], { encoding: 'utf8', timeout: 30000 });
    expect(result.status).not.toBe(0);
    expect(result.stdout).toMatch(/Qualifying API run: false \(public endpoints only\)/);
  });
  it('requires explicit mode and rejects production writes and secrets in arguments', () => {
    for (const args of [[], ['--mode', 'local', '--api-base-url', 'https://adaptive-instructional-artifacts-ap.vercel.app', '--acknowledge-isolated-test-target'], ['--mode', 'local', '--instructor-code', 'fixture']]) {
      const program = `globalThis.fetch = () => { throw new Error('unexpected request'); }; process.argv = [process.argv[0], ${JSON.stringify(script)}, ...${JSON.stringify(args)}]; await import(${JSON.stringify(script)});`;
      const result = spawnSync(process.execPath, ['--input-type=module', '-e', program], { encoding: 'utf8', timeout: 30000 });
      expect(result.status).not.toBe(0);
      expect(result.stderr).not.toContain('unexpected request');
    }
  });
});
