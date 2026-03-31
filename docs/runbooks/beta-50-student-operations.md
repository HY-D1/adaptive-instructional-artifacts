# Beta 50-Student Operations Runbook

**Version**: 1.0.0
**Phase**: Controlled 50-Student Beta Scale Readiness
**Audience**: Support owners, supervisors, and on-call engineers

---

## 1. Staged Ramp Plan

The 50-student beta is delivered in three supervised stages. Each stage must be explicitly approved before advancing.

| Stage | Cohort Size | Purpose | Approval Gate |
|-------|-------------|---------|---------------|
| **Stage 1** | 5 students | Baseline supervised validation of onboarding, hints, save-to-notes, refresh/resume | Support Owner |
| **Stage 2** | 15 students | Prove stability under moderate concurrent load | Support Owner + Supervisor sign-off |
| **Stage 3** | 50 students | Full supervised beta cohort | Support Owner + no unresolved P1s |

### Stage Advancement Decision Tree

```
Stage Complete
    |
    v
Any P0/P1 issues? ----YES-----> STOP -> Fix -> Re-run stage
    | NO
    v
Metrics meet targets? ----NO-----> HOLD -> Investigate -> Re-run or reduce scope
    | YES
    v
Advance to next stage
```

---

## 2. Stop Conditions (Immediate Hold)

If ANY of the following occur during a stage, **pause immediately**. Do not advance until root cause is understood and mitigated.

| # | Condition | Evidence Source | Response |
|---|-----------|-----------------|----------|
| 1 | Data loss for any student | Supervisor report + DB query | STOP and assess rollback |
| 2 | > 20% login failure rate | Supervisor report + auth logs | STOP and assess rollback |
| 3 | Backend /health non-200 for > 5 min | Automated health check | STOP and escalate to on-call |
| 4 | > 5% auth/session write 5xx | Backend logs / Vercel errors | STOP and investigate DB |
| 5 | > 20% hint request failure | Supervisor report + interaction events | HOLD and investigate hint service |
| 6 | Active-run mismatch or corruption | `npm run corpus:verify-active-run` | STOP and rollback |

---

## 3. Rollback Triggers and Procedure

### Rollback Triggers

Rollback to `fc143c6` **immediately** if:
- Confirmed data loss
- Auth compromise or widespread login failure
- Persistent 5xx for > 10 minutes
- Active-run corruption
- Same stop condition triggered twice without fix

### Rollback Procedure

1. **Alert stakeholders** (supervisor, support owner, technical lead).
2. **Vercel Dashboard** → Revert frontend production deployment to last stable.
3. **Vercel Dashboard** → Revert backend API deployment to `fc143c6`.
4. **Verify health**: `curl -sS https://adaptive-instructional-artifacts-ap.vercel.app/health`
5. **Verify active-run**:
   ```bash
   npm run corpus:verify-active-run -- \
     --api-base-url https://adaptive-instructional-artifacts-ap.vercel.app
   ```
6. **Smoke test** (manual, 2 minutes):
   - Open frontend URL
   - Log in with known instructor account
   - Open practice page
   - Request a hint
   - Submit an answer
7. **Communicate all-clear** or escalate if smoke test fails.

---

## 4. Support Owner Checklist

### Before Each Stage

- [ ] Confirm Git commit matches release candidate (`12a9c5f`)
- [ ] Verify active-run: `npm run corpus:verify-active-run`
- [ ] Verify backend health: `curl -sS https://adaptive-instructional-artifacts-ap.vercel.app/health`
- [ ] Confirm instructor has valid class codes
- [ ] Confirm supervisor has [First-Session Observation Checklist](./beta-first-session-observation.md)
- [ ] Confirm rollback procedure has been reviewed

### During Each Stage

- [ ] Monitor Vercel function error dashboard every 15 minutes
- [ ] Walk the room and observe at least one full student journey
- [ ] Note any red flags in real time

### After Each Stage

- [ ] Run `npm run corpus:verify-active-run`
- [ ] Query interaction error rates:
   ```sql
   SELECT event_type, COUNT(*) FILTER (WHERE success = false) AS errors, COUNT(*) AS total
   FROM interaction_events
   WHERE created_at > NOW() - INTERVAL '2 hours'
   GROUP BY event_type;
   ```
- [ ] Check Vercel Analytics for frontend error spikes
- [ ] Compile supervisor feedback
- [ ] File decision: **Go** / **Hold** / **Rollback**

---

## 5. Issue Escalation Path

| Severity | Definition | Response Time | Escalation |
|----------|------------|---------------|------------|
| **P0** | Data loss, security incident, total outage | 15 minutes | Immediate rollback + page on-call |
| **P1** | Widespread functional failure (> 20% users) | 30 minutes | Support owner + technical lead |
| **P2** | Degraded experience (< 20% users) | 2 hours | Support owner, fix before next stage |
| **P3** | Cosmetic / minor inconvenience | 24 hours | Backlog for post-beta |

### Escalation Contacts

| Role | Responsibility |
|------|----------------|
| **Support Owner** | First responder, monitors telemetry, executes stage gates |
| **Technical Lead** | Architecture decisions, approves hotfixes, rollback authority |
| **Instructor / Supervisor** | Eyes on the ground, reports student-facing issues |

---

## 6. Deterministic Active-Run Verification

