import { storage } from '../storage/storage';
import type { PdfIndexChunk, SQLProblem } from '../../types';
import { sqlProblems } from '../../data/problems';
import { CONCEPT_COMPATIBILITY_MAP, getCompatibleCorpusIds } from './concept-compatibility-map';
import {
  fetchCorpusManifestWithUnits,
  fetchCorpusUnit,
  type RemoteCorpusUnit,
} from '../api/storage-client';

export { getCompatibleCorpusIds };

// Types

/**
 * Helper-produced quality metadata. When present this takes precedence over
 * the local heuristics in assessConceptQuality so adaptive does not duplicate
 * work that the upstream helper already computed.
 */
export interface QualityMetadata {
  /** Overall readability of the explanation text. */
  readabilityStatus: 'clean' | 'garbled' | 'partial' | 'fallback_only';
  /** Short learner-safe summary to show instead of the garbled explanation. */
  learnerSafeSummary?: string;
  /** Key points for learner-safe fallback mode (bulleted list). */
  learnerSafeKeyPoints?: string[];
  /** Verified examples for learner-safe fallback mode. */
  learnerSafeExamples?: Array<{
    title: string;
    sql?: string;
    explanation?: string;
  }>;
  /** Whether code examples passed a basic sanity check. */
  exampleQuality?: 'clean' | 'contaminated' | 'partial';
}

export interface ConceptInfo {
  id: string;
  title: string;
  definition: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  estimatedReadTime: number;
  pageNumbers: number[];
  chunkIds: {
    definition: string[];
    examples: string[];
    commonMistakes: string[];
  };
  relatedConcepts: string[];
  practiceProblemIds: string[];
  // Helper export may include sourceDocId for namespaced concepts
  sourceDocId?: string;
  /** Optional quality metadata produced by the upstream helper pipeline. */
  qualityMetadata?: QualityMetadata;
}

export interface LoadedConcept extends ConceptInfo {
  content: {
    definition: string;
    explanation: string;
    examples: CodeExample[];
    commonMistakes: Mistake[];
  };
}

export interface CodeExample {
  title: string;
  code: string;
  explanation: string;
  output?: string;
}

export interface Mistake {
  title: string;
  incorrect: string;
  correct: string;
  why: string;
}

interface ConceptMapData {
  version: string;
  generatedAt: string;
  sourceDocId?: string;
  // Helper export uses sourceDocIds array for multi-doc exports
  sourceDocIds?: string[];
  concepts: Record<string, ConceptInfo>;
}

/**
 * Normalized internal shape of concept quality metadata, used throughout the app.
 * Both the legacy placeholder schema and the real helper v1 schema are normalized
 * into this shape at load time.
 */
export interface ConceptQualityFile {
  version: string;
  generatedAt: string;
  /** Keys are the full namespaced concept IDs used in concept-map.json. */
  quality: Record<string, QualityMetadata>;
}

/**
 * Shape of apps/web/public/textbook-static/textbook-units.json (normalized).
 * Both legacy placeholder and real helper v1 schema are normalized into this shape.
 */
export interface TextbookUnitMeta {
  /** Full namespaced concept ID, e.g. "murachs-mysql-3rd-edition/select-basic". */
  id: string;
  sourceDocId?: string;
  chapterNumber?: number;
  sectionTitle?: string;
  displayOrder?: number;
}

export interface TextbookUnitsFile {
  version: string;
  generatedAt: string;
  units: TextbookUnitMeta[];
}

// ─── Schema normalization (private) ─────────────────────────────────────────
// Supports two on-disk formats:
//   Legacy placeholder  — { version, quality: Record<id, QualityMetadata> }
//   Helper v1           — { schemaVersion: "concept-quality-v1", qualityByConcept: Record<id, {...}> }
// Both are normalized into ConceptQualityFile / TextbookUnitsFile at load time.

