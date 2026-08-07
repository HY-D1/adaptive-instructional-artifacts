# Handoff — learning content refinement on `front_end_test`

**Date:** 2026-08-06. **Branch:** `front_end_test` (worktree `~/.config/superpowers/worktrees/adaptive-instructional-artifacts/front_end_test`). **Last commit:** `db6aa58`.

The user pushes and deploys themselves — **do not push, do not merge to main.** Commit locally only. No LLM/AI mentions in commit messages, no co-author trailers.

## Plan status — what to resume

The approved plan is `/Users/harrydai/.claude/plans/can-u-refine-the-lucky-fox.md`. It now
carries a superseded-status header; this table is the authoritative version.

| Unit | Description | Status |
|---|---|---|
| 1 | `estimatedReadTime` for every concept | Done — `5bcdd6d` |
| 2 | Standalone bugs (problem-30 UNION, source attribution, subqueries difficulty) | Done — `5bcdd6d` |
| 3-4 | Merge 4 duplicate concept pairs | Done — `c744023` |
| 5-8 | Rewrite 7 standalone concepts | Done — `c744023` |
| 9 | Add `postSolveExplanation` to `SQLProblem` | Field declared only — `db6aa58`. Not populated, not rendered, by design |
| 10 | Wire `HintSystem` to prefer authored hints | **CANCELLED — do not implement** (see below) |
| 11-12 | Author static hints for all 32 problems | **CANCELLED — do not implement** |
| 13 | Final verification | Done — gate run, one stale e2e spec fixed in `89b1e29`. Browser spot-check still outstanding |
| 14 | Semantic classification for wrong-but-runnable queries | Done — `5ab0fd3` |
| 15 | Offline hint rungs escalate and match the failure family | Done — `def1d57` |

Units 10-12 were cancelled after the user clarified that hints are driven by error
type, not per-problem text. The replacement work (auditing and fixing the
error-subtype classifier) is done in `db6aa58`.

**Unit 13 result — the gate found one real failure, now fixed in `89b1e29`.** Measured at
`61009ad` unless noted:

```
npm run test:unit             101 files, 2108 passed, 2 skipped
npm run validate:corpus       66/66 resolve, 0 broken links, 0 warnings
npm run check:concept-map     23 canonical subtypes, 23 mapped
npm run build                 PASS   npm run server:build PASS   integrity:scan PASS
npm run test:e2e:no-external  321 passed, 1 failed, 8 skipped (10.2m)
```

The e2e failure was `ux-bugs-concept-readability.spec.ts` asserting that
`dbms-ramakrishnan-3rd-edition/select-basic` still shows the quality-limited banner.
`c744023` rewrote that concept and flipped its `concept-quality.json` entry to `ok`, so a
readable concept correctly showed no banner — a stale test premise, not a regression. It now
points at `selection-projection`, which is still `fallback_only` and still from the
non-Murach source doc.

Re-run after all of units 14–16 landed, at `89b1e29`:

```
npm run test:unit             102 files, 2116 passed, 2 skipped
npm run test:e2e:no-external  322 passed, 0 failed, 8 skipped (9.7m), exit 0
```

**Watch out when reading e2e results:** `npm run test:e2e:no-external | tail` reports
`tail`'s exit code, not Playwright's, so a piped run looks like it passed even when a spec
failed. Redirect to a file and check the exit code, or read the summary line.

Still outstanding from unit 13: the **manual browser spot-check** was not done. Open the
11 rewritten concept pages, confirm each shows a real "N min read", and confirm the ⌘K
command palette shows the updated definitions (those come from `concept-map.json`, not
the markdown, and are easy to forget).

**Unpushed:** the user pushes and deploys themselves — tell them, do not push.
`origin/front_end_test` is at `adf5c25`; nine commits are local only — `5bcdd6d`, `c744023`,
`db6aa58`, `3525c82`, `61009ad`, `5ab0fd3`, `def1d57`, `89b1e29`, and this doc commit.
Re-check with `git log --oneline origin/front_end_test..HEAD` rather than trusting this list.

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

### The reachability audit (`5ab0fd3`)

