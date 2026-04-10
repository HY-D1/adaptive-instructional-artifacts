# Instructor Dashboard Profile Gap Fix

**Date**: 2026-04-10  
**Severity**: P0  
**Status**: Code fixed, preview Neon backfill executed, production verification pending

## Summary

Instructor dashboards were undercounting students because visibility depended on `learner_profiles`, but some enrolled students only had browser-local profiles and never received a durable Neon row.

## Verified Root Cause

1. Student signup created a `users` row and section enrollment, but not a `learner_profiles` row.
2. First-time Practice initialization created a default profile through `storage.createDefaultProfile(...)`.
3. In dual-storage mode, `createDefaultProfile` previously wrote only to localStorage.
4. Instructor-scoped profile queries read from Neon and therefore excluded those learners.

## Files Changed

- `apps/web/src/app/lib/storage/dual-storage.ts`
- `apps/web/src/app/lib/storage/dual-storage.test.ts`
- `apps/server/src/routes/auth.ts`
- `tests/unit/server/auth-login-telemetry.contract.test.ts`
- `tests/e2e/regression/instructor-dashboard-profiles.spec.ts`

## Code Fixes Applied

### 1. DualStorage now syncs default profiles

`apps/web/src/app/lib/storage/dual-storage.ts`

- Replaced the `createDefaultProfile` localStorage pass-through with a real adapter.
- Local creation stays synchronous.
- Backend mode now mirrors the new profile to Neon.
- Failed backend writes are queued for offline retry.

### 2. Student signup now seeds learner_profiles

`apps/server/src/routes/auth.ts`

- After account creation, student signup now calls `saveLearnerProfile(...)`.
- The seeded profile uses the same practical defaults as the web app:
  - `currentStrategy: 'adaptive-medium'`
  - `interactionCount: 0`
  - `preferences.escalationThreshold: 3`
  - `preferences.aggregationDelay: 300000`

## Verification Run

### Targeted tests

```bash
npx vitest run apps/web/src/app/lib/storage/dual-storage.test.ts tests/unit/server/auth-login-telemetry.contract.test.ts
```

Result:
- PASS, 34 tests passed

### Regression gates

```bash
npm run integrity:scan
npm run server:build
npm run build
npm run test:unit
npm run replay:gate
```

Result:
- `integrity:scan` PASS
- `server:build` PASS
- `build` PASS
- `test:unit` PASS, 1790 passed / 2 skipped
- `replay:gate` PASS, checksum update intentionally skipped

## Neon Backfill

Preview Neon backfill was executed from this session using the Vercel-linked preview `DATABASE_URL`.

### Preview counts before backfill

- `learner_profiles`: `103`
- `users WHERE role = 'student'`: `258`
- Distinct enrolled students missing profiles: `156`
- Largest affected section: `Fresh E2E Instructor's Section` at `123 enrolled / 53 with_profiles`

### Count missing profiles

```sql
SELECT COUNT(DISTINCT u.id) AS students_missing_profiles
FROM users u
INNER JOIN section_enrollments se ON u.id = se.student_user_id
LEFT JOIN learner_profiles lp ON u.id = lp.learner_id
WHERE u.role = 'student'
  AND lp.learner_id IS NULL;
```

### Backfill missing learner_profiles

```sql
INSERT INTO learner_profiles (
  learner_id,
  name,
  concept_coverage,
  concept_evidence,
  error_history,
  interaction_count,
  strategy,
  preferences,
  last_activity_at,
  profile_data,
  version,
  created_at,
  updated_at
)
SELECT
  u.id,
  u.name,
  '[]'::text,
  '{}'::text,
  '{}'::text,
  0,
  'adaptive-medium',
  '{"escalationThreshold":3,"aggregationDelay":300000,"autoTextbookEnabled":true,"notificationsEnabled":true,"theme":"system"}'::text,
  NOW(),
  '{}'::text,
  1,
  u.created_at,
  NOW()
FROM users u
INNER JOIN section_enrollments se ON u.id = se.student_user_id
LEFT JOIN learner_profiles lp ON u.id = lp.learner_id
WHERE u.role = 'student'
  AND lp.learner_id IS NULL;
```

### Duplicate-enrollment nuance

The first raw insert attempt failed on `learner_profiles_pkey` because some students had duplicate `section_enrollments` rows. The executed repair therefore used `SELECT DISTINCT u.id, ...` in the insert source.

### Preview counts after backfill

- `learner_profiles`: `253`
- Distinct enrolled students missing profiles: `0`
- `Fresh E2E Instructor's Section`: `123 enrolled / 123 with_profiles`
- `H's Section`: `50 enrolled / 50 with_profiles`

### Production note

This session repaired the **preview** Neon target only. Production still needs separate verification/backfill if it uses a different database.

### Verify section visibility

```sql
SELECT
  cs.name AS section_name,
  COUNT(DISTINCT se.student_user_id) AS enrolled,
  COUNT(DISTINCT lp.learner_id) AS with_profiles
FROM course_sections cs
LEFT JOIN section_enrollments se ON cs.id = se.section_id
LEFT JOIN learner_profiles lp ON se.student_user_id = lp.learner_id
GROUP BY cs.id, cs.name
ORDER BY enrolled DESC;
```

## Residual Risks

- Production may still be missing `learner_profiles` rows if it does not share the preview Neon target.
- `tests/e2e/setup/auth.setup.ts` still has a separate preview auth-setup bug: its student fallback assumes instructor signup returns `ownedSections[0].studentSignupCode`.
- Local browser verification from this session was not Neon-faithful because the local backend booted in SQLite fallback mode.
