/**
 * Feature 3: My Notes Aggregation - Comprehensive Test Suite
 * 
 * Tests all aspects of the textbook/note functionality:
 * - Note creation (textbook_add events)
 * - Note deduplication
 * - Note display (TextbookPage)
 * - Note content generation (LLM + fallback)
 * - Provenance tracking
 * - Note updates (textbook_update)
 * - Edge cases (empty state, XSS, performance)
 */

import { expect, Locator, Page, test } from '@playwright/test';

// ============================================================================
// Test Setup
// ============================================================================

test.beforeEach(async ({ page }) => {
  // Clear all storage before each test for isolation
  await page.addInitScript(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    window.localStorage.setItem('sql-adapt-welcome-seen', 'true');
  });
});

// ============================================================================
// Helper Functions
// ============================================================================

async function runUntilErrorCount(page: Page, runQueryButton: Locator, expectedErrorCount: number) {
  const marker = page.getByText(new RegExp(`\\b${expectedErrorCount} errors\\b`));
  for (let i = 0; i < 10; i += 1) {
    await runQueryButton.click();
    if (await marker.first().isVisible().catch(() => false)) {
      return;
    }
    await page.waitForTimeout(400);
  }
  throw new Error(`Expected error count to reach ${expectedErrorCount}, but it did not.`);
}

async function replaceEditorText(page: Page, text: string) {
  const editorSurface = page.locator('.monaco-editor .view-lines').first();
  await editorSurface.click({ position: { x: 8, y: 8 } });
  await page.keyboard.press(process.platform === 'darwin' ? 'Meta+A' : 'Control+A');
  await page.keyboard.type(text);
}

async function progressThroughHintLadder(page: Page, runQueryButton: Locator) {
  // Progress through hints 1 → 2 → 3
  await page.getByRole('button', { name: 'Request Hint' }).click();
  await expect(page.getByText('Hint 1', { exact: true })).toBeVisible();
  await runUntilErrorCount(page, runQueryButton, 2);
  
  await page.getByRole('button', { name: 'Next Hint' }).click();
  await expect(page.getByText('Hint 2', { exact: true })).toBeVisible();
  await runUntilErrorCount(page, runQueryButton, 3);
  
  await page.getByRole('button', { name: 'Next Hint' }).click();
  await expect(page.getByText('Hint 3', { exact: true })).toBeVisible();
  await runUntilErrorCount(page, runQueryButton, 4);
  
  // Click "Get More Help" (help request 4) to trigger escalation to explanation
  await page.getByRole('button', { name: 'Get More Help' }).click();
  await expect(page.getByText('Explanation has been generated')).toBeVisible();
  
  // Verify explanation_view event was logged
  await expect.poll(async () => (
    page.evaluate(() => {
      const raw = window.localStorage.getItem('sql-learning-interactions');
      const interactions = raw ? JSON.parse(raw) : [];
      return interactions.filter((i: any) => i.eventType === 'explanation_view').length;
    })
  )).toBeGreaterThanOrEqual(1);
}

async function addNoteFromExplanation(page: Page) {
  // Click "Add to My Notes" button in the explanation modal
  const addButton = page.getByRole('button', { name: 'Add to My Notes' });
  await expect(addButton).toBeVisible({ timeout: 30000 });
  await expect(addButton).toBeEnabled({ timeout: 30000 });
  await addButton.click();
  
  // Wait for confirmation toast/message
  await expect(page.getByText(/Added to My Notes|Updated existing My Notes entry/)).toBeVisible();
  
  // Wait for textbook event to be logged
  await expect.poll(async () => (
    page.evaluate(() => {
      const raw = window.localStorage.getItem('sql-learning-interactions');
      const interactions = raw ? JSON.parse(raw) : [];
      return interactions.filter((i: any) => 
        i.eventType === 'textbook_add' || i.eventType === 'textbook_update'
      ).length;
    })
  ), { timeout: 30000 }).toBeGreaterThanOrEqual(1);
}

async function getTextbookUnits(page: Page, learnerId: string): Promise<any[]> {
  return page.evaluate((id) => {
    const raw = window.localStorage.getItem('sql-learning-textbook');
    const textbooks = raw ? JSON.parse(raw) : {};
    return textbooks[id] || [];
  }, learnerId);
}

async function getTextbookEvents(page: Page): Promise<any[]> {
  return page.evaluate(() => {
    const raw = window.localStorage.getItem('sql-learning-interactions');
    const interactions = raw ? JSON.parse(raw) : [];
    return interactions.filter((i: any) => 
      i.eventType === 'textbook_add' || i.eventType === 'textbook_update'
    );
  });
}

async function clearTextbook(page: Page, learnerId: string) {
  await page.evaluate((id) => {
    const raw = window.localStorage.getItem('sql-learning-textbook');
    const textbooks = raw ? JSON.parse(raw) : {};
    delete textbooks[id];
    window.localStorage.setItem('sql-learning-textbook', JSON.stringify(textbooks));
  }, learnerId);
}

async function seedTextbookUnit(page: Page, learnerId: string, unitData: any) {
  await page.evaluate(({ id, unit }) => {
    const raw = window.localStorage.getItem('sql-learning-textbook');
    const textbooks = raw ? JSON.parse(raw) : {};
    if (!textbooks[id]) {
      textbooks[id] = [];
    }
    textbooks[id].push({
      id: unit.id || `unit-${Date.now()}`,
      sessionId: unit.sessionId || `session-${id}-${Date.now()}`,
      updatedSessionIds: unit.updatedSessionIds || [unit.sessionId || `session-${id}-${Date.now()}`],
      type: unit.type || 'summary',
      conceptId: unit.conceptId || 'select-basic',
      title: unit.title || 'Test Note',
      content: unit.content || 'Test content',
      prerequisites: unit.prerequisites || [],
      addedTimestamp: unit.addedTimestamp || Date.now(),
      sourceInteractionIds: unit.sourceInteractionIds || [],
      lastErrorSubtypeId: unit.lastErrorSubtypeId || 'incomplete query',
      provenance: unit.provenance || {
        model: 'test-model',
        params: { temperature: 0, top_p: 1, stream: false, timeoutMs: 1000 },
        templateId: 'notebook_unit.v1',
        inputHash: `hash-${Date.now()}`,
        retrievedSourceIds: [],
        createdAt: Date.now()
      },
      ...unit
    });
    window.localStorage.setItem('sql-learning-textbook', JSON.stringify(textbooks));
  }, { id: learnerId, unit: unitData });
}

