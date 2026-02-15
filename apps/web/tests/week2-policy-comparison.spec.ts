import { expect, Locator, Page, test } from '@playwright/test';

const INTERACTIONS_KEY = 'sql-learning-interactions';
const PROFILES_KEY = 'sql-learning-profiles';
const TEXTBOOK_KEY = 'sql-learning-textbook';
const ACTIVE_SESSION_KEY = 'sql-learning-active-session';

type ExportOptions = {
  allHistory?: boolean;
  learnerId?: string;
};

type DecisionTrace = {
  index: number;
  eventId: string;
  decision: string;
  ruleFired: string;
  strategy: string;
  reasoning: string;
};

async function runUntilErrorCount(page: Page, runQueryButton: Locator, expectedErrorCount: number) {
  const marker = page.getByText(new RegExp(`\\b${expectedErrorCount}\\s+error(s)?\\b`));

  for (let i = 0; i < 24; i += 1) {
    await runQueryButton.click();
    if (await marker.first().isVisible().catch(() => false)) {
      return;
    }
    await page.waitForTimeout(500);
  }

  throw new Error(`Expected error count to reach ${expectedErrorCount}, but it did not.`);
}

async function replaceEditorText(page: Page, text: string) {
  const editorSurface = page.locator('.monaco-editor .view-lines').first();
  await editorSurface.click({ position: { x: 8, y: 8 } });
  await page.keyboard.press(process.platform === 'darwin' ? 'Meta+A' : 'Control+A');
  await page.keyboard.type(text);
}

async function exportSession(page: Page, options: ExportOptions = {}): Promise<any> {
  const exportData = await page.evaluate(async (opts) => {
    const { storage } = await import('/src/app/lib/storage.ts');
    return storage.exportData({ allHistory: opts.allHistory === true });
  }, options);
  return exportData;
}

async function getDecisionTrace(page: Page): Promise<DecisionTrace[]> {
  return page.evaluate(async () => {
    const { orchestrator } = await import('/src/app/lib/adaptive-orchestrator.ts');
    const { storage } = await import('/src/app/lib/storage.ts');
    
    const interactions = storage.getAllInteractions();
    const profiles = storage.getAllProfiles();
    const profile = profiles[0] ? storage.getProfile(profiles[0].id) : null;
    
    if (!profile || interactions.length === 0) return [];
    
    const replayTrace = orchestrator.getPolicyReplayTrace(interactions);
    const decisions = orchestrator.replayDecisionTrace(profile, replayTrace, profile.currentStrategy);
    
    return decisions.map(d => ({
      index: d.index,
      eventId: d.eventId,
      decision: d.decision,
      ruleFired: d.ruleFired,
      strategy: d.strategy,
      reasoning: d.reasoning
    }));
  });
}

async function runPolicyComparison(page: Page) {
  await page.getByTestId('trace-replay-button').click();
  await page.waitForTimeout(200);
}

