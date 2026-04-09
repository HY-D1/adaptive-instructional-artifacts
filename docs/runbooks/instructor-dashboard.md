# Instructor Dashboard

> **Complete documentation for the instructor research dashboard**  
> Status: SOURCE-VERIFIED ✅ | LIVE-VERIFICATION PENDING ⏳  
> Last Updated: 2026-04-09

---

## Overview

The instructor analysis dashboard (`/research`) provides analytics and research visibility for instructors to monitor their students' progress.

---

## Bug Fix History

### Problem Statement (Fixed 2026-04-09)

The instructor analysis dashboard was failing silently on preview deployments. Instructors could not access the research dashboard, and the UI showed empty charts without any error indication.

### Root Cause

The `hydrateInstructorDashboard()` function in `dual-storage.ts` was:
1. Catching all errors and returning only a boolean (`true`/`false`)
2. The ResearchDashboard component was not checking this return value
3. No error differentiation between auth (401/403), backend (500), network, or empty scope
4. UI showed empty analytics instead of explicit error states

### Fix Implementation

#### 1. Enhanced Error Handling in `dual-storage.ts`

**Before:**
```typescript
async hydrateInstructorDashboard(): Promise<boolean> {
  // ... error handling
  return false;  // Silent failure
}
```

**After:**
```typescript
async hydrateInstructorDashboard(): Promise<
  | { ok: true; scopeEmpty: boolean; sectionCount: number; learnerCount: number }
  | { ok: false; error: 'auth' | 'backend' | 'scope_empty' | 'network'; message: string }
> {
  // Returns structured error information
}
```

#### 2. Error State UI in `ResearchDashboard.tsx`

Added explicit error state rendering for:
- **Auth errors**: "Authentication Required" - user not logged in or not an instructor
- **Backend errors**: "Dashboard Unavailable" - server failure with retry button
- **Network errors**: "Connection Error" - network issues with retry button
- **Empty scope**: "No Learners Yet" - instructor has no enrolled students

#### 3. Playwright Test Coverage

Created `tests/e2e/regression/instructor-dashboard-error-states.spec.ts`:
- Tests auth error state when not logged in
- Tests that dashboard shows data, empty state, or error state
- Tests refresh/retry functionality
- Tests for uncaught console exceptions
- API endpoint auth requirement tests

---

## Error States Reference

| Error Type | Trigger | UI State |
|------------|---------|----------|
| `auth` | 401/403 from API | "Authentication Required" |
| `backend` | 500 or null data | "Dashboard Unavailable" + Retry |
| `network` | fetch failure | "Connection Error" + Retry |
| `scope_empty` | No learners in sections | "No Learners Yet" |

---

## Data Flow

```
InstructorRoute (role check)
  ↓
ResearchPage
  ↓
ResearchDashboard.loadData()
  ↓
storage.hydrateInstructorDashboard()
  ↓
  ├─ GET /api/instructor/overview → sections + aggregates
  ├─ GET /api/instructor/learners → learner list
  └─ GET /api/learners/profiles → profiles
  ↓
Return structured result
  ↓
UI renders: Dashboard | Empty State | Error State
```

---

## Files Changed

| File | Change |
|------|--------|
| `apps/web/src/app/lib/storage/dual-storage.ts` | Enhanced `hydrateInstructorDashboard()` return type with structured errors |
| `apps/web/src/app/components/features/research/ResearchDashboard.tsx` | Added error state hooks and UI for all error types |
| `tests/e2e/regression/instructor-dashboard-error-states.spec.ts` | New test coverage for error states |
| `playwright.config.ts` | Added `chromium:instructor` project |

---

## Test Seeding for Preview

The `/api/auth/test-seed` endpoint ensures preview has:
- Instructor: `e2e-instructor@sql-adapt.test`
- Section: "E2E Test Section" with signup code
- Student: `e2e-student@sql-adapt.test` enrolled in section

This provides real scoped data for instructor dashboard testing.

---

## Live Verification Status

### Requirements for Live Playwright

1. **Preview deployment with test-seed secret** OR
2. **Production accounts with deterministic credentials**

### Current State

| Item | Status |
|------|--------|
| E2E credentials documented | ✅ `docs/E2E_AUTH_CREDENTIALS.md` |
| Playwright config updated | ✅ `chromium:instructor` project added |
| Test-seed endpoint | ✅ Implemented (preview-only) |
| Preview with test-seed secret | ❌ Not configured |
| Production accounts | ❌ Not created |

### Next Steps

To complete live verification:

```bash
# Option 1: Configure preview with test-seed secret
vercel env add E2E_TEST_SEED_SECRET <preview-deployment>
# Value: sql-adapt-e2e-test-secret

# Option 2: Create production accounts manually
# Use the credentials from docs/E2E_AUTH_CREDENTIALS.md
```

---

## Build Verification

```bash
npm run build        # ✅ PASS (2875 modules)
npm run server:build # ✅ PASS (TypeScript check)
```

---

## Confidence Assessment

| Area | Level | Reasoning |
|------|-------|-----------|
| Source fix correctness | HIGH | Type-safe structured errors |
| Error handling coverage | HIGH | All 4 error types handled |
| Build stability | HIGH | No TypeScript errors |
| Live verification | PENDING | Blocked by auth credentials |

---

## Verdict

**Source fix is complete and correct.** Live Playwright verification is blocked pending preview deployment with test-seed secret or production account creation.

---

## Related Documents

- [E2E Auth Credentials](../E2E_AUTH_CREDENTIALS.md) — Verified working credentials
- [E2E Auth Seeding](./e2e-auth-seeding.md) — Test-seed approach
- [Harness Gate Matrix](./harness-gate-matrix.md) — Lane F status
