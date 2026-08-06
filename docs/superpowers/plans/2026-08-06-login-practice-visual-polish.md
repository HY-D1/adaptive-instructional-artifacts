# Login + Practice Visual Polish ("Minimal Terminal") Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the existing `atlas.css` token system with a small badge/label vocabulary, apply it to the login page and the practice page's problem header, and give the practice page's Monaco SQL editor a custom theme — all visual-only, zero change to auth/execution/grading logic.

**Architecture:** Generalize one already-dead CSS class (`.atlas-gateway__status`, unused since an earlier commit removed its only JSX usage) into a reusable `.atlas-badge` utility, add one new `.atlas-label` utility that mirrors the existing `.atlas-brand__descriptor` values, and add one new `.atlas-panel-border` utility. Register a custom Monaco theme via `@monaco-editor/react`'s `beforeMount` hook using literal hex values copied from `atlas.css`'s existing dark-mode tokens (Monaco's theme API doesn't understand CSS custom properties).

**Tech Stack:** React, `@monaco-editor/react` / `monaco-editor`, Playwright (`@no-external` tag), the existing `atlas.css` token system.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-08-06-login-practice-visual-polish-design.md`.
- No change to auth logic, redirects, CSRF/cookie behavior, accessible names, or existing test IDs.
- No change to SQL execution, grading, hint, or results logic.
- No new dependencies, fonts, or assets copied from any reference image.
- No change to backend, database, readiness contract, or offline sync behavior.
- Branch: `front_end_test` only. No push, no merge to `main`, without explicit approval.
- Every task ends with `npm run test:e2e:no-external -- <that task's spec file> --reporter=line` passing, run from the repo root of the `front_end_test` worktree (`/Users/harrydai/.config/superpowers/worktrees/adaptive-instructional-artifacts/front_end_test`).

---

### Task 1: Badge utility + "Backend connected" status on the login page

**Files:**
- Modify: `apps/web/src/styles/atlas.css:313-330` (rename/generalize), `apps/web/src/styles/atlas.css:655-657` (delete dead rule)
- Modify: `apps/web/src/app/pages/AuthPage.tsx:199-206`
- Test: `tests/e2e/login-practice-visual-polish.spec.ts` (new file)

**Interfaces:**
- Produces: CSS classes `.atlas-badge`, `.atlas-badge__dot`, `.atlas-badge__dot--cobalt`, `.atlas-badge__dot--emerald`, `.atlas-badge__dot--amber`, `.atlas-badge__dot--red`.

- [ ] **Step 1: Write the failing test**

Create `tests/e2e/login-practice-visual-polish.spec.ts`:

```ts
import { expect, test, type Page } from '@playwright/test';

async function setTheme(page: Page, theme: 'light' | 'dark') {
  await page.evaluate((next) => {
    document.documentElement.classList.toggle('dark', next === 'dark');
  }, theme);
}

test.describe('@no-external Login + Practice Minimal Terminal polish', () => {
  test('login heading shows a connected status badge in light and dark mode', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible({ timeout: 10000 });

    for (const theme of ['light', 'dark'] as const) {
      await setTheme(page, theme);
      const badge = page.locator('.atlas-badge', { hasText: 'Backend connected' });
      await expect(badge).toBeVisible();
      await expect(badge.locator('.atlas-badge__dot--emerald')).toBeVisible();
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:e2e:no-external -- tests/e2e/login-practice-visual-polish.spec.ts --reporter=line`
Expected: FAIL — no element matching `.atlas-badge` exists yet.

- [ ] **Step 3: Generalize the CSS in `apps/web/src/styles/atlas.css`**

Replace the existing block at lines 313-330:

```css
.atlas-gateway__status {
  display: inline-flex;
  align-items: center;
  gap: 0.55rem;
  color: var(--atlas-ink-soft);
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 0.73rem;
  font-weight: 650;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.atlas-gateway__status > span {
  width: 0.52rem;
  height: 0.52rem;
  background: var(--atlas-emerald);
  border-radius: 50%;
  box-shadow: 0 0 0 4px var(--atlas-emerald-soft);
}
```

with:

