/**
 * Learner Profile Client
 * 
 * Dedicated client for learner profile operations with:
 * - Backend API integration
 * - Local caching for offline use
 * - Automatic sync when online
 * - Event-driven profile updates
 */

import type {
  LearnerProfile,
  ConceptCoverageEvidence,
  InteractionEvent,
} from '@/app/types';
import { withCsrfHeader } from './csrf-client';
import { safeSet } from '../storage/safe-storage';

// API Configuration
// VITE_API_BASE_URL is the canonical env var (e.g. https://my-api.vercel.app — no trailing /api)
const _API_BASE = import.meta.env.VITE_API_BASE_URL;
const API_URL = _API_BASE ? `${_API_BASE}/api` : 'http://localhost:3001/api';
const USE_BACKEND = !!_API_BASE;

// Cache configuration
const CACHE_KEY = 'sql-adapt-profile-cache';
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const SYNC_INTERVAL = 30 * 1000; // 30 seconds

// ============================================================================
// Types
// ============================================================================

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

interface BackendLearnerProfile {
  id: string;
  name: string;
  conceptsCovered: string[];
  conceptCoverageEvidence: Record<string, ConceptCoverageEvidence>;
  errorHistory: Record<string, number>;
  solvedProblemIds?: string[];
  interactionCount: number;
  currentStrategy: string;
  preferences: {
    escalationThreshold: number;
    aggregationDelay: number;
    autoTextbookEnabled?: boolean;
    notificationsEnabled?: boolean;
    theme?: 'light' | 'dark' | 'system';
  };
  createdAt: number;
  lastActive: number;
  extendedData?: Record<string, unknown>;
}

interface CachedProfile {
  profile: LearnerProfile;
  timestamp: number;
  synced: boolean;
  pendingUpdates: InteractionEvent[];
}

interface ProfileCache {
  [learnerId: string]: CachedProfile;
}

// ============================================================================
// HTTP Client
// ============================================================================

async function fetchApi<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  const url = `${API_URL}${endpoint}`;
  const requestInit = withCsrfHeader(options);
  const headers = new Headers(requestInit.headers || {});
  if (!headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  
  try {
    const response = await fetch(url, {
      ...requestInit,
      credentials: 'include',
      headers,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return {
        success: false,
        error: errorData.error || `HTTP ${response.status}: ${response.statusText}`,
        message: errorData.message,
      };
    }

    const data = await response.json();
    return data;
  } catch (error) {
    return {
      success: false,
      error: 'Network error',
      message: error instanceof Error ? error.message : 'Failed to connect to backend',
    };
  }
}

// ============================================================================
// Cache Management
// ============================================================================

function getCache(): ProfileCache {
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    return cached ? JSON.parse(cached) : {};
  } catch {
    return {};
  }
}

function setCache(cache: ProfileCache): void {
  const result = safeSet(CACHE_KEY, cache);
  if (!result.success) {
    console.warn('[ProfileClient] Failed to save cache:', result.error);
  }
}

function getCachedProfile(learnerId: string): CachedProfile | null {
  const cache = getCache();
  const cached = cache[learnerId];
  
  if (!cached) return null;
  
  // Check if cache is expired
  if (Date.now() - cached.timestamp > CACHE_TTL) {
    return null;
  }
  
  // Restore Set from array
  return {
    ...cached,
    profile: {
      ...cached.profile,
      conceptsCovered: new Set(cached.profile.conceptsCovered),
      conceptCoverageEvidence: new Map(Object.entries(cached.profile.conceptCoverageEvidence)),
      errorHistory: new Map(Object.entries(cached.profile.errorHistory)),
      solvedProblemIds: new Set((cached.profile.solvedProblemIds as unknown as string[]) || []),
    },
  };
}

function setCachedProfile(learnerId: string, profile: LearnerProfile, synced: boolean = true, pendingUpdates: InteractionEvent[] = []): void {
  const cache = getCache();
  
  cache[learnerId] = {
    profile: {
      ...profile,
      conceptsCovered: Array.from(profile.conceptsCovered) as unknown as Set<string>,
      conceptCoverageEvidence: Object.fromEntries(profile.conceptCoverageEvidence) as unknown as Map<string, ConceptCoverageEvidence>,
      errorHistory: Object.fromEntries(profile.errorHistory) as unknown as Map<string, number>,
      solvedProblemIds: Array.from(profile.solvedProblemIds) as unknown as Set<string>,
    },
    timestamp: Date.now(),
    synced,
    pendingUpdates,
  };
  
  setCache(cache);
}

function addPendingUpdate(learnerId: string, event: InteractionEvent): void {
  const cache = getCache();
  const cached = cache[learnerId];
  
  if (cached) {
    cached.pendingUpdates.push(event);
    cached.synced = false;
    setCache(cache);
  }
}

