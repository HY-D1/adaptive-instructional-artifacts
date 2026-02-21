/**
 * Textbook Content Snapshot Tests
 *
 * Visual regression tests for textbook rendering.
 * These tests capture the rendered HTML output to detect unintended changes.
 *
 * Tags:
 * - @weekly: Part of weekly regression suite
 * - @no-external: Does NOT require Ollama, LLM, or external services
 * - @snapshot: Snapshot/visual regression tests
 */

import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  // Idempotent init script - only runs once per test
  await page.addInitScript(() => {
    const FLAG = '__pw_seeded__';
    if (localStorage.getItem(FLAG) === '1') return;
    
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem('sql-adapt-welcome-seen', 'true');
    // CRITICAL: Set up user profile for role-based auth
    localStorage.setItem('sql-adapt-user-profile', JSON.stringify({
      id: 'learner-1',
      name: 'Test User',
      role: 'student',
      createdAt: Date.now()
    }));
    
    localStorage.setItem(FLAG, '1');
  });
});

test.afterEach(async ({ page }) => {
  await page.evaluate(() => {
    localStorage.removeItem('__pw_seeded__');
  });
});

test.describe('@weekly @no-external @snapshot Textbook Rendering Snapshots', () => {
  test('markdown with headings and lists renders consistently', async ({ page }) => {
    await page.addInitScript(() => {
      // CRITICAL: Set up user profile for role-based auth
      window.localStorage.setItem('sql-adapt-user-profile', JSON.stringify({
        id: 'learner-1',
        name: 'Test User',
        role: 'student',
        createdAt: Date.now()
      }));
      const now = Date.now();
      const unit = {
        id: 'unit-snapshot-headings',
        sessionId: 'session-1',
        type: 'summary',
        conceptId: 'select-basic',
        title: 'Snapshot: Headings and Lists',
        content:
          '# Main Heading\n\n## Sub Heading\n\nThis is a paragraph with **bold** and *italic* text.\n\n### Lists\n\nUnordered list:\n- First item\n- Second item\n  - Nested item\n- Third item\n\nOrdered list:\n1. Step one\n2. Step two\n3. Step three',
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
    await page.getByLabel('Snapshot: Headings and Lists').click();

    // Wait for content to render
    const content = page.locator('.textbook-content, [class*="space-y-4"]').first();
    await expect(content).toBeVisible();

    // Take snapshot of the rendered HTML structure
    const htmlSnapshot = await content.innerHTML();
    expect(htmlSnapshot).toMatchSnapshot('headings-and-lists.html');

    // Verify key elements are present
    await expect(content.locator('h1')).toHaveText('Main Heading');
    await expect(content.locator('h2')).toHaveText('Sub Heading');
    await expect(content.locator('h3')).toHaveText('Lists');
    await expect(content.locator('ul > li')).toHaveCount(4); // 3 main items + 1 nested
    await expect(content.locator('ol > li')).toHaveCount(3);
  });

  test('markdown with code blocks renders consistently', async ({ page }) => {
    await page.addInitScript(() => {
      // CRITICAL: Set up user profile for role-based auth
      window.localStorage.setItem('sql-adapt-user-profile', JSON.stringify({
        id: 'learner-1',
        name: 'Test User',
        role: 'student',
        createdAt: Date.now()
      }));
      const now = Date.now();
      const unit = {
        id: 'unit-snapshot-code',
        sessionId: 'session-1',
        type: 'explanation',
        conceptId: 'select-basic',
        title: 'Snapshot: Code Blocks',
        content:
          '# SQL Examples\n\nInline code: `SELECT * FROM users`\n\nCode block:\n```sql\nSELECT id, name, email\nFROM users\nWHERE status = \'active\'\nORDER BY name ASC;\n```\n\nAnother example:\n```\nGeneric code block\nWith multiple lines\n```\n\nUse the `WHERE` clause to filter results.',
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
    await page.getByLabel('Snapshot: Code Blocks').click();

    const content = page.locator('.textbook-content, [class*="space-y-4"]').first();
    await expect(content).toBeVisible();

    // Take snapshot
    const htmlSnapshot = await content.innerHTML();
    expect(htmlSnapshot).toMatchSnapshot('code-blocks.html');

    // Verify code elements
    await expect(content.locator('pre code').first()).toContainText('SELECT id, name, email');
    await expect(content.locator('code')).toHaveCount(4); // 2 inline + 2 in pre blocks
  });

  test('markdown with blockquotes renders consistently', async ({ page }) => {
    await page.addInitScript(() => {
      // CRITICAL: Set up user profile for role-based auth
      window.localStorage.setItem('sql-adapt-user-profile', JSON.stringify({
        id: 'learner-1',
        name: 'Test User',
        role: 'student',
        createdAt: Date.now()
      }));
      const now = Date.now();
      const unit = {
        id: 'unit-snapshot-quotes',
        sessionId: 'session-1',
        type: 'summary',
        conceptId: 'select-basic',
        title: 'Snapshot: Blockquotes',
        content:
          '# Important Notes\n\n> This is a blockquote with important information.\n> It spans multiple lines.\n\nRegular paragraph here.\n\n> Another quote with **bold** text inside.',
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
    await page.getByLabel('Snapshot: Blockquotes').click();

    const content = page.locator('.textbook-content, [class*="space-y-4"]').first();
    await expect(content).toBeVisible();

    // Take snapshot
    const htmlSnapshot = await content.innerHTML();
    expect(htmlSnapshot).toMatchSnapshot('blockquotes.html');

    // Verify blockquotes
    await expect(content.locator('blockquote')).toHaveCount(2);
  });

  test('legacy HTML content renders consistently', async ({ page }) => {
    await page.addInitScript(() => {
      // CRITICAL: Set up user profile for role-based auth
      window.localStorage.setItem('sql-adapt-user-profile', JSON.stringify({
        id: 'learner-1',
        name: 'Test User',
        role: 'student',
        createdAt: Date.now()
      }));
      const now = Date.now();
      const unit = {
        id: 'unit-snapshot-legacy',
        sessionId: 'session-1',
        type: 'summary',
        conceptId: 'select-basic',
        title: 'Snapshot: Legacy HTML',
        content:
          '<h1>Legacy Content</h1><p>This is a <strong>legacy</strong> HTML unit.</p><ul><li>Item one</li><li>Item two</li></ul>',
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
    await page.getByLabel('Snapshot: Legacy HTML').click();

    const content = page.locator('.textbook-content, [class*="space-y-4"]').first();
    await expect(content).toBeVisible();

    // Take snapshot
    const htmlSnapshot = await content.innerHTML();
    expect(htmlSnapshot).toMatchSnapshot('legacy-html.html');

    // Verify legacy content renders
    await expect(content.locator('h1')).toHaveText('Legacy Content');
    await expect(content.locator('strong')).toHaveText('legacy');
  });

  test('Key Points and Next Steps sections render consistently', async ({ page }) => {
    await page.addInitScript(() => {
      // CRITICAL: Set up user profile for role-based auth
      window.localStorage.setItem('sql-adapt-user-profile', JSON.stringify({
        id: 'learner-1',
        name: 'Test User',
        role: 'student',
        createdAt: Date.now()
      }));
      const now = Date.now();
      const unit = {
        id: 'unit-snapshot-keypoints',
        sessionId: 'session-1',
        type: 'explanation',
        conceptId: 'select-basic',
        title: 'Snapshot: Key Points Section',
        content:
          '# Understanding SELECT\n\nThe SELECT statement retrieves data from tables.\n\n## Key Points\n\n- Always specify columns when possible\n- Use WHERE to filter results\n- ORDER BY sorts the output\n- Avoid SELECT * in production code\n\n## Next Steps\n\n1. Practice writing SELECT queries\n2. Learn about JOIN operations\n3. Study indexing for performance\n\nCommon pitfall: Forgetting to filter large tables can crash your application.',
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
    await page.getByLabel('Snapshot: Key Points Section').click();

    const content = page.locator('.textbook-content, [class*="space-y-4"]').first();
    await expect(content).toBeVisible();

    // Take snapshot
    const htmlSnapshot = await content.innerHTML();
    expect(htmlSnapshot).toMatchSnapshot('key-points-section.html');

    // Verify structure
    await expect(content.locator('h2')).toHaveCount(2);
    await expect(content.locator('h2').nth(0)).toHaveText('Key Points');
    await expect(content.locator('h2').nth(1)).toHaveText('Next Steps');
    await expect(content.locator('ul > li')).toHaveCount(4);
    await expect(content.locator('ol > li')).toHaveCount(3);
  });
});