```css
.atlas-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.55rem;
  color: var(--atlas-ink-soft);
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 0.73rem;
  font-weight: 650;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.atlas-badge__dot {
  width: 0.52rem;
  height: 0.52rem;
  border-radius: 50%;
  flex-shrink: 0;
}

.atlas-badge__dot--cobalt { background: var(--atlas-cobalt); box-shadow: 0 0 0 4px var(--atlas-cobalt-soft); }
.atlas-badge__dot--emerald { background: var(--atlas-emerald); box-shadow: 0 0 0 4px var(--atlas-emerald-soft); }
.atlas-badge__dot--amber { background: var(--atlas-amber); box-shadow: 0 0 0 4px var(--atlas-amber-soft); }
.atlas-badge__dot--red { background: var(--atlas-red); box-shadow: 0 0 0 4px var(--atlas-red-soft); }
```

Then delete the now-dead mobile rule at lines 655-657 (inside the `@media (max-width: 767px)` block):

```css
  .atlas-gateway__status {
    display: none;
  }
```

(Delete just those three lines; leave the rest of that media block untouched.)

- [ ] **Step 4: Add the badge to `apps/web/src/app/pages/AuthPage.tsx`**

At line 199, the render currently starts:

```tsx
        <div className="atlas-gateway-heading">
          <h2 className="text-2xl font-bold text-gray-900">
```

Change to:

```tsx
        <div className="atlas-gateway-heading">
          <span className="atlas-badge">
            <span className="atlas-badge__dot atlas-badge__dot--emerald" aria-hidden="true" />
            Backend connected
          </span>
          <h2 className="text-2xl font-bold text-gray-900">
```

(This JSX is only reached once `AUTH_ENABLED` is true — the `!AUTH_ENABLED` branch above it returns early — so "Backend connected" is always accurate here, not decorative.)

- [ ] **Step 5: Run test to verify it passes**

Run: `npm run test:e2e:no-external -- tests/e2e/login-practice-visual-polish.spec.ts --reporter=line`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/styles/atlas.css apps/web/src/app/pages/AuthPage.tsx tests/e2e/login-practice-visual-polish.spec.ts
git commit -m "feat(web): add atlas-badge utility and login status badge"
```

---

### Task 2: Label + border utilities on the practice page's problem header

**Files:**
- Modify: `apps/web/src/styles/atlas.css` (append new utilities)
- Modify: `apps/web/src/app/pages/LearningInterface.tsx:2612`, `:2616-2618`
- Test: `tests/e2e/login-practice-visual-polish.spec.ts` (append)

**Interfaces:**
- Produces: CSS classes `.atlas-label`, `.atlas-panel-border`.
- Consumes: none (independent of Task 1).

- [ ] **Step 1: Write the failing test**

Add these two helpers at the top level of `tests/e2e/login-practice-visual-polish.spec.ts`, alongside `setTheme` (not nested inside `test.describe`):

```ts
async function setupStudentProfile(page: Page, name: string) {
  await page.addInitScript((userName) => {
    localStorage.setItem('sql-adapt-user-profile', JSON.stringify({
      id: `student-${userName.toLowerCase().replace(/\s+/g, '-')}`,
      name: userName,
      role: 'student',
      createdAt: Date.now(),
    }));
    localStorage.setItem('sql-adapt-welcome-seen', 'true');
  }, name);
}

async function goToPractice(page: Page) {
  await page.goto('/practice');
  await expect(page.getByRole('heading', { name: 'Practice SQL', exact: true })).toBeVisible({ timeout: 10000 });
}
```

Then append this test inside the existing `test.describe` block:

```ts
  test('practice problem header uses the atlas label style inside a bordered panel', async ({ page }) => {
    await setupStudentProfile(page, 'MinimalTerminalTester');
    await goToPractice(page);

    for (const theme of ['light', 'dark'] as const) {
      await setTheme(page, theme);
      const label = page.locator('.atlas-label', { hasText: /Problem \d+ of \d+/ });
      await expect(label).toBeVisible();
      const panel = page.locator('.atlas-panel-border').first();
      await expect(panel).toBeVisible();
    }
  });
