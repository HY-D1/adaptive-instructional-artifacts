/**
 * Storage Validation Module
 * 
 * Provides validation functions for localStorage values to prevent
 * corruption and ensure data integrity across the application.
 */

// Valid escalation profile IDs
const VALID_PROFILE_IDS = new Set([
  'fast-escalator',
  'slow-escalator', 
  'adaptive-escalator',
  'explanation-first'
]);

// Valid assignment strategies
const VALID_STRATEGIES = new Set(['static', 'diagnostic', 'bandit']);

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
export function parseBooleanString(value: string | null): boolean {
  return value === 'true';
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
    return null;
  } catch {
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
    return parseBooleanString(value);
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
    console.warn(`[Storage Validation] Invalid profile ID rejected: ${profileId}`);
    return false;
  } catch {
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
    return false;
  } catch {
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
  if (trimmedName.length < 1 || trimmedName.length > 100) {
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
