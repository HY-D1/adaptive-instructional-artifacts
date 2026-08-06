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
import { getApiBaseUrl } from '../runtime-config';
import {
  getActiveSyncPrincipal,
  isActiveSyncPrincipal,
  resolveEnvelopeOwnershipForActivePrincipal,
} from '../storage/sync-owner';

// API Configuration
// VITE_API_BASE_URL is the canonical env var (e.g. https://my-api.vercel.app — no trailing /api)
// getApiBaseUrl() resolves the same-origin sentinel to '' (relative paths).
const _API_BASE = getApiBaseUrl();
const API_URL = _API_BASE !== undefined ? `${_API_BASE}/api` : 'http://localhost:3001/api';
const USE_BACKEND = _API_BASE !== undefined;

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

interface SerializedLearnerProfile extends Omit<
  LearnerProfile,
  'conceptsCovered' | 'conceptCoverageEvidence' | 'errorHistory' | 'solvedProblemIds'
> {
  conceptsCovered: string[] | Set<string>;
  conceptCoverageEvidence:
    | Array<[string, ConceptCoverageEvidence]>
    | Record<string, ConceptCoverageEvidence>
    | Map<string, ConceptCoverageEvidence>;
  errorHistory: Array<[string, number]> | Record<string, number> | Map<string, number>;
  solvedProblemIds: string[] | Set<string>;
}

interface CachedProfile {
  profile: SerializedLearnerProfile;
  timestamp: number;
  synced: boolean;
  pendingUpdates: InteractionEvent[];
  syncOwnerId?: string;
}

type ProfileCache = Record<string, unknown>;

interface ProfileCacheRead {
  cache: ProfileCache;
  validRoot: boolean;
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

function readCache(): ProfileCacheRead {
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (cached === null) return { cache: {}, validRoot: true };
    const parsed: unknown = JSON.parse(cached);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? { cache: parsed as ProfileCache, validRoot: true }
      : { cache: {}, validRoot: false };
  } catch {
    return { cache: {}, validRoot: false };
  }
}

function getCache(): ProfileCache {
  return readCache().cache;
}

function setCache(
  cache: ProfileCache,
  _options: { claimWrite?: boolean } = {},
): ReturnType<typeof safeSet> {
  if (!readCache().validRoot) {
    return { success: false, error: 'Profile cache root is malformed' };
  }
  let result: ReturnType<typeof safeSet>;
  try {
    result = safeSet(CACHE_KEY, cache, { priority: 'critical', allowEviction: false });
  } catch (error) {
    result = {
      success: false,
      error: error instanceof Error ? error.message : 'Profile cache write failed',
    };
  }
  if (!result.success) {
    console.warn('[ProfileClient] Failed to save cache:', result.error);
  }
  if (!result.success) return result;
  try {
    if (localStorage.getItem(CACHE_KEY) !== JSON.stringify(cache)) {
      return { success: false, error: 'Profile cache write could not be verified' };
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Profile cache verification failed',
    };
  }
  return result;
}

function stringValues(value: unknown): string[] | null {
  const source = value instanceof Set ? Array.from(value) : value;
  if (!Array.isArray(source) || !source.every((item): item is string => typeof item === 'string')) {
    return null;
  }
  return new Set(source).size === source.length ? source : null;
}

function isConceptCoverageEvidence(value: unknown): value is ConceptCoverageEvidence {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const evidence = value as Partial<ConceptCoverageEvidence>;
  const counts = evidence.evidenceCounts as Partial<ConceptCoverageEvidence['evidenceCounts']> | undefined;
  return (
    typeof evidence.conceptId === 'string' && evidence.conceptId.length > 0 &&
    typeof evidence.score === 'number' && Number.isFinite(evidence.score) &&
    evidence.score >= 0 && evidence.score <= 100 &&
    ['low', 'medium', 'high'].includes(String(evidence.confidence)) &&
    typeof evidence.lastUpdated === 'number' && Number.isFinite(evidence.lastUpdated) &&
    Boolean(counts && typeof counts === 'object' && !Array.isArray(counts)) &&
    typeof counts?.successfulExecution === 'number' && Number.isInteger(counts.successfulExecution) && counts.successfulExecution >= 0 &&
    typeof counts.hintViewed === 'number' && Number.isInteger(counts.hintViewed) && counts.hintViewed >= 0 &&
    typeof counts.explanationViewed === 'number' && Number.isInteger(counts.explanationViewed) && counts.explanationViewed >= 0 &&
    typeof counts.errorEncountered === 'number' && Number.isInteger(counts.errorEncountered) && counts.errorEncountered >= 0 &&
    typeof counts.notesAdded === 'number' && Number.isInteger(counts.notesAdded) && counts.notesAdded >= 0 &&
    typeof evidence.streakCorrect === 'number' && Number.isInteger(evidence.streakCorrect) && evidence.streakCorrect >= 0 &&
    typeof evidence.streakIncorrect === 'number' && Number.isInteger(evidence.streakIncorrect) && evidence.streakIncorrect >= 0
  );
}

