# SQL-Adapt Documentation Index

> **Single Source of Truth for All Project Documentation**
> 
> Last Updated: 2026-04-08  
> Branch: hardening/research-grade-tightening  
> Status: 🟢 ACTIVE

---

## 📋 Quick Navigation

### For New Agents
1. Start here: [`AGENTS.md`](./AGENTS.md) - Complete working guide
2. Check status: [`runbooks/status.md`](./runbooks/status.md)
3. Deployment info: [`DEPLOYMENT.md`](./DEPLOYMENT.md)

### For Current Work
- **Persistence Fix**: [`PERSISTENCE_HARDENING_REPORT.md`](./PERSISTENCE_HARDENING_REPORT.md)
- **Data Model**: [`PERSISTENCE_MAP.md`](./PERSISTENCE_MAP.md)
- **Progress Tracker**: [`CHANGELOG.md`](./CHANGELOG.md) (this commit)

---

## 📁 Documentation Structure

### Core Documents
| Document | Purpose | Last Updated |
|----------|---------|--------------|
| [`AGENTS.md`](./AGENTS.md) | AI agent working rules and guidelines | 2026-03-24 |
| [`README.md`](./README.md) | Project overview and quick start | 2026-03-31 |
| [`CHANGELOG.md`](./CHANGELOG.md) | Progress tracker and decision log | 2026-04-08 |
| [`INDEX.md`](./INDEX.md) | This file - documentation navigation | 2026-04-08 |

### Deployment & Operations
| Document | Purpose | Status |
|----------|---------|--------|
| [`DEPLOYMENT.md`](./DEPLOYMENT.md) | Production deployment guide | Active |
| [`DEPLOYMENT_MODES.md`](./DEPLOYMENT_MODES.md) | Local vs hosted vs full-stack modes | Active |
| [`ENVIRONMENT.md`](./ENVIRONMENT.md) | Environment variables reference | Active |
| [`runbooks/status.md`](./runbooks/status.md) | Current project status | Check frequently |

### Recent Audit Reports (Active Work)
| Document | Purpose | Date | Status |
|----------|---------|------|--------|
| [`PERSISTENCE_HARDENING_REPORT.md`](./PERSISTENCE_HARDENING_REPORT.md) | Master agent synthesis for persistence fix | 2026-04-08 | ✅ Complete |
| [`PERSISTENCE_MAP.md`](./PERSISTENCE_MAP.md) | Data authority map (what's source of truth) | 2026-04-08 | ✅ Complete |
| [`GRADING_HARDENING_FINAL_REPORT.md`](./GRADING_HARDENING_FINAL_REPORT.md) | Query 13 grading fix | 2026-04-08 | ✅ Complete |
| [`QA_VERIFICATION_REPORT.md`](./QA_VERIFICATION_REPORT.md) | QA testing results | 2026-04-08 | ✅ Complete |
| [`PROGRESS_AUDIT_REPORT.md`](./PROGRESS_AUDIT_REPORT.md) | Progress system audit | 2026-04-08 | ✅ Complete |

### Archive
Old documents are in [`archive/`](./archive/) - check dates before using.

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

### Workstream 2: Grading Hardening ✅ COMPLETE
**Status**: Query 13 fix verified and deployed

**Key Documents**:
- [`GRADING_HARDENING_FINAL_REPORT.md`](./GRADING_HARDENING_FINAL_REPORT.md)

### Workstream 3: QA Verification ✅ COMPLETE
**Status**: All scenarios tested and passing

**Key Documents**:
- [`QA_VERIFICATION_REPORT.md`](./QA_VERIFICATION_REPORT.md)

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
- `GRADING_HARDENING_FINAL_REPORT.md` - 2026-04-08
- `QA_VERIFICATION_REPORT.md` - 2026-04-08

### Reference (Stable)
- `DEPLOYMENT.md`
- `DEPLOYMENT_MODES.md`
- `ENVIRONMENT.md`

---

## 📝 For AI Agents

**Before starting work**:
1. Read `AGENTS.md` (working rules)
2. Check `runbooks/status.md` (current state)
3. Read this `INDEX.md` (find relevant docs)
4. Check `CHANGELOG.md` (recent decisions)

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
| 2026-04-08 | Grading hardening complete | Master Agent |

---

**Questions?** Check [`AGENTS.md`](./AGENTS.md) Section 14 for required response format.
