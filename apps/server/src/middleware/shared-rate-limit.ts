import type { NextFunction, Request, Response } from 'express';
import { ipKeyGenerator } from 'express-rate-limit';
import { isUsingNeon } from '../db/index.js';
import { getDb } from '../db/neon.js';
import { consumeRateLimit } from '../db/signup-rate-limit.js';

interface SharedRateLimitOptions {
  scope: string;
  limit: number;
  windowMinutes?: number;
  keyParts: (req: Request) => string[];
  label: string;
}

/**
 * Database-backed limiter for routes where per-instance memory limits are not
 * enough (login brute force, LLM cost). Skipped in local SQLite mode; fails
 * closed if the counter store is unavailable.
 */
export function sharedRateLimit(options: SharedRateLimitOptions) {
  const windowMinutes = options.windowMinutes ?? 15;
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (!isUsingNeon()) {
      next();
      return;
    }
    try {
      const allowed = await consumeRateLimit(getDb(), options.scope, options.keyParts(req), options.limit, windowMinutes);
      if (!allowed) {
        res.setHeader('Retry-After', String(windowMinutes * 60));
        res.status(429).json({
          success: false,
          error: `Too many ${options.label} requests`,
          message: `${options.label} rate limit exceeded. Please try again later.`,
          retryAfter: `${windowMinutes} minutes`,
        });
        return;
      }
      next();
    } catch (error) {
      console.error(`[rate-limit/${options.scope}]`, error);
      res.status(503).json({ success: false, error: `${options.label} temporarily unavailable` });
    }
  };
}

export function clientIpKey(req: Request): string {
  return ipKeyGenerator(req.ip ?? 'unknown');
}
