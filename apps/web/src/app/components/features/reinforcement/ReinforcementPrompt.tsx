import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Button } from '../../ui/button';
import { RadioGroup, RadioGroupItem } from '../../ui/radio-group';
import { Textarea } from '../../ui/textarea';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { CheckCircle2, XCircle, Lightbulb, X, BookOpen, Code, MessageSquare, HelpCircle } from 'lucide-react';
import { cn } from '../../ui/utils';
import type { ActivePrompt, ReinforcementResponse } from '../../../lib/content/reinforcement-manager';

/**
 * Props for the ReinforcementPrompt component
 */
export interface ReinforcementPromptProps {
  /** The active prompt data from the schedule */
  prompt: ActivePrompt;
  /** Current prompt number in the sequence (1, 2, or 3) */
  promptNumber: number;
  /** Total number of prompts in the sequence */
  totalPrompts: number;
  /** Callback when user submits a response */
  onResponse: (response: ReinforcementResponse, isCorrect: boolean, responseTimeMs: number) => void;
  /** Callback when user dismisses/skips the prompt */
  onDismiss: () => void;
}

/**
 * ReinforcementPrompt - Displays reinforcement prompts to learners for knowledge consolidation
 * 
 * Supports three prompt types:
 * - MCQ: Multiple choice questions with clickable options
 * - SQL Completion: Code input with run/submit button
 * - Concept Explanation: Text area for free-form explanation
 * 
 * Also supports simple retention check with "I remember", "Partially", "Don't remember" responses.
 * 
 * @example
 * ```tsx
 * <ReinforcementPrompt
 *   prompt={activePrompt}
 *   promptNumber={1}
 *   totalPrompts={3}
 *   onResponse={(response, isCorrect, timeMs) => console.log(response, isCorrect, timeMs)}
 *   onDismiss={() => setShowPrompt(false)}
 * />
 * ```
 */
