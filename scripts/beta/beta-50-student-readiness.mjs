#!/usr/bin/env node
/**
 * 50-Student Beta Readiness Load Test
 *
 * Produces explicit concurrent-use evidence for public production endpoints.
 * Can also run against a local backend when authenticated test credentials are available.
 *
 * Usage:
 *   npm run beta:50-student-readiness -- --mode production
 *   npm run beta:50-student-readiness -- --mode local --api-base-url http://127.0.0.1:3001
 * Authenticated runs require a new PILOT_CREDENTIALS_FILE inside the temporary
 * directory. Set INSTRUCTOR_SIGNUP_CODE or PILOT_INSTRUCTOR_EMAIL and
 * PILOT_INSTRUCTOR_PASSWORD; PILOT_CLASS_CODE can select an existing class.
 * Set VERCEL_AUTOMATION_BYPASS_SECRET when the preview is protected.
 * Remote authenticated targets require --acknowledge-isolated-test-target after
 * independently verifying their database is disposable and isolated from
 * production. The attestation is not proof of database isolation.
 * Authenticated runs also require PILOT_ISOLATED_TARGET=true; they simulate
 * survey callbacks using signed invitations, without contacting Qualtrics.
 * The qualifying API workload is 50 users for 300000ms at 60000ms intervals.
 * --duration-ms, --interval-ms and --users permit nonqualifying focused tests.
 */

const PRODUCTION_API_BASE_URL = 'https://adaptive-instructional-artifacts-ap.vercel.app';
const LOCAL_API_BASE_URL = 'http://127.0.0.1:3001';

const CONCURRENT_USERS = 50;
const ROUNDS = 3;
const REQUEST_TIMEOUT_MS = 15000;

function parseArgs() {
  const args = process.argv.slice(2);
  const mode = args.includes('--mode') ? args[args.indexOf('--mode') + 1] : '';
  const apiBaseUrl = args.includes('--api-base-url')
    ? args[args.indexOf('--api-base-url') + 1]
    : mode === 'production'
      ? PRODUCTION_API_BASE_URL
      : LOCAL_API_BASE_URL;
  if (args.includes('--instructor-code')) throw new Error('Set INSTRUCTOR_SIGNUP_CODE in the environment, not in command arguments');
  const instructorCode = process.env.INSTRUCTOR_SIGNUP_CODE || process.env.E2E_INSTRUCTOR_CODE || '';
  const users = args.includes('--users') ? Number(args[args.indexOf('--users') + 1]) : CONCURRENT_USERS;
  if (!Number.isInteger(users) || users < 1 || users > CONCURRENT_USERS) throw new Error('--users must be an integer from 1 to 50');
  const durationMs = args.includes('--duration-ms') ? Number(args[args.indexOf('--duration-ms') + 1]) : 300000;
  const intervalMs = args.includes('--interval-ms') ? Number(args[args.indexOf('--interval-ms') + 1]) : 60000;
  if (!Number.isInteger(durationMs) || durationMs < 1 || durationMs > 300000 || !Number.isInteger(intervalMs) || intervalMs < 1 || intervalMs > 300000) throw new Error('Invalid workload duration or interval');
  if (durationMs === 300000 && users !== 50) throw new Error('A qualifying workload requires exactly 50 users');
  return { mode, apiBaseUrl, instructorCode, users, durationMs, intervalMs, isolated: args.includes('--acknowledge-isolated-test-target') };
}

async function timedFetch(url, options = {}) {
  const start = performance.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const { interruptAfterHeaders, ...fetchOptions } = options;
    const headers = new Headers(fetchOptions.headers || {});
    if (process.env.VERCEL_AUTOMATION_BYPASS_SECRET) {
      headers.set('x-vercel-protection-bypass', process.env.VERCEL_AUTOMATION_BYPASS_SECRET);
      headers.set('x-vercel-set-bypass-cookie', 'true');
    }
    const response = await fetch(url, { ...fetchOptions, headers, redirect: 'manual', signal: controller.signal });
    if (interruptAfterHeaders && response.ok) {
      controller.abort();
      try { await response.body?.cancel(); } catch { /* abort may already close the body */ }
      return { ok: false, status: response.status, duration: performance.now() - start, bodyLength: 0, interrupted: true, error: null };
    }
    const body = await response.text();
    return {
      ok: response.ok,
      status: response.status,
      duration: performance.now() - start,
      bodyLength: body.length,
      body,
      headers: response.headers,
      error: null,
    };
  } catch (error) {
    const duration = performance.now() - start;
    return {
      ok: false,
      status: 0,
      duration,
      bodyLength: 0,
      error: error.message || 'Unknown error',
    };
  } finally {
    clearTimeout(timeout);
  }
}

