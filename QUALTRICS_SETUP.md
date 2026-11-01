# Qualtrics Setup

This document describes the app-side contract for the Fall surveys. The app sends the student's generated `username`; it never sends `user_id` in a survey URL.

## App configuration

Set these server variables when the real survey URLs and deployment callback are confirmed:

- `QUALTRICS_PRE_SURVEY_URL`: base URL for the pre-activity survey.
- `QUALTRICS_POST_SURVEY_URL`: base URL for the post-activity survey.
- `QUALTRICS_COMPLETION_SIGNING_SECRET`: long random secret shared only with the app server. Keep it out of source control and logs.
- `WEB_APP_BASE_URL`: public app origin used for completion redirects, for example `https://your-app.example.edu`.

The app adds these query parameters to each base survey URL:

- `username`: generated value such as `student-a1b2c3`.
- `instance`: `pre` or `post`.
- `completion_token`: short-lived signed token. Do not edit or decode it in Qualtrics.

If the signing secret is missing, the app intentionally does not issue a survey link.

## Embedded Data

Declare these exact field names in the survey flow before the survey block:

- `username`
- `completion_token`
- `ResponseID`

`ResponseID` is normally a Qualtrics system value. Whether it must also be declared as Embedded Data depends on the selected Qualtrics workflow and is **unverified**.

## Username question

Use the `username` Embedded Data value to prefill the visible username question with this Default Choice piping expression:

```text
${e://Field/username}
```

The exact Qualtrics question ID and whether Default Choice piping is enabled for the selected question type are **unverified** until the professor confirms the instrument.

Make the prefilled username field read-only with this question JavaScript:

```javascript
Qualtrics.SurveyEngine.addOnload(function () {
  var container = this.getQuestionContainer();
  var field = container.querySelector('input[type="text"]');
  if (!field) return;

  field.readOnly = true;
  field.setAttribute('aria-readonly', 'true');
  field.setAttribute('tabindex', '-1');
});
```

The exact Qualtrics question markup is **unverified**; if the question uses a different input type, adjust the selector while preserving read-only behavior.

## End-of-Survey redirect

Configure the End-of-Survey element to redirect to the deployed app callback. Use one fixed destination per survey instance; do not accept a user-supplied redirect target.

Pre-survey format:

```text
https://<deployed-app-host>/api/surveys/complete?instance=pre&username=${e://Field/username}&completion_token=${e://Field/completion_token}&ResponseID=${e://Field/ResponseID}
```

Post-survey format:

```text
https://<deployed-app-host>/api/surveys/complete?instance=post&username=${e://Field/username}&completion_token=${e://Field/completion_token}&ResponseID=${e://Field/ResponseID}
```

The deployed callback host and the exact Qualtrics piping syntax for `ResponseID` are **unverified** and are deployment-time to-dos. Set `WEB_APP_BASE_URL` in every deployment before enabling completion redirects. The callback endpoint accepts no app cookie and redirects to the practice or pre-survey screen after successful completion.

Do not add `user_id` to the survey URL, Embedded Data, redirect, or logs.

## Resume and reconciliation

Leaving a survey unfinished leaves its invitation pending. Opening the same invitation again issues a fresh signed token. An expired token redirects to the pre-survey screen with a friendly retry message; the student should return to the app for a fresh link.

For analysis reconciliation, run:

```bash
SURVEY_LINKAGE_DATABASE_URL=<read-only-database-url> \
  node scripts/verification/check-survey-linkage.mjs <qualtrics-export.json>
```

The JSON export must contain an array, or an object with a `responses` array. Each response must provide `ResponseID` (or `responseId`) and may provide `username` (or `Username`). The script uses a read-only transaction and classifies completed invitations as:

- `verified`: response username exactly matches the invitation snapshot.
- `unverified`: response username is missing.
- `quarantine`: response username does not match the snapshot.
- `responseAbsentFromExport`: the invitation's stored `ResponseID` is missing from the supplied export.

The script never updates invitation records or replaces the stored username snapshot.
