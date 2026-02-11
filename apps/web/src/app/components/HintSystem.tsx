import { useEffect, useRef, useState } from 'react';
import { Card } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Lightbulb, BookOpen } from 'lucide-react';
import { InteractionEvent } from '../types';
import { orchestrator } from '../lib/adaptive-orchestrator';
import { storage } from '../lib/storage';
import {
  canonicalizeSqlEngageSubtype,
  getSqlEngagePolicyVersion
} from '../data/sql-engage';

interface HintSystemProps {
  sessionId?: string;
  learnerId: string;
  problemId: string;
  errorSubtypeId?: string;
  isSubtypeOverrideActive?: boolean;
  knownSubtypeOverride?: string;
  recentInteractions: InteractionEvent[];
  onEscalate?: (sourceInteractionIds?: string[]) => void;
  onInteractionLogged?: (event: InteractionEvent) => void;
}

export function HintSystem({ 
  sessionId,
  learnerId, 
  problemId, 
  errorSubtypeId,
  isSubtypeOverrideActive = false,
  knownSubtypeOverride,
  recentInteractions,
  onEscalate,
  onInteractionLogged
}: HintSystemProps) {
  const [currentHintLevel, setCurrentHintLevel] = useState(0);
  const [hints, setHints] = useState<string[]>([]);
  const [showExplanation, setShowExplanation] = useState(false);
  const [activeHintSubtype, setActiveHintSubtype] = useState<string | null>(null);
  const lastAutoEscalatedErrorId = useRef<string | null>(null);

  const profile = storage.getProfile(learnerId);
  const scopedInteractions = recentInteractions.filter(
    (interaction) =>
      interaction.learnerId === learnerId &&
      (!sessionId || interaction.sessionId === sessionId)
  );
  const autoEscalation = orchestrator.getAutoEscalationState(scopedInteractions, problemId);
  const autoEscalationAllowed = Boolean(profile) && Boolean(sessionId) && profile.currentStrategy !== 'hint-only';
  const canonicalOverrideSubtype = knownSubtypeOverride
    ? canonicalizeSqlEngageSubtype(knownSubtypeOverride)
    : undefined;
  const isCanonicalOverrideActive = isSubtypeOverrideActive && Boolean(canonicalOverrideSubtype);

  const resetHintFlow = () => {
    setCurrentHintLevel(0);
    setHints([]);
    setShowExplanation(false);
    setActiveHintSubtype(null);
    lastAutoEscalatedErrorId.current = null;
  };

  useEffect(() => {
    resetHintFlow();
  }, [problemId, sessionId]);

  useEffect(() => {
    resetHintFlow();
  }, [isCanonicalOverrideActive, canonicalOverrideSubtype]);

  const handleRequestHint = () => {
    if (!profile) {
      return;
    }
    if (!sessionId) {
      return;
    }
    if (currentHintLevel >= 3) {
      return;
    }
    const overrideSubtype = isCanonicalOverrideActive ? canonicalOverrideSubtype : undefined;
    const fallbackSubtype = errorSubtypeId || 'incomplete query';
    const effectiveSubtype = activeHintSubtype ||
      canonicalizeSqlEngageSubtype(overrideSubtype || fallbackSubtype);

    if (!activeHintSubtype) {
      setActiveHintSubtype(effectiveSubtype);
    }

    const nextLevel = Math.min(currentHintLevel + 1, 3);
    const {
      hint,
      sqlEngageSubtypeUsed,
      sqlEngageRowId,
      policyVersion
    } = orchestrator.getNextHint(
      effectiveSubtype,
      currentHintLevel,
      profile,
      `${learnerId}:${problemId}`,
      {
        knownSubtypeOverride: overrideSubtype,
        isSubtypeOverrideActive: isCanonicalOverrideActive
      }
    );

    const newHints = [...hints, hint];
    setHints(newHints);
    setCurrentHintLevel(nextLevel);

    // Log interaction
    const hintEvent: InteractionEvent = {
      id: `hint-${Date.now()}`,
      sessionId,
      learnerId,
      timestamp: Date.now(),
      eventType: 'hint_view',
      problemId,
      hintLevel: nextLevel as 1 | 2 | 3,
      sqlEngageSubtype: sqlEngageSubtypeUsed,
      sqlEngageRowId,
      policyVersion
    };
    storage.saveInteraction(hintEvent);
    onInteractionLogged?.(hintEvent);
  };

  const handleShowExplanation = (source: 'manual' | 'auto' = 'manual') => {
    if (!profile || !sessionId) {
      return;
    }
    setShowExplanation(true);
    const latestProblemError = [...scopedInteractions]
      .reverse()
      .find((interaction) => interaction.problemId === problemId && interaction.eventType === 'error');
    const sourceInteractionIds =
      source === 'auto'
        ? autoEscalation.triggerErrorId
          ? [autoEscalation.triggerErrorId]
          : latestProblemError
            ? [latestProblemError.id]
            : []
        : latestProblemError
          ? [latestProblemError.id]
          : [];
    onEscalate?.(sourceInteractionIds);

    // Log interaction
    const explanationEvent: InteractionEvent = {
      id: `explanation-${Date.now()}-${source}`,
      sessionId,
      learnerId,
      timestamp: Date.now(),
      eventType: 'explanation_view',
      problemId,
      errorSubtypeId: activeHintSubtype || errorSubtypeId,
      policyVersion: getSqlEngagePolicyVersion()
    };
    storage.saveInteraction(explanationEvent);
    onInteractionLogged?.(explanationEvent);
  };

  const decision = profile
    ? orchestrator.makeDecision(profile, scopedInteractions, problemId)
    : { decision: 'show_hint' as const, reasoning: 'Learner profile unavailable' };

  useEffect(() => {
    if (!profile || !sessionId || !autoEscalationAllowed || !autoEscalation.shouldEscalate || !autoEscalation.triggerErrorId) {
      return;
    }
    if (lastAutoEscalatedErrorId.current === autoEscalation.triggerErrorId) {
      return;
    }
    lastAutoEscalatedErrorId.current = autoEscalation.triggerErrorId;
    handleShowExplanation('auto');
  }, [profile, sessionId, autoEscalationAllowed, autoEscalation.shouldEscalate, autoEscalation.triggerErrorId]);

  if (!profile) return null;

  return (
    <Card className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Lightbulb className="size-5 text-yellow-600" />
          <h3 className="font-semibold">HintWise</h3>
        </div>
        <Badge variant={
          decision.decision === 'show_hint' ? 'default' :
          decision.decision === 'show_explanation' ? 'secondary' :
          'outline'
        }>
          {decision.decision.replace('_', ' ')}
        </Badge>
      </div>

      {hints.length === 0 ? (
        <div className="text-center py-6 text-gray-500">
          <p>Need help? Request a hint to get started.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {hints.map((hint, idx) => (
            <div key={idx} className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex gap-2">
                <Badge variant="outline" className="shrink-0">
                  Hint {idx + 1}
                </Badge>
                <p className="text-sm text-blue-900">{hint}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-2">
        <Button
          onClick={handleRequestHint}
          variant="outline"
          size="sm"
          className="flex-1"
          disabled={currentHintLevel >= 3}
        >
          <Lightbulb className="size-4 mr-2" />
          {currentHintLevel >= 3 ? 'Max Hints Reached' : hints.length === 0 ? 'Request Hint' : 'Next Hint'}
        </Button>

        {(showExplanation || decision.decision === 'show_explanation') && (
          <Button
            onClick={handleShowExplanation}
            variant="default"
            size="sm"
            className="flex-1"
          >
            <BookOpen className="size-4 mr-2" />
            Show Explanation
          </Button>
        )}
      </div>

      {decision.reasoning && (
        <div className="text-xs text-gray-500 pt-2 border-t">
          <p className="font-medium mb-1">Adaptive Decision:</p>
          <p>{decision.reasoning}</p>
          {activeHintSubtype && (
            <p className="mt-1">Hint subtype: {activeHintSubtype}</p>
          )}
        </div>
      )}
    </Card>
  );
}
