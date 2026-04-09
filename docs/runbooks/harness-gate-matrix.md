# Harness Gate Matrix

**Version:** 1.0.0  
**Branch:** hardening/research-grade-tightening  
**Last Updated:** 2026-04-08

Master test lane matrix defining global regression gates before any merge.

---

## Overview

This document defines the test harness gates that MUST pass before any code is merged to the main branch. Each lane represents a critical functional area of the application. Failures in mandatory lanes block the merge; optional lanes may be waived with written evidence.

---

## Test Lanes

| Lane | Description | Test Command | Owner | Block Condition |
|------|-------------|--------------|-------|-----------------|
| **A. Boot/Runtime** | App boots without crash, core bundles load | `npm run test:unit` (Vitest) + `npm run build` | Core Platform | Any runtime error, build failure, or boot crash |
| **B. Auth/Login** | Signup, login, logout flows, JWT handling, session persistence | `npx playwright test -c playwright.config.ts --project=setup:auth` + `tests/e2e/regression/deployed-auth-smoke.spec.ts` | Auth Team | Auth flow broken, JWT not set, logout fails |
| **C. Student Practice** | Problem solving, progress tracking, hints, code execution | `npx playwright test -c playwright.config.ts tests/e2e/scenario-reload-persistence.spec.ts` + `tests/unit/web/progress-persistence.test.ts` | Learning Team | Progress not saving, hints broken, execution fails |
| **D. Textbook/Notes** | Notes, highlights, units, Save to Notes feature | `npx playwright test -c playwright.config.ts tests/e2e/regression/ux-bugs-save-to-notes.spec.ts` + `tests/e2e/ux-5-note-quality.spec.ts` | Content Team | Data loss, notes not persisting, export fails |
| **E. Instructor/Research** | Dashboard, exports, telemetry, research data integrity | `npx playwright test -c playwright.config.ts tests/e2e/regression/instructor-section-scope.spec.ts` + `tests/unit/server/research-export.contract.test.ts` | Research Team | Research integrity compromised, section isolation broken |
| **F. Storage/Quota** | Storage limits, corruption recovery, LRU eviction | `npx playwright test -c playwright.config.ts tests/e2e/regression/storage-quota-resilience.spec.ts` + `tests/e2e/scenario-quota-recovery.spec.ts` | Platform Team | Quota errors unhandled, data corruption, crash on full storage |
| **G. Env Parity** | Preview vs prod consistency, deployed smoke tests | `npm run test:e2e:launch-smoke` | DevOps | Env mismatch, deployed features broken |

---

## Pre-Merge Requirements

### Mandatory Pass Lanes (MUST PASS)

The following lanes **MUST** pass for any merge:

| Lane | Rationale |
|------|-----------|
| **A. Boot/Runtime** | If the app won't boot, nothing else matters |
| **B. Auth/Login** | Authentication is the gateway to all user features |
| **C. Student Practice** | Core learning loop must function correctly |
| **F. Storage/Quota** | Data loss is unacceptable; storage must be resilient |

### Conditional Pass Lanes (May Waive)

The following lanes may be waived with written evidence:

| Lane | Waiver Conditions | Required Evidence |
|------|-------------------|-------------------|
| **D. Textbook/Notes** | Only non-note features changed | PR description explaining why notes unaffected |
| **E. Instructor/Research** | Only student-facing features changed | Explicit statement + test results showing student lanes pass |
| **G. Env Parity** | Preview env temporarily unavailable | Screenshot of local smoke tests passing |

### Cross-Lane Testing Rule

> **Any change that touches shared infrastructure (storage, auth, API contracts) MUST pass ALL lanes.**

Shared infrastructure includes but is not limited to:
- `apps/web/src/app/lib/storage/*`
- `apps/web/src/app/lib/api/*`
- `apps/server/src/routes/*`
- Any contract test file (`.contract.test.ts`)

---

## Test Inventory

### Lane A: Boot/Runtime

