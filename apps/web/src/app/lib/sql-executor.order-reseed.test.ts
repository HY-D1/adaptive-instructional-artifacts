import { describe, expect, it } from 'vitest';
import { hasTopLevelOrderBy } from './sql-executor';
import { sqlProblems } from '../data/problems';

describe('hasTopLevelOrderBy', () => {
  it('detects a top-level ORDER BY', () => {
    expect(hasTopLevelOrderBy('SELECT name FROM users ORDER BY age DESC;')).toBe(true);
    expect(hasTopLevelOrderBy('select x from t\norder   by x')).toBe(true);
  });

  it('ignores ORDER BY inside window functions, subqueries, strings and comments', () => {
    expect(hasTopLevelOrderBy('SELECT RANK() OVER (ORDER BY salary DESC) FROM employees')).toBe(false);
    expect(hasTopLevelOrderBy("SELECT 'order by' FROM t")).toBe(false);
    expect(hasTopLevelOrderBy('SELECT a FROM t -- order by a')).toBe(false);
    expect(hasTopLevelOrderBy('SELECT a FROM t /* ORDER BY a */')).toBe(false);
  });
});

describe('order-sensitive problems', () => {
  const flagged = sqlProblems.filter((problem) => problem.orderSensitive);

  it('flags exactly the problems whose task asks for an order', () => {
    expect(flagged.map((problem) => problem.id).sort()).toEqual(['problem-14', 'problem-15', 'problem-16', 'problem-6']);
  });

  it('keeps every reference solution passing the ordering rule', () => {
    for (const problem of flagged) {
      expect(hasTopLevelOrderBy(problem.expectedQuery), problem.id).toBe(true);
    }
  });
});