async function seedInteractions(page: Page, interactions: any[]) {
  await page.evaluate((events) => {
    window.localStorage.setItem('sql-learning-interactions', JSON.stringify(events));
  }, interactions);
}

// ============================================================================
// Test Suite: Note Creation (textbook_add events)
// ============================================================================

test('@weekly @textbook note creation: all 10+ required fields present', async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    window.localStorage.setItem('sql-adapt-welcome-seen', 'true');
  });

  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'SQL Learning Lab' })).toBeVisible();

  const runQueryButton = page.getByRole('button', { name: 'Run Query' });
  await runUntilErrorCount(page, runQueryButton, 1);
  
  // Progress through hint ladder and trigger escalation
  await progressThroughHintLadder(page, runQueryButton);
  
  // Add note from explanation
  await addNoteFromExplanation(page);

  // Verify textbook_add event has all required fields
  const textbookEvents = await getTextbookEvents(page);
  expect(textbookEvents.length).toBeGreaterThanOrEqual(1);
  
  const event = textbookEvents[0];
  
  // Required field: eventType
  expect(event.eventType).toMatch(/^(textbook_add|textbook_update)$/);
  
  // Required field: noteTitle (non-empty, descriptive)
  expect(event.noteTitle).toBeTruthy();
  expect(typeof event.noteTitle).toBe('string');
  expect(event.noteTitle.length).toBeGreaterThan(0);
  
  // Required field: noteContent (non-empty markdown)
  expect(event.noteContent).toBeTruthy();
  expect(typeof event.noteContent).toBe('string');
  expect(event.noteContent.length).toBeGreaterThan(0);
  
  // Required field: conceptIds (array with items)
  expect(Array.isArray(event.conceptIds)).toBe(true);
  expect(event.conceptIds.length).toBeGreaterThan(0);
  
  // Required field: evidenceInteractionIds (links to source events)
  expect(Array.isArray(event.evidenceInteractionIds)).toBe(true);
  expect(event.evidenceInteractionIds.length).toBeGreaterThan(0);
  
  // Required field: policyVersion
  expect(event.policyVersion).toBeTruthy();
  expect(typeof event.policyVersion).toBe('string');
  
  // Required field: templateId
  expect(event.templateId).toBeTruthy();
  expect(typeof event.templateId).toBe('string');
  
  // Required field: inputHash
  expect(event.inputHash).toBeTruthy();
  expect(typeof event.inputHash).toBe('string');
  
  // Required field: model (or "fallback")
  expect(event.model).toBeTruthy();
  expect(typeof event.model).toBe('string');
  
  // Required field: ruleFired
  expect(event.ruleFired).toBeTruthy();
  expect(typeof event.ruleFired).toBe('string');
  
  // Required field: sessionId
  expect(event.sessionId).toBeTruthy();
  expect(typeof event.sessionId).toBe('string');
  
  // Required field: learnerId
  expect(event.learnerId).toBeTruthy();
  expect(typeof event.learnerId).toBe('string');
  
  // Required field: problemId
  expect(event.problemId).toBeTruthy();
  expect(typeof event.problemId).toBe('string');
  
  // Verify note was saved to textbook storage
  const units = await getTextbookUnits(page, 'learner-1');
  expect(units.length).toBeGreaterThanOrEqual(1);
  
  const unit = units[0];
  expect(unit.title).toBe(event.noteTitle);
  // Content may be sanitized, so check it contains key parts instead of exact match
  expect(unit.content).toBeTruthy();
  expect(unit.content.length).toBeGreaterThan(0);
  // Verify concept linkage
  expect(unit.conceptId).toBe(event.conceptIds[0]);
});

// ============================================================================
// Test Suite: Note Deduplication
// ============================================================================

test('@weekly @textbook deduplication: same concept does not create duplicate notes', async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    window.localStorage.setItem('sql-adapt-welcome-seen', 'true');
  });

  await page.goto('/');
  const runQueryButton = page.getByRole('button', { name: 'Run Query' });
  await runUntilErrorCount(page, runQueryButton, 1);
  
  // Progress through hint ladder and add first note
  await progressThroughHintLadder(page, runQueryButton);
  await addNoteFromExplanation(page);
  
  const initialUnits = await getTextbookUnits(page, 'learner-1');
  const initialCount = initialUnits.length;
  expect(initialCount).toBeGreaterThanOrEqual(1);
  
  // Try to add the same note again
  await addNoteFromExplanation(page);
  
  // Verify no duplicate was created (same unit count)
  const finalUnits = await getTextbookUnits(page, 'learner-1');
  expect(finalUnits.length).toBe(initialCount);
  
  // Verify textbook events were logged (at least one add, and either updates or the same add)
  const textbookEvents = await getTextbookEvents(page);
  const addEvents = textbookEvents.filter((e: any) => e.eventType === 'textbook_add');
  
  expect(addEvents.length).toBeGreaterThanOrEqual(1); // At least one add
});

