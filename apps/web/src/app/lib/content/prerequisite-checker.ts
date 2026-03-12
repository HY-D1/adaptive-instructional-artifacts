/**
 * Prerequisite Checker
 * 
 * Validates whether a learner is ready to attempt a concept based on
 * their covered concepts and the prerequisite dependency graph.
 */

import { buildConceptGraph, type ConceptNode, CONCEPT_GRAPH } from '../../data/concept-graph';

export interface PrerequisiteStatus {
  conceptId: string;
  ready: boolean;           // All prerequisites met
  missing: string[];        // Prerequisites not yet covered
  blockedBy: string[];      // Concepts blocking this (indirect prerequisites)
  recommendedOrder: number; // Position in learning sequence (1-based)
  readinessScore: number;   // 0-100 score based on prerequisites covered
}

/**
 * Check if prerequisites are met for a target concept
 * @param targetConceptId - The concept the learner wants to attempt
 * @param coveredConcepts - Set of concepts the learner has already covered
 * @returns Prerequisite status with missing requirements
 */
export function checkPrerequisites(
  targetConceptId: string,
  coveredConcepts: Set<string>
): PrerequisiteStatus {
  const graph = buildConceptGraph();
  const target = graph.get(targetConceptId);
  
  if (!target) {
    return { 
      conceptId: targetConceptId, 
      ready: true, 
      missing: [], 
      blockedBy: [], 
      recommendedOrder: 0,
      readinessScore: 100
    };
  }
  
  // Find missing direct prerequisites
  const missing = target.prerequisites.filter(p => !coveredConcepts.has(p));
  
  // Find all indirect prerequisites (transitive closure of missing)
  const blockedBy = findAllMissingPrerequisites(targetConceptId, graph, coveredConcepts);
  
  // Calculate recommended learning order
  const recommendedOrder = calculateLearningOrder(targetConceptId, graph);
  
  // Calculate readiness score
  const readinessScore = calculateReadinessScore(target, coveredConcepts);
  
  return {
    conceptId: targetConceptId,
    ready: missing.length === 0,
    missing,
    blockedBy,
    recommendedOrder,
    readinessScore
  };
}

/**
 * Check prerequisites for multiple concepts at once
 * @param conceptIds - Array of concept IDs to check
 * @param coveredConcepts - Set of covered concepts
 * @returns Map of concept ID to prerequisite status
 */
export function checkPrerequisitesBatch(
  conceptIds: string[],
  coveredConcepts: Set<string>
): Map<string, PrerequisiteStatus> {
  const results = new Map<string, PrerequisiteStatus>();
  
  for (const conceptId of conceptIds) {
    results.set(conceptId, checkPrerequisites(conceptId, coveredConcepts));
  }
  
  return results;
}

/**
 * Get recommended next concepts based on current coverage
 * @param coveredConcepts - Set of concepts already covered
 * @param limit - Maximum number of recommendations to return
 * @returns Array of concept IDs that are ready to learn
 */
export function getRecommendedNextConcepts(
  coveredConcepts: Set<string>,
  limit: number = 5
): Array<{ conceptId: string; priority: number; reason: string }> {
  const graph = buildConceptGraph();
  const recommendations: Array<{ conceptId: string; priority: number; reason: string }> = [];
  
  for (const [id, node] of graph) {
    // Skip already covered
    if (coveredConcepts.has(id)) continue;
    
    const status = checkPrerequisites(id, coveredConcepts);
    
    if (status.ready) {
      // Ready to learn - prioritize by difficulty and unlock potential
      const unlocksCount = node.unlocks.length;
      const priority = (4 - node.difficulty) * 10 + unlocksCount;
      recommendations.push({
        conceptId: id,
        priority,
        reason: `Ready to learn - unlocks ${unlocksCount} more concept${unlocksCount !== 1 ? 's' : ''}`
      });
    } else if (status.missing.length === 1) {
      // Almost ready - missing just one prerequisite
      recommendations.push({
        conceptId: id,
        priority: 5,
        reason: `Almost ready - learn ${status.missing[0]} first`
      });
    }
  }
  
  return recommendations
    .sort((a, b) => b.priority - a.priority)
    .slice(0, limit);
}

/**
 * Find all prerequisites that are blocking a concept (direct and indirect)
 */
function findAllMissingPrerequisites(
  conceptId: string,
  graph: Map<string, ConceptNode>,
  coveredConcepts: Set<string>
): string[] {
  const allMissing: string[] = [];
  const visited = new Set<string>();
  
  function visit(id: string) {
    if (visited.has(id)) return;
    visited.add(id);
    
    const node = graph.get(id);
    if (!node) return;
    
    for (const prereq of node.prerequisites) {
      if (!coveredConcepts.has(prereq)) {
        allMissing.push(prereq);
        visit(prereq);
      }
    }
  }
  
  visit(conceptId);
  return [...new Set(allMissing)]; // Remove duplicates
}

