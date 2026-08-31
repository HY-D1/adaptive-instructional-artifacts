/**
 * Student-level adaptive/control assignment.
 *
 * Persistence is supplied by the caller; the production implementation is
 * the server-backed student_condition_assignments record.
 */

export const STUDENT_CONDITIONS = ['adaptive', 'control'] as const;
export type StudentCondition = (typeof STUDENT_CONDITIONS)[number];

export interface StudentConditionAssignment {
  userId: string;
  conditionId: StudentCondition;
  firstSectionId: string;
  assignedAt: number;
}

export interface StudentConditionStore {
  get(userId: string): Promise<StudentConditionAssignment | null>;
  createIfAbsent(
    assignment: StudentConditionAssignment,
  ): Promise<StudentConditionAssignment>;
}

function hashStudentId(userId: string): number {
  let hash = 0;
  for (let index = 0; index < userId.length; index += 1) {
    hash = ((hash << 5) - hash) + userId.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash);
}

export function deterministicStudentCondition(
  userId: string,
  seed = 0,
): StudentCondition {
  return STUDENT_CONDITIONS[(hashStudentId(userId) + seed) % STUDENT_CONDITIONS.length];
}

export async function ensureStudentConditionAssignment(
  userId: string,
  firstSectionId: string,
  store: StudentConditionStore,
  now = Date.now(),
  seed = 0,
): Promise<StudentConditionAssignment> {
  if (!userId.trim()) throw new Error('userId is required');
  if (!firstSectionId.trim()) throw new Error('firstSectionId is required');

  const existing = await store.get(userId);
  if (existing) return existing;

  return store.createIfAbsent({
    userId,
    conditionId: deterministicStudentCondition(userId, seed),
    firstSectionId,
    assignedAt: now,
  });
}