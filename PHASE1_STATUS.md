# Phase 1 Status

Status: Ready for review. No production deployment performed.

## Part 1: condition_id logging

- Added idempotent `condition_id` support to `interaction_events` in the runtime schema and SQL migration.
- Wired the stored student condition through the bandit decision event, API validation, payload construction, and Neon persistence.
- Verified against the isolated `ep-royal-meadow` branch with synthetic adaptive and control events.
- Real results: migration DDL ran twice; both conditions persisted exactly; server contract, storage, build, and integrity tests passed.

## Part 2: section assignment scope

- Confirmed assignment is enrollment-driven, with first assignment persisted per student.
- Restricted assignment to enrolled `production` sections. Explicit section IDs are rejected unless enrolled and production; `test` and `pilot` are excluded.
- Both the shared analysis endpoint and isolated branch currently contain synthetic data: 110 sections, all `test`. No production backfill was performed.
- Real results: two synthetic students assigned across two distinct production sections; cross-section and QA-section requests were rejected; focused tests, build, integrity, and diff checks passed.

## Part 3: generated usernames

- Account registration and login remain email/password-only. The legacy username field is confined to local/demo mode; account mode redirects from `StartPage` to `/login` before showing it.
- Added server-generated usernames in the form `student-<6 random lowercase alphanumeric characters>` or `instructor-<6 random lowercase alphanumeric characters>`.
- Added database uniqueness and format enforcement, idempotent backfill for existing users, and retry-on-collision generation.
- Real results on the isolated branch: five concurrent synthetic signups returned HTTP 201, five concurrent email/password logins returned HTTP 200, all five usernames matched the format and were unique, and neither signup nor login responses surfaced a username field.
- Focused auth/generator tests: 19 passed. Server build, integrity checks, and diff validation passed.

## Scope and safety

- Database execution stayed on `SCHEMA_TEST_DATABASE_URL` / `ep-royal-meadow` for implementation tests.
- The shared `DATABASE_URL` / `ep-dry-cloud` audit was read-only using `BEGIN READ ONLY` and `ROLLBACK`; no writes were made there.
- Deployment and production changes are not included.