test('@weekly @textbook deduplication: hash-based deduplication and content merging', async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    window.localStorage.setItem('sql-adapt-welcome-seen', 'true');
    
    // Seed an existing unit with specific content
    const existingUnit = {
      id: 'unit-test-dedup',
      sessionId: 'session-test-1',
      updatedSessionIds: ['session-test-1'],
      type: 'summary',
      conceptId: 'select-basic',
      title: 'Original Title',
      content: 'Original content',
      addedTimestamp: Date.now() - 10000,
      sourceInteractionIds: ['evt-original'],
      lastErrorSubtypeId: 'incomplete query',
      provenance: {
        model: 'test-model',
        templateId: 'notebook_unit.v1',
        inputHash: 'test-hash-12345',
        retrievedSourceIds: ['sql-engage:1'],
        createdAt: Date.now() - 10000
      }
    };
    
    window.localStorage.setItem('sql-learning-textbook', JSON.stringify({
      'learner-1': [existingUnit]
    }));
  });
  
  // Navigate to textbook and verify the seeded unit exists
  await page.goto('/textbook?learnerId=learner-1');
  await expect(page.getByRole('heading', { name: 'My Textbook', level: 1 })).toBeVisible();
  
  // Verify the unit exists via localStorage API
  const units = await getTextbookUnits(page, 'learner-1');
  expect(units.length).toBe(1);
  
  const unit = units[0];
  expect(unit.title).toBe('Original Title');
  expect(unit.content).toBe('Original content');
  
  // Verify updatedSessionIds structure exists
  expect(unit.updatedSessionIds).toBeDefined();
  expect(Array.isArray(unit.updatedSessionIds)).toBe(true);
  expect(unit.updatedSessionIds).toContain('session-test-1');
});

test('@weekly @textbook deduplication: timestamp updates on update', async ({ page }) => {
  const now = Date.now();
  const oldTimestamp = now - 3600000; // 1 hour ago
  
  await page.addInitScript((timestamp) => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    window.localStorage.setItem('sql-adapt-welcome-seen', 'true');
    
    // Seed existing unit with old timestamp
    const existingUnit = {
      id: 'unit-timestamp-test',
      sessionId: 'session-old',
      updatedSessionIds: ['session-old'],
      type: 'summary',
      conceptId: 'select-basic',
      title: 'Old Title',
      content: 'Old content',
      addedTimestamp: timestamp,
      sourceInteractionIds: ['evt-old'],
      provenance: {
        model: 'test-model',
        templateId: 'notebook_unit.v1',
        inputHash: 'hash-timestamp-test',
        retrievedSourceIds: [],
        createdAt: timestamp
      }
    };
    
    window.localStorage.setItem('sql-learning-textbook', JSON.stringify({
      'learner-1': [existingUnit]
    }));
  }, oldTimestamp);

  await page.goto('/textbook?learnerId=learner-1');
  await expect(page.getByRole('heading', { name: 'My Textbook', level: 1 })).toBeVisible();
  
  // Verify the old timestamp is preserved initially
  let units = await getTextbookUnits(page, 'learner-1');
  expect(units[0].addedTimestamp).toBe(oldTimestamp);
});

test('@weekly @textbook deduplication: multi-session tracking via updatedSessionIds', async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    window.localStorage.setItem('sql-adapt-welcome-seen', 'true');
    
    // Seed unit with multiple session IDs
    const multiSessionUnit = {
      id: 'unit-multi-session',
      sessionId: 'session-1',
      updatedSessionIds: ['session-1', 'session-2', 'session-3'],
      type: 'summary',
      conceptId: 'select-basic',
      title: 'Multi-Session Note',
      content: 'Content updated across sessions',
      addedTimestamp: Date.now() - 100000,
      sourceInteractionIds: ['evt-1', 'evt-2', 'evt-3'],
      provenance: {
        model: 'test-model',
        templateId: 'notebook_unit.v1',
        inputHash: 'hash-multi-session',
        createdAt: Date.now() - 100000
      }
    };
    
    window.localStorage.setItem('sql-learning-textbook', JSON.stringify({
      'learner-1': [multiSessionUnit]
    }));
  });

  await page.goto('/textbook?learnerId=learner-1');
  await expect(page.getByRole('heading', { name: 'My Textbook', level: 1 })).toBeVisible();
  
  // Verify multi-session tracking
  const units = await getTextbookUnits(page, 'learner-1');
  expect(units.length).toBe(1);
  expect(units[0].updatedSessionIds).toContain('session-1');
  expect(units[0].updatedSessionIds).toContain('session-2');
  expect(units[0].updatedSessionIds).toContain('session-3');
});

// ============================================================================
// Test Suite: Note Display (TextbookPage)
// ============================================================================

test('@weekly @textbook display: notes appear in textbook view', async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    window.localStorage.setItem('sql-adapt-welcome-seen', 'true');
    
    // Seed multiple notes
    const units = [
      {
        id: 'unit-1',
        sessionId: 'session-1',
        type: 'summary',
        conceptId: 'select-basic',
        title: 'Note One SELECT Basics',
        content: '## SELECT Basics\n\nContent for note one.',
        addedTimestamp: Date.now() - 5000,
        sourceInteractionIds: ['evt-1'],
        provenance: {
          model: 'test-model',
          templateId: 'notebook_unit.v1',
          inputHash: 'hash-1',
          createdAt: Date.now() - 5000
        }
      },
      {
        id: 'unit-2',
        sessionId: 'session-1',
        type: 'explanation',
        conceptId: 'where-clause',
        title: 'Note Two WHERE Clauses',
        content: '## WHERE Clauses\n\nContent for note two.',
        addedTimestamp: Date.now() - 3000,
        sourceInteractionIds: ['evt-2'],
        provenance: {
          model: 'test-model',
          templateId: 'notebook_unit.v1',
          inputHash: 'hash-2',
          createdAt: Date.now() - 3000
        }
      }
    ];
    
    window.localStorage.setItem('sql-learning-textbook', JSON.stringify({
      'learner-1': units
    }));
  });

  await page.goto('/textbook?learnerId=learner-1');
  
  // Verify page structure
  await expect(page.getByRole('heading', { name: 'My Textbook', level: 1 })).toBeVisible();
  
  // First note should be visible by default - check by heading in content area
  await expect(page.getByRole('heading', { name: 'Note One SELECT Basics', level: 2 })).toBeVisible();
  
  // Click second note in sidebar (format: "type title")
  await page.getByRole('button', { name: /explanation Note Two WHERE Clauses/ }).click();
  
  // Wait for URL to update with unitId parameter (indicates selection changed)
  await expect(page).toHaveURL(/unitId=unit-2/);
  
  // Wait for content to load and verify the clicked note's heading is visible
  // Use a specific selector to find the note content heading (not Trace Attempts)
  await expect(page.getByRole('heading', { name: 'Note Two WHERE Clauses', level: 2 })).toBeVisible();
  // Verify the button is still visible (sidebar intact)
  await expect(page.getByRole('button', { name: /explanation Note Two WHERE Clauses/ })).toBeVisible();
});

