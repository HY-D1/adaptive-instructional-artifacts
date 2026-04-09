# Runtime Audit Checklist - 2026-04-08

**Master Agent Baseline Record**

## Release Parity Status

| Component | SHA | Source | Status |
|-----------|-----|--------|--------|
| GitHub main (repo) | `9720b4d0a0c4438737b0357fd2fb5af695229b78` | Local git | ✅ Current |
| Frontend production | `fd64dd86d9e25b24ddf5d7f87913693c6e1905e9` | Vercel metadata | ⚠️ Behind main |
| Backend production | `fd64dd86d9e25b24ddf5d7f87913693c6e1905e9` | Vercel metadata | ⚠️ Behind main |

**Drift Detected**: Production is ~30 commits behind latest main.
- Drift commits: `0826943e069b653e2070201554a758dfb58a2ea8` (last seen main) vs `fd64dd86d9e25b24ddf5d7f87913693c6e1905e9` (prod)

## Project Version
- Package version: `0.1.0-research-ready.1`
- Research contract version: TBD (check `scripts/verification/check-neon-paper-data-contract.mjs`)

## Known Risks (Ranked by User Harm + Data Risk)

### 🔴 Critical (Block Release)
1. **Query 13 Grading Mismatch**: Expected data in `problems.ts` does not match seeded data
   - Correct student answers marked wrong
   - Affects learner progress/solved counts
   - Agent: Grading/Content Correctness (WS5)

### 🟠 High (Fix Before User Cohort)
2. **Production/Main Drift**: Latest deployed commit differs from main
   - Risk of deploying untested changes
   - Need parity verification before rollout
   - Agent: Release/Operations (WS7)

3. **Progress Labels/Model Confusion**: UI concepts of progress may not map cleanly to backend
   - Learner sees confusing numbers
   - Solved count may be unreliable
   - Agent: Frontend UX (WS2) + Database (WS4)

4. **Instructor Login Preload Work**: Dashboard does too much before UI usable
   - Poor instructor UX
   - May cause timeouts
   - Agent: Backend/API (WS3)

### 🟡 Medium (Address in Next Sprint)
5. **Frontend Bundle Size**: ~1.49 MB before gzip
   - UX/perf impact
   - Large synchronous loads
   - Agent: Frontend UX (WS2)

6. **Legacy Data Migration Gaps**: Old rows missing `template_id` unrecoverable
   - Research export completeness
   - Need honest labeling
   - Agent: Database/Telemetry (WS4)

7. **Node Version Auto-upgrade Risk**: `engines.node` not pinned tightly
   - Vercel may surprise upgrade
   - Agent: Release/Operations (WS7)

### 🟢 Low (Monitor)
8. Hint cache quota hardening - appears present, verify runtime
9. Keepalive batch CSRF headers - appears present, verify runtime
10. Retrieval provenance table - schema exists, verify population

## Workstream Assignments

| WS | Agent | Focus | Priority |
|----|-------|-------|----------|
| WS1 | Master (this file) | Coordination, parity, integration | - |
| WS2 | Frontend UX/Reliability | Learner flows, crash paths, progress clarity | P1 |
| WS3 | Backend/API | Route parity, instructor perf, session correctness | P1 |
| WS4 | Database/Telemetry | Schema defense, write paths, migration honesty | P1 |
| WS5 | Grading/Content | Query 13 fix, result comparison correctness | P0 |
| WS6 | Verification/QA | Smoke tests, regression proof | P1 |
| WS7 | Release/Operations | Deploy safety, parity visibility | P1 |

## Hard Merge Policy

No agent may merge to main without:
1. Tests passing OR named manual smoke check documented
2. Master-agent signoff on impact to other workstreams
3. Update to this checklist with verification evidence
4. For production-sensitive code: successful smoke test on staging

## Integration Branch

**Branch name**: `audit/2026-04-08-runtime-hardening`
**Base**: `main` @ `9720b4d0a0c4438737b0357fd2fb5af695229b78`

All sub-agent work merges to integration branch first. Master agent reconciles before main merge.

## Verification Commands

```bash
# Build verification
npm run server:build
npm run build
npm run replay:gate

# Research verification
npm run research:gate
npm run research:validate

# Test verification
npm test
```

## Signoff Log

| Date | Agent | Action | Evidence |
|------|-------|--------|----------|
| 2026-04-08 | Master | Baseline recorded | This file created |

---

**Next Action**: Launch WS2-WS7 sub-agents in parallel after master baseline confirmed.
