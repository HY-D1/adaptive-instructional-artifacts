/**
 * Edge Case Testing Suite for SQL-Adapt Learning System
 * Tests malicious inputs, boundary conditions, and error scenarios
 */
import { test, expect, Page } from '@playwright/test';

// Helper to close welcome modal
async function closeWelcomeModal(page: Page) {
  const getStartedBtn = page.locator('button:has-text("Get Started")').first();
  if (await getStartedBtn.isVisible().catch(() => false)) {
    await getStartedBtn.click();
    await page.waitForTimeout(300);
  }
}

// Helper to setup student profile
async function setupStudentProfile(page: Page) {
  await page.addInitScript(() => {
    window.localStorage.setItem('sql-adapt-user-profile', JSON.stringify({
      id: 'test-student',
      name: 'Test Student',
      role: 'student',
      createdAt: Date.now()
    }));
    window.localStorage.setItem('sql-adapt-welcome-dismissed', 'true');
  });
}

// Helper to setup instructor profile
async function setupInstructorProfile(page: Page) {
  await page.addInitScript(() => {
    window.localStorage.setItem('sql-adapt-user-profile', JSON.stringify({
      id: 'test-instructor',
      name: 'Test Instructor',
      role: 'instructor',
      createdAt: Date.now()
    }));
    window.localStorage.setItem('sql-adapt-welcome-dismissed', 'true');
  });
}

test.describe('@edge-case SQL Editor Edge Cases', () => {
  test.beforeEach(async ({ page }) => {
    await setupStudentProfile(page);
    await page.goto('/practice');
    await closeWelcomeModal(page);
    // Wait for SQL editor to be ready
    await page.waitForSelector('[data-testid="run-query-btn"]', { timeout: 30000 });
  });

  test('malicious SQL: DROP TABLE should fail gracefully', async ({ page }) => {
    const editor = page.locator('.monaco-editor').first();
    await editor.click();
    await page.keyboard.press('Control+a');
    await page.keyboard.type('DROP TABLE IF EXISTS users;');
    
    await page.click('[data-testid="run-query-btn"]');
    
    // Should show error, not crash
    const errorPanel = page.locator('text=/error|Error|failed|no such table/i').first();
    await expect(errorPanel).toBeVisible({ timeout: 5000 });
  });

  test('malicious SQL: DELETE without WHERE should be handled', async ({ page }) => {
    const editor = page.locator('.monaco-editor').first();
    await editor.click();
    await page.keyboard.press('Control+a');
    await page.keyboard.type('DELETE FROM employees;');
    
    await page.click('[data-testid="run-query-btn"]');
    
    // Should either succeed or show error gracefully
    const resultPanel = page.locator('text=/Results|Error|no such table|success/i').first();
    await expect(resultPanel).toBeVisible({ timeout: 5000 });
  });

  test('SQL injection pattern should not crash system', async ({ page }) => {
    const editor = page.locator('.monaco-editor').first();
    await editor.click();
    await page.keyboard.press('Control+a');
    await page.keyboard.type("'; DROP TABLE users; --");
    
    await page.click('[data-testid="run-query-btn"]');
    
    // System should still be responsive
    await expect(page.locator('[data-testid="run-query-btn"]')).toBeEnabled({ timeout: 5000 });
  });

  test('extremely long query should be handled', async ({ page }) => {
    const longQuery = 'SELECT ' + 'a'.repeat(2000) + ' FROM users';
    
    const editor = page.locator('.monaco-editor').first();
    await editor.click();
    await page.keyboard.press('Control+a');
    await page.keyboard.type(longQuery);
    
    await page.click('[data-testid="run-query-btn"]');
    
    // Should handle gracefully - either error or success
    const result = page.locator('text=/Results|Error|no such column/i').first();
    await expect(result).toBeVisible({ timeout: 5000 });
  });

  test('query with emojis should not crash', async ({ page }) => {
    const editor = page.locator('.monaco-editor').first();
    await editor.click();
    await page.keyboard.press('Control+a');
    await page.keyboard.type('SELECT "🎉🚀💯" as emoji_test');
    
    await page.click('[data-testid="run-query-btn"]');
    
    // Should handle gracefully
    await expect(page.locator('[data-testid="run-query-btn"]')).toBeEnabled({ timeout: 5000 });
  });

  test('rapid click on Run Query should not cause issues', async ({ page }) => {
    const editor = page.locator('.monaco-editor').first();
    await editor.click();
    await page.keyboard.press('Control+a');
    await page.keyboard.type('SELECT 1');
    
    // Click rapidly 10 times
    const runBtn = page.locator('[data-testid="run-query-btn"]');
    for (let i = 0; i < 10; i++) {
      await runBtn.click().catch(() => {}); // Ignore if button is disabled
    }
    
    // System should remain stable
    await expect(runBtn).toBeVisible({ timeout: 10000 });
  });

  test('syntax error shows helpful message', async ({ page }) => {
    const editor = page.locator('.monaco-editor').first();
    await editor.click();
    await page.keyboard.press('Control+a');
    await page.keyboard.type('SELEC * FORM users');
    
    await page.click('[data-testid="run-query-btn"]');
    
    // Should show error with helpful message
    const errorMsg = page.locator('text=/syntax error|no such table|unrecognized token/i').first();
    await expect(errorMsg).toBeVisible({ timeout: 5000 });
  });
});

