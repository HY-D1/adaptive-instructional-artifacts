/**
 * Content Assembler Pipeline
 * 
 * Assembles instructional units by combining multiple content sources:
 * - SQL-Engage templates for error-specific guidance
 * - Concept notes from textbook-static markdown
 * - Error pattern templates for structured explanations
 * 
 * This module provides a unified interface for content generation that works
 * both with and without LLM support, making the system suitable for hosted
 * deployments without Ollama.
 */

import { InstructionalUnit, LLMGenerationParams } from '../../types';
import { RetrievalBundle } from './retrieval-bundle';
import {
  generateDeterministicExplanation,
  generateDeterministicFromBundle,
  DeterministicGenerationResult
} from './deterministic-generator';
import { 
  getErrorTemplate,
  getRelatedConceptIds 
} from './error-templates';
import {
  canonicalizeSqlEngageSubtype,
  getConceptIdsForSqlEngageSubtype,
  getDeterministicSqlEngageAnchor
} from '../../data/sql-engage';
import { isLLMAvailable as isRuntimeLLMAvailable } from '../runtime-config';

/**
 * Parameters for assembling a textbook unit
 */
export interface AssemblyParams {
  /** Retrieval bundle with context */
  bundle: RetrievalBundle;
  /** Learner identifier */
  learnerId: string;
  /** Optional session ID */
  sessionId?: string;
  /** IDs of interactions that triggered this assembly */
  triggerInteractionIds: string[];
  /** Template identifier */
  templateId: string;
  /** Whether to prefer deterministic generation even if LLM is available */
  preferDeterministic?: boolean;
}

/**
 * Result of content assembly
 */
export interface AssemblyResult {
  /** Assembled instructional unit */
  unit: InstructionalUnit;
  /** Whether deterministic generation was used */
  usedDeterministic: boolean;
  /** Source IDs used for grounding */
  sourceIds: string[];
  /** Assembly metadata */
  metadata: {
    subtypeId: string;
    templateUsed: string;
    conceptCount: number;
    generationTimeMs: number;
    sourceCount: number;
  };
}

/**
 * Check if LLM generation should be attempted.
 * This is a coarse runtime gate; live availability is still confirmed through
 * the backend LLM status endpoint by the caller.
 */
export function shouldAttemptLLM(): boolean {
  return isRuntimeLLMAvailable();
}

/**
 * Assemble a textbook unit using deterministic generation
 * Does not require Ollama/LLM
 */
export async function assembleTextbookUnitDeterministic(
  params: AssemblyParams
): Promise<AssemblyResult> {
  const startTime = performance.now();
  
  const result = await generateDeterministicFromBundle(
    params.bundle,
    {
      learnerId: params.learnerId,
      sessionId: params.sessionId,
      triggerInteractionIds: params.triggerInteractionIds
    }
  );
  
  const generationTimeMs = Math.round(performance.now() - startTime);
  
  return {
    unit: result.unit,
    usedDeterministic: true,
    sourceIds: result.sourceIds,
    metadata: {
      subtypeId: result.metadata.subtypeId,
      templateUsed: result.metadata.templateTitle,
      conceptCount: result.metadata.conceptCount,
      generationTimeMs: generationTimeMs + result.metadata.generationTimeMs,
      sourceCount: result.sourceIds.length
    }
  };
}

/**
 * Generate a simple fallback unit when no template is available
 * This is the minimal viable content for unknown error types
 */
