/**
 * Logged hint level stays within 1-3 (GuidanceRung) for every escalation
 * profile, while each profile still escalates at the same request count.
 *
 * The slow escalator allows 4 hints (rungExhausted 4). Before the fix its 4th
 * hint was logged as hint_level 4 / guidance_view rung 4 and reached the LLM
 * prompt as "Hint level 4 rules: undefined".
 */
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState, type ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { getProblemById } from '../../../data/problems';
import {
  ADAPTIVE_ESCALATOR,
  FAST_ESCALATOR,
  SLOW_ESCALATOR,
  type EscalationProfile,
} from '../../../lib/ml/escalation-profiles';
import { buildAdaptivePrompt } from '../../../lib/ml/hint-service/llm-generation';
import type { InteractionEvent } from '../../../types';
import { ToastProvider } from '../../ui/toast';
import { HintSystem } from './HintSystem';

const saved = vi.hoisted(() => ({ events: [] as InteractionEvent[] }));

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

const mockGenerateHint = vi.hoisted(() => vi.fn());
const mockUseEnhancedHints = vi.hoisted(() => vi.fn());
const mockGetNextHint = vi.hoisted(() => vi.fn());
const mockHintCache = vi.hoisted(() => ({
  loadHintInfo: vi.fn(),
  saveHintSnapshot: vi.fn(),
  clearProblemHints: vi.fn(),
  cleanupHintCache: vi.fn(),
  migrateLegacyHintKeys: vi.fn(),
}));

vi.mock('../../../lib/storage', () => ({ storage: mockStorage }));
vi.mock('../../../hooks/useEnhancedHints', () => ({ useEnhancedHints: mockUseEnhancedHints }));
vi.mock('../../../hooks/useUserRole', () => ({ useUserRole: () => ({ isInstructor: false }) }));
vi.mock('./HintSourceStatus', () => ({ HintSourceStatus: () => <div /> }));
vi.mock('../../ui/tooltip', () => ({
  Tooltip: ({ children }: { children: ReactNode }) => <>{children}</>,
  TooltipContent: () => null,
  TooltipTrigger: ({ children }: { children: ReactNode }) => <>{children}</>,
}));
vi.mock('../../shared/SourceViewer', () => ({
  SourceViewer: () => <div />,
  RungIndicator: ({ rung }: { rung: number }) => <div>{rung}</div>,
  ConceptTag: ({ label }: { label: string }) => <span>{label}</span>,
}));
vi.mock('../../../lib/adaptive-orchestrator', () => ({
  orchestrator: {
    makeDecision: vi.fn(() => ({ decision: 'show_hint', reasoning: 'test' })),
    getNextHint: mockGetNextHint,
  },
}));
vi.mock('../../../lib/storage/hint-cache', () => mockHintCache);

const LEARNER = 'learner-1';
const SESSION = 'session-1';
const PROBLEM = 'problem-1';

function Harness({ profile }: { profile: EscalationProfile }) {
  const [events, setEvents] = useState<InteractionEvent[]>([]);
  return (
    <ToastProvider>
      <HintSystem
        learnerId={LEARNER}
        problemId={PROBLEM}
        sessionId={SESSION}
        errorSubtypeId="projection"
        escalationProfile={profile}
        recentInteractions={events}
        onInteractionLogged={(event) => setEvents((prev) => [...prev, event])}
      />
    </ToastProvider>
  );
}

const savedOfType = (type: string) => saved.events.filter((e) => e.eventType === type);
// Hint guidance views carry the hint text length; the explanation's is 0.
const hintGuidanceRungs = () =>
  mockStorage.logGuidanceView.mock.calls
    .map(([p]) => p)
    .filter((p) => p.contentLength > 0)
    .map((p) => p.rung);
const actionButton = () => screen.getByTestId('hint-action-button');
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Request hints one at a time. Returns the number of hint_view events that
 * existed when the explanation first appeared (null if it never did).
 */
async function requestHintsUntilExplanation(
  user: ReturnType<typeof userEvent.setup>,
  maxRequests: number,
): Promise<number | null> {
  for (let i = 0; i < maxRequests; i += 1) {
    await user.click(actionButton());
    await waitFor(() => expect(savedOfType('hint_view')).toHaveLength(i + 1));
    // Auto-escalation fires 500 ms after the last ladder hint.
    await sleep(700);
    if (savedOfType('explanation_view').length > 0) {
      return savedOfType('hint_view').length;
    }
  }
  return null;
}

