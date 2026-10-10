import { describe, expect, it } from 'vitest';
import { generateUsername } from '../../../apps/server/src/db/neon';

describe('generated usernames', () => {
  it('uses a readable role prefix and six lowercase alphanumeric characters', () => {
    expect(generateUsername('student')).toMatch(/^student-[a-z0-9]{6}$/);
    expect(generateUsername('instructor')).toMatch(/^instructor-[a-z0-9]{6}$/);
  });

  it('produces unique values across a synthetic account batch', () => {
    const usernames = Array.from({ length: 100 }, () => generateUsername('student'));
    expect(new Set(usernames).size).toBe(usernames.length);
  });
});