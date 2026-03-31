import { test, expect, type Page, type ConsoleMessage } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

// Audit configuration
const BASE_URL = 'http://localhost:5173';
const SCREENSHOT_DIR = './ux-audit-evidence';

// Ensure screenshot directory exists
if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

// Audit report collector
interface AuditIssue {
  flow: string;
  severity: 'P0' | 'P1' | 'P2' | 'P3';
  title: string;
  description: string;
  reproduction?: string;
  expected?: string;
  actual?: string;
  codeArea?: string;
  screenshot?: string;
}

interface FlowResult {
  name: string;
  status: 'pass' | 'fail' | 'partial';
  screenshots: string[];
  consoleErrors: string[];
  networkFailures: string[];
  issues: AuditIssue[];
  notes: string[];
}

const auditReport: {
  timestamp: string;
  baseUrl: string;
  flows: FlowResult[];
  summary: {
    totalFlows: number;
    passed: number;
    failed: number;
    partial: number;
    totalIssues: number;
    p0Count: number;
    p1Count: number;
    p2Count: number;
    p3Count: number;
  };
} = {
  timestamp: new Date().toISOString(),
  baseUrl: BASE_URL,
  flows: [],
  summary: {
    totalFlows: 0,
    passed: 0,
    failed: 0,
    partial: 0,
    totalIssues: 0,
    p0Count: 0,
    p1Count: 0,
    p2Count: 0,
    p3Count: 0,
  },
};

// Helper to capture console errors
function captureConsoleErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (msg: ConsoleMessage) => {
    if (msg.type() === 'error') {
      errors.push(`[${msg.type()}] ${msg.text()}`);
    }
  });
  page.on('pageerror', (error) => {
    errors.push(`[pageerror] ${error.message}`);
  });
  return errors;
}

// Helper to capture network failures
function captureNetworkFailures(page: Page): string[] {
  const failures: string[] = [];
  page.on('requestfailed', (request) => {
    failures.push(`${request.method()} ${request.url()} - ${request.failure()?.errorText || 'Unknown error'}`);
  });
  return failures;
}

// Helper to take screenshot with descriptive name
async function takeScreenshot(page: Page, flow: string, name: string): Promise<string> {
  const filename = `${flow}_${name}_${Date.now()}.png`;
  const filepath = path.join(SCREENSHOT_DIR, filename);
  await page.screenshot({ path: filepath, fullPage: true });
  return filename;
}

// Helper to add issue to current flow
function addIssue(flowResult: FlowResult, issue: Omit<AuditIssue, 'flow'>): void {
  flowResult.issues.push({ ...issue, flow: flowResult.name });
  auditReport.summary.totalIssues++;
  switch (issue.severity) {
    case 'P0': auditReport.summary.p0Count++; break;
    case 'P1': auditReport.summary.p1Count++; break;
    case 'P2': auditReport.summary.p2Count++; break;
    case 'P3': auditReport.summary.p3Count++; break;
  }
}

