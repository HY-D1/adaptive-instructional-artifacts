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

import { SQLProblem, SQLProblemTopic } from '../types';
import { sqlProblems } from '../data/problems';
import { storage } from './storage/storage';

const DIFFICULTY_VALUES: Record<string, number> = {
  beginner: 1,
  intermediate: 2,
  advanced: 3,
};

/** Topic order for fallback progression when scores are tied */
const TOPIC_ORDER: SQLProblemTopic[] = [
  'basics',
  'filtering',
  'joining',
  'aggregation',
  'functions',
  'advanced',
];

/**
 * Calculate a composite difficulty score for a problem.
 * Lower score = easier problem.
 */
export function getCompositeDifficulty(problem: SQLProblem): number {
  const baseDifficulty = DIFFICULTY_VALUES[problem.difficulty] ?? 2;
  const topicLevel = problem.topicDifficultyLevel ?? 2;
  const conceptCount = problem.concepts?.length ?? 1;

  // Weighted formula: base difficulty is the strongest signal,
  // topic level provides intra-topic gradation,
  // concept count adds complexity penalty.
  return baseDifficulty * 10 + topicLevel * 3 + conceptCount * 2;
}

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
  const unsolved = sqlProblems
    .filter(p => !solvedProblemIds.has(p.id))
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
 * Get the first problem a new learner should see.
 * Always returns the globally easiest problem.
 */
export function getFirstProblem(): SQLProblem {
  const scored = sqlProblems.map(p => ({
    problem: p,
    score: getCompositeDifficulty(p),
  }));

  scored.sort((a, b) => {
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

  return scored[0].problem;
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

/**
 * Get a human-readable difficulty label from a composite score.
 */
export function getDifficultyLabel(score: number): string {
  if (score <= 18) return 'Very Easy';
  if (score <= 25) return 'Easy';
  if (score <= 32) return 'Medium';
  if (score <= 40) return 'Hard';
  return 'Very Hard';
}

/**
 * Get the full list of problems sorted by composite difficulty.
 * Useful for displaying a curriculum map.
 */
export function getProblemsByDifficultyRank(): SQLProblem[] {
  return [...sqlProblems].sort((a, b) => {
    const scoreA = getCompositeDifficulty(a);
    const scoreB = getCompositeDifficulty(b);
    if (scoreA !== scoreB) {
      return scoreA - scoreB;
    }
    const topicIndexA = TOPIC_ORDER.indexOf(a.topic);
    const topicIndexB = TOPIC_ORDER.indexOf(b.topic);
    if (topicIndexA !== topicIndexB) {
      return topicIndexA - topicIndexB;
    }
    return a.id.localeCompare(b.id);
  });
}
