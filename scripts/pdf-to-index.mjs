#!/usr/bin/env node
/**
 * PDF-to-Index Converter
 * 
 * Converts a PDF textbook into a searchable retrieval index for RAG-style lookup.
 * Features:
 * - Incremental indexing (skips rebuild if checksum matches)
 * - Page-aware chunking with section detection
 * - Local/offline only - no uploads
 * - Detailed logging of indexing operations
 * 
 * Usage:
 *   node scripts/pdf-to-index.mjs <pdf-file> [options]
 * 
 * Options:
 *   --output-dir <dir>     Output directory (default: dist/pdf-index)
 *   --chunk-size <n>       Words per chunk (default: 180)
 *   --overlap <n>          Overlap words between chunks (default: 30)
 *   --force                Force rebuild even if index exists
 */

import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir, stat, access } from 'node:fs/promises';
import { basename, resolve, join, dirname } from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

// Configuration constants
const PDF_INDEX_SCHEMA_VERSION = 'pdf-index-schema-v1';
const PDF_CHUNKER_VERSION = 'word-window-180-overlap-30-v1';
const PDF_EMBEDDING_MODEL_ID = 'hash-embedding-v1';
const PDF_EMBEDDING_DIMENSION = 24;
const MANIFEST_FILENAME = 'manifest.json';
const CHUNKS_FILENAME = 'chunks.json';
const INDEX_FILENAME = 'index.json';

// Parse CLI arguments
const args = process.argv.slice(2);
const pdfPath = args.find(arg => !arg.startsWith('--') && !arg.includes('='));
const outputDir = parseArg('--output-dir') || resolve(process.cwd(), 'dist/pdf-index');
const chunkSize = parseInt(parseArg('--chunk-size') || '180', 10);
const overlap = parseInt(parseArg('--overlap') || '30', 10);
const forceRebuild = args.includes('--force');

function parseArg(flag) {
  const idx = args.findIndex(arg => arg.startsWith(`${flag}=`) || arg === flag);
  if (idx === -1) return null;
  if (args[idx] === flag) {
    return args[idx + 1] || null;
  }
  return args[idx].split('=')[1];
}

function log(level, message) {
  const timestamp = new Date().toISOString();
  const prefix = `[${timestamp}] [${level.toUpperCase()}]`;
  console.error(`${prefix} ${message}`);
}

async function checkPreflight() {
  log('info', 'Checking for pdftotext...');
  try {
    await execFileAsync('pdftotext', ['-v']);
    log('info', 'pdftotext is available');
  } catch (error) {
    const err = /** @type {NodeJS.ErrnoException} */ (error);
    if (err.code === 'ENOENT') {
      throw new Error(
        'PDF text extraction requires pdftotext, which is not installed.\n' +
        getInstallInstructions()
      );
    }
    // pdftotext -v returns exit code 99 (shows version), which is OK
    log('info', 'pdftotext is available');
  }
}

function getInstallInstructions() {
  const platform = process.platform;
  const instructions = ['Install Poppler (which includes pdftotext):', ''];
  
  if (platform === 'darwin') {
    instructions.push('  macOS (Homebrew):');
    instructions.push('    brew install poppler');
  } else if (platform === 'linux') {
    instructions.push('  Ubuntu/Debian:');
    instructions.push('    sudo apt-get install poppler-utils');
    instructions.push('  Fedora/RHEL:');
    instructions.push('    sudo dnf install poppler-utils');
  } else if (platform === 'win32') {
    instructions.push('  Windows:');
    instructions.push('    1. Install via Chocolatey: choco install poppler');
    instructions.push('    2. Or download from: https://github.com/oschwartz10612/poppler-windows/releases');
    instructions.push('    3. Add bin/ folder to your PATH');
  } else {
    instructions.push('  See: https://poppler.freedesktop.org/');
  }
  
  instructions.push('', 'After installation, retry the command.');
  return instructions.join('\n');
}

async function computeChecksum(filePath) {
  const startTime = Date.now();
  const buffer = await readFile(filePath);
  const hash = createHash('sha256').update(buffer).digest('hex');
  log('perf', `Checksum computed in ${Date.now() - startTime}ms`);
  return hash;
}

async function checkExistingIndex(outputDir, checksum) {
  const manifestPath = join(outputDir, MANIFEST_FILENAME);
  
  try {
    await access(manifestPath);
    const manifestRaw = await readFile(manifestPath, 'utf8');
    const manifest = JSON.parse(manifestRaw);
    
    // Check if checksum matches first document
    if (manifest.sourceDocs && manifest.sourceDocs[0]?.sha256 === checksum) {
      return {
        exists: true,
        manifest,
        path: outputDir
      };
    }
  } catch {
    // Manifest doesn't exist or is invalid
  }
  
  return { exists: false };
}

