/* @vitest-environment node */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('legacy username compatibility migration', () => {
  const sql = readFileSync(resolve('apps/server/src/db/migrations/20261031-legacy-username-default.sql'), 'utf8');

  it('guards the default for the observed legacy column only', () => {
    expect(sql).toMatch(/table_schema\s*=\s*'public'/i);
    expect(sql).toMatch(/table_name\s*=\s*'users'/i);
    expect(sql).toMatch(/column_name\s*=\s*'username'/i);
    expect(sql).toMatch(/data_type\s*=\s*'text'/i);
    expect(sql).toMatch(/is_nullable\s*=\s*'NO'/i);
    expect(sql).toMatch(/column_default\s+IS\s+NULL/i);
    expect(sql).toMatch(/is_generated\s*=\s*'NEVER'/i);
    expect(sql).toMatch(/identity_generation\s+IS\s+NULL/i);
    expect(sql).toMatch(/SET\s+DEFAULT\s+pg_catalog\.gen_random_uuid\(\)::text/i);
  });

  it('does not add a column, mutate rows, or relax a constraint', () => {
    expect(sql).not.toMatch(/\b(?:ADD\s+COLUMN|DROP\s+NOT\s+NULL|UPDATE|DELETE|TRUNCATE)\b/i);
  });
});
