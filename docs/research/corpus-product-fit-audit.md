# Corpus Product-Fit Audit

Date: 2026-03-27
Doc: `dbms-ramakrishnan-3rd-edition`
Run: `run-1774660166-b1353117`
Product-fit evaluator: `PRODUCT_FIT_EVAL_VERSION=v1`

## Scope

This audit answers whether current corpus outputs are usable for:
1. hints
2. learner-facing explanations
3. learning-page concept content

Evidence sources used:
- Local bundle artifacts:
  - `.local/ingest-runs/run-1774660166-b1353117/product-fit-report.json`
- Neon rows for the same run:
  - `.local/ingest-runs/run-1774660166-b1353117/evidence/neon-row-samples.json`
- API payloads:
  - local current-branch API: `.local/ingest-runs/run-1774660166-b1353117/evidence/local-api/*.json`
  - deployed API: `.local/ingest-runs/run-1774660166-b1353117/evidence/deployed-api/*.json`

## Gate and Rubric

Thresholds enforced by evaluator (`v1`):
- structural checks: must pass 100%
- `hints >= 0.65`
- `explanations >= 0.70`
- `learning_page >= 0.70`
- `overall >= 0.70`
- critical failures: must be 0

## Baseline vs Current Runtime

| Source | Pass | Critical failures | Hints | Explanations | Learning page | Overall | Notes |
|---|---:|---:|---:|---:|---:|---:|---|
| Neon rows (`run-1774660166-b1353117`) | ❌ | 47 | 0.8965 | 0.9368 | 0.9627 | 0.9320 | fails on `page_span_not_unit_scoped` + `generic_page_title` |
| Deployed API (`adaptive-instructional-artifacts-ap.vercel.app`) | ❌ | 47 | 0.8965 | 0.9368 | 0.9627 | 0.9320 | payloads still expose wide page spans and no product fields |
| Local API (current branch) | ✅ | 0 | 0.8931 | 0.9325 | 0.9576 | 0.9277 | page span normalized, product fields surfaced |

Additional post-fix extraction run evidence:
- Run `run-1774665066-b1353117` (bundle source):
  - pass: `true`
  - critical failures: `0`
  - scores: hints `0.93`, explanations `0.9694`, learning_page `0.9715`, overall `0.957`
  - artifact: `.local/ingest-runs/run-1774665066-b1353117/product-fit-report.json`

## Concrete Evidence of the Main Gap (Before Fix)

From Neon rows (`evidence/neon-row-samples.json`):
- sampled unit rows show page span mismatch, e.g.:
  - `dbms-ramakrishnan-3rd-edition/page-10` has `page_start=1`, `page_end=50`
  - `dbms-ramakrishnan-3rd-edition/page-20` has `page_start=1`, `page_end=50`
- chunk stats for run:
  - `chunk_count=107`
  - `distinct_chunk_text_count=107`
  - `short_chunks=8`
  - `long_chunks=0`
  - `min_len=18`, `max_len=1418`, `avg_len=828.04`

From deployed API (`evidence/deployed-api/unit-page-40.json`):
- `pageStart=1`, `pageEnd=50`, `title="Page 40"`
- no `displayTitle`, `hintSourceExcerpt`, `explanationContext`, or `qualityFlags`

From local API (`evidence/local-api/unit-page-40.json`):
- `pageStart=40`, `pageEnd=40`
- includes `displayTitle`, `hintSourceExcerpt`, `explanationContext`, `qualityFlags`, `productFitScore`

## 15 Sampled Units (early/mid/late)

Sample set from evaluator (`product-fit-local-api/product-fit-report.json`):