async function setupLearnerWithInteractions(page: Page, strategy: string = 'adaptive-medium') {
  // First navigate to the app to set up the origin
  await page.goto('/');
  
  await page.evaluate((learnerStrategy) => {
    const now = Date.now();
    const sessionId = `session-test-${now}`;
    
    // Set active session
    window.localStorage.setItem('sql-learning-active-session', sessionId);
    
    // Create learner profile using storage's createDefaultProfile format
    const profile = {
      id: 'learner-test',
      name: 'Test Learner',
      conceptsCovered: [],
      conceptCoverageEvidence: [],
      errorHistory: [],
      interactionCount: 10,
      currentStrategy: learnerStrategy,
      preferences: {
        escalationThreshold: 3,
        aggregationDelay: 300000
      }
    };
    window.localStorage.setItem('sql-learning-profiles', JSON.stringify([profile]));
    
    // Create mock interactions for trace replay
    const interactions = [
      {
        id: 'evt-1',
        sessionId,
        learnerId: 'learner-test',
        timestamp: now - 300000,
        eventType: 'execution',
        problemId: 'problem-1',
        successful: false
      },
      {
        id: 'evt-2',
        sessionId,
        learnerId: 'learner-test',
        timestamp: now - 240000,
        eventType: 'error',
        problemId: 'problem-1',
        errorSubtypeId: 'incomplete-query',
        sqlEngageSubtype: 'incomplete query'
      },
      {
        id: 'evt-3',
        sessionId,
        learnerId: 'learner-test',
        timestamp: now - 180000,
        eventType: 'hint_view',
        problemId: 'problem-1',
        errorSubtypeId: 'incomplete-query',
        sqlEngageSubtype: 'incomplete query',
        hintLevel: 1,
        helpRequestIndex: 1,
        sqlEngageRowId: 'sql-engage:787',
        policyVersion: 'sql-engage-index-v3-hintid-contract'
      },
      {
        id: 'evt-4',
        sessionId,
        learnerId: 'learner-test',
        timestamp: now - 120000,
        eventType: 'error',
        problemId: 'problem-1',
        errorSubtypeId: 'incomplete-query',
        sqlEngageSubtype: 'incomplete query'
      },
      {
        id: 'evt-5',
        sessionId,
        learnerId: 'learner-test',
        timestamp: now - 60000,
        eventType: 'hint_view',
        problemId: 'problem-1',
        errorSubtypeId: 'incomplete-query',
        sqlEngageSubtype: 'incomplete query',
        hintLevel: 2,
        helpRequestIndex: 2,
        sqlEngageRowId: 'sql-engage:787',
        policyVersion: 'sql-engage-index-v3-hintid-contract'
      },
      {
        id: 'evt-6',
        sessionId,
        learnerId: 'learner-test',
        timestamp: now - 30000,
        eventType: 'hint_view',
        problemId: 'problem-1',
        errorSubtypeId: 'incomplete-query',
        sqlEngageSubtype: 'incomplete query',
        hintLevel: 3,
        helpRequestIndex: 3,
        sqlEngageRowId: 'sql-engage:787',
        policyVersion: 'sql-engage-index-v3-hintid-contract'
      },
      {
        id: 'evt-7',
        sessionId,
        learnerId: 'learner-test',
        timestamp: now,
        eventType: 'error',
        problemId: 'problem-1',
        errorSubtypeId: 'incomplete-query',
        sqlEngageSubtype: 'incomplete query'
      }
    ];
    window.localStorage.setItem('sql-learning-interactions', JSON.stringify(interactions));
  }, strategy);
}

