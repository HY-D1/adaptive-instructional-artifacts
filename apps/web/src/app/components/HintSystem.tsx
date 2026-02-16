import { useEffect, useRef, useState } from 'react';
import { Card } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Lightbulb } from 'lucide-react';
import { HelpEventType, InteractionEvent } from '../types';
import { orchestrator } from '../lib/adaptive-orchestrator';
import { storage } from '../lib/storage';
import { createEventId } from '../lib/event-id';
import {
  canonicalizeSqlEngageSubtype
} from '../data/sql-engage';

interface HintSystemProps {
  sessionId?: string;
  learnerId: string;
  problemId: string;
  errorSubtypeId?: string;
  isSubtypeOverrideActive?: boolean;
  knownSubtypeOverride?: string;
  recentInteractions: InteractionEvent[];
  onEscalate?: (sourceInteractionIds?: string[]) => void;
  onInteractionLogged?: (event: InteractionEvent) => void;
}

export function HintSystem({ 
  sessionId,
  learnerId, 
  problemId, 
  errorSubtypeId,
  isSubtypeOverrideActive = false,
  knownSubtypeOverride,
  recentInteractions,
  onEscalate,
  onInteractionLogged
}: HintSystemProps) {
  const [hints, setHints] = useState<string[]>([]);
  const [showExplanation, setShowExplanation] = useState(false);
  const [activeHintSubtype, setActiveHintSubtype] = useState<string | null>(null);
  const MAX_DEDUPE_KEYS = 1000; // Prevent unbounded set growth
  
  const helpFlowKeyRef = useRef('');
  const nextHelpRequestIndexRef = useRef(1);
  const emittedHelpEventKeysRef = useRef<Set<string>>(new Set());
  const helpEventSequenceRef = useRef(0);
  const isProcessingHintRef = useRef(false);

  const profile = storage.getProfile(learnerId);
  const scopedInteractions = recentInteractions.filter(
    (interaction) =>
      interaction.learnerId === learnerId &&
      (!sessionId || interaction.sessionId === sessionId)
  );
  const canonicalOverrideSubtype = knownSubtypeOverride
    ? canonicalizeSqlEngageSubtype(knownSubtypeOverride)
    : undefined;
  const isCanonicalOverrideActive = isSubtypeOverrideActive && Boolean(canonicalOverrideSubtype);

  const resetHintFlow = () => {
    setHints([]);
    setShowExplanation(false);
    setActiveHintSubtype(null);
  };

  useEffect(() => {
    resetHintFlow();
  }, [learnerId, problemId, sessionId]);

  // BUG FIX #3: Only reset hint flow if subtype actually changed AND problem changed
  // Track previous override to detect actual changes
  const prevOverrideRef = useRef<{ subtype: string | undefined; problemId: string } | null>(null);
  
  useEffect(() => {
    const currentOverride = canonicalOverrideSubtype;
    const prev = prevOverrideRef.current;
    
    // Only reset if:
    // 1. We had a previous override with a different subtype AND we're on a different problem, OR
    // 2. The override state changed from inactive to active with a different subtype on same problem
    const shouldReset = prev !== null && 
      prev.problemId === problemId &&
      prev.subtype !== currentOverride;
    
    if (shouldReset) {
      resetHintFlow();
    }
    
    prevOverrideRef.current = { subtype: currentOverride, problemId };
  }, [isCanonicalOverrideActive, canonicalOverrideSubtype, problemId]);

  const getProblemTrace = () => scopedInteractions.filter((interaction) => interaction.problemId === problemId);
  const getHelpFlowKey = () => `${sessionId || 'no-session'}|${learnerId}|${problemId}`;
  
  // BUG FIX #4: Consolidated help request index calculation into single function
  const calculateHelpRequestIndex = (problemTrace: InteractionEvent[]) =>
    problemTrace.filter(
      (interaction) =>
        interaction.eventType === 'hint_view' || interaction.eventType === 'explanation_view'
    ).length + 1;
  const syncHelpFlowIndex = (problemTrace: InteractionEvent[]) => {
    const flowKey = getHelpFlowKey();
    const persistedNextHelpRequestIndex = calculateHelpRequestIndex(problemTrace);
    if (helpFlowKeyRef.current !== flowKey) {
      helpFlowKeyRef.current = flowKey;
      nextHelpRequestIndexRef.current = persistedNextHelpRequestIndex;
      emittedHelpEventKeysRef.current = new Set();
      helpEventSequenceRef.current = 0;
      return persistedNextHelpRequestIndex;
    }
    if (persistedNextHelpRequestIndex > nextHelpRequestIndexRef.current) {
      nextHelpRequestIndexRef.current = persistedNextHelpRequestIndex;
    }
    return nextHelpRequestIndexRef.current;
  };
  const allocateNextHelpRequestIndex = (problemTrace: InteractionEvent[]) => {
    const allocated = syncHelpFlowIndex(problemTrace);
    nextHelpRequestIndexRef.current = allocated + 1;
    return allocated;
  };
  const registerHelpEvent = (eventType: HelpEventType, helpRequestIndex: number) => {
    const dedupeKey = `${getHelpFlowKey()}|${eventType}|${helpRequestIndex}`;
    if (emittedHelpEventKeysRef.current.has(dedupeKey)) {
      return false;
    }
    
    // Limit deduplication set size to prevent memory growth
    if (emittedHelpEventKeysRef.current.size >= MAX_DEDUPE_KEYS) {
      // Clear oldest half of the set when limit reached
      const keys = Array.from(emittedHelpEventKeysRef.current);
      const toRemove = keys.slice(0, Math.floor(MAX_DEDUPE_KEYS / 2));
      for (const key of toRemove) {
        emittedHelpEventKeysRef.current.delete(key);
      }
    }
    
    emittedHelpEventKeysRef.current.add(dedupeKey);
    return true;
  };
  const buildHelpEventId = (prefix: 'hint' | 'explanation', helpRequestIndex: number, suffix?: string) => {
    helpEventSequenceRef.current += 1;
    return createEventId(
      prefix,
      helpRequestIndex.toString(),
      helpEventSequenceRef.current.toString(),
      suffix
    );
  };
  const buildStableHintId = (selection: {
    sqlEngageSubtype: string;
    sqlEngageRowId: string;
    hintLevel: 1 | 2 | 3;
  }) => {
    const subtype = selection.sqlEngageSubtype.trim() || 'incomplete query';
    const rowId = selection.sqlEngageRowId.trim() || 'sql-engage:fallback-synthetic';
    return `sql-engage:${subtype}:L${selection.hintLevel}:${rowId}`;
  };
  const buildStableExplanationId = (selection: {
    sqlEngageSubtype: string;
    sqlEngageRowId: string;
  }) => {
    const subtype = selection.sqlEngageSubtype.trim() || 'incomplete query';
    const rowId = selection.sqlEngageRowId.trim() || 'sql-engage:fallback-synthetic';
    return `sql-engage:${subtype}:explain:${rowId}`;
  };
  useEffect(() => {
    syncHelpFlowIndex(getProblemTrace());
  }, [sessionId, learnerId, problemId, recentInteractions]);

  /**
   * Get the hint selection for a specific help request index.
   * 
   * NOTE: This function always returns hints at levels L1-3 regardless of helpRequestIndex.
   * This is by design - after L3, learners are escalated to explanations. Higher helpRequestIndex
   * values (4+) are clamped to 3 to ensure consistent hint levels within the progressive hint ladder.
   * The helpRequestIndex is still passed through to enable escalation detection via will_escalate.
   * 
   * @param helpRequestIndex - The current help request number (1-3 for hints, 4+ for escalation)
   * @returns The hint selection for the given help request index
   */
  const getHelpSelectionForIndex = (helpRequestIndex: number) => {
    if (!profile) {
      return null;
    }
    const overrideSubtype = isCanonicalOverrideActive ? canonicalOverrideSubtype : undefined;
    const fallbackSubtype = errorSubtypeId || 'incomplete query';
    const effectiveSubtype = activeHintSubtype ||
      canonicalizeSqlEngageSubtype(overrideSubtype || fallbackSubtype);
    // Clamp level to 1-3 range - this is intentional as we only have 3 hint levels
    // before escalating to explanations (help request 4+)
    const levelForSelection = Math.max(1, Math.min(3, helpRequestIndex)) as 1 | 2 | 3;

    return orchestrator.getNextHint(
      effectiveSubtype,
      levelForSelection - 1,
      profile,
      problemId,
      {
        knownSubtypeOverride: overrideSubtype,
        isSubtypeOverrideActive: isCanonicalOverrideActive,
        helpRequestIndex
      }
    );
  };

  const handleRequestHint = () => {
    if (!profile) {
      return;
    }
    if (!sessionId) {
      return;
    }
    // Prevent race conditions from double-clicks
    if (isProcessingHintRef.current) {
      return;
    }
    isProcessingHintRef.current = true;
    const problemTrace = getProblemTrace();
    const nextHelpRequestIndex = allocateNextHelpRequestIndex(problemTrace);
    if (nextHelpRequestIndex >= 4) {
      handleShowExplanation('auto', nextHelpRequestIndex, problemTrace);
      isProcessingHintRef.current = false;
      return;
    }
    const hintSelection = getHelpSelectionForIndex(nextHelpRequestIndex);
    if (!hintSelection) {
      isProcessingHintRef.current = false;
      return;
    }
    if (!registerHelpEvent('hint_view', nextHelpRequestIndex)) {
      isProcessingHintRef.current = false;
      return;
    }

    setHints((currentHints) => [...currentHints, hintSelection.hintText]);
    setActiveHintSubtype(hintSelection.sqlEngageSubtype);
    const errorCount = problemTrace.filter((interaction) => interaction.eventType === 'error').length;
    const hintCount = problemTrace.filter((interaction) => interaction.eventType === 'hint_view').length;
    const timeSpent = problemTrace.length > 0
      ? Date.now() - problemTrace[0].timestamp
      : 0;

    // Log interaction with escalation metadata
    // will_escalate indicates that viewing this hint will trigger auto-escalation
    // This happens at hint level 3 when no explanation has been shown yet
    const willEscalate = hintSelection.hintLevel === 3 && !showExplanation;
    
    const hintEvent: InteractionEvent = {
      id: buildHelpEventId('hint', nextHelpRequestIndex),
      sessionId,
      learnerId,
      timestamp: Date.now(),
      eventType: 'hint_view',
      problemId,
      hintId: buildStableHintId(hintSelection),
      hintText: hintSelection.hintText,
      hintLevel: hintSelection.hintLevel,
      helpRequestIndex: nextHelpRequestIndex,
      sqlEngageSubtype: hintSelection.sqlEngageSubtype,
      sqlEngageRowId: hintSelection.sqlEngageRowId,
      policyVersion: hintSelection.policyVersion,
      ruleFired: 'progressive-hint',
      inputs: {
        retry_count: Math.max(0, errorCount - 1),
        hint_count: hintCount,
        time_spent_ms: timeSpent
      },
      outputs: {
        hint_level: hintSelection.hintLevel,
        help_request_index: nextHelpRequestIndex,
        sql_engage_subtype: hintSelection.sqlEngageSubtype,
        sql_engage_row_id: hintSelection.sqlEngageRowId,
        will_escalate: willEscalate,
        rule_fired: willEscalate ? 'progressive-hint-will-escalate' : 'progressive-hint'
      }
    };
    storage.saveInteraction(hintEvent);
    onInteractionLogged?.(hintEvent);
    isProcessingHintRef.current = false;

    // Escalate automatically after Hint 3 (recorded as help request 4).
    if (hintSelection.hintLevel === 3 && !showExplanation) {
      setShowExplanation(true);
      handleShowExplanation('auto', nextHelpRequestIndex + 1, [...problemTrace, hintEvent]);
    }
  };

  const handleShowExplanation = (
    source: 'auto' | 'manual' = 'auto',
    forcedHelpRequestIndex?: number,
    traceOverride?: InteractionEvent[]
  ) => {
    if (!profile || !sessionId) {
      return;
    }
    const problemTrace = traceOverride || getProblemTrace();
    const requestedHelpRequestIndex = forcedHelpRequestIndex ?? allocateNextHelpRequestIndex(problemTrace);
    const nextHelpRequestIndex = Math.max(requestedHelpRequestIndex, 4);
    nextHelpRequestIndexRef.current = Math.max(nextHelpRequestIndexRef.current, nextHelpRequestIndex + 1);
    const helpSelection = getHelpSelectionForIndex(nextHelpRequestIndex);
    if (!helpSelection) {
      return;
    }
    if (!registerHelpEvent('explanation_view', nextHelpRequestIndex)) {
      isProcessingHintRef.current = false;
      return;
    }
    setShowExplanation(true);
    const latestProblemError = [...scopedInteractions]
      .reverse()
      .find((interaction) => interaction.problemId === problemId && interaction.eventType === 'error');
    const sourceInteractionIds =
      latestProblemError
        ? [latestProblemError.id]
        : [];
    onEscalate?.(sourceInteractionIds);

    // Log interaction
    const explanationEvent: InteractionEvent = {
      id: buildHelpEventId('explanation', nextHelpRequestIndex, source),
      sessionId,
      learnerId,
      timestamp: Date.now(),
      eventType: 'explanation_view',
      problemId,
      explanationId: buildStableExplanationId(helpSelection),
      errorSubtypeId: helpSelection.sqlEngageSubtype,
      helpRequestIndex: nextHelpRequestIndex,
      sqlEngageSubtype: helpSelection.sqlEngageSubtype,
      sqlEngageRowId: helpSelection.sqlEngageRowId,
      policyVersion: helpSelection.policyVersion,
      ruleFired: 'escalation',
      inputs: {
        retry_count: Math.max(0, problemTrace.filter((interaction) => interaction.eventType === 'error').length - 1),
        hint_count: problemTrace.filter((interaction) => interaction.eventType === 'hint_view').length,
        time_spent_ms: problemTrace.length > 0 ? Date.now() - problemTrace[0].timestamp : 0
      },
      outputs: {
        explanation_requested: true,
        help_request_index: nextHelpRequestIndex,
        sql_engage_subtype: helpSelection.sqlEngageSubtype,
        sql_engage_row_id: helpSelection.sqlEngageRowId
      }
    };
    storage.saveInteraction(explanationEvent);
    onInteractionLogged?.(explanationEvent);
  };

  const decision = profile
    ? orchestrator.makeDecision(profile, scopedInteractions, problemId)
    : { decision: 'show_hint' as const, reasoning: 'Learner profile unavailable' };

  // Empty state when no profile exists
  if (!profile) {
    return (
      <Card className="p-6 text-center" data-testid="hint-panel">
        <Lightbulb className="size-12 mx-auto text-gray-300 mb-4" aria-hidden="true" />
        <h3 className="font-semibold text-lg mb-2">Hints Unavailable</h3>
        <p className="text-gray-600 text-sm">
          Create a learner profile to access personalized hints and explanations.
        </p>
      </Card>
    );
  }
  const nextHelpRequestIndex = Math.max(
    calculateHelpRequestIndex(getProblemTrace()),
    nextHelpRequestIndexRef.current
  );
  const primaryActionLabel = nextHelpRequestIndex >= 4
    ? 'Get More Help'
    : hints.length === 0
      ? 'Request Hint'
      : 'Next Hint';
  const helpStep = Math.min(nextHelpRequestIndex, 4);
  const stepMessage = nextHelpRequestIndex >= 4
    ? 'You are in explanation mode. Additional help requests provide deeper explanation support.'
    : `Request ${helpStep} gives Hint ${helpStep}.`;

  return (
    <Card className="p-4 space-y-4" data-testid="hint-panel">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Lightbulb className="size-5 text-yellow-600" />
          <h3 className="font-semibold">HintWise</h3>
        </div>
        <Badge variant={
          decision.decision === 'show_hint' ? 'default' :
          decision.decision === 'show_explanation' ? 'secondary' :
          'outline'
        } className="w-fit">
          {decision.decision.replace('_', ' ')}
        </Badge>
      </div>

      <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">
        <p className="font-medium">Help step {helpStep} of 4</p>
        <p>{stepMessage}</p>
      </div>

      {hints.length === 0 ? (
        <div className="text-center py-6 text-gray-500">
          <p>Need help? Request a hint to get started.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {hints.map((hint, idx) => (
            <div key={idx} className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
                <Badge variant="outline" className="w-fit shrink-0">
                  Hint {idx + 1}
                </Badge>
                <p className="text-sm leading-relaxed text-blue-900 break-words">{hint}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-col gap-2 sm:flex-row">
        <Button
          onClick={handleRequestHint}
          variant="outline"
          size="sm"
          className="w-full sm:flex-1"
          disabled={!profile || !sessionId}
        >
          <Lightbulb className="size-4 mr-2" />
          {primaryActionLabel}
        </Button>
        <Button
          onClick={() => handleShowExplanation('manual')}
          variant="secondary"
          size="sm"
          className="w-full sm:flex-1"
          disabled={!profile || !sessionId || !errorSubtypeId}
        >
          Show Explanation
        </Button>
      </div>

      {showExplanation && (
        <p className="text-xs text-emerald-700">
          Explanation has been generated for this help flow.
        </p>
      )}

      {decision.reasoning && (
        <div className="text-xs text-gray-500 pt-2 border-t">
          <p className="font-medium mb-1">Adaptive Decision:</p>
          <p>{decision.reasoning}</p>
          {activeHintSubtype && (
            <p className="mt-1">Hint subtype: {activeHintSubtype}</p>
          )}
        </div>
      )}
    </Card>
  );
}
