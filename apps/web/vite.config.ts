import { defineConfig } from 'vite'
import path from 'path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'

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
  assetsInclude: ['**/*.svg', '**/*.csv'],
})
