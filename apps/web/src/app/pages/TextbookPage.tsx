import { useCallback, useEffect, useMemo, useState } from 'react';
import { AdaptiveTextbook } from '../components/AdaptiveTextbook';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Card } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '../components/ui/tooltip';
import { Skeleton } from '../components/ui/skeleton';
import { ArrowLeft, Search, Filter, BookOpen, X, Clock, Tag, GraduationCap, TrendingUp, Sparkles } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router';
import { storage } from '../lib/storage';
import { InteractionEvent } from '../types';
import { conceptNodes } from '../data/sql-engage';
import { useUserRole } from '../hooks/useUserRole';

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
  const { isStudent, isInstructor } = useUserRole();
  const [searchParams, setSearchParams] = useSearchParams();

  const learnerId: LearnerId = isLearnerId(searchParams.get('learnerId'))
    ? (searchParams.get('learnerId') as LearnerId)
    : 'learner-1';
  const selectedUnitId = searchParams.get('unitId') || undefined;
  const selectedAttemptId = searchParams.get('attemptId') || undefined;
  const selectedSubtypeParam = searchParams.get('subtype');

  // Search and filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedConcept, setSelectedConcept] = useState<string>('all');
  const [showFilters, setShowFilters] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Storage change listener for reactive updates
  const [storageVersion, setStorageVersion] = useState(0);
  
  useEffect(() => {
    const timer = setTimeout(() => setIsLoading(false), 500);
    return () => clearTimeout(timer);
  }, []);
  
  useEffect(() => {
    // Ref to track mounted state for cleanup
    let isMounted = true;
    
    const handleStorageChange = () => {
      // Only update state if component is still mounted
      if (isMounted) {
        setStorageVersion(v => v + 1);
      }
    };
    
    // Listen for localStorage changes from other tabs/windows
    window.addEventListener('storage', handleStorageChange);
    
    // Polling fallback for same-tab changes (since storage events don't fire for same-tab changes)
    const interval = setInterval(handleStorageChange, 2000);
    
    return () => {
      isMounted = false;
      window.removeEventListener('storage', handleStorageChange);
      clearInterval(interval);
    };
  }, []);

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
    setSearchQuery('');
    setSelectedConcept('all');
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
    [learnerId, storageVersion]
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

  // Get textbook units for concept filtering
  const textbookUnits = useMemo(() => {
    return storage.getTextbook(learnerId);
  }, [learnerId, storageVersion]);

  const conceptOptions = useMemo(() => {
    const conceptIds = Array.from(new Set(textbookUnits.map(u => u.conceptId)));
    return conceptIds
      .map(id => conceptNodes.find(c => c.id === id))
      .filter(Boolean)
      .sort((a, b) => a!.name.localeCompare(b!.name));
  }, [textbookUnits]);

  // Calculate learning stats for student view
  const learningStats = useMemo(() => {
    const totalUnits = textbookUnits.length;
    const conceptsCovered = new Set(textbookUnits.map(u => u.conceptId)).size;
    const autoCreatedUnits = textbookUnits.filter(u => u.autoCreated).length;
    return { totalUnits, conceptsCovered, autoCreatedUnits };
  }, [textbookUnits]);

  // Apply filters
  const filteredAttempts = useMemo(
    () => learnerInteractions.filter((interaction) => {
      if (selectedAttemptId && interaction.id !== selectedAttemptId) return false;
      if (selectedSubtype !== 'all' && getSubtypeLabel(interaction) !== selectedSubtype) return false;
      
      // Text search
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesProblem = interaction.problemId?.toLowerCase().includes(query);
        const matchesEventType = interaction.eventType?.toLowerCase().includes(query);
        const matchesSubtype = getSubtypeLabel(interaction).toLowerCase().includes(query);
        if (!matchesProblem && !matchesEventType && !matchesSubtype) return false;
      }
      
      return true;
    }),
    [learnerInteractions, selectedAttemptId, selectedSubtype, searchQuery]
  );

  const hasActiveFilters = searchQuery || selectedSubtype !== 'all' || selectedAttemptId;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="border-b bg-white">
          <div className="container mx-auto px-4 py-4">
            <Skeleton className="h-8 w-48" />
          </div>
        </div>
        <div className="container mx-auto px-4 py-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Skeleton className="h-96 lg:col-span-2" />
            <Skeleton className="h-96" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
        <div className="border-b bg-white">
          <div className="container mx-auto px-4 py-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-center gap-4">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="sm" onClick={() => navigate('/')}>
                      <ArrowLeft className="size-4 mr-2" />
                      Back
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Return to practice</p>
                  </TooltipContent>
                </Tooltip>
                <div>
                  {isStudent ? (
                    // Student-friendly "My Learning Journey" header
                    <>
                      <h1 className="text-2xl font-bold flex items-center gap-2">
                        <GraduationCap className="size-6 text-blue-600" />
                        My Learning Journey
                      </h1>
                      <p className="text-gray-600 text-sm">Your personalized SQL notes and progress</p>
                    </>
                  ) : (
                    // Instructor header
                    <>
                      <h1 className="text-2xl font-bold flex items-center gap-2">
                        <BookOpen className="size-6 text-blue-600" />
                        My Textbook
                      </h1>
                      <p className="text-gray-600 text-sm">Your personalized SQL learning notes</p>
                    </>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {/* Student learning stats */}
                {isStudent && (
                  <div className="hidden sm:flex items-center gap-3 mr-2">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 rounded-lg border border-blue-200">
                          <BookOpen className="size-4 text-blue-600" />
                          <span className="text-sm font-medium text-blue-700">
                            {learningStats.totalUnits} notes
                          </span>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Total notes in your textbook</p>
                      </TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-green-50 rounded-lg border border-green-200">
                          <TrendingUp className="size-4 text-green-600" />
                          <span className="text-sm font-medium text-green-700">
                            {learningStats.conceptsCovered} concepts
                          </span>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Concepts you&apos;ve covered</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                )}
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

        <div className="container mx-auto px-4 py-6 flex-1 min-h-0 flex flex-col gap-4">
          {/* Student welcome card */}
          {isStudent && (
            <Card className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Sparkles className="size-5 text-blue-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-blue-900">Your Personal Study Guide</h3>
                  <p className="text-sm text-blue-700 mt-1">
                    This page collects helpful explanations and notes created just for you as you practice SQL. 
                    Review them anytime to reinforce your learning!
                  </p>
                </div>
              </div>
            </Card>
          )}

          {/* Instructor info card */}
          {isInstructor && (
            <Card className="p-3">
              <p className="text-xs text-gray-700">
                Units are ordered by concept prerequisites, with misconception and spaced-review insights derived from your trace evidence.
              </p>
            </Card>
          )}

          <div className="flex-1 min-h-0">
            <AdaptiveTextbook
              learnerId={learnerId}
              selectedUnitId={selectedUnitId}
              activeEvidenceId={selectedAttemptId}
              onSelectedUnitChange={handleSelectedUnitChange}
              buildEvidenceHref={buildEvidenceHref}
            />
          </div>

          {/* Trace Attempts section - simplified for students, full for instructors */}
          {isInstructor ? (
            // Full Trace Attempts section for instructors
            <Card id="trace-attempts" className="p-4">
              <div className="flex flex-col gap-3 mb-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="font-semibold flex items-center gap-2">
                      <Clock className="size-4" />
                      Trace Attempts
                    </h2>
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
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowFilters(!showFilters)}
                      className={showFilters ? 'bg-gray-100' : ''}
                    >
                      <Filter className="size-4 mr-1.5" />
                      Filters
                    </Button>
                  </div>
                </div>

                {/* Search and filters */}
                {showFilters && (
                  <div className="flex flex-col sm:flex-row gap-3 p-3 bg-gray-50 rounded-lg">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-gray-400" />
                      <Input
                        placeholder="Search by problem, event type, or subtype..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-9"
                      />
                      {searchQuery && (
                        <button
                          onClick={() => setSearchQuery('')}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        >
                          <X className="size-4" />
                        </button>
                      )}
                    </div>
                    
                    <Select value={selectedSubtype} onValueChange={handleSubtypeChange}>
                      <SelectTrigger className="w-full sm:w-[200px]">
                        <Tag className="size-4 mr-2 text-gray-400" />
                        <SelectValue placeholder="Filter by subtype" />
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

                    {hasActiveFilters && (
                      <Button variant="ghost" size="sm" onClick={clearFilters}>
                        <X className="size-4 mr-1" />
                        Clear
                      </Button>
                    )}
                  </div>
                )}

                {/* Active filters display */}
                {hasActiveFilters && (
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs text-gray-500">Active filters:</span>
                    {searchQuery && (
                      <Badge variant="secondary" className="text-xs">
                        Search: &ldquo;{searchQuery}&rdquo;
                        <button onClick={() => setSearchQuery('')} className="ml-1 hover:text-red-500">
                          <X className="size-3" />
                        </button>
                      </Badge>
                    )}
                    {selectedSubtype !== 'all' && (
                      <Badge variant="secondary" className="text-xs">
                        Subtype: {selectedSubtype}
                        <button onClick={() => handleSubtypeChange('all')} className="ml-1 hover:text-red-500">
                          <X className="size-3" />
                        </button>
                      </Badge>
                    )}
                    {selectedAttemptId && (
                      <Badge variant="secondary" className="text-xs">
                        Attempt: {selectedAttemptId.slice(0, 8)}...
                        <button onClick={() => updateParams({ attemptId: undefined })} className="ml-1 hover:text-red-500">
                          <X className="size-3" />
                        </button>
                      </Badge>
                    )}
                  </div>
                )}
              </div>

              {filteredAttempts.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Clock className="size-12 mx-auto mb-3 text-gray-300" />
                  <p className="text-sm">
                    {hasActiveFilters 
                      ? 'No attempts match the current filters.' 
                      : 'No attempts recorded yet.'}
                  </p>
                  {hasActiveFilters && (
                    <Button variant="link" size="sm" onClick={clearFilters} className="mt-2">
                      Clear all filters
                    </Button>
                  )}
                </div>
              ) : (
                <div className="max-h-56 overflow-y-auto space-y-2 pr-1">
                  {filteredAttempts.map((interaction) => {
                    const subtype = getSubtypeLabel(interaction);
                    const isSelected = selectedAttemptId === interaction.id;
                    return (
                      <div
                        key={interaction.id}
                        className={`rounded-lg border p-3 text-sm transition-all ${
                          isSelected 
                            ? 'border-blue-300 bg-blue-50 shadow-sm' 
                            : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                        }`}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-medium font-mono text-xs text-gray-700">
                              {interaction.id.slice(0, 16)}...
                            </span>
                            <Badge variant="outline" className="text-xs">{subtype}</Badge>
                          </div>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="text-xs text-gray-500 cursor-help">
                                {new Date(interaction.timestamp).toLocaleString()}
                              </span>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>{new Date(interaction.timestamp).toLocaleString()}</p>
                            </TooltipContent>
                          </Tooltip>
                        </div>
                        <div className="flex items-center gap-2 mt-2 text-xs text-gray-600">
                          <span className="font-medium">{interaction.problemId}</span>
                          <span className="text-gray-400">•</span>
                          <Badge variant="secondary" className="text-[10px]">
                            {interaction.eventType.replace(new RegExp('_', 'g'), ' ')}
                          </Badge>
                          {interaction.successful && (
                            <Badge variant="outline" className="text-[10px] text-green-600 border-green-200">
                              Success
                            </Badge>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
          ) : (
            // Simplified view for students - just show recent activity summary
            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold flex items-center gap-2">
                    <Clock className="size-4" />
                    Recent Activity
                  </h3>
                  <p className="text-xs text-gray-600 mt-1">
                    {filteredAttempts.length} practice attempts recorded
                  </p>
                </div>
                {filteredAttempts.length > 0 && (
                  <Badge variant="secondary" className="text-xs">
                    Last: {new Date(filteredAttempts[0].timestamp).toLocaleDateString()}
                  </Badge>
                )}
              </div>
            </Card>
          )}
        </div>
      </div>
  );
}
