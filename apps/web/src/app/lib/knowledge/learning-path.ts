/**
 * Learning Path Engine
 * 
 * Builds concept DAG from concept-registry.json, identifies blocked concepts,
 * calculates learning path recommendations, and updates after each successful submission.
 * 
 * Features:
 * - Build concept DAG from concept graph
 * - Identify blocked concepts (prerequisites not met)
 * - Calculate learning path recommendations
 * - Update after each successful submission
 * - Support multiple learning path strategies
 */

import type { LearnerProfile, ConceptNode, InteractionEvent } from '../../types';
import { buildConceptGraph, type ConceptGraph, getLearningPath } from '../../data/concept-graph';
import { storage } from '../storage/storage';
import { createEventId } from '../utils/event-id';

export interface LearningPathRecommendation {
  id: string;
  learnerId: string;
  timestamp: number;
  recommendedConcepts: Array<{
    conceptId: string;
    name: string;
    priority: 'high' | 'medium' | 'low';
    reason: string;
    estimatedDifficulty: number;
    unlocksCount: number;
  }>;
  blockedConcepts: Array<{
    conceptId: string;
    name: string;
    blockedBy: string[];
    depth: number;
  }>;
  pathStrategy: PathStrategy;
  totalConcepts: number;
  completedConcepts: number;
  progressPercentage: number;
}

export interface PathProgress {
  conceptId: string;
  status: 'locked' | 'available' | 'in_progress' | 'completed';
  progress: number; // 0-100
  lastAccessed?: number;
  attempts: number;
  successfulAttempts: number;
}

export type PathStrategy = 
  | 'prerequisite_first'  // Learn all prerequisites before advancing
  | 'breadth_first'       // Explore broadly before going deep
  | 'depth_first'         // Master each topic before moving on
  | 'difficulty_based'    // Prioritize by difficulty (easier first)
  | 'unlock_potential'    // Prioritize concepts that unlock many others
  | 'mastery_gap';        // Focus on weak areas

interface PathNode {
  conceptId: string;
  depth: number;           // Distance from root
  unlockCount: number;     // How many concepts this unlocks
  difficulty: number;      // 1-3 difficulty level
  priority: number;        // Calculated priority score
  prerequisites: string[];
  status: 'locked' | 'available' | 'completed';
}

/**
 * Build the complete learning path for a learner
 * @param learnerId - Learner identifier
 * @param strategy - Path calculation strategy
 * @returns Learning path recommendation
 */
export function buildLearningPath(
  learnerId: string,
  strategy: PathStrategy = 'prerequisite_first'
): LearningPathRecommendation {
  const profile = storage.getProfile(learnerId);
  const graph = buildConceptGraph();
  
  if (!profile) {
    return createEmptyRecommendation(learnerId, strategy);
  }
  
  const coveredConcepts = profile.conceptsCovered;
  const pathNodes = buildPathNodes(graph, coveredConcepts);
  
  // Apply strategy to calculate priorities
  applyStrategy(pathNodes, coveredConcepts, strategy, profile);
  
  // Generate recommendations
  const recommendedConcepts = generateRecommendations(pathNodes, strategy);
  const blockedConcepts = identifyBlockedConcepts(pathNodes, graph);
  
  const recommendation: LearningPathRecommendation = {
    id: createEventId('path', 'recommendation'),
    learnerId,
    timestamp: Date.now(),
    recommendedConcepts,
    blockedConcepts,
    pathStrategy: strategy,
    totalConcepts: graph.size,
    completedConcepts: coveredConcepts.size,
    progressPercentage: Math.round((coveredConcepts.size / graph.size) * 100)
  };
  
  // Log the recommendation
  logLearningPathRecommendation(recommendation);
  
  return recommendation;
}

/**
 * Update learning path after successful submission
 * @param learnerId - Learner identifier
 * @param conceptId - Concept that was just completed
 * @returns Updated recommendations
 */
