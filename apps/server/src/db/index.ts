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
  LearnerProfile,
  LearnerProfileRow,
  ConceptCoverageEvidence,
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

  // Learner profiles table (rich profile data with structured fields + JSON extensibility)
  await runAsync(database, `
    CREATE TABLE IF NOT EXISTS learner_profiles (
      learner_id TEXT PRIMARY KEY,
      profile_json TEXT NOT NULL DEFAULT '{}',
      concept_coverage TEXT NOT NULL DEFAULT '{}',
      concept_evidence TEXT NOT NULL DEFAULT '{}',
      error_history TEXT NOT NULL DEFAULT '{}',
      interaction_count INTEGER NOT NULL DEFAULT 0,
      strategy TEXT NOT NULL DEFAULT 'adaptive',
      preferences TEXT NOT NULL DEFAULT '{"escalationThreshold": 2, "aggregationDelay": 300000}',
      last_activity_at TEXT,
      profile_data TEXT NOT NULL DEFAULT '{}',
      updated_at TEXT NOT NULL,
      FOREIGN KEY (learner_id) REFERENCES learners(id) ON DELETE CASCADE
    )
  `);

  await runAsync(database, `CREATE INDEX IF NOT EXISTS idx_profiles_updated ON learner_profiles(updated_at)`);
  await runAsync(database, `CREATE INDEX IF NOT EXISTS idx_profiles_strategy ON learner_profiles(strategy)`);
  await runAsync(database, `CREATE INDEX IF NOT EXISTS idx_profiles_activity ON learner_profiles(last_activity_at)`);

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
  
  // Create default profile for the learner
  await createDefaultProfile(id, data.name);
  
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
    
    // Also update profile name
    await updateProfileName(id, data.name);
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
// Learner Profile Operations
// ============================================================================

/**
 * Create a default profile for a new learner
 */
async function createDefaultProfile(learnerId: string, name: string): Promise<LearnerProfile> {
  const now = Date.now();
  const profile: LearnerProfile = {
    id: learnerId,
    name,
    conceptsCovered: [],
    conceptCoverageEvidence: {},
    errorHistory: {},
    interactionCount: 0,
    currentStrategy: 'adaptive',
    preferences: {
      escalationThreshold: 2,
      aggregationDelay: 300000, // 5 minutes in ms
      autoTextbookEnabled: true,
      notificationsEnabled: true,
    },
    createdAt: now,
    lastActive: now,
    extendedData: {},
  };

  await saveLearnerProfile(profile);
  return profile;
}

/**
 * Update profile name when learner name changes
 */
async function updateProfileName(learnerId: string, name: string): Promise<void> {
  const profile = await getLearnerProfile(learnerId);
  if (profile) {
    profile.name = name;
    profile.lastActive = Date.now();
    await saveLearnerProfile(profile);
  }
}

/**
 * Save (create or update) a full learner profile with structured fields
 */
export async function saveLearnerProfile(profile: LearnerProfile): Promise<void> {
  const db = getDb();
  const now = new Date().toISOString();

  const sql = `
    INSERT INTO learner_profiles (
      learner_id, profile_json, concept_coverage, concept_evidence, 
      error_history, interaction_count, strategy, preferences, 
      last_activity_at, profile_data, updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(learner_id) DO UPDATE SET
      profile_json = excluded.profile_json,
      concept_coverage = excluded.concept_coverage,
      concept_evidence = excluded.concept_evidence,
      error_history = excluded.error_history,
      interaction_count = excluded.interaction_count,
      strategy = excluded.strategy,
      preferences = excluded.preferences,
      last_activity_at = excluded.last_activity_at,
      profile_data = excluded.profile_data,
      updated_at = excluded.updated_at
  `;

  await runAsync(db, sql, [
    profile.id,
    JSON.stringify(profile),
    JSON.stringify(profile.conceptsCovered),
    JSON.stringify(profile.conceptCoverageEvidence),
    JSON.stringify(profile.errorHistory),
    profile.interactionCount,
    profile.currentStrategy,
    JSON.stringify(profile.preferences),
    profile.lastActive ? new Date(profile.lastActive).toISOString() : null,
    JSON.stringify(profile.extendedData || {}),
    now
  ]);
}

