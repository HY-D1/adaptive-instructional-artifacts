# Staged Beta Audit Packet

**Version**: 1.0.0
**Status**: TEMPLATE — Fill after each live stage
**Purpose**: Central evidence record for the 5 → 15 → 40 supervised beta ramp

---

## Release Identification (Do Not Edit)

| Field | Value |
|-------|-------|
| **Git Commit** | `12a9c5faae4983c2c4d4cf753c1f59afb2a5e151` |
| **Branch** | `codex/beta-stabilization-preview-first` |
| **Release Tag** | `v1.1.0-beta-50` |
| **Active Corpus Run** | `run-1774671570-b1353117` |

## Production URLs (Do Not Edit)

| Service | URL |
|---------|-----|
| **Frontend** | https://adaptive-instructional-artifacts.vercel.app |
| **Backend** | https://adaptive-instructional-artifacts-ap.vercel.app |

---

## Stage 1 — 5 Students

### Entry Criteria (Check before stage)

- [ ] Production build passes (`npm run build`, `npm run server:build`)
- [ ] Active run verified: `npm run corpus:verify-active-run`
- [ ] Backend /health returns 200
- [ ] Supervisor and support owner assigned
- [ ] Observation forms printed/accessible
- [ ] Rollback runbook reviewed

### Session Details

| Field | Value |
|-------|-------|
| **Date** | YYYY-MM-DD |
| **Stage Window Start (UTC)** | YYYY-MM-DDTHH:MM:SSZ |
| **Stage Window End (UTC)** | YYYY-MM-DDTHH:MM:SSZ |
| **Location / Room** | |
| **Supervisor Name** | |
| **Support Owner Name** | |
| **Students Planned** | 5 |
| **Students Observed** | |
| **Session Duration** | ___ minutes |

### Evidence Packet Checklist

| Artifact | Path / Link |
|----------|-------------|
| Observation forms | |
| Telemetry audit JSON | |
| Active-run verification output | |
| Public load baseline JSON | |
| Hosted smoke Playwright result | |
| Research export | |
| Vercel error review / screenshot | |
| Supervisor debrief | |

### Observation Summary

| Metric | Count |
|--------|-------|
| Students with Go verdict | ___ / 5 |
| Students with Caution verdict | ___ / 5 |
| Students with No-Go verdict | ___ / 5 |
| Critical issues observed | |
| High issues observed | |
| Hint system failures | |
| Save-to-notes failures | |
| Refresh/resume failures | |

### Telemetry Summary

Run:
```bash
npm run audit:beta-telemetry -- --since <stage-start-iso> --until <stage-end-iso> --stage 1
```

| Metric | Value |
|--------|-------|
| Unique active students | |
| Hint requests (`hint_view`) | |
| Follow-up hints | |
| Textbook adds/updates | |
| Query executions | |
| Error events | |
| Answers after hint | |
| Telemetry audit artifact path | |

### Active-Run Verification

```bash
npm run corpus:verify-active-run -- --api-base-url https://adaptive-instructional-artifacts-ap.vercel.app
```

- [ ] Verification passed (0 mismatches)
- [ ] Verification failed — STOP

### Stage 1 Verdict

- [ ] **PASS**: All entry criteria met, no P0/P1 blockers, >= 4/5 Go or Caution
- [ ] **HOLD**: P1 issue or < 4/5 successful completions
- [ ] **ROLLBACK**: P0 incident or critical systemic failure

**Decision Owner**: _______________  **Date/Time**: _______________

**Next Step**:
- [ ] Proceed to Stage 2
- [ ] Fix issues and re-run Stage 1
- [ ] Rollback to `fc143c6`

---

## Stage 2 — 15 Students

### Entry Criteria (Check before stage)

- [ ] Stage 1 exit criteria met
- [ ] Stage 1 supervisor feedback documented
- [ ] Any P1 issues from Stage 1 resolved or mitigated
- [ ] Telemetry from Stage 1 reviewed

### Session Details

| Field | Value |
|-------|-------|
| **Date** | YYYY-MM-DD |
| **Stage Window Start (UTC)** | YYYY-MM-DDTHH:MM:SSZ |
| **Stage Window End (UTC)** | YYYY-MM-DDTHH:MM:SSZ |
| **Location / Room** | |
| **Supervisor Name** | |
| **Support Owner Name** | |
| **Students Planned** | 15 |
| **Students Observed** | |
| **Session Duration** | ___ minutes |

### Evidence Packet Checklist

| Artifact | Path / Link |
|----------|-------------|
| Observation forms | |
| Telemetry audit JSON | |
| Active-run verification output | |
| Public load baseline JSON | |
| Hosted smoke / auth smoke Playwright result | |
| Research export | |
| Vercel error review / screenshot | |
| Supervisor debrief | |

### Observation Summary

| Metric | Count |
|--------|-------|
| Students with Go verdict | ___ / 15 |
| Students with Caution verdict | ___ / 15 |
| Students with No-Go verdict | ___ / 15 |
| Critical issues observed | |
| High issues observed | |
| Hint system failures | |
| Save-to-notes failures | |
| Refresh/resume failures | |

### Telemetry Summary

Run:
```bash
npm run audit:beta-telemetry -- --since <stage-start-iso> --until <stage-end-iso> --stage 2
```

| Metric | Value |
|--------|-------|
| Unique active students | |
| Hint requests (`hint_view`) | |
| Follow-up hints | |
| Textbook adds/updates | |
| Query executions | |
| Error events | |
| Answers after hint | |
| Telemetry audit artifact path | |

### Active-Run Verification