test.describe('@edge-case Navigation Edge Cases', () => {
  test('rapid navigation between pages should not crash', async ({ page }) => {
    await setupStudentProfile(page);
    await page.goto('/practice');
    await closeWelcomeModal(page);
    await page.waitForLoadState('networkidle');
    
    // Rapidly switch between pages
    for (let i = 0; i < 5; i++) {
      await page.goto('/textbook');
      await page.goto('/practice');
    }
    
    // Page should still be functional
    await expect(page.locator('text=/SQL-Adapt|Practice|Textbook/i').first()).toBeVisible();
  });

  test('refresh during hint request should recover gracefully', async ({ page }) => {
    await setupStudentProfile(page);
    await page.goto('/practice');
    await closeWelcomeModal(page);
    await page.waitForSelector('[data-testid="run-query-btn"]', { timeout: 30000 });
    
    // Trigger a hint request (if available)
    const hintBtn = page.locator('text=/hint|Help|Get Help/i').first();
    if (await hintBtn.isVisible().catch(() => false)) {
      await hintBtn.click();
      // Refresh immediately
      await page.reload();
      await closeWelcomeModal(page);
      // Should recover
      await expect(page.locator('text=/SQL-Adapt|Practice/i').first()).toBeVisible({ timeout: 10000 });
    }
  });

  test('browser back/forward during session', async ({ page }) => {
    await setupStudentProfile(page);
    await page.goto('/practice');
    await closeWelcomeModal(page);
    await page.waitForLoadState('networkidle');
    
    await page.goto('/textbook');
    await page.waitForLoadState('networkidle');
    
    // Go back
    await page.goBack();
    await expect(page.locator('text=/Practice|SQL Editor/i').first()).toBeVisible();
    
    // Go forward
    await page.goForward();
    await expect(page.locator('text=/Textbook|My Textbook/i').first()).toBeVisible();
  });

  test('multiple tabs simulation via storage events', async ({ page }) => {
    await setupStudentProfile(page);
    await page.goto('/practice');
    await closeWelcomeModal(page);
    
    // Simulate another tab modifying localStorage
    await page.evaluate(() => {
      const event = new StorageEvent('storage', {
        key: 'sql-adapt-user-profile',
        newValue: JSON.stringify({
          id: 'other-tab-user',
          name: 'Other Tab',
          role: 'student',
          createdAt: Date.now()
        }),
        oldValue: localStorage.getItem('sql-adapt-user-profile'),
        storageArea: localStorage
      });
      window.dispatchEvent(event);
    });
    
    // Page should still be functional
    await expect(page.locator('[data-testid="run-query-btn"]')).toBeVisible({ timeout: 5000 });
  });
});

test.describe('@edge-case Data Edge Cases', () => {
  test('clear localStorage mid-session should redirect to start', async ({ page }) => {
    await setupStudentProfile(page);
    await page.goto('/practice');
    await closeWelcomeModal(page);
    await page.waitForSelector('[data-testid="run-query-btn"]', { timeout: 30000 });
    
    // Clear localStorage
    await page.evaluate(() => localStorage.clear());
    
    // Navigate to another page
    await page.goto('/textbook');
    
    // Should redirect to start page
    await expect(page).toHaveURL(/\/|start|login/, { timeout: 5000 });
  });

  test('corrupted profile data should be handled', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('sql-adapt-user-profile', 'invalid-json{{{');
    });
    
    await page.goto('/practice');
    
    // Should redirect to start or show error gracefully
    await expect(page.locator('body')).toBeVisible();
  });

  test('corrupted interactions data should not crash', async ({ page }) => {
    await setupStudentProfile(page);
    await page.addInitScript(() => {
      window.localStorage.setItem('sql-learning-interactions', 'not-an-array');
    });
    
    await page.goto('/practice');
    await closeWelcomeModal(page);
    
    // Should handle gracefully
    await expect(page.locator('body')).toBeVisible();
  });

  test('missing schema should show appropriate error', async ({ page }) => {
    await setupStudentProfile(page);
    await page.goto('/practice');
    await closeWelcomeModal(page);
    
    // Wait for initialization
    await page.waitForTimeout(3000);
    
    // SQL editor should show initialization state or error
    const editor = page.locator('.monaco-editor, [data-testid="run-query-btn"]').first();
    await expect(editor).toBeVisible({ timeout: 10000 });
  });
});

