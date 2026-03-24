# Deployment Guide

> **Quick Reference**: See [DEPLOYMENT_MODES.md](./DEPLOYMENT_MODES.md) for a detailed capability matrix showing which features work in local vs hosted mode.

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
| `VITE_OLLAMA_URL` | Local only | Local Ollama URL — not available on Vercel |
| `VITE_ENABLE_PDF_INDEX` | Local only | PDF indexing — requires local backend |

> **Note on `VITE_API_BASE_URL`**: this is the single canonical variable used by all three frontend API clients (`storage-client.ts`, `dual-storage.ts`, `learner-profile-client.ts`). Setting it enables backend/Neon persistence mode. When not set, the app runs in localStorage-only mode.

**Backend project (Vercel Serverless / any Node host):**

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes (preferred) | Neon PostgreSQL connection string (pooled endpoint recommended) |
| `NEON_DATABASE_URL` | Alternative | Secondary name accepted if `DATABASE_URL` is absent |
| `adaptive_data_DATABASE_URL` | Vercel Neon integration | Auto-injected by Vercel when you attach the Neon integration to a project named `adaptive_data` |
| `adaptive_data_POSTGRES_URL` | Vercel Neon integration | Postgres-alias variant injected by the same Vercel Neon integration |
| `JWT_SECRET` | Yes (production) | Secret for signing auth JWT cookies — must be at least 32 random characters |
| `STUDENT_SIGNUP_CODE` | Student accounts | Class code required when creating a student account. Falls back to `ClassSQL2024` in dev. |
| `INSTRUCTOR_SIGNUP_CODE` | Instructor accounts | Code required when creating an instructor account. Falls back to `TeachSQL2024` in dev. |
| `CORS_ORIGINS` | Recommended | Comma-separated frontend origins allowed to use credentialed requests (for example `https://app.example.com,https://www.example.com`) |
| `PORT` | No | HTTP port (default 3001) |

> **Auth setup**: Set `JWT_SECRET` to a strong random value (e.g. `openssl rand -base64 32`). Set both `STUDENT_SIGNUP_CODE` and `INSTRUCTOR_SIGNUP_CODE` to protect account creation. After adding these vars, redeploy the backend and run `npm run db:init:neon` to create the `auth_accounts` table.

> **Env var resolution order**: The backend checks these four names in priority order (`DATABASE_URL` → `NEON_DATABASE_URL` → `adaptive_data_DATABASE_URL` → `adaptive_data_POSTGRES_URL`) and uses the first non-empty value. You only need to set one.
> **After changing env vars you must redeploy** — Vercel bakes env vars into the build/runtime at deploy time. Adding or changing a variable without redeploying has no effect.

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
| PDF/Ollama fails | Hosted mode limitation | Expected - use local dev |

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
| `VITE_INSTRUCTOR_PASSCODE` | Passcode for instructor access | `TeachSQL2024` | Yes |
| `VITE_API_BASE_URL` | Backend API URL | (empty) | For hosted backend |
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

**Requirements:**
- `ENABLE_LLM=true` on backend
- Ollama server accessible from backend
- `VITE_ENABLE_LLM=true` on frontend (optional, for UI)

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
4. **Rate limiting** - Consider adding rate limiting for API endpoints
5. **File upload limits** - PDF uploads are limited by server config

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

The config defines three Playwright **projects**:

| Project | What it runs | Auth |
|---------|-------------|------|
| `setup:auth` | `tests/e2e/setup/auth.setup.ts` | Captures JWT cookie → `playwright/.auth/*.json` |
| `chromium` | All `*.spec.ts` except auth smoke | localStorage / StartPage (no backend required) |
| `chromium:auth` | `deployed-auth-smoke.spec.ts` only | Pre-loaded JWT cookie via `storageState` |

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

The `@deployed-auth-smoke` suite signs in via the real `/auth` page (JWT cookie),
saves a note, then opens a **fresh browser context** from the saved auth state to
prove the note persists across sessions.

#### Step 1 — Capture auth state (run once per environment)

The `setup:auth` project runs automatically as a dependency of `chromium:auth`.
You can also trigger it explicitly:

```bash
# Local dev server + backend on :3001
npx playwright test -c playwright.config.ts --project=setup:auth

# Against a deployed preview
PLAYWRIGHT_BASE_URL="https://<preview>.vercel.app" \
E2E_STUDENT_EMAIL="student@yourdomain.com" \
E2E_STUDENT_PASSWORD="YourPassword123!" \
E2E_STUDENT_CLASS_CODE="<class-code>" \
E2E_INSTRUCTOR_CODE="<instructor-code>" \
  npx playwright test -c playwright.config.ts --project=setup:auth
```

Auth state is saved to `playwright/.auth/student.json` and
`playwright/.auth/instructor.json` (gitignored — never commit these).

#### Step 2 — Run the auth smoke

```bash
# Local (dev server + backend must be running)
npx playwright test -c playwright.config.ts --project=chromium:auth \
  --grep "@deployed-auth-smoke"

# Shorthand — runs setup:auth first automatically, then chromium:auth
npx playwright test -c playwright.config.ts \
  --project=setup:auth --project=chromium:auth
```

#### Deployed authenticated smoke (Vercel preview, no protection bypass)

```bash
PLAYWRIGHT_BASE_URL="https://<preview>.vercel.app" \
E2E_STUDENT_EMAIL="student@yourdomain.com" \
E2E_STUDENT_PASSWORD="YourPassword123!" \
E2E_STUDENT_CLASS_CODE="<class-code>" \
E2E_INSTRUCTOR_CODE="<instructor-code>" \
  npx playwright test -c playwright.config.ts \
    --project=setup:auth --project=chromium:auth \
    --grep "@deployed-auth-smoke"
```

#### Deployed authenticated smoke (Vercel protected preview)

```bash
PLAYWRIGHT_BASE_URL="https://<preview>.vercel.app" \
VERCEL_AUTOMATION_BYPASS_SECRET="<secret-from-vercel-dashboard>" \
E2E_STUDENT_EMAIL="student@yourdomain.com" \
E2E_STUDENT_PASSWORD="YourPassword123!" \
E2E_STUDENT_CLASS_CODE="<class-code>" \
E2E_INSTRUCTOR_CODE="<instructor-code>" \
  npx playwright test -c playwright.config.ts \
    --project=setup:auth --project=chromium:auth \
    --grep "@deployed-auth-smoke"
```

The `VERCEL_AUTOMATION_BYPASS_SECRET` is set via the Vercel dashboard under
**Project → Settings → Deployment Protection → Automation bypass secret**.
When set, the `x-vercel-protection-bypass` and `x-vercel-set-bypass-cookie`
headers are injected automatically on every Playwright request.

#### Environment variables reference

| Variable | Default | Purpose |
|----------|---------|---------|
| `PLAYWRIGHT_BASE_URL` | `http://127.0.0.1:4173` | Target URL (set for deployed runs) |
| `VERCEL_AUTOMATION_BYPASS_SECRET` | — | Vercel protection bypass header |
| `E2E_STUDENT_EMAIL` | `e2e-student-<ts>@sql-adapt.test` | Student account email |
| `E2E_STUDENT_PASSWORD` | `E2eTestPass!123` | Student account password |
| `E2E_STUDENT_CLASS_CODE` | `ClassSQL2024` | Student class code used during signup |
| `E2E_INSTRUCTOR_EMAIL` | `e2e-instructor-<ts>@sql-adapt.test` | Instructor account email |
| `E2E_INSTRUCTOR_PASSWORD` | `E2eInstrPass!123` | Instructor account password |
| `E2E_INSTRUCTOR_CODE` | `TeachSQL2024` | Instructor signup code (dev default) |

> **Note:** Set `E2E_STUDENT_EMAIL` / `E2E_STUDENT_PASSWORD` to stable values in CI
> so the setup project can log in to an existing account (idempotent). When not set,
> a fresh unique email is generated each run and signup is attempted first with login
> as a fallback.

#### What the auth smoke proves

1. **Real JWT auth** — signs in via `/auth`, no `addInitScript` seeding.
2. **Note saved** — Save to Notes succeeds and the success banner appears.
3. **SPA navigation** — note visible in `/textbook` without a page reload.
4. **Cross-session persistence** — a **fresh `browser.newContext()`** loaded with
   the post-note `storageState` (JWT cookie + localStorage) shows the note.
   This is the strongest persistence claim: equivalent to closing the browser
   and reopening it on a different device sharing the same credentials.
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
npm run build
```

Expected: zero TypeScript errors, `dist/app/` contains the production bundle
including the new `textbook-static/concept-quality.json` and
`textbook-static/textbook-units.json` assets.

*Last updated: 2026-03-22*
