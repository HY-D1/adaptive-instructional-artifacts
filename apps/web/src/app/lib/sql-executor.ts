import initSqlJs, { Database } from 'sql.js';
import { normalizeSqlErrorSubtype } from '../data/sql-engage';

// Use the middleware-served WASM path for stability
// This aligns with the wasm-serve plugin in vite.config.ts
const WASM_URL = '/sql-wasm.wasm';

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
    return Math.abs(actualNum - expectedNum) < FLOAT_EPSILON;
  }

  // Fall back to string normalization
  return normalizeValue(actual) === normalizeValue(expected);
}

let SQL: any = null;
let sqlInitializationPromise: Promise<any> | null = null;
let sqlInitializationError: Error | null = null;

/**
 * Error thrown when SQL.js initialization fails
 */
export class SQLInitializationError extends Error {
  constructor(
    message: string,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = 'SQLInitializationError';
  }
}

/**
 * Check if an error is a WebAssembly compilation error
 */
function isWasmCompilationError(error: Error): boolean {
  const message = error.message || '';
  return message.includes('magic word') || 
         message.includes('CompileError') ||
         message.includes('WebAssembly') ||
         message.includes('expected');
}

/**
 * Reset the SQL initialization state to allow retry
 * Called when user clicks "Reload Page" or when we want to force re-initialization
 */
export function resetSQLInitialization() {
  SQL = null;
  sqlInitializationPromise = null;
  sqlInitializationError = null;
  console.log('[sql.js] Initialization state reset');
}

export async function initializeSQL() {
  // Return existing instance if available
  if (SQL) {
    return SQL;
  }
  
  // Return existing promise if initialization is in progress
  if (sqlInitializationPromise) {
    return sqlInitializationPromise;
  }
  
  // If we previously failed, reset state to allow retry
  // This enables auto-retry behavior when the user tries again
  if (sqlInitializationError) {
    resetSQLInitialization();
  }
  
  // Start new initialization and track the promise
  // Uses the middleware-served /sql-wasm.wasm endpoint for stability
  sqlInitializationPromise = (async () => {
    try {
      console.log('[sql.js] Initializing with middleware-served WASM...');
      const sql = await initSqlJs({
        locateFile: (file) => {
          // Use the middleware-served WASM path for reliability
          if (file.endsWith('.wasm')) {
            console.log(`[sql.js] Using served WASM: ${WASM_URL}`);
            return WASM_URL;
          }
          return file;
        }
      });
      SQL = sql;
      sqlInitializationError = null;
      console.log('[sql.js] Successfully initialized with bundled WASM');
      return sql;
    } catch (err) {
      const lastError = err as Error;
      console.error('[sql.js] WASM initialization failed:', err);
      
      // Provide helpful error message based on error type
      let userMessage = 'Failed to initialize SQL engine. ';
      
      if (isWasmCompilationError(lastError)) {
        userMessage += 'The database file could not be loaded. This may be due to: ' +
          '(1) Browser security settings blocking WebAssembly, ' +
          '(2) The WASM file not being found at the expected location, or ' +
          '(3) An incompatible browser version. ' +
          'Please try refreshing the page or using a different browser.';
      } else if (lastError.message?.includes('fetch') || lastError.message?.includes('network')) {
        userMessage += 'Network error while loading the SQL engine. ' +
          'Please check your internet connection and try again.';
      } else {
        userMessage += lastError.message || 'Unknown error occurred.';
      }
      
      // Store the error and reset promise so we can retry on next call
      sqlInitializationError = lastError || new Error('Unknown initialization error');
      sqlInitializationPromise = null; // Reset promise to allow retry
      
      throw new SQLInitializationError(userMessage, lastError);
    }
  })();
  
  return sqlInitializationPromise;
}

/**
 * Result of executing a single SQL statement
 */
export interface SingleQueryResult {
  /** Column names from the query */
  columns: string[];
  /** Row values as arrays */
  values: unknown[][];
}

/**
 * Result of executing a SQL query
 */
export interface QueryResult {
  /** Whether execution succeeded */
  success: boolean;
  /** Column names (when successful) */
  columns?: string[];
  /** Row values (when successful) */
  values?: unknown[][];
  /** All result sets for multi-statement queries */
  allResults?: SingleQueryResult[];
  /** Error message (when failed) */
  error?: string;
  /** Normalized error subtype ID */
  errorSubtypeId?: string;
  /** Execution time in milliseconds */
  executionTime?: number;
}

/**
 * SQL query executor using sql.js
 * 
 * Features:
 * - Schema initialization
 * - Query execution with error handling
 * - Result formatting and comparison
 * - SQL comment stripping
 */
export class SQLExecutor {
  private db: Database | null = null;

  /**
   * SQL comment removal
   * - Single-line comments: -- comment (but not inside string literals)
   * - Multi-line comments: /* comment *\/
   */
  private stripComments(sql: string): string {
    let result = '';
    let i = 0;
    
    while (i < sql.length) {
      // Check for string literals
      if (sql[i] === "'" || sql[i] === '"') {
        const quote = sql[i];
        result += sql[i];
        i++;
        // Copy everything until closing quote (handling escaped quotes)
        while (i < sql.length) {
          if (sql[i] === quote) {
            // Check for escaped quote (e.g., '')
            if (i + 1 < sql.length && sql[i + 1] === quote) {
              result += sql[i];
              i++;
            } else {
              break;
            }
          }
          result += sql[i];
          i++;
        }
        if (i < sql.length) {
          result += sql[i]; // closing quote
          i++;
        }
        continue;
      }
      
      // Check for multi-line comment start
      if (sql[i] === '/' && i + 1 < sql.length && sql[i + 1] === '*') {
        // Skip until */
        i += 2;
        while (i < sql.length - 1) {
          if (sql[i] === '*' && sql[i + 1] === '/') {
            i += 2;
            result += ' '; // Replace comment with space
            break;
          }
          i++;
        }
        continue;
      }
      
      // Check for single-line comment (only if not in string)
      if (sql[i] === '-' && i + 1 < sql.length && sql[i + 1] === '-') {
        // Skip until end of line
        while (i < sql.length && sql[i] !== '\n') {
          i++;
        }
        result += '\n';
        if (i < sql.length) i++;
        continue;
      }
      
      result += sql[i];
      i++;
    }
    
    return result.trim();
  }

  /**
   * Initialize the database with a schema
   * @param schema - SQL DDL statements to create tables
   */
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
  /**
   * Execute a SQL query against the initialized database
   * @param query - SQL query to execute
   * @returns Query result with data or error info
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
  /**
   * Format query results into an array of objects
   * @param result - Query result from executeQuery
   * @returns Array of row objects with column names as keys
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
  /**
   * Compare actual and expected query results
   * Uses set-based comparison (order-independent)
   * @param actual - Actual query results
   * @param expected - Expected query results
   * @returns Comparison result with match flag and differences
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

  /**
   * Close the database connection and free resources
   */
  close() {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }
}
