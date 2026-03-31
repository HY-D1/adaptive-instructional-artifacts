/**
 * Manual UX Audit Checklist for Instructor Surfaces
 *
 * This script provides a structured checklist for manually auditing
 * instructor-facing surfaces. Run this with the dev server and walk through
 * each step, documenting findings.
 *
 * Usage:
 *   1. Start dev server: npm run dev
 *   2. Open browser to http://localhost:5174
 *   3. Follow the checklist below
 *   4. Document findings in the findings section
 */

export const INSTRUCTOR_UX_AUDIT_CHECKLIST = {
  metadata: {
    version: '1.0.0',
    date: new Date().toISOString(),
    auditor: '',
    environment: 'local-dev',
    browser: '',
  },

  // ==========================================
  // FLOW 1: INSTRUCTOR DASHBOARD
  // ==========================================
  flow1_instructorDashboard: {
    name: 'Instructor Dashboard (/instructor-dashboard)',
    steps: [
      {
        id: '1.1',
        action: 'Navigate to start page (/)',
        check: 'Page loads without console errors',
        expected: 'Clean start page with student/instructor options',
        findings: '',
        status: 'pending', // pending, pass, fail, partial
      },
      {
        id: '1.2',
        action: 'Click "I\'m an Instructor" button',
        check: 'Redirects to instructor dashboard',
        expected: 'URL changes to /instructor-dashboard',
        findings: '',
        status: 'pending',
      },
      {
        id: '1.3',
        action: 'Document layout and information architecture',
        check: 'All major sections are visible and well-organized',
        expected: 'Clear hierarchy: Header > Stats > Learners > Actions',
        screenshot: 'instructor-dashboard-layout.png',
        findings: '',
        status: 'pending',
      },
      {
        id: '1.4',
        action: 'Check learner table readability',
        check: 'Table columns are clear and data is readable',
        expected: 'Columns: Name, Email, Last Active, Progress, Actions',
        findings: '',
        status: 'pending',
      },
      {
        id: '1.5',
        action: 'Verify stats are understandable',
        check: 'Stats cards show meaningful information',
        expected: 'Total Students, Active Today, Avg Progress with clear labels',
        findings: '',
        status: 'pending',
      },
      {
        id: '1.6',
        action: 'Test interactive elements',
        check: 'Buttons and links are clickable',
        expected: 'All buttons respond to hover/click',
        findings: '',
        status: 'pending',
      },
      {
        id: '1.7',
        action: 'Check for console errors',
        check: 'Open browser DevTools > Console',
        expected: 'No red error messages',
        findings: '',
        status: 'pending',
      },
      {
        id: '1.8',
        action: 'Check responsive behavior',
        check: 'Resize browser window',
        expected: 'Layout adapts gracefully to different sizes',
        findings: '',
        status: 'pending',
      },
    ],
  },

  // ==========================================
  // FLOW 2: PREVIEW MODE
  // ==========================================
  flow2_previewMode: {
    name: 'Preview Mode (Student View)',
    steps: [
      {
        id: '2.1',
        action: 'From instructor dashboard, find "Student Preview Mode" section',
        check: 'Preview mode card is visible',
        expected: 'Card with "Launch Preview" button',
        findings: '',
        status: 'pending',
      },
      {
        id: '2.2',
        action: 'Click "Launch Preview" button',
        check: 'Preview modal opens',
        expected: 'Modal with profile selection options',
        screenshot: 'preview-modal.png',
        findings: '',
        status: 'pending',
      },
      {
        id: '2.3',
        action: 'Select a profile (e.g., "Adaptive")',
        check: 'Profile option is selectable',
        expected: 'Radio button or button selection works',
        findings: '',
        status: 'pending',
      },
      {
        id: '2.4',
        action: 'Click "Start Preview"',
        check: 'Navigates to practice page',
        expected: 'URL changes to /practice with preview mode active',
        findings: '',
        status: 'pending',
      },
      {
        id: '2.5',
        action: 'Verify visual indicator of preview mode',
        check: 'Preview mode banner/indicator is visible',
        expected: 'Banner showing "Preview Mode" or similar',
        screenshot: 'preview-mode-indicator.png',
        findings: '',
        status: 'pending',
      },
      {
        id: '2.6',
        action: 'Interact with student interface',
        check: 'Can use hint system, submit answers',
        expected: 'All student features work normally',
        findings: '',
        status: 'pending',
      },
      {
        id: '2.7',
        action: 'Test exiting preview mode',
        check: 'Click exit/close preview button',
        expected: 'Returns to instructor dashboard, preview mode disabled',
        findings: '',
        status: 'pending',
      },
      {
        id: '2.8',
        action: 'Verify state consistency',
        check: 'Re-enter preview mode',
        expected: 'Settings persist, no errors',
        findings: '',
        status: 'pending',
      },
    ],
  },

  // ==========================================
  // FLOW 3: SETTINGS PAGE
  // ==========================================
  flow3_settingsPage: {
    name: 'Settings Page (/settings)',
    steps: [
      {
        id: '3.1',
        action: 'Navigate to /settings as instructor',
        check: 'Settings page loads',
        expected: 'Full settings page with all instructor options',
        screenshot: 'instructor-settings.png',
        findings: '',
        status: 'pending',
      },
      {
        id: '3.2',
        action: 'Document all controls visible',
        check: 'List all setting sections',
        expected: 'PDF Upload, LLM Config, Preview Mode, Experimental Toggles',
        findings: '',
        status: 'pending',
      },
      {
        id: '3.3',
        action: 'Identify REAL product settings',
        check: 'Which settings are for production use',
        expected: 'PDF Upload, LLM Configuration, Preview Mode',
        findings: '',
        status: 'pending',
      },
      {
        id: '3.4',
        action: 'Identify debug/dev controls',
        check: 'Which settings are for development only',
        expected: 'Week 5 Testing Controls (Profile Override, Assignment Strategy, HDI, Bandit Debug)',
        findings: '',
        status: 'pending',
      },
      {
        id: '3.5',
        action: 'Check for confusing UI text',
        check: 'Read all labels and descriptions',
        expected: 'Clear, jargon-free language',
        findings: '',
        status: 'pending',
      },
      {
        id: '3.6',
        action: 'Identify risky or destructive actions',
        check: 'Look for delete, reset, clear buttons',
        expected: 'Confirmation dialogs for destructive actions',
        findings: '',
        status: 'pending',
      },
      {
        id: '3.7',
        action: 'Test settings persistence',
        check: 'Toggle a setting, refresh page',
        expected: 'Setting persists after refresh',
        findings: '',
        status: 'pending',
      },
      {
        id: '3.8',
        action: 'Navigate to settings as student',
        check: 'Login as student, go to /settings',
        expected: 'Limited settings (no PDF upload, no experimental toggles)',
        screenshot: 'student-settings.png',
        findings: '',
        status: 'pending',
      },
    ],
  },

  // ==========================================
  // FLOW 4: RESEARCH PAGE
  // ==========================================
  flow4_researchPage: {
    name: 'Research Page (/research)',
    steps: [
      {
        id: '4.1',
        action: 'Navigate to /research as instructor',
        check: 'Research page loads',
        expected: 'Research dashboard with data visualizations',
        screenshot: 'research-dashboard.png',
        findings: '',
        status: 'pending',
      },
      {
        id: '4.2',
        action: 'Document what data is shown',
        check: 'List all data sections',
        expected: 'Strategy comparison, replay data, analytics',
        findings: '',
        status: 'pending',
      },
      {
        id: '4.3',
        action: 'Check data visualization readability',
        check: 'Charts and graphs are clear',
        expected: 'Legible labels, appropriate colors, clear legends',
        findings: '',
        status: 'pending',
      },
      {
        id: '4.4',
        action: 'Test back navigation',
        check: 'Click "Back to Dashboard"',
        expected: 'Returns to instructor dashboard',
        findings: '',
        status: 'pending',
      },
      {
        id: '4.5',
        action: 'Check for hosted mode banner',
        check: 'If in hosted mode, banner should show',
        expected: 'Amber banner with hosted mode message',
        findings: '',
        status: 'pending',
      },
      {
        id: '4.6',
        action: 'Try accessing as student',
        check: 'Login as student, go to /research',
        expected: 'Redirected away (permission denied)',
        findings: '',
        status: 'pending',
      },
    ],
  },

  // ==========================================
  // CROSS-CUTTING CONCERNS
  // ==========================================
  crossCutting: {
    name: 'Cross-Cutting Concerns',
    steps: [
      {
        id: '5.1',
        action: 'Verify role-based access control',
        check: 'Students cannot access instructor routes',
        expected: '/instructor-dashboard and /research redirect for students',
        findings: '',
        status: 'pending',
      },
      {
        id: '5.2',
        action: 'Check navigation consistency',
        check: 'All pages have clear navigation',
        expected: 'Back buttons, nav links work correctly',
        findings: '',
        status: 'pending',
      },
      {
        id: '5.3',
        action: 'Verify error handling',
        check: 'Trigger errors (e.g., network offline)',
        expected: 'Graceful error messages, no crashes',
        findings: '',
        status: 'pending',
      },
      {
        id: '5.4',
        action: 'Check loading states',
        check: 'Refresh page, observe loading',
        expected: 'Loading indicators, no layout shift',
        findings: '',
        status: 'pending',
      },
    ],
  },
};

