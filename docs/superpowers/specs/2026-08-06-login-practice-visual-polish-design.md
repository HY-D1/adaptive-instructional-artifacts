# Login + Practice Visual Polish — "Minimal Terminal" Design

**Status:** Approved. **Branch:** `front_end_test`. **Target:** eventual production merge, preview-only until explicitly approved.

## Problem

Production's login/gateway pages are visually plain, and the practice page's Monaco editor (`theme="vs-dark"`, stock default) sits as a flat black terminal inside an otherwise designed product — a visible contrast against the app's more polished areas. A prior redesign ("Schema Atlas": `BrandMark`, `GatewayShell`, `atlas.css`) already addressed the gateway pages but is unmerged on `front_end_test` and never extended to the practice page.

## Direction: "Minimal Terminal"

Established via visual mockups (three directions shown; "Minimal Terminal" selected over "Operator Console" and "Systematic Grid"): keep the existing light/dark workbench mood, and layer in monospace uppercase labels, small status badges (dot + pill), and subtle borders. No glow effects, no mascot/character — the quietest of the three explored directions. Applies adapted to both light and dark mode, matching the app's existing light/dark toggle (not dark-only).

The practice page's SQL editor gets a custom Monaco theme (own ink-navy background + accent syntax colors, registered via Monaco's `defineTheme` API) rather than the stock `vs-dark`. The editor theme is fixed (does not flip with the app's light/dark toggle) — code panes conventionally stay dark regardless of surrounding app theme, matching the direction confirmed during mockup review.

None of this is copied from the reference image (an unrelated "Cybernetic Sabotage" hacker-detective UI) — only the underlying DNA (terminal-flavored typography, status indicators, restrained borders) was extracted, expressed in the app's own existing color tokens.

## Scope

**In scope:** gateway routes (`/`, `/login`, `/signup`) and `/practice`.
**Out of scope:** Concepts, Textbook, Settings, Research, Instructor Dashboard, Projects page content — untouched in this pass, candidates for a later extension.

**Ripple (expected, acceptable):** `BrandMark` is shared between the gateway header and the authenticated top nav on every page. Refining its typography (per the token/component changes below) will visibly affect the brand mark everywhere it renders — this is intentional and consistent, not a regression. The authenticated top nav's background/border (`bg-white dark:bg-gray-900 dark:border-gray-700` — plain Tailwind, not `atlas.css` tokens) is unaffected.

## Implementation approach: extend `atlas.css` in place

Chosen over an isolated new token layer (would avoid all ripple, at the cost of duplicated tokens) and a toggleable dual-theme layer (unnecessary engineering for a need not yet requested).

### Token/component reuse (grounded in current code, not invented fresh)

- `atlas.css` already defines full light+dark pairs for `--atlas-cobalt`, `--atlas-emerald`, `--atlas-amber`, `--atlas-violet`, `--atlas-red` (plus `-soft` variants) and an existing monospace-uppercase-letter-spaced style on `.atlas-brand__name`. No new colors or fonts are introduced.
- `.atlas-gateway__status` (lines ~313–330 of `atlas.css`) is currently **dead CSS** — its only JSX usage ("Learning workspace" chip) was removed from `GatewayShell.tsx` earlier this session. It is exactly the dot+monospace badge pattern needed here. Generalize it into a reusable `.atlas-badge` utility (parameterized by semantic color token — cobalt/emerald/amber/violet/red) instead of writing a new component from scratch.
- Add one new small monospace-label utility class (uppercase, letter-spaced, using the existing monospace font stack) for field/section headers, following the exact pattern already used by `.atlas-brand__name`.
- Add subtle-border refinements to relevant gateway/practice containers using existing `--atlas-line` / `--atlas-line-strong` tokens — no new border tokens.

### Editor theme (`apps/web/src/app/components/features/sql/SQLEditor.tsx`)

- Add a `beforeMount={(monaco) => monaco.editor.defineTheme('atlas-console', {...})}` prop to the `<Editor>` element, defining colors from the ink/cobalt/emerald/amber token set.
- Change `theme="vs-dark"` to `theme="atlas-console"`.
- No other change to this file: execution (`SQLExecutor`), mount/dispose lifecycle, hints, results, and all existing test IDs/behavior stay exactly as they are.

## Non-goals / explicit guarantees

- No change to auth logic, redirects, CSRF/cookie behavior, accessible names, or any existing test ID (same guarantee the earlier Schema Atlas work held to).
- No change to SQL execution, grading, hint, or results logic — visual/theme only.
- No new dependencies, fonts, or copied assets from the reference image.
- No change to backend, database, readiness contract, or offline sync behavior — this spec is frontend-visual only.
- No push, no merge to `main` — stays on `front_end_test`, preview-only, until explicitly approved.

## Testing plan

Same discipline as the earlier Schema Atlas work:
- Visual-regression tests: light + dark mode, standard viewport set (320/390/768/1024/1440), for gateway pages and `/practice`.
- Accessibility: contrast checks on new badge/label colors in both modes, single main landmark preserved, skip link unaffected.
- Regression pass over already-Atlas-styled pages (Concepts, Textbook, Settings, Research, Instructor Dashboard, Projects) to confirm the `BrandMark` ripple doesn't break anything there, even though their content is out of scope.
- Full local gate before considering done: `integrity:scan`, `build`, `server:build`, `test:unit`, `test:e2e:no-external`.

## Rollout

Continue on `front_end_test` (already the reviewed baseline aimed at eventual production) — new isolated commit(s), same independent-review pattern used for the prior visual and storage/readiness commits on this branch. Remains preview-only; no push or merge without explicit approval.