Run this command at the start and end of every stage:

```bash
npm run corpus:verify-active-run -- \
  --api-base-url https://adaptive-instructional-artifacts-ap.vercel.app
```

Expected output:
- `docsChecked: 1`
- `unitsChecked: 43`
- `chunksChecked: 101`
- `mismatchedUnits: 0`
- `mismatchedChunks: 0`

If any mismatch appears, **stop** and investigate before continuing.

---

## 7. Release Sanity Checks

| Check | Command / Action | Expected Result |
|-------|------------------|-----------------|
| Frontend build | `npm run build` | Pass with no errors |
| Server build | `npm run server:build` | Pass with no errors |
| Frontend URL | `curl -I https://adaptive-instructional-artifacts.vercel.app` | HTTP 200 |
| Backend health | `curl -sS https://adaptive-instructional-artifacts-ap.vercel.app/health` | JSON with `status: ok` |
| Corpus manifest | `curl -sS https://adaptive-instructional-artifacts-ap.vercel.app/api/corpus/manifest` | JSON with `activeRunId` |
| Active-run verification | `npm run corpus:verify-active-run` | 0 mismatches |

---

## 8. Telemetry / Monitoring Checklist

### Verified Signals (Confirmed Emitting)

| Signal | Event Type | Verified | How to Inspect |
|--------|------------|----------|----------------|
| Hint request | `hint_view` | Yes | `SELECT * FROM interaction_events WHERE event_type = 'hint_view'` |
| Follow-up hint | `hint_view` with `helpRequestIndex` | Yes | Same as above, filter by `helpRequestIndex > 0` |
| Answer after hint | `execution` / `error` correlated with `hint_view` | Yes | Join by `session_id` and `problem_id` |
| Save-to-notes | `textbook_add` / `textbook_update` | Yes | `SELECT * FROM interaction_events WHERE event_type IN ('textbook_add', 'textbook_update')` |
| Refresh/resume | `session-save` + `session-get` backend logs | Yes | Server logs + `neon_sessions` table |
| Active-run integrity | `corpus:verify-active-run` | Yes | Run script before and after each stage |
| Concurrent-use load | Public edge load test | Yes | See `dist/beta/50-student-readiness/` artifact |

### Gaps (Non-Blocking)

| Gap | Verified | Impact | Monitoring Fallback |
|-----|----------|--------|---------------------|
| `concept_view` explicit event | No | Medium | Infer from `conceptIds` in hint/textbook events |
| Auth events in research DB | No | Low | Server logs + HTTP status codes |
| `page_view` telemetry | No | Low | Vercel Analytics |

---

## 9. Incident / Rollback Runbook

### Scenario A: Hint System Stops Working

1. **Confirm scope**: Ask supervisor how many students are affected.
2. **Check backend logs**: Look for errors in `/api/interactions` or `/api/sessions`.
3. **Check active-run**: `npm run corpus:verify-active-run`
4. **If > 20% affected**: Trigger stop condition. Do not proceed.
5. **If persistent after 10 min**: Rollback to `fc143c6`.

### Scenario B: Students Lose Progress on Refresh

1. **Reproduce**: Test refresh on production with a known test account.
2. **Check `neon_sessions` table**: Is active session saved? Is `currentCode` present?
3. **Check interaction events**: Is data being written?
4. **If confirmed data loss**: This is a P0. Rollback immediately.

### Scenario C: Login Failures Spike

1. **Check `/health`**: Is backend up?
2. **Check `/api/auth/me`**: Does it return 401 for valid cookies?
3. **Check Vercel function errors**: Any 5xx on `/api/auth/*`?
4. **If > 20% failure rate**: Trigger stop condition.
5. **If Neon connection errors**: Escalate to technical lead + Neon support.

### Scenario D: Active-Run Mismatch

1. **Re-run**: `npm run corpus:verify-active-run`
2. **Check `corpus_active_runs` table**: Is `run_id` still `run-1774671570-b1353117`?
3. **If corrupted**: Re-set active run:
   ```bash
   npm run corpus:set-winner-run
   ```
4. **If repeated corruption**: This is a P0. Rollback and investigate.

---

## 10. Known-Caveat Handling

| Caveat | How It Affects Beta | What to Tell Students / Supervisors |
|--------|---------------------|--------------------------------------|
| PDF Index disabled | Cannot search PDF textbook content | "PDF search is not available in this beta. Focus on practice problems and hints." |
| LLM disabled | AI explanations fall back to pre-written hint ladder | "Hints are structured and pre-written. There is no live AI chat." |
| No explicit `concept_view` | We infer concept interest from hints/notes | Operational only; no student impact. |
| Build warnings (dynamic imports) | Slightly larger first load | Operational only; no student impact. |

---

## 11. Capacity Assumptions

| Resource | Assumed Limit | Beta Safety Margin |
|----------|---------------|-------------------|
| Vercel Serverless Functions | 1000 concurrent invocations (default) | 50 students → well within limits |
| Neon PostgreSQL (Pooled) | 100 concurrent connections | Session writes are short-lived; 50 concurrent students → safe |
| Frontend CDN (Vercel Edge) | Effectively unlimited | Static assets scale automatically |

**Note**: These are platform-level assumptions. Real capacity is validated through the staged ramp and the public-edge load test.

---

*Last Updated: 2026-03-30*
