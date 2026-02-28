/**
 * HDI (Hint Dependency Index) Calculator
 * 
 * Measures learner dependency on hints through multiple component metrics.
 * 
 * Component 9 of Week 5: HDI Trajectory Tracking
 * Version: hdi-calculator-v1
 */

import type { InteractionEvent, HDIComponents, HDILevel } from '../types';

export const HDI_CALCULATOR_VERSION = 'hdi-calculator-v1';

// Weight constants for HDI calculation
const WEIGHTS = {
  hpa: 0.3,  // Hints Per Attempt
  aed: 0.133, // Average Escalation Depth
  er: 0.3,   // Explanation Rate
  reae: 0.133, // Repeated Error After Explanation
  iwh: 0.134, // Improvement Without Hint
};

/**
 * Calculate Hints Per Attempt (HPA)
 * Ratio of hint requests to problem attempts (executions)
 * Normalized to 0-1 range (capped at 1.0)
 */
export function calculateHPA(interactions: InteractionEvent[]): number {
  if (!interactions || interactions.length === 0) {
    return 0;
  }

  const hintRequests = interactions.filter(
    (i) => i.eventType === 'hint_request' || i.eventType === 'guidance_request'
  ).length;

  const attempts = interactions.filter(
    (i) => i.eventType === 'execution'
  ).length;

  if (attempts === 0) {
    return 0;
  }

  // Cap at 1.0 to normalize
  return Math.min(hintRequests / attempts, 1.0);
}

/**
 * Calculate Average Escalation Depth (AED)
 * Average hint level used (1-3), normalized to 0-1 range
 * Level 1 = 0, Level 2 = 0.5, Level 3 = 1
 */
export function calculateAED(interactions: InteractionEvent[]): number {
  if (!interactions || interactions.length === 0) {
    return 0;
  }

  const hintEvents = interactions.filter(
    (i) =>
      (i.eventType === 'hint_request' ||
        i.eventType === 'guidance_request' ||
        i.eventType === 'guidance_view' ||
        i.eventType === 'hint_view') &&
      i.hintLevel !== undefined
  );

  if (hintEvents.length === 0) {
    return 0;
  }

  const totalLevel = hintEvents.reduce((sum, i) => sum + (i.hintLevel || 1), 0);
  const averageLevel = totalLevel / hintEvents.length;

  // Normalize: level 1 -> 0, level 3 -> 1
  // Formula: (level - 1) / 2
  return Math.min(Math.max((averageLevel - 1) / 2, 0), 1);
}

/**
 * Calculate Explanation Rate (ER)
 * Ratio of explanation views to problem attempts
 */
export function calculateER(interactions: InteractionEvent[]): number {
  if (!interactions || interactions.length === 0) {
    return 0;
  }

  const explanationViews = interactions.filter(
    (i) => i.eventType === 'explanation_view'
  ).length;

  const attempts = interactions.filter(
    (i) => i.eventType === 'execution'
  ).length;

  if (attempts === 0) {
    return 0;
  }

  return Math.min(explanationViews / attempts, 1.0);
}

/**
 * Calculate Repeated Error After Explanation (REAE)
 * Measures if learner makes errors after viewing explanations
 * Ratio of errors after explanation to total errors
 */
export function calculateREAE(interactions: InteractionEvent[]): number {
  if (!interactions || interactions.length === 0) {
    return 0;
  }

  // Sort by timestamp to track sequence
  const sorted = [...interactions].sort((a, b) => a.timestamp - b.timestamp);

  let explanationSeen = false;
  let errorsAfterExplanation = 0;
  let totalErrors = 0;

  for (const interaction of sorted) {
    if (interaction.eventType === 'explanation_view') {
      explanationSeen = true;
    } else if (interaction.eventType === 'error') {
      totalErrors++;
      if (explanationSeen) {
        errorsAfterExplanation++;
      }
    }
  }

  if (totalErrors === 0) {
    return 0;
  }

  return errorsAfterExplanation / totalErrors;
}

/**
 * Calculate Improvement Without Hint (IWH)
 * Measures successful attempts that didn't use hints
 * Ratio of successful attempts without hints to total successful attempts
 */
export function calculateIWH(interactions: InteractionEvent[]): number {
  if (!interactions || interactions.length === 0) {
    return 0;
  }

  // Sort by timestamp
  const sorted = [...interactions].sort((a, b) => a.timestamp - b.timestamp);

  // Track problems that had hint usage
  const problemsWithHints = new Set<string>();
  const successfulProblems = new Set<string>();
  const hintUsedBeforeSuccess = new Set<string>();

  for (const interaction of sorted) {
    const problemId = interaction.problemId;

    if (
      interaction.eventType === 'hint_request' ||
      interaction.eventType === 'guidance_request' ||
      interaction.eventType === 'hint_view'
    ) {
      problemsWithHints.add(problemId);
    }

    if (interaction.eventType === 'execution' && interaction.successful) {
      successfulProblems.add(problemId);
      if (problemsWithHints.has(problemId)) {
        hintUsedBeforeSuccess.add(problemId);
      }
    }
  }

  if (successfulProblems.size === 0) {
    return 0;
  }

  const successWithoutHints = successfulProblems.size - hintUsedBeforeSuccess.size;
  return successWithoutHints / successfulProblems.size;
}

/**
 * Calculate overall HDI (Hint Dependency Index)
 * Weighted combination of all component metrics
 * Returns value between 0-1 and level classification
 */
export function calculateHDI(
  interactions: InteractionEvent[]
): {
  hdi: number;
  level: HDILevel;
  components: HDIComponents;
} {
  const components = calculateHDIComponents(interactions);

  // Weighted sum (IWH is inverted: higher IWH = lower dependency)
  // So we use (1 - IWH) in the calculation
  const hdi =
    components.hpa * WEIGHTS.hpa +
    components.aed * WEIGHTS.aed +
    components.er * WEIGHTS.er +
    components.reae * WEIGHTS.reae +
    (1 - components.iwh) * WEIGHTS.iwh;

  // Normalize to 0-1
  const normalizedHDI = Math.min(Math.max(hdi, 0), 1);

  // Classify level
  let level: HDILevel;
  if (normalizedHDI < 0.3) {
    level = 'low';
  } else if (normalizedHDI <= 0.6) {
    level = 'medium';
  } else {
    level = 'high';
  }

  return {
    hdi: normalizedHDI,
    level,
    components,
  };
}

/**
 * Calculate all HDI components at once
 */
export function calculateHDIComponents(
  interactions: InteractionEvent[]
): HDIComponents {
  return {
    hpa: calculateHPA(interactions),
    aed: calculateAED(interactions),
    er: calculateER(interactions),
    reae: calculateREAE(interactions),
    iwh: calculateIWH(interactions),
  };
}
