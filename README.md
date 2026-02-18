# SQL-Adapt: Adaptive SQL Learning Lab

An intelligent SQL learning environment that adapts to your mistakes, providing personalized hints, explanations, and a growing textbook of your learning journey.

![TypeScript](https://img.shields.io/badge/TypeScript-5.8-blue)
![React](https://img.shields.io/badge/React-18.3-61DAFB)
![Vite](https://img.shields.io/badge/Vite-6.3-646CFF)
![Tests](https://img.shields.io/badge/Tests-159%20passing-success)
![License](https://img.shields.io/badge/License-MIT-green)

## 🎯 Features

- **Practice** SQL problems with immediate feedback
- **Guidance Ladder** - 3-level progressive help (Rung 1→2→3)
- **Ask My Textbook** - Chat with your accumulated learning materials
- **View Sources** - See PDF passages grounding the hints
- **Auto-Escalate** to explanations when hints aren't enough
- **Build Your Textbook** - Automatically generated notes from your struggles
- **Upload PDFs** - Import reference materials for personalized hints
- **Replay & Metrics** - Export sessions and analyze learning patterns

## 🚀 Quick Start

```bash
# Clone and install
git clone <repo-url>
cd adaptive-instructional-artifacts
npm install

# Install Playwright browsers for testing
npx playwright install chromium

# Start development server
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

## 📁 Project Structure

```
apps/web/
├── src/
│   ├── components/      # UI components (HintSystem, AskMyTextbookChat, etc.)
│   ├── pages/           # Route pages (Practice, Textbook, Research)
│   ├── lib/             # Business logic (guidance-ladder, storage, retrieval)
│   └── data/            # SQL problems, concept registry, alignment maps
├── tests/               # Playwright E2E tests (159 tests)
└── public/              # Static assets

scripts/                 # Utility scripts (replay-metrics, PDF indexing)
docs/                    # Documentation (see docs/README.md)
dist/                    # Build outputs
```

## 🔄 How It Works

### Guidance Ladder Flow

```
SQL Error or Wrong Results
    ↓
normalizeSqlErrorSubtype() → error_subtype
    ↓
┌──────────────────────────────────────────┐
│         Guidance Ladder (Rung 1→2→3)     │
├──────────────────────────────────────────┤
│ Rung 1: Micro-hint (~100 chars)          │
│ Rung 2: Explanation with source grounding│
│ Rung 3: Reflective note → My Textbook    │
└──────────────────────────────────────────┘
    ↓ (Rung 3 reached)
Generate Unit → Upsert to My Textbook
```

### Ask My Textbook Chat

Ask questions grounded in your learning history:
- "Explain my last error" — Actionable fix based on recent mistakes
- "Show a minimal example" — Clean SQL pattern from your textbook
- "What concept is this?" — Current problem's key concepts
- "Give me a hint" — Contextual guidance

### Key Components

| Component | Purpose |
|-----------|---------|
| `guidance-ladder.ts` | State machine for Rung 1→2→3 progression |
| `AskMyTextbookChat.tsx` | Sidebar chat with source grounding |
| `SourceViewer.tsx` | Modal for viewing PDF passages |
| `retrieval-bundle.ts` | Assembles relevant content for responses |
| `textbook-units.ts` | Unit deduplication and upsert logic |
| `replay-metrics.mjs` | Offline analysis of learning sessions |

## 🧪 Testing

```bash
# Run all E2E tests
npm run test:e2e

# Run Week 2/3 tests
npm run test:e2e:weekly

# Run with UI
npm run test:e2e:ui

# Build verification
npm run build
```

## 📚 Documentation

| File | Purpose |
|------|---------|
| [docs/README.md](docs/README.md) | Documentation index & Week 3 deliverables |
| [docs/week3-report.md](docs/week3-report.md) | Week 3 shipped features, schema, metrics |
| [docs/week3-demo.md](docs/week3-demo.md) | 3-5 minute demo script |
| [docs/progress.md](docs/progress.md) | Architecture & research vision |
| [AGENTS.md](AGENTS.md) | Agent workflow guidelines (local only) |

## 🛠️ Technology Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | React 18 + TypeScript + Tailwind CSS |
| **Build** | Vite 6 |
| **UI Components** | Radix UI + shadcn/ui |
| **SQL Engine** | sql.js (SQLite WASM) |
| **Editor** | Monaco Editor |
| **Testing** | Playwright |
| **PDF Processing** | pdftotext + custom chunker |

## 📊 Week 3 Status

**All D0-D10 Deliverables Complete** (2026-02-17)

| Deliverable | Status | Description |
|-------------|--------|-------------|
| D0 | ✅ | Naming cleanup (HintWise → Guidance Ladder) |
| D1 | ✅ | 30 verified concepts in registry |
| D2-D3 | ✅ | Source indexing + alignment maps |
| D4-D6 | ✅ | Ladder state machine + LLM contracts |
| D7 | ✅ | Source viewer + Ask My Textbook chat |
| D8-D9 | ✅ | Logging schema + replay metrics |
| D10 | ✅ | Demo package + report |

## 🔒 Security

- No API keys required
- Local-only processing
- SQL execution in WebAssembly sandbox

## 📄 License

MIT License - see [LICENSE](LICENSE)
