# SQL-Adapt

[![Vercel](https://img.shields.io/badge/Vercel-Live-black?logo=vercel)](https://adaptive-instructional-artifacts.vercel.app)
[![Node.js](https://img.shields.io/badge/Node.js-22+-green?logo=node.js)](https://nodejs.org/)
[![React](https://img.shields.io/badge/React-18-61dafb?logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue?logo=typescript)](https://www.typescriptlang.org/)

An adaptive SQL learning platform that personalizes hints, explanations, and study notes based on each student's mistakes and progress.

Students practice SQL problems with real-time feedback. When they struggle, the system escalates support from quick hints to full explanations — then saves those explanations into a personal textbook. Instructors monitor progress across their class. Researchers export interaction traces for analysis.

**Live:** [adaptive-instructional-artifacts.vercel.app](https://adaptive-instructional-artifacts.vercel.app)

---

## Quick Start

```bash
# Prerequisites: Node.js 22+ (see .nvmrc)
npm install
cd apps/server && npm install

# Frontend only — localStorage mode, no backend needed
npm run dev

# Full stack — frontend + backend + Neon PostgreSQL
npm run dev:full
```

Open [http://localhost:5173](http://localhost:5173).

For full-stack mode, copy and configure environment variables first:

```bash
cp .env.example .env.local
cp apps/web/.env.example apps/web/.env.local
cp apps/server/.env.example apps/server/.env.local
```

See [HANDOFF.md](HANDOFF.md) for complete setup instructions.

---

## How It Works

```
Student attempts SQL → System checks answer
                          ↓
                    Wrong? → Hint (Level 1: nudge)
                          ↓
                    Still stuck? → Hint (Level 2: strategy)
                          ↓
                    Still stuck? → Full explanation + save to textbook
                          ↓
                    Solved → Track progress, update concept coverage
```

The system adapts based on 23 SQL error subtypes and 30 concepts from the SQL-Engage taxonomy. An LLM generates contextual explanations when available; deterministic templates provide fallback.

---

## Architecture

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Frontend** | Vite + React 18 + TypeScript | Student practice, instructor dashboard, textbook |
| **Backend** | Express on Vercel Functions | Auth, persistence, LLM proxy, research export |
| **Database** | Neon PostgreSQL | Users, sessions, interactions, textbook units |
| **SQL Engine** | sql.js (WebAssembly) | In-browser SQL execution for practice problems |
| **LLM** | Groq (via backend proxy) | Contextual hint/explanation generation |
| **Offline** | localStorage + sync queue | Works without backend, syncs when available |

### Repository Layout

```
apps/web/           → Vite + React frontend
apps/server/        → Express backend (Vercel-compatible)
docs/               → Project documentation
tests/e2e/          → Playwright end-to-end tests
tests/unit/         → Additional unit tests
scripts/            → Verification, audit, and research scripts
```

---

## Key Features

**For Students**
- 32 SQL problems across beginner → advanced difficulty
- Progressive hint escalation (3 levels) that adapts to your errors
- Personal "My Textbook" that accumulates explanations from your learning
- Cross-device progress persistence via Neon backend

**For Instructors**
- Class dashboard with student progress and concept coverage
- Section-based enrollment with signup codes
- Student textbook preview
- Research data export

**For Researchers**
- Immutable interaction event log with 31 event types
- Counterfactual replay across escalation strategies
- Multi-armed bandit for strategy optimization
- Hint Dependency Index (HDI) for measuring help-seeking behavior

---

## Deployment

Two Vercel projects + Neon PostgreSQL:

1. **Frontend** — `npm run build` → `dist/app/`
2. **Backend** — `apps/server/` → Vercel Functions

```bash
npm run build            # Build frontend
npm run server:build     # Build backend
npm run integrity:scan   # Pre-deploy verification
```

See [docs/handoff/DEPLOYMENT.md](docs/handoff/DEPLOYMENT.md) for step-by-step instructions.

---

## Testing

```bash
npm run test:unit                    # Vitest unit tests
npm run test:e2e                     # Playwright E2E tests
npm run test:e2e:weekly              # CI regression suite
npm run replay:gate                  # Replay determinism check
```

---

## Documentation

| Document | What's In It |
|----------|-------------|
| [HANDOFF.md](HANDOFF.md) | **Start here.** Master handoff document with architecture overview, setup, and links |
| [docs/handoff/FRONTEND.md](docs/handoff/FRONTEND.md) | React app, routing, state management, components, build |
| [docs/handoff/BACKEND.md](docs/handoff/BACKEND.md) | Express API, routes, middleware, auth, LLM proxy |
| [docs/handoff/DATABASE.md](docs/handoff/DATABASE.md) | Neon schema, tables, indexes, migrations |
| [docs/handoff/DEPLOYMENT.md](docs/handoff/DEPLOYMENT.md) | Vercel config, CI/CD, env vars, two-project setup |
| [docs/deployment/MODES.md](docs/deployment/MODES.md) | Local vs hosted vs full-stack capability matrix |
| [docs/architecture/PERSISTENCE.md](docs/architecture/PERSISTENCE.md) | Where each piece of data lives |
| [docs/research/](docs/research/) | Research instrumentation and experimental design |

---

## Contributing

1. Read [docs/CONTRIBUTING.md](docs/CONTRIBUTING.md) for working rules
2. Keep changes minimal — no unrelated refactors
3. Run `npm run integrity:scan` before committing
4. Update `docs/CHANGELOG.md` with your changes
5. Suggest commits; do not auto-push

---

## License

MIT — see [LICENSE](LICENSE)
