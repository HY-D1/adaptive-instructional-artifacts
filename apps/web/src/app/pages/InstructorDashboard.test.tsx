import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { InstructorDashboard } from './InstructorDashboard';

const mockStorage = vi.hoisted(() => ({
  getAllProfiles: vi.fn(),
  getProfile: vi.fn(),
  getAllInteractions: vi.fn(),
  hydrateInstructorDashboard: vi.fn(),
  cacheProfiles: vi.fn(),
  saveInteraction: vi.fn(),
}));

const mockStorageClient = vi.hoisted(() => ({
  checkBackendHealth: vi.fn(),
  getInstructorAnalyticsSummary: vi.fn(),
  getInstructorAnalyticsInteractions: vi.fn(),
}));

const mockUseUserRole = vi.hoisted(() => vi.fn());
const mockUseAuth = vi.hoisted(() => vi.fn());
const mockUseAllLearnerProfiles = vi.hoisted(() => vi.fn());

vi.mock('../lib/storage', () => ({
  storage: mockStorage,
  broadcastSync: vi.fn(),
  setDebugProfileWithSync: vi.fn(),
  setDebugStrategyWithSync: vi.fn(),
}));

vi.mock('../lib/api/storage-client', () => ({
  storageClient: mockStorageClient,
}));

vi.mock('../hooks/useUserRole', () => ({
  useUserRole: mockUseUserRole,
}));

vi.mock('../lib/auth-context', () => ({
  useAuth: mockUseAuth,
}));

vi.mock('../hooks/useLearnerProfile', () => ({
  useAllLearnerProfiles: mockUseAllLearnerProfiles,
}));

vi.mock('../lib/demo/demo-seed', () => ({
  seedDemoDataset: vi.fn(),
  resetDemoDataset: vi.fn(),
  hasDemoData: vi.fn(() => false),
}));

const baseProfile = {
  id: 'learner-1',
  name: 'Learner One',
  conceptsCovered: new Set(['joins']),
  conceptCoverageEvidence: new Map(),
  errorHistory: new Map(),
  solvedProblemIds: new Set(),
  interactionCount: 0,
  currentStrategy: 'adaptive-medium' as const,
  preferences: {
    escalationThreshold: 3,
    aggregationDelay: 6,
  },
  createdAt: Date.now(),
  lastActive: Date.now(),
};

describe('InstructorDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockUseUserRole.mockReturnValue({
      isStudent: false,
      isLoading: false,
      profile: { id: 'instructor-1' },
    });
    mockUseAuth.mockReturnValue({
      user: {
        learnerId: 'instructor-1',
        role: 'instructor',
        ownedSections: [{ id: 'section-1', name: 'Section 1' }],
      },
    });
    mockUseAllLearnerProfiles.mockReturnValue({
      profiles: [baseProfile],
      isLoading: false,
    });

    mockStorage.getAllProfiles.mockReturnValue([{ id: 'learner-1' }]);
    mockStorage.getProfile.mockReturnValue(baseProfile);
    mockStorage.getAllInteractions.mockReturnValue([]);
    mockStorage.hydrateInstructorDashboard.mockResolvedValue(undefined);
    mockStorage.cacheProfiles.mockReturnValue(undefined);

    mockStorageClient.checkBackendHealth.mockResolvedValue(true);
    mockStorageClient.getInstructorAnalyticsInteractions.mockResolvedValue({
      events: [],
      total: 44,
      limit: 5000,
      offset: 0,
      hasMore: false,
    });
  });

  it('uses backend summary metrics instead of local zero-interaction cache totals', async () => {
    mockStorageClient.getInstructorAnalyticsSummary.mockResolvedValue({
      sections: [{ id: 'section-1', name: 'Section 1', studentSignupCode: 'ABC123' }],
      totalStudents: 55,
      activeToday: 21,
      avgConceptCoverage: 21,
      avgConceptCoverageCount: 1.26,
      totalInteractions: 44,
      totalTextbookUnits: 12,
      interactionsByType: { execution: 30, error: 14 },
      recentActivity: {
        interactionLast24Hours: 12,
        interactionLast7Days: 30,
        interactionLast30Days: 44,
        activeLearnersLast24Hours: 21,
        activeLearnersLast7Days: 34,
        activeLearnersLast30Days: 55,
      },
    });

    render(
      <MemoryRouter>
        <InstructorDashboard />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('instructor-total-interactions-value').textContent).toBe('44');
    });

    expect(screen.getByTestId('instructor-total-students-value').textContent).toBe('55');
    expect(screen.getByTestId('instructor-active-today-value').textContent).toBe('21');
    expect(screen.getByTestId('instructor-avg-progress-value').textContent).toBe('21%');
  });

  it('shows a cached-data warning when backend analytics fail', async () => {
    mockStorageClient.getInstructorAnalyticsSummary.mockRejectedValue(new Error('analytics unavailable'));

    render(
      <MemoryRouter>
        <InstructorDashboard />
      </MemoryRouter>,
    );

    expect(await screen.findByText('Using Cached Data')).toBeTruthy();
    expect(screen.getByText('Showing cached local dashboard data because backend analytics could not be loaded.')).toBeTruthy();
  });
});
