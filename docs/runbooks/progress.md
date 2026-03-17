# Project Progress & Milestones

**Project**: Adaptive Instructional Artifacts (SQL-Adapt)  
**Last Updated**: 2026-03-10

---

## Current Phase

### Phase 1: Truth Cleanup + Demo-Safe Acceptance (2026-03-10)

**Objective**: Make repository documentation truthful by removing unverifiable claims and establishing demo-safe acceptance baseline.

**Completed**:
- [x] Route contract fix: instructors can access /textbook for learner inspection
- [x] Demo dataset feature with seed/reset controls
- [x] Production passcode security hardening

**In Progress**:
- [ ] Fresh E2E test verification
- [ ] Replay gate checksum review

---

## Milestone History

| Milestone | Date | Status | Key Deliverables |
|-----------|------|--------|------------------|
| Week 2 | 2026-02-14 | ✅ Complete | Hint ladder, My Notes, 87 tests |
| Week 3 | 2026-02-17 | ✅ Complete | Guidance Ladder, Source Grounding |
| Week 4 | 2026-02-18 | ✅ Complete | Role-Based Access Control |
| Week 5 | 2026-02-28 | ✅ Complete | Escalation Profiles, Bandit, HDI |
| Phase 1 | 2026-03-10 | 🔄 Active | Truth cleanup, demo-safe acceptance |

---

## Route Access Contract

| Route | Student | Instructor | Notes |
|-------|---------|------------|-------|
| `/practice` | ✅ | ❌ (redirects to dashboard) | Student-only practice area |
| `/textbook` | ✅ | ✅ | Instructors can inspect learner textbooks |
| `/concepts` | ✅ | ❌ | Student learning content |
| `/research` | ❌ | ✅ | Instructor analytics only |
| `/instructor-dashboard` | ❌ | ✅ | Instructor home |
| `/settings` | ✅ | ✅ | Both roles |

---

*This file records durable project status. For active task tracking, see weekly-progress.md*
