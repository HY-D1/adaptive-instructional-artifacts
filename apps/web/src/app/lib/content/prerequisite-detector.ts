/**
 * Prerequisite Violation Detector
 * 
 * Detects when learners attempt concepts without required prerequisites
 * and logs violations for analytics and intervention.
 */

import { buildConceptGraph, type ConceptNode } from '../../data/concept-graph';
import type { LearnerProfile, InteractionEvent } from '../../types';
import { storage } from '../storage';
import { createEventId } from '../utils/event-id';

export interface PrerequisiteViolation {
  type: 'prerequisite_violation_detected';
  learnerId: string;
  timestamp: number;
  problemId: string;
  conceptAttempted: string;
  missingPrerequisites: string[];
  indirectMissing: string[];  // Prerequisites of prerequisites
  severity: 'low' | 'medium' | 'high';
  suggestedRemediation: string[];
  violationDepth: number;  // How deep the prerequisite gap is
}

export interface ViolationSummary {
  totalViolations: number;
  byConcept: Record<string, number>;
  byMissingPrerequisite: Record<string, number>;
  bySeverity: Record<'low' | 'medium' | 'high', number>;
  recentViolations: PrerequisiteViolation[];
  mostProblematicConcepts: Array<{ conceptId: string; count: number }>;
}

// Configuration for violation detection
const VIOLATION_CONFIG = {
  // Minimum gap depth to trigger a violation (1 = direct prerequisite missing)
  minViolationDepth: 1,
  
  // Severity thresholds based on number of missing prerequisites
  severityThresholds: {
    high: 4,   // 4+ missing prerequisites
    medium: 2, // 2-3 missing prerequisites
    low: 1     // 1 missing prerequisite
  },
  
  // How many remediation suggestions to provide
  maxRemediationSuggestions: 3
};

/**
 * Detect prerequisite violations from an interaction event
 * @param event - The interaction event to analyze
 * @param profile - Learner profile with coverage data
 * @returns Violation object if detected, null otherwise
 */
export function detectPrerequisiteViolation(
  event: InteractionEvent,
  profile: LearnerProfile
): PrerequisiteViolation | null {
  // Only check error events on concepts
  if (event.eventType !== 'error' || !event.conceptIds || event.conceptIds.length === 0) {
    return null;
  }
  
  const graph = buildConceptGraph();
  const coveredConcepts = profile.conceptsCovered;
  
  for (const conceptId of event.conceptIds) {
    const node = graph.get(conceptId);
    if (!node) continue;
    
    // Check direct prerequisites
    const missingPrereqs = node.prerequisites.filter(p => !coveredConcepts.has(p));
    
    if (missingPrereqs.length > 0) {
      // Find all indirect missing prerequisites
      const indirectMissing = findIndirectMissingPrerequisites(
        missingPrereqs,
        graph,
        coveredConcepts
      );
      
      // Calculate severity
      const totalMissing = missingPrereqs.length + indirectMissing.length;
      const severity = calculateSeverity(totalMissing);
      
      // Generate remediation suggestions
      const suggestedRemediation = generateRemediation(
        missingPrereqs,
        indirectMissing,
        graph
      );
      
      return {
        type: 'prerequisite_violation_detected',
        learnerId: event.learnerId,
        timestamp: event.timestamp,
        problemId: event.problemId,
        conceptAttempted: conceptId,
        missingPrerequisites: missingPrereqs,
        indirectMissing,
        severity,
        suggestedRemediation,
        violationDepth: calculateViolationDepth(missingPrereqs, graph, coveredConcepts)
      };
    }
  }
  
  return null;
}

/**
 * Detect violations from multiple concepts at once
 * @param conceptIds - Concepts being attempted
 * @param profile - Learner profile
 * @param event - Base event data for the violation
 * @returns Array of violations detected
 */
export function detectViolationsBatch(
  conceptIds: string[],
  profile: LearnerProfile,
  event: Pick<InteractionEvent, 'learnerId' | 'timestamp' | 'problemId'>
): PrerequisiteViolation[] {
  const graph = buildConceptGraph();
  const coveredConcepts = profile.conceptsCovered;
  const violations: PrerequisiteViolation[] = [];
  const checked = new Set<string>();
  
  for (const conceptId of conceptIds) {
    if (checked.has(conceptId)) continue;
    checked.add(conceptId);
    
    const node = graph.get(conceptId);
    if (!node) continue;
    
    const missingPrereqs = node.prerequisites.filter(p => !coveredConcepts.has(p));
    
    if (missingPrereqs.length > 0) {
      const indirectMissing = findIndirectMissingPrerequisites(
        missingPrereqs,
        graph,
        coveredConcepts
      );
      
      const totalMissing = missingPrereqs.length + indirectMissing.length;
      
      violations.push({
        type: 'prerequisite_violation_detected',
        learnerId: event.learnerId,
        timestamp: event.timestamp,
        problemId: event.problemId,
        conceptAttempted: conceptId,
        missingPrerequisites: missingPrereqs,
        indirectMissing,
        severity: calculateSeverity(totalMissing),
        suggestedRemediation: generateRemediation(missingPrereqs, indirectMissing, graph),
        violationDepth: calculateViolationDepth(missingPrereqs, graph, coveredConcepts)
      });
    }
  }
  
  return violations;
}

