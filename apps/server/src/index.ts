/**
 * SQL-Adapt Backend API Server
 * Local/dev entrypoint that binds the Express app to a port.
 */

import app, { ensureSchemaInitialized } from './app.js';
import { closeDb, isUsingNeon } from './db/index.js';
import { ENABLE_PDF_INDEX, ENABLE_LLM, PORT, OLLAMA_BASE_URL } from './config.js';

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

  if (ENABLE_PDF_INDEX) {
    console.log(`║   📄 PDF Index: ENABLED                                    ║`);
    console.log(`║      → POST /api/pdf-index/load                            ║`);
    console.log(`║      → POST /api/pdf-index/upload                          ║`);
    console.log(`║      → GET  /api/pdf-index/status                          ║`);
  } else {
    console.log(`║   📄 PDF Index: DISABLED (set ENABLE_PDF_INDEX=true)       ║`);
  }

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

async function startServer() {
  try {
    await ensureSchemaInitialized();

    const server = app.listen(PORT, () => {
      displayServerStatus();
    });

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

