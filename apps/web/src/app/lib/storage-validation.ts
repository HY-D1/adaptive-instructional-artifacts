/**
 * Storage Validation Utilities
 *
 * Provides type-safe validation and safe access patterns for localStorage values.
 * All functions include error handling and automatic cleanup of invalid data.
 *
 * @module storage-validation
 */

import type { UserProfile, UserRole } from '../types';

// ============================================================================
// Valid Values
// ============================================================================

/** Valid escalation profile IDs for adaptive personalization */
const VALID_PROFILE_IDS = [
  'fast-escalator',
  'slow-escalator',
  'adaptive-escalator',
  'explanation-first'
] as const;

/** Valid assignment strategies for profile selection */
const VALID_STRATEGIES = ['static', 'diagnostic', 'bandit'] as const;

/** localStorage keys used by this module */
const STORAGE_KEYS = {
  PROFILE_OVERRIDE: 'sql-adapt-debug-profile',
  STRATEGY: 'sql-adapt-debug-strategy',
  PREVIEW_MODE: 'sql-adapt-preview-mode'
} as const;

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Validates a profile ID against known escalation profiles.
 *
 * @param value - The profile ID string to validate
 * @returns True if the profile ID is valid, false otherwise
 *
 * @example
 * ```typescript
 * isValidProfileId('fast-escalator');     // true
 * isValidProfileId('invalid-profile');    // false
 * ```
 */
export function isValidProfileId(value: string): boolean {
  return VALID_PROFILE_IDS.includes(value as typeof VALID_PROFILE_IDS[number]);
}

/**
 * Validates an assignment strategy.
 *
 * @param value - The strategy string to validate
 * @returns True if the strategy is valid, false otherwise
 *
 * @example
 * ```typescript
 * isValidStrategy('bandit');     // true
 * isValidStrategy('random');     // false
 * ```
 */
export function isValidStrategy(value: string): boolean {
  return VALID_STRATEGIES.includes(value as typeof VALID_STRATEGIES[number]);
}

/**
 * Type guard to check if a value is a valid UserRole.
 *
 * @param value - The value to check
 * @returns True if the value is 'student' or 'instructor'
 */
function isValidUserRole(value: unknown): value is UserRole {
  return value === 'student' || value === 'instructor';
}

// ============================================================================
// Boolean Parsing
// ============================================================================

/**
 * Parses a boolean string value from localStorage.
 *
 * localStorage only stores strings, so boolean values are stored as
 * 'true' or 'false'. This function safely parses these values.
 *
 * @param value - The string value to parse (may be null from localStorage)
 * @returns Parsed boolean, or null if the value is not a valid boolean string
 *
 * @example
 * ```typescript
 * parseBooleanString('true');      // true
 * parseBooleanString('false');     // false
 * parseBooleanString(null);        // null
 * parseBooleanString('yes');       // null
 * ```
 */
export function parseBooleanString(value: string | null): boolean | null {
  if (value === 'true') return true;
  if (value === 'false') return false;
  return null;
}

// ============================================================================
// User Profile Validation
// ============================================================================

/**
 * Validates an unknown value as a UserProfile object.
 *
 * Performs runtime type checking to ensure the object has all required
 * fields with correct types. Used when loading profiles from localStorage
 * to prevent corrupted data from crashing the application.
 *
 * @param profile - The value to validate
 * @returns True if the value is a valid UserProfile, false otherwise
 *
 * @example
 * ```typescript
 * const raw = JSON.parse(localStorage.getItem('profile'));
 * if (isValidUserProfile(raw)) {
 *   // TypeScript knows raw is UserProfile here
 *   console.log(raw.role);
 * }
 * ```
 */
export function isValidUserProfile(profile: unknown): profile is UserProfile {
  // Must be a non-null object
  if (typeof profile !== 'object' || profile === null) {
    return false;
  }

  const p = profile as Record<string, unknown>;

  // Check required fields exist and have correct types
  if (typeof p.id !== 'string' || p.id.trim() === '') {
    return false;
  }

  if (typeof p.name !== 'string' || p.name.trim() === '') {
    return false;
  }

  if (!isValidUserRole(p.role)) {
    return false;
  }

  if (typeof p.createdAt !== 'number' || !Number.isFinite(p.createdAt)) {
    return false;
  }

  return true;
}

/**
 * Validates a partial user profile object from storage.
 *
 * Similar to isValidUserProfile but returns a cleaned UserProfile object
 * or null if validation fails. Used internally by storage operations.
 *
 * @param parsed - Partial profile object from parsed JSON
 * @returns Validated UserProfile with normalized fields, or null if invalid
 */
