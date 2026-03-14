/**
 * Mastery Propagation
 * 
 * Propagates mastery scores up the prerequisite chain.
 * When a learner masters a concept, they partially master concepts that require it.
 */

import { buildConceptGraph, type ConceptNode, CONCEPT_GRAPH } from '../../data/concept-graph';
import type { LearnerProfile } from '../../types';

export interface MasteryPropagation {
  conceptId: string;
  baseScore: number;        // Direct mastery score from evidence
  propagatedScore: number;  // Score after propagation from prerequisites
  contributionFrom: Array<{ 
    conceptId: string; 
    contribution: number;
    pathLength: number;     // Distance from prerequisite to this concept
  }>;
}

export interface MasteryPropagationResult {
  propagations: Map<string, MasteryPropagation>;
  newlyUnlocked: string[];  // Concepts that crossed the mastery threshold
  weakAreas: string[];      // Concepts with low propagated scores
  strongAreas: string[];    // Concepts with high propagated scores
}

// Configuration for propagation weights
const PROPAGATION_CONFIG = {
  // Weight decreases with distance (prereq -> unlocked concept)
  baseWeight: 0.25,         // 25% contribution from direct prerequisite
  weightDecay: 0.5,         // Halve weight for each level of indirection
  masteryThreshold: 60,     // Score needed to consider concept "mastered"
  highMasteryThreshold: 80, // Score for "strong" mastery
  lowMasteryThreshold: 30,  // Score below which is considered "weak"
  maxPropagationDepth: 3    // Maximum depth for propagation
};

/**
 * Propagate mastery scores up the prerequisite chain
 * @param profile - Learner profile with concept coverage evidence
 * @returns Map of concept ID to mastery propagation data
 */
export function propagateMastery(
  profile: LearnerProfile
): MasteryPropagationResult {
  const graph = buildConceptGraph();
  const propagations = new Map<string, MasteryPropagation>();
  
  // Initialize with base scores from profile
  for (const [conceptId, evidence] of profile.conceptCoverageEvidence.entries()) {
    propagations.set(conceptId, {
      conceptId,
      baseScore: evidence.score,
      propagatedScore: evidence.score,
      contributionFrom: []
    });
  }
  
  // Propagate mastery from each mastered concept
  for (const [conceptId, data] of propagations) {
    if (data.baseScore < PROPAGATION_CONFIG.masteryThreshold) continue;
    
    propagateFromConcept(
      conceptId,
      data.baseScore,
      graph,
      propagations,
      0,
      new Set<string>()
    );
  }
  
  // Calculate newly unlocked concepts
  const newlyUnlocked = findNewlyUnlockedConcepts(
    profile.conceptsCovered,
    propagations,
    graph
  );
  
  // Identify weak and strong areas
  const weakAreas: string[] = [];
  const strongAreas: string[] = [];
  
  for (const [conceptId, data] of propagations) {
    if (data.propagatedScore <= PROPAGATION_CONFIG.lowMasteryThreshold) {
      weakAreas.push(conceptId);
    } else if (data.propagatedScore >= PROPAGATION_CONFIG.highMasteryThreshold) {
      strongAreas.push(conceptId);
    }
  }
  
  return {
    propagations,
    newlyUnlocked,
    weakAreas,
    strongAreas
  };
}

/**
 * Recursively propagate mastery from a concept to its unlocked concepts
 */
function propagateFromConcept(
  conceptId: string,
  masteryScore: number,
  graph: Map<string, ConceptNode>,
  propagations: Map<string, MasteryPropagation>,
  depth: number,
  visited: Set<string>
): void {
  if (depth >= PROPAGATION_CONFIG.maxPropagationDepth) return;
  if (visited.has(conceptId)) return;
  visited.add(conceptId);
  
  const node = graph.get(conceptId);
  if (!node) return;
  
  const weight = PROPAGATION_CONFIG.baseWeight * 
    Math.pow(PROPAGATION_CONFIG.weightDecay, depth);
  
  for (const unlockedId of node.unlocks) {
    const unlockedNode = graph.get(unlockedId);
    if (!unlockedNode) continue;
    
    const contribution = masteryScore * weight;
    
    // Get or create propagation data for unlocked concept
    let unlockedData = propagations.get(unlockedId);
    if (!unlockedData) {
      unlockedData = {
        conceptId: unlockedId,
        baseScore: 0,
        propagatedScore: 0,
        contributionFrom: []
      };
      propagations.set(unlockedId, unlockedData);
    }
    
    // Add contribution
    unlockedData.propagatedScore += contribution;
    unlockedData.contributionFrom.push({
      conceptId,
      contribution,
      pathLength: depth + 1
    });
    
    // Continue propagating
    propagateFromConcept(
      unlockedId,
      unlockedData.propagatedScore,
      graph,
      propagations,
      depth + 1,
      new Set(visited)
    );
  }
}