| Unit ID | Start | End | Hintability | Explainability | Learning-page | Overall | Failures |
|---|---:|---:|---:|---:|---:|---:|---|
| `.../page-2` | 2 | 2 | 0.6575 | 0.9000 | 0.8800 | 0.8125 | - |
| `.../page-6` | 6 | 6 | 0.6975 | 0.9500 | 0.9400 | 0.8625 | - |
| `.../page-10` | 10 | 10 | 1.0000 | 1.0000 | 1.0000 | 1.0000 | `chunk_too_short` |
| `.../page-13` | 13 | 13 | 1.0000 | 1.0000 | 1.0000 | 1.0000 | - |
| `.../page-16` | 16 | 16 | 1.0000 | 1.0000 | 1.0000 | 1.0000 | - |
| `.../page-19` | 19 | 19 | 1.0000 | 1.0000 | 1.0000 | 1.0000 | - |
| `.../page-23` | 23 | 23 | 1.0000 | 1.0000 | 1.0000 | 1.0000 | - |
| `.../page-26` | 26 | 26 | 0.7375 | 1.0000 | 1.0000 | 0.9125 | - |
| `.../page-29` | 29 | 29 | 1.0000 | 1.0000 | 1.0000 | 1.0000 | - |
| `.../page-33` | 33 | 33 | 1.0000 | 1.0000 | 1.0000 | 1.0000 | - |
| `.../page-36` | 36 | 36 | 0.3488 | 0.3903 | 0.6800 | 0.4730 | `chunk_too_short` |
| `.../page-40` | 40 | 40 | 1.0000 | 1.0000 | 1.0000 | 1.0000 | - |
| `.../page-43` | 43 | 43 | 1.0000 | 1.0000 | 1.0000 | 1.0000 | - |
| `.../page-47` | 47 | 47 | 0.9200 | 0.9000 | 0.8800 | 0.9000 | - |
| `.../page-50` | 50 | 50 | 0.9200 | 0.9000 | 0.8800 | 0.9000 | - |

## 10 Bad Examples

From `samples.badExamples` (`product-fit-local-api/product-fit-report.json`):

| Unit ID | Chunk ID | Overall | Failure |
|---|---|---:|---|
| `dbms-ramakrishnan-3rd-edition/page-3` | `.../page-3/chunk-0001` | 0.6441 | `chunk_too_short` |
| `dbms-ramakrishnan-3rd-edition/page-36` | `.../page-36/chunk-0001` | 0.4730 | `chunk_too_short` |
| `dbms-ramakrishnan-3rd-edition/page-4` | `.../page-4/chunk-0001` | 0.5216 | `chunk_too_short` |
| `dbms-ramakrishnan-3rd-edition/page-8` | `.../page-8/chunk-0001` | 0.7118 | `chunk_too_short` |
| `dbms-ramakrishnan-3rd-edition/page-10` | `.../page-10/chunk-0001` | 1.0000 | `chunk_too_short` |
| `dbms-ramakrishnan-3rd-edition/page-21` | `.../page-21/chunk-0001` | 1.0000 | `chunk_too_long` |
| `dbms-ramakrishnan-3rd-edition/page-27` | `.../page-27/chunk-0001` | 1.0000 | `chunk_too_short` |
| `dbms-ramakrishnan-3rd-edition/page-9` | `.../page-9/chunk-0001` | 0.7147 | - |
| `dbms-ramakrishnan-3rd-edition/page-2` | `.../page-2/chunk-0001` | 0.8125 | - |
| `dbms-ramakrishnan-3rd-edition/page-47` | `.../page-47/chunk-0001` | 0.9000 | - |

## 10 Acceptable Examples

From `samples.acceptableExamples` (`product-fit-local-api/product-fit-report.json`):

| Unit ID | Chunk ID | Overall |
|---|---|---:|
| `dbms-ramakrishnan-3rd-edition/page-7` | `.../page-7/chunk-0001` | 1.0000 |
| `dbms-ramakrishnan-3rd-edition/page-12` | `.../page-12/chunk-0001` | 1.0000 |
| `dbms-ramakrishnan-3rd-edition/page-13` | `.../page-13/chunk-0001` | 1.0000 |
| `dbms-ramakrishnan-3rd-edition/page-15` | `.../page-15/chunk-0001` | 1.0000 |
| `dbms-ramakrishnan-3rd-edition/page-16` | `.../page-16/chunk-0001` | 1.0000 |
| `dbms-ramakrishnan-3rd-edition/page-19` | `.../page-19/chunk-0001` | 1.0000 |
| `dbms-ramakrishnan-3rd-edition/page-20` | `.../page-20/chunk-0001` | 1.0000 |
| `dbms-ramakrishnan-3rd-edition/page-22` | `.../page-22/chunk-0001` | 1.0000 |
| `dbms-ramakrishnan-3rd-edition/page-23` | `.../page-23/chunk-0001` | 1.0000 |
| `dbms-ramakrishnan-3rd-edition/page-24` | `.../page-24/chunk-0001` | 1.0000 |

