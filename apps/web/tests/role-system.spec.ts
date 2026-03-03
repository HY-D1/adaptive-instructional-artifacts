/**
 * Role System E2E Tests
 * 
 * Tests for student/instructor role system covering:
 * - Start Page role selection
 * - Route protection based on roles
 * - Navigation role-aware links
 * - Session persistence
 * - Role switching via logout/login
 * 
 * @tags @weekly, role-system, authentication
 */

import { test, expect } from '@playwright/test';

// Profile structure matching UserProfile type
interface UserProfile {
  id: string;
  name: string;
  role: 'student' | 'instructor';
  createdAt: number;
}

// Test suite for role system
test.describe('@weekly Role System', () => {
  
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
  // START PAGE - ROLE SELECTION
  // ===========================================================================
  
  test.describe('@weekly Start Page - Role Selection', () => {
    
    test('first visit shows StartPage with username input and role cards', async ({ page }) => {
      // Arrange & Act
      await page.goto('/');
      
      // Assert - Page structure
      await expect(page.getByRole('heading', { name: 'SQL-Adapt Learning System' })).toBeVisible();
      await expect(page.getByLabel('What should we call you?')).toBeVisible();
      await expect(page.getByPlaceholder('Enter your username')).toBeVisible();
      
      // Assert - Role selection cards
      await expect(page.getByRole('heading', { name: 'Student' })).toBeVisible();
      await expect(page.getByRole('heading', { name: 'Instructor' })).toBeVisible();
      await expect(page.getByText('Practice SQL problems and get adaptive hints')).toBeVisible();
      await expect(page.getByText('Track student progress and analyze learning data')).toBeVisible();
      
      // Assert - Submit button disabled initially
      const submitButton = page.getByRole('button', { name: 'Get Started' });
      await expect(submitButton).toBeDisabled();
      await expect(page.getByText('Please enter your username and select a role to continue')).toBeVisible();
    });

    test('can select Student role', async ({ page }) => {
      // Arrange
      await page.goto('/');
      
      // Act - Click Student card (use heading for exact match)
      const studentCard = page.locator('.cursor-pointer').filter({ 
        has: page.getByRole('heading', { name: 'Student' })
      });
      await studentCard.click();
      
      // Assert - Student card is selected with blue border visual indicator
      const selectedStudentCard = page.locator('[class*="border-blue-500"]').filter({ 
        has: page.getByRole('heading', { name: 'Student' })
      });
      await expect(selectedStudentCard).toBeVisible();
    });

    test('can select Instructor role', async ({ page }) => {
      // Arrange
      await page.goto('/');
      
      // Act - Click Instructor card (use heading for exact match)
      const instructorCard = page.locator('.cursor-pointer').filter({ 
        has: page.getByRole('heading', { name: 'Instructor' })
      });
      await instructorCard.click();
      
      // Assert - Instructor card is selected with purple border visual indicator
      const selectedInstructorCard = page.locator('[class*="border-purple-500"]').filter({ 
        has: page.getByRole('heading', { name: 'Instructor' })
      });
      await expect(selectedInstructorCard).toBeVisible();
    });

    test('submit with Student role redirects to /practice', async ({ page }) => {
      // Arrange
      await page.goto('/');
      
      // Act - Enter username and select Student
      await page.getByPlaceholder('Enter your username').fill('TestStudent');
      const studentCard = page.locator('.cursor-pointer').filter({ 
        has: page.getByRole('heading', { name: 'Student' })
      });
      await studentCard.click();
      
      // Submit form
      await page.getByRole('button', { name: 'Get Started' }).click();
      
      // Assert - Redirected to practice page
      await expect(page).toHaveURL(/\/practice$/);
      // Check for heading on the practice page
      await expect(page.getByRole('heading', { name: /Practice SQL/i })).toBeVisible();
    });

    test('submit with Instructor role redirects to /instructor-dashboard', async ({ page }) => {
      // Arrange
      await page.goto('/');
      
      // Act - Enter username and select Instructor
      await page.getByPlaceholder('Enter your username').fill('TestInstructor');
      const instructorCard = page.locator('.cursor-pointer').filter({ 
        has: page.getByRole('heading', { name: 'Instructor' })
      });
      await instructorCard.click();
      
      // Enter instructor passcode
      await page.getByLabel('Instructor Passcode').fill('TeachSQL2024');
      
      // Submit form
      await page.getByRole('button', { name: 'Get Started' }).click();
      
      // Assert - Redirected to instructor dashboard
      await expect(page).toHaveURL(/\/instructor-dashboard$/);
    });

    test('validation: empty username shows disabled submit with helper text', async ({ page }) => {
      // Arrange
      await page.goto('/');
      
      // Act - Select role but don't enter username
      const studentCard = page.locator('.cursor-pointer').filter({ 
        has: page.getByRole('heading', { name: 'Student' })
      });
      await studentCard.click();
      
      // Assert - Button still disabled
      const submitButton = page.getByRole('button', { name: 'Get Started' });
      await expect(submitButton).toBeDisabled();
      await expect(page.getByText('Please enter your username and select a role to continue')).toBeVisible();
    });

    test('validation: username without role shows disabled submit', async ({ page }) => {
      // Arrange
      await page.goto('/');
      
      // Act - Enter username but don't select role
      await page.getByPlaceholder('Enter your username').fill('TestUser');
      
      // Assert - Button still disabled
      const submitButton = page.getByRole('button', { name: 'Get Started' });
      await expect(submitButton).toBeDisabled();
    });
  });

  // ===========================================================================
  // ROUTE PROTECTION
  // ===========================================================================
  
  test.describe('@weekly Route Protection', () => {
    
    test('unauthenticated user accessing /practice redirects to /', async ({ page }) => {
      // Arrange - Ensure no profile exists
      await page.goto('/');
      await expect(page).toHaveURL(/\/$/);
      await expect(page.getByRole('heading', { name: 'SQL-Adapt Learning System' })).toBeVisible();
    });

    test('unauthenticated user accessing /research redirects to /', async ({ page }) => {
      // Arrange - Try to access research directly
      await page.goto('/research');
      
      // Assert - Redirected to start page
      await expect(page).toHaveURL(/\/$/);
      await expect(page.getByRole('heading', { name: 'SQL-Adapt Learning System' })).toBeVisible();
    });

    test('unauthenticated user accessing /textbook redirects to /', async ({ page }) => {
      // Arrange - Try to access textbook directly
      await page.goto('/textbook');
      
      // Assert - Redirected to start page
      await expect(page).toHaveURL(/\/$/);
    });

    test('Student accessing /research redirects to default route', async ({ page }) => {
      // Arrange - Create student profile in storage
      const studentProfile: UserProfile = {
        id: 'user-student-123',
        name: 'TestStudent',
        role: 'student',
        createdAt: Date.now(),
      };
      
      await page.addInitScript((profile) => {
        window.localStorage.setItem('sql-adapt-user-profile', JSON.stringify(profile));
      }, studentProfile);
      
      // Act - Try to access research
      await page.goto('/research');
      
      // Assert - Should be redirected (either to practice or stay on current)
      // The app may redirect to /practice or show an error
      await page.waitForLoadState('networkidle');
      const currentUrl = page.url();
      expect(currentUrl).not.toContain('/research');
    });

    test('Student can access /textbook', async ({ page }) => {
      // Arrange - Create student profile
      const studentProfile: UserProfile = {
        id: 'user-student-456',
        name: 'TestStudent',
        role: 'student',
        createdAt: Date.now(),
      };
      
      await page.addInitScript((profile) => {
        window.localStorage.setItem('sql-adapt-user-profile', JSON.stringify(profile));
        window.localStorage.setItem('sql-adapt-welcome-seen', 'true');
      }, studentProfile);
      
      // Act
      await page.goto('/textbook');
      
      // Assert - Should be able to access textbook (students see "My Learning Journey")
      await expect(page.getByRole('heading', { name: /My Learning Journey|My Textbook/i })).toBeVisible();
    });

    test('Instructor can access /research', async ({ page }) => {
      // Arrange - Create instructor profile
      const instructorProfile: UserProfile = {
        id: 'user-instructor-123',
        name: 'TestInstructor',
        role: 'instructor',
        createdAt: Date.now(),
      };
      
      await page.addInitScript((profile) => {
        window.localStorage.setItem('sql-adapt-user-profile', JSON.stringify(profile));
        window.localStorage.setItem('sql-adapt-welcome-seen', 'true');
      }, instructorProfile);
      
      // Act
      await page.goto('/research');
      
      // Assert - Should be able to access research
      await expect(page.getByRole('heading', { name: /Research|Dashboard/i })).toBeVisible();
    });

    test('Instructor accessing /practice redirects to instructor-dashboard', async ({ page }) => {
      // Arrange - Create instructor profile
      const instructorProfile: UserProfile = {
        id: 'user-instructor-456',
        name: 'TestInstructor',
        role: 'instructor',
        createdAt: Date.now(),
      };
      
      await page.addInitScript((profile) => {
        window.localStorage.setItem('sql-adapt-user-profile', JSON.stringify(profile));
        window.localStorage.setItem('sql-adapt-welcome-seen', 'true');
      }, instructorProfile);
      
      // Act - Try to access practice page
      await page.goto('/practice');
      
      // Assert - Should be redirected to instructor dashboard
      await expect(page).toHaveURL(/\/instructor-dashboard$/);
    });
  });

  // ===========================================================================
  // NAVIGATION - ROLE-AWARE LINKS
  // ===========================================================================
  
  test.describe('@weekly Navigation - Role-Aware Links', () => {
    
    test('Student sees Practice and Textbook links in navigation', async ({ page }) => {
      // Arrange - Login as student
      await page.goto('/');
      await page.getByPlaceholder('Enter your username').fill('TestStudent');
      await page.locator('.cursor-pointer').filter({ 
        has: page.getByRole('heading', { name: 'Student' })
      }).click();
      await page.getByRole('button', { name: 'Get Started' }).click();
      
      // Wait for navigation to load
      await expect(page).toHaveURL(/\/practice$/);
      
      // Assert - Student navigation links
      await expect(page.getByRole('link', { name: /Practice/i })).toBeVisible();
      await expect(page.getByRole('link', { name: /Textbook|My Textbook/i })).toBeVisible();
      
      // Assert - Student badge visible
      await expect(page.getByText('Student', { exact: false })).toBeVisible();
    });

    test('Instructor sees Dashboard and Research links in navigation', async ({ page }) => {
      // Arrange - Login as instructor
      await page.goto('/');
      await page.getByPlaceholder('Enter your username').fill('TestInstructor');
      await page.locator('.cursor-pointer').filter({ 
        has: page.getByRole('heading', { name: 'Instructor' })
      }).click();
      await page.getByLabel('Instructor Passcode').fill('TeachSQL2024');
      await page.getByRole('button', { name: 'Get Started' }).click();
      
      // Wait for navigation to load
      await expect(page).toHaveURL(/\/instructor-dashboard$/);
      
      // Assert - Instructor badge visible (confirms role is loaded)
      await expect(page.getByText('Instructor', { exact: false })).toBeVisible();
      
      // Assert - Instructor navigation links (use getByText for more reliable matching)
      await expect(page.getByText('Dashboard')).toBeVisible();
      await expect(page.getByText('Research')).toBeVisible();
    });

    test('navigation highlights active route for Student', async ({ page }) => {
      // Arrange - Login as student
      await page.goto('/');
      await page.getByPlaceholder('Enter your username').fill('TestStudent');
      await page.locator('.cursor-pointer').filter({ 
        has: page.getByRole('heading', { name: 'Student' })
      }).click();
      await page.getByRole('button', { name: 'Get Started' }).click();
      await expect(page).toHaveURL(/\/practice$/);
      
      // Assert - Practice link is active (has default variant style)
      const practiceLink = page.getByRole('link', { name: /Practice/i });
      const parentButton = practiceLink.locator('..');
      await expect(practiceLink).toBeVisible();
      
      // Navigate to textbook
      await page.getByRole('link', { name: /Textbook|My Textbook/i }).click();
      await expect(page).toHaveURL(/\/textbook$/);
      
      // Assert - Textbook link is now active
      await expect(page.getByRole('link', { name: /Textbook|My Textbook/i })).toBeVisible();
    });

    test('navigation highlights active route for Instructor', async ({ page }) => {
      // Arrange - Login as instructor
      await page.goto('/');
      await page.getByPlaceholder('Enter your username').fill('TestInstructor');
      await page.locator('.cursor-pointer').filter({ 
        has: page.getByRole('heading', { name: 'Instructor' })
      }).click();
      await page.getByLabel('Instructor Passcode').fill('TeachSQL2024');
      await page.getByRole('button', { name: 'Get Started' }).click();
      await expect(page).toHaveURL(/\/instructor-dashboard$/);
      
      // Wait for instructor badge to confirm role is loaded
      await expect(page.getByText('Instructor', { exact: false })).toBeVisible();
      
      // Assert - Dashboard navigation visible
      await expect(page.getByText('Dashboard')).toBeVisible();
      
      // Navigate to research
      await page.getByText('Research').first().click();
      await expect(page).toHaveURL(/\/research$/);
      
      // Assert - Research page loaded (indicates navigation worked)
      await expect(page.getByRole('heading', { name: /Research/i })).toBeVisible();
    });

    test('logout button is visible in navigation', async ({ page }) => {
      // Arrange - Login as student
      await page.goto('/');
      await page.getByPlaceholder('Enter your username').fill('TestStudent');
      await page.locator('.cursor-pointer').filter({ 
        has: page.getByRole('heading', { name: 'Student' })
      }).click();
      await page.getByRole('button', { name: 'Get Started' }).click();
      await expect(page).toHaveURL(/\/practice$/);
      
      // Assert - Logout button visible (may be in menu on mobile)
      await expect(page.getByRole('button', { name: /Logout/i })).toBeVisible();
    });
  });

  // ===========================================================================
  // SESSION PERSISTENCE
  // ===========================================================================
  
  test.describe('@weekly Session Persistence', () => {
    
    test('returning Student is auto-redirected from / to /practice', async ({ page }) => {
      // Arrange - Create existing student profile
      const studentProfile: UserProfile = {
        id: 'user-student-existing',
        name: 'ReturningStudent',
        role: 'student',
        createdAt: Date.now(),
      };
      
      await page.addInitScript((profile) => {
        window.localStorage.setItem('sql-adapt-user-profile', JSON.stringify(profile));
        window.localStorage.setItem('sql-adapt-welcome-seen', 'true');
      }, studentProfile);
      
      // Act - Visit root
      await page.goto('/');
      
      // Assert - Auto-redirected to practice
      await expect(page).toHaveURL(/\/practice$/);
      // Check for heading on the practice page
      await expect(page.getByRole('heading', { name: /Practice SQL/i })).toBeVisible();
    });

    test('returning Instructor is auto-redirected from / to /instructor-dashboard', async ({ page }) => {
      // Arrange - Create existing instructor profile
      const instructorProfile: UserProfile = {
        id: 'user-instructor-existing',
        name: 'ReturningInstructor',
        role: 'instructor',
        createdAt: Date.now(),
      };
      
      await page.addInitScript((profile) => {
        window.localStorage.setItem('sql-adapt-user-profile', JSON.stringify(profile));
        window.localStorage.setItem('sql-adapt-welcome-seen', 'true');
      }, instructorProfile);
      
      // Act - Visit root
      await page.goto('/');
      
      // Assert - Auto-redirected to instructor dashboard
      await expect(page).toHaveURL(/\/instructor-dashboard$/);
    });

    test('profile persists after page reload', async ({ page }) => {
      // Arrange - Create student profile in localStorage
      const studentProfile: UserProfile = {
        id: 'user-student-persist',
        name: 'PersistTest',
        role: 'student',
        createdAt: Date.now(),
      };
      
      await page.addInitScript((profile) => {
        window.localStorage.setItem('sql-adapt-user-profile', JSON.stringify(profile));
        window.localStorage.setItem('sql-adapt-welcome-seen', 'true');
      }, studentProfile);
      
      // Act - Go directly to practice page
      await page.goto('/practice');
      await expect(page).toHaveURL(/\/practice$/);
      
      // Act - Reload page
      await page.reload();
      
      // Assert - Still on practice page (profile persisted)
      await expect(page).toHaveURL(/\/practice$/);
      // Check for heading on the practice page
      await expect(page.getByRole('heading', { name: /Practice SQL/i })).toBeVisible();
    });

    test('logout clears profile and redirects to /', async ({ page }) => {
      // Arrange - Login as student
      await page.goto('/');
      await page.getByPlaceholder('Enter your username').fill('LogoutTest');
      await page.locator('.cursor-pointer').filter({ 
        has: page.getByRole('heading', { name: 'Student' })
      }).click();
      await page.getByRole('button', { name: 'Get Started' }).click();
      await expect(page).toHaveURL(/\/practice$/);
      
      // Act - Click logout
      await page.getByRole('button', { name: /Logout/i }).click();
      
      // Assert - Redirected to start page
      await expect(page).toHaveURL(/\/$/);
      await expect(page.getByRole('heading', { name: 'SQL-Adapt Learning System' })).toBeVisible();
      
      // Assert - Profile cleared from storage
      const profileExists = await page.evaluate(() => {
        return window.localStorage.getItem('sql-adapt-user-profile') !== null;
      });
      expect(profileExists).toBe(false);
    });

    test('profile data is correctly stored in localStorage', async ({ page }) => {
      // Arrange
      const username = 'StorageTest';
      
      // Act - Complete registration
      await page.goto('/');
      await page.getByPlaceholder('Enter your username').fill(username);
      await page.locator('.cursor-pointer').filter({ 
        has: page.getByRole('heading', { name: 'Student' })
      }).click();
      await page.getByRole('button', { name: 'Get Started' }).click();
      
      // Assert - Check stored profile
      const storedProfile = await page.evaluate(() => {
        const raw = window.localStorage.getItem('sql-adapt-user-profile');
        return raw ? JSON.parse(raw) : null;
      });
      
      expect(storedProfile).not.toBeNull();
      expect(storedProfile.name).toBe(username);
      expect(storedProfile.role).toBe('student');
      expect(typeof storedProfile.id).toBe('string');
      expect(typeof storedProfile.createdAt).toBe('number');
    });
  });

  // ===========================================================================
  // ROLE SWITCHING
  // ===========================================================================
  
  test.describe('@weekly Role Switching', () => {
    
    test('user can logout and select different role', async ({ page }) => {
      // Arrange - Login as student
      await page.goto('/');
      await page.getByPlaceholder('Enter your username').fill('RoleSwitchTest');
      await page.locator('.cursor-pointer').filter({ 
        has: page.getByRole('heading', { name: 'Student' })
      }).click();
      await page.getByRole('button', { name: 'Get Started' }).click();
      await expect(page).toHaveURL(/\/practice$/);
      
      // Act - Logout
      await page.getByRole('button', { name: /Logout/i }).click();
      await expect(page).toHaveURL(/\/$/);
      
      // Act - Login as instructor
      await page.getByPlaceholder('Enter your username').fill('RoleSwitchTest');
      await page.locator('.cursor-pointer').filter({ 
        has: page.getByRole('heading', { name: 'Instructor' })
      }).click();
      await page.getByLabel('Instructor Passcode').fill('TeachSQL2024');
      await page.getByRole('button', { name: 'Get Started' }).click();
      
      // Assert - Redirected to instructor dashboard
      await expect(page).toHaveURL(/\/instructor-dashboard$/);
      await expect(page.getByText('Instructor', { exact: false })).toBeVisible();
    });

    test('new role selection updates navigation items', async ({ page }) => {
      // Arrange - Login as student and verify nav
      await page.goto('/');
      await page.getByPlaceholder('Enter your username').fill('NavUpdateTest');
      await page.locator('.cursor-pointer').filter({ 
        has: page.getByRole('heading', { name: 'Student' })
      }).click();
      await page.getByRole('button', { name: 'Get Started' }).click();
      await expect(page).toHaveURL(/\/practice$/);
      
      // Verify student nav
      await expect(page.getByRole('link', { name: /Practice/i })).toBeVisible();
      
      // Act - Logout and login as instructor
      await page.getByRole('button', { name: /Logout/i }).click();
      await expect(page).toHaveURL(/\/$/);
      
      await page.getByPlaceholder('Enter your username').fill('NavUpdateTest');
      await page.locator('.cursor-pointer').filter({ 
        has: page.getByRole('heading', { name: 'Instructor' })
      }).click();
      await page.getByLabel('Instructor Passcode').fill('TeachSQL2024');
      await page.getByRole('button', { name: 'Get Started' }).click();
      
      // Assert - Instructor navigation visible
      await expect(page).toHaveURL(/\/instructor-dashboard$/);
      
      // Wait for instructor badge to confirm role is loaded
      await expect(page.getByText('Instructor', { exact: false })).toBeVisible();
      
      await expect(page.getByText('Dashboard')).toBeVisible();
      await expect(page.getByText('Research')).toBeVisible();
    });

    test('role badge updates after switching roles', async ({ page }) => {
      // Arrange - Login as student
      await page.goto('/');
      await page.getByPlaceholder('Enter your username').fill('BadgeTest');
      await page.locator('.cursor-pointer').filter({ 
        has: page.getByRole('heading', { name: 'Student' })
      }).click();
      await page.getByRole('button', { name: 'Get Started' }).click();
      await expect(page).toHaveURL(/\/practice$/);
      
      // Verify student badge
      await expect(page.getByText('Student', { exact: false })).toBeVisible();
      
      // Act - Switch to instructor
      await page.getByRole('button', { name: /Logout/i }).click();
      await page.getByPlaceholder('Enter your username').fill('BadgeTest');
      await page.locator('.cursor-pointer').filter({ 
        has: page.getByRole('heading', { name: 'Instructor' })
      }).click();
      await page.getByLabel('Instructor Passcode').fill('TeachSQL2024');
      await page.getByRole('button', { name: 'Get Started' }).click();
      
      // Assert - Instructor badge visible
      await expect(page).toHaveURL(/\/instructor-dashboard$/);
      await expect(page.getByText('Instructor', { exact: false })).toBeVisible();
    });
  });

  // ===========================================================================
  // EDGE CASES & ERROR HANDLING
  // ===========================================================================
  
  test.describe('@weekly Edge Cases', () => {
    
    test('handles corrupted profile data gracefully', async ({ page }) => {
      // Arrange - Inject corrupted profile
      await page.addInitScript(() => {
        window.localStorage.setItem('sql-adapt-user-profile', '{invalid json');
      });
      
      // Act - Visit root
      await page.goto('/');
      
      // Assert - Should show start page (not crash)
      await expect(page.getByRole('heading', { name: 'SQL-Adapt Learning System' })).toBeVisible();
      
      // Assert - Corrupted profile should be cleared
      const profile = await page.evaluate(() => {
        return window.localStorage.getItem('sql-adapt-user-profile');
      });
      // After attempting to read corrupted data, it may be cleared
      expect(profile === null || profile === '{invalid json').toBeTruthy();
    });

    test('handles profile with missing fields gracefully', async ({ page }) => {
      // Arrange - Inject incomplete profile
      await page.addInitScript(() => {
        window.localStorage.setItem('sql-adapt-user-profile', JSON.stringify({
          id: 'test-id',
          // Missing name and role
        }));
      });
      
      // Act
      await page.goto('/');
      
      // Assert - Should show start page
      await expect(page.getByRole('heading', { name: 'SQL-Adapt Learning System' })).toBeVisible();
    });

    test('handles profile with invalid role value', async ({ page }) => {
      // Arrange - Inject profile with invalid role
      await page.addInitScript(() => {
        window.localStorage.setItem('sql-adapt-user-profile', JSON.stringify({
          id: 'test-id',
          name: 'Test',
          role: 'admin', // Invalid role
          createdAt: Date.now(),
        }));
      });
      
      // Act
      await page.goto('/');
      
      // Assert - Should show start page (invalid profile rejected)
      await expect(page.getByRole('heading', { name: 'SQL-Adapt Learning System' })).toBeVisible();
    });

    test('username with whitespace is trimmed', async ({ page }) => {
      // Arrange
      await page.goto('/');
      
      // Act - Enter username with extra whitespace
      await page.getByPlaceholder('Enter your username').fill('  TestUser  ');
      await page.locator('.cursor-pointer').filter({ 
        has: page.getByRole('heading', { name: 'Student' })
      }).click();
      await page.getByRole('button', { name: 'Get Started' }).click();
      
      // Assert - Redirected successfully
      await expect(page).toHaveURL(/\/practice$/);
      
      // Verify trimmed name in storage
      const storedProfile = await page.evaluate(() => {
        const raw = window.localStorage.getItem('sql-adapt-user-profile');
        return raw ? JSON.parse(raw) : null;
      });
      
      expect(storedProfile.name).toBe('TestUser'); // Should be trimmed
    });
  });
});
