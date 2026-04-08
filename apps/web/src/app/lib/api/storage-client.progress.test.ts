import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./csrf-client', () => ({
  withCsrfHeader: (options: RequestInit) => options,
  getCsrfHeaders: () => ({}),
  isMutatingMethod: (method?: string) => method === 'POST' || method === 'PUT' || method === 'PATCH' || method === 'DELETE',
  refreshCsrfTokenFromAuthMe: vi.fn(async () => true),
}));

describe('storage-client progress persistence', () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  describe('getProblemProgress', () => {
    it('fetches problem progress for a learner', async () => {
      fetchMock.mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            success: true,
            data: {
              userId: 'learner-1',
              problemId: 'problem-1',
              solved: true,
              attemptsCount: 3,
              hintsUsed: 2,
              lastCode: 'SELECT * FROM users',
            },
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          },
        ),
      );

      const { getProblemProgress } = await import('./storage-client');

      const result = await getProblemProgress('learner-1', 'problem-1');

      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/learners/learner-1/progress/problem-1'),
        expect.any(Object),
      );
      expect(result).toMatchObject({
        userId: 'learner-1',
        problemId: 'problem-1',
        solved: true,
        attemptsCount: 3,
      });
    });

    it('returns null when progress not found', async () => {
      fetchMock.mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            success: false,
            error: 'Progress not found',
          }),
          {
            status: 404,
            headers: { 'Content-Type': 'application/json' },
          },
        ),
      );

      const { getProblemProgress } = await import('./storage-client');

      const result = await getProblemProgress('learner-1', 'problem-1');

      expect(result).toBeNull();
    });
  });

  describe('getAllProblemProgress', () => {
    it('fetches all problem progress for a learner', async () => {
      fetchMock.mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            success: true,
            data: [
              {
                userId: 'learner-1',
                problemId: 'problem-1',
                solved: true,
                attemptsCount: 2,
                hintsUsed: 1,
                lastCode: 'SELECT * FROM users',
              },
              {
                userId: 'learner-1',
                problemId: 'problem-2',
                solved: false,
                attemptsCount: 5,
                hintsUsed: 3,
                lastCode: null,
              },
            ],
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          },
        ),
      );

      const { getAllProblemProgress } = await import('./storage-client');

      const result = await getAllProblemProgress('learner-1');

      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/learners/learner-1/progress'),
        expect.any(Object),
      );
      expect(result).toHaveLength(2);
      expect(result?.[0]).toMatchObject({ problemId: 'problem-1', solved: true });
      expect(result?.[1]).toMatchObject({ problemId: 'problem-2', solved: false });
    });

    it('returns empty array when no progress exists', async () => {
      fetchMock.mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            success: true,
            data: [],
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          },
        ),
      );

      const { getAllProblemProgress } = await import('./storage-client');

      const result = await getAllProblemProgress('learner-1');

      expect(result).toEqual([]);
    });
  });

  describe('updateProblemProgress', () => {
    it('updates problem progress on successful execution', async () => {
      fetchMock.mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            success: true,
            data: {
              userId: 'learner-1',
              problemId: 'problem-1',
              solved: true,
              attemptsCount: 4,
              hintsUsed: 2,
              lastCode: 'SELECT id FROM users',
            },
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          },
        ),
      );

      const { updateProblemProgress } = await import('./storage-client');

      const result = await updateProblemProgress('learner-1', 'problem-1', {
        solved: true,
        incrementAttempts: true,
        lastCode: 'SELECT id FROM users',
      });

      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/learners/learner-1/progress/problem-1'),
        expect.objectContaining({
          method: 'POST',
          body: expect.any(String),
        }),
      );

      const [, request] = fetchMock.mock.calls[0];
      const body = JSON.parse(String(request?.body));
      expect(body).toMatchObject({
        solved: true,
        incrementAttempts: true,
        lastCode: 'SELECT id FROM users',
      });

      expect(result).toMatchObject({
        userId: 'learner-1',
        problemId: 'problem-1',
        solved: true,
        attemptsCount: 4,
      });
    });

    it('handles network errors gracefully', async () => {
      fetchMock.mockRejectedValueOnce(new Error('Network error'));

      const { updateProblemProgress } = await import('./storage-client');

      const result = await updateProblemProgress('learner-1', 'problem-1', {
        solved: true,
      });

      expect(result).toBeNull();
    });

    it('handles non-OK responses', async () => {
      fetchMock.mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            success: false,
            error: 'Server error',
          }),
          {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
          },
        ),
      );

      const { updateProblemProgress } = await import('./storage-client');

      const result = await updateProblemProgress('learner-1', 'problem-1', {
        solved: true,
      });

      expect(result).toBeNull();
    });
  });
});
