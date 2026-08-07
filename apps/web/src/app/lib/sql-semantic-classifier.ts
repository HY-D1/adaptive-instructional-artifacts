/**
 * Classification for queries SQLite executes successfully but which answer the
 * problem wrongly.
 *
 * `normalizeSqlErrorSubtype` is called from exactly one place — the `catch`
 * block in `sql-executor.ts` — so it only ever sees engine throws. That left 12
 * of the 23 canonical SQL-Engage subtypes unreachable, because they describe
 * queries SQLite runs happily: permissive `GROUP BY`, `HAVING` without a group,
 * comma joins with no predicate, a forgotten `DISTINCT`. A learner whose query
 * ran but returned the wrong rows therefore carried no subtype at all, and the
 * hint pipeline — which selects on subtype — had nothing to target.
 *
 * This module is deliberately separate from `normalizeSqlErrorSubtype` so the
 * engine-error path keeps its behaviour and its regression test keeps its
 * meaning. Rules are ordered by how directly each mistake causes a wrong
 * result, and `null` is returned rather than a guess: an unclassified wrong
 * answer is honest, a mislabelled one sends the learner targeted advice about a
 * problem they do not have.
 */

/**
 * Canonical subtypes this classifier deliberately never emits, with the reason.
 * Making these fire would recreate the over-broad-branch defect that made every
 * SQLite syntax error look like a missing comma.
 */
export const SEMANTIC_SUBTYPE_EXCLUSIONS: Record<string, string> = {
  'inefficient query':
    'Would have to fire on answers that are correct, which means emitting an error-class signal on the success path the papers measure. Left unreachable on purpose.',
  'missing semicolons':
    'SQLite does not require a trailing semicolon and returns identical rows without one, so a missing semicolon can never be the cause of a wrong answer.',
  'non-standard operators':
    'SQLite accepts == and != and returns the same rows as = and <>, so the operator choice cannot cause a wrong answer. It is a portability concern, not this learner attempt failing.'
};

export type SemanticClassifierInput = {
  /** The query the learner ran. */
  query: string;
  /** The problem's reference solution. */
  expectedQuery: string;
};

const AGGREGATE_PATTERN = /\b(count|sum|avg|min|max|total|group_concat)\s*\(/gi;

const CLAUSE_BOUNDARY = /\b(from|where|group\s+by|having|order\s+by|limit|offset|union|except|intersect)\b/i;

/** Strips string literals and comments so scans never match inside a value. */
function stripLiterals(sql: string): string {
  return sql
    .replace(/--[^\n]*/g, ' ')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/'[^']*'/g, "''")
    .replace(/"[^"]*"/g, '""');
}

function normalize(sql: string): string {
  return stripLiterals(sql).replace(/\s+/g, ' ').replace(/;\s*$/, '').trim();
}

function countAggregates(text: string): number {
  return (text.match(AGGREGATE_PATTERN) || []).length;
}

function hasClause(sql: string, clause: 'group by' | 'having' | 'order by' | 'where'): boolean {
  const pattern = clause === 'group by'
    ? /\bgroup\s+by\b/i
    : clause === 'order by'
      ? /\border\s+by\b/i
      : clause === 'having'
        ? /\bhaving\b/i
        : /\bwhere\b/i;
  return pattern.test(sql);
}

/** The text between SELECT and FROM, with a leading DISTINCT removed. */
function selectList(sql: string): string {
  const match = /\bselect\b([\s\S]*?)(?:\bfrom\b|$)/i.exec(sql);
  if (!match) return '';
  return match[1].replace(/^\s*distinct\b/i, '').trim();
}

function hasDistinct(sql: string): boolean {
  return /\bselect\s+distinct\b/i.test(sql);
}

/** The text between FROM and the next clause keyword. */
function fromClause(sql: string): string {
  const match = /\bfrom\b([\s\S]*)/i.exec(sql);
  if (!match) return '';
  const rest = match[1];
  const boundary = CLAUSE_BOUNDARY.exec(rest);
  return (boundary ? rest.slice(0, boundary.index) : rest).trim();
}

/** The clause between WHERE and the next clause keyword. */
function whereClause(sql: string): string {
  const match = /\bwhere\b([\s\S]*)/i.exec(sql);
  if (!match) return '';
  const rest = match[1];
  const boundary = CLAUSE_BOUNDARY.exec(rest);
  return (boundary ? rest.slice(0, boundary.index) : rest).trim();
}

