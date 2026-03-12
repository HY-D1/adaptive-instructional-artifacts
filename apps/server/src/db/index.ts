/**
 * SQL-Adapt Database Layer
 * Uses sqlite3 for SQLite operations
 */

import sqlite3 from 'sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import type {
  Learner,
  CreateLearnerRequest,
  UpdateLearnerRequest,
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

  // Learners table
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

  // Reinforcement schedules table (for spaced repetition)
  await runAsync(database, `
    CREATE TABLE IF NOT EXISTS reinforcement_schedules (
      id TEXT PRIMARY KEY,
      learner_id TEXT NOT NULL,
      unit_id TEXT NOT NULL,
      scheduled_time TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'skipped')),
      response TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (learner_id) REFERENCES learners(id) ON DELETE CASCADE
    )
  `);

  await runAsync(database, `CREATE INDEX IF NOT EXISTS idx_schedules_learner ON reinforcement_schedules(learner_id)`);
  await runAsync(database, `CREATE INDEX IF NOT EXISTS idx_schedules_time ON reinforcement_schedules(scheduled_time)`);
  await runAsync(database, `CREATE INDEX IF NOT EXISTS idx_schedules_status ON reinforcement_schedules(status)`);

  console.log('✅ Database schema initialized');
}

// ============================================================================
// UUID Generator
// ============================================================================

function generateId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
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
// Interaction Operations
// ============================================================================

