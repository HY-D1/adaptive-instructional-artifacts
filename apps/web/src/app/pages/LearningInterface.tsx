import { useState, useEffect } from 'react';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Badge } from '../components/ui/badge';
import { SQLEditor } from '../components/SQLEditor';
import { HintSystem } from '../components/HintSystem';
import { ConceptCoverage } from '../components/ConceptCoverage';
import { Clock, CheckCircle2, AlertCircle } from 'lucide-react';
import { SQLProblem, InteractionEvent, InstructionalUnit, LearnerProfile, LearningInterfaceMode } from '../types';
import { sqlProblems } from '../data/problems';
import { storage } from '../lib/storage';
import { QueryResult } from '../lib/sql-executor';
import {
  canonicalizeSqlEngageSubtype,
  getKnownSqlEngageSubtypes,
  getSqlEngagePolicyVersion
} from '../data/sql-engage';

const INSTRUCTOR_SUBTYPE_OPTIONS = getKnownSqlEngageSubtypes();

const STRATEGY_OPTIONS: Array<{ value: LearnerProfile['currentStrategy']; label: string }> = [
  { value: 'hint-only', label: 'Hint Only' },
  { value: 'adaptive', label: 'Adaptive (Legacy)' },
  { value: 'adaptive-low', label: 'Adaptive Low' },
  { value: 'adaptive-medium', label: 'Adaptive Medium' },
  { value: 'adaptive-high', label: 'Adaptive High' }
];

