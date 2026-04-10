/**
 * SQL Executor Regression Test Suite
 *
 * Comprehensive regression tests for all 32 SQL problems.
 * Validates that expectedQuery produces expectedResult for each problem.
 *
 * Run with: npx vitest run apps/web/src/app/lib/sql-executor.regression.test.ts
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { SQLExecutor } from './sql-executor';
import { sqlProblems, getProblemById } from '../data/problems';

describe('SQL Problems Regression Suite - All 32 Problems', () => {
  // Test all 32 problems
  for (const problem of sqlProblems) {
    it(`${problem.id}: ${problem.title}`, async () => {
      const executor = new SQLExecutor();
      
      try {
        // Initialize with problem schema
        await executor.initialize(problem.schema);
        
        // Execute the expected query
        const result = await executor.executeQuery(problem.expectedQuery);
        
        if (!result.success) {
          throw new Error(`Query execution failed: ${result.error}`);
        }
        
        // Format results for comparison
        const formatted = executor.formatResults(result);
        
        // Compare with expected result
        const expected = problem.expectedResult ?? [];
        const comparison = executor.compareResults(formatted, expected);
        
        // Assert they match with detailed failure message
        expect(
          comparison.match,
          `Problem ${problem.id} (${problem.title}) failed:\n` +
          `Query: ${problem.expectedQuery}\n` +
          `Differences:\n${comparison.differences.join('\n')}\n` +
          `Actual: ${JSON.stringify(formatted, null, 2)}\n` +
          `Expected: ${JSON.stringify(expected, null, 2)}`
        ).toBe(true);
      } finally {
        // Always clean up
        executor.close();
      }
    });
  }
});

/**
 * Focused regression tests for known tricky cases.
 * These tests provide more detailed debugging information for complex scenarios.
 */
describe('SQL Problems - Tricky Cases (Focused Regression)', () => {
  const trickyProblemIds = [
    'problem-12', // Aggregation with HAVING
    'problem-13', // High-Value Categories with AVG floating point
    'problem-23', // Correlated subquery
    'problem-24', // Window functions with ROW_NUMBER
    'problem-25', // RANK window function
    'problem-29', // LIMIT/OFFSET pagination
    'problem-30', // UNION distinct behavior
    'problem-31', // LEFT JOIN with NULL manager rows
  ];

  for (const problemId of trickyProblemIds) {
    const problem = getProblemById(problemId);
    
    if (!problem) {
      it.skip(`${problemId}: Problem not found`, () => {});
      continue;
    }

    it(`${problemId}: ${problem.title} (focused)`, async () => {
      const executor = new SQLExecutor();
      
      try {
        // Initialize with problem schema
        await executor.initialize(problem.schema);
        
        // Execute the expected query
        const result = await executor.executeQuery(problem.expectedQuery);
        
        if (!result.success) {
          throw new Error(`Query execution failed: ${result.error}`);
        }
        
        // Format results for comparison
        const formatted = executor.formatResults(result);
        
        // Compare with expected result
        const expected = problem.expectedResult ?? [];
        const comparison = executor.compareResults(formatted, expected);
        
        // Detailed assertions for debugging
        expect(result.success).toBe(true);
        expect(result.error).toBeUndefined();
        
        // Row count check first for clearer error messages
        if (formatted.length !== expected.length) {
          expect(
            formatted.length,
            `Row count mismatch for ${problemId}. Got ${formatted.length}, expected ${expected.length}.\n` +
            `Actual rows: ${JSON.stringify(formatted, null, 2)}\n` +
            `Expected rows: ${JSON.stringify(expected, null, 2)}`
          ).toBe(expected.length);
        }
        
        // Full comparison
        expect(
          comparison.match,
          `Result mismatch for ${problemId}:\n` +
          comparison.differences.map(d => `  - ${d}`).join('\n')
        ).toBe(true);
        
      } finally {
        executor.close();
      }
    });
  }
});

/**
 * Individual detailed tests for the trickiest cases.
 * These tests include schema verification and step-by-step debugging.
 */
