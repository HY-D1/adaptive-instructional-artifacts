import { describe, expect, it } from 'vitest';
import { getProblemById } from '../data/problems';
import { gradeDatabaseState } from './sql-state-grading';

describe('database state grading for mutation exercises', () => {
  const cases = [
    ['problem-18', "INSERT INTO users VALUES (6, 'Frank', 'frank@email.com', 40, 'Austin');", "INSERT INTO users VALUES (6, 'Frank', 'wrong@email.com', 40, 'Austin');"],
    ['problem-19', "UPDATE users SET age = 26 WHERE name = 'Alice';", 'UPDATE users SET age = 26;'],
    ['problem-20', "DELETE FROM users WHERE city = 'Portland';", 'DELETE FROM users WHERE 1=0;'],
  ] as const;

  for (const [id, correct, incorrect] of cases) {
    it(`${id} accepts the reference state and rejects no-op or incorrect state`, async () => {
      const problem = getProblemById(id)!;
      expect((await gradeDatabaseState(problem, correct)).match).toBe(true);
      expect((await gradeDatabaseState(problem, 'SELECT 1;')).match).toBe(false);
      expect((await gradeDatabaseState(problem, incorrect)).match).toBe(false);
      expect((await gradeDatabaseState(problem, correct)).match).toBe(true);
    });
  }
});