/**
 * Log a prerequisite violation to storage
 * @param violation - The violation to log
 * @returns The logged interaction event
 */
export function logPrerequisiteViolation(
  violation: PrerequisiteViolation
): InteractionEvent {
  const event: InteractionEvent = {
    id: createEventId('violation', violation.conceptAttempted),
    sessionId: storage.getActiveSessionId(),
    learnerId: violation.learnerId,
    timestamp: violation.timestamp,
    eventType: 'prerequisite_violation_detected',
    problemId: violation.problemId,
    conceptIds: [violation.conceptAttempted],
    metadata: {
      missingPrerequisites: violation.missingPrerequisites,
      indirectMissing: violation.indirectMissing,
      severity: violation.severity,
      suggestedRemediation: violation.suggestedRemediation,
      violationDepth: violation.violationDepth
    }
  };
  
  storage.saveInteraction(event);
  return event;
}

/**
 * Check if attempting a concept would violate prerequisites
 * @param conceptId - Concept to check
 * @param profile - Learner profile
 * @returns Violation preview (without logging)
 */
export function previewViolation(
  conceptId: string,
  profile: LearnerProfile
): Omit<PrerequisiteViolation, 'type' | 'learnerId' | 'timestamp' | 'problemId'> | null {
  const graph = buildConceptGraph();
  const node = graph.get(conceptId);
  if (!node) return null;
  
  const coveredConcepts = profile.conceptsCovered;
  const missingPrereqs = node.prerequisites.filter(p => !coveredConcepts.has(p));
  
  if (missingPrereqs.length === 0) return null;
  
  const indirectMissing = findIndirectMissingPrerequisites(
    missingPrereqs,
    graph,
    coveredConcepts
  );
  
  const totalMissing = missingPrereqs.length + indirectMissing.length;
  
  return {
    conceptAttempted: conceptId,
    missingPrerequisites: missingPrereqs,
    indirectMissing,
    severity: calculateSeverity(totalMissing),
    suggestedRemediation: generateRemediation(missingPrereqs, indirectMissing, graph),
    violationDepth: calculateViolationDepth(missingPrereqs, graph, coveredConcepts)
  };
}

/**
 * Get violation summary for analytics
 * @param learnerId - Optional learner ID to filter by
 * @returns Summary of all violations
 */
