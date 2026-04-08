#!/usr/bin/env node
/**
 * Research Telemetry Backfill Script
 *
 * One-off backfill for paper-data contract compliance.
 * Run with: npx tsx apps/server/src/scripts/backfill-research-telemetry.ts [--dry-run]
 *
 * Responsibilities:
 * 1. Populate missing hint_id deterministically where evidence exists
 * 2. Backfill retrieval link rows from existing textbook_units_retrieved
 * 3. Report counts: recoverable hints, unverifiable template_ids, retrieval links created
 * 4. Do NOT fabricate template_id; mark as unverifiable and report
 *
 * @module scripts/backfill-research-telemetry
 */

import { neon } from '@neondatabase/serverless';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATABASE_URL = process.env.DATABASE_URL || process.env.NEON_DATABASE_URL;
const DRY_RUN = process.argv.includes('--dry-run');

interface BackfillReport {
  timestamp: string;
  dryRun: boolean;
  hintIdBackfill: {
    totalHintViews: number;
    missingHintIds: number;
    recoverable: number;
    unrecoverable: number;
  };
  templateIdReport: {
    totalHintViews: number;
    missingTemplateIds: number;
    markedUnverifiable: number;
  };
  retrievalLinks: {
    eventsWithRetrievals: number;
    linksCreated: number;
    failedParses: number;
  };
  // RESEARCH-5: Provenance tracking
  provenanceSummary: {
    nativeComplete: number;
    backfilledHintId: number;
    backfilledRetrieval: number;
    unverifiableTemplate: number;
    legacyPartial: number;
  };
}

async function main() {
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║  Research Telemetry Backfill                                 ║');
  console.log(DRY_RUN ? '║  MODE: DRY RUN (no changes will be made)' : '║  MODE: LIVE (changes will be committed)');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log();

  if (!DATABASE_URL) {
    console.error('❌ Error: DATABASE_URL environment variable is not set');
    process.exit(1);
  }

  const db = neon(DATABASE_URL);
  const report: BackfillReport = {
    timestamp: new Date().toISOString(),
    dryRun: DRY_RUN,
    hintIdBackfill: {
      totalHintViews: 0,
      missingHintIds: 0,
      recoverable: 0,
      unrecoverable: 0,
    },
    templateIdReport: {
      totalHintViews: 0,
      missingTemplateIds: 0,
      markedUnverifiable: 0,
    },
    retrievalLinks: {
      eventsWithRetrievals: 0,
      linksCreated: 0,
      failedParses: 0,
    },
    provenanceSummary: {
      nativeComplete: 0,
      backfilledHintId: 0,
      backfilledRetrieval: 0,
      unverifiableTemplate: 0,
      legacyPartial: 0,
    },
  };

  try {
    // Step 1: Analyze hint_view completeness
    console.log('📊 Analyzing hint_view completeness...');
    await analyzeHintViews(db, report);
    console.log();

    // Step 2: Backfill hint_id where possible
    console.log('🔧 Backfilling hint_id...');
    await backfillHintIds(db, report);
    console.log();

    // Step 3: Report template_id gaps
    console.log('📋 Reporting template_id gaps...');
    await reportTemplateIds(db, report);
    console.log();

    // Step 4: Backfill retrieval links
    console.log('🔗 Backfilling retrieval links...');
    await backfillRetrievalLinks(db, report);
    console.log();

    // Step 5: Analyze provenance distribution
    console.log('📊 Analyzing provenance distribution...');
    await analyzeProvenance(db, report);
    console.log();

    // Save report
    await saveReport(report);

    // Print summary
    printSummary(report);

  } catch (error) {
    console.error('❌ Backfill failed:', error);
    process.exit(1);
  }
}

async function analyzeHintViews(db: any, report: BackfillReport) {
  const result = await db`
    SELECT 
      COUNT(*) as total,
      COUNT(hint_id) FILTER (WHERE hint_id IS NOT NULL AND btrim(hint_id) != '') as has_hint_id,
      COUNT(template_id) FILTER (WHERE template_id IS NOT NULL AND btrim(template_id) != '') as has_template_id,
      COUNT(hint_text) FILTER (WHERE hint_text IS NOT NULL AND btrim(hint_text) != '') as has_hint_text
    FROM interaction_events 
    WHERE event_type = 'hint_view'
  `;

  const row = result[0];
  report.hintIdBackfill.totalHintViews = parseInt(row.total, 10);
  report.hintIdBackfill.missingHintIds = parseInt(row.total, 10) - parseInt(row.has_hint_id, 10);
  report.templateIdReport.totalHintViews = parseInt(row.total, 10);
  report.templateIdReport.missingTemplateIds = parseInt(row.total, 10) - parseInt(row.has_template_id, 10);

  console.log(`   Total hint_view events: ${row.total}`);
  console.log(`   With hint_id: ${row.has_hint_id}`);
  console.log(`   Missing hint_id: ${report.hintIdBackfill.missingHintIds}`);
  console.log(`   With template_id: ${row.has_template_id}`);
  console.log(`   Missing template_id: ${report.templateIdReport.missingTemplateIds}`);
}

