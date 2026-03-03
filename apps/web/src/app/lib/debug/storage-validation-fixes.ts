/**
 * Suggested Fixes for storage-validation.ts
 * 
 * This file contains the recommended fixes for the bugs found during
 * comprehensive testing. Apply these changes to the original file.
 */

// ============================================================================
// FIX 1: safeSetUserProfile - Normalize before validation + circular ref handling
// ============================================================================

/**
 * FIXED VERSION of safeSetUserProfile
 * 
 * Changes:
 * 1. Normalizes createdAt BEFORE validation (fixes Bug #1)
 * 2. Handles circular references gracefully (fixes Bug #2)
 * 3. Provides better error messages
 */
export function safeSetUserProfileFixed(
  profile: UserProfile,
  key: string = 'sql-adapt-user-profile'
): boolean {
  // FIX 1: Normalize BEFORE validation
  const normalizedProfile = {
    ...profile,
    createdAt: typeof profile.createdAt === 'number' && Number.isFinite(profile.createdAt)
      ? profile.createdAt
      : Date.now()
  };

  // Now validate the normalized profile
  if (!isValidUserProfile(normalizedProfile)) {
    console.error('[Storage] Attempted to set invalid user profile');
    return false;
  }

  try {
    // FIX 2: Use a circular reference safe stringifier
    localStorage.setItem(key, safeStringify(normalizedProfile));
    return true;
  } catch (error) {
    console.error('[Storage] Error saving user profile:', error);
    return false;
  }
}

/**
 * Helper: Creates a JSON stringifier that handles circular references
 * 
 * @returns JSON string, with circular refs replaced by '[Circular]'
 */
function getCircularReplacer(): (key: string, value: unknown) => unknown {
  const seen = new WeakSet<object>();
  return (_key: string, value: unknown): unknown => {
    if (value !== null && typeof value === 'object') {
      if (seen.has(value)) {
        return '[Circular]';
      }
      seen.add(value);
    }
    return value;
  };
}

/**
 * Safely stringify an object, handling circular references
 */
function safeStringify(obj: unknown): string {
  return JSON.stringify(obj, getCircularReplacer());
}

// ============================================================================
// FIX 2: isValidUserProfile - Add name length check for consistency
// ============================================================================

import type { UserProfile, UserRole } from '../types';

/**
 * FIXED VERSION of isValidUserProfile
 * 
 * Changes:
 * 1. Added name length check (max 100 chars) for consistency with validateUserProfileFromStorage
 */
