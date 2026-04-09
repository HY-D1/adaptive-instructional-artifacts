# SQL-Adapt Progress Model

> **Version:** 1.0  
> **Last Updated:** 2026-04-08  
> **Status:** Authoritative - all UI must conform

---

## Core Principle

**Every progress display must use unambiguous terminology.**  
The word "progress" alone is banned from user-facing labels.

---

## Canonical Progress Metrics

| Metric | Definition | User-Facing Label | Data Source |
|--------|------------|-------------------|-------------|
| `currentProblemNumber` | 1-based position in problem list | **"Problem N of M"** | Derived from `currentProblemId` + `sqlProblems` array |
| `totalProblems` | Total count of available problems | (used as denominator) | `sqlProblems.length` |
| `solvedCount` | Unique problems solved (all time) | **"N solved"** or **"N of M solved"** | `profile.solvedProblemIds.size` |
| `solvedPercent` | Percentage of problems solved | **"N%"** (with progress bar) | `(solvedCount / totalProblems) × 100` |
| `attemptsThisSession` | Query executions this session | **"N attempts this session"** | Session-scoped interaction count |
| `correctExecutions` | Successful query runs (all time) | **"N correct runs"** | Cross-session successful interactions |
| `conceptCoverage` | Concepts with evidence / 6 total | **"N of 6 concepts"** | `profile.conceptsCovered.size` |
| `conceptMastery` | Concepts mastered (score ≥75) | **"N mastered"** | Derived from concept evidence |

---

## Prohibited Patterns

| ❌ Banned | ✅ Required |
|-----------|-------------|
| "Progress" (alone) | "Problems solved", "Concept coverage", or specific metric |
| "Current: N / M" | "Problem N of M" |
| "successful runs" | "correct executions" or "correct runs" |
| "solved" (lowercase in badges) | "Solved" (title case for status) |
| "attempts" (without scope) | "attempts this session" |
| "Avg Progress" (instructor) | "Avg Concept Coverage" |

---

## Source of Truth Hierarchy

```
┌─────────────────────────────────────────────────────────────────┐
│                    SOURCE OF TRUTH                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ULTIMATE SOURCE (Database)                                     │
│  ├── problem_progress.solved → solvedCount                      │
│  ├── learner_sessions.current_problem_id → current position     │
│  └── learner_profiles.conceptsCovered → concept coverage        │
│                           │                                     │
│                           ▼                                     │
│  API LAYER                                                      │
│  ├── GET /learners/:id/profile → solvedProblemIds[]             │
│  ├── GET /sessions/:id/active → currentProblemId                │
│  └── POST /interactions → triggers progress updates             │
│                           │                                     │
│                           ▼                                     │
│  FRONTEND CACHE                                                 │
│  ├── localStorage: sql-learning-profiles                        │
│  └── useLearnerProgress hook (reads cache)                      │
│                           │                                     │
│                           ▼                                     │
│  UI RENDERING                                                   │
│  └── Clear, unambiguous labels per this glossary                │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Cross-Cutting Concerns

### Scope Distinction

| Scope | Meaning | Example |
|-------|---------|---------|
| **Cross-session** | All-time / persistent | Solved problems, concept coverage |
| **Session-only** | This study session | Attempts, time spent, hint views |

**Rule:** Session-scoped metrics must explicitly say "this session" in their label.

### Learner vs Instructor Views

| Metric | Learner Sees | Instructor Sees |
|--------|--------------|-----------------|
| Problems | "N of M solved" | Student table: "Problems" column with "N/M" |
| Concepts | Detailed breakdown | "N of 6 concepts" aggregate |
| Progress | Problem completion % | Concept coverage % (labeled as such) |

---

## Implementation Notes

### `useLearnerProgress` Hook

This hook is the **canonical frontend source** for progress data:

```typescript
const progress = useLearnerProgress({
  learnerId,
  currentProblemId,
  refreshKey
});

// Returns:
// - totalProblems
// - currentProblemNumber (1-based)
// - solvedCount
// - solvedPercent
// - solvedProblemIds (Set)
// - isCurrentProblemSolved
// - isProblemSolved(problemId)
// - getSolvedCountForDifficulty(difficulty)
```

### Storage Layer

- **Primary:** Neon PostgreSQL (`problem_progress` table)
- **Cache:** localStorage (`sql-learning-profiles`)
- **Sync:** `DualStorage` merges on hydration; backend wins on conflict

### Update Flow

1. Learner executes query → `saveInteraction()` called
2. If successful → `updateProblemProgress({ solved: true })` 
3. Backend UPSERTs `problem_progress` table
4. Profile refresh pulls fresh `solvedProblemIds`
5. UI updates via `refreshKey` increment

---

## Changelog

| Date | Change | Files |
|------|--------|-------|
| 2026-04-08 | Initial model | Created PROGRESS_MODEL.md |
| 2026-04-08 | Clarified "Current" → "Problem N of M" | LearningInterface.tsx |
| 2026-04-08 | Clarified "successful runs" → "correct runs" | LearningInterface.tsx |
| 2026-04-08 | Clarified "Avg Progress" → "Avg Concept Coverage" | InstructorDashboard.tsx |
