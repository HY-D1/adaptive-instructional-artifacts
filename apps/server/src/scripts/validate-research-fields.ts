#!/usr/bin/env node
/**
 * RESEARCH-4: Canonical Field Validation Gate
 * + Paper Data Contract Extensions
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

// Paper data contract: hint_view required fields
const HINT_VIEW_REQUIRED_FIELDS = [
  'hint_id',
  'hint_text',
  'hint_level',
  'template_id',
  'sql_engage_subtype',
  'sql_engage_row_id',
  'policy_version',
  'help_request_index',
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

interface HintViewValidationResult {
  total: number;
  present: Record<string, number>;
  ratios: Record<string, number>;
  passed: boolean;
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

function validateHintViewCompleteness(events: any[]): HintViewValidationResult {
  const hintViews = events.filter(e => e.event_type === 'hint_view');
  const total = hintViews.length;

  if (total === 0) {
    return { total: 0, present: {}, ratios: {}, passed: true };
  }

  const present: Record<string, number> = {};
  const ratios: Record<string, number> = {};
  let allPassed = true;

  for (const field of HINT_VIEW_REQUIRED_FIELDS) {
    const count = hintViews.filter(e => {
      const value = e[field];
      return value !== undefined && value !== null && value !== '';
    }).length;
    present[field] = count;
    ratios[field] = count / total;
    if (ratios[field] < 0.99) {
      allPassed = false;
    }
  }

  return { total, present, ratios, passed: allPassed };
}

function validateConceptViewCompleteness(events: any[]): { total: number; passed: boolean; ratios: Record<string, number> } {
  const conceptViews = events.filter(e => e.event_type === 'concept_view');
  const total = conceptViews.length;

  if (total === 0) {
    return { total: 0, passed: true, ratios: {} };
  }

  const conceptIdCount = conceptViews.filter(e => {
    const value = e.concept_id;
    return value !== undefined && value !== null && value !== '';
  }).length;
  const sourceCount = conceptViews.filter(e => {
    const value = e.source;
    return value !== undefined && value !== null && value !== '';
  }).length;

  const conceptIdRatio = conceptIdCount / total;
  const sourceRatio = sourceCount / total;

  return {
    total,
    passed: conceptIdRatio >= 0.99 && sourceRatio >= 0.99,
    ratios: { concept_id: conceptIdRatio, source: sourceRatio },
  };
}

function validateSessionEndCompleteness(events: any[]): { total: number; passed: boolean; ratios: Record<string, number> } {
  const sessionEnds = events.filter(e => e.event_type === 'session_end');
  const total = sessionEnds.length;

  if (total === 0) {
    return { total: 0, passed: true, ratios: {} };
  }

  const totalTimeCount = sessionEnds.filter(e => e.total_time !== undefined && e.total_time !== null).length;
  const attemptedCount = sessionEnds.filter(e => e.problems_attempted !== undefined && e.problems_attempted !== null).length;
  const solvedCount = sessionEnds.filter(e => e.problems_solved !== undefined && e.problems_solved !== null).length;

  const totalTimeRatio = totalTimeCount / total;
  const attemptedRatio = attemptedCount / total;
  const solvedRatio = solvedCount / total;

  return {
    total,
    passed: totalTimeRatio >= 0.99 && attemptedRatio >= 0.99 && solvedRatio >= 0.99,
    ratios: {
      total_time: totalTimeRatio,
      problems_attempted: attemptedRatio,
      problems_solved: solvedRatio,
    },
  };
}

function validateCodeChangeBursts(events: any[]): { total: number; under1s: number; ratio: number; passed: boolean } {
  const codeChanges = events
    .filter(e => e.event_type === 'code_change')
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  const total = codeChanges.length;
  if (total < 2) {
    return { total, under1s: 0, ratio: 0, passed: true };
  }

  let under1s = 0;
  for (let i = 1; i < codeChanges.length; i++) {
    const curr = new Date(codeChanges[i].timestamp).getTime();
    const prev = new Date(codeChanges[i - 1].timestamp).getTime();
    const diffMs = curr - prev;
    if (diffMs < 1000) {
      under1s++;
    }
  }

  const ratio = under1s / total;
  return { total, under1s, ratio, passed: ratio <= 0.30 };
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
  console.log('║  + Paper Data Contract Extensions                             ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log();

  let overallPassed = true;
  const allErrors: string[] = [];

  // 1. Check export directory exists
  if (!fs.existsSync(OUTPUT_DIR)) {
    console.error(`❌ Export directory not found: ${OUTPUT_DIR}`);
    console.error('   Run "npm run research:export" first.');
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

    // Paper data contract: hint_view completeness
    console.log();
    console.log('📋 Checking hint_view completeness (Paper Data Contract)...');
    const hintResult = validateHintViewCompleteness(events);
    if (hintResult.total === 0) {
      console.log('   ⚠ No hint_view events found');
    } else {
      console.log(`   Total hint_view events: ${hintResult.total}`);
      for (const field of HINT_VIEW_REQUIRED_FIELDS) {
        const ratio = hintResult.ratios[field];
        const count = hintResult.present[field];
        const status = ratio >= 0.99 ? '✓' : '❌';
        const color = ratio >= 0.99 ? '\x1b[32m' : '\x1b[31m';
        const reset = '\x1b[0m';
        console.log(`   ${color}${status}${reset} ${field}: ${count}/${hintResult.total} (${(ratio * 100).toFixed(2)}%)`);
      }
      if (!hintResult.passed) {
        overallPassed = false;
        allErrors.push('hint_view completeness below 99% threshold for one or more fields');
      }
    }

    // Paper data contract: concept_view completeness
    console.log();
    console.log('📋 Checking concept_view completeness (Paper Data Contract)...');
    const conceptResult = validateConceptViewCompleteness(events);
    if (conceptResult.total === 0) {
      console.log('   ⚠ No concept_view events found');
    } else {
      console.log(`   Total concept_view events: ${conceptResult.total}`);
      for (const [field, ratio] of Object.entries(conceptResult.ratios)) {
        const status = ratio >= 0.99 ? '✓' : '❌';
        const color = ratio >= 0.99 ? '\x1b[32m' : '\x1b[31m';
        const reset = '\x1b[0m';
        console.log(`   ${color}${status}${reset} ${field}: (${(ratio * 100).toFixed(2)}%)`);
      }
      if (!conceptResult.passed) {
        overallPassed = false;
        allErrors.push('concept_view completeness below 99% threshold');
      }
    }

    // Paper data contract: session_end completeness
    console.log();
    console.log('📋 Checking session_end completeness (Paper Data Contract)...');
    const sessionResult = validateSessionEndCompleteness(events);
    if (sessionResult.total === 0) {
      console.log('   ⚠ No session_end events found');
    } else {
      console.log(`   Total session_end events: ${sessionResult.total}`);
      for (const [field, ratio] of Object.entries(sessionResult.ratios)) {
        const status = ratio >= 0.99 ? '✓' : '❌';
        const color = ratio >= 0.99 ? '\x1b[32m' : '\x1b[31m';
        const reset = '\x1b[0m';
        console.log(`   ${color}${status}${reset} ${field}: (${(ratio * 100).toFixed(2)}%)`);
      }
      if (!sessionResult.passed) {
        overallPassed = false;
        allErrors.push('session_end completeness below 99% threshold');
      }
    }

    // Paper data contract: code_change burst metrics
    console.log();
    console.log('📋 Checking code_change burst metrics (Paper Data Contract)...');
    const burstResult = validateCodeChangeBursts(events);
    if (burstResult.total === 0) {
      console.log('   ⚠ No code_change events found');
    } else {
      const pctUnder1s = (burstResult.ratio * 100).toFixed(2);
      const status = burstResult.passed ? '✓' : '❌';
      const color = burstResult.passed ? '\x1b[32m' : '\x1b[31m';
      const reset = '\x1b[0m';
      console.log(`   ${color}${status}${reset} Events under 1s: ${burstResult.under1s}/${burstResult.total} (${pctUnder1s}%)`);
      console.log(`       Threshold: 30% max`);
      if (!burstResult.passed) {
        overallPassed = false;
        allErrors.push(`code_change burst ratio (${pctUnder1s}%) exceeds 30% threshold - editor debouncing needed`);
      }
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

  // 6. Check for new derived export files (Message 4/5)
  console.log();
  console.log('📋 Checking derived export files (Message 4/5)...');
  const derivedFiles = ['hint_events.json', 'hint_response_windows.json', 'escalation_events.json'];
  for (const filename of derivedFiles) {
    const data = readJsonFile(filename);
    if (data) {
      console.log(`   ✓ ${filename}: ${data.length} records`);
    } else {
      console.log(`   ⚠ ${filename}: not found (will be generated in Message 4)`);
    }
  }

  console.log();

  // Summary
  if (overallPassed) {
    console.log('✅ VALIDATION PASSED — All canonical fields present in exported data');
    console.log('✅ Paper Data Contract thresholds met');
    process.exit(0);
  } else {
    console.error('❌ VALIDATION FAILED — Issues found in exported data');
    console.error();
    console.error('Failures:');
    for (const err of allErrors) {
      console.error(`  • ${err}`);
    }
    console.error();
    console.error('For hint/template field issues: Check hint generation and storage normalization');
    console.error('For editor burst issues: Implement debouncing in LearningInterface.tsx');
    process.exit(1);
  }
}

main();
