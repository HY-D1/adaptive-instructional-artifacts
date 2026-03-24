#!/usr/bin/env node
/**
 * Persistence Smoke Test
 *
 * Verifies end-to-end persistence against a real backend (Neon-backed API).
 * Exercises: create learner → save session → save interaction → save textbook unit
 *
 * Usage:
 *   node scripts/smoke-test-persistence.mjs [API_BASE_URL]
 *
 * The API_BASE_URL arg or VITE_API_BASE_URL env var must point to the backend
 * base URL (no trailing /api), e.g.:
 *   https://my-api.vercel.app
 *   http://localhost:3001
 *
 * Exit code 0 = all checks passed
 * Exit code 1 = one or more checks failed
 */

import { randomUUID } from 'crypto';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const BASE_URL = process.argv[2] || process.env.VITE_API_BASE_URL;

if (!BASE_URL) {
  console.error('ERROR: Provide API base URL as first arg or set VITE_API_BASE_URL');
  console.error('  node scripts/smoke-test-persistence.mjs https://my-api.vercel.app');
  process.exit(1);
}

const API = `${BASE_URL.replace(/\/$/, '')}/api`;
const SMOKE_LEARNER_ID = `smoke-${randomUUID().slice(0, 8)}`;
const SMOKE_SESSION_ID = `sess-smoke-${randomUUID().slice(0, 8)}`;
const SMOKE_PROBLEM_ID = 'smoke-problem-1';

// ---------------------------------------------------------------------------
// HTTP helper
// ---------------------------------------------------------------------------

async function req(method, path, body) {
  const url = `${API}${path}`;
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json' },
  };
  if (body !== undefined) opts.body = JSON.stringify(body);

  let res;
  try {
    res = await fetch(url, opts);
  } catch (err) {
    throw new Error(`Network error calling ${method} ${url}: ${err.message}`);
  }

  let data;
  try {
    data = await res.json();
  } catch {
    throw new Error(`Non-JSON response from ${method} ${url}: HTTP ${res.status}`);
  }

  return { status: res.status, ok: res.ok, data };
}

// ---------------------------------------------------------------------------
// Individual checks
// ---------------------------------------------------------------------------

const results = [];

function pass(name, detail = '') {
  results.push({ name, ok: true, detail });
  console.log(`  ✅ ${name}${detail ? `: ${detail}` : ''}`);
}

function fail(name, detail = '') {
  results.push({ name, ok: false, detail });
  console.error(`  ❌ ${name}${detail ? `: ${detail}` : ''}`);
}

// ---------------------------------------------------------------------------
// Step 0: persistence-status diagnostic (printed before any writes)
// ---------------------------------------------------------------------------

async function checkPersistenceStatus() {
  console.log('\n[0/6] Persistence diagnostic');
  let ok = false, data = {};
  try {
    const result = await req('GET', '/system/persistence-status');
    ok = result.ok;
    data = result.data;
  } catch {
    console.warn('  ⚠️  /api/system/persistence-status not reachable — backend may be offline');
    return;
  }

  if (ok) {
    const { dbMode, resolvedEnvSource, persistenceRoutesEnabled } = data;
    console.log(`  🔍 backend reachable:          true`);
    console.log(`  🔍 db mode:                    ${dbMode}`);
    console.log(`  🔍 resolved env source:        ${resolvedEnvSource ?? '(none — falling back to sqlite)'}`);
    console.log(`  🔍 persistence routes enabled: ${persistenceRoutesEnabled}`);

    if (dbMode !== 'neon') {
      console.warn('  ⚠️  WARNING: backend is NOT using Neon. Writes will go to SQLite (ephemeral on serverless).');
    } else {
      pass('persistence mode', `db=neon, env=${resolvedEnvSource}`);
    }
  } else {
    console.warn(`  ⚠️  /api/system/persistence-status returned non-OK: ${JSON.stringify(data)}`);
  }
}

// ---------------------------------------------------------------------------
// Step 1: backend health
// ---------------------------------------------------------------------------

async function checkHealth() {
  console.log('\n[1/6] Backend health check');
  const { ok, status, data } = await req('GET', '/../health');
  if (ok) {
    const dbInfo = data?.db ? ` db=${data.db.mode} src=${data.db.envSource}` : '';
    pass('health endpoint', `HTTP ${status}${dbInfo}`);
  } else {
    // Some deployments don't expose /health — treat as warning not fatal
    console.warn(`  ⚠️  /health returned ${status} — continuing`);
  }
}

// ---------------------------------------------------------------------------
// Step 2: create learner
// ---------------------------------------------------------------------------

