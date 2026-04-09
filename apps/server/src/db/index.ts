/**
 * Unified Database Layer - Neon PostgreSQL with SQLite Fallback
 *
 * This module provides a unified interface for database operations.
 * It uses Neon PostgreSQL when DATABASE_URL is set, otherwise falls back to SQLite.
 */

import type {
  Learner,
  CreateLearnerRequest,
  UpdateLearnerRequest,
  Interaction,
  CreateInteractionRequest,
  InstructionalUnit,
  CreateUnitRequest,
} from '../types.js';

// ============================================================================
// Research Event Validation (RESEARCH-4) - Shared between SQLite and Neon
// ============================================================================

export interface ValidationResult {
  valid: boolean;
  missing: string[];
}

export interface BatchValidationError {
  eventId: string;
  eventType: string;
  missingFields: string[];
}

export interface BatchValidationResult {
  valid: boolean;
  failedIds: string[];
  errors: BatchValidationError[];
}

export interface ResearchEventInput {
  id?: string;
  eventType?: string;
  [key: string]: unknown;
}

function hasText(value: unknown): boolean {
  return typeof value === 'string' && value.trim() !== '';
}

function hasItems(value: unknown): boolean {
  return Array.isArray(value) && value.length > 0;
}

export function validateResearchEvent(event: ResearchEventInput): ValidationResult {
  const missing: string[] = [];

  switch (event.eventType) {
    case 'hint_view':
      if (!event.hintId || typeof event.hintId !== 'string' || !event.hintId.trim()) missing.push('hintId');
      if (!event.hintText || typeof event.hintText !== 'string' || !event.hintText.trim()) missing.push('hintText');
      if (![1, 2, 3].includes(event.hintLevel as number)) missing.push('hintLevel');
      if (!event.templateId || typeof event.templateId !== 'string' || !event.templateId.trim()) missing.push('templateId');
      if (!event.sqlEngageSubtype || typeof event.sqlEngageSubtype !== 'string' || !event.sqlEngageSubtype.trim()) missing.push('sqlEngageSubtype');
      if (!event.sqlEngageRowId || typeof event.sqlEngageRowId !== 'string' || !event.sqlEngageRowId.trim()) missing.push('sqlEngageRowId');
      if (!event.policyVersion || typeof event.policyVersion !== 'string' || !event.policyVersion.trim()) missing.push('policyVersion');
      if (typeof event.helpRequestIndex !== 'number' || event.helpRequestIndex < 1) {
        missing.push('helpRequestIndex');
      }
      break;

    case 'concept_view':
      if (!event.conceptId || typeof event.conceptId !== 'string' || !event.conceptId.trim()) missing.push('conceptId');
      if (!event.source || typeof event.source !== 'string' || !event.source.trim()) missing.push('source');
      break;

    case 'session_end':
      if (!hasText(event.sessionId)) missing.push('sessionId');
      if (typeof event.totalTime !== 'number') missing.push('totalTime');
      if (typeof event.problemsAttempted !== 'number') missing.push('problemsAttempted');
      if (typeof event.problemsSolved !== 'number') missing.push('problemsSolved');
      break;

    case 'textbook_add':
    case 'textbook_update':
      if (!hasText(event.noteId)) missing.push('noteId');
      if (!hasText(event.noteContent)) missing.push('noteContent');
      if (!hasText(event.templateId)) missing.push('templateId');
      if (!hasText(event.policyVersion)) missing.push('policyVersion');
      break;

    case 'chat_interaction':
      if (!hasText(event.chatMessage)) missing.push('chatMessage');
      if (!hasText(event.chatResponse)) missing.push('chatResponse');
      if (hasItems(event.textbookUnitsRetrieved) && !hasItems(event.retrievedSourceIds)) {
        missing.push('retrievedSourceIds');
      }
      break;
  }

  return { valid: missing.length === 0, missing };
}

export function validateResearchBatchForWrite(events: ResearchEventInput[]): BatchValidationResult {
  const errors: BatchValidationError[] = [];

  for (const event of events) {
    const validation = validateResearchEvent(event);
    if (!validation.valid) {
      errors.push({
        eventId: typeof event.id === 'string' ? event.id : '',
        eventType: typeof event.eventType === 'string' ? event.eventType : 'unknown',
        missingFields: validation.missing,
      });
    }
  }

  return {
    valid: errors.length === 0,
    failedIds: errors.map((error) => error.eventId).filter(Boolean),
    errors,
  };
}

