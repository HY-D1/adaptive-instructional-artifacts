# AGENTS.md — Adaptive Instructional Artifacts (SQL-Adapt)

> **⚠️ BEFORE READING THIS FILE**: Read [`PROJECT_COORDINATION.md`](./PROJECT_COORDINATION.md) first for file organization rules and mandatory checklists.
>
> Purpose: single source of truth for AI coding agents working on the SQL-Adapt project.
> Use this file to stay aligned with the current architecture, launch priorities, and research scope.
> Work from the current codebase and provided files only. Do not guess.

---

## 1) Mission

Build a working, deployable adaptive SQL learning system plus defensible experimental evidence by **April 30, 2026**.

This project is not just a demo. It must support:

- real student and instructor accounts
- durable progress across devices
- instructor visibility into their own students
- adaptive hint → explanation → textbook flow
- replay/export/evidence for analysis and paper/demo artifacts

The project is already past the “invent new components” stage.
The priority is integration, correctness, deployability, and analyzable logging.

---

## 2) Current phase and active priorities

### Current phase
**Public-launch hardening + study-readiness integration**

### Highest-priority goals right now
1. Make account-based login truly **multi-device**
2. Make **Neon** the durable system of record
3. Scope instructor dashboards and research views to the instructor’s own students
4. Keep the adaptive learning loop stable and demoable
5. Finish export/replay/evidence so results are reproducible

### Core deliverables to finish fully
- Adaptive orchestration + escalation profiles
- Automatic textbook / “My Textbook”
- SQL-Engage concept + error grounding
- Controlled LLM usage with deterministic fallback
- HDI
- Experimental conditions
- Replay/export/evidence pipeline
- Instructor dashboard reading real backend data

### Reduce to minimal v1
- One simple reinforcement loop only
- One small static prerequisite DAG only
- Error trajectory modeling as offline analytics first
- Research dashboard: **4 robust panels**, not 12
- PDF helper: freeze unless a concrete concept gap blocks the demo

### Keep deferred or shadow-only unless explicitly requested
- Live bandit as the primary research claim
- Multiple new runtime control layers
- Major helper/pipeline expansion
- Broad dashboard redesigns
- New architecture rewrites

---

## 3) Non-negotiable working rules

### A. File-first, repo-first
- The current codebase and uploaded files are the source of truth.
- Read relevant files before proposing changes.
- Never invent file paths, APIs, env vars, DB tables, fields, scripts, or test results.
- If something is missing, say **Unverified** and state the smallest check needed.

### B. Status-first
Before changing code, check these first if they exist:

1. `docs/runbooks/status.md` - Current project status
2. `docs/INDEX.md` - Documentation navigation
3. `docs/CHANGELOG.md` - Recent progress and decisions
4. `docs/DEPLOYMENT.md` - Deployment guide
5. `docs/DEPLOYMENT_MODES.md` - Deployment modes
6. relevant route/db/auth/test files

Do **not** reintroduce week-by-week progress files as the main status system.
Use the single durable status/runbook docs instead.

### C. Verify before claiming
Never say something “works” unless you verified it with code inspection, commands, or tests.

At minimum, when relevant:
- frontend build
- backend build
- targeted tests
- auth/persistence checks
- replay/export gate if touched

### D. Minimal-change bias
- No unrelated refactor
- No stack switch
- No renaming modules or boundaries unless required
- Preserve current user workflows unless the task explicitly changes them

### E. No fabricated outputs
Never invent:
- build results
- deployment results
- API behavior
- Neon contents
- Vercel behavior
- test pass/fail status
- logs or screenshots

### F. Update the whole contract when behavior changes
If you change schema/API/auth behavior, also update:
- callers
- types
- tests
- docs
- migrations/init steps
- export/logging fields where relevant

### G. Never auto-commit or auto-push
When work is ready, suggest a commit.
Do not commit or push unless explicitly asked.

---

## 4) Project architecture

## 4.1 High-level deployment shape

### Preferred deployment shape for this deadline
- **Frontend**: `apps/web` on Vercel
- **Backend**: `apps/server` deployed separately
- **Database**: Neon PostgreSQL
- **Frontend → Backend**: via `VITE_API_BASE_URL`

Do not re-platform the whole system unless explicitly requested.

### Backend deployment shape
Backend should stay compatible with:
- `apps/server/src/app.ts` — app construction only
- `apps/server/src/index.ts` — local dev startup
- `apps/server/api/index.ts` — deployment/serverless entry

