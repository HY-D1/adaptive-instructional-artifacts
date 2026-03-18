#!/usr/bin/env node
/**
 * RESEARCH-4: Sample Export Generator
 *
 * Generates sample export files from existing RESEARCH-3D verification data
 * to demonstrate the export format and data dictionary.
 * Run with: npx tsx apps/server/src/scripts/generate-sample-export.ts
 */

import * as fs from 'fs';
import * as path from 'path';

const RESEARCH_3D_DIR = '../../dist/research-3d';
const OUTPUT_DIR = '../../dist/research-4';

interface SampleRecord {
  id: string;
  user_id: string;
  session_id: string;
  timestamp: string;
  event_type: string;
  problem_id: string;
  [key: string]: any;
}

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function escapeCsv(value: string): string {
  if (!value) return '';
  const escaped = value.replace(/"/g, '""');
  if (escaped.includes(',') || escaped.includes('\n') || escaped.includes('"')) {
    return `"${escaped}"`;
  }
  return escaped;
}

function generateSampleEvents(): SampleRecord[] {
  // Read the RESEARCH-3D flow files to extract sample data
  const events: SampleRecord[] = [];

  try {
    const files = fs.readdirSync(RESEARCH_3D_DIR);

    for (const file of files) {
      if (file.endsWith('.json') && !file.includes('verification-summary')) {
        const data = JSON.parse(fs.readFileSync(path.join(RESEARCH_3D_DIR, file), 'utf8'));

        if (data.localStorageEvents) {
          for (const event of data.localStorageEvents) {
            // Map RESEARCH-3D event format to export format
            const record: SampleRecord = {
              id: event.id || `evt-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
              user_id: event.learnerId || data.learnerId || 'unknown',
              session_id: event.sessionId || 'session-unknown',
              timestamp: new Date(event.timestamp).toISOString(),
              event_type: event.eventType,
              problem_id: event.problemId || 'problem-unknown',
            };

            // Add strategy/reward fields if present
            if (event.profileId) record.profile_id = event.profileId;
            if (event.assignmentStrategy) record.assignment_strategy = event.assignmentStrategy;
            if (event.selectedArm) record.selected_arm = event.selectedArm;
            if (event.selectionMethod) record.selection_method = event.selectionMethod;
            if (event.trigger) record.trigger_reason = event.trigger;
            if (event.fromRung !== undefined) record.from_rung = event.fromRung;
            if (event.toRung !== undefined) record.to_rung = event.toRung;

            // Add reward fields
            if (event.reward) {
              record.reward_total = event.reward.total;
              record.reward_components = JSON.stringify(event.reward.components);
            }
            if (event.newAlpha !== undefined) record.new_alpha = event.newAlpha;
            if (event.newBeta !== undefined) record.new_beta = event.newBeta;

            // Add execution fields
            if (event.successful !== undefined) record.successful = event.successful;
            if (event.timeSpent !== undefined) record.time_spent = event.timeSpent;
            if (event.conditionId) record.condition_id = event.conditionId;
            if (event.code) record.code = event.code;
            if (event.error) record.error = event.error;
            if (event.conceptIds) record.concept_ids = JSON.stringify(event.conceptIds);
            if (event.policyVersion) record.policy_version = event.policyVersion;

            events.push(record);
          }
        }
      }
    }
  } catch (error) {
    console.error('Warning: Could not read RESEARCH-3D data:', error);
  }

  // If no events found, generate synthetic samples
  if (events.length === 0) {
    return generateSyntheticSamples();
  }

  return events;
}

function generateSyntheticSamples(): SampleRecord[] {
  const now = Date.now();
  return [
    {
      id: 'evt-bandit-001',
      user_id: 'research-3d-flow-a-1773808257058',
      session_id: 'session-research-3d-flow-a-1773808257058-1773808258264',
      timestamp: new Date(now - 3600000).toISOString(),
      event_type: 'bandit_arm_selected',
      problem_id: 'problem-1',
      selected_arm: 'conservative',
      selection_method: 'thompson_sampling',
      profile_id: 'slow-escalator',
      assignment_strategy: 'bandit',
      condition_id: 'conservative',
      policy_version: 'bandit-arm-v1',
    },
    {
      id: 'evt-profile-001',
      user_id: 'research-3d-flow-a-1773808257058',
      session_id: 'session-research-3d-flow-a-1773808257058-1773808258264',
      timestamp: new Date(now - 3600000).toISOString(),
      event_type: 'profile_assigned',
      problem_id: 'problem-1',
      profile_id: 'slow-escalator',
      assignment_strategy: 'bandit',
      condition_id: 'adaptive',
      policy_version: 'profile-assign-v1',
    },
    {
      id: 'evt-reward-001',
      user_id: 'research-3d-flow-c-1773808265873',
      session_id: 'session-research-3d-flow-c-1773808265873-1773808267008',
      timestamp: new Date(now - 1800000).toISOString(),
      event_type: 'bandit_reward_observed',
      problem_id: 'bandit-reward',
      selected_arm: 'adaptive',
      reward_total: 0.6,
      reward_components: JSON.stringify({
        independentSuccess: 1,
        errorReduction: 1,
        delayedRetention: 0,
        dependencyPenalty: 0,
        timeEfficiency: 1,
      }),
      policy_version: 'bandit-reward-v1',
    },
    {
      id: 'evt-update-001',
      user_id: 'research-3d-flow-c-1773808265873',
      session_id: 'session-research-3d-flow-c-1773808265873-1773808267008',
      timestamp: new Date(now - 1800000).toISOString(),
      event_type: 'bandit_updated',
      problem_id: 'bandit-update',
      selected_arm: 'adaptive',
      new_alpha: 2,
      new_beta: 1,
      policy_version: 'bandit-update-v1',
    },
    {
      id: 'evt-exec-001',
      user_id: 'research-3d-flow-c-1773808265873',
      session_id: 'session-research-3d-flow-c-1773808265873-1773808267008',
      timestamp: new Date(now - 1800000).toISOString(),
      event_type: 'execution',
      problem_id: 'problem-1',
      code: 'SELECT * FROM users',
      successful: true,
      time_spent: 1862,
      concept_ids: JSON.stringify(['select-basic']),
      condition_id: 'aggressive',
      policy_version: 'sql-engage-index-v3-hintid-contract',
    },
  ];
}

function generateSampleSessions() {
  return [
    {
      id: 'research-3d-flow-a-1773808257058-session-1773808258264',
      user_id: 'research-3d-flow-a-1773808257058',
      user_name: 'Flow A User',
      session_id: 'session-research-3d-flow-a-1773808257058-1773808258264',
      condition_id: 'adaptive',
      textbook_disabled: false,
      adaptive_ladder_disabled: false,
      immediate_explanation_mode: false,
      static_hint_mode: false,
      escalation_policy: 'adaptive',
      created_at: new Date(Date.now() - 3600000).toISOString(),
      updated_at: new Date(Date.now() - 3500000).toISOString(),
    },
    {
      id: 'research-3d-flow-c-1773808265873-session-1773808267008',
      user_id: 'research-3d-flow-c-1773808265873',
      user_name: 'Flow C User',
      session_id: 'session-research-3d-flow-c-1773808265873-1773808267008',
      condition_id: 'aggressive',
      textbook_disabled: false,
      adaptive_ladder_disabled: false,
      immediate_explanation_mode: false,
      static_hint_mode: false,
      escalation_policy: 'adaptive',
      created_at: new Date(Date.now() - 1800000).toISOString(),
      updated_at: new Date(Date.now() - 1700000).toISOString(),
    },
  ];
}

function generateSampleUsers() {
  return [
    {
      id: 'research-3d-flow-a-1773808257058',
      name: 'Flow A User',
      role: 'student',
      created_at: new Date(Date.now() - 7200000).toISOString(),
      updated_at: new Date(Date.now() - 3500000).toISOString(),
    },
    {
      id: 'research-3d-flow-c-1773808265873',
      name: 'Flow C User',
      role: 'student',
      created_at: new Date(Date.now() - 5400000).toISOString(),
      updated_at: new Date(Date.now() - 1700000).toISOString(),
    },
  ];
}

function generateSampleTextbookUnits() {
  return [
    {
      id: 'research-3d-flow-c-1773808265873-unit-001',
      user_id: 'research-3d-flow-c-1773808265873',
      user_name: 'Flow C User',
      unit_id: 'hint-select-basic',
      type: 'hint',
      title: 'SELECT Statement Basics',
      concept_ids: JSON.stringify(['select-basic']),
      status: 'primary',
      revision_count: 0,
      quality_score: null,
      auto_created: true,
      created_at: new Date(Date.now() - 1700000).toISOString(),
      updated_at: new Date(Date.now() - 1700000).toISOString(),
    },
  ];
}

function generateSampleProblemProgress() {
  return [
    {
      id: 1,
      user_id: 'research-3d-flow-c-1773808265873',
      user_name: 'Flow C User',
      problem_id: 'problem-1',
      solved: true,
      attempts_count: 1,
      hints_used: 0,
      first_attempted_at: new Date(Date.now() - 1800000).toISOString(),
      solved_at: new Date(Date.now() - 1798000).toISOString(),
      created_at: new Date(Date.now() - 1800000).toISOString(),
      updated_at: new Date(Date.now() - 1798000).toISOString(),
    },
  ];
}

function writeCsv(filename: string, records: any[], columns: string[]) {
  const csvPath = path.join(OUTPUT_DIR, filename);

  // Header
  const header = columns.join(',') + '\n';

  // Rows
  const rows = records.map(r =>
    columns.map(col => {
      const value = r[col];
      if (value === null || value === undefined) return '';
      if (typeof value === 'string') return escapeCsv(value);
      return String(value);
    }).join(',')
  ).join('\n');

  fs.writeFileSync(csvPath, header + rows);
  console.log(`   ✓ ${filename} (${records.length} records)`);
}

function main() {
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║  RESEARCH-4: Sample Export Generator                         ║');
  console.log('║  Creates sample export files from RESEARCH-3D data           ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log();

  ensureDir(OUTPUT_DIR);
  console.log(`📁 Output directory: ${OUTPUT_DIR}`);
  console.log();

  // Generate sample data
  const events = generateSampleEvents();
  const sessions = generateSampleSessions();
  const users = generateSampleUsers();
  const units = generateSampleTextbookUnits();
  const progress = generateSampleProblemProgress();

  // Filter bandit and escalation events
  const banditEvents = events.filter(e =>
    ['bandit_arm_selected', 'bandit_reward_observed', 'bandit_updated', 'profile_assigned'].includes(e.event_type)
  );
  const escalationEvents = events.filter(e =>
    e.from_rung !== undefined || e.to_rung !== undefined ||
    ['escalation_triggered', 'guidance_escalate'].includes(e.event_type)
  );

  console.log('📊 Exporting data files...');

  // Users
  writeCsv('users.csv', users, ['id', 'name', 'role', 'created_at', 'updated_at']);
  fs.writeFileSync(path.join(OUTPUT_DIR, 'users.json'), JSON.stringify(users, null, 2));

  // Sessions
  writeCsv('learner_sessions.csv', sessions, [
    'id', 'user_id', 'user_name', 'session_id', 'condition_id',
    'textbook_disabled', 'adaptive_ladder_disabled', 'immediate_explanation_mode',
    'static_hint_mode', 'escalation_policy', 'created_at', 'updated_at'
  ]);
  fs.writeFileSync(path.join(OUTPUT_DIR, 'learner_sessions.json'), JSON.stringify(sessions, null, 2));

  // Events
  writeCsv('interaction_events.csv', events, [
    'id', 'user_id', 'session_id', 'timestamp', 'event_type', 'problem_id',
    'successful', 'time_spent', 'profile_id', 'assignment_strategy',
    'selected_arm', 'selection_method', 'reward_total', 'new_alpha', 'new_beta',
    'from_rung', 'to_rung', 'trigger_reason', 'condition_id'
  ]);
  fs.writeFileSync(path.join(OUTPUT_DIR, 'interaction_events.json'), JSON.stringify(events, null, 2));

  // Bandit events
  writeCsv('bandit_events.csv', banditEvents, [
    'id', 'user_id', 'session_id', 'timestamp', 'event_type', 'problem_id',
    'selected_arm', 'selection_method', 'reward_total', 'new_alpha', 'new_beta',
    'profile_id', 'assignment_strategy'
  ]);
  fs.writeFileSync(path.join(OUTPUT_DIR, 'bandit_events.json'), JSON.stringify(banditEvents, null, 2));

  // Escalation events
  writeCsv('escalation_events.csv', escalationEvents, [
    'id', 'user_id', 'session_id', 'timestamp', 'event_type', 'problem_id',
    'from_rung', 'to_rung', 'trigger_reason', 'profile_id'
  ]);
  fs.writeFileSync(path.join(OUTPUT_DIR, 'escalation_events.json'), JSON.stringify(escalationEvents, null, 2));

  // Textbook units
  writeCsv('textbook_units.csv', units, [
    'id', 'user_id', 'user_name', 'unit_id', 'type', 'title',
    'concept_ids', 'status', 'revision_count', 'quality_score',
    'auto_created', 'created_at', 'updated_at'
  ]);
  fs.writeFileSync(path.join(OUTPUT_DIR, 'textbook_units.json'), JSON.stringify(units, null, 2));

  // Problem progress
  writeCsv('problem_progress.csv', progress, [
    'id', 'user_id', 'user_name', 'problem_id', 'solved',
    'attempts_count', 'hints_used', 'first_attempted_at', 'solved_at',
    'created_at', 'updated_at'
  ]);
  fs.writeFileSync(path.join(OUTPUT_DIR, 'problem_progress.json'), JSON.stringify(progress, null, 2));

  // Event type summary
  const eventTypeSummary = events.reduce((acc, e) => {
    acc[e.event_type] = (acc[e.event_type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const summaryRecords = Object.entries(eventTypeSummary).map(([event_type, count]) => ({
    event_type,
    count,
    unique_users: new Set(events.filter(e => e.event_type === event_type).map(e => e.user_id)).size,
    first_occurrence: events.filter(e => e.event_type === event_type).sort((a, b) =>
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())[0]?.timestamp,
    last_occurrence: events.filter(e => e.event_type === event_type).sort((a, b) =>
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0]?.timestamp,
  }));

  fs.writeFileSync(path.join(OUTPUT_DIR, 'event_type_summary.json'), JSON.stringify(summaryRecords, null, 2));
  console.log(`   ✓ event_type_summary.json (${summaryRecords.length} types)`);

  // Session events joined (simplified)
  const joined = events.map(e => {
    const session = sessions.find(s => s.session_id === e.session_id);
    return {
      ...e,
      condition_id: session?.condition_id || e.condition_id,
      escalation_policy: session?.escalation_policy,
      session_created_at: session?.created_at,
    };
  });
  fs.writeFileSync(path.join(OUTPUT_DIR, 'session_events_joined.json'), JSON.stringify(joined, null, 2));
  console.log(`   ✓ session_events_joined.json (${joined.length} records)`);

  // Manifest
  const manifest = {
    exportId: `research-4-sample-${Date.now()}`,
    timestamp: new Date().toISOString(),
    dataSource: 'RESEARCH-3D verification data',
    recordCounts: {
      users: users.length,
      sessions: sessions.length,
      events: events.length,
      textbookUnits: units.length,
      problemProgress: progress.length,
    },
    files: [
      'users.csv', 'users.json',
      'learner_sessions.csv', 'learner_sessions.json',
      'interaction_events.csv', 'interaction_events.json',
      'textbook_units.csv', 'textbook_units.json',
      'problem_progress.csv', 'problem_progress.json',
      'bandit_events.csv', 'bandit_events.json',
      'escalation_events.csv', 'escalation_events.json',
      'session_events_joined.json',
      'event_type_summary.json',
      'manifest.json',
    ],
  };

  fs.writeFileSync(path.join(OUTPUT_DIR, 'manifest.json'), JSON.stringify(manifest, null, 2));
  console.log(`   ✓ manifest.json`);

  console.log();
  console.log('✅ Sample export complete!');
  console.log();
  console.log('📊 Export Summary:');
  console.log(`   • Users: ${users.length}`);
  console.log(`   • Sessions: ${sessions.length}`);
  console.log(`   • Events: ${events.length}`);
  console.log(`   • Textbook Units: ${units.length}`);
  console.log(`   • Problem Progress: ${progress.length}`);
  console.log(`   • Bandit Events: ${banditEvents.length}`);
  console.log(`   • Escalation Events: ${escalationEvents.length}`);
  console.log();
  console.log(`📁 Output location: ${OUTPUT_DIR}/`);
  console.log(`📋 Data Dictionary: docs/research/RESEARCH-4-DATA-DICTIONARY.md`);
  console.log();
  console.log('Next steps:');
  console.log('  1. Review the exported CSV files');
  console.log('  2. Check the data dictionary for field meanings');
  console.log('  3. For production export, run: npm run research:export (with DATABASE_URL set)');
}

main();
