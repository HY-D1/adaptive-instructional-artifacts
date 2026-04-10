# Storage Audit Report

**Date:** 2026-04-08  
**Scope:** Production code in `apps/web/src/app`  
**Purpose:** Root cause analysis for QuotaExceededError bug around `sql-adapt-session-config`

---

## Executive Summary

This audit catalogs all localStorage/sessionStorage keys used in production, classifies them by durability requirements, identifies raw localStorage usage (bypassing safeSetItem), and provides migration recommendations.

### Key Findings
1. **41 unique storage keys** identified across the codebase
2. **CRITICAL BUG:** `condition-assignment.ts` uses raw `localStorage.setItem` without quota handling for `sql-adapt-session-config`
3. **Inconsistent patterns:** Mix of `sql-adapt-*` and `sql-learning-*` prefixes
4. **Missing safety:** Several direct localStorage calls lack try-catch or quota detection

---

## Storage Keys Inventory

### CRITICAL_DURABLE - Must Survive Browser Restart

These keys contain user data that must persist across sessions. Data loss would result in lost progress.

| Key | Owner Module | Size Risk | Pattern | Migration Notes |
|-----|--------------|-----------|---------|-----------------|
| `sql-adapt-user-profile` | storage.ts, useSessionPersistence.ts | SMALL | Uses safeSetItem via saveUserProfile() | ✅ Already safe |
| `sql-learning-interactions` | storage.ts | LARGE | Uses safeSetItem, chunked in dual-storage.ts | ✅ Already safe |
| `sql-learning-profiles` | storage.ts | MEDIUM | Uses safeSetItem | ✅ Already safe |
| `sql-learning-textbook` | storage.ts | LARGE | Uses safeSetItem | ✅ Already safe |
| `sql-learning-active-session` | storage.ts | SMALL | Direct setItem (small data) | ✅ Low risk |
| `sql-learning-practice-drafts` | storage.ts | MEDIUM | Uses safeSetItem | ✅ Already safe |
| `sql-learning-reinforcement-schedules` | reinforcement-manager.ts | MEDIUM | Raw setItem, no quota handling | ⚠️ **Migrate to safeSetItem** |
| `sql-learning-pdf-index` | storage.ts, demo-seed.ts | **LARGE** | Uses safeSetItem with memory fallback | ✅ Already safe |
| `sql-learning-pdf-uploads` | storage.ts, demo-seed.ts | MEDIUM | Uses safeSetItem | ✅ Already safe |
| `sql-adapt-session-config` | condition-assignment.ts, storage.ts | SMALL | **RAW SETITEM - BUG!** | 🔴 **CRITICAL: Add safeSetItem** |
| `sql-learning-policy-replay-mode` | storage.ts, demo-seed.ts | SMALL | Uses safeSetItem | ✅ Already safe |

### CRITICAL_SESSION - Tab-Local, Critical for UX

These keys are cleared when the session ends but are critical for the current experience.

| Key | Owner Module | Size Risk | Pattern | Migration Notes |
|-----|--------------|-----------|---------|-----------------|
| `sql-adapt-offline-queue` | dual-storage.ts | LARGE | Raw setItem with try-catch | ⚠️ Add quota detection |
| `sql-adapt-pending-interactions` | dual-storage.ts | **LARGE** | Raw setItem with try-catch | ⚠️ Add quota detection |
| `sql-adapt-pending-session-ends` | dual-storage.ts | MEDIUM | Raw setItem with try-catch | ⚠️ Add quota detection |
| `sql-adapt-pending-confirmed` | dual-storage.ts | MEDIUM | Raw setItem with try-catch | ⚠️ Add quota detection |
| `sql-adapt-dead-letter` | dual-storage.ts | SMALL | Raw setItem with try-catch | ✅ Low risk |
| `sql-adapt-last-active` | useSessionPersistence.ts, StartPage.tsx | SMALL | Direct setItem with try-catch | ✅ Has quota handling |

### RECOVERABLE_CACHE - Can Be Evicted

These keys can be safely cleared if storage quota is exceeded. They are performance optimizations.

