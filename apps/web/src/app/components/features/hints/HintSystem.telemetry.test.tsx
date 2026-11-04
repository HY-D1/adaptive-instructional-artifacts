/**
 * One event per help action.
 *
 * Production showed explanation_view, guidance_request and guidance_view rows
 * repeated for a single learner action. These tests render HintSystem, feed
 * logged events back in the way LearningInterface does, and count what
 * reaches storage.
 */
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState, type ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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

const mockUseEnhancedHints = vi.hoisted(() => vi.fn());
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
    getNextHint: vi.fn((subtype: string, levelIndex: number) => ({
      hintText: `Hint text L${levelIndex + 1}`,
      hintLevel: levelIndex + 1,
      sqlEngageSubtype: 'projection',
      sqlEngageRowId: 'sql-engage:projection:1',
      policyVersion: 'sql-engage-v1',
      templateId: `sql-engage-rung-${levelIndex + 1}`,
    })),
  },
}));
vi.mock('../../../lib/storage/hint-cache', () => mockHintCache);

const LEARNER = 'learner-1';
const SESSION = 'session-1';
const PROBLEM = 'problem-1';
const EXPLANATION_ID = 'sql-engage:projection:explain:sql-engage:projection:1';

type HarnessProps = {
  hsKey?: string;
  initial?: InteractionEvent[];
  onEscalate?: (ids?: string[], subtype?: string) => void;
};

function Harness({ hsKey = 'a', initial = [], onEscalate }: HarnessProps) {
  const [events, setEvents] = useState<InteractionEvent[]>(initial);
  return (
    <ToastProvider>
      <HintSystem
        key={hsKey}
        learnerId={LEARNER}
        problemId={PROBLEM}
        sessionId={SESSION}
        errorSubtypeId="projection"
        recentInteractions={events}
        onEscalate={onEscalate}
        onInteractionLogged={(event) => setEvents((prev) => [...prev, event])}
      />
    </ToastProvider>
  );
}

const savedOfType = (type: string) => saved.events.filter((e) => e.eventType === type);
const guidanceViews = (rung: number) =>
  mockStorage.logGuidanceView.mock.calls.filter(([p]) => p.rung === rung);
// The explanation's rung-2 guidance_view is the one with no content yet
// (explanation text is generated asynchronously); a level-2 hint also logs rung 2.
const explanationGuidanceViews = () =>
  guidanceViews(2).filter(([p]) => p.contentLength === 0);
const guidanceRequests = () => mockStorage.logGuidanceRequest.mock.calls.map(([p]) => p.requestType);

let nowOffset = 0;
const realNow = Date.now.bind(Date);
/** Step past the 1 s in-ref suppression window so only the real dedupe is tested. */
const jumpClock = (ms: number) => {
  nowOffset += ms;
};

const actionButton = () => screen.getByTestId('hint-action-button');

async function requestHints(user: ReturnType<typeof userEvent.setup>, count: number) {
  for (let i = 0; i < count; i += 1) {
    await user.click(actionButton());
    await waitFor(() => expect(savedOfType('hint_view')).toHaveLength(i + 1));
    await waitFor(() => expect((actionButton() as HTMLButtonElement).disabled).toBe(false));
  }
}

function historyEvent(partial: Partial<InteractionEvent> & Pick<InteractionEvent, 'id' | 'eventType' | 'timestamp'>): InteractionEvent {
  return {
    learnerId: LEARNER,
    sessionId: SESSION,
    problemId: PROBLEM,
    ...partial,
  } as InteractionEvent;
}

