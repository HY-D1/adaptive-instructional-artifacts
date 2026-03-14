/**
 * Canonical storage export
 * Uses dual-storage (backend API with localStorage fallback)
 * 
 * This is the single source of truth for storage imports across the app.
 * Import from here instead of importing directly from storage-local.ts or dual-storage.ts
 * 
 * @example
 * ```typescript
 * import { storage } from '../lib/storage';
 * ```
 */

// ============================================================================
// Main Storage Export (Dual-Storage: Backend API + localStorage fallback)
// ============================================================================

export { dualStorage as storage } from './dual-storage';
export { dualStorage } from './dual-storage';
export type { StorageMode } from './dual-storage';

// ============================================================================
// Re-export types from types module for compatibility
// ============================================================================

export type { 
  LearnerProfile,
  InstructionalUnit,
  UserProfile,
  InteractionEvent,
  SaveTextbookUnitResult,
  SessionConfig,
} from '../../types';

// Export CreateUnitInput from storage-local
export type { CreateUnitInput } from './storage';

// ============================================================================
// Cross-Tab Sync Utilities (from storage-local - localStorage only)
// ============================================================================

export {
  broadcastSync,
  subscribeToSync,
  setPreviewModeWithSync,
  getPreviewMode,
  clearPreviewModeWithSync,
  setDebugProfileWithSync,
  getDebugProfile,
  setDebugStrategyWithSync,
  getDebugStrategy,
  clearAllDebugSettingsWithSync,
} from './storage';

// Week 6: Session Configuration for Experimental Control
export {
  saveSessionConfig as saveSessionConfigToStorage,
  loadSessionConfig as loadSessionConfigFromStorage,
  clearSessionConfig as clearSessionConfigFromStorage,
} from '../experiments/condition-assignment';

// ============================================================================
// Storage Client (for direct backend access when needed)
// ============================================================================

export { 
  storageClient, 
  isBackendAvailable, 
  checkBackendHealth 
} from '../api/storage-client';

// ============================================================================
// Default Export
// ============================================================================

export { dualStorage as default } from './dual-storage';