// Alternative setup that uses storage.createDefaultProfile
async function setupLearnerWithStorageAPI(page: Page, strategy: string = 'adaptive-medium') {
  await page.goto('/');
  
  await page.evaluate(async (learnerStrategy) => {
    const { storage } = await import('/src/app/lib/storage.ts');
    const now = Date.now();
    const sessionId = `session-test-${now}`;
    
    storage.setActiveSessionId(sessionId);
    storage.createDefaultProfile('learner-test', learnerStrategy as any);
    
    // Create mock interactions for trace replay
    const interactions = [
      {
        id: 'evt-1',
        sessionId,
        learnerId: 'learner-test',
        timestamp: now - 300000,
        eventType: 'execution',
        problemId: 'problem-1',
        successful: false
      },
      {
        id: 'evt-2',
        sessionId,
        learnerId: 'learner-test',
        timestamp: now - 240000,
        eventType: 'error',
        problemId: 'problem-1',
        errorSubtypeId: 'incomplete-query',
        sqlEngageSubtype: 'incomplete query'
      },
      {
        id: 'evt-3',
        sessionId,
        learnerId: 'learner-test',
        timestamp: now - 180000,
        eventType: 'hint_view',
        problemId: 'problem-1',
        errorSubtypeId: 'incomplete-query',
        sqlEngageSubtype: 'incomplete query',
        hintLevel: 1,
        helpRequestIndex: 1,
        sqlEngageRowId: 'sql-engage:787',
        policyVersion: 'sql-engage-index-v3-hintid-contract'
      },
      {
        id: 'evt-4',
        sessionId,
        learnerId: 'learner-test',
        timestamp: now - 120000,
        eventType: 'error',
        problemId: 'problem-1',
        errorSubtypeId: 'incomplete-query',
        sqlEngageSubtype: 'incomplete query'
      },
      {
        id: 'evt-5',
        sessionId,
        learnerId: 'learner-test',
        timestamp: now - 60000,
        eventType: 'hint_view',
        problemId: 'problem-1',
        errorSubtypeId: 'incomplete-query',
        sqlEngageSubtype: 'incomplete query',
        hintLevel: 2,
        helpRequestIndex: 2,
        sqlEngageRowId: 'sql-engage:787',
        policyVersion: 'sql-engage-index-v3-hintid-contract'
      },
      {
        id: 'evt-6',
        sessionId,
        learnerId: 'learner-test',
        timestamp: now - 30000,
        eventType: 'hint_view',
        problemId: 'problem-1',
        errorSubtypeId: 'incomplete-query',
        sqlEngageSubtype: 'incomplete query',
        hintLevel: 3,
        helpRequestIndex: 3,
        sqlEngageRowId: 'sql-engage:787',
        policyVersion: 'sql-engage-index-v3-hintid-contract'
      },
      {
        id: 'evt-7',
        sessionId,
        learnerId: 'learner-test',
        timestamp: now,
        eventType: 'error',
        problemId: 'problem-1',
        errorSubtypeId: 'incomplete-query',
        sqlEngageSubtype: 'incomplete query'
      }
    ];
    
    for (const interaction of interactions) {
      storage.saveInteraction(interaction as any);
    }
  }, strategy);
}

// Helper function to run replay and get decisions using orchestrator directly
async function getReplayDecisions(page: Page, strategy: string): Promise<any[]> {
  return page.evaluate(async (strat) => {
    const { orchestrator } = await import('/src/app/lib/adaptive-orchestrator.ts');
    const { storage } = await import('/src/app/lib/storage.ts');
    
    const interactions = storage.getAllInteractions();
    const profile = storage.getProfile('learner-test');
    if (!profile) return [];
    
    const replayTrace = orchestrator.getPolicyReplayTrace(interactions);
    return orchestrator.replayDecisionTrace(profile, replayTrace, strat as any);
  }, strategy);
}

// Test 1: Research Dashboard UI Components
test('@week2 policy-comparison: research dashboard UI renders correctly', async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    window.localStorage.setItem('sql-adapt-welcome-seen', 'true');
  });

  await page.goto('/research');
  await expect(page).toHaveURL(/\/research/);
  
  // Verify main heading
  await expect(page.getByRole('heading', { name: 'Research Dashboard', level: 1 })).toBeVisible();
  
  // Verify Export Data button
  await expect(page.getByRole('button', { name: 'Export Data' })).toBeVisible();
  
  // Verify export scope toggle
  await expect(page.getByTestId('export-scope-label')).toContainText('active session (default)');
  
  // Verify tabs
  await expect(page.getByRole('tab', { name: 'Interaction Analysis' })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Error Analysis' })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Strategy Comparison' })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Timeline' })).toBeVisible();
  await expect(page.getByTestId('instructor-trace-tab')).toBeVisible();
  
  // Verify stat cards (use exact text matching)
  await expect(page.getByText('Learners', { exact: true })).toBeVisible();
  await expect(page.getByText('Interactions', { exact: true })).toBeVisible();
  await expect(page.getByText('Errors', { exact: true })).toBeVisible();
  await expect(page.getByText('Hints', { exact: true })).toBeVisible();
  
  // Verify LLM Health panel
  await expect(page.getByText('LLM Health Check')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Test LLM' })).toBeVisible();
  
  // Verify PDF RAG panel
  await expect(page.getByText('PDF Retrieval Index')).toBeVisible();
  await expect(page.getByTestId('pdf-index-load-button')).toBeVisible();
});

