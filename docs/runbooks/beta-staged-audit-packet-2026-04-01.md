# Staged Beta Audit Packet

**Version**: 1.0.0  
**Status**: IN PROGRESS — Stage 1 Pending  
**Purpose**: Central evidence record for the 5 → 15 → 50 supervised beta ramp  
**Created**: 2026-04-01  
**Phase**: Real 5→15→50 Student Beta Execution and Evidence Closure

---

## Release Identification

| Field | Value |
|-------|-------|
| **Git Commit** | `0d405bcdc45c101888f31f91570728ab1073b18e` |
| **Branch** | `weekly_features` |
| **Release Tag** | *To be assigned at production deployment* |
| **Active Corpus Run** | *To be verified at production deployment* |

## Production URLs (To be confirmed at deployment)

| Service | URL |
|---------|-----|
| **Frontend** | *TBD — configure before Stage 1* |
| **Backend** | *TBD — configure before Stage 1* |

---

## Pre-Stage Verification Checklist

### Build Verification

| Check | Command | Status | Evidence |
|-------|---------|--------|----------|
| Frontend build | `npm run build` | ✅ PASS | 2026-04-01 — built in 2.64s with expected warnings |
| Server build | `npm run server:build` | ✅ PASS | 2026-04-01 — TypeScript compilation successful |
| Integrity scan | `npm run integrity:scan` | ✅ PASS | No token corruption or auth import issues |

### Code State Verification

| Check | Status | Evidence |
|-------|--------|----------|
| P1 UX fixes merged | ✅ | RootLayout.tsx, routes.tsx, ui-state.ts |
| Reconciled audit complete | ✅ | docs/audits/reconciled-ux-audit-2026-04-01.md |
| Status.md verdict | ✅ READY | "READY FOR CONTROLLED 50-STUDENT BETA" |

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
| **Date** | *To be scheduled* |
| **Location / Room** | |
| **Supervisor Name** | |
| **Support Owner Name** | |
| **Students Planned** | 5 |
| **Students Observed** | |
| **Session Duration** | ___ minutes |

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

