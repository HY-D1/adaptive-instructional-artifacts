/**
 * concept-compatibility-map.ts
 *
 * Deterministic mapping from adaptive internal concept IDs to helper-corpus keys.
 *
 * WHY THIS EXISTS
 * The app uses short, stable internal IDs (e.g. "joins", "having-clause") defined
 * in concept-graph.ts and alignment-map.json.  The helper-export corpus uses
 * namespaced keys (e.g. "dbms-ramakrishnan-3rd-edition/joins") that don't share
 * the same vocabulary.  Suffix-matching alone leaves 23 of 30 internal IDs
 * unresolved against the real 70-concept corpus.
 *
 * FORMAT
 * Each entry is an ordered array of corpus keys.  Resolution picks the first
 * key that actually exists in the loaded concept-map.json, so the order encodes
 * source preference (Ramakrishnan-first for theory concepts, Murach-first for
 * MySQL-specific features).  This is stable regardless of object-key ordering.
 *
 * MAINTENANCE
 * When new corpus concepts are added or internal concept IDs change, update this
 * map accordingly.  The concept-resolution-audit.test.ts gate will fail if
 * the resolution rate drops below the required threshold.
 */

/**
 * Maps each adaptive internal concept ID to an ordered list of corpus keys.
 * First entry = preferred canonical match when multiple textbooks cover the concept.
 */