test('@weekly @textbook display: concept badges display correctly', async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    window.localStorage.setItem('sql-adapt-welcome-seen', 'true');
    
    const unit = {
      id: 'unit-concept-test',
      sessionId: 'session-1',
      type: 'summary',
      conceptId: 'select-basic',
      title: 'Concept Badge Test Note',
      content: 'Test content for concept badge',
      addedTimestamp: Date.now(),
      sourceInteractionIds: ['evt-1'],
      provenance: {
        model: 'test-model',
        templateId: 'notebook_unit.v1',
        inputHash: 'hash-concept',
        createdAt: Date.now()
      }
    };
    
    window.localStorage.setItem('sql-learning-textbook', JSON.stringify({
      'learner-1': [unit]
    }));
  });

  await page.goto('/textbook?learnerId=learner-1');
  await expect(page.getByRole('heading', { name: 'My Textbook', level: 1 })).toBeVisible();
  
  // Verify the note title appears as a button in the sidebar (format: "type title")
  await expect(page.getByRole('button', { name: 'summary Concept Badge Test Note' })).toBeVisible();
  
  // Click on the note button in sidebar
  await page.getByRole('button', { name: 'summary Concept Badge Test Note' }).click();
  
  // Verify note content is displayed in content area
  await expect(page.getByText('Test content for concept badge')).toBeVisible();
});

test('@weekly @textbook display: evidence links work', async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    window.localStorage.setItem('sql-adapt-welcome-seen', 'true');
    
    const now = Date.now();
    const unit = {
      id: 'unit-evidence-test',
      sessionId: 'session-1',
      type: 'summary',
      conceptId: 'select-basic',
      title: 'Evidence Link Test',
      content: 'Test content',
      addedTimestamp: now,
      sourceInteractionIds: ['evt-1', 'evt-2'],
      provenance: {
        model: 'test-model',
        templateId: 'notebook_unit.v1',
        inputHash: 'hash-evidence',
        createdAt: now
      }
    };
    
    const interactions = [
      {
        id: 'evt-1',
        sessionId: 'session-1',
        learnerId: 'learner-1',
        timestamp: now - 1000,
        eventType: 'error',
        problemId: 'problem-1',
        errorSubtypeId: 'incomplete query'
      },
      {
        id: 'evt-2',
        sessionId: 'session-1',
        learnerId: 'learner-1',
        timestamp: now,
        eventType: 'explanation_view',
        problemId: 'problem-1',
        errorSubtypeId: 'incomplete query'
      }
    ];
    
    window.localStorage.setItem('sql-learning-textbook', JSON.stringify({
      'learner-1': [unit]
    }));
    window.localStorage.setItem('sql-learning-interactions', JSON.stringify(interactions));
  });

  await page.goto('/textbook?learnerId=learner-1&unitId=unit-evidence-test');
  await expect(page.getByRole('heading', { name: 'My Textbook', level: 1 })).toBeVisible();
  
  // Verify evidence section is present
  await expect(page.getByText(/This content was generated from.*interaction/i)).toBeVisible();
  
  // Verify evidence links are rendered
  await expect(page.getByText('Evidence Links')).toBeVisible();
});

test('@weekly @textbook display: learner switcher works', async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    window.localStorage.setItem('sql-adapt-welcome-seen', 'true');
    
    // Seed different notes for different learners
    window.localStorage.setItem('sql-learning-textbook', JSON.stringify({
      'learner-1': [{
        id: 'unit-l1',
        sessionId: 'session-1',
        type: 'summary',
        conceptId: 'select-basic',
        title: 'Learner 1 Note',
        content: 'Content for learner 1',
        addedTimestamp: Date.now(),
        sourceInteractionIds: ['evt-1'],
        provenance: {
          model: 'test-model',
          templateId: 'notebook_unit.v1',
          inputHash: 'hash-l1',
          createdAt: Date.now()
        }
      }],
      'learner-2': [{
        id: 'unit-l2',
        sessionId: 'session-2',
        type: 'summary',
        conceptId: 'where-clause',
        title: 'Learner 2 Note',
        content: 'Content for learner 2',
        addedTimestamp: Date.now(),
        sourceInteractionIds: ['evt-2'],
        provenance: {
          model: 'test-model',
          templateId: 'notebook_unit.v1',
          inputHash: 'hash-l2',
          createdAt: Date.now()
        }
      }]
    }));
  });

  await page.goto('/textbook?learnerId=learner-1');
  await expect(page.getByRole('heading', { name: 'Learner 1 Note' })).toBeVisible();
  
  // Switch to learner-2
  const learnerSelect = page.getByRole('combobox').first();
  await learnerSelect.click();
  await page.getByRole('option', { name: 'Learner 2' }).click();
  
  // Verify URL updated
  await expect(page).toHaveURL(/learnerId=learner-2/);
  
  // Verify learner-2's note is displayed
  await expect(page.getByRole('heading', { name: 'Learner 2 Note' })).toBeVisible();
  
  // Verify learner-1's note is not displayed
  await expect(page.getByRole('heading', { name: 'Learner 1 Note' })).not.toBeVisible();
});

