/**
 * Storage Validation Module
 * 
 * Provides validation functions for localStorage values to prevent
 * corruption and ensure data integrity across the application.
 */

// Valid escalation profile IDs
export const VALID_PROFILE_IDS = new Set([
  'fast-escalator',
  'slow-escalator', 
  'adaptive-escalator',
  'explanation-first'
]);

// Valid assignment strategies
export const VALID_STRATEGIES = new Set(['static', 'diagnostic', 'bandit']);

// Storage keys for localStorage
export const STORAGE_KEYS = {
  PROFILE_OVERRIDE: 'sql-adapt-debug-profile',
  STRATEGY: 'sql-adapt-debug-strategy',
  PREVIEW_MODE: 'sql-adapt-preview-mode'
} as const;

// localStorage keys
const PREVIEW_MODE_KEY = 'sql-adapt-preview-mode';
const DEBUG_PROFILE_KEY = 'sql-adapt-debug-profile';
const DEBUG_STRATEGY_KEY = 'sql-adapt-debug-strategy';

/**
 * Validate if a string is a valid escalation profile ID
 */
export function isValidProfileId(value: unknown): value is string {
  return typeof value === 'string' && VALID_PROFILE_IDS.has(value);
}

/**
 * Validate if a string is a valid assignment strategy
 */
export function isValidStrategy(value: unknown): value is 'static' | 'diagnostic' | 'bandit' {
  return typeof value === 'string' && VALID_STRATEGIES.has(value);
}

/**
 * Parse a boolean string value from localStorage
 */
export function parseBooleanString(value: string | null): boolean | null {
  if (value === 'true') return true;
  if (value === 'false') return false;
  return null;
}

/**
 * Safely get profile override from localStorage
 * Returns null if invalid or not found
 */
export function safeGetProfileOverride(): string | null {
  try {
    const value = localStorage.getItem(DEBUG_PROFILE_KEY);
    if (value && isValidProfileId(value)) {
      return value;
    }
    if (value) {
      console.warn(`[Storage] Invalid profile ID: ${value}, clearing`);
      localStorage.removeItem(DEBUG_PROFILE_KEY);
    }
    return null;
  } catch {
    console.error('[Storage] Error reading profile override');
    return null;
  }
}

/**
 * Safely get assignment strategy from localStorage
 * Returns 'bandit' as default if invalid or not found
 */
export function safeGetStrategy(): 'static' | 'diagnostic' | 'bandit' {
  try {
    const value = localStorage.getItem(DEBUG_STRATEGY_KEY);
    if (value && isValidStrategy(value)) {
      return value;
    }
    if (value) {
      console.warn(`[Storage] Invalid strategy: ${value}, using default`);
      localStorage.setItem(DEBUG_STRATEGY_KEY, 'bandit');
    }
    return 'bandit';
  } catch {
    return 'bandit';
  }
}

/**
 * Safely check if preview mode is active
 */
export function safeGetPreviewMode(): boolean {
  try {
    const value = localStorage.getItem(PREVIEW_MODE_KEY);
    const parsed = parseBooleanString(value);
    if (parsed === null && value !== null) {
      // Invalid value - clear it
      console.warn(`[Storage] Invalid preview mode value: ${value}, clearing`);
      localStorage.removeItem(PREVIEW_MODE_KEY);
      return false;
    }
    return parsed ?? false;
  } catch {
    return false;
  }
}

/**
 * Safely set preview mode in localStorage
 */
export function safeSetPreviewMode(enabled: boolean): boolean {
  try {
    localStorage.setItem(PREVIEW_MODE_KEY, String(enabled));
    return true;
  } catch {
    return false;
  }
}

/**
 * Safely set profile override in localStorage
 * Validates the value before storing
 */
export function safeSetProfileOverride(profileId: string): boolean {
  try {
    if (isValidProfileId(profileId)) {
      localStorage.setItem(DEBUG_PROFILE_KEY, profileId);
      return true;
    }
    console.error(`[Storage Validation] Invalid profile ID rejected: ${profileId}`);
    return false;
  } catch {
    console.error('[Storage] Error setting profile override');
    return false;
  }
}

/**
 * Safely set assignment strategy in localStorage
 * Validates the value before storing
 */
