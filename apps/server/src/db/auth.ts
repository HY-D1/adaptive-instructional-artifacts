/**
 * Auth Database Operations
 *
 * Manages auth_accounts table for real account-based authentication.
 * This is separate from the `users` table which represents learner profiles.
 *
 * Flow: signup → create users record (learnerId) + create auth_accounts record
 *       login  → look up auth_accounts by email, verify password, return learnerId
 */

import type { NeonQueryFunction } from '@neondatabase/serverless';
import { v4 as uuidv4 } from 'uuid';

// ============================================================================
// Types
// ============================================================================

export interface AuthAccount {
  id: string;
  email: string;
  passwordHash: string;
  role: 'student' | 'instructor';
  learnerId: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface AuthAccountPublic {
  id: string;
  email: string;
  role: 'student' | 'instructor';
  learnerId: string;
  name: string;
  createdAt: string;
}

// ============================================================================
// Schema
// ============================================================================

export async function initAuthSchema(db: NeonQueryFunction<false, false>): Promise<void> {
  await db`
    CREATE TABLE IF NOT EXISTS auth_accounts (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('student', 'instructor')),
      learner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await db`CREATE INDEX IF NOT EXISTS idx_auth_accounts_email ON auth_accounts(email)`;
  await db`CREATE INDEX IF NOT EXISTS idx_auth_accounts_learner_id ON auth_accounts(learner_id)`;
}

// ============================================================================
// CRUD Operations
// ============================================================================

export async function createAuthAccount(
  db: NeonQueryFunction<false, false>,
  params: {
    email: string;
    passwordHash: string;
    role: 'student' | 'instructor';
    learnerId: string;
    name: string;
  }
): Promise<AuthAccount> {
  const id = uuidv4();
  const rows = await db`
    INSERT INTO auth_accounts (id, email, password_hash, role, learner_id, name)
    VALUES (${id}, ${params.email.toLowerCase().trim()}, ${params.passwordHash}, ${params.role}, ${params.learnerId}, ${params.name})
    RETURNING *
  `;
  return rowToAuthAccount(rows[0]);
}

export async function getAuthAccountByEmail(
  db: NeonQueryFunction<false, false>,
  email: string
): Promise<AuthAccount | null> {
  const rows = await db`
    SELECT * FROM auth_accounts WHERE email = ${email.toLowerCase().trim()} LIMIT 1
  `;
  return rows.length > 0 ? rowToAuthAccount(rows[0]) : null;
}

export async function getAuthAccountById(
  db: NeonQueryFunction<false, false>,
  id: string
): Promise<AuthAccount | null> {
  const rows = await db`SELECT * FROM auth_accounts WHERE id = ${id} LIMIT 1`;
  return rows.length > 0 ? rowToAuthAccount(rows[0]) : null;
}

export function toPublicAccount(account: AuthAccount): AuthAccountPublic {
  return {
    id: account.id,
    email: account.email,
    role: account.role,
    learnerId: account.learnerId,
    name: account.name,
    createdAt: account.createdAt,
  };
}

// ============================================================================
// Private helpers
// ============================================================================

function rowToAuthAccount(row: Record<string, unknown>): AuthAccount {
  return {
    id: row.id as string,
    email: row.email as string,
    passwordHash: row.password_hash as string,
    role: row.role as 'student' | 'instructor',
    learnerId: row.learner_id as string,
    name: row.name as string,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}
