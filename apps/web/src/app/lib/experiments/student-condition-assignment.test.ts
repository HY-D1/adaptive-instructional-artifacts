import { describe, expect, it } from 'vitest';
import {
  deterministicStudentCondition,
  ensureStudentConditionAssignment,
  type StudentConditionAssignment,
  type StudentConditionStore,
} from './student-condition-assignment';

class MemoryAssignmentStore implements StudentConditionStore {
  private assignments = new Map<string, StudentConditionAssignment>();

  async get(userId: string): Promise<StudentConditionAssignment | null> {
    return this.assignments.get(userId) ?? null;
  }

  async createIfAbsent(assignment: StudentConditionAssignment): Promise<StudentConditionAssignment> {
    const existing = this.assignments.get(assignment.userId);
    if (existing) return existing;
    this.assignments.set(assignment.userId, assignment);
    return assignment;
  }
}

describe('student condition assignment', () => {
  it('deterministically assigns only adaptive or control', () => {
    const first = deterministicStudentCondition('synthetic-student-1');
    const second = deterministicStudentCondition('synthetic-student-1');

    expect(first).toBe(second);
    expect(['adaptive', 'control']).toContain(first);
  });

  it('persists the first assignment across later sessions and sections', async () => {
    const store = new MemoryAssignmentStore();
    const first = await ensureStudentConditionAssignment(
      'synthetic-student-2',
      'real-section-a',
      store,
      100,
    );
    const later = await ensureStudentConditionAssignment(
      'synthetic-student-2',
      'real-section-b',
      store,
      200,
    );

    expect(later).toEqual(first);
    expect(later.firstSectionId).toBe('real-section-a');
  });

  it('requires a real student and first section key', async () => {
    const store = new MemoryAssignmentStore();
    await expect(ensureStudentConditionAssignment('', 'section', store)).rejects.toThrow('userId');
    await expect(ensureStudentConditionAssignment('student', '', store)).rejects.toThrow('firstSectionId');
  });
});