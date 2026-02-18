import { Outlet, Link, useLocation, Navigate } from 'react-router';
import { Button } from '../components/ui/button';
import { Book, BarChart3, Code, HelpCircle, Menu, X, Keyboard, GraduationCap, LogOut } from 'lucide-react';
import { useState, useEffect, useCallback } from 'react';
import { WelcomeModal } from '../components/WelcomeModal';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../components/ui/tooltip';
import { Sheet, SheetContent, SheetTrigger } from '../components/ui/sheet';
import { useUserRole } from '../hooks/useUserRole';
import { storage } from '../lib/storage';

export function RootLayout() {
  const location = useLocation();
  const { role, isStudent, isInstructor, isLoading: isRoleLoading } = useUserRole();
  const [showWelcome, setShowWelcome] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const hasSeenWelcome = localStorage.getItem('sql-adapt-welcome-seen');
    const hasDisabledWelcome = localStorage.getItem('sql-adapt-welcome-disabled');
    if (!hasSeenWelcome && !hasDisabledWelcome) {
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
    localStorage.setItem('sql-adapt-welcome-seen', 'true');
    setShowWelcome(false);
  };

  const isPracticePage = location.pathname === '/practice';
  const isTextbookPage = location.pathname === '/textbook';
  const isResearchPage = location.pathname === '/research';
  const isInstructorPage = location.pathname === '/instructor-dashboard';

  // Redirect instructor accessing student-only pages to instructor dashboard
  if (!isRoleLoading && isInstructor && (isPracticePage || isTextbookPage)) {
    return <Navigate to="/instructor-dashboard" replace />;
  }

  // Build navigation items based on role
  const navItems = isInstructor
    ? [
        { to: '/instructor-dashboard', label: 'Dashboard', icon: BarChart3, isActive: isInstructorPage },
        { to: '/research', label: 'Research', icon: Book, isActive: isResearchPage },
      ]
    : [
        { to: '/practice', label: 'Practice', icon: Code, isActive: isPracticePage },
        { to: '/textbook', label: 'My Textbook', icon: Book, isActive: isTextbookPage },
        { to: '/research', label: 'Research', icon: BarChart3, isActive: isResearchPage },
      ];

  return (
    <TooltipProvider delayDuration={100}>
      <div className="flex flex-col h-screen">
        {showWelcome && <WelcomeModal onClose={handleCloseWelcome} />}
        
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

                {/* Logout button */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        storage.clearUserProfile();
                        window.location.href = '/';
                      }}
                      className="touch-manipulation hidden md:flex"
                      aria-label="Logout"
                    >
                      <LogOut className="size-4 mr-2 hidden sm:block" />
                      <span className="hidden sm:inline">Logout</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Logout and return to start page</p>
                  </TooltipContent>
                </Tooltip>

                {/* Mobile menu */}
                <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
                  <SheetTrigger asChild className="md:hidden">
                    <Button variant="ghost" size="sm" className="touch-manipulation">
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
                      <div className="py-4 border-t space-y-4">
                        <Button
                          variant="ghost"
                          size="lg"
                          className="w-full justify-start touch-manipulation text-red-600 hover:text-red-700 hover:bg-red-50"
                          onClick={() => {
                            storage.clearUserProfile();
                            window.location.href = '/';
                          }}
                        >
                          <LogOut className="size-5 mr-3" />
                          <span>Logout</span>
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
        </nav>

        <div className="flex-1 overflow-auto relative h-full">
          <Outlet />
        </div>
      </div>
    </TooltipProvider>
  );
}