function normalizeConceptQualityFile(raw: Record<string, unknown>): ConceptQualityFile {
  if ((raw as { schemaVersion?: string }).schemaVersion === 'concept-quality-v1') {
    const qualityByConcept = (raw as { qualityByConcept: Record<string, {
      readabilityStatus: 'ok' | 'fallback_only';
      exampleQuality?: 'valid' | 'filtered';
      learnerSafeSummary?: string;
      learnerSafeKeyPoints?: string[];
      learnerSafeExamples?: Array<{ title: string; sql?: string; explanation?: string }>;
    }> }).qualityByConcept;
    const quality: Record<string, QualityMetadata> = {};
    for (const [id, entry] of Object.entries(qualityByConcept)) {
      // Map helper v1 readabilityStatus to internal shape
      // 'ok' -> 'clean', 'fallback_only' -> 'fallback_only' (preserved)
      const readabilityStatus = entry.readabilityStatus === 'ok' ? 'clean' : 'fallback_only';
      quality[id] = {
        readabilityStatus,
        learnerSafeSummary: entry.learnerSafeSummary,
        learnerSafeKeyPoints: entry.learnerSafeKeyPoints,
        learnerSafeExamples: entry.learnerSafeExamples,
        exampleQuality:
          entry.exampleQuality === 'valid'
            ? 'clean'
            : entry.exampleQuality === 'filtered'
            ? 'contaminated'
            : undefined,
      };
    }
    return {
      version: 'concept-quality-v1',
      generatedAt: (raw as { generatedAt?: string }).generatedAt ?? '',
      quality,
    };
  }
  // Legacy schema — passes through as-is
  return raw as unknown as ConceptQualityFile;
}

function normalizeTextbookUnitsFile(raw: Record<string, unknown>): TextbookUnitsFile {
  if ((raw as { schemaVersion?: string }).schemaVersion === 'textbook-units-v1') {
    const rawUnits = (raw as { units: Array<{
      namespacedId: string;
      sourceDocId?: string;
      shortExcerpt?: string;
      sourceOrder?: number;
    }> }).units;
    const units: TextbookUnitMeta[] = rawUnits.map(u => ({
      id: u.namespacedId,
      sourceDocId: u.sourceDocId,
      sectionTitle: u.shortExcerpt,
      displayOrder: typeof u.sourceOrder === 'number' ? u.sourceOrder : undefined,
    }));
    return {
      version: 'textbook-units-v1',
      generatedAt: (raw as { generatedAt?: string }).generatedAt ?? '',
      units,
    };
  }
  // Legacy schema — passes through as-is
  return raw as unknown as TextbookUnitsFile;
}

// Cache
let conceptMapCache: ConceptMapData | null = null;
let conceptQualityCache: ConceptQualityFile | null | false = false; // false = not yet fetched
let textbookUnitsCache: TextbookUnitsFile | null | false = false;   // false = not yet fetched
let remoteConceptToUnitId: Record<string, string> = {};

function normalizeDifficulty(value: string | null | undefined): ConceptInfo['difficulty'] {
  if (value === 'beginner' || value === 'intermediate' || value === 'advanced') {
    return value;
  }
  return 'intermediate';
}

export function getTextbookCorpusMode(): 'remote' | 'static' {
  const mode = String(import.meta.env.VITE_TEXTBOOK_CORPUS_MODE ?? 'static').trim().toLowerCase();
  return mode === 'remote' ? 'remote' : 'static';
}

function buildConceptMapFromRemoteUnits(units: RemoteCorpusUnit[]): ConceptMapData | null {
  if (!units.length) return null;

  const concepts: Record<string, ConceptInfo> = {};
  const conceptToUnit: Record<string, string> = {};
  for (const unit of units) {
    const conceptKey = unit.conceptId || unit.unitId;
    const summary = unit.summary || '';
    const estimatedReadTime = Math.max(1, Math.ceil(summary.split(/\s+/).filter(Boolean).length / 180));
    concepts[conceptKey] = {
      id: conceptKey,
      title: unit.title,
      definition: summary,
      difficulty: normalizeDifficulty(unit.difficulty),
      estimatedReadTime,
      pageNumbers: [unit.pageStart, unit.pageEnd].filter((v, idx, arr) => Number.isFinite(v) && arr.indexOf(v) === idx),
      chunkIds: {
        definition: [],
        examples: [],
        commonMistakes: [],
      },
      relatedConcepts: [],
      practiceProblemIds: [],
      sourceDocId: unit.docId,
    };
    conceptToUnit[conceptKey] = unit.unitId;
  }

  remoteConceptToUnitId = conceptToUnit;
  return {
    version: 'remote-corpus-v1',
    generatedAt: new Date().toISOString(),
    sourceDocIds: Array.from(new Set(units.map((u) => u.docId))),
    concepts,
  };
}

