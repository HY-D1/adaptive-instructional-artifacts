/**
 * SQL-Adapt Database Layer - Neon PostgreSQL
 * Production-ready database implementation using Neon serverless PostgreSQL
 *
 * Features:
 * - Connection pooling via @neondatabase/serverless
 * - Type-safe query wrappers
 * - Automatic JSON serialization for complex fields
 * - Foreign key constraints with CASCADE delete
 */

import { neon, neonConfig, NeonQueryFunction } from '@neondatabase/serverless';
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
// Configuration
// ============================================================================

const DATABASE_URL = process.env.DATABASE_URL || process.env.NEON_DATABASE_URL;

if (!DATABASE_URL && process.env.NODE_ENV === 'production') {
  console.error('ERROR: DATABASE_URL environment variable is required in production');
}

// Configure Neon for serverless environment
neonConfig.fetchConnectionCache = true;

// ============================================================================
// Database Instance
// ============================================================================

let sql: NeonQueryFunction<false, false> | null = null;

export function getDb(): NeonQueryFunction<false, false> {
  if (!sql) {
    if (!DATABASE_URL) {
      throw new Error('DATABASE_URL environment variable is not set');
    }
    sql = neon(DATABASE_URL);
  }
  return sql;
}

export function resetDb(): void {
  sql = null;
}

// ============================================================================
// Schema Initialization
// ============================================================================