// Test 2: Session Export Functionality
test('@week2 policy-comparison: session export generates valid JSON', async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    window.localStorage.setItem('sql-adapt-welcome-seen', 'true');
  });

  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'SQL Learning Lab' })).toBeVisible();

  // Generate some interaction data
  const runQueryButton = page.getByRole('button', { name: 'Run Query' });
  await replaceEditorText(page, 'SELECT FROM users;');
  await runUntilErrorCount(page, runQueryButton, 1);
  
  await page.getByRole('button', { name: 'Request Hint' }).click();
  await expect(page.getByText('Hint 1', { exact: true })).toBeVisible();

  // Navigate to research dashboard and export
  await page.goto('/research');
  const exportData = await exportSession(page, { allHistory: false });
  
  // Verify export structure
  expect(exportData).toHaveProperty('interactions');
  expect(exportData).toHaveProperty('profiles');
  expect(exportData).toHaveProperty('textbooks');
  expect(exportData).toHaveProperty('activeSessionId');
  expect(exportData).toHaveProperty('exportPolicyVersion');
  expect(exportData).toHaveProperty('exportScope');
  expect(exportData).toHaveProperty('exportedAt');
  
  // Verify export values
  expect(Array.isArray(exportData.interactions)).toBeTruthy();
  expect(Array.isArray(exportData.profiles)).toBeTruthy();
  expect(exportData.exportScope).toBe('active-session');
  expect(typeof exportData.exportPolicyVersion).toBe('string');
  expect(exportData.exportPolicyVersion.length).toBeGreaterThan(0);
  
  // Verify interactions have required fields
  const interactions = exportData.interactions;
  if (interactions.length > 0) {
    expect(interactions[0]).toHaveProperty('id');
    expect(interactions[0]).toHaveProperty('sessionId');
    expect(interactions[0]).toHaveProperty('eventType');
    expect(interactions[0]).toHaveProperty('timestamp');
  }
});

// Test 3: Export JSON Schema Verification
test('@week2 policy-comparison: export JSON has all required schema fields', async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    window.localStorage.setItem('sql-adapt-welcome-seen', 'true');
  });

  await setupLearnerWithInteractions(page, 'adaptive-medium');
  await page.goto('/research');
  
  const exportData = await exportSession(page, { allHistory: true });
  
  // Verify all top-level fields per AGENTS.md specification
  const requiredFields = [
    'activeSessionId',
    'exportPolicyVersion',
    'exportScope',
    'exportedAt',
    'interactions',
    'llmCache',
    'pdfIndex',
    'pdfIndexProvenance',
    'profiles',
    'replayMode',
    'textbooks'
  ];
  
  for (const field of requiredFields) {
    expect(exportData).toHaveProperty(field);
  }
  
  // Verify field types
  expect(typeof exportData.activeSessionId).toBe('string');
  expect(typeof exportData.exportPolicyVersion).toBe('string');
  expect(['active-session', 'all-history']).toContain(exportData.exportScope);
  expect(typeof exportData.exportedAt).toBe('string');
  expect(Array.isArray(exportData.interactions)).toBeTruthy();
  expect(typeof exportData.profiles).toBe('object');
  expect(typeof exportData.textbooks).toBe('object');
  expect(typeof exportData.llmCache).toBe('object');
  expect(typeof exportData.replayMode).toBe('boolean');
  
  // Verify exportedAt is valid ISO timestamp
  const exportedDate = new Date(exportData.exportedAt);
  expect(exportedDate.toISOString()).toBe(exportData.exportedAt);
});

