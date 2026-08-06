import { defineConfig, type Plugin } from 'vite'
import path from 'path'
import fs from 'fs'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { withRelatedProject } from '@vercel/related-projects'
import {
  PDF_CHUNKER_VERSION,
  PDF_EMBEDDING_MODEL_ID,
  PDF_INDEX_SCHEMA_VERSION
} from './src/app/lib/pdf-index-config'
import { loadOrBuildPdfIndexFromDisk, buildPdfIndexFromBuffer } from './src/server/pdf-index-server'

// WASM file paths
const wasmFilePath = path.resolve(__dirname, 'public/sql-wasm.wasm')

const ollamaTarget = process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434'

// Backend target for local dev proxy only
const backendTarget =
  process.env.VITE_BACKEND_URL ||
  process.env.VITE_API_BASE_URL ||
  'http://127.0.0.1:3001'

// Resolve deployed backend host for frontend build/runtime on Vercel
const resolvedApiBaseUrl =
  process.env.VITE_API_BASE_URL ||
  (
    process.env.VERCEL
      ? withRelatedProject({
          projectName: 'adaptive-instructional-artifacts-api-backend',
          defaultHost: process.env.VITE_API_BASE_URL || ''
        })
      : ''
  )

if (resolvedApiBaseUrl && !process.env.VITE_API_BASE_URL) {
  process.env.VITE_API_BASE_URL = resolvedApiBaseUrl.startsWith('http')
    ? resolvedApiBaseUrl
    : `https://${resolvedApiBaseUrl}`
}

if (process.env.NODE_ENV !== 'production') {
  const diagnosticBase = process.env.VITE_API_BASE_URL || '(unset)';
  // Non-production only: make API target explicit to debug stale env/deploy mismatches.
  // eslint-disable-next-line no-console
  console.log(`[vite] resolved VITE_API_BASE_URL=${diagnosticBase}`);
}

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

      server.middlewares.use('/api/pdf-index/upload', async (req: any, res: any, next: () => void) => {
        if (req.method !== 'POST') {
          next()
          return
        }

        try {
          const chunks: Buffer[] = []
          req.on('data', (chunk: Buffer) => chunks.push(chunk))
          req.on('end', async () => {
            try {
              const buffer = Buffer.concat(chunks)
              const contentType = req.headers['content-type'] || ''

              if (!contentType.includes('multipart/form-data')) {
                res.statusCode = 400
                res.setHeader('Content-Type', 'application/json')
                res.end(JSON.stringify({ error: 'Expected multipart/form-data' }))
                return
              }

              const boundaryMatch = contentType.match(/boundary=([^;]+)/)
              if (!boundaryMatch) {
                res.statusCode = 400
                res.setHeader('Content-Type', 'application/json')
                res.end(JSON.stringify({ error: 'Missing boundary in content-type' }))
                return
              }
              const boundary = boundaryMatch[1].trim().replace(/^"|"$/g, '')

              const parts = parseMultipart(buffer, boundary)
              const filePart = parts.find(p => p.filename && p.filename.endsWith('.pdf'))

              if (!filePart) {
                res.statusCode = 400
                res.setHeader('Content-Type', 'application/json')
                res.end(JSON.stringify({ error: 'No PDF file found in upload' }))
                return
              }

              await fs.promises.mkdir(pdfSourceDir, { recursive: true })
              await fs.promises.mkdir(pdfIndexDir, { recursive: true })

              const result = await buildPdfIndexFromBuffer(
                filePart.data,
                filePart.filename || 'uploaded.pdf',
                {
                  indexDir: pdfIndexDir,
                  sourcePdfDir: pdfSourceDir,
                  schemaVersion: PDF_INDEX_SCHEMA_VERSION,
                  chunkerVersion: PDF_CHUNKER_VERSION,
                  embeddingModelId: PDF_EMBEDDING_MODEL_ID
                }
              )

              res.statusCode = 200
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({
                status: 'built',
                document: result.document,
                manifest: result.manifest,
                message: `Successfully built PDF index from '${filePart.filename}' with ${result.manifest.chunkCount} chunks.`
              }))
            } catch (error) {
              res.statusCode = 500
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({
                error: (error as Error).message || 'Failed to process uploaded PDF.'
              }))
            }
          })
        } catch (error) {
          res.statusCode = 500
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({
            error: (error as Error).message || 'Failed to process upload.'
          }))
        }
      })
    }
  }
}

