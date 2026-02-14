import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readdir, readFile, mkdir, writeFile, stat } from 'node:fs/promises';
import { basename, resolve, dirname, join, relative } from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const PDF_INDEX_SCHEMA_VERSION = 'pdf-index-schema-v1';

async function checkPreflight() {
  try {
    await execFileAsync('pdftotext', ['-v']);
  } catch (error) {
    const err = /** @type {NodeJS.ErrnoException} */ (error);
    if (err.code === 'ENOENT') {
      throw new Error(
        'PDF text extraction requires pdftotext, which is not installed.\n' +
        getPdftotextInstallInstructions()
      );
    }
    // pdftotext -v returns exit code 99 (shows version), which is expected
  }
}

function getPdftotextInstallInstructions() {
  const platform = process.platform;
  const instructions = [''];
  
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
  instructions.push('After installation, retry the command.');
  
  return instructions.join('\n');
}
const PDF_CHUNKER_VERSION = 'word-window-180-overlap-30-v1';
const PDF_EMBEDDING_MODEL_ID = 'hash-embedding-v1';
const PDF_CHUNK_WORDS = Number(process.argv[4] || 180);
const PDF_CHUNK_OVERLAP_WORDS = Number(process.argv[5] || 30);
const PDF_EMBEDDING_DIMENSION = 24;

const inputPathArg = process.argv[2];
const outputDir = process.argv[3] || resolve(process.cwd(), 'dist/pdf-index');

if (!inputPathArg) {
  console.error('Usage: node scripts/build-pdf-index.mjs <input.pdf|pdf-dir> [outputDir] [chunkWords] [overlapWords]');
  process.exit(1);
}

if (PDF_CHUNK_OVERLAP_WORDS >= PDF_CHUNK_WORDS) {
  console.error('overlapWords must be smaller than chunkWords.');
  process.exit(1);
}

