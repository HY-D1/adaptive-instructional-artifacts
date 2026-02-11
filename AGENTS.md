# ALGL Project — Codex Instructions (AGENTS.md)

## Project outcome (north star)
Build:
1) A working automatic “My Notes / My Textbook” prototype for SQL learning from interaction traces.
2) Defensible experimental evidence comparing adaptive strategies via offline replay on logs.

## Non-negotiables
- File-first: inspect existing code + provided zips (SQL-Engage, HintWise) before changing anything.
- Minimal diffs: prioritize the smallest end-to-end demo loop over broad refactors.
- Reproducibility: add logs + policy versioning; every experiment must be replayable.
- Controlled LLM usage: retrieval-first, generation-second; avoid unconstrained generation.
- No secrets: never commit API keys; use env vars.

## Week 2 target (minimal interface)
Deliver a demo that shows the full loop:
Practice attempt → Hint ladder (level 1/2/3) → Escalate (if needed) → Add/update a “My Notes” unit
AND a basic Research/Teacher view to export traces + compare at least two strategies:
- hint-only baseline
- adaptive textbook policy

## Data contracts (verify against files; do not assume)
- SQL-Engage: used as knowledge backbone to map (error subtype → concept → feedback templates).
- HintWise: used as the hint-level progression ladder (levels + escalation policy). If full integration is heavy, implement the ladder locally and use SQL-Engage content as the hint payload.

## Implementation rules
1) Read the codebase map first
   - Identify current UI surfaces (Practice / My Textbook / Research) and the orchestrator/decision layer.
   - Identify existing event logging and storage format.
2) Add/modify ONE seam at a time
   - Seam A: error/subtype detection (may start as “wizard-of-oz” selector if runtime mapping is brittle).
   - Seam B: hint ladder selection + escalation triggers.
   - Seam C: textbook unit creation/dedup + evidence links to trace events.
3) Always keep decisions inspectable
   - Every intervention stores: policy_version, rule_fired, inputs (retry count, hint count, time), and outputs (hint/explain/note IDs).
4) Prefer deterministic selection
   - When multiple templates exist, choose deterministically (stable hash on learnerId/problemId/hintLevel) so replay is consistent.

## Testing expectations
- If tests exist: run them (unit + typecheck + lint) before finalizing.
- If no tests exist: add a tiny “toy trace” fixture and a script to run one replay pass.

## Output format for each Codex task
- Summary (1–3 bullets)
- Files changed (list)
- How to test (exact commands)
- What was logged / policy version (string)
- Risks / assumptions

## Guardrails for research claims
Offline replay shows what the policy WOULD do on logged traces; it does not prove learning gains.
Keep language precise in docs and demo notes.
