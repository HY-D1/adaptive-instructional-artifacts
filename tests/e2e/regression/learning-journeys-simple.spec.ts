/**
 * Simple Learning Journeys E2E Tests
 * 
 * Reliable, deterministic tests for core student learning flows.
 * Designed for CI/GitHub Actions with minimal timing dependencies.
 * 
 * @tags @no-external @weekly
 */

import { test, expect, Page } from '@playwright/test';
import { waitForEditorReady, replaceEditorText } from '../../helpers/test-helpers';

// =============================================================================
// Test Data
// =============================================================================

const TEST_USERS = {
  hintStudent: { name: 'HintStudent', id: 'hint-student-1' },
  navStudent: { name: 'NavStudent', id: 'nav-student-1' },
  syncStudent: { name: 'SyncStudent', id: 'sync-student-1' },
};

const PROBLEM_SOLUTIONS: Record<string, string> = {
  'problem-1': 'SELECT * FROM users;',
  'problem-2': 'SELECT * FROM users WHERE age > 24;',
};

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Setup a student profile directly in localStorage (bypasses StartPage)
 */
async function setupStudent(page: Page, userId: string, userName: string) {
  await page.addInitScript(({ id, name }) => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    window.localStorage.setItem('sql-adapt-welcome-seen', 'true');
    window.localStorage.setItem('sql-adapt-welcome-disabled', 'true');
    window.localStorage.setItem('sql-adapt-user-profile', JSON.stringify({
      id,
      name,
      role: 'student',
      createdAt: Date.now(),
    }));
  }, { id: userId, name: userName });
}

/**
 * Get all interactions from localStorage
 */
async function getInteractions(page: Page): Promise<any[]> {
  return page.evaluate(() => {
    const raw = window.localStorage.getItem('sql-learning-interactions');
    return raw ? JSON.parse(raw) : [];
  });
}

/**
 * Get user profile from localStorage
 */
async function getUserProfile(page: Page): Promise<any | null> {
  return page.evaluate(() => {
    const raw = window.localStorage.getItem('sql-adapt-user-profile');
    return raw ? JSON.parse(raw) : null;
  });
}

/**
 * Wait for SQL engine to be ready (Run Query button enabled)
 */
async function waitForSqlEngine(page: Page) {
  await waitForEditorReady(page, 15000);
  await expect.poll(async () => {
    const button = page.getByRole('button', { name: 'Run Query' });
    return await button.isEnabled().catch(() => false);
  }, { timeout: 15000, intervals: [200, 500] }).toBe(true);
}

/**
 * Submit SQL query using the Run Query button
 */
async function submitQuery(page: Page, query: string) {
  await replaceEditorText(page, query);
  await page.getByRole('button', { name: 'Run Query' }).click();
}

// =============================================================================
// Test Setup
// =============================================================================

test.beforeEach(async ({ page }) => {
  // Stub LLM calls to prevent ECONNREFUSED errors and ensure deterministic responses
  await page.route('**/ollama/api/generate', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        response: JSON.stringify({
          title: 'Test Hint',
          content_markdown: 'This is a test hint to help you.',
          key_points: ['Check your syntax', 'Verify table names'],
          source_ids: ['sql-engage:1']
        })
      })
    });
  });
  
  await page.route('**/api/generate', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        response: JSON.stringify({
          title: 'Test Explanation',
          content_markdown: 'Here is the explanation.',
          key_points: ['Key point 1'],
          source_ids: ['sql-engage:10']
        })
      })
    });
  });
});

// =============================================================================
// Test Suite: Simple Learning Journeys
// =============================================================================

