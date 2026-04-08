#!/usr/bin/env node
/**
 * Research Data Export Script
 *
 * Exports interaction_events with provenance status tracking.
 * Run with: npx tsx apps/server/src/scripts/export-research-data.ts [--format=json|csv] [--output=path]
 *
 * @module scripts/export-research-data
 */

import { neon } from '@neondatabase/serverless';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const RESEARCH_EXPORT_FILES = [
  'auth_events.csv',
  'auth_events.json',
  'interaction_events.csv',
  'interaction_events.json',
];

type ProvenanceStatus =
  | 'native_complete'        // All fields present at creation
  | 'backfilled_hint_id'     // hint_id recovered from other fields
  | 'backfilled_retrieval'   // retrieval links backfilled
  | 'unverifiable_template'  // template_id missing, not recoverable
  | 'legacy_partial';        // Multiple backfills applied

interface ExportRow {
  id: string;
  eventType: string;
  timestamp: string;
  learnerId: string;
  sessionId: string | null;
  problemId: string;
  hintId: string | null;
  templateId: string | null;
  sqlEngageSubtype: string | null;
  hasRetrievalLinks: boolean;
  // RESEARCH-5: Provenance tracking
  provenanceStatus: ProvenanceStatus;
  telemetryProvenanceStatus: ProvenanceStatus;
  legacyBackfillApplied: boolean;
  templateIdUnverifiable: boolean;
}