export async function initializeSchema(): Promise<void> {
  const db = getDb();

  // Users table (minimal auth identity)
  await db`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('student', 'instructor')),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await db`CREATE INDEX IF NOT EXISTS idx_users_role ON users(role)`;

  // Learner sessions (experimental condition tracking)
  await db`
    CREATE TABLE IF NOT EXISTS learner_sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      session_id TEXT NOT NULL,
      condition_id TEXT NOT NULL,
      textbook_disabled BOOLEAN NOT NULL DEFAULT FALSE,
      adaptive_ladder_disabled BOOLEAN NOT NULL DEFAULT FALSE,
      immediate_explanation_mode BOOLEAN NOT NULL DEFAULT FALSE,
      static_hint_mode BOOLEAN NOT NULL DEFAULT FALSE,
      escalation_policy TEXT NOT NULL DEFAULT 'adaptive',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(user_id, session_id)
    )
  `;

  await db`CREATE INDEX IF NOT EXISTS idx_learner_sessions_user_id ON learner_sessions(user_id)`;
  await db`CREATE INDEX IF NOT EXISTS idx_learner_sessions_session_id ON learner_sessions(session_id)`;

  // Problem progress
  await db`
    CREATE TABLE IF NOT EXISTS problem_progress (
      id SERIAL PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      problem_id TEXT NOT NULL,
      solved BOOLEAN NOT NULL DEFAULT FALSE,
      attempts_count INTEGER NOT NULL DEFAULT 0,
      hints_used INTEGER NOT NULL DEFAULT 0,
      last_code TEXT,
      first_attempted_at TIMESTAMPTZ,
      solved_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(user_id, problem_id)
    )
  `;

  await db`CREATE INDEX IF NOT EXISTS idx_problem_progress_user_id ON problem_progress(user_id)`;
  await db`CREATE INDEX IF NOT EXISTS idx_problem_progress_problem_id ON problem_progress(problem_id)`;

  // Interaction events (append-only research log)
  await db`
    CREATE TABLE IF NOT EXISTS interaction_events (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      session_id TEXT,
      timestamp TIMESTAMPTZ NOT NULL,
      event_type TEXT NOT NULL,
      problem_id TEXT NOT NULL,
      problem_set_id TEXT,
      problem_number INTEGER,
      code TEXT,
      error TEXT,
      error_subtype_id TEXT,
      hint_id TEXT,
      explanation_id TEXT,
      hint_text TEXT,
      hint_level INTEGER,
      help_request_index INTEGER,
      sql_engage_subtype TEXT,
      sql_engage_row_id TEXT,
      policy_version TEXT,
      time_spent INTEGER,
      successful BOOLEAN,
      rule_fired TEXT,
      template_id TEXT,
      input_hash TEXT,
      model TEXT,
      note_id TEXT,
      note_title TEXT,
      note_content TEXT,
      retrieved_source_ids TEXT,
      retrieved_chunks TEXT,
      trigger_interaction_ids TEXT,
      evidence_interaction_ids TEXT,
      source_interaction_ids TEXT,
      inputs TEXT,
      outputs TEXT,
      concept_ids TEXT,
      request_type TEXT,
      current_rung INTEGER,
      rung INTEGER,
      grounded BOOLEAN,
      content_length INTEGER,
      from_rung INTEGER,
      to_rung INTEGER,
      trigger_reason TEXT,
      unit_id TEXT,
      action TEXT,
      dedupe_key TEXT,
      revision_count INTEGER,
      passage_count INTEGER,
      expanded BOOLEAN,
      chat_message TEXT,
      chat_response TEXT,
      chat_quick_chip TEXT,
      saved_to_notes BOOLEAN,
      textbook_units_retrieved TEXT,
      profile_id TEXT,
      assignment_strategy TEXT,
      previous_thresholds TEXT,
      new_thresholds TEXT,
      selected_arm TEXT,
      selection_method TEXT,
      arm_stats_at_selection TEXT,
      reward_total NUMERIC,
      reward_components TEXT,
      new_alpha NUMERIC,
      new_beta NUMERIC,
      hdi NUMERIC,
      hdi_level TEXT,
      hdi_components TEXT,
      trend TEXT,
      slope NUMERIC,
      intervention_type TEXT,
      schedule_id TEXT,
      prompt_id TEXT,
      prompt_type TEXT,
      response TEXT,
      is_correct BOOLEAN,
      scheduled_time BIGINT,
      shown_time BIGINT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await db`CREATE INDEX IF NOT EXISTS idx_interaction_events_user_id ON interaction_events(user_id)`;
  await db`CREATE INDEX IF NOT EXISTS idx_interaction_events_session_id ON interaction_events(session_id)`;
  await db`CREATE INDEX IF NOT EXISTS idx_interaction_events_event_type ON interaction_events(event_type)`;
  await db`CREATE INDEX IF NOT EXISTS idx_interaction_events_timestamp ON interaction_events(timestamp)`;
  await db`CREATE INDEX IF NOT EXISTS idx_interaction_events_problem_id ON interaction_events(problem_id)`;

  // Textbook units (My Textbook)
  await db`
    CREATE TABLE IF NOT EXISTS textbook_units (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      unit_id TEXT NOT NULL,
      type TEXT NOT NULL CHECK (type IN ('hint', 'explanation', 'example', 'summary')),
      concept_ids TEXT NOT NULL DEFAULT '[]',
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      content_format TEXT NOT NULL DEFAULT 'markdown' CHECK (content_format IN ('markdown', 'html')),
      source_interaction_ids TEXT NOT NULL DEFAULT '[]',
      status TEXT NOT NULL DEFAULT 'primary' CHECK (status IN ('primary', 'alternative', 'archived')),
      summary TEXT,
      common_mistakes TEXT,
      minimal_example TEXT,
      source_ref_ids TEXT,
      created_from_interaction_ids TEXT,
      revision_count INTEGER NOT NULL DEFAULT 0,
      quality_score NUMERIC,
      auto_created BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(user_id, unit_id)
    )
  `;

  await db`CREATE INDEX IF NOT EXISTS idx_textbook_units_user_id ON textbook_units(user_id)`;
  await db`CREATE INDEX IF NOT EXISTS idx_textbook_units_unit_id ON textbook_units(unit_id)`;
  await db`CREATE INDEX IF NOT EXISTS idx_textbook_units_type ON textbook_units(type)`;

  // Textbook unit event links (provenance)
  await db`
    CREATE TABLE IF NOT EXISTS textbook_unit_event_links (
      id SERIAL PRIMARY KEY,
      unit_id TEXT NOT NULL REFERENCES textbook_units(id) ON DELETE CASCADE,
      event_id TEXT NOT NULL REFERENCES interaction_events(id) ON DELETE CASCADE,
      link_type TEXT NOT NULL DEFAULT 'trigger',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(unit_id, event_id, link_type)
    )
  `;

  await db`CREATE INDEX IF NOT EXISTS idx_textbook_unit_event_links_unit_id ON textbook_unit_event_links(unit_id)`;
  await db`CREATE INDEX IF NOT EXISTS idx_textbook_unit_event_links_event_id ON textbook_unit_event_links(event_id)`;

  console.log('✅ Neon PostgreSQL schema initialized');
}

