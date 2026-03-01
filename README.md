# SQL-Adapt Learning System

An adaptive SQL learning environment where students practice SQL problems with personalized hints and build their own textbook, while instructors monitor progress and analyze learning patterns.

![TypeScript](https://img.shields.io/badge/TypeScript-5.8-blue)
![React](https://img.shields.io/badge/React-18.3-61DAFB)
![Vite](https://img.shields.io/badge/Vite-6.4-646CFF)
![Tests](https://img.shields.io/badge/Tests-265%20passing-success)
![License](https://img.shields.io/badge/License-MIT-green)

## Features

**For Students:**
- Practice SQL problems with immediate feedback
- Progressive hints (3 levels) that adapt to your mistakes
- Build a personal textbook from your learning journey
- Chat with your accumulated materials (Ask My Textbook)

**For Instructors:**
- Monitor student progress and concept coverage
- View learning analytics and traces
- Export session data for analysis
- Replay learner interactions with different policies

**Adaptive Personalization (Week 5):**
- Escalation profiles (Fast/Slow/Adaptive) based on learner behavior
- Multi-armed bandit with Thompson sampling for optimal strategy selection
- Hint Dependency Index (HDI) with 5 components to measure learner independence
- Profile-aware escalation in the guidance ladder

**Security:**
- Passcode-protected instructor access (`TeachSQL2024`)
- Role-based route protection
- Session persistence across browser tabs

## How It Works

### 🪜 Guidance Ladder (L1 → L2 → L3 → LLM)

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

### 🔄 Adaptive Orchestrator

```
Error Pattern ──► SQL-Engage Lookup ──► Subtype Identification
                                              │
                    ┌─────────────────────────┘
                    ▼
┌─────────────────────────────────────────────────────────────┐
│  Escalation Profiles (Week 5)                                 │
│  • fast-escalator: 2 errors → explanation (aggressive)        │
│  • slow-escalator: 5 errors → explanation (conservative)      │
│  • adaptive: Dynamic threshold based on learner history       │
│  • explanation-first: Skip hints, go straight to explanation  │
└─────────────────────────────────────────────────────────────┘
```

### 📊 Multi-Armed Bandit (Week 5)

```
┌─────────────────────────────────────────────────────────────┐
│  Thompson Sampling Bandit                                     │
│  • 4 arms: aggressive, conservative, explanation-first        │
│  • Per-learner bandit instances                               │
│  • Automatic strategy optimization                            │
│  • Profile assignment with assignment strategy                │
└─────────────────────────────────────────────────────────────┘
```

### 📚 Dynamic Textbook Assembly

Every LLM-generated explanation becomes a **Textbook Unit**:
- **Content**: Markdown with SQL syntax highlighting
- **Provenance**: Links to source interactions + PDF citations
- **Concepts**: Auto-tagged with SQL-Engage concept IDs
- **Deduplication**: Hash-based merging, timestamp updates

## Quick Start

### Prerequisites
- [Node.js](https://nodejs.org/) 18+ (LTS recommended)
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
2. Enter the passcode when prompted: `TeachSQL2024`
3. View student analytics, concept coverage, and learning traces
4. Export data for further analysis

## Development

```bash
# Build for production
npm run build

# Run all tests
npm run test:e2e:weekly

# Run unit tests
npm run test:unit

# Generate demo artifacts
npm run demo:weekly

# Run Week 3 acceptance gate
npm run gate:week3:acceptance
```

## Project Structure

```
├── apps/web/              # Main Vite React application
│   ├── src/
│   │   ├── app/
│   │   │   ├── components/   # React components (HintSystem, etc.)
│   │   │   ├── pages/        # Route pages (StartPage, LearningInterface, etc.)
│   │   │   ├── lib/          # Business logic (storage, orchestrator, bandit, HDI)
│   │   │   ├── data/         # Static data (problems, SQL-Engage)
│   │   │   └── hooks/        # Custom React hooks (useUserRole, etc.)
│   │   └── tests/            # Playwright E2E tests (138 @weekly tests)
│   └── vite.config.ts
├── scripts/               # Utility scripts (replay, metrics)
├── docs/                  # Documentation
│   ├── README.md          # Documentation index
│   ├── runbooks/          # Active operational docs
│   │   ├── progress.md    # Architecture and milestones
│   │   └── weekly-progress.md # Active checkpoint log
│   ├── research/          # Research and design docs
│   └── archive/           # Historical docs
└── dist/                  # Build outputs
```

## Documentation

| Document | Purpose |
|----------|---------|
| [docs/README.md](docs/README.md) | Documentation index and navigation |
| [docs/runbooks/progress.md](docs/runbooks/progress.md) | Architecture, milestones, research vision |
| [docs/runbooks/weekly-progress.md](docs/runbooks/weekly-progress.md) | Active checkpoint log (every task) |
| [docs/research/HDI.md](docs/research/HDI.md) | Hint Dependency Index specification |
| [docs/research/MULTI_ARMED_BANDIT.md](docs/research/MULTI_ARMED_BANDIT.md) | Bandit algorithm design |
| [docs/research/ESCALATION_POLICIES.md](docs/research/ESCALATION_POLICIES.md) | Escalation profile design |
| [docs/archive/archive-week3.md](docs/archive/archive-week3.md) | Week 3 deliverables reference |

## Testing

The project has **265 unit tests** and **138 E2E tests** covering:

- **Bug Regression**: 87 tests (critical, high, medium priority)
- **Week 5 Components**: 118 tests (HDI: 43, Bandit: 45, Profiles: 30)
- **Week 4 Features**: 31 tests (role-based auth)
- **Week 3 Features**: 20 tests (guidance ladder, source grounding, textbook)
- **Data Integrity**: 46+ tests (event logging, validation)

Run tests with:
```bash
# E2E tests
npm run test:e2e:weekly

# Unit tests
npm run test:unit
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
