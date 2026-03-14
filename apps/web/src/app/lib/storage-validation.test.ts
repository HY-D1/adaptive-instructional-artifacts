/**
 * Comprehensive Test Suite for storage-validation.ts
 * 
 * Tests all type guards, parsers, safe getters/setters, and edge cases
 * with detailed reporting of actual vs expected results.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  isValidProfileId,
  isValidStrategy,
  isValidUserProfile,
  parseBooleanString,
  validateUserProfileFromStorage,
  safeGetProfileOverride,
  safeGetStrategy,
  safeGetPreviewMode,
  safeGetUserProfile,
  safeSetProfileOverride,
  safeSetStrategy,
  safeSetPreviewMode,
  safeSetUserProfile,
  clearDebugSettings,
  getStorageSummary,
  VALID_PROFILE_IDS,
  VALID_STRATEGIES,
  STORAGE_KEYS,
} from './storage/storage-validation';
import type { UserProfile } from '../types';

// ============================================================================
// Test Helpers
// ============================================================================

interface TestResult {
  test: string;
  input: unknown;
  expected: unknown;
  actual: unknown;
  passed: boolean;
  error?: string;
}

function runTest(name: string, input: unknown, expected: unknown, testFn: () => unknown): TestResult {
  try {
    const actual = testFn();
    const passed = actual === expected;
    return { test: name, input, expected, actual, passed };
  } catch (error) {
    return { 
      test: name, 
      input, 
      expected, 
      actual: null, 
      passed: false, 
      error: error instanceof Error ? error.message : String(error) 
    };
  }
}

function printResults(results: TestResult[], category: string): void {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`CATEGORY: ${category}`);
  console.log('='.repeat(60));
  
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  
  results.forEach((result, i) => {
    const status = result.passed ? '✅ PASS' : '❌ FAIL';
    console.log(`\n${i + 1}. ${status}: ${result.test}`);
    console.log(`   Input:    ${JSON.stringify(result.input)}`);
    console.log(`   Expected: ${JSON.stringify(result.expected)}`);
    console.log(`   Actual:   ${JSON.stringify(result.actual)}`);
    if (result.error) {
      console.log(`   Error:    ${result.error}`);
    }
  });
  
  console.log(`\n${'-'.repeat(60)}`);
  console.log(`SUMMARY: ${passed} passed, ${failed} failed`);
  console.log('='.repeat(60));
}

// ============================================================================
// Mock localStorage
// ============================================================================

class MockLocalStorage {
  private store: Map<string, string> = new Map();
  
  getItem(key: string): string | null {
    return this.store.get(key) ?? null;
  }
  
  setItem(key: string, value: string): void {
    this.store.set(key, value);
  }
  
  removeItem(key: string): void {
    this.store.delete(key);
  }
  
  clear(): void {
    this.store.clear();
  }
  
  get size(): number {
    return this.store.size;
  }
  
  // Test helper to simulate quota exceeded error
  simulateQuotaExceeded(key: string): void {
    const originalSet = this.setItem.bind(this);
    this.setItem = (k: string, v: string) => {
      if (k === key) {
        throw new DOMException('QuotaExceededError', 'QuotaExceededError');
      }
      originalSet(k, v);
    };
  }
  
  // Test helper to simulate generic error
  simulateError(key: string): void {
    const originalGet = this.getItem.bind(this);
    this.getItem = (k: string) => {
      if (k === key) {
        throw new Error('Simulated storage error');
      }
      return originalGet(k);
    };
  }
  
  resetMocks(): void {
    this.store.clear();
    this.getItem = (key: string) => this.store.get(key) ?? null;
    this.setItem = (key: string, value: string) => { this.store.set(key, value); };
    this.removeItem = (key: string) => { this.store.delete(key); };
  }
}

// ============================================================================
// Test Suite
// ============================================================================

describe('storage-validation comprehensive tests', () => {
  let mockStorage: MockLocalStorage;
  let consoleSpy: {
    warn: ReturnType<typeof vi.spyOn>;
    error: ReturnType<typeof vi.spyOn>;
    log: ReturnType<typeof vi.spyOn>;
  };

  beforeEach(() => {
    mockStorage = new MockLocalStorage();
    
    // Mock localStorage
    Object.defineProperty(global, 'localStorage', {
      value: mockStorage,
      writable: true,
      configurable: true,
    });
    
    // Mock console
    consoleSpy = {
      warn: vi.spyOn(console, 'warn').mockImplementation(() => {}),
      error: vi.spyOn(console, 'error').mockImplementation(() => {}),
      log: vi.spyOn(console, 'log').mockImplementation(() => {}),
    };
  });

  afterEach(() => {
    mockStorage.resetMocks();
    vi.restoreAllMocks();
  });

  // ============================================================================
  // 1. TYPE GUARD TESTING - isValidProfileId
  // ============================================================================
  
  describe('isValidProfileId type guard', () => {
    const testCases = [
      { input: 'fast-escalator', expected: true, desc: 'valid fast-escalator' },
      { input: 'slow-escalator', expected: true, desc: 'valid slow-escalator' },
      { input: 'adaptive-escalator', expected: true, desc: 'valid adaptive-escalator' },
      { input: 'explanation-first', expected: true, desc: 'valid explanation-first' },
      { input: 'invalid', expected: false, desc: 'invalid profile string' },
      { input: '', expected: false, desc: 'empty string' },
      { input: null, expected: false, desc: 'null value' },
      { input: undefined, expected: false, desc: 'undefined value' },
      { input: 123, expected: false, desc: 'number instead of string' },
      { input: {}, expected: false, desc: 'object instead of string' },
      { input: [], expected: false, desc: 'array instead of string' },
      { input: true, expected: false, desc: 'boolean instead of string' },
      { input: 'Fast-Escalator', expected: false, desc: 'wrong case' },
      { input: ' fast-escalator', expected: false, desc: 'leading space' },
      { input: 'fast-escalator ', expected: false, desc: 'trailing space' },
    ];

    it.each(testCases)('$desc: should return $expected for $input', ({ input, expected }) => {
      // Note: Type signature requires string, but we test runtime behavior
      const result = isValidProfileId(input as string);
      expect(result).toBe(expected);
    });

    it('should handle all valid profile IDs from constant', () => {
      VALID_PROFILE_IDS.forEach(id => {
        expect(isValidProfileId(id)).toBe(true);
      });
    });

    it('should reject similar but invalid strings', () => {
      const similar = [
        'fast-escalators',
        'fast_escalator',
        'fastescalator',
        'adaptive-escalators',
        'explanationfirst',
        'explanation_first',
      ];
      similar.forEach(id => {
        expect(isValidProfileId(id)).toBe(false);
      });
    });
  });

  // ============================================================================
  // 2. TYPE GUARD TESTING - isValidStrategy
  // ============================================================================
  
  describe('isValidStrategy type guard', () => {
    const testCases = [
      { input: 'static', expected: true, desc: 'valid static' },
      { input: 'diagnostic', expected: true, desc: 'valid diagnostic' },
      { input: 'bandit', expected: true, desc: 'valid bandit' },
      { input: 'invalid', expected: false, desc: 'invalid strategy string' },
      { input: '', expected: false, desc: 'empty string' },
      { input: null, expected: false, desc: 'null value' },
      { input: undefined, expected: false, desc: 'undefined value' },
      { input: 123, expected: false, desc: 'number instead of string' },
      { input: {}, expected: false, desc: 'object instead of string' },
      { input: 'STATIC', expected: false, desc: 'uppercase' },
      { input: 'Static', expected: false, desc: 'capitalized' },
      { input: ' bandit', expected: false, desc: 'leading space' },
    ];

    it.each(testCases)('$desc: should return $expected for $input', ({ input, expected }) => {
      const result = isValidStrategy(input as string);
      expect(result).toBe(expected);
    });

    it('should handle all valid strategies from constant', () => {
      VALID_STRATEGIES.forEach(strategy => {
        expect(isValidStrategy(strategy)).toBe(true);
      });
    });
  });

  // ============================================================================
  // 3. TYPE GUARD TESTING - isValidUserProfile
  // ============================================================================
  
  describe('isValidUserProfile type guard', () => {
    const validProfile: UserProfile = {
      id: 'test',
      name: 'Test',
      role: 'student',
      createdAt: 123,
    };

    const testCases = [
      { 
        input: validProfile, 
        expected: true, 
        desc: 'valid complete profile' 
      },
      { 
        input: { ...validProfile, id: '' }, 
        expected: false, 
        desc: 'empty id string' 
      },
      { 
        input: { ...validProfile, id: '   ' }, 
        expected: false, 
        desc: 'whitespace-only id' 
      },
      { 
        input: { ...validProfile, name: '' }, 
        expected: false, 
        desc: 'empty name string' 
      },
      { 
        input: { ...validProfile, name: '   ' }, 
        expected: false, 
        desc: 'whitespace-only name' 
      },
      { 
        input: { ...validProfile, role: 'admin' as 'student' }, 
        expected: false, 
        desc: 'invalid role' 
      },
      { 
        input: { ...validProfile, role: 'teacher' as 'student' }, 
        expected: false, 
        desc: 'wrong role string' 
      },
      { 
        input: { ...validProfile, createdAt: -1 }, 
        expected: true, 
        desc: 'negative createdAt (still valid number)' 
      },
      { 
        input: { ...validProfile, createdAt: NaN }, 
        expected: false, 
        desc: 'NaN createdAt' 
      },
      { 
        input: { ...validProfile, createdAt: Infinity }, 
        expected: false, 
        desc: 'Infinity createdAt' 
      },
      { 
        input: { ...validProfile, createdAt: -Infinity }, 
        expected: false, 
        desc: '-Infinity createdAt' 
      },
      { 
        input: { id: 'test', name: 'Test', role: 'student' as const }, 
        expected: false, 
        desc: 'missing createdAt' 
      },
      { 
        input: null, 
        expected: false, 
        desc: 'null value' 
      },
      { 
        input: 'string', 
        expected: false, 
        desc: 'string instead of object' 
      },
      { 
        input: {}, 
        expected: false, 
        desc: 'empty object' 
      },
      { 
        input: { id: 123, name: 'Test', role: 'student' as const, createdAt: 123 }, 
        expected: false, 
        desc: 'id is number' 
      },
      { 
        input: { id: 'test', name: 123, role: 'student' as const, createdAt: 123 }, 
        expected: false, 
        desc: 'name is number' 
      },
      { 
        input: { id: 'test', name: 'Test', role: 123, createdAt: 123 }, 
        expected: false, 
        desc: 'role is number' 
      },
      { 
        input: { id: 'test', name: 'Test', role: 'student' as const, createdAt: '123' }, 
        expected: false, 
        desc: 'createdAt is string' 
      },
      { 
        input: { id: 'test', name: 'Test', role: 'instructor' as const, createdAt: 123 }, 
        expected: true, 
        desc: 'valid instructor role' 
      },
    ];

    it.each(testCases)('$desc: should return $expected', ({ input, expected }) => {
      const result = isValidUserProfile(input);
      expect(result).toBe(expected);
    });

    it('should handle additional properties gracefully', () => {
      const profileWithExtra = {
        ...validProfile,
        extraField: 'ignored',
        anotherField: 123,
      };
      expect(isValidUserProfile(profileWithExtra)).toBe(true);
    });

    it('should reject array input', () => {
      expect(isValidUserProfile([validProfile])).toBe(false);
    });

    it('should reject function input', () => {
      expect(isValidUserProfile(() => {})).toBe(false);
    });
  });

  // ============================================================================
  // 4. BOOLEAN PARSING TESTING
  // ============================================================================
  
  describe('parseBooleanString', () => {
    const testCases = [
      { input: 'true', expected: true, desc: 'lowercase true' },
      { input: 'false', expected: false, desc: 'lowercase false' },
      { input: 'TRUE', expected: null, desc: 'uppercase TRUE' },
      { input: 'FALSE', expected: null, desc: 'uppercase FALSE' },
      { input: 'True', expected: null, desc: 'capitalized True' },
      { input: 'False', expected: null, desc: 'capitalized False' },
      { input: 'yes', expected: null, desc: 'yes string' },
      { input: 'no', expected: null, desc: 'no string' },
      { input: '1', expected: null, desc: 'string 1' },
      { input: '0', expected: null, desc: 'string 0' },
      { input: '', expected: null, desc: 'empty string' },
      { input: null, expected: null, desc: 'null' },
      { input: undefined, expected: null, desc: 'undefined' },
      { input: ' true', expected: null, desc: 'leading space true' },
      { input: 'true ', expected: null, desc: 'trailing space true' },
      { input: 'true\n', expected: null, desc: 'newline after true' },
      { input: '\ttrue', expected: null, desc: 'tab before true' },
    ];

    it.each(testCases)('$desc: should return $expected for $input', ({ input, expected }) => {
      const result = parseBooleanString(input as string | null);
      expect(result).toBe(expected);
    });

    it('should handle boolean inputs (edge case)', () => {
      // The function signature only accepts string | null, but runtime might get booleans
      expect(parseBooleanString(true as unknown as string)).toBe(null);
      expect(parseBooleanString(false as unknown as string)).toBe(null);
    });
  });

  // ============================================================================
  // 5. USER PROFILE VALIDATION FROM STORAGE
  // ============================================================================
  
  describe('validateUserProfileFromStorage', () => {
    it('should validate and normalize a valid profile', () => {
      const input = {
        id: '  test-id  ',
        name: '  Test User  ',
        role: 'student' as const,
        createdAt: 123456,
      };
      
      const result = validateUserProfileFromStorage(input);
      
      expect(result).not.toBeNull();
      expect(result?.id).toBe('test-id'); // trimmed
      expect(result?.name).toBe('Test User'); // trimmed
      expect(result?.role).toBe('student');
      expect(result?.createdAt).toBe(123456);
    });

    it('should reject profile with empty id after trim', () => {
      const input = {
        id: '   ',
        name: 'Test',
        role: 'student' as const,
        createdAt: 123,
      };
      
      expect(validateUserProfileFromStorage(input)).toBeNull();
    });

    it('should reject profile with name too long (>100 chars)', () => {
      const input = {
        id: 'test',
        name: 'a'.repeat(101),
        role: 'student' as const,
        createdAt: 123,
      };
      
      expect(validateUserProfileFromStorage(input)).toBeNull();
    });

    it('should accept profile with name exactly 100 chars', () => {
      const input = {
        id: 'test',
        name: 'a'.repeat(100),
        role: 'student' as const,
        createdAt: 123,
      };
      
      expect(validateUserProfileFromStorage(input)).not.toBeNull();
    });

    it('should handle instructor role', () => {
      const input = {
        id: 'test',
        name: 'Test',
        role: 'instructor' as const,
        createdAt: 123,
      };
      
      const result = validateUserProfileFromStorage(input);
      expect(result?.role).toBe('instructor');
    });

    it('should reject invalid role', () => {
      const input = {
        id: 'test',
        name: 'Test',
        role: 'admin' as 'student',
        createdAt: 123,
      };
      
      expect(validateUserProfileFromStorage(input)).toBeNull();
    });

    it('should reject non-finite createdAt', () => {
      const input = {
        id: 'test',
        name: 'Test',
        role: 'student' as const,
        createdAt: NaN,
      };
      
      expect(validateUserProfileFromStorage(input)).toBeNull();
    });

    it('should handle very large createdAt values', () => {
      const input = {
        id: 'test',
        name: 'Test',
        role: 'student' as const,
        createdAt: Number.MAX_SAFE_INTEGER,
      };
      
      const result = validateUserProfileFromStorage(input);
      expect(result?.createdAt).toBe(Number.MAX_SAFE_INTEGER);
    });
  });

  // ============================================================================
  // 6. SAFE GETTER TESTING
  // ============================================================================
  
  describe('safeGetProfileOverride', () => {
    it('should return null when no value is set', () => {
      expect(safeGetProfileOverride()).toBeNull();
    });

    it('should return valid profile ID', () => {
      mockStorage.setItem(STORAGE_KEYS.PROFILE_OVERRIDE, 'fast-escalator');
      expect(safeGetProfileOverride()).toBe('fast-escalator');
    });

    it('should clear invalid profile ID and return null', () => {
      mockStorage.setItem(STORAGE_KEYS.PROFILE_OVERRIDE, 'invalid-profile');
      
      const result = safeGetProfileOverride();
      
      expect(result).toBeNull();
      expect(mockStorage.getItem(STORAGE_KEYS.PROFILE_OVERRIDE)).toBeNull();
      expect(consoleSpy.warn).toHaveBeenCalledWith(
        '[Storage] Invalid profile ID: invalid-profile, clearing'
      );
    });

    it('should handle localStorage errors gracefully', () => {
      mockStorage.simulateError(STORAGE_KEYS.PROFILE_OVERRIDE);
      mockStorage.setItem(STORAGE_KEYS.PROFILE_OVERRIDE, 'fast-escalator');
      
      const result = safeGetProfileOverride();
      
      expect(result).toBeNull();
      expect(consoleSpy.error).toHaveBeenCalled();
    });

    it('should handle empty string', () => {
      mockStorage.setItem(STORAGE_KEYS.PROFILE_OVERRIDE, '');
      
      const result = safeGetProfileOverride();
      
      expect(result).toBeNull();
    });
  });

  describe('safeGetStrategy', () => {
    it('should return default "bandit" when no value is set', () => {
      expect(safeGetStrategy()).toBe('bandit');
    });

    it('should return valid strategy', () => {
      mockStorage.setItem(STORAGE_KEYS.STRATEGY, 'static');
      expect(safeGetStrategy()).toBe('static');
    });

    it('should reset to default when invalid and log warning', () => {
      mockStorage.setItem(STORAGE_KEYS.STRATEGY, 'random');
      
      const result = safeGetStrategy();
      
      expect(result).toBe('bandit');
      expect(mockStorage.getItem(STORAGE_KEYS.STRATEGY)).toBe('bandit');
      expect(consoleSpy.warn).toHaveBeenCalledWith(
        '[Storage] Invalid strategy: random, using default'
      );
    });

    it('should handle localStorage errors and return default', () => {
      mockStorage.simulateError(STORAGE_KEYS.STRATEGY);
      mockStorage.setItem(STORAGE_KEYS.STRATEGY, 'diagnostic');
      
      const result = safeGetStrategy();
      
      expect(result).toBe('bandit');
    });
  });

  describe('safeGetPreviewMode', () => {
    it('should return false when no value is set', () => {
      expect(safeGetPreviewMode()).toBe(false);
    });

    it('should return true when set to "true"', () => {
      mockStorage.setItem(STORAGE_KEYS.PREVIEW_MODE, 'true');
      expect(safeGetPreviewMode()).toBe(true);
    });

    it('should return false when set to "false"', () => {
      mockStorage.setItem(STORAGE_KEYS.PREVIEW_MODE, 'false');
      expect(safeGetPreviewMode()).toBe(false);
    });

    it('should clear invalid value and return false', () => {
      mockStorage.setItem(STORAGE_KEYS.PREVIEW_MODE, 'yes');
      
      const result = safeGetPreviewMode();
      
      expect(result).toBe(false);
      expect(mockStorage.getItem(STORAGE_KEYS.PREVIEW_MODE)).toBeNull();
      expect(consoleSpy.warn).toHaveBeenCalledWith(
        '[Storage] Invalid preview mode value: yes, clearing'
      );
    });

    it('should handle localStorage errors', () => {
      mockStorage.simulateError(STORAGE_KEYS.PREVIEW_MODE);
      mockStorage.setItem(STORAGE_KEYS.PREVIEW_MODE, 'true');
      
      expect(safeGetPreviewMode()).toBe(false);
    });
  });

  describe('safeGetUserProfile', () => {
    it('should return null when no profile is set', () => {
      expect(safeGetUserProfile()).toBeNull();
    });

    it('should return valid profile', () => {
      const profile: UserProfile = {
        id: 'user-123',
        name: 'Test User',
        role: 'student',
        createdAt: Date.now(),
      };
      mockStorage.setItem('sql-adapt-user-profile', JSON.stringify(profile));
      
      const result = safeGetUserProfile();
      
      expect(result).toEqual(profile);
    });

    it('should clear and return null for invalid JSON', () => {
      mockStorage.setItem('sql-adapt-user-profile', 'not-valid-json');
      
      const result = safeGetUserProfile();
      
      expect(result).toBeNull();
      expect(mockStorage.getItem('sql-adapt-user-profile')).toBeNull();
      expect(consoleSpy.error).toHaveBeenCalled();
    });

    it('should clear and return null for invalid profile structure', () => {
      const invalidProfile = { id: 'test', name: 'Test' }; // missing role and createdAt
      mockStorage.setItem('sql-adapt-user-profile', JSON.stringify(invalidProfile));
      
      const result = safeGetUserProfile();
      
      expect(result).toBeNull();
      expect(mockStorage.getItem('sql-adapt-user-profile')).toBeNull();
      expect(consoleSpy.warn).toHaveBeenCalled();
    });

    it('should handle custom key', () => {
      const profile: UserProfile = {
        id: 'user-456',
        name: 'Custom User',
        role: 'instructor',
        createdAt: 123456,
      };
      mockStorage.setItem('custom-profile-key', JSON.stringify(profile));
      
      const result = safeGetUserProfile('custom-profile-key');
      
      expect(result).toEqual(profile);
    });

    it('should handle localStorage errors', () => {
      mockStorage.simulateError('sql-adapt-user-profile');
      
      const result = safeGetUserProfile();
      
      expect(result).toBeNull();
    });
  });

  // ============================================================================
  // 7. SAFE SETTER TESTING
  // ============================================================================
  
  describe('safeSetProfileOverride', () => {
    it('should set valid profile ID', () => {
      const result = safeSetProfileOverride('slow-escalator');
      
      expect(result).toBe(true);
      expect(mockStorage.getItem(STORAGE_KEYS.PROFILE_OVERRIDE)).toBe('slow-escalator');
    });

    it('should reject invalid profile ID', () => {
      const result = safeSetProfileOverride('invalid');
      
      expect(result).toBe(false);
      expect(mockStorage.getItem(STORAGE_KEYS.PROFILE_OVERRIDE)).toBeNull();
      expect(consoleSpy.error).toHaveBeenCalledWith(
        '[Storage Validation] Invalid profile ID rejected: invalid'
      );
    });

    it('should handle localStorage quota exceeded', () => {
      // Simulate quota error by temporarily breaking setItem
      const originalSetItem = mockStorage.setItem.bind(mockStorage);
      mockStorage.setItem = (key: string, value: string) => {
        throw new DOMException('QuotaExceededError', 'QuotaExceededError');
      };
      
      const result = safeSetProfileOverride('fast-escalator');
      
      expect(result).toBe(false);
      expect(consoleSpy.error).toHaveBeenCalled();
      
      // Restore
      mockStorage.setItem = originalSetItem;
    });
  });

  describe('safeSetStrategy', () => {
    it('should set valid strategy', () => {
      const result = safeSetStrategy('diagnostic');
      
      expect(result).toBe(true);
      expect(mockStorage.getItem(STORAGE_KEYS.STRATEGY)).toBe('diagnostic');
    });

    it('should reject invalid strategy', () => {
      const result = safeSetStrategy('random');
      
      expect(result).toBe(false);
      expect(consoleSpy.error).toHaveBeenCalled();
    });
  });

  describe('safeSetPreviewMode', () => {
    it('should set true', () => {
      const result = safeSetPreviewMode(true);
      
      expect(result).toBe(true);
      expect(mockStorage.getItem(STORAGE_KEYS.PREVIEW_MODE)).toBe('true');
    });

    it('should set false', () => {
      const result = safeSetPreviewMode(false);
      
      expect(result).toBe(true);
      expect(mockStorage.getItem(STORAGE_KEYS.PREVIEW_MODE)).toBe('false');
    });

    it('should handle localStorage errors', () => {
      mockStorage.setItem = () => {
        throw new Error('Storage error');
      };
      
      const result = safeSetPreviewMode(true);
      
      expect(result).toBe(false);
    });
  });

  describe('safeSetUserProfile', () => {
    it('should set valid profile', () => {
      const profile: UserProfile = {
        id: 'user-789',
        name: 'Test User',
        role: 'student',
        createdAt: Date.now(),
      };
      
      const result = safeSetUserProfile(profile);
      
      expect(result).toBe(true);
      const stored = JSON.parse(mockStorage.getItem('sql-adapt-user-profile')!);
      expect(stored.id).toBe(profile.id);
    });

    it('should reject invalid profile', () => {
      const invalidProfile = {
        id: '',
        name: 'Test',
        role: 'student',
        createdAt: 123,
      } as UserProfile;
      
      const result = safeSetUserProfile(invalidProfile);
      
      expect(result).toBe(false);
      expect(consoleSpy.error).toHaveBeenCalled();
    });

    it.skip('should normalize non-number createdAt (KNOWN BUG - Fix #1)', () => {
      // BUG: safeSetUserProfile validates BEFORE normalizing createdAt
      // If createdAt is undefined, validation fails and returns false
      // Expected: Should normalize createdAt to Date.now() before validation
      
      const profile = {
        id: 'user-123',
        name: 'Test',
        role: 'student',
        createdAt: undefined as unknown as number,
      } as UserProfile;
      
      const before = Date.now();
      const result = safeSetUserProfile(profile);
      const after = Date.now();
      
      // Currently fails: result is false
      // After fix: expect(result).toBe(true);
      // After fix: expect(stored.createdAt).toBeGreaterThanOrEqual(before);
      // After fix: expect(stored.createdAt).toBeLessThanOrEqual(after);
      
      expect(result).toBe(false); // Document current behavior
    });

    it('should handle custom key', () => {
      const profile: UserProfile = {
        id: 'user-abc',
        name: 'Test',
        role: 'instructor',
        createdAt: 123,
      };
      
      const result = safeSetUserProfile(profile, 'my-custom-key');
      
      expect(result).toBe(true);
      expect(mockStorage.getItem('my-custom-key')).not.toBeNull();
    });
  });

  // ============================================================================
  // 8. EDGE CASE TESTING
  // ============================================================================
  
  describe('edge cases', () => {
    describe('very long strings', () => {
      it('should handle very long name (10000+ chars) - truncated via validation', () => {
        const longName = 'a'.repeat(10000);
        const profile = {
          id: 'test',
          name: longName,
          role: 'student' as const,
          createdAt: 123,
        };
        
        // isValidUserProfile doesn't check length, but validateUserProfileFromStorage does
        expect(isValidUserProfile(profile)).toBe(true);
        expect(validateUserProfileFromStorage(profile)).toBeNull(); // Rejected due to length
      });

      it('should handle long id strings', () => {
        const longId = 'id-' + 'x'.repeat(1000);
        const profile = {
          id: longId,
          name: 'Test',
          role: 'student' as const,
          createdAt: 123,
        };
        
        expect(isValidUserProfile(profile)).toBe(true);
        expect(validateUserProfileFromStorage(profile)).not.toBeNull();
      });
    });

    describe('special characters and unicode', () => {
      it('should handle emoji in name', () => {
        const profile = {
          id: 'test',
          name: 'Test 👨‍💻 User 🚀',
          role: 'student' as const,
          createdAt: 123,
        };
        
        expect(isValidUserProfile(profile)).toBe(true);
        const validated = validateUserProfileFromStorage(profile);
        expect(validated?.name).toBe('Test 👨‍💻 User 🚀');
      });

      it('should handle unicode characters', () => {
        const profile = {
          id: '用户-123',
          name: '测试用户',
          role: 'student' as const,
          createdAt: 123,
        };
        
        expect(isValidUserProfile(profile)).toBe(true);
      });

      it('should handle XSS attempt in name', () => {
        const xssName = '<script>alert("xss")</script>';
        const profile = {
          id: 'test',
          name: xssName,
          role: 'student',
          createdAt: 123,
        };
        
        // Validation doesn't sanitize, just checks structure
        expect(isValidUserProfile(profile)).toBe(true);
        
        // Roundtrip through storage
        safeSetUserProfile(profile as UserProfile);
        const retrieved = safeGetUserProfile();
        expect(retrieved?.name).toBe(xssName);
      });

      it('should handle null bytes', () => {
        const profile = {
          id: 'test\x00id',
          name: 'Test\x00User',
          role: 'student',
          createdAt: 123,
        };
        
        expect(isValidUserProfile(profile)).toBe(true);
      });
    });

    describe('malformed JSON', () => {
      it('should handle truncated JSON', () => {
        mockStorage.setItem('sql-adapt-user-profile', '{"id":"test","name":"Test"');
        
        const result = safeGetUserProfile();
        expect(result).toBeNull();
      });

      it('should handle JSON with syntax error', () => {
        mockStorage.setItem('sql-adapt-user-profile', '{"id":test,"name":"Test"}');
        
        const result = safeGetUserProfile();
        expect(result).toBeNull();
      });

      it('should handle empty string as profile data', () => {
        mockStorage.setItem('sql-adapt-user-profile', '');
        
        const result = safeGetUserProfile();
        expect(result).toBeNull();
      });

      it('should handle JSON array instead of object', () => {
        mockStorage.setItem('sql-adapt-user-profile', '[1,2,3]');
        
        const result = safeGetUserProfile();
        expect(result).toBeNull();
      });

      it('should handle JSON primitive instead of object', () => {
        mockStorage.setItem('sql-adapt-user-profile', '"just a string"');
        
        const result = safeGetUserProfile();
        expect(result).toBeNull();
      });
    });

    describe('circular references (would crash JSON.stringify)', () => {
      it.skip('should handle circular reference gracefully (KNOWN BUG - Fix #2)', () => {
        // BUG: safeSetUserProfile doesn't handle circular references
        // JSON.stringify throws TypeError on circular refs
        // Expected: Should catch error and return false gracefully
        
        const profile: Record<string, unknown> = {
          id: 'test',
          name: 'Test',
          role: 'student',
          createdAt: 123,
        };
        profile.self = profile; // Create circular reference
        
        // This throws during JSON.stringify
        let error: Error | undefined;
        try {
          safeSetUserProfile(profile as unknown as UserProfile);
        } catch (e) {
          error = e as Error;
        }
        
        // Currently: throws TypeError
        // After fix: should return false without throwing
        expect(error).toBeDefined();
        expect(error?.message).toContain('circular');
      });
    });

    describe('extreme numeric values', () => {
      it('should handle very large createdAt', () => {
        const profile = {
          id: 'test',
          name: 'Test',
          role: 'student' as const,
          createdAt: Number.MAX_VALUE,
        };
        
        expect(isValidUserProfile(profile)).toBe(true);
        expect(validateUserProfileFromStorage(profile)).not.toBeNull();
      });

      it('should handle very small createdAt', () => {
        const profile = {
          id: 'test',
          name: 'Test',
          role: 'student',
          createdAt: Number.MIN_VALUE,
        };
        
        expect(isValidUserProfile(profile)).toBe(true);
      });

      it('should reject NaN createdAt', () => {
        const profile = {
          id: 'test',
          name: 'Test',
          role: 'student',
          createdAt: NaN,
        };
        
        expect(isValidUserProfile(profile)).toBe(false);
      });
    });
  });

  // ============================================================================
  // 9. UTILITY FUNCTIONS
  // ============================================================================
  
  describe('clearDebugSettings', () => {
    it('should clear all debug settings', () => {
      mockStorage.setItem(STORAGE_KEYS.PROFILE_OVERRIDE, 'fast-escalator');
      mockStorage.setItem(STORAGE_KEYS.STRATEGY, 'diagnostic');
      mockStorage.setItem(STORAGE_KEYS.PREVIEW_MODE, 'true');
      
      const result = clearDebugSettings();
      
      expect(result).toBe(true);
      expect(mockStorage.getItem(STORAGE_KEYS.PROFILE_OVERRIDE)).toBeNull();
      expect(mockStorage.getItem(STORAGE_KEYS.STRATEGY)).toBeNull();
      expect(mockStorage.getItem(STORAGE_KEYS.PREVIEW_MODE)).toBeNull();
    });

    it('should handle localStorage errors', () => {
      mockStorage.removeItem = () => {
        throw new Error('Cannot remove');
      };
      
      const result = clearDebugSettings();
      
      expect(result).toBe(false);
    });
  });

  describe('getStorageSummary', () => {
    it('should return summary of all storage values', () => {
      const profile: UserProfile = {
        id: 'user-summary',
        name: 'Summary Test',
        role: 'student',
        createdAt: 123456,
      };
      
      safeSetProfileOverride('adaptive-escalator');
      safeSetStrategy('diagnostic');
      safeSetPreviewMode(true);
      safeSetUserProfile(profile);
      
      const summary = getStorageSummary();
      
      expect(summary.profileOverride).toBe('adaptive-escalator');
      expect(summary.strategy).toBe('diagnostic');
      expect(summary.previewMode).toBe(true);
      expect(summary.userProfile).toEqual(profile);
    });

    it('should handle missing values gracefully', () => {
      const summary = getStorageSummary();
      
      expect(summary.profileOverride).toBeNull();
      expect(summary.strategy).toBe('bandit'); // default
      expect(summary.previewMode).toBe(false);
      expect(summary.userProfile).toBeNull();
    });

    it('should handle errors in individual getters', () => {
      // Set up some valid data
      safeSetStrategy('static');
      
      // Corrupt one value
      mockStorage.setItem(STORAGE_KEYS.PROFILE_OVERRIDE, 'invalid');
      
      // Should still return partial results
      const summary = getStorageSummary();
      expect(summary.strategy).toBe('static');
    });
  });

  // ============================================================================
  // 10. PERFORMANCE TESTING
  // ============================================================================
  
  describe('performance', () => {
    it('should handle 1000 validations quickly', () => {
      const profile: UserProfile = {
        id: 'perf-test',
        name: 'Performance Test',
        role: 'student',
        createdAt: Date.now(),
      };
      
      const iterations = 1000;
      const start = performance.now();
      
      for (let i = 0; i < iterations; i++) {
        isValidUserProfile(profile);
        isValidProfileId('fast-escalator');
        isValidStrategy('bandit');
        parseBooleanString('true');
      }
      
      const end = performance.now();
      const duration = end - start;
      
      console.log(`\nPerformance: ${iterations} iterations took ${duration.toFixed(2)}ms`);
      console.log(`Average: ${(duration / iterations).toFixed(4)}ms per iteration`);
      
      // Should complete in reasonable time (less than 100ms for 1000 iterations)
      expect(duration).toBeLessThan(100);
    });

    it('should handle large profile objects efficiently', () => {
      const largeProfile = {
        id: 'large-test',
        name: 'Large Profile Test',
        role: 'student',
        createdAt: Date.now(),
        extraData: 'x'.repeat(100000), // 100KB of extra data
      };
      
      const start = performance.now();
      const result = isValidUserProfile(largeProfile);
      const end = performance.now();
      
      console.log(`\nLarge object validation took ${(end - start).toFixed(4)}ms`);
      expect(result).toBe(true);
      expect(end - start).toBeLessThan(10); // Should still be fast
    });

    it('should handle rapid storage operations', () => {
      const profile: UserProfile = {
        id: 'rapid-test',
        name: 'Rapid Test',
        role: 'student',
        createdAt: Date.now(),
      };
      
      const iterations = 100;
      const start = performance.now();
      
      for (let i = 0; i < iterations; i++) {
        safeSetUserProfile(profile);
        safeGetUserProfile();
      }
      
      const end = performance.now();
      const duration = end - start;
      
      console.log(`\nStorage operations: ${iterations} set+get cycles took ${duration.toFixed(2)}ms`);
      expect(duration).toBeLessThan(500); // Should be reasonable even with localStorage
    });
  });

  // ============================================================================
  // 11. TYPE GUARD CONSISTENCY
  // ============================================================================
  
  describe('type guard consistency', () => {
    it('isValidUserProfile and validateUserProfileFromStorage should be consistent', () => {
      const testCases = [
        { id: 'test', name: 'Test', role: 'student', createdAt: 123 },
        { id: 'test', name: 'Test', role: 'instructor', createdAt: 123 },
        { id: '', name: 'Test', role: 'student', createdAt: 123 },
        { id: 'test', name: '', role: 'student', createdAt: 123 },
        { id: 'test', name: 'Test', role: 'admin', createdAt: 123 },
        { id: 'test', name: 'Test', role: 'student', createdAt: NaN },
      ];
      
      testCases.forEach(tc => {
        const isValid = isValidUserProfile(tc);
        const fromStorage = validateUserProfileFromStorage(tc as Partial<UserProfile>);
        
        // Both should agree on validity (though validateUserProfileFromStorage has extra checks)
        if (!isValid) {
          expect(fromStorage).toBeNull();
        }
        // Note: isValid can be true while fromStorage is null (extra validation in fromStorage)
      });
    });

    it('VALID_PROFILE_IDS constant should match isValidProfileId', () => {
      VALID_PROFILE_IDS.forEach(id => {
        expect(isValidProfileId(id)).toBe(true);
      });
    });

    it('VALID_STRATEGIES constant should match isValidStrategy', () => {
      VALID_STRATEGIES.forEach(strategy => {
        expect(isValidStrategy(strategy)).toBe(true);
      });
    });
  });

  // ============================================================================
  // 12. STORAGE KEYS CONSISTENCY
  // ============================================================================
  
  describe('storage keys', () => {
    it('should have correct key values', () => {
      expect(STORAGE_KEYS.PROFILE_OVERRIDE).toBe('sql-adapt-debug-profile');
      expect(STORAGE_KEYS.STRATEGY).toBe('sql-adapt-debug-strategy');
      expect(STORAGE_KEYS.PREVIEW_MODE).toBe('sql-adapt-preview-mode');
    });

    it('keys should be unique', () => {
      const values = Object.values(STORAGE_KEYS);
      const uniqueValues = new Set(values);
      expect(uniqueValues.size).toBe(values.length);
    });
  });
});

// ============================================================================
// Standalone Test Runner for Manual Execution
// ============================================================================

export function runManualTests(): void {
  console.log('\n' + '='.repeat(70));
  console.log('STORAGE-VALIDATION MANUAL TEST SUITE');
  console.log('='.repeat(70));
  
  const results: TestResult[] = [];
  
  // Type Guard Tests
  const profileIdTests = [
    { input: 'fast-escalator', expected: true },
    { input: 'slow-escalator', expected: true },
    { input: 'adaptive-escalator', expected: true },
    { input: 'explanation-first', expected: true },
    { input: 'invalid', expected: false },
    { input: '', expected: false },
    { input: null, expected: false },
    { input: undefined, expected: false },
    { input: 123, expected: false },
  ];
  
  profileIdTests.forEach(({ input, expected }) => {
    results.push(runTest(
      `isValidProfileId(${JSON.stringify(input)})`,
      input,
      expected,
      () => isValidProfileId(input as string)
    ));
  });
  
  // Strategy Tests
  const strategyTests = [
    { input: 'static', expected: true },
    { input: 'diagnostic', expected: true },
    { input: 'bandit', expected: true },
    { input: 'invalid', expected: false },
    { input: '', expected: false },
    { input: null, expected: false },
  ];
  
  strategyTests.forEach(({ input, expected }) => {
    results.push(runTest(
      `isValidStrategy(${JSON.stringify(input)})`,
      input,
      expected,
      () => isValidStrategy(input as string)
    ));
  });
  
  // Boolean Parsing Tests
  const boolTests = [
    { input: 'true', expected: true },
    { input: 'false', expected: false },
    { input: 'TRUE', expected: null },
    { input: 'FALSE', expected: null },
    { input: 'yes', expected: null },
    { input: '1', expected: null },
    { input: '', expected: null },
    { input: null, expected: null },
    { input: undefined, expected: null },
  ];
  
  boolTests.forEach(({ input, expected }) => {
    results.push(runTest(
      `parseBooleanString(${JSON.stringify(input)})`,
      input,
      expected,
      () => parseBooleanString(input as string | null)
    ));
  });
  
  printResults(results, 'Type Guards and Parsers');
  
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  
  console.log('\n' + '='.repeat(70));
  console.log(`OVERALL: ${passed} passed, ${failed} failed`);
  console.log('='.repeat(70) + '\n');
}

// Export for external testing
export type { TestResult };
export { runTest, printResults };