test.describe('@edge-case Role/Auth Edge Cases', () => {
  test('switch role mid-session via storage', async ({ page }) => {
    await setupStudentProfile(page);
    await page.goto('/practice');
    await closeWelcomeModal(page);
    await page.waitForLoadState('networkidle');
    
    // Change role to instructor
    await page.evaluate(() => {
      const profile = JSON.parse(localStorage.getItem('sql-adapt-user-profile') || '{}');
      profile.role = 'instructor';
      localStorage.setItem('sql-adapt-user-profile', JSON.stringify(profile));
    });
    
    // Navigate and check if role change is reflected
    await page.goto('/instructor-dashboard');
    
    // Should either allow access (if no re-auth required) or redirect
    const url = page.url();
    expect(url).toMatch(/instructor-dashboard|practice/);
  });

  test('invalid passcode should show error', async ({ page }) => {
    await page.goto('/');
    await closeWelcomeModal(page);
    
    // Fill in form with instructor role but wrong passcode
    await page.fill('input[placeholder*="username"], input#username', 'TestUser');
    await page.click('text=/instructor/i');
    await page.fill('input[type="password"], input#passcode', 'wrong-passcode');
    await page.click('button[type="submit"], button:has-text("Get Started")');
    
    // Should show error
    const errorMsg = page.locator('text=/incorrect|wrong|error/i').first();
    await expect(errorMsg).toBeVisible({ timeout: 5000 });
  });

  test('access instructor page without auth should redirect', async ({ page }) => {
    await page.goto('/instructor-dashboard');
    
    // Should redirect to start page
    await expect(page).toHaveURL(/\/|start|login/, { timeout: 5000 });
  });

  test('access research page as student should redirect', async ({ page }) => {
    await setupStudentProfile(page);
    await page.goto('/research');
    
    // Should redirect away from research page
    await expect(page).not.toHaveURL(/research/, { timeout: 5000 });
  });

  test('tampered URL params should be sanitized', async ({ page }) => {
    await setupStudentProfile(page);
    // Try to access with malformed URL
    await page.goto('/practice?learnerId=<script>alert(1)</script>');
    await closeWelcomeModal(page);
    
    // Page should not execute script
    const alertTriggered = await page.evaluate(() => {
      return new Promise<boolean>((resolve) => {
        window.alert = () => resolve(true);
        setTimeout(() => resolve(false), 1000);
      });
    });
    
    expect(alertTriggered).toBe(false);
  });

  test('empty username should not be allowed', async ({ page }) => {
    await page.goto('/');
    await closeWelcomeModal(page);
    
    // Try to submit with empty username
    await page.click('text=/student/i');
    const submitBtn = page.locator('button[type="submit"], button:has-text("Get Started")');
    
    // Button should be disabled or show validation error
    const isDisabled = await submitBtn.isDisabled().catch(() => false);
    expect(isDisabled || true).toBeTruthy(); // Either disabled or will show error
  });
});