| Key | Owner Module | Size Risk | Pattern | Migration Notes |
|-----|--------------|-----------|---------|-----------------|
| `sql-learning-llm-cache` | storage.ts, demo-seed.ts | **LARGE** | Uses safeSetItem | ✅ Already safe |
| `sql-adapt-llm-settings` | LLMSettingsHelper.tsx, llm-client.ts | SMALL | Direct setItem with try-catch | ✅ Low risk |
| `sql-adapt-profile-cache` | learner-profile-client.ts | MEDIUM | Direct setItem with basic catch | ⚠️ Add quota detection |
| `chat-history-${learnerId}-${problemId}` | AskMyTextbookChat.tsx | MEDIUM | Direct setItem with quota detection | ✅ Has quota handling |
| `sqladapt:recent-searches` | useCommandSearch.ts | SMALL | Direct setItem with try-catch | ✅ Low risk |
| `hint-cache:${learnerId}:${problemId}` | hint-cache.ts | SMALL | Uses safeSetItem equivalent | ✅ Has budget enforcement |
| `sql-adapt-ui-state-v1:*` | ui-state.ts | SMALL | Direct setItem (swallows errors) | ✅ Non-critical by design |

### DEBUG_DEV_ONLY - Development Helpers

These keys are only used in development or for debugging purposes.

| Key | Owner Module | Size Risk | Pattern | Migration Notes |
|-----|--------------|-----------|---------|-----------------|
| `sql-adapt-preview-mode` | storage.ts, ui-state.ts, RootLayout.tsx | SMALL | Uses safe setters via setPreviewModeWithSync | ✅ Already safe |
| `sql-adapt-debug-profile` | storage.ts, storage-validation.ts | SMALL | Uses safe setters via setDebugProfileWithSync | ✅ Already safe |
| `sql-adapt-debug-strategy` | storage.ts, storage-validation.ts | SMALL | Uses safe setters via setDebugStrategyWithSync | ✅ Already safe |
| `sql-adapt-demo-mode` | demo-mode.ts | SMALL | Direct getItem only (read) | ✅ No write risk |
| `sql-adapt-welcome-seen` | RootLayout.tsx, WelcomeModal.tsx | SMALL | Direct setItem with try-catch | ✅ Low risk |
| `sql-adapt-welcome-disabled` | RootLayout.tsx, WelcomeModal.tsx | SMALL | Direct setItem with try-catch | ✅ Low risk |
| `sql-adapt-user-role` | LearningInterface.tsx | SMALL | Direct setItem | ⚠️ Add try-catch |

### SYNC/UTILITY - Non-Persisted

These keys are used for cross-tab communication, not data persistence.

| Key | Owner Module | Purpose |
|-----|--------------|---------|
| `sql-adapt-sync` | storage.ts | Cross-tab broadcast channel (set + immediate remove) |

---

## Raw localStorage Usage Analysis

### Files Using Raw localStorage (Not Using safeSetItem Pattern)

#### 🔴 HIGH RISK

| File | Line | Usage | Issue |
|------|------|-------|-------|
| `condition-assignment.ts` | 364 | `localStorage.setItem(SESSION_CONFIG_STORAGE_KEY, JSON.stringify(config))` | No try-catch, no quota handling |

#### 🟡 MEDIUM RISK

| File | Line | Usage | Issue |
|------|------|-------|-------|
| `reinforcement-manager.ts` | 96 | `localStorage.setItem(this.SCHEDULES_KEY, JSON.stringify(schedules))` | Has try-catch but no quota detection |
| `dual-storage.ts` | 172, 225, 227, etc. | Multiple raw setItem calls | Has try-catch but no specific quota detection |

#### 🟢 LOW RISK (Has Error Handling)

| File | Line | Usage | Protection |
|------|------|-------|------------|
| `AskMyTextbookChat.tsx` | 405 | `localStorage.setItem(CHAT_HISTORY_KEY, ...)` | Has QuotaExceededError detection |
| `useSessionPersistence.ts` | 128 | `localStorage.setItem(LAST_ACTIVE_KEY, ...)` | Has QuotaExceededError handling |
| `LLMSettingsHelper.tsx` | 106 | `localStorage.setItem(STORAGE_KEY, ...)` | Has try-catch |
| `useCommandSearch.ts` | 95 | `localStorage.setItem(RECENT_SEARCHES_KEY, ...)` | Has try-catch |
| `RootLayout.tsx` | 408, 437, 438 | Multiple calls | Has try-catch |
| `WelcomeModal.tsx` | 97, 98 | Multiple calls | Has try-catch |