function authDetails(result) {
  let data;
  try { data = JSON.parse(result.body || '{}'); } catch { data = {}; }
  const cookies = result.headers?.getSetCookie?.() ?? [];
  const parts = cookies.map((cookie) => cookie.split(';', 1)[0]);
  const auth = parts.find((cookie) => cookie.startsWith('sql_adapt_auth='));
  const csrf = parts.find((cookie) => cookie.startsWith('sql_adapt_csrf='));
  if (!result.ok || !data.success || !auth || !csrf || !data.csrfToken || csrf.slice('sql_adapt_csrf='.length) !== data.csrfToken) {
    throw new Error('Authentication did not provide required cookies and CSRF token');
  }
  return { cookie: `${auth}; ${csrf}`, csrf: data.csrfToken };
}

function jsonData(result) {
  if (!result.ok) throw new Error(`Required request failed with status ${result.status}`);
  let data;
  try { data = JSON.parse(result.body || '{}'); } catch { throw new Error('Required response is not valid JSON'); }
  if (data.success !== true) throw new Error('Required response did not indicate success');
  return data;
}

function validateTarget(mode, apiBaseUrl, isolated) {
  if (!['local', 'production'].includes(mode)) throw new Error('Specify --mode local or --mode production explicitly');
  const target = new URL(apiBaseUrl);
  if (target.username || target.password || target.search || target.hash || (target.pathname !== '/' && target.pathname !== '')) {
    throw new Error('API base URL must be an origin without credentials, path, query, or fragment');
  }
  const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(target.hostname);
  if (mode === 'local' && !loopback) {
    if (!isolated || target.protocol !== 'https:' || ['adaptive-instructional-artifacts-ap.vercel.app', 'adaptive-instructional-artifacts.vercel.app'].includes(target.hostname)) {
      throw new Error('Remote authenticated tests require HTTPS, a separately verified isolated preview, and --acknowledge-isolated-test-target; production hosts are prohibited');
    }
  }
  if (!['http:', 'https:'].includes(target.protocol)) throw new Error('Unsupported API protocol');
  return target.origin;
}

async function runConcurrent(url, options, count) {
  const promises = Array.from({ length: count }, () => timedFetch(url, options));
  return Promise.all(promises);
}

function percentile(sorted, p) {
  if (sorted.length === 0) return 0;
  const index = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, index)];
}

function summarize(label, results) {
  const durations = results.map((r) => r.duration).sort((a, b) => a - b);
  const errors = results.filter((r) => !r.ok);
  console.log(`\n--- ${label} ---`);
  console.log(`  Requests : ${results.length}`);
  console.log(`  Success  : ${results.length - errors.length}`);
  console.log(`  Errors   : ${errors.length}`);
  if (errors.length > 0) {
    const errorMap = new Map();
    errors.forEach((e) => {
      const key = `${e.status} ${e.error || ''}`.trim();
      errorMap.set(key, (errorMap.get(key) || 0) + 1);
    });
    for (const [key, count] of errorMap) {
      console.log(`    - ${key}: ${count}`);
    }
  }
  console.log(`  p50 (ms) : ${percentile(durations, 50).toFixed(2)}`);
  console.log(`  p95 (ms) : ${percentile(durations, 95).toFixed(2)}`);
  console.log(`  p99 (ms) : ${percentile(durations, 99).toFixed(2)}`);
  console.log(`  Min (ms) : ${durations[0]?.toFixed(2)}`);
  console.log(`  Max (ms) : ${durations[durations.length - 1]?.toFixed(2)}`);
  return { label, total: results.length, success: results.length - errors.length, errors: errors.length };
}

