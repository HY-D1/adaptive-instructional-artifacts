#!/usr/bin/env tsx
/**
 * SQL Problem Content Audit Script
 * 
 * This script audits all SQL problems against their seeded schema/data
 * and expected results using sql.js (SQLite).
 */

import initSqlJs from 'sql.js';
import { sqlProblems } from '../apps/web/src/app/data/problems.js';

interface AuditResult {
  id: string;
  title: string;
  expectedQuery: string;
  status: 'PASS' | 'FAIL' | 'ERROR';
  computedResult: any[] | null;
  storedResult: any[];
  match: boolean;
  mismatchReason?: string;
  errorMessage?: string;
  details?: {
    rowCountMatch: boolean;
    computedRowCount: number;
    storedRowCount: number;
    columnMatch: boolean;
    computedColumns: string[];
    storedColumns: string[];
    valueMismatches: Array<{
      row: number;
      column: string;
      computed: any;
      stored: any;
      reason: string;
    }>;
  };
}

interface AuditReport {
  timestamp: string;
  totalProblems: number;
  passed: number;
  failed: number;
  errors: number;
  results: AuditResult[];
  summary: {
    contentErrors: string[];
    dataSchemaMismatches: string[];
    floatPrecisionIssues: string[];
  };
}

// Helper to normalize values for comparison
function normalizeValue(value: any): any {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') {
    // Round to 2 decimal places for float comparison
    return Math.round(value * 100) / 100;
  }
  if (typeof value === 'string') {
    // Normalize strings (trim whitespace)
    return value.trim();
  }
  return value;
}

// Deep compare two result sets
function compareResults(computed: any[], stored: any[]): { match: boolean; reason?: string; details: AuditResult['details'] } {
  const details: AuditResult['details'] = {
    rowCountMatch: computed.length === stored.length,
    computedRowCount: computed.length,
    storedRowCount: stored.length,
    columnMatch: true,
    computedColumns: computed.length > 0 ? Object.keys(computed[0]) : [],
    storedColumns: stored.length > 0 ? Object.keys(stored[0]) : [],
    valueMismatches: []
  };

  // Check row count
  if (computed.length !== stored.length) {
    return {
      match: false,
      reason: `Row count mismatch: computed ${computed.length} rows, expected ${stored.length} rows`,
      details
    };
  }

  // Check columns
  if (computed.length > 0 && stored.length > 0) {
    const computedCols = Object.keys(computed[0]).sort();
    const storedCols = Object.keys(stored[0]).sort();
    
    if (JSON.stringify(computedCols) !== JSON.stringify(storedCols)) {
      details.columnMatch = false;
      return {
        match: false,
        reason: `Column mismatch: computed [${computedCols.join(', ')}], expected [${storedCols.join(', ')}]`,
        details
      };
    }
  }

  // Compare each row
  for (let i = 0; i < computed.length; i++) {
    const compRow = computed[i];
    const storedRow = stored[i];
    
    for (const key of Object.keys(storedRow)) {
      const compVal = normalizeValue(compRow[key]);
      const storedVal = normalizeValue(storedRow[key]);
      
      if (compVal !== storedVal) {
        // Check if it's a float precision issue
        const isFloatIssue = typeof compVal === 'number' && typeof storedVal === 'number' &&
          Math.abs(compVal - storedVal) < 0.01;
        
        details.valueMismatches.push({
          row: i,
          column: key,
          computed: compVal,
          stored: storedVal,
          reason: isFloatIssue ? 'float_precision' : 'value_mismatch'
        });
      }
    }
  }

  if (details.valueMismatches.length > 0) {
    const nonFloatMismatches = details.valueMismatches.filter(m => m.reason !== 'float_precision');
    if (nonFloatMismatches.length > 0) {
      return {
        match: false,
        reason: `Value mismatch at row ${nonFloatMismatches[0].row}, column '${nonFloatMismatches[0].column}': computed ${JSON.stringify(nonFloatMismatches[0].computed)}, expected ${JSON.stringify(nonFloatMismatches[0].stored)}`,
        details
      };
    } else {
      // All mismatches are float precision issues - consider as float_precision issue but mark as pass
      return {
        match: true,
        reason: 'Float precision differences detected but within tolerance',
        details
      };
    }
  }

  return { match: true, details };
}

