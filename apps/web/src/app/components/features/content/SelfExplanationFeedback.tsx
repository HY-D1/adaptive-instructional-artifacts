import { useMemo, useEffect } from 'react';
import { Badge } from '../../ui/badge';
import { scoreSelfExplanation, type ReflectionQualityScore, getQualityLevel } from '../../../lib/content/self-explanation-scorer';

interface SelfExplanationFeedbackProps {
  text: string;
  conceptIds: string[];
  originalProblem?: string;
  onScore?: (score: ReflectionQualityScore) => void;
  showDetails?: boolean;
}

/**
 * SelfExplanationFeedback Component
 * 
 * Displays real-time quality feedback for self-explanation/reflection text.
 * Shows a composite score and breakdown across 5 dimensions.
 */
export function SelfExplanationFeedback({
  text,
  conceptIds,
  originalProblem = '',
  onScore,
  showDetails = true
}: SelfExplanationFeedbackProps) {
  const score = useMemo(() => {
    if (text.length < 10) return null;
    return scoreSelfExplanation({
      text,
      originalProblem,
      conceptIds,
      learnerId: 'current'
    });
  }, [text, originalProblem, conceptIds]);

  useEffect(() => {
    if (score && onScore) {
      onScore(score);
    }
  }, [score, onScore]);

  if (!score) {
    return (
      <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg mt-4 text-sm text-gray-500">
        Start typing your reflection to see quality feedback...
      </div>
    );
  }

  const qualityLevel = getQualityLevel(score.overall);
  const qualityConfig = QUALITY_CONFIG[qualityLevel];

  return (
    <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg mt-4">
      {/* Overall Score Header */}
      <div className="flex items-center gap-3 mb-4">
        <div className={`w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold ${qualityConfig.bgColor} ${qualityConfig.textColor}`}>
          {score.overall}
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              Reflection Quality
            </span>
            <Badge className={qualityConfig.badgeClass}>
              {qualityConfig.label}
            </Badge>
          </div>
          <p className="text-sm text-gray-500">
            {qualityLevel === 'excellent' && 'Excellent reflection with strong understanding'}
            {qualityLevel === 'good' && 'Good reflection with minor areas to improve'}
            {qualityLevel === 'needs-work' && 'Consider expanding your reflection'}
          </p>
        </div>
      </div>

      {showDetails && (
        <>
          {/* Dimension Bars */}
          <div className="space-y-3 mb-4">
            <QualityBar 
              label="Originality" 
              value={score.dimensions.paraphrase} 
              description="How much you use your own words"
            />
            <QualityBar 
              label="Length" 
              value={score.dimensions.length} 
              description="Appropriate amount of detail"
            />
            <QualityBar 
              label="Keywords" 
              value={score.dimensions.conceptKeywords} 
              description="Technical terms related to the concept"
            />
            <QualityBar 
              label="Examples" 
              value={score.dimensions.exampleInclusion} 
              description="Concrete examples or code snippets"
            />
            <QualityBar 
              label="Structure" 
              value={score.dimensions.structuralCompleteness} 
              description="Root cause, fix, and prevention covered"
            />
          </div>

          {/* Feedback Messages */}
          {score.feedback.length > 0 && (
            <div className="text-sm">
              <p className="font-medium text-gray-700 dark:text-gray-300 mb-2">
                Suggestions for improvement:
              </p>
              <ul className="space-y-1.5">
                {score.feedback.map((feedbackItem, index) => (
                  <li 
                    key={index} 
                    className="flex items-start gap-2 text-gray-600 dark:text-gray-400"
                  >
                    <span className="text-blue-500 mt-0.5">•</span>
                    <span>{feedbackItem}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Flagged Issues */}
          {score.flaggedIssues.length > 0 && (
            <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 rounded-md">
              <p className="text-sm font-medium text-red-700 dark:text-red-400 mb-1">
                Issues detected:
              </p>
              <div className="flex flex-wrap gap-2">
                {score.flaggedIssues.map((issue) => (
                  <Badge 
                    key={issue} 
                    variant="outline" 
                    className="text-red-600 border-red-300"
                  >
                    {formatIssueLabel(issue)}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

interface QualityBarProps {
  label: string;
  value: number;
  description?: string;
}

function QualityBar({ label, value, description }: QualityBarProps) {
  const colorClass = value >= 70 
    ? 'bg-green-500' 
    : value >= 40 
      ? 'bg-yellow-500' 
      : 'bg-red-500';

  return (
    <div className="group">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-gray-600 dark:text-gray-400 w-16">
            {label}
          </span>
          {description && (
            <span className="text-xs text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity">
              {description}
            </span>
          )}
        </div>
        <span className={`text-xs font-semibold w-8 text-right ${
          value >= 70 ? 'text-green-600' : value >= 40 ? 'text-yellow-600' : 'text-red-600'
        }`}>
          {value}
        </span>
      </div>
      <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
        <div 
          className={`h-full rounded-full transition-all duration-300 ${colorClass}`}
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  );
}

const QUALITY_CONFIG = {
  'excellent': {
    label: 'Excellent',
    bgColor: 'bg-green-100 dark:bg-green-900',
    textColor: 'text-green-700 dark:text-green-300',
    badgeClass: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
  },
  'good': {
    label: 'Good',
    bgColor: 'bg-blue-100 dark:bg-blue-900',
    textColor: 'text-blue-700 dark:text-blue-300',
    badgeClass: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
  },
  'needs-work': {
    label: 'Needs Work',
    bgColor: 'bg-red-100 dark:bg-red-900',
    textColor: 'text-red-700 dark:text-red-300',
    badgeClass: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
  }
} as const;

function formatIssueLabel(issue: string): string {
  const labels: Record<string, string> = {
    'EXCESSIVE_COPYING': 'Too much copying',
    'TOO_SHORT': 'Too brief',
    'TOO_LONG': 'Too long',
    'MISSING_KEYWORDS': 'Missing keywords'
  };
  return labels[issue] || issue;
}

/**
 * Compact version of the feedback component
 * Shows only the overall score badge
 */
export function SelfExplanationScoreBadge({
  text,
  conceptIds,
  originalProblem = ''
}: Omit<SelfExplanationFeedbackProps, 'onScore' | 'showDetails'>) {
  const score = useMemo(() => {
    if (text.length < 10) return null;
    return scoreSelfExplanation({
      text,
      originalProblem,
      conceptIds,
      learnerId: 'current'
    });
  }, [text, originalProblem, conceptIds]);

  if (!score) return null;

  const qualityLevel = getQualityLevel(score.overall);
  const config = QUALITY_CONFIG[qualityLevel];

  return (
    <Badge className={config.badgeClass}>
      Quality: {score.overall}/100
    </Badge>
  );
}
