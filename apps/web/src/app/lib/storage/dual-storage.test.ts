import { beforeAll, beforeEach, afterAll, describe, expect, it, vi } from 'vitest';

type DualStorageModule = typeof import('./dual-storage');

const isBackendAvailableMock = vi.fn<() => Promise<boolean>>();
const checkBackendHealthMock = vi.fn<() => Promise<boolean>>();
const saveSessionMock = vi.fn<(learnerId: string, data: Record<string, unknown>) => Promise<boolean>>();
const saveTextbookUnitMock = vi.fn<(learnerId: string, unit: Record<string, unknown>) => Promise<boolean>>();
const getProfileMock = vi.fn<(learnerId: string) => Promise<null>>();
const getSessionMock = vi.fn<(learnerId: string) => Promise<Record<string, unknown> | null>>();
const getInteractionsMock = vi.fn<(learnerId: string) => Promise<{ events: unknown[]; total: number }>>();
const getTextbookMock = vi.fn<(learnerId: string) => Promise<unknown[]>>();
const logInteractionMock = vi.fn<(event: unknown) => Promise<boolean>>();
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
});
