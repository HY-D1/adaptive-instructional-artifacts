/* @vitest-environment node */
import express from 'express';
import type { Server } from 'node:http';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  checkResponseIdFormat,
  extractSurveyId,
  verifyQualtricsResponse,
} from '../../../apps/server/src/lib/survey-response-verification';
import { isCorpusAdmin } from '../../../apps/server/src/routes/corpus';
import {
  classifySurveyLinkage,
  listVerifiedInvitations,
} from '../../../scripts/verification/survey-linkage-classifier.mjs';

const { completeMock, verifyTokenMock, DuplicateSurveyResponseError } = vi.hoisted(() => ({
  completeMock: vi.fn(),
  verifyTokenMock: vi.fn(),
  DuplicateSurveyResponseError: class DuplicateSurveyResponseError extends Error {},
}));

vi.mock('../../../apps/server/src/db/neon.js', () => ({
  completeSurveyInvitation: completeMock,
  DuplicateSurveyResponseError,
  getSurveyInvitations: vi.fn(),
  ensureSurveyInvitation: vi.fn(),
}));
vi.mock('../../../apps/server/src/lib/survey-links.js', () => ({ verifySurveyCompletionToken: verifyTokenMock }));
vi.mock('../../../apps/server/src/middleware/rate-limit.js', () => ({
  strictRateLimiter: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

const QUALTRICS_URL = 'https://neu.yul1.qualtrics.com/jfe/form/SV_abc123XYZ';
const REAL_ID = 'R_1a2B3c4D5e6F7g8';

describe('ResponseID format checks', () => {
  it('requires a Qualtrics-shaped id when a real Qualtrics survey is configured', () => {
    const env = { QUALTRICS_PRE_SURVEY_URL: QUALTRICS_URL } as NodeJS.ProcessEnv;
    expect(checkResponseIdFormat(REAL_ID, 'pre', env)).toBeNull();
    expect(checkResponseIdFormat('anything', 'pre', env)).toBe('not_a_qualtrics_response_id');
  });

  it('allows synthetic ids for local stubs or explicitly isolated test targets', () => {
    expect(checkResponseIdFormat('manual-stub-1', 'pre', { QUALTRICS_PRE_SURVEY_URL: 'http://localhost:4320/survey' } as NodeJS.ProcessEnv)).toBeNull();
    expect(checkResponseIdFormat('pilot-abc', 'pre', {
      QUALTRICS_PRE_SURVEY_URL: QUALTRICS_URL,
      SURVEY_ALLOW_SYNTHETIC_RESPONSE_IDS: 'true',
    } as NodeJS.ProcessEnv)).toBeNull();
  });

  it('always rejects unsafe characters', () => {
    expect(checkResponseIdFormat('R_<script>', 'pre', {} as NodeJS.ProcessEnv)).toBe('invalid_characters');
  });
});

describe('Qualtrics API verification', () => {
  const env = {
    QUALTRICS_PRE_SURVEY_URL: QUALTRICS_URL,
    QUALTRICS_API_TOKEN: 'token',
    QUALTRICS_DATACENTER: 'yul1',
  } as NodeJS.ProcessEnv;

  it('extracts the survey id from the survey URL', () => {
    expect(extractSurveyId(QUALTRICS_URL)).toBe('SV_abc123XYZ');
  });

  it('maps API responses to verification results', async () => {
    const ok = vi.fn(async () => new Response('{}', { status: 200 }));
    expect(await verifyQualtricsResponse(REAL_ID, 'pre', env, ok as unknown as typeof fetch)).toBe('verified');
    expect(ok).toHaveBeenCalledWith(
      `https://yul1.qualtrics.com/API/v3/surveys/SV_abc123XYZ/responses/${REAL_ID}`,
      expect.objectContaining({ headers: { 'X-API-TOKEN': 'token' } }),
    );
    const missing = vi.fn(async () => new Response('', { status: 404 }));
    expect(await verifyQualtricsResponse(REAL_ID, 'pre', env, missing as unknown as typeof fetch)).toBe('not_found');
    const down = vi.fn(async () => { throw new Error('network'); });
    expect(await verifyQualtricsResponse(REAL_ID, 'pre', env, down as unknown as typeof fetch)).toBe('unknown');
  });

  it('is skipped without credentials', async () => {
    const spy = vi.fn();
    expect(await verifyQualtricsResponse(REAL_ID, 'pre', { QUALTRICS_PRE_SURVEY_URL: QUALTRICS_URL } as NodeJS.ProcessEnv, spy as unknown as typeof fetch)).toBe('unknown');
    expect(spy).not.toHaveBeenCalled();
  });
});

describe('survey completion callback', () => {
  let server: Server;
  let base: string;

  beforeAll(async () => {
    const { surveysRouter } = await import('../../../apps/server/src/routes/surveys.js');
    const app = express();
    app.use('/api/surveys', surveysRouter);
    server = await new Promise<Server>((done) => {
      const listening = app.listen(0, '127.0.0.1', () => done(listening));
    });
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('Missing test port');
    base = `http://127.0.0.1:${address.port}`;
  });

  afterAll(async () => {
    await new Promise<void>((done, fail) => server.close((error) => (error ? fail(error) : done())));
  });

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('WEB_APP_BASE_URL', 'https://app.example.test');
    vi.stubEnv('QUALTRICS_PRE_SURVEY_URL', QUALTRICS_URL);
    vi.stubEnv('QUALTRICS_API_TOKEN', '');
    verifyTokenMock.mockReturnValue({ username: 'student-abc123', instance: 'pre', invitationNonce: 'n1' });
  });

  afterEach(() => vi.unstubAllEnvs());

  function complete(responseId: string) {
    const params = new URLSearchParams({ instance: 'pre', username: 'student-abc123', completion_token: 't', ResponseID: responseId });
    return fetch(`${base}/api/surveys/complete?${params}`, { redirect: 'manual' });
  }

  it('rejects a made-up ResponseID against a real Qualtrics survey', async () => {
    const response = await complete('fake');
    expect(response.headers.get('location')).toContain('survey-link-invalid');
    expect(completeMock).not.toHaveBeenCalled();
  });

  it('completes with a well-formed id and records it as unverified without API credentials', async () => {
    completeMock.mockResolvedValue({ status: 'completed' });
    const response = await complete(REAL_ID);
    expect(response.headers.get('location')).toBe('https://app.example.test/practice');
    expect(completeMock).toHaveBeenCalledWith('student-abc123', 'pre', 'n1', REAL_ID, 'unverified');
  });

  it('rejects a ResponseID that already completed another invitation', async () => {
    completeMock.mockRejectedValue(new DuplicateSurveyResponseError('dup'));
    const response = await complete(REAL_ID);
    expect(response.headers.get('location')).toContain('survey-link-invalid');
  });
});

describe('reconciliation helper', () => {
  it('only lists invitations whose ResponseID and username both match', () => {
    const invitations = [
      { instance: 'pre', username: 'student-a', qualtrics_response_id: 'R_1' },
      { instance: 'pre', username: 'student-b', qualtrics_response_id: 'R_2' },
      { instance: 'pre', username: 'student-c', qualtrics_response_id: 'R_3' },
    ];
    const responses = [
      { ResponseID: 'R_1', username: 'student-a' },
      { ResponseID: 'R_2', username: 'student-other' },
    ];
    expect(listVerifiedInvitations(invitations, responses)).toEqual([invitations[0]]);
    expect(classifySurveyLinkage(invitations, responses).counts.verified).toBe(1);
  });
});

describe('corpus administration', () => {
  it('allows only configured operator ids', () => {
    const env = { CORPUS_ADMIN_LEARNER_IDS: 'op-1, op-2' } as NodeJS.ProcessEnv;
    expect(isCorpusAdmin('op-2', env)).toBe(true);
    expect(isCorpusAdmin('instructor-9', env)).toBe(false);
    expect(isCorpusAdmin('op-1', {} as NodeJS.ProcessEnv)).toBe(false);
    expect(isCorpusAdmin(undefined, env)).toBe(false);
  });
});