`db6aa58` fixed two misclassifications but not the larger problem behind them. Counting
the dataset and reading the call graph showed that **12 of the 23 canonical subtypes could
never be emitted at all**, so roughly 780 of the 1500 dataset rows were unreachable for
hint targeting.

The cause is structural. `normalizeSqlErrorSubtype` has one production caller — the
`catch` block at `sql-executor.ts:349` — so it only ever sees engine throws. The 12
unreachable labels describe queries SQLite executes happily: a comma join with no
predicate, an aggregate beside a bare column with no `GROUP BY`, a forgotten `DISTINCT`.
A learner whose query ran but returned the wrong rows carried no subtype, so the hint
pipeline had nothing to aim at. This is consistent with the CIKM limitation that only
11 of 29 learners have any logged `error` event.

`apps/web/src/app/lib/sql-semantic-classifier.ts` now classifies that case by comparing
the learner's query against the problem's `expectedQuery`, and returns `null` when no rule
identifies a plausible cause — an unclassified wrong answer is honest, a guessed one sends
targeted advice about a problem the learner does not have.

Executing candidate queries through sql.js also exposed **three more branches that were
dead in the existing engine-error path**, all of which fell through to the
`incomplete query` fallback:

| Real SQLite message | Was | Now |
|---|---|---|
| `HAVING clause on a non-aggregate query` | `incomplete query` | `incorrect having clause` |
| `misuse of aggregate function COUNT()` | `incomplete query` | `incorrect having clause` / `aggregation misuse` |
| `ESCAPE expression must be a single character` | `incomplete query` | `operator misuse` |
| `no such column: Alice` (forgotten quotes) | `undefined column` | `missing quotes` |

Also verified by execution: the division-by-zero branch is inert against sql.js (SQLite
returns NULL for `age / 0`), and the old `like pattern`/`invalid escape` wordings match no
SQLite message — which is why `operator misuse` was unreachable.

**Reachability is now 20 of 23**, with three subtypes deliberately unreachable and a reason
recorded in `SEMANTIC_SUBTYPE_EXCLUSIONS`:

- `missing semicolons` — SQLite accepts the omission and returns identical rows, so it
  cannot cause a wrong answer.
- `non-standard operators` — SQLite accepts `==` and `!=` and returns identical rows, same
  reasoning.
- `inefficient query` — would have to fire on *correct* answers, emitting an error-class
  signal on the success path the papers measure.

Forcing those three to fire would repeat the over-broad-branch defect that made every
syntax error look like a comma error. `sql-semantic-classifier.test.ts` fails if any
canonical subtype is neither produced by a real execution nor listed as excluded — that
guard is what was missing.

**The event contract is unchanged on purpose.** `eventType` stays `'execution'` for a query
that ran, because `errorCount` in the bandit reward counts `'error'` events; only the
subtype fields are populated, and no `hint_view` / `explanation_view` event was added.
Verified that both are emitted only from user-initiated handlers in `HintSystem.tsx`, never
from an effect keyed on the subtype.

**Research-visible consequence to state in the papers:** subtypes that previously never
appeared now do, and wrong-but-runnable attempts now carry a subtype where they carried
none. Error-*event* counts are unchanged; error-*subtype* coverage is not.

### Two findings left alone deliberately

- **`compareResults` is order-insensitive** (`sql-executor.ts:395`, set-based row matching),
  so omitting `ORDER BY` is currently graded *correct*. That makes
  `incorrect order by usage` fire only in combination with another mistake. Tightening
  grading would move the 78.9% solve rate, so it is a research decision, not a fix to make
  quietly.
- **Rungs 3 and 4 serve identical text** on both offline paths:
  `getProgressiveSqlEngageHintText` clamps with `Math.min(3, hintLevel)`, and
  `refined-hints.ts:38` maps rung 3 and rung 4 to `hintEscalation`. Only the runtime LLM
  differentiates rung 4, and it is first-choice for all rungs, so this bites in degraded
  mode. Adding a fourth ingest field would require re-ingestion to populate, so it was not
  added — see the unit 15 commit message.

## Suggested next work, highest value first

