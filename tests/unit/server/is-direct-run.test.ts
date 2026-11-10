/* @vitest-environment node */
import { pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';
import { isDirectRun } from '../../../apps/server/src/lib/is-direct-run.js';

describe('isDirectRun', () => {
  it('matches a script path that contains spaces', () => {
    const scriptPath = '/Users/me/NEU RA 2026/apps/server/src/scripts/export-research-data.ts';
    const importMetaUrl = pathToFileURL(scriptPath).href;
    expect(importMetaUrl).toContain('%20');
    expect(isDirectRun(importMetaUrl, scriptPath)).toBe(true);
  });

  it('matches a relative argv[1] resolved against the cwd', () => {
    const importMetaUrl = pathToFileURL(`${process.cwd()}/some dir/script.ts`).href;
    expect(isDirectRun(importMetaUrl, 'some dir/script.ts')).toBe(true);
  });

  it('is false when imported from another entry point or argv[1] is missing', () => {
    const importMetaUrl = pathToFileURL('/repo/a b/script.ts').href;
    expect(isDirectRun(importMetaUrl, '/repo/a b/other.ts')).toBe(false);
    expect(isDirectRun(importMetaUrl, undefined)).toBe(false);
  });
});
