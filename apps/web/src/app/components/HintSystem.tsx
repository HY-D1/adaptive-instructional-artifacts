import { useEffect, useMemo, useRef, useState } from 'react';
import { Card } from './ui/card';
import { Button } from './ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip';

import { Lightbulb, FileText, ChevronDown, ChevronUp, BookOpen, Loader2, HelpCircle, Sparkles } from 'lucide-react';
import { HelpEventType, InteractionEvent } from '../types';
import { orchestrator } from '../lib/adaptive-orchestrator';
import { storage } from '../lib/storage';
import { createEventId } from '../lib/event-id';
import {
  canonicalizeSqlEngageSubtype
} from '../data/sql-engage';
import { buildRetrievalBundle, RetrievalPdfPassage } from '../lib/retrieval-bundle';
import { getProblemById } from '../data/problems';
import { cn } from './ui/utils';
import { 
  SourceViewer, 
  RungIndicator, 
  ConceptTag 
} from './SourceViewer';
import { getConceptFromRegistry } from '../data';

// Enhanced Hint System imports
import { useEnhancedHints } from '../hooks/useEnhancedHints';
import { HintSourceStatus } from './HintSourceStatus';
import type { EnhancedHint } from '../lib/enhanced-hint-service';

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
  onEscalate?: (sourceInteractionIds?: string[]) => void;
  /** Callback when a new interaction is logged */
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
  const [isProcessingHint, setIsProcessingHint] = useState(false);
  const [autoEscalationInfo, setAutoEscalationInfo] = useState<{
    triggered: boolean;
    helpRequestCount: number;
  }>({ triggered: false, helpRequestCount: 0 });
  // Track which hints are enhanced (LLM-generated or use textbook)
  const [enhancedHintInfo, setEnhancedHintInfo] = useState<Array<{
    isEnhanced: boolean;
    sources: { sqlEngage: boolean; textbook: boolean; llm: boolean; pdfPassages: boolean };
  }>>([]);
  const MAX_DEDUPE_KEYS = 1000; // Prevent unbounded set growth
  
  // Persist enhanced hint info to localStorage
  const HINT_INFO_KEY = useMemo(() => `hint-info-${learnerId}-${problemId}`, [learnerId, problemId]);
  const HINTS_KEY = useMemo(() => `hints-${learnerId}-${problemId}`, [learnerId, problemId]);

  // Load enhanced hint info from localStorage on mount (backup only)
  useEffect(() => {
    const saved = localStorage.getItem(HINT_INFO_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setEnhancedHintInfo(parsed);
      } catch {
        // Ignore parse errors
      }
    }
  }, [HINT_INFO_KEY]);

  // Save hints to localStorage when they change (for backup only, not for loading)
  useEffect(() => {
    if (hints.length > 0) {
      localStorage.setItem(HINTS_KEY, JSON.stringify(hints));
    }
  }, [hints, HINTS_KEY]);

  // Save enhanced hint info to localStorage on change
  useEffect(() => {
    if (enhancedHintInfo.length > 0) {
      localStorage.setItem(HINT_INFO_KEY, JSON.stringify(enhancedHintInfo));
    }
  }, [enhancedHintInfo, HINT_INFO_KEY]);
  
  // Guidance Ladder constants
  const MAX_HINT_LEVEL = 3; // L1-L3 hints before escalation to explanation
  const AUTO_ESCALATION_THRESHOLD = 4; // Help request index that triggers auto-escalation
  
  const helpFlowKeyRef = useRef('');
  const nextHelpRequestIndexRef = useRef(1);
  const emittedHelpEventKeysRef = useRef<Set<string>>(new Set());
  const helpEventSequenceRef = useRef(0);
  
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

  const resetHintFlow = () => {
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
    localStorage.removeItem(HINT_INFO_KEY);
    localStorage.removeItem(HINTS_KEY);
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
    
    // Clear existing state first to prevent duplication
    setHints([]);
    setHintPdfPassages([]);
    setEnhancedHintInfo([]);
    
    // Try to get problem trace from recentInteractions first
    let problemTrace = getProblemTrace();
    
    // If empty, load from storage
    if (problemTrace.length === 0) {
      const allInteractions = storage.getInteractionsByLearner(learnerId);
      problemTrace = allInteractions.filter(
        (i) => i.problemId === problemId && i.learnerId === learnerId
      );
    }
    
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
      
      // Reconstruct enhanced hint info from history
      const reconstructedEnhancedInfo = hintEvents.map(event => ({
        isEnhanced: event.outputs?.is_enhanced || false,
        sources: {
          sqlEngage: true,
          textbook: event.outputs?.is_enhanced || false,
          llm: event.ruleFired === 'enhanced-hint',
          pdfPassages: (event.retrievedSourceIds || []).some(id => id.includes('doc-'))
        }
      }));
      setEnhancedHintInfo(reconstructedEnhancedInfo);
      
      // Check if explanation was shown
      const hasExplanation = problemTrace.some(
        (interaction) => interaction.eventType === 'explanation_view'
      );
      if (hasExplanation) {
        setShowExplanation(true);
      }
    }
  }, [problemId, learnerId, sessionId]);
  // Note: recentInteractions is intentionally omitted from deps to prevent infinite loops.
  // This effect loads historical data once on mount/problem change, not on every interaction update.
  
  // Cleanup old localStorage when problem changes
  useEffect(() => {
    return () => {
      // Clear localStorage for this problem when unmounting/changing problems
      // This prevents stale hints from appearing when returning to the problem
      localStorage.removeItem(HINTS_KEY);
    };
  }, [problemId, HINTS_KEY]);

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
    // Clamp level to valid hint range - this is intentional as we only have MAX_HINT_LEVEL
    // hint levels before escalating to explanations (help request AUTO_ESCALATION_THRESHOLD+)
    const levelForSelection = Math.max(1, Math.min(MAX_HINT_LEVEL, helpRequestIndex)) as 1 | 2 | 3;

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
    hintLevel: number;
    sqlEngageSubtype: string;
    sqlEngageRowId: string;
    policyVersion: string;
    pdfPassages: RetrievalPdfPassage[];
    isEnhanced: boolean;
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
              page: undefined,
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
          pdfPassages,
          isEnhanced: enhancedHint.llmGenerated || enhancedHint.sources.textbook
        };
      }
    } catch (err) {
      console.warn('[HintSystem] Enhanced hint generation failed, using fallback:', err);
    }
    
    // Fallback to standard hint
    const standardHint = getHelpSelectionForIndex(rung);
    if (!standardHint) return null;
    
    const pdfPassages = retrievePdfPassagesForHint(standardHint.sqlEngageSubtype);
    
    return {
      hintText: standardHint.hintText,
      hintLevel: standardHint.hintLevel,
      sqlEngageSubtype: standardHint.sqlEngageSubtype,
      sqlEngageRowId: standardHint.sqlEngageRowId,
      policyVersion: standardHint.policyVersion,
      pdfPassages,
      isEnhanced: false
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

    // Week 3 D8: Log guidance request event
    storage.logGuidanceRequest({
      learnerId,
      problemId,
      requestType: 'hint',
      currentRung: currentRung,
      sessionId
    });

    // Check if we're already in escalation/explanation mode - don't increment counter
    if (showExplanation || autoEscalationInfo.triggered) {
      // Just re-trigger explanation without incrementing
      const problemTrace = getProblemTrace();
      await handleShowExplanation('manual', undefined, problemTrace);
      setIsProcessingHint(false);
      return;
    }
    
    const problemTrace = getProblemTrace();
    const nextHelpRequestIndex = allocateNextHelpRequestIndex(problemTrace);
    
    if (nextHelpRequestIndex >= 4) {
      setAutoEscalationInfo({ triggered: true, helpRequestCount: nextHelpRequestIndex });
      // Wait for explanation to be generated
      await handleShowExplanation('auto', nextHelpRequestIndex, problemTrace);
      setIsProcessingHint(false);
      return;
    }
    
    // Determine rung level for this hint
    const levelForSelection = Math.max(1, Math.min(MAX_HINT_LEVEL, nextHelpRequestIndex)) as 1 | 2 | 3;
    
    // Try to generate enhanced hint (uses LLM/Textbook if available)
    let hintSelection: {
      hintText: string;
      hintLevel: number;
      sqlEngageSubtype: string;
      sqlEngageRowId: string;
      policyVersion: string;
      pdfPassages: RetrievalPdfPassage[];
      isEnhanced: boolean;
    } | null = null;
    
    try {
      hintSelection = await generateEnhancedHintForRung(levelForSelection);
    } catch (err) {
      console.warn('[HintSystem] Enhanced hint failed, using fallback:', err);
    }
    
    // Fallback to standard hint if enhanced generation failed
    if (!hintSelection) {
      const standardHint = getHelpSelectionForIndex(nextHelpRequestIndex);
      if (!standardHint) {
        setIsProcessingHint(false);
        return;
      }
      const pdfPassages = retrievePdfPassagesForHint(standardHint.sqlEngageSubtype);
      hintSelection = {
        hintText: standardHint.hintText,
        hintLevel: standardHint.hintLevel,
        sqlEngageSubtype: standardHint.sqlEngageSubtype,
        sqlEngageRowId: standardHint.sqlEngageRowId,
        policyVersion: standardHint.policyVersion,
        pdfPassages,
        isEnhanced: false
      };
    }
    
    if (!registerHelpEvent('hint_view', nextHelpRequestIndex)) {
      setIsProcessingHint(false);
      return;
    }

    setHints((currentHints) => [...currentHints, hintSelection!.hintText]);
    setHintPdfPassages((current) => [...current, hintSelection!.pdfPassages]);
    setEnhancedHintInfo((current) => [...current, {
      isEnhanced: hintSelection!.isEnhanced,
      sources: hintSelection!.isEnhanced ? 
        { sqlEngage: true, textbook: availableResources.textbook, llm: availableResources.llm, pdfPassages: hintSelection!.pdfPassages.length > 0 } :
        { sqlEngage: true, textbook: false, llm: false, pdfPassages: false }
    }]);
    setActiveHintSubtype(hintSelection!.sqlEngageSubtype);
    const errorCount = problemTrace.filter((interaction) => interaction.eventType === 'error').length;
    const hintCount = problemTrace.filter((interaction) => interaction.eventType === 'hint_view').length;
    const timeSpent = problemTrace.length > 0
      ? Date.now() - problemTrace[0].timestamp
      : 0;

    // Log interaction with escalation metadata
    // will_escalate indicates that viewing this hint will trigger auto-escalation
    // This happens at max hint level when no explanation has been shown yet
    const willEscalate = hintSelection!.hintLevel === MAX_HINT_LEVEL && !showExplanation;
    
    const hintEvent: InteractionEvent = {
      id: buildHelpEventId('hint', nextHelpRequestIndex),
      sessionId,
      learnerId,
      timestamp: Date.now(),
      eventType: 'hint_view',
      problemId,
      hintText: hintSelection!.hintText,
      hintLevel: hintSelection!.hintLevel,
      helpRequestIndex: nextHelpRequestIndex,
      sqlEngageSubtype: hintSelection!.sqlEngageSubtype,
      sqlEngageRowId: hintSelection!.sqlEngageRowId,
      policyVersion: hintSelection!.policyVersion,
      ruleFired: hintSelection!.isEnhanced ? 'enhanced-hint' : 'progressive-hint',
      inputs: {
        retry_count: Math.max(0, errorCount - 1),
        hint_count: hintCount,
        time_spent_ms: timeSpent
      },
      outputs: {
        hint_level: hintSelection!.hintLevel,
        help_request_index: nextHelpRequestIndex,
        sql_engage_subtype: hintSelection!.sqlEngageSubtype,
        sql_engage_row_id: hintSelection!.sqlEngageRowId,
        will_escalate: willEscalate,
        rule_fired: willEscalate ? 'progressive-hint-will-escalate' : (hintSelection!.isEnhanced ? 'enhanced-hint' : 'progressive-hint'),
        is_enhanced: hintSelection!.isEnhanced
      }
    };
    storage.saveInteraction(hintEvent);
    onInteractionLogged?.(hintEvent);

    // Week 3 D8: Log guidance view event for replay
    storage.logGuidanceView({
      learnerId,
      problemId,
      rung: hintSelection!.hintLevel as 1 | 2 | 3,
      conceptIds: conceptIds.length > 0 ? conceptIds : [hintSelection!.sqlEngageSubtype],
      sourceRefIds: hintSelection!.pdfPassages.map(p => p.chunkId),
      grounded: hintSelection!.pdfPassages.length > 0,
      contentLength: hintSelection!.hintText.length,
      sessionId
    });

    setIsProcessingHint(false);

    // Escalate automatically after max hint level reached.
    if (hintSelection.hintLevel === MAX_HINT_LEVEL && !showExplanation) {
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
      setAutoEscalationInfo({ triggered: true, helpRequestCount: nextHelpRequestIndex });
      handleShowExplanation('auto', nextHelpRequestIndex + 1, [...problemTrace, hintEvent]);
    }
  };

  const handleShowExplanation = async (
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
      setIsProcessingHint(false);
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
  // Count hints that have been actually viewed
  const viewedHintsCount = hints.length;
  const hintProgress = showExplanation 
    ? Math.min(viewedHintsCount + 1, 4)  // Hints + explanation
    : Math.min(viewedHintsCount, 3);      // Just hints
  const stepMessage = nextHelpRequestIndex >= 4
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
            <h3 className="font-semibold text-gray-900">Guidance Ladder</h3>
            <p className="text-xs text-gray-500">
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
        <div data-testid="hint-empty-state" className="rounded-lg border border-dashed border-gray-200 bg-gray-50/50 p-6 text-center">
          <div className="p-2 bg-amber-50 rounded-full w-fit mx-auto mb-3">
            <HelpCircle className="size-5 text-amber-500" />
          </div>
          <p className="text-sm font-medium text-gray-700 mb-1">Need help?</p>
          <p className="text-xs text-gray-500">Request a hint to get personalized guidance</p>
          <div className="mt-3 flex items-center justify-center gap-1 text-[10px] text-gray-400">
            <span>Progresses through</span>
            <span className="font-medium text-amber-600">L1</span>
            <span>→</span>
            <span className="font-medium text-amber-600">L2</span>
            <span>→</span>
            <span className="font-medium text-amber-600">L3</span>
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
                "rounded-lg border-l-4 bg-white shadow-sm overflow-hidden",
                isEnhanced 
                  ? "border-l-purple-400 border-purple-100" 
                  : "border-l-blue-400 border-gray-100"
              )} data-testid={`hint-card-${idx}`}>
                {/* Inner card for cleaner separation */}
                <div className="p-4">
                  {/* Compact header: level badge and AI badge on same line */}
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      {/* Level badge - compact */}
                      <span className={cn(
                        "shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold",
                        idx === 0 ? "bg-green-100 text-green-700" :
                        idx === 1 ? "bg-amber-100 text-amber-700" :
                        "bg-red-100 text-red-700"
                      )}>
                        <span data-testid={`hint-label-${idx + 1}`}>{`Hint ${idx + 1}`}</span>
                        <span className="ml-1 opacity-70">{`L${idx + 1}`}</span>
                      </span>
                      
                      {/* AI badge only - most important, compact */}
                      {isEnhanced && usesLLM && (
                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium bg-purple-100 text-purple-700">
                          <Sparkles className="size-3" />
                          AI
                        </span>
                      )}
                    </div>
                    
                    {/* Sources toggle button - right side */}
                    {hasPdfSources && (
                      <button
                        onClick={() => setExpandedHintIndex(isExpanded ? null : idx)}
                        className="flex items-center gap-1 text-[11px] text-gray-500 hover:text-gray-700 transition-colors"
                        aria-expanded={isExpanded}
                        aria-controls={`hint-sources-${idx}`}
                      >
                        {isExpanded ? (
                          <ChevronUp className="size-3" />
                        ) : (
                          <ChevronDown className="size-3" />
                        )}
                        <span>
                          {isExpanded ? 'Hide' : `Sources (${pdfPassages.length})`}
                        </span>
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
                          isEnhanced ? "text-gray-800" : "text-gray-800"
                        )}
                        dangerouslySetInnerHTML={{ 
                          __html: hint
                            .replace(/## (.+)/g, '<h3 class="font-semibold text-base mt-3 mb-2 text-gray-900">$1</h3>')
                            .replace(/\*\*(.+?)\*\*/g, '<strong class="text-gray-900">$1</strong>')
                            .replace(/\*(.+?)\*/g, '<em>$1</em>')
                            .replace(/_(.+?)_/g, '<em>$1</em>')
                            .replace(/`(.+?)`/g, '<code class="bg-gray-100 px-1.5 py-0.5 rounded text-xs text-gray-800">$1</code>')
                            .replace(/- (.+)/g, '<li class="ml-4 mb-1">$1</li>')
                            .replace(/```sql\n([\s\S]*?)```/g, '<pre class="bg-gray-900 text-gray-100 p-3 rounded text-xs overflow-x-auto my-2"><code>$1</code></pre>')
                            .replace(/\n\n/g, '<br/>')
                        }}
                      />
                    ) : (
                      <p 
                        className={cn(
                          "text-sm leading-7 whitespace-pre-wrap",
                          isEnhanced ? "text-gray-800" : "text-gray-800"
                        )}
                        dangerouslySetInnerHTML={{
                          __html: hint
                            .replace(/\*\*(.+?)\*\*/g, '<strong class="text-gray-900">$1</strong>')
                            .replace(/\*(.+?)\*/g, '<em>$1</em>')
                            .replace(/_(.+?)_/g, '<em>$1</em>')
                            .replace(/`(.+?)`/g, '<code class="bg-gray-100 px-1.5 py-0.5 rounded text-xs text-gray-800">$1</code>')
                        }}
                      />
                    )}
                  </div>
                  
                  {/* Collapsible sources - only shown when expanded */}
                  {isExpanded && hasPdfSources && (
                    <div id={`hint-sources-${idx}`} className="mt-4 pt-3 border-t border-gray-100">
                      <p className="text-[11px] text-gray-500 italic mb-2">
                        The following passages from your uploaded PDF were used to generate this hint:
                      </p>
                      <div className="space-y-2">
                        {pdfPassages.map((passage, pidx) => (
                          <div 
                            key={passage.chunkId} 
                            className="p-3 bg-gray-50 border border-gray-100 rounded-md"
                          >
                            <div className="flex items-center gap-1.5 text-[10px] text-gray-500 mb-1.5">
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
                            <p className="text-xs text-gray-700 leading-relaxed line-clamp-4">
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
            <p className="text-xs text-gray-400">Progresses through L1 → L2 → L3 hints</p>
          </TooltipContent>
        </Tooltip>
        <div className="grid grid-cols-2 gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                onClick={() => void handleShowExplanation('manual')}
                variant="secondary"
                className="w-full h-9 text-sm px-2"
                disabled={!profile || !sessionId || !errorSubtypeId || isProcessingHint}
              >
                <Sparkles className="size-3.5 mr-1.5 shrink-0" />
                <span className="truncate">Explain</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <p>Get a detailed explanation</p>
              {!errorSubtypeId && (
                <p className="text-xs text-amber-600">Run a query with an error first</p>
              )}
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={handleAddToTextbook}
                disabled={!profile || !sessionId || currentRung >= 3 || isAddingToTextbook}
                className={cn(
                  'w-full h-9 text-sm px-2 rounded-md font-medium',
                  'inline-flex items-center justify-center gap-1 transition-colors',
                  (!profile || !sessionId || currentRung >= 3) 
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed' 
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
                    <span className="truncate">Save</span>
                  </>
                )}
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <p>Save to My Textbook</p>
              {currentRung >= 3 ? (
                <p className="text-xs text-gray-400">Already at max level</p>
              ) : (
                <p className="text-xs text-gray-400">Creates a personalized study note</p>
              )}
            </TooltipContent>
          </Tooltip>
        </div>
      </div>

      {showExplanation && (
        <div className="rounded-md bg-emerald-50 border border-emerald-100 px-3 py-2">
          {autoEscalationInfo.triggered ? (
            <>
              <p className="text-xs font-medium text-emerald-800">
                📚 Full Explanation Unlocked
              </p>
              <p className="text-xs text-emerald-700 mt-1">
                After {autoEscalationInfo.helpRequestCount} help requests, we're providing a complete worked example to help you master this concept.
              </p>
            </>
          ) : (
            <p className="text-xs text-emerald-700">
              Explanation has been generated for this help flow.
            </p>
          )}
        </div>
      )}
    </Card>
  );
}