## Product Surface Proof

### A) Hints (5 real payloads)

Source: `.local/ingest-runs/run-1774660166-b1353117/evidence/hint-ready-payloads.jsonl`

| Unit ID | Page | Hint source excerpt (truncated) | Flags |
|---|---:|---|---|
| `.../page-40` | 40 | `Overview of Databa8e SY8tem8 5 1. Database Design and Application Development...` | `generic_title` |
| `.../page-41` | 41 | `6 CHAPTERrl vVe then briefly describe the internal structure of a DBMS...` | `generic_title` |
| `.../page-42` | 42 | `Overview of Database Systems 7 the responsibility for running them concurrently...` | `generic_title` |
| `.../page-43` | 43 | `8 largest and most vigorous market segments... FILE SYSTEMS VERSUS A DBMS...` | `generic_title` |
| `.../page-44` | 44 | `ADVANTAGES OF A DBMS ... Data Independence...` | `generic_title` |

Assessment:
- short and grounded excerpts are available
- no answer leakage fields are introduced

Verdict: **usable now**

### B) Explanations (5 real payloads)

Source files:
- `evidence/explanation-unit-page-38.json`
- `evidence/explanation-unit-page-39.json`
- `evidence/explanation-unit-page-40.json`
- `evidence/explanation-unit-page-41.json`
- `evidence/explanation-unit-page-42.json`

Each payload includes:
- `displaySummary`
- `explanationContext`
- page-scoped `unit.pageStart/pageEnd`

Representative IDs:
- `dbms-ramakrishnan-3rd-edition/page-38`
- `dbms-ramakrishnan-3rd-edition/page-39`
- `dbms-ramakrishnan-3rd-edition/page-40`
- `dbms-ramakrishnan-3rd-edition/page-41`
- `dbms-ramakrishnan-3rd-edition/page-42`

Assessment:
- explanation context is present and source-grounded
- OCR/front-matter artifacts remain in some units

Verdict: **usable with caveats**

### C) Learning-page concepts (5 real payloads)

Source files:
- `evidence/unit-page-10.json`
- `evidence/unit-page-20.json`
- `evidence/unit-page-30.json`
- `evidence/unit-page-40.json`
- `evidence/unit-page-50.json`

Each payload includes:
- `displayTitle`
- `displaySummary`
- `qualityFlags`
- corrected `pageStart/pageEnd` at unit level in local API

Assessment:
- concept payload is consumable by learning page without extra transforms
- many titles are still content-noisy and flagged `generic_title`

Verdict: **usable with caveats**

## Minimum Changes Required and Implemented

Evidence-backed minimum files changed:
- `tools/pdf_ingest/src/pdf_ingest/product_fit_rules.py`
- `tools/pdf_ingest/src/pdf_ingest/quality_eval.py`
- `tools/pdf_ingest/tests/test_product_fit_rules.py`
- `scripts/evaluate-corpus-product-fit.mjs`
- `tools/pdf_ingest/src/pdf_ingest/chunking.py`
- `tools/pdf_ingest/src/pdf_ingest/mlx_enricher.py`
- `tools/pdf_ingest/src/pdf_ingest/docling_pipeline.py`
- `tools/pdf_ingest/src/pdf_ingest/schemas.py`
- `tools/pdf_ingest/src/pdf_ingest/export_bundle.py`
- `apps/server/src/db/neon.ts`
- `apps/server/src/routes/corpus.ts`
- `apps/web/src/app/lib/content/concept-loader.ts`
- `apps/web/src/app/lib/api/storage-client.ts`
- `apps/web/src/app/lib/content/retrieval-bundle.lib.test.ts`
- `apps/web/src/app/lib/content/concept-loader.test.ts`

## Remaining Risks

1. Deployed API is not yet on the current branch behavior. Deployed evaluator still fails with 47 critical failures.
2. `generic_title` remains common in OCR-heavy/front-matter units; this is now non-critical but visible.
3. A few very short/long chunks remain (`chunk_too_short=6`, `chunk_too_long=1` in local API run).
