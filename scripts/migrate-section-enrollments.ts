#!/usr/bin/env node
/**
 * Section Enrollment Migration Script
 * 
 * This script migrates orphaned learners (those with interactions but no section_enrollments)
 * into the appropriate sections based on their interaction history.
 * 
 * Usage:
 *   npx tsx scripts/migrate-section-enrollments.ts [--dry-run] [--instructor-id=<id>]
 * 
 * Options:
 *   --dry-run          Preview changes without writing to database
 *   --instructor-id    Filter to a specific instructor's sections only
 *   --help             Show this help message
 */

import { getDb } from '../apps/server/src/db/neon.js';
import { 
  getInstructorScopedLearnerIds, 
  getOwnedSectionsByInstructor,
  enrollStudentInSection 
} from '../apps/server/src/db/sections.js';

interface MigrationCandidate {
  studentId: string;
  studentName: string;
  inferredSectionId: string;
  sectionName: string;
  instructorId: string;
  interactionCount: number;
  firstInteraction: Date;
  lastInteraction: Date;
  confidence: 'high' | 'medium' | 'low';
}

interface MigrationResult {
  candidates: MigrationCandidate[];
  conflicts: Array<{
    studentId: string;
    studentName: string;
    sectionIds: string[];
    sectionNames: string[];
  }>;
  skipped: Array<{
    studentId: string;
    reason: string;
  }>;
}

interface MigrationSummary {
  totalOrphaned: number;
  migrationCandidates: number;
  conflicts: number;
  skipped: number;
  enrolled: number;
  errors: number;
}

const HELP_MESSAGE = `
Section Enrollment Migration Script

This script migrates orphaned learners (those with interactions but no section_enrollments)
into the appropriate sections based on their interaction history.

Usage:
  npx tsx scripts/migrate-section-enrollments.ts [options]

Options:
  --dry-run          Preview changes without writing to database
  --instructor-id    Filter to a specific instructor's sections only
  --help             Show this help message

Examples:
  # Dry run to preview changes
  npx tsx scripts/migrate-section-enrollments.ts --dry-run

  # Migrate only for a specific instructor
  npx tsx scripts/migrate-section-enrollments.ts --instructor-id=abc123

  # Full migration
  npx tsx scripts/migrate-section-enrollments.ts
`;

async function auditOrphanedLearners(instructorId?: string): Promise<MigrationResult> {
  const db = getDb();
  
  // Build the base query for orphaned learners
  let orphanedQuery = `
    SELECT 
      u.id as student_id,
      u.name as student_name,
      u.created_at as user_created_at
    FROM users u
    WHERE u.role = 'student'
      AND NOT EXISTS (
        SELECT 1 FROM section_enrollments e 
        WHERE e.student_user_id = u.id
      )
  `;
  
  if (instructorId) {
    // Filter to learners who have interactions in sections owned by this instructor
    orphanedQuery += `
      AND EXISTS (
        SELECT 1 FROM interaction_events i
        JOIN course_sections cs ON cs.id = i.section_id
        WHERE i.user_id = u.id
          AND cs.instructor_user_id = '${instructorId}'
      )
    `;
  }
  
  const orphanedLearners = await db.query(orphanedQuery);
  
  const candidates: MigrationCandidate[] = [];
  const conflicts: MigrationResult['conflicts'] = [];
  const skipped: MigrationResult['skipped'] = [];
  
  for (const learner of orphanedLearners) {
    const studentId = learner.student_id;
    
    // Get all sections this learner has interacted with
    const sectionActivity = await db`
      SELECT 
        i.section_id,
        cs.name as section_name,
        cs.instructor_user_id,
        COUNT(i.id) as interaction_count,
        MIN(i.timestamp) as first_interaction,
        MAX(i.timestamp) as last_interaction
      FROM interaction_events i
      LEFT JOIN course_sections cs ON cs.id = i.section_id
      WHERE i.user_id = ${studentId}
        AND i.section_id IS NOT NULL
      GROUP BY i.section_id, cs.name, cs.instructor_user_id
      ORDER BY interaction_count DESC, last_interaction DESC
    `;
    
    if (sectionActivity.length === 0) {
      skipped.push({
        studentId,
        reason: 'No interactions with section_id - cannot determine enrollment'
      });
      continue;
    }
    
    if (sectionActivity.length > 1) {
      // Multi-section conflict
      conflicts.push({
        studentId,
        studentName: learner.student_name,
        sectionIds: sectionActivity.map(s => s.section_id),
        sectionNames: sectionActivity.map(s => s.section_name || 'Unknown')
      });
      continue;
    }
    
    // Single section - high confidence candidate
    const dominantSection = sectionActivity[0];
    candidates.push({
      studentId,
      studentName: learner.student_name,
      inferredSectionId: dominantSection.section_id,
      sectionName: dominantSection.section_name || 'Unknown',
      instructorId: dominantSection.instructor_user_id,
      interactionCount: Number(dominantSection.interaction_count),
      firstInteraction: new Date(dominantSection.first_interaction),
      lastInteraction: new Date(dominantSection.last_interaction),
      confidence: 'high'
    });
  }
  
  return { candidates, conflicts, skipped };
}

