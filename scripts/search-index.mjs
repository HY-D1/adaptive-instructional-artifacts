import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const indexPath = process.argv[2];
const query = process.argv.slice(3).join(' ').trim();
const topK = Number(process.env.TOP_K || 5);

if (!indexPath || !query) {
  console.error('Usage: node scripts/search-index.mjs <index.json> <query terms>');
  process.exit(1);
}

async function main() {
  const raw = await readFile(resolve(process.cwd(), indexPath), 'utf8');
  const index = JSON.parse(raw);
  const keywords = tokenize(query);

  const ranked = (index.chunks || [])
    .map((chunk) => {
      const tokens = tokenize(chunk.text || '');
      let matchCount = 0;
      for (const token of tokens) {
        if (keywords.has(token)) {
          matchCount += 1;
        }
      }
      return {
        chunkId: chunk.chunkId,
        page: chunk.page,
        score: matchCount,
        snippet: (chunk.text || '').slice(0, 220)
      };
    })
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);

  console.log(JSON.stringify({ query, topK, results: ranked }, null, 2));
}

function tokenize(text) {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .map((token) => token.trim())
      .filter((token) => token.length >= 3)
  );
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