/**
 * Clear the concept map cache. Used for testing.
 */
export function clearConceptMapCache(): void {
  conceptMapCache = null;
  conceptQualityCache = false;
  textbookUnitsCache = false;
  remoteConceptToUnitId = {};
}

/**
 * Resolve a potentially namespaced concept ID to the canonical form.
 * 
 * Helper exports use namespaced IDs like "docId/conceptId" (e.g., "murachs-mysql-3rd-edition/select-basic").
 * This function resolves such IDs to match the keys in concept-map.json.
 * 
 * Resolution strategy:
 * 1. Exact match (for already-canonical corpus keys or legacy flat IDs)
 * 2. Compatibility map (concept-compatibility-map.ts) — deterministic internal→corpus mapping;
 *    returns the first entry that actually exists in the loaded corpus
 * 3. Namespaced-input suffix strip (docId/conceptId → try flat legacy key)
 * 4. Flat-input suffix scan — find a unique corpus key ending with /${conceptId}
 * 5. Return original ID if nothing resolves (caller handles not-found)
 */
export function resolveConceptId(
  conceptId: string,
  availableConcepts: Record<string, ConceptInfo>
): string {
  // 1. Exact match
  if (availableConcepts[conceptId]) {
    return conceptId;
  }

  // 2. Compatibility map: deterministic internal-ID → corpus-key resolution
  //    Skipped for namespaced inputs (those go through step 3/4).
  if (!conceptId.includes('/')) {
    const candidates = CONCEPT_COMPATIBILITY_MAP[conceptId];
    if (candidates) {
      for (const candidate of candidates) {
        if (availableConcepts[candidate]) {
          return candidate;
        }
      }
    }
  }

  // 3. Input is namespaced (docId/conceptId) — try suffix as flat legacy key
  if (conceptId.includes('/')) {
    const suffix = conceptId.split('/').pop()!;
    if (availableConcepts[suffix]) {
      return suffix;
    }
    // Return original for direct namespaced lookup
    return conceptId;
  }

  // 4. Flat input: find a unique corpus key whose suffix equals this ID
  const allKeys = Object.keys(availableConcepts);
  const matchingKeys = allKeys.filter(key => key === conceptId || key.endsWith(`/${conceptId}`));

  if (matchingKeys.length === 1) {
    return matchingKeys[0];
  }

  if (matchingKeys.length > 1) {
    console.warn(
      `[resolveConceptId] Ambiguous concept ID "${conceptId}" matches multiple keys: ${matchingKeys.join(', ')}`
    );
  }

  // 5. No resolution found — return original for error handling
  return conceptId;
}

/**
 * Resolve concept ID to file path for markdown fetch.
 * 
 * Helper exports store files as concepts/{docId}/{conceptId}.md
 * Legacy format stores files as concepts/{conceptId}.md
 * 
 * This returns the path to attempt fetching, trying legacy first then helper format.
 */
function resolveConceptFilePath(conceptId: string, conceptInfo?: ConceptInfo | null): string[] {
  const paths: string[] = [];
  
  // If we have concept info with sourceDocId, try helper format first
  if (conceptInfo?.sourceDocId) {
    const plainId = conceptId.includes('/') 
      ? conceptId.split('/').pop()! 
      : conceptId;
    paths.push(`concepts/${conceptInfo.sourceDocId}/${plainId}.md`);
  }
  
  // Try flat path (legacy format)
  if (!conceptId.includes('/')) {
    paths.push(`concepts/${conceptId}.md`);
  } else {
    // Try full namespaced path as-is
    paths.push(`concepts/${conceptId}.md`);
    // Also try suffix-only
    const suffix = conceptId.split('/').pop()!;
    paths.push(`concepts/${suffix}.md`);
  }
  
  return paths;
}

/**
 * Load concept map
 */
