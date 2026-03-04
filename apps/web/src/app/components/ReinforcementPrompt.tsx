import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { RadioGroup, RadioGroupItem } from './ui/radio-group';
import { Textarea } from './ui/textarea';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { CheckCircle2, XCircle, Lightbulb, Loader2, X, BookOpen, Code, MessageSquare, HelpCircle } from 'lucide-react';
import { cn } from './ui/utils';

/**
 * Type of reinforcement prompt
 */
export type PromptType = 'mcq' | 'sql-completion' | 'concept-explanation';

/**
 * Option for MCQ prompts
 */
export interface MCQOption {
  id: string;
  label: string;
}

/**
 * Base interface for reinforcement prompts (MicroChecks)
 */
export interface MicroCheck {
  id: string;
  type: PromptType;
  conceptId: string;
  conceptName: string;
  question: string;
  options?: MCQOption[]; // For MCQ type
  correctAnswer?: string; // For MCQ and sql-completion types
  expectedExplanation?: string; // For concept-explanation type
  hint?: string;
  explanation: string; // Explanation shown after answering
}

/**
 * Props for the ReinforcementPrompt component
 */
export interface ReinforcementPromptProps {
  /** The micro check/prompt data to display */
  microCheck: MicroCheck;
  /** Current prompt number in the sequence (1, 2, or 3) */
  promptNumber: number;
  /** Total number of prompts in the sequence */
  totalPrompts: number;
  /** Callback when user submits an answer */
  onSubmit: (response: string, isCorrect: boolean) => void;
  /** Optional callback when user dismisses/skips the prompt */
  onDismiss?: () => void;
  /** Whether the component is in a loading state */
  isLoading?: boolean;
}

/**
 * ReinforcementPrompt - Displays reinforcement prompts to learners for knowledge consolidation
 * 
 * Supports three prompt types:
 * - MCQ: Multiple choice questions with clickable options
 * - SQL Completion: Code input with run/submit button
 * - Concept Explanation: Text area for free-form explanation
 * 
 * @example
 * ```tsx
 * <ReinforcementPrompt
 *   microCheck={{
 *     id: 'mcq-1',
 *     type: 'mcq',
 *     conceptId: 'where-clause',
 *     conceptName: 'WHERE Clause',
 *     question: 'Which operator is used for pattern matching in SQL?',
 *     options: [
 *       { id: 'a', label: 'LIKE' },
 *       { id: 'b', label: 'MATCH' },
 *       { id: 'c', label: 'PATTERN' },
 *     ],
 *     correctAnswer: 'a',
 *     explanation: 'LIKE is the SQL operator used for pattern matching with wildcards (% and _).'
 *   }}
 *   promptNumber={1}
 *   totalPrompts={3}
 *   onSubmit={(response, isCorrect) => console.log(response, isCorrect)}
 * />
 * ```
 */