function rawMapEntries(value: unknown): unknown[] | null {
  if (value instanceof Map) return Array.from(value.entries());
  if (Array.isArray(value)) return value;
  if (value && typeof value === 'object') return Object.entries(value);
  return null;
}

function serializeProfile(profile: LearnerProfile): SerializedLearnerProfile {
  return {
    ...profile,
    conceptsCovered: Array.from(profile.conceptsCovered),
    conceptCoverageEvidence: Array.from(profile.conceptCoverageEvidence.entries()),
    errorHistory: Array.from(profile.errorHistory.entries()),
    solvedProblemIds: Array.from(profile.solvedProblemIds),
  };
}

function deserializeProfile(value: unknown): LearnerProfile | null {
  if (!value || typeof value !== 'object') return null;
  const profile = value as Partial<SerializedLearnerProfile>;
  if (
    typeof profile.id !== 'string' || profile.id.length === 0 || typeof profile.name !== 'string' ||
    typeof profile.interactionCount !== 'number' || !Number.isInteger(profile.interactionCount) || profile.interactionCount < 0 ||
    !['hint-only', 'adaptive-low', 'adaptive-medium', 'adaptive-high'].includes(String(profile.currentStrategy)) ||
    !profile.preferences || typeof profile.preferences !== 'object' || Array.isArray(profile.preferences) ||
    typeof profile.preferences.escalationThreshold !== 'number' || !Number.isFinite(profile.preferences.escalationThreshold) ||
    typeof profile.preferences.aggregationDelay !== 'number' || !Number.isFinite(profile.preferences.aggregationDelay) ||
    (profile.createdAt !== undefined && (typeof profile.createdAt !== 'number' || !Number.isFinite(profile.createdAt))) ||
    (profile.lastActive !== undefined && (typeof profile.lastActive !== 'number' || !Number.isFinite(profile.lastActive)))
  ) {
    return null;
  }

  const rawEvidenceEntries = rawMapEntries(profile.conceptCoverageEvidence);
  if (!rawEvidenceEntries) return null;
  const evidenceEntries: Array<[string, ConceptCoverageEvidence]> = [];
  const evidenceKeys = new Set<string>();
  for (const entry of rawEvidenceEntries) {
    if (
      !Array.isArray(entry) || entry.length !== 2 ||
      typeof entry[0] !== 'string' || !isConceptCoverageEvidence(entry[1]) ||
      entry[0] !== entry[1].conceptId || evidenceKeys.has(entry[0])
    ) {
      return null;
    }
    evidenceKeys.add(entry[0]);
    evidenceEntries.push([entry[0], entry[1]]);
  }
  const rawErrorEntries = rawMapEntries(profile.errorHistory);
  if (!rawErrorEntries) return null;
  const errorEntries: Array<[string, number]> = [];
  const errorKeys = new Set<string>();
  for (const entry of rawErrorEntries) {
    if (
      !Array.isArray(entry) || entry.length !== 2 || typeof entry[0] !== 'string' ||
      typeof entry[1] !== 'number' || !Number.isInteger(entry[1]) || entry[1] < 0 ||
      errorKeys.has(entry[0])
    ) {
      return null;
    }
    errorKeys.add(entry[0]);
    errorEntries.push([entry[0], entry[1]]);
  }
  const conceptsCovered = stringValues(profile.conceptsCovered);
  const solvedProblemIds = stringValues(profile.solvedProblemIds);
  if (!conceptsCovered || !solvedProblemIds) return null;

  return {
    ...(profile as LearnerProfile),
    conceptsCovered: new Set(conceptsCovered),
    conceptCoverageEvidence: new Map(evidenceEntries),
    errorHistory: new Map(errorEntries),
    solvedProblemIds: new Set(solvedProblemIds),
  };
}

