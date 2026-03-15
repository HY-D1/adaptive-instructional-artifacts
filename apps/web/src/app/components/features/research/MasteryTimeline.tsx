import { useMemo } from 'react';
import { Badge } from '../../ui/badge';
import type { InteractionEvent } from '../../../types';

interface Props {
  interactions: InteractionEvent[];
  learnerId: string;
  maxEvents?: number;
}

type TimelineEventType = 'error' | 'success' | 'hint' | 'explanation' | 'other';

interface TimelineEvent {
  timestamp: number;
  type: TimelineEventType;
  eventType: string;
  concepts: string[];
  problemId: string;
  details: string;
}

const EVENT_TYPE_CONFIG: Record<TimelineEventType, { color: string; bg: string; label: string; icon: string }> = {
  error: {
    color: '#ef4444',
    bg: '#fef2f2',
    label: 'Error',
    icon: '⚠'
  },
  success: {
    color: '#22c55e',
    bg: '#f0fdf4',
    label: 'Success',
    icon: '✓'
  },
  hint: {
    color: '#3b82f6',
    bg: '#eff6ff',
    label: 'Hint',
    icon: '?'
  },
  explanation: {
    color: '#8b5cf6',
    bg: '#faf5ff',
    label: 'Explanation',
    icon: '!'
  },
  other: {
    color: '#6b7280',
    bg: '#f9fafb',
    label: 'Other',
    icon: '•'
  }
};

function classifyEventType(eventType: string, successful?: boolean): TimelineEventType {
  if (eventType === 'error') return 'error';
  if (eventType === 'execution' && successful) return 'success';
  if (eventType === 'hint_request' || eventType === 'hint_view' || eventType === 'guidance_request') return 'hint';
  if (eventType === 'explanation_view' || eventType === 'guidance_view') return 'explanation';
  return 'other';
}

