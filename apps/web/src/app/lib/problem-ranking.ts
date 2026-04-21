/**
 * Problem Ranking — Pure difficulty-based sequencing utilities.
 *
 * Contains only stateless, storage-free functions so that both the
 * adaptive selector and the telemetry layer can import them without
 * risking circular dependencies.
 */

import { SQLProblem, SQLProblemTopic } from '../types';
import { sqlProblems } from '../data/problems';

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

/**
 * Get the first problem a new learner should see.
 * Always returns the globally easiest problem.
 */
export function getFirstProblem(): SQLProblem {
  const ranked = getProblemsByDifficultyRank();
  return ranked[0];
}

// Pre-compute rank map for O(1) lookups.
// sqlProblems is static, so this is safe to compute at module init.
const _rankedProblems = getProblemsByDifficultyRank();
const _problemRankMap = new Map(_rankedProblems.map((p, i) => [p.id, i + 1]));

/**
 * Get the 1-based difficulty rank of a problem.
 * Returns 0 if the problem ID is unknown.
 */
export function getProblemRank(problemId: string): number {
  return _problemRankMap.get(problemId) ?? 0;
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
