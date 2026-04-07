/* @vitest-environment node */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { buildSqliteInteractionPayload } from '../../../apps/server/src/db/sqlite';
import { buildNeonInteractionPayload } from '../../../apps/server/src/routes/neon-interactions';
import { createInteractionSchema } from '../../../apps/server/src/routes/interactions';
import {
  RESEARCH_EXPORT_FIELDS_PRESERVED,
  convertInteractionsToCsv,
} from '../../../apps/server/src/routes/research';

const repoRoot = process.cwd();

describe('logging contract routing', () => {
  it('keeps concept and session fields in instructor research CSV exports', () => {
    const csv = convertInteractionsToCsv([
      {
        id: 'session-end-1',
        learnerId: 'learner-1',
        sessionId: 'session-1',
        timestamp: '2026-04-07T00:00:00.000Z',
        eventType: 'session_end',
        problemId: 'session-summary',
        totalTime: 12345,
        problemsAttempted: 3,
        problemsSolved: 2,
        conceptId: 'joins',
        conceptIds: ['joins'],
        source: 'hint',
        createdAt: '2026-04-07T00:00:01.000Z',
      },
    ]);

    const [header, row] = csv.trim().split('\n');
    expect(header.split(',')).toEqual(expect.arrayContaining([
      'hintId',
      'conceptId',
      'source',
      'totalTime',
      'problemsAttempted',
      'problemsSolved',
    ]));
    expect(row).toContain('session_end');
    expect(row).toContain('12345');
    expect(row).toContain('3');
    expect(row).toContain('2');
    expect(row).toContain('joins');
    expect(row).toContain('hint');
  });

  it('advertises the new study fields in instructor research JSON metadata', () => {
    expect(RESEARCH_EXPORT_FIELDS_PRESERVED).toEqual(expect.arrayContaining([
      'hintId',
      'conceptId',
      'source',
      'totalTime',
      'problemsAttempted',
      'problemsSolved',
    ]));
  });

  it('accepts new study fields in the legacy SQLite interaction route schema', () => {
    const parsed = createInteractionSchema.safeParse({
      learnerId: 'learner-1',
      sessionId: 'session-1',
      timestamp: '2026-04-07T00:00:00.000Z',
      eventType: 'session_end',
      problemId: 'session-summary',
      conceptId: 'joins',
      conceptIds: ['joins'],
      source: 'hint',
      totalTime: 12345,
      problemsAttempted: 3,
      problemsSolved: 2,
    });

    expect(parsed.success).toBe(true);
    expect(parsed.success && parsed.data).toMatchObject({
      conceptId: 'joins',
      source: 'hint',
      totalTime: 12345,
      problemsAttempted: 3,
      problemsSolved: 2,
    });
  });

  it('keeps new study fields in the SQLite fallback payload', () => {
    expect(buildSqliteInteractionPayload({
      id: 'hint-1',
      learnerId: 'learner-1',
      sessionId: 'session-1',
      timestamp: '2026-04-07T00:00:00.000Z',
      eventType: 'hint_view',
      problemId: 'problem-1',
      hintId: 'sql-engage:joins:hint:sql-engage:joins:1:L2',
      conceptId: 'joins',
      conceptIds: ['joins'],
      source: 'hint',
      totalTime: 12345,
      problemsAttempted: 3,
      problemsSolved: 2,
    })).toMatchObject({
      hintId: 'sql-engage:joins:hint:sql-engage:joins:1:L2',
      conceptId: 'joins',
      conceptIds: ['joins'],
      source: 'hint',
      totalTime: 12345,
      problemsAttempted: 3,
      problemsSolved: 2,
    });
  });

  it('keeps top-level hintId when Neon requests include nested payloads', () => {
    const singlePayload = buildNeonInteractionPayload({
      eventType: 'hint_view',
      hintId: 'sql-engage:joins:hint:sql-engage:joins:1:L2',
      conceptId: 'joins',
      source: 'hint',
      payload: {
        sessionId: 'session-1',
        hintLevel: 2,
      },
    });
    const batchPayload = buildNeonInteractionPayload({
      eventType: 'hint_view',
      hintId: 'sql-engage:where-clause:hint:sql-engage:where-clause:1:L1',
      conceptId: 'where-clause',
      source: 'hint',
      payload: {
        sessionId: 'session-1',
        hintLevel: 1,
      },
    });

    expect(singlePayload).toMatchObject({
      hintId: 'sql-engage:joins:hint:sql-engage:joins:1:L2',
      conceptId: 'joins',
      source: 'hint',
    });
    expect(batchPayload).toMatchObject({
      hintId: 'sql-engage:where-clause:hint:sql-engage:where-clause:1:L1',
      conceptId: 'where-clause',
      source: 'hint',
    });
  });

  it('documents that hint_view preserves hintId', () => {
    const spec = readFileSync(join(repoRoot, 'docs/research/LOGGING_SPECIFICATION.md'), 'utf8');
    expect(spec).toContain('`hint_view` events preserve `hintId`');
    expect(spec).not.toContain('`hint_view` events **intentionally omit** the `hintId` field');
  });
});
