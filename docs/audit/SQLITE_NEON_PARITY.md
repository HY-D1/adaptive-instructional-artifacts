# SQLite-Neon Database Parity Analysis

**Date:** 2026-04-03
**Scope:** Compare SQLite fallback implementation with Neon PostgreSQL schema
**Status:** Partial Parity - Documented Gaps Identified

---

## Executive Summary

The SQLite implementation provides **basic fallback functionality** but has **significant schema gaps** compared to Neon PostgreSQL. While core CRUD operations are supported, advanced features like course sections, corpus management, and rich learner profiles are only available in Neon mode.

**Recommendation:** SQLite is suitable for local development and single-learner scenarios. For multi-learner deployments with course management, Neon is required.

---

## Schema Comparison

### Tables Present in Both

| Table | SQLite | Neon | Parity Status |
|-------|--------|------|---------------|
| learners/users | ✅ `learners` | ✅ `users` | ⚠️ Different table names |
| interactions | ✅ `interactions` | ✅ `interaction_events` | ⚠️ Different schemas |
| textbooks | ✅ `textbooks` | ✅ `textbook_units` | ⚠️ Different table names |
| sessions | ✅ `sessions` | ✅ `learner_sessions` | ⚠️ Different schemas |

### Tables Missing in SQLite

| Table | Neon | Purpose | Impact |
|-------|------|---------|--------|
| `course_sections` | ✅ | Instructor course management | 🔴 High - No multi-learner courses |
| `section_enrollments` | ✅ | Student section membership | 🔴 High - No enrollment tracking |
| `problem_progress` | ✅ | Per-problem progress tracking | 🟡 Medium - Uses session JSON instead |
| `textbook_unit_event_links` | ✅ | Provenance tracking | 🟡 Medium - Limited audit trail |
| `corpus_documents` | ✅ | PDF corpus management | 🟡 Medium - Local-only corpus |
| `corpus_units` | ✅ | Processed corpus units | 🟡 Medium - Local-only corpus |
| `corpus_chunks` | ✅ | Embeddings storage | 🟡 Medium - No vector search in SQLite |
| `corpus_ingest_runs` | ✅ | Corpus versioning | 🟢 Low - Admin feature |
| `corpus_active_runs` | ✅ | Active corpus selection | 🟢 Low - Admin feature |
| `learner_profiles` | ✅ | Rich learner profiles | 🟡 Medium - Stub implementation |
| `auth_accounts` | ✅ | Email/password auth | 🔴 High - Only localStorage auth in SQLite |

---

## Detailed Schema Differences

### 1. Interactions Table

#### Neon Schema (`interaction_events`)
- **Columns:** 60+ explicit columns including:
  - All guidance ladder fields (`rung`, `from_rung`, `to_rung`, `trigger`)
  - All HDI fields (`hdi`, `hdi_level`, `hdi_components`)
  - All bandit fields (`selected_arm`, `reward_total`, `reward_components`)
  - All LLM telemetry fields (`llm_provider`, `llm_model`, `llm_latency_ms`)
  - All study fields (`learner_profile_id`, `escalation_trigger_reason`)
- **Indexes:** learner_id, session_id, event_type, timestamp, problem_id, section_id
- **Foreign Keys:** References users, course_sections

#### SQLite Schema (`interactions`)
- **Columns:** 8 columns
  ```sql
  id TEXT PRIMARY KEY
  learner_id TEXT NOT NULL
  session_id TEXT
  timestamp TEXT NOT NULL
  event_type TEXT NOT NULL
  problem_id TEXT NOT NULL
  payload TEXT NOT NULL DEFAULT '{}'  -- JSON blob
  created_at TEXT NOT NULL
  ```
- **Indexes:** learner_id, session_id, event_type, timestamp, problem_id
- **Foreign Keys:** References learners

#### Gap Analysis
| Feature | Neon | SQLite | Workaround |
|---------|------|--------|------------|
| Guidance ladder fields | Explicit columns | JSON payload | Parse payload in application |
| HDI tracking | Explicit columns | JSON payload | Parse payload in application |
| Bandit tracking | Explicit columns | JSON payload | Parse payload in application |
| LLM telemetry | Explicit columns | JSON payload | Parse payload in application |
| Study fields | Explicit columns | JSON payload | Parse payload in application |
| Query performance | Indexed columns | Full table scan | Limited - JSON not indexed |

#### Recommendation
**Priority: Medium**

SQLite interactions use a JSON payload approach which is flexible but loses:
1. Type safety on individual fields
2. Query performance for research analysis
3. Direct SQL querying of specific fields

**Action:** Add column comments documenting which payload fields are expected.

---

### 2. Sessions Table

