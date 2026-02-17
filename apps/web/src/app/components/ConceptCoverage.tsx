import { Card } from './ui/card';
import { Badge } from './ui/badge';
import { Progress } from './ui/progress';
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip';
import { Skeleton } from './ui/skeleton';
import { 
  CheckCircle2, 
  Circle, 
  AlertCircle, 
  BookOpen, 
  Play, 
  Lightbulb, 
  HelpCircle,
  TrendingUp,
  Clock,
  Flame,
  Target
} from 'lucide-react';
import { conceptNodes } from '../data/sql-engage';
import { storage } from '../lib/storage';
import { ConceptCoverageEvidence } from '../types';

interface ConceptCoverageProps {
  learnerId: string;
}

const confidenceConfig = {
  high: { 
    color: 'bg-green-500', 
    textColor: 'text-green-700', 
    bgColor: 'bg-green-50',
    borderColor: 'border-green-200',
    label: 'Mastered',
    icon: CheckCircle2
  },
  medium: { 
    color: 'bg-yellow-500', 
    textColor: 'text-yellow-700', 
    bgColor: 'bg-yellow-50',
    borderColor: 'border-yellow-200',
    label: 'Developing',
    icon: TrendingUp
  },
  low: { 
    color: 'bg-gray-400', 
    textColor: 'text-gray-600', 
    bgColor: 'bg-gray-50',
    borderColor: 'border-gray-200',
    label: 'Exposed',
    icon: Circle
  }
};

// Format relative time
function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return new Date(timestamp).toLocaleDateString();
}

function EvidenceTooltip({ evidence }: { evidence: ConceptCoverageEvidence }) {
  const counts = evidence.evidenceCounts || {
    successfulExecution: 0,
    notesAdded: 0,
    explanationViewed: 0,
    hintViewed: 0,
    errorEncountered: 0
  };
  
  return (
    <div className="space-y-2 text-xs min-w-[200px]">
      <div className="flex items-center justify-between border-b pb-2 mb-2">
        <span className="font-semibold">Evidence Score</span>
        <Badge variant={evidence.score >= 75 ? 'default' : evidence.score >= 40 ? 'secondary' : 'outline'}>
          {evidence.score}/100
        </Badge>
      </div>
      
      <div className="space-y-1.5">
        {counts.successfulExecution > 0 && (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Play className="size-3 text-green-500" />
              <span>Successful executions</span>
            </div>
            <Badge variant="outline" className="text-xs">{counts.successfulExecution}</Badge>
          </div>
        )}
        {counts.notesAdded > 0 && (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <BookOpen className="size-3 text-blue-500" />
              <span>Notes added</span>
            </div>
            <Badge variant="outline" className="text-xs">{counts.notesAdded}</Badge>
          </div>
        )}
        {counts.explanationViewed > 0 && (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <HelpCircle className="size-3 text-purple-500" />
              <span>Explanations viewed</span>
            </div>
            <Badge variant="outline" className="text-xs">{counts.explanationViewed}</Badge>
          </div>
        )}
        {counts.hintViewed > 0 && (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Lightbulb className="size-3 text-amber-500" />
              <span>Hints viewed</span>
            </div>
            <Badge variant="outline" className="text-xs">{counts.hintViewed}</Badge>
          </div>
        )}
        {counts.errorEncountered > 0 && (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <AlertCircle className="size-3 text-red-500" />
              <span>Errors encountered</span>
            </div>
            <Badge variant="outline" className="text-xs">{counts.errorEncountered}</Badge>
          </div>
        )}
      </div>
      
      {(evidence.streakCorrect > 0 || evidence.streakIncorrect > 0) && (
        <div className="border-t pt-2 mt-2 space-y-1">
          {evidence.streakCorrect > 0 && (
            <div className="flex items-center gap-1.5 text-green-600">
              <Flame className="size-3" />
              <span>{evidence.streakCorrect} correct streak</span>
            </div>
          )}
          {evidence.streakIncorrect > 0 && (
            <div className="flex items-center gap-1.5 text-red-600">
              <AlertCircle className="size-3" />
              <span>{evidence.streakIncorrect} incorrect streak</span>
            </div>
          )}
        </div>
      )}
      
      <div className="text-[10px] text-gray-400 pt-1">
        Last updated: {formatRelativeTime(evidence.lastUpdated)}
      </div>
    </div>
  );
}

