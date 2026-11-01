/* @vitest-environment node */
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const directory = resolve('apps/server/src/db/migrations');
describe('production migration manifest', () => {
  it('lists only the explicitly reviewed production migrations', () => {
    const entries = readFileSync(resolve(directory, 'production-manifest.txt'), 'utf8')
      .split('\n').map(line => line.trim()).filter(line => line && !line.startsWith('#'));
    expect(entries).toEqual(['20261031-interaction-event-fields.sql', '20261031-signup-rate-limits.sql', '20261031-problem-progress-events.sql', '20261101-learner-profile-events.sql']);
    expect(entries.every(entry => existsSync(resolve(directory, entry)))).toBe(true);
  });

  it('removes only the recorded pilot default in the rehearsal follow-up', () => {
    const sql = readFileSync(resolve(directory, '20261101-remove-pilot-username-default.sql'), 'utf8');
    expect(sql).toContain("column_default = '(gen_random_uuid())::text'");
    expect(sql).toMatch(/ALTER TABLE public\.users ALTER COLUMN username DROP DEFAULT/i);
    expect(sql).not.toMatch(/\b(?:DROP\s+NOT\s+NULL|UPDATE|DELETE|TRUNCATE)\b/i);
  });
});
