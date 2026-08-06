import type { LearnerProfile, InteractionEvent } from '@/app/types';
import { beforeAll, beforeEach, afterAll, describe, expect, it, vi } from 'vitest';

type DualStorageModule = typeof import('./dual-storage');

const isBackendAvailableMock = vi.fn<() => Promise<boolean>>();
const checkBackendHealthMock = vi.fn<() => Promise<boolean>>();
const saveSessionMock = vi.fn<(learnerId: string, data: Record<string, unknown>) => Promise<boolean>>();
const saveTextbookUnitMock = vi.fn<(learnerId: string, unit: Record<string, unknown>) => Promise<boolean>>();
const getProfileMock = vi.fn<(learnerId: string) => Promise<LearnerProfile | null>>();
const getSessionMock = vi.fn<(learnerId: string) => Promise<Record<string, unknown> | null>>();
const getInteractionsMock = vi.fn<(learnerId: string, options?: Record<string, unknown>) => Promise<{ events: unknown[]; total: number }>>();
const getTextbookMock = vi.fn<(learnerId: string) => Promise<unknown[]>>();
const logInteractionMock = vi.fn<(event: unknown) => Promise<{ success: boolean; confirmed?: boolean }>>();
const logInteractionsBatchMock = vi.fn<(events: unknown[]) => Promise<boolean>>();
const logInteractionsBatchVerifiedMock = vi.fn<(events: unknown[]) => Promise<{ confirmed: string[]; failed: string[] }>>();
const logInteractionsBatchKeepaliveMock = vi.fn<(events: unknown[]) => Promise<{ success: boolean; confirmedIds?: string[] }>>();
const saveProfileMock = vi.fn<(profile: unknown) => Promise<boolean>>();
const updateProfileFromEventMock = vi.fn<(learnerId: string, event: unknown) => Promise<unknown>>();
const updateProblemProgressMock = vi.fn<(learnerId: string, problemId: string, update: unknown) => Promise<unknown>>();
const getAllProblemProgressMock = vi.fn<(learnerId: string) => Promise<Array<{ problemId: string; solved: boolean }>>>();
const createLearnerMock = vi.fn<(profile: unknown) => Promise<boolean>>();
const getInstructorOverviewMock = vi.fn<() => Promise<{ sections?: unknown[] } | null>>();
const getInstructorLearnersMock = vi.fn<() => Promise<unknown[]>>();
const getAllProfilesMock = vi.fn<() => Promise<LearnerProfile[]>>();

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function createBackendProfile(overrides: Partial<LearnerProfile> = {}): LearnerProfile {
  return {
    id: 'learner-1',
    name: 'Learner 1',
    conceptsCovered: new Set(),
    conceptCoverageEvidence: new Map(),
    errorHistory: new Map(),
    solvedProblemIds: new Set(),
    interactionCount: 0,
    currentStrategy: 'adaptive-medium',
    preferences: {
      escalationThreshold: 3,
      aggregationDelay: 5000,
    },
    createdAt: 1_700_000_000_000,
    lastActive: 1_700_000_001_000,
    ...overrides,
  };
}

let dualStorageModule: DualStorageModule;

beforeAll(async () => {
  vi.stubEnv('VITE_API_BASE_URL', 'https://api.example.test');
  vi.doMock('../api/storage-client', () => ({
    isBackendAvailable: isBackendAvailableMock,
    checkBackendHealth: checkBackendHealthMock,
    storageClient: {
      saveSession: saveSessionMock,
      saveTextbookUnit: saveTextbookUnitMock,
      getProfile: getProfileMock,
      getSession: getSessionMock,
      getInteractions: getInteractionsMock,
      getTextbook: getTextbookMock,
      getAllProblemProgress: getAllProblemProgressMock,
      logInteraction: logInteractionMock,
      logInteractionsBatch: logInteractionsBatchMock,
      logInteractionsBatchVerified: logInteractionsBatchVerifiedMock,
      logInteractionsBatchKeepalive: logInteractionsBatchKeepaliveMock,
      saveProfile: saveProfileMock,
      updateProfileFromEvent: updateProfileFromEventMock,
      updateProblemProgress: updateProblemProgressMock,
      createLearner: createLearnerMock,
      getInstructorOverview: getInstructorOverviewMock,
      getInstructorLearners: getInstructorLearnersMock,
      getAllProfiles: getAllProfilesMock,
    },
  }));

  dualStorageModule = await import('./dual-storage');
});

afterAll(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
  vi.restoreAllMocks();
});

beforeEach(() => {
  localStorage.clear();
  dualStorageModule.setActiveSyncPrincipal({
    accountId: 'account-test',
    learnerId: 'learner-1',
  });
  isBackendAvailableMock.mockReset().mockResolvedValue(true);
  checkBackendHealthMock.mockReset().mockResolvedValue(true);
  saveSessionMock.mockReset().mockResolvedValue(true);
  saveTextbookUnitMock.mockReset().mockResolvedValue(true);
  getProfileMock.mockReset().mockResolvedValue(null);
  getSessionMock.mockReset().mockResolvedValue(null);
  getInteractionsMock.mockReset().mockResolvedValue({ events: [], total: 0 });
  getTextbookMock.mockReset().mockResolvedValue([]);
  logInteractionMock.mockReset().mockResolvedValue({ success: true, confirmed: true });
  logInteractionsBatchMock.mockReset().mockResolvedValue(true);
  logInteractionsBatchVerifiedMock.mockReset().mockImplementation(async (events: unknown[]) => {
    const ids = events
      .map((event) => (event as { id?: unknown }).id)
      .filter((id): id is string => typeof id === 'string');
    return { confirmed: ids, failed: [] };
  });
  logInteractionsBatchKeepaliveMock.mockReset().mockImplementation(async (events: unknown[]) => {
    const confirmedIds = events
      .map((event) => (event as { id?: unknown }).id)
      .filter((id): id is string => typeof id === 'string');
    return { success: true, confirmedIds };
  });
  saveProfileMock.mockReset().mockResolvedValue(true);
  updateProfileFromEventMock.mockReset().mockResolvedValue(null);
  updateProblemProgressMock.mockReset().mockResolvedValue({ success: true });
  getAllProblemProgressMock.mockReset().mockResolvedValue([]);
  createLearnerMock.mockReset().mockResolvedValue(true);
  getInstructorOverviewMock.mockReset().mockResolvedValue({ sections: [] });
  getInstructorLearnersMock.mockReset().mockResolvedValue([]);
  getAllProfilesMock.mockReset().mockResolvedValue([]);
});

