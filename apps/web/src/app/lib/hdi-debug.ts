/**
 * HDI Debug Utilities
 * 
 * Helper functions for HDI (Hint Dependency Index) debugging and testing.
 * Extracted from SettingsPage for testability and reuse.
 * 
 * @module hdi-debug
 */

import type { InteractionEvent } from '../types';

/**
 * HDI event types that should be tracked and can be cleared
 */
export const HDI_EVENT_TYPES = [
  'hdi_calculated',
  'hdi_trajectory_updated',
  'dependency_intervention_triggered',
] as const;

export type HDIEventType = (typeof HDI_EVENT_TYPES)[number];

/**
 * Result of HDI data calculation
 */
export interface HDIDataResult {
  /** Latest HDI score (0-1) or null if no data */
  score: number | null;
  /** Number of HDI-related events */
  eventCount: number;
  /** All HDI events found */
  events: InteractionEvent[];
}

/**
 * Calculate HDI data for a learner from interaction events
 * 
 * @param interactions - All interaction events
 * @param learnerId - Learner ID to filter by
 * @returns HDI data including latest score and event count
 * 
 * @example
 * ```typescript
 * const interactions = storage.getAllInteractions();
 * const hdiData = calculateHDIData(interactions, 'learner-123');
 * console.log(hdiData.score); // 0.75
 * ```
 */
export function calculateHDIData(
  interactions: InteractionEvent[],
  learnerId: string
): HDIDataResult {
  // Filter HDI events for this learner
  const hdiEvents = interactions.filter(
    (i) =>
      i.learnerId === learnerId &&
      (i.eventType === 'hdi_calculated' ||
        i.eventType === 'hdi_trajectory_updated' ||
        i.eventType === 'dependency_intervention_triggered')
  );

  // Get latest HDI score (events with hdi property defined)
  const latestHdiEvent = hdiEvents
    .filter((i) => i.hdi !== undefined && i.hdi !== null)
    .sort((a, b) => b.timestamp - a.timestamp)[0];

  return {
    score: latestHdiEvent?.hdi ?? null,
    eventCount: hdiEvents.length,
    events: hdiEvents,
  };
}

/**
 * Filter out HDI events for a specific learner
 * 
 * @param interactions - All interaction events
 * @param learnerId - Learner ID to filter by
 * @returns Filtered interactions without HDI events for the learner
 * 
 * @example
 * ```typescript
 * const interactions = storage.getAllInteractions();
 * const filtered = filterOutHDIEvents(interactions, 'learner-123');
 * storage.saveAllInteractions(filtered);
 * ```
 */
export function filterOutHDIEvents(
  interactions: InteractionEvent[],
  learnerId: string
): InteractionEvent[] {
  return interactions.filter(
    (i) =>
      !(
        i.learnerId === learnerId &&
        (i.eventType === 'hdi_calculated' ||
          i.eventType === 'hdi_trajectory_updated' ||
          i.eventType === 'dependency_intervention_triggered')
      )
  );
}

/**
 * Format HDI score for display
 * 
 * @param score - HDI score (0-1) or null
 * @returns Formatted string (e.g., "75%", "N/A")
 * 
 * @example
 * ```typescript
 * formatHDIScore(0.75); // "75%"
 * formatHDIScore(null); // "N/A"
 * ```
 */
export function formatHDIScore(score: number | null): string {
  if (score === null || score === undefined) {
    return 'N/A';
  }
  return `${Math.round(score * 100)}%`;
}

/**
 * Format HDI score with 3 decimal places for detailed display
 * 
 * @param score - HDI score (0-1) or null
 * @returns Formatted string with 3 decimal places
 * 
 * @example
 * ```typescript
 * formatHDIDetailed(0.75); // "0.750"
 * formatHDIDetailed(null); // "N/A"
 * ```
 */
export function formatHDIDetailed(score: number | null): string {
  if (score === null || score === undefined) {
    return 'N/A';
  }
  return score.toFixed(3);
}

/**
 * Check if an event is an HDI event
 * 
 * @param event - Interaction event to check
 * @returns True if the event is an HDI-related event
 */
export function isHDIEvent(event: InteractionEvent): boolean {
  return (
    event.eventType === 'hdi_calculated' ||
    event.eventType === 'hdi_trajectory_updated' ||
    event.eventType === 'dependency_intervention_triggered'
  );
}

/**
 * Create a mock HDI event for testing
 * 
 * @param learnerId - Learner ID
 * @param hdi - HDI score (0-1)
 * @param timestamp - Optional timestamp (defaults to now)
 * @returns Mock HDI calculated event
 * 
 * @example
 * ```typescript
 * const event = createMockHDIEvent('learner-123', 0.75);
 * storage.saveInteraction(event);
 * ```
 */
export function createMockHDIEvent(
  learnerId: string,
  hdi: number,
  timestamp: number = Date.now()
): InteractionEvent {
  return {
    id: `mock-hdi-${timestamp}`,
    learnerId,
    timestamp,
    eventType: 'hdi_calculated',
    problemId: 'mock-problem',
    hdi,
    hdiLevel: hdi > 0.6 ? 'high' : hdi > 0.3 ? 'medium' : 'low',
    policyVersion: 'hdi-debug-mock-v1',
  };
}

/**
 * Create multiple mock HDI events for testing trajectory
 * 
 * @param learnerId - Learner ID
 * @param scores - Array of HDI scores
 * @returns Array of mock HDI events
 * 
 * @example
 * ```typescript
 * const events = createMockHDITrajectory('learner-123', [0.5, 0.6, 0.75]);
 * events.forEach(e => storage.saveInteraction(e));
 * ```
 */
export function createMockHDITrajectory(
  learnerId: string,
  scores: number[]
): InteractionEvent[] {
  const baseTime = Date.now();
  return scores.map((hdi, index) => ({
    id: `mock-hdi-${baseTime}-${index}`,
    learnerId,
    timestamp: baseTime + index * 1000, // 1 second apart
    eventType: index === scores.length - 1 ? 'hdi_trajectory_updated' : 'hdi_calculated',
    problemId: `mock-problem-${index}`,
    hdi,
    hdiLevel: hdi > 0.6 ? 'high' : hdi > 0.3 ? 'medium' : 'low',
    trend: index > 0 ? (hdi > scores[index - 1] ? 'increasing' : 'decreasing') : 'stable',
    policyVersion: 'hdi-debug-mock-v1',
  }));
}