```

(`setupStudentProfile` / `goToPractice` are the same pattern already used in `tests/e2e/profile-id-validation-simulation.spec.ts` — kept local to this file rather than shared, matching this codebase's existing per-spec-file convention.)

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:e2e:no-external -- tests/e2e/login-practice-visual-polish.spec.ts --reporter=line`
Expected: FAIL — `.atlas-label` and `.atlas-panel-border` don't exist yet.

- [ ] **Step 3: Add the CSS utilities**

Append to `apps/web/src/styles/atlas.css` (after the `.atlas-badge__dot--red` rule added in Task 1):

```css
.atlas-label {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 0.69rem;
  font-weight: 650;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--atlas-ink-soft);
}

.atlas-panel-border {
  border: 1px solid var(--atlas-line);
}
```

- [ ] **Step 4: Apply the classes in `apps/web/src/app/pages/LearningInterface.tsx`**

At line 2612, change:

```tsx
                <Card className="p-6">
```

to:

```tsx
                <Card className="p-6 atlas-panel-border">
```

At lines 2616-2618, change:

```tsx
                      <span className="text-sm text-gray-500 font-medium block">
                        Problem {currentProblemNumber} of {totalProblems}
                      </span>
```

to:

```tsx
                      <span className="atlas-label block">
                        Problem {currentProblemNumber} of {totalProblems}
                      </span>
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm run test:e2e:no-external -- tests/e2e/login-practice-visual-polish.spec.ts --reporter=line`
Expected: PASS (both tests)

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/styles/atlas.css apps/web/src/app/pages/LearningInterface.tsx tests/e2e/login-practice-visual-polish.spec.ts
git commit -m "feat(web): add atlas-label/atlas-panel-border and apply to practice header"
```

---

### Task 3: Custom Monaco theme for the SQL editor

**Files:**
- Modify: `apps/web/src/app/components/features/sql/SQLEditor.tsx:1-10` (import), `:155-165` (add handler), `:536-542` (Editor props)
- Test: `tests/e2e/login-practice-visual-polish.spec.ts` (append)

**Interfaces:**
- Produces: a Monaco theme registered under the name `'atlas-console'`.
- Consumes: none (independent of Tasks 1-2).

- [ ] **Step 1: Write the failing test**

Append to `tests/e2e/login-practice-visual-polish.spec.ts`:

```ts
  test('practice editor uses the custom atlas-console theme in both app light and dark mode', async ({ page }) => {
    await setupStudentProfile(page, 'EditorThemeTester');
    await goToPractice(page);
    await page.waitForSelector('.monaco-editor', { timeout: 10000 });

    for (const theme of ['light', 'dark'] as const) {
      await setTheme(page, theme);
      const bg = await page.locator('.monaco-editor-background').first()
        .evaluate((el) => getComputedStyle(el).backgroundColor);
      expect(bg).toBe('rgb(20, 34, 56)'); // #142238, the atlas-console theme background
    }
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:e2e:no-external -- tests/e2e/login-practice-visual-polish.spec.ts --reporter=line`
Expected: FAIL — background color is still Monaco's stock `vs-dark` value (`rgb(30, 30, 30)`), not `rgb(20, 34, 56)`.

- [ ] **Step 3: Register and use the custom theme in `apps/web/src/app/components/features/sql/SQLEditor.tsx`**

Add to the imports (near the existing `import type { editor } from 'monaco-editor';` at the top of the file):

```tsx
import type { Monaco } from '@monaco-editor/react';
```

Add a new handler next to `handleEditorDidMount` (around line 155):

```tsx
  const handleEditorBeforeMount = (monacoInstance: Monaco) => {
    monacoInstance.editor.defineTheme('atlas-console', {
      base: 'vs-dark',
      inherit: true,
      rules: [
        { token: 'keyword', foreground: '6e95ff' },
        { token: 'string', foreground: 'efb84d' },
        { token: 'comment', foreground: 'aebbd0' },
        { token: 'number', foreground: '58c69d' },
      ],
      colors: {
        'editor.background': '#142238',
        'editor.foreground': '#f4f7fb',
        'editorLineNumber.foreground': '#33445e',
      },
    });
  };
```

(These hex values are copied verbatim from `atlas.css`'s existing dark-mode `--atlas-surface`, `--atlas-ink`, `--atlas-line`, `--atlas-cobalt`, `--atlas-amber`, `--atlas-ink-soft`, `--atlas-emerald` tokens — no new colors.)

In the `<Editor>` JSX (around line 536-542), change:

```tsx
              <Editor
                height="100%"
                defaultLanguage="sql"
                value={code}
                onChange={handleCodeChange}
                onMount={handleEditorDidMount}
                theme="vs-dark"
```

to:

```tsx
              <Editor
                height="100%"
                defaultLanguage="sql"
                value={code}
                onChange={handleCodeChange}
                onMount={handleEditorDidMount}
                beforeMount={handleEditorBeforeMount}
                theme="atlas-console"
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test:e2e:no-external -- tests/e2e/login-practice-visual-polish.spec.ts --reporter=line`
Expected: PASS (all three tests)

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/components/features/sql/SQLEditor.tsx tests/e2e/login-practice-visual-polish.spec.ts
git commit -m "feat(web): give the SQL editor a custom atlas-console Monaco theme"
```

---

### Task 4: Accessibility/viewport coverage, regression pass, and full local gate

The design doc's testing plan promises viewport coverage and accessibility checks (single main landmark, skip link) in addition to the light/dark checks Tasks 1-3 already cover. This task closes that gap before the final regression pass.

**Files:**
- Test: `tests/e2e/login-practice-visual-polish.spec.ts` (append)

**Interfaces:** consumes the combined output of Tasks 1-3.

- [ ] **Step 1: Write the failing test for landmarks + narrow-viewport overflow**

Append to `tests/e2e/login-practice-visual-polish.spec.ts`:

```ts
  test('new badge/label elements keep a single main landmark and do not overflow at 320px', async ({ page }) => {
    await setupStudentProfile(page, 'A11yViewportTester');

    for (const path of ['/login', '/practice'] as const) {
      await page.setViewportSize({ width: 320, height: 800 });
      if (path === '/practice') {
        await goToPractice(page);
      } else {
        await page.goto(path);
        await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible({ timeout: 10000 });
      }

      await expect(page.getByRole('main')).toHaveCount(1);
      await expect(page.locator('a', { hasText: 'Skip to main content' })).toHaveCount(1);

      const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
      const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
      expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1); // +1 rounding tolerance
    }
  });
```

- [ ] **Step 2: Run test to verify it fails or passes for the right reason**

Run: `npm run test:e2e:no-external -- tests/e2e/login-practice-visual-polish.spec.ts --reporter=line`
Expected: either PASS already (if the new elements don't overflow — plausible, since a badge and a label are small inline additions) or FAIL with a horizontal-overflow assertion at 320px. If it fails, that's a real bug the earlier tasks introduced — go back to the relevant task's markup and add a wrap/truncate rule (e.g. `flex-wrap` on the container holding the new badge) rather than changing this test.

- [ ] **Step 3: Fix any overflow found, then re-run until it passes**

Run: `npm run test:e2e:no-external -- tests/e2e/login-practice-visual-polish.spec.ts --reporter=line`
Expected: PASS (all four tests).

- [ ] **Step 4: Commit**

```bash
git add tests/e2e/login-practice-visual-polish.spec.ts
# include any markup fix files here if Step 3 required one
git commit -m "test(web): cover landmarks and 320px overflow for the new atlas badge/label"
```

- [ ] **Step 5: Run the existing Schema Atlas visual-regression suite**

Run: `npm run test:e2e:no-external -- tests/e2e/schema-atlas-visual-system.spec.ts --reporter=line`
Expected: PASS, unchanged from before this plan. This is the ripple check — `BrandMark` renders on every already-Atlas page (Concepts, Textbook, Settings, Research, Instructor Dashboard, Projects), so this suite is what would catch an unintended visual regression there. If anything fails, fix the specific cause in the file that regressed — do not weaken the assertion.

- [ ] **Step 6: Run the full local gate**

```bash
npm run integrity:scan
npm run build
npm run server:build
npm run test:unit
npm run test:e2e:no-external
```

Expected: all five pass, with zero new failures beyond what already exists on `front_end_test` before this plan.

- [ ] **Step 7: If everything passes, this plan is complete**

If Step 5 or Step 6 surfaced a real regression, fix it, re-run the affected command, and commit the fix with a message describing the specific regression (not a generic "fix tests" message).
