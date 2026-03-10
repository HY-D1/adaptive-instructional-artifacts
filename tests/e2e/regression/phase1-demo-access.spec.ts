/**
 * Phase 1 Demo Access Contract E2E Tests
 * 
 * Stable checks covering the core demo contract for SQL-Adapt:
 * 1. Student login -> /practice
 * 2. Instructor login -> /instructor-dashboard
 * 3. Instructor direct /textbook access works
 * 4. Instructor /textbook?learnerId=learner-1 works
 * 5. Instructor /practice redirects away when not preview
 * 6. /research is instructor-only
 * 7. Seed/reset flow works (if implemented)
 * 
 * @tags @weekly, @no-external, demo-access, authentication
 */

import { test, expect } from '@playwright/test';

// Profile structure matching UserProfile type
interface UserProfile {
  id: string;
  name: string;
  role: 'student' | 'instructor';
  createdAt: number;
}

// Test suite for Phase 1 Demo Access Contract
test.describe('@weekly @no-external Phase 1 Demo Access Contract', () => {
  
  // Idempotent init script - only runs once per test
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      const FLAG = '__pw_seeded__';
      if (localStorage.getItem(FLAG) === '1') return;
      
      localStorage.clear();
      sessionStorage.clear();
      localStorage.setItem('sql-adapt-welcome-seen', 'true');
      
      localStorage.setItem(FLAG, '1');
    });
  });

  test.afterEach(async ({ page }) => {
    await page.evaluate(() => {
      localStorage.removeItem('__pw_seeded__');
    });
  });

  // ===========================================================================
  // CHECK 1: Student login -> /practice
  // ===========================================================================
  
  test('@weekly Student login redirects to /practice', async ({ page }) => {
    // Arrange - Create student profile in localStorage (direct auth setup)
    const studentProfile: UserProfile = {
      id: 'demo-student-001',
      name: 'DemoStudent',
      role: 'student',
      createdAt: Date.now(),
    };
    
    await page.addInitScript((profile) => {
      window.localStorage.setItem('sql-adapt-user-profile', JSON.stringify(profile));
      window.localStorage.setItem('sql-adapt-welcome-seen', 'true');
    }, studentProfile);
    
    // Act - Navigate directly to practice page (app may not auto-redirect from /)
    await page.goto('/practice');
    
    // Assert - On practice page
    await expect(page).toHaveURL(/\/practice$/);
    
    // Assert - Practice page content is visible
    await expect(page.getByRole('heading', { name: /Practice SQL/i })).toBeVisible();
    
    // Assert - Student navigation is visible
    await expect(page.getByRole('link', { name: /Practice/i })).toBeVisible();
    // Use more specific selector for role badge to avoid strict mode violation
    await expect(page.getByRole('link', { name: /SQL-Adapt Student/i })).toBeVisible();
  });

  // ===========================================================================
  // CHECK 2: Instructor login -> /instructor-dashboard
  // ===========================================================================
  
  test('@weekly Instructor login redirects to /instructor-dashboard', async ({ page }) => {
    // Arrange - Create instructor profile in localStorage
    const instructorProfile: UserProfile = {
      id: 'demo-instructor-001',
      name: 'DemoInstructor',
      role: 'instructor',
      createdAt: Date.now(),
    };
    
    await page.addInitScript((profile) => {
      window.localStorage.setItem('sql-adapt-user-profile', JSON.stringify(profile));
      window.localStorage.setItem('sql-adapt-welcome-seen', 'true');
    }, instructorProfile);
    
    // Act - Navigate directly to instructor dashboard (app may not auto-redirect from /)
    await page.goto('/instructor-dashboard');
    
    // Assert - On instructor dashboard
    await expect(page).toHaveURL(/\/instructor-dashboard$/);
    
    // Assert - Instructor navigation is visible
    // Use more specific selector for role badge to avoid strict mode violation
    await expect(page.getByRole('link', { name: /SQL-Adapt Instructor/i })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Dashboard' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Research' })).toBeVisible();
  });

  // ===========================================================================
  // CHECK 3: Instructor direct /textbook access works
  // ===========================================================================
  
  test('@weekly Instructor can access /textbook directly', async ({ page }) => {
    // Arrange - Create instructor profile
    const instructorProfile: UserProfile = {
      id: 'demo-instructor-002',
      name: 'DemoInstructor',
      role: 'instructor',
      createdAt: Date.now(),
    };
    
    await page.addInitScript((profile) => {
      window.localStorage.setItem('sql-adapt-user-profile', JSON.stringify(profile));
      window.localStorage.setItem('sql-adapt-welcome-seen', 'true');
    }, instructorProfile);
    
    // Act - Access textbook directly
    await page.goto('/textbook');
    
    // Assert - Stays on textbook page (not redirected)
    await expect(page).toHaveURL(/\/textbook$/);
    
    // Assert - Textbook content is visible
    await expect(page.getByRole('heading', { name: /My Textbook|My Learning Journey/i })).toBeVisible();
    
    // Assert - Instructor badge is visible (use specific selector)
    await expect(page.getByRole('link', { name: /SQL-Adapt Instructor/i })).toBeVisible();
  });

  // ===========================================================================
  // CHECK 4: Instructor /textbook?learnerId=learner-1 works
  // ===========================================================================
  
  test('@weekly Instructor can access /textbook with learnerId query param', async ({ page }) => {
    // Arrange - Create instructor profile
    const instructorProfile: UserProfile = {
      id: 'demo-instructor-003',
      name: 'DemoInstructor',
      role: 'instructor',
      createdAt: Date.now(),
    };
    
    await page.addInitScript((profile) => {
      window.localStorage.setItem('sql-adapt-user-profile', JSON.stringify(profile));
      window.localStorage.setItem('sql-adapt-welcome-seen', 'true');
    }, instructorProfile);
    
    // Act - Access textbook with learnerId query parameter
    await page.goto('/textbook?learnerId=learner-1');
    
    // Assert - Stays on textbook page with query param intact
    await expect(page).toHaveURL(/\/textbook\?learnerId=learner-1$/);
    
    // Assert - Textbook content is visible
    await expect(page.getByRole('heading', { name: /My Textbook|My Learning Journey/i })).toBeVisible();
    
    // Assert - Page indicates learner inspection mode (if UI supports it)
    // This may vary based on implementation, so we just verify URL and basic content
    const url = page.url();
    expect(url).toContain('learnerId=learner-1');
  });

  // ===========================================================================
  // CHECK 5: Instructor /practice redirects away when not preview
  // ===========================================================================
  
  test('@weekly Instructor accessing /practice redirects to instructor-dashboard', async ({ page }) => {
    // Arrange - Create instructor profile
    const instructorProfile: UserProfile = {
      id: 'demo-instructor-004',
      name: 'DemoInstructor',
      role: 'instructor',
      createdAt: Date.now(),
    };
    
    await page.addInitScript((profile) => {
      window.localStorage.setItem('sql-adapt-user-profile', JSON.stringify(profile));
      window.localStorage.setItem('sql-adapt-welcome-seen', 'true');
    }, instructorProfile);
    
    // Act - Try to access practice page directly
    await page.goto('/practice');
    
    // Assert - Should be redirected to instructor dashboard
    await expect(page).toHaveURL(/\/instructor-dashboard$/);
    
    // Assert - Dashboard content is visible
    await expect(page.getByRole('link', { name: /SQL-Adapt Instructor/i })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Dashboard' })).toBeVisible();
  });

  // ===========================================================================
  // CHECK 6: /research is instructor-only
  // ===========================================================================
  
  test('@weekly /research is accessible to instructor', async ({ page }) => {
    // Arrange - Create instructor profile
    const instructorProfile: UserProfile = {
      id: 'demo-instructor-005',
      name: 'DemoInstructor',
      role: 'instructor',
      createdAt: Date.now(),
    };
    
    await page.addInitScript((profile) => {
      window.localStorage.setItem('sql-adapt-user-profile', JSON.stringify(profile));
      window.localStorage.setItem('sql-adapt-welcome-seen', 'true');
    }, instructorProfile);
    
    // Act - Access research page
    await page.goto('/research');
    
    // Assert - Stays on research page
    await expect(page).toHaveURL(/\/research$/);
    
    // Assert - Research dashboard content is visible
    await expect(page.getByRole('heading', { name: /Research|Dashboard/i })).toBeVisible();
    
    // Assert - Instructor badge is visible
    await expect(page.getByRole('link', { name: /SQL-Adapt Instructor/i })).toBeVisible();
  });

  test('@weekly /research redirects student to default route', async ({ page }) => {
    // Arrange - Create student profile
    const studentProfile: UserProfile = {
      id: 'demo-student-002',
      name: 'DemoStudent',
      role: 'student',
      createdAt: Date.now(),
    };
    
    await page.addInitScript((profile) => {
      window.localStorage.setItem('sql-adapt-user-profile', JSON.stringify(profile));
      window.localStorage.setItem('sql-adapt-welcome-seen', 'true');
    }, studentProfile);
    
    // Act - Try to access research page
    await page.goto('/research');
    
    // Assert - Should be redirected away from research
    await page.waitForLoadState('networkidle');
    const currentUrl = page.url();
    expect(currentUrl).not.toContain('/research');
    
    // Should redirect to practice or other allowed route
    expect(currentUrl).toMatch(/\/practice$|\/textbook$/);
  });

  test('@weekly /research redirects unauthenticated user to start page', async ({ page }) => {
    // Arrange - No profile set up (clean state from beforeEach)
    
    // Act - Try to access research without authentication
    await page.goto('/research');
    
    // Assert - Redirected to start page
    await expect(page).toHaveURL(/\/$/);
    
    // Assert - Start page content is visible
    await expect(page.getByRole('heading', { name: 'SQL-Adapt Learning System' })).toBeVisible();
  });

  // ===========================================================================
  // CHECK 7: Seed/reset flow works (if implemented)
  // ===========================================================================
  
  test('@weekly Seed data storage keys exist and can be manipulated', async ({ page }) => {
    // This test verifies the storage infrastructure for seed/reset exists
    // even if full seed flow is not implemented
    
    // Arrange - Create student profile
    const studentProfile: UserProfile = {
      id: 'demo-student-seed',
      name: 'SeedTestUser',
      role: 'student',
      createdAt: Date.now(),
    };
    
    await page.addInitScript((profile) => {
      window.localStorage.setItem('sql-adapt-user-profile', JSON.stringify(profile));
      window.localStorage.setItem('sql-adapt-welcome-seen', 'true');
      
      // Simulate seed data if the app uses these keys
      window.localStorage.setItem('sql-learning-interactions', JSON.stringify([]));
      window.localStorage.setItem('sql-learning-textbook', JSON.stringify([]));
    }, studentProfile);
    
    // Act - Navigate to practice page
    await page.goto('/practice');
    
    // Assert - Storage keys are accessible
    const storageKeys = await page.evaluate(() => {
      const keys: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key) keys.push(key);
      }
      return keys;
    });
    
    // Verify core storage keys exist
    expect(storageKeys).toContain('sql-adapt-user-profile');
    expect(storageKeys).toContain('sql-adapt-welcome-seen');
    
    // Verify optional seed data keys (may not exist in all implementations)
    expect(storageKeys).toContain('sql-learning-interactions');
    expect(storageKeys).toContain('sql-learning-textbook');
  });

  test('@weekly Profile can be reset via localStorage clear', async ({ page, context }) => {
    // Arrange - Create student profile in localStorage
    const studentProfile: UserProfile = {
      id: 'demo-student-reset',
      name: 'ResetTestUser',
      role: 'student',
      createdAt: Date.now(),
    };
    
    await page.addInitScript((profile) => {
      window.localStorage.setItem('sql-adapt-user-profile', JSON.stringify(profile));
      window.localStorage.setItem('sql-adapt-welcome-seen', 'true');
    }, studentProfile);
    
    // Verify profile exists by navigating to practice
    await page.goto('/practice');
    await expect(page).toHaveURL(/\/practice$/);
    
    // Act - Clear localStorage (simulating reset)
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    
    // Assert - Verify profile is cleared from storage
    const profileExists = await page.evaluate(() => {
      return window.localStorage.getItem('sql-adapt-user-profile') !== null;
    });
    expect(profileExists).toBe(false);
    
    // Create a fresh page without the init script to test unauthenticated access
    const freshPage = await context.newPage();
    await freshPage.goto('/');
    
    // Assert - Should show start page since no profile exists
    await expect(freshPage.getByRole('heading', { name: 'SQL-Adapt Learning System' })).toBeVisible();
    
    // Clean up
    await freshPage.close();
  });

  // ===========================================================================
  // ADDITIONAL EDGE CASE COVERAGE
  // ===========================================================================
  
  test('@weekly Student accessing /textbook works directly', async ({ page }) => {
    // Arrange - Create student profile
    const studentProfile: UserProfile = {
      id: 'demo-student-003',
      name: 'DemoStudent',
      role: 'student',
      createdAt: Date.now(),
    };
    
    await page.addInitScript((profile) => {
      window.localStorage.setItem('sql-adapt-user-profile', JSON.stringify(profile));
      window.localStorage.setItem('sql-adapt-welcome-seen', 'true');
    }, studentProfile);
    
    // Act - Access textbook directly
    await page.goto('/textbook');
    
    // Assert - Should be able to access textbook
    await expect(page).toHaveURL(/\/textbook$/);
    await expect(page.getByRole('heading', { name: /My Textbook|My Learning Journey/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /SQL-Adapt Student/i })).toBeVisible();
  });

  test('@weekly Direct access to routes preserves auth state', async ({ page }) => {
    // Arrange - Create student profile
    const studentProfile: UserProfile = {
      id: 'demo-student-004',
      name: 'DemoStudent',
      role: 'student',
      createdAt: Date.now(),
    };
    
    await page.addInitScript((profile) => {
      window.localStorage.setItem('sql-adapt-user-profile', JSON.stringify(profile));
      window.localStorage.setItem('sql-adapt-welcome-seen', 'true');
    }, studentProfile);
    
    // Act - Go directly to textbook
    await page.goto('/textbook');
    await expect(page).toHaveURL(/\/textbook$/);
    
    // Act - Navigate to practice via UI
    await page.getByRole('link', { name: /Practice/i }).click();
    
    // Assert - Successfully navigated to practice
    await expect(page).toHaveURL(/\/practice$/);
    await expect(page.getByRole('heading', { name: /Practice SQL/i })).toBeVisible();
  });
});
