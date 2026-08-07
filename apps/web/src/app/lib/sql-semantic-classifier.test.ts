/**
 * sql-semantic-classifier.test.ts
 *
 * Reachability contract for SQL error classification.
 *
 * Hints are selected by error subtype, so a subtype no classifier path can emit
 * is content the learner can never be shown. Twelve of the 23 canonical
 * SQL-Engage subtypes were in that state: `normalizeSqlErrorSubtype` is called
 * only from the `catch` block in `sql-executor.ts`, so it sees engine throws and
 * nothing else, while those twelve describe queries SQLite runs happily.
 *
 * Every case below is executed through sql.js. The engine cases assert an error
 * is raised; the semantic cases assert one is *not*, which is what proves they
 * were unreachable before. The final test fails if any canonical subtype is
 * neither produced by a real execution nor listed as a documented exclusion.
 */
import { describe, it, expect } from 'vitest';
import { SQLExecutor } from './sql-executor';
import { classifySemanticSqlIssue, SEMANTIC_SUBTYPE_EXCLUSIONS } from './sql-semantic-classifier';
import {
  canonicalizeSqlEngageSubtype,
  getKnownSqlEngageSubtypes,
  normalizeSqlErrorSubtype
} from '../data/sql-engage';

const SCHEMA = `CREATE TABLE users (
  id INTEGER PRIMARY KEY,
  name TEXT,
  email TEXT,
  age INTEGER,
  city TEXT
);
INSERT INTO users VALUES (1, 'Alice', 'alice@email.com', 25, 'Seattle');
INSERT INTO users VALUES (2, 'Bob', 'bob@email.com', 30, 'Seattle');
INSERT INTO users VALUES (3, 'Charlie', 'charlie@email.com', 22, 'Boston');
CREATE TABLE orders (
  order_id INTEGER PRIMARY KEY,
  user_id INTEGER,
  product TEXT,
  amount REAL
);
INSERT INTO orders VALUES (101, 1, 'Laptop', 999.99);
INSERT INTO orders VALUES (102, 2, 'Mouse', 25.5);`;

/** Queries SQLite rejects. [label, query, expected subtype] */
const ENGINE_CASES: [string, string, string][] = [
  ['misspelled SELECT keyword', 'SELCT * FROM users;', 'misspelling'],
  ['misspelled FROM keyword', 'SELECT * FORM users;', 'misspelling'],
  ['unknown table', 'SELECT * FROM userz;', 'undefined table'],
  ['unknown column', 'SELECT nmae FROM users;', 'undefined column'],
  ['truncated after FROM', 'SELECT * FROM', 'incomplete query'],
  ['unknown function', 'SELECT NOSUCHFN(name) FROM users;', 'undefined function'],
  ['unmatched parenthesis', 'SELECT COUNT( FROM users;', 'unmatched brackets'],
  ['clause out of order', 'FROM users SELECT name;', 'wrong positioning'],
  ['missing commas in select list', 'SELECT name age city FROM users;', 'missing commas'],
  [
    'unique constraint violation',
    "INSERT INTO users VALUES (1, 'Dup', 'd@e.com', 1, 'X');",
    'data type mismatch'
  ],
  // Newly classified: all three previously fell through to the fallback.
  ['unquoted string literal', 'SELECT * FROM users WHERE name = Alice;', 'missing quotes'],
  ['HAVING without GROUP BY', 'SELECT city FROM users HAVING COUNT(*) > 1;', 'incorrect having clause'],
  ['aggregate used as a row filter', 'SELECT city FROM users WHERE COUNT(*) > 1;', 'incorrect having clause'],
  ['aggregate nested in an aggregate', 'SELECT COUNT(COUNT(*)) FROM users;', 'aggregation misuse'],
  [
    'ambiguous column across two aliases of one table',
    'SELECT id FROM users a JOIN users b ON a.id = b.id;',
    'ambiguous reference'
  ],
  [
    'malformed LIKE ... ESCAPE',
    "SELECT * FROM users WHERE name LIKE 'a' ESCAPE 'ab';",
    'operator misuse'
  ]
];

/** Queries SQLite accepts but which answer wrongly. [label, query, expectedQuery, subtype] */
const SEMANTIC_CASES: [string, string, string, string][] = [
  [
    'comma join with no predicate produces a cartesian product',
    'SELECT users.name, orders.product FROM users, orders;',
    'SELECT users.name, orders.product FROM users JOIN orders ON users.id = orders.user_id;',
    'incorrect join usage'
  ],
  [
    'aggregate beside a bare column with no GROUP BY',
    'SELECT city, COUNT(*) FROM users;',
    'SELECT city, COUNT(*) FROM users GROUP BY city;',
    'incorrect group by usage'
  ],
  [
    'row-level query where an aggregate was required',
    'SELECT age FROM users;',
    'SELECT COUNT(*) FROM users;',
    'aggregation misuse'
  ],
  [
    'SELECT * where specific columns were required',
    'SELECT * FROM users;',
    'SELECT name, email FROM users;',
    'incorrect wildcard usage'
  ],
  [
    'LIKE pattern with no wildcard behaves as equality',
    "SELECT name FROM users WHERE city LIKE 'Seat';",
    "SELECT name FROM users WHERE city LIKE 'Seat%';",
    'incorrect wildcard usage'
  ],
  [
    'wrong column set',
    'SELECT name, age FROM users;',
    'SELECT name, email FROM users;',
    'incorrect select usage'
  ],
  [
    'DISTINCT omitted so duplicates are returned',
    'SELECT city FROM users;',
    'SELECT DISTINCT city FROM users;',
    'incorrect distinct usage'
  ],
  [
    'ORDER BY omitted',
    'SELECT name FROM users;',
    'SELECT name FROM users ORDER BY age DESC;',
    'incorrect order by usage'
  ]
];

