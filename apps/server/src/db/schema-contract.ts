export const SCHEMA_CONTRACT_VERSION = 'v1.2.0' as const;

export const NEON_REQUIRED_TABLES = [
  'users',
  'auth_accounts',
  'auth_events',
  'course_sections',
  'section_enrollments',
  'learner_sessions',
  'problem_progress',
  'interaction_events',
  'textbook_units',
  'textbook_unit_event_links',
  'interaction_textbook_unit_retrievals',
  'corpus_documents',
  'corpus_units',
  'corpus_chunks',
  'corpus_ingest_runs',
  'corpus_active_runs',
  'learner_profiles',
] as const;

export type NeonRequiredTable = (typeof NEON_REQUIRED_TABLES)[number];
