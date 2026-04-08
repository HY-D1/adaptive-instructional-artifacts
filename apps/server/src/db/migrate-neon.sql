-- ============================================================================
-- NEON-1: Authenticated Per-User Neon Persistence
-- Migration SQL for PostgreSQL (Neon)
-- ============================================================================

-- Run this SQL in your Neon SQL Editor to set up the database schema
-- Get your connection string from: https://console.neon.tech

-- ============================================================================
-- Users table (minimal auth identity)
-- ============================================================================

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('student', 'instructor')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- ============================================================================
-- Auth telemetry (research-safe login outcome audit)
-- ============================================================================

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
);

CREATE INDEX IF NOT EXISTS idx_auth_events_timestamp ON auth_events(timestamp);
CREATE INDEX IF NOT EXISTS idx_auth_events_outcome ON auth_events(outcome);
CREATE INDEX IF NOT EXISTS idx_auth_events_learner_id ON auth_events(learner_id);
CREATE INDEX IF NOT EXISTS idx_auth_events_account_id ON auth_events(account_id);

-- ============================================================================
-- Course sections + enrollments (durable instructor ownership model)
-- ============================================================================

CREATE TABLE IF NOT EXISTS course_sections (
  id TEXT PRIMARY KEY,
  instructor_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  student_signup_code TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS section_enrollments (
  id SERIAL PRIMARY KEY,
  section_id TEXT NOT NULL REFERENCES course_sections(id) ON DELETE CASCADE,
  student_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(section_id, student_user_id)
);

CREATE INDEX IF NOT EXISTS idx_course_sections_instructor ON course_sections(instructor_user_id);
CREATE INDEX IF NOT EXISTS idx_course_sections_signup_code ON course_sections(student_signup_code);
CREATE INDEX IF NOT EXISTS idx_section_enrollments_section ON section_enrollments(section_id);
CREATE INDEX IF NOT EXISTS idx_section_enrollments_student ON section_enrollments(student_user_id);

-- ============================================================================
-- Learner sessions (experimental condition tracking)
-- ============================================================================

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
);

CREATE INDEX IF NOT EXISTS idx_learner_sessions_user_id ON learner_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_learner_sessions_session_id ON learner_sessions(session_id);

ALTER TABLE learner_sessions ADD COLUMN IF NOT EXISTS current_code TEXT;
ALTER TABLE learner_sessions ADD COLUMN IF NOT EXISTS current_problem_id TEXT;
ALTER TABLE learner_sessions ADD COLUMN IF NOT EXISTS guidance_state TEXT;
ALTER TABLE learner_sessions ADD COLUMN IF NOT EXISTS hdi_state TEXT;
ALTER TABLE learner_sessions ADD COLUMN IF NOT EXISTS bandit_state TEXT;
ALTER TABLE learner_sessions ADD COLUMN IF NOT EXISTS last_activity TIMESTAMPTZ;
ALTER TABLE learner_sessions ADD COLUMN IF NOT EXISTS section_id TEXT REFERENCES course_sections(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_learner_sessions_section_id ON learner_sessions(section_id);
CREATE INDEX IF NOT EXISTS idx_learner_sessions_current_problem_id ON learner_sessions(current_problem_id);

-- ============================================================================
-- Problem progress (per-user problem completion tracking)
-- ============================================================================

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
);

CREATE INDEX IF NOT EXISTS idx_problem_progress_user_id ON problem_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_problem_progress_problem_id ON problem_progress(problem_id);

-- ============================================================================
-- Interaction events (append-only research log)
-- ============================================================================

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
);

CREATE INDEX IF NOT EXISTS idx_interaction_events_user_id ON interaction_events(user_id);
CREATE INDEX IF NOT EXISTS idx_interaction_events_session_id ON interaction_events(session_id);
CREATE INDEX IF NOT EXISTS idx_interaction_events_event_type ON interaction_events(event_type);
CREATE INDEX IF NOT EXISTS idx_interaction_events_timestamp ON interaction_events(timestamp);
CREATE INDEX IF NOT EXISTS idx_interaction_events_problem_id ON interaction_events(problem_id);
ALTER TABLE interaction_events ADD COLUMN IF NOT EXISTS section_id TEXT REFERENCES course_sections(id) ON DELETE SET NULL;
ALTER TABLE interaction_events ADD COLUMN IF NOT EXISTS learner_profile_id TEXT;
ALTER TABLE interaction_events ADD COLUMN IF NOT EXISTS escalation_trigger_reason TEXT;
ALTER TABLE interaction_events ADD COLUMN IF NOT EXISTS error_count_at_escalation INTEGER;
ALTER TABLE interaction_events ADD COLUMN IF NOT EXISTS time_to_escalation INTEGER;
ALTER TABLE interaction_events ADD COLUMN IF NOT EXISTS strategy_assigned TEXT;
ALTER TABLE interaction_events ADD COLUMN IF NOT EXISTS strategy_updated TEXT;
ALTER TABLE interaction_events ADD COLUMN IF NOT EXISTS reward_value NUMERIC;
ALTER TABLE interaction_events ADD COLUMN IF NOT EXISTS concept_id TEXT;
ALTER TABLE interaction_events ADD COLUMN IF NOT EXISTS source TEXT;
ALTER TABLE interaction_events ADD COLUMN IF NOT EXISTS total_time INTEGER;
ALTER TABLE interaction_events ADD COLUMN IF NOT EXISTS problems_attempted INTEGER;
ALTER TABLE interaction_events ADD COLUMN IF NOT EXISTS problems_solved INTEGER;
CREATE INDEX IF NOT EXISTS idx_interaction_events_section_id ON interaction_events(section_id);