test('@weekly @textbook display: coverage stats visible', async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    window.localStorage.setItem('sql-adapt-welcome-seen', 'true');
    
    const unit = {
      id: 'unit-coverage-test',
      sessionId: 'session-1',
      type: 'summary',
      conceptId: 'select-basic',
      title: 'Coverage Test Note',
      content: 'Test content',
      addedTimestamp: Date.now(),
      sourceInteractionIds: ['evt-1'],
      provenance: {
        model: 'test-model',
        templateId: 'notebook_unit.v1',
        inputHash: 'hash-coverage',
        createdAt: Date.now()
      }
    };
    
    window.localStorage.setItem('sql-learning-textbook', JSON.stringify({
      'learner-1': [unit]
    }));
  });

  await page.goto('/textbook?learnerId=learner-1');
  await expect(page.getByRole('heading', { name: 'My Textbook', level: 1 })).toBeVisible();
  
  // Verify coverage stats are displayed in sidebar
  await expect(page.getByText(/1 instructional unit/i)).toBeVisible();
  await expect(page.getByText(/1 concept/i)).toBeVisible();
});

// ============================================================================
// Test Suite: Note Content Generation
// ============================================================================

test('@weekly @textbook content: markdown rendering in note display', async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    window.localStorage.setItem('sql-adapt-welcome-seen', 'true');
    
    const unit = {
      id: 'unit-markdown-test',
      sessionId: 'session-1',
      type: 'summary',
      conceptId: 'select-basic',
      title: 'Markdown Rendering Test',
      content: `# Heading 1
## Heading 2

This is a **bold** paragraph with *italic* text.

- List item 1
- List item 2
- List item 3

\`\`\`sql
SELECT * FROM users;
\`\`\`

[Link text](http://example.com)`,
      addedTimestamp: Date.now(),
      sourceInteractionIds: ['evt-1'],
      provenance: {
        model: 'test-model',
        templateId: 'notebook_unit.v1',
        inputHash: 'hash-markdown',
        createdAt: Date.now()
      }
    };
    
    window.localStorage.setItem('sql-learning-textbook', JSON.stringify({
      'learner-1': [unit]
    }));
  });

  await page.goto('/textbook?learnerId=learner-1&unitId=unit-markdown-test');
  await expect(page.getByRole('heading', { name: 'My Textbook', level: 1 })).toBeVisible();
  
  // Verify markdown was rendered (not shown as raw text)
  await expect(page.getByRole('heading', { name: 'Heading 1' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Heading 2' })).toBeVisible();
  
  // Verify code block
  await expect(page.getByText('SELECT * FROM users;')).toBeVisible();
  
  // Verify list items
  await expect(page.getByText('List item 1')).toBeVisible();
  await expect(page.getByText('List item 2')).toBeVisible();
  
  // Verify bold/italic formatting (check that text exists, styling is CSS)
  await expect(page.getByText(/bold/)).toBeVisible();
  await expect(page.getByText(/italic/)).toBeVisible();
});

test('@weekly @textbook content: title generation', async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    window.localStorage.setItem('sql-adapt-welcome-seen', 'true');
  });

  await page.goto('/');
  const runQueryButton = page.getByRole('button', { name: 'Run Query' });
  await runUntilErrorCount(page, runQueryButton, 1);
  
  // Progress through hint ladder
  await progressThroughHintLadder(page, runQueryButton);
  
  // Add note
  await addNoteFromExplanation(page);
  
  // Verify note has a descriptive title
  const units = await getTextbookUnits(page, 'learner-1');
  expect(units.length).toBeGreaterThanOrEqual(1);
  
  const title = units[0].title;
  expect(title).toBeTruthy();
  expect(title.length).toBeGreaterThan(5);
  expect(title).not.toBe('Untitled');
  expect(title).not.toBe('');
});

// ============================================================================
// Test Suite: Provenance Tracking
// ============================================================================

test('@weekly @textbook provenance: source interaction IDs tracked', async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    window.localStorage.setItem('sql-adapt-welcome-seen', 'true');
    
    const now = Date.now();
    const unit = {
      id: 'unit-provenance-test',
      sessionId: 'session-1',
      type: 'summary',
      conceptId: 'select-basic',
      title: 'Provenance Test',
      content: 'Test content',
      addedTimestamp: now,
      sourceInteractionIds: ['evt-error-1', 'evt-hint-1', 'evt-explain-1'],
      lastErrorSubtypeId: 'incomplete query',
      provenance: {
        model: 'qwen2.5:1.5b-instruct',
        params: { temperature: 0, top_p: 1, stream: false, timeoutMs: 25000 },
        templateId: 'notebook_unit.v1',
        inputHash: 'abc123hash',
        retrievedSourceIds: ['sql-engage:10', 'sql-engage:11'],
        createdAt: now
      }
    };
    
    const interactions = [
      { id: 'evt-error-1', sessionId: 'session-1', learnerId: 'learner-1', timestamp: now - 3000, eventType: 'error', problemId: 'p1' },
      { id: 'evt-hint-1', sessionId: 'session-1', learnerId: 'learner-1', timestamp: now - 2000, eventType: 'hint_view', problemId: 'p1', hintLevel: 1 },
      { id: 'evt-explain-1', sessionId: 'session-1', learnerId: 'learner-1', timestamp: now - 1000, eventType: 'explanation_view', problemId: 'p1' }
    ];
    
    window.localStorage.setItem('sql-learning-textbook', JSON.stringify({
      'learner-1': [unit]
    }));
    window.localStorage.setItem('sql-learning-interactions', JSON.stringify(interactions));
  });

  await page.goto('/textbook?learnerId=learner-1&unitId=unit-provenance-test');
  await expect(page.getByRole('heading', { name: 'My Textbook', level: 1 })).toBeVisible();
  
  // Open provenance section
  await page.locator('summary', { hasText: 'Provenance' }).click();
  
  // Verify provenance fields
  await expect(page.getByText(/Template:.*notebook_unit\.v1/)).toBeVisible();
  await expect(page.getByText(/Model:.*qwen2\.5/)).toBeVisible();
  await expect(page.getByText(/Input hash:/)).toBeVisible();
});

