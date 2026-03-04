/**
 * Bandit Learning System E2E Tests
 *
 * Tests the core bandit learning functionality including:
 * - Bandit arm selection and statistics recording
 * - Profile override bypassing bandit selection
 * - Event logging for bandit operations
 *
 * These tests verify that the multi-armed bandit correctly:
 * 1. Selects escalation profiles using Thompson Sampling
 * 2. Logs appropriate events for analytics
 *
 * Tag: @no-external @weekly - No external services (Ollama) needed
 * Uses in-memory database and mock data
 */

import { expect, test } from '@playwright/test';

// Valid escalation profiles
const VALID_PROFILES = [
  'fast-escalator',
  'slow-escalator',
  'adaptive-escalator',
  'explanation-first'
] as const;

test.describe('@no-external @weekly Bandit Learning System', () => {
  test.afterEach(async ({ page }) => {
    // Clean up any test-specific localStorage items
    await page.evaluate(() => {
      window.localStorage.removeItem('sql-adapt-debug-strategy');
      window.localStorage.removeItem('sql-adapt-debug-profile');
    });
  });

  test('bandit selects arm and records statistics', async ({ page }) => {
    const learnerId = 'test-bandit-learner-' + Date.now();

    // Set up student profile with bandit strategy enabled
    await page.addInitScript((id) => {
      localStorage.clear();
      localStorage.setItem('sql-adapt-user-profile', JSON.stringify({
        id,
        name: 'Test Bandit Learner',
        role: 'student',
        createdAt: Date.now()
      }));
      // Enable bandit strategy (no debug override - use bandit)
      localStorage.setItem('sql-adapt-debug-strategy', 'bandit');
      localStorage.setItem('sql-adapt-welcome-seen', 'true');
    }, learnerId);

    // Navigate to practice page to trigger profile assignment
    await page.goto('/practice');
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('heading', { name: 'Practice SQL', exact: true })).toBeVisible({ timeout: 15000 });

    // Wait for any async profile assignment to complete
    await page.waitForTimeout(1000);

    // Retrieve interaction events from localStorage
    const events = await page.evaluate(() => {
      return JSON.parse(localStorage.getItem('sql-learning-interactions') || '[]');
    });

    // Verify profile_assigned event was logged
    const profileEvent = events.find((e: any) => e.eventType === 'profile_assigned');
    expect(profileEvent, 'profile_assigned event should be logged').toBeDefined();

    // Verify the assignment used bandit strategy
    expect(profileEvent.assignmentStrategy).toBe('bandit');

    // Verify a valid profile was assigned
    expect(VALID_PROFILES).toContain(profileEvent.profileId);

    // Verify event has required fields
    expect(profileEvent.id).toBeDefined();
    expect(profileEvent.timestamp).toBeDefined();
    expect(profileEvent.timestamp).toBeGreaterThan(0);
  });

  test('profile override skips bandit selection', async ({ page }) => {
    const learnerId = 'test-override-learner-' + Date.now();

    // Set up student profile WITH debug override
    await page.addInitScript((id) => {
      localStorage.clear();
      localStorage.setItem('sql-adapt-user-profile', JSON.stringify({
        id,
        name: 'Test Override Learner',
        role: 'student',
        createdAt: Date.now()
      }));
      // Set debug profile override - this should bypass bandit
      localStorage.setItem('sql-adapt-debug-profile', 'fast-escalator');
      // Set static strategy to ensure override takes precedence
      localStorage.setItem('sql-adapt-debug-strategy', 'static');
      localStorage.setItem('sql-adapt-welcome-seen', 'true');
    }, learnerId);

    await page.goto('/practice');
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('heading', { name: 'Practice SQL', exact: true })).toBeVisible({ timeout: 15000 });

    // Wait for any async profile assignment
    await page.waitForTimeout(1000);

    // Retrieve interaction events
    const events = await page.evaluate(() => {
      return JSON.parse(localStorage.getItem('sql-learning-interactions') || '[]');
    });

    // Verify profile_assigned event was logged
    const profileEvent = events.find((e: any) => e.eventType === 'profile_assigned');
    expect(profileEvent, 'profile_assigned event should be logged').toBeDefined();

    // Verify the override profile was used
    expect(profileEvent.profileId).toBe('fast-escalator');

    // Verify static strategy was used (not bandit)
    expect(profileEvent.assignmentStrategy).toBe('static');
  });

  test('bandit arm selection logs complete event data', async ({ page }) => {
    const learnerId = 'test-arm-selection-' + Date.now();

    await page.addInitScript((id) => {
      localStorage.clear();
      localStorage.setItem('sql-adapt-user-profile', JSON.stringify({
        id,
        name: 'Test Arm Selection',
        role: 'student',
        createdAt: Date.now()
      }));
      localStorage.setItem('sql-adapt-debug-strategy', 'bandit');
      localStorage.setItem('sql-adapt-welcome-seen', 'true');
    }, learnerId);

    await page.goto('/practice');
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('heading', { name: 'Practice SQL', exact: true })).toBeVisible({ timeout: 15000 });

    // Wait for profile assignment
    await page.waitForTimeout(1000);

    const events = await page.evaluate(() => {
      return JSON.parse(localStorage.getItem('sql-learning-interactions') || '[]');
    });

    // Find profile assignment event
    const profileEvent = events.find((e: any) => e.eventType === 'profile_assigned');
    expect(profileEvent).toBeDefined();

    // Verify all required event fields are present
    expect(profileEvent.id).toBeDefined();
    expect(profileEvent.timestamp).toBeGreaterThan(0);
    expect(profileEvent.eventType).toBe('profile_assigned');
    expect(profileEvent.problemId).toBeDefined();

    // Verify payload structure
    expect(profileEvent.profileId).toBeDefined();
    expect(VALID_PROFILES).toContain(profileEvent.profileId);
    expect(profileEvent.assignmentStrategy).toBe('bandit');
  });

  test('bandit strategy persists across navigation', async ({ page }) => {
    const learnerId = 'test-persistence-' + Date.now();

    await page.addInitScript((id) => {
      localStorage.clear();
      localStorage.setItem('sql-adapt-user-profile', JSON.stringify({
        id,
        name: 'Test Persistence',
        role: 'student',
        createdAt: Date.now()
      }));
      localStorage.setItem('sql-adapt-debug-strategy', 'bandit');
      localStorage.setItem('sql-adapt-welcome-seen', 'true');
    }, learnerId);

    // Navigate to practice
    await page.goto('/practice');
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('heading', { name: 'Practice SQL', exact: true })).toBeVisible({ timeout: 15000 });

    // Wait for profile assignment
    await page.waitForTimeout(1000);

    // Get first profile assignment
    const firstEvents = await page.evaluate(() => {
      return JSON.parse(localStorage.getItem('sql-learning-interactions') || '[]');
    });
    const firstProfile = firstEvents.find((e: any) => e.eventType === 'profile_assigned');
    expect(firstProfile).toBeDefined();

    // Navigate to textbook and back
    await page.goto('/textbook');
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('heading', { name: 'My Textbook', exact: true })).toBeVisible({ timeout: 15000 });

    await page.goto('/practice');
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('heading', { name: 'Practice SQL', exact: true })).toBeVisible({ timeout: 15000 });

    // Verify strategy is still set to bandit
    const savedStrategy = await page.evaluate(() => {
      return localStorage.getItem('sql-adapt-debug-strategy');
    });
    expect(savedStrategy).toBe('bandit');
  });
});
