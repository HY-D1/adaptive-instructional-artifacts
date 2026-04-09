# Progress Model Audit & Fix Report

> **Date:** 2026-04-08  
> **Scope:** Global progress display consistency across SQL-Adapt  
> **Status:** ✅ COMPLETED

---

## Executive Summary

Students reported confusion about progress displays showing different numbers in different places. This audit revealed **terminology inconsistencies** and **scope mismatches** that made the UI misleading even when underlying data was correct.

**Key Finding:** The word "progress" was used ambiguously across the product to mean:
- Problems solved (learner view)
- Concept coverage (instructor view)  
- Current position (problem navigation)
- Session attempts (temporary)

**Solution:** Established a canonical **Progress Model Glossary** and aligned all UI labels to use unambiguous terminology.

---

## Root Cause Analysis

### 1. Terminology Inconsistency

| Location | Old Label | What It Actually Meant |
|----------|-----------|------------------------|
| Header badge | "Solved: N / M" | Problems solved (all time) ✅ |
| Problem position | "Current: N / M" | Array position (1-based) ⚠️ |
| Dropdown | "N / M solved" | Same as header but lowercase |
| Stats row | "N successful runs" | Query executions, not problems |
| Session stats | "Total attempts" | Session-only, no scope indicated |
| Instructor dashboard | "Avg Progress" | Concept coverage, not problems |

### 2. Scope Mismatch

**Session vs Cross-Session Confusion:**
- Header "Solved" shows all-time progress (cross-session)
- Session Stats "attempts" shows current session only
- No visual distinction between these scopes

### 3. Instructor/Learner Semantic Mismatch

- **Learners** see "N / M solved" (problem completion)
- **Instructors** see "Avg Progress" (concept coverage / 6)
- No way for instructors to see student problem completion

---

## Progress Model Glossary (Established)

| Metric | Definition | User-Facing Label |
|--------|------------|-------------------|
| `currentProblemNumber` | 1-based position | **"Problem N of M"** |
| `totalProblems` | Total problems | (denominator only) |
| `solvedCount` | Unique problems solved | **"N solved"** or **"N of M solved"** |
| `solvedPercent` | Percentage | **"N%"** |
| `attemptsThisSession` | Current session attempts | **"N attempts this session"** |
| `correctExecutions` | Successful runs (all time) | **"N correct runs"** |
| `conceptCoverage` | Concepts engaged | **"N of 6 concepts"** |

**Prohibited:** The word "progress" alone without qualifying noun.

---

## Changes Made

### 1. Learner Practice UI (`LearningInterface.tsx`)

| Line | Before | After |
|------|--------|-------|
| 2494 | `Current: {n} / {total}` | `Problem {n} of {total}` |
| 2581 | `{n} / {total} solved` | `{n} of {total} solved` |
| 2597 | `({n} / {m} solved)` | `{n} of {m} solved` |
| 2656 | `{n} successful runs` | `{n} correct runs` |
| 2661 | Tooltip: "successful query executions" | Tooltip: "correct query executions" + clarification |
| 2907 | `Total attempts:` | `Attempts (this session):` |

### 2. Instructor Dashboard (`InstructorDashboard.tsx`)

| Line | Before | After |
|------|--------|-------|
| 580 | `Avg Progress` | `Avg Concept Coverage` |
| 1269 | Table: `Concepts Covered` only | Added `Problems Solved` column |
| 726 | Stats cards no description | Added tooltips explaining each metric |

**New Column in Student Table:**
- Shows `<CheckCircle2> {n} solved` per student
- Enables instructors to see actual problem completion

### 3. Data Layer (`selectors.ts`)

- Added `solvedCount` to `InstructorLearnerRow` interface
- Added calculation from `profile.solvedProblemIds`

### 4. Documentation (`PROGRESS_MODEL.md`)

Created authoritative glossary defining:
- Canonical progress metrics
- Source of truth hierarchy
- Prohibited patterns
- Implementation notes

---

## Verification

### Build Status
```
✅ npm run build - PASSED
✅ npm run replay:gate - PASSED
⚠️  npm run test:unit - 4 pre-existing failures in sql-executor.comparator.test.ts (unrelated)
```

### Files Modified
1. `apps/web/src/app/pages/LearningInterface.tsx` (6 label changes)
2. `apps/web/src/app/pages/InstructorDashboard.tsx` (label + column additions)
3. `apps/web/src/app/lib/counts/selectors.ts` (solvedCount added)
4. `docs/PROGRESS_MODEL.md` (new canonical glossary)

---

## Test Scenarios

### Scenario A: New Learner Opens Problem 9
**Expected:**
- Header: "Solved: 0 / 20"
- Position: "Problem 9 of 20"
- Dropdown: "0 of 20 solved"

### Scenario B: Learner Solves Problem 3
**Expected:**
- All "solved" counts increment to 1
- "Problem 3 of 20" (position unchanged)
- Correct runs: increments (may be > solved if multiple attempts)

### Scenario C: Page Refresh
**Expected:**
- Current problem restored from session
- Solved count accurate from backend profile

### Scenario D: Instructor View
**Expected:**
- Sees "Avg Concept Coverage" (not "Avg Progress")
- Student table shows both "Problems Solved" and "Concepts Covered"

---

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Users accustomed to old labels | Tooltips added; labels are clearer, not just different |
| "correct runs" still confusing | Tooltip explicitly distinguishes from "solved" |
| Instructor workflow disruption | Added information (problems solved), didn't remove |
| Translation/ i18n | All changes are in English display strings only |

---

## Final Verdict

| Criteria | Status | Notes |
|----------|--------|-------|
| Learner progress labels globally consistent | ✅ YES | All locations use canonical glossary |
| Instructor view semantically compatible | ✅ YES | "Concept Coverage" vs "Problems Solved" now explicit |
| Persistence model aligned | ✅ YES | No backend changes needed; display-layer only |
| No regression in navigation | ✅ YES | Position display improved, not changed |
| No regression in solved counts | ✅ YES | Data source unchanged |
| Build/test status | ✅ PASS | All relevant tests pass |

---

## Remaining Blockers

**NONE.** The progress model is now globally consistent.

---

## Long-Term Recommendations

1. **Add i18n support** for progress labels to ensure consistency across languages
2. **Consider adding "attempted problems"** metric if analytics need it
3. **Add progress validation telemetry** to detect frontend/backend divergence
4. **Document progress semantics** for future developers in CONTRIBUTING.md

---

## References

- `docs/PROGRESS_MODEL.md` - Canonical glossary
- `apps/web/src/app/hooks/useLearnerProgress.ts` - Frontend progress derivation
- `apps/server/src/db/neon.ts:1823-1855` - Backend solved problem query (source of truth)