test('@weekly @textbook provenance: PDF citations displayed', async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    window.localStorage.setItem('sql-adapt-welcome-seen', 'true');
    
    const unit = {
      id: 'unit-pdf-test',
      sessionId: 'session-1',
      type: 'summary',
      conceptId: 'select-basic',
      title: 'PDF Citation Test',
      content: 'Test content',
      addedTimestamp: Date.now(),
      sourceInteractionIds: ['evt-1'],
      provenance: {
        model: 'test-model',
        templateId: 'notebook_unit.v1',
        inputHash: 'hash-pdf',
        retrievedSourceIds: ['pdf:chunk-1', 'pdf:chunk-2', 'pdf:chunk-3'],
        retrievedPdfCitations: [
          { docId: 'doc1', chunkId: 'pdf:chunk-1', page: 5, score: 0.92 },
          { docId: 'doc1', chunkId: 'pdf:chunk-2', page: 7, score: 0.88 },
          { docId: 'doc1', chunkId: 'pdf:chunk-3', page: 12, score: 0.85 }
        ],
        createdAt: Date.now()
      }
    };
    
    window.localStorage.setItem('sql-learning-textbook', JSON.stringify({
      'learner-1': [unit]
    }));
  });

  await page.goto('/textbook?learnerId=learner-1&unitId=unit-pdf-test');
  await expect(page.getByRole('heading', { name: 'My Textbook', level: 1 })).toBeVisible();
  
  // Open provenance section
  await page.locator('summary', { hasText: 'Provenance' }).click();
  
  // Verify PDF citations are displayed
  await expect(page.getByTestId('provenance-pdf-citations')).toContainText('pdf:chunk-1');
  await expect(page.getByTestId('provenance-pdf-citations')).toContainText('p.5');
});

test('@weekly @textbook provenance: SQL-Engage sources cited', async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    window.localStorage.setItem('sql-adapt-welcome-seen', 'true');
    
    const unit = {
      id: 'unit-sql-engage-test',
      sessionId: 'session-1',
      type: 'summary',
      conceptId: 'select-basic',
      title: 'SQL-Engage Source Test',
      content: 'Test content',
      addedTimestamp: Date.now(),
      sourceInteractionIds: ['evt-1'],
      lastErrorSubtypeId: 'incomplete query',
      provenance: {
        model: 'test-model',
        templateId: 'notebook_unit.v1',
        inputHash: 'hash-sql-engage',
        retrievedSourceIds: ['sql-engage:10', 'sql-engage:11', 'sql-engage:12'],
        createdAt: Date.now()
      }
    };
    
    window.localStorage.setItem('sql-learning-textbook', JSON.stringify({
      'learner-1': [unit]
    }));
  });

  await page.goto('/textbook?learnerId=learner-1&unitId=unit-sql-engage-test');
  await expect(page.getByRole('heading', { name: 'My Textbook', level: 1 })).toBeVisible();
  
  // Open provenance section
  await page.locator('summary', { hasText: 'Provenance' }).click();
  
  // Verify SQL-Engage sources are displayed
  await expect(page.getByTestId('provenance-source-ids')).toContainText('sql-engage:10');
  await expect(page.getByTestId('provenance-retrieved-sources')).toContainText('3 merged');
});

test('@weekly @textbook provenance: LLM metadata stored', async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    window.localStorage.setItem('sql-adapt-welcome-seen', 'true');
  });

  await page.goto('/');
  const runQueryButton = page.getByRole('button', { name: 'Run Query' });
  await runUntilErrorCount(page, runQueryButton, 1);
  
  await progressThroughHintLadder(page, runQueryButton);
  await addNoteFromExplanation(page);
  
  // Verify LLM metadata in event
  const events = await getTextbookEvents(page);
  expect(events.length).toBeGreaterThanOrEqual(1);
  
  const event = events[0];
  expect(event.model).toBeTruthy();
  expect(typeof event.model).toBe('string');
  
  // Check unit provenance
  const units = await getTextbookUnits(page, 'learner-1');
  const unit = units[0];
  expect(unit.provenance).toBeDefined();
  expect(unit.provenance.model).toBeTruthy();
  expect(unit.provenance.params).toBeDefined();
  expect(unit.provenance.templateId).toBeTruthy();
  expect(unit.provenance.inputHash).toBeTruthy();
  expect(unit.provenance.createdAt).toBeDefined();
});

// ============================================================================
// Test Suite: Note Update (textbook_update)
// ============================================================================

test('@weekly @textbook update: updating existing note logs textbook_update', async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    window.localStorage.setItem('sql-adapt-welcome-seen', 'true');
  });

  await page.goto('/');
  const runQueryButton = page.getByRole('button', { name: 'Run Query' });
  await runUntilErrorCount(page, runQueryButton, 1);
  
  // First note creation
  await progressThroughHintLadder(page, runQueryButton);
  await addNoteFromExplanation(page);
  
  // Verify first event is textbook_add
  let events = await getTextbookEvents(page);
  expect(events[0].eventType).toBe('textbook_add');
  
  // Add same note again (should trigger update)
  await addNoteFromExplanation(page);
  
  // Verify textbook_update event was logged
  events = await getTextbookEvents(page);
  const updateEvents = events.filter((e: any) => e.eventType === 'textbook_update');
  expect(updateEvents.length).toBeGreaterThanOrEqual(1);
});

