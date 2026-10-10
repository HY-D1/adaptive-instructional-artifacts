import { describe, expect, it, vi } from "vitest";
import {
  ensureStudentConditionAssignment,
  randomStudentCondition,
  type StudentConditionAssignment,
  type StudentConditionStore,
} from "./student-condition-assignment";
import { assignCondition } from "./condition-assignment";

class MemoryAssignmentStore implements StudentConditionStore {
  private assignments = new Map<string, StudentConditionAssignment>();

  async get(userId: string): Promise<StudentConditionAssignment | null> {
    return this.assignments.get(userId) ?? null;
  }

  async createIfAbsent(
    assignment: StudentConditionAssignment,
  ): Promise<StudentConditionAssignment> {
    const existing = this.assignments.get(assignment.userId);
    if (existing) return existing;
    this.assignments.set(assignment.userId, assignment);
    return assignment;
  }
}

describe("student condition assignment", () => {
  it("distributes synthetic first assignments according to the configured probability", async () => {
    const store = new MemoryAssignmentStore();
    const draws = Array.from({ length: 1000 }, (_, index) =>
      index % 2 === 0 ? 0.25 : 0.75,
    );
    let drawIndex = 0;
    const random = () => draws[drawIndex++];
    let adaptive = 0;
    let control = 0;

    for (let index = 0; index < draws.length; index += 1) {
      const assignment = await ensureStudentConditionAssignment(
        `synthetic-student-${index}`,
        "real-section-a",
        store,
        index,
        0.5,
        random,
      );
      if (assignment.conditionId === "adaptive") adaptive += 1;
      if (assignment.conditionId === "control") control += 1;
    }

    expect({ adaptive, control, total: adaptive + control }).toEqual({
      adaptive: 500,
      control: 500,
      total: 1000,
    });
  });

  it("persists the first assignment across later sessions and sections", async () => {
    const store = new MemoryAssignmentStore();
    const first = await ensureStudentConditionAssignment(
      "synthetic-student-2",
      "real-section-a",
      store,
      100,
    );
    const later = await ensureStudentConditionAssignment(
      "synthetic-student-2",
      "real-section-b",
      store,
      200,
    );

    expect(later).toEqual(first);
    expect(later.firstSectionId).toBe("real-section-a");
  });

  it("does not redraw at later decision points or in later sessions", async () => {
    const store = new MemoryAssignmentStore();
    let draws = 0;
    const random = () => {
      draws += 1;
      return 0.75;
    };

    const firstSession = await ensureStudentConditionAssignment(
      "synthetic-student-persistent",
      "real-section-a",
      store,
      100,
      0.5,
      random,
    );
    const secondDecisionPoint = await ensureStudentConditionAssignment(
      "synthetic-student-persistent",
      "real-section-a",
      store,
      200,
      0.5,
      random,
    );
    const laterSession = await ensureStudentConditionAssignment(
      "synthetic-student-persistent",
      "real-section-b",
      store,
      300,
      0.5,
      random,
    );

    expect(secondDecisionPoint).toEqual(firstSession);
    expect(laterSession).toEqual(firstSession);
    expect(draws).toBe(1);
  });

  it("warns loudly if the legacy session assignment path is called", () => {
    const error = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    const config = assignCondition("synthetic-student-legacy");

    expect(config.conditionId).not.toBe("control");
    expect(error).toHaveBeenCalledWith(
      "[DEPRECATED] Legacy session condition assignment called for synthetic-student-legacy; use the durable student condition assignment API.",
    );
    error.mockRestore();
  });

  it("requires a real student and first section key", async () => {
    const store = new MemoryAssignmentStore();
    await expect(
      ensureStudentConditionAssignment("", "section", store),
    ).rejects.toThrow("userId");
    await expect(
      ensureStudentConditionAssignment("student", "", store),
    ).rejects.toThrow("firstSectionId");
  });
});
