import { Card } from './ui/card';
import { Badge } from './ui/badge';
import { Progress } from './ui/progress';
import { CheckCircle2, Circle, AlertCircle, BookOpen, Play, Lightbulb, HelpCircle } from 'lucide-react';
import { conceptNodes } from '../data/sql-engage';
import { storage } from '../lib/storage';
import { ConceptCoverageEvidence } from '../types';

interface ConceptCoverageProps {
  learnerId: string;
}

const confidenceConfig = {
  high: { color: 'bg-green-500', textColor: 'text-green-700', bgColor: 'bg-green-50', label: 'Mastered' },
  medium: { color: 'bg-yellow-500', textColor: 'text-yellow-700', bgColor: 'bg-yellow-50', label: 'Developing' },
  low: { color: 'bg-gray-400', textColor: 'text-gray-600', bgColor: 'bg-gray-50', label: 'Exposed' }
};

function EvidenceTooltip({ evidence }: { evidence: ConceptCoverageEvidence }) {
  const counts = evidence.evidenceCounts;
  return (
    <div className="space-y-1 text-xs">
      <div className="font-medium border-b pb-1 mb-1">Evidence Score: {evidence.score}/100</div>
      {counts.successfulExecution > 0 && (
        <div className="flex items-center gap-1">
          <Play className="size-3 text-green-500" />
          <span>{counts.successfulExecution} successful executions</span>
        </div>
      )}
      {counts.notesAdded > 0 && (
        <div className="flex items-center gap-1">
          <BookOpen className="size-3 text-blue-500" />
          <span>{counts.notesAdded} notes added</span>
        </div>
      )}
      {counts.explanationViewed > 0 && (
        <div className="flex items-center gap-1">
          <HelpCircle className="size-3 text-purple-500" />
          <span>{counts.explanationViewed} explanations viewed</span>
        </div>
      )}
      {counts.hintViewed > 0 && (
        <div className="flex items-center gap-1">
          <Lightbulb className="size-3 text-amber-500" />
          <span>{counts.hintViewed} hints viewed</span>
        </div>
      )}
      {counts.errorEncountered > 0 && (
        <div className="flex items-center gap-1">
          <AlertCircle className="size-3 text-red-500" />
          <span>{counts.errorEncountered} errors encountered</span>
        </div>
      )}
      {(evidence.streakCorrect > 0 || evidence.streakIncorrect > 0) && (
        <div className="border-t pt-1 mt-1">
          {evidence.streakCorrect > 0 && (
            <span className="text-green-600">✓ {evidence.streakCorrect} streak</span>
          )}
          {evidence.streakCorrect > 0 && evidence.streakIncorrect > 0 && (
            <span className="mx-1">·</span>
          )}
          {evidence.streakIncorrect > 0 && (
            <span className="text-red-600">✗ {evidence.streakIncorrect} streak</span>
          )}
        </div>
      )}
    </div>
  );
}

export function ConceptCoverage({ learnerId }: ConceptCoverageProps) {
  const profile = storage.getProfile(learnerId);
  const coverageStats = storage.getCoverageStats(learnerId);
  const evidenceMap = profile?.conceptCoverageEvidence || new Map();
  
  if (!profile) return null;

  const conceptsByDifficulty = conceptNodes.reduce((acc, concept) => {
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

  return (
    <Card className="p-4">
      <div className="space-y-4">
        <div>
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold">Concept Coverage</h3>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs">
                Avg: {coverageStats.averageScore}/100
              </Badge>
              <Badge variant="outline">
                {coverageStats.coveredCount} / {coverageStats.totalConcepts}
              </Badge>
            </div>
          </div>
          <Progress value={coverageStats.coveragePercentage} className="h-2" />
          
          {/* Confidence breakdown */}
          <div className="flex gap-2 mt-2 text-xs">
            {coverageStats.byConfidence.high > 0 && (
              <span className="text-green-600">
                {coverageStats.byConfidence.high} mastered
              </span>
            )}
            {coverageStats.byConfidence.medium > 0 && (
              <span className="text-yellow-600">
                {coverageStats.byConfidence.medium} developing
              </span>
            )}
            {coverageStats.byConfidence.low > 0 && (
              <span className="text-gray-500">
                {coverageStats.byConfidence.low} exposed
              </span>
            )}
          </div>
        </div>

        <div className="space-y-3">
          {Object.entries(conceptsByDifficulty).map(([difficulty, concepts]) => (
            <div key={difficulty}>
              <h4 className="text-xs font-medium text-gray-600 uppercase mb-2">
                {difficulty}
              </h4>
              <div className="space-y-1">
                {concepts.map(concept => {
                  const covered = isCovered(concept.id);
                  const confidence = getConfidenceForConcept(concept.id);
                  const evidence = getEvidenceForConcept(concept.id);
                  const config = confidenceConfig[confidence];
                  
                  return (
                    <div
                      key={concept.id}
                      className={`group relative flex items-center gap-2 p-2 rounded text-sm ${config.bgColor}`}
                      title={`${concept.name} - ${config.label}${evidence ? ` (Score: ${evidence.score})` : ''}`}
                    >
                      {covered ? (
                        <CheckCircle2 className={`size-4 ${config.textColor} shrink-0`} />
                      ) : (
                        <Circle className="size-4 text-gray-400 shrink-0" />
                      )}
                      <span className={covered ? config.textColor : 'text-gray-600'}>
                        {concept.name}
                      </span>
                      
                      {/* Evidence indicator */}
                      {evidence && (
                        <div className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity">
                          <Badge variant="outline" className="text-xs font-normal">
                            {evidence.score} pts
                          </Badge>
                        </div>
                      )}
                      
                      {/* Hover tooltip */}
                      {evidence && (
                        <div className="absolute left-full top-0 ml-2 z-10 w-48 p-2 bg-white border rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                          <EvidenceTooltip evidence={evidence} />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Legend */}
        <div className="pt-2 border-t text-xs text-gray-500 space-y-1">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-green-500" />
              Mastered (75+)
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-yellow-500" />
              Developing (40+)
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-gray-400" />
              Exposed
            </span>
          </div>
          <p className="text-xs text-gray-400 mt-1">
            Hover over concepts to see detailed evidence breakdown
          </p>
        </div>
      </div>
    </Card>
  );
}
