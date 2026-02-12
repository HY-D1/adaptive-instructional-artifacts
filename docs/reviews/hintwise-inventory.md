# HintWise Review

## What HintWise is (as implemented)

- **App type/framework**:

  - A **Next.js** (App Router) + **React** + **TypeScript** web app (scripts run `next dev/build/start`)
  - Uses **Sandpack** (`@codesandbox/sandpack-react`) for an in-browser code editor and test runner
  - Includes a lightweight client-only login gate (no real auth)
  - Provides multiple Next.js API routes under `app/api/*` (e.g., `challenges`, `feedback`, `topic-info`, `generate-test`, `execute-code`)

- **Core loop** (challenge → code → tests → feedback → hints):

   1. User starts a session with a `topic` + `goal`, then the app fetches topic info and a list of challenges; it sets XP and pulls initial feedback
   2. Challenges are fetched from `/api/challenges`. The current challenge description is displayed and navigable via Previous/Skip/Complete controls
   3. Code is written in a Sandpack editor; changes are split into “generic function” + “user code” and stored in state
   4. Tests are generated per challenge via `/api/generate-test` and stored in `testFile`; those tests are then run in the “Challenge Tests” panel via SandpackTests with `/index.test.js`
   5. Feedback is fetched from `/api/feedback` and displayed in “Wizard’s Feedback”; the user can also explicitly request feedback
   6. Hints are requested via a “Get Hint (5 XP)” button and shown in “Wizard’s Hints”

## What a “hint” is (data + UI + API)

### A) Hint data (static datasets)

- **Dataset files**:

  - `HintWise-main/app/api/hints/hints_dataset.json` 
  - `HintWise-main/hints_dataset.json`

- **Record schema**:
Each dataset is a JSON array of records. Each record contains:

  - `topic`, `personality`, `challenge`, `hints`
  - And `hints` is an array of objects with: `label`, `hint`

- **Challenges and topic coverage**:

  - `app/api/hints/hints_dataset.json` contains **8 challenge records**, all under the topic **“Conditional Statements”**
  - root `hints_dataset.json` contains **13 challenge records** spanning **two topics**: **“Conditional Statements”** and **“Loops and Functions”**

- **Hint levels present? How represented?**
  - Each challenge has **five hints** labeled `H1` … `H5`

### B) Hint UI behavior

- **Where hint is stored in state:**
  - `const [hint, setHint] = useState("")`
  - Related states: `isHintLoading` and `hintRating`
- **How user requests a hint:**
  - Clicking the “Get Hint (5 XP)” button triggers `getHint`
  - The UI displays either the hint text + rating controls or a placeholder message (“No hint requested yet…”)
- **Any costs/constraints:**
  - The hint button is **disabled** if `isHintLoading` or **XP < 5**
  - When a hint is successfully fetched, XP is reduced by **5**: `setXp(prev => prev - 5)`
  - The placeholder explicitly says “costs 5 XP”
- **Any feedback/rating signals recorded?**
  - Users can rate the hint “Yes/No” (thumbs up/down UI)
  - `rateHint("liked" | "disliked")` updates `hintRating`; “liked” grants +3 XP; there’s a comment indicating it is **not sent to backend** (“You could send this feedback to your backend here”)

### C) Hint API contract (what the frontend expects)

- **Endpoint called:**
  - `fetch("/api/get-hint", { method: "POST", ... })`
- **Request body fields:**
The frontend sends JSON with:
  - `challenge` (current challenge description)
  - `currentCode` (current code)
  - `topic`
  - `goal`
- **Response fields expected:**
  - The frontend expects JSON with a `hint` field and does `setHint(data.hint)`
- **Is this endpoint implemented in backend?**
  - In this snapshot, there is **no Next.js route file** at `app/api/get-hint/route.ts`. The repo does include other API routes (`challenges`, `feedback`, `topic-info`, `generate-test`, `execute-code`)
  - **Result**: the UI calls `/api/get-hint`, but the corresponding handler is missing in the provided code snapshot (inference from file presence/absence + the call site)

## What “escalation” means (in HintWise)

### Representation

- **Are there multiple hint levels? (e.g., H1..H5)**
  - Both datasets define five progressive hint entries with `label: "H1"` through `label: "H5"`
- **Do higher levels become more direct? Evidence example.**
In `app/api/hints/hints_dataset.json` (Traffic Light Challenge), the hints move from general structure to more step-by-step instruction:
  - H1: “Use an if-elif-else structure…” (general strategy)
  - H5: “Start by writing an if statement… then add additional elif…” (more procedural)

### Implementation status

- **Does the app track hint level or attempt count?**
  - The UI tracks only a single `hint` string plus `isHintLoading` and `hintRating`. There is **no state variable** for hint level/index, “hints used,” or “attempt count” tied to escalation
  - The request body sent to `/api/get-hint` includes no hint level; it only includes challenge/currentCode/topic/goal
- **Does the backend choose the “next” hint?**
  - Because the `/api/get-hint` route handler is not present in this snapshot, there is no implemented “next hint” selection logic exposed to the frontend (supported by the call site and the set of existing API route files)
- **Gaps/unknowns (with file paths).**
  1. **Hints datasets are not wired to runtime hint delivery:** the hint datasets exist as JSON files, but there is no `/api/get-hint` handler shown that reads them
  2. There is an **offline hint dataset generator** script (`hint_mechanism/hint.py`) that creates H1–H5 hints and writes `generated_hints_dataset.json`, but this is not referenced by the Next.js API routes
  3. Several API routes call Groq’s OpenAI-compatible endpoint and include a hard-coded Authorization bearer token in source; this is security-relevant and also means runtime depends on that external service for challenges/feedback/tests 

## Notes relevant to our project (SQL adaptive textbook)

- **What we can reuse directly:**
  - **“Hint as lowest-cost intervention”** with explicit cost/constraint (5 XP) maps cleanly to your “hints are default/minimal” stance
  - **User feedback on hint helpfulness** (like/dislike) is a useful signal type you can log in SQL learning traces
  - The dataset structure `H1..H5` is a **clean escalation representation** you can mirror for SQL: “general → targeted → near-solution”
- **What is mismatched (domain, missing endpoint, etc.):**
  - **Domain mismatch**: HintWise content is about programming topics like “Conditional Statements” and “Loops and Functions,” not SQL concepts
  - **Escalation is not implemented end-to-end** in the provided snapshot: UI calls `/api/get-hint`, but no handler exists here to select H1→H5 based on attempts/errors
  - **No persistence/logging of hint ratings**: the code explicitly notes backend logging is not implemented for ratings (“You could send this feedback…”)
  