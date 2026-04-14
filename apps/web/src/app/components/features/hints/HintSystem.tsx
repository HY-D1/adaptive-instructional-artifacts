import { useEffect, useMemo, useRef, useState } from 'react';
import { Card } from '../../ui/card';
import { Button } from '../../ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '../../ui/tooltip';
import DOMPurify from 'dompurify';

import { Lightbulb, FileText, ChevronDown, ChevronUp, BookOpen, Loader2, HelpCircle, Sparkles, AlertCircle, ThumbsUp, ThumbsDown } from 'lucide-react';
import { HelpEventType, InteractionEvent } from '../../../types';
import { orchestrator } from '../../../lib/adaptive-orchestrator';
import { storage } from '../../../lib/storage';
import { createEventId } from '../../../lib/utils/event-id';
import {
  canonicalizeSqlEngageSubtype
} from '../../../data/sql-engage';
import { buildRetrievalBundle, RetrievalPdfPassage, bundleToPrompt } from '../../../lib/content/retrieval-bundle';
import { getProblemById } from '../../../data/problems';
import { cn } from '../../ui/utils';
import { 
  SourceViewer, 
  RungIndicator, 
  ConceptTag 
} from '../../shared/SourceViewer';
import { getConceptFromRegistry } from '../../../data';

// Enhanced Hint System imports
import { useEnhancedHints } from '../../../hooks/useEnhancedHints';
import { HintSourceStatus } from './HintSourceStatus';
import type { EnhancedHint } from '../../../lib/ml/enhanced-hint-service';
import { useUserRole } from '../../../hooks/useUserRole';
import { useStorageFeedback } from '../../../hooks/useStorageFeedback';
import type { EscalationProfile } from '../../../lib/ml/escalation-profiles';
import type { SessionConfig } from '../../../types';
import { orchestrate, type OrchestrationDecision } from '../../../lib/ml/textbook-orchestrator';
import { buildHintViewEvent, buildStableHintId } from '../../../lib/telemetry/build-hint-view-event';
import { clearProblemHints, loadHintInfo, saveHintSnapshot } from '../../../lib/storage/hint-cache';

/**
 * Props for the HintSystem component
 */
interface HintSystemProps {
  /** Optional session ID for grouping interactions */
  sessionId?: string;
  /** Unique identifier for the learner */
  learnerId: string;
  /** ID of the current problem being solved */
  problemId: string;
  /** Error subtype identifier for targeted hints */
  errorSubtypeId?: string;
  /** Whether instructor subtype override is active */
  isSubtypeOverrideActive?: boolean;
  /** Subtype override value from instructor mode */
  knownSubtypeOverride?: string;
  /** Recent interaction events for context */
  recentInteractions: InteractionEvent[];
  /** Callback when escalation to explanation occurs */
  onEscalate?: (sourceInteractionIds?: string[], subtype?: string) => void;
  /** Callback when a new interaction is logged */
  onInteractionLogged?: (event: InteractionEvent) => void;
  /** Escalation profile for profile-specific thresholds (Week 5) */
  escalationProfile?: EscalationProfile | null;
  /** Session configuration for experimental conditions (Week 6) */
  sessionConfig?: SessionConfig | null;
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
  onInteractionLogged,
  escalationProfile,
  sessionConfig
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
  const [saveToNotesError, setSaveToNotesError] = useState<string | null>(null);
  const [isProcessingHint, setIsProcessingHint] = useState(false);
  const [hintRuntimeError, setHintRuntimeError] = useState<string | null>(null);
  const [autoEscalationInfo, setAutoEscalationInfo] = useState<{
    triggered: boolean;
    helpRequestCount: number;
  }>({ triggered: false, helpRequestCount: 0 });
  // Track which hints are enhanced (LLM-generated or use textbook)
  const [enhancedHintInfo, setEnhancedHintInfo] = useState<Array<{
    isEnhanced: boolean;
    sources: { sqlEngage: boolean; textbook: boolean; llm: boolean; pdfPassages: boolean };
    llmFailed?: boolean;
    llmErrorMessage?: string;
  }>>([]);
  // WS12: Track helpfulness ratings for each hint
  const [hintRatings, setHintRatings] = useState<Record<number, 'helpful' | 'not_helpful' | null>>({});
  const MAX_DEDUPE_KEYS = 1000; // Prevent unbounded set growth
  const { showWarningOnce } = useStorageFeedback();
  const hintCacheScope = useMemo(() => ({ learnerId, problemId }), [learnerId, problemId]);
  const hintCacheWarningKey = useMemo(() => `hint-cache-quota:${learnerId}:${problemId}`, [learnerId, problemId]);
  
  // Get user role for hint source display
  const { isInstructor } = useUserRole();

  // Load enhanced hint info from bounded cache on mount (backup only)
  useEffect(() => {
    const { snapshot } = loadHintInfo(hintCacheScope);
    if (snapshot?.enhancedHintInfo?.length) {
      setEnhancedHintInfo(snapshot.enhancedHintInfo);
    }
  }, [hintCacheScope]);

  // Persist best-effort hint metadata only. The cache must never block hint UX.
  useEffect(() => {
    if (hints.length === 0 && enhancedHintInfo.length === 0) {
      return;
    }

    const result = saveHintSnapshot({
      learnerId,
      problemId,
      currentRung,
      visibleHintCount: hints.length,
      lastHintId: activeHintSubtype
        ? `hint-cache:${activeHintSubtype}:${Math.max(0, nextHelpRequestIndexRef.current - 1)}`
        : undefined,
      lastHelpRequestIndex: Math.max(0, nextHelpRequestIndexRef.current - 1),
      lastHintPreview: hints[hints.length - 1],
      enhancedHintInfo,
    });

    if (result.quotaExceeded) {
      showWarningOnce(
        hintCacheWarningKey,
        'Hints still work, but local backup is temporarily unavailable.',
      );
    }
  }, [
    activeHintSubtype,
    currentRung,
    enhancedHintInfo,
    hintCacheWarningKey,
    hints,
    learnerId,
    problemId,
    showWarningOnce,
  ]);
  
  // Guidance Ladder constants - now profile-aware (Week 5)
  // Get threshold from profile or use defaults (adaptive: 3 hints)
  const maxHintLevel = escalationProfile?.triggers.rungExhausted ?? 3;
  const autoEscalationThreshold = maxHintLevel + 1; // Threshold is one past max hints
  
