import * as React from 'react';
import { createBrowserRouter, Navigate, useLocation } from 'react-router';

import { RouteError } from './components/layout/RouteError';
import { RootLayout } from './pages/RootLayout';
import { TextbookPage } from './pages/TextbookPage';
import { AuthPage } from './pages/AuthPage';
import { ResearchPage } from './pages/ResearchPage';
import { ProjectsPage } from './pages/ProjectsPage';
import { InstructorDashboard } from './pages/InstructorDashboard';
import { StartPage } from './pages/StartPage';
import { LearningInterface } from './pages/LearningInterface';
import { SettingsPage } from './pages/SettingsPage';
import { ConceptLibraryPage } from './pages/ConceptLibraryPage';
import { ConceptDetailPage } from './pages/ConceptDetailPage';
import { storage } from './lib/storage';
import { useAuth } from './lib/auth-context';
import { AUTH_BACKEND_CONFIGURED } from './lib/api/auth-client';
import { createProtectedLoader } from './lib/auth-route-loader';
import {
  ROUTES,
  getDefaultRouteForRole,
  isPreviewModeActive,
  canAccessRoute
} from './lib/auth-guard';
import { useToast } from './components/ui/toast';

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
 * Component wrapper that enforces role-based access
 * Redirects if not authorized with toast notification
 * Note: Loader should handle redirects, this is a fallback
 * Preview mode allows instructors to access student routes
 */
function ProtectedRoute({
  children,
  requiredRole
}: {
  children: React.ReactNode;
  requiredRole?: 'student' | 'instructor';
}) {
  const location = useLocation();
  const { addToast } = useToast();
  const { user, isLoading } = useAuth();

  // Track if we've shown a redirect toast to avoid double-toasts
  const [hasShownRedirectToast, setHasShownRedirectToast] = React.useState(false);

  if (AUTH_BACKEND_CONFIGURED) {
    if (isLoading) {
      return null;
    }
    if (!user) {
      if (!hasShownRedirectToast) {
        setHasShownRedirectToast(true);
        addToast({
          type: 'info',
          title: 'Authentication Required',
          message: 'Please sign in to access this page',
        });
      }
      return <Navigate to={ROUTES.HOME} replace />;
    }
    if (requiredRole === 'student' && user.role === 'instructor' && isPreviewModeActive()) {
      return <>{children}</>;
    }
    if (requiredRole && user.role !== requiredRole) {
      if (!hasShownRedirectToast) {
        setHasShownRedirectToast(true);
        const roleLabel = requiredRole === 'student' ? 'student' : 'instructor';
        addToast({
          type: 'info',
          title: 'Access Restricted',
          message: `This area requires ${roleLabel} access. Redirecting to your dashboard.`,
        });
      }
      return <Navigate to={getDefaultRouteForRole(user.role)} replace />;
    }
    return <>{children}</>;
  }

  const profile = storage.getUserProfile();

  // Not authenticated - redirect to home (start page)
  if (!profile) {
    if (!hasShownRedirectToast) {
      setHasShownRedirectToast(true);
      addToast({
        type: 'info',
        title: 'Authentication Required',
        message: 'Please sign in to access this page',
      });
    }
    return <Navigate to={ROUTES.HOME} replace />;
  }

  // Preview mode: instructors can access student routes
  if (requiredRole === 'student' && profile.role === 'instructor' && isPreviewModeActive()) {
    return <>{children}</>; // Allow access
  }

  // Role check with toast notification
  if (requiredRole && profile.role !== requiredRole) {
    if (!hasShownRedirectToast) {
      setHasShownRedirectToast(true);
      const roleLabel = requiredRole === 'student' ? 'student' : 'instructor';
      addToast({
        type: 'info',
        title: 'Access Restricted',
        message: `This area requires ${roleLabel} access. Redirecting to your dashboard.`,
      });
    }
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
  // Public routes — no layout wrapper, no auth required
  {
    path: 'projects',
    Component: ProjectsPage,
    errorElement: <RouteError />,
  },
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
        loader: createProtectedLoader(),
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
      // Auth routes (login / signup) — outside the protected area
      {
        path: 'login',
        Component: AuthPage,
      },
      {
        path: 'signup',
        element: <AuthPage />,
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
