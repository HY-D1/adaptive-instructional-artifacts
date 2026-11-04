# Handoff: `test/system_stable`

Last updated 2026-11-04 (cutover update). Repository `HY-D1/adaptive-instructional-artifacts`.

Every commit is authored and committed as `HY-D1 <93563405+HY-D1@users.noreply.github.com>`, with no co-author or session trailers.

## 0. Start here

1. Pull the branch and run the checks in section 4.
2. Read section 5 before any merge to `main`. A merge changes production on purpose, and one database migration must be applied first.
3. Pick up open work from section 7. The top items block a safe merge.

Keep the commit identity when you work locally:

```bash
git config user.name "HY-D1"
```

```bash
git config user.email "93563405+HY-D1@users.noreply.github.com"
```

Before pushing, check for unwanted trailers:

```bash
git log origin/test/system_stable..HEAD --format='%h %an <%ae>%n%b' | grep -i "co-authored" || echo "no trailers"
```

## 1. Status

| Item | State |
|---|---|
| Branch | `test/system_stable`, branched from `main` at `06bc666`. commits ahead of `main`: the 17 listed in the first table below plus the cutover commits in the second table |
| `main` (production) | `06bc666`, untouched. A merge would be a fast-forward with no conflicts (checked 2026-11-04) |
| Merged to production? | **No.** Merging changes production behaviour on purpose (section 5) |
| Unit tests (run 2026-11-04) | PASS: 2093 passed, 2 skipped (vitest, all files, including the instructor-logging test) |
| Type checks / builds (run) | PASS: web `tsc --noEmit`, `npm run server:build`, `npm run integrity:scan`, `vite build` |
| Browser tests (run) | PASS: the CI "core" Playwright subset, 9/9 |
| Python (run) | PASS: `python3 -m unittest analysis.hdi_validation.tests.test_hdi_parity`, 3 tests |
| **NOT RUN** | Anything that needs live Neon, Qualtrics or Groq; the full Playwright suites; the 50-student load test (section 6) |

## 2. What the branch changes (oldest first)

