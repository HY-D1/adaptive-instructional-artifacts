import { execFile } from 'node:child_process';
import { basename, resolve, dirname } from 'node:path';
import { promisify } from 'node:util';
import { mkdir, writeFile } from 'node:fs/promises';

const execFileAsync = promisify(execFile);

const inputPath = process.argv[2];
const outputPath = process.argv[3] || resolve(process.cwd(), 'dist/pdf-index.json');
const chunkSizeWords = Number(process.argv[4] || 180);
const chunkOverlapWords = Number(process.argv[5] || 30);

if (!inputPath) {
  console.error('Usage: node scripts/build-pdf-index.mjs <input.pdf> [output.json] [chunkWords] [overlapWords]');
  process.exit(1);
}

if (chunkOverlapWords >= chunkSizeWords) {
  console.error('overlapWords must be smaller than chunkWords.');
  process.exit(1);
}

async function main() {
  const pdfPath = resolve(process.cwd(), inputPath);

  let stdout;
  try {
    ({ stdout } = await execFileAsync('pdftotext', ['-layout', pdfPath, '-'], {
      maxBuffer: 50 * 1024 * 1024
    }));
  } catch (error) {
    const message = error?.code === 'ENOENT'
      ? 'pdftotext is not installed. Install Poppler and retry.'
      : `Failed to extract text from PDF: ${error?.message || String(error)}`;
    throw new Error(message);
  }

  const pages = stdout
    .split('\f')
    .map((pageText, index) => ({ page: index + 1, text: normalize(pageText) }))
    .filter((page) => page.text.length > 0);

  const chunks = [];
  for (const page of pages) {
    const words = page.text.split(/\s+/).filter(Boolean);
    if (words.length === 0) continue;

    const step = Math.max(1, chunkSizeWords - chunkOverlapWords);
    for (let i = 0; i < words.length; i += step) {
      const slice = words.slice(i, i + chunkSizeWords);
      if (slice.length === 0) continue;
      const chunkIndex = Math.floor(i / step) + 1;
      chunks.push({
        chunkId: `pdf:${page.page}:${chunkIndex}`,
        page: page.page,
        text: slice.join(' ')
      });
      if (i + chunkSizeWords >= words.length) {
        break;
      }
    }
  }

  const payload = {
    sourceName: basename(pdfPath),
    createdAt: new Date().toISOString(),
    chunking: {
      chunkSizeWords,
      chunkOverlapWords
    },
    chunks
  };

  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');

  console.log(`PDF index written: ${outputPath}`);
  console.log(`Pages indexed: ${pages.length}`);
  console.log(`Chunks: ${chunks.length}`);
}

function normalize(text) {
  return text
    .replace(/\u0000/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{2,}/g, '\n')
    .trim();
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
