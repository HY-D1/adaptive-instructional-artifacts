/**
 * Textbook Content Renderer Tests
 *
 * Tests the markdown → HTML rendering pipeline without external dependencies.
 * These tests verify that content format rules are followed correctly.
 *
 * Tags:
 * - @weekly: Part of weekly regression suite
 * - @no-external: Does NOT require Ollama, LLM, or external services
 * - @textbook: Textbook/rendering specific tests
 */

import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  // Clear storage and set welcome seen
  await page.addInitScript(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    window.localStorage.setItem('sql-adapt-welcome-seen', 'true');
  });
});

test.describe('@weekly @no-external @textbook Textbook Content Rendering', () => {
  test('renders markdown content correctly', async ({ page }) => {
    // Seed localStorage with a markdown unit
    await page.addInitScript(() => {
      const now = Date.now();
      const unit = {
        id: 'unit-markdown-test',
        sessionId: 'session-1',
        type: 'summary',
        conceptId: 'select-basic',
        title: 'Markdown Test Unit',
        content: '# Hello World\n\nThis is **bold** and `code`.\n\n- Item 1\n- Item 2',
        contentFormat: 'markdown',
        addedTimestamp: now,
        sourceInteractionIds: ['evt-1'],
        prerequisites: []
      };

      window.localStorage.setItem(
        'sql-adapt-textbook',
        JSON.stringify({ 'learner-1': [unit] })
      );

      // Also set up a profile
      window.localStorage.setItem(
        'sql-adapt-profiles',
        JSON.stringify([
          {
            id: 'learner-1',
            name: 'Test User',
            currentStrategy: 'adaptive-medium',
            conceptMastery: {},
            totalStudyTime: 0,
            createdAt: now
          }
        ])
      );
    });

    // Navigate to textbook
    await page.goto('/textbook?learnerId=learner-1');

    // Verify unit title is visible
    await expect(page.getByRole('heading', { name: 'Markdown Test Unit' })).toBeVisible();

    // Click on the unit to view content
    await page.getByRole('button', { name: 'Markdown Test Unit' }).click();

    // Verify rendered content (should have proper HTML, not raw markdown)
    const content = page.locator('.textbook-content, [class*="space-y-4"]').first();

    // Should have h1 for the heading
    await expect(content.locator('h1')).toHaveText('Hello World');

    // Should have bold text
    await expect(content.locator('strong')).toHaveText('bold');

    // Should have code inline
    await expect(content.locator('code')).toContainText('code');

    // Should have list items (not raw "- Item 1" text)
    const listItems = content.locator('li');
    await expect(listItems).toHaveCount(2);
    await expect(listItems.nth(0)).toHaveText('Item 1');
    await expect(listItems.nth(1)).toHaveText('Item 2');

    // Should NOT contain raw markdown syntax
    const htmlContent = await content.innerHTML();
    expect(htmlContent).not.toContain('# Hello World');
    expect(htmlContent).not.toContain('**bold**');
    expect(htmlContent).not.toContain('- Item 1');
  });

  test('renders legacy HTML content correctly', async ({ page }) => {
    // Seed localStorage with an HTML unit (legacy format)
    await page.addInitScript(() => {
      const now = Date.now();
      const unit = {
        id: 'unit-html-test',
        sessionId: 'session-1',
        type: 'summary',
        conceptId: 'select-basic',
        title: 'HTML Test Unit',
        content: '<p>Legacy paragraph with <strong>bold</strong> text.</p><ul><li>Legacy item</li></ul>',
        contentFormat: 'html',
        addedTimestamp: now,
        sourceInteractionIds: ['evt-1'],
        prerequisites: []
      };

      window.localStorage.setItem(
        'sql-adapt-textbook',
        JSON.stringify({ 'learner-1': [unit] })
      );

      window.localStorage.setItem(
        'sql-adapt-profiles',
        JSON.stringify([
          {
            id: 'learner-1',
            name: 'Test User',
            currentStrategy: 'adaptive-medium',
            conceptMastery: {},
            totalStudyTime: 0,
            createdAt: now
          }
        ])
      );
    });

    await page.goto('/textbook?learnerId=learner-1');
    await expect(page.getByRole('heading', { name: 'HTML Test Unit' })).toBeVisible();

    await page.getByRole('button', { name: 'HTML Test Unit' }).click();

    const content = page.locator('.textbook-content, [class*="space-y-4"]').first();

    // Should display the HTML content (sanitized but preserved)
    await expect(content.locator('p')).toContainText('Legacy paragraph with');
    await expect(content.locator('strong')).toHaveText('bold');
    await expect(content.locator('li')).toHaveText('Legacy item');
  });

  test('sanitizes malicious content in markdown', async ({ page }) => {
    await page.addInitScript(() => {
      const now = Date.now();
      const unit = {
        id: 'unit-xss-test',
        sessionId: 'session-1',
        type: 'summary',
        conceptId: 'select-basic',
        title: 'XSS Test Unit',
        // Try to inject script tag in markdown
        content: '# Safe Content\n\n<script>alert("xss")</script>\n\n[Link](javascript:alert("xss"))',
        contentFormat: 'markdown',
        addedTimestamp: now,
        sourceInteractionIds: ['evt-1'],
        prerequisites: []
      };

      window.localStorage.setItem(
        'sql-adapt-textbook',
        JSON.stringify({ 'learner-1': [unit] })
      );

      window.localStorage.setItem(
        'sql-adapt-profiles',
        JSON.stringify([
          {
            id: 'learner-1',
            name: 'Test User',
            currentStrategy: 'adaptive-medium',
            conceptMastery: {},
            totalStudyTime: 0,
            createdAt: now
          }
        ])
      );
    });

    await page.goto('/textbook?learnerId=learner-1');
    await page.getByRole('button', { name: 'XSS Test Unit' }).click();

    const content = page.locator('.textbook-content, [class*="space-y-4"]').first;

    // Script tags should be removed or escaped
    const htmlContent = await content.innerHTML();
    expect(htmlContent).not.toContain('<script>');
    expect(htmlContent).not.toContain('javascript:alert');

    // But safe content should still render
    await expect(content.locator('h1')).toHaveText('Safe Content');
  });

  test('code blocks render correctly in markdown', async ({ page }) => {
    await page.addInitScript(() => {
      const now = Date.now();
      const unit = {
        id: 'unit-code-test',
        sessionId: 'session-1',
        type: 'explanation',
        conceptId: 'select-basic',
        title: 'Code Block Test',
        content:
          '## SQL Example\n\n```sql\nSELECT * FROM users\nWHERE id = 1;\n```\n\nInline `column` reference.',
        contentFormat: 'markdown',
        addedTimestamp: now,
        sourceInteractionIds: ['evt-1'],
        prerequisites: []
      };

      window.localStorage.setItem(
        'sql-adapt-textbook',
        JSON.stringify({ 'learner-1': [unit] })
      );

      window.localStorage.setItem(
        'sql-adapt-profiles',
        JSON.stringify([
          {
            id: 'learner-1',
            name: 'Test User',
            currentStrategy: 'adaptive-medium',
            conceptMastery: {},
            totalStudyTime: 0,
            createdAt: now
          }
        ])
      );
    });

    await page.goto('/textbook?learnerId=learner-1');
    await page.getByRole('button', { name: 'Code Block Test' }).click();

    const content = page.locator('.textbook-content, [class*="space-y-4"]').first();

    // Should have code block
    const codeBlock = content.locator('pre code');
    await expect(codeBlock).toBeVisible();
    await expect(codeBlock).toContainText('SELECT * FROM users');

    // Should have inline code
    const inlineCodes = content.locator('code');
    await expect(inlineCodes).toHaveCount(2); // one in pre, one inline
  });
});
