/**
 * LearningInterface.tsx
 * 
 * Main student practice interface for SQL problem solving.
 * 
 * RESPONSIBILITIES:
 * - Problem presentation and navigation
 * - SQL code editor integration
 * - Hint/explanation system coordination
 * - Real-time telemetry capture (interactions, HDI, bandit state)
 * - Session management and condition assignment
 * - Progress tracking and completion detection
 * 
 * KEY SUBSYSTEMS:
 * - Telemetry: Captures every keystroke, execution, hint request to interaction_events
 * - HDI Calculation: Real-time Help Dependency Index for adaptive support
 * - Bandit: Thompson sampling for profile assignment (if enabled)
 * - Session Config: Experimental condition persistence across reloads
 * 
 * SIZE NOTE: This file is intentionally large (~3000 LOC) to maintain
 * cohesive student experience. Sub-components extracted where reuse needed.
 * 
 * @module LearningInterface
 */

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';

import {
  Clock,
  CheckCircle2,
  CheckCircle,
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
  TrendingUp,
  X,
  Eye,
  LogOut,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';

import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Badge } from '../components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '../components/ui/tooltip';
import { Skeleton } from '../components/ui/skeleton';
import { cn } from '../components/ui/utils';
import { DEFAULT_SQL_EDITOR_CODE, SQLEditor } from '../components/features/sql/SQLEditor';
import { HintSystem } from '../components/features/hints/HintSystem';
import { ConceptCoverage } from '../components/features/research/ConceptCoverage';
import { AskMyTextbookChat } from '../components/features/chat/AskMyTextbookChat';
import { ReinforcementPrompt } from '../components/features/reinforcement/ReinforcementPrompt';
import { useLLMSettings } from '../components/shared/LLMSettingsHelper';
import { useScreenReaderAnnouncer } from '../components/shared/ScreenReaderAnnouncer';
import { sqlProblems } from '../data/problems';
import { canonicalizeSqlEngageSubtype, getKnownSqlEngageSubtypes, getSqlEngagePolicyVersion, getConceptById } from '../data/sql-engage';
import { useUserRole } from '../hooks/useUserRole';
import { useLocation } from 'react-router';
import { storage, subscribeToSync, clearAllDebugSettingsWithSync, broadcastSync } from '../lib/storage';
import { useAuth } from '../lib/auth-context';
import { AUTH_BACKEND_CONFIGURED } from '../lib/api/auth-client';
import { clearUiStateForActor, getUiState, setUiState } from '../lib/ui-state';
import type { QueryResult } from '../lib/sql-executor';
import { orchestrator } from '../lib/adaptive-orchestrator';
import { buildBundleForCurrentProblem, generateUnitFromLLM } from '../lib/content/content-generator';
import { buildPdfIndexOutputFields } from '../lib/api/pdf-retrieval';
import { createEventId } from '../lib/utils/event-id';
import { startBackgroundAnalysis, stopBackgroundAnalysis, runAnalysisOnce, ANALYSIS_INTERVAL_MS } from '../lib/trace-analyzer';
import type { AnalysisResult } from '../lib/trace-analyzer';
import { getConcept, getTextbookCorpusMode } from '../lib/content/concept-loader';
import { banditManager, PROFILE_TO_ARM_ID, BANDIT_ARM_PROFILES } from '../lib/ml/learner-bandit-manager';
import { calculateHDI, calculateHDIComponents } from '../lib/ml/hdi-calculator';
import type { HDIComponents, HDILevel } from '../types';
import { safeGetStrategy, safeGetProfileOverride } from '../lib/storage/storage-validation';
import { assignProfile, getProfileById, type EscalationProfile } from '../lib/ml/escalation-profiles';
import { 
  assignCondition, 
  loadSessionConfig,
  loadSessionConfigAsync,
  saveSessionConfig,
  getConditionAssignmentVersion
} from '../lib/experiments/condition-assignment';
import type { SessionConfig } from '../types';
import type { BanditArmId } from '../lib/ml/learner-bandit-manager';
import type { SQLProblem, InteractionEvent, InstructionalUnit, LearnerProfile, RetrievedChunkInfo, HDITrend } from '../types';
import { reinforcementManager, type ActivePrompt } from '../lib/content/reinforcement-manager';
import { detectPrerequisiteViolation, logPrerequisiteViolation, type PrerequisiteViolation } from '../lib/content/prerequisite-detector';
import { checkPrerequisites } from '../lib/content/prerequisite-checker';
import { getUnlockedConcepts } from '../data/concept-graph';
import { 
  checkProblemReadiness,
  buildLearningPath,
  updatePathAfterSuccess,
  getNextRecommendedConcept,
  updateMasteryFromInteraction,
  propagateMastery,
  assessReflection,
  type LearningPathRecommendation,
  type PathProgress
} from '../lib/knowledge';
import { useDebouncedCodeChange } from '../hooks/useDebouncedCodeChange';
import { useLearnerProgress } from '../hooks/useLearnerProgress';

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
  intermediate: 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-200',
  advanced: 'bg-red-100 text-red-800 border-red-200'
};