export function ReinforcementPrompt({
  prompt,
  promptNumber,
  totalPrompts,
  onResponse,
  onDismiss,
}: ReinforcementPromptProps) {
  const [selectedOption, setSelectedOption] = useState<string>('');
  const [sqlInput, setSqlInput] = useState<string>('');
  const [explanationInput, setExplanationInput] = useState<string>('');
  const [submitted, setSubmitted] = useState<boolean>(false);
  const [isCorrect, setIsCorrect] = useState<boolean>(false);
  const [showExplanation, setShowExplanation] = useState<boolean>(false);
  const [startTime] = useState<number>(Date.now());

  // Reset state when prompt changes
  useEffect(() => {
    setSelectedOption('');
    setSqlInput('');
    setExplanationInput('');
    setSubmitted(false);
    setIsCorrect(false);
    setShowExplanation(false);
  }, [prompt.promptId]);

  const handleSubmit = () => {
    const responseTimeMs = Date.now() - startTime;
    let response: ReinforcementResponse = 'forgotten';
    let correct = false;

    switch (prompt.promptType) {
      case 'mcq':
        // Map MCQ responses to retention levels
        if (selectedOption === 'remembered' || selectedOption === prompt.content.correctAnswer) {
          response = 'remembered';
          correct = true;
        } else if (selectedOption === 'partial') {
          response = 'partial';
          correct = false;
        } else {
          response = 'forgotten';
          correct = false;
        }
        break;
        
      case 'sql_completion':
        // Check SQL correctness
        const normalizedInput = sqlInput.toLowerCase().replace(/\s+/g, ' ').trim();
        const normalizedExpected = (prompt.content.correctAnswer || '').toLowerCase().replace(/\s+/g, ' ').trim();
        correct = normalizedInput === normalizedExpected;
        response = correct ? 'remembered' : 'partial';
        break;
        
      case 'concept_explanation':
        // For explanations, consider it correct if they provide substantial content
        correct = explanationInput.trim().length > 20;
        response = correct ? 'remembered' : 'partial';
        break;
    }

    setIsCorrect(correct);
    setSubmitted(true);
    setShowExplanation(true);
    onResponse(response, correct, responseTimeMs);
  };

  const handleRetentionResponse = (retentionLevel: ReinforcementResponse) => {
    const responseTimeMs = Date.now() - startTime;
    const correct = retentionLevel === 'remembered';
    
    setSelectedOption(retentionLevel);
    setIsCorrect(correct);
    setSubmitted(true);
    setShowExplanation(true);
    onResponse(retentionLevel, correct, responseTimeMs);
  };

  const handleDismiss = () => {
    onDismiss();
  };

  const canSubmit = () => {
    switch (prompt.promptType) {
      case 'mcq':
        return selectedOption !== '';
      case 'sql_completion':
        return sqlInput.trim() !== '';
      case 'concept_explanation':
        return explanationInput.trim() !== '';
      default:
        return false;
    }
  };

  const getPromptIcon = () => {
    switch (prompt.promptType) {
      case 'mcq':
        return <HelpCircle className="size-4 text-blue-500" />;
      case 'sql_completion':
        return <Code className="size-4 text-purple-500" />;
      case 'concept_explanation':
        return <MessageSquare className="size-4 text-emerald-500" />;
      default:
        return <Lightbulb className="size-4 text-amber-500" />;
    }
  };

  const getPromptTypeLabel = () => {
    switch (prompt.promptType) {
      case 'mcq':
        return 'Knowledge Check';
      case 'sql_completion':
        return 'SQL Practice';
      case 'concept_explanation':
        return 'Concept Check';
      default:
        return 'Knowledge Check';
    }
  };

  // Check if we should show the simplified retention UI ("I remember", "Partially", "Don't remember")
  const showRetentionUI = prompt.promptType === 'mcq' && !prompt.content.options;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      data-testid="reinforcement-prompt-modal"
    >
      <Card 
        className="w-full max-w-lg shadow-xl"
        data-testid={`reinforcement-prompt-${prompt.promptId}`}
      >
        {/* Header with concept/topic and progress */}
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2">
              <div className={cn(
                "p-1.5 rounded-lg",
                prompt.promptType === 'mcq' && "bg-blue-50",
                prompt.promptType === 'sql_completion' && "bg-purple-50",
                prompt.promptType === 'concept_explanation' && "bg-emerald-50",
              )}>
                {getPromptIcon()}
              </div>
              <div>
                <CardTitle className="text-sm font-semibold text-gray-900">
                  {prompt.content.title}
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
              {!submitted && (
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
            {prompt.content.question}
          </div>

          {/* Simplified Retention UI - "I remember", "Partially", "Don't remember" */}
          {showRetentionUI && !submitted && (
            <div className="space-y-2" data-testid="retention-options">
              <Button
                variant="outline"
                className="w-full justify-start h-auto p-3 border-green-200 hover:bg-green-50 hover:border-green-300"
                onClick={() => handleRetentionResponse('remembered')}
              >
                <CheckCircle2 className="size-5 text-green-500 mr-3 shrink-0" />
                <div className="text-left">
                  <div className="font-medium text-gray-900">I remember clearly</div>
                  <div className="text-xs text-gray-500">I can explain this concept confidently</div>
                </div>
              </Button>
              
              <Button
                variant="outline"
                className="w-full justify-start h-auto p-3 border-yellow-200 hover:bg-yellow-50 hover:border-yellow-300"
                onClick={() => handleRetentionResponse('partial')}
              >
                <Lightbulb className="size-5 text-yellow-500 mr-3 shrink-0" />
                <div className="text-left">
                  <div className="font-medium text-gray-900">I remember partially</div>
                  <div className="text-xs text-gray-500">I recall some parts but need a refresher</div>
                </div>
              </Button>
              
              <Button
                variant="outline"
                className="w-full justify-start h-auto p-3 border-red-200 hover:bg-red-50 hover:border-red-300"
                onClick={() => handleRetentionResponse('forgotten')}
              >
                <XCircle className="size-5 text-red-500 mr-3 shrink-0" />
                <div className="text-left">
                  <div className="font-medium text-gray-900">I don't remember</div>
                  <div className="text-xs text-gray-500">I need to review this concept again</div>
                </div>
              </Button>
            </div>
          )}

          {/* MCQ Options */}
          {prompt.promptType === 'mcq' && prompt.content.options && !submitted && (
            <RadioGroup 
              value={selectedOption} 
              onValueChange={setSelectedOption}
              className="gap-2"
              data-testid="mcq-options"
            >
              {prompt.content.options.map((option, index) => (
                <div 
                  key={index}
                  className={cn(
                    "flex items-center gap-3 rounded-lg border p-3 transition-colors cursor-pointer",
                    selectedOption === option
                      ? "border-amber-500 bg-amber-50/50" 
                      : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                  )}
                  onClick={() => setSelectedOption(option)}
                  data-testid={`option-${index}`}
                >
                  <RadioGroupItem 
                    value={option} 
                    id={`option-${index}`}
                    className="shrink-0"
                  />
                  <Label 
                    htmlFor={`option-${index}`}
                    className="cursor-pointer text-sm text-gray-700 flex-1"
                  >
                    {option}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          )}

          {/* SQL Completion Input */}
          {prompt.promptType === 'sql_completion' && !submitted && (
            <div className="space-y-2" data-testid="sql-input-container">
              {prompt.content.partialQuery && (
                <div className="bg-gray-50 p-3 rounded-lg font-mono text-sm">
                  {prompt.content.partialQuery.replace('___', '______')}
                </div>
              )}
              <div className="relative">
                <Code className="absolute left-3 top-2.5 size-4 text-gray-400" />
                <Input
                  value={sqlInput}
                  onChange={(e) => setSqlInput(e.target.value)}
                  placeholder="Type your SQL here..."
                  className="pl-9 font-mono text-sm"
                  data-testid="sql-input"
                />
              </div>
            </div>
          )}

          {/* Concept Explanation Textarea */}
          {prompt.promptType === 'concept_explanation' && !submitted && (
            <div className="space-y-2" data-testid="explanation-container">
              <Textarea
                value={explanationInput}
                onChange={(e) => setExplanationInput(e.target.value)}
                placeholder="Explain this concept in your own words..."
                className="min-h-[100px] resize-none"
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
                  : "bg-yellow-50 border-yellow-200"
              )}
              data-testid="feedback-section"
            >
              {/* Correct/Incorrect header */}
              <div className="flex items-center gap-2">
                {isCorrect ? (
                  <>
                    <CheckCircle2 className="size-5 text-green-600" />
                    <span className="font-semibold text-green-800">Great job!</span>
                  </>
                ) : (
                  <>
                    <Lightbulb className="size-5 text-yellow-600" />
                    <span className="font-semibold text-yellow-800">Keep practicing</span>
                  </>
                )}
              </div>

              {/* Show correct answer for MCQ/SQL when incorrect */}
              {!isCorrect && prompt.content.correctAnswer && prompt.promptType !== 'concept_explanation' && (
                <div className="text-sm">
                  <span className="font-medium text-gray-700">Correct answer: </span>
                  <span className="text-gray-900">{prompt.content.correctAnswer}</span>
                </div>
              )}

              {/* Explanation */}
              {showExplanation && prompt.content.explanation && (
                <div className="pt-2 border-t border-gray-200/50">
                  <div className="flex items-center gap-1.5 text-xs font-medium text-gray-600 mb-1">
                    <BookOpen className="size-3.5" />
                    Explanation
                  </div>
                  <p className="text-sm text-gray-700 leading-relaxed">
                    {prompt.content.explanation}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Submit/Continue Button - Only show for non-retention UI types */}
          {!showRetentionUI && (
            <Button
              onClick={handleSubmit}
              disabled={!canSubmit() || submitted}
              className={cn(
                "w-full",
                submitted && isCorrect && "bg-green-600 hover:bg-green-700",
                submitted && !isCorrect && "bg-yellow-600 hover:bg-yellow-700"
              )}
              data-testid="submit-button"
            >
              {submitted ? (
                isCorrect ? (
                  <>
                    <CheckCircle2 className="size-4 mr-2" />
                    Continue
                  </>
                ) : (
                  <>
                    <Lightbulb className="size-4 mr-2" />
                    Continue
                  </>
                )
              ) : (
                'Submit Answer'
              )}
            </Button>
          )}

          {/* Done button after submission */}
          {submitted && (
            <Button
              onClick={onDismiss}
              className="w-full"
              variant="outline"
              data-testid="done-button"
            >
              Done
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default ReinforcementPrompt;
