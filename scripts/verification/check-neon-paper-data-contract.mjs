#!/usr/bin/env node
/**
 * Research-Ready Paper Data Contract Gate
 *
 * Validates row-level completeness and semantic thresholds for research-grade telemetry.
 * This is stricter than the schema contract gate - it checks that data is actually populated,
 * not just that columns exist.
 *
 * Run with: node scripts/verification/check-neon-paper-data-contract.mjs
 *
 * Exit codes:
 *   0 - All research-readiness thresholds met
 *   1 - One or more thresholds failed
 */

import { neon } from '@neondatabase/serverless';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Configuration
const DATABASE_URL = process.env.DATABASE_URL || process.env.NEON_DATABASE_URL;

// Research-readiness thresholds (99% = 0.99)
const THRESHOLDS = {
  hintIdCompleteness: 0.99,
  templateIdCompleteness: 0.99,
  hintTextCompleteness: 0.99,
  hintLevelCompleteness: 0.99,
  conceptViewCompleteness: 0.99,
  sessionEndCompleteness: 0.99,
  codeChangeBurstRatio: 0.30, // Max 30% of code_changes should be under 1s
};

// Colors for terminal output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function colorize(color, text) {
  return `${colors[color]}${text}${colors.reset}`;
}

async function runQuery(db, query, params = []) {
  return db.query(query, params);
}

/**
 * Main gate execution
 */
async function main() {
  console.log(colorize('cyan', '╔══════════════════════════════════════════════════════════════════╗'));
  console.log(colorize('cyan', '║     Research-Ready Paper Data Contract Gate                     ║'));
  console.log(colorize('cyan', '║     Validates row-level completeness and semantic thresholds    ║'));
  console.log(colorize('cyan', '╚══════════════════════════════════════════════════════════════════╝'));
  console.log();

  if (!DATABASE_URL) {
    console.error(colorize('red', '❌ Error: DATABASE_URL environment variable is not set'));
    console.error('   Set it with: export DATABASE_URL=postgresql://...');
    process.exit(1);
  }

  const db = neon(DATABASE_URL);
  const results = {
    passed: [],
    failed: [],
    warnings: [],
  };

  try {
    // Check 1: Hint view completeness
    console.log(colorize('blue', '🔍 Checking hint_view completeness...'));
    await checkHintViewCompleteness(db, results);
    console.log();

    // Check 2: Concept view completeness
    console.log(colorize('blue', '🔍 Checking concept_view completeness...'));
    await checkConceptViewCompleteness(db, results);
    console.log();

    // Check 3: Session end completeness
    console.log(colorize('blue', '🔍 Checking session_end completeness...'));
    await checkSessionEndCompleteness(db, results);
    console.log();

    // Check 4: Editor burst noise
    console.log(colorize('blue', '🔍 Checking editor telemetry burst metrics...'));
    await checkEditorBurstMetrics(db, results);
    console.log();

    // Check 5: Template ID coverage
    console.log(colorize('blue', '🔍 Checking template_id coverage...'));
    await checkTemplateIdCoverage(db, results);
    console.log();

    // Print summary
    printSummary(results);

    // Exit with appropriate code
    if (results.failed.length > 0) {
      process.exit(1);
    }
    process.exit(0);

  } catch (error) {
    console.error(colorize('red', `❌ Gate execution failed: ${error.message}`));
    if (process.env.DEBUG) {
      console.error(error);
    }
    process.exit(1);
  }
}

/**
 * Check hint_view event completeness
 */
