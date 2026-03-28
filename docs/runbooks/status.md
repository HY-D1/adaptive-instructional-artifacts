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

## Checkpoint — 2026-03-27 12:33 America/Vancouver

Status: **PARTIAL**

Evidence:
- Environment contract validated for deployed production URL pair:
  - frontend: `https://adaptive-instructional-artifacts.vercel.app` reachable
  - backend health: `/health` ✅
  - persistence status: `dbMode=neon`, `resolvedEnvSource=DATABASE_URL`, `persistenceRoutesEnabled=true` ✅
- `setup:auth` with fixed existing `E2E_*` credentials failed due credential mismatch:
  - student: login invalid password; signup blocked by existing email
  - instructor: deterministic login invalid password
- `setup:auth` with fresh emails and signup fallback succeeded:
  - command used runtime vars: fresh `E2E_STUDENT_EMAIL`, fresh `E2E_INSTRUCTOR_EMAIL`,
    `E2E_ALLOW_INSTRUCTOR_SIGNUP=true`, `E2E_INSTRUCTOR_CODE=TEACHSQL2026`
  - result: `2 passed`
- Full launch gate with the same fresh-email config progressed and confirmed current blocker remains:
  - `@deployed-auth-smoke` ✅ (9 passed)
  - `api-authz.spec.ts` ✅
  - `instructor-section-scope.spec.ts` ✅
  - `student-multi-device-persistence.spec.ts` ❌ at editor restore assertion
    (`tests/e2e/regression/student-multi-device-persistence.spec.ts:267`,
    expected seeded SQL, received default editor placeholder)

Changed files (this checkpoint scope):
- `docs/runbooks/status.md`

Next smallest fix:
- Instrument and patch the practice restore path for second-context login so seeded
  backend session `currentCode` is applied to editor state before the assertion in
  `student-multi-device-persistence.spec.ts:267`, then rerun only that spec against
  deployed targets.


## Checkpoint — 2026-03-27 15:16 PDT

Status: **PARTIAL**

Evidence:
- Backend redeployed from current local apps/server source and promoted to production alias.
  - Deploy command used:
    VERCEL_ORG_ID=team_BxlA36kEPgWxAMjQnJ4DBtQ2 VERCEL_PROJECT_ID=prj_vR3HTHqulLCVqv5EnSMfnStWP4cZ npx vercel deploy --prod --yes
  - Deployment 1: dpl_25EYbCZbX5BM8Wve8zhYBwAKaYzZ
    - URL: https://adaptive-instructional-artifacts-api-backend-c5ycftfpb.vercel.app
    - Aliased: https://adaptive-instructional-artifacts-ap.vercel.app
  - Deployment 2 (accidental duplicate from shell quoting issue): dpl_9tU3kiujvkpkXvKXsugW5fmroptU
    - URL: https://adaptive-instructional-artifacts-api-backend-c9vv8754e.vercel.app
    - Aliased: https://adaptive-instructional-artifacts-ap.vercel.app
- Backend build gate passed before deploy:
  - npm run server:build ✅
- Deployed auth setup passed against production URLs with deterministic env:
  - npx playwright test -c playwright.config.ts --project=setup:auth --reporter=line ✅ (2 passed)
- Blocker spec rerun after redeploy still fails at editor restore assertion:
  - npx playwright test -c playwright.config.ts tests/e2e/regression/student-multi-device-persistence.spec.ts --reporter=line --workers=1 --global-timeout=0 ❌
  - failure at tests/e2e/regression/student-multi-device-persistence.spec.ts:267
  - expected editor content: SELECT * FROM employees WHERE salary > 70000
  - received editor content: -- Write your SQL query here
- Trace evidence confirms backend session contract is now stable post-redeploy:
  - /tmp/sqladapt-trace-latest/resources/428d7af68f41493633c573737d7535e5ee002cd1.json
  - contains sessionId=session-3170a9d0-1eb8-4b66-a432-20cdc2128e05-1774641116744
  - contains currentProblemId=problem-2
  - contains currentCode=SELECT * FROM employees WHERE salary > 70000
  - This removes backend deploy drift as primary cause; remaining issue is frontend practice-page restore application timing/state wiring.

Changed files (this checkpoint scope):
- docs/runbooks/status.md

Next smallest fix:
- Add focused frontend instrumentation and restore-application guard in apps/web/src/app/pages/LearningInterface.tsx so backend-seeded currentCode is force-applied on /practice mount before default draft reset paths can overwrite it; then rerun only tests/e2e/regression/student-multi-device-persistence.spec.ts against production.

