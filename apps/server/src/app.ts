/**
 * SQL-Adapt Backend API App
 * Creates the Express app without binding to a port.
 */

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import fs from 'fs';

import { initializeSchema, closeDb } from './db/index.js';
import { learnersRouter } from './routes/learners.js';
import { interactionsRouter } from './routes/interactions.js';
import { textbooksRouter } from './routes/textbooks.js';
import { sessionsRouter } from './routes/sessions.js';
import { researchRouter } from './routes/research.js';
import { pdfIndexRouter } from './routes/pdf-index.js';
import { llmRouter } from './routes/llm.js';
import { neonLearnersRouter } from './routes/neon-learners.js';
import { neonInteractionsRouter } from './routes/neon-interactions.js';
import { neonTextbooksRouter } from './routes/neon-textbooks.js';
import { neonSessionsRouter } from './routes/neon-sessions.js';
import { authRouter } from './routes/auth.js';
import { instructorRouter } from './routes/instructor.js';
import { corpusRouter } from './routes/corpus.js';
import {
  ENABLE_LLM,
  CORS_ORIGIN_PATTERNS,
  CORS_ORIGINS,
  getFeatureStatus,
  OLLAMA_BASE_URL,
} from './config.js';
import { isUsingNeon } from './db/index.js';
import { resolveDbEnv, resolveEnvironment, resolveDbTarget } from './db/env-resolver.js';
import { optionalAuth, requireAuth, requireInstructor } from './middleware/auth.js';
import { requireCsrf } from './middleware/csrf.js';
import { generalApiLimiter, researchRateLimiter } from './middleware/rate-limit.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.resolve(__dirname, '../.env');
dotenv.config({ path: envPath });

const DATA_DIR = path.resolve(__dirname, '../data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

export const RESEARCH_CONTRACT_VERSION = 'v2.2.0';

let schemaInitPromise: Promise<void> | null = null;

export function ensureSchemaInitialized(): Promise<void> {
  if (!schemaInitPromise) {
    schemaInitPromise = initializeSchema().catch(async (error) => {
      schemaInitPromise = null;
      await closeDb();
      throw error;
    });
  }
  return schemaInitPromise;
}

function isAllowedOrigin(origin: string): boolean {
  if (!isValidOrigin(origin)) {
    return false;
  }

  const normalizedOrigin = normalizeOrigin(origin);
  if (CORS_ORIGINS.includes(normalizedOrigin)) {
    return true;
  }

  return CORS_ORIGIN_REGEXPS.some((pattern) => pattern.test(normalizedOrigin));
}

function normalizeOrigin(origin: string): string {
  return origin.replace(/\/+$/, '');
}

function isValidOrigin(origin: string): boolean {
  try {
    const parsed = new URL(origin);
    return (parsed.protocol === 'http:' || parsed.protocol === 'https:') && parsed.origin === origin;
  } catch {
    return false;
  }
}

function wildcardPatternToRegExp(pattern: string): RegExp {
  const escaped = pattern
    .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
    .replace(/\*/g, '[^/]*');
  return new RegExp(`^${escaped}$`);
}

function originGuard(req: Request, res: Response, next: NextFunction): void {
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') {
    next();
    return;
  }

  const origin = req.get('origin');
  if (!origin) {
    next();
    return;
  }

  if (!isAllowedOrigin(origin)) {
    res.status(403).json({
      success: false,
      error: 'Origin not allowed',
    });
    return;
  }

  next();
}

const app = express();

// Trust proxy for Vercel deployment to get correct client IP
if (process.env.VERCEL === '1' || process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}

const CORS_ORIGIN_REGEXPS = CORS_ORIGIN_PATTERNS.map((pattern) => wildcardPatternToRegExp(pattern));

app.use(compression());

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) {
      callback(null, true);
      return;
    }
    callback(null, isAllowedOrigin(origin));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  // Include Vercel preview bypass headers so Playwright's protected-preview
  // contract does not fail CORS preflight on browser auth requests.
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'x-csrf-token',
    'x-vercel-protection-bypass',
    'x-vercel-set-bypass-cookie',
  ],
}));

app.use(cookieParser());
app.use(optionalAuth);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

app.use(async (_req: Request, _res: Response, next: NextFunction) => {
  try {
    await ensureSchemaInitialized();
    next();
  } catch (error) {
    next(error);
  }
});

