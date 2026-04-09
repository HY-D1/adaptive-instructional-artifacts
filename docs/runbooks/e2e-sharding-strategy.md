# E2E Sharding Strategy

**Date**: 2026-04-09  
**Purpose**: Parallel test execution without state corruption  

---

## Core Principle

**NEVER increase `workers` in playwright.config.ts.**

The config intentionally uses `workers: 1` because:
- Auth tests share localStorage state
- Parallel workers cause cross-test pollution
- Stateful tests (persistence, multi-device) require isolation

**Solution**: Parallel shards across CI jobs, not within a job.

---

## Shard Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        CI Pipeline                               │
│                                                                  │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  │
│  │   SHARD 1       │  │   SHARD 2       │  │   SHARD 3       │  │
│  │   (Stateless)   │  │   (UX/Regress)  │  │   (Stateful)    │  │
│  │                 │  │                 │  │   SERIAL        │  │
│  │  workers: 1     │  │  workers: 1     │  │  workers: 1     │  │
│  │  ~30s           │  │  ~2min          │  │  ~5min          │  │
│  │                 │  │                 │  │                 │  │
│  │ • deployed-smoke│  │ • ux-bugs-*     │  │ • auth-smoke    │  │
│  │ • vercel-checks │  │ • critical-bugs │  │ • multi-device  │  │
│  │ • health-routes │  │ • role-system   │  │ • scenarios     │  │
│  └────────┬────────┘  └────────┬────────┘  └────────┬────────┘  │
│           │                    │                    │          │
│           └────────────────────┼────────────────────┘          │
│                                ▼                               │
│                        ┌───────────────┐                       │
│                        │   MERGE       │                       │
│                        │   RESULTS     │                       │
│                        └───────────────┘                       │
└─────────────────────────────────────────────────────────────────┘
```

---

## Shard Details

### Shard 1: Stateless Smoke (Fast)

| Property | Value |
|----------|-------|
| **Files** | `deployed-smoke.spec.ts`, `vercel-deployment.spec.ts`, `smoke.spec.ts` |
| **Auth Required** | No |
| **Workers** | 1 |
| **Parallel Safe** | Yes (no shared state) |
| **Timeout** | 2 minutes |

**CI Command**:
```bash
PLAYWRIGHT_BASE_URL="$PREVIEW_URL" \
npx playwright test \
  tests/e2e/regression/deployed-smoke.spec.ts \
  tests/e2e/vercel-deployment.spec.ts \
  --reporter=line
```

### Shard 2: UX Regressions (Medium)

| Property | Value |
|----------|-------|
| **Files** | `ux-bugs-*.spec.ts`, `critical-bugs.spec.ts`, `role-system.spec.ts` |
| **Auth Required** | Via `addInitScript` (local profile seeding) |
| **Workers** | 1 |
| **Parallel Safe** | Yes (isolated auth per test) |
| **Timeout** | 5 minutes |

**CI Command**:
```bash
PLAYWRIGHT_BASE_URL="$PREVIEW_URL" \
npx playwright test \
  --grep "@ux-bugs|@critical" \
  --reporter=line
```

### Shard 3: Stateful Persistence (Serial)

| Property | Value |
|----------|-------|
| **Files** | `deployed-auth-smoke.spec.ts`, `student-multi-device-persistence.spec.ts`, `scenario-*.spec.ts` |
| **Auth Required** | Real JWT via `setup:auth` |
| **Workers** | 1 |
| **Parallel Safe** | **NO** - Must run serially |
| **Timeout** | 10 minutes |

**CI Command**:
```bash
PLAYWRIGHT_BASE_URL="$PREVIEW_URL" \
PLAYWRIGHT_API_BASE_URL="$PREVIEW_API_URL" \
npx playwright test \
  --project=chromium:auth \
  --reporter=line
```

---

## Implementation Guide

### GitHub Actions Matrix

```yaml
strategy:
  matrix:
    shard:
      - id: 1
        name: stateless-smoke
        grep: '@deployed-smoke|@vercel'
        project: chromium
      - id: 2
        name: ux-regressions
        grep: '@ux-bugs|@critical'
        project: chromium
      - id: 3
        name: stateful-auth
        grep: '@deployed-auth-smoke'
        project: chromium:auth
        needs-setup-auth: true