Run after Stage 1 completes:
```bash
node scripts/audit-beta-telemetry.mjs --since <stage-start-iso> --stage 1
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
npm run corpus:verify-active-run -- --api-base-url <production-backend-url>
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
- [ ] Rollback to stable commit

---

## Stage 2 — 15 Students

**Status**: BLOCKED — Complete Stage 1 first

### Entry Criteria (Check before stage)

- [ ] Stage 1 exit criteria met
- [ ] Stage 1 supervisor feedback documented
- [ ] Any P1 issues from Stage 1 resolved or mitigated
- [ ] Telemetry from Stage 1 reviewed

### Session Details

| Field | Value |
|-------|-------|
| **Date** | *To be scheduled after Stage 1* |
| **Location / Room** | |
| **Supervisor Name** | |
| **Support Owner Name** | |
| **Students Planned** | 15 |
| **Students Observed** | |
| **Session Duration** | ___ minutes |

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

### Stage 2 Verdict

- [ ] **PASS**: >= 13/15 successful, no new P0/P1, backend health stable
- [ ] **HOLD**: P1 issue or < 13/15 successful completions
- [ ] **ROLLBACK**: P0 incident or critical systemic failure

**Decision Owner**: _______________  **Date/Time**: _______________

---

## Stage 3 — 50 Students

**Status**: BLOCKED — Complete Stage 2 first

### Entry Criteria (Check before stage)

- [ ] Stage 2 exit criteria met
- [ ] No unresolved P0/P1 issues
- [ ] Telemetry signals verified for Stages 1-2

### Session Details

| Field | Value |
|-------|-------|
| **Date** | *To be scheduled after Stage 2* |
| **Location / Room** | |
| **Supervisor Name** | |
| **Support Owner Name** | |
| **Students Planned** | 50 |
| **Students Observed** | |
| **Session Duration** | ___ minutes |

### Observation Summary

| Metric | Count |
|--------|-------|
| Students with Go verdict | ___ / 50 |
| Students with Caution verdict | ___ / 50 |
| Students with No-Go verdict | ___ / 50 |
| Critical issues observed | |
| High issues observed | |
| Hint system failures | |
| Save-to-notes failures | |
| Refresh/resume failures | |

### Stage 3 Verdict

- [ ] **PASS**: >= 47/50 successful, stable backend, all telemetry OK
- [ ] **HOLD**: P1 issue or < 47/50 successful completions
- [ ] **ROLLBACK**: P0 incident or critical systemic failure

**Decision Owner**: _______________  **Date/Time**: _______________

---

## Final 50-Student Beta Readiness Verdict

**Status**: PENDING — Complete all stages first

### Cumulative Evidence

| Stage | Students | Go | Caution | No-Go | Decision |
|-------|----------|----|---------|-------|----------|
| 1 | 5 | | | | |
| 2 | 15 | | | | |
| 3 | 50 | | | | |

### Critical Signal Verification

| Signal | Verified in Live Sessions | Evidence Location |
|--------|---------------------------|-------------------|
| Auth/login or resume | Pending | |
| Learning page open | Pending | |
| Learn / Examples / Common Mistakes readability | Pending | |
| Hint request / follow-up hint | Pending | |
| Answer-after-hint | Pending | |
| Save-to-notes | Pending | |
| Refresh/resume | Pending | |
| Active-run integrity | Pending | |
| Telemetry emission | Pending | |

### Top Issues from Live Findings Doc

Link: *To be created after Stage 1*

| Issue ID | Severity | Status |
|----------|----------|--------|
| | | |

### Verdict

**Select exactly one:**

- [ ] **READY FOR CONTROLLED 50-STUDENT BETA**
  - All stages passed
  - No unresolved P0/P1 blockers
  - Real-session evidence supports the verdict

- [ ] **BLOCKED FOR 50-STUDENT BETA**
  - One or more stages failed
  - Unresolved P0/P1 blockers remain
  - See blocker packet

**Final Approval Owner**: _______________  **Date/Time**: _______________

---

## Appendices

### A. Production Deployment Checklist

Before Stage 1 can begin, the following must be configured:

1. [ ] Deploy frontend to production Vercel project
2. [ ] Deploy backend to production Vercel project
3. [ ] Configure production database (Neon)
4. [ ] Set active corpus run: `npm run corpus:set-winner-run`
5. [ ] Verify `/health` endpoint returns 200
6. [ ] Verify `/api/corpus/manifest` returns correct active run
7. [ ] Run `npm run corpus:verify-active-run` against production
8. [ ] Update this document with actual production URLs

### B. Required Environment Variables

| Variable | Purpose | Status |
|----------|---------|--------|
| `DATABASE_URL` | Neon database connection | *Required for telemetry audit* |
| `VITE_API_BASE_URL` | Frontend API base URL | *Required for production build* |

### C. How to Run Telemetry Audit

```bash
# Example: Stage 1 session started at 09:00 UTC on 2026-04-01
node scripts/audit-beta-telemetry.mjs \
  --since 2026-04-01T09:00:00Z \
  --stage 1
```

### D. Observation Form Naming Convention

Store completed forms in `docs/runbooks/beta-observations/`:
- `stage-1-student-001.md`
- `stage-1-student-002.md`
- `stage-2-student-001.md`

### E. Related Documents

- [Beta 50-Student Operations Runbook](./beta-50-student-operations.md)
- [Beta Stage Observation Form](./beta-stage-observation-form.md)
- [Beta Live Findings Template](./beta-live-findings-template.md)
- [Beta Blocker Packet Template](./beta-blocker-packet-template.md)
- [Beta Telemetry Readiness](./beta-telemetry-readiness.md)
- [Reconciled UX Audit Report](../audits/reconciled-ux-audit-2026-04-01.md)

---

*Packet Created: 2026-04-01*  
*Last Updated: 2026-04-01*  
*Phase: Real 5→15→50 Student Beta Execution and Evidence Closure*
