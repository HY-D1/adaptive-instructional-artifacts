# Adaptive Instructional Artifacts (SQL)

ALGL project workspace for:
- Adaptive SQL learning prototype (`apps/web`)
- Offline replay + policy comparison (`scripts/replay-toy.mjs`)
- Research notes and references (`docs`)

## Reorganized structure

- `apps/web/` - Vite React application (student, textbook, research views)
- `scripts/` - reproducible replay and utility scripts
- `docs/README.md` - documentation index and canonical links
- `docs/reviews/` - paper/codebase review notes
- `docs/guidelines/` - project/process guidelines
- `dist/` - build and replay outputs

## Run

1. `npm i`
2. `npm run dev`
3. `npm run build`
4. `npm run replay:toy`
5. `npm run replay:gate`
6. `npm run test:hintwise:convert`

## Local LLM setup (Ollama)

Live explanation/note generation uses local Ollama with model `qwen2.5:1.5b-instruct`.

1. Install Ollama (terminal-first):
   - macOS (Homebrew): `brew install ollama`
   - Windows (PowerShell + winget): `winget install --id Ollama.Ollama -e --accept-source-agreements --accept-package-agreements`
   - Windows (PowerShell + Chocolatey): `choco install ollama -y`
   - If package managers are unavailable, use the installer: [https://ollama.com/download](https://ollama.com/download)
2. Start Ollama:
   - macOS service: `brew services start ollama`
   - macOS or Windows foreground: `ollama serve`
3. Pull model once:
   - `ollama pull qwen2.5:1.5b-instruct`
4. Optional warm-up check:
   - `ollama run qwen2.5:1.5b-instruct "Reply with exactly: OLLAMA_OK"`
5. In the app, go to Research -> `Test LLM`

If you see this message:
`Connected and model 'qwen2.5:1.5b-instruct' is available, but test generation timed out (12000ms + warm-up retry 30000ms). ...`
then Ollama is reachable but still cold/loading. Run `ollama run qwen2.5:1.5b-instruct "Reply with exactly: OLLAMA_OK"` once, then click `Test LLM` again.

To capture the exact UI status message in JSON:
`npm run llm:health:capture`

If Ollama is not running, the app falls back to deterministic grounded content (no crash), but you will not get live model generation.

## Week 2 smoke test (Playwright)

This covers the Week 2 loop in UI:
practice failed attempt -> hint ladder (1/2/3) -> escalation -> add/update note -> verify in My Textbook.

1. Install deps: `npm i`
2. Install browser once: `npx playwright install chromium`
3. Run smoke only: `npm run test:e2e:week2`
4. Run all E2E specs: `npm run test:e2e`

## Week 2 reproducibility

Use `docs/week2_progress.md` as the canonical Week 2 runbook/progress source:
- clickpath verification
- logging fields to validate
- replay mode behavior
- model defaults/params

Project master doc:
- `docs/progress.md`

For professor-ready demo artifacts (export JSON + screenshots), run:

```bash
npm run demo:week2
```

Demo script and acceptance checks:
- `docs/week2-demo.md`
- HintWise converter stability checks (`test:hintwise:convert`)

Note: `dist/week2-clickpath-*` folders are archived snapshots and can be stale. Use `npm run test:e2e:week2` + `test-results/.last-run.json` for current verification status.

## PDF Textbook Indexing (RAG)

The system supports converting PDF textbooks into searchable retrieval indexes for RAG-style lookups during SQL learning.

### Prerequisites

Install Poppler (includes `pdftotext`):
- **macOS**: `brew install poppler`
- **Ubuntu/Debian**: `sudo apt-get install poppler-utils`
- **Fedora/RHEL**: `sudo dnf install poppler-utils`
- **Windows**: `choco install poppler` or download from [poppler-windows](https://github.com/oschwartz10612/poppler-windows/releases)

### Build Index from PDF

Convert a PDF into a searchable index (chunks + embeddings + metadata):

```bash
# Build index with automatic checksum-based incremental detection
npm run pdf:convert docs/pdf-sources/my-textbook.pdf

# Custom output directory
npm run pdf:convert path/to/textbook.pdf --output-dir dist/my-index

# Custom chunking parameters
npm run pdf:convert textbook.pdf --chunk-size 200 --overlap 40

# Force rebuild even if index exists
npm run pdf:convert textbook.pdf --force
```

Features:
- **Incremental**: Skips rebuild if PDF checksum matches existing index
- **Page-aware**: Chunks preserve page numbers and extract headings
- **Local only**: No uploads; all processing stays on your machine
- **Logged**: Shows timing, checksum, pages, chunks, and index path

### Query Index

Search the index and retrieve top-k passages with page citations:

```bash
# Query with default top-5 results
npm run pdf:query dist/pdf-index "SELECT statements and WHERE clauses"

# Query with custom top-k
npm run pdf:query dist/pdf-index "JOIN operations" --top-k 10

# Environment variables
TOP_K=10 SIMILARITY=0.2 npm run pdf:query dist/pdf-index "GROUP BY aggregation"
```

Output includes:
- Ranked results with relevance scores
- Page numbers for citations
- Text snippets (200 chars)
- Extracted headings (if available)
- Query latency

### Smoke Test

Run the full indexing + retrieval test suite:

```bash
npm run test:pdf-index
```

This tests:
1. First-time index build
2. Incremental skip (same checksum)
3. Force rebuild
4. Query with various options
5. Result citations

### UI Integration

Once indexed, load the PDF index in the Research dashboard:
1. Go to **Research** tab
2. Click **Load Index** in the "PDF Retrieval Index" card
3. The index loads from `dist/pdf-index` and persists to LocalStorage
4. When generating explanations/notes, the system retrieves relevant PDF passages automatically

## Notes

- App config is at `apps/web/vite.config.ts`.
- Replay fixture and SQL-Engage resources are under `apps/web/src/app/data/`.
- Week 2 runbook/progress is documented in `docs/week2_progress.md`; demo flow is in `docs/week2-demo.md`.
