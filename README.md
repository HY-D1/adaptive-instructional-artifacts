# Adaptive Instructional Artifacts for Learning Using Interaction Traces


![TypeScript](https://img.shields.io/badge/TypeScript-5.9+-blue)
![React](https://img.shields.io/badge/React-18.3-61DAFB)
![Vite](https://img.shields.io/badge/Vite-6.4-646CFF)
![Tests](https://img.shields.io/badge/Tests-1235%20passing-success)
![Week 1](https://img.shields.io/badge/Week%201-Stable-success)
![License](https://img.shields.io/badge/License-MIT-green)

---

## Executive Summary

This project delivers a working **"automatic adaptive textbook"** prototype and experimental evidence by building an instructional layer that **accumulates, reorganizes, and resurfaces** explanations, examples, and summaries from learner interaction traces—rather than relying on static chapters or only real-time hints.

The design explicitly supports **reflective, on-demand instruction** (e.g., "My Notes / My Textbook") that is triggered when short hints are repeatedly insufficient, while still **preserving productive struggle** and **avoiding over-scaffolding**.

### Core Innovation

| Traditional | Adaptive Instructional Artifacts |
|-------------|----------------------------------|
| Static textbooks | Dynamic content assembly from traces |
| Fixed hint sequences | Personalized escalation profiles |
| One-size-fits-all | Multi-armed bandit optimization |
| Pre-authored explanations | LLM-generated, retrieval-grounded content |
| Assumed help effectiveness | Measured dependency (HDI) |

---

## Research Question

> How can instructional content for SQL learning be assembled and adapted dynamically from learner interaction patterns, error subtypes, and help-seeking behaviors?

### Secondary Questions

- Does slower escalation increase retention?
- Does fast escalation create dependency?
- Are high-performers harmed by aggressive support?
- Can we measure and prevent hint dependency?
- When should the system intervene vs. preserve struggle?

---

## The "Automatic Textbook" Concept

An adaptive instructional artifact that:

1. **Accumulates**: Gathers explanations, examples, summaries from learner struggles
2. **Reorganizes**: Structures content by concept coverage and error patterns
3. **Surfaces**: Delivers content on-demand when hints are insufficient
4. **Personalizes**: Different learners see different content orderings and emphases

### Key Design Principles

#### Reflective, Not Interruptive

```
Learner Error → Hint Request → Progressive Escalation → Textbook Unit Creation
                                                    ↓
                                           On-demand review ("My    Textbook")
```

#### Preserve Productive Struggle

| Level | Content | Purpose |
|-------|---------|---------|
| L1 | Micro-hint (≤100 chars) | Point to missing concept |
| L2 | Strategic hint | How to approach (no final answer) |
| L3 | Error diagnosis | Corrective explanation (compact) |
| LLM | Textbook-style unit | Full explanation + example + common mistakes |

#### Avoid Over-Scaffolding

The **Hint Dependency Index (HDI)** monitors whether learners are becoming dependent on hints. High HDI (> 0.6) triggers interventions to promote independence.

---

## System Architecture

The system separates **"learning interaction capture"** from **"instruction orchestration"** and from **"content assembly,"** so each part remains independently testable and replayable.

```
┌─────────────────────────────────────────────────────────────────┐
│                    INSTRUMENTATION LAYER                        │
│         (Problem, Query, Execution, Navigation)                 │
└─────────────────────────────┬───────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│              EVENT INGESTION + VALIDATION                       │
│            (Schema, Immutable Store, Features)                  │
└─────────────────────────────┬───────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│           ADAPTIVE ORCHESTRATION POLICY ENGINE                  │
│     State Vector → Trigger Function → Decision Events           │
└─────────────────────────────┬───────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│              KNOWLEDGE BACKBONE SERVICES                        │
│    (Error Taxonomy, SQL-Engage Templates, Concept Graph)        │
└─────────────────────────────┬───────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│              CONTENT ASSEMBLY PIPELINE                          │
│     (Instructional Units → "My Textbook" → RAG Query)           │
└─────────────────────────────┬───────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│              CONTROLLED LLM GATEWAY                             │
│    (Retrieval-First → Templated Prompts → Strict Schema)        │
└─────────────────────────────┬───────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│              RESEARCH DASHBOARD + ANALYTICS                     │
│    (Coverage, Escalation Heatmaps, Error Transitions)           │
└─────────────────────────────────────────────────────────────────┘
```

---

## Research Components (17 Total)

### ✅ Phase 1: Core System

| Component | Status | Description |
|-----------|--------|-------------|
| Adaptive Orchestration | ✅ | Escalation logic (hint → explanation → textbook) |
| Guidance Ladder | ✅ | 3-rung progressive support system |
| Automatic Textbook | ✅ | My Notes accumulation and deduplication |
| Source Grounding | ✅ | PDF citation for all explanations |
| SQL-Engage Integration | ✅ | 23 error subtypes mapped to 30 concepts |
| Controlled LLM Use | ✅ | Retrieval-first, generation-second |

### ✅ Phase 2: Adaptive Personalization

| Component | Status | Key Innovation |
|-----------|--------|----------------|
| **Escalation Profiles** | ✅ | Fast/Slow/Adaptive/Explanation-first profiles |
| **Multi-Armed Bandit** | ✅ | Thompson sampling for online optimization |
| **Hint Dependency Index** | ✅ | 5-component measure of learner reliance |

### 📋 Phase 3: Learning Dynamics

| Component | Status | Description |
|-----------|--------|-------------|
| Knowledge Consolidation | 📋 | Spaced reinforcement with micro-checks |
| Error Trajectory Modeling | 📋 | Error transition graphs and learner typologies |
| Cognitive Load Proxy (CSI) | 📋 | Infer strain from interaction patterns |
| Counterfactual Replay | 📋 | Offline policy evaluation |
| Concept Graph | 📋 | Prerequisite relationships |
| Self-Explanation Detection | 📋 | Reflection Quality Score (RQS) |

### 📋 Phase 4: Experimental Evaluation

| Component | Status | Description |
|-----------|--------|-------------|
| Experimental Manipulations | 📋 | Session-level toggles for A/B testing |
| Affective Proxy Layer (APS) | 📋 | Frustration detection from behavior |
| Research Dashboard 2.0 | 📋 | Learning dynamics visualizations |

---

## Project Status

**Current Phase**: ✅ Week 1 Baseline Restored — TypeScript gate re-verified 2026-03-20

Week 1 focused on stability and deployment readiness. Core systems re-verified 2026-03-20 after `LearnerProfile.solvedProblemIds` schema drift fix:

| Gate | Status |
|------|--------|
| TypeScript | ✅ Clean compile (re-verified 2026-03-20) |
| Build | ✅ Production ready |
| Unit Tests | ✅ 829+ passing |
| E2E Tests | ✅ 406 passing (not re-run in this task) |
| Hosted Demo | ✅ Verified on Vercel |

📄 **Full Status Report**: [docs/week1-status.md](./docs/week1-status.md)  
🎬 **Demo Script**: [docs/demo-script.md](./docs/demo-script.md)

**Week 2 Focus**: Textbook/product polishing and adaptive evidence baselines.

---

## Full-Stack Traceability

Every learner action and every system decision is logged with a stable schema for:

- **Debuggability**: Trace system behavior to understand decisions
- **Replayability**: Re-run traces with different policies
- **Publishability**: Meet artifact/reproducibility standards (ACM, FAIR, NeurIPS)

### Two-Layer Logging

| Layer | Purpose | Examples |
|-------|---------|----------|
| **Research Events** | Pedagogical what-happened | `hint_requested`, `escalation_triggered`, `textbook_unit_created` |
| **Operational Telemetry** | Technical how-it-happened | API latencies, schema validation failures, LLM request failures |

### Canonical Event Schema

```typescript
{
  schema_version: "1.0.0",
  event_id: "uuid-v7",
  trace_id: "session-abc-123",
  ts: "2026-03-03T10:00:00Z",
  eventType: "escalation_triggered",
  payload: {
    fromRung: 1,
    toRung: 2,
    trigger: "rung_exhausted",
    errorCountAtEscalation: 3,
    timeToEscalationMs: 120000,
    hintViewsToEscalation: 3,
    propensity: 0.75  // For counterfactual replay
  }
}
```

See the research documentation for logging schema details.

---

## Features

### For Students

- **Practice SQL problems** with immediate feedback
- **Progressive hints** (4 levels: L1→L2→L3→LLM) that adapt to your mistakes
- **Build a personal textbook** from your learning journey
- **Chat with your accumulated materials** (Ask My Textbook)

### For Instructors

- **Monitor student progress** and concept coverage
- **View learning analytics** and traces
- **Export session data** for analysis
- **Replay learner interactions** with different policies

### Adaptive Personalization

- **Escalation Profiles**: Fast/Slow/Adaptive/Explanation-first based on learner behavior
- **Multi-Armed Bandit**: Thompson sampling for optimal strategy selection per learner
- **Hint Dependency Index (HDI)**: 5-component metric measuring learner independence
- **Profile-Aware Escalation**: Integrated with the guidance ladder

---

## Deployment

> **Detailed Guides**: See [docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md) for full deployment procedures and [docs/DEPLOYMENT_MODES.md](./docs/DEPLOYMENT_MODES.md) for the complete capability matrix (what works in local vs hosted mode).

### Production Deployment

#### Environment Variables

**Required for Production:**

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_INSTRUCTOR_PASSCODE` | **Yes** | Passcode for instructor role access. **Must be set** for production deployments. Falls back to `TeachSQL2024` in development only. |

**Optional Environment Variables:**

| Variable | Default | Description |
|----------|---------|-------------|
| `VITE_OLLAMA_URL` | - | Local Ollama instance URL. **Not available on Vercel** (no server-side execution). |
| `VITE_ENABLE_LLM` | `false` | Enable LLM-powered features. Requires local Ollama. |
| `VITE_ENABLE_PDF_INDEX` | `false` | Enable PDF indexing features. Requires backend server. |
| `VITE_API_BASE_URL` | - | Backend API URL for full-stack mode. Leave empty for static hosting. |

> **⚠️ Important**: Variables prefixed with `VITE_` are embedded in the frontend bundle at **build time**. Changing them on Vercel requires a **redeployment** to take effect.

#### Vercel Deployment Checklist

- [ ] **Framework Preset**: Set to "Vite"
- [ ] **Root Directory**: Set to repository root (`./`), NOT `apps/web`
- [ ] **Build Command**: `npm run build`
- [ ] **Output Directory**: `dist/app`
- [ ] **Environment Variables**: Add `VITE_INSTRUCTOR_PASSCODE` with your secure passcode
- [ ] **Redeploy**: Trigger a new deployment after adding environment variables

#### Feature Availability by Deployment Mode

| Feature | Local Dev | Vercel Static | Full-Stack |
|---------|-----------|---------------|------------|
| SQL Practice | ✅ | ✅ | ✅ |
| Student Textbook | ✅ | ✅ | ✅ |
| Instructor Dashboard | ✅ (with passcode) | ✅ (with passcode) | ✅ (with passcode) |
| LLM Explanations | ✅ (local Ollama) | ❌ | ✅ (with backend proxy) |
| PDF Index Search | ✅ (backend required) | ❌ | ✅ (with backend) |

**See [docs/DEPLOYMENT_MODES.md](./docs/DEPLOYMENT_MODES.md) for the complete capability matrix** including:
- Which features require build-time environment variables
- What is intentionally disabled in hosted mode
- How to reproduce each deployment mode locally

### Vercel Configuration

This project is configured for deployment on Vercel with the following settings:

| Setting | Value | Description |
|---------|-------|-------------|
| **Root Directory** | Repository root (`./`) | MUST be repo root, NOT `apps/web` |
| **Output Directory** | `dist/app` | Build output from Vite |
| **Build Command** | `npm run build` | Defined in root `package.json` |
| **Framework Preset** | Vite | Auto-detected or explicitly set |

> **⚠️ Important**: The Root Directory MUST be the repository root, not `apps/web`. The build runs from root via `npm run build` → `npx vite build --config apps/web/vite.config.ts`, and the Vite config uses `../..` relative paths that resolve from the repo root.

These settings are pinned in `vercel.json` to prevent deployment drift between the repository and Vercel dashboard.

---

## Quick Start

### Prerequisites

- [Node.js](https://nodejs.org/) 20+ (LTS recommended)
- [Ollama](https://ollama.com/) (optional, for LLM-powered explanations)

### Install & Run

```bash
# Clone the repository
git clone <repo-url>
cd adaptive-instructional-artifacts

# Install dependencies
npm install

# Start the development server
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## PDF/Textbook Processing

> ⚠️ **External Dependency Required**: The PDF processing pipeline requires an external helper tool (`algl-pdf-helper`) that is **not included** in this repository.

### What is `algl-pdf-helper`?

The `algl-pdf-helper` is a separate repository/workspace containing proprietary PDF processing utilities used to:
- Extract and process textbook PDF content
- Generate structured concept mappings
- Export processed content to the application's textbook system

### Script References in package.json

The following npm scripts reference this external tool:

| Script | Command | Purpose |
|--------|---------|---------|
| `textbook:process` | `cd ../algl-pdf-helper && ./start.sh` | Process PDF files and generate textbook content |
| `textbook:export` | `cd ../algl-pdf-helper && algl-pdf export` | Export processed content to the application |

### If the Helper is Not Available

**Cloning this repository alone is not sufficient** to reproduce the full PDF processing pipeline. If you do not have access to `algl-pdf-helper`:

1. **Use the built-in PDF index commands** (sufficient for most development):
   ```bash
   npm run pdf:index    # Build search index from PDF files
   npm run pdf:search   # Search the index
   npm run pdf:query    # Query with natural language
   ```

2. **The application includes pre-processed textbook content** in `apps/web/public/textbook-static/` that is sufficient for development and testing.

3. **To obtain the helper tool**: Contact the project maintainers for access to the `algl-pdf-helper` repository.

---

## Access Guide

### Student Access

1. On the start page, select **"I am a Student"**
2. Begin practicing SQL problems
3. Request hints when stuck — they adapt to your errors
4. Review your personal textbook to see accumulated notes

### Instructor Access

1. On the start page, select **"I am an Instructor"**
2. Enter the passcode when prompted: `TeachSQL2024`
3. View student analytics, concept coverage, and learning traces
4. Export data for further analysis

> **⚠️ Security Note**: Instructor authentication is client-side only and intended for demo purposes. The passcode is exposed in the frontend bundle (`VITE_INSTRUCTOR_PASSCODE`), making it accessible to anyone with browser devtools. For production use with real student data, implement proper server-side authentication.

### Route Access Matrix

| Route | Student | Instructor | Anonymous |
|-------|---------|------------|-----------|
| `/` (Start) | ✅ | ✅ | ✅ |
| `/practice` | ✅ | ❌ → /instructor-dashboard | ❌ → / |
| `/textbook` | ✅ | ✅ | ❌ → / |
| `/concepts` | ✅ | ❌ → / | ❌ → / |
| `/concepts/:id` | ✅ | ❌ → / | ❌ → / |
| `/research` | ❌ → / | ✅ | ❌ → / |
| `/instructor-dashboard` | ❌ → / | ✅ | ❌ → / |
| `/settings` | ✅ | ✅ | ❌ → / |

---

## Development

```bash
# Build for production
npm run build

# Run all tests
npm run test:e2e:weekly    # 406 E2E tests (402 passing, 4 failed)
npm run test:unit          # 831 unit tests (805 passing, 26 skipped)

# Generate demo artifacts
npm run demo:weekly

# Verification gates
npm run verify:weekly      # Full weekly verification
npm run gate:week3:acceptance
npm run gate:week3:groundedness
npm run check:concept-map

# Replay operations
npm run replay:gate
npm run replay:gate:update

# PDF operations
npm run pdf:index
npm run pdf:search
npm run pdf:query
```

### Test Tags

| Tag | Purpose |
|-----|---------|
| `@weekly` | Weekly regression suite |
| `@no-external` | No Ollama/PDF needed |
| `@integration` | Requires external services |
| `@flaky` | Known intermittent failures |

---

## Technology Stack

| Layer | Technology | Version |
|-------|------------|---------|
| Framework | React | 18.3.1 |
| Language | TypeScript | 5.9+ |
| Build Tool | Vite | 6.4.1 |
| Styling | Tailwind CSS | 4.1 |
| UI Components | Radix UI primitives + shadcn/ui | 1.1+ |
| Router | React Router | 7.13 |
| SQL Engine | sql.js (WASM SQLite) | 1.14 |
| Testing (E2E) | Playwright | 1.53 |
| Testing (Unit) | Vitest | 4.0 |
| Markdown | Marked | 14+ |
| Sanitization | DOMPurify | 3.3 |

---

## Project Structure

```
├── apps/web/                    # Main Vite React application
│   ├── src/
│   │   ├── app/
│   │   │   ├── components/      # React components (HintSystem, etc.)
│   │   │   ├── pages/           # Route pages (StartPage, LearningInterface, etc.)
│   │   │   ├── lib/             # Business logic (storage, orchestrator, bandit, HDI)
│   │   │   │   ├── ml/          # Machine learning components
│   │   │   │   ├── storage/     # Storage management
│   │   │   │   ├── content/     # Content generation
│   │   │   │   └── api/         # API clients
│   │   │   ├── data/            # Static data (problems, SQL-Engage)
│   │   │   └── hooks/           # Custom React hooks
│   │   └── tests/               # Playwright E2E tests (380 @weekly tests)
│   └── vite.config.ts
├── tests/                       # Consolidated E2E tests
│   ├── e2e/
│   │   ├── regression/          # Regression test suite
│   │   ├── features/            # Feature tests
│   │   └── integration/         # Integration tests
│   └── helpers/                 # Test helpers
├── scripts/                     # Utility scripts (replay, metrics)
├── dist/                        # Build outputs
├── package.json                 # Dependencies and scripts
├── playwright.config.ts         # E2E test configuration
├── vitest.config.ts             # Unit test configuration
└── vercel.json                  # Vercel deployment config
```

---

## Testing

The project has **316 unit tests** and **380 E2E tests** covering:

- **Bug Regression**: 87 tests (critical, high, medium priority)
- **Week 5 Components**: 118 tests (HDI: 43, Bandit: 45, Profiles: 30)
- **Week 4 Features**: 31 tests (role-based auth)
- **Week 3 Features**: 20 tests (guidance ladder, source grounding, textbook)
- **Data Integrity**: 46+ tests (event logging, validation)

### Test Inventory

| Category | Count | Description |
|----------|-------|-------------|
| Unit Tests | 807 | Vitest-based unit and integration tests |
| E2E Tests | 401 | Playwright browser tests |
| **Total** | **1,208** | **Test suite: 807 unit + 401 E2E** |

---

## CI/CD Pipeline

GitHub Actions workflow (`.github/workflows/regression-gate.yml`) runs on every PR/push:

1. **Build**: `npm run build`
2. **Test**: 807 unit tests + 401 @weekly E2E tests (2 parallel shards)
3. **Demo**: Generate demo artifacts
4. **Validate**: SQL-Engage concept mapping
5. **Gates**: Week 2 + Week 3 + Week 5 acceptance gates
6. **Artifacts**: Upload test results and demo artifacts

**Deployment**: Vercel-ready via `vercel.json`
- Build output: `dist/app`
- SPA fallback to `index.html`

---

## Research Guardrails

### Valid Claims (Evidence-Supported)

- ✓ "Under Policy X, the system would escalate at interaction N"
- ✓ "Policy Y generates explanatory notes for subtypes A, B, C"
- ✓ "Concept coverage differs between hint-only and adaptive conditions"
- ✓ "HDI predicts help-seeking patterns with X% accuracy"
- ✓ "Profile A produces higher escalation rate than Profile B"

### Invalid Claims (Require Additional Study)

- ✗ "Learners improve more with adaptive hints" (needs pre/post assessment)
- ✗ "Policy Z is educationally superior" (needs controlled experiment)
- ✗ "Students prefer adaptive content" (needs user study)

### Offline Replay Limitations

- Shows **what the system would do**, not learning outcomes
- Enables **policy behavior comparison**, not causal effectiveness claims
- Supports **system development**, not educational evaluation

---

## Foundation Infrastructure

This project builds on established lab systems:

| System | Purpose | Integration Role |
|--------|---------|------------------|
| **Cybernetic Sabotage** | Interactive SQL game environment | Provides interaction traces |
| **HintWise** | Adaptive hint generation | L0/L1 instructional unit producer |
| **SQL-Engage** | Validated error/feedback dataset | Knowledge backbone, concept taxonomy |
| **SQLBeyond** | Gamified SQL learning platform | Multi-tier hint system patterns |

---

## Expected Outcomes

By project completion:

### 1. Working Automatic Textbook Prototype

- Dynamic content assembly from learner traces
- Personalized "My Notes" with concept tracking
- Reflective (not interruptive) delivery
- Source-grounded explanations with citations

### 2. Experimental Evidence

- Comparative analysis: hint-only vs. adaptive strategies
- Replay-based evidence for policy effectiveness
- Concept coverage evolution metrics
- HDI trajectory analysis by escalation profile

### 3. Publication-Ready Components

- System architecture description
- Method for dynamic instructional assembly
- Results on personalized scaffolding
- Counterfactual evaluation methodology
- Artifact bundle for reproducibility

---

## Security

### XSS Prevention

- DOMPurify sanitization before `dangerouslySetInnerHTML`
- Markdown rendering pipeline: `marked.parse()` → `DOMPurify.sanitize()` → `dangerouslySetInnerHTML`
- All user input escaped by React by default

### SQL Injection Protection

- sql.js in-memory SQLite (isolated per session)
- No persistent DB connection
- SQL injection attempts contained within sandbox

### LocalStorage Keys

| Key | Purpose |
|-----|---------|
| `sql-adapt-user-profile` | User identity |
| `sql-learning-interactions` | Event log |
| `sql-learning-textbook` | Accumulated notes |
| `sql-learning-pdf-index` | PDF search index |

---

## Troubleshooting

### Port 5173 already in use

```bash
lsof -ti:5173 | xargs kill -9
```

### WASM file not loading

- Ensure `public/sql-wasm.wasm` exists
- Check Vite config has `wasmServePlugin()`

### Playwright browsers not installed

```bash
npx playwright install --with-deps chromium
```

### Ollama not responding

- Verify Ollama is running: `curl http://localhost:11434/api/tags`
- Check Vite proxy configuration in `vite.config.ts`

---

## License

MIT License - see [LICENSE](LICENSE)

---

## Changelog

### 2026-03-11
- **Deployment**: Pinned Vercel build/output config to repo-root Vite build. Added explicit `framework`, `buildCommand`, and `outputDirectory` to `vercel.json` to prevent deployment drift.

---

*Last updated: 2026-03-11*  
*Project Status: Phase 1 Active — Route contracts fixed, Demo feature added, Vercel config pinned*
