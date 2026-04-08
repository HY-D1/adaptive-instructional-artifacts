#!/usr/bin/env node
/**
 * RESEARCH-4: Research Data Export Script
 *
 * Exports research-relevant data from Neon PostgreSQL to analyst-friendly formats.
 * Run with: npx tsx apps/server/src/scripts/export-research-data.ts
 */

import { neon } from '@neondatabase/serverless';
import type { NeonQueryFunction } from '@neondatabase/serverless';
import * as fs from 'fs';
import * as path from 'path';
import { pathToFileURL } from 'url';

// ============================================================================
// Configuration
// ============================================================================

const OUTPUT_DIR = process.env.RESEARCH_OUTPUT_DIR || './dist/research-4';
const DATABASE_URL = process.env.DATABASE_URL || process.env.NEON_DATABASE_URL;
export const PAPER_DATA_CONTRACT_VERSION = 'paper-data-contract-v1';

// ============================================================================
// Type Definitions
// ============================================================================

interface ExportManifest {
  exportId: string;
  paperDataContractVersion: string;
  timestamp: string;
  databaseUrl: string;
  recordCounts: {
    users: number;
    sessions: number;
    events: number;
    authEvents: number;
    textbookUnits: number;
    problemProgress: number;
  };
  files: string[];
  filters?: {
    dateRange?: { start?: string; end?: string };
    userIds?: string[];
    eventTypes?: string[];
  };
}

// ============================================================================
// Database Operations
// ============================================================================

type DbClient = NeonQueryFunction<false, false>;

export const RESEARCH_EXPORT_FILES = [
  'users.csv', 'users.json',
  'learner_sessions.csv', 'learner_sessions.json',
  'interaction_events.csv', 'interaction_events.json',
  'auth_events.csv', 'auth_events.json',
  'textbook_units.csv', 'textbook_units.json',
  'problem_progress.csv', 'problem_progress.json',
  'bandit_events.csv', 'bandit_events.json',
  'escalation_events.csv', 'escalation_events.json',
  'session_events_joined.csv', 'session_events_joined.json',
  'event_type_summary.json',
  // Paper Data Contract: Derived exports (Message 4/5)
  'hint_events.csv', 'hint_events.json',
  'hint_response_windows.csv', 'hint_response_windows.json',
  'manifest.json',
] as const;

function getDb(): DbClient {
  if (!DATABASE_URL) {
    throw new Error('DATABASE_URL environment variable is not set');
  }
  return neon(DATABASE_URL) as DbClient;
}

// Helper to handle Neon query results
type QueryResult = Record<string, any>;

async function exportUsers(db: DbClient): Promise<void> {
  console.log('📊 Exporting users...');
  const result = await db`SELECT * FROM users ORDER BY created_at DESC`;
  const users = Array.isArray(result) ? result as QueryResult[] : [];

  const csvPath = path.join(OUTPUT_DIR, 'users.csv');
  const jsonPath = path.join(OUTPUT_DIR, 'users.json');

  // CSV Export
  const csvHeader = 'id,name,role,created_at,updated_at\n';
  const csvRows = users.map(u =>
    `${u.id},${escapeCsv(u.name)},${u.role},${u.created_at},${u.updated_at}`
  ).join('\n');
  fs.writeFileSync(csvPath, csvHeader + csvRows);

  // JSON Export
  fs.writeFileSync(jsonPath, JSON.stringify(users, null, 2));

  console.log(`   ✓ ${users.length} users exported`);
}

