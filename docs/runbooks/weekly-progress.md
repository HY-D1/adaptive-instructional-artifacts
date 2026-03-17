# Weekly Progress Log

**Active Checkpoint Record**  
**Last Updated**: 2026-03-10

---

## 2026-03-10: Phase 1 - Truth Cleanup & Demo Hardening

### Completed Tasks

#### Route Contract Resolution
- Fixed RootLayout.tsx: instructors can now access /textbook
- Removed dead student branch from ResearchPage.tsx
- Added instructor textbook access E2E tests
- Updated README route matrix to match runtime behavior

#### Demo Dataset Feature
- Created apps/web/src/app/lib/demo/demo-seed.ts
- Added Seed Demo Data / Reset Demo Data buttons to InstructorDashboard
- Production passcode now requires VITE_INSTRUCTOR_PASSCODE env var
- Added configuration error UI for missing production passcode

### Demo Dataset Contents
| Entity | Count | Description |
|--------|-------|-------------|
| Learners | 3 | Alice Chen, Bob Martinez, Carol Williams |
| Interactions | ~24 | hint_request, error, profile_assigned, hdi_calculated |
| Textbook Units | 0 | *Note: textbook units not yet seeded* |

### Operational Telemetry Note
Demo seed/reset operations are operational helpers, not research telemetry.
These events are excluded from research metrics.

### Known Blockers
| Issue | Severity | Action |
|-------|----------|--------|
| Demo textbook units | Medium | Need to add textbook_unit_upsert events and units |
| E2E verification | Medium | Full test suite needs fresh run |
| Replay checksum | Low | Review fixture changes, run gate:update |

---

## Archive

*Older entries moved to docs/archive/ when they exceed 3 months*

---

*For milestone overview, see progress.md*
