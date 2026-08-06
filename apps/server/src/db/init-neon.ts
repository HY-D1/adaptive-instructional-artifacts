/**
 * Guarded Neon schema provisioning command.
 * Run with: npm run db:init:neon (or npm run db:migrate)
 */

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

async function main(): Promise<void> {
  console.log('🔄 Guarded Neon schema provisioning starting...');

  const { resolveDbEnv, DB_ENV_PRIORITY } = await import('./env-resolver.js');
  const { url: databaseUrl, source } = resolveDbEnv();
  if (!databaseUrl) {
    throw new Error(`No database URL found. Checked: ${DB_ENV_PRIORITY.join(', ')}`);
  }

  // Log only the variable name, never the credential-bearing URL.
  console.log(`📌 Database configuration source: ${source}`);

  const { getDb, initializeSchema } = await import('./neon.js');
  const { provisionNeonSchema } = await import('./readiness.js');
  const readiness = await provisionNeonSchema({
    query: getDb() as unknown as import('./readiness.js').ReadinessQuery,
    initializeSchema,
  });

  console.log(
    `✅ Neon schema provisioning complete (${readiness.requiredTableCount} required tables, state ${readiness.state})`,
  );
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`❌ Neon schema provisioning failed: ${message}`);
  process.exitCode = 1;
});
