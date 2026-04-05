/**
 * Hint Service Resources
 *
 * Resource availability checking for hint generation.
 */

import { storage } from '../../storage/storage';
import { isBackendConfigured } from '../../runtime-config';
import { isLLMAvailable } from '../../api/llm-client';
import type { AvailableResources } from './types';

/**
 * Check which resources are available for hint generation
 */
export function checkAvailableResources(learnerId: string): AvailableResources {
  // SQL-Engage is always available (bundled CSV)
  const sqlEngage = true;

  // Check if learner has textbook content
  const textbookUnits = storage.getTextbook(learnerId);
  const textbook = textbookUnits.length > 0;

  // Check LLM availability (Ollama or other provider)
  const llm = checkLLMAvailability();

  // Check PDF index
  const pdfIndex = checkPDFIndexAvailability();

  return { sqlEngage, textbook, llm, pdfIndex };
}

/**
 * Check resource availability and refine LLM support from live backend status.
 */
export async function checkAvailableResourcesAsync(learnerId: string): Promise<AvailableResources> {
  const resources = checkAvailableResources(learnerId);

  if (!resources.llm) {
    return resources;
  }

  try {
    return {
      ...resources,
      llm: await isLLMAvailable(),
    };
  } catch {
    return {
      ...resources,
      llm: false,
    };
  }
}

/**
 * Check if LLM service is available
 */
function checkLLMAvailability(): boolean {
  if (isBackendConfigured()) {
    return true;
  }

  const ollamaUrl = import.meta.env.VITE_OLLAMA_URL;
  if (ollamaUrl && ollamaUrl.length > 0) {
    return true;
  }

  return false;
}

/**
 * Check if PDF index is available
 */
function checkPDFIndexAvailability(): boolean {
  const pdfIndex = storage.getPdfIndex();
  return pdfIndex !== null && pdfIndex.chunkCount > 0;
}

/**
 * Find relevant textbook units for the current error context
 */
export function findRelevantTextbookUnits(
  learnerId: string,
  errorSubtypeId: string,
  conceptIds: string[]
): InstructionalUnit[] {
  const allUnits = storage.getTextbook(learnerId);

  if (allUnits.length === 0) return [];

  // Score each unit by relevance
  const scored = allUnits.map((unit) => {
    let score = 0;

    // Match by concept ID
    if (unit.conceptId && conceptIds.includes(unit.conceptId)) {
      score += 3;
    }

    // Match by related concept IDs
    if (unit.conceptIds) {
      for (const conceptId of unit.conceptIds) {
        if (conceptIds.includes(conceptId)) {
          score += 2;
        }
      }
    }

    // Match by content similarity (simple keyword matching)
    const content = unit.content.toLowerCase();
    const errorKeywords = errorSubtypeId.toLowerCase().split(/[-_]/);
    for (const keyword of errorKeywords) {
      if (keyword.length > 3 && content.includes(keyword)) {
        score += 1;
      }
    }

    // Boost for recent units (within last 7 days)
    const ageMs = Date.now() - (unit.addedTimestamp || 0);
    if (ageMs < 7 * 24 * 60 * 60 * 1000) {
      score += 0.5;
    }

    return { unit, score };
  });

  // Sort by score and return top 3
  scored.sort((a, b) => b.score - a.score);
  return scored.filter((s) => s.score > 0).slice(0, 3).map((s) => s.unit);
}

import type { InstructionalUnit } from '../../types';

/**
 * Get a human-readable description of the current hint strategy
 */
export function getHintStrategyDescription(resources: AvailableResources): string {
  if (resources.llm && resources.textbook) {
    return 'AI-powered hints with personal Textbook context';
  }
  if (resources.llm) {
    return 'AI-powered hints with SQL-Engage dataset';
  }
  if (resources.textbook) {
    return 'Textbook-enhanced hints from SQL-Engage dataset';
  }
  return 'Standard hints from SQL-Engage dataset';
}