describe('SQL Problems - Detailed Tricky Case Analysis', () => {
  
  it('problem-12: Order Count per User With HAVING - verifies aggregation filtering', async () => {
    const problem = getProblemById('problem-12');
    expect(problem).toBeDefined();
    
    const executor = new SQLExecutor();
    
    try {
      await executor.initialize(problem!.schema);
      
      // Verify schema loaded correctly
      const tableCheck = await executor.executeQuery(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='orders';"
      );
      expect(tableCheck.success).toBe(true);
      expect(tableCheck.values?.length).toBe(1);
      
      // Execute the HAVING query
      const result = await executor.executeQuery(problem!.expectedQuery);
      expect(result.success).toBe(true);
      
      const formatted = executor.formatResults(result);
      expect(formatted.length).toBe(3); // Should have 3 users with 2+ orders
      
      // Verify specific results
      const userIds = formatted.map((r: Record<string, unknown>) => r.user_id);
      expect(userIds).toContain(1);
      expect(userIds).toContain(2);
      expect(userIds).toContain(4);
      
      // Verify order counts
      formatted.forEach((row: Record<string, unknown>) => {
        expect(row.order_count).toBeGreaterThanOrEqual(2);
      });
      
    } finally {
      executor.close();
    }
  });

  it('problem-13: High-Value Categories - verifies AVG() floating point calculation with HAVING', async () => {
    const problem = getProblemById('problem-13');
    expect(problem).toBeDefined();
    
    const executor = new SQLExecutor();
    
    try {
      await executor.initialize(problem!.schema);
      
      // First verify raw data
      const rawData = await executor.executeQuery('SELECT * FROM products;');
      expect(rawData.success).toBe(true);
      expect(rawData.values?.length).toBe(6);
      
      // Execute the AVG with HAVING query
      const result = await executor.executeQuery(problem!.expectedQuery);
      expect(result.success).toBe(true);
      
      const formatted = executor.formatResults(result);
      
      // Verify we get exactly 2 categories
      expect(formatted.length).toBe(2);
      
      // Verify floating point values are within epsilon tolerance
      const electronics = formatted.find((r: Record<string, unknown>) => r.category === 'Electronics');
      const furniture = formatted.find((r: Record<string, unknown>) => r.category === 'Furniture');
      
      expect(electronics).toBeDefined();
      expect(furniture).toBeDefined();
      
      // Check floating point values with tolerance (epsilon = 0.01)
      expect(Math.abs((electronics!.avg_price as number) - 369.99)).toBeLessThan(0.01);
      expect(Math.abs((furniture!.avg_price as number) - 249.99)).toBeLessThan(0.01);
      
      // Full comparison using the executor's comparison logic
      const comparison = executor.compareResults(formatted, problem!.expectedResult ?? []);
      expect(comparison.match).toBe(true);
      
    } finally {
      executor.close();
    }
  });

  it('problem-23: Employees Above Dept Average - verifies correlated subquery', async () => {
    const problem = getProblemById('problem-23');
    expect(problem).toBeDefined();
    
    const executor = new SQLExecutor();
    
    try {
      await executor.initialize(problem!.schema);
      
      // Verify employees data
      const empData = await executor.executeQuery('SELECT * FROM employees ORDER BY dept_id, salary;');
      expect(empData.success).toBe(true);
      
      // Execute correlated subquery
      const result = await executor.executeQuery(problem!.expectedQuery);
      expect(result.success).toBe(true);
      
      const formatted = executor.formatResults(result);
      expect(formatted.length).toBe(2); // Alice and Carol
      
      const names = formatted.map((r: Record<string, unknown>) => r.emp_name);
      expect(names).toContain('Alice');
      expect(names).toContain('Carol');
      
    } finally {
      executor.close();
    }
  });

  it('problem-24: Top 2 Salaries Per Department - verifies ROW_NUMBER() window function', async () => {
    const problem = getProblemById('problem-24');
    expect(problem).toBeDefined();
    
    const executor = new SQLExecutor();
    
    try {
      await executor.initialize(problem!.schema);
      
      // Verify window function works
      const result = await executor.executeQuery(problem!.expectedQuery);
      expect(result.success).toBe(true);
      
      const formatted = executor.formatResults(result);
      
      // Should have exactly 6 rows (2 per department × 3 departments with employees + 1 dept with 1 emp)
      // Engineering: Alice(90k), Bob(75k) = 2
      // Sales: Carol(80k), David(65k) = 2
      // Marketing: Eve(70k) = 1
      // HR: Frank(55k) = 1
      // Total: 6
      expect(formatted.length).toBe(6);
      
      // Compare with expected
      const comparison = executor.compareResults(formatted, problem!.expectedResult ?? []);
      expect(comparison.match).toBe(true);
      
    } finally {
      executor.close();
    }
  });

  it('problem-25: Salary Rank - verifies RANK() window function', async () => {
    const problem = getProblemById('problem-25');
    expect(problem).toBeDefined();
    
    const executor = new SQLExecutor();
    
    try {
      await executor.initialize(problem!.schema);
      
      const result = await executor.executeQuery(problem!.expectedQuery);
      expect(result.success).toBe(true);
      
      const formatted = executor.formatResults(result);
      expect(formatted.length).toBe(6);
      
      // Verify ranks are sequential from 1-6 (no ties in test data)
      const ranks = formatted.map((r: Record<string, unknown>) => r.salary_rank).sort((a, b) => (a as number) - (b as number));
      expect(ranks).toEqual([1, 2, 3, 4, 5, 6]);
      
      // Full comparison
      const comparison = executor.compareResults(formatted, problem!.expectedResult ?? []);
      expect(comparison.match).toBe(true);
      
    } finally {
      executor.close();
    }
  });

  it('problem-29: Paginate Products - verifies LIMIT/OFFSET behavior', async () => {
    const problem = getProblemById('problem-29');
    expect(problem).toBeDefined();
    
    const executor = new SQLExecutor();
    
    try {
      await executor.initialize(problem!.schema);
      
      // Verify full dataset
      const allData = await executor.executeQuery('SELECT * FROM products ORDER BY id;');
      expect(allData.success).toBe(true);
      expect(allData.values?.length).toBe(6);
      
      // Execute LIMIT/OFFSET query
      const result = await executor.executeQuery(problem!.expectedQuery);
      expect(result.success).toBe(true);
      
      const formatted = executor.formatResults(result);
      expect(formatted.length).toBe(3); // LIMIT 3
      
      // Should get products 3, 4, 5 (OFFSET 2 means skip first 2)
      const ids = formatted.map((r: Record<string, unknown>) => r.id);
      expect(ids).toContain(3);
      expect(ids).toContain(4);
      expect(ids).toContain(5);
      expect(ids).not.toContain(1);
      expect(ids).not.toContain(2);
      expect(ids).not.toContain(6);
      
      // Full comparison
      const comparison = executor.compareResults(formatted, problem!.expectedResult ?? []);
      expect(comparison.match).toBe(true);
      
    } finally {
      executor.close();
    }
  });

  it('problem-30: All Regions With Sales - verifies UNION distinct behavior', async () => {
    const problem = getProblemById('problem-30');
    expect(problem).toBeDefined();
    
    const executor = new SQLExecutor();
    
    try {
      await executor.initialize(problem!.schema);
      
      // Verify raw data has duplicates
      const rawData = await executor.executeQuery('SELECT region FROM sales;');
      expect(rawData.success).toBe(true);
      expect(rawData.values?.length).toBe(6); // 6 sales records
      
      // Execute UNION query (should deduplicate)
      const result = await executor.executeQuery(problem!.expectedQuery);
      expect(result.success).toBe(true);
      
      const formatted = executor.formatResults(result);
      expect(formatted.length).toBe(4); // 4 unique regions
      
      const regions = formatted.map((r: Record<string, unknown>) => r.region);
      expect(regions).toContain('North');
      expect(regions).toContain('South');
      expect(regions).toContain('East');
      expect(regions).toContain('West');
      
      // Full comparison
      const comparison = executor.compareResults(formatted, problem!.expectedResult ?? []);
      expect(comparison.match).toBe(true);
      
    } finally {
      executor.close();
    }
  });

  it('problem-31: Employee Manager Pairs - verifies LEFT JOIN with NULL manager rows', async () => {
    const problem = getProblemById('problem-31');
    expect(problem).toBeDefined();
    
    const executor = new SQLExecutor();
    
    try {
      await executor.initialize(problem!.schema);
      
      // Verify self-join works with NULL manager_ids
      const result = await executor.executeQuery(problem!.expectedQuery);
      expect(result.success).toBe(true);
      
      const formatted = executor.formatResults(result);
      expect(formatted.length).toBe(6); // All 6 employees
      
      // Count employees with NULL managers (those without managers)
      const nullManagers = formatted.filter((r: Record<string, unknown>) => r.manager === null);
      expect(nullManagers.length).toBe(4); // Alice, Carol, Eve, Frank
      
      // Verify Bob reports to Alice
      const bobRow = formatted.find((r: Record<string, unknown>) => r.employee === 'Bob');
      expect(bobRow).toBeDefined();
      expect(bobRow!.manager).toBe('Alice');
      
      // Verify David reports to Carol
      const davidRow = formatted.find((r: Record<string, unknown>) => r.employee === 'David');
      expect(davidRow).toBeDefined();
      expect(davidRow!.manager).toBe('Carol');
      
      // Full comparison
      const comparison = executor.compareResults(formatted, problem!.expectedResult ?? []);
      expect(comparison.match).toBe(true);
      
    } finally {
      executor.close();
    }
  });

  it('problem-21: Salary Grade Classification - verifies CASE expression with string results', async () => {
    const problem = getProblemById('problem-21');
    expect(problem).toBeDefined();
    
    const executor = new SQLExecutor();
    
    try {
      await executor.initialize(problem!.schema);
      
      const result = await executor.executeQuery(problem!.expectedQuery);
      expect(result.success).toBe(true);
      
      const formatted = executor.formatResults(result);
      expect(formatted.length).toBe(6);
      
      // Verify salary grades
      const alice = formatted.find((r: Record<string, unknown>) => r.emp_name === 'Alice');
      const bob = formatted.find((r: Record<string, unknown>) => r.emp_name === 'Bob');
      
      expect(alice!.salary_grade).toBe('High');
      expect(bob!.salary_grade).toBe('Medium');
      
      // Full comparison
      const comparison = executor.compareResults(formatted, problem!.expectedResult ?? []);
      expect(comparison.match).toBe(true);
      
    } finally {
      executor.close();
    }
  });

  it('problem-28: Handle NULL Priorities - verifies COALESCE null handling', async () => {
    const problem = getProblemById('problem-28');
    expect(problem).toBeDefined();
    
    const executor = new SQLExecutor();
    
    try {
      await executor.initialize(problem!.schema);
      
      // First verify there are NULL priorities in the data
      const rawData = await executor.executeQuery('SELECT * FROM tasks WHERE priority IS NULL;');
      expect(rawData.success).toBe(true);
      expect(rawData.values?.length).toBeGreaterThan(0);
      
      // Execute COALESCE query
      const result = await executor.executeQuery(problem!.expectedQuery);
      expect(result.success).toBe(true);
      
      const formatted = executor.formatResults(result);
      expect(formatted.length).toBe(5);
      
      // Verify NULL priorities are replaced with 0
      const writeTests = formatted.find((r: Record<string, unknown>) => r.task_name === 'Write tests');
      expect(writeTests).toBeDefined();
      expect(writeTests!.effective_priority).toBe(0);
      
      // Full comparison
      const comparison = executor.compareResults(formatted, problem!.expectedResult ?? []);
      expect(comparison.match).toBe(true);
      
    } finally {
      executor.close();
    }
  });
});

