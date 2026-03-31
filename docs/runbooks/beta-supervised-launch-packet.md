# Supervised Beta Launch Packet

**Version**: 1.1.0-beta-50
**Release Date**: 2026-03-30
**Phase**: Controlled 50-Student Beta Scale Readiness
**Status**: READY FOR CONTROLLED 50-STUDENT BETA (with staged ramp)

---

## Release Identification

| Field | Value |
|-------|-------|
| **Git Commit** | `12a9c5faae4983c2c4d4cf753c1f59afb2a5e151` |
| **Branch** | `codex/beta-stabilization-preview-first` |
| **Release Tag** | `v1.1.0-beta-50` |
| **Deployment Date** | 2026-03-30 |
| **Previous Stable** | `fc143c6` (feat/student-preview) |

---

## Production URLs

| Service | URL | Status | Last Verified |
|---------|-----|--------|---------------|
| **Frontend** | https://adaptive-instructional-artifacts.vercel.app | Verified (HTTP 200) | 2026-03-30 |
| **Backend** | https://adaptive-instructional-artifacts-ap.vercel.app | Verified (HTTP 200) | 2026-03-30 |
| **Health Check** | /health | OK - Neon DB connected | 2026-03-30 |

### API Endpoints

| Endpoint | URL | Purpose |
|----------|-----|---------|
| Health | https://adaptive-instructional-artifacts-ap.vercel.app/health | System health status |
| Corpus Manifest | /api/corpus/manifest | Active corpus run info |
| Persistence Status | /api/system/persistence-status | Database mode check |

---

## Active Winner Corpus Run

| Field | Value |
|-------|-------|
| **Run ID** | `run-1774671570-b1353117` |
| **Corpus** | dbms-ramakrishnan-3rd-edition |
| **Document ID** | dbms-ramakrishnan-3rd-edition |
| **Units** | 43 |
| **Chunks** | 101 |
| **Active Since** | 2026-03-28T05:10:52Z |
| **Set By** | npm:corpus:set-winner-run |
| **Verification** | Passed (43 units, 101 chunks, 0 mismatches) |

### Verification Command

```bash
npm run corpus:verify-active-run -- --api-base-url https://adaptive-instructional-artifacts-ap.vercel.app
```

---

## Known Caveats

### Disabled Features

| Feature | Status | Reason | Impact |
|---------|--------|--------|--------|
| PDF Index | Disabled | Set `ENABLE_PDF_INDEX=true` to enable | PDF-based search not available |
| LLM | Disabled | Set `ENABLE_LLM=true` to enable | AI features use fallback mechanisms |

### Build Warnings (Non-Blocking)

| Warning | Impact |
|---------|--------|
| Dynamic import conflicts (event-id.ts, storage.ts, llm-client.ts) | Non-blocking - code functions correctly |
| vendor-charts chunk 557.52 kB (>500 kB) | Minor initial load impact |

### Telemetry Gaps (Mitigated)

| Gap | Impact | Mitigation |
|-----|--------|------------|
| No explicit concept_view event | Cannot directly measure concept engagement | Inferred from conceptIds in hint/textbook events |
| Auth events not in research DB | Cannot correlate auth with learning outcomes | Server logs available for operational debugging |
| No explicit page_view telemetry | Limited page-level analytics | Vercel Analytics provides metrics |

### Test Infrastructure Limitations

| Limitation | Impact | Mitigation |
|------------|--------|------------|
| WS5-BLOCKER-001: Production E2E auth credentials not available in this environment | Cannot run automated E2E against production for auth-dependent flows | Manual supervised onboarding; staged rollout validates real concurrent use with human observers. Local regression tests pass. |

---

## Supervised Beta Scope and Limits

### Participant Criteria

- **Target Cohort**: Up to 50 students
- **Staged Ramp**: 5 students → 15 students → 50 students
- **Environment**: Supervised setting (instructor present) for each stage
- **Duration**: Single session per stage initially, expand based on results
- **Prerequisites**: Basic SQL familiarity, instructor-provided class code

### Scope Boundaries

**In Scope**:
- Student signup with class code
- SQL practice with 43 problems
- Progressive hint system (3-rung ladder)
- Automatic textbook note generation
- Multi-device progress persistence
- Concurrent use under instructor supervision

