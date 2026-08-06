/**
 * Adaptive Problem Selector
 *
 * Implements difficulty-based global sequencing for SQL problems.
 * Each problem receives a composite difficulty score based on:
 * - Base difficulty (beginner/intermediate/advanced)
 * - Topic-internal difficulty level
 * - Number of concepts involved
 *
 * The next problem is always the lowest-scoring unsolved problem.
 * A small topic-continuity bonus prevents jarring topic jumps when
 * multiple problems have similar difficulty.
 */

import { SQLProblem } from '../types';
import { sqlProblems } from '../data/problems';
import { storage } from './storage/storage';
import {
  getCompositeDifficulty,
  getFirstProblem,
  getProblemsByDifficultyRank,
  getDifficultyLabel,
} from './problem-ranking';

// Re-export pure ranking utilities so consumers don't need a second import.
export { getCompositeDifficulty, getFirstProblem, getProblemsByDifficultyRank, getDifficultyLabel };

/** Topic order for fallback progression when scores are tied */
const TOPIC_ORDER = [
  'basics',
  'filtering',
  'joining',
  'aggregation',
  'functions',
  'advanced',
] as const;

/**
 * Get the next recommended problem for a learner using global
 * difficulty sequencing.
 *
 * @param learnerId - The learner's unique ID
 * @param currentProblemId - The problem the learner is currently on
 * @returns The next SQLProblem, or null if all problems are solved
 */
export function getNextProblem(
  learnerId: string,
  currentProblemId: string
): SQLProblem | null {
  const profile = storage.getProfile(learnerId);
  const solvedProblemIds = profile?.solvedProblemIds ?? new Set<string>();

  const currentProblem = sqlProblems.find(p => p.id === currentProblemId);
  const currentTopic = currentProblem?.topic;

  // Gather all unsolved problems with their scores
  // Exclude the current problem so we never recommend staying on the same problem
  const unsolved = sqlProblems
    .filter(p => !solvedProblemIds.has(p.id) && p.id !== currentProblemId)
    .map(p => {
      let score = getCompositeDifficulty(p);

      // Topic continuity: prefer staying in the same topic when
      // difficulty is similar (small bonus, not a hard gate).
      if (currentTopic && p.topic === currentTopic) {
        score -= 2;
      }

      return { problem: p, score };
    });

  if (unsolved.length === 0) {
    return null;
  }

  // Sort by score ascending, then by topic order, then by id for stability
  unsolved.sort((a, b) => {
    if (a.score !== b.score) {
      return a.score - b.score;
    }
    const topicIndexA = TOPIC_ORDER.indexOf(a.problem.topic);
    const topicIndexB = TOPIC_ORDER.indexOf(b.problem.topic);
    if (topicIndexA !== topicIndexB) {
      return topicIndexA - topicIndexB;
    }
    return a.problem.id.localeCompare(b.problem.id);
  });

  return unsolved[0].problem;
}

/**
 * Check if a problem is available (not locked) for a learner.
 * Currently all problems are available; prerequisites are enforced
 * at the concept level by the learning-path engine.
 */
export function isProblemAvailable(
  _learnerId: string,
  _problemId: string
): boolean {
  // All problems are available; the sequencing engine controls order.
  return true;
}
