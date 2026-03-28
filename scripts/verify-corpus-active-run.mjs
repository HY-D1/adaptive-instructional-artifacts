#!/usr/bin/env node

function parseArgs(argv) {
  const out = {
    apiBaseUrl:
      (
        process.env.PLAYWRIGHT_API_BASE_URL ||
        process.env.VITE_API_BASE_URL ||
        process.env.PLAYWRIGHT_BASE_URL ||
        'http://127.0.0.1:3001'
      ).trim(),
    docId: '',
    maxUnitsPerDoc: 200,
  };

  for (let i = 2; i < argv.length; i += 1) {
    const token = argv[i];
    const next = argv[i + 1];
    if (token === '--api-base-url' && next) {
      out.apiBaseUrl = next.trim();
      i += 1;
      continue;
    }
    if (token === '--doc-id' && next) {
      out.docId = next.trim();
      i += 1;
      continue;
    }
    if (token === '--max-units-per-doc' && next) {
      const parsed = Number(next);
      if (Number.isFinite(parsed) && parsed > 0) {
        out.maxUnitsPerDoc = Math.floor(parsed);
      }
      i += 1;
      continue;
    }
  }

  return out;
}

function normalizeBaseUrl(input) {
  return input.replace(/\/+$/, '');
}

async function fetchJson(url) {
  const response = await fetch(url, {
    method: 'GET',
    headers: { Accept: 'application/json' },
  });
  const body = await response.json().catch(() => null);
  return { ok: response.ok, status: response.status, body };
}

async function postJson(url, payload) {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  const body = await response.json().catch(() => null);
  return { ok: response.ok, status: response.status, body };
}

function fail(summary, mismatches) {
  console.log(JSON.stringify({ summary, mismatches }, null, 2));
  process.exit(2);
}

async function main() {
  const args = parseArgs(process.argv);
  const apiBaseUrl = normalizeBaseUrl(args.apiBaseUrl);
  const manifestResponse = await fetchJson(`${apiBaseUrl}/api/corpus/manifest`);

  if (!manifestResponse.ok || !manifestResponse.body?.success) {
    console.error(
      `Failed to fetch corpus manifest from ${apiBaseUrl} (status=${manifestResponse.status})`,
    );
    process.exit(1);
  }

  const documents = Array.isArray(manifestResponse.body?.data?.documents)
    ? manifestResponse.body.data.documents
    : [];
  const units = Array.isArray(manifestResponse.body?.data?.units)
    ? manifestResponse.body.data.units
    : [];

  const targetDocuments = args.docId
    ? documents.filter((doc) => doc.docId === args.docId)
    : documents;

  const summary = {
    apiBaseUrl,
    docsChecked: 0,
    unitsChecked: 0,
    chunksChecked: 0,
    mismatchedUnits: 0,
    mismatchedChunks: 0,
    searchResultsChecked: 0,
    mismatchedSearchResults: 0,
    docsMissingActiveRun: 0,
  };
  const mismatches = [];

  for (const doc of targetDocuments) {
    summary.docsChecked += 1;
    const activeRunId = typeof doc.activeRunId === 'string' ? doc.activeRunId : null;

    if (!activeRunId) {
      summary.docsMissingActiveRun += 1;
      mismatches.push({
        type: 'doc_missing_active_run',
        docId: doc.docId,
      });
      continue;
    }

    const docUnits = units
      .filter((unit) => unit.docId === doc.docId)
      .slice(0, args.maxUnitsPerDoc);
    summary.unitsChecked += docUnits.length;

    for (const unit of docUnits) {
      if (unit.runId !== activeRunId) {
        summary.mismatchedUnits += 1;
        mismatches.push({
          type: 'unit_run_mismatch',
          docId: doc.docId,
          activeRunId,
          unitId: unit.unitId,
          unitRunId: unit.runId ?? null,
        });
      }

      const unitResponse = await fetchJson(
        `${apiBaseUrl}/api/corpus/unit/${encodeURIComponent(unit.unitId)}`,
      );
      if (!unitResponse.ok || !unitResponse.body?.success || !unitResponse.body?.data) {
        mismatches.push({
          type: 'unit_fetch_failed',
          docId: doc.docId,
          unitId: unit.unitId,
          status: unitResponse.status,
        });
        continue;
      }

      const payloadUnit = unitResponse.body.data.unit;
      const chunks = Array.isArray(unitResponse.body.data.chunks)
        ? unitResponse.body.data.chunks
        : [];
      summary.chunksChecked += chunks.length;

      if (payloadUnit?.runId !== activeRunId) {
        summary.mismatchedUnits += 1;
        mismatches.push({
          type: 'unit_payload_run_mismatch',
          docId: doc.docId,
          unitId: unit.unitId,
          activeRunId,
          payloadUnitRunId: payloadUnit?.runId ?? null,
        });
      }

      for (const chunk of chunks) {
        if (chunk.runId !== activeRunId) {
          summary.mismatchedChunks += 1;
          mismatches.push({
            type: 'chunk_run_mismatch',
            docId: doc.docId,
            activeRunId,
            unitId: unit.unitId,
            chunkId: chunk.chunkId,
            chunkRunId: chunk.runId ?? null,
          });
        }
      }
    }

    if (docUnits.length > 0) {
      const queryToken = String(docUnits[0].title || doc.docId)
        .split(/\s+/)
        .find((token) => token.length >= 3) || doc.docId;
      const searchResponse = await postJson(`${apiBaseUrl}/api/corpus/search`, {
        query: queryToken,
        limit: 25,
      });

      if (!searchResponse.ok || !searchResponse.body?.success) {
        mismatches.push({
          type: 'search_fetch_failed',
          docId: doc.docId,
          status: searchResponse.status,
          queryToken,
        });
      } else {
        const results = Array.isArray(searchResponse.body?.data?.results)
          ? searchResponse.body.data.results
          : [];
        const relevantResults = results.filter((item) => item?.docId === doc.docId);
        summary.searchResultsChecked += relevantResults.length;
        for (const result of relevantResults) {
          if (result?.runId !== activeRunId) {
            summary.mismatchedSearchResults += 1;
            mismatches.push({
              type: 'search_run_mismatch',
              docId: doc.docId,
              activeRunId,
              chunkId: result?.chunkId ?? null,
              resultRunId: result?.runId ?? null,
            });
          }
        }
      }
    }
  }

  const ok =
    summary.docsMissingActiveRun === 0 &&
    summary.mismatchedUnits === 0 &&
    summary.mismatchedChunks === 0 &&
    summary.mismatchedSearchResults === 0;

  if (!ok) {
    fail(summary, mismatches.slice(0, 100));
  }

  console.log(JSON.stringify({ summary, mismatches: [] }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
