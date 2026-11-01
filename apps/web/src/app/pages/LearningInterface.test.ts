import { describe, expect, it, vi } from 'vitest';

import {
  resolvePracticeDraftState,
  restoreDraftFromProgress,
  resolvePracticeProblemFromSources,
} from './LearningInterface';
import type { SQLProblem } from '../types';

const problems: SQLProblem[] = [
  {
    id: 'problem-1',
    title: 'Problem One',
    description: 'First problem',
    difficulty: 'beginner',
    concepts: ['select-basics'],
    schema: 'CREATE TABLE users (id INT, name TEXT);',
    expectedQuery: 'SELECT 1',
    expectedResult: [],
    topic: 'basics',
    topicDifficultyLevel: 1,
  },
  {
    id: 'problem-2',
    title: 'Problem Two',
    description: 'Second problem',
    difficulty: 'beginner',
    concepts: ['where-filtering'],
    schema: 'CREATE TABLE users (id INT, name TEXT);',
    expectedQuery: 'SELECT 2',
    expectedResult: [],
    topic: 'basics',
    topicDifficultyLevel: 1,
  },
];

const fallbackProblem = problems[0];

describe('LearningInterface restore precedence', () => {
  it('restores the selected problem lastCode when no meaningful draft exists', async () => {
    const fetchProgress = vi.fn().mockResolvedValue({ lastCode: 'SELECT * FROM users;' });
    expect(await restoreDraftFromProgress({
      learnerId: 'learner-1', problemId: 'problem-1', draft: null, fetchProgress,
    })).toBe('SELECT * FROM users;');
    expect(fetchProgress).toHaveBeenCalledWith('learner-1', 'problem-1');
  });

  it('keeps a local draft and skips progress lookup, while ignoring empty saved code', async () => {
    const fetchProgress = vi.fn().mockResolvedValue({ lastCode: '' });
    expect(await restoreDraftFromProgress({
      learnerId: 'learner-1', problemId: 'problem-1', draft: 'SELECT unsent;', fetchProgress,
    })).toBe('SELECT unsent;');
    expect(fetchProgress).not.toHaveBeenCalled();
    expect(await restoreDraftFromProgress({
      learnerId: 'learner-1', problemId: 'problem-1', draft: null, fetchProgress,
    })).toBeNull();
  });

  it('leaves the editor usable if the progress request fails', async () => {
    const fetchProgress = vi.fn().mockRejectedValue(new Error('offline'));
    expect(await restoreDraftFromProgress({
      learnerId: 'learner-1', problemId: 'problem-1', draft: null, fetchProgress,
    })).toBeNull();
  });
  it('prefers backend session problem over stale persisted UI state in account mode', () => {
    const resolved = resolvePracticeProblemFromSources({
      problems,
      fallbackProblem,
      persistedProblemId: 'problem-1',
      backendProblemId: 'problem-2',
      preferBackendProblem: true,
    });

    expect(resolved.id).toBe('problem-2');
  });

  it('keeps backend problem locked when a different local draft exists', () => {
    const drafts = new Map<string, string>([
      ['session-backend::problem-1', 'SELECT stale_problem_one'],
    ]);

    const resolved = resolvePracticeDraftState({
      sessionId: 'session-backend',
      fallbackProblem,
      problems,
      isMeaningfulDraft: (draft): draft is string =>
        typeof draft === 'string' && draft.trim().length > 0,
      lockProblemId: 'problem-2',
      lookup: {
        getPracticeDraft: (sessionId, problemId) => drafts.get(`${sessionId}::${problemId}`) ?? null,
        findAnyPracticeDraft: (problemId) => {
          for (const [key, value] of drafts.entries()) {
            if (key.endsWith(`::${problemId}`)) {
              return value;
            }
          }
          return null;
        },
      },
    });

    expect(resolved.problem.id).toBe('problem-2');
    expect(resolved.draft).toBeNull();
  });
});
