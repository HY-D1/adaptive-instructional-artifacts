/**
 * Prerequisite Monitor
 * 
 * Monitors learner interactions for prerequisite violations, tracks concept dependencies,
 * and provides real-time warnings and recommendations.
 * 
 * Features:
 * - Detects when learner attempts problem without prerequisite concepts
 * - Emits 'prerequisite_violation_detected' events
 * - Suggests prerequisite concepts to review
 * - Blocks or warns based on violation severity
 * - Tracks violation patterns for analytics
 */

import type { InteractionEvent, LearnerProfile, ConceptNode } from '../../types';
import { buildConceptGraph, type ConceptGraph } from '../../data/concept-graph';
import { storage } from '../storage/storage';
import { createEventId } from '../utils/event-id';

export interface PrerequisiteViolation {
  type: 'prerequisite_violation_detected';
  learnerId: string;
  timestamp: number;
  problemId: string;
  conceptAttempted: string;
  missingPrerequisites: string[];
  indirectMissing: string[];
  severity: 'low' | 'medium' | 'high' | 'blocking';
  suggestedRemediation: string[];
  violationDepth: number;
  blockRecommended: boolean;
}

export interface ViolationSummary {
  totalViolations: number;
  byConcept: Record<string, number>;
  byMissingPrerequisite: Record<string, number>;
  bySeverity: Record<'low' | 'medium' | 'high' | 'blocking', number>;
  recentViolations: PrerequisiteViolation[];
  mostProblematicConcepts: Array<{ conceptId: string; count: number }>;
  violationTrend: 'increasing' | 'stable' | 'decreasing';
}

export interface PrerequisiteCheckResult {
  ready: boolean;
  violations: PrerequisiteViolation[];
  warnings: string[];
  recommendedPath: string[];
}

// Configuration for violation detection
const VIOLATION_CONFIG = {
  // Minimum gap depth to trigger a violation (1 = direct prerequisite missing)
  minViolationDepth: 1,
  
  // Severity thresholds based on number of missing prerequisites
  severityThresholds: {
    blocking: 6, // 6+ missing prerequisites - recommend blocking
    high: 4,     // 4+ missing prerequisites
    medium: 2,   // 2-3 missing prerequisites
    low: 1       // 1 missing prerequisite
  },
  
  // How many remediation suggestions to provide
  maxRemediationSuggestions: 3,
  
  // Threshold for blocking (vs just warning)
  blockingThreshold: 'high' as const,
  
  // Cooldown period between violations for same concept (ms)
  violationCooldownMs: 5 * 60 * 1000 // 5 minutes
};

// In-memory cache for recent violations to prevent spam
const recentViolations = new Map<string, number>();

/**
 * Check if a learner is ready to attempt a problem
 * @param problemConcepts - Concepts required by the problem
 * @param profile - Learner profile with coverage data
 * @returns Check result with violations and recommendations
 */
export function checkProblemReadiness(
  problemConcepts: string[],
  profile: LearnerProfile
): PrerequisiteCheckResult {
  const graph = buildConceptGraph();
  const violations: PrerequisiteViolation[] = [];
  const warnings: string[] = [];
  const allMissingPrereqs = new Set<string>();
  
  for (const conceptId of problemConcepts) {
    const violation = checkConceptViolation(conceptId, profile, graph);
    
    if (violation) {
      // Check cooldown
      const violationKey = `${profile.id}:${conceptId}`;
      const lastViolation = recentViolations.get(violationKey);
      const now = Date.now();
      
      if (!lastViolation || (now - lastViolation) > VIOLATION_CONFIG.violationCooldownMs) {
        violations.push(violation);
        recentViolations.set(violationKey, now);
        
        // Collect all missing prereqs for path recommendation
        violation.missingPrerequisites.forEach(p => allMissingPrereqs.add(p));
        violation.indirectMissing.forEach(p => allMissingPrereqs.add(p));
      }
      
      // Generate warning for UI
      if (violation.severity === 'high' || violation.severity === 'blocking') {
        warnings.push(`Missing prerequisites for ${conceptId}: ${violation.missingPrerequisites.slice(0, 2).join(', ')}`);
      }
    }
  }
  
  // Calculate recommended learning path
  const recommendedPath = calculateRemediationPath(
    Array.from(allMissingPrereqs),
    graph,
    profile
  );
  
  return {
    ready: violations.every(v => !v.blockRecommended),
    violations,
    warnings,
    recommendedPath
  };
}

/**
 * Check a single concept for violations
 */
function checkConceptViolation(
  conceptId: string,
  profile: LearnerProfile,
  graph: ConceptGraph
): PrerequisiteViolation | null {
  const node = graph.get(conceptId);
  if (!node) return null;
  
  const coveredConcepts = profile.conceptsCovered;
  
  // Check direct prerequisites
  const missingPrereqs = node.prerequisites.filter(p => !coveredConcepts.has(p));
  
  if (missingPrereqs.length === 0) return null;
  
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
  
  const violationDepth = calculateViolationDepth(missingPrereqs, graph, coveredConcepts);
  const blockRecommended = shouldBlock(severity, violationDepth);
  
  return {
    type: 'prerequisite_violation_detected',
    learnerId: profile.id,
    timestamp: Date.now(),
    problemId: 'unknown', // Will be set by caller
    conceptAttempted: conceptId,
    missingPrerequisites: missingPrereqs,
    indirectMissing,
    severity,
    suggestedRemediation,
    violationDepth,
    blockRecommended
  };
}

/**
 * Monitor an interaction event for prerequisite violations
 * @param event - The interaction event to analyze
 * @param profile - Learner profile with coverage data
 * @returns Violation object if detected, null otherwise
 */
