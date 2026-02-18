/**
 * Route guards for role-based access control
 * Week 4: Authentication and authorization utilities
 */

import { storage } from './storage';
import type { UserRole } from '../types';

// Route paths
export const ROUTES = {
  HOME: '/',
  TEXTBOOK: '/textbook',
  RESEARCH: '/research',
  LOGIN: '/login',
  STUDENT_DASHBOARD: '/',
  INSTRUCTOR_DASHBOARD: '/research',
} as const;

// Role-based route access configuration
const ROLE_ROUTES: Record<UserRole, string[]> = {
  student: ['/', '/textbook'],
  instructor: ['/', '/textbook', '/research'],
};

/**
 * Check if a route is accessible by a given role
 */
export function canAccessRoute(role: UserRole | null | undefined, path: string): boolean {
  if (!role) {
    return false;
  }
  const allowedRoutes = ROLE_ROUTES[role];
  return allowedRoutes.some(route => path === route || path.startsWith(`${route}/`));
}

/**
 * Get the default redirect path for a role
 */
export function getDefaultRouteForRole(role: UserRole | null | undefined): string {
  if (role === 'instructor') {
    return ROUTES.INSTRUCTOR_DASHBOARD;
  }
  return ROUTES.STUDENT_DASHBOARD;
}

/**
 * Require a specific role - returns redirect path if unauthorized
 * @returns null if authorized, redirect path if unauthorized
 */
export function requireRole(role: UserRole): string | null {
  const profile = storage.getUserProfile();
  
  if (!profile) {
    // Redirect to home (start page) since there's no dedicated login page
    return ROUTES.HOME;
  }
  
  if (profile.role !== role) {
    // Redirect to appropriate page based on actual role
    return getDefaultRouteForRole(profile.role);
  }
  
  return null;
}

/**
 * Check if user is authenticated
 */
export function isAuthenticated(): boolean {
  return storage.getUserProfile() !== null;
}

/**
 * Redirect if authenticated - for login page
 * @returns redirect path if authenticated, null if not
 */
export function redirectIfAuthenticated(): string | null {
  const profile = storage.getUserProfile();
  
  if (profile) {
    return getDefaultRouteForRole(profile.role);
  }
  
  return null;
}

/**
 * Get current user profile with role checks
 */
export function getCurrentUser() {
  const profile = storage.getUserProfile();
  
  if (!profile) {
    return null;
  }
  
  return {
    ...profile,
    isStudent: profile.role === 'student',
    isInstructor: profile.role === 'instructor',
  };
}

/**
 * Guard result type for React Router integration
 */
export interface GuardResult {
  allowed: boolean;
  redirect?: string;
}

/**
 * Combined guard for protected routes
 * Checks authentication and role authorization
 */
export function protectRoute(options: { 
  requiredRole?: UserRole;
  allowAuthenticated?: boolean;
} = {}): GuardResult {
  const profile = storage.getUserProfile();
  
  // Not authenticated - redirect to home (start page)
  if (!profile) {
    return { allowed: false, redirect: ROUTES.HOME };
  }
  
  // Specific role required
  if (options.requiredRole && profile.role !== options.requiredRole) {
    return { allowed: false, redirect: getDefaultRouteForRole(profile.role) };
  }
  
  // Authenticated access allowed
  if (options.allowAuthenticated) {
    return { allowed: true };
  }
  
  return { allowed: true };
}

/**
 * Hook-compatible guard that can be used in useEffect
 * Returns true if access is allowed, false otherwise
 * Side effect: redirects if not allowed
 */
export function checkRouteAccess(
  path: string,
  navigate: (path: string) => void
): boolean {
  const profile = storage.getUserProfile();
  
  // No profile - redirect to home (start page)
  if (!profile) {
    navigate(ROUTES.HOME);
    return false;
  }
  
  // Check role-based access
  if (!canAccessRoute(profile.role, path)) {
    navigate(getDefaultRouteForRole(profile.role));
    return false;
  }
  
  return true;
}

/**
 * Navigation guard for React Router loader functions
 * Returns a Response for redirects, null for allowed access
 */
export function loaderGuard(
  request: Request,
  options?: { requiredRole?: UserRole }
): Response | null {
  const profile = storage.getUserProfile();
  
  // Not authenticated - redirect to home (start page)
  if (!profile) {
    return new Response(null, {
      status: 302,
      headers: { Location: ROUTES.HOME },
    });
  }
  
  // Role check
  if (options?.requiredRole && profile.role !== options.requiredRole) {
    return new Response(null, {
      status: 302,
      headers: { Location: getDefaultRouteForRole(profile.role) },
    });
  }
  
  return null;
}
