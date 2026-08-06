/* @vitest-environment node */

import { describe, expect, it } from 'vitest';

import { NEON_REQUIRED_TABLES } from '../../../apps/server/src/db/schema-contract';

type QueryCall = { text: string; parameters: unknown[] };

interface QueryScenario {
  actualBranchId?: string | null;
  identityError?: Error;
  tableNames?: string[];
  catalogTableNames?: string[];
  denyTable?: string;
  schemaUsage?: boolean;
  sequencePrivileges?: boolean;
  inspectionError?: Error;
}

function createReadinessQuery({
  actualBranchId = 'br-preview',
  identityError,
  tableNames = [...NEON_REQUIRED_TABLES],
  catalogTableNames = tableNames,
  denyTable,
  schemaUsage = true,
  sequencePrivileges = true,
  inspectionError,
}: QueryScenario = {}) {
  const calls: QueryCall[] = [];
  const query = async (strings: TemplateStringsArray, ...parameters: unknown[]) => {
    const text = strings.join('$parameter$').replace(/\s+/g, ' ').trim();
    calls.push({ text, parameters });

    if (text.includes("current_setting('neon.branch_id', true)")) {
      if (identityError) throw identityError;
      return [{ branch_id: actualBranchId }];
    }
    if (inspectionError) throw inspectionError;
    if (text.includes('has_table_privilege')) {
      return tableNames.map((tableName) => ({
        table_name: tableName,
        schema_usage: schemaUsage,
        can_select: tableName !== denyTable,
        can_insert: tableName !== denyTable,
        can_update: tableName !== denyTable,
        can_delete: tableName !== denyTable,
      }));
    }
    if (text.includes('has_sequence_privilege')) {
      return [{ sequence_privileges_ready: sequencePrivileges }];
    }
    if (text.includes('pg_catalog.pg_class')) {
      return catalogTableNames.map((tableName) => ({ table_name: tableName }));
    }
    if (text.includes('information_schema.tables')) {
      return tableNames.map((tableName) => ({ table_name: tableName }));
    }
    throw new Error(`Unexpected readiness query: ${text}`);
  };

  return { query, calls };
}