async function exportSessions(db: DbClient): Promise<void> {
  console.log('📊 Exporting learner sessions...');
  const result = await db`
    SELECT
      s.*,
      u.name as user_name
    FROM learner_sessions s
    JOIN users u ON s.user_id = u.id
    ORDER BY s.created_at DESC
  `;
  const sessions = Array.isArray(result) ? result as QueryResult[] : [];

  const csvPath = path.join(OUTPUT_DIR, 'learner_sessions.csv');
  const jsonPath = path.join(OUTPUT_DIR, 'learner_sessions.json');

  // CSV Export
  const csvHeader = 'id,user_id,user_name,session_id,condition_id,textbook_disabled,adaptive_ladder_disabled,immediate_explanation_mode,static_hint_mode,escalation_policy,created_at,updated_at\n';
  const csvRows = sessions.map(s =>
    `${s.id},${s.user_id},${escapeCsv(s.user_name)},${s.session_id},${s.condition_id},${s.textbook_disabled},${s.adaptive_ladder_disabled},${s.immediate_explanation_mode},${s.static_hint_mode},${s.escalation_policy},${s.created_at},${s.updated_at}`
  ).join('\n');
  fs.writeFileSync(csvPath, csvHeader + csvRows);

  // JSON Export
  fs.writeFileSync(jsonPath, JSON.stringify(sessions, null, 2));

  console.log(`   ✓ ${sessions.length} sessions exported`);
}

async function exportEvents(db: DbClient): Promise<void> {
  console.log('📊 Exporting interaction events...');

  // Export with essential research fields
  const result = await db`
    SELECT
      id,
      user_id,
      session_id,
      timestamp,
      event_type,
      problem_id,
      hint_id,
      hint_text,
      hint_level,
      help_request_index,
      sql_engage_subtype,
      sql_engage_row_id,
      template_id,
      problem_set_id,
      problem_number,
      code,
      error,
      error_subtype_id,
      successful,
      time_spent,
      total_time,
      problems_attempted,
      problems_solved,
      source,
      concept_id,
      concept_ids,
      policy_version,
      current_rung,
      from_rung,
      to_rung,
      trigger_reason,
      saved_to_notes,
      profile_id,
      assignment_strategy,
      selected_arm,
      selection_method,
      arm_stats_at_selection,
      reward_total,
      reward_components,
      new_alpha,
      new_beta,
      trend,
      slope,
      intervention_type,
      is_correct,
      learner_profile_id,
      escalation_trigger_reason,
      error_count_at_escalation,
      time_to_escalation,
      strategy_assigned,
      strategy_updated,
      reward_value,
      created_at
    FROM interaction_events
    ORDER BY timestamp DESC
  `;
  const events = Array.isArray(result) ? result as QueryResult[] : [];

  const csvPath = path.join(OUTPUT_DIR, 'interaction_events.csv');
  const jsonPath = path.join(OUTPUT_DIR, 'interaction_events.json');

  fs.writeFileSync(csvPath, buildInteractionEventsCsv(events));

  // JSON Export with parsed fields
  const parsedEvents = events.map(e => ({
    ...e,
    concept_ids: parseJsonSafe(e.concept_ids),
    arm_stats_at_selection: parseJsonSafe(e.arm_stats_at_selection),
    reward_components: parseJsonSafe(e.reward_components),
  }));
  fs.writeFileSync(jsonPath, JSON.stringify(parsedEvents, null, 2));

  console.log(`   ✓ ${events.length} events exported`);

  // Export event type summary
  const summaryResult = await db`
    SELECT
      event_type,
      COUNT(*) as count,
      COUNT(DISTINCT user_id) as unique_users,
      MIN(timestamp) as first_occurrence,
      MAX(timestamp) as last_occurrence
    FROM interaction_events
    GROUP BY event_type
    ORDER BY count DESC
  `;
  const eventSummary = Array.isArray(summaryResult) ? summaryResult as QueryResult[] : [];

  const summaryPath = path.join(OUTPUT_DIR, 'event_type_summary.json');
  fs.writeFileSync(summaryPath, JSON.stringify(eventSummary, null, 2));
  console.log(`   ✓ Event type summary exported (${eventSummary.length} types)`);
}

async function exportAuthEvents(db: DbClient): Promise<void> {
  console.log('📊 Exporting auth events...');
  const result = await db`
    SELECT
      id,
      timestamp,
      email_hash,
      account_id,
      learner_id,
      role,
      outcome,
      failure_reason,
      created_at
    FROM auth_events
    ORDER BY timestamp DESC
  `;
  const authEvents = Array.isArray(result) ? result as QueryResult[] : [];

  const csvPath = path.join(OUTPUT_DIR, 'auth_events.csv');
  const jsonPath = path.join(OUTPUT_DIR, 'auth_events.json');

  fs.writeFileSync(csvPath, buildAuthEventsCsv(authEvents));
  fs.writeFileSync(jsonPath, JSON.stringify(authEvents, null, 2));

  console.log(`   ✓ ${authEvents.length} auth events exported`);
}

