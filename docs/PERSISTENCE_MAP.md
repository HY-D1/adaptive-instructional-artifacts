# SQL-Adapt Persistence Map

> **Single Source of Truth for Data Authority**  
> Branch: hardening/research-grade-tightening  
> Last Updated: 2026-04-09

This document defines what is authoritative vs cached vs derived for the SQL-Adapt educational platform.

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

## 2. NEON POSTGRESQL (Backend - AUTHORITATIVE)

| Table | Purpose | Authoritative For |
|-------|---------|-------------------|
| `users` | User identities | id, name, role |
| `auth_accounts` | Email/password authentication | accountId, learnerId, email, role |
| `learner_sessions` | Active session state | sessionId, conditionId, currentProblemId, currentCode, guidanceState, banditState |
| `problem_progress` | **DURABLE SOLVED STATE** | solved, attemptsCount, hintsUsed, solvedAt |
| `interaction_events` | Research event log (append-only) | All interaction events (lossless) |
| `textbook_units` | My Textbook content | Units created from hints/explanations |
| `learner_profiles` | Rich learner model | conceptsCovered, errorHistory, solvedProblemIds |
| `section_enrollments` | Course membership | sectionId per student |

### Critical Note: problem_progress is the ONLY durable solved state
- Frontend must re-fetch from `/api/learners/:id/progress` after login
- localStorage solved state is NOT authoritative
- Race condition risk: backend empty → local wiped

### Database Schema Reference

#### problem_progress (Authoritative Solved State)
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

**Updated via:** `updateProblemProgress()` in `apps/server/src/db/neon.ts:781-812`

**Updated on:** Every `execution` event where `successful=true` in `apps/server/src/db/neon.ts:1803-1811`

---

## 3. localStorage (Browser - CACHE ONLY)

| Key | Purpose | Criticality | Sync Strategy |
|-----|---------|-------------|---------------|
| `sql-adapt-user-profile` | Current user identity | HIGH | Backend first, local cache |
| `sql-learning-interactions` | Interaction cache | MEDIUM | Merge backend + local by ID |
| `sql-learning-profiles` | Learner profile cache | HIGH | Backend authoritative |
| `sql-learning-textbook` | Textbook units cache | MEDIUM | Backend + local merge |
| `sql-learning-active-session` | Session ID | HIGH | local first, backend sync |
| `sql-adapt-offline-queue` | Pending writes | HIGH | Drained on reconnect |
| `sql-adapt-pending-interactions` | Durable pending (RESEARCH-1) | CRITICAL | Until backend confirms |
| `sql-adapt-pending-confirmed` | Confirmed IDs | MEDIUM | Deduplication |
| `sql-adapt-pending-session-ends` | Pending session_end | HIGH | Verified before write |
| `sql-learning-llm-cache` | UI cache | LOW | Discard on quota |
| `sql-learning-pdf-index` | UI cache | LOW | In-memory fallback |

### Domain Scoping Issue
- Preview URLs (`*.vercel.app`) have ISOLATED localStorage
- Production data won't appear on preview deployments
- This is a browser security feature, NOT a bug

---

## 4. sessionStorage (Tab-Local)

| Key | Purpose | Criticality |
|-----|---------|-------------|
| `sql-adapt-session-config` | Session config (tab-local) | MEDIUM |

- Survives refresh, NOT shareable across tabs
- Backend takes precedence on load

---

## 5. Hydration Flow

### 5.1 Login Flow

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

### 5.2 Page Refresh Flow

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

