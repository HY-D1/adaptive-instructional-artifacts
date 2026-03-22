/**
 * Neon Database Initialization Script
 * Run with: npm run db:init:neon
 *
 * This script initializes the Neon PostgreSQL database schema.
 * It uses the DATABASE_URL environment variable.
 */

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.resolve(__dirname, '../../.env');
dotenv.config({ path: envPath });

async function main(): Promise<void> {
  console.log('🔄 Initializing Neon PostgreSQL database...\n');

  // Dynamic import after dotenv so env-resolver sees the loaded vars
  const { resolveDbEnv, DB_ENV_PRIORITY } = await import('./env-resolver.js');
  const { url: databaseUrl, source } = resolveDbEnv();

  if (!databaseUrl) {
    console.error('❌ ERROR: No database URL found in environment');
    console.error('');
    console.error('Checked (in priority order):');
    for (const key of DB_ENV_PRIORITY) {
      console.error(`  - ${key}`);
    }
    console.error('');
    console.error('To set up Neon, set one of the above variables, e.g.:');
    console.error('  DATABASE_URL=postgresql://user:password@host.neon.tech/dbname?sslmode=require');
    process.exit(1);
  }

  console.log(`📌 Using database URL from env var: ${source}`);

  // Dynamic import AFTER dotenv is configured
  const { initializeSchema, getDb } = await import('./neon.js');

  try {
    // Test connection
    console.log('🔌 Testing database connection...');
    const db = getDb();
    const result = await db`SELECT NOW() as now`;
    console.log(`✅ Connected to Neon PostgreSQL at ${result[0].now}`);
    console.log('');

    // Initialize schema
    await initializeSchema();

    // Verify tables
    const tables = await db`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name
    `;

    console.log('\n📋 Database tables:');
    for (const table of tables) {
      console.log(`   - ${table.table_name}`);
    }

    console.log('\n✅ Neon database initialization complete!');
    console.log('');
    console.log('Next steps:');
    console.log('1. Set DATABASE_URL in your environment');
    console.log('2. Run the server: npm run dev');
    console.log('3. The app will automatically use Neon for persistence');
    process.exit(0);
  } catch (error) {
    console.error('❌ Database initialization failed:', error);
    console.error('');
    console.error('Troubleshooting:');
    console.error('- Verify your DATABASE_URL is correct');
    console.error('- Ensure the database exists in Neon');
    console.error('- Check that your IP is allowed in Neon connection settings');
    process.exit(1);
  }
}

main();
