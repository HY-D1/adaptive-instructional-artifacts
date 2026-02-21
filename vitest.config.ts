import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import plainText from 'vite-plugin-plain-text';

export default defineConfig({
  plugins: [
    react(),
    // Handle ?raw imports for CSV and other text files
    plainText(['**/*.csv'], { namedExport: false })
  ],
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['apps/web/src/**/*.test.ts'],
    deps: {
      // Allow importing TypeScript files
      interopDefault: true
    }
  },
  resolve: {
    alias: {
      // Ensure proper path resolution
    }
  }
});