export async function createInteraction(id: string, data: CreateInteractionRequest): Promise<Interaction> {
  const db = getDb();
  const now = new Date().toISOString();

  const interaction: Interaction = {
    id,
    learnerId: data.learnerId,
    sessionId: data.sessionId || null,
    timestamp: data.timestamp,
    eventType: data.eventType,
    problemId: data.problemId,
    payload: data.payload || {},
    createdAt: now,
  };

  await runAsync(db, `
    INSERT INTO interactions (id, learner_id, session_id, timestamp, event_type, problem_id, payload, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    interaction.id,
    interaction.learnerId,
    interaction.sessionId,
    interaction.timestamp,
    interaction.eventType,
    interaction.problemId,
    JSON.stringify(interaction.payload),
    interaction.createdAt
  ]);

  return interaction;
}

export async function createInteractionsBatch(events: CreateInteractionRequest[]): Promise<Interaction[]> {
  const db = getDb();
  const interactions: Interaction[] = [];
  const now = new Date().toISOString();

  const stmt = db.prepare(`
    INSERT INTO interactions (id, learner_id, session_id, timestamp, event_type, problem_id, payload, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const event of events) {
    const id = generateId();
    const interaction: Interaction = {
      id,
      learnerId: event.learnerId,
      sessionId: event.sessionId || null,
      timestamp: event.timestamp,
      eventType: event.eventType,
      problemId: event.problemId,
      payload: event.payload || {},
      createdAt: now,
    };

    await new Promise<void>((resolve, reject) => {
      stmt.run([
        interaction.id,
        interaction.learnerId,
        interaction.sessionId,
        interaction.timestamp,
        interaction.eventType,
        interaction.problemId,
        JSON.stringify(interaction.payload),
        interaction.createdAt
      ], (err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    interactions.push(interaction);
  }

  stmt.finalize();
  return interactions;
}

export async function queryInteractions(params: InteractionQueryParams): Promise<{ interactions: Interaction[]; total: number }> {
  const conditions: string[] = [];
  const values: (string | null)[] = [];

  if (params.learnerId) {
    conditions.push('learner_id = ?');
    values.push(params.learnerId);
  }
  if (params.sessionId) {
    conditions.push('session_id = ?');
    values.push(params.sessionId);
  }
  if (params.eventType) {
    conditions.push('event_type = ?');
    values.push(params.eventType);
  }
  if (params.problemId) {
    conditions.push('problem_id = ?');
    values.push(params.problemId);
  }
  if (params.start) {
    conditions.push('timestamp >= ?');
    values.push(params.start);
  }
  if (params.end) {
    conditions.push('timestamp <= ?');
    values.push(params.end);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const database = getDb();

  // Get total count
  const countRow = await getAsync<{ count: number }>(database, `SELECT COUNT(*) as count FROM interactions ${whereClause}`, values);
  const total = countRow?.count || 0;

  // Build query with pagination
  const limit = parseInt(params.limit || '100', 10);
  const offset = parseInt(params.offset || '0', 10);
  
  const query = `SELECT * FROM interactions ${whereClause} ORDER BY timestamp DESC LIMIT ? OFFSET ?`;

  const rows = await allAsync<InteractionRow>(database, query, [...values, limit, offset]);

  return {
    interactions: rows.map(rowToInteraction),
    total,
  };
}

export async function getInteractionsByLearner(learnerId: string): Promise<Interaction[]> {
  const rows = await allAsync<InteractionRow>(
    getDb(),
    'SELECT * FROM interactions WHERE learner_id = ? ORDER BY timestamp DESC',
    [learnerId]
  );
  return rows.map(rowToInteraction);
}

export async function getAllInteractionsForExport(
  startDate?: string,
  endDate?: string,
  learnerIds?: string[],
  eventTypes?: EventType[]
): Promise<Interaction[]> {
  const conditions: string[] = [];
  const values: (string | null)[] = [];

  if (startDate) {
    conditions.push('timestamp >= ?');
    values.push(startDate);
  }
  if (endDate) {
    conditions.push('timestamp <= ?');
    values.push(endDate);
  }
  if (learnerIds && learnerIds.length > 0) {
    conditions.push(`learner_id IN (${learnerIds.map(() => '?').join(',')})`);
    values.push(...learnerIds);
  }
  if (eventTypes && eventTypes.length > 0) {
    conditions.push(`event_type IN (${eventTypes.map(() => '?').join(',')})`);
    values.push(...eventTypes);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const rows = await allAsync<InteractionRow>(getDb(), `SELECT * FROM interactions ${whereClause} ORDER BY timestamp DESC`, values);
  return rows.map(rowToInteraction);
}

// ============================================================================
// Textbook Operations
// ============================================================================

export async function upsertTextbookUnit(
  learnerId: string,
  unitId: string,
  data: CreateUnitRequest | UpdateUnitRequest
): Promise<InstructionalUnit> {
  const database = getDb();
  const now = new Date().toISOString();

  // Check if unit exists
  const existing = await getTextbookUnit(learnerId, unitId);

  if (existing) {
    // Update
    const updates: string[] = [];
    const values: (string | null)[] = [];

    if ('type' in data && data.type !== undefined) {
      updates.push('type = ?');
      values.push(data.type);
    }
    if ('conceptIds' in data && data.conceptIds !== undefined) {
      updates.push('concept_ids = ?');
      values.push(JSON.stringify(data.conceptIds));
    }
    if ('title' in data && data.title !== undefined) {
      updates.push('title = ?');
      values.push(data.title);
    }
    if ('content' in data && data.content !== undefined) {
      updates.push('content = ?');
      values.push(data.content);
    }
    if ('contentFormat' in data && data.contentFormat !== undefined) {
      updates.push('content_format = ?');
      values.push(data.contentFormat);
    }
    if ('sourceInteractionIds' in data && data.sourceInteractionIds !== undefined) {
      updates.push('source_interaction_ids = ?');
      values.push(JSON.stringify(data.sourceInteractionIds));
    }
    if ('status' in data && data.status !== undefined) {
      updates.push('status = ?');
      values.push(data.status);
    }

    updates.push('updated_at = ?');
    values.push(now);
    values.push(learnerId);
    values.push(unitId);

    await runAsync(database, `UPDATE textbooks SET ${updates.join(', ')} WHERE learner_id = ? AND unit_id = ?`, values);

    return (await getTextbookUnit(learnerId, unitId))!;
  } else {
    // Create
    const createData = data as CreateUnitRequest;
    const id = generateId();
    
    const unit: InstructionalUnit = {
      id,
      learnerId,
      unitId,
      type: createData.type,
      conceptIds: createData.conceptIds || [],
      title: createData.title,
      content: createData.content,
      contentFormat: createData.contentFormat || 'markdown',
      sourceInteractionIds: createData.sourceInteractionIds || [],
      status: createData.status || 'primary',
      createdAt: now,
      updatedAt: now,
    };

    await runAsync(database, `
      INSERT INTO textbooks (id, learner_id, unit_id, type, concept_ids, title, content, content_format, source_interaction_ids, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
      unit.updatedAt
    ]);

    return unit;
  }
}

export async function getTextbookUnit(learnerId: string, unitId: string): Promise<InstructionalUnit | null> {
  const row = await getAsync<TextbookRow>(
    getDb(),
    'SELECT * FROM textbooks WHERE learner_id = ? AND unit_id = ?',
    [learnerId, unitId]
  );
  return row ? rowToTextbook(row) : null;
}

export async function getTextbookByLearner(learnerId: string): Promise<InstructionalUnit[]> {
  const rows = await allAsync<TextbookRow>(
    getDb(),
    `SELECT * FROM textbooks WHERE learner_id = ? AND status != 'archived' ORDER BY created_at DESC`,
    [learnerId]
  );
  return rows.map(rowToTextbook);
}

export async function deleteTextbookUnit(learnerId: string, unitId: string): Promise<boolean> {
  const result = await runAsync(getDb(), 'DELETE FROM textbooks WHERE learner_id = ? AND unit_id = ?', [learnerId, unitId]);
  return result.changes > 0;
}

// ============================================================================
// Session Operations
// ============================================================================

export async function getActiveSession(learnerId: string): Promise<Session | null> {
  const row = await getAsync<SessionRow>(getDb(), 'SELECT * FROM sessions WHERE learner_id = ?', [learnerId]);
  return row ? rowToSession(row) : null;
}

export async function saveActiveSession(learnerId: string, data: SessionData): Promise<Session> {
  const database = getDb();
  const now = new Date().toISOString();

  const existing = await getActiveSession(learnerId);

  if (existing) {
    await runAsync(database, `
      UPDATE sessions SET data = ?, updated_at = ? WHERE learner_id = ?
    `, [JSON.stringify(data), now, learnerId]);
    
    return {
      ...existing,
      data: data as Record<string, unknown>,
      updatedAt: now,
    };
  } else {
    const id = generateId();
    const session: Session = {
      id,
      learnerId,
      data: data as Record<string, unknown>,
      createdAt: now,
      updatedAt: now,
    };

    await runAsync(database, `
      INSERT INTO sessions (id, learner_id, data, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?)
    `, [session.id, session.learnerId, JSON.stringify(session.data), session.createdAt, session.updatedAt]);
    
    return session;
  }
}

export async function clearActiveSession(learnerId: string): Promise<boolean> {
  const db = getDb();
  const result = await runAsync(db, 'DELETE FROM sessions WHERE learner_id = ?', [learnerId]);
  return result.changes > 0;
}

// ============================================================================
// Research/Aggregate Operations
// ============================================================================

export async function getClassStats(): Promise<{
  totalLearners: number;
  totalInteractions: number;
  interactionsByType: Record<string, number>;
  totalTextbookUnits: number;
  averageUnitsPerLearner: number;
  recentActivity: {
    last24Hours: number;
    last7Days: number;
    last30Days: number;
  };
}> {
  const database = getDb();
  const now = new Date();
  const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
  const last7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const last30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const totalLearnersRow = await getAsync<{ count: number }>(database, 'SELECT COUNT(*) as count FROM learners');
  const totalInteractionsRow = await getAsync<{ count: number }>(database, 'SELECT COUNT(*) as count FROM interactions');
  const totalTextbookUnitsRow = await getAsync<{ count: number }>(database, 'SELECT COUNT(*) as count FROM textbooks');

  const totalLearners = totalLearnersRow?.count || 0;
  const totalInteractions = totalInteractionsRow?.count || 0;
  const totalTextbookUnits = totalTextbookUnitsRow?.count || 0;

  // Interactions by type
  const typeRows = await allAsync<{ event_type: string; count: number }>(
    database,
    'SELECT event_type, COUNT(*) as count FROM interactions GROUP BY event_type'
  );
  const interactionsByType: Record<string, number> = {};
  for (const row of typeRows) {
    interactionsByType[row.event_type] = row.count;
  }

  // Recent activity
  const last24hRow = await getAsync<{ count: number }>(database, 'SELECT COUNT(*) as count FROM interactions WHERE timestamp >= ?', [last24h]);
  const last7dRow = await getAsync<{ count: number }>(database, 'SELECT COUNT(*) as count FROM interactions WHERE timestamp >= ?', [last7d]);
  const last30dRow = await getAsync<{ count: number }>(database, 'SELECT COUNT(*) as count FROM interactions WHERE timestamp >= ?', [last30d]);

  return {
    totalLearners,
    totalInteractions,
    interactionsByType,
    totalTextbookUnits,
    averageUnitsPerLearner: totalLearners > 0 ? totalTextbookUnits / totalLearners : 0,
    recentActivity: {
      last24Hours: last24hRow?.count || 0,
      last7Days: last7dRow?.count || 0,
      last30Days: last30dRow?.count || 0,
    },
  };
}

// ============================================================================
// Row Mappers
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
  event_type: EventType;
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
  return {
    id: row.id,
    learnerId: row.learner_id,
    sessionId: row.session_id,
    timestamp: row.timestamp,
    eventType: row.event_type,
    problemId: row.problem_id,
    payload: JSON.parse(row.payload),
    createdAt: row.created_at,
  };
}

function rowToTextbook(row: TextbookRow): InstructionalUnit {
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
}

function rowToSession(row: SessionRow): Session {
  return {
    id: row.id,
    learnerId: row.learner_id,
    data: JSON.parse(row.data),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