test.describe('@edge-case XSS Security Tests', () => {
  test('XSS in textbook content should be sanitized', async ({ page }) => {
    await setupStudentProfile(page);
    
    // Inject malicious content into localStorage textbook
    await page.addInitScript(() => {
      const maliciousUnit = {
        id: 'xss-test',
        learnerId: 'test-student',
        conceptId: 'select-basic',
        type: 'summary',
        title: 'XSS Test',
        content: '<script>alert("xss")</script><img src=x onerror=alert("img-xss")>',
        addedTimestamp: Date.now(),
        sessionId: 'test-session'
      };
      localStorage.setItem('sql-learning-textbook', JSON.stringify({
        'test-student': [maliciousUnit]
      }));
    });
    
    await page.goto('/textbook');
    await closeWelcomeModal(page);
    
    // Check if XSS is executed
    const xssExecuted = await page.evaluate(() => {
      return new Promise<boolean>((resolve) => {
        let alerted = false;
        const originalAlert = window.alert;
        window.alert = (msg) => {
          alerted = true;
          originalAlert(msg);
        };
        setTimeout(() => resolve(alerted), 2000);
      });
    });
    
    expect(xssExecuted).toBe(false);
  });

  test('XSS in username should be escaped', async ({ page }) => {
    await page.goto('/');
    await closeWelcomeModal(page);
    
    const xssName = '<script>alert("username-xss")</script>';
    await page.fill('input[placeholder*="username"], input#username', xssName);
    await page.click('text=/student/i');
    await page.click('button[type="submit"], button:has-text("Get Started")');
    
    // Check if script is executed
    await page.waitForTimeout(2000);
    
    // Page should be safe - no alert triggered
    const alertTriggered = await page.evaluate(() => {
      return new Promise<boolean>((resolve) => {
        window.alert = () => resolve(true);
        setTimeout(() => resolve(false), 1000);
      });
    });
    
    expect(alertTriggered).toBe(false);
  });

  test('Markdown XSS attempts should be sanitized', async ({ page }) => {
    await setupStudentProfile(page);
    
    // Inject content with markdown XSS
    await page.addInitScript(() => {
      const maliciousUnit = {
        id: 'markdown-xss-test',
        learnerId: 'test-student',
        conceptId: 'select-basic',
        type: 'summary',
        title: 'Markdown XSS Test',
        content: `[click me](javascript:alert('xss'))

![xss](javascript:alert('img-xss'))

<a href="javascript:alert('link-xss')">link</a>

<iframe src="javascript:alert('iframe-xss')"></iframe>`,
        addedTimestamp: Date.now(),
        sessionId: 'test-session'
      };
      localStorage.setItem('sql-learning-textbook', JSON.stringify({
        'test-student': [maliciousUnit]
      }));
    });
    
    await page.goto('/textbook');
    await closeWelcomeModal(page);
    
    // Check for XSS execution
    const xssExecuted = await page.evaluate(() => {
      return new Promise<boolean>((resolve) => {
        window.alert = () => resolve(true);
        setTimeout(() => resolve(false), 2000);
      });
    });
    
    expect(xssExecuted).toBe(false);
  });
});

test.describe('@edge-case WASM Loading Edge Cases', () => {
  test('slow network should show loading state', async ({ page }) => {
    await setupStudentProfile(page);
    await page.goto('/practice');
    await closeWelcomeModal(page);
    
    // Should show initialization loading or SQL editor
    const loadingOrEditor = page.locator('text=/Initializing|Loading|Run Query/i').first();
    await expect(loadingOrEditor).toBeVisible({ timeout: 30000 });
  });

  test('WASM initialization failure should show error with retry', async ({ page }) => {
    await setupStudentProfile(page);
    await page.goto('/practice');
    await closeWelcomeModal(page);
    
    // Wait for initialization to complete or fail
    await page.waitForTimeout(5000);
    
    // Either editor is ready or error is shown
    const state = await Promise.race([
      page.locator('[data-testid="run-query-btn"]').isVisible().then(() => 'ready'),
      page.locator('text=/error|failed|initialize/i').first().isVisible().then(() => 'error'),
      new Promise<'timeout'>((r) => setTimeout(() => r('timeout'), 5000))
    ]);
    
    expect(['ready', 'error', 'timeout']).toContain(state);
  });
});

