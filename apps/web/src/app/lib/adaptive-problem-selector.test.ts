import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getCompositeDifficulty,
  getNextProblem,
  getFirstProblem,
  getProblemsByDifficultyRank,
  getDifficultyLabel,
} from './adaptive-problem-selector';
import { sqlProblems } from '../data/problems';
import { storage } from './storage/storage';

vi.mock('./storage/storage', () => ({
  storage: {
    getProfile: vi.fn(),
  },
}));

describe('adaptive-problem-selector', () => {
  const mockLearnerId = 'learner-123';

  beforeEach(() => {
    vi.clearAllMocks();
  });

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

      // Both intermediate but multi-concept should score higher
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

  describe('getNextProblem', () => {
    it('should return the easiest unsolved problem', () => {
      vi.mocked(storage.getProfile).mockReturnValue({
        id: mockLearnerId,
        name: 'Test',
        conceptsCovered: new Set(),
        conceptCoverageEvidence: new Map(),
        errorHistory: new Map(),
        solvedProblemIds: new Set(),
        interactionCount: 0,
        currentStrategy: 'adaptive-medium',
        preferences: { escalationThreshold: 2, aggregationDelay: 300000 },
      });

      const next = getNextProblem(mockLearnerId, 'problem-1');
      expect(next).toBeDefined();
      expect(next?.difficulty).toBe('beginner');
      expect(next?.topicDifficultyLevel).toBe(1);
    });

    it('should skip solved problems', () => {
      // Mark the two easiest problems as solved
      const ranked = getProblemsByDifficultyRank();
      const solvedIds = new Set([ranked[0].id, ranked[1].id]);

      vi.mocked(storage.getProfile).mockReturnValue({
        id: mockLearnerId,
        name: 'Test',
        conceptsCovered: new Set(),
        conceptCoverageEvidence: new Map(),
        errorHistory: new Map(),
        solvedProblemIds: solvedIds,
        interactionCount: 2,
        currentStrategy: 'adaptive-medium',
        preferences: { escalationThreshold: 2, aggregationDelay: 300000 },
      });

      const next = getNextProblem(mockLearnerId, ranked[0].id);
      expect(next).toBeDefined();
      expect(next?.id).not.toBe(ranked[0].id);
      expect(next?.id).not.toBe(ranked[1].id);
    });

    it('should return null when all problems are solved', () => {
      const allSolved = new Set(sqlProblems.map(p => p.id));

      vi.mocked(storage.getProfile).mockReturnValue({
        id: mockLearnerId,
        name: 'Test',
        conceptsCovered: new Set(),
        conceptCoverageEvidence: new Map(),
        errorHistory: new Map(),
        solvedProblemIds: allSolved,
        interactionCount: sqlProblems.length,
        currentStrategy: 'adaptive-medium',
        preferences: { escalationThreshold: 2, aggregationDelay: 300000 },
      });

      const next = getNextProblem(mockLearnerId, 'problem-1');
      expect(next).toBeNull();
    });

    it('should prefer staying in the same topic when difficulty is similar', () => {
      // Solve all but two problems in the same topic
      const basicsProblems = sqlProblems.filter(p => p.topic === 'basics');
      const unsolvedBasics = basicsProblems.slice(0, 2);
      const allOtherSolved = sqlProblems
        .filter(p => !unsolvedBasics.includes(p))
        .map(p => p.id);

      vi.mocked(storage.getProfile).mockReturnValue({
        id: mockLearnerId,
        name: 'Test',
        conceptsCovered: new Set(),
        conceptCoverageEvidence: new Map(),
        errorHistory: new Map(),
        solvedProblemIds: new Set(allOtherSolved),
        interactionCount: allOtherSolved.length,
        currentStrategy: 'adaptive-medium',
        preferences: { escalationThreshold: 2, aggregationDelay: 300000 },
      });

      const currentProblem = unsolvedBasics[0];
      const next = getNextProblem(mockLearnerId, currentProblem.id);
      // Should return the other unsolved basics problem due to topic continuity
      expect(next?.topic).toBe('basics');
    });
  });

  describe('getFirstProblem', () => {
    it('should return the globally easiest problem', () => {
      const first = getFirstProblem();
      expect(first.difficulty).toBe('beginner');
      expect(first.topicDifficultyLevel).toBe(1);
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
