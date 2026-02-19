/**
 * PDF Index Configuration Constants
 * @module pdf-index-config
 */

/**
 * Schema version for PDF index compatibility checking
 */
export const PDF_INDEX_SCHEMA_VERSION = 'pdf-index-schema-v1';
export const PDF_CHUNKER_VERSION = 'word-window-180-overlap-30-v1';
export const PDF_EMBEDDING_MODEL_ID = 'hash-embedding-v1';

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
