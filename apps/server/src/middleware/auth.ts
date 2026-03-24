/**
 * Auth Middleware
 *
 * JWT-based authentication via httpOnly cookies.
 * Cookie name: sql_adapt_auth
 *
 * requireAuth  - blocks unauthenticated requests (401)
 * optionalAuth - attaches user if cookie present, continues regardless
 * requireOwnership - verifies req.auth.learnerId === route :learnerId (or user is instructor)
 */

import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '../config.js';

// ============================================================================
// Types
// ============================================================================

export interface AuthPayload {
  accountId: string;
  learnerId: string;
  email: string;
  role: 'student' | 'instructor';
  name: string;
}

declare global {
  namespace Express {
    interface Request {
      auth?: AuthPayload;
    }
  }
}

// ============================================================================
// Token helpers
// ============================================================================

export const COOKIE_NAME = 'sql_adapt_auth';
export const COOKIE_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export function signToken(payload: AuthPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '30d' });
}

export function verifyToken(token: string): AuthPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as AuthPayload;
  } catch {
    return null;
  }
}

export function setAuthCookie(res: Response, token: string): void {
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: COOKIE_MAX_AGE_MS,
    path: '/',
  });
}

export function clearAuthCookie(res: Response): void {
  res.clearCookie(COOKIE_NAME, { path: '/' });
}

// ============================================================================
// Middleware
// ============================================================================

/**
 * Attaches req.auth if a valid cookie is present; does NOT fail if missing.
 */
export function optionalAuth(req: Request, _res: Response, next: NextFunction): void {
  const token = req.cookies?.[COOKIE_NAME];
  if (token) {
    const payload = verifyToken(token);
    if (payload) req.auth = payload;
  }
  next();
}

/**
 * Requires a valid auth cookie. Returns 401 if missing or invalid.
 */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const token = req.cookies?.[COOKIE_NAME];
  if (!token) {
    res.status(401).json({ success: false, error: 'Authentication required' });
    return;
  }
  const payload = verifyToken(token);
  if (!payload) {
    res.status(401).json({ success: false, error: 'Invalid or expired session' });
    return;
  }
  req.auth = payload;
  next();
}

/**
 * After requireAuth: verifies that the route :learnerId or :id param belongs
 * to the authenticated user. Instructors may access any learner's data.
 *
 * Usage: router.get('/:learnerId/...', requireAuth, requireOwnership, handler)
 */
export function requireOwnership(req: Request, res: Response, next: NextFunction): void {
  const auth = req.auth;
  if (!auth) {
    res.status(401).json({ success: false, error: 'Authentication required' });
    return;
  }
  // Instructors can access any learner's data
  if (auth.role === 'instructor') {
    next();
    return;
  }
  const paramLearnerId = req.params.learnerId ?? req.params.id ?? req.params.userId;
  if (!paramLearnerId) {
    next(); // no :learnerId param — let route handle it
    return;
  }
  if (paramLearnerId !== auth.learnerId) {
    res.status(403).json({ success: false, error: 'Access denied: not your data' });
    return;
  }
  next();
}
