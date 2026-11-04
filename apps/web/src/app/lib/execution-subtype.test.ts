/**
 * execution-subtype.test.ts
 *
 * `resolveExecutionSubtype` decides the subtype LearningInterface writes into
 * both `errorSubtypeId` and `sqlEngageSubtype` of the execution event. The
 * server (`deriveProfileEventUpdate` in apps/server/src/db/neon.ts) increments
 * the learner's `error_history` for any event carrying `errorSubtypeId`, so a
 * wrong-result run with a semantic subtype now counts as an error for that
 * subtype. That is intended: a wrong answer should earn a targeted hint. These
 * tests pin it so the behaviour is explicit rather than incidental.
 */
import { describe, it, expect } from 'vitest';
import { resolveExecutionSubtype } from './execution-subtype';
import { sqlProblems } from '../data/problems';
import type { SQLProblem } from '../types';

function problem(id: string): SQLProblem {
  const found = sqlProblems.find((candidate) => candidate.id === id);
  if (!found) throw new Error(`fixture problem ${id} missing`);
  return found;
}

describe('resolveExecutionSubtype', () => {
  it('gives a wrong-result run on an order-sensitive problem a canonical subtype', () => {
    const orderProblem = problem('problem-6');
    expect(orderProblem.orderSensitive).toBe(true);
    expect(
      resolveExecutionSubtype({
        query: 'SELECT name, age FROM users;',
        result: { success: true },
        actuallyCorrect: false,
        problem: orderProblem
      })
    ).toBe('incorrect order by usage');
  });

  it('gives a wrong-result run on a result-graded problem a canonical subtype', () => {
    const p = problem('problem-6');
    expect(
      resolveExecutionSubtype({
        query: 'SELECT * FROM users ORDER BY age DESC;',
        result: { success: true },
        actuallyCorrect: false,
        problem: p
      })
    ).toBe('incorrect wildcard usage');
  });

  it('carries no subtype for a correct run', () => {
    expect(
      resolveExecutionSubtype({
        query: 'SELECT name, age FROM users ORDER BY age DESC;',
        result: { success: true },
        actuallyCorrect: true,
        problem: problem('problem-6')
      })
    ).toBeUndefined();
  });

  it('carries no semantic subtype for a state-graded (database-state-v1) problem', () => {
    const stateProblem = sqlProblems.find((candidate) => candidate.gradingMode === 'database-state-v1');
    expect(stateProblem, 'expected at least one database-state-v1 problem').toBeDefined();
    expect(
      resolveExecutionSubtype({
        query: 'SELECT * FROM users;',
        result: { success: true },
        actuallyCorrect: false,
        problem: stateProblem as SQLProblem
      })
    ).toBeUndefined();
  });

  it('still canonicalises the engine subtype for a failed run on a state-graded problem', () => {
    const stateProblem = sqlProblems.find((candidate) => candidate.gradingMode === 'database-state-v1') as SQLProblem;
    expect(
      resolveExecutionSubtype({
        query: 'INSERT INTO userz VALUES (1);',
        result: { success: false, errorSubtypeId: 'undefined table' },
        actuallyCorrect: false,
        problem: stateProblem
      })
    ).toBe('undefined table');
  });

  it('lets an instructor override replace the classified subtype', () => {
    expect(
      resolveExecutionSubtype({
        query: 'SELECT name, age FROM users;',
        result: { success: true },
        actuallyCorrect: false,
        problem: problem('problem-6'),
        instructorSubtypeOverride: 'incorrect select usage'
      })
    ).toBe('incorrect select usage');
  });
});
