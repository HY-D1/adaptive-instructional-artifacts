import {
  NEON_REQUIRED_TABLES,
  SCHEMA_CONTRACT_VERSION,
} from './schema-contract.js';
import { hasDbEnv } from './env-resolver.js';

export const READINESS_CONTRACT_VERSION = 'v1.0.0' as const;

export type ReadinessState =
  | 'ready'
  | 'local-only'
  | 'unverified'
  | 'unavailable'
  | 'branch-mismatch'
  | 'schema-incomplete'
  | 'insufficient-privileges';

export type BranchValidation =
  | 'not-applicable'
  | 'matched'
  | 'unconfigured'
  | 'unavailable'
  | 'mismatched';

export interface PersistenceReadiness {
  contractVersion: typeof READINESS_CONTRACT_VERSION;
  schemaContractVersion: typeof SCHEMA_CONTRACT_VERSION;
  state: ReadinessState;
  researchReady: boolean;
  connectivityReady: boolean;
  branchValidation: BranchValidation;
  schemaReady: boolean | null;
  writePrivilegesReady: boolean | null;
  requiredTableCount: number;
  missingTableCount: number | null;
}

export type ReadinessQuery = (
  strings: TemplateStringsArray,
  ...parameters: unknown[]
) => Promise<Array<Record<string, unknown>>>;

export interface ProvisionNeonSchemaOptions {
  query: ReadinessQuery;
  initializeSchema: () => Promise<void>;
  env?: Record<string, string | undefined>;
}

const BASE_READINESS = {
  contractVersion: READINESS_CONTRACT_VERSION,
  schemaContractVersion: SCHEMA_CONTRACT_VERSION,
  researchReady: false,
  requiredTableCount: NEON_REQUIRED_TABLES.length,
} as const;

export function getLocalReadiness(): PersistenceReadiness {
  return {
    ...BASE_READINESS,
    state: 'local-only',
    connectivityReady: true,
    branchValidation: 'not-applicable',
    schemaReady: true,
    writePrivilegesReady: true,
    requiredTableCount: NEON_REQUIRED_TABLES.length,
    missingTableCount: 0,
  };
}

export function isDatabaseRouteAllowed(readiness: PersistenceReadiness): boolean {
  return readiness.state === 'ready'
    || readiness.state === 'local-only'
    || readiness.state === 'unverified';
}

export async function getDatabaseReadiness(): Promise<PersistenceReadiness> {
  if (!hasDbEnv()) {
    // Vercel runtimes require Neon. Never treat an absent deployment binding
    // as a healthy, durable SQLite fallback, especially while schema auto-init
    // is disabled by the serverless deployment contract.
    if (process.env.VERCEL === '1') {
      return getUnavailableReadiness();
    }
    return getLocalReadiness();
  }

  try {
    const { getDb } = await import('./neon.js');
    return inspectNeonReadiness(getDb() as unknown as ReadinessQuery);
  } catch {
    return getUnavailableReadiness();
  }
}

/**
 * Provision a preview schema only after an explicit branch expectation matches
 * and read-only privilege introspection confirms DDL capability.
 */
export async function provisionNeonSchema({
  query,
  initializeSchema,
  env = process.env,
}: ProvisionNeonSchemaOptions): Promise<PersistenceReadiness> {
  const expectedBranchId = env.EXPECTED_NEON_BRANCH_ID?.trim();
  if (!expectedBranchId) {
    throw new Error('EXPECTED_NEON_BRANCH_ID is required for Neon schema provisioning');
  }

  let actualBranchId: string | null = null;
  try {
    const rows = await query`
      SELECT current_setting('neon.branch_id', true) AS branch_id
    `;
    const value = rows[0]?.branch_id;
    actualBranchId = typeof value === 'string' && value.trim() ? value.trim() : null;
  } catch {
    throw new Error('Neon branch identity is unavailable; provisioning was not started');
  }

  if (!actualBranchId) {
    throw new Error('Neon branch identity is unavailable; provisioning was not started');
  }
  if (actualBranchId !== expectedBranchId) {
    throw new Error('Neon branch mismatch; provisioning was not started');
  }

  const capabilityRows = await query`
    SELECT
      has_schema_privilege(current_user, 'public', 'CREATE') AS schema_create,
      has_database_privilege(current_user, current_database(), 'CREATE') AS database_create
  `;
  const capabilities = capabilityRows[0];
  if (
    capabilities?.schema_create !== true
    || capabilities.database_create !== true
  ) {
    throw new Error('Neon provisioning privileges are insufficient; provisioning was not started');
  }

  const requiredTableNameArray = `{${NEON_REQUIRED_TABLES.join(',')}}`;
  const ownershipRows = await query`
    SELECT
      tables.relname AS table_name,
      pg_has_role(current_user, tables.relowner, 'USAGE') AS alter_ready
    FROM pg_catalog.pg_class AS tables
    INNER JOIN pg_catalog.pg_namespace AS schemas
      ON schemas.oid = tables.relnamespace
    WHERE schemas.nspname = 'public'
      AND tables.relkind IN ('r', 'p')
      AND tables.relname = ANY(${requiredTableNameArray}::text[])
  `;
  const requiredTables = new Set<string>(NEON_REQUIRED_TABLES);
  const alterReady = ownershipRows.every((row) => {
    const tableName = row.table_name;
    return typeof tableName !== 'string'
      || !requiredTables.has(tableName)
      || row.alter_ready === true;
  });
  if (!alterReady) {
    throw new Error('Neon provisioning privileges are insufficient; provisioning was not started');
  }

  await initializeSchema();

  const readiness = await inspectNeonReadiness(query, env);
  if (readiness.state !== 'ready') {
    throw new Error(`Neon schema provisioning verification failed: ${readiness.state}`);
  }
  return readiness;
}

