/* @vitest-environment node */

import { afterEach, describe, expect, it, vi } from 'vitest';

const isUsingNeonMock = vi.fn();
const getCorpusManifestMock = vi.fn();
const getCorpusUnitsIndexMock = vi.fn();
const getCorpusActiveRunsMock = vi.fn();
const setCorpusActiveRunMock = vi.fn();
const getCorpusUnitByIdMock = vi.fn();
const getCorpusChunksByUnitIdMock = vi.fn();
const searchCorpusMock = vi.fn();

vi.mock('../../../apps/server/src/db/index.js', () => ({
  isUsingNeon: isUsingNeonMock,
  getCorpusManifest: getCorpusManifestMock,
  getCorpusUnitsIndex: getCorpusUnitsIndexMock,
  getCorpusActiveRuns: getCorpusActiveRunsMock,
  setCorpusActiveRun: setCorpusActiveRunMock,
  getCorpusUnitById: getCorpusUnitByIdMock,
  getCorpusChunksByUnitId: getCorpusChunksByUnitIdMock,
  searchCorpus: searchCorpusMock,
}));

function getRouteHandler(
  router: { stack?: Array<{ route?: { path?: string; methods?: Record<string, boolean>; stack?: Array<{ handle?: Function }> } }> },
  method: 'get' | 'post',
  path: string,
): Function {
  const layer = router.stack?.find(
    (entry) => entry.route?.path === path && entry.route?.methods?.[method],
  );
  const handle = layer?.route?.stack?.[0]?.handle;
  if (!handle) {
    throw new Error(`Route handler not found for ${method.toUpperCase()} ${path}`);
  }
  return handle;
}

async function invokeJsonHandler(
  handler: Function,
  {
    params = {},
    body = {},
  }: {
    params?: Record<string, string>;
    body?: Record<string, unknown>;
  },
): Promise<{ status: number; json: unknown }> {
  let statusCode = 200;
  let payload: unknown = null;

  const req = {
    params,
    body,
  } as Record<string, unknown>;

  const res = {
    status(code: number) {
      statusCode = code;
      return this;
    },
    json(data: unknown) {
      payload = data;
      return this;
    },
  } as Record<string, unknown>;

  await handler(req, res);
  return { status: statusCode, json: payload };
}

afterEach(() => {
  isUsingNeonMock.mockReset();
  getCorpusManifestMock.mockReset();
  getCorpusUnitsIndexMock.mockReset();
  getCorpusActiveRunsMock.mockReset();
  setCorpusActiveRunMock.mockReset();
  getCorpusUnitByIdMock.mockReset();
  getCorpusChunksByUnitIdMock.mockReset();
  searchCorpusMock.mockReset();
});

describe('neon corpus contract', () => {
  it('returns manifest rows from Neon', async () => {
    const { corpusRouter } = await import('../../../apps/server/src/routes/corpus');
    const handler = getRouteHandler(
      corpusRouter as unknown as { stack?: Array<{ route?: { path?: string; methods?: Record<string, boolean>; stack?: Array<{ handle?: Function }> } }> },
      'get',
      '/manifest',
    );

    isUsingNeonMock.mockReturnValue(true);
    getCorpusManifestMock.mockResolvedValue([
      {
        docId: 'dbms-ramakrishnan-3rd-edition',
        title: 'dbms-ramakrishnan-3rd-edition',
        filename: 'dbms-ramakrishnan-3rd-edition.pdf',
        sha256: 'abc',
        pageCount: 100,
        parserBackend: 'docling',
        pipelineVersion: 'v1',
        runId: 'run-1',
        activeRunId: 'run-1',
        activeRunUpdatedAt: new Date().toISOString(),
        activeRunUpdatedBy: 'test',
        unitCount: 2,
        chunkCount: 8,
        createdAt: new Date().toISOString(),
      },
    ]);
    getCorpusUnitsIndexMock.mockResolvedValue([
      {
        unitId: 'dbms-ramakrishnan-3rd-edition/joins',
        docId: 'dbms-ramakrishnan-3rd-edition',
        conceptId: 'dbms-ramakrishnan-3rd-edition/joins',
        title: 'Joins',
        summary: 'join summary',
        contentMarkdown: '# Joins',
        difficulty: 'intermediate',
        pageStart: 10,
        pageEnd: 12,
        runId: 'run-1',
        metadata: {},
        createdAt: new Date().toISOString(),
      },
    ]);

    const result = await invokeJsonHandler(handler, {});
    expect(result.status).toBe(200);
    const json = result.json as { success: boolean; data?: { documents: Array<{ docId: string; activeRunId: string | null }> } };
    expect(json.success).toBe(true);
    expect(json.data?.documents[0]?.docId).toBe('dbms-ramakrishnan-3rd-edition');
    expect(json.data?.documents[0]?.activeRunId).toBe('run-1');
  });

  it('rejects empty search query', async () => {
    const { corpusRouter } = await import('../../../apps/server/src/routes/corpus');
    const handler = getRouteHandler(
      corpusRouter as unknown as { stack?: Array<{ route?: { path?: string; methods?: Record<string, boolean>; stack?: Array<{ handle?: Function }> } }> },
      'post',
      '/search',
    );

    isUsingNeonMock.mockReturnValue(true);

    const result = await invokeJsonHandler(handler, { body: { query: '   ' } });
    expect(result.status).toBe(400);
  });

  it('returns active-run mappings', async () => {
    const { corpusRouter } = await import('../../../apps/server/src/routes/corpus');
    const handler = getRouteHandler(
      corpusRouter as unknown as { stack?: Array<{ route?: { path?: string; methods?: Record<string, boolean>; stack?: Array<{ handle?: Function }> } }> },
      'get',
      '/active-runs',
    );

    isUsingNeonMock.mockReturnValue(true);
    getCorpusActiveRunsMock.mockResolvedValue([
      {
        docId: 'dbms-ramakrishnan-3rd-edition',
        runId: 'run-1774671570-b1353117',
        updatedAt: new Date().toISOString(),
        updatedBy: 'test',
      },
    ]);

    const result = await invokeJsonHandler(handler, {});
    expect(result.status).toBe(200);
    const json = result.json as { success: boolean; data?: { activeRuns?: Array<{ docId: string; runId: string }> } };
    expect(json.success).toBe(true);
    expect(json.data?.activeRuns?.[0]?.docId).toBe('dbms-ramakrishnan-3rd-edition');
    expect(json.data?.activeRuns?.[0]?.runId).toBe('run-1774671570-b1353117');
  });

  it('returns 404 for unknown unit', async () => {
    const { corpusRouter } = await import('../../../apps/server/src/routes/corpus');
    const handler = getRouteHandler(
      corpusRouter as unknown as { stack?: Array<{ route?: { path?: string; methods?: Record<string, boolean>; stack?: Array<{ handle?: Function }> } }> },
      'get',
      '/unit/:unitId',
    );

    isUsingNeonMock.mockReturnValue(true);
    getCorpusUnitByIdMock.mockResolvedValue(null);

    const result = await invokeJsonHandler(handler, { params: { unitId: 'missing' } });
    expect(result.status).toBe(404);
  });
});
