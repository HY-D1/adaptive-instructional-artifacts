import { createHash, timingSafeEqual } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

/** Reject API traffic during a controlled cutover; authentication still runs after bypass. */
export function maintenanceGuard(req: Request, res: Response, next: NextFunction): void {
  if (process.env.MAINTENANCE_MODE !== 'true' || req.method === 'OPTIONS' ||
      !/^\/api(?:\/|$)/i.test(req.path)) {
    next();
    return;
  }

  if ((req.method === 'GET' || req.method === 'HEAD') &&
      /^\/api\/system\/persistence-status\/?$/i.test(req.path)) {
    next();
    return;
  }

  const configuredKey = process.env.MAINTENANCE_BYPASS_KEY;
  const suppliedKey = req.get('x-maintenance-key');
  if (configuredKey && configuredKey.trim() && suppliedKey) {
    const expected = createHash('sha256').update(configuredKey).digest();
    const actual = createHash('sha256').update(suppliedKey).digest();
    if (timingSafeEqual(expected, actual)) {
      next();
      return;
    }
  }

  res.set('Retry-After', '60');
  res.status(503).json({ success: false, error: 'Service temporarily unavailable for maintenance' });
}