export function validateUserProfileFromStorage(
  parsed: Partial<UserProfile>
): UserProfile | null {
  // Validate required fields
  if (typeof parsed.id !== 'string' || !parsed.id.trim()) {
    return null;
  }

  // Validate name: must be a non-empty string between 1-100 characters
  if (typeof parsed.name !== 'string') {
    return null;
  }
  const trimmedName = parsed.name.trim();
  if (trimmedName.length < 1 || trimmedName.length > 100) {
    return null;
  }

  if (parsed.role !== 'student' && parsed.role !== 'instructor') {
    return null;
  }

  if (typeof parsed.createdAt !== 'number' || !Number.isFinite(parsed.createdAt)) {
    return null;
  }

  return {
    id: parsed.id.trim(),
    name: trimmedName,
    role: parsed.role,
    createdAt: parsed.createdAt
  };
}

// ============================================================================
// Safe localStorage Getters
// ============================================================================

/**
 * Safely retrieves the profile override from localStorage.
 *
 * Validates the stored value and removes it if invalid.
 *
 * @returns The valid profile ID, or null if not set or invalid
 *
 * @example
 * ```typescript
 * const profile = safeGetProfileOverride();
 * if (profile) {
 *   applyProfileOverride(profile);
 * }
 * ```
 */
export function safeGetProfileOverride(): string | null {
  try {
    const value = localStorage.getItem(STORAGE_KEYS.PROFILE_OVERRIDE);
    if (!value) return null;

    if (!isValidProfileId(value)) {
      console.warn(`[Storage] Invalid profile ID: ${value}, clearing`);
      localStorage.removeItem(STORAGE_KEYS.PROFILE_OVERRIDE);
      return null;
    }

    return value;
  } catch (error) {
    console.error('[Storage] Error reading profile override:', error);
    return null;
  }
}

/**
 * Safely retrieves the assignment strategy from localStorage.
 *
 * Validates the stored value and resets to default ('bandit') if invalid.
 *
 * @returns The valid strategy ('static', 'diagnostic', or 'bandit')
 *
 * @example
 * ```typescript
 * const strategy = safeGetStrategy();
 * initializeBandit(strategy);
 * ```
 */
export function safeGetStrategy(): 'static' | 'diagnostic' | 'bandit' {
  try {
    const value = localStorage.getItem(STORAGE_KEYS.STRATEGY);
    if (!value) return 'bandit'; // default

    if (!isValidStrategy(value)) {
      console.warn(`[Storage] Invalid strategy: ${value}, using default`);
      localStorage.setItem(STORAGE_KEYS.STRATEGY, 'bandit');
      return 'bandit';
    }

    return value as 'static' | 'diagnostic' | 'bandit';
  } catch (error) {
    console.error('[Storage] Error reading strategy:', error);
    return 'bandit';
  }
}

/**
 * Safely retrieves the preview mode flag from localStorage.
 *
 * Parses the boolean string and clears invalid values.
 *
 * @returns True if preview mode is enabled, false otherwise
 *
 * @example
 * ```typescript
 * if (safeGetPreviewMode()) {
 *   showPreviewFeatures();
 * }
 * ```
 */
export function safeGetPreviewMode(): boolean {
  try {
    const value = localStorage.getItem(STORAGE_KEYS.PREVIEW_MODE);
    const parsed = parseBooleanString(value);

    if (parsed === null && value !== null) {
      console.warn(`[Storage] Invalid preview mode value: ${value}, clearing`);
      localStorage.removeItem(STORAGE_KEYS.PREVIEW_MODE);
      return false;
    }

    return parsed === true;
  } catch (error) {
    console.error('[Storage] Error reading preview mode:', error);
    return false;
  }
}

/**
 * Safely retrieves and validates a UserProfile from localStorage.
 *
 * Automatically removes corrupted profile data.
 *
 * @param key - The localStorage key (defaults to 'sql-adapt-user-profile')
 * @returns Validated UserProfile, or null if not found or invalid
 *
 * @example
 * ```typescript
 * const profile = safeGetUserProfile();
 * if (profile) {
 *   setCurrentUser(profile);
 * }
 * ```
 */
export function safeGetUserProfile(
  key: string = 'sql-adapt-user-profile'
): UserProfile | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<UserProfile>;
    const validated = validateUserProfileFromStorage(parsed);

    if (!validated) {
      console.warn(`[Storage] Invalid user profile at key: ${key}, clearing`);
      localStorage.removeItem(key);
      return null;
    }

    return validated;
  } catch (error) {
    console.error('[Storage] Error reading user profile:', error);
    // Clean up corrupted data
    try {
      localStorage.removeItem(key);
    } catch {
      // Ignore cleanup errors
    }
    return null;
  }
}

// ============================================================================
// Safe localStorage Setters
// ============================================================================

/**
 * Safely sets the profile override in localStorage.
 *
 * Validates the profile ID before storing.
 *
 * @param profileId - The profile ID to set
 * @returns True if successfully set, false if validation failed
 *
 * @example
 * ```typescript
 * if (safeSetProfileOverride('fast-escalator')) {
 *   console.log('Profile override saved');
 * } else {
 *   console.error('Invalid profile ID');
 * }
 * ```
 */
