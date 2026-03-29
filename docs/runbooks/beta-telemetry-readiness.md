# Beta Telemetry Readiness Checklist

Generated: 2026-03-28 America/Vancouver

Purpose:
- Confirm first-user supervised beta observability is sufficient without schema redesign.

## Required Signals and Current Coverage

1. Hint request
- Covered by interaction writes from hint flow (`eventType: hint_view`).
- Frontend evidence: `apps/web/src/app/components/features/hints/HintSystem.tsx` logs hint interactions with escalation payload.
- Backend evidence: `apps/server/src/routes/neon-interactions.ts` persists writes and logs `[interaction/write]`.

2. Hint fallback reason
- Covered in hint interaction payload as `outputs.fallback_reason`.
- Frontend evidence: `HintSystem.tsx` maps fallback reason into interaction payload.

3. Retrieval confidence
- Covered in hint interaction payload as `outputs.retrieval_confidence`.
- Frontend evidence: `HintSystem.tsx` sends numeric retrieval confidence.

4. Answer attempt after hint
- Covered via `execution` / `error` interaction events in learning workflow after hint usage.
- Frontend evidence: `apps/web/src/app/pages/LearningInterface.tsx` logs query execution outcomes.

5. Concept panel opened
- Covered by concept navigation and concept-linked hint/context payloads (`conceptIds`).
- Frontend evidence: concept IDs and concept-related context are persisted in hint/textbook interactions.

6. Save-to-notes action
- Covered by textbook write flow and subsequent interaction logging.
- Frontend evidence: `LearningInterface.tsx` + `HintSystem.tsx` save-to-notes flow includes learner-visible error states and sync status.

7. Frontend/runtime errors
- Covered by learner-visible hint runtime error state (`data-testid=\"hint-runtime-error\"`) and backend route error responses.
- Frontend evidence: `HintSystem.tsx` runtime error banner and guarded fallback path.
- Backend evidence: `neon-interactions.ts` structured 4xx/5xx failure paths.

## Verification Commands Used

- `npx playwright test -c playwright.config.ts tests/e2e/regression/ux-bugs-save-to-notes.spec.ts tests/e2e/regression/ux-bugs-concept-readability.spec.ts --reporter=line`
- `npx playwright test -c playwright.config.ts --project=chromium:auth tests/e2e/regression/hint-stability-beta.spec.ts --no-deps --reporter=line`

## Caveat

- Preview backend protected-access contract remains blocked in this environment for Node preflight-style API checks (`/health` and `/api/corpus/manifest` return `401`), so telemetry checks are currently proven on production and local regression paths, not fully on preview backend API.
