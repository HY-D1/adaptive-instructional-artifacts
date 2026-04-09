# SQL-Adapt Documentation Index

> **Single Source of Truth for All Project Documentation**
> 
> Last Updated: 2026-04-08  
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
- **Persistence Fix**: [`PERSISTENCE_HARDENING_REPORT.md`](./PERSISTENCE_HARDENING_REPORT.md)
- **Data Model**: [`PERSISTENCE_MAP.md`](./PERSISTENCE_MAP.md)
- **Progress Tracker**: [`CHANGELOG.md`](./CHANGELOG.md) (this commit)

---

## 📁 Documentation Structure

### Core Documents
| Document | Purpose | Last Updated |
|----------|---------|--------------|
| [`PROJECT_COORDINATION.md`](./PROJECT_COORDINATION.md) | **File organization rules and progress tracking** | 2026-04-08 |
| [`AGENTS.md`](./AGENTS.md) | AI agent working rules and guidelines | 2026-03-24 |
| [`README.md`](../README.md) | Project overview and quick start | 2026-04-08 |
| [`CHANGELOG.md`](./CHANGELOG.md) | Progress tracker and decision log | 2026-04-08 |
| [`INDEX.md`](./INDEX.md) | This file - documentation navigation | 2026-04-08 |

### Deployment & Operations
| Document | Purpose | Status |
|----------|---------|--------|
| [`DEPLOYMENT.md`](./DEPLOYMENT.md) | Production deployment guide | Active |
| [`DEPLOYMENT_MODES.md`](./DEPLOYMENT_MODES.md) | Local vs hosted vs full-stack modes | Active |
| [`ENVIRONMENT.md`](./ENVIRONMENT.md) | Environment variables reference | Active |
| [`runbooks/status.md`](./runbooks/status.md) | Current project status | Check frequently |

### Audit & Hardening Reports
| Document | Purpose | Date | Status |
|----------|---------|------|--------|
| [`PERSISTENCE_HARDENING_REPORT.md`](./PERSISTENCE_HARDENING_REPORT.md) | Persistence fix implementation details | 2026-04-08 | ✅ Complete |
| [`PERSISTENCE_MAP.md`](./PERSISTENCE_MAP.md) | Data authority map (source of truth) | 2026-04-08 | ✅ Complete |
| [`PROGRESS_AUDIT_REPORT.md`](./PROGRESS_AUDIT_REPORT.md) | Progress system audit | 2026-04-08 | ✅ Complete |
| [`PROGRESS_MODEL.md`](./PROGRESS_MODEL.md) | Progress tracking data model | 2026-04-08 | ✅ Complete |
| [`audit/P1_FIXES_SUMMARY.md`](./audit/P1_FIXES_SUMMARY.md) | Priority 1 fixes completed | 2026-04-03 | ✅ Complete |
| [`audit/P2_P3_FIXES_SUMMARY.md`](./audit/P2_P3_FIXES_SUMMARY.md) | Priority 2/3 fixes completed | 2026-04-03 | ✅ Complete |
| [`audit/PRACTICE_HINTS_LOGGING_AUDIT.md`](./audit/PRACTICE_HINTS_LOGGING_AUDIT.md) | Full practice/hints audit | 2026-04-03 | ✅ Complete |

### Research Documentation
See [`research/`](./research/) for 27 research architecture documents including:
- [`PROJECT_OVERVIEW.md`](./research/PROJECT_OVERVIEW.md)
- [`RESEARCH_ARCHITECTURE.md`](./research/RESEARCH_ARCHITECTURE.md)
- [`LOGGING_SPECIFICATION.md`](./research/LOGGING_SPECIFICATION.md)
- [`MULTI_ARMED_BANDIT.md`](./research/MULTI_ARMED_BANDIT.md)
- [`ESCALATION_POLICIES.md`](./research/ESCALATION_POLICIES.md)

