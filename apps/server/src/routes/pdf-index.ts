/**
 * PDF Index API Routes
 * Handles PDF index loading, building, upload, and status checks
 */

import { Router, Request, Response, NextFunction } from 'express';
import { promises as fs } from 'fs';
import path from 'path';
import { createHash } from 'crypto';
import { execFile } from 'child_process';
import { promisify } from 'util';
import type { ApiResponse } from '../types.js';
import {
  ENABLE_PDF_INDEX,
  PDF_INDEX_DIR,
  PDF_SOURCE_DIR,
  PDF_INDEX_SCHEMA_VERSION,
  PDF_CHUNKER_VERSION,
  PDF_EMBEDDING_MODEL_ID,
  PDF_CHUNK_WORDS,
  PDF_CHUNK_OVERLAP_WORDS,
  PDF_EMBEDDING_DIMENSION,
  getDocAlias,
} from '../config.js';

const router = Router();
const execFileAsync = promisify(execFile);

// ============================================================================
// Types
// ============================================================================

interface PdfSourceDoc {
  docId: string;
  filename: string;
  sha256: string;
  pageCount: number;
}

interface PdfIndexChunk {
  chunkId: string;
  docId: string;
  page: number;
  text: string;
  embedding?: number[];
}

interface PdfIndexManifest {
  indexId: string;
  createdAt: string;
  schemaVersion: string;
  chunkerVersion: string;
  embeddingModelId: string;
  sourceDocs: PdfSourceDoc[];
  docCount: number;
  chunkCount: number;
}

interface PdfIndexDocument {
  indexId: string;
  sourceName: string;
  createdAt: string;
  schemaVersion: string;
  chunkerVersion: string;
  embeddingModelId: string;
  sourceDocs: PdfSourceDoc[];
  docCount: number;
  chunkCount: number;
  chunks: PdfIndexChunk[];
}

interface PdfIndexStatus {
  enabled: boolean;
  available: boolean;
  schemaVersion: string;
  chunkerVersion: string;
  embeddingModelId: string;
  documentCount: number;
  chunkCount: number;
  sourceDocs: PdfSourceDoc[];
  indexDir: string;
  sourceDir: string;
}

interface MultipartPart {
  name?: string;
  filename?: string;
  data: Buffer;
}

// ============================================================================
// Middleware: Check if PDF index is enabled
// ============================================================================

const checkEnabled = (_req: Request, res: Response, next: NextFunction): void => {
  if (process.env.NODE_ENV === 'production') {
    const response: ApiResponse<never> = {
      success: false,
      error: 'PDF index route is local-dev only',
      message: 'Use remote corpus APIs in hosted environments.',
    };
    res.status(403).json(response);
    return;
  }

  if (!ENABLE_PDF_INDEX) {
    const response: ApiResponse<never> = {
      success: false,
      error: 'PDF index not enabled',
      message: 'Set ENABLE_PDF_INDEX=true to enable PDF features',
    };
    res.status(503).json(response);
    return;
  }
  next();
};

// ============================================================================
// GET /api/pdf-index/status - Get PDF index status
// ============================================================================

router.get('/status', async (_req: Request, res: Response) => {
  try {
    const status: PdfIndexStatus = {
      enabled: ENABLE_PDF_INDEX,
      available: false,
      schemaVersion: PDF_INDEX_SCHEMA_VERSION,
      chunkerVersion: PDF_CHUNKER_VERSION,
      embeddingModelId: PDF_EMBEDDING_MODEL_ID,
      documentCount: 0,
      chunkCount: 0,
      sourceDocs: [],
      indexDir: PDF_INDEX_DIR,
      sourceDir: PDF_SOURCE_DIR,
    };

    if (!ENABLE_PDF_INDEX) {
      const response: ApiResponse<PdfIndexStatus> = {
        success: true,
        data: status,
        message: 'PDF index is disabled',
      };
      res.json(response);
      return;
    }

    // Check if index exists
    const existing = await readPdfIndexFromDisk();
    if (existing) {
      status.available = true;
      status.documentCount = existing.manifest.docCount;
      status.chunkCount = existing.manifest.chunkCount;
      status.sourceDocs = existing.manifest.sourceDocs;
    }

    const response: ApiResponse<PdfIndexStatus> = {
      success: true,
      data: status,
      message: status.available 
        ? `PDF index available with ${status.documentCount} document(s) and ${status.chunkCount} chunk(s)`
        : 'PDF index not yet built',
    };
    res.json(response);
  } catch (error) {
    const response: ApiResponse<never> = {
      success: false,
      error: 'Failed to get PDF index status',
      message: error instanceof Error ? error.message : 'Unknown error',
    };
    res.status(500).json(response);
  }
});