export const CONCEPT_COMPATIBILITY_MAP: Record<string, readonly string[]> = {
  // ── Basics ───────────────────────────────────────────────────────────────
  'select-basic': [
    'dbms-ramakrishnan-3rd-edition/select-basic',
    'murachs-mysql-3rd-edition/select-statement-murach',
  ],
  'distinct': [
    // DISTINCT is part of the projection/selection discussion in Ramakrishnan
    'dbms-ramakrishnan-3rd-edition/selection-projection',
    'dbms-ramakrishnan-3rd-edition/select-basic',
  ],
  'alias': [
    // Table/column aliases are introduced alongside the SELECT statement
    'dbms-ramakrishnan-3rd-edition/select-basic',
    'murachs-mysql-3rd-edition/select-statement-murach',
  ],

  // ── Filtering ────────────────────────────────────────────────────────────
  'where-clause': [
    'dbms-ramakrishnan-3rd-edition/where-clause',
    'murachs-mysql-3rd-edition/where-clause-murach',
  ],
  'logical-operators': [
    // AND/OR/NOT are covered within WHERE clause sections
    'dbms-ramakrishnan-3rd-edition/where-clause',
    'murachs-mysql-3rd-edition/where-clause-murach',
  ],
  'null-handling': [
    // IS NULL / IS NOT NULL are part of WHERE clause predicate coverage
    'dbms-ramakrishnan-3rd-edition/where-clause',
    'murachs-mysql-3rd-edition/where-clause-murach',
  ],
  'in-operator': [
    // IN appears in WHERE clause sections; also used with subqueries
    'dbms-ramakrishnan-3rd-edition/where-clause',
    'dbms-ramakrishnan-3rd-edition/subqueries',
  ],
  'between-operator': [
    'dbms-ramakrishnan-3rd-edition/where-clause',
    'murachs-mysql-3rd-edition/where-clause-murach',
  ],
  'like-pattern': [
    'dbms-ramakrishnan-3rd-edition/where-clause',
    'murachs-mysql-3rd-edition/where-clause-murach',
  ],

  // ── Joining ──────────────────────────────────────────────────────────────
  'joins': [
    'dbms-ramakrishnan-3rd-edition/joins',
    'murachs-mysql-3rd-edition/joins-murach',
  ],
  'join-condition-missing': [
    // ON-clause requirement covered in joins and inner-join concepts
    'dbms-ramakrishnan-3rd-edition/joins',
    'dbms-ramakrishnan-3rd-edition/inner-join',
  ],
  'ambiguous-column': [
    // Column qualification is a JOIN concern
    'dbms-ramakrishnan-3rd-edition/joins',
    'murachs-mysql-3rd-edition/joins-murach',
  ],
  'self-join': [
    'dbms-ramakrishnan-3rd-edition/joins',
    'murachs-mysql-3rd-edition/joins-murach',
  ],
  'cross-join': [
    'dbms-ramakrishnan-3rd-edition/joins',
    'murachs-mysql-3rd-edition/joins-murach',
  ],

  // ── Aggregation ───────────────────────────────────────────────────────────
  'aggregation': [
    'dbms-ramakrishnan-3rd-edition/aggregate-functions',
    'murachs-mysql-3rd-edition/aggregate-functions-murach',
  ],
  'group-by': [
    'dbms-ramakrishnan-3rd-edition/group-by',
    'murachs-mysql-3rd-edition/group-by-murach',
  ],
  'group-by-error': [
    // Non-aggregated columns in SELECT must appear in GROUP BY
    // Mapped to general GROUP BY concepts as there's no dedicated error concept
    'dbms-ramakrishnan-3rd-edition/group-by',
    'murachs-mysql-3rd-edition/group-by-murach',
  ],
  'having-clause': [
    'dbms-ramakrishnan-3rd-edition/having',
    'murachs-mysql-3rd-edition/having-murach',
  ],

  // ── Functions ─────────────────────────────────────────────────────────────
  'string-functions': [
    'murachs-mysql-3rd-edition/string-functions',
    'murachs-mysql-3rd-edition/mysql-functions',
  ],
  'date-functions': [
    'murachs-mysql-3rd-edition/date-functions',
    'murachs-mysql-3rd-edition/mysql-functions',
  ],
  'window-functions': [
    // Window functions are part of advanced MySQL function coverage
    // Using mysql-functions as the primary source
    'murachs-mysql-3rd-edition/mysql-functions',
  ],
  'case-expression': [
    // CASE expressions are part of the SELECT clause coverage
    'dbms-ramakrishnan-3rd-edition/select-basic',
    'murachs-mysql-3rd-edition/select-statement-murach',
  ],

  // ── Sorting & Pagination ──────────────────────────────────────────────────
  'order-by': [
    // Only Murach has a dedicated ORDER BY concept in this corpus
    'murachs-mysql-3rd-edition/order-by-murach',
    'dbms-ramakrishnan-3rd-edition/select-basic',
  ],
  'limit-offset': [
    // LIMIT/OFFSET typically follows ORDER BY; Murach ORDER BY covers pagination
    'murachs-mysql-3rd-edition/order-by-murach',
  ],

  // ── Advanced ──────────────────────────────────────────────────────────────
  'subqueries': [
    'dbms-ramakrishnan-3rd-edition/subqueries',
    'murachs-mysql-3rd-edition/subqueries-murach',
  ],
  'exist-clause': [
    // EXISTS is a subquery predicate; correlated subquery covers EXISTS patterns
    'dbms-ramakrishnan-3rd-edition/subqueries',
    'dbms-ramakrishnan-3rd-edition/correlated-subquery',
  ],
  'union': [
    'dbms-ramakrishnan-3rd-edition/set-operations',
    'murachs-mysql-3rd-edition/unions',
  ],
  'cte': [
    // CTEs are a named subquery variant
    'dbms-ramakrishnan-3rd-edition/subqueries',
    'murachs-mysql-3rd-edition/subqueries-murach',
  ],
  'window-functions': [
    // Window functions are part of advanced MySQL function coverage
    // Using mysql-functions as the primary source since functions-murach doesn't exist
    'murachs-mysql-3rd-edition/mysql-functions',
  ],
  'exist-clause': [
    // EXISTS is a subquery predicate; mapped to subqueries concept
    'dbms-ramakrishnan-3rd-edition/subqueries',
    'dbms-ramakrishnan-3rd-edition/correlated-subquery',
    'murachs-mysql-3rd-edition/subqueries-murach',
  ],
  'cte': [
    // Common Table Expressions - mapped to subqueries as closest equivalent
    'dbms-ramakrishnan-3rd-edition/subqueries',
    'murachs-mysql-3rd-edition/subqueries-murach',
  ],
  'limit-offset': [
    // LIMIT/OFFSET - mapped to ORDER BY which typically includes pagination
    'murachs-mysql-3rd-edition/order-by-murach',
    'dbms-ramakrishnan-3rd-edition/select-basic',
  ],

  // ── Errors ────────────────────────────────────────────────────────────────
  'syntax-error': [
    // General SQL syntax is introduced in sql-intro
    'dbms-ramakrishnan-3rd-edition/sql-intro',
    'murachs-mysql-3rd-edition/mysql-intro',
  ],
  'missing-from': [
    // FROM clause is part of the SELECT statement structure
    'dbms-ramakrishnan-3rd-edition/select-basic',
    'dbms-ramakrishnan-3rd-edition/sql-intro',
  ],
};

/**
 * Returns all available corpus IDs for an internal adaptive concept ID,
 * filtered to only those that actually exist in the loaded corpus.
 *
 * Useful for showing per-textbook alternatives in the UI.
 */
export function getCompatibleCorpusIds(
  internalId: string,
  availableConcepts: Record<string, unknown>
): string[] {
  const candidates = CONCEPT_COMPATIBILITY_MAP[internalId] ?? [];
  return candidates.filter(id => id in availableConcepts);
}