// Import both database implementations
import * as neonDb from './neon.js';
import * as sqliteDb from './sqlite.js';
import { hasDbEnv } from './env-resolver.js';

export type {
  CorpusActiveRunRow,
  CorpusChunkRow,
  CorpusManifestDocumentRow,
  CorpusUnitRow,
} from './neon.js';

// Re-export legacy SQLite functions for existing routes
// These are used by the legacy routes that haven't been migrated to the unified interface
export * from './sqlite.js';

// ============================================================================
// Database Backend Selection
// ============================================================================

// Runtime check for Neon mode - rechecks each time to ensure fresh env var reads
export function isUsingNeon(): boolean {
  return hasDbEnv();
}

// ============================================================================
// Schema Initialization
// ============================================================================

export async function initializeSchema(): Promise<void> {
  if (isUsingNeon()) {
    console.log('🔌 Using Neon PostgreSQL database');
    await neonDb.initializeSchema();
  } else {
    console.log('💾 Using SQLite database (fallback)');
    await sqliteDb.initializeSchema();
  }
}

// ============================================================================
// Unified User Operations (used by Neon routes)
// ============================================================================

export async function createUser(id: string, data: CreateLearnerRequest): Promise<Learner> {
  return isUsingNeon() ? neonDb.createUser(id, data) : sqliteDb.createLearner(id, data);
}

export async function getUserById(id: string): Promise<Learner | null> {
  return isUsingNeon() ? neonDb.getUserById(id) : sqliteDb.getLearnerById(id);
}

export async function getAllUsers(): Promise<Learner[]> {
  return isUsingNeon() ? neonDb.getAllUsers() : sqliteDb.getAllLearners();
}

export async function updateUser(id: string, data: UpdateLearnerRequest): Promise<Learner | null> {
  return isUsingNeon() ? neonDb.updateUser(id, data) : sqliteDb.updateLearner(id, data);
}

export async function deleteUser(id: string): Promise<boolean> {
  return isUsingNeon() ? neonDb.deleteUser(id) : sqliteDb.deleteLearner(id);
}

// ============================================================================
// Unified Session Operations (used by Neon routes)
// ============================================================================

export async function saveSession(
  userId: string,
  sessionId: string,
  conditionId: string | undefined,
  config: import('../types.js').SessionData
): Promise<void> {
  if (isUsingNeon()) {
    await neonDb.saveSession(userId, sessionId, conditionId, config);
  } else {
    // SQLite stores session data differently - pass as extended SessionData
    await sqliteDb.saveSession(userId, { sessionId, conditionId, ...config } as unknown as import('../types.js').SessionData);
  }
}

export async function getSession(userId: string, sessionId: string): Promise<any | null> {
  if (isUsingNeon()) {
    return neonDb.getSession(userId, sessionId);
  } else {
    return sqliteDb.getSession(userId);
  }
}

export async function getActiveSession(userId: string): Promise<any | null> {
  return isUsingNeon() ? neonDb.getActiveSession(userId) : sqliteDb.getSession(userId);
}

export async function clearSession(userId: string, sessionId: string): Promise<boolean> {
  if (isUsingNeon()) {
    return neonDb.clearSession(userId, sessionId);
  } else {
    return sqliteDb.clearSession(userId);
  }
}

// ============================================================================
// Unified Problem Progress Operations (used by Neon routes)
// ============================================================================

export async function updateProblemProgress(
  userId: string,
  problemId: string,
  update: {
    solved?: boolean;
    incrementAttempts?: boolean;
    incrementHints?: boolean;
    lastCode?: string;
  }
): Promise<void> {
  return isUsingNeon()
    ? neonDb.updateProblemProgress(userId, problemId, update)
    : Promise.resolve(); // SQLite doesn't have this table yet
}

export async function getProblemProgress(userId: string, problemId: string): Promise<any | null> {
  return isUsingNeon()
    ? neonDb.getProblemProgress(userId, problemId)
    : Promise.resolve(null);
}

export async function getAllProblemProgress(userId: string): Promise<any[]> {
  return isUsingNeon()
    ? neonDb.getAllProblemProgress(userId)
    : Promise.resolve([]);
}