// Test 4: Policy Strategy Selection via Orchestrator
test('@week2 policy-comparison: policy strategy selection is available', async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    window.localStorage.setItem('sql-adapt-welcome-seen', 'true');
  });

  await setupLearnerWithInteractions(page, 'adaptive-medium');
  await page.goto('/research');
  
  // Verify threshold values directly from orchestrator for different strategies
  const thresholds = await page.evaluate(async () => {
    const { orchestrator } = await import('/src/app/lib/adaptive-orchestrator.ts');
    return {
      hintOnly: orchestrator.getThresholds('hint-only'),
      adaptiveMedium: orchestrator.getThresholds('adaptive-medium'),
      adaptiveLow: orchestrator.getThresholds('adaptive-low'),
      adaptiveHigh: orchestrator.getThresholds('adaptive-high')
    };
  });
  
  // Verify hint-only never escalates
  expect(thresholds.hintOnly.escalate).toBe(Infinity);
  expect(thresholds.hintOnly.aggregate).toBe(Infinity);
  
  // Verify adaptive-medium thresholds
  expect(thresholds.adaptiveMedium.escalate).toBe(3);
  expect(thresholds.adaptiveMedium.aggregate).toBe(6);
  
  // Verify adaptive-low thresholds
  expect(thresholds.adaptiveLow.escalate).toBe(5);
  expect(thresholds.adaptiveLow.aggregate).toBe(10);
  
  // Verify adaptive-high thresholds
  expect(thresholds.adaptiveHigh.escalate).toBe(2);
  expect(thresholds.adaptiveHigh.aggregate).toBe(4);
});

// Test 5: Hint-Only Strategy Never Escalates (using orchestrator directly)
test('@week2 policy-comparison: hint-only strategy never escalates to explanation', async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    window.localStorage.setItem('sql-adapt-welcome-seen', 'true');
  });

  await setupLearnerWithInteractions(page, 'hint-only');
  await page.goto('/research');
  
  // Get decisions using orchestrator directly
  const decisions = await page.evaluate(async () => {
    const { orchestrator } = await import('/src/app/lib/adaptive-orchestrator.ts');
    const { storage } = await import('/src/app/lib/storage.ts');
    
    const interactions = storage.getAllInteractions();
    const profile = storage.getProfile('learner-test');
    if (!profile) return [];
    
    const replayTrace = orchestrator.getPolicyReplayTrace(interactions);
    const replayDecisions = orchestrator.replayDecisionTrace(profile, replayTrace, 'hint-only');
    return replayDecisions.map(d => d.decision);
  });
  
  // Verify no 'show_explanation' decisions in hint-only mode
  const escalations = decisions.filter((d: string) => d === 'show_explanation');
  expect(escalations.length).toBe(0);
  
  // Verify threshold values via orchestrator
  const thresholds = await page.evaluate(async () => {
    const { orchestrator } = await import('/src/app/lib/adaptive-orchestrator.ts');
    return orchestrator.getThresholds('hint-only');
  });
  
  expect(thresholds.escalate).toBe(Infinity);
  expect(thresholds.aggregate).toBe(Infinity);
});

// Test 6: Adaptive-Medium Strategy Thresholds (using orchestrator directly)
test('@week2 policy-comparison: adaptive-medium has correct thresholds', async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    window.localStorage.setItem('sql-adapt-welcome-seen', 'true');
  });

  await page.goto('/research');
  
  // Verify threshold values via orchestrator for all strategies
  const thresholds = await page.evaluate(async () => {
    const { orchestrator } = await import('/src/app/lib/adaptive-orchestrator.ts');
    return {
      adaptiveMedium: orchestrator.getThresholds('adaptive-medium'),
      adaptiveLow: orchestrator.getThresholds('adaptive-low'),
      adaptiveHigh: orchestrator.getThresholds('adaptive-high'),
      hintOnly: orchestrator.getThresholds('hint-only')
    };
  });
  
  // Verify adaptive-medium thresholds
  expect(thresholds.adaptiveMedium.escalate).toBe(3);
  expect(thresholds.adaptiveMedium.aggregate).toBe(6);
  
  // Verify adaptive-low thresholds
  expect(thresholds.adaptiveLow.escalate).toBe(5);
  expect(thresholds.adaptiveLow.aggregate).toBe(10);
  
  // Verify adaptive-high thresholds
  expect(thresholds.adaptiveHigh.escalate).toBe(2);
  expect(thresholds.adaptiveHigh.aggregate).toBe(4);
  
  // Verify hint-only never escalates
  expect(thresholds.hintOnly.escalate).toBe(Infinity);
  expect(thresholds.hintOnly.aggregate).toBe(Infinity);
});

