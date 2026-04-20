/**
 * ReinforcementManager - Knowledge Consolidation System
 * 
 * Component 10: Manages spaced repetition prompts for textbook content.
 * Schedules reinforcement prompts when units are saved and tracks learner responses.
 * 
 * Features:
 * - Schedule reinforcement when textbook unit is created (5-15 min for testing, 1-3-7 days for production)
 * - Check for due reinforcements periodically
 * - Handle learner responses with event logging
 * - Works in hosted mode (no LLM dependency)
 * - Uses safe storage adapter for quota-aware persistence
 */

import type { InstructionalUnit, InteractionEvent } from '../../types';
import type {
  ReinforcementSchedule,
  ScheduledPrompt,
  PromptType,
  PromptContent
} from '../reinforcement-scheduler';
import {
  scheduleReinforcement,
  getDuePrompts as getSchedulerDuePrompts,
  markPromptShown,
  markPromptCompleted,
  markPromptDismissed,
  generatePromptContent
} from '../reinforcement-scheduler';
import { storage } from '../storage/storage';
import { safeStorage, subscribeToStorageTelemetry, type StorageTelemetryEvent } from '../storage/safe-storage';
import { createEventId } from '../utils/event-id';

/**
 * Response type for reinforcement prompts
 */
export type ReinforcementResponse = 'remembered' | 'partial' | 'forgotten';

/**
 * Active prompt with all context needed for display
 */
export interface ActivePrompt {
  scheduleId: string;
  promptId: string;
  unitId: string;
  conceptId: string;
  promptType: PromptType;
  scheduledTime: number;
  content: PromptContent;
}

/**
 * Options for scheduling reinforcement
 */
export interface ScheduleOptions {
  /** Use short delays for testing (5-15 min) instead of production delays (1-3-7 days) */
  useTestDelays?: boolean;
  /** Custom delays in minutes (overrides default behavior) */
  customDelaysMinutes?: number[];
}

/**
 * Storage operation result
 */
export interface StorageResult {
  success: boolean;
  quotaExceeded?: boolean;
  error?: string;
}

/**
 * ReinforcementManager class
 * 
 * Manages the complete lifecycle of reinforcement prompts:
 * 1. Schedule prompts when textbook units are saved
 * 2. Check for due prompts periodically
 * 3. Handle learner responses
 * 4. Log all events for analytics
 * 
 * Storage safety:
 * - Uses safeStorage adapter for quota-aware persistence
 * - Emits telemetry events on storage failures
 * - Gracefully handles quota exceeded errors
 * - Maintains backward compatibility
 */
export class ReinforcementManager {
  private readonly SCHEDULES_KEY = 'sql-learning-reinforcement-schedules';
  
  // Test delays: 5 minutes, 15 minutes, 30 minutes (for development/testing)
  private readonly TEST_DELAYS_MINUTES = [5, 15, 30];
  
  // Production delays: 1 day, 3 days, 7 days (standard spaced repetition)
  private readonly PRODUCTION_DELAYS_DAYS = [1, 3, 7];

  // Telemetry subscription cleanup function
  private telemetryUnsubscribe: (() => void) | null = null;

  constructor() {
    // Subscribe to storage telemetry events
    this.telemetryUnsubscribe = subscribeToStorageTelemetry((event) => {
      if (event.key === this.SCHEDULES_KEY) {
        this.handleStorageTelemetry(event);
      }
    });
  }

  /**
   * Handle storage telemetry events for reinforcement schedules
   */
  private handleStorageTelemetry(event: StorageTelemetryEvent): void {
    // Log to console for debugging/monitoring
    if (event.type === 'storage_write_failed') {
      console.warn('[ReinforcementManager] Storage write failed:', {
        key: event.key,
        details: event.details,
        timestamp: event.timestamp,
      });
    } else if (event.type === 'storage_eviction') {
      console.info('[ReinforcementManager] Storage eviction occurred:', {
        key: event.key,
        details: event.details,
        timestamp: event.timestamp,
      });
    } else if (event.type === 'storage_unavailable') {
      console.warn('[ReinforcementManager] Storage unavailable:', {
        key: event.key,
        details: event.details,
        timestamp: event.timestamp,
      });
    }
  }