function getUnavailableReadiness(): PersistenceReadiness {
  return {
    ...BASE_READINESS,
    state: 'unavailable',
    connectivityReady: false,
    branchValidation: 'unavailable',
    schemaReady: null,
    writePrivilegesReady: null,
    missingTableCount: null,
  };
}

/**
 * Inspect a Neon connection using read-only queries. Branch identity is always
 * queried first so a mismatch can stop before schema or privilege inspection.
 */
export async function inspectNeonReadiness(
  query: ReadinessQuery,
  env: Record<string, string | undefined> = process.env,
): Promise<PersistenceReadiness> {
  const expectedBranchId = env.EXPECTED_NEON_BRANCH_ID?.trim() || null;

  let actualBranchId: string | null = null;
  try {
    const rows = await query`
      SELECT current_setting('neon.branch_id', true) AS branch_id
    `;
    const value = rows[0]?.branch_id;
    actualBranchId = typeof value === 'string' && value.trim() ? value.trim() : null;
  } catch {
    return getUnavailableReadiness();
  }

  if (!actualBranchId) {
    return getUnavailableReadiness();
  }

  const branchValidation: BranchValidation = expectedBranchId ? 'matched' : 'unconfigured';
  if (expectedBranchId && actualBranchId !== expectedBranchId) {
    return {
      ...BASE_READINESS,
      state: 'branch-mismatch',
      connectivityReady: true,
      branchValidation: 'mismatched',
      schemaReady: null,
      writePrivilegesReady: null,
      missingTableCount: null,
    };
  }

  let tableRows: Array<Record<string, unknown>>;
  try {
    tableRows = await query`
      SELECT tables.relname AS table_name
      FROM pg_catalog.pg_class AS tables
      INNER JOIN pg_catalog.pg_namespace AS schemas
        ON schemas.oid = tables.relnamespace
      WHERE schemas.nspname = 'public'
        AND tables.relkind IN ('r', 'p')
    `;
  } catch {
    return getUnavailableReadiness();
  }

  const presentTables = new Set(
    tableRows
      .map((row) => row.table_name)
      .filter((name): name is string => typeof name === 'string'),
  );
  const missingTableCount = NEON_REQUIRED_TABLES.filter(
    (tableName) => !presentTables.has(tableName),
  ).length;

  if (missingTableCount > 0) {
    return {
      ...BASE_READINESS,
      state: 'schema-incomplete',
      connectivityReady: true,
      branchValidation,
      schemaReady: false,
      writePrivilegesReady: null,
      missingTableCount,
    };
  }

  let privilegeRows: Array<Record<string, unknown>>;
  let sequenceRows: Array<Record<string, unknown>>;
  try {
    privilegeRows = await query`
      SELECT
        tables.table_name,
        has_schema_privilege(current_user, 'public', 'USAGE') AS schema_usage,
        has_table_privilege(
          current_user,
          format('%I.%I', tables.table_schema, tables.table_name),
          'SELECT'
        ) AS can_select,
        has_table_privilege(
          current_user,
          format('%I.%I', tables.table_schema, tables.table_name),
          'INSERT'
        ) AS can_insert,
        has_table_privilege(
          current_user,
          format('%I.%I', tables.table_schema, tables.table_name),
          'UPDATE'
        ) AS can_update,
        has_table_privilege(
          current_user,
          format('%I.%I', tables.table_schema, tables.table_name),
          'DELETE'
        ) AS can_delete
      FROM information_schema.tables AS tables
      WHERE tables.table_schema = 'public'
    `;
    sequenceRows = await query`
      SELECT COALESCE(
        bool_and(
          has_sequence_privilege(current_user, sequence_name, 'USAGE')
          AND has_sequence_privilege(current_user, sequence_name, 'SELECT')
        ),
        TRUE
      ) AS sequence_privileges_ready
      FROM (
        VALUES
          (pg_get_serial_sequence('public.section_enrollments', 'id')),
          (pg_get_serial_sequence('public.problem_progress', 'id')),
          (pg_get_serial_sequence('public.textbook_unit_event_links', 'id')),
          (pg_get_serial_sequence('public.interaction_textbook_unit_retrievals', 'id'))
      ) AS required_sequences(sequence_name)
      WHERE sequence_name IS NOT NULL
    `;
  } catch {
    return getUnavailableReadiness();
  }

  const privilegesByTable = new Map(
    privilegeRows
      .filter((row) => typeof row.table_name === 'string')
      .map((row) => [row.table_name as string, row]),
  );
  const tablePrivilegesReady = NEON_REQUIRED_TABLES.every((tableName) => {
    const row = privilegesByTable.get(tableName);
    return row?.schema_usage === true
      && row.can_select === true
      && row.can_insert === true
      && row.can_update === true
      && row.can_delete === true;
  });
  const sequencePrivilegesReady = sequenceRows[0]?.sequence_privileges_ready === true;
  const writePrivilegesReady = tablePrivilegesReady && sequencePrivilegesReady;

  if (!writePrivilegesReady) {
    return {
      ...BASE_READINESS,
      state: 'insufficient-privileges',
      connectivityReady: true,
      branchValidation,
      schemaReady: true,
      writePrivilegesReady: false,
      missingTableCount: 0,
    };
  }

  const researchReady = branchValidation === 'matched';
  return {
    ...BASE_READINESS,
    state: researchReady ? 'ready' : 'unverified',
    researchReady,
    connectivityReady: true,
    branchValidation,
    schemaReady: true,
    writePrivilegesReady: true,
    missingTableCount: 0,
  };
}