test.describe('Student UX Audit', () => {
  test.setTimeout(120000);

  test('Flow 1: Onboarding and Resume Flow', async ({ page, context }) => {
    const flowResult: FlowResult = {
      name: 'Onboarding/Resume Flow',
      status: 'pass',
      screenshots: [],
      consoleErrors: captureConsoleErrors(page),
      networkFailures: captureNetworkFailures(page),
      issues: [],
      notes: [],
    };

    try {
      // Clear any existing storage to simulate new student
      await context.clearCookies();
      await page.evaluate(() => {
        localStorage.clear();
        sessionStorage.clear();
      });

      // Navigate to start page
      await page.goto(BASE_URL);
      await page.waitForLoadState('networkidle');

      flowResult.screenshots.push(await takeScreenshot(page, 'onboarding', '01_initial_load'));
      flowResult.notes.push('Initial page load captured - checking for new student experience');

      // Check what's visible on the landing page
      const pageContent = await page.content();
      const hasStartButton = await page.locator('button:has-text("Start"), a:has-text("Start"), button:has-text("Begin"), a:has-text("Begin")').count() > 0;
      const hasLoginButton = await page.locator('button:has-text("Login"), a:has-text("Login"), button:has-text("Sign In"), a:has-text("Sign In")').count() > 0;
      const hasPracticeLink = await page.locator('a[href*="practice"], button:has-text("Practice")').count() > 0;

      flowResult.notes.push(`Start button found: ${hasStartButton}`);
      flowResult.notes.push(`Login button found: ${hasLoginButton}`);
      flowResult.notes.push(`Practice link found: ${hasPracticeLink}`);

      // Look for resume functionality
      const hasResumeButton = await page.locator('button:has-text("Resume"), a:has-text("Resume"), button:has-text("Continue"), a:has-text("Continue")').count() > 0;
      flowResult.notes.push(`Resume button found: ${hasResumeButton}`);

      if (!hasStartButton && !hasPracticeLink && !hasLoginButton) {
        addIssue(flowResult, {
          severity: 'P1',
          title: 'No clear CTA on landing page',
          description: 'Landing page lacks clear Start, Login, or Practice call-to-action buttons',
          expected: 'Clear primary action button for new students',
          actual: 'No obvious primary action found',
        });
        flowResult.status = 'partial';
      }

      // Check page title and heading
      const title = await page.title();
      flowResult.notes.push(`Page title: ${title}`);

      const h1 = await page.locator('h1').first().textContent().catch(() => 'No H1 found');
      flowResult.notes.push(`H1 content: ${h1}`);

      // Try to navigate to practice to see what happens
      await page.goto(`${BASE_URL}/practice`);
      await page.waitForLoadState('networkidle');
      flowResult.screenshots.push(await takeScreenshot(page, 'onboarding', '02_practice_page_no_auth'));

      // Check if redirected or shown auth prompt
      const currentUrl = page.url();
      flowResult.notes.push(`URL after navigating to /practice: ${currentUrl}`);

      if (currentUrl.includes('login') || currentUrl.includes('auth')) {
        flowResult.notes.push('App requires authentication to access practice');
        flowResult.screenshots.push(await takeScreenshot(page, 'onboarding', '03_auth_prompt'));
      }

    } catch (error) {
      flowResult.status = 'fail';
      addIssue(flowResult, {
        severity: 'P0',
        title: 'Onboarding flow crashed',
        description: error instanceof Error ? error.message : 'Unknown error',
      });
      await takeScreenshot(page, 'onboarding', 'error_state');
    }

    auditReport.flows.push(flowResult);
  });

  test('Flow 2: Learning Page (/practice)', async ({ page }) => {
    const flowResult: FlowResult = {
      name: 'Learning Page (/practice)',
      status: 'pass',
      screenshots: captureConsoleErrors(page),
      consoleErrors: [],
      networkFailures: captureNetworkFailures(page),
      issues: [],
      notes: [],
    };

    try {
      // Navigate directly to practice
      await page.goto(`${BASE_URL}/practice`);
      await page.waitForLoadState('networkidle');

      flowResult.screenshots.push(await takeScreenshot(page, 'practice', '01_initial_load'));

      // Check for SQL editor
      const hasSQLEditor = await page.locator('.monaco-editor, [data-testid="sql-editor"], textarea[placeholder*="SQL"], .sql-editor').count() > 0;
      flowResult.notes.push(`SQL Editor found: ${hasSQLEditor}`);

      if (!hasSQLEditor) {
        // Try alternative selectors
        const editorSelectors = ['.monaco-editor', '[role="textbox"]', 'textarea', '.cm-editor', '.code-editor'];
        for (const selector of editorSelectors) {
          const count = await page.locator(selector).count();
          if (count > 0) {
            flowResult.notes.push(`Found editor-like element: ${selector} (${count} instances)`);
          }
        }
      }

      // Check for Run Query button
      const runButtonSelectors = [
        'button:has-text("Run")',
        'button:has-text("Execute")',
        'button:has-text("Submit")',
        '[data-testid="run-query"]',
        'button[type="submit"]'
      ];

      let runButtonFound = false;
      for (const selector of runButtonSelectors) {
        const count = await page.locator(selector).count();
        if (count > 0) {
          runButtonFound = true;
          flowResult.notes.push(`Run button found with selector: ${selector}`);
          break;
        }
      }

      if (!runButtonFound) {
        addIssue(flowResult, {
          severity: 'P0',
          title: 'No Run Query button found',
          description: 'Could not locate the Run Query or Execute button on the practice page',
          expected: 'Clear Run Query button should be visible',
          actual: 'No run button found with standard selectors',
        });
        flowResult.status = 'partial';
      }

      // Check for question/problem display
      const hasQuestion = await page.locator('h1, h2, h3, .question, .problem, [data-testid="question"]').count() > 0;
      flowResult.notes.push(`Question/problem display found: ${hasQuestion}`);

      // Check for hint/help button
      const hasHintButton = await page.locator('button:has-text("Hint"), button:has-text("Help"), [data-testid="hint"], button:has-text("Get Help")').count() > 0;
      flowResult.notes.push(`Hint/Help button found: ${hasHintButton}`);

      if (!hasHintButton) {
        addIssue(flowResult, {
          severity: 'P1',
          title: 'No Hint button visible',
          description: 'Could not locate the Hint or Get Help button',
          expected: 'Hint button should be available for students',
          actual: 'No hint button found',
        });
      }

      // Check layout structure
      const mainContent = await page.locator('main, #root, .app, [role="main"]').count();
      flowResult.notes.push(`Main content areas found: ${mainContent}`);

      // Test responsive layout at different viewports
      await page.setViewportSize({ width: 1280, height: 720 });
      await page.waitForTimeout(500);
      flowResult.screenshots.push(await takeScreenshot(page, 'practice', '02_desktop_viewport'));

      await page.setViewportSize({ width: 768, height: 1024 });
      await page.waitForTimeout(500);
      flowResult.screenshots.push(await takeScreenshot(page, 'practice', '03_tablet_viewport'));

      // Check for loading states
      const hasLoadingIndicator = await page.locator('.loading, [data-testid="loading"], .spinner, .skeleton').count() > 0;
      flowResult.notes.push(`Loading indicator found: ${hasLoadingIndicator}`);

    } catch (error) {
      flowResult.status = 'fail';
      addIssue(flowResult, {
        severity: 'P0',
        title: 'Learning page flow crashed',
        description: error instanceof Error ? error.message : 'Unknown error',
      });
      await takeScreenshot(page, 'practice', 'error_state');
    }

    auditReport.flows.push(flowResult);
  });

  test('Flow 3: Concept Detail Page', async ({ page }) => {
    const flowResult: FlowResult = {
      name: 'Concept Detail Page',
      status: 'pass',
      screenshots: [],
      consoleErrors: captureConsoleErrors(page),
      networkFailures: captureNetworkFailures(page),
      issues: [],
      notes: [],
    };

    try {
      // Navigate to concepts list
      await page.goto(`${BASE_URL}/concepts`);
      await page.waitForLoadState('networkidle');

      flowResult.screenshots.push(await takeScreenshot(page, 'concepts', '01_list_page'));

      // Check for concept list
      const conceptLinks = await page.locator('a[href*="/concepts/"]').count();
      flowResult.notes.push(`Concept links found: ${conceptLinks}`);

      if (conceptLinks === 0) {
        addIssue(flowResult, {
          severity: 'P1',
          title: 'No concepts listed',
          description: 'Concepts list page shows no available concepts',
          expected: 'List of SQL concepts should be displayed',
          actual: 'No concept links found',
        });
        flowResult.status = 'partial';
      } else {
        // Click on first concept
        const firstConcept = page.locator('a[href*="/concepts/"]').first();
        const conceptName = await firstConcept.textContent() || 'Unknown';
        flowResult.notes.push(`Clicking on concept: ${conceptName}`);

        await firstConcept.click();
        await page.waitForLoadState('networkidle');

        flowResult.screenshots.push(await takeScreenshot(page, 'concepts', '02_detail_page'));

        // Check for tabs
        const tabSelectors = ['Learn', 'Examples', 'Common Mistakes', 'Practice'];
        for (const tabName of tabSelectors) {
          const hasTab = await page.locator(`button:has-text("${tabName}"), [role="tab"]:has-text("${tabName}")`).count() > 0;
          flowResult.notes.push(`Tab "${tabName}" found: ${hasTab}`);
        }

        // Check content readability
        const contentBlocks = await page.locator('p, article, section, .content').count();
        flowResult.notes.push(`Content blocks found: ${contentBlocks}`);

        if (contentBlocks < 2) {
          addIssue(flowResult, {
            severity: 'P2',
            title: 'Limited content on concept page',
            description: 'Concept detail page has minimal content blocks',
            expected: 'Rich educational content with multiple sections',
            actual: `${contentBlocks} content blocks found`,
          });
        }

        // Test tab navigation if tabs exist
        const learnTab = page.locator('button:has-text("Learn"), [role="tab"]:has-text("Learn")').first();
        if (await learnTab.count() > 0) {
          await learnTab.click();
          await page.waitForTimeout(300);
          flowResult.screenshots.push(await takeScreenshot(page, 'concepts', '03_learn_tab'));
        }

        const examplesTab = page.locator('button:has-text("Examples"), [role="tab"]:has-text("Examples")').first();
        if (await examplesTab.count() > 0) {
          await examplesTab.click();
          await page.waitForTimeout(300);
          flowResult.screenshots.push(await takeScreenshot(page, 'concepts', '04_examples_tab'));
        }

        const mistakesTab = page.locator('button:has-text("Common Mistakes"), [role="tab"]:has-text("Common Mistakes")').first();
        if (await mistakesTab.count() > 0) {
          await mistakesTab.click();
          await page.waitForTimeout(300);
          flowResult.screenshots.push(await takeScreenshot(page, 'concepts', '05_mistakes_tab'));
        }
      }

    } catch (error) {
      flowResult.status = 'fail';
      addIssue(flowResult, {
        severity: 'P0',
        title: 'Concept page flow crashed',
        description: error instanceof Error ? error.message : 'Unknown error',
      });
      await takeScreenshot(page, 'concepts', 'error_state');
    }

    auditReport.flows.push(flowResult);
  });

  test('Flow 4: Practice Flow with Hints', async ({ page }) => {
    const flowResult: FlowResult = {
      name: 'Practice Flow with Hints',
      status: 'pass',
      screenshots: [],
      consoleErrors: captureConsoleErrors(page),
      networkFailures: captureNetworkFailures(page),
      issues: [],
      notes: [],
    };

    try {
      // Navigate to practice
      await page.goto(`${BASE_URL}/practice`);
      await page.waitForLoadState('networkidle');

      flowResult.screenshots.push(await takeScreenshot(page, 'hints', '01_practice_initial'));

      // Find and enter a wrong SQL query
      const editor = page.locator('.monaco-editor, [role="textbox"], textarea').first();
      if (await editor.count() > 0) {
        await editor.click();
        await editor.fill('SELECT * FROM nonexistent_table');
        flowResult.notes.push('Entered incorrect SQL query');
      } else {
        addIssue(flowResult, {
          severity: 'P0',
          title: 'Cannot find SQL editor',
          description: 'No SQL editor found to enter query',
          expected: 'SQL editor should be available',
          actual: 'No editor element found',
        });
        flowResult.status = 'partial';
      }

      // Click Run Query
      const runButton = page.locator('button:has-text("Run"), button:has-text("Execute"), button[type="submit"]').first();
      if (await runButton.count() > 0) {
        await runButton.click();
        await page.waitForTimeout(1000);
        flowResult.screenshots.push(await takeScreenshot(page, 'hints', '02_after_run_wrong'));
        flowResult.notes.push('Clicked Run Query with wrong answer');
      }

      // Look for hint button and click it
      const hintButton = page.locator('button:has-text("Hint"), button:has-text("Help"), button:has-text("Get Help"), [data-testid="hint"]').first();
      if (await hintButton.count() > 0) {
        await hintButton.click();
        await page.waitForTimeout(1000);
        flowResult.screenshots.push(await takeScreenshot(page, 'hints', '03_hint_displayed'));
        flowResult.notes.push('Clicked hint button');

        // Check if hint content is displayed
        const hintContent = await page.locator('.hint, [data-testid="hint-content"], .hint-content, .help-content').count();
        flowResult.notes.push(`Hint content elements found: ${hintContent}`);

        if (hintContent === 0) {
          addIssue(flowResult, {
            severity: 'P1',
            title: 'Hint content not displayed',
            description: 'Clicked hint button but no hint content is visible',
            expected: 'Hint content should appear after clicking hint button',
            actual: 'No hint content found',
          });
        }

        // Look for follow-up hint / escalation
        const followUpButton = page.locator('button:has-text("Another Hint"), button:has-text("More Help"), button:has-text("Next Hint"), button:has-text("I need more help")').first();
        if (await followUpButton.count() > 0) {
          await followUpButton.click();
          await page.waitForTimeout(1000);
          flowResult.screenshots.push(await takeScreenshot(page, 'hints', '04_followup_hint'));
          flowResult.notes.push('Clicked follow-up hint button');
        } else {
          flowResult.notes.push('No follow-up hint button found');
        }

        // Look for Save to Notes button
        const saveToNotesButton = page.locator('button:has-text("Save to Notes"), button:has-text("Add to Notes"), [data-testid="save-notes"]').first();
        if (await saveToNotesButton.count() > 0) {
          flowResult.notes.push('Save to Notes button found');
        } else {
          addIssue(flowResult, {
            severity: 'P2',
            title: 'Save to Notes button not found',
            description: 'Cannot locate Save to Notes button after hint',
            expected: 'Save to Notes should be available after viewing hint',
            actual: 'No Save to Notes button found',
          });
        }

      } else {
        addIssue(flowResult, {
          severity: 'P1',
          title: 'No hint button available',
          description: 'Cannot find hint/Get Help button on practice page',
          expected: 'Hint button should be available when student is stuck',
          actual: 'No hint button found',
        });
        flowResult.status = 'partial';
      }

    } catch (error) {
      flowResult.status = 'fail';
      addIssue(flowResult, {
        severity: 'P0',
        title: 'Hint flow crashed',
        description: error instanceof Error ? error.message : 'Unknown error',
      });
      await takeScreenshot(page, 'hints', 'error_state');
    }

    auditReport.flows.push(flowResult);
  });

  test('Flow 5: Save-to-Notes Flow', async ({ page }) => {
    const flowResult: FlowResult = {
      name: 'Save-to-Notes Flow',
      status: 'pass',
      screenshots: [],
      consoleErrors: captureConsoleErrors(page),
      networkFailures: captureNetworkFailures(page),
      issues: [],
      notes: [],
    };

    try {
      // Navigate to practice and get a hint first
      await page.goto(`${BASE_URL}/practice`);
      await page.waitForLoadState('networkidle');

      // Enter a query
      const editor = page.locator('.monaco-editor, [role="textbox"], textarea').first();
      if (await editor.count() > 0) {
        await editor.click();
        await editor.fill('SELECT * FROM test');
      }

      // Click Run
      const runButton = page.locator('button:has-text("Run"), button:has-text("Execute")').first();
      if (await runButton.count() > 0) {
        await runButton.click();
        await page.waitForTimeout(500);
      }

      // Click hint
      const hintButton = page.locator('button:has-text("Hint"), button:has-text("Help"), button:has-text("Get Help")').first();
      if (await hintButton.count() > 0) {
        await hintButton.click();
        await page.waitForTimeout(1000);
        flowResult.screenshots.push(await takeScreenshot(page, 'notes', '01_hint_before_save'));
      }

      // Try to save to notes
      const saveButton = page.locator('button:has-text("Save to Notes"), button:has-text("Add to Notes"), [data-testid="save-notes"]').first();
      if (await saveButton.count() > 0) {
        await saveButton.click();
        await page.waitForTimeout(1000);
        flowResult.screenshots.push(await takeScreenshot(page, 'notes', '02_after_save_click'));
        flowResult.notes.push('Clicked Save to Notes');

        // Check for success feedback
        const successMessage = await page.locator('.success, [data-testid="success"], .toast, .notification:has-text("saved"), .notification:has-text("added")').count();
        flowResult.notes.push(`Success feedback elements: ${successMessage}`);

        if (successMessage === 0) {
          addIssue(flowResult, {
            severity: 'P2',
            title: 'No success feedback after saving note',
            description: 'Clicked Save to Notes but no success confirmation shown',
            expected: 'Visual feedback confirming note was saved',
            actual: 'No success message or indicator found',
          });
        }
      } else {
        addIssue(flowResult, {
          severity: 'P1',
          title: 'Save to Notes button not available',
          description: 'Cannot test save flow - button not found',
        });
        flowResult.status = 'partial';
      }

      // Navigate to textbook
      await page.goto(`${BASE_URL}/textbook`);
      await page.waitForLoadState('networkidle');
      flowResult.screenshots.push(await takeScreenshot(page, 'notes', '03_textbook_page'));
      flowResult.notes.push('Navigated to textbook page');

      // Check if saved content appears
      const textbookContent = await page.locator('.note, .textbook-item, [data-testid="note"], article').count();
      flowResult.notes.push(`Textbook content items found: ${textbookContent}`);

      if (textbookContent === 0) {
        addIssue(flowResult, {
          severity: 'P1',
          title: 'No notes displayed in textbook',
          description: 'Textbook page shows no saved notes',
          expected: 'Previously saved notes should be visible',
          actual: 'No notes found in textbook',
        });
        flowResult.status = 'partial';
      }

      // Test refresh behavior
      await page.reload();
      await page.waitForLoadState('networkidle');
      flowResult.screenshots.push(await takeScreenshot(page, 'notes', '04_after_refresh'));
      flowResult.notes.push('Refreshed textbook page');

      const contentAfterRefresh = await page.locator('.note, .textbook-item, [data-testid="note"], article').count();
      if (contentAfterRefresh !== textbookContent) {
        addIssue(flowResult, {
          severity: 'P0',
          title: 'Notes disappear after refresh',
          description: 'Saved notes are not persisted after page refresh',
          expected: 'Notes should persist across page refreshes',
          actual: `Before: ${textbookContent}, After: ${contentAfterRefresh}`,
        });
        flowResult.status = 'fail';
      }

    } catch (error) {
      flowResult.status = 'fail';
      addIssue(flowResult, {
        severity: 'P0',
        title: 'Save-to-Notes flow crashed',
        description: error instanceof Error ? error.message : 'Unknown error',
      });
      await takeScreenshot(page, 'notes', 'error_state');
    }

    auditReport.flows.push(flowResult);
  });

  test('Generate Audit Report', async () => {
    // Calculate summary
    auditReport.summary.totalFlows = auditReport.flows.length;
    auditReport.summary.passed = auditReport.flows.filter(f => f.status === 'pass').length;
    auditReport.summary.failed = auditReport.flows.filter(f => f.status === 'fail').length;
    auditReport.summary.partial = auditReport.flows.filter(f => f.status === 'partial').length;

    // Write report to file
    const reportPath = path.join(SCREENSHOT_DIR, 'audit-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(auditReport, null, 2));

    // Generate markdown report
    let markdown = `# Student UX Audit Report\n\n`;
    markdown += `**Timestamp:** ${auditReport.timestamp}\n`;
    markdown += `**Base URL:** ${auditReport.baseUrl}\n\n`;

    markdown += `## Summary\n\n`;
    markdown += `- Total Flows: ${auditReport.summary.totalFlows}\n`;
    markdown += `- Passed: ${auditReport.summary.passed}\n`;
    markdown += `- Failed: ${auditReport.summary.failed}\n`;
    markdown += `- Partial: ${auditReport.summary.partial}\n`;
    markdown += `- Total Issues: ${auditReport.summary.totalIssues}\n`;
    markdown += `  - P0 (Blockers): ${auditReport.summary.p0Count}\n`;
    markdown += `  - P1 (Major): ${auditReport.summary.p1Count}\n`;
    markdown += `  - P2 (Minor): ${auditReport.summary.p2Count}\n`;
    markdown += `  - P3 (Polish): ${auditReport.summary.p3Count}\n\n`;

    markdown += `## Flow Results\n\n`;
    for (const flow of auditReport.flows) {
      markdown += `### ${flow.name} - ${flow.status.toUpperCase()}\n\n`;

      if (flow.notes.length > 0) {
        markdown += `**Notes:**\n`;
        for (const note of flow.notes) {
          markdown += `- ${note}\n`;
        }
        markdown += `\n`;
      }

      if (flow.consoleErrors.length > 0) {
        markdown += `**Console Errors:**\n`;
        for (const error of flow.consoleErrors.slice(0, 5)) {
          markdown += `- \`\`\`${error}\`\`\`\n`;
        }
        if (flow.consoleErrors.length > 5) {
          markdown += `- ... and ${flow.consoleErrors.length - 5} more\n`;
        }
        markdown += `\n`;
      }

      if (flow.networkFailures.length > 0) {
        markdown += `**Network Failures:**\n`;
        for (const failure of flow.networkFailures) {
          markdown += `- ${failure}\n`;
        }
        markdown += `\n`;
      }

      if (flow.screenshots.length > 0) {
        markdown += `**Screenshots:**\n`;
        for (const screenshot of flow.screenshots) {
          markdown += `- ${screenshot}\n`;
        }
        markdown += `\n`;
      }

      if (flow.issues.length > 0) {
        markdown += `**Issues Found:**\n\n`;
        for (const issue of flow.issues) {
          markdown += `#### ${issue.severity}: ${issue.title}\n`;
          markdown += `- **Description:** ${issue.description}\n`;
          if (issue.reproduction) markdown += `- **Reproduction:** ${issue.reproduction}\n`;
          if (issue.expected) markdown += `- **Expected:** ${issue.expected}\n`;
          if (issue.actual) markdown += `- **Actual:** ${issue.actual}\n`;
          if (issue.codeArea) markdown += `- **Code Area:** ${issue.codeArea}\n`;
          if (issue.screenshot) markdown += `- **Screenshot:** ${issue.screenshot}\n`;
          markdown += `\n`;
        }
      }

      markdown += `---\n\n`;
    }

    const markdownPath = path.join(SCREENSHOT_DIR, 'audit-report.md');
    fs.writeFileSync(markdownPath, markdown);

    console.log('\n=== AUDIT COMPLETE ===');
    console.log(`Report saved to: ${reportPath}`);
    console.log(`Markdown report: ${markdownPath}`);
    console.log(`Screenshots saved to: ${SCREENSHOT_DIR}`);
    console.log(`\nSummary: ${auditReport.summary.passed} passed, ${auditReport.summary.partial} partial, ${auditReport.summary.failed} failed`);
    console.log(`Issues: ${auditReport.summary.p0Count} P0, ${auditReport.summary.p1Count} P1, ${auditReport.summary.p2Count} P2, ${auditReport.summary.p3Count} P3`);
  });
});