# Deployment Environment Parity Audit

**Date:** 2026-04-08  
**Auditor:** Claude Code (Codebase Exploration Agent)  
**Scope:** Preview vs Production environment configuration parity  
**Branch:** `hardening/research-grade-tightening`

---

## Executive Summary

| Dimension | Status | Notes |
|-----------|--------|-------|
| Node Version | ⚠️ **GAP IDENTIFIED** | Root `.nvmrc` = 20.x, but Vercel Dashboard set to 24.x |
| API Base URL | ✅ Configured | Preview → Production backend (intentional) |
| Database | ⚠️ **RISK** | Both preview and prod use SAME Neon project |
| CORS Origins | ✅ Configured | Wildcard patterns support preview URLs |
| Auth/Cookies | ✅ Configured | Cross-origin with SameSite=None |

**Primary Risk:** Preview and production deployments share the same Neon database, meaning preview testing affects production data.

---

## 1. Node Version Verification

### Configuration Sources

| Source | Value | Status |
|--------|-------|--------|
| `.nvmrc` | `20` | ✅ Present |
| Root `package.json` engines | `"node": "20.x"` | ✅ Present |
| `apps/server/package.json` engines | `"node": "20.x"` | ✅ Present |
| Vercel Dashboard (frontend) | `24.x` | ⚠️ **MISMATCH** |
| Vercel Dashboard (backend) | Unknown | ⚠️ **VERIFY** |

### Resolution Order

Vercel uses the following priority for Node version selection:
1. `VERCEL_NODE_VERSION` environment variable
2. `engines.node` in `package.json`
3. Project Settings in Dashboard
4. Default (usually latest LTS)

### Gap Analysis

- **Root `.nvmrc`** is set to `20` but this file is only used by nvm locally
- **Vercel Dashboard** shows `24.x` in `.vercel/project.json` settings
- The `package.json` engines field specifies `20.x`

According to `CLAUDE.md`, there was a Node version configuration issue that was resolved by changing engines to `">=20.x"`, but the current `package.json` still shows `"node": "20.x"`.

### Recommendation

```bash
# Verify actual Node version used in production builds
curl https://adaptive-instructional-artifacts-ap.vercel.app/health
# Check response headers or version field

# Recommended action: Align all Node version specifications
# Option A: Update .nvmrc and package.json to 24.x (match Vercel)
# Option B: Set explicit Node version in Vercel Dashboard to 20.x
```

---

## 2. API Base URL Configuration

### Frontend → Backend Mapping

| Environment | Frontend URL | Backend URL | Config Source |
|-------------|--------------|-------------|---------------|
| **Production** | `https://adaptive-instructional-artifacts.vercel.app` | `https://adaptive-instructional-artifacts-ap.vercel.app` | `VITE_API_BASE_URL` env var |
| **Preview** | `https://adaptive-instructional-artifacts-git-*-*.vercel.app` | `https://adaptive-instructional-artifacts-ap.vercel.app` | **SAME PROD BACKEND** |
| **Local Dev** | `http://localhost:5173` | `http://localhost:3001` | `VITE_API_BASE_URL=http://localhost:3001` |

### Build-Time Resolution (vite.config.ts)

```typescript
// From vite.config.ts lines 26-41
const resolvedApiBaseUrl =
  process.env.VITE_API_BASE_URL ||
  (
    process.env.VERCEL
      ? withRelatedProject({
          projectName: 'adaptive-instructional-artifacts-api-backend',
          defaultHost: process.env.VITE_API_BASE_URL || ''
        })
      : ''
  )
```

The frontend uses `@vercel/related-projects` to auto-discover the backend when `VITE_API_BASE_URL` is not explicitly set.

### Vercel Related Projects

From root `vercel.json`:
```json
{
  "relatedProjects": ["prj_vR3HTHqulLCVqv5EnSMfnStWP4cZ"]
}
```

This links the frontend to the backend project for automatic discovery.

### Current Production Environment Variables (from `.vercel/.env.production.local`)

```bash
VITE_API_BASE_URL="https://adaptive-instructional-artifacts-ap.vercel.app"
VITE_ENABLE_LLM="true"
VITE_INSTRUCTOR_PASSCODE="TEACHSQL2026"
```

---

## 3. Database Connection Map

### Environment Variable Resolution Priority

The backend uses this priority order for database connection:

1. `DATABASE_URL`
2. `NEON_DATABASE_URL`
3. `adaptive_data_DATABASE_URL` (Vercel Neon integration)
4. `adaptive_data_POSTGRES_URL` (Vercel Neon integration alias)

### Critical Finding: Shared Database

| Environment | Database | Connection String Source |
|-------------|----------|--------------------------|
| **Production Backend** | Neon PostgreSQL | `adaptive_data_DATABASE_URL` (Vercel integration) |
| **Preview Backend** | **SAME Neon PostgreSQL** | `adaptive_data_DATABASE_URL` (Vercel integration) |
| **Local Dev** | SQLite (fallback) | File-based if no DATABASE_URL |

