/**
 * SourceRef Lookup Module
 * 
 * Bridges semantic chunkIds (e.g., "ch2-select-basics") from concept registry
 * with physical PDF chunks (e.g., "sql-textbook:p24:c1").
 * 
 * Uses page numbers as the common reference point for lookup.
 */

import { storage } from './storage';
import { PdfIndexChunk } from '../types';

/**
 * Retrieved source passage with actual text content
 */
export type RetrievedSourcePassage = {
  passageId: string;
  conceptId: string;
  docId: string;
  chunkId: string;
  page: number;
  text: string;
  whyIncluded: string;
};

/**
 * Source reference from concept registry
 */
export type ConceptSourceRef = {
  docId: string;
  chunkId: string;
  page: number;
  passageId?: string;
};

/**
 * Lookup result with match status
 */
export type SourceLookupResult = {
  found: boolean;
  passage?: RetrievedSourcePassage;
  error?: string;
};

/**
 * Chunk lookup index for efficient retrieval
 * Built on-demand and cached
 */
let chunkLookupCache: Map<string, PdfIndexChunk[]> | null = null;
let cacheBuildTime = 0;
const CACHE_TTL_MS = 30000; // 30 seconds

/**
 * Build or get cached chunk lookup index
 * Indexed by docId for fast retrieval
 */
function getChunkLookupIndex(): Map<string, PdfIndexChunk[]> {
  const now = Date.now();
  
  // Return cached index if still valid
  if (chunkLookupCache && (now - cacheBuildTime) < CACHE_TTL_MS) {
    return chunkLookupCache;
  }
  
  // Build new index
  const index = new Map<string, PdfIndexChunk[]>();
  const pdfIndex = storage.getPdfIndex();
  
  if (!pdfIndex?.chunks) {
    return index;
  }
  
  for (const chunk of pdfIndex.chunks) {
    if (!index.has(chunk.docId)) {
      index.set(chunk.docId, []);
    }
    index.get(chunk.docId)!.push(chunk);
  }
  
  // Sort chunks by page and chunkIndex for consistent ordering
  for (const [, chunks] of index) {
    chunks.sort((a, b) => {
      if (a.page !== b.page) return a.page - b.page;
      return a.chunkId.localeCompare(b.chunkId);
    });
  }
  
  chunkLookupCache = index;
  cacheBuildTime = now;
  
  return index;
}

/**
 * Invalidate chunk lookup cache
 * Call this when PDF index is updated
 */
export function invalidateChunkLookupCache(): void {
  chunkLookupCache = null;
  cacheBuildTime = 0;
}

/**
 * Find PDF chunks matching a concept source reference
 * Uses page number as the primary lookup key
 * 
 * @param sourceRef - Source reference from concept registry
 * @returns Array of matching chunks (usually 1-2 chunks per page)
 */
export function findChunksForSourceRef(sourceRef: ConceptSourceRef): PdfIndexChunk[] {
  const index = getChunkLookupIndex();
  const docChunks = index.get(sourceRef.docId);
  
  if (!docChunks || docChunks.length === 0) {
    return [];
  }
  
  // Find chunks on the specified page
  // This bridges semantic chunkIds with physical PDF chunks
  return docChunks.filter(chunk => chunk.page === sourceRef.page);
}

/**
 * Retrieve actual text content for a source reference
 * 
 * @param sourceRef - Source reference from concept registry
 * @param conceptId - Associated concept ID
 * @returns Lookup result with passage or error
 */
export function retrieveSourcePassage(
  sourceRef: ConceptSourceRef,
  conceptId: string
): SourceLookupResult {
  const chunks = findChunksForSourceRef(sourceRef);
  
  if (chunks.length === 0) {
    return {
      found: false,
      error: `No PDF chunks found for ${sourceRef.docId} page ${sourceRef.page}`
    };
  }
  
  // Use the first chunk as the primary content
  // (Chunks are small enough that one covers the relevant content)
  const primaryChunk = chunks[0];
  
  // If multiple chunks on same page, combine them
  const text = chunks.length > 1
    ? chunks.map(c => c.text).join(' ')
    : primaryChunk.text;
  
  return {
    found: true,
    passage: {
      passageId: sourceRef.passageId || `${sourceRef.chunkId}-p${sourceRef.page}`,
      conceptId,
      docId: sourceRef.docId,
      chunkId: primaryChunk.chunkId, // Use actual PDF chunkId
      page: sourceRef.page,
      text: text.substring(0, 2000), // Limit length
      whyIncluded: `Concept registry source for ${conceptId} (page ${sourceRef.page})`
    }
  };
}

/**
 * Batch retrieve source passages for multiple source refs
 * 
 * @param sourceRefs - Array of source references
 * @param conceptId - Associated concept ID
 * @returns Array of successfully retrieved passages
 */
export function retrieveSourcePassages(
  sourceRefs: ConceptSourceRef[],
  conceptId: string
): RetrievedSourcePassage[] {
  const passages: RetrievedSourcePassage[] = [];
  const seenChunkIds = new Set<string>();
  
  for (const ref of sourceRefs) {
    const result = retrieveSourcePassage(ref, conceptId);
    
    if (result.found && result.passage) {
      // Deduplicate by chunkId
      if (!seenChunkIds.has(result.passage.chunkId)) {
        passages.push(result.passage);
        seenChunkIds.add(result.passage.chunkId);
      }
    }
  }
  
  return passages;
}

/**
 * Get groundedness statistics for concept registry
 * Reports what percentage of source references can be resolved to actual text
 * 
 * @returns Groundedness report
 */
export function getGroundednessReport(): {
  totalSourceRefs: number;
  resolvedSourceRefs: number;
  coveragePercentage: number;
  unresolved: Array<{ conceptId: string; docId: string; page: number }>;
} {
  const { getConceptFromRegistry, getConceptRegistry } = require('../data');
  const registry = getConceptRegistry();
  
  let totalSourceRefs = 0;
  let resolvedSourceRefs = 0;
  const unresolved: Array<{ conceptId: string; docId: string; page: number }> = [];
  
  for (const concept of registry.concepts) {
    for (const ref of concept.sourceRefs) {
      totalSourceRefs++;
      
      const chunks = findChunksForSourceRef(ref);
      if (chunks.length > 0) {
        resolvedSourceRefs++;
      } else {
        unresolved.push({
          conceptId: concept.conceptId,
          docId: ref.docId,
          page: ref.page
        });
      }
    }
  }
  
  const coveragePercentage = totalSourceRefs > 0
    ? Math.round((resolvedSourceRefs / totalSourceRefs) * 100)
    : 0;
  
  return {
    totalSourceRefs,
    resolvedSourceRefs,
    coveragePercentage,
    unresolved
  };
}

/**
 * Log groundedness report to console for debugging
 */
export function logGroundednessReport(): void {
  const report = getGroundednessReport();
  
  console.log('[SourceRef] Groundedness Report:');
  console.log(`  Total source references: ${report.totalSourceRefs}`);
  console.log(`  Resolved to PDF chunks: ${report.resolvedSourceRefs}`);
  console.log(`  Coverage: ${report.coveragePercentage}%`);
  
  if (report.unresolved.length > 0) {
    console.log(`  Unresolved references (${report.unresolved.length}):`);
    for (const u of report.unresolved.slice(0, 5)) {
      console.log(`    - ${u.conceptId}: ${u.docId} page ${u.page}`);
    }
    if (report.unresolved.length > 5) {
      console.log(`    ... and ${report.unresolved.length - 5} more`);
    }
  }
}