function clearPendingUpdates(learnerId: string): void {
  const cache = getCache();
  if (cache[learnerId]) {
    cache[learnerId].pendingUpdates = [];
    cache[learnerId].synced = true;
    setCache(cache);
  }
}

// ============================================================================
// Profile Conversion
// ============================================================================

function convertToFrontendProfile(data: BackendLearnerProfile): LearnerProfile {
  return {
    id: data.id,
    name: data.name,
    conceptsCovered: new Set(data.conceptsCovered),
    conceptCoverageEvidence: new Map(Object.entries(data.conceptCoverageEvidence)),
    errorHistory: new Map(Object.entries(data.errorHistory)),
    solvedProblemIds: new Set(data.solvedProblemIds || []),
    interactionCount: data.interactionCount,
    currentStrategy: data.currentStrategy as LearnerProfile['currentStrategy'],
    preferences: data.preferences,
    createdAt: data.createdAt,
    lastActive: data.lastActive,
  };
}

function convertToBackendProfile(profile: LearnerProfile): BackendLearnerProfile {
  return {
    id: profile.id,
    name: profile.name,
    conceptsCovered: Array.from(profile.conceptsCovered),
    conceptCoverageEvidence: Object.fromEntries(profile.conceptCoverageEvidence),
    errorHistory: Object.fromEntries(profile.errorHistory),
    interactionCount: profile.interactionCount,
    currentStrategy: profile.currentStrategy,
    preferences: profile.preferences,
    createdAt: profile.createdAt || Date.now(),
    lastActive: profile.lastActive || Date.now(),
  };
}

// ============================================================================
// Profile API Operations
// ============================================================================

/**
 * Get a learner's full profile
 * Uses cache if available and not expired, fetches from backend otherwise
 */
export async function getProfile(learnerId: string, forceRefresh: boolean = false): Promise<LearnerProfile | null> {
  // Check cache first
  if (!forceRefresh && !USE_BACKEND) {
    const cached = getCachedProfile(learnerId);
    if (cached) {
      console.log('[ProfileClient] Using cached profile for', learnerId);
      return cached.profile;
    }
  }
  
  if (!USE_BACKEND) {
    return null;
  }

  const response = await fetchApi<BackendLearnerProfile>(`/learners/${learnerId}/profile`);
  
  if (!response.success || !response.data) {
    // Fallback to cache on error
    const cached = getCachedProfile(learnerId);
    if (cached) {
      console.log('[ProfileClient] Backend error, using cached profile');
      return cached.profile;
    }
    return null;
  }

  const profile = convertToFrontendProfile(response.data);
  setCachedProfile(learnerId, profile, true);
  
  return profile;
}

/**
 * Save a learner's full profile
 */
export async function saveProfile(profile: LearnerProfile): Promise<boolean> {
  // Always update cache
  setCachedProfile(profile.id, profile, false);
  
  if (!USE_BACKEND) {
    return true;
  }

  const response = await fetchApi<BackendLearnerProfile>(`/learners/${profile.id}/profile`, {
    method: 'PUT',
    body: JSON.stringify(convertToBackendProfile(profile)),
  });
  
  if (response.success) {
    setCachedProfile(profile.id, profile, true);
  }
  
  return response.success;
}

/**
 * Get all learner profiles (for instructor dashboard)
 */
export async function getAllProfiles(): Promise<LearnerProfile[]> {
  if (!USE_BACKEND) {
    // Return all cached profiles
    const cache = getCache();
    return Object.values(cache).map(c => c.profile);
  }

  const response = await fetchApi<BackendLearnerProfile[]>('/learners/profiles');
  
  if (!response.success || !response.data) {
    // Fallback to cache
    const cache = getCache();
    return Object.values(cache).map(c => c.profile);
  }

  const profiles = response.data.map(convertToFrontendProfile);
  
  // Update cache for all profiles
  profiles.forEach(profile => {
    setCachedProfile(profile.id, profile, true);
  });
  
  return profiles;
}

/**
 * Update profile from a single event (server-side derivation)
 */
export async function updateProfileFromEvent(
  learnerId: string,
  event: InteractionEvent
): Promise<LearnerProfile | null> {
  // Add to pending updates
  addPendingUpdate(learnerId, event);
  
  if (!USE_BACKEND) {
    // Apply update locally
    return applyEventToLocalProfile(learnerId, event);
  }

  const response = await fetchApi<BackendLearnerProfile>(`/learners/${learnerId}/profile/events`, {
    method: 'POST',
    body: JSON.stringify({
      event: {
        learnerId: event.learnerId,
        sessionId: event.sessionId,
        timestamp: new Date(event.timestamp).toISOString(),
        eventType: event.eventType,
        problemId: event.problemId,
        successful: event.successful,
        errorSubtypeId: event.errorSubtypeId,
        conceptIds: event.conceptIds,
        metadata: event.metadata,
      },
    }),
  });
  
  if (!response.success || !response.data) {
    // Fallback to local update
    return applyEventToLocalProfile(learnerId, event);
  }

  const profile = convertToFrontendProfile(response.data);
  setCachedProfile(learnerId, profile, true);
  
  return profile;
}

