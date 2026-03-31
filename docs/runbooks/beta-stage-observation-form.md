# Beta Stage Observation Form

**Version**: 1.0.0
**Audience**: Supervisors observing staged beta sessions
**Purpose**: Per-student checkpoint form for live Stage 1/2/3 sessions
**Instructions**: Print or open one copy per student. Record timing and status in real time.

---

## Session Metadata

| Field | Record |
|-------|--------|
| **Stage** | 1 / 2 / 3 |
| **Date** | YYYY-MM-DD |
| **Observer Name** | |
| **Student ID / Pseudonym** | |
| **Class Code Used** | |
| **Session Start Time** | ___:___ |
| **Browser / Device** | |

---

## Part A: Core Flow Checkpoints

For each checkpoint, record the time (or `N/A`) and mark Pass / Fail / Partial. Add notes for anything unusual.

### A1. Onboarding & Auth

| Checkpoint | Time | Status | Notes |
|------------|------|--------|-------|
| Student opens frontend URL | | P / F / Partial | |
| Login or resume succeeds (no white screen) | | P / F / Partial | |
| Student reaches practice page | | P / F / Partial | |

### A2. Learning Page Usability

| Checkpoint | Time | Status | Notes |
|------------|------|--------|-------|
| Problem description readable | | P / F / Partial | |
| "Learn" tab content clear | | P / F / Partial | |
| "Examples" tab readable | | P / F / Partial | |
| "Common Mistakes" readable | | P / F / Partial | |
| SQL editor loads and is usable | | P / F / Partial | |

### A3. Hint System

| Checkpoint | Time | Status | Notes |
|------------|------|--------|-------|
| Student requests first hint | | P / F / Partial | |
| First hint loads within 3 seconds | | P / F / Partial | |
| First hint is relevant / not broken | | P / F / Partial | |
| Student requests follow-up hint | | P / F / Partial | |
| Follow-up hint loads and makes sense | | P / F / Partial | |

### A4. Answer After Hint

| Checkpoint | Time | Status | Notes |
|------------|------|--------|-------|
| Student attempts an answer after hint | | P / F / Partial | |
| Query runs (execution or error event visible) | | P / F / Partial | |
| Outcome feedback is clear | | P / F / Partial | |

### A5. Save-to-Notes

| Checkpoint | Time | Status | Notes |
|------------|------|--------|-------|
| "Save to Notes" button visible | | P / F / Partial | |
| Student clicks and gets success feedback | | P / F / Partial | |
| Saved note appears in My Textbook | | P / F / Partial | |

### A6. Refresh / Resume

| Checkpoint | Time | Status | Notes |
|------------|------|--------|-------|
| Student refreshes browser on practice page | | P / F / Partial | |
| Page reloads without errors | | P / F / Partial | |
| Prior code / state preserved | | P / F / Partial | |
| No data loss observed | | P / F / Partial | |

---

## Part B: Red Flags (Immediate Supervisor Alert)

Check any observed. If Critical or High is checked, notify support owner immediately.

- [ ] **Critical**: Unable to log in or resume
- [ ] **Critical**: White screen / page crash
- [ ] **Critical**: Data loss on refresh
- [ ] **High**: Hint system fails to load (> 20% of attempts in session)
- [ ] **High**: Save-to-notes completely broken for this student
- [ ] **High**: Query execution fails for all attempts
- [ ] **Medium**: Hint content irrelevant or misleading
- [ ] **Medium": Error messages confusing or missing
- [ ] **Medium**: Navigation / tabs confusing
- [ ] **Low**: Layout glitches or minor visual issues

---

## Part C: Qualitative Notes

### Student Confusion Points
- What was unclear? ___________________
- Where did they get stuck? ___________________

### Hint Quality Observations
- Were hints helpful? ___________________
- Any content errors? ___________________

### Content Clarity (Learn / Examples / Common Mistakes)
- What was hard to read? ___________________

### Other Issues
- ___________________

---

## Part D: Overall Assessment

| Metric | Score (1-5) | Notes |
|--------|-------------|-------|
| Onboarding smoothness | | |
| Hint system effectiveness | | |
| Learning page clarity | | |
| Save-to-notes reliability | | |
| Refresh/resume reliability | | |

### Student-Level Verdict
- [ ] **Go**: All critical checkpoints passed
- [ ] **Caution**: One or more partials / minor issues
- [ ] **No-Go**: Critical or high issue observed

### Supervisor Signature / Initials
___________________

---

## Cohort Aggregation Instructions

After the stage is complete, transfer the following counts to the **Staged Beta Audit Packet**:

- Total students observed: ___
- Students with Go verdict: ___
- Students with Caution verdict: ___
- Students with No-Go verdict: ___
- Critical issues observed: ___
- High issues observed: ___
- Hint system failures: ___
- Save-to-notes failures: ___
- Refresh/resume failures: ___

*Last Updated: 2026-03-30*
