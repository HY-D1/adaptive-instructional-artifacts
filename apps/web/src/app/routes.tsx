import { createBrowserRouter, Navigate, redirect, type LoaderFunction } from 'react-router';
import { RootLayout } from './pages/RootLayout';
import { TextbookPage } from './pages/TextbookPage';
import { ResearchPage } from './pages/ResearchPage';
import { InstructorDashboard } from './pages/InstructorDashboard';
import { StartPage } from './pages/StartPage';
import { LearningInterface } from './pages/LearningInterface';
import { storage } from './lib/storage';
import { 
  ROUTES, 
  protectRoute, 
  getDefaultRouteForRole,
  type GuardResult 
} from './lib/auth-guard';

// Week 4: Lazy-loaded login page (create when needed)
// const LoginPage = React.lazy(() => import('./pages/LoginPage'));

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
    loader: createProtectedLoader({ allowAuthenticated: true }),
    children: [
      // Start page - entry point for all users (unauthenticated)
      {
        index: true,
        Component: StartPage,
      },
      {
        // Practice page (index)
        index: true,
        element: (
          <StudentRoute>
            <LearningInterface />
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
