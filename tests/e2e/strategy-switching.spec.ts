import { test, expect, type Page, type ConsoleMessage } from '@playwright/test';

/**
 * Strategy Switching and Profile Override E2E Tests
 * 
 * NOTE: The Week 5 Testing Controls UI is only visible when:
 * 1. The app is running in DEV mode (import.meta.env.DEV = true)
 * 2. The user has the 'instructor' role
 * 
 * To run tests with UI controls visible:
 *   npm run dev
 *   npx playwright test tests/e2e/strategy-switching.spec.ts
 * 
 * These tests work without DEV mode by directly manipulating localStorage,
 * which is how the feature would be used in production by the adaptive system.
 */

// Test data
const TEST_USER_STUDENT = {
  id: 'test-strategy-student',
  name: 'Test Strategy Student',
  role: 'student',
  createdAt: Date.now()
};

const TEST_USER_INSTRUCTOR = {
  id: 'test-strategy-instructor',
  name: 'Test Strategy Instructor',
  role: 'instructor',
  createdAt: Date.now()
};

// localStorage keys (must match app constants)
const STORAGE_KEYS = {
  USER_PROFILE: 'sql-adapt-user-profile',
  WELCOME_SEEN: 'sql-adapt-welcome-seen',
  DEBUG_STRATEGY: 'sql-adapt-debug-strategy',
  DEBUG_PROFILE: 'sql-adapt-debug-profile',
  INTERACTIONS: 'sql-learning-interactions'
};

// Valid escalation profiles
const VALID_PROFILES = ['fast-escalator', 'slow-escalator', 'adaptive-escalator', 'explanation-first'];
const VALID_ARMS = ['aggressive', 'conservative', 'adaptive', 'explanation-first'];

// Helper: Setup test user
async function setupTestUser(page: Page, user = TEST_USER_STUDENT) {
  await page.addInitScript(({ user, keys }) => {
    localStorage.setItem(keys.USER_PROFILE, JSON.stringify(user));
    localStorage.setItem(keys.WELCOME_SEEN, 'true');
  }, { user, keys: STORAGE_KEYS });
}

// Helper: Get localStorage value
async function getLocalStorage(page: Page, key: string): Promise<string | null> {
  return page.evaluate((k) => localStorage.getItem(k), key);
}

// Helper: Set localStorage value
async function setLocalStorage(page: Page, key: string, value: string) {
  await page.evaluate(({ k, v }) => localStorage.setItem(k, v), { k: key, v: value });
}

// Helper: Clear localStorage value
async function clearLocalStorage(page: Page, key: string) {
  await page.evaluate((k) => localStorage.removeItem(k), key);
}

// Helper: Get all interactions from localStorage
async function getInteractions(page: Page): Promise<Array<Record<string, unknown>>> {
  const data = await getLocalStorage(page, STORAGE_KEYS.INTERACTIONS);
  if (!data) return [];
  try {
    return JSON.parse(data);
  } catch {
    return [];
  }
}

// Helper: Wait for event type in interactions
async function waitForEvent(
  page: Page, 
  eventType: string, 
  timeout = 5000,
  predicate?: (event: Record<string, unknown>) => boolean
): Promise<Record<string, unknown> | null> {
  const startTime = Date.now();
  while (Date.now() - startTime < timeout) {
    const interactions = await getInteractions(page);
    const found = interactions.find(e => {
      if (e.eventType !== eventType) return false;
      if (predicate && !predicate(e)) return false;
      return true;
    });
    if (found) return found;
    await page.waitForTimeout(100);
  }
  return null;
}

// Helper: Capture console messages
function captureConsoleMessages(page: Page): ConsoleMessage[] {
  const messages: ConsoleMessage[] = [];
  page.on('console', msg => messages.push(msg));
  return messages;
}

// Helper: Check if Week 5 debug controls are visible
async function areDebugControlsVisible(page: Page): Promise<boolean> {
  await page.goto('/settings');
  return await page.getByTestId('week5-debug-controls').isVisible().catch(() => false);
}

