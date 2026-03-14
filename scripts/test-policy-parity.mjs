#!/usr/bin/env node
/**
 * Policy Parity Test
 * 
 * Verifies that exported policy definitions match the canonical TypeScript definitions.
 * Fails if there is any drift between the two sources of truth.
 * 
 * Usage:
 *   node scripts/test-policy-parity.mjs
 * 
 * @version policy-parity-test-v1
 */

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..');

const POLICIES_JSON_PATH = path.join(REPO_ROOT, 'dist/policies.json');
const POLICY_TS_PATH = path.join(REPO_ROOT, 'apps/web/src/app/lib/policies/policy-definitions.ts');

/**
 * Extract policy definitions from TypeScript source
 */
async function extractPoliciesFromTypeScript() {
  const raw = await readFile(POLICY_TS_PATH, 'utf8');
  
  // Extract policy objects using regex
  const policies = {};
  
  // Match policy constants like: export const AGGRESSIVE_POLICY: EscalationPolicy = { ... };
  const policyRegex = /export\s+const\s+(\w+)_POLICY.*?=\s*(\{[\s\S]*?\n\});/g;
  
  let match;
  while ((match = policyRegex.exec(raw)) !== null) {
    const policyName = match[1].toLowerCase();
    const policyBody = match[2];
    
    // Extract id
    const idMatch = policyBody.match(/id:\s*['"]([^'"]+)['"]/);
    const id = idMatch ? idMatch[1] : policyName;
    
    // Extract name
    const nameMatch = policyBody.match(/name:\s*['"]([^'"]+)['"]/);
    const name = nameMatch ? nameMatch[1] : id;
    
    // Extract description
    const descMatch = policyBody.match(/description:\s*['"]([^'"]+)['"]/);
    const description = descMatch ? descMatch[1] : '';
    
    // Extract thresholds
    const thresholdsMatch = policyBody.match(/thresholds:\s*\{[^}]*escalate:\s*(\-?\d+|Infinity)[^}]*aggregate:\s*(\-?\d+|Infinity)[^}]*\}/);
    const escalate = thresholdsMatch ? parseThreshold(thresholdsMatch[1]) : 3;
    const aggregate = thresholdsMatch ? parseThreshold(thresholdsMatch[2]) : 6;
    
    // Extract triggers
    const triggersMatch = policyBody.match(/triggers:\s*\{[^}]*timeStuck:\s*(\d+|Infinity)[^}]*rungExhausted:\s*(\d+|Infinity)[^}]*repeatedError:\s*(\d+|Infinity)[^}]*\}/);
    const timeStuck = triggersMatch ? parseTrigger(triggersMatch[1]) : 300000;
    const rungExhausted = triggersMatch ? parseTrigger(triggersMatch[2]) : 3;
    const repeatedError = triggersMatch ? parseTrigger(triggersMatch[3]) : 3;
    
    // Extract hintsEnabled
    const hintsEnabledMatch = policyBody.match(/hintsEnabled:\s*(true|false)/);
    const hintsEnabled = hintsEnabledMatch ? hintsEnabledMatch[1] === 'true' : true;
    
    // Extract usesBandit
    const usesBanditMatch = policyBody.match(/usesBandit:\s*(true|false)/);
    const usesBandit = usesBanditMatch ? usesBanditMatch[1] === 'true' : false;
    
    policies[id] = {
      id,
      name,
      description,
      thresholds: { escalate, aggregate },
      triggers: { timeStuck, rungExhausted, repeatedError },
      hintsEnabled,
      usesBandit
    };
  }
  
  return policies;
}

function parseThreshold(value) {
  if (value === 'Infinity') return Infinity;
  const num = parseInt(value, 10);
  return Number.isFinite(num) ? num : 0;
}

function parseTrigger(value) {
  if (value === 'Infinity') return Infinity;
  const num = parseInt(value, 10);
  return Number.isFinite(num) ? num : 0;
}

/**
 * Compare two policy objects
 */
function policiesEqual(a, b) {
  if (a.id !== b.id) return false;
  if (a.name !== b.name) return false;
  if (a.description !== b.description) return false;
  if (a.hintsEnabled !== b.hintsEnabled) return false;
  if (a.usesBandit !== b.usesBandit) return false;
  if (a.thresholds.escalate !== b.thresholds.escalate) return false;
  if (a.thresholds.aggregate !== b.thresholds.aggregate) return false;
  if (a.triggers.timeStuck !== b.triggers.timeStuck) return false;
  if (a.triggers.rungExhausted !== b.triggers.rungExhausted) return false;
  if (a.triggers.repeatedError !== b.triggers.repeatedError) return false;
  return true;
}

async function main() {
  console.log('Policy Parity Test');
  console.log('==================\n');
  
  // Load exported policies
  const exportedRaw = await readFile(POLICIES_JSON_PATH, 'utf8');
  const exported = JSON.parse(exportedRaw);
  
  // Extract from TypeScript
  const fromTypeScript = await extractPoliciesFromTypeScript();
  
  console.log(`Exported policies: ${Object.keys(exported.policies).join(', ')}`);
  console.log(`TypeScript policies: ${Object.keys(fromTypeScript).join(', ')}`);
  console.log('');
  
  // Check for mismatches
  const mismatches = [];
  
  for (const [id, exportedPolicy] of Object.entries(exported.policies)) {
    const tsPolicy = fromTypeScript[id];
    
    if (!tsPolicy) {
      mismatches.push(`Policy '${id}' exists in export but not in TypeScript source`);
      continue;
    }
    
    if (!policiesEqual(exportedPolicy, tsPolicy)) {
      mismatches.push(`Policy '${id}' differs between export and TypeScript source`);
      console.log(`\nDifferences for ${id}:`);
      console.log('  Exported:', JSON.stringify(exportedPolicy, null, 2).split('\n').join('\n  '));
      console.log('  TypeScript:', JSON.stringify(tsPolicy, null, 2).split('\n').join('\n  '));
    }
  }
  
  for (const id of Object.keys(fromTypeScript)) {
    if (!exported.policies[id]) {
      mismatches.push(`Policy '${id}' exists in TypeScript source but not in export`);
    }
  }
  
  if (mismatches.length > 0) {
    console.error('Policy parity check FAILED:');
    for (const msg of mismatches) {
      console.error(`  - ${msg}`);
    }
    console.error('\nRun `npm run export:policies` to update the exported definitions.');
    process.exit(1);
  }
  
  console.log('Policy parity check PASSED.');
  console.log(`All ${Object.keys(exported.policies).length} policies match between export and TypeScript source.`);
}

main().catch((error) => {
  console.error(`Policy parity test error: ${error.message}`);
  process.exit(1);
});