// ============================================================================
// POST /api/pdf-index/load - Load or build PDF index from disk
// ============================================================================

router.post('/load', checkEnabled, async (_req: Request, res: Response) => {
  try {
    const existing = await readPdfIndexFromDisk();
    
    if (existing && isCompatible(existing.manifest)) {
      const response: ApiResponse<{
        status: 'loaded';
        document: PdfIndexDocument;
        message: string;
      }> = {
        success: true,
        data: {
          status: 'loaded',
          document: existing.document,
          message: `Loaded compatible PDF index '${existing.manifest.indexId}'.`,
        },
      };
      res.json(response);
      return;
    }

    // Build new index
    const previousManifest = existing?.manifest;
    const built = await buildPdfIndex();
    await writePdfIndexToDisk(built.manifest, built.chunks);

    const response: ApiResponse<{
      status: 'built';
      document: PdfIndexDocument;
      message: string;
      rebuiltFrom?: {
        schemaVersion?: string;
        embeddingModelId?: string;
        chunkerVersion?: string;
      } | null;
    }> = {
      success: true,
      data: {
        status: 'built',
        document: built.document,
        message: previousManifest
          ? `Rebuilt PDF index due to version incompatibility (${previousManifest.schemaVersion}/${previousManifest.embeddingModelId}/${previousManifest.chunkerVersion} -> ${built.manifest.schemaVersion}/${built.manifest.embeddingModelId}/${built.manifest.chunkerVersion}).`
          : `Built PDF index from ${built.manifest.docCount} source document(s).`,
        rebuiltFrom: previousManifest
          ? {
              schemaVersion: previousManifest.schemaVersion,
              embeddingModelId: previousManifest.embeddingModelId,
              chunkerVersion: previousManifest.chunkerVersion,
            }
          : null,
      },
    };
    res.json(response);
  } catch (error) {
    const response: ApiResponse<never> = {
      success: false,
      error: 'Failed to load/build PDF index',
      message: error instanceof Error ? error.message : 'Unknown error',
    };
    res.status(500).json(response);
  }
});

// ============================================================================
// POST /api/pdf-index/upload - Upload PDF and build index
// ============================================================================

