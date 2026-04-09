#!/usr/bin/env node
import { getDb } from '../apps/server/src/db/neon.js';

async function findHInstructors() {
  const db = getDb();
  
  console.log('Finding all instructors named "H"...\n');
  
  const instructors = await db`
    SELECT 
      u.id,
      u.name,
      cs.id as section_id,
      cs.name as section_name,
      COUNT(se.id) as student_count
    FROM users u
    LEFT JOIN course_sections cs ON cs.instructor_user_id = u.id
    LEFT JOIN section_enrollments se ON se.section_id = cs.id
    WHERE u.role = 'instructor' AND u.name = 'H'
    GROUP BY u.id, u.name, cs.id, cs.name
    ORDER BY student_count DESC
  `;
  
  console.log(`Found ${instructors.length} section(s) for instructor(s) named "H":\n`);
  
  const byInstructor = new Map();
  
  for (const row of instructors) {
    if (!byInstructor.has(row.id)) {
      byInstructor.set(row.id, {
        name: row.name,
        sections: [],
        totalStudents: 0
      });
    }
    const inst = byInstructor.get(row.id);
    inst.sections.push({
      sectionId: row.section_id,
      sectionName: row.section_name,
      studentCount: row.student_count
    });
    inst.totalStudents += Number(row.student_count);
  }
  
  for (const [id, data] of byInstructor) {
    console.log(`Instructor ID: ${id}`);
    console.log(`Name: ${data.name}`);
    console.log(`Total Students: ${data.totalStudents}`);
    console.log('Sections:');
    data.sections.forEach((s: { sectionName: string; sectionId: string; studentCount: number }) => {
      console.log(`  • ${s.sectionName} (${s.sectionId})`);
      console.log(`    Students: ${s.studentCount}`);
    });
    console.log();
  }
  
  // Also check section enrollments directly for instructor named H
  console.log('Checking section_enrollments for sections owned by "H"...\n');
  
  const directCheck = await db`
    SELECT 
      cs.id as section_id,
      cs.name as section_name,
      cs.instructor_user_id,
      u.name as instructor_name,
      COUNT(se.id) as enrollment_count
    FROM course_sections cs
    JOIN users u ON u.id = cs.instructor_user_id
    LEFT JOIN section_enrollments se ON se.section_id = cs.id
    WHERE u.name = 'H'
    GROUP BY cs.id, cs.name, cs.instructor_user_id, u.name
  `;
  
  console.log('Direct query results:');
  directCheck.forEach((row: { section_id: string; section_name: string; instructor_user_id: string; instructor_name: string; enrollment_count: number }) => {
    console.log(`  Section: ${row.section_name}`);
    console.log(`    ID: ${row.section_id}`);
    console.log(`    Instructor ID: ${row.instructor_user_id}`);
    console.log(`    Enrollments: ${row.enrollment_count}`);
    console.log();
  });
}

findHInstructors().catch(console.error);
