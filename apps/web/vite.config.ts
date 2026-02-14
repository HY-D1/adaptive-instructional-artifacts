import { defineConfig } from 'vite'
import path from 'path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import {
  PDF_CHUNKER_VERSION,
  PDF_EMBEDDING_MODEL_ID,
  PDF_INDEX_SCHEMA_VERSION
} from './src/app/lib/pdf-index-config'
import { loadOrBuildPdfIndexFromDisk } from './src/server/pdf-index-server'

const ollamaTarget = process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434'
const repoRoot = path.resolve(__dirname, '../..')
const pdfIndexDir = process.env.PDF_INDEX_DIR || path.resolve(repoRoot, 'dist/pdf-index')
const pdfSourceDir = process.env.PDF_SOURCE_DIR || path.resolve(repoRoot, 'dist')

function pdfIndexApiPlugin() {
  return {
    name: 'pdf-index-api',
    configureServer(server: any) {
      server.middlewares.use('/api/pdf-index/load', async (req: any, res: any, next: () => void) => {
        if (req.method !== 'POST' && req.method !== 'GET') {
          next()
          return
        }

        try {
          const result = await loadOrBuildPdfIndexFromDisk({
            indexDir: pdfIndexDir,
            sourcePdfDir: pdfSourceDir,
            schemaVersion: PDF_INDEX_SCHEMA_VERSION,
            chunkerVersion: PDF_CHUNKER_VERSION,
            embeddingModelId: PDF_EMBEDDING_MODEL_ID
          })

          res.statusCode = 200
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify(result))
        } catch (error) {
          res.statusCode = 500
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({
            error: (error as Error).message || 'Failed to load/build PDF index.'
          }))
        }
      })
    }
  }
}

export default defineConfig({
  // App lives in apps/web; keep dist artifacts in the repository-level dist/.
  root: path.resolve(__dirname),
  plugins: [
    react(),
    pdfIndexApiPlugin(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    outDir: path.resolve(__dirname, '../../dist/app'),
    emptyOutDir: false,
  },
  server: {
    proxy: {
      '/ollama': {
        // Local default works on macOS and Windows; allow override for custom setups.
        target: ollamaTarget,
        changeOrigin: true,
        rewrite: (requestPath) => requestPath.replace(/^\/ollama/, '')
      }
    }
  },
  assetsInclude: ['**/*.svg', '**/*.csv'],
})
