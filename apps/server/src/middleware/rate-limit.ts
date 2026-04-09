/**
 * Rate limiting middleware for API scalability
 * Supports 100+ concurrent users with tiered rate limits
 */

import { rateLimit } from 'express-rate-limit';
import { Request, Response } from 'express';

// Store for tracking successful auth requests to skip counting
const successfulAuthRequests = new Set<string>();

/**
 * Generate a unique key for tracking auth requests
 */
function getAuthRequestKey(req: Request): string {
  return `${req.ip}:${req.method}:${req.path}`;
}

/**
 * Mark an auth request as successful (to be skipped from rate limiting)
 */
export function markAuthSuccess(req: Request): void {
  const key = getAuthRequestKey(req);
  successfulAuthRequests.add(key);
  
  // Clean up after 15 minutes to prevent memory leak
  setTimeout(() => {
    successfulAuthRequests.delete(key);
  }, 15 * 60 * 1000);
}

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
 * Auth endpoints rate limiter
 * 5 requests per 15 minutes per IP (stricter)
 * Skips successful auth requests
 */
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 5, // 5 requests per window
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Too many auth attempts',
    message: 'Too many authentication attempts. Please try again later.',
    retryAfter: '15 minutes',
  },
  skip: (req: Request) => {
    // Skip if this request was previously marked as successful
    const key = getAuthRequestKey(req);
    if (successfulAuthRequests.has(key)) {
      successfulAuthRequests.delete(key); // Clean up after skipping
      return true;
    }
    return false;
  },
  keyGenerator: (req: Request) => {
    return req.ip ?? 'unknown';
  },
  handler: (_req: Request, res: Response) => {
    res.status(429).json({
      success: false,
      error: 'Too many auth attempts',
      message: 'Too many authentication attempts. Please try again later.',
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
