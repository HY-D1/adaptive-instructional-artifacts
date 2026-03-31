/**
 * Deterministic Textbook Generator
 * 
 * Generates high-quality, educationally useful instructional content WITHOUT requiring an LLM.
 * Combines error templates with concept explanations from textbook-static to produce
 * structured markdown content suitable for the adaptive learning system.
 * 
 * This enables hosted deployments to work without Ollama while maintaining:
 * - Source-grounded explanations (SQL-Engage + concept notes)
 * - Consistent, deterministic output for same inputs
 * - Educational quality comparable to LLM-generated content
 * - Proper source citations for transparency
 */

import { InstructionalUnit, LLMGenerationParams } from '../../types';
import { 
  getErrorTemplate, 
  getErrorTemplateIds,
  ErrorTemplate,
  getRelatedConceptIds 
} from './error-templates';
import { 
  canonicalizeSqlEngageSubtype,
  getDeterministicSqlEngageAnchor,
  getConceptIdsForSqlEngageSubtype,
  SqlEngageRecord
} from '../../data/sql-engage';
import { 
  getConceptFromRegistry 
} from '../../data';
import { RetrievalBundle } from './retrieval-bundle';
import { createInputHash } from '../utils/hash';

/**
 * Parameters for deterministic explanation generation
 */
export interface DeterministicGenerationParams {
  /** Problem identifier */
  problemId: string;
  /** Problem title */
  problemTitle: string;
  /** Error subtype ID from SQL-Engage */
  errorSubtypeId: string;
  /** Learner's SQL code that caused the error */
  code: string;
  /** Related concept IDs */
  conceptIds: string[];
  /** Hint history for context */
  hintHistory: Array<{
    hintLevel: 1 | 2 | 3;
    hintText: string;
  }>;
  /** Optional learner ID */
  learnerId?: string;
  /** Optional session ID */
  sessionId?: string;
  /** IDs of interactions that triggered this generation */
  triggerInteractionIds: string[];
}

/**
 * Result of deterministic generation
 */
export interface DeterministicGenerationResult {
  /** Generated instructional unit */
  unit: InstructionalUnit;
  /** Input hash for caching */
  inputHash: string;
  /** Source IDs used for grounding */
  sourceIds: string[];
  /** Whether a rich template was used */
  usedRichTemplate: boolean;
  /** Generation metadata */
  metadata: {
    subtypeId: string;
    templateTitle: string;
    conceptCount: number;
    sqlEngageRowId?: string;
    generationTimeMs: number;
  };
}

/**
 * Concept content cache to avoid repeated fetches
 */
const conceptContentCache = new Map<string, string>();
const conceptMarkdownModules = import.meta.glob('../../../public/textbook-static/concepts/*.md', {
  query: '?raw',
  import: 'default',
});

/**
 * Fetch concept markdown content from textbook-static
 * Uses dynamic import for Vite's raw loader
 */
async function fetchConceptContent(conceptId: string): Promise<string | null> {
  // Check cache first
  if (conceptContentCache.has(conceptId)) {
    return conceptContentCache.get(conceptId)!;
  }
  
  try {
    const modulePath = `../../../public/textbook-static/concepts/${conceptId}.md`;
    const loader = conceptMarkdownModules[modulePath] as (() => Promise<string>) | undefined;
    if (!loader) {
      return null;
    }
    const content = await loader();
    
    if (content && typeof content === 'string') {
      conceptContentCache.set(conceptId, content);
      return content;
    }
  } catch {
    // File doesn't exist or couldn't be loaded
  }
  
  return null;
}

/**
 * Extract relevant sections from concept markdown
 */
