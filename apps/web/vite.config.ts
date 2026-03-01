import { defineConfig } from 'vite'
import path from 'path'
import fs from 'fs'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import {
  PDF_CHUNKER_VERSION,
  PDF_EMBEDDING_MODEL_ID,
  PDF_INDEX_SCHEMA_VERSION
} from './src/app/lib/pdf-index-config'
import { loadOrBuildPdfIndexFromDisk, buildPdfIndexFromBuffer } from './src/server/pdf-index-server'

// WASM file paths
const wasmFilePath = path.resolve(__dirname, 'public/sql-wasm.wasm')

const ollamaTarget = process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434'
const repoRoot = path.resolve(__dirname, '../..')
const pdfIndexDir = process.env.PDF_INDEX_DIR || path.resolve(repoRoot, 'dist/pdf-index')
const pdfSourceDir = process.env.PDF_SOURCE_DIR || path.resolve(repoRoot, 'dist')

function pdfIndexApiPlugin() {
  return {
    name: 'pdf-index-api',
    configureServer(server: any) {
      // Existing endpoint: load/build from disk
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

      // New endpoint: upload PDF and build index
      server.middlewares.use('/api/pdf-index/upload', async (req: any, res: any, next: () => void) => {
        if (req.method !== 'POST') {
          next()
          return
        }

        try {
          // Parse multipart form data
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

              // Extract boundary
              const boundaryMatch = contentType.match(/boundary=([^;]+)/)
              if (!boundaryMatch) {
                res.statusCode = 400
                res.setHeader('Content-Type', 'application/json')
                res.end(JSON.stringify({ error: 'Missing boundary in content-type' }))
                return
              }
              const boundary = boundaryMatch[1].trim().replace(/^"|"$/g, '')

              // Parse multipart data
              const parts = parseMultipart(buffer, boundary)
              const filePart = parts.find(p => p.filename && p.filename.endsWith('.pdf'))
              
              if (!filePart) {
                res.statusCode = 400
                res.setHeader('Content-Type', 'application/json')
                res.end(JSON.stringify({ error: 'No PDF file found in upload' }))
                return
              }

              // Ensure directories exist
              await fs.promises.mkdir(pdfSourceDir, { recursive: true })
              await fs.promises.mkdir(pdfIndexDir, { recursive: true })

              // Build index from uploaded PDF
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

// Simple multipart parser
function parseMultipart(buffer: Buffer, boundary: string): Array<{ name?: string; filename?: string; data: Buffer }> {
  const parts: Array<{ name?: string; filename?: string; data: Buffer }> = []
  const boundaryBuffer = Buffer.from(`--${boundary}`)
  
  let start = buffer.indexOf(boundaryBuffer)
  while (start !== -1) {
    const end = buffer.indexOf(boundaryBuffer, start + boundaryBuffer.length)
    const partBuffer = end !== -1 
      ? buffer.slice(start + boundaryBuffer.length, end)
      : buffer.slice(start + boundaryBuffer.length)
    
    // Parse headers and data
    const headerEnd = partBuffer.indexOf('\r\n\r\n')
    if (headerEnd !== -1) {
      const headerBuffer = partBuffer.slice(0, headerEnd)
      const dataBuffer = partBuffer.slice(headerEnd + 4)
      
      // Remove trailing \r\n before boundary
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

// WASM serving plugin - ensures correct MIME type for .wasm files
function wasmServePlugin() {
  // Shared middleware handler for both dev and preview servers
  const wasmMiddleware = (req: any, res: any, next: () => void) => {
    // Only handle requests to /sql-wasm.wasm
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
    enforce: 'pre', // Run before other middleware (including Vite's SPA fallback)
    configureServer(server: any) {
      // Add middleware at the beginning to intercept WASM requests before SPA fallback
      server.middlewares.stack.unshift({
        route: '',
        handle: wasmMiddleware
      })
    },
    configurePreview(server: any) {
      // Also handle WASM requests in preview mode (vite preview)
      server.middlewares.stack.unshift({
        route: '',
        handle: wasmMiddleware
      })
    }
  }
}

export default defineConfig({
  // App lives in apps/web; keep dist artifacts in the repository-level dist/.
  root: path.resolve(__dirname),
  plugins: [
    // WASM plugin must be first to intercept requests before SPA fallback
    wasmServePlugin(),
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
  preview: {
    port: 4173,
    host: true,
    strictPort: true,
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