export function ConceptCoverage({ learnerId }: ConceptCoverageProps) {
  const [profile, setProfile] = useState<LearnerProfile | null>(null);
  const [coverageStats, setCoverageStats] = useState<CoverageStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Load data in effect to avoid blocking render with expensive localStorage parsing
    setIsLoading(true);
    const loadedProfile = storage.getProfile(learnerId);
    const loadedStats = storage.getCoverageStats(learnerId);
    setProfile(loadedProfile);
    setCoverageStats(loadedStats);
    setIsLoading(false);
  }, [learnerId]);

  const evidenceMap = profile?.conceptCoverageEvidence || new Map();
  
  if (isLoading || !profile) {
    return (
      <Card className="p-4">
        <Skeleton className="h-4 w-32 mb-4" />
        <Skeleton className="h-2 w-full mb-2" />
        <div className="space-y-2 mt-4">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
        </div>
      </Card>
    );
  }

  // Sort concepts by difficulty and coverage status
  const sortedConcepts = [...conceptNodes].sort((a, b) => {
    const aEvidence = evidenceMap.get(a.id);
    const bEvidence = evidenceMap.get(b.id);
    const aScore = aEvidence?.score || 0;
    const bScore = bEvidence?.score || 0;
    
    // Sort by difficulty first, then by score (highest first)
    const difficultyOrder = { beginner: 0, intermediate: 1, advanced: 2 };
    const diffDiff = difficultyOrder[a.difficulty] - difficultyOrder[b.difficulty];
    if (diffDiff !== 0) return diffDiff;
    return bScore - aScore;
  });

  const conceptsByDifficulty = sortedConcepts.reduce((acc, concept) => {
    if (!acc[concept.difficulty]) {
      acc[concept.difficulty] = [];
    }
    acc[concept.difficulty].push(concept);
    return acc;
  }, {} as Record<string, typeof conceptNodes>);

  const getEvidenceForConcept = (conceptId: string): ConceptCoverageEvidence | undefined => {
    return evidenceMap.get(conceptId);
  };

  const getConfidenceForConcept = (conceptId: string): 'low' | 'medium' | 'high' => {
    return getEvidenceForConcept(conceptId)?.confidence || 'low';
  };

  const isCovered = (conceptId: string): boolean => {
    const evidence = getEvidenceForConcept(conceptId);
    return evidence ? evidence.score >= 50 : profile.conceptsCovered.has(conceptId);
  };

  // Get recent activity
  const recentInteractions = storage.getInteractionsByLearner(learnerId)
    .filter(i => i.conceptIds && i.conceptIds.length > 0)
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, 5);

  const uniqueRecentConcepts = Array.from(new Set(
    recentInteractions.flatMap(i => i.conceptIds || [])
  )).slice(0, 3);

  return (
    <Card className="p-4">
        <div className="space-y-4">
          {/* Header with overall progress */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Target className="size-4 text-blue-600" />
                <h3 className="font-semibold">Concept Coverage</h3>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs">
                  Avg: {coverageStats.averageScore}/100
                </Badge>
                <Badge variant="outline">
                  {coverageStats.coveredCount} / {coverageStats.totalConcepts}
                </Badge>
              </div>
            </div>
            
            {/* Main progress bar */}
            <div className="space-y-1">
              <Progress value={coverageStats.coveragePercentage} className="h-2.5" />
              <div className="flex justify-between text-xs text-gray-500">
                <span>{Math.round(coverageStats.coveragePercentage)}% covered</span>
                <span>{coverageStats.totalConcepts - coverageStats.coveredCount} remaining</span>
              </div>
            </div>
            
            {/* Confidence breakdown */}
            <div className="flex gap-3 mt-3 text-xs">
              {coverageStats.byConfidence.high > 0 && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex items-center gap-1 text-green-600 cursor-help">
                      <CheckCircle2 className="size-3" />
                      <span className="font-medium">{coverageStats.byConfidence.high} mastered</span>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Score 75+ with 2+ successful executions</p>
                  </TooltipContent>
                </Tooltip>
              )}
              {coverageStats.byConfidence.medium > 0 && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex items-center gap-1 text-yellow-600 cursor-help">
                      <TrendingUp className="size-3" />
                      <span className="font-medium">{coverageStats.byConfidence.medium} developing</span>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Score 40+ with 1+ successful execution</p>
                  </TooltipContent>
                </Tooltip>
              )}
              {coverageStats.byConfidence.low > 0 && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex items-center gap-1 text-gray-500 cursor-help">
                      <Circle className="size-3" />
                      <span className="font-medium">{coverageStats.byConfidence.low} exposed</span>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Some exposure but not yet developing</p>
                  </TooltipContent>
                </Tooltip>
              )}
            </div>
          </div>

          {/* Recent Activity */}
          {uniqueRecentConcepts.length > 0 && (
            <div className="pt-3 border-t">
              <div className="flex items-center gap-2 mb-2">
                <Clock className="size-3.5 text-gray-500" />
                <span className="text-xs font-medium text-gray-600">Recently Practiced</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {uniqueRecentConcepts.map(conceptId => {
                  const concept = conceptNodes.find(c => c.id === conceptId);
                  const evidence = getEvidenceForConcept(conceptId);
                  const confidence = evidence?.confidence || 'low';
                  const config = confidenceConfig[confidence];
                  
                  return (
                    <Tooltip key={conceptId}>
                      <TooltipTrigger asChild>
                        <Badge 
                          variant="outline" 
                          className={`text-xs cursor-help ${config.bgColor} ${config.textColor} ${config.borderColor}`}
                        >
                          {concept?.name || conceptId}
                        </Badge>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="font-medium">{concept?.name || conceptId}</p>
                        <p className="text-xs text-gray-400">Score: {evidence?.score || 0}/100</p>
                      </TooltipContent>
                    </Tooltip>
                  );
                })}
              </div>
            </div>
          )}

          {/* Concepts list */}
          <div className="space-y-3 pt-2">
            {Object.entries(conceptsByDifficulty).map(([difficulty, concepts]) => (
              <div key={difficulty}>
                <h4 className={`text-xs font-semibold uppercase tracking-wide mb-2 px-1 ${
                  difficulty === 'beginner' ? 'text-green-700' :
                  difficulty === 'intermediate' ? 'text-yellow-700' :
                  'text-red-700'
                }`}>
                  {difficulty}
                </h4>
                <div className="space-y-1.5">
                  {concepts.map(concept => {
                    const covered = isCovered(concept.id);
                    const confidence = getConfidenceForConcept(concept.id);
                    const evidence = getEvidenceForConcept(concept.id);
                    const config = confidenceConfig[confidence];
                    const ConfidenceIcon = config.icon;
                    
                    return (
                      <Tooltip key={concept.id}>
                        <TooltipTrigger asChild>
                          <div
                            className={`group relative flex items-center gap-2 p-2.5 rounded-lg border transition-all duration-200 cursor-pointer hover:shadow-sm ${
                              covered 
                                ? `${config.bgColor} ${config.borderColor}` 
                                : 'bg-white border-gray-200 hover:border-gray-300'
                            }`}
                          >
                            <ConfidenceIcon className={`size-4 shrink-0 ${
                              covered ? config.textColor : 'text-gray-400'
                            }`} />
                            
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className={`text-sm font-medium truncate ${
                                  covered ? config.textColor : 'text-gray-600'
                                }`}>
                                  {concept.name}
                                </span>
                                {covered && (
                                  <Badge variant="outline" className={`text-[10px] px-1 py-0 ${config.textColor}`}>
                                    {config.label}
                                  </Badge>
                                )}
                              </div>
                              
                              {/* Mini progress bar */}
                              <div className="flex items-center gap-2 mt-1">
                                <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                                  <div 
                                    className={`h-full rounded-full transition-all duration-500 ${config.color}`}
                                    style={{ width: `${evidence?.score || 0}%` }}
                                  />
                                </div>
                                <span className="text-[10px] text-gray-500 w-8 text-right">
                                  {evidence?.score || 0}%
                                </span>
                              </div>
                            </div>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent side="right" className="max-w-xs">
                          <EvidenceTooltip evidence={evidence || {
                            conceptId: concept.id,
                            score: 0,
                            confidence: 'low',
                            lastUpdated: Date.now(),
                            evidenceCounts: {
                              successfulExecution: 0,
                              hintViewed: 0,
                              explanationViewed: 0,
                              errorEncountered: 0,
                              notesAdded: 0
                            },
                            streakCorrect: 0,
                            streakIncorrect: 0
                          }} />
                        </TooltipContent>
                      </Tooltip>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* Legend */}
          <div className="pt-3 border-t">
            <p className="text-xs font-medium text-gray-600 mb-2">Confidence Levels</p>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="flex items-center gap-1.5 cursor-help">
                    <span className="w-3 h-3 rounded-full bg-green-500" />
                    <span className="text-gray-600">Mastered (75+ pts)</span>
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Score 75+ with 2+ successful executions</p>
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="flex items-center gap-1.5 cursor-help">
                    <span className="w-3 h-3 rounded-full bg-yellow-500" />
                    <span className="text-gray-600">Developing (40+ pts)</span>
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Score 40+ with 1+ successful execution</p>
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="flex items-center gap-1.5 cursor-help">
                    <span className="w-3 h-3 rounded-full bg-gray-400" />
                    <span className="text-gray-600">Exposed</span>
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Some exposure but not yet developing</p>
                </TooltipContent>
              </Tooltip>
            </div>
          </div>
        </div>
      </Card>
  );
}
