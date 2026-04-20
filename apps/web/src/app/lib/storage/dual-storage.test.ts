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
const updateProblemProgressMock = vi.fn<(learnerId: string, problemId: string, update: unknown) => Promise<unknown>>();
const getAllProblemProgressMock = vi.fn<(learnerId: string) => Promise<Array<{ problemId: string; solved: boolean }>>>();
const createLearnerMock = vi.fn<(profile: unknown) => Promise<boolean>>();

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
      updateProblemProgress: updateProblemProgressMock,
      createLearner: createLearnerMock,
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
  updateProblemProgressMock.mockReset().mockResolvedValue({ success: true });
  getAllProblemProgressMock.mockReset().mockResolvedValue([]);
  createLearnerMock.mockReset().mockResolvedValue(true);
});

describe('dual-storage critical write semantics', () => {
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
