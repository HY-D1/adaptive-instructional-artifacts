# Handoff — learning content refinement on `front_end_test`

**Date:** 2026-08-06. **Branch:** `front_end_test` (worktree `~/.config/superpowers/worktrees/adaptive-instructional-artifacts/front_end_test`). **Last commit:** `db6aa58`.

The user pushes and deploys themselves — **do not push, do not merge to main.** Commit locally only. No LLM/AI mentions in commit messages, no co-author trailers.

## Read this first

`SQL-Adapt` is a research artifact behind two paper submissions (CIKM 2026 on interaction traces, RecSys 2026 on bandit hint delivery). The LaTeX for both was shared in the session. The critical constraint, stated directly by the user:

> "my hints are based on the error types" … "u can refine the hints contents, error types and logic, but do not give static hints only."

So: hints are chosen by **error subtype + bandit-assigned escalation profile**, escalating through guidance ladder L1→L4. Per-problem static hint text must **not** replace that. Anything that emits extra `hint_view` / `explanation_view` events corrupts the HDI components (HPA, ER) that the papers analyse.

## Done this session

**Visual polish (plan complete, reviewed):** `docs/superpowers/plans/2026-08-06-login-practice-visual-polish.md`. Minimal Terminal design — `.atlas-badge`, `.atlas-label`, `.atlas-panel-border`, and a custom `atlas-console` Monaco theme. Final review caught a shipped accessibility regression (editor line numbers at 1.62:1 contrast) and a no-op CSS utility; both fixed in `adf5c25`.

**Content refinement (partially complete):** plan at `/Users/harrydai/.claude/plans/can-u-refine-the-lucky-fox.md`.
- `5bcdd6d` — added `estimatedReadTime` to all concepts (the field is required and rendered, but was absent from every entry, so pages showed a bare " min read"); named the real source textbook instead of a generic string; fixed `problem-30`, which "taught" UNION by unioning a query with itself.
- `c744023` — rewrote 11 concept pages by hand. The corpus is PDF-extracted and these had landed on entirely wrong text (Primary Keys was Java JDBC code; Creating Tables explained window functions; the normalization pages described disk platters). Merged 4 duplicate pairs (`joins`, `where-clause`, `subqueries`, `group-by`) onto the Ramakrishnan ids. Added `authored-concepts.test.ts`, verified red against the pre-rewrite files before it passed.
- `db6aa58` — fixed SQL error subtype classification (details below).

## The classification bug, and what's left in it

Verified by executing real SQL through sql.js rather than trusting hand-written error strings:
- A mistyped keyword (`SELCT`, `FORM`) was classified `missing commas`, so the learner got comma advice for a spelling error. The missing-commas branch matched `near "TOKEN": syntax error`, which is *every* SQLite syntax error. Now: keyword edit-distance check → `misspelling`; paren scan → `unmatched brackets`; missing-commas narrowed to real adjacent bare identifiers.
- `constraint violation` was not a subtype the SQL-Engage dataset contains, so `canonicalizeSqlEngageSubtype` silently rewrote every UNIQUE/NOT NULL/FK error to `incomplete query`. Now mapped to `data type mismatch`.

**Open decision for the researcher:** the dataset taxonomy has no constraint category at all. `data type mismatch` is the closest existing label but is not really right. Adding a constraint subtype to the taxonomy is a research decision, not an engineering one.

## Suggested next work, highest value first

1. **Hint content quality.** `hintTemplates` in `apps/web/src/app/data/sql-engage.ts` has only ~11 entries covering 4 concepts at levels 1–2, while the ladder is L1–L4 and there are 16 canonical subtypes. Most subtypes have no authored template at any rung, so learners fall through to generic dataset text. Filling this out is the biggest genuine improvement to what learners read, and it does not disturb adaptive selection.
2. **`hint_level`/`rung` telemetry gap.** The CIKM paper reports AED was computable on only 371/699 hint rows (53.1%), which is why HDI runs as a 3-component proxy and AED/REAE are listed as limitations. Making every hint event reliably carry its rung would let the full 5-component HDI be computed — a limitation removed rather than a feature added. Check `buildHintViewEvent` in `apps/web/src/app/lib/telemetry/`.
3. **`errorSubtypes` regex table is dead code.** `getErrorSubtype` in `sql-engage.ts` has no callers; real classification goes through `normalizeSqlErrorSubtype`. Its patterns are also broken (`/no such table|FROM/i` matches any error containing "from"). Delete it or wire it up deliberately.
4. **Remaining broken concepts.** 31 of 66 are still `fallback_only`. 10 more duplicate pairs exist (`aggregate-functions`, `having`, `inner-join`, `outer-join`, `insert`, `delete`, `update`, `correlated-subquery`, `isolation-levels`, `views`) — same situation as the 4 already merged. Also 3 orphaned markdown files no concept-map entry references, and `tests/e2e/ws-4-audit.spec.ts:9-10` references two concept ids that do not exist.
5. **`postSolveExplanation`** is declared on `SQLProblem` but not populated or rendered. If you implement it, it must not emit `explanation_view` — that would inflate ER in HDI for every learner who solves.

## Verification commands

```
npm run test:unit
npm run validate:corpus
npm run check:concept-map
npm run test:e2e:no-external      # ~10 min, needs the 3600s globalTimeout
npm run build && npm run server:build && npm run integrity:scan
```

Last known state: `test:unit` 101 files / 2108 passed / 2 skipped; corpus 66/66 resolve; full e2e last green at `adf5c25` (319 passed / 8 skipped). **The full e2e suite has not been re-run since the content commits** — do that before considering the content work finished.

## Traps that already cost time

- Do **not** set `VITE_API_BASE_URL` in `playwright.config.ts`. It feeds vite's `/api` proxy target, `'same-origin'` is not a valid URL, and http-proxy crashes the shared preview server — taking down every spec file, not just the one you are working on.
- `AUTH_ENABLED` is false in the e2e build, so `/login` renders the "Account system not available" fallback. Test login UI with a Vitest component test (`AuthPage.test.tsx` shows the mock pattern).
- Rewriting a concept's markdown does nothing unless you also flip its `concept-quality.json` entry off `fallback_only` — `assessConceptQuality` suppresses the page otherwise.
- Concept markdown: sections split only on `## `; each section is flattened to a single paragraph; Explanation is clipped at 1800 chars; `isExplanationGarbled` rejects lines beginning with CHAPTER/FIGURE/TABLE/SECTION + a digit, or a bare number. No trailing `*Source:*` footer — it lands inside Common Mistakes and pollutes the rendered SQL.
