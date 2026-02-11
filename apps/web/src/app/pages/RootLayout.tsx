import { Outlet, Link, useLocation } from 'react-router';
import { Button } from '../components/ui/button';
import { Book, BarChart3, Code, HelpCircle } from 'lucide-react';
import { useState, useEffect } from 'react';
import { WelcomeModal } from '../components/WelcomeModal';

export function RootLayout() {
  const location = useLocation();
  const [showWelcome, setShowWelcome] = useState(false);

  useEffect(() => {
    const hasSeenWelcome = localStorage.getItem('sql-adapt-welcome-seen');
    if (!hasSeenWelcome) {
      setShowWelcome(true);
    }
  }, []);

  const handleCloseWelcome = () => {
    localStorage.setItem('sql-adapt-welcome-seen', 'true');
    setShowWelcome(false);
  };

  return (
    <div className="flex flex-col h-screen">
      {showWelcome && <WelcomeModal onClose={handleCloseWelcome} />}
      
      <nav className="border-b bg-white">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-8">
              <Link to="/" className="flex items-center gap-2">
                <Code className="size-6 text-blue-600" />
                <span className="font-bold text-lg">SQL-Adapt</span>
              </Link>
              <div className="flex gap-2">
                <Button
                  variant={location.pathname === '/' ? 'default' : 'ghost'}
                  size="sm"
                  asChild
                >
                  <Link to="/">
                    <Code className="size-4 mr-2" />
                    Practice
                  </Link>
                </Button>
                <Button
                  variant={location.pathname === '/textbook' ? 'default' : 'ghost'}
                  size="sm"
                  asChild
                >
                  <Link to="/textbook">
                    <Book className="size-4 mr-2" />
                    My Textbook
                  </Link>
                </Button>
                <Button
                  variant={location.pathname === '/research' ? 'default' : 'ghost'}
                  size="sm"
                  asChild
                >
                  <Link to="/research">
                    <BarChart3 className="size-4 mr-2" />
                    Research
                  </Link>
                </Button>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowWelcome(true)}
            >
              <HelpCircle className="size-4 mr-2" />
              Help
            </Button>
          </div>
        </div>
      </nav>
      <div className="flex-1 overflow-auto">
        <Outlet />
      </div>
    </div>
  );
}