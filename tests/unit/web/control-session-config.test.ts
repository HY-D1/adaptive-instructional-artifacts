/* @vitest-environment jsdom */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SessionConfig } from '../../../apps/web/src/app/types';

const storageClientMock = {
  getOrAssignStudentCondition: vi.fn(),
  getSession: vi.fn(),
};
const isBackendAvailableMock = vi.fn(() => true);

vi.mock('../../../apps/web/src/app/lib/api/storage-client', () => ({
  storageClient: storageClientMock,
  isBackendAvailable: () => isBackendAvailableMock(),
}));

const {
  validateSessionConfig,
  loadSessionConfigAsync,
  SESSION_CONFIG_STORAGE_KEY,
} = await import('../../../apps/web/src/app/lib/experiments/condition-assignment');
const { POLICY_IDS } = await import('../../../apps/web/src/app/lib/policies/policy-definitions');

function controlConfig(): SessionConfig {
  return {
    sessionId: 'session-control-1',
    learnerId: 'learner-control',
    conditionId: 'control',
    escalationPolicy: 'control',
    textbookDisabled: false,
    adaptiveLadderDisabled: true,
    immediateExplanationMode: false,
    staticHintMode: true,
    generationMode: 'quality_mode',
    createdAt: Date.now(),
  };
}

beforeEach(() => {
  sessionStorage.clear();
  vi.clearAllMocks();
  isBackendAvailableMock.mockReturnValue(true);
  storageClientMock.getOrAssignStudentCondition.mockResolvedValue({ conditionId: 'control' });
});

describe('control session config', () => {
  it("validateSessionConfig accepts escalationPolicy 'control'", () => {
    expect(validateSessionConfig(controlConfig())).toEqual({ valid: true, errors: [] });
  });

  it('still rejects an unknown escalationPolicy', () => {
    const config = { ...controlConfig(), conditionId: 'bogus', escalationPolicy: 'bogus' } as unknown as SessionConfig;
    expect(validateSessionConfig(config).valid).toBe(false);
  });

  it("does not add 'control' to POLICY_IDS", () => {
    expect(POLICY_IDS).not.toContain('control');
  });

  it('control learner with backend unreachable: switching problems does not log a new condition_assigned', async () => {
    storageClientMock.getSession.mockRejectedValue(new Error('network down'));

    const first = await loadSessionConfigAsync('learner-control');
    expect(first.isNewAssignment).toBe(true);
    expect(first.config.conditionId).toBe('control');
    expect(sessionStorage.getItem(SESSION_CONFIG_STORAGE_KEY)).not.toBeNull();

    // LearningInterface re-runs the loader on every problem switch.
    const second = await loadSessionConfigAsync('learner-control');
    expect(second.isNewAssignment).toBe(false);
    expect(second.source).toBe('sessionStorage');
    expect(second.config.sessionId).toBe(first.config.sessionId);
  });

  it("accepts a backend session whose escalationPolicy is 'control'", async () => {
    storageClientMock.getSession.mockResolvedValue({
      sessionId: 'backend-session-1',
      conditionId: 'control',
      escalationPolicy: 'control',
    });

    const result = await loadSessionConfigAsync('learner-control');
    expect(result.source).toBe('backend');
    expect(result.isNewAssignment).toBe(false);
    expect(result.config.sessionId).toBe('backend-session-1');
  });
});
