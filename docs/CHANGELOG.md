# SQL-Adapt Changelog

> **Single Source of Truth for Project Progress and Decisions**
> 
> Format: [Keep a Changelog](https://keepachangelog.com/)  
> Last Updated: 2026-04-10

---

## [Unreleased] - Harderning/Research-Grade-Tightening

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

### Fixed - 2026-04-10 (Instructor Dashboard Visibility)

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
