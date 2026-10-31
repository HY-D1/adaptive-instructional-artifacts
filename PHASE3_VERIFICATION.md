# Phase 3 Verification

Date: 2026-10-08
Branch/database: isolated `ep-royal-meadow` via `SCHEMA_TEST_DATABASE_URL`

## UI wiring

`control/STATUS.md` identified a real gap: `LearningInterface` exposed the authenticated `sectionId` but did not pass it into condition assignment. Fixed by threading `authUser.sectionId` through `loadSessionConfigAsync()` to `getOrAssignStudentCondition()`.

The existing assignment tests passed after the change: 62 tests.

## Journey

The real built server handled 24 synthetic email/password-only student signups across two eligible production sections. Each student received a unique generated username. Assignment was requested through the real condition-assignment endpoint with the student's real section ID.

The journey's interaction events were posted directly by the verification harness to the real `/api/interactions` endpoint. They did not originate from a browser running `LearningInterface`, `HintSystem`, `dual-storage`, or the frontend storage client. The real client hint-rendering path remains unverified end to end.

- Students created: 24
- Unique usernames: yes
- Adaptive students: 11
- Control students: 13
- Pre-survey pending session gate: HTTP 403
- Signed pre-survey completion: succeeded for all students
- Second session after completion: succeeded for all students
- Post-survey trigger from an attempt: succeeded for all students
- Signed post-survey completion: exercised by the journey

## Assignment counts

| Section | Adaptive | Control | Total |
| --- | ---: | ---: | ---: |
| Section A | 5 | 7 | 12 |
| Section B | 6 | 6 | 12 |
| **Total** | **11** | **13** | **24** |

Assignments remained stable when each student logged in again and created a second session.

## Event audit

The journey created 87 interaction events.

- Events with NULL or `default` `condition_id`: 0
- Events whose `condition_id` differed from the student's stored assignment: 0
- Every audited event matched the student's durable assignment: yes

## Control rule

The real control decision helper was exercised by the harness for control students on two problem IDs:

- Attempts 1 and 2: `stay_hint` / conservative
- Attempt 3: `show_explanation` / explanation-first
- New problem attempt 1: `stay_hint` / conservative

The counter reset on the new problem for every control student.

For a real client run, the corresponding strategy is stored inside the interaction event's JSON `outputs` field as `orchestration_action`, `orchestration_reason`, and `orchestration_trigger_reason`; the top-level `action` column is not the real UI's canonical strategy field.

## Survey audit

- Pre invitations: 24
- Post invitations: 24
- Invitation username mismatches against `users.username`: 0
- Pre-survey completion opened the gated session path: yes
- Post-survey completion recorded a response ID: yes

## Validation

- Part C reconciliation classification test: passed
- Assignment tests: 62 passed
- Server build: passed
- Web build: passed
- Integrity scan: passed
- Diff validation: passed

All synthetic users, sections, assignments, events, sessions, and invitations were cleaned up after the isolated run. No production or shared analysis database was contacted or modified.