export async function loadConceptMap(): Promise<ConceptMapData | null> {
  if (conceptMapCache) {
    return conceptMapCache;
  }

  if (getTextbookCorpusMode() === 'remote') {
    try {
      const manifest = await fetchCorpusManifestWithUnits();
      const remoteMap = buildConceptMapFromRemoteUnits(manifest?.units ?? []);
      if (remoteMap) {
        conceptMapCache = remoteMap;
        console.info('[corpus] mode=remote source=remote documents=%d units=%d', manifest?.documents.length ?? 0, manifest?.units.length ?? 0);
        return conceptMapCache;
      }
      console.warn('[corpus] mode=remote but no remote units found; falling back to static textbook corpus');
    } catch {
      console.warn('[corpus] mode=remote manifest fetch failed; falling back to static textbook corpus');
    }
  }

  try {
    const response = await fetch('/textbook-static/concept-map.json');
    if (!response.ok) return null;
    conceptMapCache = await response.json();
    console.info('[corpus] mode=%s source=static', getTextbookCorpusMode());
    return conceptMapCache;
  } catch {
    return null;
  }
}

/**
 * Load the helper-produced concept-quality.json.
 *
 * Returns null when the file is absent (corpus predates the quality pipeline).
 * Entries here take precedence over qualityMetadata embedded in concept-map.json.
 * Results are cached for the page lifetime.
 */
export async function loadConceptQuality(): Promise<ConceptQualityFile | null> {
  if (conceptQualityCache !== false) return conceptQualityCache;
  try {
    const res = await fetch('/textbook-static/concept-quality.json');
    if (!res.ok) {
      conceptQualityCache = null;
    } else {
      const raw = await res.json() as Record<string, unknown>;
      conceptQualityCache = normalizeConceptQualityFile(raw);
    }
  } catch {
    conceptQualityCache = null;
  }
  return conceptQualityCache;
}

/**
 * Load the helper-produced textbook-units.json.
 *
 * Returns null when the file is absent.
 * Results are cached for the page lifetime.
 */
export async function loadTextbookUnitsMeta(): Promise<TextbookUnitsFile | null> {
  if (textbookUnitsCache !== false) return textbookUnitsCache;

  if (getTextbookCorpusMode() === 'remote') {
    try {
      const manifest = await fetchCorpusManifestWithUnits();
      if (manifest?.units?.length) {
        textbookUnitsCache = {
          version: 'remote-corpus-v1',
          generatedAt: new Date().toISOString(),
          units: manifest.units.map((u) => ({
            id: u.conceptId || u.unitId,
            sourceDocId: u.docId,
            sectionTitle: u.title,
            displayOrder: undefined,
          })),
        };
        return textbookUnitsCache;
      }
    } catch {
      // fallback to static below
    }
  }

  try {
    const res = await fetch('/textbook-static/textbook-units.json');
    if (!res.ok) {
      textbookUnitsCache = null;
    } else {
      const raw = await res.json() as Record<string, unknown>;
      textbookUnitsCache = normalizeTextbookUnitsFile(raw);
    }
  } catch {
    textbookUnitsCache = null;
  }
  return textbookUnitsCache;
}

/**
 * Get single concept info with alias resolution.
 *
 * Supports both plain concept IDs ("select-basic") and namespaced IDs
 * ("murachs-mysql-3rd-edition/select-basic").
 *
 * Quality metadata priority (highest → lowest):
 *   1. concept-quality.json entry (helper pipeline, fetched once and cached)
 *   2. qualityMetadata embedded in concept-map.json
 *   3. Absent (assessConceptQuality falls back to local heuristics)
 */
export async function getConcept(conceptId: string): Promise<ConceptInfo | null> {
  const [map, qualityFile] = await Promise.all([
    loadConceptMap(),
    loadConceptQuality(),
  ]);
  if (!map) return null;

  const resolvedId = resolveConceptId(conceptId, map.concepts);
  const concept = map.concepts[resolvedId] || null;
  if (!concept) return null;

  // Merge quality metadata: concept-quality.json wins over embedded per-concept metadata.
  const producerQuality = qualityFile?.quality?.[resolvedId];
  const mergedQuality: QualityMetadata | undefined =
    producerQuality ?? concept.qualityMetadata;

  const result: ConceptInfo = {
    ...concept,
    ...(mergedQuality !== undefined ? { qualityMetadata: mergedQuality } : {}),
    // Preserve the original requested ID for URL consistency
    ...(resolvedId !== conceptId ? { id: conceptId } : {}),
  };

  return result;
}

/**
 * Load full concept with parsed content
 */
