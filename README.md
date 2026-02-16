# SQL-Adapt: Adaptive SQL Learning Lab

An intelligent SQL learning environment that adapts to your mistakes, providing personalized hints, explanations, and a growing textbook of your learning journey.

![TypeScript](https://img.shields.io/badge/TypeScript-5.8-blue)
![React](https://img.shields.io/badge/React-18.3-61DAFB)
![Vite](https://img.shields.io/badge/Vite-6.3-646CFF)
![License](https://img.shields.io/badge/License-MIT-green)

## 🎯 Features

- **Practice** SQL problems with immediate feedback
- **Get Hints** - 3-level progressive hint system (HintWise)
- **View Sources** - See PDF passages used to generate hints
- **Auto-Escalate** to explanations when hints aren't enough
- **Build Your Textbook** - automatically generated notes from your struggles
- **Upload PDFs** - Import reference materials for personalized hints

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

Open [http://localhost:4173](http://localhost:4173) in your browser.

## 📁 Project Structure

```
apps/web/
├── src/
│   ├── components/      # UI components (HintSystem, AdaptiveTextbook, etc.)
│   ├── pages/           # Route pages (Practice, Textbook, Research)
│   ├── lib/             # Business logic (storage, retrieval-bundle, PDF processing)
│   └── data/            # SQL problems & SQL-Engage dataset
└── tests/               # Playwright E2E tests

scripts/                 # Utility scripts (PDF indexing, analysis)
docs/                    # Documentation
dist/                    # Build outputs (PDF storage, index)
```

## 📖 User Guide

### Practice Mode
1. Write SQL queries in the editor
2. Run queries to get immediate feedback
3. Request hints when stuck (up to 3 levels)
4. Click **"View source passages"** to see which PDF content informed the hint
5. Escalate to explanations for deeper understanding

### My Textbook
- Automatically generated notes from your learning sessions
- Provenance tracking - see which sources contributed to each note
- Concept coverage visualization

### Research Dashboard
- Upload PDFs directly to build a retrieval index
- Track learning analytics and progress
- Export/Import learning data

## 🧪 Testing

```bash
# Run all E2E tests
npm run test:e2e

# Run specific test suites
npx playwright test apps/web/tests/week2-hint-ladder.spec.ts
npx playwright test apps/web/tests/pdf-upload.spec.ts
npx playwright test apps/web/tests/hint-source-passages.spec.ts

# Run with UI
npm run test:e2e:ui
```

## 📚 Documentation

- [docs/README.md](docs/README.md) - Documentation index

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

## 🔒 Security

- No API keys required
- Local-only processing
- SQL execution in WebAssembly sandbox

## 📄 License

MIT License - see [LICENSE](LICENSE)