function isValidPendingUpdate(value: unknown): value is InteractionEvent {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const event = value as Partial<InteractionEvent>;
  return (
    typeof event.id === 'string' &&
    typeof event.learnerId === 'string' &&
    typeof event.sessionId === 'string' &&
    typeof event.timestamp === 'number' &&
    Number.isFinite(event.timestamp) &&
    typeof event.eventType === 'string'
  );
}

function parseCachedProfile(value: unknown): CachedProfile | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const cached = value as Partial<CachedProfile>;
  const profile = deserializeProfile(cached.profile);
  if (
    !profile ||
    typeof cached.timestamp !== 'number' ||
    !Number.isFinite(cached.timestamp) ||
    typeof cached.synced !== 'boolean' ||
    !Array.isArray(cached.pendingUpdates) ||
    !cached.pendingUpdates.every((event) =>
      isValidPendingUpdate(event) && event.learnerId === profile.id,
    )
  ) {
    return null;
  }
  return cached as CachedProfile;
}

function cacheIdentity(learnerId: string, syncOwnerId?: string): string {
  return `${syncOwnerId ?? 'unowned'}\u0000${learnerId}`;
}

function findCacheEntries(
  cache: ProfileCache,
  learnerId: string,
  syncOwnerId: string | undefined,
): Array<[string, CachedProfile]> {
  const matches: Array<[string, CachedProfile]> = [];
  for (const [key, value] of Object.entries(cache)) {
    const entry = parseCachedProfile(value);
    if (
      entry &&
      deserializeProfile(entry.profile)?.id === learnerId &&
      entry.syncOwnerId === syncOwnerId
    ) {
      matches.push([key, entry]);
    }
  }
  return matches;
}

function findCacheEntry(
  cache: ProfileCache,
  learnerId: string,
  syncOwnerId: string | undefined,
): [string, CachedProfile] | null {
  const matches = findCacheEntries(cache, learnerId, syncOwnerId);
  return matches.length === 1 ? matches[0] : null;
}

function hasPotentialInvalidCacheEntry(
  cache: ProfileCache,
  learnerId: string,
  syncOwnerId: string | undefined,
): boolean {
  const ownedExactKey = cacheIdentity(learnerId, syncOwnerId);
  for (const [key, value] of Object.entries(cache)) {
    if (parseCachedProfile(value)) continue;
    if (key === ownedExactKey) return true;
    if (!value || typeof value !== 'object' || Array.isArray(value)) continue;
    const envelope = value as Record<string, unknown>;
    const hasOwner = Object.prototype.hasOwnProperty.call(envelope, 'syncOwnerId');
    if (hasOwner && envelope.syncOwnerId !== syncOwnerId) continue;
    const profile = envelope.profile;
    const profileMatches = Boolean(
      profile && typeof profile === 'object' && !Array.isArray(profile) &&
      (profile as Record<string, unknown>).id === learnerId,
    );
    if (!profileMatches && key !== learnerId) continue;
    if (hasOwner) return true;
    if (syncOwnerId === undefined || getActiveSyncPrincipal()?.learnerId === learnerId) {
      return true;
    }
  }
  return false;
}

type EligibleCacheEntry = [string, CachedProfile, LearnerProfile];

interface EligibleCacheSelection {
  entries: EligibleCacheEntry[];
  claimPersisted: boolean;
  ambiguousIdentities: Set<string>;
}

