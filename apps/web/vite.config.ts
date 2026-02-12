import { defineConfig } from 'vite'
import path from 'path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'

const ollamaTarget = process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434'

export default defineConfig({
  // App lives in apps/web; keep dist artifacts in the repository-level dist/.
  root: path.resolve(__dirname),
  plugins: [
    react(),
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