### 5.3 Cross-Tab Synchronization

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
```

**Note:** Only specific keys sync cross-tab:
- PREVIEW_MODE_KEY (sql-adapt-preview-mode)
- DEBUG_PROFILE_KEY (sql-adapt-debug-profile)
- DEBUG_STRATEGY_KEY (sql-adapt-debug-strategy)

**Cross-Tab Limitation:** Solved progress does NOT automatically sync cross-tab. Each tab must refresh or re-login to get latest solved state from backend.

---

## 6. Authority Rules

### 6.1 Backend vs Local Conflict Resolution

| Scenario | Authority | Behavior |
|----------|-----------|----------|
| **Solved state mismatch** | Backend (`problem_progress`) wins | `hydrateLearner()` merges with backend as primary source [dual-storage.ts:2190-2207] |
| **Profile field conflict** | Backend wins | Full profile overwrite after backend fetch |
| **Session data conflict** | Backend wins | `learner_sessions` table values take precedence |
| **Interaction events** | Append-only merge | Union of local + backend by event ID (deduplicated) |
| **Textbook units** | Backend wins | Units from `/textbook` endpoint replace local cache |

### 6.2 Staleness Criteria

Local storage is considered stale when:

1. **Post-login:** Always re-hydrate from backend (`problem_progress` is authoritative)
2. **No hydration timestamp:** If `lastHydratedAt[learnerId]` is undefined, data may be stale
3. **Cross-tab writes:** Other tabs may have synced newer backend data
4. **Offline recovery:** After `navigator.onLine` returns true, queue processing refreshes data

### 6.3 Critical Implementation Rule

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

## 7. DERIVED STATE

| State | Derived From | Recalculation Trigger |
|-------|--------------|----------------------|
| Solved count | problem_progress (backend) | Login, refresh, problem solve |
| Current problem | learner_sessions (backend) | Session restore |
| Textbook content | textbook_units (backend) | Login, unit creation |
| Concept coverage | interaction_events (backend) | Login, aggregation |

---

## 8. UI Components That Read Solved State

### 8.1 Components Using `storage.getProfile()`

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

### 8.2 Risk Assessment

| Risk Level | Component | Issue |
|------------|-----------|-------|
| **LOW** | All listed | All read through `storage.getProfile()` which returns hydrated cache. Backend is fetched at login/refresh. |
| **MEDIUM** | Cross-tab scenarios | Tab B may show stale solved state until refresh if Tab A solves a problem. |

**No components read local-only solved state.** All paths go through the hydrated profile cache.

---

## 9. Intentional Exceptions

### 9.1 Practice Drafts (Pre-execution Code)
- **Storage:** localStorage (`sql-learning-practice-drafts`) only
- **Justification:** Temporary editor state, not research data. Lost on device switch is acceptable UX.
- **Backend:** Not persisted to `learner_sessions.current_code` until execution event.

### 9.2 LLM Cache
- **Storage:** localStorage (`sql-learning-llm-cache`)
- **Justification:** Performance optimization only. Can be evicted without data loss.
- **Eviction:** Automatic when quota exceeded (`allowEviction: true`).

### 9.3 PDF Index
- **Storage:** localStorage with memory fallback
- **Justification:** Recomputable from source PDFs. Large payload (often >5MB).
- **Fallback:** `pdfIndexMemory` when localStorage quota exceeded.

### 9.4 Pending Interactions Store
- **Storage:** localStorage (`sql-adapt-pending-interactions`)
- **Purpose:** Durable queue for events sent but not yet backend-confirmed
- **Lifecycle:** Events removed once `backend_confirmed` status received
- **Justification:** RESEARCH-1 requirement for durable write semantics

---

## 10. ENVIRONMENT VARIABLES

| Variable | Where Used | Impact |
|----------|------------|--------|
| `VITE_API_BASE_URL` | Frontend build | Enables backend mode if present |
| `DATABASE_URL` | Backend runtime | Neon connection (required for auth) |
| `JWT_SECRET` | Backend runtime | Auth token signing (required in prod) |
| `CORS_ORIGINS` | Backend runtime | Allowed frontend origins |
| `CORS_ORIGIN_PATTERNS` | Backend runtime | Wildcard patterns for previews |

---

## 11. Key Files Reference

| File | Purpose | Key Lines |
|------|---------|-----------|
| `apps/server/src/db/neon.ts` | Backend database operations | 1803-1820 (problem_progress update), 781-853 (problem_progress schema) |
| `apps/web/src/app/lib/storage/dual-storage.ts` | Frontend storage, hydration | 2180-2207 (solved state merge), 2160-2264 (hydrateLearner) |
| `apps/web/src/app/lib/auth-context.tsx` | Auth state, hydration triggers | 83-93 (hydrateFromBackend), 102-107 (on-mount hydration) |
| `apps/web/src/app/lib/storage/index.ts` | Storage interface exports | — |
| `apps/web/src/app/lib/storage/storage.ts` | LocalStorage implementation | 3420-3475 (cross-tab sync), 853-950 (profile save/load) |
| `apps/web/src/app/lib/api/storage-client.ts` | Backend API client | 1257-1272 (session API), 577-595 (profile API) |

---

## 12. Research Contract Compliance

| Contract | Requirement | Implementation |
|----------|-------------|----------------|
| **RESEARCH-1** | Durable pending store for all interactions | `DurablePendingStore` class [dual-storage.ts:151-397] |
| **RESEARCH-2** | Durable write semantics | Retry-until-ack with offline queue [dual-storage.ts:403-600] |
| **RESEARCH-3** | Flush on pagehide | `flushPendingInteractions()` with keepalive [dual-storage.ts:1600-1650] |
| **RESEARCH-4** | Authoritative solved state from `problem_progress` | `hydrateLearner()` fetches and merges [dual-storage.ts:2180-2208] |

---

## 13. Testing Checklist

To verify persistence truth model:

- [ ] Solve problem in Tab A → Verify `problem_progress` row created in Neon
- [ ] Refresh page → Verify solved state restored from `problem_progress`
- [ ] Login on new device → Verify solved state hydrated from backend
- [ ] Execute code with network offline → Verify event queued in `sql-adapt-pending-interactions`
- [ ] Restore network → Verify queue flushes and events confirmed
- [ ] Cross-tab: Solve in Tab A → Verify Tab B shows stale state until refresh

---

## 14. AUTHORITATIVE RULES

1. **Auth**: JWT cookie from `/api/auth/login` → `sql_adapt_auth` cookie
2. **Active Session**: `learner_sessions` table (backend) is primary
3. **Solved Progress**: `problem_progress` table (backend) is ONLY truth
4. **Interaction Log**: `interaction_events` table (backend) is append-only source
5. **Local Storage**: Cache only - must rehydrate from backend after auth

---

*This document is a research-grade specification. All persistence behavior should be verified against the test checklist before deployment to production study environments.*

**Related Documents:**
- [PERSISTENCE_HARDENING_REPORT.md](./PERSISTENCE_HARDENING_REPORT.md) — Implementation details and fix history
- [DEPLOYMENT.md](./DEPLOYMENT.md) — Deployment procedures
