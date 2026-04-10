import type { Page } from '@playwright/test';
import fs from 'fs';
import { INSTRUCTOR_AUTH_FILE, STUDENT_AUTH_FILE } from './auth-state-paths';
import { resolveFrontendBaseUrl } from './auth-env';

const FRONTEND_URL = resolveFrontendBaseUrl();

/**
 * Login as instructor using stored auth state
 * Falls back to manual login if auth state not available
 */
export async function loginAsInstructor(page: Page): Promise<void> {
  // Try to use stored auth state first
  if (fs.existsSync(INSTRUCTOR_AUTH_FILE)) {
    try {
      const state = JSON.parse(fs.readFileSync(INSTRUCTOR_AUTH_FILE, 'utf-8'));
      if (state.cookies?.length > 0 || state.origins?.length > 0) {
        // Load the stored state
        await page.context().addInitScript((storageState) => {
          // Restore localStorage/sessionStorage if present
          if (storageState.origins) {
            for (const origin of storageState.origins) {
              if (origin.origin === window.location.origin) {
                for (const item of origin.localStorage ?? []) {
                  localStorage.setItem(item.name, item.value);
                }
              }
            }
          }
        }, state);
        
        // Set cookies
        for (const cookie of state.cookies ?? []) {
          await page.context().addCookies([{
            name: cookie.name,
            value: cookie.value,
            domain: cookie.domain,
            path: cookie.path,
            expires: cookie.expires,
            httpOnly: cookie.httpOnly,
            secure: cookie.secure,
            sameSite: cookie.sameSite as 'Strict' | 'Lax' | 'None',
          }]);
        }
        
        // Navigate and verify logged in
        await page.goto(`${FRONTEND_URL}/instructor-dashboard`);
        
        // Check if we're actually logged in
        const isLoggedIn = await Promise.race([
          page.locator('text=Sign In').first().isVisible().catch(() => false).then(v => !v),
          page.locator('[data-testid="instructor-dashboard"]').first().isVisible().catch(() => false),
          page.waitForTimeout(3000).then(() => false),
        ]);
        
        if (isLoggedIn) {
          return;
        }
        // Fall through to manual login if state didn't work
      }
    } catch {
      // Fall through to manual login
    }
  }
  
  // Manual login fallback
  await page.goto(`${FRONTEND_URL}/login`);
  await page.waitForSelector('input[type="email"]', { timeout: 10000 });
  
  // Use environment variables or default test credentials
  const email = process.env.TEST_INSTRUCTOR_EMAIL || 'test-instructor@example.com';
  const password = process.env.TEST_INSTRUCTOR_PASSWORD || 'test-password';
  
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');
  
  // Wait for navigation
  await page.waitForURL(/\/(instructor-dashboard|dashboard)/, { timeout: 15000 });
}

/**
 * Login as student using stored auth state
 * Falls back to manual login if auth state not available
 */
export async function loginAsStudent(page: Page): Promise<void> {
  // Try to use stored auth state first
  if (fs.existsSync(STUDENT_AUTH_FILE)) {
    try {
      const state = JSON.parse(fs.readFileSync(STUDENT_AUTH_FILE, 'utf-8'));
      if (state.cookies?.length > 0 || state.origins?.length > 0) {
        // Load the stored state
        await page.context().addInitScript((storageState) => {
          // Restore localStorage/sessionStorage if present
          if (storageState.origins) {
            for (const origin of storageState.origins) {
              if (origin.origin === window.location.origin) {
                for (const item of origin.localStorage ?? []) {
                  localStorage.setItem(item.name, item.value);
                }
              }
            }
          }
        }, state);
        
        // Set cookies
        for (const cookie of state.cookies ?? []) {
          await page.context().addCookies([{
            name: cookie.name,
            value: cookie.value,
            domain: cookie.domain,
            path: cookie.path,
            expires: cookie.expires,
            httpOnly: cookie.httpOnly,
            secure: cookie.secure,
            sameSite: cookie.sameSite as 'Strict' | 'Lax' | 'None',
          }]);
        }
        
        // Navigate and verify logged in
        await page.goto(`${FRONTEND_URL}/practice`);
        
        // Check if we're actually logged in
        const isLoggedIn = await Promise.race([
          page.locator('text=Sign In').first().isVisible().catch(() => false).then(v => !v),
          page.locator('[data-testid="practice-page"]').first().isVisible().catch(() => false),
          page.waitForTimeout(3000).then(() => false),
        ]);
        
        if (isLoggedIn) {
          return;
        }
        // Fall through to manual login if state didn't work
      }
    } catch {
      // Fall through to manual login
    }
  }
  
  // Manual login fallback
  await page.goto(`${FRONTEND_URL}/login`);
  await page.waitForSelector('input[type="email"]', { timeout: 10000 });
  
  // Use environment variables or default test credentials
  const email = process.env.TEST_STUDENT_EMAIL || 'test-student@example.com';
  const password = process.env.TEST_STUDENT_PASSWORD || 'test-password';
  
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');
  
  // Wait for navigation
  await page.waitForURL(/\/(practice|dashboard)/, { timeout: 15000 });
}

/**
 * Logout the current user
 */
export async function logout(page: Page): Promise<void> {
  await page.goto(`${FRONTEND_URL}/logout`);
  await page.waitForTimeout(1000);
}

/**
 * Check if user is currently logged in
 */
export async function isLoggedIn(page: Page): Promise<boolean> {
  const hasAuthCookie = await page.evaluate(() => {
    return document.cookie.includes('auth=') || document.cookie.includes('token=');
  });
  
  if (!hasAuthCookie) {
    // Check localStorage for auth data
    const hasLocalAuth = await page.evaluate(() => {
      return !!localStorage.getItem('sql_adapt_auth') || !!localStorage.getItem('auth');
    });
    return hasLocalAuth;
  }
  
  return true;
}