/**
 * Difficulty-based test suites for organized reporting.
 */
describe('SQL Problems - By Difficulty', () => {
  const byDifficulty = {
    beginner: sqlProblems.filter(p => p.difficulty === 'beginner'),
    intermediate: sqlProblems.filter(p => p.difficulty === 'intermediate'),
    advanced: sqlProblems.filter(p => p.difficulty === 'advanced'),
  };

  describe(`Beginner (${byDifficulty.beginner.length} problems)`, () => {
    for (const problem of byDifficulty.beginner) {
      it(`${problem.id}: ${problem.title}`, async () => {
        const executor = new SQLExecutor();
        try {
          await executor.initialize(problem.schema);
          const result = await executor.executeQuery(problem.expectedQuery);
          expect(result.success).toBe(true);
          
          const formatted = executor.formatResults(result);
          const comparison = executor.compareResults(formatted, problem.expectedResult ?? []);
          expect(comparison.match, comparison.differences.join('\n')).toBe(true);
        } finally {
          executor.close();
        }
      });
    }
  });

  describe(`Intermediate (${byDifficulty.intermediate.length} problems)`, () => {
    for (const problem of byDifficulty.intermediate) {
      it(`${problem.id}: ${problem.title}`, async () => {
        const executor = new SQLExecutor();
        try {
          await executor.initialize(problem.schema);
          const result = await executor.executeQuery(problem.expectedQuery);
          expect(result.success).toBe(true);
          
          const formatted = executor.formatResults(result);
          const comparison = executor.compareResults(formatted, problem.expectedResult ?? []);
          expect(comparison.match, comparison.differences.join('\n')).toBe(true);
        } finally {
          executor.close();
        }
      });
    }
  });

  describe(`Advanced (${byDifficulty.advanced.length} problems)`, () => {
    for (const problem of byDifficulty.advanced) {
      it(`${problem.id}: ${problem.title}`, async () => {
        const executor = new SQLExecutor();
        try {
          await executor.initialize(problem.schema);
          const result = await executor.executeQuery(problem.expectedQuery);
          expect(result.success).toBe(true);
          
          const formatted = executor.formatResults(result);
          const comparison = executor.compareResults(formatted, problem.expectedResult ?? []);
          expect(comparison.match, comparison.differences.join('\n')).toBe(true);
        } finally {
          executor.close();
        }
      });
    }
  });
});

