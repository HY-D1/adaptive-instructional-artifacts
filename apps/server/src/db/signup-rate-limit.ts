import { createHash } from 'node:crypto';
import type { NeonQueryFunction } from '@neondatabase/serverless';

/** Fraction of calls that also delete long-expired counter rows. */
const CLEANUP_PROBABILITY = 0.01;

/**
 * A shared, atomic fixed-window counter stored in Postgres, so limits hold
 * across serverless instances and cold starts. Database errors must propagate.
 */
export async function consumeRateLimit(
  db: NeonQueryFunction<false, false>,
  scope: string,
  parts: string[],
  limit: number,
  windowMinutes = 15,
  random: () => number = Math.random,
): Promise<boolean> {
  const key = createHash('sha256').update(JSON.stringify([scope, ...parts])).digest('hex');
  const rows = await db`
    INSERT INTO signup_rate_limits (key_hash, attempts, expires_at)
    VALUES (${key}, 1, NOW() + make_interval(mins => ${windowMinutes}))
    ON CONFLICT (key_hash) DO UPDATE SET
      attempts = CASE WHEN signup_rate_limits.expires_at <= NOW() THEN 1
                      ELSE signup_rate_limits.attempts + 1 END,
      expires_at = CASE WHEN signup_rate_limits.expires_at <= NOW()
                        THEN NOW() + make_interval(mins => ${windowMinutes})
                        ELSE signup_rate_limits.expires_at END
    RETURNING attempts
  `;
  if (random() < CLEANUP_PROBABILITY) {
    await db`DELETE FROM signup_rate_limits WHERE expires_at < NOW() - INTERVAL '1 day'`;
  }
  return Number(rows[0].attempts) <= limit;
}

/** Signup counters (15-minute window); kept for existing callers. */
export async function consumeSignupLimit(
  db: NeonQueryFunction<false, false>,
  scope: string,
  parts: string[],
  limit: number,
): Promise<boolean> {
  return consumeRateLimit(db, scope, parts, limit, 15);
}
