# Project Master Status

**Project**: Adaptive Instructional Artifacts (SQL)  
**Vision**: Automatic adaptive textbook that assembles instructional content dynamically from learner interactions  
**Last Updated**: 2026-02-16T16:20:00-08:00

---

## Research Vision

Traditional SQL learning relies on static textbooks or fixed hint sequences. This project explores **dynamic instructional assembly**—content that emerges from learner interaction data, delivered reflectively rather than as pre-authored chapters or real-time interruptions.

### Core Research Question

> How can instructional content for SQL learning be assembled and adapted dynamically from learner interaction patterns, error subtypes, and help-seeking behaviors?

### The "Automatic Textbook" Concept

An adaptive instructional artifact that:
- **Accumulates**: Gathers explanations, examples, summaries from learner struggles
- **Reorganizes**: Structures content by concept coverage and error patterns
- **Surfaces**: Delivers content on-demand when hints are insufficient
- **Personalizes**: Different learners see different content orderings and emphases

---

## 6 Core Research Components

### 1. Adaptive Content Orchestration

**Purpose**: Design escalation logic for instructional interventions

**Decision Points**:
| Condition | Action |
|-----------|--------|
| Early error, low retry | Remain at hint level (L1 → L2 → L3) |
| Hint threshold reached | Escalate to deeper explanation |
| Multiple related errors | Aggregate into reflective note |
| Concept gap identified | Suggest targeted review unit |

**Input Signals**:
- Error subtype (SQL-Engage taxonomy)
- Retry count and timing
- Hint request frequency
- Abstracted engagement indicators

**Implementation**: `apps/web/src/app/lib/adaptive-orchestrator.ts`

---

### 2. Automatic Textbook Prototype

**Purpose**: Build the core dynamic assembly system

**Features**:
- **Instructional Unit Assembly**: Explanations, examples, summaries generated on-demand
- **My Notes / My Textbook**: Personalized view per learner with accumulated content
- **Concept Coverage Tracking**: Implicit progress mapping through SQL-Engage nodes
- **Content Deduplication**: Smart aggregation when similar errors recur

**Key Insight**: Instructional content is not pre-authored but emerges from interaction traces.

**Implementation**:
- UI: `apps/web/src/app/pages/TextbookPage.tsx`
- Logic: `apps/web/src/app/lib/content-generator.ts`
- Storage: `apps/web/src/app/lib/storage.ts`

---

### 3. HintWise Integration

**Purpose**: Leverage HintWise as foundational instructional layer

**Integration Points**:
- Hints as **lowest-level instructional units**
- Escalation policies define when hints insufficient
- HintWise outputs feed into textbook assembly pipeline
- 3-level hint ladder (L1 subtle → L2 guiding → L3 explicit)

**Policy**: After L3 hint + continued failure → escalate to explanation

**Implementation**: `apps/web/src/app/lib/adaptive-orchestrator.ts` (escalation rules)

---

### 4. SQL-Engage Knowledge Backbone

**Purpose**: Ground adaptations in validated concept taxonomy

**Functions**:
- **Concept Node Definitions**: 23 error subtypes mapped to learning concepts
- **Error-to-Concept Mapping**: `subtypeToConceptMap` links errors to knowledge gaps
- **Template Retrieval**: Validated feedback templates per subtype

**Policy Version**: `sql-engage-index-v3-hintid-contract`

**Implementation**: `apps/web/src/app/data/sql-engage.ts`

---

### 5. Controlled LLM Use

**Purpose**: Generate explanations with constraints and grounding

**Principles**:
- **Retrieval-first, generation-second**: RAG before LLM call
- **Templated prompts**: Constrained tone and scope
- **No free-form generation**: Structured outputs only
- **Fallback deterministic content**: When LLM unavailable

**Architecture**:
1. Retrieve relevant chunks (PDF index, SQL-Engage templates)
2. Assemble retrieval bundle with citations
3. LLM generates explanation grounded in retrieved content
4. Output constrained to explanation + concept tags

**Implementation**: `apps/web/src/app/lib/content-generator.ts`, `apps/web/src/app/lib/retrieval-bundle.ts`

---

### 6. Offline Replay and Comparison

**Purpose**: Generate experimental evidence for publishable claims

