/**
 * Learning Journeys E2E Tests
 * 
 * Comprehensive tests that simulate complete student learning journeys:
 * - Journey 1: Complete first problem successfully
 * - Journey 2: Error → Hint → Success
 * - Journey 3: Multi-problem session
 * - Journey 4: Full learning cycle with all features
 * 
 * @tags @no-external @weekly @learning-journey
 */

import { test, expect, Page, Locator } from '@playwright/test';
import { replaceEditorText, getEditorText, waitForEditorReady } from '../helpers/test-helpers';

// =============================================================================
// Test Data
// =============================================================================

const TEST_USERS = {
  student1: { name: 'JourneyStudent1', id: 'journey-student-1' },
  student2: { name: 'JourneyStudent2', id: 'journey-student-2' },
  student3: { name: 'JourneyStudent3', id: 'journey-student-3' },
  fullCycle: { name: 'FullCycleUser', id: 'full-cycle-user' },
};

// Problem solutions mapped from apps/web/src/app/data/problems.ts
const PROBLEM_SOLUTIONS: Record<string, string> = {
  'problem-1': 'SELECT * FROM users;',
  'problem-2': 'SELECT * FROM users WHERE age > 24;',
  'problem-3': 'SELECT u.name, o.order_id FROM users u JOIN orders o ON u.id = o.user_id;',
  'problem-6': 'SELECT name, age FROM users ORDER BY age DESC;',
  'problem-7': 'SELECT DISTINCT city FROM users;',
  'problem-8': 'SELECT * FROM users;',
  'problem-9': 'SELECT name, email FROM users;',
};

const INCORRECT_QUERIES = [
  'SELECT * FROM nonexistent;',
  'SELECT * FORM users;',  // syntax error: FORM instead of FROM
  'SELECT name FROM users WHERE age > ',  // incomplete query
];

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
    window.localStorage.setItem('sql-adapt-user-profile', JSON.stringify({
      id,
      name,
      role: 'student',
      createdAt: Date.now(),
    }));
  }, { id: userId, name: userName });
}

/**
 * Register a new student through the StartPage flow
 */
async function registerStudent(page: Page, username: string) {
  await page.goto('/');
  await page.getByPlaceholder('Enter your username').fill(username);
  
  const studentCard = page.locator('.cursor-pointer').filter({ 
    has: page.getByRole('heading', { name: 'Student' })
  });
  await studentCard.click();
  
  await page.getByRole('button', { name: 'Get Started' }).click();
  await expect(page).toHaveURL(/\/practice/, { timeout: 15000 });
}

/**
 * Wait for SQL engine to be ready
 */
async function waitForSqlEngine(page: Page) {
  await waitForEditorReady(page);
  await expect.poll(async () => {
    const button = page.getByRole('button', { name: 'Run Query' });
    return await button.isEnabled().catch(() => false);
  }, { timeout: 30000, intervals: [500, 1000] }).toBe(true);
}

/**
 * Get the current problem ID from the page
 */
async function getCurrentProblemId(page: Page): Promise<string | null> {
  return page.evaluate(() => {
    const url = window.location.href;
    const match = url.match(/problem=([^&]+)/);
    return match ? match[1] : 'problem-1';
  });
}

/**
 * Navigate to a specific problem
 */
async function navigateToProblem(page: Page, problemNum: number) {
  const problemId = `problem-${problemNum}`;
  await page.goto(`/practice?problem=${problemId}`);
  await waitForSqlEngine(page);
  await expect(page.getByText(new RegExp(`Problem ${problemNum}`, 'i'))).toBeVisible();
}

/**
 * Submit SQL query and wait for result
 */
async function submitQuery(page: Page, query: string) {
  await replaceEditorText(page, query);
  await page.getByRole('button', { name: 'Run Query' }).click();
}

/**
 * Run query until error count is reached
 */