/**
 * Concept coverage verification.
 * Ensures all concept types are tested.
 */
describe('SQL Problems - Concept Coverage', () => {
  it('verifies all problems have required fields', () => {
    for (const problem of sqlProblems) {
      expect(problem.id).toBeDefined();
      expect(problem.title).toBeDefined();
      expect(problem.description).toBeDefined();
      expect(problem.difficulty).toBeDefined();
      expect(problem.concepts).toBeDefined();
      expect(problem.schema).toBeDefined();
      expect(problem.expectedQuery).toBeDefined();
      expect(problem.expectedResult).toBeDefined();
    }
  });

  it('reports concept coverage statistics', () => {
    const conceptCounts: Record<string, number> = {};
    
    for (const problem of sqlProblems) {
      for (const concept of problem.concepts) {
        conceptCounts[concept] = (conceptCounts[concept] || 0) + 1;
      }
    }
    
    // Log for reporting (won't fail tests)
    // eslint-disable-next-line no-console
    console.log('Concept Coverage:', conceptCounts);
    
    // Verify we have at least some coverage of key concepts
    expect(Object.keys(conceptCounts).length).toBeGreaterThan(0);
  });

  it('verifies all 32 problems are present', () => {
    expect(sqlProblems.length).toBe(32);
    
    // Verify problem IDs are sequential
    for (let i = 1; i <= 32; i++) {
      const problem = getProblemById(`problem-${i}`);
      expect(problem).toBeDefined();
    }
  });
});

