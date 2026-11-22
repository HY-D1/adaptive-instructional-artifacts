/**
 * UX-5: Saved Notes Quality, Textbook Discoverability, and Ask My Textbook Usefulness
 * Browser evaluation script - captures actual learner-facing UI behavior
 *
 * Run with: npx playwright test tests/e2e/ux-5-note-quality.spec.ts
 */

import { expect, test } from '@playwright/test';
import { replaceEditorText } from '../helpers/test-helpers';

// Stub LLM calls to prevent ECONNREFUSED errors
test.beforeEach(async ({ page }) => {
  await page.route('**/ollama/api/generate', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        response: JSON.stringify({
          title: 'Understanding WHERE Clause Placement',
          content_markdown: `The WHERE clause filters rows before grouping. Common mistake: putting WHERE after GROUP BY.\n\n**Key Concept:** WHERE filters individual rows; HAVING filters grouped results.`,
          key_points: [
            'WHERE filters rows before aggregation',
            'WHERE comes before GROUP BY in query order',
            'Use single quotes for string comparisons'
          ],
          common_pitfall: 'Forgetting quotes around string values like WHERE department = Engineering',
          next_steps: [
            'Practice WHERE clauses with string comparisons',
            'Review the difference between WHERE and HAVING'
          ],
          source_ids: ['sql-engage:10']
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
          title: 'Understanding WHERE Clause Placement',
          content_markdown: `The WHERE clause filters rows before grouping.`,
          key_points: ['WHERE filters rows before aggregation'],
          common_pitfall: 'Forgetting quotes around string values',
          next_steps: ['Practice WHERE clauses with string comparisons'],
          source_ids: ['sql-engage:10']
        })
      })
    });
  });
});

