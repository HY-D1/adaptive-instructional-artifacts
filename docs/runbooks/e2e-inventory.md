# E2E Test Inventory

> **Related Documents:**  
> - [E2E Auth Credentials](../E2E_AUTH_CREDENTIALS.md) — Production test account credentials  
> - [E2E Auth Seeding](./e2e-auth-seeding.md) — Deterministic test-seed approach for preview

**Date**: 2026-04-09  
**Branch**: `hardening/research-grade-tightening`  
**Commit**: `a00f41d`  
**Total Spec Files**: 78

---

## 1. Quick Reference: Test Categories

| Category | Count | Purpose |
|----------|-------|---------|
| **Stateless Smoke** | 4 | Public endpoint health checks, no auth required |
| **Auth-Backed** | 6 | Real JWT auth flows, requires credentials |
| **Scenario-Based** | 6 | End-to-end user journeys |
| **Regression** | 23 | Specific bug verification |
| **Feature Tests** | 12 | Bandit, hints, assignments |
| **Integration** | 2 | Multi-component flows |
| **Research** | 3 | Research data verification |
| **Debug/Diagnostic** | 8 | Troubleshooting aids |
| **Vercel/Deploy** | 3 | Deployment validation |
| **Legacy/Archive** | 11 | Historical tests |

---

## 2. Critical Test Matrix

### A. Stateless Smoke (Shard 1 - No Auth Required)

| File | Purpose | Status | Keep/Fix/Remove |
|------|---------|--------|-----------------|
| `regression/deployed-smoke.spec.ts` | Public endpoints, corpus validation | ✅ Passing | **KEEP** |
| `vercel-deployment.spec.ts` | Vercel health, routes, assets | ✅ Passing | **KEEP** |
| `smoke.spec.ts` | Basic env sanity | ✅ Passing | **KEEP** |
| `production-smoke.spec.ts` | Production validation | ✅ Passing | **KEEP** |

### B. Auth-Backed Critical (Shard 3 - Requires Credentials)

| File | Purpose | Stateful? | Blocked By | Status |
|------|---------|-----------|------------|--------|
| `regression/deployed-auth-smoke.spec.ts` | Real auth journey | Yes | E2E credentials | ⚠️ **Blocked** |
| `regression/student-multi-device-persistence.spec.ts` | Cross-device sync | Yes | E2E credentials | ⚠️ **Blocked** |
| `regression/instructor-section-scope.spec.ts` | Section isolation | No | E2E credentials | ⚠️ **Blocked** |
| `regression/api-authz.spec.ts` | API authorization | No | E2E credentials | ⚠️ **Blocked** |
| `regression/hint-stability-beta.spec.ts` | Hint quality | Yes | E2E credentials | ⚠️ **Blocked** |
| `regression/student-script-production.spec.ts` | Production student flows | Yes | E2E credentials | ⚠️ **Blocked** |

**Blocker**: `tests/e2e/setup/auth.setup.ts:69-82` hard-requires:
- `E2E_INSTRUCTOR_EMAIL`
- `E2E_INSTRUCTOR_PASSWORD`
- `E2E_STUDENT_CLASS_CODE`

### C. Scenario Tests (Shard 3 - Stateful)

| File | Scenario | Current Status | Notes |
|------|----------|----------------|-------|
| `scenario-reload-persistence.spec.ts` | SC-1: Page reload | ✅ 7/7 passing | Core persistence |
| `scenario-cross-tab-sync.spec.ts` | SC-2: Cross-tab sync | ✅ 8/8 passing | localStorage sync |
| `scenario-offline-session.spec.ts` | SC-3: Offline mode | ⚠️ 1/5 passing | Edge cases only |
| `scenario-hints-progress-notes.spec.ts` | SC-5: Hint system | ✅ 5/5 passing | Hint persistence |
| `scenario-quota-recovery.spec.ts` | Storage quota | ✅ Passing | Quota handling |

### D. Regression Tests (Shard 2)

| File | Bug/Feature | Status | Value |
|------|-------------|--------|-------|
| `ux-bugs-save-to-notes.spec.ts` | Note saving | ✅ Passing | **HIGH** - Core feature |
| `ux-bugs-concept-readability.spec.ts` | Concept display | ✅ Passing | **HIGH** - Core feature |
| `storage-quota-resilience.spec.ts` | Quota handling | ✅ Passing | **HIGH** - Stability |
| `launch-readiness-guards.spec.ts` | Launch gates | ✅ Passing | **MEDIUM** - Ops |
| `parser-reliability.spec.ts` | SQL parsing | ✅ Passing | **MEDIUM** - Edge cases |
| `role-system.spec.ts` | Auth roles | ✅ Passing | **HIGH** - Security |
| `critical-bugs.spec.ts` | P0 bug regression | ✅ Passing | **HIGH** |
| `high-priority-bugs.spec.ts` | P1 bug regression | ✅ Passing | **MEDIUM** |
| `storage-safety-phase2.spec.ts` | Storage quota resilience (Phase 2) | ✅ Passing | **HIGH** - Safety |
| `ux-auth-redirect-feedback.spec.ts` | Unauthorized redirect feedback | ✅ Passing | **MEDIUM** - UX |

