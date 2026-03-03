/**
 * Controlled LLM Contracts (Week 3 D5)
 * 
 * Three prompt templates + validators for grounded, source-cited help generation.
 * 
 * Contracts:
 * - Must include conceptIds[]
 * - Must cite sourceRefIds[] (for rung 2+)
 * - Must not introduce concepts not in retrieval bundle
 * - Fallback when retrieval empty
 * - Logged with: grounded: true/false, sourceRefIdsCount
 */

import type { GuidanceRung } from './guidance-ladder';
import type { RetrievalBundle } from './retrieval-bundle';
import type { InstructionalUnit } from '../types';

/**
 * Metadata for validated LLM output
 */
export type LLMOutputMetadata = {
  /** Whether output is grounded in sources */
  grounded: boolean;
  /** Count of source references */
  sourceRefIdsCount: number;
  /** Count of concepts referenced */
  conceptIdsCount: number;
  /** Concepts not in retrieval bundle */
  ungroundedConcepts: string[];
  /** Contract version used */
  contractVersion: string;
  /** Validation error messages */
  validationErrors: string[];
};

/**
 * Structured output from LLM guidance generation
 */
export type LLMGuidanceOutput = {
  /** Generated content text */
  content: string;
  /** Referenced concept IDs */
  conceptIds: string[];
  /** Source reference IDs */
  sourceRefIds: string[];
  /** Validation metadata */
  metadata: LLMOutputMetadata;
  /** Whether fallback was used */
  fallbackUsed?: boolean;
  /** Reason for using fallback */
  fallbackReason?: string;
};

// Contract version
export const LLM_CONTRACT_VERSION = 'llm-contract-grounded-v1';

// Rung-specific prompt templates
export const PROMPT_TEMPLATES: Record<
  GuidanceRung,
  {
    system: string;
    user: string;
    requiredFields: string[];
    maxOutputLength: number;
  }
