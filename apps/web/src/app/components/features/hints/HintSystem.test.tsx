import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ToastProvider } from '../../ui/toast';
import { HintSystem } from './HintSystem';

const mockStorage = vi.hoisted(() => ({
  getProfile: vi.fn(),
  getInteractionsByLearner: vi.fn(),
  saveInteraction: vi.fn(),
  logGuidanceRequest: vi.fn(),
  logGuidanceView: vi.fn(),
  logGuidanceEscalate: vi.fn(),
  logConceptView: vi.fn(),
  logInteraction: vi.fn(),
}));

const mockUseEnhancedHints = vi.hoisted(() => vi.fn());
const mockHintCache = vi.hoisted(() => ({
  loadHintInfo: vi.fn(),
  saveHintSnapshot: vi.fn(),
  clearProblemHints: vi.fn(),
  cleanupHintCache: vi.fn(),
  migrateLegacyHintKeys: vi.fn(),
}));

vi.mock('../../../lib/storage', () => ({
  storage: mockStorage,
}));

vi.mock('../../../hooks/useEnhancedHints', () => ({
  useEnhancedHints: mockUseEnhancedHints,
}));

vi.mock('../../../hooks/useUserRole', () => ({
  useUserRole: () => ({ isInstructor: false }),
}));

vi.mock('./HintSourceStatus', () => ({
  HintSourceStatus: () => <div data-testid="hint-source-status" />,
}));

vi.mock('../../ui/tooltip', () => ({
  Tooltip: ({ children }: { children: ReactNode }) => <>{children}</>,
  TooltipContent: ({ children }: { children: ReactNode }) => <>{children}</>,
  TooltipTrigger: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

vi.mock('../../shared/SourceViewer', () => ({
  SourceViewer: () => <div data-testid="source-viewer" />,
  RungIndicator: ({ rung }: { rung: number }) => <div data-testid="rung-indicator">{rung}</div>,
  ConceptTag: ({ label }: { label: string }) => <span>{label}</span>,
}));

vi.mock('../../../lib/adaptive-orchestrator', () => ({
  orchestrator: {
    makeDecision: vi.fn(() => ({ decision: 'show_hint', reasoning: 'test' })),
    getNextHint: vi.fn(() => ({
      hintText: 'Try selecting only the columns you need.',
      hintLevel: 1,
      sqlEngageSubtype: 'projection',
      sqlEngageRowId: 'sql-engage:projection:1',
      policyVersion: 'sql-engage-v1',
    })),
  },
}));

vi.mock('../../../lib/telemetry/build-hint-view-event', () => ({
  buildHintViewEvent: vi.fn((input: Record<string, unknown>) => ({
    id: 'hint-event-1',
    learnerId: 'learner-1',
    sessionId: 'session-1',
    timestamp: Date.now(),
    eventType: 'hint_view',
    problemId: input.problemId ?? 'problem-1',
    hintId: input.hintId ?? 'hint-1',
    hintText: input.hintText ?? 'Try selecting only the columns you need.',
    hintLevel: input.hintLevel ?? 1,
    templateId: input.templateId ?? 'sql-engage-rung-1',
    sqlEngageSubtype: input.sqlEngageSubtype ?? 'projection',
    sqlEngageRowId: input.sqlEngageRowId ?? 'sql-engage:projection:1',
    policyVersion: input.policyVersion ?? 'sql-engage-v1',
    helpRequestIndex: input.helpRequestIndex ?? 1,
  })),
  buildStableHintId: vi.fn(() => 'hint-1'),
}));

vi.mock('../../../lib/storage/hint-cache', () => mockHintCache);

describe('HintSystem quota handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockStorage.getProfile.mockReturnValue({ id: 'learner-1', profileId: 'adaptive-escalator' });
    mockStorage.getInteractionsByLearner.mockReturnValue([]);
    mockStorage.saveInteraction.mockReturnValue({ success: true });
    mockStorage.logGuidanceRequest.mockReturnValue({ success: true });
    mockStorage.logGuidanceView.mockReturnValue({ success: true });
    mockStorage.logGuidanceEscalate.mockReturnValue({ success: true });
    mockStorage.logConceptView.mockReturnValue({ success: true });
    mockHintCache.loadHintInfo.mockReturnValue({ snapshot: null, removedCount: 0 });
    mockHintCache.cleanupHintCache.mockReturnValue({ removedCount: 0 });
    mockHintCache.migrateLegacyHintKeys.mockReturnValue({ removedCount: 0 });
    mockHintCache.clearProblemHints.mockReturnValue({ success: true });
    mockHintCache.saveHintSnapshot.mockReturnValue({
      success: false,
      quotaExceeded: true,
      diagnostic: 'hint_cache_write_skipped_quota',
    });
    mockUseEnhancedHints.mockReturnValue({
      generateHint: vi.fn(async () => ({
        content: 'Try selecting only the columns you need.',
        textbookUnits: [],
        llmGenerated: false,
        sources: { sqlEngage: true, textbook: false, llm: false, pdfPassages: false },
        retrievalConfidence: 0.5,
        fallbackReason: null,
        safetyFilterApplied: false,
        retrievedSourceIds: [],
        retrievedChunkIds: [],
      })),
      isGenerating: false,
      lastHint: null,
      availableResources: { llm: false, textbook: false, sqlEngage: true, pdfIndex: false },
      checkResources: vi.fn(),
      getStrategyDescription: vi.fn(),
      preloadContext: vi.fn(),
      error: null,
      clearError: vi.fn(),
    });
  });

  it('shows the hint and still logs telemetry when cache writes hit quota', async () => {
    const user = userEvent.setup();

    render(
      <ToastProvider>
        <HintSystem
          learnerId="learner-1"
          problemId="problem-1"
          sessionId="session-1"
          recentInteractions={[]}
        />
      </ToastProvider>,
    );

    await user.click(screen.getByRole('button', { name: /request hint/i }));

    expect(await screen.findByText('Try selecting only the columns you need.')).toBeTruthy();
    expect(await screen.findByText('Storage Full')).toBeTruthy();
    expect(screen.getByText('Hints still work, but local backup is temporarily unavailable.')).toBeTruthy();

    await waitFor(() => {
      expect(mockHintCache.saveHintSnapshot).toHaveBeenCalled();
    });
    expect(mockStorage.logGuidanceRequest).toHaveBeenCalled();
  });

  it('deduplicates the quota warning across repeated hint requests', async () => {
    const user = userEvent.setup();

    render(
      <ToastProvider>
        <HintSystem
          learnerId="learner-1"
          problemId="problem-1"
          sessionId="session-1"
          recentInteractions={[]}
        />
      </ToastProvider>,
    );

    const requestButton = screen.getByRole('button', { name: /request hint/i });
    await user.click(requestButton);
    await screen.findByText('Try selecting only the columns you need.');
    await user.click(screen.getByRole('button', { name: /next hint/i }));

    await waitFor(() => {
      expect(screen.getAllByText('Storage Full')).toHaveLength(1);
    });
  });
});