- [ ] Verification passed (0 mismatches)
- [ ] Verification failed — STOP

### Stage 2 Verdict

- [ ] **PASS**: >= 13/15 successful, no new P0/P1, backend health stable
- [ ] **HOLD**: P1 issue or < 13/15 successful completions
- [ ] **ROLLBACK**: P0 incident or critical systemic failure

**Decision Owner**: _______________  **Date/Time**: _______________

**Next Step**:
- [ ] Proceed to Stage 3
- [ ] Fix issues and re-run Stage 2
- [ ] Rollback to `fc143c6`

---

## Stage 3 — 40 Students

### Entry Criteria (Check before stage)

- [ ] Stage 2 exit criteria met
- [ ] No unresolved P0/P1 issues
- [ ] Telemetry signals verified for Stages 1-2

### Session Details

| Field | Value |
|-------|-------|
| **Date** | YYYY-MM-DD |
| **Stage Window Start (UTC)** | YYYY-MM-DDTHH:MM:SSZ |
| **Stage Window End (UTC)** | YYYY-MM-DDTHH:MM:SSZ |
| **Location / Room** | |
| **Supervisor Name** | |
| **Support Owner Name** | |
| **Students Planned** | 40 |
| **Students Observed** | |
| **Session Duration** | ___ minutes |

### Evidence Packet Checklist

| Artifact | Path / Link |
|----------|-------------|
| Observation forms | |
| Telemetry audit JSON | |
| Active-run verification output | |
| Public load baseline JSON | |
| Hosted smoke / auth smoke Playwright result | |
| Research export | |
| Vercel error review / screenshot | |
| Supervisor debrief | |

### Observation Summary

| Metric | Count |
|--------|-------|
| Students with Go verdict | ___ / 40 |
| Students with Caution verdict | ___ / 40 |
| Students with No-Go verdict | ___ / 40 |
| Critical issues observed | |
| High issues observed | |
| Hint system failures | |
| Save-to-notes failures | |
| Refresh/resume failures | |

### Telemetry Summary

Run:
```bash
npm run audit:beta-telemetry -- --since <stage-start-iso> --until <stage-end-iso> --stage 3
```

| Metric | Value |
|--------|-------|
| Unique active students | |
| Hint requests (`hint_view`) | |
| Follow-up hints | |
| Textbook adds/updates | |
| Query executions | |
| Error events | |
| Answers after hint | |
| Telemetry audit artifact path | |

### Active-Run Verification

- [ ] Verification passed (0 mismatches)
- [ ] Verification failed — STOP

### Stage 3 Verdict

- [ ] **PASS**: >= 38/40 successful, stable backend, all telemetry OK
- [ ] **HOLD**: P1 issue or < 38/40 successful completions
- [ ] **ROLLBACK**: P0 incident or critical systemic failure

**Decision Owner**: _______________  **Date/Time**: _______________

---

## Final 40-Student Live-Test Verdict

Fill this section only after Stage 3 is complete and all evidence has been reviewed.

### Cumulative Evidence

| Stage | Students | Go | Caution | No-Go | Decision |
|-------|----------|----|---------|-------|----------|
| 1 | 5 | | | | |
| 2 | 15 | | | | |
| 3 | 40 | | | | |

### Critical Signal Verification

| Signal | Verified in Live Sessions | Evidence Location |
|--------|---------------------------|-------------------|
| Auth/login or resume | Yes / No / Partial | |
| Learning page open | Yes / No / Partial | |
| Learn / Examples / Common Mistakes readability | Yes / No / Partial | |
| Hint request / follow-up hint | Yes / No / Partial | |
| Answer-after-hint | Yes / No / Partial | |
| Save-to-notes | Yes / No / Partial | |
| Refresh/resume | Yes / No / Partial | |
| Active-run integrity | Yes / No / Partial | |
| Telemetry emission | Yes / No / Partial | |

### Top Issues from Live Findings Doc

Link: `./beta-live-findings-TODO.md`

| Issue ID | Severity | Status |
|----------|----------|--------|
| | | |

**Select exactly one:**

- [ ] **READY FOR CONTROLLED 40-STUDENT LIVE TEST**
  - All stages passed
  - No unresolved P0/P1 blockers
  - Real-session evidence supports the verdict

- [ ] **BLOCKED FOR 40-STUDENT LIVE TEST**
  - One or more stages failed
  - Unresolved P0/P1 blockers remain
  - See blocker packet: `./beta-blocker-packet-TODO.md`

**Final Approval Owner**: _______________  **Date/Time**: _______________

---

## Appendices

### A. How to Run Telemetry Audit

```bash
# Example: Stage 1 session started at 09:00 UTC and ended at 10:00 UTC on 2026-04-01
npm run audit:beta-telemetry -- \
  --since 2026-04-01T09:00:00Z \
  --until 2026-04-01T10:00:00Z \
  --stage 1
```

### B. Observation Form Naming Convention

Store completed forms in a shared location (e.g., `docs/runbooks/beta-observations/`):
- `stage-1-student-001.md`
- `stage-1-student-002.md`
- `stage-2-student-001.md`

### C. Related Documents

- [Beta 50-Student Operations Runbook](./beta-50-student-operations.md)
- [Beta Stage Observation Form](./beta-stage-observation-form.md)
- [Beta Live Findings Template](./beta-live-findings-template.md)
- [Beta Blocker Packet Template](./beta-blocker-packet-template.md)
- [Beta Telemetry Readiness](./beta-telemetry-readiness.md)

---

*Template Version: 1.0.0*
*Last Updated: 2026-04-05*