/**
 * Find concepts that crossed the mastery threshold due to propagation
 */
function findNewlyUnlockedConcepts(
  coveredConcepts: Set<string>,
  propagations: Map<string, MasteryPropagation>,
  graph: Map<string, ConceptNode>
): string[] {
  const newlyUnlocked: string[] = [];
  
  for (const [conceptId, data] of propagations) {
    // Skip already covered concepts
    if (coveredConcepts.has(conceptId)) continue;
    
    // Check if propagated score crosses threshold
    if (data.propagatedScore >= PROPAGATION_CONFIG.masteryThreshold) {
      const node = graph.get(conceptId);
      if (node) {
        // Check if all prerequisites are at least partially covered
        const allPrereqsCovered = node.prerequisites.every(prereq => {
          const prereqData = propagations.get(prereq);
          return prereqData && 
            (prereqData.baseScore >= PROPAGATION_CONFIG.masteryThreshold ||
             prereqData.propagatedScore >= PROPAGATION_CONFIG.masteryThreshold);
        });
        
        if (allPrereqsCovered) {
          newlyUnlocked.push(conceptId);
        }
      }
    }
  }
  
  return newlyUnlocked;
}

/**
 * Get mastery summary for a specific concept
 * @param conceptId - Concept to check
 * @param profile - Learner profile
 * @returns Mastery summary or null if no data
 */
export function getConceptMastery(
  conceptId: string,
  profile: LearnerProfile
): MasteryPropagation | null {
  const result = propagateMastery(profile);
  return result.propagations.get(conceptId) || null;
}

/**
 * Calculate mastery depth (how many prerequisite levels are mastered)
 * @param conceptId - Starting concept
 * @param profile - Learner profile
 * @returns Depth of mastered prerequisites
 */
export function getMasteryDepth(
  conceptId: string,
  profile: LearnerProfile
): number {
  const graph = buildConceptGraph();
  const node = graph.get(conceptId);
  if (!node) return 0;
  
  function calculateDepth(id: string, visited: Set<string> = new Set()): number {
    if (visited.has(id)) return 0;
    visited.add(id);
    
    const n = graph.get(id);
    if (!n || n.prerequisites.length === 0) return 0;
    
    const evidence = profile.conceptCoverageEvidence.get(id);
    const isMastered = evidence && evidence.score >= PROPAGATION_CONFIG.masteryThreshold;
    
    if (!isMastered) return 0;
    
    const prereqDepths = n.prerequisites.map(p => calculateDepth(p, new Set(visited)));
    return 1 + Math.max(...prereqDepths);
  }
  
  return calculateDepth(conceptId);
}

/**
 * Get the "readiness score" for a concept considering propagated mastery
 * @param conceptId - Concept to check
 * @param profile - Learner profile
 * @returns Score 0-100 indicating readiness
 */
export function getReadinessScore(
  conceptId: string,
  profile: LearnerProfile
): number {
  const graph = buildConceptGraph();
  const node = graph.get(conceptId);
  if (!node) return 0;
  
  if (node.prerequisites.length === 0) return 100;
  
  const result = propagateMastery(profile);
  let totalWeight = 0;
  let weightedScore = 0;
  
  for (const prereqId of node.prerequisites) {
    const prereqData = result.propagations.get(prereqId);
    const score = prereqData?.propagatedScore || 
                  prereqData?.baseScore || 0;
    
    // Direct prerequisites have full weight
    weightedScore += score;
    totalWeight += 1;
  }
  
  return totalWeight > 0 ? Math.round(weightedScore / totalWeight) : 0;
}