#### Neon Schema (`learner_sessions`)
- **Columns:** 18 columns with explicit state fields:
  ```sql
  id TEXT PRIMARY KEY
  user_id TEXT NOT NULL REFERENCES users
  section_id TEXT REFERENCES course_sections
  session_id TEXT NOT NULL
  current_problem_id TEXT
  condition_id TEXT NOT NULL
  textbook_disabled BOOLEAN DEFAULT FALSE
  adaptive_ladder_disabled BOOLEAN DEFAULT FALSE
  immediate_explanation_mode BOOLEAN DEFAULT FALSE
  static_hint_mode BOOLEAN DEFAULT FALSE
  escalation_policy TEXT DEFAULT 'adaptive'
  current_code TEXT
  guidance_state TEXT  -- JSON
  hdi_state TEXT  -- JSON
  bandit_state TEXT  -- JSON
  last_activity TIMESTAMPTZ
  created_at TIMESTAMPTZ
  updated_at TIMESTAMPTZ
  ```
- **Unique:** (user_id, session_id)

#### SQLite Schema (`sessions`)
- **Columns:** 5 columns
  ```sql
  id TEXT PRIMARY KEY
  learner_id TEXT NOT NULL UNIQUE
  data TEXT NOT NULL DEFAULT '{}'  -- JSON blob
  created_at TEXT NOT NULL
  updated_at TEXT NOT NULL
  ```

#### Gap Analysis
| Feature | Neon | SQLite | Workaround |
|---------|------|--------|------------|
| Multiple sessions per user | ✅ | ❌ | Only one session per learner |
| Section/course membership | ✅ | ❌ | Not supported |
| Explicit state fields | ✅ | JSON blob | Parse in application |
| Last activity tracking | ✅ | ❌ | Not tracked |

#### Recommendation
**Priority: Medium**

SQLite only supports a single session per learner. This is sufficient for individual use but limits multi-device scenarios.

**Action:** Document this limitation in SQLite mode.

---

### 3. Textbooks Table

#### Neon Schema (`textbook_units`)
- **Columns:** 22 columns including:
  - All unit fields (title, content, type, status)
  - Enhanced fields (summary, common_mistakes, minimal_example)
  - Provenance (source_interaction_ids, created_from_interaction_ids)
  - Quality tracking (quality_score, retrieval_count)
  - Revision tracking (revision_count, auto_created)

#### SQLite Schema (`textbooks`)
- **Columns:** 11 columns
  - Basic fields (id, learner_id, unit_id, type, title, content)
  - JSON arrays for concept_ids, source_interaction_ids
  - Status tracking (primary/alternative/archived)
  - Timestamps

#### Gap Analysis
| Feature | Neon | SQLite | Impact |
|---------|------|--------|--------|
| Enhanced unit fields | ✅ | ❌ | Missing summary, common_mistakes |
| Quality scoring | ✅ | ❌ | No quality-based selection |
| Auto-created flag | ✅ | ❌ | No automated unit tracking |
| Revision history | ✅ | ❌ | No update tracking |

#### Recommendation
**Priority: Low**

SQLite has sufficient fields for basic textbook functionality. Enhanced fields are nice-to-have for research.

---

### 4. Learners vs Users

#### Neon Schema (`users` + `learner_profiles`)
- Separate tables for auth identity and learning profile
- Rich profile with concept coverage, evidence, error history
- JSON extensibility via profile_data column

#### SQLite Schema (`learners`)
- Single table with basic fields
- **Stubs only** for learner profile operations
  ```typescript
  export async function getLearnerProfile(_learnerId: string): Promise<LearnerProfile | null> {
    // Stub: Return null - profiles not fully implemented in SQLite
    return null;
  }
  ```

#### Gap Analysis
| Feature | Neon | SQLite | Impact |
|---------|------|--------|--------|
| Rich learner profiles | ✅ | ❌ Stub | No adaptive personalization |
| Concept coverage tracking | ✅ | ❌ | No coverage visualization |
| Error history | ✅ | ❌ | No error pattern detection |
| Auth accounts | ✅ | ❌ | Only localStorage auth |

#### Recommendation
**Priority: High**

SQLite mode lacks learner profile functionality which limits adaptive features.

**Action:** Implement basic learner profile storage in SQLite (can use JSON blob approach).

---

### 5. Course Management

#### Neon Schema
- `course_sections`: Instructor-owned courses
- `section_enrollments`: Student memberships
- Foreign key relationships throughout

#### SQLite Schema
- **Not implemented**

#### Recommendation
**Priority: High**

SQLite mode cannot support multi-learner courses. This is a fundamental limitation.

**Action:** Document that SQLite is for single-learner/local use only.

---

### 6. Corpus Management

#### Neon Schema
- Full corpus document/unit/chunk storage
- Vector embeddings (using pgvector)
- Active run selection

#### SQLite Schema
- **Not implemented**
- PDF index stored in localStorage via `storage.ts`

#### Recommendation
**Priority: Medium**

Corpus management is primarily a deployment/admin feature. LocalStorage-based PDF index is sufficient for individual use.

**Action:** Add validation that corpus routes return 503 in SQLite mode.

---

## Function Parity Matrix

