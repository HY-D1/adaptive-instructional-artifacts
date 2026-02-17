# Demo Clickpath — Weekly Progress

**Purpose**: Step-by-step instructions for demonstrating the Week 2 MVP features  
**Prerequisites**: App built and running (`npm run dev`)  
**Expected Duration**: ~5 minutes

---

## Setup

1. Start the dev server:
   ```bash
   npm run dev
   ```

2. Open browser to `http://localhost:5173`

3. Clear localStorage to start fresh (optional):
   - Open DevTools → Application → LocalStorage
   - Delete all `sql-learning-*` keys

---

## Demo Steps

### Step 1: Welcome & Practice Interface

1. **Open the app**
   - You should see the SQL practice interface
   - A welcome modal may appear (dismiss it)

2. **Observe the layout**
   - Left: Problem description
   - Center: Monaco SQL editor
   - Right: Hint system panel
   - Top nav: "Practice", "My Textbook", "Research"

### Step 2: First Error + L1 Hint

1. **Type an incomplete query** in the editor:
   ```sql
   SELECT * FROM
   ```
   (Don't complete it - leave it as an incomplete query)

2. **Click "Run Query"**
   - You should see an error message
   - The error subtype should be detected (e.g., "incomplete_query")

3. **Click "Get Hint"**
   - **Observe**: L1 (Level 1) hint appears
   - **Verify**: Hint is subtle/guiding, not giving away the answer
   - **Note**: The hint comes from SQL-Engage dataset

### Step 3: Second Error + L2 Hint

1. **Clear the editor** (Ctrl+A, Delete)

2. **Type another problematic query**:
   ```sql
   SELECT name FROM employees
   ```
   (Assuming the problem expects a WHERE clause or different columns)

3. **Click "Run Query"**
   - Error should appear

4. **Click "Get Hint"**
   - **Observe**: L2 (Level 2) hint appears
   - **Verify**: Hint is more specific than L1
   - **Verify**: Hint ID follows format: `sql-engage:<subtype>:L2:<rowId>`

### Step 4: Third Error + L3 Hint

1. **Make another error** (or repeat a similar pattern)

2. **Click "Get Hint"**
   - **Observe**: L3 (Level 3) hint appears
   - **Verify**: Hint is most explicit (but still educational)
   - **Verify**: This is the final hint level

### Step 5: Escalation to Explanation

1. **Make yet another error** (4th consecutive error)

2. **Click "Get Hint"**
   - **Observe**: Instead of a hint, an **Explanation** appears
   - **Verify**: Explanation is more detailed than hints
   - **Verify**: Content is grounded in SQL-Engage concepts
   - **Verify**: A note is automatically added to "My Textbook"

### Step 6: My Textbook

1. **Click "My Textbook" in the top nav**

2. **Observe the textbook view**:
   - Personalized notes section
   - Concept coverage visualization
   - Recently added notes from your practice session

3. **Verify note content**:
   - Title is present
   - Content explains the error pattern
   - Concepts are tagged (e.g., "SELECT basics", "WHERE clause")

### Step 7: Research Dashboard

1. **Click "Research" in the top nav**

2. **Observe the dashboard**:
   - Session export button
   - Policy comparison tools
   - LLM health status
   - Trace replay options

3. **Click "Export Session"**
   - JSON file should download
   - Contains all interactions from your session

4. **(Optional) Run replay**:
   ```bash
   npm run replay:toy
   ```

### Step 8: Verify Export (Command Line)

1. **Run the demo artifact generation**:
   ```bash
   npm run demo:weekly
   ```

2. **Validate the export**:
   ```bash
   cd dist/weekly-demo
   
   # Check max hint level
   jq '[.interactions[] | select(.eventType=="hint_view") | .hintLevel] | max' export.json
   # Expected: 3
   
   # Check explanation count
   jq '[.interactions[] | select(.eventType=="explanation_view")] | length' export.json
   # Expected: >= 1
   
   # Check total help requests
   jq '[.interactions[] | select(.eventType=="hint_view" or .eventType=="explanation_view")] | length' export.json
   # Expected: >= 4
   ```

---

## Expected Demo Artifacts

After running the demo, `dist/weekly-demo/export.json` should contain:

| Metric | Expected Value |
|--------|----------------|
| Total interactions | >= 10 |
| Hint views (all levels) | >= 3 |
| Explanation views | >= 1 |
| Max hint level reached | 3 |
| Textbook add events | >= 1 |
| Events with sessionId | 100% |
| Events with hintId | 100% (hint_view only) |

---

## Troubleshooting

### Issue: No hints appearing
- Check browser console for errors
- Verify SQL-Engage data is loaded
- Check that error subtype is being detected

### Issue: Escalation not working
- Verify orchestrator threshold settings
- Check that you're making different errors (or same subtype multiple times)
- Review `adaptive-orchestrator.ts` escalation logic

### Issue: Export missing events
- Ensure localStorage isn't cleared between sessions
- Check that all interactions are being logged
- Verify export function captures the right data range

---

## Success Criteria

✅ Demo is successful if:
1. User can progress through L1 → L2 → L3 hints
2. After L3, system escalates to explanation
3. "My Textbook" contains at least one note
4. Export validates with all jq checks passing
5. All Week 2 E2E tests pass: `npm run test:e2e:weekly`
