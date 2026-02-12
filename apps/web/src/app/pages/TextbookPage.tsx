import { useCallback, useMemo } from 'react';
import { AdaptiveTextbook } from '../components/AdaptiveTextbook';
import { Button } from '../components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Card } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { ArrowLeft } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router';
import { storage } from '../lib/storage';
import { InteractionEvent } from '../types';

const learnerOptions = ['learner-1', 'learner-2', 'learner-3'] as const;
type LearnerId = (typeof learnerOptions)[number];

const isLearnerId = (value: string | null): value is LearnerId =>
  value !== null && learnerOptions.includes(value as LearnerId);

const getSubtypeLabel = (interaction: InteractionEvent) =>
  interaction.sqlEngageSubtype || interaction.errorSubtypeId || 'unknown-subtype';

const TRACE_ATTEMPT_EVENT_TYPES: InteractionEvent['eventType'][] = [
  'execution',
  'error',
  'hint_view',
  'explanation_view'
];

export function TextbookPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const learnerId: LearnerId = isLearnerId(searchParams.get('learnerId'))
    ? (searchParams.get('learnerId') as LearnerId)
    : 'learner-1';
  const selectedUnitId = searchParams.get('unitId') || undefined;
  const selectedAttemptId = searchParams.get('attemptId') || undefined;
  const selectedSubtypeParam = searchParams.get('subtype');

  const updateParams = useCallback((
    updates: Record<string, string | undefined>,
    options?: { replace?: boolean }
  ) => {
    const next = new URLSearchParams(searchParams);
    Object.entries(updates).forEach(([key, value]) => {
      if (!value) {
        next.delete(key);
      } else {
        next.set(key, value);
      }
    });
    setSearchParams(next, options);
  }, [searchParams, setSearchParams]);

  const handleLearnerChange = (value: string) => {
    if (!isLearnerId(value)) return;
    updateParams({
      learnerId: value,
      unitId: undefined,
      attemptId: undefined,
      subtype: undefined
    });
  };

  const handleSelectedUnitChange = useCallback((unitId: string | undefined) => {
    updateParams({ unitId }, { replace: true });
  }, [updateParams]);

  const handleSubtypeChange = (value: string) => {
    updateParams({
      subtype: value === 'all' ? undefined : value,
      attemptId: undefined
    });
  };

  const clearFilters = () => {
    updateParams({
      attemptId: undefined,
      subtype: undefined
    });
  };

  const buildEvidenceHref = useCallback((interaction: InteractionEvent) => {
    const next = new URLSearchParams(searchParams);
    next.set('learnerId', learnerId);
    if (selectedUnitId) {
      next.set('unitId', selectedUnitId);
    }
    next.set('attemptId', interaction.id);
    next.set('subtype', getSubtypeLabel(interaction));
    return `/textbook?${next.toString()}#trace-attempts`;
  }, [searchParams, learnerId, selectedUnitId]);

  const learnerInteractionsAll = useMemo(
    () => storage
      .getInteractionsByLearner(learnerId)
      .sort((a, b) => b.timestamp - a.timestamp),
    [learnerId]
  );
  const learnerInteractions = useMemo(
    () => learnerInteractionsAll.filter((interaction) => TRACE_ATTEMPT_EVENT_TYPES.includes(interaction.eventType)),
    [learnerInteractionsAll]
  );
  const selectedAttemptExists = !selectedAttemptId
    || learnerInteractionsAll.some((interaction) => interaction.id === selectedAttemptId);

  const subtypeOptions = useMemo(
    () => Array.from(new Set(learnerInteractions.map(getSubtypeLabel))).sort(),
    [learnerInteractions]
  );

  const selectedSubtype = selectedSubtypeParam && subtypeOptions.includes(selectedSubtypeParam)
    ? selectedSubtypeParam
    : 'all';

  const filteredAttempts = useMemo(
    () => learnerInteractions.filter((interaction) => {
      if (selectedAttemptId && interaction.id !== selectedAttemptId) return false;
      if (selectedSubtype !== 'all' && getSubtypeLabel(interaction) !== selectedSubtype) return false;
      return true;
    }),
    [learnerInteractions, selectedAttemptId, selectedSubtype]
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="border-b bg-white">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="sm" onClick={() => navigate('/')}>
                <ArrowLeft className="size-4 mr-2" />
                Back to Practice
              </Button>
              <div>
                <h1 className="text-2xl font-bold">My Textbook</h1>
                <p className="text-gray-600 text-sm">Your personalized SQL learning notes</p>
              </div>
            </div>
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

      <div className="container mx-auto px-4 py-6 h-[calc(100vh-120px)] flex flex-col gap-4">
        <div className="flex-1 min-h-0">
          <AdaptiveTextbook
            learnerId={learnerId}
            selectedUnitId={selectedUnitId}
            activeEvidenceId={selectedAttemptId}
            onSelectedUnitChange={handleSelectedUnitChange}
            buildEvidenceHref={buildEvidenceHref}
          />
        </div>

        <Card id="trace-attempts" className="p-4">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
            <div>
              <h2 className="font-semibold">Trace Attempts</h2>
              <p className="text-xs text-gray-600">Filterable attempt log for evidence link targets</p>
            </div>
            <div className="flex items-center gap-2">
              {selectedAttemptId && !selectedAttemptExists && (
                <Badge variant="outline" className="text-xs text-amber-800 border-amber-300">
                  Selected evidence reference not found
                </Badge>
              )}
              {selectedAttemptId && (
                <Badge variant="secondary" className="text-xs">
                  Attempt: {selectedAttemptId}
                </Badge>
              )}
              <Select value={selectedSubtype} onValueChange={handleSubtypeChange}>
                <SelectTrigger className="w-[240px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All subtypes</SelectItem>
                  {subtypeOptions.map((subtype) => (
                    <SelectItem key={subtype} value={subtype}>
                      {subtype}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {(selectedAttemptId || selectedSubtype !== 'all') && (
                <Button variant="outline" size="sm" onClick={clearFilters}>
                  Clear filters
                </Button>
              )}
            </div>
          </div>

          {filteredAttempts.length === 0 ? (
            <p className="text-sm text-gray-500">No attempts match the current filters.</p>
          ) : (
            <div className="max-h-56 overflow-y-auto space-y-2 pr-1">
              {filteredAttempts.map((interaction) => {
                const subtype = getSubtypeLabel(interaction);
                const isSelected = selectedAttemptId === interaction.id;
                return (
                  <div
                    key={interaction.id}
                    className={`rounded border p-2 text-sm ${
                      isSelected ? 'border-blue-300 bg-blue-50' : 'border-gray-200'
                    }`}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{interaction.id}</span>
                      <Badge variant="outline" className="text-xs">{subtype}</Badge>
                      <span className="text-xs text-gray-500">
                        {new Date(interaction.timestamp).toLocaleString()}
                      </span>
                    </div>
                    <p className="text-xs text-gray-600 mt-1">
                      {interaction.problemId} • {interaction.eventType.replace('_', ' ')}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