export function generateMinimalFallbackUnit(
  params: AssemblyParams
): AssemblyResult {
  const startTime = performance.now();
  const normalizedSubtype = canonicalizeSqlEngageSubtype(params.bundle.lastErrorSubtypeId);
  const sqlEngageRow = getDeterministicSqlEngageAnchor(
    normalizedSubtype,
    `${params.learnerId}|${params.bundle.problemId}|${normalizedSubtype}`
  );
  
  const conceptIds = Array.from(new Set([
    ...params.bundle.conceptCandidates.map(c => c.id),
    ...getConceptIdsForSqlEngageSubtype(normalizedSubtype)
  ]));
  
  const lines: string[] = [
    `# Help with ${params.bundle.problemTitle}`,
    '',
    '## Error Information',
    `**Error Type:** ${normalizedSubtype}`,
    '',
    '## Understanding the Error',
    `You encountered a **${normalizedSubtype}** error while working on this problem.`,
    ''
  ];
  
  if (sqlEngageRow) {
    lines.push('### Source Reference');
    lines.push(`Based on analysis of similar errors (${sqlEngageRow.rowId}):`);
    lines.push('');
    lines.push(`**Learning Focus:** ${sqlEngageRow.intended_learning_outcome}`);
    lines.push('');
    lines.push(`**What to Check:** ${sqlEngageRow.feedback_target}`);
    lines.push('');
  }
  
  lines.push('## Suggested Steps');
  lines.push('');
  lines.push('1. Review your SQL syntax carefully');
  lines.push('2. Check that all table and column names are spelled correctly');
  lines.push('3. Verify your query structure matches the requirements');
  lines.push('4. Try building the query incrementally: start simple, add complexity');
  lines.push('');
  
  if (params.bundle.hintHistory.length > 0) {
    lines.push('## Hint History');
    lines.push('');
    params.bundle.hintHistory.forEach(hint => {
      lines.push(`- Level ${hint.hintLevel}: ${hint.hintText.slice(0, 100)}...`);
    });
    lines.push('');
  }
  
  lines.push('## Related Concepts');
  lines.push('');
  conceptIds.forEach(id => {
    lines.push(`- ${id}`);
  });
  lines.push('');
  
  const content = lines.join('\n');
  const inputHash = `fallback-${Date.now()}`;
  
  const sourceIds: string[] = [];
  if (sqlEngageRow?.rowId) {
    sourceIds.push(sqlEngageRow.rowId);
  }
  
  const unit: InstructionalUnit = {
    id: `unit-fallback-${normalizedSubtype}-${Date.now()}`,
    sessionId: params.sessionId,
    updatedSessionIds: params.sessionId ? [params.sessionId] : [],
    type: 'explanation',
    conceptId: conceptIds[0] || 'syntax-error',
    conceptIds,
    title: `Help with ${params.bundle.problemTitle}`,
    content,
    contentFormat: 'markdown',
    prerequisites: [],
    addedTimestamp: Date.now(),
    sourceInteractionIds: params.triggerInteractionIds,
    lastErrorSubtypeId: normalizedSubtype,
    provenance: {
      model: 'minimal-fallback',
      params: {
        temperature: 0,
        top_p: 1,
        stream: false,
        timeoutMs: 0
      } as LLMGenerationParams,
      templateId: 'fallback.v1',
      inputHash,
      retrievedSourceIds: sourceIds,
      retrievedPdfCitations: [],
      createdAt: Date.now(),
      parserStatus: 'success',
      parserMode: 'strict-json',
      parserAttempts: 1,
      parserRawLength: content.length,
      fallbackReason: 'none'
    },
    retrievalCount: 0
  };
  
  return {
    unit,
    usedDeterministic: true,
    sourceIds,
    metadata: {
      subtypeId: normalizedSubtype,
      templateUsed: 'minimal-fallback',
      conceptCount: conceptIds.length,
      generationTimeMs: Math.round(performance.now() - startTime),
      sourceCount: sourceIds.length
    }
  };
}

/**
 * Main assembly function - orchestrates content generation
 * 
 * Priority:
 * 1. If preferDeterministic=true OR LLM not available: use deterministic
 * 2. Otherwise: try LLM first, fall back to deterministic
 */
export async function assembleTextbookUnit(
  params: AssemblyParams
): Promise<AssemblyResult> {
  // If deterministic is preferred or LLM is not available, use deterministic
  if (params.preferDeterministic || !shouldAttemptLLM()) {
    return assembleTextbookUnitDeterministic(params);
  }
  
  // In a full implementation, this would try LLM first
  // For now, we use deterministic as the primary method
  return assembleTextbookUnitDeterministic(params);
}