export function updatePathAfterSuccess(
  learnerId: string,
  conceptId: string
): LearningPathRecommendation {
  const profile = storage.getProfile(learnerId);
  const graph = buildConceptGraph();
  
  if (!profile) {
    return createEmptyRecommendation(learnerId, 'prerequisite_first');
  }
  
  // Get newly unlocked concepts
  const node = graph.get(conceptId);
  const newlyUnlocked: string[] = [];
  
  if (node) {
    for (const unlockedId of node.unlocks) {
      const unlockedNode = graph.get(unlockedId);
      if (unlockedNode) {
        const allPrereqsMet = unlockedNode.prerequisites.every(p => 
          profile.conceptsCovered.has(p) || p === conceptId
        );
        if (allPrereqsMet && !profile.conceptsCovered.has(unlockedId)) {
          newlyUnlocked.push(unlockedId);
        }
      }
    }
  }
  
  // Generate special recommendation highlighting newly unlocked
  const recommendation = buildLearningPath(learnerId, 'unlock_potential');
  
  // Boost priority of newly unlocked concepts
  for (const rec of recommendation.recommendedConcepts) {
    if (newlyUnlocked.includes(rec.conceptId)) {
      rec.priority = 'high';
      rec.reason = `Just unlocked! ${rec.reason}`;
    }
  }
  
  // Re-sort by priority
  recommendation.recommendedConcepts.sort((a, b) => {
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    return priorityOrder[a.priority] - priorityOrder[b.priority];
  });
  
  return recommendation;
}

/**
 * Get the next recommended concept to learn
 * @param learnerId - Learner identifier
 * @param strategy - Path strategy
 * @returns Recommended concept ID or null
 */
export function getNextRecommendedConcept(
  learnerId: string,
  strategy: PathStrategy = 'prerequisite_first'
): { conceptId: string; reason: string } | null {
  const recommendation = buildLearningPath(learnerId, strategy);
  
  const highPriority = recommendation.recommendedConcepts.find(r => r.priority === 'high');
  if (highPriority) {
    return { conceptId: highPriority.conceptId, reason: highPriority.reason };
  }
  
  const mediumPriority = recommendation.recommendedConcepts.find(r => r.priority === 'medium');
  if (mediumPriority) {
    return { conceptId: mediumPriority.conceptId, reason: mediumPriority.reason };
  }
  
  return null;
}

/**
 * Get progress for all concepts
 * @param learnerId - Learner identifier
 * @returns Map of concept ID to progress
 */
export function getConceptProgress(learnerId: string): Map<string, PathProgress> {
  const profile = storage.getProfile(learnerId);
  const graph = buildConceptGraph();
  const progressMap = new Map<string, PathProgress>();
  const interactions = storage.getInteractionsByLearner(learnerId);
  
  for (const [conceptId, node] of graph) {
    const isCompleted = profile?.conceptsCovered.has(conceptId) || false;
    const isAvailable = node.prerequisites.every(p => 
      profile?.conceptsCovered.has(p)
    );
    
    // Calculate attempts from interactions
    const conceptInteractions = interactions.filter(i => 
      i.conceptIds?.includes(conceptId)
    );
    const attempts = conceptInteractions.filter(i => 
      i.eventType === 'execution' || i.eventType === 'error'
    ).length;
    const successfulAttempts = conceptInteractions.filter(i => 
      i.eventType === 'execution' && i.successful
    ).length;
    
    const lastAccessed = conceptInteractions.length > 0 
      ? Math.max(...conceptInteractions.map(i => i.timestamp))
      : undefined;
    
    progressMap.set(conceptId, {
      conceptId,
      status: isCompleted ? 'completed' : isAvailable ? 'available' : 'locked',
      progress: isCompleted ? 100 : calculatePartialProgress(conceptInteractions),
      lastAccessed,
      attempts,
      successfulAttempts
    });
  }
  
  return progressMap;
}

/**
 * Check if a concept is blocked
 * @param conceptId - Concept to check
 * @param learnerId - Learner identifier
 * @returns Blocked status with details
 */
export function isConceptBlocked(
  conceptId: string,
  learnerId: string
): { blocked: boolean; missingPrerequisites: string[] } {
  const profile = storage.getProfile(learnerId);
  const graph = buildConceptGraph();
  const node = graph.get(conceptId);
  
  if (!node) {
    return { blocked: false, missingPrerequisites: [] };
  }
  
  const coveredConcepts = profile?.conceptsCovered || new Set();
  const missingPrerequisites = node.prerequisites.filter(p => !coveredConcepts.has(p));
  
  return {
    blocked: missingPrerequisites.length > 0,
    missingPrerequisites
  };
}

