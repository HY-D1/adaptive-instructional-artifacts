/**
 * PDF Index Configuration Constants
 * @module pdf-index-config
 */

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
/**
 * API endpoint for loading PDF index
 */
export const PDF_INDEX_LOAD_ENDPOINT = '/api/pdf-index/load';
/**
 * API endpoint for uploading PDF and building index
 */
export const PDF_INDEX_UPLOAD_ENDPOINT = '/api/pdf-index/upload';