async function extractPagesFromPdf(pdfPath) {
  log('info', `Extracting text from ${basename(pdfPath)}...`);
  const startTime = Date.now();
  
  let stdout;
  try {
    ({ stdout } = await execFileAsync('pdftotext', ['-layout', pdfPath, '-'], {
      maxBuffer: 100 * 1024 * 1024
    }));
  } catch (error) {
    const err = /** @type {NodeJS.ErrnoException} */ (error);
    if (err.code === 'ENOENT') {
      throw new Error('pdftotext not found. Please install Poppler.');
    }
    throw new Error(`Failed to extract text: ${err.message || String(err)}`);
  }
  
  const pages = stdout
    .split('\f')
    .map((text, idx) => ({
      page: idx + 1,
      text: normalizeText(text),
      headings: extractHeadings(text)
    }))
    .filter(page => page.text.length > 0);
  
  log('info', `Extracted ${pages.length} pages in ${Date.now() - startTime}ms`);
  return pages;
}

function extractHeadings(text) {
  // Simple heading detection: lines that are ALL CAPS or start with "Chapter"
  const headings = [];
  const lines = text.split('\n');
  
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    
    // Detect chapter/section headings
    if (/^(Chapter|Section|\d+\.|\d+\.\d+)\s+/i.test(trimmed)) {
      headings.push(trimmed.slice(0, 100));
    } else if (/^[A-Z][A-Z\s]{3,50}$/.test(trimmed)) {
      // ALL CAPS lines (likely headings)
      headings.push(trimmed);
    }
  }
  
  return headings.slice(0, 3); // Max 3 headings per page
}

function normalizeText(text) {
  return text
    .replace(/\u0000/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function chunkPage(docId, pageNum, text, headings, chunkSize, overlap) {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  
  const chunks = [];
  const step = Math.max(1, chunkSize - overlap);
  
  for (let i = 0; i < words.length; i += step) {
    const slice = words.slice(i, i + chunkSize);
    if (slice.length === 0) continue;
    
    const chunkIndex = Math.floor(i / step) + 1;
    const chunkText = slice.join(' ');
    
    chunks.push({
      chunkId: `${docId}:p${pageNum}:c${chunkIndex}`,
      docId,
      page: pageNum,
      text: chunkText,
      headings: headings.length > 0 ? headings : undefined,
      embedding: buildEmbedding(chunkText)
    });
    
    if (i + chunkSize >= words.length) break;
  }
  
  return chunks;
}

function buildEmbedding(text) {
  const vector = new Array(PDF_EMBEDDING_DIMENSION).fill(0);
  const tokens = tokenize(text);
  
  for (const token of tokens) {
    const index = hashToken(token) % PDF_EMBEDDING_DIMENSION;
    vector[index] += 1;
  }
  
  return normalizeVector(vector);
}

function tokenize(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .map(t => t.trim())
    .filter(t => t.length >= 3);
}

function hashToken(token) {
  let hash = 0;
  for (let i = 0; i < token.length; i++) {
    hash = (hash * 31 + token.charCodeAt(i)) >>> 0;
  }
  return hash;
}

function normalizeVector(vector) {
  const norm = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0));
  if (norm === 0) return vector;
  return vector.map(v => v / norm);
}