// ============================================================================
// User Operations
// ============================================================================

export async function createUser(id: string, data: CreateLearnerRequest): Promise<Learner> {
  const db = getDb();
  const now = new Date().toISOString();

  const [result] = await db`
    INSERT INTO users (id, name, role, created_at, updated_at)
    VALUES (${id}, ${data.name}, ${data.role}, ${now}, ${now})
    RETURNING id, name, role, created_at, updated_at
  `;

  return rowToLearner(result);
}

export async function getUserById(id: string): Promise<Learner | null> {
  const db = getDb();
  const [result] = await db`SELECT * FROM users WHERE id = ${id}`;
  return result ? rowToLearner(result) : null;
}

export async function getAllUsers(): Promise<Learner[]> {
  const db = getDb();
  const results = await db`SELECT * FROM users ORDER BY created_at DESC`;
  return results.map(rowToLearner);
}

export async function updateUser(id: string, data: UpdateLearnerRequest): Promise<Learner | null> {
  const db = getDb();
  const existing = await getUserById(id);
  if (!existing) return null;

  const updates: string[] = [];
  const values: (string | null)[] = [];
  let paramIndex = 1;

  if (data.name !== undefined) {
    updates.push(`name = $${paramIndex++}`);
    values.push(data.name);
  }
  if (data.role !== undefined) {
    updates.push(`role = $${paramIndex++}`);
    values.push(data.role);
  }

  updates.push(`updated_at = $${paramIndex++}`);
  values.push(new Date().toISOString());
  values.push(id);

  const query = `UPDATE users SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`;
  const [result] = await db.query(query, values);

  return result ? rowToLearner(result) : null;
}

export async function deleteUser(id: string): Promise<boolean> {
  const db = getDb();
  const result = await db`DELETE FROM users WHERE id = ${id}`;
  // Result is array of rows for SELECT, or empty array for DELETE
  return Array.isArray(result) && result.length === 0;
}

// ============================================================================
// Session Operations
// ============================================================================

export async function saveSession(
  userId: string,
  sessionId: string,
  conditionId: string,
  config: {
    textbookDisabled?: boolean;
    adaptiveLadderDisabled?: boolean;
    immediateExplanationMode?: boolean;
    staticHintMode?: boolean;
    escalationPolicy?: string;
  }
): Promise<void> {
  const db = getDb();
  const id = `${userId}-${sessionId}`;
  const now = new Date().toISOString();

  await db`
    INSERT INTO learner_sessions (
      id, user_id, session_id, condition_id,
      textbook_disabled, adaptive_ladder_disabled, immediate_explanation_mode,
      static_hint_mode, escalation_policy, created_at, updated_at
    ) VALUES (
      ${id}, ${userId}, ${sessionId}, ${conditionId},
      ${config.textbookDisabled ?? false}, ${config.adaptiveLadderDisabled ?? false},
      ${config.immediateExplanationMode ?? false}, ${config.staticHintMode ?? false},
      ${config.escalationPolicy ?? 'adaptive'}, ${now}, ${now}
    )
    ON CONFLICT (user_id, session_id) DO UPDATE SET
      condition_id = EXCLUDED.condition_id,
      textbook_disabled = EXCLUDED.textbook_disabled,
      adaptive_ladder_disabled = EXCLUDED.adaptive_ladder_disabled,
      immediate_explanation_mode = EXCLUDED.immediate_explanation_mode,
      static_hint_mode = EXCLUDED.static_hint_mode,
      escalation_policy = EXCLUDED.escalation_policy,
      updated_at = EXCLUDED.updated_at
  `;
}

