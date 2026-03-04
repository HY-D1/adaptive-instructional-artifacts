/**
 * Reinforcement Scheduler - Spaced Repetition for SQL Learning
 * 
 * Component 10: Schedules reinforcement prompts using a spaced repetition algorithm
 * with delays at 1, 3, and 7 days after initial learning.
 * 
 * Integrates with InstructionalUnit from the textbook system to generate
 * appropriate reinforcement prompts based on saved content.
 */

import type { InstructionalUnit } from '../types';

/**
 * Version identifier for the reinforcement scheduler module
 */
export const REINFORCEMENT_SCHEDULER_VERSION = 'reinforcement-scheduler-v1';

/**
 * Spaced repetition delay intervals in days
 * Standard pattern: 1 day, 3 days, 7 days for optimal retention
 */
export const SPACED_REPETITION_DELAYS = [1, 3, 7] as const;

/**
 * Type of reinforcement prompt
 * - 'mcq': Multiple choice question testing concept understanding
 * - 'sql_completion': Fill-in-the-blank SQL query completion
 * - 'concept_explanation': Open-ended explanation prompt
 */
export type PromptType = 'mcq' | 'sql_completion' | 'concept_explanation';

/**
 * Status of a scheduled reinforcement prompt
 * - 'pending': Scheduled but not yet shown to learner
 * - 'shown': Displayed to learner, awaiting response
 * - 'completed': Learner has completed the prompt
 * - 'dismissed': Learner dismissed/skipped the prompt
 */
export type PromptStatus = 'pending' | 'shown' | 'completed' | 'dismissed';

/**
 * Individual scheduled prompt within a reinforcement schedule
 */
export interface ScheduledPrompt {
  /** Unique identifier for this prompt */
  id: string;
  /** Delay in days from schedule creation */
  delayDays: number;
  /** Type of prompt to display */
  promptType: PromptType;
  /** Current status of the prompt */
  status: PromptStatus;
  /** Unix timestamp (ms) when prompt should be shown */
  scheduledTime: number;
  /** Unix timestamp (ms) when prompt was shown to learner */
  shownTime?: number;
  /** Unix timestamp (ms) when prompt was completed */
  completedTime?: number;
  /** Optional learner response data */
  response?: {
    /** Whether the response was correct/effective */
    correct: boolean;
    /** Time taken to respond in milliseconds */
    timeSpentMs: number;
    /** Raw response content */
    content?: string;
  };
}

/**
 * Complete reinforcement schedule for a specific unit and learner
 */
export interface ReinforcementSchedule {
  /** Unique identifier for this schedule */
  id: string;
  /** ID of the instructional unit being reinforced */
  unitId: string;
  /** ID of the learner this schedule belongs to */
  learnerId: string;
  /** Primary concept ID being reinforced */
  conceptId: string;
  /** Unix timestamp (ms) when schedule was created */
  createdAt: number;
  /** Array of scheduled prompts at different intervals */
  scheduledPrompts: ScheduledPrompt[];
}

/**
 * Generated prompt content ready for display to learner
 */
export interface PromptContent {
  /** Title of the prompt */
  title: string;
  /** The question or prompt text */
  question: string;
  /** For MCQ: available options */
  options?: string[];
  /** For SQL completion: partial query with blanks */
  partialQuery?: string;
  /** Expected/correct answer */
  correctAnswer: string;
  /** Explanation shown after response */
  explanation: string;
  /** Source unit ID this prompt was generated from */
  sourceUnitId: string;
  /** Concept IDs covered by this prompt */
  conceptIds: string[];
}

/**
 * Configuration options for scheduling reinforcement
 */
export interface ScheduleOptions {
  /** Custom delays (defaults to [1, 3, 7]) */
  delays?: number[];
  /** Custom prompt types for each delay (defaults to cycling through all types) */
  promptTypes?: PromptType[];
  /** Base time for scheduling (defaults to now) */
  baseTime?: number;
}

/**
 * Statistics for a reinforcement schedule
 */
