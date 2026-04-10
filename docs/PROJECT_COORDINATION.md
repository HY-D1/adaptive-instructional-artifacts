# Project Coordination & Organization Rules

> **Master Document for Project Structure, File Organization, and Progress Tracking**
> 
> Last Updated: 2026-04-08  
> Status: 🟢 ACTIVE  
> Mandatory Reading: All AI agents, contributors

---

## 📋 Purpose

This document establishes the **mandatory rules** for:
1. **File organization** - Where things belong
2. **Progress tracking** - How to document work
3. **Documentation maintenance** - Keeping docs current
4. **Naming conventions** - Consistent file names
5. **Cleanliness standards** - What to delete, what to keep

**Rule #1**: When in doubt, check this document first.

---

## 🗂️ File Organization Rules

### 1. Documentation Structure (`docs/`)

All documentation lives in `docs/`. No exceptions.

```
docs/
├── INDEX.md                          ← Documentation navigation hub
├── AGENTS.md                         ← AI agent working rules (756 lines)
├── CHANGELOG.md                      ← Progress tracker and decision log
├── PROJECT_COORDINATION.md           ← This file - organization rules
├── DEPLOYMENT.md                     ← Production deployment guide
├── DEPLOYMENT_MODES.md               ← Local vs hosted capabilities
├── ENVIRONMENT.md                    ← Environment variables reference
├── PERSISTENCE_HARDENING_REPORT.md   ← Persistence implementation
├── PERSISTENCE_MAP.md                ← Data authority map
├── PROGRESS_AUDIT_REPORT.md          ← Progress system audit
├── PROGRESS_MODEL.md                 ← Progress data model
├── audit/                            ← Audit reports (minimal)
│   ├── P1_FIXES_SUMMARY.md
│   ├── P2_P3_FIXES_SUMMARY.md
│   ├── PRACTICE_HINTS_LOGGING_AUDIT.md
│   └── SQLITE_NEON_PARITY.md
├── reports/                          ← Test reports (3 files)
│   ├── BANDIT_TEST_REPORT.md
│   ├── BUG_HUNTING_REPORT.md
│   └── PERFORMANCE_BENCHMARK_REPORT.md
├── research/                         ← Research architecture (27 files)
│   ├── PROJECT_OVERVIEW.md
│   ├── RESEARCH_ARCHITECTURE.md
│   ├── LOGGING_SPECIFICATION.md
│   └── ... (see full list in INDEX.md)
└── runbooks/                         ← Operational guides (17 files)
    ├── status.md                     ← CURRENT PROJECT STATUS
    ├── beta-50-student-operations.md
    ├── storage-quota-incident.md
    ├── beta-supervised-launch-packet.md
    └── beta-observations/            ← Student observation forms
```

**🚫 NEVER create these:**
- `docs/progress.md` - Use CHANGELOG.md instead
- `docs/week*-progress.md` - Use runbooks/status.md instead
- `docs/archive/` - Delete old docs, don't archive
- `docs/audit/evidence/` - Temporary artifacts, delete after use
- Root-level `*.md` files - All docs go in `docs/`

---

### 2. Source Code Structure

```
apps/
├── web/                              ← Frontend (Vite + React)
│   ├── src/
│   │   ├── app/
│   │   │   ├── components/           ← React components
│   │   │   ├── lib/                  ← Business logic
│   │   │   │   ├── storage/          ← Storage modules
│   │   │   │   ├── api/              ← API clients
│   │   │   │   └── ml/               ← ML/adaptive logic
│   │   │   └── pages/                ← Page components
│   │   └── index.html
│   └── package.json
└── server/                           ← Backend (Express)
    ├── src/
    │   ├── routes/                   ← API routes
    │   ├── middleware/               ← Auth, CSRF, rate limiting
    │   ├── db/                       ← Database layer
    │   └── scripts/                  ← Export/replay scripts
    └── package.json
```

**Rules:**
- Frontend logic in `apps/web/src/app/lib/`
- Backend routes in `apps/server/src/routes/`
- Database access in `apps/server/src/db/`
- Scripts in `apps/server/src/scripts/`

---

### 3. Test Structure

```
tests/
├── e2e/                              ← Playwright E2E tests
│   ├── integration/                  ← Integration tests
│   └── regression/                   ← Regression tests
└── unit/                             ← Vitest unit tests
    ├── web/                          ← Frontend unit tests
    └── server/                       ← Backend unit tests
```

**Rules:**
- E2E tests: `tests/e2e/**/*.spec.ts`
- Unit tests: `tests/unit/**/*.test.ts` or `*.test.ts` alongside source
- Test utilities: `tests/utils/`

---

### 4. Scripts Structure

```
scripts/
├── verification/                     ← Verification scripts
├── replay/                           ← Replay utilities
├── export/                           ← Export utilities
└── *.mjs, *.ts                      ← Standalone scripts
```

**Rules:**
- One script = one purpose
- Document usage in script header
- Keep scripts small and focused

---

## 📝 Naming Conventions

### Files

| Type | Pattern | Example |
|------|---------|---------|
| Components | PascalCase | `LearningInterface.tsx` |
| Utilities | camelCase | `storageClient.ts` |
| Tests | `*.test.ts` or `*.spec.ts` | `dual-storage.test.ts` |
| Scripts | camelCase or descriptive | `verifyDeployment.mjs` |
| Docs | UPPER_SNAKE_CASE.md | `DEPLOYMENT.md` |
| Audit reports | UPPER_SNAKE_CASE.md | `P1_FIXES_SUMMARY.md` |
| Research docs | UPPER_SNAKE_CASE.md | `PROJECT_OVERVIEW.md` |

### Branches

