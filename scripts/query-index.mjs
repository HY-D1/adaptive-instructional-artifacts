#!/usr/bin/env node
/**
 * Query PDF Index
 * 
 * Retrieves top-k passages from a PDF index based on a text query.
 * Returns results with text, relevance score, and page citations.
 * 
 * Usage:
 *   node scripts/query-index.mjs <index-dir> <query>
 *   node scripts/query-index.mjs <index-dir> <query> --top-k 10
 * 
 * Environment:
 *   TOP_K       Default number of results (default: 5)
 *   SIMILARITY  Minimum similarity threshold 0-1 (default: 0.1)
 * 
 * Output: JSON with query metadata and ranked results
 */

import { readFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';

const PDF_EMBEDDING_DIMENSION = 24;

const indexDir = process.argv[2];
const query = process.argv.slice(3).join(' ').trim().replace(/\s+--top-k\s+\d+/g, '').trim();
const topKMatch = process.argv.join(' ').match(/--top-k\s+(\d+)/);
const topK = parseInt(topKMatch?.[1] || process.env.TOP_K || '5', 10);
const similarityThreshold = parseFloat(process.env.SIMILARITY || '0.1');

function log(level, message) {
  const timestamp = new Date().toISOString();
  console.error(`[${timestamp}] [${level.toUpperCase()}] ${message}`);
}

async function loadIndex(indexDir) {
  const startTime = Date.now();
  
  const [manifestRaw, chunksRaw] = await Promise.all([
    readFile(join(indexDir, 'manifest.json'), 'utf8'),
    readFile(join(indexDir, 'chunks.json'), 'utf8')
  ]);
  
  const manifest = JSON.parse(manifestRaw);
  const chunks = JSON.parse(chunksRaw);
  
  log('perf', `Index loaded in ${Date.now() - startTime}ms`);
  
  return { manifest, chunks };
}

function tokenize(text) {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .map(t => t.trim())
      .filter(t => t.length >= 3)
  );
}

function hashToken(token) {
  let hash = 0;
  for (let i = 0; i < token.length; i++) {
    hash = (hash * 31 + token.charCodeAt(i)) >>> 0;
  }
  return hash;
}

function buildEmbedding(text) {
  const vector = new Array(PDF_EMBEDDING_DIMENSION).fill(0);
  const tokens = tokenize(text);
  
  for (const token of tokens) {
    const index = hashToken(token) % PDF_EMBEDDING_DIMENSION;
    vector[index] += 1;
  }
  
  // Normalize
  const norm = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0));
  if (norm === 0) return vector;
  return vector.map(v => v / norm);
}

function cosineSimilarity(a, b) {
  if (a.length !== b.length) return 0;
  
  let dot = 0;
  let normA = 0;
  let normB = 0;
  
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

function scoreChunk(chunk, queryVector, queryTokens) {
  // Use embedding similarity if available
  if (chunk.embedding && chunk.embedding.length === PDF_EMBEDDING_DIMENSION) {
    return cosineSimilarity(queryVector, chunk.embedding);
  }
  
  // Fallback to keyword matching
  if (queryTokens.size === 0) return 0;
  
  const chunkTokens = tokenize(chunk.text);
  if (chunkTokens.size === 0) return 0;
  
  let matches = 0;
  for (const token of chunkTokens) {
    if (queryTokens.has(token)) matches++;
  }
  
  return matches / Math.sqrt(chunkTokens.size);
}

async function main() {
  if (!indexDir || !query) {
    console.error('Usage: node scripts/query-index.mjs <index-dir> <query> [--top-k N]');
    console.error('');
    console.error('Environment:');
    console.error('  TOP_K       Default number of results (default: 5)');
    console.error('  SIMILARITY  Minimum similarity threshold 0-1 (default: 0.1)');
    process.exit(1);
  }
  
  const resolvedDir = resolve(process.cwd(), indexDir);
  
  log('info', '========================================');
  log('info', 'PDF Index Query');
  log('info', '========================================');
  log('info', `Index: ${resolvedDir}`);
  log('info', `Query: "${query}"`);
  log('info', `Top-K: ${topK}`);
  log('info', `Similarity threshold: ${similarityThreshold}`);
  
  // Load index
  const { manifest, chunks } = await loadIndex(resolvedDir);
  log('info', `Index ID: ${manifest.indexId}`);
  log('info', `Total chunks: ${chunks.length}`);
  
  // Build query embedding
  const queryStartTime = Date.now();
  const queryVector = buildEmbedding(query);
  const queryTokens = tokenize(query);
  
  // Score and rank chunks
  const results = chunks
    .map(chunk => ({
      chunkId: chunk.chunkId,
      docId: chunk.docId,
      page: chunk.page,
      text: chunk.text,
      headings: chunk.headings || [],
      score: scoreChunk(chunk, queryVector, queryTokens)
    }))
    .filter(r => r.score >= similarityThreshold)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
  
  const queryTime = Date.now() - queryStartTime;
  
  log('info', `Query executed in ${queryTime}ms`);
  log('info', `Results: ${results.length}`);
  
  // Output results
  const output = {
    query,
    topK,
    similarityThreshold,
    queryTimeMs: queryTime,
    indexId: manifest.indexId,
    totalChunks: chunks.length,
    resultCount: results.length,
    results: results.map((r, i) => ({
      rank: i + 1,
      chunkId: r.chunkId,
      page: r.page,
      score: Math.round(r.score * 1000) / 1000,
      snippet: r.text.slice(0, 200) + (r.text.length > 200 ? '...' : ''),
      headings: r.headings
    }))
  };
  
  console.log(JSON.stringify(output, null, 2));
}

main().catch(error => {
  log('error', error.message || String(error));
  process.exit(1);
});