| Commit | Summary | Who notices |
|---|---|---|
| `34adde9` | **Security.**<br>• `/api/llm/*` needs login + CSRF. Prompts are capped at 32,000 chars and only allowlisted models are allowed.<br>• The unguarded `/ollama/api/*` aliases are removed.<br>• No default CORS wildcard. In `CORS_ORIGIN_PATTERNS`, `*` matches one `[a-z0-9-]+` label.<br>• Login compares unknown emails against a real bcrypt hash, so there is no timing leak.<br>• A hosted deploy without a DB URL returns 503 instead of opening the SQLite routes.<br>• The frontend LLM client sends credentials and CSRF. | Everyone using LLM hints; preview deployments (CORS) |
| `67ae97f` | **Research integrity.**<br>• `DELETE /api/learners/:id` returns 405 (it used to cascade through all research data).<br>• Instructors are read-only on students (`requireSelfForWrite`).<br>• `POST /api/learners` works only for your own ID, and the role comes from the token. `PUT` rejects role changes.<br>• Shared bandit rewards require a logged `bandit_arm_selected` event for the same student and arm, otherwise 409.<br>• `initializeSchema()` now creates the `interaction_textbook_unit_retrievals` table. Migration: `20261104-interaction-retrievals.sql`. | Instructors (no writes); the bandit pool |
| `8a978d4` | **Survey.**<br>• ResponseID format check when the survey URL is `*.qualtrics.com`.<br>• One ResponseID completes one invitation (partial unique index).<br>• New `verification_status` column.<br>• Optional live Qualtrics API check, and `check-survey-linkage.mjs --apply-verification`.<br>• Only `CORPUS_ADMIN_LEARNER_IDS` may switch the active corpus run.<br>• Migration: `20261104-survey-verification.sql`. | Students completing the pre-survey |
| `8506eb3` | **Server.**<br>• `load-env.ts` makes `apps/server/.env*` actually load before config (local dev).<br>• DB-backed rate limits for login and LLM generate, shared across serverless instances.<br>• 7-day JWT, renewed on `/api/auth/me`.<br>• Test-seed runs only on explicit preview/dev, never on the production DB.<br>• CSV exports are injection-safe. Exports report truncation and are pseudonymized by default (`?includeNames=true` for names).<br>• Generic error messages outside development. | Operators, researchers |
| `8efb16f` | **Tooling.**<br>• `scripts/dev-start.sh` de-corrupted. The corruption scanner now covers `scripts/`, `tests/` and `.github`.<br>• Real `db:migrate` (`apps/server/src/db/migrate.ts`): dry run by default, `--apply`, `--baseline`.<br>• Verify scripts load env correctly. `backfill-research-telemetry` is a dry run unless `--apply`.<br>• PDF upload filenames are sanitized, and the dev upload rejects cross-origin requests.<br>• The local server binds `127.0.0.1` (`HOST` overrides). | Developers |
| `7c28115` | **Dependencies.**<br>• react-router 7.18.5, dompurify 3.4.17, express 4.22.3, compression 1.8.2, express-rate-limit 8.7.3.<br>• Overrides: qs ^6.17.1, proxy-addr ^2.0.8.<br>• npm audit (prod): root 3 to 0, server 20 to 14. The rest (the sqlite3 build chain, zod, uuid) need major upgrades. | Nobody visibly |
| `36d7b45` | **Client.**<br>• Bandit reward and learning-path "success" only for a *correct* result.<br>• Logout clears the previous learner's cached data on shared machines. Drafts are kept; unsynced queues are kept unless the logout sync was confirmed.<br>• 401/403 batches are retried, not dead-lettered. The queue sends only the signed-in learner's events. | Students on shared lab PCs |
| `accf155` | **Storage.**<br>• Error counts merge by per-key max. Before, they compounded (3 became 12).<br>• A full localStorage no longer blocks backend sends.<br>• Bandit, condition and HDI events use the durable queue. | Instructor analytics accuracy |
| `1304d08` | **Grading.**<br>• Problems 6, 14, 15 and 16 (`orderSensitive` in `apps/web/src/app/data/problems.ts`) require a top-level `ORDER BY`.<br>• The exercise DB is reseeded before every attempt. | Students on those 4 problems |
| `026d28f` | **D1.** The control arm keeps its hash-based sub-schedule (fast/adaptive/slow escalator), now logged honestly: `profile_assigned` strategy `static`, reason `control_static_hash_profile`, plus `condition_assigned.metadata.controlSubSchedule`. Documented in `docs/research/ESCALATION_POLICIES.md`. | Analysis only |
| `eae4b54` | **D2.** "Textbook off" now stops every textbook write. No live effect: both current arms have the textbook on. | Nobody today |
| `072d6e8` | **D3.** The app's HDI (`hdi-calculator.ts`) is canonical. The Python validation and `HDI.md` now match it, checked by the shared fixture `tests/fixtures/hdi-parity.json`. | Analysis only |
| `928771a` | **D4.** One equal-weight reward formula (`reward-calculator.ts`: `calculateReward(buildRewardComponents(...))`, max 0.6) for the shared pool, the local fallback and the logs. `bandit_updated` logs real alpha/beta. Documented in `docs/research/BANDIT.md`. | Analysis only |
| `aec245c` | **D5.** Docs: `successful` and `solved` are client-asserted (`DATA_CONTRACTS.md`, `LOGGING.md`, README). | Docs |
| `943c284` | Cleanup: 31 provably unused files deleted. The production bundle is byte-identical before and after. | Nobody |
| `93d8a98` | **Instructor actions.**<br>• Dashboard "intervene" and "override profile" log under the **instructor's own ID** (`authUser?.learnerId ?? profile?.id`), with the student in `payload.targetLearnerId`.<br>• The override uses the new event type `instructor_profile_override` instead of a fake `condition_assigned`.<br>• Without this, after `67ae97f` these writes got 403 and stayed queued. | Instructors (actions are now saved) |
| (this file) | `docs/runbooks/test-system-stable-handoff.md` | Nobody |

Cutover commits (after the table above, oldest first):