export interface ScheduleStats {
  /** Total number of prompts in schedule */
  total: number;
  /** Number of completed prompts */
  completed: number;
  /** Number of pending prompts */
  pending: number;
  /** Number of shown prompts */
  shown: number;
  /** Number of dismissed prompts */
  dismissed: number;
  /** Completion rate (0-1) */
  completionRate: number;
  /** Whether all prompts are completed */
  isComplete: boolean;
  /** Next due prompt if any */
  nextDue?: ScheduledPrompt;
}

/**
 * Creates a new reinforcement schedule for an instructional unit
 * 
 * Generates 3 prompts with spaced repetition delays (1, 3, 7 days by default).
 * Prompt types cycle through: mcq, sql_completion, concept_explanation.
 * 
 * @param unit - The instructional unit to reinforce
 * @param learnerId - ID of the learner
 * @param options - Optional scheduling configuration
 * @param generateId - Function to generate unique IDs
 * @returns New reinforcement schedule
 * 
 * @example
 * ```typescript
 * const schedule = scheduleReinforcement(
 *   unit,
 *   'learner-123',
 *   {},
 *   () => `sched-${Date.now()}`
 * );
 * ```
 */
export function scheduleReinforcement(
  unit: InstructionalUnit,
  learnerId: string,
  options: ScheduleOptions = {},
  generateId: () => string = () => `sched-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
): ReinforcementSchedule {
  const now = options.baseTime ?? Date.now();
  const delays = options.delays ?? [...SPACED_REPETITION_DELAYS];
  const defaultPromptTypes: PromptType[] = ['mcq', 'sql_completion', 'concept_explanation'];
  const promptTypes = options.promptTypes ?? defaultPromptTypes;

  const scheduledPrompts: ScheduledPrompt[] = delays.map((delayDays, index) => {
    // Cycle through prompt types if fewer types than delays
    const promptType = promptTypes[index % promptTypes.length];
    const scheduledTime = now + delayDays * 24 * 60 * 60 * 1000;

    return {
      id: `${generateId()}-prompt-${index}`,
      delayDays,
      promptType,
      status: 'pending',
      scheduledTime,
    };
  });

  return {
    id: generateId(),
    unitId: unit.id,
    learnerId,
    conceptId: unit.conceptId,
    createdAt: now,
    scheduledPrompts,
  };
}

/**
 * Gets all prompts that are due to be shown at the current time
 * 
 * A prompt is due when:
 * - Its scheduledTime has passed
 * - Its status is 'pending'
 * 
 * @param schedules - Array of reinforcement schedules to check
 * @param currentTime - Optional time to check against (defaults to now)
 * @returns Array of due prompts with their schedule context
 * 
 * @example
 * ```typescript
 * const duePrompts = getDuePrompts(schedules);
 * // Returns: [{ schedule, prompt }, ...]
 * ```
 */
export function getDuePrompts(
  schedules: ReinforcementSchedule[],
  currentTime: number = Date.now()
): Array<{ schedule: ReinforcementSchedule; prompt: ScheduledPrompt }> {
  const due: Array<{ schedule: ReinforcementSchedule; prompt: ScheduledPrompt }> = [];

  for (const schedule of schedules) {
    for (const prompt of schedule.scheduledPrompts) {
      if (prompt.status === 'pending' && prompt.scheduledTime <= currentTime) {
        due.push({ schedule, prompt });
      }
    }
  }

  // Sort by scheduled time (earliest first)
  return due.sort((a, b) => a.prompt.scheduledTime - b.prompt.scheduledTime);
}

/**
 * Marks a prompt as shown to the learner
 * 
 * Updates the prompt status to 'shown' and records the show time.
 * Returns a new schedule object (immutable update).
 * 
 * @param schedule - The reinforcement schedule containing the prompt
 * @param promptId - ID of the prompt to mark as shown
 * @returns Updated schedule with modified prompt
 * @throws Error if prompt not found in schedule
 * 
 * @example
 * ```typescript
 * const updated = markPromptShown(schedule, 'prompt-123');
 * ```
 */
export function markPromptShown(
  schedule: ReinforcementSchedule,
  promptId: string
): ReinforcementSchedule {
  const promptIndex = schedule.scheduledPrompts.findIndex(p => p.id === promptId);
  
  if (promptIndex === -1) {
    throw new Error(`Prompt with ID "${promptId}" not found in schedule`);
  }

  const updatedPrompts = [...schedule.scheduledPrompts];
  updatedPrompts[promptIndex] = {
    ...updatedPrompts[promptIndex],
    status: 'shown',
    shownTime: Date.now(),
  };

  return {
    ...schedule,
    scheduledPrompts: updatedPrompts,
  };
}

/**
 * Marks a prompt as completed by the learner
 * 
 * Updates the prompt status to 'completed' and records completion time
 * and optional response data. Returns a new schedule object (immutable update).
 * 
 * @param schedule - The reinforcement schedule containing the prompt
 * @param promptId - ID of the prompt to mark as completed
 * @param response - Optional response data from the learner
 * @returns Updated schedule with modified prompt
 * @throws Error if prompt not found in schedule
 * 
 * @example
 * ```typescript
 * const updated = markPromptCompleted(schedule, 'prompt-123', {
 *   correct: true,
 *   timeSpentMs: 45000,
 *   content: 'SELECT * FROM users'
 * });
 * ```
 */
export function markPromptCompleted(
  schedule: ReinforcementSchedule,
  promptId: string,
  response?: {
    correct: boolean;
    timeSpentMs: number;
    content?: string;
  }
): ReinforcementSchedule {
  const promptIndex = schedule.scheduledPrompts.findIndex(p => p.id === promptId);
  
  if (promptIndex === -1) {
    throw new Error(`Prompt with ID "${promptId}" not found in schedule`);
  }

  const updatedPrompts = [...schedule.scheduledPrompts];
  updatedPrompts[promptIndex] = {
    ...updatedPrompts[promptIndex],
    status: 'completed',
    completedTime: Date.now(),
    response,
  };

  return {
    ...schedule,
    scheduledPrompts: updatedPrompts,
  };
}

/**
 * Marks a prompt as dismissed/skipped by the learner
 * 
 * Updates the prompt status to 'dismissed'. Returns a new schedule object.
 * 
 * @param schedule - The reinforcement schedule containing the prompt
 * @param promptId - ID of the prompt to mark as dismissed
 * @returns Updated schedule with modified prompt
 * @throws Error if prompt not found in schedule
 */
export function markPromptDismissed(
  schedule: ReinforcementSchedule,
  promptId: string
): ReinforcementSchedule {
  const promptIndex = schedule.scheduledPrompts.findIndex(p => p.id === promptId);
  
  if (promptIndex === -1) {
    throw new Error(`Prompt with ID "${promptId}" not found in schedule`);
  }

  const updatedPrompts = [...schedule.scheduledPrompts];
  updatedPrompts[promptIndex] = {
    ...updatedPrompts[promptIndex],
    status: 'dismissed',
    completedTime: Date.now(),
  };

  return {
    ...schedule,
    scheduledPrompts: updatedPrompts,
  };
}

/**
 * Generates prompt content from an instructional unit
 * 
 * Creates appropriate question content based on the prompt type:
 * - 'mcq': Multiple choice question based on unit content
 * - 'sql_completion': SQL query with blanks to fill
 * - 'concept_explanation': Open-ended explanation request
 * 
 * @param unit - The instructional unit to generate content from
 * @param promptType - Type of prompt to generate
 * @returns Generated prompt content ready for display
 * 
 * @example
 * ```typescript
 * const content = generatePromptContent(unit, 'mcq');
 * // Returns: { title, question, options, correctAnswer, explanation, ... }
 * ```
 */
export function generatePromptContent(
  unit: InstructionalUnit,
  promptType: PromptType
): PromptContent {
  switch (promptType) {
    case 'mcq':
      return generateMCQContent(unit);
    case 'sql_completion':
      return generateSQLCompletionContent(unit);
    case 'concept_explanation':
      return generateConceptExplanationContent(unit);
    default:
      // Exhaustive check - should never reach here with valid types
      throw new Error(`Unknown prompt type: ${promptType}`);
  }
}

/**
 * Generates a multiple choice question from unit content
 */
function generateMCQContent(unit: InstructionalUnit): PromptContent {
  const title = `Review: ${unit.title}`;
  
  // Extract key concept from unit content
  const concept = extractKeyConcept(unit);
  
  // Generate plausible distractors based on content
  const distractors = generateDistractors(unit, concept);
  
  // Create question based on unit type and content
  const question = createMCQQuestion(unit, concept);
  
  // Shuffle options (Fisher-Yates)
  const allOptions = [concept, ...distractors];
  const shuffledOptions = shuffleArray([...allOptions]);
  
  return {
    title,
    question,
    options: shuffledOptions,
    correctAnswer: concept,
    explanation: `Correct! ${unit.summary ?? unit.content.slice(0, 200)}...`,
    sourceUnitId: unit.id,
    conceptIds: unit.conceptIds ?? [unit.conceptId],
  };
}

/**
 * Generates a SQL completion exercise from unit content
 */
function generateSQLCompletionContent(unit: InstructionalUnit): PromptContent {
  const title = `Complete the Query: ${unit.title}`;
  
  // Use minimalExample if available, otherwise create from content
  const exampleQuery = unit.minimalExample ?? extractExampleQuery(unit);
  
  // Create partial query by replacing key parts with blanks
  const { partialQuery, answer } = createPartialQuery(exampleQuery);
  
  const question = 'Complete the following SQL query by filling in the blanks:';
  
  return {
    title,
    question,
    partialQuery,
    correctAnswer: answer,
    explanation: `The complete query is:\n\n\`\`\`sql\n${exampleQuery}\n\`\`\`\n\n${unit.summary ?? ''}`,
    sourceUnitId: unit.id,
    conceptIds: unit.conceptIds ?? [unit.conceptId],
  };
}

