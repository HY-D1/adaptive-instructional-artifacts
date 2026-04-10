/**
 * Comprehensive edge case tests for SQL Executor Comparator
 * 
 * These tests rigorously validate:
 * - Integer vs float equivalence (5 vs 5.0 vs 5.00)
 * - Float epsilon boundaries (0.01 threshold)
 * - Duplicate row sensitivity (multiset comparison)
 * - NULL/undefined/string 'NULL' handling
 * - String trimming behavior
 * - Boolean normalization
 * - Column order independence
 * - Row order independence
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SQLExecutor } from './sql-executor';

describe('SQLExecutor Comparator - Edge Cases', () => {
  let executor: SQLExecutor;

  beforeEach(() => {
    executor = new SQLExecutor();
  });

  afterEach(() => {
    executor.close();
  });

  // ============================================================================
  // INTEGER vs FLOAT EQUIVALENCE
  // ============================================================================
  describe('Integer vs Float Equivalence', () => {
    it('should treat 5 and 5.0 as equivalent (numeric comparison)', () => {
      const actual = [{ val: 5 }];
      const expected = [{ val: 5.0 }];
      const comparison = executor.compareResults(actual, expected);
      expect(comparison.match).toBe(true);
    });

    it('should treat 5 and 5.00 as equivalent', () => {
      const actual = [{ val: 5 }];
      const expected = [{ val: 5.00 }];
      const comparison = executor.compareResults(actual, expected);
      expect(comparison.match).toBe(true);
    });

    it('should treat integer 42 and float 42.0 as equivalent', () => {
      const actual = [{ val: 42 }];
      const expected = [{ val: 42.0 }];
      const comparison = executor.compareResults(actual, expected);
      expect(comparison.match).toBe(true);
    });

    it('should handle SQL INTEGER vs REAL column types', async () => {
      await executor.initialize(`
        CREATE TABLE t_int (val INTEGER);
        CREATE TABLE t_real (val REAL);
        INSERT INTO t_int VALUES (5);
        INSERT INTO t_real VALUES (5.0);
      `);
      
      const intResult = await executor.executeQuery('SELECT val FROM t_int');
      const realResult = await executor.executeQuery('SELECT val FROM t_real');
      
      const intRows = executor.formatResults(intResult);
      const realRows = executor.formatResults(realResult);
      
      // Cross-comparison should match
      const comparison = executor.compareResults(intRows, realRows);
      expect(comparison.match).toBe(true);
    });
  });

  // ============================================================================
  // FLOAT EPSILON BOUNDARY TESTS (FLOAT_EPSILON = 0.01)
  // ============================================================================
  describe('Float Epsilon Boundary (ε = 0.01)', () => {
    // VALUES THAT SHOULD MATCH (within epsilon)
    describe('values within epsilon should match', () => {
      it('should match 369.99 vs 369.9900001 (diff = 0.0000001 < 0.01)', () => {
        const actual = [{ val: 369.99 }];
        const expected = [{ val: 369.9900001 }];
        const comparison = executor.compareResults(actual, expected);
        expect(comparison.match).toBe(true);
      });

      it('should match 369.99 vs 369.995 (diff = 0.005 < 0.01)', () => {
        const actual = [{ val: 369.99 }];
        const expected = [{ val: 369.995 }];
        const comparison = executor.compareResults(actual, expected);
        expect(comparison.match).toBe(true);
      });

      it('should match 369.99 vs 369.984 (diff = 0.006 < 0.01)', () => {
        const actual = [{ val: 369.99 }];
        const expected = [{ val: 369.984 }];
        const comparison = executor.compareResults(actual, expected);
        expect(comparison.match).toBe(true);
      });

      it('should match at exactly epsilon boundary: 369.99 vs 369.999999 (diff ≈ 0.01)', () => {
        // 369.999999 - 369.99 = 0.009999 < 0.01, should match
        const actual = [{ val: 369.99 }];
        const expected = [{ val: 369.999999 }];
        const comparison = executor.compareResults(actual, expected);
        expect(comparison.match).toBe(true);
      });

      it('should handle typical floating point imprecision (20.2 vs 20.199999999999996)', () => {
        const actual = [{ val: 20.199999999999996 }];
        const expected = [{ val: 20.2 }];
        const comparison = executor.compareResults(actual, expected);
        expect(comparison.match).toBe(true);
      });
    });

    // VALUES THAT SHOULD NOT MATCH (outside epsilon)
    describe('values outside epsilon should NOT match', () => {
      it('should NOT match 369.99 vs 369.66 (diff = 0.33 > 0.01)', () => {
        const actual = [{ val: 369.99 }];
        const expected = [{ val: 369.66 }];
        const comparison = executor.compareResults(actual, expected);
        expect(comparison.match).toBe(false);
      });

      it('documents floating-point behavior: 369.99 vs 370.00 (diff ≈ 0.009999 < epsilon)', () => {
        // IMPORTANT: Due to floating-point representation, 370.0 - 369.99 = 0.0099999...
        // This is slightly LESS than 0.01, so these values DO match with current epsilon
        // This is a documented behavior of the comparator with absolute epsilon
        const actual = [{ val: 369.99 }];
        const expected = [{ val: 370.0 }];
        const comparison = executor.compareResults(actual, expected);
        // These match because floating-point math gives diff ≈ 0.009999 < 0.01
        expect(comparison.match).toBe(true);
      });

      it('should NOT match 369.99 vs 370.01 (diff = 0.02 > 0.01)', () => {
        const actual = [{ val: 369.99 }];
        const expected = [{ val: 370.01 }];
        const comparison = executor.compareResults(actual, expected);
        expect(comparison.match).toBe(false);
      });

      it('should NOT match 100.00 vs 100.02 (diff = 0.02 > 0.01)', () => {
        const actual = [{ val: 100.0 }];
        const expected = [{ val: 100.02 }];
        const comparison = executor.compareResults(actual, expected);
        expect(comparison.match).toBe(false);
      });
    });
  });

  // ============================================================================
  // DUPLICATE ROW SENSITIVITY (Multiset Comparison)
  // ============================================================================
  describe('Duplicate Row Sensitivity (Multiset Comparison)', () => {
    it('[a, a, b] vs [a, b] should NOT match (fewer duplicates in expected)', () => {
      const actual = [{ id: 1 }, { id: 1 }, { id: 2 }];
      const expected = [{ id: 1 }, { id: 2 }];
      const comparison = executor.compareResults(actual, expected);
      expect(comparison.match).toBe(false);
    });

    it('[a, b] vs [a, a, b] should NOT match (fewer duplicates in actual)', () => {
      const actual = [{ id: 1 }, { id: 2 }];
      const expected = [{ id: 1 }, { id: 1 }, { id: 2 }];
      const comparison = executor.compareResults(actual, expected);
      expect(comparison.match).toBe(false);
    });

    it('[a, a, a] vs [a, a] should NOT match', () => {
      const actual = [{ id: 1 }, { id: 1 }, { id: 1 }];
      const expected = [{ id: 1 }, { id: 1 }];
      const comparison = executor.compareResults(actual, expected);
      expect(comparison.match).toBe(false);
    });

    it('[a, a] vs [a, a] should match (same duplicates)', () => {
      const actual = [{ id: 1 }, { id: 1 }];
      const expected = [{ id: 1 }, { id: 1 }];
      const comparison = executor.compareResults(actual, expected);
      expect(comparison.match).toBe(true);
    });

    it('[a, a, b, b] vs [a, a, b, b] should match', () => {
      const actual = [{ id: 1 }, { id: 1 }, { id: 2 }, { id: 2 }];
      const expected = [{ id: 1 }, { id: 1 }, { id: 2 }, { id: 2 }];
      const comparison = executor.compareResults(actual, expected);
      expect(comparison.match).toBe(true);
    });

    it('[a, b, a] vs [a, a, b] should match (row order independent)', () => {
      const actual = [{ id: 1 }, { id: 2 }, { id: 1 }];
      const expected = [{ id: 1 }, { id: 1 }, { id: 2 }];
      const comparison = executor.compareResults(actual, expected);
      expect(comparison.match).toBe(true);
    });

    it('complex multiset: [a,a,b,b,c] vs [a,b,a,b,c] should match', () => {
      const actual = [
        { id: 1 }, { id: 1 },
        { id: 2 }, { id: 2 },
        { id: 3 }
      ];
      const expected = [
        { id: 1 }, { id: 2 },
        { id: 1 }, { id: 2 },
        { id: 3 }
      ];
      const comparison = executor.compareResults(actual, expected);
      expect(comparison.match).toBe(true);
    });
  });

  // ============================================================================
  // ROW ORDER INDEPENDENCE
  // ============================================================================
  describe('Row Order Independence', () => {
    it('completely reversed order should match', () => {
      const actual = [
        { id: 5, name: 'Eve' },
        { id: 4, name: 'Dave' },
        { id: 3, name: 'Carol' },
        { id: 2, name: 'Bob' },
        { id: 1, name: 'Alice' }
      ];
      const expected = [
        { id: 1, name: 'Alice' },
        { id: 2, name: 'Bob' },
        { id: 3, name: 'Carol' },
        { id: 4, name: 'Dave' },
        { id: 5, name: 'Eve' }
      ];
      const comparison = executor.compareResults(actual, expected);
      expect(comparison.match).toBe(true);
    });

    it('shuffled order with multiple columns should match', () => {
      const actual = [
        { a: 1, b: 2, c: 3 },
        { a: 4, b: 5, c: 6 },
        { a: 7, b: 8, c: 9 }
      ];
      const expected = [
        { a: 7, b: 8, c: 9 },
        { a: 1, b: 2, c: 3 },
        { a: 4, b: 5, c: 6 }
      ];
      const comparison = executor.compareResults(actual, expected);
      expect(comparison.match).toBe(true);
    });
  });

  // ============================================================================
  // COLUMN ORDER INDEPENDENCE
  // ============================================================================
  describe('Column Order Independence', () => {
    it('reversed column order should match', () => {
      const actual = [{ b: 2, a: 1 }];
      const expected = [{ a: 1, b: 2 }];
      const comparison = executor.compareResults(actual, expected);
      expect(comparison.match).toBe(true);
    });

    it('shuffled column order with multiple rows should match', () => {
      const actual = [
        { c: 3, a: 1, b: 2 },
        { c: 6, a: 4, b: 5 }
      ];
      const expected = [
        { a: 1, b: 2, c: 3 },
        { a: 4, b: 5, c: 6 }
      ];
      const comparison = executor.compareResults(actual, expected);
      expect(comparison.match).toBe(true);
    });

    it('different column names should NOT match', () => {
      const actual = [{ x: 1, y: 2 }];
      const expected = [{ a: 1, b: 2 }];
      const comparison = executor.compareResults(actual, expected);
      expect(comparison.match).toBe(false);
    });

    it('extra column in actual should NOT match', () => {
      const actual = [{ a: 1, b: 2, c: 3 }];
      const expected = [{ a: 1, b: 2 }];
      const comparison = executor.compareResults(actual, expected);
      expect(comparison.match).toBe(false);
    });

    it('missing column in actual should NOT match', () => {
      const actual = [{ a: 1 }];
      const expected = [{ a: 1, b: 2 }];
      const comparison = executor.compareResults(actual, expected);
      expect(comparison.match).toBe(false);
    });
  });

  // ============================================================================
  // NULL / UNDEFINED / STRING HANDLING
  // ============================================================================
  describe('NULL / Undefined / String NULL Handling', () => {
    it('null vs null should match', () => {
      const actual = [{ val: null }];
      const expected = [{ val: null }];
      const comparison = executor.compareResults(actual, expected);
      expect(comparison.match).toBe(true);
    });

    it('undefined vs undefined should match', () => {
      const actual = [{ val: undefined }];
      const expected = [{ val: undefined }];
      const comparison = executor.compareResults(actual, expected);
      expect(comparison.match).toBe(true);
    });

    it('null vs undefined should match (treated as equivalent)', () => {
      const actual = [{ val: null }];
      const expected = [{ val: undefined }];
      const comparison = executor.compareResults(actual, expected);
      expect(comparison.match).toBe(true);
    });

    it('undefined vs null should match (symmetric)', () => {
      const actual = [{ val: undefined }];
      const expected = [{ val: null }];
      const comparison = executor.compareResults(actual, expected);
      expect(comparison.match).toBe(true);
    });

    it('string "NULL" vs SQL null should NOT match', () => {
      // This is a critical test: SQL NULL is different from the string 'NULL'
      const actual = [{ val: 'NULL' }];
      const expected = [{ val: null }];
      const comparison = executor.compareResults(actual, expected);
      expect(comparison.match).toBe(false);
    });

    it('string "null" vs SQL null should NOT match', () => {
      const actual = [{ val: 'null' }];
      const expected = [{ val: null }];
      const comparison = executor.compareResults(actual, expected);
      expect(comparison.match).toBe(false);
    });

    it('empty string vs null should NOT match', () => {
      const actual = [{ val: '' }];
      const expected = [{ val: null }];
      const comparison = executor.compareResults(actual, expected);
      expect(comparison.match).toBe(false);
    });

    it('whitespace string vs null should NOT match', () => {
      const actual = [{ val: '   ' }];
      const expected = [{ val: null }];
      const comparison = executor.compareResults(actual, expected);
      expect(comparison.match).toBe(false);
    });

    it('mixed nulls in multi-row results', () => {
      const actual = [
        { id: 1, val: null },
        { id: 2, val: 'hello' },
        { id: 3, val: null }
      ];
      const expected = [
        { id: 1, val: null },
        { id: 2, val: 'hello' },
        { id: 3, val: null }
      ];
      const comparison = executor.compareResults(actual, expected);
      expect(comparison.match).toBe(true);
    });
  });

  // ============================================================================
  // STRING TRIMMING BEHAVIOR
  // ============================================================================
  describe('String Trimming Behavior', () => {
    it('leading/trailing whitespace should be ignored', () => {
      const actual = [{ name: '  Alice  ' }];
      const expected = [{ name: 'Alice' }];
      const comparison = executor.compareResults(actual, expected);
      expect(comparison.match).toBe(true);
    });

    it('internal whitespace should be preserved', () => {
      const actual = [{ name: 'Alice  Smith' }];
      const expected = [{ name: 'Alice Smith' }];
      const comparison = executor.compareResults(actual, expected);
      expect(comparison.match).toBe(false);
    });

    it('tab characters should be trimmed', () => {
      const actual = [{ name: '\tAlice\t' }];
      const expected = [{ name: 'Alice' }];
      const comparison = executor.compareResults(actual, expected);
      expect(comparison.match).toBe(true);
    });

    it('newline characters should be trimmed', () => {
      const actual = [{ name: '\nAlice\n' }];
      const expected = [{ name: 'Alice' }];
      const comparison = executor.compareResults(actual, expected);
      expect(comparison.match).toBe(true);
    });

    it('empty string vs whitespace-only should match (both become empty after trim)', () => {
      const actual = [{ name: '' }];
      const expected = [{ name: '   ' }];
      const comparison = executor.compareResults(actual, expected);
      expect(comparison.match).toBe(true);
    });
  });

  // ============================================================================
  // BOOLEAN NORMALIZATION
  // ============================================================================
  describe('Boolean Normalization', () => {
    it('true should normalize to "1"', () => {
      const actual = [{ val: true }];
      const expected = [{ val: '1' }];
      const comparison = executor.compareResults(actual, expected);
      expect(comparison.match).toBe(true);
    });

    it('false should normalize to "0"', () => {
      const actual = [{ val: false }];
      const expected = [{ val: '0' }];
      const comparison = executor.compareResults(actual, expected);
      expect(comparison.match).toBe(true);
    });

    it('true vs false should NOT match', () => {
      const actual = [{ val: true }];
      const expected = [{ val: false }];
      const comparison = executor.compareResults(actual, expected);
      expect(comparison.match).toBe(false);
    });

    it('boolean true vs number 1 should match', () => {
      const actual = [{ val: true }];
      const expected = [{ val: 1 }];
      const comparison = executor.compareResults(actual, expected);
      expect(comparison.match).toBe(true);
    });

    it('boolean false vs number 0 should match', () => {
      const actual = [{ val: false }];
      const expected = [{ val: 0 }];
      const comparison = executor.compareResults(actual, expected);
      expect(comparison.match).toBe(true);
    });
  });

  // ============================================================================
  // EXTRA/MISSING ROWS
  // ============================================================================
  describe('Extra/Missing Rows', () => {
    it('extra row in actual should NOT match', () => {
      const actual = [{ id: 1 }, { id: 2 }, { id: 3 }];
      const expected = [{ id: 1 }, { id: 2 }];
      const comparison = executor.compareResults(actual, expected);
      expect(comparison.match).toBe(false);
      // Row count mismatch is detected early, before cell-level diff generation
      expect(comparison.differences[0]).toContain('Row count mismatch');
    });

    it('missing row in actual should NOT match', () => {
      const actual = [{ id: 1 }];
      const expected = [{ id: 1 }, { id: 2 }];
      const comparison = executor.compareResults(actual, expected);
      expect(comparison.match).toBe(false);
      // Row count mismatch is detected early, before cell-level diff generation
      expect(comparison.differences[0]).toContain('Row count mismatch');
    });

    it('completely different rows should NOT match', () => {
      const actual = [{ id: 1 }, { id: 2 }];
      const expected = [{ id: 3 }, { id: 4 }];
      const comparison = executor.compareResults(actual, expected);
      expect(comparison.match).toBe(false);
    });

    it('partial overlap should NOT match', () => {
      const actual = [{ id: 1 }, { id: 2 }];
      const expected = [{ id: 2 }, { id: 3 }];
      const comparison = executor.compareResults(actual, expected);
      expect(comparison.match).toBe(false);
    });
  });

  // ============================================================================
  // EMPTY RESULT HANDLING
  // ============================================================================
  describe('Empty Result Handling', () => {
    it('both empty should match', () => {
      const actual: Record<string, unknown>[] = [];
      const expected: Record<string, unknown>[] = [];
      const comparison = executor.compareResults(actual, expected);
      expect(comparison.match).toBe(true);
    });

    it('actual empty, expected non-empty should NOT match', () => {
      const actual: Record<string, unknown>[] = [];
      const expected = [{ id: 1 }];
      const comparison = executor.compareResults(actual, expected);
      expect(comparison.match).toBe(false);
      expect(comparison.differences[0]).toContain('Row count mismatch');
    });

    it('actual non-empty, expected empty should NOT match', () => {
      const actual = [{ id: 1 }];
      const expected: Record<string, unknown>[] = [];
      const comparison = executor.compareResults(actual, expected);
      expect(comparison.match).toBe(false);
      expect(comparison.differences[0]).toContain('Row count mismatch');
    });
  });

  // ============================================================================
  // COMPLEX REAL-WORLD SCENARIOS
  // ============================================================================
  describe('Complex Real-World Scenarios', () => {
    it('should handle AVG with GROUP BY (Problem 13 style)', async () => {
      await executor.initialize(`
        CREATE TABLE products (
          id INTEGER PRIMARY KEY,
          name TEXT,
          category TEXT,
          price REAL
        );
        INSERT INTO products VALUES 
          (1, 'Laptop', 'Electronics', 999.99),
          (2, 'Mouse', 'Electronics', 29.99),
          (3, 'Keyboard', 'Electronics', 79.99),
          (4, 'Desk', 'Furniture', 299.99),
          (5, 'Chair', 'Furniture', 199.99);
      `);

      const result = await executor.executeQuery(
        'SELECT category, AVG(price) as avg_price FROM products GROUP BY category'
      );
      const actual = executor.formatResults(result);

      // Electronics: (999.99 + 29.99 + 79.99) / 3 = 369.99
      // Furniture: (299.99 + 199.99) / 2 = 249.99
      const expected = [
        { category: 'Electronics', avg_price: 369.99 },
        { category: 'Furniture', avg_price: 249.99 }
      ];

      const comparison = executor.compareResults(actual, expected);
      expect(comparison.match).toBe(true);
    });

    it('should detect wrong average (369.99 vs 369.66)', async () => {
      // Simulating a student error in calculation
      const actual = [{ category: 'Electronics', avg_price: 369.99 }];
      const expected = [{ category: 'Electronics', avg_price: 369.66 }];
      const comparison = executor.compareResults(actual, expected);
      expect(comparison.match).toBe(false);
    });

    it('should handle mixed data types in same result set', () => {
      const actual = [
        { id: 1, name: 'Alice', score: 95.5, passed: true, notes: null },
        { id: 2, name: 'Bob', score: 87.0, passed: true, notes: '  Good job  ' }
      ];
      const expected = [
        { id: 1, name: 'Alice', score: 95.5, passed: 1, notes: null },
        { id: 2, name: 'Bob', score: 87, passed: true, notes: 'Good job' }
      ];
      const comparison = executor.compareResults(actual, expected);
      expect(comparison.match).toBe(true);
    });

    it('should handle case-sensitive string comparison', () => {
      const actual = [{ name: 'Alice' }];
      const expected = [{ name: 'alice' }];
      const comparison = executor.compareResults(actual, expected);
      expect(comparison.match).toBe(false);
    });
  });

  // ============================================================================
  // EPSILON ANALYSIS TESTS
  // ============================================================================
  describe('Epsilon Value Analysis', () => {
    it('current epsilon (0.01) allows ~1% tolerance at value 1.0', () => {
      // At value 1.0, epsilon 0.01 = 1% relative tolerance
      const actual = [{ val: 1.0 }];
      const expected = [{ val: 1.009 }]; // 0.9% difference
      const comparison = executor.compareResults(actual, expected);
      expect(comparison.match).toBe(true);
    });

    it('current epsilon (0.01) is very lenient at very small values (0.001 vs 0.01)', () => {
      // At small values, 0.01 epsilon represents a huge relative tolerance
      // 0.001 vs 0.01 = 0.009 difference, which is < 0.01, so they match
      // This is 1000% relative error but within absolute epsilon
      const actual = [{ val: 0.001 }];
      const expected = [{ val: 0.01 }]; // 0.009 difference < 0.01 epsilon
      const comparison = executor.compareResults(actual, expected);
      // These match because the absolute difference (0.009) is less than epsilon (0.01)
      // This is a known limitation of absolute epsilon - it's very lenient for small values
      expect(comparison.match).toBe(true);
    });

    it('current epsilon correctly handles typical money values', () => {
      // For prices like $99.99, epsilon 0.01 = 0.01% relative tolerance
      // This is appropriate for currency
      const actual = [{ price: 99.99 }];
      const expected = [{ price: 99.995 }]; // within 0.01
      const comparison = executor.compareResults(actual, expected);
      expect(comparison.match).toBe(true);
    });
  });
});

// ============================================================================
// SUMMARY OF GRADING POLICY
// ============================================================================
/*
GRADING POLICY DOCUMENTATION:

1. ROW ORDER: Ignored (set-based comparison)
   - Rationale: SQL results are unordered unless ORDER BY is specified
   
2. COLUMN ORDER: Ignored (columns matched by name)
   - Rationale: Column position shouldn't matter, names do
   
3. DUPLICATE ROWS: Preserved (multiset comparison)
   - Rationale: COUNT matters in SQL, [a,a] ≠ [a]
   
4. FLOAT COMPARISON: Epsilon = 0.01
   - Rationale: Handle floating point imprecision without being too lenient
   - Matches: values within 0.01 of each other
   - Fails: values 0.01 or more apart
   
5. NULL/UNDEFINED: Treated as equivalent
   - Rationale: Both represent "no value" in different contexts
   
6. STRING 'NULL': NOT equivalent to SQL NULL
   - Rationale: String 'NULL' is data, SQL NULL is absence of data
   
7. STRING TRIMMING: Leading/trailing whitespace ignored
   - Rationale: SQL often pads strings, user input may vary
   
8. BOOLEAN: Normalized to '1' (true) or '0' (false)
   - Rationale: SQL doesn't have true booleans, uses 0/1
   
9. INTEGER vs FLOAT: Treated as equivalent if values equal
   - Rationale: 5 and 5.0 represent the same value

DEFENSIBILITY:
- The epsilon of 0.01 is appropriate for:
  * Educational contexts where floating point imprecision is common
  * Money values (0.01 = 1 cent tolerance)
  * Typical aggregate function results
  
- However, it may be too strict for:
  * Very large numbers (0.01 is negligible at 1,000,000)
  * Scientific calculations requiring precision
  
- And too lenient for:
  * Very small numbers (0.01 is huge at 0.001)
  
RECOMMENDATION:
The current epsilon = 0.01 is reasonable for the educational SQL context.
Consider relative epsilon for future enhancements if needed.
*/
