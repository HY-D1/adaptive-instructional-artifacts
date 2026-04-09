import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useLearnerProgress } from './useLearnerProgress';
import { storage } from '../lib/storage';
import { sqlProblems } from '../data/problems';

// Mock the storage module
vi.mock('../lib/storage', () => ({
  storage: {
    getProfile: vi.fn(),
  },
}));

describe('useLearnerProgress', () => {
  const mockLearnerId = 'learner-123';
  const firstProblemId = sqlProblems[0]?.id || 'problem-1';
  const ninthProblemId = sqlProblems[8]?.id || 'problem-9';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return correct total problems count', () => {
    vi.mocked(storage.getProfile).mockReturnValue(null);
    
    const { result } = renderHook(() => 
      useLearnerProgress({ learnerId: mockLearnerId, currentProblemId: firstProblemId })
    );

    expect(result.current.totalProblems).toBe(sqlProblems.length);
  });

  it('should return correct current problem number (1-based)', () => {
    vi.mocked(storage.getProfile).mockReturnValue(null);
    
    const { result: firstResult } = renderHook(() => 
      useLearnerProgress({ learnerId: mockLearnerId, currentProblemId: firstProblemId })
    );
    expect(firstResult.current.currentProblemNumber).toBe(1);

    const { result: ninthResult } = renderHook(() => 
      useLearnerProgress({ learnerId: mockLearnerId, currentProblemId: ninthProblemId })
    );
    expect(ninthResult.current.currentProblemNumber).toBe(9);
  });

  it('should return solved count of 0 when no problems solved', () => {
    vi.mocked(storage.getProfile).mockReturnValue({
      id: mockLearnerId,
      name: 'Test Learner',
      conceptsCovered: new Set(),
      conceptCoverageEvidence: new Map(),
      errorHistory: new Map(),
      solvedProblemIds: new Set(),
      interactionCount: 0,
      currentStrategy: 'adaptive-medium',
      preferences: { escalationThreshold: 2, aggregationDelay: 300000 },
      createdAt: Date.now(),
      lastActive: Date.now(),
    });

    const { result } = renderHook(() => 
      useLearnerProgress({ learnerId: mockLearnerId, currentProblemId: ninthProblemId })
    );

    expect(result.current.solvedCount).toBe(0);
    expect(result.current.solvedPercent).toBe(0);
    expect(result.current.isCurrentProblemSolved).toBe(false);
  });

  it('should return correct solved count when problems are solved', () => {
    vi.mocked(storage.getProfile).mockReturnValue({
      id: mockLearnerId,
      name: 'Test Learner',
      conceptsCovered: new Set(),
      conceptCoverageEvidence: new Map(),
      errorHistory: new Map(),
      solvedProblemIds: new Set([firstProblemId, ninthProblemId]),
      interactionCount: 2,
      currentStrategy: 'adaptive-medium',
      preferences: { escalationThreshold: 2, aggregationDelay: 300000 },
      createdAt: Date.now(),
      lastActive: Date.now(),
    });

    const { result } = renderHook(() => 
      useLearnerProgress({ learnerId: mockLearnerId, currentProblemId: ninthProblemId })
    );

    expect(result.current.solvedCount).toBe(2);
    expect(result.current.solvedPercent).toBe(Math.round((2 / sqlProblems.length) * 100));
    expect(result.current.isCurrentProblemSolved).toBe(true);
  });

  it('should correctly identify unsolved current problem', () => {
    vi.mocked(storage.getProfile).mockReturnValue({
      id: mockLearnerId,
      name: 'Test Learner',
      conceptsCovered: new Set(),
      conceptCoverageEvidence: new Map(),
      errorHistory: new Map(),
      solvedProblemIds: new Set([firstProblemId]), // Only first problem solved
      interactionCount: 1,
      currentStrategy: 'adaptive-medium',
      preferences: { escalationThreshold: 2, aggregationDelay: 300000 },
      createdAt: Date.now(),
      lastActive: Date.now(),
    });

    const { result } = renderHook(() => 
      useLearnerProgress({ learnerId: mockLearnerId, currentProblemId: ninthProblemId })
    );

    expect(result.current.isCurrentProblemSolved).toBe(false);
    expect(result.current.isProblemSolved(firstProblemId)).toBe(true);
    expect(result.current.isProblemSolved(ninthProblemId)).toBe(false);
  });

  it('should return correct solved count for difficulty level', () => {
    const beginnerProblems = sqlProblems.filter(p => p.difficulty === 'beginner');
    const solvedBeginnerIds = beginnerProblems.slice(0, 2).map(p => p.id);

    vi.mocked(storage.getProfile).mockReturnValue({
      id: mockLearnerId,
      name: 'Test Learner',
      conceptsCovered: new Set(),
      conceptCoverageEvidence: new Map(),
      errorHistory: new Map(),
      solvedProblemIds: new Set(solvedBeginnerIds),
      interactionCount: 2,
      currentStrategy: 'adaptive-medium',
      preferences: { escalationThreshold: 2, aggregationDelay: 300000 },
      createdAt: Date.now(),
      lastActive: Date.now(),
    });

    const { result } = renderHook(() => 
      useLearnerProgress({ learnerId: mockLearnerId, currentProblemId: firstProblemId })
    );

    expect(result.current.getSolvedCountForDifficulty('beginner')).toBe(2);
    expect(result.current.getSolvedCountForDifficulty('intermediate')).toBe(0);
    expect(result.current.getSolvedCountForDifficulty('advanced')).toBe(0);
  });

  it('should handle empty learnerId gracefully', () => {
    vi.mocked(storage.getProfile).mockReturnValue(null);

    const { result } = renderHook(() => 
      useLearnerProgress({ learnerId: '', currentProblemId: firstProblemId })
    );

    expect(result.current.solvedCount).toBe(0);
    expect(result.current.solvedProblemIds.size).toBe(0);
    expect(result.current.isCurrentProblemSolved).toBe(false);
  });

  it('should handle null profile gracefully', () => {
    vi.mocked(storage.getProfile).mockReturnValue(null);

    const { result } = renderHook(() => 
      useLearnerProgress({ learnerId: mockLearnerId, currentProblemId: firstProblemId })
    );

    expect(result.current.solvedCount).toBe(0);
    expect(result.current.solvedProblemIds.size).toBe(0);
    expect(result.current.isCurrentProblemSolved).toBe(false);
  });
});
