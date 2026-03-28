import { useState, useEffect, useMemo, useRef, useCallback, type JSX } from 'react';
import { Card } from '../../ui/card';
import { Button } from '../../ui/button';
import { Badge } from '../../ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../../ui/tooltip';
import { Skeleton } from '../../ui/skeleton';


// Strategy comparison data type
interface StrategyComparison {
  strategy: string;
  totalErrors: number;
  totalHints: number;
  totalSuccess: number;
  totalEscalations: number;
  totalUnitsAdded: number;
  totalUnitUpdates: number;
  learnerCount: number;
}

// Timeline data point type
interface TimelineDataPoint {
  minute: number;
  events: number;
  errors: number;
  hints: number;
}

// Comparison row type for table rendering
interface ComparisonRow {
  strategy: string;
  avgErrors: number;
  avgHints: number;
  avgSuccess: number;
  avgEscalations: number;
  avgUnitsAdded: number;
  avgDedupRate: string;
}

// Week 5: Adaptive Personalization data types
interface ProfileDistributionData {
  name: string;
  value: number;
  color: string;
}

interface BanditArmData {
  armId: string;
  selectionCount: number;
  meanReward: number;
}

interface BanditRewardData {
  timestamp: number;
  armId: string;
  reward: number;
  cumulativeMean: number;
}

interface HDIDataPoint {
  hdi: number;
  learnerId: string;
  timestamp: number;
}

interface HighHDIAlert {
  learnerId: string;
  hdi: number;
  trend: string;
  timestamp: number;
}

interface ProfileEffectivenessData {
  profile: string;
  learnerCount: number;
  avgSuccessRate: number;
  avgEscalations: number;
  totalInteractions: number;
}

// Component 10: Reinforcement data types
interface ReinforcementStats {
  totalScheduled: number;
  totalShown: number;
  totalResponded: number;
  responseRate: number;
  averageRetentionScore: number;
}

interface ReinforcementDataPoint {
  timestamp: number;
  learnerId: string;
  eventType: 'scheduled' | 'shown' | 'response';
  retentionLevel?: string;
  isCorrect?: boolean;
}

// Week 6: Rich Research Dashboard Metrics
interface ResearchMetrics {
  clusters: LearnerCluster[];
  errorTransitions: ErrorTransitionStats;
  selectedMasteryLearner: string;
}

interface ResearchDashboardUiState {
  selectedLearner: string;
  timeRange: string;
  activeTab: string;
}
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '../../ui/table';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip as RechartsTooltip, 
  Legend, 
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { 
  Download, 
  Play, 
  RefreshCw, 
  Users, 
  Activity, 
  Calendar,
  Clock,
  AlertCircle,
  CheckCircle2,
  FileUp,
  Loader2,
  BarChart3,
  PieChart as PieChartIcon,
  TrendingUp,
  Lightbulb,
  Sparkles,
  Target,
  BrainCircuit,
  BookOpen
} from 'lucide-react';
import { storage } from '../../../lib/storage';
import { InteractionEvent, LearnerProfile, ExperimentCondition, PdfIndexDocument } from '../../../types';
import { type ReflectionQualityScore } from '../../../lib/content/self-explanation-scorer';
import { orchestrator, ReplayDecisionPoint, AutoEscalationMode } from '../../../lib/adaptive-orchestrator';
import { checkOllamaHealth, OLLAMA_MODEL } from '../../../lib/api/llm-client';
import { loadOrBuildPdfIndex, uploadPdfAndBuildIndex } from '../../../lib/pdf-index-loader';
import { isDemoMode, getDemoModeMessage, DEMO_MODE_VERSION } from '../../../lib/utils/demo-mode';
import { isHostedMode, getHostedModeMessage } from '../../../lib/runtime-config';
import { createEventId } from '../../../lib/utils/event-id';
import { countInteractionsByType, filterInteractionsByLearners } from '../../../lib/counts/selectors';
import { getUiState, setUiState } from '../../../lib/ui-state';
import { clusterLearners, LearnerCluster } from '../../../lib/research/learner-clustering';
import { buildErrorTransitionMatrix, buildErrorTransitionStats, getErrorRecoveryPatterns, ErrorTransitionStats } from '../../../lib/research/error-transitions';
import { EscalationHeatmap } from './EscalationHeatmap';
import { ErrorTransitionView, ErrorChainView, ErrorRecoveryView } from './ErrorTransitionView';
import { MasteryTimeline } from './MasteryTimeline';

const experimentConditions: ExperimentCondition[] = [
  {
    id: 'hint-only',
    name: 'Hint-Only',
    strategy: 'hint-only',
    description: 'Only provides hints, never escalates',
    parameters: { escalationThreshold: Infinity }
  },
  {
    id: 'adaptive-low',
    name: 'Adaptive (Low)',
    strategy: 'adaptive-low',
    description: 'Escalates after 5 errors, aggregates after 10',
    parameters: { escalationThreshold: 5 }
  },
  {
    id: 'adaptive-medium',
    name: 'Adaptive (Medium)',
    strategy: 'adaptive-medium',
    description: 'Escalates after 3 errors, aggregates after 6',
    parameters: { escalationThreshold: 3 }
  },
  {
    id: 'adaptive-high',
    name: 'Adaptive (High)',
    strategy: 'adaptive-high',
    description: 'Escalates after 2 errors, aggregates after 4',
    parameters: { escalationThreshold: 2 }
  }
];

// Time range options for filtering
const TIME_RANGES = [
  { value: 'all', label: 'All Time', days: null },
  { value: '24h', label: 'Last 24 Hours', days: 1 },
  { value: '7d', label: 'Last 7 Days', days: 7 },
  { value: '30d', label: 'Last 30 Days', days: 30 },
  { value: '90d', label: 'Last 90 Days', days: 90 }
];

// Chart colors
const CHART_COLORS = {
  primary: '#3b82f6',
  secondary: '#6366f1',
  success: '#22c55e',
  warning: '#eab308',
  error: '#ef4444',
  info: '#0ea5e9',
  purple: '#8b5cf6',
  orange: '#f97316'
};

// Helper component for quality dimension bars
function DimensionBar({ label, value }: { label: string; value: number }) {
  const colorClass = value >= 70 
    ? 'bg-green-500' 
    : value >= 40 
      ? 'bg-yellow-500' 
      : 'bg-red-500';

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs w-20 text-gray-600">{label}</span>
      <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
        <div 
          className={`h-full rounded-full ${colorClass}`}
          style={{ width: `${value}%` }}
        />
      </div>
      <span className={`text-xs w-8 text-right font-medium ${
        value >= 70 ? 'text-green-600' : value >= 40 ? 'text-yellow-600' : 'text-red-600'
      }`}>
        {value}
      </span>
    </div>
  );
}

