import { describe, expect, it } from 'vitest';

import {
  resolvePracticeDraftState,
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
