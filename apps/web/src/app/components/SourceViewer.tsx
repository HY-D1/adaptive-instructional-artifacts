/**
 * Source Viewer Component (Week 3 D7)
 * 
 * Displays textbook source passages for grounded help content.
 * Shows: docId, page number, passage text, concept tags
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { BookOpen, ChevronDown, ChevronUp, FileText, Hash, Bookmark } from 'lucide-react';
import type { RetrievalSourcePassage } from '../lib/retrieval-bundle';
import { storage } from '../lib/storage';

export type SourceViewerProps = {
  passages: RetrievalSourcePassage[];
  conceptLabels?: Record<string, string>; // conceptId -> label
  initiallyExpanded?: boolean;
  maxHeight?: number;
  className?: string;
  // Week 3 D8: Props for logging source_view events
  problemId?: string;
  learnerId?: string;
  sessionId?: string;
};

export function SourceViewer({
  passages,
  conceptLabels = {},
  initiallyExpanded = false,
  maxHeight = 300,
  className = '',
  // Week 3 D8: Logging props
  problemId,
  learnerId,
  sessionId
}: SourceViewerProps) {
  const [isExpanded, setIsExpanded] = useState(initiallyExpanded);
  const [selectedPassageId, setSelectedPassageId] = useState<string | null>(null);
  const hasLoggedViewRef = useRef(false);

  // Week 3 D8: Log source_view event when expanded
  const handleToggleExpanded = useCallback(() => {
    const newExpanded = !isExpanded;
    setIsExpanded(newExpanded);

    // Log when expanded (not when collapsing), and only once per mount
    if (newExpanded && !hasLoggedViewRef.current && learnerId && problemId) {
      hasLoggedViewRef.current = true;
      const uniqueConceptIds = Array.from(new Set(passages.map(p => p.conceptId)));
      storage.logSourceView({
        learnerId,
        problemId,
        passageCount: passages.length,
        conceptIds: uniqueConceptIds,
        expanded: true,
        sessionId
      });
    }
  }, [isExpanded, learnerId, problemId, passages, sessionId]);

  // Reset logged flag when problem/learner changes
  useEffect(() => {
    hasLoggedViewRef.current = false;
  }, [problemId, learnerId, sessionId]);

  // Group passages by concept for better organization
  const passagesByConcept = passages.reduce((acc, passage) => {
    if (!acc[passage.conceptId]) {
      acc[passage.conceptId] = [];
    }
    acc[passage.conceptId].push(passage);
    return acc;
  }, {} as Record<string, RetrievalSourcePassage[]>);

  const uniqueConceptIds = Object.keys(passagesByConcept);
  const totalPassages = passages.length;

  if (passages.length === 0) {
    return (
      <div className={`rounded-lg border border-dashed border-gray-200 bg-gray-50/50 p-4 ${className}`}>
        <div className="flex items-center gap-2 text-gray-400">
          <BookOpen className="size-4" />
          <span className="text-sm">No sources available</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`rounded-lg border border-gray-200 bg-white overflow-hidden ${className}`}>
      {/* Header */}
      <button
        onClick={handleToggleExpanded}
        className="flex w-full items-center justify-between p-3 text-left hover:bg-gray-50/80 transition-all min-w-0"
      >
        <div className="flex items-center gap-2 min-w-0">
          <div className="p-1.5 bg-blue-50 rounded-md">
            <BookOpen className="size-4 text-blue-600 shrink-0" />
          </div>
          <span className="font-medium text-gray-900 text-sm truncate">
            Sources
          </span>
          <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700 shrink-0">
            {totalPassages}
          </span>
        </div>
        <div className="shrink-0 ml-2">
          {isExpanded ? (
            <ChevronUp className="size-4 text-gray-400" />
          ) : (
            <ChevronDown className="size-4 text-gray-400" />
          )}
        </div>
      </button>

      {/* Expanded content */}
      {isExpanded && (
        <div 
          className="border-t border-gray-100 overflow-y-auto"
          style={{ maxHeight }}
        >
          <div className="p-3 space-y-4">
            {uniqueConceptIds.map((conceptId) => {
              const conceptPassages = passagesByConcept[conceptId];
              const conceptLabel = conceptLabels[conceptId] || conceptId;
              
              return (
                <div key={conceptId} className="space-y-2">
                  {/* Concept header */}
                  <div className="flex items-center gap-2">
                    <Hash className="size-3 text-gray-400" />
                    <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                      {conceptLabel}
                    </span>
                  </div>
                  
                  {/* Passages for this concept */}
                  <div className="space-y-2 pl-4">
                    {conceptPassages.map((passage) => (
                      <PassageCard
                        key={passage.passageId}
                        passage={passage}
                        isSelected={selectedPassageId === passage.passageId}
                        onSelect={() => setSelectedPassageId(
                          selectedPassageId === passage.passageId ? null : passage.passageId
                        )}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
          
          {/* Footer with grounding indicator */}
          <div className="border-t border-gray-100 p-3 bg-gray-50/50">
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <div className="size-2 rounded-full bg-green-500" />
              <span>Grounded in textbook sources</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Clean up PDF text for better readability
function cleanPdfText(text: string): string {
  return text
    // Remove index entries (lines with just keywords and page numbers)
    .replace(/^[A-Z][a-z]+.*\d+-\d+$/gm, '')
    // Fix common OCR issues
    .replace(/_/g, '')
    .replace(/nwnber/g, 'number')
    .replace(/amnunt/g, 'amount')
    .replace(/cilias/g, 'alias')
    .replace(/ca11/g, 'can')
    .replace(/re.lationship/g, 'relationship')
    .replace(/desoiption/g, 'description')
    .replace(/Pubftshers/g, 'Publishers')
    .replace(/Prospect &st/g, 'Prospect List')
    // Remove multiple spaces
    .replace(/\s+/g, ' ')
    // Remove figure captions that aren't helpful
    .replace(/Figure \d+-\d+[^.]*/g, '')
    // Clean up bullet points
    .replace(/[►•]/g, '•')
    .trim();
}

// Individual passage card
function PassageCard({
  passage,
  isSelected,
  onSelect
}: {
  passage: RetrievalSourcePassage;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const cleanedText = cleanPdfText(passage.text);
  
  // Skip if cleaned text is too short (likely just index entries)
  if (cleanedText.length < 50) {
    return null;
  }
  
  return (
    <div
      onClick={onSelect}
      className={`
        rounded-md border p-3 cursor-pointer transition-all
        ${isSelected 
          ? 'border-blue-300 bg-blue-50/50 ring-1 ring-blue-200' 
          : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm'
        }
      `}
    >
      {/* Passage header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <FileText className="size-3" />
          <span className="font-medium">{passage.docId}</span>
          <span className="text-gray-300">|</span>
          <span>Page {passage.page}</span>
        </div>
        {isSelected && (
          <span className="text-xs text-blue-600 font-medium">Selected</span>
        )}
      </div>
      
      {/* Passage text */}
      <div className={`
        text-sm text-gray-700 leading-relaxed prose prose-sm max-w-none
        ${isSelected ? '' : 'line-clamp-4'}
      `}>
        {cleanedText.split('\n').map((paragraph, i) => (
          <p key={i} className="mb-2 last:mb-0">
            {paragraph}
          </p>
        ))}
      </div>
      
      {/* Expand hint */}
      {!isSelected && cleanedText.length > 200 && (
        <div className="mt-2 text-xs text-blue-600">
          Click to expand
        </div>
      )}
    </div>
  );
}

// Compact source badge for inline display
export function SourceBadge({
  count,
  onClick
}: {
  count: number;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-1 text-xs text-blue-700 hover:bg-blue-100 transition-colors"
    >
      <BookOpen className="size-3" />
      <span>{count} source{count !== 1 ? 's' : ''}</span>
    </button>
  );
}

// Rung indicator component - Clean, modern design
export function RungIndicator({
  rung,
  showLabel = true,
  size = 'md'
}: {
  rung: 1 | 2 | 3;
  showLabel?: boolean;
  size?: 'sm' | 'md' | 'lg';
}) {
  const rungConfig = {
    1: { 
      label: 'Hint', 
      color: 'bg-amber-50 text-amber-700 border-amber-200',
      iconColor: 'text-amber-500'
    },
    2: { 
      label: 'Explain', 
      color: 'bg-blue-50 text-blue-700 border-blue-200',
      iconColor: 'text-blue-500'
    },
    3: { 
      label: 'Note', 
      color: 'bg-purple-50 text-purple-700 border-purple-200',
      iconColor: 'text-purple-500'
    }
  };
  
  const config = rungConfig[rung];
  const sizeClasses = {
    sm: 'px-2 py-0.5 text-xs gap-1',
    md: 'px-2.5 py-1 text-xs gap-1.5',
    lg: 'px-3 py-1.5 text-sm gap-2'
  };
  
  return (
    <div className={`
      inline-flex items-center rounded-full font-medium border
      ${config.color}
      ${sizeClasses[size]}
    `}>
      <Bookmark className={`size-3 ${config.iconColor}`} />
      {showLabel && <span>{config.label}</span>}
      <span className="opacity-60">• {rung}/3</span>
    </div>
  );
}

// Concept tag component
export function ConceptTag({
  conceptId,
  label,
  onClick
}: {
  conceptId: string;
  label?: string;
  onClick?: () => void;
}) {
  return (
    <span
      onClick={onClick}
      className={`
        inline-flex items-center gap-1 rounded-md bg-gray-100 px-2 py-1 text-xs text-gray-700
        ${onClick ? 'cursor-pointer hover:bg-gray-200' : ''}
      `}
    >
      <Hash className="size-3 text-gray-400" />
      <span className="truncate max-w-[120px]">{label || conceptId}</span>
    </span>
  );
}

// Add to My Textbook button
export function AddToTextbookButton({
  onClick,
  disabled = false,
  loading = false
}: {
  onClick: () => void;
  disabled?: boolean;
  loading?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      className={`
        w-full sm:flex-1 inline-flex items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-medium
        transition-colors h-9
        ${disabled 
          ? 'bg-gray-100 text-gray-400 cursor-not-allowed' 
          : 'bg-purple-600 text-white hover:bg-purple-700 shadow-sm hover:shadow'
        }
      `}
    >
      {loading ? (
        <>
          <div className="size-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
          <span>Adding...</span>
        </>
      ) : (
        <>
          <Bookmark className="size-4" />
          <span className="hidden sm:inline">Save to Notes</span>
          <span className="sm:hidden">Save</span>
        </>
      )}
    </button>
  );
}