/**
 * Get the shortest path to a target concept
 * @param targetConceptId - Target concept
 * @param learnerId - Learner identifier
 * @returns Array of concept IDs in learning order
 */
export function getShortestPath(
  targetConceptId: string,
  learnerId: string
): string[] {
  const profile = storage.getProfile(learnerId);
  const coveredConcepts = profile?.conceptsCovered || new Set();
  
  // Get full learning path to target
  const fullPath = getLearningPath(targetConceptId);
  
  // Filter out already completed concepts
  return fullPath.filter(id => !coveredConcepts.has(id));
}

/**
 * Build path nodes from concept graph
 */
function buildPathNodes(
  graph: ConceptGraph,
  coveredConcepts: Set<string>
): Map<string, PathNode> {
  const nodes = new Map<string, PathNode>();
  
  for (const [conceptId, node] of graph) {
    nodes.set(conceptId, {
      conceptId,
      depth: calculateNodeDepth(conceptId, graph),
      unlockCount: node.unlocks.length,
      difficulty: node.difficulty,
      priority: 0,
      prerequisites: node.prerequisites,
      status: coveredConcepts.has(conceptId) 
        ? 'completed' 
        : node.prerequisites.every((p: string) => coveredConcepts.has(p))
          ? 'available'
          : 'locked'
    });
  }
  
  return nodes;
}

/**
 * Calculate depth of a node in the graph
 */
function calculateNodeDepth(conceptId: string, graph: ConceptGraph): number {
  const node = graph.get(conceptId);
  if (!node || node.prerequisites.length === 0) return 0;
  
  const prereqDepths = node.prerequisites.map((p: string) => calculateNodeDepth(p, graph));
  return Math.max(...prereqDepths) + 1;
}

/**
 * Apply strategy to calculate node priorities
 */
function applyStrategy(
  nodes: Map<string, PathNode>,
  coveredConcepts: Set<string>,
  strategy: PathStrategy,
  profile: LearnerProfile
): void {
  for (const node of nodes.values()) {
    if (node.status !== 'available') {
      node.priority = -1;
      continue;
    }
    
    switch (strategy) {
      case 'prerequisite_first':
        node.priority = 100 - node.depth * 10;
        break;
        
      case 'breadth_first':
        node.priority = 100 - node.depth * 5 + node.unlockCount;
        break;
        
      case 'depth_first':
        node.priority = node.depth * 10;
        break;
        
      case 'difficulty_based':
        node.priority = 100 - node.difficulty * 30;
        break;
        
      case 'unlock_potential':
        node.priority = node.unlockCount * 20;
        break;
        
      case 'mastery_gap':
        const evidence = profile.conceptCoverageEvidence.get(node.conceptId);
        node.priority = evidence ? 100 - evidence.score : 50;
        break;
    }
  }
}

/**
 * Generate recommendations from path nodes
 */
function generateRecommendations(
  nodes: Map<string, PathNode>,
  strategy: PathStrategy
): LearningPathRecommendation['recommendedConcepts'] {
  const available = Array.from(nodes.values())
    .filter(n => n.status === 'available')
    .sort((a, b) => b.priority - a.priority);
  
  const graph = buildConceptGraph();
  
  return available.slice(0, 10).map(node => {
    const conceptNode = graph.get(node.conceptId);
    const priority = node.priority > 70 ? 'high' : node.priority > 40 ? 'medium' : 'low';
    
    return {
      conceptId: node.conceptId,
      name: conceptNode?.name || node.conceptId,
      priority,
      reason: generateReason(node, strategy),
      estimatedDifficulty: node.difficulty,
      unlocksCount: node.unlockCount
    };
  });
}

/**
 * Identify blocked concepts
 */
function identifyBlockedConcepts(
  nodes: Map<string, PathNode>,
  graph: ConceptGraph
): LearningPathRecommendation['blockedConcepts'] {
  const blocked = Array.from(nodes.values())
    .filter(n => n.status === 'locked');
  
  // Sort by number of missing prerequisites (fewer = closer to unlocking)
  blocked.sort((a, b) => a.prerequisites.length - b.prerequisites.length);
  
  return blocked.slice(0, 10).map(node => {
    const conceptNode = graph.get(node.conceptId);
    const coveredConcepts = new Set<string>(); // Simplified - would get from profile
    
    return {
      conceptId: node.conceptId,
      name: conceptNode?.name || node.conceptId,
      blockedBy: node.prerequisites.filter(p => !coveredConcepts.has(p)),
      depth: node.depth
    };
  });
}

