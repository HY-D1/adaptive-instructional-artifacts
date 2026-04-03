#!/usr/bin/env node
/**
 * Policy Export Script
 * 
 * Exports canonical policy definitions from TypeScript source to JSON
 * for consumption by Node.js replay scripts. Ensures single source of truth.
 * 
 * Usage:
 *   node scripts/export-policies.mjs [--output dist/policies.json]
 * 
 * @version policy-export-v1
 */

import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..');

const DEFAULT_OUTPUT = path.join(REPO_ROOT, 'dist/policies.json');

// Canonical policy definitions - single source of truth
// These mirror exactly the definitions in apps/web/src/app/lib/policies/policy-definitions.ts

const POLICY_VERSION = 'policy-definitions-v1';
const EXPORT_VERSION = 'policy-export-v1';

const POLICIES = {
  aggressive: {
    id: 'aggressive',
    name: 'Aggressive Escalation',
    description: 'Fast to explanation, low hint dependency. Prioritizes quick resolution over exploration.',
    thresholds: { escalate: 1, aggregate: 2 },
    triggers: { timeStuck: 60000, rungExhausted: 1, repeatedError: 1 },
    hintsEnabled: true,
    usesBandit: false
  },
  conservative: {
    id: 'conservative',
    name: 'Conservative Escalation',
    description: 'Maximize hint exploration before explanation. Encourages self-directed discovery.',
    thresholds: { escalate: 3, aggregate: 4 },
    triggers: { timeStuck: 300000, rungExhausted: 3, repeatedError: 3 },
    hintsEnabled: true,
    usesBandit: false
  },
  explanation_first: {
    id: 'explanation_first',
    name: 'Explanation-First',
    description: 'Skip hints, go straight to full explanation. Tests explanation-only learning.',
    thresholds: { escalate: 0, aggregate: 2 },
    triggers: { timeStuck: 0, rungExhausted: 0, repeatedError: 0 },
    hintsEnabled: false,
    usesBandit: false
  },
  adaptive: {
    id: 'adaptive',
    name: 'Adaptive (Bandit)',
    description: 'Bandit-optimized per learner using Thompson sampling for dynamic threshold adjustment.',
    thresholds: { escalate: 2, aggregate: 3 },
    triggers: { timeStuck: 120000, rungExhausted: 2, repeatedError: 2 },
    hintsEnabled: true,
    usesBandit: true
  },
  no_hints: {
    id: 'no_hints',
    name: 'No Hints (Control)',
    description: 'No assistance provided. Baseline condition for measuring unassisted learning outcomes.',
    thresholds: { escalate: -1, aggregate: -1 },
    triggers: { timeStuck: Infinity, rungExhausted: Infinity, repeatedError: Infinity },
    hintsEnabled: false,
    usesBandit: false
  }
};

const POLICY_IDS = ['aggressive', 'conservative', 'explanation_first', 'adaptive', 'no_hints'];

function parseArgs(argv) {
  const args = { output: DEFAULT_OUTPUT };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--output' && i + 1 < argv.length) {
      args.output = path.resolve(REPO_ROOT, argv[i + 1]);
      i++;
    }
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  
  const exportData = {
    exportVersion: EXPORT_VERSION,
    policyVersion: POLICY_VERSION,
    exportedAt: new Date().toISOString(),
    policies: POLICIES,
    policyIds: POLICY_IDS,
    metadata: {
      source: 'apps/web/src/app/lib/policies/policy-definitions.ts',
      description: 'Canonical escalation policies for experimental comparison',
      totalPolicies: POLICY_IDS.length,
      experimentalPolicies: POLICY_IDS.filter(id => id !== 'no_hints'),
      controlPolicies: ['no_hints']
    }
  };
  
  await mkdir(path.dirname(args.output), { recursive: true });
  await writeFile(args.output, JSON.stringify(exportData, null, 2), 'utf8');
  
  console.log(`Policies exported: ${path.relative(REPO_ROOT, args.output)}`);
  console.log(`Policy version: ${POLICY_VERSION}`);
  console.log(`Export version: ${EXPORT_VERSION}`);
  console.log(`Policies: ${POLICY_IDS.join(', ')}`);
}

main().catch((error) => {
  console.error(`Export failed: ${error.message}`);
  process.exit(1);
});