async function runProductionPublicLoadTest(apiBaseUrl, users) {
  console.log(`\n=====================================`);
  console.log(` 50-Student Beta Public Edge Load Test`);
  console.log(` Target  : ${apiBaseUrl}`);
  console.log(` Users   : ${users}`);
  console.log(` Rounds  : ${ROUNDS}`);
  console.log(`=====================================\n`);

  const overall = [];

  for (let round = 1; round <= ROUNDS; round++) {
    console.log(`\n[Round ${round}/${ROUNDS}]`);
    const healthResults = await runConcurrent(`${apiBaseUrl}/health`, { method: 'GET' }, users);
    const corpusResults = await runConcurrent(
      `${apiBaseUrl}/api/corpus/manifest`,
      { method: 'GET' },
      users,
    );
    overall.push(...healthResults, ...corpusResults);
    summarize(`Round ${round} - GET /health`, healthResults);
    summarize(`Round ${round} - GET /api/corpus/manifest`, corpusResults);
  }

  console.log(`\n=====================================`);
  console.log(` Overall Public Edge Summary`);
  console.log(`=====================================\n`);
  const allDurations = overall.map((r) => r.duration).sort((a, b) => a - b);
  const allErrors = overall.filter((r) => !r.ok);
  console.log(`  Total Requests : ${overall.length}`);
  console.log(`  Success        : ${overall.length - allErrors.length}`);
  console.log(`  Errors         : ${allErrors.length}`);
  console.log(`  p50 (ms)       : ${percentile(allDurations, 50).toFixed(2)}`);
  console.log(`  p95 (ms)       : ${percentile(allDurations, 95).toFixed(2)}`);
  console.log(`  p99 (ms)       : ${percentile(allDurations, 99).toFixed(2)}`);
  console.log(`  Max (ms)       : ${allDurations[allDurations.length - 1]?.toFixed(2)}`);
  console.log(`\n=====================================\n`);

  return {
    target: apiBaseUrl,
    concurrentUsers: users,
    rounds: ROUNDS,
    totalRequests: overall.length,
    success: overall.length - allErrors.length,
    errors: allErrors.length,
    p50: percentile(allDurations, 50),
    p95: percentile(allDurations, 95),
    p99: percentile(allDurations, 99),
    max: allDurations[allDurations.length - 1],
    timestamp: new Date().toISOString(),
  };
}