/**
 * Get a learner's full profile with structured fields
 */
export async function getLearnerProfile(learnerId: string): Promise<LearnerProfile | null> {
  const sql = `
    SELECT 
      learner_id, profile_json, concept_coverage, concept_evidence,
      error_history, interaction_count, strategy, preferences,
      last_activity_at, profile_data
    FROM learner_profiles 
    WHERE learner_id = ?
  `;
  const row = await getAsync<LearnerProfileRow>(getDb(), sql, [learnerId]);

  if (!row) return null;
  
  try {
    // Parse structured fields
    const conceptCoverage = JSON.parse(row.concept_coverage) as string[];
    const conceptEvidence = JSON.parse(row.concept_evidence) as Record<string, ConceptCoverageEvidence>;
    const errorHistory = JSON.parse(row.error_history) as Record<string, number>;
    const preferences = JSON.parse(row.preferences) as LearnerProfile['preferences'];
    const extendedData = JSON.parse(row.profile_data) as Record<string, unknown>;
    
    return {
      id: row.learner_id,
      name: '', // Will be populated from learner record
      conceptsCovered: conceptCoverage,
      conceptCoverageEvidence: conceptEvidence,
      errorHistory: errorHistory,
      interactionCount: row.interaction_count,
      currentStrategy: row.strategy,
      preferences: preferences,
      createdAt: row.last_activity_at ? new Date(row.last_activity_at).getTime() : Date.now(),
      lastActive: row.last_activity_at ? new Date(row.last_activity_at).getTime() : Date.now(),
      extendedData: extendedData,
    };
  } catch (error) {
    console.error('Failed to parse learner profile:', error);
    return null;
  }
}

/**
 * Get all learner profiles with structured fields
 */
export async function getAllLearnerProfiles(): Promise<LearnerProfile[]> {
  const sql = `
    SELECT 
      lp.learner_id, lp.profile_json, lp.concept_coverage, lp.concept_evidence,
      lp.error_history, lp.interaction_count, lp.strategy, lp.preferences,
      lp.last_activity_at, lp.profile_data,
      l.name as learner_name
    FROM learner_profiles lp
    JOIN learners l ON lp.learner_id = l.id
  `;
  const rows = await allAsync<LearnerProfileRow & { learner_name: string }>(getDb(), sql);
  
  const profiles: LearnerProfile[] = [];
  
  for (const row of rows) {
    try {
      const conceptCoverage = JSON.parse(row.concept_coverage) as string[];
      const conceptEvidence = JSON.parse(row.concept_evidence) as Record<string, ConceptCoverageEvidence>;
      const errorHistory = JSON.parse(row.error_history) as Record<string, number>;
      const preferences = JSON.parse(row.preferences) as LearnerProfile['preferences'];
      const extendedData = JSON.parse(row.profile_data) as Record<string, unknown>;
      
      profiles.push({
        id: row.learner_id,
        name: row.learner_name,
        conceptsCovered: conceptCoverage,
        conceptCoverageEvidence: conceptEvidence,
        errorHistory: errorHistory,
        interactionCount: row.interaction_count,
        currentStrategy: row.strategy,
        preferences: preferences,
        createdAt: row.last_activity_at ? new Date(row.last_activity_at).getTime() : Date.now(),
        lastActive: row.last_activity_at ? new Date(row.last_activity_at).getTime() : Date.now(),
        extendedData: extendedData,
      });
    } catch {
      // Skip invalid rows
    }
  }
  
  return profiles;
}

/**
 * Update learner's last active timestamp
 */
export async function updateLearnerActivity(learnerId: string): Promise<void> {
  const profile = await getLearnerProfile(learnerId);
  if (profile) {
    profile.lastActive = Date.now();
    await saveLearnerProfile(profile);
  }
}

