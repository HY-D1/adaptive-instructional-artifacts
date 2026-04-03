# SQL-Adapt

An adaptive learning environment for SQL that personalizes hints, explanations, and a dynamic "My Textbook" based on each learner's interaction traces.

SQL-Adapt combines structured SQL practice with an intelligent orchestration layer. As students work through problems, the system observes their errors, help-seeking behavior, and concept coverage, then adapts the level and type of support it provides — from concise micro-hints to full textbook-style explanations with source citations.

**Built for:** students learning SQL, instructors running supervised cohorts, and researchers analyzing learning traces.

---

## For Students

- **Practice SQL problems** with immediate execution feedback
- **Progressive hint escalation** that adapts to your mistakes
- **A personal textbook** that accumulates and organizes explanations from your learning journey
- **On-demand review** of concepts and mistakes through the adaptive notebook

## For Instructors

- **Monitor student progress** and concept coverage through a dedicated dashboard
- **View interaction traces** to understand individual and cohort learning patterns
- **Export research data** for offline analysis and evidence building
- **Run staged beta cohorts** with documented observation forms and telemetry audits

---

## Core Capabilities

| Capability | Description |
|------------|-------------|
| **Adaptive Practice Support** | Learners receive scaffolded SQL problems with feedback tied to 23 error subtypes and 30 concepts. |
| **Hint Escalation** | A guidance ladder moves learners from L1 micro-hints through L3 strategic hints to full LLM-grounded textbook units when struggle persists. |
| **Personalized Notes / Textbook** | The system accumulates explanations from learner traces, de-duplicates them, and surfaces them in a "My Textbook" view. |
| **Instructor Oversight** | Role-based access gives instructors a dashboard with coverage maps, traces, and exportable data. |
| **Logging & Research Instrumentation** | Every interaction is logged to an immutable event schema for replay, analysis, and reproducibility. |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  Web App (Vite + React)                                         │
│  - Student practice interface                                   │
│  - Instructor dashboard                                         │
│  - Adaptive hint & textbook UI                                  │
└─────────────────────────────┬───────────────────────────────────┘
                              │
┌─────────────────────────────▼───────────────────────────────────┐
│  Server (Express + Neon PostgreSQL)                             │
│  - Auth & sessions                                              │
│  - Interaction persistence                                      │
│  - Corpus & textbook API                                        │
└─────────────────────────────┬───────────────────────────────────┘
                              │
┌─────────────────────────────▼───────────────────────────────────┐
│  Data & Storage Layer                                           │
│  - Neon PostgreSQL (production)                                 │
│  - localStorage (offline / static mode)                         │
│  - Event log with UUIDv7 trace IDs                              │
└─────────────────────────────┬───────────────────────────────────┘
                              │
┌─────────────────────────────▼───────────────────────────────────┐
│  Corpus & Content Layer                                         │
│  - Static textbook assets (`apps/web/public/textbook-static/`)  │
│  - PDF ingest pipeline (`tools/pdf_ingest/`)                    │
│  - Concept maps & SQL-Engage taxonomy                           │
└─────────────────────────────┬───────────────────────────────────┘
                              │
┌─────────────────────────────▼───────────────────────────────────┐
│  Operational & Runbook Layer                                    │
│  - Beta launch runbooks (`docs/runbooks/`)                      │
│  - Verification & audit scripts (`scripts/`)                    │
│  - CI/CD regression gates (`.github/workflows/`)                │
└─────────────────────────────────────────────────────────────────┘
```

---

## Quick Start (Local Development)

**Prerequisites:** Node.js 20+ (LTS recommended)

```bash
# Install dependencies
npm run install:all

# Run frontend only (uses localStorage)
npm run dev

# Or run full stack (frontend + backend)
npm run dev:full
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

For backend persistence, copy and customize the environment files:

```bash
cp apps/web/.env.example apps/web/.env.local
cp apps/server/.env.example apps/server/.env.local
```

See [`docs/ENVIRONMENT.md`](docs/ENVIRONMENT.md) for a full variable reference.

---

## Repository Layout

| Directory | Purpose |
|-----------|---------|
| `apps/web` | Vite + React frontend |
| `apps/server` | Express backend |
| `docs/runbooks` | Operations and launch runbooks |
| `scripts` | Verification, audit, and research scripts (see [`scripts/README.md`](scripts/README.md)) |
| `tools/pdf_ingest` | Corpus ingestion tooling |

---

## Deployment

SQL-Adapt deploys as two Vercel projects:

1. **Frontend** — built from repo root with Vite (`npm run build`), output to `dist/app`
2. **Backend** — Express server in `apps/server/` (`npm run server:build`)

For step-by-step instructions, see [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md). For the capability matrix across local, hosted, and full-stack modes, see [`docs/DEPLOYMENT_MODES.md`](docs/DEPLOYMENT_MODES.md).

### Environment Variables

Production deployments require both frontend build-time variables (`VITE_*`) and backend runtime configuration (database URL, CORS origins, auth codes). See [`apps/web/.env.example`](apps/web/.env.example), [`apps/server/.env.example`](apps/server/.env.example), and [`docs/ENVIRONMENT.md`](docs/ENVIRONMENT.md) for details.

---

## Contributing

- Keep changes minimal and reversible.
- Do not modify LLM/AI runtime logic without explicit approval.
- Run `npm run integrity:scan` before commits.
- Update `docs/runbooks/status.md` when making operational changes.

---

## Current Verified Status

> **Last verified: 2026-04-03** — Ready for controlled staged beta. See [`docs/runbooks/status.md`](docs/runbooks/status.md) for the latest detailed checkpoint.

- **Build:** Verified
- **Tests:** 1,100+ passing (unit + E2E)
- **Production deployment:** Live on Vercel
- **Telemetry:** 31 event types instrumented
- **Beta docs:** Complete runbook suite in `docs/runbooks/`

---

## License

MIT License — see [LICENSE](LICENSE)
