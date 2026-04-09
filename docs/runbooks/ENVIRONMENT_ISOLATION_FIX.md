# Environment Isolation Fix (ENV-001 & ENV-002)

**Date:** 2026-04-08  
**Branch:** `hardening/research-grade-tightening`

---

## Summary

This document describes the fixes for two critical environment issues:

| ID | Issue | Severity | Status |
|----|-------|----------|--------|
| ENV-001 | Preview deployments write to production database | 🔴 Critical | ✅ Code ready, manual config required |
| ENV-002 | Node version drift (24.x vs 20.x) | 🟡 Medium | ✅ Fixed |

---

## ENV-002: Node Version Drift — FIXED

### Problem
Vercel dashboard/runtime was configured for Node 24.x while all other configs specified Node 20.x.

### Files Changed

1. **`.vercel/project.json`** — Changed `nodeVersion` from `"24.x"` to `"20.x"`
2. **`vercel.json`** — Added explicit `"node": "20.x"` configuration

### Verification
```bash
# Local development
cat .nvmrc  # => 20

# Vercel config
cat .vercel/project.json | grep nodeVersion  # => "20.x"
cat vercel.json | grep node  # => "node": "20.x"
```

---

## ENV-001: Preview/Production DB Isolation — CODE READY

### Problem
Both preview and production deployments used the same Neon database via `adaptive_data_DATABASE_URL`.

### Solution Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           PRODUCTION                                     │
│  ┌─────────────────────────┐      ┌─────────────────────────────────┐  │
│  │  Frontend               │      │  Backend                        │  │
│  │  adaptive-instructional-│──────▶│  adaptive-instructional-        │  │
│  │  artifacts.vercel.app   │      │  artifacts-ap.vercel.app        │  │
│  └─────────────────────────┘      │                                 │  │
│                                   │  DATABASE_URL: (unset)          │  │
│                                   │  ↓ falls back to                │  │
│                                   │  adaptive_data_DATABASE_URL ────┼──┼──▶ ┌─────────────┐
│                                   │  (Vercel Neon integration)      │  │    │  Neon PROD  │
│                                   └─────────────────────────────────┘  │    └─────────────┘
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│                           PREVIEW                                        │
│  ┌─────────────────────────┐      ┌─────────────────────────────────┐  │
│  │  Frontend               │      │  Backend                        │  │
│  │  adaptive-instructional-│──────▶│  adaptive-instructional-        │  │
│  │  artifacts-git-*...     │      │  artifacts-api-backend-*.vercel │  │
│  └─────────────────────────┘      │  (preview deployment)           │  │
│                                   │                                 │  │
│                                   │  DATABASE_URL ──────────────────┼──┼──▶ ┌─────────────┐
│                                   │  (preview-specific, manual set) │  │    │ Neon PREVIEW│
│                                   │  ↑ takes priority over          │  │    │  (isolated) │
│                                   │  adaptive_data_DATABASE_URL     │  │    └─────────────┘
│                                   └─────────────────────────────────┘
└─────────────────────────────────────────────────────────────────────────┘
```

### Code Changes Made

1. **`apps/server/src/db/env-resolver.ts`** — Added environment detection:
   - `resolveEnvironment()` — Returns 'production' | 'preview' | 'development'
   - `resolveDbTarget()` — Returns 'production' | 'preview' | 'local' | 'unknown'

2. **`apps/server/src/app.ts`** — Enhanced health checks:
   - `/health` endpoint now reports `environment` and `db.target`
   - `/api/system/persistence-status` now reports `environment` and `dbTarget`

### Manual Configuration Required

You must configure the Vercel backend project with a preview-specific database URL:

#### Option A: Via Vercel Dashboard

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Select the backend project: `adaptive-instructional-artifacts-api-backend`
3. Navigate to **Settings** → **Environment Variables**
4. Add variable:
   - **Name:** `DATABASE_URL`
   - **Value:** `postgresql://[preview-neon-connection-string]`
   - **Environment:** Select **Preview** only (NOT Production)
5. Click **Save**
6. Redeploy the preview branch

#### Option B: Via Vercel CLI

```bash
# Set the preview database URL (preview environment only)
vercel env add DATABASE_URL preview

# Enter the Neon preview connection string when prompted
# Then redeploy
vercel --environment=preview
```

### Verification After Configuration

Once configured, verify isolation using the health endpoints:

```bash
# Check production health
curl https://adaptive-instructional-artifacts-ap.vercel.app/health
# Expected: environment: "production", db.target: "production"

# Check preview health  
curl https://adaptive-instructional-artifacts-api-backend-[branch].vercel.app/health
# Expected: environment: "preview", db.target: "preview"
```

Expected response format:
```json
{
  "status": "ok",
  "timestamp": "2026-04-08T...",
  "version": "1.0.0",
  "environment": "preview",
  "db": {
    "mode": "neon",
    "envSource": "DATABASE_URL",
    "target": "preview",
    "status": "ok"
  }
}
```

### Creating a Neon Preview Database

If you don't have a preview database yet:

```bash
# Option 1: Create a new Neon project
neonctl projects create --name adaptive-preview

# Option 2: Create a branch in existing project (recommended)
neonctl branches create --name preview --parent main

# Get the connection string
neonctl connection-string --branch preview
```

---

## Files Modified

| File | Change | Purpose |
|------|--------|---------|
| `.vercel/project.json` | `nodeVersion: "20.x"` | Fix Node drift |
| `vercel.json` | Add `node: "20.x"` | Defense in depth |
| `apps/server/src/db/env-resolver.ts` | Add environment detection | Support DB isolation |
| `apps/server/src/app.ts` | Enhance health checks | Verify isolation at runtime |

---

## Acceptance Criteria

- [x] Node version aligned to 20.x everywhere
- [ ] Preview environment variable `DATABASE_URL` configured in Vercel
- [ ] Health endpoint shows `environment: "preview"` for preview deploys
- [ ] Health endpoint shows `db.target: "preview"` for preview deploys
- [ ] Preview writes do not appear in production database
- [ ] Production continues using `adaptive_data_DATABASE_URL`

---

## Rollback Plan

If issues occur:

1. **Node version:** Revert `.vercel/project.json` to `"24.x"`
2. **DB isolation:** Remove `DATABASE_URL` from Vercel preview environment