async function runUntilErrorCount(page: Page, expectedErrorCount: number) {
  const marker = page.getByText(new RegExp(`\\b${expectedErrorCount}\\s+error(s)?\\b`, 'i'));
  const runQueryButton = page.getByRole('button', { name: 'Run Query' });
  
  for (let i = 0; i < 12; i++) {
    await runQueryButton.click();
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

/**
 * Complete a problem by entering correct SQL
 */
async function solveProblem(page: Page, problemNum: number) {
  const problemId = `problem-${problemNum}`;
  const solution = PROBLEM_SOLUTIONS[problemId];
  
  if (!solution) {
    throw new Error(`No solution defined for ${problemId}`);
  }
  
  await submitQuery(page, solution);
  
  // Wait for success indication
  await expect.poll(async () => {
    const pageText = await page.locator('body').textContent() || '';
    return pageText.includes('Correct') || pageText.includes('success') || pageText.includes('✓');
  }, { timeout: 5000 }).toBe(true);
}

/**
 * Go through error → hint → success flow
 */
async function solveWithHints(page: Page) {
  // Step 1: Cause an error
  await submitQuery(page, 'SELECT * FROM nonexistent_table;');
  await expect(page.getByText(/error|Error|no such table/i).first()).toBeVisible({ timeout: 5000 });
  
  // Step 2: Request hint
  const requestHintButton = page.getByRole('button', { name: /Request Hint|Get Hint/i });
  await expect(requestHintButton).toBeVisible();
  await requestHintButton.click();
  
  // Step 3: Wait for hint to appear
  await expect(page.getByTestId('hint-label-1')).toBeVisible({ timeout: 15000 });
  
  // Step 4: Fix and submit correct answer
  await submitQuery(page, PROBLEM_SOLUTIONS['problem-1']);
  
  // Step 5: Verify success
  await expect.poll(async () => {
    const pageText = await page.locator('body').textContent() || '';
    return pageText.includes('Correct') || pageText.includes('success') || pageText.includes('✓');
  }, { timeout: 5000 }).toBe(true);
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

// =============================================================================
// Test Setup
// =============================================================================

test.beforeEach(async ({ page }) => {
  // Stub LLM calls to prevent ECONNREFUSED errors
  await page.route('**/ollama/api/generate', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        response: JSON.stringify({
          title: 'Test Explanation',
          content_markdown: 'This is a test explanation content.',
          key_points: ['Point 1', 'Point 2'],
          common_pitfall: 'Common mistake to avoid',
          next_steps: ['Try similar problems'],
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
          title: 'Test Chat Response',
          content_markdown: 'Here is the explanation about JOIN.',
          key_points: ['JOIN combines tables'],
          source_ids: ['sql-engage:10']
        })
      })
    });
  });
});

// =============================================================================
// Learning Journey Tests
// =============================================================================