/**
 * Generates an open-ended concept explanation prompt
 */
function generateConceptExplanationContent(unit: InstructionalUnit): PromptContent {
  const title = `Explain: ${unit.title}`;
  
  const question = `Explain the concept of "${unit.title}" in your own words. ` +
    `Include:\n` +
    `1. What it does\n` +
    `2. When to use it\n` +
    `3. A brief example\n\n` +
    `Your explanation will help reinforce your understanding.`;
  
  return {
    title,
    question,
    correctAnswer: unit.content.slice(0, 500), // Reference answer from unit
    explanation: `Here's the key information from your notes:\n\n${unit.summary ?? unit.content.slice(0, 300)}...`,
    sourceUnitId: unit.id,
    conceptIds: unit.conceptIds ?? [unit.conceptId],
  };
}

// Helper functions for content generation

function extractKeyConcept(unit: InstructionalUnit): string {
  // Try to extract the main concept from the unit
  const content = unit.content;
  
  // Look for code blocks (often contain the key SQL concept)
  const codeMatch = content.match(/`{3}sql\s*\n([^`]+)`{3}/);
  if (codeMatch) {
    const code = codeMatch[1].trim();
    // Extract first significant keyword
    const keywords = code.match(/\b(SELECT|WHERE|JOIN|GROUP BY|ORDER BY|HAVING|INSERT|UPDATE|DELETE|CREATE|INDEX)\b/i);
    if (keywords) {
      return keywords[0].toUpperCase();
    }
  }
  
  // Fallback to concept name
  return unit.title.split(' ').slice(0, 3).join(' ');
}

function generateDistractors(unit: InstructionalUnit, correctAnswer: string): string[] {
  // Common SQL keywords as distractors
  const commonDistractors = [
    'SELECT', 'INSERT', 'UPDATE', 'DELETE', 'CREATE', 'DROP', 'ALTER',
    'WHERE', 'HAVING', 'GROUP BY', 'ORDER BY', 'JOIN', 'LEFT JOIN',
    'INDEX', 'PRIMARY KEY', 'FOREIGN KEY', 'UNIQUE', 'DISTINCT',
  ];
  
  // Filter out the correct answer and take 3 random distractors
  const filtered = commonDistractors.filter(d => 
    d.toLowerCase() !== correctAnswer.toLowerCase()
  );
  
  return shuffleArray(filtered).slice(0, 3);
}

function createMCQQuestion(unit: InstructionalUnit, concept: string): string {
  const context = unit.summary ?? unit.title;
  
  if (unit.type === 'explanation') {
    return `Based on your notes about "${unit.title}", which SQL clause is most relevant for this concept?`;
  }
  
  if (unit.type === 'example') {
    return `In the context of "${context}", which SQL keyword would you use?`;
  }
  
  return `Which concept is described by: "${context}"?`;
}

function extractExampleQuery(unit: InstructionalUnit): string {
  if (unit.minimalExample) {
    return unit.minimalExample;
  }
  
  const content = unit.content;
  const codeMatch = content.match(/`{3}sql\s*\n([^`]+)`{3}/);
  if (codeMatch) {
    return codeMatch[1].trim();
  }
  
  // Default fallback
  return `SELECT * FROM table WHERE condition;`;
}