// Test 7: Auto-Escalation Modes Configuration via Orchestrator
test('@week2 policy-comparison: auto-escalation modes are configurable', async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    window.localStorage.setItem('sql-adapt-welcome-seen', 'true');
  });

  await page.goto('/research');
  
  // Verify auto-escalation modes exist and work
  const autoEscalationModes = await page.evaluate(async () => {
    const { orchestrator } = await import('/src/app/lib/adaptive-orchestrator.ts');
    
    // Create a mock profile to test makeDecision
    const mockProfile = {
      id: 'test-learner',
      name: 'Test Learner',
      conceptsCovered: new Set<string>(),
      conceptCoverageEvidence: new Map(),
      errorHistory: new Map(),
      interactionCount: 0,
      currentStrategy: 'adaptive-medium' as const,
      preferences: {
        escalationThreshold: 3,
        aggregationDelay: 300000
      }
    };
    
    // Test with different auto-escalation modes
    const decisionAlways = orchestrator.makeDecision(
      mockProfile,
      [],
      'test-problem',
      { autoEscalationMode: 'always-after-hint-threshold' }
    );
    
    const decisionGated = orchestrator.makeDecision(
      mockProfile,
      [],
      'test-problem',
      { autoEscalationMode: 'threshold-gated' }
    );
    
    return {
      always: decisionAlways.context,
      gated: decisionGated.context
    };
  });
  
  // Verify both modes produce valid context
  expect(autoEscalationModes.always).toBeDefined();
  expect(autoEscalationModes.gated).toBeDefined();
});

// Test 8: Decision Trace Structure Verification
test('@week2 policy-comparison: decision trace structure is correct', async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    window.localStorage.setItem('sql-adapt-welcome-seen', 'true');
  });

  await page.goto('/research');
  
  // Create a decision trace manually using orchestrator
  const trace = await page.evaluate(async () => {
    const { orchestrator } = await import('/src/app/lib/adaptive-orchestrator.ts');
    
    // Create mock interactions
    const mockInteractions = [
      { id: 'evt-1', timestamp: 1000, eventType: 'error', problemId: 'p1', learnerId: 'l1' },
      { id: 'evt-2', timestamp: 2000, eventType: 'hint_view', problemId: 'p1', learnerId: 'l1' },
      { id: 'evt-3', timestamp: 3000, eventType: 'error', problemId: 'p1', learnerId: 'l1' }
    ] as any;
    
    const mockProfile = {
      id: 'l1',
      name: 'Test Learner',
      conceptsCovered: new Set<string>(),
      conceptCoverageEvidence: new Map(),
      errorHistory: new Map(),
      interactionCount: 3,
      currentStrategy: 'adaptive-medium' as const,
      preferences: { escalationThreshold: 3, aggregationDelay: 300000 }
    };
    
    const replayTrace = orchestrator.getPolicyReplayTrace(mockInteractions);
    return orchestrator.replayDecisionTrace(mockProfile, replayTrace, 'adaptive-medium');
  });
  
  // Verify trace structure
  expect(trace.length).toBeGreaterThan(0);
  
  for (const decision of trace) {
    expect(decision).toHaveProperty('index');
    expect(decision).toHaveProperty('eventId');
    expect(decision).toHaveProperty('decision');
    expect(decision).toHaveProperty('ruleFired');
    expect(decision).toHaveProperty('strategy');
    expect(decision).toHaveProperty('reasoning');
    expect(decision).toHaveProperty('policyVersion');
    expect(decision).toHaveProperty('policySemanticsVersion');
    
    expect(typeof decision.index).toBe('number');
    expect(typeof decision.eventId).toBe('string');
    expect(typeof decision.decision).toBe('string');
    expect(typeof decision.ruleFired).toBe('string');
    expect(typeof decision.policyVersion).toBe('string');
    expect(typeof decision.policySemanticsVersion).toBe('string');
  }
});

