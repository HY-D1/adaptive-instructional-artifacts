import { Card } from './ui/card';
import { Badge } from './ui/badge';
import { Progress } from './ui/progress';
import { CheckCircle2, Circle } from 'lucide-react';
import { conceptNodes } from '../data/sql-engage';
import { storage } from '../lib/storage';

interface ConceptCoverageProps {
  learnerId: string;
}

export function ConceptCoverage({ learnerId }: ConceptCoverageProps) {
  const profile = storage.getProfile(learnerId);
  
  if (!profile) return null;

  const totalConcepts = conceptNodes.length;
  const coveredCount = profile.conceptsCovered.size;
  const coveragePercentage = (coveredCount / totalConcepts) * 100;

  const conceptsByDifficulty = conceptNodes.reduce((acc, concept) => {
    if (!acc[concept.difficulty]) {
      acc[concept.difficulty] = [];
    }
    acc[concept.difficulty].push(concept);
    return acc;
  }, {} as Record<string, typeof conceptNodes>);

  return (
    <Card className="p-4">
      <div className="space-y-4">
        <div>
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold">Concept Coverage</h3>
            <Badge variant="outline">
              {coveredCount} / {totalConcepts}
            </Badge>
          </div>
          <Progress value={coveragePercentage} className="h-2" />
        </div>

        <div className="space-y-3">
          {Object.entries(conceptsByDifficulty).map(([difficulty, concepts]) => (
            <div key={difficulty}>
              <h4 className="text-xs font-medium text-gray-600 uppercase mb-2">
                {difficulty}
              </h4>
              <div className="space-y-1">
                {concepts.map(concept => {
                  const isCovered = profile.conceptsCovered.has(concept.id);
                  return (
                    <div
                      key={concept.id}
                      className={`flex items-center gap-2 p-2 rounded text-sm ${
                        isCovered ? 'bg-green-50' : 'bg-gray-50'
                      }`}
                    >
                      {isCovered ? (
                        <CheckCircle2 className="size-4 text-green-600 shrink-0" />
                      ) : (
                        <Circle className="size-4 text-gray-400 shrink-0" />
                      )}
                      <span className={isCovered ? 'text-green-900' : 'text-gray-600'}>
                        {concept.name}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}
