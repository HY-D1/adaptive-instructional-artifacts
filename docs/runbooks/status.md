# Project Status — SQL-Adapt

**Last Updated**: 2026-03-27  
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

---

## Checkpoint — 2026-03-27 11:15 America/Vancouver

Status: **PARTIAL**

Evidence:
- Local compile/test gates passed after auth/persistence hardening changes:
  - `npm run server:build` ✅
  - `npm run build` ✅
  - `npx vitest run apps/web/src/app/lib/auth.test.ts apps/web/src/app/lib/content/concept-loader.test.ts` ✅ (49/49)
- Deployed authz/smoke gates against production URLs:
  - `npx playwright test -c playwright.config.ts tests/e2e/regression/instructor-section-scope.spec.ts tests/e2e/regression/api-authz.spec.ts --reporter=line` ✅ (4 passed)
  - `npx playwright test -c playwright.config.ts --project=chromium:auth --grep '@deployed-auth-smoke' --reporter=line` ✅ (9 passed)
- Remaining blocker:
  - `npx playwright test -c playwright.config.ts tests/e2e/regression/student-multi-device-persistence.spec.ts --reporter=line` ❌
  - failure at `tests/e2e/regression/student-multi-device-persistence.spec.ts:267` where second-context editor text remains default (`"-- Write your SQL query here"`) instead of seeded backend `currentCode`.

Changed files (this checkpoint scope):
- `apps/server/src/db/migrate-neon.sql`
- `apps/server/src/db/neon.ts`
- `apps/server/src/db/index.ts`
- `apps/server/src/routes/neon-sessions.ts`
- `apps/web/src/app/lib/api/storage-client.ts`
- `apps/web/src/app/lib/storage/dual-storage.ts`
- `apps/web/src/app/pages/LearningInterface.tsx`
- `apps/web/src/app/lib/auth-guard.ts`
- `apps/web/src/app/routes.tsx`
- `apps/web/src/app/components/features/chat/AskMyTextbookChat.tsx`
- `apps/web/src/app/lib/content/concept-loader.test.ts`

Next smallest fix:
- Add focused instrumentation/test hook around practice-page hydration path (`sessionId`, `currentProblemId`, resolved `draft source`) and rerun only `student-multi-device-persistence.spec.ts` against a deployment where both frontend and backend changes are live and accessible without Vercel auth-gating.

## Checkpoint — 2026-03-27 11:49 America/Vancouver

Status: **PARTIAL**

Evidence:
- Local build gates passed after launch-readiness hardening updates:
  - `npm run server:build` ✅
  - `npm run build` ✅
  - bundle split baseline improved via manual chunking:
    - main chunk reduced from ~`2,136.77 kB` (`566.34 kB` gzip) to ~`1,419.93 kB` (`355.32 kB` gzip)
- Targeted auth/content/storage/session tests passed:
  - `npx vitest run apps/web/src/app/lib/auth.test.ts apps/web/src/app/lib/content/concept-loader.test.ts apps/web/src/app/lib/auth-route-loader.test.ts apps/web/src/app/lib/storage/dual-storage.test.ts tests/unit/server/neon-sessions.contract.test.ts` ✅ (57 passed)
- Canonical auth/storage import-path guard passed:
  - `npm run check:auth-storage-imports` ✅
- Canonical launch smoke command exists and is wired:
  - `npm run test:e2e:launch-smoke`
- In this environment, launch smoke currently fails at auth setup due missing reachable backend target/env contract:
  - `npm run test:e2e:launch-smoke` ❌
  - failure: `[auth-setup] Backend health check failed for http://127.0.0.1:3001: fetch failed`

Implemented in this checkpoint:
- Backend-authoritative loader logic extracted and tested:
  - `apps/web/src/app/lib/auth-route-loader.ts`
  - `apps/web/src/app/lib/auth-route-loader.test.ts`
  - `apps/web/src/app/routes.tsx`
- Deterministic session-first hydration for multi-device restore:
  - `apps/web/src/app/lib/storage/dual-storage.ts`
  - `apps/web/src/app/lib/storage/dual-storage.test.ts`
  - `apps/web/src/app/pages/LearningInterface.tsx`