export async function loadConceptContent(conceptId: string): Promise<LoadedConcept | null> {
  const concept = await getConcept(conceptId);
  if (!concept) return null;

  let markdown: string | null = null;

  if (getTextbookCorpusMode() === 'remote') {
    const map = await loadConceptMap();
    const resolvedId = map ? resolveConceptId(conceptId, map.concepts) : conceptId;
    const unitId = remoteConceptToUnitId[resolvedId] || remoteConceptToUnitId[concept.id] || resolvedId;
    const remote = await fetchCorpusUnit(unitId);
    if (remote?.unit?.contentMarkdown) {
      markdown = remote.unit.contentMarkdown;
      console.info('[corpus] corpus_mode=remote corpus_source=remote corpus_doc_id=%s corpus_unit_id=%s', remote.unit.docId, remote.unit.unitId);
    }
  }

  if (!markdown) {
    markdown = await fetchConceptMarkdown(conceptId, concept);
    if (markdown) {
      console.info('[corpus] corpus_mode=%s corpus_source=static', getTextbookCorpusMode());
    }
  }

  if (!markdown) return null;
  
  return {
    ...concept,
    content: parseMarkdownContent(markdown)
  };
}

/**
 * Fetch raw markdown with multi-path resolution.
 * 
 * Tries multiple file paths to support both legacy flat structure
 * and helper-exported nested structure.
 */
async function fetchConceptMarkdown(
  conceptId: string,
  conceptInfo?: ConceptInfo | null
): Promise<string | null> {
  const paths = resolveConceptFilePath(conceptId, conceptInfo);
  
  for (const path of paths) {
    try {
      const response = await fetch(`/textbook-static/${path}`);
      if (response.ok) {
        return response.text();
      }
    } catch {
      // Continue to next path
    }
  }
  
  return null;
}

/**
 * Parse markdown into structured content
 */
function parseMarkdownContent(markdown: string): LoadedConcept['content'] {
  const lines = markdown.split('\n');
  let currentSection = '';
  let sectionContent: string[] = [];
  const sections: Record<string, string> = {};
  
  for (const line of lines) {
    if (line.startsWith('## ')) {
      if (currentSection) {
        sections[currentSection] = sectionContent.join('\n').trim();
      }
      currentSection = line.replace('## ', '').trim();
      sectionContent = [];
    } else {
      sectionContent.push(line);
    }
  }
  if (currentSection) {
    sections[currentSection] = sectionContent.join('\n').trim();
  }
  
  // Handle both old format (Definition/Explanation) and new pedagogical format (What is This?)
  const definition = sections['Definition'] || sections['What is This?'] || '';
  const explanation = sections['Explanation'] || sections['What is This?'] || definition || '';
  
  return {
    definition,
    explanation,
    examples: parseExamples(sections['Examples'] || ''),
    commonMistakes: parseMistakes(sections['Common Mistakes'] || '')
  };
}

function parseExamples(section: string): CodeExample[] {
  const examples: CodeExample[] = [];
  const lines = section.split('\n');
  let currentExample: Partial<CodeExample> = {};
  let inCodeBlock = false;
  let codeContent: string[] = [];
  
  for (const line of lines) {
    if (line.startsWith('### ')) {
      if (currentExample.title) {
        currentExample.code = codeContent.join('\n').trim();
        examples.push(currentExample as CodeExample);
      }
      currentExample = { title: line.replace('### ', '').trim() };
      codeContent = [];
      inCodeBlock = false;
    } else if (line.startsWith('```sql')) {
      inCodeBlock = true;
    } else if (line.startsWith('```') && inCodeBlock) {
      inCodeBlock = false;
      currentExample.code = codeContent.join('\n').trim();
    } else if (inCodeBlock) {
      codeContent.push(line);
    } else if (line.trim() && !currentExample.code && !currentExample.explanation) {
      currentExample.explanation = line.trim();
    } else if (line.trim() && currentExample.code) {
      currentExample.explanation = (currentExample.explanation || '') + ' ' + line.trim();
    }
  }
  
  if (currentExample.title) {
    if (!currentExample.code && codeContent.length > 0) {
      currentExample.code = codeContent.join('\n').trim();
    }
    examples.push(currentExample as CodeExample);
  }
  
  return examples;
}

