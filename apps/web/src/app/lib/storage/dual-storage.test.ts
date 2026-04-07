import { beforeAll, beforeEach, afterAll, describe, expect, it, vi } from 'vitest';

type DualStorageModule = typeof import('./dual-storage');

const isBackendAvailableMock = vi.fn<() => Promise<boolean>>();
const checkBackendHealthMock = vi.fn<() => Promise<boolean>>();
const saveSessionMock = vi.fn<(learnerId: string, data: Record<string, unknown>) => Promise<boolean>>();
const saveTextbookUnitMock = vi.fn<(learnerId: string, unit: Record<string, unknown>) => Promise<boolean>>();
const getProfileMock = vi.fn<(learnerId: string) => Promise<null>>();
const getSessionMock = vi.fn<(learnerId: string) => Promise<Record<string, unknown> | null>>();
const getInteractionsMock = vi.fn<(learnerId: string, options?: Record<string, unknown>) => Promise<{ events: unknown[]; total: number }>>();
const getTextbookMock = vi.fn<(learnerId: string) => Promise<unknown[]>>();
const logInteractionMock = vi.fn<(event: unknown) => Promise<boolean>>();
const logInteractionsBatchMock = vi.fn<(events: unknown[]) => Promise<boolean>>();
const saveProfileMock = vi.fn<(profile: unknown) => Promise<boolean>>();

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
      logInteraction: logInteractionMock,
      logInteractionsBatch: logInteractionsBatchMock,
      saveProfile: saveProfileMock,
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
  logInteractionMock.mockReset().mockResolvedValue(true);
  logInteractionsBatchMock.mockReset().mockResolvedValue(true);
  saveProfileMock.mockReset().mockResolvedValue(true);
});

describe('dual-storage critical write semantics', () => {
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
