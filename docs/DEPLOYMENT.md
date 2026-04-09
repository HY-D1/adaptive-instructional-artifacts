# Deployment Guide

> **Quick Reference**: See [DEPLOYMENT_MODES.md](./DEPLOYMENT_MODES.md) for a detailed capability matrix showing which features work in local vs hosted mode.
>
> **Beta Launch Status**: See [Beta Launch Readiness](../.claude/state/runs/run-1774826173/beta-launch-packet.json) for current release candidate details.

## Production Release Candidate (v1.0.0-beta)

**Release Commit**: `a799561a13791771f4e30097af15021e4c7c2415`
**Branch**: `codex/beta-stabilization-preview-first`
**Status**: Ready for Controlled Student Beta Launch
**Last Verified**: 2026-03-30

### Production URLs

| Service | URL | Health Status |
|---------|-----|---------------|
| Frontend | `https://adaptive-instructional-artifacts.vercel.app` | Verified (HTTP 200) |
| Backend | `https://adaptive-instructional-artifacts-ap.vercel.app` | Verified (/health OK) |
| Health Endpoint | `https://adaptive-instructional-artifacts-ap.vercel.app/health` | OK - Neon DB connected |

### Active Corpus Configuration

- **Document ID**: `dbms-ramakrishnan-3rd-edition`
- **Active Run ID**: `run-1774671570-b1353117`
- **Units**: 43
- **Chunks**: 101
- **Last Updated**: 2026-03-28T05:10:52.069Z

### Rollback Procedure

If critical issues are discovered during beta launch, follow these steps to rollback:

**Rollback Target**: `fc143c6` (Merge pull request #7 from HY-D1/feat/student-preview)

1. **Identify rollback target commit**: `fc143c6` (last stable main merge)
2. **Frontend rollback**: Use Vercel Dashboard to revert to previous production deployment or redeploy from `fc143c6`
3. **Backend rollback**: Use Vercel Dashboard to revert API deployment to `fc143c6`
4. **Verify rollback health**: Check `/health` endpoint returns 200 with expected response
5. **Verify active-run still set**: Run `node scripts/verify-corpus-active-run.mjs`
6. **Smoke test critical flows**: Login, load learning interface, request hint, submit answer

**Database Considerations**:
- Schema is stable - no migration required for rollback
- Active run persists in database across deployments
- Neon provides point-in-time recovery if needed

**Emergency Command** (use with caution):
```bash
git checkout fc143c6 && git push -f origin HEAD:main  # DANGER: force push
```

## Vercel Deployment

### Initial Setup

1. Install Vercel CLI: `npm i -g vercel`
2. Link project: `vercel link`

### Environment Variables

**Frontend project (Vercel):**

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_INSTRUCTOR_PASSCODE` | Yes | Passcode for instructor access |
| `VITE_API_BASE_URL` | For persistence | Base URL of the backend API, no trailing `/api` (e.g. `https://my-api.vercel.app`). Leave empty for localStorage-only (static) mode. |
| `VITE_ENABLE_VERCEL_ANALYTICS` | Optional | Set to `true` to load `@vercel/analytics/react` at runtime (launch default: `false`) |
| `VITE_ENABLE_VERCEL_SPEED_INSIGHTS` | Optional | Set to `false` to disable Speed Insights (default: enabled) |
| `VITE_TEXTBOOK_CORPUS_MODE` | Optional (recommended) | `remote` to prefer Neon-backed `/api/corpus` content in hosted/full-stack mode, `static` for bundled fallback content |
| `VITE_OLLAMA_URL` | Local only | Local Ollama URL — not available on Vercel |
| `VITE_ENABLE_PDF_INDEX` | Local only | PDF indexing — requires local backend |

> **Note on `VITE_API_BASE_URL`**: this is the single canonical variable used by all three frontend API clients (`storage-client.ts`, `dual-storage.ts`, `learner-profile-client.ts`). Setting it enables backend/Neon persistence mode. When not set, the app runs in localStorage-only mode.
>
> **Note on `VITE_TEXTBOOK_CORPUS_MODE`**: set to `remote` in hosted full-stack mode to read processed corpus units from Neon via `/api/corpus/*`. The app still falls back to static textbook assets when remote corpus is unavailable.

**Backend project (Vercel Serverless / any Node host):**

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes (preferred) | Neon PostgreSQL connection string (pooled endpoint recommended) |
| `NEON_DATABASE_URL` | Alternative | Secondary name accepted if `DATABASE_URL` is absent |
| `adaptive_data_DATABASE_URL` | Vercel Neon integration | Auto-injected by Vercel when you attach the Neon integration to a project named `adaptive_data` |
| `adaptive_data_POSTGRES_URL` | Vercel Neon integration | Postgres-alias variant injected by the same Vercel Neon integration |
| `JWT_SECRET` | Yes (production) | Secret for signing auth JWT cookies — must be at least 32 random characters |
| `STUDENT_SIGNUP_CODE` | Student accounts | Class code required when creating a student account. Falls back to `ClassSQL2024` in dev. |
| `INSTRUCTOR_SIGNUP_CODE` | Instructor accounts | Code required when creating an instructor account. Keep this explicit in deployed envs. |
| `CORS_ORIGINS` | Recommended | Comma-separated frontend origins allowed to use credentialed requests (for example `https://app.example.com,https://www.example.com`) |
| `CORS_ORIGIN_PATTERNS` | Optional | Comma-separated wildcard origin patterns for trusted preview domains (for example `https://adaptive-instructional-artifacts-*.vercel.app`) |
| `PORT` | No | HTTP port (default 3001) |
| `OLLAMA_DEFAULT_MODEL` | Optional (LLM) | Primary local generation model used when client request omits model (default `qwen3:4b`) |
| `OLLAMA_FALLBACK_MODEL` | Optional (LLM) | Fallback local generation model when primary Ollama model fails (default `llama3.2:3b`) |
| `LLM_PROVIDER` | Optional (LLM) | LLM provider: `ollama` (local) or `groq` (hosted). Defaults to `ollama` |
| `GROQ_API_KEY` | Required (Groq) | API key for Groq hosted LLM. Get from https://console.groq.com/keys |
| `GROQ_MODEL` | Optional (Groq) | Groq model for generation (default `openai/gpt-oss-20b`) |

> **Auth setup**: Set `JWT_SECRET` to a strong random value (e.g. `openssl rand -base64 32`). Set both `STUDENT_SIGNUP_CODE` and `INSTRUCTOR_SIGNUP_CODE` to protect account creation. After adding these vars, redeploy the backend and run `cd apps/server && npm run db:init:neon` to initialize the Neon database schema including the `auth_accounts` table.
>
> **CORS setup (preview + prod)**:
> - Keep stable domains in `CORS_ORIGINS`, for example:
>   `https://adaptive-instructional-artifacts.vercel.app`
> - Add trusted wildcard preview domains in `CORS_ORIGIN_PATTERNS`, for example:
>   `https://adaptive-instructional-artifacts-*.vercel.app`
> - Do not use `*` with credentialed cookies.

> **Env var resolution order**: Runtime + ingest + verification now use the same priority (`DATABASE_URL` → `NEON_DATABASE_URL` → `adaptive_data_DATABASE_URL` → `adaptive_data_POSTGRES_URL`) and use the first non-empty value. You only need to set one.
> This includes backend runtime (`/health`, `/api/system/persistence-status`), local ingest upload (`npm run ingest:upload`), and corpus verification (`npm run corpus:verify`).
> **After changing env vars you must redeploy** — Vercel bakes env vars into the build/runtime at deploy time. Adding or changing a variable without redeploying has no effect.

### Preview-First Beta Gate (Required)

Run deployed stabilization checks against a **preview frontend + preview backend pair** first, then promote to production only after gates pass.

Deterministic env contract for deployed Playwright runs:

```bash
PLAYWRIGHT_BASE_URL=<preview-frontend-url>
PLAYWRIGHT_API_BASE_URL=<preview-backend-url>
E2E_INSTRUCTOR_EMAIL=<stable-instructor-email>
E2E_INSTRUCTOR_PASSWORD=<stable-instructor-password>
E2E_STUDENT_CLASS_CODE=<stable-student-class-code>
```

Protected preview access (choose one path):

```bash
# Option A: automation bypass secret
VERCEL_AUTOMATION_BYPASS_SECRET=<bypass-secret>

# Option B: share-link path (no bypass secret)
PLAYWRIGHT_FRONTEND_SHARE_URL=<preview-frontend-share-url>
PLAYWRIGHT_API_SHARE_URL=<preview-backend-share-url>
# Optional fallback if you only have the token:
# PLAYWRIGHT_API_SHARE_TOKEN=<preview-backend-share-token>
```

`setup:auth` now bootstraps both frontend and backend share URLs (when provided)
before login/signup so protected preview cookies are established in browser context.

Preflight and gate commands:

```bash
npm run check:e2e:deployed-env
npm run corpus:verify-active-run -- --api-base-url "$PLAYWRIGHT_API_BASE_URL"
npm run test:e2e:setup-auth:deployed
npm run test:e2e:hint-stability
```

### Active Corpus Run Safety

Use active-run mapping to prevent mixed-run corpus responses in runtime APIs:

```bash
# Set active run explicitly (preview/prod DB)
npm run corpus:set-active-run -- --doc-id dbms-ramakrishnan-3rd-edition --run-id run-1774671570-b1353117

# Convenience command for winner run
npm run corpus:set-winner-run

# Verify API responses contain only active-run units/chunks
npm run corpus:verify-active-run -- --api-base-url https://adaptive-instructional-artifacts-ap.vercel.app
```

For ingest uploads, active-run switching is enabled by default:

```bash
npm run ingest:upload
# Equivalent underlying flag: python -m pdf_ingest.cli upload ... --set-active true
```

### Deployment Matrix (Last Verified)

| Environment | Frontend URL | Backend URL | Env source | Last verified (UTC) |
|-------------|--------------|-------------|------------|---------------------|
| Production | `https://adaptive-instructional-artifacts.vercel.app` | `https://adaptive-instructional-artifacts-ap.vercel.app` | `DATABASE_URL` via `/health` + `/api/system/persistence-status` | 2026-03-28T01:40Z |
| Preview | `https://adaptive-instructional-artifacts-git-fea-1e5553-hy-d1s-projects.vercel.app` | `https://adaptive-instructional-artifacts-api-backend-5qfmevvrv.vercel.app` (preview validate), `https://adaptive-instructional-artifacts-ap.vercel.app` (frontend target) | `DATABASE_URL` via preview `/health` + `/api/system/persistence-status` | 2026-03-28T01:40Z |

### Related Projects Note

- Root `vercel.json` includes `relatedProjects` to discover the backend host during Git-connected Vercel builds.
- This only helps when both frontend and backend are linked Git-connected projects in Vercel.
- CLI-only/manual deployments still require explicit `VITE_API_BASE_URL` and a new frontend deployment after env changes.

---

## Vercel + Neon Persistence Mode

Use this topology when you need real multi-user persistence (research data that survives browser clears):

```text
┌──────────────────────────┐      HTTPS /api/*      ┌────────────────────────────┐
│  Frontend (Vercel)        │ ─────────────────────► │  Backend (Vercel/Render)   │
│  React + Vite             │                        │  Express + @neondatabase   │
│  VITE_API_BASE_URL set    │ ◄───────────────────── │  DATABASE_URL → Neon PG    │
└──────────────────────────┘      JSON responses     └────────────────────────────┘
```

### Setup Checklist

#### 1. Provision Neon database

- Create a project at [neon.tech](https://neon.tech)
- Copy the **pooled connection string** (e.g. `postgres://...@ep-xxx.pooler.neon.tech/neondb?sslmode=require`)
- Set `DATABASE_URL` on your backend Vercel project

#### 2. Deploy the backend

```bash
# From apps/server — deploy as a separate Vercel project
cd apps/server
vercel deploy --prod
# Note the deployment URL, e.g. https://sql-adapt-api.vercel.app
```

Backend project settings:
- Framework preset: **Other**
- Root directory: `apps/server`
- Build command: `npm run build`
- Output directory: leave empty (serverless functions)

#### 3. Configure the frontend

In your frontend Vercel project settings, add:

```text
VITE_API_BASE_URL = https://sql-adapt-api.vercel.app
VITE_INSTRUCTOR_PASSCODE = <your-passcode>
```

Then redeploy (VITE_ vars are baked at build time).

#### 4. Verify persistence

```bash
node scripts/smoke-test-persistence.mjs https://sql-adapt-api.vercel.app
```

Expected output: all 5 checks pass with a learner, session, interaction, and textbook unit created server-side.

Security notes for deployed auth:
- JWT auth cookie uses `Secure` + `SameSite=None` in production for cross-origin frontend/backend deployments.
- CSRF uses double-submit cookie protection; mutating API requests must send `x-csrf-token` matching the `sql_adapt_csrf` cookie (frontend API clients handle this automatically).

### Local-only raw PDF policy

- Raw PDF files remain local-only and are not uploaded to Neon.
- Hosted Vercel runtime should depend on processed corpus rows (`corpus_documents`, `corpus_units`, `corpus_chunks`) only.
- Legacy `/api/pdf-index/*` remains local-dev oriented; hosted runtime should use `/api/corpus/*`.

### Deployment Topology

| Scenario | Frontend env vars | Backend env vars | Persistence |
|----------|-------------------|------------------|-------------|
| Frontend-only / static demo | `VITE_INSTRUCTOR_PASSCODE` only | n/a | localStorage (per-browser, ephemeral) |
| Separate frontend + backend | `VITE_INSTRUCTOR_PASSCODE` + `VITE_API_BASE_URL` | `DATABASE_URL` | Neon PostgreSQL (durable, multi-user) |
| Vercel Neon integration | `VITE_INSTRUCTOR_PASSCODE` + `VITE_API_BASE_URL` | `adaptive_data_DATABASE_URL` (auto-injected) | Neon PostgreSQL (durable, multi-user) |
| Local dev with backend | `VITE_API_BASE_URL=http://localhost:3001` | `DATABASE_URL` or none (SQLite) | Local Neon or SQLite |

#### Vercel Neon integration — prefixed variables

When you attach the Neon integration to a Vercel project named **`adaptive_data`**, Vercel injects
these variables automatically instead of plain `DATABASE_URL`:

- `adaptive_data_DATABASE_URL` — primary pooled connection string
- `adaptive_data_POSTGRES_URL` — postgres-alias variant

The backend resolves all four known names in priority order, so no manual renaming is needed.
To confirm which variable is active, call the diagnostic endpoint after deploying:

```bash
curl https://your-api.vercel.app/api/system/persistence-status
```

Expected response in Neon mode:

```json
{
  "backendReachable": true,
  "dbMode": "neon",
  "resolvedEnvSource": "adaptive_data_DATABASE_URL",
  "persistenceRoutesEnabled": true
}
```

If `dbMode` is `"sqlite"` and `resolvedEnvSource` is `null`, no database URL was found —
check that the Neon integration is attached to the correct Vercel project and that you have redeployed since attaching it.

### Local Build Test

```bash
# Pull latest env vars
npm run vercel:pull

# Build locally (reproduces Vercel build)
npm run vercel:build

# Inspect output
ls -R .vercel/output

# Preview locally
npm run vercel:preview
```

### Dashboard Settings

Must match these exactly:
- **Framework Preset**: Vite
- **Root Directory**: `./` (repo root)
- **Build Command**: `npm run build`
- **Output Directory**: `dist/app`

### Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| Build fails with path errors | Wrong Root Directory | Set to repo root, not apps/web |
| 404 on all routes | Wrong Output Directory | Set to dist/app |
| Blank page | COOP/COEP headers | Headers already in vercel.json |
| Instructor mode fails | Missing env var | Add VITE_INSTRUCTOR_PASSCODE |
| Build fails on `@vercel/analytics/react` | Missing dependency or optional analytics mode | Install `@vercel/analytics` or keep `VITE_ENABLE_VERCEL_ANALYTICS=false` for launch-safe builds |
| PDF/Ollama fails | Hosted mode limitation | Expected - use local dev |
| Storage quota exceeded | localStorage full (5-10MB limit) | See [Storage Quota Incident Playbook](./runbooks/storage-quota-incident.md) |

---

## Full Deployment Documentation

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              SQL-Adapt System                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌──────────────┐     HTTP API      ┌──────────────────────────────────┐   │
│  │   Frontend   │ ◄────────────────► │          Backend                 │   │
│  │  (React/Vite)│    /api/*         │      (Express/SQLite)            │   │
│  │              │                   │                                  │   │
│  │  - Student   │                   │  ┌────────────────────────────┐  │   │
│  │    Interface │                   │  │  Core API Routes           │  │   │
│  │  - Instructor│                   │  │  - /api/learners           │  │   │
│  │    Dashboard │                   │  │  - /api/interactions       │  │   │
│  │  - Textbook  │                   │  │  - /api/textbooks          │  │   │
│  │  - Concepts  │                   │  │  - /api/sessions           │  │   │
│  │  - Settings  │                   │  │  - /api/research           │  │   │
│  │              │                   │  └────────────────────────────┘  │   │
│  │              │                   │                                  │   │
│  │              │                   │  ┌────────────────────────────┐  │   │
│  │              │                   │  │  Optional Feature Routes   │  │   │
│  │              │                   │  │  (Feature Flags)           │  │   │
│  │              │                   │  │                            │  │   │
│  │              │                   │  │  PDF Index (ENABLE_PDF_)   │  │   │
│  │              │                   │  │  - /api/pdf-index/status   │  │   │
│  │              │                   │  │  - /api/pdf-index/load     │  │   │
│  │              │                   │  │  - /api/pdf-index/upload   │  │   │
│  │              │                   │  │                            │  │   │
│  │              │                   │  │  LLM Proxy (ENABLE_LLM)    │  │   │
│  │              │                   │  │  - /api/llm/status         │  │   │
│  │              │                   │  │  - /api/llm/models         │  │   │
│  │              │                   │  │  - /api/llm/generate       │  │   │
│  │              │                   │  └────────────────────────────┘  │   │
│  │              │                   │                                  │   │
│  │              │                   │  ┌────────────────────────────┐  │   │
│  │              │                   │  │  External Services         │  │   │
│  │              │                   │  │                            │  │   │
│  │              │                   │  │  Ollama (LLM)              │  │   │
│  │              │                   │  │  - /api/generate           │  │   │
│  │              │                   │  │  - /api/tags               │  │   │
│  │              │                   │  │                            │  │   │
│  │              │                   │  │  Poppler (PDF)             │  │   │
│  │              │                   │  │  - pdftotext               │  │   │
│  │              │                   │  └────────────────────────────┘  │   │
│  └──────────────┘                   └──────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Deployment Modes

#### Mode 1: Local Development (Full Features)

**Use Case:** Development with all features enabled

```bash
# 1. Install dependencies
npm install

# 2. Set up environment
cp .env.example .env
cp apps/server/.env.example apps/server/.env

# Edit .env files:
# VITE_ENABLE_PDF_INDEX=true
# VITE_ENABLE_LLM=true
# ENABLE_PDF_INDEX=true
# ENABLE_LLM=true

# 3. Install Poppler (for PDF features)
# macOS: brew install poppler
# Ubuntu: sudo apt-get install poppler-utils
# Windows: choco install poppler

# 4. Install Ollama (for LLM features)
# https://ollama.com/
# ollama pull qwen2.5:1.5b-instruct

# 5. Start backend
npm run server:dev

# 6. Start frontend (in another terminal)
npm run dev
```

#### Mode 2: Hosted Production (Backend + Frontend)

**Use Case:** Full production deployment with separate backend server

```
Frontend (Vercel/Netlify) ←──→ Backend (VPS/Container)
                                    ↓
                              Ollama (separate server)
```

**Backend Deployment:**

```bash
# 1. Set up environment variables
export PORT=3001
export CORS_ORIGIN=https://your-frontend-url.com
export ENABLE_PDF_INDEX=true
export ENABLE_LLM=true
export OLLAMA_BASE_URL=http://your-ollama-server:11434

# 2. Build and start
cd apps/server
npm install
npm run build
npm start
```

**Frontend Deployment:**

```bash
# 1. Set environment variables
export VITE_API_BASE_URL=https://your-backend-url.com
export VITE_ENABLE_PDF_INDEX=true
export VITE_ENABLE_LLM=true

# 2. Build
npm run build

# 3. Deploy dist/app to Vercel/Netlify
```

#### Mode 3: Static Hosting Only (No Backend)

**Use Case:** Demo mode on Vercel/Netlify without backend

```
Frontend (Vercel/Netlify)
    ↓
No backend - deterministic hints only
```

```bash
# Set environment variables
export VITE_ENABLE_PDF_INDEX=false
export VITE_ENABLE_LLM=false

# Build and deploy
npm run build
# Deploy dist/app to static host
```

Features available in this mode:
- ✅ SQL Practice with 32 problems
- ✅ SQL-Engage dataset hints (deterministic)
- ✅ Automatic Textbook
- ✅ Progress tracking
- ✅ Instructor dashboard
- ❌ AI-powered explanations
- ❌ PDF search/chat

### Hosted Mode Limitations

When deploying to Vercel/Netlify (static hosting without backend), the system automatically enters **hosted mode** and adjusts feature availability:

**What Works:**
- All core SQL practice features
- Deterministic hints from SQL-Engage dataset
- Automatic textbook accumulation
- Research dashboard with deterministic replay
- Cross-tab synchronization
- HDI calculation and interventions

**What Doesn't Work:**
- LLM-powered explanations (requires local Ollama)
- PDF upload/indexing (requires backend + Poppler)
- Backend API persistence (uses localStorage instead)

**Build-Time Requirements:**
- `VITE_INSTRUCTOR_PASSCODE` must be set at build time
- Without it, instructor role selection is disabled

See [DEPLOYMENT_MODES.md](./DEPLOYMENT_MODES.md) for the complete capability matrix.

### Environment Variables

#### Frontend Variables (VITE_ prefix)

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `VITE_INSTRUCTOR_PASSCODE` | Passcode for instructor access | `TEACHSQL2026` (example) | Yes |
| `VITE_API_BASE_URL` | Backend API URL | (empty) | For hosted backend |
| `VITE_ENABLE_VERCEL_ANALYTICS` | Load Vercel analytics bundle at runtime | `false` | No |
| `VITE_ENABLE_VERCEL_SPEED_INSIGHTS` | Enable Vercel speed insights component | `true` | No |
| `VITE_ENABLE_PDF_INDEX` | Enable PDF index UI | `false` | No |
| `VITE_ENABLE_LLM` | Enable LLM UI | `false` | No |

#### Backend Variables

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `PORT` | Server port | `3001` | No |
| `CORS_ORIGIN` | Allowed frontend origin | `http://localhost:5173` | Yes |
| `NODE_ENV` | Environment mode | `development` | No |
| `ENABLE_PDF_INDEX` | Enable PDF features | `false` | No |
| `ENABLE_LLM` | Enable LLM proxy | `false` | No |
| `OLLAMA_BASE_URL` | Ollama server URL | `http://127.0.0.1:11434` | If LLM enabled |
| `PDF_INDEX_DIR` | PDF index storage path | `./data/pdf-index` | No |
| `PDF_SOURCE_DIR` | Source PDFs path | `./data/pdfs` | No |

### Deployment Examples

#### Docker Deployment

```dockerfile
# Dockerfile for Backend
FROM node:20-alpine

WORKDIR /app

# Install Poppler for PDF support
RUN apk add --no-cache poppler-utils

COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

ENV PORT=3001
ENV ENABLE_PDF_INDEX=true
ENV ENABLE_LLM=true

EXPOSE 3001

CMD ["npm", "start"]
```

#### Vercel Configuration (Frontend)

```json
{
  "rewrites": [
    { "source": "/(.*)", "destination": "/index.html" }
  ],
  "headers": [
    {
      "source": "/sql-wasm.wasm",
      "headers": [
        { "key": "Content-Type", "value": "application/wasm" }
      ]
    }
  ]
}
```

#### Nginx Configuration (Backend Proxy)

```nginx
server {
    listen 80;
    server_name api.sql-adapt.com;

    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        
        # CORS headers
        add_header 'Access-Control-Allow-Origin' 'https://sql-adapt.com' always;
        add_header 'Access-Control-Allow-Methods' 'GET, POST, PUT, DELETE, OPTIONS' always;
        add_header 'Access-Control-Allow-Headers' 'Content-Type, Authorization' always;
    }
}
```

### Feature Flags

#### PDF Index Feature

**Requirements:**
- `ENABLE_PDF_INDEX=true` on backend
- Poppler (`pdftotext`) installed on server
- `VITE_ENABLE_PDF_INDEX=true` on frontend (optional, for UI)

**API Endpoints:**
- `GET /api/pdf-index/status` - Check status
- `POST /api/pdf-index/load` - Load/build index
- `POST /api/pdf-index/upload` - Upload PDF

**Graceful Degradation:**
When PDF index is disabled:
- Endpoints return 503 with clear message
- Frontend falls back to SQL-Engage templates

#### LLM Feature

For Ollama (local):
- `ENABLE_LLM=true` on backend
- Ollama server accessible from backend
- `VITE_ENABLE_LLM=true` on frontend (optional, for UI)

For Groq (hosted):
- `ENABLE_LLM=true` on backend
- `LLM_PROVIDER=groq` on backend
- `GROQ_API_KEY=<your-api-key>` on backend (get from https://console.groq.com/keys)
- `GROQ_MODEL=openai/gpt-oss-20b` (optional, defaults to this)
- Frontend will auto-detect Groq mode from backend status

**API Endpoints:**
- `GET /api/llm/status` - Check status
- `GET /api/llm/models` - List models
- `POST /api/llm/generate` - Generate text

**Graceful Degradation:**
When LLM is disabled:
- Endpoints return 503 with clear message
- Frontend uses SQL-Engage hints (deterministic)

### Health Checks

#### Backend Health Check

```bash
curl http://localhost:3001/health
```

Response:
```json
{
  "status": "ok",
  "timestamp": "2026-03-11T22:00:00.000Z",
  "version": "1.0.0",
  "features": {
    "pdfIndex": {
      "enabled": true,
      "available": true,
      "message": "PDF index available with 2 document(s)"
    },
    "llm": {
      "enabled": true,
      "available": true,
      "message": "Ollama connected with 3 model(s)",
      "ollamaUrl": "http://127.0.0.1:11434"
    }
  }
}
```

#### Feature Status Checks

```bash
# Check PDF index status
curl http://localhost:3001/api/pdf-index/status

# Check LLM status
curl http://localhost:3001/api/llm/status
```

### Extended Troubleshooting

#### PDF Index Not Working

1. Check if `ENABLE_PDF_INDEX=true` is set
2. Verify Poppler is installed: `pdftotext -v`
3. Check backend logs for errors
4. Verify PDF files exist in `PDF_SOURCE_DIR`

#### LLM Not Working

1. Check if `ENABLE_LLM=true` is set
2. Verify Ollama is running: `curl http://localhost:11434/api/tags`
3. Check backend can reach Ollama: `curl $OLLAMA_BASE_URL/api/tags`
4. Verify model is pulled: `ollama list`

#### CORS Errors

1. Verify `CORS_ORIGIN` matches your frontend URL
2. Check for trailing slashes in URLs
3. Ensure backend is restarted after config changes

### Security Considerations

1. **Never expose Ollama directly** - Always proxy through backend
2. **Use HTTPS in production** - For both frontend and backend
3. **Change default passcode** - Set a secure `VITE_INSTRUCTOR_PASSCODE`
4. **Rate limiting** - Endpoint-specific rate limiting is active on auth routes
5. **File upload limits** - PDF uploads are limited by server config

### Auth Rate Limiting Verification

The auth endpoints have endpoint-specific rate limiting to prevent abuse while allowing legitimate users through:

| Endpoint | Rate Limit | Key Strategy |
|----------|------------|--------------|
| POST /api/auth/login | 10/15min | email + IP |
| POST /api/auth/signup | 5/15min | IP only |

**Verify rate limiting is active**:

```bash
# Check rate limit headers on login (expect 401 for wrong password, not 429)
curl -i -X POST https://adaptive-instructional-artifacts-ap.vercel.app/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"wrong"}'

# Look for RateLimit-* headers in response:
# RateLimit-Limit: 10
# RateLimit-Remaining: 9
# RateLimit-Reset: <timestamp>

# After 10 failed attempts, expect 429 with retry information
curl -i -X POST https://adaptive-instructional-artifacts-ap.vercel.app/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"wrong"}'
# HTTP/2 429
# {"success":false,"error":"Too many login attempts",...}
```

**Deployment Parity**:
- Preview and production deployments are isolated (separate in-memory rate limiter state)
- Rate limits apply per-deployment, so preview testing won't affect production

---

---

## Real-Browser Regression Runbook

### Sync the helper corpus

```bash
node scripts/sync-helper-export.mjs "/path/to/algl-pdf-helper/output/textbook-static"
```

This copies `concept-map.json`, `textbook-manifest.json`, `chunks-metadata.json`,
`concept-quality.json`, and `textbook-units.json` from the helper export into
`apps/web/public/textbook-static/`. A `validate-corpus.mjs` run is triggered
automatically; it checks all 8 corpus integrity rules including the two new files.

### Validate the corpus (standalone)

```bash
node scripts/validate-corpus.mjs
```

Expected output: `PASS: all N entries resolve; both required textbooks present.`
Checks 7 and 8 confirm `concept-quality.json` and `textbook-units.json` are present.

### Install Playwright browsers (first time)

```bash
npm run test:install-browsers
# or directly:
npx playwright install --with-deps chromium
```

---

### Playwright test suites

One-time browser bootstrap (local and CI images without preinstalled Playwright):

```bash
npm run test:install-browsers
```

The config defines three Playwright **projects**:

| Project | What it runs | Auth |
|---------|-------------|------|
| `setup:auth` | `tests/e2e/setup/auth.setup.ts` | Captures JWT cookie → `playwright/.auth/*.json` |
| `chromium` | All `*.spec.ts` except auth smoke | localStorage / StartPage (no backend required) |
| `chromium:auth` | Authenticated deployment/spec checks | Real login + JWT cookie |

#### Local regression suite (no backend required)

```bash
# UX regression — save-to-notes + concept readability
npx playwright test -c playwright.config.ts --grep "@ux-bugs|@no-external"

# Full suite (chromium project only — no auth dependency)
npx playwright test -c playwright.config.ts --project=chromium
```

#### Richer fallback rendering regression (concept quality metadata)

Tests the enhanced fallback mode that displays `learnerSafeKeyPoints` and
`learnerSafeExamples` from the helper-produced quality metadata:

```bash
# Run concept readability regression including key points and examples
npx playwright test -c playwright.config.ts \
  tests/e2e/regression/ux-bugs-concept-readability.spec.ts
```

This suite verifies:
- **fallback_only concepts** show `learnerSafeKeyPoints` as bullet list
- **fallback_only concepts** with `learnerSafeExamples` render verified SQL examples
- **fallback_only concepts** without examples show "no verified examples" message
- **clean concepts** show full explanation without quality banner
- **Local heuristics** still trigger quality banner when helper metadata absent

---

### Authenticated smoke (real auth backend required)

The auth regression suite signs in via the real `/login` + `/signup` account UI (JWT cookie),
saves a note, then opens a **fresh browser context** and logs in with credentials
to prove backend hydration across true second-context login.

#### Step 0 — Neon preflight (required before setup)

```bash
curl https://<backend>/health
curl https://<backend>/api/system/persistence-status
```

Expected:
- `dbMode` is `neon`
- `resolvedEnvSource` is non-null
- `persistenceRoutesEnabled` is `true`

#### Step 1 — One-time deterministic auth seed (deployed runs)

Before running deployed Playwright auth proofs, set one stable instructor + class code pair:

1. Create one fresh instructor account manually in production or preview.
2. Capture the generated `studentSignupCode` from instructor UI or `GET /api/auth/me`.
3. Set these env vars in Vercel for test runs:
   - `E2E_INSTRUCTOR_EMAIL`
   - `E2E_INSTRUCTOR_PASSWORD`
   - `E2E_STUDENT_CLASS_CODE` (captured real section code)
   - Optional: `E2E_ALLOW_INSTRUCTOR_SIGNUP=true` + `E2E_INSTRUCTOR_CODE` if you explicitly want signup fallback
4. Redeploy after env updates (Vercel env changes apply only to new deployments).

#### Step 2 — Capture auth state (run once per environment)

The `setup:auth` project runs automatically as a dependency of `chromium:auth`.
You can also trigger it explicitly:

```bash
# Local dev server + backend on :3001
npx playwright test -c playwright.config.ts --project=setup:auth

# Against a deployed preview
PLAYWRIGHT_BASE_URL="https://<preview>.vercel.app" \
PLAYWRIGHT_API_BASE_URL="https://<backend>.vercel.app" \
E2E_INSTRUCTOR_EMAIL="instructor-e2e@example.com" \
E2E_INSTRUCTOR_PASSWORD="TestPassword123!" \
E2E_STUDENT_EMAIL="student@yourdomain.com" \
E2E_STUDENT_PASSWORD="YourPassword123!" \
E2E_STUDENT_CLASS_CODE="<class-code>" \
  npx playwright test -c playwright.config.ts --project=setup:auth
```

`setup:auth` now fails fast when the backend is unreachable or not Neon-backed.
It will not silently write empty auth state files for launch-proof runs.
For deployed targets, it also fails fast unless deterministic `E2E_*` auth vars are provided.
Default deployed mode is instructor login-first. If you opt in to signup fallback
and logs show `Invalid instructor code`, set `E2E_INSTRUCTOR_CODE` to the backend's
actual `INSTRUCTOR_SIGNUP_CODE`.

Auth state is saved to `playwright/.auth/student.json` and
`playwright/.auth/instructor.json` (gitignored — never commit these).

#### Step 3 — Run the auth smoke

```bash
# Local (dev server + backend must be running)
npx playwright test -c playwright.config.ts --project=chromium:auth \
  --grep "@deployed-auth-smoke"

# Shorthand — runs setup:auth first automatically, then chromium:auth
npx playwright test -c playwright.config.ts \
  --project=setup:auth --project=chromium:auth
```

#### Step 4 — Run multi-device + section-scope + authz proofs

```bash
npx playwright test -c playwright.config.ts --project=chromium:auth \
  tests/e2e/regression/student-multi-device-persistence.spec.ts \
  tests/e2e/regression/instructor-section-scope.spec.ts \
  tests/e2e/regression/api-authz.spec.ts
```

#### Canonical launch smoke command (release gate)

```bash
npm run test:e2e:launch-smoke
```

`test:e2e:launch-smoke` runs:
1. `@deployed-auth-smoke` on `chromium:auth`
2. `student-multi-device-persistence.spec.ts`
3. `instructor-section-scope.spec.ts`
4. `api-authz.spec.ts`

#### Preview → promote release gate (required)

Use a two-phase launch gate:

1. Run `npm run test:e2e:launch-smoke` against the protected preview pair.
2. Promote the exact tested frontend/backend pair.
3. Re-run `npm run test:e2e:launch-smoke` against production URLs.

```bash
# Phase A: preview
PLAYWRIGHT_BASE_URL="https://<frontend-preview>.vercel.app" \
PLAYWRIGHT_API_BASE_URL="https://<backend-preview>.vercel.app" \
VERCEL_AUTOMATION_BYPASS_SECRET="<secret>" \
E2E_INSTRUCTOR_EMAIL="instructor-e2e@example.com" \
E2E_INSTRUCTOR_PASSWORD="TestPassword123!" \
E2E_STUDENT_EMAIL="student@yourdomain.com" \
E2E_STUDENT_PASSWORD="YourPassword123!" \
E2E_STUDENT_CLASS_CODE="<class-code>" \
  npm run test:e2e:launch-smoke

# Phase B: production (post-promote)
PLAYWRIGHT_BASE_URL="https://adaptive-instructional-artifacts.vercel.app" \
PLAYWRIGHT_API_BASE_URL="https://adaptive-instructional-artifacts-ap.vercel.app" \
E2E_INSTRUCTOR_EMAIL="instructor-e2e@example.com" \
E2E_INSTRUCTOR_PASSWORD="TestPassword123!" \
E2E_STUDENT_EMAIL="student@yourdomain.com" \
E2E_STUDENT_PASSWORD="YourPassword123!" \
E2E_STUDENT_CLASS_CODE="<class-code>" \
  npm run test:e2e:launch-smoke
```

#### Deployed authenticated smoke (Vercel preview, no protection bypass)

```bash
PLAYWRIGHT_BASE_URL="https://<preview>.vercel.app" \
PLAYWRIGHT_API_BASE_URL="https://<backend>.vercel.app" \
E2E_INSTRUCTOR_EMAIL="instructor-e2e@example.com" \
E2E_INSTRUCTOR_PASSWORD="TestPassword123!" \
E2E_STUDENT_EMAIL="student@yourdomain.com" \
E2E_STUDENT_PASSWORD="YourPassword123!" \
E2E_STUDENT_CLASS_CODE="<class-code>" \
  npx playwright test -c playwright.config.ts \
    --project=setup:auth --project=chromium:auth \
    --grep "@deployed-auth-smoke"
```

#### Deployed authenticated smoke (Vercel protected preview)

```bash
PLAYWRIGHT_BASE_URL="https://<preview>.vercel.app" \
PLAYWRIGHT_API_BASE_URL="https://<backend>.vercel.app" \
VERCEL_AUTOMATION_BYPASS_SECRET="<secret-from-vercel-dashboard>" \
E2E_INSTRUCTOR_EMAIL="instructor-e2e@example.com" \
E2E_INSTRUCTOR_PASSWORD="TestPassword123!" \
E2E_STUDENT_EMAIL="student@yourdomain.com" \
E2E_STUDENT_PASSWORD="YourPassword123!" \
E2E_STUDENT_CLASS_CODE="<class-code>" \
  npx playwright test -c playwright.config.ts \
    --project=setup:auth --project=chromium:auth \
    --grep "@deployed-auth-smoke"
```

The `VERCEL_AUTOMATION_BYPASS_SECRET` is set via the Vercel dashboard under
**Project → Settings → Deployment Protection → Automation bypass secret**.
`E2E_VERCEL_BYPASS_SECRET` is supported as a backward-compatible alias.
When set, the `x-vercel-protection-bypass` and `x-vercel-set-bypass-cookie`
headers are injected automatically on every Playwright request.

#### Environment variables reference

| Variable | Default | Purpose |
|----------|---------|---------|
| `PLAYWRIGHT_BASE_URL` | `http://127.0.0.1:4173` | Target URL (set for deployed runs) |
| `PLAYWRIGHT_API_BASE_URL` | `http://127.0.0.1:3001` (local) | Backend API origin for split frontend/backend proofs |
| `VERCEL_AUTOMATION_BYPASS_SECRET` | — | Vercel protection bypass header |
| `E2E_VERCEL_BYPASS_SECRET` | — | Alias for `VERCEL_AUTOMATION_BYPASS_SECRET` |
| `E2E_STUDENT_EMAIL` | `e2e-student-<ts>@sql-adapt.test` | Student account email |
| `E2E_STUDENT_PASSWORD` | `E2eTestPass!123` | Student account password |
| `E2E_STUDENT_CLASS_CODE` | — | Section signup code (required for deployed deterministic setup) |
| `E2E_INSTRUCTOR_EMAIL` | `e2e-instructor-<ts>@sql-adapt.test` | Instructor account email |
| `E2E_INSTRUCTOR_PASSWORD` | `E2eInstrPass!123` | Instructor account password |
| `E2E_ALLOW_INSTRUCTOR_SIGNUP` | `false` | Opt in to instructor signup fallback during setup |
| `E2E_INSTRUCTOR_CODE` | `TeachSQL2024` (local only) | Instructor signup code (required only when signup fallback is enabled) |

> **Note:** Set both student and instructor `E2E_*` credentials to stable values in CI
> so setup can log in first (idempotent) and only fall back to signup when necessary.
> For deployed targets (`PLAYWRIGHT_BASE_URL` not localhost), `PLAYWRIGHT_API_BASE_URL`
> is mandatory; the helper no longer falls back silently to `127.0.0.1:3001`.

#### What the auth smoke proves

1. **Real JWT auth** — signs in via `/login` / `/signup`, no `addInitScript` seeding.
2. **Note saved** — Save to Notes succeeds and the success banner appears.
3. **SPA navigation** — note visible in `/textbook` without a page reload.
4. **Cross-device hydration** — a **fresh `browser.newContext()`** logs in again
   using credentials (no copied storage state) and still shows persisted note/data.
   StorageState cloning is not accepted as the primary persistence proof.
5. **Instructor gate** — wrong code → error; right code → redirect.

---

### Run against a deployed Vercel URL (non-auth smoke only)

```bash
# Public deployment (no protection bypass needed)
PLAYWRIGHT_BASE_URL="https://<deployment-url>.vercel.app" \
  npx playwright test -c playwright.config.ts --project=chromium \
    --grep "@ux-bugs|@deployed-smoke"

# Protected Vercel preview (deployment protection enabled)
PLAYWRIGHT_BASE_URL="https://<preview-url>.vercel.app" \
VERCEL_AUTOMATION_BYPASS_SECRET="<secret-from-vercel-dashboard>" \
  npx playwright test -c playwright.config.ts --project=chromium \
    --grep "@ux-bugs|@deployed-smoke"
```

### Build check

```bash
npm run server:build
npm run build
npx vitest run apps/web/src/app/lib/auth.test.ts
```

Expected: zero TypeScript errors, `dist/app/` contains the production bundle
including the new `textbook-static/concept-quality.json` and
`textbook-static/textbook-units.json` assets.

### Section-linkage schema version

- Current Neon schema baseline for launch: `2026-03-24-section-linkage-v1`.
- Required linkage columns:
  - `learner_sessions.section_id` (nullable FK to `course_sections.id`)
  - `interaction_events.section_id` (nullable FK to `course_sections.id`)
- These columns are persisted on writes and included in scoped export records.

### Launch-ready verification command set

```bash
# Build + unit
npm run server:build
npm run build
npx vitest run apps/web/src/app/lib/auth.test.ts

# Auth bootstrap and scoped persistence/authz proofs
npx playwright test -c playwright.config.ts --project=setup:auth
npx playwright test -c playwright.config.ts --project=chromium:auth --grep "multi-device|section-scope|authz"
```

StorageState cloning is not accepted as the primary persistence proof.
Second-context tests must perform credential login in a clean browser context.

### Integrity gate added

Run this before any proof commands:

```bash
npm run integrity:scan
rg -n --fixed-strings -- '-03-24' \
  apps/web/src/app \
  apps/server/src \
  package.json \
  apps/server/package.json \
  apps/web/vite.config.ts \
  apps/server/tsconfig.json \
  playwright.config.ts \
  tsconfig.json \
  vercel.json
```

What this proves:
- integrity scan now covers the full app source + build/test config surface before builds.
- tokenized corruption markers are absent from critical source/config files before build/tests.
- integrity scanner is portable across environments (`rg` preferred, `grep` fallback) without weakening fail behavior.

### Proof of multi-device UI restore

```bash
npx playwright test -c playwright.config.ts tests/e2e/regression/student-multi-device-persistence.spec.ts
# run a second time to detect timing flake
npx playwright test -c playwright.config.ts tests/e2e/regression/student-multi-device-persistence.spec.ts
```

What this proves:
- device A saves a note and seeds active session state.
- device B is a fresh browser context and logs in with credentials.
- textbook UI visibly shows the same saved note (title + content snippet), not just a count.
- practice/editor UI visibly resumes the saved `currentCode`.
- direct API checks (`/api/sessions/:learnerId/active`, `/api/interactions`) are retained as secondary evidence.

### Proof of instructor section isolation

```bash
npx playwright test -c playwright.config.ts tests/e2e/regression/instructor-section-scope.spec.ts
npx playwright test -c playwright.config.ts tests/e2e/regression/api-authz.spec.ts
```

What this proves:
- instructor A/B isolation on list/detail endpoints.
- scoped behavior on high-risk aggregate/export endpoints:
  - `/api/instructor/overview`
  - `/api/instructor/export`
  - `/api/research/aggregates`
  - `/api/research/export`
- anonymous 401 coverage and cross-section/session ownership denial paths.

Neon prerequisite for auth-backed proof:

```bash
curl https://<backend>/health
curl https://<backend>/api/system/persistence-status
```

Expected before claiming proof:
- `dbMode: "neon"`
- `persistenceRoutesEnabled: true`
- `resolvedEnvSource` is non-null

If `dbMode` is `"sqlite"`, account signup/login proofs are not valid launch evidence.

### Launch UX/Product Guard Regressions

Use this compact guard pack for launch-visible behavior checks (not broad auth/replay coverage):

```bash
npx playwright test -c playwright.config.ts tests/e2e/regression/launch-readiness-guards.spec.ts
```

This suite is intentionally narrow and maps to real product risks:
- textbook visible note count matches rendered note rows
- textbook view/filter state survives refresh
- instructor dashboard learner count matches visible learner table rows
- logout/login role switches clear prior role-scoped UI state
- primary CTA stability and labeled icon-only controls after hydration

*Last updated: 2026-03-24*