/**
 * Update profile from a single event
 * Derives state changes from interaction events
 */
export async function updateProfileFromEvent(
  learnerId: string,
  event: CreateInteractionRequest
): Promise<LearnerProfile | null> {
  // Get current profile or create default
  let profile = await getLearnerProfile(learnerId);
  if (!profile) {
    const learner = await getLearnerById(learnerId);
    if (!learner) return null;
    profile = {
      id: learnerId,
      name: learner.name,
      conceptsCovered: [],
      conceptCoverageEvidence: {},
      errorHistory: {},
      interactionCount: 0,
      currentStrategy: 'adaptive',
      preferences: {
        escalationThreshold: 2,
        aggregationDelay: 300000,
        autoTextbookEnabled: true,
        notificationsEnabled: true,
      },
      createdAt: Date.now(),
      lastActive: Date.now(),
      extendedData: {},
    };
  }

  // Update interaction count and last active
  profile.interactionCount++;
  profile.lastActive = Date.now();

  // Update error history
  if (event.eventType === 'error' && event.errorSubtypeId) {
    profile.errorHistory[event.errorSubtypeId] = 
      (profile.errorHistory[event.errorSubtypeId] || 0) + 1;
  }

  // Update concept coverage evidence
  if (event.conceptIds && event.conceptIds.length > 0) {
    for (const conceptId of event.conceptIds) {
      // Add to covered concepts if not present
      if (!profile.conceptsCovered.includes(conceptId)) {
        profile.conceptsCovered.push(conceptId);
      }

      // Initialize or get existing evidence
      if (!profile.conceptCoverageEvidence[conceptId]) {
        profile.conceptCoverageEvidence[conceptId] = {
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
      }

      const evidence = profile.conceptCoverageEvidence[conceptId];
      evidence.lastUpdated = Date.now();

      // Update based on event type
      switch (event.eventType) {
        case 'execution':
          if (event.metadata?.successful || event.payload?.successful) {
            evidence.evidenceCounts.successfulExecution++;
            evidence.streakCorrect++;
            evidence.streakIncorrect = 0;
            // Increase score on success
            evidence.score = Math.min(100, evidence.score + 5);
          }
          break;

        case 'error':
          evidence.evidenceCounts.errorEncountered++;
          evidence.streakIncorrect++;
          evidence.streakCorrect = 0;
          // Decrease score on error
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

      // Update confidence based on evidence quantity
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

  // Save updated profile
  await saveLearnerProfile(profile);
  return profile;
}

/**
 * Append multiple event-derived updates to a learner profile
 * Optimized for batch processing of events
 */
export async function appendProfileEvents(
  learnerId: string,
  events: CreateInteractionRequest[]
): Promise<LearnerProfile | null> {
  // Get current profile
  let profile = await getLearnerProfile(learnerId);
  if (!profile) {
    const learner = await getLearnerById(learnerId);
    if (!learner) return null;
    profile = {
      id: learnerId,
      name: learner.name,
      conceptsCovered: [],
      conceptCoverageEvidence: {},
      errorHistory: {},
      interactionCount: 0,
      currentStrategy: 'adaptive',
      preferences: {
        escalationThreshold: 2,
        aggregationDelay: 300000,
        autoTextbookEnabled: true,
        notificationsEnabled: true,
      },
      createdAt: Date.now(),
      lastActive: Date.now(),
      extendedData: {},
    };
  }

  // Process each event
  for (const event of events) {
    profile.interactionCount++;
    profile.lastActive = Date.now();

    // Update error history
    if (event.eventType === 'error' && event.errorSubtypeId) {
      profile.errorHistory[event.errorSubtypeId] = 
        (profile.errorHistory[event.errorSubtypeId] || 0) + 1;
    }

    // Update concept coverage evidence
    if (event.conceptIds && event.conceptIds.length > 0) {
      for (const conceptId of event.conceptIds) {
        if (!profile.conceptsCovered.includes(conceptId)) {
          profile.conceptsCovered.push(conceptId);
        }

        if (!profile.conceptCoverageEvidence[conceptId]) {
          profile.conceptCoverageEvidence[conceptId] = {
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
        }

        const evidence = profile.conceptCoverageEvidence[conceptId];
        evidence.lastUpdated = Date.now();

        switch (event.eventType) {
          case 'execution':
            if (event.metadata?.successful || event.payload?.successful) {
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
  }

  await saveLearnerProfile(profile);
  return profile;
}

// ============================================================================
// Interaction Operations
// ============================================================================

export async function createInteraction(id: string, data: CreateInteractionRequest): Promise<Interaction> {
  const db = getDb();
  const now = new Date().toISOString();

  // Build full payload with ALL fields for lossless storage
  const fullPayload = buildInteractionPayload(data);

  await runAsync(db, `
    INSERT INTO interactions (id, learner_id, session_id, timestamp, event_type, problem_id, payload, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    id,
    data.learnerId,
    data.sessionId || null,
    data.timestamp,
    data.eventType,
    data.problemId,
    JSON.stringify(fullPayload),
    now
  ]);

  // Also update the learner profile from this event
  await updateProfileFromEvent(data.learnerId, data);

  // Return full interaction with all fields
  return rowToInteraction({
    id,
    learner_id: data.learnerId,
    session_id: data.sessionId || null,
    timestamp: data.timestamp,
    event_type: data.eventType,
    problem_id: data.problemId,
    payload: JSON.stringify(fullPayload),
    created_at: now,
  });
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
    
    // Build full payload with ALL fields for lossless storage
    const fullPayload = buildInteractionPayload(event);

    await new Promise<void>((resolve, reject) => {
      stmt.run([
        id,
        event.learnerId,
        event.sessionId || null,
        event.timestamp,
        event.eventType,
        event.problemId,
        JSON.stringify(fullPayload),
        now
      ], (err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    // Reconstruct full interaction from stored data
    interactions.push(rowToInteraction({
      id,
      learner_id: event.learnerId,
      session_id: event.sessionId || null,
      timestamp: event.timestamp,
      event_type: event.eventType,
      problem_id: event.problemId,
      payload: JSON.stringify(fullPayload),
      created_at: now,
    }));
    
    // Update profile from this event
    await updateProfileFromEvent(event.learnerId, event);
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

/**
 * Build full payload from CreateInteractionRequest
 * Stores ALL fields for lossless replay
 */
function buildInteractionPayload(data: CreateInteractionRequest): Record<string, unknown> {
  return {
    // Problem context
    problemSetId: data.problemSetId,
    problemNumber: data.problemNumber,
    
    // Code/Error fields
    code: data.code,
    error: data.error,
    errorSubtypeId: data.errorSubtypeId,
    executionTimeMs: data.executionTimeMs,
    
    // Hint/Explanation fields
    hintId: data.hintId,
    explanationId: data.explanationId,
    hintText: data.hintText,
    hintLevel: data.hintLevel,
    helpRequestIndex: data.helpRequestIndex,
    sqlEngageSubtype: data.sqlEngageSubtype,
    sqlEngageRowId: data.sqlEngageRowId,
    
    // Policy/Execution fields
    policyVersion: data.policyVersion,
    timeSpent: data.timeSpent,
    successful: data.successful,
    ruleFired: data.ruleFired,
    templateId: data.templateId,
    inputHash: data.inputHash,
    model: data.model,
    
    // Textbook fields
    noteId: data.noteId,
    noteTitle: data.noteTitle,
    noteContent: data.noteContent,
    
    // Source/Retrieval fields
    retrievedSourceIds: data.retrievedSourceIds,
    retrievedChunks: data.retrievedChunks,
    triggerInteractionIds: data.triggerInteractionIds,
    evidenceInteractionIds: data.evidenceInteractionIds,
    sourceInteractionIds: data.sourceInteractionIds,
    
    // I/O fields
    inputs: data.inputs,
    outputs: data.outputs,
    
    // Concept fields
    conceptId: data.conceptId,
    conceptIds: data.conceptIds,
    
    // Guidance Ladder fields
    requestType: data.requestType,
    currentRung: data.currentRung,
    rung: data.rung,
    grounded: data.grounded,
    contentLength: data.contentLength,
    fromRung: data.fromRung,
    toRung: data.toRung,
    trigger: data.trigger,
    
    // Textbook Unit fields
    unitId: data.unitId,
    action: data.action,
    dedupeKey: data.dedupeKey,
    revisionCount: data.revisionCount,
    
    // Source view fields
    passageCount: data.passageCount,
    expanded: data.expanded,
    
    // Chat fields
    chatMessage: data.chatMessage,
    chatResponse: data.chatResponse,
    chatQuickChip: data.chatQuickChip,
    savedToNotes: data.savedToNotes,
    textbookUnitsRetrieved: data.textbookUnitsRetrieved,
    
    // Escalation Profile fields (Week 5)
    profileId: data.profileId,
    assignmentStrategy: data.assignmentStrategy,
    previousThresholds: data.previousThresholds,
    newThresholds: data.newThresholds,
    
    // Bandit fields (Week 5)
    selectedArm: data.selectedArm,
    selectionMethod: data.selectionMethod,
    armStatsAtSelection: data.armStatsAtSelection,
    reward: data.reward,
    newAlpha: data.newAlpha,
    newBeta: data.newBeta,
    
    // HDI fields
    hdi: data.hdi,
    hdiLevel: data.hdiLevel,
    hdiComponents: data.hdiComponents,
    trend: data.trend,
    slope: data.slope,
    interventionType: data.interventionType,
    
    // Reinforcement fields
    scheduleId: data.scheduleId,
    promptId: data.promptId,
    promptType: data.promptType,
    response: data.response,
    isCorrect: data.isCorrect,
    scheduledTime: data.scheduledTime,
    shownTime: data.shownTime,
    
    // Legacy fields
    payload: data.payload,
    metadata: data.metadata,
  };
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
  // Parse payload which contains all extended fields
  const payload = JSON.parse(row.payload) as Record<string, unknown>;
  
  return {
    // Core fields from columns
    id: row.id,
    learnerId: row.learner_id,
    sessionId: row.session_id,
    timestamp: row.timestamp,
    eventType: row.event_type,
    problemId: row.problem_id,
    createdAt: row.created_at,
    
    // Problem context from payload
    problemSetId: payload.problemSetId as string | undefined,
    problemNumber: payload.problemNumber as number | undefined,
    
    // Code/Error fields from payload
    code: payload.code as string | undefined,
    error: payload.error as string | undefined,
    errorSubtypeId: payload.errorSubtypeId as string | undefined,
    executionTimeMs: payload.executionTimeMs as number | undefined,
    
    // Hint/Explanation fields from payload
    hintId: payload.hintId as string | undefined,
    explanationId: payload.explanationId as string | undefined,
    hintText: payload.hintText as string | undefined,
    hintLevel: payload.hintLevel as number | undefined,
    helpRequestIndex: payload.helpRequestIndex as number | undefined,
    sqlEngageSubtype: payload.sqlEngageSubtype as string | undefined,
    sqlEngageRowId: payload.sqlEngageRowId as string | undefined,
    
    // Policy/Execution fields from payload
    policyVersion: payload.policyVersion as string | undefined,
    timeSpent: payload.timeSpent as number | undefined,
    successful: payload.successful as boolean | undefined,
    ruleFired: payload.ruleFired as string | undefined,
    templateId: payload.templateId as string | undefined,
    inputHash: payload.inputHash as string | undefined,
    model: payload.model as string | undefined,
    
    // Textbook fields from payload
    noteId: payload.noteId as string | undefined,
    noteTitle: payload.noteTitle as string | undefined,
    noteContent: payload.noteContent as string | undefined,
    
    // Source/Retrieval fields from payload
    retrievedSourceIds: payload.retrievedSourceIds as string[] | undefined,
    retrievedChunks: payload.retrievedChunks as Interaction['retrievedChunks'],
    triggerInteractionIds: payload.triggerInteractionIds as string[] | undefined,
    evidenceInteractionIds: payload.evidenceInteractionIds as string[] | undefined,
    sourceInteractionIds: payload.sourceInteractionIds as string[] | undefined,
    
    // I/O fields from payload
    inputs: payload.inputs as Interaction['inputs'],
    outputs: payload.outputs as Interaction['outputs'],
    
    // Concept fields from payload
    conceptId: payload.conceptId as string | undefined,
    conceptIds: payload.conceptIds as string[] | undefined,
    
    // Guidance Ladder fields from payload
    requestType: payload.requestType as 'hint' | 'explanation' | 'textbook' | undefined,
    currentRung: payload.currentRung as number | undefined,
    rung: payload.rung as number | undefined,
    grounded: payload.grounded as boolean | undefined,
    contentLength: payload.contentLength as number | undefined,
    fromRung: payload.fromRung as number | undefined,
    toRung: payload.toRung as number | undefined,
    trigger: payload.trigger as string | undefined,
    
    // Textbook Unit fields from payload
    unitId: payload.unitId as string | undefined,
    action: payload.action as 'created' | 'updated' | undefined,
    dedupeKey: payload.dedupeKey as string | undefined,
    revisionCount: payload.revisionCount as number | undefined,
    
    // Source view fields from payload
    passageCount: payload.passageCount as number | undefined,
    expanded: payload.expanded as boolean | undefined,
    
    // Chat fields from payload
    chatMessage: payload.chatMessage as string | undefined,
    chatResponse: payload.chatResponse as string | undefined,
    chatQuickChip: payload.chatQuickChip as string | undefined,
    savedToNotes: payload.savedToNotes as boolean | undefined,
    textbookUnitsRetrieved: payload.textbookUnitsRetrieved as string[] | undefined,
    
    // Escalation Profile fields from payload
    profileId: payload.profileId as string | undefined,
    assignmentStrategy: payload.assignmentStrategy as 'static' | 'diagnostic' | 'bandit' | undefined,
    previousThresholds: payload.previousThresholds as { escalate: number; aggregate: number } | undefined,
    newThresholds: payload.newThresholds as { escalate: number; aggregate: number } | undefined,
    
    // Bandit fields from payload
    selectedArm: payload.selectedArm as string | undefined,
    selectionMethod: payload.selectionMethod as 'thompson_sampling' | 'epsilon_greedy' | undefined,
    armStatsAtSelection: payload.armStatsAtSelection as Record<string, { mean: number; pulls: number }> | undefined,
    reward: payload.reward as Interaction['reward'],
    newAlpha: payload.newAlpha as number | undefined,
    newBeta: payload.newBeta as number | undefined,
    
    // HDI fields from payload
    hdi: payload.hdi as number | undefined,
    hdiLevel: payload.hdiLevel as 'low' | 'medium' | 'high' | undefined,
    hdiComponents: payload.hdiComponents as Interaction['hdiComponents'],
    trend: payload.trend as 'increasing' | 'stable' | 'decreasing' | undefined,
    slope: payload.slope as number | undefined,
    interventionType: payload.interventionType as 'forced_independent' | 'profile_switch' | 'reflective_prompt' | undefined,
    
    // Reinforcement fields from payload
    scheduleId: payload.scheduleId as string | undefined,
    promptId: payload.promptId as string | undefined,
    promptType: payload.promptType as 'mcq' | 'sql_completion' | 'concept_explanation' | undefined,
    response: payload.response as string | undefined,
    isCorrect: payload.isCorrect as boolean | undefined,
    scheduledTime: payload.scheduledTime as number | undefined,
    shownTime: payload.shownTime as number | undefined,
    
    // Legacy payload/metadata for extensibility
    payload: payload.payload as Record<string, unknown> | undefined,
    metadata: payload.metadata as Record<string, unknown> | undefined,
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