router.post('/upload', checkEnabled, async (req: Request, res: Response) => {
  try {
    // Parse multipart form data manually (no multer dependency)
    const chunks: Buffer[] = [];
    
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    
    req.on('end', async () => {
      try {
        const buffer = Buffer.concat(chunks);
        const contentType = req.headers['content-type'] || '';
        
        if (!contentType.includes('multipart/form-data')) {
          const response: ApiResponse<never> = {
            success: false,
            error: 'Invalid content type',
            message: 'Expected multipart/form-data',
          };
          res.status(400).json(response);
          return;
        }

        // Extract boundary
        const boundaryMatch = contentType.match(/boundary=([^;]+)/);
        if (!boundaryMatch) {
          const response: ApiResponse<never> = {
            success: false,
            error: 'Missing boundary',
            message: 'Missing boundary in content-type',
          };
          res.status(400).json(response);
          return;
        }
        const boundary = boundaryMatch[1].trim().replace(/^"|"$/g, '');

        // Parse multipart data
        const parts = parseMultipart(buffer, boundary);
        const filePart = parts.find(p => p.filename && p.filename.endsWith('.pdf'));
        
        if (!filePart) {
          const response: ApiResponse<never> = {
            success: false,
            error: 'No PDF file',
            message: 'No PDF file found in upload',
          };
          res.status(400).json(response);
          return;
        }

        // Ensure directories exist
        await fs.mkdir(PDF_SOURCE_DIR, { recursive: true });
        await fs.mkdir(PDF_INDEX_DIR, { recursive: true });

        // Build index from uploaded PDF
        const result = await buildPdfIndexFromBuffer(filePart.data, filePart.filename || 'uploaded.pdf');

        const response: ApiResponse<{
          status: 'built';
          document: PdfIndexDocument;
          manifest: PdfIndexManifest;
          message: string;
        }> = {
          success: true,
          data: {
            status: 'built',
            document: result.document,
            manifest: result.manifest,
            message: `Successfully built PDF index from '${filePart.filename}' with ${result.manifest.chunkCount} chunks.`,
          },
        };
        res.json(response);
      } catch (error) {
        const response: ApiResponse<never> = {
          success: false,
          error: 'Failed to process uploaded PDF',
          message: error instanceof Error ? error.message : 'Unknown error',
        };
        res.status(500).json(response);
      }
    });

    req.on('error', (error) => {
      const response: ApiResponse<never> = {
        success: false,
        error: 'Upload error',
        message: error instanceof Error ? error.message : 'Unknown error',
      };
      res.status(500).json(response);
    });
  } catch (error) {
    const response: ApiResponse<never> = {
      success: false,
      error: 'Failed to process upload',
      message: error instanceof Error ? error.message : 'Unknown error',
    };
    res.status(500).json(response);
  }
});

// ============================================================================
// PDF Index Core Functions
// ============================================================================

const MANIFEST_FILENAME = 'manifest.json';
const CHUNKS_FILENAME = 'chunks.json';

async function readPdfIndexFromDisk(): Promise<{
  manifest: PdfIndexManifest;
  document: PdfIndexDocument;
} | null> {
  const manifestPath = path.join(PDF_INDEX_DIR, MANIFEST_FILENAME);
  const chunksPath = path.join(PDF_INDEX_DIR, CHUNKS_FILENAME);

  let manifestRaw: string;
  let chunksRaw: string;
  try {
    [manifestRaw, chunksRaw] = await Promise.all([
      fs.readFile(manifestPath, 'utf8'),
      fs.readFile(chunksPath, 'utf8'),
    ]);
  } catch {
    return null;
  }

  try {
    const manifest = JSON.parse(manifestRaw) as PdfIndexManifest;
    const chunks = JSON.parse(chunksRaw) as PdfIndexChunk[];
    if (!manifest || !Array.isArray(chunks)) {
      return null;
    }

    const normalizedSourceDocs = Array.isArray(manifest.sourceDocs)
      ? manifest.sourceDocs
          .map((doc) => normalizeSourceDoc(doc))
          .filter((doc): doc is PdfSourceDoc => Boolean(doc))
      : [];
    if (normalizedSourceDocs.length === 0) {
      return null;
    }

    const defaultDocId = normalizedSourceDocs[0].docId;
    const normalizedChunks = chunks
      .map((chunk) => normalizeChunk(chunk, defaultDocId))
      .filter((chunk): chunk is PdfIndexChunk => Boolean(chunk));
    if (normalizedChunks.length === 0) {
      return null;
    }

    const manifestWithCounts: PdfIndexManifest = {
      ...manifest,
      sourceDocs: normalizedSourceDocs,
      docCount: normalizedSourceDocs.length,
      chunkCount: normalizedChunks.length,
    };

    return {
      manifest: manifestWithCounts,
      document: createDocument(manifestWithCounts, normalizedChunks),
    };
  } catch {
    return null;
  }
}

