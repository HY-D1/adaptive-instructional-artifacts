import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { assignProfile } from '../../../apps/web/src/app/lib/ml/escalation-profiles';

describe('control sub-schedule logging (D1: keep variation, log it)', () => {
  it('keeps the hash-based control profile deterministic so past learners can be recomputed', () => {
    for (const learnerId of ['student-a', 'student-b', '4f1c2a77-1111-2222-3333-444455556666']) {
      const first = assignProfile({ learnerId }, 'static').id;
      expect(assignProfile({ learnerId }, 'static').id).toBe(first);
      expect(['fast-escalator', 'adaptive-escalator', 'slow-escalator']).toContain(first);
    }
  });

  it('labels control assignments as a static hash profile instead of bandit', () => {
    const source = readFileSync('apps/web/src/app/pages/LearningInterface.tsx', 'utf8');
    expect(source).toContain("'control_static_hash_profile'");
    expect(source).toContain("controlSubSchedule: assignProfile({ learnerId }, 'static').id");
    expect(source).toMatch(/config\.conditionId === 'control' \|\| config\.staticHintMode\s*\?\s*'static'/);
  });
});
