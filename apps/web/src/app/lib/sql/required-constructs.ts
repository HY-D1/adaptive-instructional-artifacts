import type { RequiredSqlConstruct, SQLProblem } from '../../types';

/** Removes comments and string literals so keywords inside them do not count. */
function cleanQuery(query: string): string {
  return query
    .replace(/--.*$/gm, ' ')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/'(?:[^']|'')*'/g, "''");
}

/**
 * Returns a message for each construct the question asks for that the query is
 * missing (or uses when it should not). An empty list means the query is fine.
 */
export function findMissingConstructs(
  query: string,
  constructs: RequiredSqlConstruct[] | undefined,
): string[] {
  if (!constructs || constructs.length === 0) return [];
  const cleaned = cleanQuery(query);
  const problems: string[] = [];
  for (const construct of constructs) {
    let found: boolean;
    try {
      found = new RegExp(construct.pattern, 'i').test(cleaned);
    } catch {
      continue; // A bad pattern should never block a learner.
    }
    if (construct.forbid && found) {
      problems.push(`Your results match, but this problem asks you not to use ${construct.label}.`);
    } else if (!construct.forbid && !found) {
      problems.push(`Your results match, but this problem asks you to use ${construct.label}.`);
    }
  }
  return problems;
}

export function findMissingConstructsForProblem(
  query: string,
  problem: Pick<SQLProblem, 'requiredConstructs'>,
): string[] {
  return findMissingConstructs(query, problem.requiredConstructs);
}