/** Splits on commas that are not inside parentheses. */
function splitTopLevel(text: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = '';
  for (const ch of text) {
    if (ch === '(') depth += 1;
    if (ch === ')') depth -= 1;
    if (ch === ',' && depth === 0) {
      parts.push(current.trim());
      current = '';
      continue;
    }
    current += ch;
  }
  if (current.trim()) parts.push(current.trim());
  return parts.filter(Boolean);
}

/** Selected columns, normalised so alias and qualifier differences don't count. */
function selectedColumns(sql: string): string[] {
  return splitTopLevel(selectList(sql))
    .map((entry) =>
      entry
        .replace(/\s+as\s+[a-z_][a-z0-9_]*$/i, '')
        .replace(/^[a-z_][a-z0-9_]*\./i, '')
        .replace(/\s+/g, '')
        .toLowerCase()
    )
    .filter(Boolean);
}

function tableCount(from: string): number {
  if (!from) return 0;
  const joins = (from.match(/\bjoin\b/gi) || []).length;
  return splitTopLevel(from).length + joins;
}

function hasJoinPredicate(sql: string): boolean {
  if (/\b(on|using)\b/i.test(fromClause(sql))) return true;
  // A predicate comparing two qualified columns in WHERE is a valid join too.
  return /\b[a-z_][a-z0-9_]*\.[a-z_][a-z0-9_]*\s*=\s*[a-z_][a-z0-9_]*\.[a-z_][a-z0-9_]*/i.test(
    whereClause(sql)
  );
}

function sameColumns(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((column, index) => column === b[index]);
}

/**
 * Returns a canonical SQL-Engage subtype for a query that ran but answered
 * wrongly, or `null` when no rule identifies a plausible cause.
 *
 * Ordered by how directly the mistake produces a wrong result: a cartesian
 * product or an ungrouped aggregate is always wrong, whereas a missing
 * `ORDER BY` is graded correct today (`compareResults` matches rows in any
 * order), so it is checked last.
 */
export function classifySemanticSqlIssue(input: SemanticClassifierInput): string | null {
  const query = normalize(input.query);
  const expected = normalize(input.expectedQuery);
  if (!query) return null;

  const queryColumns = selectedColumns(query);
  const expectedColumns = selectedColumns(expected);
  const queryAggregates = countAggregates(selectList(query));
  const expectedAggregates = countAggregates(selectList(expected));

  // Two or more tables with nothing connecting them: a cartesian product.
  if (tableCount(fromClause(query)) > 1 && !hasJoinPredicate(query)) {
    return 'incorrect join usage';
  }

  // An aggregate beside a bare column with no GROUP BY. SQLite collapses this
  // to a single arbitrary row instead of erroring.
  if (queryAggregates > 0 && !hasClause(query, 'group by')) {
    const bareColumns = queryColumns.filter((column) => countAggregates(column) === 0);
    if (bareColumns.length > 0) {
      return 'incorrect group by usage';
    }
  }

  // Note: `HAVING` without `GROUP BY` and an aggregate used as a row filter are
  // deliberately not handled here. Verified by execution: SQLite rejects both
  // ("HAVING clause on a non-aggregate query", "misuse of aggregate function
  // COUNT()"), so they are engine errors and belong to
  // `normalizeSqlErrorSubtype`. A rule for them here would never fire.

  // Aggregating when a row-level answer was wanted, or the reverse.
  if ((queryAggregates > 0) !== (expectedAggregates > 0)) {
    return 'aggregation misuse';
  }

  // SELECT * where the problem asked for specific columns.
  if (queryColumns.includes('*') && !expectedColumns.includes('*')) {
    return 'incorrect wildcard usage';
  }

  // A LIKE pattern with no wildcard behaves as plain equality.
  if (/\blike\b\s*''/i.test(query) && /\blike\b/i.test(expected)) {
    const literals = /\blike\s+'([^']*)'/i.exec(input.query);
    if (literals && !/[%_]/.test(literals[1])) {
      return 'incorrect wildcard usage';
    }
  }

  if (!sameColumns(queryColumns, expectedColumns)) {
    return 'incorrect select usage';
  }

  if (hasDistinct(query) !== hasDistinct(expected)) {
    return 'incorrect distinct usage';
  }

  if (hasClause(expected, 'order by') !== hasClause(query, 'order by')) {
    return 'incorrect order by usage';
  }

  return null;
}