describe('dual-storage critical write semantics', () => {
  it('exposes an in-memory authenticated sync principal without changing storage keys', () => {
    const storageModule = dualStorageModule as DualStorageModule & {
      setActiveSyncPrincipal?: (principal: { accountId: string; learnerId: string } | null) => void;
      getActiveSyncPrincipal?: () => { accountId: string; learnerId: string; syncOwnerId: string } | null;
    };

    expect(storageModule.setActiveSyncPrincipal).toBeTypeOf('function');
    expect(storageModule.getActiveSyncPrincipal).toBeTypeOf('function');
  });

  it('forwards helper-created research interactions to the backend with core identifiers', async () => {
    localStorage.setItem('sql-learning-active-session', 'session-research-helper');
    await dualStorageModule.dualStorage.checkHealth();

    const rewardComponents = {
      independentSuccess: 1,
      errorReduction: 0.5,
      delayedRetention: 0,
      dependencyPenalty: 0,
      timeEfficiency: 0.25,
    };

    dualStorageModule.dualStorage.saveCoverageChangeEvent({
      learnerId: 'learner-1',
      problemId: 'problem-1',
      conceptId: 'joins',
      score: 80,
      previousScore: 40,
      confidence: 'high',
      evidenceCounts: {
        successfulExecution: 2,
        notesAdded: 0,
        explanationViewed: 1,
        hintViewed: 1,
        errorEncountered: 0,
      },
      triggerEventId: 'execution-1',
      triggerEventType: 'execution',
    });
    dualStorageModule.dualStorage.logGuidanceRequest({
      learnerId: 'learner-1',
      problemId: 'problem-1',
      requestType: 'hint',
      currentRung: 1,
    });
    dualStorageModule.dualStorage.logGuidanceView({
      learnerId: 'learner-1',
      problemId: 'problem-1',
      rung: 2,
      conceptIds: ['joins'],
      sourceRefIds: ['doc:chunk:1'],
      grounded: true,
      contentLength: 120,
    });
    dualStorageModule.dualStorage.logGuidanceEscalate({
      learnerId: 'learner-1',
      problemId: 'problem-1',
      fromRung: 1,
      toRung: 2,
      trigger: 'repeated_error',
      evidence: {
        errorCount: 2,
        retryCount: 1,
        hintCount: 1,
        timeSpentMs: 10_000,
      },
      sourceInteractionIds: ['hint-1'],
    });
    dualStorageModule.dualStorage.logTextbookUnitUpsert({
      learnerId: 'learner-1',
      problemId: 'problem-1',
      unitId: 'unit-1',
      conceptIds: ['joins'],
      action: 'created',
      dedupeKey: 'unit-key',
      revisionCount: 1,
      sourceRefIds: ['doc:chunk:1'],
      sourceInteractionIds: ['hint-1'],
    });
    dualStorageModule.dualStorage.logSourceView({
      learnerId: 'learner-1',
      problemId: 'problem-1',
      passageCount: 2,
      conceptIds: ['joins'],
      expanded: true,
    });
    dualStorageModule.dualStorage.logConditionAssigned(
      'learner-1',
      'adaptive',
      'session-research-helper',
      'problem-1',
      'bandit_selected',
    );
    dualStorageModule.dualStorage.logProfileAssigned('learner-1', 'adaptive-medium', 'bandit', 'problem-1');
    dualStorageModule.dualStorage.logEscalationTriggered('learner-1', 'adaptive-medium', 3, 'problem-1');
    dualStorageModule.dualStorage.logBanditArmSelected({
      learnerId: 'learner-1',
      problemId: 'problem-1',
      armId: 'adaptive-medium',
      selectionMethod: 'thompson_sampling',
    });
    dualStorageModule.dualStorage.logBanditRewardObserved('learner-1', 'adaptive-medium', 0.8, rewardComponents);
    dualStorageModule.dualStorage.logBanditUpdated('learner-1', 'adaptive-medium', 2, 1, 3);
    dualStorageModule.dualStorage.logHDICalculated(
      'learner-1',
      0.42,
      { hpa: 0.3, aed: 0.2, er: 0.4, reae: 0.5, iwh: 0.7 },
      'problem-1',
    );
    dualStorageModule.dualStorage.logHDITrajectoryUpdated('learner-1', 0.5, 'stable', 0.01);
    dualStorageModule.dualStorage.logDependencyInterventionTriggered('learner-1', 0.8, 'reflective_prompt');
    dualStorageModule.dualStorage.logProfileAdjusted('learner-1', 'adaptive-low', 'adaptive-medium', 'bandit_update');
    dualStorageModule.dualStorage.logReinforcementScheduled('learner-1', 'unit-1', 'joins', 'schedule-1');
    dualStorageModule.dualStorage.logReinforcementPromptShown('learner-1', 'schedule-1', 'prompt-1', 'mcq');
    dualStorageModule.dualStorage.logReinforcementResponse('learner-1', 'schedule-1', 'prompt-1', 'SELECT *', true);

    await vi.waitFor(() => {
      expect(logInteractionMock).toHaveBeenCalledTimes(19);
    });

    const backendEvents = logInteractionMock.mock.calls.map(([event]) => event as Record<string, unknown>);
    expect(backendEvents.map((event) => event.eventType)).toEqual(
      expect.arrayContaining([
        'coverage_change',
        'guidance_request',
        'guidance_view',
        'guidance_escalate',
        'textbook_unit_upsert',
        'source_view',
        'condition_assigned',
        'profile_assigned',
        'escalation_triggered',
        'bandit_arm_selected',
        'bandit_reward_observed',
        'bandit_updated',
        'hdi_calculated',
        'hdi_trajectory_updated',
        'dependency_intervention_triggered',
        'profile_adjusted',
        'reinforcement_scheduled',
        'reinforcement_prompt_shown',
        'reinforcement_response',
      ]),
    );
    for (const event of backendEvents) {
      for (const requiredField of ['id', 'learnerId', 'sessionId', 'eventType', 'problemId']) {
        expect(event[requiredField], `${String(event.eventType)}.${requiredField}`).toEqual(expect.any(String));
        expect(String(event[requiredField]).trim(), `${String(event.eventType)}.${requiredField}`).not.toBe('');
      }
      expect(Object.values(event), `${String(event.eventType)} null payload`).not.toContain(null);
    }
  });

  it('preserves a locally solved problem when explicit backend hydration is stale', async () => {
    const localProfile = createBackendProfile({
      solvedProblemIds: new Set(['problem-9']),
    });
    dualStorageModule.dualStorage.saveProfile(localProfile);

    getProfileMock.mockResolvedValueOnce(createBackendProfile({
      solvedProblemIds: new Set(),
    }));

    const immediateProfile = dualStorageModule.dualStorage.getProfile('learner-1');
    expect(immediateProfile?.solvedProblemIds.has('problem-9')).toBe(true);

    await dualStorageModule.dualStorage.hydrateLearner('learner-1');

    expect(getProfileMock).toHaveBeenCalledWith('learner-1');
    expect(dualStorageModule.dualStorage.getProfile('learner-1')?.solvedProblemIds.has('problem-9')).toBe(true);
  });

  it('keeps solved state across repeated explicit hydrations and later backend catch-up', async () => {
    dualStorageModule.dualStorage.saveProfile(createBackendProfile({
      solvedProblemIds: new Set(['problem-9']),
    }));

    getProfileMock
      .mockResolvedValueOnce(createBackendProfile({
        solvedProblemIds: new Set(),
      }))
      .mockResolvedValueOnce(createBackendProfile({
        solvedProblemIds: new Set(['problem-9']),
      }));

    await dualStorageModule.dualStorage.hydrateLearner('learner-1', { force: true });
    expect(getProfileMock).toHaveBeenCalledTimes(1);

    const afterStaleHydration = dualStorageModule.dualStorage.getProfile('learner-1');
    expect(afterStaleHydration?.solvedProblemIds.has('problem-9')).toBe(true);

    await dualStorageModule.dualStorage.hydrateLearner('learner-1', { force: true });
    expect(getProfileMock).toHaveBeenCalledTimes(2);
    expect(dualStorageModule.dualStorage.getProfile('learner-1')?.solvedProblemIds.has('problem-9')).toBe(true);
  });

  it('syncs a newly created default profile to the backend while preserving local creation', async () => {
    await dualStorageModule.dualStorage.checkHealth();

    const profile = dualStorageModule.dualStorage.createDefaultProfile('learner-new');

    expect(profile.id).toBe('learner-new');
    expect(dualStorageModule.dualStorage.getProfile('learner-new')).toEqual(
      expect.objectContaining({
        id: 'learner-new',
        currentStrategy: 'adaptive-medium',
      }),
    );

    await vi.waitFor(() => {
      expect(saveProfileMock).toHaveBeenCalledWith(expect.objectContaining({ id: 'learner-new' }));
    });
  });

  it('queues a newly created default profile for retry when backend sync fails', async () => {
    await dualStorageModule.dualStorage.checkHealth();
    saveProfileMock.mockResolvedValueOnce(false).mockResolvedValueOnce(true);

    dualStorageModule.dualStorage.createDefaultProfile('learner-queued');

    await vi.waitFor(() => {
      expect(saveProfileMock).toHaveBeenCalledTimes(1);
    });

    await dualStorageModule.dualStorage.processOfflineQueue();

    await vi.waitFor(() => {
      expect(saveProfileMock).toHaveBeenCalledTimes(2);
      expect(saveProfileMock).toHaveBeenNthCalledWith(2, expect.objectContaining({ id: 'learner-queued' }));
    });
  });

  it('sends the active session fallback to backend for background interaction writes', async () => {
    localStorage.setItem('sql-learning-active-session', 'session-learner-1-active');
    await dualStorageModule.dualStorage.checkHealth();

    const status = dualStorageModule.dualStorage.saveInteraction({
      id: 'code-change-active-session',
      learnerId: 'learner-1',
      timestamp: 1_700_000_000_000,
      eventType: 'code_change',
      problemId: 'problem-1',
      code: 'SELECT name FROM employees',
    });

    expect(status.success).toBe(true);
    await vi.waitFor(() => {
      expect(logInteractionMock).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'code-change-active-session',
          sessionId: 'session-learner-1-active',
        }),
      );
    });
  });

  it('sends the active session fallback to backend for critical interaction writes', async () => {
    localStorage.setItem('sql-learning-active-session', 'session-learner-1-critical');

    const status = await dualStorageModule.dualStorage.saveInteractionCritical({
      id: 'critical-active-session',
      learnerId: 'learner-1',
      timestamp: 1_700_000_000_000,
      eventType: 'error',
      problemId: 'problem-1',
      error: 'syntax error',
    });

    expect(status.backendConfirmed).toBe(true);
    expect(status.pendingSync).toBe(false);
    expect(logInteractionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'critical-active-session',
        sessionId: 'session-learner-1-critical',
      }),
    );
  });

  it('keeps critical interactions in the durable pending store until backend confirms by id', async () => {
    localStorage.setItem('sql-learning-active-session', 'session-critical-pending');
    logInteractionMock.mockResolvedValueOnce({ success: true, confirmed: false });

    const status = await dualStorageModule.dualStorage.saveInteractionCritical({
      id: 'critical-unconfirmed-1',
      learnerId: 'learner-1',
      timestamp: 1_700_000_000_000,
      eventType: 'error',
      problemId: 'problem-1',
      error: 'syntax error',
    });

    expect(status.backendConfirmed).toBe(false);
    expect(status.pendingSync).toBe(true);
    expect(dualStorageModule.dualStorage.getPendingInteractionsForSession('session-critical-pending')).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'critical-unconfirmed-1',
          sessionId: 'session-critical-pending',
        }),
      ]),
    );
  });

  it('returns backend-confirmed status for persisted session writes', async () => {
    const status = await dualStorageModule.dualStorage.ensureSessionPersisted('learner-1', 'session-1');

    expect(status).toEqual({ backendConfirmed: true, pendingSync: false });
    expect(saveSessionMock).toHaveBeenCalledTimes(1);
  });

  it('returns pending-sync status when backend is unavailable', async () => {
    checkBackendHealthMock.mockResolvedValue(false);

    const status = await dualStorageModule.dualStorage.ensureSessionPersisted('learner-1', 'session-2');

    expect(status.backendConfirmed).toBe(false);
    expect(status.pendingSync).toBe(true);
    expect(status.error).toMatch(/queued/i);
    expect(saveSessionMock).not.toHaveBeenCalled();
  });

  it('returns pending-sync status for failed textbook critical writes', async () => {
    saveTextbookUnitMock.mockResolvedValue(false);

    const result = await dualStorageModule.dualStorage.saveTextbookUnitCritical('learner-1', {
      id: 'unit-1',
      type: 'hint',
      conceptId: 'select-basic',
      conceptIds: ['select-basic'],
      title: 'Unit title',
      content: 'Unit content',
      contentFormat: 'markdown',
      sourceInteractionIds: [],
      status: 'primary',
      prerequisites: [],
      addedTimestamp: Date.now(),
    });

    expect(result.status.backendConfirmed).toBe(false);
    expect(result.status.pendingSync).toBe(true);
    expect(result.status.error).toMatch(/queued/i);
  });

  it('verifies session interactions are synced before session_end emit', async () => {
    dualStorageModule.dualStorage.saveInteraction({
      id: 'exec-1',
      learnerId: 'learner-1',
      sessionId: 'session-verify-1',
      timestamp: 1_700_000_000_000,
      eventType: 'execution',
      problemId: 'problem-1',
      successful: true,
    });
    logInteractionMock.mockClear();
    logInteractionsBatchMock.mockClear();

    getInteractionsMock
      .mockResolvedValueOnce({ events: [], total: 0 })
      .mockResolvedValueOnce({
        events: [
          {
            id: 'exec-1',
            learnerId: 'learner-1',
            sessionId: 'session-verify-1',
            timestamp: 1_700_000_000_000,
            eventType: 'execution',
            problemId: 'problem-1',
            successful: true,
          },
        ],
        total: 1,
      });

    const status = await dualStorageModule.dualStorage.ensureSessionInteractionsPersisted(
      'learner-1',
      'session-verify-1',
    );

    expect(status.backendConfirmed).toBe(true);
    expect(status.pendingSync).toBe(false);
    expect(logInteractionsBatchMock).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ id: 'exec-1' })]),
    );
  });

  it('emits session_end only after backend sync confirmation', async () => {
    dualStorageModule.dualStorage.saveInteraction({
      id: 'exec-2',
      learnerId: 'learner-1',
      sessionId: 'session-verify-2',
      timestamp: 1_700_000_000_000,
      eventType: 'execution',
      problemId: 'problem-1',
      successful: true,
    });
    logInteractionMock.mockClear();

    getInteractionsMock
      .mockResolvedValueOnce({
        events: [
          {
            id: 'exec-2',
            learnerId: 'learner-1',
            sessionId: 'session-verify-2',
            timestamp: 1_700_000_000_000,
            eventType: 'execution',
            problemId: 'problem-1',
            successful: true,
          },
        ],
        total: 1,
      });

    const status = await dualStorageModule.dualStorage.emitSessionEnd({
      id: 'session-end-1',
      learnerId: 'learner-1',
      sessionId: 'session-verify-2',
      timestamp: 1_700_000_010_000,
      eventType: 'session_end',
      problemId: 'problem-1',
      totalTime: 10_000,
      timeSpent: 10_000,
      problemsAttempted: 1,
      problemsSolved: 1,
    });

    expect(status.backendConfirmed).toBe(true);
    expect(status.pendingSync).toBe(false);
    expect(logInteractionMock).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'session-end-1', eventType: 'session_end' }),
    );
  });

  it('keeps session_end pending when pre-end interaction sync fails', async () => {
    dualStorageModule.dualStorage.saveInteraction({
      id: 'exec-pending-1',
      learnerId: 'learner-1',
      sessionId: 'session-pending-1',
      timestamp: 1_700_000_000_000,
      eventType: 'execution',
      problemId: 'problem-1',
      successful: true,
    });
    logInteractionMock.mockClear();
    logInteractionsBatchMock.mockClear();
    getInteractionsMock.mockResolvedValueOnce({ events: [], total: 0 });
    logInteractionsBatchMock.mockResolvedValueOnce(false);

    const status = await dualStorageModule.dualStorage.emitSessionEnd({
      id: 'session-end-pending-1',
      learnerId: 'learner-1',
      sessionId: 'session-pending-1',
      timestamp: 1_700_000_010_000,
      eventType: 'session_end',
      problemId: 'problem-1',
      totalTime: 10_000,
      timeSpent: 10_000,
      problemsAttempted: 1,
      problemsSolved: 1,
    });

    expect(status.backendConfirmed).toBe(false);
    expect(status.pendingSync).toBe(true);
    expect(logInteractionMock).not.toHaveBeenCalled();
    expect(localStorage.getItem('sql-adapt-pending-session-ends') ?? '').toContain('session-end-pending-1');
  });

  it('only confirms exact ids during pagehide flush and leaves missing ids pending', async () => {
    logInteractionMock.mockResolvedValue({ success: true, confirmed: false });
    dualStorageModule.dualStorage.saveInteraction({
      id: 'pagehide-exact-1',
      learnerId: 'learner-1',
      sessionId: 'session-pagehide-partial',
      timestamp: 1_700_000_000_000,
      eventType: 'execution',
      problemId: 'problem-1',
      successful: true,
    });
    dualStorageModule.dualStorage.saveInteraction({
      id: 'pagehide-exact-2',
      learnerId: 'learner-1',
      sessionId: 'session-pagehide-partial',
      timestamp: 1_700_000_001_000,
      eventType: 'concept_view',
      problemId: 'problem-1',
      conceptId: 'joins',
      source: 'problem',
    });

    await vi.waitFor(() => {
      expect(logInteractionMock).toHaveBeenCalledTimes(2);
    });
    logInteractionsBatchKeepaliveMock.mockResolvedValueOnce({
      success: true,
      confirmedIds: ['pagehide-exact-1'],
    });

    const status = await dualStorageModule.dualStorage.flushWithKeepalive('session-pagehide-partial');

    expect(status.backendConfirmed).toBe(false);
    expect(status.pendingSync).toBe(true);
    expect(dualStorageModule.dualStorage.getPendingInteractionsForSession('session-pagehide-partial')).toEqual([
      expect.objectContaining({ id: 'pagehide-exact-2' }),
    ]);
  });

  it('does not send queued session_end until all same-session interactions are confirmed', async () => {
    logInteractionMock.mockResolvedValue({ success: true, confirmed: false });
    dualStorageModule.dualStorage.saveInteraction({
      id: 'pagehide-before-end-1',
      learnerId: 'learner-1',
      sessionId: 'session-end-barrier-1',
      timestamp: 1_700_000_000_000,
      eventType: 'execution',
      problemId: 'problem-1',
      successful: true,
    });
    const queued = dualStorageModule.dualStorage.queueSessionEnd({
      id: 'session-end-barrier-1',
      learnerId: 'learner-1',
      sessionId: 'session-end-barrier-1',
      timestamp: 1_700_000_010_000,
      eventType: 'session_end',
      problemId: 'problem-1',
      totalTime: 10_000,
      timeSpent: 10_000,
      problemsAttempted: 1,
      problemsSolved: 1,
    });
    expect(queued.success).toBe(true);

    await vi.waitFor(() => {
      expect(logInteractionMock).toHaveBeenCalledTimes(1);
    });
    logInteractionsBatchKeepaliveMock.mockResolvedValueOnce({
      success: true,
      confirmedIds: [],
    });

    const status = await dualStorageModule.dualStorage.flushWithKeepalive('session-end-barrier-1');

    expect(status.backendConfirmed).toBe(false);
    expect(logInteractionsBatchKeepaliveMock).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem('sql-adapt-pending-session-ends') ?? '').toContain('session-end-barrier-1');
  });

  it('flushes pending session_end after interactions verify', async () => {
    const storageWithPendingFlush = dualStorageModule.dualStorage as typeof dualStorageModule.dualStorage & {
      flushPendingSessionEnds?: () => Promise<unknown>;
    };
    expect(storageWithPendingFlush.flushPendingSessionEnds).toBeTypeOf('function');
    if (!storageWithPendingFlush.flushPendingSessionEnds) return;

    dualStorageModule.dualStorage.saveInteraction({
      id: 'exec-pending-2',
      learnerId: 'learner-1',
      sessionId: 'session-pending-2',
      timestamp: 1_700_000_000_000,
      eventType: 'execution',
      problemId: 'problem-1',
      successful: true,
    });
    logInteractionMock.mockClear();
    logInteractionsBatchMock.mockClear();
    getInteractionsMock.mockResolvedValueOnce({ events: [], total: 0 });
    logInteractionsBatchMock.mockResolvedValueOnce(false);

    await dualStorageModule.dualStorage.emitSessionEnd({
      id: 'session-end-pending-2',
      learnerId: 'learner-1',
      sessionId: 'session-pending-2',
      timestamp: 1_700_000_010_000,
      eventType: 'session_end',
      problemId: 'problem-1',
      totalTime: 10_000,
      timeSpent: 10_000,
      problemsAttempted: 1,
      problemsSolved: 1,
    });

    logInteractionMock.mockClear();
    getInteractionsMock
      .mockResolvedValueOnce({ events: [], total: 0 })
      .mockResolvedValueOnce({
        events: [
          {
            id: 'exec-pending-2',
            learnerId: 'learner-1',
            sessionId: 'session-pending-2',
            timestamp: 1_700_000_000_000,
            eventType: 'execution',
            problemId: 'problem-1',
            successful: true,
          },
        ],
        total: 1,
      });
    logInteractionsBatchMock.mockResolvedValueOnce(true);

    const flushStatus = await storageWithPendingFlush.flushPendingSessionEnds();

    expect(flushStatus).toMatchObject({ backendConfirmed: true, pendingSync: false });
    expect(logInteractionMock).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'session-end-pending-2', eventType: 'session_end' }),
    );
    expect(localStorage.getItem('sql-adapt-pending-session-ends')).not.toContain('session-end-pending-2');
  });

  it('deduplicates pending session_end finalizations by session id', async () => {
    const storageWithPendingFlush = dualStorageModule.dualStorage as typeof dualStorageModule.dualStorage & {
      flushPendingSessionEnds?: () => Promise<unknown>;
    };
    expect(storageWithPendingFlush.flushPendingSessionEnds).toBeTypeOf('function');
    if (!storageWithPendingFlush.flushPendingSessionEnds) return;

    checkBackendHealthMock.mockResolvedValue(false);

    const firstStatus = await dualStorageModule.dualStorage.emitSessionEnd({
      id: 'session-end-duplicate-first',
      learnerId: 'learner-1',
      sessionId: 'session-duplicate-1',
      timestamp: 1_700_000_010_000,
      eventType: 'session_end',
      problemId: 'problem-1',
      totalTime: 10_000,
      timeSpent: 10_000,
      problemsAttempted: 1,
      problemsSolved: 1,
    });
    const secondStatus = await dualStorageModule.dualStorage.emitSessionEnd({
      id: 'session-end-duplicate-second',
      learnerId: 'learner-1',
      sessionId: 'session-duplicate-1',
      timestamp: 1_700_000_012_000,
      eventType: 'session_end',
      problemId: 'problem-1',
      totalTime: 12_000,
      timeSpent: 12_000,
      problemsAttempted: 1,
      problemsSolved: 1,
    });

    expect(firstStatus.pendingSync).toBe(true);
    expect(secondStatus.pendingSync).toBe(true);
    const pending = JSON.parse(localStorage.getItem('sql-adapt-pending-session-ends') ?? '[]');
    expect(pending).toHaveLength(1);
    expect(pending[0].event).toMatchObject({
      id: 'session-end-duplicate-second',
      sessionId: 'session-duplicate-1',
      totalTime: 12_000,
    });
  });

  it('preserves a malformed pending session-end root instead of replacing it', () => {
    const malformedRoot = '{"unexpected":"object-root"}';
    localStorage.setItem('sql-adapt-pending-session-ends', malformedRoot);

    const result = dualStorageModule.dualStorage.queueSessionEnd({
      id: 'session-end-malformed-root',
      learnerId: 'learner-1',
      sessionId: 'session-malformed-root',
      timestamp: 1_700_000_010_000,
      eventType: 'session_end',
      problemId: 'problem-1',
    });

    expect(result.success).toBe(false);
    expect(localStorage.getItem('sql-adapt-pending-session-ends')).toBe(malformedRoot);
  });

  it('keeps a pending session-end record when backend confirmation cannot be cleared locally', async () => {
    const event = {
      id: 'session-end-clear-proof',
      learnerId: 'learner-1',
      sessionId: 'session-clear-proof',
      timestamp: 1_700_000_010_000,
      eventType: 'session_end' as const,
      problemId: 'problem-1',
    };
    const original = localStorage.setItem.bind(localStorage);
    const setItem = vi.spyOn(localStorage, 'setItem').mockImplementation((key, value) => {
      if (key === 'sql-adapt-pending-session-ends' && value === '[]') {
        throw new DOMException('session-end clear blocked', 'QuotaExceededError');
      }
      return original(key, value);
    });

    const result = await dualStorageModule.dualStorage.emitSessionEnd(event);
    setItem.mockRestore();

    expect(result).toMatchObject({
      backendConfirmed: true,
      pendingSync: true,
      error: expect.stringContaining('could not be cleared'),
    });
    expect(localStorage.getItem('sql-adapt-pending-session-ends')).toContain(event.id);
  });

  // RESEARCH-4: Flush verification requires exact ID matching
  // This test verifies that ensureSessionInteractionsPersisted compares local and backend IDs exactly
  it('verifies session persistence using exact id equality', async () => {
    // Save multiple interactions locally with known IDs
    dualStorageModule.dualStorage.saveInteraction({
      id: 'exact-id-1',
      learnerId: 'learner-1',
      sessionId: 'session-exact-1',
      timestamp: 1_700_000_000_000,
      eventType: 'hint_view',
      problemId: 'problem-1',
      hintId: 'hint-1',
    });
    dualStorageModule.dualStorage.saveInteraction({
      id: 'exact-id-2',
      learnerId: 'learner-1',
      sessionId: 'session-exact-1',
      timestamp: 1_700_000_001_000,
      eventType: 'concept_view',
      problemId: 'problem-1',
      conceptId: 'joins',
      source: 'hint',
    });
    dualStorageModule.dualStorage.saveInteraction({
      id: 'exact-id-3',
      learnerId: 'learner-1',
      sessionId: 'session-exact-1',
      timestamp: 1_700_000_002_000,
      eventType: 'execution',
      problemId: 'problem-1',
      successful: true,
    });

    logInteractionsBatchMock.mockClear();

    // Backend returns interactions with EXACT same IDs
    getInteractionsMock.mockResolvedValueOnce({
      events: [
        { id: 'exact-id-1', learnerId: 'learner-1', sessionId: 'session-exact-1', eventType: 'hint_view' },
        { id: 'exact-id-2', learnerId: 'learner-1', sessionId: 'session-exact-1', eventType: 'concept_view' },
        { id: 'exact-id-3', learnerId: 'learner-1', sessionId: 'session-exact-1', eventType: 'execution' },
      ],
      total: 3,
    });

    const status = await dualStorageModule.dualStorage.ensureSessionInteractionsPersisted(
      'learner-1',
      'session-exact-1',
    );

    // Should confirm all interactions are persisted since IDs match exactly
    expect(status.backendConfirmed).toBe(true);
    expect(status.pendingSync).toBe(false);
    expect(status.missingInteractionIds).toHaveLength(0);
  });

  it('detects missing interactions when backend returns different ids', async () => {
    // Save interaction locally with known ID
    dualStorageModule.dualStorage.saveInteraction({
      id: 'local-id-abc',
      learnerId: 'learner-1',
      sessionId: 'session-missing-1',
      timestamp: 1_700_000_000_000,
      eventType: 'hint_view',
      problemId: 'problem-1',
      hintId: 'hint-1',
    });

    logInteractionsBatchMock.mockClear();

    // Backend returns same interaction data but with DIFFERENT ID (this was the bug)
    getInteractionsMock.mockResolvedValueOnce({
      events: [
        {
          id: 'backend-generated-different-id',
          learnerId: 'learner-1',
          sessionId: 'session-missing-1',
          eventType: 'hint_view',
          hintId: 'hint-1',
        },
      ],
      total: 1,
    });

    logInteractionsBatchMock.mockResolvedValueOnce(true);

    const status = await dualStorageModule.dualStorage.ensureSessionInteractionsPersisted(
      'learner-1',
      'session-missing-1',
    );

    // Should detect that local-id-abc is missing from backend
    // With ID preservation fix, backend should return same ID; without it, this syncs the missing event
    expect(logInteractionsBatchMock).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ id: 'local-id-abc' })]),
    );
  });

  // RESEARCH-4: Logout session finalization barrier tests
  it('finalizes the latest real session when active session storage has the sentinel', async () => {
    localStorage.setItem('sql-learning-active-session', 'session-unknown');
    dualStorageModule.dualStorage.saveInteraction({
      id: 'exec-sentinel-1',
      learnerId: 'learner-1',
      sessionId: 'session-real-1',
      timestamp: 1_700_000_000_000,
      eventType: 'execution',
      problemId: 'problem-1',
      successful: true,
    });
    logInteractionMock.mockClear();

    getInteractionsMock.mockResolvedValueOnce({
      events: [
        {
          id: 'exec-sentinel-1',
          learnerId: 'learner-1',
          sessionId: 'session-real-1',
          timestamp: 1_700_000_000_000,
          eventType: 'execution',
          problemId: 'problem-1',
          successful: true,
        },
      ],
      total: 1,
    });

    const status = await dualStorageModule.dualStorage.finalizeActiveSessionBeforeLogout('learner-1');

    expect(status).toEqual({ backendConfirmed: true, pendingSync: false });
    expect(localStorage.getItem('sql-learning-active-session')).toBe('session-real-1');
    expect(logInteractionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'session-end:session-real-1',
        learnerId: 'learner-1',
        sessionId: 'session-real-1',
        eventType: 'session_end',
      }),
    );
  });

  it('returns confirmed when no active session exists', async () => {
    // Ensure no active session
    localStorage.removeItem('sql-adapt-session-id');

    const status = await dualStorageModule.dualStorage.finalizeActiveSessionBeforeLogout('learner-1');

    expect(status.backendConfirmed).toBe(true);
    expect(status.pendingSync).toBe(false);
  });

  it('does not fetch backend profile data from synchronous getters', () => {
    const localProfile = createBackendProfile({
      solvedProblemIds: new Set(['problem-2']),
    });
    dualStorageModule.dualStorage.saveProfile(localProfile);

    getProfileMock.mockClear();
    const immediateProfile = dualStorageModule.dualStorage.getProfile('learner-1');

    expect(immediateProfile?.solvedProblemIds.has('problem-2')).toBe(true);
    expect(getProfileMock).not.toHaveBeenCalled();
  });

  it('keeps saveUserProfile local-only in backend account mode', () => {
    const profile = {
      id: 'learner-1',
      name: 'Learner 1',
      role: 'student' as const,
      createdAt: 1_700_000_000_000,
    };

    dualStorageModule.dualStorage.saveUserProfile(profile);

    expect(createLearnerMock).not.toHaveBeenCalled();
    expect(dualStorageModule.dualStorage.getUserProfile()).toEqual(profile);
  });
});

