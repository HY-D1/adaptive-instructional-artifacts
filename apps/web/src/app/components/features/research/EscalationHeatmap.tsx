import { useMemo } from 'react';
import type { InteractionEvent } from '../../../types';

interface Props {
  interactions?: InteractionEvent[];
  maxLearners?: number;
  maxProblems?: number;
}

interface HeatmapData {
  learners: string[];
  problems: string[];
  data: Record<string, Record<string, number>>;
}

const RUNG_COLORS = {
  0: '#f3f4f6', // No help - gray-100
  1: '#dbeafe', // Rung 1 - blue-100
  2: '#93c5fd', // Rung 2 - blue-300
  3: '#2563eb', // Rung 3 - blue-600
};

const RUNG_LABELS = {
  0: 'No help',
  1: 'Rung 1',
  2: 'Rung 2',
  3: 'Rung 3',
};

export function EscalationHeatmap({ 
  interactions: interactionsProp, 
  maxLearners = 20, 
  maxProblems = 15 
}: Props) {
  // Defensive: ensure interactions is always an array
  const interactions = interactionsProp ?? [];
  
  const heatmapData = useMemo<HeatmapData>(() => {
    const learners = [...new Set(interactions.map(i => i.learnerId))];
    const problems = [...new Set(interactions.map(i => i.problemId).filter((p): p is string => !!p))];
    
    const data: Record<string, Record<string, number>> = {};
    
    for (const learner of learners) {
      data[learner] = {};
      for (const problem of problems) {
        // Find max rung reached for this learner/problem
        const maxRung = interactions
          .filter(i => i.learnerId === learner && i.problemId === problem)
          .reduce((max, i) => {
            const rung = i.rung || i.toRung || i.hintLevel || 0;
            return Math.max(max, rung);
          }, 0);
        data[learner][problem] = maxRung;
      }
    }
    
    return { 
      learners: learners.slice(0, maxLearners), 
      problems: problems.slice(0, maxProblems), 
      data 
    };
  }, [interactions, maxLearners, maxProblems]);
  
  if (interactions.length === 0) {
    return (
      <div className="p-8 text-center text-gray-500">
        No interaction data available
      </div>
    );
  }

  if (heatmapData.learners.length === 0 || heatmapData.problems.length === 0) {
    return (
      <div className="p-8 text-center text-gray-500">
        No escalation data available for visualization
      </div>
    );
  }
  
  return (
    <div className="space-y-4">
      <div className="overflow-x-auto">
        <table className="border-collapse">
          <thead>
            <tr>
              <th className="p-2 text-left text-xs font-medium text-gray-500 sticky left-0 bg-white z-10">
                Learner
              </th>
              {heatmapData.problems.map(p => (
                <th 
                  key={p} 
                  className="p-1 text-xs font-medium text-gray-500"
                  style={{ 
                    minWidth: 32,
                    maxWidth: 80,
                    writingMode: 'vertical-rl',
                    textOrientation: 'mixed',
                    transform: 'rotate(180deg)',
                    whiteSpace: 'nowrap'
                  }}
                >
                  {p && p.length > 12 ? `${p.slice(0, 12)}...` : p}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {heatmapData.learners.map(learner => (
              <tr key={learner}>
                <td className="p-2 text-xs font-medium text-gray-700 sticky left-0 bg-white z-10 border-r">
                  {learner.slice(0, 10)}{learner.length > 10 ? '...' : ''}
                </td>
                {heatmapData.problems.map(problem => {
                  const rung = heatmapData.data[learner]?.[problem] || 0;
                  return (
                    <td key={`${learner}-${problem}`} className="p-1">
                      <div 
                        className="w-6 h-6 rounded transition-all hover:scale-110 hover:ring-2 hover:ring-blue-400"
                        style={{ 
                          backgroundColor: RUNG_COLORS[rung as keyof typeof RUNG_COLORS] || RUNG_COLORS[0]
                        }}
                        title={`Learner: ${learner}\nProblem: ${problem}\nRung: ${RUNG_LABELS[rung as keyof typeof RUNG_LABELS]}`}
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      {/* Legend */}
      <div className="flex flex-wrap items-center gap-4 pt-4 border-t text-sm">
        <span className="text-gray-500 font-medium">Legend:</span>
        {(Object.keys(RUNG_COLORS) as unknown as number[]).map(rung => (
          <span key={rung} className="flex items-center gap-1.5">
            <div 
              className="w-4 h-4 rounded border border-gray-200" 
              style={{ backgroundColor: RUNG_COLORS[rung as keyof typeof RUNG_COLORS] }}
            />
            <span className="text-gray-600">{RUNG_LABELS[rung as keyof typeof RUNG_LABELS]}</span>
          </span>
        ))}
      </div>

      {/* Summary stats */}
      <div className="pt-4 border-t">
        <div className="grid grid-cols-4 gap-4 text-center">
          {(Object.keys(RUNG_COLORS) as unknown as number[]).map(rung => {
            let count = 0;
            let total = 0;
            for (const learner of heatmapData.learners) {
              for (const problem of heatmapData.problems) {
                total++;
                if (heatmapData.data[learner]?.[problem] === rung) {
                  count++;
                }
              }
            }
            const percentage = total > 0 ? Math.round((count / total) * 100) : 0;
            return (
              <div key={rung} className="p-2 bg-gray-50 rounded">
                <div className="text-lg font-semibold" style={{ color: rung === 0 ? '#6b7280' : '#2563eb' }}>
                  {percentage}%
                </div>
                <div className="text-xs text-gray-500">{RUNG_LABELS[rung as keyof typeof RUNG_LABELS]}</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
