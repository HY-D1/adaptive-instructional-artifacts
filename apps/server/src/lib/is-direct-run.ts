import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * True when the module whose `import.meta.url` is given is the process entry
 * point (`process.argv[1]`). Compares filesystem paths rather than URL strings,
 * so paths containing spaces or other percent-encoded characters still match.
 * Same rule as the entry guard in db/migrate.ts.
 */
export function isDirectRun(importMetaUrl: string, argv1: string | undefined): boolean {
  if (!argv1) return false;
  return path.resolve(argv1) === fileURLToPath(importMetaUrl);
}
