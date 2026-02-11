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
import { InteractionEvent, LearnerProfile, ExperimentCondition } from '../types';
import { orchestrator, ReplayDecisionPoint } from '../lib/adaptive-orchestrator';

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
  const [traceWindow, setTraceWindow] = useState<string>('40');
  const [isReplaying, setIsReplaying] = useState(false);
  const [replayNonce, setReplayNonce] = useState(0);
  const [exportAllHistory, setExportAllHistory] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = () => {
    setInteractions(storage.getAllInteractions());
    const loadedProfiles = storage.getAllProfiles() as LearnerProfile[];
    setProfiles(loadedProfiles);
    if (!selectedTraceLearner && loadedProfiles[0]) {
      setSelectedTraceLearner(loadedProfiles[0].id);
    }
  };

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
    const data = storage.exportData({ allHistory: exportAllHistory });
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sql-learning-data-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target?.result as string);
        storage.importData(data);
        loadData();
      } catch (error) {
        alert('Error importing data');
      }
    };
    reader.readAsText(file);
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

    if (!acc[profile.currentStrategy]) {
      acc[profile.currentStrategy] = {
        strategy: profile.currentStrategy,
        totalErrors: 0,
        totalHints: 0,
        totalSuccess: 0,
        learnerCount: 0
      };
    }

    acc[profile.currentStrategy].totalErrors += errorCount;
    acc[profile.currentStrategy].totalHints += hintCount;
    acc[profile.currentStrategy].totalSuccess += successCount;
    acc[profile.currentStrategy].learnerCount += 1;

    return acc;
  }, {} as Record<string, any>);

  const comparisonData = Object.values(strategyComparison).map((s: any) => ({
    strategy: s.strategy.replace(/-/g, ' '),
    avgErrors: (s.totalErrors / s.learnerCount).toFixed(1),
    avgHints: (s.totalHints / s.learnerCount).toFixed(1),
    avgSuccess: (s.totalSuccess / s.learnerCount).toFixed(1)
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

  const replayTraceSlice = useMemo(() => (
    // Keep replay counterfactual inputs policy-neutral for baseline comparison.
    traceSlice.filter((event) => event.eventType !== 'explanation_view')
  ), [traceSlice]);

  const replayDecisions = useMemo<ReplayDecisionPoint[]>(() => {
    if (!selectedTraceProfile || replayTraceSlice.length === 0) return [];
    return orchestrator.replayDecisionTrace(
      selectedTraceProfile,
      replayTraceSlice,
      selectedReplayStrategy
    );
  }, [selectedTraceProfile, replayTraceSlice, selectedReplayStrategy]);

  const hintOnlyDecisions = useMemo<ReplayDecisionPoint[]>(() => {
    if (!selectedTraceProfile || replayTraceSlice.length === 0) return [];
    return orchestrator.replayDecisionTrace(selectedTraceProfile, replayTraceSlice, 'hint-only');
  }, [selectedTraceProfile, replayTraceSlice]);

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

  const activeThresholds = orchestrator.getThresholds(selectedReplayStrategy);
  const traceStartTime = replayTraceSlice[0]?.timestamp;

  const formatThreshold = (value: number) => (Number.isFinite(value) ? String(value) : 'never');
  const formatDecision = (decision: ReplayDecisionPoint['decision']) => decision.replace(/_/g, ' ');

  const handleReplay = () => {
    setIsReplaying(true);
    setReplayNonce((prev) => prev + 1);
    window.setTimeout(() => setIsReplaying(false), 150);
  };

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
              Export all history
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
                </BarChart>
              </ResponsiveContainer>
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

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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

            {replayDecisions.length > 0 ? (
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
                    const elapsedSeconds = traceStartTime
                      ? Math.max(0, Math.round((point.timestamp - traceStartTime) / 1000))
                      : 0;

                    return (
                      <TableRow
                        key={`${point.eventId}-${point.index}`}
                        className={decisionChanged ? 'bg-amber-50/80' : undefined}
                      >
                        <TableCell>{point.index}</TableCell>
                        <TableCell>{elapsedSeconds}</TableCell>
                        <TableCell>{point.eventType}</TableCell>
                        <TableCell>{point.errorSubtypeId || '-'}</TableCell>
                        <TableCell>
                          {point.context.errorCount}/{point.context.retryCount}/{point.context.currentHintLevel}
                        </TableCell>
                        <TableCell>
                          <Badge variant={point.decision === 'show_explanation' ? 'secondary' : 'outline'}>
                            {formatDecision(point.decision)}
                          </Badge>
                        </TableCell>
                        <TableCell>{baseline ? formatDecision(baseline.decision) : '-'}</TableCell>
                        <TableCell title={point.reasoning}>{point.ruleFired}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
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
