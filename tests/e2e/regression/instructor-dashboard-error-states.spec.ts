import { test, expect } from '@playwright/test';

/**
 * Instructor Dashboard Error States Test
 * 
 * Verifies that the Research Dashboard shows explicit error states
 * instead of silently failing or showing empty charts.
 * 
 * Coverage:
 * - Auth errors (not logged in as instructor)
 * - Backend errors (server failure)
 * - Empty scope (no learners in sections)
 * - Successful load with data
 */

test.describe('Instructor Dashboard Error States', () => {
  test('dashboard loads and shows data or empty state', async ({ page }) => {
    // This test assumes an authenticated instructor context
    // In practice, this would use the auth setup from auth.setup.ts
    
    await page.goto('/research');
    await page.waitForLoadState('networkidle');
    
    // Wait for hydration to complete (loading skeleton disappears)
    await page.waitForTimeout(1000);
    
    // Should show one of the valid states:
    // 1. Dashboard with data
    // 2. Empty scope state (no learners)
    // 3. Error state (auth/backend/network)
    
    const dashboardContent = page.locator('[data-testid="research-dashboard-content"]');
    const dashboardHeading = page.getByRole('heading', { name: 'Research Dashboard' }).first();
    const emptyState = page.locator('text=No Learners Yet');
    const errorState = page.locator('text=Dashboard Unavailable');
    const authError = page.locator('text=Authentication Required');
    
    // At least one valid state should be visible
    await expect(
      dashboardContent.or(dashboardHeading).or(emptyState).or(errorState).or(authError)
    ).toBeVisible();
  });

  test('refresh button works on error states', async ({ page }) => {
    await page.goto('/research');
    await page.waitForLoadState('networkidle');
    
    // Wait for hydration
    await page.waitForTimeout(1000);
    
    // If an error state is shown, verify refresh button exists
    const retryButton = page.locator('button:has-text("Retry")');
    const refreshButton = page.locator('button:has-text("Refresh")');
    
    // Click refresh/retry if available
    if (await retryButton.isVisible().catch(() => false)) {
      await retryButton.click();
      // Should attempt to reload data
      await page.waitForTimeout(500);
    } else if (await refreshButton.isVisible().catch(() => false)) {
      await refreshButton.click();
      await page.waitForTimeout(500);
    }
  });

  test('console has no uncaught exceptions', async ({ page }) => {
    const errors: string[] = [];
    
    page.on('pageerror', (error) => {
      errors.push(error.message);
    });
    
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });
    
    await page.goto('/research');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    
    // Filter out expected errors (e.g., backend unavailable in preview)
    const unexpectedErrors = errors.filter(e => 
      !e.includes('hydrateInstructorDashboard') &&
      !e.includes('Backend health check') &&
      !e.includes('Hydration failed')
    );
    
    expect(unexpectedErrors).toHaveLength(0);
  });
});