**Capabilities**:
- **Trace Replay**: Re-run learner interaction traces through different policies
- **Counterfactual Comparison**: Same trace, different escalation strategies
- **Strategy Variants**:
  - `hint-only`: Never escalate, stay at hints only
  - `adaptive-low`: Escalate after 5 errors
  - `adaptive-medium`: Escalate after 3 errors (default)
  - `adaptive-high`: Escalate after 2 errors

**Valid Claims**:
- ✓ "Under Policy X, the system would escalate here"
- ✓ "Policy Y generates notes for subtypes A, B, C"
- ✗ "Policy Z improves learning outcomes" (requires controlled study)

**Implementation**: `scripts/replay-toy.mjs`, `scripts/replay-real.mjs`

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Frontend (React)                      │
├─────────────────────────────────────────────────────────────┤
│  Practice View      Textbook View      Research Dashboard   │
│  ├─ Monaco Editor   ├─ Note cards      ├─ Session export    │
│  ├─ SQL Executor    ├─ Concept map     ├─ Policy replay     │
│  └─ Hint System     └─ Coverage chart  └─ LLM health       │
├─────────────────────────────────────────────────────────────┤
│                     Adaptive Orchestrator                    │
│  ├─ Hint selection (SQL-Engage lookup)                      │
│  ├─ Escalation decisions (thresholds)                       │
│  └─ Note aggregation (concept dedup)                        │
├─────────────────────────────────────────────────────────────┤
│                    Content Generation                        │
│  ├─ LLM client (Ollama)                                     │
│  ├─ Retrieval bundle (RAG)                                  │
│  └─ Fallback deterministic content                          │
├─────────────────────────────────────────────────────────────┤
│                      Persistence Layer                       │
│  ├─ LocalStorage (interactions, profile, textbook)          │
│  └─ JSON Export (research traces)                           │
└─────────────────────────────────────────────────────────────┘
```

---

## Policy Versions

| Component | Version | Source File |
|-----------|---------|-------------|
| SQL-Engage Policy | `sql-engage-index-v3-hintid-contract` | `apps/web/src/app/data/sql-engage.ts` |
| Orchestrator Semantics | `orchestrator-auto-escalation-variant-v2` | `apps/web/src/app/lib/adaptive-orchestrator.ts` |
| Export Policy | `weekly-export-sanitize-v1` | `apps/web/src/app/lib/storage.ts` |
| Replay Harness | `toy-replay-harness-v3` | `scripts/replay-toy.mjs` |

---

## Directory Structure

```
/Users/harrydai/Desktop/Personal Portfolio/adaptive-instructional-artifacts/
├── apps/
│   └── web/                      # Main Vite React application
│       ├── src/
│       │   ├── app/
│       │   │   ├── components/   # React components
│       │   │   ├── pages/        # Route pages
│       │   │   ├── lib/          # Business logic
│       │   │   ├── data/         # Static data
│       │   │   ├── types/        # TypeScript types
│       │   │   └── prompts/      # LLM prompt templates
│       │   ├── server/           # Server-side utilities
│       │   └── main.tsx          # App entry point
│       ├── tests/                # Playwright E2E tests
│       └── vite.config.ts        # Vite configuration
├── scripts/                      # Utility scripts (replay, indexing)
├── dist/                         # Build outputs
├── docs/                         # Documentation
│   ├── README.md                 # Master index
│   ├── progress.md               # This file
│   └── weekly-progress.md         # Week 2 runbook
├── package.json
├── playwright.config.ts
└── AGENTS.md                     # Agent instructions
```

---

## Build Commands

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Run Weekly E2E tests
npm run test:e2e:weekly

# Generate demo artifacts
npm run demo:weekly

# Run toy replay
npm run replay:toy

# Check replay gate
npm run replay:gate

# Verify concept map coverage
npm run check:concept-map

# LLM health check
npm run llm:health:capture
```

---

## Milestones

