import { readFileSync } from 'node:fs';
import { neon } from '@neondatabase/serverless';

const text = readFileSync(new URL('../../apps/server/.env.local', import.meta.url), 'utf8');
const match = text.match(/^SCHEMA_TEST_DATABASE_URL=(.*)$/m);
const url = match ? match[1] : '';
const host = url ? new URL(url).hostname : '';
if (!host.includes('ep-royal-meadow')) throw new Error('Refusing shared-bandit reset outside ep-royal-meadow');
const sql = neon(url);
await sql.query('BEGIN');
try {
  await sql`DELETE FROM bandit_reward_events`;
  await sql`
    UPDATE bandit_arm_state
    SET alpha = 1, beta = 1, pull_count = 0,
        experiment_version = 'bandit-shared-v1', updated_at = NOW()
  `;
  await sql.query('COMMIT');
  console.log('Shared bandit reset on the guarded test branch.');
} catch (error) {
  await sql.query('ROLLBACK');
  throw error;
}