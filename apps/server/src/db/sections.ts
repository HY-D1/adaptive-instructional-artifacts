import crypto from 'node:crypto';
import type { NeonQueryFunction } from '@neondatabase/serverless';
import { getDb } from './neon.js';

export interface CourseSection {
  id: string;
  instructorUserId: string;
  name: string;
  studentSignupCode: string;
  createdAt: string;
  updatedAt: string;
}

export interface SectionEnrollment {
  id: number;
  sectionId: string;
  studentUserId: string;
  joinedAt: string;
}

function mapCourseSection(row: Record<string, unknown>): CourseSection {
  return {
    id: String(row.id),
    instructorUserId: String(row.instructor_user_id),
    name: String(row.name),
    studentSignupCode: String(row.student_signup_code),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function mapSectionEnrollment(row: Record<string, unknown>): SectionEnrollment {
  return {
    id: Number(row.id),
    sectionId: String(row.section_id),
    studentUserId: String(row.student_user_id),
    joinedAt: String(row.joined_at),
  };
}

function normalizeCode(code: string): string {
  return code.trim().toUpperCase();
}

export function generateStudentSignupCode(length = 8): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = crypto.randomBytes(length);
  let out = '';
  for (let i = 0; i < length; i++) {
    out += alphabet[bytes[i] % alphabet.length];
  }
  return out;
}

async function ensureUniqueStudentCode(
  db: NeonQueryFunction<false, false>,
  maxAttempts = 20
): Promise<string> {
  for (let i = 0; i < maxAttempts; i++) {
    const code = generateStudentSignupCode();
    const existing = await db`
      SELECT id FROM course_sections WHERE student_signup_code = ${code} LIMIT 1
    `;
    if (existing.length === 0) {
      return code;
    }
  }
  throw new Error('Failed to generate a unique student signup code');
}

export async function createSectionForInstructor(params: {
  instructorUserId: string;
  name?: string;
  studentSignupCode?: string;
}): Promise<CourseSection> {
  const db = getDb();
  const id = crypto.randomUUID();
  const resolvedName = params.name?.trim() || 'Section 1';
  const resolvedCode = params.studentSignupCode
    ? normalizeCode(params.studentSignupCode)
    : await ensureUniqueStudentCode(db);

  const rows = await db`
    INSERT INTO course_sections (id, instructor_user_id, name, student_signup_code)
    VALUES (${id}, ${params.instructorUserId}, ${resolvedName}, ${resolvedCode})
    RETURNING *
  `;
  return mapCourseSection(rows[0] as Record<string, unknown>);
}

export async function getSectionBySignupCode(code: string): Promise<CourseSection | null> {
  const db = getDb();
  const normalized = normalizeCode(code);
  const rows = await db`
    SELECT * FROM course_sections
    WHERE student_signup_code = ${normalized}
    LIMIT 1
  `;
  if (rows.length === 0) {
    return null;
  }
  return mapCourseSection(rows[0] as Record<string, unknown>);
}

export async function getOwnedSectionsByInstructor(
  instructorUserId: string
): Promise<CourseSection[]> {
  const db = getDb();
  const rows = await db`
    SELECT *
    FROM course_sections
    WHERE instructor_user_id = ${instructorUserId}
    ORDER BY created_at ASC
  `;
  return rows.map((row) => mapCourseSection(row as Record<string, unknown>));
}

export async function getSectionForStudent(studentUserId: string): Promise<CourseSection | null> {
  const db = getDb();
  const rows = await db`
    SELECT s.*
    FROM course_sections s
    INNER JOIN section_enrollments e ON e.section_id = s.id
    WHERE e.student_user_id = ${studentUserId}
    ORDER BY e.joined_at DESC
    LIMIT 1
  `;
  if (rows.length === 0) {
    return null;
  }
  return mapCourseSection(rows[0] as Record<string, unknown>);
}

export async function enrollStudentInSection(params: {
  sectionId: string;
  studentUserId: string;
}): Promise<SectionEnrollment> {
  const db = getDb();
  const rows = await db`
    INSERT INTO section_enrollments (section_id, student_user_id)
    VALUES (${params.sectionId}, ${params.studentUserId})
    ON CONFLICT (section_id, student_user_id) DO UPDATE SET joined_at = NOW()
    RETURNING *
  `;
  return mapSectionEnrollment(rows[0] as Record<string, unknown>);
}

export async function getInstructorScopedLearnerIds(
  instructorUserId: string
): Promise<string[]> {
  const db = getDb();
  const rows = await db`
    SELECT DISTINCT e.student_user_id
    FROM section_enrollments e
    INNER JOIN course_sections s ON s.id = e.section_id
    WHERE s.instructor_user_id = ${instructorUserId}
  `;
  return rows.map((row) => String((row as Record<string, unknown>).student_user_id));
}

export async function getSectionForLearnerInInstructorScope(params: {
  instructorUserId: string;
  learnerId: string;
}): Promise<CourseSection | null> {
  const db = getDb();
  const rows = await db`
    SELECT s.*
    FROM course_sections s
    INNER JOIN section_enrollments e ON e.section_id = s.id
    WHERE s.instructor_user_id = ${params.instructorUserId}
      AND e.student_user_id = ${params.learnerId}
    LIMIT 1
  `;
  if (rows.length === 0) {
    return null;
  }
  return mapCourseSection(rows[0] as Record<string, unknown>);
}

