/**
 * Production Smoke Tests - Critical Path Tests for Production Deployment
 */

import { test, expect, type Page, type BrowserContext, type ConsoleMessage } from '@playwright/test';
import { replaceEditorText, waitForEditorReady, getTextbookUnits } from '../helpers/test-helpers';

const PRODUCTION_URL = process.env.PRODUCTION_URL || process.env.PLAYWRIGHT_BASE_URL;
const BASE_URL = PRODUCTION_URL || 'http://localhost:4173';

const TEST_USER = {
  get id() { return `smoke-test-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`; },
  get name() { return `SmokeUser${Date.now().toString().slice(-6)}`; }
};

const PROBLEM_SOLUTIONS: Record<string, string> = {
  'problem-1': 'SELECT * FROM users;',
  'problem-2': 'SELECT * FROM users WHERE age > 24;',
};

const INCORRECT_QUERY = 'SELECT * FROM nonexistent_table;';

const STORAGE_KEYS = {
  PROFILE: 'sql-adapt-user-profile',
  INTERACTIONS: 'sql-learning-interactions',
  TEXTBOOK: 'sql-learning-textbook',
  SESSION: 'sql-learning-active-session',
  OFFLINE_QUEUE: 'sql-adapt-offline-queue',
};

function collectConsoleErrors(page: Page) {
  const errors: string[] = [];
  const warnings: string[] = [];

  page.on('console', (msg: ConsoleMessage) => {
    const text = msg.text();
    if (msg.type() === 'error') errors.push(text);
    else if (msg.type() === 'warning') warnings.push(text);
  });

  page.on('pageerror', (error) => errors.push(error.message));

  const criticalPatterns = ['React ErrorBoundary', 'Unhandled Promise Rejection', 'ChunkLoadError'];
  return { errors, warnings, hasCriticalErrors: () => errors.some(e => criticalPatterns.some(p => e.includes(p))) };
}

async function setupStudentProfile(page: Page, userId: string, userName: string) {
  await page.addInitScript(({ id, name }) => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    window.localStorage.setItem('sql-adapt-welcome-seen', 'true');
    window.localStorage.setItem('sql-adapt-welcome-disabled', 'true');
    window.localStorage.setItem(STORAGE_KEYS.PROFILE, JSON.stringify({ id, name, role: 'student', createdAt: Date.now() }));
  }, { id: userId, name: userName });
}

async function registerStudent(page: Page, username: string) {
  await page.addInitScript(() => {
    window.localStorage.setItem('sql-adapt-welcome-seen', 'true');
    window.localStorage.setItem('sql-adapt-welcome-disabled', 'true');
  });
  await page.goto(`${BASE_URL}/`);
  await expect(page.getByPlaceholder('Enter your username')).toBeVisible({ timeout: 15000 });
  await page.getByPlaceholder('Enter your username').fill(username);
  await page.locator('.cursor-pointer').filter({ hasText: 'Student' }).click();
  await page.getByRole('button', { name: 'Get Started' }).click();
  await expect(page).toHaveURL(/\/practice/, { timeout: 15000 });
}

async function waitForSqlEngine(page: Page) {
  await waitForEditorReady(page);
  await expect.poll(async () => page.getByRole('button', { name: 'Run Query' }).isEnabled().catch(() => false), { timeout: 30000 }).toBe(true);
}

async function submitQuery(page: Page, query: string) {
  await replaceEditorText(page, query);
  await page.getByRole('button', { name: 'Run Query' }).click();
}

async function navigateToTextbook(page: Page) {
  const link = page.getByRole('link', { name: /My Textbook/i }).first();
  if (await link.isVisible().catch(() => false)) await link.click();
  else await page.goto(`${BASE_URL}/textbook`);
  await expect(page).toHaveURL(/\/textbook/, { timeout: 10000 });
}

async function goOffline(page: Page) {
  await page.route('**/api/**', route => route.abort('internet.disconnected'));
  await page.evaluate(() => {
    Object.defineProperty(navigator, 'onLine', { get: () => false, configurable: true });
    window.dispatchEvent(new Event('offline'));
  });
}

async function goOnline(page: Page) {
  await page.unroute('**/api/**');
  await page.evaluate(() => {
    Object.defineProperty(navigator, 'onLine', { get: () => true, configurable: true });
    window.dispatchEvent(new Event('online'));
  });
}

