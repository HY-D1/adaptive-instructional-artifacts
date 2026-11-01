/* @vitest-environment node */
import { beforeEach, describe, expect, it, vi } from 'vitest';
const query = vi.fn();
vi.mock('../../../apps/server/node_modules/@neondatabase/serverless/index.mjs', () => ({ neon: () => query, neonConfig: {} }));
vi.mock('../../../apps/server/src/db/env-resolver.js', () => ({ resolveDbEnv: () => ({ url: 'postgresql://example.invalid/test', source: 'test' }) }));
describe('full profile revision guard', () => {
  let collision: boolean;
  beforeEach(() => {
    collision = false;
    query.mockReset().mockImplementation(async (parts: TemplateStringsArray) => {
      const sql = parts.join('?');
      if (sql.includes('SELECT * FROM learner_profiles')) return [{ learner_id: 'student', name: 'Student', version: 4, interaction_count: 5 }];
      if (sql.includes('INSERT INTO learner_profiles')) return collision ? [] : [{ version: 5 }];
      return [];
    });
  });
  it('rejects a stale snapshot before writing newer evidence', async () => {
    const db = await import('../../../apps/server/src/db/neon');
    await expect(db.saveLearnerProfile('student', { interactionCount: 4 }, 3)).rejects.toBeInstanceOf(db.ProfileRevisionConflict);
    expect(query.mock.calls.some(([parts]) => parts.join('').includes('INSERT INTO learner_profiles'))).toBe(false);
  });
  it('checks the revision atomically and returns the new server revision', async () => {
    const db = await import('../../../apps/server/src/db/neon');
    const saved = await db.saveLearnerProfile('student', { name: 'Updated' }, 4);
    expect(saved?.serverRevision).toBe(5);
    const call = query.mock.calls.find(([parts]) => parts.join('').includes('INSERT INTO learner_profiles'))!;
    expect(call[0].join('?')).toContain('OR learner_profiles.version =');
    expect(call[0].join('?')).toContain('RETURNING version');
  });
  it('rejects a concurrent update that wins after the initial read', async () => {
    collision = true;
    const db = await import('../../../apps/server/src/db/neon');
    await expect(db.saveLearnerProfile('student', { name: 'Updated' }, 4)).rejects.toBeInstanceOf(db.ProfileRevisionConflict);
  });
});
