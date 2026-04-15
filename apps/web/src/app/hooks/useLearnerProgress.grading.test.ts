/**
 * useLearnerProgress.grading.test.ts
 * 
 * Tests for the solved-state integrity when grading occurs.
 * Ensures that grading fixes won't break learner-facing behavior.
 * 
 * Key scenarios covered:
 * 1. Correct answer grading updates solved state
 * 2. No double-counting when solving same problem multiple times
 * 3. False positives (wrong answer marked correct) inflate solved counts
 * 4. False negatives (right answer marked wrong) block progress
 * 5. Session restore preserves solved state
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useLearnerProgress } from './useLearnerProgress';
import { storage as localStorageManager } from '../lib/storage/storage';
import { sqlProblems } from '../data/problems';

// Mock the local storage module
vi.mock('../lib/storage/storage', () => ({
  storage: {
    getProfile: vi.fn(),
    saveInteraction: vi.fn(),
    getInteractionsByLearner: vi.fn(),
  },
}));

describe('useLearnerProgress - Grading Integration', () => {
  const mockLearnerId = 'learner-123';
  const firstProblemId = sqlProblems[0]?.id || 'problem-1';
  const secondProblemId = sqlProblems[1]?.id || 'problem-2';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Solved State Update Path', () => {
    it('should reflect solved state when profile contains solvedProblemIds', () => {
      // Simulate: Event with successful=true was saved, updateProfileStatsFromEvent added problemId
      vi.mocked(localStorageManager.getProfile).mockReturnValue({
        id: mockLearnerId,
        name: 'Test Learner',
        conceptsCovered: new Set(),
        conceptCoverageEvidence: new Map(),
        errorHistory: new Map(),
        solvedProblemIds: new Set([firstProblemId]), // Set populated by updateProfileStatsFromEvent
        interactionCount: 1,
        currentStrategy: 'adaptive-medium',
        preferences: { escalationThreshold: 2, aggregationDelay: 300000 },
        createdAt: Date.now(),
        lastActive: Date.now(),
      });

      const { result } = renderHook(() =>
        useLearnerProgress({ learnerId: mockLearnerId, currentProblemId: firstProblemId })
      );

      // Learner-facing state should show problem as solved
      expect(result.current.isCurrentProblemSolved).toBe(true);
      expect(result.current.solvedCount).toBe(1);
      expect(result.current.isProblemSolved(firstProblemId)).toBe(true);
    });

    it('should correctly identify unsolved problems not in solvedProblemIds', () => {
      vi.mocked(localStorageManager.getProfile).mockReturnValue({
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
        useLearnerProgress({ learnerId: mockLearnerId, currentProblemId: secondProblemId })
      );

      // Second problem should not be marked as solved
      expect(result.current.isCurrentProblemSolved).toBe(false);
      expect(result.current.isProblemSolved(secondProblemId)).toBe(false);
    });
  });

  describe('No Double-Counting', () => {
    it('should count each problem only once regardless of multiple successful executions', () => {
      // Simulates: Learner solves problem, then solves it again (practice/verification)
      // updateProfileStatsFromEvent uses Set.add() which prevents duplicates
      const solvedSet = new Set([firstProblemId]);
      
      vi.mocked(localStorageManager.getProfile).mockReturnValue({
        id: mockLearnerId,
        name: 'Test Learner',
        conceptsCovered: new Set(),
        conceptCoverageEvidence: new Map(),
        errorHistory: new Map(),
        solvedProblemIds: solvedSet,
        interactionCount: 5, // Multiple interactions
        currentStrategy: 'adaptive-medium',
        preferences: { escalationThreshold: 2, aggregationDelay: 300000 },
        createdAt: Date.now(),
        lastActive: Date.now(),
      });

      const { result } = renderHook(() =>
        useLearnerProgress({ learnerId: mockLearnerId, currentProblemId: firstProblemId })
      );

      // Solved count should be 1, not inflated by multiple attempts
      expect(result.current.solvedCount).toBe(1);
      expect(result.current.solvedPercent).toBe(Math.round((1 / sqlProblems.length) * 100));
    });

    it('should handle Set semantics correctly for idempotent adds', () => {
      const solvedSet = new Set<string>();
      
      // Simulate multiple successful executions of same problem
      solvedSet.add(firstProblemId);
      solvedSet.add(firstProblemId);
      solvedSet.add(firstProblemId);

      vi.mocked(localStorageManager.getProfile).mockReturnValue({
        id: mockLearnerId,
        name: 'Test Learner',
        conceptsCovered: new Set(),
        conceptCoverageEvidence: new Map(),
        errorHistory: new Map(),
        solvedProblemIds: solvedSet,
        interactionCount: 3,
        currentStrategy: 'adaptive-medium',
        preferences: { escalationThreshold: 2, aggregationDelay: 300000 },
        createdAt: Date.now(),
        lastActive: Date.now(),
      });

      const { result } = renderHook(() =>
        useLearnerProgress({ learnerId: mockLearnerId, currentProblemId: firstProblemId })
      );

      expect(result.current.solvedCount).toBe(1);
      expect(result.current.solvedProblemIds.size).toBe(1);
    });
  });

  describe('Grading Contract Verification', () => {
    it('should reflect correct solved state when grading returns match=true', () => {
      // This simulates the grading flow:
      // 1. SQLEditor executes query
      // 2. compareResults returns { match: true }
      // 3. onExecute is called with isCorrect=true
      // 4. InteractionEvent with successful=true is saved
      // 5. updateProfileStatsFromEvent adds problemId to solvedProblemIds
      
      vi.mocked(localStorageManager.getProfile).mockReturnValue({
        id: mockLearnerId,
        name: 'Test Learner',
        conceptsCovered: new Set(),
        conceptCoverageEvidence: new Map(),
        errorHistory: new Map(),
        solvedProblemIds: new Set([firstProblemId]), // Graded as correct
        interactionCount: 1,
        currentStrategy: 'adaptive-medium',
        preferences: { escalationThreshold: 2, aggregationDelay: 300000 },
        createdAt: Date.now(),
        lastActive: Date.now(),
      });

      const { result } = renderHook(() =>
        useLearnerProgress({ learnerId: mockLearnerId, currentProblemId: firstProblemId })
      );

      // Grading contract: match=true => isCurrentProblemSolved=true
      expect(result.current.isCurrentProblemSolved).toBe(true);
      expect(result.current.solvedCount).toBe(1);
    });

    it('should NOT add to solved when grading returns match=false', () => {
      // Simulates: compareResults returns { match: false }
      // Event is either 'error' type or 'execution' with successful=false
      // updateProfileStatsFromEvent does NOT add problemId
      
      vi.mocked(localStorageManager.getProfile).mockReturnValue({
        id: mockLearnerId,
        name: 'Test Learner',
        conceptsCovered: new Set(),
        conceptCoverageEvidence: new Map(),
        errorHistory: new Map([['syntax_error', 1]]),
        solvedProblemIds: new Set(), // Empty - no problems solved
        interactionCount: 1,
        currentStrategy: 'adaptive-medium',
        preferences: { escalationThreshold: 2, aggregationDelay: 300000 },
        createdAt: Date.now(),
        lastActive: Date.now(),
      });

      const { result } = renderHook(() =>
        useLearnerProgress({ learnerId: mockLearnerId, currentProblemId: firstProblemId })
      );

      // Grading contract: match=false => isCurrentProblemSolved=false
      expect(result.current.isCurrentProblemSolved).toBe(false);
      expect(result.current.solvedCount).toBe(0);
    });

    it('should track solvedCount across multiple problems', () => {
      // Simulates learner solving multiple different problems
      vi.mocked(localStorageManager.getProfile).mockReturnValue({
        id: mockLearnerId,
        name: 'Test Learner',
        conceptsCovered: new Set(),
        conceptCoverageEvidence: new Map(),
        errorHistory: new Map(),
        solvedProblemIds: new Set([firstProblemId, secondProblemId]),
        interactionCount: 2,
        currentStrategy: 'adaptive-medium',
        preferences: { escalationThreshold: 2, aggregationDelay: 300000 },
        createdAt: Date.now(),
        lastActive: Date.now(),
      });

      const { result } = renderHook(() =>
        useLearnerProgress({ learnerId: mockLearnerId, currentProblemId: secondProblemId })
      );

      expect(result.current.solvedCount).toBe(2);
      expect(result.current.isProblemSolved(firstProblemId)).toBe(true);
      expect(result.current.isProblemSolved(secondProblemId)).toBe(true);
    });
  });

  describe('Session Restore Behavior', () => {
    it('should persist solved state across session restores', () => {
      // Simulates page reload - storage.getProfile returns persisted data
      const persistedSolvedIds = new Set([firstProblemId, secondProblemId]);
      
      vi.mocked(localStorageManager.getProfile).mockReturnValue({
        id: mockLearnerId,
        name: 'Test Learner',
        conceptsCovered: new Set(),
        conceptCoverageEvidence: new Map(),
        errorHistory: new Map(),
        solvedProblemIds: persistedSolvedIds,
        interactionCount: 10,
        currentStrategy: 'adaptive-medium',
        preferences: { escalationThreshold: 2, aggregationDelay: 300000 },
        createdAt: Date.now(),
        lastActive: Date.now(),
      });

      const { result } = renderHook(() =>
        useLearnerProgress({ learnerId: mockLearnerId, currentProblemId: firstProblemId })
      );

      // After restore, solved state should be preserved
      expect(result.current.solvedCount).toBe(2);
      expect(result.current.isProblemSolved(firstProblemId)).toBe(true);
      expect(result.current.isProblemSolved(secondProblemId)).toBe(true);
    });

    it('should handle empty/null solvedProblemIds gracefully on restore', () => {
      // Simulates new learner or corrupted data
      vi.mocked(localStorageManager.getProfile).mockReturnValue({
        id: mockLearnerId,
        name: 'Test Learner',
        conceptsCovered: new Set(),
        conceptCoverageEvidence: new Map(),
        errorHistory: new Map(),
        solvedProblemIds: new Set(), // Empty but valid
        interactionCount: 0,
        currentStrategy: 'adaptive-medium',
        preferences: { escalationThreshold: 2, aggregationDelay: 300000 },
        createdAt: Date.now(),
        lastActive: Date.now(),
      });

      const { result } = renderHook(() =>
        useLearnerProgress({ learnerId: mockLearnerId, currentProblemId: firstProblemId })
      );

      expect(result.current.solvedCount).toBe(0);
      expect(result.current.isCurrentProblemSolved).toBe(false);
    });

    it('should handle missing profile gracefully (new learner)', () => {
      // Simulates completely new learner - no profile exists
      vi.mocked(localStorageManager.getProfile).mockReturnValue(null);

      const { result } = renderHook(() =>
        useLearnerProgress({ learnerId: 'new-learner', currentProblemId: firstProblemId })
      );

      expect(result.current.solvedCount).toBe(0);
      expect(result.current.solvedProblemIds.size).toBe(0);
      expect(result.current.isCurrentProblemSolved).toBe(false);
    });
  });

  describe('Progress Calculations', () => {
    it('should calculate solvedPercent correctly', () => {
      const totalProblems = sqlProblems.length;
      const solvedCount = 5;
      const expectedPercent = Math.round((solvedCount / totalProblems) * 100);

      // Create solved set with 5 problems
      const solvedIds = new Set(sqlProblems.slice(0, 5).map(p => p.id));

      vi.mocked(localStorageManager.getProfile).mockReturnValue({
        id: mockLearnerId,
        name: 'Test Learner',
        conceptsCovered: new Set(),
        conceptCoverageEvidence: new Map(),
        errorHistory: new Map(),
        solvedProblemIds: solvedIds,
        interactionCount: 5,
        currentStrategy: 'adaptive-medium',
        preferences: { escalationThreshold: 2, aggregationDelay: 300000 },
        createdAt: Date.now(),
        lastActive: Date.now(),
      });

      const { result } = renderHook(() =>
        useLearnerProgress({ learnerId: mockLearnerId, currentProblemId: firstProblemId })
      );

      expect(result.current.solvedPercent).toBe(expectedPercent);
    });

    it('should report currentProblemNumber correctly', () => {
      vi.mocked(localStorageManager.getProfile).mockReturnValue({
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

      // First problem should be position 1
      const { result: result1 } = renderHook(() =>
        useLearnerProgress({ learnerId: mockLearnerId, currentProblemId: sqlProblems[0]?.id })
      );
      expect(result1.current.currentProblemNumber).toBe(1);

      // Tenth problem should be position 10
      const { result: result10 } = renderHook(() =>
        useLearnerProgress({ learnerId: mockLearnerId, currentProblemId: sqlProblems[9]?.id })
      );
      expect(result10.current.currentProblemNumber).toBe(10);
    });
  });

  describe('Risk Scenarios', () => {
    it('should handle case where grading incorrectly marks wrong answer as correct (false positive)', () => {
      // Risk: Grading bug causes wrong answer to be marked correct
      // Impact: solvedProblemIds contains problem that shouldn't be solved
      // Mitigation: This test documents the risk - hook will show it as solved
      
      vi.mocked(localStorageManager.getProfile).mockReturnValue({
        id: mockLearnerId,
        name: 'Test Learner',
        conceptsCovered: new Set(),
        conceptCoverageEvidence: new Map(),
        errorHistory: new Map(),
        solvedProblemIds: new Set([firstProblemId]), // Incorrectly added by false positive
        interactionCount: 1,
        currentStrategy: 'adaptive-medium',
        preferences: { escalationThreshold: 2, aggregationDelay: 300000 },
        createdAt: Date.now(),
        lastActive: Date.now(),
      });

      const { result } = renderHook(() =>
        useLearnerProgress({ learnerId: mockLearnerId, currentProblemId: firstProblemId })
      );

      // The hook reflects what's in storage - if grading was wrong, UI shows solved
      expect(result.current.isCurrentProblemSolved).toBe(true);
      expect(result.current.solvedCount).toBe(1);
      
      // Note: This is a grading accuracy issue, not a hook issue
      // The hook correctly reflects the persisted state
    });

    it('should handle case where grading incorrectly marks correct answer as wrong (false negative)', () => {
      // Risk: Grading bug causes correct answer to be marked wrong
      // Impact: solvedProblemIds doesn't contain problem that should be solved
      // Mitigation: This test documents the risk - hook will show it as unsolved
      
      vi.mocked(localStorageManager.getProfile).mockReturnValue({
        id: mockLearnerId,
        name: 'Test Learner',
        conceptsCovered: new Set(),
        conceptCoverageEvidence: new Map(),
        errorHistory: new Map(),
        solvedProblemIds: new Set(), // Empty due to false negative
        interactionCount: 1,
        currentStrategy: 'adaptive-medium',
        preferences: { escalationThreshold: 2, aggregationDelay: 300000 },
        createdAt: Date.now(),
        lastActive: Date.now(),
      });

      const { result } = renderHook(() =>
        useLearnerProgress({ learnerId: mockLearnerId, currentProblemId: firstProblemId })
      );

      // The hook reflects what's in storage - if grading was wrong, UI shows unsolved
      expect(result.current.isCurrentProblemSolved).toBe(false);
      expect(result.current.solvedCount).toBe(0);
      
      // Note: This is a grading accuracy issue, not a hook issue
      // The hook correctly reflects the persisted state
    });
  });
});
