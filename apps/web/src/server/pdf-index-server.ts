import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';
import {
  PDF_CHUNK_OVERLAP_WORDS,
  PDF_CHUNK_WORDS,
  PDF_EMBEDDING_DIMENSION,
  PDF_INDEX_CHUNKS_FILENAME,
  PDF_INDEX_MANIFEST_FILENAME
} from '../app/lib/pdf-index-config';
import type { PdfIndexChunk, PdfIndexDocument, PdfSourceDoc } from '../app/types';

const execFileAsync = promisify(execFile);

type PdfIndexManifestDisk = {
  indexId: string;
  createdAt: string;
  schemaVersion: string;
  chunkerVersion: string;
  embeddingModelId: string;
  sourceDocs: PdfSourceDoc[];
  docCount: number;
  chunkCount: number;
};

export type PdfIndexDiskConfig = {
  indexDir: string;
  sourcePdfDir: string;
  schemaVersion: string;
  chunkerVersion: string;
  embeddingModelId: string;
  chunkSizeWords?: number;
  chunkOverlapWords?: number;
  embeddingDimension?: number;
};

export type PdfIndexDiskLoadResult = {
  status: 'loaded' | 'built';
  document: PdfIndexDocument;
  message: string;
  rebuiltFrom?: {
    schemaVersion?: string;
    embeddingModelId?: string;
    chunkerVersion?: string;
  } | null;
};

export async function loadOrBuildPdfIndexFromDisk(
  config: PdfIndexDiskConfig
): Promise<PdfIndexDiskLoadResult> {
  const existing = await readPdfIndexFromDisk(config.indexDir);
  if (existing && isCompatible(existing.manifest, config)) {
    return {
      status: 'loaded',
      document: existing.document,
      message: `Loaded compatible PDF index '${existing.manifest.indexId}'.`
    };
  }

  const previousManifest = existing?.manifest;
  const built = await buildPdfIndex(config);
  await writePdfIndexToDisk(config.indexDir, built.manifest, built.chunks);

  return {
    status: 'built',
    document: built.document,
    message: previousManifest
      ? `Rebuilt PDF index due to version incompatibility (${previousManifest.schemaVersion}/${previousManifest.embeddingModelId}/${previousManifest.chunkerVersion} -> ${built.manifest.schemaVersion}/${built.manifest.embeddingModelId}/${built.manifest.chunkerVersion}).`
      : `Built PDF index from ${built.manifest.docCount} source document(s).`,
    rebuiltFrom: previousManifest
      ? {
          schemaVersion: previousManifest.schemaVersion,
          embeddingModelId: previousManifest.embeddingModelId,
          chunkerVersion: previousManifest.chunkerVersion
        }
      : null
  };
}

async function readPdfIndexFromDisk(indexDir: string): Promise<{
  manifest: PdfIndexManifestDisk;
  document: PdfIndexDocument;
} | null> {
  const manifestPath = path.join(indexDir, PDF_INDEX_MANIFEST_FILENAME);
  const chunksPath = path.join(indexDir, PDF_INDEX_CHUNKS_FILENAME);

  let manifestRaw: string;
  let chunksRaw: string;
  try {
    [manifestRaw, chunksRaw] = await Promise.all([
      fs.readFile(manifestPath, 'utf8'),
      fs.readFile(chunksPath, 'utf8')
    ]);
  } catch {
    return null;
  }

  try {
    const manifest = JSON.parse(manifestRaw) as PdfIndexManifestDisk;
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

    const manifestWithCounts: PdfIndexManifestDisk = {
      ...manifest,
      sourceDocs: normalizedSourceDocs,
      docCount: normalizedSourceDocs.length,
      chunkCount: normalizedChunks.length
    };

    return {
      manifest: manifestWithCounts,
      document: createDocument(manifestWithCounts, normalizedChunks)
    };
  } catch {
    return null;
  }
}

