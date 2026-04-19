import { describe, expect, it } from 'vitest';

import {
  canOpenWelcomeModal,
  isWelcomeModalRouteEligible,
  shouldAutoShowWelcomeModal,
} from './welcome-modal-visibility';

describe('welcome modal visibility gating', () => {
  it('blocks auth routes from auto-opening the onboarding modal', () => {
    expect(isWelcomeModalRouteEligible('/login')).toBe(false);
    expect(isWelcomeModalRouteEligible('/signup')).toBe(false);
    expect(
      shouldAutoShowWelcomeModal({
        pathname: '/login',
        authBackendConfigured: true,
        isAuthenticated: false,
      }),
    ).toBe(false);
  });

  it('blocks unauthenticated account-mode pages from opening the modal', () => {
    expect(
      shouldAutoShowWelcomeModal({
        pathname: '/research',
        authBackendConfigured: true,
        isAuthenticated: false,
      }),
    ).toBe(false);
    expect(
      canOpenWelcomeModal({
        pathname: '/research',
        authBackendConfigured: true,
        isAuthenticated: false,
      }),
    ).toBe(false);
  });

  it('allows authenticated app surfaces and local-only routes to open the modal', () => {
    expect(
      shouldAutoShowWelcomeModal({
        pathname: '/practice',
        authBackendConfigured: true,
        isAuthenticated: true,
      }),
    ).toBe(true);
    expect(
      canOpenWelcomeModal({
        pathname: '/',
        authBackendConfigured: false,
        isAuthenticated: false,
      }),
    ).toBe(true);
  });
});