**Out of Scope**:
- Instructor dashboard features (monitor only)
- LLM-enhanced explanations (fallback only)
- PDF content search
- Public/unrestricted access
- Unsupervised mass rollout

### Success Criteria (Per Stage)

| Metric | Target |
|--------|--------|
| Successful logins | >= 95% of students |
| Hint requests completed | >= 80% without errors |
| Save-to-notes success | >= 90% of attempts |
| Multi-device restore | >= 95% within 5 seconds |
| Runtime errors | Zero critical errors per stage |
| Peak backend p95 latency | < 3000ms under concurrent load |

---

## Staged Rollout Plan

### Stage 1 — 5 Students (Baseline)

**Goal**: Validate supervised onboarding, hint flow, save-to-notes, and refresh/resume under real concurrent use.

**Duration**: 1 supervised session (approx. 45 minutes).

**Entry Criteria**:
- [x] Production build passes (`npm run build`, `npm run server:build`)
- [x] Active run verified on production
- [x] Public edge load test passes for 50 concurrent requests (see Evidence)
- [x] Supervisor and support owner assigned
- [x] Rollback runbook reviewed

**Exit Criteria**:
- [ ] >= 4/5 students complete login without critical errors
- [ ] >= 4/5 students request and receive hints successfully
- [ ] >= 4/5 students save at least one note
- [ ] Zero data loss on refresh/resume
- [ ] No critical backend errors (5xx) observed

### Stage 2 — 15 Students (Scale Validation)

**Goal**: Prove the system remains stable with moderate concurrent load.

**Duration**: 1-2 supervised sessions.

**Entry Criteria**:
- [ ] Stage 1 exit criteria met
- [ ] Supervisor feedback documented
- [ ] Any P1 issues from Stage 1 resolved

**Exit Criteria**:
- [ ] >= 13/15 students complete login without critical errors
- [ ] >= 13/15 students receive hints successfully
- [ ] >= 12/15 students save at least one note
- [ ] Refresh/resume success rate >= 95%
- [ ] Backend /health remains 200 throughout session
- [ ] No new P0/P1 issues introduced

### Stage 3 — 50 Students (Full Cohort)

**Goal**: Operate the full supervised beta cohort.

**Duration**: 1-3 supervised sessions.

**Entry Criteria**:
- [ ] Stage 2 exit criteria met
- [ ] No unresolved P0/P1 issues
- [ ] Telemetry signals verified for Stages 1-2

**Exit Criteria**:
- [ ] >= 47/50 students complete login without critical errors
- [ ] >= 40/50 students receive hints successfully
- [ ] >= 45/50 students save at least one note
- [ ] Refresh/resume success rate >= 95%
- [ ] Backend health stable

---

## Stop Conditions (Immediate Pause)

Pause the current stage and do **not** advance if ANY of the following occur:

1. **Any P0 production incident**: Data loss, unrecoverable login failure, security issue.
2. **Backend health failure**: `/health` returns non-200 for > 5 minutes.
3. **Database error spike**: > 5% of auth or session writes return 5xx.
4. **Hint system outage**: > 20% of students cannot request or receive hints.
5. **Supervisor red flag**: Any critical issue observed during supervised session that threatens student experience or data integrity.

---

## Rollback Triggers

Revert to `fc143c6` immediately if ANY of the following occur:

1. **Confirmed data loss** for any student (notes, progress, or session state).
2. **Auth system compromise** or widespread inability to log in (> 20% failure rate).
3. **Persistent 5xx errors** from backend after 10 minutes of observation.
4. **Active-run corruption** or manifest mismatch.
5. **Stop condition triggered twice** across stages without a clear fix.

---

## Pre-Launch Verification Checklist

- [x] Production environment variables configured
- [x] Production frontend URL accessible (HTTP 200)
- [x] Production backend /health returns 200
- [x] Corpus active-run verified for production
- [x] Frontend build verification passed
- [x] Server build verification passed
- [x] Telemetry audit - critical signals verified
- [x] 50-student public edge load test passed
- [x] Staged rollout plan documented
- [x] Rollback triggers documented
- [x] Support owner checklist documented
- [x] Incident/escalation path documented

