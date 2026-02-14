import {
  PDF_CHUNKER_VERSION,
  PDF_EMBEDDING_MODEL_ID,
  PDF_INDEX_LOAD_ENDPOINT,
  PDF_INDEX_SCHEMA_VERSION
} from './pdf-index-config';
import { PdfIndexDocument } from '../types';

export type PdfIndexLoadResponse = {
  status: 'loaded' | 'built';
  document: PdfIndexDocument;
  message?: string;
  rebuiltFrom?: {
    schemaVersion?: string;
    embeddingModelId?: string;
    chunkerVersion?: string;
  } | null;
};

export async function loadOrBuildPdfIndex(): Promise<PdfIndexLoadResponse> {
  let response: Response;
  try {
    response = await fetch(PDF_INDEX_LOAD_ENDPOINT, {
      method: 'POST'
    });
  } catch (error) {
    throw new Error(
      `Unable to reach PDF index service at ${PDF_INDEX_LOAD_ENDPOINT}. ` +
      `Run the app with 'npm run dev' and ensure the Vite server is up. ` +
      `Details: ${(error as Error).message}`
    );
  }

  let payload: PdfIndexLoadResponse | { error?: string };
  try {
    payload = await response.json();
  } catch {
    throw new Error('PDF index service returned a non-JSON response.');
  }

  if (!response.ok) {
    const errorMessage = (payload as { error?: string }).error || 'Unknown PDF index load failure.';
    throw new Error(errorMessage);
  }

  const typedPayload = payload as PdfIndexLoadResponse;
  assertPdfIndexContract(typedPayload.document);

  return typedPayload;
}

function assertPdfIndexContract(document: PdfIndexDocument) {
  if (!document) {
    throw new Error('PDF index payload is missing.');
  }

  if (!Array.isArray(document.sourceDocs) || document.sourceDocs.length === 0) {
    throw new Error('PDF index manifest must include at least one source document.');
  }

  if (!Array.isArray(document.chunks) || document.chunks.length === 0) {
    throw new Error('PDF index must include non-empty chunk data.');
  }

  const hasMissingChunkMetadata = document.chunks.some((chunk) => {
    return !chunk.docId || !chunk.chunkId || !Number.isFinite(chunk.page);
  });
  if (hasMissingChunkMetadata) {
    throw new Error('Every PDF chunk must include docId, page, and chunkId metadata.');
  }

  if (document.schemaVersion !== PDF_INDEX_SCHEMA_VERSION) {
    throw new Error(
      `Incompatible PDF index schema version: expected '${PDF_INDEX_SCHEMA_VERSION}', got '${document.schemaVersion}'.`
    );
  }

  if (document.embeddingModelId !== PDF_EMBEDDING_MODEL_ID) {
    throw new Error(
      `Incompatible PDF embedding model: expected '${PDF_EMBEDDING_MODEL_ID}', got '${document.embeddingModelId}'.`
    );
  }

  if (document.chunkerVersion !== PDF_CHUNKER_VERSION) {
    throw new Error(
      `Incompatible PDF chunker version: expected '${PDF_CHUNKER_VERSION}', got '${document.chunkerVersion}'.`
    );
  }
}
