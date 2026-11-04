/**
 * Load apps/server/.env and .env.local before any other module reads
 * process.env. ESM evaluates imports before the importing module's body, so
 * this must be the FIRST import of every entrypoint (app.ts, index.ts).
 * On Vercel the files are absent and the platform env is used unchanged.
 */
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const serverRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// Test hook: point at a different directory holding .env files.
const envDir = process.env.SQL_ADAPT_SERVER_ENV_DIR || serverRoot;

dotenv.config({ path: path.join(envDir, '.env') });
dotenv.config({ path: path.join(envDir, '.env.local') });
