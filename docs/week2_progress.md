# Week 2 QA + Documentation Gate

Last updated: 2026-02-12

## Scope

This document is the canonical Week 2 QA/runbook for:

- Regression checks in `apps/web/tests/*week2*.spec.ts`
- Demo validation in `docs/week2-demo.md`
- Export acceptance checks on `dist/week2-demo/export.json`

Offline replay is counterfactual simulation on logs. It does not prove learning gains.

## Canonical Files

- Runbook: `docs/week2_progress.md`
- Demo script: `docs/week2-demo.md`
- Compatibility aliases:
  - `docs/week2-repro-compat.md`
  - `docs/guidelines/project-guidelines.md`
  - `docs/guidelines/week2-reproducibility.md`

## Regression Coverage Matrix

- Hint ladder cap at level 3 + escalation after help request 4:
  - `apps/web/tests/week2-smoke.spec.ts`
  - `apps/web/tests/week2-demo-artifacts.spec.ts`
- Week 2 export contract (`sessionId`, no `hintId`, SQL-Engage metadata on `hint_view`, active-session scope):
  - `apps/web/tests/week2-demo-artifacts.spec.ts`
- Instructor trace policy knob and replay decision divergence:
  - `apps/web/tests/week2-instructor.spec.ts`
- Replay parity across live/replay mode:
  - `apps/web/tests/week2-policy-parity.spec.ts`
- My Textbook provenance readability and dedup behavior:
  - `apps/web/tests/week2-smoke.spec.ts`
  - `apps/web/tests/week2-pdf-rag-ui.spec.ts`
- LLM health feedback in research UI:
  - `apps/web/tests/week2-llm-health.spec.ts`

## QA Commands (Copy-Paste)

```bash
npm run test:e2e:week2
npm run demo:week2
```

## Acceptance Commands (Copy-Paste)

```bash
jq '[.interactions[] | select(.eventType=="hint_view") | .hintLevel] | max' dist/week2-demo/export.json
jq '[.interactions[] | select(.eventType=="hint_view") | has("hintId")] | any' dist/week2-demo/export.json
jq '[.interactions[] | has("sessionId") and (.sessionId!="")] | all' dist/week2-demo/export.json
jq '[.interactions[] | select(.eventType=="hint_view") |
      (has("sqlEngageSubtype") and has("sqlEngageRowId") and has("policyVersion")
       and (.sqlEngageSubtype!="") and (.sqlEngageRowId!="") and (.policyVersion!=""))
    ] | all' dist/week2-demo/export.json
jq '[.interactions[] | select(.eventType=="explanation_view")] | length' dist/week2-demo/export.json
jq '[.interactions[] | select(.eventType=="hint_view" or .eventType=="explanation_view")] | length' dist/week2-demo/export.json
```

Expected output pattern:

1. `3`
2. `false`
3. `true`
4. `true`
5. integer `>= 1`
6. integer `>= 4`

## Artifact Checklist

After `npm run demo:week2`, confirm these files exist:

- `dist/week2-demo/export.json`
- `dist/week2-demo/hint-panel.png`
- `dist/week2-demo/research-export-scope.png`

## Path Hygiene Check (Copy-Paste)

```bash
test -f docs/week2_progress.md
test -f docs/week2-demo.md
test -f docs/week2-repro-compat.md
test -f docs/guidelines/project-guidelines.md
test -f docs/guidelines/week2-reproducibility.md
```

## Progress Checkpoint Log

### 2026-02-12T05:44:00Z - Pre-change checkpoint (docs/assets cleanup)

- Current status: `PASS` (Week 2 acceptance gates on `dist/week2-demo/export.json`)
- Evidence:
  - `jq '[.interactions[] | select(.eventType=="hint_view") | .hintLevel] | max' dist/week2-demo/export.json` -> `3`
  - `jq '[.interactions[] | select(.eventType=="hint_view") | has("hintId")] | any' dist/week2-demo/export.json` -> `false`
  - `jq '[.interactions[] | has("sessionId") and (.sessionId!="")] | all' dist/week2-demo/export.json` -> `true`
  - `jq '[.interactions[] | select(.eventType=="hint_view") | (has("sqlEngageSubtype") and has("sqlEngageRowId") and has("policyVersion") and (.sqlEngageSubtype!="") and (.sqlEngageRowId!="") and (.policyVersion!=""))] | all' dist/week2-demo/export.json` -> `true`
  - `jq '[.interactions[] | select(.eventType=="explanation_view")] | length' dist/week2-demo/export.json` -> `1`
  - `jq '[.interactions[] | select(.eventType=="hint_view" or .eventType=="explanation_view")] | length' dist/week2-demo/export.json` -> `4`
- Next smallest fix:
  - Stage 1+2 only: rename/move docs into `docs/` with consistent naming, add `docs/README.md`, remove duplicate doc content via canonical pointers, and delete only assets with zero references proven by `rg`.

### 2026-02-12T05:50:10Z - Post-change checkpoint (Stage 1+2 implemented)

- Current status: `PASS`
- Evidence:
  - Docs moved/renamed to consistent kebab-case under `docs/` (canonical demo doc now `docs/week2-demo.md`; canonical runbook remains `docs/week2_progress.md` by project rule).
  - Zero-reference proof before asset deletion:
    - `rg -n --fixed-strings "dist/chrome-channel-smoke-escalated.png" README.md AGENTS.md docs apps scripts package.json` -> no matches
    - `rg -n --fixed-strings "dist/week2-clickpath-20260211-092305" README.md AGENTS.md docs apps scripts package.json` -> no matches
    - `rg -n --fixed-strings "dist/week2-clickpath-20260211-093204" README.md AGENTS.md docs apps scripts package.json` -> no matches
    - `rg -n --fixed-strings "dist/week2-clickpath-20260211-093417" README.md AGENTS.md docs apps scripts package.json` -> no matches
    - `rg -n --fixed-strings "dist/week2-clickpath-20260211-093514" README.md AGENTS.md docs apps scripts package.json` -> no matches
  - Validation:
    - `npm run build` -> pass (`vite build --config apps/web/vite.config.ts`, completed successfully)