| Commit | Summary | Who notices |
|---|---|---|
| `10ef940` | **Logout and queues.** Logout no longer removes unsynced queue keys. Caches are cleared only when the learner has nothing unsynced. A one-time requeue of stranded dead-lettered events (flag `sql-adapt-deadletter-requeue-v1`). | Students on shared PCs |
| `4f51c4c` | **Each help action is logged once.** `explanation_view` is keyed by explanation id, one `guidance_request` per click, escalation only on new events, textbook double-click guard. | Analysis (fewer duplicates) |
| `54a312d` | **Logged hint level capped at 3.** The slow escalator still gives 4 hints. Hints 3 and 4 share `hint_id` `...:L3` and differ by `help_request_index`. The static-path slow escalator now auto-escalates after the 4th hint. | Analysis |
| `b1ecf99`, `5046b7d`, `2c6991a` | **Classifier port from `front_end_test`.** Syntax errors no longer default to `missing commas`. Wrong-result runs get a semantic subtype on `execution` events with `successful: false`. The `ORDER BY` rule applies only to order-sensitive problems; state-graded problems are skipped. 20 of 23 subtypes are reachable, 3 are in `SEMANTIC_SUBTYPE_EXCLUSIONS`. Server `error_history` counts these `execution` events; local dashboard counters count only `eventType 'error'` (known divergence). | Students (hints), analysis |
| `897a368` | **Cutover marker.** `SQL_ENGAGE_POLICY_VERSION` `sql-engage-index-v4-semantic-classifier`, `RESEARCH_CONTRACT_VERSION` `v2.7.0`. | Analysis |
| `88ab677` | **SQL-Engage fallback row** is seeded per learner, problem, subtype and rung. | Students |
| `a61bfe4`, `7e3452e` | **Server-assigned condition.** The `student_condition_assignments` row is authoritative for `condition_id` on events and sessions (a mismatch logs `[condition/override]`). If the lookup fails, the client value is used (`[condition/lookup-failed]`). The client accepts `control` session configs. | Analysis |
| `32d4391`, `c087a9f` | **Research rows are guarded against deletes.** Migration `20261105-protect-research-deletes.sql`: `BEFORE DELETE` row triggers and `BEFORE TRUNCATE` statement triggers on `users`, `course_sections`, `section_enrollments`, `interaction_events` (lock timeout 5 s; fails if a table is missing). `migrate.ts --mark-applied <file>[,<file>]` records already-applied files without running them; `--baseline` now warns. | Operators |
| (cutover docs) | `docs(research): cutover notes and historical-data rules; CI requires type check`. Cutover and historical-data sections in `LOGGING.md` and `DATA_CONTRACTS.md`, canonical event-type list plus `tests/unit/web/event-type-doc-sync.test.ts`, and `smoke-test` (build and `tsc --noEmit`) added to the CI gate's `needs`. | Analysts, CI |

## 3. Decisions on record

- **Protocol choices:**
  - D1: keep the control variation and log it.
  - D2: make the textbook flag complete.
  - D3: the app's HDI is canonical.
  - D4: keep the equal-weight reward.
  - D5: accept and document client-side grading.
  - Instructor actions are logged under the instructor's ID.
- **Cutover decisions (2026-11-04):**
  - Remove `MAINTENANCE_MODE` and stay live. There is no maintenance window; production keeps serving during the merge.
  - Cap the logged hint level at 3 (`GuidanceRung` stays 1 | 2 | 3; no rung 4 is added).
  - Do the full classifier port from `front_end_test`.
  - HY-D1 makes all commits, with no trailers.
- **Audit correction:** the instructor concept-coverage denominator of 6 is correct, because coverage only records the 6 `VALID_CONCEPT_IDS` in `storage.ts`. Only a clamp to 100% was added.
- **Survey format check:** it applies only to `*.qualtrics.com` survey URLs, because pilot and manual tooling submit synthetic IDs (`pilot-…`, `manual-stub-…`). `SURVEY_ALLOW_SYNTHETIC_RESPONSE_IDS=true` allows them again on isolated test targets.

## 4. Local setup and checks (macOS, Node 22)