export async function getSession(userId: string, sessionId: string): Promise<any | null> {
  const db = getDb();
  const [result] = await db`
    SELECT * FROM learner_sessions
    WHERE user_id = ${userId} AND session_id = ${sessionId}
  `;

  if (!result) return null;

  return {
    sessionId: result.session_id,
    conditionId: result.condition_id,
    textbookDisabled: result.textbook_disabled,
    adaptiveLadderDisabled: result.adaptive_ladder_disabled,
    immediateExplanationMode: result.immediate_explanation_mode,
    staticHintMode: result.static_hint_mode,
    escalationPolicy: result.escalation_policy,
    createdAt: new Date(result.created_at).getTime(),
    updatedAt: new Date(result.updated_at).getTime(),
  };
}

export async function getActiveSession(userId: string): Promise<any | null> {
  const db = getDb();
  const [result] = await db`
    SELECT * FROM learner_sessions
    WHERE user_id = ${userId}
    ORDER BY updated_at DESC
    LIMIT 1
  `;

  if (!result) return null;

  return {
    sessionId: result.session_id,
    conditionId: result.condition_id,
    textbookDisabled: result.textbook_disabled,
    adaptiveLadderDisabled: result.adaptive_ladder_disabled,
    immediateExplanationMode: result.immediate_explanation_mode,
    staticHintMode: result.static_hint_mode,
    escalationPolicy: result.escalation_policy,
    createdAt: new Date(result.created_at).getTime(),
    updatedAt: new Date(result.updated_at).getTime(),
  };
}

export async function clearSession(userId: string, sessionId: string): Promise<boolean> {
  const db = getDb();
  const result = await db`
    DELETE FROM learner_sessions
    WHERE user_id = ${userId} AND session_id = ${sessionId}
  `;
  return Array.isArray(result) && result.length === 0;
}

// ============================================================================
// Problem Progress Operations
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
  const db = getDb();
  const now = new Date().toISOString();

  // Try to insert first, then update if exists
  await db`
    INSERT INTO problem_progress (
      user_id, problem_id, solved, attempts_count, hints_used, last_code,
      first_attempted_at, solved_at, updated_at
    ) VALUES (
      ${userId}, ${problemId}, ${update.solved ?? false},
      ${update.incrementAttempts ? 1 : 0}, ${update.incrementHints ? 1 : 0},
      ${update.lastCode ?? null}, ${now}, ${update.solved ? now : null}, ${now}
    )
    ON CONFLICT (user_id, problem_id) DO UPDATE SET
      solved = CASE
        WHEN EXCLUDED.solved THEN TRUE
        ELSE problem_progress.solved
      END,
      attempts_count = problem_progress.attempts_count + ${update.incrementAttempts ? 1 : 0},
      hints_used = problem_progress.hints_used + ${update.incrementHints ? 1 : 0},
      last_code = COALESCE(EXCLUDED.last_code, problem_progress.last_code),
      solved_at = CASE
        WHEN EXCLUDED.solved AND NOT problem_progress.solved THEN EXCLUDED.solved_at
        ELSE problem_progress.solved_at
      END,
      updated_at = EXCLUDED.updated_at
  `;
}