### ⚠️ Risk: Preview → Production Data Pollution

**Issue:** Both preview and production backends connect to the SAME Neon database.

**Impact:**
- Preview testing writes to production database
- Student progress created in preview appears in production
- Instructor accounts created in preview work in production
- Research data mixed between environments

**Evidence from docs/DEPLOYMENT.md:**
```markdown
| Environment | Frontend URL | Backend URL | Env source |
|-------------|--------------|-------------|------------|
| Production | `https://adaptive-instructional-artifacts.vercel.app` | `https://adaptive-instructional-artifacts-ap.vercel.app` | `DATABASE_URL` via `/health` |
| Preview | `https://adaptive-instructional-artifacts-git-...` | `https://adaptive-instructional-artifacts-api-backend-...vercel.app` (preview validate), `https://adaptive-instructional-artifacts-ap.vercel.app` (frontend target) | `DATABASE_URL` via preview `/health` |
```

### Database Verification Commands

```bash
# Check which database production is using
curl https://adaptive-instructional-artifacts-ap.vercel.app/api/system/persistence-status

# Expected response (Neon mode):
{
  "backendReachable": true,
  "dbMode": "neon",
  "resolvedEnvSource": "adaptive_data_DATABASE_URL",
  "persistenceRoutesEnabled": true
}

# Check database health
curl https://adaptive-instructional-artifacts-ap.vercel.app/health
```

### Recommendation

**Immediate Action Required:**
1. Create a separate Neon project for preview deployments
2. Set `DATABASE_URL` in preview environment to use the preview Neon project
3. Document the preview database connection for testing purposes

**Branching Strategy:**
Consider using Neon branches for preview deployments:
- Production: Main Neon database
- Preview: Neon branch (created from main)

---

## 4. CORS and Auth Configuration

### CORS Origins Configuration

From `apps/server/.env.example`:

```bash
# CORS origin for frontend requests
CORS_ORIGIN=http://localhost:5173
# Optional explicit allowlist for multiple frontend origins
CORS_ORIGINS=https://app.example.com,https://www.example.com
# Optional wildcard allowlist for trusted preview domains
CORS_ORIGIN_PATTERNS=https://your-project-*.vercel.app
```

### Production CORS Setup

The production backend must have these configured:

```bash
CORS_ORIGINS=https://adaptive-instructional-artifacts.vercel.app
CORS_ORIGIN_PATTERNS=https://adaptive-instructional-artifacts-*.vercel.app
```

This allows:
- Production frontend: `https://adaptive-instructional-artifacts.vercel.app`
- All preview deployments: `https://adaptive-instructional-artifacts-*.vercel.app`

### Cookie Configuration

Production cookies use:
- `Secure` flag (HTTPS only)
- `SameSite=None` (cross-origin support)
- `HttpOnly` for auth cookies

**Auth Cookie Name:** `sql_adapt_auth` (JWT)
**CSRF Cookie Name:** `sql_adapt_csrf`

### Required Backend Environment Variables

| Variable | Production | Preview | Purpose |
|----------|------------|---------|---------|
| `JWT_SECRET` | ✅ Required | ✅ Required | JWT signing (min 32 chars) |
| `STUDENT_SIGNUP_CODE` | ✅ Required | ✅ Required | Class code gate |
| `INSTRUCTOR_SIGNUP_CODE` | ✅ Required | ✅ Required | Instructor code gate |
| `CORS_ORIGINS` | ✅ Required | ✅ Required | Frontend origin allowlist |
| `CORS_ORIGIN_PATTERNS` | ✅ Recommended | ✅ Recommended | Preview wildcard support |

---

## 5. Environment Variable Matrix

### Frontend (VITE_* variables - Build Time)

| Variable | Local Dev | Preview | Production | Notes |
|----------|-----------|---------|------------|-------|
| `VITE_INSTRUCTOR_PASSCODE` | Dev fallback | ✅ Set | ✅ Set | Required for instructor mode |
| `VITE_API_BASE_URL` | `http://localhost:3001` | `https://...-ap.vercel.app` | `https://...-ap.vercel.app` | Enables backend mode |
| `VITE_ENABLE_LLM` | Optional | ✅ `true` | ✅ `true` | UI feature flag |
| `VITE_ENABLE_PDF_INDEX` | Optional | ❌ `false` | ❌ `false` | Not available hosted |
| `VITE_TEXTBOOK_CORPUS_MODE` | Optional | `remote` | `remote` | Use `/api/corpus` |

### Backend (Runtime)

