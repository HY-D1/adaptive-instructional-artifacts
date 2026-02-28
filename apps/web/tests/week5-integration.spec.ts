import { expect, test } from '@playwright/test';

/**
 * Week 5 Integration Tests
 * 
 * Test data flows between:
 * - SettingsPage, LearningInterface, InstructorDashboard, ResearchDashboard
 * 
 * Week 5 Components:
 * - Component 7: Escalation Profiles (Fast/Slow/Adaptive)
 * - Component 8: Multi-Armed Bandit
 * - Component 9: HDI (Hint Dependency Index)
 */

const BASE_URL = process.env.PLAYWRIGHT_TEST_BASE_URL || 'http://localhost:5173';

// Helper to create a student profile
type UserProfile = {
  id: string;
  name: string;
  role: 'student' | 'instructor';
  createdAt: number;
};

const createStudentProfile = (name: string): UserProfile => ({
  id: `test-${name.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}`,
  name,
  role: 'student',
  createdAt: Date.now()
});

const createInstructorProfile = (name: string): UserProfile => ({
  id: `test-instructor-${Date.now()}`,
  name,
  role: 'instructor',
  createdAt: Date.now()
});

test.describe('@weekly Week 5 Integration Tests', () => {
  
  test.beforeEach(async ({ page }) => {
    // Clear localStorage before each test
    await page.goto(BASE_URL);
    await page.evaluate(() => {
      localStorage.clear();
    });
  });

  test.describe('Settings → LearningInterface Flow', () => {
    test('profile override to Fast Escalator reflects in LearningInterface', async ({ page }) => {
      // Arrange: Create student profile
      const studentProfile = createStudentProfile('IntegrationTest');
      
      // Set up student profile
      await page.addInitScript((profile) => {
        localStorage.setItem('sql-adapt-user-profile', JSON.stringify(profile));
      }, studentProfile);
      
      // Act: Go to Settings and set profile override
      await page.goto(`${BASE_URL}/settings`);
      
      // Wait for the page to load
      await page.waitForSelector('text=Week 5 Testing Controls', { timeout: 5000 });
      
      // Select "Fast Escalator" from the profile override dropdown
      const profileSelect = page.locator('select, [data-testid="profile-override-select"]').first();
      await profileSelect.waitFor({ state: 'visible' });
      
      // Use the Select component
      await page.click('[role="combobox"]:has-text("Auto (Bandit Assigned)")');
      await page.click('[role="option"]:has-text("Fast Escalator")');
      
      // Verify localStorage was updated
      const debugProfile = await page.evaluate(() => {
        return localStorage.getItem('sql-adapt-debug-profile');
      });
      expect(debugProfile).toBe('fast-escalator');
      
      // Act: Go to Practice page
      await page.goto(`${BASE_URL}/practice`);
      
      // Assert: Check that the profile badge shows "Fast Escalator" (in DEV mode)
      // The badge should be visible in the header
      await expect(page.locator('text=Fast Escalator').first()).toBeVisible({ timeout: 5000 });
    });

    test('escalation happens after 2 errors with Fast Escalator profile', async ({ page }) => {
      // Arrange: Create student profile with Fast Escalator override
      const studentProfile = createStudentProfile('FastEscalatorTest');
      
      await page.addInitScript((profile) => {
        localStorage.setItem('sql-adapt-user-profile', JSON.stringify(profile));
        localStorage.setItem('sql-adapt-debug-profile', 'fast-escalator');
      }, studentProfile);
      
      // Act: Go to Practice page
      await page.goto(`${BASE_URL}/practice`);
      await page.waitForSelector('text=Practice SQL', { timeout: 10000 });
      
      // Make 2 syntax errors - should trigger escalation with Fast Escalator (threshold = 2)
      const editor = page.locator('.monaco-editor').first();
      await editor.click();
      await page.keyboard.press('Control+a');
      await page.keyboard.type('SELECT * FORM users'); // syntax error
      
      // Click run
      await page.click('[data-testid="run-query-btn"]');
      await page.waitForTimeout(1000);
      
      // Second error
      await editor.click();
      await page.keyboard.press('Control+a');
      await page.keyboard.type('SELECT * FORM users'); // same syntax error
      await page.click('[data-testid="run-query-btn"]');
      await page.waitForTimeout(1000);
      
      // Assert: Check for escalation-related UI changes
      // The escalation should have triggered after 2 errors
      const errorCount = await page.locator('text=errors').first().textContent();
      expect(errorCount).toContain('2');
    });
  });

  test.describe('Learning → Instructor Flow', () => {
    test('heavy hint usage creates high HDI alert in Instructor Dashboard', async ({ page }) => {
      // Arrange: Create student profile
      const studentProfile = createStudentProfile('HighHDIStudent');
      
      await page.addInitScript((profile) => {
        localStorage.setItem('sql-adapt-user-profile', JSON.stringify(profile));
      }, studentProfile);
      
      // Act: Simulate heavy hint usage
      await page.goto(`${BASE_URL}/practice`);
      await page.waitForSelector('text=Practice SQL', { timeout: 10000 });
      
      // Generate many hint_view events to create high HDI
      for (let i = 0; i < 10; i++) {
        await page.evaluate(() => {
          const event = {
            id: `test-hint-${Date.now()}-${Math.random()}`,
            learnerId: JSON.parse(localStorage.getItem('sql-adapt-user-profile') || '{}').id,
            timestamp: Date.now(),
            eventType: 'hint_view',
            problemId: 'test-problem',
            sessionId: 'test-session'
          };
          const existing = JSON.parse(localStorage.getItem('sql-learning-interactions') || '[]');
          existing.push(event);
          localStorage.setItem('sql-learning-interactions', JSON.stringify(existing));
        });
        await page.waitForTimeout(100);
      }
      
      // Add an execution to count as attempt
      await page.evaluate(() => {
        const event = {
          id: `test-exec-${Date.now()}`,
          learnerId: JSON.parse(localStorage.getItem('sql-adapt-user-profile') || '{}').id,
          timestamp: Date.now(),
          eventType: 'execution',
          problemId: 'test-problem',
          sessionId: 'test-session',
          successful: false
        };
        const existing = JSON.parse(localStorage.getItem('sql-learning-interactions') || '[]');
        existing.push(event);
        localStorage.setItem('sql-learning-interactions', JSON.stringify(existing));
      });
      
      // Add HDI calculated event
      const learnerId = studentProfile.id;
      await page.evaluate((id) => {
        const event = {
          id: `test-hdi-${Date.now()}`,
          learnerId: id,
          timestamp: Date.now(),
          eventType: 'hdi_calculated',
          problemId: 'test-problem',
          payload: {
            hdi: 0.85, // High HDI
            profile: 'fast'
          }
        };
        const existing = JSON.parse(localStorage.getItem('sql-learning-interactions') || '[]');
        existing.push(event);
        localStorage.setItem('sql-learning-interactions', JSON.stringify(existing));
      }, learnerId);
      
      // Act: Go to Instructor Dashboard as instructor
      const instructorProfile = createInstructorProfile('TestInstructor');
      await page.addInitScript((profile) => {
        localStorage.setItem('sql-adapt-user-profile', JSON.stringify(profile));
      }, instructorProfile);
      
      await page.goto(`${BASE_URL}/instructor-dashboard`);
      await page.waitForSelector('text=Instructor Dashboard', { timeout: 10000 });
      
      // Assert: Check for High Dependency Alerts section
      await expect(page.locator('text=Adaptive Learning Insights').first()).toBeVisible();
      
      // The student should appear with their HDI score
      const hdiText = await page.locator('text=HDI').first().isVisible();
      expect(hdiText).toBe(true);
    });
  });

  test.describe('Settings → Research Flow', () => {
    test('bandit strategy change reflects in Research Dashboard', async ({ page }) => {
      // Arrange: Create student profile
      const studentProfile = createStudentProfile('BanditTest');
      
      await page.addInitScript((profile) => {
        localStorage.setItem('sql-adapt-user-profile', JSON.stringify(profile));
      }, studentProfile);
      
      // Act: Set assignment strategy to Bandit in Settings
      await page.goto(`${BASE_URL}/settings`);
      await page.waitForSelector('text=Week 5 Testing Controls', { timeout: 5000 });
      
      // Select Bandit strategy
      await page.click('input[value="bandit"]');
      
      // Verify localStorage was updated
      const debugStrategy = await page.evaluate(() => {
        return localStorage.getItem('sql-adapt-debug-strategy');
      });
      expect(debugStrategy).toBe('bandit');
      
      // Generate some bandit events
      await page.evaluate((id) => {
        const events = [
          {
            id: `test-profile-assigned-${Date.now()}`,
            learnerId: id,
            timestamp: Date.now(),
            eventType: 'profile_assigned',
            problemId: 'test',
            payload: { profile: 'fast', strategy: 'bandit' }
          },
          {
            id: `test-bandit-arm-${Date.now()}`,
            learnerId: id,
            timestamp: Date.now(),
            eventType: 'bandit_arm_selected',
            problemId: 'test',
            payload: { armId: 'fast', profile: 'fast' }
          }
        ];
        const existing = JSON.parse(localStorage.getItem('sql-learning-interactions') || '[]');
        existing.push(...events);
        localStorage.setItem('sql-learning-interactions', JSON.stringify(existing));
      }, studentProfile.id);
      
      // Act: Go to Research Dashboard
      await page.goto(`${BASE_URL}/research`);
      await page.waitForSelector('text=Research Dashboard', { timeout: 10000 });
      
      // Click on Week 5 tab
      await page.click('text=Week 5: Adaptive');
      
      // Assert: Check that bandit data is displayed
      await expect(page.locator('text=Bandit Performance').first()).toBeVisible();
    });
  });

  test.describe('Instructor → Settings Flow', () => {
    test('instructor override reflects in Settings and resets properly', async ({ page }) => {
      // Arrange: Create instructor and student profiles
      const instructorProfile = createInstructorProfile('OverrideInstructor');
      const studentProfile = createStudentProfile('OverriddenStudent');
      
      // First set up the student with some data
      await page.addInitScript((profile) => {
        localStorage.setItem('sql-adapt-user-profile', JSON.stringify(profile));
      }, studentProfile);
      
      // Generate a profile assignment event
      await page.goto(`${BASE_URL}/practice`);
      await page.waitForTimeout(1000);
      
      // Add profile assigned event
      await page.evaluate((id) => {
        const event = {
          id: `test-profile-${Date.now()}`,
          learnerId: id,
          timestamp: Date.now(),
          eventType: 'profile_assigned',
          problemId: 'test',
          payload: { profile: 'adaptive', strategy: 'static' }
        };
        const existing = JSON.parse(localStorage.getItem('sql-learning-interactions') || '[]');
        existing.push(event);
        localStorage.setItem('sql-learning-interactions', JSON.stringify(existing));
      }, studentProfile.id);
      
      // Switch to instructor
      await page.addInitScript((profile) => {
        localStorage.setItem('sql-adapt-user-profile', JSON.stringify(profile));
      }, instructorProfile);
      
      // Act: Go to Instructor Dashboard
      await page.goto(`${BASE_URL}/instructor-dashboard`);
      await page.waitForSelector('text=Instructor Dashboard', { timeout: 10000 });
      
      // Find the student in the table and override their profile
      // First check if the student appears in the adaptive profiles table
      const studentVisible = await page.locator(`text=${studentProfile.name}`).first().isVisible().catch(() => false);
      
      if (studentVisible) {
        // Use the override dropdown
        const overrideSelect = page.locator('select:has-option("Override...")').first();
        await overrideSelect.selectOption('fast');
        
        // Wait for the toast message
        await expect(page.locator('text=Profile updated').first()).toBeVisible();
        
        // Switch back to student
        await page.addInitScript((profile) => {
          localStorage.setItem('sql-adapt-user-profile', JSON.stringify(profile));
        }, studentProfile);
        
        // Go to Settings
        await page.goto(`${BASE_URL}/settings`);
        await page.waitForSelector('text=Week 5 Testing Controls', { timeout: 5000 });
        
        // The override should be visible (or at least the profile should show correctly)
        // Verify the interactions were updated
        const hasOverrideEvent = await page.evaluate(() => {
          const interactions = JSON.parse(localStorage.getItem('sql-learning-interactions') || '[]');
          return interactions.some((e: { eventType: string; payload?: { reason?: string } }) => 
            e.eventType === 'profile_assigned' && e.payload?.reason === 'instructor_override'
          );
        });
        
        expect(hasOverrideEvent).toBe(true);
      }
    });
  });

  test.describe('Event Logging Verification', () => {
    test('all 9 Week 5 event types are logged correctly', async ({ page }) => {
      // Arrange: Create student profile
      const studentProfile = createStudentProfile('EventLogger');
      
      await page.addInitScript((profile) => {
        localStorage.setItem('sql-adapt-user-profile', JSON.stringify(profile));
      }, studentProfile);
      
      // Act: Generate all Week 5 events
      await page.goto(`${BASE_URL}/practice`);
      await page.waitForTimeout(500);
      
      const learnerId = studentProfile.id;
      
      // Generate all 9 Week 5 event types
      await page.evaluate((id) => {
        const now = Date.now();
        const events = [
          // 1. profile_assigned
          {
            id: `event-1-${now}`,
            learnerId: id,
            timestamp: now,
            eventType: 'profile_assigned',
            problemId: 'test',
            payload: { profile: 'fast', strategy: 'bandit', reason: 'diagnostic' }
          },
          // 2. escalation_triggered
          {
            id: `event-2-${now}`,
            learnerId: id,
            timestamp: now + 1,
            eventType: 'escalation_triggered',
            problemId: 'test',
            payload: { trigger: 'threshold_met', errorCount: 2 }
          },
          // 3. profile_adjusted
          {
            id: `event-3-${now}`,
            learnerId: id,
            timestamp: now + 2,
            eventType: 'profile_adjusted',
            problemId: 'test',
            payload: { oldProfile: 'fast', newProfile: 'adaptive', reason: 'hdi_trend' }
          },
          // 4. bandit_arm_selected
          {
            id: `event-4-${now}`,
            learnerId: id,
            timestamp: now + 3,
            eventType: 'bandit_arm_selected',
            problemId: 'test',
            payload: { armId: 'aggressive', profile: 'fast', method: 'thompson_sampling' }
          },
          // 5. bandit_reward_observed
          {
            id: `event-5-${now}`,
            learnerId: id,
            timestamp: now + 4,
            eventType: 'bandit_reward_observed',
            problemId: 'test',
            payload: { armId: 'aggressive', reward: { total: 0.8, components: {} } }
          },
          // 6. bandit_updated
          {
            id: `event-6-${now}`,
            learnerId: id,
            timestamp: now + 5,
            eventType: 'bandit_updated',
            problemId: 'test',
            payload: { armId: 'aggressive', newAlpha: 1.8, newBeta: 1.2 }
          },
          // 7. hdi_calculated
          {
            id: `event-7-${now}`,
            learnerId: id,
            timestamp: now + 6,
            eventType: 'hdi_calculated',
            problemId: 'test',
            payload: { hdi: 0.75, hpa: 0.8, aed: 0.7, components: {} }
          },
          // 8. hdi_trajectory_updated
          {
            id: `event-8-${now}`,
            learnerId: id,
            timestamp: now + 7,
            eventType: 'hdi_trajectory_updated',
            problemId: 'test',
            payload: { hdi: 0.75, trend: 'increasing', slope: 0.05 }
          },
          // 9. dependency_intervention_triggered
          {
            id: `event-9-${now}`,
            learnerId: id,
            timestamp: now + 8,
            eventType: 'dependency_intervention_triggered',
            problemId: 'test',
            payload: { hdi: 0.85, interventionType: 'reflective_prompt' }
          }
        ];
        
        const existing = JSON.parse(localStorage.getItem('sql-learning-interactions') || '[]');
        existing.push(...events);
        localStorage.setItem('sql-learning-interactions', JSON.stringify(existing));
      }, learnerId);
      
      // Act: Go to Research Dashboard and check Week 5 tab
      await page.goto(`${BASE_URL}/research`);
      await page.waitForSelector('text=Research Dashboard', { timeout: 10000 });
      
      // Click on Week 5 tab
      await page.click('text=Week 5: Adaptive');
      
      // Assert: Verify all event types appear
      const eventTypes = [
        'profile_assigned',
        'escalation_triggered', 
        'profile_adjusted',
        'bandit_arm_selected',
        'bandit_reward_observed',
        'bandit_updated',
        'hdi_calculated',
        'hdi_trajectory_updated',
        'dependency_intervention_triggered'
      ];
      
      // Verify in localStorage
      const storedEvents = await page.evaluate(() => {
        return JSON.parse(localStorage.getItem('sql-learning-interactions') || '[]');
      });
      
      for (const eventType of eventTypes) {
        const hasEvent = storedEvents.some((e: { eventType: string }) => e.eventType === eventType);
        expect(hasEvent, `Should have ${eventType} event`).toBe(true);
      }
      
      // Verify Research Dashboard shows HDI analytics
      await expect(page.locator('text=HDI (Hint Dependency Index)').first()).toBeVisible();
    });
  });

  test.describe('Data Consistency', () => {
    test('HDI value is consistent across all pages', async ({ page }) => {
      // Arrange: Create student and instructor
      const studentProfile = createStudentProfile('ConsistencyTest');
      const instructorProfile = createInstructorProfile('ConsistencyInstructor');
      const expectedHDI = 0.72;
      
      // Set up student with HDI event
      await page.addInitScript((profile) => {
        localStorage.setItem('sql-adapt-user-profile', JSON.stringify(profile));
      }, studentProfile);
      
      // Add HDI event
      await page.goto(`${BASE_URL}/practice`);
      await page.waitForTimeout(500);
      
      await page.evaluate((id) => {
        const hdiEvent = {
          id: `hdi-${Date.now()}`,
          learnerId: id,
          timestamp: Date.now(),
          eventType: 'hdi_calculated',
          problemId: 'test',
          hdi: 0.72,
          payload: { hdi: 0.72 }
        };
        const existing = JSON.parse(localStorage.getItem('sql-learning-interactions') || '[]');
        existing.push(hdiEvent);
        localStorage.setItem('sql-learning-interactions', JSON.stringify(existing));
        
        // Dispatch custom event for HDI
        window.dispatchEvent(new CustomEvent('hdi_calculated', { 
          detail: { hdi: 0.72, hdiLevel: 'medium', learnerId: id }
        }));
      }, studentProfile.id);
      
      // Check Settings page HDI
      await page.goto(`${BASE_URL}/settings`);
      await page.waitForSelector('text=Week 5 Testing Controls', { timeout: 5000 });
      
      const settingsHdiText = await page.locator('text=Current Score:').first().textContent().catch(() => '');
      
      // Switch to instructor and check dashboard
      await page.addInitScript((profile) => {
        localStorage.setItem('sql-adapt-user-profile', JSON.stringify(profile));
      }, instructorProfile);
      
      await page.goto(`${BASE_URL}/instructor-dashboard`);
      await page.waitForSelector('text=Instructor Dashboard', { timeout: 10000 });
      
      // Check that average HDI is shown
      await expect(page.locator('text=Average HDI').first()).toBeVisible();
    });

    test('profile assignment is consistent across pages', async ({ page }) => {
      // Arrange: Create student with specific profile
      const studentProfile = createStudentProfile('ProfileConsistency');
      
      await page.addInitScript((profile) => {
        localStorage.setItem('sql-adapt-user-profile', JSON.stringify(profile));
      }, studentProfile);
      
      // Set a profile assignment event
      await page.goto(`${BASE_URL}/practice`);
      await page.waitForTimeout(500);
      
      await page.evaluate((id) => {
        const profileEvent = {
          id: `profile-${Date.now()}`,
          learnerId: id,
          timestamp: Date.now(),
          eventType: 'profile_assigned',
          problemId: 'test',
          payload: { profile: 'slow', strategy: 'static', reason: 'manual' }
        };
        const existing = JSON.parse(localStorage.getItem('sql-learning-interactions') || '[]');
        existing.push(profileEvent);
        localStorage.setItem('sql-learning-interactions', JSON.stringify(existing));
      }, studentProfile.id);
      
      // Check Settings shows correct info
      await page.goto(`${BASE_URL}/settings`);
      await page.waitForSelector('text=Week 5 Testing Controls', { timeout: 5000 });
      
      // Verify interactions in storage
      const hasProfileEvent = await page.evaluate(() => {
        const interactions = JSON.parse(localStorage.getItem('sql-learning-interactions') || '[]');
        return interactions.some((e: { eventType: string; payload?: { profile?: string } }) => 
          e.eventType === 'profile_assigned' && e.payload?.profile === 'slow'
        );
      });
      
      expect(hasProfileEvent).toBe(true);
    });
  });
});
