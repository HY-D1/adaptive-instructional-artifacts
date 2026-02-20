import { useEffect, useMemo, useRef, useState } from 'react';
import { Card } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Separator } from './ui/separator';
import { Book, Trash2, ChevronRight, ChevronDown, Folder, FileText, Star, ArrowUpDown, Layers, Archive } from 'lucide-react';
import type { TextbookUnitStatus } from '../types';
import { Link } from 'react-router';
import DOMPurify from 'dompurify';
import { marked, Renderer, type Token } from 'marked';
import { InstructionalUnit, InteractionEvent } from '../types';
import { storage } from '../lib/storage';
import { getConceptById } from '../data/sql-engage';
import { buildTextbookInsights, SortMode } from '../lib/textbook-insights';
import { 
  isBestQualityUnit, 
  getUnitDisplayStatus, 
  getAlternativeUnits,
  filterUnitsByStatus
} from '../lib/textbook-units';

interface AdaptiveTextbookProps {
  learnerId: string;
  selectedUnitId?: string;
  activeEvidenceId?: string;
  onSelectedUnitChange?: (unitId: string | undefined) => void;
  buildEvidenceHref?: (interaction: InteractionEvent) => string;
}

function getMergedInteractionIds(unit: InstructionalUnit): string[] {
  return Array.from(new Set([
    ...(unit.sourceInteractionIds || []),
    ...(unit.sourceInteractions || [])
  ].filter(Boolean)));
}

function getMergedRetrievedSourceIds(unit: InstructionalUnit): string[] {
  return Array.from(new Set((unit.provenance?.retrievedSourceIds || []).filter(Boolean)));
}

function getMergedPdfCitationLabels(unit: InstructionalUnit): string[] {
  return Array.from(
    new Set(
      (unit.provenance?.retrievedPdfCitations || [])
        .filter((citation) => citation?.chunkId && Number.isFinite(citation?.page))
        .map((citation) => `${citation.chunkId} (p.${citation.page})`)
    )
  );
}

function getCompactHash(value: string): string {
  return value.length <= 20 ? value : `${value.slice(0, 8)}...${value.slice(-8)}`;
}

function toCompactList(values: string[], limit = 3): string {
  if (values.length === 0) return 'none';
  const preview = values.slice(0, limit).join(', ');
  const remaining = values.length - limit;
  return remaining > 0 ? `${preview} +${remaining} more` : preview;
}

/**
 * Unit status badge component - shows Best/Alternative/Archived status
 */
function UnitStatusBadge({ 
  unit, 
  showLabel = false 
}: { 
  unit: InstructionalUnit; 
  showLabel?: boolean;
}) {
  const displayStatus = getUnitDisplayStatus(unit);
  
  const colorClasses = {
    amber: 'bg-amber-500 hover:bg-amber-600 text-white',
    blue: 'bg-blue-500 hover:bg-blue-600 text-white',
    gray: 'bg-gray-400 hover:bg-gray-500 text-white',
    green: 'bg-green-500 hover:bg-green-600 text-white'
  };
  
  const icons = {
    amber: Star,
    blue: Layers,
    gray: Archive,
    green: Star
  };
  
  const Icon = icons[displayStatus.color];
  
  return (
    <Badge 
      variant="default" 
      className={`text-[10px] h-5 ${colorClasses[displayStatus.color]}`}
      title={`Status: ${displayStatus.status}${unit.qualityScore !== undefined ? ` • Quality: ${(unit.qualityScore * 100).toFixed(0)}%` : ''}`}
    >
      <Icon className="size-3 mr-0.5" />
      {showLabel ? displayStatus.badge : displayStatus.badge}
    </Badge>
  );
}