---

## 3. Fake Confidence Tests (Identify & Remove)

| File | Issue | Recommendation |
|------|-------|----------------|
| `debug-*.spec.ts` (5 files) | Diagnostic only, not product tests | **MOVE** to `tests/debug/` |
| `learning-journeys.spec.ts` | Duplicated by simpler `-simple` version | **REMOVE** (keep `-simple`) |
| `profile-validation-edge-cases.spec.ts` | Overlaps with unit tests | **REMOVE** |
| `ws-*.spec.ts` audit files | Historical verification, not ongoing | **ARCHIVE** |

---

## 4. Test Infrastructure Status

### Playwright Configuration

| Config | Workers | Purpose |
|--------|---------|---------|
| `playwright.config.ts` | 1 | Main config - serial for state safety |
| `playwright.vercel.config.ts` | 1 | Vercel deployment testing |

**Intentional workers=1**: From `playwright.config.ts:43`:
```typescript
workers: 1, // Single worker to avoid shared localStorage state issues
```

### Auth State Management

| File | Purpose | Issue |
|------|---------|-------|
| `setup/auth.setup.ts` | Creates `playwright/.auth/student.json` | Requires deterministic env vars for deployed runs |
| `helpers/auth-state-paths.ts` | Path constants | None |
| `helpers/auth-env.ts` | URL resolution | None |

---

## 5. Sharding Strategy (Per User Requirements)

### Shard 1: Stateless Smoke / Route / Asset / Health / Vercel
- **Files**: `deployed-smoke.spec.ts`, `vercel-deployment.spec.ts`, `smoke.spec.ts`
- **Workers**: 1 per job (stateless but keep pattern)
- **Auth**: None required
- **Time**: ~30s

### Shard 2: Instructor / Research / Notes / UX Regressions
- **Files**: `regression/ux-bugs-*.spec.ts`, `regression/role-system.spec.ts`, `regression/critical-bugs.spec.ts`
- **Workers**: 1 per job
- **Auth**: Via `addInitScript` (local profile seeding)
- **Time**: ~2min

### Shard 3: Student Persistence / Auth / Session / Multi-Device (SERIAL)
- **Files**: `deployed-auth-smoke.spec.ts`, `student-multi-device-persistence.spec.ts`, `scenario-*.spec.ts`
- **Workers**: 1 (must be serial)
- **Auth**: Real JWT via `setup:auth`
- **Time**: ~5min
- **Blocked**: Pending deterministic E2E credentials

---

## 6. E2E Trustworthiness Assessment

| Dimension | Score | Notes |
|-----------|-------|-------|
| **Determinism** | ⚠️ 6/10 | Auth tests blocked by env gap |
| **Coverage** | ✅ 8/10 | Core flows covered |
| **Speed** | ⚠️ 5/10 | Serial execution, 78 files |
| **Maintainability** | ✅ 7/10 | Good helper patterns |
| **False Positive Rate** | ✅ 8/10 | Low flake rate |

### Confidence Gaps

1. **No auth-backed deployed verification** (WS5-BLOCKER-001)
2. **Cross-tab sync relies on manual localStorage copy**
3. **Hint stability requires live LLM** (non-deterministic)
4. **Workers=1 limits speedup options**

---

## 7. Recommended Actions

### Immediate (This Session)

- [ ] **Message 3/9**: Implement deterministic E2E credential seeding
- [ ] **Message 5/9**: Remove sleep-heavy patterns, add event-driven waits
- [ ] **Message 6/9**: Implement shard-safe parallel jobs

### Short-term (This Week)

- [ ] Move debug tests to separate directory
- [ ] Remove duplicate/obsolete regression tests
- [ ] Add helper utilities for hydration detection
- [ ] Document auth seeding procedure

### Ongoing

- [ ] Monitor flaky test rate
- [ ] Track test execution time trends
- [ ] Review new tests for harness compliance

---

## 8. File Manifest

<details>
<summary>Click to expand full 78-file manifest</summary>

