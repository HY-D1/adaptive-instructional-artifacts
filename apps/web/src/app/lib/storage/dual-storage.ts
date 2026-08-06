/**
 * Dual-Mode Storage Adapter
 * Backend API is the PRIMARY source of truth
 * localStorage is used as offline cache and fallback only
 * 
 * Key behaviors:
 * - getUserProfile: Read local cache synchronously
 * - saveInteraction: Send to backend first, cache in localStorage, queue if offline
 * - All writes: Attempt backend first, fallback to localStorage + offline queue
 */

import { storage as localStorageManager } from './storage';
import {
  safeSet,
  safeGet,
  safeRemove,
  subscribeToStorageTelemetry,
  type SafeSetResult,
} from './safe-storage';
import {
  storageClient,
  isBackendAvailable,
  checkBackendHealth,
} from '../api/storage-client';
import { clearAllUiState, clearUiStateForActor } from '../ui-state';
import {
  getResearchRuntimeMode,
  isResearchSafe,
  isResearchUnsafe,
  RESEARCH_CONTRACT_VERSION,
} from '../runtime-config';
import type {
  UserProfile,
  InteractionEvent,
  InstructionalUnit,
  LearnerProfile,
  SaveTextbookUnitResult,
} from '@/app/types';
import type { CreateUnitInput } from './textbook-units';
import { createEventId } from '../utils/event-id';
import { getProblemRank } from '../problem-ranking';
import {
  canonicalizeSqlEngageSubtype,
  getDeterministicSqlEngageAnchor,
  getSqlEngagePolicyVersion,
} from '../../data/sql-engage';
import {
  getActiveSyncPrincipal,
  isActiveSyncPrincipal,
  resolveEnvelopeOwnershipForActivePrincipal,
  type ActiveSyncPrincipal,
} from './sync-owner';
export { getActiveSyncPrincipal, setActiveSyncPrincipal } from './sync-owner';

// Configuration
// VITE_API_BASE_URL is the canonical env var — presence alone enables backend mode
const USE_BACKEND = !!import.meta.env.VITE_API_BASE_URL;

// Offline queue configuration
const OFFLINE_QUEUE_KEY = 'sql-adapt-offline-queue';
const PENDING_SESSION_ENDS_KEY = 'sql-adapt-pending-session-ends';
const PENDING_CONFIRMED_KEY = 'sql-adapt-pending-confirmed';
const DEAD_LETTER_KEY = 'sql-adapt-dead-letter';

// RESEARCH-2: Durable write semantics
// No max queue size - use chunked storage instead of dropping
const CHUNK_SIZE = 100;
// No max retries - retry until backend confirms
const RETRY_INTERVAL_MS = 5000;
const BATCH_SIZE = 25;

// RESEARCH-1: Durable pending store for all interactions
const PENDING_INTERACTIONS_KEY = 'sql-adapt-pending-interactions';

// Event status for tracking durability
export type EventStatus = 'queued_locally' | 'sent_unverified' | 'backend_confirmed' | 'dead_letter';

// RESEARCH-1: Interaction status lifecycle for durable writes
export type InteractionStatus =
  | 'locally_persisted'      // Saved to localStorage, not yet sent
  | 'backend_pending'        // In flight, awaiting confirmation
  | 'backend_confirmed'      // Backend confirmed receipt
  | 'dead_letter';           // Irrecoverable, schema validation failed

interface StorageConfig {
  useBackend: boolean;
  fallbackToLocal: boolean;
}

interface QueuedItem {
  id: string;
  type: 'interaction' | 'textbookUnit' | 'profile' | 'session';
  data: unknown;
  retries: number;
  timestamp: number;
  status: EventStatus;
  lastAttempt?: number;
  errorCount: number;
  syncOwnerId?: string;
}

interface ConfirmedItem {
  id: string;
  confirmedAt: number;
  syncOwnerId?: string;
  eventFingerprint?: string;
  payloadFingerprint?: string;
}

interface DeadLetterItem {
  id: string;
  type: string;
  data: unknown;
  reason: string;
  timestamp: number;
  syncOwnerId?: string;
}

interface PendingSessionEnd {
  key: string;
  event: InteractionEvent;
  queuedAt: number;
  lastAttemptAt?: number;
  syncOwnerId?: string;
}

interface PendingSessionEndCollection {
  validRoot: boolean;
  pending: PendingSessionEnd[];
  unverified: unknown[];
}

export type CriticalWriteStatus = {
  backendConfirmed: boolean;
  pendingSync: boolean;
  error?: string;
};

export type StorageMode = 'local' | 'backend' | 'offline';

/** Research runtime mode for data durability */
export type ResearchMode = 'research-safe' | 'research-unsafe' | 'dev-demo';

/** Queue statistics for diagnostics */
export interface QueueStats {
  pendingCount: number;
  oldestUnconfirmedAgeMs: number | null;
  lastBackendAckTime: number | null;
  totalConfirmed: number;
  totalFailed: number;
}

// ============================================================================
// Offline Queue Manager
// ============================================================================

// ============================================================================
// Pending Interaction Entry - RESEARCH-1: Durable pending store
// ============================================================================

interface PendingInteraction {
  id: string;
  event: InteractionEvent;
  status: InteractionStatus;
  timestamp: number;        // When first saved locally
  lastAttempt?: number;     // When last sent to backend
  retryCount: number;       // Number of send attempts
  sessionId: string;
  eventType: string;
  syncOwnerId?: string;
}

interface PendingQueueCoordination {
  original: Map<string, PendingInteraction>;
  staged: Map<string, PendingInteraction>;
  changed: boolean;
}

type ConfirmationState = 'none' | 'confirmed' | 'blocked';

function ownerFields(principal = getActiveSyncPrincipal()): { syncOwnerId?: string } {
  return principal ? { syncOwnerId: principal.syncOwnerId } : {};
}

function ownedSyncIdentity(id: string, syncOwnerId?: string): string {
  return `${syncOwnerId ? `owner:${syncOwnerId}` : 'legacy'}\u0000${id}`;
}

function envelopeSyncIdentity(id: string, envelope: { syncOwnerId?: unknown }): string {
  if (!Object.prototype.hasOwnProperty.call(envelope, 'syncOwnerId')) {
    return ownedSyncIdentity(id);
  }
  if (typeof envelope.syncOwnerId === 'string' && envelope.syncOwnerId.length > 0) {
    return ownedSyncIdentity(id, envelope.syncOwnerId);
  }
  let serialized: string;
  try {
    serialized = JSON.stringify(envelope.syncOwnerId) ?? String(envelope.syncOwnerId);
  } catch {
    serialized = Object.prototype.toString.call(envelope.syncOwnerId);
  }
  return `malformed:${typeof envelope.syncOwnerId}:${serialized}\u0000${id}`;
}

function canonicalEventValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(canonicalEventValue);
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, nested]) => nested !== undefined)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, nested]) => [key, canonicalEventValue(nested)]),
    );
  }
  return value;
}

function normalizeInteractionForSyncIdentity(event: InteractionEvent): InteractionEvent {
  let normalized = { ...event };
  if (normalized.problemId && normalized.problemNumber === undefined) {
    const rank = getProblemRank(normalized.problemId);
    if (rank > 0) normalized = { ...normalized, problemNumber: rank };
  }
  if (normalized.eventType === 'concept_view') {
    const conceptId = normalized.conceptId || normalized.conceptIds?.[0];
    normalized = {
      ...normalized,
      conceptId,
      conceptIds: conceptId ? [conceptId] : normalized.conceptIds,
      source: normalized.source || (normalized.unitId ? 'textbook' : 'problem'),
    };
  }
  if (normalized.eventType === 'hint_view') {
    const canonicalSubtype = canonicalizeSqlEngageSubtype(
      normalized.sqlEngageSubtype || normalized.errorSubtypeId || 'incomplete query',
    );
    const hintLevel = normalized.hintLevel === 1 || normalized.hintLevel === 2 || normalized.hintLevel === 3
      ? normalized.hintLevel
      : typeof normalized.hintLevel === 'number' && Number.isFinite(normalized.hintLevel)
        ? normalized.hintLevel <= 1 ? 1 : normalized.hintLevel >= 3 ? 3 : 2
        : 1;
    const rowSeed = `${normalized.learnerId}|${normalized.problemId}|${canonicalSubtype}`;
    const fallbackAnchor = getDeterministicSqlEngageAnchor(canonicalSubtype, rowSeed);
    const sqlEngageRowId = normalized.sqlEngageRowId?.trim() || fallbackAnchor.rowId;
    normalized = {
      ...normalized,
      hintId: normalized.hintId?.trim() ||
        `sql-engage:${canonicalSubtype}:hint:${sqlEngageRowId}:L${hintLevel}`,
      hintLevel,
      hintText: normalized.hintText?.trim() || '[missing-hint-text]',
      templateId: normalized.templateId?.trim() || 'unverifiable',
      sqlEngageSubtype: canonicalSubtype,
      sqlEngageRowId,
      policyVersion: normalized.policyVersion?.trim() || getSqlEngagePolicyVersion(),
    };
  }
  return normalized;
}

function isExactInteractionEvent(left: InteractionEvent, right: InteractionEvent): boolean {
  return JSON.stringify(canonicalEventValue(normalizeInteractionForSyncIdentity(left))) ===
    JSON.stringify(canonicalEventValue(normalizeInteractionForSyncIdentity(right)));
}

function serializedFingerprint(value: unknown): string {
  const serialized = JSON.stringify(canonicalEventValue(value));
  let first = 0x811c9dc5;
  let second = 0x9e3779b9;
  for (let index = 0; index < serialized.length; index += 1) {
    const code = serialized.charCodeAt(index);
    first = Math.imul(first ^ code, 0x01000193);
    second = Math.imul(second ^ code, 0x85ebca6b);
  }
  return `${serialized.length}:${(first >>> 0).toString(16)}:${(second >>> 0).toString(16)}`;
}

function interactionEventFingerprint(event: InteractionEvent): string {
  return serializedFingerprint(normalizeInteractionForSyncIdentity(event));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function hasValidOptionalOwner(value: Record<string, unknown>): boolean {
  return !Object.prototype.hasOwnProperty.call(value, 'syncOwnerId') ||
    (typeof value.syncOwnerId === 'string' && value.syncOwnerId.length > 0);
}

function isStoredInteractionEvent(value: unknown): value is InteractionEvent {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === 'string' && value.id.length > 0 &&
    typeof value.learnerId === 'string' && value.learnerId.length > 0 &&
    typeof value.sessionId === 'string' && value.sessionId.length > 0 &&
    typeof value.timestamp === 'number' && Number.isFinite(value.timestamp) &&
    typeof value.eventType === 'string' && value.eventType.length > 0
  );
}

function isStoredPendingInteraction(value: unknown): value is PendingInteraction {
  if (!isRecord(value) || !hasValidOptionalOwner(value) || !isStoredInteractionEvent(value.event)) {
    return false;
  }
  return (
    typeof value.id === 'string' && value.id === value.event.id &&
    ['locally_persisted', 'backend_pending', 'backend_confirmed', 'dead_letter'].includes(String(value.status)) &&
    typeof value.timestamp === 'number' && Number.isFinite(value.timestamp) &&
    typeof value.retryCount === 'number' && Number.isFinite(value.retryCount) &&
    typeof value.sessionId === 'string' && value.sessionId === value.event.sessionId &&
    typeof value.eventType === 'string' && value.eventType === value.event.eventType &&
    (!Object.prototype.hasOwnProperty.call(value, 'lastAttempt') ||
      (typeof value.lastAttempt === 'number' && Number.isFinite(value.lastAttempt)))
  );
}

function isStoredPendingSessionEnd(value: unknown): value is PendingSessionEnd {
  if (!isRecord(value) || !hasValidOptionalOwner(value) || !isStoredInteractionEvent(value.event)) {
    return false;
  }
  return (
    typeof value.key === 'string' && value.key.length > 0 &&
    value.event.eventType === 'session_end' &&
    typeof value.queuedAt === 'number' && Number.isFinite(value.queuedAt) &&
    (!Object.prototype.hasOwnProperty.call(value, 'lastAttemptAt') ||
      (typeof value.lastAttemptAt === 'number' && Number.isFinite(value.lastAttemptAt)))
  );
}

function readPendingSessionEndCollection(): PendingSessionEndCollection {
  const stored = readStoredArray(PENDING_SESSION_ENDS_KEY);
  if (!stored.validRoot) {
    return { validRoot: false, pending: [], unverified: [] };
  }
  const pendingByIdentity = new Map<string, PendingSessionEnd>();
  const unverified: unknown[] = [];
  const ambiguous = new Set<string>();
  for (const record of stored.records) {
    if (!isStoredPendingSessionEnd(record)) {
      unverified.push(record);
      continue;
    }
    const identity = envelopeSyncIdentity(record.key, record);
    if (ambiguous.has(identity)) {
      unverified.push(record);
      continue;
    }
    const existing = pendingByIdentity.get(identity);
    if (existing) {
      pendingByIdentity.delete(identity);
      unverified.push(existing, record);
      ambiguous.add(identity);
      continue;
    }
    pendingByIdentity.set(identity, record);
  }
  return {
    validRoot: true,
    pending: [...pendingByIdentity.values()],
    unverified,
  };
}

function isStoredConfirmedItem(value: unknown): value is ConfirmedItem {
  if (!isRecord(value) || !hasValidOptionalOwner(value)) return false;
  return (
    typeof value.id === 'string' && value.id.length > 0 &&
    typeof value.confirmedAt === 'number' && Number.isFinite(value.confirmedAt) &&
    (!Object.prototype.hasOwnProperty.call(value, 'eventFingerprint') ||
      typeof value.eventFingerprint === 'string') &&
    (!Object.prototype.hasOwnProperty.call(value, 'payloadFingerprint') ||
      typeof value.payloadFingerprint === 'string')
  );
}

function readStoredArray(key: string): { validRoot: boolean; records: unknown[] } {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return { validRoot: true, records: [] };
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed)
      ? { validRoot: true, records: parsed }
      : { validRoot: false, records: [] };
  } catch {
    return { validRoot: false, records: [] };
  }
}

function interactionFromEnvelope(envelope: unknown): InteractionEvent | null {
  if (isStoredInteractionEvent(envelope)) return envelope;
  if (!isRecord(envelope)) return null;
  if (isStoredInteractionEvent(envelope.event)) return envelope.event;
  if (envelope.type === 'interaction' && isStoredInteractionEvent(envelope.data)) {
    return envelope.data;
  }
  return null;
}

function queuePayloadFingerprint(envelope: unknown): string | null {
  if (!isRecord(envelope) || typeof envelope.type !== 'string' ||
      !Object.prototype.hasOwnProperty.call(envelope, 'data')) {
    return null;
  }
  return serializedFingerprint({ type: envelope.type, data: envelope.data });
}

function queuedItemLearnerId(item: QueuedItem): string | undefined {
  switch (item.type) {
    case 'interaction':
      return (item.data as Partial<InteractionEvent> | null)?.learnerId;
    case 'textbookUnit':
    case 'session':
      return (item.data as { learnerId?: unknown } | null)?.learnerId as string | undefined;
    case 'profile':
      return (item.data as Partial<LearnerProfile> | null)?.id;
  }
}

function isUniqueStringArray(value: unknown): value is string[] {
  return Array.isArray(value) &&
    value.every((entry): entry is string => typeof entry === 'string') &&
    new Set(value).size === value.length;
}

function isStoredEvidenceValue(value: unknown, expectedConceptId: string): boolean {
  if (!isRecord(value) || value.conceptId !== expectedConceptId ||
      typeof value.score !== 'number' || !Number.isFinite(value.score) ||
      value.score < 0 || value.score > 100 ||
      !['low', 'medium', 'high'].includes(String(value.confidence)) ||
      typeof value.lastUpdated !== 'number' || !Number.isFinite(value.lastUpdated) ||
      !isRecord(value.evidenceCounts) ||
      typeof value.streakCorrect !== 'number' || !Number.isInteger(value.streakCorrect) || value.streakCorrect < 0 ||
      typeof value.streakIncorrect !== 'number' || !Number.isInteger(value.streakIncorrect) || value.streakIncorrect < 0) {
    return false;
  }
  return [
    value.evidenceCounts.successfulExecution,
    value.evidenceCounts.hintViewed,
    value.evidenceCounts.explanationViewed,
    value.evidenceCounts.errorEncountered,
    value.evidenceCounts.notesAdded,
  ].every((count) => typeof count === 'number' && Number.isInteger(count) && count >= 0);
}

function isStoredProfilePayload(value: Record<string, unknown>): boolean {
  if (
    typeof value.id !== 'string' || value.id.length === 0 ||
    typeof value.name !== 'string' ||
    typeof value.interactionCount !== 'number' || !Number.isInteger(value.interactionCount) || value.interactionCount < 0 ||
    !['hint-only', 'adaptive-low', 'adaptive-medium', 'adaptive-high'].includes(String(value.currentStrategy)) ||
    !isRecord(value.preferences) ||
    typeof value.preferences.escalationThreshold !== 'number' || !Number.isFinite(value.preferences.escalationThreshold) ||
    typeof value.preferences.aggregationDelay !== 'number' || !Number.isFinite(value.preferences.aggregationDelay) ||
    !isUniqueStringArray(value.conceptsCovered) ||
    !isUniqueStringArray(value.solvedProblemIds) ||
    !Array.isArray(value.conceptCoverageEvidence) ||
    !Array.isArray(value.errorHistory)
  ) {
    return false;
  }
  const evidenceKeys = new Set<string>();
  for (const entry of value.conceptCoverageEvidence) {
    if (!Array.isArray(entry) || entry.length !== 2 || typeof entry[0] !== 'string' ||
        evidenceKeys.has(entry[0]) || !isStoredEvidenceValue(entry[1], entry[0])) {
      return false;
    }
    evidenceKeys.add(entry[0]);
  }
  const errorKeys = new Set<string>();
  for (const entry of value.errorHistory) {
    if (!Array.isArray(entry) || entry.length !== 2 || typeof entry[0] !== 'string' ||
        errorKeys.has(entry[0]) || typeof entry[1] !== 'number' ||
        !Number.isInteger(entry[1]) || entry[1] < 0) {
      return false;
    }
    errorKeys.add(entry[0]);
  }
  return (
    (!Object.prototype.hasOwnProperty.call(value, 'createdAt') ||
      (typeof value.createdAt === 'number' && Number.isFinite(value.createdAt))) &&
    (!Object.prototype.hasOwnProperty.call(value, 'lastActive') ||
      (typeof value.lastActive === 'number' && Number.isFinite(value.lastActive)))
  );
}

function isStoredInstructionalUnit(value: unknown): boolean {
  if (!isRecord(value) ||
      typeof value.id !== 'string' || value.id.length === 0 ||
      !['hint', 'explanation', 'example', 'summary'].includes(String(value.type)) ||
      typeof value.conceptId !== 'string' || value.conceptId.length === 0 ||
      typeof value.title !== 'string' || typeof value.content !== 'string' ||
      !isUniqueStringArray(value.prerequisites) ||
      !isUniqueStringArray(value.sourceInteractionIds) ||
      typeof value.addedTimestamp !== 'number' || !Number.isFinite(value.addedTimestamp)) {
    return false;
  }
  if (Object.prototype.hasOwnProperty.call(value, 'contentFormat') &&
      value.contentFormat !== undefined &&
      !['markdown', 'html'].includes(String(value.contentFormat))) return false;
  if (Object.prototype.hasOwnProperty.call(value, 'conceptIds') &&
      value.conceptIds !== undefined &&
      !isUniqueStringArray(value.conceptIds)) return false;
  const optionalStringArrays = [
    'updatedSessionIds',
    'sourceInteractions',
    'commonMistakes',
    'sourceRefIds',
    'createdFromInteractionIds',
  ];
  return optionalStringArrays.every((key) =>
    !Object.prototype.hasOwnProperty.call(value, key) ||
    value[key] === undefined ||
    isUniqueStringArray(value[key]),
  );
}

