/**
 * SQL-Adapt Database Layer - SQLite Implementation
 * Uses sqlite3 for SQLite operations
 */

import sqlite3 from 'sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import type {
  Learner,
  CreateLearnerRequest,
  UpdateLearnerRequest,
  LearnerProfile,
  Interaction,
  CreateInteractionRequest,
  InteractionQueryParams,
  InstructionalUnit,
  CreateUnitRequest,
  UpdateUnitRequest,
  Session,
  SessionData,
  EventType,
} from '../types.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(__dirname, '../../data');
const DB_PATH = process.env.DATABASE_PATH || path.join(DATA_DIR, 'sql-adapt.db');

// ============================================================================
// Database Instance
// ============================================================================

let db: sqlite3.Database | null = null;

export function getDb(): sqlite3.Database {
  if (!db) {
    db = new sqlite3.Database(DB_PATH, (err) => {
      if (err) {
        console.error('Failed to open database:', err.message);
      } else {
        console.log('Connected to SQLite database');
      }
    });
    db.run('PRAGMA foreign_keys = ON');
  }
  return db;
}

export function closeDb(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (db) {
      db.close((err) => {
        if (err) {
          reject(err);
        } else {
          db = null;
          resolve();
        }
      });
    } else {
      resolve();
    }
  });
}

// ============================================================================
// Promisified Helpers
// ============================================================================

function runAsync(db: sqlite3.Database, sql: string, params: unknown[] = []): Promise<sqlite3.RunResult> {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
}

function getAsync<T>(db: sqlite3.Database, sql: string, params: unknown[] = []): Promise<T | undefined> {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row as T);
    });
  });
}

function allAsync<T>(db: sqlite3.Database, sql: string, params: unknown[] = []): Promise<T[]> {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows as T[]);
    });
  });
}

// ============================================================================
// Schema Initialization
// ============================================================================

