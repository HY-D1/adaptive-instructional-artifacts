/* @vitest-environment node */

import { describe, expect, it } from 'vitest';

import {
  RESEARCH_EXPORT_FILES,
  buildAuthEventsCsv,
  buildInteractionEventsCsv,
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
