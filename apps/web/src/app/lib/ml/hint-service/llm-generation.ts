/**
 * Hint Service LLM Generation
 *
 * LLM-based adaptive hint generation for rung 3+ explanations.
 */

import { generateWithOllama, isLLMAvailable } from '../../api/llm-client';
import type { GuidanceRung } from '../guidance-ladder';
import type { AdaptiveHintContext, AdaptiveHintOutput, EnhancedHint, RetrievalSignalMeta } from './types';
import type { AvailableResources } from './types';
import type { EnhancedRetrievalBundle, HintGenerationOptions } from './types';
import { applyHintSafetyLayer } from './safety';
import { generateSqlEngageFallbackHint, mergeFallbackReasons } from './fallback';
import { generateTextbookEnhancedHint } from './textbook-generation';
import { MIN_RETRIEVAL_CONFIDENCE } from './types';

/**
 * Generate hint using LLM (for rung 3+ or forced LLM mode)
 *
 * DECISION MATRIX:
 * - LLM available + Textbook available: Full LLM with textbook context
 * - LLM available + No Textbook: LLM with SQL-Engage + PDF only
 * - No LLM + Textbook available: Enhanced SQL-Engage with textbook references
 * - No LLM + No Textbook: SQL-Engage CSV only (fallback)
 */
export async function generateLLMEnhancedHint(
  options: HintGenerationOptions,
  retrievalBundle: EnhancedRetrievalBundle,
  resources: AvailableResources,
  retrievalSignals: RetrievalSignalMeta
): Promise<EnhancedHint> {
  const { rung, errorSubtypeId } = options;

  // Check if LLM is actually available
  const llmAvailable = await isLLMAvailable();
  if (!llmAvailable) {
    // Fall back to textbook-enhanced or SQL-Engage
    if (resources.textbook && retrievalBundle.textbookUnits?.length) {
      return generateTextbookEnhancedHint(options, retrievalBundle, resources, retrievalSignals);
    }
    if (errorSubtypeId) {
      return generateSqlEngageFallbackHint(errorSubtypeId, rung, {
        ...retrievalSignals,
        fallbackReason: 'llm_unavailable',
      });
    }
    return createLLMErrorHint(rung, retrievalSignals, 'LLM service not available');
  }

  // Build adaptive context for LLM
  const context: AdaptiveHintContext = {
    rung: rung as 1 | 2 | 3,
    errorSubtype: errorSubtypeId || 'general',
    problem: retrievalBundle.problem,
    previousHints: retrievalBundle.hintHistory.slice(-3),
    textbookUnits: retrievalBundle.textbookUnits || [],
    pdfPassages: retrievalBundle.pdfPassages,
    sqlEngageRecords: [], // Populated from retrieval bundle if needed
  };

  try {
    // Generate adaptive hint using LLM
    const adaptiveOutput = await generateAdaptiveHint(context, async (prompt) => {
      const response = await generateWithOllama({
        prompt,
        temperature: 0.7,
        max_tokens: 500,
      });
      return response.text;
    });

    const safety = applyHintSafetyLayer(adaptiveOutput.content, rung, errorSubtypeId || 'unknown');

    return {
      content: safety.content,
      rung,
      sources: {
        sqlEngage: false,
        textbook: (retrievalBundle.textbookUnits?.length ?? 0) > 0,
        llm: true,
        pdfPassages: retrievalSignals.retrievedChunkIds.length > 0,
      },
      conceptIds: adaptiveOutput.conceptIds,
      sourceRefIds: adaptiveOutput.sourceRefIds,
      textbookUnits: retrievalBundle.textbookUnits?.slice(0, 2),
      llmGenerated: true,
      confidence: Math.max(0.7, retrievalSignals.retrievalConfidence),
      retrievalConfidence: retrievalSignals.retrievalConfidence,
      fallbackReason: safety.fallbackReason,
      safetyFilterApplied: safety.safetyFilterApplied,
      retrievedSourceIds: retrievalSignals.retrievedSourceIds,
      retrievedChunkIds: retrievalSignals.retrievedChunkIds,
    };
  } catch (error) {
    console.error('[LLMGeneration] Failed to generate hint:', error);

    // Fall back to textbook-enhanced or SQL-Engage
    if (resources.textbook && retrievalBundle.textbookUnits?.length) {
      return generateTextbookEnhancedHint(options, retrievalBundle, resources, {
        ...retrievalSignals,
        fallbackReason: mergeFallbackReasons('llm_error', retrievalSignals.fallbackReason),
      });
    }

    if (errorSubtypeId) {
      return generateSqlEngageFallbackHint(errorSubtypeId, rung, {
        ...retrievalSignals,
        fallbackReason: mergeFallbackReasons('llm_error', retrievalSignals.fallbackReason),
      });
    }

    return createLLMErrorHint(rung, retrievalSignals, error instanceof Error ? error.message : 'Unknown error');
  }
}

