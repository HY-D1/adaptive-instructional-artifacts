#!/usr/bin/env node
/**
 * Smoke Test: PDF Index Build + Query
 * 
 * This script tests the full PDF indexing pipeline:
 * 1. Creates a sample PDF
 * 2. Builds an index (first time - should create)
 * 3. Builds again (should skip - same checksum)
 * 4. Forces rebuild
 * 5. Queries the index
 * 6. Validates results
 * 
 * Run: node scripts/smoke-test-pdf-index.mjs
 */

import { execFile } from 'node:child_process';
import { writeFile, mkdir, rm, readFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const TEST_DIR = resolve(process.cwd(), 'test-output');
const SAMPLE_PDF_PATH = join(TEST_DIR, 'sample-textbook.pdf');
const INDEX_DIR = join(TEST_DIR, 'pdf-index');

let testsPassed = 0;
let testsFailed = 0;

function log(section, message) {
  console.log(`[${section}] ${message}`);
}

function assert(condition, message) {
  if (condition) {
    testsPassed++;
    console.log(`  ✅ ${message}`);
  } else {
    testsFailed++;
    console.log(`  ❌ ${message}`);
  }
}

// Create a minimal PDF with SQL content using the working format
async function createSamplePdf() {
  log('SETUP', 'Creating sample PDF...');
  
  await mkdir(TEST_DIR, { recursive: true });
  
  // PDF with SQL content (format compatible with pdftotext)
  const pdfContent = `%PDF-1.4
1 0 obj
<<
/Type /Catalog
/Pages 2 0 R
>>
endobj

2 0 obj
<<
/Type /Pages
/Kids [3 0 R 4 0 R]
/Count 2
>>
endobj

3 0 obj
<<
/Type /Page
/Parent 2 0 R
/MediaBox [0 0 612 792]
/Contents 5 0 R
/Resources << /Font << /F1 6 0 R >> >>
>>
endobj

4 0 obj
<<
/Type /Page
/Parent 2 0 R
/MediaBox [0 0 612 792]
/Contents 7 0 R
/Resources << /Font << /F1 6 0 R >> >>
>>
endobj

5 0 obj
<< /Length 300 >>
stream
BT
/F1 14 Tf
50 720 Td
(CHAPTER 1: SQL BASICS) Tj
0 -25 Td
/F1 11 Tf
(SELECT statements retrieve data from tables.) Tj
0 -20 Td
(Use WHERE clauses to filter rows with conditions.) Tj
0 -20 Td
(AND and OR operators combine multiple filters.) Tj
ET
endstream
endobj

7 0 obj
<< /Length 280 >>
stream
BT
/F1 14 Tf
50 720 Td
(CHAPTER 2: ADVANCED QUERIES) Tj
0 -25 Td
/F1 11 Tf
(JOIN operations combine multiple tables.) Tj
0 -20 Td
(INNER JOIN and LEFT JOIN are common types.) Tj
0 -20 Td
(GROUP BY aggregates data into summaries.) Tj
ET
endstream
endobj

6 0 obj
<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>
endobj

xref
0 8
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000265 00000 n 
0000000415 00000 n 
0000000767 00000 n 
0000000837 00000 n 
trailer
<< /Size 8 /Root 1 0 R >>
startxref
1169
%%EOF`;
  
  await writeFile(SAMPLE_PDF_PATH, pdfContent, 'binary');
  log('SETUP', `Sample PDF created: ${SAMPLE_PDF_PATH}`);
  
  // Verify PDF is readable
  try {
    const { execFile } = await import('node:child_process');
    const { promisify } = await import('node:util');
    const execFileAsync = promisify(execFile);
    const { stdout } = await execFileAsync('pdftotext', [SAMPLE_PDF_PATH, '-']);
    const pageCount = stdout.split('\f').filter(p => p.trim()).length;
    log('SETUP', `PDF verified: ${pageCount} page(s) with text content`);
  } catch (e) {
    log('SETUP', `Warning: PDF verification failed: ${e.message}`);
  }
}

async function runBuild(args = []) {
  const { stdout, stderr } = await execFileAsync(
    'node',
    ['scripts/pdf-to-index.mjs', SAMPLE_PDF_PATH, '--output-dir', INDEX_DIR, ...args],
    { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 }
  );
  
  // Logs go to stderr, JSON result goes to stdout
  const output = stderr;
  
  // Parse JSON from stdout (find JSON object)
  let result = null;
  const jsonMatch = stdout.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      result = JSON.parse(jsonMatch[0]);
    } catch {
      // Ignore parse error
    }
  }
  
  return { output, result };
}

