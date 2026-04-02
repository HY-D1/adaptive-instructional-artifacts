import { test, expect, type Page, type ConsoleMessage } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const OUTPUT_DIR = '/Users/HiMini/Desktop/Personal Portfolio/adaptive-instructional-artifacts/.claude/state/runs/run-1743545100';
const SCREENSHOTS_DIR = path.join(OUTPUT_DIR, 'screenshots');

// Ensure directories exist
try {
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
} catch {}

// Store console logs and issues
const consoleLogs: { type: string; text: string; location?: string }[] = [];
const issues: { severity: 'P0' | 'P1' | 'P2' | 'P3'; description: string; evidence: string; file_location?: string }[] = [];

function logIssue(severity: 'P0' | 'P1' | 'P2' | 'P3', description: string, evidence: string, file_location?: string) {
  issues.push({ severity, description, evidence, file_location });
  console.log(`[${severity}] ${description}: ${evidence}`);
}

// Setup console log capture
test.beforeEach(async ({ page }) => {
  consoleLogs.length = 0;
  
  page.on('console', (msg: ConsoleMessage) => {
    const type = msg.type();
    const text = msg.text();
    consoleLogs.push({ type, text, location: msg.location()?.url });
    
    if (type === 'error') {
      console.log(`Console error: ${text}`);
    }
  });
  
  page.on('pageerror', (err) => {
    consoleLogs.push({ type: 'pageerror', text: err.message });
    logIssue('P1', 'Page JavaScript error', err.message);
  });
});