// Week 5: Profile badge color mapping
const profileBadgeColors: Record<string, { bg: string; text: string; border: string; icon: string }> = {
  aggressive: { bg: 'bg-blue-100', text: 'text-blue-700', border: 'border-blue-200', icon: 'text-blue-600' },
  adaptive: { bg: 'bg-green-100', text: 'text-green-700', border: 'border-green-200', icon: 'text-green-600' },
  conservative: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', icon: 'text-amber-600' },
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

interface PracticePageUiState {
  currentProblemId?: string;
  activeConceptId?: string | null;
  activeConceptTitle?: string | null;
  subtypeOverride?: string;
}

interface PracticeDraftLookup {
  getPracticeDraft: (sessionId: string, problemId: string) => string | null;
  findAnyPracticeDraft: (problemId: string) => string | null;
}

function findProblemById(problemId: string | null | undefined, problems: SQLProblem[]): SQLProblem | null {
  if (!problemId) return null;
  return problems.find((problem) => problem.id === problemId) ?? null;
}

export function resolvePracticeProblemFromSources(args: {
  problems: SQLProblem[];
  fallbackProblem: SQLProblem;
  persistedProblemId?: string;
  backendProblemId?: string | null;
  preferBackendProblem: boolean;
}): SQLProblem {
  const { problems, fallbackProblem, persistedProblemId, backendProblemId, preferBackendProblem } = args;

  if (preferBackendProblem) {
    return (
      findProblemById(backendProblemId, problems) ??
      findProblemById(persistedProblemId, problems) ??
      fallbackProblem
    );
  }

  return (
    findProblemById(persistedProblemId, problems) ??
    findProblemById(backendProblemId, problems) ??
    fallbackProblem
  );
}

export function resolvePracticeDraftState(args: {
  lookup: PracticeDraftLookup;
  sessionId: string;
  fallbackProblem: SQLProblem;
  problems: SQLProblem[];
  isMeaningfulDraft: (draft: string | null | undefined) => draft is string;
  lockProblemId?: string | null;
}): { problem: SQLProblem; draft: string | null } {
  const { lookup, sessionId, fallbackProblem, problems, isMeaningfulDraft, lockProblemId } = args;

  const lockedProblem = findProblemById(lockProblemId, problems);
  if (lockedProblem) {
    const currentSessionDraft = lookup.getPracticeDraft(sessionId, lockedProblem.id);
    if (isMeaningfulDraft(currentSessionDraft)) {
      return { problem: lockedProblem, draft: currentSessionDraft };
    }

    const anySessionDraft = lookup.findAnyPracticeDraft(lockedProblem.id);
    if (isMeaningfulDraft(anySessionDraft)) {
      return { problem: lockedProblem, draft: anySessionDraft };
    }

    return { problem: lockedProblem, draft: null };
  }

  const currentSessionDraft = lookup.getPracticeDraft(sessionId, fallbackProblem.id);
  if (isMeaningfulDraft(currentSessionDraft)) {
    return { problem: fallbackProblem, draft: currentSessionDraft };
  }
  const currentAnySessionDraft = lookup.findAnyPracticeDraft(fallbackProblem.id);
  if (isMeaningfulDraft(currentAnySessionDraft)) {
    return { problem: fallbackProblem, draft: currentAnySessionDraft };
  }

  let fallbackAnyDraft: { problem: SQLProblem; draft: string } | null = null;
  for (const problem of problems) {
    const sessionDraft = lookup.getPracticeDraft(sessionId, problem.id);
    if (isMeaningfulDraft(sessionDraft)) {
      return { problem, draft: sessionDraft };
    }
    if (!fallbackAnyDraft && typeof sessionDraft === 'string' && sessionDraft.trim().length > 0) {
      fallbackAnyDraft = { problem, draft: sessionDraft };
    }
  }

  for (const problem of problems) {
    const anySessionDraft = lookup.findAnyPracticeDraft(problem.id);
    if (isMeaningfulDraft(anySessionDraft)) {
      return { problem, draft: anySessionDraft };
    }
    if (!fallbackAnyDraft && typeof anySessionDraft === 'string' && anySessionDraft.trim().length > 0) {
      fallbackAnyDraft = { problem, draft: anySessionDraft };
    }
  }

  const activeProblemFromSessionId = sessionId && !sessionId.startsWith('session-')
    ? findProblemById(sessionId, problems)
    : null;
  if (activeProblemFromSessionId) {
    const activeProblemDraft = lookup.getPracticeDraft(sessionId, activeProblemFromSessionId.id);
    if (isMeaningfulDraft(activeProblemDraft)) {
      return { problem: activeProblemFromSessionId, draft: activeProblemDraft };
    }
    const activeProblemAnySessionDraft = lookup.findAnyPracticeDraft(activeProblemFromSessionId.id);
    if (isMeaningfulDraft(activeProblemAnySessionDraft)) {
      return { problem: activeProblemFromSessionId, draft: activeProblemAnySessionDraft };
    }
  }

  if (fallbackAnyDraft) {
    return fallbackAnyDraft;
  }

  return { problem: fallbackProblem, draft: null };
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
 * Map profile ID to bandit arm ID for UI display
 * @param profileId - Escalation profile ID
 * @returns Corresponding bandit arm ID
 */
function getArmIdFromProfileId(profileId: string): BanditArmId {
  const mapping: Record<string, BanditArmId> = {
    'fast-escalator': 'aggressive',
    'slow-escalator': 'conservative',
    'adaptive-escalator': 'adaptive',
    'explanation-first': 'explanation-first'
  };
  return mapping[profileId] || 'adaptive';
}

/**
 * Analyze learner interaction history for diagnostic strategy
 * Calculates persistence score and recovery rate based on past behavior
 * @param interactions - Learner's interaction history
 * @returns Diagnostic results for profile assignment
 */
function analyzeLearnerHistory(interactions: InteractionEvent[]) {
  const executions = interactions.filter(i => i.eventType === 'execution');
  const errors = interactions.filter(i => i.eventType === 'error');
  const hintRequests = interactions.filter(i => i.eventType === 'guidance_request');
  const explanations = interactions.filter(i => i.eventType === 'explanation_view');
  
  const totalAttempts = executions.length + errors.length;
  const successfulAttempts = executions.filter(e => e.successful).length;
  
  // Calculate persistence score: ratio of successful attempts to total attempts
  const persistenceScore = totalAttempts > 0 ? successfulAttempts / totalAttempts : 0.5;
  
  // Calculate recovery rate: inverse of error rate
  const errorRate = totalAttempts > 0 ? errors.length / totalAttempts : 0;
  const recoveryRate = 1 - errorRate;
  
  // Calculate hint dependency rate
  const hintDependencyRate = totalAttempts > 0 ? hintRequests.length / totalAttempts : 0;
  
  return {
    persistenceScore: Math.max(0, Math.min(1, persistenceScore)),
    recoveryRate: Math.max(0, Math.min(1, recoveryRate)),
    errorRate,
    hintDependencyRate,
    totalAttempts
  };
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
  const { role, isStudent, isInstructor, profile, isLoading: isRoleLoading } = useUserRole();
  const { isHydrating } = useAuth();
  const cachedProfileId = storage.getUserProfile()?.id;
  // Use actual user profile ID for data isolation (aligned with TextbookPage)
  const learnerId = profile?.id || cachedProfileId || (AUTH_BACKEND_CONFIGURED ? '' : 'learner-1');
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
  const [sessionSyncStatus, setSessionSyncStatus] = useState<'checking' | 'confirmed' | 'pending' | 'failed'>('checking');
  const [sessionSyncError, setSessionSyncError] = useState<string | undefined>();
  const [isGeneratingUnit, setIsGeneratingUnit] = useState(false);
  const [generationError, setGenerationError] = useState<string | undefined>();
  const [latestGeneratedUnit, setLatestGeneratedUnit] = useState<InstructionalUnit | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [analysisStatus, setAnalysisStatus] = useState<{
    isRunning: boolean;
    lastResult?: AnalysisResult;
  }>({ isRunning: false });
  
  // Reinforcement prompt state (Component 10: Knowledge Consolidation)
  const [activeReinforcement, setActiveReinforcement] = useState<ActivePrompt | null>(null);
  const [reinforcementPromptNumber, setReinforcementPromptNumber] = useState(1);
  const [reinforcementTotalPrompts] = useState(3);
  
  // Auto-creation notification state
  const [autoCreationNotifications, setAutoCreationNotifications] = useState<Array<{
    id: string;
    message: string;
    unitId: string;
    timestamp: number;
  }>>([]);
  
  // Week 5: Profile indicator state
  const [currentProfileId, setCurrentProfileId] = useState<BanditArmId>('adaptive');
  const [currentEscalationProfile, setCurrentEscalationProfile] = useState<EscalationProfile | null>(null);
  const isDev = import.meta.env.DEV;
  const textbookCorpusMode = useMemo(() => getTextbookCorpusMode(), []);
  
  // Week 5: HDI tracking state (unified 5-component calculator)
  const [currentHDI, setCurrentHDI] = useState<number>(0);
  const [hdiLevel, setHdiLevel] = useState<HDILevel>('low');
  const [hdiComponents, setHdiComponents] = useState<HDIComponents | null>(null);
  const [hdiTrend, setHdiTrend] = useState<HDITrend>('stable');
  const [showDependencyWarning, setShowDependencyWarning] = useState(false);
  const [hdiRefreshKey, setHdiRefreshKey] = useState(0);
  const [solvedRefreshKey, setSolvedRefreshKey] = useState(0);
  const [hydratedSolvedIds, setHydratedSolvedIds] = useState<Set<string>>(new Set());
  const dependencyWarningShownRef = useRef(false);
  const lastHintRequestTimeRef = useRef<number>(0);
  
  // Knowledge-Structure Adaptive Features State
  const [learningPath, setLearningPath] = useState<LearningPathRecommendation | null>(null);
  const [prerequisiteWarnings, setPrerequisiteWarnings] = useState<string[]>([]);
  const [conceptProgress, setConceptProgress] = useState<Map<string, PathProgress>>(new Map());
  const [masteryStats, setMasteryStats] = useState<{
    mastered: number;
    practicing: number;
    exposed: number;
    none: number;
  } | null>(null);
  const [reflectionScore, setReflectionScore] = useState<{
    rqs: number;
    feedback: string[];
  } | null>(null);
  
  // Preview Mode: Check if instructor is previewing student view
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  useEffect(() => {
    const previewMode = localStorage.getItem('sql-adapt-preview-mode') === 'true';
    setIsPreviewMode(previewMode);
  }, []);

  useEffect(() => {
    console.info('[corpus] LearningInterface corpus_mode=%s', textbookCorpusMode);
  }, [textbookCorpusMode]);
  
  // State refresh trigger for debug profile/strategy cross-tab sync
  const [debugRefreshKey, setDebugRefreshKey] = useState(0);
  
  // Subscribe to cross-tab sync for preview mode and debug state changes
  useEffect(() => {
    const unsubscribe = subscribeToSync((key, value) => {
      if (key === 'sql-adapt-preview-mode') {
        // Update preview mode state when changed in another tab
        setIsPreviewMode(value === 'true');
      } else if (key === 'sql-adapt-debug-profile' || key === 'sql-adapt-debug-strategy') {
        // Trigger re-calculation of escalation profile when debug settings change
        setDebugRefreshKey(prev => prev + 1);
      }
    });
    return unsubscribe;
  }, []);
  
  // Function to exit preview mode
  const exitPreviewMode = () => {
    try {
      clearAllDebugSettingsWithSync();
    } catch (error) {
      console.error('[Preview] Failed to clear preview mode:', error);
    }
    window.location.href = '/instructor-dashboard';
  };
  
  // Week 5: Progress hint state
  const [progressHint, setProgressHint] = useState<string | null>(null);
  const progressHintShownRef = useRef(false);
  const interactionCountRef = useRef(0);
  
  // Week 6: Session configuration for experimental conditions
  const [sessionConfig, setSessionConfig] = useState<SessionConfig | null>(null);
  
  // Paper Data Contract: Debounced code change telemetry
  // Stabilize callback to prevent hook recreation on every render
  const handleSaveCodeChangeInteraction = useCallback((event: InteractionEvent) => {
    storage.saveInteraction(event);
    setInteractions((prev) => [...prev, event]);
  }, []);

  const {
    handleCodeChange: debouncedHandleCodeChange,
    flush: flushCodeChangeTelemetry,
    reset: resetCodeChangeTelemetry,
  } = useDebouncedCodeChange({
    learnerId,
    sessionId: sessionId || undefined,
    problemId: currentProblem.id,
    conditionId: sessionConfig?.conditionId,
    debounceMs: 2000,
    maxWaitMs: 5000,
    onSaveInteraction: handleSaveCodeChangeInteraction,
  });
  
  const timerRef = useRef<number | null>(null);
  const stopAnalysisRef = useRef<(() => void) | null>(null);
  const startTimeRef = useRef(startTime);
  const isTimerPausedRef = useRef(isTimerPaused);
  const elapsedTimeRef = useRef(elapsedTime);
  // Track notification timeout IDs for cleanup on unmount
  const notificationTimeoutsRef = useRef<Set<number>>(new Set());
  // Track if profile assignment has been logged for this session
  const profileAssignedLoggedRef = useRef<boolean>(false);
  const currentProblemIdRef = useRef(currentProblem.id);
  const finalizedSessionIdsRef = useRef<Set<string>>(new Set());
  const sessionConditionIdRef = useRef<string | undefined>(sessionConfig?.conditionId);
  
  // Screen reader announcements for accessibility
  const { announcement: hintAnnouncement, announce: announceHint } = useScreenReaderAnnouncer();
  const [notificationAnnouncement, setNotificationAnnouncement] = useState('');
  const persistedPracticeUiState = useMemo(() => {
    if (!learnerId) return null;
    const params = new URLSearchParams(location.search);
    const queryHasExplicitContext = params.has('problemId') || params.has('conceptId');
    if (queryHasExplicitContext) return null;

    return getUiState<PracticePageUiState>('practice', {
      role: isInstructor ? 'instructor' : 'student',
      actorId: learnerId,
    });
  }, [learnerId, isInstructor, location.search]);

  // Week 5: Get current escalation profile based on assignment strategy
  // Week 6: Modified to respect sessionConfig experimental settings
  useEffect(() => {
    if (!learnerId) return;
    
    // Week 6: Respect sessionConfig experimental settings
    const debugProfileOverride = safeGetProfileOverride();
    
    // If staticHintMode is enabled, bypass bandit/adaptive selection
    if (sessionConfig?.staticHintMode) {
      const staticProfile = assignProfile({ learnerId }, 'static');
      setCurrentProfileId(getArmIdFromProfileId(staticProfile.id));
      setCurrentEscalationProfile(staticProfile);
      if (!profileAssignedLoggedRef.current) {
        profileAssignedLoggedRef.current = true;
        storage.logProfileAssigned(
          learnerId,
          staticProfile.id,
          'static',
          currentProblem.id,
          'experimental_static_hint_mode'
        );
      }
      return;
    }
    
    // If adaptiveLadderDisabled is true, use diagnostic (deterministic) assignment
    if (sessionConfig?.adaptiveLadderDisabled) {
      const interactions = storage.getInteractionsByLearner(learnerId);
      const diagnosticResults = analyzeLearnerHistory(interactions);
      const diagnosticProfile = assignProfile({ learnerId, diagnosticResults }, 'diagnostic');
      setCurrentProfileId(getArmIdFromProfileId(diagnosticProfile.id));
      setCurrentEscalationProfile(diagnosticProfile);
      if (!profileAssignedLoggedRef.current) {
        profileAssignedLoggedRef.current = true;
        storage.logProfileAssigned(
          learnerId,
          diagnosticProfile.id,
          'diagnostic',
          currentProblem.id,
          'experimental_adaptive_disabled'
        );
      }
      return;
    }
    
    const assignmentStrategy = safeGetStrategy();
    
    let effectiveProfile: EscalationProfile;
    let effectiveArmId: BanditArmId;
    let selectionReason: string;
    
    if (debugProfileOverride) {
      // Debug override takes precedence over strategy
      const profile = getProfileById(debugProfileOverride);
      effectiveProfile = profile || BANDIT_ARM_PROFILES.adaptive;
      effectiveArmId = PROFILE_TO_ARM_ID[debugProfileOverride] || 'adaptive';
      selectionReason = 'debug_override';
    } else {
      switch (assignmentStrategy) {
        case 'static': {
          // Use hash-based deterministic assignment
          effectiveProfile = assignProfile({ learnerId }, 'static');
          effectiveArmId = getArmIdFromProfileId(effectiveProfile.id);
          selectionReason = 'static_assignment';
          break;
        }
        
        case 'diagnostic': {
          // Analyze learner's interaction history
          const interactions = storage.getInteractionsByLearner(learnerId);
          const diagnosticResults = analyzeLearnerHistory(interactions);
          effectiveProfile = assignProfile({ learnerId, diagnosticResults }, 'diagnostic');
          effectiveArmId = getArmIdFromProfileId(effectiveProfile.id);
          selectionReason = 'diagnostic_assessment';
          break;
        }
        
        case 'bandit':
        default: {
          // Use Thompson sampling bandit selection
          const banditResult = banditManager.selectProfileForLearner(learnerId);
          effectiveProfile = banditResult.profile;
          effectiveArmId = banditResult.armId;
          selectionReason = 'bandit_selection';
          
          // Log bandit arm selection event
          storage.logBanditArmSelected({
            learnerId,
            problemId: currentProblem.id,
            armId: effectiveArmId,
            selectionMethod: 'thompson_sampling',
            armStatsAtSelection: banditManager.hasBandit(learnerId) 
              ? banditManager.getLearnerStats(learnerId).reduce((acc, stat) => {
                  acc[stat.armId] = { mean: stat.meanReward, pulls: stat.pullCount };
                  return acc;
                }, {} as Record<string, { mean: number; pulls: number }>)
              : undefined,
            sessionId
          });
          break;
        }
      }
    }
    
    // Set the arm ID for UI display
    setCurrentProfileId(effectiveArmId);
    
    // Set the escalation profile for hint system thresholds
    setCurrentEscalationProfile(effectiveProfile);

    // Log profile assignment event (only once per session)
    if (!profileAssignedLoggedRef.current) {
      profileAssignedLoggedRef.current = true;
      storage.logProfileAssigned(
        learnerId,
        effectiveProfile.id,
        debugProfileOverride ? 'static' : assignmentStrategy,
        currentProblem.id,
        selectionReason
      );
    }
  }, [learnerId, currentProblem.id, sessionId, debugRefreshKey, sessionConfig]);

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

  // Week 5: Calculate HDI using unified 5-component calculator
  useEffect(() => {
    if (!learnerId) return;
    
    // Get all interactions for this learner (not just session-scoped)
    const allLearnerInteractions = storage.getInteractionsByLearner(learnerId);
    
    // Calculate full HDI with all 5 components
    const result = calculateHDI(allLearnerInteractions);
    
    // Determine trend based on previous value
    if (result.hdi > currentHDI + 0.05) {
      setHdiTrend('increasing');
    } else if (result.hdi < currentHDI - 0.05) {
      setHdiTrend('decreasing');
    } else {
      setHdiTrend('stable');
    }
    
    setCurrentHDI(result.hdi);
    setHdiLevel(result.level);
    setHdiComponents(result.components);
    
    // Dispatch custom event for other components
    const hdiEvent = new CustomEvent('hdi_calculated', {
      detail: {
        hdi: result.hdi,
        hdiLevel: result.level,
        components: result.components,
        trend: result.hdi > currentHDI + 0.05 ? 'increasing' : 
               result.hdi < currentHDI - 0.05 ? 'decreasing' : 'stable',
        learnerId
      }
    });
    window.dispatchEvent(hdiEvent);
  }, [learnerId, interactions, hdiRefreshKey, currentHDI]);

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
    if (isHydrating || (AUTH_BACKEND_CONFIGURED && (isRoleLoading || !learnerId))) {
      return undefined;
    }
    const timer = window.setTimeout(() => setIsLoading(false), 500);
    return () => {
      window.clearTimeout(timer);
      // Clear all notification timeouts on unmount
      notificationTimeoutsRef.current.forEach(id => window.clearTimeout(id));
      notificationTimeoutsRef.current.clear();
    };
  }, [isHydrating, isRoleLoading, learnerId]);

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

  useEffect(() => {
    if (!persistedPracticeUiState) return;

    if (!AUTH_BACKEND_CONFIGURED && persistedPracticeUiState.currentProblemId) {
      const persistedProblem = findProblemById(persistedPracticeUiState.currentProblemId, sqlProblems);
      if (persistedProblem) {
        setCurrentProblem(persistedProblem);
      }
    }

    if (persistedPracticeUiState.activeConceptId) {
      setActiveConceptId(persistedPracticeUiState.activeConceptId);
      void getConcept(persistedPracticeUiState.activeConceptId).then((concept) => {
        if (concept) setActiveConceptTitle(concept.title);
      });
    } else if (persistedPracticeUiState.activeConceptTitle === null) {
      setActiveConceptTitle(null);
    }

    if (persistedPracticeUiState.subtypeOverride) {
      setSubtypeOverride(persistedPracticeUiState.subtypeOverride);
    }
  }, [persistedPracticeUiState]);

  useEffect(() => {
    if (!learnerId) return;
    setUiState<PracticePageUiState>(
      'practice',
      { role: isInstructor ? 'instructor' : 'student', actorId: learnerId },
      {
        currentProblemId: currentProblem.id,
        activeConceptId,
        activeConceptTitle,
        subtypeOverride,
      }
    );
  }, [learnerId, isInstructor, currentProblem.id, activeConceptId, activeConceptTitle, subtypeOverride]);

  // Calculate total time across sessions
  useEffect(() => {
    if (!learnerId) {
      setTotalTimeAcrossSessions(0);
      return;
    }
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

  useEffect(() => {
    currentProblemIdRef.current = currentProblem.id;
  }, [currentProblem.id]);

  useEffect(() => {
    sessionConditionIdRef.current = sessionConfig?.conditionId;
  }, [sessionConfig?.conditionId]);

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
      // Don't trigger if a modal/dialog is open
      const isModalOpen = document.querySelector('[role="dialog"]') !== null;
      if (isModalOpen) return;

      // Ctrl+Enter OR Cmd+Enter (Mac) to run query
      // Allow from ANYWHERE including the Monaco editor textarea
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        const runButton = document.querySelector('[data-testid="run-query-btn"]') as HTMLButtonElement;
        if (runButton && !runButton.disabled) {
          runButton.click();
        }
        // If button not found or disabled, shortcut is a no-op (SQL engine still loading)
        return;
      }

      // Other shortcuts — skip if in input/textarea (editor handles its own keys)
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Effect: Session configuration assignment/loading (Week 6 + Workstream 3/6 redesign)
  // Async loading with backend-first priority, sessionStorage fallback, then assignment
  useEffect(() => {
    if (!learnerId) return;
    
    let cancelled = false;
    
    const loadConfig = async () => {
      // Use async loader: backend -> sessionStorage -> assign
      const result = await loadSessionConfigAsync(learnerId);
      
      if (cancelled) return;
      
      const config = result.config;
      
      // Log condition assignment event for new assignments (canonical RESEARCH-4 event type)
      if (result.isNewAssignment) {
        const configEvent: InteractionEvent = {
          id: createEventId('event', 'session-config'),
          sessionId: config.sessionId,
          learnerId,
          timestamp: Date.now(),
          eventType: 'condition_assigned',
          problemId: currentProblem.id,
          conditionId: config.conditionId,
          profileId: config.escalationPolicy,
          strategyAssigned: config.conditionId,
          assignmentStrategy: config.staticHintMode ? 'static' : (config.adaptiveLadderDisabled ? 'diagnostic' : 'bandit'),
          metadata: {
            sessionConfigVersion: getConditionAssignmentVersion(),
            sessionConfigSource: result.source,
            textbookDisabled: config.textbookDisabled,
            adaptiveLadderDisabled: config.adaptiveLadderDisabled,
            immediateExplanationMode: config.immediateExplanationMode,
            staticHintMode: config.staticHintMode,
          }
        };
        storage.saveInteraction(configEvent);
      }
      
      // Log recovery from sessionStorage (for debugging)
      if (result.source === 'sessionStorage') {
        console.info('[SessionConfig] Recovered from sessionStorage:', {
          learnerId,
          conditionId: config.conditionId,
        });
      }

      if (config.sessionId?.trim()) {
        storage.setActiveSessionId(config.sessionId.trim());
      }

      setSessionConfig(config);
      
      // Override escalation profile if config specifies a policy
      if (config.escalationPolicy && config.escalationPolicy !== 'adaptive') {
        const policyProfile = getProfileById(config.escalationPolicy === 'explanation_first' 
          ? 'explanation-first' 
          : config.escalationPolicy === 'aggressive' 
            ? 'fast-escalator'
            : config.escalationPolicy === 'conservative'
              ? 'slow-escalator'
              : 'adaptive-escalator'
        );
        if (policyProfile) {
          setCurrentEscalationProfile(policyProfile);
        }
      }
    };
    
    void loadConfig();
    
    return () => {
      cancelled = true;
    };
  }, [learnerId, currentProblem.id]);

  // Effect 1: Session initialization - handles profile, session ID, and state reset.
  // Runs when learner/auth readiness changes (not on problem/session-config churn)
  // to avoid clobbering hydrated drafts with defaults.
  useEffect(() => {
    let cancelled = false;
    if (!learnerId || isHydrating || (AUTH_BACKEND_CONFIGURED && isRoleLoading)) {
      return () => {
        cancelled = true;
      };
    }
    const isMeaningfulDraft = (draft: string | null | undefined): draft is string =>
      typeof draft === 'string' &&
      draft.trim().length > 0 &&
      draft.trim() !== DEFAULT_SQL_EDITOR_CODE.trim();
    const draftLookup: PracticeDraftLookup = {
      getPracticeDraft: (candidateSessionId, problemId) =>
        storage.getPracticeDraft(learnerId, candidateSessionId, problemId),
      findAnyPracticeDraft: (problemId) => storage.findAnyPracticeDraft(learnerId, problemId),
    };

    const initializeSessionState = async () => {
      // Initialize learner profile if doesn't exist
      let profile = storage.getProfile(learnerId);
      if (!profile) {
        profile = storage.createDefaultProfile(learnerId, 'adaptive-medium');
      }

      // Prefer active session from storage (hydrated from backend in account mode).
      // Fall back to sessionConfig only when storage still has its sentinel value.
      const storageSessionId = storage.getActiveSessionId();
      const activeSessionId =
        storageSessionId === 'session-unknown' && sessionConfig?.sessionId
          ? sessionConfig.sessionId
          : storageSessionId;

      // Validate session belongs to current learner using exact pattern match
      // for locally-generated IDs, while accepting backend-hydrated legacy IDs.
      const expectedPrefix = `session-${learnerId}-`;
      const belongsToLearner = (() => {
        if (!activeSessionId) return false;
        if (activeSessionId === 'session-unknown') return false;
        if (activeSessionId.startsWith('session-')) {
          if (AUTH_BACKEND_CONFIGURED) {
            return true;
          }
          return activeSessionId.startsWith(expectedPrefix) &&
            activeSessionId.length > expectedPrefix.length;
        }
        // Backend sessions may use non-prefixed IDs (for example problem IDs).
        // Treat them as valid so we don't create a fresh empty session that
        // overrides resumable state in Neon.
        return true;
      })();

      let resolvedSessionId = belongsToLearner
        ? activeSessionId
        : storage.startSession(learnerId);

      let resolvedProblem = resolvePracticeProblemFromSources({
        problems: sqlProblems,
        fallbackProblem: currentProblem,
        persistedProblemId: AUTH_BACKEND_CONFIGURED ? undefined : persistedPracticeUiState?.currentProblemId,
        preferBackendProblem: false,
      });
      let resolvedDraft: string | null = null;

      if (AUTH_BACKEND_CONFIGURED) {
        const hydrated = await storage.hydrateLearner(learnerId, { force: true });
        if (!cancelled && hydrated) {
          const hydratedSessionId = storage.getActiveSessionId();
          if (hydratedSessionId && hydratedSessionId !== 'session-unknown') {
            resolvedSessionId = hydratedSessionId;
          }
          // Force refresh of solved progress from newly hydrated storage
          setSolvedRefreshKey(prev => prev + 1);
          // Bridge hydration result through React state to avoid race condition
          const freshProfile = storage.getProfile(learnerId);
          if (freshProfile?.solvedProblemIds) {
            setHydratedSolvedIds(new Set(freshProfile.solvedProblemIds));
          }
        }

        const backendSessionSnapshot = await storage.getBackendSessionSnapshot(learnerId);
        if (!cancelled) {
          const snapshotSessionId = backendSessionSnapshot?.sessionId?.trim();
          if (snapshotSessionId) {
            resolvedSessionId = snapshotSessionId;
            storage.setActiveSessionId(snapshotSessionId);
          }

          const snapshotProblemId = backendSessionSnapshot?.currentProblemId?.trim();
          resolvedProblem = resolvePracticeProblemFromSources({
            problems: sqlProblems,
            fallbackProblem: currentProblem,
            persistedProblemId: persistedPracticeUiState?.currentProblemId,
            backendProblemId: snapshotProblemId,
            preferBackendProblem: true,
          });

          if (backendSessionSnapshot && isMeaningfulDraft(backendSessionSnapshot.currentCode)) {
            resolvedDraft = backendSessionSnapshot.currentCode;
            storage.savePracticeDraft(
              learnerId,
              resolvedSessionId,
              resolvedProblem.id,
              backendSessionSnapshot.currentCode,
            );
          } else if (snapshotProblemId) {
            resolvedDraft = resolvePracticeDraftState({
              lookup: draftLookup,
              sessionId: resolvedSessionId,
              fallbackProblem: resolvedProblem,
              problems: sqlProblems,
              isMeaningfulDraft,
              lockProblemId: snapshotProblemId,
            }).draft;
          } else {
            const localFallbackState = resolvePracticeDraftState({
              lookup: draftLookup,
              sessionId: resolvedSessionId,
              fallbackProblem: resolvedProblem,
              problems: sqlProblems,
              isMeaningfulDraft,
            });
            resolvedProblem = localFallbackState.problem;
            resolvedDraft = localFallbackState.draft;
          }
        }
      } else {
        const localState = resolvePracticeDraftState({
          lookup: draftLookup,
          sessionId: resolvedSessionId,
          fallbackProblem: resolvedProblem,
          problems: sqlProblems,
          isMeaningfulDraft,
        });
        resolvedProblem = localState.problem;
        resolvedDraft = localState.draft;
      }

      if (cancelled) return;

      if (resolvedSessionId && resolvedSessionId !== 'session-unknown') {
        storage.setActiveSessionId(resolvedSessionId);
      }
      setSessionId(resolvedSessionId);
      if (currentProblem.id !== resolvedProblem.id) {
        setCurrentProblem(resolvedProblem);
      }
      setSqlDraft(resolvedDraft ?? DEFAULT_SQL_EDITOR_CODE);
      setInteractions(
        storage
          .getInteractionsByLearner(learnerId)
          .filter((interaction) => interaction.sessionId === resolvedSessionId)
      );
      setLastError(undefined);
      setLastErrorEventId(undefined);
      setEscalationTriggered(false);
      setNotesActionMessage(undefined);
      setGenerationError(undefined);
      setLatestGeneratedUnit(null);
      setStartTime(Date.now());
      setElapsedTime(0);
    };

    void initializeSessionState();

    return () => {
      cancelled = true;
    };
  }, [learnerId, isHydrating, isRoleLoading, persistedPracticeUiState]);

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

  // Effect 3: Reinforcement prompt checking - periodic check for due prompts
  useEffect(() => {
    if (!learnerId || !sessionId) return;

    // Check immediately on mount/session change
    const checkForPrompts = () => {
      if (activeReinforcement) return; // Don't show new prompt if one is active
      
      const duePrompts = reinforcementManager.getDuePrompts(learnerId);
      if (duePrompts.length > 0) {
        const prompt = duePrompts[0];
        setActiveReinforcement(prompt);
        setReinforcementPromptNumber(1); // Could calculate based on schedule
        
        // Log that prompt was shown
        reinforcementManager.markPromptShown(prompt.scheduleId, prompt.promptId, learnerId);
      }
    };

    // Initial check after a short delay (let the page load first)
    const initialTimeout = window.setTimeout(checkForPrompts, 5000);

    // Set up periodic checking every 30 seconds
    const checkInterval = window.setInterval(checkForPrompts, 30000);

    return () => {
      window.clearTimeout(initialTimeout);
      window.clearInterval(checkInterval);
    };
  }, [learnerId, sessionId, activeReinforcement]);

  // Learner switching is now handled via "Switch User" in the top navigation
  // The learnerId state remains for data tracking purposes

  // Effect 4: Knowledge-Structure Monitoring - initialize and update learning path
  useEffect(() => {
    if (!learnerId) return;
    
    // Build initial learning path
    const path = buildLearningPath(learnerId, 'prerequisite_first');
    setLearningPath(path);
    
    // Check prerequisites for current problem
    const readiness = checkProblemReadiness(currentProblem.concepts, storage.getProfile(learnerId)!);
    setPrerequisiteWarnings(readiness.warnings);
    
    // Log if there are violations
    if (readiness.violations.length > 0) {
      console.log('[Knowledge] Prerequisite violations detected:', readiness.violations);
    }
  }, [learnerId, currentProblem.id]);
  
  // Effect 5: Mastery tracking - update mastery on successful submissions
  useEffect(() => {
    if (!learnerId || !sessionId) return;
    
    // Subscribe to successful executions
    const handleExecution = (event: Event) => {
      const customEvent = event as CustomEvent<{
        problemId: string;
        successful: boolean;
        conceptIds: string[];
      }>;
      
      if (customEvent.detail.successful) {
        // Update mastery
        const updates = updateMasteryFromInteraction({
          id: createEventId('mastery', 'update'),
          learnerId,
          timestamp: Date.now(),
          eventType: 'execution',
          problemId: customEvent.detail.problemId,
          conceptIds: customEvent.detail.conceptIds,
          successful: true
        } as InteractionEvent, learnerId);
        
        if (updates.length > 0) {
          // Propagate mastery to dependent concepts
          propagateMastery(learnerId);
          
          // Update learning path after success
          const updatedPath = updatePathAfterSuccess(learnerId, customEvent.detail.conceptIds[0]);
          setLearningPath(updatedPath);
        }
      }
    };
    
    window.addEventListener('sql-execution-result', handleExecution);
    return () => window.removeEventListener('sql-execution-result', handleExecution);
  }, [learnerId, sessionId]);

  const instructorSubtypeOverride = isInstructor && subtypeOverride !== 'auto'
    ? canonicalizeSqlEngageSubtype(subtypeOverride)
    : undefined;

  // Paper Data Contract: Debounced code_change telemetry
  // Immediate draft persistence for UX, debounced telemetry for research
  // Stabilized with useCallback to prevent unnecessary re-renders and debounce resets
  const handleEditorCodeChange = useCallback((code: string) => {
    setSqlDraft(code);
    if (sessionId) {
      storage.savePracticeDraft(learnerId, sessionId, currentProblem.id, code);
    }
    // Debounced telemetry - not immediate
    debouncedHandleCodeChange(code);
  }, [sessionId, learnerId, currentProblem.id, debouncedHandleCodeChange]);
  
  // Flush code change telemetry before executing query
  const flushTelemetryBeforeExecute = () => {
    flushCodeChangeTelemetry();
  };

  const handleEditorReset = () => {
    setSqlDraft(DEFAULT_SQL_EDITOR_CODE);
    if (sessionId) {
      storage.clearPracticeDraft(learnerId, sessionId, currentProblem.id);
    }
  };

  // RESEARCH-4: Track which concept_view events have been emitted to prevent spam
  const emittedConceptViewsRef = useRef<Set<string>>(new Set());

  // Reset dedupe when session truly changes (new learner or new session)
  useEffect(() => {
    emittedConceptViewsRef.current.clear();
  }, [learnerId, sessionId]);

  const handleProblemChange = useCallback((id: string) => {
    const problem = sqlProblems.find(p => p.id === id);
    if (!problem) {
      // Problem not found - silently return
      return;
    }
    setCurrentProblem(problem);

    // Paper Data Contract: Flush any pending code change telemetry before switching
    flushCodeChangeTelemetry();
    
    // Reset code change telemetry state for new problem
    resetCodeChangeTelemetry();
    
    // Note: We no longer emit code_change for problem switching
    // This was semantically incorrect and caused telemetry noise
    
    const restoredDraft = sessionId
      ? (storage.getPracticeDraft(learnerId, sessionId, problem.id)
         ?? storage.findAnyPracticeDraft(learnerId, problem.id))
      : storage.findAnyPracticeDraft(learnerId, problem.id);
    setSqlDraft(restoredDraft ?? DEFAULT_SQL_EDITOR_CODE);
    setStartTime(Date.now());
    setElapsedTime(0);
    setLastError(undefined);
    setLastErrorEventId(undefined);
    setEscalationTriggered(false);
    setNotesActionMessage(undefined);
    setGenerationError(undefined);
    setLatestGeneratedUnit(null);

    // Refresh solved count from storage when switching problems
    setSolvedRefreshKey(prev => prev + 1);
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

  const formatTextbookSaveMessage = (
    title: string,
    action: 'created' | 'updated',
    status: { backendConfirmed: boolean; pendingSync: boolean; error?: string },
    createdLabel: string,
    updatedLabel: string,
  ): string => {
    if (status.backendConfirmed) {
      return action === 'created' ? createdLabel : updatedLabel;
    }
    if (status.pendingSync) {
      return `Saved "${title}" locally — syncing to backend now.`;
    }
    return status.error ?? `Failed to sync "${title}" to backend.`;
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

    const textbookWrite = await storage.saveTextbookUnitCritical(learnerId, generation.unit);
    const textbookResult = textbookWrite.result;
    if (!textbookWrite.status.backendConfirmed && !textbookWrite.status.pendingSync) {
      throw new Error(textbookWrite.status.error ?? 'Failed to persist textbook unit.');
    }
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
      },
      conditionId: sessionConfig?.conditionId
    };
    storage.saveInteraction(textbookEvent);
    setInteractions((previousInteractions) => [...previousInteractions, textbookEvent]);

    return { generation, textbookResult, textbookWriteStatus: textbookWrite.status };
  };

  const handleExecute = async (query: string, result: QueryResult, isCorrect?: boolean) => {
    // Paper Data Contract: Flush pending code change telemetry before execution
    flushCodeChangeTelemetry();
    
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
      conceptIds: result.success ? [...currentProblem.concepts] : undefined,
      conditionId: sessionConfig?.conditionId
    };

    storage.saveInteraction(event);
    setInteractions((previousInteractions) => [...previousInteractions, event]);

    if (!result.success && resolvedSubtype) {
      setLastError(resolvedSubtype);
      setLastErrorEventId(event.id);
      setNotesActionMessage(undefined);
      setGenerationError(undefined);
      
      // Knowledge-Structure Layer: Check for prerequisite violations on error
      const learnerProfile = storage.getProfile(learnerId);
      if (learnerProfile) {
        const violation = detectPrerequisiteViolation(event, learnerProfile);
        if (violation) {
          logPrerequisiteViolation(violation);
          // Show warning toast for high-severity violations
          if (violation.severity === 'high') {
            setProgressHint(`You might be missing prerequisites: ${violation.suggestedRemediation.slice(0, 2).join(', ')}`);
          }
        }
      }
    }

    if (result.success) {
      setLastError(undefined);
      setLastErrorEventId(undefined);
      // Keep escalationTriggered=true so Save to Notes stays visible after solving
      setNotesActionMessage(undefined);
      setGenerationError(undefined);
      setLatestGeneratedUnit(null);
      
      // Knowledge-Structure: Update mastery on success
      const masteryUpdates = updateMasteryFromInteraction(event, learnerId);
      if (masteryUpdates.length > 0) {
        // Propagate mastery through the graph
        propagateMastery(learnerId);
        
        // Update learning path
        const updatedPath = updatePathAfterSuccess(learnerId, currentProblem.concepts[0]);
        setLearningPath(updatedPath);
      }
      
      // Week 5: Record bandit outcome when problem is solved successfully
      // Only record when using bandit strategy (not static or diagnostic)
      const debugProfileOverride = safeGetProfileOverride();
      const assignmentStrategy = safeGetStrategy();
      if (!debugProfileOverride && assignmentStrategy === 'bandit' && learnerId) {
        try {
          // Calculate reward components
          const timeSpent = Date.now() - startTime;
          const sessionInteractions = storage
            .getInteractionsByLearner(learnerId)
            .filter((i) => i.sessionId === sessionId && i.problemId === currentProblem.id);
          const errorCount = sessionInteractions.filter((i) => i.eventType === 'error').length;
          const usedExplanation = sessionInteractions.some((i) => i.eventType === 'explanation_view');
          
          banditManager.recordOutcome(learnerId, currentProfileId, {
            solved: true,
            usedExplanation,
            errorCount,
            baselineErrors: 3, // Expected baseline
            timeSpentMs: timeSpent,
            medianTimeMs: 300000, // 5 minutes as baseline
            hdiScore: currentHDI,
          });

          // Log reward observed event for research analysis
          const rewardComponents = {
            independentSuccess: usedExplanation ? 0 : 1,
            errorReduction: Math.max(0, 1 - errorCount / 3),
            delayedRetention: 0,
            dependencyPenalty: -currentHDI,
            timeEfficiency: Math.min(1, 300000 / Math.max(timeSpent, 1000)),
          };
          const totalReward = Object.values(rewardComponents).reduce((a, b) => a + b, 0) / 5;

          storage.logBanditRewardObserved(
            learnerId,
            currentProfileId,
            Math.max(0, Math.min(1, totalReward)),
            rewardComponents
          );

          // Log bandit updated event with new alpha/beta values
          const armStats = banditManager.getLearnerStats(learnerId).find(s => s.armId === currentProfileId);
          if (armStats) {
            storage.logBanditUpdated(
              learnerId,
              currentProfileId,
              armStats.pullCount + 1, // Approximate alpha
              Math.max(1, armStats.pullCount * 0.5), // Approximate beta
              armStats.pullCount
            );
          }

          // Bandit outcome recorded
        } catch (error) {
          console.error('[Bandit] Failed to record outcome:', error);
        }
      }

      // Trigger refresh of solved count from profile
      setSolvedRefreshKey(prev => prev + 1);

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
        const { textbookResult, textbookWriteStatus } = await persistGeneratedUnit(
          'notebook_unit.v1',
          sourceIds,
          resolvedSubtype,
          decision.ruleFired || 'aggregation-threshold-met'
        );
        setNotesActionMessage(formatTextbookSaveMessage(
          textbookResult.unit.title,
          textbookResult.action,
          textbookWriteStatus,
          `Saved "${textbookResult.unit.title}" to My Textbook — review it anytime!`,
          `Updated "${textbookResult.unit.title}" in My Textbook.`,
        ));
      } catch (error) {
        setGenerationError((error as Error).message);
      } finally {
        setIsGeneratingUnit(false);
      }
    }
  };

  const handleEscalate = (sourceInteractionIds?: string[], providedSubtype?: string) => {
    setEscalationTriggered(true);

    // Log escalation triggered event for research analysis
    if (learnerId && currentProblem?.id) {
      const problemInteractions = storage
        .getInteractionsByLearner(learnerId)
        .filter((i) => i.sessionId === sessionId && i.problemId === currentProblem.id);
      const errorCount = problemInteractions.filter((i) => i.eventType === 'error').length;

      // RESEARCH-4: compute time_to_escalation = ms from first interaction to now
      const firstTs = problemInteractions.length > 0
        ? Math.min(...problemInteractions.map((i) => i.timestamp))
        : Date.now();
      const timeToEscalationMs = Date.now() - firstTs;

      storage.logEscalationTriggered(
        learnerId,
        currentEscalationProfile?.id || 'adaptive-escalator',
        errorCount,
        currentProblem.id,
        'threshold_met',
        timeToEscalationMs
      );
    }

    const sourceIds = sourceInteractionIds && sourceInteractionIds.length > 0
      ? sourceInteractionIds
      : collectNoteEvidenceIds([], { maxInteractions: 8 });
    if (sourceInteractionIds && sourceInteractionIds.length > 0) {
      setLastErrorEventId(sourceInteractionIds[sourceInteractionIds.length - 1]);
    }

    // Use the subtype passed explicitly by HintSystem first, then fall back to
    // inferring from interaction history. This ensures Save to Notes always works
    // even when no SQL error has been submitted yet (e.g. learner clicked Save
    // after only viewing hints).
    let escalationSubtype = providedSubtype || lastError || resolveLatestProblemErrorSubtype();
    
    if (!escalationSubtype) {
      // Fall back to the first concept of the current problem
      // This allows escalation even when no error has occurred
      const problemConcepts = currentProblem.concepts;
      if (problemConcepts && problemConcepts.length > 0) {
        escalationSubtype = problemConcepts[0];
      }
    }
    
    if (!escalationSubtype) {
      // Cannot save — surface a visible error instead of silently doing nothing.
      setGenerationError('Could not save note: no concept context identified. Try submitting a query or requesting a hint first.');
      return;
    }
    if (!lastError) {
      setLastError(escalationSubtype);
    }

    setIsGeneratingUnit(true);
    setGenerationError(undefined);
    void persistGeneratedUnit('explanation.v1', sourceIds, escalationSubtype, 'show-explanation-escalation')
      .then(({ textbookResult, textbookWriteStatus }) => {
        setNotesActionMessage(formatTextbookSaveMessage(
          textbookResult.unit.title,
          textbookResult.action,
          textbookWriteStatus,
          `Saved "${textbookResult.unit.title}" to My Textbook for review`,
          `Updated "${textbookResult.unit.title}" in My Textbook`,
        ));
        // Signal other tabs (e.g. TextbookPage open alongside) to reload units.
        broadcastSync('sql-adapt-textbook', learnerId);
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
    // Try error-based context first, then fall back to problem concepts
    let noteSubtype = lastError || resolveLatestProblemErrorSubtype();

    if (!noteSubtype) {
      // Fall back to the first concept of the current problem
      // This allows saving notes even when no error has occurred
      const problemConcepts = currentProblem.concepts;
      if (problemConcepts && problemConcepts.length > 0) {
        noteSubtype = problemConcepts[0];
      }
    }

    if (!noteSubtype) {
      setGenerationError('Could not save note: no concept context identified. Try submitting a query or requesting a hint first.');
      return;
    }
    if (!lastError) {
      setLastError(noteSubtype);
    }

    const sourceIds = collectNoteEvidenceIds([], { maxInteractions: 12 });
    setIsGeneratingUnit(true);
    setGenerationError(undefined);
    try {
      const { textbookResult, textbookWriteStatus } = await persistGeneratedUnit(
        'notebook_unit.v1',
        sourceIds,
        noteSubtype,
        'manual-add-to-notes'
      );
      setNotesActionMessage(formatTextbookSaveMessage(
        textbookResult.unit.title,
        textbookResult.action,
        textbookWriteStatus,
        `✓ Saved "${textbookResult.unit.title}" — find it in My Textbook`,
        `✓ Updated "${textbookResult.unit.title}" in My Textbook`,
      ));
    } catch (error) {
      setGenerationError((error as Error).message);
    } finally {
      setIsGeneratingUnit(false);
    }
  };

  const buildSessionEndEvent = useCallback((): InteractionEvent | null => {
    if (!learnerId || !sessionId) {
      return null;
    }

    const sessionInteractions = storage
      .getInteractionsByLearner(learnerId)
      .filter((interaction) => interaction.sessionId === sessionId);
    const firstInteractionTimestamp = sessionInteractions.length > 0
      ? Math.min(...sessionInteractions.map((interaction) => interaction.timestamp))
      : startTimeRef.current;
    const totalTime = Math.max(0, Date.now() - firstInteractionTimestamp);
    const problemsAttempted = new Set(
      sessionInteractions
        .filter((interaction) => interaction.eventType === 'execution' || interaction.eventType === 'error')
        .map((interaction) => interaction.problemId)
    ).size;
    const problemsSolved = new Set(
      sessionInteractions
        .filter((interaction) => interaction.eventType === 'execution' && interaction.successful)
        .map((interaction) => interaction.problemId)
    ).size;

    return {
      id: `session-end-${sessionId}`,
      learnerId,
      sessionId,
      timestamp: Date.now(),
      eventType: 'session_end',
      problemId: currentProblemIdRef.current || 'session-summary',
      totalTime,
      timeSpent: totalTime,
      problemsAttempted,
      problemsSolved,
      conditionId: sessionConditionIdRef.current,
    };
  }, [learnerId, sessionId]);

  const finalizeSessionEnd = useCallback((reason: 'cleanup' | 'pagehide') => {
    if (!sessionId || finalizedSessionIdsRef.current.has(sessionId)) {
      return;
    }

    const sessionEndEvent = buildSessionEndEvent();
    if (!sessionEndEvent) {
      return;
    }
    finalizedSessionIdsRef.current.add(sessionId);

    // RESEARCH-2: Both paths now use strong verification barrier
    // The pagehide path uses keepalive transport but same verification logic
    
    if (reason === 'pagehide') {
      if (!AUTH_BACKEND_CONFIGURED) {
        void storage.emitSessionEnd(sessionEndEvent).catch((error) => {
          console.warn('[LearningInterface] local session_end pagehide emission failed:', error);
        });
        return;
      }

      // RESEARCH-2: Use flushPendingWithVerification for strong barrier
      // First flush all pending interactions, then send session_end
      void storage.flushPendingWithVerification(sessionId).then((flushResult) => {
        if (flushResult.interactionsFlushed > 0) {
          console.info('[LearningInterface] pagehide flush result:', {
            flushed: flushResult.interactionsFlushed,
            confirmed: flushResult.interactionsConfirmed,
          });
        }

        // Only proceed with session_end if all interactions are flushed or we're in best-effort mode
        const queued = storage.queueSessionEnd(sessionEndEvent);
        if (!queued.success) {
          console.warn('[LearningInterface] session_end queue failed before pagehide');
          return;
        }

        // Use keepalive for final session_end send
        return storage.flushWithKeepalive(sessionId);
      }).then((status) => {
        if (status && !status.backendConfirmed) {
          console.warn('[LearningInterface] session_end keepalive flush pending:', status.error);
        }
      }).catch((error) => {
        console.warn('[LearningInterface] session_end pagehide flush failed:', error);
      });
      return;
    }

    // Normal cleanup - use full verification path
    void storage.emitSessionEnd(sessionEndEvent).then((status) => {
      if (!status.backendConfirmed) {
        console.warn('[LearningInterface] session_end blocked pending backend sync:', status.error);
      }
    }).catch((error) => {
      console.warn('[LearningInterface] session_end emission failed:', error);
    });
  }, [buildSessionEndEvent, sessionId]);

  useEffect(() => {
    if (!learnerId || !sessionId) {
      return;
    }
    if (!AUTH_BACKEND_CONFIGURED) {
      setSessionSyncStatus('confirmed');
      setSessionSyncError(undefined);
      return;
    }

    let cancelled = false;
    setSessionSyncStatus('checking');
    setSessionSyncError(undefined);

    void storage.ensureSessionPersisted(learnerId, sessionId).then((status) => {
      if (cancelled) return;
      if (status.backendConfirmed) {
        setSessionSyncStatus('confirmed');
        setSessionSyncError(undefined);
        return;
      }
      if (status.pendingSync) {
        setSessionSyncStatus('pending');
        setSessionSyncError(status.error);
        return;
      }
      setSessionSyncStatus('failed');
      setSessionSyncError(status.error ?? 'Session is currently only saved locally.');
    });
    void storage.flushPendingSessionEnds().catch((error) => {
      console.warn('[LearningInterface] pending session_end flush failed during session setup:', error);
    });

    return () => {
      cancelled = true;
    };
  }, [learnerId, sessionId]);

  useEffect(() => {
    if (!learnerId || !sessionId) {
      return;
    }

    return () => {
      // Paper Data Contract: Flush pending code change telemetry on unmount
      flushCodeChangeTelemetry();
      finalizeSessionEnd('cleanup');
    };
  }, [finalizeSessionEnd, learnerId, sessionId]);

  useEffect(() => {
    if (!learnerId || !sessionId) {
      return;
    }

    const handlePageHide = (event: PageTransitionEvent) => {
      if (event.persisted) {
        return;
      }
      // Paper Data Contract: Flush pending code change telemetry before page hide
      flushCodeChangeTelemetry();
      finalizeSessionEnd('pagehide');
    };

    window.addEventListener('pagehide', handlePageHide);
    return () => {
      window.removeEventListener('pagehide', handlePageHide);
    };
  }, [finalizeSessionEnd, learnerId, sessionId]);

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

  // Memoized problem interactions (session-scoped for current session display)
  const problemInteractions = useMemo(() =>
    learnerSessionInteractions.filter(i => i.problemId === currentProblem.id),
    [learnerSessionInteractions, currentProblem.id]
  );

  // RESEARCH-4: Emit concept_view for problem source exactly once per (session, problem, concept)
  // This useEffect handles initial mount and problem switches; dedupe prevents duplicate emissions
  useEffect(() => {
    if (!learnerId || !sessionId) {
      return;
    }
    for (const conceptId of currentProblem.concepts) {
      const dedupeKey = `${learnerId}:${sessionId}:${currentProblem.id}:${conceptId}:problem`;
      if (!emittedConceptViewsRef.current.has(dedupeKey)) {
        emittedConceptViewsRef.current.add(dedupeKey);
        storage.logConceptView({
          learnerId,
          sessionId,
          problemId: currentProblem.id,
          conceptId,
          source: 'problem',
        });
      }
    }
  }, [learnerId, sessionId, currentProblem.id]);

  // Cross-session problem interactions for truthful progress indicators
  // This ensures "successful runs" agrees with "Solved" badge across sessions
  const allProblemInteractions = useMemo(() => {
    const allInteractions = storage.getInteractionsByLearner(learnerId);
    return allInteractions.filter(i => i.problemId === currentProblem.id);
  }, [learnerId, currentProblem.id, solvedRefreshKey]);

  // Unified progress model - single source of truth for all progress metrics
  const progress = useLearnerProgress({
    learnerId,
    currentProblemId: currentProblem.id,
    refreshKey: solvedRefreshKey,
    hydratedSolvedIds,
  });

  // Destructure for convenience (backward compatibility with existing code)
  const {
    totalProblems,
    currentProblemNumber,
    solvedCount,
    solvedPercent,
    solvedProblemIds,
    isCurrentProblemSolved,
    isProblemSolved,
    getSolvedCountForDifficulty,
  } = progress;

  // Navigation handlers
  const handleNextProblem = useCallback(() => {
    const nextIndex = currentProblemNumber; // already 1-based, so this is correct position for next
    if (nextIndex < sqlProblems.length) {
      handleProblemChange(sqlProblems[nextIndex].id);
    }
  }, [currentProblemNumber, handleProblemChange]);

  const handlePreviousProblem = useCallback(() => {
    const prevIndex = currentProblemNumber - 2; // convert to 0-based, then back one
    if (prevIndex >= 0) {
      handleProblemChange(sqlProblems[prevIndex].id);
    }
  }, [currentProblemNumber, handleProblemChange]);

  const hasNextProblem = currentProblemNumber < sqlProblems.length;
  const hasPreviousProblem = currentProblemNumber > 1;

  // Memoized error and attempt calculations
  const latestProblemErrorEvent = useMemo(() => 
    [...problemInteractions]
      .reverse()
      .find((interaction) => interaction.eventType === 'error'),
    [problemInteractions]
  );

  const latestProblemErrorSubtype = latestProblemErrorEvent?.sqlEngageSubtype || latestProblemErrorEvent?.errorSubtypeId;
  const effectiveLastError = lastError || latestProblemErrorSubtype;
  // Show Save to Notes when student has engaged with the problem:
  // 1. After hint escalation with an error (original behavior)
  // 2. After viewing any hints (student actively sought help)
  // 3. After solving the problem (student may want to save their learning)
  const hasViewedHints = problemInteractions.some(i => i.eventType === 'hint_view');
  const hasSolvedCurrentProblem = isCurrentProblemSolved;
  const showAddToNotes = 
    (escalationTriggered && !!effectiveLastError) ||  // Original path
    hasViewedHints ||                                   // Viewed at least one hint
    hasSolvedCurrentProblem;                           // Solved the problem
  
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
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
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
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        {/* Week 5: Dependency Warning Toast */}
        {showDependencyWarning && (
          <DependencyWarningToast onClose={() => setShowDependencyWarning(false)} />
        )}

        {/* Preview Mode Banner - Canvas LMS Style */}
        {isPreviewMode && (
          <div className="bg-purple-600 text-white px-4 py-3 sticky top-0 z-50">
            <div className="container mx-auto flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-1.5 bg-purple-500 rounded-lg">
                  <Eye className="size-5" />
                </div>
                <div>
                  <span className="font-semibold">Student Preview Mode</span>
                  <span className="hidden sm:inline text-purple-200 ml-2">
                    You are viewing the platform as a student would see it
                  </span>
                </div>
              </div>
              <Button 
                variant="secondary" 
                size="sm"
                onClick={exitPreviewMode}
                className="bg-white text-purple-700 hover:bg-purple-50 border-0 font-medium"
                aria-label="Exit Student Preview mode and return to instructor dashboard"
              >
                <LogOut className="size-4 mr-2" aria-hidden="true" />
                Exit Preview
              </Button>
            </div>
          </div>
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
                    <div className="flex items-center gap-2">
                      <h1 className="text-2xl font-bold text-gray-900">Practice SQL</h1>
                      {isPreviewMode && (
                        <Badge className="bg-purple-100 text-purple-800 border-purple-300">
                          Preview Mode
                        </Badge>
                      )}
                    </div>
                    <p className="text-gray-600 text-sm">
                      {isPreviewMode 
                        ? 'You are previewing the student experience. Click "Exit Preview" to return.'
                        : 'Learn SQL with personalized hints and explanations'
                      }
                    </p>
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

                {/* Student progress indicator - Shows solved count, NOT current position */}
                {isStudent && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="flex items-center gap-2 px-3 py-1.5 bg-green-50 rounded-lg border border-green-200">
                        <Target className="size-4 text-green-600" />
                        <span className="text-sm font-medium text-green-700">
                          Solved: {solvedCount} / {totalProblems}
                        </span>
                        <div className="w-16 h-2 bg-green-200 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-green-500 rounded-full transition-all"
                            style={{ width: `${solvedPercent}%` }}
                          />
                        </div>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>You have solved {solvedCount} of {totalProblems} problems ({solvedPercent}%)</p>
                      <p className="text-xs text-gray-500 mt-1">This shows your overall completion progress</p>
                    </TooltipContent>
                  </Tooltip>
                )}

                {/* Week 5: Profile Badge - DEV mode + Instructors Only (for testing/debugging) */}
                {isDev && isInstructor && (
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
                      {isInstructor && (
                        <p className="text-xs text-gray-400 mt-1">
                          HDI: {(currentHDI * 100).toFixed(0)}% • {hdiTrend}
                        </p>
                      )}
                    </TooltipContent>
                  </Tooltip>
                )}

                {/* Role selector - Instructors only (allows testing student view) */}
                {isInstructor && (
                  <Select value={role} onValueChange={(value) => {
                    clearUiStateForActor(learnerId);
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
            <div className="lg:col-span-2 space-y-4 xl:grid xl:grid-cols-2 xl:gap-4 xl:space-y-0 min-w-0">
              {/* Left sub-column: Problem description + schema */}
              <div className="space-y-4">
                <Card className="p-6">
                <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <span className="text-sm text-gray-500 font-medium">
                        Problem {currentProblemNumber} of {totalProblems}
                      </span>
                      <h2 className="text-xl font-bold">{currentProblem.title}</h2>
                      <Badge 
                        variant="outline"
                        className={`w-fit ${difficultyColors[currentProblem.difficulty]}`}
                      >
                        {currentProblem.difficulty}
                      </Badge>
                      {isCurrentProblemSolved && (
                        <Badge className="bg-green-100 text-green-800 border-green-200">
                          <Check className="size-3 mr-1" />
                          Solved
                        </Badge>
                      )}
                    </div>
                    <p className="text-gray-700 dark:text-gray-200">{currentProblem.description}</p>
                    
                    {/* Next Problem callout after correct answer */}
                    {isCurrentProblemSolved && hasNextProblem && (
                      <div className="mt-2 flex items-center gap-2 text-green-700 text-sm font-medium">
                        <CheckCircle className="size-4" />
                        <span>Correct!</span>
                        <Button 
                          variant="link" 
                          size="sm" 
                          onClick={handleNextProblem} 
                          className="text-green-700 underline p-0 h-auto"
                        >
                          Next Problem →
                        </Button>
                      </div>
                    )}
                    
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
                    
                    {/* Week 6: Condition indicator - subtle experimental condition badge */}
                    {sessionConfig && (
                      <div className="flex items-center gap-2 mt-3 text-xs">
                        <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded">
                          Condition: {sessionConfig.conditionId}
                        </span>
                        {sessionConfig.textbookDisabled && (
                          <span className="px-2 py-1 bg-amber-100 text-amber-800 rounded">
                            Textbook Disabled
                          </span>
                        )}
                        {sessionConfig.immediateExplanationMode && (
                          <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded">
                            Explanation-First Mode
                          </span>
                        )}
                        {sessionConfig.adaptiveLadderDisabled && (
                          <span className="px-2 py-1 bg-purple-100 text-purple-800 rounded">
                            Static Ladder
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                  
                  {/* Enhanced Problem Selector with difficulty, concepts, and solved status */}
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handlePreviousProblem}
                      disabled={!hasPreviousProblem}
                      aria-label="Previous problem"
                      className="shrink-0"
                    >
                      <ChevronLeft className="size-4 mr-1" />
                      <span className="hidden sm:inline">Prev</span>
                    </Button>
                    <Select
                      value={currentProblem.id}
                      onValueChange={handleProblemChange}
                    >
                    <SelectTrigger className="w-full lg:w-[300px]" data-testid="problem-select-trigger">
                      <div className="flex items-center gap-2 overflow-hidden">
                        <span className="truncate">{currentProblem.title}</span>
                        <Badge variant="outline" className="text-[10px] px-1 shrink-0 hidden sm:inline-flex" title="Problems solved">
                          {solvedCount} of {totalProblems} solved
                        </Badge>
                      </div>
                    </SelectTrigger>
                    <SelectContent className="max-h-[400px] w-[calc(100vw-2rem)] sm:w-auto max-w-[90vw] sm:max-w-[400px]">
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
                              {difficulty} — {solvedInDifficulty} of {problems.length} solved
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
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleNextProblem}
                      disabled={!hasNextProblem}
                      aria-label="Next problem"
                      className="shrink-0"
                    >
                      <span className="hidden sm:inline">Next</span>
                      <ChevronRight className="size-4 ml-1" />
                    </Button>
                  </div>
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
                          {allProblemInteractions.filter(i => i.successful).length} correct runs
                        </span>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Total successful query executions for this problem (all sessions)</p>
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

                <details className="mb-4 group">
                  <summary className="font-semibold text-sm cursor-pointer select-none flex items-center gap-1 hover:text-blue-700">
                    <ChevronRight className="size-4 transition-transform group-open:rotate-90" />
                    Database Schema
                  </summary>
                  <pre className="bg-gray-100 dark:bg-gray-800 p-3 rounded text-xs overflow-x-auto mt-2">
                    {currentProblem.schema}
                  </pre>
                </details>
              </Card>
            </div>

            <div className="xl:h-[calc(100vh-200px)]">
              <div className="h-[300px] sm:h-[350px] md:h-[450px] lg:h-[550px] max-h-[60vh]">
                <SQLEditor
                  key={currentProblem.id}
                  problem={currentProblem}
                  code={sqlDraft}
                  onExecute={handleExecute}
                  onCodeChange={handleEditorCodeChange}
                  onReset={handleEditorReset}
                />
              </div>
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
                escalationProfile={currentEscalationProfile}
                sessionConfig={sessionConfig}
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

              {/* Week 3 Feature: Ask My Textbook Chat - conditionally hidden if textbookDisabled */}
              {(!sessionConfig?.textbookDisabled) && (
                <AskMyTextbookChat
                  sessionId={sessionId}
                  learnerId={learnerId}
                  problemId={currentProblem.id}
                  recentInteractions={problemInteractions}
                  onInteractionLogged={handleHintSystemInteraction}
                />
              )}

              {showAddToNotes && (
                <Card className="p-4 space-y-3">
                  <div>
                    <h3 className="font-semibold">Save This Explanation</h3>
                    <p className="text-sm text-gray-600">
                      You have viewed all available hints. Save this explanation to your notes for later review.
                    </p>
                  </div>
                  <Button onClick={handleAddToNotes} size="sm" className="w-full" disabled={isGeneratingUnit}>
                    {isGeneratingUnit ? (
                      <>
                        <Sparkles className="size-4 mr-2 animate-pulse" />
                        Saving...
                      </>
                    ) : (
                      'Save to My Notes'
                    )}
                  </Button>
                  {isGeneratingUnit && (
                    <p className="text-xs text-gray-500">Creating your note...</p>
                  )}
                  {generationError && (
                    <p className="text-xs text-amber-700">{generationError}</p>
                  )}
                  {notesActionMessage && (
                    <div className="text-sm text-green-700 bg-green-50 p-3 rounded-lg border border-green-300 shadow-md animate-in fade-in slide-in-from-bottom-2 duration-300">
                      <div className="flex items-center gap-2">
                        <CheckCircle className="size-5 text-green-600 flex-shrink-0" />
                        <p className="font-medium">{notesActionMessage}</p>
                      </div>
                      <Link to="/textbook" className="text-blue-600 hover:underline mt-2 inline-flex items-center gap-1 text-xs">
                        View in My Textbook →
                      </Link>
                    </div>
                  )}
                  {latestGeneratedUnit && (
                    <div className="rounded border bg-slate-50 p-2">
                      <p className="text-xs font-medium text-slate-700">{latestGeneratedUnit.title}</p>
                    </div>
                  )}
                </Card>
              )}

              <ConceptCoverage learnerId={learnerId} />

              {/* Knowledge-Structure Layer: Prerequisite Warnings */}
              {currentProblem.concepts.some(conceptId => {
                const profile = storage.getProfile(learnerId);
                if (!profile) return false;
                const status = checkPrerequisites(conceptId, profile.conceptsCovered);
                return !status.ready;
              }) && (
                <Card className="p-4 bg-amber-50 border-amber-200">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertCircle className="size-4 text-amber-600" />
                    <h3 className="font-semibold text-amber-900">Prerequisites Needed</h3>
                  </div>
                  <div className="space-y-2">
                    {currentProblem.concepts.map(conceptId => {
                      const profile = storage.getProfile(learnerId);
                      if (!profile) return null;
                      const status = checkPrerequisites(conceptId, profile.conceptsCovered);
                      if (status.ready) return null;
                      
                      return (
                        <div key={conceptId} className="text-sm">
                          <p className="text-amber-800 font-medium">
                            {conceptId.replace(/-/g, ' ')}
                          </p>
                          {status.missing.length > 0 && (
                            <p className="text-amber-700 text-xs mt-0.5">
                              Missing: {status.missing.slice(0, 2).join(', ')}
                              {status.missing.length > 2 && ` +${status.missing.length - 2} more`}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </Card>
              )}
              
              {/* Knowledge-Structure Layer: Learning Path Recommendations */}
              {learningPath && learningPath.recommendedConcepts.length > 0 && (
                <Card className="p-4 bg-blue-50 border-blue-200">
                  <div className="flex items-center gap-2 mb-3">
                    <GraduationCap className="size-4 text-blue-600" />
                    <h3 className="font-semibold text-blue-900">Learning Path</h3>
                  </div>
                  <div className="space-y-2">
                    {learningPath.recommendedConcepts.slice(0, 3).map((rec, index) => (
                      <div key={rec.conceptId} className="flex items-start gap-2">
                        <span className="flex-shrink-0 w-5 h-5 rounded-full bg-blue-100 text-blue-700 text-xs flex items-center justify-center font-medium">
                          {index + 1}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-blue-800 truncate">
                            {rec.name}
                          </p>
                          <p className="text-xs text-blue-600">
                            {rec.reason}
                          </p>
                        </div>
                        {rec.priority === 'high' && (
                          <span className="flex-shrink-0 px-1.5 py-0.5 bg-red-100 text-red-700 text-[10px] rounded">
                            High
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 pt-3 border-t border-blue-200">
                    <div className="flex items-center justify-between text-xs text-blue-700">
                      <span>Progress: {learningPath.progressPercentage}%</span>
                      <span>{learningPath.completedConcepts}/{learningPath.totalConcepts} concepts</span>
                    </div>
                    <div className="mt-1.5 h-1.5 bg-blue-200 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-blue-500 rounded-full transition-all"
                        style={{ width: `${learningPath.progressPercentage}%` }}
                      />
                    </div>
                  </div>
                </Card>
              )}

              <Card className="p-4">
                <h3 className="font-semibold mb-3">Session Stats</h3>
                <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-2 text-sm">
                  <div className="text-gray-600" title="Query attempts in this session only">Attempts (this session):</div>
                  <div className="font-medium text-right">{totalAttempts}</div>
                  <div className="text-gray-600">Hints viewed:</div>
                  <div className="font-medium text-right">{hintViewsCount}</div>
                  <div className="text-gray-600">Help requests:</div>
                  <div className="font-medium text-right">{helpRequestsCount}</div>
                  <div className="text-gray-600">Session ID:</div>
                  <div className="max-w-[180px] break-all text-right text-[11px] font-medium text-gray-700 sm:max-w-[220px] sm:text-xs">
                    {sessionId || 'pending'}
                  </div>
                  <div className="text-gray-600">Session sync:</div>
                  <div
                    className={cn(
                      'text-right text-xs font-medium capitalize',
                      sessionSyncStatus === 'confirmed' && 'text-green-700',
                      sessionSyncStatus === 'pending' && 'text-amber-700',
                      sessionSyncStatus === 'failed' && 'text-red-700',
                      sessionSyncStatus === 'checking' && 'text-gray-600',
                    )}
                    title={sessionSyncError}
                  >
                    {sessionSyncStatus}
                  </div>
                  <div className="text-gray-600">Time spent:</div>
                  <div className="font-medium text-right">
                    {formatTime(timeSpent)}
                  </div>
                </div>
              </Card>

              {/* Week 5: Unified HDI Display with 5 Components - INSTRUCTOR ONLY */}
              {isInstructor && (
              <Card className="p-4 bg-gradient-to-br from-indigo-50 to-purple-50 border-indigo-200">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-indigo-900">Hint Dependency Index</h3>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Badge 
                        variant="outline" 
                        className={cn(
                          "text-xs",
                          hdiLevel === 'low' && "bg-green-100 text-green-800 border-green-300",
                          hdiLevel === 'medium' && "bg-yellow-100 text-yellow-800 border-yellow-300",
                          hdiLevel === 'high' && "bg-red-100 text-red-800 border-red-300"
                        )}
                      >
                        {hdiLevel === 'low' && <Check className="size-3 mr-1" />}
                        {hdiLevel.charAt(0).toUpperCase() + hdiLevel.slice(1)}
                      </Badge>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>HDI Level: {hdiLevel} dependency on hints</p>
                      <p className="text-xs text-gray-400">Score: {(currentHDI * 100).toFixed(1)}%</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
                
                {/* Overall HDI Score */}
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-indigo-700 font-medium">Overall HDI</span>
                    <span className="text-lg font-bold text-indigo-900">{(currentHDI * 100).toFixed(1)}%</span>
                  </div>
                  <div className="w-full h-2 bg-indigo-200 rounded-full overflow-hidden">
                    <div 
                      className={cn(
                        "h-full rounded-full transition-all duration-500",
                        hdiLevel === 'low' && "bg-green-500",
                        hdiLevel === 'medium' && "bg-yellow-500",
                        hdiLevel === 'high' && "bg-red-500"
                      )}
                      style={{ width: `${currentHDI * 100}%` }}
                    />
                  </div>
                </div>

                {/* 5 Component Breakdown */}
                {hdiComponents && (
                  <div className="space-y-2">
                    <p className="text-xs text-indigo-600 font-medium mb-2">Component Breakdown</p>
                    
                    {/* HPA - Hints Per Attempt */}
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-600 w-12 shrink-0">HPA</span>
                          <div className="flex-1 h-1.5 bg-indigo-100 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-indigo-500 rounded-full"
                              style={{ width: `${hdiComponents.hpa * 100}%` }}
                            />
                          </div>
                          <span className="text-xs font-mono text-gray-700 w-10 text-right">
                            {hdiComponents.hpa.toFixed(2)}
                          </span>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent side="left">
                        <p className="font-medium">Hints Per Attempt (HPA)</p>
                        <p className="text-xs text-gray-400">Ratio of hint requests to problem attempts</p>
                      </TooltipContent>
                    </Tooltip>

                    {/* AED - Average Escalation Depth */}
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-600 w-12 shrink-0">AED</span>
                          <div className="flex-1 h-1.5 bg-indigo-100 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-indigo-500 rounded-full"
                              style={{ width: `${hdiComponents.aed * 100}%` }}
                            />
                          </div>
                          <span className="text-xs font-mono text-gray-700 w-10 text-right">
                            {hdiComponents.aed.toFixed(2)}
                          </span>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent side="left">
                        <p className="font-medium">Average Escalation Depth (AED)</p>
                        <p className="text-xs text-gray-400">Average hint level used (1-3), normalized</p>
                      </TooltipContent>
                    </Tooltip>

                    {/* ER - Explanation Rate */}
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-600 w-12 shrink-0">ER</span>
                          <div className="flex-1 h-1.5 bg-indigo-100 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-indigo-500 rounded-full"
                              style={{ width: `${hdiComponents.er * 100}%` }}
                            />
                          </div>
                          <span className="text-xs font-mono text-gray-700 w-10 text-right">
                            {hdiComponents.er.toFixed(2)}
                          </span>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent side="left">
                        <p className="font-medium">Explanation Rate (ER)</p>
                        <p className="text-xs text-gray-400">Ratio of explanation views to attempts</p>
                      </TooltipContent>
                    </Tooltip>

                    {/* REAE - Repeated Error After Explanation */}
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-600 w-12 shrink-0">REAE</span>
                          <div className="flex-1 h-1.5 bg-indigo-100 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-indigo-500 rounded-full"
                              style={{ width: `${hdiComponents.reae * 100}%` }}
                            />
                          </div>
                          <span className="text-xs font-mono text-gray-700 w-10 text-right">
                            {hdiComponents.reae.toFixed(2)}
                          </span>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent side="left">
                        <p className="font-medium">Repeated Error After Explanation (REAE)</p>
                        <p className="text-xs text-gray-400">Errors made after viewing explanations</p>
                      </TooltipContent>
                    </Tooltip>

                    {/* IWH - Improvement Without Hint */}
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-600 w-12 shrink-0">IWH</span>
                          <div className="flex-1 h-1.5 bg-indigo-100 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-green-500 rounded-full"
                              style={{ width: `${hdiComponents.iwh * 100}%` }}
                            />
                          </div>
                          <span className="text-xs font-mono text-gray-700 w-10 text-right">
                            {hdiComponents.iwh.toFixed(2)}
                          </span>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent side="left">
                        <p className="font-medium">Improvement Without Hint (IWH)</p>
                        <p className="text-xs text-gray-400">Successful attempts without using hints</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                )}

                {/* Trend Indicator */}
                <div className="mt-3 pt-3 border-t border-indigo-100">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-indigo-600">Trend:</span>
                    <span className={cn(
                      "font-medium",
                      hdiTrend === 'decreasing' && "text-green-600",
                      hdiTrend === 'increasing' && "text-amber-600",
                      hdiTrend === 'stable' && "text-gray-600"
                    )}>
                      {hdiTrend === 'decreasing' && '↓ Improving'}
                      {hdiTrend === 'increasing' && '↑ Rising'}
                      {hdiTrend === 'stable' && '→ Stable'}
                    </span>
                  </div>
                </div>
              </Card>
              )}

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

        {/* Reinforcement Prompt Modal - Component 10: Knowledge Consolidation */}
        {activeReinforcement && (
          <ReinforcementPrompt
            prompt={activeReinforcement}
            promptNumber={reinforcementPromptNumber}
            totalPrompts={reinforcementTotalPrompts}
            onResponse={(response, isCorrect, responseTimeMs) => {
              reinforcementManager.recordResponse(
                activeReinforcement.scheduleId,
                activeReinforcement.promptId,
                learnerId,
                response,
                isCorrect,
                responseTimeMs
              );
              // Keep the prompt visible briefly to show feedback, then dismiss
              window.setTimeout(() => {
                setActiveReinforcement(null);
              }, 2000);
            }}
            onDismiss={() => {
              reinforcementManager.dismissPrompt(
                activeReinforcement.scheduleId,
                activeReinforcement.promptId,
                learnerId
              );
              setActiveReinforcement(null);
            }}
          />
        )}
      </div>
  );
}
