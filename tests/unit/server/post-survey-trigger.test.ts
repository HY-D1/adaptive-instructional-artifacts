import { describe, expect, it } from 'vitest';
import { isFinishedForPostSurvey } from '../../../apps/server/src/db/neon';

describe('provisional post-survey predicate', () => {
  it('does not consider a student finished before an attempt', () => {
    expect(isFinishedForPostSurvey({ attemptedProblemCount: 0 })).toBe(false);
  });

  it('considers one attempted problem finished provisionally', () => {
    expect(isFinishedForPostSurvey({ attemptedProblemCount: 1 })).toBe(true);
  });
});