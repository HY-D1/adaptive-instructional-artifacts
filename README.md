# Adaptive Instructional Artifacts (SQL)

ALGL project workspace for:
- Adaptive SQL learning prototype (`apps/web`)
- Offline replay + policy comparison (`scripts/replay-toy.mjs`)
- Research notes and references (`docs`)

## Reorganized structure

- `apps/web/` - Vite React application (student, textbook, research views)
- `scripts/` - reproducible replay and utility scripts
- `docs/README.md` - documentation index and canonical links
- `docs/reviews/` - paper/codebase review notes
- `docs/guidelines/` - project/process guidelines
- `dist/` - build and replay outputs

## Run

1. `npm i`
2. `npm run dev`
3. `npm run build`
4. `npm run replay:toy`
5. `npm run replay:gate`
6. `npm run test:hintwise:convert`

## Local LLM setup (Ollama)

Live explanation/note generation uses local Ollama with model `qwen2.5:1.5b-instruct`.

1. Install Ollama (terminal-first):
   - macOS (Homebrew): `brew install ollama`
   - Windows (PowerShell + winget): `winget install --id Ollama.Ollama -e --accept-source-agreements --accept-package-agreements`
   - Windows (PowerShell + Chocolatey): `choco install ollama -y`
   - If package managers are unavailable, use the installer: [https://ollama.com/download](https://ollama.com/download)
2. Start Ollama:
   - macOS service: `brew services start ollama`
   - macOS or Windows foreground: `ollama serve`
3. Pull model once:
   - `ollama pull qwen2.5:1.5b-instruct`
4. Optional warm-up check:
   - `ollama run qwen2.5:1.5b-instruct "Reply with exactly: OLLAMA_OK"`
5. In the app, go to Research -> `Test LLM`

If you see this message:
`Connected and model 'qwen2.5:1.5b-instruct' is available, but test generation timed out (12000ms + warm-up retry 30000ms). ...`
then Ollama is reachable but still cold/loading. Run `ollama run qwen2.5:1.5b-instruct "Reply with exactly: OLLAMA_OK"` once, then click `Test LLM` again.

To capture the exact UI status message in JSON:
`npm run llm:health:capture`

If Ollama is not running, the app falls back to deterministic grounded content (no crash), but you will not get live model generation.

## Week 2 smoke test (Playwright)

This covers the Week 2 loop in UI:
practice failed attempt -> hint ladder (1/2/3) -> escalation -> add/update note -> verify in My Textbook.

1. Install deps: `npm i`
2. Install browser once: `npx playwright install chromium`
3. Run smoke only: `npm run test:e2e:week2`
4. Run all E2E specs: `npm run test:e2e`

## Week 2 reproducibility

Use `docs/week2-repro-compat.md` for a teammate-ready runbook covering:
- clickpath verification
- logging fields to validate
- replay mode behavior
- model defaults/params

For professor-ready demo artifacts (export JSON + screenshots), run:

```bash
npm run demo:week2
```

Demo script and acceptance checks:
- `docs/week2-demo.md`
- HintWise converter stability checks (`test:hintwise:convert`)

Note: `dist/week2-clickpath-*` folders are archived snapshots and can be stale. Use `npm run test:e2e:week2` + `test-results/.last-run.json` for current verification status.

## Notes

- App config is at `apps/web/vite.config.ts`.
- Replay fixture and SQL-Engage resources are under `apps/web/src/app/data/`.
- Reproducibility contract is documented in `docs/guidelines/week2-reproducibility.md`.