The root `package.json` requires Node `>=22.x`, and `.nvmrc` is `22`.

```bash
git fetch origin test/system_stable
```

```bash
git switch test/system_stable
```

```bash
npm ci && (cd apps/server && npm ci)
```

```bash
npx playwright install chromium
```

Checks (all passed in the cloud on 2026-11-04):

```bash
npm run integrity:scan && npm run server:build && npx tsc --noEmit && npx vitest run
```

```bash
python3 -m unittest analysis.hdi_validation.tests.test_hdi_parity
```

The CI "core" browser subset, the same as `.github/workflows/regression-gate.yml`:

```bash
CI=true PLAYWRIGHT_LOCAL_DEV=true npx playwright test -c playwright.config.ts --project=chromium tests/e2e/features/2026-03-24-indicators.spec.ts tests/e2e/regression/2026-03-24-hint-ladder.spec.ts tests/e2e/regression/2026-03-24-welcome-modal.spec.ts tests/e2e/regression/2026-03-24-smoke.spec.ts tests/e2e/regression/phase1-demo-access.spec.ts tests/e2e/regression/learning-journeys-simple.spec.ts tests/e2e/regression/role-system.spec.ts --grep 'toast component renders correctly|hint level persistence: events are stored|mobile layout keeps footer|smoke: practice editor draft persists|Instructor can access /textbook directly|Student accessing /textbook works directly|cross-tab profile sync|unauthenticated user accessing /practice|Student accessing /research redirects'
```

Local env notes:
- Since `8506eb3`, `apps/server/.env` and `.env.local` are really loaded. Start from `apps/server/.env.example`.
- Set `NODE_ENV=development` for test-seed to work locally.
- The local server binds `127.0.0.1`. Set `HOST` to change it.

## 5. Merging to `main` changes production: blockers and checklist

The merge itself runs no SQL, but the new backend expects a new schema.

Production facts (read-only `GET /health`, 2026-11-04):
- Neon via `DATABASE_URL`, LLM on Groq, `environment: production`.
- `apps/server/vercel.json` sets `AUTO_SCHEMA_INIT=false`. It is a legacy `env` block, still applied per the Vercel docs, so the schema is not created automatically.

### Blockers (do these before merging)

1. **Apply the migrations first (blocker 3), above all `20261104-survey-verification.sql`.** Without the `verification_status` column, every survey completion fails and students cannot get past the pre-survey gate. `20261105-protect-research-deletes.sql` is applied in the same run.
2. **CLEARED (checked 2026-11-04, read-only, against production): ResponseID format.** All 13 stored IDs match `^R_[A-Za-z0-9]{15}$` (`apps/server/src/lib/survey-response-verification.ts`), so the regex needs no change. Re-check only if more surveys complete before the merge:

   ```sql
   SELECT qualtrics_response_id FROM survey_invitations WHERE qualtrics_response_id IS NOT NULL LIMIT 20;
   ```

   If any real ID differs, loosen the regex before merging (for example `^R_[A-Za-z0-9]{8,32}$`).
3. **Do not run `migrate --baseline` or a plain `--apply` on production yet.** The production manifest (`apps/server/src/db/migrations/production-manifest.txt`) lists 7 files: 4 older ones that are probably already applied by hand, and 3 new ones (`20261104-interaction-retrievals`, `20261104-survey-verification`, `20261105-protect-research-deletes`).
   - `--baseline` would mark the new files as applied without running them (it now prints a warning).
   - `--apply` would re-run the 4 older files. Re-running `20261101-learner-profile-events.sql` marks every stored interaction as profile-handled.

   Instead, confirm the old objects exist, record the 4 old files with `--mark-applied`, then check the dry run, then apply. `--mark-applied` creates the ledger if needed and stores the same sha256 that `migrate.ts` computes.

   ```sql
   -- confirm the old objects exist (read-only)
   SELECT to_regclass('public.signup_rate_limits'), to_regclass('public.problem_progress_events'), to_regclass('public.learner_profile_events');
   SELECT column_name FROM information_schema.columns WHERE table_name='interaction_events' AND column_name IN ('condition_id','execution_time_ms','metadata');
   ```

   ```bash
   MIGRATE_DATABASE_URL='<production url>' npm run server:db:migrate -- --mark-applied 20261031-interaction-event-fields.sql,20261031-signup-rate-limits.sql,20261031-problem-progress-events.sql,20261101-learner-profile-events.sql
   ```

   The dry run must list EXACTLY the 3 new files as pending (`20261104-interaction-retrievals`, `20261104-survey-verification`, `20261105-protect-research-deletes`). If it lists anything else, stop.

   ```bash
   MIGRATE_DATABASE_URL='<production url>' npm run server:db:migrate
   ```

   ```bash
   MIGRATE_DATABASE_URL='<production url>' npm run server:db:migrate -- --apply
   ```

   Rehearse all of this on a Neon branch first (section 6). If the runner cannot open Neon's WebSocket connection from your network, run the 3 SQL files in the Neon SQL editor instead. All are additive and idempotent. The delete guard does not block inserts or updates, and old (`main`) code still runs on the migrated schema.