/**
 * Batch update profile from multiple events
 */
export async function batchUpdateProfile(
  learnerId: string,
  events: InteractionEvent[]
): Promise<LearnerProfile | null> {
  if (events.length === 0) {
    return getProfile(learnerId);
  }
  
  // Add all to pending updates
  events.forEach(event => addPendingUpdate(learnerId, event));
  
  if (!USE_BACKEND) {
    // Apply updates locally
    let profile = getCachedProfile(learnerId)?.profile || null;
    for (const event of events) {
      profile = await applyEventToLocalProfile(learnerId, event, profile);
    }
    return profile;
  }

  const response = await fetchApi<BackendLearnerProfile>(`/learners/${learnerId}/profile/events/batch`, {
    method: 'POST',
    body: JSON.stringify({
      events: events.map(event => ({
        learnerId: event.learnerId,
        sessionId: event.sessionId,
        timestamp: new Date(event.timestamp).toISOString(),
        eventType: event.eventType,
        problemId: event.problemId,
        successful: event.successful,
        errorSubtypeId: event.errorSubtypeId,
        conceptIds: event.conceptIds,
        metadata: event.metadata,
      })),
    }),
  });
  
  if (!response.success || !response.data) {
    // Fallback to local updates
    let profile = getCachedProfile(learnerId)?.profile || null;
    for (const event of events) {
      profile = await applyEventToLocalProfile(learnerId, event, profile);
    }
    return profile;
  }

  const profile = convertToFrontendProfile(response.data);
  setCachedProfile(learnerId, profile, true);
  clearPendingUpdates(learnerId);
  
  return profile;
}

/**
 * Apply an event to the local cached profile
 * Used for offline mode and optimistic updates
 */
async function applyEventToLocalProfile(
  learnerId: string,
  event: InteractionEvent,
  existingProfile?: LearnerProfile | null
): Promise<LearnerProfile | null> {
  const cached = existingProfile || getCachedProfile(learnerId)?.profile;
  
  let profile: LearnerProfile;
  
  if (!cached) {
    // Create default profile
    profile = {
      id: learnerId,
      name: 'Unknown',
      conceptsCovered: new Set(),
      conceptCoverageEvidence: new Map(),
      errorHistory: new Map(),
      solvedProblemIds: new Set(),
      interactionCount: 0,
      currentStrategy: 'adaptive-medium',
      preferences: {
        escalationThreshold: 2,
        aggregationDelay: 300000,
      },
      createdAt: Date.now(),
      lastActive: Date.now(),
    };
  } else {
    profile = { ...cached };
  }
  
  // Update interaction count and last active
  profile.interactionCount++;
  profile.lastActive = Date.now();

  if (event.eventType === 'execution' && event.successful && event.problemId) {
    profile.solvedProblemIds.add(event.problemId);
  }
  
  // Update error history
  if (event.eventType === 'error' && event.errorSubtypeId) {
    const currentCount = profile.errorHistory.get(event.errorSubtypeId) || 0;
    profile.errorHistory.set(event.errorSubtypeId, currentCount + 1);
  }
  
  // Update concept coverage evidence
  if (event.conceptIds && event.conceptIds.length > 0) {
    for (const conceptId of event.conceptIds) {
      if (!profile.conceptsCovered.has(conceptId)) {
        profile.conceptsCovered.add(conceptId);
      }
      
      let evidence = profile.conceptCoverageEvidence.get(conceptId);
      if (!evidence) {
        evidence = {
          conceptId,
          score: 50,
          confidence: 'low',
          lastUpdated: Date.now(),
          evidenceCounts: {
            successfulExecution: 0,
            hintViewed: 0,
            explanationViewed: 0,
            errorEncountered: 0,
            notesAdded: 0,
          },
          streakCorrect: 0,
          streakIncorrect: 0,
        };
        profile.conceptCoverageEvidence.set(conceptId, evidence);
      }
      
      evidence.lastUpdated = Date.now();
      
      switch (event.eventType) {
        case 'execution':
          if (event.successful) {
            evidence.evidenceCounts.successfulExecution++;
            evidence.streakCorrect++;
            evidence.streakIncorrect = 0;
            evidence.score = Math.min(100, evidence.score + 5);
          }
          break;
        case 'error':
          evidence.evidenceCounts.errorEncountered++;
          evidence.streakIncorrect++;
          evidence.streakCorrect = 0;
          evidence.score = Math.max(0, evidence.score - 5);
          break;
        case 'hint_view':
          evidence.evidenceCounts.hintViewed++;
          break;
        case 'explanation_view':
          evidence.evidenceCounts.explanationViewed++;
          break;
        case 'textbook_unit_upsert':
          evidence.evidenceCounts.notesAdded++;
          break;
      }
      
      const totalEvidence = 
        evidence.evidenceCounts.successfulExecution +
        evidence.evidenceCounts.hintViewed +
        evidence.evidenceCounts.explanationViewed +
        evidence.evidenceCounts.errorEncountered +
        evidence.evidenceCounts.notesAdded;
      
      if (totalEvidence >= 10) {
        evidence.confidence = 'high';
      } else if (totalEvidence >= 5) {
        evidence.confidence = 'medium';
      } else {
        evidence.confidence = 'low';
      }
    }
  }
  
  setCachedProfile(learnerId, profile, false);
  return profile;
}

