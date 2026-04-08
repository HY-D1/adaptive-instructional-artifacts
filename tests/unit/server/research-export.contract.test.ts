/* @vitest-environment node */

import { describe, expect, it } from 'vitest';

import {
  RESEARCH_EXPORT_FILES,
  buildAuthEventsCsv,
  buildInteractionEventsCsv,
  buildResearchExportRows,
} from '../../../apps/server/src/scripts/export-research-data';

describe('research export contract', () => {
  it('includes hint_id, concept_view metadata, and session_end metrics in interaction event csv exports', () => {
    const csv = buildInteractionEventsCsv([
      {
        id: 'evt-1',
        user_id: 'learner-1',
        session_id: 'session-1',
        timestamp: '2026-04-05T00:00:00.000Z',
        event_type: 'concept_view',
        problem_id: 'textbook:joins',
        hint_id: 'sql-engage:joins:hint:sql-engage:joins:1:L2',
        successful: null,
        time_spent: null,
        total_time: null,
        problems_attempted: null,
        problems_solved: null,
        source: 'textbook',
        concept_id: 'joins',
        concept_ids: '["joins"]',
        learner_profile_id: null,
        escalation_trigger_reason: null,
        error_count_at_escalation: null,
        time_to_escalation: null,
        strategy_assigned: null,
        strategy_updated: null,
        reward_value: null,
        created_at: '2026-04-05T00:00:00.000Z',
      },
    ]);

    const [header, row] = csv.trim().split('\n');
    expect(header).toContain('hint_id');
    expect(header).toContain('concept_id');
    expect(header).toContain('source');
    expect(header).toContain('total_time');
    expect(row).toContain('concept_view');
    expect(row).toContain('textbook');
    expect(row).toContain('joins');
    expect(row).toContain('sql-engage:joins:hint:sql-engage:joins:1:L2');
  });

  it('includes paper-critical hint identity fields in interaction event csv exports', () => {
    const csv = buildInteractionEventsCsv([
      {
        id: 'hint-1',
        user_id: 'learner-1',
        session_id: 'session-1',
        timestamp: '2026-04-05T00:00:00.000Z',
        event_type: 'hint_view',
        problem_id: 'problem-1',
        hint_id: 'sql-engage:joins:hint:sql-engage:joins:1:L2',
        hint_text: 'Check the join predicate.',
        hint_level: 2,
        help_request_index: 1,
        sql_engage_subtype: 'joins',
        sql_engage_row_id: 'sql-engage:joins:1',
        template_id: 'hint_template_v1',
        policy_version: 'sql-engage-v1',
        created_at: '2026-04-05T00:00:00.000Z',
      },
    ]);

    const [header, row] = csv.trim().split('\n');
    expect(header).toContain('hint_text');
    expect(header).toContain('hint_level');
    expect(header).toContain('help_request_index');
    expect(header).toContain('sql_engage_subtype');
    expect(header).toContain('sql_engage_row_id');
    expect(header).toContain('template_id');
    expect(header).toContain('policy_version');
    expect(row).toContain('Check the join predicate.');
    expect(row).toContain('hint_template_v1');
    expect(row).toContain('sql-engage-v1');
  });

  it('includes truthful provenance labels in interaction event csv exports', () => {
    const csv = buildInteractionEventsCsv([
      {
        id: 'hint-missing-template',
        eventType: 'hint_view',
        timestamp: '2026-04-05T00:00:00.000Z',
        learnerId: 'learner-1',
        sessionId: 'session-1',
        problemId: 'problem-1',
        hintId: 'sql-engage:joins:hint:sql-engage:joins:1:L2',
        templateId: null,
        sqlEngageSubtype: 'joins',
        sqlEngageRowId: 'sql-engage:joins:1',
        hasRetrievalLinks: false,
        provenanceStatus: 'unverifiable_template',
        telemetryProvenanceStatus: 'unverifiable_template',
        legacyBackfillApplied: true,
        templateIdUnverifiable: true,
      },
    ]);

    const [header, row] = csv.trim().split('\n');
    expect(header).toContain('provenanceStatus');
    expect(header).toContain('telemetryProvenanceStatus');
    expect(header).toContain('legacyBackfillApplied');
    expect(header).toContain('templateIdUnverifiable');
    expect(row).toContain('unverifiable_template');
  });

  it('labels raw interaction rows before paper export serialization', () => {
    const exportRows = buildResearchExportRows([
      {
        id: 'hint-missing-template',
        event_type: 'hint_view',
        timestamp: '2026-04-05T00:00:00.000Z',
        learner_id: 'learner-1',
        session_id: 'session-1',
        problem_id: 'problem-1',
        hint_id: 'sql-engage:joins:hint:sql-engage:joins:1:L2',
        template_id: null,
        sql_engage_subtype: 'joins',
        sql_engage_row_id: 'sql-engage:joins:1',
        has_retrieval_links: false,
      },
      {
        id: 'chat-backfilled-retrieval',
        event_type: 'chat_interaction',
        timestamp: '2026-04-05T00:00:01.000Z',
        learner_id: 'learner-1',
        session_id: 'session-1',
        problem_id: 'problem-1',
        hint_id: null,
        template_id: null,
        sql_engage_subtype: null,
        sql_engage_row_id: null,
        has_retrieval_links: true,
      },
    ]);

    expect(exportRows).toEqual([
      expect.objectContaining({
        id: 'hint-missing-template',
        provenanceStatus: 'unverifiable_template',
        telemetryProvenanceStatus: 'unverifiable_template',
        legacyBackfillApplied: true,
        templateIdUnverifiable: true,
      }),
      expect.objectContaining({
        id: 'chat-backfilled-retrieval',
        provenanceStatus: 'backfilled_partial',
        telemetryProvenanceStatus: 'backfilled_partial',
        legacyBackfillApplied: true,
        templateIdUnverifiable: false,
      }),
    ]);
  });

  it('includes auth_events artifacts and hashed email fields in auth csv exports', () => {
    const csv = buildAuthEventsCsv([
      {
        id: 'auth-1',
        timestamp: '2026-04-05T00:00:00.000Z',
        email_hash: 'abc123',
        account_id: 'account-1',
        learner_id: 'learner-1',
        role: 'student',
        outcome: 'success',
        failure_reason: null,
        created_at: '2026-04-05T00:00:00.000Z',
      },
    ]);

    const [header, row] = csv.trim().split('\n');
    expect(header).toContain('email_hash');
    expect(header).toContain('failure_reason');
    expect(row).toContain('abc123');
    expect(RESEARCH_EXPORT_FILES).toContain('auth_events.csv');
    expect(RESEARCH_EXPORT_FILES).toContain('auth_events.json');
  });
});