| Test File | Purpose | Type |
|-----------|---------|------|
| `apps/web/src/app/lib/runtime-config.test.ts` | Runtime configuration loading | Unit (Vitest) |
| `apps/web/src/app/lib/db-env-resolver.test.ts` | Database environment resolution | Unit (Vitest) |
| `tests/e2e/smoke.spec.ts` | Basic smoke tests (@weekly) | E2E (Playwright) |
| `npm run build` | Production bundle build | Build |

### Lane B: Auth/Login

| Test File | Purpose | Type |
|-----------|---------|------|
| `tests/e2e/setup/auth.setup.ts` | Auth state setup for E2E | E2E Setup |
| `tests/e2e/regression/deployed-auth-smoke.spec.ts` | Full auth journey (@deployed-auth-smoke) | E2E |
| `tests/unit/server/auth-login-telemetry.contract.test.ts` | Auth event logging contract | Unit (Contract) |
| `tests/unit/server/neon-sessions.contract.test.ts` | Session persistence contract | Unit (Contract) |
| `apps/web/src/app/lib/auth.test.ts` | Client-side auth logic | Unit (Vitest) |
| `apps/web/src/app/lib/auth-route-loader.test.ts` | Auth route loading | Unit (Vitest) |

### Lane C: Student Practice

| Test File | Purpose | Type |
|-----------|---------|------|
| `tests/unit/web/progress-persistence.test.ts` | Progress persistence logic | Unit (Vitest) |
| `tests/e2e/scenario-reload-persistence.spec.ts` | Page reload persistence (@critical) | E2E |
| `tests/e2e/scenario-hints-progress-notes.spec.ts` | Hints + progress + notes flow | E2E |
| `tests/e2e/regression/student-multi-device-persistence.spec.ts` | Cross-device persistence (@authz) | E2E |
| `apps/web/src/app/hooks/useLearnerProgress.test.ts` | Progress hook logic | Unit (Vitest) |
| `apps/web/src/app/lib/ml/hint-service/*.test.ts` | Hint service tests | Unit (Vitest) |
| `apps/web/src/app/lib/sql-executor.*.test.ts` | SQL execution tests | Unit (Vitest) |

### Lane D: Textbook/Notes

| Test File | Purpose | Type |
|-----------|---------|------|
| `tests/e2e/regression/ux-bugs-save-to-notes.spec.ts` | Save to Notes regression | E2E |
| `tests/e2e/ux-5-note-quality.spec.ts` | Note quality verification | E2E |
| `tests/e2e/regression/textbook-snapshots.spec.ts` | Textbook rendering | E2E |
| `apps/web/src/app/lib/content/save-to-notes-integration.test.ts` | Notes integration | Unit (Vitest) |
| `apps/web/src/app/lib/ml/textbook-orchestrator.test.ts` | Textbook orchestration | Unit (Vitest) |

### Lane E: Instructor/Research

| Test File | Purpose | Type |
|-----------|---------|------|
| `tests/e2e/regression/instructor-section-scope.spec.ts` | Section isolation (@authz @section-scope) | E2E |
| `tests/e2e/regression/ws-5-instructor-dashboard.spec.ts` | Instructor dashboard | E2E |
| `tests/unit/server/research-export.contract.test.ts` | Research data export contract | Unit (Contract) |
| `tests/unit/server/neon-interactions-validation.test.ts` | Interaction schema validation | Unit (Contract) |
| `tests/e2e/research/research-3d-browser-verification.spec.ts` | Research verification | E2E |
| `apps/web/src/app/lib/__tests__/research-*.test.ts` | Research dashboard tests | Unit (Vitest) |
| `apps/web/src/app/lib/telemetry/*.test.ts` | Telemetry event tests | Unit (Vitest) |

### Lane F: Storage/Quota