## Checkpoint — 2026-03-27 15:29 PDT

Status: **PARTIAL**

Evidence:
- Frontend hydration-order patch applied in `LearningInterface` to avoid split-phase default clobber:
  - session initialization now resolves/restores drafts via one deterministic async bootstrap path
  - backend forced hydration (`storage.hydrateLearner(..., { force: true })`) is awaited before final editor state commit when no meaningful local draft exists
  - restore selection now prefers meaningful drafts over placeholder-only drafts
- Safety build gates passed:
  - `npm run server:build` ✅
  - `npm run build` ✅
- Targeted storage hydration unit tests passed:
  - `npx vitest run apps/web/src/app/lib/storage/dual-storage.test.ts` ✅ (6 passed)
- Deployed blocker spec could not be executed to completion in this shell due deterministic env prerequisites:
  - `npx playwright test -c playwright.config.ts tests/e2e/regression/student-multi-device-persistence.spec.ts --reporter=line --workers=1 --global-timeout=0` ❌
    - failure: `[auth-setup] Backend health check failed for http://127.0.0.1:3001: fetch failed`
  - rerun with deployed base URLs also blocked at setup:
    - failure: `[auth-setup] Deployed auth runs require deterministic env vars: E2E_INSTRUCTOR_EMAIL, E2E_INSTRUCTOR_PASSWORD, E2E_STUDENT_CLASS_CODE`

Changed files (this checkpoint scope):
- `apps/web/src/app/pages/LearningInterface.tsx`
- `docs/runbooks/status.md`

Next smallest fix:
- Provide deterministic deployed auth env (`PLAYWRIGHT_BASE_URL`, `PLAYWRIGHT_API_BASE_URL`, `E2E_INSTRUCTOR_EMAIL`, `E2E_INSTRUCTOR_PASSWORD`, `E2E_STUDENT_CLASS_CODE`, plus bypass secret if preview protected), rerun only `tests/e2e/regression/student-multi-device-persistence.spec.ts`, and confirm assertion at `:267` now restores seeded backend `currentCode`.

## Checkpoint — 2026-03-27 15:49 PDT

Status: **PARTIAL**

Evidence:
- Implemented backend-authoritative restore fallback in `/practice` bootstrap and added backend session snapshot accessor:
  - `apps/web/src/app/pages/LearningInterface.tsx`
  - `apps/web/src/app/lib/storage/dual-storage.ts`
- Added unit coverage for backend session snapshot accessor:
  - `npx vitest run apps/web/src/app/lib/storage/dual-storage.test.ts` ✅ (8 passed)
- Build gates passed after patch:
  - `npm run server:build` ✅
  - `npm run build` ✅
- Frontend deployed to production and aliased:
  - `VERCEL_ORG_ID=team_BxlA36kEPgWxAMjQnJ4DBtQ2 VERCEL_PROJECT_ID=prj_39bY93BbbDoT6A0avxsLNxXtxKra npx vercel deploy --prod --yes` ✅
  - Deployment ID: `dpl_A2Bva2apm8rpZGDYQjUyfoTFqzxK`
  - Production URL: `https://adaptive-instructional-artifacts-dxj0vhxud-hy-d1s-projects.vercel.app`
  - Alias: `https://adaptive-instructional-artifacts.vercel.app`
- First deployed regression rerun showed restore value present but assertion failed due whitespace encoding in Monaco text extraction:
  - expected `SELECT * FROM employees WHERE salary > 70000`
  - received `SELECT * FROM employees WHERE salary > 70000` (non-breaking spaces)
- Normalized Monaco text in test helper (`\u00a0` → space):
  - `tests/helpers/test-helpers.ts`
- Deployed regression gate now passes:
  - `npx playwright test -c playwright.config.ts tests/e2e/regression/student-multi-device-persistence.spec.ts --reporter=line --workers=1 --global-timeout=0` ✅ (`3 passed`)

Changed files (this checkpoint scope):
- `apps/web/src/app/lib/storage/dual-storage.ts`
- `apps/web/src/app/pages/LearningInterface.tsx`
- `apps/web/src/app/lib/storage/dual-storage.test.ts`
- `tests/helpers/test-helpers.ts`
- `docs/runbooks/status.md`