function eligibleCacheEntries(cache: ProfileCache): EligibleCacheSelection {
  const principal = getActiveSyncPrincipal();
  const entries: EligibleCacheEntry[] = [];
  const claimedEntries: EligibleCacheEntry[] = [];

  for (const [key, value] of Object.entries(cache)) {
    const cached = parseCachedProfile(value);
    if (!cached) continue;
    const profile = deserializeProfile(cached.profile);
    if (!profile) continue;

    if (!USE_BACKEND && !principal) {
      if (!Object.prototype.hasOwnProperty.call(cached, 'syncOwnerId')) {
        entries.push([key, cached, profile]);
      }
      continue;
    }

    const ownership = resolveEnvelopeOwnershipForActivePrincipal(cached, profile.id);
    if (ownership.eligible) {
      entries.push([key, cached, profile]);
    } else if (ownership.claimOwnerId) {
      const claimed = { ...cached, syncOwnerId: ownership.claimOwnerId };
      claimedEntries.push([key, claimed, profile]);
    }
  }

  const identityCounts = new Map<string, number>();
  for (const [, cached, profile] of [...entries, ...claimedEntries]) {
    const identity = cacheIdentity(profile.id, cached.syncOwnerId);
    identityCounts.set(identity, (identityCounts.get(identity) ?? 0) + 1);
  }
  const ambiguousIdentities = new Set(
    Array.from(identityCounts.entries())
      .filter(([, count]) => count > 1)
      .map(([identity]) => identity),
  );
  const uniqueEntries = entries.filter(([, cached, profile]) =>
    !ambiguousIdentities.has(cacheIdentity(profile.id, cached.syncOwnerId)),
  );
  const uniqueClaimedEntries = claimedEntries.filter(([, cached, profile]) =>
    !ambiguousIdentities.has(cacheIdentity(profile.id, cached.syncOwnerId)),
  );

  if (uniqueClaimedEntries.length > 0) {
    const stagedCache: ProfileCache = { ...cache };
    for (const [key, claimed] of uniqueClaimedEntries) {
      stagedCache[key] = claimed;
    }
    const claimPersisted = setCache(stagedCache, { claimWrite: true }).success;
    if (claimPersisted) {
      uniqueEntries.push(...uniqueClaimedEntries);
    }
    return { entries: uniqueEntries, claimPersisted, ambiguousIdentities };
  }
  return { entries: uniqueEntries, claimPersisted: true, ambiguousIdentities };
}

function latestEligibleCacheSelection(learnerId: string): {
  entry?: EligibleCacheEntry;
  claimPersisted: boolean;
  ambiguous: boolean;
  invalidCollision: boolean;
  invalidRoot: boolean;
} {
  const cacheRead = readCache();
  const cache = cacheRead.cache;
  const selection = eligibleCacheEntries(cache);
  const principal = getActiveSyncPrincipal();
  const identity = cacheIdentity(learnerId, principal?.syncOwnerId);
  return {
    entry: selection.entries
      .filter(([, , profile]) => profile.id === learnerId)
      .sort((a, b) => b[1].timestamp - a[1].timestamp)[0],
    claimPersisted: selection.claimPersisted,
    ambiguous: selection.ambiguousIdentities.has(identity),
    invalidCollision: hasPotentialInvalidCacheEntry(cache, learnerId, principal?.syncOwnerId),
    invalidRoot: !cacheRead.validRoot,
  };
}

function latestEligibleCacheEntry(
  learnerId: string,
): [string, CachedProfile, LearnerProfile] | undefined {
  return latestEligibleCacheSelection(learnerId).entry;
}

function getCachedProfile(learnerId: string): (CachedProfile & { profile: LearnerProfile; cacheKey: string }) | null {
  const selected = latestEligibleCacheEntry(learnerId);
  if (!selected || Date.now() - selected[1].timestamp > CACHE_TTL) return null;
  return { ...selected[1], profile: selected[2], cacheKey: selected[0] };
}

function setCachedProfile(
  learnerId: string,
  profile: LearnerProfile,
  synced: boolean = true,
  pendingUpdates?: InteractionEvent[],
  syncOwnerId = getActiveSyncPrincipal()?.syncOwnerId,
): boolean {
  const cacheRead = readCache();
  if (!cacheRead.validRoot) return false;
  const cache = cacheRead.cache;
  const existingMatches = findCacheEntries(cache, learnerId, syncOwnerId);
  if (existingMatches.length > 1) return false;
  const existing = existingMatches[0] ?? null;
  if (!existing && hasPotentialInvalidCacheEntry(cache, learnerId, syncOwnerId)) {
    return false;
  }
  const key = existing?.[0] ?? cacheIdentity(learnerId, syncOwnerId);
  cache[key] = {
    profile: serializeProfile(profile),
    timestamp: Date.now(),
    synced,
    pendingUpdates: pendingUpdates ?? existing?.[1].pendingUpdates ?? [],
    ...(syncOwnerId ? { syncOwnerId } : {}),
  };
  return setCache(cache).success;
}

function createLocalProfile(learnerId: string): LearnerProfile {
  return {
    id: learnerId,
    name: 'Unknown',
    conceptsCovered: new Set(),
    conceptCoverageEvidence: new Map(),
    errorHistory: new Map(),
    solvedProblemIds: new Set(),
    interactionCount: 0,
    currentStrategy: 'adaptive-medium',
    preferences: { escalationThreshold: 2, aggregationDelay: 300000 },
    createdAt: Date.now(),
    lastActive: Date.now(),
  };
}