async function buildIndex(pdfPath, outputDir, checksum, chunkSize, overlap) {
  const startTime = Date.now();
  const filename = basename(pdfPath);
  const docId = `doc-${checksum.slice(0, 12)}`;
  
  log('info', `Building index for: ${filename}`);
  log('info', `  Document ID: ${docId}`);
  log('info', `  Checksum: ${checksum}`);
  log('info', `  Chunk size: ${chunkSize} words`);
  log('info', `  Overlap: ${overlap} words`);
  
  // Extract pages
  const pages = await extractPagesFromPdf(pdfPath);
  
  if (pages.length === 0) {
    throw new Error('No text content found in PDF');
  }
  
  // Chunk pages
  log('info', 'Chunking pages...');
  const chunkStartTime = Date.now();
  const chunks = [];
  
  for (const page of pages) {
    const pageChunks = chunkPage(docId, page.page, page.text, page.headings, chunkSize, overlap);
    chunks.push(...pageChunks);
  }
  
  log('info', `Created ${chunks.length} chunks in ${Date.now() - chunkStartTime}ms`);
  
  // Sort chunks
  chunks.sort((a, b) => {
    if (a.page !== b.page) return a.page - b.page;
    return a.chunkId.localeCompare(b.chunkId);
  });
  
  // Build manifest
  const createdAt = new Date().toISOString();
  const sourceDoc = {
    docId,
    filename,
    sha256: checksum,
    pageCount: pages.length
  };
  
  const indexIdInput = JSON.stringify({
    schemaVersion: PDF_INDEX_SCHEMA_VERSION,
    chunkerVersion: PDF_CHUNKER_VERSION,
    embeddingModelId: PDF_EMBEDDING_MODEL_ID,
    sourceDocs: [sourceDoc],
    chunkCount: chunks.length
  });
  
  const indexId = `pdf-index-${createHash('sha256').update(indexIdInput).digest('hex').slice(0, 16)}`;
  
  const manifest = {
    indexId,
    createdAt,
    schemaVersion: PDF_INDEX_SCHEMA_VERSION,
    chunkerVersion: PDF_CHUNKER_VERSION,
    embeddingModelId: PDF_EMBEDDING_MODEL_ID,
    sourceDocs: [sourceDoc],
    docCount: 1,
    chunkCount: chunks.length
  };
  
  const indexDocument = {
    ...manifest,
    sourceName: filename,
    chunks
  };
  
  // Write files
  log('info', `Writing index to: ${outputDir}`);
  await mkdir(outputDir, { recursive: true });
  
  await Promise.all([
    writeFile(join(outputDir, MANIFEST_FILENAME), JSON.stringify(manifest, null, 2) + '\n', 'utf8'),
    writeFile(join(outputDir, CHUNKS_FILENAME), JSON.stringify(chunks, null, 2) + '\n', 'utf8'),
    writeFile(join(outputDir, INDEX_FILENAME), JSON.stringify(indexDocument, null, 2) + '\n', 'utf8')
  ]);
  
  const totalTime = Date.now() - startTime;
  log('info', `Index built successfully in ${totalTime}ms`);
  
  return {
    indexId,
    docCount: 1,
    pageCount: pages.length,
    chunkCount: chunks.length,
    path: outputDir,
    isNew: true
  };
}

async function main() {
  if (!pdfPath) {
    console.error('Usage: node scripts/pdf-to-index.mjs <pdf-file> [options]');
    console.error('');
    console.error('Options:');
    console.error('  --output-dir <dir>   Output directory (default: dist/pdf-index)');
    console.error('  --chunk-size <n>     Words per chunk (default: 180)');
    console.error('  --overlap <n>        Overlap words (default: 30)');
    console.error('  --force              Force rebuild even if index exists');
    process.exit(1);
  }
  
  const resolvedPdfPath = resolve(process.cwd(), pdfPath);
  
  log('info', '========================================');
  log('info', 'PDF-to-Index Converter');
  log('info', '========================================');
  log('info', `Input: ${resolvedPdfPath}`);
  log('info', `Output: ${outputDir}`);
  
  // Preflight check
  await checkPreflight();
  
  // Compute checksum
  log('info', 'Computing checksum...');
  const checksum = await computeChecksum(resolvedPdfPath);
  log('info', `SHA256: ${checksum}`);
  
  // Check for existing index
  if (!forceRebuild) {
    const existing = await checkExistingIndex(outputDir, checksum);
    if (existing.exists) {
      log('info', '');
      log('info', '========================================');
      log('info', 'INDEX ALREADY EXISTS (skipping rebuild)');
      log('info', '========================================');
      log('info', `Index ID: ${existing.manifest.indexId}`);
      log('info', `Pages: ${existing.manifest.sourceDocs[0].pageCount}`);
      log('info', `Chunks: ${existing.manifest.chunkCount}`);
      log('info', `Path: ${existing.path}`);
      log('info', '');
      log('info', 'Use --force to rebuild anyway');
      
      console.log(JSON.stringify({
        status: 'skipped',
        indexId: existing.manifest.indexId,
        docCount: existing.manifest.docCount,
        pageCount: existing.manifest.sourceDocs[0].pageCount,
        chunkCount: existing.manifest.chunkCount,
        path: existing.path,
        isNew: false
      }, null, 2));
      
      return;
    }
  } else {
    log('info', 'Force rebuild enabled');
  }
  
  // Build index
  const result = await buildIndex(resolvedPdfPath, outputDir, checksum, chunkSize, overlap);
  
  log('info', '');
  log('info', '========================================');
  log('info', 'INDEX BUILD COMPLETE');
  log('info', '========================================');
  log('info', `Index ID: ${result.indexId}`);
  log('info', `Pages: ${result.pageCount}`);
  log('info', `Chunks: ${result.chunkCount}`);
  log('info', `Path: ${result.path}`);
  
  const resultJson = JSON.stringify({
    status: 'built',
    ...result
  }, null, 2);
  console.error('');
  console.error('--- RESULT ---');
  console.log(resultJson);
}

main().catch(error => {
  log('error', error.message || String(error));
  process.exit(1);
});
