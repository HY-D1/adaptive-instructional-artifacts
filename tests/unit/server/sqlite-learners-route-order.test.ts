/* @vitest-environment node */
import { describe, expect, it, vi } from 'vitest';

vi.mock('../../../apps/server/src/db/index.js', () => ({
  createLearner: vi.fn(),
  getLearnerById: vi.fn(),
  getAllLearners: vi.fn(),
  updateLearner: vi.fn(),
  deleteLearner: vi.fn(),
  saveLearnerProfile: vi.fn(),
  getLearnerProfile: vi.fn(),
  getAllLearnerProfiles: vi.fn(),
  updateProfileFromEvent: vi.fn(),
  appendProfileEvents: vi.fn(),
}));

type Layer = { route?: { path?: string; methods?: Record<string, boolean> }; match: (path: string) => boolean };

describe('SQLite learners router order', () => {
  it('dispatches GET /profiles to the profiles route, not GET /:id', async () => {
    const { learnersRouter } = await import('../../../apps/server/src/routes/learners.js');
    const stack = (learnersRouter as unknown as { stack: Layer[] }).stack;
    const firstGetMatch = stack.find((layer) => layer.route?.methods?.get && layer.match('/profiles'));
    expect(firstGetMatch?.route?.path).toBe('/profiles');
  });
});