function parseMultipart(buffer: Buffer, boundary: string): Array<{ name?: string; filename?: string; data: Buffer }> {
  const parts: Array<{ name?: string; filename?: string; data: Buffer }> = []
  const boundaryBuffer = Buffer.from(`--${boundary}`)

  let start = buffer.indexOf(boundaryBuffer)
  while (start !== -1) {
    const end = buffer.indexOf(boundaryBuffer, start + boundaryBuffer.length)
    const partBuffer = end !== -1
      ? buffer.slice(start + boundaryBuffer.length, end)
      : buffer.slice(start + boundaryBuffer.length)

    const headerEnd = partBuffer.indexOf('\r\n\r\n')
    if (headerEnd !== -1) {
      const headerBuffer = partBuffer.slice(0, headerEnd)
      const dataBuffer = partBuffer.slice(headerEnd + 4)

      const cleanData = dataBuffer.toString().endsWith('\r\n')
        ? dataBuffer.slice(0, -2)
        : dataBuffer

      const headerStr = headerBuffer.toString()
      const nameMatch = headerStr.match(/name="([^"]+)"/)
      const filenameMatch = headerStr.match(/filename="([^"]+)"/)

      if (nameMatch || filenameMatch) {
        parts.push({
          name: nameMatch?.[1],
          filename: filenameMatch?.[1],
          data: cleanData
        })
      }
    }

    start = end
  }

  return parts
}

function lodashResolvePlugin(): Plugin {
  return {
    name: 'lodash-resolve',
    enforce: 'pre' as const,
    resolveId(id: string, importer: string | undefined) {
      if (id.startsWith('./_') && importer?.includes('/lodash/') && !id.endsWith('.js')) {
        return path.resolve(path.dirname(importer), id + '.js')
      }
      return null
    }
  }
}

function wasmServePlugin(): Plugin {
  const wasmMiddleware = (req: any, res: any, next: () => void) => {
    if (req.url !== '/sql-wasm.wasm' && !req.url?.startsWith('/sql-wasm.wasm?')) {
      next()
      return
    }

    if (req.method !== 'GET' && req.method !== 'HEAD') {
      next()
      return
    }

    try {
      if (fs.existsSync(wasmFilePath)) {
        const wasmContent = fs.readFileSync(wasmFilePath)
        res.statusCode = 200
        res.setHeader('Content-Type', 'application/wasm')
        res.setHeader('Cache-Control', 'public, max-age=3600')
        res.end(wasmContent)
      } else {
        res.statusCode = 404
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify({ error: 'WASM file not found' }))
      }
    } catch (error) {
      res.statusCode = 500
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify({ error: (error as Error).message }))
    }
  }

  return {
    name: 'wasm-serve',
    enforce: 'pre' as const,
    configureServer(server: any) {
      server.middlewares.stack.unshift({
        route: '',
        handle: wasmMiddleware
      })
    }
  }
}

export default defineConfig({
  root: path.resolve(__dirname),
  plugins: [
    lodashResolvePlugin(),
    wasmServePlugin(),
    react(),
    pdfIndexApiPlugin(),
    tailwindcss(),
  ],
  define: {
    __API_BASE_URL__: JSON.stringify(process.env.VITE_API_BASE_URL || ''),
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  optimizeDeps: {
    include: ['recharts', 'lodash'],
  },
  build: {
    outDir: path.resolve(__dirname, '../../dist/app'),
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router'],
          'vendor-editor': ['@monaco-editor/react', 'sql.js'],
          'vendor-charts': ['recharts'],
        },
      },
    },
    chunkSizeWarningLimit: 2000,
    commonjsOptions: {
      transformMixedEsModules: true,
      ignoreTryCatch: true,
      include: [/node_modules/],
    },
  },
  preview: {
    port: 4173,
    host: true,
    strictPort: true,
  },
  server: {
    proxy: {
      '/ollama': {
        target: ollamaTarget,
        changeOrigin: true,
        rewrite: (requestPath) => requestPath.replace(/^\/ollama/, '')
      },
      '/api': {
        target: backendTarget,
        changeOrigin: true,
      }
    }
  },
  assetsInclude: ['**/*.svg', '**/*.csv'],
})
