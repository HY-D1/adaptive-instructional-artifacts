import { test, expect } from '@playwright/test';

test.describe('WS-5: Instructor Dashboard Audit', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/instructor-dashboard');
    await page.waitForLoadState('networkidle');
  });

  test('dashboard metrics display correctly', async ({ page }) => {
    const totalStudents = page.locator('[data-testid="instructor-total-students-value"]');
    const activeToday = page.locator('[data-testid="instructor-active-today-value"]');
    const avgProgress = page.locator('[data-testid="instructor-avg-progress-value"]');
    const totalInteractions = page.locator('[data-testid="instructor-total-interactions-value"]');
    
    await expect(totalStudents).toBeVisible();
    await expect(activeToday).toBeVisible();
    await expect(avgProgress).toBeVisible();
    await expect(totalInteractions).toBeVisible();
  });

  test('learner table is readable', async ({ page }) => {
    const studentTable = page.locator('[data-testid="instructor-student-table-body"]');
    await expect(studentTable).toBeVisible();
  });
});
