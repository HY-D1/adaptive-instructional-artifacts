/**
 * Verify Neon Database Rows
 */

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '.env') });

import { getDb } from '../db/neon.js';

async function main() {
  const db = getDb();
  const userId = 'user-test-a-1773803546';

  console.log('=== Neon Database Verification for User A ===\n');

  // 1. Check users table
  console.log('1. USERS table:');
  const users = await db`SELECT * FROM users WHERE id = ${userId}`;
  console.log('   Found:', users.length, 'row(s)');
  if (users.length > 0) {
    console.log('   User ID:', users[0].id);
    console.log('   Name:', users[0].name);
    console.log('   Role:', users[0].role);
    console.log('   Created:', users[0].created_at);
  }
  console.log('');

  // 2. Check learner_sessions table
  console.log('2. LEARNER_SESSIONS table:');
  const sessions = await db`SELECT * FROM learner_sessions WHERE user_id = ${userId}`;
  console.log('   Found:', sessions.length, 'row(s)');
  if (sessions.length > 0) {
    console.log('   Session ID:', sessions[0].session_id);
    console.log('   Condition ID:', sessions[0].condition_id);
    console.log('   Created:', sessions[0].created_at);
  }
  console.log('');

  // 3. Check interaction_events table
  console.log('3. INTERACTION_EVENTS table:');
  const events = await db`SELECT id, event_type, problem_id, timestamp, code, error, successful, hint_text, hint_level FROM interaction_events WHERE user_id = ${userId} ORDER BY timestamp`;
  console.log('   Found:', events.length, 'row(s)');
  for (const e of events) {
    console.log(`   - Event Type: ${e.event_type}`);
    console.log(`     Problem ID: ${e.problem_id}`);
    console.log(`     Code: ${e.code?.substring(0, 40) || 'N/A'}`);
    console.log(`     Error: ${e.error?.substring(0, 30) || 'N/A'}`);
    console.log(`     Successful: ${e.successful}`);
    console.log(`     Hint Text: ${e.hint_text?.substring(0, 30) || 'N/A'}`);
    console.log(`     Hint Level: ${e.hint_level}`);
    console.log('');
  }

  // 4. Check textbook_units table
  console.log('4. TEXTBOOK_UNITS table:');
  const units = await db`SELECT id, unit_id, type, title, content, created_at FROM textbook_units WHERE user_id = ${userId}`;
  console.log('   Found:', units.length, 'row(s)');
  for (const u of units) {
    console.log(`   - ID: ${u.id}`);
    console.log(`     Unit ID: ${u.unit_id}`);
    console.log(`     Title: ${u.title}`);
    console.log(`     Type: ${u.type}`);
    console.log(`     Content: ${u.content?.substring(0, 50)}...`);
    console.log(`     Created: ${u.created_at}`);
    console.log('');
  }

  // 5. Check learner_profiles table
  console.log('5. LEARNER_PROFILES table:');
  const profiles = await db`SELECT * FROM learner_profiles WHERE learner_id = ${userId}`;
  console.log('   Found:', profiles.length, 'row(s)');
  if (profiles.length > 0) {
    console.log('   Name:', profiles[0].name);
    console.log('   Interaction count:', profiles[0].interaction_count);
  }
  console.log('');

  console.log('=== Verification Complete ===');
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