4. **CLEARED (checked 2026-11-04, read-only, against production): duplicate ResponseIDs.** There are none. Re-check before merging; if this returns rows, the unique index is skipped:

   ```sql
   SELECT qualtrics_response_id, COUNT(*) FROM survey_invitations WHERE qualtrics_response_id IS NOT NULL GROUP BY 1 HAVING COUNT(*) > 1;
   ```

### Vercel backend env (Production and Preview), then redeploy

- `CORS_ORIGIN_PATTERNS=https://adaptive-instructional-artifacts-*-hy-d1s-projects.vercel.app`
  - Without it, preview frontends are refused.
  - The production frontend `https://adaptive-instructional-artifacts.vercel.app` is in the default allow-list (`apps/server/src/config.ts`).
- `TRUST_PROXY=true`, so IP-keyed limits see real client IPs. A one-time `[startup/client-ip-check]` log line shows what the server sees.
- `RESEARCH_EXPORT_HASH_SECRET=<random 32+ chars>`. If it is unset, email hashes are left out of exports.
- Optional:
  - `CORPUS_ADMIN_LEARNER_IDS`. Without it, nobody can switch the active corpus run.
  - `QUALTRICS_API_TOKEN` and `QUALTRICS_DATACENTER`, for live ResponseID verification.
  - `LLM_ALLOWED_MODELS`.

### Other behaviour changes after the merge (intended)

- LLM hints need a logged-in user. During the deploy window, the old frontend gets 401 and falls back to built-in hints.
- Existing 30-day cookies stay valid until they expire. New sessions last 7 days and renew on use.
- Problems 6, 14, 15 and 16 need `ORDER BY`.
- Instructors can't modify student records. Learner DELETE is gone.
- The research export is pseudonymized. No frontend screen uses `/research/export`.
- Analysis must note the cutover date, because control events get new labels and the local-fallback reward changes scale.
- Fill in the merge timestamp (`<MERGE_TIMESTAMP_UTC — fill on merge day>`) in `docs/research/LOGGING.md` and `DATA_CONTRACTS.md` on merge day.
- Historical rows are never rewritten. Apply the rules in "Historical data (before cutover) — never rewritten" (`docs/research/LOGGING.md`) at analysis time.
- Research tables now refuse `DELETE` and `TRUNCATE` (see the withdrawal procedure below).

### Withdrawal procedure (deleting a participant's research rows)

The delete guard blocks all `DELETE` and `TRUNCATE` on `users`, `course_sections`, `section_enrollments` and `interaction_events`, including from psql. A withdrawal is a deliberate manual action:
- Do it only on a written withdrawal request, in a manual `psql` session as an operator. Never from application code or a script.
- Take a Neon snapshot or branch first. Prefer to count rows first and keep the output.
- The bypass is transaction-local, so it cannot leak into other sessions:

  ```sql
  BEGIN;
  SET LOCAL sql_adapt.allow_research_delete = 'on';
  -- count first, then delete the participant's rows (children before parents), e.g.
  -- SELECT COUNT(*) FROM interaction_events WHERE learner_id = '<learner id>';
  -- DELETE FROM interaction_events WHERE learner_id = '<learner id>';
  -- ...
  COMMIT;
  ```