describe('dual-storage authenticated sync ownership', () => {
  const ownerA = 'v1:["account-A","learner-shared"]';
  const ownerB = 'v1:["account-B","learner-shared"]';

  function readQueue(): Array<Record<string, unknown>> {
    return JSON.parse(localStorage.getItem('sql-adapt-offline-queue') ?? '[]');
  }

  it('normalizes the active session before creating a durable helper-event envelope', async () => {
    const request = deferred<{ success: boolean; confirmed?: boolean }>();
    logInteractionMock.mockReturnValueOnce(request.promise);
    await dualStorageModule.dualStorage.checkHealth();
    dualStorageModule.dualStorage.setActiveSessionId('session-normalized-before-pending');
    const sendInteractionToBackend = (
      dualStorageModule.dualStorage as unknown as {
        sendInteractionToBackend(event: InteractionEvent, source: string): void;
      }
    ).sendInteractionToBackend.bind(dualStorageModule.dualStorage);

    sendInteractionToBackend({
      id: 'normalize-before-pending',
      learnerId: 'learner-1',
      sessionId: '',
      timestamp: 1_700_000_000_000,
      eventType: 'error',
      problemId: 'problem-normalized-before-pending',
    }, 'normalization regression');

    expect(JSON.parse(localStorage.getItem('sql-adapt-pending-interactions') ?? '[]')).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'normalize-before-pending',
          sessionId: 'session-normalized-before-pending',
          event: expect.objectContaining({ sessionId: 'session-normalized-before-pending' }),
        }),
      ]),
    );
    expect(logInteractionMock).toHaveBeenCalledWith(
      expect.objectContaining({ sessionId: 'session-normalized-before-pending' }),
    );
    request.resolve({ success: false, confirmed: false });
    await new Promise((resolve) => setTimeout(resolve, 0));
  });

  it('does not send a critical textbook write unless its retry envelope persists', async () => {
    await dualStorageModule.dualStorage.checkHealth();
    const original = localStorage.setItem.bind(localStorage);
    const setItem = vi.spyOn(localStorage, 'setItem').mockImplementation((key, value) => {
      if (key === 'sql-adapt-offline-queue') {
        throw new DOMException('textbook queue blocked', 'QuotaExceededError');
      }
      return original(key, value);
    });

    const write = await dualStorageModule.dualStorage.saveTextbookUnitCritical('learner-1', {
      id: 'unit-proof-required',
      type: 'hint',
      conceptId: 'joins',
      title: 'Proof required',
      content: 'Durable before send',
      prerequisites: [],
      sourceInteractionIds: [],
      addedTimestamp: 1_700_000_000_000,
    });
    setItem.mockRestore();

    expect(write.status).toMatchObject({ backendConfirmed: false, pendingSync: false });
    expect(write.status.error).toContain('retry');
    expect(saveTextbookUnitMock).not.toHaveBeenCalled();
  });

  it('does not send a critical session write unless its retry envelope persists', async () => {
    await dualStorageModule.dualStorage.checkHealth();
    const original = localStorage.setItem.bind(localStorage);
    const setItem = vi.spyOn(localStorage, 'setItem').mockImplementation((key, value) => {
      if (key === 'sql-adapt-offline-queue') {
        throw new DOMException('session queue blocked', 'QuotaExceededError');
      }
      return original(key, value);
    });

    const status = await dualStorageModule.dualStorage.ensureSessionPersisted(
      'learner-1',
      'session-proof-required',
    );
    setItem.mockRestore();

    expect(status).toMatchObject({ backendConfirmed: false, pendingSync: false });
    expect(status.error).toContain('retry');
    expect(saveSessionMock).not.toHaveBeenCalled();
  });

  it('retains two noncritical retry envelopes created in the same millisecond', () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date('2026-08-06T22:00:00.000Z'));
      dualStorageModule.setActiveSyncPrincipal(null);
      const unit = {
        id: 'same-ms-unit',
        type: 'hint' as const,
        conceptId: 'joins',
        title: 'Same millisecond',
        content: 'Both retries are durable.',
        prerequisites: [],
        sourceInteractionIds: [],
        addedTimestamp: Date.now(),
      };

      dualStorageModule.dualStorage.saveTextbookUnit('learner-same-ms', unit);
      dualStorageModule.dualStorage.saveTextbookUnit('learner-same-ms', unit);

      const retries = readQueue().filter((item) =>
        item.type === 'textbookUnit' &&
        (item.data as { unit?: { id?: string } } | undefined)?.unit?.id === unit.id,
      );
      expect(retries).toHaveLength(2);
      expect(new Set(retries.map((item) => item.id)).size).toBe(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it('reports a noncritical retry-envelope persistence failure', () => {
    dualStorageModule.setActiveSyncPrincipal(null);
    const original = localStorage.setItem.bind(localStorage);
    const setItem = vi.spyOn(localStorage, 'setItem').mockImplementation((key, value) => {
      if (key === 'sql-adapt-offline-queue') {
        throw new DOMException('background queue blocked', 'QuotaExceededError');
      }
      return original(key, value);
    });
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => dualStorageModule.dualStorage.saveTextbookUnit('learner-background-proof', {
      id: 'background-proof-unit',
      type: 'hint',
      conceptId: 'joins',
      title: 'Background proof',
      content: 'Local copy remains available.',
      prerequisites: [],
      sourceInteractionIds: [],
      addedTimestamp: 1_700_000_000_000,
    })).not.toThrow();
    setItem.mockRestore();

    expect(consoleError).toHaveBeenCalledWith(
      '[DualStorage] Textbook retry envelope could not be persisted.',
    );
    expect(saveTextbookUnitMock).not.toHaveBeenCalled();
    consoleError.mockRestore();
  });

  it('keeps local writes durable but sends nothing while the principal is null', async () => {
    dualStorageModule.setActiveSyncPrincipal(null);

    const status = await dualStorageModule.dualStorage.saveInteractionCritical({
      id: 'owner-null-event',
      learnerId: 'learner-null-only',
      sessionId: 'session-owner-null',
      timestamp: 1_700_000_000_000,
      eventType: 'execution',
      problemId: 'problem-owner-null',
      successful: true,
    });

    expect(status).toMatchObject({ backendConfirmed: false, pendingSync: true });
    expect(logInteractionMock).not.toHaveBeenCalled();
    expect(logInteractionsBatchVerifiedMock).not.toHaveBeenCalled();
    expect(checkBackendHealthMock).not.toHaveBeenCalled();
    expect(dualStorageModule.dualStorage.getAllInteractions()).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: 'owner-null-event' })]),
    );
    const queued = readQueue().find((item) => item.id === 'owner-null-event');
    expect(queued).toBeTruthy();
    expect(Object.prototype.hasOwnProperty.call(queued ?? {}, 'syncOwnerId')).toBe(false);
  });

  it('processes and removes only the active owner when event ids collide', async () => {
    checkBackendHealthMock.mockResolvedValue(false);

    dualStorageModule.setActiveSyncPrincipal({ accountId: 'account-A', learnerId: 'learner-shared' });
    await dualStorageModule.dualStorage.saveInteractionCritical({
      id: 'owner-collision-event',
      learnerId: 'learner-shared',
      sessionId: 'session-owner-A',
      timestamp: 1_700_000_000_000,
      eventType: 'execution',
      problemId: 'problem-A',
      successful: true,
    });

    dualStorageModule.setActiveSyncPrincipal({ accountId: 'account-B', learnerId: 'learner-shared' });
    await dualStorageModule.dualStorage.saveInteractionCritical({
      id: 'owner-collision-event',
      learnerId: 'learner-shared',
      sessionId: 'session-owner-B',
      timestamp: 1_700_000_001_000,
      eventType: 'execution',
      problemId: 'problem-B',
      successful: false,
    });

    let collisionQueue = readQueue().filter((item) => item.id === 'owner-collision-event');
    expect(collisionQueue.map((item) => item.syncOwnerId)).toEqual([ownerA, ownerB]);

    checkBackendHealthMock.mockResolvedValue(true);
    dualStorageModule.setActiveSyncPrincipal({ accountId: 'account-A', learnerId: 'learner-shared' });
    await dualStorageModule.dualStorage.processOfflineQueue();

    expect(logInteractionsBatchVerifiedMock).toHaveBeenCalledTimes(1);
    const sentEvents = logInteractionsBatchVerifiedMock.mock.calls[0][0] as Array<Record<string, unknown>>;
    expect(sentEvents).toEqual([
      expect.objectContaining({ id: 'owner-collision-event', problemId: 'problem-A' }),
    ]);
    expect(sentEvents[0]).not.toHaveProperty('syncOwnerId');

    collisionQueue = readQueue().filter((item) => item.id === 'owner-collision-event');
    expect(collisionQueue).toEqual([
      expect.objectContaining({ syncOwnerId: ownerB }),
    ]);
  });

  it('stops a queued write batch when the authenticated owner changes mid-flight', async () => {
    dualStorageModule.setActiveSyncPrincipal({ accountId: 'account-A', learnerId: 'learner-shared' });
    checkBackendHealthMock.mockResolvedValue(false);
    await dualStorageModule.dualStorage.checkHealth();

    dualStorageModule.dualStorage.saveProfile(createBackendProfile({
      id: 'owner-switch-profile-1',
      name: 'Owner switch 1',
    }));
    dualStorageModule.dualStorage.saveProfile(createBackendProfile({
      id: 'owner-switch-profile-2',
      name: 'Owner switch 2',
    }));

    checkBackendHealthMock.mockResolvedValue(true);
    saveProfileMock.mockImplementationOnce(async () => {
      dualStorageModule.setActiveSyncPrincipal({ accountId: 'account-B', learnerId: 'learner-shared' });
      return true;
    });

    await dualStorageModule.dualStorage.processOfflineQueue();

    expect(saveProfileMock).toHaveBeenCalledTimes(1);
    expect(readQueue()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'profile',
          syncOwnerId: ownerA,
          data: expect.objectContaining({ id: 'owner-switch-profile-2' }),
        }),
      ]),
    );
  });

  it('preserves local interaction collisions across owners during hydration', async () => {
    const learnerId = 'learner-shared';
    await dualStorageModule.dualStorage.checkHealth();
    dualStorageModule.setActiveSyncPrincipal({ accountId: 'account-A', learnerId });
    dualStorageModule.dualStorage.saveInteraction({
      id: 'hydrate-owner-collision',
      learnerId,
      sessionId: 'session-hydrate-A',
      timestamp: 1_700_000_000_000,
      eventType: 'execution',
      problemId: 'problem-hydrate-A',
      successful: true,
    });
    await vi.waitFor(() => {
      const confirmed = JSON.parse(
        localStorage.getItem('sql-adapt-pending-confirmed') ?? '[]',
      ) as Array<{ id?: string }>;
      expect(confirmed.filter((item) => item.id === 'hydrate-owner-collision')).toHaveLength(1);
    });
    dualStorageModule.setActiveSyncPrincipal({ accountId: 'account-B', learnerId });
    dualStorageModule.dualStorage.saveInteraction({
      id: 'hydrate-owner-collision',
      learnerId,
      sessionId: 'session-hydrate-B',
      timestamp: 1_700_000_001_000,
      eventType: 'execution',
      problemId: 'problem-hydrate-B',
      successful: false,
    });
    await vi.waitFor(() => {
      const confirmed = JSON.parse(
        localStorage.getItem('sql-adapt-pending-confirmed') ?? '[]',
      ) as Array<{ id?: string }>;
      expect(confirmed.filter((item) => item.id === 'hydrate-owner-collision')).toHaveLength(2);
    });
    getInteractionsMock.mockResolvedValueOnce({
      events: [{
        id: 'hydrate-owner-collision',
        learnerId,
        sessionId: 'session-hydrate-B',
        timestamp: 1_700_000_001_000,
        eventType: 'execution',
        problemId: 'problem-hydrate-B',
        successful: false,
      }],
      total: 1,
    });

    await dualStorageModule.dualStorage.hydrateLearner(learnerId, { force: true });
    await vi.waitFor(() => expect(getInteractionsMock).toHaveBeenCalledWith(learnerId, { limit: 5000 }));
    await new Promise((resolve) => setTimeout(resolve, 0));

    const collisions = dualStorageModule.dualStorage
      .getAllInteractions()
      .filter((event) => event.id === 'hydrate-owner-collision');
    expect(collisions).toHaveLength(2);
    expect(collisions.map((event) => event.problemId)).toEqual([
      'problem-hydrate-A',
      'problem-hydrate-B',
    ]);
  });

  it('stamps exact-self legacy ownership before sending and leaves other legacy learners local', async () => {
    checkBackendHealthMock.mockResolvedValue(false);
    dualStorageModule.setActiveSyncPrincipal(null);

    await dualStorageModule.dualStorage.saveInteractionCritical({
      id: 'legacy-exact-self',
      learnerId: 'learner-shared',
      sessionId: 'session-legacy-self',
      timestamp: 1_700_000_000_000,
      eventType: 'error',
      problemId: 'problem-self',
      error: 'self error',
    });
    await dualStorageModule.dualStorage.saveInteractionCritical({
      id: 'legacy-selected-student',
      learnerId: 'student-selected',
      sessionId: 'session-selected-student',
      timestamp: 1_700_000_001_000,
      eventType: 'error',
      problemId: 'problem-selected',
      error: 'selected error',
    });

    checkBackendHealthMock.mockResolvedValue(true);
    logInteractionsBatchVerifiedMock.mockImplementationOnce(async (events: unknown[]) => {
      const persisted = readQueue().find((item) => item.id === 'legacy-exact-self');
      expect(persisted?.syncOwnerId).toBe(ownerA);
      const ids = events.map((event) => String((event as { id: string }).id));
      return { confirmed: ids, failed: [] };
    });
    dualStorageModule.setActiveSyncPrincipal({ accountId: 'account-A', learnerId: 'learner-shared' });
    await dualStorageModule.dualStorage.processOfflineQueue();

    expect(logInteractionsBatchVerifiedMock).toHaveBeenCalledWith([
      expect.objectContaining({ id: 'legacy-exact-self' }),
    ]);
    expect(readQueue()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'legacy-selected-student' }),
      ]),
    );
    const selected = readQueue().find((item) => item.id === 'legacy-selected-student');
    expect(Object.prototype.hasOwnProperty.call(selected ?? {}, 'syncOwnerId')).toBe(false);
  });

  it('gates manual, keepalive, reconciliation, and pending session-end sends without a principal', async () => {
    checkBackendHealthMock.mockResolvedValue(false);
    dualStorageModule.setActiveSyncPrincipal({ accountId: 'account-A', learnerId: 'learner-shared' });
    await dualStorageModule.dualStorage.saveInteractionCritical({
      id: 'owner-gated-event',
      learnerId: 'learner-shared',
      sessionId: 'session-owner-gated',
      timestamp: 1_700_000_000_000,
      eventType: 'execution',
      problemId: 'problem-gated',
      successful: true,
    });
    dualStorageModule.dualStorage.queueSessionEnd({
      id: 'owner-gated-session-end',
      learnerId: 'learner-shared',
      sessionId: 'session-owner-gated',
      timestamp: 1_700_000_001_000,
      eventType: 'session_end',
      problemId: 'problem-gated',
    });

    checkBackendHealthMock.mockResolvedValue(true);
    checkBackendHealthMock.mockClear();
    dualStorageModule.setActiveSyncPrincipal(null);
    await dualStorageModule.dualStorage.processOfflineQueue();
    await dualStorageModule.dualStorage.flushWithKeepalive('session-owner-gated');
    await dualStorageModule.dualStorage.flushPendingSessionEnds();
    await dualStorageModule.dualStorage.ensureSessionInteractionsPersisted(
      'learner-shared',
      'session-owner-gated',
    );

    expect(checkBackendHealthMock).not.toHaveBeenCalled();
    expect(logInteractionMock).not.toHaveBeenCalled();
    expect(logInteractionsBatchMock).not.toHaveBeenCalled();
    expect(logInteractionsBatchVerifiedMock).not.toHaveBeenCalled();
    expect(logInteractionsBatchKeepaliveMock).not.toHaveBeenCalled();
    expect(getInteractionsMock).not.toHaveBeenCalled();
    expect(localStorage.getItem('sql-adapt-pending-session-ends')).toContain('owner-gated-session-end');
  });

  it('tags newly created instructor-selected records to the instructor owner', async () => {
    dualStorageModule.setActiveSyncPrincipal({
      accountId: 'instructor-account',
      learnerId: 'instructor-learner',
    });

    await dualStorageModule.dualStorage.saveInteractionCritical({
      id: 'instructor-selected-new',
      learnerId: 'selected-student',
      sessionId: 'session-selected-new',
      timestamp: 1_700_000_000_000,
      eventType: 'profile_adjusted',
      problemId: 'problem-selected',
    });

    expect(logInteractionMock).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'instructor-selected-new', learnerId: 'selected-student' }),
    );
    expect(logInteractionMock.mock.calls[0][0]).not.toHaveProperty('syncOwnerId');
    const confirmed = JSON.parse(localStorage.getItem('sql-adapt-pending-confirmed') ?? '[]') as Array<Record<string, unknown>>;
    expect(confirmed).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'instructor-selected-new',
          syncOwnerId: 'v1:["instructor-account","instructor-learner"]',
        }),
      ]),
    );
  });

  it('keeps profile, textbook, and session writes local and queued while unauthenticated', async () => {
    dualStorageModule.setActiveSyncPrincipal(null);
    const profile = createBackendProfile({ id: 'owner-null-profile' });
    const unit = {
      id: 'owner-null-unit',
      type: 'hint' as const,
      conceptId: 'select-basic',
      conceptIds: ['select-basic'],
      title: 'Owner-safe unit',
      content: 'Local only',
      contentFormat: 'markdown' as const,
      sourceInteractionIds: [],
      status: 'primary' as const,
      prerequisites: [],
      addedTimestamp: 1_700_000_000_000,
    };

    dualStorageModule.dualStorage.saveProfile(profile);
    dualStorageModule.dualStorage.updateProfileFromEvent('owner-null-profile', {
      id: 'owner-null-profile-event',
      learnerId: 'owner-null-profile',
      sessionId: 'owner-null-profile-session',
      timestamp: 1_700_000_000_100,
      eventType: 'error',
      problemId: 'problem-owner-null-profile',
      errorSubtypeId: 'syntax',
    });
    dualStorageModule.dualStorage.saveTextbookUnit('owner-null-profile', unit);
    dualStorageModule.dualStorage.saveTextbookUnitV2('owner-null-profile', {
      conceptIds: ['joins'],
      type: 'hint',
      title: 'Owner-safe V2 unit',
      content: 'Local V2 only',
      sourceInteractionIds: [],
    });
    const criticalTextbook = await dualStorageModule.dualStorage.saveTextbookUnitCritical(
      'owner-null-profile',
      { ...unit, id: 'owner-null-unit-critical' },
    );
    dualStorageModule.dualStorage.startSession('owner-null-profile');
    const sessionStatus = await dualStorageModule.dualStorage.ensureSessionPersisted(
      'owner-null-profile',
      'owner-null-session',
    );

    expect(sessionStatus).toMatchObject({ backendConfirmed: false, pendingSync: true });
    expect(criticalTextbook.status).toMatchObject({ backendConfirmed: false, pendingSync: true });
    expect(checkBackendHealthMock).not.toHaveBeenCalled();
    expect(saveProfileMock).not.toHaveBeenCalled();
    expect(saveTextbookUnitMock).not.toHaveBeenCalled();
    expect(saveSessionMock).not.toHaveBeenCalled();
    expect(readQueue()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'profile' }),
        expect.objectContaining({
          type: 'profile',
          data: expect.objectContaining({
            interactionCount: 1,
            conceptsCovered: [],
            errorHistory: [['syntax', 1]],
          }),
        }),
        expect.objectContaining({ type: 'textbookUnit' }),
        expect.objectContaining({
          type: 'textbookUnit',
          data: expect.objectContaining({
            unit: expect.objectContaining({ title: 'Owner-safe V2 unit' }),
          }),
        }),
        expect.objectContaining({ type: 'session' }),
      ]),
    );
    for (const item of readQueue().filter((entry) =>
      ['profile', 'textbookUnit', 'session'].includes(String(entry.type)),
    )) {
      expect(Object.prototype.hasOwnProperty.call(item, 'syncOwnerId')).toBe(false);
    }
  });

  it('blocks explicit learner and instructor hydration while no sync principal is active', async () => {
    dualStorageModule.setActiveSyncPrincipal(null);

    await expect(dualStorageModule.dualStorage.hydrateLearner('learner-no-owner', { force: true })).resolves.toBe(false);
    await expect(dualStorageModule.dualStorage.getBackendSessionSnapshot('learner-no-owner')).resolves.toBeNull();
    await expect(dualStorageModule.dualStorage.hydrateInstructorDashboard()).resolves.toMatchObject({
      ok: false,
      error: 'auth',
    });

    expect(checkBackendHealthMock).not.toHaveBeenCalled();
    expect(getProfileMock).not.toHaveBeenCalled();
    expect(getSessionMock).not.toHaveBeenCalled();
    expect(getInteractionsMock).not.toHaveBeenCalled();
  });

  it('does not send or remove a queued session end when the owner changes after reconciliation', async () => {
    const event: InteractionEvent = {
      id: 'session-end-owner-race',
      learnerId: 'learner-shared',
      sessionId: 'session-owner-race',
      timestamp: 1_700_000_000_000,
      eventType: 'session_end',
      problemId: 'problem-owner-race',
    };
    dualStorageModule.setActiveSyncPrincipal({ accountId: 'account-A', learnerId: 'learner-shared' });
    dualStorageModule.dualStorage.queueSessionEnd(event);
    const pending = JSON.parse(
      localStorage.getItem('sql-adapt-pending-session-ends') ?? '[]',
    ) as Array<Record<string, unknown>>;
    const reconciliation = vi
      .spyOn(dualStorageModule.dualStorage, 'ensureSessionInteractionsPersisted')
      .mockResolvedValue({ backendConfirmed: true, pendingSync: false, missingInteractionIds: [] });
    const health = deferred<boolean>();
    checkBackendHealthMock.mockReturnValueOnce(health.promise);

    const write = (
      dualStorageModule.dualStorage as unknown as {
        writeQueuedSessionEnd(item: Record<string, unknown>): Promise<{ backendConfirmed: boolean; pendingSync: boolean }>;
      }
    ).writeQueuedSessionEnd(pending[0]);
    await vi.waitFor(() => expect(checkBackendHealthMock).toHaveBeenCalled());
    dualStorageModule.setActiveSyncPrincipal({ accountId: 'account-B', learnerId: 'learner-shared' });
    health.resolve(true);

    await expect(write).resolves.toMatchObject({ backendConfirmed: false, pendingSync: true });
    expect(logInteractionMock).not.toHaveBeenCalled();
    expect(localStorage.getItem('sql-adapt-pending-session-ends')).toContain('session-end-owner-race');
    reconciliation.mockRestore();
  });

  it('does not batch or confirm reconciliation records after an owner switch', async () => {
    const learnerId = 'learner-shared';
    const sessionId = 'session-reconcile-race';
    dualStorageModule.setActiveSyncPrincipal({ accountId: 'account-A', learnerId });
    await dualStorageModule.dualStorage.checkHealth();
    logInteractionMock.mockImplementationOnce(() => new Promise(() => undefined));
    dualStorageModule.dualStorage.saveInteraction({
      id: 'reconcile-owner-race',
      learnerId,
      sessionId,
      timestamp: 1_700_000_000_000,
      eventType: 'hint_view',
      problemId: 'problem-reconcile-race',
      hintId: 'hint-race',
    });
    const snapshot = deferred<{ events: unknown[]; total: number }>();
    getInteractionsMock.mockReturnValueOnce(snapshot.promise);

    const reconciliation = dualStorageModule.dualStorage.ensureSessionInteractionsPersisted(learnerId, sessionId);
    await vi.waitFor(() => expect(getInteractionsMock).toHaveBeenCalledWith(learnerId, { sessionId, limit: 5000 }));
    dualStorageModule.setActiveSyncPrincipal({ accountId: 'account-B', learnerId });
    snapshot.resolve({ events: [], total: 0 });

    await expect(reconciliation).resolves.toMatchObject({ backendConfirmed: false, pendingSync: true });
    expect(logInteractionsBatchMock).not.toHaveBeenCalled();
    expect(localStorage.getItem('sql-adapt-pending-interactions')).toContain('reconcile-owner-race');
  });

  it('retains pending verification records when the owner switches during keepalive', async () => {
    const learnerId = 'learner-shared';
    const sessionId = 'session-keepalive-race';
    dualStorageModule.setActiveSyncPrincipal({ accountId: 'account-A', learnerId });
    checkBackendHealthMock.mockResolvedValueOnce(false);
    await dualStorageModule.dualStorage.saveInteractionCritical({
      id: 'keepalive-owner-race',
      learnerId,
      sessionId,
      timestamp: 1_700_000_000_000,
      eventType: 'hint_view',
      problemId: 'problem-keepalive-race',
      hintId: 'hint-race',
    });
    const keepalive = deferred<{ success: boolean; confirmedIds?: string[] }>();
    logInteractionsBatchKeepaliveMock.mockReturnValueOnce(keepalive.promise);

    const flush = dualStorageModule.dualStorage.flushPendingWithVerification(sessionId);
    await vi.waitFor(() => expect(logInteractionsBatchKeepaliveMock).toHaveBeenCalledTimes(1));
    dualStorageModule.setActiveSyncPrincipal({ accountId: 'account-B', learnerId });
    keepalive.resolve({ success: true, confirmedIds: ['keepalive-owner-race'] });

    await expect(flush).resolves.toMatchObject({ error: expect.stringContaining('account') });
    expect(logInteractionsBatchKeepaliveMock).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem('sql-adapt-pending-interactions')).toContain('keepalive-owner-race');
  });

  it('does not accept a stale interaction confirmation after an A-to-B-to-A principal cycle', async () => {
    const learnerId = 'learner-shared';
    const request = deferred<{ success: boolean; confirmed?: boolean }>();
    logInteractionMock.mockReturnValueOnce(request.promise);
    dualStorageModule.setActiveSyncPrincipal({ accountId: 'account-A', learnerId });

    const write = dualStorageModule.dualStorage.saveInteractionCritical({
      id: 'interaction-aba-race',
      learnerId,
      sessionId: 'session-interaction-aba',
      timestamp: 1_700_000_000_000,
      eventType: 'error',
      problemId: 'problem-interaction-aba',
      error: 'stale confirmation',
    });
    await vi.waitFor(() => expect(logInteractionMock).toHaveBeenCalledTimes(1));
    dualStorageModule.setActiveSyncPrincipal({ accountId: 'account-B', learnerId });
    dualStorageModule.setActiveSyncPrincipal({ accountId: 'account-A', learnerId });
    request.resolve({ success: true, confirmed: true });

    await expect(write).resolves.toMatchObject({
      backendConfirmed: false,
      pendingSync: true,
      error: expect.stringContaining('account changed'),
    });
    expect(localStorage.getItem('sql-adapt-pending-interactions')).toContain('interaction-aba-race');
    expect(localStorage.getItem('sql-adapt-pending-confirmed') ?? '').not.toContain('interaction-aba-race');
  });

  it('does not accept a stale textbook confirmation after an A-to-B-to-A principal cycle', async () => {
    const learnerId = 'learner-shared';
    const request = deferred<boolean>();
    saveTextbookUnitMock.mockReturnValueOnce(request.promise);
    dualStorageModule.setActiveSyncPrincipal({ accountId: 'account-A', learnerId });

    const write = dualStorageModule.dualStorage.saveTextbookUnitCritical(learnerId, {
      id: 'textbook-aba-race',
      type: 'hint',
      conceptId: 'joins',
      conceptIds: ['joins'],
      title: 'Stale textbook confirmation',
      content: 'This response belongs to the earlier authentication epoch.',
      contentFormat: 'markdown',
      sourceInteractionIds: [],
      status: 'primary',
      prerequisites: [],
      addedTimestamp: 1_700_000_000_000,
    });
    await vi.waitFor(() => expect(saveTextbookUnitMock).toHaveBeenCalledTimes(1));
    dualStorageModule.setActiveSyncPrincipal({ accountId: 'account-B', learnerId });
    dualStorageModule.setActiveSyncPrincipal({ accountId: 'account-A', learnerId });
    request.resolve(true);

    await expect(write).resolves.toMatchObject({
      status: {
        backendConfirmed: false,
        pendingSync: true,
        error: expect.stringContaining('account changed'),
      },
    });
    expect(readQueue()).toEqual(expect.arrayContaining([
      expect.objectContaining({
        type: 'textbookUnit',
        syncOwnerId: ownerA,
        data: expect.objectContaining({ learnerId }),
      }),
    ]));
  });

  it('does not accept a stale session confirmation after an A-to-B-to-A principal cycle', async () => {
    const learnerId = 'learner-shared';
    const request = deferred<boolean>();
    saveSessionMock.mockReturnValueOnce(request.promise);
    dualStorageModule.setActiveSyncPrincipal({ accountId: 'account-A', learnerId });

    const write = dualStorageModule.dualStorage.ensureSessionPersisted(
      learnerId,
      'session-aba-race',
    );
    await vi.waitFor(() => expect(saveSessionMock).toHaveBeenCalledTimes(1));
    dualStorageModule.setActiveSyncPrincipal({ accountId: 'account-B', learnerId });
    dualStorageModule.setActiveSyncPrincipal({ accountId: 'account-A', learnerId });
    request.resolve(true);

    await expect(write).resolves.toMatchObject({
      backendConfirmed: false,
      pendingSync: true,
      error: expect.stringContaining('account changed'),
    });
    expect(readQueue()).toEqual(expect.arrayContaining([
      expect.objectContaining({
        type: 'session',
        syncOwnerId: ownerA,
        data: expect.objectContaining({ learnerId }),
      }),
    ]));
  });

  it('discards a backend session snapshot after the owner changes in flight', async () => {
    const session = deferred<Record<string, unknown> | null>();
    getSessionMock.mockReturnValueOnce(session.promise);
    dualStorageModule.setActiveSyncPrincipal({ accountId: 'account-A', learnerId: 'learner-shared' });

    const snapshot = dualStorageModule.dualStorage.getBackendSessionSnapshot('learner-shared');
    await vi.waitFor(() => expect(getSessionMock).toHaveBeenCalledWith('learner-shared'));
    dualStorageModule.setActiveSyncPrincipal({ accountId: 'account-B', learnerId: 'learner-shared' });
    session.resolve({ sessionId: 'session-owner-A' });

    await expect(snapshot).resolves.toBeNull();
  });

  it('does not merge textbook callback data after the owner changes in flight', async () => {
    const textbook = deferred<unknown[]>();
    getTextbookMock.mockReturnValueOnce(textbook.promise);
    dualStorageModule.setActiveSyncPrincipal({ accountId: 'account-A', learnerId: 'learner-shared' });
    await dualStorageModule.dualStorage.checkHealth();

    dualStorageModule.dualStorage.getTextbook('learner-shared');
    await vi.waitFor(() => expect(getTextbookMock).toHaveBeenCalledWith('learner-shared'));
    dualStorageModule.setActiveSyncPrincipal({ accountId: 'account-B', learnerId: 'learner-shared' });
    textbook.resolve([{
      id: 'unit-owner-A',
      type: 'hint',
      conceptId: 'joins',
      conceptIds: ['joins'],
      title: 'Owner A unit',
      content: 'Private owner A content',
      contentFormat: 'markdown',
      sourceInteractionIds: [],
      status: 'primary',
      prerequisites: [],
      addedTimestamp: 1_700_000_000_000,
    }]);
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(localStorage.getItem('sql-learning-textbook') ?? '').not.toContain('unit-owner-A');
  });

  it('does not merge instructor dashboard results after the owner changes in flight', async () => {
    const profiles = deferred<LearnerProfile[]>();
    getAllProfilesMock.mockReturnValueOnce(profiles.promise);
    getInstructorOverviewMock.mockResolvedValueOnce({ sections: [{}] });
    getInstructorLearnersMock.mockResolvedValueOnce([{}]);
    dualStorageModule.setActiveSyncPrincipal({ accountId: 'account-A', learnerId: 'instructor-A' });

    const hydration = dualStorageModule.dualStorage.hydrateInstructorDashboard();
    await vi.waitFor(() => expect(getAllProfilesMock).toHaveBeenCalled());
    dualStorageModule.setActiveSyncPrincipal({ accountId: 'account-B', learnerId: 'instructor-B' });
    profiles.resolve([createBackendProfile({ id: 'student-owner-A', name: 'Owner A student' })]);

    await expect(hydration).resolves.toMatchObject({ ok: false, error: 'auth' });
    expect(dualStorageModule.dualStorage.getProfile('student-owner-A')).toBeNull();
  });

  it('shares one durable pending store so profile confirmation cannot erase another owner pending event', async () => {
    checkBackendHealthMock.mockResolvedValue(false);
    dualStorageModule.setActiveSyncPrincipal({ accountId: 'account-B', learnerId: 'learner-shared' });
    await dualStorageModule.dualStorage.saveInteractionCritical({
      id: 'pending-survives-profile-confirm',
      learnerId: 'learner-shared',
      sessionId: 'session-pending-B',
      timestamp: 1_700_000_000_000,
      eventType: 'hint_view',
      problemId: 'problem-pending-B',
      hintId: 'hint-B',
    });
    dualStorageModule.setActiveSyncPrincipal({ accountId: 'account-A', learnerId: 'learner-shared' });
    dualStorageModule.dualStorage.saveProfile(createBackendProfile({
      id: 'profile-owner-A',
      name: 'Owner A profile',
    }));

    checkBackendHealthMock.mockResolvedValue(true);
    await dualStorageModule.dualStorage.processOfflineQueue();

    expect(localStorage.getItem('sql-adapt-pending-interactions')).toContain('pending-survives-profile-confirm');
  });

  it('does not send a claimed legacy offline item when its owner stamp cannot persist', async () => {
    dualStorageModule.setActiveSyncPrincipal(null);
    checkBackendHealthMock.mockResolvedValueOnce(false);
    await dualStorageModule.dualStorage.saveInteractionCritical({
      id: 'queue-claim-persist-failure',
      learnerId: 'learner-shared',
      sessionId: 'session-queue-claim',
      timestamp: 1_700_000_000_000,
      eventType: 'error',
      problemId: 'problem-queue-claim',
      error: 'legacy queue',
    });
    const original = localStorage.setItem.bind(localStorage);
    let blockedWrites = 0;
    const setItem = vi.spyOn(localStorage, 'setItem').mockImplementation((key, value) => {
      if (key === 'sql-adapt-offline-queue') {
        blockedWrites += 1;
        throw new DOMException('queue write blocked', 'QuotaExceededError');
      }
      return original(key, value);
    });
    dualStorageModule.setActiveSyncPrincipal({ accountId: 'account-A', learnerId: 'learner-shared' });
    const offlineQueue = (
      dualStorageModule.dualStorage as unknown as {
        offlineQueue: { getPending(): unknown[] };
      }
    ).offlineQueue;
    let eligible: unknown[] | undefined;
    let error: unknown;
    try {
      eligible = offlineQueue.getPending();
    } catch (caught) {
      error = caught;
    } finally {
      setItem.mockRestore();
    }

    expect(error).toBeUndefined();
    expect(blockedWrites).toBeGreaterThan(0);
    expect(eligible).toEqual([]);
    expect(logInteractionsBatchVerifiedMock).not.toHaveBeenCalled();
    const queue = JSON.parse(localStorage.getItem('sql-adapt-offline-queue') ?? '[]') as Array<Record<string, unknown>>;
    const item = queue.find((entry) => entry.id === 'queue-claim-persist-failure');
    expect(Object.prototype.hasOwnProperty.call(item ?? {}, 'syncOwnerId')).toBe(false);
  });

  it('does not expose a claimed legacy pending interaction when its owner stamp cannot persist', async () => {
    dualStorageModule.setActiveSyncPrincipal(null);
    checkBackendHealthMock.mockResolvedValueOnce(false);
    await dualStorageModule.dualStorage.saveInteractionCritical({
      id: 'pending-claim-persist-failure',
      learnerId: 'learner-shared',
      sessionId: 'session-pending-claim',
      timestamp: 1_700_000_000_000,
      eventType: 'error',
      problemId: 'problem-pending-claim',
      error: 'legacy pending',
    });
    const original = localStorage.setItem.bind(localStorage);
    let blockedWrites = 0;
    const setItem = vi.spyOn(localStorage, 'setItem').mockImplementation((key, value) => {
      if (key === 'sql-adapt-pending-interactions') {
        blockedWrites += 1;
        throw new DOMException('pending write blocked', 'QuotaExceededError');
      }
      return original(key, value);
    });
    dualStorageModule.setActiveSyncPrincipal({ accountId: 'account-A', learnerId: 'learner-shared' });

    let result: Awaited<ReturnType<typeof dualStorageModule.dualStorage.flushPendingWithVerification>> | undefined;
    let error: unknown;
    try {
      result = await dualStorageModule.dualStorage.flushPendingWithVerification('session-pending-claim');
    } catch (caught) {
      error = caught;
    } finally {
      setItem.mockRestore();
    }

    expect(error).toBeUndefined();
    expect(blockedWrites).toBeGreaterThan(0);
    expect(result).toMatchObject({ error: expect.any(String) });
    expect(logInteractionsBatchKeepaliveMock).not.toHaveBeenCalled();
    const pending = JSON.parse(localStorage.getItem('sql-adapt-pending-interactions') ?? '[]') as Array<Record<string, unknown>>;
    const item = pending.find((entry) => entry.id === 'pending-claim-persist-failure');
    expect(Object.prototype.hasOwnProperty.call(item ?? {}, 'syncOwnerId')).toBe(false);
  });

  it('does not send a claimed legacy session end when its owner stamp cannot persist', async () => {
    dualStorageModule.setActiveSyncPrincipal(null);
    dualStorageModule.dualStorage.queueSessionEnd({
      id: 'session-claim-persist-failure',
      learnerId: 'learner-shared',
      sessionId: 'session-claim-persist-failure',
      timestamp: 1_700_000_000_000,
      eventType: 'session_end',
      problemId: 'problem-session-claim',
    });
    const original = localStorage.setItem.bind(localStorage);
    let blockedWrites = 0;
    const setItem = vi.spyOn(localStorage, 'setItem').mockImplementation((key, value) => {
      if (key === 'sql-adapt-pending-session-ends') {
        blockedWrites += 1;
        throw new DOMException('session end write blocked', 'QuotaExceededError');
      }
      return original(key, value);
    });
    dualStorageModule.setActiveSyncPrincipal({ accountId: 'account-A', learnerId: 'learner-shared' });

    let result: Awaited<ReturnType<typeof dualStorageModule.dualStorage.flushPendingSessionEnds>> | undefined;
    let error: unknown;
    try {
      result = await dualStorageModule.dualStorage.flushPendingSessionEnds();
    } catch (caught) {
      error = caught;
    } finally {
      setItem.mockRestore();
    }

    expect(error).toBeUndefined();
    expect(blockedWrites).toBeGreaterThan(0);
    expect(result).toMatchObject({ backendConfirmed: false, pendingSync: true });
    expect(logInteractionMock).not.toHaveBeenCalled();
    const pending = JSON.parse(localStorage.getItem('sql-adapt-pending-session-ends') ?? '[]') as Array<Record<string, unknown>>;
    expect(Object.prototype.hasOwnProperty.call(pending[0] ?? {}, 'syncOwnerId')).toBe(false);
  });

  it('keeps absent and malformed same-id pending envelopes distinct across reload and persistence', () => {
    localStorage.setItem('sql-adapt-pending-interactions', JSON.stringify([
      {
        id: 'legacy-malformed-collision',
        event: {
          id: 'legacy-malformed-collision',
          learnerId: 'learner-shared',
          sessionId: 'session-legacy',
          timestamp: 1_700_000_000_000,
          eventType: 'error',
          problemId: 'problem-legacy',
        },
        status: 'backend_pending',
        timestamp: 1_700_000_000_000,
        retryCount: 0,
        sessionId: 'session-legacy',
        eventType: 'error',
      },
      {
        id: 'legacy-malformed-collision',
        event: {
          id: 'legacy-malformed-collision',
          learnerId: 'learner-shared',
          sessionId: 'session-malformed',
          timestamp: 1_700_000_001_000,
          eventType: 'error',
          problemId: 'problem-malformed',
        },
        status: 'backend_pending',
        timestamp: 1_700_000_001_000,
        retryCount: 0,
        sessionId: 'session-malformed',
        eventType: 'error',
        syncOwnerId: { malformed: true },
      },
    ]));
    dualStorageModule.setActiveSyncPrincipal({ accountId: 'account-A', learnerId: 'learner-shared' });
    const PendingStore = (
      dualStorageModule.dualStorage as unknown as { pendingStore: { constructor: new () => {
        getAllPending(): Array<{ event: InteractionEvent }>;
        add(event: InteractionEvent): void;
      } } }
    ).pendingStore.constructor;
    const reloaded = new PendingStore();

    expect(reloaded.getAllPending().map((entry) => entry.event.sessionId)).toEqual(['session-legacy']);
    reloaded.add({
      id: 'persist-trigger',
      learnerId: 'learner-shared',
      sessionId: 'session-trigger',
      timestamp: 1_700_000_002_000,
      eventType: 'error',
      problemId: 'problem-trigger',
    });
    const stored = JSON.parse(localStorage.getItem('sql-adapt-pending-interactions') ?? '[]') as Array<{
      id: string;
      syncOwnerId?: unknown;
    }>;
    expect(stored.filter((entry) => entry.id === 'legacy-malformed-collision')).toHaveLength(2);
    expect(stored.some((entry) => Object.prototype.hasOwnProperty.call(entry, 'syncOwnerId'))).toBe(true);
    expect(stored.some((entry) => !Object.prototype.hasOwnProperty.call(entry, 'syncOwnerId'))).toBe(false);
  });

  it('persists the complete staged collection before exposing a legacy claim over 100 records', () => {
    const target = {
      id: 'legacy-complete-claim',
      event: {
        id: 'legacy-complete-claim',
        learnerId: 'learner-shared',
        sessionId: 'session-complete-claim',
        timestamp: 1_700_000_000_000,
        eventType: 'error',
        problemId: 'problem-complete-claim',
      },
      status: 'backend_pending',
      timestamp: 1_700_000_000_000,
      retryCount: 0,
      sessionId: 'session-complete-claim',
      eventType: 'error',
    };
    const retained = Array.from({ length: 104 }, (_, index) => ({
      id: `other-owner-${index}`,
      event: {
        id: `other-owner-${index}`,
        learnerId: 'learner-shared',
        sessionId: `session-other-${index}`,
        timestamp: 1_700_000_001_000 + index,
        eventType: 'error',
        problemId: `problem-other-${index}`,
      },
      status: 'backend_pending',
      timestamp: 1_700_000_001_000 + index,
      retryCount: 0,
      sessionId: `session-other-${index}`,
      eventType: 'error',
      syncOwnerId: `v1:["other-${index}","learner-shared"]`,
    }));
    localStorage.setItem('sql-adapt-pending-interactions', JSON.stringify([target, ...retained]));
    dualStorageModule.setActiveSyncPrincipal({ accountId: 'account-A', learnerId: 'learner-shared' });
    const PendingStore = (
      dualStorageModule.dualStorage as unknown as { pendingStore: { constructor: new () => {
        getAllPending(): Array<{ id: string; syncOwnerId?: string }>;
      } } }
    ).pendingStore.constructor;
    const store = new PendingStore();

    expect(store.getAllPending()).toEqual([
      expect.objectContaining({ id: target.id, syncOwnerId: ownerA }),
    ]);
    const persisted = JSON.parse(localStorage.getItem('sql-adapt-pending-interactions') ?? '[]') as Array<{
      id: string;
      syncOwnerId?: string;
    }>;
    expect(persisted).toHaveLength(105);
    expect(new Set(persisted.map((item) => item.id)).size).toBe(105);
    expect(persisted.find((item) => item.id === target.id)?.syncOwnerId).toBe(ownerA);
  });

  it.each([
    ['missing', undefined],
    ['different', 'different-event-fingerprint'],
  ])('fails closed when a %s confirmed fingerprint conflicts with a legacy claim', (_label, eventFingerprint) => {
    const rawPending = JSON.stringify([{
      id: 'confirmed-claim-conflict',
      event: {
        id: 'confirmed-claim-conflict',
        learnerId: 'learner-shared',
        sessionId: 'session-legacy-conflict',
        timestamp: 1_700_000_000_000,
        eventType: 'error',
        problemId: 'problem-legacy-conflict',
      },
      status: 'backend_pending',
      timestamp: 1_700_000_000_000,
      retryCount: 0,
      sessionId: 'session-legacy-conflict',
      eventType: 'error',
    }]);
    localStorage.setItem('sql-adapt-pending-interactions', rawPending);
    localStorage.setItem('sql-adapt-pending-confirmed', JSON.stringify([{
      id: 'confirmed-claim-conflict',
      confirmedAt: 1_700_000_100_000,
      syncOwnerId: ownerA,
      ...(eventFingerprint ? { eventFingerprint } : {}),
    }]));
    dualStorageModule.setActiveSyncPrincipal({ accountId: 'account-A', learnerId: 'learner-shared' });
    const PendingStore = (
      dualStorageModule.dualStorage as unknown as { pendingStore: { constructor: new () => {
        getAllPending(): unknown[];
        didLastClaimPersistenceFail(): boolean;
      } } }
    ).pendingStore.constructor;
    const store = new PendingStore();

    expect(store.getAllPending()).toEqual([]);
    expect(store.didLastClaimPersistenceFail()).toBe(true);
    expect(localStorage.getItem('sql-adapt-pending-interactions')).toBe(rawPending);
  });

  it('coordinates an exact legacy queue and pending twin so it is confirmed only once', () => {
    const event = {
      id: 'legacy-exact-twin',
      learnerId: 'learner-shared',
      sessionId: 'session-exact-twin',
      timestamp: 1_700_000_000_000,
      eventType: 'error',
      problemId: 'problem-exact-twin',
    } satisfies InteractionEvent;
    localStorage.setItem('sql-adapt-pending-confirmed', '[]');
    localStorage.setItem('sql-adapt-pending-interactions', JSON.stringify([{
      id: event.id,
      event,
      status: 'backend_pending',
      timestamp: event.timestamp,
      retryCount: 0,
      sessionId: event.sessionId,
      eventType: event.eventType,
    }]));
    localStorage.setItem('sql-adapt-offline-queue', JSON.stringify([{
      id: event.id,
      type: 'interaction',
      data: event,
      retries: 0,
      timestamp: event.timestamp,
      status: 'queued_locally',
      errorCount: 0,
    }]));
    dualStorageModule.setActiveSyncPrincipal({ accountId: 'account-A', learnerId: 'learner-shared' });
    const PendingStore = (
      dualStorageModule.dualStorage as unknown as { pendingStore: { constructor: new () => object } }
    ).pendingStore.constructor;
    const QueueManager = (
      dualStorageModule.dualStorage as unknown as { offlineQueue: { constructor: new (store: object) => {
        getPending(): Array<{ id: string; syncOwnerId?: string }>;
        removeBatch(ids: string[], syncOwnerId?: string): void;
      } } }
    ).offlineQueue.constructor;
    const pendingStore = new PendingStore();
    const queue = new QueueManager(pendingStore);

    expect(queue.getPending()).toEqual([
      expect.objectContaining({ id: event.id, syncOwnerId: ownerA }),
    ]);
    expect(JSON.parse(localStorage.getItem('sql-adapt-pending-interactions') ?? '[]')).toEqual([
      expect.objectContaining({ id: event.id, syncOwnerId: ownerA }),
    ]);
    expect(JSON.parse(localStorage.getItem('sql-adapt-offline-queue') ?? '[]')).toEqual([
      expect.objectContaining({ id: event.id, syncOwnerId: ownerA }),
    ]);

    queue.removeBatch([event.id], ownerA);

    expect(JSON.parse(localStorage.getItem('sql-adapt-pending-interactions') ?? '[]')).toEqual([]);
    const confirmed = JSON.parse(localStorage.getItem('sql-adapt-pending-confirmed') ?? '[]') as Array<{
      eventFingerprint?: string;
    }>;
    expect(confirmed[0]?.eventFingerprint).toEqual(expect.any(String));
    expect(queue.getPending()).toEqual([]);
  });

  it('retains pending and queue sources when confirmed proof cannot persist', () => {
    const event = {
      id: 'confirmation-proof-failure',
      learnerId: 'learner-shared',
      sessionId: 'session-confirmation-proof-failure',
      timestamp: 1_700_000_000_000,
      eventType: 'error',
      problemId: 'problem-confirmation-proof-failure',
    } satisfies InteractionEvent;
    const rawPending = JSON.stringify([{
      id: event.id,
      event,
      status: 'backend_pending',
      timestamp: event.timestamp,
      retryCount: 0,
      sessionId: event.sessionId,
      eventType: event.eventType,
      syncOwnerId: ownerA,
    }]);
    const rawQueue = JSON.stringify([{
      id: event.id,
      type: 'interaction',
      data: event,
      retries: 0,
      timestamp: event.timestamp,
      status: 'queued_locally',
      errorCount: 0,
      syncOwnerId: ownerA,
    }]);
    localStorage.setItem('sql-adapt-pending-confirmed', '[]');
    localStorage.setItem('sql-adapt-pending-interactions', rawPending);
    localStorage.setItem('sql-adapt-offline-queue', rawQueue);
    dualStorageModule.setActiveSyncPrincipal({ accountId: 'account-A', learnerId: 'learner-shared' });
    const PendingStore = (
      dualStorageModule.dualStorage as unknown as { pendingStore: { constructor: new () => object } }
    ).pendingStore.constructor;
    const QueueManager = (
      dualStorageModule.dualStorage as unknown as { offlineQueue: { constructor: new (store: object) => {
        removeBatch(ids: string[], syncOwnerId?: string): void;
      } } }
    ).offlineQueue.constructor;
    const queue = new QueueManager(new PendingStore());
    const original = localStorage.setItem.bind(localStorage);
    const setItem = vi.spyOn(localStorage, 'setItem').mockImplementation((key, value) => {
      if (key === 'sql-adapt-pending-confirmed') {
        throw new DOMException('confirmed proof blocked', 'QuotaExceededError');
      }
      return original(key, value);
    });

    queue.removeBatch([event.id], ownerA);
    setItem.mockRestore();

    expect(localStorage.getItem('sql-adapt-pending-confirmed')).toBe('[]');
    expect(localStorage.getItem('sql-adapt-pending-interactions')).toBe(rawPending);
    expect(localStorage.getItem('sql-adapt-offline-queue')).toBe(rawQueue);
  });

  it('persists a generic payload proof before removing a noninteraction queue item', () => {
    const profile = {
      id: 'learner-shared',
      name: 'Queued profile',
      conceptsCovered: [],
      conceptCoverageEvidence: [],
      errorHistory: [],
      solvedProblemIds: [],
      interactionCount: 0,
      currentStrategy: 'adaptive-medium',
      preferences: { escalationThreshold: 3, aggregationDelay: 5000 },
    };
    const rawQueue = JSON.stringify([{
      id: 'generic-profile-proof',
      type: 'profile',
      data: profile,
      retries: 0,
      timestamp: 1_700_000_000_000,
      status: 'queued_locally',
      errorCount: 0,
      syncOwnerId: ownerA,
    }]);
    localStorage.setItem('sql-adapt-pending-confirmed', '[null]');
    localStorage.setItem('sql-adapt-pending-interactions', '[]');
    localStorage.setItem('sql-adapt-offline-queue', rawQueue);
    dualStorageModule.setActiveSyncPrincipal({ accountId: 'account-A', learnerId: 'learner-shared' });
    const PendingStore = (
      dualStorageModule.dualStorage as unknown as { pendingStore: { constructor: new () => object } }
    ).pendingStore.constructor;
    const QueueManager = (
      dualStorageModule.dualStorage as unknown as { offlineQueue: { constructor: new (store: object) => {
        getPending(): unknown[];
        remove(id: string, syncOwnerId?: string): void;
      } } }
    ).offlineQueue.constructor;
    const queue = new QueueManager(new PendingStore());
    const original = localStorage.setItem.bind(localStorage);
    const setItem = vi.spyOn(localStorage, 'setItem').mockImplementation((key, value) => {
      if (key === 'sql-adapt-offline-queue') {
        throw new DOMException('queue removal blocked', 'QuotaExceededError');
      }
      return original(key, value);
    });

    queue.remove('generic-profile-proof', ownerA);
    setItem.mockRestore();

    expect(localStorage.getItem('sql-adapt-offline-queue')).toBe(rawQueue);
    expect(queue.getPending()).toEqual([]);
    expect(JSON.parse(localStorage.getItem('sql-adapt-pending-confirmed') ?? '[]')).toEqual([
      null,
      expect.objectContaining({
        id: 'generic-profile-proof',
        syncOwnerId: ownerA,
        payloadFingerprint: expect.any(String),
      }),
    ]);
  });

  it('blocks a queue twin behind a malformed same-owner confirmed collision', () => {
    const event = {
      id: 'malformed-confirmed-owner-collision',
      learnerId: 'learner-shared',
      sessionId: 'session-malformed-confirmed-owner-collision',
      timestamp: 1_700_000_000_000,
      eventType: 'error',
      problemId: 'problem-malformed-confirmed-owner-collision',
    } satisfies InteractionEvent;
    const rawConfirmed = JSON.stringify([{
      id: event.id,
      confirmedAt: 'invalid',
      syncOwnerId: ownerA,
      eventFingerprint: 'unknown',
    }]);
    const rawQueue = JSON.stringify([{
      id: event.id,
      type: 'interaction',
      data: event,
      retries: 0,
      timestamp: event.timestamp,
      status: 'queued_locally',
      errorCount: 0,
      syncOwnerId: ownerA,
    }]);
    localStorage.setItem('sql-adapt-pending-confirmed', rawConfirmed);
    localStorage.setItem('sql-adapt-pending-interactions', '[]');
    localStorage.setItem('sql-adapt-offline-queue', rawQueue);
    dualStorageModule.setActiveSyncPrincipal({ accountId: 'account-A', learnerId: 'learner-shared' });
    const PendingStore = (
      dualStorageModule.dualStorage as unknown as { pendingStore: { constructor: new () => object } }
    ).pendingStore.constructor;
    const QueueManager = (
      dualStorageModule.dualStorage as unknown as { offlineQueue: { constructor: new (store: object) => {
        getPending(): unknown[];
      } } }
    ).offlineQueue.constructor;

    expect(new QueueManager(new PendingStore()).getPending()).toEqual([]);
    expect(localStorage.getItem('sql-adapt-pending-confirmed')).toBe(rawConfirmed);
    expect(localStorage.getItem('sql-adapt-offline-queue')).toBe(rawQueue);
  });

  it('rolls back a staged pending twin claim when queue ownership cannot persist', () => {
    const event = {
      id: 'two-store-claim-rollback',
      learnerId: 'learner-shared',
      sessionId: 'session-two-store-claim-rollback',
      timestamp: 1_700_000_000_000,
      eventType: 'error',
      problemId: 'problem-two-store-claim-rollback',
    } satisfies InteractionEvent;
    const rawPending = JSON.stringify([{
      id: event.id,
      event,
      status: 'backend_pending',
      timestamp: event.timestamp,
      retryCount: 0,
      sessionId: event.sessionId,
      eventType: event.eventType,
    }]);
    const rawQueue = JSON.stringify([{
      id: event.id,
      type: 'interaction',
      data: event,
      retries: 0,
      timestamp: event.timestamp,
      status: 'queued_locally',
      errorCount: 0,
    }]);
    localStorage.setItem('sql-adapt-pending-confirmed', '[]');
    localStorage.setItem('sql-adapt-pending-interactions', rawPending);
    localStorage.setItem('sql-adapt-offline-queue', rawQueue);
    dualStorageModule.setActiveSyncPrincipal({ accountId: 'account-A', learnerId: 'learner-shared' });
    const PendingStore = (
      dualStorageModule.dualStorage as unknown as { pendingStore: { constructor: new () => object } }
    ).pendingStore.constructor;
    const QueueManager = (
      dualStorageModule.dualStorage as unknown as { offlineQueue: { constructor: new (store: object) => {
        getPending(): unknown[];
      } } }
    ).offlineQueue.constructor;
    const queue = new QueueManager(new PendingStore());
    const original = localStorage.setItem.bind(localStorage);
    const setItem = vi.spyOn(localStorage, 'setItem').mockImplementation((key, value) => {
      if (key === 'sql-adapt-offline-queue') {
        throw new DOMException('queue claim blocked', 'QuotaExceededError');
      }
      return original(key, value);
    });

    expect(queue.getPending()).toEqual([]);
    setItem.mockRestore();

    expect(localStorage.getItem('sql-adapt-pending-interactions')).toBe(rawPending);
    expect(localStorage.getItem('sql-adapt-offline-queue')).toBe(rawQueue);
  });

  it('fails closed across accounts when queue-claim persistence and pending rollback both fail', () => {
    const event = {
      id: 'two-store-double-failure',
      learnerId: 'learner-shared',
      sessionId: 'session-two-store-double-failure',
      timestamp: 1_700_000_000_000,
      eventType: 'error',
      problemId: 'problem-two-store-double-failure',
    } satisfies InteractionEvent;
    const legacyPending = {
      id: event.id,
      event,
      status: 'backend_pending',
      timestamp: event.timestamp,
      retryCount: 0,
      sessionId: event.sessionId,
      eventType: event.eventType,
    };
    const legacyQueue = {
      id: event.id,
      type: 'interaction',
      data: event,
      retries: 0,
      timestamp: event.timestamp,
      status: 'queued_locally',
      errorCount: 0,
    };
    localStorage.setItem('sql-adapt-pending-confirmed', '[]');
    localStorage.setItem('sql-adapt-pending-interactions', JSON.stringify([legacyPending]));
    localStorage.setItem('sql-adapt-offline-queue', JSON.stringify([legacyQueue]));
    dualStorageModule.setActiveSyncPrincipal({ accountId: 'account-A', learnerId: 'learner-shared' });
    const PendingStore = (
      dualStorageModule.dualStorage as unknown as { pendingStore: { constructor: new () => object } }
    ).pendingStore.constructor;
    const QueueManager = (
      dualStorageModule.dualStorage as unknown as { offlineQueue: { constructor: new (store: object) => {
        getPending(): Array<{ id: string; syncOwnerId?: string }>;
      } } }
    ).offlineQueue.constructor;
    const queueA = new QueueManager(new PendingStore());
    const original = localStorage.setItem.bind(localStorage);
    let pendingWrites = 0;
    const setItem = vi.spyOn(localStorage, 'setItem').mockImplementation((key, value) => {
      if (key === 'sql-adapt-pending-interactions') {
        pendingWrites += 1;
        if (pendingWrites > 1) {
          throw new DOMException('pending rollback blocked', 'QuotaExceededError');
        }
      }
      if (key === 'sql-adapt-offline-queue') {
        throw new DOMException('queue claim blocked', 'QuotaExceededError');
      }
      return original(key, value);
    });

    expect(queueA.getPending()).toEqual([]);
    setItem.mockRestore();
    expect(JSON.parse(localStorage.getItem('sql-adapt-pending-interactions') ?? '[]')).toEqual([
      expect.objectContaining({ id: event.id, syncOwnerId: ownerA }),
    ]);
    expect(JSON.parse(localStorage.getItem('sql-adapt-offline-queue') ?? '[]')).toEqual([legacyQueue]);

    dualStorageModule.setActiveSyncPrincipal({ accountId: 'account-B', learnerId: 'learner-shared' });
    expect(new QueueManager(new PendingStore()).getPending()).toEqual([]);

    dualStorageModule.setActiveSyncPrincipal({ accountId: 'account-A', learnerId: 'learner-shared' });
    expect(new QueueManager(new PendingStore()).getPending()).toEqual([
      expect.objectContaining({ id: event.id, syncOwnerId: ownerA }),
    ]);
  });

  it('does not confirm or remove a generic queue item through a same-id pending interaction', () => {
    const event = {
      id: 'cross-type-confirmation-collision',
      learnerId: 'learner-shared',
      sessionId: 'session-cross-type-confirmation',
      timestamp: 1_700_000_000_000,
      eventType: 'error',
      problemId: 'problem-cross-type-confirmation',
    } satisfies InteractionEvent;
    const rawPending = JSON.stringify([{
      id: event.id,
      event,
      status: 'backend_pending',
      timestamp: event.timestamp,
      retryCount: 0,
      sessionId: event.sessionId,
      eventType: event.eventType,
      syncOwnerId: ownerA,
    }]);
    const rawQueue = JSON.stringify([{
      id: event.id,
      type: 'session',
      data: {
        learnerId: 'learner-shared',
        data: { startTime: '2026-08-06T00:00:00.000Z', lastActivity: '2026-08-06T00:00:01.000Z' },
      },
      retries: 0,
      timestamp: event.timestamp,
      status: 'queued_locally',
      errorCount: 0,
      syncOwnerId: ownerA,
    }]);
    localStorage.setItem('sql-adapt-pending-confirmed', '[]');
    localStorage.setItem('sql-adapt-pending-interactions', rawPending);
    localStorage.setItem('sql-adapt-offline-queue', rawQueue);
    const PendingStore = (
      dualStorageModule.dualStorage as unknown as { pendingStore: { constructor: new () => object } }
    ).pendingStore.constructor;
    const QueueManager = (
      dualStorageModule.dualStorage as unknown as { offlineQueue: { constructor: new (store: object) => {
        remove(id: string, syncOwnerId?: string): boolean;
      } } }
    ).offlineQueue.constructor;
    const queue = new QueueManager(new PendingStore());

    expect(queue.remove(event.id, ownerA)).toBe(false);
    expect(localStorage.getItem('sql-adapt-pending-interactions')).toBe(rawPending);
    expect(localStorage.getItem('sql-adapt-offline-queue')).toBe(rawQueue);
    expect(localStorage.getItem('sql-adapt-pending-confirmed')).toBe('[]');
  });

  it('retains complete confirmed history and malformed records beyond 100 entries', () => {
    const retained = Array.from({ length: 104 }, (_, index) => ({
      id: `confirmed-retained-${index}`,
      confirmedAt: 1_700_000_000_000 + index,
      syncOwnerId: `v1:["other-${index}","learner-shared"]`,
      payloadFingerprint: `retained-${index}`,
    }));
    const profile = {
      id: 'learner-shared',
      name: 'Confirmed complete',
      conceptsCovered: [],
      conceptCoverageEvidence: [],
      errorHistory: [],
      solvedProblemIds: [],
      interactionCount: 0,
      currentStrategy: 'adaptive-medium',
      preferences: { escalationThreshold: 3, aggregationDelay: 5000 },
    };
    localStorage.setItem('sql-adapt-pending-confirmed', JSON.stringify([null, ...retained]));
    localStorage.setItem('sql-adapt-pending-interactions', '[]');
    localStorage.setItem('sql-adapt-offline-queue', JSON.stringify([{
      id: 'confirmed-complete-new',
      type: 'profile',
      data: profile,
      retries: 0,
      timestamp: 1_700_000_100_000,
      status: 'queued_locally',
      errorCount: 0,
      syncOwnerId: ownerA,
    }]));
    const PendingStore = (
      dualStorageModule.dualStorage as unknown as { pendingStore: { constructor: new () => object } }
    ).pendingStore.constructor;
    const QueueManager = (
      dualStorageModule.dualStorage as unknown as { offlineQueue: { constructor: new (store: object) => {
        remove(id: string, syncOwnerId?: string): boolean;
      } } }
    ).offlineQueue.constructor;

    expect(new QueueManager(new PendingStore()).remove('confirmed-complete-new', ownerA)).toBe(true);
    const confirmed = JSON.parse(localStorage.getItem('sql-adapt-pending-confirmed') ?? '[]') as unknown[];
    expect(confirmed).toHaveLength(106);
    expect(confirmed[0]).toBeNull();
    expect(confirmed).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'confirmed-retained-0' }),
      expect.objectContaining({ id: 'confirmed-retained-103' }),
      expect.objectContaining({ id: 'confirmed-complete-new', syncOwnerId: ownerA }),
    ]));
  });

  it('does not expose retry metadata that failed to persist', () => {
    const event = {
      id: 'retry-metadata-proof',
      learnerId: 'learner-shared',
      sessionId: 'session-retry-metadata-proof',
      timestamp: 1_700_000_000_000,
      eventType: 'error',
      problemId: 'problem-retry-metadata-proof',
    } satisfies InteractionEvent;
    const rawQueue = JSON.stringify([{
      id: event.id,
      type: 'interaction',
      data: event,
      retries: 0,
      timestamp: event.timestamp,
      status: 'queued_locally',
      errorCount: 0,
      syncOwnerId: ownerA,
    }]);
    localStorage.setItem('sql-adapt-pending-confirmed', '[]');
    localStorage.setItem('sql-adapt-pending-interactions', '[]');
    localStorage.setItem('sql-adapt-offline-queue', rawQueue);
    dualStorageModule.setActiveSyncPrincipal({ accountId: 'account-A', learnerId: 'learner-shared' });
    const PendingStore = (
      dualStorageModule.dualStorage as unknown as { pendingStore: { constructor: new () => object } }
    ).pendingStore.constructor;
    const QueueManager = (
      dualStorageModule.dualStorage as unknown as { offlineQueue: { constructor: new (store: object) => {
        incrementRetry(id: string, syncOwnerId?: string, error?: Error): void;
        getPending(): Array<{ retries: number; status: string }>;
      } } }
    ).offlineQueue.constructor;
    const queue = new QueueManager(new PendingStore());
    const original = localStorage.setItem.bind(localStorage);
    const setItem = vi.spyOn(localStorage, 'setItem').mockImplementation((key, value) => {
      if (key === 'sql-adapt-offline-queue') {
        throw new DOMException('retry metadata blocked', 'QuotaExceededError');
      }
      return original(key, value);
    });

    queue.incrementRetry(event.id, ownerA, new Error('offline'));
    setItem.mockRestore();

    expect(localStorage.getItem('sql-adapt-offline-queue')).toBe(rawQueue);
    expect(queue.getPending()).toEqual([
      expect.objectContaining({ retries: 0, status: 'queued_locally' }),
    ]);
  });

  it.each([
    ['pending', 'sql-adapt-pending-interactions'],
    ['confirmed', 'sql-adapt-pending-confirmed'],
  ])('blocks a valid queue record when the %s storage root is malformed', (_label, malformedKey) => {
    const event = {
      id: `malformed-root-${_label}`,
      learnerId: 'learner-shared',
      sessionId: `session-malformed-root-${_label}`,
      timestamp: 1_700_000_000_000,
      eventType: 'error',
      problemId: `problem-malformed-root-${_label}`,
    } satisfies InteractionEvent;
    localStorage.setItem('sql-adapt-pending-confirmed', '[]');
    localStorage.setItem('sql-adapt-pending-interactions', '[]');
    localStorage.setItem(malformedKey, '{}');
    localStorage.setItem('sql-adapt-offline-queue', JSON.stringify([{
      id: event.id,
      type: 'interaction',
      data: event,
      retries: 0,
      timestamp: event.timestamp,
      status: 'queued_locally',
      errorCount: 0,
      syncOwnerId: ownerA,
    }]));
    dualStorageModule.setActiveSyncPrincipal({ accountId: 'account-A', learnerId: 'learner-shared' });
    const PendingStore = (
      dualStorageModule.dualStorage as unknown as { pendingStore: { constructor: new () => object } }
    ).pendingStore.constructor;
    const QueueManager = (
      dualStorageModule.dualStorage as unknown as { offlineQueue: { constructor: new (store: object) => {
        getPending(): unknown[];
      } } }
    ).offlineQueue.constructor;

    expect(new QueueManager(new PendingStore()).getPending()).toEqual([]);
    expect(localStorage.getItem(malformedKey)).toBe('{}');
  });

  it('does not expose malformed per-type queue payloads or dead-letter status', () => {
    const event = {
      id: 'dead-letter-in-queue',
      learnerId: 'learner-shared',
      sessionId: 'session-dead-letter-in-queue',
      timestamp: 1_700_000_000_000,
      eventType: 'error',
      problemId: 'problem-dead-letter-in-queue',
    } satisfies InteractionEvent;
    const raw = JSON.stringify([
      {
        id: 'bad-profile',
        type: 'profile',
        data: {
          id: 'learner-shared', name: 'Malformed queued profile', interactionCount: 1,
          conceptsCovered: ['joins', 42], conceptCoverageEvidence: [], errorHistory: [], solvedProblemIds: [],
          currentStrategy: 'adaptive-medium', preferences: { escalationThreshold: 3, aggregationDelay: 5000 },
        },
        retries: 0, timestamp: 1, status: 'queued_locally', errorCount: 0, syncOwnerId: ownerA,
      },
      {
        id: 'bad-textbook', type: 'textbookUnit',
        data: { learnerId: 'learner-shared', unit: { id: 'partial-only' } },
        retries: 0, timestamp: 2, status: 'queued_locally', errorCount: 0, syncOwnerId: ownerA,
      },
      {
        id: 'bad-session', type: 'session',
        data: { learnerId: 'learner-shared', data: { startTime: '', lastActivity: '' } },
        retries: 0, timestamp: 3, status: 'queued_locally', errorCount: 0, syncOwnerId: ownerA,
      },
      { id: event.id, type: 'interaction', data: event, retries: 0, timestamp: 4, status: 'dead_letter', errorCount: 0, syncOwnerId: ownerA },
      {
        id: 'missing-stored-session',
        type: 'interaction',
        data: { ...event, id: 'missing-stored-session', sessionId: undefined },
        retries: 0,
        timestamp: 5,
        status: 'queued_locally',
        errorCount: 0,
        syncOwnerId: ownerA,
      },
    ]);
    localStorage.setItem('sql-adapt-offline-queue', raw);
    localStorage.setItem('sql-adapt-pending-confirmed', '[]');
    localStorage.setItem('sql-adapt-pending-interactions', '[]');
    dualStorageModule.setActiveSyncPrincipal({ accountId: 'account-A', learnerId: 'learner-shared' });
    const pendingStore = (
      dualStorageModule.dualStorage as unknown as { pendingStore: object }
    ).pendingStore;
    const QueueManager = (
      dualStorageModule.dualStorage as unknown as { offlineQueue: { constructor: new (store: object) => {
        getPending(): unknown[];
      } } }
    ).offlineQueue.constructor;

    expect(new QueueManager(pendingStore).getPending()).toEqual([]);
    expect(localStorage.getItem('sql-adapt-offline-queue')).toBe(raw);
  });

  it('standard pending writes retain every other-owner and malformed record without truncation', () => {
    const retained = Array.from({ length: 104 }, (_, index) => ({
      id: `standard-retained-${index}`,
      event: {
        id: `standard-retained-${index}`,
        learnerId: 'learner-shared',
        sessionId: `session-standard-retained-${index}`,
        timestamp: 1_700_000_000_000 + index,
        eventType: 'error',
        problemId: `problem-standard-retained-${index}`,
      },
      status: 'backend_pending',
      timestamp: 1_700_000_000_000 + index,
      retryCount: 0,
      sessionId: `session-standard-retained-${index}`,
      eventType: 'error',
      syncOwnerId: `v1:["other-${index}","learner-shared"]`,
    }));
    localStorage.setItem('sql-adapt-pending-confirmed', '[]');
    localStorage.setItem('sql-adapt-pending-interactions', JSON.stringify([null, ...retained]));
    dualStorageModule.setActiveSyncPrincipal({ accountId: 'account-A', learnerId: 'learner-shared' });
    const PendingStore = (
      dualStorageModule.dualStorage as unknown as { pendingStore: { constructor: new () => {
        add(event: InteractionEvent): void;
      } } }
    ).pendingStore.constructor;
    const store = new PendingStore();

    store.add({
      id: 'standard-new-pending',
      learnerId: 'learner-shared',
      sessionId: 'session-standard-new-pending',
      timestamp: 1_700_000_100_000,
      eventType: 'error',
      problemId: 'problem-standard-new-pending',
    });

    const persisted = JSON.parse(localStorage.getItem('sql-adapt-pending-interactions') ?? '[]') as unknown[];
    expect(persisted).toHaveLength(106);
    expect(persisted[0]).toBeNull();
    expect(persisted).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'standard-retained-0' }),
      expect.objectContaining({ id: 'standard-retained-103' }),
      expect.objectContaining({ id: 'standard-new-pending', syncOwnerId: ownerA }),
    ]));
  });

  it('standard queue writes retain over 100 other-owner and malformed records', () => {
    const retained = Array.from({ length: 104 }, (_, index) => ({
      id: `queue-retained-${index}`,
      type: 'interaction',
      data: {
        id: `queue-retained-${index}`,
        learnerId: 'learner-shared',
        sessionId: `session-queue-retained-${index}`,
        timestamp: 1_700_000_000_000 + index,
        eventType: 'error',
        problemId: `problem-queue-retained-${index}`,
      },
      retries: 0,
      timestamp: 1_700_000_000_000 + index,
      status: 'queued_locally',
      errorCount: 0,
      syncOwnerId: `v1:["other-${index}","learner-shared"]`,
    }));
    localStorage.setItem('sql-adapt-offline-queue', JSON.stringify([null, ...retained]));
    localStorage.setItem('sql-adapt-pending-confirmed', '[]');
    localStorage.setItem('sql-adapt-pending-interactions', '[]');
    dualStorageModule.setActiveSyncPrincipal({ accountId: 'account-A', learnerId: 'learner-shared' });
    const pendingStore = (
      dualStorageModule.dualStorage as unknown as { pendingStore: object }
    ).pendingStore;
    const QueueManager = (
      dualStorageModule.dualStorage as unknown as { offlineQueue: { constructor: new (store: object) => {
        add(item: { id: string; type: 'interaction'; data: InteractionEvent }): void;
      } } }
    ).offlineQueue.constructor;
    const queue = new QueueManager(pendingStore);

    queue.add({
      id: 'queue-standard-new',
      type: 'interaction',
      data: {
        id: 'queue-standard-new',
        learnerId: 'learner-shared',
        sessionId: 'session-queue-standard-new',
        timestamp: 1_700_000_100_000,
        eventType: 'error',
        problemId: 'problem-queue-standard-new',
      },
    });

    const persisted = JSON.parse(localStorage.getItem('sql-adapt-offline-queue') ?? '[]') as unknown[];
    expect(persisted).toHaveLength(106);
    expect(persisted[0]).toBeNull();
    expect(persisted).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'queue-retained-0' }),
      expect.objectContaining({ id: 'queue-retained-103' }),
      expect.objectContaining({ id: 'queue-standard-new', syncOwnerId: ownerA }),
    ]));
  });

  it('session-end queue writes retain the complete other-owner backlog beyond 100 items', () => {
    const retained = Array.from({ length: 104 }, (_, index) => ({
      key: `owner:v1:["other-${index}","learner-shared"]\u0000learner-shared:session-retained-${index}`,
      event: {
        id: `session-end-retained-${index}`,
        learnerId: 'learner-shared',
        sessionId: `session-retained-${index}`,
        timestamp: 1_700_000_000_000 + index,
        eventType: 'session_end',
        problemId: `problem-session-retained-${index}`,
      },
      queuedAt: 1_700_000_000_000 + index,
      syncOwnerId: `v1:["other-${index}","learner-shared"]`,
    }));
    localStorage.setItem('sql-adapt-pending-session-ends', JSON.stringify(retained));
    dualStorageModule.setActiveSyncPrincipal({ accountId: 'account-A', learnerId: 'learner-shared' });

    expect(dualStorageModule.dualStorage.queueSessionEnd({
      id: 'session-end-new-complete',
      learnerId: 'learner-shared',
      sessionId: 'session-new-complete',
      timestamp: 1_700_000_100_000,
      eventType: 'session_end',
      problemId: 'problem-session-new-complete',
    })).toMatchObject({ success: true });

    const persisted = JSON.parse(localStorage.getItem('sql-adapt-pending-session-ends') ?? '[]') as Array<{
      event: { id: string };
      syncOwnerId?: string;
    }>;
    expect(persisted).toHaveLength(105);
    expect(persisted).toEqual(expect.arrayContaining([
      expect.objectContaining({ event: expect.objectContaining({ id: 'session-end-retained-0' }) }),
      expect.objectContaining({ event: expect.objectContaining({ id: 'session-end-retained-103' }) }),
      expect.objectContaining({
        event: expect.objectContaining({ id: 'session-end-new-complete' }),
        syncOwnerId: ownerA,
      }),
    ]));
  });

  it('dead-letter writes retain malformed records and the complete history beyond 50 items', () => {
    const retained = Array.from({ length: 51 }, (_, index) => ({
      id: `dead-retained-${index}`,
      type: 'interaction',
      data: { retained: index },
      reason: 'retained',
      timestamp: 1_700_000_000_000 + index,
      syncOwnerId: `v1:["other-${index}","learner-shared"]`,
    }));
    const event = {
      id: 'dead-letter-complete-new',
      learnerId: 'learner-shared',
      sessionId: 'session-dead-letter-complete-new',
      timestamp: 1_700_000_100_000,
      eventType: 'error',
      problemId: 'problem-dead-letter-complete-new',
    } satisfies InteractionEvent;
    localStorage.setItem('sql-adapt-dead-letter', JSON.stringify([null, ...retained]));
    localStorage.setItem('sql-adapt-offline-queue', JSON.stringify([{
      id: event.id,
      type: 'interaction',
      data: event,
      retries: 0,
      timestamp: event.timestamp,
      status: 'queued_locally',
      errorCount: 0,
      syncOwnerId: ownerA,
    }]));
    localStorage.setItem('sql-adapt-pending-confirmed', '[]');
    localStorage.setItem('sql-adapt-pending-interactions', '[]');
    dualStorageModule.setActiveSyncPrincipal({ accountId: 'account-A', learnerId: 'learner-shared' });
    const pendingStore = (
      dualStorageModule.dualStorage as unknown as { pendingStore: object }
    ).pendingStore;
    const QueueManager = (
      dualStorageModule.dualStorage as unknown as { offlineQueue: { constructor: new (store: object) => {
        moveToDeadLetter(id: string, reason: string, syncOwnerId?: string): void;
      } } }
    ).offlineQueue.constructor;
    const queue = new QueueManager(pendingStore);

    queue.moveToDeadLetter(event.id, 'new-invalid-record', ownerA);

    const persisted = JSON.parse(localStorage.getItem('sql-adapt-dead-letter') ?? '[]') as unknown[];
    expect(persisted).toHaveLength(53);
    expect(persisted[0]).toBeNull();
    expect(persisted).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'dead-retained-0' }),
      expect.objectContaining({ id: 'dead-retained-50' }),
      expect.objectContaining({ id: event.id, reason: 'new-invalid-record', syncOwnerId: ownerA }),
    ]));
  });

  it('keeps the queue source and withholds callback when dead-letter proof cannot persist', () => {
    const event = {
      id: 'dead-letter-proof-failure',
      learnerId: 'learner-shared',
      sessionId: 'session-dead-letter-proof-failure',
      timestamp: 1_700_000_000_000,
      eventType: 'error',
      problemId: 'problem-dead-letter-proof-failure',
    } satisfies InteractionEvent;
    const rawQueue = JSON.stringify([{
      id: event.id,
      type: 'interaction',
      data: event,
      retries: 0,
      timestamp: event.timestamp,
      status: 'queued_locally',
      errorCount: 0,
      syncOwnerId: ownerA,
    }]);
    const rawDeadLetter = '[]';
    localStorage.setItem('sql-adapt-offline-queue', rawQueue);
    localStorage.setItem('sql-adapt-dead-letter', rawDeadLetter);
    localStorage.setItem('sql-adapt-pending-confirmed', '[]');
    localStorage.setItem('sql-adapt-pending-interactions', '[]');
    dualStorageModule.setActiveSyncPrincipal({ accountId: 'account-A', learnerId: 'learner-shared' });
    const pendingStore = (
      dualStorageModule.dualStorage as unknown as { pendingStore: object }
    ).pendingStore;
    const callback = vi.fn();
    const QueueManager = (
      dualStorageModule.dualStorage as unknown as { offlineQueue: { constructor: new (
        store: object,
        onConfirmed?: unknown,
        onDeadLetter?: (ids: string[], reason: string, syncOwnerId?: string) => void,
      ) => {
        getPending(): unknown[];
        moveToDeadLetter(id: string, reason: string, syncOwnerId?: string): void;
      } } }
    ).offlineQueue.constructor;
    const queue = new QueueManager(pendingStore, undefined, callback);
    const original = localStorage.setItem.bind(localStorage);
    const setItem = vi.spyOn(localStorage, 'setItem').mockImplementation((key, value) => {
      if (key === 'sql-adapt-dead-letter') {
        throw new DOMException('dead-letter write blocked', 'QuotaExceededError');
      }
      return original(key, value);
    });

    queue.moveToDeadLetter(event.id, 'invalid', ownerA);
    setItem.mockRestore();

    expect(localStorage.getItem('sql-adapt-dead-letter')).toBe(rawDeadLetter);
    expect(localStorage.getItem('sql-adapt-offline-queue')).toBe(rawQueue);
    expect(callback).not.toHaveBeenCalled();
    expect(queue.getPending()).toEqual([expect.objectContaining({ id: event.id })]);
  });

  it('rolls back dead-letter proof when source-queue deletion cannot persist', () => {
    const event = {
      id: 'dead-letter-source-failure',
      learnerId: 'learner-shared',
      sessionId: 'session-dead-letter-source-failure',
      timestamp: 1_700_000_000_000,
      eventType: 'error',
      problemId: 'problem-dead-letter-source-failure',
    } satisfies InteractionEvent;
    const rawQueue = JSON.stringify([{
      id: event.id,
      type: 'interaction',
      data: event,
      retries: 0,
      timestamp: event.timestamp,
      status: 'queued_locally',
      errorCount: 0,
      syncOwnerId: ownerA,
    }]);
    const rawDeadLetter = JSON.stringify([null]);
    localStorage.setItem('sql-adapt-offline-queue', rawQueue);
    localStorage.setItem('sql-adapt-dead-letter', rawDeadLetter);
    localStorage.setItem('sql-adapt-pending-confirmed', '[]');
    localStorage.setItem('sql-adapt-pending-interactions', '[]');
    dualStorageModule.setActiveSyncPrincipal({ accountId: 'account-A', learnerId: 'learner-shared' });
    const pendingStore = (
      dualStorageModule.dualStorage as unknown as { pendingStore: object }
    ).pendingStore;
    const callback = vi.fn();
    const QueueManager = (
      dualStorageModule.dualStorage as unknown as { offlineQueue: { constructor: new (
        store: object,
        onConfirmed?: unknown,
        onDeadLetter?: (ids: string[], reason: string, syncOwnerId?: string) => void,
      ) => {
        getPending(): unknown[];
        moveToDeadLetter(id: string, reason: string, syncOwnerId?: string): void;
      } } }
    ).offlineQueue.constructor;
    const queue = new QueueManager(pendingStore, undefined, callback);
    const original = localStorage.setItem.bind(localStorage);
    const setItem = vi.spyOn(localStorage, 'setItem').mockImplementation((key, value) => {
      if (key === 'sql-adapt-offline-queue') {
        throw new DOMException('queue deletion blocked', 'QuotaExceededError');
      }
      return original(key, value);
    });

    queue.moveToDeadLetter(event.id, 'invalid', ownerA);
    setItem.mockRestore();

    expect(localStorage.getItem('sql-adapt-dead-letter')).toBe(rawDeadLetter);
    expect(localStorage.getItem('sql-adapt-offline-queue')).toBe(rawQueue);
    expect(callback).not.toHaveBeenCalled();
    expect(queue.getPending()).toEqual([expect.objectContaining({ id: event.id })]);
  });

  it('preserves and does not send differing same-id legacy queue and pending records', () => {
    const queueEvent = {
      id: 'legacy-different-twin',
      learnerId: 'learner-shared',
      sessionId: 'session-queue-version',
      timestamp: 1_700_000_000_000,
      eventType: 'error',
      problemId: 'problem-queue-version',
    } satisfies InteractionEvent;
    const pendingEvent = {
      ...queueEvent,
      sessionId: 'session-pending-version',
      timestamp: 1_700_000_001_000,
      problemId: 'problem-pending-version',
    };
    const rawPending = JSON.stringify([{
      id: pendingEvent.id,
      event: pendingEvent,
      status: 'backend_pending',
      timestamp: pendingEvent.timestamp,
      retryCount: 0,
      sessionId: pendingEvent.sessionId,
      eventType: pendingEvent.eventType,
    }]);
    const rawQueue = JSON.stringify([{
      id: queueEvent.id,
      type: 'interaction',
      data: queueEvent,
      retries: 0,
      timestamp: queueEvent.timestamp,
      status: 'queued_locally',
      errorCount: 0,
    }]);
    localStorage.setItem('sql-adapt-pending-confirmed', '[]');
    localStorage.setItem('sql-adapt-pending-interactions', rawPending);
    localStorage.setItem('sql-adapt-offline-queue', rawQueue);
    dualStorageModule.setActiveSyncPrincipal({ accountId: 'account-A', learnerId: 'learner-shared' });
    const PendingStore = (
      dualStorageModule.dualStorage as unknown as { pendingStore: { constructor: new () => object } }
    ).pendingStore.constructor;
    const QueueManager = (
      dualStorageModule.dualStorage as unknown as { offlineQueue: { constructor: new (store: object) => {
        getPending(): unknown[];
      } } }
    ).offlineQueue.constructor;
    const queue = new QueueManager(new PendingStore());

    expect(queue.getPending()).toEqual([]);
    expect(localStorage.getItem('sql-adapt-pending-interactions')).toBe(rawPending);
    expect(localStorage.getItem('sql-adapt-offline-queue')).toBe(rawQueue);
  });

  it.each([
    ['sql-adapt-pending-confirmed', '{}'],
    ['sql-adapt-pending-confirmed', '[null]'],
    ['sql-adapt-pending-interactions', '{}'],
    ['sql-adapt-pending-interactions', '[null]'],
  ])('keeps malformed %s data inert and byte-for-byte unchanged', (key, raw) => {
    localStorage.setItem('sql-adapt-pending-confirmed', '[]');
    localStorage.setItem('sql-adapt-pending-interactions', '[]');
    localStorage.setItem(key, raw);
    const PendingStore = (
      dualStorageModule.dualStorage as unknown as { pendingStore: { constructor: new () => {
        getAllPending(): unknown[];
      } } }
    ).pendingStore.constructor;

    expect(() => new PendingStore()).not.toThrow();
    const store = new PendingStore();
    expect(store.getAllPending()).toEqual([]);
    expect(localStorage.getItem(key)).toBe(raw);
  });

  it.each([
    ['sql-adapt-offline-queue', '{}'],
    ['sql-adapt-offline-queue', '[null]'],
    ['sql-adapt-dead-letter', '{}'],
    ['sql-adapt-dead-letter', '[null]'],
  ])('keeps malformed %s records inert and unchanged', (key, raw) => {
    localStorage.setItem('sql-adapt-offline-queue', '[]');
    localStorage.setItem('sql-adapt-dead-letter', '[]');
    localStorage.setItem(key, raw);
    const pendingStore = (
      dualStorageModule.dualStorage as unknown as { pendingStore: object }
    ).pendingStore;
    const QueueManager = (
      dualStorageModule.dualStorage as unknown as { offlineQueue: { constructor: new (store: object) => {
        getPending(): unknown[];
        getDeadLetter(): unknown[];
      } } }
    ).offlineQueue.constructor;

    expect(() => new QueueManager(pendingStore)).not.toThrow();
    const queue = new QueueManager(pendingStore);
    expect(queue.getPending()).toEqual([]);
    expect(queue.getDeadLetter()).toEqual([]);
    expect(localStorage.getItem(key)).toBe(raw);
  });

  it('does not treat an active-owner confirmed id as ownership of a different canonical session event', async () => {
    const learnerId = 'learner-shared';
    dualStorageModule.setActiveSyncPrincipal({ accountId: 'account-A', learnerId });
    await dualStorageModule.dualStorage.checkHealth();
    dualStorageModule.dualStorage.saveInteraction({
      id: 'reconcile-confirmed-collision',
      learnerId,
      sessionId: 'session-owner-A-confirmed',
      timestamp: 1_700_000_000_000,
      eventType: 'execution',
      problemId: 'problem-owner-A',
      successful: true,
    });
    await vi.waitFor(() => {
      expect(localStorage.getItem('sql-adapt-pending-confirmed')).toContain('reconcile-confirmed-collision');
    });
    localStorage.setItem('sql-learning-interactions', JSON.stringify([{
      id: 'reconcile-confirmed-collision',
      learnerId,
      sessionId: 'session-owner-B-canonical',
      timestamp: 1_700_000_001_000,
      eventType: 'execution',
      problemId: 'problem-owner-B',
      successful: false,
    }]));
    getInteractionsMock.mockResolvedValue({ events: [], total: 0 });
    logInteractionsBatchMock.mockClear();

    const result = await dualStorageModule.dualStorage.ensureSessionInteractionsPersisted(
      learnerId,
      'session-owner-B-canonical',
    );

    expect(result).toMatchObject({ backendConfirmed: false, pendingSync: true });
    expect(logInteractionsBatchMock).not.toHaveBeenCalled();
  });
});