async function exportTextbookUnits(db: DbClient): Promise<void> {
  console.log('📊 Exporting textbook units...');
  const result = await db`
    SELECT
      u.*,
      usr.name as user_name
    FROM textbook_units u
    JOIN users usr ON u.user_id = usr.id
    ORDER BY u.created_at DESC
  `;
  const units = Array.isArray(result) ? result as QueryResult[] : [];

  const csvPath = path.join(OUTPUT_DIR, 'textbook_units.csv');
  const jsonPath = path.join(OUTPUT_DIR, 'textbook_units.json');

  // CSV Export
  const csvHeader = 'id,user_id,user_name,unit_id,type,title,concept_ids,status,revision_count,quality_score,auto_created,created_at,updated_at\n';
  const csvRows = units.map(u => {
    const conceptIds = parseJsonSafe(u.concept_ids)?.join(';') || '';
    return [
      u.id,
      u.user_id,
      escapeCsv(u.user_name),
      u.unit_id,
      u.type,
      escapeCsv(u.title),
      conceptIds,
      u.status,
      u.revision_count,
      u.quality_score ?? '',
      u.auto_created,
      u.created_at,
      u.updated_at
    ].join(',');
  }).join('\n');
  fs.writeFileSync(csvPath, csvHeader + csvRows);

  // JSON Export with parsed fields
  const parsedUnits = units.map(u => ({
    ...u,
    concept_ids: parseJsonSafe(u.concept_ids),
    source_interaction_ids: parseJsonSafe(u.source_interaction_ids),
  }));
  fs.writeFileSync(jsonPath, JSON.stringify(parsedUnits, null, 2));

  console.log(`   ✓ ${units.length} textbook units exported`);
}

async function exportProblemProgress(db: DbClient): Promise<void> {
  console.log('📊 Exporting problem progress...');
  const result = await db`
    SELECT
      p.*,
      u.name as user_name
    FROM problem_progress p
    JOIN users u ON p.user_id = u.id
    ORDER BY p.updated_at DESC
  `;
  const progress = Array.isArray(result) ? result as QueryResult[] : [];

  const csvPath = path.join(OUTPUT_DIR, 'problem_progress.csv');
  const jsonPath = path.join(OUTPUT_DIR, 'problem_progress.json');

  // CSV Export
  const csvHeader = 'id,user_id,user_name,problem_id,solved,attempts_count,hints_used,first_attempted_at,solved_at,created_at,updated_at\n';
  const csvRows = progress.map(p =>
    `${p.id},${p.user_id},${escapeCsv(p.user_name)},${p.problem_id},${p.solved},${p.attempts_count},${p.hints_used},${p.first_attempted_at || ''},${p.solved_at || ''},${p.created_at},${p.updated_at}`
  ).join('\n');
  fs.writeFileSync(csvPath, csvHeader + csvRows);

  // JSON Export
  fs.writeFileSync(jsonPath, JSON.stringify(progress, null, 2));

  console.log(`   ✓ ${progress.length} problem progress records exported`);
}

