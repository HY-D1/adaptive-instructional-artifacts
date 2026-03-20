#!/usr/bin/env node
/**
 * RESEARCH-4: Canonical Field Validation Gate
 *
 * Validates that exported research data contains the required canonical study fields.
 * Exits with code 0 if all checks pass, code 1 if any canonical fields are missing.
 *
 * Run with: npx tsx apps/server/src/scripts/validate-research-fields.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const OUTPUT_DIR = '../../dist/research-4';

// Canonical fields required in the export per RESEARCH-4 spec
const CANONICAL_FIELDS = [
  'learner_profile_id',
  'escalation_trigger_reason',
  'error_count_at_escalation',
  'time_to_escalation',
  'strategy_assigned',
  'strategy_updated',
  'reward_value',
] as const;

// Which event types should carry which canonical fields
const EVENT_FIELD_REQUIREMENTS: Record<string, (typeof CANONICAL_FIELDS[number])[]> = {
  profile_assigned: ['learner_profile_id', 'strategy_assigned'],
  escalation_triggered: ['learner_profile_id', 'escalation_trigger_reason', 'error_count_at_escalation'],
  bandit_arm_selected: ['strategy_assigned'],
  bandit_reward_observed: ['strategy_updated', 'reward_value'],
  bandit_updated: ['strategy_updated'],
};

interface ValidationResult {
  passed: boolean;
  errors: string[];
  warnings: string[];
  summary: {
    eventsChecked: number;
    eventTypesCovered: string[];
    missingFields: string[];
  };
}

function readJsonFile(filename: string): any[] | null {
  const filePath = path.join(OUTPUT_DIR, filename);
  if (!fs.existsSync(filePath)) {
    return null;
  }
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

function validateEvents(events: any[]): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const eventTypesSeen = new Set<string>();
  let eventsChecked = 0;
  const missingFieldsSet = new Set<string>();

  for (const event of events) {
    const eventType = event.event_type as string;
    if (!eventType) continue;

    eventsChecked++;
    eventTypesSeen.add(eventType);

    const required = EVENT_FIELD_REQUIREMENTS[eventType];
    if (!required) continue;

    for (const field of required) {
      const value = event[field];
      if (value === undefined || value === null || value === '') {
        errors.push(`Event type "${eventType}" (id: ${event.id || 'unknown'}) missing canonical field: ${field}`);
        missingFieldsSet.add(field);
      }
    }
  }

  // Check that we have at least one event for each critical event type
  const criticalTypes = Object.keys(EVENT_FIELD_REQUIREMENTS);
  for (const eventType of criticalTypes) {
    if (!eventTypesSeen.has(eventType)) {
      warnings.push(`No events of type "${eventType}" found — canonical field coverage for this type is unverified`);
    }
  }

  return {
    passed: errors.length === 0,
    errors,
    warnings,
    summary: {
      eventsChecked,
      eventTypesCovered: [...eventTypesSeen],
      missingFields: [...missingFieldsSet],
    },
  };
}

function validateDataDictionary(): string[] {
  const dictPath = path.join(__dirname, '../../../../docs/research/RESEARCH-4-DATA-DICTIONARY.md');
  const errors: string[] = [];

  if (!fs.existsSync(dictPath)) {
    errors.push(`Data dictionary not found at: ${dictPath}`);
    return errors;
  }

  const content = fs.readFileSync(dictPath, 'utf8');
  for (const field of CANONICAL_FIELDS) {
    if (!content.includes(field)) {
      errors.push(`Data dictionary missing documentation for canonical field: ${field}`);
    }
  }

  return errors;
}

function main() {
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║  RESEARCH-4: Canonical Field Validation Gate                  ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log();

  let overallPassed = true;
  const allErrors: string[] = [];

  // 1. Check export directory exists
  if (!fs.existsSync(OUTPUT_DIR)) {
    console.error(`❌ Export directory not found: ${OUTPUT_DIR}`);
    console.error('   Run "npm run research:export:sample" first.');
    process.exit(1);
  }

  // 2. Validate interaction_events.json (primary events file)
  console.log('📋 Checking interaction_events.json...');
  const events = readJsonFile('interaction_events.json');
  if (!events) {
    console.error('   ❌ interaction_events.json not found or invalid');
    overallPassed = false;
  } else {
    const result = validateEvents(events);

    if (result.errors.length > 0) {
      overallPassed = false;
      for (const err of result.errors) {
        console.error(`   ❌ ${err}`);
        allErrors.push(err);
      }
    } else {
      console.log('   ✓ All present canonical fields validated');
    }

    if (result.warnings.length > 0) {
      for (const warn of result.warnings) {
        console.warn(`   ⚠  ${warn}`);
      }
    }

    console.log(`   Checked ${result.summary.eventsChecked} events`);
    console.log(`   Event types seen: ${result.summary.eventTypesCovered.join(', ') || '(none)'}`);
    if (result.summary.missingFields.length > 0) {
      console.log(`   Missing fields: ${result.summary.missingFields.join(', ')}`);
    }
  }

  console.log();

  // 3. Validate bandit_events.json
  console.log('📋 Checking bandit_events.json...');
  const banditEvents = readJsonFile('bandit_events.json');
  if (!banditEvents) {
    console.warn('   ⚠  bandit_events.json not found (may be empty if no bandit events logged)');
  } else if (banditEvents.length > 0) {
    const result = validateEvents(banditEvents);
    if (result.errors.length > 0) {
      overallPassed = false;
      for (const err of result.errors) {
        console.error(`   ❌ ${err}`);
        allErrors.push(err);
      }
    } else {
      console.log(`   ✓ ${banditEvents.length} bandit events validated`);
    }
  } else {
    console.log('   ✓ No bandit events (empty file)');
  }

  console.log();

  // 4. Validate escalation_events.json
  console.log('📋 Checking escalation_events.json...');
  const escalationEvents = readJsonFile('escalation_events.json');
  if (!escalationEvents) {
    console.warn('   ⚠  escalation_events.json not found');
  } else if (escalationEvents.length > 0) {
    const result = validateEvents(escalationEvents);
    if (result.errors.length > 0) {
      overallPassed = false;
      for (const err of result.errors) {
        console.error(`   ❌ ${err}`);
        allErrors.push(err);
      }
    } else {
      console.log(`   ✓ ${escalationEvents.length} escalation events validated`);
    }
  } else {
    console.log('   ✓ No escalation events (empty file)');
  }

  console.log();

  // 5. Validate data dictionary coverage
  console.log('📋 Checking data dictionary...');
  const dictErrors = validateDataDictionary();
  if (dictErrors.length > 0) {
    for (const err of dictErrors) {
      console.warn(`   ⚠  ${err}`);
    }
  } else {
    console.log('   ✓ Data dictionary covers all canonical fields');
  }

  console.log();

  // Summary
  if (overallPassed) {
    console.log('✅ VALIDATION PASSED — All canonical fields present in exported data');
    process.exit(0);
  } else {
    console.error('❌ VALIDATION FAILED — Canonical fields missing from exported data');
    console.error();
    console.error('Failures:');
    for (const err of allErrors) {
      console.error(`  • ${err}`);
    }
    console.error();
    console.error('These fields must be populated at log time (not computed at export).');
    console.error('Check: storage.ts logEscalationTriggered / logBanditRewardObserved / logBanditUpdated / logProfileAssigned');
    process.exit(1);
  }
}

main();