// ============================================================================
// Unified Interaction Event Operations (used by Neon routes)
// ============================================================================

export async function createInteraction(data: CreateInteractionRequest & { id: string }): Promise<Interaction> {
  return isUsingNeon() ? neonDb.createInteraction(data) : sqliteDb.createInteraction(data);
}

export async function getInteractionsByUser(
  userId: string,
  options?: {
    sessionId?: string;
    eventType?: string;
    problemId?: string;
    limit?: number;
    offset?: number;
  }
): Promise<{ interactions: Interaction[]; total: number }> {
  if (isUsingNeon()) {
    return neonDb.getInteractionsByUser(userId, options);
  } else {
    const interactions = await sqliteDb.getInteractionsByLearner(userId, options as import('../types.js').InteractionQueryParams);
    return { interactions, total: interactions.length };
  }
}

export async function getInteractionById(id: string): Promise<Interaction | null> {
  return isUsingNeon() ? neonDb.getInteractionById(id) : sqliteDb.getInteractionById(id);
}

// ============================================================================
// Unified Textbook Unit Operations (used by Neon routes)
// ============================================================================

export async function createTextbookUnit(
  userId: string,
  data: CreateUnitRequest & { unitId: string }
): Promise<InstructionalUnit> {
  return isUsingNeon()
    ? neonDb.createTextbookUnit(userId, data)
    : sqliteDb.createTextbookUnit(userId, data);
}

export async function getTextbookUnitsByUser(userId: string): Promise<InstructionalUnit[]> {
  return isUsingNeon()
    ? neonDb.getTextbookUnitsByUser(userId)
    : sqliteDb.getTextbookUnitsByLearner(userId);
}

export async function getTextbookUnitById(userId: string, unitId: string): Promise<InstructionalUnit | null> {
  return isUsingNeon()
    ? neonDb.getTextbookUnitById(userId, unitId)
    : sqliteDb.getTextbookUnitById(userId, unitId);
}

export async function deleteTextbookUnit(userId: string, unitId: string): Promise<boolean> {
  return isUsingNeon()
    ? neonDb.deleteTextbookUnit(userId, unitId)
    : sqliteDb.deleteTextbookUnit(userId, unitId);
}

// ============================================================================
// Processed corpus read operations (Neon only)
// ============================================================================

export async function getCorpusManifest() {
  return isUsingNeon() ? neonDb.getCorpusManifest() : [];
}

export async function getCorpusUnitById(unitId: string) {
  return isUsingNeon() ? neonDb.getCorpusUnitById(unitId) : null;
}

export async function getCorpusUnitsIndex() {
  return isUsingNeon() ? neonDb.getCorpusUnitsIndex() : [];
}

export async function getCorpusChunksByUnitId(unitId: string, limit = 50) {
  return isUsingNeon() ? neonDb.getCorpusChunksByUnitId(unitId, limit) : [];
}

export async function searchCorpus(query: string, limit = 10) {
  return isUsingNeon() ? neonDb.searchCorpus(query, limit) : [];
}

export async function getCorpusActiveRuns() {
  return isUsingNeon() ? neonDb.listCorpusActiveRuns() : [];
}

export async function getCorpusActiveRun(docId: string) {
  return isUsingNeon() ? neonDb.getCorpusActiveRun(docId) : null;
}

export async function setCorpusActiveRun(
  docId: string,
  runId: string,
  updatedBy?: string | null,
) {
  if (!isUsingNeon()) {
    throw new Error('Corpus active-run updates require Neon mode');
  }
  return neonDb.setCorpusActiveRun({ docId, runId, updatedBy });
}

// ============================================================================
// Neon-specific exports (for direct access when needed)
// ============================================================================

export {
  getDb as getNeonDb,
  resetDb as resetNeonDb,
  linkTextbookRetrievals,
  getTextbookRetrievalsForEvent,
} from './neon.js';

// ============================================================================
// Auth exports (Neon-only — no SQLite equivalent)
// ============================================================================

export {
  createAuthAccount,
  getAuthAccountByEmail,
  getAuthAccountById,
  toPublicAccount,
} from './auth.js';

export type { AuthAccount, AuthAccountPublic } from './auth.js';
