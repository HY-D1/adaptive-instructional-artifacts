/* @vitest-environment node */

import { describe, expect, it, vi } from 'vitest';

import { NEON_REQUIRED_TABLES } from '../../../apps/server/src/db/schema-contract';

interface ProvisioningScenario {
  actualBranchId?: string;
  schemaCreate?: boolean;
  alterReady?: boolean;
  unrelatedAlterReady?: boolean;
  existingRequiredTables?: string[];
}

function createProvisioningQuery({
  actualBranchId = 'br-preview',
  schemaCreate = true,
  alterReady = true,
  unrelatedAlterReady = true,
  existingRequiredTables = [...NEON_REQUIRED_TABLES],
}: ProvisioningScenario = {}) {
  const events: string[] = [];
  const query = async (strings: TemplateStringsArray) => {
    const text = strings.join('$parameter$').replace(/\s+/g, ' ').trim();
    events.push(`query:${text}`);
    if (text.includes("current_setting('neon.branch_id', true)")) {
      return [{ branch_id: actualBranchId }];
    }
    if (text.includes("has_schema_privilege(current_user, 'public', 'CREATE')")) {
      return [{
        schema_create: schemaCreate,
        database_create: true,
        // Compatibility with the pre-fix aggregate query, which incorrectly
        // lets unrelated public-table ownership affect provisioning.
        alter_ready: alterReady && unrelatedAlterReady,
      }];
    }
    if (text.includes('pg_has_role')) {
      return [
        ...existingRequiredTables.map((tableName) => ({
          table_name: tableName,
          alter_ready: alterReady,
        })),
        { table_name: 'unrelated_extension_table', alter_ready: unrelatedAlterReady },
      ];
    }
    if (text.includes('has_table_privilege')) {
      return NEON_REQUIRED_TABLES.map((tableName) => ({
        table_name: tableName,
        schema_usage: true,
        can_select: true,
        can_insert: true,
        can_update: true,
        can_delete: true,
      }));
    }
    if (text.includes('has_sequence_privilege')) {
      return [{ sequence_privileges_ready: true }];
    }
    if (text.includes('pg_catalog.pg_class')) {
      return NEON_REQUIRED_TABLES.map((tableName) => ({ table_name: tableName }));
    }
    if (text.includes('information_schema.tables')) {
      return NEON_REQUIRED_TABLES.map((tableName) => ({ table_name: tableName }));
    }
    throw new Error(`Unexpected provisioning query: ${text}`);
  };
  return { query, events };
}

async function getProvisionFunction(): Promise<Function | undefined> {
  const module = await import('../../../apps/server/src/db/readiness');
  return (module as Record<string, unknown>).provisionNeonSchema as Function | undefined;
}

describe('guarded Neon preview provisioning', () => {
  it('requires an expected branch and blocks a mismatch before DDL or DML', async () => {
    const provision = await getProvisionFunction();
    const absent = createProvisioningQuery();
    const mismatch = createProvisioningQuery({ actualBranchId: 'br-production' });
    const initializeSchema = vi.fn();

    const absentAttempt = provision
      ? provision({ query: absent.query, initializeSchema, env: {} })
      : Promise.resolve(undefined);
    await expect(absentAttempt).rejects.toThrow(/EXPECTED_NEON_BRANCH_ID/);
    expect(absent.events).toHaveLength(0);

    const mismatchAttempt = provision
      ? provision({
          query: mismatch.query,
          initializeSchema,
          env: { EXPECTED_NEON_BRANCH_ID: 'br-preview' },
        })
      : Promise.resolve(undefined);
    await expect(mismatchAttempt).rejects.toThrow(/branch mismatch/i);
    expect(mismatch.events).toHaveLength(1);
    expect(mismatch.events[0]).toContain("current_setting('neon.branch_id', true)");
    expect(initializeSchema).not.toHaveBeenCalled();
  });

  it('checks DDL privileges read-only before running the idempotent initializer', async () => {
    const provision = await getProvisionFunction();
    const { query, events } = createProvisioningQuery();
    const initializeSchema = vi.fn(async () => {
      events.push('initialize-schema');
    });

    const result = provision
      ? await provision({
          query,
          initializeSchema,
          env: { EXPECTED_NEON_BRANCH_ID: 'br-preview' },
        })
      : undefined;

    expect(events[0]).toContain("current_setting('neon.branch_id', true)");
    expect(events[1]).toContain("has_schema_privilege(current_user, 'public', 'CREATE')");
    expect(events[2]).toContain('pg_has_role');
    expect(events[3]).toBe('initialize-schema');
    expect(initializeSchema).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({ state: 'ready', researchReady: true });
  });

  it('blocks insufficient DDL privileges before initialization', async () => {
    const provision = await getProvisionFunction();
    const { query, events } = createProvisioningQuery({ schemaCreate: false });
    const initializeSchema = vi.fn();

    const attempt = provision
      ? provision({
          query,
          initializeSchema,
          env: { EXPECTED_NEON_BRANCH_ID: 'br-preview' },
        })
      : Promise.resolve(undefined);

    await expect(attempt).rejects.toThrow(/privileges/i);
    expect(events).toHaveLength(2);
    expect(initializeSchema).not.toHaveBeenCalled();
  });

  it('ignores unrelated ownership while requiring ALTER capability only for existing manifest tables', async () => {
    const provision = await getProvisionFunction();
    const populated = createProvisioningQuery({ unrelatedAlterReady: false });
    const fresh = createProvisioningQuery({
      unrelatedAlterReady: false,
      existingRequiredTables: [],
    });
    const populatedInitializer = vi.fn(async () => {
      populated.events.push('initialize-schema');
    });
    const freshInitializer = vi.fn(async () => {
      fresh.events.push('initialize-schema');
    });

    const populatedResult = provision
      ? await provision({
          query: populated.query,
          initializeSchema: populatedInitializer,
          env: { EXPECTED_NEON_BRANCH_ID: 'br-preview' },
        })
      : undefined;
    const freshResult = provision
      ? await provision({
          query: fresh.query,
          initializeSchema: freshInitializer,
          env: { EXPECTED_NEON_BRANCH_ID: 'br-preview' },
        })
      : undefined;

    expect(populatedResult).toMatchObject({ state: 'ready' });
    expect(freshResult).toMatchObject({ state: 'ready' });
    expect(populatedInitializer).toHaveBeenCalledOnce();
    expect(freshInitializer).toHaveBeenCalledOnce();
    expect(populated.events[2]).toContain('pg_has_role');
    expect(populated.events[2]).toContain('tables.relname = ANY');
    expect(fresh.events[2]).toContain('pg_has_role');
  });
});