export async function getProblemProgress(userId: string, problemId: string): Promise<any | null> {
  const db = getDb();
  const [result] = await db`
    SELECT * FROM problem_progress
    WHERE user_id = ${userId} AND problem_id = ${problemId}
  `;

  if (!result) return null;

  return {
    userId: result.user_id,
    problemId: result.problem_id,
    solved: result.solved,
    attemptsCount: result.attempts_count,
    hintsUsed: result.hints_used,
    lastCode: result.last_code,
    firstAttemptedAt: result.first_attempted_at ? new Date(result.first_attempted_at).getTime() : null,
    solvedAt: result.solved_at ? new Date(result.solved_at).getTime() : null,
  };
}

export async function getAllProblemProgress(userId: string): Promise<any[]> {
  const db = getDb();
  const results = await db`
    SELECT * FROM problem_progress
    WHERE user_id = ${userId}
    ORDER BY updated_at DESC
  `;

  return results.map(r => ({
    userId: r.user_id,
    problemId: r.problem_id,
    solved: r.solved,
    attemptsCount: r.attempts_count,
    hintsUsed: r.hints_used,
    lastCode: r.last_code,
    firstAttemptedAt: r.first_attempted_at ? new Date(r.first_attempted_at).getTime() : null,
    solvedAt: r.solved_at ? new Date(r.solved_at).getTime() : null,
  }));
}

// ============================================================================
// Interaction Event Operations
// ============================================================================