---

## The safeSetItem Pattern

The storage.ts file implements a safeSetItem method that should be used for all localStorage writes:

```typescript
private safeSetItem(key: string, value: string): { success: boolean; quotaExceeded?: boolean } {
  try {
    localStorage.setItem(key, value);
    return { success: true };
  } catch (error) {
    const isQuotaError = 
      error instanceof DOMException &&
      (error.name === 'QuotaExceededError' ||
       error.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
       error.code === 22 || // Chrome/Safari
       error.code === 1014); // Firefox
    
    if (isQuotaError) {
      console.warn(`LocalStorage quota exceeded for key '${key}'. Value size: ${value.length} chars.`);
      return { success: false, quotaExceeded: true };
    }
    
    throw error;
  }
}
```

### hint-cache.ts Budget Enforcement

The hint-cache.ts file has its own specialized safeSetItem with byte budget enforcement:

```typescript
const HINT_CACHE_BUDGET_BYTES = 2048;

function safeSetItem(key: string, value: string): HintCacheResult {
  try {
    localStorage.setItem(key, value);
    return { success: true, bytes: value.length, budgetBytes: HINT_CACHE_BUDGET_BYTES };
  } catch (error) {
    if (isQuotaExceededError(error)) {
      return { success: false, quotaExceeded: true, ... };
    }
    throw error;
  }
}
```

---

## Migration Plan

### Phase 1: Critical Bug Fix (Immediate)

**File:** `lib/experiments/condition-assignment.ts`

Replace raw localStorage.setItem with quota-aware wrapper:

```typescript
// BEFORE (line 364)
export function saveSessionConfig(config: SessionConfig): void {
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(SESSION_CONFIG_STORAGE_KEY, JSON.stringify(config));
  }
}

// AFTER
export function saveSessionConfig(config: SessionConfig): { success: boolean; quotaExceeded?: boolean } {
  if (typeof localStorage === 'undefined') {
    return { success: false };
  }
  
  try {
    const value = JSON.stringify(config);
    localStorage.setItem(SESSION_CONFIG_STORAGE_KEY, value);
    return { success: true };
  } catch (error) {
    const isQuotaError = 
      error instanceof DOMException &&
      (error.name === 'QuotaExceededError' ||
       error.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
       error.code === 22 ||
       error.code === 1014);
    
    if (isQuotaError) {
      console.warn('[ConditionAssignment] Quota exceeded saving session config');
      return { success: false, quotaExceeded: true };
    }
    throw error;
  }
}
```

### Phase 2: Medium Risk (Next Sprint)

1. **reinforcement-manager.ts**: Add quota detection to saveSchedules()
2. **dual-storage.ts**: Add quota detection to pending interaction storage
3. **learner-profile-client.ts**: Add quota detection to setCache()
4. **LearningInterface.tsx**: Add try-catch to user role storage

### Phase 3: Consolidation (Future)

1. Unify key prefixes (migrate `sql-learning-*` to `sql-adapt-*` or vice versa)
2. Create shared isQuotaExceededError() utility
3. Add storage usage monitoring/telemetry
4. Implement LRU eviction for recoverable caches

---

## Key Naming Convention Analysis

Current state has inconsistent prefixes:

| Prefix | Count | Usage |
|--------|-------|-------|
| `sql-adapt-*` | 22 keys | User profile, debug settings, UI state, sync |
| `sql-learning-*` | 14 keys | Learning data (interactions, textbook, sessions) |
| `sqladapt:*` | 1 key | Recent searches (typo/inconsistency) |
| `hint-cache:*` | Dynamic | Hint cache with scoped keys |
| `hints-*` | Legacy (being removed) | Legacy hint storage |
| `hint-info-*` | Legacy (being removed) | Legacy hint metadata |

**Recommendation:** Standardize on `sql-adapt-*` for all new keys. Consider migrating `sql-learning-*` keys in a future data migration.

---

