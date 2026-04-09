/**
 * Unit tests for SQL Executor grading logic
 * 
 * These tests verify:
 * - Float comparison with epsilon tolerance
 * - Row order independence
 * - Duplicate row handling
 * - Column order independence
 * - Null/undefined equivalence
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SQLExecutor } from './sql-executor';

describe('SQLExecutor Grading Logic', () => {
  let executor: SQLExecutor;

  beforeEach(() => {
    executor = new SQLExecutor();
  });

  afterEach(() => {
    executor.close();
  });

  describe('Float Comparison with Epsilon', () => {
    it('should match floats within epsilon (0.01)', async () => {
      await executor.initialize('CREATE TABLE t (val REAL); INSERT INTO t VALUES (3.14159);');
      
      const result = await executor.executeQuery('SELECT val FROM t');
      const actualResults = executor.formatResults(result);
      
      // Within epsilon: difference of 0.00001 < 0.01
      const expectedResults = [{ val: 3.14158 }];
      const comparison = executor.compareResults(actualResults, expectedResults);
      
      expect(comparison.match).toBe(true);
      expect(comparison.differences).toHaveLength(0);
    });

    it('should not match floats outside epsilon', async () => {
      await executor.initialize('CREATE TABLE t (val REAL); INSERT INTO t VALUES (3.14159);');
      
      const result = await executor.executeQuery('SELECT val FROM t');
      const actualResults = executor.formatResults(result);
      
      // Outside epsilon: difference of ~0.00159 > 0.01 would be false,
      // but 3.14 vs 3.14159 = 0.00159 < 0.01, so this would match
      // Let's use a bigger difference
      const expectedResults = [{ val: 3.12 }];
      const comparison = executor.compareResults(actualResults, expectedResults);
      
      expect(comparison.match).toBe(false);
    });

    it('should handle typical AVG() floating point results', async () => {
      await executor.initialize(`
        CREATE TABLE sales (amount REAL);
        INSERT INTO sales VALUES (10.1);
        INSERT INTO sales VALUES (20.2);
        INSERT INTO sales VALUES (30.3);
      `);
      
      const result = await executor.executeQuery('SELECT AVG(amount) as avg_amount FROM sales');
      const actualResults = executor.formatResults(result);
      
      // The actual average is 20.2, but floating point might give 20.199999999999996
      const expectedResults = [{ avg_amount: 20.2 }];
      const comparison = executor.compareResults(actualResults, expectedResults);
      
      expect(comparison.match).toBe(true);
    });

    it('should use exact comparison for integers', async () => {
      await executor.initialize('CREATE TABLE t (val INTEGER); INSERT INTO t VALUES (42);');
      
      const result = await executor.executeQuery('SELECT val FROM t');
      const actualResults = executor.formatResults(result);
      
      // Exact match for integers
      const expectedResults = [{ val: 42 }];
      const comparison = executor.compareResults(actualResults, expectedResults);
      
      expect(comparison.match).toBe(true);
      
      // Wrong integer should not match
      const wrongExpected = [{ val: 43 }];
      const wrongComparison = executor.compareResults(actualResults, wrongExpected);
      
      expect(wrongComparison.match).toBe(false);
    });
  });

  describe('Row Order Independence', () => {
    it('should ignore row order', async () => {
      await executor.initialize(`
        CREATE TABLE t (id INTEGER, name TEXT);
        INSERT INTO t VALUES (1, 'Alice');
        INSERT INTO t VALUES (2, 'Bob');
        INSERT INTO t VALUES (3, 'Charlie');
      `);
      
      const expectedResults = [
        { id: 1, name: 'Alice' },
        { id: 2, name: 'Bob' },
        { id: 3, name: 'Charlie' }
      ];
      
      // Results in different order
      const actualResults = [
        { id: 3, name: 'Charlie' },
        { id: 1, name: 'Alice' },
        { id: 2, name: 'Bob' }
      ];
      
      const comparison = executor.compareResults(actualResults, expectedResults);
      
      expect(comparison.match).toBe(true);
    });
  });

  describe('Duplicate Row Handling', () => {
    it('should correctly count duplicate rows', async () => {
      await executor.initialize('CREATE TABLE t (val INTEGER);');
      
      const expectedResults = [{ val: 1 }, { val: 1 }];
      
      // Only one row - should NOT match
      const actualResultsOne = [{ val: 1 }];
      const comparison1 = executor.compareResults(actualResultsOne, expectedResults);
      expect(comparison1.match).toBe(false);
      
      // Two rows - should match
      const actualResultsTwo = [{ val: 1 }, { val: 1 }];
      const comparison2 = executor.compareResults(actualResultsTwo, expectedResults);
      expect(comparison2.match).toBe(true);
      
      // Three rows - should NOT match
      const actualResultsThree = [{ val: 1 }, { val: 1 }, { val: 1 }];
      const comparison3 = executor.compareResults(actualResultsThree, expectedResults);
      expect(comparison3.match).toBe(false);
    });
  });

  describe('Column Order Independence', () => {
    it('should ignore column order', async () => {
      await executor.initialize(`
        CREATE TABLE t (a INTEGER, b TEXT);
        INSERT INTO t VALUES (1, 'x');
      `);
      
      const expectedResults = [{ a: 1, b: 'x' }];
      const actualResults = [{ b: 'x', a: 1 }];
      
      const comparison = executor.compareResults(actualResults, expectedResults);
      
      expect(comparison.match).toBe(true);
    });
  });

  describe('Null Handling', () => {
    it('should treat null values as matching', async () => {
      await executor.initialize(`
        CREATE TABLE t (val INTEGER);
        INSERT INTO t VALUES (NULL);
      `);
      
      const result = await executor.executeQuery('SELECT val FROM t');
      const actualResults = executor.formatResults(result);
      
      const expectedResults = [{ val: null }];
      const comparison = executor.compareResults(actualResults, expectedResults);
      
      expect(comparison.match).toBe(true);
    });
  });

  describe('Row Count Mismatch', () => {
    it('should report row count mismatch', async () => {
      await executor.initialize(`
        CREATE TABLE t (id INTEGER);
        INSERT INTO t VALUES (1);
        INSERT INTO t VALUES (2);
      `);
      
      const expectedResults = [{ id: 1 }, { id: 2 }, { id: 3 }];
      
      const result = await executor.executeQuery('SELECT id FROM t');
      const actualResults = executor.formatResults(result);
      
      const comparison = executor.compareResults(actualResults, expectedResults);
      
      expect(comparison.match).toBe(false);
      expect(comparison.differences[0]).toContain('Row count mismatch');
    });
  });

  describe('Problem 13 Specific', () => {
    it('should correctly grade problem-13', async () => {
      const schema = `CREATE TABLE products (
  id INTEGER PRIMARY KEY,
  name TEXT,
  category TEXT,
  price REAL
);

INSERT INTO products VALUES (1, 'Laptop', 'Electronics', 999.99);
INSERT INTO products VALUES (2, 'Mouse', 'Electronics', 29.99);
INSERT INTO products VALUES (3, 'Keyboard', 'Electronics', 79.99);
INSERT INTO products VALUES (4, 'Desk', 'Furniture', 299.99);
INSERT INTO products VALUES (5, 'Chair', 'Furniture', 199.99);
INSERT INTO products VALUES (6, 'Lamp', 'Home', 49.99);`;

      const expectedQuery = 'SELECT category, AVG(price) AS avg_price FROM products GROUP BY category HAVING AVG(price) > 200;';
      const expectedResult = [
        { category: 'Electronics', avg_price: 369.99 },
        { category: 'Furniture', avg_price: 249.99 }
      ];

      await executor.initialize(schema);
      
      const result = await executor.executeQuery(expectedQuery);
      expect(result.success).toBe(true);
      
      const actualResults = executor.formatResults(result);
      const comparison = executor.compareResults(actualResults, expectedResult);
      
      expect(comparison.match).toBe(true);
      expect(comparison.differences).toHaveLength(0);
    });
  });
});