---

## 4.2 System-of-record rule

**Neon is the durable source of truth.**

Local storage may be used as:
- cache
- fallback for dev/offline paths
- UI convenience

Local storage must **not** be treated as the authoritative source for:
- learner history
- textbook units
- session continuity
- instructor dashboard data
- research exports

If the system claims “works across devices,” that must come from backend persistence, not copied browser storage.

---

## 4.3 Auth and security model

### Current intended model
- account-based signup/login for students and instructors
- JWT cookie auth
- CSRF protection for mutating authenticated requests
- explicit CORS allowlist
- production-safe cookie settings for cross-origin frontend/backend

### Required security rules
- no wildcard CORS with credentials
- use allowlist parsing from env
- protect mutating authenticated routes with CSRF
- protect instructor-only routes with role checks
- do not trust learner IDs from the frontend when auth context already exists

### Production auth expectations
- student signup gated by student/class code
- instructor signup gated by instructor code
- auth must survive refresh/new browser/device when backend is healthy

---

## 4.4 Multi-user data ownership model

The project must support instructor-owned student groups.

### Target model
Prefer explicit section ownership:

- `course_sections`
- `section_enrollments`

At minimum, the system must support:
- instructor creates or owns a section
- student joins via code/link
- section linkage persisted on sessions and new events
- dashboard/research queries limited to instructor-owned students

### Critical rule
If instructor scoping is not persisted in the database, instructor dashboards are not trustworthy.

---

## 4.5 Adaptive learning runtime

### Core learner flow
1. learner attempts SQL task
2. error / struggle detected
3. hint ladder escalates as needed
4. explanation shown when justified
5. note/unit saved into “My Textbook”
6. future sessions can resurface support

### Keep strong
- hint → explanation → textbook flow
- provenance and source grounding
- deterministic fallback when LLM path is unavailable
- HDI and logged adaptive signals

### Keep minimal
- one reinforcement loop
- one prerequisite detector
- shadow-mode or optional adaptive experimentation only if stable

---

## 4.6 Research and evidence path

This project needs a research-grade export/replay path, not just a runtime demo.

### Must support
- export of real traces
- replay across 2–4 strategies/policies
- reproducible metrics bundle
- dashboard numbers that match raw events
- figures/tables that can be regenerated from commands

### Core metrics to preserve
- explanations shown
- average escalation depth
- HDI
- concept coverage
- time-to-success proxy
- reinforcement accuracy if available

---

## 5) Repo map

This repo is a two-part application.