### Learner Operations

| Function | SQLite | Neon | Status |
|----------|--------|------|--------|
| createLearner/createUser | ✅ | ✅ | Equivalent |
| getLearnerById/getUserById | ✅ | ✅ | Equivalent |
| getAllLearners/getAllUsers | ✅ | ✅ | Equivalent |
| updateLearner/updateUser | ✅ | ✅ | Equivalent |
| deleteLearner/deleteUser | ✅ | ✅ | Equivalent |

### Session Operations

| Function | SQLite | Neon | Status |
|----------|--------|------|--------|
| saveSession | ⚠️ Single only | ✅ Multi | Partial |
| getSession | ✅ | ✅ | Equivalent |
| getActiveSession | ✅ | ✅ | Equivalent |
| clearSession | ✅ | ✅ | Equivalent |

### Interaction Operations

| Function | SQLite | Neon | Status |
|----------|--------|------|--------|
| createInteraction | ⚠️ JSON payload | ✅ Typed | Partial |
| getInteractionsByLearner | ✅ | ✅ | Equivalent |
| queryInteractions | ❌ | ✅ | Missing |
| getAllInteractionsForExport | ❌ | ✅ | Missing |

### Textbook Operations

| Function | SQLite | Neon | Status |
|----------|--------|------|--------|
| createTextbookUnit | ✅ | ✅ | Equivalent |
| getTextbookUnitsByLearner | ✅ | ✅ | Equivalent |
| getTextbookUnitById | ✅ | ✅ | Equivalent |
| deleteTextbookUnit | ✅ | ✅ | Equivalent |

### Profile Operations

| Function | SQLite | Neon | Status |
|----------|--------|------|--------|
| saveLearnerProfile | ⚠️ Stub | ✅ | Not functional |
| getLearnerProfile | ⚠️ Stub | ✅ | Not functional |
| updateProfileFromEvent | ⚠️ Stub | ✅ | Not functional |

### Corpus Operations

| Function | SQLite | Neon | Status |
|----------|--------|------|--------|
| getCorpusManifest | ❌ | ✅ | N/A |
| searchCorpus | ❌ | ✅ | N/A |
| getCorpusActiveRuns | ❌ | ✅ | N/A |

---

## Migration Path

### From SQLite to Neon

The unified database layer in `db/index.ts` provides transparent migration:

```typescript
// Automatically uses Neon when DATABASE_URL is set
export function isUsingNeon(): boolean {
  return hasDbEnv();
}
```

**Steps to migrate:**
1. Set `DATABASE_URL` environment variable
2. Run `initializeSchema()` to create Neon tables
3. Export SQLite data using existing endpoints
4. Import to Neon (transform payload JSON to columns)

### Data Transformations Required

#### Interactions Migration
```sql
-- Extract fields from SQLite payload JSON
INSERT INTO interaction_events (
  id, user_id, timestamp, event_type, problem_id,
  rung, from_rung, to_rung, trigger_reason,
  hdi, hdi_level, hdi_components
)
SELECT 
  id, learner_id, timestamp, event_type, problem_id,
  json_extract(payload, '$.rung'),
  json_extract(payload, '$.fromRung'),
  json_extract(payload, '$.toRung'),
  json_extract(payload, '$.trigger'),
  json_extract(payload, '$.hdi'),
  json_extract(payload, '$.hdiLevel'),
  json_extract(payload, '$.hdiComponents')
FROM interactions;
```

---

## Risk Assessment

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Research data loss in SQLite | High | Low | Add export functionality |
| Query performance issues | Medium | Medium | Document limitation |
| Feature inconsistency | Medium | High | Clear mode documentation |
| Migration complexity | Low | Low | Provide migration scripts |

---

## Recommendations

### Immediate (P1)

1. **Document SQLite Limitations**
   - Add README section explaining SQLite is for single-learner use
   - Document JSON payload approach for interactions

2. **Add getAllInteractionsForExport to SQLite**
   - Required for research data export
   - Can parse JSON payload to return full Interaction objects

### Short-term (P2)

1. **Implement Learner Profile in SQLite**
   - Add learner_profiles table or use JSON blob in learners
   - Enable adaptive features in SQLite mode

2. **Add queryInteractions to SQLite**
   - Support filtering by event type, problem, date range
   - Parse JSON payload for filtering

3. **Add Validation**
   - Return 503 for corpus routes in SQLite mode
   - Return 503 for multi-session operations

### Long-term (P3)

1. **Schema Alignment Script**
   - Create tool to verify parity
   - Run in CI to catch drift

2. **Consider SQLite Extensions**
   - json1 for better JSON querying
   - fts5 for full-text search

---

## Sign-off

**Analysis Completed By:** Claude Code
**Date:** 2026-04-03
**Status:** P1 Item 3 Complete - Parity gaps documented

**Key Finding:** SQLite provides sufficient functionality for local development and single-learner use. Neon is required for production deployments with course management and research analytics.