export async function initializeSchema(): Promise<void> {
  const database = getDb();

  // Learners table (basic auth info)
  await runAsync(database, `
    CREATE TABLE IF NOT EXISTS learners (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('student', 'instructor')),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);

  await runAsync(database, `CREATE INDEX IF NOT EXISTS idx_learners_role ON learners(role)`);

  // Interactions table (append-only logging)
  await runAsync(database, `
    CREATE TABLE IF NOT EXISTS interactions (
      id TEXT PRIMARY KEY,
      learner_id TEXT NOT NULL,
      session_id TEXT,
      timestamp TEXT NOT NULL,
      event_type TEXT NOT NULL,
      problem_id TEXT NOT NULL,
      payload TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL,
      FOREIGN KEY (learner_id) REFERENCES learners(id) ON DELETE CASCADE
    )
  `);

  await runAsync(database, `CREATE INDEX IF NOT EXISTS idx_interactions_learner ON interactions(learner_id)`);
  await runAsync(database, `CREATE INDEX IF NOT EXISTS idx_interactions_session ON interactions(session_id)`);
  await runAsync(database, `CREATE INDEX IF NOT EXISTS idx_interactions_event_type ON interactions(event_type)`);
  await runAsync(database, `CREATE INDEX IF NOT EXISTS idx_interactions_timestamp ON interactions(timestamp)`);
  await runAsync(database, `CREATE INDEX IF NOT EXISTS idx_interactions_problem ON interactions(problem_id)`);

  // Textbooks table
  await runAsync(database, `
    CREATE TABLE IF NOT EXISTS textbooks (
      id TEXT PRIMARY KEY,
      learner_id TEXT NOT NULL,
      unit_id TEXT NOT NULL,
      type TEXT NOT NULL CHECK (type IN ('hint', 'explanation', 'example', 'summary')),
      concept_ids TEXT NOT NULL DEFAULT '[]',
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      content_format TEXT NOT NULL DEFAULT 'markdown' CHECK (content_format IN ('markdown', 'html')),
      source_interaction_ids TEXT NOT NULL DEFAULT '[]',
      status TEXT NOT NULL DEFAULT 'primary' CHECK (status IN ('primary', 'alternative', 'archived')),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (learner_id) REFERENCES learners(id) ON DELETE CASCADE,
      UNIQUE(learner_id, unit_id)
    )
  `);

  await runAsync(database, `CREATE INDEX IF NOT EXISTS idx_textbooks_learner ON textbooks(learner_id)`);
  await runAsync(database, `CREATE INDEX IF NOT EXISTS idx_textbooks_unit ON textbooks(unit_id)`);
  await runAsync(database, `CREATE INDEX IF NOT EXISTS idx_textbooks_type ON textbooks(type)`);

  // Sessions table
  await runAsync(database, `
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      learner_id TEXT NOT NULL UNIQUE,
      data TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (learner_id) REFERENCES learners(id) ON DELETE CASCADE
    )
  `);

  await runAsync(database, `CREATE INDEX IF NOT EXISTS idx_sessions_learner ON sessions(learner_id)`);

  console.log('✅ SQLite database schema initialized');
}

// ============================================================================
// Learner Operations
// ============================================================================

export async function createLearner(id: string, data: CreateLearnerRequest): Promise<Learner> {
  const db = getDb();
  const now = new Date().toISOString();

  const learner: Learner = {
    id,
    name: data.name,
    role: data.role,
    createdAt: now,
    updatedAt: now,
  };

  await runAsync(db, `
    INSERT INTO learners (id, name, role, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?)
  `, [learner.id, learner.name, learner.role, learner.createdAt, learner.updatedAt]);

  return learner;
}

export async function getLearnerById(id: string): Promise<Learner | null> {
  const row = await getAsync<LearnerRow>(getDb(), 'SELECT * FROM learners WHERE id = ?', [id]);
  return row ? rowToLearner(row) : null;
}

export async function getAllLearners(): Promise<Learner[]> {
  const rows = await allAsync<LearnerRow>(getDb(), 'SELECT * FROM learners ORDER BY created_at DESC');
  return rows.map(rowToLearner);
}

export async function updateLearner(id: string, data: UpdateLearnerRequest): Promise<Learner | null> {
  const db = getDb();
  const existing = await getLearnerById(id);
  if (!existing) return null;

  const now = new Date().toISOString();
  const updates: string[] = [];
  const values: (string | null)[] = [];

  if (data.name !== undefined) {
    updates.push('name = ?');
    values.push(data.name);
  }
  if (data.role !== undefined) {
    updates.push('role = ?');
    values.push(data.role);
  }

  updates.push('updated_at = ?');
  values.push(now);
  values.push(id);

  await runAsync(db, `UPDATE learners SET ${updates.join(', ')} WHERE id = ?`, values);

  return getLearnerById(id);
}

export async function deleteLearner(id: string): Promise<boolean> {
  const db = getDb();
  const result = await runAsync(db, 'DELETE FROM learners WHERE id = ?', [id]);
  return result.changes > 0;
}

// ============================================================================
// Learner Profile Operations (Stub implementations for backward compatibility)
// ============================================================================

export async function saveLearnerProfile(profile: LearnerProfile): Promise<void> {
  // Stub: Store profile in a JSON file or localStorage equivalent
  const db = getDb();
  const now = new Date().toISOString();
  const id = `profile-${profile.id}`;

  await runAsync(db, `
    INSERT OR REPLACE INTO sessions (id, learner_id, data, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?)
  `, [id, profile.id, JSON.stringify(profile), now, now]);
}

export async function getLearnerProfile(_learnerId: string): Promise<LearnerProfile | null> {
  // Stub: Return null - profiles not fully implemented in SQLite
  return null;
}

export async function getAllLearnerProfiles(): Promise<LearnerProfile[]> {
  // Stub: Return empty array - profiles not fully implemented in SQLite
  return [];
}

export async function updateProfileFromEvent(learnerId: string, _event: CreateInteractionRequest): Promise<LearnerProfile | null> {
  // Stub: Return null - profiles not fully implemented in SQLite
  return getLearnerProfile(learnerId);
}

export async function appendProfileEvents(learnerId: string, _events: CreateInteractionRequest[]): Promise<LearnerProfile | null> {
  // Stub: Return null - profiles not fully implemented in SQLite
  return getLearnerProfile(learnerId);
}

// ============================================================================
// Session Operations
// ============================================================================

export async function saveSession(learnerId: string, data: SessionData): Promise<void> {
  const db = getDb();
  const now = new Date().toISOString();
  const id = `${learnerId}-session`;

  await runAsync(db, `
    INSERT INTO sessions (id, learner_id, data, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(learner_id) DO UPDATE SET
      data = excluded.data,
      updated_at = excluded.updated_at
  `, [id, learnerId, JSON.stringify(data), now, now]);
}

export async function getSession(learnerId: string): Promise<Session | null> {
  const row = await getAsync<SessionRow>(getDb(), 'SELECT * FROM sessions WHERE learner_id = ?', [learnerId]);

  if (!row) return null;

  try {
    return {
      id: row.id,
      learnerId: row.learner_id,
      data: JSON.parse(row.data),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  } catch {
    return null;
  }
}

export async function clearSession(learnerId: string): Promise<boolean> {
  const db = getDb();
  const result = await runAsync(db, 'DELETE FROM sessions WHERE learner_id = ?', [learnerId]);
  return result.changes > 0;
}

// Legacy-compatible session operations
export async function saveActiveSession(learnerId: string, data: SessionData): Promise<Session> {
  await saveSession(learnerId, data);
  const session = await getSession(learnerId);
  if (!session) {
    throw new Error('Failed to save session');
  }
  return session;
}

export async function clearActiveSession(learnerId: string): Promise<boolean> {
  return clearSession(learnerId);
}

export async function getActiveSession(learnerId: string): Promise<Session | null> {
  return getSession(learnerId);
}

// ============================================================================
// Interaction Operations
// ============================================================================

export async function createInteraction(data: CreateInteractionRequest & { id: string }): Promise<Interaction> {
  const db = getDb();
  const now = new Date().toISOString();
  const payload = buildSqliteInteractionPayload(data);

  const interaction: Interaction = {
    id: data.id,
    learnerId: data.learnerId,
    sessionId: data.sessionId || null,
    timestamp: data.timestamp,
    eventType: data.eventType,
    problemId: data.problemId,
    ...payload,
    payload,
    createdAt: now,
  };

  await runAsync(db, `
    INSERT INTO interactions (id, learner_id, session_id, timestamp, event_type, problem_id, payload, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    interaction.id,
    interaction.learnerId,
    interaction.sessionId || null,
    interaction.timestamp,
    interaction.eventType,
    interaction.problemId,
    JSON.stringify(interaction.payload),
    interaction.createdAt,
  ]);

  return interaction;
}