export async function createInteraction(data: CreateInteractionRequest & { id: string }): Promise<Interaction> {
  const db = getDb();
  const now = new Date().toISOString();

  const payload = data.payload || {};

  await db`
    INSERT INTO interaction_events (
      id, user_id, session_id, timestamp, event_type, problem_id,
      problem_set_id, problem_number, code, error, error_subtype_id,
      hint_id, explanation_id, hint_text, hint_level, help_request_index,
      sql_engage_subtype, sql_engage_row_id, policy_version, time_spent,
      successful, rule_fired, template_id, input_hash, model,
      note_id, note_title, note_content,
      retrieved_source_ids, retrieved_chunks, trigger_interaction_ids,
      evidence_interaction_ids, source_interaction_ids, inputs, outputs, concept_ids,
      request_type, current_rung, rung, grounded, content_length,
      from_rung, to_rung, trigger_reason, unit_id, action, dedupe_key,
      revision_count, passage_count, expanded, chat_message, chat_response,
      chat_quick_chip, saved_to_notes, textbook_units_retrieved,
      profile_id, assignment_strategy, previous_thresholds, new_thresholds,
      selected_arm, selection_method, arm_stats_at_selection, reward_total,
      reward_components, new_alpha, new_beta, hdi, hdi_level, hdi_components,
      trend, slope, intervention_type, schedule_id, prompt_id, prompt_type,
      response, is_correct, scheduled_time, shown_time, created_at
    ) VALUES (
      ${data.id},
      ${data.learnerId},
      ${payload.sessionId || null},
      ${new Date(data.timestamp).toISOString()},
      ${data.eventType},
      ${data.problemId},
      ${payload.problemSetId || null},
      ${payload.problemNumber || null},
      ${payload.code || null},
      ${payload.error || null},
      ${payload.errorSubtypeId || null},
      ${payload.hintId || null},
      ${payload.explanationId || null},
      ${payload.hintText || null},
      ${payload.hintLevel || null},
      ${payload.helpRequestIndex || null},
      ${payload.sqlEngageSubtype || null},
      ${payload.sqlEngageRowId || null},
      ${payload.policyVersion || null},
      ${payload.timeSpent || null},
      ${payload.successful ?? null},
      ${payload.ruleFired || null},
      ${payload.templateId || null},
      ${payload.inputHash || null},
      ${payload.model || null},
      ${payload.noteId || null},
      ${payload.noteTitle || null},
      ${payload.noteContent || null},
      ${JSON.stringify(payload.retrievedSourceIds || null)},
      ${JSON.stringify(payload.retrievedChunks || null)},
      ${JSON.stringify(payload.triggerInteractionIds || null)},
      ${JSON.stringify(payload.evidenceInteractionIds || null)},
      ${JSON.stringify(payload.sourceInteractionIds || null)},
      ${JSON.stringify(payload.inputs || null)},
      ${JSON.stringify(payload.outputs || null)},
      ${JSON.stringify(payload.conceptIds || null)},
      ${payload.requestType || null},
      ${payload.currentRung || null},
      ${payload.rung || null},
      ${payload.grounded ?? null},
      ${payload.contentLength || null},
      ${payload.fromRung || null},
      ${payload.toRung || null},
      ${payload.trigger || null},
      ${payload.unitId || null},
      ${payload.action || null},
      ${payload.dedupeKey || null},
      ${payload.revisionCount || null},
      ${payload.passageCount || null},
      ${payload.expanded ?? null},
      ${payload.chatMessage || null},
      ${payload.chatResponse || null},
      ${payload.chatQuickChip || null},
      ${payload.savedToNotes ?? null},
      ${JSON.stringify(payload.textbookUnitsRetrieved || null)},
      ${payload.profileId || null},
      ${payload.assignmentStrategy || null},
      ${JSON.stringify(payload.previousThresholds || null)},
      ${JSON.stringify(payload.newThresholds || null)},
      ${payload.selectedArm || null},
      ${payload.selectionMethod || null},
      ${JSON.stringify(payload.armStatsAtSelection || null)},
      ${(payload.reward as { total?: number } | undefined)?.total || null},
      ${JSON.stringify((payload.reward as { components?: unknown } | undefined)?.components || null)},
      ${payload.newAlpha || null},
      ${payload.newBeta || null},
      ${payload.hdi || null},
      ${payload.hdiLevel || null},
      ${JSON.stringify(payload.hdiComponents || null)},
      ${payload.trend || null},
      ${payload.slope || null},
      ${payload.interventionType || null},
      ${payload.scheduleId || null},
      ${payload.promptId || null},
      ${payload.promptType || null},
      ${payload.response || null},
      ${payload.isCorrect ?? null},
      ${payload.scheduledTime || null},
      ${payload.shownTime || null},
      ${now}
    )
  `;

  return {
    id: data.id,
    learnerId: data.learnerId,
    sessionId: (payload as { sessionId?: string }).sessionId || null,
    timestamp: data.timestamp,
    eventType: data.eventType,
    problemId: data.problemId,
    payload,
    createdAt: now,
  };
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
  const db = getDb();

  let query = db`SELECT * FROM interaction_events WHERE user_id = ${userId}`;
  let countQuery = db`SELECT COUNT(*) as count FROM interaction_events WHERE user_id = ${userId}`;

  if (options?.sessionId) {
    query = db`SELECT * FROM interaction_events WHERE user_id = ${userId} AND session_id = ${options.sessionId}`;
    countQuery = db`SELECT COUNT(*) as count FROM interaction_events WHERE user_id = ${userId} AND session_id = ${options.sessionId}`;
  }

  if (options?.eventType) {
    query = db`SELECT * FROM interaction_events WHERE user_id = ${userId} AND event_type = ${options.eventType}`;
    countQuery = db`SELECT COUNT(*) as count FROM interaction_events WHERE user_id = ${userId} AND event_type = ${options.eventType}`;
  }

  if (options?.problemId) {
    query = db`SELECT * FROM interaction_events WHERE user_id = ${userId} AND problem_id = ${options.problemId}`;
    countQuery = db`SELECT COUNT(*) as count FROM interaction_events WHERE user_id = ${userId} AND problem_id = ${options.problemId}`;
  }

  query = db`SELECT * FROM interaction_events WHERE user_id = ${userId} ORDER BY timestamp DESC`;

  if (options?.limit) {
    const offset = options.offset || 0;
    query = db`SELECT * FROM interaction_events WHERE user_id = ${userId} ORDER BY timestamp DESC LIMIT ${options.limit} OFFSET ${offset}`;
  }

  const [results, countResult] = await Promise.all([query, countQuery]);

  return {
    interactions: results.map(rowToInteraction),
    total: parseInt((countResult[0]?.count ?? 0).toString(), 10),
  };
}

