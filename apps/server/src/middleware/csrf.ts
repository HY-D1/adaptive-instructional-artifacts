import type { Request, Response, NextFunction } from 'express';
import crypto from 'node:crypto';

export const CSRF_COOKIE_NAME = 'sql_adapt_csrf';
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export function createCsrfToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

export function setCsrfCookie(res: Response, token: string): void {
  const isProd = process.env.NODE_ENV === 'production';
  res.cookie(CSRF_COOKIE_NAME, token, {
    httpOnly: false,
    secure: isProd,
    sameSite: isProd ? 'none' : 'lax',
    maxAge: 30 * 24 * 60 * 60 * 1000,
    path: '/',
  });
}

export function clearCsrfCookie(res: Response): void {
  const isProd = process.env.NODE_ENV === 'production';
  res.clearCookie(CSRF_COOKIE_NAME, {
    path: '/',
    secure: isProd,
    sameSite: isProd ? 'none' : 'lax',
  });
}

function timingSafeEqual(a: string, b: string): boolean {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) return false;
  return crypto.timingSafeEqual(aBuf, bBuf);
}

export function requireCsrf(req: Request, res: Response, next: NextFunction): void {
  if (SAFE_METHODS.has(req.method)) {
    next();
    return;
  }

  const headerToken = req.get('x-csrf-token');
  const cookieToken = req.cookies?.[CSRF_COOKIE_NAME];

  if (!headerToken || !cookieToken || !timingSafeEqual(headerToken, cookieToken)) {
    res.status(403).json({
      success: false,
      error: 'CSRF validation failed',
    });
    return;
  }

  next();
}
