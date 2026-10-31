import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { neon } from '@neondatabase/serverless';
import { classifySurveyLinkage } from './survey-linkage-classifier.mjs';

const require = createRequire(import.meta.url);
const dotenv = require('../../apps/server/node_modules/dotenv');
dotenv.config({ path: '../../apps/server/.env.local' });

const exportPath = process.argv[2];
const databaseUrl = process.env.SURVEY_LINKAGE_DATABASE_URL;
if (!exportPath || !databaseUrl) {
  console.error('Usage: SURVEY_LINKAGE_DATABASE_URL=<read-only-url> node scripts/verification/check-survey-linkage.mjs <qualtrics-export.json>');
  process.exitCode = 2;
}

if (exportPath && databaseUrl) {
  const raw = JSON.parse(await readFile(exportPath, 'utf8'));
  const responses = Array.isArray(raw) ? raw : raw.responses;
  if (!Array.isArray(responses)) throw new Error('Expected a JSON array or an object with a responses array');

  const sql = neon(databaseUrl);
  await sql.query('BEGIN READ ONLY');
  try {
    const invitations = await sql`
      SELECT instance, username, qualtrics_response_id
      FROM survey_invitations
      WHERE status = 'completed'
    `;
    console.log(JSON.stringify(classifySurveyLinkage(invitations, responses)));
  } finally {
    await sql.query('ROLLBACK');
  }
}