async function checkHintViewCompleteness(db, results) {
  const query = `
    SELECT 
      COUNT(*) as total_hint_views,
      COUNT(hint_id) FILTER (WHERE hint_id IS NOT NULL AND btrim(hint_id) != '') as hint_id_present,
      COUNT(hint_text) FILTER (WHERE hint_text IS NOT NULL AND btrim(hint_text) != '') as hint_text_present,
      COUNT(hint_level) FILTER (WHERE hint_level IS NOT NULL) as hint_level_present,
      COUNT(sql_engage_subtype) FILTER (WHERE sql_engage_subtype IS NOT NULL AND btrim(sql_engage_subtype) != '') as subtype_present,
      COUNT(sql_engage_row_id) FILTER (WHERE sql_engage_row_id IS NOT NULL AND btrim(sql_engage_row_id) != '') as row_id_present,
      COUNT(policy_version) FILTER (WHERE policy_version IS NOT NULL AND btrim(policy_version) != '') as policy_version_present,
      COUNT(help_request_index) FILTER (WHERE help_request_index IS NOT NULL) as help_index_present
    FROM interaction_events 
    WHERE event_type = 'hint_view'
  `;

  const [row] = await runQuery(db, query);
  const total = parseInt(row.total_hint_views, 10);

  if (total === 0) {
    results.warnings.push({
      check: 'hint_view completeness',
      message: 'No hint_view events found in database',
    });
    console.log(colorize('yellow', '   ⚠ No hint_view events found'));
    return;
  }

  const metrics = {
    hintId: { present: parseInt(row.hint_id_present, 10), threshold: THRESHOLDS.hintIdCompleteness, name: 'hint_id' },
    hintText: { present: parseInt(row.hint_text_present, 10), threshold: THRESHOLDS.hintTextCompleteness, name: 'hint_text' },
    hintLevel: { present: parseInt(row.hint_level_present, 10), threshold: THRESHOLDS.hintLevelCompleteness, name: 'hint_level' },
    subtype: { present: parseInt(row.subtype_present, 10), threshold: THRESHOLDS.hintIdCompleteness, name: 'sql_engage_subtype' },
    rowId: { present: parseInt(row.row_id_present, 10), threshold: THRESHOLDS.hintIdCompleteness, name: 'sql_engage_row_id' },
    policyVersion: { present: parseInt(row.policy_version_present, 10), threshold: THRESHOLDS.hintIdCompleteness, name: 'policy_version' },
    helpIndex: { present: parseInt(row.help_index_present, 10), threshold: THRESHOLDS.hintIdCompleteness, name: 'help_request_index' },
  };

  for (const [key, metric] of Object.entries(metrics)) {
    const ratio = metric.present / total;
    const passed = ratio >= metric.threshold;
    const status = passed ? colorize('green', '✓') : colorize('red', '✗');
    const ratioStr = `${(ratio * 100).toFixed(2)}%`;
    
    console.log(`   ${status} ${metric.name}: ${metric.present}/${total} (${ratioStr})`);

    if (passed) {
      results.passed.push({
        check: `hint_view ${metric.name}`,
        ratio,
        threshold: metric.threshold,
      });
    } else {
      results.failed.push({
        check: `hint_view ${metric.name}`,
        ratio,
        threshold: metric.threshold,
        present: metric.present,
        total,
      });
    }
  }
}

/**
 * Check concept_view event completeness
 */
async function checkConceptViewCompleteness(db, results) {
  const query = `
    SELECT 
      COUNT(*) as total_concept_views,
      COUNT(concept_id) FILTER (WHERE concept_id IS NOT NULL AND btrim(concept_id) != '') as concept_id_present,
      COUNT(source) FILTER (WHERE source IS NOT NULL AND btrim(source) != '') as source_present
    FROM interaction_events 
    WHERE event_type = 'concept_view'
  `;

  const [row] = await runQuery(db, query);
  const total = parseInt(row.total_concept_views, 10);

  if (total === 0) {
    results.warnings.push({
      check: 'concept_view completeness',
      message: 'No concept_view events found in database',
    });
    console.log(colorize('yellow', '   ⚠ No concept_view events found'));
    return;
  }

  const conceptIdRatio = parseInt(row.concept_id_present, 10) / total;
  const sourceRatio = parseInt(row.source_present, 10) / total;

  // Check concept_id
  const conceptIdPassed = conceptIdRatio >= THRESHOLDS.conceptViewCompleteness;
  const conceptIdStatus = conceptIdPassed ? colorize('green', '✓') : colorize('red', '✗');
  console.log(`   ${conceptIdStatus} concept_id: ${row.concept_id_present}/${total} (${(conceptIdRatio * 100).toFixed(2)}%)`);

  if (conceptIdPassed) {
    results.passed.push({ check: 'concept_view concept_id', ratio: conceptIdRatio });
  } else {
    results.failed.push({
      check: 'concept_view concept_id',
      ratio: conceptIdRatio,
      threshold: THRESHOLDS.conceptViewCompleteness,
    });
  }

  // Check source
  const sourcePassed = sourceRatio >= THRESHOLDS.conceptViewCompleteness;
  const sourceStatus = sourcePassed ? colorize('green', '✓') : colorize('red', '✗');
  console.log(`   ${sourceStatus} source: ${row.source_present}/${total} (${(sourceRatio * 100).toFixed(2)}%)`);

  if (sourcePassed) {
    results.passed.push({ check: 'concept_view source', ratio: sourceRatio });
  } else {
    results.failed.push({
      check: 'concept_view source',
      ratio: sourceRatio,
      threshold: THRESHOLDS.conceptViewCompleteness,
    });
  }
}

