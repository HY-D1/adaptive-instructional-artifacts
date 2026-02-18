/**
 * Session Events - Custom event emitter for session changes within same tab
 * 
 * This module provides a type-safe event system for session-related changes
 * that need to be broadcast within the same browser tab. Cross-tab communication
 * is handled via the native StorageEvent API.
 * 
 * Events:
 * - profile:updated - Profile was updated (same tab)
 * - profile:cleared - Profile was cleared/logged out (same tab)
 * 
 * @module session-events
 */

import type { UserProfile } from '../types';

/**
 * Session event types
 */
export type SessionEventType = 'profile:updated' | 'profile:cleared';

/**
 * Base session event payload
 */
export interface SessionEventPayload {
  timestamp: number;
  source: 'manual' | 'storage';
}

/**
 * Profile updated event payload
 */
export interface ProfileUpdatedPayload extends SessionEventPayload {
  type: 'profile:updated';
  profile: UserProfile;
  previousProfile: UserProfile | null;
}

/**
 * Profile cleared event payload
 */
export interface ProfileClearedPayload extends SessionEventPayload {
  type: 'profile:cleared';
  previousProfile: UserProfile | null;
}

/**
 * Union type for all session event payloads
 */
export type SessionEventData = ProfileUpdatedPayload | ProfileClearedPayload;

/**
 * Event handler type
 */
export type SessionEventHandler<T extends SessionEventData = SessionEventData> = (
  payload: T
) => void;

// Registry of event listeners
const listeners = new Map<SessionEventType, Set<SessionEventHandler>>();

/**
 * Subscribe to a session event
 * @param eventType - The event type to subscribe to
 * @param handler - The handler function
 * @returns Unsubscribe function
 * 
 * @example
 * ```typescript
 * const unsubscribe = onSessionEvent('profile:updated', (payload) => {
 *   console.log('Profile updated:', payload.profile);
 * });
 * 
 * // Later: unsubscribe();
 * ```
 */
export function onSessionEvent<T extends SessionEventData>(
  eventType: T['type'],
  handler: SessionEventHandler<T>
): () => void {
  if (!listeners.has(eventType)) {
    listeners.set(eventType, new Set());
  }
  
  const eventListeners = listeners.get(eventType)!;
  // Cast needed because TypeScript doesn't track the generic relationship through Set
  eventListeners.add(handler as SessionEventHandler);
  
  // Return unsubscribe function
  return () => {
    eventListeners.delete(handler as SessionEventHandler);
  };
}

/**
 * Emit a session event to all listeners in the same tab
 * @param payload - The event payload
 * 
 * @example
 * ```typescript
 * emitSessionEvent({
 *   type: 'profile:updated',
 *   profile: newProfile,
 *   previousProfile: oldProfile,
 *   timestamp: Date.now(),
 *   source: 'manual'
 * });
 * ```
 */
export function emitSessionEvent(payload: SessionEventData): void {
  const eventListeners = listeners.get(payload.type);
  if (!eventListeners) return;
  
  for (const handler of eventListeners) {
    try {
      handler(payload);
    } catch (error) {
      console.error(`[SessionEvents] Error in handler for ${payload.type}:`, error);
    }
  }
}

/**
 * Emit a profile updated event
 * @param profile - The new profile
 * @param previousProfile - The previous profile (if any)
 * @param source - The source of the update
 */
export function emitProfileUpdated(
  profile: UserProfile,
  previousProfile: UserProfile | null,
  source: 'manual' | 'storage' = 'manual'
): void {
  emitSessionEvent({
    type: 'profile:updated',
    profile,
    previousProfile,
    timestamp: Date.now(),
    source
  });
}

/**
 * Emit a profile cleared event
 * @param previousProfile - The profile that was cleared (if any)
 * @param source - The source of the clear
 */
export function emitProfileCleared(
  previousProfile: UserProfile | null,
  source: 'manual' | 'storage' = 'manual'
): void {
  emitSessionEvent({
    type: 'profile:cleared',
    previousProfile,
    timestamp: Date.now(),
    source
  });
}

/**
 * Clear all listeners (useful for testing)
 */
export function clearAllSessionListeners(): void {
  listeners.clear();
}

/**
 * Get count of active listeners (useful for testing/debugging)
 */
export function getListenerCount(eventType?: SessionEventType): number {
  if (eventType) {
    return listeners.get(eventType)?.size ?? 0;
  }
  
  let total = 0;
  for (const set of listeners.values()) {
    total += set.size;
  }
  return total;
}