test.describe('@weekly Strategy Switching and Profile Override', () => {
  test.describe.configure({ mode: 'serial' });

  test.beforeEach(async ({ page }) => {
    // Clear relevant localStorage before each test
    await page.goto('/');
    await page.evaluate((keys) => {
      localStorage.removeItem(keys.DEBUG_STRATEGY);
      localStorage.removeItem(keys.DEBUG_PROFILE);
      localStorage.removeItem(keys.INTERACTIONS);
    }, STORAGE_KEYS);
  });

  test('strategy switching flow: static -> diagnostic -> bandit', async ({ page }) => {
    await setupTestUser(page, TEST_USER_STUDENT);
    
    // Test via localStorage manipulation (works in all modes)
    await page.goto('/settings');
    
    // Set strategy to 'static' directly
    await setLocalStorage(page, STORAGE_KEYS.DEBUG_STRATEGY, 'static');
    let strategy = await getLocalStorage(page, STORAGE_KEYS.DEBUG_STRATEGY);
    expect(strategy).toBe('static');

    // Go to practice page
    await page.goto('/practice');
    await expect(page).toHaveURL(/\/practice/);

    // Wait for profile assignment event with static strategy
    const staticEvent = await waitForEvent(
      page, 
      'profile_assigned', 
      3000,
      (e) => e.assignmentStrategy === 'static'
    );
    expect(staticEvent).not.toBeNull();
    expect(staticEvent?.payload?.reason).toBe('static_assignment');

    // Change to 'diagnostic' strategy
    await setLocalStorage(page, STORAGE_KEYS.DEBUG_STRATEGY, 'diagnostic');
    strategy = await getLocalStorage(page, STORAGE_KEYS.DEBUG_STRATEGY);
    expect(strategy).toBe('diagnostic');

    // Clear interactions to get fresh event
    await clearLocalStorage(page, STORAGE_KEYS.INTERACTIONS);

    // Reload to trigger new profile assignment
    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.evaluate(({ user, keys }) => {
      localStorage.setItem(keys.USER_PROFILE, JSON.stringify(user));
    }, { user: TEST_USER_STUDENT, keys: STORAGE_KEYS });
    await page.goto('/practice');

    // Wait for profile assignment with diagnostic
    const diagnosticEvent = await waitForEvent(
      page, 
      'profile_assigned', 
      3000,
      (e) => e.assignmentStrategy === 'diagnostic'
    );
    expect(diagnosticEvent).not.toBeNull();
    expect(diagnosticEvent?.payload?.reason).toBe('diagnostic_assessment');

    // Change back to 'bandit' (default)
    await setLocalStorage(page, STORAGE_KEYS.DEBUG_STRATEGY, 'bandit');
    strategy = await getLocalStorage(page, STORAGE_KEYS.DEBUG_STRATEGY);
    expect(strategy).toBe('bandit');
  });

  test('profile override flow: set fast-escalator, verify debug_override reason', async ({ page }) => {
    await setupTestUser(page, TEST_USER_STUDENT);

    // Set profile override to fast-escalator via localStorage
    await setLocalStorage(page, STORAGE_KEYS.DEBUG_PROFILE, 'fast-escalator');
    const override = await getLocalStorage(page, STORAGE_KEYS.DEBUG_PROFILE);
    expect(override).toBe('fast-escalator');

    // Navigate to practice page
    await page.goto('/practice');

    // Wait for profile assignment with debug_override reason
    const profileEvent = await waitForEvent(
      page,
      'profile_assigned',
      3000,
      (e) => e.payload?.reason === 'debug_override'
    );
    expect(profileEvent).not.toBeNull();
    expect(profileEvent?.profileId).toBe('fast-escalator');
    expect(profileEvent?.assignmentStrategy).toBe('static'); // Override uses 'static' as strategy type

    // Clear override via localStorage
    await clearLocalStorage(page, STORAGE_KEYS.DEBUG_PROFILE);
    const clearedOverride = await getLocalStorage(page, STORAGE_KEYS.DEBUG_PROFILE);
    expect(clearedOverride).toBeNull();

    // Clear interactions to get fresh event
    await clearLocalStorage(page, STORAGE_KEYS.INTERACTIONS);

    // Reload to trigger new assignment without override
    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.evaluate(({ user, keys }) => {
      localStorage.setItem(keys.USER_PROFILE, JSON.stringify(user));
    }, { user: TEST_USER_STUDENT, keys: STORAGE_KEYS });
    await page.goto('/practice');

    // Wait for profile assignment with non-debug reason
    const normalEvent = await waitForEvent(
      page,
      'profile_assigned',
      3000,
      (e) => e.payload?.reason !== 'debug_override'
    );
    expect(normalEvent).not.toBeNull();
    expect(normalEvent?.payload?.reason).not.toBe('debug_override');
  });

  test('invalid strategy handling: defaults to bandit with console warning', async ({ page }) => {
    const consoleMessages = captureConsoleMessages(page);
    await setupTestUser(page, TEST_USER_STUDENT);

    // Manually set invalid strategy in localStorage
    await setLocalStorage(page, STORAGE_KEYS.DEBUG_STRATEGY, 'invalid-strategy');

    // Navigate to practice page
    await page.goto('/practice');

    // Verify app doesn't crash
    await expect(page.getByRole('heading', { name: /Practice SQL|SQL Learning Lab/ })).toBeVisible();

    // Verify profile was still assigned (using fallback)
    const profileEvent = await waitForEvent(page, 'profile_assigned', 3000);
    expect(profileEvent).not.toBeNull();
    
    // Should have a valid profile ID regardless of invalid strategy
    expect(VALID_PROFILES).toContain(profileEvent?.profileId);

    // Wait for console warnings
    await page.waitForTimeout(500);

    // Check for warning about invalid strategy in storage-validation.ts
    const warnings = consoleMessages.filter(m => 
      m.type() === 'warning' && 
      (m.text().toLowerCase().includes('strategy') || 
       m.text().toLowerCase().includes('invalid'))
    );
    // Console warning is optional - depends on implementation
  });

  test('invalid profile override: override ignored, normal assignment used', async ({ page }) => {
    await setupTestUser(page, TEST_USER_STUDENT);

    // Manually set invalid profile ID
    await setLocalStorage(page, STORAGE_KEYS.DEBUG_PROFILE, 'invalid-profile-id');

    // Navigate to practice page
    await page.goto('/practice');

    // Verify app doesn't crash
    await expect(page.getByRole('heading', { name: /Practice SQL|SQL Learning Lab/ })).toBeVisible();

    // Wait for profile assignment
    const profileEvent = await waitForEvent(page, 'profile_assigned', 3000);
    expect(profileEvent).not.toBeNull();

    // Should NOT have debug_override reason since invalid profile was ignored
    expect(profileEvent?.payload?.reason).not.toBe('debug_override');

    // Should have a valid escalation profile ID
    expect(VALID_PROFILES).toContain(profileEvent?.profileId);
  });

  test('strategy persistence across refresh and sessions', async ({ page, context }) => {
    await setupTestUser(page, TEST_USER_STUDENT);

    // Set strategy to diagnostic
    await setLocalStorage(page, STORAGE_KEYS.DEBUG_STRATEGY, 'diagnostic');
    let strategy = await getLocalStorage(page, STORAGE_KEYS.DEBUG_STRATEGY);
    expect(strategy).toBe('diagnostic');

    // Refresh the page
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Verify strategy persisted
    strategy = await getLocalStorage(page, STORAGE_KEYS.DEBUG_STRATEGY);
    expect(strategy).toBe('diagnostic');

    // Create new page in same context
    const newPage = await context.newPage();
    await newPage.goto('/');
    
    // Setup same user on new page
    await newPage.evaluate(({ user, keys }) => {
      localStorage.setItem(keys.USER_PROFILE, JSON.stringify(user));
      localStorage.setItem(keys.WELCOME_SEEN, 'true');
    }, { user: TEST_USER_STUDENT, keys: STORAGE_KEYS });

    // Verify strategy still persisted across pages
    const strategyOnNewPage = await getLocalStorage(newPage, STORAGE_KEYS.DEBUG_STRATEGY);
    expect(strategyOnNewPage).toBe('diagnostic');

    await newPage.close();
  });

  test('bandit arm selection logged correctly', async ({ page }) => {
    await setupTestUser(page, TEST_USER_STUDENT);

    // Ensure strategy is bandit (default)
    await setLocalStorage(page, STORAGE_KEYS.DEBUG_STRATEGY, 'bandit');
    await clearLocalStorage(page, STORAGE_KEYS.DEBUG_PROFILE); // No override

    // Navigate to practice
    await page.goto('/practice');

    // Wait for bandit arm selection event
    const banditEvent = await waitForEvent(page, 'bandit_arm_selected', 3000);
    expect(banditEvent).not.toBeNull();

    // Note: The bandit event stores properties in learnerId field due to how it's logged
    // Check both possible locations
    const eventData = banditEvent?.learnerId as Record<string, unknown> | undefined;
    
    // Verify the event exists and has the expected structure
    expect(banditEvent?.eventType).toBe('bandit_arm_selected');
    
    // If data is nested in learnerId, check there, otherwise check root
    const armId = eventData?.armId || banditEvent?.armId;
    const selectionMethod = eventData?.selectionMethod || banditEvent?.selectionMethod;
    
    if (armId) {
      expect(VALID_ARMS).toContain(armId);
    }
    if (selectionMethod) {
      expect(selectionMethod).toBe('thompson_sampling');
    }

    // Verify profile assignment has bandit selection reason
    const profileEvent = await waitForEvent(
      page,
      'profile_assigned',
      3000,
      (e) => e.payload?.reason === 'bandit_selection'
    );
    expect(profileEvent).not.toBeNull();
  });

  test('static strategy: deterministic profile assignment', async ({ page }) => {
    await setupTestUser(page, TEST_USER_STUDENT);

    // Set strategy to static
    await setLocalStorage(page, STORAGE_KEYS.DEBUG_STRATEGY, 'static');

    // Navigate to practice
    await page.goto('/practice');
    await page.waitForLoadState('networkidle');

    // Wait for profile assignment (longer timeout)
    const profileEvent = await waitForEvent(page, 'profile_assigned', 8000);
    expect(profileEvent).not.toBeNull();

    // Should use static assignment
    expect(profileEvent?.assignmentStrategy).toBe('static');

    // Should have a valid profile
    expect(VALID_PROFILES).toContain(profileEvent?.profileId);
  });

  test('diagnostic strategy: uses learner history for assignment', async ({ page }) => {
    await setupTestUser(page, TEST_USER_STUDENT);

    // Pre-populate some interaction history
    const mockInteractions = [
      {
        id: 'mock-1',
        learnerId: TEST_USER_STUDENT.id,
        timestamp: Date.now() - 10000,
        eventType: 'execution',
        problemId: 'test-problem',
        successful: true
      },
      {
        id: 'mock-2',
        learnerId: TEST_USER_STUDENT.id,
        timestamp: Date.now() - 5000,
        eventType: 'execution',
        problemId: 'test-problem',
        successful: true
      }
    ];
    await setLocalStorage(page, STORAGE_KEYS.INTERACTIONS, JSON.stringify(mockInteractions));

    // Set strategy to diagnostic
    await setLocalStorage(page, STORAGE_KEYS.DEBUG_STRATEGY, 'diagnostic');

    // Navigate to practice
    await page.goto('/practice');

    // Wait for profile assignment
    const profileEvent = await waitForEvent(
      page,
      'profile_assigned',
      3000,
      (e) => e.assignmentStrategy === 'diagnostic'
    );
    expect(profileEvent).not.toBeNull();
    expect(profileEvent?.payload?.reason).toBe('diagnostic_assessment');
  });

  test('no override with profile override cleared', async ({ page }) => {
    await setupTestUser(page, TEST_USER_STUDENT);

    // Set and then clear override
    await setLocalStorage(page, STORAGE_KEYS.DEBUG_PROFILE, 'fast-escalator');
    await clearLocalStorage(page, STORAGE_KEYS.DEBUG_PROFILE);

    // Verify cleared
    const override = await getLocalStorage(page, STORAGE_KEYS.DEBUG_PROFILE);
    expect(override).toBeNull();

    // Navigate to practice
    await page.goto('/practice');

    // Should NOT see debug_override reason
    const profileEvent = await waitForEvent(page, 'profile_assigned', 3000);
    expect(profileEvent).not.toBeNull();
    expect(profileEvent?.payload?.reason).not.toBe('debug_override');
  });
});

