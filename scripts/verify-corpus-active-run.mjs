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

function isLocalOrigin(url) {
  try {
    const parsed = new URL(url);
    return /^(localhost|127\.0\.0\.1)$/i.test(parsed.hostname);
  } catch {
    return false;
  }
}

function getVercelBypassHeaders() {
  const secret =
    process.env.VERCEL_AUTOMATION_BYPASS_SECRET ||
    process.env.E2E_VERCEL_BYPASS_SECRET;
  if (!secret || secret.trim().length === 0) return {};
  return {
    'x-vercel-protection-bypass': secret.trim(),
    'x-vercel-set-bypass-cookie': 'true',
  };
}

function extractShareToken(value) {
  if (!value || value.trim().length === 0) return '';
  try {
    const parsed = new URL(value.trim());
    const token = parsed.searchParams.get('_vercel_share');
    return token && token.trim().length > 0 ? token.trim() : '';
  } catch {
    return '';
  }
}

function getShareToken() {
  const token = process.env.PLAYWRIGHT_API_SHARE_TOKEN;
  if (token && token.trim().length > 0) return token.trim();
  return extractShareToken(process.env.PLAYWRIGHT_API_SHARE_URL);
}

function withShareToken(rawUrl) {
  const shareToken = getShareToken();
  if (!shareToken) return rawUrl;
  try {
    const parsed = new URL(rawUrl);
    const origin = `${parsed.protocol}//${parsed.host}`;
    if (isLocalOrigin(origin)) return rawUrl;
    parsed.searchParams.set('_vercel_share', shareToken);
    return parsed.toString();
  } catch {
    return rawUrl;
  }
}

function extractCookiePair(setCookieHeader) {
  if (!setCookieHeader || typeof setCookieHeader !== 'string') return '';
  const firstSegment = setCookieHeader.split(';')[0]?.trim();
  return firstSegment || '';
}

async function getPreviewBypassCookie(apiBaseUrl) {
  // First try share URL if available
  const shareUrl = process.env.PLAYWRIGHT_API_SHARE_URL;
  if (shareUrl && shareUrl.trim().length > 0) {
    try {
      const response = await fetch(shareUrl.trim(), {
        method: 'GET',
        redirect: 'manual',
      });
      const setCookie = response.headers.get('set-cookie');
      return extractCookiePair(setCookie);
    } catch {
      return '';
    }
  }

  // Otherwise, use bypass secret to get a cookie from the API base URL
  const secret = process.env.VERCEL_AUTOMATION_BYPASS_SECRET || process.env.E2E_VERCEL_BYPASS_SECRET;
  if (!secret || !apiBaseUrl || isLocalOrigin(apiBaseUrl)) {
    return '';
  }

  try {
    const response = await fetch(`${apiBaseUrl}/health`, {
      method: 'GET',
      redirect: 'manual',
      headers: {
        'x-vercel-protection-bypass': secret.trim(),
        'x-vercel-set-bypass-cookie': 'true',
      },
    });
    const setCookie = response.headers.get('set-cookie');
    return extractCookiePair(setCookie);
  } catch {
    return '';
  }
}

async function fetchJson(url, previewCookie = '') {
  const cookieHeader = previewCookie ? { Cookie: previewCookie } : {};
  const response = await fetch(withShareToken(url), {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      ...getVercelBypassHeaders(),
      ...cookieHeader,
    },
  });
  const body = await response.json().catch(() => null);
  return { ok: response.ok, status: response.status, body };
}

async function postJson(url, payload, previewCookie = '') {
  const cookieHeader = previewCookie ? { Cookie: previewCookie } : {};
  const response = await fetch(withShareToken(url), {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...getVercelBypassHeaders(),
      ...cookieHeader,
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
  const previewCookie = await getPreviewBypassCookie(apiBaseUrl);
  const manifestResponse = await fetchJson(`${apiBaseUrl}/api/corpus/manifest`, previewCookie);
  const hasBypassSecret = Boolean(
    (process.env.VERCEL_AUTOMATION_BYPASS_SECRET || process.env.E2E_VERCEL_BYPASS_SECRET || '').trim(),
  );
  const hasShareToken = Boolean(getShareToken());

  if (!manifestResponse.ok || !manifestResponse.body?.success) {
    if (manifestResponse.status === 401 && !hasBypassSecret && !hasShareToken) {
      console.error(
        'Received 401 from preview backend. Set VERCEL_AUTOMATION_BYPASS_SECRET ' +
        'or PLAYWRIGHT_API_SHARE_TOKEN/PLAYWRIGHT_API_SHARE_URL before running corpus verification.',
      );
    }
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
        previewCookie,
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
      }, previewCookie);

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