export function buildSqliteInteractionPayload(
  data: CreateInteractionRequest & { id?: string }
): Record<string, unknown> {
  const {
    id: _id,
    learnerId: _learnerId,
    sectionId: _sectionId,
    sessionId: _sessionId,
    timestamp: _timestamp,
    eventType: _eventType,
    problemId: _problemId,
    payload,
    ...fields
  } = data;

  return Object.fromEntries(
    Object.entries({
      ...(payload || {}),
      ...fields,
    }).filter(([, value]) => value !== undefined)
  );
}

export async function getInteractionsByLearner(
  learnerId: string,
  options?: InteractionQueryParams
): Promise<Interaction[]> {
  let sql = 'SELECT * FROM interactions WHERE learner_id = ?';
  const params: (string | number)[] = [learnerId];

  if (options?.sessionId) {
    sql += ' AND session_id = ?';
    params.push(options.sessionId);
  }

  if (options?.eventType) {
    sql += ' AND event_type = ?';
    params.push(options.eventType);
  }

  if (options?.problemId) {
    sql += ' AND problem_id = ?';
    params.push(options.problemId);
  }

  sql += ' ORDER BY timestamp DESC';

  if (options?.limit) {
    sql += ' LIMIT ?';
    params.push(options.limit);
  }

  if (options?.offset) {
    sql += ' OFFSET ?';
    params.push(options.offset);
  }

  const rows = await allAsync<InteractionRow>(getDb(), sql, params);
  return rows.map(rowToInteraction);
}

export async function getInteractionById(id: string): Promise<Interaction | null> {
  const row = await getAsync<InteractionRow>(getDb(), 'SELECT * FROM interactions WHERE id = ?', [id]);
  return row ? rowToInteraction(row) : null;
}

export async function createInteractionsBatch(events: CreateInteractionRequest[]): Promise<Interaction[]> {
  const interactions: Interaction[] = [];
  for (const event of events) {
    const id = generateId();
    const interaction = await createInteraction({ ...event, id });
    interactions.push(interaction);
  }
  return interactions;
}