async function writePdfIndexToDisk(
  manifest: PdfIndexManifest,
  chunks: PdfIndexChunk[]
): Promise<void> {
  const manifestPath = path.join(PDF_INDEX_DIR, MANIFEST_FILENAME);
  const chunksPath = path.join(PDF_INDEX_DIR, CHUNKS_FILENAME);

  await fs.mkdir(PDF_INDEX_DIR, { recursive: true });
  await Promise.all([
    fs.writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8'),
    fs.writeFile(chunksPath, `${JSON.stringify(chunks, null, 2)}\n`, 'utf8'),
  ]);
}

async function buildPdfIndex(): Promise<{
  manifest: PdfIndexManifest;
  chunks: PdfIndexChunk[];
  document: PdfIndexDocument;
}> {
  const pdfPaths = await listPdfFiles(PDF_SOURCE_DIR);
  if (pdfPaths.length === 0) {
    throw new Error(
      `No PDF files found in '${PDF_SOURCE_DIR}'. ` +
      `Add PDFs there or set PDF_SOURCE_DIR before starting the server.`
    );
  }

  const sourceDocs: PdfSourceDoc[] = [];
  const chunks: PdfIndexChunk[] = [];
  const usedDocIds = new Set<string>();

  for (const pdfPath of pdfPaths) {
    const fileBuffer = await fs.readFile(pdfPath);
    const sha256 = createHash('sha256').update(fileBuffer).digest('hex');
    const relativeName = toPosixPath(path.relative(PDF_SOURCE_DIR, pdfPath));
    const baseDocId = getDocAlias(path.basename(pdfPath));
    const docId = uniqueDocId(baseDocId, usedDocIds);
    const pages = await extractPagesFromPdf(pdfPath);

    sourceDocs.push({
      docId,
      filename: relativeName,
      sha256,
      pageCount: pages.length,
    });

    for (const page of pages) {
      const pageChunks = chunkPageWords({
        docId,
        page: page.page,
        text: page.text,
        chunkSizeWords: PDF_CHUNK_WORDS,
        chunkOverlapWords: PDF_CHUNK_OVERLAP_WORDS,
        embeddingDimension: PDF_EMBEDDING_DIMENSION,
      });
      chunks.push(...pageChunks);
    }
  }

  sourceDocs.sort((left, right) => left.docId.localeCompare(right.docId));
  chunks.sort((left, right) => {
    const docDelta = left.docId.localeCompare(right.docId);
    if (docDelta !== 0) return docDelta;
    const pageDelta = left.page - right.page;
    if (pageDelta !== 0) return pageDelta;
    return left.chunkId.localeCompare(right.chunkId);
  });

  const createdAt = new Date().toISOString();
  const indexId = `pdf-index-${createHash('sha256')
    .update(
      JSON.stringify({
        schemaVersion: PDF_INDEX_SCHEMA_VERSION,
        chunkerVersion: PDF_CHUNKER_VERSION,
        embeddingModelId: PDF_EMBEDDING_MODEL_ID,
        sourceDocs: sourceDocs.map((doc) => ({
          docId: doc.docId,
          sha256: doc.sha256,
          pageCount: doc.pageCount,
          filename: doc.filename,
        })),
        chunkCount: chunks.length,
      })
    )
    .digest('hex')
    .slice(0, 16)}`;

  const manifest: PdfIndexManifest = {
    indexId,
    createdAt,
    schemaVersion: PDF_INDEX_SCHEMA_VERSION,
    chunkerVersion: PDF_CHUNKER_VERSION,
    embeddingModelId: PDF_EMBEDDING_MODEL_ID,
    sourceDocs,
    docCount: sourceDocs.length,
    chunkCount: chunks.length,
  };

  return {
    manifest,
    chunks,
    document: createDocument(manifest, chunks),
  };
}

