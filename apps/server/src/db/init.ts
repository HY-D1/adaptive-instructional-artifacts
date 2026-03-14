/**
 * Database Initialization Script
 * Run with: npm run db:init
 */

import { initializeSchema, getDb, closeDb } from './index.js';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(__dirname, '../../data');

function ensureDataDirectory(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    console.log(`📁 Created data directory: ${DATA_DIR}`);
  }
}

async function main(): Promise<void> {
  console.log('🔄 Initializing SQL-Adapt database...\n');

  try {
    ensureDataDirectory();
    await initializeSchema();
    
    const db = getDb();
    const dbPath = DB_PATH;
    
    console.log('\n✅ Database initialization complete!');
    console.log(`📂 Database location: ${dbPath}`);
    
    // Verify tables
    const tables = await new Promise<{ name: string }[]>((resolve, reject) => {
      db.all(
        "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name",
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows as { name: string }[]);
        }
      );
    });
    
    console.log('\n📋 Created tables:');
    for (const table of tables) {
      console.log(`   - ${table.name}`);
    }

    await closeDb();
    process.exit(0);
  } catch (error) {
    console.error('❌ Database initialization failed:', error);
    await closeDb();
    process.exit(1);
  }
}

// Get DB_PATH from the module
const DB_PATH = process.env.DATABASE_PATH || path.join(DATA_DIR, 'sql-adapt.db');

main();
