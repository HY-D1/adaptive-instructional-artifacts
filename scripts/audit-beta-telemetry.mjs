#!/usr/bin/env node
/**
 * Beta Telemetry Audit Script
 *
 * Queries the Neon database for interaction_events within a time window
 * and produces a structured JSON report for staged beta audit.
 *
 * Usage:
 *   node scripts/audit-beta-telemetry.mjs --since 2026-03-30T09:00:00Z
 *   node scripts/audit-beta-telemetry.mjs --since 2026-03-30T09:00:00Z --section-id <section-id>
 *   node scripts/audit-beta-telemetry.mjs --since 2026-03-30T09:00:00Z --stage 1
 */

import { neon } from '@neondatabase/serverless';
import fs from 'fs';
import path from 'path';

const DB_ENV_KEYS = [
  'DATABASE_URL',
  'NEON_DATABASE_URL',
  'adaptive_data_DATABASE_URL',
  'adaptive_data_POSTGRES_URL',
];

function resolveDatabaseUrl() {
  for (const key of DB_ENV_KEYS) {
    const value = (process.env[key] || '').trim();
    if (value) {
      return { url: value, source: key };
    }
  }
  return { url: '', source: '' };
}

function parseArgs(argv) {
  const out = {
    since: '',
    until: new Date().toISOString(),
    sectionId: '',
    stage: '',
    outputDir: 'dist/beta/telemetry-audit',
  };

  for (let i = 2; i < argv.length; i += 1) {
    const token = argv[i];
    const next = argv[i + 1];
    if (token === '--since' && next) {
      out.since = next.trim();
      i += 1;
      continue;
    }
    if (token === '--until' && next) {
      out.until = next.trim();
      i += 1;
      continue;
    }
    if (token === '--section-id' && next) {
      out.sectionId = next.trim();
      i += 1;
      continue;
    }
    if (token === '--stage' && next) {
      out.stage = next.trim();
      i += 1;
      continue;
    }
    if (token === '--output-dir' && next) {
      out.outputDir = next.trim();
      i += 1;
      continue;
    }
  }

  return out;
}

function assertDate(value, label) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) {
    console.error(`Invalid ${label}: ${value}`);
    process.exit(1);
  }
  return d.toISOString();
}

