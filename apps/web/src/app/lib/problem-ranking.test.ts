import { describe, it, expect } from 'vitest';
import {
  getCompositeDifficulty,
  getFirstProblem,
  getProblemsByDifficultyRank,
  getDifficultyLabel,
  getProblemRank,
} from './problem-ranking';
import { sqlProblems } from '../data/problems';

describe('problem-ranking', () => {
  describe('getCompositeDifficulty', () => {
    it('should score beginner problems lower than intermediate', () => {
      const beginner = sqlProblems.find(p => p.id === 'problem-1')!;
      const intermediate = sqlProblems.find(p => p.id === 'problem-3')!;

      expect(getCompositeDifficulty(beginner)).toBeLessThan(
        getCompositeDifficulty(intermediate)
      );
    });

    it('should score advanced problems highest', () => {
      const advanced = sqlProblems.find(p => p.id === 'problem-23')!;
      const intermediate = sqlProblems.find(p => p.id === 'problem-3')!;

      expect(getCompositeDifficulty(advanced)).toBeGreaterThan(
        getCompositeDifficulty(intermediate)
      );
    });

    it('should give higher score for more concepts', () => {
      const singleConcept = sqlProblems.find(p => p.id === 'problem-1')!;
      const multiConcept = sqlProblems.find(p => p.id === 'problem-4')!;

      expect(getCompositeDifficulty(multiConcept)).toBeGreaterThan(
        getCompositeDifficulty(singleConcept)
      );
    });
  });

  describe('getProblemsByDifficultyRank', () => {
    it('should return all problems sorted by difficulty ascending', () => {
      const ranked = getProblemsByDifficultyRank();
      expect(ranked.length).toBe(sqlProblems.length);

      for (let i = 1; i < ranked.length; i++) {
        const prev = getCompositeDifficulty(ranked[i - 1]);
        const curr = getCompositeDifficulty(ranked[i]);
        expect(prev).toBeLessThanOrEqual(curr);
      }
    });

    it('should place basics problems first', () => {
      const ranked = getProblemsByDifficultyRank();
      const first = ranked[0];
      expect(first.difficulty).toBe('beginner');
      expect(first.topicDifficultyLevel).toBe(1);
    });
  });

  describe('getFirstProblem', () => {
    it('should return the globally easiest problem', () => {
      const first = getFirstProblem();
      expect(first.difficulty).toBe('beginner');
      expect(first.topicDifficultyLevel).toBe(1);
    });

    it('should match the first item from getProblemsByDifficultyRank', () => {
      const first = getFirstProblem();
      const ranked = getProblemsByDifficultyRank();
      expect(first.id).toBe(ranked[0].id);
    });
  });

  describe('getProblemRank', () => {
    it('should return 1 for the globally easiest problem', () => {
      const first = getFirstProblem();
      expect(getProblemRank(first.id)).toBe(1);
    });

    it('should return a rank greater than 1 for harder problems', () => {
      const advanced = sqlProblems.find(p => p.id === 'problem-23')!;
      expect(getProblemRank(advanced.id)).toBeGreaterThan(1);
    });

    it('should return 0 for unknown problem ids', () => {
      expect(getProblemRank('nonexistent-problem')).toBe(0);
    });

    it('should be consistent with getProblemsByDifficultyRank ordering', () => {
      const ranked = getProblemsByDifficultyRank();
      ranked.forEach((problem, index) => {
        expect(getProblemRank(problem.id)).toBe(index + 1);
      });
    });
  });

  describe('getDifficultyLabel', () => {
    it('should return appropriate labels for score ranges', () => {
      expect(getDifficultyLabel(10)).toBe('Very Easy');
      expect(getDifficultyLabel(20)).toBe('Easy');
      expect(getDifficultyLabel(30)).toBe('Medium');
      expect(getDifficultyLabel(40)).toBe('Hard');
      expect(getDifficultyLabel(50)).toBe('Very Hard');
    });
  });
});