export function isValidUserProfileFixed(profile: unknown): profile is UserProfile {
  // Must be a non-null object
  if (typeof profile !== 'object' || profile === null) {
    return false;
  }

  const p = profile as Record<string, unknown>;

  // Check required fields exist and have correct types
  if (typeof p.id !== 'string' || p.id.trim() === '') {
    return false;
  }

  // FIX: Added length check for consistency
  if (typeof p.name !== 'string' || p.name.trim() === '' || p.name.length > 100) {
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

function isValidUserRole(value: unknown): value is UserRole {
  return value === 'student' || value === 'instructor';
}

// ============================================================================
// FIX 3: parseBooleanString - Optional case-insensitive version
// ============================================================================

/**
 * ENHANCED VERSION of parseBooleanString (optional improvement)
 * 
 * Changes:
 * 1. Case-insensitive matching
 * 2. Trims whitespace
 * 
 * This is a BREAKING CHANGE if existing code relies on case sensitivity.
 * Use with caution.
 */
export function parseBooleanStringEnhanced(value: string | null): boolean | null {
  if (value === null) return null;
  const normalized = value.toLowerCase().trim();
  if (normalized === 'true') return true;
  if (normalized === 'false') return false;
  return null;
}

// ============================================================================
// COMPLETE FIXED MODULE (for reference)
// ============================================================================

/**
 * This section shows the complete fixed module with all changes integrated.
 * Copy-paste this to replace the original storage-validation.ts if desired.
 */

/*

// ============================================================================
// Safe localStorage Setters (FIXED)
// ============================================================================

export function safeSetUserProfile(
  profile: UserProfile,
  key: string = 'sql-adapt-user-profile'
): boolean {
  // Normalize BEFORE validation (Fix #1)
  const normalizedProfile = {
    ...profile,
    createdAt: typeof profile.createdAt === 'number' && Number.isFinite(profile.createdAt)
      ? profile.createdAt
      : Date.now()
  };

  if (!isValidUserProfile(normalizedProfile)) {
    console.error('[Storage] Attempted to set invalid user profile');
    return false;
  }

  try {
    // Handle circular references (Fix #2)
    localStorage.setItem(key, JSON.stringify(normalizedProfile, getCircularReplacer()));
    return true;
  } catch (error) {
    if (error instanceof TypeError && (error as Error).message.includes('circular')) {
      console.error('[Storage] Cannot save profile with circular references');
    } else {
      console.error('[Storage] Error saving user profile:', error);
    }
    return false;
  }
}

// ============================================================================
// Type Guards (FIXED)
// ============================================================================

export function isValidUserProfile(profile: unknown): profile is UserProfile {
  if (typeof profile !== 'object' || profile === null) {
    return false;
  }

  const p = profile as Record<string, unknown>;

  if (typeof p.id !== 'string' || p.id.trim() === '') {
    return false;
  }

  // Added length check (Fix #3)
  if (typeof p.name !== 'string' || p.name.trim() === '' || p.name.length > 100) {
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

// ============================================================================
// Helpers (NEW)
// ============================================================================

function getCircularReplacer(): (key: string, value: unknown) => unknown {
  const seen = new WeakSet<object>();
  return (_key: string, value: unknown): unknown => {
    if (value !== null && typeof value === 'object') {
      if (seen.has(value)) {
        return '[Circular]';
      }
      seen.add(value);
    }
    return value;
  };
}

*/

// ============================================================================
// Unit Tests for the Fixes
// ============================================================================

if (import.meta.vitest) {
  const { describe, it, expect, beforeEach } = import.meta.vitest;
  
  // Mock localStorage
  const mockStorage = new Map<string, string>();
  
  beforeEach(() => {
    mockStorage.clear();
    Object.defineProperty(global, 'localStorage', {
      value: {
        getItem: (k: string) => mockStorage.get(k) ?? null,
        setItem: (k: string, v: string) => mockStorage.set(k, v),
        removeItem: (k: string) => mockStorage.delete(k),
      },
      writable: true,
      configurable: true,
    });
  });

  describe('Fixes Validation', () => {
    it('should normalize undefined createdAt before validation', () => {
      const profile = {
        id: 'test',
        name: 'Test',
        role: 'student' as const,
        createdAt: undefined as unknown as number,
      };
      
      // With the fix, this should work
      const result = safeSetUserProfileFixed(profile);
      expect(result).toBe(true);
      
      const stored = JSON.parse(mockStorage.get('sql-adapt-user-profile')!);
      expect(typeof stored.createdAt).toBe('number');
      expect(stored.createdAt).toBeGreaterThan(0);
    });

    it('should handle circular references gracefully', () => {
      const profile: Record<string, unknown> = {
        id: 'test',
        name: 'Test',
        role: 'student',
        createdAt: Date.now(),
      };
      profile.self = profile; // Create circular ref
      
      // Should not throw
      const result = safeSetUserProfileFixed(profile as UserProfile);
      expect(result).toBe(true);
      
      const stored = JSON.parse(mockStorage.get('sql-adapt-user-profile')!);
      expect(stored.self).toBe('[Circular]');
    });

    it('should reject names longer than 100 chars', () => {
      const profile = {
        id: 'test',
        name: 'a'.repeat(101),
        role: 'student' as const,
        createdAt: 123,
      };
      
      expect(isValidUserProfileFixed(profile)).toBe(false);
    });
  });
}