async function runAudit(sql, args) {
  const since = assertDate(args.since, '--since');
  const until = assertDate(args.until, '--until');

  const sectionFilter = args.sectionId
    ? sql`AND section_id = ${args.sectionId}`
    : sql``;

  // 1. Event counts by type
  const eventCounts = await sql`
    SELECT event_type, COUNT(*)::int AS count
    FROM interaction_events
    WHERE created_at >= ${since}
      AND created_at <= ${until}
      ${sectionFilter}
    GROUP BY event_type
    ORDER BY count DESC
  `;

  // 2. Unique active students
  const [{ count: uniqueStudents }] = await sql`
    SELECT COUNT(DISTINCT user_id)::int AS count
    FROM interaction_events
    WHERE created_at >= ${since}
      AND created_at <= ${until}
      ${sectionFilter}
  `;

  // 3. Hint metrics
  const [{ hintRequests, followUpHints }] = await sql`
    SELECT
      COUNT(*)::int AS hint_requests,
      COUNT(*) FILTER (WHERE help_request_index > 0)::int AS follow_up_hints
    FROM interaction_events
    WHERE event_type = 'hint_view'
      AND created_at >= ${since}
      AND created_at <= ${until}
      ${sectionFilter}
  `;

  // 4. Save-to-notes metrics
  const [{ textbookAdds, textbookUpdates }] = await sql`
    SELECT
      COUNT(*)::int FILTER (WHERE event_type = 'textbook_add') AS textbook_adds,
      COUNT(*)::int FILTER (WHERE event_type = 'textbook_update') AS textbook_updates
    FROM interaction_events
    WHERE event_type IN ('textbook_add', 'textbook_update')
      AND created_at >= ${since}
      AND created_at <= ${until}
      ${sectionFilter}
  `;

  // 5. Error metrics
  const [{ errorEvents }] = await sql`
    SELECT COUNT(*)::int AS error_events
    FROM interaction_events
    WHERE event_type = 'error'
      AND created_at >= ${since}
      AND created_at <= ${until}
      ${sectionFilter}
  `;

  const [{ executionEvents }] = await sql`
    SELECT COUNT(*)::int AS execution_events
    FROM interaction_events
    WHERE event_type = 'execution'
      AND created_at >= ${since}
      AND created_at <= ${until}
      ${sectionFilter}
  `;

  // 6. Answer-after-hint correlation
  // Count executions/errors that occur within 5 minutes after a hint_view for the same session+problem
  const answerAfterHint = await sql`
    SELECT COUNT(*)::int AS count
    FROM interaction_events e
    WHERE e.event_type IN ('execution', 'error')
      AND e.created_at >= ${since}
      AND e.created_at <= ${until}
      ${sectionFilter}
      AND EXISTS (
        SELECT 1
        FROM interaction_events h
        WHERE h.event_type = 'hint_view'
          AND h.session_id = e.session_id
          AND h.problem_id = e.problem_id
          AND h.created_at < e.created_at
          AND h.created_at >= e.created_at - INTERVAL '5 minutes'
          ${sectionFilter}
      )
  `;

  // 7. Top problems by hint request volume
  const topHintProblems = await sql`
    SELECT problem_id, COUNT(*)::int AS count
    FROM interaction_events
    WHERE event_type = 'hint_view'
      AND created_at >= ${since}
      AND created_at <= ${until}
      ${sectionFilter}
    GROUP BY problem_id
    ORDER BY count DESC
    LIMIT 10
  `;

  // 8. Hourly event volume (for load pattern analysis)
  const hourlyVolume = await sql`
    SELECT
      DATE_TRUNC('hour', created_at) AS hour,
      event_type,
      COUNT(*)::int AS count
    FROM interaction_events
    WHERE created_at >= ${since}
      AND created_at <= ${until}
      ${sectionFilter}
    GROUP BY hour, event_type
    ORDER BY hour, count DESC
  `;

  return {
    meta: {
      since,
      until,
      sectionId: args.sectionId || null,
      stage: args.stage || null,
      generatedAt: new Date().toISOString(),
    },
    engagement: {
      uniqueStudents: Number(uniqueStudents),
    },
    events: {
      byType: eventCounts.map((r) => ({ eventType: r.event_type, count: r.count })),
      hourly: hourlyVolume.map((r) => ({
        hour: new Date(r.hour).toISOString(),
        eventType: r.event_type,
        count: r.count,
      })),
    },
    hints: {
      hintRequests: Number(hintRequests),
      followUpHints: Number(followUpHints),
      topProblems: topHintProblems.map((r) => ({ problemId: r.problem_id, count: r.count })),
    },
    textbook: {
      adds: Number(textbookAdds),
      updates: Number(textbookUpdates),
    },
    execution: {
      executionEvents: Number(executionEvents),
      errorEvents: Number(errorEvents),
      answerAfterHint: Number(answerAfterHint[0]?.count ?? 0),
    },
  };
}

async function main() {
  const args = parseArgs(process.argv);

  if (!args.since) {
    console.error('Usage: node scripts/audit-beta-telemetry.mjs --since <ISO8601> [--until <ISO8601>] [--section-id <id>] [--stage <1|2|3>] [--output-dir <dir>]');
    process.exit(1);
  }

  const { url: databaseUrl, source } = resolveDatabaseUrl();
  if (!databaseUrl) {
    console.error(`Missing Neon database URL. Set one of: ${DB_ENV_KEYS.join(', ')}`);
    process.exit(1);
  }

  const sql = neon(databaseUrl);
  const report = await runAudit(sql, args);

  const timestamp = Date.now();
  const stageSuffix = args.stage ? `-stage-${args.stage}` : '';
  const filename = `${timestamp}${stageSuffix}.json`;
  const outPath = path.join(args.outputDir, filename);

  fs.mkdirSync(args.outputDir, { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2));

  console.log(`Telemetry audit complete.`);
  console.log(`  DB source : ${source}`);
  console.log(`  Window    : ${report.meta.since} → ${report.meta.until}`);
  console.log(`  Students  : ${report.engagement.uniqueStudents}`);
  console.log(`  Hints     : ${report.hints.hintRequests}`);
  console.log(`  Textbook  : ${report.textbook.adds} adds, ${report.textbook.updates} updates`);
  console.log(`  Execution : ${report.execution.executionEvents} runs, ${report.execution.errorEvents} errors`);
  console.log(`  AfterHint : ${report.execution.answerAfterHint}`);
  console.log(`  Output    : ${outPath}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
