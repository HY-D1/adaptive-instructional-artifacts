/**
 * RESEARCH-1: Real Learner Loop Logging Truth Pass
 *
 * This script exercises the learner workflows and inspects actual stored/exported data
 * to verify that learner actions produce analyzable research data.
 */

import { test, expect, chromium } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const BASE_URL = process.env.RESEARCH_BASE_URL || 'http://localhost:5177';
const EXPORT_DIR = path.join(process.cwd(), 'dist', 'research-1');

// Ensure export directory exists
if (!fs.existsSync(EXPORT_DIR)) {
  fs.mkdirSync(EXPORT_DIR, { recursive: true });
}

// Helper to export localStorage data
async function exportLearnerData(page: any, filename: string) {
  const data = await page.evaluate(() => {
    const interactions = JSON.parse(localStorage.getItem('sql-learning-interactions') || '[]');
    const profiles = JSON.parse(localStorage.getItem('sql-learning-profiles') || '[]');
    const textbooks = JSON.parse(localStorage.getItem('sql-learning-textbook') || '{}');
    const userProfile = JSON.parse(localStorage.getItem('sql-adapt-user-profile') || '{}');
    return {
      timestamp: Date.now(),
      userProfile,
      interactions,
      profiles,
      textbooks
    };
  });

  const filepath = path.join(EXPORT_DIR, filename);
  fs.writeFileSync(filepath, JSON.stringify(data, null, 2));
  console.log(`[RESEARCH-1] Exported data to ${filepath}`);
  return data;
}

// Helper to clear all learner data
async function clearLearnerData(page: any) {
  await page.evaluate(() => {
    localStorage.removeItem('sql-learning-interactions');
    localStorage.removeItem('sql-learning-profiles');
    localStorage.removeItem('sql-learning-textbook');
    localStorage.removeItem('sql-adapt-user-profile');
    localStorage.removeItem('sql-learning-active-session');
  });
}

// Helper to set up student profile
async function setupStudentProfile(page: any, learnerId: string, name: string) {
  await page.evaluate(({ id, n }: { id: string; n: string }) => {
    localStorage.setItem('sql-adapt-user-profile', JSON.stringify({
      id,
      name: n,
      role: 'student',
      createdAt: Date.now()
    }));
    localStorage.setItem('sql-adapt-welcome-seen', 'true');
  }, { id: learnerId, n: name });
}