/**
 * Check session_end event completeness
 */
async function checkSessionEndCompleteness(db, results) {
  const query = `
    SELECT 
      COUNT(*) as total_session_ends,
      COUNT(total_time) FILTER (WHERE total_time IS NOT NULL) as total_time_present,
      COUNT(problems_attempted) FILTER (WHERE problems_attempted IS NOT NULL) as attempted_present,
      COUNT(problems_solved) FILTER (WHERE problems_solved IS NOT NULL) as solved_present
    FROM interaction_events 
    WHERE event_type = 'session_end'
  `;

  const [row] = await runQuery(db, query);
  const total = parseInt(row.total_session_ends, 10);

  if (total === 0) {
    results.warnings.push({
      check: 'session_end completeness',
      message: 'No session_end events found in database',
    });
    console.log(colorize('yellow', '   ⚠ No session_end events found'));
    return;
  }

  const metrics = {
    totalTime: { present: parseInt(row.total_time_present, 10), name: 'total_time' },
    attempted: { present: parseInt(row.attempted_present, 10), name: 'problems_attempted' },
    solved: { present: parseInt(row.solved_present, 10), name: 'problems_solved' },
  };

  for (const [key, metric] of Object.entries(metrics)) {
    const ratio = metric.present / total;
    const passed = ratio >= THRESHOLDS.sessionEndCompleteness;
    const status = passed ? colorize('green', '✓') : colorize('red', '✗');
    
    console.log(`   ${status} ${metric.name}: ${metric.present}/${total} (${(ratio * 100).toFixed(2)}%)`);

    if (passed) {
      results.passed.push({ check: `session_end ${metric.name}`, ratio });
    } else {
      results.failed.push({
        check: `session_end ${metric.name}`,
        ratio,
        threshold: THRESHOLDS.sessionEndCompleteness,
      });
    }
  }
}

/**
 * Check editor burst metrics (code_change noise)
 */
async function checkEditorBurstMetrics(db, results) {
  // Count code_change events under 1 second apart (burst indicator)
  const burstQuery = `
    WITH code_changes AS (
      SELECT 
        id,
        timestamp,
        LAG(timestamp) OVER (ORDER BY timestamp) as prev_timestamp
      FROM interaction_events
      WHERE event_type = 'code_change'
    )
    SELECT 
      COUNT(*) as total_code_changes,
      COUNT(*) FILTER (WHERE prev_timestamp IS NOT NULL 
                       AND EXTRACT(EPOCH FROM (timestamp::timestamp - prev_timestamp::timestamp)) < 1) as under_1s
    FROM code_changes
  `;

  const [burstRow] = await runQuery(db, burstQuery);
  const totalChanges = parseInt(burstRow.total_code_changes, 10);
  const under1s = parseInt(burstRow.under_1s, 10);

  if (totalChanges === 0) {
    results.warnings.push({
      check: 'editor burst metrics',
      message: 'No code_change events found in database',
    });
    console.log(colorize('yellow', '   ⚠ No code_change events found'));
    return;
  }

  const burstRatio = under1s / totalChanges;
  const passed = burstRatio <= THRESHOLDS.codeChangeBurstRatio;
  const status = passed ? colorize('green', '✓') : colorize('red', '✗');

  console.log(`   ${status} code_change events under 1s: ${under1s}/${totalChanges} (${(burstRatio * 100).toFixed(2)}%)`);
  console.log(`       Threshold: ${(THRESHOLDS.codeChangeBurstRatio * 100).toFixed(0)}% max`);

  if (passed) {
    results.passed.push({ check: 'editor burst ratio', ratio: burstRatio });
  } else {
    results.failed.push({
      check: 'editor burst ratio',
      ratio: burstRatio,
      threshold: THRESHOLDS.codeChangeBurstRatio,
      message: 'Editor telemetry has excessive burst noise. Implement debouncing.',
    });
  }
}