// ==========================================
// FINDINGS TEMPLATE
// ==========================================
export const FINDINGS_TEMPLATE = {
  summary: {
    totalIssues: 0,
    p0Blockers: 0,
    p1Major: 0,
    p2Minor: 0,
    p3Polish: 0,
  },

  issues: [
    // Example issue format:
    // {
    //   id: 'ISSUE-001',
    //   flow: 'Instructor Dashboard',
    //   severity: 'P1', // P0, P1, P2, P3
    //   category: 'UX', // UX, Functionality, Performance, Security, Accessibility
    //   title: 'Brief issue title',
    //   description: 'Detailed description of the issue',
    //   reproduction: 'Step-by-step reproduction steps',
    //   expected: 'What should happen',
    //   actual: 'What actually happens',
    //   screenshot: 'filename.png',
    //   codeLocation: 'File path and line number',
    // },
  ],

  debugControlsToHide: [
    // List controls that should be hidden in production
    // Example:
    // {
    //   name: 'Profile Override',
    //   location: 'Settings > Week 5 Testing Controls',
    //   reason: 'Internal debug tool, not for instructors',
    // },
  ],

  recommendations: [
    // Overall recommendations
  ],
};

// ==========================================
// SEVERITY DEFINITIONS
// ==========================================
export const SEVERITY_DEFINITIONS = {
  P0: {
    label: 'Blocker',
    description: 'Prevents core functionality, crashes, data loss, security vulnerability',
    action: 'Must fix before beta',
  },
  P1: {
    label: 'Major',
    description: 'Significantly impacts usability, confusing UI, broken features',
    action: 'Should fix before beta',
  },
  P2: {
    label: 'Minor',
    description: 'Annoying but workaround exists, visual glitches',
    action: 'Fix if time permits',
  },
  P3: {
    label: 'Polish',
    description: 'Nice to have, cosmetic improvements',
    action: 'Post-beta',
  },
};

// ==========================================
// RUN THE AUDIT
// ==========================================
console.log('========================================');
console.log('Instructor UX Audit Checklist');
console.log('========================================');
console.log('');
console.log('This is a manual audit checklist. To run:');
console.log('');
console.log('1. Start the dev server:');
console.log('   npm run dev');
console.log('');
console.log('2. Open browser to http://localhost:5174');
console.log('');
console.log('3. Walk through each step in the checklist');
console.log('');
console.log('4. Document findings in the findings template');
console.log('');
console.log('Export this checklist:');
console.log('  node scripts/instructor-ux-audit.mjs');
console.log('');