- Check the counts before `COMMIT`; use `ROLLBACK` if they are not what you expect. The guard takes a lock with a 5 s timeout, so a stuck session fails fast instead of hanging.
- Record who, when and why outside the database.

### Groq

Check the requests-per-minute limit for `openai/gpt-oss-20b` on your plan. Each hint currently makes two Groq calls:
- `generateWithLLM` first calls `/api/llm/status`, which calls Groq `/models`;
- then it calls `/generate`.

So 50 simultaneous hint requests mean about 100 Groq calls. Above the limit, hints fall back to the built-in ones.

### Merge and rollback

- Merge with a fast-forward, outside class time:

  ```bash
  git push origin test/system_stable:main
  ```

- Rollback: Vercel Instant Rollback to the previous production deployment. The migrations are additive and need no rollback.

### Post-deploy checks

- `GET /health` and `GET /api/system/persistence-status`.
- One test-student walkthrough: login, pre-survey, practice, hint, textbook, logout.
- One test-instructor walkthrough: dashboard, analytics, export, intervene.
- Watch the Vercel logs for 30 minutes: `[surveys/complete]`, `[rate-limit/`, 5xx.

## 6. Proving "all features work" and "50 students at once" (NOT RUN yet)

Use a **Neon branch created from production**. Delete it afterwards, because it contains real student data. Never point load tests at production.

1. Run the migration steps from section 5 against the branch, and read the real ResponseIDs there.
2. Start a local backend on the branch, configured like production:

   ```bash
   cd apps/server && DATABASE_URL='<branch url>' AUTO_SCHEMA_INIT=false NODE_ENV=development E2E_TEST_SEED_SECRET=<secret> QUALTRICS_PRE_SURVEY_URL=http://localhost:4320/survey QUALTRICS_POST_SURVEY_URL=http://localhost:4320/survey QUALTRICS_COMPLETION_SIGNING_SECRET=<secret> WEB_APP_BASE_URL=http://localhost:5173 npm run dev
   ```

3. Mark one test section as `production` so condition assignment works (`section_type` accepts `test`, `production` or `pilot`):

   ```sql
   UPDATE course_sections SET section_type='production' WHERE id='<test section id>';
   ```

4. Full browser suites in backend mode:
   - `--project=chromium`: all non-`@flaky` specs. Add `--global-timeout=3600000`, because the default of 600 s is too short.
   - `--project=chromium:auth` and `--project=chromium:instructor`.
   - `tests/e2e/regression/api-authz.spec.ts`, `student-multi-device-persistence.spec.ts` and `instructor-section-scope.spec.ts`.
5. Run the 50-simultaneous-student test. Every stage fires all 50 requests at once (`Promise.allSettled`). The defaults are 50 users for 5 minutes; `--users`, `--duration-ms` and `--acknowledge-isolated-test-target` are also available.

   ```bash
   PILOT_ISOLATED_TARGET=true PILOT_CREDENTIALS_FILE=<new file in a temp dir> INSTRUCTOR_SIGNUP_CODE=<code> npm run beta:50-student-readiness -- --mode local --api-base-url http://127.0.0.1:3001
   ```

   **Pass criteria:**
   - 0 failed students;
   - 0 5xx responses;
   - no unexpected 429;
   - p95 under 2 s (the script itself flags p95 over 5 s).

   **Gap:** the script does not exercise instructor views, the bandit or LLM hints (backlog item 2).

## 7. Backlog (open, by priority)

1. **Before the merge:**
   - Blockers 2 and 4 are cleared. Blocker 3 (`--mark-applied`, dry run, `--apply`) and the rehearsal on a Neon branch remain.
   - Optionally add an `--http` mode (HTTPS driver) for networks that block WebSockets.
