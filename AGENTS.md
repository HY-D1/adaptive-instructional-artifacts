# AGENTS.md — Adaptive Instructional Artifacts

## Project Status

| Component | Status | Date |
|-----------|--------|------|
| Week 2 MVP | ✅ Complete | 2026-02-16 |
| Build Gate | ✅ Pass | dist/app/ ready |
| E2E Tests | ✅ 140 tests | All @weekly tagged |
| Demo Artifacts | ✅ Generated | dist/weekly-demo/ |
| Documentation | ✅ Consolidated | 3 canonical files + AGENTS.md |
| Deployment | 📋 Local only | No CI/CD yet |

### Recent Commits

| Commit | Description |
|--------|-------------|
| `[PENDING]` | fix: comprehensive bug audit - 17 bugs fixed (5 critical + 3 high + 4 medium + 5 low) |
| `17391a7` | Improve PDF retrieval with SQL keywords |
| `1a3b268` | Persist hints when navigating between pages |
| `16e3a5c` | Track problem correctness and show solved status |

---

## Quick Commands

```bash
# Development
npm run dev                      # Start dev server
npm run build                    # Production build → dist/app/

# Testing
npm run test:e2e:weekly          # Run 140 Week 2 E2E tests
npm run demo:weekly              # Generate demo artifacts
npm run verify:weekly            # Full verification gate

# Data/Index
npm run pdf:index               # Build PDF search index
npm run check:concept-map       # Validate SQL-Engage concept mapping
npm run replay:gate             # Verify replay checksums
```

---

## Test Coverage Policy

### Rule: Every Feature Needs Tests

When adding/modifying any feature, you **MUST**:

1. **Add tests for the new feature** in `apps/web/tests/`
2. **Tag with `@weekly`** for Week 2 scope features
3. **Cover these cases**:
   - Happy path (normal usage)
   - Edge cases (empty input, boundary values)
   - Error cases (invalid input, failure modes)
   - State transitions (if applicable)

### Test File Naming

```
week2-{feature-name}.spec.ts     # New Week 2 feature
critical-bugs-fixed.spec.ts      # Regression tests
{feature}.spec.ts                # General feature
```

### Test Template

```typescript
import { expect, test } from '@playwright/test';

test.describe('@weekly Feature Name', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('happy path: basic functionality works', async ({ page }) => {
    // Arrange
    // Act
    // Assert
  });

  test('edge case: empty/invalid input handled', async ({ page }) => {
    // Test boundary conditions
  });

  test('error case: failure mode is graceful', async ({ page }) => {
    // Test error handling
  });
});
```

### Current Test Inventory

| Test File | Count | Coverage |
|-----------|-------|----------|
| critical-bugs-fixed.spec.ts | 25 | 14 critical bug regression tests |
| high-priority-bugs-fixed.spec.ts | 29 | 12 high priority bug regression tests |
| medium-priority-bugs-fixed.spec.ts | 33 | 23 medium priority bug regression tests |
| weekly-hint-ladder.spec.ts | 20 | Hint escalation L1→L2→L3→Explanation |
| weekly-textbook.spec.ts | 24 | My Notes generation, concept tracking |
| weekly-concept-coverage.spec.ts | 24 | Concept map UI, mastery tracking |
| weekly-policy-comparison.spec.ts | 14 | A/B policy replay, session export |
| weekly-data-integrity.spec.ts | 46 | Event logging, localStorage, validation |
| hint-persistence.spec.ts | 4 | Hint state across navigation |
| weekly-*.spec.ts (others) | 8+ | PDF upload, LLM health, smoke tests |
| **Total** | **140+** | — |

---

## Commit Guidelines

### Clean Commit Rules

1. **One logical change per commit**
2. **Include tests with the feature** (same commit or immediate follow-up)
3. **Use conventional commits format**:
4. **Default commit suggestions to clean + simple** unless user asks for detailed body/trailers.

