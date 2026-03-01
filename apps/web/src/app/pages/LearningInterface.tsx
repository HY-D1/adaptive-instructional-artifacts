import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useLocation, Link } from 'react-router';

import {
  Clock,
  CheckCircle2,
  AlertCircle,
  Pause,
  Sparkles,
  BookOpen,
  Check,
  GraduationCap,
  Target,
  Settings2,
  Keyboard,
  Zap,
  Sprout,
  TrendingUp
} from 'lucide-react';

import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Badge } from '../components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '../components/ui/tooltip';
import { Skeleton } from '../components/ui/skeleton';
import { cn } from '../components/ui/utils';
import { DEFAULT_SQL_EDITOR_CODE, SQLEditor } from '../components/SQLEditor';
import { HintSystem } from '../components/HintSystem';
import { ConceptCoverage } from '../components/ConceptCoverage';
import { AskMyTextbookChat } from '../components/AskMyTextbookChat';
import { useLLMSettings } from '../components/LLMSettingsHelper';
import { useScreenReaderAnnouncer } from '../components/ScreenReaderAnnouncer';
import { sqlProblems } from '../data/problems';
import { canonicalizeSqlEngageSubtype, getKnownSqlEngageSubtypes, getSqlEngagePolicyVersion, getConceptById } from '../data/sql-engage';
import { useUserRole } from '../hooks/useUserRole';
import { storage } from '../lib/storage';
import type { QueryResult } from '../lib/sql-executor';
import { orchestrator } from '../lib/adaptive-orchestrator';
import { buildBundleForCurrentProblem, generateUnitFromLLM } from '../lib/content-generator';
import { buildPdfIndexOutputFields } from '../lib/pdf-retrieval';
import { createEventId } from '../lib/event-id';
import { startBackgroundAnalysis, stopBackgroundAnalysis, runAnalysisOnce, ANALYSIS_INTERVAL_MS } from '../lib/trace-analyzer';
import type { AnalysisResult } from '../lib/trace-analyzer';
import { getConcept } from '../lib/concept-loader';
import { banditManager } from '../lib/learner-bandit-manager';
import type { BanditArmId } from '../lib/learner-bandit-manager';
import type { SQLProblem, InteractionEvent, InstructionalUnit, LearnerProfile, RetrievedChunkInfo, HDITrend } from '../types';

const INSTRUCTOR_SUBTYPE_OPTIONS = getKnownSqlEngageSubtypes();

const STRATEGY_OPTIONS: Array<{ value: LearnerProfile['currentStrategy']; label: string }> = [
  { value: 'hint-only', label: 'Hint Only' },
  { value: 'adaptive-low', label: 'Adaptive Low' },
  { value: 'adaptive-medium', label: 'Adaptive Medium' },
  { value: 'adaptive-high', label: 'Adaptive High' }
];

// Difficulty color mapping
const difficultyColors = {
  beginner: 'bg-green-100 text-green-800 border-green-200',
  intermediate: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  advanced: 'bg-red-100 text-red-800 border-red-200'
};

// Week 5: Profile badge color mapping
const profileBadgeColors: Record<string, { bg: string; text: string; border: string; icon: string }> = {
  aggressive: { bg: 'bg-blue-100', text: 'text-blue-700', border: 'border-blue-200', icon: 'text-blue-600' },
  adaptive: { bg: 'bg-green-100', text: 'text-green-700', border: 'border-green-200', icon: 'text-green-600' },
  conservative: { bg: 'bg-yellow-100', text: 'text-yellow-700', border: 'border-yellow-200', icon: 'text-yellow-600' },
  'explanation-first': { bg: 'bg-purple-100', text: 'text-purple-700', border: 'border-purple-200', icon: 'text-purple-600' }
};

// Week 5: Profile display names
const profileDisplayNames: Record<string, string> = {
  aggressive: 'Fast Escalator',
  adaptive: 'Adaptive',
  conservative: 'Slow Escalator',
  'explanation-first': 'Explanation First'
};

// Week 5: Profile hover descriptions
const profileDescriptions: Record<string, string> = {
  aggressive: "You're on the Fast Escalator profile - hints escalate quickly",
  adaptive: "You're on the Adaptive profile - hints adjust to your needs",
  conservative: "You're on the Slow Escalator profile - take your time with hints",
  'explanation-first': "You're on the Explanation First profile - detailed help available"
};

// Format time helper
function formatTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const hours = Math.floor(minutes / 60);
  
  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  }
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

/**
 * Week 5: Dependency Warning Toast Component
 * Gentle toast notification for high HDI warning
 */
interface DependencyWarningToastProps {
  onClose: () => void;
}

function DependencyWarningToast({ onClose }: DependencyWarningToastProps) {
  useEffect(() => {
    const timer = window.setTimeout(() => {
      onClose();
    }, 5000);
    return () => window.clearTimeout(timer);
  }, [onClose]);

  return (
    <div 
      className="fixed bottom-6 right-6 z-50 animate-in slide-in-from-bottom-4 duration-300"
      role="alert"
      aria-live="polite"
      data-testid="dependency-warning-toast"
    >
      <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 text-amber-800 px-4 py-3 rounded-lg shadow-lg flex items-center gap-3 max-w-sm">
        <div className="w-8 h-8 bg-amber-100 rounded-full flex items-center justify-center shrink-0">
          <Sparkles className="w-4 h-4 text-amber-600" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm">You're doing great! 💪</p>
          <p className="text-amber-700 text-xs mt-0.5">Try solving the next one without hints</p>
        </div>
        <button
          onClick={onClose}
          className="p-1 hover:bg-amber-100 rounded transition-colors shrink-0"
          aria-label="Dismiss notification"
        >
          <span className="text-amber-600">×</span>
        </button>
      </div>
    </div>
  );
}

/**
 * LearningInterface - Main student practice page
 * 
 * Provides the SQL practice environment with:
 * - Problem selection and navigation
 * - SQL editor with execution and correctness checking
 * - Hint system with progressive guidance ladder (L1-L3)
 * - Session timer and progress tracking
 * - Concept coverage visualization
 * 
 * Used by both student and instructor roles (instructor has additional controls)
 */
