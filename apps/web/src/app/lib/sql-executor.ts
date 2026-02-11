import initSqlJs, { Database } from 'sql.js';
import { normalizeSqlErrorSubtype } from '../data/sql-engage';

let SQL: any = null;

export async function initializeSQL() {
  if (!SQL) {
    SQL = await initSqlJs({
      locateFile: file => `https://sql.js.org/dist/${file}`
    });
  }
  return SQL;
}

export interface QueryResult {
  success: boolean;
  columns?: string[];
  values?: any[][];
  error?: string;
  errorSubtypeId?: string;
  executionTime?: number;
}

export class SQLExecutor {
  private db: Database | null = null;

  async initialize(schema: string) {
    const SQL = await initializeSQL();
    this.db = new SQL.Database();
    
    // Execute schema setup
    try {
      const statements = schema.split(';').filter(s => s.trim());
      for (const stmt of statements) {
        if (stmt.trim()) {
          this.db.run(stmt);
        }
      }
    } catch (error: any) {
      console.error('Schema initialization error:', error);
      throw error;
    }
  }

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
          executionTime
        };
      }

      const result = results[0];
      return {
        success: true,
        columns: result.columns,
        values: result.values,
        executionTime
      };
    } catch (error: any) {
      const executionTime = performance.now() - startTime;
      const errorMessage = error.message || String(error);
      
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

  formatResults(result: QueryResult): any[] {
    if (!result.success || !result.columns || !result.values) {
      return [];
    }

    return result.values.map(row => {
      const obj: any = {};
      result.columns!.forEach((col, idx) => {
        obj[col] = row[idx];
      });
      return obj;
    });
  }

  compareResults(actual: any[], expected: any[]): {
    match: boolean;
    differences: string[];
  } {
    const differences: string[] = [];

    if (actual.length !== expected.length) {
      differences.push(`Row count mismatch: got ${actual.length}, expected ${expected.length}`);
      return { match: false, differences };
    }

    // Compare each row
    for (let i = 0; i < actual.length; i++) {
      const actualRow = actual[i];
      const expectedRow = expected[i];

      const actualKeys = Object.keys(actualRow).sort();
      const expectedKeys = Object.keys(expectedRow).sort();

      if (JSON.stringify(actualKeys) !== JSON.stringify(expectedKeys)) {
        differences.push(`Row ${i}: Column mismatch`);
        continue;
      }

      for (const key of actualKeys) {
        if (actualRow[key] !== expectedRow[key]) {
          differences.push(`Row ${i}, Column ${key}: got ${actualRow[key]}, expected ${expectedRow[key]}`);
        }
      }
    }

    return {
      match: differences.length === 0,
      differences
    };
  }

  close() {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }
}
