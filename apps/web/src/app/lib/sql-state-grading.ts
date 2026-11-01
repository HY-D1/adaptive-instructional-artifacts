import type { SQLProblem } from '../types';
import { SQLExecutor } from './sql-executor';

/** Grade each submission from the original seed, independently of editor history. */
export async function gradeDatabaseState(
  problem: SQLProblem,
  query: string,
): Promise<{ match: boolean; differences: string[] }> {
  const reference = new SQLExecutor();
  const submission = new SQLExecutor();
  try {
    if (!problem.gradingStateQuery) throw new Error('Missing database state check');
    await reference.initialize(problem.schema);
    await submission.initialize(problem.schema);
    const expectedExecution = await reference.executeQuery(problem.expectedQuery);
    const actualExecution = await submission.executeQuery(query);
    if (!expectedExecution.success || !actualExecution.success) {
      return { match: false, differences: ['Unable to verify database state.'] };
    }
    const expected = await reference.executeQuery(problem.gradingStateQuery);
    const actual = await submission.executeQuery(problem.gradingStateQuery);
    if (!expected.success || !actual.success) {
      return { match: false, differences: ['Unable to verify database state.'] };
    }
    // Sort complete rows, not individual values: column/value associations matter.
    const rows = (values: unknown[][] | undefined) =>
      (values ?? []).map(row => JSON.stringify(row)).sort();
    const match = JSON.stringify(actual.columns) === JSON.stringify(expected.columns) &&
      JSON.stringify(rows(actual.values)) === JSON.stringify(rows(expected.values));
    return { match, differences: match ? [] : ['Database state does not match the requested change.'] };
  } catch {
    return { match: false, differences: ['Unable to verify database state.'] };
  } finally {
    reference.close();
    submission.close();
  }
}