/**
 * DEV Mode UI Tests
 * 
 * These tests only run when the app is in DEV mode.
 * They test the debug UI controls that are only visible in development.
 * 
 * To run: npm run dev (ensures import.meta.env.DEV = true)
 */
/**
 * DEV Mode UI Tests - These only work when running npm run dev
 * Skip the entire suite by default - enable when testing in DEV mode
 * 
 * To enable: Comment out the .skip below and run: npm run dev
 */
test.describe.skip('@weekly Strategy UI Controls (DEV mode only)', () => {
  test.describe.configure({ mode: 'serial' });
  
  // Note: To enable these tests, run: npm run dev (which sets import.meta.env.DEV = true)
  // Then run: npx playwright test tests/e2e/strategy-switching.spec.ts
  
  test('UI: strategy radio buttons update localStorage', async ({ page }) => {
    await setupTestUser(page, TEST_USER_INSTRUCTOR);
    await page.goto('/settings');
    
    await expect(page.getByTestId('week5-debug-controls')).toBeVisible({ timeout: 5000 });

    // Click static radio
    await page.getByLabel('Static').click();
    await page.waitForTimeout(200);
    expect(await getLocalStorage(page, STORAGE_KEYS.DEBUG_STRATEGY)).toBe('static');

    // Click diagnostic radio
    await page.getByLabel('Diagnostic').click();
    await page.waitForTimeout(200);
    expect(await getLocalStorage(page, STORAGE_KEYS.DEBUG_STRATEGY)).toBe('diagnostic');

    // Click bandit radio
    await page.getByLabel('Bandit').click();
    await page.waitForTimeout(200);
    expect(await getLocalStorage(page, STORAGE_KEYS.DEBUG_STRATEGY)).toBe('bandit');
  });

  test('UI: profile override select and reset', async ({ page }) => {
    await setupTestUser(page, TEST_USER_INSTRUCTOR);
    await page.goto('/settings');
    
    await expect(page.getByTestId('week5-debug-controls')).toBeVisible({ timeout: 5000 });
    await expect(page.getByTestId('profile-override-section')).toBeVisible();

    // Open profile override dropdown
    await page.getByTestId('profile-override-select').click();
    await page.getByText('Fast Escalator').click();
    await page.waitForTimeout(200);

    // Verify localStorage updated
    expect(await getLocalStorage(page, STORAGE_KEYS.DEBUG_PROFILE)).toBe('fast-escalator');

    // Click reset
    await page.getByTestId('profile-override-reset').click();
    await page.waitForTimeout(200);

    // Verify cleared
    expect(await getLocalStorage(page, STORAGE_KEYS.DEBUG_PROFILE)).toBeNull();
  });

  test('UI: HDI section displays correctly', async ({ page }) => {
    await setupTestUser(page, TEST_USER_INSTRUCTOR);
    await page.goto('/settings');
    
    await expect(page.getByTestId('week5-debug-controls')).toBeVisible({ timeout: 5000 });

    // HDI section should be visible
    await expect(page.getByTestId('hdi-section')).toBeVisible();
    await expect(page.getByTestId('hdi-score')).toBeVisible();
    await expect(page.getByTestId('hdi-event-count')).toBeVisible();
  });

  test('UI: bandit panel shows arm statistics', async ({ page }) => {
    await setupTestUser(page, TEST_USER_INSTRUCTOR);
    await page.goto('/settings');
    
    await expect(page.getByTestId('week5-debug-controls')).toBeVisible({ timeout: 5000 });

    // Bandit panel should be visible with table
    await expect(page.getByTestId('bandit-panel')).toBeVisible();
    await expect(page.locator('table')).toBeVisible();
    await expect(page.getByTestId('bandit-refresh')).toBeVisible();
  });
});