> = {
  // Rung 1: Micro-hint - brief, contextual
  1: {
    system: `You are a SQL learning assistant providing brief micro-hints.

CONTRACT REQUIREMENTS (MUST FOLLOW):
1. Output ONLY the hint text (max 150 chars) + conceptIds array
2. Do NOT include "Retrieval Bundle" or any prompt text in your output
3. Do NOT provide full explanations - only brief nudges
4. Stay grounded in the provided context
5. Start immediately with your hint text

VALID OUTPUT FORMAT (COPY THIS EXACTLY, REPLACE [text]):
[Your brief hint here, max 150 characters]

conceptIds: ["concept-id-1"]`,
    user: `CONTEXT (use this information, do NOT repeat it):
- Error: {{errorSubtype}}
- Problem: {{problemTitle}}
- Schema: {{schemaText}}
- Available concepts: {{conceptCandidates}}
- Reference materials: {{pdfPassages}}
- Previous hints given: {{hintHistory}}

INSTRUCTION: Write ONLY a brief micro-hint (max 150 chars) that nudges the learner toward the solution. Start immediately with your hint. Do NOT include the context above in your response.`,
    requiredFields: ['conceptIds'],
    maxOutputLength: 200 // Allow some buffer for the conceptIds line
  },

  // Rung 2: Explanation - structured, source-grounded
  2: {
    system: `You are a SQL learning assistant providing structured explanations.

CONTRACT REQUIREMENTS (MUST FOLLOW):
1. Output ONLY your explanation (max 800 chars) + conceptIds + sourceRefIds
2. Do NOT include "Retrieval Bundle" or any prompt text in your output
3. MUST cite at least one source like "(see textbook p.XX)"
4. Do NOT provide copy-paste solutions
5. Explain the CONCEPT, not just the fix
6. Start immediately with your explanation

VALID OUTPUT FORMAT (COPY THIS EXACTLY, REPLACE [text]):
[Your explanation here, max 800 characters, cite sources like "(see textbook p.XX)"]

conceptIds: ["concept-id-1", "concept-id-2"]
sourceRefIds: ["doc:chunk:page"]

GROUNDING RULES:
- Every concept mentioned must have a corresponding sourceRefId
- Cite sources naturally in your text, e.g., "According to the textbook (p.12)..."
- Start immediately with your explanation, no preamble`,
    user: `CONTEXT (use this information, do NOT repeat it):
- Error: {{errorSubtype}}
- Problem: {{problemTitle}}
- Schema: {{schemaText}}
- Available concepts: {{conceptCandidates}}
- Source passages: {{sourcePassages}}
- Reference materials: {{pdfPassages}}
- Textbook units: {{textbookUnits}}
- Retrieval reasoning: {{whyRetrieved}}
- Previous hints: {{hintHistory}}

INSTRUCTION: Write ONLY a structured explanation (max 800 chars) that explains the concept and cites sources. Start immediately with your explanation. Do NOT include the context above in your response.`,
    requiredFields: ['conceptIds', 'sourceRefIds'],
    maxOutputLength: 900
  },

  // Rung 3: Reflective Note - My Textbook unit
  3: {
    system: `You are a SQL learning assistant creating reflective notes for "My Textbook".

CONTRACT REQUIREMENTS (MUST FOLLOW):
1. Output ONLY the required sections + conceptIds + sourceRefIds
2. Do NOT include "Retrieval Bundle" or any prompt text in your output
3. MUST cite all relevant sources
4. Structure as a learning unit with ALL 4 sections
5. Start immediately with ## Summary

VALID OUTPUT FORMAT (COPY THIS EXACTLY, REPLACE [text]):
## Summary
[1-2 sentence overview of the concept]

## Common Mistakes
- Mistake 1: [description with explanation]
- Mistake 2: [description with explanation]
- Mistake 3: [optional description]

## Minimal Example
\`\`\`sql
[A simple, clear SQL example]
\`\`\`

## Key Takeaway
[One memorable rule to remember]

conceptIds: ["concept-id-1", "concept-id-2"]
sourceRefIds: ["doc:chunk:page", "doc:chunk:page2"]

GROUNDING RULES:
- Every concept must have ≥1 source cited
- Start immediately with ## Summary, no preamble
- Make examples minimal but complete and runnable`,
    user: `CONTEXT (use this information, do NOT repeat it):
- Error: {{errorSubtype}}
- Problem: {{problemTitle}}
- Schema: {{schemaText}}
- Available concepts: {{conceptCandidates}}
- Source passages: {{sourcePassages}}
- Concept references: {{conceptSourceRefs}}
- Reference materials: {{pdfPassages}}
- Textbook units: {{textbookUnits}}
- Retrieval reasoning: {{whyRetrieved}}
- Escalation history: {{escalationHistory}}

INSTRUCTION: Create a reflective note with ALL 4 sections: Summary, Common Mistakes, Minimal Example, Key Takeaway. Start immediately with ## Summary. Do NOT include the context above in your response.`,
    requiredFields: ['conceptIds', 'sourceRefIds', 'summary', 'commonMistakes', 'minimalExample'],
    maxOutputLength: 2500
  }
};

/**
 * Parse LLM output to extract structured fields
 * @param rawOutput - Raw LLM response text
 * @returns Parsed content, concept IDs, and source refs
 */