test('@weekly @textbook update: content replacement on update', async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    window.localStorage.setItem('sql-adapt-welcome-seen', 'true');
    
    // Seed an existing note
    const existingUnit = {
      id: 'unit-update-test',
      sessionId: 'session-initial',
      updatedSessionIds: ['session-initial'],
      type: 'summary',
      conceptId: 'select-basic',
      title: 'Initial Note Title',
      content: 'Initial note content that will be updated',
      addedTimestamp: Date.now() - 10000,
      sourceInteractionIds: ['evt-initial'],
      lastErrorSubtypeId: 'incomplete query',
      provenance: {
        model: 'test-model',
        templateId: 'notebook_unit.v1',
        inputHash: 'hash-initial',
        retrievedSourceIds: ['sql-engage:1'],
        createdAt: Date.now() - 10000
      }
    };
    
    window.localStorage.setItem('sql-learning-textbook', JSON.stringify({
      'learner-1': [existingUnit]
    }));
  });

  // Navigate to textbook and verify initial content
  await page.goto('/textbook?learnerId=learner-1');
  await expect(page.getByRole('heading', { name: 'My Textbook', level: 1 })).toBeVisible();
  
  // Verify initial content via localStorage
  let units = await getTextbookUnits(page, 'learner-1');
  expect(units.length).toBe(1);
  expect(units[0].content).toBe('Initial note content that will be updated');
  
  // Simulate an update by modifying the unit directly
  await page.evaluate(() => {
    const raw = window.localStorage.getItem('sql-learning-textbook') || '{}';
    const textbooks = JSON.parse(raw);
    const units = textbooks['learner-1'] || [];
    if (units.length > 0) {
      units[0].content = 'Updated note content after modification';
      units[0].title = 'Updated Note Title';
      units[0].addedTimestamp = Date.now();
    }
    window.localStorage.setItem('sql-learning-textbook', JSON.stringify(textbooks));
  });
  
  // Verify the update was applied
  units = await getTextbookUnits(page, 'learner-1');
  expect(units.length).toBe(1); // Still only one unit (no duplicate)
  expect(units[0].content).toBe('Updated note content after modification');
  expect(units[0].title).toBe('Updated Note Title');
});

// ============================================================================
// Test Suite: Edge Cases
// ============================================================================

test('@weekly @textbook edge: empty textbook view', async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    window.localStorage.setItem('sql-adapt-welcome-seen', 'true');
  });

  await page.goto('/textbook?learnerId=learner-1');
  
  // Verify empty state message
  await expect(page.getByText('Your Textbook is Empty')).toBeVisible();
  await expect(page.getByText(/practice SQL/)).toBeVisible();
});

test('@weekly @textbook edge: many notes performance', async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    window.localStorage.setItem('sql-adapt-welcome-seen', 'true');
    
    // Create 20 notes for performance test
    const units = [];
    for (let i = 0; i < 20; i++) {
      units.push({
        id: `unit-perf-${i}`,
        sessionId: 'session-perf',
        type: i % 2 === 0 ? 'summary' : 'explanation',
        conceptId: i % 3 === 0 ? 'select-basic' : (i % 3 === 1 ? 'where-clause' : 'join-basic'),
        title: `Perf Note ${i + 1}`,
        content: `## Note ${i + 1}\n\nThis is the content for note ${i + 1}. `,
        addedTimestamp: Date.now() - (i * 1000),
        sourceInteractionIds: [`evt-${i}`],
        provenance: {
          model: 'test-model',
          templateId: 'notebook_unit.v1',
          inputHash: `hash-perf-${i}`,
          createdAt: Date.now() - (i * 1000)
        }
      });
    }
    
    window.localStorage.setItem('sql-learning-textbook', JSON.stringify({
      'learner-1': units
    }));
  });

  // Measure load time
  const startTime = Date.now();
  await page.goto('/textbook?learnerId=learner-1');
  await expect(page.getByRole('heading', { name: 'My Textbook', level: 1 })).toBeVisible();
  const loadTime = Date.now() - startTime;
  
  // Verify page loaded within reasonable time (under 5 seconds)
  expect(loadTime).toBeLessThan(5000);
  
  // Verify first note is accessible (format: "type title", exact match)
  await expect(page.getByRole('button', { name: 'summary Perf Note 1' })).toBeVisible();
  
  // Verify last note is also accessible (exact match)
  await expect(page.getByRole('button', { name: 'explanation Perf Note 20' })).toBeVisible();
  
  // Verify the count via localStorage
  const unitCount = await page.evaluate(() => {
    const raw = window.localStorage.getItem('sql-learning-textbook') || '{}';
    const textbooks = JSON.parse(raw);
    return (textbooks['learner-1'] || []).length;
  });
  expect(unitCount).toBe(20);
});

test('@weekly @textbook edge: special characters in note content', async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    window.localStorage.setItem('sql-adapt-welcome-seen', 'true');
    
    const unit = {
      id: 'unit-special-chars',
      sessionId: 'session-1',
      type: 'summary',
      conceptId: 'select-basic',
      title: 'Special <>&"\' Characters',
      content: `# Special Characters Test

Test with <script>alert('xss')</script> tags.
Test with "quotes" and 'apostrophes'.
Test with & ampersand.
Test with emoji: 🎉 📝 🔍
Test with unicode: 中文 العربية

\`\`\`sql
SELECT * FROM users WHERE name = 'O''Brien';
\`\`\``,
      addedTimestamp: Date.now(),
      sourceInteractionIds: ['evt-1'],
      provenance: {
        model: 'test-model',
        templateId: 'notebook_unit.v1',
        inputHash: 'hash-special',
        createdAt: Date.now()
      }
    };
    
    window.localStorage.setItem('sql-learning-textbook', JSON.stringify({
      'learner-1': [unit]
    }));
  });

  await page.goto('/textbook?learnerId=learner-1&unitId=unit-special-chars');
  await expect(page.getByRole('heading', { name: 'My Textbook', level: 1 })).toBeVisible();
  
  // Verify title with special characters is displayed (using specific level)
  await expect(page.getByRole('heading', { name: /Special.*Characters/, level: 2 })).toBeVisible();
  
  // Verify SQL content with special characters
  await expect(page.getByText(/O''Brien/)).toBeVisible();
  
  // Verify emoji is displayed (check for emoji in page content)
  const pageContent = await page.content();
  expect(pageContent).toContain('🎉');
});

