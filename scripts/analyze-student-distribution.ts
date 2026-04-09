#!/usr/bin/env node
/**
 * Analyze Student Distribution by Instructor
 * 
 * Shows how students are distributed across instructors and sections.
 * 
 * Usage:
 *   npx tsx scripts/analyze-student-distribution.ts
 */

import { getDb } from '../apps/server/src/db/neon.js';

interface InstructorStats {
  instructorId: string;
  instructorName: string;
  sectionCount: number;
  enrolledStudentCount: number;
  sections: Array<{
    sectionId: string;
    sectionName: string;
    studentCount: number;
  }>;
}

interface OrphanedStudent {
  userId: string;
  name: string;
  createdAt: Date;
  interactionCount: number;
}

async function analyzeStudentDistribution() {
  const db = getDb();
  
  console.log('🔍 Analyzing Student Distribution\n');
  console.log('=' .repeat(60));
  
  // 1. Get total counts
  const totalStudents = await db`
    SELECT COUNT(*) as count FROM users WHERE role = 'student'
  `;
  const totalInstructors = await db`
    SELECT COUNT(*) as count FROM users WHERE role = 'instructor'
  `;
  const totalSections = await db`
    SELECT COUNT(*) as count FROM course_sections
  `;
  const totalEnrollments = await db`
    SELECT COUNT(*) as count FROM section_enrollments
  `;
  
  console.log('\n📊 OVERVIEW:');
  console.log(`  Total Students:     ${totalStudents[0].count}`);
  console.log(`  Total Instructors:  ${totalInstructors[0].count}`);
  console.log(`  Total Sections:     ${totalSections[0].count}`);
  console.log(`  Total Enrollments:  ${totalEnrollments[0].count}`);
  console.log(`  Orphaned Students:  ${Number(totalStudents[0].count) - Number(totalEnrollments[0].count)}`);
  
  // 2. Get instructor stats
  const instructorData = await db`
    SELECT 
      u.id as instructor_id,
      u.name as instructor_name,
      cs.id as section_id,
      cs.name as section_name,
      COUNT(se.id) as student_count
    FROM users u
    JOIN course_sections cs ON cs.instructor_user_id = u.id
    LEFT JOIN section_enrollments se ON se.section_id = cs.id
    WHERE u.role = 'instructor'
    GROUP BY u.id, u.name, cs.id, cs.name
    ORDER BY u.id, student_count DESC
  `;
  
  // Group by instructor
  const instructorMap = new Map<string, InstructorStats>();
  
  for (const row of instructorData) {
    if (!instructorMap.has(row.instructor_id)) {
      instructorMap.set(row.instructor_id, {
        instructorId: row.instructor_id,
        instructorName: row.instructor_name,
        sectionCount: 0,
        enrolledStudentCount: 0,
        sections: []
      });
    }
    
    const stats = instructorMap.get(row.instructor_id)!;
    stats.sectionCount++;
    stats.enrolledStudentCount += Number(row.student_count);
    stats.sections.push({
      sectionId: row.section_id,
      sectionName: row.section_name,
      studentCount: Number(row.student_count)
    });
  }
  
  const instructors = Array.from(instructorMap.values());
  
  // Sort by student count (descending)
  instructors.sort((a, b) => b.enrolledStudentCount - a.enrolledStudentCount);
  
  // 3. Display instructor breakdown
  console.log('\n\n🏆 INSTRUCTOR RANKINGS (by enrolled students):');
  console.log('-'.repeat(60));
  
  instructors.forEach((inst, index) => {
    const rank = index + 1;
    const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : '  ';
    console.log(`\n${medal} #${rank} ${inst.instructorName}`);
    console.log(`   ID: ${inst.instructorId}`);
    console.log(`   Students: ${inst.enrolledStudentCount} across ${inst.sectionCount} section(s)`);
    
    inst.sections.forEach(sec => {
      console.log(`     • ${sec.sectionName}: ${sec.studentCount} students`);
    });
  });
  
  // 4. Find orphaned students
  const orphanedStudents = await db`
    SELECT 
      u.id,
      u.name,
      u.created_at,
      (SELECT COUNT(*) FROM interaction_events i WHERE i.user_id = u.id) as interaction_count
    FROM users u
    WHERE u.role = 'student'
      AND NOT EXISTS (
        SELECT 1 FROM section_enrollments e 
        WHERE e.student_user_id = u.id
      )
    ORDER BY interaction_count DESC
  `;
  
  console.log('\n\n👻 ORPHANED STUDENTS (not enrolled in any section):');
  console.log('-'.repeat(60));
  
  if (orphanedStudents.length === 0) {
    console.log('  None! All students are properly enrolled.');
  } else {
    console.log(`  Total: ${orphanedStudents.length} students\n`);
    
    orphanedStudents.forEach((student: OrphanedStudent) => {
      const hasActivity = student.interactionCount > 0;
      const activityIcon = hasActivity ? '✅' : '⚠️';
      console.log(`  ${activityIcon} ${student.name}`);
      console.log(`     ID: ${student.userId}`);
      console.log(`     Created: ${new Date(student.createdAt).toLocaleDateString()}`);
      console.log(`     Interactions: ${student.interactionCount}`);
      console.log();
    });
  }
  
  // 5. Summary
  console.log('\n\n📋 SUMMARY:');
  console.log('-'.repeat(60));
  const topInstructor = instructors[0];
  if (topInstructor) {
    console.log(`  🏆 Top Instructor: ${topInstructor.instructorName}`);
    console.log(`     Students: ${topInstructor.enrolledStudentCount}`);
    console.log(`     Sections: ${topInstructor.sectionCount}`);
  }
  
  const totalEnrolled = instructors.reduce((sum, i) => sum + i.enrolledStudentCount, 0);
  console.log(`\n  📈 Total Enrolled Students: ${totalEnrolled}`);
  console.log(`  👻 Total Orphaned Students: ${orphanedStudents.length}`);
  console.log(`  📊 Enrollment Rate: ${((totalEnrolled / Number(totalStudents[0].count)) * 100).toFixed(1)}%`);
  
  console.log('\n' + '='.repeat(60));
  
  // 6. Check if orphaned students have section activity
  console.log('\n\n🔍 Checking orphaned student activity by section...');
  
  const orphanedWithActivity = await db`
    SELECT DISTINCT
      u.id as user_id,
      u.name as user_name,
      i.section_id,
      cs.name as section_name,
      cs.instructor_user_id,
      inst.name as instructor_name,
      COUNT(i.id) as interaction_count
    FROM users u
    JOIN interaction_events i ON i.user_id = u.id
    LEFT JOIN course_sections cs ON cs.id = i.section_id
    LEFT JOIN users inst ON inst.id = cs.instructor_user_id
    WHERE u.role = 'student'
      AND NOT EXISTS (
        SELECT 1 FROM section_enrollments e 
        WHERE e.student_user_id = u.id
      )
      AND i.section_id IS NOT NULL
    GROUP BY u.id, u.name, i.section_id, cs.name, cs.instructor_user_id, inst.name
    ORDER BY interaction_count DESC
  `;
  
  if (orphanedWithActivity.length > 0) {
    console.log('\n  Found orphaned students with section activity:\n');
    
    // Group by instructor
    const activityByInstructor = new Map<string, Array<{
      studentName: string;
      sectionName: string;
      interactionCount: number;
    }>>();
    
    for (const row of orphanedWithActivity) {
      const instName = row.instructor_name || 'Unknown';
      if (!activityByInstructor.has(instName)) {
        activityByInstructor.set(instName, []);
      }
      activityByInstructor.get(instName)!.push({
        studentName: row.user_name,
        sectionName: row.section_name || 'Unknown Section',
        interactionCount: row.interaction_count
      });
    }
    
    for (const [instructor, activities] of activityByInstructor) {
      console.log(`  📍 Instructor: ${instructor}`);
      activities.forEach(a => {
        console.log(`     • ${a.studentName} in "${a.sectionName}" (${a.interactionCount} interactions)`);
      });
      console.log();
    }
    
    console.log('  💡 These students could be recovered via migration script');
  } else {
    console.log('  No orphaned students have section activity.');
  }
  
  console.log('\n' + '='.repeat(60));
}

analyzeStudentDistribution().catch(err => {
  console.error('Analysis failed:', err);
  process.exit(1);
});
