/**
 * Verify Interaction Events Raw Data
 */

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '.env') });

import { getDb } from '../db/neon.js';

async function main() {
  const db = getDb();

  console.log('=== Raw Interaction Events Data ===\n');
  const events = await db`SELECT * FROM interaction_events WHERE user_id = 'user-test-a-1773803546' ORDER BY timestamp`;

  console.log('Found', events.length, 'events\n');

  for (const e of events) {
    console.log('Event ID:', e.id);
    console.log('  Event Type:', e.event_type);
    console.log('  Problem ID:', e.problem_id);
    console.log('  Code:', e.code || '(null)');
    console.log('  Error:', e.error || '(null)');
    console.log('  Successful:', e.successful);
    console.log('  Hint Text:', e.hint_text || '(null)');
    console.log('  Hint Level:', e.hint_level);
    console.log('  User ID:', e.user_id);
    console.log('  Session ID:', e.session_id);
    console.log('  Timestamp:', e.timestamp);
    console.log('');
  }

  console.log('=== Verification Complete ===');
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
