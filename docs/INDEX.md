# SQL-Adapt Documentation Index

> **Single Source of Truth for All Project Documentation**
> 
> Last Updated: 2026-04-09  
> Branch: hardening/research-grade-tightening  
> Status: 🟢 ACTIVE

---

## 📋 Quick Navigation

### For New Agents
1. **Start here**: [`PROJECT_COORDINATION.md`](./PROJECT_COORDINATION.md) - Rules and organization
2. **Working guide**: [`AGENTS.md`](./AGENTS.md) - Complete agent guidelines
3. **Check status**: [`runbooks/status.md`](./runbooks/status.md)
4. **Deployment info**: [`DEPLOYMENT.md`](./DEPLOYMENT.md)

### For Current Work
- **Persistence Map**: [`PERSISTENCE_MAP.md`](./PERSISTENCE_MAP.md) - Data authority reference
- **E2E Testing**: [`E2E_AUTH_CREDENTIALS.md`](./E2E_AUTH_CREDENTIALS.md) - Test credentials
- **Change Log**: [`CHANGELOG.md`](./CHANGELOG.md) - Recent progress and decisions

---

## 📁 Documentation Structure

### Core Documents
| Document | Purpose | Last Updated |
|----------|---------|--------------|
| [`PROJECT_COORDINATION.md`](./PROJECT_COORDINATION.md) | **File organization rules and mandatory checklists** | 2026-04-08 |
| [`AGENTS.md`](./AGENTS.md) | AI agent working rules and guidelines | 2026-04-08 |
| [`README.md`](../README.md) | Project overview and quick start | 2026-04-08 |
| [`CHANGELOG.md`](./CHANGELOG.md) | Progress tracker and decision log | 2026-04-09 |
| [`INDEX.md`](./INDEX.md) | This file - documentation navigation | 2026-04-09 |

### Deployment & Environment
| Document | Purpose | Status |
|----------|---------|--------|
| [`DEPLOYMENT.md`](./DEPLOYMENT.md) | Production deployment guide | Active |
| [`DEPLOYMENT_MODES.md`](./DEPLOYMENT_MODES.md) | Local vs hosted vs full-stack modes | Active |
| [`ENVIRONMENT.md`](./ENVIRONMENT.md) | Environment variables reference | Active |
| [`PERSISTENCE_MAP.md`](./PERSISTENCE_MAP.md) | **Complete data authority reference** | 2026-04-09 |
| [`PERSISTENCE_HARDENING_REPORT.md`](./PERSISTENCE_HARDENING_REPORT.md) | Persistence fix implementation | 2026-04-08 |

### E2E Testing & Auth
| Document | Purpose | Last Updated |
|----------|---------|--------------|
| [`E2E_AUTH_CREDENTIALS.md`](./E2E_AUTH_CREDENTIALS.md) | Verified production test accounts | 2026-04-09 |
| [`runbooks/e2e-auth-seeding.md`](./runbooks/e2e-auth-seeding.md) | Test-seed approach for preview | 2026-04-09 |
| [`runbooks/e2e-inventory.md`](./runbooks/e2e-inventory.md) | Complete 78-test catalog | 2026-04-09 |
| [`runbooks/e2e-sharding-strategy.md`](./runbooks/e2e-sharding-strategy.md) | Parallel execution strategy | 2026-04-09 |

### Audit Reports
| Document | Purpose | Date | Status |
|----------|---------|------|--------|
| [`PROGRESS_AUDIT_REPORT.md`](./PROGRESS_AUDIT_REPORT.md) | Progress system audit | 2026-04-08 | ✅ Complete |
| [`PROGRESS_MODEL.md`](./PROGRESS_MODEL.md) | Progress tracking data model | 2026-04-08 | ✅ Complete |
| [`audit/P1_FIXES_SUMMARY.md`](./audit/P1_FIXES_SUMMARY.md) | Priority 1 fixes completed | 2026-04-03 | ✅ Complete |
| [`audit/P2_P3_FIXES_SUMMARY.md`](./audit/P2_P3_FIXES_SUMMARY.md) | Priority 2/3 fixes completed | 2026-04-03 | ✅ Complete |
| [`audit/PRACTICE_HINTS_LOGGING_AUDIT.md`](./audit/PRACTICE_HINTS_LOGGING_AUDIT.md) | Full practice/hints audit | 2026-04-03 | ✅ Complete |
| [`audit/NEON_RESEARCH_INTEGRITY_AUDIT.md`](./audit/NEON_RESEARCH_INTEGRITY_AUDIT.md) | Research data integrity | 2026-04-09 | ✅ Complete |

### Test Reports
| Document | Purpose |
|----------|---------|
| [`reports/BANDIT_TEST_REPORT.md`](./reports/BANDIT_TEST_REPORT.md) | Bandit algorithm test results |
| [`reports/BUG_HUNTING_REPORT.md`](./reports/BUG_HUNTING_REPORT.md) | Bug hunting findings |
| [`reports/PERFORMANCE_BENCHMARK_REPORT.md`](./reports/PERFORMANCE_BENCHMARK_REPORT.md) | Performance benchmarks |

### Research Documentation
See [`research/`](./research/) for 27 research architecture documents including:
- [`PROJECT_OVERVIEW.md`](./research/PROJECT_OVERVIEW.md)
- [`RESEARCH_ARCHITECTURE.md`](./research/RESEARCH_ARCHITECTURE.md)
- [`LOGGING_SPECIFICATION.md`](./research/LOGGING_SPECIFICATION.md)
- [`MULTI_ARMED_BANDIT.md`](./research/MULTI_ARMED_BANDIT.md)
- [`ESCALATION_POLICIES.md`](./research/ESCALATION_POLICIES.md)
- [`PAPER_DATA_CONTRACT.md`](./research/PAPER_DATA_CONTRACT.md)
- [`EXPORT_DATA_CONTRACT.md`](./research/EXPORT_DATA_CONTRACT.md)