  /**
   * Clean up resources (call this when the manager is no longer needed)
   */
  destroy(): void {
    if (this.telemetryUnsubscribe) {
      this.telemetryUnsubscribe();
      this.telemetryUnsubscribe = null;
    }
  }

  /**
   * Get all reinforcement schedules from storage
   */
  getSchedules(): ReinforcementSchedule[] {
    const result = safeStorage.get<ReinforcementSchedule[]>(this.SCHEDULES_KEY, []);
    return result ?? [];
  }

  /**
   * Save reinforcement schedules to storage
   * 
   * Uses safeStorage.safeSet() for quota-aware persistence.
   * Handles quota errors gracefully and emits telemetry on failures.
   * 
   * @param schedules - The schedules to save
   * @returns StorageResult with success flag and error details
   */
  saveSchedules(schedules: ReinforcementSchedule[]): StorageResult {
    const result = safeStorage.set(this.SCHEDULES_KEY, schedules, {
      priority: 'standard',
      allowEviction: true,
    });

    if (!result.success) {
      console.warn('[ReinforcementManager] Failed to save schedules:', result.error);
      
      // Log additional context for quota errors
      if (result.quotaExceeded) {
        console.warn('[ReinforcementManager] Storage quota exceeded. Schedules may not persist.');
      }
    }

    return {
      success: result.success,
      quotaExceeded: result.quotaExceeded,
      error: result.error,
    };
  }

  /**
   * Get schedules for a specific learner
   */
  getSchedulesByLearner(learnerId: string): ReinforcementSchedule[] {
    return this.getSchedules().filter(s => s.learnerId === learnerId);
  }

  /**
   * Schedule reinforcement for a newly created textbook unit
   * 
   * @param unit - The instructional unit to reinforce
   * @param learnerId - ID of the learner
   * @param options - Scheduling options (test mode, custom delays)
   * @returns The created schedule
   */
  scheduleForUnit(
    unit: InstructionalUnit,
    learnerId: string,
    options: ScheduleOptions = {}
  ): ReinforcementSchedule {
    const now = Date.now();
    
    // Determine delays based on mode
    let delaysDays: number[];
    if (options.customDelaysMinutes) {
      // Convert custom minutes to fractional days
      delaysDays = options.customDelaysMinutes.map(m => m / (24 * 60));
    } else if (options.useTestDelays) {
      // Convert test minutes to fractional days
      delaysDays = this.TEST_DELAYS_MINUTES.map(m => m / (24 * 60));
    } else {
      delaysDays = this.PRODUCTION_DELAYS_DAYS;
    }

    // Create schedule using the scheduler
    const schedule = scheduleReinforcement(
      unit,
      learnerId,
      {
        delays: delaysDays,
        promptTypes: ['mcq', 'sql_completion', 'concept_explanation'],
        baseTime: now
      },
      () => `sched-${learnerId}-${unit.id}-${now}`
    );

    // Save to storage
    const schedules = this.getSchedules();
    schedules.push(schedule);
    const saveResult = this.saveSchedules(schedules);

    // Log warning if save failed (but still return the schedule)
    if (!saveResult.success) {
      console.warn('[ReinforcementManager] Schedule created but storage failed. Schedule may not persist across sessions.');
    }

    // Log reinforcement_scheduled event
    this.logScheduledEvent(schedule, unit);

    return schedule;
  }