async function runAudit(): Promise<AuditReport> {
  const SQL = await initSqlJs();
  const results: AuditResult[] = [];
  
  const report: AuditReport = {
    timestamp: new Date().toISOString(),
    totalProblems: sqlProblems.length,
    passed: 0,
    failed: 0,
    errors: 0,
    results: [],
    summary: {
      contentErrors: [],
      dataSchemaMismatches: [],
      floatPrecisionIssues: []
    }
  };

  console.log(`🔍 Auditing ${sqlProblems.length} SQL problems...\n`);

  for (const problem of sqlProblems) {
    console.log(`Processing: ${problem.id} - ${problem.title}`);
    
    const result: AuditResult = {
      id: problem.id,
      title: problem.title,
      expectedQuery: problem.expectedQuery,
      status: 'ERROR',
      computedResult: null,
      storedResult: problem.expectedResult,
      match: false
    };

    try {
      // Create fresh database for each problem
      const db = new SQL.Database();
      
      // Execute schema setup
      const schemaStatements = problem.schema.split(';').filter(s => s.trim());
      for (const stmt of schemaStatements) {
        if (stmt.trim()) {
          try {
            db.run(stmt);
          } catch (e: any) {
            throw new Error(`Schema error: ${e.message}\nStatement: ${stmt}`);
          }
        }
      }
      
      // Execute the expected query
      const stmt = db.run(problem.expectedQuery);
      
      // Get results if it's a SELECT query
      if (problem.expectedQuery.trim().toLowerCase().startsWith('select')) {
        const stmt2 = db.prepare(problem.expectedQuery);
        const rows: any[] = [];
        while (stmt2.step()) {
          rows.push(stmt2.getAsObject());
        }
        stmt2.free();
        result.computedResult = rows;
        
        // Compare results
        const comparison = compareResults(rows, problem.expectedResult);
        result.match = comparison.match;
        result.details = comparison.details;
        
        if (comparison.match) {
          result.status = 'PASS';
          report.passed++;
          if (comparison.reason?.includes('Float precision')) {
            report.summary.floatPrecisionIssues.push(problem.id);
          }
        } else {
          result.status = 'FAIL';
          result.mismatchReason = comparison.reason;
          report.failed++;
          report.summary.contentErrors.push(problem.id);
        }
      } else {
        // For INSERT, UPDATE, DELETE - check for empty result
        result.computedResult = [];
        
        if (problem.expectedResult.length === 0) {
          result.status = 'PASS';
          result.match = true;
          report.passed++;
        } else {
          result.status = 'FAIL';
          result.mismatchReason = 'Expected non-empty result for non-SELECT query';
          report.failed++;
          report.summary.contentErrors.push(problem.id);
        }
      }
      
      db.close();
    } catch (error: any) {
      result.status = 'ERROR';
      result.errorMessage = error.message;
      report.errors++;
      report.summary.dataSchemaMismatches.push(problem.id);
    }
    
    results.push(result);
  }

  report.results = results;
  return report;
}

// Format results for console output
function printReport(report: AuditReport) {
  console.log('\n' + '='.repeat(80));
  console.log('AUDIT REPORT');
  console.log('='.repeat(80));
  console.log(`Timestamp: ${report.timestamp}`);
  console.log(`Total Problems: ${report.totalProblems}`);
  console.log(`✅ Passed: ${report.passed}`);
  console.log(`❌ Failed: ${report.failed}`);
  console.log(`💥 Errors: ${report.errors}`);
  console.log('');
  
  if (report.failed > 0 || report.errors > 0) {
    console.log('FAILURES & ERRORS:');
    console.log('-'.repeat(80));
    
    for (const result of report.results) {
      if (result.status === 'FAIL') {
        console.log(`\n❌ ${result.id}: ${result.title}`);
        console.log(`   Query: ${result.expectedQuery}`);
        console.log(`   Reason: ${result.mismatchReason}`);
        if (result.details) {
          console.log(`   Computed rows: ${result.details.computedRowCount}, Stored rows: ${result.details.storedRowCount}`);
          if (result.details.valueMismatches.length > 0) {
            console.log('   Value mismatches:');
            for (const vm of result.details.valueMismatches.slice(0, 3)) {
              console.log(`     Row ${vm.row}, ${vm.column}: computed=${JSON.stringify(vm.computed)}, stored=${JSON.stringify(vm.stored)}`);
            }
          }
        }
      } else if (result.status === 'ERROR') {
        console.log(`\n💥 ${result.id}: ${result.title}`);
        console.log(`   Error: ${result.errorMessage}`);
      }
    }
  }
  
  console.log('\n' + '='.repeat(80));
  console.log('SUMMARY:');
  console.log(`  Content errors (wrong expectedResult): ${report.summary.contentErrors.length > 0 ? report.summary.contentErrors.join(', ') : 'None'}`);
  console.log(`  Data/schema mismatches: ${report.summary.dataSchemaMismatches.length > 0 ? report.summary.dataSchemaMismatches.join(', ') : 'None'}`);
  console.log(`  Float precision issues: ${report.summary.floatPrecisionIssues.length > 0 ? report.summary.floatPrecisionIssues.join(', ') : 'None'}`);
  console.log('='.repeat(80));
}

// Main execution
async function main() {
  try {
    const report = await runAudit();
    printReport(report);
    
    // Write JSON report
    const fs = await import('fs');
    const reportPath = '/Users/HiMini/Desktop/Personal Portfolio/adaptive-instructional-artifacts/audit-results/problem-content-audit.json';
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`\n📄 Full report written to: ${reportPath}`);
    
    // Exit with error code if there are failures
    process.exit(report.failed + report.errors > 0 ? 1 : 0);
  } catch (error: any) {
    console.error('Audit failed:', error);
    process.exit(1);
  }
}

main();