async function exportStrategyRewardEvents(db: DbClient): Promise<void> {
  console.log('📊 Exporting strategy/reward events (specialized export)...');

  // Bandit-related events
  const result = await db`
    SELECT
      id,
      user_id,
      session_id,
      timestamp,
      event_type,
      problem_id,
      selected_arm,
      selection_method,
      arm_stats_at_selection,
      reward_total,
      reward_components,
      new_alpha,
      new_beta,
      profile_id,
      assignment_strategy,
      learner_profile_id,
      strategy_assigned,
      strategy_updated,
      reward_value,
      created_at
    FROM interaction_events
    WHERE event_type IN ('bandit_arm_selected', 'bandit_reward_observed', 'bandit_updated', 'profile_assigned')
    ORDER BY timestamp DESC
  `;
  const banditEvents = Array.isArray(result) ? result as QueryResult[] : [];

  const csvPath = path.join(OUTPUT_DIR, 'bandit_events.csv');
  const jsonPath = path.join(OUTPUT_DIR, 'bandit_events.json');

  // CSV Export (legacy + canonical study fields)
  const csvHeader = 'id,user_id,session_id,timestamp,event_type,problem_id,' +
    'selected_arm,selection_method,reward_total,new_alpha,new_beta,profile_id,assignment_strategy,' +
    'learner_profile_id,strategy_assigned,strategy_updated,reward_value,created_at\n';
  const csvRows = banditEvents.map(e => [
    e.id,
    e.user_id,
    e.session_id || '',
    e.timestamp,
    e.event_type,
    e.problem_id,
    e.selected_arm || '',
    e.selection_method || '',
    e.reward_total ?? '',
    e.new_alpha ?? '',
    e.new_beta ?? '',
    e.profile_id || '',
    e.assignment_strategy || '',
    e.learner_profile_id || '',
    e.strategy_assigned || '',
    e.strategy_updated || '',
    e.reward_value ?? '',
    e.created_at
  ].join(',')).join('\n');
  fs.writeFileSync(csvPath, csvHeader + csvRows);

  // JSON with parsed fields
  const parsedEvents = banditEvents.map(e => ({
    ...e,
    arm_stats_at_selection: parseJsonSafe(e.arm_stats_at_selection),
    reward_components: parseJsonSafe(e.reward_components),
  }));
  fs.writeFileSync(jsonPath, JSON.stringify(parsedEvents, null, 2));

  console.log(`   ✓ ${banditEvents.length} bandit events exported`);
}

async function exportEscalationEvents(db: DbClient): Promise<void> {
  console.log('📊 Exporting escalation events...');

  const result = await db`
    SELECT
      id,
      user_id,
      session_id,
      timestamp,
      event_type,
      problem_id,
      from_rung,
      to_rung,
      trigger_reason,
      profile_id,
      hint_level,
      current_rung,
      learner_profile_id,
      escalation_trigger_reason,
      error_count_at_escalation,
      time_to_escalation,
      created_at
    FROM interaction_events
    WHERE event_type IN ('escalation_triggered', 'guidance_escalate', 'escalation_policy_changed')
      OR from_rung IS NOT NULL
      OR to_rung IS NOT NULL
    ORDER BY timestamp DESC
  `;
  const escalationEvents = Array.isArray(result) ? result as QueryResult[] : [];

  const csvPath = path.join(OUTPUT_DIR, 'escalation_events.csv');
  const jsonPath = path.join(OUTPUT_DIR, 'escalation_events.json');

  // CSV Export (legacy + canonical study fields)
  const csvHeader = 'id,user_id,session_id,timestamp,event_type,problem_id,' +
    'from_rung,to_rung,trigger_reason,profile_id,hint_level,current_rung,' +
    'learner_profile_id,escalation_trigger_reason,error_count_at_escalation,time_to_escalation,' +
    'created_at\n';
  const csvRows = escalationEvents.map(e => [
    e.id,
    e.user_id,
    e.session_id || '',
    e.timestamp,
    e.event_type,
    e.problem_id,
    e.from_rung ?? '',
    e.to_rung ?? '',
    escapeCsv(e.trigger_reason || ''),
    e.profile_id || '',
    e.hint_level ?? '',
    e.current_rung ?? '',
    e.learner_profile_id || '',
    escapeCsv(e.escalation_trigger_reason || ''),
    e.error_count_at_escalation ?? '',
    e.time_to_escalation ?? '',
    e.created_at
  ].join(',')).join('\n');
  fs.writeFileSync(csvPath, csvHeader + csvRows);

  // JSON Export
  fs.writeFileSync(jsonPath, JSON.stringify(escalationEvents, null, 2));

  console.log(`   ✓ ${escalationEvents.length} escalation events exported`);
}