  /**
   * Get all due prompts for a learner
   * 
   * @param learnerId - ID of the learner
   * @returns Array of active prompts ready to display
   */
  getDuePrompts(learnerId: string): ActivePrompt[] {
    const schedules = this.getSchedulesByLearner(learnerId);
    const now = Date.now();
    
    const dueItems = getSchedulerDuePrompts(schedules, now);
    
    return dueItems.map(({ schedule, prompt }) => {
      // Get the unit to generate content
      const unit = this.getUnitById(schedule.unitId, learnerId);
      
      // Generate content for this prompt
      const content = unit 
        ? generatePromptContent(unit, prompt.promptType)
        : this.createFallbackContent(schedule, prompt);

      return {
        scheduleId: schedule.id,
        promptId: prompt.id,
        unitId: schedule.unitId,
        conceptId: schedule.conceptId,
        promptType: prompt.promptType,
        scheduledTime: prompt.scheduledTime,
        content
      };
    });
  }

  /**
   * Mark a prompt as shown and log the event
   * 
   * @param scheduleId - ID of the schedule
   * @param promptId - ID of the prompt
   * @param learnerId - ID of the learner
   */
  markPromptShown(scheduleId: string, promptId: string, learnerId: string): void {
    const schedules = this.getSchedules();
    const scheduleIndex = schedules.findIndex(s => s.id === scheduleId);
    
    if (scheduleIndex === -1) return;

    const updatedSchedule = markPromptShown(schedules[scheduleIndex], promptId);
    schedules[scheduleIndex] = updatedSchedule;
    this.saveSchedules(schedules);

    // Find the prompt to get scheduledTime
    const prompt = updatedSchedule.scheduledPrompts.find(p => p.id === promptId);
    if (!prompt) return;

    // Log reinforcement_prompt_shown event
    const shownTime = Date.now();
    const delayMs = shownTime - prompt.scheduledTime;

    const event: InteractionEvent = {
      id: createEventId('reinforcement', 'shown'),
      sessionId: storage.getActiveSessionId(),
      learnerId,
      timestamp: shownTime,
      eventType: 'reinforcement_prompt_shown',
      problemId: 'reinforcement',
      scheduleId,
      unitId: updatedSchedule.unitId,
      promptId,
      promptType: prompt.promptType,
      scheduledTime: prompt.scheduledTime,
      shownTime,
      outputs: {
        delayMs,
        promptType: prompt.promptType
      }
    };

    storage.saveInteraction(event);
  }

  /**
   * Record a learner response and log the event
   * 
   * @param scheduleId - ID of the schedule
   * @param promptId - ID of the prompt
   * @param learnerId - ID of the learner
   * @param response - The learner's response ('remembered', 'partial', 'forgotten')
   * @param isCorrect - Whether the response was correct (for MCQ/SQL completion)
   * @param responseTimeMs - Time taken to respond
   */
  recordResponse(
    scheduleId: string,
    promptId: string,
    learnerId: string,
    response: ReinforcementResponse,
    isCorrect: boolean,
    responseTimeMs: number
  ): void {
    const schedules = this.getSchedules();
    const scheduleIndex = schedules.findIndex(s => s.id === scheduleId);
    
    if (scheduleIndex === -1) return;

    // Update schedule
    const updatedSchedule = markPromptCompleted(schedules[scheduleIndex], promptId, {
      correct: isCorrect,
      timeSpentMs: responseTimeMs,
      content: response
    });
    schedules[scheduleIndex] = updatedSchedule;
    this.saveSchedules(schedules);

    // Log reinforcement_response event
    const event: InteractionEvent = {
      id: createEventId('reinforcement', 'response'),
      sessionId: storage.getActiveSessionId(),
      learnerId,
      timestamp: Date.now(),
      eventType: 'reinforcement_response',
      problemId: 'reinforcement',
      scheduleId,
      unitId: updatedSchedule.unitId,
      promptId,
      response,
      isCorrect,
      outputs: {
        responseTimeMs,
        retentionLevel: response
      }
    };

    storage.saveInteraction(event);
  }