describe('Neon readiness inspection', () => {
  it('marks a matched, complete, writable Neon branch research-ready with identity checked first', async () => {
    const readinessModule = await import('../../../apps/server/src/db/readiness');
    const inspect = (readinessModule as Record<string, unknown>).inspectNeonReadiness as
      | ((query: Function, env: Record<string, string | undefined>) => Promise<unknown>)
      | undefined;
    const { query, calls } = createReadinessQuery();

    const readiness = inspect
      ? await inspect(query, { EXPECTED_NEON_BRANCH_ID: 'br-preview' })
      : undefined;

    expect(readiness).toEqual({
      contractVersion: 'v1.0.0',
      schemaContractVersion: 'v1.2.0',
      state: 'ready',
      researchReady: true,
      connectivityReady: true,
      branchValidation: 'matched',
      schemaReady: true,
      writePrivilegesReady: true,
      requiredTableCount: 17,
      missingTableCount: 0,
    });
    expect(calls[0]?.text).toContain("current_setting('neon.branch_id', true)");
    expect(calls.every((call) => call.text.startsWith('SELECT'))).toBe(true);
    const sequenceQuery = calls.find((call) => call.text.includes('has_sequence_privilege'))?.text ?? '';
    expect(sequenceQuery).toContain("'USAGE'");
    expect(sequenceQuery).toContain("'SELECT'");
    expect(JSON.stringify(readiness)).not.toContain('br-preview');
  });

  it('allows a complete branch without an expectation as unverified but not research-ready', async () => {
    const readinessModule = await import('../../../apps/server/src/db/readiness');
    const inspect = (readinessModule as Record<string, unknown>).inspectNeonReadiness as Function | undefined;
    const { query } = createReadinessQuery();

    const readiness = inspect ? await inspect(query, {}) : undefined;

    expect(readiness).toMatchObject({
      state: 'unverified',
      researchReady: false,
      connectivityReady: true,
      branchValidation: 'unconfigured',
      schemaReady: true,
      writePrivilegesReady: true,
      missingTableCount: 0,
    });
  });

  it('reports identity or connectivity failures as unavailable with later checks unknown', async () => {
    const readinessModule = await import('../../../apps/server/src/db/readiness');
    const inspect = (readinessModule as Record<string, unknown>).inspectNeonReadiness as Function | undefined;
    const { query, calls } = createReadinessQuery({ identityError: new Error('connection unavailable') });

    const readiness = inspect
      ? await inspect(query, { EXPECTED_NEON_BRANCH_ID: 'br-preview' })
      : undefined;

    expect(readiness).toMatchObject({
      state: 'unavailable',
      researchReady: false,
      connectivityReady: false,
      branchValidation: 'unavailable',
      schemaReady: null,
      writePrivilegesReady: null,
      missingTableCount: null,
    });
    expect(calls).toHaveLength(1);
  });

  it('blocks a mismatched branch after the identity query and before any later SQL', async () => {
    const readinessModule = await import('../../../apps/server/src/db/readiness');
    const inspect = (readinessModule as Record<string, unknown>).inspectNeonReadiness as Function | undefined;
    const { query, calls } = createReadinessQuery({ actualBranchId: 'br-production' });

    const readiness = inspect
      ? await inspect(query, { EXPECTED_NEON_BRANCH_ID: 'br-preview' })
      : undefined;

    expect(readiness).toMatchObject({
      state: 'branch-mismatch',
      researchReady: false,
      connectivityReady: true,
      branchValidation: 'mismatched',
      schemaReady: null,
      writePrivilegesReady: null,
      missingTableCount: null,
    });
    expect(calls).toHaveLength(1);
    expect(JSON.stringify(readiness)).not.toContain('br-production');
    expect(JSON.stringify(readiness)).not.toContain('br-preview');
  });

  it('blocks a Neon branch when one authoritative table is missing', async () => {
    const readinessModule = await import('../../../apps/server/src/db/readiness');
    const inspect = (readinessModule as Record<string, unknown>).inspectNeonReadiness as Function | undefined;
    const tableNames = NEON_REQUIRED_TABLES.filter((name) => name !== 'learner_profiles');
    const { query, calls } = createReadinessQuery({ tableNames: [...tableNames] });

    const readiness = inspect
      ? await inspect(query, { EXPECTED_NEON_BRANCH_ID: 'br-preview' })
      : undefined;

    expect(readiness).toMatchObject({
      state: 'schema-incomplete',
      researchReady: false,
      connectivityReady: true,
      branchValidation: 'matched',
      schemaReady: false,
      writePrivilegesReady: null,
      requiredTableCount: 17,
      missingTableCount: 1,
    });
    expect(calls).toHaveLength(2);
  });

  it('blocks complete schemas lacking table or sequence write privileges', async () => {
    const readinessModule = await import('../../../apps/server/src/db/readiness');
    const inspect = (readinessModule as Record<string, unknown>).inspectNeonReadiness as Function | undefined;
    const deniedTable = createReadinessQuery({ denyTable: 'interaction_events' });
    const deniedSequence = createReadinessQuery({ sequencePrivileges: false });

    const [tableResult, sequenceResult] = inspect
      ? await Promise.all([
          inspect(deniedTable.query, { EXPECTED_NEON_BRANCH_ID: 'br-preview' }),
          inspect(deniedSequence.query, { EXPECTED_NEON_BRANCH_ID: 'br-preview' }),
        ])
      : [undefined, undefined];

    expect(tableResult).toMatchObject({
      state: 'insufficient-privileges',
      schemaReady: true,
      writePrivilegesReady: false,
    });
    expect(sequenceResult).toMatchObject({
      state: 'insufficient-privileges',
      schemaReady: true,
      writePrivilegesReady: false,
    });
  });

  it('counts a zero-grant required base table as present before classifying privileges', async () => {
    const readinessModule = await import('../../../apps/server/src/db/readiness');
    const inspect = (readinessModule as Record<string, unknown>).inspectNeonReadiness as Function | undefined;
    const visibleTables = NEON_REQUIRED_TABLES.filter((name) => name !== 'auth_events');
    const { query, calls } = createReadinessQuery({
      tableNames: [...visibleTables],
      catalogTableNames: [...NEON_REQUIRED_TABLES],
    });

    const readiness = inspect
      ? await inspect(query, { EXPECTED_NEON_BRANCH_ID: 'br-preview' })
      : undefined;

    expect(readiness).toMatchObject({
      state: 'insufficient-privileges',
      schemaReady: true,
      writePrivilegesReady: false,
      requiredTableCount: 17,
      missingTableCount: 0,
    });
    expect(calls[1]?.text).toContain('pg_catalog.pg_class');
    expect(calls[1]?.text).toContain("tables.relkind IN ('r', 'p')");
  });

  it('does not count a same-named view as an authoritative base table', async () => {
    const readinessModule = await import('../../../apps/server/src/db/readiness');
    const inspect = (readinessModule as Record<string, unknown>).inspectNeonReadiness as Function | undefined;
    const baseTables = NEON_REQUIRED_TABLES.filter((name) => name !== 'learner_profiles');
    const { query } = createReadinessQuery({
      // information_schema could include a same-named view; the catalog base-
      // table result intentionally does not.
      tableNames: [...NEON_REQUIRED_TABLES],
      catalogTableNames: [...baseTables],
    });

    const readiness = inspect
      ? await inspect(query, { EXPECTED_NEON_BRANCH_ID: 'br-preview' })
      : undefined;

    expect(readiness).toMatchObject({
      state: 'schema-incomplete',
      schemaReady: false,
      writePrivilegesReady: null,
      requiredTableCount: 17,
      missingTableCount: 1,
    });
  });

  it('treats a missing Neon branch identity as unavailable', async () => {
    const readinessModule = await import('../../../apps/server/src/db/readiness');
    const inspect = (readinessModule as Record<string, unknown>).inspectNeonReadiness as Function | undefined;
    const { query, calls } = createReadinessQuery({ actualBranchId: null });

    const readiness = inspect
      ? await inspect(query, { EXPECTED_NEON_BRANCH_ID: 'br-preview' })
      : undefined;

    expect(readiness).toMatchObject({
      state: 'unavailable',
      connectivityReady: false,
      branchValidation: 'unavailable',
    });
    expect(calls).toHaveLength(1);
  });
});