async function exportSessionEventJoin(db: DbClient): Promise<void> {
  console.log('📊 Exporting session-event joined view...');

  // Join sessions with their events for analysis
  const result = await db`
    SELECT
      s.user_id,
      s.session_id,
      s.condition_id,
      s.escalation_policy,
      s.textbook_disabled,
      s.adaptive_ladder_disabled,
      s.static_hint_mode,
      s.created_at as session_created_at,
      e.id as event_id,
      e.event_type,
      e.timestamp as event_timestamp,
      e.problem_id,
      e.successful,
      e.time_spent,
      e.profile_id,
      e.assignment_strategy,
      e.selected_arm,
      e.reward_total
    FROM learner_sessions s
    LEFT JOIN interaction_events e ON s.user_id = e.user_id AND s.session_id = e.session_id
    ORDER BY s.created_at DESC, e.timestamp ASC
  `;
  const joinedData = Array.isArray(result) ? result as QueryResult[] : [];

  const csvPath = path.join(OUTPUT_DIR, 'session_events_joined.csv');
  const jsonPath = path.join(OUTPUT_DIR, 'session_events_joined.json');

  // CSV Export
  const csvHeader = 'user_id,session_id,condition_id,escalation_policy,session_created_at,event_id,event_type,event_timestamp,problem_id,successful,time_spent,profile_id,assignment_strategy,selected_arm,reward_total\n';
  const csvRows = joinedData.map(row => [
    row.user_id,
    row.session_id,
    row.condition_id,
    row.escalation_policy,
    row.session_created_at,
    row.event_id || '',
    row.event_type || '',
    row.event_timestamp || '',
    row.problem_id || '',
    row.successful ?? '',
    row.time_spent ?? '',
    row.profile_id || '',
    row.assignment_strategy || '',
    row.selected_arm || '',
    row.reward_total ?? ''
  ].join(',')).join('\n');
  fs.writeFileSync(csvPath, csvHeader + csvRows);

  // JSON Export
  fs.writeFileSync(jsonPath, JSON.stringify(joinedData, null, 2));

  console.log(`   ✓ ${joinedData.length} joined records exported`);
}

// ============================================================================
// Paper Data Contract: Derived Exports (Message 4/5)
// ============================================================================

async function exportHintEvents(db: DbClient): Promise<void> {
  console.log('📊 Exporting hint events (derived)...');

  const result = await db`
    SELECT
      id as event_id,
      user_id,
      session_id,
      problem_id,
      timestamp,
      hint_id,
      hint_text,
      hint_level,
      template_id,
      help_request_index,
      sql_engage_subtype,
      sql_engage_row_id,
      policy_version,
      rule_fired,
      retrieved_source_ids,
      inputs,
      outputs,
      condition_id,
      created_at
    FROM interaction_events
    WHERE event_type = 'hint_view'
    ORDER BY timestamp DESC
  `;
  const hints = Array.isArray(result) ? result as QueryResult[] : [];

  const csvPath = path.join(OUTPUT_DIR, 'hint_events.csv');
  const jsonPath = path.join(OUTPUT_DIR, 'hint_events.json');

  // CSV Export
  const csvHeader = 'event_id,user_id,session_id,problem_id,timestamp,hint_id,hint_text,hint_level,template_id,help_request_index,sql_engage_subtype,sql_engage_row_id,policy_version,rule_fired,condition_id,created_at\n';
  const csvRows = hints.map(h => [
    h.event_id,
    h.user_id,
    h.session_id || '',
    h.problem_id,
    h.timestamp,
    h.hint_id || '',
    escapeCsv(h.hint_text || ''),
    h.hint_level ?? '',
    h.template_id || '',
    h.help_request_index ?? '',
    h.sql_engage_subtype || '',
    h.sql_engage_row_id || '',
    h.policy_version || '',
    h.rule_fired || '',
    h.condition_id || '',
    h.created_at
  ].join(',')).join('\n');
  fs.writeFileSync(csvPath, csvHeader + csvRows);

  // JSON Export with parsed fields
  const parsedHints = hints.map(h => ({
    ...h,
    retrieved_source_ids: parseJsonSafe(h.retrieved_source_ids),
    inputs: parseJsonSafe(h.inputs),
    outputs: parseJsonSafe(h.outputs),
  }));
  fs.writeFileSync(jsonPath, JSON.stringify(parsedHints, null, 2));

  console.log(`   ✓ ${hints.length} hint events exported`);
}