async function buildPdfIndexFromBuffer(
  pdfBuffer: Buffer,
  filename: string
): Promise<{
  manifest: PdfIndexManifest;
  chunks: PdfIndexChunk[];
  document: PdfIndexDocument;
}> {
  // Write buffer to temp file for pdftotext processing
  const tempDir = path.join(PDF_INDEX_DIR, '.temp');
  await fs.mkdir(tempDir, { recursive: true });
  const tempPdfPath = path.join(tempDir, `upload-${Date.now()}-${filename}`);

  try {
    await fs.writeFile(tempPdfPath, pdfBuffer);

    const sha256 = createHash('sha256').update(pdfBuffer).digest('hex');
    const docId = `doc-${sha256.slice(0, 12)}`;
    const pages = await extractPagesFromPdf(tempPdfPath);

    if (pages.length === 0) {
      throw new Error(
        `No text content extracted from PDF '${filename}'. The PDF may be scanned images or corrupted.`
      );
    }

    const sourceDoc: PdfSourceDoc = {
      docId,
      filename,
      sha256,
      pageCount: pages.length,
    };

    const chunks: PdfIndexChunk[] = [];
    for (const page of pages) {
      const pageChunks = chunkPageWords({
        docId,
        page: page.page,
        text: page.text,
        chunkSizeWords: PDF_CHUNK_WORDS,
        chunkOverlapWords: PDF_CHUNK_OVERLAP_WORDS,
        embeddingDimension: PDF_EMBEDDING_DIMENSION,
      });
      chunks.push(...pageChunks);
    }

    chunks.sort((left, right) => {
      const pageDelta = left.page - right.page;
      if (pageDelta !== 0) return pageDelta;
      return left.chunkId.localeCompare(right.chunkId);
    });

    const createdAt = new Date().toISOString();
    const indexId = `pdf-index-${createHash('sha256')
      .update(
        JSON.stringify({
          schemaVersion: PDF_INDEX_SCHEMA_VERSION,
          chunkerVersion: PDF_CHUNKER_VERSION,
          embeddingModelId: PDF_EMBEDDING_MODEL_ID,
          sourceDocs: [{
            docId: sourceDoc.docId,
            sha256: sourceDoc.sha256,
            pageCount: sourceDoc.pageCount,
            filename: sourceDoc.filename,
          }],
          chunkCount: chunks.length,
        })
      )
      .digest('hex')
      .slice(0, 16)}`;

    const manifest: PdfIndexManifest = {
      indexId,
      createdAt,
      schemaVersion: PDF_INDEX_SCHEMA_VERSION,
      chunkerVersion: PDF_CHUNKER_VERSION,
      embeddingModelId: PDF_EMBEDDING_MODEL_ID,
      sourceDocs: [sourceDoc],
      docCount: 1,
      chunkCount: chunks.length,
    };

    // Save to disk
    await writePdfIndexToDisk(manifest, chunks);

    // Copy PDF to source dir for persistence
    const persistentPdfPath = path.join(PDF_SOURCE_DIR, filename);
    await fs.mkdir(PDF_SOURCE_DIR, { recursive: true });
    await fs.writeFile(persistentPdfPath, pdfBuffer);

    return {
      manifest,
      chunks,
      document: createDocument(manifest, chunks),
    };
  } finally {
    // Clean up temp file
    try {
      await fs.unlink(tempPdfPath);
    } catch {
      // Ignore cleanup errors
    }
  }
}

function createDocument(manifest: PdfIndexManifest, chunks: PdfIndexChunk[]): PdfIndexDocument {
  return {
    indexId: manifest.indexId,
    sourceName: manifest.docCount === 1
      ? manifest.sourceDocs[0].filename
      : `${manifest.docCount} documents`,
    createdAt: manifest.createdAt,
    schemaVersion: manifest.schemaVersion,
    chunkerVersion: manifest.chunkerVersion,
    embeddingModelId: manifest.embeddingModelId,
    sourceDocs: manifest.sourceDocs,
    docCount: manifest.docCount,
    chunkCount: manifest.chunkCount,
    chunks,
  };
}

function normalizeSourceDoc(value: unknown): PdfSourceDoc | null {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as Partial<PdfSourceDoc>;

  const docId = typeof candidate.docId === 'string' ? candidate.docId.trim() : '';
  const filename = typeof candidate.filename === 'string' ? candidate.filename.trim() : '';
  const sha256 = typeof candidate.sha256 === 'string' ? candidate.sha256.trim() : '';
  const pageCount = Number(candidate.pageCount);

  if (!docId || !filename || !sha256 || !Number.isFinite(pageCount) || pageCount < 0) {
    return null;
  }

  return { docId, filename, sha256, pageCount };
}

