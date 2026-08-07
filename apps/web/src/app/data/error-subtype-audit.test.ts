/**
 * error-subtype-audit.test.ts
 *
 * Contract gate for SQL error classification.
 *
 * Hints are selected by error subtype, so a misclassification sends the learner
 * targeted advice about the wrong problem. These cases execute real SQL through
 * sql.js and assert the subtype derived from the genuine engine error, rather
 * than from hand-written error strings that may not match what SQLite emits.
 *
 * Every expected value must be a subtype that exists in the SQL-Engage dataset;
 * `canonicalizeSqlEngageSubtype` silently rewrites unknown labels to the
 * fallback, which is how constraint errors were previously reported as
 * 'incomplete query'.
 */
import { describe, it, expect } from 'vitest';
import { SQLExecutor } from '../lib/sql-executor';
import { normalizeSqlErrorSubtype, canonicalizeSqlEngageSubtype } from './sql-engage';

const SCHEMA = `CREATE TABLE users (
  id INTEGER PRIMARY KEY,
  name TEXT,
  email TEXT,
  age INTEGER,
  city TEXT
);
INSERT INTO users VALUES (1, 'Alice', 'alice@email.com', 25, 'Seattle');
CREATE TABLE orders (
  order_id INTEGER PRIMARY KEY,
  user_id INTEGER,
  product TEXT,
  amount REAL
);
INSERT INTO orders VALUES (101, 1, 'Laptop', 999.99);`;

/** [label, query, expected subtype] */
const CASES: [string, string, string][] = [
  ['misspelled SELECT keyword', 'SELCT * FROM users;', 'misspelling'],
  ['misspelled FROM keyword', 'SELECT * FORM users;', 'misspelling'],
  ['unknown table', 'SELECT * FROM userz;', 'undefined table'],
  ['unknown column', 'SELECT nmae FROM users;', 'undefined column'],
  ['truncated after FROM', 'SELECT * FROM', 'incomplete query'],
  ['truncated after WHERE', 'SELECT * FROM users WHERE', 'incomplete query'],
  ['unknown function', 'SELECT NOSUCHFN(name) FROM users;', 'undefined function'],
  ['unmatched parenthesis', 'SELECT COUNT( FROM users;', 'unmatched brackets'],
  ['clause out of order', 'FROM users SELECT name;', 'wrong positioning'],
  ['missing commas in select list', 'SELECT name age city FROM users;', 'missing commas'],
  ['unique constraint violation', "INSERT INTO users VALUES (1, 'Dup', 'd@e.com', 1, 'X');", 'data type mismatch'],
];

describe('SQL error subtype classification', () => {
  it('classifies real sql.js errors into the intended subtypes', async () => {
    const executor = new SQLExecutor();
    await executor.initialize(SCHEMA);

    const mismatches: string[] = [];
    for (const [label, query, expected] of CASES) {
      const result = await executor.executeQuery(query);
      if (!result.error) {
        mismatches.push(`${label}: expected an error, query succeeded`);
        continue;
      }
      const actual = normalizeSqlErrorSubtype(result.error, query);
      if (actual !== expected) {
        mismatches.push(`${label}: expected "${expected}", got "${actual}" (error: ${result.error})`);
      }
    }
    executor.close();

    expect(mismatches, `\n${mismatches.join('\n')}\n`).toEqual([]);
  });

  it('only ever returns subtypes the SQL-Engage dataset can serve', async () => {
    const executor = new SQLExecutor();
    await executor.initialize(SCHEMA);

    for (const [label, query] of CASES) {
      const result = await executor.executeQuery(query);
      if (!result.error) continue;
      const subtype = normalizeSqlErrorSubtype(result.error, query);
      // A label absent from the dataset is rewritten to the fallback, which
      // silently mislabels the error instead of failing loudly.
      expect(canonicalizeSqlEngageSubtype(subtype), `${label} produced a non-canonical subtype`).toBe(subtype);
    }
    executor.close();
  });
});
