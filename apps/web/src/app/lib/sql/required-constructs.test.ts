import { describe, expect, it } from 'vitest';
import { sqlProblems as problems } from '../../data/problems';
import { findMissingConstructs } from './required-constructs';

describe('findMissingConstructs', () => {
  const exists = [{ pattern: '\\bEXISTS\\s*\\(', label: 'EXISTS' }];

  it('passes when the required keyword is present, ignoring case', () => {
    expect(findMissingConstructs('select * from a where exists (select 1)', exists)).toEqual([]);
  });

  it('flags a query that gets the right rows without the required keyword', () => {
    expect(findMissingConstructs('SELECT * FROM a JOIN b ON a.id = b.id', exists)[0]).toContain('EXISTS');
  });

  it('ignores keywords inside comments and string literals', () => {
    expect(findMissingConstructs("SELECT 'EXISTS (' -- EXISTS (\nFROM a", exists)).toHaveLength(1);
  });

  it('flags a forbidden construct', () => {
    const noStar = [{ pattern: 'SELECT\\s+\\*', label: '*', forbid: true }];
    expect(findMissingConstructs('SELECT * FROM users', noStar)).toHaveLength(1);
    expect(findMissingConstructs('SELECT name FROM users', noStar)).toEqual([]);
  });

  it('accepts the reference answer of every problem that has requirements', () => {
    for (const problem of problems) {
      if (!problem.requiredConstructs) continue;
      expect(findMissingConstructs(problem.expectedQuery ?? '', problem.requiredConstructs), problem.id).toEqual([]);
    }
  });
  it('wildcard questions (problems 1 and 8) reject a query that lists the columns instead of *', () => {
    for (const id of ['problem-1', 'problem-8']) {
      const problem = problems.find((p) => p.id === id)!;
      expect(findMissingConstructs('SELECT id, name, email, age FROM users;', problem.requiredConstructs), id).toHaveLength(1);
      expect(findMissingConstructs('SELECT * FROM users;', problem.requiredConstructs), id).toEqual([]);
      expect(findMissingConstructs('select  *  from users', problem.requiredConstructs), id).toEqual([]);
    }
  });
});
