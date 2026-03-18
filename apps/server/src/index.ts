/**
 * SQL-Adapt Backend API Server
 * Express server with SQLite database
 */

import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

import { initializeSchema, closeDb } from './db/index.js';
import { learnersRouter } from './routes/learners.js';
import { interactionsRouter } from './routes/interactions.js';
import { textbooksRouter } from './routes/textbooks.js';
import { sessionsRouter } from './routes/sessions.js';
import { researchRouter } from './routes/research.js';
import { pdfIndexRouter } from './routes/pdf-index.js';
import { llmRouter } from './routes/llm.js';

// Neon PostgreSQL routes (new)
import { neonLearnersRouter } from './routes/neon-learners.js';
import { neonInteractionsRouter } from './routes/neon-interactions.js';
import { neonTextbooksRouter } from './routes/neon-textbooks.js';
import { neonSessionsRouter } from './routes/neon-sessions.js';

import { ENABLE_PDF_INDEX, ENABLE_LLM, PORT, CORS_ORIGIN, getFeatureStatus, OLLAMA_BASE_URL } from './config.js';
import { isUsingNeon } from './db/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load environment variables
const envPath = path.resolve(__dirname, '../.env');
dotenv.config({ path: envPath });

// Ensure data directory exists
const DATA_DIR = path.resolve(__dirname, '../data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Initialize Express app
const app = express();

// Middleware
app.use(cors({
  origin: CORS_ORIGIN,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging middleware
app.use((req: Request, _res: Response, next: NextFunction) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${req.method} ${req.path}`);
  next();
});

// ============================================================================
// Health Check
// ============================================================================

app.get('/health', async (_req: Request, res: Response) => {
  const featureStatus = await getFeatureStatus();
  
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    features: featureStatus,
  });
});

// ============================================================================
// API Routes
// ============================================================================

// Use Neon PostgreSQL routes when DATABASE_URL is set, otherwise use SQLite routes
const usingNeon = isUsingNeon();

if (usingNeon) {
  console.log('🔌 Using Neon PostgreSQL routes');
  app.use('/api/learners', neonLearnersRouter);
  app.use('/api/interactions', neonInteractionsRouter);
  app.use('/api/textbooks', neonTextbooksRouter);
  app.use('/api/sessions', neonSessionsRouter);
} else {
  console.log('💾 Using SQLite routes (legacy)');
  app.use('/api/learners', learnersRouter);
  app.use('/api/interactions', interactionsRouter);
  app.use('/api/textbooks', textbooksRouter);
  app.use('/api/sessions', sessionsRouter);
}

app.use('/api/research', researchRouter);

// ============================================================================
// PDF Index Routes
// Enabled when ENABLE_PDF_INDEX=true
// ============================================================================

app.use('/api/pdf-index', pdfIndexRouter);

// ============================================================================
// LLM Routes
// Enabled when ENABLE_LLM=true
// ============================================================================

app.use('/api/llm', llmRouter);

// ============================================================================
// Legacy Hosted Mode Routes (Backward Compatibility)
// These routes redirect to the new API routes
// ============================================================================

// Legacy Ollama proxy routes - redirect to new LLM routes
app.post('/ollama/api/generate', async (req: Request, res: Response) => {
  if (!ENABLE_LLM) {
    res.status(503).json({
      error: 'LLM generation not available',
      mode: 'deterministic-only',
      message: 'Set ENABLE_LLM=true to enable LLM features',
    });
    return;
  }
  
  // Forward to new route handler
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

// ============================================================================
// Server Status Display
// ============================================================================

function displayServerStatus() {
  const dbType = isUsingNeon() ? 'Neon PostgreSQL' : 'SQLite';
  console.log(`
╔════════════════════════════════════════════════════════════╗
║                                                            ║
║   SQL-Adapt Backend API Server                             ║
║                                                            ║
║   🚀 Server running on http://localhost:${PORT}              ║
║   📊 API endpoints available at /api/*                     ║
║   💾 Database: ${dbType.padEnd(46)}║
║                                                            ║`);

  // PDF Index status
  if (ENABLE_PDF_INDEX) {
    console.log(`║   📄 PDF Index: ENABLED                                    ║`);
    console.log(`║      → POST /api/pdf-index/load                            ║`);
    console.log(`║      → POST /api/pdf-index/upload                          ║`);
    console.log(`║      → GET  /api/pdf-index/status                          ║`);
  } else {
    console.log(`║   📄 PDF Index: DISABLED (set ENABLE_PDF_INDEX=true)       ║`);
  }

  // LLM status
  if (ENABLE_LLM) {
    console.log(`║   🤖 LLM Proxy: ENABLED                                    ║`);
    console.log(`║      → Ollama: ${OLLAMA_BASE_URL}`.padEnd(59) + '║');
    console.log(`║      → POST /api/llm/generate                              ║`);
    console.log(`║      → GET  /api/llm/models                                ║`);
    console.log(`║      → GET  /api/llm/status                                ║`);
  } else {
    console.log(`║   🤖 LLM Proxy: DISABLED (set ENABLE_LLM=true)             ║`);
  }

  console.log(`║                                                            ║
╚════════════════════════════════════════════════════════════╝
  `);
}

// ============================================================================
// Error Handling
// ============================================================================

// 404 handler
app.use((_req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: 'Not Found',
    message: 'The requested resource was not found',
  });
});

// Global error handler
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('Error:', err);
  res.status(500).json({
    success: false,
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong',
  });
});

// ============================================================================
// Server Startup
// ============================================================================

async function startServer() {
  try {
    // Initialize database schema
    await initializeSchema();

    // Start server
    const server = app.listen(PORT, () => {
      displayServerStatus();
    });

    // Graceful shutdown
    process.on('SIGTERM', async () => {
      console.log('\n👋 SIGTERM received, shutting down gracefully...');
      server.close(async () => {
        await closeDb();
        console.log('✅ Server closed');
        process.exit(0);
      });
    });

    process.on('SIGINT', async () => {
      console.log('\n👋 SIGINT received, shutting down gracefully...');
      server.close(async () => {
        await closeDb();
        console.log('✅ Server closed');
        process.exit(0);
      });
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    await closeDb();
    process.exit(1);
  }
}

startServer();

export { app };