async function writePdfIndexToDisk(
  indexDir: string,
  manifest: PdfIndexManifestDisk,
  chunks: PdfIndexChunk[]
): Promise<void> {
  const manifestPath = path.join(indexDir, PDF_INDEX_MANIFEST_FILENAME);
  const chunksPath = path.join(indexDir, PDF_INDEX_CHUNKS_FILENAME);

  await fs.mkdir(indexDir, { recursive: true });
  await Promise.all([
    fs.writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8'),
    fs.writeFile(chunksPath, `${JSON.stringify(chunks, null, 2)}\n`, 'utf8')
  ]);
}

async function buildPdfIndex(config: PdfIndexDiskConfig): Promise<{
  manifest: PdfIndexManifestDisk;
  chunks: PdfIndexChunk[];
  document: PdfIndexDocument;
}> {
  const chunkSizeWords = config.chunkSizeWords ?? PDF_CHUNK_WORDS;
  const chunkOverlapWords = config.chunkOverlapWords ?? PDF_CHUNK_OVERLAP_WORDS;
  const embeddingDimension = config.embeddingDimension ?? PDF_EMBEDDING_DIMENSION;

  if (chunkOverlapWords >= chunkSizeWords) {
    throw new Error('Invalid chunker config: overlap must be smaller than chunk size.');
  }

  const pdfPaths = await listPdfFiles(config.sourcePdfDir);
  if (pdfPaths.length === 0) {
    throw new Error(
      `No PDF files found in '${config.sourcePdfDir}'. ` +
      `Add PDFs there or set PDF_SOURCE_DIR before starting the dev server.`
    );
  }

  const sourceDocs: PdfSourceDoc[] = [];
  const chunks: PdfIndexChunk[] = [];
  const usedDocIds = new Set<string>();

  for (const pdfPath of pdfPaths) {
    const fileBuffer = await fs.readFile(pdfPath);
    const sha256 = createHash('sha256').update(fileBuffer).digest('hex');
    const relativeName = toPosixPath(path.relative(config.sourcePdfDir, pdfPath));
    const docId = uniqueDocId(`doc-${sha256.slice(0, 12)}`, usedDocIds);
    const pages = await extractPagesFromPdf(pdfPath);

    sourceDocs.push({
      docId,
      filename: relativeName,
      sha256,
      pageCount: pages.length
    });

    for (const page of pages) {
      const pageChunks = chunkPageWords({
        docId,
        page: page.page,
        text: page.text,
        chunkSizeWords,
        chunkOverlapWords,
        embeddingDimension
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
        schemaVersion: config.schemaVersion,
        chunkerVersion: config.chunkerVersion,
        embeddingModelId: config.embeddingModelId,
        sourceDocs: sourceDocs.map((doc) => ({
          docId: doc.docId,
          sha256: doc.sha256,
          pageCount: doc.pageCount,
          filename: doc.filename
        })),
        chunkCount: chunks.length
      })
    )
    .digest('hex')
    .slice(0, 16)}`;

  const manifest: PdfIndexManifestDisk = {
    indexId,
    createdAt,
    schemaVersion: config.schemaVersion,
    chunkerVersion: config.chunkerVersion,
    embeddingModelId: config.embeddingModelId,
    sourceDocs,
    docCount: sourceDocs.length,
    chunkCount: chunks.length
  };

  return {
    manifest,
    chunks,
    document: createDocument(manifest, chunks)
  };
}

function createDocument(manifest: PdfIndexManifestDisk, chunks: PdfIndexChunk[]): PdfIndexDocument {
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
    chunks
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

  return {
    docId,
    filename,
    sha256,
    pageCount
  };
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
    ? candidate.embedding.map((value) => Number(value)).filter((value) => Number.isFinite(value))
    : undefined;

  if (!chunkId || !docId || !Number.isFinite(page) || page <= 0 || !text) {
    return null;
  }

  return {
    chunkId,
    docId,
    page,
    text,
    embedding
  };
}

function isCompatible(manifest: PdfIndexManifestDisk, config: PdfIndexDiskConfig): boolean {
  return manifest.schemaVersion === config.schemaVersion
    && manifest.embeddingModelId === config.embeddingModelId
    && manifest.chunkerVersion === config.chunkerVersion;
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
  instructions.push('After installation, restart the dev server and try again.');
  
  return instructions.join('\n');
}

async function extractPagesFromPdf(pdfPath: string): Promise<Array<{ page: number; text: string }>> {
  let stdout: string;
  try {
    ({ stdout } = await execFileAsync('pdftotext', ['-layout', pdfPath, '-'], {
      maxBuffer: 100 * 1024 * 1024
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
      text: normalizeText(pageText)
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
      embedding: buildEmbedding(text, options.embeddingDimension)
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

export async function buildPdfIndexFromBuffer(
  pdfBuffer: Buffer,
  filename: string,
  config: PdfIndexDiskConfig
): Promise<{
  manifest: PdfIndexManifestDisk;
  chunks: PdfIndexChunk[];
  document: PdfIndexDocument;
}> {
  const chunkSizeWords = config.chunkSizeWords ?? PDF_CHUNK_WORDS;
  const chunkOverlapWords = config.chunkOverlapWords ?? PDF_CHUNK_OVERLAP_WORDS;
  const embeddingDimension = config.embeddingDimension ?? PDF_EMBEDDING_DIMENSION;

  if (chunkOverlapWords >= chunkSizeWords) {
    throw new Error('Invalid chunker config: overlap must be smaller than chunk size.');
  }

  // Write buffer to temp file for pdftotext processing
  const tempDir = path.join(config.indexDir, '.temp');
  await fs.mkdir(tempDir, { recursive: true });
  const tempPdfPath = path.join(tempDir, `upload-${Date.now()}-${filename}`);
  
  try {
    await fs.writeFile(tempPdfPath, pdfBuffer);
    
    const sha256 = createHash('sha256').update(pdfBuffer).digest('hex');
    const docId = `doc-${sha256.slice(0, 12)}`;
    const pages = await extractPagesFromPdf(tempPdfPath);

    if (pages.length === 0) {
      throw new Error(`No text content extracted from PDF '${filename}'. The PDF may be scanned images or corrupted.`);
    }

    const sourceDoc: PdfSourceDoc = {
      docId,
      filename,
      sha256,
      pageCount: pages.length
    };

    const chunks: PdfIndexChunk[] = [];
    for (const page of pages) {
      const pageChunks = chunkPageWords({
        docId,
        page: page.page,
        text: page.text,
        chunkSizeWords,
        chunkOverlapWords,
        embeddingDimension
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
          schemaVersion: config.schemaVersion,
          chunkerVersion: config.chunkerVersion,
          embeddingModelId: config.embeddingModelId,
          sourceDocs: [{
            docId: sourceDoc.docId,
            sha256: sourceDoc.sha256,
            pageCount: sourceDoc.pageCount,
            filename: sourceDoc.filename
          }],
          chunkCount: chunks.length
        })
      )
      .digest('hex')
      .slice(0, 16)}`;

    const manifest: PdfIndexManifestDisk = {
      indexId,
      createdAt,
      schemaVersion: config.schemaVersion,
      chunkerVersion: config.chunkerVersion,
      embeddingModelId: config.embeddingModelId,
      sourceDocs: [sourceDoc],
      docCount: 1,
      chunkCount: chunks.length
    };

    // Save to disk
    await writePdfIndexToDisk(config.indexDir, manifest, chunks);
    
    // Copy PDF to source dir for persistence
    const persistentPdfPath = path.join(config.sourcePdfDir, filename);
    await fs.mkdir(config.sourcePdfDir, { recursive: true });
    await fs.copyFile(tempPdfPath, persistentPdfPath);

    return {
      manifest,
      chunks,
      document: createDocument(manifest, chunks)
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

function toPosixPath(value: string): string {
  return value.split(path.sep).join('/');
}