| Test File | Purpose | Type |
|-----------|---------|------|
| `tests/e2e/regression/storage-quota-resilience.spec.ts` | Quota resilience (@regression @storage) | E2E |
| `tests/e2e/scenario-quota-recovery.spec.ts` | Quota recovery scenarios (@weekly @quota) | E2E |
| `tests/e2e/scenario-cross-tab-sync.spec.ts` | Cross-tab synchronization | E2E |
| `tests/e2e/storage-*.spec.ts` | Storage edge cases and validation | E2E |
| `tests/unit/web/progress-persistence.test.ts` | SC-4 quota scenarios | Unit (Vitest) |
| `apps/web/src/app/lib/storage/safe-storage.test.ts` | Safe storage wrapper | Unit (Vitest) |
| `apps/web/src/app/lib/storage/dual-storage.test.ts` | Dual storage layer | Unit (Vitest) |
| `apps/web/src/app/lib/storage/cache-trimmer.test.ts` | Cache trimming/LRU | Unit (Vitest) |
| `apps/web/src/app/lib/storage/storage-budget.test.ts` | Storage budget management | Unit (Vitest) |

### Lane G: Env Parity

| Test File | Purpose | Type |
|-----------|---------|------|
| `tests/e2e/regression/deployed-smoke.spec.ts` | Deployed environment smoke | E2E |
| `tests/e2e/regression/launch-readiness-guards.spec.ts` | Launch readiness (@regression @launch-guard) | E2E |
| `npm run test:e2e:launch-smoke` | Full launch smoke suite | Script |
| `npm run integrity:scan` | Token corruption and import checks | Script |

---

## Quick Reference Commands

```bash
# Run all unit tests (Lane A foundation)
npm run test:unit

# Run all E2E tests
npm run test:e2e

# Run specific lane tests
npx playwright test -c playwright.config.ts --project=setup:auth          # Lane B
npx playwright test -c playwright.config.ts tests/e2e/scenario-reload-persistence.spec.ts  # Lane C
npx playwright test -c playwright.config.ts tests/e2e/regression/storage-quota-resilience.spec.ts  # Lane F

# Run contract tests
npx vitest run tests/unit/server/*.contract.test.ts

# Run with coverage (all thresholds must pass)
npx vitest run --coverage

# Full build verification (Lane A)
npm run build
```

---

## Merge Policy

### Green Merge Criteria

A PR is eligible for merge when:

1. **All mandatory lanes (A, B, C, F) pass**
2. **Coverage thresholds met** (lines: 70%, functions: 70%, branches: 65%)
3. **No console errors** in E2E tests (except expected QuotaExceededError)
4. **Build succeeds** without warnings

### Waived Lane Process

If waiving optional lanes (D, E, G):

1. Document waiver reason in PR description
2. Link to passing tests in affected lanes
3. Get approval from lane owner
4. Add `waived-lane-*` label to PR

### Emergency Override

In exceptional circumstances, a merge may proceed with failing lanes if:

1. **Security vulnerability** requires immediate fix
2. **Production outage** requires hotfix
3. **Written approval** from 2+ senior maintainers
4. **Post-merge verification** plan documented

---

## Lane Ownership

| Lane | Primary Owner | Backup | Contact |
|------|---------------|--------|---------|
| A. Boot/Runtime | Platform Lead | DevOps | @platform-team |
| B. Auth/Login | Security Lead | Backend Lead | @auth-team |
| C. Student Practice | Learning Lead | Frontend Lead | @learning-team |
| D. Textbook/Notes | Content Lead | UX Lead | @content-team |
| E. Instructor/Research | Research Lead | Data Lead | @research-team |
| F. Storage/Quota | Platform Lead | Performance Lead | @platform-team |
| G. Env Parity | DevOps Lead | QA Lead | @devops-team |

---

## Related Documentation

- [CLAUDE.md](../../CLAUDE.md) - Project context and conventions
- [docs/runbooks/storage-audit.md](./storage-audit.md) - Storage system deep dive
- [docs/runbooks/beta-telemetry-readiness.md](./beta-telemetry-readiness.md) - Telemetry requirements
- [playwright.config.ts](../../playwright.config.ts) - E2E test configuration
- [vitest.config.ts](../../vitest.config.ts) - Unit test configuration

---

## Changelog

| Date | Version | Change |
|------|---------|--------|
| 2026-04-08 | 1.0.0 | Initial harness gate matrix |
