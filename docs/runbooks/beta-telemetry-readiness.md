# Beta Telemetry Readiness Checklist

Generated: 2026-03-28 America/Vancouver
Last audited: 2026-03-29 (Workstream 3 - Beta Telemetry Readiness Audit)
Finalized: 2026-03-30 (Workstream 6 - Documentation Updates)

**Status**: READY FOR CONTROLLED STUDENT BETA LAUNCH
**Release**: `v1.1.0-beta-50` on `main` (`91e7696c044e6c65b9c348609d79dd8de612d0d4`, merged PR `#17`)

> 2026-04-07 audit note: this checklist predates the conference-grade Neon paper-data audit. Treat the older `concept_view`, auth telemetry, and `hintId` gap language below as superseded for paper-readiness decisions; use `docs/audit/paper-data-contract-freeze-2026-04-07.md`, `docs/audit/neon-research-readiness-runtime-audit-2026-04-07.md`, and `docs/audit/paper-data-readiness-2026-04-07.md` instead. That audit found real production-row gaps and local patches that still require deployment and re-audit before student data collection.

Purpose:
- Confirm first-user supervised beta observability is sufficient without schema redesign.
- Session persistence hardening is tracked separately from telemetry scope; partial session writes now preserve stored condition flags and policy values.

## Required Signals and Current Coverage

### 1. Hint request
- **Status**: IMPLEMENTED
- Covered by interaction writes from hint flow (`eventType: hint_view`).
- Frontend evidence: `apps/web/src/app/components/features/hints/HintSystem.tsx` logs hint interactions with escalation payload.
- Backend evidence: `apps/server/src/routes/neon-interactions.ts` persists writes and logs `[interaction/write]`.

### 2. Hint fallback reason
- **Status**: IMPLEMENTED
- Covered in hint interaction payload as `outputs.fallback_reason`.
- Frontend evidence: `HintSystem.tsx:997` maps fallback reason into interaction payload.
- Backend evidence: `apps/server/src/types.ts:272` outputs field supports fallback_reason.

### 3. Retrieval confidence
- **Status**: IMPLEMENTED
- Covered in hint interaction payload as `outputs.retrieval_confidence`.
- Frontend evidence: `HintSystem.tsx:996` sends numeric retrieval confidence.
- Backend evidence: `apps/server/src/types.ts:272` outputs field supports retrieval_confidence.

### 4. Answer attempt after hint
- **Status**: IMPLEMENTED
- Covered via `execution` / `error` interaction events in learning workflow after hint usage.
- Frontend evidence: `apps/web/src/app/pages/LearningInterface.tsx:1475` logs query execution outcomes.
- Backend evidence: `apps/server/src/types.ts:161-181` EventType includes 'execution' and 'error'.
- Notes: Can correlate with prior hint_view events via sessionId and problemId.

### 5. Concept panel opened
- **Status**: PARTIALLY IMPLEMENTED
- Covered by concept navigation and concept-linked hint/context payloads (`conceptIds`).
- Frontend evidence: concept IDs and concept-related context are persisted in hint/textbook interactions.
- Gap: No explicit `concept_view` event type; engagement inferred from conceptIds arrays.
- Mitigation: Sufficient for beta - concept engagement can be derived from related events.

### 6. Save-to-notes action
- **Status**: IMPLEMENTED
- Covered by textbook write flow and subsequent interaction logging.
- Frontend evidence: `LearningInterface.tsx:1418` + `HintSystem.tsx:297` save-to-notes flow includes learner-visible error states and sync status.
- Backend evidence: `apps/server/src/types.ts:170` includes 'textbook_unit_upsert' EventType.
- Event types: `textbook_add` (new) or `textbook_update` (existing), with `savedToNotes` flag.

### 7. Frontend/runtime errors
- **Status**: IMPLEMENTED
- Covered by learner-visible hint runtime error state (`data-testid="hint-runtime-error"`) and backend route error responses.
- Frontend evidence: `HintSystem.tsx:1465` runtime error banner and guarded fallback path.
- Backend evidence: `neon-interactions.ts:211-217` structured 4xx/5xx failure paths.

### 8. Auth success/failure events
- **Status**: PARTIALLY IMPLEMENTED
- Auth success/failure tracked via HTTP responses and server logs.
- Frontend evidence: `apps/web/src/app/lib/api/auth-client.ts` returns success/failure results.
- Backend evidence: `apps/server/src/routes/auth.ts` logs validation errors and server errors.
- Gap: Auth events NOT stored as InteractionEvent in research database.
- Mitigation: Server logs sufficient for operational debugging during beta.

## Event Types Catalog (31 Total)

Research-relevant event types defined in `apps/server/src/types.ts`:

**Core Learning Events**: `code_change`, `execution`, `error`, `hint_request`, `hint_view`, `explanation_view`

**Guidance Ladder Events**: `guidance_request`, `guidance_view`, `guidance_escalate`

**Textbook Events**: `textbook_unit_upsert`, `textbook_add`, `textbook_update`, `source_view`

**Chat/Content Events**: `chat_interaction`, `textbook_unit_shown`, `concept_extraction`

**Adaptive System Events**: `profile_assigned`, `escalation_triggered`, `profile_adjusted`, `bandit_arm_selected`, `bandit_reward_observed`, `bandit_updated`, `hdi_calculated`, `hdi_trajectory_updated`, `dependency_intervention_triggered`

