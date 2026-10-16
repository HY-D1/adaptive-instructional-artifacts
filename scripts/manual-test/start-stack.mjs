import { spawn } from 'node:child_process';
import { createWriteStream, mkdirSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { randomBytes } from 'node:crypto';

const require = createRequire(import.meta.url);
const dotenv = require('../../apps/server/node_modules/dotenv');
const args = new Set(process.argv.slice(2));
const showHelp = args.has('--help') || args.has('-h');
const realSurveys = args.has('--real-surveys');
const unknownArgs = [...args].filter((arg) => !['--help', '-h', '--real-surveys'].includes(arg));

if (showHelp) {
  console.log('Usage: node scripts/manual-test/start-stack.mjs [--real-surveys]');
  console.log('  --real-surveys  Use Qualtrics settings from apps/server/.env.local; otherwise use the local fake survey.');
  process.exit(0);
}

if (unknownArgs.length > 0) {
  throw new Error(`Unknown option: ${unknownArgs[0]}`);
}

const envText = readFileSync(new URL('../../apps/server/.env.local', import.meta.url), 'utf8');
const env = dotenv.parse(envText);
const testUrl = env.SCHEMA_TEST_DATABASE_URL;
const endpoint = testUrl ? new URL(testUrl).hostname : '';

if (!testUrl) {
  throw new Error('SCHEMA_TEST_DATABASE_URL is empty; refusing to start the manual stack');
}
if (!endpoint.includes('ep-royal-meadow')) {
  throw new Error(`Refusing to start manual stack outside ep-royal-meadow: ${endpoint}`);
}

if (realSurveys) {
  for (const key of [
    'QUALTRICS_PRE_SURVEY_URL',
    'QUALTRICS_POST_SURVEY_URL',
  ]) {
    if (!env[key]?.trim()) {
      throw new Error(`${key} is empty; refusing to start real-survey mode`);
    }
  }
}

const children = [];
let shuttingDown = false;
const PROJECT_ROOT = fileURLToPath(new URL('../..', import.meta.url));
const LOG_DIR = resolve(PROJECT_ROOT, '.local', 'manual-test');
mkdirSync(LOG_DIR, { recursive: true });
const API_LOG_PATH = resolve(LOG_DIR, 'api.log');
const WEB_LOG_PATH = resolve(LOG_DIR, 'web.log');
const SURVEY_STUB_LOG_PATH = resolve(LOG_DIR, 'survey-stub.log');

function spawnDetached(command, args, options = {}) {
  const { env: extraEnv = {}, logPath } = options;
  const child = spawn(command, args, {
    cwd: new URL('../..', import.meta.url),
    env: {
      ...process.env,
      ...env,
      DATABASE_URL: testUrl,
      AUTO_SCHEMA_INIT: 'true',
      PORT: '3316',
      QUALTRICS_COMPLETION_SIGNING_SECRET: env.QUALTRICS_COMPLETION_SIGNING_SECRET?.trim()
        || randomBytes(32).toString('hex'),
      QUALTRICS_PRE_SURVEY_URL: realSurveys
        ? env.QUALTRICS_PRE_SURVEY_URL
        : 'http://localhost:4320/survey?instance=pre',
      QUALTRICS_POST_SURVEY_URL: realSurveys
        ? env.QUALTRICS_POST_SURVEY_URL
        : 'http://localhost:4320/survey?instance=post',
      CORS_ORIGIN: 'http://localhost:4316',
      WEB_APP_BASE_URL: 'http://localhost:4316',
      VITE_API_BASE_URL: 'http://localhost:3316',
      ...extraEnv,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: true,
  });
  if (logPath) {
    const logStream = createWriteStream(logPath, { flags: 'w' });
    child.stdout.pipe(logStream);
    child.stderr.pipe(logStream);
    child.on('close', () => logStream.end());
  }
  children.push(child);
  return child;
}

const api = spawnDetached('node', ['apps/server/dist/index.js'], { logPath: API_LOG_PATH });
const stubCode = `import http from 'node:http';
http.createServer((req, res) => {
  const incoming = new URL(req.url, 'http://localhost:4320');
  if (incoming.pathname !== '/survey') { res.writeHead(404); res.end(); return; }
  const callback = new URL('http://localhost:3316/api/surveys/complete');
  for (const field of ['instance', 'username', 'completion_token']) {
    const value = incoming.searchParams.get(field);
    if (value) callback.searchParams.set(field, value);
  }
  callback.searchParams.set('ResponseID', 'manual-stub-' + Date.now());
  res.writeHead(302, { Location: callback.toString() });
  res.end();
}).listen(4320, 'localhost');`;
const stub = realSurveys
  ? null
  : spawnDetached('node', ['--input-type=module', '-e', stubCode], { logPath: SURVEY_STUB_LOG_PATH });
const web = spawnDetached('npm', ['run', 'dev', '--', '--host', 'localhost', '--port', '4316'], {
  env: { VITE_API_BASE_URL: 'http://localhost:3316' },
  logPath: WEB_LOG_PATH,
});

function stopAll() {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const child of children) {
    if (!child.killed && child.pid) {
      try {
        process.kill(-child.pid, 'SIGTERM');
      } catch {
        child.kill('SIGTERM');
      }
    }
  }
}

process.on('SIGINT', () => {
  stopAll();
  process.exit(0);
});
process.on('SIGTERM', () => {
  stopAll();
  process.exit(0);
});

function waitFor(child, matcher, label) {
  return new Promise((resolve, reject) => {
    let output = '';
    const timer = setTimeout(() => reject(new Error(`${label} did not start`)), 30000);
    child.stdout.on('data', (chunk) => {
      output += chunk.toString();
      if (matcher(output)) {
        clearTimeout(timer);
        resolve();
      }
    });
    child.stderr.on('data', (chunk) => {
      output += chunk.toString();
    });
    child.on('exit', (code) => {
      if (!shuttingDown && code !== 0) {
        clearTimeout(timer);
        reject(new Error(`${label} exited before startup`));
      }
    });
  });
}

async function waitForHttp(url, label) {
  const deadline = Date.now() + 30000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url, { redirect: 'manual' });
      if (response.status > 0) return;
    } catch {
      // Child process is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`${label} did not respond`);
}

try {
  await waitFor(api, (output) => output.includes('Server running on http://localhost:3316'), 'API');
  const health = await fetch('http://localhost:3316/health');
  const healthBody = await health.json();
  if (!health.ok || healthBody.db?.mode !== 'neon') {
    throw new Error('API health check did not report Neon; manual stack refused to continue');
  }
  if (!realSurveys) {
    await waitForHttp('http://localhost:4320/survey?instance=pre', 'Survey stub');
  }
  await waitForHttp('http://localhost:4316/', 'Web app');
  console.log(`API log: ${API_LOG_PATH}`);
  console.log(`Web log: ${WEB_LOG_PATH}`);
  if (!realSurveys) console.log(`Survey stub log: ${SURVEY_STUB_LOG_PATH}`);
} catch (error) {
  stopAll();
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}

await new Promise(() => {});