describe('dual-storage restore hydration', () => {
  it('finds drafts across opaque backend session ids', () => {
    dualStorageModule.dualStorage.savePracticeDraft(
      'learner-opaque',
      'opaque-backend-session',
      'problem-2',
      'SELECT id FROM employees',
    );

    expect(
      dualStorageModule.dualStorage.findAnyPracticeDraft('learner-opaque', 'problem-2'),
    ).toBe('SELECT id FROM employees');
  });

  it('hydrates session draft from backend payload without waiting for heavy interaction sync', async () => {
    getSessionMock.mockResolvedValue({
      sessionId: 'session-seeded',
      currentProblemId: 'problem-2',
      currentCode: 'SELECT * FROM employees WHERE salary > 70000',
    });
    getInteractionsMock.mockImplementation(
      () =>
        new Promise(() => {
          // Intentional never-resolve to emulate slow large payload sync.
        }) as Promise<{ events: unknown[]; total: number }>,
    );

    const startedAt = Date.now();
    const hydrated = await dualStorageModule.dualStorage.hydrateLearner('learner-restore');
    const elapsedMs = Date.now() - startedAt;

    expect(hydrated).toBe(true);
    expect(elapsedMs).toBeLessThan(300);
    expect(dualStorageModule.dualStorage.getActiveSessionId()).toBe('session-seeded');
    expect(
      dualStorageModule.dualStorage.getPracticeDraft(
        'learner-restore',
        'session-seeded',
        'problem-2',
      ),
    ).toBe('SELECT * FROM employees WHERE salary > 70000');
  });

  it('supports forced re-hydration to bypass throttle window', async () => {
    getSessionMock.mockResolvedValue({
      sessionId: 'session-force',
      currentProblemId: 'problem-2',
      currentCode: 'SELECT * FROM employees',
    });

    const first = await dualStorageModule.dualStorage.hydrateLearner('learner-force');
    const second = await dualStorageModule.dualStorage.hydrateLearner('learner-force');
    const forced = await dualStorageModule.dualStorage.hydrateLearner('learner-force', { force: true });

    expect(first).toBe(true);
    expect(second).toBe(true);
    expect(forced).toBe(true);
    expect(getSessionMock).toHaveBeenCalledTimes(2);
  });

  it('scopes the hydration throttle to the authenticated owner', async () => {
    const learnerId = 'learner-owner-throttle';
    dualStorageModule.setActiveSyncPrincipal({ accountId: 'account-A', learnerId: 'learner-shared' });
    await dualStorageModule.dualStorage.hydrateLearner(learnerId, { force: true });

    dualStorageModule.setActiveSyncPrincipal({ accountId: 'account-B', learnerId: 'learner-shared' });
    await dualStorageModule.dualStorage.hydrateLearner(learnerId);

    expect(getProfileMock).toHaveBeenCalledTimes(2);
    expect(getSessionMock).toHaveBeenCalledTimes(2);
  });

  it('discards hydration responses when the authenticated owner changes in flight', async () => {
    const learnerId = 'learner-owner-race';
    let resolveProfile: ((profile: LearnerProfile) => void) | undefined;
    getProfileMock.mockImplementationOnce(
      () => new Promise<LearnerProfile>((resolve) => {
        resolveProfile = resolve;
      }),
    );
    dualStorageModule.setActiveSyncPrincipal({ accountId: 'account-A', learnerId: 'learner-shared' });

    const hydration = dualStorageModule.dualStorage.hydrateLearner(learnerId, { force: true });
    await vi.waitFor(() => expect(getProfileMock).toHaveBeenCalledWith(learnerId));
    dualStorageModule.setActiveSyncPrincipal({ accountId: 'account-B', learnerId: 'learner-shared' });
    resolveProfile?.(createBackendProfile({ id: learnerId, name: 'Owner A profile' }));

    await expect(hydration).resolves.toBe(false);
    expect(dualStorageModule.dualStorage.getProfile(learnerId)).toBeNull();
  });

  it('returns backend session snapshot when backend is healthy', async () => {
    getSessionMock.mockResolvedValue({
      sessionId: 'session-backend',
      currentProblemId: 'problem-2',
      currentCode: 'SELECT * FROM employees WHERE salary > 70000',
    });

    const snapshot = await dualStorageModule.dualStorage.getBackendSessionSnapshot('learner-backend');

    expect(snapshot).toMatchObject({
      sessionId: 'session-backend',
      currentProblemId: 'problem-2',
      currentCode: 'SELECT * FROM employees WHERE salary > 70000',
    });
    expect(getSessionMock).toHaveBeenCalledWith('learner-backend');
  });

  it('returns null backend session snapshot when backend is unavailable', async () => {
    checkBackendHealthMock.mockResolvedValue(false);

    const snapshot = await dualStorageModule.dualStorage.getBackendSessionSnapshot('learner-offline');

    expect(snapshot).toBeNull();
    expect(getSessionMock).not.toHaveBeenCalled();
  });
});