  const helpFlowKeyRef = useRef('');
  const nextHelpRequestIndexRef = useRef(1);
  const emittedHelpEventKeysRef = useRef<Set<string>>(new Set());
  const helpEventSequenceRef = useRef(0);
  const hintRequestVersionRef = useRef(0);
  const pendingAutoEscalationTimeoutRef = useRef<number | null>(null);
  const visibleHintCountRef = useRef(0);
  
  // Enhanced hint system hook
  const {
    generateHint: generateEnhancedHint,
    isGenerating: isGeneratingEnhanced,
    lastHint: lastEnhancedHint,
    availableResources
  } = useEnhancedHints({
    learnerId,
    problemId,
    sessionId,
    recentInteractions
  });
  
  // Track if we're using enhanced hints
  const isUsingEnhancedHints = availableResources.llm || availableResources.textbook;

  const profile = useMemo(() => storage.getProfile(learnerId), [learnerId]);
  const scopedInteractions = useMemo(
    () => recentInteractions.filter(
      (interaction) =>
        interaction.learnerId === learnerId &&
        (!sessionId || interaction.sessionId === sessionId)
    ),
    [recentInteractions, learnerId, sessionId]
  );
  const canonicalOverrideSubtype = knownSubtypeOverride
    ? canonicalizeSqlEngageSubtype(knownSubtypeOverride)
    : undefined;
  // Simplified: override is active when we have a valid canonical subtype from instructor mode
  const isCanonicalOverrideActive = Boolean(canonicalOverrideSubtype);

  const clearPendingAutoEscalation = () => {
    if (pendingAutoEscalationTimeoutRef.current !== null) {
      window.clearTimeout(pendingAutoEscalationTimeoutRef.current);
      pendingAutoEscalationTimeoutRef.current = null;
    }
  };

  const resetHintFlow = () => {
    clearPendingAutoEscalation();
    hintRequestVersionRef.current += 1;
    visibleHintCountRef.current = 0;
    setHints([]);
    setHintPdfPassages([]);
    setExpandedHintIndex(null);
    setShowExplanation(false);
    setActiveHintSubtype(null);
    setCurrentRung(1);
    setConceptIds([]);
    setShowSourceViewer(false);
    setAutoEscalationInfo({ triggered: false, helpRequestCount: 0 });
    setEnhancedHintInfo([]);
    setHintRuntimeError(null);
    clearProblemHints(hintCacheScope);
    // Reset refs to ensure clean state for new problem
    helpFlowKeyRef.current = '';
    nextHelpRequestIndexRef.current = 1;
    emittedHelpEventKeysRef.current = new Set();
    helpEventSequenceRef.current = 0;
    setIsProcessingHint(false);
  };

