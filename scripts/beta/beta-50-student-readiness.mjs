#!/usr/bin/env node
/**
 * 50-Student Beta Readiness Load Test
 *
 * Produces explicit concurrent-use evidence for public production endpoints.
 * Can also run against a local backend when authenticated test credentials are available.
 *
 * Usage:
 *   node scripts/beta-50-student-readiness.mjs
 *   node scripts/beta-50-student-readiness.mjs --mode local --api-base-url http://127.0.0.1:3001 --instructor-code TeachSQL2024
 */

const PRODUCTION_API_BASE_URL = 'https://adaptive-instructional-artifacts-ap.vercel.app';
const LOCAL_API_BASE_URL = 'http://127.0.0.1:3001';

const CONCURRENT_USERS = 50;
const ROUNDS = 3;
const REQUEST_TIMEOUT_MS = 15000;

function parseArgs() {
  const args = process.argv.slice(2);
  const mode = args.includes('--mode') ? args[args.indexOf('--mode') + 1] : 'production';
  const apiBaseUrl = args.includes('--api-base-url')
    ? args[args.indexOf('--api-base-url') + 1]
    : mode === 'production'
      ? PRODUCTION_API_BASE_URL
      : LOCAL_API_BASE_URL;
  const instructorCode = args.includes('--instructor-code')
    ? args[args.indexOf('--instructor-code') + 1]
    : process.env.INSTRUCTOR_SIGNUP_CODE || process.env.E2E_INSTRUCTOR_CODE || '';
  return { mode, apiBaseUrl, instructorCode };
}

