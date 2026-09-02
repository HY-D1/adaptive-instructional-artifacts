-- Logging Pipeline Extension: Add Section Type Flag
-- This SQL migration adds a `section_type` field to distinguish real course sections
-- from test/QA sections, enabling enforcement of the standing data rule.
--
-- File: apps/server/src/db/migrate-neon.sql
-- Run after: Initial neon.ts schema creation

-- Add section_type column
ALTER TABLE course_sections ADD COLUMN IF NOT EXISTS section_type TEXT
  NOT NULL DEFAULT 'test'
  CHECK (section_type IN ('test', 'production', 'pilot'));

-- Add index for filtering by section type
CREATE INDEX IF NOT EXISTS idx_course_sections_type ON course_sections(section_type);

-- Add composite index for instructor + type queries
CREATE INDEX IF NOT EXISTS idx_course_sections_instructor_type
  ON course_sections(instructor_user_id, section_type);

-- Note: After migration, run:
-- UPDATE course_sections SET section_type = 'production'
--   WHERE id IN ('confirmed-production-section-id-1', 'confirmed-production-section-id-2', ...);