app.use((req: Request, _res: Response, next: NextFunction) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${req.method} ${req.path}`);
  next();
});

app.use(originGuard);

app.get('/', (_req: Request, res: Response) => {
  res.json({
    success: true,
    service: 'SQL-Adapt Backend API',
    health: '/health',
    persistenceStatus: '/api/system/persistence-status',
  });
});

app.get('/health', async (_req: Request, res: Response) => {
  const featureStatus = await getFeatureStatus();
  const { source } = resolveDbEnv();
  const environment = resolveEnvironment();
  const dbTarget = resolveDbTarget();

  // Check actual database connectivity
  let dbStatus: 'ok' | 'error' = 'ok';
  let dbLatencyMs: number | undefined;
  if (isUsingNeon()) {
    const startTime = Date.now();
    try {
      const { getDb } = await import('./db/neon.js');
      const db = getDb();
      await db`SELECT 1`;
      dbLatencyMs = Date.now() - startTime;
    } catch (error) {
      dbStatus = 'error';
      console.error('[health] Database connectivity check failed:', error);
    }
  }

  const response: Record<string, unknown> = {
    status: dbStatus === 'ok' ? 'ok' : 'degraded',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    environment,
    db: {
      mode: isUsingNeon() ? 'neon' : 'sqlite',
      envSource: source,
      target: dbTarget,
      status: dbStatus,
      latencyMs: dbLatencyMs,
    },
    features: featureStatus,
  };

  const statusCode = dbStatus === 'ok' ? 200 : 503;
  res.status(statusCode).json(response);
});

app.get('/api/system/persistence-status', (_req: Request, res: Response) => {
  const neon = isUsingNeon();
  const { source } = resolveDbEnv();
  const environment = resolveEnvironment();
  const dbTarget = resolveDbTarget();

  res.json({
    backendReachable: true,
    dbMode: neon ? 'neon' : 'sqlite',
    resolvedEnvSource: source,
    dbTarget,
    environment,
    persistenceRoutesEnabled: true,
    researchContractVersion: RESEARCH_CONTRACT_VERSION,
  });
});

const usingNeon = isUsingNeon();

// ============================================================================
// DATABASE PATH SELECTION
// ============================================================================
// Neon PostgreSQL is the PRODUCTION and RESEARCH path.
// SQLite is legacy local/dev fallback only.
//
// RESEARCH DATA COLLECTION: Only the Neon path supports:
// - Multi-learner aggregation queries
// - Section-scoped access control
// - Research export endpoints with streaming
// - Full telemetry audit trails
//
// For preview/production deployments, DATABASE_URL must be set.
// ============================================================================

if (usingNeon) {
  console.log('🔌 Using Neon PostgreSQL routes (auth + csrf required) [PRODUCTION PATH]');
  app.use('/api/learners', generalApiLimiter, requireAuth, requireCsrf, neonLearnersRouter);
  app.use('/api/interactions', generalApiLimiter, requireAuth, requireCsrf, neonInteractionsRouter);
  app.use('/api/textbooks', generalApiLimiter, requireAuth, requireCsrf, neonTextbooksRouter);
  app.use('/api/sessions', generalApiLimiter, requireAuth, requireCsrf, neonSessionsRouter);
} else {
  console.log('💾 Using SQLite routes (local/dev fallback only)');
  console.log('⚠️  Research exports and multi-learner features require DATABASE_URL');
  app.use('/api/learners', generalApiLimiter, learnersRouter);
  app.use('/api/interactions', generalApiLimiter, interactionsRouter);
  app.use('/api/textbooks', generalApiLimiter, textbooksRouter);
  app.use('/api/sessions', generalApiLimiter, sessionsRouter);
}

// Auth routes - rate limiting applied per-endpoint in auth router
app.use('/api/auth', authRouter);

// Research endpoints use stricter rate limits due to expensive aggregation queries
app.use('/api/research', researchRateLimiter, requireAuth, requireInstructor, researchRouter);
// Instructor export endpoints also use research rate limits
app.use('/api/instructor', researchRateLimiter, requireAuth, instructorRouter);
app.use('/api/corpus', generalApiLimiter, corpusRouter);
app.use('/api/pdf-index', generalApiLimiter, pdfIndexRouter);
app.use('/api/llm', generalApiLimiter, llmRouter);

app.post('/ollama/api/generate', async (req: Request, res: Response) => {
  if (!ENABLE_LLM) {
    res.status(503).json({
      error: 'LLM generation not available',
      mode: 'deterministic-only',
      message: 'Set ENABLE_LLM=true to enable LLM features',
    });
    return;
  }

  req.url = '/api/llm/generate';
  llmRouter(req, res, () => {});
});

app.get('/ollama/api/tags', async (_req: Request, res: Response) => {
  if (!ENABLE_LLM) {
    res.json({ models: [] });
    return;
  }

  try {
    const response = await fetch(`${OLLAMA_BASE_URL}/api/tags`, {
      method: 'GET',
      signal: AbortSignal.timeout(5000),
    });

    if (response.ok) {
      const data = await response.json();
      res.json(data);
      return;
    }

    res.json({ models: [] });
  } catch {
    res.json({ models: [] });
  }
});

app.use((_req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: 'Not Found',
    message: 'The requested resource was not found',
  });
});

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('Error:', err);
  res.status(500).json({
    success: false,
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong',
  });
});

export default app;
