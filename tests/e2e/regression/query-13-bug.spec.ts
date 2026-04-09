/**
 * Regression test for Query 13 grading bug
 * 
 * Bug: problem-13 expectedResult had incorrect average for Electronics
 * - Expected in data: 369.66 (WRONG)
 * - Correct value: 369.99 (999.99 + 29.99 + 79.99) / 3
 * 
 * This test verifies:
 * 1. The correct answer (369.99) is accepted
 * 2. Float comparison uses epsilon tolerance
 * 3. Row order independence is preserved
 * 4. Duplicate row handling works correctly
 */

import { test, expect } from '@playwright/test';
import { SQLExecutor } from '../../../apps/web/src/app/lib/sql-executor';

test.describe('@regression Query 13 Grading Bug Fix', () => {
  let executor: SQLExecutor;

  test.beforeEach(async () => {
    executor = new SQLExecutor();
    await executor.initialize();
    
    // Set up the products schema used by problem-13
    await executor.execute(`
      CREATE TABLE products (
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
      INSERT INTO products VALUES (6, 'Lamp', 'Home', 49.99);
    `);
  });

  test.afterEach(() => {
    executor.close();
  });

  test('Query 13 accepts correct Electronics average of 369.99', async () => {
    const query = `
      SELECT category, AVG(price) AS avg_price 
      FROM products 
      GROUP BY category 
      HAVING AVG(price) > 200;
    `;
    
    const { results } = await executor.execute(query);
    
    // The correct expected result
    const expectedResult = [
      { category: 'Electronics', avg_price: 369.99 },
      { category: 'Furniture', avg_price: 249.99 }
    ];
    
    const comparison = executor.compareResults(results, expectedResult);
    
    expect(comparison.match).toBe(true);
    expect(comparison.differences).toHaveLength(0);
  });

  test('Query 13 accepts values within epsilon tolerance (0.01)', async () => {
    // Simulate a result that's slightly off due to float precision
    const actualResult = [
      { category: 'Electronics', avg_price: 369.99000000000007 }, // Tiny float noise
      { category: 'Furniture', avg_price: 249.99 }
    ];
    
    const expectedResult = [
      { category: 'Electronics', avg_price: 369.99 },
      { category: 'Furniture', avg_price: 249.99 }
    ];
    
    const comparison = executor.compareResults(actualResult, expectedResult);
    
    expect(comparison.match).toBe(true);
    expect(comparison.differences).toHaveLength(0);
  });

  test('Query 13 rejects materially wrong answers', async () => {
    // The old buggy expected value
    const wrongResult = [
      { category: 'Electronics', avg_price: 369.66 }, // WRONG - should be 369.99
      { category: 'Furniture', avg_price: 249.99 }
    ];
    
    const correctResult = [
      { category: 'Electronics', avg_price: 369.99 },
      { category: 'Furniture', avg_price: 249.99 }
    ];
    
    const comparison = executor.compareResults(wrongResult, correctResult);
    
    // 369.66 vs 369.99 = difference of 0.33, which is > epsilon (0.01)
    expect(comparison.match).toBe(false);
    expect(comparison.differences.length).toBeGreaterThan(0);
  });

  test('Row order does not affect comparison', async () => {
    const resultOrder1 = [
      { category: 'Electronics', avg_price: 369.99 },
      { category: 'Furniture', avg_price: 249.99 }
    ];
    
    const resultOrder2 = [
      { category: 'Furniture', avg_price: 249.99 },
      { category: 'Electronics', avg_price: 369.99 }
    ];
    
    const comparison = executor.compareResults(resultOrder1, resultOrder2);
    
    expect(comparison.match).toBe(true);
    expect(comparison.differences).toHaveLength(0);
  });

  test('Duplicate rows are handled correctly', async () => {
    // If the query returns duplicates, they should be counted separately
    const actualWithDuplicate = [
      { category: 'Electronics', avg_price: 369.99 },
      { category: 'Electronics', avg_price: 369.99 }, // Duplicate
      { category: 'Furniture', avg_price: 249.99 }
    ];
    
    const expectedNoDuplicate = [
      { category: 'Electronics', avg_price: 369.99 },
      { category: 'Furniture', avg_price: 249.99 }
    ];
    
    const comparison = executor.compareResults(actualWithDuplicate, expectedNoDuplicate);
    
    // Should fail because actual has an extra duplicate row
    expect(comparison.match).toBe(false);
    expect(comparison.differences.some(d => d.includes('Unexpected row'))).toBe(true);
  });

  test('Integer comparison is exact (no epsilon)', async () => {
    const actual = [
      { id: 1, count: 42 },
      { id: 2, count: 100 }
    ];
    
    const expected = [
      { id: 1, count: 42 },
      { id: 2, count: 100 }
    ];
    
    const comparison = executor.compareResults(actual, expected);
    
    expect(comparison.match).toBe(true);
  });

  test('Integer mismatch is detected even within epsilon range', async () => {
    // Integers should match exactly, even if difference is small
    const actual = [
      { id: 1, count: 100 }
    ];
    
    const expected = [
      { id: 1, count: 101 } // Diff = 1, which is > 0 but integers should match exactly
    ];
    
    const comparison = executor.compareResults(actual, expected);
    
    // 100 !== 101, so this should fail
    expect(comparison.match).toBe(false);
  });

  test('Null values are treated as equivalent', async () => {
    const actual = [
      { id: 1, value: null },
      { id: 2, value: 'test' }
    ];
    
    const expected = [
      { id: 1, value: null },
      { id: 2, value: 'test' }
    ];
    
    const comparison = executor.compareResults(actual, expected);
    
    expect(comparison.match).toBe(true);
  });

  test('String values are trimmed during comparison', async () => {
    const actual = [
      { name: '  Alice  ' },
      { name: 'Bob' }
    ];
    
    const expected = [
      { name: 'Alice' },
      { name: 'Bob' }
    ];
    
    const comparison = executor.compareResults(actual, expected);
    
    expect(comparison.match).toBe(true);
  });
});

test.describe('@regression Float Comparison Edge Cases', () => {
  let executor: SQLExecutor;

  test.beforeEach(async () => {
    executor = new SQLExecutor();
    await executor.initialize();
  });

  test.afterEach(() => {
    executor.close();
  });

  test('Floats within 0.01 epsilon match', async () => {
    const actual = [{ value: 3.14159 }];
    const expected = [{ value: 3.14158 }]; // Diff = 0.00001 < 0.01
    
    const comparison = executor.compareResults(actual, expected);
    expect(comparison.match).toBe(true);
  });

  test('Floats outside 0.01 epsilon do not match', async () => {
    const actual = [{ value: 3.14 }];
    const expected = [{ value: 3.15 }]; // Diff = 0.01 = epsilon (strict <)
    
    const comparison = executor.compareResults(actual, expected);
    // With < (not <=), 0.01 diff should fail
    expect(comparison.match).toBe(false);
  });

  test('Mixed integer and float columns', async () => {
    const actual = [
      { id: 1, price: 99.99, count: 5 },
      { id: 2, price: 49.99, count: 10 }
    ];
    
    const expected = [
      { id: 1, price: 99.9900001, count: 5 }, // Float with noise
      { id: 2, price: 49.99, count: 10 }
    ];
    
    const comparison = executor.compareResults(actual, expected);
    expect(comparison.match).toBe(true);
  });
});