### Audit & Debug (8)
- `tests/e2e/audit/ws-1-audit.spec.ts`
- `tests/e2e/debug-nav.spec.ts`
- `tests/e2e/debug-data-flow.spec.ts`
- `tests/e2e/debug-learnerid.spec.ts`
- `tests/e2e/debug-persist.spec.ts`
- `tests/e2e/debug-timing.spec.ts`
- `tests/e2e/debug-trace.spec.ts`
- `tests/e2e/ws-4-audit.spec.ts`

### Core Smoke (4)
- `tests/e2e/smoke.spec.ts`
- `tests/e2e/production-smoke.spec.ts`
- `tests/e2e/regression/deployed-smoke.spec.ts`
- `tests/e2e/regression/deployed-auth-smoke.spec.ts`

### Scenarios (6)
- `tests/e2e/scenario-reload-persistence.spec.ts`
- `tests/e2e/scenario-cross-tab-sync.spec.ts`
- `tests/e2e/scenario-offline-session.spec.ts`
- `tests/e2e/scenario-hints-progress-notes.spec.ts`
- `tests/e2e/scenario-quota-recovery.spec.ts`
- `tests/e2e/cross-tab-sync.spec.ts`

### Regression (23)
- `tests/e2e/regression/2026-03-24-*.spec.ts` (5 files)
- `tests/e2e/regression/api-authz.spec.ts`
- `tests/e2e/regression/critical-bugs.spec.ts`
- `tests/e2e/regression/high-priority-bugs.spec.ts`
- `tests/e2e/regression/medium-priority-bugs.spec.ts`
- `tests/e2e/regression/edge-cases.spec.ts`
- `tests/e2e/regression/hint-stability-beta.spec.ts`
- `tests/e2e/regression/instructor-section-scope.spec.ts`
- `tests/e2e/regression/student-multi-device-persistence.spec.ts`
- `tests/e2e/regression/student-script-production.spec.ts`
- `tests/e2e/regression/ux-bugs-*.spec.ts` (2 files)
- `tests/e2e/regression/storage-quota-resilience.spec.ts`
- `tests/e2e/regression/parser-reliability.spec.ts`
- `tests/e2e/regression/query-13-bug.spec.ts`
- `tests/e2e/regression/role-system.spec.ts`
- `tests/e2e/regression/textbook-*.spec.ts` (2 files)
- `tests/e2e/regression/launch-readiness-guards.spec.ts`
- `tests/e2e/regression/ws-5-instructor-dashboard.spec.ts`
- `tests/e2e/regression/learning-journeys*.spec.ts` (2 files)

### Features (12)
- `tests/e2e/features/assignment-strategy-*.spec.ts` (5 files)
- `tests/e2e/features/bandit-learning.spec.ts`
- `tests/e2e/features/escalation-profiles.spec.ts`
- `tests/e2e/features/hdi-*.spec.ts` (2 files)
- `tests/e2e/features/multi-armed-bandit.spec.ts`
- `tests/e2e/features/profile-*.spec.ts` (2 files)

### Integration (2)
- `tests/e2e/integration/enhanced-hints.spec.ts`
- `tests/e2e/integration/retrieval-grounding.spec.ts`

### Research (3)
- `tests/e2e/research/research-3d-browser-verification.spec.ts`
- `tests/e2e/research-1-verify-learner-loop-logging.spec.ts`
- `tests/e2e/features/2026-03-24-indicators.spec.ts`

### Vercel/Deploy (3)
- `tests/e2e/vercel-deployment.spec.ts`
- `tests/e2e/performance.spec.ts`
- `tests/e2e/performance-benchmarks.spec.ts`

### Storage/Edge Cases (8)
- `tests/e2e/storage-*.spec.ts` (3 files)
- `tests/e2e/edge-case-bugs-found.spec.ts`
- `tests/e2e/error-boundaries.spec.ts`
- `tests/e2e/feature-integration.spec.ts`
- `tests/e2e/learning-interface-storage.spec.ts`
- `tests/e2e/neon-persistence.spec.ts`

### Misc (5)
- `tests/e2e/profile-id-validation-simulation.spec.ts`
- `tests/e2e/profile-validation-edge-cases.spec.ts`
- `tests/e2e/learning-journeys.spec.ts`
- `tests/e2e/ux-5-note-quality.spec.ts`
- `tests/e2e/phase1-demo-access.spec.ts`

</details>

---

## 9. Related Documents

- [E2E Sharding Strategy](./e2e-sharding-strategy.md) - Detailed sharding implementation
- [E2E Auth Seeding](./e2e-auth-seeding.md) - Deterministic credential setup
- [E2E Stability Guide](./e2e-stability-guide.md) - Patterns for reliable tests
- [Harness Gate Matrix](./harness-gate-matrix.md) - Acceptance criteria

---

*Last Updated: 2026-04-09 - Message 2/9 Complete*
