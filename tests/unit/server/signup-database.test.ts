/* @vitest-environment node */
import { describe, expect, it, vi } from 'vitest';
import type { NeonQueryFunction } from '@neondatabase/serverless';
import { createStudentAccount } from '../../../apps/server/src/db/auth';
import { consumeSignupLimit } from '../../../apps/server/src/db/signup-rate-limit';

describe('signup database contracts', () => {
  it('submits the student user, account, profile and enrollment as one transaction', async () => {
    const statements: Array<{ sql: string; values: unknown[] }> = [];
    const db = Object.assign(
      (strings: TemplateStringsArray, ...values: unknown[]) => {
        const query = { sql: strings.join('?'), values };
        statements.push(query);
        return query;
      },
      { transaction: vi.fn().mockResolvedValue([[], [{ id: 'a', email: 's@example.com', password_hash: 'hash', role: 'student', learner_id: 'u', name: 'S' }], [], []]) },
    );
    const account = await createStudentAccount(db as unknown as NeonQueryFunction<false, false>, {
      email: 'S@EXAMPLE.COM', passwordHash: 'hash', learnerId: 'u', name: 'S', sectionId: 'class',
    });
    expect(db.transaction).toHaveBeenCalledOnce();
    expect(db.transaction).toHaveBeenCalledWith(statements);
    expect(statements.map(statement => statement.sql.match(/INSERT INTO (\w+)/)?.[1])).toEqual([
      'users', 'auth_accounts', 'learner_profiles', 'section_enrollments',
    ]);
    expect(statements[1].values).toContain('s@example.com');
    expect(statements[0].values).toEqual(expect.arrayContaining([expect.stringMatching(/^student-[a-z0-9]{6}$/)]));
    expect(statements[2].values).toContain(JSON.stringify({ escalationThreshold: 3, aggregationDelay: 300000, autoTextbookEnabled: true, notificationsEnabled: true, theme: 'system' }));
    expect(account.learnerId).toBe('u');
  });

  it.each(['idx_users_username', 'users_username_key'])('retries only username collision %s in a fresh transaction', async (constraint) => {
    const calls: unknown[][] = [];
    const transaction = vi.fn()
      .mockRejectedValueOnce({ code: '23505', constraint })
      .mockResolvedValueOnce([[], [{ id: 'a', email: 's@example.com', password_hash: 'h', role: 'student', learner_id: 'u', name: 'S' }], [], []]);
    const db = Object.assign((strings: TemplateStringsArray, ...values: unknown[]) => {
      calls.push(values);
      return { sql: strings.join('?'), values };
    }, { transaction });
    await createStudentAccount(db as unknown as NeonQueryFunction<false, false>, { email: 's@example.com', passwordHash: 'h', learnerId: 'u', name: 'S', sectionId: 'class' });
    expect(transaction).toHaveBeenCalledTimes(2);
    expect(calls[0]).toEqual(expect.arrayContaining([expect.stringMatching(/^student-[a-z0-9]{6}$/)]));
    expect(calls[4]).toEqual(expect.arrayContaining([expect.stringMatching(/^student-[a-z0-9]{6}$/)]));
  });

  it('does not retry email uniqueness errors', async () => {
    const error = { code: '23505', constraint: 'auth_accounts_email_key' };
    const transaction = vi.fn().mockRejectedValue(error);
    const db = Object.assign(() => ({}), { transaction });
    await expect(createStudentAccount(db as unknown as NeonQueryFunction<false, false>, { email: 's@example.com', passwordHash: 'h', learnerId: 'u', name: 'S', sectionId: 'class' })).rejects.toBe(error);
    expect(transaction).toHaveBeenCalledOnce();
  });

  it('stops after ten username collisions', async () => {
    const error = { code: '23505', constraint: 'idx_users_username' };
    const transaction = vi.fn().mockRejectedValue(error);
    const db = Object.assign(() => ({}), { transaction });
    await expect(createStudentAccount(db as unknown as NeonQueryFunction<false, false>, { email: 's@example.com', passwordHash: 'h', learnerId: 'u', name: 'S', sectionId: 'class' })).rejects.toBe(error);
    expect(transaction).toHaveBeenCalledTimes(10);
  });

  it('uses a hashed key and propagates shared-store errors', async () => {
    const db = vi.fn().mockResolvedValueOnce([{ attempts: 5 }]).mockResolvedValueOnce([{ attempts: 6 }]).mockRejectedValueOnce(new Error('offline'));
    const typed = db as unknown as NeonQueryFunction<false, false>;
    expect(await consumeSignupLimit(typed, 'email', ['private@example.com', '127.0.0.1'], 5)).toBe(true);
    expect(await consumeSignupLimit(typed, 'email', ['private@example.com', '127.0.0.1'], 5)).toBe(false);
    await expect(consumeSignupLimit(typed, 'email', ['private@example.com', '127.0.0.1'], 5)).rejects.toThrow('offline');
    expect(db.mock.calls[0][1]).toMatch(/^[a-f0-9]{64}$/);
    expect(db.mock.calls[0][1]).not.toContain('private@example.com');
    expect(db.mock.calls[0][0].join('?')).toContain('ON CONFLICT (key_hash) DO UPDATE');
  });
});
