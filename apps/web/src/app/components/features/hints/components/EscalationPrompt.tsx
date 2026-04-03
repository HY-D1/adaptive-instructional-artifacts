/**
 * EscalationPrompt Component
 *
 * Prompts the user to escalate to a deeper explanation
 * when hints at the current level are exhausted.
 */

import { ArrowUpCircle, Lightbulb, BookOpen } from 'lucide-react';
import { Button } from '../../../ui/button';
import { Card } from '../../../ui/card';
import { cn } from '../../../ui/utils';

export interface EscalationPromptProps {
  /** Current rung level (1 or 2) */
  currentRung: 1 | 2 | 3;
  /** Number of hints given at current level */
  hintCount: number;
  /** Threshold for triggering escalation prompt */
  threshold?: number;
  /** Callback when user chooses to escalate */
  onEscalate: () => void;
  /** Callback when user chooses to continue with hints */
  onContinue: () => void;
  /** Whether escalation is in progress */
  isLoading?: boolean;
}

const RUNG_LABELS: Record<number, { title: string; nextLevel: string; icon: React.ReactNode }> = {
  1: {
    title: 'Need more help?',
    nextLevel: 'explanation',
    icon: <Lightbulb className="h-5 w-5 text-amber-500" />,
  },
  2: {
    title: 'Still stuck?',
    nextLevel: 'detailed explanation with examples',
    icon: <BookOpen className="h-5 w-5 text-blue-500" />,
  },
  3: {
    title: 'Maximum help reached',
    nextLevel: 'review fundamentals',
    icon: <ArrowUpCircle className="h-5 w-5 text-green-500" />,
  },
};

export function EscalationPrompt({
  currentRung,
  hintCount,
  threshold = 3,
  onEscalate,
  onContinue,
  isLoading = false,
}: EscalationPromptProps) {
  // Don't show if at max rung
  if (currentRung >= 3) {
    return null;
  }

  // Don't show until threshold is met
  if (hintCount < threshold) {
    return null;
  }

  const config = RUNG_LABELS[currentRung];

  return (
    <Card className="border-amber-200 bg-amber-50/50 p-4">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 shrink-0">{config.icon}</div>
        <div className="flex-1">
          <h4 className="font-medium text-amber-900">{config.title}</h4>
          <p className="mt-1 text-sm text-amber-700">
            You've had {hintCount} hints at this level. Would you like to see a {config.nextLevel}?
          </p>
          <div className="mt-3 flex gap-2">
            <Button
              size="sm"
              onClick={onEscalate}
              disabled={isLoading}
              className="bg-amber-600 hover:bg-amber-700"
            >
              <ArrowUpCircle className="mr-1.5 h-4 w-4" />
              {isLoading ? 'Loading...' : 'Get More Help'}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={onContinue}
              disabled={isLoading}
            >
              Continue with Hints
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}
