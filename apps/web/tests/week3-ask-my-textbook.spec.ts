/**
 * Week 3 Ask My Textbook Chat Tests
 * 
 * Covers: D7 (Chat UI), D8 (Chat Events)
 * - Quick chip responses
 * - Source grounding
 * - Wrong result detection
 * - Event logging
 */

import { expect, test } from '@playwright/test';

test.describe('@weekly Week 3 Ask My Textbook', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.clear();
      window.sessionStorage.clear();
      window.localStorage.setItem('sql-adapt-welcome-seen', 'true');
    });
  });

  test.afterEach(async ({ page }) => {
    await page.evaluate(() => {
      window.localStorage.clear();
      window.sessionStorage.clear();
    });
  });

  test('chat panel opens and shows quick chips', async ({ page }) => {
    await page.goto('/');
    
    // Setup learner
    await page.evaluate(() => {
      const profiles = [{
        id: 'test-learner',
        name: 'Test Learner',
        createdAt: Date.now()
      }];
      window.localStorage.setItem('sql-learning-profiles', JSON.stringify(profiles));
      window.localStorage.setItem('sql-learning-active-session', 'test-session');
    });
    await page.reload();

    // Verify quick chips visible
    await expect(page.getByRole('button', { name: 'Explain my last error' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Show a minimal example' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'What concept is this?' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Give me a hint' })).toBeVisible();
  });

  test('explain my last error - detects SQL errors', async ({ page }) => {
    await page.goto('/');
    
    await page.evaluate(() => {
      const profiles = [{
        id: 'test-learner',
        name: 'Test Learner',
        createdAt: Date.now()
      }];
      window.localStorage.setItem('sql-learning-profiles', JSON.stringify(profiles));
      window.localStorage.setItem('sql-learning-active-session', 'test-session');
    });
    await page.reload();

    // Trigger SQL error
    await page.locator('.monaco-editor .view-lines').first().click();
    await page.keyboard.type('SELECT FROM users;');
    await page.getByRole('button', { name: 'Run Query' }).click();
    await expect(page.locator('text=SQL Error')).toBeVisible();

    // Click explain error chip
    await page.getByRole('button', { name: 'Explain my last error' }).click();

    // Verify response appears
    await expect(page.locator('.bg-white.border').filter({ hasText: /Fix:|Error:/ }).first()).toBeVisible();
  });

  test('explain my last error - detects wrong result submissions', async ({ page }) => {
    await page.goto('/');
    
    await page.evaluate(() => {
      const profiles = [{
        id: 'test-learner',
        name: 'Test Learner',
        createdAt: Date.now()
      }];
      window.localStorage.setItem('sql-learning-profiles', JSON.stringify(profiles));
      window.localStorage.setItem('sql-learning-active-session', 'test-session');
    });
    await page.reload();

    // Submit query that runs but returns wrong results
    await page.locator('.monaco-editor .view-lines').first().click();
    await page.keyboard.type('SELECT id FROM users;'); // Missing columns
    await page.getByRole('button', { name: 'Run Query' }).click();
    
    // Wait for result (may show "Not quite right")
    await page.waitForTimeout(1000);

    // Click explain error chip
    await page.getByRole('button', { name: 'Explain my last error' }).click();

    // Verify response appears (should detect the wrong result)
    await expect(page.locator('.bg-white.border').filter({ hasText: /Issue:|Fix:/ }).first()).toBeVisible();
  });

  test('show minimal example - provides SQL pattern', async ({ page }) => {
    await page.goto('/');
    
    await page.evaluate(() => {
      const profiles = [{
        id: 'test-learner',
        name: 'Test Learner',
        createdAt: Date.now()
      }];
      window.localStorage.setItem('sql-learning-profiles', JSON.stringify(profiles));
      window.localStorage.setItem('sql-learning-active-session', 'test-session');
      
      // Seed textbook with example
      window.localStorage.setItem('sql-learning-textbook', JSON.stringify({
        'test-learner': [{
          id: 'unit-1',
          type: 'summary',
          conceptId: 'select-basic',
          title: 'SELECT Basics',
          content: 'Basic SELECT statement',
          minimalExample: 'SELECT * FROM users;',
          addedTimestamp: Date.now()
        }]
      }));
    });
    await page.reload();

    // Click show example chip
    await page.getByRole('button', { name: 'Show a minimal example' }).click();

    // Verify SQL example in response
    const response = page.locator('.bg-white.border').last();
    await expect(response.locator('code')).toBeVisible();
  });

  test('what concept - shows current problem concepts', async ({ page }) => {
    await page.goto('/');
    
    await page.evaluate(() => {
      const profiles = [{
        id: 'test-learner',
        name: 'Test Learner',
        createdAt: Date.now()
      }];
      window.localStorage.setItem('sql-learning-profiles', JSON.stringify(profiles));
      window.localStorage.setItem('sql-learning-active-session', 'test-session');
    });
    await page.reload();

    // Click what concept chip
    await page.getByRole('button', { name: 'What concept is this?' }).click();

    // Verify concept info appears
    await expect(page.locator('.bg-white.border').filter({ hasText: /Key concept|Concept:/ }).first()).toBeVisible();
  });

  test('give me a hint - provides contextual hint', async ({ page }) => {
    await page.goto('/');
    
    await page.evaluate(() => {
      const profiles = [{
        id: 'test-learner',
        name: 'Test Learner',
        createdAt: Date.now()
      }];
      window.localStorage.setItem('sql-learning-profiles', JSON.stringify(profiles));
      window.localStorage.setItem('sql-learning-active-session', 'test-session');
      
      // Seed textbook
      window.localStorage.setItem('sql-learning-textbook', JSON.stringify({
        'test-learner': [{
          id: 'unit-1',
          type: 'summary',
          conceptId: 'select-basic',
          title: 'SELECT Help',
          content: 'Help content',
          summary: 'Start with SELECT clause',
          addedTimestamp: Date.now()
        }]
      }));
    });
    await page.reload();

    // Click give hint chip
    await page.getByRole('button', { name: 'Give me a hint' }).click();

    // Verify hint response
    await expect(page.locator('.bg-white.border').filter({ hasText: /Hint:/ }).first()).toBeVisible();
  });

  test('chat interaction events logged', async ({ page }) => {
    await page.goto('/');
    
    await page.evaluate(() => {
      const profiles = [{
        id: 'test-learner',
        name: 'Test Learner',
        createdAt: Date.now()
      }];
      window.localStorage.setItem('sql-learning-profiles', JSON.stringify(profiles));
      window.localStorage.setItem('sql-learning-active-session', 'test-session');
    });
    await page.reload();

    // Click a quick chip
    await page.getByRole('button', { name: 'What concept is this?' }).click();

    // Verify chat_interaction event logged
    const events = await page.evaluate(() => {
      const interactions = JSON.parse(
        window.localStorage.getItem('sql-learning-interactions') || '[]'
      );
      return interactions.filter((e: any) => e.eventType === 'chat_interaction');
    });
    
    expect(events.length).toBeGreaterThanOrEqual(1);
    expect(events[0]).toHaveProperty('chatMessage');
    expect(events[0]).toHaveProperty('chatResponse');
  });

  test('sources displayed with response', async ({ page }) => {
    await page.goto('/');
    
    await page.evaluate(() => {
      const profiles = [{
        id: 'test-learner',
        name: 'Test Learner',
        createdAt: Date.now()
      }];
      window.localStorage.setItem('sql-learning-profiles', JSON.stringify(profiles));
      window.localStorage.setItem('sql-learning-active-session', 'test-session');
      
      // Seed textbook
      window.localStorage.setItem('sql-learning-textbook', JSON.stringify({
        'test-learner': [{
          id: 'unit-1',
          type: 'summary',
          conceptId: 'select-basic',
          title: 'SELECT Basics',
          content: 'Content',
          addedTimestamp: Date.now()
        }]
      }));
    });
    await page.reload();

    // Click quick chip
    await page.getByRole('button', { name: 'Give me a hint' }).click();

    // Verify source indicator appears
    await expect(page.locator('.bg-white.border').filter({ hasText: /Grounded in/ }).first()).toBeVisible();
  });

  test('save to notes button appears on responses', async ({ page }) => {
    await page.goto('/');
    
    await page.evaluate(() => {
      const profiles = [{
        id: 'test-learner',
        name: 'Test Learner',
        createdAt: Date.now()
      }];
      window.localStorage.setItem('sql-learning-profiles', JSON.stringify(profiles));
      window.localStorage.setItem('sql-learning-active-session', 'test-session');
    });
    await page.reload();

    // Click quick chip
    await page.getByRole('button', { name: 'What concept is this?' }).click();

    // Verify save button appears
    await expect(page.getByRole('button', { name: /Save to My Notes/ }).first()).toBeVisible();
  });

  test('auto-save: high-quality responses are saved to textbook', async ({ page }) => {
    await page.goto('/');
    
    await page.evaluate(() => {
      const profiles = [{
        id: 'test-learner',
        name: 'Test Learner',
        createdAt: Date.now()
      }];
      window.localStorage.setItem('sql-learning-profiles', JSON.stringify(profiles));
      window.localStorage.setItem('sql-learning-active-session', 'test-session');
      
      // Seed textbook with multiple sources for quality scoring
      window.localStorage.setItem('sql-learning-textbook', JSON.stringify({
        'test-learner': [
          {
            id: 'unit-1',
            type: 'summary',
            conceptId: 'select-basic',
            title: 'SELECT Basics',
            content: 'Content about SELECT',
            summary: 'This is a comprehensive summary about SELECT statements that provides detailed explanation.',
            minimalExample: 'SELECT id, name FROM users;',
            addedTimestamp: Date.now()
          },
          {
            id: 'unit-2',
            type: 'summary',
            conceptId: 'where-clause',
            title: 'WHERE Clause',
            content: 'Content about WHERE',
            summary: 'Detailed WHERE clause explanation with examples and common patterns.',
            addedTimestamp: Date.now()
          }
        ]
      }));
    });
    await page.reload();

    // Trigger an error first to get a high-quality error explanation
    await page.locator('.monaco-editor .view-lines').first().click();
    await page.keyboard.type('SELECT FROM users;');
    await page.getByRole('button', { name: 'Run Query' }).click();
    await expect(page.locator('text=SQL Error')).toBeVisible();

    // Click explain error chip (should auto-save with quality >= 0.7)
    await page.getByRole('button', { name: 'Explain my last error' }).click();

    // Wait for response and auto-save
    await page.waitForTimeout(1000);

    // Verify textbook_add event was logged
    const events = await page.evaluate(() => {
      const interactions = JSON.parse(
        window.localStorage.getItem('sql-learning-interactions') || '[]'
      );
      return interactions.filter((e: any) => e.eventType === 'textbook_add');
    });
    
    expect(events.length).toBeGreaterThanOrEqual(1);
    expect(events[0]).toHaveProperty('unitId');
    expect(events[0]).toHaveProperty('conceptIds');

    // Verify textbook unit was created
    const textbook = await page.evaluate(() => {
      const textbooks = JSON.parse(
        window.localStorage.getItem('sql-learning-textbook') || '{}'
      );
      return textbooks['test-learner'] || [];
    });
    
    // Should have original 2 units + 1 auto-saved unit
    expect(textbook.length).toBeGreaterThanOrEqual(3);
  });

  test('auto-save: prevents duplicate saves for same query', async ({ page }) => {
    await page.goto('/');
    
    await page.evaluate(() => {
      const profiles = [{
        id: 'test-learner',
        name: 'Test Learner',
        createdAt: Date.now()
      }];
      window.localStorage.setItem('sql-learning-profiles', JSON.stringify(profiles));
      window.localStorage.setItem('sql-learning-active-session', 'test-session');
      
      // Seed textbook
      window.localStorage.setItem('sql-learning-textbook', JSON.stringify({
        'test-learner': [
          {
            id: 'unit-1',
            type: 'summary',
            conceptId: 'select-basic',
            title: 'SELECT Basics',
            content: 'Content',
            summary: 'Detailed summary with enough content to pass quality threshold.',
            addedTimestamp: Date.now()
          },
          {
            id: 'unit-2',
            type: 'summary',
            conceptId: 'where-clause',
            title: 'WHERE Basics',
            content: 'Content',
            summary: 'Another detailed summary for WHERE clause concepts.',
            addedTimestamp: Date.now()
          }
        ]
      }));
    });
    await page.reload();

    // Click same quick chip twice
    await page.getByRole('button', { name: 'What concept is this?' }).click();
    await page.waitForTimeout(600);
    await page.getByRole('button', { name: 'What concept is this?' }).click();
    await page.waitForTimeout(600);

    // Count textbook_add events
    const addEvents = await page.evaluate(() => {
      const interactions = JSON.parse(
        window.localStorage.getItem('sql-learning-interactions') || '[]'
      );
      return interactions.filter((e: any) => e.eventType === 'textbook_add');
    });
    
    // Should only have 1 auto-save event (not 2)
    expect(addEvents.length).toBe(1);
  });

  test('auto-save: shows toast notification when saved', async ({ page }) => {
    await page.goto('/');
    
    await page.evaluate(() => {
      const profiles = [{
        id: 'test-learner',
        name: 'Test Learner',
        createdAt: Date.now()
      }];
      window.localStorage.setItem('sql-learning-profiles', JSON.stringify(profiles));
      window.localStorage.setItem('sql-learning-active-session', 'test-session');
      
      // Seed textbook with sources
      window.localStorage.setItem('sql-learning-textbook', JSON.stringify({
        'test-learner': [
          {
            id: 'unit-1',
            type: 'summary',
            conceptId: 'select-basic',
            title: 'SELECT Basics',
            content: 'Content with comprehensive details.',
            summary: 'Detailed SELECT explanation that is long enough for auto-save.',
            minimalExample: 'SELECT * FROM table;',
            addedTimestamp: Date.now()
          },
          {
            id: 'unit-2',
            type: 'summary',
            conceptId: 'joins',
            title: 'JOIN Basics',
            content: 'Join content.',
            summary: 'JOIN explanation with examples and best practices.',
            addedTimestamp: Date.now()
          }
        ]
      }));
    });
    await page.reload();

    // Trigger an error to get quality response
    await page.locator('.monaco-editor .view-lines').first().click();
    await page.keyboard.type('SELECT FROM users;');
    await page.getByRole('button', { name: 'Run Query' }).click();
    await expect(page.locator('text=SQL Error')).toBeVisible();

    // Click explain error
    await page.getByRole('button', { name: 'Explain my last error' }).click();

    // Verify toast appears
    await expect(page.locator('text=Saved to My Textbook')).toBeVisible();
  });

  test('auto-save: shows auto-saved badge on message', async ({ page }) => {
    await page.goto('/');
    
    await page.evaluate(() => {
      const profiles = [{
        id: 'test-learner',
        name: 'Test Learner',
        createdAt: Date.now()
      }];
      window.localStorage.setItem('sql-learning-profiles', JSON.stringify(profiles));
      window.localStorage.setItem('sql-learning-active-session', 'test-session');
      
      // Seed textbook
      window.localStorage.setItem('sql-learning-textbook', JSON.stringify({
        'test-learner': [
          {
            id: 'unit-1',
            type: 'summary',
            conceptId: 'select-basic',
            title: 'SELECT Basics',
            content: 'Content',
            summary: 'Detailed summary that is comprehensive enough for auto-save.',
            addedTimestamp: Date.now()
          },
          {
            id: 'unit-2',
            type: 'summary',
            conceptId: 'where-clause',
            title: 'WHERE Basics',
            content: 'Content',
            summary: 'Another comprehensive summary for WHERE.',
            addedTimestamp: Date.now()
          }
        ]
      }));
    });
    await page.reload();

    // Trigger an error
    await page.locator('.monaco-editor .view-lines').first().click();
    await page.keyboard.type('SELECT FROM users;');
    await page.getByRole('button', { name: 'Run Query' }).click();
    await expect(page.locator('text=SQL Error')).toBeVisible();

    // Click explain error
    await page.getByRole('button', { name: 'Explain my last error' }).click();
    await page.waitForTimeout(800);

    // Verify auto-saved badge appears on the response
    await expect(page.locator('text=Auto-saved').first()).toBeVisible();
  });
});