| Milestone | Target | Status | Evidence |
|-----------|--------|--------|----------|
| **Week 2 MVP** | **2026-02-14** | **✅ Complete** | See [Week 2 Accomplishments](#week-2-accomplishments) below |
| Week 2 Demo Artifacts | 2026-02-14 | ✅ Complete | `dist/weekly-demo/export.json` |
| Concept Coverage Tracking | 2026-02-14 | ✅ Complete | Concept map visualization + 24 tests |
| Policy Comparison Dashboard | 2026-02-14 | ✅ Complete | A/B replay visualization + 14 tests |
| Policy Replay Validation | 2026-02-14 | ✅ Complete | `npm run replay:gate` |
| E2E Test Suite | 2026-02-14 | ✅ Complete | 140 tests @weekly |
| Week 3-4 Enhancement | 2026-02-28 | 📋 Planned | Full replay, LLM refinements |
| Week 5-6 Analysis | 2026-03-14 | 📋 Planned | Comparative results, publication |

---

## Week 2 Accomplishments

**Status**: ✅ Complete (2026-02-16)

### Features Delivered

| Feature | Description | Tests |
|---------|-------------|-------|
| **Hint Ladder System** | 3-level progressive hints (L1→L2→L3) with SQL-Engage integration | 20 tests |
| **Auto-Escalation** | After L3 hint, automatically escalate to explanation generation | 8 tests |
| **My Notes / My Textbook** | Dynamic accumulation of personalized instructional notes | 24 tests |
| **Concept Coverage Tracking** | Visual concept map showing mastered vs pending concepts | 24 tests |
| **Policy Comparison Dashboard** | Research view for A/B policy comparison with replay | 14 tests |
| **Hint Persistence** | Hints restored when navigating between pages/problems | 4 tests |
| **Problem Correctness** | Track solved status with expected result validation | 6 tests |
| **PDF RAG Integration** | Source passages from textbook embedded in hints | 12 tests |
| **Data Integrity** | localStorage corruption handling, event validation | 46 tests |
| **LLM Integration** | Retrieval-grounded explanation generation with fallback | 8 tests |

### Test Coverage

- **Total**: 140 E2E tests across 15 test files
- **Tag**: `@weekly` for all Week 2 scope tests
- **Renamed**: `week2-*` → `weekly-*` (test files, scripts, tags)

### Key Commits

```
306cb4a docs(AGENTS): add progress update policy and docs reference
e551ff7 docs: add AGENTS.md with project status and guidelines  
17391a7 feat: improve PDF retrieval with SQL keywords
1a3b268 feat: persist hints when navigating between pages
16e3a5c feat: track problem correctness and show solved status
d2eb3ba feat: add expandable PDF source passages to hints
```

### Artifacts

- Demo export: `dist/weekly-demo/export.json`
- Screenshots: `dist/weekly-demo/*.png`
- Test reports: `test-results/`

### Technical Debt Resolved

- Problem validation: All 32 problems now have `expectedResult` arrays
- Export policy: `weekly-export-sanitize-v1` with session sanitization
- Error boundaries: Added to prevent total app crashes
- Resource cleanup: Blob URL, FileReader, Monaco editor disposal

### Next Phase (Week 3-4)

1. Full replay system with counterfactual simulation
2. LLM integration refinements (prompt optimization)
3. Experimental validation setup
4. Performance optimization

---

## Expected Outcomes

By project completion:

1. **Working Automatic Textbook Prototype**
   - Dynamic content assembly from learner traces
   - Personalized "My Notes" with concept tracking
   - Reflective (not interruptive) delivery

2. **Experimental Results**
   - Comparative analysis: hint-only vs adaptive strategies
   - Replay-based evidence for policy effectiveness
   - Concept coverage evolution metrics

3. **Publication Package**
   - System architecture figures
   - Method descriptions for 6 core components
   - Experimental design and results
   - Validated claims about instructional adaptation

---

## Research Guardrails

### Valid Claims (Evidence-Supported)
- "Under Policy X, the system would escalate at interaction N"
- "Policy Y generates explanatory notes for subtypes A, B, C"
- "Concept coverage differs between hint-only and adaptive conditions"

### Invalid Claims (Require Additional Study)
- "Learners improve more with adaptive hints" (needs pre/post assessment)
- "Policy Z is educationally superior" (needs controlled experiment)
- "Students prefer adaptive content" (needs user study)

### Offline Replay Limitations
- Shows **what the system would do**, not learning outcomes
- Enables **policy behavior comparison**, not causal effectiveness claims
- Supports **system development**, not educational evaluation

---

## Canonical Documentation

- **Master Index**: `docs/README.md`
- **Project Master**: `docs/progress.md` (this file)
- **Week 2 Runbook**: `docs/weekly-progress.md`
- **Agent Instructions**: `AGENTS.md`

---

## Notes

- All data is stored client-side (LocalStorage)
- No API keys or external services required
- Ollama runs locally for LLM features
- PDF processing requires Poppler (`pdftotext`)
- Research evidence generated through offline replay, not live user studies
