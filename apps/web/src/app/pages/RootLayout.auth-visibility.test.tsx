import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const authState = vi.hoisted(() => ({
  user: null as { learnerId: string; name: string; role: 'student' | 'instructor' } | null,
  isLoading: false,
}));
const mockNavigate = vi.hoisted(() => vi.fn());
const mockLogout = vi.hoisted(() => vi.fn(async () => ({ success: true })));

vi.mock('react-router', () => ({
  Link: ({ children, to, ...props }: { children: React.ReactNode; to: string }) => <a href={to} {...props}>{children}</a>,
  Navigate: () => null,
  Outlet: () => null,
  useLocation: () => ({ pathname: '/' }),
  useNavigate: () => mockNavigate,
}));

vi.mock('../lib/auth-context', () => ({
  useAuth: () => ({ ...authState, logout: mockLogout }),
}));

vi.mock('../hooks/useUserRole', () => ({
  useUserRole: () => ({
    role: 'student',
    isStudent: true,
    isInstructor: false,
    isLoading: false,
    clearProfile: vi.fn(),
  }),
}));

vi.mock('../hooks/useSessionPersistence', () => ({
  useSessionPersistence: () => ({
    showSyncToast: false,
    dismissToast: vi.fn(),
    profile: authState.user ? { id: authState.user.learnerId, name: authState.user.name } : null,
    isLoading: false,
    isSessionExpired: false,
  }),
}));

vi.mock('../lib/storage', () => ({
  storage: {
    getUserProfile: vi.fn(() => null),
    finalizeActiveSessionBeforeLogout: vi.fn(async () => ({ backendConfirmed: true })),
  },
}));

vi.mock('../lib/auth-guard', () => ({
  isPreviewModeActive: () => false,
}));

vi.mock('../lib/ui-state', () => ({
  clearAllUiState: vi.fn(),
  clearUiStateForActor: vi.fn(),
}));

vi.mock('../lib/api/auth-client', () => ({
  AUTH_BACKEND_CONFIGURED: false,
}));

vi.mock('../lib/api/storage-client', () => ({
  getSurveyInvitationsResult: vi.fn(),
}));

vi.mock('../components/ui/toast', () => ({
  useToast: () => ({ addToast: vi.fn() }),
}));

vi.mock('../components/shared/WelcomeModal', () => ({
  WelcomeModal: () => null,
}));

vi.mock('../components/shared/CommandMenu', () => ({
  CommandMenu: () => null,
}));

vi.mock('../components/features/surveys/LogoutSurveyReminderDialog', () => ({
  LogoutSurveyReminderDialog: () => null,
  getPendingPostSurveyUrlWithTimeout: vi.fn(),
}));

vi.mock('../components/ui/tooltip', () => ({
  TooltipProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipContent: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('../components/ui/sheet', () => ({
  Sheet: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SheetTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SheetContent: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

import { RootLayout } from './RootLayout';

describe('RootLayout signed-in visibility', () => {
  beforeEach(() => {
    authState.user = null;
    authState.isLoading = false;
    window.matchMedia = vi.fn(() => ({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })) as unknown as typeof window.matchMedia;
    mockNavigate.mockReset();
    mockLogout.mockReset();
    mockLogout.mockResolvedValue({ success: true });
  });

  it('hides authenticated controls for signed-out visitors on desktop and mobile', () => {
    render(<RootLayout />);

    expect(screen.queryAllByRole('button', { name: 'Logout' })).toHaveLength(0);
    expect(screen.queryByText('Student')).toBeNull();
    expect(screen.queryByText('My Textbook')).toBeNull();
    expect(screen.queryByText('Settings')).toBeNull();
  });

  it('hides authenticated controls while the session is loading', () => {
    authState.isLoading = true;

    render(<RootLayout />);

    expect(screen.queryAllByRole('button', { name: 'Logout' })).toHaveLength(0);
    expect(screen.queryByText('Student')).toBeNull();
  });

  it('shows the role badge and both desktop and mobile Logout controls when signed in', () => {
    authState.user = { learnerId: 'student-1', name: 'Student One', role: 'student' };

    render(<RootLayout />);

    expect(screen.getByText('Student')).not.toBeNull();
    expect(screen.getAllByRole('button', { name: 'Logout' })).toHaveLength(2);
    expect(screen.getAllByText('My Textbook')).toHaveLength(2);
    expect(screen.getAllByText('Settings')).toHaveLength(2);
  });

  it('removes the role badge and both Logout controls after logout', async () => {
    authState.user = { learnerId: 'student-1', name: 'Student One', role: 'student' };
    const view = render(<RootLayout />);

    await screen.getAllByRole('button', { name: 'Logout' })[0].click();
    authState.user = null;
    view.rerender(<RootLayout />);

    expect(screen.queryAllByRole('button', { name: 'Logout' })).toHaveLength(0);
    expect(screen.queryByText('Student')).toBeNull();
  });
});
