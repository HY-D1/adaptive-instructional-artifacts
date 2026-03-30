# Beta First-Session Observation Checklist

**Version**: 1.0.0
**Audience**: Instructors and supervisors observing beta sessions
**Purpose**: Structured observation guide for first 3-10 student beta sessions
**Estimated Duration**: 30-45 minutes per session

---

## Pre-Session Setup (5 minutes)

### Environment Check

- [ ] Test URL accessible: https://adaptive-instructional-artifacts.vercel.app
- [ ] Backend health check passed: https://adaptive-instructional-artifacts-ap.vercel.app/health
- [ ] Class code ready for distribution
- [ ] Observation form printed or accessible
- [ ] Backup communication method ready (if technical issues)

### Student Preparation

- [ ] Students informed this is a beta test
- [ ] Students know to expect some rough edges
- [ ] Students understand their feedback is valuable
- [ ] Students have browsers ready (Chrome/Firefox/Safari/Edge)

---

## Session Information

| Field | Record |
|-------|--------|
| **Date** | |
| **Observer Name** | |
| **Student Name** | |
| **Student ID/Email** | |
| **Class Code Used** | |
| **Session Duration** | ___ minutes |
| **Problems Attempted** | |
| **Technical Issues?** | Yes / No |

---

## Observation Checklist

### Phase 1: Signup & Onboarding (5-7 minutes)

**Timing**: Start timer when student opens URL

| Checkpoint | Time | Status | Notes |
|------------|------|--------|-------|
| Student opens URL successfully | ___:___ | ✅ ❌ | |
| Welcome page loads without errors | ___:___ | ✅ ❌ | |
| Student enters name | ___:___ | ✅ ❌ | |
| Student selects "I am a Student" | ___:___ | ✅ ❌ | |
| Student enters class code | ___:___ | ✅ ❌ | |
| Class code accepted | ___:___ | ✅ ❌ | |
| **Onboarding complete** | ___:___ | ✅ ❌ | |

**Issues to watch for:**
- [ ] Class code rejection
- [ ] Page load errors
- [ ] Confusion about role selection
- [ ] Browser compatibility issues

---

### Phase 2: First Problem Load (2-3 minutes)

| Checkpoint | Time | Status | Notes |
|------------|------|--------|-------|
| Redirect to /practice page | ___:___ | ✅ ❌ | |
| Problem description visible | ___:___ | ✅ ❌ | |
| SQL editor loads with syntax highlighting | ___:___ | ✅ ❌ | |
| "Run Query" button visible | ___:___ | ✅ ❌ | |
| Navigation (Practice/Textbook) visible | ___:___ | ✅ ❌ | |

**Issues to watch for:**
- [ ] Blank/problem not loading
- [ ] Editor not rendering
- [ ] JavaScript errors in console

---

### Phase 3: Query Execution & Error Flow (5-10 minutes)

**Task**: Ask student to intentionally write an incorrect query

| Checkpoint | Time | Status | Notes |
|------------|------|--------|-------|
| Student types SQL query | ___:___ | ✅ ❌ | |
| Student clicks "Run Query" | ___:___ | ✅ ❌ | |
| Error message displays | ___:___ | ✅ ❌ | |
| Error is meaningful/helpful | ___:___ | ✅ ❌ | |
| "Need help?" button appears | ___:___ | ✅ ❌ | |

**Student reaction notes:**
- Did they understand the error? ___________________
- Was the error message helpful? ___________________
- Did they notice the "Need help?" button? ___________________

---

### Phase 4: Hint System Interaction (5-10 minutes)

**Task**: Ask student to click "Need help?" and observe

#### Rung 1 - Micro-Hint

| Checkpoint | Status | Notes |
|------------|--------|-------|
| Hint displays within 2 seconds | ✅ ❌ | |
| Hint is relevant to the problem | ✅ ❌ | |
| Student understands the hint | ✅ ❌ | |
| Student attempts fix based on hint | ✅ ❌ | |

**Rung 1 content quality:**
- Length appropriate (brief)? Yes / No
- Points to right concept? Yes / No
- Not giving away answer? Yes / No

#### Rung 2 - Strategic Hint

| Checkpoint | Status | Notes |
|------------|--------|-------|
| Student clicks for more help | ✅ ❌ | |
| Second hint displays | ✅ ❌ | |
| Hint builds on first | ✅ ❌ | |
| More detailed but not full answer | ✅ ❌ | |

**Rung 2 content quality:**
- Explains approach? Yes / No
- Provides context? Yes / No
- Still preserves learning? Yes / No

#### Rung 3 - Detailed Help

| Checkpoint | Status | Notes |
|------------|--------|-------|
| Student clicks for final hint | ✅ ❌ | |
| Third hint displays | ✅ ❌ | |
| Near-complete solution provided | ✅ ❌ | |
| Student can solve after this | ✅ ❌ | |