- Backend session contract test coverage (`sessionId` vs `currentProblemId` + heartbeat no-clobber):
  - `tests/unit/server/neon-sessions.contract.test.ts`
- Canonical import-path enforcement for auth-critical files:
  - `scripts/check-auth-storage-imports.mjs`
  - `package.json` script `check:auth-storage-imports`
  - `package.json` `integrity:scan` now runs the import guard so build/CI fails on regressions
- Reproducible launch-smoke script and deployment runbook updates:
  - `package.json` script `test:e2e:launch-smoke`
  - `docs/DEPLOYMENT.md`
- Initial bundle-risk reduction without runtime refactor:
  - `apps/web/vite.config.ts` manual chunk config (`vendor-react`, `vendor-editor`, `vendor-charts`)
- Docs consistency updates:
  - `apps/web/src/app/lib/auth-context.tsx` comments aligned with actual auth enablement semantics
  - `docs/runbooks/ux-bugs-regression.md` quality metadata source path clarified

Next smallest fix:
- Run `npm run test:e2e:launch-smoke` against deployed frontend/backend with deterministic `PLAYWRIGHT_*` + `E2E_*` env vars (and `VERCEL_AUTOMATION_BYPASS_SECRET` for protected previews), then resolve any remaining second-context restore mismatch surfaced by deployed test evidence.

## Checkpoint — 2026-03-27 12:14 America/Vancouver

Status: **PARTIAL**

Evidence:
- Restore-path hardening and deployed-auth env contract updates compiled successfully:
  - `npm run server:build` ✅
  - `npm run build` ✅
- Focused persistence/session regression tests passed:
  - `npx vitest run apps/web/src/app/lib/storage/dual-storage.test.ts tests/unit/server/neon-sessions.contract.test.ts` ✅ (8 passed)
- Launch smoke still fails in this local environment because deployed/auth env contract is not provided:
  - `npm run test:e2e:launch-smoke` ❌
  - failure: `[auth-setup] Backend health check failed for http://127.0.0.1:3001: fetch failed`

Implemented in this checkpoint:
- Deployed E2E auth contract hardening:
  - `tests/e2e/helpers/auth-env.ts`
    - `resolveApiBaseUrl()` now fails fast for deployed targets when `PLAYWRIGHT_API_BASE_URL`/`VITE_API_BASE_URL` is missing.
- Multi-device restore hardening for backend session IDs:
  - `apps/web/src/app/lib/storage/storage.ts`
    - `findAnyPracticeDraft()` now resolves learner+problem drafts across any session-id shape (including opaque backend session IDs).
  - `apps/web/src/app/lib/storage/dual-storage.ts`
    - `hydrateLearner()` now accepts `{ force?: boolean }` to bypass short hydration throttle when needed.
  - `apps/web/src/app/pages/LearningInterface.tsx`
    - session initialization no longer rejects backend-authenticated session IDs by local prefix rule in account mode.
    - login-time fallback hydration now uses `storage.hydrateLearner(learnerId, { force: true })`.
- Regression coverage additions:
  - `apps/web/src/app/lib/storage/dual-storage.test.ts`
    - added test for opaque session-id draft lookup.
    - added test for forced hydration bypass.
- Deployment runbook updates for preview→promote launch gate:
  - `docs/DEPLOYMENT.md`

Changed files (this checkpoint scope):
- `tests/e2e/helpers/auth-env.ts`
- `apps/web/src/app/lib/storage/storage.ts`
- `apps/web/src/app/lib/storage/dual-storage.ts`
- `apps/web/src/app/pages/LearningInterface.tsx`
- `apps/web/src/app/lib/storage/dual-storage.test.ts`
- `docs/DEPLOYMENT.md`

Next smallest fix:
- Run `npm run test:e2e:launch-smoke` with deterministic deployed env (`PLAYWRIGHT_BASE_URL`, `PLAYWRIGHT_API_BASE_URL`, fixed `E2E_*`, and `VERCEL_AUTOMATION_BYPASS_SECRET` for protected previews), then confirm `tests/e2e/regression/student-multi-device-persistence.spec.ts` editor-restore assertion is green on preview before production promote.
