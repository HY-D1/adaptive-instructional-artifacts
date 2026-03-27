#!/usr/bin/env node

import { readFileSync, existsSync } from 'node:fs';

const authCriticalFiles = [
  'apps/web/src/app/routes.tsx',
  'apps/web/src/app/lib/auth-guard.ts',
  'apps/web/src/app/lib/auth-context.tsx',
  'apps/web/src/app/lib/auth-route-loader.ts',
];

const forbidden = [
  "from './storage/storage'",
  'from "./storage/storage"',
  "from '../storage/storage'",
  'from "../storage/storage"',
];

const violations = [];

for (const filePath of authCriticalFiles) {
  if (!existsSync(filePath)) continue;
  const source = readFileSync(filePath, 'utf8');
  for (const pattern of forbidden) {
    if (source.includes(pattern)) {
      violations.push({ filePath, pattern });
    }
  }
}

if (violations.length > 0) {
  console.error('Found forbidden local-only storage imports in auth-critical files:');
  for (const violation of violations) {
    console.error(`- ${violation.filePath}: ${violation.pattern}`);
  }
  process.exit(1);
}

console.log('Auth/storage import guard passed.');