```
feat: add hint ladder escalation logic

- Implement L1→L2→L3 progression
- Add SQL-Engage subtype mapping
- Include 20 E2E tests for edge cases

Refs: week2-progress.md
```

### Commit Types

| Type | Use For |
|------|---------|
| `feat` | New features |
| `fix` | Bug fixes |
| `test` | Test additions/modifications |
| `docs` | Documentation updates |
| `refactor` | Code restructuring |
| `chore` | Maintenance, deps, config |

### Pre-Commit Checklist

```bash
npm run build                    # Must pass
npm run test:e2e:weekly          # Should pass (or note known failures)
npm run demo:weekly              # Artifacts generated
```

---

## Deployment Status

### Current State: Local Development Only

| Aspect | Status | Notes |
|--------|--------|-------|
| Build | ✅ Working | `dist/app/` generated |
| Local Server | ✅ Dev + Preview | Vite dev + `vite preview` |
| CI/CD | 📋 Not configured | No GitHub Pages/Netlify/Vercel |
| Production URL | 📋 N/A | — |

### Build Output

```
dist/
├── app/                    # Web app build
│   ├── index.html
│   └── assets/
│       ├── index-{hash}.js
│       └── index-{hash}.css
├── week2-demo/            # Demo artifacts
│   ├── export.json        # Session data
│   └── screenshots/       # Test evidence
└── pdf-index/             # Search index
```

### Manual Deployment (if needed)

```bash
# Build for production
npm run build

# Preview locally
npx vite preview --config apps/web/vite.config.ts

# Deploy dist/app/ to static host (manual)
# - GitHub Pages: push to gh-pages branch
# - Netlify: netlify deploy --prod --dir=dist/app
# - Vercel: vercel --prod dist/app
```

---

## Architecture Quick Ref

### Key Directories

```
apps/web/src/
├── app/
│   ├── components/        # React components
│   │   ├── HintSystem.tsx
│   │   ├── ResearchDashboard.tsx
│   │   └── ErrorBoundary.tsx
│   ├── pages/             # Route pages
│   │   ├── LearningInterface.tsx
│   │   └── TextbookPage.tsx
│   ├── lib/               # Business logic
│   │   ├── adaptive-orchestrator.ts
│   │   ├── content-generator.ts
│   │   ├── retrieval-bundle.ts
│   │   └── storage.ts
│   ├── data/              # Static data
│   │   ├── problems.ts    # 32 SQL problems
│   │   └── sql-engage.ts  # Hint dataset
│   └── hooks/             # Custom React hooks
├── tests/                 # E2E tests
└── server/                # Dev server utilities
```

### Data Flow

```
SQL Error → normalizeSqlErrorSubtype() → SQL-Engage Anchor
                                              ↓
User Request Hint ← Progressive Hint ← HintSystem
        ↓
L3 Hint Exhausted → Escalate → generateUnitFromLLM()
        ↓
Retrieval Bundle → PDF Chunks + SQL-Engage + Template
        ↓
Explanation View → textbook_add Event → My Notes
```

---

## Documentation Files Reference

| File | Purpose | Update When |
|------|---------|-------------|
| `README.md` | Project overview, quick start, user guide | Public-facing changes, setup changes |
| `AGENTS.md` | **This file** — Agent guidelines (⚠️ DO NOT COMMIT) | Local context only — never commit to git |
| `docs/README.md` | Research vision, 6 core components, weekly roadmap | Research direction changes, milestones |
| `docs/progress.md` | Component architecture, implementation details | Architecture changes, component updates |
| `docs/weekly-progress.md` | **Detailed runbook** — tasks, gates, checkpoint log | **Every task/issue/feature** (see below) |

### File Usage Guidelines

- **weekly-progress.md** — Daily working log. Add checkpoint entries for every completed task, bug fix, or feature.
- **week2_progress.md** — Redirect-only stub. **Do not append checkpoints here**.
- **progress.md** — System architecture. Update when components change or new subsystems added.
- **README.md** (root) — User-facing. Update for setup changes or user workflow changes.
- **docs/README.md** — Research narrative. Update for vision changes or milestone completions.

