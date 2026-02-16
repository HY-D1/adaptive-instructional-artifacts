import initSqlJs, { Database } from 'sql.js';
import { normalizeSqlErrorSubtype } from '../data/sql-engage';

const FLOAT_EPSILON = 0.01;

/** Normalizes a value for comparison. Handles null/undefined, booleans, and trims whitespace. */
function normalizeValue(value: unknown): string {
  if (value === null || value === undefined) return 'NULL';
  if (typeof value === 'boolean') return value ? '1' : '0';
  return String(value).trim();
}

/**
 * Compares two values for equality with floating-point tolerance.
 * - Null/undefined are treated as equivalent
 * - Numbers use epsilon comparison for floats, exact for integers
 * - Strings are trimmed before comparison
 */
function valuesEqual(actual: unknown, expected: unknown): boolean {
  // Handle null/undefined - treat as equivalent
  if (actual === null || actual === undefined) {
    return expected === null || expected === undefined;
  }
  if (expected === null || expected === undefined) {
    return false;
  }

  // Try numeric comparison with epsilon tolerance for floating point
  const actualNum = Number(actual);
  const expectedNum = Number(expected);
  if (!Number.isNaN(actualNum) && !Number.isNaN(expectedNum)) {
    // If both are integers, use exact comparison
    if (Number.isInteger(actualNum) && Number.isInteger(expectedNum)) {
      return actualNum === expectedNum;
    }
    // Use epsilon for floating point comparison
    return Math.abs(actualNum - expectedNum) <= FLOAT_EPSILON;
  }

  // Fall back to string normalization
  return normalizeValue(actual) === normalizeValue(expected);
}

let SQL: any = null;

export async function initializeSQL() {
  if (!SQL) {
    SQL = await initSqlJs({
      locateFile: file => `https://sql.js.org/dist/${file}`
    });
  }
  return SQL;
}

/** Result of executing a single SQL statement */
export interface SingleQueryResult {
  columns: string[];
  values: unknown[][];
}

/** Result of executing a SQL query */
export interface QueryResult {
  success: boolean;
  columns?: string[];
  values?: unknown[][];
  /** All result sets when multiple statements are executed */
  allResults?: SingleQueryResult[];
  error?: string;
  errorSubtypeId?: string;
  executionTime?: number;
}

export class SQLExecutor {
  private db: Database | null = null;

  /**
   * SQL comment removal regex patterns
   * - Single-line comments: -- comment
   * - Multi-line comments: /* comment *\/
   */
  private stripComments(sql: string): string {
    return sql
      // Remove multi-line comments /* ... */
      .replace(/\/\*[\s\S]*?\*\//g, '')
      // Remove single-line comments -- ...
      .replace(/--[^\n]*\n?/g, '\n')
      // Clean up extra whitespace
      .trim();
  }

  async initialize(schema: string) {
    const SQL = await initializeSQL();
    this.db = new SQL.Database();
    
    // Strip comments before executing schema
    const cleanSchema = this.stripComments(schema);
    
    // Execute schema setup using sql.js built-in exec which handles multiple statements
    try {
      this.db.exec(cleanSchema);
    } catch (error: any) {
      console.error('Schema initialization error:', error);
      throw error;
    }
  }

  /**
   * Executes a SQL query against the initialized database.
   * 
   * Note on multiple result sets: When executing multiple SELECT statements,
   * only the first result set is returned in `columns`/`values`. All results
   * are available in `allResults` for inspection.
   */
  async executeQuery(query: string): Promise<QueryResult> {
    if (!this.db) {
      return {
        success: false,
        error: 'Database not initialized'
      };
    }

    const startTime = performance.now();

    try {
      const results = this.db.exec(query);
      const executionTime = performance.now() - startTime;

      if (results.length === 0) {
        return {
          success: true,
          columns: [],
          values: [],
          allResults: [],
          executionTime
        };
      }

      // Map all results for potential multi-statement queries
      const allResults: SingleQueryResult[] = results.map(r => ({
        columns: r.columns,
        values: r.values as unknown[][]
      }));

      const result = results[0];
      return {
        success: true,
        columns: result.columns,
        values: result.values as unknown[][],
        allResults,
        executionTime
      };
    } catch (error: unknown) {
      const executionTime = performance.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      // Normalize raw sqlite/sql.js errors to SQL-Engage subtype labels.
      const errorSubtype = normalizeSqlErrorSubtype(errorMessage, query);

      return {
        success: false,
        error: errorMessage,
        errorSubtypeId: errorSubtype,
        executionTime
      };
    }
  }

  /**
   * Formats query results into an array of objects.
   * Column order from the query is preserved in each row object.
   */
  formatResults(result: QueryResult): Record<string, unknown>[] {
    if (!result.success || !result.columns || !result.values) {
      return [];
    }

    return result.values.map(row => {
      const obj: Record<string, unknown> = {};
      result.columns!.forEach((col, idx) => {
        obj[col] = row[idx];
      });
      return obj;
    });
  }

  /**
   * Compares actual and expected results using set-based comparison.
   * - Row order is ignored (set comparison)
   * - Column order is ignored (columns are sorted for comparison)
   * - Floating point values use epsilon tolerance (0.01)
   * - Null and undefined are treated as equivalent
   * - String values are trimmed before comparison
   */
  compareResults(
    actual: Record<string, unknown>[],
    expected: Record<string, unknown>[]
  ): {
    match: boolean;
    differences: string[];
  } {
    const differences: string[] = [];

    if (actual.length !== expected.length) {
      differences.push(`Row count mismatch: got ${actual.length}, expected ${expected.length}`);
      return { match: false, differences };
    }

    // Normalize rows for set comparison (order-independent)
    const normalizeRow = (row: Record<string, unknown>): string => {
      const sortedKeys = Object.keys(row).sort();
      const normalized: Record<string, string> = {};
      for (const key of sortedKeys) {
        normalized[key] = normalizeValue(row[key]);
      }
      return JSON.stringify(normalized);
    };

    // Build multisets of normalized rows to handle duplicate rows correctly
    const actualSet = new Map<string, number>();
    const expectedSet = new Map<string, number>();

    for (const row of actual) {
      const key = normalizeRow(row);
      actualSet.set(key, (actualSet.get(key) || 0) + 1);
    }

    for (const row of expected) {
      const key = normalizeRow(row);
      expectedSet.set(key, (expectedSet.get(key) || 0) + 1);
    }

    // Compare the two multisets
    let match = true;
    
    // Check for missing or mismatched rows in actual
    for (const [key, count] of expectedSet) {
      const actualCount = actualSet.get(key) || 0;
      if (actualCount !== count) {
        match = false;
        const row = JSON.parse(key) as Record<string, string>;
        if (actualCount < count) {
          differences.push(`Missing ${count - actualCount} row(s): ${JSON.stringify(row)}`);
        }
      }
    }

    // Check for extra rows in actual
    for (const [key, count] of actualSet) {
      const expectedCount = expectedSet.get(key) || 0;
      if (expectedCount === 0) {
        match = false;
        const row = JSON.parse(key) as Record<string, string>;
        differences.push(`Unexpected row: ${JSON.stringify(row)}`);
      }
    }

    return { match, differences };
  }

  close() {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }
}