async function runLocalAuthenticatedFlow(apiBaseUrl, instructorCode, users, durationMs, intervalMs) {
  if (process.env.PILOT_ISOLATED_TARGET !== 'true') throw new Error('Set PILOT_ISOLATED_TARGET=true only after verifying an isolated test environment');
  const { randomBytes } = await import('node:crypto');
  const fs = await import('node:fs');
  const path = await import('node:path');
  const os = await import('node:os');
  const credentialPath = process.env.PILOT_CREDENTIALS_FILE;
  if (!credentialPath || !path.isAbsolute(credentialPath)) throw new Error('PILOT_CREDENTIALS_FILE must name a new absolute file in the temporary directory');
  const realParent = fs.realpathSync(path.dirname(credentialPath));
  const tempRoots = [fs.realpathSync(os.tmpdir()), fs.realpathSync('/tmp')];
  if (!tempRoots.some((root) => realParent === root || realParent.startsWith(root + path.sep))) throw new Error('PILOT_CREDENTIALS_FILE must be inside /tmp or the OS temporary directory');
  const targetPath = path.join(realParent, path.basename(credentialPath));
  const existingEmail = process.env.PILOT_INSTRUCTOR_EMAIL;
  const existingPassword = process.env.PILOT_INSTRUCTOR_PASSWORD;
  if (!!existingEmail !== !!existingPassword) throw new Error('Both PILOT_INSTRUCTOR_EMAIL and PILOT_INSTRUCTOR_PASSWORD are required together');
  if (!existingEmail && !instructorCode) throw new Error('Set INSTRUCTOR_SIGNUP_CODE or supply existing instructor credentials');
  const ts = Date.now();
  const suffix = randomBytes(4).toString('hex');
  const runId = `${ts}-${suffix}`;
  const instructor = { email: existingEmail || `loadtest-instructor-${runId}@sql-adapt.test`, password: existingPassword || `LoadTest!${randomBytes(24).toString('hex')}` };
  const students = Array.from({ length: users }, (_, i) => ({ email: `loadtest-student-${runId}-${i}@sql-adapt.test`, password: `LoadTest!${randomBytes(24).toString('hex')}` }));
  const credentials = { runId, target: apiBaseUrl, instructor, students };
  const fd = fs.openSync(targetPath, fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_NOFOLLOW, 0o600);
  try { fs.writeFileSync(fd, JSON.stringify(credentials, null, 2)); } finally { fs.closeSync(fd); }
  console.log(`Test run ID: ${runId}`);
  console.log('Credentials saved privately; keep the isolated database disposable.');
  console.log('API-only workload: browser, hint-provider, and real network interruption remain unverified.');
  const metrics = [];
  const startWall = performance.now();
  const request = async (name, route, options = {}, expectedStatus) => {
    const result = await timedFetch(`${apiBaseUrl}${route}`, options);
    const success = expectedStatus === undefined ? result.ok : result.status === expectedStatus;
    metrics.push({ name, status: result.status, duration: result.duration, success });
    if (!success) throw new Error(`${name} returned ${result.status}`);
    return result;
  };
  const post = (cookie, csrf, body) => ({ method: 'POST', headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}), ...(csrf ? { 'x-csrf-token': csrf } : {}) }, body: JSON.stringify(body) });
  const get = (cookie) => ({ method: 'GET', headers: { Cookie: cookie } });
  const safeStage = async (fn) => {
    const results = await Promise.allSettled(students.map(fn));
    if (results.some((item) => item.status === 'rejected')) throw new Error(`Required student stage failed (${results.filter((item) => item.status === 'rejected').length}/${users})`);
  };
  let failure = null;
  let cycles = 0;
  try {
    if (!existingEmail) jsonData(await request('instructor-signup', '/api/auth/signup', post(null, null, { name: 'LoadTest Instructor', ...instructor, role: 'instructor', instructorCode })));
    const instructorAuth = authDetails(await request('instructor-login', '/api/auth/login', post(null, null, instructor)));
    const instructorMe = jsonData(await request('instructor-me', '/api/auth/me', get(instructorAuth.cookie)));
    const classCode = process.env.PILOT_CLASS_CODE || instructorMe?.user?.ownedSections?.[0]?.studentSignupCode;
    if (!classCode) throw new Error('Instructor class code is unavailable');
    credentials.classCode = classCode;
    const updateFd = fs.openSync(targetPath, fs.constants.O_WRONLY | fs.constants.O_TRUNC | fs.constants.O_NOFOLLOW);
    try { fs.writeFileSync(updateFd, JSON.stringify(credentials, null, 2)); } finally { fs.closeSync(updateFd); }

    // Distinct barriers ensure all 50 signup requests precede every student login.
    await safeStage(async (student, i) => jsonData(await request('signup', '/api/auth/signup', post(null, null, { name: `LoadTest Student ${i}`, ...student, role: 'student', classCode }))));
    await safeStage(async (student) => { student.auth = authDetails(await request('login', '/api/auth/login', post(null, null, student))); });
    await safeStage(async (student) => {
      student.learnerId = jsonData(await request('me', '/api/auth/me', get(student.auth.cookie)))?.user?.learnerId;
      if (!student.learnerId) throw new Error('Student session is missing learnerId');
    });
    if (new Set(students.map((student) => student.learnerId)).size !== users) throw new Error('Learner IDs are not distinct');
    try {
      await safeStage(async (student) => {
        const assignment = jsonData(await request('condition-assignment', `/api/learners/${encodeURIComponent(student.learnerId)}/condition-assignment`, post(student.auth.cookie, student.auth.csrf, {}))).data;
        if (assignment?.userId !== student.learnerId || !['adaptive', 'control'].includes(assignment.conditionId)) throw new Error('Invalid condition assignment');
        student.conditionId = assignment.conditionId;
      });
    } catch {
      throw new Error('Condition assignment failed; confirm each student is enrolled in an eligible production-type section in the isolated test database');
    }
    await safeStage(async (student) => {
      const cookie = student.auth.cookie;
      const status = jsonData(await request('survey-status-before', '/api/surveys/status', get(cookie))).data;
      if (typeof status?.completed !== 'boolean') throw new Error('Invalid survey status');
      if (!status.completed) {
        const gate = await request('survey-gate', `/api/sessions/${encodeURIComponent(student.learnerId)}/active`, post(cookie, student.auth.csrf, {}), 403);
        if (JSON.parse(gate.body || '{}').code !== 'PRE_SURVEY_REQUIRED') throw new Error('Pre-survey gate was not enforced');
        const invitations = jsonData(await request('survey-invitations', '/api/surveys', get(cookie))).data;
        const invitation = Array.isArray(invitations) && invitations.find((item) => item.instance === 'pre' && item.status === 'pending');
        if (!invitation?.surveyUrl || !invitation.username) throw new Error('Signed pre-survey invitation unavailable');
        const survey = new URL(invitation.surveyUrl);
        const token = survey.searchParams.get('completion_token');
        if (!token || survey.searchParams.get('instance') !== 'pre' || survey.searchParams.get('username') !== invitation.username) throw new Error('Invalid signed pre-survey invitation');
        const params = new URLSearchParams({ instance: 'pre', username: invitation.username, completion_token: token, ResponseID: `pilot-${randomBytes(16).toString('hex')}` });
        const completion = await request('survey-completion', `/api/surveys/complete?${params}`, get(cookie), 302);
        const location = completion.headers?.get('location');
        if (!location || new URL(location, apiBaseUrl).pathname !== '/practice') throw new Error('Signed survey completion was rejected');
      }
      if (jsonData(await request('survey-status-after', '/api/surveys/status', get(cookie))).data?.completed !== true) throw new Error('Pre-survey completion did not persist');
    });
    await safeStage(async (student, i) => {
      const other = students[(i + 1) % users];
      if (other === student) return;
      const route = `/api/learners/${encodeURIComponent(other.learnerId)}/progress/problem-1`;
      await request('cross-user-read-denied', route, get(student.auth.cookie), 403);
      await request('cross-user-write-denied', route, post(student.auth.cookie, student.auth.csrf, { incrementAttempts: true }), 403);
    });
    const workloadStart = performance.now();
    const expectedCycles = Math.max(1, Math.ceil(durationMs / intervalMs));
    for (let cycle = 0; cycle < expectedCycles; cycle++) {
      const remaining = workloadStart + cycle * intervalMs - performance.now();
      if (remaining > 0) await new Promise((resolve) => setTimeout(resolve, remaining));
      await safeStage(async (student, i) => {
        const learner = encodeURIComponent(student.learnerId);
        const sessionId = `session-${runId}-${i}`;
        const eventId = `loadtest-${runId}-${i}-${cycle}`;
        const unitId = `loadtest-${runId}-${i}`;
        const code = 'SELECT * FROM users;';
        const auth = student.auth;
        const sessionRoute = `/api/sessions/${learner}/active`;
        const progressRoute = `/api/learners/${learner}/progress/problem-1`;
        const noteRoute = `/api/textbooks/${learner}/units`;
        const interaction = { id: eventId, learnerId: student.learnerId, sessionId, conditionId: student.conditionId, timestamp: new Date().toISOString(), eventType: 'execution', problemId: 'problem-1', code, successful: true, conceptIds: ['select-basic'], policyVersion: 'sql-engage-index-v3-hintid-contract' };
        jsonData(await request('session-save', sessionRoute, post(auth.cookie, auth.csrf, { sessionId, currentProblemId: 'problem-1', currentCode: code })));
        // Interrupt the first successful response after headers, then retry the
        // identical ID. The server already reported acceptance in its status.
        const interrupted = await request('event-response-interrupted', '/api/interactions', { ...post(auth.cookie, auth.csrf, interaction), interruptAfterHeaders: true }, 201);
        if (!interrupted.interrupted) throw new Error('Expected event response interruption did not occur');
        jsonData(await request('event-retry', '/api/interactions', post(auth.cookie, auth.csrf, interaction)));
        const progress = { eventId, solved: true, incrementAttempts: true, lastCode: code };
        jsonData(await request('progress-write', progressRoute, post(auth.cookie, auth.csrf, progress)));
        jsonData(await request('progress-retry', progressRoute, post(auth.cookie, auth.csrf, progress)));
        const profileEvent = { eventId, learnerId: student.learnerId, sessionId, timestamp: interaction.timestamp, eventType: 'execution', problemId: 'problem-1', code, successful: true, conceptIds: ['select-basic'], metadata: {} };
        jsonData(await request('profile-write', `/api/learners/${learner}/profile/events`, post(auth.cookie, auth.csrf, { event: profileEvent })));
        jsonData(await request('note-save', noteRoute, post(auth.cookie, auth.csrf, { unitId, type: 'summary', title: 'Load Test Note', content: 'Note content from load test', conceptIds: ['select-basic'] })));
        const session = jsonData(await request('session-read', sessionRoute, get(auth.cookie))).data;
        if (session?.currentProblemId !== 'problem-1' || session?.currentCode !== code) throw new Error('Saved session readback mismatch');
        const events = jsonData(await request('events-read', `/api/interactions?learnerId=${learner}&sessionId=${encodeURIComponent(sessionId)}&problemId=problem-1`, get(auth.cookie))).data;
        if (!Array.isArray(events) || events.length !== cycle + 1 || events.filter((event) => event.id === eventId).length !== 1) throw new Error('Persisted event count or identity mismatch');
        const savedProgress = jsonData(await request('progress-read', progressRoute, get(auth.cookie))).data;
        if (savedProgress?.attemptsCount !== cycle + 1 || savedProgress?.solved !== true) throw new Error('Persisted progress count mismatch');
        const note = jsonData(await request('note-read', `${noteRoute}/${encodeURIComponent(unitId)}`, get(auth.cookie))).data;
        if (note?.content !== 'Note content from load test') throw new Error('Saved note readback mismatch');
      });
      cycles++;
    }
    const remaining = workloadStart + durationMs - performance.now();
    if (remaining > 0) await new Promise((resolve) => setTimeout(resolve, remaining));
  } catch (error) {
    failure = error instanceof Error ? error.message : 'Required workload failed';
  }
  const wallMs = performance.now() - startWall;
  const byStep = {};
  for (const name of new Set(metrics.map((item) => item.name))) {
    const items = metrics.filter((item) => item.name === name);
    const times = items.map((item) => item.duration).sort((a, b) => a - b);
    byStep[name] = { requests: items.length, failures: items.filter((item) => !item.success).length, status429: items.filter((item) => item.status === 429).length, status5xx: items.filter((item) => item.status >= 500).length, p50: percentile(times, 50), p95: percentile(times, 95), p99: percentile(times, 99) };
    console.log(`${name}: requests=${items.length} failures=${byStep[name].failures} 429=${byStep[name].status429} 5xx=${byStep[name].status5xx} p50=${byStep[name].p50.toFixed(2)} p95=${byStep[name].p95.toFixed(2)} p99=${byStep[name].p99.toFixed(2)} ms`);
  }
  const slowSteps = Object.entries(byStep).filter(([, value]) => value.p95 > 5000).map(([name]) => name);
  const qualified = !failure && users === 50 && durationMs === 300000 && intervalMs === 60000 && cycles === 5 && slowSteps.length === 0;
  const conditionMix = { adaptive: students.filter((student) => student.conditionId === 'adaptive').length, control: students.filter((student) => student.conditionId === 'control').length };
  console.log(`Condition assignments: adaptive=${conditionMix.adaptive} control=${conditionMix.control}`);
  console.log(`Workload: users=${users} durationMs=${durationMs} intervalMs=${intervalMs} cycles=${cycles} wallMs=${wallMs.toFixed(2)} throughput=${(metrics.length * 1000 / wallMs).toFixed(2)} requests/s`);
  console.log(`Qualifying API run: ${qualified}`);
  if (failure) console.log(`Failure: ${failure}`);
  if (slowSteps.length) console.log(`p95 > 5000ms: ${slowSteps.join(', ')}`);
  return { target: apiBaseUrl, mode: 'local-authenticated', runId, concurrentUsers: users, durationMs, intervalMs, cycles, wallMs, throughput: metrics.length * 1000 / wallMs, conditionMix, byStep, failure, slowSteps, qualified, timestamp: new Date().toISOString() };
}