test.describe('@ux5 Note Quality and Textbook Usefulness', () => {

  /**
   * Flow A: Solve and save a useful note
   */
  test('Flow A: Solve and save a useful note', async ({ page }) => {
    // Setup: Student profile and clean state
    await page.addInitScript(() => {
      window.localStorage.clear();
      window.sessionStorage.clear();
      window.localStorage.setItem('sql-adapt-welcome-seen', 'true');
      window.localStorage.setItem('sql-adapt-user-profile', JSON.stringify({
        id: 'ux5-test-user',
        name: 'UX Test User',
        role: 'student',
        createdAt: Date.now()
      }));
    });

    // Navigate to practice
    await page.goto('/');
    await expect(page).toHaveURL(/\/practice/, { timeout: 30000 });

    // Wait for SQL engine to initialize
    await expect.poll(async () => {
      const button = page.getByRole('button', { name: 'Run Query' });
      return await button.isEnabled().catch(() => false);
    }, { timeout: 30000, intervals: [500] }).toBe(true);

    // Make a wrong attempt (typo in column name)
    await replaceEditorText(page, `SELECT first_name, last_name, salary
FROM employees
WHERE department = Engineering AND salary > 80000`);

    await page.getByRole('button', { name: 'Run Query' }).click();
    await page.waitForTimeout(1500);

    // Request help
    const helpButton = page.getByRole('button', { name: /Get Help/i });
    if (await helpButton.isVisible().catch(() => false)) {
      await helpButton.click();
      await page.waitForTimeout(2000);
    }

    // Enter correct solution
    await replaceEditorText(page, `SELECT first_name, last_name, salary
FROM employees
WHERE department = 'Engineering' AND salary > 80000`);

    await page.getByRole('button', { name: 'Run Query' }).click();
    await page.waitForTimeout(2000);

    // Click Save to Notes
    const saveButton = page.getByRole('button', { name: /Save to Notes/i });
    const saveButtonVisible = await saveButton.isVisible({ timeout: 5000 }).catch(() => false);
    console.log('Flow A - Save to Notes button visible:', saveButtonVisible);

    if (saveButtonVisible) {
      await saveButton.click();
      await page.waitForTimeout(1500);
    }

    // Navigate to My Textbook
    await page.getByRole('link', { name: 'My Textbook' }).first().click();
    await expect(page).toHaveURL(/\/textbook/, { timeout: 10000 });
    await page.waitForTimeout(2000);

    // Check for note in textbook
    const noteHeading = page.getByRole('heading', { level: 2 });
    const noteVisible = await noteHeading.isVisible().catch(() => false);
    const noteTitle = noteVisible ? await noteHeading.textContent() : 'No note found';
    console.log('Flow A - Note title in textbook:', noteTitle);

    // Take screenshot for manual review
    await page.screenshot({ path: 'test-results/flow-a-textbook.png', fullPage: true });

    // Verify note is useful for later review
    expect(noteTitle).not.toContain('Auto-saved');
    expect(noteTitle).not.toBe('Help with');
  });

  /**
   * Flow B: Review saved notes as a learner
   */
  test('Flow B: Review saved notes as a learner', async ({ page }) => {
    const now = Date.now();

    // Setup with seeded textbook content to evaluate
    await page.addInitScript((timestamp) => {
      window.localStorage.clear();
      window.sessionStorage.clear();
      window.localStorage.setItem('sql-adapt-welcome-seen', 'true');
      window.localStorage.setItem('sql-adapt-user-profile', JSON.stringify({
        id: 'ux5-learner',
        name: 'Test Learner',
        role: 'student',
        createdAt: timestamp
      }));

      // Seed multiple textbook units with various title quality levels
      const seededUnits = [
        {
          id: 'unit-generic-1',
          sessionId: 'session-1',
          type: 'summary',
          conceptId: 'select-basic',
          title: 'Help with',  // GENERIC - should be improved
          content: '## Key Points\n- WHERE filters rows\n- GROUP BY comes after WHERE',
          addedTimestamp: timestamp - 86400000,
          sourceInteractionIds: ['evt-1'],
          provenance: { model: 'test', templateId: 'test.v1', createdAt: timestamp }
        },
        {
          id: 'unit-specific-1',
          sessionId: 'session-1',
          type: 'explanation',
          conceptId: 'where-clause',
          title: 'WHERE Clause String Quoting',  // SPECIFIC - good
          content: `## Understanding WHERE with Strings
When filtering by string values in SQL, you must use single quotes around the value.

**Example:**
\`\`\`sql
SELECT * FROM employees WHERE department = 'Engineering'
\`\`\`

## Key Points
- String literals need single quotes: 'value'
- Column names never use quotes
- WHERE filters rows before any grouping

## Next Steps
1. Practice writing WHERE clauses with string comparisons
2. Review error messages when quotes are missing`,
          addedTimestamp: timestamp - 172800000,
          sourceInteractionIds: ['evt-2'],
          provenance: { model: 'test', templateId: 'test.v1', createdAt: timestamp }
        },
        {
          id: 'unit-auto-1',
          sessionId: 'session-1',
          type: 'summary',
          conceptId: 'join-basic',
          title: 'Auto-saved from chat',  // GENERIC auto-save title
          content: 'This note was automatically saved from your chat conversation.',
          addedTimestamp: timestamp - 3600000,
          sourceInteractionIds: ['evt-3'],
          autoCreated: true,
          provenance: { model: 'test', templateId: 'test.v1', createdAt: timestamp }
        }
      ];

      window.localStorage.setItem(
        'sql-learning-textbook',
        JSON.stringify({ 'ux5-learner': seededUnits })
      );
    }, now);

    // Navigate to textbook
    await page.goto('/');
    await expect(page).toHaveURL(/\/practice/, { timeout: 30000 });

    await page.getByRole('link', { name: 'My Textbook' }).first().click();
    await expect(page).toHaveURL(/\/textbook/, { timeout: 10000 });
    await page.waitForTimeout(2000);

    // Evaluate note list scannability
    const headings = await page.locator('h2, h3, button').allTextContents();
    const noteTitles = headings.filter(h =>
      h.length > 3 &&
      (h.toLowerCase().includes('help') ||
       h.toLowerCase().includes('where') ||
       h.toLowerCase().includes('join') ||
       h.toLowerCase().includes('auto'))
    );

    console.log('Flow B - Note titles in textbook:', noteTitles);

    // Check for generic titles
    const genericTitles = noteTitles.filter(t =>
      t.toLowerCase().includes('auto-saved') ||
      t.toLowerCase() === 'help with' ||
      t.toLowerCase().includes('untitled')
    );
    console.log('Flow B - Generic titles found:', genericTitles.length, genericTitles);

    // Check note content quality
    const firstNoteButton = page.locator('button').filter({ hasText: /WHERE|help/i }).first();
    if (await firstNoteButton.isVisible().catch(() => false)) {
      await firstNoteButton.click();
      await page.waitForTimeout(1000);

      const content = await page.locator('.prose, .content').first().textContent().catch(() => '');
      console.log('Flow B - First note content preview:', content.substring(0, 300));

      // Check for key elements that make notes useful
      const hasKeyPoints = content.toLowerCase().includes('key points');
      const hasNextSteps = content.toLowerCase().includes('next steps');
      const hasExample = content.includes('```sql');

      console.log('Flow B - Note quality indicators:', {
        hasKeyPoints,
        hasNextSteps,
        hasExample
      });
    }

    await page.screenshot({ path: 'test-results/flow-b-textbook-review.png', fullPage: true });
  });

  /**
   * Flow C: Ask My Textbook usefulness
   */
  test('Flow C: Ask My Textbook usefulness', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.clear();
      window.sessionStorage.clear();
      window.localStorage.setItem('sql-adapt-welcome-seen', 'true');
      window.localStorage.setItem('sql-adapt-user-profile', JSON.stringify({
        id: 'ux5-chat-user',
        name: 'Chat Test User',
        role: 'student',
        createdAt: Date.now()
      }));
    });

    await page.goto('/');
    await expect(page).toHaveURL(/\/practice/, { timeout: 30000 });
    await page.waitForTimeout(2000);

    // Look for Ask My Textbook chat panel
    const chatInput = page.locator('input[placeholder*="Ask"], textarea[placeholder*="Ask"]').first();
    const chatVisible = await chatInput.isVisible().catch(() => false);

    console.log('Flow C - Ask My Textbook chat visible:', chatVisible);

    if (chatVisible) {
      // Test question 1
      await chatInput.fill('Why did my WHERE query fail?');
      await chatInput.press('Enter');
      await page.waitForTimeout(3000);

      // Check response quality
      const response = await page.locator('.message, .chat-response, [class*="response"]').last().textContent().catch(() => '');
      console.log('Flow C - Response to WHERE query:', response.substring(0, 300));

      // Check if response has actionable advice
      const hasActionableAdvice =
        response.toLowerCase().includes('quote') ||
        response.toLowerCase().includes('syntax') ||
        response.toLowerCase().includes('try');

      console.log('Flow C - Response has actionable advice:', hasActionableAdvice);

      // Check for Save button on chat response
      const chatSaveButton = page.getByRole('button', { name: /save|add to notes/i }).first();
      const canSaveChat = await chatSaveButton.isVisible().catch(() => false);
      console.log('Flow C - Can save chat response:', canSaveChat);
    } else {
      console.log('Flow C - Ask My Textbook chat not visible - feature may be collapsed or disabled');
    }

    await page.screenshot({ path: 'test-results/flow-c-ask-textbook.png', fullPage: true });
  });

  /**
   * Flow D: Post-solve continuation
   */
  test('Flow D: Post-solve continuation guidance', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.clear();
      window.sessionStorage.clear();
      window.localStorage.setItem('sql-adapt-welcome-seen', 'true');
      window.localStorage.setItem('sql-adapt-user-profile', JSON.stringify({
        id: 'ux5-postsolve-user',
        name: 'Post-solve Test User',
        role: 'student',
        createdAt: Date.now()
      }));
    });

    await page.goto('/');
    await expect(page).toHaveURL(/\/practice/, { timeout: 30000 });

    await expect.poll(async () => {
      const button = page.getByRole('button', { name: 'Run Query' });
      return await button.isEnabled().catch(() => false);
    }, { timeout: 30000, intervals: [500] }).toBe(true);

    // Solve the problem
    await replaceEditorText(page, `SELECT first_name, last_name, salary
FROM employees
WHERE department = 'Engineering' AND salary > 80000`);

    await page.getByRole('button', { name: 'Run Query' }).click();
    await page.waitForTimeout(2000);

    // Check what next-step guidance is visible
    const nextProblemButton = page.getByRole('button', { name: /next problem/i });
    const reviewNotesButton = page.getByRole('button', { name: /review|view notes/i });
    const saveNotesButton = page.getByRole('button', { name: /save to notes/i });
    const askTextbookButton = page.getByRole('button', { name: /ask textbook/i });

    const guidanceOptions = {
      nextProblem: await nextProblemButton.isVisible().catch(() => false),
      reviewNotes: await reviewNotesButton.isVisible().catch(() => false),
      saveNotes: await saveNotesButton.isVisible().catch(() => false),
      askTextbook: await askTextbookButton.isVisible().catch(() => false)
    };

    console.log('Flow D - Post-solve guidance options:', guidanceOptions);

    // Check for success message
    const successText = await page.locator('text=/solved|success|correct|great job/i').first().textContent().catch(() => 'No success message');
    console.log('Flow D - Success message:', successText);

    // Check if there's any explicit "What to do next" guidance
    const nextStepText = await page.locator('text=/next|continue|try|practice/i').first().textContent().catch(() => 'No next step guidance');
    console.log('Flow D - Next step text:', nextStepText);

    await page.screenshot({ path: 'test-results/flow-d-post-solve.png', fullPage: true });
  });

  /**
   * Comprehensive UX Audit
   */
  test('UX Audit: Full learner journey evaluation', async ({ page }) => {
    const audit: Record<string, unknown> = {};
    const now = Date.now();

    // Setup with realistic seeded data
    await page.addInitScript((timestamp) => {
      window.localStorage.clear();
      window.sessionStorage.clear();
      window.localStorage.setItem('sql-adapt-welcome-seen', 'true');
      window.localStorage.setItem('sql-adapt-user-profile', JSON.stringify({
        id: 'ux5-audit-user',
        name: 'Audit Test User',
        role: 'student',
        createdAt: timestamp
      }));

      // Seed realistic textbook content
      const seededUnits = [
        {
          id: 'unit-where-strings',
          sessionId: 'session-audit',
          type: 'explanation',
          conceptId: 'where-clause',
          title: 'WHERE Clause String Quoting',
          content: `## WHERE Clause String Quoting

When comparing column values to strings in SQL WHERE clauses, the string value must be enclosed in single quotes.

## Common Mistake
\`\`\`sql
-- WRONG: Missing quotes around 'Engineering'
SELECT * FROM employees WHERE department = Engineering
\`\`\`

## Correct Syntax
\`\`\`sql
-- CORRECT: String in single quotes
SELECT * FROM employees WHERE department = 'Engineering'
\`\`\`

## Key Points
- String literals always need single quotes
- Numbers don't need quotes: salary > 80000
- Column names never use quotes

## Next Steps
1. Practice with different string values
2. Watch for error messages about "column not found"`,
          addedTimestamp: timestamp - 86400000,
          sourceInteractionIds: ['evt-audit-1'],
          provenance: { model: 'test', templateId: 'test.v1', createdAt: timestamp }
        }
      ];

      window.localStorage.setItem(
        'sql-learning-textbook',
        JSON.stringify({ 'ux5-audit-user': seededUnits })
      );
    }, now);

    // 1. Practice Page Audit
    await page.goto('/');
    await expect(page).toHaveURL(/\/practice/, { timeout: 30000 });
    await page.waitForTimeout(1500);

    audit.practicePage = {
      hasProblemSelector: await page.locator('select').first().isVisible().catch(() => false),
      hasEditor: await page.locator('.monaco-editor').isVisible().catch(() => false),
      hasRunButton: await page.getByRole('button', { name: 'Run Query' }).isVisible().catch(() => false),
      hasHelpButton: await page.getByRole('button', { name: /Get Help/i }).isVisible().catch(() => false),
      hasMyTextbookLink: await page.getByRole('link', { name: 'My Textbook' }).isVisible().catch(() => false),
      hasSolvedCounter: await page.locator('text=/solved|problems/i').first().isVisible().catch(() => false)
    };

    // 2. Error State Audit
    await replaceEditorText(page, 'SELECT * FROM nonexistent');
    await page.getByRole('button', { name: 'Run Query' }).click();
    await page.waitForTimeout(1500);

    audit.errorHandling = {
      errorVisible: await page.locator('.text-red-600, [class*="error"]').first().isVisible().catch(() => false),
      helpAvailable: await page.getByRole('button', { name: /Get Help/i }).isVisible().catch(() => false)
    };

    // 3. Success State Audit
    await replaceEditorText(page, `SELECT first_name, last_name, salary
FROM employees
WHERE department = 'Engineering' AND salary > 80000`);
    await page.getByRole('button', { name: 'Run Query' }).click();
    await page.waitForTimeout(2000);

    audit.successState = {
      successIndicator: await page.locator('.text-green-600, [class*="success"]').first().isVisible().catch(() => false),
      saveToNotesVisible: await page.getByRole('button', { name: /Save to Notes/i }).isVisible().catch(() => false),
      nextProblemVisible: await page.getByRole('button', { name: /Next Problem/i }).isVisible().catch(() => false),
      navigationArrowsVisible: await page.locator('button svg').filter({ has: page.locator('[data-lucide="chevron"]') }).first().isVisible().catch(() => false)
    };

    // Save note
    const saveButton = page.getByRole('button', { name: /Save to Notes/i });
    if (await saveButton.isVisible().catch(() => false)) {
      await saveButton.click();
      await page.waitForTimeout(1000);

      audit.saveConfirmation = {
        confirmationVisible: await page.locator('text=/saved|added to textbook/i').first().isVisible().catch(() => false),
        confirmationText: await page.locator('text=/saved|added/i').first().textContent().catch(() => 'No confirmation')
      };
    }

    // 4. Textbook Page Audit
    await page.getByRole('link', { name: 'My Textbook' }).first().click();
    await expect(page).toHaveURL(/\/textbook/, { timeout: 10000 });
    await page.waitForTimeout(2000);

    audit.textbookPage = {
      headingVisible: await page.getByRole('heading', { name: 'My Textbook' }).isVisible().catch(() => false),
      welcomeCardVisible: await page.locator('text=/Personal Study Guide|learning journey/i').first().isVisible().catch(() => false),
      noteCountVisible: await page.locator('text=/notes|concepts/i').first().isVisible().catch(() => false),
      hasViewByToggle: await page.locator('button', { hasText: /Concepts|Problems/i }).first().isVisible().catch(() => false)
    };

    // Check note list scannability
    const noteElements = await page.locator('button, h2, h3').allTextContents();
    const relevantTitles = noteElements.filter(t =>
      t.length > 3 && t.length < 100 &&
      (t.toLowerCase().includes('where') ||
       t.toLowerCase().includes('help') ||
       t.toLowerCase().includes('join') ||
       t.toLowerCase().includes('select'))
    );
    audit.noteTitlesInList = relevantTitles.slice(0, 5);

    // Open a note and evaluate content
    const firstNote = page.locator('button').filter({ hasText: /WHERE|help/i }).first();
    if (await firstNote.isVisible().catch(() => false)) {
      await firstNote.click();
      await page.waitForTimeout(1000);

      const noteContent = await page.locator('.prose').first().textContent().catch(() => '');
      audit.openedNote = {
        hasHeading: await page.locator('h2').first().isVisible().catch(() => false),
        hasKeyPoints: noteContent.toLowerCase().includes('key points'),
        hasNextSteps: noteContent.toLowerCase().includes('next steps'),
        hasCodeExample: noteContent.includes('```sql'),
        hasCommonMistake: noteContent.toLowerCase().includes('mistake') || noteContent.toLowerCase().includes('wrong'),
        contentPreview: noteContent.substring(0, 500)
      };
    }

    // Log comprehensive audit results
    console.log('\n========== UX-5 AUDIT RESULTS ==========\n');
    console.log(JSON.stringify(audit, null, 2));
    console.log('\n========================================\n');

    await page.screenshot({ path: 'test-results/ux-audit-full.png', fullPage: true });

    // Assertions for key learner-facing quality checks
    expect(audit.practicePage).toMatchObject({
      hasMyTextbookLink: true
    });

    expect(audit.textbookPage).toMatchObject({
      headingVisible: true,
      welcomeCardVisible: true
    });
  });
});
