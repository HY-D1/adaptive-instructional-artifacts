# Project Status — SQL-Adapt

**Last Updated**: 2026-03-24  
**Purpose**: Single durable status file for implementation and deployment readiness.

---

## Current Focus

### Public Launch Login System (Vercel + Neon)

Status: **In Progress**

Completed:
- Student signup class-code gate (`STUDENT_SIGNUP_CODE`)
- Instructor signup code gate (`INSTRUCTOR_SIGNUP_CODE`)
- Auth flow updates in frontend signup UI and clients
- Backend/server split for Vercel-compatible deployment shape:
  - `apps/server/src/app.ts` (app construction)
  - `apps/server/src/index.ts` (local server startup)
  - `apps/server/api/index.ts` (Vercel function entry)
  - `apps/server/vercel.json` (serverless routing/runtime)
- CSRF protection and credentialed cross-origin setup:
  - CSRF token cookie + `x-csrf-token` enforcement for mutating auth-protected routes
  - Production cookie policy (`Secure` + `SameSite=None`)
  - CORS allowlist support via `CORS_ORIGINS`
- Backend TypeScript build blockers resolved in `export-research-data.ts`

Remaining launch tasks:
- Deploy backend as separate Vercel project
- Set production env vars (frontend + backend)
- Run deployed auth smoke checks against production/preview URLs
- Confirm multi-device persistence path end-to-end

---

## Deployment Readiness Snapshot

- Frontend build: **Pass**
- Backend TypeScript build: **Pass**
- Auth unit tests (`apps/web/src/app/lib/auth.test.ts`): **Pass**
- Data persistence mode target: **Neon (durable, multi-device)**

See:
- `docs/DEPLOYMENT.md` for exact deploy and env configuration
- `docs/DEPLOYMENT_MODES.md` for capability matrix

---

## Documentation Rules

- Keep this file concise and current.
- Use this as the primary status ledger for active engineering status.
- Archive obsolete weekly snapshots under `docs/archive/` instead of adding new week-specific status files.