### Test Reports
| Document | Purpose |
|----------|---------|
| [`reports/BANDIT_TEST_REPORT.md`](./reports/BANDIT_TEST_REPORT.md) | Bandit algorithm test results |
| [`reports/BUG_HUNTING_REPORT.md`](./reports/BUG_HUNTING_REPORT.md) | Bug hunting findings |
| [`reports/PERFORMANCE_BENCHMARK_REPORT.md`](./reports/PERFORMANCE_BENCHMARK_REPORT.md) | Performance benchmarks |

### Operational Runbooks
See [`runbooks/`](./runbooks/) for 17 operational guides including:
- [`runbooks/status.md`](./runbooks/status.md) - Current project status
- [`runbooks/beta-50-student-operations.md`](./runbooks/beta-50-student-operations.md) - Beta operations
- [`runbooks/storage-quota-incident.md`](./runbooks/storage-quota-incident.md) - Storage incident response
- [`runbooks/beta-supervised-launch-packet.md`](./runbooks/beta-supervised-launch-packet.md) - Launch procedures

---

## 🎯 Current Workstreams (Priority Order)

### Workstream 1: Multi-Device Persistence ✅ COMPLETE
**Status**: Root cause identified, fix implemented, tests passing

**Key Documents**:
- [`PERSISTENCE_HARDENING_REPORT.md`](./PERSISTENCE_HARDENING_REPORT.md)
- [`PERSISTENCE_MAP.md`](./PERSISTENCE_MAP.md)

**Implementation**:
- Fixed: `apps/web/src/app/lib/storage/dual-storage.ts` - Added `getAllProblemProgress()` to `hydrateLearner()`
- Tests: All 1781 tests passing
- Build: ✅ Passing



---

## 🔍 Finding Information

### By Topic

**Authentication & Sessions**
- [`AGENTS.md`](./AGENTS.md) Section 4.3 - Auth model
- [`PERSISTENCE_MAP.md`](./PERSISTENCE_MAP.md) - Session state authority
- [`runbooks/auth-rate-limit-audit.md`](./runbooks/auth-rate-limit-audit.md)

**Data Persistence**
- [`PERSISTENCE_MAP.md`](./PERSISTENCE_MAP.md) - Complete data authority reference
- [`PERSISTENCE_HARDENING_REPORT.md`](./PERSISTENCE_HARDENING_REPORT.md) - Implementation details
- [`DEPLOYMENT.md`](./DEPLOYMENT.md) - Neon setup

**Progress & Solved State**
- [`PROGRESS_MODEL.md`](./PROGRESS_MODEL.md) - How progress tracking works
- [`PROGRESS_AUDIT_REPORT.md`](./PROGRESS_AUDIT_REPORT.md) - Audit findings

**Instructor Dashboard**
- [`AGENTS.md`](./AGENTS.md) Section 4.4 - Multi-user ownership
- [`DEPLOYMENT.md`](./DEPLOYMENT.md) - Dashboard deployment

**Testing**
- [`AGENTS.md`](./AGENTS.md) Section 8 - Testing rules
- [`tests/unit/web/progress-persistence.test.ts`](../tests/unit/web/progress-persistence.test.ts) - New persistence tests

---

## ⚠️ Document Freshness

### Always Current (Updated with code changes)
- `AGENTS.md`
- `runbooks/status.md`
- `CHANGELOG.md`
- `INDEX.md` (this file)

### Audit Reports (Snapshot in time)
- `PERSISTENCE_HARDENING_REPORT.md` - 2026-04-08
- `PERSISTENCE_MAP.md` - 2026-04-08
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
| 2026-04-08 | Created INDEX.md and CHANGELOG.md | Master Agent |
| 2026-04-08 | Persistence hardening complete | Master Agent |
| 2026-04-08 | Documentation cleanup complete | Master Agent |
| 2026-04-08 | Deleted obsolete folders and agent artifacts | Master Agent |

---

**Questions?** Check [`AGENTS.md`](./AGENTS.md) Section 14 for required response format.
