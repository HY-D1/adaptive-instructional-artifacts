/**
 * Code snippet for: apps/server/src/db/sections.ts
 *
 * Add section_type field to CourseSection interface and helper functions
 * to support standing data rule enforcement.
 *
 * Changes needed:
 * 1. Add sectionType to CourseSection interface
 * 2. Add sectionType to mapCourseSection function
 * 3. Add getSectionsByType helper function
 * 4. Update createSectionForInstructor to accept optional sectionType
 */

// ============================================================================
// UPDATE 1: CourseSection Interface
// ============================================================================

export interface CourseSection {
  id: string;
  instructorUserId: string;
  name: string;
  studentSignupCode: string;
  sectionType: 'test' | 'production' | 'pilot';  // ADD THIS LINE
  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// UPDATE 2: mapCourseSection Helper
// ============================================================================

function mapCourseSection(row: Record<string, unknown>): CourseSection {
  return {
    id: String(row.id),
    instructorUserId: String(row.instructor_user_id),
    name: String(row.name),
    studentSignupCode: String(row.student_signup_code),
    sectionType: (row.section_type as 'test' | 'production' | 'pilot') || 'test',  // ADD THIS LINE
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

// ============================================================================
// UPDATE 3: New Helper Function - Get Sections by Type
// ============================================================================

export async function getSectionsByType(
  sectionType: 'test' | 'production' | 'pilot'
): Promise<CourseSection[]> {
  const db = getDb();
  const rows = await db`
    SELECT * FROM course_sections
    WHERE section_type = ${sectionType}
    ORDER BY created_at ASC
  `;
  return rows.map((row) => mapCourseSection(row as Record<string, unknown>));
}

// ============================================================================
// UPDATE 4: New Helper Function - Get All Production Sections
// ============================================================================

export async function getProductionSections(): Promise<CourseSection[]> {
  return getSectionsByType('production');
}

// ============================================================================
// UPDATE 5: Optional - Update createSectionForInstructor
// ============================================================================

export async function createSectionForInstructor(params: {
  instructorUserId: string;
  name?: string;
  studentSignupCode?: string;
  sectionType?: 'test' | 'production' | 'pilot';  // ADD THIS PARAMETER
}): Promise<CourseSection> {
  const db = getDb();
  const id = crypto.randomUUID();
  const resolvedName = params.name?.trim() || 'Section 1';
  const resolvedCode = params.studentSignupCode
    ? normalizeCode(params.studentSignupCode)
    : await ensureUniqueStudentCode(db);
  const resolvedType = params.sectionType || 'test';  // ADD THIS LINE

  const rows = await db`
    INSERT INTO course_sections (id, instructor_user_id, name, student_signup_code, section_type)
    VALUES (${id}, ${params.instructorUserId}, ${resolvedName}, ${resolvedCode}, ${resolvedType})
    RETURNING *
  `;
  return mapCourseSection(rows[0] as Record<string, unknown>);
}
