# Supervised Beta Launch Packet

**Version**: 1.0.0-beta
**Release Date**: 2026-03-30
**Phase**: Controlled Student Beta Launch
**Status**: READY FOR SUPERVISED SMALL BETA

---

## Release Identification

| Field | Value |
|-------|-------|
| **Git Commit** | `a799561a13791771f4e30097af15021e4c7c2415` |
| **Branch** | `codex/beta-stabilization-preview-first` |
| **Release Tag** | `v1.0.0-beta` |
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

---

## Supervised Beta Scope and Limits

### Participant Criteria

- **Initial Cohort**: 3-10 students
- **Environment**: Supervised setting (instructor present)
- **Duration**: Single session initially, expand based on results
- **Prerequisites**: Basic SQL familiarity, instructor-provided class code

### Scope Boundaries

**In Scope**:
- Student signup with class code
- SQL practice with 43 problems
- Progressive hint system (3-rung ladder)
- Automatic textbook note generation
- Multi-device progress persistence

**Out of Scope**:
- Instructor dashboard features (monitor only)
- LLM-enhanced explanations (fallback only)
- PDF content search
- Public/unrestricted access

### Success Criteria

| Metric | Target |
|--------|--------|
| Successful logins | 100% of students |
| Hint requests completed | >80% without errors |
| Save-to-notes success | >90% of attempts |
| Multi-device restore | 100% within 5 seconds |
| Runtime errors | Zero critical errors |

---

## Pre-Launch Verification Checklist

- [x] Production environment variables configured
- [x] Production frontend URL accessible (HTTP 200)
- [x] Production backend /health returns 200
- [x] E2E deployed environment check passed
- [x] Corpus active-run verified for production
- [x] Frontend build verification passed
- [x] Server build verification passed
- [x] Telemetry audit - critical signals verified

---

## Post-Launch Monitoring Plan

| Check | Frequency | Tool/Method |
|-------|-----------|-------------|
| Vercel deployment logs | Continuous | Vercel Dashboard |
| Neon database health | Hourly | /health endpoint |
| Student interaction events | Daily | Neon Database (interaction_events table) |
| Hint request telemetry | Daily | hint_view event analysis |
| Frontend runtime errors | Daily | Vercel Analytics + browser console |
| Answer-after-hint correlation | Weekly | execution/error event correlation |

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

## Support Contacts

| Role | Contact | Escalation |
|------|---------|------------|
| Technical Lead | TBD | Add responsible engineer |
| On-Call Rotation | TBD | Add on-call schedule |
| Infrastructure | Vercel Dashboard | Vercel Support |
| Database | Neon Console | Neon Support |

---

## Related Documentation

- [Beta Telemetry Readiness](./beta-telemetry-readiness.md) - Telemetry audit checklist
- [Student Onboarding](./beta-student-onboarding.md) - Student first-session guide
- [First-Session Observation](./beta-first-session-observation.md) - Supervisor checklist
- [Project Status](./status.md) - Current status and blockers
- [Deployment Guide](../../DEPLOYMENT.md) - Deployment procedures

---

*Last Updated: 2026-03-30*
*Packet ID: beta-launch-run-1774826173*