function isStoredQueuedItem(value: unknown): value is QueuedItem {
  if (!isRecord(value) || !hasValidOptionalOwner(value)) return false;
  if (
    typeof value.id !== 'string' || value.id.length === 0 ||
    !['interaction', 'textbookUnit', 'profile', 'session'].includes(String(value.type)) ||
    typeof value.retries !== 'number' || !Number.isFinite(value.retries) ||
    typeof value.timestamp !== 'number' || !Number.isFinite(value.timestamp) ||
    !['queued_locally', 'sent_unverified', 'backend_confirmed'].includes(String(value.status)) ||
    typeof value.errorCount !== 'number' || !Number.isFinite(value.errorCount) ||
    (Object.prototype.hasOwnProperty.call(value, 'lastAttempt') &&
      (typeof value.lastAttempt !== 'number' || !Number.isFinite(value.lastAttempt)))
  ) {
    return false;
  }
  if (value.type === 'interaction') {
    return isStoredInteractionEvent(value.data) && value.data.id === value.id;
  }
  if (!isRecord(value.data)) return false;
  if (value.type === 'textbookUnit') {
    return (
      typeof value.data.learnerId === 'string' && value.data.learnerId.length > 0 &&
      isStoredInstructionalUnit(value.data.unit)
    );
  }
  if (value.type === 'session') {
    return (
      typeof value.data.learnerId === 'string' && value.data.learnerId.length > 0 &&
      isRecord(value.data.data) &&
      typeof value.data.data.startTime === 'string' && value.data.data.startTime.trim().length > 0 &&
      typeof value.data.data.lastActivity === 'string' && value.data.data.lastActivity.trim().length > 0
    );
  }
  return isStoredProfilePayload(value.data);
}

function isStoredDeadLetterItem(value: unknown): value is DeadLetterItem {
  if (!isRecord(value) || !hasValidOptionalOwner(value)) return false;
  return (
    typeof value.id === 'string' && value.id.length > 0 &&
    typeof value.type === 'string' && value.type.length > 0 &&
    typeof value.reason === 'string' &&
    typeof value.timestamp === 'number' && Number.isFinite(value.timestamp) &&
    Object.prototype.hasOwnProperty.call(value, 'data')
  );
}

function serializeQueuedProfile(profile: LearnerProfile): Record<string, unknown> {
  return {
    ...profile,
    conceptsCovered: Array.from(profile.conceptsCovered),
    conceptCoverageEvidence: Array.from(profile.conceptCoverageEvidence.entries()),
    errorHistory: Array.from(profile.errorHistory.entries()),
    solvedProblemIds: Array.from(profile.solvedProblemIds),
  };
}

// ============================================================================
// Durable Pending Store - RESEARCH-1: Tracks ALL unconfirmed interactions
// ============================================================================

class DurablePendingStore {
  private interactions: Map<string, PendingInteraction> = new Map();
  private confirmedItems: Map<string, ConfirmedItem> = new Map();
  private lastClaimPersistenceFailed = false;
  private unverifiedPendingRecords: unknown[] = [];
  private unverifiedConfirmedRecords: unknown[] = [];
  private pendingRootValid = true;
  private confirmedRootValid = true;

  constructor() {
    this.loadConfirmed();
    this.loadPending();
  }

  // Confirmed IDs management (for deduplication)
  private loadConfirmed(): void {
    const stored = readStoredArray(PENDING_CONFIRMED_KEY);
    this.confirmedRootValid = stored.validRoot;
    this.confirmedItems.clear();
    this.unverifiedConfirmedRecords = [];
    if (!stored.validRoot) return;

    const ambiguous = new Set<string>();
    for (const record of stored.records) {
      if (!isStoredConfirmedItem(record)) {
        this.unverifiedConfirmedRecords.push(record);
        continue;
      }
      const identity = envelopeSyncIdentity(record.id, record);
      if (ambiguous.has(identity)) {
        this.unverifiedConfirmedRecords.push(record);
        continue;
      }
      const existing = this.confirmedItems.get(identity);
      if (existing) {
        this.confirmedItems.delete(identity);
        this.unverifiedConfirmedRecords.push(existing, record);
        ambiguous.add(identity);
        continue;
      }
      this.confirmedItems.set(identity, record);
    }
  }

  private confirmedRecords(confirmedItems = this.confirmedItems): unknown[] {
    return [...this.unverifiedConfirmedRecords, ...confirmedItems.values()];
  }

  private saveConfirmed(confirmedItems = this.confirmedItems): SafeSetResult {
    if (!this.confirmedRootValid) {
      return { success: false, error: 'Confirmed storage root is malformed' };
    }
    try {
      return safeSet(
        PENDING_CONFIRMED_KEY,
        this.confirmedRecords(confirmedItems),
        { priority: 'critical', allowEviction: false },
      );
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Confirmed storage write failed' };
    }
  }

  private persistedConfirmedCollectionMatches(confirmedItems: Map<string, ConfirmedItem>): boolean {
    const stored = readStoredArray(PENDING_CONFIRMED_KEY);
    return stored.validRoot &&
      JSON.stringify(stored.records) === JSON.stringify(this.confirmedRecords(confirmedItems));
  }

  private confirmedForOwner(id: string, syncOwnerId: string): ConfirmedItem | undefined {
    return this.confirmedItems.get(ownedSyncIdentity(id, syncOwnerId));
  }

  private unverifiedRecordMayBelongToOwner(
    records: unknown[],
    id: string,
    syncOwnerId: string,
  ): boolean {
    return records.some((record) => {
      if (!isRecord(record) || record.id !== id) return false;
      if (!Object.prototype.hasOwnProperty.call(record, 'syncOwnerId')) return true;
      return record.syncOwnerId === syncOwnerId;
    });
  }

  isEnvelopeConfirmed(envelope: unknown): boolean {
    const targetOwnerId = isRecord(envelope) &&
      typeof envelope.syncOwnerId === 'string' && envelope.syncOwnerId.length > 0
      ? envelope.syncOwnerId
      : undefined;
    return this.getEnvelopeConfirmationState(envelope, targetOwnerId) === 'confirmed';
  }

  getEnvelopeConfirmationState(
    envelope: unknown,
    targetOwnerId?: string,
  ): ConfirmationState {
    if (!this.confirmedRootValid || !isRecord(envelope) || typeof envelope.id !== 'string') {
      return 'blocked';
    }
    const ownerEnvelope = targetOwnerId
      ? { ...envelope, syncOwnerId: targetOwnerId }
      : envelope;
    if (
      targetOwnerId &&
      this.unverifiedRecordMayBelongToOwner(
        this.unverifiedConfirmedRecords,
        envelope.id,
        targetOwnerId,
      )
    ) {
      return 'blocked';
    }
    const confirmed = this.confirmedItems.get(envelopeSyncIdentity(envelope.id, ownerEnvelope));
    if (!confirmed) return 'none';
    const event = interactionFromEnvelope(envelope);
    if (event) {
      return confirmed.eventFingerprint &&
        confirmed.eventFingerprint === interactionEventFingerprint(event)
        ? 'confirmed'
        : 'blocked';
    }
    const payloadFingerprint = queuePayloadFingerprint(envelope);
    return confirmed.payloadFingerprint &&
      payloadFingerprint &&
      confirmed.payloadFingerprint === payloadFingerprint
      ? 'confirmed'
      : 'blocked';
  }

  markConfirmed(id: string, syncOwnerId?: string, confirmedEnvelope?: unknown): boolean {
    return this.markConfirmedBatch(
      [id],
      syncOwnerId,
      confirmedEnvelope ? [confirmedEnvelope] : [],
    );
  }

  markConfirmedBatch(
    ids: string[],
    syncOwnerId?: string,
    confirmedEnvelopes: unknown[] = [],
  ): boolean {
    const envelopesById = new Map(
      confirmedEnvelopes
        .filter((envelope): envelope is Record<string, unknown> =>
          isRecord(envelope) && typeof envelope.id === 'string',
        )
        .map((envelope) => [envelope.id as string, envelope]),
    );
    const stagedConfirmed = new Map(this.confirmedItems);
    const stagedPending = new Map(this.interactions);
    for (const id of ids) {
      const identity = ownedSyncIdentity(id, syncOwnerId);
      const pending = stagedPending.get(identity);
      const existing = stagedConfirmed.get(identity);
      const confirmedEnvelope = envelopesById.get(id);
      const envelopeEvent = interactionFromEnvelope(confirmedEnvelope);
      const envelopePayloadFingerprint = queuePayloadFingerprint(confirmedEnvelope);
      if (
        pending && confirmedEnvelope &&
        ((!envelopeEvent && envelopePayloadFingerprint) ||
          (envelopeEvent && !isExactInteractionEvent(pending.event, envelopeEvent)))
      ) {
        return false;
      }
      const proofEvent = pending?.event ?? envelopeEvent;
      const proofFingerprint = proofEvent ? interactionEventFingerprint(proofEvent) : undefined;
      const payloadFingerprint = proofEvent ? undefined : envelopePayloadFingerprint;
      if (
        (syncOwnerId && this.unverifiedRecordMayBelongToOwner(
          this.unverifiedConfirmedRecords,
          id,
          syncOwnerId,
        )) ||
        (existing && proofFingerprint && existing.eventFingerprint !== proofFingerprint) ||
        (existing && payloadFingerprint && existing.payloadFingerprint !== payloadFingerprint)
      ) {
        return false;
      }
      stagedConfirmed.set(identity, {
        id,
        confirmedAt: Date.now(),
        ...(syncOwnerId ? { syncOwnerId } : {}),
        ...(proofFingerprint
          ? { eventFingerprint: proofFingerprint }
          : existing?.eventFingerprint
            ? { eventFingerprint: existing.eventFingerprint }
            : {}),
        ...(payloadFingerprint
          ? { payloadFingerprint }
          : existing?.payloadFingerprint
            ? { payloadFingerprint: existing.payloadFingerprint }
            : {}),
      });
      stagedPending.delete(identity);
    }
    const proofPersisted = this.saveConfirmed(stagedConfirmed).success &&
      this.persistedConfirmedCollectionMatches(stagedConfirmed);
    if (!proofPersisted) return false;
    this.confirmedItems = stagedConfirmed;

    if (this.pendingRootValid) {
      const pendingPersisted = this.savePending({ allowEviction: false }, stagedPending).success &&
        this.persistedPendingCollectionMatches(stagedPending);
      if (pendingPersisted) {
        this.interactions = stagedPending;
      }
    }
    return true;
  }

  // Pending interactions management
  private loadPending(): void {
    const stored = readStoredArray(PENDING_INTERACTIONS_KEY);
    this.pendingRootValid = stored.validRoot;
    this.interactions.clear();
    this.unverifiedPendingRecords = [];
    if (!stored.validRoot) return;

    const ambiguous = new Set<string>();
    for (const record of stored.records) {
      if (!isStoredPendingInteraction(record)) {
        this.unverifiedPendingRecords.push(record);
        continue;
      }
      if (this.isEnvelopeConfirmed(record)) {
        continue;
      }
      const identity = envelopeSyncIdentity(record.id, record);
      if (ambiguous.has(identity)) {
        this.unverifiedPendingRecords.push(record);
        continue;
      }
      const existing = this.interactions.get(identity);
      if (existing) {
        this.interactions.delete(identity);
        this.unverifiedPendingRecords.push(existing, record);
        ambiguous.add(identity);
        continue;
      }
      this.interactions.set(identity, record);
    }
  }

  private pendingRecords(interactions = this.interactions): unknown[] {
    return [...this.unverifiedPendingRecords, ...interactions.values()];
  }

  private savePending(
    _options: { allowEviction?: boolean } = {},
    interactions = this.interactions,
  ): SafeSetResult {
    if (!this.pendingRootValid) {
      return { success: false, error: 'Pending interaction storage root is malformed' };
    }
    try {
      return safeSet(PENDING_INTERACTIONS_KEY, this.pendingRecords(interactions), {
        priority: 'critical',
        allowEviction: false,
      });
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Pending storage write failed' };
    }
  }

  private persistedPendingCollectionMatches(interactions: Map<string, PendingInteraction>): boolean {
    const stored = readStoredArray(PENDING_INTERACTIONS_KEY);
    return stored.validRoot &&
      JSON.stringify(stored.records) === JSON.stringify(this.pendingRecords(interactions));
  }

  /**
   * Add a new interaction to the pending store
   * RESEARCH-1: Every interaction starts as 'backend_pending'
   */
  add(event: InteractionEvent): boolean {
    if (
      !this.pendingRootValid ||
      !this.confirmedRootValid ||
      !isStoredInteractionEvent(event)
    ) return false;
    const principal = getActiveSyncPrincipal();
    const identity = ownedSyncIdentity(event.id, principal?.syncOwnerId);
    const envelope = {
      id: event.id,
      ...(principal ? { syncOwnerId: principal.syncOwnerId } : {}),
      event,
    };
    const confirmationState = this.getEnvelopeConfirmationState(
      envelope,
      principal?.syncOwnerId,
    );
    if (confirmationState === 'confirmed') return true;
    if (confirmationState === 'blocked') return false;
    if (
      principal &&
      this.unverifiedRecordMayBelongToOwner(this.unverifiedPendingRecords, event.id, principal.syncOwnerId)
    ) return false;
    const existing = this.interactions.get(identity);
    if (existing) {
      return isExactInteractionEvent(existing.event, event);
    }

    const pending: PendingInteraction = {
      id: event.id,
      event,
      status: 'backend_pending',
      timestamp: Date.now(),
      retryCount: 0,
      sessionId: event.sessionId || 'unknown',
      eventType: event.eventType,
      ...ownerFields(principal),
    };

    const staged = new Map(this.interactions);
    staged.set(identity, pending);
    const persisted = this.savePending({ allowEviction: false }, staged).success &&
      this.persistedPendingCollectionMatches(staged);
    if (!persisted) return false;
    this.interactions = staged;

    if (import.meta.env.DEV) {
      console.info('[telemetry_interaction_pending]', {
        eventId: event.id,
        eventType: event.eventType,
        sessionId: event.sessionId,
      });
    }
    return true;
  }

  /**
   * Mark an interaction as sent (but not yet confirmed)
   */
  markSent(id: string, syncOwnerId?: string): boolean {
    const identity = ownedSyncIdentity(id, syncOwnerId);
    const item = this.interactions.get(identity);
    if (!item) return false;
    const staged = new Map(this.interactions);
    staged.set(identity, {
      ...item,
      status: 'backend_pending',
      lastAttempt: Date.now(),
      retryCount: item.retryCount + 1,
    });
    const persisted = this.savePending({ allowEviction: false }, staged).success &&
      this.persistedPendingCollectionMatches(staged);
    if (persisted) this.interactions = staged;
    return persisted;
  }

  /**
   * Mark an interaction as confirmed by backend
   */
  markConfirmedInteraction(id: string, syncOwnerId?: string): boolean {
    const persisted = this.markConfirmed(id, syncOwnerId);
    if (persisted && import.meta.env.DEV) {
      console.info('[telemetry_interaction_confirmed]', { eventId: id });
    }
    return persisted;
  }

  /**
   * Mark an interaction as dead letter (irrecoverable)
   */
  markDeadLetter(id: string, reason: string, syncOwnerId?: string): boolean {
    const identity = ownedSyncIdentity(id, syncOwnerId);
    const item = this.interactions.get(identity);
    if (!item) return false;
    const staged = new Map(this.interactions);
    staged.set(identity, { ...item, status: 'dead_letter' });
    const persisted = this.savePending({ allowEviction: false }, staged).success &&
      this.persistedPendingCollectionMatches(staged);
    if (!persisted) return false;
    this.interactions = staged;
    console.error('[telemetry_dead_letter]', { eventId: id, reason });
    return true;
  }

  /**
   * Get all pending interactions (backend_pending status)
   */
  getAllPending(): PendingInteraction[] {
    this.lastClaimPersistenceFailed = false;
    if (!this.pendingRootValid || !this.confirmedRootValid) {
      this.lastClaimPersistenceFailed = true;
      return [];
    }
    const eligible: PendingInteraction[] = [];
    const originalInteractions = this.interactions;
    const stagedInteractions = new Map(originalInteractions);
    const claimedItems: PendingInteraction[] = [];
    const principal = getActiveSyncPrincipal();

    for (const [identity, item] of originalInteractions) {
      if (item.status !== 'backend_pending' || this.isEnvelopeConfirmed(item)) {
        continue;
      }
      const ownership = resolveEnvelopeOwnershipForActivePrincipal(item, item.event.learnerId);
      if (ownership.eligible) {
        const confirmed = principal
          ? this.confirmedForOwner(item.id, principal.syncOwnerId)
          : undefined;
        if (
          (principal && this.unverifiedRecordMayBelongToOwner(
            this.unverifiedConfirmedRecords,
            item.id,
            principal.syncOwnerId,
          )) ||
          confirmed &&
          confirmed.eventFingerprint !== interactionEventFingerprint(item.event)
        ) {
          this.lastClaimPersistenceFailed = true;
          continue;
        }
        eligible.push(item);
      } else if (ownership.claimOwnerId) {
        const targetIdentity = ownedSyncIdentity(item.id, ownership.claimOwnerId);
        const confirmed = this.confirmedForOwner(item.id, ownership.claimOwnerId);
        const fingerprint = interactionEventFingerprint(item.event);
        if (
          stagedInteractions.has(targetIdentity) ||
          this.unverifiedRecordMayBelongToOwner(
            this.unverifiedPendingRecords,
            item.id,
            ownership.claimOwnerId,
          ) ||
          this.unverifiedRecordMayBelongToOwner(
            this.unverifiedConfirmedRecords,
            item.id,
            ownership.claimOwnerId,
          ) ||
          (confirmed && confirmed.eventFingerprint !== fingerprint)
        ) {
          this.lastClaimPersistenceFailed = true;
          continue;
        }
        if (confirmed?.eventFingerprint === fingerprint) {
          continue;
        }
        const claimed = { ...item, syncOwnerId: ownership.claimOwnerId };
        stagedInteractions.delete(identity);
        stagedInteractions.set(envelopeSyncIdentity(claimed.id, claimed), claimed);
        claimedItems.push(claimed);
      }
    }

    if (claimedItems.length > 0) {
      const persisted = this.savePending({ allowEviction: false }, stagedInteractions).success &&
        this.persistedPendingCollectionMatches(stagedInteractions) &&
        claimedItems.every((claimed) => {
          const stored = readStoredArray(PENDING_INTERACTIONS_KEY);
          return stored.validRoot && stored.records.some((record) =>
            isStoredPendingInteraction(record) &&
            record.syncOwnerId === claimed.syncOwnerId &&
            interactionEventFingerprint(record.event) === interactionEventFingerprint(claimed.event),
          );
        });
      if (persisted) {
        this.interactions = stagedInteractions;
        eligible.push(...claimedItems);
      } else {
        this.lastClaimPersistenceFailed = true;
      }
    }

    return eligible.sort((a, b) => a.timestamp - b.timestamp);
  }