/**
 * Generate reason text for recommendation
 */
function generateReason(node: PathNode, strategy: PathStrategy): string {
  switch (strategy) {
    case 'prerequisite_first':
      return `Foundation concept - ${node.prerequisites.length} prerequisite${node.prerequisites.length !== 1 ? 's' : ''} covered`;
    case 'breadth_first':
      return `Exploratory - unlocks ${node.unlockCount} concept${node.unlockCount !== 1 ? 's' : ''}`;
    case 'depth_first':
      return `Deep dive - advanced concept at depth ${node.depth}`;
    case 'difficulty_based':
      return node.difficulty === 1 ? 'Beginner-friendly' : 
             node.difficulty === 2 ? 'Intermediate level' : 'Advanced concept';
    case 'unlock_potential':
      return `Key concept - unlocks ${node.unlockCount} advanced topic${node.unlockCount !== 1 ? 's' : ''}`;
    case 'mastery_gap':
      return 'Focus area - needs reinforcement';
    default:
      return 'Recommended for your learning path';
  }
}

/**
 * Calculate partial progress for in-progress concepts
 */
function calculatePartialProgress(interactions: InteractionEvent[]): number {
  if (interactions.length === 0) return 0;
  
  const successful = interactions.filter(i => i.successful).length;
  const total = interactions.filter(i => i.eventType === 'execution' || i.eventType === 'error').length;
  
  if (total === 0) return 0;
  
  // Base progress on success rate, capped at 75% until fully mastered
  const successRate = successful / total;
  return Math.min(75, Math.round(successRate * 75));
}

/**
 * Create empty recommendation for missing profile
 */
function createEmptyRecommendation(
  learnerId: string,
  strategy: PathStrategy
): LearningPathRecommendation {
  return {
    id: createEventId('path', 'empty'),
    learnerId,
    timestamp: Date.now(),
    recommendedConcepts: [],
    blockedConcepts: [],
    pathStrategy: strategy,
    totalConcepts: 0,
    completedConcepts: 0,
    progressPercentage: 0
  };
}

/**
 * Log learning path recommendation event
 */
function logLearningPathRecommendation(
  recommendation: LearningPathRecommendation
): void {
  const event = {
    id: recommendation.id,
    sessionId: storage.getActiveSessionId(),
    learnerId: recommendation.learnerId,
    timestamp: recommendation.timestamp,
    eventType: 'learning_path_recommended' as const,
    problemId: 'learning-path',
    conceptIds: recommendation.recommendedConcepts.map(r => r.conceptId),
    metadata: {
      strategy: recommendation.pathStrategy,
      recommendedCount: recommendation.recommendedConcepts.length,
      blockedCount: recommendation.blockedConcepts.length,
      progressPercentage: recommendation.progressPercentage
    }
  };
  
  storage.saveInteraction(event);
}

/**
 * Get available path strategies with descriptions
 */
export function getPathStrategies(): Array<{ 
  id: PathStrategy; 
  name: string; 
  description: string;
}> {
  return [
    {
      id: 'prerequisite_first',
      name: 'Prerequisites First',
      description: 'Build strong foundations by completing all prerequisites before advancing'
    },
    {
      id: 'breadth_first',
      name: 'Breadth First',
      description: 'Explore broadly across topics before diving deep into any one area'
    },
    {
      id: 'depth_first',
      name: 'Depth First',
      description: 'Master each topic completely before moving to related concepts'
    },
    {
      id: 'difficulty_based',
      name: 'Easiest First',
      description: 'Start with easier concepts to build confidence'
    },
    {
      id: 'unlock_potential',
      name: 'Unlock Potential',
      description: 'Prioritize concepts that unlock the most new learning paths'
    },
    {
      id: 'mastery_gap',
      name: 'Fill Gaps',
      description: 'Focus on concepts where you need the most improvement'
    }
  ];
}