### Operational Runbooks
| Document | Purpose |
|----------|---------|
| [`runbooks/status.md`](./runbooks/status.md) | **Current project status** |
| [`runbooks/harness-gate-matrix.md`](./runbooks/harness-gate-matrix.md) | Acceptance criteria matrix |
| [`runbooks/instructor-dashboard.md`](./runbooks/instructor-dashboard.md) | Instructor dashboard documentation |
| [`runbooks/beta-50-student-operations.md`](./runbooks/beta-50-student-operations.md) | Beta operations guide |
| [`runbooks/storage-quota-incident.md`](./runbooks/storage-quota-incident.md) | Storage incident response |
| [`runbooks/beta-supervised-launch-packet.md`](./runbooks/beta-supervised-launch-packet.md) | Launch procedures |
| [`runbooks/environment-isolation-audit.md`](./runbooks/environment-isolation-audit.md) | Preview/prod DB separation |
| [`runbooks/session-rehydration-audit.md`](./runbooks/session-rehydration-audit.md) | Login-time merge behavior |

---

## 🎯 Current Workstreams (Priority Order)

### Workstream 1: Documentation Consolidation ✅ COMPLETE
**Status**: Duplicate files removed, overlapping content merged

**Actions Taken**:
- Deleted `docs/progress.md` (violated PROJECT_COORDINATION.md rules)
- Deleted `docs/week2026-04-09_progress.md` (violated PROJECT_COORDINATION.md rules)
- Removed duplicate `docs/runbooks/PERSISTENCE_HARDENING_REPORT.md`
- Removed duplicate `docs/runbooks/HARNESS_GATE_MATRIX.md`
- Merged `docs/runbooks/persistence-truth-map.md` into `docs/PERSISTENCE_MAP.md`
- Merged instructor dashboard docs into `docs/runbooks/instructor-dashboard.md`
- Added cross-references between E2E/auth documentation

---

## 🔍 Finding Information

### By Topic

**Authentication & Sessions**
- [`AGENTS.md`](./AGENTS.md) Section 4.3 - Auth model
- [`PERSISTENCE_MAP.md`](./PERSISTENCE_MAP.md) - Session state authority
- [`runbooks/auth-rate-limit-audit.md`](./runbooks/auth-rate-limit-audit.md)
- [`E2E_AUTH_CREDENTIALS.md`](./E2E_AUTH_CREDENTIALS.md)

**Data Persistence**
- [`PERSISTENCE_MAP.md`](./PERSISTENCE_MAP.md) - **Complete data authority reference**
- [`PERSISTENCE_HARDENING_REPORT.md`](./PERSISTENCE_HARDENING_REPORT.md) - Implementation details
- [`DEPLOYMENT.md`](./DEPLOYMENT.md) - Neon setup

**Progress & Solved State**
- [`PROGRESS_MODEL.md`](./PROGRESS_MODEL.md) - How progress tracking works
- [`PROGRESS_AUDIT_REPORT.md`](./PROGRESS_AUDIT_REPORT.md) - Audit findings

**Instructor Dashboard**
- [`runbooks/instructor-dashboard.md`](./runbooks/instructor-dashboard.md) - Complete documentation
- [`AGENTS.md`](./AGENTS.md) Section 4.4 - Multi-user ownership

**E2E Testing**
- [`E2E_AUTH_CREDENTIALS.md`](./E2E_AUTH_CREDENTIALS.md) - Production credentials
- [`runbooks/e2e-auth-seeding.md`](./runbooks/e2e-auth-seeding.md) - Preview test-seed
- [`runbooks/e2e-inventory.md`](./runbooks/e2e-inventory.md) - Test catalog
- [`AGENTS.md`](./AGENTS.md) Section 8 - Testing rules

---

## ⚠️ Document Freshness

### Always Current (Updated with code changes)
- `AGENTS.md`
- `runbooks/status.md`
- `CHANGELOG.md`
- `INDEX.md` (this file)
- `PERSISTENCE_MAP.md`

### Audit Reports (Snapshot in time)
- `PERSISTENCE_HARDENING_REPORT.md` - 2026-04-08
- `audit/PRACTICE_HINTS_LOGGING_AUDIT.md` - 2026-04-03

### Reference (Stable)
- `DEPLOYMENT.md`
- `DEPLOYMENT_MODES.md`
- `ENVIRONMENT.md`

---

## 📝 For AI Agents

**Before starting work**:
1. Read `PROJECT_COORDINATION.md` (organization rules)
2. Read `AGENTS.md` (working rules)
3. Check `runbooks/status.md` (current state)
4. Read this `INDEX.md` (find relevant docs)
5. Check `CHANGELOG.md` (recent decisions)

**Before claiming completion**:
1. Update relevant docs
2. Update `CHANGELOG.md`
3. Run tests
4. Update `runbooks/status.md`
5. Provide commit suggestion

---

## 🔄 Update History

| Date | Change | Author |
|------|--------|--------|
| 2026-04-09 | Documentation consolidation complete | Master Agent |
| 2026-04-09 | Merged persistence-truth-map into PERSISTENCE_MAP | Master Agent |
| 2026-04-09 | Merged instructor dashboard docs | Master Agent |
| 2026-04-09 | Added E2E/auth cross-references | Master Agent |
| 2026-04-08 | Created INDEX.md and CHANGELOG.md | Master Agent |
| 2026-04-08 | Persistence hardening complete | Master Agent |

---

**Questions?** Check [`AGENTS.md`](./AGENTS.md) Section 14 for required response format.