async function backfillHintIds(db: any, report: BackfillReport) {
  // Find hint_view events that are missing hint_id but have enough info to derive one
  const missingHints = await db`
    SELECT 
      id,
      user_id,
      problem_id,
      sql_engage_subtype,
      sql_engage_row_id,
      hint_level,
      created_at
    FROM interaction_events 
    WHERE event_type = 'hint_view'
      AND (hint_id IS NULL OR btrim(hint_id) = '')
      AND sql_engage_subtype IS NOT NULL
      AND sql_engage_row_id IS NOT NULL
  `;

  console.log(`   Found ${missingHints.length} hints missing hint_id with recoverable data`);

  if (missingHints.length === 0) {
    return;
  }

  let recoverable = 0;
  let unrecoverable = 0;

  for (const hint of missingHints) {
    // Derive a deterministic hint_id
    const subtype = hint.sql_engage_subtype?.trim() || 'unknown';
    const rowId = hint.sql_engage_row_id?.trim() || 'unknown';
    const level = hint.hint_level || 1;
    const derivedHintId = `sql-engage:${subtype}:hint:${rowId}:L${level}`;

    if (!DRY_RUN) {
      try {
        await db`
          UPDATE interaction_events 
          SET hint_id = ${derivedHintId}
          WHERE id = ${hint.id}
        `;
        recoverable++;
      } catch (error) {
        console.warn(`   Failed to update hint ${hint.id}:`, error);
        unrecoverable++;
      }
    } else {
      recoverable++;
    }
  }

  report.hintIdBackfill.recoverable = recoverable;
  report.hintIdBackfill.unrecoverable = unrecoverable;

  console.log(`   ${DRY_RUN ? 'Would recover' : 'Recovered'}: ${recoverable}`);
  console.log(`   Unrecoverable: ${unrecoverable}`);
}

async function reportTemplateIds(db: any, report: BackfillReport) {
  // Count template_id gaps - we don't fabricate these
  const missingTemplates = await db`
    SELECT COUNT(*) as count
    FROM interaction_events 
    WHERE event_type = 'hint_view'
      AND (template_id IS NULL OR btrim(template_id) = '')
  `;

  const count = parseInt(missingTemplates[0].count, 10);
  report.templateIdReport.markedUnverifiable = count;

  console.log(`   Hints missing template_id: ${count}`);
  console.log('   ⚠️  These will be marked as "unverifiable" in exports');
  console.log('   ⚠️  Future hint events must include templateId at creation time');
}

async function backfillRetrievalLinks(db: any, report: BackfillReport) {
  // Find events with textbook_units_retrieved that don't have link table entries
  const eventsWithRetrievals = await db`
    SELECT 
      id as event_id,
      user_id,
      textbook_units_retrieved
    FROM interaction_events 
    WHERE textbook_units_retrieved IS NOT NULL 
      AND btrim(textbook_units_retrieved) != ''
      AND btrim(textbook_units_retrieved) != '[]'
      AND NOT EXISTS (
        SELECT 1 FROM interaction_textbook_unit_retrievals 
        WHERE interaction_textbook_unit_retrievals.event_id = interaction_events.id
      )
    LIMIT 1000
  `;

  console.log(`   Found ${eventsWithRetrievals.length} events with retrievals to backfill`);

  report.retrievalLinks.eventsWithRetrievals = eventsWithRetrievals.length;

  let linksCreated = 0;
  let failedParses = 0;

  for (const event of eventsWithRetrievals) {
    try {
      // Parse the JSON array of unit IDs
      const unitIds: string[] = JSON.parse(event.textbook_units_retrieved);

      if (!Array.isArray(unitIds)) {
        failedParses++;
        continue;
      }

      for (let i = 0; i < unitIds.length; i++) {
        const unitId = unitIds[i];

        if (!DRY_RUN) {
          await db`
            INSERT INTO interaction_textbook_unit_retrievals 
              (event_id, unit_id, rank, source_kind)
            VALUES 
              (${event.event_id}, ${unitId}, ${i + 1}, 'backfilled')
          `;
        }
        linksCreated++;
      }
    } catch (error) {
      console.warn(`   Failed to parse retrievals for event ${event.event_id}:`, error);
      failedParses++;
    }
  }

  report.retrievalLinks.linksCreated = linksCreated;
  report.retrievalLinks.failedParses = failedParses;

  console.log(`   ${DRY_RUN ? 'Would create' : 'Created'} ${linksCreated} retrieval links`);
  console.log(`   Failed parses: ${failedParses}`);
}

