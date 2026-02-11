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
    if (!selectedUnit) return [];

    const sourceIds = Array.from(new Set([
      ...(selectedUnit.sourceInteractionIds || []),
      ...(selectedUnit.sourceInteractions || [])
    ]));

    return storage.getInteractionsByIds(sourceIds, learnerId);
  }, [selectedUnit, learnerId]);

  const getSubtypeLabel = (interaction: InteractionEvent) =>
    interaction.sqlEngageSubtype || interaction.errorSubtypeId || 'unknown-subtype';

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
    (unit.sourceInteractionIds || unit.sourceInteractions || []).length;

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

            {selectedUnitEvidence.length > 0 && (
              <div className="not-prose mt-6 pt-4 border-t">
                <p className="text-xs text-gray-500 mb-2">
                  This content was generated from {getSourceCount(selectedUnit)} interaction(s)
                </p>
                <h3 className="font-semibold text-sm mb-2">Evidence Links</h3>
                <div className="space-y-2">
                  {selectedUnitEvidence.map((interaction) => {
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
                          <span className="font-medium">Attempt {interaction.id}</span>
                          <Badge variant="outline" className="text-xs">{subtype}</Badge>
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