export function AdaptiveTextbook({
  learnerId,
  selectedUnitId,
  activeEvidenceId,
  onSelectedUnitChange,
  buildEvidenceHref
}: AdaptiveTextbookProps) {
  const [textbookUnits, setTextbookUnits] = useState<InstructionalUnit[]>([]);
  const [selectedUnit, setSelectedUnit] = useState<InstructionalUnit | null>(null);
  const [sortMode, setSortMode] = useState<SortMode>('quality');
  const [showArchived, setShowArchived] = useState(false);
  const [expandedAlternatives, setExpandedAlternatives] = useState<Record<string, boolean>>({});
  const pendingUnitIdRef = useRef<string | null>(null);

  useEffect(() => {
    loadTextbook();
  }, [learnerId]);

  const loadTextbook = () => {
    const units = storage.getTextbook(learnerId);
    setTextbookUnits(units);
  };

  const learnerInteractions = useMemo(
    () => storage.getInteractionsByLearner(learnerId),
    [learnerId, textbookUnits]
  );
  const textbookInsights = useMemo(
    () => buildTextbookInsights({
      units: textbookUnits,
      interactions: learnerInteractions,
      sortMode
    }),
    [textbookUnits, learnerInteractions, sortMode]
  );
  const orderedUnits = textbookInsights.orderedUnits;

  useEffect(() => {
    if (orderedUnits.length === 0) {
      if (selectedUnit) {
        setSelectedUnit(null);
        onSelectedUnitChange?.(undefined);
      }
      pendingUnitIdRef.current = null;
      return;
    }

    // If we have a pending selection from user click, check if parent has confirmed
    if (pendingUnitIdRef.current) {
      if (selectedUnitId === pendingUnitIdRef.current) {
        // Parent confirmed, clear pending
        pendingUnitIdRef.current = null;
      } else {
        // Still waiting for parent to update prop, don't override user's selection
        return;
      }
    }

    const selectedId = selectedUnitId || selectedUnit?.id || orderedUnits[0].id;
    const resolvedUnit = orderedUnits.find((unit) => unit.id === selectedId) || orderedUnits[0];

    if (resolvedUnit.id !== selectedUnit?.id) {
      setSelectedUnit(resolvedUnit);
      onSelectedUnitChange?.(resolvedUnit.id);
    }
  }, [orderedUnits, selectedUnitId, selectedUnit, onSelectedUnitChange]);

  const selectedConcept = useMemo(
    () => (selectedUnit ? getConceptById(selectedUnit.conceptId) : null),
    [selectedUnit]
  );

  const selectedUnitEvidence = useMemo(() => {
    if (!selectedUnit) {
      return {
        requestedIds: [] as string[],
        resolved: [] as InteractionEvent[],
        missingIds: [] as string[]
      };
    }

    const requestedIds = getMergedInteractionIds(selectedUnit);
    const resolved = storage.getInteractionsByIds(requestedIds, learnerId);
    const resolvedIdSet = new Set(resolved.map((interaction) => interaction.id));
    const missingIds = requestedIds.filter((interactionId) => !resolvedIdSet.has(interactionId));

    return {
      requestedIds,
      resolved,
      missingIds
    };
  }, [selectedUnit, learnerId]);

  const getSubtypeLabel = (interaction: InteractionEvent) =>
    interaction.sqlEngageSubtype || interaction.errorSubtypeId || 'unknown-subtype';

  const getEvidenceLabel = (interaction: InteractionEvent) => {
    if (interaction.eventType === 'hint_view') {
      const level = interaction.hintLevel || 1;
      const helpIndex = interaction.helpRequestIndex ? `help #${interaction.helpRequestIndex}` : 'help';
      return `Hint L${level} (${helpIndex})`;
    }
    if (interaction.eventType === 'explanation_view') {
      const helpIndex = interaction.helpRequestIndex ? ` #${interaction.helpRequestIndex}` : '';
      return `Explanation${helpIndex}`;
    }
    if (interaction.eventType === 'error') {
      return 'Error';
    }
    if (interaction.eventType === 'execution') {
      return interaction.successful ? 'Execution (success)' : 'Execution';
    }
    return interaction.eventType.replace(/_/g, ' ');
  };

  const handleUnitSelect = (unit: InstructionalUnit) => {
    pendingUnitIdRef.current = unit.id;
    setSelectedUnit(unit);
    onSelectedUnitChange?.(unit.id);
  };

  const handleClear = () => {
    if (confirm('Are you sure you want to clear your textbook?')) {
      storage.clearTextbook(learnerId);
      setTextbookUnits([]);
      setSelectedUnit(null);
      onSelectedUnitChange?.(undefined);
    }
  };

  // Filter units based on showArchived state
  const filteredUnits = useMemo(() => {
    if (showArchived) {
      return orderedUnits;
    }
    // By default, show only primary and alternative units (hide archived)
    return filterUnitsByStatus(orderedUnits, ['primary', 'alternative']);
  }, [orderedUnits, showArchived]);

  // Group units by concept, then by problem title (for folding)
  const groupedUnits = filteredUnits.reduce((acc, unit) => {
    const concept = getConceptById(unit.conceptId);
    const conceptName = concept?.name || 'Other';
    if (!acc[conceptName]) {
      acc[conceptName] = {};
    }
    // Group by problem title (or unit title if no problem)
    const problemKey = unit.title || unit.problemId || 'General';
    if (!acc[conceptName][problemKey]) {
      acc[conceptName][problemKey] = [];
    }
    acc[conceptName][problemKey].push(unit);
    return acc;
  }, {} as Record<string, Record<string, InstructionalUnit[]>>);

  // Track expanded sections
  const [expandedConcepts, setExpandedConcepts] = useState<Record<string, boolean>>({});
  const [expandedProblems, setExpandedProblems] = useState<Record<string, boolean>>({});

  const toggleConcept = (conceptName: string) => {
    setExpandedConcepts(prev => ({
      ...prev,
      [conceptName]: !prev[conceptName]
    }));
  };

  const toggleProblem = (problemKey: string) => {
    setExpandedProblems(prev => ({
      ...prev,
      [problemKey]: !prev[problemKey]
    }));
  };

  const toggleAlternatives = (conceptId: string) => {
    setExpandedAlternatives(prev => ({
      ...prev,
      [conceptId]: !prev[conceptId]
    }));
  };

  // Auto-expand all concepts on load (for test compatibility)
  useEffect(() => {
    const concepts = Object.keys(groupedUnits);
    if (concepts.length > 0 && Object.keys(expandedConcepts).length === 0) {
      const allExpanded = concepts.reduce((acc, concept) => {
        acc[concept] = true;
        return acc;
      }, {} as Record<string, boolean>);
      setExpandedConcepts(allExpanded);
    }
  }, [groupedUnits]);

  const getAlternativeCount = (conceptId: string, type?: InstructionalUnit['type']) => {
    return getAlternativeUnits(textbookUnits, conceptId, type).length;
  };

  const getSourceCount = (unit: InstructionalUnit) =>
    getMergedInteractionIds(unit).length;

  const renderedUnitContent = useMemo(() => {
    if (!selectedUnit) {
      return '';
    }

    const rawContent = selectedUnit.content || '';
    const format = selectedUnit.contentFormat;
    
    // If content is explicitly marked as HTML (legacy), sanitize and display directly
    // Otherwise, treat as markdown (canonical format) and parse to HTML
    if (format === 'html') {
      return DOMPurify.sanitize(rawContent, {
        ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'code', 'pre', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li', 'blockquote', 'a'],
        ALLOWED_ATTR: ['href', 'title', 'class']
      });
    }
    
    // Canonical path: markdown -> HTML (format is 'markdown' or undefined for backward compat)
    // Create a custom renderer that escapes raw HTML to prevent XSS
    const renderer = new Renderer();
    renderer.html = (token: Token) => {
      // Marked v14+ passes a token object with text/raw property
      // Escape raw HTML by converting < and > to entities
      const raw = (token as { text?: string; raw?: string }).text ?? (token as { raw?: string }).raw ?? '';
      return raw.replace(/</g, '&lt;').replace(/>/g, '&gt;');
    };
    
    const renderedMarkdown = marked.parse(rawContent, {
      gfm: true,
      breaks: true,
      renderer
    }) as string;

    // Sanitize the rendered HTML as a defense-in-depth measure
    return DOMPurify.sanitize(renderedMarkdown, {
      ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'code', 'pre', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li', 'blockquote', 'a'],
      ALLOWED_ATTR: ['href', 'title', 'class']
    });
  }, [selectedUnit]);

  if (orderedUnits.length === 0) {
    return (
      <Card className="p-8 text-center">
        <Book className="size-12 mx-auto text-gray-400 mb-4" />
        <h3 className="font-semibold text-lg mb-2">Your Textbook is Empty</h3>
        <p className="text-gray-600">
          As you practice SQL, the system will automatically add personalized
          instructional content here based on your learning patterns.
        </p>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 h-full">
      {/* Table of Contents */}
      <Card className="p-4 lg:col-span-1 overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold flex items-center gap-2">
            <Book className="size-5" />
            My Textbook
          </h3>
          <div className="flex items-center gap-1">
            <Button
              onClick={() => setSortMode(prev => {
                const modes: SortMode[] = ['quality', 'newest', 'oldest', 'prerequisite'];
                const currentIndex = modes.indexOf(prev);
                return modes[(currentIndex + 1) % modes.length];
              })}
              variant="ghost"
              size="sm"
              title={`Sort: ${sortMode}`}
            >
              <ArrowUpDown className="size-4" />
            </Button>
            <Button
              onClick={handleClear}
              variant="ghost"
              size="sm"
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
        </div>
        
        {/* Sort indicator */}
        <div className="flex items-center gap-2 mb-3">
          <Badge variant="outline" className="text-[10px]">
            Sort: {sortMode}
          </Badge>
          <span className="text-xs text-gray-500">
            {sortMode === 'quality' && 'Best explanations first'}
            {sortMode === 'newest' && 'Most recent first'}
            {sortMode === 'oldest' && 'Oldest first'}
            {sortMode === 'prerequisite' && 'By learning path'}
          </span>
        </div>

        <div className="space-y-2">
          {Object.entries(groupedUnits).map(([conceptName, problems]) => {
            const isConceptExpanded = expandedConcepts[conceptName] ?? false;
            const totalUnits = Object.values(problems).flat().length;
            
            return (
              <div key={conceptName} className="border rounded-lg overflow-hidden">
                {/* Concept Header - Click to expand/collapse */}
                <button
                  type="button"
                  onClick={() => toggleConcept(conceptName)}
                  className="w-full flex items-center justify-between p-3 bg-gray-50 hover:bg-gray-100 transition-colors"
                  aria-expanded={isConceptExpanded}
                  aria-controls={`concept-content-${conceptName.replace(/\s+/g, '-').toLowerCase()}`}
                >
                  <div className="flex items-center gap-2">
                    <Folder className="size-4 text-blue-500" />
                    <span className="font-medium text-sm">{conceptName}</span>
                    <Badge variant="secondary" className="text-xs">
                      {totalUnits}
                    </Badge>
                  </div>
                  {isConceptExpanded ? (
                    <ChevronDown className="size-4 text-gray-400" />
                  ) : (
                    <ChevronRight className="size-4 text-gray-400" />
                  )}
                </button>
                
                {/* Problems under this concept */}
                {isConceptExpanded && (
                  <div 
                    id={`concept-content-${conceptName.replace(/\s+/g, '-').toLowerCase()}`}
                    className="p-2 space-y-1"
                  >
                    {Object.entries(problems).map(([problemTitle, units]) => {
                      const problemKey = `${conceptName}-${problemTitle}`;
                      const isProblemExpanded = expandedProblems[problemKey] ?? false;
                      const hasMultipleUnits = units.length > 1;
                      
                      return (
                        <div key={problemKey} className="rounded-md border bg-white overflow-hidden">
                          {/* Problem Title */}
                          <button
                            type="button"
                            onClick={() => hasMultipleUnits ? toggleProblem(problemKey) : handleUnitSelect(units[0])}
                            className={`w-full flex items-center justify-between p-2 text-left hover:bg-gray-50 transition-colors ${
                              selectedUnit && units.some(u => u.id === selectedUnit.id) 
                                ? 'bg-blue-50 border-blue-200' 
                                : ''
                            }`}
                            aria-expanded={hasMultipleUnits ? isProblemExpanded : undefined}
                            aria-controls={hasMultipleUnits ? `problem-content-${problemKey.replace(/\s+/g, '-').toLowerCase()}` : undefined}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              {hasMultipleUnits ? (
                                isProblemExpanded ? (
                                  <ChevronDown className="size-3.5 text-gray-400 shrink-0" />
                                ) : (
                                  <ChevronRight className="size-3.5 text-gray-400 shrink-0" />
                                )
                              ) : (
                                <FileText className="size-3.5 text-gray-400 shrink-0" />
                              )}
                              <span className="text-sm truncate">{problemTitle}</span>
                            </div>
                            {hasMultipleUnits && (
                              <Badge variant="outline" className="text-[10px] h-5 shrink-0">
                                {units.length} parts
                              </Badge>
                            )}
                          </button>
                          
                          {/* Units under this problem */}
                          {(isProblemExpanded || !hasMultipleUnits) && (
                            <div 
                              id={`problem-content-${problemKey.replace(/\s+/g, '-').toLowerCase()}`}
                              className="border-t bg-gray-50/50"
                            >
                              {units.map((unit) => {
                                const isBest = isBestQualityUnit(unit);
                                return (
                                  <button
                                    type="button"
                                    key={unit.id}
                                    onClick={() => handleUnitSelect(unit)}
                                    className={`w-full px-3 py-2 text-left text-sm transition-colors ${
                                      selectedUnit?.id === unit.id
                                        ? 'bg-blue-100 text-blue-900'
                                        : 'hover:bg-gray-100 text-gray-700'
                                    }`}
                                  >
                                    <div className="flex items-center gap-2">
                                      <span className="capitalize">{unit.type}</span>
                                      <UnitStatusBadge unit={unit} />
                                    </div>
                                    <span className="block truncate mt-0.5">{unit.title}</span>
                                    {unit.qualityScore !== undefined && (
                                      <span className="text-[10px] text-gray-400">
                                        Score: {((unit.qualityScore) * 100).toFixed(0)}%
                                      </span>
                                    )}
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {textbookInsights.misconceptionCards.length > 0 && (
          <div className="mt-4 rounded border border-amber-200 bg-amber-50 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-amber-800">You Keep Hitting</p>
            <div className="mt-2 space-y-2">
              {textbookInsights.misconceptionCards.map((card) => (
                <div key={card.id} className="rounded border border-amber-200 bg-white p-2" data-testid="misconception-card">
                  <p className="text-sm font-medium text-amber-900">{card.subtype}</p>
                  <p className="text-xs text-amber-800">
                    {card.count} related interactions • last seen {new Date(card.lastSeenAt).toLocaleString()}
                  </p>
                  {card.conceptNames.length > 0 && (
                    <p className="text-[11px] text-amber-700 mt-1">
                      Concepts: {card.conceptNames.join(', ')}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {textbookInsights.spacedReviewPrompts.length > 0 && (
          <div className="mt-4 rounded border border-blue-200 bg-blue-50 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-blue-800">Spaced Review</p>
            <div className="mt-2 space-y-2">
              {textbookInsights.spacedReviewPrompts.map((prompt) => (
                <div key={prompt.id} className="rounded border border-blue-200 bg-white p-2" data-testid="spaced-review-prompt">
                  <p className="text-sm font-medium text-blue-900">{prompt.title}</p>
                  <p className="text-xs text-blue-800">{prompt.message}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        <Separator className="my-4" />

        {/* Status filter toggle */}
        <div className="flex items-center justify-between mb-3">
          <Badge 
            variant={showArchived ? 'default' : 'outline'} 
            className="cursor-pointer text-[10px]"
            onClick={() => setShowArchived(!showArchived)}
          >
            {showArchived ? 'Showing All' : 'Primary Only'}
          </Badge>
          <span className="text-xs text-gray-500">
            {showArchived ? 'Click to hide archived' : 'Click to show archived'}
          </span>
        </div>

        <div className="text-xs text-gray-500">
          <p className="font-medium mb-1">Coverage</p>
          <p>{orderedUnits.length} instructional units</p>
          <p>{Object.keys(groupedUnits).length} concepts</p>
          <p>
            {Object.values(groupedUnits).reduce((sum, problems) => sum + Object.keys(problems).length, 0)} problems
          </p>
          <p className="mt-1 pt-1 border-t">
            <span className="inline-flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-amber-500"></span>
              {textbookUnits.filter(u => u.status === 'primary' || !u.status).length} primary
            </span>
            <span className="inline-flex items-center gap-1 ml-2">
              <span className="w-2 h-2 rounded-full bg-blue-500"></span>
              {textbookUnits.filter(u => u.status === 'alternative').length} alternative
            </span>
            {showArchived && (
              <span className="inline-flex items-center gap-1 ml-2">
                <span className="w-2 h-2 rounded-full bg-gray-400"></span>
                {textbookUnits.filter(u => u.status === 'archived').length} archived
              </span>
            )}
          </p>
        </div>
      </Card>

      {/* Content Viewer */}
      <Card className="p-6 lg:col-span-2 overflow-y-auto">
        {selectedUnit ? (
          <div className="prose prose-sm max-w-none">
            <div className="flex items-center gap-2 mb-4">
              <Badge>{selectedUnit.type}</Badge>
              <UnitStatusBadge unit={selectedUnit} showLabel />
              {isBestQualityUnit(selectedUnit) && (
                <Badge className="bg-amber-500 hover:bg-amber-600">
                  <Star className="size-3 mr-1" />
                  Best Quality
                </Badge>
              )}
              <span className="text-xs text-gray-500">
                Added {new Date(selectedUnit.addedTimestamp).toLocaleDateString()}
              </span>
              {selectedUnit.qualityScore !== undefined && (
                <Badge variant="outline" className="text-xs">
                  Quality: {((selectedUnit.qualityScore) * 100).toFixed(0)}%
                </Badge>
              )}
            </div>

            <div className="not-prose mb-4 rounded-lg border bg-slate-50 p-4">
              <p className="text-xs uppercase tracking-wide text-slate-500 mb-1">Concept</p>
              <h3 className="font-semibold text-slate-900">
                {selectedConcept?.name || selectedUnit.conceptId}
              </h3>
              {selectedConcept?.description && (
                <p className="mt-1 text-sm text-slate-700">{selectedConcept.description}</p>
              )}
            </div>

            <h2 className="text-2xl font-bold mb-4">{selectedUnit.title}</h2>

            <div 
              className="space-y-4"
              dangerouslySetInnerHTML={{ 
                __html: renderedUnitContent 
              }}
            />

            {selectedUnit.provenance && (
              <details className="not-prose mt-4 rounded border bg-gray-50 p-3">
                <summary className="cursor-pointer text-sm font-medium">Provenance</summary>
                <div className="mt-2 text-xs text-gray-700 space-y-1">
                  <p><span className="font-medium">Template:</span> {selectedUnit.provenance.templateId}</p>
                  <p><span className="font-medium">Model:</span> {selectedUnit.provenance.model}</p>
                  <p>
                    <span className="font-medium">Input hash:</span>{' '}
                    <span className="font-mono" title={selectedUnit.provenance.inputHash}>
                      {getCompactHash(selectedUnit.provenance.inputHash)}
                    </span>
                  </p>
                  <p data-testid="provenance-retrieved-sources">
                    Retrieved sources: <span className="font-medium">{getMergedRetrievedSourceIds(selectedUnit).length} merged</span>
                  </p>
                  <p data-testid="provenance-source-ids">
                    <span className="font-medium">Source IDs:</span>{' '}
                    {toCompactList(getMergedRetrievedSourceIds(selectedUnit))}
                  </p>
                  <p data-testid="provenance-pdf-citations">
                    <span className="font-medium">PDF citations:</span>{' '}
                    {toCompactList(getMergedPdfCitationLabels(selectedUnit))}
                  </p>
                  <p><span className="font-medium">Created:</span> {new Date(selectedUnit.provenance.createdAt).toLocaleString()}</p>
                </div>
              </details>
            )}

            {selectedUnitEvidence.requestedIds.length > 0 && (
              <div className="not-prose mt-6 pt-4 border-t">
                <p className="text-xs text-gray-500 mb-2">
                  This content was generated from {getSourceCount(selectedUnit)} interaction(s):{' '}
                  {selectedUnitEvidence.resolved.length} resolved, {selectedUnitEvidence.missingIds.length} missing
                </p>
                {selectedUnitEvidence.missingIds.length > 0 && (
                  <div
                    className="mb-2 rounded border border-amber-300 bg-amber-50 p-2 text-xs text-amber-900"
                    data-testid="textbook-missing-evidence"
                  >
                    Missing interaction IDs: {toCompactList(selectedUnitEvidence.missingIds, 4)}
                  </div>
                )}
                <h3 className="font-semibold text-sm mb-2">Evidence Links</h3>
                <div className="space-y-2">
                  {selectedUnitEvidence.resolved.map((interaction) => {
                    const subtype = getSubtypeLabel(interaction);
                    const href = buildEvidenceHref?.(interaction);
                    const className = `block rounded border p-2 text-sm transition-colors ${
                      activeEvidenceId === interaction.id
                        ? 'border-blue-300 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`;

                    const content = (
                      <>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium">{getEvidenceLabel(interaction)}</span>
                          <Badge variant="outline" className="text-xs">{subtype}</Badge>
                          <span className="text-[11px] text-gray-500">{interaction.id}</span>
                        </div>
                        <p className="text-xs text-gray-600 mt-1">
                          {new Date(interaction.timestamp).toLocaleString()}
                        </p>
                      </>
                    );

                    return href ? (
                      <Link key={interaction.id} to={href} className={className}>
                        {content}
                      </Link>
                    ) : (
                      <div key={interaction.id} className={className}>
                        {content}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center justify-center h-full text-gray-500">
            <div className="text-center">
              <Book className="size-12 mx-auto mb-4 text-gray-400" />
              <p>Select a topic from the left to view content</p>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