function normalizeChunk(value: unknown, defaultDocId: string): PdfIndexChunk | null {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as Partial<PdfIndexChunk>;

  const chunkId = typeof candidate.chunkId === 'string' ? candidate.chunkId.trim() : '';
  const docId = typeof candidate.docId === 'string' && candidate.docId.trim()
    ? candidate.docId.trim()
    : defaultDocId;
  const page = Number(candidate.page);
  const text = typeof candidate.text === 'string' ? candidate.text.trim() : '';
  const embedding = Array.isArray(candidate.embedding)
    ? candidate.embedding.map((v) => Number(v)).filter((v) => Number.isFinite(v))
    : undefined;

  if (!chunkId || !docId || !Number.isFinite(page) || page <= 0 || !text) {
    return null;
  }

  return { chunkId, docId, page, text, embedding };
}

function isCompatible(manifest: PdfIndexManifest): boolean {
  return (
    manifest.schemaVersion === PDF_INDEX_SCHEMA_VERSION &&
    manifest.embeddingModelId === PDF_EMBEDDING_MODEL_ID &&
    manifest.chunkerVersion === PDF_CHUNKER_VERSION
  );
}

async function listPdfFiles(rootDir: string): Promise<string[]> {
  const normalizedRoot = path.resolve(rootDir);
  const discovered: string[] = [];

  async function walk(currentDir: string): Promise<void> {
    let entries;
    try {
      entries = await fs.readdir(currentDir, { withFileTypes: true });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return;
      }
      throw error;
    }

    for (const entry of entries) {
      const entryPath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        await walk(entryPath);
        continue;
      }

      if (entry.isFile() && entry.name.toLowerCase().endsWith('.pdf')) {
        discovered.push(entryPath);
      }
    }
  }

  await walk(normalizedRoot);
  discovered.sort((left, right) => left.localeCompare(right));
  return discovered;
}

function getPdftotextInstallInstructions(): string {
  const platform = process.platform;
  const instructions: string[] = [''];

  instructions.push('Install Poppler (which includes pdftotext):');
  instructions.push('');

  if (platform === 'darwin') {
    instructions.push('  macOS (Homebrew):');
    instructions.push('    brew install poppler');
  } else if (platform === 'linux') {
    instructions.push('  Ubuntu/Debian:');
    instructions.push('    sudo apt-get install poppler-utils');
    instructions.push('');
    instructions.push('  Fedora/RHEL:');
    instructions.push('    sudo dnf install poppler-utils');
  } else if (platform === 'win32') {
    instructions.push('  Windows:');
    instructions.push('    1. Install via Chocolatey: choco install poppler');
    instructions.push('    2. Or download from: https://github.com/oschwartz10612/poppler-windows/releases');
    instructions.push('    3. Add bin/ folder to your PATH environment variable');
  } else {
    instructions.push('  See: https://poppler.freedesktop.org/');
  }

  instructions.push('');
  instructions.push('After installation, restart the server and try again.');

  return instructions.join('\n');
}

async function extractPagesFromPdf(pdfPath: string): Promise<Array<{ page: number; text: string }>> {
  let stdout: string;
  try {
    ({ stdout } = await execFileAsync('pdftotext', ['-layout', pdfPath, '-'], {
      maxBuffer: 100 * 1024 * 1024,
    }));
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    if (err.code === 'ENOENT') {
      throw new Error(
        'PDF text extraction requires pdftotext, which is not installed.\n' +
        getPdftotextInstallInstructions()
      );
    }

    throw new Error(`Failed to extract text from PDF '${pdfPath}': ${err.message || String(err)}`);
  }

  return stdout
    .split('\f')
    .map((pageText, index) => ({
      page: index + 1,
      text: normalizeText(pageText),
    }))
    .filter((page) => page.text.length > 0);
}