async function getInteractions(page: Page) {
  return page.evaluate((key) => {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : [];
  }, STORAGE_KEYS.INTERACTIONS);
}

async function takeFailureScreenshot(page: Page, testName: string) {
  try { await page.screenshot({ path: `test-results/smoke-failure-${testName}-${Date.now()}.png`, fullPage: true }); }
  catch (e) { console.error('Screenshot failed:', e); }
}

test.beforeEach(async ({ page }) => {
  await page.route('**/ollama/api/generate', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ response: JSON.stringify({ title: 'Test', content_markdown: 'Test', key_points: ['Test'], source_ids: ['sql-engage:1'] }) }) });
  });
  await page.route('**/api/generate', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ response: JSON.stringify({ title: 'Test', content_markdown: 'Test', key_points: ['Test'], source_ids: ['sql-engage:1'] }) }) });
  });
});

test.describe('@smoke @critical User Journey', () => {
  test('complete learning flow', async ({ page }) => {
    const consoleCapture = collectConsoleErrors(page);
    const userId = TEST_USER.id;
    const userName = TEST_USER.name;
    try {
      await test.step('Register', async () => {
        await registerStudent(page, userName);
        await waitForSqlEngine(page);
        const profile = await page.evaluate((k) => JSON.parse(window.localStorage.getItem(k) || 'null'), STORAGE_KEYS.PROFILE);
        expect(profile?.name).toBe(userName);
      });
      await test.step('Practice', async () => {
        await submitQuery(page, PROBLEM_SOLUTIONS['problem-1']);
        await expect.poll(async () => (await page.locator('body').textContent() || '').includes('Correct'), { timeout: 5000 }).toBe(true);
        const interactions = await getInteractions(page);
        expect(interactions.filter((i: any) => i.eventType === 'execution').length).toBeGreaterThan(0);
      });
      await test.step('Hint', async () => {
        await submitQuery(page, INCORRECT_QUERY);
        await page.waitForTimeout(1000);
        const hintButton = page.getByRole('button', { name: /Request Hint|Get Hint/i });
        if (await hintButton.isVisible().catch(() => false)) { await hintButton.click(); await page.waitForTimeout(2000); }
        const interactions = await getInteractions(page);
        expect(interactions.some((i: any) => i.eventType === 'hint_view' || i.eventType === 'hint_request')).toBe(true);
      });
      await test.step('Save Note', async () => {
        const saveButton = page.getByRole('button', { name: /Save to Notes/i }).first();
        if (await saveButton.isVisible().catch(() => false)) { await saveButton.click(); await page.waitForTimeout(2000); }
      });
      await test.step('View Textbook', async () => {
        await navigateToTextbook(page);
        await expect(page.getByRole('heading', { name: /My Textbook/i })).toBeVisible();
      });
      expect(consoleCapture.hasCriticalErrors()).toBe(false);
    } catch (error) { await takeFailureScreenshot(page, 'user-journey'); throw error; }
  });
});

test.describe('@smoke @critical Data Persistence', () => {
  test('data persists across reloads', async ({ page }) => {
    const consoleCapture = collectConsoleErrors(page);
    const userId = `persistence-${Date.now()}`;
    try {
      await setupStudentProfile(page, userId, 'PersistenceTest');
      await page.goto(`${BASE_URL}/practice`);
      await waitForSqlEngine(page);
      await submitQuery(page, PROBLEM_SOLUTIONS['problem-1']);
      await expect.poll(async () => (await page.locator('body').textContent() || '').includes('Correct'), { timeout: 5000 }).toBe(true);
      await page.evaluate((id) => {
        const textbooks = { [id]: [{ id: 'test-note', sessionId: 'test', type: 'explanation', conceptId: 'test', title: 'Test Note', content: 'Test', addedTimestamp: Date.now(), sourceInteractionIds: [], provenance: { model: 'test', templateId: 'test', createdAt: Date.now() } }] };
        window.localStorage.setItem(STORAGE_KEYS.TEXTBOOK, JSON.stringify(textbooks));
      }, userId);
      const preInteractions = await getInteractions(page);
      await page.reload();
      await waitForSqlEngine(page);
      const postInteractions = await getInteractions(page);
      expect(postInteractions.length).toBeGreaterThanOrEqual(preInteractions.length);
      expect(consoleCapture.hasCriticalErrors()).toBe(false);
    } catch (error) { await takeFailureScreenshot(page, 'persistence'); throw error; }
  });
});