export function buildInteractionEventsCsv(events: any[]): string {
  if (events.length === 0) {
    return 'id,user_id,session_id,timestamp,event_type,problem_id,hint_id,concept_id,source,total_time,problems_attempted,problems_solved,hint_text,hint_level,help_request_index,sql_engage_subtype,sql_engage_row_id,template_id,policy_version,learner_profile_id,escalation_trigger_reason,error_count_at_escalation,time_to_escalation,strategy_assigned,strategy_updated,reward_value,created_at\n';
  }

  // Get all possible columns from the first event
  const firstEvent = events[0];
  const columns = Object.keys(firstEvent);

  const headers = columns.join(',');
  const rows = events.map(event => {
    return columns.map(col => {
      const value = event[col];
      if (value === null || value === undefined) {
        return '';
      }
      // Escape quotes and wrap in quotes if contains comma
      const str = String(value).replace(/"/g, '""');
      if (str.includes(',') || str.includes('\n') || str.includes('"')) {
        return `"${str}"`;
      }
      return str;
    }).join(',');
  });

  return [headers, ...rows].join('\n');
}

export function buildAuthEventsCsv(events: any[]): string {
  if (events.length === 0) {
    return 'id,timestamp,email_hash,account_id,learner_id,role,outcome,failure_reason,created_at\n';
  }

  const firstEvent = events[0];
  const columns = Object.keys(firstEvent);

  const headers = columns.join(',');
  const rows = events.map(event => {
    return columns.map(col => {
      const value = event[col];
      if (value === null || value === undefined) {
        return '';
      }
      const str = String(value).replace(/"/g, '""');
      if (str.includes(',') || str.includes('\n') || str.includes('"')) {
        return `"${str}"`;
      }
      return str;
    }).join(',');
  });

  return [headers, ...rows].join('\n');
}

function determineProvenanceStatus(row: any): ProvenanceStatus {
  const hasHintId = row.hint_id && row.hint_id.trim() !== '';
  const hasTemplateId = row.template_id && row.template_id.trim() !== '';
  const hasRetrievalLinks = row.has_retrieval_links;
  const hasRecoveryData = row.sql_engage_subtype && row.sql_engage_row_id;

  // Native complete: all fields present at creation
  if (hasHintId && hasTemplateId && !hasRetrievalLinks) {
    return 'native_complete';
  }

  // Check for backfilled hint_id (no hint_id but has recovery data)
  const backfilledHintId = !hasHintId && hasRecoveryData;

  // Determine final status
  if (backfilledHintId && hasRetrievalLinks) {
    return 'legacy_partial';
  }
  if (backfilledHintId) {
    return 'backfilled_hint_id';
  }
  if (hasRetrievalLinks && !hasHintId) {
    return 'backfilled_retrieval';
  }
  if (!hasTemplateId && hasHintId) {
    return 'unverifiable_template';
  }
  if (hasRetrievalLinks) {
    return 'backfilled_retrieval';
  }

  return 'native_complete';
}

async function main() {
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║  Research Data Export                                        ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log();

  const DATABASE_URL = process.env.DATABASE_URL || process.env.NEON_DATABASE_URL;
  const FORMAT = process.argv.find(arg => arg.startsWith('--format='))?.split('=')[1] || 'json';
  const OUTPUT_PATH = process.argv.find(arg => arg.startsWith('--output='))?.split('=')[1];
  const NATIVE_ONLY = process.argv.includes('--native-only');

  if (!DATABASE_URL) {
    console.error('❌ Error: DATABASE_URL environment variable is not set');
    process.exit(1);
  }

  const db = neon(DATABASE_URL);

  try {
    console.log('📊 Querying interaction events...');
    if (NATIVE_ONLY) {
      console.log('   Filter: native_complete events only');
    }
    
    const rows = await db`
      SELECT 
        ie.id,
        ie.event_type,
        ie.timestamp,
        ie.user_id as learner_id,
        ie.session_id,
        ie.problem_id,
        ie.hint_id,
        ie.template_id,
        ie.sql_engage_subtype,
        ie.sql_engage_row_id,
        EXISTS (
          SELECT 1 FROM interaction_textbook_unit_retrievals r 
          WHERE r.event_id = ie.id
        ) as has_retrieval_links
      FROM interaction_events ie
      ORDER BY ie.timestamp DESC
    `;

    console.log(`   Found ${rows.length} events (before filtering)`);

    // RESEARCH-5: Filter to native_complete only if requested
    let filteredRows = rows;
    if (NATIVE_ONLY) {
      filteredRows = rows.filter((row: any) => 
        row.hint_id && row.hint_id.trim() !== '' && 
        row.template_id && row.template_id.trim() !== ''
      );
      console.log(`   Filtered to ${filteredRows.length} native_complete events`);
    }

    const exportRows: ExportRow[] = filteredRows.map((row: any) => {
      const provenanceStatus = determineProvenanceStatus(row);
      const hasHintId = row.hint_id && row.hint_id.trim() !== '';
      const hasTemplateId = row.template_id && row.template_id.trim() !== '';
      
      return {
        id: row.id,
        eventType: row.event_type,
        timestamp: row.timestamp,
        learnerId: row.learner_id,
        sessionId: row.session_id,
        problemId: row.problem_id,
        hintId: row.hint_id,
        templateId: row.template_id,
        sqlEngageSubtype: row.sql_engage_subtype,
        sqlEngageRowId: row.sql_engage_row_id,
        hasRetrievalLinks: row.has_retrieval_links,
        // RESEARCH-5: Provenance tracking
        provenanceStatus,
        telemetryProvenanceStatus: provenanceStatus,
        legacyBackfillApplied: provenanceStatus !== 'native_complete',
        templateIdUnverifiable: !hasTemplateId && row.event_type === 'hint_view',
      };
    });

    // Calculate provenance distribution
    const provenanceCounts: Record<ProvenanceStatus, number> = {
      native_complete: 0,
      backfilled_hint_id: 0,
      backfilled_retrieval: 0,
      unverifiable_template: 0,
      legacy_partial: 0,
    };
    
    for (const row of exportRows) {
      provenanceCounts[row.provenanceStatus]++;
    }

    console.log('\n📊 Provenance Distribution:');
    for (const [status, count] of Object.entries(provenanceCounts)) {
      console.log(`   ${status}: ${count}`);
    }

    // Generate output
    let output: string;
    if (FORMAT === 'csv') {
      output = buildInteractionEventsCsv(rows);
    } else {
      output = JSON.stringify({
        exportedAt: new Date().toISOString(),
        totalEvents: exportRows.length,
        provenanceCounts,
        events: exportRows,
      }, null, 2);
    }

    // Write output
    const outputFile = OUTPUT_PATH || path.join(
      __dirname, 
      '../../../../docs/audit/evidence',
      `research-export-${new Date().toISOString().replace(/[:.]/g, '-')}.${FORMAT}`
    );
    
    fs.mkdirSync(path.dirname(outputFile), { recursive: true });
    fs.writeFileSync(outputFile, output);

    console.log(`\n✅ Export saved: ${outputFile}`);

  } catch (error) {
    console.error('❌ Export failed:', error);
    process.exit(1);
  }
}

// Only run main if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