export function parseLLMOutput(rawOutput: string): {
  content: string;
  conceptIds: string[];
  sourceRefIds: string[];
} {
  let content = rawOutput;
  const conceptIds: string[] = [];
  const sourceRefIds: string[] = [];

  // Find conceptIds line
  const conceptIdsMatch = rawOutput.match(/conceptIds:\s*\[([^\]]*)\]/i);
  if (conceptIdsMatch) {
    content = content.replace(conceptIdsMatch[0], '').trim();
    const ids = conceptIdsMatch[1]
      .split(',')
      .map((id) => id.trim().replace(/["']/g, ''))
      .filter(Boolean);
    conceptIds.push(...ids);
  }

  // Find sourceRefIds line
  const sourceRefIdsMatch = rawOutput.match(/sourceRefIds:\s*\[([^\]]*)\]/i);
  if (sourceRefIdsMatch) {
    content = content.replace(sourceRefIdsMatch[0], '').trim();
    const ids = sourceRefIdsMatch[1]
      .split(',')
      .map((id) => id.trim().replace(/["']/g, ''))
      .filter(Boolean);
    sourceRefIds.push(...ids);
  }

  // Clean up any echoed prompt content
  const promptEchoPatterns = [
    /Retrieval Bundle:.*?(?=\n\n|$)/gis,
    /CONTEXT \(use this information.*?(?=\n\n|$)/gis,
    /INSTRUCTION:.*?(?=\n\n|$)/gis,
    /Provide a brief micro-hint.*?(?=\n\n|$)/gis,
    /Write ONLY a brief.*?(?=\n\n|$)/gis,
    /Write ONLY a structured.*?(?=\n\n|$)/gis,
    /Create a reflective note.*?(?=\n\n|$)/gis,
    /Error subtype:.*?\n/gi,
    /Problem:.*?\n/gi,
    /Schema:.*?\n/gi,
    /- PDF passages:.*?\n/gi,
    /- Previous hints:.*?\n/gi,
    /VALID OUTPUT FORMAT.*?(?=\n\n|$)/gis,
    /\[Brief hint text here\]/gi,
    /\[Your brief hint here.*?\]/gi,
    /\[Your explanation here.*?\]/gi,
    /\[Summary text\]/gi,
  ];
  
  for (const pattern of promptEchoPatterns) {
    content = content.replace(pattern, '');
  }
  
  // Clean up multiple newlines
  content = content.replace(/\n{3,}/g, '\n\n').trim();
  
  // Remove any remaining bracketed placeholders
  content = content.replace(/\[.*?\]/g, '').trim();

  return { content: content.trim(), conceptIds, sourceRefIds };
}

/**
 * Validate LLM output against contract rules
 * @param output - Parsed LLM output
 * @param rung - Guidance rung level
 * @param retrievalBundle - Bundle for grounding validation
 * @returns Validation result with metadata
 */
export function validateLLMOutput(
  output: { content: string; conceptIds: string[]; sourceRefIds: string[] },
  rung: GuidanceRung,
  retrievalBundle: RetrievalBundle
): {
  valid: boolean;
  metadata: LLMOutputMetadata;
} {
  const errors: string[] = [];
  const template = PROMPT_TEMPLATES[rung];

  // Check required fields
  for (const field of template.requiredFields) {
    if (field === 'conceptIds' && output.conceptIds.length === 0) {
      errors.push(`Missing required field: conceptIds`);
    }
    if (field === 'sourceRefIds') {
      if (rung >= 2 && output.sourceRefIds.length === 0) {
        errors.push(`Missing required field: sourceRefIds (required for rung ${rung})`);
      }
    }
  }

  // Check length
  if (output.content.length > template.maxOutputLength) {
    errors.push(
      `Content length (${output.content.length}) exceeds rung ${rung} maximum (${template.maxOutputLength})`
    );
  }

  // Check grounding: conceptIds must be in retrieval bundle
  const bundleConceptIds = new Set(retrievalBundle.conceptCandidates.map((c) => c.id));
  const ungroundedConcepts = output.conceptIds.filter((id) => !bundleConceptIds.has(id));
  if (ungroundedConcepts.length > 0) {
    errors.push(
      `Ungrounded concepts introduced: ${ungroundedConcepts.join(', ')} (not in retrieval bundle)`
    );
  }

  // Check grounding: sourceRefIds must be in retrieval bundle
  const bundleSourceIds = new Set(retrievalBundle.retrievedSourceIds);
  const ungroundedSources = output.sourceRefIds.filter((id) => !bundleSourceIds.has(id));
  if (ungroundedSources.length > 0) {
    errors.push(
      `Ungrounded sources cited: ${ungroundedSources.join(', ')} (not in retrieval bundle)`
    );
  }

  // For rung 2+, must have source citations
  const grounded = rung === 1 
    ? output.conceptIds.length > 0  // Rung 1 just needs conceptIds
    : output.sourceRefIds.length > 0 && ungroundedSources.length === 0;

  const metadata: LLMOutputMetadata = {
    grounded,
    sourceRefIdsCount: output.sourceRefIds.length,
    conceptIdsCount: output.conceptIds.length,
    ungroundedConcepts,
    contractVersion: LLM_CONTRACT_VERSION,
    validationErrors: errors
  };

  return { valid: errors.length === 0, metadata };
}

/**
 * Generate fallback content when retrieval is empty
 * @param rung - Guidance rung level
 * @param errorSubtype - Optional error subtype for context
 * @returns Fallback guidance output
 */
export function generateFallbackContent(
  rung: GuidanceRung,
  errorSubtype?: string
): LLMGuidanceOutput {
  const fallbackMessages: Record<GuidanceRung, string> = {
    1: `Try breaking down your query step by step. Start with SELECT, then add FROM.`,
    2: `I don't have a textbook source for this specific error yet. Try checking your syntax - common issues include missing commas, unmatched brackets, or incorrect table names. If you're stuck, try a simpler version of your query first.`,
    3: `## Summary\nThis type of error doesn't have a documented pattern in our textbook yet.\n\n## Common Mistakes\n- Syntax errors (check commas, brackets)\n- Misspelled table or column names\n- Missing required clauses\n\n## Minimal Example\n\`\`\`sql\n-- Start with a simple query\nSELECT * FROM table_name;\n\n-- Then add complexity gradually\n\`\`\`\n\n## Key Takeaway\nBuild queries incrementally - start simple and add complexity one step at a time.`
  };

  return {
    content: fallbackMessages[rung],
    conceptIds: errorSubtype ? ['syntax-error'] : [],
    sourceRefIds: [],
    metadata: {
      grounded: false, // Fallback is explicitly ungrounded
      sourceRefIdsCount: 0,
      conceptIdsCount: errorSubtype ? 1 : 0,
      ungroundedConcepts: [],
      contractVersion: LLM_CONTRACT_VERSION,
      validationErrors: []
    },
    fallbackUsed: true,
    fallbackReason: 'Retrieval bundle empty or insufficient sources'
  };
}

/**
 * Generate guidance with contract enforcement
 * Main entry point for LLM guidance generation
 * @param rung - Target guidance rung
 * @param retrievalBundle - Context retrieval bundle
 * @param llmCall - Function to call LLM
 * @returns Promise resolving to guidance output
 */
export async function generateGuidance(
  rung: GuidanceRung,
  retrievalBundle: RetrievalBundle,
  llmCall: (prompt: string) => Promise<string>
): Promise<LLMGuidanceOutput> {
  // Check if we have sufficient retrieval for grounding
  // Include textbookUnits as valid sources for rung 2+
  const textbookUnits = (retrievalBundle as RetrievalBundle & { textbookUnits?: InstructionalUnit[] }).textbookUnits;
  const hasSources = retrievalBundle.sourcePassages.length > 0 || 
                     retrievalBundle.pdfPassages.length > 0 ||
                     retrievalBundle.retrievedSourceIds.length > 0 ||
                     (textbookUnits && textbookUnits.length > 0);

  // For rung 2+, require sources
  if (rung >= 2 && !hasSources) {
    return generateFallbackContent(rung, retrievalBundle.lastErrorSubtypeId);
  }

  // Build prompt from template
  const template = PROMPT_TEMPLATES[rung];
  const prompt = buildPrompt(template.user, retrievalBundle);

  try {
    // Call LLM
    const rawOutput = await llmCall(template.system + '\n\n' + prompt);

    // Parse output
    const parsed = parseLLMOutput(rawOutput);

    // Validate against contract
    const validation = validateLLMOutput(parsed, rung, retrievalBundle);

    // If validation fails for rung 2+, use fallback
    if (rung >= 2 && !validation.valid) {
      return {
        ...generateFallbackContent(rung, retrievalBundle.lastErrorSubtypeId),
        metadata: {
          ...validation.metadata,
          validationErrors: validation.metadata.validationErrors,
          grounded: false
        }
      };
    }

    return {
      content: parsed.content,
      conceptIds: parsed.conceptIds,
      sourceRefIds: parsed.sourceRefIds,
      metadata: validation.metadata,
      fallbackUsed: false
    };
  } catch (error) {
    // On any error, return fallback
    return {
      ...generateFallbackContent(rung, retrievalBundle.lastErrorSubtypeId),
      fallbackReason: error instanceof Error ? error.message : 'LLM call failed'
    };
  }
}

// Build prompt by substituting template variables
function buildPrompt(template: string, bundle: RetrievalBundle): string {
  // Get textbook units if available
  const textbookUnits = (bundle as RetrievalBundle & { textbookUnits?: InstructionalUnit[] }).textbookUnits;
  const textbookUnitsText = textbookUnits && textbookUnits.length > 0
    ? textbookUnits.map(u => `[${u.title}]: ${u.content.slice(0, 200)}...`).join('\n')
    : 'No textbook units available';

  return template
    .replace('{{errorSubtype}}', bundle.lastErrorSubtypeId)
    .replace('{{problemTitle}}', bundle.problemTitle)
    .replace('{{schemaText}}', bundle.schemaText)
    .replace('{{conceptCandidates}}', bundle.conceptCandidates.map(c => `${c.id} (${c.name})`).join(', '))
    .replace('{{sourcePassages}}', bundle.sourcePassages.map(s => `[${s.docId} p.${s.page}]: ${s.text.slice(0, 100)}...`).join('\n'))
    .replace('{{pdfPassages}}', bundle.pdfPassages.map(p => `[${p.docId} p.${p.page}]: ${p.text.slice(0, 100)}...`).join('\n'))
    .replace('{{textbookUnits}}', textbookUnitsText)
    .replace('{{whyRetrieved}}', JSON.stringify(bundle.whyRetrieved, null, 2))
    .replace('{{hintHistory}}', bundle.hintHistory.map(h => `Rung ${h.hintLevel}: ${h.hintText.slice(0, 50)}...`).join('\n'))
    .replace('{{conceptSourceRefs}}', JSON.stringify(bundle.conceptSourceRefs, null, 2))
    .replace('{{escalationHistory}}', '[]'); // Would come from ladder state
}

/**
 * Create log entry for LLM generation
 * @param output - LLM output to log
 * @param rung - Guidance rung level
 * @param bundle - Retrieval bundle used
 * @returns Log entry object
 */
export function createLLMLogEntry(
  output: LLMGuidanceOutput,
  rung: GuidanceRung,
  bundle: RetrievalBundle
): {
  eventType: 'llm_generation';
  timestamp: number;
  rung: GuidanceRung;
  grounded: boolean;
  sourceRefIdsCount: number;
  conceptIdsCount: number;
  fallbackUsed: boolean;
  contractVersion: string;
} {
  return {
    eventType: 'llm_generation',
    timestamp: Date.now(),
    rung,
    grounded: output.metadata.grounded,
    sourceRefIdsCount: output.metadata.sourceRefIdsCount,
    conceptIdsCount: output.metadata.conceptIdsCount,
    fallbackUsed: output.fallbackUsed || false,
    contractVersion: LLM_CONTRACT_VERSION
  };
}