function parseMistakes(section: string): Mistake[] {
  const mistakes: Mistake[] = [];
  const blocks = section.split('###').filter(Boolean);
  
  for (const block of blocks) {
    const lines = block.trim().split('\n');
    const title = lines[0].trim();
    
    let incorrect = '';
    let correct = '';
    let why = '';
    let inIncorrect = false;
    let inCorrect = false;
    let inWhy = false;
    const incorrectLines: string[] = [];
    const correctLines: string[] = [];
    
    for (const line of lines.slice(1)) {
      const trimmed = line.trim();
      // Strip markdown bold markers for easier matching
      const cleanTrimmed = trimmed.replace(/\*\*/g, '');
      
      // Check for section markers (support both old and new formats)
      if (trimmed.includes('❌') || 
          cleanTrimmed.toLowerCase().includes('incorrect sql') ||
          cleanTrimmed.toLowerCase().includes('incorrect:') ||
          cleanTrimmed.toLowerCase() === 'incorrect') {
        inIncorrect = true;
        inCorrect = false;
        inWhy = false;
        continue;
      }
      if (trimmed.includes('✅') || 
          cleanTrimmed.toLowerCase().includes('corrected sql') ||
          cleanTrimmed.toLowerCase().includes('correct sql') ||
          cleanTrimmed.toLowerCase().includes('corrected:') ||
          cleanTrimmed.toLowerCase().includes('correct:') ||
          cleanTrimmed.toLowerCase() === 'corrected' ||
          cleanTrimmed.toLowerCase() === 'correct') {
        inIncorrect = false;
        inCorrect = true;
        inWhy = false;
        continue;
      }
      if (trimmed.includes('💡') || 
          cleanTrimmed.toLowerCase().includes('why it happens') ||
          cleanTrimmed.toLowerCase().includes('why:') ||
          cleanTrimmed.toLowerCase() === 'why' ||
          cleanTrimmed.toLowerCase().includes('key takeaway')) {
        inIncorrect = false;
        inCorrect = false;
        inWhy = true;
        // Extract why text after the label
        const whyMatch = cleanTrimmed.match(/why it happens:?\s*(.+)/i) || 
                        cleanTrimmed.match(/why:?\s*(.+)/i) ||
                        cleanTrimmed.match(/key takeaway:?\s*(.+)/i);
        if (whyMatch && whyMatch[1]) {
          why = whyMatch[1].trim();
        }
        continue;
      }
      
      // Skip code block markers
      if (line.startsWith('```sql') || line.startsWith('```')) {
        continue;
      }
      
      // Collect content
      if (inIncorrect) {
        incorrectLines.push(line);
      } else if (inCorrect) {
        correctLines.push(line);
      } else if (inWhy && !why && trimmed) {
        // If we didn't capture why from the label line, capture from content
        // Strip markdown bold markers from why text
        why = trimmed.replace(/\*\*/g, '');
      }
    }
    
    incorrect = incorrectLines.join('\n').trim();
    correct = correctLines.join('\n').trim();
    
    if (title && (incorrect || correct)) {
      mistakes.push({ title, incorrect, correct, why });
    }
  }
  
  return mistakes;
}

// ---------------------------------------------------------------------------
// Learner-safe quality checks
// ---------------------------------------------------------------------------

/**
 * Returns true when an explanation string is likely garbled / not learner-safe.
 *
 * Heuristics (all tuned to catch raw textbook export noise):
 * 1. Very long block (>3 000 chars) with a low ratio of sentence-ending punctuation
 *    → raw paragraph dumps from pdftotext.
 * 2. High density of Markdown structural markers that were never rendered
 *    (##, ----, ===, **, __, ```).
 * 3. Contains known extraction artefacts: page-number-only lines, CHAPTER / FIGURE
 *    labels, repeated whitespace / control characters.
 */