```text
apps/web/
  Vite + React frontend
  student learning interface
  textbook UI
  instructor dashboard
  research dashboard
  frontend auth/bootstrap/storage/cache logic

apps/server/
  Express/Vercel-compatible backend
  auth routes
  learner/session/interaction/textbook persistence routes
  Neon DB access
  export scripts
  middleware for auth/csrf/security

docs/
  deployment docs
  status/runbooks
  architecture notes
  demo guidance

tests/
  Playwright E2E
  integration/regression specs

scripts/
  replay/export/index/check utilities


### Files agents will commonly need

* `docs/INDEX.md` - Start here to find relevant docs
* `docs/CHANGELOG.md` - Recent changes and decisions
* `docs/runbooks/status.md` - Current project status
* `docs/DEPLOYMENT.md` - Deployment guide
* `docs/DEPLOYMENT_MODES.md` - Deployment modes
* `apps/server/src/app.ts`
* `apps/server/src/index.ts`
* `apps/server/api/index.ts`
* `apps/server/src/routes/auth.ts`
* `apps/server/src/routes/neon-*.ts`
* `apps/server/src/routes/research.ts`
* `apps/server/src/middleware/auth.ts`
* `apps/server/src/middleware/csrf.ts`
* `apps/server/src/db/*.ts`
* `apps/web/src/app/lib/auth-context.tsx`
* `apps/web/src/app/lib/storage/dual-storage.ts`
* `apps/web/src/app/lib/api/*`
* `apps/web/src/app/pages/InstructorDashboard.tsx`
* `apps/web/src/app/components/features/research/ResearchDashboard.tsx`
* `tests/e2e/**`
* `apps/server/src/scripts/export-research-data.ts`

---

## 6) What agents should prioritize next

When multiple tasks compete, prefer this order unless the user says otherwise.

### Priority 1 — section ownership + access control

* persist instructor/student ownership linkage
* enforce instructor-only scope in learner/research endpoints
* reject cross-learner access by students
* ensure section linkage exists on new sessions/events

### Priority 2 — real multi-device persistence

* hydrate learner state from backend on fresh login
* resume progress from Neon on a different device/browser
* persist sessions/interactions/textbook content
* treat local storage as cache only

### Priority 3 — instructor dashboard reads real backend data

* remove production reliance on demo/local fallback
* load only instructor-owned learners
* make research views consistent with backend records

### Priority 4 — real end-to-end proof

* second-device persistence tests
* instructor section-scope tests
* authz tests for blocked access
* deploy smoke tests against real URLs

### Priority 5 — evidence pipeline

* export script quality
* replay reproducibility
* metrics bundle correctness
* event schema stability

---

## 7) Build, run, and verification commands

Run the smallest meaningful set for the task.
Do not claim commands passed unless they actually passed.

### Frontend

```bash
npm run dev
npm run build
```

### Backend

```bash
npm run server:dev
npm run server:build
npm run server:start
npm run server:db:init
npm run server:db:migrate
```

### Tests

```bash
npm run test:unit
npm run test:e2e
npm run test:e2e:weekly
npm run test:e2e:no-external
npm run test:e2e:integration
```

### Replay / export / validation

```bash
npm run replay:gate
npm run replay:gate:update
npm run replay:experiment
npm run replay:from-fixture
npm run check:concept-map
npm run validate:corpus
npm run textbook:verify
```

### Deployment helpers

```bash
npm run vercel:pull
npm run vercel:build
npm run vercel:preview
```

### Minimum default verification for most backend/frontend changes

```bash
npm run server:build
npm run build
```

Add targeted tests depending on the change.

---

## 8) Testing rules

### General rule

Tests must prove the claim being made.

### If the claim is “works across devices”

A valid proof must include:

* clean browser/context B
* fresh login on context B
* data loaded from backend
* no reuse of copied local storage as the main proof

### If the claim is “instructor sees only their students”

A valid proof must include:

* at least two instructors or two sections
* students in separate sections
* explicit check that instructor A cannot see section B data

### If the claim is “route is protected”

A valid proof must include:

* expected success case
* expected 401/403 case
* role mismatch or ownership mismatch case

### Required test types by change

* auth/signup/login changes → contract + route tests
* persistence changes → backend + E2E hydration tests
* dashboard changes → scoped integration/E2E tests
* export/logging changes → export/replay verification

### Flaky test rule

Do not mark a test flaky as a first move.
Try to fix:

* selectors
* timing
* environment assumptions
* backend/bootstrap state
* test data isolation

Only mark flaky if the root cause is real and documented.

### E2E Test Suite Status

See `docs/runbooks/status.md` for current test metrics.

**Current State**: 30/30 critical tests passing (100%), 91% overall pass rate.

Key test patterns for this codebase:

| Pattern | Use When |
|---------|----------|
| `syncLocalStorage(from, to)` | Cross-tab sync tests (Playwright doesn't auto-sync) |
| `page.evaluate()` for storage | Immediate storage manipulation (preferred over `addInitScript()`) |
| `verifyDataIntegrity()` without `expectedSessionId` | Session IDs change on reload, data must persist |
| Broad event type filters | App generates `'execution'`, `'query_submitted'`, `'error'` etc. |
| Fallback seeding | When UI path unreliable (e.g., "Save to Notes" button) |

---

## 9) Data and logging rules

### Logging principles

* log enough to reconstruct learner behavior and policy effects
* keep schema stable once pilot/final period starts
* never silently drop critical identifiers if a feature depends on them

### Important identifiers

Preserve and verify where appropriate:

* `learnerId`
* `sessionId`
* `sectionId`
* `problemId`
* event timestamps
* policy/profile identifiers
* provenance/source references for guidance/textbook
* export metadata versions

### Event-schema rule

If you change event shape or semantics:

* update export code
* update replay code
* update docs
* update tests
* note migration/compat handling

---

## 10) Security and privacy rules

### Required protections

* role checks
* ownership checks
* CSRF on mutating authenticated routes
* explicit origin allowlist
* secure cookie behavior in production
* do not expose instructor-only data to student clients

### Frontend safety

* sanitize rendered rich content
* preserve safe markdown/html rendering
* do not expose server secrets in Vite env
* only use `VITE_*` for intended public config

### Research/privacy caution

* do not expose unnecessary raw learner data in public-facing UI
* keep exports intentional and documented
* do not widen research endpoints casually

---

## 11) Deployment and env rules

### Frontend env

* `VITE_API_BASE_URL`
* any other public frontend toggles only if truly public-safe

### Backend env

Use only verified env names from the codebase/docs.
Common examples may include:

* `DATABASE_URL`
* `JWT_SECRET`
* `STUDENT_SIGNUP_CODE`
* `INSTRUCTOR_SIGNUP_CODE`
* `CORS_ORIGINS`

Do not invent additional env vars without updating:

* server config
* docs
* deployment instructions

### Deployment rule

A deploy is not “done” until:

* backend reachable
* frontend points to correct backend
* auth works
* persistence works
* instructor scope works
* smoke test is run

---

## 12) Anti-goals

Agents should actively avoid these unless explicitly requested.

* no broad architecture rewrite
* no new major adaptive subsystem just because it sounds interesting
* no “dashboard 2.0” expansion beyond what is needed
* no heavy helper/pipeline research detours
* no replacing the current frontend/backend split during launch hardening
* no claiming multi-device support based only on local browser state
* no claiming instructor analytics are ready without DB-backed ownership scoping
* no new week-specific progress doc sprawl

---

## 13) Working style for AI agents

### Default behavior

* inspect first
* propose minimum viable change
* implement only what the task needs
* verify with commands/tests
* report actual results
* call out remaining risks honestly

### If something is uncertain

Use this format:

* **Unverified**
* what is missing
* smallest check needed to confirm

### If a major decision is needed

Provide:

* recommended option
* fallback option
* why

Do not silently choose a major direction when the codebase does not justify it.

---

## 14) Required response format for engineering tasks

For implementation/audit/debug tasks, use this structure unless the user explicitly wants something else.

### RULES_DIGEST
What repo rules are active for this task.

### CURRENT_STATE
What the code appears to do now, with verified evidence only.

### ROOT_CAUSE / GAP
What is missing or broken.

### FILES_TO_CHANGE
- `path/to/file` — why
- `path/to/file` — why

### PLAN
1. ...
2. ...
3. ...

### IMPLEMENTATION
What changed.

### TESTS_RUN
- command
- actual result
- or explicit reason not run

### RISKS / UNVERIFIED
- remaining risk
- missing verification
- edge cases not covered

### COMMIT_SUGGESTION
```bash
git add ...
git commit -m "type: short summary"

```

---

## 15) Codex / agent thread mode

If the user asks for:
- codex
- agent
- audit
- fix bugs
- check every function
- thread

Output should be paste-ready as a multi-message thread.

### Thread header
Include:
- repo name
- goal summary
- thread start protocol:
  1. read status docs
  2. run build
  3. run replay gate if relevant
  4. collect failing evidence

### Each message block
Use:
- `Message i/n — <workstream>`
- `Evidence`
- `Implement`
- `Acceptance`
- `How to test`
- `Versioning/logging`

### Final deliverable format
- summary
- files changed
- how to test
- what was logged / versions bumped
- risks / assumptions

---

## 16) Definition of done for this phase

This phase is done only when all of the following are true:

### Public-launch readiness
- student and instructor signup/login work in deployed mode
- backend and frontend are both deployed correctly
- auth survives refresh and new browser/device
- production env vars are correctly configured

### Multi-device persistence
- learner signs in on device A
- creates progress/data/notes
- signs in on device B
- state is restored from Neon
- local storage is not the only reason the state appears

### Instructor trustworthiness
- instructor sees only their own students
- dashboard numbers match raw events
- research/export queries are scoped appropriately

### Research readiness
- export command works reproducibly
- replay command produces stable outputs
- key metrics are defined and recoverable from logs

### Demo readiness
You can demo:

`student login → practice → adaptive help → textbook save → instructor dashboard → export/replay output`

---

## 17) Short checklist before claiming completion

Before saying “done,” check:

- [ ] read current status doc
- [ ] inspected relevant files
- [ ] changed minimum necessary files
- [ ] updated tests/docs if contract changed
- [ ] ran build(s)
- [ ] ran targeted tests
- [ ] did not fabricate results
- [ ] called out remaining risks
- [ ] provided commit suggestion only

---

## 18) Final reminder

This project wins by being:
- integrated
- deployable
- trustworthy
- analyzable
- finishable by April 30

Prefer small, verified, study-ready improvements over ambitious new subsystems.