2. **Load readiness:**
   - Cache `provider.health()` for about 30 s in `apps/server/src/routes/llm.ts`. This halves the Groq calls.
   - Add an `--extended` flag to `scripts/beta/beta-50-student-readiness.mjs` without changing its default behaviour, which `tests/unit/server/beta-readiness.test.ts` covers. It should add:
     - 2 concurrent instructors (overview, analytics, export);
     - bandit selection plus reward (200, and 409 for a fake selection);
     - LLM generate against a local stub (`GROQ_BASE_URL` is configurable).
3. **CI:**
   - PRs run only 9 browser tests.
   - The `@weekly` suite exceeds the 600 s global timeout.
   - The `chromium:auth` and `chromium:instructor` projects never run in CI.
   - `tests/e2e/regression/weekly-smoke.spec.ts` is missing, so `demo:weekly` and the jq gates are dead.
   - Coverage thresholds and the replay gate are not enforced.
   - The type-check job (`smoke-test`) is now in the summary job's `needs`, so a type error blocks the merge.
4. **Repo hygiene:**
   - The root `.gitignore` `*.md` rule silently drops new docs. README and `docs/INDEX.md` link to missing files. `docs/runbooks/**/*.md` is allowed.
   - There are 3 different instructor passcodes across env files and tests.
   - Credentials are committed in `scripts/verification/test-auth-*.{js,cjs}` and `.env.example`. Rotate them if any are live.
5. **Research validity** (needs a protocol decision):
   - Grading is not on the server: all 32 reference solutions ship to the browser.
   - HDI counts only `execution` events as attempts.
   - The Python off-policy estimators have problems: propensity-0 handling, no clipping, a "matching" mode that always returns 1, and nearest-time reward matching.
   - `bandit/pooled_bandit.py` models a contextual bandit that isn't deployed.
6. **Client robustness** (reviewed findings, not fixed yet):
   - Condition toggles are taken from the client session.
   - `control` is not in `POLICY_IDS`, so `condition_assigned` is re-logged on every mount.
   - Queues are last-writer-wins across tabs.
   - The keepalive batch is not chunked (the browser caps it at 64 KB).
   - The storage probe writes near the quota.
   - Hydration drops some study fields.
   - Textbook dedup ignores `id`.
   - `fetchApi` has no timeout.
   - The orchestrator actions `upsert_textbook_unit` and `prompt_reflective_note` are never acted on.
   - Rung 4 prompts appear for the slow escalator.
   - The SQL executor has no timeout, so a recursive CTE can freeze the tab.
   - The hint leak filter misses multi-line SQL.
   - The LLM cache labels fallback hints as LLM.
   - "Generate Demo Data" wipes local storage.
7. **Dependencies:** sqlite3 6.x, zod 4.x and uuid 11.x are major upgrades. sqlite3 serves only the local fallback.

## 8. Where things live

- **Server** (`apps/server/src/`):
  - `middleware/auth.ts` (`requireSelfForWrite`) and `middleware/shared-rate-limit.ts`;
  - `lib/survey-response-verification.ts`, `lib/research-export.ts`, `lib/client-error.ts`, `lib/cors-patterns.ts`;
  - `load-env.ts`, `db/migrate.ts`, `db/migrations/` with `production-manifest.txt`.
- **Frontend** (`apps/web/src/app/`):
  - `pages/LearningInterface.tsx` (reward and textbook gates), `pages/RootLayout.tsx` (logout cleanup), `pages/InstructorDashboard.tsx` (instructor actions);
  - `lib/auth/logout-learner.ts`, `lib/storage/dual-storage.ts`, `lib/ml/reward-calculator.ts`, `lib/sql-executor.ts` (`hasTopLevelOrderBy`).
- **Tests added:**
  - `tests/unit/server/phase{1..5}-*.test.ts`;
  - `tests/unit/web/phase7*.test.ts`, `tests/unit/web/hdi-parity.test.ts`, `tests/unit/web/instructor-action-logging.test.ts`;
  - `analysis/hdi_validation/tests/`.
- **Docs updated:** `docs/research/{ESCALATION_POLICIES,HDI,BANDIT,DATA_CONTRACTS,LOGGING}.md`, `QUALTRICS_SETUP.md`, `README.md`, `apps/server/.env.example`.
