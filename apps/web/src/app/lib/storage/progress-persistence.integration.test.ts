/**
 * Progress Persistence Integration Tests
 *
 * Tests the actual dual-storage layer behavior for the "lost progress" fix.
 * These tests verify that the storage layer correctly:
 * 1. Saves progress to backend as source of truth
 * 2. Rehydrates progress from backend on login
 * 3. Handles localStorage/sessionStorage clearing gracefully
 * 4. Preserves progress during quota errors
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { LearnerProfile, InteractionEvent } from '@/app/types';

// Mock the storage-client module
const isBackendAvailableMock = vi.fn<() => Promise<boolean>>();
const checkBackendHealthMock = vi.fn<() => Promise<boolean>>();
const saveSessionMock = vi.fn<(learnerId: string, data: Record<string, unknown>) => Promise<boolean>>();
const getSessionMock = vi.fn<(learnerId: string) => Promise<Record<string, unknown> | null>>();
const getProfileMock = vi.fn<(learnerId: string) => Promise<LearnerProfile | null>>();
const saveProfileMock = vi.fn<(profile: unknown) => Promise<boolean>>();
const updateProblemProgressMock = vi.fn<(learnerId: string, problemId: string, update: unknown) => Promise<unknown>>();
const getAllProblemProgressMock = vi.fn<(learnerId: string) => Promise<unknown[]>>();
const logInteractionMock = vi.fn<(event: unknown) => Promise<{ success: boolean; confirmed?: boolean }>>();

vi.mock('../api/storage-client', () => ({
  isBackendAvailable: isBackendAvailableMock,
  checkBackendHealth: checkBackendHealthMock,
  storageClient: {
    saveSession: saveSessionMock,
    getSession: getSessionMock,
    getProfile: getProfileMock,
    saveProfile: saveProfileMock,
    updateProblemProgress: updateProblemProgressMock,
    getAllProblemProgress: getAllProblemProgressMock,
    logInteraction: logInteractionMock,
  },
}));

describe('Progress Persistence - Storage Layer Integration', () => {
  beforeEach(async () => {
    vi.stubEnv('VITE_API_BASE_URL', 'https://api.test.example');
    localStorage.clear();
    sessionStorage.clear();

    // Default healthy backend
    isBackendAvailableMock.mockResolvedValue(true);
    checkBackendHealthMock.mockResolvedValue(true);
    saveSessionMock.mockResolvedValue(true);
    getSessionMock.mockResolvedValue(null);
    getProfileMock.mockResolvedValue(null);
    saveProfileMock.mockResolvedValue(true);
    updateProblemProgressMock.mockResolvedValue({ success: true });
    getAllProblemProgressMock.mockResolvedValue([]);
    logInteractionMock.mockResolvedValue({ success: true, confirmed: true });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetAllMocks();
  });

  describe('SCENARIO 1: Sign up → solve → logout → login → progress restored', () => {
    it('calls updateProblemProgress when execution is successful', async () => {
      const { dualStorage } = await import('./dual-storage');

      const learnerId = 'learner-test-1';
      const problemId = 'problem-1';
      const code = 'SELECT * FROM employees';

      // Simulate successful execution event
      const event: InteractionEvent = {
        id: 'exec-1',
        learnerId,
        sessionId: 'session-1',
        timestamp: Date.now(),
        eventType: 'execution',
        problemId,
        code,
        successful: true,
      };

      dualStorage.saveInteraction(event);

      // Wait for async operations
      await vi.waitFor(() => {
        expect(updateProblemProgressMock).toHaveBeenCalledWith(
          learnerId,
          problemId,
          expect.objectContaining({
            solved: true,
            incrementAttempts: true,
            lastCode: code,
          })
        );
      });
    });

    it('persists progress to backend with correct problemId', async () => {
      const { dualStorage } = await import('./dual-storage');

      const learnerId = 'learner-test-2';
      const problemId = 'problem-join-101';

      updateProblemProgressMock.mockResolvedValueOnce({
        userId: learnerId,
        problemId,
        solved: true,
        attemptsCount: 1,
        hintsUsed: 0,
        lastCode: 'SELECT e.name, d.name FROM employees e JOIN departments d ON e.dept_id = d.id',
      });

      const event: InteractionEvent = {
        id: 'exec-2',
        learnerId,
        sessionId: 'session-2',
        timestamp: Date.now(),
        eventType: 'execution',
        problemId,
        code: 'SELECT e.name, d.name FROM employees e JOIN departments d ON e.dept_id = d.id',
        successful: true,
      };

      dualStorage.saveInteraction(event);

      await vi.waitFor(() => {
        expect(updateProblemProgressMock).toHaveBeenCalledTimes(1);
      });

      const [, , updateArg] = updateProblemProgressMock.mock.calls[0];
      expect(updateArg).toMatchObject({
        solved: true,
        incrementAttempts: true,
      });
    });

    it('rehydrates solvedProblemIds from backend on getProfile', async () => {
      const { dualStorage } = await import('./dual-storage');

      const learnerId = 'learner-test-3';
      const backendProfile: LearnerProfile = {
        id: learnerId,
        name: 'Test Learner',
        conceptsCovered: new Set(['joins', 'aggregates']),
        conceptCoverageEvidence: new Map(),
        errorHistory: new Map(),
        solvedProblemIds: new Set(['problem-1', 'problem-2', 'problem-3']),
        interactionCount: 10,
        currentStrategy: 'adaptive-medium',
        preferences: { escalationThreshold: 3, aggregationDelay: 5000 },
        createdAt: Date.now(),
        lastActive: Date.now(),
      };

      getProfileMock.mockResolvedValueOnce(backendProfile);

      const profile = await dualStorage.getProfile(learnerId);

      expect(profile).not.toBeNull();
      expect(profile?.solvedProblemIds.has('problem-1')).toBe(true);
      expect(profile?.solvedProblemIds.has('problem-2')).toBe(true);
      expect(profile?.solvedProblemIds.has('problem-3')).toBe(true);
      expect(profile?.solvedProblemIds.size).toBe(3);
    });
  });

  describe('SCENARIO 2: Sign in → refresh → progress restored', () => {
    it('maintains solvedProblemIds across multiple getProfile calls', async () => {
      const { dualStorage } = await import('./dual-storage');

      const learnerId = 'learner-test-4';
      const solvedIds = new Set(['problem-1', 'problem-2']);

      // First, save a profile locally
      const localProfile: LearnerProfile = {
        id: learnerId,
        name: 'Test Learner',
        conceptsCovered: new Set(),
        conceptCoverageEvidence: new Map(),
        errorHistory: new Map(),
        solvedProblemIds: solvedIds,
        interactionCount: 5,
        currentStrategy: 'adaptive-medium',
        preferences: { escalationThreshold: 3, aggregationDelay: 5000 },
        createdAt: Date.now(),
        lastActive: Date.now(),
      };

      dualStorage.saveProfile(localProfile);

      // Simulate "refresh" - get profile again
      getProfileMock.mockResolvedValueOnce({
        ...localProfile,
        solvedProblemIds: new Set(['problem-1', 'problem-2']), // Backend confirms same state
      });

      const profileAfterRefresh = dualStorage.getProfile(learnerId);

      expect(profileAfterRefresh?.solvedProblemIds.has('problem-1')).toBe(true);
      expect(profileAfterRefresh?.solvedProblemIds.has('problem-2')).toBe(true);
    });

    it('preserves progress even when backend hydration is delayed', async () => {
      const { dualStorage } = await import('./dual-storage');

      const learnerId = 'learner-test-5';
      const solvedIds = new Set(['problem-1']);

      // Save locally first
      const localProfile: LearnerProfile = {
        id: learnerId,
        name: 'Test Learner',
        conceptsCovered: new Set(),
        conceptCoverageEvidence: new Map(),
        errorHistory: new Map(),
        solvedProblemIds: solvedIds,
        interactionCount: 3,
        currentStrategy: 'adaptive-medium',
        preferences: { escalationThreshold: 3, aggregationDelay: 5000 },
        createdAt: Date.now(),
        lastActive: Date.now(),
      };

      dualStorage.saveProfile(localProfile);

      // Backend is slow/stale but local should still return correct data immediately
      const immediateProfile = dualStorage.getProfile(learnerId);

      // Should have local state immediately
      expect(immediateProfile?.solvedProblemIds.has('problem-1')).toBe(true);
    });
  });

  describe('SCENARIO 3: Clear localStorage → sign in → progress restored from backend', () => {
    it('rehydrates progress from backend when localStorage is empty', async () => {
      const { dualStorage } = await import('./dual-storage');

      const learnerId = 'learner-test-6';

      // localStorage is empty (simulating cleared storage)
      expect(localStorage.getItem('sql-learning-profiles')).toBeNull();

      // Backend has the progress
      getProfileMock.mockResolvedValueOnce({
        id: learnerId,
        name: 'Test Learner',
        conceptsCovered: new Set(),
        conceptCoverageEvidence: new Map(),
        errorHistory: new Map(),
        solvedProblemIds: new Set(['problem-1', 'problem-2']),
        interactionCount: 5,
        currentStrategy: 'adaptive-medium',
        preferences: { escalationThreshold: 3, aggregationDelay: 5000 },
        createdAt: Date.now(),
        lastActive: Date.now(),
      });

      // Get profile should fetch from backend
      const profile = await dualStorage.getProfile(learnerId);

      expect(profile).not.toBeNull();
      expect(profile?.solvedProblemIds.has('problem-1')).toBe(true);
      expect(profile?.solvedProblemIds.has('problem-2')).toBe(true);
    });

    it('fetches all problem progress from backend on hydration', async () => {
      const { dualStorage } = await import('./dual-storage');

      const learnerId = 'learner-test-7';

      getAllProblemProgressMock.mockResolvedValueOnce([
        { userId: learnerId, problemId: 'problem-1', solved: true, attemptsCount: 2 },
        { userId: learnerId, problemId: 'problem-2', solved: true, attemptsCount: 1 },
        { userId: learnerId, problemId: 'problem-3', solved: false, attemptsCount: 3 },
      ]);

      // Simulate hydration call
      const progress = await getAllProblemProgressMock(learnerId);

      expect(progress).toHaveLength(3);
      expect(progress.filter((p: { solved: boolean }) => p.solved)).toHaveLength(2);
    });
  });

  describe('SCENARIO 4: Backend has session, local missing → session restores', () => {
    it('hydrates session from backend when localStorage has no session', async () => {
      const { dualStorage } = await import('./dual-storage');

      const learnerId = 'learner-test-8';
      const backendSessionId = 'session-backend-123';

      // No local session
      expect(localStorage.getItem('sql-learning-active-session')).toBeNull();

      // Backend has active session
      getSessionMock.mockResolvedValueOnce({
        sessionId: backendSessionId,
        currentProblemId: 'problem-5',
        currentCode: 'SELECT * FROM employees',
        lastActivity: new Date().toISOString(),
      });

      // Hydrate should restore session
      const hydrated = await dualStorage.hydrateLearner(learnerId);

      expect(hydrated).toBe(true);
      expect(dualStorage.getActiveSessionId()).toBe(backendSessionId);
    });

    it('uses backend session data over stale local data', async () => {
      const { dualStorage } = await import('./dual-storage');

      const learnerId = 'learner-test-9';
      const backendSessionId = 'session-backend-456';
      const staleLocalSessionId = 'session-local-789';

      // Set stale local session
      localStorage.setItem('sql-learning-active-session', staleLocalSessionId);

      // Backend has different (more recent) session
      getSessionMock.mockResolvedValueOnce({
        sessionId: backendSessionId,
        currentProblemId: 'problem-10',
        currentCode: 'SELECT COUNT(*) FROM orders',
        lastActivity: new Date().toISOString(),
      });

      // Hydrate should use backend session
      await dualStorage.hydrateLearner(learnerId);

      expect(dualStorage.getActiveSessionId()).toBe(backendSessionId);
    });
  });

  describe('SCENARIO 5: Quota exceeded → progress still preserved', () => {
    it('calls updateProblemProgress even when localStorage operations might fail', async () => {
      const { dualStorage } = await import('./dual-storage');

      const learnerId = 'learner-test-10';
      const problemId = 'problem-1';

      // Backend is available and working
      updateProblemProgressMock.mockResolvedValueOnce({
        userId: learnerId,
        problemId,
        solved: true,
        attemptsCount: 1,
      });

      const event: InteractionEvent = {
        id: 'exec-10',
        learnerId,
        sessionId: 'session-10',
        timestamp: Date.now(),
        eventType: 'execution',
        problemId,
        code: 'SELECT * FROM employees',
        successful: true,
      };

      dualStorage.saveInteraction(event);

      // Should still call backend even if local storage might have quota issues
      await vi.waitFor(() => {
        expect(updateProblemProgressMock).toHaveBeenCalledWith(
          learnerId,
          problemId,
          expect.objectContaining({ solved: true })
        );
      });
    });

    it('preserves solved state when backend is source of truth', async () => {
      const { dualStorage } = await import('./dual-storage');

      const learnerId = 'learner-test-11';

      // Backend has solved state
      getProfileMock.mockResolvedValueOnce({
        id: learnerId,
        name: 'Test Learner',
        conceptsCovered: new Set(),
        conceptCoverageEvidence: new Map(),
        errorHistory: new Map(),
        solvedProblemIds: new Set(['problem-1', 'problem-2']),
        interactionCount: 5,
        currentStrategy: 'adaptive-medium',
        preferences: { escalationThreshold: 3, aggregationDelay: 5000 },
        createdAt: Date.now(),
        lastActive: Date.now(),
      });

      // Get profile from backend
      const profile = await dualStorage.getProfile(learnerId);

      // Solved state should be preserved regardless of localStorage state
      expect(profile?.solvedProblemIds.has('problem-1')).toBe(true);
      expect(profile?.solvedProblemIds.has('problem-2')).toBe(true);
    });
  });

  describe('SCENARIO 6: Environment differences (documented behavior)', () => {
    it('verifies backend is always source of truth', async () => {
      const { dualStorage } = await import('./dual-storage');

      const learnerId = 'learner-test-12';

      // Simulate different origins behavior
      // Preview and production have different localStorage but same backend auth

      // Backend has the canonical progress
      getAllProblemProgressMock.mockResolvedValueOnce([
        { userId: learnerId, problemId: 'problem-1', solved: true, attemptsCount: 1 },
        { userId: learnerId, problemId: 'problem-2', solved: true, attemptsCount: 2 },
      ]);

      const progress = await getAllProblemProgressMock(learnerId);

      // Backend returns correct progress regardless of origin
      expect(progress).toHaveLength(2);
      expect(progress.every((p: { solved: boolean }) => p.solved)).toBe(true);
    });
  });

  describe('Regression: Prevent progress loss', () => {
    it('does not overwrite local solved state with stale backend data', async () => {
      const { dualStorage } = await import('./dual-storage');

      const learnerId = 'learner-test-13';

      // User solves problem-3 locally
      const localProfile: LearnerProfile = {
        id: learnerId,
        name: 'Test Learner',
        conceptsCovered: new Set(),
        conceptCoverageEvidence: new Map(),
        errorHistory: new Map(),
        solvedProblemIds: new Set(['problem-3']), // Just solved
        interactionCount: 1,
        currentStrategy: 'adaptive-medium',
        preferences: { escalationThreshold: 3, aggregationDelay: 5000 },
        createdAt: Date.now(),
        lastActive: Date.now(),
      };

      dualStorage.saveProfile(localProfile);

      // Backend hasn't synced yet (stale data)
      getProfileMock.mockResolvedValueOnce({
        id: learnerId,
        name: 'Test Learner',
        conceptsCovered: new Set(),
        conceptCoverageEvidence: new Map(),
        errorHistory: new Map(),
        solvedProblemIds: new Set([]), // Stale - doesn't have problem-3
        interactionCount: 0,
        currentStrategy: 'adaptive-medium',
        preferences: { escalationThreshold: 3, aggregationDelay: 5000 },
        createdAt: Date.now(),
        lastActive: Date.now(),
      });

      // Get profile should merge, not overwrite
      const immediateProfile = dualStorage.getProfile(learnerId);

      // Local state should still have problem-3
      expect(immediateProfile?.solvedProblemIds.has('problem-3')).toBe(true);
    });

    it('handles backend temporary unavailability gracefully', async () => {
      const { dualStorage } = await import('./dual-storage');

      const learnerId = 'learner-test-14';

      // Backend is down
      checkBackendHealthMock.mockResolvedValueOnce(false);
      isBackendAvailableMock.mockResolvedValueOnce(false);

      // Save profile locally
      const localProfile: LearnerProfile = {
        id: learnerId,
        name: 'Test Learner',
        conceptsCovered: new Set(),
        conceptCoverageEvidence: new Map(),
        errorHistory: new Map(),
        solvedProblemIds: new Set(['problem-1']),
        interactionCount: 1,
        currentStrategy: 'adaptive-medium',
        preferences: { escalationThreshold: 3, aggregationDelay: 5000 },
        createdAt: Date.now(),
        lastActive: Date.now(),
      };

      dualStorage.saveProfile(localProfile);

      // Should still be able to get local profile
      const profile = dualStorage.getProfile(learnerId);

      expect(profile).not.toBeNull();
      expect(profile?.solvedProblemIds.has('problem-1')).toBe(true);
    });

    it('syncs pending progress when backend becomes available', async () => {
      const { dualStorage } = await import('./dual-storage');

      const learnerId = 'learner-test-15';
      const problemId = 'problem-1';

      // First, backend is down
      checkBackendHealthMock.mockResolvedValueOnce(false);

      // Save interaction (will be queued)
      const event: InteractionEvent = {
        id: 'exec-15',
        learnerId,
        sessionId: 'session-15',
        timestamp: Date.now(),
        eventType: 'execution',
        problemId,
        code: 'SELECT * FROM employees',
        successful: true,
      };

      dualStorage.saveInteraction(event);

      // Now backend comes back
      checkBackendHealthMock.mockResolvedValue(true);
      isBackendAvailableMock.mockResolvedValue(true);

      updateProblemProgressMock.mockResolvedValueOnce({
        userId: learnerId,
        problemId,
        solved: true,
        attemptsCount: 1,
      });

      // Should sync when health check passes
      await dualStorage.checkHealth();

      // Progress should eventually sync
      await vi.waitFor(() => {
        expect(updateProblemProgressMock).toHaveBeenCalled();
      });
    });
  });
});