// ============================================================================
// Sync Management
// ============================================================================

/**
 * Sync pending updates with the backend
 * Call this when coming back online or periodically
 */
export async function syncPendingUpdates(learnerId: string): Promise<boolean> {
  const cache = getCache();
  const cached = cache[learnerId];
  
  if (!cached || cached.pendingUpdates.length === 0) {
    return true;
  }
  
  if (!USE_BACKEND) {
    return false;
  }
  
  console.log(`[ProfileClient] Syncing ${cached.pendingUpdates.length} pending updates for ${learnerId}`);
  
  const response = await fetchApi<BackendLearnerProfile>(`/learners/${learnerId}/profile/events/batch`, {
    method: 'POST',
    body: JSON.stringify({
      events: cached.pendingUpdates.map(event => ({
        learnerId: event.learnerId,
        sessionId: event.sessionId,
        timestamp: new Date(event.timestamp).toISOString(),
        eventType: event.eventType,
        problemId: event.problemId,
        errorSubtypeId: event.errorSubtypeId,
        conceptIds: event.conceptIds,
        metadata: event.metadata,
      })),
    }),
  });
  
  if (response.success) {
    clearPendingUpdates(learnerId);
    if (response.data) {
      const profile = convertToFrontendProfile(response.data);
      setCachedProfile(learnerId, profile, true);
    }
    return true;
  }
  
  return false;
}

/**
 * Sync all pending updates across all learners
 */
export async function syncAllPendingUpdates(): Promise<Record<string, boolean>> {
  const cache = getCache();
  const results: Record<string, boolean> = {};
  
  for (const learnerId of Object.keys(cache)) {
    results[learnerId] = await syncPendingUpdates(learnerId);
  }
  
  return results;
}

/**
 * Check if there are pending updates for a learner
 */
export function hasPendingUpdates(learnerId: string): boolean {
  const cache = getCache();
  return cache[learnerId]?.pendingUpdates.length > 0;
}

/**
 * Get the count of pending updates
 */
export function getPendingUpdateCount(learnerId: string): number {
  const cache = getCache();
  return cache[learnerId]?.pendingUpdates.length || 0;
}

/**
 * Start automatic sync interval
 * Returns a function to stop the sync
 */
export function startAutoSync(learnerId: string): () => void {
  const intervalId = setInterval(() => {
    if (hasPendingUpdates(learnerId)) {
      syncPendingUpdates(learnerId).catch(error => {
        console.error('[ProfileClient] Auto-sync failed:', error);
      });
    }
  }, SYNC_INTERVAL);
  
  return () => clearInterval(intervalId);
}

/**
 * Clear the profile cache
 */
export function clearCache(): void {
  localStorage.removeItem(CACHE_KEY);
}

/**
 * Check if backend is available
 */
export function isBackendAvailable(): boolean {
  return USE_BACKEND;
}

/**
 * Check backend health
 */
export async function checkBackendHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${API_URL.replace('/api', '')}/health`, {
      method: 'GET',
      signal: AbortSignal.timeout(5000),
    });
    return response.ok;
  } catch {
    return false;
  }
}

// ============================================================================
// Export
// ============================================================================

export const learnerProfileClient = {
  // Profile operations
  getProfile,
  saveProfile,
  getAllProfiles,
  
  // Event-driven updates
  updateProfileFromEvent,
  batchUpdateProfile,
  
  // Sync management
  syncPendingUpdates,
  syncAllPendingUpdates,
  hasPendingUpdates,
  getPendingUpdateCount,
  startAutoSync,
  clearCache,
  
  // Utilities
  isBackendAvailable,
  checkBackendHealth,
};

export default learnerProfileClient;