---

## Progress Update Policy

### Update After EVERY Change

**You MUST update `docs/weekly-progress.md` after:**
- ✅ Completing a task from "Next Steps"
- ✅ Fixing a bug (add checkpoint log entry)
- ✅ Adding a feature (add checkpoint log entry)
- ✅ Passing/failing a gate (update gate status)
- ✅ Changing test count or coverage
- ✅ Updating dependencies or tooling

**Never write progress checkpoints to `docs/week2_progress.md`.**

### Checkpoint Log Entry Template

```markdown
### YYYY-MM-DDTHH:MM:SS-08:00 - Brief Description

- Current status: `PASS` or `IN_PROGRESS` or `BLOCKED`
- Evidence (what changed):
  - `file/path.ts:line-range` -> What was done
  - Build: `PASS` / `FAIL`
  - Tests: `X passed` / `Y failed`
- Bug Fixes Applied (if any):
  - BUG N: Description
- Next smallest fix:
  - What to do next
```

### Update This File (AGENTS.md) When

- Project status table changes (test count, deployment status)
- New commit summaries to add
- New architectural patterns or policies
- After running `/compact` (add compacted summary)

---

## Compact Context Updates

### After Running `/compact`

When chat context is compacted with `/compact`:

1. **Add a "Compact Summary" entry** to `docs/weekly-progress.md` checkpoint log
2. **Summarize what was accomplished** before the compact
3. **Note any ongoing work** that needs to continue
4. **Update AGENTS.md** if status changed

### Compact Summary Template

```markdown
### YYYY-MM-DDTHH:MM:SS-08:00 - Compact Summary

- **Context compacted** — Summary of work before compact:
  - Features completed: X, Y, Z
  - Bugs fixed: A, B
  - Tests added: N tests
  - Current blockers (if any)
- **Continuing work on:** [what's next]
- **Status:** [PASS / IN_PROGRESS / BLOCKED]
```

---

## Updating This File

**When to update AGENTS.md:**
- After completing a feature milestone
- When test count changes significantly
- When deployment status changes
- When new architectural patterns are introduced
- **After running `/compact`** to summarize context

**Keep in sync with:**
- `docs/weekly-progress.md` — detailed runbook with checkpoint logs
- `docs/README.md` — project overview and research vision
- `docs/progress.md` — component architecture details

---

## Development Workflow

### Starting New Work

1. Check `docs/weekly-progress.md` for current status
2. Identify next task from "Next Steps" section
3. **Write/update tests first** (TDD approach)
4. Implement feature
5. Run verification: `npm run verify:weekly`
6. **Update progress docs** (REQUIRED — see below)
7. Commit with clean message

### Progress Update Checklist (REQUIRED)

After every task/feature/fix:

```bash
# 1. Add checkpoint log entry to weekly-progress.md
#    - Timestamp, status, evidence, next steps

# 2. Update "Next Steps" section — mark completed, add new

# 3. If architecture changed, update docs/progress.md

# 4. If status changed, update AGENTS.md project status table

# 5. Commit docs updates (can be combined with feature commit)
```

### Commit Order

1. **Code + Tests** (feature implementation)
2. **Progress docs** (checkpoint log entry)
3. **AGENTS.md** (if status changed)

### Before Asking for Help

- Run: `npm run build && npm run test:e2e:weekly`
- Check: `docs/weekly-progress.md` for known issues
- Check: This file for current status
- Note: Specific test failures with error messages

---

---

## ⚠️ CRITICAL RULES

### 1. Agent Files Stay Out of Git

**AGENTS.md and all agent/LLM files are in `.gitignore` and must NEVER be committed.**

This file (`AGENTS.md`) contains:
- Temporary context summaries
- Agent-specific instructions  
- Working notes not intended for the repo

**If you see this file shown as modified in `git status`, DO NOT commit it.**

