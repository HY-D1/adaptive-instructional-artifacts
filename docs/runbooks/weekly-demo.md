# Demo Clickpath — Weekly

**Purpose**: consistent operator flow for Week 5 MVP demos  
**Prerequisites**: `npm run dev` running  
**Duration**: ~5 minutes

**Note**: For professor-facing demo script, see [../demo-script.md](../demo-script.md).

Progress logging for this demo belongs only in `docs/runbooks/status.md`.

---

## Setup

1. Start app:
   ```bash
   npm run dev
   ```
2. Open `http://localhost:5173`.
3. Select "I am a Student" on the StartPage.
4. Optional clean state: clear `sql-learning-*` and `sql-adapt-*` keys in LocalStorage.

---

## Clickpath

### 1) Practice Entry

1. Open app and dismiss welcome modal if shown.
2. Confirm layout: problem prompt, SQL editor, help panel, top nav.
3. **Week 5**: Verify profile badge visible in DEV mode (top-right corner).

### 2) Verify Week 5 Debug Controls (DEV Mode)

1. Navigate to Settings page.
2. Confirm Week 5 Testing Controls section visible (DEV mode only).
3. Verify Profile Override dropdown has 4 options:
   - Auto (Bandit)
   - Fast Escalator
   - Slow Escalator
   - Adaptive
   - Explanation First
4. Verify Assignment Strategy radio buttons:
   - Static
   - Diagnostic
   - Bandit
5. Verify HDI section shows current score.
6. Verify Bandit panel shows arm statistics (4 arms).

### 3) Test Profile Override

1. Select "Fast Escalator" from Profile Override.
2. Navigate back to Practice page.
3. Verify profile badge shows "Fast Escalator" (blue).
4. Make a SQL error and verify escalation threshold is 2 errors.

### 4) Trigger Error and Check HDI

1. Enter invalid SQL:
   ```sql
   SELECT
   ```
2. Click `Run Query` to trigger error.
3. Request hints multiple times.
4. Navigate to Settings → verify HDI score updated.
5. If HDI > 0.8, verify dependency warning toast appears.

### 5) Verify Bandit Logging

1. Continue practicing with multiple problems.
2. Navigate to Research Dashboard.
3. Switch to Week 5 tab.
4. Verify:
   - Profile distribution chart shows data
   - HDI distribution chart shows data
   - Bandit arm selection events logged

### 6) Verify Textbook

1. Navigate to `My Textbook`.
2. Confirm at least one note exists with concept grounding.
3. **Week 5**: Verify notes include profile context.

### 7) Verify Research Export

1. Navigate to `Research`.
2. Export active session JSON.
3. Run validation checks below against `dist/weekly-demo/export.json`.

---

## Validation Commands

```bash
cd dist/weekly-demo

# Week 3 baseline checks
jq '[.interactions[] | select(.eventType=="hint_view") | .hintLevel] | max' export.json
jq '[.interactions[] | select(.eventType=="hint_view") | has("hintId") | not] | all' export.json
jq '[.interactions[] | has("sessionId") and (.sessionId!="")] | all' export.json

# Week 7+ checks (condition_assigned is canonical; profile_assigned = legacy compat)
jq '[.interactions[] | select(.eventType=="condition_assigned")] | length' export.json
jq '[.interactions[] | select(.eventType=="profile_assigned")] | length' export.json
jq '[.interactions[] | select(.eventType=="hdi_calculated")] | length' export.json
jq '[.interactions[] | select(.eventType=="bandit_arm_selected")] | length' export.json
jq '[.interactions[] | select(.eventType=="guidance_escalate")] | length' export.json
jq '[.interactions[] | select(.eventType=="textbook_add")] | length' export.json
```

---

## Expected Results

| Check | Expected |
|------|----------|
| max hint level | `3` |
| no `hintId` in `hint_view` | `true` |
| all `sessionId` non-empty | `true` |
| **condition_assigned count** | `>= 1` |
| profile_assigned count (legacy) | `>= 0` |
| **hdi_calculated count** | `>= 1` |
| **bandit_arm_selected count** | `>= 1` |
| explanation count | `>= 1` |
| total help requests | `>= 4` |
| textbook_add count | `>= 1` |

---

## Week 5 Feature Checklist

| Feature | Verification |
|---------|-------------|
| Profile Badge | Visible in DEV mode, shows current profile |
| Profile Override | Settings dropdown changes profile |
| HDI Display | Settings shows current HDI score |
| Dependency Toast | Appears when HDI > 0.8 |
| Progress Hints | Appears every ~15 interactions |
| Bandit Stats | Settings shows arm statistics |
| Force Arm | Can manually select arm in Settings |
| Event Logging | All 9 Week 5 events logged |

---

## Profile Badge Colors

| Profile | Color | Badge Text |
|---------|-------|------------|
| Fast Escalator | 🔵 Blue | "Fast" |
| Slow Escalator | 🟡 Yellow | "Slow" |
| Adaptive | 🟢 Green | "Adaptive" |
| Explanation First | 🟣 Purple | "Explain" |

---

## HDI Thresholds

| HDI Range | Level | Action |
|-----------|-------|--------|
| 0.0 - 0.3 | Low | Independent learner |
| 0.3 - 0.6 | Medium | Monitor |
| 0.6 - 0.8 | High | Watch closely |
| **> 0.8** | **Critical** | **Trigger warning toast** |

---

## Quick Troubleshooting

- **No profile badge**: Ensure `import.meta.env.DEV` is true
- **No debug controls**: Settings page only shows Week 5 controls in DEV mode
- **Profile override not working**: Check localStorage `sql-adapt-debug-profile`
- **HDI not updating**: Requires multiple interactions (executions + errors)
- **Bandit stats empty**: New learners start with uniform priors (all arms equal)
- **No Week 5 events**: Ensure logging functions called in LearningInterface

---

*Last updated: 2026-02-28*  
*Week 5 Demo Additions: Profile badge, HDI display, Bandit stats, Debug controls*