export function MasteryTimeline({ interactions, learnerId, maxEvents = 20 }: Props) {
  const timeline = useMemo<TimelineEvent[]>(() => {
    // Get concept-related events for this learner
    const learnerEvents = interactions
      .filter(i => i.learnerId === learnerId)
      .sort((a, b) => a.timestamp - b.timestamp);
    
    // Track concept mastery over time
    const conceptMastery = new Map<string, number>();
    
    return learnerEvents.map(event => {
      const type = classifyEventType(event.eventType, event.successful);
      const concepts = event.conceptIds || [];
      
      // Update concept mastery scores
      if (type === 'success') {
        for (const concept of concepts) {
          const current = conceptMastery.get(concept) || 0;
          conceptMastery.set(concept, Math.min(current + 20, 100));
        }
      }
      
      // Generate details string
      let details = '';
      if (event.errorSubtypeId) {
        details = `Error: ${event.errorSubtypeId}`;
      } else if (event.hintLevel) {
        details = `Rung ${event.hintLevel}`;
      } else if (event.toRung) {
        details = `Escalated to Rung ${event.toRung}`;
      }
      
      return {
        timestamp: event.timestamp,
        type,
        eventType: event.eventType,
        concepts,
        problemId: event.problemId,
        details
      };
    });
  }, [interactions, learnerId]);
  
  const visibleEvents = timeline.slice(-maxEvents);
  
  if (timeline.length === 0) {
    return (
      <div className="p-8 text-center text-gray-500">
        No timeline data available for this learner
      </div>
    );
  }

  // Calculate concept progress
  const conceptProgress = useMemo(() => {
    const progress = new Map<string, { successes: number; errors: number; lastSeen: number }>();
    
    for (const event of timeline) {
      for (const concept of event.concepts) {
        if (!progress.has(concept)) {
          progress.set(concept, { successes: 0, errors: 0, lastSeen: event.timestamp });
        }
        const p = progress.get(concept)!;
        p.lastSeen = event.timestamp;
        if (event.type === 'success') p.successes++;
        if (event.type === 'error') p.errors++;
      }
    }
    
    return Array.from(progress.entries())
      .map(([concept, stats]) => ({
        concept,
        ...stats,
        mastery: stats.successes / Math.max(1, stats.successes + stats.errors)
      }))
      .sort((a, b) => b.lastSeen - a.lastSeen)
      .slice(0, 5);
  }, [timeline]);
  
  return (
    <div className="space-y-6">
      {/* Concept Progress Summary */}
      {conceptProgress.length > 0 && (
        <div className="p-4 bg-gray-50 rounded-lg">
          <h4 className="text-sm font-semibold text-gray-700 mb-3">Recent Concept Progress</h4>
          <div className="space-y-2">
            {conceptProgress.map(cp => (
              <div key={cp.concept} className="flex items-center gap-3">
                <span className="text-xs text-gray-600 w-32 truncate">{cp.concept}</span>
                <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div 
                    className="h-full rounded-full transition-all"
                    style={{ 
                      width: `${cp.mastery * 100}%`,
                      backgroundColor: cp.mastery > 0.7 ? '#22c55e' : cp.mastery > 0.4 ? '#f59e0b' : '#ef4444'
                    }}
                  />
                </div>
                <span className="text-xs text-gray-500 w-16 text-right">
                  {Math.round(cp.mastery * 100)}%
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* Timeline */}
      <div className="relative">
        {/* Timeline line */}
        <div className="absolute left-7 top-0 bottom-0 w-0.5 bg-gray-200" />
        
        <div className="space-y-4 max-h-96 overflow-y-auto pr-2">
          {visibleEvents.map((event, i) => {
            const config = EVENT_TYPE_CONFIG[event.type];
            return (
              <div key={i} className="flex items-start gap-4 relative">
                {/* Timestamp */}
                <div className="text-xs text-gray-500 w-16 pt-1">
                  {new Date(event.timestamp).toLocaleTimeString([], { 
                    hour: '2-digit', 
                    minute: '2-digit' 
                  })}
                </div>
                
                {/* Dot indicator */}
                <div 
                  className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold z-10 flex-shrink-0"
                  style={{ 
                    backgroundColor: config.bg,
                    color: config.color,
                    border: `2px solid ${config.color}`
                  }}
                >
                  {config.icon}
                </div>
                
                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge 
                      variant="outline" 
                      style={{ 
                        borderColor: config.color,
                        color: config.color,
                        backgroundColor: config.bg
                      }}
                      className="text-xs"
                    >
                      {config.label}
                    </Badge>
                    
                    <span className="text-xs text-gray-500">
                      {event.problemId}
                    </span>
                    
                    {event.details && (
                      <span className="text-xs text-gray-600">
                        {event.details}
                      </span>
                    )}
                  </div>
                  
                  {event.concepts.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {event.concepts.map(c => (
                        <span 
                          key={c} 
                          className="text-xs px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded"
                        >
                          {c}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      
      {/* Summary stats */}
      <div className="pt-4 border-t grid grid-cols-4 gap-2">
        {(Object.keys(EVENT_TYPE_CONFIG) as TimelineEventType[]).map(type => {
          const count = timeline.filter(e => e.type === type).length;
          const config = EVENT_TYPE_CONFIG[type];
          return (
            <div 
              key={type} 
              className="text-center p-2 rounded"
              style={{ backgroundColor: config.bg }}
            >
              <div className="text-lg font-bold" style={{ color: config.color }}>
                {count}
              </div>
              <div className="text-xs" style={{ color: config.color }}>
                {config.label}
              </div>
            </div>
          );
        })}
      </div>
      
      {timeline.length > maxEvents && (
        <div className="text-center text-sm text-gray-500">
          Showing last {maxEvents} of {timeline.length} events
        </div>
      )}
    </div>
  );
}

interface MultiLearnerTimelineProps {
  interactions: InteractionEvent[];
  learnerIds: string[];
  maxEventsPerLearner?: number;
}

export function MultiLearnerMasteryTimeline({ 
  interactions, 
  learnerIds, 
  maxEventsPerLearner = 10 
}: MultiLearnerTimelineProps) {
  return (
    <div className="space-y-6">
      {learnerIds.map(learnerId => (
        <div key={learnerId} className="border rounded-lg p-4">
          <h4 className="font-semibold text-gray-700 mb-3">{learnerId}</h4>
          <MasteryTimeline 
            interactions={interactions} 
            learnerId={learnerId} 
            maxEvents={maxEventsPerLearner}
          />
        </div>
      ))}
    </div>
  );
}