export function safeSetStrategy(strategy: string): boolean {
  try {
    if (isValidStrategy(strategy)) {
      localStorage.setItem(DEBUG_STRATEGY_KEY, strategy);
      return true;
    }
    console.warn(`[Storage Validation] Invalid strategy rejected: ${strategy}`);
    console.error(`[Storage Validation] Invalid strategy rejected: ${strategy}`);
    return false;
  } catch {
    console.error('[Storage] Error setting strategy');
    return false;
  }
}

/**
 * Interface for user profile validation
 */
export interface ValidatedUserProfile {
  id: string;
  name: string;
  role: 'student' | 'instructor';
  createdAt: number;
}

/**
 * Validate a user profile object
 */
export function isValidUserProfile(value: unknown): value is ValidatedUserProfile {
  if (!value || typeof value !== 'object') {
    return false;
  }
  
  const profile = value as Record<string, unknown>;
  
  // Validate id
  if (typeof profile.id !== 'string' || !profile.id.trim()) {
    return false;
  }
  
  // Validate name
  if (typeof profile.name !== 'string') {
    return false;
  }
  const trimmedName = profile.name.trim();
  if (trimmedName.length < 1) {
    return false;
  }
  
  // Validate role
  if (profile.role !== 'student' && profile.role !== 'instructor') {
    return false;
  }
  
  // Validate createdAt
  if (typeof profile.createdAt !== 'number' || !Number.isFinite(profile.createdAt)) {
    return false;
  }
  
  return true;
}

/**
 * Safely set user profile in localStorage
 * Stub implementation - returns true for valid profiles
 */
export function safeSetUserProfile(profile: ValidatedUserProfile, key: string = 'sql-adapt-user-profile'): boolean {
  try {
    if (isValidUserProfile(profile)) {
      localStorage.setItem(key, JSON.stringify(profile));
      return true;
    }
    console.error('[Storage] Attempted to set invalid profile:', profile);
    return false;
  } catch {
    console.error('[Storage] Error setting user profile');
    return false;
  }
}

/**
 * Safely get user profile from localStorage
 * Returns null if invalid or not found
 */
export function safeGetUserProfile(key: string = 'sql-adapt-user-profile'): ValidatedUserProfile | null {
  try {
    const value = localStorage.getItem(key);
    if (!value) return null;
    const parsed = JSON.parse(value);
    if (isValidUserProfile(parsed)) {
      return parsed;
    }
    // Invalid profile - clear it and return null
    console.warn('[Storage] Invalid profile structure, clearing');
    localStorage.removeItem(key);
    return null;
  } catch {
    console.error('[Storage] Error reading user profile');
    localStorage.removeItem(key);
    return null;
  }
}

/**
 * Validate and normalize user profile from storage
 * Returns null if invalid
 */
export function validateUserProfileFromStorage(profile: Partial<ValidatedUserProfile>): ValidatedUserProfile | null {
  if (!profile || typeof profile !== 'object') {
    return null;
  }
  
  // Require all required fields
  if (!profile.id || !profile.name || !profile.role || profile.createdAt === undefined) {
    return null;
  }
  
  const id = String(profile.id).trim();
  const name = String(profile.name).trim();
  const role = profile.role;
  const createdAt = Number(profile.createdAt);
  
  // Validate fields
  if (!id || !name || name.length > 100 || (role !== 'student' && role !== 'instructor')) {
    return null;
  }
  
  if (!Number.isFinite(createdAt)) {
    return null;
  }
  
  return { id, name, role, createdAt };
}

/**
 * Clear all debug settings from localStorage
 * Returns true on success, false on error
 */
export function clearDebugSettings(): boolean {
  try {
    localStorage.removeItem(DEBUG_PROFILE_KEY);
    localStorage.removeItem(DEBUG_STRATEGY_KEY);
    localStorage.removeItem(PREVIEW_MODE_KEY);
    return true;
  } catch {
    return false;
  }
}

/**
 * Get summary of storage usage and current settings
 */
export function getStorageSummary(): { 
  profileOverride: string | null; 
  strategy: string; 
  previewMode: boolean;
  userProfile: ValidatedUserProfile | null;
} {
  return {
    profileOverride: safeGetProfileOverride(),
    strategy: safeGetStrategy(),
    previewMode: safeGetPreviewMode(),
    userProfile: safeGetUserProfile()
  };
}
