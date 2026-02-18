import { useEffect, useRef, useState } from 'react';
import { Card } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Lightbulb, FileText, ChevronDown, ChevronUp, BookOpen, PlusCircle } from 'lucide-react';
import { HelpEventType, InteractionEvent, SQLProblem } from '../types';
import { orchestrator } from '../lib/adaptive-orchestrator';
import { storage } from '../lib/storage';
import { createEventId } from '../lib/event-id';
import {
  canonicalizeSqlEngageSubtype
} from '../data/sql-engage';
import { buildRetrievalBundle, RetrievalPdfPassage } from '../lib/retrieval-bundle';
import { getProblemById } from '../data/problems';
import { 
  SourceViewer, 
  RungIndicator, 
  AddToTextbookButton,
  ConceptTag 
} from './SourceViewer';
import { getConceptFromRegistry } from '../data';

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
  const [hintPdfPassages, setHintPdfPassages] = useState<RetrievalPdfPassage[][]>([]);
  const [expandedHintIndex, setExpandedHintIndex] = useState<number | null>(null);
  const [showExplanation, setShowExplanation] = useState(false);
  const [activeHintSubtype, setActiveHintSubtype] = useState<string | null>(null);
  // Week 3 D7: Ladder state
  const [currentRung, setCurrentRung] = useState<1 | 2 | 3>(1);
  const [conceptIds, setConceptIds] = useState<string[]>([]);
  const [showSourceViewer, setShowSourceViewer] = useState(false);
  const [isAddingToTextbook, setIsAddingToTextbook] = useState(false);
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
  // Simplified: override is active when we have a valid canonical subtype from instructor mode
  const isCanonicalOverrideActive = Boolean(canonicalOverrideSubtype);

  const resetHintFlow = () => {
    setHints([]);
    setHintPdfPassages([]);
    setExpandedHintIndex(null);
    setShowExplanation(false);
    setActiveHintSubtype(null);
    setCurrentRung(1);
    setConceptIds([]);
    setShowSourceViewer(false);
    // Reset refs to ensure clean state for new problem
    helpFlowKeyRef.current = '';
    nextHelpRequestIndexRef.current = 1;
    emittedHelpEventKeysRef.current = new Set();
    helpEventSequenceRef.current = 0;
    isProcessingHintRef.current = false;
  };

  // Week 3 D7: Handle "Add to My Textbook" (learner-initiated rung 3)
  const handleAddToTextbook = async () => {
    if (!sessionId || !profile) return;
    
    setIsAddingToTextbook(true);
    
    try {
      // Week 3 D8: Log guidance request for textbook
      storage.logGuidanceRequest({
        learnerId,
        problemId,
        requestType: 'textbook',
        currentRung: currentRung,
        sessionId
      });

      // Build retrieval bundle for context
      const problem = getProblemById(problemId);
      if (problem) {
        const bundle = buildRetrievalBundle({
          learnerId,
          problem,
          interactions: recentInteractions,
          lastErrorSubtypeId: activeHintSubtype || errorSubtypeId
        });
        
        // Week 3 D8: Log escalation to rung 3
        const problemTrace = getProblemTrace();
        const errorCount = problemTrace.filter((i) => i.eventType === 'error').length;
        const hintCount = problemTrace.filter((i) => i.eventType === 'hint_view').length;
        const timeSpent = problemTrace.length > 0
          ? Date.now() - problemTrace[0].timestamp
          : 0;

        storage.logGuidanceEscalate({
          learnerId,
          problemId,
          fromRung: currentRung,
          toRung: 3,
          trigger: 'learner_request',
          evidence: {
            errorCount,
            retryCount: Math.max(0, errorCount - 1),
            hintCount,
            timeSpentMs: timeSpent
          },
          sourceInteractionIds: bundle.triggerInteractionIds,
          sessionId
        });

        // Trigger escalation with textbook aggregation
        onEscalate?.(bundle.triggerInteractionIds);
        
        // Update state to rung 3
        setCurrentRung(3);

        // Week 3 D8: Log guidance view for rung 3
        storage.logGuidanceView({
          learnerId,
          problemId,
          rung: 3,
          conceptIds: bundle.conceptCandidates.map(c => c.id),
          sourceRefIds: bundle.pdfPassages.map(p => p.chunkId),
          grounded: bundle.pdfPassages.length > 0,
          contentLength: bundle.toPrompt().length,
          sessionId
        });
      }
    } finally {
      setIsAddingToTextbook(false);
    }
  };

  // Week 3 D7: Get concept labels for display
  const getConceptLabel = (conceptId: string): string => {
    const concept = getConceptFromRegistry(conceptId);
    return concept?.title || conceptId;
  };

  useEffect(() => {
    resetHintFlow();
    // Reset the override tracking ref when problem/learner/session changes
    prevOverrideRef.current = null;
  }, [learnerId, problemId, sessionId]);

  // BUG FIX #3: Only reset hint flow if subtype override changed on the SAME problem
  // This handles instructor mode when error subtype is manually changed
  const prevOverrideRef = useRef<{ subtype: string | undefined; problemId: string } | null>(null);
  
  useEffect(() => {
    const currentOverride = canonicalOverrideSubtype;
    const prev = prevOverrideRef.current;
    
    // Only reset if:
    // - We had a previous override value (not initial mount)
    // - We're still on the same problem
    // - The subtype override value actually changed
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

  // Reconstruct hints from interaction history when component mounts or problem changes
  // Use ref to track if reconstruction has already happened for this problem/session
  const hasReconstructedRef = useRef(false);
  const prevProblemLearnerSessionRef = useRef('');
  
  useEffect(() => {
    // Create a unique key for this problem/learner/session combination
    const currentKey = `${problemId}-${learnerId}-${sessionId}`;
    
    // Only reconstruct if the key changed (prevents infinite loops from recentInteractions)
    if (prevProblemLearnerSessionRef.current === currentKey) {
      return;
    }
    
    prevProblemLearnerSessionRef.current = currentKey;
    hasReconstructedRef.current = true;
    
    const problemTrace = getProblemTrace();
    const hintEvents = problemTrace.filter(
      (interaction) => interaction.eventType === 'hint_view'
    );
    
    if (hintEvents.length > 0) {
      // Reconstruct hints from saved hint events
      const reconstructedHints = hintEvents.map(event => event.hintText || '');
      setHints(reconstructedHints);
      
      // Restore active hint subtype from last hint
      const lastHint = hintEvents[hintEvents.length - 1];
      if (lastHint.sqlEngageSubtype) {
        setActiveHintSubtype(lastHint.sqlEngageSubtype);
      }
      
      // Reconstruct PDF passages for each hint
      const reconstructedPassages: RetrievalPdfPassage[][] = hintEvents.map(event => {
        if (event.sqlEngageSubtype) {
          return retrievePdfPassagesForHint(event.sqlEngageSubtype);
        }
        return [];
      });
      setHintPdfPassages(reconstructedPassages);
      
      // Check if explanation was shown
      const hasExplanation = problemTrace.some(
        (interaction) => interaction.eventType === 'explanation_view'
      );
      if (hasExplanation) {
        setShowExplanation(true);
      }
    }
  }, [problemId, learnerId, sessionId]); // Remove recentInteractions to prevent infinite loops

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

  const retrievePdfPassagesForHint = (subtype: string): RetrievalPdfPassage[] => {
    const problem = getProblemById(problemId);
    if (!problem) return [];

    const problemInteractions = getProblemTrace();
    const latestError = [...problemInteractions]
      .reverse()
      .find((interaction) => interaction.eventType === 'error');

    try {
      const bundle = buildRetrievalBundle({
        learnerId,
        problem,
        interactions: recentInteractions,
        lastErrorSubtypeId: subtype || latestError?.errorSubtypeId,
        pdfTopK: 3
      });
      // Week 3 D7: Track concept IDs from bundle
      setConceptIds(bundle.conceptCandidates.map(c => c.id));
      return bundle.pdfPassages;
    } catch {
      return [];
    }
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

    // Week 3 D8: Log guidance request event
    storage.logGuidanceRequest({
      learnerId,
      problemId,
      requestType: 'hint',
      currentRung: currentRung,
      sessionId
    });

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

    // Retrieve PDF passages for this hint
    const pdfPassages = retrievePdfPassagesForHint(hintSelection.sqlEngageSubtype);

    setHints((currentHints) => [...currentHints, hintSelection.hintText]);
    setHintPdfPassages((current) => [...current, pdfPassages]);
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

    // Week 3 D8: Log guidance view event for replay
    storage.logGuidanceView({
      learnerId,
      problemId,
      rung: hintSelection.hintLevel as 1 | 2 | 3,
      conceptIds: conceptIds.length > 0 ? conceptIds : [hintSelection.sqlEngageSubtype],
      sourceRefIds: pdfPassages.map(p => p.chunkId),
      grounded: pdfPassages.length > 0,
      contentLength: hintSelection.hintText.length,
      sessionId
    });

    isProcessingHintRef.current = false;

    // Escalate automatically after Hint 3 (recorded as help request 4).
    if (hintSelection.hintLevel === 3 && !showExplanation) {
      // Week 3 D8: Log escalation event before transitioning
      storage.logGuidanceEscalate({
        learnerId,
        problemId,
        fromRung: 1,
        toRung: 2,
        trigger: 'auto_escalation_eligible',
        evidence: {
          errorCount,
          retryCount: Math.max(0, errorCount - 1),
          hintCount,
          timeSpentMs: timeSpent
        },
        sourceInteractionIds: [hintEvent.id],
        sessionId
      });
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

    // Week 3 D8: Log guidance request for explanation
    storage.logGuidanceRequest({
      learnerId,
      problemId,
      requestType: 'explanation',
      currentRung: currentRung,
      sessionId
    });

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
    setCurrentRung(2); // Week 3 D7: Explanation is rung 2
    const latestProblemError = [...scopedInteractions]
      .reverse()
      .find((interaction) => interaction.problemId === problemId && interaction.eventType === 'error');
    const sourceInteractionIds =
      latestProblemError
        ? [latestProblemError.id]
        : [];
    onEscalate?.(sourceInteractionIds);

    // Calculate evidence for escalation logging
    const errorCount = problemTrace.filter((interaction) => interaction.eventType === 'error').length;
    const hintCount = problemTrace.filter((interaction) => interaction.eventType === 'hint_view').length;
    const timeSpent = problemTrace.length > 0 ? Date.now() - problemTrace[0].timestamp : 0;

    // Log escalation event for manual explanation requests
    if (source === 'manual' && currentRung < 2) {
      storage.logGuidanceEscalate({
        learnerId,
        problemId,
        fromRung: currentRung,
        toRung: 2,
        trigger: 'learner_request',
        evidence: {
          errorCount,
          retryCount: Math.max(0, errorCount - 1),
          hintCount,
          timeSpentMs: timeSpent
        },
        sourceInteractionIds,
        sessionId
      });
    }

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
        retry_count: Math.max(0, errorCount - 1),
        hint_count: hintCount,
        time_spent_ms: timeSpent
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

    // Week 3 D8: Log guidance view event for explanation
    storage.logGuidanceView({
      learnerId,
      problemId,
      rung: 2,
      conceptIds: conceptIds.length > 0 ? conceptIds : [helpSelection.sqlEngageSubtype],
      sourceRefIds: [],
      grounded: false, // Explanations are LLM-generated, not directly grounded
      contentLength: 0, // Explanation content is async-generated
      sessionId
    });
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
    <Card className="p-4 space-y-4 shadow-sm" data-testid="hint-panel">
      {/* Clean header with title and rung */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-amber-50 rounded-lg">
            <Lightbulb className="size-4 text-amber-500" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">Guidance Ladder</h3>
            <p className="text-xs text-gray-500">Step {helpStep} of 4</p>
          </div>
        </div>
        <RungIndicator rung={currentRung} size="sm" />
      </div>

      {/* Concept tags */}
      {conceptIds.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {conceptIds.slice(0, 3).map((conceptId) => (
            <ConceptTag 
              key={conceptId} 
              conceptId={conceptId} 
              label={getConceptLabel(conceptId)}
            />
          ))}
          {conceptIds.length > 3 && (
            <span className="text-xs text-gray-400 self-center">
              +{conceptIds.length - 3}
            </span>
          )}
        </div>
      )}

      {hints.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50/50 p-4 text-center">
          <p className="text-sm text-gray-500">Request a hint to get started</p>
        </div>
      ) : (
        <div className="space-y-3">
          {hints.map((hint, idx) => {
            const pdfPassages = hintPdfPassages[idx] || [];
            const hasPdfSources = pdfPassages.length > 0;
            const isExpanded = expandedHintIndex === idx;
            
            return (
              <div key={idx} className="rounded-lg border border-gray-100 bg-gray-50/50 p-3">
                <div className="flex items-start gap-2">
                  <span className="shrink-0 rounded-full bg-white border border-gray-200 px-2 py-0.5 text-xs font-medium text-gray-600">
                    Hint {idx + 1}
                  </span>
                  <p className="text-sm leading-relaxed text-gray-800 break-words flex-1">{hint}</p>
                </div>
                
                {hasPdfSources && (
                  <div className="mt-2 pt-2 border-t border-gray-200/50">
                    <button
                      onClick={() => setExpandedHintIndex(isExpanded ? null : idx)}
                      className="flex items-center gap-1.5 text-xs text-gray-600 hover:text-gray-900 transition-colors"
                      aria-expanded={isExpanded}
                    >
                      {isExpanded ? (
                        <ChevronUp className="size-3.5" />
                      ) : (
                        <ChevronDown className="size-3.5" />
                      )}
                      <BookOpen className="size-3.5" />
                      <span>
                        {isExpanded ? 'Hide' : `Sources (${pdfPassages.length})`}
                      </span>
                    </button>
                    
                    {isExpanded && (
                      <div className="mt-2 space-y-2">
                        <p className="text-[11px] text-blue-600 italic">
                          The following passages from your uploaded PDF were used to generate this hint:
                        </p>
                        {pdfPassages.map((passage, pidx) => (
                          <div 
                            key={passage.chunkId} 
                            className="p-2 bg-white border border-blue-100 rounded text-xs"
                          >
                            <div className="flex items-center gap-1.5 text-[10px] text-gray-500 mb-1">
                              <FileText className="size-3" />
                              <span className="font-medium">{passage.docId}</span>
                              <span>·</span>
                              <span>Page {passage.page}</span>
                              {passage.score > 0 && (
                                <span className="text-gray-400">
                                  (relevance: {(passage.score * 100).toFixed(0)}%)
                                </span>
                              )}
                            </div>
                            <p className="text-gray-700 leading-relaxed line-clamp-4">
                              {passage.text}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Week 3 D7: Source Viewer for grounded help */}
      {conceptIds.length > 0 && (
        <SourceViewer
          passages={hintPdfPassages[hintPdfPassages.length - 1]?.map(p => ({
            passageId: p.chunkId,
            conceptId: conceptIds[0] || 'general',
            docId: p.docId,
            chunkId: p.chunkId,
            page: p.page,
            text: p.text,
            whyIncluded: 'Retrieved from PDF index'
          })) || []}
          conceptLabels={Object.fromEntries(conceptIds.map(id => [id, getConceptLabel(id)]))}
          initiallyExpanded={false}
          // Week 3 D8: Pass logging props
          problemId={problemId}
          learnerId={learnerId}
          sessionId={sessionId}
        />
      )}

      <div className="flex flex-col gap-2">
        <Button
          onClick={handleRequestHint}
          variant="outline"
          className="w-full h-9 text-sm"
          disabled={!profile || !sessionId}
        >
          <Lightbulb className="size-4 mr-2 shrink-0" />
          <span className="truncate">{primaryActionLabel}</span>
        </Button>
        <div className="grid grid-cols-2 gap-2">
          <Button
            onClick={() => handleShowExplanation('manual')}
            variant="secondary"
            className="w-full h-9 text-sm px-2"
            disabled={!profile || !sessionId || !errorSubtypeId}
          >
            <span className="truncate">Explain</span>
          </Button>
          <button
            onClick={handleAddToTextbook}
            disabled={!profile || !sessionId || currentRung >= 3 || isAddingToTextbook}
            className={`
              w-full h-9 text-sm px-2 rounded-md font-medium
              inline-flex items-center justify-center gap-1
              ${(!profile || !sessionId || currentRung >= 3) 
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed' 
                : 'bg-purple-600 text-white hover:bg-purple-700'
              }
            `}
          >
            {isAddingToTextbook ? (
              <>
                <div className="size-3 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                <span className="truncate">...</span>
              </>
            ) : (
              <>
                <span>📝</span>
                <span className="truncate">Save</span>
              </>
            )}
          </button>
        </div>
      </div>

      {showExplanation && (
        <div className="rounded-md bg-emerald-50 border border-emerald-100 px-3 py-2">
          <p className="text-xs text-emerald-700">
            Explanation has been generated for this help flow.
          </p>
        </div>
      )}
    </Card>
  );
}
