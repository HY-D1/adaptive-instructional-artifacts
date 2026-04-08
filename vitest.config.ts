import path from 'path';
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
    include: ['apps/web/src/**/*.test.ts', 'apps/web/src/**/*.test.tsx', 'tests/unit/**/*.test.ts'],
    setupFiles: ['./test-setup.ts'],
    deps: {
      // Allow importing TypeScript files
      interopDefault: true
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      // Coverage thresholds based on current baseline (2026-03-29)
      // Current coverage: lines 73.5%, functions ~72%, branches ~65%, statements ~73%
      // Thresholds set 3-5% below current to allow gradual improvement
      // Added lcov reporter for CI integrations
      // CI will fail if coverage drops below these thresholds
      thresholds: {
        lines: 70,
        functions: 70,
        branches: 65,
        statements: 70
      },
      exclude: [
        'node_modules/',
        'test-setup.ts',
        '**/*.d.ts',
        '**/*.config.*',
        '**/dist/**'
      ]
    }
  },
  resolve: {
    alias: {
      // Ensure proper path resolution
      // Resolve express from server directory for unit tests importing server routes
      'express': path.resolve(__dirname, 'apps/server/node_modules/express')
    }
  }
});
