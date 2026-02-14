import { PDF_EMBEDDING_DIMENSION } from './pdf-index-config';
import { storage } from './storage';
import { PdfIndexChunk, PdfIndexDocument, PdfIndexProvenance } from '../types';

export type RetrievedPdfChunk = {
  text: string;
  docId: string;
  page: number;
  chunkId: string;
  score: number;
};

export function getActivePdfIndexProvenance(
  indexDocument: PdfIndexDocument | null = storage.getPdfIndex()
): PdfIndexProvenance | null {
  if (!indexDocument) {
    return null;
  }

  return {
    indexId: indexDocument.indexId,
    schemaVersion: indexDocument.schemaVersion,
    embeddingModelId: indexDocument.embeddingModelId,
    chunkerVersion: indexDocument.chunkerVersion,
    docCount: indexDocument.docCount,
    chunkCount: indexDocument.chunkCount
  };
}

export function retrievePdfChunks(query: string, k: number): RetrievedPdfChunk[] {
  const normalizedK = Number.isFinite(k) ? Math.max(0, Math.floor(k)) : 0;
  if (!query.trim() || normalizedK === 0) {
    return [];
  }

  const index = storage.getPdfIndex();
  if (!index || index.chunks.length === 0) {
    return [];
  }

  const queryVector = buildEmbedding(query);
  const queryTokens = tokenize(query);

  return index.chunks
    .map((chunk) => ({
      text: chunk.text,
      docId: chunk.docId,
      page: chunk.page,
      chunkId: chunk.chunkId,
      score: scoreChunk(chunk, queryVector, queryTokens)
    }))
    .filter((chunk) => chunk.score > 0)
    .sort((a, b) => {
      const scoreDelta = b.score - a.score;
      if (scoreDelta !== 0) return scoreDelta;

      const docDelta = a.docId.localeCompare(b.docId);
      if (docDelta !== 0) return docDelta;

      const pageDelta = a.page - b.page;
      if (pageDelta !== 0) return pageDelta;

      return a.chunkId.localeCompare(b.chunkId);
    })
    .slice(0, normalizedK);
}

function scoreChunk(chunk: PdfIndexChunk, queryVector: number[], queryTokens: Set<string>): number {
  if (chunk.embedding && chunk.embedding.length === PDF_EMBEDDING_DIMENSION) {
    return cosineSimilarity(queryVector, chunk.embedding);
  }

  if (queryTokens.size === 0) {
    return 0;
  }

  const tokens = tokenize(chunk.text);
  if (tokens.size === 0) {
    return 0;
  }

  let matches = 0;
  for (const token of tokens) {
    if (queryTokens.has(token)) {
      matches += 1;
    }
  }

  return matches / Math.sqrt(tokens.size);
}

function buildEmbedding(text: string): number[] {
  const vector = new Array<number>(PDF_EMBEDDING_DIMENSION).fill(0);
  const tokens = tokenize(text);
  for (const token of tokens) {
    const index = hashToken(token) % PDF_EMBEDDING_DIMENSION;
    vector[index] += 1;
  }

  return normalizeVector(vector);
}

function tokenize(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .map((token) => token.trim())
      .filter((token) => token.length >= 3)
  );
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

function cosineSimilarity(left: number[], right: number[]): number {
  if (left.length === 0 || right.length === 0 || left.length !== right.length) {
    return 0;
  }

  let dotProduct = 0;
  let leftNorm = 0;
  let rightNorm = 0;

  for (let i = 0; i < left.length; i += 1) {
    dotProduct += left[i] * right[i];
    leftNorm += left[i] * left[i];
    rightNorm += right[i] * right[i];
  }

  if (leftNorm === 0 || rightNorm === 0) {
    return 0;
  }

  return dotProduct / (Math.sqrt(leftNorm) * Math.sqrt(rightNorm));
}