export function getViolationSummary(learnerId?: string): ViolationSummary {
  let interactions = storage.getAllInteractions()
    .filter(i => i.eventType === 'prerequisite_violation_detected');
  
  if (learnerId) {
    interactions = interactions.filter(i => i.learnerId === learnerId);
  }
  
  const violations: PrerequisiteViolation[] = interactions.map(i => ({
    type: 'prerequisite_violation_detected',
    learnerId: i.learnerId,
    timestamp: i.timestamp,
    problemId: i.problemId,
    conceptAttempted: i.metadata?.conceptAttempted as string || i.conceptIds?.[0] || 'unknown',
    missingPrerequisites: (i.metadata?.missingPrerequisites as string[]) || [],
    indirectMissing: (i.metadata?.indirectMissing as string[]) || [],
    severity: (i.metadata?.severity as 'low' | 'medium' | 'high') || 'low',
    suggestedRemediation: (i.metadata?.suggestedRemediation as string[]) || [],
    violationDepth: (i.metadata?.violationDepth as number) || 1
  }));
  
  // Count by concept attempted
  const byConcept: Record<string, number> = {};
  violations.forEach(v => {
    byConcept[v.conceptAttempted] = (byConcept[v.conceptAttempted] || 0) + 1;
  });
  
  // Count by missing prerequisite
  const byMissingPrerequisite: Record<string, number> = {};
  violations.forEach(v => {
    v.missingPrerequisites.forEach(p => {
      byMissingPrerequisite[p] = (byMissingPrerequisite[p] || 0) + 1;
    });
  });
  
  // Count by severity
  const bySeverity: Record<'low' | 'medium' | 'high', number> = { low: 0, medium: 0, high: 0 };
  violations.forEach(v => {
    bySeverity[v.severity]++;
  });
  
  // Get most problematic concepts
  const mostProblematicConcepts = Object.entries(byConcept)
    .map(([conceptId, count]) => ({ conceptId, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);
  
  return {
    totalViolations: violations.length,
    byConcept,
    byMissingPrerequisite,
    bySeverity,
    recentViolations: violations.slice(-10).reverse(),
    mostProblematicConcepts
  };
}

/**
 * Get violations for a specific learner
 * @param learnerId - Learner ID
 * @returns Array of violations
 */
export function getLearnerViolations(learnerId: string): PrerequisiteViolation[] {
  return storage.getInteractionsByLearner(learnerId)
    .filter(i => i.eventType === 'prerequisite_violation_detected')
    .map(i => ({
      type: 'prerequisite_violation_detected',
      learnerId: i.learnerId,
      timestamp: i.timestamp,
      problemId: i.problemId,
      conceptAttempted: i.metadata?.conceptAttempted as string || i.conceptIds?.[0] || 'unknown',
      missingPrerequisites: (i.metadata?.missingPrerequisites as string[]) || [],
      indirectMissing: (i.metadata?.indirectMissing as string[]) || [],
      severity: (i.metadata?.severity as 'low' | 'medium' | 'high') || 'low',
      suggestedRemediation: (i.metadata?.suggestedRemediation as string[]) || [],
      violationDepth: (i.metadata?.violationDepth as number) || 1
    }));
}

/**
 * Find indirect missing prerequisites (prerequisites of prerequisites)
 */
function findIndirectMissingPrerequisites(
  directMissing: string[],
  graph: Map<string, ConceptNode>,
  coveredConcepts: Set<string>
): string[] {
  const indirect = new Set<string>();
  const visited = new Set<string>();
  
  function visit(id: string) {
    if (visited.has(id)) return;
    visited.add(id);
    
    const node = graph.get(id);
    if (!node) return;
    
    for (const prereq of node.prerequisites) {
      if (!coveredConcepts.has(prereq)) {
        indirect.add(prereq);
        visit(prereq);
      }
    }
  }
  
  for (const id of directMissing) {
    visit(id);
  }
  
  // Remove direct missing from indirect
  directMissing.forEach(id => indirect.delete(id));
  
  return Array.from(indirect);
}

/**
 * Calculate severity based on number of missing prerequisites
 */
function calculateSeverity(totalMissing: number): 'low' | 'medium' | 'high' {
  if (totalMissing >= VIOLATION_CONFIG.severityThresholds.high) return 'high';
  if (totalMissing >= VIOLATION_CONFIG.severityThresholds.medium) return 'medium';
  return 'low';
}

/**
 * Generate remediation suggestions based on missing prerequisites
 */
function generateRemediation(
  directMissing: string[],
  indirectMissing: string[],
  graph: Map<string, ConceptNode>
): string[] {
  const suggestions: string[] = [];
  
  // Sort by learning order (prerequisites first)
  const allMissing = [...directMissing, ...indirectMissing];
  const sortedMissing = allMissing.sort((a, b) => {
    const nodeA = graph.get(a);
    const nodeB = graph.get(b);
    return (nodeA?.prerequisites.length || 0) - (nodeB?.prerequisites.length || 0);
  });
  
  // Suggest up to maxRemediationSuggestions
  for (let i = 0; i < Math.min(sortedMissing.length, VIOLATION_CONFIG.maxRemediationSuggestions); i++) {
    const conceptId = sortedMissing[i];
    const node = graph.get(conceptId);
    if (node) {
      suggestions.push(conceptId);
    }
  }
  
  return suggestions;
}

/**
 * Calculate how deep the prerequisite violation goes
 */
function calculateViolationDepth(
  missingPrereqs: string[],
  graph: Map<string, ConceptNode>,
  coveredConcepts: Set<string>
): number {
  let maxDepth = 1;
  const visited = new Set<string>();
  
  function getDepth(id: string, currentDepth: number): number {
    if (visited.has(id)) return currentDepth;
    visited.add(id);
    
    const node = graph.get(id);
    if (!node || node.prerequisites.length === 0) return currentDepth;
    
    let depth = currentDepth;
    for (const prereq of node.prerequisites) {
      if (!coveredConcepts.has(prereq)) {
        depth = Math.max(depth, getDepth(prereq, currentDepth + 1));
      }
    }
    return depth;
  }
  
  for (const prereq of missingPrereqs) {
    maxDepth = Math.max(maxDepth, getDepth(prereq, 1));
  }
  
  return maxDepth;
}

/**
 * Clear violation history for a learner (for testing/reset)
 * @param learnerId - Learner ID
 */
export function clearViolationHistory(learnerId: string): void {
  // This is a no-op in production - violations should not be deleted
  // Included for testing purposes
  console.warn('[PrerequisiteDetector] clearViolationHistory called - this is for testing only');
}
