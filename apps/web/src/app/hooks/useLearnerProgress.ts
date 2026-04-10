/**
 * useLearnerProgress - Centralized progress derivation hook
 * 
 * Provides a single source of truth for all learner progress metrics
 * to ensure consistent labeling and display across the UI.
 * 
 * Progress Model:
 * - currentProblemNumber: 1-based position of current problem in the list
 * - totalProblems: Total number of problems available
 * - solvedCount: Number of unique problems solved (ever)
 * - solvedPercent: Percentage of problems solved (0-100)
 * - attemptedProblemIds: Set of problem IDs with at least one attempt
 * - isCurrentProblemSolved: Whether current problem is in solved set
 * 
 * Usage:
 * const progress = useLearnerProgress({ learnerId, currentProblemId });
 * 
 * Then in JSX use clear labels:
 *   Current position: progress.currentProblemNumber / progress.totalProblems
 *   Solved progress:  progress.solvedCount / progress.totalProblems
 *   Percentage:       progress.solvedPercent
 */

import { useMemo, useCallback } from 'react';
import { storage } from '../lib/storage';
import { sqlProblems } from '../data/problems';

export interface LearnerProgress {
  /** Total number of problems available */
  totalProblems: number;
  
  /** Current problem's 1-based position in the list */
  currentProblemNumber: number;
  
  /** Number of unique problems solved (across all sessions) */
  solvedCount: number;
  
  /** Percentage of problems solved (0-100) */
  solvedPercent: number;
  
  /** Set of solved problem IDs */
  solvedProblemIds: Set<string>;
  
  /** Whether the current problem has been solved */
  isCurrentProblemSolved: boolean;
  
  /** Check if a specific problem is solved */
  isProblemSolved: (problemId: string) => boolean;
  
  /** Get solved count for a specific difficulty level */
  getSolvedCountForDifficulty: (difficulty: string) => number;
}

interface UseLearnerProgressOptions {
  /** The learner's unique ID */
  learnerId: string;
  
  /** Current problem ID being viewed */
  currentProblemId: string;
  
  /** Optional refresh key to force recalculation */
  refreshKey?: number;
  
  /** Optional hydrated solved IDs from external source (e.g., post-login hydration) */
  hydratedSolvedIds?: Set<string>;
}

export function useLearnerProgress(options: UseLearnerProgressOptions): LearnerProgress {
  const { learnerId, currentProblemId, refreshKey = 0, hydratedSolvedIds } = options;

  // Get the solved problem IDs from storage (memoized for performance)
  // Prefer injected hydrated data over localStorage read to avoid race conditions
  const solvedProblemIds = useMemo(() => {
    if (hydratedSolvedIds && hydratedSolvedIds.size > 0) {
      return hydratedSolvedIds;
    }
    if (!learnerId) return new Set<string>();
    const profile = storage.getProfile(learnerId);
    return profile?.solvedProblemIds ?? new Set<string>();
  }, [learnerId, refreshKey, hydratedSolvedIds]);

  // Calculate current problem's 1-based position
  const currentProblemNumber = useMemo(() => {
    const index = sqlProblems.findIndex(p => p.id === currentProblemId);
    return index >= 0 ? index + 1 : 1;
  }, [currentProblemId]);

  // Calculate solved metrics
  const solvedCount = solvedProblemIds.size;
  const solvedPercent = useMemo(() => 
    Math.round((solvedCount / sqlProblems.length) * 100),
    [solvedCount]
  );

  // Check if current problem is solved
  const isCurrentProblemSolved = useMemo(() => 
    solvedProblemIds.has(currentProblemId),
    [solvedProblemIds, currentProblemId]
  );

  // Helper to check if any problem is solved
  const isProblemSolved = useCallback((problemId: string): boolean => {
    return solvedProblemIds.has(problemId);
  }, [solvedProblemIds]);

  // Helper to get solved count for a difficulty level
  const getSolvedCountForDifficulty = useCallback((difficulty: string): number => {
    const problemsInDifficulty = sqlProblems.filter(p => p.difficulty === difficulty);
    return problemsInDifficulty.filter(p => solvedProblemIds.has(p.id)).length;
  }, [solvedProblemIds]);

  return {
    totalProblems: sqlProblems.length,
    currentProblemNumber,
    solvedCount,
    solvedPercent,
    solvedProblemIds,
    isCurrentProblemSolved,
    isProblemSolved,
    getSolvedCountForDifficulty,
  };
}

export default useLearnerProgress;
