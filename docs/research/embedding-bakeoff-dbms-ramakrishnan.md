# Embedding Bake-off — DBMS (Ramakrishnan)

Date: 2026-03-27
Doc: `dbms-ramakrishnan-3rd-edition`
Baseline run: `run-1774660166-b1353117`

## Versions

- `EMBEDDING_BAKEOFF_VERSION=v1`
- `EMBEDDING_QUERYSET_VERSION=v1`
- Query count: `30` (`hints=10`, `explanations=10`, `learning_page=10`)

## Commands Run

```bash
node scripts/run-embedding-bakeoff.mjs \
  --doc-id dbms-ramakrishnan-3rd-edition \
  --run-id run-1774660166-b1353117 \
  --models embeddinggemma:latest,qwen3-embedding:0.6b,qwen3-embedding:4b \
  --output-dir .local/embedding-bakeoff/20260327-wrapper
```

```bash
source tools/pdf_ingest/.venv/bin/activate
PYTHONPATH=tools/pdf_ingest/src python -m pdf_ingest.cli extract \
  --input raw_pdf/dbms-ramakrishnan-3rd-edition.pdf \
  --output .local/ingest-runs/dbms-qwen4b \
  --chapter-range 1-2 \
  --mlx-enabled false \
  --embedding-model qwen3-embedding:4b \
  --embedding-dimension 0 \
  --embedding-bakeoff-version v1 \
  --embedding-queryset-version v1
```

```bash
set -a; source .env.local; export DATABASE_URL="${adaptive_data_DATABASE_URL}"
source tools/pdf_ingest/.venv/bin/activate
PYTHONPATH=tools/pdf_ingest/src python -m pdf_ingest.cli upload \
  --bundle .local/ingest-runs/dbms-qwen4b
```

## Bake-off Results

Source artifact:
- `.local/embedding-bakeoff/20260327-wrapper/embedding-bakeoff-report.json`

| Model | Status | Dimension | Total latency (ms) | Hints | Explanations | Learning page | Overall adaptive score |
|---|---|---:|---:|---:|---:|---:|---:|
| `embeddinggemma:latest` | ok | 768 | 4572.262 | 0.4582 | 0.7032 | 0.5666 | 0.5760 |
| `qwen3-embedding:0.6b` | ok | 1024 | 9953.769 | 0.4771 | 0.5346 | 0.4880 | 0.4999 |
| `qwen3-embedding:4b` | ok | 2560 | 63072.205 | 0.5764 | 0.6819 | 0.6653 | 0.6412 |

## Decision

Policy applied:
- best adaptive retrieval score wins
- latency only tie-breaks near ties

Decision:
- winner: `qwen3-embedding:4b`
- runner-up: `embeddinggemma:latest`
- fallback: `embeddinggemma:latest`

Rationale:
- `qwen3-embedding:4b` achieved the highest weighted adaptive retrieval score (`0.6412`) across the product surfaces.
- `qwen3-embedding:0.6b` underperformed both winner and runner-up on overall score.
- `qwen3-embedding:4b` was slower but stable and completed all bake-off steps (no unsupported/failure state).

## Adoption Evidence (Winner Run)

Winner re-embed run:
- `run_id=run-1774671570-b1353117`
- `embedding_model=qwen3-embedding:4b`
- `embedding_dimension=2560`
- `embedding_backend=ollama`

DB verification (Neon):
- `corpus_ingest_runs` row stores `embedding_backend`, `embedding_model`, `embedding_dimension`
- diagnostics JSON stores:
  - `embedding_bakeoff_version=v1`
  - `embedding_queryset_version=v1`
- `corpus_chunks` for this run have consistent vector dimensions:
  - `count=101`
  - `min(vector_dims)=2560`
  - `max(vector_dims)=2560`

## Top-k Retrieval Evidence (Winner)

Artifacts:
- `.local/ingest-runs/run-1774671570-b1353117/evidence/hint-retrieval-examples-winner.jsonl`
- `.local/ingest-runs/run-1774671570-b1353117/evidence/explanation-retrieval-examples-winner.jsonl`
- `.local/ingest-runs/run-1774671570-b1353117/evidence/learning-page-retrieval-examples-winner.jsonl`

Representative hint queries (top scored):
- `hint-logical-vs-physical` (`queryScore=0.9040`)
- `hint-integrity-constraints` (`queryScore=0.8934`)
- `hint-file-system-vs-dbms` (`queryScore=0.8518`)
- `hint-data-independence` (`queryScore=0.8165`)
- `hint-foreign-key-meaning` (`queryScore=0.8103`)

Representative explanation queries (top scored):
- `explain-er-before-relational` (`queryScore=0.9015`)
- `explain-dbms-vs-files` (`queryScore=0.8787`)
- `explain-levels-of-abstraction` (`queryScore=0.8393`)
- `explain-poor-schema-design` (`queryScore=0.8339`)
- `explain-relations-and-keys` (`queryScore=0.8169`)

Representative learning-page queries (top scored):
- `concept-physical-schema` (`queryScore=0.8965`)
- `concept-conceptual-schema` (`queryScore=0.8885`)
- `concept-external-schema` (`queryScore=0.8795`)
- `concept-integrity-constraints` (`queryScore=0.8655`)
- `concept-dbms-advantages` (`queryScore=0.8335`)

## Practical Recommendation

- Recommended option now: `qwen3-embedding:4b` for ingestion runs where retrieval quality is prioritized.
- Fallback option: `embeddinggemma:latest` where latency/compute budget dominates.
- Not recommended currently: `qwen3-embedding:0.6b` for this adaptive product corpus/task set.
