#!/usr/bin/env node
/**
 * Research Fields Validation Script
 *
 * Validates all interaction_events against research contract.
 * Run with: npx tsx apps/server/src/scripts/validate-research-fields.ts
 *
 * @module scripts/validate-research-fields
 */

import { neon } from '@neondatabase/serverless';

const DATABASE_URL = process.env.DATABASE_URL || process.env.NEON_DATABASE_URL;

interface ValidationRule {
  eventType: string;
  requiredFields: string[];
}

const RESEARCH_VALIDATION_RULES: ValidationRule[] = [
  {
    eventType: 'hint_view',
    requiredFields: [
      'hintId',
      'hintText',
      'hintLevel',
      'templateId',
      'sqlEngageSubtype',
      'sqlEngageRowId',
      'policyVersion',
      'helpRequestIndex',
    ],
  },
  {
    eventType: 'concept_view',
    requiredFields: ['conceptId', 'source'],
  },
  {
    eventType: 'session_end',
    requiredFields: [
      'sessionId',
      'totalTime',
      'problemsAttempted',
      'problemsSolved',
    ],
  },
];

interface ValidationReport {
  timestamp: string;
  totalEvents: number;
  byEventType: Record<string, number>;
  validationResults: {
    eventType: string;
    total: number;
    valid: number;
    invalid: number;
    missingFields: Record<string, number>;
  }[];
}

function validateEvent(event: any, rule: ValidationRule): { valid: boolean; missing: string[] } {
  const missing: string[] = [];

  for (const field of rule.requiredFields) {
    let hasField = false;

    switch (field) {
      case 'hintId':
        hasField = event.hint_id && event.hint_id.trim() !== '';
        break;
      case 'hintText':
        hasField = event.hint_text && event.hint_text.trim() !== '';
        break;
      case 'hintLevel':
        hasField = event.hint_level !== null && [1, 2, 3].includes(event.hint_level);
        break;
      case 'templateId':
        hasField = event.template_id && event.template_id.trim() !== '';
        break;
      case 'sqlEngageSubtype':
        hasField = event.sql_engage_subtype && event.sql_engage_subtype.trim() !== '';
        break;
      case 'sqlEngageRowId':
        hasField = event.sql_engage_row_id && event.sql_engage_row_id.trim() !== '';
        break;
      case 'policyVersion':
        hasField = event.policy_version && event.policy_version.trim() !== '';
        break;
      case 'helpRequestIndex':
        hasField = event.help_request_index !== null && event.help_request_index >= 1;
        break;
      case 'conceptId':
        hasField = event.concept_id && event.concept_id.trim() !== '';
        break;
      case 'source':
        hasField = event.source && event.source.trim() !== '';
        break;
      case 'sessionId':
        hasField = event.session_id && event.session_id.trim() !== '';
        break;
      case 'totalTime':
        hasField = event.total_time !== null && event.total_time >= 0;
        break;
      case 'problemsAttempted':
        hasField = event.problems_attempted !== null && event.problems_attempted >= 0;
        break;
      case 'problemsSolved':
        hasField = event.problems_solved !== null && event.problems_solved >= 0;
        break;
    }

    if (!hasField) {
      missing.push(field);
    }
  }

  return { valid: missing.length === 0, missing };
}

async function main() {
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║  Research Fields Validation                                  ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log();

  if (!DATABASE_URL) {
    console.error('❌ Error: DATABASE_URL environment variable is not set');
    process.exit(1);
  }

  const db = neon(DATABASE_URL);

  try {
    console.log('📊 Querying interaction events...');

    // Get counts by event type
    const countResult = await db`
      SELECT event_type, COUNT(*) as count
      FROM interaction_events
      GROUP BY event_type
    `;

    const byEventType: Record<string, number> = {};
    for (const row of countResult) {
      byEventType[row.event_type] = parseInt(row.count, 10);
    }

    const totalEvents = Object.values(byEventType).reduce((a, b) => a + b, 0);
    console.log(`   Total events: ${totalEvents}`);
    console.log();

    const validationResults: ValidationReport['validationResults'] = [];

    // Validate each event type with rules
    for (const rule of RESEARCH_VALIDATION_RULES) {
      console.log(`🔍 Validating ${rule.eventType} events...`);

      const events = await db`
        SELECT *
        FROM interaction_events
        WHERE event_type = ${rule.eventType}
      `;

      let valid = 0;
      let invalid = 0;
      const missingFields: Record<string, number> = {};

      for (const event of events) {
        const result = validateEvent(event, rule);
        if (result.valid) {
          valid++;
        } else {
          invalid++;
          for (const field of result.missing) {
            missingFields[field] = (missingFields[field] || 0) + 1;
          }
        }
      }

      validationResults.push({
        eventType: rule.eventType,
        total: events.length,
        valid,
        invalid,
        missingFields,
      });

      console.log(`   Total: ${events.length}`);
      console.log(`   Valid: ${valid}`);
      console.log(`   Invalid: ${invalid}`);
      if (invalid > 0) {
        console.log('   Missing fields:');
        for (const [field, count] of Object.entries(missingFields)) {
          console.log(`     ${field}: ${count}`);
        }
      }
      console.log();
    }

    // Print summary
    console.log('═══════════════════════════════════════════════════════════════════');
    console.log('                    VALIDATION SUMMARY                             ');
    console.log('═══════════════════════════════════════════════════════════════════');
    console.log();
    console.log(`Total events: ${totalEvents}`);
    console.log();

    for (const result of validationResults) {
      const pct = result.total > 0 ? ((result.valid / result.total) * 100).toFixed(1) : '0.0';
      console.log(`${result.eventType}:`);
      console.log(`  Total: ${result.total}`);
      console.log(`  Valid: ${result.valid} (${pct}%)`);
      if (result.invalid > 0) {
        console.log(`  Invalid: ${result.invalid}`);
        console.log('  Missing fields:');
        for (const [field, count] of Object.entries(result.missingFields)) {
          console.log(`    ${field}: ${count}`);
        }
      }
      console.log();
    }

    // Exit with error code if any invalid events found
    const totalInvalid = validationResults.reduce((sum, r) => sum + r.invalid, 0);
    if (totalInvalid > 0) {
      console.log(`⚠️  ${totalInvalid} events failed validation`);
      process.exit(1);
    } else {
      console.log('✅ All events passed validation');
    }

  } catch (error) {
    console.error('❌ Validation failed:', error);
    process.exit(1);
  }
}

main();