beforeEach(() => {
  vi.clearAllMocks();
  saved.events = [];
  nowOffset = 0;
  vi.spyOn(Date, 'now').mockImplementation(() => realNow() + nowOffset);

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

  mockUseEnhancedHints.mockReturnValue({
    // Returning null forces the standard SQL-Engage path (orchestrator.getNextHint).
    generateHint: vi.fn(async () => null),
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

describe('HintSystem telemetry: one event per help action', () => {
  it('auto-escalation timer + click produce exactly one explanation_view, one rung-2 guidance_view, one escalation_triggered per explanationId', async () => {
    const user = userEvent.setup();
    const onEscalate = vi.fn();
    render(<Harness onEscalate={onEscalate} />);

    await requestHints(user, 3);
    // The L3 hint schedules auto-escalation after 500 ms.
    await waitFor(() => expect(savedOfType('explanation_view')).toHaveLength(1), { timeout: 2000 });
    expect(onEscalate).toHaveBeenCalledTimes(1);

    // The learner then clicks "Get More Help" on the already-shown explanation.
    jumpClock(5000);
    await user.click(actionButton());
    await new Promise((resolve) => setTimeout(resolve, 50));

    const explanations = savedOfType('explanation_view');
    expect(explanations).toHaveLength(1);
    expect(explanations[0].explanationId).toBe(EXPLANATION_ID);
    expect(explanationGuidanceViews()).toHaveLength(1);
    expect(onEscalate).toHaveBeenCalledTimes(1);
  });

  it('one escalation click logs one guidance_request', async () => {
    const user = userEvent.setup();
    const t0 = realNow() - 60_000;
    // Three hints already viewed: the next click is the escalation click.
    const history = [1, 2, 3].map((level) =>
      historyEvent({
        id: `hist-hint-${level}`,
        eventType: 'hint_view',
        timestamp: t0 + level * 1000,
        hintText: `Hint text L${level}`,
        hintLevel: level as 1 | 2 | 3,
        helpRequestIndex: level,
        sqlEngageSubtype: 'projection',
      }),
    );
    render(<Harness initial={history} />);
    await screen.findByText('Hint text L3');

    await user.click(actionButton());
    await waitFor(() => expect(savedOfType('explanation_view')).toHaveLength(1));

    expect(guidanceRequests()).toEqual(['explanation']);
  });

  it('remount (new key) with an already-shown explanation does not re-log explanation_view', async () => {
    const user = userEvent.setup();
    const onEscalate = vi.fn();
    const { rerender } = render(<Harness hsKey="a" onEscalate={onEscalate} />);

    await requestHints(user, 3);
    await waitFor(() => expect(savedOfType('explanation_view')).toHaveLength(1), { timeout: 2000 });

    // LearningInterface keys HintSystem by session; a remount keeps the logged history.
    rerender(<Harness hsKey="b" onEscalate={onEscalate} />);
    await screen.findByText(/Full Explanation Unlocked/);

    await user.click(actionButton());
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(savedOfType('explanation_view')).toHaveLength(1);
    expect(explanationGuidanceViews()).toHaveLength(1);
    expect(onEscalate).toHaveBeenCalledTimes(1);
  });

  it('after the ladder restarts, a genuine second escalation logs a second explanation_view', async () => {
    const user = userEvent.setup();
    const onEscalate = vi.fn();
    // An earlier escalation on this problem, with no visible hints: the next
    // request restarts the ladder at L1.
    const history = [
      historyEvent({
        id: 'hist-explanation-1',
        eventType: 'explanation_view',
        timestamp: realNow() - 60_000,
        explanationId: EXPLANATION_ID,
        helpRequestIndex: 4,
        sqlEngageSubtype: 'projection',
      }),
    ];
    render(<Harness initial={history} onEscalate={onEscalate} />);
    await screen.findByText(/Full Explanation Unlocked/);

    await requestHints(user, 3);
    await waitFor(() => expect(savedOfType('explanation_view')).toHaveLength(1), { timeout: 2000 });

    const [second] = savedOfType('explanation_view');
    expect(second.explanationId).toBe(EXPLANATION_ID);
    expect(explanationGuidanceViews()).toHaveLength(1);
    expect(onEscalate).toHaveBeenCalledTimes(1);
  });

  it('double-click Add to Textbook logs one guidance_view(rung 3)', async () => {
    const user = userEvent.setup();
    const onEscalate = vi.fn();
    render(<Harness onEscalate={onEscalate} />);

    await user.dblClick(screen.getByRole('button', { name: /save to notes/i }));

    expect(guidanceViews(3)).toHaveLength(1);
    expect(guidanceRequests().filter((t) => t === 'textbook')).toHaveLength(1);
    expect(onEscalate).toHaveBeenCalledTimes(1);
  });

  it('hint_view count unchanged (one per hint request)', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await requestHints(user, 2);

    expect(savedOfType('hint_view')).toHaveLength(2);
    expect(guidanceRequests()).toEqual(['hint', 'hint']);
    expect(guidanceViews(1).length + guidanceViews(2).length).toBe(2);
  });
});
