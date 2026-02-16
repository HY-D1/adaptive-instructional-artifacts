import { Outlet, Link, useLocation } from 'react-router';
import { Button } from '../components/ui/button';
import { Book, BarChart3, Code, HelpCircle, Menu, X, Keyboard } from 'lucide-react';
import { useState, useEffect, useCallback } from 'react';
import { WelcomeModal } from '../components/WelcomeModal';
import { LearningInterface } from './LearningInterface';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../components/ui/tooltip';
import { Sheet, SheetContent, SheetTrigger } from '../components/ui/sheet';

export function RootLayout() {
  const location = useLocation();
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

  const isPracticePage = location.pathname === '/';
  const isTextbookPage = location.pathname === '/textbook';
  const isResearchPage = location.pathname === '/research';

  const navItems = [
    { to: '/', label: 'Practice', icon: Code, isActive: isPracticePage },
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
              <Link to="/" className="flex items-center gap-2 shrink-0">
                <Code className="size-6 text-blue-600" />
                <span className="font-bold text-lg hidden sm:block">SQL-Adapt</span>
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

                {/* Mobile menu */}
                <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
                  <SheetTrigger asChild className="md:hidden">
                    <Button variant="ghost" size="sm" className="touch-manipulation">
                      <Menu className="size-5" />
                    </Button>
                  </SheetTrigger>
                  <SheetContent side="right" className="w-[280px] sm:w-[350px]">
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

        <div className="flex-1 overflow-auto relative">
          {/* Practice interface - only rendered when on practice page */}
          {isPracticePage && (
            <div className="block h-full">
              <LearningInterface />
            </div>
          )}
          
          {/* Other pages via Outlet */}
          {(!isPracticePage) && (
            <div className="h-full">
              <Outlet />
            </div>
          )}
        </div>
      </div>
    </TooltipProvider>
  );
}