// Test 9: Policy Comparison - Decision Divergence Detection
test('@week2 policy-comparison: decision divergence between strategies is detected', async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    window.localStorage.setItem('sql-adapt-welcome-seen', 'true');
  });

  await page.goto('/research');
  
  // Create decisions from both hint-only and adaptive-medium strategies with same trace
  const comparison = await page.evaluate(async () => {
    const { orchestrator } = await import('/src/app/lib/adaptive-orchestrator.ts');
    
    // Create mock interactions with multiple errors (should trigger escalation for adaptive)
    const mockInteractions = [
      { id: 'evt-1', timestamp: 1000, eventType: 'error', problemId: 'p1', learnerId: 'l1', errorSubtypeId: 'test-error' },
      { id: 'evt-2', timestamp: 2000, eventType: 'hint_view', problemId: 'p1', learnerId: 'l1' },
      { id: 'evt-3', timestamp: 3000, eventType: 'error', problemId: 'p1', learnerId: 'l1', errorSubtypeId: 'test-error' },
      { id: 'evt-4', timestamp: 4000, eventType: 'hint_view', problemId: 'p1', learnerId: 'l1' },
      { id: 'evt-5', timestamp: 5000, eventType: 'error', problemId: 'p1', learnerId: 'l1', errorSubtypeId: 'test-error' }
    ] as any;
    
    const mockProfile = {
      id: 'l1',
      name: 'Test Learner',
      conceptsCovered: new Set<string>(),
      conceptCoverageEvidence: new Map(),
      errorHistory: new Map(),
      interactionCount: 5,
      currentStrategy: 'adaptive-medium' as const,
      preferences: { escalationThreshold: 3, aggregationDelay: 300000 }
    };
    
    const replayTrace = orchestrator.getPolicyReplayTrace(mockInteractions);
    const hintOnlyDecisions = orchestrator.replayDecisionTrace(mockProfile, replayTrace, 'hint-only');
    const adaptiveDecisions = orchestrator.replayDecisionTrace(mockProfile, replayTrace, 'adaptive-medium');
    
    return {
      hintOnly: hintOnlyDecisions.map(d => d.decision),
      adaptive: adaptiveDecisions.map(d => d.decision),
      hintOnlyHasEscalation: hintOnlyDecisions.some(d => d.decision === 'show_explanation'),
      adaptiveHasEscalation: adaptiveDecisions.some(d => d.decision === 'show_explanation')
    };
  });
  
  // Verify both strategies produce decisions
  expect(comparison.hintOnly.length).toBeGreaterThan(0);
  expect(comparison.adaptive.length).toBeGreaterThan(0);
  
  // Verify hint-only NEVER escalates (key divergence point)
  expect(comparison.hintOnlyHasEscalation).toBe(false);
  
  // Adaptive may escalate after threshold (depending on error count)
  // The key point is that the decisions differ between strategies
  expect(comparison.hintOnly).not.toEqual(comparison.adaptive);
});

// Test 10: Research Guardrails - "Would Do" Language
test('@week2 policy-comparison: research guardrails use "would do" language', async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    window.localStorage.setItem('sql-adapt-welcome-seen', 'true');
  });

  await page.goto('/research');
  
  // Verify the page subtitle mentions replay ("would do" concept)
  await expect(page.getByText(/Offline replay and strategy comparison/)).toBeVisible();
  
  // Navigate to trace tab
  await page.getByTestId('instructor-trace-tab').click();
  await setupLearnerWithInteractions(page, 'adaptive-medium');
  await page.goto('/research');
  await page.getByTestId('instructor-trace-tab').click();
  
  // Verify trace replay header mentions policy knob
  await expect(page.getByText('Trace Replay With Policy Knob')).toBeVisible();
  
  // Verify the page does not make causal claims
  const pageContent = await page.content();
  
  // Should NOT contain causal language about learning outcomes
  const invalidClaims = [
    /improve.*learning/i,
    /better.*outcome/i,
    /increase.*performance/i,
    /more.*effective/i,
    /superior.*policy/i
  ];
  
  for (const pattern of invalidClaims) {
    expect(pageContent).not.toMatch(pattern);
  }
});

