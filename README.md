# Adaptive Instructional Artifacts (SQL)

ALGL project workspace for:
- Adaptive SQL learning prototype (`apps/web`)
- Offline replay + policy comparison (`scripts/replay-toy.mjs`)
- Research notes and references (`docs`, `research`)

## Reorganized structure

- `apps/web/` - Vite React application (student, textbook, research views)
- `scripts/` - reproducible replay and utility scripts
- `prompts/agents/` - reusable prompts for specialized coding/research agents
- `docs/reviews/` - paper/codebase review notes
- `docs/guidelines/` - project/process guidelines
- `docs/literature/` - literature extraction artifacts
- `research/assets/` - large static research assets (PDFs, etc.)
- `dist/` - build and replay outputs

## Run

1. `npm i`
2. `npm run dev`
3. `npm run build`
4. `npm run replay:toy`

## Week 2 smoke test (Playwright)

This covers the Week 2 loop in UI:
practice failed attempt -> hint ladder (1/2/3) -> escalation -> add/update note -> verify in My Textbook.

1. Install deps: `npm i`
2. Install browser once: `npx playwright install chromium`
3. Run smoke only: `npm run test:e2e:week2`
4. Run all E2E specs: `npm run test:e2e`

## Notes

- App config is at `apps/web/vite.config.ts`.
- Replay fixture and SQL-Engage resources are under `apps/web/src/app/data/`.
- Agent prompt pack is under `prompts/agents/`.