async function main() {
  await checkPreflight();
  
  const inputPath = resolve(process.cwd(), inputPathArg);
  const pdfFiles = await discoverPdfFiles(inputPath);
  if (pdfFiles.length === 0) {
    throw new Error(`No PDF files found at ${inputPath}`);
  }

  const sourceDocs = [];
  const chunks = [];

  for (const pdfPath of pdfFiles) {
    const buffer = await readFile(pdfPath);
    const sha256 = createHash('sha256').update(buffer).digest('hex');
    const pages = await extractPagesFromPdf(pdfPath);
    const filename = pdfFiles.length === 1
      ? basename(pdfPath)
      : toPosixPath(relative(dirname(inputPath), pdfPath));
    const docId = `doc-${sha256.slice(0, 12)}`;

    sourceDocs.push({
      docId,
      filename,
      sha256,
      pageCount: pages.length
    });

    for (const page of pages) {
      chunks.push(...chunkPage({
        docId,
        page: page.page,
        text: page.text,
        chunkSizeWords: PDF_CHUNK_WORDS,
        chunkOverlapWords: PDF_CHUNK_OVERLAP_WORDS
      }));
    }
  }

  sourceDocs.sort((a, b) => a.docId.localeCompare(b.docId));
  chunks.sort((a, b) => {
    const docDelta = a.docId.localeCompare(b.docId);
    if (docDelta !== 0) return docDelta;
    const pageDelta = a.page - b.page;
    if (pageDelta !== 0) return pageDelta;
    return a.chunkId.localeCompare(b.chunkId);
  });

  const createdAt = new Date().toISOString();
  const indexId = `pdf-index-${createHash('sha256').update(JSON.stringify({
    schemaVersion: PDF_INDEX_SCHEMA_VERSION,
    chunkerVersion: PDF_CHUNKER_VERSION,
    embeddingModelId: PDF_EMBEDDING_MODEL_ID,
    sourceDocs,
    chunkCount: chunks.length
  })).digest('hex').slice(0, 16)}`;

  const manifest = {
    indexId,
    createdAt,
    schemaVersion: PDF_INDEX_SCHEMA_VERSION,
    chunkerVersion: PDF_CHUNKER_VERSION,
    embeddingModelId: PDF_EMBEDDING_MODEL_ID,
    sourceDocs,
    docCount: sourceDocs.length,
    chunkCount: chunks.length
  };

  const indexDocument = {
    indexId,
    sourceName: sourceDocs.length === 1 ? sourceDocs[0].filename : `${sourceDocs.length} documents`,
    createdAt,
    schemaVersion: PDF_INDEX_SCHEMA_VERSION,
    chunkerVersion: PDF_CHUNKER_VERSION,
    embeddingModelId: PDF_EMBEDDING_MODEL_ID,
    sourceDocs,
    docCount: sourceDocs.length,
    chunkCount: chunks.length,
    chunks
  };

  await mkdir(outputDir, { recursive: true });
  await Promise.all([
    writeFile(join(outputDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8'),
    writeFile(join(outputDir, 'chunks.json'), `${JSON.stringify(chunks, null, 2)}\n`, 'utf8'),
    writeFile(join(outputDir, 'index.json'), `${JSON.stringify(indexDocument, null, 2)}\n`, 'utf8')
  ]);

  console.log(`PDF index directory: ${outputDir}`);
  console.log(`Index ID: ${indexId}`);
  console.log(`Documents: ${sourceDocs.length}`);
  console.log(`Chunks: ${chunks.length}`);
}

async function discoverPdfFiles(inputPath) {
  const stat = await fileStat(inputPath);
  if (!stat) {
    return [];
  }

  if (stat.isFile() && inputPath.toLowerCase().endsWith('.pdf')) {
    return [inputPath];
  }

  if (!stat.isDirectory()) {
    return [];
  }

  const discovered = [];
  await walkDir(inputPath, discovered);
  discovered.sort((a, b) => a.localeCompare(b));
  return discovered;
}

async function walkDir(dirPath, discovered) {
  const entries = await readdir(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    const entryPath = join(dirPath, entry.name);
    if (entry.isDirectory()) {
      await walkDir(entryPath, discovered);
      continue;
    }

    if (entry.isFile() && entry.name.toLowerCase().endsWith('.pdf')) {
      discovered.push(entryPath);
    }
  }
}

async function fileStat(inputPath) {
  try {
    return await stat(inputPath);
  } catch {
    return null;
  }
}

async function extractPagesFromPdf(pdfPath) {
  let stdout;
  try {
    ({ stdout } = await execFileAsync('pdftotext', ['-layout', pdfPath, '-'], {
      maxBuffer: 100 * 1024 * 1024
    }));
  } catch (error) {
    if (error?.code === 'ENOENT') {
      throw new Error(
        'PDF text extraction requires pdftotext, which is not installed.\n' +
        getPdftotextInstallInstructions()
      );
    }
    throw new Error(`Failed to extract text from PDF: ${error?.message || String(error)}`);
  }

  return stdout
    .split('\f')
    .map((pageText, index) => ({ page: index + 1, text: normalize(pageText) }))
    .filter((page) => page.text.length > 0);
}

function chunkPage(options) {
  const words = options.text.split(/\s+/).filter(Boolean);
  if (words.length === 0) {
    return [];
  }

  const chunks = [];
  const step = Math.max(1, options.chunkSizeWords - options.chunkOverlapWords);
  for (let i = 0; i < words.length; i += step) {
    const slice = words.slice(i, i + options.chunkSizeWords);
    if (slice.length === 0) continue;

    const chunkIndex = Math.floor(i / step) + 1;
    const text = slice.join(' ');
    chunks.push({
      chunkId: `${options.docId}:p${options.page}:c${chunkIndex}`,
      docId: options.docId,
      page: options.page,
      text,
      embedding: buildEmbedding(text)
    });

    if (i + options.chunkSizeWords >= words.length) {
      break;
    }
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
    .map((token) => token.trim())
    .filter((token) => token.length >= 3);
}

function hashToken(token) {
  let hash = 0;
  for (let i = 0; i < token.length; i += 1) {
    hash = (hash * 31 + token.charCodeAt(i)) >>> 0;
  }
  return hash;
}

function normalizeVector(vector) {
  const norm = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));
  if (norm === 0) {
    return vector;
  }

  return vector.map((value) => value / norm);
}

function normalize(text) {
  return text
    .replace(/\u0000/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{2,}/g, '\n')
    .trim();
}

function toPosixPath(value) {
  return value.split('\\').join('/');
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
