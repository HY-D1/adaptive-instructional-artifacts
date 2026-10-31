/**
 * Student-level adaptive/control assignment.
 *
 * Persistence is supplied by the caller; the production implementation is
 * the server-backed student_condition_assignments record.
 */

export const STUDENT_CONDITIONS = ["adaptive", "control"] as const;
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

export function randomStudentCondition(
  adaptiveProbability = 0.5,
  random = Math.random,
): StudentCondition {
  const probability = Number.isFinite(adaptiveProbability)
    ? Math.min(1, Math.max(0, adaptiveProbability))
    : 0.5;
  return random() < probability ? "adaptive" : "control";
}

export async function ensureStudentConditionAssignment(
  userId: string,
  firstSectionId: string,
  store: StudentConditionStore,
  now = Date.now(),
  adaptiveProbability = 0.5,
  random = Math.random,
): Promise<StudentConditionAssignment> {
  if (!userId.trim()) throw new Error("userId is required");
  if (!firstSectionId.trim()) throw new Error("firstSectionId is required");

  const existing = await store.get(userId);
  if (existing) return existing;

  return store.createIfAbsent({
    userId,
    conditionId: randomStudentCondition(adaptiveProbability, random),
    firstSectionId,
    assignedAt: now,
  });
}