export function LearningInterface() {
  const [learnerId, setLearnerId] = useState('learner-1');
  const [mode, setMode] = useState<LearningInterfaceMode>('student');
  const [sessionId, setSessionId] = useState('');
  const [currentProblem, setCurrentProblem] = useState<SQLProblem>(sqlProblems[0]);
  const [startTime, setStartTime] = useState(Date.now());
  const [interactions, setInteractions] = useState<InteractionEvent[]>([]);
  const [lastError, setLastError] = useState<string | undefined>();
  const [lastErrorEventId, setLastErrorEventId] = useState<string | undefined>();
  const [strategyOverride, setStrategyOverride] = useState<LearnerProfile['currentStrategy']>('adaptive-medium');
  const [subtypeOverride, setSubtypeOverride] = useState('auto');
  const [escalationTriggered, setEscalationTriggered] = useState(false);
  const [notesActionMessage, setNotesActionMessage] = useState<string | undefined>();

  useEffect(() => {
    // Initialize learner profile if doesn't exist
    let profile = storage.getProfile(learnerId);
    if (!profile) {
      profile = storage.createDefaultProfile(learnerId, 'adaptive-medium');
    }
    setStrategyOverride(profile.currentStrategy);
    setSubtypeOverride('auto');

    // Start a new active session on app load / learner switch.
    const newSessionId = storage.startSession(learnerId);
    setSessionId(newSessionId);
    setInteractions(
      storage
        .getInteractionsByLearner(learnerId)
        .filter((interaction) => interaction.sessionId === newSessionId)
    );
    setLastError(undefined);
    setLastErrorEventId(undefined);
    setEscalationTriggered(false);
    setNotesActionMessage(undefined);
  }, [learnerId]);

  const handleLearnerChange = (nextLearnerId: string) => {
    if (nextLearnerId === learnerId) {
      return;
    }
    // Clear prior learner context immediately to avoid one-render stale interaction carryover.
    setInteractions([]);
    setSessionId('');
    setLastError(undefined);
    setLastErrorEventId(undefined);
    setEscalationTriggered(false);
    setNotesActionMessage(undefined);
    setLearnerId(nextLearnerId);
  };

  const handleStrategyChange = (nextStrategy: LearnerProfile['currentStrategy']) => {
    setStrategyOverride(nextStrategy);
    const profile = storage.getProfile(learnerId);
    if (!profile) return;
    storage.saveProfile({
      ...profile,
      currentStrategy: nextStrategy
    });
  };

  const isInstructorMode = mode === 'instructor';
  const instructorSubtypeOverride = isInstructorMode && subtypeOverride !== 'auto'
    ? canonicalizeSqlEngageSubtype(subtypeOverride)
    : undefined;

  const handleCodeChange = (code: string) => {
    const event: InteractionEvent = {
      id: `event-${Date.now()}`,
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

  const handleExecute = (query: string, result: QueryResult) => {
    const resolvedSubtype = !result.success
      ? canonicalizeSqlEngageSubtype(instructorSubtypeOverride || result.errorSubtypeId)
      : undefined;
    const event: InteractionEvent = {
      id: `event-${Date.now()}`,
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
      successful: result.success,
      timeSpent: Date.now() - startTime
    };

    storage.saveInteraction(event);
    setInteractions((previousInteractions) => [...previousInteractions, event]);

    if (!result.success && resolvedSubtype) {
      setLastError(resolvedSubtype);
      setLastErrorEventId(event.id);
      setNotesActionMessage(undefined);
    }

    if (result.success) {
      setLastError(undefined);
      setLastErrorEventId(undefined);
      setEscalationTriggered(false);
      setNotesActionMessage(undefined);
    }
  };

  const handleEscalate = (sourceInteractionIds?: string[]) => {
    setEscalationTriggered(true);
    if (sourceInteractionIds && sourceInteractionIds.length > 0) {
      setLastErrorEventId(sourceInteractionIds[sourceInteractionIds.length - 1]);
    }
  };

  const handleHintSystemInteraction = (event: InteractionEvent) => {
    if (event.learnerId !== learnerId) {
      return;
    }
    if (sessionId && event.sessionId && event.sessionId !== sessionId) {
      return;
    }
    setInteractions((previousInteractions) => [...previousInteractions, event]);
  };

  const collectNoteEvidenceIds = (): string[] => {
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

    return Array.from(new Set([...(lastErrorEventId ? [lastErrorEventId] : []), ...sessionInteractions]));
  };

  const generateExplanationUnit = (errorSubtypeId: string, sourceInteractionIds: string[]): InstructionalUnit => {
    const normalizedSubtype = canonicalizeSqlEngageSubtype(errorSubtypeId);
    const conceptId = currentProblem.concepts[0] || 'unknown-concept';
    return {
      id: `unit-${Date.now()}`,
      sessionId,
      updatedSessionIds: sessionId ? [sessionId] : [],
      type: 'explanation',
      conceptId,
      title: `Help with ${currentProblem.title}`,
      content: `This note was added from escalation for "${currentProblem.title}". Last detected issue: "${normalizedSubtype}". Review this concept and retry with a minimal valid SELECT structure before adding clauses.`,
      prerequisites: [],
      addedTimestamp: Date.now(),
      sourceInteractionIds
    };
  };

  const handleAddToNotes = () => {
    if (!lastError) return;

    const sourceIds = collectNoteEvidenceIds();
    const explanation = generateExplanationUnit(lastError, sourceIds);
    const result = storage.saveTextbookUnit(learnerId, explanation);
    const evidenceCount = result.unit.sourceInteractionIds.length;
    setNotesActionMessage(
      result.action === 'created'
        ? `Added to My Notes (${evidenceCount} evidence interaction${evidenceCount === 1 ? '' : 's'}).`
        : `Updated existing note (${evidenceCount} merged evidence interaction${evidenceCount === 1 ? '' : 's'}).`
    );
  };

  const learnerSessionInteractions = interactions.filter(
    (interaction) =>
      interaction.learnerId === learnerId &&
      (!sessionId || interaction.sessionId === sessionId)
  );
  const problemInteractions = learnerSessionInteractions.filter(i => i.problemId === currentProblem.id);
  const showAddToNotes = escalationTriggered && !!lastError;
  const errorCount = problemInteractions.filter(i => i.eventType === 'error').length;
  const timeSpent = Date.now() - startTime;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="border-b bg-white">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">SQL Learning Lab</h1>
              <p className="text-gray-600 text-sm">Adaptive instructional system with HintWise</p>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Clock className="size-4 text-gray-500" />
                <span className="text-sm">
                  {Math.floor(timeSpent / 60000)}:{String(Math.floor((timeSpent % 60000) / 1000)).padStart(2, '0')}
                </span>
              </div>
              <Select value={mode} onValueChange={(value) => setMode(value as LearningInterfaceMode)}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="student">Student</SelectItem>
                  <SelectItem value="instructor">Instructor</SelectItem>
                </SelectContent>
              </Select>
              <Select value={learnerId} onValueChange={handleLearnerChange}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="learner-1">Learner 1</SelectItem>
                  <SelectItem value="learner-2">Learner 2</SelectItem>
                  <SelectItem value="learner-3">Learner 3</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main problem area */}
          <div className="lg:col-span-2 space-y-4">
            <Card className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <h2 className="text-xl font-bold">{currentProblem.title}</h2>
                    <Badge variant={
                      currentProblem.difficulty === 'beginner' ? 'default' :
                      currentProblem.difficulty === 'intermediate' ? 'secondary' :
                      'destructive'
                    }>
                      {currentProblem.difficulty}
                    </Badge>
                  </div>
                  <p className="text-gray-700">{currentProblem.description}</p>
                </div>
                <Select 
                  value={currentProblem.id} 
                  onValueChange={(id) => {
                    const problem = sqlProblems.find(p => p.id === id)!;
                    setCurrentProblem(problem);
                    setStartTime(Date.now());
                    setLastError(undefined);
                    setLastErrorEventId(undefined);
                    setEscalationTriggered(false);
                    setNotesActionMessage(undefined);
                  }}
                >
                  <SelectTrigger className="w-[200px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {sqlProblems.map(p => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center gap-4 text-sm text-gray-600 mb-4">
                <div className="flex items-center gap-1">
                  <AlertCircle className="size-4" />
                  <span>{errorCount} errors</span>
                </div>
                <div className="flex items-center gap-1">
                  <CheckCircle2 className="size-4" />
                  <span>
                    {problemInteractions.filter(i => i.successful).length} successful runs
                  </span>
                </div>
              </div>

              {isInstructorMode && (
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
                        value={strategyOverride}
                        onValueChange={(value) => handleStrategyChange(value as LearnerProfile['currentStrategy'])}
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

            <div className="h-[500px]">
              <SQLEditor
                problem={currentProblem}
                onExecute={handleExecute}
                onCodeChange={handleCodeChange}
              />
            </div>
          </div>

          {/* Sidebar with hints */}
          <div className="space-y-4">
            <HintSystem
              sessionId={sessionId}
              learnerId={learnerId}
              problemId={currentProblem.id}
              errorSubtypeId={lastError}
              isSubtypeOverrideActive={Boolean(instructorSubtypeOverride)}
              knownSubtypeOverride={instructorSubtypeOverride}
              recentInteractions={problemInteractions}
              onEscalate={handleEscalate}
              onInteractionLogged={handleHintSystemInteraction}
            />

            {showAddToNotes && (
              <Card className="p-4 space-y-3">
                <div>
                  <h3 className="font-semibold">Escalation</h3>
                  <p className="text-sm text-gray-600">
                    Add this concept to My Notes with merged evidence IDs from this session.
                  </p>
                </div>
                <Button onClick={handleAddToNotes} size="sm" className="w-full">
                  Add to My Notes
                </Button>
                {notesActionMessage && (
                  <p className="text-xs text-gray-600">{notesActionMessage}</p>
                )}
              </Card>
            )}

            <ConceptCoverage learnerId={learnerId} />

            <Card className="p-4">
              <h3 className="font-semibold mb-3">Concepts</h3>
              <div className="flex flex-wrap gap-2">
                {currentProblem.concepts.map(concept => (
                  <Badge key={concept} variant="outline">
                    {concept.replace(/-/g, ' ')}
                  </Badge>
                ))}
              </div>
            </Card>

            <Card className="p-4">
              <h3 className="font-semibold mb-3">Session Stats</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Total attempts:</span>
                  <span className="font-medium">{problemInteractions.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Hints viewed:</span>
                  <span className="font-medium">
                    {problemInteractions.filter(i => i.eventType === 'hint_view').length}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Time spent:</span>
                  <span className="font-medium">
                    {Math.floor(timeSpent / 60000)}m {Math.floor((timeSpent % 60000) / 1000)}s
                  </span>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
