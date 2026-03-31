# Beta Blocker Packet

**Version**: 1.0.0
**Status**: TEMPLATE — Fill only if a stage fails its gate
**Purpose**: Document the exact blocker, evidence, required fixes, and retry criteria before resuming the staged beta ramp

---

## Blocker Declaration

| Field | Value |
|-------|-------|
| **Stage Failed** | 1 / 2 / 3 |
| **Date/Time of Decision** | |
| **Decision Owner** | |
| **Blocker Packet ID** | BLOCKER-YYYYMMDD-### |

### One-Sentence Summary

> This stage is blocked because: ___________________

---

## Stop Condition Triggered

Select the exact stop condition(s) that caused the hold:

- [ ] P0 incident (data loss, security issue, total outage)
- [ ] Backend `/health` non-200 for > 5 minutes
- [ ] > 5% auth/session write 5xx errors
- [ ] > 20% hint request failure rate
- [ ] Active-run mismatch or corruption
- [ ] Supervisor red flag (describe below)
- [ ] Stage exit criteria not met (describe below)

**Details**:
___________________

---

## Evidence Summary

### Observation Evidence

| Metric | Observed Value | Target Value |
|--------|----------------|--------------|
| Students with Go/Caution verdict | ___ / ___ | |
| Critical issues | | 0 |
| High issues | | |
| Hint system failures | | < 20% |
| Save-to-notes failures | | |
| Refresh/resume failures | | |

**Link to observation forms**:

### Telemetry Evidence

**Audit command used**:
```bash
node scripts/audit-beta-telemetry.mjs --since <ISO> --stage <N>
```

**Audit artifact path**: `dist/beta/telemetry-audit/<filename>.json`

| Metric | Observed Value | Expected / Target |
|--------|----------------|-------------------|
| Unique active students | | |
| Hint requests | | |
| Error events | | |
| Answers after hint | | |

### Active-Run Verification

```bash
npm run corpus:verify-active-run -- --api-base-url https://adaptive-instructional-artifacts-ap.vercel.app
```

- [ ] Passed (0 mismatches)
- [ ] Failed (describe): ___________________

### Vercel / Backend Logs

- [ ] No significant error spikes
- [ ] Error spike observed (describe): ___________________

---

## Root Cause Analysis

**What happened?**
___________________

**Why did it happen?**
___________________

**Is the issue reproducible?**
- [ ] Yes — consistently reproducible
- [ ] Yes — intermittent
- [ ] No — single occurrence

**Reproduction steps (if known)**:
1. 
2. 
3. 

---

## Minimum Fixes Required

List the smallest set of fixes that must be completed before retrying the failed stage. Each fix should have a clear verification method.

| Fix ID | Description | Owner | Verification Method | Status |
|--------|-------------|-------|---------------------|--------|
| FIX-001 | | | | Open |
| FIX-002 | | | | Open |
| FIX-003 | | | | Open |

---

## Retry Criteria

Before retrying the failed stage, **all** of the following must be true:

- [ ] Every FIX item above is closed and verified
- [ ] The fix has been deployed to production (or is confirmed server-side only)
- [ ] A smoke test passes: login → practice → hint → answer
- [ ] Active-run verification passes
- [ ] Support owner approves the retry
- [ ] Supervisor is briefed on the fix and what to watch for

**Retry Stage**: _______________
**Planned Retry Date**: _______________

---

## Rollback Recommendation

Should we roll back to the previous stable commit (`fc143c6`) instead of fixing forward?

- [ ] **No rollback needed** — issue is localized and fixable forward
- [ ] **Rollback recommended** — issue is systemic, data-integrity related, or cannot be safely fixed in production
- [ ] **Rollback executed** — production has been reverted

**Rollback justification (if recommended)**:
___________________

---

## Communication Log

| Time | Stakeholder | Message / Decision |
|------|-------------|-------------------|
| | Support Owner | |
| | Technical Lead | |
| | Supervisor | |
| | Students / Instructor | |

---

## Related Documents

- [Beta 50-Student Operations Runbook](./beta-50-student-operations.md)
- [Beta Staged Audit Packet Template](./beta-staged-audit-packet-template.md)
- [Beta Live Findings Template](./beta-live-findings-template.md)
- [Beta Stage Observation Form](./beta-stage-observation-form.md)

---

*Template Version: 1.0.0*
*Last Updated: 2026-03-30*