export function isExplanationGarbled(text: string): boolean {
  if (!text || text.length === 0) return false;

  // Heuristic 3: known textbook extraction artefacts — checked first, before
  // any length gate, because artefacts can appear in short text too.
  const artefactPatterns: RegExp[] = [
    /\x0c/,                                    // form-feed (pdftotext page break)
    /^(?:CHAPTER|FIGURE|TABLE|SECTION)\s+\d+/im, // structural labels
    /^\d+\s*$/m,                               // page-number-only lines
  ];
  for (const pattern of artefactPatterns) {
    if (pattern.test(text)) return true;
  }

  // Short text without artefacts is considered safe
  if (text.length < 120) return false;

  // Heuristic 1: very long with almost no sentence-ending punctuation
  if (text.length > 3000) {
    const sentenceEnders = (text.match(/[.!?]/g) || []).length;
    const ratio = sentenceEnders / (text.length / 100); // per 100 chars
    if (ratio < 0.3) return true;
  }

  // Heuristic 2: high density of unrendered Markdown structural markers
  const markdownMarkers = (text.match(/^#{1,6}\s|^[-=]{3,}$|^```|\*\*[^*]{1,80}\*\*/gm) || []).length;
  const lines = text.split('\n').length;
  if (lines > 5 && markdownMarkers / lines > 0.3) return true;

  return false;
}

/**
 * Returns true when a learnerSafeExample from the helper pipeline is safe to show
 * as a "verified example" in the browser.
 *
 * This is the FINAL sanity gate before rendering helper-produced examples.
 * The helper already filters, but some contaminated examples slip through
 * (e.g., malformed mixed prose/OCR text).
 *
 * Rejection criteria:
 * 1. No SQL structure — must contain a primary SQL keyword.
 * 2. Obvious OCR/prose contamination — long narrative fragments without SQL syntax.
 * 3. SQL with embedded prose — sentences mixed into the SQL (indicates pdftotext artefact).
 */
export function isLearnerSafeExample(example: { title?: string; sql?: string; explanation?: string }): boolean {
  const sql = example.sql?.trim() ?? '';
  const title = example.title?.trim() ?? '';

  // Must have non-empty SQL
  if (sql.length === 0) return false;

  // Must have a primary SQL statement keyword (not just fragments like "FROM")
  const primarySqlPattern = /\b(SELECT|INSERT\s+INTO|UPDATE\s+\w+|DELETE\s+FROM|CREATE\s+(TABLE|INDEX|VIEW)|DROP\s+(TABLE|INDEX|VIEW)|ALTER\s+TABLE)\b/i;
  if (!primarySqlPattern.test(sql)) return false;

  // Reject if SQL looks like prose (long sentences without SQL structure)
  // Heuristic: if there are sentence-ending punctuation marks and few SQL markers, it's likely prose
  const sentenceEnders = (sql.match(/[.!?]/g) || []).length;
  const sqlMarkers = (sql.match(/[;(),=<>]/g) || []).length;
  if (sentenceEnders > 2 && sqlMarkers < 5) return false;

  // Reject if SQL contains long narrative fragments (>100 chars without SQL syntax)
  // This catches OCR artefacts where prose is embedded in the SQL field
  const lines = sql.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.length > 100) {
      // Long line — check if it has SQL structure or is just prose
      const hasSqlStructure = /[;(),=<>]/.test(trimmed);
      const looksLikeProse = /\b(the|and|or|but|however|therefore|because|this|that|these|those)\b/i.test(trimmed);
      if (!hasSqlStructure && looksLikeProse) return false;
    }
  }

  // Reject obvious OCR artefacts: mixed case anomalies or excessive punctuation
  if (/\.{3,}/.test(sql) && !sql.includes(';')) return false;

  // Title must not be empty and should look like a title (not a sentence)
  if (title.length === 0) return false;
  if (title.length > 150) return false; // Too long for a title

  return true;
}

/**
 * Filter learnerSafeExamples to only those passing the final browser sanity check.
 */
export function filterLearnerSafeExamples(
  examples: Array<{ title?: string; sql?: string; explanation?: string }> | undefined
): Array<{ title: string; sql: string; explanation: string }> {
  if (!examples || examples.length === 0) return [];
  return examples
    .filter(isLearnerSafeExample)
    .map(ex => ({
      title: ex.title ?? '',
      sql: ex.sql ?? '',
      explanation: ex.explanation ?? '',
    }));
}

/**
 * Returns true when a code example contains at least basic SQL structure.
 *
 * A "contaminated" example fails this check. Criteria:
 * - Must contain at least one SQL keyword (SELECT, INSERT, UPDATE, DELETE,
 *   CREATE, DROP, FROM, WHERE, JOIN).
 * - Must not be pure prose (no semicolons or parentheses and no SQL keyword).
 */
