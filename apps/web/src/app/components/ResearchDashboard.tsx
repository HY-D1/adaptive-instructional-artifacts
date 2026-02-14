import { useState, useEffect, useMemo } from 'react';
import { Card } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from './ui/table';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  LineChart,
  Line
} from 'recharts';
import { Download, Play, RefreshCw, Users, Activity } from 'lucide-react';
import { storage } from '../lib/storage';
import { InteractionEvent, LearnerProfile, ExperimentCondition, PdfIndexDocument } from '../types';
import { orchestrator, ReplayDecisionPoint, AutoEscalationMode } from '../lib/adaptive-orchestrator';
import { checkOllamaHealth, OLLAMA_MODEL } from '../lib/llm-client';
import { loadOrBuildPdfIndex } from '../lib/pdf-index-loader';
import { createEventId } from '../lib/event-id';

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

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    storage.setPolicyReplayMode(policyReplayMode);
  }, [policyReplayMode]);

  const loadData = () => {
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
      setPdfIndexSummary('No PDF index loaded');
      setPdfIndexStatus('idle');
    }
    if (!selectedTraceLearner && loadedProfiles[0]) {
      setSelectedTraceLearner(loadedProfiles[0].id);
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

  const handleExport = () => {
    const data = exportAllHistory
      ? storage.exportAllData()
      : storage.exportData();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sql-learning-data-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
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

  const handleImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target?.result as string);
        storage.importData(data);
        setExportAllHistory(false);
        loadData();
      } catch (error) {
        alert('Error importing data');
      }
    };
    reader.readAsText(file);
  };

  const handleLoadPdfIndex = async () => {
    setPdfIndexStatus('loading');
    setPdfIndexError(null);

    try {
      const result = await loadOrBuildPdfIndex();
      const saveResult = storage.savePdfIndex(result.document);
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
        setInteractions((previous) => [...previous, rebuildEvent]);
      }

      loadData();
    } catch (error) {
      setPdfIndexSummary('No PDF index loaded');
      setPdfIndexStatus('error');
      setPdfIndexError((error as Error).message || 'Failed to load PDF index.');
    }
  };

  // Analytics
  const filteredInteractions = selectedLearner === 'all'
    ? interactions
    : interactions.filter(i => i.learnerId === selectedLearner);

  const errorsByType = filteredInteractions
    .filter(i => i.eventType === 'error' && i.errorSubtypeId)
    .reduce((acc, i) => {
      const type = i.errorSubtypeId!;
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

  const errorChartData = Object.entries(errorsByType).map(([name, count]) => ({
    name: name.replace(/-/g, ' '),
    count
  }));

  const interactionsByType = filteredInteractions.reduce((acc, i) => {
    acc[i.eventType] = (acc[i.eventType] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const interactionChartData = Object.entries(interactionsByType).map(([name, count]) => ({
    name: name.replace(/_/g, ' '),
    count
  }));

  // Strategy comparison
  const strategyComparison = profiles.reduce((acc, profile) => {
    const learnerInteractions = interactions.filter(i => i.learnerId === profile.id);
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
  }, {} as Record<string, any>);

  const safeAverage = (total: number, count: number, digits = 1) => (
    count > 0 ? (total / count).toFixed(digits) : (0).toFixed(digits)
  );
  const comparisonData = Object.values(strategyComparison).map((s: any) => ({
    strategy: s.strategy.replace(/-/g, ' '),
    avgErrors: safeAverage(s.totalErrors, s.learnerCount),
    avgHints: safeAverage(s.totalHints, s.learnerCount),
    avgSuccess: safeAverage(s.totalSuccess, s.learnerCount),
    avgEscalations: safeAverage(s.totalEscalations, s.learnerCount),
    avgUnitsAdded: safeAverage(s.totalUnitsAdded, s.learnerCount),
    avgDedupRate: s.totalUnitsAdded + s.totalUnitUpdates > 0
      ? (s.totalUnitUpdates / (s.totalUnitsAdded + s.totalUnitUpdates)).toFixed(2)
      : '0.00'
  }));

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
  }, {} as Record<number, any>);

  const timelineChartData = Object.values(timelineData).sort((a, b) => a.minute - b.minute);
  const traceProblemOptions = useMemo(() => {
    if (!selectedTraceLearner) return [];
    return Array.from(new Set(
      interactions
        .filter((interaction) => interaction.learnerId === selectedTraceLearner)
        .map((interaction) => interaction.problemId)
        .filter(Boolean)
    ));
  }, [interactions, selectedTraceLearner]);

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

  const formatThreshold = (value: number) => (Number.isFinite(value) ? String(value) : 'never');
  const formatDecision = (decision: ReplayDecisionPoint['decision']) => decision.replace(/_/g, ' ');
  const formatEventType = (eventType: InteractionEvent['eventType']) => eventType.replace(/_/g, ' ');
  const formatSubtype = (subtype?: string) => subtype ? subtype.replace(/-/g, ' ') : '-';

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

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-2xl font-bold">Research Dashboard</h2>
            <p className="text-gray-600 mt-1">
              Analyze interaction traces and compare adaptive strategies
            </p>
          </div>
          <div className="flex gap-2">
            <Button onClick={handleExport} variant="outline" size="sm">
              <Download className="size-4 mr-2" />
              Export Data
            </Button>
            <label className="flex items-center gap-2 px-2 text-sm text-gray-600">
              <input
                type="checkbox"
                checked={exportAllHistory}
                onChange={(e) => setExportAllHistory(e.target.checked)}
              />
              Include all history
            </label>
            <label>
              <input
                type="file"
                accept=".json"
                onChange={handleImport}
                className="hidden"
              />
              <Button variant="outline" size="sm" asChild>
                <span>Import Data</span>
              </Button>
            </label>
            <Button onClick={loadData} variant="outline" size="sm">
              <RefreshCw className="size-4" />
            </Button>
          </div>
        </div>
        <p
          className="mb-4 text-xs text-gray-600"
          data-testid="export-scope-label"
        >
          Export scope: {exportAllHistory ? 'all history' : 'active session (default)'}
        </p>

        <div className="mb-4 grid grid-cols-1 md:grid-cols-3 gap-3">
          <Card className="p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">LLM Health Check</p>
                <p className="text-xs text-gray-500">Target model: {OLLAMA_MODEL}</p>
                <p className={`text-xs ${llmHealthOk === null ? 'text-gray-600' : llmHealthOk ? 'text-emerald-700' : 'text-red-700'}`}>
                  {llmHealthMessage}
                </p>
              </div>
              <Button size="sm" variant="outline" onClick={handleLLMHealthCheck} disabled={isCheckingLLM}>
                {isCheckingLLM ? 'Checking...' : 'Test LLM'}
              </Button>
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
              <div>
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
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleLoadPdfIndex}
                data-testid="pdf-index-load-button"
                disabled={pdfIndexStatus === 'loading'}
              >
                {pdfIndexStatus === 'loading' ? 'Loading...' : 'Load Index'}
              </Button>
            </div>
          </Card>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Users className="size-4 text-blue-600" />
              <span className="text-sm font-medium">Learners</span>
            </div>
            <p className="text-3xl font-bold">{profiles.length}</p>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Activity className="size-4 text-green-600" />
              <span className="text-sm font-medium">Interactions</span>
            </div>
            <p className="text-3xl font-bold">{interactions.length}</p>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Activity className="size-4 text-red-600" />
              <span className="text-sm font-medium">Errors</span>
            </div>
            <p className="text-3xl font-bold">
              {interactions.filter(i => i.eventType === 'error').length}
            </p>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Activity className="size-4 text-yellow-600" />
              <span className="text-sm font-medium">Hints</span>
            </div>
            <p className="text-3xl font-bold">
              {interactions.filter(i => i.eventType === 'hint_view').length}
            </p>
          </Card>
        </div>
      </Card>

      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold">Filter by Learner</h3>
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

      <Tabs defaultValue="interactions">
        <TabsList>
          <TabsTrigger value="interactions">Interaction Analysis</TabsTrigger>
          <TabsTrigger value="errors">Error Analysis</TabsTrigger>
          <TabsTrigger value="comparison">Strategy Comparison</TabsTrigger>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
          <TabsTrigger value="trace" data-testid="instructor-trace-tab">
            Instructor Trace View
          </TabsTrigger>
        </TabsList>

        <TabsContent value="interactions" className="space-y-4">
          <Card className="p-6">
            <h3 className="font-semibold mb-4">Interactions by Type</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={interactionChartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="count" fill="#3b82f6" />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </TabsContent>

        <TabsContent value="errors" className="space-y-4">
          <Card className="p-6">
            <h3 className="font-semibold mb-4">Errors by Subtype</h3>
            {errorChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={errorChartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="count" fill="#ef4444" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-gray-500 text-center py-8">No error data available</p>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="comparison" className="space-y-4">
          <Card className="p-6">
            <h3 className="font-semibold mb-4">Strategy Comparison</h3>
            <div className="mb-4 space-y-2">
              {experimentConditions.map(cond => (
                <div key={cond.id} className="p-3 border rounded">
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
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="strategy" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="avgErrors" fill="#ef4444" name="Avg Errors" />
                    <Bar dataKey="avgHints" fill="#eab308" name="Avg Hints" />
                    <Bar dataKey="avgSuccess" fill="#22c55e" name="Avg Success" />
                    <Bar dataKey="avgEscalations" fill="#6366f1" name="Avg Escalations" />
                    <Bar dataKey="avgUnitsAdded" fill="#0ea5e9" name="Avg Units Added" />
                  </BarChart>
                </ResponsiveContainer>
                <div className="mt-4 text-sm text-gray-700 space-y-1">
                  {comparisonData.map((row: any) => (
                    <p key={row.strategy}>
                      {row.strategy}: dedup rate {row.avgDedupRate}
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

        <TabsContent value="timeline" className="space-y-4">
          <Card className="p-6">
            <h3 className="font-semibold mb-4">Interaction Timeline</h3>
            {timelineChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={timelineChartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="minute" label={{ value: 'Minutes', position: 'insideBottom', offset: -5 }} />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="events" stroke="#3b82f6" name="Total Events" />
                  <Line type="monotone" dataKey="errors" stroke="#ef4444" name="Errors" />
                  <Line type="monotone" dataKey="hints" stroke="#eab308" name="Hints" />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-gray-500 text-center py-8">No timeline data available</p>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="trace" className="space-y-4">
          <Card className="p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Trace Replay With Policy Knob</h3>
              <Button
                onClick={handleReplay}
                size="sm"
                variant="outline"
                disabled={!selectedTraceLearner}
                data-testid="trace-replay-button"
              >
                <Play className="size-4 mr-2" />
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
      </Tabs>
    </div>
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
