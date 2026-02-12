# Week 2 Demo Script

This demo validates the Week 2 minimal loop:

Attempt -> Error -> Hint ladder (1/2/3) -> Escalate (`explanation_view`) -> Optional Add to My Notes -> Export active-session log

## 1) Generate demo artifacts

```bash
npm i
npx playwright install chromium
npm run demo:week2
```

Expected artifacts:

- `dist/week2-demo/export.json`
- `dist/week2-demo/hint-panel.png`
- `dist/week2-demo/research-export-scope.png`

## 2) Acceptance checks on `export.json`

```bash
jq '[.interactions[] | select(.eventType=="hint_view") | .hintLevel] | max' dist/week2-demo/export.json
jq '[.interactions[] | select(.eventType=="hint_view") | has("hintId")] | any' dist/week2-demo/export.json
jq '[.interactions[] | has("sessionId") and (.sessionId!="")] | all' dist/week2-demo/export.json
jq '[.interactions[] | select(.eventType=="hint_view") |
      (has("sqlEngageSubtype") and has("sqlEngageRowId") and has("policyVersion")
       and (.sqlEngageSubtype!="") and (.sqlEngageRowId!="") and (.policyVersion!=""))
    ] | all' dist/week2-demo/export.json
jq '[.interactions[] | select(.eventType=="explanation_view")] | length' dist/week2-demo/export.json
jq '[.interactions[] | select(.eventType=="hint_view" or .eventType=="explanation_view")] | length' dist/week2-demo/export.json
```

Expected values:

1. `3`
2. `false`
3. `true`
4. `true`
5. `>= 1`
6. `>= 4`

## 3) Full QA gate

```bash
npm run test:e2e:week2
npm run demo:week2
```

## 4) Path hygiene check (copy-paste)

```bash
test -f docs/week2_progress.md
test -f docs/week2-demo.md
test -f docs/week2-repro-compat.md
test -f docs/guidelines/project-guidelines.md
test -f docs/guidelines/week2-reproducibility.md
```

## 5) Policy/version notes

- SQL-Engage policy string: `sql-engage-index-v2-progressive`
- Export policy string: `week2-export-sanitize-v1`