function chunkPageWords(options: {
  docId: string;
  page: number;
  text: string;
  chunkSizeWords: number;
  chunkOverlapWords: number;
  embeddingDimension: number;
}): PdfIndexChunk[] {
  const words = options.text.split(/\s+/).filter(Boolean);
  if (words.length === 0) {
    return [];
  }

  const chunks: PdfIndexChunk[] = [];
  const step = Math.max(1, options.chunkSizeWords - options.chunkOverlapWords);

  for (let start = 0; start < words.length; start += step) {
    const slice = words.slice(start, start + options.chunkSizeWords);
    if (slice.length === 0) {
      continue;
    }

    const chunkIndex = Math.floor(start / step) + 1;
    const text = slice.join(' ');
    chunks.push({
      chunkId: `${options.docId}:p${options.page}:c${chunkIndex}`,
      docId: options.docId,
      page: options.page,
      text,
      embedding: buildEmbedding(text, options.embeddingDimension),
    });

    if (start + options.chunkSizeWords >= words.length) {
      break;
    }
  }

  return chunks;
}

function buildEmbedding(text: string, embeddingDimension: number): number[] {
  const vector = new Array<number>(embeddingDimension).fill(0);
  const tokens = tokenize(text);

  for (const token of tokens) {
    const index = hashToken(token) % embeddingDimension;
    vector[index] += 1;
  }

  return normalizeVector(vector);
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 3);
}

function hashToken(token: string): number {
  let hash = 0;
  for (let i = 0; i < token.length; i += 1) {
    hash = (hash * 31 + token.charCodeAt(i)) >>> 0;
  }
  return hash;
}

function normalizeVector(vector: number[]): number[] {
  const norm = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));
  if (norm === 0) {
    return vector;
  }
  return vector.map((value) => value / norm);
}

function normalizeText(text: string): string {
  return text
    .replace(/\u0000/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{2,}/g, '\n')
    .trim();
}

function uniqueDocId(baseId: string, usedDocIds: Set<string>): string {
  if (!usedDocIds.has(baseId)) {
    usedDocIds.add(baseId);
    return baseId;
  }

  let suffix = 2;
  while (usedDocIds.has(`${baseId}-${suffix}`)) {
    suffix += 1;
  }

  const uniqueId = `${baseId}-${suffix}`;
  usedDocIds.add(uniqueId);
  return uniqueId;
}

function toPosixPath(value: string): string {
  return value.split(path.sep).join('/');
}

// Simple multipart parser
function parseMultipart(
  buffer: Buffer,
  boundary: string
): MultipartPart[] {
  const parts: MultipartPart[] = [];
  const boundaryBuffer = Buffer.from(`--${boundary}`);

  let start = buffer.indexOf(boundaryBuffer);
  while (start !== -1) {
    const end = buffer.indexOf(boundaryBuffer, start + boundaryBuffer.length);
    const partBuffer =
      end !== -1
        ? buffer.slice(start + boundaryBuffer.length, end)
        : buffer.slice(start + boundaryBuffer.length);

    // Parse headers and data
    const headerEnd = partBuffer.indexOf('\r\n\r\n');
    if (headerEnd !== -1) {
      const headerBuffer = partBuffer.slice(0, headerEnd);
      const dataBuffer = partBuffer.slice(headerEnd + 4);

      // Remove trailing \r\n before boundary
      const cleanData = dataBuffer.toString().endsWith('\r\n')
        ? dataBuffer.slice(0, -2)
        : dataBuffer;

      const headerStr = headerBuffer.toString();
      const nameMatch = headerStr.match(/name="([^"]+)"/);
      const filenameMatch = headerStr.match(/filename="([^"]+)"/);

      if (nameMatch || filenameMatch) {
        parts.push({
          name: nameMatch?.[1],
          filename: filenameMatch?.[1],
          data: cleanData,
        });
      }
    }

    start = end;
  }

  return parts;
}

export { router as pdfIndexRouter };
