import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { neon } from '@neondatabase/serverless';
import { classifySurveyLinkage, listVerifiedInvitations } from './survey-linkage-classifier.mjs';

const require = createRequire(import.meta.url);
const dotenv = require('../../apps/server/node_modules/dotenv');
dotenv.config({ path: '../../apps/server/.env.local' });

const args = process.argv.slice(2);
const applyVerification = args.includes('--apply-verification');
const exportPath = args.find((arg) => !arg.startsWith('--'));
const databaseUrl = process.env.SURVEY_LINKAGE_DATABASE_URL;
if (!exportPath || !databaseUrl) {
  console.error('Usage: SURVEY_LINKAGE_DATABASE_URL=<url> node scripts/verification/check-survey-linkage.mjs <qualtrics-export.json> [--apply-verification]');
  console.error('Default is read-only. --apply-verification marks exactly-matching completions as verified.');
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

  if (applyVerification) {
    // Opt-in write: only flips verification_status; never edits usernames or IDs.
    const invitations = await sql`
      SELECT instance, username, qualtrics_response_id
      FROM survey_invitations
      WHERE status = 'completed' AND verification_status = 'unverified'
    `;
    const verified = listVerifiedInvitations(invitations, responses);
    if (verified.length > 0) {
      await sql.transaction(verified.map((invitation) => sql`
        UPDATE survey_invitations SET verification_status = 'verified'
        WHERE username = ${invitation.username}
          AND instance = ${invitation.instance}
          AND qualtrics_response_id = ${invitation.qualtrics_response_id}
      `));
    }
    console.log(JSON.stringify({ appliedVerification: verified.length }));
  }
}