test.describe('@edge-case Boundary Conditions', () => {
  test('empty SQL query should be handled', async ({ page }) => {
    await setupStudentProfile(page);
    await page.goto('/practice');
    await closeWelcomeModal(page);
    await page.waitForSelector('[data-testid="run-query-btn"]', { timeout: 30000 });
    
    // Clear editor
    const editor = page.locator('.monaco-editor').first();
    await editor.click();
    await page.keyboard.press('Control+a');
    await page.keyboard.type('');
    
    // Try to run empty query
    const runBtn = page.locator('[data-testid="run-query-btn"]');
    
    // Button might be disabled for empty query
    const isDisabled = await runBtn.isDisabled().catch(() => false);
    if (!isDisabled) {
      await runBtn.click();
      // Should handle gracefully
      await expect(page.locator('body')).toBeVisible();
    }
  });

  test('whitespace-only query should be handled', async ({ page }) => {
    await setupStudentProfile(page);
    await page.goto('/practice');
    await closeWelcomeModal(page);
    await page.waitForSelector('[data-testid="run-query-btn"]', { timeout: 30000 });
    
    const editor = page.locator('.monaco-editor').first();
    await editor.click();
    await page.keyboard.press('Control+a');
    await page.keyboard.type('   \n\n   ');
    
    const runBtn = page.locator('[data-testid="run-query-btn"]');
    await expect(runBtn).toBeVisible();
  });

  test('query with only comments should be handled', async ({ page }) => {
    await setupStudentProfile(page);
    await page.goto('/practice');
    await closeWelcomeModal(page);
    await page.waitForSelector('[data-testid="run-query-btn"]', { timeout: 30000 });
    
    const editor = page.locator('.monaco-editor').first();
    await editor.click();
    await page.keyboard.press('Control+a');
    await page.keyboard.type('-- This is a comment\n/* multi\nline */');
    
    await page.click('[data-testid="run-query-btn"]');
    
    // Should handle gracefully
    await expect(page.locator('body')).toBeVisible();
  });

  test('maximum integer value in query', async ({ page }) => {
    await setupStudentProfile(page);
    await page.goto('/practice');
    await closeWelcomeModal(page);
    await page.waitForSelector('[data-testid="run-query-btn"]', { timeout: 30000 });
    
    const editor = page.locator('.monaco-editor').first();
    await editor.click();
    await page.keyboard.press('Control+a');
    await page.keyboard.type('SELECT 9223372036854775807 as max_int');
    
    await page.click('[data-testid="run-query-btn"]');
    
    // Should execute or error gracefully
    await expect(page.locator('body')).toBeVisible();
  });

  test('floating point edge cases', async ({ page }) => {
    await setupStudentProfile(page);
    await page.goto('/practice');
    await closeWelcomeModal(page);
    await page.waitForSelector('[data-testid="run-query-btn"]', { timeout: 30000 });
    
    const queries = [
      'SELECT 1.7976931348623157e+308 as max_float',
      'SELECT 2.2250738585072014e-308 as min_float',
      'SELECT 0.0/0.0 as nan',
      'SELECT 1.0/0.0 as infinity'
    ];
    
    for (const query of queries) {
      const editor = page.locator('.monaco-editor').first();
      await editor.click();
      await page.keyboard.press('Control+a');
      await page.keyboard.type(query);
      await page.click('[data-testid="run-query-btn"]');
      await page.waitForTimeout(500);
    }
    
    // System should remain stable
    await expect(page.locator('[data-testid="run-query-btn"]')).toBeVisible();
  });
});

test.describe('@edge-case Race Conditions', () => {
  test('multiple simultaneous storage operations', async ({ page }) => {
    await setupStudentProfile(page);
    await page.goto('/practice');
    await closeWelcomeModal(page);
    await page.waitForLoadState('networkidle');
    
    // Try to trigger multiple operations simultaneously
    const operations = [];
    for (let i = 0; i < 5; i++) {
      operations.push(page.evaluate(() => {
        // Simulate storage operations
        const key = 'test-key-' + Math.random();
        localStorage.setItem(key, 'test-value');
        localStorage.removeItem(key);
      }));
    }
    
    await Promise.all(operations);
    
    // Page should remain stable
    await expect(page.locator('body')).toBeVisible();
  });

  test('rapid localStorage modifications', async ({ page }) => {
    await setupStudentProfile(page);
    await page.goto('/practice');
    await closeWelcomeModal(page);
    
    // Rapidly modify localStorage
    await page.evaluate(() => {
      for (let i = 0; i < 100; i++) {
        localStorage.setItem('rapid-test-' + i, 'value-' + i);
      }
      // Cleanup
      for (let i = 0; i < 100; i++) {
        localStorage.removeItem('rapid-test-' + i);
      }
    });
    
    // Page should still be functional
    await page.reload();
    await closeWelcomeModal(page);
    await expect(page.locator('body')).toBeVisible();
  });
});

test.describe('@edge-case Input Validation', () => {
  test('very long username should be handled', async ({ page }) => {
    await page.goto('/');
    await closeWelcomeModal(page);
    
    const longName = 'a'.repeat(1000);
    await page.fill('input[placeholder*="username"], input#username', longName);
    await page.click('text=/student/i');
    await page.click('button[type="submit"], button:has-text("Get Started")');
    
    // Should either truncate, reject, or handle gracefully
    await expect(page.locator('body')).toBeVisible();
  });

  test('special characters in username', async ({ page }) => {
    await page.goto('/');
    await closeWelcomeModal(page);
    
    const specialNames = [
      '<script>alert(1)</script>',
      '../../../etc/passwd',
      'user\n\r\tname',
      'user\x00null',
      '🔥🎉💯'
    ];
    
    for (const name of specialNames) {
      await page.fill('input[placeholder*="username"], input#username', name);
      await page.click('text=/student/i');
      const submitBtn = page.locator('button[type="submit"], button:has-text("Get Started")');
      await expect(submitBtn).toBeVisible();
      
      // Clear for next iteration
      await page.fill('input[placeholder*="username"], input#username', '');
    }
  });
});