  didLastClaimPersistenceFail(): boolean {
    return this.lastClaimPersistenceFailed;
  }

  coordinateQueueInteraction(
    event: InteractionEvent,
    syncOwnerId: string,
    coordination: PendingQueueCoordination,
    claimingLegacyQueue = false,
  ): 'ready' | 'confirmed' | 'blocked' {
    if (!this.pendingRootValid || !this.confirmedRootValid) return 'blocked';
    if (claimingLegacyQueue) {
      const hasOtherOwnerCollision = [
        ...coordination.staged.values(),
        ...this.confirmedItems.values(),
        ...this.unverifiedPendingRecords,
        ...this.unverifiedConfirmedRecords,
      ].some((record) =>
        isRecord(record) && record.id === event.id &&
        typeof record.syncOwnerId === 'string' && record.syncOwnerId.length > 0 &&
        record.syncOwnerId !== syncOwnerId,
      );
      if (hasOtherOwnerCollision) return 'blocked';
    }
    const fingerprint = interactionEventFingerprint(event);
    const confirmed = this.confirmedForOwner(event.id, syncOwnerId);
    if (confirmed) {
      return confirmed.eventFingerprint === fingerprint ? 'confirmed' : 'blocked';
    }
    if (
      this.unverifiedRecordMayBelongToOwner(this.unverifiedPendingRecords, event.id, syncOwnerId) ||
      this.unverifiedRecordMayBelongToOwner(this.unverifiedConfirmedRecords, event.id, syncOwnerId)
    ) {
      return 'blocked';
    }

    const relevant = Array.from(coordination.staged.entries()).filter(([, item]) => {
      if (item.id !== event.id) return false;
      if (!Object.prototype.hasOwnProperty.call(item, 'syncOwnerId')) {
        return item.event.learnerId === event.learnerId;
      }
      return item.syncOwnerId === syncOwnerId;
    });
    if (relevant.some(([, item]) => interactionEventFingerprint(item.event) !== fingerprint)) {
      return 'blocked';
    }
    const ownedExact = relevant.find(([, item]) => item.syncOwnerId === syncOwnerId);
    if (ownedExact) return 'ready';
    const legacyExact = relevant.find(([, item]) =>
      !Object.prototype.hasOwnProperty.call(item, 'syncOwnerId'),
    );
    if (!legacyExact) return 'ready';

    const [legacyIdentity, legacyItem] = legacyExact;
    const targetIdentity = ownedSyncIdentity(event.id, syncOwnerId);
    if (coordination.staged.has(targetIdentity)) return 'blocked';
    const claimed = { ...legacyItem, syncOwnerId };
    coordination.staged.delete(legacyIdentity);
    coordination.staged.set(targetIdentity, claimed);
    coordination.changed = true;
    return 'ready';
  }

  beginQueueCoordination(): PendingQueueCoordination {
    const original = new Map(this.interactions);
    return { original, staged: new Map(original), changed: false };
  }

  persistQueueCoordination(coordination: PendingQueueCoordination): boolean {
    if (!coordination.changed) return true;
    const persisted = this.savePending({ allowEviction: false }, coordination.staged).success &&
      this.persistedPendingCollectionMatches(coordination.staged);
    if (persisted) {
      this.interactions = coordination.staged;
    }
    return persisted;
  }

  restoreQueueCoordination(coordination: PendingQueueCoordination): boolean {
    if (!coordination.changed) return true;
    const restored = this.savePending({ allowEviction: false }, coordination.original).success &&
      this.persistedPendingCollectionMatches(coordination.original);
    if (restored) {
      this.interactions = coordination.original;
    }
    return restored;
  }

  /**
   * Get pending interactions for a specific session
   * RESEARCH-1: Used for pagehide flush
   */
  getPendingForSession(sessionId: string): PendingInteraction[] {
    return this.getAllPending().filter(item => item.sessionId === sessionId);
  }

  /**
   * Get a specific pending interaction
   */
  get(id: string): PendingInteraction | undefined {
    return this.getAllPending().find((item) => item.id === id);
  }

  /**
   * Check if an interaction is pending
   */
  isPending(id: string): boolean {
    return this.getAllPending().some((item) => item.id === id);
  }

  hasExactPendingEventForActivePrincipal(event: InteractionEvent): boolean {
    const principal = getActiveSyncPrincipal();
    if (!principal) return false;
    return this.getAllPending().some(
      (item) =>
        item.syncOwnerId === principal.syncOwnerId &&
        isExactInteractionEvent(item.event, event),
    );
  }

  hasExactConfirmedEventForActivePrincipal(event: InteractionEvent): boolean {
    const principal = getActiveSyncPrincipal();
    if (!principal) return false;
    const confirmed = this.confirmedItems.get(ownedSyncIdentity(event.id, principal.syncOwnerId));
    return confirmed?.eventFingerprint === interactionEventFingerprint(event);
  }

  /**
   * Get count of pending interactions
   */
  getPendingCount(): number {
    return this.getAllPending().length;
  }

  /**
   * Get statistics for diagnostics
   */
  getStats(): {
    totalPending: number;
    oldestPendingAgeMs: number | null;
    bySession: Record<string, number>;
    byEventType: Record<string, number>;
  } {
    const pending = this.getAllPending();
    const now = Date.now();
    
    let oldestPendingAgeMs: number | null = null;
    if (pending.length > 0) {
      const oldest = Math.min(...pending.map(p => p.timestamp));
      oldestPendingAgeMs = now - oldest;
    }

    const bySession: Record<string, number> = {};
    const byEventType: Record<string, number> = {};
    
    for (const item of pending) {
      bySession[item.sessionId] = (bySession[item.sessionId] || 0) + 1;
      byEventType[item.eventType] = (byEventType[item.eventType] || 0) + 1;
    }

    return {
      totalPending: pending.length,
      oldestPendingAgeMs,
      bySession,
      byEventType,
    };
  }

  /**
   * Clear all pending interactions (use with caution)
   */
  clear(): void {
    this.interactions.clear();
    safeRemove(PENDING_INTERACTIONS_KEY);
  }
}

// ============================================================================
// Offline Queue Manager - Durable retry-until-ack semantics
// ============================================================================

class OfflineQueueManager {
  private queue: QueuedItem[] = [];
  private isProcessing = false;
  private durableStore: DurablePendingStore;
  private deadLetter: DeadLetterItem[] = [];
  private unverifiedQueueRecords: unknown[] = [];
  private unverifiedDeadLetterRecords: unknown[] = [];
  private queueRootValid = true;
  private deadLetterRootValid = true;
  private onConfirmedCallback?: (ids: string[], syncOwnerId?: string) => void;
  private onDeadLetterCallback?: (ids: string[], reason: string, syncOwnerId?: string) => void;
  private lastClaimPersistenceFailed = false;

  constructor(
    durableStore: DurablePendingStore,
    onConfirmed?: (ids: string[], syncOwnerId?: string) => void,
    onDeadLetter?: (ids: string[], reason: string, syncOwnerId?: string) => void,
  ) {
    this.durableStore = durableStore;
    this.onConfirmedCallback = onConfirmed;
    this.onDeadLetterCallback = onDeadLetter;
    this.loadQueue();
    this.loadDeadLetter();
    // Start background processing
    this.startBackgroundProcessing();
  }

  private loadQueue(): void {
    const stored = readStoredArray(OFFLINE_QUEUE_KEY);
    this.queueRootValid = stored.validRoot;
    this.queue = [];
    this.unverifiedQueueRecords = [];
    if (!stored.validRoot) return;

    const ambiguous = new Set<string>();
    const byIdentity = new Map<string, QueuedItem>();
    for (const record of stored.records) {
      if (!isStoredQueuedItem(record)) {
        this.unverifiedQueueRecords.push(record);
        continue;
      }
      const identity = envelopeSyncIdentity(record.id, record);
      if (ambiguous.has(identity)) {
        this.unverifiedQueueRecords.push(record);
        continue;
      }
      const existing = byIdentity.get(identity);
      if (existing) {
        byIdentity.delete(identity);
        this.unverifiedQueueRecords.push(existing, record);
        ambiguous.add(identity);
        continue;
      }
      byIdentity.set(identity, record);
    }
    this.queue = [...byIdentity.values()];
  }

  private queueRecords(queue = this.queue): unknown[] {
    return [...this.unverifiedQueueRecords, ...queue];
  }

  private saveQueue(
    _options: { allowEviction?: boolean } = {},
    queue = this.queue,
  ): SafeSetResult {
    if (!this.queueRootValid) {
      return { success: false, error: 'Offline queue storage root is malformed' };
    }
    try {
      return safeSet(OFFLINE_QUEUE_KEY, this.queueRecords(queue), {
        priority: 'critical',
        allowEviction: false,
      });
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Offline queue write failed' };
    }
  }

  private persistedQueueCollectionMatches(queue: QueuedItem[]): boolean {
    const stored = readStoredArray(OFFLINE_QUEUE_KEY);
    return stored.validRoot &&
      JSON.stringify(stored.records) === JSON.stringify(this.queueRecords(queue));
  }

  private loadDeadLetter(): void {
    const stored = readStoredArray(DEAD_LETTER_KEY);
    this.deadLetterRootValid = stored.validRoot;
    this.deadLetter = [];
    this.unverifiedDeadLetterRecords = [];
    if (!stored.validRoot) return;

    const ambiguous = new Set<string>();
    const byIdentity = new Map<string, DeadLetterItem>();
    for (const record of stored.records) {
      if (!isStoredDeadLetterItem(record)) {
        this.unverifiedDeadLetterRecords.push(record);
        continue;
      }
      const identity = envelopeSyncIdentity(record.id, record);
      if (ambiguous.has(identity)) {
        this.unverifiedDeadLetterRecords.push(record);
        continue;
      }
      const existing = byIdentity.get(identity);
      if (existing) {
        byIdentity.delete(identity);
        this.unverifiedDeadLetterRecords.push(existing, record);
        ambiguous.add(identity);
        continue;
      }
      byIdentity.set(identity, record);
    }
    this.deadLetter = [...byIdentity.values()];
  }

  private deadLetterRecords(deadLetter = this.deadLetter): unknown[] {
    return [...this.unverifiedDeadLetterRecords, ...deadLetter];
  }

  private saveDeadLetter(deadLetter = this.deadLetter): SafeSetResult {
    if (!this.deadLetterRootValid) {
      return { success: false, error: 'Dead-letter storage root is malformed' };
    }
    try {
      return safeSet(
        DEAD_LETTER_KEY,
        this.deadLetterRecords(deadLetter),
        { priority: 'critical', allowEviction: false },
      );
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Dead-letter write failed' };
    }
  }

  private persistedDeadLetterCollectionMatches(deadLetter: DeadLetterItem[]): boolean {
    const stored = readStoredArray(DEAD_LETTER_KEY);
    return stored.validRoot &&
      JSON.stringify(stored.records) === JSON.stringify(this.deadLetterRecords(deadLetter));
  }

  private isEnvelopeDeadLettered(envelope: QueuedItem): boolean {
    const identity = envelopeSyncIdentity(envelope.id, envelope);
    const proof = this.deadLetter.find((item) => envelopeSyncIdentity(item.id, item) === identity);
    return Boolean(
      proof &&
      queuePayloadFingerprint(proof) === queuePayloadFingerprint(envelope),
    );
  }

  add(item: Omit<QueuedItem, 'retries' | 'timestamp' | 'status' | 'errorCount'>): boolean {
    if (!this.queueRootValid || !this.deadLetterRootValid) return false;
    const principal = getActiveSyncPrincipal();
    const syncOwnerId = item.syncOwnerId ?? principal?.syncOwnerId;
    const queueItem: QueuedItem = {
      ...item,
      retries: 0,
      timestamp: Date.now(),
      status: 'queued_locally',
      errorCount: 0,
      ...(syncOwnerId ? { syncOwnerId } : {}),
    };
    if (!isStoredQueuedItem(queueItem)) return false;
    const confirmationState = this.durableStore.getEnvelopeConfirmationState(
      queueItem,
      syncOwnerId,
    );
    if (confirmationState === 'confirmed' || this.isEnvelopeDeadLettered(queueItem)) return true;
    if (confirmationState === 'blocked') return false;
    if (this.unverifiedQueueRecords.some((record) =>
      isRecord(record) && record.id === queueItem.id &&
      (!Object.prototype.hasOwnProperty.call(record, 'syncOwnerId') || record.syncOwnerId === syncOwnerId),
    )) return false;
    if (this.unverifiedDeadLetterRecords.some((record) =>
      isRecord(record) && record.id === queueItem.id &&
      (!Object.prototype.hasOwnProperty.call(record, 'syncOwnerId') || record.syncOwnerId === syncOwnerId),
    )) return false;
    const identity = envelopeSyncIdentity(queueItem.id, queueItem);
    const existing = this.queue.find((candidate) =>
      envelopeSyncIdentity(candidate.id, candidate) === identity,
    );
    if (existing) {
      return queuePayloadFingerprint(existing) === queuePayloadFingerprint(queueItem);
    }

    const stagedQueue = [...this.queue, queueItem];
    const persisted = this.saveQueue({ allowEviction: false }, stagedQueue).success &&
      this.persistedQueueCollectionMatches(stagedQueue);
    if (!persisted) return false;
    this.queue = stagedQueue;

    // Log queue growth for large backlogs
    if (this.queue.length > CHUNK_SIZE) {
      if (import.meta.env.DEV) {
        console.info('[OfflineQueue] Queue size:', this.queue.length, '- retaining complete durable queue');
      }
    }
    return true;
  }

  remove(id: string, syncOwnerId?: string): boolean {
    const identity = ownedSyncIdentity(id, syncOwnerId);
    const confirmedEnvelope = this.queue.find(
      (item) => envelopeSyncIdentity(item.id, item) === identity,
    );
    if (!confirmedEnvelope || !this.durableStore.markConfirmed(id, syncOwnerId, confirmedEnvelope)) {
      return false;
    }
    const stagedQueue = this.queue.filter(
      item => envelopeSyncIdentity(item.id, item) !== identity,
    );
    const removedPersisted = this.saveQueue({ allowEviction: false }, stagedQueue).success &&
      this.persistedQueueCollectionMatches(stagedQueue);
    if (removedPersisted) {
      this.queue = stagedQueue;
    }
    return true;
  }

  removeBatch(ids: string[], syncOwnerId?: string): boolean {
    const identities = new Set(ids.map((id) => ownedSyncIdentity(id, syncOwnerId)));
    const confirmedEnvelopes = this.queue
      .filter((item) => identities.has(envelopeSyncIdentity(item.id, item)));
    if (!this.durableStore.markConfirmedBatch(ids, syncOwnerId, confirmedEnvelopes)) return false;
    const stagedQueue = this.queue.filter(item => !identities.has(envelopeSyncIdentity(item.id, item)));
    const removedPersisted = this.saveQueue({ allowEviction: false }, stagedQueue).success &&
      this.persistedQueueCollectionMatches(stagedQueue);
    if (removedPersisted) {
      this.queue = stagedQueue;
    }
    
    // RESEARCH-1: Notify external pending store of confirmations
    if (this.onConfirmedCallback) {
      this.onConfirmedCallback(ids, syncOwnerId);
    }
    return true;
  }

  getPending(): QueuedItem[] {
    this.lastClaimPersistenceFailed = false;
    if (!this.queueRootValid) {
      this.lastClaimPersistenceFailed = true;
      return [];
    }
    const originalQueue = this.queue;
    const stagedQueue = [...originalQueue];
    const pending: QueuedItem[] = [];
    const claimedItems: QueuedItem[] = [];
    const principal = getActiveSyncPrincipal();
    const coordinationStage = this.durableStore.beginQueueCoordination();
    originalQueue.forEach((item, index) => {
      if (
        item.status === 'backend_confirmed' ||
        this.durableStore.isEnvelopeConfirmed(item) ||
        this.isEnvelopeDeadLettered(item)
      ) {
        return;
      }
      const ownership = resolveEnvelopeOwnershipForActivePrincipal(item, queuedItemLearnerId(item));
      if (ownership.eligible) {
        const confirmationState = this.durableStore.getEnvelopeConfirmationState(
          item,
          principal?.syncOwnerId,
        );
        if (confirmationState === 'blocked') {
          this.lastClaimPersistenceFailed = true;
          return;
        }
        if (confirmationState === 'confirmed') return;
        if (item.type === 'interaction' && principal) {
          const coordinationStatus = this.durableStore.coordinateQueueInteraction(
            item.data as InteractionEvent,
            principal.syncOwnerId,
            coordinationStage,
          );
          if (coordinationStatus === 'blocked') {
            this.lastClaimPersistenceFailed = true;
            return;
          }
          if (coordinationStatus === 'confirmed') return;
        }
        pending.push(item);
      } else if (ownership.claimOwnerId) {
        const claimed = { ...item, syncOwnerId: ownership.claimOwnerId };
        const confirmationState = this.durableStore.getEnvelopeConfirmationState(
          claimed,
          ownership.claimOwnerId,
        );
        if (confirmationState === 'blocked') {
          this.lastClaimPersistenceFailed = true;
          return;
        }
        if (confirmationState === 'confirmed') return;
        if (item.type === 'interaction') {
          const coordinationStatus = this.durableStore.coordinateQueueInteraction(
            item.data as InteractionEvent,
            ownership.claimOwnerId,
            coordinationStage,
            true,
          );
          if (coordinationStatus === 'blocked') {
            this.lastClaimPersistenceFailed = true;
            return;
          }
          if (coordinationStatus === 'confirmed') return;
        }
        stagedQueue[index] = claimed;
        claimedItems.push(claimed);
      }
    });
    const pendingClaimsPersisted = this.durableStore.persistQueueCoordination(coordinationStage);
    if (!pendingClaimsPersisted) {
      this.lastClaimPersistenceFailed = true;
      return [];
    }
    if (claimedItems.length > 0) {
      const queuePersisted = this.saveQueue({ allowEviction: false }, stagedQueue).success &&
        this.persistedQueueCollectionMatches(stagedQueue) &&
        claimedItems.every((claimed) => {
          const stored = readStoredArray(OFFLINE_QUEUE_KEY);
          return stored.validRoot && stored.records.some((record) =>
            isStoredQueuedItem(record) &&
            record.syncOwnerId === claimed.syncOwnerId &&
            record.type === claimed.type &&
            (record.type === 'interaction'
              ? interactionEventFingerprint(record.data as InteractionEvent) ===
                interactionEventFingerprint(claimed.data as InteractionEvent)
              : queuePayloadFingerprint(record) === queuePayloadFingerprint(claimed)),
          );
        });
      if (queuePersisted) {
        this.queue = stagedQueue;
        pending.push(...claimedItems);
      } else {
        this.durableStore.restoreQueueCoordination(coordinationStage);
        this.lastClaimPersistenceFailed = true;
        return [];
      }
    }
    return pending;
  }

  didLastClaimPersistenceFail(): boolean {
    return this.lastClaimPersistenceFailed;
  }

  getAllUnconfirmed(): QueuedItem[] {
    return this.getPending();
  }

  incrementRetry(id: string, syncOwnerId?: string, error?: Error): void {
    const identity = ownedSyncIdentity(id, syncOwnerId);
    const index = this.queue.findIndex(i => envelopeSyncIdentity(i.id, i) === identity);
    if (index < 0) return;
    const item = this.queue[index];
    const stagedQueue = [...this.queue];
    stagedQueue[index] = {
      ...item,
      retries: item.retries + 1,
      lastAttempt: Date.now(),
      status: 'sent_unverified',
      errorCount: item.errorCount + (error ? 1 : 0),
    };
    const persisted = this.saveQueue({ allowEviction: false }, stagedQueue).success &&
      this.persistedQueueCollectionMatches(stagedQueue);
    if (persisted) this.queue = stagedQueue;
  }

