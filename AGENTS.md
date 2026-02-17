# AGENTS.md — Adaptive Instructional Artifacts

## Project Status

| Component | Status | Date |
|-----------|--------|------|
| Week 2 MVP | ✅ Complete | 2026-02-16 |
| Build Gate | ✅ Pass | dist/app/ ready |
| E2E Tests | ✅ 140 tests | All @week2 tagged |
| Demo Artifacts | ✅ Generated | dist/week2-demo/ |
| Documentation | ✅ Consolidated | 3 canonical files + AGENTS.md |
| Deployment | 📋 Local only | No CI/CD yet |

### Recent Commits

| Commit | Description |
|--------|-------------|
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
npm run test:e2e:week2          # Run 140 Week 2 E2E tests
npm run demo:week2              # Generate demo artifacts
npm run verify:week2            # Full verification gate

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
2. **Tag with `@week2`** for Week 2 scope features
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

test.describe('@week2 Feature Name', () => {
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
| week2-hint-ladder.spec.ts | 20 | Hint escalation L1→L2→L3→Explanation |
| week2-textbook.spec.ts | 24 | My Notes generation, concept tracking |
| week2-concept-coverage.spec.ts | 24 | Concept map UI, mastery tracking |
| week2-policy-comparison.spec.ts | 14 | A/B policy replay, session export |
| week2-data-integrity.spec.ts | 46 | Event logging, localStorage, validation |
| hint-persistence.spec.ts | 4 | Hint state across navigation |
| week2-*.spec.ts (others) | 8+ | PDF upload, LLM health, smoke tests |
| **Total** | **140** | — |

---

## Commit Guidelines

### Clean Commit Rules

1. **One logical change per commit**
2. **Include tests with the feature** (same commit or immediate follow-up)
3. **Use conventional commits format**:

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
npm run test:e2e:week2          # Should pass (or note known failures)
npm run demo:week2              # Artifacts generated
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

## Updating This File

**When to update AGENTS.md:**
- After completing a feature milestone
- When test count changes significantly
- When deployment status changes
- When new architectural patterns are introduced

**Keep in sync with:**
- `docs/week2_progress.md` — detailed runbook
- `docs/README.md` — project overview
- `docs/progress.md` — component architecture

---

## Development Workflow

### Starting New Work

1. Check `docs/week2_progress.md` for current status
2. Identify next task from "Next Steps" section
3. **Write/update tests first** (TDD approach)
4. Implement feature
5. Run verification: `npm run verify:week2`
6. Update relevant docs (this file, progress.md)
7. Commit with clean message

### Before Asking for Help

- Run: `npm run build && npm run test:e2e:week2`
- Check: `docs/week2_progress.md` for known issues
- Check: This file for current status
- Note: Specific test failures with error messages

---

*Last updated: 2026-02-16*
