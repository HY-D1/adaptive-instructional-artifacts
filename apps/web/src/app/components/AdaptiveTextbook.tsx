import { useEffect, useMemo, useState } from 'react';
import { Card } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Separator } from './ui/separator';
import { Book, Trash2 } from 'lucide-react';
import { Link } from 'react-router';
import { InstructionalUnit, InteractionEvent } from '../types';
import { storage } from '../lib/storage';
import { getConceptById } from '../data/sql-engage';

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

export function AdaptiveTextbook({
  learnerId,
  selectedUnitId,
  activeEvidenceId,
  onSelectedUnitChange,
  buildEvidenceHref
}: AdaptiveTextbookProps) {
  const [textbookUnits, setTextbookUnits] = useState<InstructionalUnit[]>([]);
  const [selectedUnit, setSelectedUnit] = useState<InstructionalUnit | null>(null);

  useEffect(() => {
    loadTextbook();
  }, [learnerId]);

  const loadTextbook = () => {
    const units = storage.getTextbook(learnerId);
    setTextbookUnits(units);
  };

  useEffect(() => {
    if (textbookUnits.length === 0) {
      if (selectedUnit) {
        setSelectedUnit(null);
        onSelectedUnitChange?.(undefined);
      }
      return;
    }

    const selectedId = selectedUnitId || selectedUnit?.id || textbookUnits[0].id;
    const resolvedUnit = textbookUnits.find((unit) => unit.id === selectedId) || textbookUnits[0];

    if (resolvedUnit.id !== selectedUnit?.id) {
      setSelectedUnit(resolvedUnit);
      onSelectedUnitChange?.(resolvedUnit.id);
    }
  }, [textbookUnits, selectedUnitId, selectedUnit, onSelectedUnitChange]);

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

  const groupedUnits = textbookUnits.reduce((acc, unit) => {
    const concept = getConceptById(unit.conceptId);
    const conceptName = concept?.name || 'Other';
    if (!acc[conceptName]) {
      acc[conceptName] = [];
    }
    acc[conceptName].push(unit);
    return acc;
  }, {} as Record<string, InstructionalUnit[]>);

  const getSourceCount = (unit: InstructionalUnit) =>
    getMergedInteractionIds(unit).length;

  if (textbookUnits.length === 0) {
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
          <Button
            onClick={handleClear}
            variant="ghost"
            size="sm"
          >
            <Trash2 className="size-4" />
          </Button>
        </div>

        <div className="space-y-4">
          {Object.entries(groupedUnits).map(([conceptName, units]) => (
            <div key={conceptName}>
              <h4 className="font-medium text-sm text-gray-700 mb-2">
                {conceptName}
              </h4>
              <div className="space-y-1">
                {units.map((unit) => (
                  <button
                    key={unit.id}
                    onClick={() => handleUnitSelect(unit)}
                    className={`w-full text-left px-3 py-2 rounded text-sm transition-colors ${
                      selectedUnit?.id === unit.id
                        ? 'bg-blue-100 text-blue-900'
                        : 'hover:bg-gray-100'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">
                        {unit.type}
                      </Badge>
                      <span className="flex-1 truncate">{unit.title}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        <Separator className="my-4" />

        <div className="text-xs text-gray-500">
          <p className="font-medium mb-1">Coverage</p>
          <p>{textbookUnits.length} instructional units</p>
          <p>{Object.keys(groupedUnits).length} concepts covered</p>
        </div>
      </Card>

      {/* Content Viewer */}
      <Card className="p-6 lg:col-span-2 overflow-y-auto">
        {selectedUnit ? (
          <div className="prose prose-sm max-w-none">
            <div className="flex items-center gap-2 mb-4">
              <Badge>{selectedUnit.type}</Badge>
              <span className="text-xs text-gray-500">
                Added {new Date(selectedUnit.addedTimestamp).toLocaleDateString()}
              </span>
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
                __html: selectedUnit.content.replace(/\n/g, '<br />') 
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
