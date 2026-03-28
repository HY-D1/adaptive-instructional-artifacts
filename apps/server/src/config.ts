/**
 * Server Configuration
 * Environment-based configuration for SQL-Adapt
 */

import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ============================================================================
// Feature Flags
// ============================================================================

/**
 * Whether PDF index features are enabled
 * Set ENABLE_PDF_INDEX=true to enable PDF upload and indexing
 */
export const ENABLE_PDF_INDEX = process.env.ENABLE_PDF_INDEX === 'true';

/**
 * Whether LLM proxy features are enabled
 * Set ENABLE_LLM=true to enable Ollama proxy endpoints
 */
export const ENABLE_LLM = process.env.ENABLE_LLM === 'true';

/**
 * Ollama base URL for LLM proxy
 * Defaults to localhost:11434 for local development
 */
export const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434';

// ============================================================================
// PDF Index Configuration
// ============================================================================

/**
 * Schema version for PDF index compatibility checking
 */
export const PDF_INDEX_SCHEMA_VERSION = 'pdf-index-schema-v2';

/**
 * Chunker version for tracking text chunking algorithm changes
 */
export const PDF_CHUNKER_VERSION = 'word-window-180-overlap-30-v1';

/**
 * Embedding model ID for tracking embedding algorithm changes
 */
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
 * Directory for PDF index storage
 */
export const PDF_INDEX_DIR = process.env.PDF_INDEX_DIR || 
  path.resolve(__dirname, '../../data/pdf-index');

/**
 * Directory for source PDF files
 */
export const PDF_SOURCE_DIR = process.env.PDF_SOURCE_DIR || 
  path.resolve(__dirname, '../../data/pdfs');

// ============================================================================
// Document Aliases
// ============================================================================

/**
 * Document alias mapping for stable identifiers
 * Maps filename patterns to stable doc aliases
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

// ============================================================================
// Auth Configuration
// ============================================================================

/**
 * Secret used to sign and verify JWT tokens.
 * MUST be set in production. Falls back to a dev-only default locally.
 */
export const JWT_SECRET: string = (() => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('JWT_SECRET must be set in production');
    }
    return 'dev-only-jwt-secret-change-in-production';
  }
  return secret;
})();

/**
 * Code required for instructor signup.
 * Set INSTRUCTOR_SIGNUP_CODE on the backend to protect instructor registration.
 */
export const INSTRUCTOR_SIGNUP_CODE: string =
  process.env.INSTRUCTOR_SIGNUP_CODE || (process.env.NODE_ENV !== 'production' ? 'TeachSQL2024' : '');

/**
 * Code required for student signup.
 * Set STUDENT_SIGNUP_CODE on the backend to gate student account creation.
 */
export const STUDENT_SIGNUP_CODE: string =
  process.env.STUDENT_SIGNUP_CODE || (process.env.NODE_ENV !== 'production' ? 'ClassSQL2024' : '');

// ============================================================================
// Server Configuration
// ============================================================================

export const PORT = parseInt(process.env.PORT || '3001', 10);
export const CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:5173';

const DEFAULT_CORS_ORIGINS = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:4173',
  'http://127.0.0.1:4173',
  'https://adaptive-instructional-artifacts.vercel.app',
];

const DEFAULT_CORS_ORIGIN_PATTERNS = [
  'https://adaptive-instructional-artifacts-*.vercel.app',
];

function parseCsv(value: string | undefined): string[] {
  if (!value) return [];
  return value
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function normalizeOriginValue(value: string): string {
  return value.replace(/\/+$/, '');
}

const explicitCorsOrigins = parseCsv(process.env.CORS_ORIGINS).map(normalizeOriginValue);
const explicitCorsPatterns = parseCsv(process.env.CORS_ORIGIN_PATTERNS).map(normalizeOriginValue);

export const CORS_ORIGINS = Array.from(
  new Set(
    (
      explicitCorsOrigins.length > 0
        ? explicitCorsOrigins
        : [...DEFAULT_CORS_ORIGINS, CORS_ORIGIN]
    ).map(normalizeOriginValue),
  ),
);
export const CORS_ORIGIN_PATTERNS = Array.from(
  new Set((explicitCorsPatterns.length > 0 ? explicitCorsPatterns : DEFAULT_CORS_ORIGIN_PATTERNS).map(normalizeOriginValue)),
);
export const NODE_ENV = process.env.NODE_ENV || 'development';

// ============================================================================
// Feature Status Helper
// ============================================================================

export interface FeatureStatus {
  pdfIndex: {
    enabled: boolean;
    available: boolean;
    message: string;
  };
  llm: {
    enabled: boolean;
    available: boolean;
    message: string;
    ollamaUrl: string;
  };
}

// Define interface for Ollama tags response
interface OllamaTagsResponse {
  models?: Array<{ name?: string }>;
}

/**
 * Get current feature status for health checks
 */
export async function getFeatureStatus(): Promise<FeatureStatus> {
  const status: FeatureStatus = {
    pdfIndex: {
      enabled: ENABLE_PDF_INDEX,
      available: false,
      message: ENABLE_PDF_INDEX 
        ? 'PDF index enabled but not yet initialized'
        : 'PDF index disabled (set ENABLE_PDF_INDEX=true to enable)',
    },
    llm: {
      enabled: ENABLE_LLM,
      available: false,
      message: ENABLE_LLM
        ? 'LLM enabled but Ollama not yet checked'
        : 'LLM disabled (set ENABLE_LLM=true to enable)',
      ollamaUrl: ENABLE_LLM ? OLLAMA_BASE_URL : '',
    },
  };

  // Check Ollama availability if enabled
  if (ENABLE_LLM) {
    try {
      const response = await fetch(`${OLLAMA_BASE_URL}/api/tags`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000),
      });
      if (response.ok) {
        const data = await response.json() as OllamaTagsResponse;
        const models = Array.isArray(data?.models) ? data.models : [];
        status.llm.available = true;
        status.llm.message = `Ollama connected with ${models.length} model(s) available`;
      } else {
        status.llm.message = `Ollama responded with status ${response.status}`;
      }
    } catch (error) {
      status.llm.message = `Ollama not reachable at ${OLLAMA_BASE_URL}: ${(error as Error).message}`;
    }
  }

  return status;
}