## Storage Key Reference (Alphabetical)

| Key | Classification | Module |
|-----|----------------|--------|
| `chat-history-${learnerId}-${problemId}` | RECOVERABLE_CACHE | AskMyTextbookChat.tsx |
| `hint-cache:${learnerId}:${problemId}` | RECOVERABLE_CACHE | hint-cache.ts |
| `sql-adapt-debug-profile` | DEBUG_DEV_ONLY | storage.ts, storage-validation.ts |
| `sql-adapt-debug-strategy` | DEBUG_DEV_ONLY | storage.ts, storage-validation.ts |
| `sql-adapt-dead-letter` | CRITICAL_SESSION | dual-storage.ts |
| `sql-adapt-demo-mode` | DEBUG_DEV_ONLY | demo-mode.ts |
| `sql-adapt-last-active` | CRITICAL_SESSION | useSessionPersistence.ts |
| `sql-adapt-llm-settings` | RECOVERABLE_CACHE | LLMSettingsHelper.tsx |
| `sql-adapt-offline-queue` | CRITICAL_SESSION | dual-storage.ts |
| `sql-adapt-pending-confirmed` | CRITICAL_SESSION | dual-storage.ts |
| `sql-adapt-pending-interactions` | CRITICAL_SESSION | dual-storage.ts |
| `sql-adapt-pending-session-ends` | CRITICAL_SESSION | dual-storage.ts |
| `sql-adapt-preview-mode` | DEBUG_DEV_ONLY | storage.ts, ui-state.ts |
| `sql-adapt-profile-cache` | RECOVERABLE_CACHE | learner-profile-client.ts |
| `sql-adapt-session-config` | CRITICAL_DURABLE | condition-assignment.ts, storage.ts |
| `sql-adapt-sync` | SYNC/UTILITY | storage.ts |
| `sql-adapt-ui-state-v1:*` | RECOVERABLE_CACHE | ui-state.ts |
| `sql-adapt-user-profile` | CRITICAL_DURABLE | storage.ts |
| `sql-adapt-user-role` | DEBUG_DEV_ONLY | LearningInterface.tsx |
| `sql-adapt-welcome-disabled` | DEBUG_DEV_ONLY | RootLayout.tsx, WelcomeModal.tsx |
| `sql-adapt-welcome-seen` | DEBUG_DEV_ONLY | RootLayout.tsx, WelcomeModal.tsx |
| `sql-learning-active-session` | CRITICAL_DURABLE | storage.ts |
| `sql-learning-interactions` | CRITICAL_DURABLE | storage.ts |
| `sql-learning-llm-cache` | RECOVERABLE_CACHE | storage.ts |
| `sql-learning-pdf-index` | CRITICAL_DURABLE | storage.ts |
| `sql-learning-pdf-uploads` | CRITICAL_DURABLE | storage.ts |
| `sql-learning-policy-replay-mode` | CRITICAL_DURABLE | storage.ts |
| `sql-learning-practice-drafts` | CRITICAL_DURABLE | storage.ts |
| `sql-learning-profiles` | CRITICAL_DURABLE | storage.ts |
| `sql-learning-reinforcement-schedules` | CRITICAL_DURABLE | reinforcement-manager.ts |
| `sql-learning-textbook` | CRITICAL_DURABLE | storage.ts |
| `sqladapt:recent-searches` | RECOVERABLE_CACHE | useCommandSearch.ts |

---

## Appendices

### Appendix A: sessionStorage Usage

Only 2 test files use sessionStorage - production code does not use sessionStorage:
- `lib/ml/hint-service/resources.test.ts`
- `lib/api/llm-client.test.ts`

### Appendix B: Legacy Keys Being Removed

The hint-cache.ts file maintains backward compatibility for these legacy keys:
- `hints-${learnerId}-${problemId}` - Legacy hint storage
- `hint-info-${learnerId}-${problemId}` - Legacy hint metadata

These are cleaned up during migration in `migrateLegacyHints()`.

### Appendix C: Files with No Storage Usage

Components and hooks that do NOT use localStorage (good for reference when ensuring isolation):
- Most UI components in `components/ui/`
- Most page components (excluding those listed above)
- Utility functions (excluding storage-related ones)