async function withExecutor<T>(run: (executor: SQLExecutor) => Promise<T>): Promise<T> {
  const executor = new SQLExecutor();
  await executor.initialize(SCHEMA);
  try {
    return await run(executor);
  } finally {
    executor.close();
  }
}

describe('engine-error classification', () => {
  it('classifies real sql.js errors into the intended subtypes', async () => {
    const mismatches = await withExecutor(async (executor) => {
      const found: string[] = [];
      for (const [label, query, expected] of ENGINE_CASES) {
        const result = await executor.executeQuery(query);
        if (!result.error) {
          found.push(`${label}: expected an error, query succeeded`);
          continue;
        }
        const actual = normalizeSqlErrorSubtype(result.error, query);
        if (actual !== expected) {
          found.push(`${label}: expected "${expected}", got "${actual}" (error: ${result.error})`);
        }
      }
      return found;
    });

    expect(mismatches, `\n${mismatches.join('\n')}\n`).toEqual([]);
  });
});

describe('semantic classification (queries that run but answer wrongly)', () => {
  it('classifies wrong-but-runnable queries into the intended subtypes', async () => {
    const mismatches = await withExecutor(async (executor) => {
      const found: string[] = [];
      for (const [label, query, expectedQuery, expected] of SEMANTIC_CASES) {
        const result = await executor.executeQuery(query);

        // The premise of this module: the engine does not complain, so the
        // error-message classifier is never reached for these attempts.
        if (result.error) {
          found.push(`${label}: expected the engine to accept the query, got "${result.error}"`);
          continue;
        }

        const actual = classifySemanticSqlIssue({ query, expectedQuery });
        if (actual !== expected) {
          found.push(`${label}: expected "${expected}", got "${actual}"`);
        }
      }
      return found;
    });

    expect(mismatches, `\n${mismatches.join('\n')}\n`).toEqual([]);
  });

  it('only ever returns subtypes the SQL-Engage dataset can serve', () => {
    for (const [label, query, expectedQuery] of SEMANTIC_CASES) {
      const subtype = classifySemanticSqlIssue({ query, expectedQuery });
      expect(subtype, `${label} returned nothing`).not.toBeNull();
      // A label absent from the dataset is silently rewritten to the fallback,
      // which mislabels the error instead of failing loudly.
      expect(
        canonicalizeSqlEngageSubtype(subtype as string),
        `${label} produced a non-canonical subtype`
      ).toBe(subtype);
    }
  });

  it('returns null rather than inventing a subtype for a correct query', () => {
    expect(
      classifySemanticSqlIssue({
        query: 'SELECT name, email FROM users;',
        expectedQuery: 'SELECT name, email FROM users;'
      })
    ).toBeNull();
  });

  it('does not treat a missing trailing semicolon as a wrong answer', () => {
    // Verified by execution: SQLite accepts the query without the semicolon and
    // returns identical rows, so it can never be the cause of a wrong answer.
    // Firing a subtype here would repeat the over-broad-branch mistake that made
    // every syntax error look like a comma error.
    expect(
      classifySemanticSqlIssue({
        query: 'SELECT name, email FROM users',
        expectedQuery: 'SELECT name, email FROM users;'
      })
    ).toBeNull();
  });
});

describe('subtype reachability', () => {
  it('leaves every canonical subtype either reachable or explicitly excluded', async () => {
    const emitted = await withExecutor(async (executor) => {
      const seen = new Set<string>();
      for (const [, query] of ENGINE_CASES) {
        const result = await executor.executeQuery(query);
        if (result.error) seen.add(normalizeSqlErrorSubtype(result.error, query));
      }
      for (const [, query, expectedQuery] of SEMANTIC_CASES) {
        const subtype = classifySemanticSqlIssue({ query, expectedQuery });
        if (subtype) seen.add(subtype);
      }
      return seen;
    });

    const unreachable = getKnownSqlEngageSubtypes().filter(
      (subtype) => !emitted.has(subtype) && !(subtype in SEMANTIC_SUBTYPE_EXCLUSIONS)
    );

    expect(
      unreachable,
      `These canonical subtypes can never be emitted and are not documented as excluded:\n${unreachable.join(
        '\n'
      )}`
    ).toEqual([]);
  });

  it('documents an exclusion reason for every deliberately unreachable subtype', () => {
    const canonical = getKnownSqlEngageSubtypes();
    for (const [subtype, reason] of Object.entries(SEMANTIC_SUBTYPE_EXCLUSIONS)) {
      expect(canonical, `${subtype} is not a canonical subtype`).toContain(subtype);
      expect(reason.length, `${subtype} has no exclusion reason`).toBeGreaterThan(20);
    }
  });

  it('still classifies a genuine undefined column as one', async () => {
    // Guards the narrowness of the missing-quotes rule: the token there appears
    // only on the right of a comparison, this one is in the select list.
    const subtype = await withExecutor(async (executor) => {
      const query = 'SELECT nmae FROM users;';
      const result = await executor.executeQuery(query);
      return normalizeSqlErrorSubtype(result.error as string, query);
    });
    expect(subtype).toBe('undefined column');
  });
});