export function ResearchDashboard() {
  const [interactions, setInteractions] = useState<InteractionEvent[]>([]);
  const [profiles, setProfiles] = useState<LearnerProfile[]>([]);
  const [selectedLearner, setSelectedLearner] = useState<string>('all');
  const [selectedTraceLearner, setSelectedTraceLearner] = useState<string>('');
  const [selectedTraceProblem, setSelectedTraceProblem] = useState<string>('all');
  const [selectedReplayStrategy, setSelectedReplayStrategy] = useState<ExperimentCondition['strategy']>('adaptive-medium');
  const [selectedAutoEscalationMode, setSelectedAutoEscalationMode] = useState<AutoEscalationMode>('always-after-hint-threshold');
  const [traceWindow, setTraceWindow] = useState<string>('40');
  const [isReplaying, setIsReplaying] = useState(false);
  const [replayNonce, setReplayNonce] = useState(0);
  const [exportAllHistory, setExportAllHistory] = useState(false);
  const [isCheckingLLM, setIsCheckingLLM] = useState(false);
  const [llmHealthMessage, setLlmHealthMessage] = useState('Not checked. Click "Test LLM" to verify local Ollama.');
  const [llmHealthOk, setLlmHealthOk] = useState<boolean | null>(null);
  const [policyReplayMode, setPolicyReplayMode] = useState(storage.getPolicyReplayMode());
  const [pdfIndexSummary, setPdfIndexSummary] = useState<string>('No PDF index loaded');
  const [pdfIndexStatus, setPdfIndexStatus] = useState<'idle' | 'loading' | 'ready' | 'error' | 'warning'>('idle');
  const [pdfIndexError, setPdfIndexError] = useState<string | null>(null);
  
  // Hosted mode detection
  const [hostedMode, setHostedMode] = useState<boolean>(false);
  
  // Time range filter
  const [timeRange, setTimeRange] = useState<string>('all');
  const [activeTab, setActiveTab] = useState<string>('interactions');
  
  // Export/Import states
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [isImporting, setIsImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importSuccess, setImportSuccess] = useState(false);
  
  // Loading state
  const [isLoading, setIsLoading] = useState(true);
  const [selectedMasteryLearner, setSelectedMasteryLearner] = useState<string>('');
  const uiActorId = storage.getUserProfile()?.id || 'unknown';

  useEffect(() => {
    const timer = setTimeout(() => setIsLoading(false), 500);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    // Detect hosted mode on mount
    setHostedMode(isHostedMode());
    void loadData();
  }, []);

  useEffect(() => {
    storage.setPolicyReplayMode(policyReplayMode);
  }, [policyReplayMode]);

  useEffect(() => {
    const persisted = getUiState<ResearchDashboardUiState>('research-dashboard', {
      role: 'instructor',
      actorId: uiActorId,
    });
    if (!persisted) return;
    if (persisted.selectedLearner) {
      setSelectedLearner(persisted.selectedLearner);
    }
    if (persisted.timeRange && TIME_RANGES.some((range) => range.value === persisted.timeRange)) {
      setTimeRange(persisted.timeRange);
    }
    if (persisted.activeTab) {
      setActiveTab(persisted.activeTab);
    }
  }, [uiActorId]);

  useEffect(() => {
    setUiState<ResearchDashboardUiState>(
      'research-dashboard',
      { role: 'instructor', actorId: uiActorId },
      { selectedLearner, timeRange, activeTab }
    );
  }, [uiActorId, selectedLearner, timeRange, activeTab]);

  const loadData = async () => {
    await storage.hydrateInstructorDashboard();
    setInteractions(storage.getAllInteractions());
    const loadedProfiles = storage
      .getAllProfiles()
      .map((profile: { id: string }) => storage.getProfile(profile.id))
      .filter((profile): profile is LearnerProfile => Boolean(profile));
    setProfiles(loadedProfiles);
    setPolicyReplayMode(storage.getPolicyReplayMode());
    const pdfIndex = storage.getPdfIndex();
    if (pdfIndex) {
      setPdfIndexSummary(formatPdfIndexSummary(pdfIndex));
      setPdfIndexStatus('ready');
      setPdfIndexError(null);
    } else {
      resetPdfIndexState('idle');
    }
    if (!selectedTraceLearner && loadedProfiles[0]) {
      setSelectedTraceLearner(loadedProfiles[0].id);
    }
  };

  // Helper to reset PDF index state (extracted to avoid duplication)
  const resetPdfIndexState = (status: 'idle' | 'error', errorMessage?: string) => {
    setPdfIndexSummary('No PDF index loaded');
    setPdfIndexStatus(status);
    if (errorMessage) {
      setPdfIndexError(errorMessage);
    }
  };

  useEffect(() => {
    if (selectedLearner !== 'all' && !profiles.some((profile) => profile.id === selectedLearner)) {
      setSelectedLearner('all');
    }
  }, [profiles, selectedLearner]);

  useEffect(() => {
    if (!selectedTraceLearner && profiles[0]) {
      setSelectedTraceLearner(profiles[0].id);
      return;
    }
    if (selectedTraceLearner && !profiles.some((profile) => profile.id === selectedTraceLearner)) {
      setSelectedTraceLearner(profiles[0]?.id || '');
    }
  }, [profiles, selectedTraceLearner]);

  // Filter interactions by time range
  const getFilteredByTimeRange = useCallback((data: InteractionEvent[]) => {
    const range = TIME_RANGES.find(r => r.value === timeRange);
    if (!range?.days) return data;
    
    const cutoff = Date.now() - (range.days * 24 * 60 * 60 * 1000);
    return data.filter(i => i.timestamp >= cutoff);
  }, [timeRange]);

  // Ref to track export progress interval for cleanup
  const exportIntervalRef = useRef<number | null>(null);
  const exportTimeoutRef = useRef<number | null>(null);

  const handleExport = async () => {
    setIsExporting(true);
    setExportProgress(0);
    
    // Clear any existing interval/timeout first
    if (exportIntervalRef.current) {
      clearInterval(exportIntervalRef.current);
    }
    if (exportTimeoutRef.current) {
      clearTimeout(exportTimeoutRef.current);
    }
    
    // Simulate progress for large exports
    exportIntervalRef.current = window.setInterval(() => {
      if (!isMountedRef.current) {
        clearInterval(exportIntervalRef.current!);
        exportIntervalRef.current = null;
        return;
      }
      setExportProgress(prev => Math.min(prev + 10, 90));
    }, 100);
    
    let url: string | null = null;
    
    try {
      const data = exportAllHistory
        ? storage.exportAllData()
        : storage.exportData();
      
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      url = URL.createObjectURL(blob);
      blobUrlRef.current = url;  // Track for cleanup on unmount
      
      const a = document.createElement('a');
      a.href = url;
      a.download = `sql-learning-data-${Date.now()}.json`;
      document.body.appendChild(a);  // Append to ensure click works
      a.click();
      document.body.removeChild(a);
      
      if (isMountedRef.current) {
        setExportProgress(100);
        exportTimeoutRef.current = window.setTimeout(() => {
          if (isMountedRef.current) {
            setIsExporting(false);
            setExportProgress(0);
          }
          exportTimeoutRef.current = null;
        }, 500);
      }
      
      // Delay revoke to ensure download starts, but track for unmount cleanup
      blobUrlTimeoutRef.current = window.setTimeout(() => {
        if (url) {
          URL.revokeObjectURL(url);
          if (blobUrlRef.current === url) {
            blobUrlRef.current = null;
          }
        }
        blobUrlTimeoutRef.current = null;
      }, 5000);
    } catch (error) {
      // Clean up blob URL on error to prevent memory leak
      if (url) {
        URL.revokeObjectURL(url);
        if (blobUrlRef.current === url) {
          blobUrlRef.current = null;
        }
      }
      if (isMountedRef.current) {
        setImportError(`Export failed: ${(error as Error).message}`);
        setIsExporting(false);
      }
    } finally {
      if (exportIntervalRef.current) {
        clearInterval(exportIntervalRef.current);
        exportIntervalRef.current = null;
      }
    }
  };

  const handleLLMHealthCheck = async () => {
    setIsCheckingLLM(true);
    setLlmHealthMessage('Checking local Ollama...');
    try {
      const status = await checkOllamaHealth();
      setLlmHealthMessage(status.message);
      setLlmHealthOk(status.ok);
    } catch (error) {
      setLlmHealthOk(false);
      setLlmHealthMessage(`LLM health check failed unexpectedly: ${(error as Error).message}`);
    } finally {
      setIsCheckingLLM(false);
    }
  };

  const fileReaderRef = useRef<FileReader | null>(null);
  const blobUrlRef = useRef<string | null>(null);
  const blobUrlTimeoutRef = useRef<number | null>(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      // Abort any pending file read on unmount
      if (fileReaderRef.current) {
        fileReaderRef.current.abort();
        fileReaderRef.current = null;
      }
      // Clean up any pending blob URL
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
      }
      // Clean up blob URL timeout
      if (blobUrlTimeoutRef.current) {
        clearTimeout(blobUrlTimeoutRef.current);
        blobUrlTimeoutRef.current = null;
      }
      // Clean up export interval and timeout
      if (exportIntervalRef.current) {
        clearInterval(exportIntervalRef.current);
        exportIntervalRef.current = null;
      }
      if (exportTimeoutRef.current) {
        clearTimeout(exportTimeoutRef.current);
        exportTimeoutRef.current = null;
      }
    };
  }, []);

  const isImportingRef = useRef(false);

  const handleImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Prevent concurrent imports
    if (isImportingRef.current) {
      event.target.value = '';
      return;
    }

    isImportingRef.current = true;
    setIsImporting(true);
    setImportError(null);
    setImportSuccess(false);

    // Abort any existing reader before starting new one
    if (fileReaderRef.current) {
      fileReaderRef.current.abort();
    }

    const reader = new FileReader();
    fileReaderRef.current = reader;
    let isAborted = false;

    reader.onload = (e) => {
      if (isAborted) return;
      try {
        const data = JSON.parse(e.target?.result as string);
        storage.importData(data);
        if (isMountedRef.current) {
          setExportAllHistory(false);
          void loadData();
          setImportSuccess(true);
          setTimeout(() => {
            if (isMountedRef.current) {
              setImportSuccess(false);
            }
          }, 3000);
        }
      } catch (error) {
        if (isMountedRef.current && !isAborted) {
          const errorMsg = error instanceof Error ? error.message : 'Unknown error';
          setImportError(`Import failed: ${errorMsg}`);
        }
      } finally {
        if (isMountedRef.current) {
          setIsImporting(false);
        }
        isImportingRef.current = false;
        fileReaderRef.current = null;
      }
    };

    reader.onerror = () => {
      if (isMountedRef.current && !isAborted) {
        setImportError('Failed to read file. Please try again.');
        setIsImporting(false);
      }
      isImportingRef.current = false;
      fileReaderRef.current = null;
    };

    reader.onabort = () => {
      isAborted = true;
      setIsImporting(false);
      isImportingRef.current = false;
      fileReaderRef.current = null;
    };

    reader.readAsText(file);
    // Reset input so same file can be selected again
    event.target.value = '';
  };

  const handleLoadPdfIndex = async () => {
    setPdfIndexStatus('loading');
    setPdfIndexError(null);

    try {
      const result = await loadOrBuildPdfIndex();
      if (!isMountedRef.current) return;  // Check mount status after async
      
      const saveResult = storage.savePdfIndex(result.document);
      if (!isMountedRef.current) return;  // Check mount status after async
      
      setPdfIndexSummary(formatPdfIndexSummary(result.document));
      
      if (saveResult.quotaExceeded) {
        setPdfIndexStatus('warning');
        setPdfIndexError(
          `Warning: PDF index is too large for LocalStorage (${(JSON.stringify(result.document).length / 1024 / 1024).toFixed(1)} MB). ` +
          'The index is loaded in memory and will work for this session, but will be lost on page refresh. ' +
          'Consider reducing PDF file sizes or number of documents.'
        );
      } else {
        setPdfIndexStatus('ready');
      }

      if (result.status === 'built' && result.rebuiltFrom) {
        const rebuildEvent: InteractionEvent = {
          id: createEventId('pdf-index', 'rebuild'),
          sessionId: storage.getActiveSessionId(),
          learnerId: 'system',
          timestamp: Date.now(),
          eventType: 'pdf_index_rebuilt',
          problemId: 'pdf-index',
          inputs: {
            old_schema_version: result.rebuiltFrom.schemaVersion || null,
            old_embedding_model_id: result.rebuiltFrom.embeddingModelId || null,
            old_chunker_version: result.rebuiltFrom.chunkerVersion || null
          },
          outputs: {
            pdf_index_id: result.document.indexId,
            pdf_schema_version: result.document.schemaVersion,
            pdf_embedding_model_id: result.document.embeddingModelId,
            pdf_chunker_version: result.document.chunkerVersion,
            pdf_doc_count: result.document.docCount,
            pdf_chunk_count: result.document.chunkCount
          }
        };
        storage.saveInteraction(rebuildEvent);
        if (isMountedRef.current) {
          setInteractions((previous) => [...previous, rebuildEvent]);
        }
      }

      if (isMountedRef.current) {
        loadData();
      }
    } catch (error) {
      if (isMountedRef.current) {
        resetPdfIndexState('error', (error as Error).message || 'Failed to load PDF index.');
      }
    }
  };

  const handlePdfUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.pdf')) {
      setPdfIndexStatus('error');
      setPdfIndexError('Please select a PDF file.');
      event.target.value = '';
      return;
    }

    setPdfIndexStatus('loading');
    setPdfIndexError(null);

    try {
      const result = await uploadPdfAndBuildIndex(file);
      if (!isMountedRef.current) return;  // Check mount status after async
      
      const saveResult = storage.savePdfIndex(result.document);
      if (!isMountedRef.current) return;
      
      setPdfIndexSummary(formatPdfIndexSummary(result.document));
      
      if (saveResult.quotaExceeded) {
        setPdfIndexStatus('warning');
        setPdfIndexError(
          `Warning: PDF index is too large for LocalStorage (${(JSON.stringify(result.document).length / 1024 / 1024).toFixed(1)} MB). ` +
          'The index is loaded in memory and will work for this session, but will be lost on page refresh. ' +
          'Consider reducing PDF file sizes or number of documents.'
        );
      } else {
        setPdfIndexStatus('ready');
      }

      // Log upload event
      const uploadEvent: InteractionEvent = {
        id: createEventId('pdf-index', 'upload'),
        sessionId: storage.getActiveSessionId(),
        learnerId: 'system',
        timestamp: Date.now(),
        eventType: 'pdf_index_uploaded',
        problemId: 'pdf-index',
        inputs: {
          filename: file.name,
          file_size: file.size
        },
        outputs: {
          pdf_index_id: result.document.indexId,
          pdf_schema_version: result.document.schemaVersion,
          pdf_embedding_model_id: result.document.embeddingModelId,
          pdf_chunker_version: result.document.chunkerVersion,
          pdf_doc_count: result.document.docCount,
          pdf_chunk_count: result.document.chunkCount
        }
      };
      storage.saveInteraction(uploadEvent);
      if (isMountedRef.current) {
        setInteractions((previous) => [...previous, uploadEvent]);
      }

      if (isMountedRef.current) {
        loadData();
      }
    } catch (error) {
      if (isMountedRef.current) {
        resetPdfIndexState('error', (error as Error).message || 'Failed to upload and process PDF.');
      }
    }

    event.target.value = '';
  };

  // Analytics
  const scopedInteractions = useMemo(() => {
    const learnerIds = new Set(profiles.map((profile) => profile.id));
    return filterInteractionsByLearners(interactions, learnerIds);
  }, [interactions, profiles]);

  const filteredInteractions = useMemo(() => {
    const baseFiltered = selectedLearner === 'all'
      ? scopedInteractions
      : scopedInteractions.filter(i => i.learnerId === selectedLearner);
    return getFilteredByTimeRange(baseFiltered);
  }, [scopedInteractions, selectedLearner, getFilteredByTimeRange]);

  const selectedProfiles = useMemo(() => (
    selectedLearner === 'all'
      ? profiles
      : profiles.filter((profile) => profile.id === selectedLearner)
  ), [profiles, selectedLearner]);

  // Memoized error analysis calculations
  const errorsByType = useMemo(() => 
    filteredInteractions
      .filter(i => i.eventType === 'error' && i.errorSubtypeId)
      .reduce((acc, i) => {
        const type = i.errorSubtypeId!;
        acc[type] = (acc[type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
    [filteredInteractions]
  );

  const errorChartData = useMemo(() => 
    Object.entries(errorsByType).map(([name, count]) => ({
      name: name.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
      count,
      fullName: name
    })),
    [errorsByType]
  );

  const interactionsByType = useMemo(() => 
    filteredInteractions.reduce((acc, i) => {
      acc[i.eventType] = (acc[i.eventType] || 0) + 1;
      return acc;
    }, {} as Record<string, number>),
    [filteredInteractions]
  );

  const errorCount = useMemo(
    () => countInteractionsByType(filteredInteractions, 'error'),
    [filteredInteractions]
  );
  const hintCount = useMemo(
    () => countInteractionsByType(filteredInteractions, 'hint_view'),
    [filteredInteractions]
  );

  const interactionChartData = useMemo(() => 
    Object.entries(interactionsByType).map(([name, count]) => ({
      name: name.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
      count,
      type: name
    })),
    [interactionsByType]
  );

  // Pie chart data for event distribution
  const eventDistributionData = useMemo(() => {
    const data = Object.entries(interactionsByType)
      .map(([name, value]) => ({
        name: name.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
        value,
        type: name
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);
    
    const colors = [
      CHART_COLORS.primary,
      CHART_COLORS.secondary,
      CHART_COLORS.success,
      CHART_COLORS.warning,
      CHART_COLORS.error,
      CHART_COLORS.info
    ];
    
    return data.map((item, idx) => ({ ...item, color: colors[idx % colors.length] }));
  }, [interactionsByType]);

  // Strategy comparison
  const comparisonData = useMemo(() => {
    const strategyComparison = selectedProfiles.reduce((acc, profile) => {
      const learnerInteractions = filteredInteractions.filter(i => i.learnerId === profile.id);
      const errorCount = learnerInteractions.filter(i => i.eventType === 'error').length;
      const hintCount = learnerInteractions.filter(i => i.eventType === 'hint_view').length;
      const successCount = learnerInteractions.filter(i => i.eventType === 'execution' && i.successful).length;
      const escalationCount = learnerInteractions.filter(i => i.eventType === 'explanation_view').length;
      const unitsAddedCount = learnerInteractions.filter(i => i.eventType === 'textbook_add').length;
      const unitUpdateCount = learnerInteractions.filter(i => i.eventType === 'textbook_update').length;

      if (!acc[profile.currentStrategy]) {
        acc[profile.currentStrategy] = {
          strategy: profile.currentStrategy,
          totalErrors: 0,
          totalHints: 0,
          totalSuccess: 0,
          totalEscalations: 0,
          totalUnitsAdded: 0,
          totalUnitUpdates: 0,
          learnerCount: 0
        };
      }

      acc[profile.currentStrategy].totalErrors += errorCount;
      acc[profile.currentStrategy].totalHints += hintCount;
      acc[profile.currentStrategy].totalSuccess += successCount;
      acc[profile.currentStrategy].totalEscalations += escalationCount;
      acc[profile.currentStrategy].totalUnitsAdded += unitsAddedCount;
      acc[profile.currentStrategy].totalUnitUpdates += unitUpdateCount;
      acc[profile.currentStrategy].learnerCount += 1;

      return acc;
    }, {} as Record<string, StrategyComparison>);

    const safeAverage = (total: number, count: number, digits = 1) => (
      count > 0 ? (total / count).toFixed(digits) : (0).toFixed(digits)
    );
    const comparisonData = Object.values(strategyComparison).map((s): ComparisonRow => ({
      strategy: s.strategy.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
      avgErrors: Number(safeAverage(s.totalErrors, s.learnerCount)),
      avgHints: Number(safeAverage(s.totalHints, s.learnerCount)),
      avgSuccess: Number(safeAverage(s.totalSuccess, s.learnerCount)),
      avgEscalations: Number(safeAverage(s.totalEscalations, s.learnerCount)),
      avgUnitsAdded: Number(safeAverage(s.totalUnitsAdded, s.learnerCount)),
      avgDedupRate: s.totalUnitsAdded + s.totalUnitUpdates > 0
        ? (s.totalUnitUpdates / (s.totalUnitsAdded + s.totalUnitUpdates)).toFixed(2)
        : '0.00'
    }));
  }, [selectedProfiles, filteredInteractions]);

  // Memoized timeline data calculation
  const timelineChartData = useMemo(() => {
    const sortedTimelineInteractions = filteredInteractions
      .slice()
      .sort((a, b) => a.timestamp - b.timestamp);
    const timelineStartTimestamp = sortedTimelineInteractions[0]?.timestamp ?? 0;
    const timelineData = sortedTimelineInteractions.reduce((acc, interaction) => {
      const minute = Math.floor((interaction.timestamp - timelineStartTimestamp) / 60000);
      if (!acc[minute]) {
        acc[minute] = { minute, events: 0, errors: 0, hints: 0 };
      }
      acc[minute].events += 1;
      if (interaction.eventType === 'error') acc[minute].errors += 1;
      if (interaction.eventType === 'hint_view') acc[minute].hints += 1;
      return acc;
    }, {} as Record<number, TimelineDataPoint>);

    return Object.values(timelineData).sort((a, b) => a.minute - b.minute);
  }, [filteredInteractions]);
  const traceProblemOptions = useMemo(() => {
    if (!selectedTraceLearner) return [];
    return Array.from(new Set(
      scopedInteractions
        .filter((interaction) => interaction.learnerId === selectedTraceLearner)
        .map((interaction) => interaction.problemId)
        .filter(Boolean)
    ));
  }, [scopedInteractions, selectedTraceLearner]);

  useEffect(() => {
    if (
      selectedTraceProblem !== 'all' &&
      selectedTraceProblem &&
      !traceProblemOptions.includes(selectedTraceProblem)
    ) {
      setSelectedTraceProblem('all');
    }
  }, [selectedTraceProblem, traceProblemOptions]);

  const selectedTraceProfile = useMemo(
    () => profiles.find((profile) => profile.id === selectedTraceLearner),
    [profiles, selectedTraceLearner]
  );

  const traceSlice = useMemo(() => {
    if (!selectedTraceLearner) return [];
    return storage.getTraceSlice({
      learnerId: selectedTraceLearner,
      problemId: selectedTraceProblem === 'all' ? undefined : selectedTraceProblem,
      limit: Number(traceWindow)
    });
  }, [selectedTraceLearner, selectedTraceProblem, traceWindow, interactions, replayNonce]);

  const replayPolicyTrace = useMemo(
    () => orchestrator.getPolicyReplayTrace(traceSlice),
    [traceSlice]
  );

  const replayDecisions = useMemo<ReplayDecisionPoint[]>(() => {
    if (!selectedTraceProfile || replayPolicyTrace.length === 0) return [];
    return orchestrator.replayDecisionTrace(
      selectedTraceProfile,
      replayPolicyTrace,
      selectedReplayStrategy,
      {
        autoEscalationMode: selectedAutoEscalationMode
      }
    );
  }, [selectedTraceProfile, replayPolicyTrace, selectedReplayStrategy, selectedAutoEscalationMode]);

  const hintOnlyDecisions = useMemo<ReplayDecisionPoint[]>(() => {
    if (!selectedTraceProfile || replayPolicyTrace.length === 0) return [];
    return orchestrator.replayDecisionTrace(
      selectedTraceProfile,
      replayPolicyTrace,
      'hint-only',
      {
        autoEscalationMode: selectedAutoEscalationMode
      }
    );
  }, [selectedTraceProfile, replayPolicyTrace, selectedAutoEscalationMode]);

  const hintOnlyByIndex = useMemo(() => {
    return hintOnlyDecisions.reduce((acc, point) => {
      acc[point.index] = point;
      return acc;
    }, {} as Record<number, ReplayDecisionPoint>);
  }, [hintOnlyDecisions]);

  const changedDecisionCount = replayDecisions.reduce((count, point) => {
    const baseline = hintOnlyByIndex[point.index];
    return baseline && baseline.decision !== point.decision ? count + 1 : count;
  }, 0);
  const replayPolicyVersion = replayDecisions[0]?.policyVersion || 'n/a';
  const replayPolicySemanticsVersion = replayDecisions[0]?.policySemanticsVersion || orchestrator.getPolicySemanticsVersion();

  const activeThresholds = orchestrator.getThresholds(selectedReplayStrategy);
  const traceStartTime = replayPolicyTrace[0]?.timestamp;

  // Week 5: Adaptive Personalization Analytics
  // Week 6: Rich Research Dashboard Metrics
  const researchMetrics = useMemo<ResearchMetrics>(() => {
    const clusters = profiles.length > 0 
      ? clusterLearners(profiles, filteredInteractions, 3)
      : [];
    
    const errorTransitions = buildErrorTransitionStats(filteredInteractions);
    
    return {
      clusters,
      errorTransitions,
      selectedMasteryLearner: selectedMasteryLearner || (profiles[0]?.id ?? '')
    };
  }, [profiles, filteredInteractions, selectedMasteryLearner]);

  useEffect(() => {
    if (!selectedMasteryLearner && profiles.length > 0) {
      setSelectedMasteryLearner(profiles[0].id);
    }
  }, [profiles, selectedMasteryLearner]);

  const week5Analytics = useMemo(() => {
    // Filter Week 5 event types (including Component 10: Reinforcement)
    const week5Events = filteredInteractions.filter(i =>
      ['condition_assigned', 'profile_assigned', 'escalation_triggered', 'profile_adjusted',
       'bandit_arm_selected', 'bandit_reward_observed', 'bandit_updated',
       'hdi_calculated', 'hdi_trajectory_updated', 'dependency_intervention_triggered',
       // Component 10: Knowledge Consolidation events
       'reinforcement_scheduled', 'reinforcement_prompt_shown', 'reinforcement_response',
       // Week 6: Session Configuration events
       'session_created',
       // Knowledge-Structure Layer: Prerequisite violations
       'prerequisite_violation_detected'].includes(i.eventType)
    );
    
    // Knowledge-Structure Layer: Prerequisite Violation Analytics
    const violationEvents = filteredInteractions.filter(
      i => i.eventType === 'prerequisite_violation_detected'
    );
    
    const violationStats = {
      total: violationEvents.length,
      byConcept: {} as Record<string, number>,
      byMissingPrerequisite: {} as Record<string, number>,
      bySeverity: { low: 0, medium: 0, high: 0 } as Record<'low' | 'medium' | 'high', number>,
      recent: violationEvents.slice(-10).reverse().map(e => ({
        conceptAttempted: e.metadata?.conceptAttempted as string || e.conceptIds?.[0] || 'unknown',
        missingPrerequisites: (e.metadata?.missingPrerequisites as string[]) || [],
        severity: (e.metadata?.severity as 'low' | 'medium' | 'high') || 'low',
        timestamp: e.timestamp,
        learnerId: e.learnerId
      }))
    };
    
    violationEvents.forEach(e => {
      const conceptId = e.metadata?.conceptAttempted as string || e.conceptIds?.[0] || 'unknown';
      const severity = (e.metadata?.severity as 'low' | 'medium' | 'high') || 'low';
      const missing = (e.metadata?.missingPrerequisites as string[]) || [];
      
      violationStats.byConcept[conceptId] = (violationStats.byConcept[conceptId] || 0) + 1;
      violationStats.bySeverity[severity]++;
      
      missing.forEach(prereq => {
        violationStats.byMissingPrerequisite[prereq] = 
          (violationStats.byMissingPrerequisite[prereq] || 0) + 1;
      });
    });

    // Week 6: Condition Statistics
    // condition_assigned is the canonical session-init event; fall back to profile_assigned for legacy traces
    const sessionCreatedEvents = week5Events.filter(
      e => e.eventType === 'condition_assigned' || e.eventType === 'profile_assigned'
    );
    const conditionStats: Record<string, { 
      count: number; 
      learnerIds: string[];
      avgHDI: number;
      hdiValues: number[];
    }> = {};
    
    sessionCreatedEvents.forEach(e => {
      const condition = e.conditionId || 'unknown';
      if (!conditionStats[condition]) {
        conditionStats[condition] = { 
          count: 0, 
          learnerIds: [],
          avgHDI: 0,
          hdiValues: []
        };
      }
      conditionStats[condition].count++;
      if (!conditionStats[condition].learnerIds.includes(e.learnerId)) {
        conditionStats[condition].learnerIds.push(e.learnerId);
      }
    });
    
    // Calculate HDI per condition from hdi_calculated events
    const hdiEvents = week5Events.filter(e => e.eventType === 'hdi_calculated');
    Object.keys(conditionStats).forEach(condition => {
      const conditionLearners = conditionStats[condition].learnerIds;
      const conditionHdiEvents = hdiEvents.filter(e => conditionLearners.includes(e.learnerId));
      const hdiValues = conditionHdiEvents.map(e => e.hdi || (e.payload as { hdi?: number })?.hdi || 0).filter(h => h > 0);
      
      conditionStats[condition].hdiValues = hdiValues;
      conditionStats[condition].avgHDI = hdiValues.length > 0 
        ? hdiValues.reduce((a, b) => a + b, 0) / hdiValues.length 
        : 0;
    });
    
    // Convert to array for display
    const conditionStatsArray = Object.entries(conditionStats).map(([condition, stats]) => ({
      condition,
      sessionCount: stats.count,
      learnerCount: stats.learnerIds.length,
      avgHDI: stats.avgHDI,
      avgHdiDisplay: stats.avgHDI.toFixed(2)
    })).sort((a, b) => b.sessionCount - a.sessionCount);

    // 1. Escalation Profile Distribution
    // condition_assigned is canonical; profile_assigned is legacy compat
    const profileAssignments = week5Events.filter(
      e => e.eventType === 'condition_assigned' || e.eventType === 'profile_assigned'
    );
    const profileCounts: Record<string, number> = {};
    profileAssignments.forEach(e => {
      const profileId = e.conditionId || (e.payload as { profileId?: string })?.profileId || e.profileId || 'unknown';
      const normalizedProfile = profileId.toUpperCase().includes('FAST') ? 'FAST' :
                               profileId.toUpperCase().includes('SLOW') ? 'SLOW' :
                               profileId.toUpperCase().includes('ADAPTIVE') ? 'ADAPTIVE' : 'ADAPTIVE';
      profileCounts[normalizedProfile] = (profileCounts[normalizedProfile] || 0) + 1;
    });
    
    const profileDistributionData: ProfileDistributionData[] = [
      { name: 'FAST', value: profileCounts.FAST || 0, color: CHART_COLORS.error },
      { name: 'SLOW', value: profileCounts.SLOW || 0, color: CHART_COLORS.success },
      { name: 'ADAPTIVE', value: profileCounts.ADAPTIVE || 0, color: CHART_COLORS.primary }
    ].filter(p => p.value > 0);

    // 2. Bandit Performance
    const armSelections = week5Events.filter(e => e.eventType === 'bandit_arm_selected');
    const armRewards = week5Events.filter(e => e.eventType === 'bandit_reward_observed');
    
    // Calculate arm selection frequency
    const armSelectionCounts: Record<string, number> = {};
    armSelections.forEach(e => {
      const armId = (e.payload as { armId?: string })?.armId || e.selectedArm || 'unknown';
      armSelectionCounts[armId] = (armSelectionCounts[armId] || 0) + 1;
    });
    
    // Calculate mean rewards per arm
    const armRewardSums: Record<string, number> = {};
    const armRewardCounts: Record<string, number> = {};
    armRewards.forEach(e => {
      const armId = (e.payload as { armId?: string })?.armId || 'unknown';
      const reward = (e.payload as { reward?: { total?: number } })?.reward?.total || e.reward?.total || 0;
      armRewardSums[armId] = (armRewardSums[armId] || 0) + reward;
      armRewardCounts[armId] = (armRewardCounts[armId] || 0) + 1;
    });
    
    const banditArmData: BanditArmData[] = Object.keys(armSelectionCounts).map(armId => ({
      armId,
      selectionCount: armSelectionCounts[armId] || 0,
      meanReward: armRewardCounts[armId] ? (armRewardSums[armId] / armRewardCounts[armId]) : 0
    })).sort((a, b) => b.selectionCount - a.selectionCount);

    // Bandit reward timeline
    let cumulativeReward = 0;
    let rewardCount = 0;
    const banditRewardData: BanditRewardData[] = armRewards
      .sort((a, b) => a.timestamp - b.timestamp)
      .map(e => {
        const reward = (e.payload as { reward?: { total?: number } })?.reward?.total || e.reward?.total || 0;
        cumulativeReward += reward;
        rewardCount++;
        return {
          timestamp: e.timestamp,
          armId: (e.payload as { armId?: string })?.armId || 'unknown',
          reward,
          cumulativeMean: rewardCount > 0 ? cumulativeReward / rewardCount : 0
        };
      });

    // 3. HDI Analytics
    const hdiCalcEvents = week5Events.filter(e => e.eventType === 'hdi_calculated');
    const hdiDataPoints: HDIDataPoint[] = hdiCalcEvents.map(e => ({
      hdi: (e.payload as { hdi?: number })?.hdi ?? e.hdi ?? 0,
      learnerId: e.learnerId,
      timestamp: e.timestamp
    }));
    
    // HDI histogram bins
    const hdiBins = [
      { range: '0-0.2', min: 0, max: 0.2, count: 0 },
      { range: '0.2-0.4', min: 0.2, max: 0.4, count: 0 },
      { range: '0.4-0.6', min: 0.4, max: 0.6, count: 0 },
      { range: '0.6-0.8', min: 0.6, max: 0.8, count: 0 },
      { range: '0.8-1.0', min: 0.8, max: 1.0, count: 0 }
    ];
    
    hdiDataPoints.forEach(point => {
      // Handle edge case: HDI = 1.0 should go into the 0.8-1.0 bin
      const bin = hdiBins.find(b => 
        point.hdi >= b.min && (point.hdi < b.max || (point.hdi === 1.0 && b.max === 1.0))
      );
      if (bin) bin.count++;
    });
    
    // High HDI alerts (> 0.8)
    const highHDIAlerts: HighHDIAlert[] = hdiDataPoints
      .filter(p => p.hdi > 0.8)
      .sort((a, b) => b.hdi - a.hdi)
      .slice(0, 10)
      .map(p => ({
        learnerId: p.learnerId,
        hdi: p.hdi,
        trend: 'stable', // Default, could be enriched with trajectory data
        timestamp: p.timestamp
      }));

    // 4. Profile Effectiveness
    const profileEffectiveness: Record<string, ProfileEffectivenessData> = {};
    
    // Initialize profiles
    Object.keys(profileCounts).forEach(profile => {
      if (profile !== 'UNKNOWN') {
        profileEffectiveness[profile] = {
          profile,
          learnerCount: profileCounts[profile] || 0,
          avgSuccessRate: 0,
          avgEscalations: 0,
          totalInteractions: 0
        };
      }
    });
    
    // Calculate effectiveness metrics per learner
    const learnersByProfile: Record<string, string[]> = {};
    profileAssignments.forEach(e => {
      const profileId = (e.payload as { profileId?: string })?.profileId || e.profileId || 'unknown';
      const normalizedProfile = profileId.toUpperCase().includes('FAST') ? 'FAST' :
                               profileId.toUpperCase().includes('SLOW') ? 'SLOW' :
                               profileId.toUpperCase().includes('ADAPTIVE') ? 'ADAPTIVE' : 'ADAPTIVE';
      if (normalizedProfile) {
        if (!learnersByProfile[normalizedProfile]) learnersByProfile[normalizedProfile] = [];
        if (!learnersByProfile[normalizedProfile].includes(e.learnerId)) {
          learnersByProfile[normalizedProfile].push(e.learnerId);
        }
      }
    });
    
    // Calculate metrics for each profile
    Object.entries(learnersByProfile).forEach(([profile, learnerIds]) => {
      let totalSuccess = 0;
      let totalEscalations = 0;
      let totalInteractions = 0;
      
      learnerIds.forEach(learnerId => {
        const learnerEvents = filteredInteractions.filter(i => i.learnerId === learnerId);
        const successes = learnerEvents.filter(i => i.eventType === 'execution' && i.successful).length;
        const executions = learnerEvents.filter(i => i.eventType === 'execution').length;
        const escalations = learnerEvents.filter(i => i.eventType === 'explanation_view').length;
        
        totalSuccess += executions > 0 ? (successes / executions) : 0;
        totalEscalations += escalations;
        totalInteractions += learnerEvents.length;
      });
      
      if (profileEffectiveness[profile]) {
        profileEffectiveness[profile].avgSuccessRate = learnerIds.length > 0 
          ? (totalSuccess / learnerIds.length) * 100 
          : 0;
        profileEffectiveness[profile].avgEscalations = learnerIds.length > 0
          ? totalEscalations / learnerIds.length
          : 0;
        profileEffectiveness[profile].totalInteractions = totalInteractions;
      }
    });

    // Sort profile effectiveness by success rate (highest first)
    const sortedProfileEffectiveness = Object.values(profileEffectiveness)
      .sort((a, b) => b.avgSuccessRate - a.avgSuccessRate);

    // Component 10: Reinforcement Analytics
    const reinforcementScheduled = week5Events.filter(e => e.eventType === 'reinforcement_scheduled');
    const reinforcementShown = week5Events.filter(e => e.eventType === 'reinforcement_prompt_shown');
    const reinforcementResponses = week5Events.filter(e => e.eventType === 'reinforcement_response');
    
    const reinforcementStats: ReinforcementStats = {
      totalScheduled: reinforcementScheduled.length,
      totalShown: reinforcementShown.length,
      totalResponded: reinforcementResponses.length,
      responseRate: reinforcementShown.length > 0 
        ? reinforcementResponses.length / reinforcementShown.length 
        : 0,
      averageRetentionScore: reinforcementResponses.length > 0
        ? reinforcementResponses.filter(r => r.isCorrect).length / reinforcementResponses.length
        : 0
    };
    
    // Reinforcement timeline data
    const reinforcementTimeline: ReinforcementDataPoint[] = week5Events
      .filter(e => e.eventType === 'reinforcement_scheduled' || e.eventType === 'reinforcement_prompt_shown' || e.eventType === 'reinforcement_response')
      .map(e => ({
        timestamp: e.timestamp,
        learnerId: e.learnerId,
        eventType: (e.eventType === 'reinforcement_scheduled' ? 'scheduled' :
                    e.eventType === 'reinforcement_prompt_shown' ? 'shown' : 'response') as 'scheduled' | 'shown' | 'response',
        retentionLevel: e.response || undefined,
        isCorrect: e.isCorrect || undefined
      }))
      .sort((a, b) => a.timestamp - b.timestamp);

    // RQS: Self-Explanation Quality Analytics
    const qualityEvents = filteredInteractions.filter(i => 
      i.metadata?.selfExplanationQuality !== undefined
    );
    
    let qualityStats: {
      averageQuality: number;
      totalScored: number;
      distribution: { excellent: number; good: number; needsWork: number };
      dimensionAverages: {
        paraphrase: number;
        length: number;
        conceptKeywords: number;
        exampleInclusion: number;
        structuralCompleteness: number;
      };
    } | null = null;
    
    if (qualityEvents.length > 0) {
      const scores = qualityEvents.map(e => e.metadata!.selfExplanationQuality as number);
      const dimensions = qualityEvents
        .map(e => e.metadata!.qualityDimensions as ReflectionQualityScore['dimensions'])
        .filter((d): d is ReflectionQualityScore['dimensions'] => !!d);
      
      qualityStats = {
        averageQuality: Math.round(scores.reduce((a, b) => a + b, 0) / scores.length),
        totalScored: qualityEvents.length,
        distribution: {
          excellent: scores.filter(s => s >= 80).length,
          good: scores.filter(s => s >= 60 && s < 80).length,
          needsWork: scores.filter(s => s < 60).length
        },
        dimensionAverages: dimensions.length > 0 ? {
          paraphrase: Math.round(dimensions.reduce((a, d) => a + d.paraphrase, 0) / dimensions.length),
          length: Math.round(dimensions.reduce((a, d) => a + d.length, 0) / dimensions.length),
          conceptKeywords: Math.round(dimensions.reduce((a, d) => a + d.conceptKeywords, 0) / dimensions.length),
          exampleInclusion: Math.round(dimensions.reduce((a, d) => a + d.exampleInclusion, 0) / dimensions.length),
          structuralCompleteness: Math.round(dimensions.reduce((a, d) => a + d.structuralCompleteness, 0) / dimensions.length)
        } : { paraphrase: 0, length: 0, conceptKeywords: 0, exampleInclusion: 0, structuralCompleteness: 0 }
      };
    }

    return {
      week5Events,
      profileDistributionData,
      banditArmData,
      banditRewardData,
      hdiBins,
      highHDIAlerts,
      profileEffectivenessData: sortedProfileEffectiveness,
      reinforcementStats,
      reinforcementTimeline,
      conditionStats: conditionStatsArray,
      qualityStats,
      violationStats
    };
  }, [filteredInteractions]);

  // Helper to format labels consistently (extracted to reduce duplication)
  const formatLabel = (str: string, separator: '_' | '-' = '_') => 
    str.replace(new RegExp(separator, 'g'), ' ');
  
  const formatThreshold = (value: number) => (Number.isFinite(value) ? String(value) : 'never');
  const formatDecision = (decision: ReplayDecisionPoint['decision']) => formatLabel(decision, '_');
  const formatEventType = (eventType: InteractionEvent['eventType']) => formatLabel(eventType, '_');
  const formatSubtype = (subtype?: string) => subtype ? formatLabel(subtype, '-') : '-';

  const handleReplay = () => {
    setIsReplaying(true);
    setReplayNonce((prev) => prev + 1);
    window.setTimeout(() => setIsReplaying(false), 150);
  };

  const pdfIndexStatusLabel = (() => {
    switch (pdfIndexStatus) {
      case 'loading':
        return 'loading';
      case 'ready':
        return 'ready';
      case 'warning':
        return 'ready (in-memory only)';
      case 'error':
        return 'error';
      default:
        return 'idle';
    }
  })();

  if (isLoading) {
    return (
      <div className="space-y-6 p-6">
        <Skeleton className="h-32" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <TooltipProvider delayDuration={100}>
      <div className="space-y-6">
        <Card className="p-6">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-4">
            <div>
              <h2 className="text-2xl font-bold flex items-center gap-2">
                <BarChart3 className="size-6 text-blue-600" />
                Research Dashboard
              </h2>
              <p className="text-gray-600 mt-1">
                Analyze interaction traces and compare adaptive strategies
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    onClick={handleExport} 
                    variant="outline" 
                    size="sm"
                    disabled={isExporting}
                  >
                    {isExporting ? (
                      <Loader2 className="size-4 mr-2 animate-spin" />
                    ) : (
                      <Download className="size-4 mr-2" />
                    )}
                    {isExporting ? `Exporting ${exportProgress}%` : 'Export Data'}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Export all learning data as JSON</p>
                </TooltipContent>
              </Tooltip>
              
              <Tooltip>
                <TooltipTrigger asChild>
                  <label>
                    <input
                      type="file"
                      accept=".json"
                      onChange={handleImport}
                      className="hidden"
                      disabled={isImporting}
                    />
                    <Button 
                      variant="outline" 
                      size="sm" 
                      asChild
                      disabled={isImporting}
                    >
                      <span>
                        {isImporting ? (
                          <Loader2 className="size-4 mr-2 animate-spin" />
                        ) : (
                          <FileUp className="size-4 mr-2" />
                        )}
                        {isImporting ? 'Importing...' : 'Import Data'}
                      </span>
                    </Button>
                  </label>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Import learning data from JSON file</p>
                </TooltipContent>
              </Tooltip>
              
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    onClick={loadData} 
                    variant="outline" 
                    size="sm"
                    disabled={isImporting || isExporting}
                    aria-label="Refresh research data"
                  >
                    <RefreshCw className="size-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Refresh data</p>
                </TooltipContent>
              </Tooltip>
            </div>
          </div>
          
          {/* Export scope and status */}
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <label className="flex items-center gap-2 px-2 text-sm text-gray-600 cursor-pointer">
                <input
                  type="checkbox"
                  checked={exportAllHistory}
                  onChange={(e) => setExportAllHistory(e.target.checked)}
                  className="rounded border-gray-300"
                />
                Include all history
              </label>
              
              {/* Time range selector */}
              <div className="flex items-center gap-2">
                <Calendar className="size-4 text-gray-400" />
                <Select value={timeRange} onValueChange={setTimeRange}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TIME_RANGES.map(range => (
                      <SelectItem key={range.value} value={range.value}>
                        {range.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <p
              className="text-xs text-gray-600"
              data-testid="export-scope-label"
            >
              Export scope: {exportAllHistory ? 'all history' : 'active session (default)'}.
              {' '}Time range filters analytics views only.
            </p>
            
            {/* Import status messages */}
            {importError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
                <AlertCircle className="size-4 text-red-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-red-800">Import Error</p>
                  <p className="text-sm text-red-700">{importError}</p>
                </div>
              </div>
            )}
            
            {importSuccess && (
              <div className="p-3 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2">
                <CheckCircle2 className="size-4 text-green-600" />
                <p className="text-sm text-green-800">Data imported successfully!</p>
              </div>
            )}
          </div>

          <div className="mb-4 grid grid-cols-1 md:grid-cols-3 gap-3">
            <Card className="p-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">
                    {hostedMode ? '🌐 Hosted Mode' : isDemoMode() ? '🎓 Demo Mode' : 'LLM Health Check'}
                  </p>
                  <p className="text-xs text-gray-500">
                    {hostedMode ? 'Deterministic fallback active' : isDemoMode() ? DEMO_MODE_VERSION : `Target model: ${OLLAMA_MODEL}`}
                  </p>
                  <p className={`text-xs ${llmHealthOk === null ? 'text-gray-600' : llmHealthOk ? 'text-emerald-700' : 'text-red-700'}`}>
                    {hostedMode ? getHostedModeMessage() : isDemoMode() ? getDemoModeMessage() : llmHealthMessage}
                  </p>
                </div>
                {!hostedMode && !isDemoMode() && (
                  <Button size="sm" variant="outline" onClick={handleLLMHealthCheck} disabled={isCheckingLLM}>
                    {isCheckingLLM ? 'Checking...' : 'Test LLM'}
                  </Button>
                )}
              </div>
            </Card>
            <Card className="p-3">
              <label className="flex items-center justify-between gap-2 text-sm">
                <div>
                  <p className="font-medium">Policy Replay Mode</p>
                  <p className="text-xs text-gray-600">Disables live LLM calls and uses cache/fallback only.</p>
                </div>
                <input
                  type="checkbox"
                  checked={policyReplayMode}
                  onChange={(event) => setPolicyReplayMode(event.target.checked)}
                />
              </label>
            </Card>
            <Card className="p-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">PDF Retrieval Index</p>
                  <p className="text-xs text-gray-600" data-testid="pdf-index-summary">{pdfIndexSummary}</p>
                  <p className="text-[11px] text-gray-500" data-testid="pdf-index-status">
                    Status: {pdfIndexStatusLabel}
                  </p>
                  {pdfIndexError && (
                    <div 
                      className={`text-[11px] mt-2 p-2 rounded border ${
                        pdfIndexStatus === 'warning'
                          ? 'text-amber-800 bg-amber-50 border-amber-200'
                          : 'text-red-700 bg-red-50 border-red-200'
                      }`}
                      data-testid="pdf-index-error"
                    >
                      <PdfIndexErrorDisplay error={pdfIndexError} />
                    </div>
                  )}
                  {hostedMode && (
                    <p className="text-[11px] text-amber-600 mt-2">
                      PDF upload/build unavailable in hosted mode
                    </p>
                  )}
                </div>
                {!hostedMode && (
                  <div className="flex flex-col gap-2">
                    <input
                      type="file"
                      accept=".pdf"
                      onChange={handlePdfUpload}
                      id="pdf-upload-input"
                      className="hidden"
                      disabled={pdfIndexStatus === 'loading'}
                    />
                    <label htmlFor="pdf-upload-input">
                      <Button
                        variant="outline"
                        size="sm"
                        asChild
                        disabled={pdfIndexStatus === 'loading'}
                      >
                        <span className="cursor-pointer">
                          <FileUp className="size-3 mr-1" />
                          {pdfIndexStatus === 'loading' ? 'Processing...' : 'Upload PDF'}
                        </span>
                      </Button>
                    </label>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleLoadPdfIndex}
                      data-testid="pdf-index-load-button"
                      disabled={pdfIndexStatus === 'loading'}
                      className="text-xs"
                    >
                      Load from Disk
                    </Button>
                  </div>
                )}
              </div>
            </Card>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <Users className="size-4 text-blue-600" />
                <span className="text-sm font-medium text-gray-600">Learners</span>
              </div>
              <p className="text-3xl font-bold">{profiles.length}</p>
            </Card>
            <Card className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <Activity className="size-4 text-green-600" />
                <span className="text-sm font-medium text-gray-600">Interactions</span>
              </div>
              <p className="text-3xl font-bold">{filteredInteractions.length}</p>
              <p className="text-xs text-gray-500 mt-1">
                {timeRange !== 'all' ? TIME_RANGES.find(r => r.value === timeRange)?.label : 'all time'}
              </p>
            </Card>
            <Card className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <AlertCircle className="size-4 text-red-600" />
                <span className="text-sm font-medium text-gray-600">Errors</span>
              </div>
              <p className="text-3xl font-bold">
                {errorCount}
              </p>
            </Card>
            <Card className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <Lightbulb className="size-4 text-yellow-600" />
                <span className="text-sm font-medium text-gray-600">Hints</span>
              </div>
              <p className="text-3xl font-bold">
                {hintCount}
              </p>
            </Card>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <h3 className="font-semibold">Filter by Learner</h3>
            <div className="flex items-center gap-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Clock className="size-4 text-gray-400" />
                </TooltipTrigger>
                <TooltipContent>
                  <p>Time range filter applied to all analytics</p>
                </TooltipContent>
              </Tooltip>
              <span className="text-sm text-gray-500">{TIME_RANGES.find(r => r.value === timeRange)?.label}</span>
            </div>
            <Select value={selectedLearner} onValueChange={setSelectedLearner}>
              <SelectTrigger className="w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Learners</SelectItem>
                {profiles.map(p => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name} ({p.currentStrategy})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </Card>

        {profiles.length === 0 && (
          <Card className="p-4 border-amber-200 bg-amber-50/60">
            <p className="text-sm text-amber-900 font-medium">No scoped research data yet</p>
            <p className="text-xs text-amber-800 mt-1">
              Ask learners to complete at least one practice attempt, then click Refresh Data.
              Analytics are limited to learner records currently scoped to this instructor.
            </p>
          </Card>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="flex flex-wrap h-auto">
            <TabsTrigger value="interactions" className="flex items-center gap-1.5">
              <Activity className="size-4" />
              Interactions
            </TabsTrigger>
            <TabsTrigger value="errors" className="flex items-center gap-1.5">
              <AlertCircle className="size-4" />
              Errors
            </TabsTrigger>
            <TabsTrigger value="comparison" className="flex items-center gap-1.5">
              <TrendingUp className="size-4" />
              Strategies
            </TabsTrigger>
            <TabsTrigger value="distribution" className="flex items-center gap-1.5">
              <PieChartIcon className="size-4" />
              Distribution
            </TabsTrigger>
            <TabsTrigger value="timeline" className="flex items-center gap-1.5">
              <Clock className="size-4" />
              Timeline
            </TabsTrigger>
            <TabsTrigger value="trace" data-testid="instructor-trace-tab" className="flex items-center gap-1.5">
              <BarChart3 className="size-4" />
              Trace View
            </TabsTrigger>
            <TabsTrigger value="week5" className="flex items-center gap-1.5">
              <Sparkles className="size-4" />
              Week 5: Adaptive
            </TabsTrigger>
            <TabsTrigger value="reinforcement" className="flex items-center gap-1.5">
              <BookOpen className="size-4" />
              Knowledge Consolidation
            </TabsTrigger>
            <TabsTrigger value="clustering" className="flex items-center gap-1.5">
              <Users className="size-4" />
              Clustering
            </TabsTrigger>
            <TabsTrigger value="heatmap" className="flex items-center gap-1.5">
              <BarChart3 className="size-4" />
              Heatmap
            </TabsTrigger>
            <TabsTrigger value="transitions" className="flex items-center gap-1.5">
              <TrendingUp className="size-4" />
              Error Transitions
            </TabsTrigger>
            <TabsTrigger value="mastery" className="flex items-center gap-1.5">
              <Target className="size-4" />
              Mastery Timeline
            </TabsTrigger>
          </TabsList>

          <TabsContent value="interactions" className="space-y-4">
            <Card className="p-6">
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <Activity className="size-5" />
                Interactions by Type
              </h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={interactionChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis 
                    dataKey="name" 
                    tick={{ fontSize: 12 }}
                    interval={0}
                    angle={-45}
                    textAnchor="end"
                    height={80}
                  />
                  <YAxis tick={{ fontSize: 12 }} />
                  <RechartsTooltip 
                    contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb' }}
                  />
                  <Legend />
                  <Bar dataKey="count" fill={CHART_COLORS.primary} name="Count" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Card>
          </TabsContent>

          <TabsContent value="errors" className="space-y-4">
            <Card className="p-6">
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <AlertCircle className="size-5" />
                Errors by Subtype
              </h3>
              {errorChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={errorChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis 
                      dataKey="name" 
                      tick={{ fontSize: 12 }}
                      interval={0}
                      angle={-45}
                      textAnchor="end"
                      height={80}
                    />
                    <YAxis tick={{ fontSize: 12 }} />
                    <RechartsTooltip 
                      contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb' }}
                    />
                    <Legend />
                    <Bar dataKey="count" fill={CHART_COLORS.error} name="Error Count" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="text-center py-12 text-gray-500">
                  <AlertCircle className="size-12 mx-auto mb-3 text-gray-300" />
                  <p>No error data available for the selected time range</p>
                </div>
              )}
            </Card>
          </TabsContent>

          <TabsContent value="comparison" className="space-y-4">
            <Card className="p-6">
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <TrendingUp className="size-5" />
                Strategy Comparison
              </h3>
              <div className="mb-4 space-y-2">
                {experimentConditions.map(cond => (
                  <div key={cond.id} className="p-3 border rounded-lg bg-gray-50/50">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge>{cond.name}</Badge>
                      <span className="text-sm font-medium">{cond.description}</span>
                    </div>
                  </div>
                ))}
              </div>
              {comparisonData.length > 0 ? (
                <>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={comparisonData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis dataKey="strategy" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 12 }} />
                      <RechartsTooltip 
                        contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb' }}
                      />
                      <Legend />
                      <Bar dataKey="avgErrors" fill={CHART_COLORS.error} name="Avg Errors" radius={[2, 2, 0, 0]} />
                      <Bar dataKey="avgHints" fill={CHART_COLORS.warning} name="Avg Hints" radius={[2, 2, 0, 0]} />
                      <Bar dataKey="avgSuccess" fill={CHART_COLORS.success} name="Avg Success" radius={[2, 2, 0, 0]} />
                      <Bar dataKey="avgEscalations" fill={CHART_COLORS.secondary} name="Avg Escalations" radius={[2, 2, 0, 0]} />
                      <Bar dataKey="avgUnitsAdded" fill={CHART_COLORS.info} name="Avg Units Added" radius={[2, 2, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                  <div className="mt-4 text-sm text-gray-700 space-y-1">
                    {comparisonData.map((row: ComparisonRow) => (
                      <p key={row.strategy}>
                        <span className="font-medium">{row.strategy}:</span> dedup rate {row.avgDedupRate}
                      </p>
                    ))}
                  </div>
                </>
              ) : (
                <p className="text-gray-500 text-center py-8">
                  No comparison data available. Add more learners with different strategies.
                </p>
              )}
            </Card>
          </TabsContent>

          <TabsContent value="distribution" className="space-y-4">
            <Card className="p-6">
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <PieChartIcon className="size-5" />
                Event Distribution
              </h3>
              {eventDistributionData.length > 0 ? (
                <div className="flex flex-col md:flex-row items-center gap-6">
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={eventDistributionData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={100}
                        paddingAngle={2}
                        dataKey="value"
                        label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                      >
                        {eventDistributionData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <RechartsTooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="w-full md:w-1/3 space-y-2">
                    {eventDistributionData.map((item) => (
                      <div key={item.name} className="flex items-center justify-between p-2 rounded bg-gray-50">
                        <div className="flex items-center gap-2">
                          <span className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                          <span className="text-sm">{item.name}</span>
                        </div>
                        <Badge variant="outline">{item.value}</Badge>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-center py-12 text-gray-500">
                  <PieChartIcon className="size-12 mx-auto mb-3 text-gray-300" />
                  <p>No distribution data available</p>
                </div>
              )}
            </Card>
          </TabsContent>

          <TabsContent value="timeline" className="space-y-4">
            <Card className="p-6">
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <Clock className="size-5" />
                Interaction Timeline
              </h3>
              {timelineChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={timelineChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis 
                      dataKey="minute" 
                      label={{ value: 'Minutes from start', position: 'insideBottom', offset: -5 }}
                      tick={{ fontSize: 12 }}
                    />
                    <YAxis tick={{ fontSize: 12 }} />
                    <RechartsTooltip 
                      contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb' }}
                    />
                    <Legend />
                    <Line type="monotone" dataKey="events" stroke={CHART_COLORS.primary} name="Total Events" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="errors" stroke={CHART_COLORS.error} name="Errors" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="hints" stroke={CHART_COLORS.warning} name="Hints" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="text-center py-12 text-gray-500">
                  <Clock className="size-12 mx-auto mb-3 text-gray-300" />
                  <p>No timeline data available for the selected time range</p>
                </div>
              )}
            </Card>
          </TabsContent>

          <TabsContent value="trace" className="space-y-4">
            <Card className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold flex items-center gap-2">
                  <BarChart3 className="size-5" />
                  Trace Replay With Policy Knob
                </h3>
                <Button
                  onClick={handleReplay}
                  size="sm"
                  variant="outline"
                  disabled={!selectedTraceLearner || isReplaying}
                  data-testid="trace-replay-button"
                >
                  {isReplaying ? (
                    <Loader2 className="size-4 mr-2 animate-spin" />
                  ) : (
                    <Play className="size-4 mr-2" />
                  )}
                  {isReplaying ? 'Replaying...' : 'Replay Trace Slice'}
                </Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                <div>
                  <p className="text-xs text-gray-500 mb-2">Trace learner</p>
                  <Select value={selectedTraceLearner} onValueChange={setSelectedTraceLearner}>
                    <SelectTrigger data-testid="trace-learner-select">
                      <SelectValue placeholder="Select learner" />
                    </SelectTrigger>
                    <SelectContent>
                      {profiles.map((profile) => (
                        <SelectItem key={profile.id} value={profile.id}>
                          {profile.name} ({profile.currentStrategy})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-2">Trace problem</p>
                  <Select value={selectedTraceProblem} onValueChange={setSelectedTraceProblem}>
                    <SelectTrigger data-testid="trace-problem-select">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All problems</SelectItem>
                      {traceProblemOptions.map((problemId) => (
                        <SelectItem key={problemId} value={problemId}>
                          {problemId}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-2">Policy strategy</p>
                  <Select
                    value={selectedReplayStrategy}
                    onValueChange={(value) => setSelectedReplayStrategy(value as ExperimentCondition['strategy'])}
                  >
                    <SelectTrigger data-testid="trace-policy-strategy-select">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="hint-only">Hint-only baseline</SelectItem>
                      <SelectItem value="adaptive-medium">Adaptive textbook policy</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-2">Window size</p>
                  <Select value={traceWindow} onValueChange={setTraceWindow}>
                    <SelectTrigger data-testid="trace-window-select">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="20">20 events</SelectItem>
                      <SelectItem value="40">40 events</SelectItem>
                      <SelectItem value="80">80 events</SelectItem>
                      <SelectItem value="160">160 events</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-2">Auto escalation mode</p>
                  <Select
                    value={selectedAutoEscalationMode}
                    onValueChange={(value) => setSelectedAutoEscalationMode(value as AutoEscalationMode)}
                  >
                    <SelectTrigger data-testid="trace-auto-escalation-mode-select">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="always-after-hint-threshold">Always after hint threshold</SelectItem>
                      <SelectItem value="threshold-gated">Threshold-gated auto escalation</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="p-4">
                  <p className="text-sm text-gray-600">Escalation threshold</p>
                  <p className="text-2xl font-bold" data-testid="trace-threshold-escalate">
                    {formatThreshold(activeThresholds.escalate)}
                  </p>
                </Card>
                <Card className="p-4">
                  <p className="text-sm text-gray-600">Aggregation threshold</p>
                  <p className="text-2xl font-bold" data-testid="trace-threshold-aggregate">
                    {formatThreshold(activeThresholds.aggregate)}
                  </p>
                </Card>
                <Card className="p-4">
                  <p className="text-sm text-gray-600">Decision points changed vs hint-only</p>
                  <p className="text-2xl font-bold" data-testid="trace-changed-decision-count">
                    {changedDecisionCount}
                  </p>
                </Card>
              </div>
              <p className="text-xs text-gray-500" data-testid="trace-policy-version">
                Replay policy version: <span className="font-mono">{replayPolicyVersion}</span>
              </p>
              <p className="text-xs text-gray-500" data-testid="trace-policy-semantics-version">
                Replay policy semantics: <span className="font-mono">{replayPolicySemanticsVersion}</span> ({selectedAutoEscalationMode})
              </p>

              {replayDecisions.length > 0 ? (
                <div className="overflow-x-auto rounded border">
                  <Table data-testid="trace-events-table">
                    <TableHeader>
                      <TableRow>
                        <TableHead>#</TableHead>
                        <TableHead>t(s)</TableHead>
                        <TableHead>event</TableHead>
                        <TableHead>error subtype</TableHead>
                        <TableHead>context (E/R/H)</TableHead>
                        <TableHead>decision</TableHead>
                        <TableHead>hint-only</TableHead>
                        <TableHead>rule fired</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody data-testid="trace-events-table-body">
                      {replayDecisions.map((point) => {
                        const baseline = hintOnlyByIndex[point.index];
                        const decisionChanged = baseline && baseline.decision !== point.decision;
                        const elapsedSeconds = typeof traceStartTime === 'number'
                          ? Math.max(0, Math.round((point.timestamp - traceStartTime) / 1000))
                          : 0;

                        return (
                          <TableRow
                            key={`${point.eventId || 'event'}-${point.timestamp}-${point.index}`}
                            className={decisionChanged ? 'bg-amber-50/80' : undefined}
                          >
                            <TableCell className="font-mono text-xs">{point.index}</TableCell>
                            <TableCell className="font-mono text-xs">{elapsedSeconds}</TableCell>
                            <TableCell className="whitespace-nowrap">{formatEventType(point.eventType)}</TableCell>
                            <TableCell className="whitespace-nowrap">{formatSubtype(point.errorSubtypeId)}</TableCell>
                            <TableCell className="font-mono text-xs">
                              {point.context.errorCount}/{point.context.retryCount}/{point.context.currentHintLevel}
                            </TableCell>
                            <TableCell>
                              <Badge variant={point.decision === 'show_explanation' ? 'secondary' : 'outline'}>
                                {formatDecision(point.decision)}
                              </Badge>
                            </TableCell>
                            <TableCell className="whitespace-nowrap">{baseline ? formatDecision(baseline.decision) : '-'}</TableCell>
                            <TableCell title={point.reasoning}>
                              <span className="font-mono text-xs">{point.ruleFired}</span>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <p className="text-gray-500 text-center py-8">
                  No trace events for this learner/problem slice.
                </p>
              )}
            </Card>
          </TabsContent>

          <TabsContent value="week5" className="space-y-6">
            {/* Week 5: Adaptive Personalization Tab */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* 1. Escalation Profile Distribution */}
              <Card className="p-6">
                <h3 className="font-semibold mb-4 flex items-center gap-2">
                  <Target className="size-5 text-blue-600" />
                  Escalation Profile Distribution
                </h3>
                {week5Analytics.profileDistributionData.length > 0 ? (
                  <div className="flex flex-col items-center">
                    <ResponsiveContainer width="100%" height={250}>
                      <PieChart>
                        <Pie
                          data={week5Analytics.profileDistributionData}
                          cx="50%"
                          cy="50%"
                          innerRadius={50}
                          outerRadius={80}
                          paddingAngle={3}
                          dataKey="value"
                          label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                        >
                          {week5Analytics.profileDistributionData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <RechartsTooltip />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="w-full mt-4 space-y-2">
                      {week5Analytics.profileDistributionData.map((item) => (
                        <div key={item.name} className="flex items-center justify-between p-2 rounded bg-gray-50">
                          <div className="flex items-center gap-2">
                            <span className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                            <span className="text-sm font-medium">{item.name}</span>
                          </div>
                          <Badge variant="outline">{item.value} learners</Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-12 text-gray-500">
                    <Target className="size-12 mx-auto mb-3 text-gray-300" />
                    <p>No profile assignment data available</p>
                    <p className="text-sm text-gray-400 mt-1">Complete learning sessions to see profile distribution</p>
                  </div>
                )}
              </Card>

              {/* 2. Bandit Performance */}
              <Card className="p-6">
                <h3 className="font-semibold mb-4 flex items-center gap-2">
                  <BrainCircuit className="size-5 text-purple-600" />
                  Bandit Performance
                </h3>
                {week5Analytics.banditArmData.length > 0 ? (
                  <div className="space-y-6">
                    {/* Arm Selection Frequency */}
                    <div>
                      <p className="text-sm text-gray-600 mb-2">Arm Selection Frequency</p>
                      <ResponsiveContainer width="100%" height={150}>
                        <BarChart data={week5Analytics.banditArmData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                          <XAxis dataKey="armId" tick={{ fontSize: 11 }} />
                          <YAxis tick={{ fontSize: 11 }} />
                          <RechartsTooltip 
                            contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb' }}
                          />
                          <Bar dataKey="selectionCount" fill={CHART_COLORS.purple} radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                    
                    {/* Mean Rewards Timeline */}
                    {week5Analytics.banditRewardData.length > 0 && (
                      <div>
                        <p className="text-sm text-gray-600 mb-2">Cumulative Mean Reward</p>
                        <ResponsiveContainer width="100%" height={120}>
                          <LineChart data={week5Analytics.banditRewardData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                            <XAxis 
                              dataKey="timestamp" 
                              tickFormatter={(ts) => new Date(ts).toLocaleTimeString()}
                              tick={{ fontSize: 9 }}
                            />
                            <YAxis tick={{ fontSize: 11 }} domain={[0, 1]} />
                            <RechartsTooltip 
                              contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb' }}
                              labelFormatter={(ts) => new Date(ts).toLocaleString()}
                            />
                            <Line 
                              type="monotone" 
                              dataKey="cumulativeMean" 
                              stroke={CHART_COLORS.success} 
                              strokeWidth={2} 
                              dot={false} 
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-12 text-gray-500">
                    <BrainCircuit className="size-12 mx-auto mb-3 text-gray-300" />
                    <p>No bandit data available</p>
                    <p className="text-sm text-gray-400 mt-1">Bandit selections will appear as learners interact</p>
                  </div>
                )}
              </Card>
            </div>

            {/* 3. HDI Analytics */}
            <Card className="p-6">
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <Activity className="size-5 text-orange-600" />
                HDI (Hint Dependency Index) Analytics
              </h3>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* HDI Histogram */}
                <div>
                  <p className="text-sm text-gray-600 mb-2">HDI Distribution</p>
                  {week5Analytics.hdiBins.some(b => b.count > 0) ? (
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart data={week5Analytics.hdiBins}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                        <XAxis dataKey="range" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} />
                        <RechartsTooltip 
                          contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb' }}
                        />
                        <Bar dataKey="count" fill={CHART_COLORS.orange} radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="text-center py-8 text-gray-500 bg-gray-50 rounded">
                      <p>No HDI data available</p>
                    </div>
                  )}
                </div>
                
                {/* High HDI Alerts */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm text-gray-600">High HDI Alerts (&gt; 0.8)</p>
                    <Badge variant="destructive" className="text-xs">
                      {week5Analytics.highHDIAlerts.length} learners
                    </Badge>
                  </div>
                  {week5Analytics.highHDIAlerts.length > 0 ? (
                    <div className="space-y-2 max-h-[200px] overflow-y-auto">
                      {week5Analytics.highHDIAlerts.map((alert, idx) => (
                        <div 
                          key={idx} 
                          className="flex items-center justify-between p-3 bg-red-50 border border-red-100 rounded-lg"
                        >
                          <div className="flex items-center gap-2">
                            <AlertCircle className="size-4 text-red-600" />
                            <span className="text-sm font-medium truncate max-w-[150px]">
                              {(alert.learnerId || 'unknown').slice(0, 8)}...
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-red-700 border-red-200">
                              HDI: {alert.hdi.toFixed(2)}
                            </Badge>
                            <span className="text-xs text-gray-500">
                              {new Date(alert.timestamp).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-gray-500 bg-gray-50 rounded">
                      <CheckCircle2 className="size-8 mx-auto mb-2 text-green-500" />
                      <p className="text-sm">No high dependency learners</p>
                    </div>
                  )}
                </div>
              </div>
            </Card>

            {/* 4. Profile Effectiveness Table */}
            <Card className="p-6">
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <TrendingUp className="size-5 text-green-600" />
                Profile Effectiveness Comparison
              </h3>
              {week5Analytics.profileEffectivenessData.length > 0 ? (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Profile</TableHead>
                        <TableHead className="text-right">Learners</TableHead>
                        <TableHead className="text-right">Avg Success Rate</TableHead>
                        <TableHead className="text-right">Avg Escalations</TableHead>
                        <TableHead className="text-right">Total Interactions</TableHead>
                        <TableHead>Performance</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {week5Analytics.profileEffectivenessData.map((row) => (
                        <TableRow key={row.profile}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Badge 
                                variant={row.profile === 'FAST' ? 'destructive' : row.profile === 'SLOW' ? 'default' : 'secondary'}
                              >
                                {row.profile}
                              </Badge>
                            </div>
                          </TableCell>
                          <TableCell className="text-right font-mono">{row.learnerCount}</TableCell>
                          <TableCell className="text-right">
                            <span className={`font-mono ${row.avgSuccessRate >= 70 ? 'text-green-600' : row.avgSuccessRate >= 40 ? 'text-yellow-600' : 'text-red-600'}`}>
                              {row.avgSuccessRate.toFixed(1)}%
                            </span>
                          </TableCell>
                          <TableCell className="text-right font-mono">{row.avgEscalations.toFixed(1)}</TableCell>
                          <TableCell className="text-right font-mono">{row.totalInteractions.toLocaleString()}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <div className="w-20 h-2 bg-gray-200 rounded-full overflow-hidden">
                                <div 
                                  className={`h-full rounded-full ${
                                    row.avgSuccessRate >= 70 ? 'bg-green-500' : 
                                    row.avgSuccessRate >= 40 ? 'bg-yellow-500' : 'bg-red-500'
                                  }`}
                                  style={{ width: `${Math.min(row.avgSuccessRate, 100)}%` }}
                                />
                              </div>
                              <span className="text-xs text-gray-500">
                                {row.avgSuccessRate >= 70 ? 'High' : row.avgSuccessRate >= 40 ? 'Medium' : 'Low'}
                              </span>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="text-center py-12 text-gray-500">
                  <TrendingUp className="size-12 mx-auto mb-3 text-gray-300" />
                  <p>No profile effectiveness data available</p>
                  <p className="text-sm text-gray-400 mt-1">Assign profiles to learners to see comparison</p>
                </div>
              )}
            </Card>

            {/* Knowledge-Structure Layer: Prerequisite Violation Statistics */}
            <Card className="p-6">
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <AlertCircle className="size-5 text-amber-600" />
                Prerequisite Violations
              </h3>
              {week5Analytics.violationStats.total > 0 ? (
                <div className="space-y-6">
                  {/* Summary Stats */}
                  <div className="grid grid-cols-3 gap-4">
                    <div className="p-3 bg-gray-50 rounded-lg text-center">
                      <p className="text-2xl font-bold text-amber-600">
                        {week5Analytics.violationStats.total}
                      </p>
                      <p className="text-xs text-gray-600">Total Violations</p>
                    </div>
                    <div className="p-3 bg-red-50 rounded-lg text-center">
                      <p className="text-2xl font-bold text-red-600">
                        {week5Analytics.violationStats.bySeverity.high}
                      </p>
                      <p className="text-xs text-red-600">High Severity</p>
                    </div>
                    <div className="p-3 bg-yellow-50 rounded-lg text-center">
                      <p className="text-2xl font-bold text-yellow-600">
                        {Object.keys(week5Analytics.violationStats.byConcept).length}
                      </p>
                      <p className="text-xs text-yellow-700">Concepts Affected</p>
                    </div>
                  </div>
                  
                  {/* Most problematic concepts */}
                  {Object.keys(week5Analytics.violationStats.byConcept).length > 0 && (
                    <div>
                      <p className="text-sm font-medium text-gray-700 mb-2">
                        Most Problematic Concepts
                      </p>
                      <div className="space-y-2">
                        {Object.entries(week5Analytics.violationStats.byConcept)
                          .sort((a, b) => b[1] - a[1])
                          .slice(0, 5)
                          .map(([conceptId, count]) => (
                            <div key={conceptId} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                              <span className="text-sm capitalize">
                                {conceptId.replace(/-/g, ' ')}
                              </span>
                              <Badge variant="outline">{count} violations</Badge>
                            </div>
                          ))}
                      </div>
                    </div>
                  )}
                  
                  {/* Most commonly missing prerequisites */}
                  {Object.keys(week5Analytics.violationStats.byMissingPrerequisite).length > 0 && (
                    <div>
                      <p className="text-sm font-medium text-gray-700 mb-2">
                        Most Commonly Missing Prerequisites
                      </p>
                      <div className="space-y-2">
                        {Object.entries(week5Analytics.violationStats.byMissingPrerequisite)
                          .sort((a, b) => b[1] - a[1])
                          .slice(0, 5)
                          .map(([prereq, count]) => (
                            <div key={prereq} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                              <span className="text-sm capitalize">
                                {prereq.replace(/-/g, ' ')}
                              </span>
                              <Badge variant="outline">{count} times</Badge>
                            </div>
                          ))}
                      </div>
                    </div>
                  )}
                  
                  {/* Severity breakdown */}
                  <div>
                    <p className="text-sm font-medium text-gray-700 mb-2">Severity Breakdown</p>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-4 bg-gray-100 rounded-full overflow-hidden flex">
                        <div 
                          className="bg-red-500 h-full"
                          style={{ 
                            width: `${week5Analytics.violationStats.total > 0 
                              ? (week5Analytics.violationStats.bySeverity.high / week5Analytics.violationStats.total) * 100 
                              : 0}%` 
                          }}
                        />
                        <div 
                          className="bg-yellow-500 h-full"
                          style={{ 
                            width: `${week5Analytics.violationStats.total > 0 
                              ? (week5Analytics.violationStats.bySeverity.medium / week5Analytics.violationStats.total) * 100 
                              : 0}%` 
                          }}
                        />
                        <div 
                          className="bg-green-500 h-full"
                          style={{ 
                            width: `${week5Analytics.violationStats.total > 0 
                              ? (week5Analytics.violationStats.bySeverity.low / week5Analytics.violationStats.total) * 100 
                              : 0}%` 
                          }}
                        />
                      </div>
                    </div>
                    <div className="flex justify-between text-xs text-gray-600 mt-1">
                      <span className="text-red-600">
                        High: {week5Analytics.violationStats.bySeverity.high}
                      </span>
                      <span className="text-yellow-600">
                        Medium: {week5Analytics.violationStats.bySeverity.medium}
                      </span>
                      <span className="text-green-600">
                        Low: {week5Analytics.violationStats.bySeverity.low}
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-12 text-gray-500">
                  <AlertCircle className="size-12 mx-auto mb-3 text-gray-300" />
                  <p>No prerequisite violations detected</p>
                  <p className="text-sm text-gray-400 mt-1">
                    Violations are logged when learners attempt concepts without prerequisites
                  </p>
                </div>
              )}
            </Card>

            {/* Week 6: Condition Statistics */}
            <Card className="p-6">
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <Target className="size-5 text-purple-600" />
                Experimental Condition Statistics
              </h3>
              {week5Analytics.conditionStats.length > 0 ? (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Condition</TableHead>
                        <TableHead className="text-right">Sessions</TableHead>
                        <TableHead className="text-right">Learners</TableHead>
                        <TableHead className="text-right">Avg HDI</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {week5Analytics.conditionStats.map((row) => (
                        <TableRow key={row.condition}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Badge 
                                variant="outline"
                                className={
                                  row.condition === 'aggressive' ? 'bg-blue-100 text-blue-800 border-blue-200' :
                                  row.condition === 'conservative' ? 'bg-yellow-100 text-yellow-800 border-yellow-200' :
                                  row.condition === 'adaptive' ? 'bg-green-100 text-green-800 border-green-200' :
                                  row.condition === 'explanation_first' ? 'bg-purple-100 text-purple-800 border-purple-200' :
                                  'bg-gray-100 text-gray-800 border-gray-200'
                                }
                              >
                                {row.condition}
                              </Badge>
                            </div>
                          </TableCell>
                          <TableCell className="text-right font-mono">{row.sessionCount}</TableCell>
                          <TableCell className="text-right font-mono">{row.learnerCount}</TableCell>
                          <TableCell className="text-right">
                            <span className={`font-mono ${
                              row.avgHDI <= 0.33 ? 'text-green-600' : 
                              row.avgHDI <= 0.66 ? 'text-yellow-600' : 
                              'text-red-600'
                            }`}>
                              {row.avgHdiDisplay}
                            </span>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="text-center py-12 text-gray-500">
                  <Target className="size-12 mx-auto mb-3 text-gray-300" />
                  <p>No condition statistics available</p>
                  <p className="text-sm text-gray-400 mt-1">Create sessions to see experimental condition comparison</p>
                </div>
              )}
            </Card>

            {/* Self-Explanation Quality Analytics */}
            <Card className="p-6">
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <BrainCircuit className="size-5 text-purple-600" />
                Self-Explanation Quality (RQS)
              </h3>
              {week5Analytics.qualityStats ? (
                <div className="space-y-6">
                  {/* Overall Stats */}
                  <div className="grid grid-cols-3 gap-4">
                    <div className="p-4 bg-purple-50 rounded-lg text-center">
                      <p className="text-sm text-purple-600 mb-1">Average Quality</p>
                      <p className="text-2xl font-bold text-purple-900">{week5Analytics.qualityStats.averageQuality}/100</p>
                    </div>
                    <div className="p-4 bg-blue-50 rounded-lg text-center">
                      <p className="text-sm text-blue-600 mb-1">Total Scored</p>
                      <p className="text-2xl font-bold text-blue-900">{week5Analytics.qualityStats.totalScored}</p>
                    </div>
                    <div className="p-4 bg-green-50 rounded-lg text-center">
                      <p className="text-sm text-green-600 mb-1">Excellent Rate</p>
                      <p className="text-2xl font-bold text-green-900">
                        {Math.round((week5Analytics.qualityStats.distribution.excellent / week5Analytics.qualityStats.totalScored) * 100)}%
                      </p>
                    </div>
                  </div>

                  {/* Distribution */}
                  <div>
                    <p className="text-sm text-gray-600 mb-3">Quality Distribution</p>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs w-20">Excellent (80-100)</span>
                        <div className="flex-1 h-4 bg-gray-100 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-green-500 rounded-full"
                            style={{ width: `${(week5Analytics.qualityStats.distribution.excellent / week5Analytics.qualityStats.totalScored) * 100}%` }}
                          />
                        </div>
                        <span className="text-xs w-8 text-right">{week5Analytics.qualityStats.distribution.excellent}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs w-20">Good (60-79)</span>
                        <div className="flex-1 h-4 bg-gray-100 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-blue-500 rounded-full"
                            style={{ width: `${(week5Analytics.qualityStats.distribution.good / week5Analytics.qualityStats.totalScored) * 100}%` }}
                          />
                        </div>
                        <span className="text-xs w-8 text-right">{week5Analytics.qualityStats.distribution.good}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs w-20">Needs Work (&lt;60)</span>
                        <div className="flex-1 h-4 bg-gray-100 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-red-500 rounded-full"
                            style={{ width: `${(week5Analytics.qualityStats.distribution.needsWork / week5Analytics.qualityStats.totalScored) * 100}%` }}
                          />
                        </div>
                        <span className="text-xs w-8 text-right">{week5Analytics.qualityStats.distribution.needsWork}</span>
                      </div>
                    </div>
                  </div>

                  {/* Dimension Averages */}
                  <div>
                    <p className="text-sm text-gray-600 mb-3">Average Dimension Scores</p>
                    <div className="space-y-2">
                      <DimensionBar label="Originality" value={week5Analytics.qualityStats.dimensionAverages.paraphrase} />
                      <DimensionBar label="Length" value={week5Analytics.qualityStats.dimensionAverages.length} />
                      <DimensionBar label="Keywords" value={week5Analytics.qualityStats.dimensionAverages.conceptKeywords} />
                      <DimensionBar label="Examples" value={week5Analytics.qualityStats.dimensionAverages.exampleInclusion} />
                      <DimensionBar label="Structure" value={week5Analytics.qualityStats.dimensionAverages.structuralCompleteness} />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-12 text-gray-500">
                  <BrainCircuit className="size-12 mx-auto mb-3 text-gray-300" />
                  <p>No quality data available</p>
                  <p className="text-sm text-gray-400 mt-1">Learners need to save notes with reflections to see quality scores</p>
                </div>
              )}
            </Card>
          </TabsContent>

          <TabsContent value="reinforcement" className="space-y-6">
            {/* Component 10: Knowledge Consolidation Analytics */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Reinforcement Stats Overview */}
              <Card className="p-6">
                <h3 className="font-semibold mb-4 flex items-center gap-2">
                  <BookOpen className="size-5 text-blue-600" />
                  Reinforcement Overview
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-blue-50 rounded-lg">
                    <p className="text-sm text-blue-600 mb-1">Total Scheduled</p>
                    <p className="text-2xl font-bold text-blue-900">{week5Analytics.reinforcementStats.totalScheduled}</p>
                  </div>
                  <div className="p-4 bg-green-50 rounded-lg">
                    <p className="text-sm text-green-600 mb-1">Response Rate</p>
                    <p className="text-2xl font-bold text-green-900">
                      {(week5Analytics.reinforcementStats.responseRate * 100).toFixed(0)}%
                    </p>
                  </div>
                  <div className="p-4 bg-purple-50 rounded-lg">
                    <p className="text-sm text-purple-600 mb-1">Prompts Shown</p>
                    <p className="text-2xl font-bold text-purple-900">{week5Analytics.reinforcementStats.totalShown}</p>
                  </div>
                  <div className="p-4 bg-amber-50 rounded-lg">
                    <p className="text-sm text-amber-600 mb-1">Avg Retention Score</p>
                    <p className="text-2xl font-bold text-amber-900">
                      {(week5Analytics.reinforcementStats.averageRetentionScore * 100).toFixed(0)}%
                    </p>
                  </div>
                </div>
              </Card>

              {/* Retention Level Distribution */}
              <Card className="p-6">
                <h3 className="font-semibold mb-4 flex items-center gap-2">
                  <TrendingUp className="size-5 text-green-600" />
                  Retention Levels
                </h3>
                {week5Analytics.reinforcementTimeline.filter(t => t.eventType === 'response').length > 0 ? (
                  <div className="space-y-4">
                    {(() => {
                      const responses = week5Analytics.reinforcementTimeline.filter(t => t.eventType === 'response');
                      const remembered = responses.filter(r => r.retentionLevel === 'remembered').length;
                      const partial = responses.filter(r => r.retentionLevel === 'partial').length;
                      const forgotten = responses.filter(r => r.retentionLevel === 'forgotten').length;
                      const total = responses.length;
                      
                      return (
                        <>
                          <div className="space-y-2">
                            <div className="flex items-center justify-between text-sm">
                              <span className="flex items-center gap-2">
                                <span className="w-3 h-3 rounded-full bg-green-500" />
                                Remembered
                              </span>
                              <span className="font-medium">{total > 0 ? ((remembered / total) * 100).toFixed(0) : 0}%</span>
                            </div>
                            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                              <div className="h-full bg-green-500 rounded-full" style={{ width: `${total > 0 ? (remembered / total) * 100 : 0}%` }} />
                            </div>
                          </div>
                          <div className="space-y-2">
                            <div className="flex items-center justify-between text-sm">
                              <span className="flex items-center gap-2">
                                <span className="w-3 h-3 rounded-full bg-yellow-500" />
                                Partial
                              </span>
                              <span className="font-medium">{total > 0 ? ((partial / total) * 100).toFixed(0) : 0}%</span>
                            </div>
                            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                              <div className="h-full bg-yellow-500 rounded-full" style={{ width: `${total > 0 ? (partial / total) * 100 : 0}%` }} />
                            </div>
                          </div>
                          <div className="space-y-2">
                            <div className="flex items-center justify-between text-sm">
                              <span className="flex items-center gap-2">
                                <span className="w-3 h-3 rounded-full bg-red-500" />
                                Forgotten
                              </span>
                              <span className="font-medium">{total > 0 ? ((forgotten / total) * 100).toFixed(0) : 0}%</span>
                            </div>
                            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                              <div className="h-full bg-red-500 rounded-full" style={{ width: `${total > 0 ? (forgotten / total) * 100 : 0}%` }} />
                            </div>
                          </div>
                        </>
                      );
                    })()}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <BookOpen className="size-12 mx-auto mb-3 text-gray-300" />
                    <p>No reinforcement data available</p>
                    <p className="text-sm text-gray-400 mt-1">Reinforcement prompts will appear as learners save notes</p>
                  </div>
                )}
              </Card>
            </div>

            {/* Reinforcement Timeline */}
            <Card className="p-6">
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <Clock className="size-5 text-purple-600" />
                Reinforcement Activity Timeline
              </h3>
              {week5Analytics.reinforcementTimeline.length > 0 ? (
                <div className="space-y-2 max-h-[300px] overflow-y-auto">
                  {week5Analytics.reinforcementTimeline.map((event, idx) => (
                    <div 
                      key={idx}
                      className={`flex items-center justify-between p-3 rounded-lg ${
                        event.eventType === 'scheduled' ? 'bg-blue-50' :
                        event.eventType === 'shown' ? 'bg-purple-50' :
                        event.isCorrect ? 'bg-green-50' : 'bg-yellow-50'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <Badge variant="outline" className="text-xs">
                          {event.eventType === 'scheduled' && <span className="text-blue-600">Scheduled</span>}
                          {event.eventType === 'shown' && <span className="text-purple-600">Shown</span>}
                          {event.eventType === 'response' && <span className="text-green-600">Response</span>}
                        </Badge>
                        <span className="text-sm text-gray-600">
                          {new Date(event.timestamp).toLocaleString()}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        {event.retentionLevel && (
                          <Badge className={
                            event.retentionLevel === 'remembered' ? 'bg-green-100 text-green-800' :
                            event.retentionLevel === 'partial' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-red-100 text-red-800'
                          }>
                            {event.retentionLevel}
                          </Badge>
                        )}
                        <span className="text-xs text-gray-500">
                          {event.learnerId.slice(0, 8)}...
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <Clock className="size-12 mx-auto mb-3 text-gray-300" />
                  <p>No reinforcement activity yet</p>
                  <p className="text-sm text-gray-400 mt-1">Schedule reinforcement by saving textbook units</p>
                </div>
              )}
            </Card>
          </TabsContent>

          <TabsContent value="clustering" className="space-y-6">
            <Card className="p-6">
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <Users className="size-5 text-blue-600" />
                Learner Behavior Clusters
              </h3>
              <p className="text-sm text-gray-600 mb-4">
                Learners are automatically grouped based on HDI, escalation rate, and independence metrics using k-means clustering.
              </p>
              
              {researchMetrics.clusters.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {researchMetrics.clusters.map((cluster) => (
                    <Card key={cluster.id} className="p-4 border-l-4 border-l-blue-500">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-semibold text-gray-800">{cluster.name}</h4>
                        <Badge variant="secondary">{cluster.members.length} learners</Badge>
                      </div>
                      
                      <div className="space-y-2 mb-3">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-500">Avg HDI</span>
                          <span className={`font-mono ${
                            cluster.centroids.hdi < 0.3 ? 'text-green-600' : 
                            cluster.centroids.hdi < 0.6 ? 'text-yellow-600' : 'text-red-600'
                          }`}>
                            {cluster.centroids.hdi.toFixed(2)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-500">Escalation Rate</span>
                          <span className="font-mono">{(cluster.centroids.escalationRate * 100).toFixed(0)}%</span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-500">Independence</span>
                          <span className="font-mono">{(cluster.centroids.independence * 100).toFixed(0)}%</span>
                        </div>
                      </div>
                      
                      <div className="flex flex-wrap gap-1">
                        {cluster.characteristics.map((trait, idx) => (
                          <Badge key={idx} variant="outline" className="text-xs bg-gray-50">
                            {trait}
                          </Badge>
                        ))}
                      </div>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 text-gray-500">
                  <Users className="size-12 mx-auto mb-3 text-gray-300" />
                  <p>No clustering data available</p>
                  <p className="text-sm text-gray-400 mt-1">Add learner profiles to see behavior clusters</p>
                </div>
              )}
            </Card>
          </TabsContent>

          <TabsContent value="heatmap" className="space-y-6">
            <Card className="p-6">
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <BarChart3 className="size-5 text-purple-600" />
                Escalation Heatmap
              </h3>
              <p className="text-sm text-gray-600 mb-4">
                Visual representation of escalation patterns across learners and problems. 
                Darker colors indicate higher rung usage.
              </p>
              <EscalationHeatmap interactions={filteredInteractions} />
            </Card>
          </TabsContent>

          <TabsContent value="transitions" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="p-6">
                <h3 className="font-semibold mb-4 flex items-center gap-2">
                  <TrendingUp className="size-5 text-red-600" />
                  Error Transition Matrix
                </h3>
                <p className="text-sm text-gray-600 mb-4">
                  Shows which error types most commonly follow others, revealing patterns in learner struggles.
                </p>
                <ErrorTransitionView matrix={researchMetrics.errorTransitions.transitions} />
              </Card>

              <Card className="p-6">
                <h3 className="font-semibold mb-4 flex items-center gap-2">
                  <AlertCircle className="size-5 text-orange-600" />
                  Error Recovery Patterns
                </h3>
                <p className="text-sm text-gray-600 mb-4">
                  Percentage of successful recoveries after each error type.
                </p>
                <ErrorRecoveryView 
                  patterns={getErrorRecoveryPatterns(filteredInteractions)} 
                />
              </Card>
            </div>

            {researchMetrics.errorTransitions.errorChains.length > 0 && (
              <Card className="p-6">
                <h3 className="font-semibold mb-4 flex items-center gap-2">
                  <Activity className="size-5 text-amber-600" />
                  Common Error Chains
                </h3>
                <p className="text-sm text-gray-600 mb-4">
                  Sequences of errors that occur consecutively, appearing at least twice in the data.
                </p>
                <ErrorChainView chains={researchMetrics.errorTransitions.errorChains} />
              </Card>
            )}
          </TabsContent>

          <TabsContent value="mastery" className="space-y-6">
            <Card className="p-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
                <div>
                  <h3 className="font-semibold flex items-center gap-2">
                    <Target className="size-5 text-green-600" />
                    Concept Mastery Timeline
                  </h3>
                  <p className="text-sm text-gray-600 mt-1">
                    Chronological view of concept interactions for a specific learner.
                  </p>
                </div>
                <Select 
                  value={selectedMasteryLearner} 
                  onValueChange={setSelectedMasteryLearner}
                >
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="Select learner" />
                  </SelectTrigger>
                  <SelectContent>
                    {profiles.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              {selectedMasteryLearner ? (
                <MasteryTimeline 
                  interactions={filteredInteractions} 
                  learnerId={selectedMasteryLearner}
                  maxEvents={25}
                />
              ) : (
                <div className="text-center py-12 text-gray-500">
                  <Target className="size-12 mx-auto mb-3 text-gray-300" />
                  <p>Select a learner to view their mastery timeline</p>
                </div>
              )}
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </TooltipProvider>
  );
}

function formatPdfIndexSummary(pdfIndex: PdfIndexDocument): string {
  return `${pdfIndex.docCount} doc(s), ${pdfIndex.chunkCount} chunk(s) · ${pdfIndex.indexId}`;
}

function isCommandLine(line: string): boolean {
  const trimmed = line.trim();
  return (
    trimmed.startsWith('brew ') ||
    trimmed.startsWith('sudo ') ||
    trimmed.startsWith('choco ') ||
    /^\d+\./.test(trimmed)
  );
}

function PdfIndexErrorDisplay({ error }: { error: string }): JSX.Element {
  const lines = error.split('\n');
  return (
    <>
      {lines.map((line, index) => {
        if (line.trim() === '') {
          return <div key={index} className="h-1" />;
        }
        if (isCommandLine(line)) {
          return (
            <div
              key={index}
              className="font-mono text-red-800 bg-red-100 px-1.5 py-0.5 rounded my-1 text-[10px]"
            >
              {line}
            </div>
          );
        }
        return <div key={index}>{line}</div>;
      })}
    </>
  );
}
