#!/usr/bin/env node
/**
 * Debug Instructor Dashboard View
 * 
 * Investigates why an instructor sees fewer students than expected.
 * 
 * Usage:
 *   npx tsx scripts/debug-instructor-view.ts --instructor-id=<id>
 *   npx tsx scripts/debug-instructor-view.ts --instructor-name="H"
 */

import { getDb } from '../apps/server/src/db/neon.js';

interface DebugResult {
  instructorId: string;
  instructorName: string;
  ownedSections: Array<{
    sectionId: string;
    sectionName: string;
    enrolledCount: number;
    enrolledStudents: Array<{
      studentId: string;
      studentName: string;
      joinedAt: Date;
    }>;
  }>;
  studentsWithInteractions: Array<{
    studentId: string;
    studentName: string;
    sectionId: string;
    sectionName: string;
    interactionCount: number;
    isEnrolled: boolean;
  }>;
  apiWouldReturn: {
    learnerCount: number;
    learnerIds: string[];
  };
}

async function debugInstructorView(instructorId?: string, instructorName?: string) {
  const db = getDb();
  
  console.log('🔍 Debugging Instructor Dashboard View\n');
  console.log('=' .repeat(70));
  
  // Find the instructor
  let targetInstructor: { id: string; name: string } | null = null;
  
  if (instructorId) {
    const result = await db`
      SELECT id, name FROM users 
      WHERE id = ${instructorId} AND role = 'instructor'
    `;
    if (result.length > 0) {
      targetInstructor = result[0];
    }
  } else if (instructorName) {
    const result = await db`
      SELECT id, name FROM users 
      WHERE name = ${instructorName} AND role = 'instructor'
    `;
    if (result.length > 0) {
      targetInstructor = result[0];
    }
  }
  
  if (!targetInstructor) {
    console.log('❌ Instructor not found. Searching for instructors named "H"...\n');
    const hInstructors = await db`
      SELECT id, name FROM users 
      WHERE name ILIKE '%H%' AND role = 'instructor'
      ORDER BY name
    `;
    console.log('Found potential matches:');
    hInstructors.forEach(i => console.log(`  • ${i.name} (${i.id})`));
    return;
  }
  
  console.log(`👤 Instructor: ${targetInstructor.name}`);
  console.log(`   ID: ${targetInstructor.id}\n`);
  
  // Step 1: Get owned sections
  const sections = await db`
    SELECT 
      cs.id as section_id,
      cs.name as section_name,
      COUNT(se.id) as enrolled_count
    FROM course_sections cs
    LEFT JOIN section_enrollments se ON se.section_id = cs.id
    WHERE cs.instructor_user_id = ${targetInstructor.id}
    GROUP BY cs.id, cs.name
  `;
  
  console.log(`📚 OWNED SECTIONS: ${sections.length}`);
  console.log('-'.repeat(70));
  
  let totalEnrolled = 0;
  const allLearnerIds = new Set<string>();
  
  for (const section of sections) {
    totalEnrolled += Number(section.enrolled_count);
    
    // Get enrolled students for this section
    const enrolledStudents = await db`
      SELECT 
        u.id as student_id,
        u.name as student_name,
        se.joined_at
      FROM section_enrollments se
      JOIN users u ON u.id = se.student_user_id
      WHERE se.section_id = ${section.section_id}
      ORDER BY se.joined_at DESC
    `;
    
    console.log(`\n  Section: ${section.section_name}`);
    console.log(`  ID: ${section.section_id}`);
    console.log(`  Enrolled: ${section.enrolled_count} students`);
    
    enrolledStudents.forEach((s: { student_id: string; student_name: string }) => {
      allLearnerIds.add(s.student_id);
    });
    
    if (enrolledStudents.length > 0) {
      console.log(`  Students:`);
      enrolledStudents.slice(0, 10).forEach((s: { student_name: string; student_id: string }) => {
        console.log(`    • ${s.student_name} (${s.student_id.slice(0, 8)}...)`);
      });
      if (enrolledStudents.length > 10) {
        console.log(`    ... and ${enrolledStudents.length - 10} more`);
      }
    }
  }
  
  // Step 2: Find students who have interacted but aren't enrolled
  const interactionsFromNonEnrolled = await db`
    SELECT DISTINCT
      u.id as student_id,
      u.name as student_name,
      i.section_id,
      cs.name as section_name,
      COUNT(i.id) as interaction_count
    FROM interaction_events i
    JOIN users u ON u.id = i.user_id
    LEFT JOIN course_sections cs ON cs.id = i.section_id
    WHERE i.section_id IN (
      SELECT id FROM course_sections 
      WHERE instructor_user_id = ${targetInstructor.id}
    )
    AND NOT EXISTS (
      SELECT 1 FROM section_enrollments se 
      WHERE se.student_user_id = u.id 
      AND se.section_id = i.section_id
    )
    GROUP BY u.id, u.name, i.section_id, cs.name
    ORDER BY interaction_count DESC
  `;
  
  console.log('\n\n⚠️  STUDENTS WITH INTERACTIONS BUT NOT ENROLLED:');
  console.log('-'.repeat(70));
  
  if (interactionsFromNonEnrolled.length === 0) {
    console.log('  None - all interacting students are properly enrolled.');
  } else {
    console.log(`  Found ${interactionsFromNonEnrolled.length} student-section pairs:\n`);
    interactionsFromNonEnrolled.forEach((row: { 
      student_name: string; 
      section_name: string; 
      interaction_count: number;
      student_id: string;
    }) => {
      console.log(`  • ${row.student_name}`);
      console.log(`    Interacted with: ${row.section_name || 'Unknown Section'}`);
      console.log(`    Interactions: ${row.interaction_count}`);
      console.log(`    NOT ENROLLED - This is a data inconsistency!`);
      console.log();
    });
  }
  
  // Step 3: Compare what API would return vs what's in database
  console.log('\n\n🔧 API vs DATABASE COMPARISON:');
  console.log('-'.repeat(70));
  
  // This mimics what getInstructorScopedLearnerIds() does
  const apiLearnerIds = await db`
    SELECT DISTINCT student_user_id
    FROM section_enrollments
    WHERE section_id IN (
      SELECT id FROM course_sections 
      WHERE instructor_user_id = ${targetInstructor.id}
    )
  `;
  
  console.log(`  Database says: ${totalEnrolled} enrollments across ${sections.length} sections`);
  console.log(`  API would return: ${apiLearnerIds.length} unique learner IDs`);
  console.log(`  Unique learners: ${allLearnerIds.size}`);
  
  if (apiLearnerIds.length !== allLearnerIds.size) {
    console.log(`\n  ⚠️  DISCREPANCY DETECTED!`);
    console.log(`     enrollments table has ${apiLearnerIds.length} rows`);
    console.log(`     but only ${allLearnerIds.size} unique students`);
    console.log(`     (some students may be enrolled in multiple sections)`);
  }
  
  // Step 4: Check for data inconsistencies
  console.log('\n\n🔍 DATA INTEGRITY CHECK:');
  console.log('-'.repeat(70));
  
  // Check for enrollments pointing to non-existent students
  const orphanedEnrollments = await db`
    SELECT se.*
    FROM section_enrollments se
    LEFT JOIN users u ON u.id = se.student_user_id
    WHERE u.id IS NULL
  `;
  
  if (orphanedEnrollments.length > 0) {
    console.log(`  ❌ Found ${orphanedEnrollments.length} enrollments for non-existent students`);
  } else {
    console.log('  ✅ All enrollments point to valid students');
  }
  
  // Check for enrollments pointing to non-existent sections
  const orphanedSectionEnrollments = await db`
    SELECT se.*
    FROM section_enrollments se
    LEFT JOIN course_sections cs ON cs.id = se.section_id
    WHERE cs.id IS NULL
  `;
  
  if (orphanedSectionEnrollments.length > 0) {
    console.log(`  ❌ Found ${orphanedSectionEnrollments.length} enrollments for non-existent sections`);
  } else {
    console.log('  ✅ All enrollments point to valid sections');
  }
  
  // Final summary
  console.log('\n\n📊 FINAL SUMMARY:');
  console.log('='.repeat(70));
  console.log(`  Instructor: ${targetInstructor.name}`);
  console.log(`  Sections owned: ${sections.length}`);
  console.log(`  Students enrolled: ${allLearnerIds.size}`);
  console.log(`  Students with orphaned interactions: ${interactionsFromNonEnrolled.length}`);
  console.log();
  
  if (allLearnerIds.size === 0) {
    console.log('  🔴 CRITICAL: No students are enrolled in your sections!');
    console.log('     This explains why your dashboard shows 0 students.');
  } else if (allLearnerIds.size === 1) {
    console.log('  🟡 WARNING: Only 1 student enrolled!');
    console.log('     The database shows 50 enrollments with this instructor,');
    console.log('     but they may belong to a different instructor with the same name.');
  } else {
    console.log(`  🟢 OK: ${allLearnerIds.size} students should be visible in dashboard`);
  }
  
  // List all section IDs for reference
  console.log('\n  Your section IDs:');
  sections.forEach(s => {
    console.log(`    • ${s.section_id} (${s.section_name})`);
  });
  
  console.log('\n' + '='.repeat(70));
}

// Parse arguments
const args = process.argv.slice(2);
const instructorIdArg = args.find(arg => arg.startsWith('--instructor-id='));
const instructorNameArg = args.find(arg => arg.startsWith('--instructor-name='));

const instructorId = instructorIdArg ? instructorIdArg.split('=')[1] : undefined;
const instructorName = instructorNameArg ? instructorNameArg.split('=')[1] : undefined;

debugInstructorView(instructorId, instructorName).catch(err => {
  console.error('Debug failed:', err);
  process.exit(1);
});