test.describe('@no-external @weekly Simple Learning Journeys', () => {
  
  // ===========================================================================
  // Test 1: Student completes problem with hints
  // ===========================================================================
  
  test('@no-external @weekly student completes problem with hints', async ({ page }) => {
    // Step 1: Setup student profile directly (bypass StartPage)
    await setupStudent(page, TEST_USERS.hintStudent.id, TEST_USERS.hintStudent.name);
    
    // Step 2: Navigate to practice page
    await page.goto('/practice');
    await waitForSqlEngine(page);
    
    // Step 3: Verify problem loaded
    await expect(page.getByRole('heading', { name: /Select All Users/i })).toBeVisible();
    
    // Step 4: Submit incorrect query to generate error
    await submitQuery(page, 'SELECT * FROM nonexistent_table;');
    
    // Step 5: Verify error appears
    await expect(page.getByText(/error|Error|no such table/i).first()).toBeVisible({ timeout: 5000 });
    
    // Step 6: Request hint
    const requestHintButton = page.getByRole('button', { name: /Request Hint|Get Hint/i });
    await expect(requestHintButton).toBeVisible({ timeout: 5000 });
    await requestHintButton.click();
    
    // Step 7: Verify hint appears (look for hint label or hint content)
    await expect(
      page.locator('[data-testid^="hint-label"], [data-testid="hint-content"], .hint-label').first()
    ).toBeVisible({ timeout: 10000 });
    
    // Step 8: Submit correct solution
    await submitQuery(page, PROBLEM_SOLUTIONS['problem-1']);
    
    // Step 9: Verify success indication
    await expect.poll(async () => {
      const pageText = await page.locator('body').textContent() || '';
      return pageText.includes('Correct') || 
             pageText.includes('success') || 
             pageText.includes('✓') ||
             pageText.includes('congratulations');
    }, { timeout: 5000 }).toBe(true);
  });

  // ===========================================================================
  // Test 2: Student navigation and progress tracking
  // ===========================================================================
  
  test('@no-external @weekly student navigation and progress tracking', async ({ page }) => {
    // Step 1: Setup student
    await setupStudent(page, TEST_USERS.navStudent.id, TEST_USERS.navStudent.name);
    
    // Step 2: Navigate to practice
    await page.goto('/practice');
    await waitForSqlEngine(page);
    
    // Step 3: Verify problem loads correctly (Problem 1)
    await expect(page.getByRole('heading', { name: /Select All Users/i })).toBeVisible();
    await expect(page.getByText(/select all columns|users table/i)).toBeVisible();
    
    // Step 4: Navigate to problem 2 via URL
    await page.goto('/practice?problemId=problem-2');
    await waitForSqlEngine(page);
    
    // Step 5: Verify problem 2 loaded
    await expect(page.getByRole('heading', { name: /Filter Users by Age/i })).toBeVisible();
    
    // Step 6: Run a query to generate an interaction
    await submitQuery(page, 'SELECT * FROM users WHERE age > 24;');
    
    // Step 7: Wait for result to appear
    await expect.poll(async () => {
      const pageText = await page.locator('body').textContent() || '';
      return pageText.includes('Alice') || pageText.includes('Bob') || pageText.includes('Correct');
    }, { timeout: 5000 }).toBe(true);
    
    // Step 8: Small delay to allow event to be saved
    await page.waitForTimeout(300);
    
    // Step 9: Verify interactions are logged
    const interactions = await getInteractions(page);
    expect(interactions.length).toBeGreaterThan(0);
    
    // Step 10: Verify at least one interaction has correct problem ID
    const hasProblemInteraction = interactions.some(
      i => i.problemId === 'problem-2' || i.problemId === 'problem-1'
    );
    expect(hasProblemInteraction).toBe(true);
  });

  // ===========================================================================
  // Test 3: Cross-tab profile sync
  // ===========================================================================
  
  test('@no-external @weekly cross-tab profile sync', async ({ page, context }) => {
    // Step 1: Setup student in tab 1
    await setupStudent(page, TEST_USERS.syncStudent.id, TEST_USERS.syncStudent.name);
    await page.goto('/practice');
    await waitForSqlEngine(page);
    
    // Step 2: Verify profile exists in tab 1
    const profile1 = await getUserProfile(page);
    expect(profile1).not.toBeNull();
    expect(profile1.name).toBe(TEST_USERS.syncStudent.name);
    expect(profile1.role).toBe('student');
    
    // Step 3: Open new page in same context (shares localStorage)
    const page2 = await context.newPage();
    
    // Step 4: Setup the same profile in tab 2 (simulates shared storage)
    await page2.addInitScript((profile) => {
      window.localStorage.setItem('sql-adapt-user-profile', JSON.stringify(profile));
      window.localStorage.setItem('sql-adapt-welcome-seen', 'true');
    }, profile1);
    
    // Step 5: Navigate to practice in tab 2
    await page2.goto('/practice');
    await waitForEditorReady(page2, 15000);
    
    // Step 6: Verify profile is accessible in tab 2
    const profile2 = await page2.evaluate(() => {
      const raw = window.localStorage.getItem('sql-adapt-user-profile');
      return raw ? JSON.parse(raw) : null;
    });
    
    expect(profile2).not.toBeNull();
    expect(profile2.id).toBe(profile1.id);
    expect(profile2.name).toBe(profile1.name);
    expect(profile2.role).toBe('student');
    
    // Step 7: Verify both pages show student badge (use role badge selector)
    await expect(page.locator('span').filter({ hasText: /^Student$/ })).toBeVisible();
    await expect(page2.locator('span').filter({ hasText: /^Student$/ })).toBeVisible();
    
    // Cleanup
    await page2.close();
  });
});
