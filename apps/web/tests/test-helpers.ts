/**
 * Shared test helpers for Playwright E2E tests
 * 
 * This file contains common helper functions used across multiple test files
 * to reduce code duplication and improve maintainability.
 */

import { expect, Locator, Page } from '@playwright/test';

// =============================================================================
// Editor Helpers
// =============================================================================

/**
 * Replace text in the Monaco editor with new content
 */
export async function replaceEditorText(page: Page, text: string) {
  const editorSurface = page.locator('.monaco-editor .view-lines').first();
  await editorSurface.click({ position: { x: 8, y: 8 } });
  await page.keyboard.press(process.platform === 'darwin' ? 'Meta+A' : 'Control+A');
  await page.keyboard.type(text);
}

/**
 * Get current text from the Monaco editor
 */
export async function getEditorText(page: Page): Promise<string> {
  return page.locator('.monaco-editor .view-lines').first().innerText();
}

// =============================================================================
// Interaction Helpers
// =============================================================================

/**
 * Run queries until the error count reaches the expected value
 */
export async function runUntilErrorCount(page: Page, runQueryButton: Locator, expectedErrorCount: number) {
  const marker = page.getByText(new RegExp(`\\b${expectedErrorCount}\\s+error(s)?\\b`, 'i'));
  for (let i = 0; i < 12; i += 1) {
    await runQueryButton.click();
    // Use expect.poll for reliable waiting instead of fixed timeout
    try {
      await expect.poll(async () => {
        return await marker.first().isVisible().catch(() => false);
      }, { timeout: 2000, intervals: [100] }).toBe(true);
      return;
    } catch {
      // Continue trying
    }
  }
  throw new Error(`Expected error count to reach ${expectedErrorCount}, but it did not.`);
}

// =============================================================================
// Storage Helpers
// =============================================================================

/**
 * Get all interactions from localStorage
 */
export async function getAllInteractionsFromStorage(page: Page): Promise<any[]> {
  return page.evaluate(() => {
    const raw = window.localStorage.getItem('sql-learning-interactions');
    return raw ? JSON.parse(raw) : [];
  });
}

/**
 * Get hint events from localStorage
 */
export async function getHintEventsFromStorage(page: Page): Promise<any[]> {
  const interactions = await getAllInteractionsFromStorage(page);
  return interactions.filter((i: any) => i.eventType === 'hint_view');
}

/**
 * Get explanation events from localStorage
 */
export async function getExplanationEventsFromStorage(page: Page): Promise<any[]> {
  const interactions = await getAllInteractionsFromStorage(page);
  return interactions.filter((i: any) => i.eventType === 'explanation_view');
}

/**
 * Get coverage change events from localStorage
 */
export async function getCoverageEventsFromStorage(page: Page): Promise<any[]> {
  const interactions = await getAllInteractionsFromStorage(page);
  return interactions.filter((i: any) => i.eventType === 'coverage_change');
}

/**
 * Get the active session ID from localStorage
 */
export async function getActiveSessionId(page: Page): Promise<string | null> {
  return page.evaluate(() => {
    return window.localStorage.getItem('sql-learning-active-session');
  });
}

/**
 * Get learner profile from localStorage
 */
export async function getProfileFromStorage(page: Page, learnerId: string): Promise<any | null> {
  return page.evaluate((id) => {
    const raw = window.localStorage.getItem('sql-learning-profiles');
    if (!raw) return null;
    const profiles = JSON.parse(raw);
    return profiles.find((p: any) => p.id === id) || null;
  }, learnerId);
}

/**
 * Get textbook units for a learner from localStorage
 */
export async function getTextbookUnits(page: Page, learnerId: string): Promise<any[]> {
  return page.evaluate((id) => {
    const raw = window.localStorage.getItem('sql-learning-textbook');
    if (!raw) return [];
    const textbooks = JSON.parse(raw);
    return textbooks[id] || [];
  }, learnerId);
}

// =============================================================================
// Setup Helpers
// =============================================================================

/**
 * Seed a valid learner profile in localStorage
 */
export async function seedValidProfile(page: Page, learnerId: string) {
  await page.evaluate((id) => {
    const profile = {
      id,
      name: `Learner ${id}`,
      conceptsCovered: [],
      conceptCoverageEvidence: [],
      errorHistory: [],
      interactionCount: 0,
      version: 1,
      currentStrategy: 'adaptive-medium',
      preferences: {
        escalationThreshold: 3,
        aggregationDelay: 300000
      }
    };
    window.localStorage.setItem('sql-learning-profiles', JSON.stringify([profile]));
  }, learnerId);
}

/**
 * Common test setup - clears storage and sets welcome flag
 */
export async function setupTest(page: Page) {
  await page.addInitScript(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    window.localStorage.setItem('sql-adapt-welcome-seen', 'true');
  });
}

// =============================================================================
// StartPage Flow Helpers
// =============================================================================

/**
 * Complete the StartPage authentication flow for tests
 * - Waits for StartPage heading
 * - Enters username
 * - Selects Student role
 * - Clicks Get Started
 * - Waits for navigation to complete
 * 
 * Use this helper when tests need to authenticate via StartPage before
 * accessing protected routes. For tests that bypass auth (seeded storage),
 * this is not needed.
 */
export async function completeStartPageFlow(page: Page, username: string = 'TestStudent') {
  // Wait for StartPage heading
  await expect(page.getByRole('heading', { name: 'SQL-Adapt Learning System' })).toBeVisible({ timeout: 10000 });
  
  // Enter username
  await page.getByPlaceholder('Enter your username').fill(username);
  
  // Select Student role
  const studentCard = page.locator('.cursor-pointer').filter({ hasText: 'Student' });
  await studentCard.click();
  
  // Click Get Started
  await page.getByRole('button', { name: 'Get Started' }).click();
  
  // Wait for navigation to complete (redirects to /practice for students)
  await expect(page).toHaveURL(/\/(practice)?$/, { timeout: 15000 });
  await page.waitForLoadState('domcontentloaded');
}