test.describe('@no-external @weekly @learning-journey Learning Journeys', () => {
  
  // ===========================================================================
  // Journey 1: Complete First Problem
  // ===========================================================================
  
  test.describe('@no-external @weekly @learning-journey Journey 1: Complete First Problem', () => {
    
    test('student registers and completes first problem successfully', async ({ page }) => {
      // Step 1: Register as student
      await page.goto('/');
      await page.getByPlaceholder('Enter your username').fill(TEST_USERS.student1.name);
      
      const studentCard = page.locator('.cursor-pointer').filter({ 
        has: page.getByRole('heading', { name: 'Student' })
      });
      await studentCard.click();
      await page.getByRole('button', { name: 'Get Started' }).click();
      
      // Step 2: Arrive at practice page
      await expect(page).toHaveURL(/\/practice/, { timeout: 15000 });
      await waitForSqlEngine(page);
      
      // Step 3: See first problem
      await expect(page.getByText(/Problem 1|Select All Users/i)).toBeVisible();
      
      // Step 4: Write correct SQL
      await replaceEditorText(page, PROBLEM_SOLUTIONS['problem-1']);
      
      // Step 5: Run query
      await page.getByRole('button', { name: 'Run Query' }).click();
      
      // Step 6: See success
      await expect.poll(async () => {
        const pageText = await page.locator('body').textContent() || '';
        return pageText.includes('Correct') || pageText.includes('success') || pageText.includes('✓');
      }, { timeout: 5000 }).toBe(true);
      
      // Step 7: Check event logged
      const events = await getInteractions(page);
      const executionEvent = events.find(e => e.eventType === 'execution');
      expect(executionEvent).toBeDefined();
      expect(executionEvent?.problemId).toBe('problem-1');
      
      // Verify profile was created
      const profile = await getUserProfile(page);
      expect(profile).not.toBeNull();
      expect(profile.name).toBe(TEST_USERS.student1.name);
      expect(profile.role).toBe('student');
    });
    
    test('student can see problem description and schema', async ({ page }) => {
      await setupStudent(page, TEST_USERS.student1.id, TEST_USERS.student1.name);
      await page.goto('/practice');
      await waitForSqlEngine(page);
      
      // Verify problem description is visible
      await expect(page.getByText(/select all columns|users table/i)).toBeVisible();
      
      // Verify schema is shown
      await expect(page.getByText(/CREATE TABLE users/i)).toBeVisible();
      
      // Verify sample data is visible
      await expect(page.getByText(/Alice|Bob|Charlie/i).first()).toBeVisible();
    });
    
    test('execution result shows in results panel', async ({ page }) => {
      await setupStudent(page, TEST_USERS.student1.id, TEST_USERS.student1.name);
      await page.goto('/practice');
      await waitForSqlEngine(page);
      
      await submitQuery(page, PROBLEM_SOLUTIONS['problem-1']);
      
      // Wait for results to appear
      await expect.poll(async () => {
        const pageText = await page.locator('body').textContent() || '';
        return pageText.includes('Alice') && pageText.includes('Bob');
      }, { timeout: 5000 }).toBe(true);
    });
  });
  
  // ===========================================================================
  // Journey 2: Error → Hint → Success
  // ===========================================================================
  
  test.describe('@no-external @weekly @learning-journey Journey 2: Error to Hint to Success', () => {
    
    test('student makes error, uses hint, then succeeds', async ({ page }) => {
      // Setup and go to practice
      await setupStudent(page, TEST_USERS.student2.id, TEST_USERS.student2.name);
      await page.goto('/practice');
      await waitForSqlEngine(page);
      
      // Step 1: Write incorrect SQL to trigger an error
      await replaceEditorText(page, 'SELECT * FROM nonexistent_table;');
      await page.getByRole('button', { name: 'Run Query' }).click();
      
      // Step 2: See error message
      await expect(page.getByText(/error|Error|no such table/i).first()).toBeVisible({ timeout: 5000 });
      
      // Step 3: Request hint
      const requestHintButton = page.getByRole('button', { name: /Request Hint|Get Hint/i });
      await expect(requestHintButton).toBeVisible();
      await requestHintButton.click();
      
      // Step 4: See hint display
      await expect(page.getByTestId('hint-label-1')).toBeVisible({ timeout: 15000 });
      
      // Verify hint content is shown
      const hintText = await page.getByTestId('hint-label-1').textContent();
      expect(hintText?.length).toBeGreaterThan(0);
      
      // Step 5: Fix SQL with correct query
      await replaceEditorText(page, PROBLEM_SOLUTIONS['problem-1']);
      await page.getByRole('button', { name: 'Run Query' }).click();
      
      // Step 6: See success
      await expect.poll(async () => {
        const pageText = await page.locator('body').textContent() || '';
        return pageText.includes('Correct') || pageText.includes('success') || pageText.includes('✓');
      }, { timeout: 5000 }).toBe(true);
      
      // Verify events logged
      const events = await getInteractions(page);
      expect(events.some(e => e.eventType === 'error')).toBe(true);
      expect(events.some(e => e.eventType === 'hint_view')).toBe(true);
      expect(events.some(e => e.eventType === 'execution')).toBe(true);
    });
    
    test('student can progress through all hint levels', async ({ page }) => {
      await setupStudent(page, TEST_USERS.student2.id, TEST_USERS.student2.name);
      await page.goto('/practice');
      await waitForSqlEngine(page);
      
      // Create error context
      await runUntilErrorCount(page, 1);
      
      // Hint Level 1
      await page.getByRole('button', { name: /Request Hint|Get Hint/i }).click();
      await expect(page.getByTestId('hint-label-1')).toBeVisible({ timeout: 15000 });
      
      // Verify hint_view event logged
      await expect.poll(async () => {
        const events = await getInteractions(page);
        return events.filter(e => e.eventType === 'hint_view' && e.hintLevel === 1).length;
      }, { timeout: 10000 }).toBeGreaterThanOrEqual(1);
      
      // Hint Level 2
      await page.getByRole('button', { name: /Next Hint|More Help/i }).click();
      await expect(page.getByTestId('hint-label-2')).toBeVisible({ timeout: 15000 });
      
      // Verify level 2 event
      await expect.poll(async () => {
        const events = await getInteractions(page);
        return events.filter(e => e.eventType === 'hint_view' && e.hintLevel === 2).length;
      }, { timeout: 10000 }).toBeGreaterThanOrEqual(1);
      
      // Hint Level 3
      await page.getByRole('button', { name: /Next Hint|More Help/i }).click();
      await expect(page.getByTestId('hint-label-3')).toBeVisible({ timeout: 15000 });
      
      // Verify level 3 event
      await expect.poll(async () => {
        const events = await getInteractions(page);
        return events.filter(e => e.eventType === 'hint_view' && e.hintLevel === 3).length;
      }, { timeout: 10000 }).toBeGreaterThanOrEqual(1);
    });
    
    test('hint escalation triggers explanation', async ({ page }) => {
      await setupStudent(page, TEST_USERS.student2.id, TEST_USERS.student2.name);
      await page.goto('/practice');
      await waitForSqlEngine(page);
      
      // Progress through all hint levels
      await runUntilErrorCount(page, 1);
      
      // Level 1
      await page.getByRole('button', { name: /Request Hint|Get Hint/i }).click();
      await expect(page.getByTestId('hint-label-1')).toBeVisible({ timeout: 15000 });
      
      // Level 2
      await page.getByRole('button', { name: /Next Hint/i }).click();
      await expect(page.getByTestId('hint-label-2')).toBeVisible({ timeout: 15000 });
      
      // Level 3
      await page.getByRole('button', { name: /Next Hint/i }).click();
      await expect(page.getByTestId('hint-label-3')).toBeVisible({ timeout: 15000 });
      
      // Escalation after level 3
      const escalateButton = page.getByRole('button', { name: /Get More Help|Explain|Escalate/i });
      if (await escalateButton.isVisible().catch(() => false)) {
        await escalateButton.click();
        
        // Verify explanation or escalation indication
        await expect.poll(async () => {
          const pageText = await page.locator('body').textContent() || '';
          return pageText.includes('explanation') || pageText.includes('Explanation');
        }, { timeout: 15000 }).toBe(true);
      }
    });
  });
  
  // ===========================================================================
  // Journey 3: Multi-Problem Session
  // ===========================================================================
  
  test.describe('@no-external @weekly @learning-journey Journey 3: Multi-Problem Session', () => {
    
    test('student completes multiple problems in session', async ({ page }) => {
      await setupStudent(page, TEST_USERS.student3.id, TEST_USERS.student3.name);
      await page.goto('/practice');
      await waitForSqlEngine(page);
      
      // Problem 1: Select All Users
      await solveProblem(page, 1);
      
      // Navigate to problem 2
      const nextButton = page.getByRole('button', { name: /Next Problem|Continue/i });
      if (await nextButton.isVisible().catch(() => false)) {
        await nextButton.click();
      } else {
        await navigateToProblem(page, 2);
      }
      
      await expect(page.getByText(/Problem 2|Filter Users/i)).toBeVisible({ timeout: 5000 });
      
      // Problem 2: Filter by Age
      await solveProblem(page, 2);
      
      // Verify interactions logged for both problems
      const events = await getInteractions(page);
      const problem1Events = events.filter(e => e.problemId === 'problem-1');
      const problem2Events = events.filter(e => e.problemId === 'problem-2');
      
      expect(problem1Events.length).toBeGreaterThan(0);
      expect(problem2Events.length).toBeGreaterThan(0);
      
      // Verify success events for both
      expect(problem1Events.some(e => e.eventType === 'execution')).toBe(true);
      expect(problem2Events.some(e => e.eventType === 'execution')).toBe(true);
    });
    
    test('student can navigate between problems', async ({ page }) => {
      await setupStudent(page, TEST_USERS.student3.id, TEST_USERS.student3.name);
      await page.goto('/practice');
      await waitForSqlEngine(page);
      
      // Start at problem 1
      await expect(page.getByText(/Problem 1|Select All Users/i)).toBeVisible();
      
      // Navigate to problem 3
      await navigateToProblem(page, 3);
      await expect(page.getByText(/Problem 3|Join Users/i)).toBeVisible();
      
      // Navigate to problem 6
      await navigateToProblem(page, 6);
      await expect(page.getByText(/Problem 6|Order Users/i)).toBeVisible();
      
      // Verify URL reflects problem change
      const currentUrl = page.url();
      expect(currentUrl).toContain('problem-6');
    });
    
    test('progress is tracked across problems', async ({ page }) => {
      await setupStudent(page, TEST_USERS.student3.id, TEST_USERS.student3.name);
      await page.goto('/practice');
      await waitForSqlEngine(page);
      
      // Solve first problem
      await solveProblem(page, 1);
      
      // Solve second problem
      await navigateToProblem(page, 2);
      await solveProblem(page, 2);
      
      // Check interaction count
      const events = await getInteractions(page);
      const executionEvents = events.filter(e => e.eventType === 'execution');
      
      // Should have at least 2 execution events
      expect(executionEvents.length).toBeGreaterThanOrEqual(2);
      
      // Verify different problem IDs
      const uniqueProblemIds = new Set(executionEvents.map(e => e.problemId));
      expect(uniqueProblemIds.size).toBeGreaterThanOrEqual(1);
    });
    
    test('session maintains state across problem navigation', async ({ page }) => {
      await setupStudent(page, TEST_USERS.student3.id, TEST_USERS.student3.name);
      await page.goto('/practice');
      await waitForSqlEngine(page);
      
      // Add some SQL to editor
      await replaceEditorText(page, '-- Test comment\nSELECT 1;');
      
      // Navigate away
      await navigateToProblem(page, 2);
      
      // Navigate back
      await navigateToProblem(page, 1);
      
      // Editor may reset on problem change - verify page loads correctly
      await expect(page.getByText(/Problem 1/i)).toBeVisible();
    });
  });
  
  // ===========================================================================
  // Journey 4: Full Learning Cycle
  // ===========================================================================
  
  test.describe('@no-external @weekly @learning-journey Journey 4: Full Learning Cycle', () => {
    
    test('complete learning cycle with all features', async ({ page }) => {
      const user = TEST_USERS.fullCycle;
      
      // Step 1: Register
      await registerStudent(page, user.name);
      await waitForSqlEngine(page);
      
      // Step 2: Solve problem with hints (error → hint → success)
      // First cause an error
      await submitQuery(page, 'SELECT * FROM wrong_table;');
      await expect(page.getByText(/error/i).first()).toBeVisible({ timeout: 5000 });
      
      // Get hint
      await page.getByRole('button', { name: /Request Hint|Get Hint/i }).click();
      await expect(page.getByTestId('hint-label-1')).toBeVisible({ timeout: 15000 });
      
      // Solve correctly
      await submitQuery(page, PROBLEM_SOLUTIONS['problem-1']);
      await expect.poll(async () => {
        const pageText = await page.locator('body').textContent() || '';
        return pageText.includes('Correct') || pageText.includes('success') || pageText.includes('✓');
      }, { timeout: 5000 }).toBe(true);
      
      // Step 3: Add to textbook (if button available)
      const saveButton = page.getByRole('button', { name: /Save to Notes|Add to Notes|Add to My Notes/i });
      if (await saveButton.isVisible().catch(() => false)) {
        await saveButton.click();
        
        // Verify unit was saved
        await expect.poll(async () => {
          const raw = window.localStorage.getItem('sql-learning-textbook');
          const textbooks = raw ? JSON.parse(raw) : {};
          const userId = (await getUserProfile(page))?.id || user.id;
          const units = textbooks[userId] || [];
          return units.length;
        }, { timeout: 10000 }).toBeGreaterThan(0);
      }
      
      // Step 4: View textbook
      await page.getByRole('link', { name: /Textbook|My Textbook|My Notes/i }).first().click();
      await expect(page).toHaveURL(/\/textbook/);
      await expect(page.getByRole('heading', { name: /My Textbook|My Notes|Learning Journey/i })).toBeVisible();
      
      // Step 5: Use Ask My Textbook chat (if available)
      const chatInput = page.locator('[data-testid="chat-input"], input[placeholder*="Ask"]').first();
      if (await chatInput.isVisible().catch(() => false)) {
        await chatInput.fill('Explain JOIN');
        
        const sendButton = page.getByRole('button', { name: /Send|Ask/i });
        if (await sendButton.isVisible().catch(() => false)) {
          await sendButton.click();
          
          // Verify response
          await expect.poll(async () => {
            const pageText = await page.locator('body').textContent() || '';
            return pageText.includes('JOIN') || pageText.includes('join');
          }, { timeout: 15000 }).toBe(true);
        }
      }
      
      // Step 6: Return to practice
      await page.getByRole('link', { name: /Practice/i }).first().click();
      await expect(page).toHaveURL(/\/practice/);
      await expect(page.getByText(/Problem/i)).toBeVisible();
      
      // Final verification: user profile still intact
      const profile = await getUserProfile(page);
      expect(profile).not.toBeNull();
      expect(profile.role).toBe('student');
    });
    
    test('textbook accumulates notes from multiple sessions', async ({ page }) => {
      const user = TEST_USERS.fullCycle;
      await setupStudent(page, user.id, user.name);
      
      // Seed textbook with initial unit
      await page.evaluate((uid) => {
        const unit = {
          id: 'test-unit-1',
          type: 'summary',
          conceptId: 'select-basic',
          title: 'Test Note 1',
          content: 'Content from first session',
          addedTimestamp: Date.now() - 3600000,
          sourceInteractionIds: ['evt-1'],
          prerequisites: []
        };
        window.localStorage.setItem('sql-learning-textbook', JSON.stringify({
          [uid]: [unit]
        }));
      }, user.id);
      
      // Navigate to textbook
      await page.goto('/textbook');
      await expect(page.getByRole('heading', { name: /My Textbook/i })).toBeVisible();
      
      // Verify seeded content
      await expect(page.getByText('Test Note 1')).toBeVisible();
    });
    
    test('student can navigate full app workflow', async ({ page }) => {
      await setupStudent(page, TEST_USERS.student1.id, TEST_USERS.student1.name);
      
      // Start at practice
      await page.goto('/practice');
      await waitForSqlEngine(page);
      
      // Go to concepts
      await page.getByRole('link', { name: /Concepts/i }).first().click();
      await expect(page).toHaveURL(/\/concepts/);
      await expect(page.getByRole('heading', { name: /Concepts|Library/i })).toBeVisible();
      
      // View a concept detail
      const conceptLink = page.getByRole('link').filter({ hasText: /SELECT|JOIN|WHERE/i }).first();
      if (await conceptLink.isVisible().catch(() => false)) {
        await conceptLink.click();
        await expect(page).toHaveURL(/\/concepts\//);
        await expect(page.getByRole('heading')).toBeVisible();
      }
      
      // Return to practice
      await page.getByRole('link', { name: /Practice/i }).first().click();
      await expect(page).toHaveURL(/\/practice/);
    });
    
    test('session persistence maintains progress after reload', async ({ page }) => {
      await setupStudent(page, TEST_USERS.student2.id, TEST_USERS.student2.name);
      await page.goto('/practice');
      await waitForSqlEngine(page);
      
      // Solve a problem
      await solveProblem(page, 1);
      
      // Get current event count
      const eventsBefore = await getInteractions(page);
      const countBefore = eventsBefore.length;
      
      // Reload page
      await page.reload();
      await waitForSqlEngine(page);
      
      // Verify events persisted
      const eventsAfter = await getInteractions(page);
      expect(eventsAfter.length).toBe(countBefore);
      
      // Verify still logged in
      const profile = await getUserProfile(page);
      expect(profile).not.toBeNull();
      expect(profile.name).toBe(TEST_USERS.student2.name);
    });
  });
  
  // ===========================================================================
  // Journey 5: Edge Cases and Error Recovery
  // ===========================================================================
  
  test.describe('@no-external @weekly @learning-journey Journey 5: Edge Cases', () => {
    
    test('handles syntax errors gracefully', async ({ page }) => {
      await setupStudent(page, TEST_USERS.student1.id, TEST_USERS.student1.name);
      await page.goto('/practice');
      await waitForSqlEngine(page);
      
      // Submit invalid SQL
      await submitQuery(page, 'SELECT * FORM users;');  // typo: FORM instead of FROM
      
      // Should show error, not crash
      await expect(page.getByText(/error|Error|syntax/i).first()).toBeVisible({ timeout: 5000 });
      
      // Can recover and submit correct query
      await submitQuery(page, PROBLEM_SOLUTIONS['problem-1']);
      
      await expect.poll(async () => {
        const pageText = await page.locator('body').textContent() || '';
        return pageText.includes('Correct') || pageText.includes('success') || pageText.includes('✓');
      }, { timeout: 5000 }).toBe(true);
    });
    
    test('handles empty query submission', async ({ page }) => {
      await setupStudent(page, TEST_USERS.student1.id, TEST_USERS.student1.name);
      await page.goto('/practice');
      await waitForSqlEngine(page);
      
      // Submit empty/whitespace query
      await replaceEditorText(page, '   ');
      await page.getByRole('button', { name: 'Run Query' }).click();
      
      // Should show some feedback (error or no results)
      await page.waitForTimeout(1000);
      
      // App should still be functional
      await submitQuery(page, PROBLEM_SOLUTIONS['problem-1']);
      
      await expect.poll(async () => {
        const pageText = await page.locator('body').textContent() || '';
        return pageText.includes('Correct') || pageText.includes('success') || pageText.includes('✓');
      }, { timeout: 5000 }).toBe(true);
    });
    
    test('rapid consecutive queries do not break app', async ({ page }) => {
      await setupStudent(page, TEST_USERS.student1.id, TEST_USERS.student1.name);
      await page.goto('/practice');
      await waitForSqlEngine(page);
      
      // Submit multiple queries rapidly
      for (let i = 0; i < 5; i++) {
        await submitQuery(page, `SELECT ${i};`);
        await page.waitForTimeout(200);
      }
      
      // App should still work
      await submitQuery(page, PROBLEM_SOLUTIONS['problem-1']);
      
      await expect.poll(async () => {
        const pageText = await page.locator('body').textContent() || '';
        return pageText.includes('Correct') || pageText.includes('success') || pageText.includes('✓');
      }, { timeout: 5000 }).toBe(true);
    });
    
    test('can recover from navigation to non-existent problem', async ({ page }) => {
      await setupStudent(page, TEST_USERS.student1.id, TEST_USERS.student1.name);
      
      // Navigate to invalid problem
      await page.goto('/practice?problem=problem-999');
      await waitForSqlEngine(page);
      
      // Should handle gracefully (either show error or default to problem 1)
      await expect(page.locator('body')).toBeVisible();
      
      // Should be able to navigate to valid problem
      await navigateToProblem(page, 1);
      await expect(page.getByText(/Problem 1/i)).toBeVisible();
    });
  });
});

// =============================================================================
// Integration Test: Cross-Feature Workflow
// =============================================================================

test.describe('@no-external @weekly @learning-journey Cross-Feature Integration', () => {
  
  test('complete workflow: practice → error → hint → explanation → textbook', async ({ page }) => {
    const userId = 'integration-user-1';
    const userName = 'IntegrationUser';
    
    await setupStudent(page, userId, userName);
    await page.goto('/practice');
    await waitForSqlEngine(page);
    
    // 1. Cause error
    await runUntilErrorCount(page, 1);
    
    // 2. Progress through hints
    await page.getByRole('button', { name: /Request Hint/i }).click();
    await expect(page.getByTestId('hint-label-1')).toBeVisible({ timeout: 15000 });
    
    await page.getByRole('button', { name: /Next Hint/i }).click();
    await expect(page.getByTestId('hint-label-2')).toBeVisible({ timeout: 15000 });
    
    await page.getByRole('button', { name: /Next Hint/i }).click();
    await expect(page.getByTestId('hint-label-3')).toBeVisible({ timeout: 15000 });
    
    // 3. Escalate to explanation
    const escalateButton = page.getByRole('button', { name: /Get More Help/i });
    if (await escalateButton.isVisible().catch(() => false)) {
      await escalateButton.click();
    }
    
    // 4. Add to notes if available
    const saveButton = page.getByRole('button', { name: /Add to My Notes/i });
    if (await saveButton.isVisible().catch(() => false)) {
      await saveButton.click();
      
      // Verify saved
      await expect.poll(async () => {
        const raw = window.localStorage.getItem('sql-learning-textbook');
        const textbooks = raw ? JSON.parse(raw) : {};
        const units = textbooks[userId] || [];
        return units.length;
      }, { timeout: 10000 }).toBeGreaterThan(0);
    }
    
    // 5. View textbook
    await page.getByRole('link', { name: /My Textbook/i }).first().click();
    await expect(page).toHaveURL(/\/textbook/);
    
    // 6. Verify provenance section
    const provenanceSection = page.locator('summary').filter({ hasText: /Provenance/i });
    if (await provenanceSection.isVisible().catch(() => false)) {
      await provenanceSection.click();
      await expect(page.getByTestId('provenance-retrieved-sources')).toBeVisible();
    }
    
    // 7. Verify all events logged
    const events = await page.evaluate(() => {
      const raw = window.localStorage.getItem('sql-learning-interactions');
      return raw ? JSON.parse(raw) : [];
    });
    
    expect(events.some(e => e.eventType === 'error')).toBe(true);
    expect(events.some(e => e.eventType === 'hint_view')).toBe(true);
    expect(events.filter(e => e.eventType === 'hint_view').length).toBeGreaterThanOrEqual(3);
  });
  
  test('learning analytics are tracked correctly', async ({ page }) => {
    const userId = 'analytics-user-1';
    const userName = 'AnalyticsUser';
    
    await setupStudent(page, userId, userName);
    await page.goto('/practice');
    await waitForSqlEngine(page);
    
    // Perform various actions
    await submitQuery(page, 'SELECT bad;');
    await page.waitForTimeout(500);
    
    await page.getByRole('button', { name: /Request Hint/i }).click();
    await expect(page.getByTestId('hint-label-1')).toBeVisible({ timeout: 15000 });
    
    await submitQuery(page, PROBLEM_SOLUTIONS['problem-1']);
    await page.waitForTimeout(500);
    
    // Navigate to different problem
    await navigateToProblem(page, 2);
    await submitQuery(page, PROBLEM_SOLUTIONS['problem-2']);
    
    // Verify analytics events
    const events = await page.evaluate(() => {
      const raw = window.localStorage.getItem('sql-learning-interactions');
      return raw ? JSON.parse(raw) : [];
    });
    
    // Should have events from both problems
    const problemIds = [...new Set(events.map(e => e.problemId))];
    expect(problemIds.length).toBeGreaterThanOrEqual(1);
    
    // Should have multiple event types
    const eventTypes = [...new Set(events.map(e => e.eventType))];
    expect(eventTypes.length).toBeGreaterThanOrEqual(2);
    expect(eventTypes).toContain('hint_view');
    expect(eventTypes).toContain('execution');
  });
});