export function LearningInterface() {
  const location = useLocation();
  const { role, isStudent, isInstructor, profile } = useUserRole();
  // Use actual user profile ID for data isolation (aligned with TextbookPage)
  const learnerId = profile?.id || 'learner-1';
  const [sessionId, setSessionId] = useState('');
  const [currentProblem, setCurrentProblem] = useState<SQLProblem>(sqlProblems[0]);
  const [activeConceptId, setActiveConceptId] = useState<string | null>(null);
  const [activeConceptTitle, setActiveConceptTitle] = useState<string | null>(null);
  const [sqlDraft, setSqlDraft] = useState(DEFAULT_SQL_EDITOR_CODE);
  const [startTime, setStartTime] = useState(Date.now());
  const [elapsedTime, setElapsedTime] = useState(0);
  const [isTimerPaused, setIsTimerPaused] = useState(false);
  const [totalTimeAcrossSessions, setTotalTimeAcrossSessions] = useState(0);
  const [interactions, setInteractions] = useState<InteractionEvent[]>([]);
  const [lastError, setLastError] = useState<string | undefined>();
  const [lastErrorEventId, setLastErrorEventId] = useState<string | undefined>();
  const [subtypeOverride, setSubtypeOverride] = useState('auto');
  const [escalationTriggered, setEscalationTriggered] = useState(false);
  const [notesActionMessage, setNotesActionMessage] = useState<string | undefined>();
  const [isGeneratingUnit, setIsGeneratingUnit] = useState(false);
  const [generationError, setGenerationError] = useState<string | undefined>();
  const [latestGeneratedUnit, setLatestGeneratedUnit] = useState<InstructionalUnit | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [analysisStatus, setAnalysisStatus] = useState<{
    isRunning: boolean;
    lastResult?: AnalysisResult;
  }>({ isRunning: false });
  
  // Auto-creation notification state
  const [autoCreationNotifications, setAutoCreationNotifications] = useState<Array<{
    id: string;
    message: string;
    unitId: string;
    timestamp: number;
  }>>([]);
  
  // Week 5: Profile indicator state
  const [currentProfileId, setCurrentProfileId] = useState<BanditArmId>('adaptive');
  const isDev = import.meta.env.DEV;
  
  // Week 5: HDI tracking state
  const [currentHDI, setCurrentHDI] = useState<number>(0);
  const [hdiTrend, setHdiTrend] = useState<HDITrend>('stable');
  const [showDependencyWarning, setShowDependencyWarning] = useState(false);
  const dependencyWarningShownRef = useRef(false);
  const lastHintRequestTimeRef = useRef<number>(0);
  
  // Week 5: Progress hint state
  const [progressHint, setProgressHint] = useState<string | null>(null);
  const progressHintShownRef = useRef(false);
  const interactionCountRef = useRef(0);
  
  const timerRef = useRef<number | null>(null);
  const stopAnalysisRef = useRef<(() => void) | null>(null);
  const startTimeRef = useRef(startTime);
  const isTimerPausedRef = useRef(isTimerPaused);
  const elapsedTimeRef = useRef(elapsedTime);
  // Track notification timeout IDs for cleanup on unmount
  const notificationTimeoutsRef = useRef<Set<number>>(new Set());
  
  // Screen reader announcements for accessibility
  const { announcement: hintAnnouncement, announce: announceHint } = useScreenReaderAnnouncer();
  const [notificationAnnouncement, setNotificationAnnouncement] = useState('');

  // Week 5: Get current escalation profile from bandit manager
  useEffect(() => {
    if (!learnerId) return;
    
    // Check for debug profile override first
    const debugProfileOverride = localStorage.getItem('sql-adapt-debug-profile');
    
    // Get the current profile for this learner
    const { profile, armId } = banditManager.selectProfileForLearner(learnerId);
    setCurrentProfileId(armId);
    
    // Log profile assignment event
    const assignmentStrategy = (localStorage.getItem('sql-adapt-debug-strategy') as 'static' | 'diagnostic' | 'bandit') || 'bandit';
    const effectiveProfileId = debugProfileOverride || profile.id;
    const overrideReason = debugProfileOverride ? 'debug_override' : 'bandit_selection';
    
    storage.logProfileAssigned({
      learnerId,
      problemId: currentProblem.id,
      profileId: effectiveProfileId,
      assignmentStrategy,
      reason: overrideReason,
      sessionId
    });
    
    // Log bandit arm selection event
    storage.logBanditArmSelected({
      learnerId,
      problemId: currentProblem.id,
      armId,
      selectionMethod: 'thompson_sampling',
      armStatsAtSelection: banditManager.hasBandit(learnerId) 
        ? banditManager.getLearnerStats(learnerId).reduce((acc, stat) => {
            acc[stat.armId] = { mean: stat.meanReward, pulls: stat.pullCount };
            return acc;
          }, {} as Record<string, { mean: number; pulls: number }>)
        : undefined,
      sessionId
    });
  }, [learnerId, currentProblem.id, sessionId]);

  // Week 5: Listen for HDI calculated events
  useEffect(() => {
    const handleHDIEvent = (event: Event) => {
      const customEvent = event as CustomEvent<{
        hdi: number;
        hdiLevel: 'low' | 'medium' | 'high';
        trend?: HDITrend;
        learnerId: string;
      }>;
      
      if (customEvent.detail.learnerId !== learnerId) return;
      
      setCurrentHDI(customEvent.detail.hdi);
      if (customEvent.detail.trend) {
        setHdiTrend(customEvent.detail.trend);
      }
    };
    
    window.addEventListener('hdi_calculated', handleHDIEvent);
    return () => window.removeEventListener('hdi_calculated', handleHDIEvent);
  }, [learnerId]);

  // Week 5: Calculate HDI from interactions when they change
  useEffect(() => {
    if (!learnerId || interactions.length === 0) return;
    
    const sessionInteractions = interactions.filter(
      i => i.learnerId === learnerId && i.sessionId === sessionId
    );
    
    // Calculate HDI components
    const hintViews = sessionInteractions.filter(i => i.eventType === 'hint_view').length;
    const explanationViews = sessionInteractions.filter(i => i.eventType === 'explanation_view').length;
    const executions = sessionInteractions.filter(i => i.eventType === 'execution').length;
    const errors = sessionInteractions.filter(i => i.eventType === 'error').length;
    const attempts = executions + errors;
    
    // Simple HDI calculation: weighted ratio of help-seeking to attempts
    // This is a simplified version - the actual HDI calculation would be more sophisticated
    const hpa = attempts > 0 ? hintViews / attempts : 0;
    const er = attempts > 0 ? explanationViews / attempts : 0;
    const hdi = Math.min(1, (hpa * 0.4 + er * 0.6));
    
    // Determine trend based on previous value (simplified)
    if (hdi > currentHDI + 0.05) {
      setHdiTrend('increasing');
    } else if (hdi < currentHDI - 0.05) {
      setHdiTrend('decreasing');
    } else {
      setHdiTrend('stable');
    }
    
    setCurrentHDI(hdi);
  }, [interactions, learnerId, sessionId, currentHDI]);

  // Week 5: Check for dependency warning after hint requests
  useEffect(() => {
    // Only check if we just had a hint request
    const lastInteraction = interactions[interactions.length - 1];
    if (!lastInteraction || lastInteraction.eventType !== 'hint_view') return;
    if (lastInteraction.timestamp === lastHintRequestTimeRef.current) return;
    
    lastHintRequestTimeRef.current = lastInteraction.timestamp;
    
    // Show warning if HDI > 0.8 and not already shown this session
    if (currentHDI > 0.8 && !dependencyWarningShownRef.current && isStudent) {
      setShowDependencyWarning(true);
      dependencyWarningShownRef.current = true;
    }
  }, [interactions, currentHDI, isStudent]);

  // Week 5: Progress hint - show occasionally based on HDI trend
  useEffect(() => {
    if (!isStudent) return;
    
    interactionCountRef.current += 1;
    
    // Only show progress hint every ~15 interactions
    if (interactionCountRef.current % 15 !== 0) return;
    
    // Reset the shown flag every 15 interactions so hints can appear again
    progressHintShownRef.current = false;
    
    // Determine hint based on trend
    let hint: string | null = null;
    if (hdiTrend === 'decreasing') {
      hint = "Your independence is growing! 🌱";
    } else if (hdiTrend === 'increasing' && currentHDI > 0.5) {
      hint = "Take your time, read hints carefully";
    } else if (currentHDI < 0.3) {
      hint = "Great job solving independently! 🌟";
    }
    
    if (hint) {
      setProgressHint(hint);
      progressHintShownRef.current = true;
      
      // Auto-clear after 10 seconds
      const timer = window.setTimeout(() => {
        setProgressHint(null);
      }, 10000);
      
      return () => window.clearTimeout(timer);
    }
  }, [interactions, hdiTrend, currentHDI, isStudent]);

  // Reset session-based flags when session changes
  useEffect(() => {
    dependencyWarningShownRef.current = false;
    progressHintShownRef.current = false;
    interactionCountRef.current = 0;
  }, [sessionId]);

  // Load initial data
  useEffect(() => {
    const timer = window.setTimeout(() => setIsLoading(false), 500);
    return () => {
      window.clearTimeout(timer);
      // Clear all notification timeouts on unmount
      notificationTimeoutsRef.current.forEach(id => window.clearTimeout(id));
      notificationTimeoutsRef.current.clear();
    };
  }, []);

  // Parse query params on mount to set problem/concept context
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const problemId = params.get('problemId');
    const conceptId = params.get('conceptId');
    
    if (problemId) {
      // Load specific problem
      const problem = sqlProblems.find(p => p.id === problemId);
      if (problem) {
        setCurrentProblem(problem);
        // Also check if concept is specified
        if (conceptId) {
          setActiveConceptId(conceptId);
          getConcept(conceptId).then(concept => {
            if (concept) setActiveConceptTitle(concept.title);
          });
        }
      }
    } else if (conceptId) {
      // Find first problem with this concept
      const problem = sqlProblems.find(p => p.concepts.includes(conceptId));
      if (problem) {
        setCurrentProblem(problem);
        setActiveConceptId(conceptId);
        getConcept(conceptId).then(concept => {
          if (concept) setActiveConceptTitle(concept.title);
        });
      }
    }
  }, [location.search]);

  // Calculate total time across sessions
  useEffect(() => {
    const learnerInteractions = storage.getInteractionsByLearner(learnerId);
    const totalMs = learnerInteractions.reduce((total, interaction) => {
      return total + (interaction.timeSpent || 0);
    }, 0);
    setTotalTimeAcrossSessions(totalMs);
  }, [learnerId, interactions]);

  // Keep refs in sync with state
  useEffect(() => {
    startTimeRef.current = startTime;
  }, [startTime]);

  useEffect(() => {
    isTimerPausedRef.current = isTimerPaused;
  }, [isTimerPaused]);

  useEffect(() => {
    elapsedTimeRef.current = elapsedTime;
  }, [elapsedTime]);

  // Timer effect with tab visibility handling - uses refs to avoid stale closures
  useEffect(() => {
    const updateTimer = () => {
      if (!isTimerPausedRef.current) {
        setElapsedTime(Date.now() - startTimeRef.current);
      }
    };

    timerRef.current = window.setInterval(updateTimer, 1000);

    return () => {
      if (timerRef.current) {
        window.clearInterval(timerRef.current);
      }
    };
  }, []); // Empty deps - uses refs for mutable values

  // Cleanup background analysis on unmount
  useEffect(() => {
    return () => {
      if (stopAnalysisRef.current) {
        stopAnalysisRef.current();
        stopAnalysisRef.current = null;
      }
      stopBackgroundAnalysis();
    };
  }, []);

  // Handle tab visibility change - uses ref to avoid stale closure
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        setIsTimerPaused(true);
      } else {
        setIsTimerPaused(false);
        // Adjust start time to account for paused period using ref for current value
        setStartTime(Date.now() - elapsedTimeRef.current);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []); // Empty deps - uses ref for mutable value

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if in input/textarea or modal is open
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      // Don't trigger if a modal/dialog is open
      const isModalOpen = document.querySelector('[role="dialog"]') !== null;
      if (isModalOpen) {
        return;
      }

      // Ctrl+Enter to run query
      if (e.ctrlKey && e.key === 'Enter') {
        e.preventDefault();
        const runButton = document.querySelector('[data-testid="run-query-btn"]') as HTMLButtonElement;
        runButton?.click();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Effect 1: Session initialization - handles profile, session ID, and state reset
  useEffect(() => {
    // Initialize learner profile if doesn't exist
    let profile = storage.getProfile(learnerId);
    if (!profile) {
      profile = storage.createDefaultProfile(learnerId, 'adaptive-medium');
    }
    setSubtypeOverride('auto');

    const activeSessionId = storage.getActiveSessionId();
    // Validate session belongs to current learner using exact pattern match
    const expectedPrefix = `session-${learnerId}-`;
    const belongsToLearner = activeSessionId?.startsWith(expectedPrefix) === true && 
      activeSessionId.length > expectedPrefix.length;
    
    // First, try to find any existing draft for this learner+problem (handles navigation)
    const existingDraft = storage.findAnyPracticeDraft(learnerId, currentProblem.id);
    
    // Use existing session if valid, otherwise create new one
    const newSessionId = belongsToLearner
      ? activeSessionId
      : storage.startSession(learnerId);
    
    // Restore draft: prefer existing draft from any session, then try current session
    const restoredDraft = existingDraft ?? storage.getPracticeDraft(learnerId, newSessionId, currentProblem.id);
    
    setSessionId(newSessionId);
    setSqlDraft(restoredDraft ?? DEFAULT_SQL_EDITOR_CODE);
    setInteractions(
      storage
        .getInteractionsByLearner(learnerId)
        .filter((interaction) => interaction.sessionId === newSessionId)
    );
    setLastError(undefined);
    setLastErrorEventId(undefined);
    setEscalationTriggered(false);
    setNotesActionMessage(undefined);
    setGenerationError(undefined);
    setLatestGeneratedUnit(null);
    setStartTime(Date.now());
    setElapsedTime(0);
  }, [learnerId, currentProblem.id]);

  // Effect 2: Background analysis - handles trace analysis lifecycle
  useEffect(() => {
    // Only start analysis when we have a valid session
    if (!sessionId) return;
    
    // Stop any existing analysis before starting new one
    if (stopAnalysisRef.current) {
      stopAnalysisRef.current();
    }
    
    const stopAnalysis = startBackgroundAnalysis(learnerId, sessionId, {
      intervalMs: ANALYSIS_INTERVAL_MS,
      enableAutoCreation: true,
      onAnalysisComplete: (result) => {
        setAnalysisStatus({ isRunning: true, lastResult: result });
      },
      onAutoCreationComplete: (autoResult) => {
        // Show notifications for auto-created units
        if (autoResult.totalCreated > 0) {
          const newNotifications = autoResult.unitsCreated.map((unit) => ({
            id: `auto-notif-${unit.unitId}-${Date.now()}`,
            message: `New help article added: "${unit.title}"`,
            unitId: unit.unitId,
            timestamp: Date.now()
          }));
          setAutoCreationNotifications((prev) => [...prev, ...newNotifications]);
          // Auto-dismiss after 10 seconds
          const timeoutId = window.setTimeout(() => {
            setAutoCreationNotifications((prev) => 
              prev.filter((n) => !newNotifications.find((nn) => nn.id === n.id))
            );
            notificationTimeoutsRef.current.delete(timeoutId);
          }, 10000);
          notificationTimeoutsRef.current.add(timeoutId);
        }
      }
    });
    
    stopAnalysisRef.current = stopAnalysis;
    setAnalysisStatus({ isRunning: true });
    
    // Run initial analysis
    const initialResult = runAnalysisOnce(learnerId, sessionId);
    setAnalysisStatus({ isRunning: true, lastResult: initialResult });
    
    // Cleanup function to stop analysis when session changes
    return () => {
      if (stopAnalysisRef.current) {
        stopAnalysisRef.current();
        stopAnalysisRef.current = null;
      }
    };
  }, [learnerId, sessionId]);

  // Learner switching is now handled via "Switch User" in the top navigation
  // The learnerId state remains for data tracking purposes

  const instructorSubtypeOverride = isInstructor && subtypeOverride !== 'auto'
    ? canonicalizeSqlEngageSubtype(subtypeOverride)
    : undefined;

  const handleCodeChange = (code: string) => {
    const event: InteractionEvent = {
      id: createEventId('event', 'code-change'),
      sessionId,
      learnerId,
      timestamp: Date.now(),
      eventType: 'code_change',
      problemId: currentProblem.id,
      code
    };
    storage.saveInteraction(event);
    setInteractions((previousInteractions) => [...previousInteractions, event]);
  };

  const handleEditorCodeChange = (code: string) => {
    setSqlDraft(code);
    if (sessionId) {
      storage.savePracticeDraft(learnerId, sessionId, currentProblem.id, code);
    }
    handleCodeChange(code);
  };

  const handleEditorReset = () => {
    setSqlDraft(DEFAULT_SQL_EDITOR_CODE);
    if (sessionId) {
      storage.clearPracticeDraft(learnerId, sessionId, currentProblem.id);
    }
  };

  const handleProblemChange = useCallback((id: string) => {
    const problem = sqlProblems.find(p => p.id === id);
    if (!problem) {
      // Problem not found - silently return
      return;
    }
    setCurrentProblem(problem);
    const restoredDraft = sessionId
      ? storage.getPracticeDraft(learnerId, sessionId, problem.id)
      : null;
    setSqlDraft(restoredDraft ?? DEFAULT_SQL_EDITOR_CODE);
    setStartTime(Date.now());
    setElapsedTime(0);
    setLastError(undefined);
    setLastErrorEventId(undefined);
    setEscalationTriggered(false);
    setNotesActionMessage(undefined);
    setGenerationError(undefined);
    setLatestGeneratedUnit(null);
  }, [learnerId, sessionId]);

  const collectNoteEvidenceIds = (
    extraIds: string[] = [],
    options?: { maxInteractions?: number }
  ): string[] => {
    const relevantTypes: InteractionEvent['eventType'][] = ['error', 'execution', 'hint_view', 'explanation_view'];
    const sessionInteractions = storage
      .getInteractionsByLearner(learnerId)
      .filter(
        (interaction) =>
          interaction.sessionId === sessionId &&
          interaction.problemId === currentProblem.id &&
          relevantTypes.includes(interaction.eventType)
      )
      .map((interaction) => interaction.id);
    const maxInteractions = options?.maxInteractions;
    const boundedSessionInteractions =
      typeof maxInteractions === 'number' && maxInteractions > 0
        ? sessionInteractions.slice(-maxInteractions)
        : sessionInteractions;

    return Array.from(new Set([
      ...(lastErrorEventId ? [lastErrorEventId] : []),
      ...boundedSessionInteractions,
      ...extraIds
    ]));
  };

  const resolveLatestProblemErrorSubtype = (): string | undefined => {
    const latestErrorInteraction = storage
      .getInteractionsByLearner(learnerId)
      .filter(
        (interaction) =>
          interaction.sessionId === sessionId &&
          interaction.problemId === currentProblem.id &&
          interaction.eventType === 'error'
      )
      .sort((a, b) => b.timestamp - a.timestamp)[0];

    const subtype = latestErrorInteraction?.sqlEngageSubtype || latestErrorInteraction?.errorSubtypeId;
    return subtype ? canonicalizeSqlEngageSubtype(subtype) : undefined;
  };

  const persistGeneratedUnit = async (
    templateId: 'explanation.v1' | 'notebook_unit.v1',
    sourceInteractionIds: string[],
    errorSubtypeId?: string,
    ruleFired: string = 'manual'
  ) => {
    const trace = storage
      .getInteractionsByLearner(learnerId)
      .filter((interaction) =>
        interaction.sessionId === sessionId &&
        interaction.problemId === currentProblem.id
      );

    const bundle = buildBundleForCurrentProblem({
      learnerId,
      problem: currentProblem,
      interactions: trace,
      triggerInteractionIds: sourceInteractionIds,
      lastErrorSubtypeId: errorSubtypeId
    });

    const generation = await generateUnitFromLLM({
      learnerId,
      sessionId,
      templateId,
      bundle,
      triggerInteractionIds: sourceInteractionIds
    });

    const textbookResult = storage.saveTextbookUnit(learnerId, generation.unit);
    setLatestGeneratedUnit(textbookResult.unit);
    const parseSuccess = generation.parseTelemetry.status === 'success';
    const parseMode = generation.parseTelemetry.mode || null;
    const parseFailureReason = generation.parseTelemetry.failureReason || null;
    const pdfIndexOutputFields = buildPdfIndexOutputFields(bundle.pdfIndexProvenance);

    const llmEvent: InteractionEvent = {
      id: createEventId('llm', templateId),
      sessionId,
      learnerId,
      timestamp: Date.now(),
      eventType: 'llm_generate',
      problemId: currentProblem.id,
      templateId,
      inputHash: generation.inputHash,
      model: generation.model,
      policyVersion: getSqlEngagePolicyVersion(),
      ruleFired,
      noteId: textbookResult.unit.id,
      retrievedSourceIds: textbookResult.unit.provenance?.retrievedSourceIds || bundle.retrievedSourceIds,
      triggerInteractionIds: sourceInteractionIds,
      inputs: {
        retry_count: bundle.recentInteractionsSummary.retries,
        hint_count: bundle.recentInteractionsSummary.hintCount,
        time_spent_ms: bundle.recentInteractionsSummary.timeSpent
      },
      outputs: {
        note_id: textbookResult.unit.id,
        template_id: templateId,
        cache_hit: generation.fromCache,
        parse_success: parseSuccess,
        parse_mode: parseMode,
        parse_attempts: generation.parseTelemetry.attempts,
        parse_failure_reason: parseFailureReason,
        fallback_used: generation.usedFallback,
        fallback_reason: generation.fallbackReason,
        ...pdfIndexOutputFields
      }
    };
    storage.saveInteraction(llmEvent);
    setInteractions((previousInteractions) => [...previousInteractions, llmEvent]);

    // Build retrieved chunks info for RAG provenance
    const retrievedChunks: RetrievedChunkInfo[] = textbookResult.unit.provenance?.retrievedPdfCitations?.map(c => ({
      docId: c.docId,
      page: c.page,
      chunkId: c.chunkId,
      score: c.score
    })) || [];

    const textbookEvent: InteractionEvent = {
      id: createEventId('textbook', templateId),
      sessionId,
      learnerId,
      timestamp: Date.now(),
      eventType: textbookResult.action === 'created' ? 'textbook_add' : 'textbook_update',
      problemId: currentProblem.id,
      noteId: textbookResult.unit.id,
      noteTitle: textbookResult.unit.title,
      noteContent: textbookResult.unit.content,
      templateId,
      inputHash: generation.inputHash,
      model: generation.model,
      policyVersion: getSqlEngagePolicyVersion(),
      ruleFired,
      conceptIds: [textbookResult.unit.conceptId],
      retrievedSourceIds: textbookResult.unit.provenance?.retrievedSourceIds || bundle.retrievedSourceIds,
      retrievedChunks: retrievedChunks.length > 0 ? retrievedChunks : undefined,
      triggerInteractionIds: sourceInteractionIds,
      evidenceInteractionIds: sourceInteractionIds,
      inputs: {
        retry_count: bundle.recentInteractionsSummary.retries,
        hint_count: bundle.recentInteractionsSummary.hintCount,
        time_spent_ms: bundle.recentInteractionsSummary.timeSpent
      },
      outputs: {
        note_id: textbookResult.unit.id,
        note_title: textbookResult.unit.title,
        note_content_length: textbookResult.unit.content?.length || 0,
        concept_id: textbookResult.unit.conceptId,
        textbook_action: textbookResult.action,
        template_id: templateId,
        parse_success: parseSuccess,
        parse_mode: parseMode,
        parse_attempts: generation.parseTelemetry.attempts,
        parse_failure_reason: parseFailureReason,
        fallback_used: generation.usedFallback,
        fallback_reason: generation.fallbackReason,
        has_real_content: !generation.usedFallback && parseSuccess,
        ...pdfIndexOutputFields
      }
    };
    storage.saveInteraction(textbookEvent);
    setInteractions((previousInteractions) => [...previousInteractions, textbookEvent]);

    return { generation, textbookResult };
  };

  const handleExecute = async (query: string, result: QueryResult, isCorrect?: boolean) => {
    // isCorrect indicates if results match expected (for result-graded problems)
    // If not provided, fall back to result.success (no SQL errors)
    const actuallyCorrect = isCorrect ?? result.success;
    
    const resolvedSubtype = !result.success
      ? canonicalizeSqlEngageSubtype(instructorSubtypeOverride || result.errorSubtypeId)
      : undefined;
    const event: InteractionEvent = {
      id: createEventId('event', 'execution'),
      sessionId,
      learnerId,
      timestamp: Date.now(),
      eventType: result.success ? 'execution' : 'error',
      problemId: currentProblem.id,
      code: query,
      error: result.error,
      errorSubtypeId: resolvedSubtype,
      sqlEngageSubtype: resolvedSubtype,
      policyVersion: getSqlEngagePolicyVersion(),
      successful: actuallyCorrect,  // Now reflects correctness, not just execution success
      timeSpent: Date.now() - startTime,
      // Track attempted concepts for all executable submissions so incorrect
      // (result-graded) runs can reduce mastery evidence.
      conceptIds: result.success ? [...currentProblem.concepts] : undefined
    };

    storage.saveInteraction(event);
    setInteractions((previousInteractions) => [...previousInteractions, event]);

    if (!result.success && resolvedSubtype) {
      setLastError(resolvedSubtype);
      setLastErrorEventId(event.id);
      setNotesActionMessage(undefined);
      setGenerationError(undefined);
    }

    if (result.success) {
      setLastError(undefined);
      setLastErrorEventId(undefined);
      setEscalationTriggered(false);
      setNotesActionMessage(undefined);
      setGenerationError(undefined);
      setLatestGeneratedUnit(null);
      return;
    }

    const profile = storage.getProfile(learnerId);
    if (!profile) {
      return;
    }

    const scopedInteractions = storage
      .getInteractionsByLearner(learnerId)
      .filter((interaction) =>
        interaction.sessionId === sessionId &&
        interaction.problemId === currentProblem.id
      );
    const decision = orchestrator.makeDecision(profile, scopedInteractions, currentProblem.id);

    if (decision.decision === 'add_to_textbook' && resolvedSubtype) {
      const sourceIds = collectNoteEvidenceIds([event.id]);
      setIsGeneratingUnit(true);
      setGenerationError(undefined);
      try {
        const { textbookResult } = await persistGeneratedUnit(
          'notebook_unit.v1',
          sourceIds,
          resolvedSubtype,
          decision.ruleFired || 'aggregation-threshold-met'
        );
        setNotesActionMessage(
          textbookResult.action === 'created'
            ? 'Policy added a note to My Textbook.'
            : 'Policy refreshed an existing note in My Textbook.'
        );
      } catch (error) {
        setGenerationError((error as Error).message);
      } finally {
        setIsGeneratingUnit(false);
      }
    }
  };

  const handleEscalate = (sourceInteractionIds?: string[]) => {
    setEscalationTriggered(true);
    const sourceIds = sourceInteractionIds && sourceInteractionIds.length > 0
      ? sourceInteractionIds
      : collectNoteEvidenceIds([], { maxInteractions: 8 });
    if (sourceInteractionIds && sourceInteractionIds.length > 0) {
      setLastErrorEventId(sourceInteractionIds[sourceInteractionIds.length - 1]);
    }

    const escalationSubtype = lastError || resolveLatestProblemErrorSubtype();
    if (!escalationSubtype) {
      return;
    }
    if (!lastError) {
      setLastError(escalationSubtype);
    }

    setIsGeneratingUnit(true);
    setGenerationError(undefined);
    void persistGeneratedUnit('explanation.v1', sourceIds, escalationSubtype, 'show-explanation-escalation')
      .then(({ textbookResult }) => {
        setNotesActionMessage(
          textbookResult.action === 'created'
            ? 'Explanation generated automatically.'
            : 'Explanation refreshed automatically.'
        );
      })
      .catch((error) => {
        setGenerationError((error as Error).message);
      })
      .finally(() => {
        setIsGeneratingUnit(false);
      });
  };

  const handleHintSystemInteraction = (event: InteractionEvent) => {
    if (event.learnerId !== learnerId) {
      return;
    }
    // Use storage.getActiveSessionId() to avoid stale closure issue
    const activeSessionId = storage.getActiveSessionId();
    if (activeSessionId && event.sessionId && event.sessionId !== activeSessionId) {
      return;
    }
    setInteractions((previousInteractions) => {
      if (previousInteractions.some((existing) => existing.id === event.id)) {
        return previousInteractions;
      }
      return [...previousInteractions, event];
    });
  };

  const handleAddToNotes = async () => {
    const noteSubtype = lastError || resolveLatestProblemErrorSubtype();
    if (!noteSubtype) return;
    if (!lastError) {
      setLastError(noteSubtype);
    }

    const sourceIds = collectNoteEvidenceIds([], { maxInteractions: 12 });
    setIsGeneratingUnit(true);
    setGenerationError(undefined);
    try {
      const { textbookResult } = await persistGeneratedUnit(
        'notebook_unit.v1',
        sourceIds,
        noteSubtype,
        'manual-add-to-notes'
      );
      setNotesActionMessage(
        textbookResult.action === 'created'
          ? 'Added to My Notes.'
          : 'Updated existing My Notes entry.'
      );
    } catch (error) {
      setGenerationError((error as Error).message);
    } finally {
      setIsGeneratingUnit(false);
    }
  };

  const timeSpent = Date.now() - startTime;

  // Memoized problem grouping by difficulty
  const problemsByDifficulty = useMemo(() => 
    sqlProblems.reduce((acc, problem) => {
      if (!acc[problem.difficulty]) {
        acc[problem.difficulty] = [];
      }
      acc[problem.difficulty].push(problem);
      return acc;
    }, {} as Record<string, SQLProblem[]>),
    []
  );

  const difficultyOrder = ['beginner', 'intermediate', 'advanced'];

  // Memoized learner session interactions
  const learnerSessionInteractions = useMemo(() => 
    interactions.filter(
      (interaction) =>
        interaction.learnerId === learnerId &&
        (!sessionId || interaction.sessionId === sessionId)
    ),
    [interactions, learnerId, sessionId]
  );

  // Memoized problem interactions
  const problemInteractions = useMemo(() => 
    learnerSessionInteractions.filter(i => i.problemId === currentProblem.id),
    [learnerSessionInteractions, currentProblem.id]
  );

  // Memoized helper to check if a problem has been solved
  const solvedProblemIds = useMemo(() => {
    const solved = new Set<string>();
    for (const interaction of learnerSessionInteractions) {
      if (interaction.eventType === 'execution' && interaction.successful && interaction.problemId) {
        solved.add(interaction.problemId);
      }
    }
    return solved;
  }, [learnerSessionInteractions]);

  const isProblemSolved = useCallback((problemId: string): boolean => {
    return solvedProblemIds.has(problemId);
  }, [solvedProblemIds]);

  // Get count of solved problems
  const solvedCount = solvedProblemIds.size;

  // Calculate progress percentage
  const progressPercentage = useMemo(() => 
    Math.round((solvedCount / sqlProblems.length) * 100),
    [solvedCount]
  );

  // Memoized error and attempt calculations
  const latestProblemErrorEvent = useMemo(() => 
    [...problemInteractions]
      .reverse()
      .find((interaction) => interaction.eventType === 'error'),
    [problemInteractions]
  );

  const latestProblemErrorSubtype = latestProblemErrorEvent?.sqlEngageSubtype || latestProblemErrorEvent?.errorSubtypeId;
  const effectiveLastError = lastError || latestProblemErrorSubtype;
  const showAddToNotes = escalationTriggered && !!effectiveLastError;
  
  const errorCount = useMemo(() => 
    problemInteractions.filter(i => i.eventType === 'error').length,
    [problemInteractions]
  );
  
  const totalAttempts = useMemo(() => 
    problemInteractions.filter(
      (interaction) => interaction.eventType === 'execution' || interaction.eventType === 'error'
    ).length,
    [problemInteractions]
  );
  
  const hintViewsCount = useMemo(() => 
    problemInteractions.filter((interaction) => interaction.eventType === 'hint_view').length,
    [problemInteractions]
  );
  
  const helpRequestsCount = useMemo(() => 
    problemInteractions.filter(
      (interaction) => interaction.eventType === 'hint_view' || interaction.eventType === 'explanation_view'
    ).length,
    [problemInteractions]
  );

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="container mx-auto px-4 py-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-4">
              <Card className="p-6">
                <Skeleton className="h-8 w-3/4 mb-4" />
                <Skeleton className="h-4 w-full mb-2" />
                <Skeleton className="h-4 w-2/3" />
              </Card>
              <Skeleton className="h-[500px]" />
            </div>
            <div className="space-y-4">
              <Skeleton className="h-48" />
              <Skeleton className="h-48" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
        {/* Week 5: Dependency Warning Toast */}
        {showDependencyWarning && (
          <DependencyWarningToast onClose={() => setShowDependencyWarning(false)} />
        )}

        <div className={cn(
          "border-b",
          isStudent ? "bg-gradient-to-r from-blue-50 to-white border-blue-100" : "bg-amber-50 border-amber-200"
        )}>
          <div className="container mx-auto px-4 py-4">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              {isStudent ? (
                // Student-friendly header with blue accent
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-blue-100 rounded-xl">
                    <GraduationCap className="size-7 text-blue-600" />
                  </div>
                  <div>
                    <h1 className="text-2xl font-bold text-gray-900">Practice SQL</h1>
                    <p className="text-gray-600 text-sm">Learn SQL with personalized hints and explanations</p>
                  </div>
                </div>
              ) : (
                // Instructor header with amber accent
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-amber-200 rounded-xl">
                    <Settings2 className="size-7 text-amber-700" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h1 className="text-2xl font-bold text-gray-900">SQL Learning Lab</h1>
                      <Badge variant="outline" className="bg-amber-100 text-amber-800 border-amber-300">
                        Instructor Mode
                      </Badge>
                    </div>
                    <p className="text-gray-600 text-sm">Adaptive instructional system with Guidance Ladder</p>
                  </div>
                </div>
              )}
              <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
                {/* Enhanced Session Timer */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 rounded-lg">
                      {isTimerPaused ? (
                        <Pause className="size-4 text-amber-500" />
                      ) : (
                        <Clock className="size-4 text-gray-500" />
                      )}
                      <span className="text-sm font-medium tabular-nums">
                        {formatTime(elapsedTime)}
                      </span>
                      {totalTimeAcrossSessions > 0 && (
                        <span className="text-xs text-gray-500">
                          (total: {formatTime(totalTimeAcrossSessions + elapsedTime)})
                        </span>
                      )}
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Session time (pauses when tab is inactive)</p>
                    {totalTimeAcrossSessions > 0 && (
                      <p className="text-xs text-gray-400">
                        Total across all sessions: {formatTime(totalTimeAcrossSessions + elapsedTime)}
                      </p>
                    )}
                  </TooltipContent>
                </Tooltip>

                {/* Student progress indicator */}
                {isStudent && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="flex items-center gap-2 px-3 py-1.5 bg-green-50 rounded-lg border border-green-200">
                        <Target className="size-4 text-green-600" />
                        <span className="text-sm font-medium text-green-700">
                          {solvedCount}/{sqlProblems.length} solved
                        </span>
                        <div className="w-16 h-2 bg-green-200 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-green-500 rounded-full transition-all"
                            style={{ width: `${progressPercentage}%` }}
                          />
                        </div>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Your progress: {progressPercentage}% complete</p>
                    </TooltipContent>
                  </Tooltip>
                )}

                {/* Week 5: Profile Badge - DEV mode only, subtle */}
                {isDev && isStudent && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className={cn(
                        "flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium cursor-help transition-all hover:shadow-sm",
                        profileBadgeColors[currentProfileId]?.bg || 'bg-gray-100',
                        profileBadgeColors[currentProfileId]?.text || 'text-gray-700',
                        profileBadgeColors[currentProfileId]?.border || 'border-gray-200'
                      )}>
                        <Zap className={cn(
                          "size-3",
                          profileBadgeColors[currentProfileId]?.icon || 'text-gray-500'
                        )} />
                        <span>{profileDisplayNames[currentProfileId] || currentProfileId}</span>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">
                      <p>{profileDescriptions[currentProfileId]}</p>
                      <p className="text-xs text-gray-400 mt-1">
                        HDI: {(currentHDI * 100).toFixed(0)}% • {hdiTrend}
                      </p>
                    </TooltipContent>
                  </Tooltip>
                )}

                {/* Role selector - only show for instructors or in dev mode */}
                {isInstructor && (
                  <Select value={role} onValueChange={(value) => {
                    localStorage.setItem('sql-adapt-user-role', value);
                    window.location.reload();
                  }}>
                    <SelectTrigger className="w-full sm:w-[150px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="student">Student</SelectItem>
                      <SelectItem value="instructor">Instructor</SelectItem>
                    </SelectContent>
                  </Select>
                )}

                {/* User name display - switching handled via "Switch User" in navigation */}
                {profile?.name && (
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 rounded-lg border border-blue-200">
                    <GraduationCap className="size-4 text-blue-600" />
                    <span className="text-sm font-medium text-blue-700">{profile.name}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="container mx-auto px-4 py-6">
          {/* Concept Learning Banner */}
          {activeConceptId && activeConceptTitle && (
            <div className="mb-6 bg-blue-50 border-l-4 border-blue-500 rounded-r-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-blue-600 font-medium mb-1">Learning Mode</p>
                  <p className="text-blue-900 font-semibold text-lg">{activeConceptTitle}</p>
                </div>
                <div className="flex items-center gap-3">
                  <Link 
                    to={`/concepts/${activeConceptId}`}
                    className="text-sm text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1"
                  >
                    <BookOpen className="w-4 h-4" />
                    Review Concept
                  </Link>
                  <button
                    onClick={() => {
                      setActiveConceptId(null);
                      setActiveConceptTitle(null);
                      // Clear query params without reload
                      window.history.replaceState({}, '', '/practice');
                    }}
                    className="text-gray-400 hover:text-gray-600"
                    title="Clear learning context"
                  >
                    ×
                  </button>
                </div>
              </div>
            </div>
          )}
          
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Main problem area */}
            <div className="lg:col-span-2 space-y-4 min-w-0">
              <Card className="p-6">
                <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <h2 className="text-xl font-bold">{currentProblem.title}</h2>
                      <Badge 
                        variant="outline"
                        className={`w-fit ${difficultyColors[currentProblem.difficulty]}`}
                      >
                        {currentProblem.difficulty}
                      </Badge>
                      {isProblemSolved(currentProblem.id) && (
                        <Badge className="bg-green-100 text-green-800 border-green-200">
                          <Check className="size-3 mr-1" />
                          Solved
                        </Badge>
                      )}
                    </div>
                    <p className="text-gray-700">{currentProblem.description}</p>
                    
                    {/* Concept tags */}
                    <div className="flex flex-wrap gap-1.5 mt-3">
                      {currentProblem.concepts.map(conceptId => {
                        const concept = getConceptById(conceptId);
                        return (
                          <Tooltip key={conceptId}>
                            <TooltipTrigger asChild>
                              <Badge variant="secondary" className="text-xs cursor-help">
                                <BookOpen className="size-3 mr-1" />
                                {concept?.name || conceptId}
                              </Badge>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p className="font-medium">{concept?.name || conceptId}</p>
                              {concept?.description && (
                                <p className="text-xs text-gray-400 max-w-xs">{concept.description}</p>
                              )}
                            </TooltipContent>
                          </Tooltip>
                        );
                      })}
                    </div>
                  </div>
                  
                  {/* Enhanced Problem Selector with difficulty, concepts, and solved status */}
                  <Select 
                    value={currentProblem.id} 
                    onValueChange={handleProblemChange}
                  >
                    <SelectTrigger className="w-full lg:w-[300px]" data-testid="problem-select-trigger">
                      <div className="flex items-center gap-2 overflow-hidden">
                        <span className="truncate">{currentProblem.title}</span>
                        <Badge variant="outline" className="text-[10px] px-1 shrink-0 hidden sm:inline-flex">
                          {solvedCount}/{sqlProblems.length}
                        </Badge>
                      </div>
                    </SelectTrigger>
                    <SelectContent className="max-h-[400px] w-[calc(100vw-2rem)] sm:w-auto max-w-[400px]">
                      {difficultyOrder.map(difficulty => {
                        const problems = problemsByDifficulty[difficulty];
                        if (!problems?.length) return null;
                        const solvedInDifficulty = problems.filter(p => isProblemSolved(p.id)).length;
                        return (
                          <div key={difficulty}>
                            <div className={`px-2 py-1.5 text-xs font-semibold uppercase tracking-wide ${
                              difficulty === 'beginner' ? 'text-green-700 bg-green-50' :
                              difficulty === 'intermediate' ? 'text-yellow-700 bg-yellow-50' :
                              'text-red-700 bg-red-50'
                            }`}>
                              {difficulty} ({solvedInDifficulty}/{problems.length} solved)
                            </div>
                            {problems.map(problem => {
                              const solved = isProblemSolved(problem.id);
                              return (
                                <SelectItem key={problem.id} value={problem.id} className="pl-4 py-2">
                                  <div className="flex items-center gap-2 w-full">
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-1.5">
                                        <span className={`font-medium truncate ${solved ? 'text-green-700' : ''}`}>
                                          {problem.title}
                                        </span>
                                        {solved && (
                                          <Check className="size-3.5 text-green-600 shrink-0" />
                                        )}
                                      </div>
                                      <span className="text-xs text-gray-500">
                                        {problem.concepts.length} concept{problem.concepts.length !== 1 ? 's' : ''}
                                      </span>
                                    </div>
                                  </div>
                                </SelectItem>
                              );
                            })}
                          </div>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>

                <div className="mb-4 flex flex-wrap items-center gap-4 text-sm text-gray-600">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="flex items-center gap-1 cursor-help">
                        <AlertCircle className="size-4" />
                        <span>{errorCount} errors</span>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Number of errors in this session</p>
                    </TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="flex items-center gap-1 cursor-help">
                        <CheckCircle2 className="size-4" />
                        <span>
                          {problemInteractions.filter(i => i.successful).length} successful runs
                        </span>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Number of successful query executions</p>
                    </TooltipContent>
                  </Tooltip>
                </div>

                {/* Instructor Controls - only visible in instructor mode */}
                {isInstructor && (
                  <Card className="p-4 mb-4 bg-amber-50 border-amber-200">
                    <h3 className="font-semibold text-sm mb-3">Instructor Controls</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <p className="text-xs text-gray-700 mb-1">Error subtype override</p>
                        <Select value={subtypeOverride} onValueChange={setSubtypeOverride}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="auto">Auto-detect</SelectItem>
                            {INSTRUCTOR_SUBTYPE_OPTIONS.map((subtype) => (
                              <SelectItem key={subtype} value={subtype}>
                                {subtype}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <p className="text-xs text-gray-700 mb-1">Strategy</p>
                        <Select
                          value={storage.getProfile(learnerId)?.currentStrategy || 'adaptive-medium'}
                          onValueChange={(value) => {
                            const profile = storage.getProfile(learnerId);
                            if (profile) {
                              storage.saveProfile({
                                ...profile,
                                currentStrategy: value as LearnerProfile['currentStrategy']
                              });
                            }
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {STRATEGY_OPTIONS.map((option) => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </Card>
                )}

                <div className="mb-4">
                  <h3 className="font-semibold text-sm mb-2">Database Schema:</h3>
                  <pre className="bg-gray-100 p-3 rounded text-xs overflow-x-auto">
                    {currentProblem.schema}
                  </pre>
                </div>
              </Card>

              <div className="h-[350px] sm:h-[450px] lg:h-[550px]">
                <SQLEditor
                  problem={currentProblem}
                  code={sqlDraft}
                  onExecute={handleExecute}
                  onCodeChange={handleEditorCodeChange}
                  onReset={handleEditorReset}
                />
              </div>
            </div>

            {/* Sidebar with hints */}
            <div className="space-y-4 min-w-0">
              <HintSystem
                key={`${learnerId}:${sessionId}:${currentProblem.id}:${instructorSubtypeOverride || 'auto'}`}
                sessionId={sessionId}
                learnerId={learnerId}
                problemId={currentProblem.id}
                errorSubtypeId={effectiveLastError}
                isSubtypeOverrideActive={Boolean(instructorSubtypeOverride)}
                knownSubtypeOverride={instructorSubtypeOverride}
                recentInteractions={problemInteractions}
                onEscalate={handleEscalate}
                onInteractionLogged={handleHintSystemInteraction}
              />

              {/* Week 5: Progress Hint - subtle, below hint panel */}
              {isStudent && progressHint && (
                <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
                  <div className="flex items-center gap-2 px-3 py-2 bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-100 rounded-lg">
                    {hdiTrend === 'decreasing' ? (
                      <Sprout className="size-4 text-emerald-500" />
                    ) : hdiTrend === 'increasing' ? (
                      <TrendingUp className="size-4 text-amber-500 rotate-180" />
                    ) : (
                      <Sparkles className="size-4 text-emerald-500" />
                    )}
                    <span className="text-sm text-emerald-700">{progressHint}</span>
                  </div>
                </div>
              )}

              {/* Week 3 Feature: Ask My Textbook Chat */}
              <AskMyTextbookChat
                sessionId={sessionId}
                learnerId={learnerId}
                problemId={currentProblem.id}
                recentInteractions={problemInteractions}
                onInteractionLogged={handleHintSystemInteraction}
              />

              {showAddToNotes && (
                <Card className="p-4 space-y-3">
                  <div>
                    <h3 className="font-semibold">Escalation</h3>
                    <p className="text-sm text-gray-600">
                      Explanations are generated automatically after Hint 3. Add to My Notes to save a reflective notebook unit.
                    </p>
                  </div>
                  <Button onClick={handleAddToNotes} size="sm" className="w-full" disabled={isGeneratingUnit}>
                    {isGeneratingUnit ? (
                      <>
                        <Sparkles className="size-4 mr-2 animate-pulse" />
                        Generating...
                      </>
                    ) : (
                      'Add to My Notes'
                    )}
                  </Button>
                  {isGeneratingUnit && (
                    <p className="text-xs text-gray-500">Generating grounded content from retrieved sources...</p>
                  )}
                  {generationError && (
                    <p className="text-xs text-amber-700">{generationError}</p>
                  )}
                  {notesActionMessage && (
                    <p className="text-xs text-gray-600">{notesActionMessage}</p>
                  )}
                  {latestGeneratedUnit && (
                    <div className="rounded border bg-slate-50 p-2">
                      <p className="text-xs font-medium text-slate-700">{latestGeneratedUnit.title}</p>
                      {latestGeneratedUnit.provenance && (
                        <p className="text-[11px] text-slate-600 mt-1">
                          {latestGeneratedUnit.provenance.templateId} • {latestGeneratedUnit.provenance.model}
                        </p>
                      )}
                    </div>
                  )}
                </Card>
              )}

              <ConceptCoverage learnerId={learnerId} />

              <Card className="p-4">
                <h3 className="font-semibold mb-3">Session Stats</h3>
                <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-2 text-sm">
                  <div className="text-gray-600">Total attempts:</div>
                  <div className="font-medium text-right">{totalAttempts}</div>
                  <div className="text-gray-600">Hints viewed:</div>
                  <div className="font-medium text-right">{hintViewsCount}</div>
                  <div className="text-gray-600">Help requests:</div>
                  <div className="font-medium text-right">{helpRequestsCount}</div>
                  <div className="text-gray-600">Session ID:</div>
                  <div className="max-w-[180px] break-all text-right text-[11px] font-medium text-gray-700 sm:max-w-[220px] sm:text-xs">
                    {sessionId || 'pending'}
                  </div>
                  <div className="text-gray-600">Time spent:</div>
                  <div className="font-medium text-right">
                    {formatTime(timeSpent)}
                  </div>
                </div>
              </Card>

              {/* Keyboard Shortcuts Help */}
              <Card className="p-4 bg-slate-50 border-slate-200">
                <div className="flex items-center gap-2 mb-3">
                  <Keyboard className="size-4 text-slate-600" />
                  <h3 className="font-semibold text-sm text-slate-700">Keyboard Shortcuts</h3>
                </div>
                <div className="space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-600">Run query</span>
                    <kbd className="px-1.5 py-0.5 bg-white border border-slate-300 rounded text-slate-700 font-mono">Ctrl+Enter</kbd>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-600">Focus problem</span>
                    <kbd className="px-1.5 py-0.5 bg-white border border-slate-300 rounded text-slate-700 font-mono">Ctrl+/</kbd>
                  </div>
                </div>
              </Card>
            </div>
          </div>
        </div>
      </div>
  );
}

