import { render, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ResearchDashboard } from './ResearchDashboard';

const mockStorage = vi.hoisted(() => ({
  getUserProfile: vi.fn(),
  getPolicyReplayMode: vi.fn(),
  setPolicyReplayMode: vi.fn(),
  getPdfIndex: vi.fn(),
  getAllInteractions: vi.fn(),
  getAllProfiles: vi.fn(),
  getProfile: vi.fn(),
  getTraceSlice: vi.fn(),
  cacheProfiles: vi.fn(),
  saveProfile: vi.fn(),
  saveInteraction: vi.fn(),
  exportData: vi.fn(),
  exportAllData: vi.fn(),
  importData: vi.fn(),
  savePdfIndex: vi.fn(),
  getActiveSessionId: vi.fn(),
}));

const mockStorageClient = vi.hoisted(() => ({
  getInstructorAnalyticsSummary: vi.fn(),
  getAllProfiles: vi.fn(),
  getInstructorAnalyticsInteractions: vi.fn(),
  fetchBackendHealth: vi.fn(),
  isBackendAvailable: vi.fn(),
  getCompleteInstructorExport: vi.fn(),
}));

vi.mock('../../../lib/storage', () => ({
  storage: mockStorage,
}));

vi.mock('../../../lib/api/storage-client', () => mockStorageClient);

vi.mock('../../../lib/adaptive-orchestrator', () => ({
  orchestrator: {
    getPolicyReplayTrace: vi.fn(() => []),
    replayDecisionTrace: vi.fn(() => []),
    getPolicySemanticsVersion: vi.fn(() => 'policy-v1'),
    getThresholds: vi.fn(() => ({ escalate: 3, aggregate: 6 })),
  },
}));

vi.mock('../../../lib/api/llm-client', () => ({
  checkLLMHealth: vi.fn(),
  getDefaultModelForProvider: vi.fn(() => 'test-model'),
}));

vi.mock('../../../lib/pdf-index-loader', () => ({
  loadOrBuildPdfIndex: vi.fn(),
  uploadPdfAndBuildIndex: vi.fn(),
}));

vi.mock('../../../lib/utils/demo-mode', () => ({
  isDemoMode: vi.fn(() => false),
  getDemoModeMessage: vi.fn(() => ''),
  DEMO_MODE_VERSION: 'test',
}));

vi.mock('../../../lib/runtime-config', () => ({
  isHostedMode: vi.fn(() => false),
  getHostedModeMessage: vi.fn(() => ''),
}));

vi.mock('../../../lib/research/learner-clustering', () => ({
  clusterLearners: vi.fn(() => []),
}));

vi.mock('../../../lib/research/error-transitions', () => ({
  buildErrorTransitionMatrix: vi.fn(() => ({})),
  buildErrorTransitionStats: vi.fn(() => ({
    transitions: {},
    errorChains: [],
  })),
  getErrorRecoveryPatterns: vi.fn(() => []),
}));

vi.mock('./EscalationHeatmap', () => ({
  EscalationHeatmap: () => <div data-testid="escalation-heatmap" />,
}));

vi.mock('./ErrorTransitionView', () => ({
  ErrorTransitionView: () => <div data-testid="error-transition-view" />,
  ErrorChainView: () => <div data-testid="error-chain-view" />,
  ErrorRecoveryView: () => <div data-testid="error-recovery-view" />,
}));

vi.mock('./MasteryTimeline', () => ({
  MasteryTimeline: () => <div data-testid="mastery-timeline" />,
}));

vi.mock('recharts', () => {
  const Wrapper = ({ children }: { children?: ReactNode }) => <div>{children}</div>;
  return {
    ResponsiveContainer: Wrapper,
    BarChart: Wrapper,
    Bar: Wrapper,
    XAxis: Wrapper,
    YAxis: Wrapper,
    CartesianGrid: Wrapper,
    Tooltip: Wrapper,
    Legend: Wrapper,
    LineChart: Wrapper,
    Line: Wrapper,
    PieChart: Wrapper,
    Pie: Wrapper,
    Cell: Wrapper,
  };
});

const backendProfiles = [
  {
    id: 'learner-1',
    name: 'Learner One',
    conceptsCovered: ['joins'],
    conceptCoverageEvidence: {},
    errorHistory: {},
    solvedProblemIds: [],
    interactionCount: 3,
    currentStrategy: 'adaptive-medium' as const,
    preferences: {
      escalationThreshold: 3,
      aggregationDelay: 6,
    },
    createdAt: Date.now(),
    lastActive: Date.now(),
  },
];

describe('ResearchDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockStorage.getUserProfile.mockReturnValue({ id: 'instructor-1' });
    mockStorage.getPolicyReplayMode.mockReturnValue(false);
    mockStorage.getPdfIndex.mockReturnValue(null);
    mockStorage.getAllInteractions.mockReturnValue([]);
    mockStorage.getAllProfiles.mockReturnValue([{ id: 'learner-1' }]);
    mockStorage.getProfile.mockReturnValue(null);
    mockStorage.getTraceSlice.mockReturnValue([]);
    mockStorage.cacheProfiles.mockReturnValue(undefined);
    mockStorage.saveProfile.mockReturnValue(undefined);
    mockStorage.saveInteraction.mockReturnValue(undefined);
    mockStorage.exportData.mockReturnValue({ interactions: [] });
    mockStorage.exportAllData.mockReturnValue({ interactions: [] });
    mockStorage.importData.mockReturnValue(undefined);
    mockStorage.savePdfIndex.mockReturnValue({ quotaExceeded: false });
    mockStorage.getActiveSessionId.mockReturnValue('session-1');

    mockStorageClient.getInstructorAnalyticsSummary.mockResolvedValue({
      sections: [{ id: 'section-1', name: 'Section 1', studentSignupCode: 'ABC123' }],
      totalStudents: 1,
      activeToday: 1,
      avgConceptCoverage: 17,
      avgConceptCoverageCount: 1,
      totalInteractions: 3,
      totalTextbookUnits: 0,
      interactionsByType: { execution: 3 },
      recentActivity: {
        interactionLast24Hours: 3,
        interactionLast7Days: 3,
        interactionLast30Days: 3,
        activeLearnersLast24Hours: 1,
        activeLearnersLast7Days: 1,
        activeLearnersLast30Days: 1,
      },
    });
    mockStorageClient.getAllProfiles.mockResolvedValue(backendProfiles);
    mockStorageClient.getInstructorAnalyticsInteractions.mockResolvedValue({
      events: [],
      total: 0,
      limit: 2000,
      offset: 0,
      hasMore: false,
    });
    mockStorageClient.fetchBackendHealth.mockResolvedValue({ status: 'ok' });
    mockStorageClient.isBackendAvailable.mockReturnValue(true);
    mockStorageClient.getCompleteInstructorExport.mockResolvedValue({ interactions: [] });
  });

  it('hydrates backend profiles into local cache without writing them back to the backend', async () => {
    render(<ResearchDashboard />);

    await waitFor(() => {
      expect(mockStorage.cacheProfiles).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            id: 'learner-1',
            name: 'Learner One',
          }),
        ]),
      );
    });

    expect(mockStorage.saveProfile).not.toHaveBeenCalled();
  });
});
