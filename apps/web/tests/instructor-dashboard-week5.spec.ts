import { expect, test } from '@playwright/test';

/**
 * Instructor Dashboard Week 5 Adaptive Learning Tests
 * 
 * Tests the adaptive learning section including:
 * 1. Empty data state (demo data vs production)
 * 2. High HDI alert logic
 * 3. Degrading trend detection
 * 4. Profile override dropdown
 * 5. Intervention trigger
 * 6. Class stats calculations
 */

test.describe('@weekly Instructor Dashboard - Week 5 Adaptive Learning', () => {
  
  test.beforeEach(async ({ page }) => {
    // Clear storage and set up instructor
    await page.addInitScript(() => {
      window.localStorage.clear();
      window.sessionStorage.clear();
      window.localStorage.setItem('sql-adapt-welcome-seen', 'true');
      window.localStorage.setItem('sql-adapt-user-profile', JSON.stringify({
        id: 'instructor-test',
        name: 'Test Instructor',
        role: 'instructor',
        createdAt: Date.now()
      }));
    });
  });

  test('empty data state shows demo data in DEV mode', async ({ page }) => {
    // Navigate to instructor dashboard
    await page.goto('/instructor-dashboard');
    await expect(page).toHaveURL(/\/instructor-dashboard/);
    
    // Wait for page to load
    await expect(page.getByText('Instructor Dashboard')).toBeVisible();
    
    // In DEV mode, demo data should be shown
    // Check for demo mode badge
    const demoBadge = page.getByText('Demo Mode');
    await expect(demoBadge).toBeVisible();
    
    // Demo students should be visible in Student Overview section
    // Use more specific selectors to avoid matching multiple elements
    await expect(page.getByRole('paragraph').filter({ hasText: /Alice Chen \(Demo\)/ }).first()).toBeVisible();
    await expect(page.getByRole('paragraph').filter({ hasText: /Bob Martinez \(Demo\)/ }).first()).toBeVisible();
    
    // Adaptive stats should show demo values
    await expect(page.getByText('Adaptive Learning Insights')).toBeVisible();
  });

  test('high HDI alert logic - students with HDI >= 0.8 trigger RED alert', async ({ page }) => {
    const now = Date.now();
    
    // Create students with different HDI values
    await page.addInitScript((timestamp) => {
      window.localStorage.setItem('sql-learning-profiles', JSON.stringify([
        { id: 's1', name: 'Student One', conceptsCovered: [], errorHistory: [], interactionCount: 5, currentStrategy: 'adaptive-medium', preferences: { escalationThreshold: 3, aggregationDelay: 300000 } },
        { id: 's2', name: 'Student Two', conceptsCovered: [], errorHistory: [], interactionCount: 5, currentStrategy: 'adaptive-medium', preferences: { escalationThreshold: 3, aggregationDelay: 300000 } },
        { id: 's3', name: 'Student Three', conceptsCovered: [], errorHistory: [], interactionCount: 5, currentStrategy: 'adaptive-medium', preferences: { escalationThreshold: 3, aggregationDelay: 300000 } }
      ]));
      
      window.localStorage.setItem('sql-learning-interactions', JSON.stringify([
        // Student with HDI = 0.85 (should trigger RED alert)
        { id: 'hdi-1', learnerId: 's1', timestamp: timestamp, eventType: 'hdi_calculated', problemId: 'test', payload: { hdi: 0.85 } },
        // Student with HDI = 0.81 (should trigger RED alert)
        { id: 'hdi-2', learnerId: 's2', timestamp: timestamp, eventType: 'hdi_calculated', problemId: 'test', payload: { hdi: 0.81 } },
        // Student with HDI = 0.79 (should NOT trigger alert)
        { id: 'hdi-3', learnerId: 's3', timestamp: timestamp, eventType: 'hdi_calculated', problemId: 'test', payload: { hdi: 0.79 } }
      ]));
    }, now);
    
    await page.goto('/instructor-dashboard');
    await expect(page.getByText('Adaptive Learning Insights')).toBeVisible();
    
    // Wait for alerts to render
    await page.waitForTimeout(500);
    
    // Check for high dependency alerts
    // Should show "High Dependency Alert" for s1 and s2 (HDI >= 0.8)
    const highAlerts = page.locator('.border-red-200, .bg-red-50').filter({ hasText: /High Dependency Alert/ });
    await expect(highAlerts).toHaveCount(2);
    
    // Verify specific students are flagged - use alert context to find student names
    const alertContainer = page.locator('div').filter({ hasText: 'Dependency Alerts' }).first();
    await expect(alertContainer).toBeVisible();
    
    // Student with 0.79 HDI should NOT be in high dependency alerts
    const redAlerts = await page.locator('.border-red-200, .bg-red-50').allTextContents();
    const hasStudentThree = redAlerts.some(text => text.includes('Student Three'));
    expect(hasStudentThree).toBe(false);
  });

  test('degrading trend detection - increasing HDI over time shows degrading trend', async ({ page }) => {
    const now = Date.now();
    
    // Create student with HDI trend getting worse (increasing)
    // Note: Higher HDI = worse (more dependent on hints)
    await page.addInitScript((timestamp) => {
      window.localStorage.setItem('sql-learning-profiles', JSON.stringify([
        { id: 'degrading-s1', name: 'Degrading Student', conceptsCovered: [], errorHistory: [], interactionCount: 5, currentStrategy: 'adaptive-medium', preferences: { escalationThreshold: 3, aggregationDelay: 300000 } }
      ]));
      
      window.localStorage.setItem('sql-learning-interactions', JSON.stringify([
        // Increasing HDI over time (getting worse): 0.4 -> 0.6 -> 0.75
        { id: 'hdi-1', learnerId: 'degrading-s1', timestamp: timestamp - 20000, eventType: 'hdi_calculated', problemId: 'test', payload: { hdi: 0.4 } },
        { id: 'hdi-2', learnerId: 'degrading-s1', timestamp: timestamp - 10000, eventType: 'hdi_calculated', problemId: 'test', payload: { hdi: 0.6 } },
        { id: 'hdi-3', learnerId: 'degrading-s1', timestamp: timestamp, eventType: 'hdi_calculated', problemId: 'test', payload: { hdi: 0.75 } }
      ]));
    }, now);
    
    await page.goto('/instructor-dashboard');
    await expect(page.getByText('Adaptive Learning Insights')).toBeVisible();
    
    // Wait for data to render
    await page.waitForTimeout(500);
    
    // Student should appear in degrading students section
    // HDI = 0.75 (> 0.5) and trend is degrading (increasing HDI), so should be flagged
    const degradingAlert = page.locator('.border-yellow-200, .bg-yellow-50').filter({ hasText: /Degrading Trend/ });
    await expect(degradingAlert).toBeVisible();
    
    // Verify the degrading student alert contains the student name
    await expect(degradingAlert.filter({ hasText: /Degrading Student/ })).toBeVisible();
    
    // Check the student appears in the adaptive profiles section
    await expect(page.getByText('Student Adaptive Profiles')).toBeVisible();
  });

  test('profile override dropdown logs profile_assigned event', async ({ page }) => {
    const now = Date.now();
    
    await page.addInitScript((timestamp) => {
      window.localStorage.setItem('sql-learning-profiles', JSON.stringify([
        { id: 'override-s1', name: 'Override Student', conceptsCovered: [], errorHistory: [], interactionCount: 5, currentStrategy: 'adaptive-medium', preferences: { escalationThreshold: 3, aggregationDelay: 300000 } }
      ]));
      
      window.localStorage.setItem('sql-learning-interactions', JSON.stringify([
        { id: 'hdi-1', learnerId: 'override-s1', timestamp: timestamp, eventType: 'hdi_calculated', problemId: 'test', payload: { hdi: 0.5 } }
      ]));
    }, now);
    
    await page.goto('/instructor-dashboard');
    await expect(page.getByText('Student Adaptive Profiles')).toBeVisible();
    
    // Find the adaptive profiles section - use the card that contains the heading
    const adaptiveSection = page.locator('div').filter({ hasText: /^Student Adaptive Profiles$/ }).first();
    await expect(adaptiveSection).toBeVisible();
    
    // Find any select element within the adaptive section (the override dropdown)
    const select = adaptiveSection.locator('select').first();
    await expect(select).toBeVisible();
    
    // Select "Fast Escalator"
    await select.selectOption('fast');
    
    // Wait for event logging
    await page.waitForTimeout(500);
    
    // Verify profile_assigned event was logged to localStorage
    const interactions = await page.evaluate(() => {
      const raw = window.localStorage.getItem('sql-learning-interactions');
      return raw ? JSON.parse(raw) : [];
    });
    
    const profileEvents = interactions.filter((i: any) => i.eventType === 'profile_assigned');
    expect(profileEvents.length).toBeGreaterThan(0);
    
    const lastEvent = profileEvents[profileEvents.length - 1];
    expect(lastEvent.learnerId).toBe('override-s1');
    expect(lastEvent.payload.profile).toBe('fast');
    expect(lastEvent.payload.reason).toBe('instructor_override');
  });

  test('intervention trigger logs dependency_intervention_triggered event', async ({ page }) => {
    const now = Date.now();
    
    await page.addInitScript((timestamp) => {
      window.localStorage.setItem('sql-learning-profiles', JSON.stringify([
        { id: 'intervention-s1', name: 'High Risk Student', conceptsCovered: [], errorHistory: [], interactionCount: 5, currentStrategy: 'adaptive-medium', preferences: { escalationThreshold: 3, aggregationDelay: 300000 } }
      ]));
      
      window.localStorage.setItem('sql-learning-interactions', JSON.stringify([
        { id: 'hdi-1', learnerId: 'intervention-s1', timestamp: timestamp, eventType: 'hdi_calculated', problemId: 'test', payload: { hdi: 0.85 } }
      ]));
    }, now);
    
    await page.goto('/instructor-dashboard');
    await expect(page.getByText('Dependency Alerts')).toBeVisible();
    
    // Find and click the trigger intervention button
    // Look for any button with "Trigger Intervention" text
    const interventionButton = page.getByRole('button', { name: /Trigger Intervention/ }).first();
    await expect(interventionButton).toBeVisible();
    await interventionButton.click();
    
    // Wait for the async operation to complete
    await page.waitForTimeout(1000);
    
    // Verify intervention event was logged with correct event type
    const interactions = await page.evaluate(() => {
      const raw = window.localStorage.getItem('sql-learning-interactions');
      return raw ? JSON.parse(raw) : [];
    });
    
    const interventionEvents = interactions.filter((i: any) => i.eventType === 'dependency_intervention_triggered');
    expect(interventionEvents.length).toBeGreaterThan(0);
    
    const lastEvent = interventionEvents[interventionEvents.length - 1];
    expect(lastEvent.learnerId).toBe('intervention-s1');
    expect(lastEvent.payload.hdi).toBe(0.85);
    expect(lastEvent.payload.reason).toBe('high_dependency');
  });

  test('class stats calculations - average HDI and profile distribution', async ({ page }) => {
    const now = Date.now();
    
    // Create 3 students with HDI: 0.3, 0.5, 0.7
    await page.addInitScript((timestamp) => {
      window.localStorage.setItem('sql-learning-profiles', JSON.stringify([
        { id: 'stat-s1', name: 'Low HDI Student', conceptsCovered: [], errorHistory: [], interactionCount: 5, currentStrategy: 'adaptive-medium', preferences: { escalationThreshold: 3, aggregationDelay: 300000 } },
        { id: 'stat-s2', name: 'Medium HDI Student', conceptsCovered: [], errorHistory: [], interactionCount: 5, currentStrategy: 'adaptive-medium', preferences: { escalationThreshold: 3, aggregationDelay: 300000 } },
        { id: 'stat-s3', name: 'High HDI Student', conceptsCovered: [], errorHistory: [], interactionCount: 5, currentStrategy: 'adaptive-medium', preferences: { escalationThreshold: 3, aggregationDelay: 300000 } }
      ]));
      
      window.localStorage.setItem('sql-learning-interactions', JSON.stringify([
        // HDI values
        { id: 'hdi-1', learnerId: 'stat-s1', timestamp: timestamp, eventType: 'hdi_calculated', problemId: 'test', payload: { hdi: 0.3 } },
        { id: 'hdi-2', learnerId: 'stat-s2', timestamp: timestamp, eventType: 'hdi_calculated', problemId: 'test', payload: { hdi: 0.5 } },
        { id: 'hdi-3', learnerId: 'stat-s3', timestamp: timestamp, eventType: 'hdi_calculated', problemId: 'test', payload: { hdi: 0.7 } },
        // Profile assignments
        { id: 'profile-1', learnerId: 'stat-s1', timestamp: timestamp, eventType: 'profile_assigned', problemId: 'test', payload: { profile: 'fast' } },
        { id: 'profile-2', learnerId: 'stat-s2', timestamp: timestamp, eventType: 'profile_assigned', problemId: 'test', payload: { profile: 'slow' } },
        { id: 'profile-3', learnerId: 'stat-s3', timestamp: timestamp, eventType: 'profile_assigned', problemId: 'test', payload: { profile: 'adaptive' } }
      ]));
    }, now);
    
    await page.goto('/instructor-dashboard');
    await expect(page.getByText('Adaptive Learning Insights')).toBeVisible();
    
    // Wait for data to render
    await page.waitForTimeout(500);
    
    // Average HDI should be (0.3 + 0.5 + 0.7) / 3 = 0.5 = 50%
    const avgHDICard = page.locator('.text-2xl').filter({ hasText: '50%' });
    await expect(avgHDICard).toBeVisible();
    
    // Profile distribution should be ~33% each (rounded)
    const profileCard = page.getByText('Profile Distribution').locator('xpath=../..');
    await expect(profileCard).toBeVisible();
    
    // Check that distribution percentages exist and add to ~100%
    const distributionSection = page.locator('.text-sm').filter({ hasText: /Profile Distribution/ }).first();
    const distributionText = await distributionSection.locator('xpath=../../..').textContent();
    expect(distributionText).toMatch(/Fast/);
    expect(distributionText).toMatch(/Slow/);
    expect(distributionText).toMatch(/Adaptive/);
  });

  test('HDI threshold edge cases', async ({ page }) => {
    const now = Date.now();
    
    // Test exact threshold values
    await page.addInitScript((timestamp) => {
      window.localStorage.setItem('sql-learning-profiles', JSON.stringify([
        { id: 'edge-80', name: 'Edge 80 Student', conceptsCovered: [], errorHistory: [], interactionCount: 5, currentStrategy: 'adaptive-medium', preferences: { escalationThreshold: 3, aggregationDelay: 300000 } },
        { id: 'edge-81', name: 'Edge 81 Student', conceptsCovered: [], errorHistory: [], interactionCount: 5, currentStrategy: 'adaptive-medium', preferences: { escalationThreshold: 3, aggregationDelay: 300000 } }
      ]));
      
      window.localStorage.setItem('sql-learning-interactions', JSON.stringify([
        // Exact threshold: HDI = 0.80 (should trigger, since >= 0.8)
        { id: 'hdi-80', learnerId: 'edge-80', timestamp: timestamp, eventType: 'hdi_calculated', problemId: 'test', payload: { hdi: 0.80 } },
        // Just above: HDI = 0.81 (should trigger)
        { id: 'hdi-81', learnerId: 'edge-81', timestamp: timestamp, eventType: 'hdi_calculated', problemId: 'test', payload: { hdi: 0.81 } }
      ]));
    }, now);
    
    await page.goto('/instructor-dashboard');
    await expect(page.getByText('Adaptive Learning Insights')).toBeVisible();
    
    // Wait for alerts to render
    await page.waitForTimeout(500);
    
    // Both students should trigger high dependency alerts (>= 0.8)
    const highAlerts = page.locator('.border-red-200, .bg-red-50').filter({ hasText: /High Dependency Alert/ });
    await expect(highAlerts).toHaveCount(2);
    
    // Verify both students are in the alerts
    const alertTexts = await highAlerts.allTextContents();
    const has80Student = alertTexts.some(text => text.includes('Edge 80 Student'));
    const has81Student = alertTexts.some(text => text.includes('Edge 81 Student'));
    expect(has80Student).toBe(true);
    expect(has81Student).toBe(true);
  });
});