- Next smallest fix:
  - Stage 3 only (separate task): remove unreachable UI primitives and unreferenced scripts in small batches with test coverage.

### 2026-02-12T05:53:24Z - Pre-change checkpoint (unused code cleanup)

- Current status: `PASS` (Week 2 acceptance gates unchanged on `dist/week2-demo/export.json`)
- Evidence:
  - `jq '[.interactions[] | select(.eventType=="hint_view") | .hintLevel] | max' dist/week2-demo/export.json` -> `3`
  - `jq '[.interactions[] | select(.eventType=="hint_view") | has("hintId")] | any' dist/week2-demo/export.json` -> `false`
  - `jq '[.interactions[] | has("sessionId") and (.sessionId!="")] | all' dist/week2-demo/export.json` -> `true`
  - `jq '[.interactions[] | select(.eventType=="hint_view") | (has("sqlEngageSubtype") and has("sqlEngageRowId") and has("policyVersion") and (.sqlEngageSubtype!="") and (.sqlEngageRowId!="") and (.policyVersion!=""))] | all' dist/week2-demo/export.json` -> `true`
  - `jq '[.interactions[] | select(.eventType=="explanation_view")] | length' dist/week2-demo/export.json` -> `1`
  - `jq '[.interactions[] | select(.eventType=="hint_view" or .eventType=="explanation_view")] | length' dist/week2-demo/export.json` -> `4`
  - Unused proof sample:
    - `apps/web/src/app/components/ui/accordion.tsx` -> import-path `rg` no matches, symbol `Accordion` `rg` no matches
    - `apps/web/src/app/components/ui/pagination.tsx` -> import-path `rg` no matches, symbol `Pagination` `rg` no matches
    - `apps/web/src/app/components/ui/sonner.tsx` -> import-path `rg` no matches, symbol `Toaster` `rg` no matches
- Next smallest fix:
  - Delete only UI component files with zero import-path references and zero external symbol references, then validate with `npm run build` and Week 2 e2e smoke (`npm run test:e2e:week2`).

### 2026-02-12T05:55:03Z - Post-change checkpoint (unused code cleanup)

- Current status: `PASS`
- Evidence:
  - Deleted 28 unreferenced UI primitive files under `apps/web/src/app/components/ui/` after zero-reference proof (`rg` import-path and symbol checks returned no matches).
  - Validation:
    - `npm run build` -> pass
    - `npm run test:e2e:week2` -> `7 passed`
    - `npm run demo:week2` -> `1 passed` (active-session export artifact flow)
  - Week 2 acceptance checks after cleanup:
    - `jq '[.interactions[] | select(.eventType=="hint_view") | .hintLevel] | max' dist/week2-demo/export.json` -> `3`
    - `jq '[.interactions[] | select(.eventType=="hint_view") | has("hintId")] | any' dist/week2-demo/export.json` -> `false`
    - `jq '[.interactions[] | has("sessionId") and (.sessionId!="")] | all' dist/week2-demo/export.json` -> `true`
    - `jq '[.interactions[] | select(.eventType=="hint_view") | (has("sqlEngageSubtype") and has("sqlEngageRowId") and has("policyVersion") and (.sqlEngageSubtype!="") and (.sqlEngageRowId!="") and (.policyVersion!=""))] | all' dist/week2-demo/export.json` -> `true`
    - `jq '[.interactions[] | select(.eventType=="explanation_view")] | length' dist/week2-demo/export.json` -> `1`
    - `jq '[.interactions[] | select(.eventType=="hint_view" or .eventType=="explanation_view")] | length' dist/week2-demo/export.json` -> `4`
- Next smallest fix:
  - Optional follow-up: evaluate remaining UI primitives with ambiguous symbol names (`input`, `dialog`, `sheet`, `switch`, etc.) one-by-one using the same proof rubric.

### 2026-02-12T05:57:03Z - Pre-change checkpoint (naming standardization pass)

- Current status: `PASS`
- Evidence:
  - Week 2 acceptance checks still pass on `dist/week2-demo/export.json` (`3`, `false`, `true`, `true`, `1`, `4`).
  - Naming scan in `docs/` showed one remaining compatibility-style filename candidate for cleanup: `docs/week2-repro-pack.md`.
  - Contract constraint preserved: keep `docs/week2_progress.md` path unchanged (project-mandated canonical checkpoint file).
- Next smallest fix:
  - Low-risk mechanical rename only: `docs/week2-repro-pack.md` -> `docs/week2-repro-compat.md`, then update all references and run `npm run build`.

### 2026-02-12T05:57:59Z - Post-change checkpoint (naming standardization pass)

- Current status: `PASS`
- Evidence:
  - Applied low-risk rename: `docs/week2-repro-pack.md` -> `docs/week2-repro-compat.md`.
  - Updated all operational path references (`README.md`, `docs/README.md`, `docs/week2-demo.md`); `rg -n "docs/week2-repro-pack.md" README.md docs AGENTS.md apps scripts package.json -g '!docs/week2_progress.md'` -> no matches.
  - Validation:
    - `npm run build` -> pass (`vite build --config apps/web/vite.config.ts`).
- Next smallest fix:
  - Optional naming follow-up (higher risk, not applied): evaluate whether to keep the required underscore path `docs/week2_progress.md` versus adding a kebab-case alias doc without breaking the project contract.