/**
 * Get learning recommendations based on mastery gaps
 * @param profile - Learner profile
 * @returns Recommended concepts to strengthen
 */
export function getMasteryRecommendations(
  profile: LearnerProfile
): Array<{
  conceptId: string;
  priority: 'high' | 'medium' | 'low';
  reason: string;
  gapType: 'missing_prerequisite' | 'weak_mastery' | 'propagation_needed';
}> {
  const result = propagateMastery(profile);
  const graph = buildConceptGraph();
  const recommendations: Array<{
    conceptId: string;
    priority: 'high' | 'medium' | 'low';
    reason: string;
    gapType: 'missing_prerequisite' | 'weak_mastery' | 'propagation_needed';
  }> = [];
  
  for (const [conceptId, node] of graph) {
    // Skip if already well-mastered
    const data = result.propagations.get(conceptId);
    if (data && data.propagatedScore >= PROPAGATION_CONFIG.highMasteryThreshold) {
      continue;
    }
    
    // Check for missing prerequisites blocking advanced concepts
    const missingPrereqs = node.prerequisites.filter(p => {
      const prereqData = result.propagations.get(p);
      return !prereqData || prereqData.propagatedScore < PROPAGATION_CONFIG.masteryThreshold;
    });
    
    if (missingPrereqs.length > 0 && node.difficulty >= 2) {
      recommendations.push({
        conceptId,
        priority: 'high',
        reason: `Missing ${missingPrereqs.length} prerequisite${missingPrereqs.length > 1 ? 's' : ''}: ${missingPrereqs.join(', ')}`,
        gapType: 'missing_prerequisite'
      });
      continue;
    }
    
    // Check for weak mastery
    if (data && data.baseScore > 0 && data.baseScore < PROPAGATION_CONFIG.lowMasteryThreshold) {
      recommendations.push({
        conceptId,
        priority: 'medium',
        reason: `Weak mastery (score: ${Math.round(data.baseScore)}) - needs reinforcement`,
        gapType: 'weak_mastery'
      });
      continue;
    }
    
    // Check for concepts that could benefit from propagation
    if (!data && node.prerequisites.some(p => profile.conceptsCovered.has(p))) {
      const prereqCoverage = node.prerequisites.filter(p => profile.conceptsCovered.has(p)).length;
      recommendations.push({
        conceptId,
        priority: 'low',
        reason: `Ready to learn - ${prereqCoverage}/${node.prerequisites.length} prerequisites covered`,
        gapType: 'propagation_needed'
      });
    }
  }
  
  return recommendations.sort((a, b) => {
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    return priorityOrder[a.priority] - priorityOrder[b.priority];
  });
}

/**
 * Export mastery statistics for analytics
 * @param profile - Learner profile
 * @returns Statistics object
 */
export function getMasteryStats(profile: LearnerProfile): {
  totalConcepts: number;
  directlyMastered: number;
  propagatedMastered: number;
  weakAreas: number;
  averageScore: number;
  propagationEffectiveness: number;
} {
  const result = propagateMastery(profile);
  const propagations = Array.from(result.propagations.values());
  
  const directlyMastered = propagations.filter(
    p => p.baseScore >= PROPAGATION_CONFIG.masteryThreshold
  ).length;
  
  const propagatedMastered = propagations.filter(
    p => p.propagatedScore >= PROPAGATION_CONFIG.masteryThreshold && 
         p.baseScore < PROPAGATION_CONFIG.masteryThreshold
  ).length;
  
  const averageScore = propagations.length > 0
    ? propagations.reduce((sum, p) => sum + p.propagatedScore, 0) / propagations.length
    : 0;
  
  return {
    totalConcepts: propagations.length,
    directlyMastered,
    propagatedMastered,
    weakAreas: result.weakAreas.length,
    averageScore: Math.round(averageScore * 10) / 10,
    propagationEffectiveness: directlyMastered > 0 
      ? Math.round((propagatedMastered / directlyMastered) * 100)
      : 0
  };
}