/**
 * Quick assembly for immediate display (no async)
 * Returns a minimal unit that can be enriched later
 */
export function assembleQuickUnit(
  bundle: RetrievalBundle,
  options: {
    learnerId: string;
    sessionId?: string;
    triggerInteractionIds: string[];
  }
): AssemblyResult {
  const startTime = performance.now();
  const normalizedSubtype = canonicalizeSqlEngageSubtype(bundle.lastErrorSubtypeId);
  
  // Get template for title
  const template = getErrorTemplate(normalizedSubtype);
  
  // Get SQL-Engage row
  const sqlEngageRow = getDeterministicSqlEngageAnchor(
    normalizedSubtype,
    `${options.learnerId}|${bundle.problemId}|${normalizedSubtype}`
  );
  
  // Build quick content
  const title = `${template.title}: ${bundle.problemTitle}`;
  const lines: string[] = [
    `# ${title}`,
    '',
    `## ${template.rootCause.summary}`,
    '',
    template.rootCause.explanation,
    '',
    '## Quick Fix',
    ''
  ];
  
  template.fixSteps.slice(0, 3).forEach((step, index) => {
    lines.push(`${index + 1}. ${step}`);
  });
  
  if (template.examples.length > 0) {
    lines.push('');
    lines.push('### Example');
    lines.push('**Before:**');
    lines.push('```sql');
    lines.push(template.examples[0].before);
    lines.push('```');
    lines.push('**After:**');
    lines.push('```sql');
    lines.push(template.examples[0].after);
    lines.push('```');
  }
  
  lines.push('');
  lines.push('*Full explanation loading...*');
  
  const content = lines.join('\n');
  const inputHash = `quick-${Date.now()}`;
  
  const conceptIds = Array.from(new Set([
    ...template.relatedConcepts,
    ...bundle.conceptCandidates.map(c => c.id)
  ]));
  
  const sourceIds: string[] = [];
  if (sqlEngageRow?.rowId) {
    sourceIds.push(sqlEngageRow.rowId);
  }
  
  const unit: InstructionalUnit = {
    id: `unit-quick-${normalizedSubtype}-${Date.now()}`,
    sessionId: options.sessionId,
    updatedSessionIds: options.sessionId ? [options.sessionId] : [],
    type: 'explanation',
    conceptId: conceptIds[0] || 'syntax-error',
    conceptIds,
    title,
    content,
    contentFormat: 'markdown',
    prerequisites: [],
    addedTimestamp: Date.now(),
    sourceInteractionIds: options.triggerInteractionIds,
    lastErrorSubtypeId: normalizedSubtype,
    provenance: {
      model: 'quick-assembler',
      params: {
        temperature: 0,
        top_p: 1,
        stream: false,
        timeoutMs: 0
      } as LLMGenerationParams,
      templateId: 'quick.v1',
      inputHash,
      retrievedSourceIds: sourceIds,
      retrievedPdfCitations: [],
      createdAt: Date.now(),
      parserStatus: 'success',
      parserMode: 'strict-json',
      parserAttempts: 1,
      parserRawLength: content.length,
      fallbackReason: 'none'
    },
    retrievalCount: 0
  };
  
  return {
    unit,
    usedDeterministic: true,
    sourceIds,
    metadata: {
      subtypeId: normalizedSubtype,
      templateUsed: 'quick-assembler',
      conceptCount: conceptIds.length,
      generationTimeMs: Math.round(performance.now() - startTime),
      sourceCount: sourceIds.length
    }
  };
}

/**
 * Get assembly statistics for monitoring
 */
export function getAssemblyStats(): {
  deterministicAvailable: boolean;
  llmAvailable: boolean;
  templateCoverage: string[];
} {
  return {
    deterministicAvailable: true,
    llmAvailable: shouldAttemptLLM(),
    templateCoverage: getRelatedConceptIds([])
  };
}
