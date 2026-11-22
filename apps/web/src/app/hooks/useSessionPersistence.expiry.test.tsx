import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import type { ReactNode } from 'react';

const wrapper = ({ children }: { children: ReactNode }) => (
  <MemoryRouter>{children}</MemoryRouter>
);

const EIGHT_DAYS_AGO = () => String(Date.now() - 8 * 24 * 60 * 60 * 1000);

describe('useSessionPersistence expiry', () => {
  beforeEach(() => {
    vi.resetModules();
    localStorage.clear();
  });

  it('does not expire a backend-authenticated session because of a stale local timestamp', async () => {
    vi.doMock('../lib/api/auth-client', () => ({ AUTH_BACKEND_CONFIGURED: true }));
    const { useSessionPersistence } = await import('./useSessionPersistence');
    localStorage.setItem('sql-adapt-last-active', EIGHT_DAYS_AGO());

    const { result } = renderHook(() => useSessionPersistence(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.isSessionExpired).toBe(false);
    expect(localStorage.getItem('sql-adapt-last-active')).toBeNull();
  });

  it('still expires a local-only session after 7 days of inactivity', async () => {
    vi.doMock('../lib/api/auth-client', () => ({ AUTH_BACKEND_CONFIGURED: false }));
    const { useSessionPersistence } = await import('./useSessionPersistence');
    localStorage.setItem('sql-adapt-last-active', EIGHT_DAYS_AGO());

    const { result } = renderHook(() => useSessionPersistence(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.isSessionExpired).toBe(true);
  });
});