  /**
   * Mark a prompt as dismissed/skipped
   * 
   * @param scheduleId - ID of the schedule
   * @param promptId - ID of the prompt
   * @param learnerId - ID of the learner
   */
  dismissPrompt(scheduleId: string, promptId: string, learnerId: string): void {
    const schedules = this.getSchedules();
    const scheduleIndex = schedules.findIndex(s => s.id === scheduleId);
    
    if (scheduleIndex === -1) return;

    const updatedSchedule = markPromptDismissed(schedules[scheduleIndex], promptId);
    schedules[scheduleIndex] = updatedSchedule;
    this.saveSchedules(schedules);

    // Log as a response with 'dismissed' status
    const event: InteractionEvent = {
      id: createEventId('reinforcement', 'dismissed'),
      sessionId: storage.getActiveSessionId(),
      learnerId,
      timestamp: Date.now(),
      eventType: 'reinforcement_response',
      problemId: 'reinforcement',
      scheduleId,
      unitId: updatedSchedule.unitId,
      promptId,
      response: 'dismissed',
      isCorrect: false,
      outputs: {
        dismissed: true
      }
    };

    storage.saveInteraction(event);
  }

  /**
   * Get statistics for reinforcement prompts
   */
  getStats(learnerId?: string): {
    totalSchedules: number;
    totalPrompts: number;
    completedPrompts: number;
    pendingPrompts: number;
    responseRate: number;
    averageRetentionScore: number;
  } {
    const schedules = learnerId 
      ? this.getSchedulesByLearner(learnerId)
      : this.getSchedules();

    let totalPrompts = 0;
    let completedPrompts = 0;
    let pendingPrompts = 0;
    let totalScore = 0;

    for (const schedule of schedules) {
      for (const prompt of schedule.scheduledPrompts) {
        totalPrompts++;
        if (prompt.status === 'completed') {
          completedPrompts++;
          // Calculate retention score based on correctness
          if (prompt.response?.correct) {
            totalScore += 1;
          }
        } else if (prompt.status === 'pending') {
          pendingPrompts++;
        }
      }
    }

    const responseRate = totalPrompts > 0 ? completedPrompts / totalPrompts : 0;
    const averageRetentionScore = completedPrompts > 0 ? totalScore / completedPrompts : 0;

    return {
      totalSchedules: schedules.length,
      totalPrompts,
      completedPrompts,
      pendingPrompts,
      responseRate,
      averageRetentionScore
    };
  }

  /**
   * Log reinforcement_scheduled event
   */
  private logScheduledEvent(schedule: ReinforcementSchedule, unit: InstructionalUnit): void {
    const event: InteractionEvent = {
      id: createEventId('reinforcement', 'scheduled'),
      sessionId: storage.getActiveSessionId(),
      learnerId: schedule.learnerId,
      timestamp: schedule.createdAt,
      eventType: 'reinforcement_scheduled',
      problemId: 'reinforcement',
      scheduleId: schedule.id,
      unitId: unit.id,
      conceptIds: unit.conceptIds ?? [unit.conceptId],
      scheduledTime: schedule.scheduledPrompts[0]?.scheduledTime,
      outputs: {
        promptCount: schedule.scheduledPrompts.length,
        promptTypes: schedule.scheduledPrompts.map(p => p.promptType),
        delays: schedule.scheduledPrompts.map(p => p.delayDays).join(',')
      }
    };

    storage.saveInteraction(event);
  }

  /**
   * Get unit by ID from storage
   */
  private getUnitById(unitId: string, learnerId: string): InstructionalUnit | undefined {
    const textbook = storage.getTextbook(learnerId);
    return textbook.find(u => u.id === unitId);
  }

  /**
   * Create fallback content when unit is not found
   */
  private createFallbackContent(
    schedule: ReinforcementSchedule,
    prompt: ScheduledPrompt
  ): PromptContent {
    return {
      title: 'Knowledge Check',
      question: 'Do you remember the key concept from your notes?',
      options: ['Yes, clearly', 'Somewhat', 'Need to review'],
      correctAnswer: 'Yes, clearly',
      explanation: 'Review your notes to reinforce this concept.',
      sourceUnitId: schedule.unitId,
      conceptIds: [schedule.conceptId]
    };
  }
}

// Singleton instance
export const reinforcementManager = new ReinforcementManager();

export default reinforcementManager;
