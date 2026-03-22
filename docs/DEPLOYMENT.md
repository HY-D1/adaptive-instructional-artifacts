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
| `PORT` | No | HTTP port (default 3001) |

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

*Last updated: 2026-03-11*