/**
 * Calculate learning order position using topological sort depth
 */
function calculateLearningOrder(conceptId: string, graph: Map<string, ConceptNode>): number {
  const node = graph.get(conceptId);
  if (!node) return Infinity;
  
  if (node.prerequisites.length === 0) return 1;
  
  const prereqOrders = node.prerequisites.map(p => calculateLearningOrder(p, graph));
  return Math.max(...prereqOrders) + 1;
}

/**
 * Calculate readiness score (0-100) based on prerequisites covered
 */
function calculateReadinessScore(
  node: ConceptNode,
  coveredConcepts: Set<string>
): number {
  if (node.prerequisites.length === 0) return 100;
  
  const covered = node.prerequisites.filter(p => coveredConcepts.has(p)).length;
  return Math.round((covered / node.prerequisites.length) * 100);
}

/**
 * Get the prerequisite chain/path to a concept
 * @param conceptId - Target concept
 * @returns Array of prerequisite concept IDs in learning order
 */
export function getPrerequisiteChain(conceptId: string): string[] {
  const graph = buildConceptGraph();
  const chain: string[] = [];
  const visited = new Set<string>();
  
  function visit(id: string) {
    if (visited.has(id)) return;
    visited.add(id);
    
    const node = graph.get(id);
    if (!node) return;
    
    // Visit prerequisites first (in order)
    for (const prereq of node.prerequisites) {
      visit(prereq);
    }
    
    if (id !== conceptId) {
      chain.push(id);
    }
  }
  
  visit(conceptId);
  return chain;
}

/**
 * Check if adding a concept to coverage would unlock new concepts
 * @param conceptId - Concept being added
 * @param coveredConcepts - Current covered set
 * @returns Array of concept IDs that would become ready
 */
export function getNewlyUnlockedConcepts(
  conceptId: string,
  coveredConcepts: Set<string>
): string[] {
  const graph = buildConceptGraph();
  const node = graph.get(conceptId);
  if (!node) return [];
  
  const newlyUnlocked: string[] = [];
  const newCovered = new Set(coveredConcepts);
  newCovered.add(conceptId);
  
  for (const unlockedId of node.unlocks) {
    const unlockedNode = graph.get(unlockedId);
    if (!unlockedNode) continue;
    
    // Check if this concept is now ready
    const wasReady = unlockedNode.prerequisites.every(p => coveredConcepts.has(p));
    const isReady = unlockedNode.prerequisites.every(p => newCovered.has(p));
    
    if (!wasReady && isReady) {
      newlyUnlocked.push(unlockedId);
    }
  }
  
  return newlyUnlocked;
}

/**
 * Get learning path recommendation from current state to target
 * @param coveredConcepts - Currently covered concepts
 * @param targetConceptId - Target concept to reach
 * @returns Ordered array of concept IDs to learn (including target)
 */
export function getPathToConcept(
  coveredConcepts: Set<string>,
  targetConceptId: string
): string[] {
  const chain = getPrerequisiteChain(targetConceptId);
  const path = chain.filter(id => !coveredConcepts.has(id));
  // Add target if not already covered
  if (!coveredConcepts.has(targetConceptId)) {
    path.push(targetConceptId);
  }
  return path;
}

/**
 * Validate the concept graph has no cycles
 * @returns True if the graph is a valid DAG
 */
export function validateConceptGraph(): { valid: boolean; cycles: string[][] } {
  const graph = buildConceptGraph();
  const cycles: string[][] = [];
  const visited = new Set<string>();
  const recursionStack = new Set<string>();
  
  function dfs(nodeId: string, path: string[] = []): boolean {
    if (recursionStack.has(nodeId)) {
      // Found cycle
      const cycleStart = path.indexOf(nodeId);
      cycles.push(path.slice(cycleStart).concat(nodeId));
      return false;
    }
    
    if (visited.has(nodeId)) return true;
    
    visited.add(nodeId);
    recursionStack.add(nodeId);
    path.push(nodeId);
    
    const node = graph.get(nodeId);
    if (node) {
      for (const prereq of node.prerequisites) {
        if (!dfs(prereq, [...path])) {
          // Continue to find all cycles
        }
      }
    }
    
    recursionStack.delete(nodeId);
    return true;
  }
  
  for (const id of graph.keys()) {
    if (!visited.has(id)) {
      dfs(id);
    }
  }
  
  return { valid: cycles.length === 0, cycles };
}