export async function getInteractionById(id: string): Promise<Interaction | null> {
  const db = getDb();
  const [result] = await db`SELECT * FROM interaction_events WHERE id = ${id}`;
  return result ? rowToInteraction(result) : null;
}

// ============================================================================
// Textbook Unit Operations
// ============================================================================

export async function createTextbookUnit(
  userId: string,
  data: CreateUnitRequest & { unitId: string }
): Promise<InstructionalUnit> {
  const db = getDb();
  const now = new Date().toISOString();
  const id = `${userId}-${data.unitId}`;

  await db`
    INSERT INTO textbook_units (
      id, user_id, unit_id, type, concept_ids, title, content,
      content_format, source_interaction_ids, status, summary,
      common_mistakes, minimal_example, source_ref_ids,
      created_from_interaction_ids, revision_count, quality_score,
      auto_created, created_at, updated_at
    ) VALUES (
      ${id}, ${userId}, ${data.unitId}, ${data.type},
      ${JSON.stringify(data.conceptIds || [])},
      ${data.title}, ${data.content},
      ${data.contentFormat || 'markdown'},
      ${JSON.stringify(data.sourceInteractionIds || [])},
      ${data.status || 'primary'},
      ${(data as { summary?: string }).summary || null},
      ${JSON.stringify((data as { commonMistakes?: unknown }).commonMistakes || null)},
      ${(data as { minimalExample?: string }).minimalExample || null},
      ${JSON.stringify((data as { sourceRefIds?: unknown }).sourceRefIds || null)},
      ${JSON.stringify((data as { createdFromInteractionIds?: unknown }).createdFromInteractionIds || null)},
      ${(data as { revisionCount?: number }).revisionCount || 0},
      ${(data as { qualityScore?: number }).qualityScore || null},
      ${(data as { autoCreated?: boolean }).autoCreated ?? false},
      ${now}, ${now}
    )
    ON CONFLICT (user_id, unit_id) DO UPDATE SET
      type = EXCLUDED.type,
      concept_ids = EXCLUDED.concept_ids,
      title = EXCLUDED.title,
      content = EXCLUDED.content,
      content_format = EXCLUDED.content_format,
      source_interaction_ids = EXCLUDED.source_interaction_ids,
      status = EXCLUDED.status,
      summary = EXCLUDED.summary,
      common_mistakes = EXCLUDED.common_mistakes,
      minimal_example = EXCLUDED.minimal_example,
      source_ref_ids = EXCLUDED.source_ref_ids,
      created_from_interaction_ids = EXCLUDED.created_from_interaction_ids,
      revision_count = textbook_units.revision_count + 1,
      quality_score = EXCLUDED.quality_score,
      updated_at = EXCLUDED.updated_at
  `;

  const [result] = await db`SELECT * FROM textbook_units WHERE id = ${id}`;
  return rowToInstructionalUnit(result);
}

export async function getTextbookUnitsByUser(userId: string): Promise<InstructionalUnit[]> {
  const db = getDb();
  const results = await db`
    SELECT * FROM textbook_units
    WHERE user_id = ${userId}
    ORDER BY created_at DESC
  `;
  return results.map(rowToInstructionalUnit);
}

export async function getTextbookUnitById(userId: string, unitId: string): Promise<InstructionalUnit | null> {
  const db = getDb();
  const id = `${userId}-${unitId}`;
  const [result] = await db`SELECT * FROM textbook_units WHERE id = ${id}`;
  return result ? rowToInstructionalUnit(result) : null;
}

export async function deleteTextbookUnit(userId: string, unitId: string): Promise<boolean> {
  const db = getDb();
  const id = `${userId}-${unitId}`;
  const result = await db`DELETE FROM textbook_units WHERE id = ${id}`;
  return Array.isArray(result) && result.length === 0;
}

// ============================================================================
// Helper Functions
// ============================================================================