test.describe('@smoke @critical Cross-Tab Sync', () => {
  test('notes sync across tabs', async ({ page: tabA, context }) => {
    const consoleCapture = collectConsoleErrors(tabA);
    const userId = `crosstab-${Date.now()}`;
    try {
      await setupStudentProfile(tabA, userId, 'CrossTabTest');
      await tabA.goto(`${BASE_URL}/practice`);
      await waitForSqlEngine(tabA);
      const tabB = await context.newPage();
      await setupStudentProfile(tabB, userId, 'CrossTabTest');
      await tabB.goto(`${BASE_URL}/textbook`);
      await expect(tabB).toHaveURL(/\/textbook/);
      const initialNotes = await getTextbookUnits(tabB, userId);
      await submitQuery(tabA, PROBLEM_SOLUTIONS['problem-1']);
      await expect.poll(async () => (await tabA.locator('body').textContent() || '').includes('Correct'), { timeout: 5000 }).toBe(true);
      await tabA.waitForTimeout(2000);
      await tabB.reload();
      const syncedNotes = await getTextbookUnits(tabB, userId);
      expect(syncedNotes.length).toBeGreaterThanOrEqual(initialNotes.length);
      await tabB.close();
      expect(consoleCapture.hasCriticalErrors()).toBe(false);
    } catch (error) { await takeFailureScreenshot(tabA, 'cross-tab'); throw error; }
  });
});

test.describe('@smoke @critical Offline Handling', () => {
  test('offline data persists', async ({ page }) => {
    const consoleCapture = collectConsoleErrors(page);
    const userId = `offline-${Date.now()}`;
    try {
      await setupStudentProfile(page, userId, 'OfflineTest');
      await page.goto(`${BASE_URL}/practice`);
      await waitForSqlEngine(page);
      const initialCount = (await getInteractions(page)).length;
      await goOffline(page);
      await submitQuery(page, INCORRECT_QUERY);
      await page.waitForTimeout(1500);
      const offlineCount = (await getInteractions(page)).length;
      expect(offlineCount).toBeGreaterThan(initialCount);
      await goOnline(page);
      await page.waitForTimeout(3000);
      const finalCount = (await getInteractions(page)).length;
      expect(finalCount).toBeGreaterThanOrEqual(offlineCount);
      expect(consoleCapture.hasCriticalErrors()).toBe(false);
    } catch (error) { await takeFailureScreenshot(page, 'offline'); throw error; }
  });
});

test.describe('@smoke @critical Error Recovery', () => {
  test('corrupted profile redirects to start', async ({ page }) => {
    const consoleCapture = collectConsoleErrors(page);
    try {
      await page.addInitScript(() => { window.localStorage.clear(); window.localStorage.setItem(STORAGE_KEYS.PROFILE, 'invalid json'); });
      await page.goto(`${BASE_URL}/practice`);
      await expect(page).toHaveURL(/\/$/, { timeout: 5000 });
      const profile = await page.evaluate((k) => window.localStorage.getItem(k), STORAGE_KEYS.PROFILE);
      expect(profile).toBeNull();
      expect(consoleCapture.hasCriticalErrors()).toBe(false);
    } catch (error) { await takeFailureScreenshot(page, 'error-recovery'); throw error; }
  });
});

test.describe('@smoke @critical @deployed Production Checks', () => {
  test('production URL accessible', async ({ page }) => {
    test.skip(!PRODUCTION_URL, 'PRODUCTION_URL not set');
    const consoleCapture = collectConsoleErrors(page);
    try {
      await page.goto(BASE_URL);
      await page.waitForLoadState('networkidle');
      await expect(page.locator('body')).toBeVisible();
      expect((await page.locator('body').textContent() || '').length).toBeGreaterThan(100);
      expect(consoleCapture.hasCriticalErrors()).toBe(false);
    } catch (error) { await takeFailureScreenshot(page, 'production'); throw error; }
  });
});