steps:
  - name: Run E2E Shard
    run: |
      if [ "${{ matrix.shard.needs-setup-auth }}" = "true" ]; then
        npm run test:e2e:setup-auth:deployed
      fi
      
      npx playwright test \
        -c playwright.config.ts \
        --project=${{ matrix.shard.project }} \
        --grep="${{ matrix.shard.grep }}" \
        --reporter=line
    env:
      PLAYWRIGHT_BASE_URL: ${{ env.PREVIEW_URL }}
      PLAYWRIGHT_API_BASE_URL: ${{ env.PREVIEW_API_URL }}
      E2E_TEST_SEED_SECRET: ${{ secrets.E2E_TEST_SEED_SECRET }}
```

### Environment Isolation Per Shard

| Shard | Auth State Dir | Output Dir |
|-------|---------------|------------|
| 1 | N/A | `test-results/shard-1/` |
| 2 | N/A | `test-results/shard-2/` |
| 3 | `playwright/.auth-shard-3/` | `test-results/shard-3/` |

### Shard-Safe Auth Setup

```typescript
// playwright.config.ts modification for sharding
const SHARD_ID = process.env.PLAYWRIGHT_SHARD_ID || 'default';
const AUTH_DIR = `playwright/.auth-${SHARD_ID}/`;

projects: [
  {
    name: 'setup:auth',
    use: {
      storageState: `${AUTH_DIR}/student.json`,
    },
  },
  {
    name: 'chromium:auth',
    dependencies: ['setup:auth'],
    use: {
      storageState: `${AUTH_DIR}/student.json`,
    },
  },
]
```

---

## Performance Impact

### Before (Serial)
```
Total E2E time: ~15 minutes
All tests in one job
Workers: 1
```

### After (Sharded)
```
Shard 1: ~30 seconds  ──┐
Shard 2: ~2 minutes   ──┼──► Wall clock: ~5 minutes (max of shard 3)
Shard 3: ~5 minutes   ──┘
```

**Improvement**: 3x faster wall-clock time

---

## Safety Rules

### DO
- ✅ Run shards in parallel CI jobs
- ✅ Use isolated auth directories per shard
- ✅ Keep `workers: 1` in all configs
- ✅ Tag tests with `@shard-N` for explicit routing

### DON'T
- ❌ Increase `workers` above 1
- ❌ Share auth state between shards
- ❌ Run stateful tests in parallel
- ❌ Mix auth-backed and initScript-auth tests in same shard

---

## Test Tagging Convention

Add shard tags to test descriptors:

```typescript
// Shard 1: Stateless
test.describe('@shard-1 @deployed-smoke Public endpoints', () => {
  test('health check', async () => { });
});

// Shard 2: UX Regressions
test.describe('@shard-2 @ux-bugs Note saving', () => {
  test('saves to textbook', async () => { });
});

// Shard 3: Stateful (default for auth tests)
test.describe('@shard-3 @deployed-auth-smoke Persistence', () => {
  test('survives browser restart', async () => { });
});
```

---

## Troubleshooting

### "Cookie jar corrupted" errors
**Cause**: Shared auth directory between parallel runs  
**Fix**: Use `PLAYWRIGHT_SHARD_ID` to isolate auth directories

### "Browser context closed" in shard 3
**Cause**: Previous shard cleaned up shared resources  
**Fix**: Each shard should use independent output directories

### Slow shard 3
**Cause**: Serial execution of many auth tests  
**Fix**: Split shard 3 further by test type (auth vs scenarios)

---

## Related Documents

- [E2E Inventory](./e2e-inventory.md) - Test catalog with shard assignments
- [E2E Auth Seeding](./e2e-auth-seeding.md) - Deterministic credentials
- [Harness Gate Matrix](./harness-gate-matrix.md) - CI integration

---

*Last Updated: 2026-04-09*