**Reinforcement Events**: `reinforcement_scheduled`, `reinforcement_prompt_shown`, `reinforcement_response`

**Knowledge Structure Events**: `prerequisite_violation_detected`, `mastery_updated`, `reflection_quality_assessed`, `learning_path_recommended`

**System Events**: `llm_generate`, `pdf_index_rebuilt`, `pdf_index_uploaded`, `coverage_change`, `condition_assigned`

## Verification Commands Used

- `npx playwright test -c playwright.config.ts tests/e2e/regression/ux-bugs-save-to-notes.spec.ts tests/e2e/regression/ux-bugs-concept-readability.spec.ts --reporter=line`
- `npx playwright test -c playwright.config.ts --project=chromium:auth tests/e2e/regression/hint-stability-beta.spec.ts --no-deps --reporter=line`

## Key Telemetry Files

**Frontend**:
- `apps/web/src/app/components/features/hints/HintSystem.tsx` - Hint telemetry
- `apps/web/src/app/pages/LearningInterface.tsx` - Execution/error telemetry
- `apps/web/src/app/lib/api/storage-client.ts` - API client for telemetry
- `apps/web/src/app/types/index.ts` - Frontend event type definitions

**Backend**:
- `apps/server/src/routes/neon-interactions.ts` - Interaction persistence
- `apps/server/src/types.ts` - Backend event type definitions
- `apps/server/src/routes/auth.ts` - Auth endpoint logging

## Final Audit Results Summary

**Workstream 3 Audit Date**: 2026-03-29
**Workstream 6 Finalization**: 2026-03-30
**Auditor**: Implementer Agent
**Overall Status**: READY FOR CONTROLLED STUDENT BETA LAUNCH

### Verified Signals (All Critical Signals IMPLEMENTED)

| Signal | Status | Evidence Location |
|--------|--------|-------------------|
| hint_request | IMPLEMENTED | `HintSystem.tsx:964`, `neon-interactions.ts:72` |
| hint_fallback_reason | IMPLEMENTED | `HintSystem.tsx:997`, `types.ts:272` |
| retrieval_confidence | IMPLEMENTED | `HintSystem.tsx:996`, `types.ts:272` |
| answer_after_hint | IMPLEMENTED | `LearningInterface.tsx:1475`, `types.ts:161-181` |
| save_to_notes | IMPLEMENTED | `LearningInterface.tsx:1418`, `types.ts:170` |
| frontend_runtime_errors | IMPLEMENTED | `HintSystem.tsx:1465`, `ErrorBoundary.tsx:48-52` |
| concept_page_open | PARTIALLY_IMPLEMENTED | Concept engagement inferred from conceptIds |
| auth_success_failure | PARTIALLY_IMPLEMENTED | Tracked via HTTP responses and server logs |

### Telemetry Gaps (Non-Blocking for Beta)

| Gap | Impact | Mitigation |
|-----|--------|------------|
| No explicit concept_view event | Cannot directly measure concept page engagement | Concept engagement inferred from conceptIds in hint/textbook events |
| Auth events not in research DB | Cannot correlate auth issues with learning outcomes | Server logs available for operational debugging |
| No explicit page_view telemetry | Page-level analytics limited | Vercel Analytics provides operational metrics |

`hint_view` continuing to omit `hintId` is intentional in the current research/export contract and is not a telemetry bug for this beta-hardening pass.

### Event Types Catalog: 31 Total

All event types verified in `apps/server/src/types.ts`:
- Core Learning: `code_change`, `execution`, `error`, `hint_request`, `hint_view`, `explanation_view`
- Guidance Ladder: `guidance_request`, `guidance_view`, `guidance_escalate`
- Textbook: `textbook_unit_upsert`, `textbook_add`, `textbook_update`, `source_view`
- Adaptive System: `profile_assigned`, `escalation_triggered`, `profile_adjusted`, `bandit_arm_selected`
- Reinforcement: `reinforcement_scheduled`, `reinforcement_prompt_shown`, `reinforcement_response`
- Knowledge Structure: `prerequisite_violation_detected`, `mastery_updated`, `reflection_quality_assessed`

### Beta Launch Telemetry Checklist

- [x] All critical beta signals implemented and verified
- [x] Event types cataloged (31 total)
- [x] Frontend telemetry files identified and documented
- [x] Backend telemetry routes verified
- [x] Gaps documented with mitigations
- [x] Post-launch monitoring plan defined

### Post-Launch Monitoring

| Check | Frequency | Tool/Method |
|-------|-----------|-------------|
| Monitor student interaction events flow | Daily | Neon Database / interaction_events table |
| Verify hint request telemetry | Daily | hint_view events with escalation payloads |
| Check for frontend runtime errors | Daily | Vercel Analytics + browser console |
| Validate answer-after-hint correlation | Weekly | execution/error events correlated with hint_view |

These gaps are acceptable for the controlled student beta launch and do not require schema redesign.

## Caveat

- Preview backend protected-access contract remains blocked in this environment for Node preflight-style API checks (`/health` and `/api/corpus/manifest` return `401`), so telemetry checks are currently proven on production and local regression paths, not fully on preview backend API.
