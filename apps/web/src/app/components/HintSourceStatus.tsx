/**
 * Hint Source Status Component
 * 
 * Shows which resources are being used for hint generation:
 * - SQL-Engage (always)
 * - Textbook (if learner has saved units)
 * - LLM (if service available)
 * - PDF Index (if loaded)
 */

import { useState, useEffect } from 'react';
import { 
  Database, 
  BookOpen, 
  Brain, 
  FileText, 
  CheckCircle2, 
  XCircle,
  Sparkles,
  Info
} from 'lucide-react';
import { cn } from './ui/utils';
import { checkAvailableResources, type AvailableResources } from '../lib/enhanced-hint-service';

interface HintSourceStatusProps {
  learnerId: string;
  showDetails?: boolean;
  className?: string;
  /**
   * For student view, only show AI and Textbook sources.
   * Default is true (student mode).
   */
  studentMode?: boolean;
}

type SourceConfig = {
  key: keyof AvailableResources;
  label: string;
  icon: React.ReactNode;
  description: string;
  color: string;
};

const ALL_SOURCES: SourceConfig[] = [
  {
    key: 'sqlEngage',
    label: 'SQL-Engage',
    icon: <Database className="w-4 h-4" />,
    description: 'Curated hint dataset',
    color: 'text-blue-600 bg-blue-50 border-blue-200'
  },
  {
    key: 'textbook',
    label: 'Your Textbook',
    icon: <BookOpen className="w-4 h-4" />,
    description: 'Personal learning notes',
    color: 'text-green-600 bg-green-50 border-green-200'
  },
  {
    key: 'llm',
    label: 'AI Assistant',
    icon: <Brain className="w-4 h-4" />,
    description: 'LLM-powered explanations',
    color: 'text-purple-600 bg-purple-50 border-purple-200'
  },
  {
    key: 'pdfIndex',
    label: 'Course Materials',
    icon: <FileText className="w-4 h-4" />,
    description: 'PDF textbook passages',
    color: 'text-orange-600 bg-orange-50 border-orange-200'
  }
];

// For student mode, only show AI and Textbook
const STUDENT_SOURCES: SourceConfig[] = [
  {
    key: 'textbook',
    label: 'Your Textbook',
    icon: <BookOpen className="w-4 h-4" />,
    description: 'Personal learning notes',
    color: 'text-green-600 bg-green-50 border-green-200'
  },
  {
    key: 'llm',
    label: 'AI Assistant',
    icon: <Brain className="w-4 h-4" />,
    description: 'LLM-powered explanations',
    color: 'text-purple-600 bg-purple-50 border-purple-200'
  }
];

export function HintSourceStatus({ 
  learnerId, 
  showDetails = false,
  className,
  studentMode = true
}: HintSourceStatusProps) {
  const [resources, setResources] = useState<AvailableResources | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  
  // Select appropriate sources based on mode
  const SOURCES = studentMode ? STUDENT_SOURCES : ALL_SOURCES;
  
  useEffect(() => {
    const check = () => {
      const res = checkAvailableResources(learnerId);
      setResources(res);
    };
    
    check();
    // Re-check every 30 seconds in case resources change
    const interval = setInterval(check, 30000);
    return () => clearInterval(interval);
  }, [learnerId]);
  
  if (!resources) {
    return (
      <div className={cn("text-sm text-gray-500", className)}>
        Checking hint sources...
      </div>
    );
  }
  
  const activeCount = Object.values(resources).filter(Boolean).length;
  const isEnhanced = resources.llm || resources.textbook;
  
  // Compact view
  if (!showDetails && !isExpanded) {
    return (
      <button
        onClick={() => setIsExpanded(true)}
        className={cn(
          "flex items-center gap-2 text-xs px-2 py-1 rounded-full transition-colors",
          isEnhanced 
            ? "bg-gradient-to-r from-purple-50 to-blue-50 text-purple-700 border border-purple-200 hover:bg-purple-100"
            : "bg-gray-50 text-gray-600 border border-gray-200 hover:bg-gray-100",
          className
        )}
      >
        {isEnhanced ? (
          <Sparkles className="w-3 h-3 text-purple-500" />
        ) : (
          <Database className="w-3 h-3" />
        )}
        <span>
          {activeCount > 1 
            ? `${activeCount} hint sources active`
            : 'Standard hints'
          }
        </span>
        <Info className="w-3 h-3 opacity-50" />
      </button>
    );
  }
  
  // Expanded view
  return (
    <div className={cn(
      "bg-white rounded-lg border shadow-sm p-3",
      className
    )}>
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-sm font-medium text-gray-900 flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-purple-500" />
          Hint Sources
        </h4>
        <button
          onClick={() => setIsExpanded(false)}
          className="text-xs text-gray-400 hover:text-gray-600"
        >
          Hide
        </button>
      </div>
      
      <div className="space-y-2">
        {SOURCES.map((source) => {
          const isActive = resources[source.key];
          
          return (
            <div
              key={source.key}
              className={cn(
                "flex items-center gap-2 p-2 rounded-md border text-sm",
                isActive 
                  ? source.color 
                  : "text-gray-400 bg-gray-50 border-gray-200"
              )}
            >
              <div className={cn(
                "p-1 rounded",
                isActive ? "bg-white/50" : "bg-gray-100"
              )}>
                {source.icon}
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className={cn(
                    "font-medium",
                    isActive ? "" : "text-gray-500"
                  )}>
                    {source.label}
                  </span>
                  {isActive ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
                  ) : (
                    <XCircle className="w-3.5 h-3.5 text-gray-300" />
                  )}
                </div>
                <p className="text-xs opacity-80 truncate">
                  {source.description}
                </p>
              </div>
            </div>
          );
        })}
      </div>
      
      <p className="mt-3 text-xs text-gray-500 border-t pt-2">
        {resources.llm && resources.textbook
          ? "✨ You're getting AI-powered hints with your personal Textbook!"
          : resources.llm
          ? "🤖 AI-powered hints are active"
          : resources.textbook
          ? "📚 Hints include references from your Textbook"
          : studentMode
          ? "💡 Hints will use AI and Textbook when available"
          : "💡 Using curated SQL-Engage hint dataset"
        }
      </p>
    </div>
  );
}

export default HintSourceStatus;
