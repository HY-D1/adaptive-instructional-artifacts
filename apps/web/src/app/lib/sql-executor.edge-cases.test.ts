/**
 * SQL Executor Edge Cases Test Suite
 * 
 * Comprehensive audit tests for the SQL result comparison engine.
 * These tests document actual comparator behavior and validate edge cases.
 * 
 * Current FLOAT_EPSILON = 0.01
 * 
 * Grading Policy:
 * - Row order: Ignored (set-based comparison)
 * - Column order: Ignored (columns matched by name)
 * - Duplicate rows: Count matters (multiset comparison)
 * - Float comparison: Epsilon = 0.01
 * - Null/undefined: Treated as equivalent
 * - String 'NULL': NOT equivalent to SQL NULL
 * - String trimming: Leading/trailing whitespace ignored
 * - Boolean: Normalized to '1' (true) or '0' (false)
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SQLExecutor } from './sql-executor';

describe('SQLExecutor Edge Cases Audit', () => {
  let executor: SQLExecutor;

  beforeEach(() => {
    executor = new SQLExecutor();
  });

  afterEach(() => {
    executor.close();
  });

  // ============================================================================
  // INTEGER VS FLOAT COMPARISON
  // ============================================================================
  describe('Integer vs Float Comparison', () => {
    it('integers require exact match - 5 vs 5 matches', () => {
      const actual = [{ val: 5 }];
      const expected = [{ val: 5 }];
      const comparison = executor.compareResults(actual, expected);
      expect(comparison.match).toBe(true);
    });

    it('integers require exact match - 5 vs 6 does NOT match', () => {
      const actual = [{ val: 5 }];
      const expected = [{ val: 6 }];
      const comparison = executor.compareResults(actual, expected);
      expect(comparison.match).toBe(false);
    });

    it('5 (int) vs 5.0 (float) matches - same numeric value', () => {
      const actual = [{ val: 5 }];
      const expected = [{ val: 5.0 }];
      const comparison = executor.compareResults(actual, expected);
      expect(comparison.match).toBe(true);
    });

    it('5 (int) vs 5.00 (float) matches - trailing zeros ignored', () => {
      const actual = [{ val: 5 }];
      const expected = [{ val: 5.00 }];
      const comparison = executor.compareResults(actual, expected);
      expect(comparison.match).toBe(true);
    });

    it('integer stored as string "5" vs number 5 matches', () => {
      const actual = [{ val: '5' }];
      const expected = [{ val: 5 }];
      const comparison = executor.compareResults(actual, expected);
      expect(comparison.match).toBe(true);
    });

    it('SQL INTEGER column vs REAL column values match', async () => {
      await executor.initialize(`
        CREATE TABLE t_int (val INTEGER);
        CREATE TABLE t_real (val REAL);
        INSERT INTO t_int VALUES (42);
        INSERT INTO t_real VALUES (42.0);
      `);
      
      const intResult = await executor.executeQuery('SELECT val FROM t_int');
      const realResult = await executor.executeQuery('SELECT val FROM t_real');
      
      const intRows = executor.formatResults(intResult);
      const realRows = executor.formatResults(realResult);
      
      const comparison = executor.compareResults(intRows, realRows);
      expect(comparison.match).toBe(true);
    });
  });

  // ============================================================================
  // FLOAT EPSILON COMPARISON (FLOAT_EPSILON = 0.01)
  // ============================================================================
  describe('Float Epsilon Comparison (ε = 0.01)', () => {
    describe('values WITHIN epsilon should match', () => {
      it('369.99 vs 369.9900001 matches (diff = 0.0000001 < 0.01)', () => {
        const actual = [{ val: 369.99 }];
        const expected = [{ val: 369.9900001 }];
        const comparison = executor.compareResults(actual, expected);
        expect(comparison.match).toBe(true);
      });

      it('369.99 vs 369.995 matches (diff = 0.005 < 0.01)', () => {
        const actual = [{ val: 369.99 }];
        const expected = [{ val: 369.995 }];
        const comparison = executor.compareResults(actual, expected);
        expect(comparison.match).toBe(true);
      });

      it('369.99 vs 369.984 matches (diff = 0.006 < 0.01)', () => {
        const actual = [{ val: 369.99 }];
        const expected = [{ val: 369.984 }];
        const comparison = executor.compareResults(actual, expected);
        expect(comparison.match).toBe(true);
      });

      it('floating point imprecision: 20.2 vs 20.199999999999996 matches', () => {
        const actual = [{ val: 20.199999999999996 }];
        const expected = [{ val: 20.2 }];
        const comparison = executor.compareResults(actual, expected);
        expect(comparison.match).toBe(true);
      });
    });

    describe('values OUTSIDE epsilon should NOT match', () => {
      it('369.99 vs 369.66 does NOT match (diff = 0.33 > 0.01)', () => {
        const actual = [{ val: 369.99 }];
        const expected = [{ val: 369.66 }];
        const comparison = executor.compareResults(actual, expected);
        expect(comparison.match).toBe(false);
      });

      it('369.99 vs 370.00 - DOCUMENTED BEHAVIOR: matches due to float precision', () => {
        // IMPORTANT: Due to floating-point representation, 370.0 - 369.99 = 0.009999...
        // This is slightly LESS than 0.01, so these values DO match
        // This is a known behavior of absolute epsilon comparison
        const actual = [{ val: 369.99 }];
        const expected = [{ val: 370.0 }];
        const comparison = executor.compareResults(actual, expected);
        expect(comparison.match).toBe(true);
      });

      it('369.99 vs 370.02 does NOT match (diff = 0.03 > 0.01)', () => {
        const actual = [{ val: 369.99 }];
        const expected = [{ val: 370.02 }];
        const comparison = executor.compareResults(actual, expected);
        expect(comparison.match).toBe(false);
      });

      it('100.00 vs 100.02 does NOT match (diff = 0.02 > 0.01)', () => {
        const actual = [{ val: 100.0 }];
        const expected = [{ val: 100.02 }];
        const comparison = executor.compareResults(actual, expected);
        expect(comparison.match).toBe(false);
      });
    });
  });

  // ============================================================================
  // DUPLICATE ROW HANDLING (Multiset Comparison)
  // ============================================================================
  describe('Duplicate Row Handling (Multiset Comparison)', () => {
    it('identical rows with same count match', () => {
      const actual = [{ id: 1 }, { id: 1 }];
      const expected = [{ id: 1 }, { id: 1 }];
      const comparison = executor.compareResults(actual, expected);
      expect(comparison.match).toBe(true);
    });

    it('extra duplicate row in actual does NOT match', () => {
      const actual = [{ id: 1 }, { id: 1 }, { id: 1 }];
      const expected = [{ id: 1 }, { id: 1 }];
      const comparison = executor.compareResults(actual, expected);
      expect(comparison.match).toBe(false);
    });

    it('missing duplicate row in actual does NOT match', () => {
      const actual = [{ id: 1 }];
      const expected = [{ id: 1 }, { id: 1 }];
      const comparison = executor.compareResults(actual, expected);
      expect(comparison.match).toBe(false);
    });

    it('complex multiset: [a,a,b,b] vs [a,a,b,b] matches', () => {
      const actual = [
        { id: 1 }, { id: 1 },
        { id: 2 }, { id: 2 }
      ];
      const expected = [
        { id: 1 }, { id: 1 },
        { id: 2 }, { id: 2 }
      ];
      const comparison = executor.compareResults(actual, expected);
      expect(comparison.match).toBe(true);
    });

    it('complex multiset: [a,a,b] vs [a,b,b] does NOT match', () => {
      const actual = [{ id: 1 }, { id: 1 }, { id: 2 }];
      const expected = [{ id: 1 }, { id: 2 }, { id: 2 }];
      const comparison = executor.compareResults(actual, expected);
      expect(comparison.match).toBe(false);
    });
  });

  // ============================================================================
  // EXTRA/MISSING ROWS
  // ============================================================================
  describe('Extra/Missing Rows', () => {
    it('extra row in actual does NOT match', () => {
      const actual = [{ id: 1 }, { id: 2 }, { id: 3 }];
      const expected = [{ id: 1 }, { id: 2 }];
      const comparison = executor.compareResults(actual, expected);
      expect(comparison.match).toBe(false);
      expect(comparison.differences[0]).toContain('Row count mismatch');
    });

    it('missing row in actual does NOT match', () => {
      const actual = [{ id: 1 }];
      const expected = [{ id: 1 }, { id: 2 }];
      const comparison = executor.compareResults(actual, expected);
      expect(comparison.match).toBe(false);
      expect(comparison.differences[0]).toContain('Row count mismatch');
    });

    it('completely different rows do NOT match', () => {
      const actual = [{ id: 1 }, { id: 2 }];
      const expected = [{ id: 3 }, { id: 4 }];
      const comparison = executor.compareResults(actual, expected);
      expect(comparison.match).toBe(false);
    });

    it('partial overlap does NOT match', () => {
      const actual = [{ id: 1 }, { id: 2 }];
      const expected = [{ id: 2 }, { id: 3 }];
      const comparison = executor.compareResults(actual, expected);
      expect(comparison.match).toBe(false);
    });
  });

  // ============================================================================
  // REORDERED ROWS (Row Order Independence)
  // ============================================================================
  describe('Reordered Rows (Row Order Independence)', () => {
    it('reversed row order matches', () => {
      const actual = [
        { id: 3, name: 'Charlie' },
        { id: 2, name: 'Bob' },
        { id: 1, name: 'Alice' }
      ];
      const expected = [
        { id: 1, name: 'Alice' },
        { id: 2, name: 'Bob' },
        { id: 3, name: 'Charlie' }
      ];
      const comparison = executor.compareResults(actual, expected);
      expect(comparison.match).toBe(true);
    });

    it('shuffled order with multiple columns matches', () => {
      const actual = [
        { a: 7, b: 8, c: 9 },
        { a: 1, b: 2, c: 3 },
        { a: 4, b: 5, c: 6 }
      ];
      const expected = [
        { a: 1, b: 2, c: 3 },
        { a: 4, b: 5, c: 6 },
        { a: 7, b: 8, c: 9 }
      ];
      const comparison = executor.compareResults(actual, expected);
      expect(comparison.match).toBe(true);
    });

    it('shuffled duplicates match', () => {
      const actual = [{ id: 1 }, { id: 2 }, { id: 1 }];
      const expected = [{ id: 1 }, { id: 1 }, { id: 2 }];
      const comparison = executor.compareResults(actual, expected);
      expect(comparison.match).toBe(true);
    });
  });

  // ============================================================================
  // NULL vs UNDEFINED EQUIVALENCE
  // ============================================================================
  describe('NULL vs Undefined Equivalence', () => {
    it('null vs null matches', () => {
      const actual = [{ val: null }];
      const expected = [{ val: null }];
      const comparison = executor.compareResults(actual, expected);
      expect(comparison.match).toBe(true);
    });

    it('undefined vs undefined matches', () => {
      const actual = [{ val: undefined }];
      const expected = [{ val: undefined }];
      const comparison = executor.compareResults(actual, expected);
      expect(comparison.match).toBe(true);
    });

    it('null vs undefined matches (treated as equivalent)', () => {
      const actual = [{ val: null }];
      const expected = [{ val: undefined }];
      const comparison = executor.compareResults(actual, expected);
      expect(comparison.match).toBe(true);
    });

    it('undefined vs null matches (symmetric)', () => {
      const actual = [{ val: undefined }];
      const expected = [{ val: null }];
      const comparison = executor.compareResults(actual, expected);
      expect(comparison.match).toBe(true);
    });

    it('string "NULL" vs SQL null does NOT match', () => {
      const actual = [{ val: 'NULL' }];
      const expected = [{ val: null }];
      const comparison = executor.compareResults(actual, expected);
      expect(comparison.match).toBe(false);
    });

    it('string "null" vs SQL null does NOT match', () => {
      const actual = [{ val: 'null' }];
      const expected = [{ val: null }];
      const comparison = executor.compareResults(actual, expected);
      expect(comparison.match).toBe(false);
    });

    it('empty string vs null does NOT match', () => {
      const actual = [{ val: '' }];
      const expected = [{ val: null }];
      const comparison = executor.compareResults(actual, expected);
      expect(comparison.match).toBe(false);
    });

    it('mixed nulls in multi-row results match', () => {
      const actual = [
        { id: 1, val: null },
        { id: 2, val: 'hello' },
        { id: 3, val: undefined }
      ];
      const expected = [
        { id: 1, val: undefined },
        { id: 2, val: 'hello' },
        { id: 3, val: null }
      ];
      const comparison = executor.compareResults(actual, expected);
      expect(comparison.match).toBe(true);
    });
  });

  // ============================================================================
  // STRING TRIMMING
  // ============================================================================
  describe('String Trimming', () => {
    it('leading/trailing whitespace is trimmed - matches', () => {
      const actual = [{ name: '  Alice  ' }];
      const expected = [{ name: 'Alice' }];
      const comparison = executor.compareResults(actual, expected);
      expect(comparison.match).toBe(true);
    });

    it('internal whitespace is preserved - does NOT match', () => {
      const actual = [{ name: 'Alice  Smith' }];
      const expected = [{ name: 'Alice Smith' }];
      const comparison = executor.compareResults(actual, expected);
      expect(comparison.match).toBe(false);
    });

    it('tab characters are trimmed - matches', () => {
      const actual = [{ name: '\tAlice\t' }];
      const expected = [{ name: 'Alice' }];
      const comparison = executor.compareResults(actual, expected);
      expect(comparison.match).toBe(true);
    });

    it('newline characters are trimmed - matches', () => {
      const actual = [{ name: '\nAlice\n' }];
      const expected = [{ name: 'Alice' }];
      const comparison = executor.compareResults(actual, expected);
      expect(comparison.match).toBe(true);
    });

    it('empty string vs whitespace-only matches (both become empty after trim)', () => {
      const actual = [{ name: '' }];
      const expected = [{ name: '   ' }];
      const comparison = executor.compareResults(actual, expected);
      expect(comparison.match).toBe(true);
    });

    it('case-sensitive comparison - "Alice" vs "alice" does NOT match', () => {
      const actual = [{ name: 'Alice' }];
      const expected = [{ name: 'alice' }];
      const comparison = executor.compareResults(actual, expected);
      expect(comparison.match).toBe(false);
    });
  });

  // ============================================================================
  // COLUMN ORDER INDEPENDENCE
  // ============================================================================
  describe('Column Order Independence', () => {
    it('reversed column order matches', () => {
      const actual = [{ b: 2, a: 1 }];
      const expected = [{ a: 1, b: 2 }];
      const comparison = executor.compareResults(actual, expected);
      expect(comparison.match).toBe(true);
    });

    it('shuffled column order with multiple rows matches', () => {
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

    it('different column names do NOT match', () => {
      const actual = [{ x: 1, y: 2 }];
      const expected = [{ a: 1, b: 2 }];
      const comparison = executor.compareResults(actual, expected);
      expect(comparison.match).toBe(false);
    });

    it('extra column in actual does NOT match', () => {
      const actual = [{ a: 1, b: 2, c: 3 }];
      const expected = [{ a: 1, b: 2 }];
      const comparison = executor.compareResults(actual, expected);
      expect(comparison.match).toBe(false);
    });

    it('missing column in actual does NOT match', () => {
      const actual = [{ a: 1 }];
      const expected = [{ a: 1, b: 2 }];
      const comparison = executor.compareResults(actual, expected);
      expect(comparison.match).toBe(false);
    });
  });

  // ============================================================================
  // EMPTY RESULT HANDLING
  // ============================================================================
  describe('Empty Result Handling', () => {
    it('both empty results match', () => {
      const actual: Record<string, unknown>[] = [];
      const expected: Record<string, unknown>[] = [];
      const comparison = executor.compareResults(actual, expected);
      expect(comparison.match).toBe(true);
    });

    it('actual empty, expected non-empty does NOT match', () => {
      const actual: Record<string, unknown>[] = [];
      const expected = [{ id: 1 }];
      const comparison = executor.compareResults(actual, expected);
      expect(comparison.match).toBe(false);
      expect(comparison.differences[0]).toContain('Row count mismatch');
    });

    it('actual non-empty, expected empty does NOT match', () => {
      const actual = [{ id: 1 }];
      const expected: Record<string, unknown>[] = [];
      const comparison = executor.compareResults(actual, expected);
      expect(comparison.match).toBe(false);
      expect(comparison.differences[0]).toContain('Row count mismatch');
    });
  });

  // ============================================================================
  // BOOLEAN NORMALIZATION
  // ============================================================================
  describe('Boolean Normalization', () => {
    it('true normalizes to "1" - matches string "1"', () => {
      const actual = [{ val: true }];
      const expected = [{ val: '1' }];
      const comparison = executor.compareResults(actual, expected);
      expect(comparison.match).toBe(true);
    });

    it('false normalizes to "0" - matches string "0"', () => {
      const actual = [{ val: false }];
      const expected = [{ val: '0' }];
      const comparison = executor.compareResults(actual, expected);
      expect(comparison.match).toBe(true);
    });

    it('true vs false does NOT match', () => {
      const actual = [{ val: true }];
      const expected = [{ val: false }];
      const comparison = executor.compareResults(actual, expected);
      expect(comparison.match).toBe(false);
    });

    it('boolean true vs number 1 matches', () => {
      const actual = [{ val: true }];
      const expected = [{ val: 1 }];
      const comparison = executor.compareResults(actual, expected);
      expect(comparison.match).toBe(true);
    });

    it('boolean false vs number 0 matches', () => {
      const actual = [{ val: false }];
      const expected = [{ val: 0 }];
      const comparison = executor.compareResults(actual, expected);
      expect(comparison.match).toBe(true);
    });
  });

  // ============================================================================
  // DIFF OUTPUT QUALITY
  // ============================================================================
  describe('Diff Output Quality', () => {
    it('row count mismatch reports clearly', () => {
      const actual = [{ id: 1 }];
      const expected = [{ id: 1 }, { id: 2 }];
      const comparison = executor.compareResults(actual, expected);
      expect(comparison.match).toBe(false);
      expect(comparison.differences[0]).toContain('Row count mismatch');
      expect(comparison.differences[0]).toContain('got 1');
      expect(comparison.differences[0]).toContain('expected 2');
    });

    it('cell-level difference shows actual vs expected values', () => {
      const actual = [{ id: 1, val: 100 }];
      const expected = [{ id: 1, val: 200 }];
      const comparison = executor.compareResults(actual, expected);
      expect(comparison.match).toBe(false);
      // Should show cell-level diff
      const hasCellDiff = comparison.differences.some(d => 
        d.includes('val:') && d.includes('100') && d.includes('200')
      );
      expect(hasCellDiff).toBe(true);
    });

    it('unexpected row is reported', () => {
      const actual = [{ id: 1 }, { id: 99 }];
      const expected = [{ id: 1 }];
      const comparison = executor.compareResults(actual, expected);
      expect(comparison.match).toBe(false);
      // Row count mismatch detected first
      expect(comparison.differences[0]).toContain('Row count mismatch');
    });
  });

  // ============================================================================
  // EPSILON APPROPRIATENESS ANALYSIS
  // ============================================================================
  describe('Epsilon Appropriateness Analysis', () => {
    it('epsilon 0.01 is appropriate for currency (penny-level precision)', () => {
      // For $99.99, epsilon 0.01 = 0.01% relative tolerance
      const actual = [{ price: 99.99 }];
      const expected = [{ price: 99.995 }]; // within 0.01
      const comparison = executor.compareResults(actual, expected);
      expect(comparison.match).toBe(true);
    });

    it('epsilon 0.01 allows ~1% tolerance at value 1.0', () => {
      const actual = [{ val: 1.0 }];
      const expected = [{ val: 1.009 }]; // 0.9% difference
      const comparison = executor.compareResults(actual, expected);
      expect(comparison.match).toBe(true);
    });

    it('DOCUMENTED: epsilon 0.01 is very lenient at small values', () => {
      // 0.001 vs 0.01 = 0.009 difference < 0.01
      // This is 1000% relative error but within absolute epsilon
      const actual = [{ val: 0.001 }];
      const expected = [{ val: 0.01 }];
      const comparison = executor.compareResults(actual, expected);
      // These match because absolute difference (0.009) < epsilon (0.01)
      expect(comparison.match).toBe(true);
    });

    it('epsilon 0.01 is negligible at large values (1,000,000)', () => {
      // At 1,000,000, epsilon 0.01 = 0.000001% relative tolerance
      // This is very strict for large numbers
      const actual = [{ val: 1000000 }];
      const expected = [{ val: 1000000.005 }]; // within 0.01
      const comparison = executor.compareResults(actual, expected);
      expect(comparison.match).toBe(true);
    });
  });

  // ============================================================================
  // REAL-WORLD SCENARIOS
  // ============================================================================
  describe('Real-World Scenarios', () => {
    it('handles AVG with GROUP BY (aggregate function results)', async () => {
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

    it('detects wrong calculation (369.99 vs 369.66)', () => {
      const actual = [{ category: 'Electronics', avg_price: 369.99 }];
      const expected = [{ category: 'Electronics', avg_price: 369.66 }];
      const comparison = executor.compareResults(actual, expected);
      expect(comparison.match).toBe(false);
    });

    it('handles mixed data types in same result set', () => {
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
  });
});

// ============================================================================
// SUMMARY DOCUMENTATION
// ============================================================================
/*
COMPARATOR BEHAVIOR DOCUMENTATION:

1. FLOAT_EPSILON = 0.01 (absolute epsilon comparison)
   - Appropriate for: educational contexts, currency values, typical aggregates
   - Limitation: Very lenient for small values (0.001 vs 0.01 matches)
   - Limitation: Very strict for large values (1M vs 1M+0.02 fails)

2. ROW ORDER: Ignored
   - SQL results are sets unless ORDER BY is specified
   - Rationale: Learners shouldn't be penalized for unspecified ordering

3. COLUMN ORDER: Ignored  
   - Column position shouldn't matter, names do
   - Columns are matched by name, not position

4. DUPLICATE ROWS: Count matters (multiset comparison)
   - [a,a] ≠ [a] 
   - Rationale: COUNT(*) and similar aggregates care about row counts

5. NULL/UNDEFINED: Treated as equivalent
   - Both represent "no value" in different contexts
   - String 'NULL' is NOT equivalent to SQL NULL

6. STRING TRIMMING: Leading/trailing whitespace ignored
   - Rationale: SQL often pads strings, user input may vary
   - Internal whitespace is preserved

7. BOOLEAN: Normalized to '1' (true) or '0' (false)
   - Matches SQL convention of using 0/1 for booleans

RECOMMENDATION:
The current FLOAT_EPSILON = 0.01 is appropriate for the educational SQL context.
It handles typical floating-point imprecision from aggregate functions while
maintaining reasonable accuracy for currency and common calculations.

Future enhancement could consider relative epsilon for better handling of
very small and very large numbers.
*/