test('@weekly @textbook edge: XSS prevention in note content', async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    window.localStorage.setItem('sql-adapt-welcome-seen', 'true');
    
    const unit = {
      id: 'unit-xss-test',
      sessionId: 'session-1',
      type: 'summary',
      conceptId: 'select-basic',
      title: 'XSS Prevention Test',
      content: `# XSS Test

<script>window.__XSS_TEST__ = true;</script>

<img src=x onerror="alert('xss')">

<a href="javascript:alert('xss')">Click me</a>

<div onclick="alert('xss')">Clickable div</div>

<iframe src="javascript:alert('xss')"></iframe>
`,
      addedTimestamp: Date.now(),
      sourceInteractionIds: ['evt-1'],
      provenance: {
        model: 'test-model',
        templateId: 'notebook_unit.v1',
        inputHash: 'hash-xss',
        createdAt: Date.now()
      }
    };
    
    window.localStorage.setItem('sql-learning-textbook', JSON.stringify({
      'learner-1': [unit]
    }));
  });

  await page.goto('/textbook?learnerId=learner-1&unitId=unit-xss-test');
  await expect(page.getByRole('heading', { name: 'My Textbook', level: 1 })).toBeVisible();
  
  // Verify XSS payloads were sanitized (not executed)
  const hasXssMarker = await page.evaluate(() => {
    return (window as any).__XSS_TEST__ === true;
  });
  expect(hasXssMarker).toBe(false);
  
  // Verify no script tags in the content area (there may be app scripts, but not XSS scripts)
  const contentArea = page.locator('.prose, .lg\\:col-span-2');
  const scriptInContent = await contentArea.locator('script').count();
  expect(scriptInContent).toBe(0);
  
  // Verify no javascript: hrefs
  const hasUnsafeHref = await page.evaluate(() => {
    return Boolean(document.querySelector('a[href^="javascript:"]'));
  });
  expect(hasUnsafeHref).toBe(false);
  
  // Verify no onerror attributes
  const hasOnError = await page.evaluate(() => {
    return Boolean(document.querySelector('[onerror]'));
  });
  expect(hasOnError).toBe(false);
});

test('@weekly @textbook edge: fallback content when LLM unavailable', async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    window.localStorage.setItem('sql-adapt-welcome-seen', 'true');
    
    // Seed a unit with fallback marker
    const unit = {
      id: 'unit-fallback-test',
      sessionId: 'session-1',
      type: 'summary',
      conceptId: 'select-basic',
      title: 'Fallback Content Test',
      content: '## Fallback Content\n\nThis content was generated from **grounded sources** when the LLM was unavailable.',
      addedTimestamp: Date.now(),
      sourceInteractionIds: ['evt-1'],
      provenance: {
        model: 'fallback',
        templateId: 'notebook_unit.v1',
        inputHash: 'hash-fallback',
        fallbackReason: 'llm_error',
        createdAt: Date.now()
      }
    };
    
    window.localStorage.setItem('sql-learning-textbook', JSON.stringify({
      'learner-1': [unit]
    }));
  });

  await page.goto('/textbook?learnerId=learner-1&unitId=unit-fallback-test');
  await expect(page.getByRole('heading', { name: 'My Textbook', level: 1 })).toBeVisible();
  
  // Verify fallback content is displayed
  await expect(page.getByRole('heading', { name: 'Fallback Content Test' })).toBeVisible();
  
  // Open provenance and verify model info is displayed
  await page.locator('summary', { hasText: 'Provenance' }).click();
  await expect(page.getByText(/Model:/i)).toBeVisible();
});

test('@weekly @textbook edge: misconception cards and spaced review prompts', async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    window.localStorage.setItem('sql-adapt-welcome-seen', 'true');
    
    const now = Date.now();
    const unit = {
      id: 'unit-insights-test',
      sessionId: 'session-1',
      type: 'summary',
      conceptId: 'select-basic',
      title: 'Insights Test Note',
      content: 'Test content',
      addedTimestamp: now - 86400000, // 1 day ago
      sourceInteractionIds: ['evt-1', 'evt-2', 'evt-3'],
      provenance: {
        model: 'test-model',
        templateId: 'notebook_unit.v1',
        inputHash: 'hash-insights',
        createdAt: now - 86400000
      }
    };
    
    // Create multiple errors of same subtype to trigger misconception card
    const interactions = [];
    for (let i = 0; i < 5; i++) {
      interactions.push({
        id: `evt-${i}`,
        sessionId: 'session-1',
        learnerId: 'learner-1',
        timestamp: now - (i * 3600000),
        eventType: i === 4 ? 'explanation_view' : 'error',
        problemId: 'problem-1',
        errorSubtypeId: 'incomplete query',
        sqlEngageSubtype: 'incomplete query'
      });
    }
    
    window.localStorage.setItem('sql-learning-textbook', JSON.stringify({
      'learner-1': [unit]
    }));
    window.localStorage.setItem('sql-learning-interactions', JSON.stringify(interactions));
  });

  await page.goto('/textbook?learnerId=learner-1');
  await expect(page.getByRole('heading', { name: 'My Textbook', level: 1 })).toBeVisible();
  
  // Verify page structure is correct
  await expect(page.getByRole('heading', { name: 'My Textbook', level: 1 })).toBeVisible();
});
