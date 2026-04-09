# SQL-Adapt Changelog

> **Single Source of Truth for Project Progress and Decisions**
> 
> Format: [Keep a Changelog](https://keepachangelog.com/)  
> Last Updated: 2026-04-08

---

## [Unreleased] - Harderning/Research-Grade-Tightening

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
- Updated: `docs/AGENTS.md` - Added reference to new docs

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
- Core Docs: 7
- Audit Reports: 6
- Runbooks: 25+
- Total: 111 markdown files

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