export function monitorForViolation(
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
      
      const violationDepth = calculateViolationDepth(missingPrereqs, graph, coveredConcepts);
      const blockRecommended = shouldBlock(severity, violationDepth);
      
      const violation: PrerequisiteViolation = {
        type: 'prerequisite_violation_detected',
        learnerId: event.learnerId,
        timestamp: event.timestamp,
        problemId: event.problemId,
        conceptAttempted: conceptId,
        missingPrerequisites: missingPrereqs,
        indirectMissing,
        severity,
        suggestedRemediation,
        violationDepth,
        blockRecommended
      };
      
      // Log the violation
      logViolationEvent(violation);
      
      return violation;
    }
  }
  
  return null;
}

/**
 * Log a prerequisite violation event to storage
 */
export function logViolationEvent(violation: PrerequisiteViolation): InteractionEvent {
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
      violationDepth: violation.violationDepth,
      blockRecommended: violation.blockRecommended
    }
  };
  
  storage.saveInteraction(event);
  return event;
}

/**
 * Get violation summary for analytics
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
    conceptAttempted: (i.metadata?.conceptAttempted as string) || i.conceptIds?.[0] || 'unknown',
    missingPrerequisites: (i.metadata?.missingPrerequisites as string[]) || [],
    indirectMissing: (i.metadata?.indirectMissing as string[]) || [],
    severity: (i.metadata?.severity as 'low' | 'medium' | 'high' | 'blocking') || 'low',
    suggestedRemediation: (i.metadata?.suggestedRemediation as string[]) || [],
    violationDepth: (i.metadata?.violationDepth as number) || 1,
    blockRecommended: (i.metadata?.blockRecommended as boolean) || false
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
  const bySeverity: Record<'low' | 'medium' | 'high' | 'blocking', number> = { 
    low: 0, medium: 0, high: 0, blocking: 0 
  };
  violations.forEach(v => {
    bySeverity[v.severity]++;
  });
  
  // Get most problematic concepts
  const mostProblematicConcepts = Object.entries(byConcept)
    .map(([conceptId, count]) => ({ conceptId, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);
  
  // Calculate trend
  const violationTrend = calculateViolationTrend(violations);
  
  return {
    totalViolations: violations.length,
    byConcept,
    byMissingPrerequisite,
    bySeverity,
    recentViolations: violations.slice(-10).reverse(),
    mostProblematicConcepts,
    violationTrend
  };
}

/**
 * Calculate remediation path through missing prerequisites
 */
function calculateRemediationPath(
  missingPrereqs: string[],
  graph: ConceptGraph,
  profile: LearnerProfile
): string[] {
  const path: string[] = [];
  const visited = new Set<string>();
  const coveredConcepts = profile.conceptsCovered;
  
  // Sort by difficulty (easier first) and prerequisites
  const sorted = missingPrereqs.sort((a, b) => {
    const nodeA = graph.get(a);
    const nodeB = graph.get(b);
    return (nodeA?.prerequisites.length || 0) - (nodeB?.prerequisites.length || 0);
  });
  
  function addToPath(conceptId: string) {
    if (visited.has(conceptId) || coveredConcepts.has(conceptId)) return;
    visited.add(conceptId);
    
    const node = graph.get(conceptId);
    if (!node) return;
    
    // Add prerequisites first
    for (const prereq of node.prerequisites) {
      if (!coveredConcepts.has(prereq)) {
        addToPath(prereq);
      }
    }
    
    path.push(conceptId);
  }
  
  for (const conceptId of sorted) {
    addToPath(conceptId);
  }
  
  return path;
}

/**
 * Find indirect missing prerequisites (prerequisites of prerequisites)
 */
function findIndirectMissingPrerequisites(
  directMissing: string[],
  graph: ConceptGraph,
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
function calculateSeverity(totalMissing: number): 'low' | 'medium' | 'high' | 'blocking' {
  if (totalMissing >= VIOLATION_CONFIG.severityThresholds.blocking) return 'blocking';
  if (totalMissing >= VIOLATION_CONFIG.severityThresholds.high) return 'high';
  if (totalMissing >= VIOLATION_CONFIG.severityThresholds.medium) return 'medium';
  return 'low';
}

/**
 * Determine if learner should be blocked based on severity
 */
function shouldBlock(
  severity: 'low' | 'medium' | 'high' | 'blocking',
  violationDepth: number
): boolean {
  return severity === 'blocking' || 
         (severity === 'high' && violationDepth >= 3);
}

/**
 * Generate remediation suggestions based on missing prerequisites
 */
function generateRemediation(
  directMissing: string[],
  indirectMissing: string[],
  graph: ConceptGraph
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
  graph: ConceptGraph,
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
 * Calculate violation trend over time
 */
function calculateViolationTrend(
  violations: PrerequisiteViolation[]
): 'increasing' | 'stable' | 'decreasing' {
  if (violations.length < 5) return 'stable';
  
  // Split into two halves
  const mid = Math.floor(violations.length / 2);
  const firstHalf = violations.slice(0, mid);
  const secondHalf = violations.slice(mid);
  
  const firstRate = firstHalf.length / (firstHalf[firstHalf.length - 1]?.timestamp - firstHalf[0]?.timestamp || 1);
  const secondRate = secondHalf.length / (secondHalf[secondHalf.length - 1]?.timestamp - secondHalf[0]?.timestamp || 1);
  
  if (secondRate > firstRate * 1.5) return 'increasing';
  if (secondRate < firstRate * 0.5) return 'decreasing';
  return 'stable';
}

/**
 * Clear violation cache (for testing)
 */
export function clearViolationCache(): void {
  recentViolations.clear();
}