1. ~~**Hint content quality — fill out `hintTemplates`.**~~ **Withdrawn: the premise was
   wrong.** `hintTemplates` has **zero callers**, so authoring into it would reach no
   learner. So do `errorSubtypes`, `getErrorSubtype`, `getHintsForError`,
   `getDeterministicSqlEngageHint`, `getMappedSqlEngageSubtypes` and `getConceptsByIds` —
   7 of the 17 exports in `sql-engage.ts` are dead. The count of "16 canonical subtypes"
   was also wrong: there are **23**, confirmed independently by
   `npm run check:concept-map`, and `SUBTYPE_LADDER_GUIDANCE` already covers all 23 at
   three levels.

   The live hint-content path is `getProgressiveSqlEngageHintText` +
   `getDeterministicSqlEngageAnchor` (both live), the per-concept refined hints from the
   ingest pipeline via `refined-hints.ts`, and the runtime LLM. To improve what learners
   read, change those — not `hintTemplates`.
2. **`hint_level`/`rung` telemetry gap.** The CIKM paper reports AED was computable on only 371/699 hint rows (53.1%), which is why HDI runs as a 3-component proxy and AED/REAE are listed as limitations. Making every hint event reliably carry its rung would let the full 5-component HDI be computed — a limitation removed rather than a feature added. Check `buildHintViewEvent` in `apps/web/src/app/lib/telemetry/`.
3. **Delete the 7 dead exports in `sql-engage.ts`** (listed in item 1). `errorSubtypes`'
   patterns are broken anyway — `/no such table|FROM/i` matches any error containing
   "from". Left in place during the classification work to keep that commit reviewable;
   removing them is a clean standalone change. Confirm with a fresh grep first, since the
   semantic classifier work did not touch them.
4. **Remaining broken concepts.** 31 of 66 are still `fallback_only`. 10 more duplicate pairs exist (`aggregate-functions`, `having`, `inner-join`, `outer-join`, `insert`, `delete`, `update`, `correlated-subquery`, `isolation-levels`, `views`) — same situation as the 4 already merged. Also 3 orphaned markdown files no concept-map entry references, and `tests/e2e/ws-4-audit.spec.ts:9-10` references two concept ids that do not exist.
5. **`postSolveExplanation`** is declared on `SQLProblem` but not populated or rendered. If you implement it, it must not emit `explanation_view` — that would inflate ER in HDI for every learner who solves.

## Verification commands

```
npm run test:unit
npm run validate:corpus
npm run check:concept-map
npm run test:e2e:no-external      # ~10 min, needs the 3600s globalTimeout
npm run build && npm run server:build && npm run integrity:scan
cd tools/pdf_ingest && python3 -m pytest tests/test_mlx_enricher.py tests/test_product_fit_rules.py \
  tests/test_bundle_schema.py tests/test_eval_queries.py tests/test_embedding_backends.py
```

Last known state after unit 15: `test:unit` **102 files / 2116 passed / 2 skipped**; corpus
66/66; concept-map 23/23; build, server build and integrity scan all PASS; pdf_ingest
18 passed.

`python3 -m pytest tests/` on the whole `pdf_ingest` directory fails collection on three
modules — `test_cli_embedding_config.py`, `test_docling_fallback.py`,
`test_upload_idempotency.py` — because `pypdf` and `psycopg` are not installed in this
environment. Pre-existing and unrelated to the hint work; name the modules explicitly, or
install the optional deps.

## Traps that already cost time

- Do **not** set `VITE_API_BASE_URL` in `playwright.config.ts`. It feeds vite's `/api` proxy target, `'same-origin'` is not a valid URL, and http-proxy crashes the shared preview server — taking down every spec file, not just the one you are working on.
- `AUTH_ENABLED` is false in the e2e build, so `/login` renders the "Account system not available" fallback. Test login UI with a Vitest component test (`AuthPage.test.tsx` shows the mock pattern).
- Rewriting a concept's markdown does nothing unless you also flip its `concept-quality.json` entry off `fallback_only` — `assessConceptQuality` suppresses the page otherwise.
- Concept markdown: sections split only on `## `; each section is flattened to a single paragraph; Explanation is clipped at 1800 chars; `isExplanationGarbled` rejects lines beginning with CHAPTER/FIGURE/TABLE/SECTION + a digit, or a bare number. No trailing `*Source:*` footer — it lands inside Common Mistakes and pollutes the rendered SQL.
