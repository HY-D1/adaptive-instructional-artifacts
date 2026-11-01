# SQL-Adapt Changelog

> **Single Source of Truth for Project Progress and Decisions**
> 
> Format: [Keep a Changelog](https://keepachangelog.com/)  
> Last Updated: 2026-10-31

---

## [Unreleased] - Harderning/Research-Grade-Tightening

### 2026-11-01 — Minimum PR gate verified

PASS: GitHub run41357318093 on cb0117e. Both E2E shards green (5PASS24.6s;
4PASS15.2s), Unit Tests green (119files/2040passed/2skipped), Quick Smoke green,
Consolidate Test Results green. Production frontend/backend build/type checks
remain included. No new runtime changes after3da23b4. This follow-up is docs-only.

Coverage boundary: full weekly run41356479083 is NOT green: shard1 reached600s
with202passed/60unrun; shard2 reached600s with86passed/7failed/64unrun. Failures
include remaining role/navigation/logout assertions and offline queue/session
scenarios. These remain unresolved full-suite findings; reducing the PR gate at
the user's explicit request does not fix them or establish broad merge safety.
Do not describe all browser tests as passing or the whole release as verified.
Minimal core PR checks PASS; comprehensive regression/production readiness PARTIAL.
Re-enable full weekly via manual dispatch suite=weekly for that separate work.

### 2026-11-01 — User-requested minimum PR browser gate

User explicitly requested minimum tests and test-only corrections for remaining
checks. No further frontend/backend/database runtime changes in this step.
PR/push browser gate now selects9 existing assertions: practice startup, hint-event
persistence, editor draft recovery across textbook navigation, mobile welcome,
cross-tab profile identity, student/instructor textbook access, anonymous practice
rejection, and student research rejection. Exact local CI/dev command PASS9/9 in
21.9s, with retries disabled. Both shard job names and required consolidation stay.
Full unit suite/backend build/production frontend build/type smoke remain required.
Full weekly selection remains available via regression-gate workflow_dispatch with
suite=weekly. This is an explicit reduction in PR browser coverage, not a claim
that all previously unrun/failing weekly cases are fixed. No test was deleted or
assertion weakened. Existing unverified/full-suite results remain historical.
Run41356479083 on3da23b4 still had both browser jobs in progress at this checkpoint;
unit and quick smoke passed. Latest workflow-only commit will receive its own CI
result. No PR merge, production writes, deployment or release-control changes.
Only regression-gate.yml and this checkpoint changed; git diff --check PASS.

### 2026-11-01 — PR32 offline header compatibility

Previous run41355375830 shard2 finished with8 failures/45passed and the600s
suite cutoff. The completed failures show storage-only sessions missing header
links/badges: RootLayout checked backend authUser even with no backend configured.
Restore signed-in header visibility from the existing synced storage profile only
in offline mode; account mode remains exclusively backend-authenticated.
Existing exact failed browser checks PASS3/3 (cross-tab profile sync and both
student/instructor textbook access),13.3s. RootLayout focused unit PASS5/5,
including a new no-backend/no-authUser local session regression. Final frontend
build and tsc results tracked with follow-up CI. No test assertions weakened.
Changed RootLayout.tsx/test only plus checkpoint. Current final-runtime GitHub run
must complete before merge readiness is claimed; earlier successful load rehearsal
is not evidence for these additional runtime fixes. Reuse it for unaffected API
load behavior, but refresh the affected browser checks before production cutover.

### 2026-11-01 — PR32 follow-up from complete shard evidence

Run41355375830 on a95db1a: unit PASS2039/2skipped, quick smoke PASS.
Shard1 completed all262 tests (245PASS/17FAIL) in6.6m, no suite timeout. Remaining
failures exposed developer-test/build-mode mismatch: static/diagnostic/debug
settings are intentionally DEV-only but CI served a production build. Preserve
production debug restrictions; opt weekly offline developer checks into the local
dev server with PLAYWRIGHT_LOCAL_DEV=true. Production build still runs separately;
deployed tests/default preview selection are unchanged. No specs/assertions removed.

Also defer profile assignment until matching session config exists (avoid logging
bandit_blocked_for_condition before config is ready), and default explicit offline
demo/test sessions to adaptive so local strategy settings remain selectable.
Configured account assignments and control/adaptive rules remain unchanged.
Focused exact failures PASS6/6 browser checks14.2s using dev server; focused unit
checks PASS70/70; CI-style build and frontend tsc PASS. Follow-up full CI pending.
The previous shard2 was still running when follow-up was prepared; do not claim
its result passed. Changes: four bounded implementation/workflow/config lines
plus this checkpoint. Automatic production promotion remains disabled.

### 2026-11-01 — PR32 regression-gate correction

Status: PARTIAL pending the complete GitHub two-shard run. PR32 run41353021329
failed in both browser shards; consolidation correctly propagated their failure.
CI traces pinpointed null conceptsCovered in prerequisite monitoring. The same
indicators test failed locally before the fix. Local profile initialization had
been removed for account hydration safety, also unintentionally affecting offline
practice. Restore only offline initialization, guard missing monitoring profiles,
and rerun monitoring on session/hydration readiness. Account mode still waits for
backend profiles and never seeds empty replacements.

After the null fix, browser execution reproduced another failure: offline tests
requested durable condition assignments from absent localhost3001. Explicit
local demo/test mode now uses the existing deterministic assignment implementation
and tab session cache; configured account mode retains the strict durable loader.
A focused boundary test proves configured accounts cannot use offline assignment.
The first new profile test incorrectly compared pre/post-storage version shapes;
corrected to compare the actual persisted snapshot without changing old assertions.

Workflow retains all weekly tests, both shards and Playwright's one retry. Removed
outer --last-failed rerun (it repeated failures and could omit interrupted tests).
Emit/upload per-shard JSON and make missing reports or non-success dependencies
fail consolidation. No increased timeout, excluded tests or dependency changes.
Files: LearningInterface.tsx/test, condition-assignment.ts/test,
.github/workflows/regression-gate.yml, this checkpoint.

Verification: CI-style VITE_TEST_MODE=true npm run build PASS; frontend tsc PASS;
representative Chromium indicators, hint persistence and mobile welcome checks
PASS3/3 in5.3s after both fixes. Focused Vitest PASS70/70 across2 files.
Replay comparison remains SKIPPED. git diff --check PASS. Backend checks reused;
no backend/migration/configuration change. No PR merge or production release.
Automatic production promotion remains disabled. Original eight untracked files
preserved. Next: one complete GitHub run; investigate remaining distinct failures
before claiming PR merge readiness. Rollback is reverting this bounded commit;
production database remains untouched.

### 2026-11-01 — Safe-to-merge staging gate

**SAFE TO MERGE INTO STAGED MAIN: PASS. Production cutover: PENDING.**
Runtime under review remains 8991e4d; branch checkpoint before this entry is
73d7988. `git fetch origin main test_branch/system-stable-test` confirms main
f32b4b2 is fully included (four ahead/zero behind). Existing runtime tests and
50-user results above are reused because runtime inputs are unchanged.

Authorized Vercel changes, read back successfully:
- Frontend prj_39bY93BbbDoT6A0avxsLNxXtxKra: autoAssignCustomDomains=false.
- Backend prj_vR3HTHqulLCVqv5EnSMfnStWP4cZ: autoAssignCustomDomains=false.
- Backend future production builds: MAINTENANCE_MODE=true, production-only.
  Current serving deployment was not redeployed; no database/auth/provider values
  changed. The connector returned403 for the env write; authenticated CLI fallback
  succeeded and decrypted readback verified only this non-secret flag.

Before/after project metadata comparison PASS: Git connections/production branch,
all current production aliases and deployment IDs unchanged. Production still
runs f32b4b27057f2ada81da18b80cc64806f886bfbb:
frontend dpl_BXQeScTqbXqe7n2YXejW8GkSbCwm;
backend dpl_2mw88NrbRUYXW87sXAucqMfuPtyi.
Read-only probes confirm frontend200 and unauthenticated backend /api/auth/me401.
No production accounts, migrations or data writes were performed.

Created isolated maintenance preview dpl_2ux5UfcCCoJoeD1nEpKqVCCevkMm:
https://adaptive-instructional-artifacts-api-backend-g9qs94953.vercel.app
It uses the existing rehearsal copy and fresh private operator key, not production
credentials. Direct-URL probes PASS: /api/auth/me, POST /api/interactions,
/api/surveys/complete, /ollama/api/tags and POST /ollama/api/generate all503,
Retry-After60. Valid operator bypass on /api/research without authentication401.
Existing focused tests cover authorization/CSRF enforcement. Preview build PASS.
Installed CLI help confirms --skip-domain disables automatic production promotion;
project settings use Vercel's documented staged deployment workflow. Actual merged
production artifacts are intentionally deferred until the user's manual merge.

Commands/checks: git fetch and rev-list; scoped vercel project GET/PATCH;
production-only MAINTENANCE_MODE upsert/readback; isolated vercel deploy
--target preview; private read-only maintenance/routing probes; git diff --check.
Private scripts and non-secret metadata are under /tmp/sql-cutover-prepare;
credentials stay0600 and are not committed. No runtime code changed this step.
All eight original unrelated untracked files remain untouched.

Next gate after USER manual PR/merge (no PR created here):
1. Verify merged SHA and staged production artifacts; production frontend must
   bind to the production backend. Preserve current DB URL and signing secrets.
2. Prepare maintenance-on/off merged backend builds and an old-source rollback
   artifact with only the tested maintenance guard added. Verify each before use.
3. Prepare controlled old-code instructor/control/adaptive verification identities;
   never reset real passwords. Production account creation is deferred until the
   explicitly started cutover preparation, and must precede migration.
4. On explicit maintenance-start instruction only: promote maintenance backend,
   identify/pause all other writers/direct endpoints, drain writes and prove quiet.
   If any writer cannot be paused, stop before migration.
5. Create fresh recovery branch from verified production DB, capture consistent
   original-row/column fingerprints, apply exactly the four manifest migrations
   in one transaction (strip nested wrappers), lock5s/statement60s, compare before
   functional writes. Require zero missing/changed original records.
6. Operator smoke tests cover old/new students, surveys, conditions, hints, notes,
   retry/deduplication, refresh, instructor scope and cross-user denial. Preserve
   survey requirements; do not fabricate external survey responses. Then release
   matching artifacts and verify aliases. Old browser tabs must refresh for the
   explicit full-profile revision contract. Reuse rehearsal load; no prod load.

Failure/rollback: keep maintenance active, roll back failed migration transaction,
restore prepared maintenance-capable old application when required. Retain
additive structures and committed activity; never overwrite prod with rehearsal.
Do not blindly re-enable automatic promotion or promote the current old deployment
as a way to bypass maintenance. Release hold remains until deliberately restored.
Fresh recovery point and production data comparison are NOT yet done. Existing
LLM/role concerns and replay SKIPPED remain documented; no blanket security or
production-cutover PASS claim is made. No new topics. User handles PR/merge.

### In progress - 2026-11-01 (final exposure and compatibility audit)

**Status: PARTIAL; production cutover is not authorized by this checkpoint.**
Runtime changes are on top of `bfd3f16`, integrated with main `f32b4b2` (two
commits ahead, zero behind at baseline). No PR, production migration, production
configuration change or production promotion occurred. Eight unrelated original
untracked files are preserved. No dependencies or exercise topics were added.

Confirmed minimal fixes:
- Maintenance now covers legacy Ollama tags/generate aliases. The regression
  reproduced HTTP 200 under maintenance before the fix; focused checks PASS 7/7.
  Operator bypass still requires ordinary authentication/authorization/CSRF.
- Identified profile events now claim a shared database ledger and update profile
  evidence atomically with revision checking. Retry queues retain failed events,
  original IDs, code and success, and only remove the acknowledged snapshot IDs.
  Legacy event/progress requests without IDs retain their historical semantics.
- A real stale snapshot reproduced a newer profile count being replaced (5 to 4).
  User selected explicit rejection/reload/retry. Full-profile PUT now requires
  `expectedRevision`; missing returns 428, stale returns 409 plus latest profile.
  Frontend carries `serverRevision`, reloads conflict state, warns the user and
  does not blindly replay rejected snapshots. Older open frontend tabs must
  refresh; this is an intentional API change, not an account/data migration.
  Both research contract constants are v2.6.0. Real Neon checks verified a stale
  write cannot replace evidence and exactly one same-revision concurrent save wins.
- Survey-aware load/browser checks use real signed invitations and test-only
  completion callbacks. They preserve pre-survey enforcement and current
  control/adaptive assignment. Test callback traffic is not a Qualtrics submission.

Data preservation rehearsal PASS on fresh isolated Neon branch
`br-cool-glitter-anetgfgy` (`migration-rehearsal-20261101`), project
`ancient-star-01392879`, copied from `br-delicate-glitter-an2fuzzq`.
Controlled returning instructor/control/adaptive accounts were created using
archived main services before migration, including usernames, password hashes,
assignments, notes, session drafts and answers. An initial setup failed because
of an incorrect saveSession helper arity; corrected to the actual signature.
Partial synthetic records remain only in the disposable copy.

All four production-manifest migrations ran transactionally with lock_timeout=5s
and statement_timeout=60s on the copy only. Before functional activity, consistent
counts and SHA-256 fingerprints over original columns compared **124170 original
rows across 20 tables: zero missing rows and zero changed original values**.
Private aggregate proof files: /tmp/sql-final-rehearsal/before-migration.json and
after-migration.json. No historical totals were reconstructed. The historical
UUID-default migration remains excluded from the production manifest.

Tested isolated deployments (source: bfd3f16 plus this checkpoint's runtime diff):
- Backend dpl_BXAQUuvKV1FdVFDgnLLyMPkE51QM:
  https://adaptive-instructional-artifacts-api-backend-54jshoybi.vercel.app
- Frontend dpl_38vghM7Lp2eQrHnXJwTUBd435oZd:
  https://adaptive-instructional-artifacts-alpyl8pem-hy-d1s-projects.vercel.app
- Dedicated rehearsal alias:
  https://adaptive-instructional-artifacts-rehearsal-hy-d1s-projects.vercel.app

Deployment-specific environment binds the backend to the copy and frontend to
that exact backend, with fresh test signing secrets, AUTO_SCHEMA_INIT=false,
maintenance disabled, LLM/provider credentials disabled, and invalid-domain
survey destinations. Shared preview variables and production aliases unchanged.
Served entry/preload assets contained none of the exact private database/auth/
survey keys checked; this is a limited asset check, not blanket leak clearance.
Credentials remain in private temporary state (0600), never in source/report.

Verification:
- `npx --no-install vitest run --silent`: PASS 120 files, 2038 passed, 2 skipped.
  Previous nonsilent runs encountered Vitest EnvironmentTeardownError in console
  forwarding for progress-persistence integration; final silent run completed 0.
- `npm run build`, `npm run server:build`, frontend `tsc --noEmit`: PASS.
- Focused harness checks after condition validation: PASS 11/11.
- `npm run replay:gate`: **SKIPPED**, inputs changed; baseline not updated.
- Hosted returning instructor/control/adaptive API checks PASS: old credentials,
  identity, assignments, saved work, survey block/completion, instructor section
  scope, CSRF, anonymous denial, cross-student denial, stale PUT409 and retry200.
- Real Neon duplicate-event proof PASS: 20 duplicate deliveries plus 3 distinct
  IDs apply exactly 4 profile effects and 4 progress attempts.
- New-student browser workflow PASS: register, survey gate/completion, logout/
  login, incorrect/correct query, hint, note, refresh and clean-context readback.
  Initial browser attempt failed because the test checked welcome-dialog visibility
  before it appeared; helper now waits for the actual dialog. No UI bypass added.
  Returning control/adaptive browser checks also PASS 2/2 (49.2s), including
  clean-context recovery. Their initial test attempt correctly encountered the
  existing post-survey logout reminder; the test now chooses Log out anyway.
  New-account check PASS separately (23.6s); runtime identical for all checks.
- One integrated 50-user API run PASS: run 1793568017497-183c9082, 5 cycles over
  300000ms (306439ms including setup), adaptive23/control27, 3302 requests,
  throughput10.78 requests/s; zero unexpected errors, 429s, 5xx or timeouts.
  Signup p50/p95/p99=1679/1763/2162ms; login=522/624/1467ms.
  Every step p95<5000ms; session-save p95=326ms, progress-write224ms,
  profile-write275ms, note-save178ms. Intentional survey/cross-user403s passed.
  Interrupted successful response then identical-ID retry produced no duplicate
  events/attempts. Session/code/notes readback matched every cycle. Final direct
  database readback confirms all50 profile counts, profile/progress ledgers and
  attempt counts equal exactly5. A first readback query used the wrong account
  join column; corrected against auth.ts before obtaining the passing result.
  Artifact: dist/beta/50-student-readiness/1793568323952-local-auth.json.
  This is an API workload, not 50 browsers or a provider-outage simulation.

Pre-existing source concerns remain explicitly limited: student-owned learner
role updates can create users/auth_accounts inconsistency (privilege escalation
not demonstrated); unauthenticated LLM routes may permit provider spending when
LLM is enabled (not exercised live). Production exposure/provider logs, real
Qualtrics, full security clearance and production cutover remain Unverified.
Hint provider latency/failure was not measured because rehearsal LLM is disabled.

Rollback/cleanup: restore prior matching frontend/backend deployments on failure;
retain additive tables/claims and legitimate activity. Never restore the copy
onto production or reset historical rows. Keep the dedicated preview/copy for
review; later delete only these disposable resources and revoke their test keys.
Do not log private credentials or run setup/migrations again against production.
Final diff whitespace check PASS; exact private-value scan of all23 changed
tracked files found zero matches. Main was fetched again and remains fully
included (HEAD two ahead, zero behind before this commit); author HY-D1.
Selected classroom persistence workflow and migration rehearsal PASS on the
same runtime revision. Overall release remains PARTIAL because replay checksum,
provider/live-survey/security boundaries above are not fully verified. Reviewed
runtime/test changes committed and pushed as `8991e4d` (author HY-D1) to
`test_branch/system-stable-test`, without a PR. Both isolated deployments above
contain the runtime represented by that commit; later test-only timing and
returning-account checks do not change deployed runtime. Final tracked working
tree is clean; all eight original unrelated untracked files remain.
Production needs the separate maintenance,
identity/recovery-point checks, migration comparison and explicit cutover gate.

### In progress - 2026-11-01 (current-main compatibility and migration safety)

**Status: PARTIAL. Production migration is not verified or performed.**
The earlier pilot commit `913f651` was pushed with the user's requested message.
It is based on `9112c5a`; fetched current `origin/main` is `f32b4b2`, 41 commits
ahead of that base. The current production backend is also built from f32b4b2.
`git merge --no-commit --no-ff origin/main` is in progress on the test branch,
preserving both histories and all eight unrelated untracked files. No PR was
created or merged. Current-main features include readable usernames, surveys,
control/adaptive conditions, and shared bandit behavior; the old pilot evidence
must not be presented as validation of this integrated version.

Frontend resolutions preserve both sides' behavior and move the three unique
restore tests into main's existing LearningInterface.test.tsx; focused checks
passed (3 files, 68 tests and frontend TypeScript). Atomic signup now shares the
readable username generator and retries username collisions without swallowing
email conflicts. Signup/manifest focused checks passed (3 files, 13 tests).
The production migration manifest includes event columns, signup counters and
progress deduplication only; the historical UUID fallback remains on disk but is
excluded. A guarded follow-up migration removes only that pilot default on
rehearsal databases where it was previously installed. Original usernames are
not rewritten. Full integrated validation remains outstanding.

Created authorized fresh Neon rehearsal copy `migration-rehearsal-20261101`,
branch `br-cool-glitter-anetgfgy`, parent `br-delicate-glitter-an2fuzzq`, project
`ancient-star-01392879`. No rehearsal migration or account writes yet. Production
remains untouched. Before/after row-count and SHA-256 comparisons are required
on the rehearsal before functional traffic. A read-only parent preflight found
zero orphan event users and zero null problem IDs for the historical progress
claim seed; the parent still lacks the new signup/progress tables and event
execution-time column.

Known check boundary: cached merge `git diff --check` reports an extra EOF blank
in incoming main's analysis/off_policy_simulation/__init__.py. Preserve unrelated
upstream formatting and distinguish it from this task's delta against origin/main.
Next: complete server conflict resolution, run integrated unit/build gates,
then migration fingerprints and returning/new-user rehearsal on combined code.
No production action until rehearsal passes and the user's manual PR merge.

All merge conflicts are resolved. Both integrated builds pass. The first full
unit run passed 2012 tests, skipped 2 and failed 2 legacy signup-limit assertions:
current main intentionally makes that unused legacy export configurable. Its
HTTP tests now assert the actual configured limit; the production signup route
retains the separate shared database limits. Related limiter/auth tests pass
11/11. The next full run passed all 118 files (2019 tests, 2 skipped) but exited
1 with the previously observed Vitest EnvironmentTeardownError: pending
onUserConsoleLog in progress-persistence.integration.test.ts. It is not a clean
PASS. A full rerun with console capture suppressed (--silent) is in progress;
assertions and unhandled-error checking remain enabled.

Final rerun `npx --no-install vitest run --silent` PASS: 118 files, 2019 tests,
2 skipped, exit 0. The normal-run console teardown race remains documented above.
Both builds pass, frontend TypeScript and focused maintenance/fingerprint tests
pass. Replay is SKIPPED. Delta whitespace check against origin/main passes;
the incoming main EOF blank is preserved. Integration is being committed/pushed
on test_branch/system-stable-test without creating a PR. This is not permission
to merge before the outstanding rehearsal gates pass.

Added default-off maintenance middleware before auth/body/schema initialization,
with 503 + Retry-After 60 and a nonempty constant-time operator key check.
Application-stack tests verify blocked survey callbacks do not initialize the
database and the bypass still requires authentication. Maintenance/related tests
pass 11/11; backend build passes. No production settings enabled this guard.

Added scripts/deploy/verify-migration-data.mjs and focused helper tests (6/6).
The server-side fingerprint SQL was executed in a RepeatableRead READ ONLY
transaction on fresh rehearsal branch br-cool-glitter-anetgfgy: all 20 public
tables returned complete counts/hashes. Only aggregate fingerprints and schema
metadata were returned, no raw rows. Initial probe snapshot is private local
/tmp/sql-rehearsal-initial-fingerprint.json (0600). This is an initial SQL probe,
not the final before/after migration proof; controlled old-version fixtures
must still be prepared before the definitive migration baseline.

Remaining: prepare old-version controlled fixtures, capture the definitive
baseline, migrate the rehearsal copy and compare, verify old/new users and
conditions on the combined preview, rerun the 50-user workload, and then request
the user's manual PR/merge for the gated production cutover. Production tables,
configuration, identities, and existing records have not been changed.

### In progress - 2026-10-31 (minimal 50-student implementation)

**Status: PASS for the selected isolated 50-student core workflow.** Scope is the approved
registration/login, practice, answer, hint, note, and persistence workflow;
historical progress totals are not reconstructed. Existing unrelated work and
the eight original untracked files remain preserved. No commit or push made.

- Signup uses shared atomic Neon counters: 120/IP overall, 60/validated-class/IP,
  5/email/IP, and 5/IP for invalid/instructor requests per 15-minute window.
  Database errors fail closed. Student user/account/profile/enrollment writes
  are one transaction; email conflicts retain HTTP 409 and bcrypt retains 12
  rounds. Changed auth route/database code, added `db/signup-rate-limit.ts`,
  additive signup migration and focused tests.
- Progress requests carry the existing interaction ID. A learner/event claim
  and progress UPSERT are one SQL statement; duplicates do not increment again.
  Single/batch interactions acknowledge only after required progress writes.
  Optional IDs are validated on progress/profile routes; missing IDs retain
  legacy semantics. Historical interactions are marked handled at migration
  cutover without changing totals. Changed Neon progress/routes, frontend
  storage/profile serializers and focused tests; contract advances to v2.4.0.
- The real copied database had `users.username TEXT NOT NULL` without a default,
  absent from this checkout's canonical schema. This reproduced SQLSTATE 23502.
  A guarded legacy-column migration supplies a generated UUID default only for
  that existing column shape, preserving all values, NOT NULL and uniqueness.
- Applied `20261031-signup-rate-limits.sql`,
  `20261031-problem-progress-events.sql`, and
  `20261031-legacy-username-default.sql` only to verified test branch
  `br-wispy-fire-an9uvhuy` before preview traffic. The previous event-field
  migration is also satisfied there. Production migrations remain unapplied.
- Real isolated PostgreSQL checks passed: 70 concurrent limiter requests admitted
  exactly 60; 40 concurrent duplicate progress requests produced one attempt;
  an overflowing progress update rolled back its claim and retried successfully;
  a foreign-key enrollment failure rolled back student user/account/profile.
  The first database check exposed the username mismatch; the enrollment
  rollback was retested after its migration and verified SQLSTATE 23503.
- The existing load helper now synchronizes signup/login and exercises five
  cycles over five minutes, with exact event/progress readback, notes, sessions,
  cross-user denial and interrupted-response retry. A new opt-in browser test
  covers real UI registration, login, answers, hint, notes and clean-context
  recovery. Neither is a substitute for the other.

Final local checks at this checkpoint: focused Vitest PASS (14 files, 174 tests),
`npm run build` PASS, `npm run server:build` PASS; `npm run replay:gate` exits 0
with checksum **SKIPPED** due changed inputs. No replay baseline was refreshed.

Isolated previews (uncommitted reviewed-source snapshot; no local environment
files or unrelated untracked files uploaded): backend
`https://adaptive-instructional-artifacts-api-backend-2tadln7hb.vercel.app`,
initial frontend `https://adaptive-instructional-artifacts-oy7r6i3jw-hy-d1s-projects.vercel.app`.
Deployment-specific `DATABASE_URL` resolves to the verified Neon endpoint;
a unique failed-login canary was found on that exact isolated database. The
frontend bundle contains the isolated backend URL. Fresh test JWT/instructor
secrets override inherited values; LLM is disabled for deterministic fallback
checks. Shared Vercel preview/production variables remain unchanged. The first
CLI dry run used the backend subdirectory and failed because the project already
specifies that root; the corrected deployment used the repository snapshot root.

Hosted 50-student API run **PASS**: run `1793507656126-5fce3336`, five cycles over
300000ms (305840.78ms including setup), 3003 requests, 9.82 requests/second,
zero unexpected failures, zero 429s and zero 5xxs. All 50 registration/login
requests succeeded. Signup p50/p95/p99: 1638.45/1769.48/1799.19ms; login:
517.34/613.60/1606.71ms. Session-save p95 298.43ms, event retry 209.22ms,
progress write 248.05ms, profile write 207.92ms, note save 173.20ms.
All persisted event/attempt counts, code/session/note readbacks, 100 cross-user
denials and 250 interrupted accepted responses followed by retries passed.
Evidence: `dist/beta/50-student-readiness/1793507961975-local-auth.json`.
The first browser attempt failed on an overly narrow test selector; the second
asserted a logout redirect instead of session invalidation. Those test
assumptions were corrected without application changes. The next browser run
reproduced a real clean-context editor recovery failure: progress held lastCode,
but editor restoration considered only session/local drafts. The smallest fix in
`apps/web/src/app/pages/LearningInterface.tsx` uses selected-problem lastCode only
when no meaningful draft exists, guards pending restore against new edits, and
leaves the editor usable on a failed lookup. Its existing test file covers
saved-code restoration, draft precedence, empty code and failed requests.
Focused restore/storage tests PASS (2 files, 42 tests); frontend build and
TypeScript check PASS. Backend unchanged, so the measured 50-user API run was
reused instead of repeated.

Final frontend preview:
`https://adaptive-instructional-artifacts-5l0fdzruo-hy-d1s-projects.vercel.app`
(`dpl_GhmV5esSHbSKhJpxQSKbdEtFBHGF`), pointed at the same verified backend
`dpl_BPARLkL8sMy7srAT4gojGZDMU15v`. Updated bundle target rechecked.
The real-browser core test PASS (1 test, 18.4s): UI registration, logout verified
by HTTP 401, login, incorrect/correct SQL, deterministic hint, save-to-notes,
same-context refresh, and fresh-context login restoring saved SQL and notes.
Command: `npx --no-install playwright test -c playwright.config.ts
--project=chromium tests/e2e/regression/pilot-student-core.spec.ts --reporter=line`
with verified preview URLs and test class code supplied through environment;
Chromium required sandbox escalation. No unsafe browser security flags or
local-storage auth seeding were used. Final `git diff --check` PASS.

Failure-snapshot output is
disabled for this credential-bearing test. Test credentials are private
temporary files only. Cleanup must remove those credentials and explicitly
dispose of synthetic resources on the test copy; never run cleanup on the
parent. Rollback application deployments before removing additive tables/defaults;
retaining them preserves data and retry claims. Legacy clients without IDs and
historical partial writes remain outside the new idempotency guarantee. Profile
evidence retries are not deduplicated by the progress ledger. Signup counter
rows expire logically but have no background deletion job. No new topic work.

Cleanup/rollback: the two preview URLs and copied branch are retained for review;
production aliases, environment settings, database and parent branch were not
changed. Remove disposable preview deployments when no longer needed; delete
only copied branch `br-wispy-fire-an9uvhuy` after a deliberate disposal decision.
Do not clean up by broad DELETE against inherited records or the parent.
On application rollback retain the additive tables/default and ledger claims;
a later production rollout requires its own paused-write migration cutover.
Temporary local test credential/connection files are removed after validation.
The short workload establishes the recorded API capacity and browser flow only;
live LLM capacity, an actual upstream outage, and historical data repair were
not tested. Replay checksum remains explicitly SKIPPED; no baseline update.
Suggested commit: `fix(persistence): stabilize classroom writes`.

### In progress - 2026-10-31 (isolated pilot database)

**Status: PARTIAL.** With explicit user approval to copy the parent database,
created Neon branch `pilot-system-stable-20261031` (`br-wispy-fire-an9uvhuy`)
in project `ancient-star-01392879`. Neon reports it ready, non-primary,
non-default, and initialized from parent data; it contains inherited records
and must be handled as sensitive. Its database is `neondb`.

On that branch only, inspected `interaction_events` column metadata and applied
`ALTER TABLE interaction_events ADD COLUMN IF NOT EXISTS execution_time_ms DOUBLE PRECISION`.
The branch already had `condition_id` and `metadata`; all three columns now
exist with the intended types and are nullable. No synthetic accounts, test
data, deployment, or load test has been created. A real event round trip is
still unverified. Retain nullable columns on rollback after reverting application
code. Cleanup of the copy requires a deliberate deletion decision because it
contains parent records.

The inherited Vercel preview database target remains unverified; do not deploy
or generate test traffic until branch-specific frontend and backend configuration
and their effective targets are verified. Idempotent progress recovery, shared-IP
signup capacity, browser workflows, and 50-user performance remain open; replay
checksum comparison remains SKIPPED.

Two synthetic, transaction-scoped PostgreSQL checks on the isolated branch
used temporary tables and synthetic IDs only: a repeated event ID incremented
once, and a simulated progress constraint failure rolled back the candidate
claim before a successful retry. The temporary tables were dropped on commit;
no inherited rows were read. These checks validate a SQL pattern, not the
application, concurrent sessions, or legacy-event reconciliation. No event
idempotency fix has been applied. Historical events do not identify whether
their independent progress write succeeded; existing clients also lack a common
event ID and complete payload across all writers. A rollout needs a deliberate
reconciliation policy and application-level concurrent integration tests.

The Vercel connector rejected a branch-specific environment-variable creation.
The authenticated Vercel CLI also rejected it because Git branch
`test_branch/system-stable-test` is not present in the connected remote
repository. `vercel env ls preview test_branch/system-stable-test --project
prj_vR3HTHqulLCVqv5EnSMfnStWP4cZ --scope team_BxlA36kEPgWxAMjQnJ4DBtQ2`
confirmed no branch-scoped variables; no Vercel setting was created. The local
branch was not pushed. A deployment-specific override or a separately authorized
remote branch needs verification before connecting a preview to this database.

### In progress - 2026-10-31 (preview isolation and event storage)

**Status: PARTIAL.** After Vercel CLI authentication, preview variable names
were inspected successfully. Neither project has branch-specific variables for
`test_branch/system-stable-test`; both have inherited preview configuration,
including a backend `DATABASE_URL`. Its target has not been verified as isolated.
Do not deploy or send load to that inherited target. An attempt to create a new
empty Neon project failed with `action restricted: organization is managed by
Vercel`. At that point, the available Neon branch tool required explicit user
approval to copy parent data. No project, branch, accounts, database writes, or
deployment resulted from that attempt; see the later checkpoint above.

Further grading work: `problem-11` has one synthetic low-value order for an
existing user, `problem-22` one empty synthetic department, and `problem-24` one
additional low-paid synthetic employee. These rows were created solely to
distinguish missing filters in the existing exercises; shared schemas, existing
IDs, expected results, and reference queries remain unchanged. The exercise
seed datasets and accepted answers therefore changed for these three IDs.
Focused positive and negative tests pass (`188/188` in the three SQL regression
suites). The general expression comparator still accepts swapped values when
expression labels are involved; correcting that while preserving alias and
column-order tolerance requires an explicit mapping contract.

An in-memory test of the actual batch route confirmed that a failed progress
write can still return HTTP 201 and include that event in `confirmedIds`; calling
the real progress helper twice with the same event ID causes two attempt
increments. No atomic fix has been applied: three existing update paths, legacy
callers without event IDs, and repair of previously inserted events require an
isolated PostgreSQL integration test before choosing safe transaction semantics.

After the exercise-data changes, `npm run test:unit` first had 1886 assertions
pass and 2 skip but exited 1 with a Vitest worker `EnvironmentTeardownError` in
`progress-persistence.integration.test.ts`; that file passed 15/15 in isolation.
One subsequent full run passed (95 files, 1886 passed, 2 skipped); intermittent
teardown behavior remains unverified. `npm run build`, `npm run server:build`,
the three SQL regression suites, schema-guard tests, and `git diff --check`
passed on the updated files. Replay remains SKIPPED.

- Added `apps/server/src/db/migrations/20261031-interaction-event-fields.sql`
  and updated Neon initialization, insert/read mappings, strict route validation,
  schema guard, frontend deserialization, and focused tests to preserve existing
  `conditionId`, `executionTimeMs`, and `metadata`. Frontend and backend research
  contract versions are now `v2.3.0`. Legacy rows may have null values. The
  migration is **not applied** and real Neon round-trip remains `Unverified`.
  Apply it only to a verified isolated database before deploying this code when
  `AUTO_SCHEMA_INIT=false`; rollback application code first and retain columns.
- Hardened IPv6 rate-limit keys using the installed `ipKeyGenerator`, preserving
  existing limits. Real Express middleware tests reproduced an IPv6 rotation
  bypass and now pass; the five-signups-per-IP limit still blocks a 50-student
  shared-network signup burst. Distributed enforcement remains `Unverified`.
- The actual progress-update helper increments twice for two deliveries of the
  same event ID. Three independent progress-update paths and batch confirmation
  after a progress-write failure require an atomic, event-ID-aware design; no
  live database concurrency or recovery behavior has been established.

Verification: `npm run test:unit` PASS (95 files, 1883 passed, 2 skipped),
`npm run build` PASS, `npm run server:build` PASS,
`node --test scripts/verification/check-neon-interaction-schema-contract.test.mjs`
PASS (3 tests), and `git diff --check` PASS. `npm run replay:gate` remains
SKIPPED because input digests differ. With sandbox escalation, the isolated local
Playwright student-navigation smoke passed (1 test); this does not verify backend
authentication, deployed behavior, or 50-user capacity. No production data or
remote load was written. Existing changes and eight original untracked files
remain in place. Continue only with explicit isolation verification, idempotent
progress and grading fixes, then the staged preview tests.

### In progress - 2026-10-31 (50-student stability, continued)

**Status: PARTIAL. Not ready for the 50-student pilot.** No preview or load test
has been deployed or run; no test accounts or database writes have been made.

Changes on `test_branch/system-stable-test`:

- Problems 18–20 opt into `database-state-v1` grading with a state-query field.
  Each mutation attempt starts from its seed; the reference and submission run
  in separate SQLite databases and compare complete rows. Existing SELECT and
  exec-only grading paths remain available. Changes: `apps/web/src/app/types/index.ts`,
  `apps/web/src/app/data/problems.ts`, `apps/web/src/app/components/features/sql/SQLEditor.tsx`,
  `apps/web/src/app/lib/sql-state-grading.ts`, and their focused tests.
- `apps/server/src/routes/neon-interactions.ts` accepts explicit typed fields
  already mapped to Neon columns while retaining strict unknown-field rejection;
  focused contract tests cover single and batch requests. This is partial:
  `conditionId`, `executionTimeMs`, and `metadata` still require an explicit
  backward-compatible storage migration and round-trip verification.
- `apps/web/src/app/lib/storage/dual-storage.ts` retains the complete pending
  backlog rather than truncating it to 100, does not replace persisted backlogs
  with shorter quota fallbacks, keeps configured-backend events pending while
  offline, and locks queue processing before its asynchronous health check.
  `safe-storage.ts` no longer evicts offline, pending, or dead-letter records as
  recoverable caches. Focused tests cover backlog, quota, and concurrent calls.
  Quota exhaustion can still leave new writes only in memory; reload recovery and
  user-facing reporting under real quota pressure remain unverified.
- `scripts/beta/beta-50-student-readiness.mjs` retains auth cookies and CSRF,
  checks required authenticated steps and readback, supports staged user counts,
  and requires explicit target/isolation acknowledgement. Its tests use mocked
  local HTTP. It is API-only: browser interaction, hint generation, sustained
  30-minute operation, isolation, and actual 50-user capacity are unverified.

Verification after these changes:

| Command | Result |
|---------|--------|
| `npm run test:unit` | PASS: 93 files, 1877 passed, 2 skipped |
| Focused grading, storage, API contract, and readiness tests | PASS: 8 files, 184 tests (`/tmp/sql-pilot-focused-final.log`) |
| `npm run build` | PASS; existing cache-trimmer chunk warning |
| `npm run server:build` | PASS after `npm ci` in `apps/server` using its existing lockfile |
| `npx --no-install tsc --noEmit --pretty false` | PASS |
| `npm run replay:gate` | SKIPPED: input digest mismatch; checksum not compared |
| `git diff --check` | PASS |
| `VITE_API_BASE_URL='' VITE_BACKEND_URL='http://127.0.0.1:9' npx --no-install playwright test -c playwright.config.ts --project=chromium tests/e2e/regression/phase1-demo-access.spec.ts --grep 'Student login redirects to /practice' --reporter=line` | BLOCKED: Chromium failed to launch with macOS MachPort permission denied (SIGTRAP); application flow did not run |

The backend `npm ci` reported 25 dependency advisories. A separate
`npm audit --omit=dev --json` reported 23 advisories (3 critical, 10 high,
8 moderate, 2 low); no dependencies or lockfiles were upgraded. Assess
applicability and remediation separately; do not assume all reported paths are
exploitable in deployment.

Vercel and Neon project metadata was readable; existing Neon preview branches
inherit parent data and were not proven disposable. The connected Vercel app
returned 403 when listing project environment metadata. After the user signed
into the local Vercel CLI, branch-specific preview environment listings returned
no variables for either project. Checking inherited preview variables required
automatic approval review, which failed due to the usage limit; the actions were
not executed. Do not send load until frontend/backend targets and a separate test
database are independently verified. A successful CLI login does not establish
database isolation.

Remaining pilot blockers: shared-IP signup limit of five per 15 minutes;
event fields without verified persistence and their additive migration; possible
duplicate progress increments across retry and independent update paths; real
quota/reload recovery; the expression-column comparator and weak seeds for
problems 11/22/24; replay checksum drift; browser and deployed-flow validation;
and 5/15/50-user plus 30-minute fault/load tests. Existing audit found three
independent progress update paths; deployed duplicate counts are unverified.

Next: regain approval-review availability and verify preview/test-database
isolation. In parallel, implement and test the event-field migration and an
idempotent progress-update design without applying migrations to an existing
database. Repeat focused and end-to-end tests before any load. Preserve the
eight pre-existing untracked files and the earlier CHANGELOG entry. No commit,
push, or production deployment has been performed. Suggested commit for this
work once verified: `fix(reliability): harden pilot workflows`.

### In progress - 2026-10-30 (50-student stability)

**Status: PARTIAL.** Branch `test_branch/system-stable-test` was created from
`9112c5a` with the existing CHANGELOG change and eight untracked files preserved.
Baseline: `npm run build` PASS; `npm run test:unit` PASS (1857 passed, 2
skipped); `npm run server:build` FAIL (pre-existing TS2688 duplicate `@types/* 2`
directories); `npm run replay:gate` SKIPPED (exit 0, changed input digests).

Vercel frontend and backend projects and the Neon project are accessible for
inspection. Existing Neon preview branches were copied from a parent and their
data/usage cannot be assumed disposable. No preview database isolation has been
verified and no load traffic, test accounts, deployment, or database writes have
been made. Establish an isolated test database and independently verify both
preview targets before any load-generating writes. Current reference: repository
scripts/beta/beta-50-student-readiness.mjs, rate limiter in
apps/server/src/middleware/rate-limit.ts, and the prior audit below.

### Added - 2026-10-30 17:20 PDT (Local Codex Implementation Skills)

**Status: PARTIAL** — instruction artifacts, skill catalog discovery, and both
analysis-only forward tests passed. Direct `/skills` UI visibility remains
`Unverified`: the computer-use tool prohibits controlling Codex itself. Pilot
readiness also remains `PARTIAL`; the application defects from the audit were
not fixed by this instruction-only preparation.

#### Scope and delivered files

- `AGENTS.md`: appended current checkout facts, valid commands, the eight
  implementation rules, Ponytail's minimal-change meaning, and the shared
  checkpoint convention. All original bytes remain an unchanged prefix.
- `.agents/skills/minimal-fix/SKILL.md`: added the requested metadata, bug/failing
  test trigger, evidence-first workflow, regression checks, and analysis-only
  boundary; excludes feature requests and broad refactors.
- `.agents/skills/sql-adapt-implement/SKILL.md`: added the requested metadata,
  required professor inputs, actual SQLProblem/execution path, equivalence and
  negative checks, write-state verification, concept/trace checks, and limits.
- `docs/CHANGELOG.md`: this single checkpoint records preparation and readiness;
  no new progress, task-list, or completion-report files were created.

| Task | Result | Evidence or remaining boundary |
|------|--------|--------------------------------|
| 2 — Repository guidance | PASS | Original AGENTS rules preserved; current commands and baseline failures documented |
| 3 — minimal-fix | PASS | YAML/metadata validation, catalog discovery, and analysis-only bug reproduction |
| 4 — sql-adapt-implement | PASS | YAML/metadata validation, catalog discovery, and missing-input/readiness analysis |
| 5 — Integration/readiness | PARTIAL | Both skills discovered and forward-tested; direct UI selection not observed |

AGENTS.md and `.agents/` intentionally remain local and Git-ignored, as requested.
`.gitignore`, existing `run-phase`/`quality-loop` skills, application code, tests,
manifests, lockfiles, versions, schemas, policies, and all eight original
untracked files were preserved. No exercise was added. No commit, push,
deployment, dependency installation, or replay-baseline update was performed.

#### Baseline and verification

Checkout: `main` at `9112c5a`. Environment: Node `v24.3.0`, npm `11.4.2`;
`.nvmrc` specifies Node 22. Dependencies were present, so `npm ci` was not needed
for the preparation. Backend dependency repair remains a separate task.

The four implementation-session baselines below ran before instruction edits.
Their results remain applicable because runtime inputs and dependencies did not
change during the preparation.

| Exact command | Result |
|---------------|--------|
| `npm run build` | PASS, exit 0; four integrity guards passed and Vite built in 3.93s; existing cache-trimmer static/dynamic import warning remains |
| `npm run replay:gate` | SKIPPED, exit 0; toy replay executed, but changed fixture/policy input digests skipped checksum comparison |
| `npx --no-install vitest run apps/web/src/app/data/problems.regression.test.ts` | PASS, 82/82; reference-query tests do not prove incorrect answers are rejected |
| `npm run server:build` | FAIL, exit 2; pre-existing TS2688 errors from duplicate `@types/* 2` directories |

Earlier results from the read-only audit in this same session were reused:
`npm run test:unit` passed 1857 tests in 90 files with 2 skipped;
`npx --no-install tsc --noEmit --pretty false` passed; Playwright
`--list --project=chromium` collected 821 tests in 82 files without executing
browser flows. `npm run demo:weekly -- --list` failed because its named spec is
missing. `npm run check:source-grounding` failed because it resolves the wrong
repository root. These are recorded limitations, not fixes made here.

Skill and change validation:

- Fresh independent Codex agents saw both new names in their available-skills
  catalogs before file searches, then explicitly loaded their SKILL.md files.
  This verifies discovery/loading, separately from the unobserved native UI.
- The bundled `quick_validate.py` attempt was blocked by missing Python PyYAML.
  Used the existing Node `yaml` parser instead, with no dependency changes:
  `node /tmp/sql-adapt-codex-setup-8s9hdun7/validate-skills.mjs` passed for both
  skills, including exact requested metadata, unique YAML keys, valid names,
  and no unfinished scaffold.
- `git diff --check` and direct ignored-file checks passed:
  `git diff --no-index --check /tmp/sql-adapt-codex-setup-8s9hdun7/AGENTS.before.md AGENTS.md`,
  plus `git diff --no-index --check /dev/null` for each new SKILL.md. For these
  no-index checks, exit 1 with no diagnostics means differing files, not a
  whitespace error.
- `python3 /tmp/sql-adapt-codex-setup-8s9hdun7/verify-setup.py` checked hashes of
  646 pre-existing tracked/untracked files, original instruction bytes, and
  existing skills. Only this CHANGELOG changed among tracked files.
- A separate read-only CLI app-server discovery probe exited before returning a
  skills listing; it was not used as discovery evidence. No UI restriction was
  bypassed.

Temporary baseline logs, validation scripts, and original-file snapshots are in
`/tmp/sql-adapt-codex-setup-8s9hdun7/`; this directory is local and ephemeral.

#### Analysis-only forward tests

- `minimal-fix`: the real SQLExecutor and actual SQLEditor grading functions,
  evaluated in memory with local sql.js WASM, confirmed that problem-18 accepts
  `SELECT 1` without inserting the required row. Correct and wrong-value INSERTs
  also pass the current exec-only contract. The agent identified a focused
  component regression and state-based fix proposal without creating a test or
  modifying code. Existing reference cases run with
  `npx --no-install vitest run apps/web/src/app/data/problems.regression.test.ts -t 'problem-18' --cache=false`
  passed 2 tests, with 80 intentionally filtered out.
- `sql-adapt-implement`: the agent inspected existing EXISTS/correlated-query
  patterns, reproduced weak fixture/comparator behavior in memory, and required
  the missing professor prompt, provenance, schema/seed, reference SQL, expected
  behavior, and learning objectives. No substitute question or exercise ID was
  invented. The subtype mapping check passed 23/23; this does not validate all
  advanced concept IDs or coverage statistics.
- Both evaluators confirmed no application edits or external writes. Their
  final rereads accepted the clarification that build/replay requirements apply
  after implementation, while analysis-only mode remains non-mutating.

#### Pilot readiness and smallest subsequent work

Reusable now: problem-10/11 IN subqueries, problem-22 correlated EXISTS,
problem-23 correlated scalar subquery, and problem-24/25 window references.
The audited sql.js/SQLite engine supports NOT EXISTS. No editor rebuild or new
grading system is needed to start designing an approved challenge.

Blockers for new challenges: no actual professor questions or reference
solutions have been supplied; zero-row SELECTs need explicit result grading;
seeds must distinguish missing correlation/filters; expression comparison can
lose column/value associations; and the advanced taxonomy/coverage paths are
not aligned. Registry/graph use `exist-clause`, problem-22 uses `exists`, and
problem-23 uses `correlated-subqueries`; legacy coverage recognizes six IDs.
Do not silently rename historical IDs or reinterpret coverage semantics.

For the Wednesday stable-demo goal, first select an explicit existing route and
run it in a browser. If backend persistence is demonstrated, repair the local
backend install with its existing lockfile and pass the unmodified build before
verifying login, save, and refresh. If the demo claims correct automatic grading
for problems 18–20, or negative-answer rejection for 11/22/24, fix and test those
specific gaps first. Record replay SKIPPED honestly. These implementation
changes require separately bounded tasks and were not included in preparation.

Smallest subsequent sequence: validate the chosen demo route; address only its
blocking grading/data/environment issue with `minimal-fix`; obtain actual
professor material; then implement one approved exercise end-to-end with
`sql-adapt-implement` and focused positive/negative tests. Full taxonomy/coverage
unification, real/experiment replay gates, and unrelated cleanup can follow.
Before real/experiment replay use, also resolve the export script's
`scripts/dist/policies.json` versus root `dist/policies.json` path mismatch.

Full browser E2E, deployed behavior, Neon trace persistence, cross-device
recovery, and the professor's future exercises remain `Unverified`. Later
exercise work must record IDs, concepts, reference query/source, grading mode,
trace fields, results, and required schema/policy/behavior versions here.

Example invocations (Ponytail is the minimal-change approach, not another CLI):

```text
$minimal-fix 按 Ponytail 最小变更原则，analysis-only 审查 problem-18
为什么 SELECT 1 能通过；先复现并提出最小修复和回归测试，不改文件。

$sql-adapt-implement 按 Ponytail 最小变更原则，analysis-only 分析我提供的
高级 SQL 题面、schema/seed 和参考解；核实方言、等价解、负例、概念和日志。
必要输入不足时列出缺项，不编造新题，不修改文件。
```

No application version bump or migration. Recovery for the setup is limited to
restoring the original AGENTS from the temporary snapshot, removing only the two
new skill directories, and reverting only this dated CHANGELOG entry; preserve
all unrelated work. Suggested commit for the tracked checkpoint only:
`docs(workflow): record local Codex skill setup`.

### Fixed - 2026-04-10 (3 Live Bugs: Dashboard, Textbook, Save to Notes)

#### Bug 1: Instructor Dashboard Needs Manual Refresh
- **Bug**: Instructor dashboard showed empty student list until manual page refresh
- **Root Cause**: `useAllLearnerProfiles()` fired once on mount and raced with auth initialization. The fetch completed before JWT cookie was available, returned empty, and never retried.
- **Fix**: Added `authTrigger` option to `useAllLearnerProfiles()` that re-fetches when auth state changes
- **Files**: `apps/web/src/app/hooks/useLearnerProfile.ts`, `apps/web/src/app/pages/InstructorDashboard.tsx`
- **Verification**: `npm run build` ✅, `npm run test:unit` ✅ 1790 passed

#### Bug 2: Instructor "View Textbook" Shows Empty
- **Bug**: When instructor clicked "View Textbook" for a student, the textbook rendered empty initially
- **Root Cause**: `hydrateLearner()` returns before the background `void Promise.all([...getTextbook])` completes. TextbookPage reads empty localStorage before data arrives.
- **Fix**: Added `isHydratingTextbook` state, await hydration with `{force: true}`, wait 1500ms for background sync, then force re-read via `storageVersion` increment
- **Files**: `apps/web/src/app/pages/TextbookPage.tsx`
- **Verification**: `npm run build` ✅, `npm run test:unit` ✅ 1790 passed

#### Bug 3: Student Cannot Add to Notebook
- **Bug**: "Save to My Notes" button only appeared after hint escalation + SQL error
- **Root Cause**: `showAddToNotes` required both `escalationTriggered` AND `effectiveLastError`. Students who viewed hints without escalating, or who solved the problem, never saw the button. Also, `escalationTriggered` was reset on successful query execution.
- **Fix**: Widened condition to include `hasViewedHints || hasSolvedCurrentProblem`. Removed `setEscalationTriggered(false)` from success handler so button stays visible after solving.
- **Files**: `apps/web/src/app/pages/LearningInterface.tsx`
- **Verification**: `npm run build` ✅, `npm run test:unit` ✅ 1790 passed, `npm run replay:gate` ✅ skipped (expected)

### Fixed - 2026-04-10 (CI Test Failures)

#### CI: Unterminated String Constants in Test Files
- **Bug**: `grading-tolerance.spec.ts` had multiline SQL strings using single quotes (lines 104, 162), causing `SyntaxError: Unterminated string constant`
- **Root Cause**: JavaScript single-quoted strings cannot span multiple lines
- **Fix**: Changed single quotes to backticks (template literals) for multiline SQL strings
- **Files**: `tests/e2e/regression/grading-tolerance.spec.ts`

#### CI: Missing Module Imports in Test Files
- **Bug**: `save-to-notes.spec.ts` and `student-progress-persistence.spec.ts` imported from non-existent helper modules
- **Root Cause**: Test files referenced `../helpers/learning-interface` and `../practice-page/practice-page-helpers` which were never created
- **Fix**: Removed broken imports, inlined helper functions (`waitForProblemLoad`, `navigateToPracticePage`, `executeQuery`) directly in test files
- **Files**: `tests/e2e/regression/save-to-notes.spec.ts`, `tests/e2e/regression/student-progress-persistence.spec.ts`
- **Verification**: `npm run test:unit` ✅ 1790 passed

### Fixed - 2026-04-10 (Research Dashboard Zero Data)

#### Research Dashboard Shows 0 Learners, 0 Interactions
- **Bug**: Research Dashboard displayed "0 Learners" and "0 Interactions" even when data existed in the backend
- **Root Cause**: 
  - Dashboard read data from localStorage via `storage.getAllInteractions()` and `storage.getAllProfiles()`
  - `hydrateInstructorDashboard()` used fire-and-forget pattern for interactions fetch - returned before data was written
  - 120,417+ interaction events (~120MB) exceeded localStorage's 5-10MB limit, causing data truncation
- **Fix**: Replaced localStorage reads with direct API calls:
  - `storageClient.getAllProfiles()` - fetches instructor-scoped learner profiles from `/api/learners/profiles`
  - `storageClient.getInteractions()` - fetches per-learner interactions from `/api/interactions` in batches
  - Added fallback to localStorage on API failure (preserves offline capability)
  - Profiles cached to localStorage for other components after API fetch
- **Files**: `apps/web/src/app/components/features/research/ResearchDashboard.tsx`
- **Verification**: `npm run build` ✅, `npm run test:unit` ✅ 1790 passed

#### Learner Profile Creation Gap
- **Bug**: Instructors could see only the subset of students who happened to have a `learner_profiles` row in Neon, even when many more students were properly enrolled in their sections.
- **Root Cause**:
  - `LearningInterface.tsx` created missing profiles through `storage.createDefaultProfile(...)`
  - `apps/web/src/app/lib/storage/dual-storage.ts` delegated `createDefaultProfile` directly to localStorage only
  - `apps/server/src/routes/auth.ts` created student accounts and section enrollments but did not create a Neon `learner_profiles` row at signup
- **Fix**:
  - `apps/web/src/app/lib/storage/dual-storage.ts`: replaced the pass-through `createDefaultProfile` bind with a real adapter that creates the local profile, syncs it to the backend, and queues retry on backend failure
  - `apps/server/src/routes/auth.ts`: student signup now creates an initial learner profile in Neon with the same default strategy/preferences used by the web app
- **Tests**:
  - `apps/web/src/app/lib/storage/dual-storage.test.ts`: covers backend sync + retry queue for default profile creation
  - `tests/unit/server/auth-login-telemetry.contract.test.ts`: covers learner profile creation during student signup
  - `tests/e2e/regression/instructor-dashboard-profiles.spec.ts`: adds a preview/deployed regression for instructor visibility without a prior Practice visit
- **Verification**:
  - `npm run integrity:scan` ✅
  - `npm run server:build` ✅
  - `npm run build` ✅
  - `npm run test:unit` ✅ 1790 passed, 2 skipped
  - `npm run replay:gate` ✅ skipped by checksum gate as designed
- **Data repair**:
  - Preview Neon backfill executed on 2026-04-10.
  - `learner_profiles`: `103 -> 253`
  - Distinct enrolled students missing profiles: `156 -> 0`
  - Largest affected section moved from `123 enrolled / 53 with_profiles` to `123 / 123`
- **Remaining follow-up**:
  - Production still needs separate verification/backfill if it is not sharing the same Neon target. See `docs/audit/INSTRUCTOR_DASHBOARD_FIX_2026-04-10.md`.

### Added - 2026-04-08

#### Persistence Hardening (P0 Fix)
- **Root Cause**: `problem_progress` table data was never fetched on login, causing "lost progress" symptoms
- **Fix Location**: `apps/web/src/app/lib/storage/dual-storage.ts` - `hydrateLearner()` function
- **Implementation**: Added `getAllProblemProgress()` call to fetch authoritative solved state from backend
- **Merge Strategy**: Union of (backend progress table + local cache + profile cache)
- **Tests**: Added 15 new test cases in `tests/unit/web/progress-persistence.test.ts`
- **Status**: ✅ All 1781 tests passing

**Files Changed**:
- `apps/web/src/app/lib/storage/dual-storage.ts` - Core fix
- `apps/web/src/app/lib/storage/dual-storage.test.ts` - Added mock
- `apps/web/src/app/lib/storage/progress-persistence.integration.test.ts` - Fixed tests

**Documentation**:
- Created: `docs/PERSISTENCE_MAP.md` - Complete data authority reference
- Created: `docs/PERSISTENCE_HARDENING_REPORT.md` - Master synthesis

#### Documentation System
- Created: `docs/INDEX.md` - Documentation navigation hub
- Created: `docs/CHANGELOG.md` - This file - progress tracking
- Created: `docs/PROJECT_COORDINATION.md` - File organization rules and mandatory checklists
- Updated: `docs/AGENTS.md` - Added reference to new docs
- Updated: `docs/INDEX.md` - Added PROJECT_COORDINATION to core documents

#### Documentation Cleanup
- **Deleted Folders**: Portfolio/, audit-results/, ux-audit-evidence/, docs/archive/, docs/audit/evidence/
- **Deleted Agent Artifacts**: 27 agent conversation files (BOSS_AGENT_*, MASTER_*, etc.)
- **Deleted Old Reports**: 6 outdated test reports
- **Deleted Build Duplicates**: 15+ duplicate files/folders with " 2" in name
- **Space Freed**: ~13MB+
- **Files Removed**: 50+

**Rules Established**:
- All docs must be in `docs/` folder
- No root-level `*.md` files
- No `docs/progress.md` or week-based files
- No `docs/archive/` - delete old docs

#### Keyboard Shortcuts Fix (Root Cause D)
- **Bug**: Ctrl+Enter didn't work from Monaco editor; Cmd+Enter didn't work on Mac
- **Fix**: Moved run-query shortcut before textarea guard, added metaKey support
- **Files**: `apps/web/src/app/pages/LearningInterface.tsx`
- No dated audit evidence - delete after use
- No duplicate "* 2" files

### Fixed - 2026-04-09 (Student Beta Feedback)

#### SQL Grading Tolerance (Root Cause C)
- **Bug**: Correct SQL rejected due to column alias mismatch and tight float epsilon
  - Query 26: `SELECT UPPER(emp_name)` failed because column name was `UPPER(emp_name)` not `name_upper`
  - Query 13: Float precision epsilon of 0.01 was too tight for SQLite rounding
- **Fix**: Added value-only fallback matching + widened epsilon 0.01→0.015
- **Files**: `apps/web/src/app/lib/sql-executor.ts`
- **Tests**: Added `tests/e2e/regression/grading-tolerance.spec.ts`

#### Progress Hydration Fix (Root Cause A)
- **Bug**: Progress showed 0/32 after login because `useLearnerProgress` read from localStorage before hydration completed
- **Fix**: Added `hydratedSolvedIds` injection to bridge hydration result through React state
- **Files**: `useLearnerProgress.ts`, `LearningInterface.tsx`

#### Cross-Session Draft Persistence (Root Cause B)
- **Bug**: Drafts lost on page reload because keyed by sessionId which changes on reload
- **Fix**: Added `findAnyPracticeDraft` fallback in problem change handler
- **Files**: `LearningInterface.tsx`

#### CI/Infra Hardening (BUG-001, BUG-003)
- **BUG-001**: Aligned CI Node version to 22 in `.github/workflows/regression-gate.yml`
- **BUG-003**: Added `unhandledRejection` handler in `apps/server/src/index.ts`
- **Impact**: Prevents CI failures and silent server crashes

#### Server Security Hardening (BUG-002, BUG-005, BUG-007)
- **BUG-002**: Added 500-event limit to batch interactions endpoint
- **BUG-005**: Added error logging to PDF index catch blocks
- **BUG-007**: Added Zod schema validation for interaction events (strict mode, string length caps)
- **Files**: `apps/server/src/routes/neon-interactions.ts`, `apps/server/src/routes/pdf-index.ts`

#### Storage Safety Sweep (BUG-004, BUG-006, BUG-008)
- **BUG-004**: Migrated raw `localStorage.setItem` calls to `safeSet`:
  - `AskMyTextbookChat.tsx`: Chat history (priority: 'cache')
  - `SettingsPage.tsx`: Interactions data (priority: 'critical'), debug overrides (priority: 'standard')
  - `LLMSettingsHelper.tsx`: LLM settings (priority: 'cache')
- **BUG-006**: Storage event debounce already present in `useSessionPersistence.ts` (50ms)
- **BUG-008**: `reinforcement-manager.ts` already uses `safeStorage.set()`
- **Impact**: Prevents quota exceeded crashes, adds eviction support

#### Storage Safety Phase 2
- **Scope**: Migrated remaining raw `localStorage.setItem` calls to quota-safe `safeSet` wrapper
- **Files Changed**:
  - `apps/web/src/app/lib/api/learner-profile-client.ts` - Profile cache writes now use safeSet
  - `apps/web/src/app/lib/ui-state.ts` - UI state writes now use safeSet with cache priority
  - `apps/web/src/app/lib/content/reinforcement-manager.ts` - Already used safeStorage (verified)
- **Impact**: Prevents silent crashes on quota exceeded during profile caching and UI state updates

#### Save to Notes Fix (Root Cause E)
- **Bug**: Save to Notes required prior error; failed with "no concept context" when student hadn't made an error yet
- **Fix**: Added fallback to problem concepts when no error context exists
  - `handleAddToNotes()`: Falls back to `currentProblem.concepts[0]` when no error subtype found
  - `handleEscalation()`: Same fallback pattern for escalation button
- **Files**: `apps/web/src/app/pages/LearningInterface.tsx`
- **Tests**: Added `tests/e2e/regression/save-to-notes.spec.ts`

#### Storage Quota Hardening (Root Cause F)
- **Bug**: Raw localStorage writes crashed on quota exceeded
- **Fix**: Migrated HIGH/MEDIUM risk sites to safeSet with priority levels
  - `AskMyTextbookChat.tsx`: Chat history (priority: 'cache') with `safeSet`/`safeRemove`
  - `SettingsPage.tsx`: Interactions data (priority: 'critical'), debug overrides (priority: 'standard')
  - `LLMSettingsHelper.tsx`: LLM settings (priority: 'cache')
- **Files**: `AskMyTextbookChat.tsx`, `SettingsPage.tsx`, `LLMSettingsHelper.tsx`

#### UX P1: Silent Redirects
- **Problem**: Unauthorized route redirects sent users to home page with no explanation
- **Solution**: Added `?reason=` query param to redirect URLs, display dismissible alert on landing pages
- **Files Changed**:
  - `apps/web/src/app/lib/auth-route-loader.ts` - Added reason param to redirects
  - `apps/web/src/app/pages/StartPage.tsx` - Added alert for unauthorized access
  - `apps/web/src/app/pages/InstructorDashboard.tsx` - Added alert for access-denied

#### UX P1: Verified Existing Fixes
- **HDI Clear Confirmation**: Verified ConfirmDialog properly wired in SettingsPage.tsx (no changes needed)
- **Preview Mode Banner**: Verified PreviewModeBanner renders correctly in RootLayout.tsx (no changes needed)

#### Performance: Cross-Tab Debounce
- **Problem**: `handleStorageChange` processed storage events immediately, potential for unnecessary re-renders
- **Solution**: Added 50ms debounce to storage event handler in useSessionPersistence.ts
- **Files Changed**: `apps/web/src/app/hooks/useSessionPersistence.ts`

#### Navigation UX Clarity (Bug 8:30-#8)
- **Bug**: Prev/Next buttons were icon-only, confusing students
- **Fix**: Added text labels (hidden on mobile), added "Next Problem →" prompt after correct answer
- **Files**: `LearningInterface.tsx`

### Changed - 2026-04-09

#### Documentation Consolidation
**Deep audit and consolidation of docs folder** - merged duplicates, removed rule violations, improved cross-references.

**Files Deleted** (violating PROJECT_COORDINATION.md):
- `docs/progress.md` - Rule violation: use CHANGELOG.md instead
- `docs/week2026-04-09_progress.md` - Rule violation: no week-based progress files

**Duplicates Removed**:
- `docs/runbooks/PERSISTENCE_HARDENING_REPORT.md` - Duplicate of docs/PERSISTENCE_HARDENING_REPORT.md
- `docs/runbooks/HARNESS_GATE_MATRIX.md` - Case-duplicate of harness-gate-matrix.md

**Content Merged**:
- `docs/runbooks/persistence-truth-map.md` → merged into `docs/PERSISTENCE_MAP.md`
- `docs/runbooks/instructor-dashboard-fix.md` + `instructor-dashboard-verification.md` → merged into `docs/runbooks/instructor-dashboard.md`

**Cross-References Added**:
- E2E_AUTH_CREDENTIALS.md ↔ e2e-auth-seeding.md ↔ e2e-inventory.md

**Documentation Count**: Reduced from 70+ files to 61 organized files

### Fixed - 2026-04-08

#### Query 13 Grading
- **Issue**: Grading edge case for Query 13
- **Fix**: Hardened grading logic
- **Status**: ✅ Complete
- **Document**: `docs/GRADING_HARDENING_FINAL_REPORT.md`

#### Test Suite
- Fixed test mocks to include `getAllProblemProgress`
- Fixed integration tests to properly test new behavior
- All tests passing: 1781 tests (77 test files)

---

## [Research-4] - 2026-04-01 to 2026-04-07

### Added
- Multi-device persistence foundation
- Backend-first hydration logic
- Durable pending store (RESEARCH-1 compliance)
- Offline queue with retry-until-ack semantics

### Changed
- Session config moved from localStorage to sessionStorage (v2 redesign)
- Backend health checks on all hydration paths

---

## [Research-3] - 2026-03-24 to 2026-03-31

### Added
- Keepalive flush for pagehide scenarios
- CSRF token refresh on 403 errors
- Auth rate limiting

### Fixed
- Session restore edge cases
- Cross-tab sync issues

---

## Decision Log

### 2026-04-08: problem_progress as Authoritative Source
**Decision**: The `problem_progress` table in Neon is the ONLY durable solved state.

**Rationale**:
- Profile's `solvedProblemIds` is a computed cache
- Interaction events are append-only logs
- `problem_progress` is the only table with atomic upserts

**Implementation**:
- `hydrateLearner()` now fetches `problem_progress` on every login
- Solved state is merged from (progress table + local + profile)
- Backend takes precedence on conflicts

**Impact**:
- Fixes "lost progress" on new device login
- Fixes stale progress after cross-device usage
- Maintains backward compatibility

### 2026-04-08: Preview/Production Domain Isolation
**Decision**: Document that preview and production have isolated localStorage (browser security feature, not a bug).

**Rationale**:
- Browsers scope localStorage to origin
- Preview URLs (`*.vercel.app`) are different origins
- Backend rehydration is the solution

**Documentation**: Added to `PERSISTENCE_HARDENING_REPORT.md` Section 6

---

## Metrics

### Test Coverage
- Total Tests: 1781
- Test Files: 77
- Passing: 100%
- Skipped: 2

### Code Quality
- Build: ✅ Passing
- TypeScript: ✅ No errors
- Lint: ✅ Clean
- Integrity Scan: ✅ Passing

### Documentation
- Core Docs: 8
- Audit Reports: 6
- Runbooks: 17
- Research Docs: 27
- Test Reports: 3
- Total: 70 markdown files (cleaned from 103)

---

## Workstream Status

| Workstream | Status | Completion | Document |
|------------|--------|------------|----------|
| Multi-Device Persistence | ✅ Complete | 100% | `PERSISTENCE_HARDENING_REPORT.md` |
| Grading Hardening | ✅ Complete | 100% | `GRADING_HARDENING_FINAL_REPORT.md` |
| QA Verification | ✅ Complete | 100% | `QA_VERIFICATION_REPORT.md` |
| Progress Audit | ✅ Complete | 100% | `PROGRESS_AUDIT_REPORT.md` |

---

## Pending Work

### Short Term (Next 7 Days)
- [ ] Monitor production for persistence fix effectiveness
- [ ] Document any edge cases found in production
- [ ] Update runbooks with new troubleshooting steps

### Medium Term (Next 30 Days)
- [ ] Instructor dashboard scoped access
- [ ] Research export pipeline
- [ ] Replay reproducibility verification

### Long Term (Before April 30)
- [ ] Paper data contract freeze
- [ ] Demo readiness
- [ ] Study launch preparation

---

## How to Update This Changelog

**For AI Agents**:
1. Add entries under `[Unreleased]` section
2. Use format: `### Category - YYYY-MM-DD`
3. Include: What, Why, Status, Files changed
4. Update Decision Log for significant architectural choices
5. Update Metrics if test counts change

**Categories**:
- `Added` - New features
- `Changed` - Changes to existing functionality
- `Deprecated` - Soon-to-be removed features
- `Removed` - Removed features
- `Fixed` - Bug fixes
- `Security` - Security improvements

---

**Last Commit**: 8c41e5a (Runtime import fix)  
**Next Expected Commit**: Persistence hardening fix  
**Branch**: `hardening/research-grade-tightening`