async function runQuery(queryStr, args = []) {
  const { stdout, stderr } = await execFileAsync(
    'node',
    ['scripts/query-index.mjs', INDEX_DIR, queryStr, ...args],
    { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 }
  );
  
  // JSON result is in stdout (find JSON object)
  const jsonMatch = stdout.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      return JSON.parse(jsonMatch[0]);
    } catch {
      // Ignore parse error
    }
  }
  return null;
}

async function testFirstBuild() {
  log('TEST 1', 'First build (should create new index)');
  
  const { output, result } = await runBuild();
  
  assert(result?.status === 'built', 'Status is "built"');
  assert(result?.isNew === true, 'isNew flag is true');
  assert(result?.indexId?.startsWith('pdf-index-'), 'Has valid index ID');
  assert(result?.pageCount === 2, 'Detected 2 pages');
  assert(result?.chunkCount >= 1, 'Has at least 1 chunk');
  assert(output.includes('INDEX BUILD COMPLETE'), 'Shows completion message');
  assert(output.includes('SHA256:'), 'Shows checksum');
}

async function testIncrementalSkip() {
  log('TEST 2', 'Incremental build (should skip - same checksum)');
  
  const { output, result } = await runBuild();
  
  assert(result?.status === 'skipped', 'Status is "skipped"');
  assert(result?.isNew === false, 'isNew flag is false');
  assert(output.includes('INDEX ALREADY EXISTS'), 'Shows skip message');
  assert(output.includes('Use --force to rebuild'), 'Suggests --force option');
}

async function testForceRebuild() {
  log('TEST 3', 'Force rebuild');
  
  const { output, result } = await runBuild(['--force']);
  
  assert(result?.status === 'built', 'Status is "built"');
  assert(result?.isNew === true, 'isNew flag is true');
  assert(output.includes('Force rebuild enabled'), 'Acknowledges --force');
}

async function testQuery() {
  log('TEST 4', 'Query index - basic');
  
  const result = await runQuery('SELECT WHERE clauses');
  
  assert(result?.query === 'SELECT WHERE clauses', 'Query preserved');
  assert(Array.isArray(result?.results), 'Results is array');
  assert(result?.results.length > 0, 'Has at least 1 result');
  assert(result?.results[0]?.page === 1, 'First result from page 1');
  assert(typeof result?.results[0]?.score === 'number', 'Has score');
  assert(typeof result?.queryTimeMs === 'number', 'Query time recorded');
}

async function testQueryTopK() {
  log('TEST 5', 'Query with --top-k');
  
  const result = await runQuery('JOIN', ['--top-k', '2']);
  
  assert(result?.topK === 2, 'Top-K is 2');
  assert(result?.results.length <= 2, 'Results limited to 2');
  assert(result?.results.some(r => r.page === 2), 'Includes page 2 results');
}

async function testQueryResultsContent() {
  log('TEST 6', 'Query results have proper citations');
  
  const result = await runQuery('GROUP BY');
  
  const firstResult = result?.results?.[0];
  assert(result?.results.some(r => r.page === 2), 'Includes results from page 2');
  assert(firstResult?.snippet?.length > 0, 'Has text snippet');
  assert(firstResult?.score > 0, 'Has positive score');
}

async function cleanup() {
  log('CLEANUP', 'Removing test files...');
  try {
    await rm(TEST_DIR, { recursive: true, force: true });
    log('CLEANUP', 'Test files removed');
  } catch (e) {
    log('CLEANUP', `Warning: ${e.message}`);
  }
}

async function main() {
  console.log('');
  console.log('========================================');
  console.log('PDF Index Smoke Test');
  console.log('========================================');
  console.log('');
  
  try {
    // Setup
    await createSamplePdf();
    
    // Run tests
    await testFirstBuild();
    await testIncrementalSkip();
    await testForceRebuild();
    await testQuery();
    await testQueryTopK();
    await testQueryResultsContent();
    
    // Summary
    console.log('');
    console.log('========================================');
    console.log('Test Summary');
    console.log('========================================');
    console.log(`Passed: ${testsPassed}`);
    console.log(`Failed: ${testsFailed}`);
    console.log('');
    
    if (testsFailed > 0) {
      process.exit(1);
    }
    
    console.log('✅ All tests passed!');
    
  } finally {
    await cleanup();
  }
}

main().catch(error => {
  console.error('Fatal error:', error.message);
  process.exit(1);
});
