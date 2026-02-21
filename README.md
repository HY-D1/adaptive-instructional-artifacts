# SQL-Adapt Learning System

An adaptive SQL learning environment where students practice SQL problems with personalized hints and build their own textbook, while instructors monitor progress and analyze learning patterns.

![TypeScript](https://img.shields.io/badge/TypeScript-5.8-blue)
![React](https://img.shields.io/badge/React-18.3-61DAFB)
![Vite](https://img.shields.io/badge/Vite-6.4-646CFF)
![Tests](https://img.shields.io/badge/Tests-221%2B%20passing-success)
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

**Security:**
- Passcode-protected instructor access (`TeachSQL2024`)
- Role-based route protection
- Session persistence across browser tabs

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
│   │   │   ├── lib/          # Business logic (storage, orchestrator)
│   │   │   ├── data/         # Static data (problems, SQL-Engage)
│   │   │   └── hooks/        # Custom React hooks (useUserRole, etc.)
│   │   └── tests/            # Playwright E2E tests (221+ tests)
│   └── vite.config.ts
├── scripts/               # Utility scripts (replay, metrics)
├── docs/                  # Documentation
│   ├── README.md          # Documentation index
│   ├── progress.md        # Architecture and milestones
│   ├── weekly-progress.md # Active checkpoint log
│   └── week3-*.md         # Week 3 deliverables reference
└── dist/                  # Build outputs
```

## Documentation

| Document | Purpose |
|----------|---------|
| [docs/README.md](docs/README.md) | Documentation index and navigation |
| [docs/progress.md](docs/progress.md) | Architecture, milestones, research vision |
| [docs/weekly-progress.md](docs/weekly-progress.md) | Active checkpoint log (every task) |
| [docs/week3-report.md](docs/week3-report.md) | Week 3 deliverables reference |

## Testing

The project has **221+ E2E tests** covering:

- **Bug Regression**: 87 tests (critical, high, medium priority)
- **Week 4 Features**: 31 tests (role-based auth)
- **Week 3 Features**: 99 tests (guidance ladder, source grounding, textbook)
- **Data Integrity**: 46 tests (event logging, validation)

Run tests with:
```bash
npm run test:e2e:weekly
```

## License

MIT License - see [LICENSE](LICENSE)

## Research

This project explores **dynamic instructional assembly** — content that emerges from learner interaction data. See [docs/progress.md](docs/progress.md) for the research vision and architecture details.