// Test 11: Export Scope Toggle
test('@week2 policy-comparison: export scope toggle works correctly', async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    window.localStorage.setItem('sql-adapt-welcome-seen', 'true');
  });

  await setupLearnerWithInteractions(page, 'adaptive-medium');
  await page.goto('/research');
  
  // Verify default scope label
  await expect(page.getByTestId('export-scope-label')).toContainText('active session (default)');
  
  // Toggle to all history
  await page.getByRole('checkbox', { name: /Include all history/ }).check();
  await expect(page.getByTestId('export-scope-label')).toContainText('all history');
  
  // Export with all history
  const allHistoryExport = await exportSession(page, { allHistory: true });
  expect(allHistoryExport.exportScope).toBe('all-history');
  
  // Toggle back to active session
  await page.getByRole('checkbox', { name: /Include all history/ }).uncheck();
  await expect(page.getByTestId('export-scope-label')).toContainText('active session (default)');
  
  // Export with active session only
  const activeSessionExport = await exportSession(page, { allHistory: false });
  expect(activeSessionExport.exportScope).toBe('active-session');
});

// Test 12: Strategy Comparison Tab
test('@week2 policy-comparison: strategy comparison tab shows experiment conditions', async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    window.localStorage.setItem('sql-adapt-welcome-seen', 'true');
  });

  await setupLearnerWithInteractions(page, 'adaptive-medium');
  await page.goto('/research');
  
  // Click on Strategy Comparison tab
  await page.getByRole('tab', { name: 'Strategy Comparison' }).click();
  
  // Verify experiment conditions are displayed
  await expect(page.getByText('Hint-Only')).toBeVisible();
  await expect(page.getByText('Only provides hints, never escalates')).toBeVisible();
  
  await expect(page.getByText('Adaptive (Low)')).toBeVisible();
  await expect(page.getByText('Escalates after 5 errors, aggregates after 10')).toBeVisible();
  
  await expect(page.getByText('Adaptive (Medium)')).toBeVisible();
  await expect(page.getByText('Escalates after 3 errors, aggregates after 6')).toBeVisible();
  
  await expect(page.getByText('Adaptive (High)')).toBeVisible();
  await expect(page.getByText('Escalates after 2 errors, aggregates after 4')).toBeVisible();
});

// Test 13: Policy Version in Decision Trace
test('@week2 policy-comparison: policy version is recorded in decision trace', async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    window.localStorage.setItem('sql-adapt-welcome-seen', 'true');
  });

  await setupLearnerWithInteractions(page, 'adaptive-medium');
  await page.goto('/research');
  
  // Get decisions via orchestrator replay
  const decisions = await getReplayDecisions(page, 'adaptive-medium');
  
  // Verify each decision has policy version info
  for (const decision of decisions) {
    expect(decision.policyVersion).toContain('sql-engage');
    expect(decision.policySemanticsVersion).toContain('orchestrator');
  }
});

// Test 14: Policy Version Constants
test('@week2 policy-comparison: policy versions are consistent', async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    window.localStorage.setItem('sql-adapt-welcome-seen', 'true');
  });

  await page.goto('/research');
  
  // Verify policy versions from orchestrator and sql-engage
  const versions = await page.evaluate(async () => {
    const { orchestrator } = await import('/src/app/lib/adaptive-orchestrator.ts');
    const { getSqlEngagePolicyVersion } = await import('/src/app/data/sql-engage.ts');
    
    return {
      orchestratorSemantics: orchestrator.getPolicySemanticsVersion(),
      sqlEngagePolicy: getSqlEngagePolicyVersion()
    };
  });
  
  // Verify versions follow expected patterns
  expect(versions.orchestratorSemantics).toContain('orchestrator');
  expect(versions.sqlEngagePolicy).toContain('sql-engage');
});