function addPendingUpdate(learnerId: string, event: InteractionEvent): boolean {
  const selection = latestEligibleCacheSelection(learnerId);
  if (
    selection.invalidRoot ||
    !selection.claimPersisted ||
    selection.ambiguous ||
    selection.invalidCollision
  ) return false;
  const selected = selection.entry;
  const existing = selected
    ? { ...selected[1], profile: selected[2], cacheKey: selected[0] }
    : null;
  if (!existing) {
    return setCachedProfile(learnerId, createLocalProfile(learnerId), false, [event]);
  }
  const cache = getCache();
  const cached = cache[existing.cacheKey];
  if (!parseCachedProfile(cached)) return false;
  const validCached = cached as CachedProfile;
  validCached.pendingUpdates = [...validCached.pendingUpdates, event];
  validCached.synced = false;
  return setCache(cache).success;
}

function clearPendingUpdates(
  learnerId: string,
  syncOwnerId = getActiveSyncPrincipal()?.syncOwnerId,
): boolean {
  const cacheRead = readCache();
  if (!cacheRead.validRoot) return false;
  const cache = cacheRead.cache;
  const existing = findCacheEntry(cache, learnerId, syncOwnerId);
  if (existing) {
    cache[existing[0]] = {
      ...existing[1],
      pendingUpdates: [],
      synced: true,
    };
    return setCache(cache).success;
  }
  return false;
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

  const principal = getActiveSyncPrincipal();
  if (!principal) {
    return getCachedProfile(learnerId)?.profile ?? null;
  }

  const response = await fetchApi<BackendLearnerProfile>(`/learners/${learnerId}/profile`);
  if (!isActiveSyncPrincipal(principal)) {
    return null;
  }
  
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
  setCachedProfile(learnerId, profile, true, [], principal.syncOwnerId);
  
  return profile;
}

/**
 * Save a learner's full profile
 */
export async function saveProfile(profile: LearnerProfile): Promise<boolean> {
  const principal = getActiveSyncPrincipal();
  // Always update cache
  if (!setCachedProfile(profile.id, profile, false, undefined, principal?.syncOwnerId)) {
    return false;
  }
  
  if (!USE_BACKEND) {
    return true;
  }

  if (!principal) {
    return true;
  }

  const response = await fetchApi<BackendLearnerProfile>(`/learners/${profile.id}/profile`, {
    method: 'PUT',
    body: JSON.stringify(convertToBackendProfile(profile)),
  });
  if (!isActiveSyncPrincipal(principal)) {
    return false;
  }
  
  if (response.success) {
    return setCachedProfile(profile.id, profile, true, [], principal.syncOwnerId);
  }

  return false;
}

/**
 * Get all learner profiles (for instructor dashboard)
 */