| Type | Pattern | Example |
|------|---------|---------|
| Features | `feature/description` | `feature/multi-device-sync` |
| Bug fixes | `fix/description` | `fix/query13-grading` |
| Hardening | `harding/description` | `hardening/research-grade-tightening` |
| Hotfixes | `hotfix/description` | `hotfix/auth-rate-limit` |

### Commits

Follow conventional commits:

```
type(scope): description

[optional body]

[optional footer]
```

Types:
- `feat:` New feature
- `fix:` Bug fix
- `docs:` Documentation
- `test:` Tests
- `refactor:` Code refactoring
- `chore:` Maintenance

Examples:
```
fix(storage): Add getAllProblemProgress to hydrateLearner()

docs: Update INDEX.md with audit section
test(persistence): Add progress-persistence tests
chore: Clean up obsolete folders
```

---

## 📊 Progress Tracking Rules

### Current Status: ALWAYS in `docs/runbooks/status.md`

**Rule #2**: All project status must be in `docs/runbooks/status.md`.

This is the **single source of truth** for:
- Current phase
- Completed work
- Blockers
- Next priorities

**🚫 NEVER create:**
- `docs/progress.md`
- `docs/week*-progress.md`  
- `docs/status-*.md`
- Root-level status files

### Change Log: ALWAYS in `docs/CHANGELOG.md`

**Rule #3**: All changes must be documented in `docs/CHANGELOG.md`.

Format:
```markdown
## 2026-04-08 - Brief Description

### Changes
- Change 1 with file reference
- Change 2 with file reference

### Decisions
- Decision made and why

### Next Steps
- What comes next
```

---

## 🧹 Cleanliness Rules

### What to DELETE Immediately

| Category | Examples | Action |
|----------|----------|--------|
| Agent conversation artifacts | `BOSS_AGENT_*.md`, `MASTER_*_DECISION.md` | Delete after work completes |
| Dated audit evidence | `evidence/2026-04-07/*.txt` | Delete after audit |
| Duplicate files | `* 2.md`, `* 2.json` | Delete immediately |
| Empty folders | `playwright-report 2/` | Delete immediately |
| Old test reports | `week5-indicators-test-report.md` | Delete if > 2 weeks old |
| Demo scripts | `2026-03-24-demo.md` | Delete after demo |
| Root-level plans | `PLAN_FIX_*.md` | Move to docs/ or delete after implementation |

### What to KEEP

| Category | Location | Retention |
|----------|----------|-----------|
| Core docs | `docs/*.md` | Permanent |
| Research docs | `docs/research/*.md` | Permanent |
| Active runbooks | `docs/runbooks/*.md` | Until superseded |
| Audit summaries | `docs/audit/*.md` | Permanent (minimal) |
| Test reports | `docs/reports/*.md` | Last 3 versions |
| Student observations | `docs/runbooks/beta-observations/*.md` | Until study completes |

### Cleanup Checklist (Run Weekly)

```bash
# Find duplicate files
find . -name "* 2*" -type f | grep -v node_modules

# Find empty directories
find . -type d -empty | grep -v node_modules | grep -v ".git"

# Find old .DS_Store files
find . -name ".DS_Store" -type f

# Find large folders
du -sh */ | sort -hr | head -10
```

---

## 🔄 Documentation Maintenance Rules

### When to Update Docs

| Trigger | Action |
|---------|--------|
| New feature | Update relevant docs, add to CHANGELOG |
| API change | Update AGENTS.md, DEPLOYMENT.md |
| Bug fix | Update CHANGELOG, relevant runbooks |
| Deployment | Update runbooks/status.md |
| Audit complete | Add minimal summary to docs/audit/ |
| File moved | Update all references, delete old |

### Doc Update Checklist

Before claiming work complete:
- [ ] Update `docs/CHANGELOG.md` with changes
- [ ] Update `docs/runbooks/status.md` if status changed
- [ ] Update `docs/INDEX.md` if new docs added
- [ ] Verify `docs/AGENTS.md` is still accurate
- [ ] Remove any temporary files created during work
- [ ] Run cleanup checklist

---

## ✅ Mandatory Pre-Work Checklist

Before starting ANY work:

1. **Read this file** (`docs/PROJECT_COORDINATION.md`)
2. **Read AGENTS.md** (`docs/AGENTS.md`)
3. **Check current status** (`docs/runbooks/status.md`)
4. **Check changelog** (`docs/CHANGELOG.md`)
5. **Check index** (`docs/INDEX.md`)

---

## ✅ Mandatory Completion Checklist

Before claiming work is complete:

1. **Code verified** (builds pass, tests pass)
2. **CHANGELOG.md updated**
3. **runbooks/status.md updated** (if status changed)
4. **Temporary files deleted**
5. **No duplicate files created**
6. **Commit message follows convention**
7. **Suggested commit provided to user**

---

## 🚨 Prohibited Actions

The following are **NEVER** allowed:

1. 🚫 Creating `docs/progress.md` or week-based progress files
2. 🚫 Creating root-level `*.md` files (use docs/)
3. 🚫 Leaving `* 2` duplicate files
4. 🚫 Creating `docs/archive/` - delete old docs instead
5. 🚫 Leaving agent conversation artifacts in docs/
6. 🚫 Auto-committing or auto-pushing
7. 🚫 Creating dated audit evidence folders
8. 🚫 Inventing file paths or APIs
9. 🚫 Claiming something works without verification
10. 🚫 Making unrelated refactors

---

## 📞 Questions?

If unclear on any rule:
1. Check this document first
2. Check `docs/AGENTS.md`
3. Check `docs/INDEX.md`
4. Ask the user for clarification

---

**Document Owner**: Project maintainers  
**Update Frequency**: As needed, minimum weekly  
**Last Full Review**: 2026-04-08