| Variable | Local Dev | Preview | Production | Notes |
|----------|-----------|---------|------------|-------|
| `DATABASE_URL` | SQLite | **PROD NEON** ⚠️ | **PROD NEON** | Same DB risk |
| `JWT_SECRET` | Dev value | ✅ Set | ✅ Set | Auth signing |
| `CORS_ORIGIN` | `localhost:5173` | Preview URL | Production URL | Single origin |
| `CORS_ORIGINS` | Not set | ✅ Set | ✅ Set | Allowlist |
| `CORS_ORIGIN_PATTERNS` | Not set | ✅ Set | ✅ Set | Wildcard |
| `STUDENT_SIGNUP_CODE` | Dev value | ✅ Set | ✅ Set | Class code |
| `INSTRUCTOR_SIGNUP_CODE` | Dev value | ✅ Set | ✅ Set | Instructor code |
| `LLM_PROVIDER` | `ollama` | `groq` | `groq` | AI provider |
| `GROQ_API_KEY` | Not set | ✅ Set | ✅ Set | Required for Groq |
| `ENABLE_PDF_INDEX` | `true` | `false` | `false` | Hosted limitation |
| `ENABLE_LLM` | `true` | `true` | `true` | Feature flag |

---

## 6. Deployment Paths

### Intended Deployment Flow

```
Developer Branch
       │
       ▼
Preview Deployment (frontend + backend preview)
       │
       ├── Uses: Preview Neon DB (SHOULD BE - currently uses prod)
       ├── VITE_API_BASE_URL → Preview backend
       └── Test E2E here
       │
       ▼
Promote to Production
       │
       ├── Frontend → Production frontend URL
       ├── Backend → Production backend URL  
       └── Database → Production Neon DB
```

### Actual Current Flow (Risky)

```
Preview Deployment
       │
       ├── Frontend → Preview URL
       ├── Backend → Production backend URL (or preview)
       └── Database → PRODUCTION NEON DB ⚠️
```

---

## 7. Identified Gaps and Risks

### Critical (P0)

| ID | Issue | Impact | Mitigation |
|----|-------|--------|------------|
| ENV-001 | Preview uses production database | Data pollution, test data in prod | Create separate preview Neon project |

### High (P1)

| ID | Issue | Impact | Mitigation |
|----|-------|--------|------------|
| ENV-002 | Node version mismatch (20.x vs 24.x) | Runtime inconsistencies | Align Node versions |
| ENV-003 | Preview backend may point to prod backend | Unexpected data flow | Verify preview backend env vars |

### Medium (P2)

| ID | Issue | Impact | Mitigation |
|----|-------|--------|------------|
| ENV-004 | No documented preview DB branching strategy | Hard to isolate test data | Document Neon branching approach |
| ENV-005 | CORS_ORIGIN_PATTERNS may be too permissive | Security risk | Review wildcard patterns |

---

## 8. Action Items

### Immediate (Before Next Preview Deploy)

- [ ] **ENV-001:** Create separate Neon project for preview deployments
- [ ] **ENV-001:** Set `DATABASE_URL` in preview environment to use preview Neon
- [ ] **ENV-002:** Verify current Node version in production builds
- [ ] **ENV-002:** Align `.nvmrc`, `package.json`, and Vercel Dashboard Node versions

### Short-term (This Week)

- [ ] **ENV-003:** Audit preview backend environment variables
- [ ] **ENV-004:** Document preview → production database promotion strategy
- [ ] **ENV-004:** Create script to clone/synchronize preview DB from production

### Ongoing

- [ ] Monitor preview deployments for database isolation
- [ ] Add health check endpoint that reports environment (preview/prod)
- [ ] Document the environment variable matrix for new team members

---

## 9. Verification Commands

### Check Current Configuration

```bash
# 1. Verify production backend database
curl https://adaptive-instructional-artifacts-ap.vercel.app/api/system/persistence-status

# 2. Verify production health
curl https://adaptive-instructional-artifacts-ap.vercel.app/health

# 3. Verify frontend can reach backend
curl -I https://adaptive-instructional-artifacts-ap.vercel.app/api/llm/status

# 4. Check CORS headers
curl -H "Origin: https://adaptive-instructional-artifacts.vercel.app" \
  -I https://adaptive-instructional-artifacts-ap.vercel.app/api/auth/me
```

### Local Verification

```bash
# Verify Node version
node --version  # Should match .nvmrc

# Verify build with current env
npm run build
npm run server:build
```

---

## 10. Appendix: Vercel Project IDs

### Frontend Project

```json
{
  "projectId": "prj_39bY93BbbDoT6A0avxsLNxXtxKra",
  "orgId": "team_BxlA36kEPgWxAMjQnJ4DBtQ2",
  "projectName": "adaptive-instructional-artifacts"
}
```

### Backend Project

From `vercel.json` relatedProjects:
```json
{
  "relatedProjects": ["prj_vR3HTHqulLCVqv5EnSMfnStWP4cZ"]
}
```

Backend project name: `adaptive-instructional-artifacts-api-backend`

---

## Sign-off

**Audit Completed:** 2026-04-08  
**Status:** ⚠️ **ACTION REQUIRED** - Preview/Production database sharing identified as primary risk  
**Next Review:** After preview database isolation is implemented

---

*Related Documentation:*
- `docs/DEPLOYMENT.md` - Full deployment procedures
- `docs/DEPLOYMENT_MODES.md` - Capability matrix
- `docs/PERSISTENCE_MAP.md` - Data flow and authoritative sources
- `docs/runbooks/status.md` - Current operational status