test.describe('Student Onboarding & Auth Flow Audit', () => {
  
  test('StartPage - Initial load and form validation', async ({ page }) => {
    // Clear any existing storage
    await page.goto('http://localhost:5173');
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    
    // Reload fresh
    await page.goto('http://localhost:5173');
    await page.waitForLoadState('networkidle');
    
    // Screenshot: Initial state
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '01-startpage-initial.png'), fullPage: true });
    
    // Verify page title and header
    const header = await page.locator('h1').textContent();
    if (!header?.includes('SQL-Adapt')) {
      logIssue('P0', 'Missing or incorrect header', `Header text: "${header}"`, 'StartPage.tsx');
    }
    
    // Verify username input exists
    const usernameInput = page.locator('input#username');
    if (!(await usernameInput.isVisible().catch(() => false))) {
      logIssue('P0', 'Username input not visible', 'Input#username not found', 'StartPage.tsx:242');
    }
    
    // Verify role selection cards exist
    const studentCard = page.locator('text=Student').first();
    const instructorCard = page.locator('text=Instructor').first();
    
    if (!(await studentCard.isVisible().catch(() => false))) {
      logIssue('P0', 'Student role card not visible', 'Student card not found', 'StartPage.tsx:261');
    }
    
    // Check instructor card visibility based on config
    const isInstructorConfigured = await page.evaluate(() => {
      return document.body.textContent?.includes('Instructor mode not configured') === false;
    });
    
    console.log(`Instructor mode configured: ${isInstructorConfigured}`);
  });
  
  test('StartPage - Username validation', async ({ page }) => {
    await page.goto('http://localhost:5173');
    await page.waitForLoadState('networkidle');
    
    const usernameInput = page.locator('input#username');
    const submitButton = page.locator('button[type="submit"]');
    
    // Test empty username - button should be disabled
    await usernameInput.fill('');
    await page.locator('text=Student').first().click();
    
    const isDisabled = await submitButton.isDisabled().catch(() => false);
    if (!isDisabled) {
      logIssue('P1', 'Submit button not disabled with empty username', 'Button should be disabled when username is empty', 'StartPage.tsx:375');
    }
    
    // Test username with special characters
    await usernameInput.fill('test@user#123!');
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '02-username-special-chars.png') });
    
    // Test very long username
    await usernameInput.fill('a'.repeat(100));
    const longValue = await usernameInput.inputValue();
    if (longValue.length === 100) {
      // Check if there's any length validation
      logIssue('P2', 'No username length validation', 'Username accepts 100+ characters without validation', 'StartPage.tsx:247');
    }
    
    // Clear and enter valid username
    await usernameInput.fill('TestStudent');
    const value = await usernameInput.inputValue();
    if (value !== 'TestStudent') {
      logIssue('P1', 'Username input not accepting valid input', `Expected "TestStudent", got "${value}"`, 'StartPage.tsx:247');
    }
  });
  
  test('StartPage - Role selection UI feedback', async ({ page }) => {
    await page.goto('http://localhost:5173');
    await page.waitForLoadState('networkidle');
    
    // Click Student role
    const studentCard = page.locator('text=Student').first().locator('..').locator('..').locator('..');
    await page.locator('text=Student').first().click();
    
    await page.waitForTimeout(200);
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '03-role-student-selected.png') });
    
    // Check for visual feedback (blue border/bg for student)
    const studentCardElement = page.locator('.border-blue-500').first();
    const hasStudentStyling = await studentCardElement.isVisible().catch(() => false);
    
    if (!hasStudentStyling) {
      logIssue('P2', 'Student role selection lacks visual feedback', 'No blue border styling visible', 'StartPage.tsx:264-266');
    }
    
    // Try to select Instructor (if available)
    const instructorButton = page.locator('text=Instructor').first();
    if (await instructorButton.isVisible().catch(() => false)) {
      await instructorButton.click();
      await page.waitForTimeout(200);
      await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '04-role-instructor-selected.png') });
      
      // Check for passcode input
      const passcodeInput = page.locator('input#passcode');
      if (!(await passcodeInput.isVisible().catch(() => false))) {
        logIssue('P0', 'Passcode input not shown for instructor role', 'Passcode field should appear when instructor selected', 'StartPage.tsx:339');
      }
    }
  });
  
  test('StartPage - Instructor passcode validation', async ({ page }) => {
    await page.goto('http://localhost:5173');
    await page.waitForLoadState('networkidle');
    
    const instructorButton = page.locator('text=Instructor').first();
    if (!(await instructorButton.isVisible().catch(() => false))) {
      console.log('Instructor mode not configured, skipping passcode test');
      return;
    }
    
    // Select instructor role
    await instructorButton.click();
    
    // Enter username
    await page.locator('input#username').fill('TestInstructor');
    
    // Try incorrect passcode
    const passcodeInput = page.locator('input#passcode');
    await passcodeInput.fill('WrongPasscode');
    
    await page.locator('button[type="submit"]').click();
    await page.waitForTimeout(500);
    
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '05-passcode-error.png') });
    
    // Check for error message
    const errorMessage = page.locator('text=Incorrect passcode');
    if (!(await errorMessage.isVisible().catch(() => false))) {
      logIssue('P1', 'Passcode error message not displayed', 'Error message should appear for incorrect passcode', 'StartPage.tsx:359-366');
    }
    
    // Check error styling (red border)
    const hasErrorStyling = await passcodeInput.evaluate(el => {
      return el.classList.contains('border-red-500');
    }).catch(() => false);
    
    if (!hasErrorStyling) {
      logIssue('P2', 'Passcode input lacks error styling', 'Input should have red border on error', 'StartPage.tsx:354-357');
    }
    
    // Clear passcode and verify error clears
    await passcodeInput.fill('');
    await passcodeInput.fill('TeachSQL2024'); // Dev passcode from code
    
    const errorStillVisible = await errorMessage.isVisible().catch(() => false);
    if (errorStillVisible) {
      logIssue('P2', 'Passcode error not clearing on input change', 'Error should clear when user types', 'StartPage.tsx:350-353');
    }
  });
  
  test('AuthPage - Login form validation', async ({ page }) => {
    // Navigate to auth page
    await page.goto('http://localhost:5173/login');
    await page.waitForLoadState('networkidle');
    
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '06-authpage-login.png'), fullPage: true });
    
    // Check login form elements
    const emailInput = page.locator('input#login-email');
    const passwordInput = page.locator('input#login-password');
    const submitButton = page.locator('button[type="submit"]').first();
    
    if (!(await emailInput.isVisible().catch(() => false))) {
      logIssue('P0', 'Login email input not visible', 'Email field missing', 'AuthPage.tsx:191');
    }
    
    if (!(await passwordInput.isVisible().catch(() => false))) {
      logIssue('P0', 'Login password input not visible', 'Password field missing', 'AuthPage.tsx:206');
    }
    
    // Test empty form submission
    const isDisabled = await submitButton.isDisabled().catch(() => false);
    if (!isDisabled) {
      logIssue('P1', 'Login submit not disabled with empty fields', 'Button should be disabled', 'AuthPage.tsx:228-230');
    }
    
    // Test invalid email format
    await emailInput.fill('invalid-email');
    await passwordInput.fill('password123');
    
    // Check if email validation exists (HTML5)
    const emailType = await emailInput.getAttribute('type');
    if (emailType !== 'email') {
      logIssue('P2', 'Email input not using type="email"', `Type is "${emailType}"`, 'AuthPage.tsx:192');
    }
  });
  
  test('AuthPage - Password visibility toggle', async ({ page }) => {
    await page.goto('http://localhost:5173/login');
    await page.waitForLoadState('networkidle');
    
    const passwordInput = page.locator('input#login-password');
    const toggleButton = page.locator('button[type="button"]').filter({ has: page.locator('svg') }).first();
    
    // Enter password
    await passwordInput.fill('TestPassword123');
    
    // Check initial state (password hidden)
    const initialType = await passwordInput.getAttribute('type');
    if (initialType !== 'password') {
      logIssue('P1', 'Password not hidden by default', `Type is "${initialType}"`, 'AuthPage.tsx:208');
    }
    
    // Click toggle
    if (await toggleButton.isVisible().catch(() => false)) {
      await toggleButton.click();
      await page.waitForTimeout(100);
      
      await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '07-password-visible.png') });
      
      const visibleType = await passwordInput.getAttribute('type');
      if (visibleType !== 'text') {
        logIssue('P1', 'Password visibility toggle not working', `Type should be "text" but is "${visibleType}"`, 'AuthPage.tsx:215-221');
      }
      
      // Toggle back
      await toggleButton.click();
      const hiddenType = await passwordInput.getAttribute('type');
      if (hiddenType !== 'password') {
        logIssue('P1', 'Password visibility toggle not reverting', `Type should be "password" but is "${hiddenType}"`, 'AuthPage.tsx:215-221');
      }
    } else {
      logIssue('P1', 'Password visibility toggle button not found', 'Eye/EyeOff icon button missing', 'AuthPage.tsx:215-221');
    }
  });
  
  test('AuthPage - Signup flow UI', async ({ page }) => {
    await page.goto('http://localhost:5173/login?tab=signup');
    await page.waitForLoadState('networkidle');
    
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '08-authpage-signup.png'), fullPage: true });
    
    // Check signup form elements
    const nameInput = page.locator('input#signup-name');
    const emailInput = page.locator('input#signup-email');
    const passwordInput = page.locator('input#signup-password');
    
    if (!(await nameInput.isVisible().catch(() => false))) {
      logIssue('P0', 'Signup name input not visible', 'Name field missing', 'AuthPage.tsx:261');
    }
    
    if (!(await emailInput.isVisible().catch(() => false))) {
      logIssue('P0', 'Signup email input not visible', 'Email field missing', 'AuthPage.tsx:277');
    }
    
    if (!(await passwordInput.isVisible().catch(() => false))) {
      logIssue('P0', 'Signup password input not visible', 'Password field missing', 'AuthPage.tsx:292');
    }
    
    // Check password placeholder
    const placeholder = await passwordInput.getAttribute('placeholder');
    if (!placeholder?.includes('8')) {
      logIssue('P2', 'Password placeholder missing length hint', `Placeholder: "${placeholder}"`, 'AuthPage.tsx:295');
    }
    
    // Test role selection
    const studentRole = page.locator('button').filter({ has: page.locator('text=Student') }).first();
    const instructorRole = page.locator('button').filter({ has: page.locator('text=Instructor') }).first();
    
    if (await studentRole.isVisible().catch(() => false)) {
      await studentRole.click();
      await page.waitForTimeout(200);
      await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '09-signup-student-selected.png') });
      
      // Check for class code input
      const classCodeInput = page.locator('input#signup-code');
      if (!(await classCodeInput.isVisible().catch(() => false))) {
        logIssue('P1', 'Class code input not shown for student signup', 'Class code field should appear', 'AuthPage.tsx:362-376');
      }
    }
    
    if (await instructorRole.isVisible().catch(() => false)) {
      await instructorRole.click();
      await page.waitForTimeout(200);
      await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '10-signup-instructor-selected.png') });
      
      // Check for instructor code input
      const codeLabel = await page.locator('label').filter({ has: page.locator('text=Instructor code') }).first().textContent().catch(() => '');
      if (!codeLabel.includes('Instructor code')) {
        logIssue('P2', 'Instructor code label not correct', `Label: "${codeLabel}"`, 'AuthPage.tsx:355');
      }
    }
  });
  
  test('AuthPage - Form error messaging', async ({ page }) => {
    await page.goto('http://localhost:5173/login?tab=signup');
    await page.waitForLoadState('networkidle');
    
    // Fill form with invalid data
    await page.locator('input#signup-name').fill('Test');
    await page.locator('input#signup-email').fill('test@example.com');
    await page.locator('input#signup-password').fill('short'); // Less than 8 chars
    await page.locator('text=Student').first().click();
    
    await page.waitForTimeout(200);
    
    // Try to submit (button should be disabled due to short password)
    const submitButton = page.locator('button[type="submit"]').filter({ has: page.locator('text=Create Account') }).first();
    const isDisabled = await submitButton.isDisabled().catch(() => false);
    
    if (!isDisabled) {
      logIssue('P2', 'Signup submit not disabled with short password', 'Button should be disabled when password < 8 chars', 'AuthPage.tsx:386');
    }
    
    // Check signup validation logic
    // Password must be >= 8 chars per isSignupValid
    await page.locator('input#signup-password').fill('validpassword123');
    await page.locator('input#signup-code').fill('TESTCODE');
    
    // Now button should be enabled
    const isEnabled = await submitButton.isEnabled().catch(() => false);
    if (!isEnabled) {
      logIssue('P2', 'Signup submit not enabled with valid form', 'Button should be enabled', 'AuthPage.tsx:124-133');
    }
  });
  
  test.afterAll(async () => {
    // Write findings to JSON
    const findings = {
      timestamp: new Date().toISOString(),
      status: issues.length === 0 ? 'passed' : issues.some(i => i.severity === 'P0') ? 'failed' : 'partial',
      issues_found: issues,
      screenshots: fs.readdirSync(SCREENSHOTS_DIR).map(f => path.join(SCREENSHOTS_DIR, f)),
      console_logs: consoleLogs.filter(log => log.type === 'error' || log.type === 'pageerror' || log.type === 'warning'),
    };
    
    fs.writeFileSync(
      path.join(OUTPUT_DIR, 'ws-1-findings.json'),
      JSON.stringify(findings, null, 2)
    );
    
    console.log('\n=== AUDIT COMPLETE ===');
    console.log(`Issues found: ${issues.length}`);
    console.log(`P0: ${issues.filter(i => i.severity === 'P0').length}`);
    console.log(`P1: ${issues.filter(i => i.severity === 'P1').length}`);
    console.log(`P2: ${issues.filter(i => i.severity === 'P2').length}`);
    console.log(`P3: ${issues.filter(i => i.severity === 'P3').length}`);
  });
});
