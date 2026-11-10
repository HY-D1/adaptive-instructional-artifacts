import * as db from '../db/neon.js';

export type AssignmentLookupResult =
  | { failed: true }
  | { failed: false; conditionId?: db.StudentCondition };

/**
 * Durable student_condition_assignments lookup shared by session and
 * interaction writes. A lookup failure is logged with the
 * `[condition/lookup-failed]` tag and reported as `{ failed: true }`; each
 * caller decides its own fallback.
 */
export async function lookupAssignedCondition(
  learnerId: string,
  route: string,
): Promise<AssignmentLookupResult> {
  try {
    const assignment = await db.getStudentConditionAssignment(learnerId);
    return { failed: false, conditionId: assignment?.conditionId };
  } catch (error) {
    console.error('[condition/lookup-failed]', {
      route,
      learnerId,
      error: error instanceof Error ? error.message : String(error),
    });
    return { failed: true };
  }
}
