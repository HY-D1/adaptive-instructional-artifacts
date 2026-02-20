import { expect, test } from '@playwright/test';

test('@weekly retrieval grounding: same learner/problem/subtype resolves stable anchor and source IDs', async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    window.localStorage.setItem('sql-adapt-welcome-seen', 'true');
    // Set up user profile to bypass StartPage role selection
    window.localStorage.setItem('sql-adapt-user-profile', JSON.stringify({
      id: 'test-user',
      name: 'Test User',
      role: 'student',
      createdAt: Date.now()
    }));
  });

  await page.goto('/practice');

  const audit = await page.evaluate(async () => {
    const { buildRetrievalBundle } = await import('/src/app/lib/retrieval-bundle.ts');
    const { generateUnitFromLLM } = await import('/src/app/lib/content-generator.ts');
    const { getDeterministicSqlEngageAnchor } = await import('/src/app/data/sql-engage.ts');
    const { storage } = await import('/src/app/lib/storage.ts');

    const learnerId = 'determinism-learner';
    const subtype = 'undefined column';
    const problem = {
      id: 'determinism-problem',
      title: 'Determinism Check',
      description: 'Audit deterministic SQL-Engage retrieval.',
      difficulty: 'beginner' as const,
      concepts: ['select-basic'],
      schema: 'CREATE TABLE users(id INTEGER, name TEXT);',
      expectedQuery: 'SELECT name FROM users;',
      expectedResult: []
    };

    storage.savePdfIndex({
      indexId: 'pdf-index-grounding-v1',
      sourceName: 'synthetic-rag.pdf',
      createdAt: new Date().toISOString(),
      schemaVersion: 'pdf-index-schema-v1',
      chunkerVersion: 'word-window-180-overlap-30-v1',
      embeddingModelId: 'hash-embedding-v1',
      sourceDocs: [
        {
          docId: 'doc-synthetic',
          filename: 'synthetic-rag.pdf',
          sha256: 'synthetic-sha',
          pageCount: 12
        }
      ],
      docCount: 1,
      chunkCount: 2,
      chunks: [
        {
          chunkId: 'doc-synthetic:p7:c1',
          docId: 'doc-synthetic',
          page: 7,
          text: 'Undefined column errors require checking schema column names and aliases carefully.'
        },
        {
          chunkId: 'doc-synthetic:p12:c1',
          docId: 'doc-synthetic',
          page: 12,
          text: 'SELECT and FROM clauses must reference valid columns that exist in the schema.'
        }
      ]
    });
    storage.setPolicyReplayMode(true);

    const anchorSeed = `${learnerId}|${problem.id}|${subtype}`;
    const anchorRowIds = Array.from({ length: 20 }, () =>
      getDeterministicSqlEngageAnchor(subtype, anchorSeed)?.rowId ?? null
    );

    const buildInteractions = (hintEventId: string) => [
      {
        id: 'error-1',
        learnerId,
        timestamp: 1000,
        eventType: 'error' as const,
        problemId: problem.id,
        error: 'no such column: full_name',
        errorSubtypeId: subtype,
        sqlEngageSubtype: subtype
      },
      {
        id: hintEventId,
        learnerId,
        timestamp: 2000,
        eventType: 'hint_view' as const,
        problemId: problem.id,
        hintLevel: 1 as const,
        hintText: '',
        sqlEngageSubtype: subtype
      }
    ];

    const bundleRunA = buildRetrievalBundle({
      learnerId,
      problem,
      interactions: buildInteractions('hint-run-a'),
      lastErrorSubtypeId: subtype
    });
    const bundleRunB = buildRetrievalBundle({
      learnerId,
      problem,
      interactions: buildInteractions('hint-run-b'),
      lastErrorSubtypeId: subtype
    });
    const generation = await generateUnitFromLLM({
      learnerId,
      templateId: 'notebook_unit.v1',
      bundle: bundleRunA,
      triggerInteractionIds: ['error-1']
    });

    return {
      uniqueAnchorRowIds: Array.from(new Set(anchorRowIds.filter(Boolean))),
      anchorA: bundleRunA.sqlEngageAnchor?.rowId ?? null,
      anchorB: bundleRunB.sqlEngageAnchor?.rowId ?? null,
      sourceIdsA: bundleRunA.retrievedSourceIds,
      sourceIdsB: bundleRunB.retrievedSourceIds,
      bundlePdfPassages: bundleRunA.pdfPassages.map((passage) => ({
        docId: passage.docId,
        chunkId: passage.chunkId,
        page: passage.page
      })),
      unitPdfCitations: (generation.unit.provenance?.retrievedPdfCitations || []).map((citation) => ({
        docId: citation.docId,
        chunkId: citation.chunkId,
        page: citation.page
      }))
    };
  });

  expect(audit.uniqueAnchorRowIds).toHaveLength(1);
  expect(audit.anchorA).toBeTruthy();
  expect(audit.anchorA).toBe(audit.anchorB);
  expect(audit.sourceIdsA).toEqual(audit.sourceIdsB);
  expect(audit.sourceIdsA).toContain(audit.anchorA);
  expect(audit.sourceIdsA.some((sourceId: string) => sourceId.startsWith('hint-run-'))).toBeFalsy();
  expect(audit.bundlePdfPassages.length).toBeGreaterThan(0);
  expect(audit.bundlePdfPassages).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        docId: 'doc-synthetic',
        chunkId: expect.stringMatching(/^doc-synthetic:/),
        page: expect.any(Number)
      })
    ])
  );
  expect(audit.unitPdfCitations.length).toBeGreaterThan(0);
  expect(audit.unitPdfCitations).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        docId: 'doc-synthetic',
        chunkId: expect.stringMatching(/^doc-synthetic:/),
        page: expect.any(Number)
      })
    ])
  );
});
