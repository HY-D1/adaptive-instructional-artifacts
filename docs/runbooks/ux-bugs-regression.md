# UX Bug Regression Runbook

**Suite tag**: `@ux-bugs`
**Prerequisite**: No Ollama / LLM required (`@no-external`)
**Must pass on every merge to**: `main`

---

## Overview

This runbook covers the two learner-facing bugs discovered in the `weekly_features` branch
and the Playwright E2E regression tests that guard against regressions.

| ID | Bug | Test file |
|----|-----|-----------|
| UX-BUG-1 | Save to Notes — silent no-op when `activeHintSubtype` not passed | `tests/e2e/regression/ux-bugs-save-to-notes.spec.ts` |
| UX-BUG-2 | Concept readability — garbled extraction artefacts shown as primary content | `tests/e2e/regression/ux-bugs-concept-readability.spec.ts` |

---

## UX-BUG-1 — Save to Notes reliability

### What broke

`HintSystem` did not forward the active hint subtype to `LearningInterface.handleEscalate`.
When a learner clicked **Save to Notes** without a prior SQL error in state,
`handleEscalate` silently returned because neither `lastError` nor `resolveLatestProblemErrorSubtype()`
had context. No unit was created and no error was shown.

### Fix summary

- `HintSystem.onEscalate` now passes the active hint subtype as a second positional argument.
- `LearningInterface.handleEscalate` uses `providedSubtype` first, then falls back to
  `lastError` and `resolveLatestProblemErrorSubtype()`.
- When no subtype context exists at all, a visible error is shown instead of silence.
- A `broadcastSync('sql-adapt-textbook', learnerId)` call after a successful save ensures
  `/textbook` reflects the new unit without a manual page reload.

### Run the regression test

```bash
npx playwright test -c playwright.config.ts \
  tests/e2e/regression/ux-bugs-save-to-notes.spec.ts
```

### Test cases

| # | Description | Key assertion |
|---|-------------|---------------|
| 1 | Full flow: wrong query → Get Help → Save to Notes → unit in /textbook | Green success toast + unit title visible on /textbook |
| 2 | Explicit HintSystem subtype takes priority over stale `lastError` | No "no concept context" error alert |
| 3 | No concept context → visible error, no silent failure | Error alert visible after click |
| 4 | Post-save broadcastSync: /textbook shows new unit without manual refresh | `getTextbookUnits()` returns >0 entries immediately |

---

## UX-BUG-2 — Concept readability (helper quality metadata)

### What broke

`ConceptDetailPage` called only local heuristics (`isExplanationGarbled`,
`filterSaneExamples`) to assess whether a concept's content was safe to render.
For concepts already flagged by the upstream helper pipeline
(`qualityMetadata.readabilityStatus = 'garbled'`), the local heuristics were
not triggered, so garbled extraction artefacts were shown as primary learning content.

### Fix summary

- `assessConceptQuality` now reads `concept.qualityMetadata` **first**.
  - `readabilityStatus === 'garbled'` or `exampleQuality === 'contaminated'` → `'fallback'`
  - `readabilityStatus === 'clean'` → `'good'`
  - `'partial'` falls through to local heuristics as a second opinion.
- `ConceptInfo` and `LoadedConcept` now carry an optional `qualityMetadata` field
  matching the `QualityMetadata` interface.
- `ConceptDetailPage` passes `qualityMetadata` down to `LearnTab`, which renders a
  `data-testid="learner-safe-summary"` overview box when in fallback mode.
- Helper-produced quality metadata is read from
  `apps/web/public/textbook-static/concept-quality.json` and takes precedence over
  embedded `qualityMetadata` in `concept-map.json`.
- Two known-bad concepts are seeded with compatibility metadata in `concept-map.json`:
  - `murachs-mysql-3rd-edition/mysql-intro`
  - `dbms-ramakrishnan-3rd-edition/select-basic`

### Run the regression test

```bash
npx playwright test -c playwright.config.ts \
  tests/e2e/regression/ux-bugs-concept-readability.spec.ts
```

### Test cases

| # | Description | Key assertion |
|---|-------------|---------------|
| 1 | Known-bad concept (`mysql-intro`) shows quality banner + learnerSafeSummary | `[role="note"][aria-label*="quality"]` visible; `data-testid="learner-safe-summary"` visible |
| 2 | Second known-bad concept (`select-basic`) also falls back | Banner + overview box visible |
| 3 | Route-interception: garbled markdown (no metadata) triggers local-heuristic fallback | Banner visible via heuristic path |
| 4 | Clean concept (metadata `readabilityStatus: clean`) shows no banner, full explanation | Banner NOT visible; `.prose` visible with explanation text |

---

## Run both suites together

```bash
npx playwright test -c playwright.config.ts \
  tests/e2e/regression/ux-bugs-save-to-notes.spec.ts \
  tests/e2e/regression/ux-bugs-concept-readability.spec.ts
```

Or by tag:

```bash
npx playwright test -c playwright.config.ts --grep "@ux-bugs"
```

---

## Related files

| File | Role |
|------|------|
| `apps/web/src/app/lib/content/concept-loader.ts` | `QualityMetadata` type, `assessConceptQuality` |
| `apps/web/public/textbook-static/concept-quality.json` | Helper-produced quality metadata (primary source) |
| `apps/web/src/app/pages/ConceptDetailPage.tsx` | Renders quality banner and `learnerSafeSummary` |
| `apps/web/public/textbook-static/concept-map.json` | Seeded `qualityMetadata` for known-bad concepts |
| `apps/web/src/app/lib/content/concept-quality.test.ts` | Unit tests for quality functions |
| `apps/web/src/app/lib/content/save-to-notes-integration.test.ts` | Integration tests for `handleEscalate` contract |
| `tests/helpers/test-helpers.ts` | Shared helpers (`getTextbookUnits`, `replaceEditorText`) |
