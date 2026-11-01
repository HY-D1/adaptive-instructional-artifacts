import { createHash } from 'node:crypto';
import type { NeonQueryFunction } from '@neondatabase/serverless';

/** A shared, atomic fixed-window counter. Database errors must propagate. */
export async function consumeSignupLimit(
  db: NeonQueryFunction<false, false>,
  scope: string,
  parts: string[],
  limit: number,
): Promise<boolean> {
  const key = createHash('sha256').update(JSON.stringify([scope, ...parts])).digest('hex');
  const rows = await db`
    INSERT INTO signup_rate_limits (key_hash, attempts, expires_at)
    VALUES (${key}, 1, NOW() + INTERVAL '15 minutes')
    ON CONFLICT (key_hash) DO UPDATE SET
      attempts = CASE WHEN signup_rate_limits.expires_at <= NOW() THEN 1
                      ELSE signup_rate_limits.attempts + 1 END,
      expires_at = CASE WHEN signup_rate_limits.expires_at <= NOW() THEN NOW() + INTERVAL '15 minutes'
                        ELSE signup_rate_limits.expires_at END
    RETURNING attempts
  `;
  return Number(rows[0].attempts) <= limit;
}