export async function queryInteractions(params: InteractionQueryParams): Promise<{ interactions: Interaction[]; total: number }> {
  let sql = 'SELECT * FROM interactions WHERE 1=1';
  const queryParams: (string | number)[] = [];

  if (params.learnerId) {
    sql += ' AND learner_id = ?';
    queryParams.push(params.learnerId);
  }

  if (params.sessionId) {
    sql += ' AND session_id = ?';
    queryParams.push(params.sessionId);
  }

  if (params.eventType) {
    sql += ' AND event_type = ?';
    queryParams.push(params.eventType);
  }

  if (params.problemId) {
    sql += ' AND problem_id = ?';
    queryParams.push(params.problemId);
  }

  // Get total count
  const countSql = sql.replace('SELECT *', 'SELECT COUNT(*) as count');
  const countRow = await getAsync<{ count: number }>(getDb(), countSql, queryParams);
  const total = countRow?.count || 0;

  sql += ' ORDER BY timestamp DESC';

  if (params.limit) {
    sql += ' LIMIT ?';
    queryParams.push(parseInt(params.limit, 10));
  }

  if (params.offset) {
    sql += ' OFFSET ?';
    queryParams.push(parseInt(params.offset, 10));
  }

  const rows = await allAsync<InteractionRow>(getDb(), sql, queryParams);
  const interactions = rows.map(rowToInteraction);

  return { interactions, total };
}

export async function getAllInteractionsForExport(
  _startDate?: string,
  _endDate?: string,
  _learnerIds?: string[],
  _eventTypes?: EventType[]
): Promise<Interaction[]> {
  // Stub: Return all interactions (filtering can be added later)
  const rows = await allAsync<InteractionRow>(getDb(), 'SELECT * FROM interactions ORDER BY timestamp DESC');
  return rows.map(rowToInteraction);
}

// ============================================================================
// Textbook Unit Operations
// ============================================================================

export async function createTextbookUnit(
  learnerId: string,
  data: CreateUnitRequest & { unitId: string }
): Promise<InstructionalUnit> {
  const db = getDb();
  const now = new Date().toISOString();
  const id = `${learnerId}-${data.unitId}`;

  const unit: InstructionalUnit = {
    id,
    learnerId,
    unitId: data.unitId,
    type: data.type,
    conceptIds: data.conceptIds || [],
    title: data.title,
    content: data.content,
    contentFormat: data.contentFormat || 'markdown',
    sourceInteractionIds: data.sourceInteractionIds || [],
    status: data.status || 'primary',
    createdAt: now,
    updatedAt: now,
  };

  await runAsync(db, `
    INSERT INTO textbooks (id, learner_id, unit_id, type, concept_ids, title, content, content_format, source_interaction_ids, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(learner_id, unit_id) DO UPDATE SET
      type = excluded.type,
      concept_ids = excluded.concept_ids,
      title = excluded.title,
      content = excluded.content,
      content_format = excluded.content_format,
      source_interaction_ids = excluded.source_interaction_ids,
      status = excluded.status,
      updated_at = excluded.updated_at
  `, [
    unit.id,
    unit.learnerId,
    unit.unitId,
    unit.type,
    JSON.stringify(unit.conceptIds),
    unit.title,
    unit.content,
    unit.contentFormat,
    JSON.stringify(unit.sourceInteractionIds),
    unit.status,
    unit.createdAt,
    unit.updatedAt,
  ]);

  return unit;
}

export async function getTextbookUnitsByLearner(learnerId: string): Promise<InstructionalUnit[]> {
  const rows = await allAsync<TextbookRow>(getDb(), 'SELECT * FROM textbooks WHERE learner_id = ? ORDER BY created_at DESC', [learnerId]);
  return rows.map(rowToInstructionalUnit);
}

export async function getTextbookUnitById(learnerId: string, unitId: string): Promise<InstructionalUnit | null> {
  const id = `${learnerId}-${unitId}`;
  const row = await getAsync<TextbookRow>(getDb(), 'SELECT * FROM textbooks WHERE id = ?', [id]);
  return row ? rowToInstructionalUnit(row) : null;
}

export async function deleteTextbookUnit(learnerId: string, unitId: string): Promise<boolean> {
  const db = getDb();
  const id = `${learnerId}-${unitId}`;
  const result = await runAsync(db, 'DELETE FROM textbooks WHERE id = ?', [id]);
  return result.changes > 0;
}

// Legacy-compatible textbook operations
export async function upsertTextbookUnit(learnerId: string, unitId: string, data: CreateUnitRequest | UpdateUnitRequest): Promise<InstructionalUnit> {
  return createTextbookUnit(learnerId, { ...data, unitId } as CreateUnitRequest & { unitId: string });
}

export async function getTextbookByLearner(learnerId: string): Promise<InstructionalUnit[]> {
  return getTextbookUnitsByLearner(learnerId);
}

export async function getTextbookUnit(learnerId: string, unitId: string): Promise<InstructionalUnit | null> {
  return getTextbookUnitById(learnerId, unitId);
}