export function ReinforcementPrompt({
  microCheck,
  promptNumber,
  totalPrompts,
  onSubmit,
  onDismiss,
  isLoading = false,
}: ReinforcementPromptProps) {
  const [selectedOption, setSelectedOption] = useState<string>('');
  const [sqlInput, setSqlInput] = useState<string>('');
  const [explanationInput, setExplanationInput] = useState<string>('');
  const [submitted, setSubmitted] = useState<boolean>(false);
  const [isCorrect, setIsCorrect] = useState<boolean>(false);
  const [showExplanation, setShowExplanation] = useState<boolean>(false);

  // Reset state when microCheck changes
  useState(() => {
    setSelectedOption('');
    setSqlInput('');
    setExplanationInput('');
    setSubmitted(false);
    setIsCorrect(false);
    setShowExplanation(false);
  });

  const handleSubmit = () => {
    let response = '';
    let correct = false;

    switch (microCheck.type) {
      case 'mcq':
        response = selectedOption;
        correct = selectedOption === microCheck.correctAnswer;
        break;
      case 'sql-completion':
        response = sqlInput.trim();
        // Normalize SQL for comparison (basic normalization)
        const normalizedInput = sqlInput.toLowerCase().replace(/\s+/g, ' ').trim();
        const normalizedExpected = (microCheck.correctAnswer || '').toLowerCase().replace(/\s+/g, ' ').trim();
        correct = normalizedInput === normalizedExpected;
        break;
      case 'concept-explanation':
        response = explanationInput.trim();
        // For explanations, we consider it correct if they provide a non-empty response
        // In a real implementation, this might use LLM evaluation
        correct = explanationInput.trim().length > 20;
        break;
    }

    setIsCorrect(correct);
    setSubmitted(true);
    setShowExplanation(true);
    onSubmit(response, correct);
  };

  const handleDismiss = () => {
    onDismiss?.();
  };

  const canSubmit = () => {
    switch (microCheck.type) {
      case 'mcq':
        return selectedOption !== '';
      case 'sql-completion':
        return sqlInput.trim() !== '';
      case 'concept-explanation':
        return explanationInput.trim() !== '';
      default:
        return false;
    }
  };

  const getPromptIcon = () => {
    switch (microCheck.type) {
      case 'mcq':
        return <HelpCircle className="size-4 text-blue-500" />;
      case 'sql-completion':
        return <Code className="size-4 text-purple-500" />;
      case 'concept-explanation':
        return <MessageSquare className="size-4 text-emerald-500" />;
      default:
        return <Lightbulb className="size-4 text-amber-500" />;
    }
  };

  const getPromptTypeLabel = () => {
    switch (microCheck.type) {
      case 'mcq':
        return 'Multiple Choice';
      case 'sql-completion':
        return 'SQL Practice';
      case 'concept-explanation':
        return 'Concept Check';
      default:
        return 'Knowledge Check';
    }
  };

  return (
    <Card 
      className="w-full shadow-sm" 
      data-testid={`reinforcement-prompt-${microCheck.id}`}
    >
      {/* Header with concept/topic and progress */}
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <div className={cn(
              "p-1.5 rounded-lg",
              microCheck.type === 'mcq' && "bg-blue-50",
              microCheck.type === 'sql-completion' && "bg-purple-50",
              microCheck.type === 'concept-explanation' && "bg-emerald-50",
            )}>
              {getPromptIcon()}
            </div>
            <div>
              <CardTitle className="text-sm font-semibold text-gray-900">
                {microCheck.conceptName}
              </CardTitle>
              <p className="text-xs text-gray-500">
                {getPromptTypeLabel()}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            {/* Progress indicator */}
            <div 
              className="flex items-center gap-1 text-xs font-medium text-gray-500"
              data-testid="progress-indicator"
            >
              <span className="text-gray-900">{promptNumber}</span>
              <span>/</span>
              <span>{totalPrompts}</span>
            </div>
            
            {/* Dismiss button */}
            {onDismiss && !submitted && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleDismiss}
                className="h-7 w-7 p-0 text-gray-400 hover:text-gray-600"
                data-testid="dismiss-button"
              >
                <X className="size-4" />
              </Button>
            )}
          </div>
        </div>

        {/* Progress bar */}
        <div className="mt-3 h-1.5 w-full rounded-full bg-gray-100 overflow-hidden">
          <div 
            className="h-full rounded-full bg-amber-500 transition-all duration-300"
            style={{ width: `${(promptNumber / totalPrompts) * 100}%` }}
            data-testid="progress-bar"
          />
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Question display */}
        <div className="text-sm text-gray-800 leading-relaxed" data-testid="question-text">
          {microCheck.question}
        </div>

        {/* MCQ Options */}
        {microCheck.type === 'mcq' && microCheck.options && !submitted && (
          <RadioGroup 
            value={selectedOption} 
            onValueChange={setSelectedOption}
            className="gap-2"
            data-testid="mcq-options"
          >
            {microCheck.options.map((option) => (
              <div 
                key={option.id}
                className={cn(
                  "flex items-center gap-3 rounded-lg border p-3 transition-colors cursor-pointer",
                  selectedOption === option.id 
                    ? "border-amber-500 bg-amber-50/50" 
                    : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                )}
                onClick={() => setSelectedOption(option.id)}
                data-testid={`option-${option.id}`}
              >
                <RadioGroupItem 
                  value={option.id} 
                  id={option.id}
                  className="shrink-0"
                />
                <Label 
                  htmlFor={option.id} 
                  className="cursor-pointer text-sm text-gray-700 flex-1"
                >
                  {option.label}
                </Label>
              </div>
            ))}
          </RadioGroup>
        )}

        {/* SQL Completion Input */}
        {microCheck.type === 'sql-completion' && !submitted && (
          <div className="space-y-2" data-testid="sql-input-container">
            <div className="relative">
              <Code className="absolute left-3 top-2.5 size-4 text-gray-400" />
              <Input
                value={sqlInput}
                onChange={(e) => setSqlInput(e.target.value)}
                placeholder="Type your SQL query here..."
                className="pl-9 font-mono text-sm"
                disabled={isLoading}
                data-testid="sql-input"
              />
            </div>
            {microCheck.hint && (
              <p className="text-xs text-gray-500 flex items-center gap-1">
                <Lightbulb className="size-3 text-amber-500" />
                {microCheck.hint}
              </p>
            )}
          </div>
        )}

        {/* Concept Explanation Textarea */}
        {microCheck.type === 'concept-explanation' && !submitted && (
          <div className="space-y-2" data-testid="explanation-container">
            <Textarea
              value={explanationInput}
              onChange={(e) => setExplanationInput(e.target.value)}
              placeholder="Explain this concept in your own words..."
              className="min-h-[100px] resize-none"
              disabled={isLoading}
              data-testid="explanation-textarea"
            />
            <div className="flex justify-between text-xs text-gray-500">
              <span>{explanationInput.length} characters</span>
              <span>Minimum 20 characters recommended</span>
            </div>
          </div>
        )}

        {/* Feedback Section - Shown after submission */}
        {submitted && (
          <div 
            className={cn(
              "rounded-lg border p-4 space-y-3",
              isCorrect 
                ? "bg-green-50 border-green-200" 
                : "bg-red-50 border-red-200"
            )}
            data-testid="feedback-section"
          >
            {/* Correct/Incorrect header */}
            <div className="flex items-center gap-2">
              {isCorrect ? (
                <>
                  <CheckCircle2 className="size-5 text-green-600" />
                  <span className="font-semibold text-green-800">Correct!</span>
                </>
              ) : (
                <>
                  <XCircle className="size-5 text-red-600" />
                  <span className="font-semibold text-red-800">Not quite right</span>
                </>
              )}
            </div>

            {/* Show correct answer for MCQ/SQL when incorrect */}
            {!isCorrect && microCheck.correctAnswer && (
              <div className="text-sm">
                <span className="font-medium text-gray-700">Correct answer: </span>
                <span className="text-gray-900">
                  {microCheck.type === 'mcq' 
                    ? microCheck.options?.find(o => o.id === microCheck.correctAnswer)?.label || microCheck.correctAnswer
                    : microCheck.correctAnswer
                  }
                </span>
              </div>
            )}

            {/* Explanation */}
            {showExplanation && (
              <div className="pt-2 border-t border-gray-200/50">
                <div className="flex items-center gap-1.5 text-xs font-medium text-gray-600 mb-1">
                  <BookOpen className="size-3.5" />
                  Explanation
                </div>
                <p className="text-sm text-gray-700 leading-relaxed">
                  {microCheck.explanation}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Submit/Continue Button */}
        <Button
          onClick={handleSubmit}
          disabled={!canSubmit() || isLoading || submitted}
          className={cn(
            "w-full",
            submitted && isCorrect && "bg-green-600 hover:bg-green-700",
            submitted && !isCorrect && "bg-red-600 hover:bg-red-700"
          )}
          data-testid="submit-button"
        >
          {isLoading ? (
            <>
              <Loader2 className="size-4 mr-2 animate-spin" />
              Processing...
            </>
          ) : submitted ? (
            isCorrect ? (
              <>
                <CheckCircle2 className="size-4 mr-2" />
                Continue
              </>
            ) : (
              <>
                <XCircle className="size-4 mr-2" />
                Continue
              </>
            )
          ) : (
            'Submit Answer'
          )}
        </Button>
      </CardContent>
    </Card>
  );
}

export default ReinforcementPrompt;
