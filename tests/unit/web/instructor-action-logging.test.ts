import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// Instructor actions are logged under the instructor's own id (the server only
// accepts self-writes), with the student in payload.targetLearnerId.
describe('instructor dashboard action logging', () => {
  const source = readFileSync('apps/web/src/app/pages/InstructorDashboard.tsx', 'utf8');
  const block = (marker: string) => source.slice(source.indexOf(marker), source.indexOf('};', source.indexOf(marker)));

  it('logs interventions as the instructor, targeting the student', () => {
    const event = block('const interventionEvent: InteractionEvent = {');
    expect(event).toContain('learnerId: instructorActorId');
    expect(event).toContain('targetLearnerId: student.learnerId');
    expect(event).not.toMatch(/learnerId: student\.learnerId/);
  });

  it('logs profile overrides as an instructor action, never a fake condition_assigned', () => {
    const event = block('const overrideEvent: InteractionEvent = {');
    expect(event).toContain("eventType: 'instructor_profile_override'");
    expect(event).toContain('learnerId: instructorActorId');
    expect(event).toContain('targetLearnerId: student.learnerId');
    expect(event).not.toContain("'condition_assigned'");
    expect(event).not.toContain('conditionId:');
  });

  it('derives the actor from the signed-in instructor', () => {
    expect(source).toContain("const instructorActorId = authUser?.learnerId ?? profile?.id ?? 'instructor-local';");
  });
});
