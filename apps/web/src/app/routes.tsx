import { createBrowserRouter, Navigate, redirect } from 'react-router';
import type { LoaderFunction } from 'react-router';

import { RouteError } from './components/RouteError';
import { RootLayout } from './pages/RootLayout';
import { TextbookPage } from './pages/TextbookPage';
import { ResearchPage } from './pages/ResearchPage';
import { InstructorDashboard } from './pages/InstructorDashboard';
import { StartPage } from './pages/StartPage';
import { LearningInterface } from './pages/LearningInterface';
import { SettingsPage } from './pages/SettingsPage';
import { ConceptLibraryPage } from './pages/ConceptLibraryPage';
import { ConceptDetailPage } from './pages/ConceptDetailPage';
import { storage } from './lib/storage';
import { 
  ROUTES, 
  protectRoute, 
  getDefaultRouteForRole
} from './lib/auth-guard';
import type { GuardResult } from './lib/auth-guard';

/**
 * Start page loader - redirects authenticated users to their default route
 * This runs BEFORE the component renders, ensuring fast redirect
 * 
 * Note: We use client-side redirect in the component instead of loader redirect
 * to avoid navigation/hydration issues with React Router
 */
function startPageLoader(): null {
  // The redirect is handled in the StartPage component via useEffect
  // This ensures proper React rendering lifecycle and avoids loader redirect issues
  return null;
}

/**
 * Protected route loader factory
 * Creates a loader function that checks authentication and role
 * Returns redirect response if access denied, null if allowed
 */
function createProtectedLoader(options?: { 
  requiredRole?: 'student' | 'instructor';
  allowAuthenticated?: boolean;
}): LoaderFunction {
  return () => {
    const result = protectRoute(options);
    
    if (!result.allowed && result.redirect) {
      // Use React Router's redirect for proper navigation
      // If redirecting to login and no login route exists, go to home
      const redirectTo = result.redirect === ROUTES.LOGIN ? ROUTES.HOME : result.redirect;
      return redirect(redirectTo);
    }
    
    return null;
  };
}

/**
 * Component wrapper that enforces role-based access
 * Redirects if not authorized
 * Note: Loader should handle redirects, this is a fallback
 */
function ProtectedRoute({ 
  children, 
  requiredRole 
}: { 
  children: React.ReactNode; 
  requiredRole?: 'student' | 'instructor';
}) {
  const profile = storage.getUserProfile();
  
  // Not authenticated - redirect to home (start page)
  if (!profile) {
    return <Navigate to={ROUTES.HOME} replace />;
  }
  
  // Role check
  if (requiredRole && profile.role !== requiredRole) {
    return <Navigate to={getDefaultRouteForRole(profile.role)} replace />;
  }
  
  return <>{children}</>;
}

// Student-only route wrapper
function StudentRoute({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute requiredRole="student">
      {children}
    </ProtectedRoute>
  );
}

// Instructor-only route wrapper
function InstructorRoute({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute requiredRole="instructor">
      {children}
    </ProtectedRoute>
  );
}

// Authenticated route wrapper (any role)
function AuthenticatedRoute({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute>
      {children}
    </ProtectedRoute>
  );
}

export const router = createBrowserRouter([
  // Main app routes - nested under RootLayout with navigation
  {
    path: '/',
    Component: RootLayout,
    errorElement: <RouteError />,
    loader: createProtectedLoader({ allowAuthenticated: true }),
    children: [
      // Start page - entry point for all users
      // Redirects authenticated users to their dashboard
      {
        index: true,
        Component: StartPage,
        loader: startPageLoader,
      },
      {
        path: 'concepts',
        element: (
          <StudentRoute>
            <ConceptLibraryPage />
          </StudentRoute>
        ),
        loader: createProtectedLoader({ requiredRole: 'student' }),
      },
      {
        path: 'concepts/*',
        element: (
          <StudentRoute>
            <ConceptDetailPage />
          </StudentRoute>
        ),
        loader: createProtectedLoader({ requiredRole: 'student' }),
      },
      {
        path: 'practice',
        element: (
          <StudentRoute>
            <LearningInterface />
          </StudentRoute>
        ),
        loader: createProtectedLoader({ requiredRole: 'student' }),
      },
      {
        path: 'textbook',
        element: (
          <AuthenticatedRoute>
            <TextbookPage />
          </AuthenticatedRoute>
        ),
        loader: createProtectedLoader({ allowAuthenticated: true }),
      },
      {
        path: 'research',
        element: (
          <InstructorRoute>
            <ResearchPage />
          </InstructorRoute>
        ),
        loader: createProtectedLoader({ requiredRole: 'instructor' }),
      },
      // Instructor dashboard
      {
        path: 'instructor-dashboard',
        element: (
          <InstructorRoute>
            <InstructorDashboard />
          </InstructorRoute>
        ),
        loader: createProtectedLoader({ requiredRole: 'instructor' }),
      },
      // Settings - accessible to both students and instructors
      {
        path: 'settings',
        element: (
          <AuthenticatedRoute>
            <SettingsPage />
          </AuthenticatedRoute>
        ),
        loader: createProtectedLoader({ allowAuthenticated: true }),
      },
      // Catch-all redirect
      {
        path: '*',
        element: <Navigate to={ROUTES.HOME} replace />,
      },
    ],
  },
]);

// Re-export guard utilities for use in components
export { ProtectedRoute, StudentRoute, InstructorRoute, AuthenticatedRoute };
export { ROUTES, protectRoute, getDefaultRouteForRole } from './lib/auth-guard';