async function main() {
  const args = parseArgs();
  const { mode, instructorCode } = args;
  const apiBaseUrl = validateTarget(mode, args.apiBaseUrl, args.isolated);

  if (mode === 'production') {
    const report = await runProductionPublicLoadTest(apiBaseUrl, args.users);
    report.qualified = false;
    report.scope = 'public-edge-only';
    console.log('Qualifying API run: false (public endpoints only)');
    const outPath = `dist/beta/50-student-readiness/${Date.now()}-public-edge.json`;
    await import('fs').then((fs) => {
      fs.mkdirSync('dist/beta/50-student-readiness', { recursive: true });
      fs.writeFileSync(outPath, JSON.stringify(report, null, 2));
    });
    console.log(`Evidence written to: ${outPath}`);
    process.exit(1);
  }

  if (mode === 'local') {
    const report = await runLocalAuthenticatedFlow(apiBaseUrl, instructorCode, args.users, args.durationMs, args.intervalMs);
    const outPath = `dist/beta/50-student-readiness/${Date.now()}-local-auth.json`;
    await import('fs').then((fs) => {
      fs.mkdirSync('dist/beta/50-student-readiness', { recursive: true });
      fs.writeFileSync(outPath, JSON.stringify(report, null, 2));
    });
    console.log(`Evidence written to: ${outPath}`);
    process.exit(report.qualified ? 0 : 1);
  }

  console.error(`Unknown mode: ${mode}`);
  process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
