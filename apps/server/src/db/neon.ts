/**
 * SQL-Adapt Database Layer - Neon PostgreSQL
 * Production-ready database implementation using Neon serverless PostgreSQL
 *
 * Features:
 * - Connection pooling via @neondatabase/serverless
 * - Type-safe query wrappers
 * - Automatic JSON serialization for complex fields
 * - Foreign key constraints with CASCADE delete
 * - Race-condition safe progress updates using atomic operations and row locking
 */

import { createHash } from 'node:crypto';

import { neon, neonConfig, NeonQueryFunction } from '@neondatabase/serverless';
import { resolveDbEnv } from './env-resolver.js';
import { initAuthSchema } from './auth.js';
import type {
  Learner,
  CreateLearnerRequest,
  UpdateLearnerRequest,
  Interaction,
  CreateInteractionRequest,
  InstructionalUnit,
  CreateUnitRequest,
  LearnerProfile,
  SessionData,
} from '../types.js';

export interface CorpusManifestDocumentRow {
  docId: string;
  title: string;
  filename: string;
  sha256: string;
  pageCount: number;
  parserBackend: string;
  pipelineVersion: string;
  runId: string | null;
  activeRunId: string | null;
  activeRunUpdatedAt: string | null;
  activeRunUpdatedBy: string | null;
  unitCount: number;
  chunkCount: number;
  createdAt: string;
}