export function isExampleSqlSane(code: string): boolean {
  if (!code || code.trim().length === 0) return false;
  // Require at least one primary DML/DDL statement keyword (not just FROM/WHERE
  // which appear in prose).  Word-boundary matching prevents 'JOINS' from
  // matching 'JOIN'.
  const primarySqlPattern = /\b(SELECT|INSERT\s+INTO|UPDATE\s+\w+|DELETE\s+FROM|CREATE\s+(TABLE|INDEX|VIEW)|DROP\s+(TABLE|INDEX|VIEW)|ALTER\s+TABLE)\b/i;
  return primarySqlPattern.test(code);
}

/**
 * Filter code examples to only those that pass the SQL sanity check.
 */
export function filterSaneExamples(examples: CodeExample[]): CodeExample[] {
  return examples.filter(ex => isExampleSqlSane(ex.code));
}

/**
 * Assess overall content quality for a loaded concept.
 *
 * Decision order:
 * 1. Helper-produced `qualityMetadata` (upstream pipeline) — consumed first so
 *    adaptive does not duplicate quality logic already run at export time.
 * 2. Local heuristics (isExplanationGarbled / filterSaneExamples) — used as a
 *    fallback when no metadata is present.
 *
 * Returns:
 * - `'good'`     — content is safe to render as primary learning material.
 * - `'fallback'` — explanation is garbled or all examples failed the SQL check;
 *                  render only safe fields (definition, frontmatter, sane examples).
 */
export function assessConceptQuality(concept: LoadedConcept): 'good' | 'fallback' {
  // 1. Prefer helper-produced metadata when available.
  if (concept.qualityMetadata) {
    const { readabilityStatus, exampleQuality } = concept.qualityMetadata;
    if (readabilityStatus === 'garbled' || readabilityStatus === 'fallback_only' || exampleQuality === 'contaminated') {
      return 'fallback';
    }
    if (readabilityStatus === 'clean') {
      return 'good';
    }
    // 'partial' falls through to local heuristics for a second opinion.
  }

  // 2. Local heuristics.
  const explanationGarbled = isExplanationGarbled(concept.content.explanation);
  const saneExamples = filterSaneExamples(concept.content.examples);
  const allExamplesContaminated =
    concept.content.examples.length > 0 && saneExamples.length === 0;

  if (explanationGarbled || allExamplesContaminated) return 'fallback';
  return 'good';
}

/**
 * Get PDF chunks for a concept (for hint grounding)
 */
export function getConceptChunks(
  conceptId: string, 
  type?: 'definition' | 'examples' | 'commonMistakes'
): PdfIndexChunk[] | null {
  const index = storage.getPdfIndex();
  const map = conceptMapCache;
  
  if (!index || !map) return null;
  
  // Resolve concept ID using same logic as getConcept
  const resolvedId = resolveConceptId(conceptId, map.concepts);
  const concept = map.concepts[resolvedId];
  
  if (!concept) return null;
  
  const chunkIds = type 
    ? concept.chunkIds[type]
    : [...concept.chunkIds.definition, ...concept.chunkIds.examples, ...concept.chunkIds.commonMistakes];
  
  return index.chunks.filter(c => chunkIds.includes(c.chunkId));
}

/**
 * Get practice problems for a concept
 */
export function getProblemsForConcept(conceptId: string): SQLProblem[] {
  // Resolve to plain ID for problem lookup
  const plainId = conceptId.includes('/') 
    ? conceptId.split('/').pop()! 
    : conceptId;
  return sqlProblems.filter(p => p.concepts.includes(plainId) || p.concepts.includes(conceptId));
}

/**
 * List all concepts
 */
export async function listConcepts(): Promise<Array<{id: string; title: string; difficulty: string}>> {
  const map = await loadConceptMap();
  if (!map) return [];
  
  return Object.entries(map.concepts).map(([id, info]) => ({
    id,
    title: info.title,
    difficulty: info.difficulty
  }));
}

/**
 * Get concept title
 */
export async function getConceptTitle(conceptId: string): Promise<string> {
  const concept = await getConcept(conceptId);
  return concept?.title || conceptId;
}