/**
 * Check template_id coverage on hint_view events
 */
async function checkTemplateIdCoverage(db, results) {
  const query = `
    SELECT 
      COUNT(*) as total_hint_views,
      COUNT(template_id) FILTER (WHERE template_id IS NOT NULL AND btrim(template_id) != '') as template_id_present
    FROM interaction_events 
    WHERE event_type = 'hint_view'
  `;

  const [row] = await runQuery(db, query);
  const total = parseInt(row.total_hint_views, 10);

  if (total === 0) {
    results.warnings.push({
      check: 'template_id coverage',
      message: 'No hint_view events found for template_id check',
    });
    console.log(colorize('yellow', '   ⚠ No hint_view events found'));
    return;
  }

  const present = parseInt(row.template_id_present, 10);
  const ratio = present / total;
  const passed = ratio >= THRESHOLDS.templateIdCompleteness;
  const status = passed ? colorize('green', '✓') : colorize('red', '✗');

  console.log(`   ${status} template_id: ${present}/${total} (${(ratio * 100).toFixed(2)}%)`);

  if (passed) {
    results.passed.push({ check: 'hint_view template_id', ratio });
  } else {
    results.failed.push({
      check: 'hint_view template_id',
      ratio,
      threshold: THRESHOLDS.templateIdCompleteness,
      message: 'template_id is missing from most hint_view events. Implement template tracking in hint generation.',
    });
  }
}

/**
 * Print summary of all checks
 */
function printSummary(results) {
  console.log(colorize('cyan', '═══════════════════════════════════════════════════════════════════'));
  console.log(colorize('cyan', '                           SUMMARY                                 '));
  console.log(colorize('cyan', '═══════════════════════════════════════════════════════════════════'));
  console.log();

  if (results.passed.length > 0) {
    console.log(colorize('green', `✓ Passed: ${results.passed.length} checks`));
    for (const pass of results.passed) {
      console.log(colorize('green', `   • ${pass.check}`));
    }
    console.log();
  }

  if (results.warnings.length > 0) {
    console.log(colorize('yellow', `⚠ Warnings: ${results.warnings.length}`));
    for (const warning of results.warnings) {
      console.log(colorize('yellow', `   • ${warning.check}: ${warning.message}`));
    }
    console.log();
  }

  if (results.failed.length > 0) {
    console.log(colorize('red', `✗ Failed: ${results.failed.length} checks`));
    for (const fail of results.failed) {
      console.log(colorize('red', `   • ${fail.check}`));
      if (fail.ratio !== undefined) {
        console.log(colorize('red', `     Current: ${(fail.ratio * 100).toFixed(2)}%, Threshold: ${(fail.threshold * 100).toFixed(2)}%`));
      }
      if (fail.message) {
        console.log(colorize('red', `     ${fail.message}`));
      }
    }
    console.log();
    console.log(colorize('red', '═══════════════════════════════════════════════════════════════════'));
    console.log(colorize('red', '                    CONTRACT GATE FAILED                           '));
    console.log(colorize('red', '         Telemetry is NOT research-ready                         '));
    console.log(colorize('red', '═══════════════════════════════════════════════════════════════════'));
  } else {
    console.log(colorize('green', '═══════════════════════════════════════════════════════════════════'));
    console.log(colorize('green', '                    CONTRACT GATE PASSED                           '));
    console.log(colorize('green', '         Telemetry is research-ready!                            '));
    console.log(colorize('green', '═══════════════════════════════════════════════════════════════════'));
  }
}

// Run the gate
main();