// ============================================================================
// Class Stats Operations
// ============================================================================

export async function getClassStats(): Promise<{
  totalLearners: number;
  totalInteractions: number;
  interactionsByType: Record<EventType, number>;
  totalTextbookUnits: number;
  averageUnitsPerLearner: number;
  recentActivity: {
    last24Hours: number;
    last7Days: number;
    last30Days: number;
  };
}> {
  const db = getDb();

  const learnersCount = await getAsync<{ count: number }>(db, 'SELECT COUNT(*) as count FROM learners');
  const interactionsCount = await getAsync<{ count: number }>(db, 'SELECT COUNT(*) as count FROM interactions');
  const textbooksCount = await getAsync<{ count: number }>(db, 'SELECT COUNT(*) as count FROM textbooks');

  const now = new Date();
  const last24Hours = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
  const last7Days = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const last30Days = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const last24hCount = await getAsync<{ count: number }>(db, 'SELECT COUNT(*) as count FROM interactions WHERE timestamp > ?', [last24Hours]);
  const last7dCount = await getAsync<{ count: number }>(db, 'SELECT COUNT(*) as count FROM interactions WHERE timestamp > ?', [last7Days]);
  const last30dCount = await getAsync<{ count: number }>(db, 'SELECT COUNT(*) as count FROM interactions WHERE timestamp > ?', [last30Days]);

  const totalLearners = learnersCount?.count || 0;
  const totalTextbookUnits = textbooksCount?.count || 0;

  return {
    totalLearners,
    totalInteractions: interactionsCount?.count || 0,
    interactionsByType: {} as Record<EventType, number>, // Would need to query by type
    totalTextbookUnits,
    averageUnitsPerLearner: totalLearners > 0 ? totalTextbookUnits / totalLearners : 0,
    recentActivity: {
      last24Hours: last24hCount?.count || 0,
      last7Days: last7dCount?.count || 0,
      last30Days: last30dCount?.count || 0,
    },
  };
}

// ============================================================================
// Helper Functions
// ============================================================================

function generateId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

function rowToLearner(row: LearnerRow): Learner {
  return {
    id: row.id,
    name: row.name,
    role: row.role,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function rowToInteraction(row: InteractionRow): Interaction {
  try {
    const payload = JSON.parse(row.payload);
    return {
      ...payload,
      id: row.id,
      learnerId: row.learner_id,
      sessionId: row.session_id,
      timestamp: row.timestamp,
      eventType: row.event_type as EventType,
      problemId: row.problem_id,
      payload,
      createdAt: row.created_at,
    };
  } catch {
    return {
      id: row.id,
      learnerId: row.learner_id,
      sessionId: row.session_id,
      timestamp: row.timestamp,
      eventType: row.event_type as EventType,
      problemId: row.problem_id,
      payload: {},
      createdAt: row.created_at,
    };
  }
}

function rowToInstructionalUnit(row: TextbookRow): InstructionalUnit {
  try {
    return {
      id: row.id,
      learnerId: row.learner_id,
      unitId: row.unit_id,
      type: row.type,
      conceptIds: JSON.parse(row.concept_ids),
      title: row.title,
      content: row.content,
      contentFormat: row.content_format,
      sourceInteractionIds: JSON.parse(row.source_interaction_ids),
      status: row.status,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  } catch {
    return {
      id: row.id,
      learnerId: row.learner_id,
      unitId: row.unit_id,
      type: row.type,
      conceptIds: [],
      title: row.title,
      content: row.content,
      contentFormat: row.content_format,
      sourceInteractionIds: [],
      status: row.status,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}

// ============================================================================
// Type Definitions
// ============================================================================

interface LearnerRow {
  id: string;
  name: string;
  role: 'student' | 'instructor';
  created_at: string;
  updated_at: string;
}

interface InteractionRow {
  id: string;
  learner_id: string;
  session_id: string | null;
  timestamp: string;
  event_type: string;
  problem_id: string;
  payload: string;
  created_at: string;
}

interface TextbookRow {
  id: string;
  learner_id: string;
  unit_id: string;
  type: 'hint' | 'explanation' | 'example' | 'summary';
  concept_ids: string;
  title: string;
  content: string;
  content_format: 'markdown' | 'html';
  source_interaction_ids: string;
  status: 'primary' | 'alternative' | 'archived';
  created_at: string;
  updated_at: string;
}

interface SessionRow {
  id: string;
  learner_id: string;
  data: string;
  created_at: string;
  updated_at: string;
}
