/**
 * HintDisplay Component
 *
 * Renders a single hint with expand/collapse functionality,
 * source attribution, and helpfulness rating.
 */

import { useState } from 'react';
import DOMPurify from 'dompurify';
import { ChevronDown, ChevronUp, Sparkles, ThumbsUp, ThumbsDown, Loader2 } from 'lucide-react';
import { Button } from '../../../ui/button';
import { cn } from '../../../ui/utils';
import type { EnhancedHint } from '../../../../lib/ml/hint-service';

export interface HintDisplayProps {
  /** Hint index in the list */
  index: number;
  /** The hint content */
  hint: string;
  /** Enhanced hint metadata */
  enhancedInfo?: {
    isEnhanced: boolean;
    sources: { sqlEngage: boolean; textbook: boolean; llm: boolean; pdfPassages: boolean };
    llmFailed?: boolean;
    llmErrorMessage?: string;
  };
  /** PDF passages associated with this hint */
  pdfPassages?: RetrievalPdfPassage[];
  /** Current helpfulness rating */
  rating?: 'helpful' | 'not_helpful' | null;
  /** Callback when rating changes */
  onRate?: (rating: 'helpful' | 'not_helpful') => void;
  /** Callback when expand/collapse changes */
  onExpandChange?: (expanded: boolean) => void;
  /** Whether this is the latest hint */
  isLatest?: boolean;
}

import type { RetrievalPdfPassage } from '../../../../lib/content/retrieval-bundle';

export function HintDisplay({
  index,
  hint,
  enhancedInfo,
  pdfPassages,
  rating,
  onRate,
  onExpandChange,
  isLatest = false,
}: HintDisplayProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const handleToggle = () => {
    const newExpanded = !isExpanded;
    setIsExpanded(newExpanded);
    onExpandChange?.(newExpanded);
  };

  // Sanitize hint content
  const sanitizedHint = DOMPurify.sanitize(hint, {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'code', 'pre', 'p', 'br', 'ul', 'ol', 'li'],
    ALLOWED_ATTR: [],
  });

  const hasSources = enhancedInfo?.sources &&
    (enhancedInfo.sources.textbook || enhancedInfo.sources.llm || enhancedInfo.sources.pdfPassages);

  return (
    <div
      className={cn(
        'rounded-lg border p-4 transition-all',
        isLatest
          ? 'border-blue-200 bg-blue-50/50 shadow-sm'
          : 'border-gray-200 bg-white'
      )}
      data-testid={`hint-display-${index}`}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-500">Hint {index + 1}</span>
          {hasSources && (
            <span className="flex items-center gap-1 text-xs text-purple-600">
              <Sparkles className="h-3 w-3" />
              Enhanced
            </span>
          )}
        </div>

        <Button
          variant="ghost"
          size="sm"
          onClick={handleToggle}
          className="h-8 w-8 p-0"
          aria-label={isExpanded ? 'Collapse hint' : 'Expand hint'}
        >
          {isExpanded ? (
            <ChevronUp className="h-4 w-4" />
          ) : (
            <ChevronDown className="h-4 w-4" />
          )}
        </Button>
      </div>

      {/* Content */}
      <div className="mt-2">
        <div
          className={cn(
            'prose prose-sm max-w-none text-gray-700',
            !isExpanded && 'line-clamp-3'
          )}
          dangerouslySetInnerHTML={{ __html: sanitizedHint }}
        />

        {/* LLM Error */}
        {enhancedInfo?.llmFailed && (
          <div className="mt-2 rounded bg-amber-50 p-2 text-xs text-amber-700">
            Note: AI generation failed. Using standard hint.
          </div>
        )}
      </div>

      {/* Footer with actions */}
      <div className="mt-3 flex items-center justify-between">
        {/* Helpfulness rating */}
        <div className="flex items-center gap-1">
          <span className="text-xs text-gray-500">Was this helpful?</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onRate?.('helpful')}
            className={cn(
              'h-7 w-7 p-0',
              rating === 'helpful' && 'bg-green-100 text-green-700'
            )}
            aria-label="Mark as helpful"
          >
            <ThumbsUp className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onRate?.('not_helpful')}
            className={cn(
              'h-7 w-7 p-0',
              rating === 'not_helpful' && 'bg-red-100 text-red-700'
            )}
            aria-label="Mark as not helpful"
          >
            <ThumbsDown className="h-3.5 w-3.5" />
          </Button>
        </div>

        {/* Source indicator */}
        {hasSources && (
          <div className="flex items-center gap-2 text-xs text-gray-500">
            {enhancedInfo.sources.textbook && (
              <span className="rounded bg-green-100 px-1.5 py-0.5 text-green-700">
                Textbook
              </span>
            )}
            {enhancedInfo.sources.llm && (
              <span className="rounded bg-purple-100 px-1.5 py-0.5 text-purple-700">
                AI
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