async function exportHintResponseWindows(db: DbClient): Promise<void> {
  console.log('📊 Exporting hint response windows (derived)...');

  // Use a window function to find events after each hint
  const result = await db`
    WITH hint_events AS (
      SELECT
        id as hint_event_id,
        user_id,
        session_id,
        problem_id,
        timestamp as hint_timestamp,
        hint_id,
        hint_level,
        template_id,
        LEAD(timestamp) OVER (PARTITION BY session_id, problem_id ORDER BY timestamp) as next_event_time
      FROM interaction_events
      WHERE event_type = 'hint_view'
    ),
    hint_windows AS (
      SELECT
        h.hint_event_id,
        h.user_id,
        h.session_id,
        h.problem_id,
        h.hint_timestamp,
        h.hint_id,
        h.hint_level,
        h.template_id,
        MIN(e.timestamp) FILTER (WHERE e.event_type IN ('code_change', 'execution', 'error', 'hint_view')) as first_event_after_hint,
        COUNT(e.id) as events_after_hint,
        COUNT(e.id) FILTER (WHERE e.event_type = 'code_change') as code_changes_after_hint,
        COUNT(e.id) FILTER (WHERE e.event_type = 'execution') as executions_after_hint,
        COUNT(e.id) FILTER (WHERE e.event_type = 'error') as errors_after_hint,
        COUNT(e.id) FILTER (WHERE e.event_type = 'hint_view') as next_hint_viewed,
        BOOL_OR(e.event_type = 'escalation_triggered' OR e.event_type = 'guidance_escalate') as escalated_after_hint,
        BOOL_OR(e.event_type = 'execution' AND e.successful = true) as had_successful_execution,
        CASE 
          WHEN COUNT(e.id) FILTER (WHERE e.event_type = 'hint_view') > 0 THEN 'next_hint'
          WHEN COUNT(e.id) FILTER (WHERE e.event_type = 'problem_change' OR e.event_type = 'problem_change_request') > 0 THEN 'problem_change'
          WHEN COUNT(e.id) FILTER (WHERE e.event_type = 'session_end') > 0 THEN 'session_end'
          WHEN h.next_event_time IS NULL THEN 'end_of_trace'
          ELSE 'other'
        END as window_closed_by
      FROM hint_events h
      LEFT JOIN interaction_events e ON 
        e.session_id = h.session_id 
        AND e.problem_id = h.problem_id
        AND e.timestamp > h.hint_timestamp
        AND (h.next_event_time IS NULL OR e.timestamp < h.next_event_time)
      GROUP BY 
        h.hint_event_id, h.user_id, h.session_id, h.problem_id, 
        h.hint_timestamp, h.hint_id, h.hint_level, h.template_id, h.next_event_time
    )
    SELECT * FROM hint_windows
    ORDER BY hint_timestamp DESC
  `;
  const windows = Array.isArray(result) ? result as QueryResult[] : [];

  const csvPath = path.join(OUTPUT_DIR, 'hint_response_windows.csv');
  const jsonPath = path.join(OUTPUT_DIR, 'hint_response_windows.json');

  // CSV Export
  const csvHeader = 'hint_event_id,user_id,session_id,problem_id,hint_timestamp,hint_id,hint_level,template_id,first_event_after_hint,events_after_hint,code_changes_after_hint,executions_after_hint,errors_after_hint,next_hint_viewed,escalated_after_hint,left_problem_without_execution,window_closed_by\n';
  const csvRows = windows.map(w => [
    w.hint_event_id,
    w.user_id,
    w.session_id || '',
    w.problem_id,
    w.hint_timestamp,
    w.hint_id || '',
    w.hint_level ?? '',
    w.template_id || '',
    w.first_event_after_hint || '',
    w.events_after_hint,
    w.code_changes_after_hint,
    w.executions_after_hint,
    w.errors_after_hint,
    w.next_hint_viewed,
    w.escalated_after_hint,
    !w.had_successful_execution,
    w.window_closed_by
  ].join(',')).join('\n');
  fs.writeFileSync(csvPath, csvHeader + csvRows);

  // JSON Export
  fs.writeFileSync(jsonPath, JSON.stringify(windows, null, 2));

  console.log(`   ✓ ${windows.length} hint response windows exported`);
}

