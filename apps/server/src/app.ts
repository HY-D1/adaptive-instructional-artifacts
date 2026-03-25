/**
 * SQL-Adapt Backend API App
 * Creates the Express app without binding to a port.
 */

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
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
import {
  ENABLE_LLM,
  CORS_ORIGIN_PATTERNS,
  CORS_ORIGINS,
  getFeatureStatus,
  OLLAMA_BASE_URL,
} from './config.js';
import { isUsingNeon } from './db/index.js';
import { resolveDbEnv } from './db/env-resolver.js';
import { optionalAuth, requireAuth, requireInstructor } from './middleware/auth.js';
import { requireCsrf } from './middleware/csrf.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.resolve(__dirname, '../.env');
dotenv.config({ path: envPath });

const DATA_DIR = path.resolve(__dirname, '../data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

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
const CORS_ORIGIN_REGEXPS = CORS_ORIGIN_PATTERNS.map((pattern) => wildcardPatternToRegExp(pattern));

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
  allowedHeaders: ['Content-Type', 'Authorization', 'x-csrf-token'],
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

app.get('/health', async (_req: Request, res: Response) => {
  const featureStatus = await getFeatureStatus();
  const { source } = resolveDbEnv();

  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    db: {
      mode: isUsingNeon() ? 'neon' : 'sqlite',
      envSource: source,
    },
    features: featureStatus,
  });
});

app.get('/api/system/persistence-status', (_req: Request, res: Response) => {
  const neon = isUsingNeon();
  const { source } = resolveDbEnv();

  res.json({
    backendReachable: true,
    dbMode: neon ? 'neon' : 'sqlite',
    resolvedEnvSource: source,
    persistenceRoutesEnabled: true,
  });
});

const usingNeon = isUsingNeon();

if (usingNeon) {
  console.log('🔌 Using Neon PostgreSQL routes (auth + csrf required)');
  app.use('/api/learners', requireAuth, requireCsrf, neonLearnersRouter);
  app.use('/api/interactions', requireAuth, requireCsrf, neonInteractionsRouter);
  app.use('/api/textbooks', requireAuth, requireCsrf, neonTextbooksRouter);
  app.use('/api/sessions', requireAuth, requireCsrf, neonSessionsRouter);
} else {
  console.log('💾 Using SQLite routes (legacy)');
  app.use('/api/learners', learnersRouter);
  app.use('/api/interactions', interactionsRouter);
  app.use('/api/textbooks', textbooksRouter);
  app.use('/api/sessions', sessionsRouter);
}

app.use('/api/auth', authRouter);
app.use('/api/research', requireAuth, requireInstructor, researchRouter);
app.use('/api/instructor', requireAuth, instructorRouter);
app.use('/api/pdf-index', pdfIndexRouter);
app.use('/api/llm', llmRouter);

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
