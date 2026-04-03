/**
 * Hint Request Flow E2E Tests
 *
 * Tests the complete hint request and escalation flow:
 * - First hint request (Rung 1)
 * - Follow-up hints at same level
 * - Escalation to Rung 2
 * - Escalation to Rung 3
 * - Fallback behavior when LLM unavailable
 */

import { test, expect } from '@playwright/test';
import { storage } from '../../../src/app/lib/storage';

test.describe('Hint Request Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to app and set up student
    await page.goto('/');
    await page.fill('[data-testid="username-input"]', 'test-student');
    await page.selectOption('[data-testid="role-select"]', 'student');
    await page.click('[data-testid="start-btn"]');

    // Wait for learning interface
    await page.waitForSelector('[data-testid="learning-interface"]');

    // Select first problem
    await page.click('[data-testid="problem-select-trigger"]');
    await page.click('[data-testid="problem-option-0"]');
  });

  test('should request first hint at rung 1', async ({ page }) => {
    // Trigger an error first
    await page.fill('[data-testid="sql-editor"] textarea', 'SELECT * FROM users WHERE');
    await page.click('[data-testid="run-query-btn"]');

    // Wait for error
    await page.waitForSelector('[data-testid="error-display"]');

    // Request hint
    await page.click('[data-testid="request-hint-btn"]');

    // Verify hint appears
    await page.waitForSelector('[data-testid="hint-display-0"]');
    const hintText = await page.textContent('[data-testid="hint-display-0"]');
    expect(hintText).toBeTruthy();

    // Verify it's a rung 1 hint (brief, no SQL code)
    expect(hintText!.length).toBeLessThan(150);

    // Verify source attribution
    const hasSource = await page.isVisible('[data-testid="hint-source-badge"]');
    expect(hasSource).toBe(true);
  });

  test('should track hint helpfulness ratings', async ({ page }) => {
    // Get a hint
    await page.fill('[data-testid="sql-editor"] textarea', 'SELECT * FROM users WHERE');
    await page.click('[data-testid="run-query-btn"]');
    await page.waitForSelector('[data-testid="error-display"]');
    await page.click('[data-testid="request-hint-btn"]');
    await page.waitForSelector('[data-testid="hint-display-0"]');

    // Rate as helpful
    await page.click('[data-testid="hint-helpful-btn-0"]');

    // Verify rating applied
    const helpfulBtn = await page.locator('[data-testid="hint-helpful-btn-0"]');
    await expect(helpfulBtn).toHaveClass(/bg-green-100/);

    // Check that interaction was logged
    const interactions = await page.evaluate(() => {
      return JSON.parse(localStorage.getItem('sql-learning-interactions') || '[]');
    });

    const ratingEvent = interactions.find(
      (i: any) => i.eventType === 'hint_helpfulness_rating'
    );
    expect(ratingEvent).toBeDefined();
    expect(ratingEvent.helpfulnessRating).toBe('helpful');
  });

  test('should escalate to rung 2 after 3 hints', async ({ page }) => {
    // Trigger error
    await page.fill('[data-testid="sql-editor"] textarea', 'SELECT * FROM users WHERE');
    await page.click('[data-testid="run-query-btn"]');
    await page.waitForSelector('[data-testid="error-display"]');

    // Request 3 hints
    for (let i = 0; i < 3; i++) {
      await page.click('[data-testid="request-hint-btn"]');
      await page.waitForTimeout(500); // Wait for hint to load
    }

    // Verify escalation prompt appears
    await page.waitForSelector('[data-testid="escalation-prompt"]');

    // Click escalate
    await page.click('[data-testid="escalate-btn"]');

    // Verify rung 2 hint
    await page.waitForSelector('[data-testid="rung-indicator"]', {
      state: 'visible'
    });
    const rungText = await page.textContent('[data-testid="rung-indicator"]');
    expect(rungText).toContain('2');
  });

  test('should escalate to rung 3 (explanation)', async ({ page }) => {
    // Trigger error and get to rung 2
    await page.fill('[data-testid="sql-editor"] textarea', 'SELECT * FROM users WHERE');
    await page.click('[data-testid="run-query-btn"]');
    await page.waitForSelector('[data-testid="error-display"]');

    // Request hints and escalate to rung 2
    for (let i = 0; i < 3; i++) {
      await page.click('[data-testid="request-hint-btn"]');
      await page.waitForTimeout(500);
    }
    await page.click('[data-testid="escalate-btn"]');
    await page.waitForSelector('[data-testid="rung-indicator"]');

    // Request 2 more hints at rung 2
    await page.click('[data-testid="request-hint-btn"]');
    await page.click('[data-testid="request-hint-btn"]');

    // Escalate to rung 3
    await page.click('[data-testid="escalate-btn"]');

    // Verify explanation view
    await page.waitForSelector('[data-testid="explanation-panel"]');
    const explanationText = await page.textContent('[data-testid="explanation-content"]');
    expect(explanationText!.length).toBeGreaterThan(200); // Rung 3 is more detailed
  });

  test('should handle fallback when LLM unavailable', async ({ page }) => {
    // Mock LLM unavailable
    await page.route('**/api/llm/**', route => {
      route.fulfill({
        status: 503,
        body: JSON.stringify({ error: 'LLM unavailable' })
      });
    });

    // Trigger error
    await page.fill('[data-testid="sql-editor"] textarea', 'SELECT * FROM users WHERE');
    await page.click('[data-testid="run-query-btn"]');
    await page.waitForSelector('[data-testid="error-display"]');

    // Request hint (should fallback to SQL-Engage)
    await page.click('[data-testid="request-hint-btn"]');
    await page.waitForSelector('[data-testid="hint-display-0"]');

    // Verify fallback indicator
    const hasFallbackBadge = await page.isVisible('[data-testid="fallback-badge"]');
    expect(hasFallbackBadge).toBe(true);
  });

  test('should save hint to notes', async ({ page }) => {
    // Get a hint
    await page.fill('[data-testid="sql-editor"] textarea', 'SELECT * FROM users WHERE');
    await page.click('[data-testid="run-query-btn"]');
    await page.waitForSelector('[data-testid="error-display"]');
    await page.click('[data-testid="request-hint-btn"]');
    await page.waitForSelector('[data-testid="hint-display-0"]');

    // Save to notes
    await page.click('[data-testid="save-to-notes-btn-0"]');

    // Verify success toast
    await page.waitForSelector('[data-testid="toast-success"]');
    const toastText = await page.textContent('[data-testid="toast-success"]');
    expect(toastText).toContain('saved to notes');

    // Verify in textbook
    await page.click('[data-testid="nav-textbook"]');
    await page.waitForSelector('[data-testid="textbook-page"]');
    const noteCount = await page.locator('[data-testid="textbook-unit"]').count();
    expect(noteCount).toBeGreaterThan(0);
  });

  test('should log all hint interactions', async ({ page }) => {
    // Get a hint
    await page.fill('[data-testid="sql-editor"] textarea', 'SELECT * FROM users WHERE');
    await page.click('[data-testid="run-query-btn"]');
    await page.waitForSelector('[data-testid="error-display"]');
    await page.click('[data-testid="request-hint-btn"]');
    await page.waitForSelector('[data-testid="hint-display-0"]');

    // Check logged events
    const interactions = await page.evaluate(() => {
      return JSON.parse(localStorage.getItem('sql-learning-interactions') || '[]');
    });

    // Should have hint_request event
    const hintRequestEvent = interactions.find(
      (i: any) => i.eventType === 'hint_request'
    );
    expect(hintRequestEvent).toBeDefined();
    expect(hintRequestEvent.problemId).toBeDefined();
    expect(hintRequestEvent.hintLevel).toBe(1);

    // Should have hint_view event
    const hintViewEvent = interactions.find(
      (i: any) => i.eventType === 'hint_view'
    );
    expect(hintViewEvent).toBeDefined();
  });
});
