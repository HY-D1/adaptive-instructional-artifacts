# SQL-Adapt

An adaptive SQL learning platform that personalizes hints, explanations, and study notes based on each student's mistakes and progress.

Students practice SQL problems with real-time feedback. When they struggle, the system escalates support from quick hints to full explanations — then saves those explanations into a personal textbook. Instructors monitor progress across their class. Researchers export interaction traces for analysis.

**Live at:** [adaptive-instructional-artifacts.vercel.app](https://adaptive-instructional-artifacts.vercel.app)

---

## Quick Start

```bash
# Prerequisites: Node.js 22+
npm install
npm run dev              # Frontend only (localStorage mode)
npm run dev:full         # Frontend + backend (Neon PostgreSQL)
```

Open [http://localhost:5173](http://localhost:5173). For backend mode, copy `.env.example` files:

```bash
cp apps/web/.env.example apps/web/.env.local
cp apps/server/.env.example apps/server/.env.local
```

See [docs/deployment/ENVIRONMENT.md](docs/deployment/ENVIRONMENT.md) for variable reference.

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

| Layer | Tech | Purpose |
|-------|------|---------|
| **Frontend** | Vite + React + TypeScript | Student practice, instructor dashboard, textbook |
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

## Deployment

Two Vercel projects:

1. **Frontend** — `npm run build` → `dist/app/`
2. **Backend** — `apps/server/` → Vercel Functions

```bash
npm run build            # Build frontend
npm run server:build     # Build backend
npm run integrity:scan   # Pre-deploy verification
```

See [docs/deployment/DEPLOYMENT.md](docs/deployment/DEPLOYMENT.md) for step-by-step instructions.

---

## Testing

```bash
npm run test:unit                    # Vitest unit tests (~1800 tests)
npm run test:e2e                     # Playwright E2E tests (~160 tests)
npm run test:e2e:weekly              # CI regression suite
npm run replay:gate                  # Replay determinism check
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

## Documentation

All documentation is in [`docs/`](docs/INDEX.md):

| Section | Contents |
|---------|----------|
| [Deployment](docs/deployment/) | Environment setup, deployment modes, Vercel configuration |
| [Architecture](docs/architecture/) | Data persistence, progress model, system design |
| [Research](docs/research/) | Experimental design, logging spec, escalation policies |
| [Operations](docs/operations/) | Current status, beta launch, incident response |

---

## Contributing

1. Read [docs/CONTRIBUTING.md](docs/CONTRIBUTING.md) for working rules
2. Keep changes minimal — no unrelated refactors
3. Run `npm run integrity:scan` before committing
4. Update `docs/CHANGELOG.md` with your changes
5. Suggest commits; do not auto-push

---

## Status

**Last verified:** 2026-04-10

| Metric | Value |
|--------|-------|
| Unit tests | 1,800+ passing |
| E2E tests | 160+ passing |
| Build time | 2.7s |
| Production | Live on Vercel |
| Students | 259 enrolled across 3 sections |
| Interactions | 120,000+ events in Neon |

---

## License

MIT — see [LICENSE](LICENSE)