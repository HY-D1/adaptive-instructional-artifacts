#!/usr/bin/env node
/**
 * Export all Neon database data to JSON files
 * Usage: node scripts/export-database.js
 */

const fs = require('fs');
const path = require('path');

// Tables to export in dependency order
const TABLES = [
  'users',
  'course_sections',
  'section_enrollments',
  'learner_profiles',
  'interaction_events',
  'learner_sessions',
  'problem_progress',
  'textbook_units',
  'textbook_unit_event_links',
  'auth_accounts',
  'auth_events'
];

const EXPORT_DIR = path.join(__dirname, '..', 'database-export');

async function exportTable(tableName) {
  console.log(`Exporting ${tableName}...`);
  
  // This would use your actual DB client
  // For now, showing the structure
  const data = []; // await db.query(`SELECT * FROM ${tableName}`);
  
  const filePath = path.join(EXPORT_DIR, `${tableName}.json`);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  
  console.log(`  ✓ ${data.length} rows saved to ${filePath}`);
  return data.length;
}

async function main() {
  if (!fs.existsSync(EXPORT_DIR)) {
    fs.mkdirSync(EXPORT_DIR, { recursive: true });
  }
  
  console.log('Starting database export...\n');
  
  let totalRows = 0;
  for (const table of TABLES) {
    const count = await exportTable(table);
    totalRows += count;
  }
  
  console.log(`\n✅ Export complete! ${totalRows} total rows exported to ${EXPORT_DIR}/`);
}

main().catch(console.error);
