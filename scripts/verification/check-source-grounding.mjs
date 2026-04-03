#!/usr/bin/env node
/**
 * Source Grounding Verification Script
 * 
 * Checks that concept registry source references can be resolved
 * to actual PDF chunks, making groundedness auditable.
 * 
 * Usage:
 *   node scripts/check-source-grounding.mjs
 * 
 * Exit codes:
 *   0 - All sources grounded (or no critical issues)
 *   1 - Unresolved source references found
 */

import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');

// Colors for terminal output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  gray: '\x1b[90m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

// Load concept registry
function loadConceptRegistry() {
  const registryPath = join(rootDir, 'apps/web/src/app/data/concept-registry.json');
  if (!existsSync(registryPath)) {
    log('❌ Concept registry not found', 'red');
    process.exit(1);
  }
  
  try {
    const content = readFileSync(registryPath, 'utf-8');
    return JSON.parse(content);
  } catch (err) {
    log(`❌ Failed to parse concept registry: ${err.message}`, 'red');
    process.exit(1);
  }
}

// Load PDF index if exists
function loadPdfIndex() {
  // Check multiple possible locations
  const possiblePaths = [
    join(rootDir, 'dist/pdf-index/index.json'),
    join(rootDir, 'public/pdf-index/index.json'),
    join(rootDir, 'apps/web/public/pdf-index/index.json')
  ];
  
  for (const indexPath of possiblePaths) {
    if (existsSync(indexPath)) {
      try {
        const content = readFileSync(indexPath, 'utf-8');
        return JSON.parse(content);
      } catch {
        continue;
      }
    }
  }
  
  return null;
}

// Build chunk lookup index
function buildChunkIndex(pdfIndex) {
  const index = new Map();
  
  if (!pdfIndex?.chunks) {
    return index;
  }
  
  for (const chunk of pdfIndex.chunks) {
    if (!index.has(chunk.docId)) {
      index.set(chunk.docId, []);
    }
    index.get(chunk.docId).push(chunk);
  }
  
  return index;
}

// Find chunks for a source ref
function findChunksForSourceRef(sourceRef, chunkIndex) {
  const docChunks = chunkIndex.get(sourceRef.docId);
  if (!docChunks) return [];
  
  return docChunks.filter(chunk => chunk.page === sourceRef.page);
}

// Main verification
function verifySourceGrounding() {
  log('\n📚 Source Grounding Verification\n', 'blue');
  
  const registry = loadConceptRegistry();
  const pdfIndex = loadPdfIndex();
  
  log(`Concept registry: ${registry.schemaVersion}`);
  log(`Total concepts: ${registry.totalConcepts}`);
  log(`Verified concepts: ${registry.verifiedCount}\n`);
  
  if (!pdfIndex) {
    log('⚠️  PDF index not found - cannot verify grounding', 'yellow');
    log('   Expected locations:', 'gray');
    log('   - dist/pdf-index/index.json', 'gray');
    log('   - public/pdf-index/index.json', 'gray');
    log('\nRun: npm run pdf:index  # to build the index\n');
    return { passed: false, reason: 'no-index' };
  }
  
  log(`PDF index: ${pdfIndex.schemaVersion || 'unknown'}`);
  log(`Source docs: ${pdfIndex.docCount || pdfIndex.sourceDocs?.length || 0}`);
  log(`Total chunks: ${pdfIndex.chunkCount || pdfIndex.chunks?.length || 0}\n`);
  
  const chunkIndex = buildChunkIndex(pdfIndex);
  const availableDocIds = new Set(chunkIndex.keys());
  
  log('Available docIds:', 'gray');
  for (const docId of availableDocIds) {
    const chunks = chunkIndex.get(docId);
    log(`  - ${docId}: ${chunks.length} chunks`, 'gray');
  }
  log('');
  
  // Check each source ref
  let totalSourceRefs = 0;
  let resolvedSourceRefs = 0;
  const unresolved = [];
  const orphanedDocIds = new Set();
  
  for (const concept of registry.concepts) {
    for (const ref of concept.sourceRefs) {
      totalSourceRefs++;
      
      const chunks = findChunksForSourceRef(ref, chunkIndex);
      
      if (chunks.length > 0) {
        resolvedSourceRefs++;
      } else {
        unresolved.push({
          conceptId: concept.conceptId,
          docId: ref.docId,
          page: ref.page,
          reason: !availableDocIds.has(ref.docId) ? 'doc-not-found' : 'page-not-found'
        });
        
        if (!availableDocIds.has(ref.docId)) {
          orphanedDocIds.add(ref.docId);
        }
      }
    }
  }
  
  // Report results
  const coveragePercentage = totalSourceRefs > 0
    ? Math.round((resolvedSourceRefs / totalSourceRefs) * 100)
    : 0;
  
  log('📊 Grounding Results\n', 'blue');
  log(`Total source references: ${totalSourceRefs}`);
  log(`Resolved to PDF chunks: ${resolvedSourceRefs}`);
  log(`Coverage: ${coveragePercentage}%\n`);
  
  // Coverage assessment
  if (coveragePercentage >= 90) {
    log('✅ Excellent grounding coverage', 'green');
  } else if (coveragePercentage >= 70) {
    log('⚠️  Good grounding coverage, but some gaps remain', 'yellow');
  } else if (coveragePercentage >= 50) {
    log('⚠️  Partial grounding coverage', 'yellow');
  } else {
    log('❌ Poor grounding coverage', 'red');
  }
  
  // Unresolved details
  if (unresolved.length > 0) {
    log(`\n❌ Unresolved references (${unresolved.length}):\n`, 'red');
    
    // Group by concept
    const byConcept = new Map();
    for (const u of unresolved) {
      if (!byConcept.has(u.conceptId)) {
        byConcept.set(u.conceptId, []);
      }
      byConcept.get(u.conceptId).push(u);
    }
    
    for (const [conceptId, refs] of byConcept) {
      log(`  ${conceptId}:`, 'yellow');
      for (const ref of refs) {
        const reason = ref.reason === 'doc-not-found' 
          ? '(document not in index)' 
          : '(page not found)';
        log(`    - ${ref.docId} page ${ref.page} ${reason}`, 'gray');
      }
    }
  }
  
  // Orphaned docIds
  if (orphanedDocIds.size > 0) {
    log(`\n⚠️  Documents referenced but not in PDF index:\n`, 'yellow');
    for (const docId of orphanedDocIds) {
      log(`  - ${docId}`, 'gray');
    }
    log('\nPossible fixes:', 'gray');
    log('  1. Add PDF_DOC_ALIASES mapping in pdf-index-config.ts', 'gray');
    log('  2. Rename PDF file to match expected docId', 'gray');
    log('  3. Update concept registry docIds', 'gray');
  }
  
  // Recommendations
  log('\n💡 Recommendations:\n', 'blue');
  if (coveragePercentage < 100) {
    log('1. Ensure PDF files are named consistently with concept registry', 'gray');
    log('2. Run: npm run pdf:index  # to rebuild index with aliases', 'gray');
    log('3. Check PDF_DOC_ALIASES in pdf-index-config.ts', 'gray');
  } else {
    log('✅ All source references are grounded!', 'green');
  }
  
  log('');
  
  return {
    passed: coveragePercentage >= 90,
    coveragePercentage,
    totalSourceRefs,
    resolvedSourceRefs,
    unresolved
  };
}

// Run verification
const results = verifySourceGrounding();

// Exit with appropriate code
process.exit(results.passed ? 0 : 1);