function rowToLearner(row: any): Learner {
  return {
    id: row.id,
    name: row.name,
    role: row.role,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function rowToInteraction(row: any): Interaction {
  return {
    id: row.id,
    learnerId: row.user_id,
    sessionId: row.session_id,
    timestamp: new Date(row.timestamp).toISOString(),
    eventType: row.event_type,
    problemId: row.problem_id,
    payload: {
      problemSetId: row.problem_set_id,
      problemNumber: row.problem_number,
      code: row.code,
      error: row.error,
      errorSubtypeId: row.error_subtype_id,
      hintId: row.hint_id,
      explanationId: row.explanation_id,
      hintText: row.hint_text,
      hintLevel: row.hint_level,
      helpRequestIndex: row.help_request_index,
      sqlEngageSubtype: row.sql_engage_subtype,
      sqlEngageRowId: row.sql_engage_row_id,
      policyVersion: row.policy_version,
      timeSpent: row.time_spent,
      successful: row.successful,
      ruleFired: row.rule_fired,
      templateId: row.template_id,
      inputHash: row.input_hash,
      model: row.model,
      noteId: row.note_id,
      noteTitle: row.note_title,
      noteContent: row.note_content,
      retrievedSourceIds: parseJson(row.retrieved_source_ids),
      retrievedChunks: parseJson(row.retrieved_chunks),
      triggerInteractionIds: parseJson(row.trigger_interaction_ids),
      evidenceInteractionIds: parseJson(row.evidence_interaction_ids),
      sourceInteractionIds: parseJson(row.source_interaction_ids),
      inputs: parseJson(row.inputs),
      outputs: parseJson(row.outputs),
      conceptIds: parseJson(row.concept_ids),
      requestType: row.request_type,
      currentRung: row.current_rung,
      rung: row.rung,
      grounded: row.grounded,
      contentLength: row.content_length,
      fromRung: row.from_rung,
      toRung: row.to_rung,
      trigger: row.trigger_reason,
      unitId: row.unit_id,
      action: row.action,
      dedupeKey: row.dedupe_key,
      revisionCount: row.revision_count,
      passageCount: row.passage_count,
      expanded: row.expanded,
      chatMessage: row.chat_message,
      chatResponse: row.chat_response,
      chatQuickChip: row.chat_quick_chip,
      savedToNotes: row.saved_to_notes,
      textbookUnitsRetrieved: parseJson(row.textbook_units_retrieved),
      profileId: row.profile_id,
      assignmentStrategy: row.assignment_strategy,
      previousThresholds: parseJson(row.previous_thresholds),
      newThresholds: parseJson(row.new_thresholds),
      selectedArm: row.selected_arm,
      selectionMethod: row.selection_method,
      armStatsAtSelection: parseJson(row.arm_stats_at_selection),
      reward: row.reward_total !== null ? {
        total: row.reward_total,
        components: parseJson(row.reward_components),
      } : undefined,
      newAlpha: row.new_alpha,
      newBeta: row.new_beta,
      hdi: row.hdi,
      hdiLevel: row.hdi_level,
      hdiComponents: parseJson(row.hdi_components),
      trend: row.trend,
      slope: row.slope,
      interventionType: row.intervention_type,
      scheduleId: row.schedule_id,
      promptId: row.prompt_id,
      promptType: row.prompt_type,
      response: row.response,
      isCorrect: row.is_correct,
      scheduledTime: row.scheduled_time,
      shownTime: row.shown_time,
    },
    createdAt: row.created_at,
  };
}

function rowToInstructionalUnit(row: any): InstructionalUnit {
  return {
    id: row.id,
    learnerId: row.user_id,
    unitId: row.unit_id,
    type: row.type,
    conceptIds: parseJson(row.concept_ids) || [],
    title: row.title,
    content: row.content,
    contentFormat: row.content_format,
    sourceInteractionIds: parseJson(row.source_interaction_ids) || [],
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function parseJson(value: string | null): any {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}
