import { Outlet, Link, useLocation, Navigate, useNavigate } from 'react-router';
import { Button } from '../components/ui/button';
import { Compass, BookOpen, BarChart3, FlaskConical, Code, HelpCircle, Menu, X, Keyboard, GraduationCap, LogOut, RefreshCw, AlertCircle, Users, Settings, Eye } from 'lucide-react';
import { useState, useEffect, useCallback } from 'react';
import { WelcomeModal } from '../components/shared/WelcomeModal';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../components/ui/tooltip';
import { Sheet, SheetContent, SheetTrigger } from '../components/ui/sheet';
import { useUserRole } from '../hooks/useUserRole';
import { useSessionPersistence } from '../hooks/useSessionPersistence';
import { storage } from '../lib/storage';
import { isPreviewModeActive } from '../lib/auth-guard';
import { clearAllUiState, clearUiStateForActor } from '../lib/ui-state';
import { useAuth } from '../lib/auth-context';
import { AUTH_BACKEND_CONFIGURED } from '../lib/api/auth-client';
import { useToast } from '../components/ui/toast';

/**
 * Sync toast notification component
 * Shown when profile is updated in another tab
 */
interface SyncToastProps {
  onClose: () => void;
  profileName?: string;
}

function SyncToast({ onClose, profileName }: SyncToastProps) {
  return (
    <div 
      className="fixed top-20 right-4 z-50 animate-in slide-in-from-right duration-300"
      role="alert"
      aria-live="polite"
      data-testid="sync-toast"
    >
      <div className="bg-blue-600 text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-3 min-w-[300px]">
        <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center shrink-0">
          <RefreshCw className="w-4 h-4" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm">Profile synced from another tab</p>
          {profileName && (
            <p className="text-blue-100 text-xs truncate">{profileName}</p>
          )}
        </div>
        <button
          onClick={onClose}
          className="p-1 hover:bg-white/20 rounded transition-colors shrink-0"
          aria-label="Dismiss notification"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

/**
 * Preview mode banner component
 * Shown when instructor is viewing student routes in preview mode
 */
interface PreviewModeBannerProps {
  onExit: () => void;
}

function PreviewModeBanner({ onExit }: PreviewModeBannerProps) {
  return (
    <div className="bg-blue-100 border-b border-blue-200 px-4 py-2" data-testid="preview-mode-banner">
      <div className="container mx-auto flex items-center justify-center gap-3">
        <Eye className="size-4 text-blue-600" />
        <span className="text-sm text-blue-800">
          <strong>Preview Mode:</strong> You are viewing as a student
        </span>
        <Button variant="link" size="sm" onClick={onExit} className="text-blue-700 h-auto py-0">
          Exit Preview
        </Button>
      </div>
    </div>
  );
}

/**
 * Session expired notification component
 * Shown when session has expired and user needs to log in again
 */
interface SessionExpiredProps {
  onRedirect: () => void;
}

function SessionExpired({ onRedirect }: SessionExpiredProps) {
  return (
    <div 
      className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="session-expired-title"
      data-testid="session-expired-modal"
    >
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center">
            <AlertCircle className="w-5 h-5 text-amber-600" />
          </div>
          <h2 id="session-expired-title" className="text-lg font-semibold text-gray-900">
            Session Expired
          </h2>
        </div>
        <p className="text-gray-600 mb-6">
          Your session has expired due to 7 days of inactivity. Please log in again to continue.
        </p>
        <Button onClick={onRedirect} className="w-full">
          Return to Start Page
        </Button>
      </div>
    </div>
  );
}

export function RootLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { logout } = useAuth();
  const { addToast } = useToast();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState<string | null>(null);
  const postLogoutPath = AUTH_BACKEND_CONFIGURED ? '/login' : '/';
  const [showPreviewBanner, setShowPreviewBanner] = useState(false);
  
  // Session persistence hook for cross-tab sync (must come before useUserRole)
  const {
    showSyncToast,
    dismissToast,
    profile: syncedProfile,
    isLoading: isSessionLoading,
    isSessionExpired
  } = useSessionPersistence();
  
  // Pass synced profile from useSessionPersistence to useUserRole
  // This ensures role is always synchronized with the storage-synced profile
  const { role, isStudent, isInstructor, isLoading: isRoleLoading, clearProfile } = useUserRole({
    syncedProfile,
    syncedLoading: isSessionLoading
  });
  
  const [showWelcome, setShowWelcome] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    try {
      const hasSeenWelcome = localStorage.getItem('sql-adapt-welcome-seen');
      const hasDisabledWelcome = localStorage.getItem('sql-adapt-welcome-disabled');
      if (!hasSeenWelcome && !hasDisabledWelcome) {
        setShowWelcome(true);
      }
    } catch (error) {
      console.error('Failed to check welcome status:', error);
      // Show welcome modal if we can't check status
      setShowWelcome(true);
    }
  }, []);

  // Keyboard shortcuts
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // ? key to show help
    if (e.key === '?' && !e.ctrlKey && !e.metaKey && !e.altKey) {
      // Don't trigger if user is typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }
      setShowWelcome(true);
    }
    
    // Esc to close modal
    if (e.key === 'Escape' && showWelcome) {
      setShowWelcome(false);
    }
  }, [showWelcome]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const handleCloseWelcome = () => {
    try {
      localStorage.setItem('sql-adapt-welcome-seen', 'true');
    } catch (error) {
      console.error('Failed to save welcome status:', error);
    }
    setShowWelcome(false);
  };

  const isPracticePage = location.pathname === '/practice';
  const isTextbookPage = location.pathname === '/textbook';
  const isConceptsPage = location.pathname === '/concepts' || location.pathname.startsWith('/concepts/');
  const isResearchPage = location.pathname === '/research';
  const isInstructorPage = location.pathname === '/instructor-dashboard';
  const isSettingsPage = location.pathname === '/settings';
  
  const clearScopedUiState = useCallback(() => {
    const actorId = syncedProfile?.id || storage.getUserProfile()?.id;
    if (actorId) {
      clearUiStateForActor(actorId);
      return;
    }
    clearAllUiState();
  }, [syncedProfile?.id]);

  const finalizeLocalSignOut = useCallback(() => {
    // Clear all cached UI state on account switches to prevent stale role-scoped views.
    clearAllUiState();
    clearScopedUiState();
    clearProfile();
  }, [clearScopedUiState, clearProfile]);

  const handleLogout = useCallback(async () => {
    if (isLoggingOut) {
      return;
    }
    setLogoutError(null);
    setIsLoggingOut(true);
    const result = await logout();
    if (!result.success) {
      setLogoutError(result.error ?? 'Sign out failed. Please try again.');
      setIsLoggingOut(false);
      return;
    }

    finalizeLocalSignOut();
    setMobileMenuOpen(false);
    navigate(postLogoutPath, { replace: true });
    setIsLoggingOut(false);
  }, [isLoggingOut, logout, finalizeLocalSignOut, navigate, postLogoutPath]);

  // Handle session expired redirect
  const handleSessionExpiredRedirect = () => {
    finalizeLocalSignOut();
    navigate(postLogoutPath, { replace: true });
  };

  // Track preview mode state for banner visibility
  useEffect(() => {
    const checkPreviewMode = () => {
      const isPreview = isPreviewModeActive();
      setShowPreviewBanner(isInstructor && isPreview);
    };

    checkPreviewMode();

    // Listen for storage changes (cross-tab sync)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'sql-adapt-preview-mode') {
        checkPreviewMode();
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [isInstructor]);

  // Exit preview mode handler
  const handleExitPreview = useCallback(() => {
    localStorage.setItem('sql-adapt-preview-mode', 'false');
    // Broadcast to other tabs
    try {
      const event = new StorageEvent('storage', {
        key: 'sql-adapt-preview-mode',
        newValue: 'false',
        oldValue: 'true',
        storageArea: localStorage,
      });
      window.dispatchEvent(event);
    } catch {
      // Ignore broadcast errors
    }
    setShowPreviewBanner(false);
    addToast({
      type: 'success',
      title: 'Preview Mode Disabled',
      message: 'Returned to instructor view',
    });
    // Redirect to instructor dashboard
    navigate('/instructor-dashboard', { replace: true });
  }, [navigate, addToast]);

  // Handle switch user - clear profile and go to start page
  const handleSwitchUser = useCallback(() => {
    if (AUTH_BACKEND_CONFIGURED) {
      void handleLogout();
      return;
    }
    finalizeLocalSignOut();
    navigate(postLogoutPath, { replace: true });
  }, [finalizeLocalSignOut, handleLogout, navigate, postLogoutPath]);

  // Redirect instructor accessing /practice (student-only) to instructor dashboard
  // BUT allow access in preview mode
  // Instructors ARE allowed to access /textbook for learner inspection
  const isInPreviewMode = isPreviewModeActive();
  if (!isRoleLoading && isInstructor && !isInPreviewMode && isPracticePage) {
    return <Navigate to="/instructor-dashboard" replace />;
  }

  // Build navigation items based on role
  // When in preview mode, show student navigation even for instructors
  const showStudentNav = !isInstructor || isInPreviewMode;
  const navItems = showStudentNav
    ? [
        { to: '/concepts', label: 'Learn', icon: Compass, isActive: isConceptsPage },
        { to: '/practice', label: 'Practice', icon: Code, isActive: isPracticePage },
        { to: '/textbook', label: 'My Textbook', icon: BookOpen, isActive: isTextbookPage },
        { to: '/settings', label: 'Settings', icon: Settings, isActive: isSettingsPage },
      ]
    : [
        { to: '/instructor-dashboard', label: 'Dashboard', icon: BarChart3, isActive: isInstructorPage },
        { to: '/research', label: 'Research', icon: FlaskConical, isActive: isResearchPage },
        { to: '/settings', label: 'Settings', icon: Settings, isActive: isSettingsPage },
      ];

  return (
    <TooltipProvider delayDuration={100}>
      <div className="flex flex-col h-screen">
        {showWelcome && <WelcomeModal onClose={handleCloseWelcome} />}

        {/* Preview Mode Banner */}
        {showPreviewBanner && (
          <PreviewModeBanner onExit={handleExitPreview} />
        )}

        {/* Session Expired Modal */}
        {isSessionExpired && (
          <SessionExpired onRedirect={handleSessionExpiredRedirect} />
        )}

        {/* Cross-Tab Sync Toast */}
        {showSyncToast && !isSessionExpired && (
          <SyncToast
            onClose={dismissToast}
            profileName={syncedProfile?.name}
          />
        )}

        <nav className="border-b bg-white sticky top-0 z-40">
          <div className="container mx-auto px-4">
            <div className="flex items-center justify-between h-16">
              {/* Logo */}
              <Link to={isInstructor ? '/instructor-dashboard' : '/practice'} className="flex items-center gap-2 shrink-0">
                <Code className="size-6 text-blue-600" />
                <span className="font-bold text-lg hidden sm:block">SQL-Adapt</span>
                {isStudent && (
                  <span className="hidden sm:flex items-center gap-1 text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
                    <GraduationCap className="size-3" />
                    Student
                  </span>
                )}
                {isInstructor && (
                  <span className="hidden sm:flex items-center gap-1 text-xs text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full">
                    <BarChart3 className="size-3" />
                    Instructor
                  </span>
                )}
              </Link>

              {/* Desktop Navigation */}
              <div className="hidden md:flex items-center gap-1">
                {navItems.map((item) => (
                  <Tooltip key={item.to}>
                    <TooltipTrigger asChild>
                      <Button
                        variant={item.isActive ? 'default' : 'ghost'}
                        size="sm"
                        asChild
                        className="touch-manipulation"
                      >
                        <Link to={item.to} className="flex items-center gap-2">
                          <item.icon className="size-4" />
                          <span>{item.label}</span>
                        </Link>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Go to {item.label}</p>
                    </TooltipContent>
                  </Tooltip>
                ))}
              </div>

              {/* Right side actions */}
              <div className="flex items-center gap-2">
                {/* Keyboard shortcut hint - desktop only */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <kbd className="hidden lg:inline-flex items-center gap-1 px-2 py-1 text-xs font-mono bg-gray-100 border rounded">
                      <Keyboard className="size-3" />
                      ?
                    </kbd>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Press ? for help</p>
                  </TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowWelcome(true)}
                      className="touch-manipulation"
                      aria-label="Open help and keyboard shortcuts"
                    >
                      <HelpCircle className="size-4 mr-2 hidden sm:block" />
                      <span className="hidden sm:inline">Help</span>
                      <HelpCircle className="size-5 sm:hidden" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Show help & keyboard shortcuts</p>
                  </TooltipContent>
                </Tooltip>

                {/* Switch User button - only for instructors */}
                {isInstructor && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleSwitchUser}
                        disabled={isLoggingOut}
                        className="touch-manipulation hidden md:flex"
                        aria-label="Switch User"
                      >
                        <Users className="size-4 mr-2 hidden sm:block" />
                        <span className="hidden sm:inline">Switch User</span>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Switch to a different user account</p>
                    </TooltipContent>
                  </Tooltip>
                )}

                {/* Logout button */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => { void handleLogout(); }}
                      disabled={isLoggingOut}
                      className="touch-manipulation hidden md:flex"
                      aria-label="Logout"
                    >
                      <LogOut className="size-4 mr-2 hidden sm:block" />
                      <span className="hidden sm:inline">
                        {isLoggingOut ? 'Signing Out...' : 'Logout'}
                      </span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Sign out of your account</p>
                  </TooltipContent>
                </Tooltip>

                {/* Mobile menu */}
                <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
                  <SheetTrigger asChild className="md:hidden">
                    <Button variant="ghost" size="sm" className="touch-manipulation" aria-label="Open navigation menu">
                      <Menu className="size-5" />
                    </Button>
                  </SheetTrigger>
                  <SheetContent side="right" className="w-[85vw] max-w-[350px]">
                    <div className="flex flex-col h-full">
                      <div className="flex items-center justify-between py-4 border-b">
                        <span className="font-bold text-lg">Menu</span>
                      </div>
                      <div className="flex-1 py-4 space-y-2">
                        {navItems.map((item) => (
                          <Button
                            key={item.to}
                            variant={item.isActive ? 'default' : 'ghost'}
                            size="lg"
                            className="w-full justify-start touch-manipulation"
                            asChild
                            onClick={() => setMobileMenuOpen(false)}
                          >
                            <Link to={item.to} className="flex items-center gap-3">
                              <item.icon className="size-5" />
                              <span>{item.label}</span>
                            </Link>
                          </Button>
                        ))}
                      </div>
                      <div className="py-4 border-t space-y-2">
                        {isInstructor && (
                          <Button
                            variant="ghost"
                            size="lg"
                            className="w-full justify-start touch-manipulation"
                            onClick={() => {
                              setMobileMenuOpen(false);
                              handleSwitchUser();
                            }}
                            disabled={isLoggingOut}
                          >
                            <Users className="size-5 mr-3" />
                            <span>Switch User</span>
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="lg"
                          className="w-full justify-start touch-manipulation text-red-600 hover:text-red-700 hover:bg-red-50"
                          onClick={() => {
                            void handleLogout();
                          }}
                          disabled={isLoggingOut}
                        >
                          <LogOut className="size-5 mr-3" />
                          <span>{isLoggingOut ? 'Signing Out...' : 'Logout'}</span>
                        </Button>
                        <div className="px-2 text-sm text-gray-600">
                          <p className="font-medium mb-2">Keyboard Shortcuts</p>
                          <div className="space-y-1 text-xs">
                            <div className="flex justify-between">
                              <span>Ctrl + Enter</span>
                              <span className="text-gray-400">Run query</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Esc</span>
                              <span className="text-gray-400">Close modals</span>
                            </div>
                            <div className="flex justify-between">
                              <span>?</span>
                              <span className="text-gray-400">Show help</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </SheetContent>
                </Sheet>
              </div>
            </div>
          </div>
          {logoutError && (
            <div className="border-t border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700" role="alert">
              {logoutError}
            </div>
          )}
        </nav>

        <div className="flex-1 overflow-auto relative h-full">
          <Outlet />
        </div>
      </div>
    </TooltipProvider>
  );
}