-- ============================================================================
-- Textbook units (My Textbook)
-- ============================================================================

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
);

CREATE INDEX IF NOT EXISTS idx_textbook_units_user_id ON textbook_units(user_id);
CREATE INDEX IF NOT EXISTS idx_textbook_units_unit_id ON textbook_units(unit_id);
CREATE INDEX IF NOT EXISTS idx_textbook_units_type ON textbook_units(type);

-- ============================================================================
-- Textbook unit event links (provenance)
-- ============================================================================

CREATE TABLE IF NOT EXISTS textbook_unit_event_links (
  id SERIAL PRIMARY KEY,
  unit_id TEXT NOT NULL REFERENCES textbook_units(id) ON DELETE CASCADE,
  event_id TEXT NOT NULL REFERENCES interaction_events(id) ON DELETE CASCADE,
  link_type TEXT NOT NULL DEFAULT 'trigger',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(unit_id, event_id, link_type)
);

CREATE INDEX IF NOT EXISTS idx_textbook_unit_event_links_unit_id ON textbook_unit_event_links(unit_id);
CREATE INDEX IF NOT EXISTS idx_textbook_unit_event_links_event_id ON textbook_unit_event_links(event_id);

-- ============================================================================
-- Textbook unit retrievals (provenance for retrieval events)
-- Paper Data Contract: Structured retrieval provenance (Message 5/5)
-- ============================================================================

CREATE TABLE IF NOT EXISTS interaction_textbook_unit_retrievals (
  id SERIAL PRIMARY KEY,
  event_id TEXT NOT NULL REFERENCES interaction_events(id) ON DELETE CASCADE,
  unit_id TEXT NOT NULL,
  rank INTEGER,
  source_kind TEXT,
  score NUMERIC,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RESEARCH-4: Unique constraint for upsert support (event_id, unit_id)
ALTER TABLE interaction_textbook_unit_retrievals
ADD CONSTRAINT IF NOT EXISTS unique_event_unit_retrieval 
UNIQUE (event_id, unit_id);

CREATE INDEX IF NOT EXISTS idx_retrievals_event_id ON interaction_textbook_unit_retrievals(event_id);
CREATE INDEX IF NOT EXISTS idx_retrievals_unit_id ON interaction_textbook_unit_retrievals(unit_id);

-- ============================================================================
-- Processed corpus tables (local-only raw PDF -> remote Neon corpus)
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS vector;

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
);

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
);

CREATE INDEX IF NOT EXISTS idx_corpus_units_doc_id ON corpus_units(doc_id);
CREATE INDEX IF NOT EXISTS idx_corpus_units_concept_id ON corpus_units(concept_id);

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
);

ALTER TABLE IF EXISTS corpus_chunks
  ALTER COLUMN embedding TYPE vector;

CREATE INDEX IF NOT EXISTS idx_corpus_chunks_doc_id ON corpus_chunks(doc_id);
CREATE INDEX IF NOT EXISTS idx_corpus_chunks_unit_id ON corpus_chunks(unit_id);

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
);

CREATE TABLE IF NOT EXISTS corpus_active_runs (
  doc_id TEXT PRIMARY KEY REFERENCES corpus_documents(doc_id) ON DELETE CASCADE,
  run_id TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by TEXT
);

CREATE INDEX IF NOT EXISTS idx_corpus_active_runs_run_id ON corpus_active_runs(run_id);

INSERT INTO corpus_active_runs (doc_id, run_id, updated_by)
VALUES ('dbms-ramakrishnan-3rd-edition', 'run-1774671570-b1353117', 'migrate-neon.sql:seed')
ON CONFLICT (doc_id) DO NOTHING;

-- ============================================================================
-- Verification query
-- ============================================================================

-- Run this to verify the schema was created correctly:
-- SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name;