**Rung 3 content quality:**
- Clear explanation? Yes / No
- Student able to complete? Yes / No

**Overall Hint System Observations:**
- Were hints progressive (escalating appropriately)? ___________________
- Did student feel supported vs. given answers? ___________________
- Any hint content issues? ___________________

---

### Phase 5: Save-to-Notes Feature (3-5 minutes)

| Checkpoint | Status | Notes |
|------------|--------|-------|
| "Save to Notes" button visible | ✅ ❌ | |
| Student clicks "Save to Notes" | ✅ ❌ | |
| Success feedback displayed | ✅ ❌ | |
| Auto-save triggered (if applicable) | ✅ ❌ | |

**Save-to-notes observations:**
- Was button easy to find? Yes / No
- Did student understand what it does? Yes / No
- Success message clear? Yes / No

---

### Phase 6: Textbook Navigation (3-5 minutes)

**Task**: Ask student to click "My Textbook"

| Checkpoint | Time | Status | Notes |
|------------|------|--------|-------|
| Clicks "My Textbook" in nav | ___:___ | ✅ ❌ | |
| Textbook page loads | ___:___ | ✅ ❌ | |
| Saved note(s) visible | ___:___ | ✅ ❌ | |
| Note content readable | ___:___ | ✅ ❌ | |
| Concepts tagged correctly | ___:___ | ✅ ❌ | |
| Evidence/source linked | ___:___ | ✅ ❌ | |

**Textbook observations:**
- Notes saved correctly? Yes / No
- Content formatted well? Yes / No
- Student understands what they're seeing? Yes / No

---

### Phase 7: Resume/Refresh Test (3-5 minutes)

**Task**: Ask student to refresh the browser on Practice page

| Checkpoint | Status | Notes |
|------------|--------|-------|
| Student refreshes page | ✅ ❌ | |
| Page reloads without errors | ✅ ❌ | |
| Previous code/hints preserved | ✅ ❌ | |
| Session continues seamlessly | ✅ ❌ | |

**Resume observations:**
- Data persisted correctly? Yes / No
- Student position maintained? Yes / No
- Any data loss? Yes / No - describe: ___________________

---

## Post-Session Debrief (5 minutes)

### Student Feedback

Ask these questions and record responses:

| Question | Response (1-5) | Notes |
|----------|----------------|-------|
| How easy was it to get started? | 1 2 3 4 5 | |
| Were the hints helpful? | 1 2 3 4 5 | |
| Did you understand your textbook? | 1 2 3 4 5 | |
| Would you use this to learn SQL? | 1 2 3 4 5 | |

**Open-ended feedback:**
- What was most helpful? ___________________
- What was confusing? ___________________
- What would you change? ___________________

---

## Red Flags Summary

Mark any issues observed:

- [ ] **Critical**: Student unable to log in
- [ ] **Critical**: Page crashes or white screen
- [ ] **Critical**: Data loss on refresh
- [ ] **High**: Hints not appearing
- [ ] **High**: Textbook not saving
- [ ] **High**: Query execution fails completely
- [ ] **Medium**: Hint content irrelevant or wrong
- [ ] **Medium**: Error messages unhelpful
- [ ] **Medium**: Navigation confusing
- [ ] **Low**: UI layout issues
- [ ] **Low**: Minor visual glitches

---

## Technical Log

If issues occurred, record details:

| Issue | Time | Description | Error Message |
|-------|------|-------------|---------------|
| | | | |
| | | | |

**Browser console errors** (if checked):
```
Paste any red/error console messages here
```

---

## Overall Assessment

| Metric | Score | Notes |
|--------|-------|-------|
| Onboarding smoothness | 1-5 | |
| Hint system effectiveness | 1-5 | |
| Textbook functionality | 1-5 | |
| System stability | 1-5 | |
| Student satisfaction | 1-5 | |

### Go/No-Go Recommendation

- [ ] **Go**: Student completed session successfully, no critical issues
- [ ] **Caution**: Minor issues, recommend fixes before next session
- [ ] **No-Go**: Critical issues found, pause beta and fix

### Action Items

| Item | Priority | Owner | Due Date |
|------|----------|-------|----------|
| | | | |
| | | | |

---

## Session Summary Template

```
Session Date: ___
Student: ___
Observer: ___
Duration: ___ minutes

Key Observations:
-
-
-

Issues Found:
-
-

Student Feedback:
-
-

Recommendation: Go / Caution / No-Go
```

---

## Cohort Summary

After 3-10 sessions, summarize findings:

| Metric | Result |
|--------|--------|
| Total sessions completed | / planned |
| Successful completions | |
| Critical issues | |
| High priority issues | |
| Average student satisfaction | |
| Recommended next step | |

---

*Last Updated: 2026-03-30*
*For Beta Version: v1.0.0-beta*
