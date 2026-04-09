# Persistence Truth Map

**Document Version:** 1.0  
**Branch:** hardening/research-grade-tightening  
**Last Updated:** 2026-04-08

This document maps where each type of data lives and identifies the authoritative source of truth for the SQL-Adapt educational platform.

---

## 1. Truth Sources Table

| Data Type | Primary Truth | Fallback | Cache | Session-Only |
|-----------|--------------|----------|-------|--------------|
| **User identity** | JWT cookie (HTTP-only, `auth_token`) | — | localStorage (`sql-adapt-user-profile`) | Memory (`AuthContext`) |
| **User profile** | Neon `users` table | — | localStorage (`sql-learning-profiles`) | — |
| **Solved problems** | Neon `problem_progress` table | — | localStorage profile cache (`solvedProblemIds` Set) | — |
| **Active session** | Neon `learner_sessions` table | localStorage (`sql-learning-active-session`) | — | — |
| **Current problem/code** | Neon `learner_sessions.current_problem_id` + `current_code` | localStorage practice drafts (`sql-learning-practice-drafts`) | — | — |
| **Interaction events** | Neon `interaction_events` table (append-only) | localStorage (`sql-learning-interactions`) | Durable pending store (`sql-adapt-pending-interactions`) | — |
| **Notes/highlights** | Neon `textbook_units` table | localStorage (`sql-learning-textbook`) | — | — |

---

## 2. Hydration Flow

### 2.1 Login Flow

```
User Login
    ↓
/api/auth/login → Sets JWT cookie (auth_token)
    ↓
AuthContext.syncToLocalStorage(authUser)
    ↓
storage.hydrateLearner(learnerId)  [dual-storage.ts:2160-2264]
    ↓
┌─────────────────────────────────────────────────────────────┐
│ Parallel Backend Fetch:                                      │
│  - storageClient.getProfile(learnerId)                       │
│  - storageClient.getSession(learnerId)                       │
│  - storageClient.getAllProblemProgress(learnerId)  ← CRITICAL │
└─────────────────────────────────────────────────────────────┘
    ↓
Merge Strategy [dual-storage.ts:2187-2208]:
    solvedProblemIds = SetUnion(
        problemProgress.filter(p => p.solved),  ← BACKEND AUTHORITY
        localProfile.solvedProblemIds,           ← prevent data loss
        profile.solvedProblemIds                 ← profile cache
    )
    ↓
saveProfile(merged) to localStorage
    ↓
Background Sync (non-blocking):
    - storageClient.getInteractions(limit: 5000)
    - storageClient.getTextbook(learnerId)
```

### 2.2 Page Refresh Flow

```
Page Load
    ↓
AuthContext useEffect [auth-context.tsx:97-110]
    ↓
getMe() → Validates JWT cookie
    ↓
If authenticated:
    - syncToLocalStorage(authUser)
    - hydrateFromBackend(authUser) → hydrateLearner()
    ↓
UI Components read from localStorage cache
(via storage.getProfile() which returns hydrated data)
```

### 2.3 Cross-Tab Synchronization

```
Tab A writes to localStorage
    ↓
broadcastSync(key, value) [storage.ts:3420-3431]
    ↓
Sets transient item → triggers StorageEvent → removes item
    ↓
Tab B receives StorageEvent via subscribeToSync() [storage.ts:3440-3475]
    ↓
Callback re-reads from localStorage

Note: Only specific keys sync cross-tab:
- PREVIEW_MODE_KEY (sql-adapt-preview-mode)
- DEBUG_PROFILE_KEY (sql-adapt-debug-profile)
- DEBUG_STRATEGY_KEY (sql-adapt-debug-strategy)
```

**Cross-Tab Limitation:** Solved progress does NOT automatically sync cross-tab. Each tab must refresh or re-login to get latest solved state from backend.

---

## 3. Authority Rules

### 3.1 Backend vs Local Conflict Resolution

| Scenario | Authority | Behavior |
|----------|-----------|----------|
| **Solved state mismatch** | Backend (`problem_progress`) wins | `hydrateLearner()` merges with backend as primary source [dual-storage.ts:2190-2207] |
| **Profile field conflict** | Backend wins | Full profile overwrite after backend fetch |
| **Session data conflict** | Backend wins | `learner_sessions` table values take precedence |
| **Interaction events** | Append-only merge | Union of local + backend by event ID (deduplicated) |
| **Textbook units** | Backend wins | Units from `/textbook` endpoint replace local cache |