export interface CorpusUnitRow {
  unitId: string;
  docId: string;
  conceptId: string | null;
  title: string;
  summary: string;
  contentMarkdown: string;
  difficulty: string | null;
  pageStart: number;
  pageEnd: number;
  runId: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

export interface CorpusChunkRow {
  chunkId: string;
  unitId: string;
  docId: string;
  page: number;
  chunkText: string;
  runId: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

export interface CorpusActiveRunRow {
  docId: string;
  runId: string;
  updatedAt: string;
  updatedBy: string | null;
}

export interface AuthEventRow {
  id: string;
  timestamp: string;
  emailHash: string;
  accountId: string | null;
  learnerId: string | null;
  role: 'student' | 'instructor' | null;
  outcome: 'success' | 'failure';
  failureReason: string | null;
  createdAt: string;
}

export interface CreateAuthEventRequest {
  email: string;
  accountId?: string | null;
  learnerId?: string | null;
  role?: 'student' | 'instructor' | null;
  outcome: 'success' | 'failure';
  failureReason?: string | null;
}

export const DEFAULT_ACTIVE_CORPUS_DOC_ID = 'dbms-ramakrishnan-3rd-edition';
export const DEFAULT_ACTIVE_CORPUS_RUN_ID = 'run-1774671570-b1353117';

// Configure Neon for serverless environment
neonConfig.fetchConnectionCache = true;

// ============================================================================
// Database Instance
// ============================================================================

let sql: NeonQueryFunction<false, false> | null = null;

function getDatabaseUrl(): string {
  const { url, source } = resolveDbEnv();
  if (!url) {
    throw new Error(
      `No database URL found. Set one of: DATABASE_URL, NEON_DATABASE_URL, ` +
      `adaptive_data_DATABASE_URL, or adaptive_data_POSTGRES_URL`
    );
  }
  console.log(`🔌 Database URL resolved from env var: ${source}`);
  return url;
}

export function getDb(): NeonQueryFunction<false, false> {
  if (!sql) {
    sql = neon(getDatabaseUrl());
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

  // Auth accounts (real email/password authentication)
  await initAuthSchema(db);

  await db`
    CREATE TABLE IF NOT EXISTS auth_events (
      id TEXT PRIMARY KEY,
      timestamp TIMESTAMPTZ NOT NULL,
      email_hash TEXT NOT NULL,
      account_id TEXT,
      learner_id TEXT REFERENCES users(id) ON DELETE SET NULL,
      role TEXT CHECK (role IN ('student', 'instructor')),
      outcome TEXT NOT NULL CHECK (outcome IN ('success', 'failure')),
      failure_reason TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await db`CREATE INDEX IF NOT EXISTS idx_auth_events_timestamp ON auth_events(timestamp)`;
  await db`CREATE INDEX IF NOT EXISTS idx_auth_events_outcome ON auth_events(outcome)`;
  await db`CREATE INDEX IF NOT EXISTS idx_auth_events_learner_id ON auth_events(learner_id)`;
  await db`CREATE INDEX IF NOT EXISTS idx_auth_events_account_id ON auth_events(account_id)`;

  // Course sections (durable instructor ownership model)
  await db`
    CREATE TABLE IF NOT EXISTS course_sections (
      id TEXT PRIMARY KEY,
      instructor_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      student_signup_code TEXT NOT NULL UNIQUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await db`
    CREATE TABLE IF NOT EXISTS section_enrollments (
      id SERIAL PRIMARY KEY,
      section_id TEXT NOT NULL REFERENCES course_sections(id) ON DELETE CASCADE,
      student_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(section_id, student_user_id)
    )
  `;

  await db`CREATE INDEX IF NOT EXISTS idx_course_sections_instructor ON course_sections(instructor_user_id)`;
  await db`CREATE INDEX IF NOT EXISTS idx_course_sections_signup_code ON course_sections(student_signup_code)`;
  await db`CREATE INDEX IF NOT EXISTS idx_section_enrollments_section ON section_enrollments(section_id)`;
  await db`CREATE INDEX IF NOT EXISTS idx_section_enrollments_student ON section_enrollments(student_user_id)`;

  // Learner sessions (experimental condition tracking)
  await db`
    CREATE TABLE IF NOT EXISTS learner_sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      section_id TEXT REFERENCES course_sections(id) ON DELETE SET NULL,
      session_id TEXT NOT NULL,
      current_problem_id TEXT,
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

  // Session state fields for multi-device resume (idempotent on existing schema)
  await db`ALTER TABLE learner_sessions ADD COLUMN IF NOT EXISTS current_code TEXT`;
  await db`ALTER TABLE learner_sessions ADD COLUMN IF NOT EXISTS current_problem_id TEXT`;
  await db`ALTER TABLE learner_sessions ADD COLUMN IF NOT EXISTS guidance_state TEXT`;
  await db`ALTER TABLE learner_sessions ADD COLUMN IF NOT EXISTS hdi_state TEXT`;
  await db`ALTER TABLE learner_sessions ADD COLUMN IF NOT EXISTS bandit_state TEXT`;
  await db`ALTER TABLE learner_sessions ADD COLUMN IF NOT EXISTS last_activity TIMESTAMPTZ`;
  await db`ALTER TABLE learner_sessions ADD COLUMN IF NOT EXISTS section_id TEXT REFERENCES course_sections(id) ON DELETE SET NULL`;
  await db`CREATE INDEX IF NOT EXISTS idx_learner_sessions_section_id ON learner_sessions(section_id)`;
  await db`CREATE INDEX IF NOT EXISTS idx_learner_sessions_current_problem_id ON learner_sessions(current_problem_id)`;

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
      section_id TEXT REFERENCES course_sections(id) ON DELETE SET NULL,
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
      concept_id TEXT,
      concept_ids TEXT,
      source TEXT,
      total_time INTEGER,
      problems_attempted INTEGER,
      problems_solved INTEGER,
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
      learner_profile_id TEXT,
      escalation_trigger_reason TEXT,
      error_count_at_escalation INTEGER,
      time_to_escalation INTEGER,
      strategy_assigned TEXT,
      strategy_updated TEXT,
      reward_value NUMERIC,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await db`CREATE INDEX IF NOT EXISTS idx_interaction_events_user_id ON interaction_events(user_id)`;
  await db`CREATE INDEX IF NOT EXISTS idx_interaction_events_session_id ON interaction_events(session_id)`;
  await db`CREATE INDEX IF NOT EXISTS idx_interaction_events_event_type ON interaction_events(event_type)`;
  await db`CREATE INDEX IF NOT EXISTS idx_interaction_events_timestamp ON interaction_events(timestamp)`;
  await db`CREATE INDEX IF NOT EXISTS idx_interaction_events_problem_id ON interaction_events(problem_id)`;

  // Keep RESEARCH-4 columns in lockstep with migrate-neon.sql.
  // Fresh Neon init uses this runtime initializer, while SQL migration paths use the .sql file.
  await db`ALTER TABLE interaction_events ADD COLUMN IF NOT EXISTS learner_profile_id TEXT`;
  await db`ALTER TABLE interaction_events ADD COLUMN IF NOT EXISTS escalation_trigger_reason TEXT`;
  await db`ALTER TABLE interaction_events ADD COLUMN IF NOT EXISTS error_count_at_escalation INTEGER`;
  await db`ALTER TABLE interaction_events ADD COLUMN IF NOT EXISTS time_to_escalation INTEGER`;
  await db`ALTER TABLE interaction_events ADD COLUMN IF NOT EXISTS strategy_assigned TEXT`;
  await db`ALTER TABLE interaction_events ADD COLUMN IF NOT EXISTS strategy_updated TEXT`;
  await db`ALTER TABLE interaction_events ADD COLUMN IF NOT EXISTS reward_value NUMERIC`;
  await db`ALTER TABLE interaction_events ADD COLUMN IF NOT EXISTS concept_id TEXT`;
  await db`ALTER TABLE interaction_events ADD COLUMN IF NOT EXISTS source TEXT`;
  await db`ALTER TABLE interaction_events ADD COLUMN IF NOT EXISTS total_time INTEGER`;
  await db`ALTER TABLE interaction_events ADD COLUMN IF NOT EXISTS problems_attempted INTEGER`;
  await db`ALTER TABLE interaction_events ADD COLUMN IF NOT EXISTS problems_solved INTEGER`;

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

  // Processed corpus tables (raw PDFs remain local-only; Neon stores processed outputs only)
  await db`CREATE EXTENSION IF NOT EXISTS vector`;

  await db`
    CREATE TABLE IF NOT EXISTS corpus_documents (
      doc_id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      filename TEXT NOT NULL,
      sha256 TEXT NOT NULL,
      page_count INT NOT NULL,
      parser_backend TEXT NOT NULL,
      pipeline_version TEXT NOT NULL,
      run_id TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (doc_id, sha256, pipeline_version)
    )
  `;

  await db`
    CREATE TABLE IF NOT EXISTS corpus_units (
      unit_id TEXT PRIMARY KEY,
      doc_id TEXT NOT NULL REFERENCES corpus_documents(doc_id) ON DELETE CASCADE,
      concept_id TEXT,
      title TEXT NOT NULL,
      summary TEXT NOT NULL,
      content_markdown TEXT NOT NULL,
      difficulty TEXT,
      page_start INT NOT NULL,
      page_end INT NOT NULL,
      parser_backend TEXT NOT NULL,
      pipeline_version TEXT NOT NULL,
      run_id TEXT,
      metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await db`CREATE INDEX IF NOT EXISTS idx_corpus_units_doc_id ON corpus_units(doc_id)`;
  await db`CREATE INDEX IF NOT EXISTS idx_corpus_units_concept_id ON corpus_units(concept_id)`;

  await db`
    CREATE TABLE IF NOT EXISTS corpus_chunks (
      chunk_id TEXT PRIMARY KEY,
      unit_id TEXT NOT NULL REFERENCES corpus_units(unit_id) ON DELETE CASCADE,
      doc_id TEXT NOT NULL REFERENCES corpus_documents(doc_id) ON DELETE CASCADE,
      page INT NOT NULL,
      chunk_text TEXT NOT NULL,
      embedding vector NOT NULL,
      embedding_model TEXT NOT NULL,
      parser_backend TEXT NOT NULL,
      pipeline_version TEXT NOT NULL,
      run_id TEXT,
      metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await db`ALTER TABLE corpus_chunks ALTER COLUMN embedding TYPE vector`;

  await db`CREATE INDEX IF NOT EXISTS idx_corpus_chunks_doc_id ON corpus_chunks(doc_id)`;
  await db`CREATE INDEX IF NOT EXISTS idx_corpus_chunks_unit_id ON corpus_chunks(unit_id)`;

  await db`
    CREATE TABLE IF NOT EXISTS corpus_ingest_runs (
      run_id TEXT PRIMARY KEY,
      source_policy TEXT NOT NULL,
      parser_backend TEXT NOT NULL,
      embedding_backend TEXT NOT NULL,
      embedding_model TEXT NOT NULL,
      embedding_dimension INT NOT NULL,
      mlx_model TEXT,
      pipeline_version TEXT NOT NULL,
      diagnostics JSONB NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await db`
    CREATE TABLE IF NOT EXISTS corpus_active_runs (
      doc_id TEXT PRIMARY KEY REFERENCES corpus_documents(doc_id) ON DELETE CASCADE,
      run_id TEXT NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_by TEXT
    )
  `;
  await db`CREATE INDEX IF NOT EXISTS idx_corpus_active_runs_run_id ON corpus_active_runs(run_id)`;
  await db`
    INSERT INTO corpus_active_runs (doc_id, run_id, updated_by)
    VALUES (${DEFAULT_ACTIVE_CORPUS_DOC_ID}, ${DEFAULT_ACTIVE_CORPUS_RUN_ID}, 'initializeSchema:seed')
    ON CONFLICT (doc_id) DO NOTHING
  `;

  // Learner profiles (full rich profile with concept coverage)
  // Version column added for optimistic locking
  await db`
    CREATE TABLE IF NOT EXISTS learner_profiles (
      learner_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL DEFAULT 'Unknown',
      concept_coverage TEXT NOT NULL DEFAULT '[]',
      concept_evidence TEXT NOT NULL DEFAULT '{}',
      error_history TEXT NOT NULL DEFAULT '{}',
      interaction_count INTEGER NOT NULL DEFAULT 0,
      strategy TEXT NOT NULL DEFAULT 'default',
      preferences TEXT NOT NULL DEFAULT '{"escalationThreshold":3,"aggregationDelay":30000}',
      last_activity_at TIMESTAMPTZ,
      profile_data TEXT NOT NULL DEFAULT '{}',
      version INTEGER NOT NULL DEFAULT 1,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  // Ensure version column exists for existing schemas (migration path)
  await db`ALTER TABLE learner_profiles ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1`;

  await db`CREATE INDEX IF NOT EXISTS idx_learner_profiles_last_activity ON learner_profiles(last_activity_at)`;

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

async function resolveSectionIdForLearner(userId: string): Promise<string | null> {
  const db = getDb();
  const [row] = await db`
    SELECT e.section_id
    FROM section_enrollments e
    WHERE e.student_user_id = ${userId}
    ORDER BY e.joined_at DESC
    LIMIT 1
  `;
  return row ? String(row.section_id) : null;
}

// ============================================================================
// Session Operations
// ============================================================================

export async function saveSession(
  userId: string,
  sessionId: string,
  conditionId: string | undefined,
  config: SessionData
): Promise<void> {
  const db = getDb();
  const id = `${userId}-${sessionId}`;
  const now = new Date().toISOString();
  const existingSession = await getSession(userId, sessionId);
  const resolvedSectionId =
    config.sectionId ?? existingSession?.sectionId ?? await resolveSectionIdForLearner(userId);
  const resolvedConditionId = conditionId ?? existingSession?.conditionId ?? 'default';
  const resolvedTextbookDisabled =
    config.textbookDisabled ?? existingSession?.textbookDisabled ?? false;
  const resolvedAdaptiveLadderDisabled =
    config.adaptiveLadderDisabled ?? existingSession?.adaptiveLadderDisabled ?? false;
  const resolvedImmediateExplanationMode =
    config.immediateExplanationMode ?? existingSession?.immediateExplanationMode ?? false;
  const resolvedStaticHintMode =
    config.staticHintMode ?? existingSession?.staticHintMode ?? false;
  const resolvedEscalationPolicy =
    config.escalationPolicy ?? existingSession?.escalationPolicy ?? 'adaptive';
  const resolvedCurrentProblemId =
    config.currentProblemId ?? existingSession?.currentProblemId ?? null;
  const resolvedCurrentCode = config.currentCode ?? existingSession?.lastCode ?? null;
  const resolvedGuidanceState = config.guidanceState ?? existingSession?.guidanceState ?? null;
  const resolvedHdiState = config.hdiState ?? existingSession?.hdiState ?? null;
  const resolvedBanditState = config.banditState ?? existingSession?.banditState ?? null;
  const existingLastActivity =
    typeof existingSession?.lastActivity === 'number'
      ? new Date(existingSession.lastActivity).toISOString()
      : null;
  const resolvedLastActivity = config.lastActivity ?? existingLastActivity ?? now;

  await db`
    INSERT INTO learner_sessions (
      id, user_id, section_id, session_id, current_problem_id, condition_id,
      textbook_disabled, adaptive_ladder_disabled, immediate_explanation_mode,
      static_hint_mode, escalation_policy, current_code, guidance_state,
      hdi_state, bandit_state, last_activity, created_at, updated_at
    ) VALUES (
      ${id}, ${userId}, ${resolvedSectionId}, ${sessionId}, ${resolvedCurrentProblemId}, ${resolvedConditionId},
      ${resolvedTextbookDisabled}, ${resolvedAdaptiveLadderDisabled},
      ${resolvedImmediateExplanationMode}, ${resolvedStaticHintMode},
      ${resolvedEscalationPolicy}, ${resolvedCurrentCode},
      ${JSON.stringify(resolvedGuidanceState)},
      ${JSON.stringify(resolvedHdiState)},
      ${JSON.stringify(resolvedBanditState)},
      ${resolvedLastActivity}, ${now}, ${now}
    )
    ON CONFLICT (user_id, session_id) DO UPDATE SET
      condition_id = EXCLUDED.condition_id,
      section_id = EXCLUDED.section_id,
      current_problem_id = COALESCE(EXCLUDED.current_problem_id, learner_sessions.current_problem_id),
      textbook_disabled = COALESCE(EXCLUDED.textbook_disabled, learner_sessions.textbook_disabled),
      adaptive_ladder_disabled = COALESCE(EXCLUDED.adaptive_ladder_disabled, learner_sessions.adaptive_ladder_disabled),
      immediate_explanation_mode = COALESCE(EXCLUDED.immediate_explanation_mode, learner_sessions.immediate_explanation_mode),
      static_hint_mode = COALESCE(EXCLUDED.static_hint_mode, learner_sessions.static_hint_mode),
      escalation_policy = COALESCE(EXCLUDED.escalation_policy, learner_sessions.escalation_policy),
      current_code = COALESCE(EXCLUDED.current_code, learner_sessions.current_code),
      guidance_state = COALESCE(EXCLUDED.guidance_state, learner_sessions.guidance_state),
      hdi_state = COALESCE(EXCLUDED.hdi_state, learner_sessions.hdi_state),
      bandit_state = COALESCE(EXCLUDED.bandit_state, learner_sessions.bandit_state),
      last_activity = EXCLUDED.last_activity,
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
    currentProblemId: result.current_problem_id ?? null,
    sectionId: result.section_id ?? null,
    conditionId: result.condition_id,
    textbookDisabled: result.textbook_disabled,
    adaptiveLadderDisabled: result.adaptive_ladder_disabled,
    immediateExplanationMode: result.immediate_explanation_mode,
    staticHintMode: result.static_hint_mode,
    escalationPolicy: result.escalation_policy,
    lastCode: result.current_code ?? null,
    guidanceState: parseJson(result.guidance_state),
    hdiState: parseJson(result.hdi_state),
    banditState: parseJson(result.bandit_state),
    lastActivity: result.last_activity ? new Date(result.last_activity).getTime() : null,
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
    currentProblemId: result.current_problem_id ?? null,
    sectionId: result.section_id ?? null,
    conditionId: result.condition_id,
    textbookDisabled: result.textbook_disabled,
    adaptiveLadderDisabled: result.adaptive_ladder_disabled,
    immediateExplanationMode: result.immediate_explanation_mode,
    staticHintMode: result.static_hint_mode,
    escalationPolicy: result.escalation_policy,
    lastCode: result.current_code ?? null,
    guidanceState: parseJson(result.guidance_state),
    hdiState: parseJson(result.hdi_state),
    banditState: parseJson(result.bandit_state),
    lastActivity: result.last_activity ? new Date(result.last_activity).getTime() : null,
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

/**
 * Update problem progress with race-condition safe atomic operations.
 * Uses INSERT ... ON CONFLICT ... DO UPDATE pattern where PostgreSQL handles
 * concurrency via row-level locking during the upsert.
 */
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

  // Race-condition safe atomic upsert:
  // - attempts_count and hints_used reference the CURRENT database value
  // - solved uses boolean OR logic to preserve "true" once set
  // - solved_at only updates when transitioning from unsolved to solved
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

function normalizeInteractionTimestamp(timestamp: string, fallbackIso: string): string {
  const numeric = Number(timestamp);
  if (Number.isFinite(numeric)) {
    const millis = numeric > 1e12 ? numeric : numeric * 1000;
    return new Date(millis).toISOString();
  }
  const parsed = Date.parse(timestamp);
  if (Number.isFinite(parsed)) {
    return new Date(parsed).toISOString();
  }
  return fallbackIso;
}

export async function createInteraction(data: CreateInteractionRequest & { id: string }): Promise<Interaction> {
  const db = getDb();
  const now = new Date().toISOString();

  const payload = data.payload || {};
  // RESEARCH-4: hintId can be at top level (from convertToBackendInteraction) or in payload
  const storedHintId = data.hintId ?? payload.hintId ?? null;
  const storedSessionId =
    data.sessionId ?? (typeof payload.sessionId === 'string' ? payload.sessionId : null);
  const timestampIso = normalizeInteractionTimestamp(data.timestamp, now);
  const storedConceptId = payload.conceptId || (Array.isArray(payload.conceptIds) ? payload.conceptIds[0] : null);
  const resolvedSectionId = data.sectionId ?? await resolveSectionIdForLearner(data.learnerId);

  await db`
    INSERT INTO interaction_events (
      id, user_id, section_id, session_id, timestamp, event_type, problem_id,
      problem_set_id, problem_number, code, error, error_subtype_id,
      hint_id, explanation_id, hint_text, hint_level, help_request_index,
      sql_engage_subtype, sql_engage_row_id, policy_version, time_spent,
      successful, rule_fired, template_id, input_hash, model,
      note_id, note_title, note_content,
      retrieved_source_ids, retrieved_chunks, trigger_interaction_ids,
      evidence_interaction_ids, source_interaction_ids, inputs, outputs, concept_id, concept_ids,
      source, total_time, problems_attempted, problems_solved,
      request_type, current_rung, rung, grounded, content_length,
      from_rung, to_rung, trigger_reason, unit_id, action, dedupe_key,
      revision_count, passage_count, expanded, chat_message, chat_response,
      chat_quick_chip, saved_to_notes, textbook_units_retrieved,
      profile_id, assignment_strategy, previous_thresholds, new_thresholds,
      selected_arm, selection_method, arm_stats_at_selection, reward_total,
      reward_components, new_alpha, new_beta, hdi, hdi_level, hdi_components,
      trend, slope, intervention_type, schedule_id, prompt_id, prompt_type,
      response, is_correct, scheduled_time, shown_time,
      learner_profile_id, escalation_trigger_reason, error_count_at_escalation,
      time_to_escalation, strategy_assigned, strategy_updated, reward_value,
      created_at
    ) VALUES (
      ${data.id},
      ${data.learnerId},
      ${resolvedSectionId},
      ${storedSessionId},
      ${timestampIso},
      ${data.eventType},
      ${data.problemId},
      ${payload.problemSetId || null},
      ${payload.problemNumber || null},
      ${payload.code || null},
      ${payload.error || null},
      ${payload.errorSubtypeId || null},
      ${storedHintId},
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
      ${storedConceptId},
      ${JSON.stringify(payload.conceptIds || null)},
      ${payload.source || null},
      ${payload.totalTime ?? payload.timeSpent ?? null},
      ${payload.problemsAttempted ?? null},
      ${payload.problemsSolved ?? null},
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
      ${payload.learnerProfileId || null},
      ${payload.escalationTriggerReason || null},
      ${payload.errorCountAtEscalation ?? null},
      ${payload.timeToEscalation ?? null},
      ${payload.strategyAssigned || null},
      ${payload.strategyUpdated || null},
      ${payload.rewardValue ?? null},
      ${now}
    )
    ON CONFLICT (id) DO NOTHING
  `;

  const { sectionId: _ignoredSectionId, ...topLevelPayload } = payload as Record<string, unknown>;
  return {
    id: data.id,
    learnerId: data.learnerId,
    sectionId: resolvedSectionId,
    sessionId: storedSessionId,
    timestamp: timestampIso,
    eventType: data.eventType,
    problemId: data.problemId,
    ...topLevelPayload,
    payload,
    createdAt: now,
  };
}

export interface GetInteractionsOptions {
  sessionId?: string;
  eventType?: string;
  problemId?: string;
  startDate?: string; // ISO date string
  endDate?: string; // ISO date string
  limit?: number;
  offset?: number;
}

/**
 * Count interactions for a user with optional filters.
 * Uses the same filter logic as getInteractionsByUser for consistency.
 */
export async function countInteractionsByUser(
  userId: string,
  options?: Omit<GetInteractionsOptions, 'limit' | 'offset'>
): Promise<number> {
  const db = getDb();

  const conditions = [db`user_id = ${userId}`];
  if (options?.sessionId) conditions.push(db`session_id = ${options.sessionId}`);
  if (options?.eventType) conditions.push(db`event_type = ${options.eventType}`);
  if (options?.problemId) conditions.push(db`problem_id = ${options.problemId}`);
  if (options?.startDate) conditions.push(db`timestamp >= ${options.startDate}`);
  if (options?.endDate) conditions.push(db`timestamp <= ${options.endDate}`);

  const [result] = await db`
    SELECT COUNT(*) as count
    FROM interaction_events
    WHERE ${conditions.reduce((acc, cond, i) => (i === 0 ? cond : db`${acc} AND ${cond}`), db``)}
  `;

  return parseInt(result?.count as string, 10) || 0;
}

/**
 * Get interactions for a user with SQL-level filtering and pagination.
 * All filtering happens in the database for scalability.
 * 
 * Performance note: This function relies on composite indexes:
 * - idx_interaction_events_user_timestamp (user_id, timestamp DESC)
 * - idx_interaction_events_user_session_timestamp (user_id, session_id, timestamp DESC)
 * - idx_interaction_events_user_event_type_timestamp (user_id, event_type, timestamp DESC)
 * - idx_interaction_events_user_problem_timestamp (user_id, problem_id, timestamp DESC)
 */
export async function getInteractionsByUser(
  userId: string,
  options?: GetInteractionsOptions
): Promise<{ interactions: Interaction[]; total: number }> {
  const db = getDb();

  // Build filter conditions
  const conditions = [db`user_id = ${userId}`];
  if (options?.sessionId) conditions.push(db`session_id = ${options.sessionId}`);
  if (options?.eventType) conditions.push(db`event_type = ${options.eventType}`);
  if (options?.problemId) conditions.push(db`problem_id = ${options.problemId}`);
  if (options?.startDate) conditions.push(db`timestamp >= ${options.startDate}`);
  if (options?.endDate) conditions.push(db`timestamp <= ${options.endDate}`);

  // Build WHERE clause by combining conditions
  const whereClause = conditions.reduce((acc, cond, i) => 
    i === 0 ? cond : db`${acc} AND ${cond}`, db``
  );

  // Get total count efficiently
  const [countResult] = await db`
    SELECT COUNT(*) as count
    FROM interaction_events
    WHERE ${whereClause}
  `;
  const total = parseInt(countResult?.count as string, 10) || 0;

  // Build main query with pagination at the database level
  const limit = options?.limit;
  const offset = options?.offset ?? 0;

  let query;
  if (limit !== undefined) {
    query = db`
      SELECT * FROM interaction_events
      WHERE ${whereClause}
      ORDER BY timestamp DESC
      LIMIT ${limit} OFFSET ${offset}
    `;
  } else {
    // Without limit, we still apply offset for pagination safety
    // but be aware this could be expensive for very large result sets
    query = db`
      SELECT * FROM interaction_events
      WHERE ${whereClause}
      ORDER BY timestamp DESC
      OFFSET ${offset}
    `;
  }

  const results = await query;

  return {
    interactions: results.map(rowToInteraction),
    total,
  };
}

export async function getInteractionsByUsers(
  userIds: string[],
  options?: GetInteractionsOptions
): Promise<{ interactions: Interaction[]; total: number }> {
  const db = getDb();
  const ids = Array.from(new Set(userIds.filter(Boolean)));

  if (ids.length === 0) {
    return { interactions: [], total: 0 };
  }

  const conditions = [db`user_id = ANY(${ids})`];
  if (options?.sessionId) conditions.push(db`session_id = ${options.sessionId}`);
  if (options?.eventType) conditions.push(db`event_type = ${options.eventType}`);
  if (options?.problemId) conditions.push(db`problem_id = ${options.problemId}`);
  if (options?.startDate) conditions.push(db`timestamp >= ${options.startDate}`);
  if (options?.endDate) conditions.push(db`timestamp <= ${options.endDate}`);

  const whereClause = conditions.reduce((acc, cond, index) =>
    index === 0 ? cond : db`${acc} AND ${cond}`, db``
  );

  const [countResult] = await db`
    SELECT COUNT(*) as count
    FROM interaction_events
    WHERE ${whereClause}
  `;
  const total = parseInt(countResult?.count as string, 10) || 0;

  const limit = options?.limit;
  const offset = options?.offset ?? 0;

  let query;
  if (limit !== undefined) {
    query = db`
      SELECT * FROM interaction_events
      WHERE ${whereClause}
      ORDER BY timestamp DESC
      LIMIT ${limit} OFFSET ${offset}
    `;
  } else {
    query = db`
      SELECT * FROM interaction_events
      WHERE ${whereClause}
      ORDER BY timestamp DESC
      OFFSET ${offset}
    `;
  }

  const results = await query;

  return {
    interactions: results.map(rowToInteraction),
    total,
  };
}

export async function getInteractionById(id: string): Promise<Interaction | null> {
  const db = getDb();
  const [result] = await db`SELECT * FROM interaction_events WHERE id = ${id}`;
  return result ? rowToInteraction(result) : null;
}

export interface InteractionAggregates {
  totalCount: number;
  interactionsByType: Record<string, number>;
  last24Hours: number;
  last7Days: number;
  last30Days: number;
}

export interface ActiveLearnerCounts {
  last24Hours: number;
  last7Days: number;
  last30Days: number;
}

export async function getInteractionAggregatesByUsers(
  userIds: string[],
  referenceTime: number = Date.now()
): Promise<InteractionAggregates> {
  const db = getDb();
  const ids = Array.from(new Set(userIds.filter(Boolean)));
  
  if (ids.length === 0) {
    return {
      totalCount: 0,
      interactionsByType: {},
      last24Hours: 0,
      last7Days: 0,
      last30Days: 0,
    };
  }

  const msPerDay = 24 * 60 * 60 * 1000;
  const cutoff24h = new Date(referenceTime - msPerDay).toISOString();
  const cutoff7d = new Date(referenceTime - 7 * msPerDay).toISOString();
  const cutoff30d = new Date(referenceTime - 30 * msPerDay).toISOString();

  // Single query to get all aggregates using GROUP BY
  const rows = await db`
    SELECT 
      event_type,
      COUNT(*) as count,
      COUNT(*) FILTER (WHERE timestamp >= ${cutoff24h}) as count_24h,
      COUNT(*) FILTER (WHERE timestamp >= ${cutoff7d}) as count_7d,
      COUNT(*) FILTER (WHERE timestamp >= ${cutoff30d}) as count_30d
    FROM interaction_events
    WHERE user_id = ANY(${ids})
    GROUP BY event_type
  `;

  const interactionsByType: Record<string, number> = {};
  let totalCount = 0;
  let last24Hours = 0;
  let last7Days = 0;
  let last30Days = 0;

  for (const row of rows) {
    const count = Number(row.count);
    interactionsByType[row.event_type] = count;
    totalCount += count;
    last24Hours += Number(row.count_24h);
    last7Days += Number(row.count_7d);
    last30Days += Number(row.count_30d);
  }

  return {
    totalCount,
    interactionsByType,
    last24Hours,
    last7Days,
    last30Days,
  };
}

export async function getActiveLearnerCountsByUsers(
  userIds: string[],
  referenceTime: number = Date.now()
): Promise<ActiveLearnerCounts> {
  const db = getDb();
  const ids = Array.from(new Set(userIds.filter(Boolean)));

  if (ids.length === 0) {
    return {
      last24Hours: 0,
      last7Days: 0,
      last30Days: 0,
    };
  }

  const msPerDay = 24 * 60 * 60 * 1000;
  const cutoff24h = new Date(referenceTime - msPerDay).toISOString();
  const cutoff7d = new Date(referenceTime - 7 * msPerDay).toISOString();
  const cutoff30d = new Date(referenceTime - 30 * msPerDay).toISOString();

  const [row] = await db`
    SELECT
      COUNT(DISTINCT user_id) FILTER (WHERE timestamp >= ${cutoff24h}) as active_24h,
      COUNT(DISTINCT user_id) FILTER (WHERE timestamp >= ${cutoff7d}) as active_7d,
      COUNT(DISTINCT user_id) FILTER (WHERE timestamp >= ${cutoff30d}) as active_30d
    FROM interaction_events
    WHERE user_id = ANY(${ids})
  `;

  return {
    last24Hours: Number(row?.active_24h || 0),
    last7Days: Number(row?.active_7d || 0),
    last30Days: Number(row?.active_30d || 0),
  };
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

  const sourceInteractionIds = Array.isArray(data.sourceInteractionIds)
    ? Array.from(new Set(data.sourceInteractionIds.filter((sourceId) => typeof sourceId === 'string' && sourceId.trim()).map((sourceId) => sourceId.trim())))
    : [];
  if (sourceInteractionIds.length > 0) {
    await db`
      DELETE FROM textbook_unit_event_links
      WHERE unit_id = ${id} AND link_type = 'trigger'
    `;
    for (const sourceInteractionId of sourceInteractionIds) {
      await db`
        INSERT INTO textbook_unit_event_links (unit_id, event_id, link_type)
        SELECT ${id}, ${sourceInteractionId}, 'trigger'
        WHERE EXISTS (
          SELECT 1 FROM interaction_events WHERE id = ${sourceInteractionId}
        )
        ON CONFLICT (unit_id, event_id, link_type) DO NOTHING
      `;
    }
  }

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

export async function getTextbookUnitCountsByUsers(userIds: string[]): Promise<Map<string, number>> {
  const db = getDb();
  const ids = Array.from(new Set(userIds.filter(Boolean)));
  if (ids.length === 0) {
    return new Map();
  }

  const rows = await db`
    SELECT user_id, COUNT(*) as count
    FROM textbook_units
    WHERE user_id = ANY(${ids})
    GROUP BY user_id
  `;

  const counts = new Map<string, number>();
  for (const row of rows) {
    counts.set(row.user_id, Number(row.count));
  }
  return counts;
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
  const payload = {
    sectionId: row.section_id ?? null,
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
    conceptId: row.concept_id,
    conceptIds: parseJson(row.concept_ids),
    source: row.source,
    totalTime: row.total_time,
    problemsAttempted: row.problems_attempted,
    problemsSolved: row.problems_solved,
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
    learnerProfileId: row.learner_profile_id,
    escalationTriggerReason: row.escalation_trigger_reason,
    errorCountAtEscalation: row.error_count_at_escalation,
    timeToEscalation: row.time_to_escalation,
    strategyAssigned: row.strategy_assigned,
    strategyUpdated: row.strategy_updated,
    rewardValue: row.reward_value,
  };
  const { sectionId: _ignoredSectionId, ...topLevelPayload } = payload;

  return {
    id: row.id,
    learnerId: row.user_id,
    sectionId: row.section_id ?? null,
    sessionId: row.session_id,
    timestamp: new Date(row.timestamp).toISOString(),
    eventType: row.event_type,
    problemId: row.problem_id,
    ...topLevelPayload,
    payload,
    // RESEARCH-4: canonical study fields also at top-level for typed access
    learnerProfileId: row.learner_profile_id,
    escalationTriggerReason: row.escalation_trigger_reason,
    errorCountAtEscalation: row.error_count_at_escalation,
    timeToEscalation: row.time_to_escalation,
    strategyAssigned: row.strategy_assigned,
    strategyUpdated: row.strategy_updated,
    rewardValue: row.reward_value,
    createdAt: row.created_at,
  };
}

function normalizeAuthEmail(email: string): string {
  return email.trim().toLowerCase();
}

function hashAuthEmail(email: string): string {
  return createHash('sha256').update(normalizeAuthEmail(email)).digest('hex');
}

function rowToAuthEvent(row: Record<string, unknown>): AuthEventRow {
  return {
    id: String(row.id),
    timestamp: new Date(String(row.timestamp)).toISOString(),
    emailHash: String(row.email_hash),
    accountId: row.account_id ? String(row.account_id) : null,
    learnerId: row.learner_id ? String(row.learner_id) : null,
    role: row.role ? (String(row.role) as 'student' | 'instructor') : null,
    outcome: String(row.outcome) as 'success' | 'failure',
    failureReason: row.failure_reason ? String(row.failure_reason) : null,
    createdAt: new Date(String(row.created_at)).toISOString(),
  };
}

export async function createAuthEvent(data: CreateAuthEventRequest): Promise<AuthEventRow> {
  const db = getDb();
  const now = new Date().toISOString();
  const id = `auth-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const [result] = await db`
    INSERT INTO auth_events (
      id, timestamp, email_hash, account_id, learner_id, role, outcome, failure_reason, created_at
    ) VALUES (
      ${id},
      ${now},
      ${hashAuthEmail(data.email)},
      ${data.accountId || null},
      ${data.learnerId || null},
      ${data.role || null},
      ${data.outcome},
      ${data.failureReason || null},
      ${now}
    )
    RETURNING *
  `;
  return rowToAuthEvent(result as Record<string, unknown>);
}

export async function getAuthEvents(): Promise<AuthEventRow[]> {
  const db = getDb();
  const results = await db`SELECT * FROM auth_events ORDER BY timestamp DESC`;
  return results.map((row) => rowToAuthEvent(row as Record<string, unknown>));
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

// ============================================================================
// Learner Profile Operations
// ============================================================================

export async function getLearnerProfile(learnerId: string): Promise<LearnerProfile | null> {
  const db = getDb();
  const [result] = await db`
    SELECT * FROM learner_profiles WHERE learner_id = ${learnerId}
  `;

  if (!result) return null;

  const solvedProblemIds = await getSolvedProblemIdsForLearner(learnerId);

  return {
    id: result.learner_id,
    name: result.name,
    conceptsCovered: parseJson(result.concept_coverage) || [],
    conceptCoverageEvidence: parseJson(result.concept_evidence) || {},
    errorHistory: parseJson(result.error_history) || {},
    solvedProblemIds,
    interactionCount: result.interaction_count || 0,
    currentStrategy: result.strategy || 'default',
    preferences: parseJson(result.preferences) || {
      escalationThreshold: 3,
      aggregationDelay: 30000,
      autoTextbookEnabled: true,
      notificationsEnabled: true,
      theme: 'system',
    },
    createdAt: result.created_at ? new Date(result.created_at).getTime() : Date.now(),
    lastActive: result.last_activity_at ? new Date(result.last_activity_at).getTime() : Date.now(),
    extendedData: parseJson(result.profile_data) || {},
  };
}

export async function saveLearnerProfile(
  learnerId: string,
  profile: Partial<LearnerProfile>
): Promise<LearnerProfile | null> {
  const db = getDb();
  const now = new Date().toISOString();
  const solvedProblemIds = await getSolvedProblemIdsForLearner(learnerId);

  // Get existing profile or create new
  const existing = await getLearnerProfile(learnerId);

  const mergedProfile: LearnerProfile = {
    id: learnerId,
    name: profile.name || existing?.name || 'Unknown',
    conceptsCovered: profile.conceptsCovered || existing?.conceptsCovered || [],
    conceptCoverageEvidence: profile.conceptCoverageEvidence || existing?.conceptCoverageEvidence || {},
    errorHistory: profile.errorHistory || existing?.errorHistory || {},
    solvedProblemIds,
    interactionCount: profile.interactionCount ?? existing?.interactionCount ?? 0,
    currentStrategy: profile.currentStrategy || existing?.currentStrategy || 'default',
    preferences: profile.preferences || existing?.preferences || {
      escalationThreshold: 3,
      aggregationDelay: 30000,
    },
    createdAt: existing?.createdAt || Date.now(),
    lastActive: Date.now(),
    extendedData: profile.extendedData || existing?.extendedData || {},
  };

  // Atomic upsert with version increment for optimistic locking
  await db`
    INSERT INTO learner_profiles (
      learner_id, name, concept_coverage, concept_evidence, error_history,
      interaction_count, strategy, preferences, last_activity_at, profile_data, version, updated_at
    ) VALUES (
      ${learnerId},
      ${mergedProfile.name},
      ${JSON.stringify(mergedProfile.conceptsCovered)},
      ${JSON.stringify(mergedProfile.conceptCoverageEvidence)},
      ${JSON.stringify(mergedProfile.errorHistory)},
      ${mergedProfile.interactionCount},
      ${mergedProfile.currentStrategy},
      ${JSON.stringify(mergedProfile.preferences)},
      ${now},
      ${JSON.stringify(mergedProfile.extendedData)},
      1,
      ${now}
    )
    ON CONFLICT (learner_id) DO UPDATE SET
      name = EXCLUDED.name,
      concept_coverage = EXCLUDED.concept_coverage,
      concept_evidence = EXCLUDED.concept_evidence,
      error_history = EXCLUDED.error_history,
      interaction_count = EXCLUDED.interaction_count,
      strategy = EXCLUDED.strategy,
      preferences = EXCLUDED.preferences,
      last_activity_at = EXCLUDED.last_activity_at,
      profile_data = EXCLUDED.profile_data,
      version = learner_profiles.version + 1,
      updated_at = EXCLUDED.updated_at
  `;

  return mergedProfile;
}

export async function getAllLearnerProfiles(): Promise<LearnerProfile[]> {
  const db = getDb();
  const results = await db`SELECT * FROM learner_profiles ORDER BY updated_at DESC`;
  const solvedProblemIdsByLearner = await getSolvedProblemIdsByLearner(
    results.map((row) => row.learner_id),
  );

  return results.map(row => ({
    id: row.learner_id,
    name: row.name,
    conceptsCovered: parseJson(row.concept_coverage) || [],
    conceptCoverageEvidence: parseJson(row.concept_evidence) || {},
    errorHistory: parseJson(row.error_history) || {},
    solvedProblemIds: solvedProblemIdsByLearner.get(row.learner_id) || [],
    interactionCount: row.interaction_count || 0,
    currentStrategy: row.strategy || 'default',
    preferences: parseJson(row.preferences) || {
      escalationThreshold: 3,
      aggregationDelay: 30000,
    },
    createdAt: row.created_at ? new Date(row.created_at).getTime() : Date.now(),
    lastActive: row.last_activity_at ? new Date(row.last_activity_at).getTime() : Date.now(),
    extendedData: parseJson(row.profile_data) || {},
  }));
}

export async function getLearnerProfilesByIds(learnerIds: string[]): Promise<LearnerProfile[]> {
  const db = getDb();
  const ids = Array.from(new Set(learnerIds.filter(Boolean)));

  if (ids.length === 0) {
    return [];
  }

  const results = await db`
    SELECT * FROM learner_profiles
    WHERE learner_id = ANY(${ids})
  `;
  const solvedProblemIdsByLearner = await getSolvedProblemIdsByLearner(ids);

  const profilesById = new Map<string, LearnerProfile>(
    results.map((row) => [
      row.learner_id,
      {
        id: row.learner_id,
        name: row.name,
        conceptsCovered: parseJson(row.concept_coverage) || [],
        conceptCoverageEvidence: parseJson(row.concept_evidence) || {},
        errorHistory: parseJson(row.error_history) || {},
        solvedProblemIds: solvedProblemIdsByLearner.get(row.learner_id) || [],
        interactionCount: row.interaction_count || 0,
        currentStrategy: row.strategy || 'default',
        preferences: parseJson(row.preferences) || {
          escalationThreshold: 3,
          aggregationDelay: 30000,
        },
        createdAt: row.created_at ? new Date(row.created_at).getTime() : Date.now(),
        lastActive: row.last_activity_at ? new Date(row.last_activity_at).getTime() : Date.now(),
        extendedData: parseJson(row.profile_data) || {},
      },
    ]),
  );

  return ids
    .map((id) => profilesById.get(id))
    .filter((profile): profile is LearnerProfile => Boolean(profile));
}

/**
 * Update learner profile from an interaction event.
 * Uses SELECT FOR UPDATE row locking to prevent race conditions during
 * concurrent event processing.
 */
export async function updateLearnerProfileFromEvent(
  learnerId: string,
  event: CreateInteractionRequest
): Promise<LearnerProfile | null> {
  const db = getDb();
  const now = new Date().toISOString();
  const nowMs = Date.now();

  // Step 1: Ensure profile exists (atomic initialization - safe for concurrent calls)
  await db`
    INSERT INTO learner_profiles (learner_id, name, created_at, updated_at, version)
    VALUES (${learnerId}, ${learnerId}, ${now}, ${now}, 1)
    ON CONFLICT (learner_id) DO NOTHING
  `;

  // Step 2: Atomic increment of interaction_count - race condition safe
  // Each concurrent call increments the counter separately
  await db`
    UPDATE learner_profiles
    SET interaction_count = interaction_count + 1,
        last_activity_at = ${now},
        version = version + 1,
        updated_at = ${now}
    WHERE learner_id = ${learnerId}
  `;

  // Step 3: For complex JSON updates, use SELECT FOR UPDATE to lock the row
  // This ensures exclusive access during the read-modify-write cycle
  const [lockedRow] = await db`
    SELECT * FROM learner_profiles
    WHERE learner_id = ${learnerId}
    FOR UPDATE
  `;

  if (!lockedRow) {
    return getLearnerProfile(learnerId);
  }

  // Parse current values from locked row
  const currentErrorHistory = parseJson(lockedRow.error_history) || {};
  const currentConceptEvidence = parseJson(lockedRow.concept_evidence) || {};
  const currentConceptCoverage = parseJson(lockedRow.concept_coverage) || [];

  let hasUpdates = false;
  let updatedErrorHistory = currentErrorHistory;
  let updatedConceptEvidence = currentConceptEvidence;
  let updatedConceptCoverage = currentConceptCoverage;

  // Update error history if error event
  if (event.errorSubtypeId) {
    updatedErrorHistory = {
      ...currentErrorHistory,
      [event.errorSubtypeId]: (currentErrorHistory[event.errorSubtypeId] || 0) + 1,
    };
    hasUpdates = true;
  }

  // Update concept coverage and evidence
  if (event.conceptIds && event.conceptIds.length > 0) {
    for (const conceptId of event.conceptIds) {
      // Add to coverage if not present
      if (!updatedConceptCoverage.includes(conceptId)) {
        updatedConceptCoverage = [...updatedConceptCoverage, conceptId];
        hasUpdates = true;
      }

      // Initialize evidence structure if needed
      if (!updatedConceptEvidence[conceptId]) {
        updatedConceptEvidence = {
          ...updatedConceptEvidence,
          [conceptId]: {
            conceptId,
            score: 0,
            confidence: 'low',
            lastUpdated: nowMs,
            evidenceCounts: {
              successfulExecution: 0,
              hintViewed: 0,
              explanationViewed: 0,
              errorEncountered: 0,
              notesAdded: 0,
            },
            streakCorrect: 0,
            streakIncorrect: 0,
          },
        };
        hasUpdates = true;
      }

      // Update evidence counts based on event type
      const evidence = updatedConceptEvidence[conceptId];
      const updatedEvidence = { ...evidence };
      let evidenceChanged = false;

      if (event.eventType === 'hint_view') {
        updatedEvidence.evidenceCounts = {
          ...evidence.evidenceCounts,
          hintViewed: evidence.evidenceCounts.hintViewed + 1,
        };
        evidenceChanged = true;
      } else if (event.eventType === 'explanation_view') {
        updatedEvidence.evidenceCounts = {
          ...evidence.evidenceCounts,
          explanationViewed: evidence.evidenceCounts.explanationViewed + 1,
        };
        evidenceChanged = true;
      } else if (event.eventType === 'error') {
        updatedEvidence.evidenceCounts = {
          ...evidence.evidenceCounts,
          errorEncountered: evidence.evidenceCounts.errorEncountered + 1,
        };
        evidenceChanged = true;
      } else if (event.successful) {
        updatedEvidence.evidenceCounts = {
          ...evidence.evidenceCounts,
          successfulExecution: evidence.evidenceCounts.successfulExecution + 1,
        };
        evidenceChanged = true;
      }

      if (evidenceChanged) {
        updatedEvidence.lastUpdated = nowMs;
        updatedConceptEvidence = {
          ...updatedConceptEvidence,
          [conceptId]: updatedEvidence,
        };
        hasUpdates = true;
      }
    }
  }

  // Apply updates if any JSON fields changed
  if (hasUpdates) {
    await db`
      UPDATE learner_profiles
      SET error_history = ${JSON.stringify(updatedErrorHistory)},
          concept_evidence = ${JSON.stringify(updatedConceptEvidence)},
          concept_coverage = ${JSON.stringify(updatedConceptCoverage)},
          version = version + 1,
          updated_at = ${now}
      WHERE learner_id = ${learnerId}
    `;
  }

  // Update problem_progress on successful execution
  // This makes problem_progress the durable source of truth for solved state
  if (event.eventType === 'execution' && event.successful && event.problemId) {
    await updateProblemProgress(learnerId, event.problemId, {
      solved: true,
      incrementAttempts: true,
      lastCode: event.code,
    });
  } else if (event.eventType === 'execution' && event.problemId) {
    // Failed execution - just increment attempts
    await updateProblemProgress(learnerId, event.problemId, {
      incrementAttempts: true,
      lastCode: event.code,
    });
  }

  // Return fresh profile (with updated solvedProblemIds from durable source)
  return getLearnerProfile(learnerId);
}

async function getSolvedProblemIdsForLearner(learnerId: string): Promise<string[]> {
  const solvedProblemIdsByLearner = await getSolvedProblemIdsByLearner([learnerId]);
  return solvedProblemIdsByLearner.get(learnerId) || [];
}

async function getSolvedProblemIdsByLearner(learnerIds: string[]): Promise<Map<string, string[]>> {
  const ids = Array.from(new Set(learnerIds.filter(Boolean)));
  if (ids.length === 0) {
    return new Map();
  }

  const db = getDb();
  const rows = await db`
    SELECT user_id, problem_id
    FROM problem_progress
    WHERE solved = TRUE
      AND user_id = ANY(${ids})
    ORDER BY solved_at DESC NULLS LAST, updated_at DESC
  `;

  const solvedProblemIdsByLearner = new Map<string, string[]>();
  for (const learnerId of ids) {
    solvedProblemIdsByLearner.set(learnerId, []);
  }

  for (const row of rows) {
    const solvedProblemIds = solvedProblemIdsByLearner.get(row.user_id) || [];
    solvedProblemIds.push(row.problem_id);
    solvedProblemIdsByLearner.set(row.user_id, solvedProblemIds);
  }

  return solvedProblemIdsByLearner;
}

// ============================================================================
// Processed corpus read operations
// ============================================================================

function parseJsonField<T>(value: unknown, fallback: T): T {
  if (value == null) return fallback;
  if (typeof value === 'object') return value as T;
  if (typeof value === 'string') {
    try {
      return JSON.parse(value) as T;
    } catch {
      return fallback;
    }
  }
  return fallback;
}

function toCorpusActiveRunRow(row: Record<string, unknown>): CorpusActiveRunRow {
  return {
    docId: String(row.doc_id ?? ''),
    runId: String(row.run_id ?? ''),
    updatedAt: new Date(String(row.updated_at)).toISOString(),
    updatedBy: typeof row.updated_by === 'string' ? row.updated_by : null,
  };
}

export async function listCorpusActiveRuns(): Promise<CorpusActiveRunRow[]> {
  const db = getDb();
  const rows = await db`
    SELECT doc_id, run_id, updated_at, updated_by
    FROM corpus_active_runs
    ORDER BY doc_id ASC
  `;
  return rows.map((row) => toCorpusActiveRunRow(row));
}

export async function getCorpusActiveRun(docId: string): Promise<CorpusActiveRunRow | null> {
  const db = getDb();
  const [row] = await db`
    SELECT doc_id, run_id, updated_at, updated_by
    FROM corpus_active_runs
    WHERE doc_id = ${docId}
    LIMIT 1
  `;
  if (!row) return null;
  return toCorpusActiveRunRow(row);
}

export async function setCorpusActiveRun(params: {
  docId: string;
  runId: string;
  updatedBy?: string | null;
}): Promise<CorpusActiveRunRow> {
  const db = getDb();
  const { docId, runId } = params;
  const updatedBy = params.updatedBy ?? null;

  const [docExists] = await db`
    SELECT doc_id
    FROM corpus_documents
    WHERE doc_id = ${docId}
    LIMIT 1
  `;
  if (!docExists) {
    throw new Error(`Unknown corpus doc_id: ${docId}`);
  }

  const [runExists] = await db`
    SELECT unit_id
    FROM corpus_units
    WHERE doc_id = ${docId}
      AND run_id = ${runId}
    LIMIT 1
  `;
  if (!runExists) {
    throw new Error(`Run ${runId} has no units for doc ${docId}`);
  }

  const [row] = await db`
    INSERT INTO corpus_active_runs (doc_id, run_id, updated_at, updated_by)
    VALUES (${docId}, ${runId}, NOW(), ${updatedBy})
    ON CONFLICT (doc_id) DO UPDATE
    SET run_id = EXCLUDED.run_id,
        updated_at = NOW(),
        updated_by = EXCLUDED.updated_by
    RETURNING doc_id, run_id, updated_at, updated_by
  `;

  return toCorpusActiveRunRow(row);
}

export async function getCorpusManifest(): Promise<CorpusManifestDocumentRow[]> {
  const db = getDb();
  const rows = await db`
    WITH run_resolution AS (
      SELECT
        d.doc_id,
        COALESCE(ar.run_id, d.run_id) AS active_run_id,
        ar.updated_at AS active_run_updated_at,
        ar.updated_by AS active_run_updated_by
      FROM corpus_documents d
      LEFT JOIN corpus_active_runs ar ON ar.doc_id = d.doc_id
    )
    SELECT
      d.doc_id,
      d.title,
      d.filename,
      d.sha256,
      d.page_count,
      d.parser_backend,
      d.pipeline_version,
      d.run_id,
      rr.active_run_id,
      rr.active_run_updated_at,
      rr.active_run_updated_by,
      d.created_at,
      COUNT(DISTINCT u.unit_id) FILTER (
        WHERE rr.active_run_id IS NOT NULL AND u.run_id = rr.active_run_id
      )::int AS unit_count,
      COUNT(DISTINCT c.chunk_id) FILTER (
        WHERE rr.active_run_id IS NOT NULL AND c.run_id = rr.active_run_id
      )::int AS chunk_count
    FROM corpus_documents d
    INNER JOIN run_resolution rr ON rr.doc_id = d.doc_id
    LEFT JOIN corpus_units u ON u.doc_id = d.doc_id
    LEFT JOIN corpus_chunks c ON c.doc_id = d.doc_id
    GROUP BY
      d.doc_id, d.title, d.filename, d.sha256, d.page_count,
      d.parser_backend, d.pipeline_version, d.run_id, d.created_at,
      rr.active_run_id, rr.active_run_updated_at, rr.active_run_updated_by
    ORDER BY d.created_at DESC
  `;

  return rows.map((row) => ({
    docId: row.doc_id,
    title: row.title,
    filename: row.filename,
    sha256: row.sha256,
    pageCount: Number(row.page_count ?? 0),
    parserBackend: row.parser_backend,
    pipelineVersion: row.pipeline_version,
    runId: row.run_id ?? null,
    activeRunId: row.active_run_id ?? null,
    activeRunUpdatedAt: row.active_run_updated_at
      ? new Date(row.active_run_updated_at).toISOString()
      : null,
    activeRunUpdatedBy: row.active_run_updated_by ?? null,
    unitCount: Number(row.unit_count ?? 0),
    chunkCount: Number(row.chunk_count ?? 0),
    createdAt: new Date(row.created_at).toISOString(),
  }));
}

export async function getCorpusUnitsIndex(): Promise<CorpusUnitRow[]> {
  const db = getDb();
  const rows = await db`
    WITH run_resolution AS (
      SELECT
        d.doc_id,
        COALESCE(ar.run_id, d.run_id) AS active_run_id
      FROM corpus_documents d
      LEFT JOIN corpus_active_runs ar ON ar.doc_id = d.doc_id
    )
    SELECT
      u.unit_id, u.doc_id, u.concept_id, u.title, u.summary, u.content_markdown,
      u.difficulty, u.page_start, u.page_end, u.run_id, u.metadata, u.created_at
    FROM corpus_units u
    INNER JOIN run_resolution rr
      ON rr.doc_id = u.doc_id
     AND rr.active_run_id IS NOT NULL
     AND u.run_id = rr.active_run_id
    ORDER BY u.created_at DESC
  `;

  return rows.map((row) => ({
    unitId: row.unit_id,
    docId: row.doc_id,
    conceptId: row.concept_id ?? null,
    title: row.title,
    summary: row.summary,
    contentMarkdown: row.content_markdown,
    difficulty: row.difficulty ?? null,
    pageStart: Number(row.page_start ?? 0),
    pageEnd: Number(row.page_end ?? 0),
    runId: row.run_id ?? null,
    metadata: parseJsonField<Record<string, unknown> | null>(row.metadata, null),
    createdAt: new Date(row.created_at).toISOString(),
  }));
}

export async function getCorpusUnitById(unitId: string): Promise<CorpusUnitRow | null> {
  const db = getDb();
  const [row] = await db`
    WITH run_resolution AS (
      SELECT
        d.doc_id,
        COALESCE(ar.run_id, d.run_id) AS active_run_id
      FROM corpus_documents d
      LEFT JOIN corpus_active_runs ar ON ar.doc_id = d.doc_id
    )
    SELECT
      u.unit_id, u.doc_id, u.concept_id, u.title, u.summary, u.content_markdown,
      u.difficulty, u.page_start, u.page_end, u.run_id, u.metadata, u.created_at
    FROM corpus_units u
    INNER JOIN run_resolution rr
      ON rr.doc_id = u.doc_id
     AND rr.active_run_id IS NOT NULL
     AND u.run_id = rr.active_run_id
    WHERE u.unit_id = ${unitId}
    LIMIT 1
  `;
  if (!row) return null;
  return {
    unitId: row.unit_id,
    docId: row.doc_id,
    conceptId: row.concept_id ?? null,
    title: row.title,
    summary: row.summary,
    contentMarkdown: row.content_markdown,
    difficulty: row.difficulty ?? null,
    pageStart: Number(row.page_start ?? 0),
    pageEnd: Number(row.page_end ?? 0),
    runId: row.run_id ?? null,
    metadata: parseJsonField<Record<string, unknown> | null>(row.metadata, null),
    createdAt: new Date(row.created_at).toISOString(),
  };
}

export async function getCorpusChunksByUnitId(unitId: string, limit = 50): Promise<CorpusChunkRow[]> {
  const db = getDb();
  const rows = await db`
    WITH run_resolution AS (
      SELECT
        d.doc_id,
        COALESCE(ar.run_id, d.run_id) AS active_run_id
      FROM corpus_documents d
      LEFT JOIN corpus_active_runs ar ON ar.doc_id = d.doc_id
    )
    SELECT
      c.chunk_id, c.unit_id, c.doc_id, c.page, c.chunk_text, c.run_id, c.metadata, c.created_at
    FROM corpus_chunks c
    INNER JOIN run_resolution rr
      ON rr.doc_id = c.doc_id
     AND rr.active_run_id IS NOT NULL
     AND c.run_id = rr.active_run_id
    WHERE c.unit_id = ${unitId}
    ORDER BY c.page ASC, c.chunk_id ASC
    LIMIT ${Math.max(1, Math.min(limit, 200))}
  `;

  return rows.map((row) => ({
    chunkId: row.chunk_id,
    unitId: row.unit_id,
    docId: row.doc_id,
    page: Number(row.page ?? 0),
    chunkText: row.chunk_text,
    runId: row.run_id ?? null,
    metadata: parseJsonField<Record<string, unknown> | null>(row.metadata, null),
    createdAt: new Date(row.created_at).toISOString(),
  }));
}

export async function searchCorpus(
  query: string,
  limit = 10,
): Promise<Array<CorpusChunkRow & { unitTitle: string; conceptId: string | null; summary: string; termHits: number }>> {
  const db = getDb();
  const normalized = query.toLowerCase().trim();
  if (!normalized) {
    return [];
  }

  const rows = await db`
    WITH tokens AS (
      SELECT DISTINCT token
      FROM regexp_split_to_table(${normalized}, E'\\s+') AS token
      WHERE token <> ''
    ),
    run_resolution AS (
      SELECT
        d.doc_id,
        COALESCE(ar.run_id, d.run_id) AS active_run_id
      FROM corpus_documents d
      LEFT JOIN corpus_active_runs ar ON ar.doc_id = d.doc_id
    )
    SELECT
      c.chunk_id,
      c.unit_id,
      c.doc_id,
      c.page,
      c.chunk_text,
      c.run_id,
      c.metadata,
      c.created_at,
      u.title AS unit_title,
      u.concept_id,
      u.summary,
      (
        SELECT COUNT(*)::int
        FROM tokens t
        WHERE LOWER(c.chunk_text) LIKE '%' || t.token || '%'
           OR LOWER(u.title) LIKE '%' || t.token || '%'
           OR LOWER(COALESCE(u.summary, '')) LIKE '%' || t.token || '%'
      ) AS term_hits
    FROM corpus_chunks c
    INNER JOIN corpus_units u
      ON u.unit_id = c.unit_id
     AND u.run_id = c.run_id
    INNER JOIN run_resolution rr
      ON rr.doc_id = c.doc_id
     AND rr.active_run_id IS NOT NULL
     AND c.run_id = rr.active_run_id
    WHERE EXISTS (
      SELECT 1
      FROM tokens t
      WHERE LOWER(c.chunk_text) LIKE '%' || t.token || '%'
         OR LOWER(u.title) LIKE '%' || t.token || '%'
         OR LOWER(COALESCE(u.summary, '')) LIKE '%' || t.token || '%'
    )
    ORDER BY term_hits DESC, c.page ASC, c.chunk_id ASC
    LIMIT ${Math.max(1, Math.min(limit, 100))}
  `;

  return rows.map((row) => ({
    chunkId: row.chunk_id,
    unitId: row.unit_id,
    docId: row.doc_id,
    page: Number(row.page ?? 0),
    chunkText: row.chunk_text,
    runId: row.run_id ?? null,
    metadata: parseJsonField<Record<string, unknown> | null>(row.metadata, null),
    createdAt: new Date(row.created_at).toISOString(),
    unitTitle: row.unit_title,
    conceptId: row.concept_id ?? null,
    summary: row.summary ?? '',
    termHits: Number(row.term_hits ?? 0),
  }));
}


// ============================================================================
// Textbook Retrieval Linking (RESEARCH-5)
// ============================================================================

interface RetrievalLinkInput {
  unitId: string;
  rank?: number;
  sourceKind?: string;
  score?: number;
}

/**
 * Link textbook unit retrievals to an interaction event
 * RESEARCH-5: Normalized retrieval provenance for paper analysis
 */
export async function linkTextbookRetrievals(
  eventId: string,
  retrievals: string[] | RetrievalLinkInput[]
): Promise<void> {
  const db = getDb();
  
  for (let i = 0; i < retrievals.length; i++) {
    const retrieval = retrievals[i];
    
    let unitId: string;
    let rank: number | null = null;
    let sourceKind: string | null = null;
    let score: number | null = null;
    
    if (typeof retrieval === 'string') {
      unitId = retrieval;
      rank = i + 1;
    } else {
      unitId = retrieval.unitId;
      rank = retrieval.rank ?? i + 1;
      sourceKind = retrieval.sourceKind ?? null;
      score = retrieval.score ?? null;
    }
    
    await db`
      INSERT INTO interaction_textbook_unit_retrievals
        (event_id, unit_id, rank, source_kind, score)
      VALUES
        (${eventId}, ${unitId}, ${rank}, ${sourceKind}, ${score})
      ON CONFLICT (event_id, unit_id) DO UPDATE SET
        rank = EXCLUDED.rank,
        source_kind = EXCLUDED.source_kind,
        score = EXCLUDED.score
    `;
  }
}

/**
 * Get textbook retrievals for an event
 */
export async function getTextbookRetrievalsForEvent(
  eventId: string
): Promise<Array<{
  unitId: string;
  rank: number | null;
  sourceKind: string | null;
  score: number | null;
  createdAt: string;
}>> {
  const db = getDb();
  
  const rows = await db`
    SELECT unit_id, rank, source_kind, score, created_at
    FROM interaction_textbook_unit_retrievals
    WHERE event_id = ${eventId}
    ORDER BY rank ASC NULLS LAST
  `;
  
  return rows.map(row => ({
    unitId: row.unit_id,
    rank: row.rank,
    sourceKind: row.source_kind,
    score: row.score,
    createdAt: new Date(row.created_at).toISOString(),
  }));
}

// ============================================================================
// Schema Version
// ============================================================================

export const DB_SCHEMA_VERSION = 'v1.1.0';