  markSent(id: string, syncOwnerId?: string): void {
    const identity = ownedSyncIdentity(id, syncOwnerId);
    const index = this.queue.findIndex(i => envelopeSyncIdentity(i.id, i) === identity);
    if (index < 0) return;
    const stagedQueue = [...this.queue];
    stagedQueue[index] = {
      ...this.queue[index],
      status: 'sent_unverified',
      lastAttempt: Date.now(),
    };
    const persisted = this.saveQueue({ allowEviction: false }, stagedQueue).success &&
      this.persistedQueueCollectionMatches(stagedQueue);
    if (persisted) this.queue = stagedQueue;
  }

  moveToDeadLetter(id: string, reason: string, syncOwnerId?: string): void {
    const identity = ownedSyncIdentity(id, syncOwnerId);
    const item = this.queue.find(i => envelopeSyncIdentity(i.id, i) === identity);
    if (item) {
      if (this.unverifiedDeadLetterRecords.some((record) =>
        isRecord(record) && record.id === id &&
        (!Object.prototype.hasOwnProperty.call(record, 'syncOwnerId') || record.syncOwnerId === syncOwnerId),
      )) {
        return;
      }
      const originalDeadLetter = [...this.deadLetter];
      const stagedDeadLetter = [...originalDeadLetter, {
        id: item.id,
        type: item.type,
        data: item.data,
        reason,
        timestamp: Date.now(),
        ...(item.syncOwnerId ? { syncOwnerId: item.syncOwnerId } : {}),
      }];
      const proofPersisted = this.saveDeadLetter(stagedDeadLetter).success &&
        this.persistedDeadLetterCollectionMatches(stagedDeadLetter);
      if (!proofPersisted) return;
      this.deadLetter = stagedDeadLetter;

      const stagedQueue = this.queue.filter(item => envelopeSyncIdentity(item.id, item) !== identity);
      const sourceRemoved = this.saveQueue({ allowEviction: false }, stagedQueue).success &&
        this.persistedQueueCollectionMatches(stagedQueue);
      if (!sourceRemoved) {
        const proofRolledBack = this.saveDeadLetter(originalDeadLetter).success &&
          this.persistedDeadLetterCollectionMatches(originalDeadLetter);
        if (proofRolledBack) {
          this.deadLetter = originalDeadLetter;
        }
        return;
      }
      this.queue = stagedQueue;

      console.error('[telemetry_dead_letter]', {
        eventId: item.id,
        eventType: item.type,
        reason,
      });

      if (this.onDeadLetterCallback) {
        this.onDeadLetterCallback([id], reason, syncOwnerId);
      }
    }
  }

  getDeadLetter(): DeadLetterItem[] {
    return [...this.deadLetter];
  }

  private startBackgroundProcessing(): void {
    // Try to process queue every 30 seconds
    setInterval(() => {
      this.processQueue();
    }, 30000);
    
    // Also try on online event
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        if (import.meta.env.DEV) {
          console.log('[OfflineQueue] Back online, processing queue...');
        }
        this.processQueue();
      });
    }
  }

  async processQueue(): Promise<void> {
    const principal = getActiveSyncPrincipal();
    if (!principal || this.isProcessing || this.queue.length === 0) {
      return;
    }

    const backendHealthy = await checkBackendHealth();
    if (!backendHealthy) {
      return;
    }

    if (!isActiveSyncPrincipal(principal)) {
      return;
    }

    this.isProcessing = true;
    try {
      const pending = this.getPending();
    
    // Process interactions in batches for efficiency
    const interactions = pending.filter(item => item.type === 'interaction');
    const others = pending.filter(item => item.type !== 'interaction');
    
    // Process interactions in batches
    for (let i = 0; i < interactions.length; i += BATCH_SIZE) {
      if (!isActiveSyncPrincipal(principal)) {
        break;
      }
      const batch = interactions.slice(i, i + BATCH_SIZE);
      const events = batch.map(item => item.data as InteractionEvent);
      
      try {
        // Use verified batch write
        const result = await storageClient.logInteractionsBatchVerified(events);
        if (!isActiveSyncPrincipal(principal)) {
          break;
        }
        
        if (result.confirmed.length > 0) {
          this.removeBatch(result.confirmed, principal.syncOwnerId);
        }

        if (result.invalid && result.invalid.length > 0) {
          for (const id of result.invalid) {
            this.moveToDeadLetter(id, 'server_schema_validation_failed', principal.syncOwnerId);
          }
        }
        
        // Mark sent but not confirmed for retry
        for (const id of result.failed) {
          if (result.invalid?.includes(id)) {
            continue;
          }
          this.incrementRetry(id, principal.syncOwnerId);
        }
      } catch (error) {
        if (!isActiveSyncPrincipal(principal)) {
          break;
        }
        console.warn('[OfflineQueue] Batch processing failed:', error);
        // Mark all as retry
        for (const item of batch) {
          this.incrementRetry(item.id, principal.syncOwnerId, error as Error);
        }
      }
    }
    
    // Process other item types individually
    for (const item of others) {
      if (!isActiveSyncPrincipal(principal)) {
        break;
      }
      try {
        let success = false;
        
        switch (item.type) {
          case 'textbookUnit': {
            const { learnerId, unit } = item.data as { learnerId: string; unit: InstructionalUnit };
            success = await storageClient.saveTextbookUnit(learnerId, unit);
            break;
          }
          case 'profile':
            success = await storageClient.saveProfile(item.data as LearnerProfile);
            break;
          case 'session': {
            const { learnerId, data } = item.data as { learnerId: string; data: unknown };
            success = await storageClient.saveSession(learnerId, data as { startTime: string; lastActivity: string });
            break;
          }
        }
        if (!isActiveSyncPrincipal(principal)) {
          break;
        }
        
        if (success) {
          this.remove(item.id, principal.syncOwnerId);
        } else {
          this.incrementRetry(item.id, principal.syncOwnerId);
        }
      } catch (error) {
        if (!isActiveSyncPrincipal(principal)) {
          break;
        }
        console.warn('[OfflineQueue] Failed to process item:', error);
        this.incrementRetry(item.id, principal.syncOwnerId, error as Error);
      }
      
      // Small delay between items to avoid overwhelming the backend
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    } finally {
      this.isProcessing = false;
    }
  }
}

// ============================================================================
// Dual Storage Manager
// ============================================================================

class DualStorageManager {
  private config: StorageConfig;
  private backendHealthy: boolean = false;
  private offlineQueue: OfflineQueueManager;
  private pendingStore: DurablePendingStore;  // RESEARCH-1: Tracks all pending interactions
  private lastHydratedAt: Record<string, number> = {};
  private lastBackendAckTime: number | null = null;
  private totalConfirmedCount: number = 0;
  private totalFailedCount: number = 0;
  private pendingSessionEndClaimFailed = false;

  private storageTelemetryUnsubscribe?: () => void;

  constructor() {
    this.config = {
      useBackend: USE_BACKEND,
      fallbackToLocal: true,
    };
    
    // Subscribe to storage telemetry for monitoring quota issues
    this.storageTelemetryUnsubscribe = subscribeToStorageTelemetry((event) => {
      if (event.type === 'storage_write_failed' && event.details?.priority === 'critical') {
        console.error('[DualStorage] Critical storage write failed:', event.key, event.details);
      }
    });
    
    this.pendingStore = new DurablePendingStore();  // RESEARCH-1
    this.offlineQueue = new OfflineQueueManager(this.pendingStore, undefined, (ids, reason, syncOwnerId) => {
      for (const id of ids) {
        this.pendingStore.markDeadLetter(id, reason, syncOwnerId);
      }
    });
    
    // Check backend health on init
    if (this.config.useBackend) {
      void this.checkHealth().then((healthy) => {
        if (healthy) {
          void this.flushPendingSessionEnds();
        }
      });
      if (typeof window !== 'undefined') {
        window.addEventListener('online', () => {
          void this.flushPendingSessionEnds();
        });
      }
    }
  }

  /**
   * Get current storage mode
   */
  getMode(): StorageMode {
    if (!this.config.useBackend) return 'local';
    if (this.backendHealthy) return 'backend';
    return 'offline';
  }

  /**
   * Check if backend is available and healthy
   */
  async checkHealth(): Promise<boolean> {
    if (!this.config.useBackend) {
      this.backendHealthy = false;
      return false;
    }
    this.backendHealthy = await checkBackendHealth();
    return this.backendHealthy;
  }

  /**
   * Get research runtime mode
   * @returns 'research-safe' | 'research-unsafe' | 'dev-demo'
   */
  getResearchMode(): ResearchMode {
    return getResearchRuntimeMode();
  }

  /**
   * Check if in research-safe mode (data durability guaranteed)
   */
  isResearchSafe(): boolean {
    return isResearchSafe();
  }

  /**
   * Check if in research-unsafe mode (BLOCKING in production)
   */
  isResearchUnsafe(): boolean {
    return isResearchUnsafe();
  }

  /**
   * Check if storage operations are allowed
   * Returns false in research-unsafe mode
   */
  areWritesAllowed(): boolean {
    return !isResearchUnsafe();
  }

  /**
   * Get queue statistics for diagnostics
   */
  getQueueStats(): QueueStats {
    const pending = this.offlineQueue.getPending();
    const now = Date.now();
    
    let oldestUnconfirmedAgeMs: number | null = null;
    if (pending.length > 0) {
      const oldest = pending.reduce((oldest, item) => 
        item.timestamp < oldest.timestamp ? item : oldest
      );
      oldestUnconfirmedAgeMs = now - oldest.timestamp;
    }

    return {
      pendingCount: pending.length,
      oldestUnconfirmedAgeMs,
      lastBackendAckTime: this.lastBackendAckTime,
      totalConfirmed: this.totalConfirmedCount,
      totalFailed: this.totalFailedCount,
    };
  }

