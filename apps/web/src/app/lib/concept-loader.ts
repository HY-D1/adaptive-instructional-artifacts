import { storage } from './storage';
import type { PdfIndexChunk, SQLProblem } from '../types';
import { sqlProblems } from '../data/problems';

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
  sourceDocId: string;
  concepts: Record<string, ConceptInfo>;
}

// Cache
let conceptMapCache: ConceptMapData | null = null;

/**
 * Load concept map
 */
export async function loadConceptMap(): Promise<ConceptMapData | null> {
  if (conceptMapCache) return conceptMapCache;
  
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
 * Get single concept info
 */
export async function getConcept(conceptId: string): Promise<ConceptInfo | null> {
  const map = await loadConceptMap();
  return map?.concepts[conceptId] || null;
}

/**
 * Load full concept with parsed content
 */
export async function loadConceptContent(conceptId: string): Promise<LoadedConcept | null> {
  const [concept, markdown] = await Promise.all([
    getConcept(conceptId),
    fetchConceptMarkdown(conceptId)
  ]);
  
  if (!concept || !markdown) return null;
  
  return {
    ...concept,
    content: parseMarkdownContent(markdown)
  };
}

/**
 * Fetch raw markdown
 */
async function fetchConceptMarkdown(conceptId: string): Promise<string | null> {
  try {
    const response = await fetch(`/textbook-static/concepts/${conceptId}.md`);
    if (!response.ok) return null;
    return response.text();
  } catch {
    return null;
  }
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
  
  if (!index || !map?.concepts[conceptId]) return null;
  
  const concept = map.concepts[conceptId];
  const chunkIds = type 
    ? concept.chunkIds[type]
    : [...concept.chunkIds.definition, ...concept.chunkIds.examples, ...concept.chunkIds.commonMistakes];
  
  return index.chunks.filter(c => chunkIds.includes(c.chunkId));
}

/**
 * Get practice problems for a concept
 */
export function getProblemsForConcept(conceptId: string): SQLProblem[] {
  return sqlProblems.filter(p => p.concepts.includes(conceptId));
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