### 3.2 Staleness Criteria

Local storage is considered stale when:

1. **Post-login:** Always re-hydrate from backend (`problem_progress` is authoritative)
2. **No hydration timestamp:** If `lastHydratedAt[learnerId]` is undefined, data may be stale
3. **Cross-tab writes:** Other tabs may have synced newer backend data
4. **Offline recovery:** After `navigator.onLine` returns true, queue processing refreshes data

### 3.3 Critical Implementation Rule

> **SOLVED PROGRESS MUST COME FROM NEON `problem_progress` AFTER LOGIN**

This is enforced in [dual-storage.ts:2180-2208]:

```typescript
// RESEARCH-4: Also fetch problem_progress for authoritative solved state
const [profile, session, problemProgress] = await Promise.all([
  storageClient.getProfile(learnerId),
  storageClient.getSession(learnerId),
  storageClient.getAllProblemProgress(learnerId),  // ← Authoritative source
]);

// RESEARCH-4: Use problem_progress as authoritative source for solved state
// Profile's solvedProblemIds is a cache; problem_progress is durable truth
const solvedIdsFromProgress = new Set(
  problemProgress
    .filter((p) => p.solved)
    .map((p) => p.problemId)
);
```

---

## 4. Database Schema Reference

### 4.1 problem_progress (Authoritative Solved State)

```sql
CREATE TABLE problem_progress (
  id SERIAL PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  problem_id TEXT NOT NULL,
  solved BOOLEAN NOT NULL DEFAULT FALSE,
  attempts_count INTEGER NOT NULL DEFAULT 0,
  hints_used INTEGER NOT NULL DEFAULT 0,
  last_code TEXT,
  first_attempted_at TIMESTAMPTZ,
  solved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, problem_id)
)
```

**Updated via:** `updateProblemProgress()` in [neon.ts:781-812]

**Updated on:** Every `execution` event where `successful=true` [neon.ts:1803-1811]

### 4.2 learner_sessions (Session Persistence)

```sql
CREATE TABLE learner_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  session_id TEXT NOT NULL,
  current_problem_id TEXT,
  current_code TEXT,  -- Last code editor content
  condition_id TEXT,
  guidance_state TEXT,  -- JSON
  hdi_state TEXT,       -- JSON
  bandit_state TEXT,    -- JSON
  last_activity TIMESTAMPTZ,
  UNIQUE(user_id, session_id)
)
```

### 4.3 interaction_events (Lossless Event Log)

```sql
CREATE TABLE interaction_events (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  session_id TEXT,
  timestamp TIMESTAMPTZ NOT NULL,
  event_type TEXT NOT NULL,
  problem_id TEXT NOT NULL,
  successful BOOLEAN,
  code TEXT,
  error TEXT,
  -- ... 50+ additional fields for research replay
)
```

### 4.4 textbook_units (Notes/Highlights)

```sql
CREATE TABLE textbook_units (
  id SERIAL PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  unit_id TEXT NOT NULL,
  type TEXT NOT NULL,  -- 'hint' | 'explanation' | 'example' | 'summary'
  concept_ids TEXT[],
  title TEXT,
  content TEXT,
  source_interaction_ids TEXT[],
  status TEXT DEFAULT 'primary',
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)
```

---

## 5. UI Components That Read Solved State

### 5.1 Components Using `storage.getProfile()`

All of these read from the localStorage cache, which is hydrated from backend:

| Component | File | Usage |
|-----------|------|-------|
| `LearningInterface` | `pages/LearningInterface.tsx:1091` | Profile readiness checks |
| `LearningInterface` | `pages/LearningInterface.tsx:1331` | `checkProblemReadiness()` |
| `LearningInterface` | `pages/LearningInterface.tsx:1681` | Strategy selection |
| `LearningInterface` | `pages/LearningInterface.tsx:1778` | Profile lookup |
| `HintSystem` | `components/features/hints/HintSystem.tsx:185` | Learner state for hints |
| `ConceptCoverage` | `components/features/research/ConceptCoverage.tsx:168` | Coverage display |
| `AskMyTextbookChat` | `components/features/chat/AskMyTextbookChat.tsx:1486` | Context loading |
| `useLearnerProgress` | `hooks/useLearnerProgress.ts:71` | Progress calculations |
| `mastery-engine` | `lib/knowledge/mastery-engine.ts` | Mastery calculations |
| `learning-path` | `lib/knowledge/learning-path.ts` | Path recommendations |