export async function getAllProfiles(): Promise<LearnerProfile[]> {
  if (!USE_BACKEND) {
    return eligibleCacheEntries(getCache()).entries.map(([, , profile]) => profile);
  }

  const principal = getActiveSyncPrincipal();
  if (!principal) {
    return [];
  }

  const response = await fetchApi<BackendLearnerProfile[]>('/learners/profiles');
  if (!isActiveSyncPrincipal(principal)) {
    return [];
  }
  
  if (!response.success || !response.data) {
    // Fallback to cache
    return eligibleCacheEntries(getCache()).entries.map(([, , profile]) => profile);
  }

  const profiles = response.data.map(convertToFrontendProfile);
  
  // Update cache for all profiles
  profiles.forEach(profile => {
    setCachedProfile(profile.id, profile, true, [], principal.syncOwnerId);
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
  if (!addPendingUpdate(learnerId, event)) {
    return null;
  }
  const principal = getActiveSyncPrincipal();
  
  if (!USE_BACKEND || !principal) {
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
  if (!isActiveSyncPrincipal(principal)) {
    return null;
  }
  
  if (!response.success || !response.data) {
    // Fallback to local update
    return applyEventToLocalProfile(learnerId, event);
  }

  const profile = convertToFrontendProfile(response.data);
  return setCachedProfile(learnerId, profile, true, [], principal.syncOwnerId)
    ? profile
    : null;
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
  if (!events.every((event) => addPendingUpdate(learnerId, event))) {
    return null;
  }
  const principal = getActiveSyncPrincipal();
  
  if (!USE_BACKEND || !principal) {
    // Apply updates locally
    let profile = latestEligibleCacheEntry(learnerId)?.[2] || null;
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
  if (!isActiveSyncPrincipal(principal)) {
    return null;
  }
  
  if (!response.success || !response.data) {
    // Fallback to local updates
    let profile = latestEligibleCacheEntry(learnerId)?.[2] || null;
    for (const event of events) {
      profile = await applyEventToLocalProfile(learnerId, event, profile);
      if (!isActiveSyncPrincipal(principal)) {
        return null;
      }
    }
    return profile;
  }

  const profile = convertToFrontendProfile(response.data);
  return setCachedProfile(learnerId, profile, true, [], principal.syncOwnerId)
    ? profile
    : null;
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
  const cached = existingProfile || latestEligibleCacheEntry(learnerId)?.[2];
  
  let profile: LearnerProfile;
  
  if (!cached) {
    profile = createLocalProfile(learnerId);
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
  
  return setCachedProfile(learnerId, profile, false) ? profile : null;
}

// ============================================================================
// Sync Management
// ============================================================================

/**
 * Sync pending updates with the backend
 * Call this when coming back online or periodically
 */
export async function syncPendingUpdates(learnerId: string): Promise<boolean> {
  const principal = getActiveSyncPrincipal();
  if (!principal || !USE_BACKEND) {
    return false;
  }

  const cacheRead = readCache();
  if (!cacheRead.validRoot) return false;
  const cache = cacheRead.cache;
  const selection = eligibleCacheEntries(cache);
  const identity = cacheIdentity(learnerId, principal.syncOwnerId);
  if (
    !selection.claimPersisted ||
    selection.ambiguousIdentities.has(identity) ||
    hasPotentialInvalidCacheEntry(cache, learnerId, principal.syncOwnerId)
  ) {
    return false;
  }
  const eligible = selection.entries
    .filter(([, , profile]) => profile.id === learnerId)
    .sort((a, b) => b[1].timestamp - a[1].timestamp)[0];
  if (!eligible) {
    return true;
  }

  const [, cached, profile] = eligible;
  if (cached.synced && cached.pendingUpdates.length === 0) {
    return true;
  }

  const response = cached.pendingUpdates.length === 0
    ? await fetchApi<BackendLearnerProfile>(`/learners/${learnerId}/profile`, {
        method: 'PUT',
        body: JSON.stringify(convertToBackendProfile(profile)),
      })
    : await fetchApi<BackendLearnerProfile>(`/learners/${learnerId}/profile/events/batch`, {
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
  if (!isActiveSyncPrincipal(principal)) {
    return false;
  }
  
  if (response.success) {
    if (response.data) {
      const profile = convertToFrontendProfile(response.data);
      return setCachedProfile(learnerId, profile, true, [], principal.syncOwnerId);
    }
    return clearPendingUpdates(learnerId, principal.syncOwnerId);
  }
  
  return false;
}

/**
 * Sync all pending updates across all learners
 */
export async function syncAllPendingUpdates(): Promise<Record<string, boolean>> {
  const results: Record<string, boolean> = {};
  const principal = getActiveSyncPrincipal();
  if (!principal) {
    return results;
  }
  const learnerIds = new Set(
    eligibleCacheEntries(getCache()).entries.map(([, , profile]) => profile.id),
  );

  for (const learnerId of learnerIds) {
    results[learnerId] = await syncPendingUpdates(learnerId);
    if (!isActiveSyncPrincipal(principal)) {
      break;
    }
  }
  
  return results;
}

/**
 * Check if there are pending updates for a learner
 */
export function hasPendingUpdates(learnerId: string): boolean {
  const selection = latestEligibleCacheSelection(learnerId);
  if (
    selection.invalidRoot ||
    !selection.claimPersisted ||
    selection.ambiguous ||
    selection.invalidCollision
  ) return true;
  const cached = selection.entry?.[1];
  return Boolean(cached && (!cached.synced || cached.pendingUpdates.length > 0));
}

/**
 * Get the count of pending updates
 */
export function getPendingUpdateCount(learnerId: string): number {
  const selection = latestEligibleCacheSelection(learnerId);
  if (
    selection.invalidRoot ||
    !selection.claimPersisted ||
    selection.ambiguous ||
    selection.invalidCollision
  ) return 1;
  return selection.entry?.[1].pendingUpdates.length ?? 0;
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