async function timedFetch(url, options = {}) {
  const start = performance.now();
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    const response = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(timeout);
    const duration = performance.now() - start;
    const body = await response.text();
    return {
      ok: response.ok,
      status: response.status,
      duration,
      bodyLength: body.length,
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
  }
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

async function runProductionPublicLoadTest(apiBaseUrl) {
  console.log(`\n=====================================`);
  console.log(` 50-Student Beta Public Edge Load Test`);
  console.log(` Target  : ${apiBaseUrl}`);
  console.log(` Users   : ${CONCURRENT_USERS}`);
  console.log(` Rounds  : ${ROUNDS}`);
  console.log(`=====================================\n`);

  const overall = [];

  for (let round = 1; round <= ROUNDS; round++) {
    console.log(`\n[Round ${round}/${ROUNDS}]`);
    const healthResults = await runConcurrent(`${apiBaseUrl}/health`, { method: 'GET' }, CONCURRENT_USERS);
    const corpusResults = await runConcurrent(
      `${apiBaseUrl}/api/corpus/manifest`,
      { method: 'GET' },
      CONCURRENT_USERS,
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
    concurrentUsers: CONCURRENT_USERS,
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

async function runLocalAuthenticatedFlow(apiBaseUrl, instructorCode) {
  console.log(`\n=====================================`);
  console.log(` 50-Student Beta Authenticated Flow Simulation`);
  console.log(` Target  : ${apiBaseUrl}`);
  console.log(` Users   : ${CONCURRENT_USERS}`);
  console.log(`=====================================\n`);

  if (!instructorCode) {
    console.error('ERROR: --instructor-code is required for local authenticated flow mode.');
    console.error('Provide the backend INSTRUCTOR_SIGNUP_CODE to create test accounts.');
    process.exit(1);
  }

  // 1. Create a single instructor to get a class code
  const ts = Date.now();
  const instructorEmail = `loadtest-instructor-${ts}@sql-adapt.test`;
  const instructorPassword = 'LoadTestInstr!123';

  const instructorSignupRes = await timedFetch(`${apiBaseUrl}/api/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'LoadTest Instructor',
      email: instructorEmail,
      password: instructorPassword,
      role: 'instructor',
      instructorCode,
    }),
  });

  if (!instructorSignupRes.ok) {
    console.log(`Instructor signup: ${instructorSignupRes.status} (may already exist)`);
  }

  // Login instructor to get cookie
  const instructorLoginRes = await timedFetch(`${apiBaseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: instructorEmail, password: instructorPassword }),
  });

  if (!instructorLoginRes.ok) {
    console.error('ERROR: Could not log in instructor account for class-code provisioning.');
    console.error(`Status: ${instructorLoginRes.status}, Error: ${instructorLoginRes.error}`);
    process.exit(1);
  }

  // Extract cookie
  const setCookieRaw = instructorLoginRes.headers?.get?.('set-cookie') || '';
  const authCookie = setCookieRaw.split(';')[0]?.trim() || '';

  // Get instructor profile with class code
  const meRes = await timedFetch(`${apiBaseUrl}/api/auth/me`, {
    method: 'GET',
    headers: authCookie ? { Cookie: authCookie } : {},
  });

  let classCode = '';
  try {
    const meBody = JSON.parse(meRes.ok ? await (await fetch(`${apiBaseUrl}/api/auth/me`, { headers: authCookie ? { Cookie: authCookie } : {} })).text() : '{}');
    classCode = meBody?.user?.ownedSections?.[0]?.studentSignupCode || '';
  } catch {
    // ignored
  }

  if (!classCode) {
    console.error('ERROR: Could not obtain student class code from instructor account.');
    process.exit(1);
  }

  console.log(`Class code obtained: ${classCode}`);

  // 2. Concurrent student lifecycle simulation
  const studentResults = await Promise.all(
    Array.from({ length: CONCURRENT_USERS }, async (_, i) => {
      const email = `loadtest-student-${ts}-${i}@sql-adapt.test`;
      const password = 'LoadTestStudent!123';
      const start = performance.now();
      const steps = [];

      try {
        // Step 1: Signup
        const signup = await timedFetch(`${apiBaseUrl}/api/auth/signup`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: `LoadTest Student ${i}`,
            email,
            password,
            role: 'student',
            classCode,
          }),
        });
        steps.push({ name: 'signup', ...signup });

        // Step 2: Login
        const login = await timedFetch(`${apiBaseUrl}/api/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password }),
        });
        steps.push({ name: 'login', ...login });

        const cookie = login.headers?.get?.('set-cookie')?.split(';')[0]?.trim() || '';
        const csrf = (() => {
          try {
            const b = JSON.parse(login.body || '{}');
            return b.csrfToken || '';
          } catch {
            return '';
          }
        })();

        // Step 3: /me (resume check)
        const me2 = await timedFetch(`${apiBaseUrl}/api/auth/me`, {
          method: 'GET',
          headers: cookie ? { Cookie: cookie } : {},
        });
        steps.push({ name: 'me', ...me2 });

        // We need learnerId for subsequent Neon routes
        let learnerId = '';
        try {
          const meText = await (await fetch(`${apiBaseUrl}/api/auth/me`, {
            headers: cookie ? { Cookie: cookie } : {},
          })).text();
          const meJson = JSON.parse(meText);
          learnerId = meJson?.user?.learnerId || '';
        } catch {
          // ignored
        }

        if (learnerId) {
          // Step 4: Save session (learning page open / resume)
          const sessionSave = await timedFetch(`${apiBaseUrl}/api/sessions/${encodeURIComponent(learnerId)}/active`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(cookie ? { Cookie: cookie } : {}),
              ...(csrf ? { 'x-csrf-token': csrf } : {}),
            },
            body: JSON.stringify({
              currentProblemId: 'sql-1',
              currentCode: 'SELECT * FROM employees;',
            }),
          });
          steps.push({ name: 'session-save', ...sessionSave });

          // Step 5: Write interaction (hint request)
          const interaction = await timedFetch(`${apiBaseUrl}/api/interactions`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(cookie ? { Cookie: cookie } : {}),
              ...(csrf ? { 'x-csrf-token': csrf } : {}),
            },
            body: JSON.stringify({
              eventType: 'hint_view',
              problemId: 'sql-1',
              sessionId: `session-${learnerId}`,
              timestamp: Date.now(),
            }),
          });
          steps.push({ name: 'interaction-write', ...interaction });

          // Step 6: Save textbook unit (save-to-notes)
          const textbook = await timedFetch(`${apiBaseUrl}/api/textbooks`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(cookie ? { Cookie: cookie } : {}),
              ...(csrf ? { 'x-csrf-token': csrf } : {}),
            },
            body: JSON.stringify({
              title: 'Load Test Note',
              content: 'Note content from load test',
              conceptIds: ['where-clause'],
            }),
          });
          steps.push({ name: 'textbook-save', ...textbook });

          // Step 7: Refresh / resume (GET active session)
          const sessionGet = await timedFetch(`${apiBaseUrl}/api/sessions/${encodeURIComponent(learnerId)}/active`, {
            method: 'GET',
            headers: cookie ? { Cookie: cookie } : {},
          });
          steps.push({ name: 'session-get', ...sessionGet });
        }

        const totalDuration = performance.now() - start;
        const failed = steps.filter((s) => !s.ok).length;
        return { index: i, steps, totalDuration, failed, success: failed === 0 };
      } catch (error) {
        return { index: i, steps, totalDuration: performance.now() - start, failed: 1, success: false, error: error.message };
      }
    }),
  );

  // Summarize
  const successfulStudents = studentResults.filter((r) => r.success).length;
  const totalSteps = studentResults.reduce((sum, r) => sum + r.steps.length, 0);
  const failedSteps = studentResults.reduce((sum, r) => sum + r.failed, 0);
  const durations = studentResults.map((r) => r.totalDuration).sort((a, b) => a - b);

  console.log(`\n--- Authenticated Flow Summary ---`);
  console.log(`  Students simulated : ${CONCURRENT_USERS}`);
  console.log(`  Full success       : ${successfulStudents}`);
  console.log(`  Any step failed    : ${CONCURRENT_USERS - successfulStudents}`);
  console.log(`  Total steps        : ${totalSteps}`);
  console.log(`  Failed steps       : ${failedSteps}`);
  console.log(`  p50 duration (ms)  : ${percentile(durations, 50).toFixed(2)}`);
  console.log(`  p95 duration (ms)  : ${percentile(durations, 95).toFixed(2)}`);
  console.log(`  p99 duration (ms)  : ${percentile(durations, 99).toFixed(2)}`);
  console.log(`  Max duration (ms)  : ${durations[durations.length - 1]?.toFixed(2)}`);

  // Per-step breakdown
  const stepNames = [...new Set(studentResults.flatMap((r) => r.steps.map((s) => s.name)))];
  for (const stepName of stepNames) {
    const stepResults = studentResults.flatMap((r) => r.steps.filter((s) => s.name === stepName));
    const stepDurations = stepResults.map((s) => s.duration).sort((a, b) => a - b);
    const stepErrors = stepResults.filter((s) => !s.ok);
    console.log(`\n  [${stepName}]`);
    console.log(`    Requests : ${stepResults.length}`);
    console.log(`    Success  : ${stepResults.length - stepErrors.length}`);
    console.log(`    Errors   : ${stepErrors.length}`);
    if (stepErrors.length > 0) {
      const errorMap = new Map();
      stepErrors.forEach((e) => {
        const key = `${e.status} ${e.error || ''}`.trim();
        errorMap.set(key, (errorMap.get(key) || 0) + 1);
      });
      for (const [key, count] of errorMap) {
        console.log(`      - ${key}: ${count}`);
      }
    }
    console.log(`    p50 (ms) : ${percentile(stepDurations, 50).toFixed(2)}`);
    console.log(`    p95 (ms) : ${percentile(stepDurations, 95).toFixed(2)}`);
  }

  console.log(`\n=====================================\n`);

  return {
    target: apiBaseUrl,
    mode: 'local-authenticated',
    concurrentUsers: CONCURRENT_USERS,
    fullSuccess: successfulStudents,
    failedStudents: CONCURRENT_USERS - successfulStudents,
    totalSteps,
    failedSteps,
    p50: percentile(durations, 50),
    p95: percentile(durations, 95),
    p99: percentile(durations, 99),
    max: durations[durations.length - 1],
    timestamp: new Date().toISOString(),
  };
}

async function main() {
  const { mode, apiBaseUrl, instructorCode } = parseArgs();

  if (mode === 'production') {
    const report = await runProductionPublicLoadTest(apiBaseUrl);
    const outPath = `dist/beta/50-student-readiness/${Date.now()}-public-edge.json`;
    await import('fs').then((fs) => {
      fs.mkdirSync('dist/beta/50-student-readiness', { recursive: true });
      fs.writeFileSync(outPath, JSON.stringify(report, null, 2));
    });
    console.log(`Evidence written to: ${outPath}`);
    process.exit(report.errors > 0 ? 1 : 0);
  }

  if (mode === 'local') {
    const report = await runLocalAuthenticatedFlow(apiBaseUrl, instructorCode);
    const outPath = `dist/beta/50-student-readiness/${Date.now()}-local-auth.json`;
    await import('fs').then((fs) => {
      fs.mkdirSync('dist/beta/50-student-readiness', { recursive: true });
      fs.writeFileSync(outPath, JSON.stringify(report, null, 2));
    });
    console.log(`Evidence written to: ${outPath}`);
    process.exit(report.failedStudents > 0 ? 1 : 0);
  }

  console.error(`Unknown mode: ${mode}`);
  process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