async function analyzeProvenance(db: any, report: BackfillReport) {
  // Count provenance statuses for hint_view events
  const result = await db`
    SELECT 
      COUNT(*) FILTER (
        WHERE hint_id IS NOT NULL AND template_id IS NOT NULL
      ) as native_complete,
      COUNT(*) FILTER (
        WHERE hint_id IS NOT NULL AND (template_id IS NULL OR btrim(template_id) = '')
      ) as missing_template,
      COUNT(*) FILTER (
        WHERE (hint_id IS NULL OR btrim(hint_id) = '') 
          AND sql_engage_subtype IS NOT NULL 
          AND sql_engage_row_id IS NOT NULL
      ) as recoverable_hint_id,
      COUNT(*) FILTER (
        WHERE hint_id IS NOT NULL 
          AND EXISTS (SELECT 1 FROM interaction_textbook_unit_retrievals r WHERE r.event_id = interaction_events.id)
      ) as has_retrieval_links
    FROM interaction_events 
    WHERE event_type = 'hint_view'
  `;

  const row = result[0];
  report.provenanceSummary.nativeComplete = parseInt(row.native_complete, 10);
  report.provenanceSummary.unverifiableTemplate = parseInt(row.missing_template, 10);
  report.provenanceSummary.backfilledHintId = parseInt(row.recoverable_hint_id, 10);
  report.provenanceSummary.backfilledRetrieval = parseInt(row.has_retrieval_links, 10);
  
  // Legacy partial = those that need both hint_id backfill AND have retrieval links
  report.provenanceSummary.legacyPartial = 
    report.provenanceSummary.backfilledHintId + report.provenanceSummary.backfilledRetrieval;

  console.log(`   Native complete: ${report.provenanceSummary.nativeComplete}`);
  console.log(`   Missing template (unverifiable): ${report.provenanceSummary.unverifiableTemplate}`);
  console.log(`   Recoverable hint_id: ${report.provenanceSummary.backfilledHintId}`);
  console.log(`   Has retrieval links: ${report.provenanceSummary.backfilledRetrieval}`);
}

async function saveReport(report: BackfillReport) {
  const reportDir = path.join(__dirname, '../../../../docs/audit/evidence');
  fs.mkdirSync(reportDir, { recursive: true });

  const filename = `backfill-report-${report.timestamp.replace(/[:.]/g, '-')}.json`;
  const filepath = path.join(reportDir, filename);

  fs.writeFileSync(filepath, JSON.stringify(report, null, 2));
  console.log(`📄 Report saved: ${filepath}`);
}

function printSummary(report: BackfillReport) {
  console.log();
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log('                    BACKFILL SUMMARY                               ');
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log();
  console.log(`Mode: ${report.dryRun ? 'DRY RUN' : 'LIVE'}`);
  console.log();
  console.log('Hint ID Backfill:');
  console.log(`  Total hint_view events: ${report.hintIdBackfill.totalHintViews}`);
  console.log(`  Missing hint_id: ${report.hintIdBackfill.missingHintIds}`);
  console.log(`  Recovered: ${report.hintIdBackfill.recoverable}`);
  console.log(`  Unrecoverable: ${report.hintIdBackfill.unrecoverable}`);
  console.log();
  console.log('Template ID Report:');
  console.log(`  Missing template_id: ${report.templateIdReport.missingTemplateIds}`);
  console.log(`  Marked unverifiable: ${report.templateIdReport.markedUnverifiable}`);
  console.log();
  console.log('Retrieval Links:');
  console.log(`  Events with retrievals: ${report.retrievalLinks.eventsWithRetrievals}`);
  console.log(`  Links created: ${report.retrievalLinks.linksCreated}`);
  console.log(`  Failed parses: ${report.retrievalLinks.failedParses}`);
  console.log();
  console.log('Provenance Summary:');
  console.log(`  Native complete: ${report.provenanceSummary.nativeComplete}`);
  console.log(`  Backfilled hint_id: ${report.provenanceSummary.backfilledHintId}`);
  console.log(`  Backfilled retrieval: ${report.provenanceSummary.backfilledRetrieval}`);
  console.log(`  Unverifiable template: ${report.provenanceSummary.unverifiableTemplate}`);
  console.log(`  Legacy partial: ${report.provenanceSummary.legacyPartial}`);
  console.log();

  if (report.dryRun) {
    console.log('⚠️  This was a dry run. No changes were made.');
    console.log('   Run without --dry-run to apply changes.');
  } else {
    console.log('✅ Backfill complete.');
  }
  console.log();
  console.log('═══════════════════════════════════════════════════════════════════');
  
  // RESEARCH-5: Print CI-friendly summary
  printCiSummary(report);
}

/**
 * RESEARCH-5: Print CI-friendly summary for automation
 */
function printCiSummary(report: BackfillReport) {
  console.log();
  console.log('=== CI SUMMARY ===');
  console.log(`hint_views_total=${report.hintIdBackfill.totalHintViews}`);
  console.log(`hint_views_missing_hint_id=${report.hintIdBackfill.missingHintIds}`);
  console.log(`hint_views_backfilled=${report.hintIdBackfill.recoverable}`);
  console.log(`template_ids_unverifiable=${report.templateIdReport.markedUnverifiable}`);
  console.log(`retrieval_links_created=${report.retrievalLinks.linksCreated}`);
  console.log(`native_complete=${report.provenanceSummary.nativeComplete}`);
  console.log(`legacy_partial=${report.provenanceSummary.legacyPartial}`);
  console.log('==================');
}

main();
