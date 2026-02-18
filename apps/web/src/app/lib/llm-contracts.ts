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

// LLM Output contract types
export type LLMOutputMetadata = {
  grounded: boolean;
  sourceRefIdsCount: number;
  conceptIdsCount: number;
  ungroundedConcepts: string[];
  contractVersion: string;
  validationErrors: string[];
};

export type LLMGuidanceOutput = {
  content: string;
  conceptIds: string[];
  sourceRefIds: string[];
  metadata: LLMOutputMetadata;
  fallbackUsed?: boolean;
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
1. Output MUST be under 150 characters
2. Include conceptIds[] array at the end
3. Do NOT provide full explanations - only brief nudges
4. Stay grounded in the provided retrieval bundle
5. If retrieval bundle is empty, use fallback behavior

VALID OUTPUT FORMAT:
[Brief hint text here]

conceptIds: ["concept-id-1"]`,
    user: `Retrieval Bundle:
- Error subtype: {{errorSubtype}}
- Problem: {{problemTitle}}
- Schema: {{schemaText}}
- Concept candidates: {{conceptCandidates}}
- PDF passages: {{pdfPassages}}
- Previous hints: {{hintHistory}}

Provide a brief micro-hint (max 150 chars) that nudges toward the solution without giving it away.`,
    requiredFields: ['conceptIds'],
    maxOutputLength: 200 // Allow some buffer for the conceptIds line
  },

  // Rung 2: Explanation - structured, source-grounded
  2: {
    system: `You are a SQL learning assistant providing structured explanations.

CONTRACT REQUIREMENTS (MUST FOLLOW):
1. Output MUST be under 800 characters
2. MUST cite at least one source from the retrieval bundle
3. Include conceptIds[] array at the end
4. Include sourceRefIds[] array at the end
5. Do NOT provide copy-paste solutions
6. Explain the CONCEPT, not just the fix

VALID OUTPUT FORMAT:
[Your explanation here, citing sources like "(see textbook p.XX)"]

conceptIds: ["concept-id-1", "concept-id-2"]
sourceRefIds: ["doc:chunk:page"]

GROUNDING RULES:
- Every concept mentioned must have a corresponding sourceRefId
- If you mention a textbook page, include it in sourceRefIds
- Ungrounded explanations will be rejected`,
    user: `Retrieval Bundle:
- Error subtype: {{errorSubtype}}
- Problem: {{problemTitle}}
- Schema: {{schemaText}}
- Concept candidates: {{conceptCandidates}}
- Source passages: {{sourcePassages}}
- PDF passages: {{pdfPassages}}
- Why retrieved: {{whyRetrieved}}
- Previous hints: {{hintHistory}}

Provide a structured explanation (max 800 chars) that:
1. Explains the underlying concept
2. Cites specific sources from the retrieval bundle
3. Guides toward understanding without giving the full answer`,
    requiredFields: ['conceptIds', 'sourceRefIds'],
    maxOutputLength: 900
  },

  // Rung 3: Reflective Note - My Textbook unit
  3: {
    system: `You are a SQL learning assistant creating reflective notes for "My Textbook".

CONTRACT REQUIREMENTS (MUST FOLLOW):
1. Output MUST include ALL required sections
2. MUST cite all relevant sources from retrieval bundle
3. Include conceptIds[] array
4. Include sourceRefIds[] array with ALL cited sources
5. Structure as a learning unit, not just a hint

REQUIRED SECTIONS:
1. Summary: Brief overview of the concept (1-2 sentences)
2. Common Mistakes: List 2-3 typical errors with explanations
3. Minimal Example: A simple, clear SQL example
4. Key Takeaway: One memorable rule to remember

VALID OUTPUT FORMAT:
## Summary
[Summary text]

## Common Mistakes
- Mistake 1: [description]
- Mistake 2: [description]

## Minimal Example
\`\`\`sql
[SQL code]
\`\`\`

## Key Takeaway
[Key rule]

conceptIds: ["concept-id-1", "concept-id-2"]
sourceRefIds: ["doc:chunk:page", "doc:chunk:page2"]

GROUNDING RULES:
- Every concept must have ≥1 source
- Every source in sourceRefIds must be from the retrieval bundle
- Examples should be minimal but complete`,
    user: `Retrieval Bundle:
- Error subtype: {{errorSubtype}}
- Problem: {{problemTitle}}
- Schema: {{schemaText}}
- Concept candidates: {{conceptCandidates}}
- Source passages: {{sourcePassages}}
- Concept source refs: {{conceptSourceRefs}}
- PDF passages: {{pdfPassages}}
- Why retrieved: {{whyRetrieved}}
- Escalation history: {{escalationHistory}}

Create a reflective note (My Textbook unit) with:
1. Summary of the concept
2. Common mistakes learners make
3. A minimal, clear SQL example
4. Key takeaway rule

Ensure all concepts are grounded in the provided sources.`,
    requiredFields: ['conceptIds', 'sourceRefIds', 'summary', 'commonMistakes', 'minimalExample'],
    maxOutputLength: 2500
  }
};

// Parse LLM output to extract structured fields
export function parseLLMOutput(rawOutput: string): {
  content: string;
  conceptIds: string[];
  sourceRefIds: string[];
} {
  const lines = rawOutput.split('\n');
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

  return { content: content.trim(), conceptIds, sourceRefIds };
}

// Validate LLM output against contract
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

// Generate fallback content when retrieval is empty
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

// Main function to generate guidance with contract enforcement
export async function generateGuidance(
  rung: GuidanceRung,
  retrievalBundle: RetrievalBundle,
  llmCall: (prompt: string) => Promise<string>
): Promise<LLMGuidanceOutput> {
  // Check if we have sufficient retrieval for grounding
  const hasSources = retrievalBundle.sourcePassages.length > 0 || 
                     retrievalBundle.pdfPassages.length > 0 ||
                     retrievalBundle.retrievedSourceIds.length > 0;

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
  return template
    .replace('{{errorSubtype}}', bundle.lastErrorSubtypeId)
    .replace('{{problemTitle}}', bundle.problemTitle)
    .replace('{{schemaText}}', bundle.schemaText)
    .replace('{{conceptCandidates}}', bundle.conceptCandidates.map(c => `${c.id} (${c.name})`).join(', '))
    .replace('{{sourcePassages}}', bundle.sourcePassages.map(s => `[${s.docId} p.${s.page}]: ${s.text.slice(0, 100)}...`).join('\n'))
    .replace('{{pdfPassages}}', bundle.pdfPassages.map(p => `[${p.docId} p.${p.page}]: ${p.text.slice(0, 100)}...`).join('\n'))
    .replace('{{whyRetrieved}}', JSON.stringify(bundle.whyRetrieved, null, 2))
    .replace('{{hintHistory}}', bundle.hintHistory.map(h => `Rung ${h.hintLevel}: ${h.hintText.slice(0, 50)}...`).join('\n'))
    .replace('{{conceptSourceRefs}}', JSON.stringify(bundle.conceptSourceRefs, null, 2))
    .replace('{{escalationHistory}}', '[]'); // Would come from ladder state
}

// Log LLM output for replay/analysis
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
