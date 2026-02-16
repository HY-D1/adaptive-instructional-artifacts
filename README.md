# SQL-Adapt: Adaptive SQL Learning Lab

An intelligent SQL learning environment that adapts to your mistakes, providing personalized hints, explanations, and a growing textbook of your learning journey.

![TypeScript](https://img.shields.io/badge/TypeScript-5.8-blue)
![React](https://img.shields.io/badge/React-18.3-61DAFB)
![Vite](https://img.shields.io/badge/Vite-6.3-646CFF)
![License](https://img.shields.io/badge/License-MIT-green)

## 🎯 What It Does

SQL-Adapt is a research prototype for adaptive SQL instruction:

- **Practice** SQL problems with immediate feedback
- **Get Hints** - 3-level progressive hint system (HintWise)
- **Auto-Escalate** to explanations when hints aren't enough
- **Build Your Textbook** - automatically generated notes from your struggles
- **Track Coverage** - visual concept mastery dashboard
- **Research Mode** - policy comparison and interaction analysis

## 🚀 Quick Start

### Prerequisites

- **Node.js** 18+ and **npm**
- **Git**

### Installation

#### macOS

```bash
# Clone repository
git clone <repo-url>
cd adaptive-instructional-artifacts

# Install dependencies
npm install

# Install Playwright browsers (for testing)
npx playwright install chromium

# Start development server
npm run dev
```

#### Windows

```powershell
# Clone repository
git clone <repo-url>
cd adaptive-instructional-artifacts

# Install dependencies
npm install

# Install Playwright browsers (for testing)
npx playwright install chromium

# Start development server
npm run dev
```

Open [http://localhost:4173](http://localhost:4173) in your browser.

## 🏗️ Interface Hierarchy

```
┌─────────────────────────────────────────────────────────────┐
│                    RootLayout (Navigation)                  │
├──────────────┬──────────────────────────────┬───────────────┤
│   Practice   │         My Textbook          │    Research   │
│      /       │           /textbook          │   /research   │
├──────────────┴──────────────────────────────┴───────────────┤
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              LearningInterface                      │   │
│  │  ┌───────────────┐    ┌─────────────────────────┐  │   │
│  │  │  SQLEditor    │    │      HintSystem         │  │   │
│  │  │  (Monaco)     │    │  ┌───────────────────┐  │  │   │
│  │  │               │    │  │  Hint Ladder 1-3  │  │  │   │
│  │  │  ┌─────────┐  │    │  │  → Escalation     │  │  │   │
│  │  │  │ Schema  │  │    │  │  → Explanation    │  │  │   │
│  │  │  │ Results │  │    │  └───────────────────┘  │  │   │
│  │  │  └─────────┘  │    └─────────────────────────┘  │   │
│  │  └───────────────┘                                 │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────┐   │
│  │                 TextbookPage                        │   │
│  │         (AdaptiveTextbook + Notes)                  │   │
│  └─────────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────┐   │
│  │              ResearchDashboard                      │   │
│  │  ┌───────────┐ ┌───────────┐ ┌─────────────────┐   │   │
│  │  │  Stats    │ │  Charts   │ │  Export/Import  │   │   │
│  │  └───────────┘ └───────────┘ └─────────────────┘   │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

## 📦 Project Structure

```
.
├── apps/web/               # Main React application
│   ├── src/
│   │   ├── components/     # UI components
│   │   ├── pages/          # Route pages
│   │   ├── lib/            # Business logic
│   │   └── data/           # SQL problems & datasets
│   └── tests/              # Playwright E2E tests
├── scripts/                # Utility scripts
├── docs/                   # Documentation
└── dist/                   # Build outputs
```

## 🧪 Testing

```bash
# Run all E2E tests
npm run test:e2e

# Run Week 2 smoke tests only
npm run test:e2e:week2

# Run with UI
npm run test:e2e:ui
```

## 🤖 Optional: Local LLM Setup (Ollama)

For live explanation generation:

**macOS:**
```bash
brew install ollama
brew services start ollama
ollama pull qwen2.5:1.5b-instruct
```

**Windows:**
```powershell
winget install Ollama.Ollama
ollama serve
ollama pull qwen2.5:1.5b-instruct
```

*If Ollama is not running, the app falls back to deterministic content generation.*

## 📚 Documentation

- [docs/README.md](docs/README.md) - Documentation index
- [docs/week2_progress.md](docs/week2_progress.md) - Week 2 implementation details
- [docs/week2-demo.md](docs/week2-demo.md) - Demo walkthrough

## 🛠️ Technology Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | React 18 + TypeScript + Tailwind CSS |
| **Build** | Vite 6 |
| **UI Components** | Radix UI + shadcn/ui |
| **SQL Engine** | sql.js (SQLite WASM) |
| **Editor** | Monaco Editor |
| **Charts** | Recharts |
| **Testing** | Playwright |
| **LLM** | Ollama (local) |

## 🔒 Security

- No API keys committed
- Local-only processing (no external APIs)
- SQL execution in WebAssembly sandbox
- XSS protection via DOMPurify

## 📄 License

MIT License - see [LICENSE](LICENSE)

---

**Research Project**: Adaptive Instructional Artifacts for SQL Learning