function createPartialQuery(fullQuery: string): { partialQuery: string; answer: string } {
  // Simple implementation: replace key parts with ___
  const keywords = ['SELECT', 'WHERE', 'FROM', 'JOIN', 'GROUP BY', 'ORDER BY', 'HAVING'];
  
  for (const keyword of keywords) {
    const regex = new RegExp(`\\b${keyword}\\b`, 'i');
    if (regex.test(fullQuery)) {
      return {
        partialQuery: fullQuery.replace(regex, '___'),
        answer: keyword,
      };
    }
  }
  
  // Fallback: replace first word
  const words = fullQuery.split(' ');
  if (words.length > 1) {
    return {
      partialQuery: '___ ' + words.slice(1).join(' '),
      answer: words[0],
    };
  }
  
  return { partialQuery: fullQuery, answer: fullQuery };
}

function shuffleArray<T>(array: T[]): T[] {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

/**
 * Calculates statistics for a reinforcement schedule
 * 
 * @param schedule - The schedule to analyze
 * @returns Statistics object with completion metrics
 */
export function getScheduleStats(schedule: ReinforcementSchedule): ScheduleStats {
  const prompts = schedule.scheduledPrompts;
  const total = prompts.length;
  const completed = prompts.filter(p => p.status === 'completed').length;
  const pending = prompts.filter(p => p.status === 'pending').length;
  const shown = prompts.filter(p => p.status === 'shown').length;
  const dismissed = prompts.filter(p => p.status === 'dismissed').length;
  
  const completionRate = total > 0 ? completed / total : 0;
  const isComplete = completed === total && total > 0;
  
  // Find next due prompt
  const now = Date.now();
  const nextDue = prompts
    .filter(p => p.status === 'pending' && p.scheduledTime > now)
    .sort((a, b) => a.scheduledTime - b.scheduledTime)[0];
  
  return {
    total,
    completed,
    pending,
    shown,
    dismissed,
    completionRate,
    isComplete,
    nextDue,
  };
}

/**
 * Gets all schedules for a specific learner
 * 
 * @param schedules - Array of all schedules
 * @param learnerId - Learner ID to filter by
 * @returns Schedules belonging to the learner
 */
export function getSchedulesByLearner(
  schedules: ReinforcementSchedule[],
  learnerId: string
): ReinforcementSchedule[] {
  return schedules.filter(s => s.learnerId === learnerId);
}

/**
 * Gets all schedules for a specific unit
 * 
 * @param schedules - Array of all schedules
 * @param unitId - Unit ID to filter by
 * @returns Schedules for the unit
 */
export function getSchedulesByUnit(
  schedules: ReinforcementSchedule[],
  unitId: string
): ReinforcementSchedule[] {
  return schedules.filter(s => s.unitId === unitId);
}

/**
 * Checks if a schedule has any due prompts
 * 
 * @param schedule - Schedule to check
 * @param currentTime - Optional time to check against
 * @returns True if schedule has due prompts
 */
export function hasDuePrompts(
  schedule: ReinforcementSchedule,
  currentTime: number = Date.now()
): boolean {
  return schedule.scheduledPrompts.some(
    p => p.status === 'pending' && p.scheduledTime <= currentTime
  );
}

/**
 * Gets the next due prompt for a learner across all their schedules
 * 
 * @param schedules - All schedules
 * @param learnerId - Learner ID
 * @param currentTime - Optional time to check against
 * @returns Next due prompt or undefined if none
 */
export function getNextDuePrompt(
  schedules: ReinforcementSchedule[],
  learnerId: string,
  currentTime: number = Date.now()
): { schedule: ReinforcementSchedule; prompt: ScheduledPrompt } | undefined {
  const learnerSchedules = getSchedulesByLearner(schedules, learnerId);
  const duePrompts = getDuePrompts(learnerSchedules, currentTime);
  return duePrompts[0];
}
