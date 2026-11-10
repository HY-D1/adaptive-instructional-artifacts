/**
 * PDF Index Configuration and Client
 * @module pdf-index-config
 * 
 * This module provides:
 * - Configuration constants for PDF indexing
 * - Client functions for interacting with the backend PDF index API
 * - Feature detection for hosted vs local mode
 */

// ============================================================================
// Configuration Constants
// ============================================================================

/**
 * Schema version for PDF index compatibility checking
 * Updated to v2 for SourceRef contract with stable doc aliases
 */
export const PDF_INDEX_SCHEMA_VERSION = 'pdf-index-schema-v2';
export const PDF_CHUNKER_VERSION = 'word-window-180-overlap-30-v1';
export const PDF_EMBEDDING_MODEL_ID = 'hash-embedding-v1';

/**
 * Document alias mapping for stable identifiers
 * Maps filename patterns to stable doc aliases
 * This ensures concept registry and PDF index use the same docIds
 */
export const PDF_DOC_ALIASES: Record<string, string> = {
  // Exact filename matches
  'SQL_Course_Textbook.pdf': 'sql-textbook',
  'sql-course-textbook.pdf': 'sql-textbook',
  'murachs-mysql-3rd-edition.pdf': 'murachs-mysql',
  'reference_book.pdf': 'reference-book',
  // Add more mappings as needed
};

/**
 * Get stable doc alias for a filename
 * Uses explicit mapping if available, otherwise sanitizes filename
 * @param filename - Original PDF filename
 * @returns Stable doc alias
 */
export function getDocAlias(filename: string): string {
  // Check exact match first
  if (PDF_DOC_ALIASES[filename]) {
    return PDF_DOC_ALIASES[filename];
  }
  
  // Check case-insensitive match
  const lowerFilename = filename.toLowerCase();
  for (const [key, alias] of Object.entries(PDF_DOC_ALIASES)) {
    if (key.toLowerCase() === lowerFilename) {
      return alias;
    }
  }
  
  // Default: sanitize filename (remove extension, lowercase, replace non-alphanumeric with hyphen)
  return filename
    .replace(/\.pdf$/i, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, ''); // Trim leading/trailing hyphens
}

/**
 * Number of words per PDF chunk
 */
export const PDF_CHUNK_WORDS = 180;
/**
 * Number of overlapping words between chunks for continuity
 */
export const PDF_CHUNK_OVERLAP_WORDS = 30;
/**
 * Dimension of hash-based embedding vectors
 */
export const PDF_EMBEDDING_DIMENSION = 24;

/**
 * Filename for PDF index manifest
 */
export const PDF_INDEX_MANIFEST_FILENAME = 'manifest.json';
/**
 * Filename for PDF index chunks
 */
export const PDF_INDEX_CHUNKS_FILENAME = 'chunks.json';

// ============================================================================
// API Endpoints
// ============================================================================

/**
 * Base URL for API requests
 * In development, this is empty (same origin with Vite proxy)
 * In production, this should point to the backend server
 *
 * NOTE: This file is imported by vite.config.ts (Node.js context) where
 * import.meta.env is not available. We safely check for its existence.
 *
 * The 'same-origin' sentinel (see runtime-config's SAME_ORIGIN_API_SENTINEL) is
 * resolved to '' here so endpoints become relative paths. It is inlined rather
 * than imported to keep this module safe to load in the Node/vite.config context.
 */
const _RAW_API_BASE = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_BASE_URL)
  ? import.meta.env.VITE_API_BASE_URL
  : '';
const API_BASE_URL = _RAW_API_BASE.trim().toLowerCase() === 'same-origin' ? '' : _RAW_API_BASE;

/**
 * API endpoint for loading PDF index
 */
export const PDF_INDEX_LOAD_ENDPOINT = `${API_BASE_URL}/api/pdf-index/load`;
/**
 * API endpoint for uploading PDF and building index
 */
export const PDF_INDEX_UPLOAD_ENDPOINT = `${API_BASE_URL}/api/pdf-index/upload`;
/**
 * API endpoint for PDF index status
 */
export const PDF_INDEX_STATUS_ENDPOINT = `${API_BASE_URL}/api/pdf-index/status`;

// ============================================================================
// Feature Detection
// ============================================================================

// ============================================================================
// Client Functions
// ============================================================================

/**
 * Load or build PDF index from the backend
 * @returns Promise with the loaded/built document
 */
export async function loadPdfIndex(): Promise<{
  status: 'loaded' | 'built';
  document: {
    indexId: string;
    sourceName: string;
    createdAt: string;
    chunks: Array<{
      chunkId: string;
      docId: string;
      page: number;
      text: string;
    }>;
  };
  message: string;
}> {
  const response = await fetch(PDF_INDEX_LOAD_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    signal: AbortSignal.timeout(60000), // 60s timeout for building index
  });
  
  if (!response.ok) {
    if (response.status === 503) {
      throw new Error('PDF index is not enabled on the backend. Set ENABLE_PDF_INDEX=true to enable.');
    }
    const error = await response.json().catch(() => ({ message: 'Unknown error' }));
    throw new Error(error.message || `Failed to load PDF index: ${response.status}`);
  }
  
  const data = await response.json();
  
  if (!data.success) {
    throw new Error(data.message || 'Failed to load PDF index');
  }
  
  return data.data;
}

// ============================================================================
// Feature Flags (Environment-based)
// ============================================================================