function extractConceptSections(markdown: string): {
  definition: string;
  explanation: string;
  examples: string;
  commonMistakes: string;
} {
  const sections = {
    definition: '',
    explanation: '',
    examples: '',
    commonMistakes: ''
  };
  
  if (!markdown) return sections;
  
  // Extract definition from first paragraph after # heading
  const definitionMatch = markdown.match(/# [^\n]+\n+([^#]+?)(?=\n##|\n*$)/);
  if (definitionMatch) {
    sections.definition = definitionMatch[1].trim().slice(0, 300);
  }
  
  // Extract explanation from "What is This?" or "Explanation" section
  const explanationMatch = markdown.match(/## (What is This\?|Explanation|Definition)\n+([^#]+?)(?=\n##|\n*$)/i);
  if (explanationMatch) {
    sections.explanation = explanationMatch[2].trim().slice(0, 500);
  }
  
  // Extract examples
  const examplesMatch = markdown.match(/## Examples?\n+([^#]+?)(?=\n##|\n*$)/i);
  if (examplesMatch) {
    sections.examples = examplesMatch[1].trim();
  }
  
  // Extract common mistakes
  const mistakesMatch = markdown.match(/## Common Mistakes?\n+([^#]+?)(?=\n##|\n*$)/i);
  if (mistakesMatch) {
    sections.commonMistakes = mistakesMatch[1].trim();
  }
  
  return sections;
}

/**
 * Compose markdown content from template and concept sections
 */
function composeMarkdownContent(
  template: ErrorTemplate,
  conceptSections: ReturnType<typeof extractConceptSections>,
  sqlEngageRow: SqlEngageRecord | undefined,
  params: DeterministicGenerationParams
): {
  title: string;
  content: string;
  keyPoints: string[];
  nextSteps: string[];
  commonPitfall: string;
} {
  const lines: string[] = [];
  
  // Title
  const title = `${template.title}: ${params.problemTitle}`;
  lines.push(`# ${title}`);
  lines.push('');
  
  // Problem Context
  lines.push('## Problem Context');
  lines.push(`You encountered an error while working on: **${params.problemTitle}**`);
  lines.push('');
  lines.push('### Your Query');
  lines.push('```sql');
  lines.push(params.code || '-- No query provided');
  lines.push('```');
  lines.push('');
  
  // Root Cause Section
  lines.push('## Understanding the Error');
  lines.push('');
  lines.push(`**${template.rootCause.summary}**`);
  lines.push('');
  lines.push(template.rootCause.explanation);
  lines.push('');
  
  // Add concept explanation if available
  if (conceptSections.explanation) {
    lines.push('### Related Concept');
    lines.push(conceptSections.explanation);
    lines.push('');
  }
  
  // SQL-Engage Source Grounding
  if (sqlEngageRow) {
    lines.push('### Source Reference');
    lines.push(`This explanation is based on **${sqlEngageRow.rowId}** from the SQL-Engage dataset.`);
    lines.push('');
    lines.push(`**Learning Outcome:** ${sqlEngageRow.intended_learning_outcome}`);
    lines.push('');
    lines.push(`**Feedback Target:** ${sqlEngageRow.feedback_target}`);
    lines.push('');
  }
  
  // Fix Steps
  lines.push('## How to Fix It');
  lines.push('');
  template.fixSteps.forEach((step, index) => {
    lines.push(`${index + 1}. ${step}`);
  });
  lines.push('');
  
  // Examples
  lines.push('## Corrected Examples');
  lines.push('');
  template.examples.forEach((example, index) => {
    lines.push(`### Example ${index + 1}: ${example.description}`);
    lines.push('');
    lines.push('**Incorrect:**');
    lines.push('```sql');
    lines.push(example.before);
    lines.push('```');
    lines.push('');
    lines.push('**Correct:**');
    lines.push('```sql');
    lines.push(example.after);
    lines.push('```');
    lines.push('');
    lines.push(`**Why:** ${example.explanation}`);
    lines.push('');
  });
  
  // Prevention Tips
  lines.push('## Prevention Tips');
  lines.push('');
  template.preventionTips.forEach((tip, index) => {
    lines.push(`${index + 1}. ${tip}`);
  });
  lines.push('');
  
  // Hint History Context
  if (params.hintHistory.length > 0) {
    lines.push('## Your Hint History');
    lines.push('');
    lines.push('You have already received the following hints for this problem:');
    lines.push('');
    params.hintHistory.forEach(hint => {
      lines.push(`- **Level ${hint.hintLevel}:** ${hint.hintText.slice(0, 100)}${hint.hintText.length > 100 ? '...' : ''}`);
    });
    lines.push('');
    lines.push('This explanation builds on those hints to provide a complete understanding.');
    lines.push('');
  }
  
  // Common Mistakes from concept if available
  if (conceptSections.commonMistakes) {
    lines.push('## Related Common Mistakes');
    lines.push('');
    // Extract just the first mistake to keep content focused
    const firstMistake = conceptSections.commonMistakes.split('###')[1];
    if (firstMistake) {
      lines.push(firstMistake.trim().slice(0, 500));
    } else {
      lines.push(conceptSections.commonMistakes.slice(0, 500));
    }
    lines.push('');
  }
  
  // Next Steps
  lines.push('## Next Steps');
  lines.push('');
  lines.push('1. Review the corrected examples above');
  lines.push('2. Apply the fix to your query');
  lines.push('3. Test your corrected query');
  lines.push('4. If you still have issues, try breaking the query into smaller parts');
  lines.push('');
  
  const content = lines.join('\n');
  
  // Extract key points for structured output
  const keyPoints = [
    template.rootCause.summary,
    ...template.fixSteps.slice(0, 2),
    template.preventionTips[0]
  ];
  
  const nextSteps = [
    'Apply the fix to your query',
    'Test the corrected query',
    'Review related concept documentation'
  ];
  
  const commonPitfall = template.examples[0]?.explanation || template.preventionTips[0];
  
  return {
    title,
    content,
    keyPoints,
    nextSteps,
    commonPitfall
  };
}

/**
 * Generate a deterministic explanation without using an LLM
 * 
 * This is the main entry point for deterministic textbook generation.
 * It combines error templates, SQL-Engage data, and concept explanations
 * to produce high-quality instructional content.
 */
export async function generateDeterministicExplanation(
  params: DeterministicGenerationParams
): Promise<DeterministicGenerationResult> {
  const startTime = performance.now();
  
  // Normalize the error subtype
  const normalizedSubtype = canonicalizeSqlEngageSubtype(params.errorSubtypeId);
  
  // Get the error template
  const template = getErrorTemplate(normalizedSubtype);
  const usedRichTemplate = template.subtypeId !== 'unknown-error';
  
  // Get SQL-Engage anchor for source grounding
  const sqlEngageRow = getDeterministicSqlEngageAnchor(
    normalizedSubtype,
    `${params.learnerId || 'anonymous'}|${params.problemId}|${normalizedSubtype}`
  );
  
  // Gather all concept IDs from template and params
  const allConceptIds = Array.from(new Set([
    ...template.relatedConcepts,
    ...params.conceptIds,
    ...getConceptIdsForSqlEngageSubtype(normalizedSubtype)
  ]));
  
  // Fetch concept content for the primary concept
  let primaryConceptContent: string | null = null;
  let primaryConceptSections = {
    definition: '',
    explanation: '',
    examples: '',
    commonMistakes: ''
  };
  
  if (allConceptIds.length > 0) {
    primaryConceptContent = await fetchConceptContent(allConceptIds[0]);
    if (primaryConceptContent) {
      primaryConceptSections = extractConceptSections(primaryConceptContent);
    }
  }
  
  // Compose the final markdown content
  const composed = composeMarkdownContent(
    template,
    primaryConceptSections,
    sqlEngageRow,
    params
  );
  
  // Build source IDs for grounding
  const sourceIds: string[] = [];
  if (sqlEngageRow?.rowId) {
    sourceIds.push(sqlEngageRow.rowId);
  }
  // Add concept source references from registry
  for (const conceptId of allConceptIds) {
    const registryConcept = getConceptFromRegistry(conceptId);
    if (registryConcept?.sourceRefs) {
      for (const ref of registryConcept.sourceRefs) {
        sourceIds.push(`${ref.docId}:${ref.chunkId}:${ref.page}`);
      }
    }
  }
  
  // Generate input hash for caching
  const hashPayload = {
    problemId: params.problemId,
    errorSubtypeId: normalizedSubtype,
    code: params.code,
    conceptIds: allConceptIds.sort(),
    templateVersion: '1.0'
  };
  const inputHash = createInputHash(hashPayload);
  
  // Build the instructional unit
  const unit: InstructionalUnit = {
    id: `unit-deterministic-${normalizedSubtype}-${inputHash.slice(0, 16)}`,
    sessionId: params.sessionId,
    problemId: params.problemId,
    updatedSessionIds: params.sessionId ? [params.sessionId] : [],
    type: 'explanation',
    conceptId: allConceptIds[0] || 'syntax-error',
    conceptIds: allConceptIds,
    title: composed.title,
    content: composed.content,
    contentFormat: 'markdown',
    prerequisites: [],
    addedTimestamp: Date.now(),
    sourceInteractionIds: params.triggerInteractionIds,
    lastErrorSubtypeId: normalizedSubtype,
    provenance: {
      model: 'deterministic-generator',
      params: {
        temperature: 0,
        top_p: 1,
        stream: false,
        timeoutMs: 0
      } as LLMGenerationParams,
      templateId: 'deterministic.v1',
      inputHash,
      retrievedSourceIds: sourceIds,
      retrievedPdfCitations: [],
      createdAt: Date.now(),
      parserStatus: 'success',
      parserMode: 'strict-json',
      parserAttempts: 1,
      parserRawLength: composed.content.length,
      fallbackReason: 'none'
    },
    retrievalCount: 0
  };
  
  const generationTimeMs = Math.round(performance.now() - startTime);
  
  return {
    unit,
    inputHash,
    sourceIds,
    usedRichTemplate,
    metadata: {
      subtypeId: normalizedSubtype,
      templateTitle: template.title,
      conceptCount: allConceptIds.length,
      sqlEngageRowId: sqlEngageRow?.rowId,
      generationTimeMs
    }
  };
}

/**
 * Generate from a retrieval bundle (convenience wrapper)
 * This matches the interface expected by the content generator
 */
export async function generateDeterministicFromBundle(
  bundle: RetrievalBundle,
  options: {
    learnerId: string;
    sessionId?: string;
    triggerInteractionIds: string[];
  }
): Promise<DeterministicGenerationResult> {
  return generateDeterministicExplanation({
    problemId: bundle.problemId,
    problemTitle: bundle.problemTitle,
    errorSubtypeId: bundle.lastErrorSubtypeId,
    code: bundle.recentInteractionsSummary ? 
      `-- Problem: ${bundle.problemTitle}\n-- Schema: ${bundle.schemaText.slice(0, 200)}...` : 
      '',
    conceptIds: bundle.conceptCandidates.map(c => c.id),
    hintHistory: bundle.hintHistory.map(h => ({
      hintLevel: h.hintLevel,
      hintText: h.hintText
    })),
    learnerId: options.learnerId,
    sessionId: options.sessionId,
    triggerInteractionIds: options.triggerInteractionIds
  });
}

/**
 * Check if a rich template is available for an error subtype
 */
export function hasRichTemplateForSubtype(errorSubtypeId: string): boolean {
  const normalizedSubtype = canonicalizeSqlEngageSubtype(errorSubtypeId);
  const template = getErrorTemplate(normalizedSubtype);
  return template.subtypeId !== 'unknown-error';
}

/**
 * Get template statistics for debugging
 */
export function getTemplateStats(): {
  totalTemplates: number;
  coveredSubtypes: string[];
  conceptCoverage: string[];
} {
  const templateIds = getErrorTemplateIds();
  const conceptIds = new Set<string>();
  
  for (const templateId of templateIds) {
    const template = getErrorTemplate(templateId);
    for (const conceptId of template.relatedConcepts) {
      conceptIds.add(conceptId);
    }
  }
  
  return {
    totalTemplates: templateIds.length,
    coveredSubtypes: templateIds,
    conceptCoverage: Array.from(conceptIds)
  };
}
