# Instructor Dashboard Analysis Access Fix

## Problem Statement

The instructor analysis dashboard (`/research`) was failing silently on preview deployments. Instructors could not access the research dashboard, and the UI showed empty charts without any error indication.

## Root Cause

The `hydrateInstructorDashboard()` function in `dual-storage.ts` was:
1. Catching all errors and returning only a boolean (`true`/`false`)
2. The ResearchDashboard component was not checking this return value
3. No error differentiation between auth (401/403), backend (500), network, or empty scope
4. UI showed empty analytics instead of explicit error states

## Fix Implementation

### 1. Enhanced Error Handling in `dual-storage.ts`

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

### 2. Error State UI in `ResearchDashboard.tsx`

Added explicit error state rendering for:
- **Auth errors**: "Authentication Required" - user not logged in or not an instructor
- **Backend errors**: "Dashboard Unavailable" - server failure with retry button
- **Network errors**: "Connection Error" - network issues with retry button
- **Empty scope**: "No Learners Yet" - instructor has no enrolled students

### 3. Playwright Test Coverage

Created `tests/e2e/regression/instructor-dashboard-error-states.spec.ts`:
- Tests auth error state when not logged in
- Tests that dashboard shows data, empty state, or error state
- Tests refresh/retry functionality
- Tests for uncaught console exceptions
- API endpoint auth requirement tests

## Files Changed

| File | Change |
|------|--------|
| `apps/web/src/app/lib/storage/dual-storage.ts` | Enhanced `hydrateInstructorDashboard()` return type with structured errors |
| `apps/web/src/app/components/features/research/ResearchDashboard.tsx` | Added error state hooks and UI for all error types |
| `tests/e2e/regression/instructor-dashboard-error-states.spec.ts` | New test coverage for error states |

## Verification

### Build
```bash
npm run build
# ✓ built successfully
```

### Test
```bash
npx playwright test tests/e2e/regression/instructor-dashboard-error-states.spec.ts
```

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

## Error State Mapping

| Error Type | Trigger | UI State |
|------------|---------|----------|
| `auth` | 401/403 from API | "Authentication Required" |
| `backend` | 500 or null data | "Dashboard Unavailable" + Retry |
| `network` | fetch failure | "Connection Error" + Retry |
| `scope_empty` | No learners in sections | "No Learners Yet" |

## Preview Test Seeding

The `/api/auth/test-seed` endpoint ensures preview has:
- Instructor: `e2e-instructor@sql-adapt.test`
- Section: "E2E Test Section" with signup code
- Student: `e2e-student@sql-adapt.test` enrolled in section

This provides real scoped data for instructor dashboard testing.

## Related Issues

- Fixes silent failure when instructor dashboard API returns errors
- Makes auth/backend/network failures distinguishable by users
- Provides clear action paths (retry, login, enroll students)

## Status

| Component | Status |
|-----------|--------|
| Source code fix | ✅ Complete |
| Error state UI | ✅ Complete |
| Playwright tests | ✅ Complete |
| Build verification | ✅ Complete |
| Preview deployment | Pending |
| Live Playwright verification | Pending |
