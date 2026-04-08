import { describe, expect, it } from 'vitest';

import { resolveLogoutLearnerId } from '../../../apps/web/src/app/lib/auth/logout-learner';

describe('resolveLogoutLearnerId', () => {
  it('uses the authenticated learner id when synced profile state is missing', () => {
    expect(
      resolveLogoutLearnerId({
        syncedProfileId: null,
        authLearnerId: ' learner-auth ',
        cachedProfileId: 'learner-cache',
      }),
    ).toBe('learner-auth');
  });

  it('falls back to cached profile id when auth state is unavailable', () => {
    expect(
      resolveLogoutLearnerId({
        syncedProfileId: undefined,
        authLearnerId: '',
        cachedProfileId: 'learner-cache',
      }),
    ).toBe('learner-cache');
  });
});
