import { describe, expect, it } from 'vitest';
import { buildSurveyUrl } from '../../apps/server/src/db/neon';
import { buildSurveyAppRedirect } from '../../apps/server/src/routes/surveys';
import {
  issueSurveyCompletionToken,
  verifySurveyCompletionToken,
} from '../../apps/server/src/lib/survey-links';

type Instance = 'pre' | 'post';
type SyntheticInvitation = {
  userId: string;
  instance: Instance;
  createdAt: number;
  status: 'pending' | 'completed';
  completedAt: number | null;
  responseId: string | null;
};

class SyntheticSurveyStore {
  private rows = new Map<string, SyntheticInvitation>();

  ensure(userId: string, instance: Instance): SyntheticInvitation {
    const key = `${userId}:${instance}`;
    const existing = this.rows.get(key);
    if (existing) return existing;
    const created = { userId, instance, createdAt: this.rows.size + 1, status: 'pending' as const, completedAt: null, responseId: null };
    this.rows.set(key, created);
    return created;
  }

  complete(username: string, instance: Instance, responseId: string): SyntheticInvitation | null {
    const row = this.rows.get(`${username}:${instance}`);
    if (!row) return null;
    if (row.status === 'pending') {
      row.status = 'completed';
      row.completedAt = 1;
      row.responseId = responseId;
    }
    return row;
  }

  pending(userId: string): SyntheticInvitation[] {
    return [...this.rows.values()].filter((row) => row.userId === userId && row.status === 'pending');
  }
}

describe('synthetic survey invitations', () => {
  it('builds absolute app redirects from the required web base URL', () => {
    process.env.WEB_APP_BASE_URL = 'http://localhost:4316';
    expect(buildSurveyAppRedirect('/practice')).toBe('http://localhost:4316/practice');
    delete process.env.WEB_APP_BASE_URL;
    expect(() => buildSurveyAppRedirect('/practice')).toThrow('WEB_APP_BASE_URL');
  });

  it('builds per-instance Qualtrics links with username and a signed token', () => {
    process.env.QUALTRICS_COMPLETION_SIGNING_SECRET = 'test-signing-secret';
    process.env.QUALTRICS_PRE_SURVEY_URL = 'https://example.qualtrics.com/pre';
    process.env.QUALTRICS_POST_SURVEY_URL = 'https://example.qualtrics.com/post';

    const url = new URL(buildSurveyUrl('synthetic-student', 'pre', 'invitation-nonce')!);
    expect(url.searchParams.get('username')).toBe('synthetic-student');
    expect(url.searchParams.get('instance')).toBe('pre');
    expect(url.searchParams.get('completion_token')).toBeTruthy();
    expect(url.searchParams.has('user_id')).toBe(false);
    expect(verifySurveyCompletionToken(url.searchParams.get('completion_token')!, 'pre')).toEqual({
      username: 'synthetic-student',
      instance: 'pre',
      invitationNonce: 'invitation-nonce',
    });
    expect(buildSurveyUrl('synthetic-student', 'post', 'invitation-nonce')).toContain('username=synthetic-student');
  });

  it('fails closed without a signing secret', () => {
    delete process.env.QUALTRICS_COMPLETION_SIGNING_SECRET;
    process.env.QUALTRICS_PRE_SURVEY_URL = 'https://example.qualtrics.com/pre';
    expect(buildSurveyUrl('synthetic-student', 'pre', 'invitation-nonce')).toBeNull();
  });

  it('rejects tampered, expired, and wrong-instance tokens', () => {
    process.env.QUALTRICS_COMPLETION_SIGNING_SECRET = 'test-signing-secret';
    const token = issueSurveyCompletionToken('synthetic-student', 'pre', 'invitation-nonce', 100)!;
    expect(verifySurveyCompletionToken(`${token}tampered`, 'pre', 100)).toBeNull();
    expect(verifySurveyCompletionToken(token, 'pre', 101 + 24 * 60 * 60)).toBeNull();
    expect(verifySurveyCompletionToken(token, 'post', 100)).toBeNull();
    expect(verifySurveyCompletionToken(
      issueSurveyCompletionToken('other-student', 'pre', 'other-nonce', 100)!,
      'pre',
      100,
    )).toMatchObject({ username: 'other-student', invitationNonce: 'other-nonce' });
  });

  it('creates pre at assignment and keeps post as a separate pending row', () => {
    const store = new SyntheticSurveyStore();
    store.ensure('synthetic-student', 'pre');
    store.ensure('synthetic-student', 'post');

    expect(store.pending('synthetic-student').map((row) => row.instance)).toEqual(['pre', 'post']);
  });

  it('keeps pre pending until completion, rejects mismatch, and is idempotent', () => {
    const store = new SyntheticSurveyStore();
    const first = store.ensure('synthetic-student', 'pre');
    const second = store.ensure('synthetic-student', 'pre');

    expect(second).toBe(first);
    expect(store.pending('synthetic-student')).toHaveLength(1);

    expect(store.complete('different-student', 'pre', 'response-1')).toBeNull();
    expect(store.pending('synthetic-student')).toHaveLength(1);

    const completed = store.complete('synthetic-student', 'pre', 'response-1');
    const createdAt = first.createdAt;
    const duplicate = store.complete('synthetic-student', 'pre', 'response-2');
    expect(completed).toEqual(duplicate);
    expect(duplicate?.createdAt).toBe(createdAt);
    expect(duplicate?.status).toBe('completed');
    expect(duplicate?.completedAt).toBe(createdAt);
    expect(duplicate?.responseId).toBe('response-1');
    expect(store.pending('synthetic-student')).toHaveLength(0);
  });
});