### 5.2 Risk Assessment

| Risk Level | Component | Issue |
|------------|-----------|-------|
| **LOW** | All listed | All read through `storage.getProfile()` which returns hydrated cache. Backend is fetched at login/refresh. |
| **MEDIUM** | Cross-tab scenarios | Tab B may show stale solved state until refresh if Tab A solves a problem. |

**No components read local-only solved state.** All paths go through the hydrated profile cache.

---

## 6. Intentional Exceptions

### 6.1 Practice Drafts (Pre-execution Code)

- **Storage:** localStorage (`sql-learning-practice-drafts`) only
- **Justification:** Temporary editor state, not research data. Lost on device switch is acceptable UX.
- **Backend:** Not persisted to `learner_sessions.current_code` until execution event.

### 6.2 LLM Cache

- **Storage:** localStorage (`sql-learning-llm-cache`)
- **Justification:** Performance optimization only. Can be evicted without data loss.
- **Eviction:** Automatic when quota exceeded (`allowEviction: true`).

### 6.3 PDF Index

- **Storage:** localStorage with memory fallback
- **Justification:** Recomputable from source PDFs. Large payload (often >5MB).
- **Fallback:** `pdfIndexMemory` when localStorage quota exceeded.

### 6.4 Pending Interactions Store

- **Storage:** localStorage (`sql-adapt-pending-interactions`)
- **Purpose:** Durable queue for events sent but not yet backend-confirmed
- **Lifecycle:** Events removed once `backend_confirmed` status received
- **Justification:** RESEARCH-1 requirement for durable write semantics

---

## 7. Key Files Reference

| File | Purpose | Key Lines |
|------|---------|-----------|
| `apps/server/src/db/neon.ts` | Backend database operations | 1803-1820 (problem_progress update), 781-853 (problem_progress schema) |
| `apps/web/src/app/lib/storage/dual-storage.ts` | Frontend storage, hydration | 2180-2207 (solved state merge), 2160-2264 (hydrateLearner) |
| `apps/web/src/app/lib/auth-context.tsx` | Auth state, hydration triggers | 83-93 (hydrateFromBackend), 102-107 (on-mount hydration) |
| `apps/web/src/app/lib/storage/index.ts` | Storage interface exports | — |
| `apps/web/src/app/lib/storage/storage.ts` | LocalStorage implementation | 3420-3475 (cross-tab sync), 853-950 (profile save/load) |
| `apps/web/src/app/lib/api/storage-client.ts` | Backend API client | 1257-1272 (session API), 577-595 (profile API) |

---

## 8. Research Contract Compliance

| Contract | Requirement | Implementation |
|----------|-------------|----------------|
| **RESEARCH-1** | Durable pending store for all interactions | `DurablePendingStore` class [dual-storage.ts:151-397] |
| **RESEARCH-2** | Durable write semantics | Retry-until-ack with offline queue [dual-storage.ts:403-600] |
| **RESEARCH-3** | Flush on pagehide | `flushPendingInteractions()` with keepalive [dual-storage.ts:1600-1650] |
| **RESEARCH-4** | Authoritative solved state from `problem_progress` | `hydrateLearner()` fetches and merges [dual-storage.ts:2180-2208] |

---

## 9. Testing Checklist

To verify persistence truth model:

- [ ] Solve problem in Tab A → Verify `problem_progress` row created in Neon
- [ ] Refresh page → Verify solved state restored from `problem_progress`
- [ ] Login on new device → Verify solved state hydrated from backend
- [ ] Execute code with network offline → Verify event queued in `sql-adapt-pending-interactions`
- [ ] Restore network → Verify queue flushes and events confirmed
- [ ] Cross-tab: Solve in Tab A → Verify Tab B shows stale state until refresh

---

*This document is a research-grade specification. All persistence behavior should be verified against the test checklist before deployment to production study environments.*