  /**
   * Log queue statistics for telemetry
   */
  logQueueStats(): void {
    const stats = this.getQueueStats();
    const pendingStats = this.pendingStore.getStats();
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.info('[telemetry_queue_stats]', {
        ...stats,
        pendingStore: pendingStats,
        researchMode: this.getResearchMode(),
        contractVersion: RESEARCH_CONTRACT_VERSION,
      });
    }
  }

  /**
   * RESEARCH-1: Get all pending interactions (not yet confirmed by backend)
   */
  getAllPendingInteractions(): InteractionEvent[] {
    return this.pendingStore.getAllPending().map(p => p.event);
  }

  /**
   * RESEARCH-1: Get pending interactions for a specific session
   * Used for pagehide flush to ensure all session events are sent
   */
  getPendingInteractionsForSession(sessionId: string): InteractionEvent[] {
    return this.pendingStore.getPendingForSession(sessionId).map(p => p.event);
  }

  /**
   * RESEARCH-1: Get pending store statistics
   */
  getPendingStats(): ReturnType<DurablePendingStore['getStats']> {
    return this.pendingStore.getStats();
  }

  /**
   * Set storage mode
   */
  setMode(mode: 'local' | 'backend'): void {
    this.config.useBackend = mode === 'backend';
    if (mode === 'backend') {
      this.checkHealth();
    }
  }

  // ============================================================================
  // User Profile Operations
  // ============================================================================

  private addOfflineQueueItem(
    item: Omit<QueuedItem, 'retries' | 'timestamp' | 'status' | 'errorCount'>,
    failureMessage: string,
  ): boolean {
    const persisted = this.offlineQueue.add(item);
    if (!persisted) {
      console.error(failureMessage);
    }
    return persisted;
  }

  private queueProfileForRetry(
    profile: LearnerProfile,
    reason: string,
    idPrefix: 'profile' | 'full-profile' = 'full-profile',
    error?: unknown,
    syncOwnerId?: string,
  ): boolean {
    if (error !== undefined) {
      console.warn(reason, error);
    } else {
      console.warn(reason);
    }
    return this.addOfflineQueueItem({
      id: `${idPrefix}-${profile.id}-${createEventId('retry')}`,
      type: 'profile',
      data: serializeQueuedProfile(profile),
      ...(syncOwnerId ? { syncOwnerId } : {}),
    }, '[DualStorage] Profile retry envelope could not be persisted.');
  }

  saveUserProfile(profile: UserProfile): { success: boolean; quotaExceeded?: boolean } {
    // Always save to localStorage as cache (synchronous)
    const localResult = localStorageManager.saveUserProfile(profile);

    // In backend account mode, auth/signup already owns user creation. Keep this
    // cache write local-only to avoid render-path 409 conflicts against /api/learners.
    return localResult;
  }

  getUserProfile(): UserProfile | null {
    // Read local cache synchronously. Backend refresh belongs in explicit
    // hydration/auth flows, not getters that are called during render.
    return localStorageManager.getUserProfile();
  }

  clearUserProfile(): boolean {
    // Always clear both
    if (this.config.useBackend) {
      // Backend doesn't support delete yet, just clear local
    }
    const profile = localStorageManager.getUserProfile();
    if (profile?.id) {
      clearUiStateForActor(profile.id);
    } else {
      clearAllUiState();
    }
    return localStorageManager.clearUserProfile();
  }

  // ============================================================================
  // Interaction/Event Operations
  // ============================================================================

  private withActiveSessionFallback(event: InteractionEvent): InteractionEvent {
    const explicitSessionId = event.sessionId?.trim();
    if (explicitSessionId) {
      return explicitSessionId === event.sessionId
        ? event
        : { ...event, sessionId: explicitSessionId };
    }

    return {
      ...event,
      sessionId: localStorageManager.getActiveSessionId(),
    };
  }

  private getPersistedInteraction(event: InteractionEvent): InteractionEvent {
    const persisted = localStorageManager
      .getInteractionsByLearner(event.learnerId)
      .slice()
      .reverse()
      .find((candidate) =>
        candidate.id === event.id &&
        candidate.sessionId === event.sessionId &&
        candidate.timestamp === event.timestamp &&
        candidate.eventType === event.eventType,
      );
    return persisted ?? event;
  }

  private queueInteractionForRetry(event: InteractionEvent, syncOwnerId?: string): boolean {
    return this.addOfflineQueueItem({
      id: event.id,
      type: 'interaction',
      data: event,
      ...(syncOwnerId ? { syncOwnerId } : {}),
    }, '[DualStorage] Interaction retry envelope could not be persisted.');
  }

  private sendInteractionToBackend(event: InteractionEvent, source: string): void {
    const principal = getActiveSyncPrincipal();
    const eventForWrite = this.withActiveSessionFallback(event);

    if (!this.config.useBackend) {
      return;
    }

    if (!this.pendingStore.add(eventForWrite)) {
      console.error(`[DualStorage] ${source} remains local because durable pending storage is unavailable`);
      return;
    }

    if (!principal || !this.shouldUseBackend()) {
      this.queueInteractionForRetry(eventForWrite, principal?.syncOwnerId);
      return;
    }

    this.pendingStore.markSent(eventForWrite.id, principal.syncOwnerId);
    storageClient.logInteraction(eventForWrite).then(result => {
      if (!isActiveSyncPrincipal(principal)) {
        return;
      }
      if (!result.success || !result.confirmed) {
        this.queueInteractionForRetry(eventForWrite, principal.syncOwnerId);
      } else {
        this.pendingStore.markConfirmedInteraction(eventForWrite.id, principal.syncOwnerId);
      }
    }).catch(error => {
      if (!isActiveSyncPrincipal(principal)) {
        return;
      }
      console.warn(`[DualStorage] Backend ${source} failed, queuing for retry:`, error);
      this.queueInteractionForRetry(eventForWrite, principal.syncOwnerId);
    });
  }

  /**
   * @deprecated Use saveInteraction() for all research-critical events.
   * This method uses the old send-and-queue-on-failure logic instead of 
   * the durable pending-store lifecycle. Removed for concept_view and session_end.
   */
  private syncLatestLocalInteraction<T>(learnerId: string, source: string, write: () => T): T {
    const beforeCount = localStorageManager.getInteractionsByLearner(learnerId).length;
    const result = write();
    const writeFailed =
      typeof result === 'object' &&
      result !== null &&
      'success' in result &&
      (result as { success?: unknown }).success === false;
    if (writeFailed) {
      return result;
    }

    const interactions = localStorageManager.getInteractionsByLearner(learnerId);
    if (interactions.length <= beforeCount) {
      return result;
    }

    for (const createdEvent of interactions.slice(beforeCount)) {
      this.sendInteractionToBackend(createdEvent, source);
    }
    return result;
  }

  saveInteraction(event: InteractionEvent): { success: boolean; quotaExceeded?: boolean; blocked?: boolean } {
    // RESEARCH-SAFETY: Block writes in research-unsafe mode
    if (isResearchUnsafe()) {
      console.error('[DualStorage] BLOCKED: saveInteraction in research-unsafe mode');
      return { success: false, blocked: true };
    }

    const eventForWrite = this.withActiveSessionFallback(event);
    
    // RESEARCH-1: Durable write semantics
    // Step 1: Save to localStorage FIRST (synchronous, always succeeds or fails fast)
    const localResult = localStorageManager.saveInteraction(eventForWrite);
    if (!localResult.success) {
      return localResult;  // Return quota exceeded or other local failure
    }
    
    // Step 2: Add to durable pending store BEFORE network send
    // This ensures the event is tracked even if the tab closes during send
    const persistedEvent = this.getPersistedInteraction(eventForWrite);
    const pendingPersisted = this.pendingStore.add(persistedEvent);
    const principal = getActiveSyncPrincipal();
    if (this.config.useBackend && !pendingPersisted) {
      console.error('[DualStorage] Interaction remains local because durable pending storage is unavailable');
      return localResult;
    }
    
    // Step 3: Update problem progress for execution events
    if (principal && this.shouldUseBackend() && eventForWrite.eventType === 'execution' && eventForWrite.problemId) {
      const progressPayload = {
        solved: eventForWrite.successful === true,
        incrementAttempts: true,
        lastCode: eventForWrite.code,
      };
      storageClient.updateProblemProgress(
        eventForWrite.learnerId,
        eventForWrite.problemId,
        progressPayload
      ).catch(error => {
        console.warn('[DualStorage] Backend updateProblemProgress failed:', error);
        // Non-blocking - progress update is best-effort
      });
    }
    
    // Step 4: Send to backend (async in background)
    if (principal && this.shouldUseBackend()) {
      this.pendingStore.markSent(eventForWrite.id, principal.syncOwnerId);
      
      storageClient.logInteraction(eventForWrite).then(result => {
        if (!isActiveSyncPrincipal(principal)) {
          return;
        }
        if (result.success && result.confirmed) {
          // Backend confirmed receipt - mark as confirmed
          const proofPersisted = this.pendingStore.markConfirmedInteraction(
            eventForWrite.id,
            principal.syncOwnerId,
          );
          this.trackBackendAck();
          if (!proofPersisted) {
            console.error('[DualStorage] Backend confirmed interaction but local proof could not persist:', eventForWrite.id);
          }
        } else {
          // Backend did not confirm - will be retried via pending store
          console.warn('[DualStorage] Backend did not confirm interaction, will retry:', eventForWrite.id);
          this.queueInteractionForRetry(eventForWrite, principal.syncOwnerId);
        }
      }).catch(error => {
        if (!isActiveSyncPrincipal(principal)) {
          return;
        }
        console.warn('[DualStorage] Backend saveInteraction failed, will retry:', error);
        // Event remains in pending store, will be retried
        this.queueInteractionForRetry(eventForWrite, principal.syncOwnerId);
      });
    } else if (!this.config.useBackend) {
      // No backend - mark as confirmed locally
      this.pendingStore.markConfirmedInteraction(eventForWrite.id, principal?.syncOwnerId);
    } else {
      this.queueInteractionForRetry(eventForWrite, principal?.syncOwnerId);
    }
    
    return localResult;
  }

  private trackBackendAck(): void {
    this.lastBackendAckTime = Date.now();
    this.totalConfirmedCount++;
  }

  logInteraction(event: InteractionEvent): { success: boolean; quotaExceeded?: boolean } {
    return this.saveInteraction(event);
  }

  logConceptView(params: {
    learnerId: string;
    problemId: string;
    conceptId: string;
    source: 'problem' | 'hint' | 'textbook';
    unitId?: string;
    sessionId?: string;
  }): { success: boolean; quotaExceeded?: boolean } {
    // RESEARCH-2: Use same durable pending-store path as all research-critical events
    const event: InteractionEvent = {
      id: createEventId('concept'),
      learnerId: params.learnerId,
      sessionId: params.sessionId || this.getActiveSessionId(),
      timestamp: Date.now(),
      eventType: 'concept_view',
      problemId: params.problemId,
      conceptId: params.conceptId,
      source: params.source,
      unitId: params.unitId,
    };
    
    return this.saveInteraction(event);
  }

  logSessionEnd(params: {
    learnerId: string;
    sessionId: string;
    problemId: string;
    totalTime: number;
    problemsAttempted: number;
    problemsSolved: number;
  }): { success: boolean; quotaExceeded?: boolean } {
    // RESEARCH-2: Use same durable pending-store path as all research-critical events
    const event: InteractionEvent = {
      id: createEventId('session_end'),
      learnerId: params.learnerId,
      sessionId: params.sessionId,
      timestamp: Date.now(),
      eventType: 'session_end',
      problemId: params.problemId,
      totalTime: params.totalTime,
      problemsAttempted: params.problemsAttempted,
      problemsSolved: params.problemsSolved,
    };
    
    return this.saveInteraction(event);
  }

  async saveInteractionCritical(event: InteractionEvent): Promise<CriticalWriteStatus> {
    const eventForWrite = this.withActiveSessionFallback(event);
    const localResult = localStorageManager.saveInteraction(eventForWrite);
    if (localResult.success === false) {
      return {
        backendConfirmed: false,
        pendingSync: false,
        error: localResult.quotaExceeded
          ? 'Failed to save locally: browser storage quota exceeded.'
          : 'Failed to save locally.',
        };
      }

    const persistedEvent = this.getPersistedInteraction(eventForWrite);
    const principal = getActiveSyncPrincipal();

    if (!this.config.useBackend) {
      return { backendConfirmed: true, pendingSync: false };
    }

    if (!this.pendingStore.add(persistedEvent)) {
      return {
        backendConfirmed: false,
        pendingSync: true,
        error: 'Saved locally, but durable pending ownership could not be persisted.',
      };
    }

    if (!principal) {
      this.queueInteractionForRetry(eventForWrite);
      return {
        backendConfirmed: false,
        pendingSync: true,
        error: 'Saved locally. Authentication is not active; queued for sync.',
      };
    }

    const healthy = await this.checkHealth();
    if (!isActiveSyncPrincipal(principal)) {
      return {
        backendConfirmed: false,
        pendingSync: true,
        error: 'Saved locally. Authenticated account changed before backend sync.',
      };
    }
    if (!healthy) {
      this.queueInteractionForRetry(eventForWrite, principal.syncOwnerId);
      return {
        backendConfirmed: false,
        pendingSync: true,
        error: 'Saved locally. Backend unavailable; queued for sync.',
      };
    }

    try {
      this.pendingStore.markSent(eventForWrite.id, principal.syncOwnerId);
      const backendSuccess = await storageClient.logInteraction(eventForWrite);
      if (!isActiveSyncPrincipal(principal)) {
        return {
          backendConfirmed: false,
          pendingSync: true,
          error: 'Saved locally. Authenticated account changed during backend sync.',
        };
      }
      if (backendSuccess.success && backendSuccess.confirmed) {
        const proofPersisted = this.pendingStore.markConfirmedInteraction(
          eventForWrite.id,
          principal.syncOwnerId,
        );
        this.trackBackendAck();
        return proofPersisted
          ? { backendConfirmed: true, pendingSync: false }
          : {
              backendConfirmed: true,
              pendingSync: true,
              error: 'Backend confirmed, but local confirmation proof could not be persisted.',
            };
      }
      this.queueInteractionForRetry(eventForWrite, principal.syncOwnerId);
      return {
        backendConfirmed: false,
        pendingSync: true,
        error: 'Saved locally. Backend did not confirm; queued for retry.',
      };
    } catch (error) {
      if (!isActiveSyncPrincipal(principal)) {
        return {
          backendConfirmed: false,
          pendingSync: true,
          error: 'Saved locally. Authenticated account changed during backend sync.',
        };
      }
      console.warn('[DualStorage] saveInteractionCritical backend failure, queued:', error);
      this.queueInteractionForRetry(eventForWrite, principal.syncOwnerId);
      return {
        backendConfirmed: false,
        pendingSync: true,
        error: 'Saved locally. Backend request failed; queued for retry.',
      };
    }
  }

  getAllInteractions(): InteractionEvent[] {
    const learnerId = this.getCurrentLearnerId();
    if (learnerId && this.shouldUseBackend()) {
      void this.hydrateLearner(learnerId);
    }
    return localStorageManager.getAllInteractions();
  }

  getInteractionsByLearner(learnerId: string): InteractionEvent[] {
    if (this.shouldUseBackend()) {
      void this.hydrateLearner(learnerId);
    }
    return localStorageManager.getInteractionsByLearner(learnerId);
  }

  // ============================================================================
  // Textbook Operations
  // ============================================================================

  saveTextbookUnit(learnerId: string, unit: InstructionalUnit): SaveTextbookUnitResult {
    const principal = getActiveSyncPrincipal();
    const localResult = localStorageManager.saveTextbookUnit(learnerId, unit);
    // Send to backend FIRST (primary source of truth) - async in background
    if (principal && this.shouldUseBackend()) {
      storageClient.saveTextbookUnit(learnerId, unit).then(backendSuccess => {
        if (!isActiveSyncPrincipal(principal)) {
          return;
        }
        if (!backendSuccess) {
          // Backend failed, queue for retry
          this.addOfflineQueueItem({
            id: `textbook-${unit.id}-${createEventId('retry')}`,
            type: 'textbookUnit',
            data: { learnerId, unit },
            syncOwnerId: principal.syncOwnerId,
          }, '[DualStorage] Textbook retry envelope could not be persisted.');
        }
      }).catch(error => {
        if (!isActiveSyncPrincipal(principal)) {
          return;
        }
        console.warn('[DualStorage] Backend saveTextbookUnit failed, queuing for retry:', error);
        this.addOfflineQueueItem({
          id: `textbook-${unit.id}-${createEventId('retry')}`,
          type: 'textbookUnit',
          data: { learnerId, unit },
          syncOwnerId: principal.syncOwnerId,
        }, '[DualStorage] Textbook retry envelope could not be persisted.');
      });
    } else if (this.config.useBackend) {
      this.addOfflineQueueItem({
        id: `textbook-${unit.id}-${createEventId('retry')}`,
        type: 'textbookUnit',
        data: { learnerId, unit },
        ...(principal ? { syncOwnerId: principal.syncOwnerId } : {}),
      }, '[DualStorage] Textbook retry envelope could not be persisted.');
    }

    return localResult;
  }

  async saveTextbookUnitCritical(
    learnerId: string,
    unit: InstructionalUnit,
  ): Promise<{ result: SaveTextbookUnitResult; status: CriticalWriteStatus }> {
    const result = localStorageManager.saveTextbookUnit(learnerId, unit);
    if (result.success === false) {
      return {
        result,
        status: {
          backendConfirmed: false,
          pendingSync: false,
          error: result.quotaExceeded
            ? 'Failed to save locally: browser storage quota exceeded.'
            : 'Failed to save locally.',
        },
      };
    }

    if (!this.config.useBackend) {
      return { result, status: { backendConfirmed: true, pendingSync: false } };
    }

    const principal = getActiveSyncPrincipal();
    const queueId = `textbook-${unit.id}-${createEventId('retry')}`;
    const queuePersisted = this.offlineQueue.add({
      id: queueId,
      type: 'textbookUnit',
      data: { learnerId, unit },
      ...(principal ? { syncOwnerId: principal.syncOwnerId } : {}),
    });
    if (!queuePersisted) {
      return {
        result,
        status: {
          backendConfirmed: false,
          pendingSync: false,
          error: 'Saved locally, but the durable retry envelope could not be persisted.',
        },
      };
    }
    if (!principal) {
      return {
        result,
        status: {
          backendConfirmed: false,
          pendingSync: true,
          error: 'Saved locally. Authentication is not active; queued for sync.',
        },
      };
    }

    const healthy = await this.checkHealth();
    if (!isActiveSyncPrincipal(principal)) {
      return {
        result,
        status: {
          backendConfirmed: false,
          pendingSync: true,
          error: 'Saved locally. Authenticated account changed before backend sync.',
        },
      };
    }
    if (!healthy) {
      return {
        result,
        status: {
          backendConfirmed: false,
          pendingSync: true,
          error: 'Saved locally. Backend unavailable; queued for sync.',
        },
      };
    }

    try {
      const backendSuccess = await storageClient.saveTextbookUnit(learnerId, unit);
      if (!isActiveSyncPrincipal(principal)) {
        return {
          result,
          status: {
            backendConfirmed: false,
            pendingSync: true,
            error: 'Saved locally. Authenticated account changed during backend sync.',
          },
        };
      }
      if (backendSuccess) {
        const proofPersisted = this.offlineQueue.remove(queueId, principal.syncOwnerId);
        return {
          result,
          status: proofPersisted
            ? { backendConfirmed: true, pendingSync: false }
            : {
                backendConfirmed: true,
                pendingSync: true,
                error: 'Backend confirmed, but local confirmation proof could not be persisted.',
              },
        };
      }
      return {
        result,
        status: {
          backendConfirmed: false,
          pendingSync: true,
          error: 'Saved locally. Backend did not confirm; queued for retry.',
        },
      };
    } catch (error) {
      if (!isActiveSyncPrincipal(principal)) {
        return {
          result,
          status: {
            backendConfirmed: false,
            pendingSync: true,
            error: 'Saved locally. Authenticated account changed during backend sync.',
          },
        };
      }
      console.warn('[DualStorage] saveTextbookUnitCritical backend failure, queued:', error);
      return {
        result,
        status: {
          backendConfirmed: false,
          pendingSync: true,
          error: 'Saved locally. Backend request failed; queued for retry.',
        },
      };
    }
  }

  saveTextbookUnitV2(
    learnerId: string,
    input: CreateUnitInput,
    problemId?: string,
    useCompetition = true
  ): SaveTextbookUnitResult & { action: 'created' | 'updated'; why: string; competitionResult?: unknown } {
    // First, save to localStorage (this handles deduplication/competition) - synchronous
    const localResult = localStorageManager.saveTextbookUnitV2(learnerId, input, problemId, useCompetition);
    const principal = getActiveSyncPrincipal();
    const unit: InstructionalUnit = {
      id: localResult.unit.id,
      type: localResult.unit.type,
      conceptId: localResult.unit.conceptId,
      conceptIds: localResult.unit.conceptIds,
      title: localResult.unit.title,
      content: localResult.unit.content,
      contentFormat: localResult.unit.contentFormat,
      sourceInteractionIds: localResult.unit.sourceInteractionIds,
      provenance: localResult.unit.provenance,
      status: localResult.unit.status,
      prerequisites: localResult.unit.prerequisites,
      addedTimestamp: localResult.unit.addedTimestamp,
    };

    // Then sync to backend - async in background
    if (principal && this.shouldUseBackend()) {
      storageClient.saveTextbookUnit(learnerId, unit).then(backendSuccess => {
        if (!isActiveSyncPrincipal(principal)) {
          return;
        }
        if (!backendSuccess) {
          this.addOfflineQueueItem({
            id: `textbook-v2-${unit.id}-${createEventId('retry')}`,
            type: 'textbookUnit',
            data: { learnerId, unit },
            syncOwnerId: principal.syncOwnerId,
          }, '[DualStorage] Textbook V2 retry envelope could not be persisted.');
        }
      }).catch(error => {
        if (!isActiveSyncPrincipal(principal)) {
          return;
        }
        console.warn('[DualStorage] Backend saveTextbookUnitV2 failed, queuing for retry:', error);
        this.addOfflineQueueItem({
          id: `textbook-v2-${unit.id}-${createEventId('retry')}`,
          type: 'textbookUnit',
          data: { learnerId, unit },
          syncOwnerId: principal.syncOwnerId,
        }, '[DualStorage] Textbook V2 retry envelope could not be persisted.');
      });
    } else if (this.config.useBackend) {
      this.addOfflineQueueItem({
        id: `textbook-v2-${unit.id}-${createEventId('retry')}`,
        type: 'textbookUnit',
        data: { learnerId, unit },
        ...(principal ? { syncOwnerId: principal.syncOwnerId } : {}),
      }, '[DualStorage] Textbook V2 retry envelope could not be persisted.');
    }
    
    return localResult;
  }

  async saveTextbookUnitV2Critical(
    learnerId: string,
    input: CreateUnitInput,
    problemId?: string,
    useCompetition = true,
  ): Promise<{
    result: SaveTextbookUnitResult & { action: 'created' | 'updated'; why: string; competitionResult?: unknown };
    status: CriticalWriteStatus;
  }> {
    const result = localStorageManager.saveTextbookUnitV2(learnerId, input, problemId, useCompetition);
    const unit: InstructionalUnit = {
      id: result.unit.id,
      type: result.unit.type,
      conceptId: result.unit.conceptId,
      conceptIds: result.unit.conceptIds,
      title: result.unit.title,
      content: result.unit.content,
      contentFormat: result.unit.contentFormat,
      sourceInteractionIds: result.unit.sourceInteractionIds,
      provenance: result.unit.provenance,
      status: result.unit.status,
      prerequisites: result.unit.prerequisites,
      addedTimestamp: result.unit.addedTimestamp,
    };

    const write = await this.saveTextbookUnitCritical(learnerId, unit);
    return { result, status: write.status };
  }

  getTextbook(learnerId: string): InstructionalUnit[] {
    const principal = getActiveSyncPrincipal();
    // Try backend FIRST (primary source of truth) - async in background
    if (principal && this.shouldUseBackend()) {
      storageClient.getTextbook(learnerId).then(backendUnits => {
        if (!isActiveSyncPrincipal(principal)) {
          return;
        }
        if (backendUnits && backendUnits.length > 0) {
          // Sync to localStorage for offline access
          for (const unit of backendUnits) {
            localStorageManager.saveTextbookUnit(learnerId, unit);
          }
        }
      }).catch(error => {
        console.warn('[DualStorage] Backend getTextbook failed, using localStorage:', error);
      });
    }
    
    // Always return localStorage data immediately (synchronous)
    return localStorageManager.getTextbook(learnerId);
  }

  // ============================================================================
  // Session Operations
  // ============================================================================

  startSession(learnerId: string): string {
    const sessionId = localStorageManager.startSession(learnerId);
    const principal = getActiveSyncPrincipal();
    const sessionData = {
      sessionId,
      startTime: new Date().toISOString(),
      lastActivity: new Date().toISOString(),
    };

    if (principal && this.shouldUseBackend()) {
      try {
        storageClient.saveSession(learnerId, sessionData).catch(err => {
          if (!isActiveSyncPrincipal(principal)) {
            return;
          }
          console.warn('[DualStorage] Failed to sync session to backend, queuing:', err);
          this.addOfflineQueueItem({
            id: `session-${learnerId}-${createEventId('retry')}`,
            type: 'session',
            data: { learnerId, data: sessionData },
            syncOwnerId: principal.syncOwnerId,
          }, '[DualStorage] Session retry envelope could not be persisted.');
        });
      } catch (error) {
        console.warn('[DualStorage] Backend startSession failed:', error);
      }
    } else if (this.config.useBackend) {
      this.addOfflineQueueItem({
        id: `session-${learnerId}-${createEventId('retry')}`,
        type: 'session',
        data: { learnerId, data: sessionData },
        ...(principal ? { syncOwnerId: principal.syncOwnerId } : {}),
      }, '[DualStorage] Session retry envelope could not be persisted.');
    }
    
    return sessionId;
  }

  async ensureSessionPersisted(learnerId: string, sessionId: string): Promise<CriticalWriteStatus> {
    if (!this.config.useBackend) {
      return { backendConfirmed: true, pendingSync: false };
    }
    const principal = getActiveSyncPrincipal();
    const sessionData = {
      sessionId,
      startTime: new Date().toISOString(),
      lastActivity: new Date().toISOString(),
    };
    const queueId = `session-${learnerId}-${createEventId('retry')}`;
    const queuePersisted = this.offlineQueue.add({
      id: queueId,
      type: 'session',
      data: { learnerId, data: sessionData },
      ...(principal ? { syncOwnerId: principal.syncOwnerId } : {}),
    });
    if (!queuePersisted) {
      return {
        backendConfirmed: false,
        pendingSync: false,
        error: 'Session remains local, but the durable retry envelope could not be persisted.',
      };
    }
    if (!principal) {
      return {
        backendConfirmed: false,
        pendingSync: true,
        error: 'Session started locally. Authentication is not active; queued for sync.',
      };
    }
    const healthy = await this.checkHealth();
    if (!isActiveSyncPrincipal(principal)) {
      return {
        backendConfirmed: false,
        pendingSync: true,
        error: 'Session started locally. Authenticated account changed before backend sync.',
      };
    }
    if (!healthy) {
      return {
        backendConfirmed: false,
        pendingSync: true,
        error: 'Session started locally. Backend unavailable; queued for sync.',
      };
    }
    try {
      const success = await storageClient.saveSession(learnerId, sessionData);
      if (!isActiveSyncPrincipal(principal)) {
        return {
          backendConfirmed: false,
          pendingSync: true,
          error: 'Session saved locally. Authenticated account changed during backend sync.',
        };
      }
      if (success) {
        const proofPersisted = this.offlineQueue.remove(queueId, principal.syncOwnerId);
        return proofPersisted
          ? { backendConfirmed: true, pendingSync: false }
          : {
              backendConfirmed: true,
              pendingSync: true,
              error: 'Backend confirmed, but local confirmation proof could not be persisted.',
            };
      }
      return {
        backendConfirmed: false,
        pendingSync: true,
        error: 'Session saved locally. Backend did not confirm; queued for retry.',
      };
    } catch (error) {
      if (!isActiveSyncPrincipal(principal)) {
        return {
          backendConfirmed: false,
          pendingSync: true,
          error: 'Session saved locally. Authenticated account changed during backend sync.',
        };
      }
      console.warn('[DualStorage] ensureSessionPersisted backend failure, queued:', error);
      return {
        backendConfirmed: false,
        pendingSync: true,
        error: 'Session saved locally. Backend request failed; queued for retry.',
      };
    }
  }

  async ensureSessionInteractionsPersisted(
    learnerId: string,
    sessionId: string,
  ): Promise<CriticalWriteStatus & { missingInteractionIds?: string[] }> {
    if (!this.config.useBackend) {
      return { backendConfirmed: true, pendingSync: false, missingInteractionIds: [] };
    }

    const principal = getActiveSyncPrincipal();
    if (!principal) {
      return {
        backendConfirmed: false,
        pendingSync: true,
        error: 'Authentication is not active. Session interactions remain local.',
      };
    }

    const healthy = await this.checkHealth();
    if (!healthy || !isActiveSyncPrincipal(principal)) {
      return {
        backendConfirmed: false,
        pendingSync: true,
        error: 'Backend unavailable. Cannot confirm session interaction sync.',
      };
    }

    await this.offlineQueue.processQueue();
    if (!isActiveSyncPrincipal(principal)) {
      return {
        backendConfirmed: false,
        pendingSync: true,
        error: 'Authenticated account changed during interaction reconciliation.',
      };
    }

    const sessionCandidates = localStorageManager
      .getInteractionsByLearner(learnerId)
      .filter((interaction) => interaction.sessionId === sessionId);
    const idCounts = new Map<string, number>();
    for (const interaction of sessionCandidates) {
      idCounts.set(interaction.id, (idCounts.get(interaction.id) ?? 0) + 1);
    }
    const localSessionInteractions: InteractionEvent[] = [];
    const unverifiedCandidates: InteractionEvent[] = [];
    for (const interaction of sessionCandidates) {
      const hasUniqueId = idCounts.get(interaction.id) === 1;
      const hasExactPending = hasUniqueId &&
        this.pendingStore.hasExactPendingEventForActivePrincipal(interaction);
      const hasExactConfirmed = hasUniqueId &&
        this.pendingStore.hasExactConfirmedEventForActivePrincipal(interaction);
      if (hasExactPending || hasExactConfirmed) {
        localSessionInteractions.push(interaction);
      } else {
        unverifiedCandidates.push(interaction);
      }
    }
    if (unverifiedCandidates.length > 0) {
      return {
        backendConfirmed: false,
        pendingSync: true,
        error: 'No exact active-account envelope evidence matches some local session interactions.',
        missingInteractionIds: unverifiedCandidates.map((interaction) => interaction.id),
      };
    }
    if (localSessionInteractions.length === 0) {
      return { backendConfirmed: true, pendingSync: false, missingInteractionIds: [] };
    }

    const backendSnapshot = await storageClient.getInteractions(learnerId, { sessionId, limit: 5000 });
    if (!isActiveSyncPrincipal(principal)) {
      return {
        backendConfirmed: false,
        pendingSync: true,
        error: 'Authenticated account changed during interaction reconciliation.',
      };
    }
    const backendIds = new Set(backendSnapshot.events.map((interaction) => interaction.id));
    const missingInteractions = localSessionInteractions.filter((interaction) => !backendIds.has(interaction.id));

    if (missingInteractions.length === 0) {
      return { backendConfirmed: true, pendingSync: false, missingInteractionIds: [] };
    }

    try {
      const batchSuccess = await storageClient.logInteractionsBatch(missingInteractions);
      if (!isActiveSyncPrincipal(principal)) {
        return {
          backendConfirmed: false,
          pendingSync: true,
          error: 'Authenticated account changed during interaction reconciliation.',
          missingInteractionIds: missingInteractions.map((interaction) => interaction.id),
        };
      }
      if (!batchSuccess) {
        for (const interaction of missingInteractions) {
          this.queueInteractionForRetry(interaction, principal.syncOwnerId);
        }
        return {
          backendConfirmed: false,
          pendingSync: true,
          error: 'Some interactions are still pending backend sync.',
          missingInteractionIds: missingInteractions.map((interaction) => interaction.id),
        };
      }
    } catch (error) {
      console.warn('[DualStorage] ensureSessionInteractionsPersisted batch sync failed:', error);
      if (!isActiveSyncPrincipal(principal)) {
        return {
          backendConfirmed: false,
          pendingSync: true,
          error: 'Authenticated account changed during interaction reconciliation.',
          missingInteractionIds: missingInteractions.map((interaction) => interaction.id),
        };
      }
      for (const interaction of missingInteractions) {
        this.queueInteractionForRetry(interaction, principal.syncOwnerId);
      }
      return {
        backendConfirmed: false,
        pendingSync: true,
        error: 'Interaction sync request failed; queued for retry.',
        missingInteractionIds: missingInteractions.map((interaction) => interaction.id),
      };
    }

    const verification = await storageClient.getInteractions(learnerId, { sessionId, limit: 5000 });
    if (!isActiveSyncPrincipal(principal)) {
      return {
        backendConfirmed: false,
        pendingSync: true,
        error: 'Authenticated account changed during interaction reconciliation.',
        missingInteractionIds: missingInteractions.map((interaction) => interaction.id),
      };
    }
    const verifiedIds = new Set(verification.events.map((interaction) => interaction.id));
    const stillMissing = localSessionInteractions
      .filter((interaction) => !verifiedIds.has(interaction.id))
      .map((interaction) => interaction.id);

    if (stillMissing.length > 0) {
      return {
        backendConfirmed: false,
        pendingSync: true,
        error: 'Backend verification failed for some interactions.',
        missingInteractionIds: stillMissing,
      };
    }

    return { backendConfirmed: true, pendingSync: false, missingInteractionIds: [] };
  }

  queueSessionEnd(event: InteractionEvent): { success: boolean; quotaExceeded?: boolean } {
    if (!isStoredInteractionEvent(event) || event.eventType !== 'session_end') {
      return { success: false };
    }

    const principal = getActiveSyncPrincipal();
    const stored = readPendingSessionEndCollection();
    if (!stored.validRoot) return { success: false };
    const pending = [...stored.pending];
    const key = this.pendingSessionEndKey(event, principal?.syncOwnerId);
    if (stored.unverified.some((record) => {
      if (!isRecord(record)) return false;
      if (record.key !== key && (!isRecord(record.event) || record.event.id !== event.id)) return false;
      if (!Object.prototype.hasOwnProperty.call(record, 'syncOwnerId')) return true;
      return record.syncOwnerId === principal?.syncOwnerId;
    })) return { success: false };
    const existingIndex = pending.findIndex((item) => item.key === key);
    const existing = existingIndex >= 0 ? pending[existingIndex] : undefined;
    const item: PendingSessionEnd = {
      key,
      event,
      queuedAt: existing?.queuedAt ?? Date.now(),
      lastAttemptAt: existing?.lastAttemptAt,
      ...ownerFields(principal),
    };

    if (existingIndex >= 0) {
      pending[existingIndex] = item;
    } else {
      pending.push(item);
    }

    return this.writePendingSessionEnds(pending, stored.unverified);
  }

  async flushPendingSessionEnds(): Promise<CriticalWriteStatus> {
    if (!this.config.useBackend) {
      return { backendConfirmed: true, pendingSync: false };
    }

    const principal = getActiveSyncPrincipal();
    if (!principal) {
      const stored = readPendingSessionEndCollection();
      return {
        backendConfirmed: false,
        pendingSync: !stored.validRoot || stored.pending.length > 0 || stored.unverified.length > 0,
        error: 'Authentication is not active. Pending session ends remain local.',
      };
    }

    const pending = this.readEligiblePendingSessionEnds();
    if (this.pendingSessionEndClaimFailed) {
      return {
        backendConfirmed: false,
        pendingSync: true,
        error: 'Pending session-end ownership could not be persisted; data remains local.',
      };
    }
    if (pending.length === 0) {
      return { backendConfirmed: true, pendingSync: false };
    }

    let firstFailure: CriticalWriteStatus | undefined;
    for (const item of pending) {
      const status = await this.writeQueuedSessionEnd(item);
      if (!status.backendConfirmed && !firstFailure) {
        firstFailure = status;
      }
    }

    return firstFailure ?? { backendConfirmed: true, pendingSync: false };
  }

  async emitSessionEnd(event: InteractionEvent): Promise<CriticalWriteStatus> {
    if (!event.sessionId) {
      return {
        backendConfirmed: false,
        pendingSync: false,
        error: 'Missing sessionId for session_end event.',
      };
    }

    if (!this.config.useBackend) {
      const localResult = localStorageManager.saveInteraction(event);
      if (!localResult.success) {
        return {
          backendConfirmed: false,
          pendingSync: false,
          error: localResult.quotaExceeded
            ? 'Failed to save session_end locally: browser storage quota exceeded.'
            : 'Failed to save session_end locally.',
        };
      }
      return { backendConfirmed: true, pendingSync: false };
    }

    const queueResult = this.queueSessionEnd(event);
    if (!queueResult.success) {
      return {
        backendConfirmed: false,
        pendingSync: false,
        error: queueResult.quotaExceeded
          ? 'Failed to queue session_end locally: browser storage quota exceeded.'
          : 'Failed to queue session_end locally.',
      };
    }

    const principal = getActiveSyncPrincipal();
    if (!principal) {
      return {
        backendConfirmed: false,
        pendingSync: true,
        error: 'Saved locally. Authentication is not active; queued for sync.',
      };
    }

    const queued = this.readEligiblePendingSessionEnds().find(
      (item) => item.event.id === event.id && item.syncOwnerId === principal.syncOwnerId,
    );
    return queued
      ? this.writeQueuedSessionEnd(queued)
      : { backendConfirmed: false, pendingSync: true, error: 'Session end remains queued locally.' };
  }

  /**
   * Flush with keepalive for pagehide/logout scenarios
   * RESEARCH-3: Ensures data is sent even when tab closes
   * RESEARCH-1: Includes CSRF token for Neon auth+CSRF routes
   * Only marks events confirmed when confirmed by backend ID
   */
  async flushWithKeepalive(sessionId: string): Promise<CriticalWriteStatus> {
    if (!this.config.useBackend) {
      return { backendConfirmed: true, pendingSync: false };
    }

    const principal = getActiveSyncPrincipal();
    if (!principal) {
      return {
        backendConfirmed: false,
        pendingSync: true,
        error: 'Authentication is not active. Keepalive data remains local.',
      };
    }

    if (import.meta.env.DEV) {
      console.info('[telemetry_pagehide_flush_started]', { 
        sessionId,
        contractVersion: RESEARCH_CONTRACT_VERSION 
      });
    }

    // RESEARCH-1: Get ALL pending interactions from durable pending store
    // This includes both newly created events and retry queue items
    const pendingInteractions = this.pendingStore.getPendingForSession(sessionId);
    if (this.pendingStore.didLastClaimPersistenceFail()) {
      return {
        backendConfirmed: false,
        pendingSync: true,
        error: 'Pending interaction ownership could not be persisted; data remains local.',
      };
    }
    const events = pendingInteractions.map(p => p.event);

    // Also include retry queue items that might not be in pending store
    const retryQueueItems = this.offlineQueue.getAllUnconfirmed().filter(
      item => item.type === 'interaction' && (item.data as InteractionEvent).sessionId === sessionId
    );
    if (this.offlineQueue.didLastClaimPersistenceFail()) {
      return {
        backendConfirmed: false,
        pendingSync: true,
        error: 'Offline queue ownership could not be persisted; data remains local.',
      };
    }
    const retryEvents = retryQueueItems.map(item => item.data as InteractionEvent);

    // Merge and deduplicate by event ID
    const eventMap = new Map<string, InteractionEvent>();
    for (const event of [...events, ...retryEvents]) {
      eventMap.set(event.id, event);
    }
    const allEvents = Array.from(eventMap.values());

    // Send batch with keepalive and track confirmed IDs
    let flushResult: { success: boolean; confirmedIds?: string[] } = { success: allEvents.length === 0, confirmedIds: [] };
    if (allEvents.length > 0) {
      flushResult = await storageClient.logInteractionsBatchKeepalive(allEvents);
      if (!isActiveSyncPrincipal(principal)) {
        return {
          backendConfirmed: false,
          pendingSync: true,
          error: 'Authenticated account changed during keepalive flush.',
        };
      }
      
      // Only mark confirmed events as confirmed (not all events)
      if (flushResult.success && flushResult.confirmedIds) {
        for (const confirmedId of flushResult.confirmedIds) {
          this.pendingStore.markConfirmedInteraction(confirmedId, principal.syncOwnerId);
        }
      }
    }

    // Flush pending session_ends only if interactions were confirmed
    const pendingSessionEnds = this.readEligiblePendingSessionEnds().filter(
      item => item.event.sessionId === sessionId
    );
    if (this.pendingSessionEndClaimFailed) {
      return {
        backendConfirmed: false,
        pendingSync: true,
        error: 'Pending session-end ownership could not be persisted; data remains local.',
      };
    }

    const confirmedInteractionIds = new Set(flushResult.confirmedIds ?? []);
    const interactionsConfirmed = allEvents.length === 0 || (
      flushResult.success && allEvents.every(event => confirmedInteractionIds.has(event.id))
    );
    const confirmedSessionEndIds: string[] = [];
    let sessionEndFlushComplete = true;

    if (interactionsConfirmed) {
      for (const item of pendingSessionEnds) {
        const sessionEndResult = await storageClient.logInteractionsBatchKeepalive([item.event]);
        if (!isActiveSyncPrincipal(principal)) {
          return {
            backendConfirmed: false,
            pendingSync: true,
            error: 'Authenticated account changed during session-end keepalive flush.',
          };
        }
        if (sessionEndResult.success && sessionEndResult.confirmedIds?.includes(item.event.id)) {
          if (this.removePendingSessionEnd(item)) {
            confirmedSessionEndIds.push(item.event.id);
          } else {
            sessionEndFlushComplete = false;
          }
        } else {
          sessionEndFlushComplete = false;
        }
      }
    } else if (pendingSessionEnds.length > 0) {
      sessionEndFlushComplete = false;
    }

    const allConfirmed = interactionsConfirmed && sessionEndFlushComplete;

    const result: CriticalWriteStatus = allConfirmed
      ? { backendConfirmed: true, pendingSync: false }
      : { backendConfirmed: false, pendingSync: true, error: 'Keepalive flush incomplete' };

    if (import.meta.env.DEV) {
      console.info(
        allConfirmed 
          ? '[telemetry_pagehide_flush_confirmed]' 
          : '[telemetry_pagehide_flush_pending]',
        { 
          sessionId, 
          eventCount: allEvents.length,
          confirmedCount: flushResult.confirmedIds?.length || 0,
          pendingSessionEndCount: Math.max(0, pendingSessionEnds.length - confirmedSessionEndIds.length),
          reason: allConfirmed ? undefined : 'partial_confirmation'
        }
      );
    }

    return result;
  }

  /**
   * RESEARCH-2: Flush pending interactions with verification before session_end
   * Ensures all session interactions are confirmed before sending session_end
   */
  async flushPendingWithVerification(sessionId: string): Promise<{
    interactionsFlushed: number;
    interactionsConfirmed: number;
    sessionEndSent: boolean;
    sessionEndConfirmed: boolean;
    error?: string;
  }> {
    const result: {
      interactionsFlushed: number;
      interactionsConfirmed: number;
      sessionEndSent: boolean;
      sessionEndConfirmed: boolean;
      error?: string;
    } = {
      interactionsFlushed: 0,
      interactionsConfirmed: 0,
      sessionEndSent: false,
      sessionEndConfirmed: false,
    };

    if (!this.config.useBackend) {
      return result;
    }

    const principal = getActiveSyncPrincipal();
    if (!principal) {
      result.error = 'Authentication is not active; pending data remains local';
      return result;
    }

    // Step 1: Get all pending interactions for this session
    const pendingInteractions = this.pendingStore.getPendingForSession(sessionId);
    if (this.pendingStore.didLastClaimPersistenceFail()) {
      result.error = 'Pending interaction ownership could not be persisted; data remains local';
      return result;
    }
    const events = pendingInteractions.map(p => p.event);

    if (events.length > 0) {
      result.interactionsFlushed = events.length;
      
      // Step 2: Send via keepalive batch
      const keepaliveSuccess = await storageClient.logInteractionsBatchKeepalive(events);
      if (!isActiveSyncPrincipal(principal)) {
        result.error = 'Authenticated account changed during keepalive verification';
        return result;
      }
      
      if (keepaliveSuccess.success) {
        const confirmed = new Set(keepaliveSuccess.confirmedIds ?? []);
        for (const event of events) {
          if (confirmed.has(event.id)) {
            this.pendingStore.markConfirmedInteraction(event.id, principal.syncOwnerId);
          }
        }
        result.interactionsConfirmed = events.filter(event => confirmed.has(event.id)).length;
        if (result.interactionsConfirmed < events.length) {
          result.error = 'Keepalive flush returned partial confirmation; events remain pending';
          return result;
        }
      } else {
        // Keepalive failed - events remain in pending store for retry
        result.error = 'Keepalive flush failed, events remain pending';
        return result;
      }
    }

    // Step 3: Also process retry queue items for this session
    const retryQueueItems = this.offlineQueue.getAllUnconfirmed().filter(
      item => item.type === 'interaction' && (item.data as InteractionEvent).sessionId === sessionId
    );
    if (this.offlineQueue.didLastClaimPersistenceFail()) {
      result.error = 'Offline queue ownership could not be persisted; data remains local';
      return result;
    }
    
    if (retryQueueItems.length > 0) {
      const retryEvents = retryQueueItems.map(item => item.data as InteractionEvent);
      const retrySuccess = await storageClient.logInteractionsBatchKeepalive(retryEvents);
      if (!isActiveSyncPrincipal(principal)) {
        result.error = 'Authenticated account changed during keepalive retry';
        return result;
      }
      
      if (retrySuccess.success) {
        const confirmed = new Set(retrySuccess.confirmedIds ?? []);
        for (const item of retryQueueItems) {
          if (confirmed.has(item.id)) {
            this.pendingStore.markConfirmedInteraction(item.id, principal.syncOwnerId);
          }
        }
      }
    }

    // Step 4: Check if there are still pending interactions
    const remainingPending = this.pendingStore.getPendingForSession(sessionId);
    if (this.pendingStore.didLastClaimPersistenceFail()) {
      result.error = 'Pending interaction ownership could not be persisted; data remains local';
      return result;
    }
    if (remainingPending.length > 0) {
      result.error = `${remainingPending.length} interactions still pending after flush`;
      return result;
    }

    return result;
  }

  private async writeQueuedSessionEnd(item: PendingSessionEnd): Promise<CriticalWriteStatus> {
    const event = item.event;
    const principal = getActiveSyncPrincipal();
    if (!principal || item.syncOwnerId !== principal.syncOwnerId) {
      return {
        backendConfirmed: false,
        pendingSync: true,
        error: 'Pending session end belongs to another or unverified account.',
      };
    }
    if (!event.sessionId) {
      const removed = this.removePendingSessionEnd(item);
      return {
        backendConfirmed: false,
        pendingSync: !removed,
        error: 'Missing sessionId for queued session_end event.',
      };
    }

    this.markPendingSessionEndAttempt(item);

    const syncStatus = await this.ensureSessionInteractionsPersisted(event.learnerId, event.sessionId);
    if (!isActiveSyncPrincipal(principal)) {
      return {
        backendConfirmed: false,
        pendingSync: true,
        error: 'Authenticated account changed while reconciling session interactions.',
      };
    }
    if (!syncStatus.backendConfirmed) {
      return {
        backendConfirmed: false,
        pendingSync: true,
        error: syncStatus.error || 'Session interactions are not fully synced to backend.',
      };
    }

    const healthy = await this.checkHealth();
    if (!healthy || !isActiveSyncPrincipal(principal)) {
      return {
        backendConfirmed: false,
        pendingSync: true,
        error: 'Session interactions synced, but backend became unavailable before session_end.',
      };
    }

    try {
      const backendSuccess = await storageClient.logInteraction(event);
      if (!isActiveSyncPrincipal(principal)) {
        return {
          backendConfirmed: false,
          pendingSync: true,
          error: 'Authenticated account changed while sending session_end.',
        };
      }
      if (!backendSuccess.success || !backendSuccess.confirmed) {
        return {
          backendConfirmed: false,
          pendingSync: true,
          error: 'Backend did not confirm session_end; kept for retry.',
        };
      }
      localStorageManager.saveInteraction(event);
      const removed = this.removePendingSessionEnd(item);
      return removed
        ? { backendConfirmed: true, pendingSync: false }
        : {
            backendConfirmed: true,
            pendingSync: true,
            error: 'Backend confirmed session_end, but the local pending record could not be cleared.',
          };
    } catch (error) {
      console.warn('[DualStorage] emitSessionEnd backend failure, kept for retry:', error);
      return {
        backendConfirmed: false,
        pendingSync: true,
        error: 'Session_end request failed; kept for retry.',
      };
    }
  }

  /**
   * RESEARCH-4: Finalize active session before logout with backend confirmation barrier.
   * Computes session_end from local evidence, ensures all interactions are synced,
   * then writes session_end through the verified barrier. Blocks logout if confirmation fails.
   */
  async finalizeActiveSessionBeforeLogout(learnerId: string): Promise<CriticalWriteStatus> {
    // 1. Resolve active session ID
    let sessionId = localStorageManager.getActiveSessionId();
    const allInteractions = localStorageManager.getInteractionsByLearner(learnerId);

    if (!sessionId || sessionId === 'session-unknown') {
      const recoveredSessionId = [...allInteractions]
        .sort((a, b) => b.timestamp - a.timestamp)
        .find((interaction) => interaction.sessionId && interaction.sessionId !== 'session-unknown')
        ?.sessionId;
      if (!recoveredSessionId) {
        return { backendConfirmed: true, pendingSync: false };
      }
      sessionId = recoveredSessionId;
      localStorageManager.setActiveSessionId(recoveredSessionId);
    }

    // 2. Read local interactions for this session
    const sessionInteractions = allInteractions.filter(i => i.sessionId === sessionId);

    // 3. If no interactions exist, nothing to finalize
    if (sessionInteractions.length === 0) {
      return { backendConfirmed: true, pendingSync: false };
    }

    // 4. Compute canonical session_end summary from local evidence
    const sortedInteractions = [...sessionInteractions].sort((a, b) => a.timestamp - b.timestamp);
    const firstInteraction = sortedInteractions[0];
    const lastInteraction = sortedInteractions[sortedInteractions.length - 1];

    // totalTime: now - first interaction timestamp (use session start if available)
    const sessionStartTime = firstInteraction.timestamp;
    const totalTime = Math.max(0, Date.now() - sessionStartTime);

    // problemsAttempted: unique problem IDs with execution/error/hint_view/explanation_view/guidance_view
    const attemptedProblemIds = new Set(
      sessionInteractions
        .filter(i => ['execution', 'error', 'hint_view', 'explanation_view', 'guidance_view'].includes(i.eventType))
        .map(i => i.problemId)
    );
    const problemsAttempted = attemptedProblemIds.size;

    // problemsSolved: unique problem IDs with successful execution
    const solvedProblemIds = new Set(
      sessionInteractions
        .filter(i => i.eventType === 'execution' && i.successful === true)
        .map(i => i.problemId)
    );
    const problemsSolved = solvedProblemIds.size;

    // problemId: use latest session interaction problem ID, fallback 'session-summary'
    const problemId = lastInteraction?.problemId || 'session-summary';

    // 5. Build deterministic session_end event ID (prevents duplicates on retry)
    const eventId = `session-end:${sessionId}`;

    // Check if session_end already exists for this session
    const existingSessionEnd = sessionInteractions.find(i => i.eventType === 'session_end');
    if (existingSessionEnd) {
      // Already finalized, just ensure it's synced
      if (this.config.useBackend) {
        const syncStatus = await this.ensureSessionInteractionsPersisted(learnerId, sessionId);
        if (!syncStatus.backendConfirmed) {
          return {
            backendConfirmed: false,
            pendingSync: true,
            error: 'Session already finalized locally, but not fully synced to backend.',
          };
        }
      }
      return { backendConfirmed: true, pendingSync: false };
    }

    // 6. Build session_end event
    const sessionEndEvent: InteractionEvent = {
      id: eventId,
      sessionId,
      learnerId,
      timestamp: Date.now(),
      eventType: 'session_end',
      problemId,
      totalTime,
      timeSpent: totalTime,
      problemsAttempted,
      problemsSolved,
    };

    // 7. Call emitSessionEnd for the backend verification barrier
    return this.emitSessionEnd(sessionEndEvent);
  }

  private pendingSessionEndKey(event: InteractionEvent, syncOwnerId?: string): string {
    const baseKey = event.sessionId ? `${event.learnerId}:${event.sessionId}` : event.id;
    return ownedSyncIdentity(baseKey, syncOwnerId);
  }

  private readPendingSessionEnds(): PendingSessionEnd[] {
    return readPendingSessionEndCollection().pending;
  }

  private readEligiblePendingSessionEnds(): PendingSessionEnd[] {
    this.pendingSessionEndClaimFailed = false;
    const stored = readPendingSessionEndCollection();
    if (!stored.validRoot) {
      this.pendingSessionEndClaimFailed = true;
      return [];
    }
    const pending = stored.pending;
    const staged = [...pending];
    const eligible: PendingSessionEnd[] = [];
    const claimed: PendingSessionEnd[] = [];
    const principal = getActiveSyncPrincipal();
    if (principal && stored.unverified.some((record) => {
      if (!isRecord(record)) return false;
      if (Object.prototype.hasOwnProperty.call(record, 'syncOwnerId')) {
        return record.syncOwnerId === principal.syncOwnerId;
      }
      return isRecord(record.event) && record.event.learnerId === principal.learnerId;
    })) {
      this.pendingSessionEndClaimFailed = true;
      return [];
    }
    pending.forEach((item, index) => {
      const ownership = resolveEnvelopeOwnershipForActivePrincipal(item, item.event.learnerId);
      if (ownership.eligible) {
        eligible.push(item);
      } else if (ownership.claimOwnerId) {
        const claimedItem = {
          ...item,
          syncOwnerId: ownership.claimOwnerId,
          key: this.pendingSessionEndKey(item.event, ownership.claimOwnerId),
        };
        staged[index] = claimedItem;
        claimed.push(claimedItem);
      }
    });

    if (claimed.length > 0) {
      let persisted = false;
      try {
        persisted = this.writePendingSessionEnds(staged, stored.unverified).success;
      } catch {
        persisted = false;
      }
      if (persisted) {
        eligible.push(...claimed);
      } else {
        this.pendingSessionEndClaimFailed = true;
      }
    }

    return eligible;
  }

  private writePendingSessionEnds(
    pending: PendingSessionEnd[],
    unverified = readPendingSessionEndCollection().unverified,
  ): SafeSetResult {
    const current = readPendingSessionEndCollection();
    if (!current.validRoot) {
      return { success: false, error: 'Pending session-end storage root is malformed' };
    }
    const records = [...unverified, ...pending];
    try {
      const result = safeSet(PENDING_SESSION_ENDS_KEY, records, {
        priority: 'critical',
        allowEviction: false,
      });
      if (!result.success) return result;
      const persisted = readStoredArray(PENDING_SESSION_ENDS_KEY);
      return persisted.validRoot && JSON.stringify(persisted.records) === JSON.stringify(records)
        ? result
        : { success: false, error: 'Pending session-end write could not be verified' };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Pending session-end write failed',
      };
    }
  }

  private markPendingSessionEndAttempt(item: PendingSessionEnd): boolean {
    const key = item.key;
    const stored = readPendingSessionEndCollection();
    if (!stored.validRoot) return false;
    const pending = [...stored.pending];
    const index = pending.findIndex((item) => item.key === key);
    if (index < 0) return false;
    pending[index] = {
      ...pending[index],
      lastAttemptAt: Date.now(),
    };
    return this.writePendingSessionEnds(pending, stored.unverified).success;
  }

  private removePendingSessionEnd(item: PendingSessionEnd): boolean {
    const key = item.key;
    const stored = readPendingSessionEndCollection();
    if (!stored.validRoot) return false;
    const index = stored.pending.findIndex((candidate) =>
      candidate.key === key &&
      candidate.syncOwnerId === item.syncOwnerId &&
      isExactInteractionEvent(candidate.event, item.event),
    );
    if (index < 0) return false;
    const staged = [...stored.pending];
    staged.splice(index, 1);
    return this.writePendingSessionEnds(staged, stored.unverified).success;
  }

  getActiveSessionId(): string {
    return localStorageManager.getActiveSessionId();
  }

  clearActiveSession(): void {
    const learnerId = this.getCurrentLearnerId();
    localStorageManager.clearActiveSession();
    
    if (learnerId && this.shouldUseBackend()) {
      try {
        storageClient.clearSession(learnerId).catch(err => {
          console.warn('[DualStorage] Failed to clear session on backend:', err);
        });
      } catch (error) {
        console.warn('[DualStorage] Backend clearActiveSession failed:', error);
      }
    }
  }

  // ============================================================================
  // Profile Operations (Full Learner Profile)
  // ============================================================================

  /**
   * Save a learner's full profile to backend and localStorage
   */
  saveProfile(profile: LearnerProfile): void {
    const principal = getActiveSyncPrincipal();
    // Send to backend FIRST (primary source of truth) - async in background
    if (principal && this.shouldUseBackend()) {
      storageClient.saveProfile(profile).then(success => {
        if (!isActiveSyncPrincipal(principal)) {
          return;
        }
        if (!success) {
          this.queueProfileForRetry(
            profile,
            '[DualStorage] Backend saveProfile failed, queued for retry.',
            'full-profile',
            undefined,
            principal.syncOwnerId,
          );
        }
      }).catch(err => {
        if (!isActiveSyncPrincipal(principal)) {
          return;
        }
        this.queueProfileForRetry(
          profile,
          '[DualStorage] Failed to sync profile to backend, queuing.',
          'full-profile',
          err,
          principal.syncOwnerId,
        );
      });
    } else if (this.config.useBackend) {
      this.queueProfileForRetry(
        profile,
        '[DualStorage] Profile kept locally until authenticated backend sync is available.',
        'full-profile',
        undefined,
        principal?.syncOwnerId,
      );
    }
    
    // Always cache in localStorage (synchronous)
    localStorageManager.saveProfile(profile);
  }

  /**
   * Cache a backend-fetched profile locally without mutating backend truth.
   */
  cacheProfile(profile: LearnerProfile): void {
    localStorageManager.saveProfile(profile);
  }

  cacheProfiles(profiles: LearnerProfile[]): void {
    for (const profile of profiles) {
      localStorageManager.saveProfile(profile);
    }
  }

  /**
   * Create and persist a default learner profile.
   * Keeps localStorage creation synchronous, then mirrors to backend when available.
   */
  createDefaultProfile(
    learnerId: string,
    strategy: LearnerProfile['currentStrategy'] = 'adaptive-medium',
  ): LearnerProfile {
    const profile = localStorageManager.createDefaultProfile(learnerId, strategy);
    const principal = getActiveSyncPrincipal();

    if (principal && this.shouldUseBackend()) {
      storageClient.saveProfile(profile).then(success => {
        if (!isActiveSyncPrincipal(principal)) {
          return;
        }
        if (!success) {
          this.queueProfileForRetry(
            profile,
            '[DualStorage] Backend createDefaultProfile failed, queued for retry.',
            'full-profile',
            undefined,
            principal.syncOwnerId,
          );
        }
      }).catch(err => {
        if (!isActiveSyncPrincipal(principal)) {
          return;
        }
        this.queueProfileForRetry(
          profile,
          '[DualStorage] Failed to sync default profile to backend, queuing.',
          'full-profile',
          err,
          principal.syncOwnerId,
        );
      });
    } else if (this.config.useBackend) {
      this.queueProfileForRetry(
        profile,
        '[DualStorage] Default profile kept locally until authenticated backend sync is available.',
        'full-profile',
        undefined,
        principal?.syncOwnerId,
      );
    }

    return profile;
  }

  /**
   * Get a learner's full profile
   * Backend is PRIMARY source of truth (synced in background)
   */
  getProfile(learnerId: string): LearnerProfile | null {
    // Read local cache synchronously. Backend refresh belongs in explicit
    // hydration flows so render paths do not fan out requests.
    return localStorageManager.getProfile(learnerId);
  }

  /**
   * Get all learner profiles (for instructor dashboard)
   */
  getAllProfiles(): LearnerProfile[] {
    return localStorageManager
      .getAllProfiles()
      .map((profile: { id: string }) => localStorageManager.getProfile(profile.id))
      .filter((profile): profile is LearnerProfile => Boolean(profile));
  }

  async hydrateLearner(learnerId: string, options?: { force?: boolean }): Promise<boolean> {
    if (!this.config.useBackend) {
      return false;
    }
    const principal = getActiveSyncPrincipal();
    if (!principal) {
      return false;
    }
    const now = Date.now();
    const hydrationIdentity = ownedSyncIdentity(learnerId, principal.syncOwnerId);
    if (
      !options?.force &&
      this.lastHydratedAt[hydrationIdentity] &&
      now - this.lastHydratedAt[hydrationIdentity] < 3000
    ) {
      return true;
    }

    const healthy = await this.checkHealth();
    if (!healthy || !isActiveSyncPrincipal(principal)) {
      return false;
    }

    const hydrationStart = Date.now();
    
    // Capture pre-hydration state for audit
    const localProfileBefore = localStorageManager.getProfile(learnerId);
    const localInteractionsBefore = localStorageManager.getInteractionsByLearner(learnerId);
    const localTextbookBefore = localStorageManager.getTextbook(learnerId);
    
    const auditContext = {
      learnerId,
      timestamp: hydrationStart,
      localBefore: {
        hadProfile: localProfileBefore !== null,
        solvedProblemCount: localProfileBefore?.solvedProblemIds?.size ?? 0,
        interactionCount: localInteractionsBefore.length,
        textbookUnitCount: localTextbookBefore.length,
      },
    };

    try {
      // Hydrate session/profile first so resumed editor state is available quickly
      // on first render in account mode.
      // RESEARCH-4: Also fetch problem_progress for authoritative solved state
      const [profile, session, problemProgress] = await Promise.all([
        storageClient.getProfile(learnerId),
        storageClient.getSession(learnerId),
        storageClient.getAllProblemProgress(learnerId),
      ]);

      if (!isActiveSyncPrincipal(principal)) {
        return false;
      }

      if (profile) {
        // RESEARCH-4: Use problem_progress as authoritative source for solved state
        // Profile's solvedProblemIds is a cache; problem_progress is durable truth
        const solvedIdsFromProgress = new Set(
          problemProgress
            .filter((p) => p.solved)
            .map((p) => p.problemId)
        );

        // Merge with local to prevent data loss during transition
        const localProfile = localStorageManager.getProfile(learnerId);
        const localSolvedIds = localProfile?.solvedProblemIds || new Set<string>();

        // Authoritative merge: progress table + local + profile cache
        const mergedSolvedIds = new Set<string>([
          ...Array.from(solvedIdsFromProgress),
          ...Array.from(localSolvedIds),
          ...Array.from(profile.solvedProblemIds || []),
        ]);

        // Log merge details for audit
        if (import.meta.env.DEV) {
          console.info('[hydration_profile_merge]', {
            ...auditContext,
            backendSources: {
              fromProgressTable: solvedIdsFromProgress.size,
              fromProfileCache: profile.solvedProblemIds?.size ?? 0,
            },
            localSource: {
              beforeCount: localSolvedIds.size,
            },
            mergeResult: {
              afterCount: mergedSolvedIds.size,
              newProblemsAdded: Math.max(0, mergedSolvedIds.size - Math.max(
                solvedIdsFromProgress.size,
                localSolvedIds.size,
                profile.solvedProblemIds?.size ?? 0
              )),
            },
            preservedFields: [
              'solvedProblemIds (union merge)',
              'conceptsCovered (backend authoritative)',
              'errorHistory (backend authoritative)',
              'conceptCoverageEvidence (backend authoritative)',
            ],
          });
        }

        profile.solvedProblemIds = mergedSolvedIds;
        localStorageManager.saveProfile(profile);
      }

      const hydratedSessionId =
        session?.sessionId?.trim() || localStorageManager.getActiveSessionId();
      const hydratedProblemId = session?.currentProblemId?.trim();

      if (hydratedSessionId) {
        localStorageManager.setActiveSessionId(hydratedSessionId);
      }

      if (
        hydratedSessionId &&
        hydratedProblemId &&
        typeof session?.currentCode === 'string' &&
        session.currentCode.trim().length > 0
      ) {
        localStorageManager.savePracticeDraft(
          learnerId,
          hydratedSessionId,
          hydratedProblemId,
          session.currentCode,
        );
      }

      // Continue heavy sync in background so session restore is deterministic
      // even when interaction/textbook payloads are large.
      void Promise.all([
        storageClient.getInteractions(learnerId, { limit: 5000 }),
        storageClient.getTextbook(learnerId),
      ])
        .then(([interactionsResult, textbookUnits]) => {
          if (!isActiveSyncPrincipal(principal)) {
            return;
          }
          const existing = localStorageManager.getAllInteractions();
          const mergedInteractions = [...existing];
          const exactRecords = new Set(existing.map((item) => JSON.stringify(item)));
          
          // Track merge statistics for audit
          const beforeCount = existing.length;
          let backendNewCount = 0;
          let backendExactDuplicateCount = 0;
          let backendCollisionPreservedCount = 0;
          
          for (const interaction of interactionsResult.events) {
            const serialized = JSON.stringify(interaction);
            if (exactRecords.has(serialized)) {
              backendExactDuplicateCount++;
              continue;
            }
            if (mergedInteractions.some((local) => local.id === interaction.id)) {
              backendCollisionPreservedCount++;
            } else {
              backendNewCount++;
            }
            mergedInteractions.push(interaction);
            exactRecords.add(serialized);
          }
          
          mergedInteractions.sort((a, b) => a.timestamp - b.timestamp);
          
          localStorageManager.importData({
            interactions: mergedInteractions,
            activeSessionId: hydratedSessionId || localStorageManager.getActiveSessionId(),
          });

          // Track textbook merge
          let textbookUnitsAdded = 0;
          for (const unit of textbookUnits) {
            const existingUnits = localStorageManager.getTextbook(learnerId);
            const alreadyExists = existingUnits.some(u => u.id === unit.id);
            localStorageManager.saveTextbookUnit(learnerId, unit);
            if (!alreadyExists) {
              textbookUnitsAdded++;
            }
          }
          
          // Log background sync audit
          if (import.meta.env.DEV) {
            console.info('[hydration_background_sync]', {
              learnerId,
              interactions: {
                localBefore: beforeCount,
                backendReceived: interactionsResult.events.length,
                backendNew: backendNewCount,
                backendExactDuplicates: backendExactDuplicateCount,
                backendCollisionsPreserved: backendCollisionPreservedCount,
                localAfter: mergedInteractions.length,
                mergeStrategy: 'exact_record_dedup_collision_preserving',
              },
              textbook: {
                backendReceived: textbookUnits.length,
                unitsAdded: textbookUnitsAdded,
                mergeStrategy: 'id_based_upsert',
              },
              durationMs: Date.now() - hydrationStart,
            });
          }
        })
        .catch((syncError) => {
          console.warn('[DualStorage] hydrateLearner background sync failed:', syncError);
        });

      // Log immediate hydration completion (background sync continues)
      if (import.meta.env.DEV) {
        console.info('[hydration_immediate_complete]', {
          learnerId,
          durationMs: Date.now() - hydrationStart,
          sessionRestored: !!hydratedSessionId,
          profileHydrated: !!profile,
          backgroundSyncInitiated: true,
        });
      }

      this.lastHydratedAt[hydrationIdentity] = now;
      return true;
    } catch (error) {
      console.error('[DualStorage] hydrateLearner failed:', {
        learnerId,
        error: error instanceof Error ? error.message : 'unknown',
        durationMs: Date.now() - hydrationStart,
      });
      return false;
    }
  }

  /**
   * Fetch active backend session snapshot for restore-critical flows.
   * Returns null when backend mode is disabled, unhealthy, or no session exists.
   */
  async getBackendSessionSnapshot(
    learnerId: string,
  ): Promise<Awaited<ReturnType<typeof storageClient.getSession>>> {
    if (!this.config.useBackend) {
      return null;
    }
    const principal = getActiveSyncPrincipal();
    if (!principal) {
      return null;
    }
    const healthy = await this.checkHealth();
    if (!healthy || !isActiveSyncPrincipal(principal)) {
      return null;
    }
    try {
      const session = await storageClient.getSession(learnerId);
      return isActiveSyncPrincipal(principal) ? session : null;
    } catch (error) {
      console.warn('[DualStorage] getBackendSessionSnapshot failed:', error);
      return null;
    }
  }

  /**
   * Result type for hydrateInstructorDashboard with detailed error information
   */
  async hydrateInstructorDashboard(): Promise<
    | { ok: true; scopeEmpty: boolean; sectionCount: number; learnerCount: number }
    | { ok: false; error: 'auth' | 'backend' | 'scope_empty' | 'network'; message: string }
  > {
    if (!this.config.useBackend) {
      return { ok: false, error: 'backend', message: 'Backend not configured' };
    }
    const principal = getActiveSyncPrincipal();
    if (!principal) {
      return { ok: false, error: 'auth', message: 'Authentication required' };
    }
    
    const healthy = await this.checkHealth();
    if (!healthy || !isActiveSyncPrincipal(principal)) {
      return { ok: false, error: 'network', message: 'Backend health check failed' };
    }

    try {
      const [overview, learners, profiles] = await Promise.all([
        storageClient.getInstructorOverview(),
        storageClient.getInstructorLearners(),
        storageClient.getAllProfiles(),
      ]);
      if (!isActiveSyncPrincipal(principal)) {
        return { ok: false, error: 'auth', message: 'Authenticated account changed during hydration' };
      }

      // Check for auth errors (null/empty responses indicate auth failure)
      if (overview === null && learners.length === 0 && profiles.length === 0) {
        // Check if we have a valid user profile - if so, it's likely an auth issue
        const currentProfile = localStorageManager.getUserProfile();
        if (currentProfile?.role !== 'instructor') {
          return { 
            ok: false, 
            error: 'auth', 
            message: 'Not authenticated as instructor' 
          };
        }
        return { 
          ok: false, 
          error: 'backend', 
          message: 'Failed to fetch instructor data' 
        };
      }

      for (const profile of profiles) {
        localStorageManager.saveProfile(profile);
      }

      const sectionCount = overview?.sections?.length ?? 0;
      const learnerCount = learners.length;
      const scopeEmpty = sectionCount === 0 || learnerCount === 0;

      if (import.meta.env.DEV) {
        console.log('[DualStorage] Instructor dashboard hydrated', {
          sectionCount,
          learnerCount,
          scopeEmpty,
        });
      }
      
      return { 
        ok: true, 
        scopeEmpty, 
        sectionCount, 
        learnerCount 
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.warn('[DualStorage] hydrateInstructorDashboard failed:', error);
      
      // Categorize error type
      if (message.includes('401') || message.includes('Unauthorized')) {
        return { ok: false, error: 'auth', message: 'Authentication required' };
      }
      if (message.includes('403') || message.includes('Forbidden')) {
        return { ok: false, error: 'auth', message: 'Instructor access required' };
      }
      if (message.includes('network') || message.includes('fetch')) {
        return { ok: false, error: 'network', message };
      }
      
      return { ok: false, error: 'backend', message };
    }
  }

  /**
   * Update profile from a single event
   * Sends event to backend which derives the state changes
   */
  updateProfileFromEvent(learnerId: string, event: InteractionEvent): LearnerProfile | null {
    // Update localStorage cache first (synchronous)
    const localProfile = localStorageManager.getProfile(learnerId);
    if (localProfile) {
      localProfile.interactionCount++;
      localProfile.lastActive = Date.now();
      
      if (event.errorSubtypeId) {
        const currentCount = localProfile.errorHistory.get(event.errorSubtypeId) || 0;
        localProfile.errorHistory.set(event.errorSubtypeId, currentCount + 1);
      }
      
      if (event.conceptIds) {
        for (const conceptId of event.conceptIds) {
          localProfile.conceptsCovered.add(conceptId);
        }
      }
      
      localStorageManager.saveProfile(localProfile);
    }
    
    const principal = getActiveSyncPrincipal();
    // Send to backend (primary source of truth) - async in background
    if (principal && this.shouldUseBackend()) {
      storageClient.updateProfileFromEvent(learnerId, event).then((updated) => {
        if (!isActiveSyncPrincipal(principal)) {
          return;
        }
        if (!updated && localProfile) {
          this.queueProfileForRetry(
            localProfile,
            '[DualStorage] Backend profile event update was not confirmed; queued full profile.',
            'profile',
            undefined,
            principal.syncOwnerId,
          );
        }
      }).catch(err => {
        if (!isActiveSyncPrincipal(principal)) {
          return;
        }
        if (localProfile) {
          this.queueProfileForRetry(
            localProfile,
            '[DualStorage] Failed to update profile on backend; queued full profile.',
            'profile',
            err,
            principal.syncOwnerId,
          );
        }
      });
    } else if (this.config.useBackend && localProfile) {
      this.queueProfileForRetry(
        localProfile,
        '[DualStorage] Profile event update kept locally until authenticated backend sync is available.',
        'profile',
        undefined,
        principal?.syncOwnerId,
      );
    }
    
    return localProfile;
  }

  // ============================================================================
  // Export Operations (Instructor Dashboard)
  // ============================================================================

  exportData(options?: { allHistory?: boolean }): {
    interactions: InteractionEvent[];
    profiles: unknown[];
    textbooks: Record<string, InstructionalUnit[]>;
    llmCache: Record<string, unknown>;
    replayMode: boolean;
    pdfIndex: unknown;
    pdfIndexProvenance: unknown;
    activeSessionId: string;
    exportScope: string;
    exportPolicyVersion: string;
    exportedAt: string;
  } {
    // If using backend, try to get all learners' data - async in background
    const principal = getActiveSyncPrincipal();
    if (principal && this.shouldUseBackend()) {
      Promise.all([
        storageClient.getClassStats().catch(() => null),
        storageClient.getAllProfiles().catch(() => []),
      ]).then(([stats, profiles]) => {
        if (!isActiveSyncPrincipal(principal)) {
          return;
        }
        if (stats) {
          if (import.meta.env.DEV) {
            console.log('[DualStorage] Backend stats:', stats);
            console.log('[DualStorage] Backend profiles:', profiles.length);
          }
        }
      }).catch(error => {
        if (!isActiveSyncPrincipal(principal)) {
          return;
        }
        console.warn('[DualStorage] Failed to get backend stats:', error);
      });
    }
    
    return localStorageManager.exportData(options);
  }

  exportAllData(): ReturnType<typeof localStorageManager.exportAllData> {
    return localStorageManager.exportAllData();
  }

  // ============================================================================
  // Logging Operations (Week 5 Events)
  // ============================================================================

  logProfileAssigned(
    learnerId: string,
    profileId: string,
    strategy: 'static' | 'diagnostic' | 'bandit',
    problemId: string,
    reason?: string
  ): void {
    this.syncLatestLocalInteraction(
      learnerId,
      'logProfileAssigned',
      () => localStorageManager.logProfileAssigned(learnerId, profileId, strategy, problemId, reason),
    );
  }

  logEscalationTriggered(
    learnerId: string,
    profileId: string,
    errorCount: number,
    problemId: string,
    reason: string = 'threshold_met',
    timeToEscalationMs?: number
  ): void {
    this.syncLatestLocalInteraction(
      learnerId,
      'logEscalationTriggered',
      () => localStorageManager.logEscalationTriggered(
        learnerId,
        profileId,
        errorCount,
        problemId,
        reason,
        timeToEscalationMs,
      ),
    );
  }

  logBanditArmSelected(params: {
    learnerId: string;
    problemId: string;
    armId: string;
    selectionMethod: 'thompson_sampling' | 'epsilon_greedy' | 'forced';
    armStatsAtSelection?: Record<string, { mean: number; pulls: number }>;
    sessionId?: string;
  }): void {
    this.syncLatestLocalInteraction(
      params.learnerId,
      'logBanditArmSelected',
      () => localStorageManager.logBanditArmSelected(params),
    );
  }

  logBanditRewardObserved(
    learnerId: string,
    armId: string,
    reward: number,
    components: {
      independentSuccess: number;
      errorReduction: number;
      delayedRetention: number;
      dependencyPenalty: number;
      timeEfficiency: number;
    }
  ): void {
    this.syncLatestLocalInteraction(
      learnerId,
      'logBanditRewardObserved',
      () => localStorageManager.logBanditRewardObserved(learnerId, armId, reward, components),
    );
  }

  logHDICalculated(
    learnerId: string,
    hdi: number,
    components: { hpa: number; aed: number; er: number; reae: number; iwh: number },
    problemId: string
  ): void {
    this.syncLatestLocalInteraction(
      learnerId,
      'logHDICalculated',
      () => localStorageManager.logHDICalculated(learnerId, hdi, components, problemId),
    );
  }

  saveCoverageChangeEvent(
    params: Parameters<typeof localStorageManager.saveCoverageChangeEvent>[0],
  ): ReturnType<typeof localStorageManager.saveCoverageChangeEvent> {
    return this.syncLatestLocalInteraction(
      params.learnerId,
      'saveCoverageChangeEvent',
      () => localStorageManager.saveCoverageChangeEvent(params),
    );
  }

  logReinforcementScheduled(
    ...args: Parameters<typeof localStorageManager.logReinforcementScheduled>
  ): ReturnType<typeof localStorageManager.logReinforcementScheduled> {
    return this.syncLatestLocalInteraction(
      args[0],
      'logReinforcementScheduled',
      () => localStorageManager.logReinforcementScheduled(...args),
    );
  }

  logReinforcementPromptShown(
    ...args: Parameters<typeof localStorageManager.logReinforcementPromptShown>
  ): ReturnType<typeof localStorageManager.logReinforcementPromptShown> {
    return this.syncLatestLocalInteraction(
      args[0],
      'logReinforcementPromptShown',
      () => localStorageManager.logReinforcementPromptShown(...args),
    );
  }

  logReinforcementResponse(
    ...args: Parameters<typeof localStorageManager.logReinforcementResponse>
  ): ReturnType<typeof localStorageManager.logReinforcementResponse> {
    return this.syncLatestLocalInteraction(
      args[0],
      'logReinforcementResponse',
      () => localStorageManager.logReinforcementResponse(...args),
    );
  }

  logGuidanceRequest(
    params: Parameters<typeof localStorageManager.logGuidanceRequest>[0],
  ): ReturnType<typeof localStorageManager.logGuidanceRequest> {
    return this.syncLatestLocalInteraction(
      params.learnerId,
      'logGuidanceRequest',
      () => localStorageManager.logGuidanceRequest(params),
    );
  }

  logGuidanceView(
    params: Parameters<typeof localStorageManager.logGuidanceView>[0],
  ): ReturnType<typeof localStorageManager.logGuidanceView> {
    return this.syncLatestLocalInteraction(
      params.learnerId,
      'logGuidanceView',
      () => localStorageManager.logGuidanceView(params),
    );
  }

  logGuidanceEscalate(
    params: Parameters<typeof localStorageManager.logGuidanceEscalate>[0],
  ): ReturnType<typeof localStorageManager.logGuidanceEscalate> {
    return this.syncLatestLocalInteraction(
      params.learnerId,
      'logGuidanceEscalate',
      () => localStorageManager.logGuidanceEscalate(params),
    );
  }

  logTextbookUnitUpsert(
    params: Parameters<typeof localStorageManager.logTextbookUnitUpsert>[0],
  ): ReturnType<typeof localStorageManager.logTextbookUnitUpsert> {
    return this.syncLatestLocalInteraction(
      params.learnerId,
      'logTextbookUnitUpsert',
      () => localStorageManager.logTextbookUnitUpsert(params),
    );
  }

  logSourceView(
    params: Parameters<typeof localStorageManager.logSourceView>[0],
  ): ReturnType<typeof localStorageManager.logSourceView> {
    return this.syncLatestLocalInteraction(
      params.learnerId,
      'logSourceView',
      () => localStorageManager.logSourceView(params),
    );
  }

  logConditionAssigned(
    ...args: Parameters<typeof localStorageManager.logConditionAssigned>
  ): ReturnType<typeof localStorageManager.logConditionAssigned> {
    return this.syncLatestLocalInteraction(
      args[0],
      'logConditionAssigned',
      () => localStorageManager.logConditionAssigned(...args),
    );
  }

  logBanditUpdated(
    ...args: Parameters<typeof localStorageManager.logBanditUpdated>
  ): ReturnType<typeof localStorageManager.logBanditUpdated> {
    return this.syncLatestLocalInteraction(
      args[0],
      'logBanditUpdated',
      () => localStorageManager.logBanditUpdated(...args),
    );
  }

  logHDITrajectoryUpdated(
    ...args: Parameters<typeof localStorageManager.logHDITrajectoryUpdated>
  ): ReturnType<typeof localStorageManager.logHDITrajectoryUpdated> {
    return this.syncLatestLocalInteraction(
      args[0],
      'logHDITrajectoryUpdated',
      () => localStorageManager.logHDITrajectoryUpdated(...args),
    );
  }

  logDependencyInterventionTriggered(
    ...args: Parameters<typeof localStorageManager.logDependencyInterventionTriggered>
  ): ReturnType<typeof localStorageManager.logDependencyInterventionTriggered> {
    return this.syncLatestLocalInteraction(
      args[0],
      'logDependencyInterventionTriggered',
      () => localStorageManager.logDependencyInterventionTriggered(...args),
    );
  }

  logProfileAdjusted(
    ...args: Parameters<typeof localStorageManager.logProfileAdjusted>
  ): ReturnType<typeof localStorageManager.logProfileAdjusted> {
    return this.syncLatestLocalInteraction(
      args[0],
      'logProfileAdjusted',
      () => localStorageManager.logProfileAdjusted(...args),
    );
  }

  // ============================================================================
  // Offline Queue Operations
  // ============================================================================

  /**
   * Get the current offline queue status
   */
  getOfflineQueueStatus(): { pending: number; isProcessing: boolean } {
    return {
      pending: this.offlineQueue.getPending().length,
      isProcessing: false, // Simplified - actual processing state is internal
    };
  }

  /**
   * Manually trigger offline queue processing
   */
  async processOfflineQueue(): Promise<void> {
    await this.offlineQueue.processQueue();
    await this.flushPendingSessionEnds();
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  private shouldUseBackend(): boolean {
    return this.config.useBackend && this.backendHealthy && getActiveSyncPrincipal() !== null;
  }

  private getCurrentLearnerId(): string | null {
    const profile = localStorageManager.getUserProfile();
    return profile?.id || null;
  }

  // ============================================================================
  // Pass-through Methods
  // ============================================================================

  // These methods always use localStorage (no backend equivalent yet)
  getLLMCacheRecord = localStorageManager.getLLMCacheRecord.bind(localStorageManager);
  saveLLMCacheRecord = localStorageManager.saveLLMCacheRecord.bind(localStorageManager);
  getPdfIndex = localStorageManager.getPdfIndex.bind(localStorageManager);
  savePdfIndex = localStorageManager.savePdfIndex.bind(localStorageManager);
  getPolicyReplayMode = localStorageManager.getPolicyReplayMode.bind(localStorageManager);
  setPolicyReplayMode = localStorageManager.setPolicyReplayMode.bind(localStorageManager);
  getReinforcementSchedules = localStorageManager.getReinforcementSchedules.bind(localStorageManager);
  saveReinforcementSchedule = localStorageManager.saveReinforcementSchedule.bind(localStorageManager);
  getCoverageStats = localStorageManager.getCoverageStats.bind(localStorageManager);
  isStudent = localStorageManager.isStudent.bind(localStorageManager);
  isInstructor = localStorageManager.isInstructor.bind(localStorageManager);
  hasRole = localStorageManager.hasRole.bind(localStorageManager);
  clearAll = localStorageManager.clearAll.bind(localStorageManager);
  safeLoadProfile = localStorageManager.safeLoadProfile.bind(localStorageManager);
  
  // Practice drafts
  savePracticeDraft = localStorageManager.savePracticeDraft.bind(localStorageManager);
  getPracticeDraft = localStorageManager.getPracticeDraft.bind(localStorageManager);
  findAnyPracticeDraft = localStorageManager.findAnyPracticeDraft.bind(localStorageManager);
  clearPracticeDraft = localStorageManager.clearPracticeDraft.bind(localStorageManager);
  
  // Session config
  setActiveSessionId = localStorageManager.setActiveSessionId.bind(localStorageManager);
  
  // PDF uploads
  addUploadedPdfFile = localStorageManager.addUploadedPdfFile.bind(localStorageManager);
  getUploadedPdfFiles = localStorageManager.getUploadedPdfFiles.bind(localStorageManager);
  removeUploadedPdfFile = localStorageManager.removeUploadedPdfFile.bind(localStorageManager);
  clearUploadedPdfFiles = localStorageManager.clearUploadedPdfFiles.bind(localStorageManager);
  
  // Trace slice and interactions
  getTraceSlice = localStorageManager.getTraceSlice.bind(localStorageManager);
  getInteractionsByIds = localStorageManager.getInteractionsByIds.bind(localStorageManager);
  clearInteractions = localStorageManager.clearInteractions.bind(localStorageManager);
  getInteractionsByProblem = localStorageManager.getInteractionsByProblem.bind(localStorageManager);
  
  // Textbook helpers
  clearTextbook = localStorageManager.clearTextbook.bind(localStorageManager);
  getLegacyHtmlUnitsInfo = localStorageManager.getLegacyHtmlUnitsInfo.bind(localStorageManager);
  
  // Reinforcement
  updatePromptStatus = localStorageManager.updatePromptStatus.bind(localStorageManager);
  getDuePrompts = localStorageManager.getDuePrompts.bind(localStorageManager);
  
  // Import/Export
  importData = localStorageManager.importData.bind(localStorageManager);
}

// ============================================================================
// Export
// ============================================================================

export const dualStorage = new DualStorageManager();

// Re-export storage client for direct access
export { storageClient, isBackendAvailable, checkBackendHealth };

// Default export uses dual storage
export default dualStorage;