/**
 * Edge case tests for SQL executor behavior.
 */
describe('SQL Executor - Edge Cases', () => {
  it('handles empty result sets correctly', async () => {
    const executor = new SQLExecutor();
    
    try {
      await executor.initialize(`
        CREATE TABLE test (id INTEGER PRIMARY KEY, name TEXT);
        INSERT INTO test VALUES (1, 'Alice');
      `);
      
      // Query that returns no results
      const result = await executor.executeQuery("SELECT * FROM test WHERE name = 'NonExistent';");
      expect(result.success).toBe(true);
      expect(result.values).toEqual([]);
      
      const formatted = executor.formatResults(result);
      expect(formatted).toEqual([]);
      
    } finally {
      executor.close();
    }
  });

  it('handles single row results correctly', async () => {
    const executor = new SQLExecutor();
    
    try {
      await executor.initialize(`
        CREATE TABLE test (id INTEGER PRIMARY KEY, name TEXT);
        INSERT INTO test VALUES (1, 'Alice');
        INSERT INTO test VALUES (2, 'Bob');
      `);
      
      const result = await executor.executeQuery("SELECT * FROM test WHERE id = 1;");
      expect(result.success).toBe(true);
      expect(result.values?.length).toBe(1);
      
      const formatted = executor.formatResults(result);
      expect(formatted).toEqual([{ id: 1, name: 'Alice' }]);
      
    } finally {
      executor.close();
    }
  });

  it('handles floating point comparisons with epsilon tolerance', async () => {
    const executor = new SQLExecutor();
    
    try {
      await executor.initialize(`
        CREATE TABLE products (id INTEGER PRIMARY KEY, price REAL);
        INSERT INTO products VALUES (1, 10.333333);
        INSERT INTO products VALUES (2, 10.333334);
      `);
      
      const result = await executor.executeQuery("SELECT AVG(price) as avg_price FROM products;");
      expect(result.success).toBe(true);
      
      const formatted = executor.formatResults(result);
      
      // These should be within epsilon (0.01)
      const comparison = executor.compareResults(formatted, [{ avg_price: 10.3333335 }]);
      expect(comparison.match).toBe(true);
      
    } finally {
      executor.close();
    }
  });

  it('handles NULL value comparisons correctly', async () => {
    const executor = new SQLExecutor();
    
    try {
      await executor.initialize(`
        CREATE TABLE test (id INTEGER PRIMARY KEY, value INTEGER);
        INSERT INTO test VALUES (1, NULL);
        INSERT INTO test VALUES (2, 42);
      `);
      
      const result = await executor.executeQuery("SELECT * FROM test ORDER BY id;");
      expect(result.success).toBe(true);
      
      const formatted = executor.formatResults(result);
      expect(formatted[0].value).toBeNull();
      expect(formatted[1].value).toBe(42);
      
    } finally {
      executor.close();
    }
  });
});
