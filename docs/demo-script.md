# SQL-Adapt Professor Demo Script

**Version**: 1.0.0  
**Last Updated**: 2026-03-15  
**Duration**: 5 minutes  
**Audience**: Professors, stakeholders, demo reviewers

---

## Overview

This script demonstrates the core adaptive learning flow:
1. **Student login** → Role selection
2. **SQL Practice** → Error → Progressive hints
3. **Automatic Textbook** → Personalized note accumulation

### Demo Modes

| Mode | Use Case | Features Available |
|------|----------|-------------------|
| **Local** | Development, full feature showcase | All features including LLM, PDF (if configured) |
| **Hosted** | Vercel demo, stakeholder review | Core learning flow (deterministic hints, textbook) |

---

## Quick Start

### Prerequisites

```bash
# Local mode
npm run dev
# Open http://localhost:5173

# Hosted mode (Vercel)
# Open deployed URL (e.g., https://your-project.vercel.app)
```

### Clean State (Optional)

```javascript
// Run in browser console before demo
localStorage.clear();
location.reload();
```

---

## Demo Path: Student Learning Journey

### Step 1: Start Page & Login (30 seconds)

**Local Path:**
1. Open app at `http://localhost:5173`
2. Observe: Clean start page with username input
3. Enter name: `DemoStudent`
4. Select: **"I am a Student"**
5. Click: **"Get Started"**

**Hosted Path:**
1. Open deployed Vercel URL
2. Same steps as local
3. *Note: Instructor mode requires VITE_INSTRUCTOR_PASSCODE build config*

**Expected Outcome:**
- Redirects to `/practice`
- Shows "Practice SQL" heading
- Problem 1 displayed with SQL editor

**Fallback (if redirect fails):**
- Manually navigate to `/practice`
- Or check browser console for errors

---

### Step 2: Practice Page Overview (30 seconds)

**Show and explain:**
1. **Problem Panel** (top-left): Natural language problem description
2. **SQL Editor** (center): Monaco editor with syntax highlighting
3. **Hint Panel** (right): "Need help?" button (currently hidden until error)
4. **Navigation**: Practice | Textbook links in header

**Key talking point:**
> "Students practice SQL problems. When they struggle, the system provides progressive hints—not immediate answers."

---

### Step 3: Trigger Error & Request Hints (2 minutes)

**Action - Enter invalid SQL:**
```sql
SELECT * FROM users
WHERE created_at > '2024-01-01'
-- Intentionally incomplete: missing semicolon, or try:
-- SELECT * FROM nonexistent_table
```

**Click:** "Run Query"

**Expected:**
- Error message appears (e.g., "syntax error")
- "Need help?" button becomes visible

**Action - Request hints progressively:**

1. **First click** (Rung 1 - Micro-hint):
   - Shows brief hint (~100 chars)
   - Points to missing concept
   - *Example: "Check your WHERE clause syntax"*

2. **Second click** (Rung 2 - Strategic hint):
   - More detailed explanation
   - How to approach the problem
   - *Example: "The WHERE clause needs proper date formatting"*

3. **Third click** (Rung 3 - Error diagnosis):
   - Corrective explanation
   - Near-complete solution
   - *Example: "Use YYYY-MM-DD format: '2024-01-01'"*

**Talking points:**
> "This is the 3-rung guidance ladder. Students get just enough help to progress, preserving productive struggle."

**Hosted Mode Note:**
- Hints come from SQL-Engage dataset (deterministic)
- Same progression, no LLM generation

---

### Step 4: Solve & Verify (30 seconds)

**Action - Enter correct SQL:**
```sql
SELECT * FROM users
WHERE created_at > '2024-01-01';
```

**Click:** "Run Query"

**Expected:**
- Results table appears
- Success state in UI

---

### Step 5: Automatic Textbook (1 minute)

**Action:** Click **"My Textbook"** in navigation

**Expected:**
- Navigate to `/textbook`
- Shows "My Learning Journey" heading
- **At least one note** should be visible from the practice session