  // Week 3 D7: Handle "Add to My Textbook" (learner-initiated rung 3)
  const handleAddToTextbook = async () => {
    if (!sessionId || !profile) return;

    setSaveToNotesError(null);
    setIsAddingToTextbook(true);

    // Resolve the subtype to pass to the parent — use active hint subtype first,
    // then fall back to the error subtype prop from the parent.
    const subtypeForSave = activeHintSubtype || errorSubtypeId || null;

    // Resolve subtype: active hint > error prop > first concept of current problem
    const problemForSave = getProblemById(problemId);
    const firstConcept = problemForSave?.concepts?.[0] || null;
    const subtypeForSaveWithFallback = subtypeForSave || firstConcept;

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
        if (!subtypeForSaveWithFallback) {
          setSaveToNotesError('No concept context found. Try submitting a query first so the system can identify what to save.');
          setIsAddingToTextbook(false);
          return;
        }

        const bundle = buildRetrievalBundle({
          learnerId,
          problem,
          interactions: recentInteractions,
          lastErrorSubtypeId: subtypeForSaveWithFallback || undefined
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

        // Trigger escalation, passing the resolved subtype explicitly so the
        // parent does not need to infer it from interaction history.
        onEscalate?.(bundle.triggerInteractionIds, subtypeForSaveWithFallback || undefined);

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
          contentLength: bundleToPrompt(bundle).length,
          sessionId
        });
      } else {
        // No problem context — still fire the callback so the parent can save
        // using whatever subtype context it has available.
        onEscalate?.([], subtypeForSaveWithFallback || undefined);
        if (!subtypeForSaveWithFallback) {
          setSaveToNotesError('No concept context found. Try submitting a query first so the system can identify what to save.');
        }
      }
    } catch (err) {
      setSaveToNotesError((err as Error).message || 'Failed to save note. Please try again.');
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
  
  // BUG FIX #4: Consolidated help request index calculation into single function.
  // Prefer the furthest visible hint count when interaction persistence lags a rerender.
  const calculateHelpRequestIndex = (problemTrace: InteractionEvent[]) => {
    const persistedHintCount = problemTrace.filter((interaction) => interaction.eventType === 'hint_view').length;
    return Math.max(persistedHintCount, visibleHintCountRef.current) + 1;
  };
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
  const buildStableHintId = (selection: {
    sqlEngageSubtype: string;
    sqlEngageRowId: string;
    hintLevel: 1 | 2 | 3;
  }) => {
    const subtype = selection.sqlEngageSubtype.trim() || 'incomplete query';
    const rowId = selection.sqlEngageRowId.trim() || 'sql-engage:fallback-synthetic';
    return `sql-engage:${subtype}:hint:${rowId}:L${selection.hintLevel}`;
  };
  useEffect(() => {
    syncHelpFlowIndex(getProblemTrace());
  }, [sessionId, learnerId, problemId, recentInteractions]);

  useEffect(() => {
    hintRequestVersionRef.current += 1;
    clearPendingAutoEscalation();
    setHintRuntimeError(null);
  }, [sessionId, learnerId, problemId]);

  useEffect(() => {
    return () => {
      clearPendingAutoEscalation();
    };
  }, []);

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
    
    // Clear existing state first to prevent duplication
    visibleHintCountRef.current = 0;
    setHints([]);
    setHintPdfPassages([]);
    setEnhancedHintInfo([]);
    
    // Try to get problem trace from recentInteractions first
    let problemTrace = getProblemTrace();
    
    // If empty, load from storage for the same learner/session/problem only.
    // Never mix cross-session history into current ladder reconstruction.
    if (problemTrace.length === 0) {
      const allInteractions = storage.getInteractionsByLearner(learnerId);
      problemTrace = allInteractions.filter(
        (i) =>
          i.problemId === problemId &&
          i.learnerId === learnerId &&
          (!sessionId || i.sessionId === sessionId)
      );
    }
    
    const hintEvents = problemTrace.filter(
      (interaction) => interaction.eventType === 'hint_view'
    );
    const explanationEvents = problemTrace.filter(
      (interaction) => interaction.eventType === 'explanation_view'
    );
    const latestHelpEvent = [...hintEvents, ...explanationEvents]
      .sort((a, b) => a.timestamp - b.timestamp)
      .at(-1);
    
    if (hintEvents.length > 0) {
      // Reconstruct hints from saved hint events
      const reconstructedHints = hintEvents.map(event => event.hintText || '');
      visibleHintCountRef.current = reconstructedHints.length;
      setHints(reconstructedHints);
      
      // Restore active subtype from latest help event
      if (latestHelpEvent?.sqlEngageSubtype) {
        setActiveHintSubtype(latestHelpEvent.sqlEngageSubtype);
      }
      
      // Reconstruct PDF passages for each hint
      const reconstructedPassages: RetrievalPdfPassage[][] = hintEvents.map(event => {
        if (event.sqlEngageSubtype) {
          return retrievePdfPassagesForHint(event.sqlEngageSubtype);
        }
        return [];
      });
      setHintPdfPassages(reconstructedPassages);
      
      // Reconstruct enhanced hint info from history
      const reconstructedEnhancedInfo = hintEvents.map(event => ({
        isEnhanced: Boolean(event.outputs?.is_enhanced),
        sources: {
          sqlEngage: true,
          textbook: Boolean(event.outputs?.is_enhanced),
          llm: event.ruleFired === 'enhanced-hint',
          pdfPassages: (event.retrievedSourceIds || []).some(id => id.includes('doc-'))
        },
        llmFailed: Boolean(event.outputs?.llm_failed),
        llmErrorMessage: typeof event.outputs?.llm_error_message === 'string' ? event.outputs.llm_error_message : undefined
      }));
      setEnhancedHintInfo(reconstructedEnhancedInfo);
      
    } else if (latestHelpEvent?.sqlEngageSubtype) {
      setActiveHintSubtype(latestHelpEvent.sqlEngageSubtype);
    }

    // Reconstruct explanation state even when there are no visible hints.
    const hasExplanation = explanationEvents.length > 0;
    if (hasExplanation) {
      const latestExplanation = explanationEvents[explanationEvents.length - 1];
      const helpRequestCount = latestExplanation?.helpRequestIndex ?? explanationEvents.length;
      setShowExplanation(true);
      setCurrentRung(2);
      setAutoEscalationInfo({
        triggered: true,
        helpRequestCount
      });
    }
  }, [problemId, learnerId, sessionId]);
  // Note: recentInteractions is intentionally omitted from deps to prevent infinite loops.
  // This effect loads historical data once on mount/problem change, not on every interaction update.
  
  // Cleanup per-problem hint cache when the component unmounts or problem changes
  useEffect(() => {
    return () => {
      clearProblemHints(hintCacheScope);
    };
  }, [hintCacheScope]);

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
    // Clamp level to valid hint range - this is intentional as we only have maxHintLevel
    // hint levels before escalating to explanations (help request autoEscalationThreshold+)
    const levelForSelection = Math.max(1, Math.min(maxHintLevel, helpRequestIndex)) as 1 | 2 | 3;

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
  
  /**
   * Generate enhanced hint using available resources (Textbook + LLM)
   * Falls back to standard SQL-Engage hints if enhanced resources unavailable
   */
  const generateEnhancedHintForRung = async (rung: 1 | 2 | 3): Promise<{
    hintText: string;
    hintLevel: 1 | 2 | 3;
    sqlEngageSubtype: string;
    sqlEngageRowId: string;
    policyVersion: string;
    templateId: string;
    pdfPassages: RetrievalPdfPassage[];
    isEnhanced: boolean;
    retrievalConfidence: number;
    fallbackReason?: string | null;
    safetyFilterApplied: boolean;
    retrievedSourceIds: string[];
    retrievedChunkIds: string[];
    llmFailed?: boolean;
    llmErrorMessage?: string;
  } | null> => {
    if (!profile) return null;
    
    const overrideSubtype = isCanonicalOverrideActive ? canonicalOverrideSubtype : undefined;
    const fallbackSubtype = errorSubtypeId || 'incomplete query';
    const effectiveSubtype = activeHintSubtype ||
      canonicalizeSqlEngageSubtype(overrideSubtype || fallbackSubtype);
    
    try {
      // Try to generate enhanced hint
      const enhancedHint = await generateEnhancedHint(rung, effectiveSubtype);
      
      if (enhancedHint) {
        // Convert concept IDs to PDF passages if available
        const pdfPassages: RetrievalPdfPassage[] = [];
        
        // If we have textbook units, we could convert them to passage format
        if (enhancedHint.textbookUnits) {
          for (const unit of enhancedHint.textbookUnits) {
            pdfPassages.push({
              chunkId: `textbook:${unit.id}`,
              docId: 'learner-textbook',
              text: unit.content.substring(0, 200) + '...',
              page: 0,
              score: 0.9
            });
          }
        }
        
        return {
          hintText: enhancedHint.content,
          hintLevel: rung,
          sqlEngageSubtype: effectiveSubtype,
          sqlEngageRowId: enhancedHint.llmGenerated ? 'llm-generated' : 'sql-engage-enhanced',
          policyVersion: enhancedHint.llmGenerated ? 'enhanced-llm-v1' : 'sql-engage-v1',
          templateId: enhancedHint.llmGenerated ? 'llm-template' : `sql-engage-rung-${rung}`,
          pdfPassages,
          isEnhanced: enhancedHint.llmGenerated || enhancedHint.sources.textbook,
          retrievalConfidence: enhancedHint.retrievalConfidence,
          fallbackReason: enhancedHint.fallbackReason,
          safetyFilterApplied: enhancedHint.safetyFilterApplied,
          retrievedSourceIds: enhancedHint.retrievedSourceIds,
          retrievedChunkIds: enhancedHint.retrievedChunkIds,
          llmFailed: enhancedHint.llmFailed,
          llmErrorMessage: enhancedHint.llmErrorMessage
        };
      }
    } catch {
      // Enhanced hint generation failed - using fallback
    }
    
    // Fallback to standard hint
    const standardHint = getHelpSelectionForIndex(rung);
    if (!standardHint) return null;
    
    const pdfPassages = retrievePdfPassagesForHint(standardHint.sqlEngageSubtype);
    
    // Defensive: ensure templateId is always present
    const templateId = standardHint.templateId?.trim() || `sql-engage-rung-${standardHint.hintLevel}`;
    if (!standardHint.templateId?.trim() && import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.warn(`[HintSystem] standardHint missing templateId, using fallback: ${templateId}`, {
        sqlEngageSubtype: standardHint.sqlEngageSubtype,
        hintLevel: standardHint.hintLevel,
      });
    }
    
    return {
      hintText: standardHint.hintText,
      hintLevel: standardHint.hintLevel,
      sqlEngageSubtype: standardHint.sqlEngageSubtype,
      sqlEngageRowId: standardHint.sqlEngageRowId,
      policyVersion: standardHint.policyVersion,
      templateId,
      pdfPassages,
      isEnhanced: false,
      retrievalConfidence: 0.5,
      fallbackReason: 'enhanced_hint_unavailable',
      safetyFilterApplied: false,
      retrievedSourceIds: [],
      retrievedChunkIds: [],
      llmFailed: false
    };
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

  // WS12: Log hint helpfulness feedback
  const logHintHelpfulness = (hintIndex: number, rating: 'helpful' | 'not_helpful') => {
    if (!sessionId) return;

    const helpfulnessEvent: InteractionEvent = {
      id: createEventId('hint-helpfulness', problemId, hintIndex),
      learnerId,
      sessionId,
      timestamp: Date.now(),
      eventType: 'hint_helpfulness_rating',
      problemId,
      hintIndex,
      helpfulnessRating: rating,
      rung: (hintIndex + 1) as 1 | 2 | 3,
    };

    storage.logInteraction(helpfulnessEvent);
    onInteractionLogged?.(helpfulnessEvent);
  };

  const handleShowExplanation = async (
    source: 'auto' | 'manual' = 'auto',
    forcedHelpRequestIndex?: number,
    traceOverride?: InteractionEvent[],
    orchestrationDecision?: OrchestrationDecision
  ) => {
    if (!profile || !sessionId) {
      return;
    }
    clearPendingAutoEscalation();
    setHintRuntimeError(null);

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
    const isNewEvent = registerHelpEvent('explanation_view', nextHelpRequestIndex);
    
    // Always show explanation and call onEscalate, even if event was already logged
    // This ensures the explanation UI is shown when user clicks "Get More Help"
    setShowExplanation(true);
    setCurrentRung(2); // Week 3 D7: Explanation is rung 2
    const latestProblemError = [...scopedInteractions]
      .reverse()
      .find((interaction) => interaction.problemId === problemId && interaction.eventType === 'error');
    const sourceInteractionIds =
      latestProblemError
        ? [latestProblemError.id]
        : [];
    // Pass the active hint subtype explicitly so the parent does not need to
    // infer it from interaction history (fixes Save-to-Notes silent failure
    // when no SQL error has been submitted yet).
    onEscalate?.(sourceInteractionIds, activeHintSubtype || errorSubtypeId || undefined);

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

    // Only log interaction if this is a new event (not a duplicate)
    if (isNewEvent) {
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
        ruleFired: orchestrationDecision?.escalationTriggerReason ?? 'escalation',
        // RESEARCH-4 canonical fields from the orchestration decision
        escalationTriggerReason: orchestrationDecision?.escalationTriggerReason,
        errorCountAtEscalation: orchestrationDecision?.errorCountAtDecision,
        timeToEscalation: orchestrationDecision?.timeToDecision,
        corpusConceptId: orchestrationDecision?.corpusConceptId ?? undefined,
        conditionId: sessionConfig?.conditionId,
        strategyAssigned: sessionConfig?.conditionId ?? sessionConfig?.escalationPolicy,
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
    }
  };
  const handleRequestHint = async () => {
    if (!profile) {
      return;
    }
    if (!sessionId) {
      return;
    }
    // Prevent race conditions from double-clicks
    if (isProcessingHint) {
      return;
    }
    setIsProcessingHint(true);
    setHintRuntimeError(null);
    clearPendingAutoEscalation();

    const requestVersion = hintRequestVersionRef.current + 1;
    hintRequestVersionRef.current = requestVersion;
    const isStaleRequest = () => hintRequestVersionRef.current !== requestVersion;

    try {
      // Week 3 D8: Log guidance request event
      storage.logGuidanceRequest({
        learnerId,
        problemId,
        requestType: 'hint',
        currentRung: currentRung,
        sessionId
      });

      const problemTrace = getProblemTrace();
      const hasExplanationHistory = problemTrace.some(
        (interaction) => interaction.eventType === 'explanation_view'
      );
      const shouldResetToHintL1 =
        hints.length === 0 && (showExplanation || autoEscalationInfo.triggered || hasExplanationHistory);

      // If we are in explanation mode with no visible hints, reset ladder state
      // and restart at L1 for this problem.
      if (shouldResetToHintL1) {
        clearPendingAutoEscalation();
        visibleHintCountRef.current = 0;
        setHints([]);
        setHintPdfPassages([]);
        setExpandedHintIndex(null);
        setShowExplanation(false);
        setCurrentRung(1);
        setConceptIds([]);
        setShowSourceViewer(false);
        setAutoEscalationInfo({ triggered: false, helpRequestCount: 0 });
        setEnhancedHintInfo([]);
        setHintRuntimeError(null);
        clearProblemHints(hintCacheScope);
        nextHelpRequestIndexRef.current = 1;
        emittedHelpEventKeysRef.current = new Set();
        helpEventSequenceRef.current = 0;
      }

      // If explanations are already active and we are not in reset mode, stay in explanation path.
      if (!shouldResetToHintL1 && (showExplanation || autoEscalationInfo.triggered)) {
        await handleShowExplanation('manual', undefined, problemTrace);
        return;
      }

      const nextHelpRequestIndex = allocateNextHelpRequestIndex(problemTrace);
      let orchestrationDecisionForHint: OrchestrationDecision | undefined;

      // --- Canonical orchestration decision (Week 6) ---
      // When a session condition is assigned, use textbook-orchestrator as the single
      // decision source for escalation (replaces immediateExplanationMode check and
      // autoEscalationThreshold check).
      if (sessionConfig) {
        const retryCount = problemTrace.filter(i => i.eventType === 'error').length;
        const hintCountForOrchestration = problemTrace.filter(i => i.eventType === 'hint_view').length;
        const elapsedMs = problemTrace.length > 0 ? Date.now() - problemTrace[0].timestamp : 0;
        // Use first available concept ID for corpus resolution; fall back to error subtype
        const conceptId = conceptIds[0] || activeHintSubtype || errorSubtypeId || 'unknown';

        const decision = orchestrate({
          conceptId,
          retryCount,
          hintCount: hintCountForOrchestration,
          elapsedMs,
          sessionConfig: {
            textbookDisabled: sessionConfig.textbookDisabled ?? false,
            adaptiveLadderDisabled: sessionConfig.adaptiveLadderDisabled ?? false,
            immediateExplanationMode: sessionConfig.immediateExplanationMode ?? false,
            staticHintMode: sessionConfig.staticHintMode ?? false,
          },
        });

        if (decision.action === 'show_explanation') {
          if (!isStaleRequest()) {
            setAutoEscalationInfo({ triggered: true, helpRequestCount: nextHelpRequestIndex });
          }
          await handleShowExplanation('auto', nextHelpRequestIndex, problemTrace, decision);
          return;
        }
        if (decision.action !== 'stay_hint') {
          orchestrationDecisionForHint = decision;
        }
      } else if (nextHelpRequestIndex >= autoEscalationThreshold) {
        // Fallback when no session config: use legacy hint-count threshold
        if (!isStaleRequest()) {
          setAutoEscalationInfo({ triggered: true, helpRequestCount: nextHelpRequestIndex });
        }
        await handleShowExplanation('auto', nextHelpRequestIndex, problemTrace);
        return;
      }

      // Determine rung level for this hint
      const levelForSelection = Math.max(1, Math.min(maxHintLevel, nextHelpRequestIndex)) as 1 | 2 | 3;

      // Try to generate enhanced hint (uses LLM/Textbook if available)
      let hintSelection: {
        hintText: string;
        hintLevel: 1 | 2 | 3;
        sqlEngageSubtype: string;
        sqlEngageRowId: string;
        policyVersion: string;
        templateId: string;
        pdfPassages: RetrievalPdfPassage[];
        isEnhanced: boolean;
        retrievalConfidence: number;
        fallbackReason?: string | null;
        safetyFilterApplied: boolean;
        retrievedSourceIds: string[];
        retrievedChunkIds: string[];
        llmFailed?: boolean;
        llmErrorMessage?: string;
      } | null = null;

      try {
        hintSelection = await generateEnhancedHintForRung(levelForSelection);
      } catch {
        // Enhanced hint failed - using fallback
      }

      if (isStaleRequest()) {
        return;
      }

      // Fallback to standard hint if enhanced generation failed
      if (!hintSelection) {
        const standardHint = getHelpSelectionForIndex(nextHelpRequestIndex);
        if (!standardHint) {
          setHintRuntimeError('Hint generation returned no usable guidance. Please retry.');
          return;
        }
        const pdfPassages = retrievePdfPassagesForHint(standardHint.sqlEngageSubtype);
        hintSelection = {
          hintText: standardHint.hintText,
          hintLevel: standardHint.hintLevel,
          sqlEngageSubtype: standardHint.sqlEngageSubtype,
          sqlEngageRowId: standardHint.sqlEngageRowId,
          policyVersion: standardHint.policyVersion,
          templateId: `sql-engage-rung-${standardHint.hintLevel}`,
          pdfPassages,
          isEnhanced: false,
          retrievalConfidence: 0.5,
          fallbackReason: 'standard_hint_fallback',
          safetyFilterApplied: false,
          retrievedSourceIds: [],
          retrievedChunkIds: [],
        };
      }

      if (!registerHelpEvent('hint_view', nextHelpRequestIndex)) {
        return;
      }

      setHints((currentHints) => {
        const nextHints = [...currentHints, hintSelection.hintText];
        visibleHintCountRef.current = nextHints.length;
        return nextHints;
      });
      setHintPdfPassages((current) => [...current, hintSelection.pdfPassages]);
      setEnhancedHintInfo((current) => [...current, {
        isEnhanced: hintSelection.isEnhanced,
        sources: hintSelection.isEnhanced
          ? { sqlEngage: true, textbook: availableResources.textbook, llm: availableResources.llm, pdfPassages: hintSelection.pdfPassages.length > 0 }
          : { sqlEngage: true, textbook: false, llm: false, pdfPassages: false },
        llmFailed: hintSelection.llmFailed,
        llmErrorMessage: hintSelection.llmErrorMessage
      }]);
      setActiveHintSubtype(hintSelection.sqlEngageSubtype);
      const errorCount = problemTrace.filter((interaction) => interaction.eventType === 'error').length;
      const hintCount = problemTrace.filter((interaction) => interaction.eventType === 'hint_view').length;
      const timeSpent = problemTrace.length > 0
        ? Date.now() - problemTrace[0].timestamp
        : 0;

      // Log interaction with escalation metadata
      // will_escalate indicates that viewing this hint will trigger auto-escalation
      // This happens at max hint level when no explanation has been shown yet
      const willEscalate = hintSelection.hintLevel === maxHintLevel && !showExplanation;
      const retrievedChunkIds = Array.from(
        new Set([
          ...hintSelection.retrievedChunkIds,
          ...hintSelection.pdfPassages.map((passage) => passage.chunkId).filter(Boolean),
        ]),
      );
      const retrievedSourceIds = Array.from(
        new Set([
          ...hintSelection.retrievedSourceIds,
          ...retrievedChunkIds,
        ]),
      );

      // Defensive validation: ensure templateId is always present for research contract
      const finalTemplateId = hintSelection.templateId?.trim() || `sql-engage-rung-${hintSelection.hintLevel}`;
      if (finalTemplateId !== hintSelection.templateId && import.meta.env.DEV) {
        // eslint-disable-next-line no-console
        console.warn(`[HintSystem] templateId was empty, using fallback: ${finalTemplateId}`, {
          hintLevel: hintSelection.hintLevel,
          sqlEngageSubtype: hintSelection.sqlEngageSubtype,
        });
      }

      // Build hint event using centralized helper for research contract compliance
      const hintEvent = buildHintViewEvent({
        id: buildHelpEventId('hint', nextHelpRequestIndex),
        sessionId,
        learnerId,
        problemId,
        hintId: buildStableHintId({
          sqlEngageSubtype: hintSelection.sqlEngageSubtype,
          sqlEngageRowId: hintSelection.sqlEngageRowId,
          hintLevel: hintSelection.hintLevel,
        }),
        hintText: hintSelection.hintText,
        hintLevel: hintSelection.hintLevel,
        templateId: finalTemplateId,
        sqlEngageSubtype: hintSelection.sqlEngageSubtype,
        sqlEngageRowId: hintSelection.sqlEngageRowId,
        policyVersion: hintSelection.policyVersion,
        helpRequestIndex: nextHelpRequestIndex,
        ruleFired: hintSelection.isEnhanced ? 'enhanced-hint' : 'progressive-hint',
        retrievedSourceIds,
        retrievedChunks: hintSelection.pdfPassages.map((passage) => ({
          docId: passage.docId,
          page: passage.page,
          chunkId: passage.chunkId,
          score: passage.score,
          snippet: passage.text.slice(0, 240),
        })),
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
          template_id: hintSelection.templateId,
          will_escalate: willEscalate,
          rule_fired: willEscalate ? 'progressive-hint-will-escalate' : (hintSelection.isEnhanced ? 'enhanced-hint' : 'progressive-hint'),
          is_enhanced: hintSelection.isEnhanced,
          llm_failed: hintSelection.llmFailed || false,
          llm_error_message: hintSelection.llmErrorMessage || null,
          retrieval_confidence: Number(hintSelection.retrievalConfidence.toFixed(4)),
          fallback_reason: hintSelection.fallbackReason || null,
          safety_filter_applied: hintSelection.safetyFilterApplied,
          retrieved_source_ids: retrievedSourceIds,
          retrieved_chunk_ids: retrievedChunkIds,
          orchestration_action: orchestrationDecisionForHint?.action ?? 'stay_hint',
          orchestration_reason: orchestrationDecisionForHint?.reason ?? null,
          orchestration_trigger_reason: orchestrationDecisionForHint?.escalationTriggerReason ?? null,
        },
        conditionId: sessionConfig?.conditionId
      });
      storage.saveInteraction(hintEvent);
      onInteractionLogged?.(hintEvent);
      for (const conceptId of conceptIds.filter(Boolean)) {
        storage.logConceptView({
          learnerId,
          sessionId,
          problemId,
          conceptId,
          source: 'hint',
        });
      }

      // Week 3 D8: Log guidance view event for replay
      storage.logGuidanceView({
        learnerId,
        problemId,
        rung: hintSelection.hintLevel as 1 | 2 | 3,
        conceptIds: conceptIds.length > 0 ? conceptIds : [hintSelection.sqlEngageSubtype],
        sourceRefIds: hintSelection.pdfPassages.map(p => p.chunkId),
        grounded: hintSelection.pdfPassages.length > 0,
        contentLength: hintSelection.hintText.length,
        sessionId
      });

      // Escalate automatically after max hint level reached.
      if (hintSelection.hintLevel === maxHintLevel && !showExplanation) {
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

        // Delay auto-escalation slightly so user can see the L3 hint first
        clearPendingAutoEscalation();
        pendingAutoEscalationTimeoutRef.current = window.setTimeout(() => {
          pendingAutoEscalationTimeoutRef.current = null;
          if (isStaleRequest()) {
            return;
          }
          setShowExplanation(true);
          setAutoEscalationInfo({ triggered: true, helpRequestCount: nextHelpRequestIndex });
          // Re-run canonical orchestrator with updated hint count for canonical RESEARCH-4 fields
          const traceForDecision = [...problemTrace, hintEvent];
          const rungExhaustedDecision = sessionConfig
            ? orchestrate({
                conceptId: conceptIds[0] || activeHintSubtype || errorSubtypeId || 'unknown',
                retryCount: errorCount,
                hintCount: hintCount + 1, // include the hint we just showed
                elapsedMs: timeSpent,
                sessionConfig: {
                  textbookDisabled: sessionConfig.textbookDisabled ?? false,
                  adaptiveLadderDisabled: sessionConfig.adaptiveLadderDisabled ?? false,
                  immediateExplanationMode: sessionConfig.immediateExplanationMode ?? false,
                  staticHintMode: sessionConfig.staticHintMode ?? false,
                },
              })
            : undefined;
          void handleShowExplanation('auto', nextHelpRequestIndex + 1, traceForDecision, rungExhaustedDecision);
        }, 500);
      }
    } catch (error) {
      if (!isStaleRequest()) {
        const message =
          error instanceof Error && error.message.trim().length > 0
            ? error.message
            : 'Hint request failed. Please retry.';
        setHintRuntimeError(message);
      }
    } finally {
      if (!isStaleRequest()) {
        setIsProcessingHint(false);
      }
    }
  };


  const decision = profile
    ? orchestrator.makeDecision(profile, scopedInteractions, problemId, { sessionConfig })
    : { decision: 'show_hint' as const, reasoning: 'Learner profile unavailable' };

  // Empty state when no profile exists
  if (!profile) {
    return (
      <Card className="p-6 text-center" data-testid="hint-panel">
        <Lightbulb className="size-12 mx-auto text-gray-300 mb-4" aria-hidden="true" />
        <h3 className="font-semibold text-lg mb-2">Hints Unavailable</h3>
        <p className="text-gray-600 dark:text-gray-300 text-sm">
          Create a learner profile to access personalized hints and explanations.
        </p>
      </Card>
    );
  }
  const helpHistoryTrace = getProblemTrace();
  const nextHelpRequestIndex = Math.max(
    calculateHelpRequestIndex(helpHistoryTrace),
    nextHelpRequestIndexRef.current
  );
  const hasExplanationHistory = helpHistoryTrace.some(
    (interaction) => interaction.eventType === 'explanation_view'
  );
  const shouldOfferHintReset =
    hints.length === 0 && (showExplanation || autoEscalationInfo.triggered || hasExplanationHistory);
  const primaryActionLabel = shouldOfferHintReset
    ? 'Request Hint'
    : nextHelpRequestIndex >= autoEscalationThreshold
      ? 'Get More Help'
      : hints.length === 0
        ? 'Request Hint'
        : 'Next Hint';
  // Count hints that have been actually viewed - use hints.length directly to ensure sync
  const hintProgress = showExplanation 
    ? Math.min(hints.length + 1, 4)  // Hints + explanation mode
    : Math.min(hints.length, 3);      // Just hints (capped at 3)
  const stepMessage = nextHelpRequestIndex >= autoEscalationThreshold
    ? 'You are in explanation mode. Additional help requests provide deeper explanation support.'
    : `Request ${hintProgress} gives Hint ${hintProgress}.`;

  return (
    <Card className="p-4 space-y-4 shadow-sm" data-testid="hint-panel">
      {/* Clean header with title and rung */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-amber-50 rounded-lg">
            <Lightbulb className="size-4 text-amber-500" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-gray-100">Guidance Ladder</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {showExplanation 
                ? `Explain • ${Math.min(hints.length, 3)}/3`
                : `Hint ${hintProgress} of 3`
              }
            </p>
          </div>
        </div>
        <RungIndicator rung={currentRung} size="sm" />
      </div>

      {/* Hint Source Status - Shows which resources are being used */}
      <HintSourceStatus 
        learnerId={learnerId} 
        showDetails={false}
        className="self-start"
        studentMode={!isInstructor}
      />

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

      {/* Accessibility: Announce new hints to screen readers */}
      {hints.length > 0 && (
        <div 
          role="status" 
          aria-live="polite" 
          aria-atomic="true"
          className="sr-only"
        >
          New hint available: {hints[hints.length - 1]
            .replace(/\*\*/g, '')
            .replace(/\*/g, '')
            .replace(/_/g, '')
            .replace(/` /g, '')
            .replace(/#{1,6}\s*/g, '')
            .substring(0, 200)}
        </div>
      )}
      
      {hints.length === 0 ? (
        <div data-testid="hint-empty-state" className="rounded-lg border border-dashed border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50 p-6 text-center">
          <div className="p-2 bg-amber-50 dark:bg-amber-900/30 rounded-full w-fit mx-auto mb-3">
            <HelpCircle className="size-5 text-amber-500" />
          </div>
          <p className="text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Need help?</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">Request a hint to get personalized guidance</p>
          <div className="mt-3 flex items-center justify-center gap-1 text-[10px] text-gray-400 dark:text-gray-500">
            <span>Progresses through</span>
            <span className="font-medium text-amber-600 dark:text-amber-400">L1</span>
            <span>→</span>
            <span className="font-medium text-amber-600 dark:text-amber-400">L2</span>
            <span>→</span>
            <span className="font-medium text-amber-600 dark:text-amber-400">L3</span>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {hints.map((hint, idx) => {
            const pdfPassages = hintPdfPassages[idx] || [];
            const hasPdfSources = pdfPassages.length > 0;
            const isExpanded = expandedHintIndex === idx;
            const enhancedInfo = enhancedHintInfo[idx];
            const isEnhanced = enhancedInfo?.isEnhanced;
            const usesLLM = enhancedInfo?.sources.llm;
            const usesTextbook = enhancedInfo?.sources.textbook;
            
            return (
              <div key={idx} className={cn(
                "rounded-lg border-l-4 bg-white dark:bg-gray-800 shadow-sm overflow-hidden",
                isEnhanced 
                  ? "border-l-purple-400 border-purple-100 dark:border-purple-900/30" 
                  : "border-l-blue-400 border-gray-100 dark:border-gray-700"
              )} data-testid={`hint-card-${idx}`}>
                {/* Inner card for cleaner separation */}
                <div className="p-4">
                  {/* Compact header: level badge and AI badge on same line */}
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      {/* Level badge - compact */}
                      <span className={cn(
                        "shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold",
                        idx === 0 ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300" :
                        idx === 1 ? "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300" :
                        "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300"
                      )}>
                        <span data-testid={`hint-label-${idx + 1}`}>{`Hint ${idx + 1}`}</span>
                        <span className="ml-1 opacity-70">{`L${idx + 1}`}</span>
                      </span>
                      
                      {/* AI badge only - most important, compact */}
                      {isEnhanced && usesLLM && (
                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300">
                          <Sparkles className="size-3" />
                          AI
                        </span>
                      )}
                      
                      {/* LLM failed badge - shows when AI was requested but unavailable */}
                      {enhancedInfo?.llmFailed && (
                        <span 
                          className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-100 text-amber-700"
                          title={enhancedInfo.llmErrorMessage || 'AI service unavailable'}
                        >
                          <AlertCircle className="size-3" />
                          AI Offline
                        </span>
                      )}
                    </div>
                    
                    {/* Sources toggle button - right side */}
                    {hasPdfSources && (
                      <button
                        onClick={() => setExpandedHintIndex(isExpanded ? null : idx)}
                        className="flex items-center gap-1 text-[11px] text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
                        aria-expanded={isExpanded}
                        aria-controls={`hint-sources-${idx}`}
                      >
                        <BookOpen className="size-3" />
                        {isExpanded ? (
                          <>
                            <ChevronUp className="size-3" />
                            <span>Hide Textbook Source</span>
                          </>
                        ) : (
                          <>
                            <ChevronDown className="size-3" />
                            <span>Textbook Page {pdfPassages[0]?.page}</span>
                            {pdfPassages.length > 1 && ` +${pdfPassages.length - 1}`}
                          </>
                        )}
                      </button>
                    )}
                  </div>
                  
                  {/* Hint content - improved readability */}
                  <div className={cn(
                    "prose prose-sm max-w-none",
                    isEnhanced ? "prose-purple" : "prose-blue"
                  )}>
                    {hint.startsWith('##') ? (
                      // Render markdown-like content for structured hints (L3)
                      <div 
                        className={cn(
                          "text-sm leading-7 whitespace-pre-wrap",
                          isEnhanced ? "text-gray-800 dark:text-gray-100" : "text-gray-800 dark:text-gray-100"
                        )}
                        dangerouslySetInnerHTML={{ 
                          __html: DOMPurify.sanitize(
                            hint
                              .replace(/## (.+)/g, '<h3 class="font-semibold text-base mt-3 mb-2 text-gray-900 dark:text-gray-100">$1</h3>')
                              .replace(/\*\*(.+?)\*\*/g, '<strong class="text-gray-900 dark:text-gray-100">$1</strong>')
                              .replace(/\*(.+?)\*/g, '<em>$1</em>')
                              .replace(/_(.+?)_/g, '<em>$1</em>')
                              .replace(/`(.+?)`/g, '<code class="bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded text-xs text-gray-800 dark:text-gray-100">$1</code>')
                              .replace(/- (.+)/g, '<li class="ml-4 mb-1">$1</li>')
                              .replace(/```sql\n([\s\S]*?)```/g, '<pre class="bg-gray-900 text-gray-100 p-3 rounded text-xs overflow-x-auto my-2"><code>$1</code></pre>')
                              .replace(/\n\n/g, '<br/>'),
                            {
                              ALLOWED_TAGS: ['h3', 'strong', 'em', 'code', 'pre', 'li', 'br'],
                              ALLOWED_ATTR: ['class']
                            }
                          )
                        }}
                      />
                    ) : (
                      <p 
                        className={cn(
                          "text-sm leading-7 whitespace-pre-wrap",
                          isEnhanced ? "text-gray-800 dark:text-gray-100" : "text-gray-800 dark:text-gray-100"
                        )}
                        dangerouslySetInnerHTML={{
                          __html: DOMPurify.sanitize(
                            hint
                              .replace(/\*\*(.+?)\*\*/g, '<strong class="text-gray-900 dark:text-gray-100">$1</strong>')
                              .replace(/\*(.+?)\*/g, '<em>$1</em>')
                              .replace(/_(.+?)_/g, '<em>$1</em>')
                              .replace(/`(.+?)`/g, '<code class="bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded text-xs text-gray-800 dark:text-gray-100">$1</code>'),
                            {
                              ALLOWED_TAGS: ['strong', 'em', 'code'],
                              ALLOWED_ATTR: ['class']
                            }
                          )
                        }}
                      />
                    )}
                  </div>
                  
                  {/* WS12: Hint helpfulness feedback */}
                  <div className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-700">
                    <p className="text-[11px] text-gray-500 dark:text-gray-400 mb-2">Was this hint helpful?</p>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          setHintRatings(prev => ({ ...prev, [idx]: 'helpful' }));
                          logHintHelpfulness(idx, 'helpful');
                        }}
                        className={cn(
                          "flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium transition-colors",
                          hintRatings[idx] === 'helpful'
                            ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300"
                            : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
                        )}
                        aria-label="This hint was helpful"
                      >
                        <ThumbsUp className="size-3" />
                        Yes
                      </button>
                      <button
                        onClick={() => {
                          setHintRatings(prev => ({ ...prev, [idx]: 'not_helpful' }));
                          logHintHelpfulness(idx, 'not_helpful');
                        }}
                        className={cn(
                          "flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium transition-colors",
                          hintRatings[idx] === 'not_helpful'
                            ? "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300"
                            : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
                        )}
                        aria-label="This hint was not helpful"
                      >
                        <ThumbsDown className="size-3" />
                        No
                      </button>
                    </div>
                  </div>

                  {/* Collapsible sources - only shown when expanded */}
                  {isExpanded && hasPdfSources && (
                    <div id={`hint-sources-${idx}`} className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-700">
                      <p className="text-[11px] text-gray-500 dark:text-gray-400 italic mb-2 flex items-center gap-1">
                        <BookOpen className="size-3" />
                        Content from SQL Course Textbook used to generate this hint:
                      </p>
                      <div className="space-y-2">
                        {pdfPassages.map((passage, pidx) => (
                          <div 
                            key={passage.chunkId} 
                            className="p-3 bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-700 rounded-md"
                          >
                            <div className="flex items-center gap-1.5 text-[10px] text-gray-500 dark:text-gray-400 mb-1.5">
                              <FileText className="size-3" />
                              <span className="font-medium">{passage.docId}</span>
                              <span>·</span>
                              <span>Page {passage.page}</span>
                              {passage.score > 0 && (
                                <span className="text-gray-400 dark:text-gray-500">
                                  (relevance: {(passage.score * 100).toFixed(0)}%)
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-gray-700 dark:text-gray-200 leading-relaxed line-clamp-4">
                              {passage.text}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Week 3 D7: Source Viewer for grounded help - always render for UX consistency */}
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

      <div className="flex flex-col gap-2">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              onClick={handleRequestHint}
              variant="outline"
              className="w-full h-9 text-sm"
              disabled={!profile || !sessionId || isProcessingHint}
              data-testid="hint-action-button"
            >
              {isProcessingHint ? (
                <Loader2 className="size-4 mr-2 shrink-0 animate-spin" />
              ) : (
                <Lightbulb className="size-4 mr-2 shrink-0" />
              )}
              <span className="truncate">{primaryActionLabel}</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            <p>Get a hint to help solve the problem</p>
            <p className="text-xs text-gray-400 dark:text-gray-500">Progresses through L1 → L2 → L3 hints</p>
          </TooltipContent>
        </Tooltip>
        {/* Week 6: Conditionally hide Add to Textbook button if textbookDisabled */}
        {(!sessionConfig?.textbookDisabled) && (
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={handleAddToTextbook}
              disabled={!profile || !sessionId || isAddingToTextbook}
              className={cn(
                'w-full h-9 text-sm px-2 rounded-md font-medium',
                'inline-flex items-center justify-center gap-1 transition-colors',
                (!profile || !sessionId)
                  ? 'bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500 cursor-not-allowed'
                  : 'bg-purple-600 text-white hover:bg-purple-700'
              )}
            >
              {isAddingToTextbook ? (
                <>
                  <Loader2 className="size-3 animate-spin" />
                  <span className="truncate">Saving...</span>
                </>
              ) : (
                <>
                  <FileText className="h-4 w-4" />
                  <span className="truncate">Save to Notes</span>
                </>
              )}
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-xs">
            <p className="font-medium">Save to My Textbook</p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Creates a study note you can review later — find all your notes in My Textbook</p>
          </TooltipContent>
        </Tooltip>
        )}
      </div>

      {/* Save-to-Notes error feedback (learner-visible) */}
      {saveToNotesError && (
        <div
          role="alert"
          aria-live="assertive"
          className="rounded-md bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-3 py-2 flex items-start gap-2"
        >
          <AlertCircle className="size-4 text-red-500 shrink-0 mt-0.5" />
          <p className="text-xs text-red-700 dark:text-red-300">{saveToNotesError}</p>
        </div>
      )}

      {hintRuntimeError && (
        <div
          role="alert"
          aria-live="assertive"
          className="rounded-md bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-3 py-2 flex items-start gap-2"
          data-testid="hint-runtime-error"
        >
          <AlertCircle className="size-4 text-red-500 shrink-0 mt-0.5" />
          <p className="text-xs text-red-700 dark:text-red-300">{hintRuntimeError}</p>
        </div>
      )}

      {showExplanation && (
        <div className="rounded-md bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800 px-3 py-2">
          {autoEscalationInfo.triggered ? (
            <>
              <p className="text-xs font-medium text-emerald-800 dark:text-emerald-300">
                📚 Full Explanation Unlocked
              </p>
              <p className="text-xs text-emerald-700 dark:text-emerald-300 mt-1">
                After {autoEscalationInfo.helpRequestCount} help requests, we're providing a complete worked example to help you master this concept.
              </p>
            </>
          ) : (
            <p className="text-xs text-emerald-700 dark:text-emerald-300">
              Explanation has been generated for this help flow.
            </p>
          )}
        </div>
      )}
    </Card>
  );
}