beforeEach(() => {
  vi.clearAllMocks();
  saved.events = [];

  mockStorage.getProfile.mockReturnValue({ id: LEARNER, profileId: 'adaptive-escalator' });
  mockStorage.getInteractionsByLearner.mockReturnValue([]);
  mockStorage.saveInteraction.mockImplementation((event: InteractionEvent) => {
    saved.events.push(event);
    return { success: true };
  });
  mockStorage.logGuidanceRequest.mockReturnValue({ success: true });
  mockStorage.logGuidanceView.mockReturnValue({ success: true });
  mockStorage.logGuidanceEscalate.mockReturnValue({ success: true });
  mockStorage.logConceptView.mockReturnValue({ success: true });
  mockHintCache.loadHintInfo.mockReturnValue({ snapshot: null, removedCount: 0 });
  mockHintCache.clearProblemHints.mockReturnValue({ success: true });
  mockHintCache.saveHintSnapshot.mockReturnValue({ success: true });

  // Mirrors AdaptiveOrchestrator.getNextHint: the level comes from
  // helpRequestIndex when given, clamped to 1-3.
  mockGetNextHint.mockImplementation(
    (_subtype: string, levelIndex: number, _profile: unknown, _problemId: string, options?: { helpRequestIndex?: number }) => {
      const requested = Number.isFinite(options?.helpRequestIndex) ? Number(options?.helpRequestIndex) : levelIndex + 1;
      const level = Math.max(1, Math.min(3, requested));
      return {
        hintText: `Hint text L${level}`,
        hintLevel: level,
        sqlEngageSubtype: 'projection',
        sqlEngageRowId: 'sql-engage:projection:1',
        policyVersion: 'sql-engage-v1',
        templateId: `sql-engage-rung-${level}`,
      };
    },
  );

  // Default: the enhanced (LLM) path, where the logged level is the rung that
  // HintSystem asked for. The rung argument is what useEnhancedHints passes on
  // to the LLM prompt builder. Tests switch to the standard path with null.
  mockGenerateHint.mockImplementation(async (rung: number) => ({
    content: `Enhanced hint for rung ${rung}`,
    textbookUnits: [],
    llmGenerated: true,
    sources: { sqlEngage: true, textbook: false, llm: true, pdfPassages: false },
    retrievalConfidence: 0.8,
    fallbackReason: null,
    safetyFilterApplied: false,
    retrievedSourceIds: [],
    retrievedChunkIds: [],
    llmModel: 'test-model',
    hintSource: 'llm',
    promptVersion: 'test-prompt-v1',
  }));
  mockUseEnhancedHints.mockReturnValue({
    generateHint: mockGenerateHint,
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

afterEach(() => {
  vi.restoreAllMocks();
});

describe('HintSystem logged hint level stays within 1-3', () => {
  it.each(['enhanced', 'standard'] as const)('slow-escalator (%s path): 4 hint requests log hint_level [1,2,3,3], guidance_view rung [1,2,3,3], help_request_index [1,2,3,4], and the explanation fires after the 4th', async (path) => {
    if (path === 'standard') mockGenerateHint.mockResolvedValue(null);
    const user = userEvent.setup();
    render(<Harness profile={SLOW_ESCALATOR} />);

    const hintsBeforeExplanation = await requestHintsUntilExplanation(user, 5);

    const hintViews = savedOfType('hint_view');
    expect(hintViews.map((e) => e.hintLevel)).toEqual([1, 2, 3, 3]);
    expect(hintViews.map((e) => e.outputs?.hint_level)).toEqual([1, 2, 3, 3]);
    expect(hintViews.map((e) => e.helpRequestIndex)).toEqual([1, 2, 3, 4]);
    expect(hintViews.every((e) => !String(e.hintId).endsWith(':L4'))).toBe(true);
    expect(hintGuidanceRungs()).toEqual([1, 2, 3, 3]);
    expect(hintsBeforeExplanation).toBe(4);
    expect(savedOfType('explanation_view')).toHaveLength(1);
    expect(savedOfType('explanation_view')[0].helpRequestIndex).toBe(5);
    expect(hintViews.map((e) => e.outputs?.will_escalate)).toEqual([false, false, false, true]);
  }, 15000);


  it.each([
    ['fast', FAST_ESCALATOR, [1, 2]],
    ['adaptive', ADAPTIVE_ESCALATOR, [1, 2, 3]],
  ] as const)(
    '%s profile (enhanced path): logged levels and the request at which the explanation fires are unchanged',
    async (_name, profile, expectedLevels) => {
      const user = userEvent.setup();
      render(<Harness profile={profile} />);

      const hintsBeforeExplanation = await requestHintsUntilExplanation(user, 5);

      const hintViews = savedOfType('hint_view');
      expect(hintViews.map((e) => e.hintLevel)).toEqual([...expectedLevels]);
      expect(hintGuidanceRungs()).toEqual([...expectedLevels]);
      expect(hintsBeforeExplanation).toBe(profile.triggers.rungExhausted);
      expect(savedOfType('explanation_view')).toHaveLength(1);
      // handleShowExplanation floors the explanation's help index at 4 (existing behaviour).
      expect(savedOfType('explanation_view')[0].helpRequestIndex).toBe(Math.max(expectedLevels.length + 1, 4));
    },
    15000,
  );

  it('no LLM prompt is built with level > 3', async () => {
    const user = userEvent.setup();
    render(<Harness profile={SLOW_ESCALATOR} />);

    await requestHintsUntilExplanation(user, 5);

    const rungs = mockGenerateHint.mock.calls.map(([rung]) => rung as number);
    expect(rungs).toEqual([1, 2, 3, 3]);
    // Every SQL-Engage lookup (hints and the explanation) stays within L1-L3.
    const levelIndexes = mockGetNextHint.mock.calls.map(([, levelIndex]) => levelIndex as number);
    expect(Math.max(...levelIndexes)).toBeLessThanOrEqual(2);

    // The rung handed to generateHint becomes AdaptiveHintContext.rung.
    const problem = getProblemById(PROBLEM)!;
    for (const rung of rungs) {
      const prompt = buildAdaptivePrompt({
        rung: rung as 1 | 2 | 3,
        errorSubtype: 'projection',
        problem,
        previousHints: [],
        textbookUnits: [],
        pdfPassages: [],
        sqlEngageRecords: [],
        learningSignals: {
          latestIssue: 'projection',
          failedRunCount: 0,
          retryCount: 0,
          hintCount: 0,
          lastInteractionTypes: [],
        },
      });
      expect(prompt).not.toContain('rules: undefined');
    }
  }, 15000);
});