async function createLearner() {
  console.log('\n[2/6] Create learner');
  const { ok, status, data } = await req('POST', '/learners', {
    id: SMOKE_LEARNER_ID,
    name: 'Smoke Test Learner',
    role: 'student',
  });

  if (ok && data?.success) {
    pass('create learner', `id=${SMOKE_LEARNER_ID}`);
  } else if (status === 409) {
    pass('create learner (already exists)', `id=${SMOKE_LEARNER_ID}`);
  } else {
    fail('create learner', `HTTP ${status}: ${JSON.stringify(data)}`);
  }
}

// ---------------------------------------------------------------------------
// Step 3: verify learner can be retrieved
// ---------------------------------------------------------------------------

async function getLearner() {
  console.log('\n[3/6] Retrieve learner');
  const { ok, status, data } = await req('GET', `/learners/${SMOKE_LEARNER_ID}`);

  if (ok && data?.data?.id === SMOKE_LEARNER_ID) {
    pass('get learner', `name="${data.data.name}"`);
  } else {
    fail('get learner', `HTTP ${status}: ${JSON.stringify(data)}`);
  }
}

// ---------------------------------------------------------------------------
// Step 4: save session
// ---------------------------------------------------------------------------

async function saveSession() {
  console.log('\n[4/6] Save session');
  const { ok, status, data } = await req('POST', `/sessions/${SMOKE_LEARNER_ID}/active`, {
    startTime: new Date().toISOString(),
    lastActivity: new Date().toISOString(),
    currentProblemId: SMOKE_PROBLEM_ID,
  });

  if (ok) {
    pass('save session', `learnerId=${SMOKE_LEARNER_ID}`);
  } else {
    fail('save session', `HTTP ${status}: ${JSON.stringify(data)}`);
  }
}

// ---------------------------------------------------------------------------
// Step 5: save interaction (condition_assigned — canonical session-init event)
// ---------------------------------------------------------------------------

async function saveInteraction() {
  console.log('\n[5/6] Save interaction (condition_assigned)');
  const interactionId = `smoke-int-${randomUUID().slice(0, 8)}`;
  const { ok, status, data } = await req('POST', '/interactions', {
    id: interactionId,
    learnerId: SMOKE_LEARNER_ID,
    sessionId: SMOKE_SESSION_ID,
    timestamp: new Date().toISOString(),
    eventType: 'condition_assigned',
    problemId: SMOKE_PROBLEM_ID,
    conditionId: 'adaptive',
    strategyAssigned: 'adaptive',
    policyVersion: 'smoke-test-v1',
  });

  if (ok && data?.success) {
    pass('save interaction', `id=${interactionId}, eventType=condition_assigned`);
  } else {
    fail('save interaction', `HTTP ${status}: ${JSON.stringify(data)}`);
  }
}

// ---------------------------------------------------------------------------
// Step 6: save textbook unit
// ---------------------------------------------------------------------------

async function saveTextbookUnit() {
  console.log('\n[6/6] Save textbook unit');
  const unitId = `smoke-unit-${randomUUID().slice(0, 8)}`;
  const { ok, status, data } = await req('POST', `/textbooks/${SMOKE_LEARNER_ID}/units`, {
    unitId,
    type: 'explanation',
    conceptIds: ['smoke-concept-1'],
    title: 'Smoke Test Unit',
    content: 'This unit was created by the persistence smoke test.',
    contentFormat: 'markdown',
    sourceInteractionIds: [],
    status: 'primary',
  });

  if (ok && data?.success) {
    pass('save textbook unit', `unitId=${unitId}`);
  } else {
    fail('save textbook unit', `HTTP ${status}: ${JSON.stringify(data)}`);
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

console.log(`\nPersistence Smoke Test`);
console.log(`API: ${API}`);
console.log(`Learner: ${SMOKE_LEARNER_ID}`);

try {
  await checkPersistenceStatus();
  await checkHealth();
  await createLearner();
  await getLearner();
  await saveSession();
  await saveInteraction();
  await saveTextbookUnit();
} catch (err) {
  console.error('\nFATAL:', err.message);
  process.exit(1);
}

const passed = results.filter(r => r.ok).length;
const failed = results.filter(r => !r.ok).length;

console.log(`\nResults: ${passed} passed, ${failed} failed`);

if (failed > 0) {
  console.error('\nFailed checks:');
  results.filter(r => !r.ok).forEach(r => console.error(`  - ${r.name}: ${r.detail}`));
  process.exit(1);
} else {
  console.log('\nAll persistence checks passed ✅');
  console.log(`\nExample persisted entities:`);
  console.log(`  Learner:        ${SMOKE_LEARNER_ID} (name="Smoke Test Learner", role=student)`);
  console.log(`  Session:        active session for ${SMOKE_LEARNER_ID}`);
  console.log(`  Interaction:    eventType=condition_assigned, conditionId=adaptive`);
  console.log(`  Textbook unit:  type=explanation, conceptIds=[smoke-concept-1]`);
  process.exit(0);
}
