"use strict";
/**
 * Shared test helpers for Playwright E2E tests
 *
 * This file contains common helper functions used across multiple test files
 * to reduce code duplication and improve maintainability.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.waitForEditorReady = waitForEditorReady;
exports.replaceEditorText = replaceEditorText;
exports.getEditorText = getEditorText;
exports.getAllInteractionsFromStorage = getAllInteractionsFromStorage;
exports.getHintEventsFromStorage = getHintEventsFromStorage;
exports.getExplanationEventsFromStorage = getExplanationEventsFromStorage;
exports.runUntilErrorCount = runUntilErrorCount;
exports.getActiveSessionId = getActiveSessionId;
exports.getProfileFromStorage = getProfileFromStorage;
exports.getTextbookUnits = getTextbookUnits;
exports.getCoverageEventsFromStorage = getCoverageEventsFromStorage;
exports.seedValidProfile = seedValidProfile;
exports.setupTest = setupTest;
exports.completeStartPageFlow = completeStartPageFlow;
const test_1 = require("@playwright/test");
// =============================================================================
// Editor Helpers
// =============================================================================
/**
 * Wait for Monaco editor to be ready
 */
async function waitForEditorReady(page, timeout = 30000) {
    await page.waitForSelector('.monaco-editor', { state: 'visible', timeout });
    // Wait for editor to be fully initialized
    await page.waitForFunction(() => {
        const editor = document.querySelector('.monaco-editor');
        return editor && editor.querySelector('.view-lines') !== null;
    }, { timeout });
}
/**
 * Replace text in the Monaco editor with new content
 */
async function replaceEditorText(page, text) {
    // Wait for editor to be ready first
    await waitForEditorReady(page);
    const editorSurface = page.locator('.monaco-editor .view-lines').first();
    await editorSurface.click({ position: { x: 8, y: 8 } });
    await page.keyboard.press(process.platform === 'darwin' ? 'Meta+A' : 'Control+A');
    await page.keyboard.type(text);
}
/**
 * Get current text from the Monaco editor
 */
async function getEditorText(page) {
    return page.locator('.monaco-editor .view-lines').first().innerText();
}
// =============================================================================
// Storage Helpers
// =============================================================================
/**
 * Get all interactions from localStorage
 */
async function getAllInteractionsFromStorage(page) {
    return page.evaluate(() => {
        const raw = window.localStorage.getItem('sql-learning-interactions');
        return raw ? JSON.parse(raw) : [];
    });
}
/**
 * Get hint events from localStorage
 */
async function getHintEventsFromStorage(page) {
    const interactions = await getAllInteractionsFromStorage(page);
    return interactions.filter((i) => i.eventType === 'hint_view');
}
/**
 * Get explanation events from localStorage
 */
async function getExplanationEventsFromStorage(page) {
    const interactions = await getAllInteractionsFromStorage(page);
    return interactions.filter((i) => i.eventType === 'explanation_view');
}
/**
 * Run queries until the error count reaches the expected value
 */
async function runUntilErrorCount(page, runQueryButton, expectedErrorCount) {
    const marker = page.getByText(new RegExp(`\\b${expectedErrorCount}\\s+error(s)?\\b`, 'i'));
    for (let i = 0; i < 12; i += 1) {
        await runQueryButton.click();
        // Use expect.poll for reliable waiting instead of fixed timeout
        try {
            await test_1.expect.poll(async () => {
                return await marker.first().isVisible().catch(() => false);
            }, { timeout: 2000, intervals: [100] }).toBe(true);
            return;
        }
        catch {
            // Continue trying
        }
    }
    throw new Error(`Expected error count to reach ${expectedErrorCount}, but it did not.`);
}
/**
 * Get the active session ID from localStorage
 */
async function getActiveSessionId(page) {
    return page.evaluate(() => {
        return window.localStorage.getItem('sql-learning-active-session');
    });
}
/**
 * Get learner profile from localStorage
 */
async function getProfileFromStorage(page, learnerId) {
    return page.evaluate((id) => {
        const raw = window.localStorage.getItem('sql-learning-profiles');
        if (!raw)
            return null;
        const profiles = JSON.parse(raw);
        return profiles.find((p) => p.id === id) || null;
    }, learnerId);
}
/**
 * Get textbook units for a learner from localStorage
 */
async function getTextbookUnits(page, learnerId) {
    return page.evaluate((id) => {
        const raw = window.localStorage.getItem('sql-learning-textbook');
        if (!raw)
            return [];
        const textbooks = JSON.parse(raw);
        return textbooks[id] || [];
    }, learnerId);
}
/**
 * Get coverage change events from localStorage
 */
async function getCoverageEventsFromStorage(page) {
    const interactions = await getAllInteractionsFromStorage(page);
    return interactions.filter((i) => i.eventType === 'coverage_change');
}
/**
 * Seed a valid learner profile in localStorage
 */
async function seedValidProfile(page, learnerId) {
    await page.evaluate((id) => {
        const profile = {
            id,
            name: `Learner ${id}`,
            conceptsCovered: [],
            conceptCoverageEvidence: [],
            errorHistory: [],
            interactionCount: 0,
            version: 1,
            currentStrategy: 'adaptive-medium',
            preferences: {
                escalationThreshold: 3,
                aggregationDelay: 300000
            }
        };
        window.localStorage.setItem('sql-learning-profiles', JSON.stringify([profile]));
    }, learnerId);
}
// =============================================================================
// Setup Helpers
// =============================================================================
/**
 * Common test setup - clears storage and sets welcome flag
 */
async function setupTest(page) {
    await page.addInitScript(() => {
        window.localStorage.clear();
        window.sessionStorage.clear();
        window.localStorage.setItem('sql-adapt-welcome-seen', 'true');
    });
}
/**
 * Complete the StartPage authentication flow for tests
 * - Waits for StartPage heading
 * - Enters username
 * - Selects Student role
 * - Clicks Get Started
 * - Waits for navigation to complete
 *
 * Use this helper when tests need to authenticate via StartPage before
 * accessing protected routes. For tests that bypass auth (seeded storage),
 * this is not needed.
 */
async function completeStartPageFlow(page, username = 'TestStudent') {
    // Wait for StartPage heading
    await (0, test_1.expect)(page.getByRole('heading', { name: 'SQL-Adapt Learning System' })).toBeVisible({ timeout: 10000 });
    // Enter username
    await page.getByPlaceholder('Enter your username').fill(username);
    // Select Student role
    const studentCard = page.locator('.cursor-pointer').filter({ hasText: 'Student' });
    await studentCard.click();
    // Click Get Started
    await page.getByRole('button', { name: 'Get Started' }).click();
    // Wait for navigation to complete (redirects to /practice for students)
    await (0, test_1.expect)(page).toHaveURL(/\/(practice)?$/, { timeout: 15000 });
    await page.waitForLoadState('domcontentloaded');
}
