# Adaptive Instructional Artifacts (SQL)

ALGL project workspace for:
- Adaptive SQL learning prototype (`apps/web`)
- Offline replay + policy comparison (`scripts/replay-toy.mjs`)
- Research notes and references (`docs`)

## Reorganized structure

- `apps/web/` - Vite React application (student, textbook, research views)
- `scripts/` - reproducible replay and utility scripts
- `docs/` - documentation
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

For demo artifacts (export JSON + screenshots), run:

```bash
npm run demo:week2
```

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
npm run pdf:convert docs/pdf-sources/sample.pdf

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

## System Prerequisites

The following external tools are required by certain npm scripts:

| Tool | Required By | Purpose | Install Commands |
|------|-------------|---------|------------------|
| **jq** | `npm run verify:week2`, `npm run gate:week2:acceptance`, `npm run gate:textbook:content` | JSON validation in acceptance gates | macOS: `brew install jq`<br>Ubuntu/Debian: `sudo apt-get install jq`<br>Windows: `choco install jq` or `winget install jqlang.jq` |
| **unzip** | `npm run hintwise:convert` | Extract HintWise dataset from ZIP archives | macOS: pre-installed<br>Ubuntu/Debian: `sudo apt-get install unzip`<br>Windows: `choco install unzip` or use Git Bash |

**Note:** Without these tools, the Week 2 acceptance gates and HintWise converter will fail with "command not found" errors. The core app (`npm run dev`, `npm run build`) works without them.

## Notes

- App config is at `apps/web/vite.config.ts`.
- Replay fixture and SQL-Engage resources are under `apps/web/src/app/data/`.


---

## Project Documentation

### Technology Stack

#### Core Framework
- **Frontend**: React 18.3.1 + TypeScript
- **Build Tool**: Vite 6.3.5 with custom plugins
- **Styling**: Tailwind CSS 4.1.12
- **UI Components**: Radix UI primitives + shadcn/ui components
- **Icons**: Lucide React
- **Routing**: React Router 7.13.0

#### Key Dependencies
- **SQL Execution**: `sql.js` (SQLite in WebAssembly)
- **Code Editor**: `@monaco-editor/react` (Monaco Editor)
- **Charts**: `recharts` (for concept coverage visualization)
- **Date Handling**: `date-fns`
- **Form Handling**: `react-hook-form`

#### LLM Integration
- **Local LLM**: Ollama with `qwen2.5:1.5b-instruct` (default)
- **API Proxy**: Vite dev server proxies `/ollama` to local Ollama instance
- **Fallback**: Deterministic grounded content when LLM unavailable

#### Testing
- **E2E Framework**: Playwright 1.53.0
- **Browser**: Chromium (headless)
- **Test Location**: `apps/web/tests/*.spec.ts`

### Code Organization

```
/Users/harrydai/Desktop/Personal Portfolio/adaptive-instructional-artifacts/
├── apps/
│   └── web/                      # Main Vite React application
│       ├── src/
│       │   ├── app/
│       │   │   ├── components/   # React components
│       │   │   │   ├── ui/      # shadcn/ui components
│       │   │   │   ├── HintSystem.tsx
│       │   │   │   ├── SQLEditor.tsx
│       │   │   │   ├── ResearchDashboard.tsx
│       │   │   │   ├── AdaptiveTextbook.tsx
│       │   │   │   └── ConceptCoverage.tsx
│       │   │   ├── pages/        # Route pages
│       │   │   │   ├── LearningInterface.tsx
│       │   │   │   ├── TextbookPage.tsx
│       │   │   │   ├── ResearchPage.tsx
│       │   │   │   └── RootLayout.tsx
│       │   │   ├── lib/          # Business logic
│       │   │   │   ├── storage.ts
│       │   │   │   ├── adaptive-orchestrator.ts
│       │   │   │   ├── content-generator.ts
│       │   │   │   ├── sql-executor.ts
│       │   │   │   ├── llm-client.ts
│       │   │   │   ├── retrieval-bundle.ts
│       │   │   │   └── pdf-retrieval.ts
│       │   │   ├── data/         # Static data
│       │   │   │   ├── problems.ts
│       │   │   │   ├── sql-engage.ts
│       │   │   │   └── sql_engage_dataset.csv
│       │   │   └── types/        # TypeScript types
│       │   ├── tests/            # Playwright E2E tests
│       │   └── vite.config.ts
├── scripts/                      # Utility scripts
├── dist/                         # Build outputs
└── docs/                         # Documentation
```

### Key Module Descriptions

| Module | Path | Purpose |
|--------|------|---------|
| `storage.ts` | `apps/web/src/app/lib/storage.ts` | LocalStorage persistence |
| `adaptive-orchestrator.ts` | `apps/web/src/app/lib/adaptive-orchestrator.ts` | Policy decision engine |
| `sql-engage.ts` | `apps/web/src/app/data/sql-engage.ts` | SQL-Engage dataset integration |
| `content-generator.ts` | `apps/web/src/app/lib/content-generator.ts` | LLM-powered content generation |

### Data Contracts

#### SQL-Engage Integration
- **Source**: `apps/web/src/app/data/sql_engage_dataset.csv` (382KB, 23 error subtypes)
- **Policy Version**: Retrieved via `getSqlEngagePolicyVersion()`
- **Subtype Mapping**: All 23 canonical subtypes mapped to concepts

#### Hint Ladder (HintWise)
- **Levels**: 3 progressive hint levels per error subtype
- **Escalation**: Auto-escalate to explanation after hint level 3
- **Help Request Index**: Tracks total help requests per session

#### Export Schema
The demo export (`dist/week2-demo/export.json`) contains interaction traces for analysis.

### Security Considerations

- **NO API KEYS** are committed to the repository
- Ollama runs locally; no external API calls by default
- LocalStorage keys are prefixed: `sql-learning-*`
- SQL execution uses `sql.js` WebAssembly sandbox

### Code Style Guidelines

- Strict TypeScript enabled
- Components: PascalCase (e.g., `HintSystem.tsx`)
- Utilities: camelCase (e.g., `storage.ts`)
- Types: PascalCase with descriptive names
- Use `type` over `interface` for object shapes

### Offline Replay Limitations

**What replay supports:**
- Shows differences in what the system **WOULD** do on the same interaction traces
- Demonstrates policy behavior changes
- Validates concept coverage evolution under different policies

**What replay does NOT support:**
- Claims about "learner improvement" or "learning gains"
- Causal conclusions about educational effectiveness

**Making valid claims:**
To claim learning outcomes, you need a study design that supports causal inference (e.g., randomized A/B experiment). Replay alone shows policy behavior, not educational impact.
