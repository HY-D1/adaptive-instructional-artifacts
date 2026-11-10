/**
 * Route guards for role-based access control
 * Week 4: Authentication and authorization utilities
 */

import { storage } from './storage';
import { PREVIEW_MODE_KEY } from './storage/storage-validation';
import type { UserRole } from '../types';

// Route paths
export const ROUTES = {
  HOME: '/',
  TEXTBOOK: '/textbook',
  RESEARCH: '/research',
  LOGIN: '/login',
  STUDENT_DASHBOARD: '/',
  INSTRUCTOR_DASHBOARD: '/instructor-dashboard',
} as const;

// Role-based route access configuration
const ROLE_ROUTES: Record<UserRole, string[]> = {
  student: ['/', '/textbook', '/concepts', '/practice'],
  instructor: ['/', '/textbook', '/research', '/instructor-dashboard'],
};

/**
 * Check if preview mode is active
 * Preview mode allows instructors to access student routes
 */
export function isPreviewModeActive(): boolean {
  if (typeof window === 'undefined') {
    return false; // SSR safety
  }
  try {
    return localStorage.getItem(PREVIEW_MODE_KEY) === 'true';
  } catch {
    return false;
  }
}

/**
 * Check if a route is accessible by a given role
 * Preview mode allows instructors to access student routes
 */
export function canAccessRoute(role: UserRole | null | undefined, path: string): boolean {
  if (!role) {
    return false;
  }
  
  // Preview mode: instructors can access student routes
  if (role === 'instructor' && isPreviewModeActive()) {
    // Allow access to all student routes during preview
    const studentRoutes = ROLE_ROUTES['student'];
    const isStudentRoute = studentRoutes.some(route => path === route || path.startsWith(`${route}/`));
    if (isStudentRoute) {
      return true;
    }
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
 * Check if user is authenticated
 */
export function isAuthenticated(): boolean {
  return storage.getUserProfile() !== null;
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
 * Preview mode allows instructors to access student routes
 */
export function protectRoute(options: { 
  requiredRole?: UserRole;
  allowAuthenticated?: boolean;
} = {}): GuardResult {
  const profile = storage.getUserProfile();
  
  // If allowAuthenticated is set, allow access regardless of auth status
  // This is used for public routes like the start page
  if (options.allowAuthenticated) {
    return { allowed: true };
  }
  
  // Not authenticated - redirect to home (start page)
  if (!profile) {
    return { allowed: false, redirect: ROUTES.HOME };
  }
  
  // Preview mode: instructors can access student routes
  if (options.requiredRole === 'student' && profile.role === 'instructor' && isPreviewModeActive()) {
    return { allowed: true };
  }
  
  // Specific role required
  if (options.requiredRole && profile.role !== options.requiredRole) {
    return { allowed: false, redirect: getDefaultRouteForRole(profile.role) };
  }
  
  return { allowed: true };
}