### 2. NEVER Auto-Commit — Suggest Only

**I will NEVER run `git commit` automatically.**
I will default commit suggestions to concise, clean messages.

When work is ready:
1. I will show you a **commit suggestion** (message + files)
2. You review and decide if/what to commit
3. You run the commit yourself

**Example suggestion format:**
```bash
# Suggested commit:
git add <files>
git commit -m "type: description

- Change 1
- Change 2"

# Or run this to see diff first:
git diff --staged
```

### 3. Code Style — Match Existing Patterns

**Follow existing code style — match patterns in surrounding code.**

- Read nearby code before writing new code
- Match indentation, naming conventions, and structure
- When in doubt, follow the dominant pattern in the file
- Don't introduce new style without explicit user direction

### 4. Dependencies — Ask First

**Check with user before adding new npm packages.**

- Always ask permission before installing new dependencies
- Explain why the package is needed
- Suggest alternatives if applicable
- Prefer built-in solutions when possible

### 5. Test Data — Never Commit Secrets

**Don't commit real user data or API keys.**

- Use mock/fake data in tests and examples
- Keep API keys and secrets in environment variables (`.env` files, never committed)
- Sanitize any data exports before committing
- If unsure, ask the user

### 6. Parallel Subagent Execution — Divide and Conquer

**Divide large problems into independent sub-parts and run subagents in parallel.**

When facing a large or complex task:

1. **Decompose the Problem**
   - Break into small, independent sub-tasks
   - Each sub-task should be solvable without coordination
   - Avoid dependencies between sub-tasks where possible

2. **Assign to Subagents in Parallel**
   - Spawn multiple `coder` subagents simultaneously
   - Give each subagent a single, focused task
   - Include all necessary context in the prompt
   - Don't assume subagents can see each other's work

3. **Prevent Collisions**
   - Ensure subagents work on different files/modules
   - If working on same file, assign non-overlapping line ranges
   - Use clear file naming to avoid conflicts
   - Coordinate through this file (AGENTS.md), not through git

4. **Merge Results**
   - Collect results from all subagents
   - Integrate changes sequentially in main context
   - Verify no conflicts after integration
   - Run tests to ensure parallel work didn't break anything

**Example pattern:**
```
Large Task: Refactor 3 modules
├── Subagent 1: Refactor module A
├── Subagent 2: Refactor module B  
└── Subagent 3: Refactor module C
     
↓ (parallel execution)
     
Main context: Merge results, run tests
```

---

*Last updated: 2026-02-16T17:00:00-08:00*

---

## Bug Fix Audit Summary (2026-02-16)

### Severity Breakdown

| Level | Count | Issues Fixed |
|-------|-------|--------------|
| 🔴 Critical | 5 | Floating-point epsilon, stale closure, session validation, empty query, race condition |
| 🟠 High | 3 | Monaco disposal, SQL comment parsing, hint flow reset |
| 🟡 Medium | 4 | CSV newlines, PDF citation NaN, hint refs reset, conceptIds merge |
| 🟢 Low | 5 | Duplicate code, simplification, dead code, test helpers |
| **Total** | **17** | All tests passing (116/116) |


**AGENTS.md and all agent/LLM files are in `.gitignore` and must NEVER be committed.**

This file (`AGENTS.md`) contains:
- Temporary context summaries
- Agent-specific instructions  
- Working notes not intended for the repo

**If you see this file shown as modified in `git status`, DO NOT commit it.**

### 2. NEVER Auto-Commit — Suggest Only

**I will NEVER run `git commit` automatically.**

When work is ready:
1. I will show you a **commit suggestion** (message + files)
2. You review and decide if/what to commit
3. You run the commit yourself

**Example suggestion format:**
```bash
# Suggested commit:
git add <files>
git commit -m "type: description

- Change 1
- Change 2"

# Or run this to see diff first:
git diff --staged
```

---

*Last updated: 2026-02-16T16:15:00-08:00*
