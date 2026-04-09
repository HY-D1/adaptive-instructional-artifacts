import path from 'path';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import plainText from 'vite-plugin-plain-text';
import fs from 'fs';

// Load SQL.js WASM file for test mocking
const wasmPath = path.resolve(__dirname, 'node_modules/sql.js/dist/sql-wasm.wasm');
const wasmBinary = fs.existsSync(wasmPath) ? fs.readFileSync(wasmPath) : null;

// Plugin to mock sql.js in test environment
const sqlJsMockPlugin = () => ({
  name: 'sql-js-mock',
  enforce: 'pre' as const,
  async resolveId(id: string) {
    if (id === 'sql.js' && process.env.VITEST) {
      // Return a virtual module ID
      return '\0virtual:sql.js';
    }
    return null;
  },
  async load(id: string) {
    if (id === '\0virtual:sql.js') {
      // Return a module that exports sql.js pre-initialized with WASM binary
      return `
        import initSqlJs from 'sql.js/dist/sql-wasm.js';
        
        const wasmBinary = new Uint8Array([${wasmBinary ? Array.from(wasmBinary).join(',') : ''}]);
        
        export default function initSql(options = {}) {
          return initSqlJs({
            ...options,
            wasmBinary,
            locateFile: () => ''
          });
        }
        
        // Re-export other exports from sql.js if needed
        export { initSqlJs };
      `;
    }
    return null;
  }
});

export default defineConfig({
  plugins: [
    sqlJsMockPlugin(),
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