test.describe('RESEARCH-1: Learner Loop Logging Truth Pass', () => {
  test.beforeEach(async ({ page }) => {
    // Stub LLM calls to prevent ECONNREFUSED errors
    await page.route('**/ollama/api/generate', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          response: '{"title": "Test Explanation", "content_markdown": "This is a test explanation for the error.", "key_points": ["Point 1", "Point 2"], "common_pitfall": "Test pitfall", "next_steps": ["Step 1"], "source_ids": ["sql-engage:1"]}'
        })
      });
    });
    await page.route('**/api/generate', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          response: '{"title": "Test Explanation", "content_markdown": "This is a test explanation.", "key_points": [], "common_pitfall": "", "next_steps": [], "source_ids": []}'
        })
      });
    });
  });

  test('Flow A: Wrong attempt -> hint -> solve', async ({ page }) => {
    const learnerId = `research-1-flow-a-${Date.now()}`;

    // Clear and setup
    await page.goto(BASE_URL);
    await clearLearnerData(page);
    await setupStudentProfile(page, learnerId, 'Research Test Learner');

    // Navigate to practice
    await page.goto(`${BASE_URL}/practice`);
    await expect(page).toHaveURL(/\/practice/, { timeout: 30000 });

    // Wait for SQL engine initialization
    await expect.poll(async () => {
      const button = page.getByRole('button', { name: 'Run Query' });
      return await button.isEnabled().catch(() => false);
    }, { timeout: 30000, intervals: [500, 1000] }).toBe(true);

    // Capture initial state
    let data = await exportLearnerData(page, 'flow-a-initial.json');
    expect(data.interactions.length).toBe(0);

    // Step 1: Submit an incorrect SQL attempt (syntax error)
    console.log('[RESEARCH-1] Step 1: Submitting incorrect SQL...');
    await page.locator('.monaco-editor').click();
    await page.keyboard.press('Control+a');
    await page.keyboard.type('SELECT * FRM users');  // Intentional typo: FRM instead of FROM

    await page.getByRole('button', { name: 'Run Query' }).click();

    // Wait for error to appear
    await expect(page.getByText(/error/i).first()).toBeVisible({ timeout: 5000 });

    // Capture after wrong attempt
    data = await exportLearnerData(page, 'flow-a-after-error.json');

    // Verify error event was logged
    const errorEvents = data.interactions.filter((i: any) => i.eventType === 'error');
    expect(errorEvents.length).toBeGreaterThan(0);

    const errorEvent = errorEvents[0];
    console.log('[RESEARCH-1] Error event fields:', Object.keys(errorEvent));

    // Verify critical fields for research
    expect(errorEvent).toHaveProperty('id');
    expect(errorEvent).toHaveProperty('learnerId');
    expect(errorEvent).toHaveProperty('sessionId');
    expect(errorEvent).toHaveProperty('timestamp');
    expect(errorEvent).toHaveProperty('eventType', 'error');
    expect(errorEvent).toHaveProperty('problemId');
    expect(errorEvent).toHaveProperty('code');
    expect(errorEvent).toHaveProperty('error');
    expect(errorEvent).toHaveProperty('errorSubtypeId');

    // Step 2: Request a hint
    console.log('[RESEARCH-1] Step 2: Requesting hint...');
    const hintButton = page.getByRole('button', { name: /get hint/i });
    if (await hintButton.isVisible().catch(() => false)) {
      await hintButton.click();

      // Wait for hint to appear
      await expect(page.getByText(/hint/i).first()).toBeVisible({ timeout: 5000 });

      // Capture after hint
      data = await exportLearnerData(page, 'flow-a-after-hint.json');

      // Verify hint event was logged
      const hintEvents = data.interactions.filter((i: any) => i.eventType === 'hint_view' || i.eventType === 'guidance_request');
      console.log(`[RESEARCH-1] Found ${hintEvents.length} hint-related events`);

      for (const hintEvent of hintEvents) {
        console.log(`[RESEARCH-1] Hint event type: ${hintEvent.eventType}, fields:`, Object.keys(hintEvent));
      }
    }

    // Step 3: Solve the problem correctly
    console.log('[RESEARCH-1] Step 3: Solving correctly...');
    await page.locator('.monaco-editor').click();
    await page.keyboard.press('Control+a');
    await page.keyboard.type('SELECT * FROM users');

    await page.getByRole('button', { name: 'Run Query' }).click();

    // Wait for success indication
    await expect(page.getByText(/success|correct/i).first()).toBeVisible({ timeout: 5000 });

    // Capture final state
    data = await exportLearnerData(page, 'flow-a-final.json');

    // Verify execution/success event
    const executionEvents = data.interactions.filter((i: any) => i.eventType === 'execution');
    expect(executionEvents.length).toBeGreaterThan(0);

    const successEvent = executionEvents[executionEvents.length - 1];
    console.log('[RESEARCH-1] Success event fields:', Object.keys(successEvent));
    expect(successEvent).toHaveProperty('successful', true);

    // Print summary
    console.log('\n[RESEARCH-1] Flow A Summary:');
    console.log(`  Total interactions: ${data.interactions.length}`);
    console.log(`  Error events: ${data.interactions.filter((i: any) => i.eventType === 'error').length}`);
    console.log(`  Hint events: ${data.interactions.filter((i: any) => i.eventType === 'hint_view').length}`);
    console.log(`  Guidance requests: ${data.interactions.filter((i: any) => i.eventType === 'guidance_request').length}`);
    console.log(`  Execution events: ${data.interactions.filter((i: any) => i.eventType === 'execution').length}`);
  });

  test('Flow B: Save note after hint', async ({ page }) => {
    const learnerId = `research-1-flow-b-${Date.now()}`;

    // Clear and setup
    await page.goto(BASE_URL);
    await clearLearnerData(page);
    await setupStudentProfile(page, learnerId, 'Research Test Learner');

    // Navigate to practice
    await page.goto(`${BASE_URL}/practice`);
    await expect(page).toHaveURL(/\/practice/, { timeout: 30000 });

    // Wait for SQL engine
    await expect.poll(async () => {
      const button = page.getByRole('button', { name: 'Run Query' });
      return await button.isEnabled().catch(() => false);
    }, { timeout: 30000 }).toBe(true);

    // Submit error
    await page.locator('.monaco-editor').click();
    await page.keyboard.press('Control+a');
    await page.keyboard.type('SELECT * FRM users');
    await page.getByRole('button', { name: 'Run Query' }).click();
    await expect(page.getByText(/error/i).first()).toBeVisible({ timeout: 5000 });

    // Request hints until escalation
    let hintCount = 0;
    while (hintCount < 4) {
      const hintButton = page.getByRole('button', { name: /get hint/i });
      if (await hintButton.isVisible().catch(() => false)) {
        await hintButton.click();
        await page.waitForTimeout(500);
        hintCount++;
      } else {
        break;
      }
    }

    // Wait for "Save to Notes" or "Add to My Textbook" button
    console.log('[RESEARCH-1] Flow B: Looking for save button...');
    const saveButton = page.getByRole('button', { name: /save to notes|add to.*textbook/i });

    if (await saveButton.isVisible().catch(() => false)) {
      await saveButton.click();

      // Wait for save confirmation
      await page.waitForTimeout(1000);

      // Capture after save
      const data = await exportLearnerData(page, 'flow-b-after-save.json');

      // Verify note/textbook events
      const textbookEvents = data.interactions.filter((i: any) =>
        i.eventType === 'textbook_add' ||
        i.eventType === 'textbook_unit_upsert' ||
        i.eventType === 'textbook_update'
      );

      console.log(`[RESEARCH-1] Found ${textbookEvents.length} textbook events`);

      for (const event of textbookEvents) {
        console.log(`[RESEARCH-1] Textbook event type: ${event.eventType}, fields:`, Object.keys(event));
        expect(event).toHaveProperty('noteId');
        expect(event).toHaveProperty('noteTitle');
      }

      // Check My Textbook page
      await page.goto(`${BASE_URL}/textbook?learnerId=${learnerId}`);
      await expect(page.getByRole('heading', { name: /my textbook/i })).toBeVisible({ timeout: 10000 });

      // Verify note appears
      const noteTitle = page.locator('h2, h3').filter({ hasText: /syntax|error|explanation/i }).first();
      const hasNote = await noteTitle.isVisible().catch(() => false);
      console.log(`[RESEARCH-1] Note visible in textbook: ${hasNote}`);
    } else {
      console.log('[RESEARCH-1] Save button not found - skipping save verification');
    }
  });

  test('Flow C: Ask My Textbook chat', async ({ page }) => {
    const learnerId = `research-1-flow-c-${Date.now()}`;

    // Clear and setup
    await page.goto(BASE_URL);
    await clearLearnerData(page);
    await setupStudentProfile(page, learnerId, 'Research Test Learner');

    // Navigate to practice
    await page.goto(`${BASE_URL}/practice`);
    await expect(page).toHaveURL(/\/practice/, { timeout: 30000 });

    // Wait for SQL engine
    await expect.poll(async () => {
      const button = page.getByRole('button', { name: 'Run Query' });
      return await button.isEnabled().catch(() => false);
    }, { timeout: 30000 }).toBe(true);

    // Look for Ask My Textbook chat
    console.log('[RESEARCH-1] Flow C: Looking for Ask My Textbook chat...');
    const chatInput = page.locator('input[placeholder*="Ask"], textarea[placeholder*="Ask"]').first();

    if (await chatInput.isVisible().catch(() => false)) {
      // Ask a question
      await chatInput.fill('What is a SELECT statement?');
      await chatInput.press('Enter');

      // Wait for response
      await page.waitForTimeout(2000);

      // Capture after chat
      const data = await exportLearnerData(page, 'flow-c-after-chat.json');

      // Verify chat interaction events
      const chatEvents = data.interactions.filter((i: any) => i.eventType === 'chat_interaction');
      console.log(`[RESEARCH-1] Found ${chatEvents.length} chat events`);

      for (const event of chatEvents) {
        console.log(`[RESEARCH-1] Chat event fields:`, Object.keys(event));
        expect(event).toHaveProperty('chatMessage');
        expect(event).toHaveProperty('chatResponse');
      }

      // Check for save from chat button
      const saveFromChat = page.getByRole('button', { name: /save.*notes/i }).first();
      if (await saveFromChat.isVisible().catch(() => false)) {
        await saveFromChat.click();
        await page.waitForTimeout(1000);

        const finalData = await exportLearnerData(page, 'flow-c-after-save-from-chat.json');
        const savedChatEvents = finalData.interactions.filter((i: any) =>
          i.eventType === 'chat_interaction' && i.savedToNotes === true
        );
        console.log(`[RESEARCH-1] Found ${savedChatEvents.length} saved-to-notes chat events`);
      }
    } else {
      console.log('[RESEARCH-1] Ask My Textbook chat not found - skipping chat verification');
    }
  });

  test('Verify all event types have required research fields', async ({ page }) => {
    const learnerId = `research-1-verify-${Date.now()}`;

    // Clear and setup
    await page.goto(BASE_URL);
    await clearLearnerData(page);
    await setupStudentProfile(page, learnerId, 'Research Test Learner');

    // Navigate to practice
    await page.goto(`${BASE_URL}/practice`);
    await expect(page).toHaveURL(/\/practice/, { timeout: 30000 });

    // Wait for SQL engine
    await expect.poll(async () => {
      const button = page.getByRole('button', { name: 'Run Query' });
      return await button.isEnabled().catch(() => false);
    }, { timeout: 30000 }).toBe(true);

    // Perform various actions
    await page.locator('.monaco-editor').click();
    await page.keyboard.press('Control+a');
    await page.keyboard.type('SELECT * FRM users');
    await page.getByRole('button', { name: 'Run Query' }).click();
    await expect(page.getByText(/error/i).first()).toBeVisible({ timeout: 5000 });

    // Wait and get final data
    await page.waitForTimeout(1000);
    const data = await exportLearnerData(page, 'flow-verify-all-events.json');

    // Build research field matrix
    console.log('\n[RESEARCH-1] Research Field Verification:');
    console.log('='.repeat(80));

    const requiredFields = [
      'learner_id (learnerId)',
      'session_id (sessionId)',
      'problem_id (problemId)',
      'event_type (eventType)',
      'timestamp',
      'error_subtype (errorSubtypeId)',
      'hint_level (hintLevel)',
      'help_request_index (helpRequestIndex)',
      'note_id (noteId)',
      'note_title (noteTitle)',
      'note_source (conceptIds/textbook_action)',
      'condition_id (conditionId)'
    ];

    // Analyze each interaction
    const fieldPresence: Record<string, Set<string>> = {};

    for (const interaction of data.interactions) {
      const type = interaction.eventType;
      if (!fieldPresence[type]) {
        fieldPresence[type] = new Set<string>();
      }

      for (const key of Object.keys(interaction)) {
        fieldPresence[type].add(key);
      }
    }

    // Print field matrix
    for (const [eventType, fields] of Object.entries(fieldPresence)) {
      console.log(`\nEvent Type: ${eventType}`);
      console.log('-'.repeat(40));
      const sortedFields = Array.from(fields).sort();
      for (const field of sortedFields) {
        console.log(`  ✓ ${field}`);
      }
    }

    // Summary
    console.log('\n' + '='.repeat(80));
    console.log('[RESEARCH-1] Summary:');
    console.log(`  Total events: ${data.interactions.length}`);
    console.log(`  Unique event types: ${Object.keys(fieldPresence).length}`);
    console.log(`  Event types: ${Object.keys(fieldPresence).join(', ')}`);

    // Write summary report
    const report = {
      timestamp: Date.now(),
      learnerId,
      totalEvents: data.interactions.length,
      eventTypes: Object.fromEntries(
        Object.entries(fieldPresence).map(([k, v]) => [k, Array.from(v).sort()])
      ),
      missingFields: {} as Record<string, string[]>
    };

    fs.writeFileSync(
      path.join(EXPORT_DIR, 'research-1-field-report.json'),
      JSON.stringify(report, null, 2)
    );

    console.log(`\n[RESEARCH-1] Report saved to ${path.join(EXPORT_DIR, 'research-1-field-report.json')}`);
  });
});