**Show and explain:**
1. **Note content**: Explanation from the hints just shown
2. **Concept tagging**: Each note tagged with SQL concepts (e.g., "WHERE clause")
3. **Auto-creation**: "This note was created automatically when you struggled"

**Talking point:**
> "The 'Automatic Textbook' accumulates personalized notes from every struggle. Students build their own study guide."

**Hosted Mode Note:**
- Textbook persists to localStorage
- Same behavior as local mode
- No backend required

---

### Step 6: Instructor View (Optional, 1 minute)

**If instructor mode is available:**

1. Log out (click user menu → Logout)
2. Login as Instructor (requires passcode on hosted)
3. Navigate to **Research Dashboard**
4. Show: Interaction traces, concept coverage

**Hosted Mode Note:**
- Instructor mode requires VITE_INSTRUCTOR_PASSCODE at build time
- If unavailable, skip this step

---

## Smoke-Check Commands

### Pre-Demo Verification

```bash
# 1. Build check
npm run build

# 2. TypeScript check  
npx tsc --noEmit

# 3. Unit tests
npm run test:unit

# 4. Quick E2E smoke (optional)
npx playwright test tests/e2e/smoke.spec.ts
```

### In-Browser Smoke Check

```javascript
// Run in browser console

// 1. Check runtime mode
import('./lib/runtime-config.ts').then(m => {
  console.log('Mode:', m.getRuntimeConfig());
});

// 2. Verify storage works
localStorage.setItem('smoke-test', 'ok');
console.log('Storage:', localStorage.getItem('smoke-test'));

// 3. Check problems loaded
console.log('Problems:', (window as any).sqlProblems?.length);

// 4. Verify interactions logged
import('./lib/storage.ts').then(m => {
  console.log('Interactions:', m.storage.getInteractions().length);
});
```

---

## Local-Only vs Hosted-Safe Features

### Always Available (Both Modes)

| Feature | Description |
|---------|-------------|
| SQL Practice | 32 problems, in-browser execution |
| 3-Rung Hints | Progressive escalation |
| SQL-Engage Hints | Deterministic templates |
| Automatic Textbook | localStorage persistence |
| HDI Calculation | Client-side from traces |
| Research Dashboard | Deterministic replay |

### Local-Only (Requires Setup)

| Feature | Why Local-Only |
|---------|----------------|
| LLM Explanations | Requires Ollama server |
| PDF Upload/Search | Requires backend + Poppler |
| Backend Persistence | Requires API server |

### Hosted-Safe Demo Path

The 5-minute demo above uses **only hosted-safe features**:
- ✅ Student login
- ✅ SQL practice with errors
- ✅ Progressive hints (deterministic)
- ✅ Automatic textbook

---

## Fallback Paths

### If Hints Don't Appear

1. Check that SQL error occurred (run invalid query)
2. Verify "Need help?" button visible
3. Try refreshing page
4. Check browser console for errors

### If Textbook is Empty

1. Ensure at least one hint was viewed
2. Navigate away and back to textbook
3. Check localStorage: `localStorage.getItem('sql-learning-textbook')`
4. If still empty, textbook may not have auto-created (check concept coverage)

### If Hosted Mode Shows Limitations

**Message:** "This feature requires local deployment"

**Response:**
> "On the hosted demo, we use deterministic hints instead of AI. The learning flow is identical—just the content source differs. In production with a backend, this would use LLM-generated explanations."

---

## Demo Success Criteria

| Check | Expected |
|-------|----------|
| Student can log in | Redirects to /practice |
| SQL editor works | Can type and run queries |
| Error triggers hints | "Need help?" appears after error |
| Progressive hints work | 3 levels of increasing detail |
| Textbook auto-creates | At least 1 note after hints |
| Navigation works | Can switch between Practice and Textbook |

---

## Related Documentation

- [DEPLOYMENT_MODES.md](./DEPLOYMENT_MODES.md) - Full capability matrix
- [runbooks/weekly-demo.md](./runbooks/weekly-demo.md) - Developer-focused deep dive
- [README.md](../README.md) - Project overview

---

*Last updated: 2026-03-15*