async function createManifest(db: DbClient): Promise<ExportManifest> {
  console.log('📋 Creating export manifest...');

  // Get counts
  const userResult = await db`SELECT COUNT(*) as count FROM users`;
  const sessionResult = await db`SELECT COUNT(*) as count FROM learner_sessions`;
  const eventResult = await db`SELECT COUNT(*) as count FROM interaction_events`;
  const authEventResult = await db`SELECT COUNT(*) as count FROM auth_events`;
  const unitResult = await db`SELECT COUNT(*) as count FROM textbook_units`;
  const progressResult = await db`SELECT COUNT(*) as count FROM problem_progress`;

  const [userCount] = Array.isArray(userResult) ? userResult as QueryResult[] : [{ count: 0 }];
  const [sessionCount] = Array.isArray(sessionResult) ? sessionResult as QueryResult[] : [{ count: 0 }];
  const [eventCount] = Array.isArray(eventResult) ? eventResult as QueryResult[] : [{ count: 0 }];
  const [authEventCount] = Array.isArray(authEventResult) ? authEventResult as QueryResult[] : [{ count: 0 }];
  const [unitCount] = Array.isArray(unitResult) ? unitResult as QueryResult[] : [{ count: 0 }];
  const [progressCount] = Array.isArray(progressResult) ? progressResult as QueryResult[] : [{ count: 0 }];

  const manifest: ExportManifest = {
    exportId: `research-4-${Date.now()}`,
    paperDataContractVersion: PAPER_DATA_CONTRACT_VERSION,
    timestamp: new Date().toISOString(),
    databaseUrl: DATABASE_URL ? DATABASE_URL.replace(/:[^:@]+@/, ':****@') : '',
    recordCounts: {
      users: parseInt(userCount?.count ?? 0, 10),
      sessions: parseInt(sessionCount?.count ?? 0, 10),
      events: parseInt(eventCount?.count ?? 0, 10),
      authEvents: parseInt(authEventCount?.count ?? 0, 10),
      textbookUnits: parseInt(unitCount?.count ?? 0, 10),
      problemProgress: parseInt(progressCount?.count ?? 0, 10),
    },
    files: [...RESEARCH_EXPORT_FILES],
  };

  fs.writeFileSync(
    path.join(OUTPUT_DIR, 'manifest.json'),
    JSON.stringify(manifest, null, 2)
  );

  return manifest;
}

// ============================================================================
// Helper Functions
// ============================================================================