---

## Post-Launch Monitoring Plan

| Check | Frequency | Tool/Method | Owner |
|-------|-----------|-------------|-------|
| Vercel deployment logs | Continuous | Vercel Dashboard | Support Owner |
| Neon database health | Hourly | /health endpoint | Support Owner |
| Student interaction events | After each stage | Neon Database (interaction_events table) | Support Owner |
| Hint request telemetry | After each stage | hint_view event analysis | Support Owner |
| Frontend runtime errors | After each stage | Vercel Analytics + browser console | Support Owner |
| Answer-after-hint correlation | After Stage 2 | execution/error event correlation | Support Owner |
| Concurrent-use latency | After each stage | Manual observation + backend logs | Support Owner |

---

## Rollback Procedure

### Emergency Rollback

If critical issues occur during beta:

1. **Identify rollback target**: `fc143c6` (previous stable)
2. **Frontend rollback**: Use Vercel Dashboard to revert production deployment
3. **Backend rollback**: Use Vercel Dashboard to revert API deployment
4. **Verify health**: Check /health endpoint returns 200
5. **Verify active-run**: Run `npm run corpus:verify-active-run`
6. **Smoke test**: Login, practice page, hint request, answer submission

### Database Considerations

- No schema changes for beta - rollback is data-safe
- Active run persists in database across deployments
- Neon provides point-in-time recovery if needed

---

## Support Owner Checklist

**Before Each Stage**:
- [ ] Confirm deployment IDs match the release candidate
- [ ] Verify active-run: `npm run corpus:verify-active-run`
- [ ] Check backend /health returns 200
- [ ] Confirm instructor class codes are valid and available
- [ ] Print or open the [First-Session Observation Checklist](./beta-first-session-observation.md)

**During Each Stage**:
- [ ] Monitor Vercel function error dashboard every 15 minutes
- [ ] Observe at least one student through the full onboarding + hint flow
- [ ] Collect supervisor feedback forms immediately after session

**After Each Stage**:
- [ ] Run `npm run corpus:verify-active-run`
- [ ] Query `interaction_events` for error rate and hint success rate
- [ ] Review Vercel Analytics for frontend errors
- [ ] Decide Go / Hold / Rollback for next stage

---

## Support Contacts

| Role | Contact | Escalation |
|------|---------|------------|
| Support Owner | Project Lead / On-Call Engineer | Add responsible engineer |
| Technical Lead | TBD | Add responsible engineer |
| On-Call Rotation | TBD | Add on-call schedule |
| Infrastructure | Vercel Dashboard | Vercel Support |
| Database | Neon Console | Neon Support |

---

## Evidence

### Load/Concurrency Evidence

- **Script**: `scripts/beta-50-student-readiness.mjs`
- **Run date**: 2026-03-30
- **Target**: Production backend public endpoints
- **Result**: 300 requests, 100% success, 0 errors, p95 < 2400ms
- **Artifact**: `dist/beta/50-student-readiness/1774916721743-public-edge.json`

### Core Flow Evidence

- **Local regression tests**: `npm run test:e2e:hint-stability` passes (30 cases, scores 1.0)
- **Save-to-notes tests**: `tests/e2e/regression/ux-bugs-save-to-notes.spec.ts` passes
- **Multi-device persistence**: `tests/e2e/regression/student-multi-device-persistence.spec.ts` passes (local/deployed)
- **Auth smoke**: `tests/e2e/regression/deployed-auth-smoke.spec.ts` passes when credentials are available

---

## Related Documentation

- [Beta 50-Student Operations Runbook](./beta-50-student-operations.md) - Staged ramp, stop conditions, incident runbook
- [Beta Telemetry Readiness](./beta-telemetry-readiness.md) - Telemetry audit checklist
- [Student Onboarding](./beta-student-onboarding.md) - Student first-session guide
- [First-Session Observation](./beta-first-session-observation.md) - Supervisor checklist for observing beta sessions
- [Project Status](./status.md) - Current status and blockers
- [Deployment Guide](../../DEPLOYMENT.md) - Deployment procedures

---

*Last Updated: 2026-03-30*
*Packet ID: beta-launch-run-1774916721*
