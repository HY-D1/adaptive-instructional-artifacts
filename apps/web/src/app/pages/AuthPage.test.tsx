import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router';

const mocks = vi.hoisted(() => ({
  useAuth: vi.fn(),
  isResearchUnsafe: vi.fn(),
  getResearchRuntimeMode: vi.fn(),
  getApiBaseUrl: vi.fn(),
}));

vi.mock('../lib/api/auth-client', () => ({
  AUTH_ENABLED: true,
}));

vi.mock('../lib/auth-context', () => ({
  useAuth: mocks.useAuth,
}));

vi.mock('../lib/runtime-config', () => ({
  isResearchUnsafe: mocks.isResearchUnsafe,
  getResearchRuntimeMode: mocks.getResearchRuntimeMode,
  getApiBaseUrl: mocks.getApiBaseUrl,
  RESEARCH_CONTRACT_VERSION: 'v1',
}));

import { AuthPage } from './AuthPage';

describe('AuthPage', () => {
  it('shows a connected status badge when AUTH_ENABLED is true', () => {
    // Setup mocks to render the normal login form branch
    mocks.useAuth.mockReturnValue({
      login: vi.fn(),
      signup: vi.fn(),
      isAuthenticated: false,
      isLoading: false,
      user: null,
    });
    mocks.isResearchUnsafe.mockReturnValue(false);
    mocks.getResearchRuntimeMode.mockReturnValue('dev-demo');
    mocks.getApiBaseUrl.mockReturnValue(undefined);

    render(
      <MemoryRouter>
        <AuthPage />
      </MemoryRouter>,
    );

    // Verify the badge component is rendered
    const badge = screen.getByText('Backend connected');
    expect(badge).toBeTruthy();
    expect(badge.className).toContain('atlas-badge');

    // Verify the badge dot with emerald color is present
    const dot = badge.querySelector('.atlas-badge__dot--emerald');
    expect(dot).toBeTruthy();
  });
});