export function safeSetProfileOverride(profileId: string): boolean {
  if (!isValidProfileId(profileId)) {
    console.error(`[Storage] Attempted to set invalid profile: ${profileId}`);
    return false;
  }

  try {
    localStorage.setItem(STORAGE_KEYS.PROFILE_OVERRIDE, profileId);
    return true;
  } catch (error) {
    console.error('[Storage] Error saving profile override:', error);
    return false;
  }
}

/**
 * Safely sets the assignment strategy in localStorage.
 *
 * Validates the strategy before storing.
 *
 * @param strategy - The strategy to set ('static', 'diagnostic', or 'bandit')
 * @returns True if successfully set, false if validation failed
 *
 * @example
 * ```typescript
 * if (safeSetStrategy('diagnostic')) {
 *   console.log('Strategy saved');
 * }
 * ```
 */
export function safeSetStrategy(strategy: string): boolean {
  if (!isValidStrategy(strategy)) {
    console.error(`[Storage] Attempted to set invalid strategy: ${strategy}`);
    return false;
  }

  try {
    localStorage.setItem(STORAGE_KEYS.STRATEGY, strategy);
    return true;
  } catch (error) {
    console.error('[Storage] Error saving strategy:', error);
    return false;
  }
}

/**
 * Safely sets the preview mode flag in localStorage.
 *
 * Stores the boolean as a string ('true' or 'false').
 *
 * @param enabled - Whether preview mode should be enabled
 * @returns True if successfully set, false on error
 *
 * @example
 * ```typescript
 * safeSetPreviewMode(true);   // stores 'true'
 * safeSetPreviewMode(false);  // stores 'false'
 * ```
 */
export function safeSetPreviewMode(enabled: boolean): boolean {
  try {
    localStorage.setItem(STORAGE_KEYS.PREVIEW_MODE, String(enabled));
    return true;
  } catch (error) {
    console.error('[Storage] Error saving preview mode:', error);
    return false;
  }
}

/**
 * Safely sets a UserProfile in localStorage.
 *
 * Validates the profile before storing and normalizes fields.
 *
 * @param profile - The UserProfile to save
 * @param key - The localStorage key (defaults to 'sql-adapt-user-profile')
 * @returns True if successfully set, false if validation or storage failed
 *
 * @example
 * ```typescript
 * const profile: UserProfile = {
 *   id: 'user-123',
 *   name: 'John Doe',
 *   role: 'student',
 *   createdAt: Date.now()
 * };
 * if (safeSetUserProfile(profile)) {
 *   console.log('Profile saved');
 * }
 * ```
 */
function getCircularReplacer(): (_key: string, value: unknown) => unknown {
  const seen = new WeakSet();
  return (_key: string, value: unknown) => {
    if (value !== null && typeof value === 'object') {
      if (seen.has(value)) {
        return '[Circular]';
      }
      seen.add(value);
    }
    return value;
  };
}

export function safeSetUserProfile(
  profile: UserProfile,
  key: string = 'sql-adapt-user-profile'
): boolean {
  // Normalize createdAt BEFORE validation
  const normalized = {
    ...profile,
    createdAt:
      typeof profile.createdAt === 'number' && Number.isFinite(profile.createdAt)
        ? profile.createdAt
        : Date.now()
  };

  if (!isValidUserProfile(normalized)) {
    console.error('[Storage] Attempted to set invalid user profile');
    return false;
  }

  try {
    localStorage.setItem(key, JSON.stringify(normalized, getCircularReplacer()));
    return true;
  } catch (error) {
    console.error('[Storage] Error saving user profile:', error);
    return false;
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Clears all debug-related localStorage values.
 *
 * Useful for resetting the application to default state.
 *
 * @returns True if all clear operations succeeded
 *
 * @example
 * ```typescript
 * // Reset all debug settings
 * clearDebugSettings();
 * ```
 */
export function clearDebugSettings(): boolean {
  try {
    localStorage.removeItem(STORAGE_KEYS.PROFILE_OVERRIDE);
    localStorage.removeItem(STORAGE_KEYS.STRATEGY);
    localStorage.removeItem(STORAGE_KEYS.PREVIEW_MODE);
    return true;
  } catch (error) {
    console.error('[Storage] Error clearing debug settings:', error);
    return false;
  }
}

/**
 * Gets a summary of all validated localStorage values.
 *
 * Useful for debugging and diagnostics.
 *
 * @returns Object containing all current valid storage values
 *
 * @example
 * ```typescript
 * const settings = getStorageSummary();
 * console.log(settings);
 * // { profileOverride: 'fast-escalator', strategy: 'bandit', previewMode: false }
 * ```
 */
export function getStorageSummary(): {
  profileOverride: string | null;
  strategy: 'static' | 'diagnostic' | 'bandit';
  previewMode: boolean;
  userProfile: UserProfile | null;
} {
  return {
    profileOverride: safeGetProfileOverride(),
    strategy: safeGetStrategy(),
    previewMode: safeGetPreviewMode(),
    userProfile: safeGetUserProfile()
  };
}

// ============================================================================
// Re-export for convenience
// ============================================================================

export { VALID_PROFILE_IDS, VALID_STRATEGIES, STORAGE_KEYS };
