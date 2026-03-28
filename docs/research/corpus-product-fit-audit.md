# Corpus Product-Fit Audit

Date: 2026-03-27
Doc: `dbms-ramakrishnan-3rd-edition`

Versions:
- `PRODUCT_FIT_EVAL_VERSION=v1`
- `EMBEDDING_BAKEOFF_VERSION=v1`
- `EMBEDDING_QUERYSET_VERSION=v1`

## Scope

This audit captures:
1. locked baseline behavior on legacy run `run-1774660166-b1353117`
2. post-bakeoff winner run behavior on `run-1774671570-b1353117` (`qwen3-embedding:4b`)
3. parity across:
   - raw Neon source
   - local Neon-backed API (current branch)
   - deployed backend API (`https://adaptive-instructional-artifacts-ap.vercel.app`)

## Baseline (Locked Before Changes)

| Source | Pass | Critical failures | Hints | Explanations | Learning page | Overall | Notes |
|---|---:|---:|---:|---:|---:|---:|---|
| Neon (`run-1774660166-b1353117`) | ❌ | 47 | 0.8965 | 0.9368 | 0.9627 | 0.9320 | `generic_page_title`, `page_span_not_unit_scoped` |
| Local API (`http://127.0.0.1:3001`) | ✅ | 0 | 0.8931 | 0.9325 | 0.9576 | 0.9277 | route-level product shaping masked legacy fields |
| Deployed API (`adaptive-instructional-artifacts-ap.vercel.app`) | ❌ | 47 | 0.8965 | 0.9368 | 0.9627 | 0.9320 | reflected legacy run payload shape |

Baseline artifacts:
- `.local/ingest-runs/run-1774660166-b1353117/product-fit-neon-baseline-20260327/product-fit-report.json`
- `.local/ingest-runs/run-1774660166-b1353117/product-fit-local-neon-baseline-20260327/product-fit-report.json`
- `.local/ingest-runs/run-1774660166-b1353117/product-fit-deployed-baseline-20260327/product-fit-report.json`

## Winner Run (Post Bake-off Adoption)

Winner model: `qwen3-embedding:4b`
Winner run: `run-1774671570-b1353117`

| Source | Pass | Critical failures | Hints | Explanations | Learning page | Overall |
|---|---:|---:|---:|---:|---:|---:|
| Neon (`run-1774671570-b1353117`) | ✅ | 0 | 0.9300 | 0.9694 | 0.9715 | 0.9570 |
| Local API (`http://127.0.0.1:3001`) | ✅ | 0 | 0.9365 | 0.9776 | 0.9813 | 0.9651 |
| Deployed API (`adaptive-instructional-artifacts-ap.vercel.app`) | ✅ | 0 | 0.9300 | 0.9694 | 0.9715 | 0.9570 |

Winner-run artifacts:
- `.local/ingest-runs/run-1774671570-b1353117/product-fit-neon/product-fit-report.json`
- `.local/ingest-runs/run-1774671570-b1353117/product-fit-local-api/product-fit-report.json`
- `.local/ingest-runs/run-1774671570-b1353117/product-fit-deployed-api/product-fit-report.json`

## Before/After (Neon source, same doc)

| Metric | Baseline run (`1774660166`) | Winner run (`1774671570`) | Delta |
|---|---:|---:|---:|
| Critical failures | 47 | 0 | -47 |
| Hints | 0.8965 | 0.9300 | +0.0335 |
| Explanations | 0.9368 | 0.9694 | +0.0326 |
| Learning page | 0.9627 | 0.9715 | +0.0088 |
| Overall | 0.9320 | 0.9570 | +0.0250 |

## Product Usability Proof (Winner Setup)

### A) Hints — 5 retrieval examples

Source:
- `.local/ingest-runs/run-1774671570-b1353117/evidence/hint-retrieval-examples-winner.jsonl`

Examples (query → top-1 unit / score):
1. `hint-logical-vs-physical` → `page-49/chunk-0001` (`queryScore=0.9040`)
2. `hint-integrity-constraints` → `page-46/chunk-0002` (`queryScore=0.8934`)
3. `hint-file-system-vs-dbms` → `page-43/chunk-0001` (`queryScore=0.8518`)
4. `hint-data-independence` → `page-50/chunk-0001` (`queryScore=0.8165`)
5. `hint-foreign-key-meaning` → `page-46/chunk-0002` (`queryScore=0.8103`)

Verdict: usable now (grounded top-k retrievals with high relevance on core hint intents).

### B) Explanations — 5 retrieval/context examples

Source:
- `.local/ingest-runs/run-1774671570-b1353117/evidence/explanation-retrieval-examples-winner.jsonl`

Examples (query → top-1 unit / score):
1. `explain-er-before-relational` → `page-48/chunk-0002` (`queryScore=0.9015`)
2. `explain-dbms-vs-files` → `page-44/chunk-0002` (`queryScore=0.8787`)
3. `explain-levels-of-abstraction` → `page-48/chunk-0001` (`queryScore=0.8393`)
4. `explain-poor-schema-design` → `page-46/chunk-0001` (`queryScore=0.8339`)
5. `explain-relations-and-keys` → `page-46/chunk-0002` (`queryScore=0.8169`)

Verdict: usable now (high-scoring explanatory retrievals; contextual snippets are rich enough for learner-facing expansion).

### C) Learning-page concepts — 5 payload examples

Source (local Neon-backed API payloads):
- `.local/ingest-runs/run-1774671570-b1353117/evidence/local-api/unit-page-40.json`
- `.local/ingest-runs/run-1774671570-b1353117/evidence/local-api/unit-page-41.json`
- `.local/ingest-runs/run-1774671570-b1353117/evidence/local-api/unit-page-42.json`
- `.local/ingest-runs/run-1774671570-b1353117/evidence/local-api/unit-page-43.json`
- `.local/ingest-runs/run-1774671570-b1353117/evidence/local-api/unit-page-44.json`

Observed payload fields:
- `displayTitle`
- `displaySummary`
- `hintSourceExcerpt`
- `explanationContext`
- page-scoped `pageStart/pageEnd`
- `runId=run-1774671570-b1353117`

Verdict: usable now for UI consumption (payload contains title/summary/context fields in local current-branch API; deployed API still has title/summary-only fallback but remains product-fit-pass for this run).

## Parity Verdict

Verdict: **aligned** (materially)

Rationale:
- All three sources now pass with `critical_failure_count=0` on the same winner run.
- Surface scores are close enough for product gating across sources.
- Local API still provides richer product-facing shaping fields than deployed API, but this no longer causes gate failures for the winner run.

## Remaining Risks

1. Historical run readability is limited by current table keys (`unit_id` / `chunk_id` are not run-scoped), so new uploads can overwrite older unit/chunk rows for the same IDs.
2. OCR noise remains visible in some titles/summaries (`generic_page_title` appears as non-critical quality issue).
3. `qwen3-embedding:4b` has substantially higher embedding latency; keep `embeddinggemma:latest` as fallback for lower-resource runs.
