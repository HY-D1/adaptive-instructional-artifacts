/**
 * Verify Flow A2 Data in Neon
 */

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '.env') });

import { getDb } from './src/db/neon.js';

async function main() {
  const db = getDb();
  const userId = 'user-test-a2-1773803880';

  console.log('=== Flow A2 Neon Database Verification ===\n');
  console.log('User ID:', userId);
  console.log('');

  // 1. Check users table
  console.log('1. USERS table:');
  const users = await db`SELECT id, name, role, created_at FROM users WHERE id = ${userId}`;
  console.log('   Rows:', users.length);
  users.forEach(u => console.log(`   - ${u.id} | ${u.name} | ${u.role}`));
  console.log('');

  // 2. Check learner_sessions table
  console.log('2. LEARNER_SESSIONS table:');
  const sessions = await db`SELECT session_id, condition_id, created_at FROM learner_sessions WHERE user_id = ${userId}`;
  console.log('   Rows:', sessions.length);
  sessions.forEach(s => console.log(`   - Session: ${s.session_id} | Condition: ${s.condition_id}`));
  console.log('');

  // 3. Check interaction_events table - with all relevant fields
  console.log('3. INTERACTION_EVENTS table:');
  const events = await db`
    SELECT id, event_type, problem_id, code, error, successful, hint_text, hint_level, session_id
    FROM interaction_events
    WHERE user_id = ${userId}
    ORDER BY timestamp
  `;
  console.log('   Rows:', events.length);
  events.forEach(e => {
    console.log(`   - ${e.event_type}`);
    console.log(`     ID: ${e.id}`);
    console.log(`     Problem: ${e.problem_id}`);
    console.log(`     Code: ${e.code || '(null)'}`);
    console.log(`     Error: ${e.error || '(null)'}`);
    console.log(`     Successful: ${e.successful}`);
    console.log(`     Hint Text: ${e.hint_text || '(null)'}`);
    console.log(`     Hint Level: ${e.hint_level}`);
    console.log(`     Session: ${e.session_id}`);
    console.log('');
  });

  // 4. Check textbook_units table
  console.log('4. TEXTBOOK_UNITS table:');
  const units = await db`SELECT id, unit_id, type, title, content FROM textbook_units WHERE user_id = ${userId}`;
  console.log('   Rows:', units.length);
  units.forEach(u => {
    console.log(`   - ${u.type}: ${u.title}`);
    console.log(`     Content: ${u.content?.substring(0, 60)}...`);
  });
  console.log('');

  // 5. Summary
  console.log('=== Summary ===');
  console.log(`Users: ${users.length} row(s)`);
  console.log(`Sessions: ${sessions.length} row(s)`);
  console.log(`Interactions: ${events.length} row(s)`);
  console.log(`Textbook Units: ${units.length} row(s)`);

  // Verify expected data
  const hasWrongAttempt = events.some(e => e.event_type === 'code_execution' && e.error !== null);
  const hasHintRequest = events.some(e => e.event_type === 'hint_request' && e.hint_text !== null);
  const hasSolve = events.some(e => e.event_type === 'code_execution' && e.successful === true);
  const hasNote = units.length > 0;

  console.log('');
  console.log('Verification Checks:');
  console.log(`  Wrong attempt stored: ${hasWrongAttempt ? 'YES ✓' : 'NO ✗'}`);
  console.log(`  Hint request stored: ${hasHintRequest ? 'YES ✓' : 'NO ✗'}`);
  console.log(`  Solve stored: ${hasSolve ? 'YES ✓' : 'NO ✗'}`);
  console.log(`  Note saved: ${hasNote ? 'YES ✓' : 'NO ✗'}`);
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
