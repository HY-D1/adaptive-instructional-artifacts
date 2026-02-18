import { createBrowserRouter, Navigate, type LoaderFunction } from 'react-router';
import { RootLayout } from './pages/RootLayout';
import { TextbookPage } from './pages/TextbookPage';
import { ResearchPage } from './pages/ResearchPage';
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
 */
function createProtectedLoader(options?: { 
  requiredRole?: 'student' | 'instructor';
  allowAuthenticated?: boolean;
}): LoaderFunction {
  return (): GuardResult | null => {
    const result = protectRoute(options);
    
    if (!result.allowed) {
      // Return guard result for the component to handle
      return result;
    }
    
    return null;
  };
}

/**
 * Component wrapper that enforces role-based access
 * Redirects if not authorized
 */
function ProtectedRoute({ 
  children, 
  requiredRole 
}: { 
  children: React.ReactNode; 
  requiredRole?: 'student' | 'instructor';
}) {
  const profile = storage.getUserProfile();
  
  // Not authenticated - redirect to login (start page)
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
  // Start page - entry point for all users
  {
    path: '/',
    Component: StartPage,
  },
  // Main app routes - nested under RootLayout with navigation
  {
    path: '/',
    Component: RootLayout,
    loader: createProtectedLoader({ allowAuthenticated: true }),
    children: [
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
            <ResearchPage />
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
