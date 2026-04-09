/**
 * Rate limiting middleware for API scalability
 * Supports 100+ concurrent users with tiered rate limits
 */

import { rateLimit } from 'express-rate-limit';
import { Request, Response } from 'express';

/**
 * General API rate limiter
 * 100 requests per 15 minutes per IP
 */
export const generalApiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 100, // 100 requests per window
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  message: {
    success: false,
    error: 'Too many requests',
    message: 'Rate limit exceeded. Please try again later.',
    retryAfter: '15 minutes',
  },
  skip: (req: Request) => {
    // Skip health check and system endpoints
    if (req.path === '/health' || req.path === '/') {
      return true;
    }
    return false;
  },
  keyGenerator: (req: Request) => {
    return req.ip ?? 'unknown';
  },
});

/**
 * Login endpoint rate limiter
 * 10 requests per 15 minutes per email+IP combination
 * Keyed by email + IP to prevent shared IP blocking different users
 */
export const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 10, // 10 login attempts per window per email+IP
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Too many login attempts',
    message: 'Too many login attempts. Please try again later.',
    retryAfter: '15 minutes',
  },
  keyGenerator: (req: Request) => {
    const email = (req.body?.email as string)?.toLowerCase()?.trim() ?? 'unknown';
    const ip = req.ip ?? 'unknown';
    return `login:${email}:${ip}`;
  },
  handler: (_req: Request, res: Response) => {
    res.status(429).json({
      success: false,
      error: 'Too many login attempts',
      message: 'Too many login attempts. Please try again later.',
      retryAfter: '15 minutes',
    });
  },
});

/**
 * Signup endpoint rate limiter
 * 5 requests per 15 minutes per IP
 * Keyed by IP only (new users don't have email yet)
 */
export const signupRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 5, // 5 signup attempts per window per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Too many signup attempts',
    message: 'Too many signup attempts. Please try again later.',
    retryAfter: '15 minutes',
  },
  keyGenerator: (req: Request) => {
    return `signup:${req.ip ?? 'unknown'}`;
  },
  handler: (_req: Request, res: Response) => {
    res.status(429).json({
      success: false,
      error: 'Too many signup attempts',
      message: 'Too many signup attempts. Please try again later.',
      retryAfter: '15 minutes',
    });
  },
});

/**
 * Stricter rate limiter for sensitive operations
 * 10 requests per 15 minutes per IP
 */
export const strictRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 10, // 10 requests per window
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Too many requests',
    message: 'Rate limit exceeded for this operation. Please try again later.',
    retryAfter: '15 minutes',
  },
  keyGenerator: (req: Request) => {
    return req.ip ?? 'unknown';
  },
});

/**
 * Legacy export for backward compatibility during transition
 * @deprecated Use loginRateLimiter or signupRateLimiter instead
 */
export const authRateLimiter = loginRateLimiter;
