# SQL-Adapt Learning System

An adaptive SQL learning environment exploring **dynamic instructional assembly** — content that emerges from learner interaction data rather than being pre-authored.

![TypeScript](https://img.shields.io/badge/TypeScript-5.9+-blue)
![React](https://img.shields.io/badge/React-18.3-61DAFB)
![Vite](https://img.shields.io/badge/Vite-6.4-646CFF)
![Tests](https://img.shields.io/badge/Tests-403%20passing-success)
![License](https://img.shields.io/badge/License-MIT-green)

## Table of Contents

- [Features](#features)
- [System Architecture](#system-architecture)
- [Technology Stack](#technology-stack)
- [Quick Start](#quick-start)
- [Access Guide](#access-guide)
- [Development](#development)
- [Project Structure](#project-structure)
- [Documentation](#documentation)
- [Testing](#testing)
- [CI/CD Pipeline](#cicd-pipeline)
- [Security](#security)
- [Troubleshooting](#troubleshooting)
- [License](#license)

## Features

**For Students:**
- Practice SQL problems with immediate feedback
- Progressive hints (4 levels: L1→L2→L3→LLM) that adapt to your mistakes
- Build a personal textbook from your learning journey
- Chat with your accumulated materials (Ask My Textbook)

**For Instructors:**
- Monitor student progress and concept coverage
- View learning analytics and traces
- Export session data for analysis
- Replay learner interactions with different policies

**Adaptive Personalization (Week 5):**
- **Escalation Profiles**: Fast/Slow/Adaptive/Explanation-first based on learner behavior
- **Multi-Armed Bandit**: Thompson sampling for optimal strategy selection per learner
- **Hint Dependency Index (HDI)**: 5-component metric measuring learner independence
- **Profile-Aware Escalation**: Integrated with the guidance ladder

## System Architecture

### High-Level Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                         SQL-ADAPT SYSTEM                            │
├─────────────────────────────────────────────────────────────────────┤
│  STUDENT INTERFACE        │        INSTRUCTOR INTERFACE              │
│  ┌─────────────────────┐  │  ┌─────────────────────────────────┐    │
│  │ LearningInterface   │  │  │ ResearchDashboard               │    │
│  │ - SQL Editor        │  │  │ - Progress Analytics            │    │
│  │ - Hint System       │  │  │ - Concept Coverage              │    │
│  │ - Textbook View     │  │  │ - Learning Traces               │    │
│  └──────────┬──────────┘  │  └─────────────────────────────────┘    │
└─────────────┼─────────────┴─────────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      ADAPTIVE CORE                                  │
│  ┌─────────────┐  ┌──────────────┐  ┌─────────────┐  ┌──────────┐  │
│  │ Guidance    │  │ Escalation   │  │ Multi-Armed │  │ HDI      │  │
│  │ Ladder      │  │ Profiles     │  │ Bandit      │  │ Calculator│  │
│  │ (L1→L2→L3)  │  │ (4 profiles) │  │ (Thompson)  │  │ (5 comp) │  │
│  └─────────────┘  └──────────────┘  └─────────────┘  └──────────┘  │
└─────────────────────────────────────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    DATA & RETRIEVAL LAYER                           │
│  ┌──────────────┐  ┌─────────────┐  ┌───────────────────────────┐  │
│  │ SQL-Engage   │  │ PDF Index   │  │ Textbook Units (Dynamic)  │  │
│  │ (Hints)      │  │ (Sources)   │  │ (Personalized Content)    │  │
│  └──────────────┘  └─────────────┘  └───────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

### 🪜 Guidance Ladder Flow

```
┌─────────────────────────────────────────────────────────────┐
│  Student makes SQL error                                      │
└──────────────────────┬──────────────────────────────────────┘
                       ▼
┌─────────────────────────────────────────────────────────────┐
│  L1: Micro-hint (1 sentence)                                  │
│  "Check your SELECT clause..."                                │
│  Source: SQL-Engage dataset                                   │
└──────────────────────┬──────────────────────────────────────┘
         ↓ Request more help
                       ▼
┌─────────────────────────────────────────────────────────────┐
│  L2: Concrete example + PDF passage                           │
│  "Here's the pattern: SELECT col FROM table"                  │
│  Source: Textbook chunks with page citations                  │
└──────────────────────┬──────────────────────────────────────┘
         ↓ Request more help
                       ▼
┌─────────────────────────────────────────────────────────────┐
│  L3: Detailed explanation                                     │
│  "The error occurs because..."                                │
│  Source: SQL-Engage template + concept mapping                │
└──────────────────────┬──────────────────────────────────────┘
         ↓ Still stuck?
                       ▼
┌─────────────────────────────────────────────────────────────┐
│  🎯 LLM Explanation (Grounded Generation)                     │
│  Personalized explanation with citations                      │
│  Retrieved: PDF chunks + SQL-Engage + Problem context         │
│  Generated: Structured explanation → Saved to My Textbook     │
└─────────────────────────────────────────────────────────────┘
```

### Data Flow

```
StartPage → Role Selection → Student/Instructor Profile
                                  ↓
                    ┌─────────────┴─────────────┐
                    ↓                           ↓
              Student Route               Instructor Route
                    ↓                           ↓
          LearningInterface           ResearchDashboard
                    ↓                           ↓
          SQL Error → normalizeSqlErrorSubtype()
                              ↓
          User Request Hint ← Progressive Hint ←
                  ↓
          Rung 1 → Rung 2 → Rung 3 (Linear Progression)
                  ↓
          Profile Selection (Bandit/Static/Diagnostic)
                  ↓
          Auto-Escalation → Explanation Mode
                  ↓
          Retrieval Bundle → SQL-Engage + Template
                  ↓
          Explanation View → textbook_add Event → My Notes
```

## Technology Stack

| Layer | Technology | Version |
|-------|------------|---------|
| Framework | React | 18.3.1 |
| Language | TypeScript | 5.9+ |
| Build Tool | Vite | 6.4 |
| Styling | Tailwind CSS | 4.1 |
| UI Components | Radix UI primitives + MUI | 7.3 |
| Router | React Router | 7.13 |
| SQL Engine | sql.js (WASM SQLite) | 1.14 |
| Testing (E2E) | Playwright | 1.53 |
| Testing (Unit) | Vitest | 4.0 |
| Markdown | Marked | 14+ |
| Sanitization | DOMPurify | 3.3 |

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

## Access Guide

### Student Access
1. On the start page, select **"I am a Student"**
2. Begin practicing SQL problems
3. Request hints when stuck — they adapt to your errors
4. Review your personal textbook to see accumulated notes

### Instructor Access
1. On the start page, select **"I am an Instructor"**
2. Enter the passcode when prompted (configured via `VITE_INSTRUCTOR_PASSCODE`)
3. View student analytics, concept coverage, and learning traces
4. Export data for further analysis

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

## Development

```bash
# Build for production
npm run build

# Run all tests
npm run test:e2e:weekly    # 138 E2E tests
npm run test:unit          # 265 unit tests

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

## Project Structure

```
├── apps/web/                    # Main Vite React application
│   ├── src/
│   │   ├── app/
│   │   │   ├── components/      # React components (HintSystem, etc.)
│   │   │   ├── pages/           # Route pages (StartPage, LearningInterface, etc.)
│   │   │   ├── lib/             # Business logic (storage, orchestrator, bandit, HDI)
│   │   │   ├── data/            # Static data (problems, SQL-Engage)
│   │   │   └── hooks/           # Custom React hooks (useUserRole, etc.)
│   │   └── tests/               # Playwright E2E tests (138 @weekly tests)
│   └── vite.config.ts
├── scripts/                     # Utility scripts (replay, metrics)
├── docs/                        # Documentation
│   ├── README.md                # Documentation index and navigation
│   ├── runbooks/                # Active operational docs
│   │   ├── progress.md          # Architecture and milestones
│   │   ├── weekly-progress.md   # Active checkpoint log
│   │   ├── build-test-report-2026-02-28.md
│   │   ├── concept-comparison.md
│   │   └── pdf-helper-integration-guide.md
│   ├── research/                # Research and design docs
│   │   ├── HDI.md               # Hint Dependency Index
│   │   ├── MULTI_ARMED_BANDIT.md
│   │   ├── ESCALATION_POLICIES.md
│   │   └── RESEARCH_ARCHITECTURE.md
│   └── archive/                 # Historical/outdated docs
├── dist/                        # Build outputs (gitignored)
├── package.json                 # Dependencies and scripts
├── playwright.config.ts         # E2E test configuration
├── vitest.config.ts             # Unit test configuration
└── vercel.json                  # Vercel deployment config
```

## Documentation

| Document | Purpose |
|----------|---------|
| [docs/README.md](docs/README.md) | Documentation index and navigation |
| [docs/runbooks/progress.md](docs/runbooks/progress.md) | Architecture, milestones, research vision |
| [docs/runbooks/weekly-progress.md](docs/runbooks/weekly-progress.md) | Active checkpoint log (every task) |
| [AGENTS.md](AGENTS.md) | Agent workflow policy and conventions |

### Research Component Documentation

| Component | Document | Status |
|-----------|----------|--------|
| Escalation Policies | [ESCALATION_POLICIES.md](docs/research/ESCALATION_POLICIES.md) | ✅ Complete |
| Multi-Armed Bandit | [MULTI_ARMED_BANDIT.md](docs/research/MULTI_ARMED_BANDIT.md) | ✅ Complete |
| HDI | [HDI.md](docs/research/HDI.md) | ✅ Complete |

### Policy Versions

| Component | Version | Source File |
|-----------|---------|-------------|
| SQL-Engage Policy | `sql-engage-index-v3-hintid-contract` | `apps/web/src/app/data/sql-engage.ts` |
| Orchestrator Semantics | `orchestrator-auto-escalation-variant-v2` | `apps/web/src/app/lib/adaptive-orchestrator.ts` |
| Guidance Ladder | `guidance-ladder-profile-v1` | `apps/web/src/app/lib/guidance-ladder.ts` |
| Escalation Profiles | `escalation-profiles-v1` | `apps/web/src/app/lib/escalation-profiles.ts` |
| Bandit Algorithm | `bandit-thompson-v1` | `apps/web/src/app/lib/multi-armed-bandit.ts` |
| HDI Calculator | `hdi-5component-v1` | `apps/web/src/app/lib/hdi-calculator.ts` |

## Testing

The project has **265 unit tests** and **138 E2E tests** covering:

- **Bug Regression**: 87 tests (critical, high, medium priority)
- **Week 5 Components**: 118 tests (HDI: 43, Bandit: 45, Profiles: 30)
- **Week 4 Features**: 31 tests (role-based auth)
- **Week 3 Features**: 20 tests (guidance ladder, source grounding, textbook)
- **Data Integrity**: 46+ tests (event logging, validation)

### Test Inventory

| Category | Count | Description |
|----------|-------|-------------|
| Unit Tests | 265 | Vitest-based unit and integration tests |
| E2E Tests | 138 | Playwright browser tests |
| **Total** | **403** | **All tests passing** |

## CI/CD Pipeline

GitHub Actions workflow (`.github/workflows/regression-gate.yml`) runs on every PR/push:

1. **Build**: `npm run build`
2. **Test**: 265 unit tests + 138 @weekly E2E tests (2 parallel shards)
3. **Demo**: Generate demo artifacts
4. **Validate**: SQL-Engage concept mapping
5. **Gates**: Week 2 + Week 3 + Week 5 acceptance gates
6. **Artifacts**: Upload test results and demo artifacts

**Deployment**: Vercel-ready via `vercel.json`
- Build output: `dist/app`
- SPA fallback to `index.html`

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
| `sql-adapt-debug-profile` | Profile override (dev mode) |
| `sql-adapt-debug-strategy` | Assignment strategy (dev mode) |

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

## Type Definitions

### Core Types

```typescript
// User identity
interface UserProfile {
  id: string;
  name: string;
  role: 'student' | 'instructor';
  createdAt: number;
}

// Escalation Profile
interface EscalationProfile {
  id: 'fast-escalator' | 'slow-escalator' | 'adaptive-escalator' | 'explanation-first';
  thresholds: { escalate: number; aggregate: number; };
  triggers: { timeStuck: number; rungExhausted: number; repeatedError: number; };
}

// HDI Result
interface HDIResult {
  hdi: number;
  level: 'low' | 'medium' | 'high';
  components: {
    hpa: number;   // Hints Per Attempt
    aed: number;   // Average Escalation Depth
    er: number;    // Explanation Rate
    reae: number;  // Repeated Error After Explanation
    iwh: number;   // Improvement Without Hint
  };
}
```

## License

MIT License - see [LICENSE](LICENSE)

## Research

This project explores **dynamic instructional assembly** — content that emerges from learner interaction data. See [docs/runbooks/progress.md](docs/runbooks/progress.md) for the research vision and architecture details.

### Current Research Components (Week 5)

| Component | Status | Description |
|-----------|--------|-------------|
| Escalation Profiles | ✅ Complete | Fast/Slow/Adaptive/Explanation-first profiles |
| Multi-Armed Bandit | ✅ Complete | Thompson sampling with per-learner bandits |
| HDI Calculator | ✅ Complete | 5-component dependency index |
| Profile-Aware Escalation | ✅ Complete | Integration with guidance ladder |
| Event Logging | ✅ Complete | All 9 Week 5 event types logged |

---

*Last updated: 2026-02-28*  
*Project Status: Week 5 Complete — 403 total tests passing*