async function performMigration(
  candidates: MigrationCandidate[],
  dryRun: boolean
): Promise<{ enrolled: number; errors: number }> {
  let enrolled = 0;
  let errors = 0;
  
  for (const candidate of candidates) {
    try {
      if (!dryRun) {
        await enrollStudentInSection({
          sectionId: candidate.inferredSectionId,
          studentUserId: candidate.studentId
        });
      }
      enrolled++;
      
      if (dryRun) {
        console.log(`[DRY RUN] Would enroll: ${candidate.studentName} (${candidate.studentId}) → ${candidate.sectionName}`);
      } else {
        console.log(`✓ Enrolled: ${candidate.studentName} (${candidate.studentId}) → ${candidate.sectionName}`);
      }
    } catch (error) {
      errors++;
      console.error(`✗ Failed to enroll ${candidate.studentName} (${candidate.studentId}):`, error);
    }
  }
  
  return { enrolled, errors };
}

async function printAuditReport(result: MigrationResult, summary: MigrationSummary) {
  console.log('\n========================================');
  console.log('SECTION ENROLLMENT MIGRATION REPORT');
  console.log('========================================\n');
  
  console.log('SUMMARY:');
  console.log(`  Total orphaned learners:     ${summary.totalOrphaned}`);
  console.log(`  Migration candidates:        ${summary.migrationCandidates}`);
  console.log(`  Multi-section conflicts:     ${summary.conflicts}`);
  console.log(`  Skipped (no section data):   ${summary.skipped}`);
  console.log(`  Successfully enrolled:       ${summary.enrolled}`);
  console.log(`  Errors:                      ${summary.errors}`);
  console.log();
  
  if (result.candidates.length > 0) {
    console.log('MIGRATION CANDIDATES (High Confidence):');
    console.log('----------------------------------------');
    for (const c of result.candidates.slice(0, 10)) {
      console.log(`  • ${c.studentName}`);
      console.log(`    ID: ${c.studentId}`);
      console.log(`    → Section: ${c.sectionName} (${c.inferredSectionId})`);
      console.log(`    Interactions: ${c.interactionCount}`);
      console.log(`    Last active: ${c.lastInteraction.toISOString().split('T')[0]}`);
      console.log();
    }
    if (result.candidates.length > 10) {
      console.log(`  ... and ${result.candidates.length - 10} more`);
    }
  }
  
  if (result.conflicts.length > 0) {
    console.log('\nMULTI-SECTION CONFLICTS (Require Manual Review):');
    console.log('------------------------------------------------');
    for (const conflict of result.conflicts.slice(0, 5)) {
      console.log(`  • ${conflict.studentName} (${conflict.studentId})`);
      console.log(`    Sections: ${conflict.sectionNames.join(', ')}`);
      console.log();
    }
    if (result.conflicts.length > 5) {
      console.log(`  ... and ${result.conflicts.length - 5} more conflicts`);
    }
  }
  
  if (result.skipped.length > 0) {
    console.log('\nSKIPPED (No Section Data):');
    console.log('--------------------------');
    for (const skip of result.skipped.slice(0, 5)) {
      console.log(`  • ${skip.studentId}: ${skip.reason}`);
    }
    if (result.skipped.length > 5) {
      console.log(`  ... and ${result.skipped.length - 5} more`);
    }
  }
  
  console.log('\n========================================\n');
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const help = args.includes('--help');
  const instructorIdArg = args.find(arg => arg.startsWith('--instructor-id='));
  const instructorId = instructorIdArg ? instructorIdArg.split('=')[1] : undefined;
  
  if (help) {
    console.log(HELP_MESSAGE);
    process.exit(0);
  }
  
  console.log('Section Enrollment Migration');
  console.log('============================');
  console.log(`Mode: ${dryRun ? 'DRY RUN (preview only)' : 'LIVE MIGRATION'}`);
  if (instructorId) {
    console.log(`Instructor Filter: ${instructorId}`);
  }
  console.log();
  
  try {
    // Step 1: Audit
    console.log('Step 1: Auditing orphaned learners...');
    const auditResult = await auditOrphanedLearners(instructorId);
    console.log(`  Found ${auditResult.candidates.length} migration candidates`);
    console.log(`  Found ${auditResult.conflicts.length} multi-section conflicts`);
    console.log(`  Skipped ${auditResult.skipped.length} (no section data)`);
    console.log();
    
    // Step 2: Perform migration (or preview)
    console.log('Step 2: Processing migration candidates...');
    const { enrolled, errors } = await performMigration(auditResult.candidates, dryRun);
    console.log();
    
    // Step 3: Generate report
    const totalOrphaned = auditResult.candidates.length + auditResult.conflicts.length + auditResult.skipped.length;
    const summary: MigrationSummary = {
      totalOrphaned,
      migrationCandidates: auditResult.candidates.length,
      conflicts: auditResult.conflicts.length,
      skipped: auditResult.skipped.length,
      enrolled,
      errors
    };
    
    await printAuditReport(auditResult, summary);
    
    if (dryRun) {
      console.log('This was a DRY RUN. No changes were made to the database.');
      console.log('To perform the actual migration, run without --dry-run\n');
    }
    
    process.exit(errors > 0 ? 1 : 0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

main();