describe('dual-storage progress persistence sync', () => {
  beforeEach(async () => {
    // Ensure backend is healthy for progress sync tests
    checkBackendHealthMock.mockResolvedValue(true);
    await dualStorageModule.dualStorage.checkHealth();
  });

  it('calls updateProblemProgress on successful execution events', async () => {
    updateProblemProgressMock.mockResolvedValueOnce({
      userId: 'learner-1',
      problemId: 'problem-1',
      solved: true,
      attemptsCount: 1,
      hintsUsed: 0,
      lastCode: 'SELECT * FROM users',
    });

    logInteractionMock.mockResolvedValueOnce({ success: true, confirmed: true });

    dualStorageModule.dualStorage.saveInteraction({
      id: 'exec-progress-1',
      learnerId: 'learner-1',
      sessionId: 'session-progress-1',
      timestamp: 1_700_000_000_000,
      eventType: 'execution',
      problemId: 'problem-1',
      successful: true,
      code: 'SELECT * FROM users',
    });

    // Wait for async operations
    await vi.waitFor(() => {
      expect(updateProblemProgressMock).toHaveBeenCalledWith(
        'learner-1',
        'problem-1',
        expect.objectContaining({
          solved: true,
          incrementAttempts: true,
          lastCode: 'SELECT * FROM users',
        }),
      );
    });
  });

  it('calls updateProblemProgress with solved:false on failed executions', async () => {
    updateProblemProgressMock.mockClear();
    logInteractionMock.mockResolvedValueOnce({ success: true, confirmed: true });

    dualStorageModule.dualStorage.saveInteraction({
      id: 'exec-fail-1',
      learnerId: 'learner-1',
      sessionId: 'session-fail-1',
      timestamp: 1_700_000_000_000,
      eventType: 'execution',
      problemId: 'problem-1',
      successful: false,
      code: 'SELECT * FROM bad_table',
    });

    // Wait for async operations
    await vi.waitFor(() => {
      expect(updateProblemProgressMock).toHaveBeenCalledWith(
        'learner-1',
        'problem-1',
        expect.objectContaining({
          solved: false,  // Failed execution sets solved to false
          incrementAttempts: true,
          lastCode: 'SELECT * FROM bad_table',
        }),
      );
    });
  });

  it('does not call updateProblemProgress when problemId is missing', async () => {
    updateProblemProgressMock.mockClear();
    logInteractionMock.mockResolvedValueOnce({ success: true, confirmed: true });

    dualStorageModule.dualStorage.saveInteraction({
      id: 'exec-noproblem-1',
      learnerId: 'learner-1',
      sessionId: 'session-noproblem-1',
      timestamp: 1_700_000_000_000,
      eventType: 'execution',
      successful: true,
      code: 'SELECT 1',
    } as InteractionEvent);

    // Wait a bit to ensure no progress update was called
    await new Promise(resolve => setTimeout(resolve, 50));

    expect(updateProblemProgressMock).not.toHaveBeenCalled();
  });

  it('handles updateProblemProgress failures gracefully (best-effort)', async () => {
    updateProblemProgressMock.mockRejectedValueOnce(new Error('Network error'));
    logInteractionMock.mockResolvedValueOnce({ success: true, confirmed: true });

    // Spy on console.warn to verify error is logged
    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    // Should not throw even when progress update fails
    dualStorageModule.dualStorage.saveInteraction({
      id: 'exec-besteffort-1',
      learnerId: 'learner-1',
      sessionId: 'session-besteffort-1',
      timestamp: 1_700_000_000_000,
      eventType: 'execution',
      problemId: 'problem-1',
      successful: true,
      code: 'SELECT * FROM users',
    });

    // Wait for async operations to complete (including the catch block)
    await vi.waitFor(() => {
      expect(updateProblemProgressMock).toHaveBeenCalled();
    });

    // Verify the error was logged (best-effort behavior)
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      '[DualStorage] Backend updateProblemProgress failed:',
      expect.any(Error),
    );

    consoleWarnSpy.mockRestore();
  });
});