/**
 * Generate adaptive hint with pedagogical progression
 *
 * This function creates progressively more helpful hints following a strict
 * pedagogical ladder that never gives away the answer.
 *
 * Pedagogical Progression:
 * - Rung 1 (Subtle Nudge): Max 100 chars, vague direction, NO code
 * - Rung 2 (Guiding Question): Max 250 chars, leading questions, cites sources
 * - Rung 3 (Explicit Direction): Max 500 chars, clear explanation, partial patterns only
 */
async function generateAdaptiveHint(
  context: AdaptiveHintContext,
  llmCall: (prompt: string) => Promise<string>
): Promise<AdaptiveHintOutput> {
  const prompt = buildAdaptivePrompt(context);

  try {
    const rawOutput = await llmCall(prompt);
    return parseAdaptiveOutput(rawOutput, context.rung);
  } catch (error) {
    console.error('[AdaptiveHint] Hint generation failed:', error);
    throw error;
  }
}

/**
 * Build rung-specific adaptive prompt
 */
function buildAdaptivePrompt(context: AdaptiveHintContext): string {
  const { rung, errorSubtype, problem, previousHints, textbookUnits } = context;

  const rungPrompts: Record<number, string> = {
    1: `Provide a brief, subtle nudge (max 100 characters) to help the learner identify the issue with "${errorSubtype}". Do NOT include SQL keywords or code. Be vague but helpful.`,
    2: `Ask a guiding question (max 250 characters) about "${errorSubtype}" that leads the learner to discover the solution. Cite relevant concepts but don't give the answer.`,
    3: `Provide clear explanation (max 500 characters) about "${errorSubtype}". You may use partial SQL patterns with placeholders (___) but never complete solutions.`,
  };

  let prompt = `You are an adaptive SQL tutor helping a learner with: "${problem.title}"\n\n`;
  prompt += `Current error/issue: ${errorSubtype}\n\n`;

  if (previousHints.length > 0) {
    prompt += `Previous hints given:\n${previousHints.map((h) => `- ${h}`).join('\n')}\n\n`;
  }

  if (textbookUnits.length > 0) {
    prompt += `Relevant textbook units:\n${textbookUnits.slice(0, 2).map((u) => `- ${u.title}: ${u.content.slice(0, 100)}...`).join('\n')}\n\n`;
  }

  prompt += `Instruction: ${rungPrompts[rung]}\n\n`;
  prompt += `Format your response as:\nContent: [your hint here]\nConcepts: [comma-separated concept IDs]\nSources: [comma-separated source references]`;

  return prompt;
}

/**
 * Parse LLM output for adaptive hints
 */
function parseAdaptiveOutput(rawOutput: string, rung: 1 | 2 | 3): AdaptiveHintOutput {
  const lines = rawOutput.split('\n').map((l) => l.trim());

  let content = '';
  const conceptIds: string[] = [];
  const sourceRefIds: string[] = [];

  for (const line of lines) {
    if (line.toLowerCase().startsWith('content:')) {
      content = line.slice(8).trim();
    } else if (line.toLowerCase().startsWith('concepts:')) {
      const concepts = line.slice(9).trim();
      conceptIds.push(...concepts.split(',').map((c) => c.trim()).filter(Boolean));
    } else if (line.toLowerCase().startsWith('sources:')) {
      const sources = line.slice(8).trim();
      sourceRefIds.push(...sources.split(',').map((s) => s.trim()).filter(Boolean));
    }
  }

  // If no structured format found, use the whole output as content
  if (!content && rawOutput.trim()) {
    content = rawOutput.trim();
  }

  // Apply length limits based on rung
  const maxLengths: Record<number, number> = { 1: 100, 2: 250, 3: 500 };
  const maxLength = maxLengths[rung];
  if (content.length > maxLength) {
    content = content.slice(0, maxLength).trim() + '...';
  }

  return { content, conceptIds, sourceRefIds };
}

/**
 * Create error hint when LLM fails
 */
function createLLMErrorHint(rung: GuidanceRung, retrievalSignals: RetrievalSignalMeta, errorMessage: string): EnhancedHint {
  return {
    content: 'Unable to generate hint at this time. Please try again or check your Textbook for related examples.',
    rung,
    sources: {
      sqlEngage: false,
      textbook: false,
      llm: false,
      pdfPassages: false,
    },
    conceptIds: [],
    llmGenerated: false,
    confidence: 0.3,
    retrievalConfidence: retrievalSignals.retrievalConfidence,
    fallbackReason: 'llm_error',
    safetyFilterApplied: false,
    retrievedSourceIds: retrievalSignals.retrievedSourceIds,
    retrievedChunkIds: retrievalSignals.retrievedChunkIds,
    llmFailed: true,
    llmErrorMessage: errorMessage,
  };
}

export { MIN_RETRIEVAL_CONFIDENCE };