function escapeCsv(value: string): string {
  if (!value) return '';
  // Escape quotes and wrap in quotes if contains comma, newline, or quote
  const escaped = value.replace(/"/g, '""');
  if (escaped.includes(',') || escaped.includes('\n') || escaped.includes('"')) {
    return `"${escaped}"`;
  }
  return escaped;
}

export function buildInteractionEventsCsv(events: QueryResult[]): string {
  const csvHeader = 'id,user_id,session_id,timestamp,event_type,problem_id,' +
    'hint_id,hint_text,hint_level,help_request_index,sql_engage_subtype,sql_engage_row_id,template_id,policy_version,' +
    'successful,time_spent,' +
    'total_time,problems_attempted,problems_solved,source,concept_id,' +
    'profile_id,assignment_strategy,selected_arm,selection_method,reward_total,new_alpha,new_beta,' +
    'from_rung,to_rung,trigger_reason,intervention_type,concept_ids,' +
    'learner_profile_id,escalation_trigger_reason,error_count_at_escalation,time_to_escalation,' +
    'strategy_assigned,strategy_updated,reward_value,created_at\n';
  const csvRows = events.map((event) => {
    const conceptIds = parseJsonSafe(event.concept_ids)?.join(';') || '';
    return [
      event.id,
      event.user_id,
      event.session_id || '',
      event.timestamp,
      event.event_type,
      event.problem_id,
      event.hint_id || '',
      escapeCsv(event.hint_text || ''),
      event.hint_level ?? '',
      event.help_request_index ?? '',
      event.sql_engage_subtype || '',
      event.sql_engage_row_id || '',
      event.template_id || '',
      event.policy_version || '',
      event.successful ?? '',
      event.time_spent ?? '',
      event.total_time ?? '',
      event.problems_attempted ?? '',
      event.problems_solved ?? '',
      event.source || '',
      event.concept_id || '',
      event.profile_id || '',
      event.assignment_strategy || '',
      event.selected_arm || '',
      event.selection_method || '',
      event.reward_total ?? '',
      event.new_alpha ?? '',
      event.new_beta ?? '',
      event.from_rung ?? '',
      event.to_rung ?? '',
      escapeCsv(event.trigger_reason || ''),
      event.intervention_type || '',
      conceptIds,
      event.learner_profile_id || '',
      escapeCsv(event.escalation_trigger_reason || ''),
      event.error_count_at_escalation ?? '',
      event.time_to_escalation ?? '',
      event.strategy_assigned || '',
      event.strategy_updated || '',
      event.reward_value ?? '',
      event.created_at,
    ].join(',');
  }).join('\n');
  return csvHeader + csvRows;
}

export function buildAuthEventsCsv(events: QueryResult[]): string {
  const csvHeader = 'id,timestamp,email_hash,account_id,learner_id,role,outcome,failure_reason,created_at\n';
  const csvRows = events.map((event) => [
    event.id,
    event.timestamp,
    event.email_hash,
    event.account_id || '',
    event.learner_id || '',
    event.role || '',
    event.outcome,
    escapeCsv(event.failure_reason || ''),
    event.created_at,
  ].join(',')).join('\n');
  return csvHeader + csvRows;
}

function parseJsonSafe(value: string | null): any {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function ensureOutputDir(): void {
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }
}

// ============================================================================
// Main
// ============================================================================

async function main() {
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║  RESEARCH-4: Research Data Export                            ║');
  console.log('║  Exporting analyst-ready datasets from Neon PostgreSQL       ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log();

  if (!DATABASE_URL) {
    console.error('❌ Error: DATABASE_URL environment variable is not set');
    console.error('   Set it with: export DATABASE_URL=postgresql://...');
    process.exit(1);
  }

  ensureOutputDir();
  console.log(`📁 Output directory: ${OUTPUT_DIR}`);
  console.log();

  const db = getDb();

  try {
    // Core exports
    await exportUsers(db);
    await exportSessions(db);
    await exportEvents(db);
    await exportAuthEvents(db);
    await exportTextbookUnits(db);
    await exportProblemProgress(db);

    // Specialized exports
    await exportStrategyRewardEvents(db);
    await exportEscalationEvents(db);
    await exportSessionEventJoin(db);

    // Paper Data Contract: Derived exports (Message 4/5)
    await exportHintEvents(db);
    await exportHintResponseWindows(db);

    // Manifest
    const manifest = await createManifest(db);

    console.log();
    console.log('✅ Export complete!');
    console.log();
    console.log('📊 Export Summary:');
    console.log(`   • Users: ${manifest.recordCounts.users}`);
    console.log(`   • Sessions: ${manifest.recordCounts.sessions}`);
    console.log(`   • Events: ${manifest.recordCounts.events}`);
    console.log(`   • Auth Events: ${manifest.recordCounts.authEvents}`);
    console.log(`   • Textbook Units: ${manifest.recordCounts.textbookUnits}`);
    console.log(`   • Problem Progress: ${manifest.recordCounts.problemProgress}`);
    console.log();
    console.log(`📁 Output location: ${OUTPUT_DIR}/`);
    console.log(`📋 Manifest: ${OUTPUT_DIR}/manifest.json`);
    console.log();
    console.log('Next steps:');
    console.log('  1. Review the exported CSV files in your analysis tool');
    console.log('  2. Check docs/research/RESEARCH-4-DATA-DICTIONARY.md for field meanings');
    console.log('  3. Use bandit_events.json for strategy/reward analysis');
    console.log('  4. Use session_events_joined.csv for trajectory analysis');

  } catch (error) {
    console.error('❌ Export failed:', error);
    process.exit(1);
  }
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  main();
}
