import { storage } from '../storage/storage';
import type { PdfIndexChunk, SQLProblem } from '../../types';
import { sqlProblems } from '../../data/problems';

// Types
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

// Cache
let conceptMapCache: ConceptMapData | null = null;

/**
 * Clear the concept map cache. Used for testing.
 */
export function clearConceptMapCache(): void {
  conceptMapCache = null;
}

/**
 * Resolve a potentially namespaced concept ID to the canonical form.
 * 
 * Helper exports use namespaced IDs like "docId/conceptId" (e.g., "murachs-mysql-3rd-edition/select-basic").
 * This function resolves such IDs to match the keys in concept-map.json.
 * 
 * Resolution strategy:
 * 1. Try exact match first (for already-canonical IDs)
 * 2. If input is namespaced (contains "/"):
 *    - Try suffix match against concept map keys (flat key lookup)
 *    - Try exact namespaced key match
 * 3. If input is flat (no "/"):
 *    - Try to find a unique namespaced key that ends with this suffix
 *    - If multiple matches, return original (ambiguous)
 *    - If single match, return the namespaced key
 * 4. Return original ID if no resolution found (caller handles not-found)
 */
export function resolveConceptId(
  conceptId: string,
  availableConcepts: Record<string, ConceptInfo>
): string {
  // Already exact match
  if (availableConcepts[conceptId]) {
    return conceptId;
  }
  
  // Case 1: Input is namespaced (docId/conceptId)
  // Try to find a flat key matching the suffix
  if (conceptId.includes('/')) {
    const suffix = conceptId.split('/').pop()!;
    
    // If suffix exists as a flat concept key, use it (backward compatibility)
    if (availableConcepts[suffix]) {
      return suffix;
    }
    
    // Return original for namespaced lookup
    return conceptId;
  }
  
  // Case 2: Input is flat (conceptId)
  // Try to find a unique namespaced key that ends with this suffix
  const allKeys = Object.keys(availableConcepts);
  const matchingKeys = allKeys.filter(key => {
    // Key ends with /conceptId or equals conceptId
    return key === conceptId || key.endsWith(`/${conceptId}`);
  });
  
  if (matchingKeys.length === 1) {
    // Unique match found - use the namespaced key
    return matchingKeys[0];
  }
  
  if (matchingKeys.length > 1) {
    // Ambiguous - multiple docs have this concept
    // Return original and let caller handle or use first match
    console.warn(`[resolveConceptId] Ambiguous concept ID "${conceptId}" matches multiple keys: ${matchingKeys.join(', ')}`);
  }
  
  // No resolution found - return original for error handling
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
  
  try {
    const response = await fetch('/textbook-static/concept-map.json');
    if (!response.ok) return null;
    conceptMapCache = await response.json();
    return conceptMapCache;
  } catch {
    return null;
  }
}

/**
 * Get single concept info with alias resolution.
 * 
 * Supports both plain concept IDs ("select-basic") and namespaced IDs
 * ("murachs-mysql-3rd-edition/select-basic").
 */
export async function getConcept(conceptId: string): Promise<ConceptInfo | null> {
  const map = await loadConceptMap();
  if (!map) return null;
  
  const resolvedId = resolveConceptId(conceptId, map.concepts);
  const concept = map.concepts[resolvedId] || null;
  
  // Preserve the original ID if we resolved to a different key
  // This helps downstream code know what was requested vs what was found
  if (concept && resolvedId !== conceptId) {
    return {
      ...concept,
      id: conceptId // Keep original requested ID for URL consistency
    };
  }
  
  return concept;
}

/**
 * Load full concept with parsed content
 */
export async function loadConceptContent(conceptId: string): Promise<LoadedConcept | null> {
  const concept = await getConcept(conceptId);
  if (!concept) return null;
  
  const markdown = await fetchConceptMarkdown(conceptId, concept);
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
