/**
 * Vitest Test Setup
 *
 * Provides global mocks and setup for unit tests.
 * This file runs before each test file.
 */
import { vi } from 'vitest';

// Create a proper localStorage mock for jsdom environment
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string): string | null => store[key] ?? null,
    setItem: (key: string, value: string): void => {
      store[key] = String(value);
    },
    removeItem: (key: string): void => {
      delete store[key];
    },
    clear: (): void => {
      store = {};
    },
    key: (index: number): string | null => Object.keys(store)[index] ?? null,
    get length() {
      return Object.keys(store).length;
    }
  };
})();

// Apply the mock to global
Object.defineProperty(global, 'localStorage', {
  value: localStorageMock,
  writable: true,
  configurable: true
});

// Also mock sessionStorage for consistency
const sessionStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string): string | null => store[key] ?? null,
    setItem: (key: string, value: string): void => {
      store[key] = String(value);
    },
    removeItem: (key: string): void => {
      delete store[key];
    },
    clear: (): void => {
      store = {};
    },
    key: (index: number): string | null => Object.keys(store)[index] ?? null,
    get length() {
      return Object.keys(store).length;
    }
  };
})();

Object.defineProperty(global, 'sessionStorage', {
  value: sessionStorageMock,
  writable: true,
  configurable: true
});

// Clear storage before each test
beforeEach(() => {
  localStorageMock.clear();
  sessionStorageMock.clear();
});