Next smallest fix:
- Run the full deployed launch-smoke gate (`@deployed-auth-smoke` + `student-multi-device-persistence` + `instructor-section-scope` + `api-authz`) to confirm no regressions outside this targeted blocker path.

## Checkpoint — 2026-03-27 17:28 PDT

Status: **PARTIAL**

Evidence:
- Branch created from current dirty worktree without discarding local edits:
  - `git checkout -b feat/local-pdf-ingest-remote-corpus` ✅
  - working state retained (`.gitignore`, `package.json`, `package-lock.json`, untracked `raw_pdf/`, `tests/unit 2/`).
- Start protocol rerun from repo root:
  - `npm run build` ✅ (Vite build completed; chunk-size warnings only)
  - `npm run server:build` ✅
  - `npm run replay:gate` ✅ with `toy: SKIPPED` (`fixture/policy inputs changed`)
- Local ingest environment checks:
  - `source tools/pdf_ingest/.venv/bin/activate && python -V` ✅ (`Python 3.11.15`)
  - `python -c "import docling, mlx"` ✅
  - `python -c "from mlx_lm import load, generate"` ❌ in Codex sandbox (`NSRangeException` / Metal device init)
- Ollama embedding smoke (local host call):
  - `POST http://localhost:11434/api/embed` with `embeddinggemma` ✅
  - `embedding_dimension=768`
- Host metadata captured:
  - `machine=arm64`
  - `os=macOS-26.4-arm64-arm-64bit`
  - `python=3.11.15`
  - `psycopg=3.3.3`

Policy/version contract recorded:
- `LOCAL_CORPUS_PIPELINE_VERSION=v1`
- `source_policy=local_only_raw_remote_processed`
- `embedding_model=embeddinggemma`
- `embedding_dimension=768`

Next smallest step:
- Implement in-repo local ingest worker (`tools/pdf_ingest`) that emits processed-only bundle artifacts to `.local/ingest-runs/<run_id>/`, then add Neon corpus upload/read path and remote/static runtime fallback.

## Checkpoint — 2026-03-27 17:48 PDT

Status: **PARTIAL**

Scope implemented:
- Added local ingest worker package under `tools/pdf_ingest/` (`cli`, `docling_pipeline`, `chunking`, `mlx_enricher`, `export_bundle`, schemas, tests).
- Added Neon processed-corpus schema + runtime read APIs:
  - tables: `corpus_documents`, `corpus_units`, `corpus_chunks`, `corpus_ingest_runs`
  - routes: `GET /api/corpus/manifest`, `GET /api/corpus/unit/:unitId`, `POST /api/corpus/search`
- Added frontend remote/static corpus mode integration:
  - `VITE_TEXTBOOK_CORPUS_MODE=static|remote`
  - concept loader now prefers remote corpus when configured, then falls back to static textbook assets.
- Added scripts/docs/tests:
  - npm scripts: `ingest:setup`, `ingest:extract`, `ingest:upload`, `ingest:smoke`, `corpus:verify`
  - docs updated: `README.md`, `docs/DEPLOYMENT.md`

Build/test evidence:
- `npm run server:build` ✅
- `npm run build` ✅
- `npm run replay:gate` ✅ (`toy: SKIPPED`)
- `npx vitest run apps/web/src/app/lib/content/concept-loader.test.ts tests/unit/server/neon-corpus.contract.test.ts` ✅ (39 passed)
- `source tools/pdf_ingest/.venv/bin/activate && PYTHONPATH=tools/pdf_ingest/src python -m pytest -q tools/pdf_ingest/tests/test_bundle_schema.py tools/pdf_ingest/tests/test_upload_idempotency.py` ✅ (2 passed)
- `npm run ingest:setup` ✅
- `LOCAL_PDF_SOURCE_DIR=raw_pdf npm run ingest:extract` ❌
  - Docling reported input PDF invalid and emitted empty markdown (`ConversionStatus.FAILURE`) for `dbms-ramakrishnan-3rd-edition.pdf` in this environment.

Policy/version logging:
- `LOCAL_CORPUS_PIPELINE_VERSION=v1`
- `source_policy=local_only_raw_remote_processed`
- `embedding_model=embeddinggemma`
- `embedding_dimension=768`

Unverified / blockers:
- Real local extraction on provided textbooks is blocked by Docling parse failure in this environment.
- Neon upload smoke (`ingest:upload`, `corpus:verify`) is unverified in this run due no successful local bundle extraction.
- Sample real remote `doc_id` and `run_id` pending first successful ingest+upload run.
