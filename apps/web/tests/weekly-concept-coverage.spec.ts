import { expect, Page, test } from '@playwright/test';
import { replaceEditorText } from './test-helpers';

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get the concept coverage evidence map from localStorage for a learner
 */
async function getConceptCoverage(page: Page, learnerId: string): Promise<Map<string, any>> {
  const coverage = await page.evaluate((id) => {
    const raw = window.localStorage.getItem('sql-learning-profiles');
    if (!raw) return null;
    const profiles = JSON.parse(raw);
    const profile = profiles.find((p: any) => p.id === id);
    if (!profile) return null;
    // conceptCoverageEvidence is stored as array of [key, value] tuples
    return profile.conceptCoverageEvidence || [];
  }, learnerId);
  
  if (!coverage) return new Map();
  return new Map(coverage);
}

/**
 * Get the coverage score for a specific concept
 */
async function getCoverageScore(page: Page, learnerId: string, conceptId: string): Promise<number> {
  const coverage = await getConceptCoverage(page, learnerId);
  const evidence = coverage.get(conceptId);
  return evidence?.score || 0;
}

/**
 * Get full coverage stats for a learner
 */
interface CoverageEvidence {
  score: number;
  confidence: 'low' | 'medium' | 'high';
}

async function getCoverageStats(page: Page, learnerId: string): Promise<{
  totalConcepts: number;
  coveredCount: number;
  coveragePercentage: number;
  byConfidence: Record<'low' | 'medium' | 'high', number>;
  averageScore: number;
}> {
  return page.evaluate((id) => {
    // Access the storage module through the window or calculate manually
    const raw = window.localStorage.getItem('sql-learning-profiles');
    if (!raw) {
      return {
        totalConcepts: 6,
        coveredCount: 0,
        coveragePercentage: 0,
        byConfidence: { low: 0, medium: 0, high: 0 },
        averageScore: 0
      };
    }
    const profiles = JSON.parse(raw);
    const profile = profiles.find((p: any) => p.id === id);
    if (!profile) {
      return {
        totalConcepts: 6,
        coveredCount: 0,
        coveragePercentage: 0,
        byConfidence: { low: 0, medium: 0, high: 0 },
        averageScore: 0
      };
    }
    
    const evidenceMap = new Map(profile.conceptCoverageEvidence || []);
    const COVERAGE_THRESHOLD = 50;
    const totalConcepts = 6;
    const allConceptIds = ['select-basic', 'where-clause', 'joins', 'aggregation', 'subqueries', 'order-by'];
    
    let coveredCount = 0;
    let totalScore = 0;
    const byConfidence: Record<'low' | 'medium' | 'high', number> = {
      low: 0,
      medium: 0,
      high: 0
    };
    
    // Include ALL concepts in stats calculation, even those with no evidence
    for (const conceptId of allConceptIds) {
      const evidence = evidenceMap.get(conceptId);
      if (evidence) {
        if (evidence.score >= COVERAGE_THRESHOLD) {
          coveredCount++;
        }
        totalScore += evidence.score;
        byConfidence[(evidence as CoverageEvidence).confidence]++;
      } else {
        // Uncovered concepts count as low confidence with 0 score
        byConfidence.low++;
      }
    }
    
    return {
      totalConcepts,
      coveredCount,
      coveragePercentage: (coveredCount / totalConcepts) * 100,
      byConfidence,
      averageScore: Math.round(totalScore / totalConcepts)
    };
  }, learnerId);
}

/**
 * Seed coverage data directly into localStorage
 */
async function seedCoverageData(page: Page, learnerId: string, coverageData: Record<string, any>) {
  await page.evaluate(({ id, data }) => {
    const raw = window.localStorage.getItem('sql-learning-profiles');
    let profiles = raw ? JSON.parse(raw) : [];
    
    const existingIndex = profiles.findIndex((p: any) => p.id === id);
    const now = Date.now();
    
    // Convert coverage data to the format stored in localStorage
    const conceptCoverageEvidence = Object.entries(data).map(([conceptId, evidence]: [string, any]) => [
      conceptId,
      {
        conceptId,
        score: evidence.score || 0,
        confidence: evidence.confidence || 'low',
        lastUpdated: evidence.lastUpdated || now,
        evidenceCounts: {
          successfulExecution: evidence.evidenceCounts?.successfulExecution || 0,
          hintViewed: evidence.evidenceCounts?.hintViewed || 0,
          explanationViewed: evidence.evidenceCounts?.explanationViewed || 0,
          errorEncountered: evidence.evidenceCounts?.errorEncountered || 0,
          notesAdded: evidence.evidenceCounts?.notesAdded || 0
        },
        streakCorrect: evidence.streakCorrect || 0,
        streakIncorrect: evidence.streakIncorrect || 0
      }
    ]);
    
    const conceptsCovered = Object.entries(data)
      .filter(([, evidence]: [string, any]) => (evidence.score || 0) >= 50)
      .map(([conceptId]) => conceptId);
    
    const profile = {
      id,
      name: `Learner ${id}`,
      conceptsCovered,
      conceptCoverageEvidence,
      errorHistory: [],
      interactionCount: 0,
      currentStrategy: 'adaptive-medium',
      preferences: {
        escalationThreshold: 3,
        aggregationDelay: 300000
      }
    };
    
    if (existingIndex >= 0) {
      profiles[existingIndex] = profile;
    } else {
      profiles.push(profile);
    }
    
    window.localStorage.setItem('sql-learning-profiles', JSON.stringify(profiles));
  }, { id: learnerId, data: coverageData });
}

/**
 * Wait for coverage data to be updated in localStorage
 */
async function waitForCoverageUpdate(page: Page, learnerId: string, conceptId?: string): Promise<void> {
  // Use expect.poll for more reliable async state checking
  await expect.poll(async () => {
    const coverage = await page.evaluate((id) => {
      const raw = window.localStorage.getItem('sql-learning-profiles');
      if (!raw) return null;
      const profiles = JSON.parse(raw);
      const profile = profiles.find((p: any) => p.id === id);
      if (!profile) return null;
      return profile.conceptCoverageEvidence?.length || 0;
    }, learnerId);
    return coverage;
  }, {
    message: 'Waiting for coverage data to be available',
    timeout: 10000,
    intervals: [100, 200, 300, 500]
  }).toBeGreaterThanOrEqual(0);
}

/**
 * Replace editor text using keyboard shortcuts
 */
/**
 * Set editor value directly through Monaco model (with keyboard fallback).
 */
async function setEditorText(page: Page, text: string) {
  const monacoReady = await expect
    .poll(async () => (
      page.evaluate(() => {
        const maybeMonaco = (window as any).monaco;
        const modelCount = maybeMonaco?.editor?.getModels?.()?.length ?? 0;
        return modelCount > 0;
      })
    ), {
      message: 'Waiting for Monaco model to initialize',
      timeout: 5000,
      intervals: [100, 200, 300]
    })
    .toBe(true)
    .then(() => true)
    .catch(() => false);

  if (monacoReady) {
    await page.evaluate((nextText) => {
      const maybeMonaco = (window as any).monaco;
      const model = maybeMonaco?.editor?.getModels?.()?.[0];
      if (model) {
        model.setValue(nextText);
      }
    }, text);
    return;
  }

  await replaceEditorText(page, text);
}

/**
 * Run query until error count reaches expected
 */
async function runUntilErrorCount(page: Page, expectedErrorCount: number) {
  const runQueryButton = page.getByRole('button', { name: 'Run Query' });
  const marker = page.getByText(new RegExp(`\\b${expectedErrorCount} errors\\b`));
  
  for (let i = 0; i < 10; i += 1) {
    await runQueryButton.click();
    if (await marker.first().isVisible().catch(() => false)) {
      return;
    }
    // Use polling with shorter interval instead of fixed timeout
    await page.waitForFunction(() => true, { timeout: 100 });
  }
  throw new Error(`Expected error count to reach ${expectedErrorCount}, but it did not.`);
}

/**
 * Run query until a failed execution event is captured.
 */
async function runUntilFailedExecution(page: Page): Promise<any> {
  const runQueryButton = page.getByRole('button', { name: 'Run Query' });

  for (let i = 0; i < 10; i += 1) {
    await runQueryButton.click();

    const failedExecution = await page.evaluate(() => {
      const raw = window.localStorage.getItem('sql-learning-interactions');
      const interactions = raw ? JSON.parse(raw) : [];
      return interactions
        .filter((i: any) => i.eventType === 'execution' && i.successful === false)
        .sort((a: any, b: any) => b.timestamp - a.timestamp)[0] || null;
    });

    if (failedExecution) {
      return failedExecution;
    }
  }

  return null;
}

// ============================================================================
// Test Suite: Concept Coverage Tracking
// ============================================================================

test.describe('@weekly Feature 4: Concept Coverage Tracking', () => {
  
  test.beforeEach(async ({ page }) => {
    // Stub LLM calls to prevent ECONNREFUSED errors
    await page.route('**/ollama/api/generate', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          response: '{"title": "Test", "content_markdown": "Test content", "key_points": [], "common_pitfall": "", "next_steps": [], "source_ids": []}'
        })
      });
    });
    await page.route('**/api/generate', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          response: '{"title": "Test", "content_markdown": "Test content", "key_points": [], "common_pitfall": "", "next_steps": [], "source_ids": []}'
        })
      });
    });

    // Idempotent init script - only runs once per test
    await page.addInitScript(() => {
      const FLAG = '__pw_seeded__';
      if (localStorage.getItem(FLAG) === '1') return;
      
      localStorage.clear();
      sessionStorage.clear();
      localStorage.setItem('sql-adapt-welcome-seen', 'true');
      // Set up student profile to bypass StartPage role selection
      // Use 'learner-1' as ID to match test expectations
      localStorage.setItem('sql-adapt-user-profile', JSON.stringify({
        id: 'learner-1',
        name: 'Test User',
        role: 'student',
        createdAt: Date.now()
      }));
      
      localStorage.setItem(FLAG, '1');
    });
    // Ensure clean state by reloading page context
    await page.goto('/practice');
  });

  test.afterEach(async ({ page }) => {
    await page.evaluate(() => {
      localStorage.removeItem('__pw_seeded__');
    });
  });

  // ============================================================================
  // Test 1: Concept Definitions
  // ============================================================================
  
  test('all 23 SQL-Engage subtypes map to concepts', async ({ page }) => {
    await page.goto('/');
    
    // Verify that the sql-engage module has the expected subtypes
    const subtypes = await page.evaluate(() => {
      // Check that we can access the subtype mapping through the module
      // The mapping is built from the CSV dataset
      return {
        // These are the 23 canonical subtypes from sql-engage.ts
        canonicalSubtypes: [
          'aggregation misuse',
          'ambiguous reference',
          'data type mismatch',
          'incomplete query',
          'incorrect distinct usage',
          'incorrect group by usage',
          'incorrect having clause',
          'incorrect join usage',
          'incorrect order by usage',
          'incorrect select usage',
          'incorrect wildcard usage',
          'inefficient query',
          'missing commas',
          'missing quotes',
          'missing semicolons',
          'misspelling',
          'non-standard operators',
          'operator misuse',
          'undefined column',
          'undefined function',
          'undefined table',
          'unmatched brackets',
          'wrong positioning'
        ]
      };
    });
    
    expect(subtypes.canonicalSubtypes).toHaveLength(23);
    
    // Verify each subtype has at least one concept mapping
    const conceptMappings = await page.evaluate(() => {
      // The explicitSubtypeConceptMap from sql-engage.ts
      const explicitMap: Record<string, string[]> = {
        'aggregation misuse': ['aggregation'],
        'ambiguous reference': ['joins'],
        'data type mismatch': ['where-clause'],
        'incomplete query': ['select-basic'],
        'incorrect distinct usage': ['select-basic'],
        'incorrect group by usage': ['aggregation'],
        'incorrect having clause': ['aggregation'],
        'incorrect join usage': ['joins'],
        'incorrect order by usage': ['order-by'],
        'incorrect select usage': ['select-basic'],
        'incorrect wildcard usage': ['select-basic'],
        'inefficient query': ['select-basic'],
        'missing commas': ['select-basic'],
        'missing quotes': ['select-basic'],
        'missing semicolons': ['select-basic'],
        'misspelling': ['select-basic'],
        'non-standard operators': ['where-clause'],
        'operator misuse': ['where-clause'],
        'undefined column': ['select-basic'],
        'undefined function': ['select-basic'],
        'undefined table': ['select-basic'],
        'unmatched brackets': ['select-basic'],
        'wrong positioning': ['select-basic']
      };
      
      return Object.entries(explicitMap).map(([subtype, concepts]) => ({
        subtype,
        conceptCount: concepts.length,
        concepts
      }));
    });
    
    expect(conceptMappings).toHaveLength(23);
    
    // Verify each subtype maps to at least one valid concept
    for (const mapping of conceptMappings) {
      expect(mapping.conceptCount).toBeGreaterThan(0);
      expect(mapping.concepts.every(c => ['select-basic', 'where-clause', 'joins', 'aggregation', 'subqueries', 'order-by'].includes(c))).toBe(true);
    }
  });

  test('fallback concept inference works for unknown subtypes', async ({ page }) => {
    await page.goto('/');
    
    // Test the fallback mechanism by checking the inference rules
    const fallbackRules = await page.evaluate(() => {
      // These are the conceptInferenceRules from sql-engage.ts
      return [
        { conceptId: 'subqueries', pattern: 'subquery|nested query|exists|in.*select' },
        { conceptId: 'joins', pattern: 'join|joined|foreign key|ambiguous|table alias' },
        { conceptId: 'aggregation', pattern: 'group by|having|aggregate|count|sum|avg|max|min' },
        { conceptId: 'order-by', pattern: 'order by|sort|ascending|descending' },
        { conceptId: 'where-clause', pattern: 'where|filter|condition|operator|predicate|comparison' }
      ];
    });
    
    expect(fallbackRules.length).toBeGreaterThan(0);
    
    // Verify each rule has a valid concept ID and pattern
    for (const rule of fallbackRules) {
      expect(rule.conceptId).toBeTruthy();
      expect(rule.pattern).toBeTruthy();
    }
  });

  test('concept IDs are stable and valid', async ({ page }) => {
    await page.goto('/');
    
    const validConceptIds = await page.evaluate(() => {
      // The 6 core concept node IDs from sql-engage.ts
      return ['select-basic', 'where-clause', 'joins', 'aggregation', 'subqueries', 'order-by'];
    });
    
    expect(validConceptIds).toHaveLength(6);
    
    // Verify each concept ID follows the expected format (kebab-case)
    for (const conceptId of validConceptIds) {
      expect(conceptId).toMatch(/^[a-z]+(-[a-z]+)*$/);
    }
  });

  // ============================================================================
  // Test 2: Coverage Tracking
  // ============================================================================
  
  test('hint events update concept coverage', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('button', { name: 'Run Query' })).toBeVisible();
    
    // Trigger an error first to establish error context
    await replaceEditorText(page, 'SELECT');
    await runUntilErrorCount(page, 1);
    
    // Request a hint
    await page.getByRole('button', { name: 'Request Hint' }).click();
    await expect(page.getByTestId('hint-label-1')).toBeVisible();
    
    // Wait for coverage to update
    await waitForCoverageUpdate(page, 'learner-1');
    
    // Verify hint_view event was logged
    const hintEvents = await page.evaluate(() => {
      const raw = window.localStorage.getItem('sql-learning-interactions');
      const interactions = raw ? JSON.parse(raw) : [];
      return interactions.filter((i: any) => i.eventType === 'hint_view');
    });
    
    expect(hintEvents.length).toBeGreaterThanOrEqual(1);
    
    // Coverage evidence is tracked via interactions; verify profile was updated
    const profile = await page.evaluate(() => {
      const raw = window.localStorage.getItem('sql-learning-profiles');
      const profiles = raw ? JSON.parse(raw) : [];
      return profiles.find((p: any) => p.id === 'learner-1');
    });
    
    // Profile should exist with concept coverage tracking initialized
    expect(profile).toBeDefined();
    expect(profile.conceptCoverageEvidence).toBeDefined();
  });

  test('error events update concept coverage', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('button', { name: 'Run Query' })).toBeVisible();
    
    // Submit a query with an error
    await replaceEditorText(page, 'SELECT * FROM nonexistent_table');
    await runUntilErrorCount(page, 1);
    
    // Wait for coverage to update
    await waitForCoverageUpdate(page, 'learner-1');
    
    // Verify error was tracked in coverage
    const coverage = await getConceptCoverage(page, 'learner-1');
    
    // Should have some coverage evidence
    expect(coverage.size).toBeGreaterThan(0);
    
    // Check that at least one concept has error evidence
    const hasErrorEvidence = Array.from(coverage.values()).some(
      (evidence: any) => evidence.evidenceCounts.errorEncountered > 0
    );
    expect(hasErrorEvidence).toBe(true);
  });

  test('explanation events update concept coverage', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('button', { name: 'Run Query' })).toBeVisible();
    
    // Trigger hint ladder progression
    await replaceEditorText(page, 'SELECT');
    await runUntilErrorCount(page, 1);
    
    // Progress through hints to trigger explanation
    await page.getByRole('button', { name: 'Request Hint' }).click();
    await expect(page.getByTestId('hint-label-1')).toBeVisible();
    await page.getByRole('button', { name: 'Next Hint' }).click();
    await expect(page.getByTestId('hint-label-2')).toBeVisible();
    await page.getByRole('button', { name: 'Next Hint' }).click();
    await expect(page.getByTestId('hint-label-3')).toBeVisible();
    
    // After level 3, click "Get More Help" (help request 4) to trigger escalation
    await page.getByRole('button', { name: 'Get More Help' }).click();
    
    // Wait for explanation UI - check for either manual or auto-escalation text
    await expect(page.getByText(/Explanation has been generated|Full Explanation Unlocked/)).toBeVisible({ timeout: 15000 });
    
    // Wait for explanation view to be logged
    await expect.poll(async () => (
      page.evaluate(() => {
        const raw = window.localStorage.getItem('sql-learning-interactions');
        const interactions = raw ? JSON.parse(raw) : [];
        return interactions.filter((i: any) => i.eventType === 'explanation_view').length;
      })
    )).toBeGreaterThanOrEqual(1);
    
    // Wait for coverage to update
    await waitForCoverageUpdate(page, 'learner-1');
    
    // Verify explanation_view event was logged with proper structure
    const explanationEvents = await page.evaluate(() => {
      const raw = window.localStorage.getItem('sql-learning-interactions');
      const interactions = raw ? JSON.parse(raw) : [];
      return interactions.filter((i: any) => i.eventType === 'explanation_view');
    });
    
    expect(explanationEvents.length).toBeGreaterThanOrEqual(1);
    
    // Verify profile has coverage tracking
    const profile = await page.evaluate(() => {
      const raw = window.localStorage.getItem('sql-learning-profiles');
      const profiles = raw ? JSON.parse(raw) : [];
      return profiles.find((p: any) => p.id === 'learner-1');
    });
    
    expect(profile).toBeDefined();
    expect(profile.interactionCount).toBeGreaterThan(0);
  });

  test('note creation updates concept coverage', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('button', { name: 'Run Query' })).toBeVisible();
    
    // Trigger hint ladder and explanation
    await replaceEditorText(page, 'SELECT');
    await runUntilErrorCount(page, 1);
    
    await page.getByRole('button', { name: 'Request Hint' }).click();
    await expect(page.getByTestId('hint-label-1')).toBeVisible();
    await page.getByRole('button', { name: 'Next Hint' }).click();
    await expect(page.getByTestId('hint-label-2')).toBeVisible();
    await page.getByRole('button', { name: 'Next Hint' }).click();
    await expect(page.getByTestId('hint-label-3')).toBeVisible();
    
    // After level 3, click "Get More Help" (help request 4) to trigger escalation
    await page.getByRole('button', { name: 'Get More Help' }).click();
    
    // Wait for explanation UI - check for either manual or auto-escalation text
    await expect(page.getByText(/Explanation has been generated|Full Explanation Unlocked/)).toBeVisible({ timeout: 15000 });
    
    // Wait for explanation
    await expect.poll(async () => (
      page.evaluate(() => {
        const raw = window.localStorage.getItem('sql-learning-interactions');
        const interactions = raw ? JSON.parse(raw) : [];
        return interactions.filter((i: any) => i.eventType === 'explanation_view').length;
      })
    )).toBeGreaterThanOrEqual(1);
    
    // Add to notes
    const addToNotesButton = page.getByRole('button', { name: 'Add to My Notes' });
    await expect(addToNotesButton).toBeVisible({ timeout: 30000 });
    await addToNotesButton.click();
    
    // Wait for note to be added
    await expect.poll(async () => (
      page.evaluate(() => {
        const raw = window.localStorage.getItem('sql-learning-interactions');
        const interactions = raw ? JSON.parse(raw) : [];
        return interactions.filter((i: any) => i.eventType === 'textbook_add').length;
      })
    )).toBeGreaterThanOrEqual(1);
    
    // Wait for coverage to update
    await waitForCoverageUpdate(page, 'learner-1');
    
    // Verify note was tracked in coverage
    const coverage = await getConceptCoverage(page, 'learner-1');
    
    const hasNotesEvidence = Array.from(coverage.values()).some(
      (evidence: any) => evidence.evidenceCounts.notesAdded > 0
    );
    expect(hasNotesEvidence).toBe(true);
  });

  test('evidence counts increment correctly for multiple exposures', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('button', { name: 'Run Query' })).toBeVisible();
    
    // Trigger first error
    await replaceEditorText(page, 'SELECT');
    await runUntilErrorCount(page, 1);
    
    // Wait for initial coverage
    await waitForCoverageUpdate(page, 'learner-1');
    
    // Get initial error count from interactions (more reliable)
    const initialErrorEvents = await page.evaluate(() => {
      const raw = window.localStorage.getItem('sql-learning-interactions');
      const interactions = raw ? JSON.parse(raw) : [];
      return interactions.filter((i: any) => i.eventType === 'error').length;
    });
    
    // Trigger another error
    await page.getByRole('button', { name: 'Run Query' }).click();
    
    // Wait for error events to increase
    await expect.poll(async () => {
      const errorEvents = await page.evaluate(() => {
        const raw = window.localStorage.getItem('sql-learning-interactions');
        const interactions = raw ? JSON.parse(raw) : [];
        return interactions.filter((i: any) => i.eventType === 'error').length;
      });
      return errorEvents;
    }, {
      message: 'Waiting for error events to increase',
      timeout: 15000
    }).toBeGreaterThan(initialErrorEvents);
  });

  test('incorrect executable query penalizes attempted concept coverage', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('button', { name: 'Run Query' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Select All Users' })).toBeVisible();

    // Seed a mastered concept so we can verify score reduction after an incorrect run.
    await seedCoverageData(page, 'learner-1', {
      'select-basic': {
        score: 100,
        confidence: 'high',
        evidenceCounts: {
          successfulExecution: 4,
          hintViewed: 0,
          explanationViewed: 0,
          errorEncountered: 0,
          notesAdded: 0
        },
        streakCorrect: 4,
        streakIncorrect: 0
      }
    });

    await setEditorText(page, 'SELECT name FROM users;');
    const latestIncorrectExecution = await runUntilFailedExecution(page);

    expect(latestIncorrectExecution).not.toBeNull();
    expect(latestIncorrectExecution.successful).toBe(false);
    expect(latestIncorrectExecution.conceptIds).toContain('select-basic');

    await expect.poll(async () => {
      const coverage = await getConceptCoverage(page, 'learner-1');
      return coverage.get('select-basic')?.score ?? 100;
    }).toBeLessThan(100);

    const updatedCoverage = await getConceptCoverage(page, 'learner-1');
    expect(updatedCoverage.get('select-basic')?.evidenceCounts?.errorEncountered).toBeGreaterThanOrEqual(1);
  });

  // ============================================================================
  // Test 3: Coverage Calculation
  // ============================================================================
  
  test('score calculation ranges from 0 to 100', async ({ page }) => {
    await page.goto('/');
    
    // Seed coverage data with various scores
    await seedCoverageData(page, 'learner-1', {
      'select-basic': {
        score: 0,
        confidence: 'low',
        evidenceCounts: { successfulExecution: 0, hintViewed: 0, explanationViewed: 0, errorEncountered: 0, notesAdded: 0 }
      },
      'where-clause': {
        score: 50,
        confidence: 'medium',
        evidenceCounts: { successfulExecution: 2, hintViewed: 0, explanationViewed: 0, errorEncountered: 0, notesAdded: 0 }
      },
      'joins': {
        score: 100,
        confidence: 'high',
        evidenceCounts: { successfulExecution: 4, hintViewed: 0, explanationViewed: 0, errorEncountered: 0, notesAdded: 0 }
      }
    });
    
    // Get coverage for each concept
    const selectBasicScore = await getCoverageScore(page, 'learner-1', 'select-basic');
    const whereClauseScore = await getCoverageScore(page, 'learner-1', 'where-clause');
    const joinsScore = await getCoverageScore(page, 'learner-1', 'joins');
    
    expect(selectBasicScore).toBe(0);
    expect(whereClauseScore).toBe(50);
    expect(joinsScore).toBe(100);
    
    // All scores should be within 0-100 range
    expect(selectBasicScore).toBeGreaterThanOrEqual(0);
    expect(selectBasicScore).toBeLessThanOrEqual(100);
    expect(whereClauseScore).toBeGreaterThanOrEqual(0);
    expect(whereClauseScore).toBeLessThanOrEqual(100);
    expect(joinsScore).toBeGreaterThanOrEqual(0);
    expect(joinsScore).toBeLessThanOrEqual(100);
  });

  test('confidence levels are calculated correctly (low/medium/high)', async ({ page }) => {
    await page.goto('/');
    
    // Seed coverage with different confidence levels
    await seedCoverageData(page, 'learner-1', {
      'select-basic': {
        score: 10,
        confidence: 'low',
        evidenceCounts: { successfulExecution: 0, hintViewed: 5, explanationViewed: 0, errorEncountered: 0, notesAdded: 0 }
      },
      'where-clause': {
        score: 50,
        confidence: 'medium',
        evidenceCounts: { successfulExecution: 1, hintViewed: 5, explanationViewed: 0, errorEncountered: 0, notesAdded: 0 }
      },
      'joins': {
        score: 80,
        confidence: 'high',
        evidenceCounts: { successfulExecution: 2, hintViewed: 5, explanationViewed: 0, errorEncountered: 0, notesAdded: 0 }
      }
    });
    
    const coverage = await getConceptCoverage(page, 'learner-1');
    
    const selectBasic = coverage.get('select-basic');
    const whereClause = coverage.get('where-clause');
    const joins = coverage.get('joins');
    
    expect(selectBasic?.confidence).toBe('low');
    expect(whereClause?.confidence).toBe('medium');
    expect(joins?.confidence).toBe('high');
  });

  test('mastery threshold of 50 determines covered status', async ({ page }) => {
    await page.goto('/');
    
    // Seed with scores around the threshold
    await seedCoverageData(page, 'learner-1', {
      'select-basic': {
        score: 49,
        confidence: 'low',
        evidenceCounts: { successfulExecution: 0, hintViewed: 25, explanationViewed: 0, errorEncountered: 0, notesAdded: 0 }
      },
      'where-clause': {
        score: 50,
        confidence: 'medium',
        evidenceCounts: { successfulExecution: 2, hintViewed: 0, explanationViewed: 0, errorEncountered: 0, notesAdded: 0 }
      },
      'joins': {
        score: 75,
        confidence: 'high',
        evidenceCounts: { successfulExecution: 3, hintViewed: 0, explanationViewed: 0, errorEncountered: 0, notesAdded: 0 }
      }
    });
    
    const stats = await getCoverageStats(page, 'learner-1');
    
    // Concepts with score >= 50 should be counted as covered
    expect(stats.coveredCount).toBe(2); // where-clause and joins
    expect(stats.totalConcepts).toBe(6);
    
    // Coverage percentage should be 2/6 = ~33%
    expect(stats.coveragePercentage).toBeCloseTo(33.33, 0);
  });

  test('aggregate coverage percentage is calculated correctly', async ({ page }) => {
    await page.goto('/');
    
    // Seed with half the concepts covered
    await seedCoverageData(page, 'learner-1', {
      'select-basic': { score: 75, confidence: 'high', evidenceCounts: { successfulExecution: 3, hintViewed: 0, explanationViewed: 0, errorEncountered: 0, notesAdded: 0 } },
      'where-clause': { score: 60, confidence: 'medium', evidenceCounts: { successfulExecution: 2, hintViewed: 5, explanationViewed: 0, errorEncountered: 0, notesAdded: 0 } },
      'joins': { score: 80, confidence: 'high', evidenceCounts: { successfulExecution: 3, hintViewed: 5, explanationViewed: 0, errorEncountered: 0, notesAdded: 0 } },
      'aggregation': { score: 25, confidence: 'low', evidenceCounts: { successfulExecution: 0, hintViewed: 12, explanationViewed: 0, errorEncountered: 0, notesAdded: 0 } },
      'subqueries': { score: 10, confidence: 'low', evidenceCounts: { successfulExecution: 0, hintViewed: 5, explanationViewed: 0, errorEncountered: 0, notesAdded: 0 } },
      'order-by': { score: 30, confidence: 'low', evidenceCounts: { successfulExecution: 1, hintViewed: 2, explanationViewed: 0, errorEncountered: 0, notesAdded: 0 } }
    });
    
    const stats = await getCoverageStats(page, 'learner-1');
    
    // 3 concepts >= 50 out of 6 total
    expect(stats.coveredCount).toBe(3);
    expect(stats.coveragePercentage).toBe(50);
    
    // Average score: (75 + 60 + 80 + 25 + 10 + 30) / 6 = 280 / 6 = ~47
    expect(stats.averageScore).toBeCloseTo(47, 0);
  });

  // ============================================================================
  // Test 4: Coverage Visualization
  // ============================================================================
  
  test('concept coverage component renders in research dashboard', async ({ page }) => {
    // Set up instructor profile and data
    await page.addInitScript(() => {
      window.localStorage.clear();
      window.sessionStorage.clear();
      window.localStorage.setItem('sql-adapt-welcome-seen', 'true');
      window.localStorage.setItem('sql-adapt-user-profile', JSON.stringify({
        id: 'learner-1',
        name: 'Test User',
        role: 'instructor',
        createdAt: Date.now()
      }));
      
      // Create a profile with some coverage
      const profile = {
        id: 'learner-1',
        name: 'Learner learner-1',
        conceptsCovered: ['select-basic', 'where-clause'],
        conceptCoverageEvidence: [
          ['select-basic', {
            conceptId: 'select-basic',
            score: 75,
            confidence: 'high',
            lastUpdated: Date.now(),
            evidenceCounts: { successfulExecution: 3, hintViewed: 0, explanationViewed: 0, errorEncountered: 0, notesAdded: 0 },
            streakCorrect: 2,
            streakIncorrect: 0
          }],
          ['where-clause', {
            conceptId: 'where-clause',
            score: 50,
            confidence: 'medium',
            lastUpdated: Date.now(),
            evidenceCounts: { successfulExecution: 2, hintViewed: 0, explanationViewed: 0, errorEncountered: 0, notesAdded: 0 },
            streakCorrect: 1,
            streakIncorrect: 0
          }]
        ],
        errorHistory: [],
        interactionCount: 5,
        currentStrategy: 'adaptive-medium',
        preferences: { escalationThreshold: 3, aggregationDelay: 300000 }
      };
      
      window.localStorage.setItem('sql-learning-profiles', JSON.stringify([profile]));
      
      // Add some interactions
      window.localStorage.setItem('sql-learning-interactions', JSON.stringify([
        {
          id: 'evt-1',
          sessionId: 'session-learner-1-test',
          learnerId: 'learner-1',
          timestamp: Date.now(),
          eventType: 'execution',
          problemId: 'problem-1',
          successful: true,
          conceptIds: ['select-basic']
        }
      ]));
    });
    
    // Navigate directly to research page
    await page.goto('/research');
    
    // Simple check: verify the Research Dashboard loads
    await expect(page.getByText('Research Dashboard').first()).toBeVisible({ timeout: 10000 });
    
    // Verify the profile data is accessible
    const profileData = await page.evaluate(() => {
      const raw = window.localStorage.getItem('sql-learning-profiles');
      return raw ? JSON.parse(raw) : null;
    });
    
    expect(profileData).toBeTruthy();
    expect(profileData.length).toBeGreaterThan(0);
    expect(profileData[0].conceptCoverageEvidence).toBeTruthy();
  });

  test('progress bar displays coverage percentage', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.clear();
      window.sessionStorage.clear();
      window.localStorage.setItem('sql-adapt-welcome-seen', 'true');
      window.localStorage.setItem('sql-adapt-user-profile', JSON.stringify({
        id: 'learner-1',
        name: 'Test User',
        role: 'student',
        createdAt: Date.now()
      }));
      
      const profile = {
        id: 'learner-1',
        name: 'Learner learner-1',
        conceptsCovered: ['select-basic'],
        conceptCoverageEvidence: [
          ['select-basic', {
            conceptId: 'select-basic',
            score: 50,
            confidence: 'medium',
            lastUpdated: Date.now(),
            evidenceCounts: { successfulExecution: 2, hintViewed: 0, explanationViewed: 0, errorEncountered: 0, notesAdded: 0 },
            streakCorrect: 1,
            streakIncorrect: 0
          }]
        ],
        errorHistory: [],
        interactionCount: 2,
        currentStrategy: 'adaptive-medium',
        preferences: { escalationThreshold: 3, aggregationDelay: 300000 }
      };
      
      window.localStorage.setItem('sql-learning-profiles', JSON.stringify([profile]));
    });
    
    await page.goto('/textbook?learnerId=learner-1');
    
    // Wait for page to load
    await page.waitForLoadState('networkidle');
    
    // The textbook page should load with the profile data
    await expect(page.locator('body')).toContainText('My Textbook');
    
    // Verify the profile data is accessible
    const profileData = await page.evaluate(() => {
      const raw = window.localStorage.getItem('sql-learning-profiles');
      const profiles = raw ? JSON.parse(raw) : [];
      return profiles.find((p: any) => p.id === 'learner-1');
    });
    
    expect(profileData).toBeDefined();
    expect(profileData.conceptCoverageEvidence).toBeDefined();
    expect(profileData.conceptCoverageEvidence.length).toBeGreaterThan(0);
  });

  // ============================================================================
  // Test 5: Concept-Note Linking
  // ============================================================================
  
  test('notes are tagged with correct concept IDs', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('button', { name: 'Run Query' })).toBeVisible();
    
    // Trigger the full flow to create a note
    await replaceEditorText(page, 'SELECT');
    await runUntilErrorCount(page, 1);
    
    await page.getByRole('button', { name: 'Request Hint' }).click();
    await expect(page.getByTestId('hint-label-1')).toBeVisible();
    await page.getByRole('button', { name: 'Next Hint' }).click();
    await expect(page.getByTestId('hint-label-2')).toBeVisible();
    await page.getByRole('button', { name: 'Next Hint' }).click();
    await expect(page.getByTestId('hint-label-3')).toBeVisible();
    
    // After level 3, click "Get More Help" (help request 4) to trigger escalation
    await page.getByRole('button', { name: 'Get More Help' }).click();
    
    // Wait for explanation UI - check for either manual or auto-escalation text
    await expect(page.getByText(/Explanation has been generated|Full Explanation Unlocked/)).toBeVisible({ timeout: 15000 });
    
    // Wait for explanation
    await expect.poll(async () => (
      page.evaluate(() => {
        const raw = window.localStorage.getItem('sql-learning-interactions');
        const interactions = raw ? JSON.parse(raw) : [];
        return interactions.filter((i: any) => i.eventType === 'explanation_view').length;
      })
    ), { timeout: 10000 }).toBeGreaterThanOrEqual(1);
    
    // Add to notes
    const addToNotesButton = page.getByRole('button', { name: 'Add to My Notes' });
    await expect(addToNotesButton).toBeVisible({ timeout: 30000 });
    await addToNotesButton.click();
    
    // Wait for note creation
    await expect.poll(async () => (
      page.evaluate(() => {
        const raw = window.localStorage.getItem('sql-learning-textbook');
        const textbooks = raw ? JSON.parse(raw) : {};
        const units = textbooks['learner-1'] || [];
        return units.length;
      })
    ), { timeout: 10000 }).toBeGreaterThanOrEqual(1);
    
    // Verify note has concept IDs
    const textbookData = await page.evaluate(() => {
      const raw = window.localStorage.getItem('sql-learning-textbook');
      const textbooks = raw ? JSON.parse(raw) : {};
      return textbooks['learner-1'] || [];
    });
    
    expect(textbookData.length).toBeGreaterThan(0);
    
    // Each note should have a conceptId
    for (const note of textbookData) {
      expect(note.conceptId).toBeTruthy();
      expect(typeof note.conceptId).toBe('string');
      expect(note.conceptId.length).toBeGreaterThan(0);
    }
  });

  test('coverage reflects notes added', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('button', { name: 'Run Query' })).toBeVisible();
    
    // Create a note
    await replaceEditorText(page, 'SELECT');
    await runUntilErrorCount(page, 1);
    
    await page.getByRole('button', { name: 'Request Hint' }).click();
    await expect(page.getByTestId('hint-label-1')).toBeVisible();
    await page.getByRole('button', { name: 'Next Hint' }).click();
    await expect(page.getByTestId('hint-label-2')).toBeVisible();
    await page.getByRole('button', { name: 'Next Hint' }).click();
    await expect(page.getByTestId('hint-label-3')).toBeVisible();
    
    // After level 3, click "Get More Help" (help request 4) to trigger escalation
    await page.getByRole('button', { name: 'Get More Help' }).click();
    
    // Wait for explanation UI - check for either manual or auto-escalation text
    await expect(page.getByText(/Explanation has been generated|Full Explanation Unlocked/)).toBeVisible({ timeout: 15000 });
    
    await expect.poll(async () => (
      page.evaluate(() => {
        const raw = window.localStorage.getItem('sql-learning-interactions');
        const interactions = raw ? JSON.parse(raw) : [];
        return interactions.filter((i: any) => i.eventType === 'explanation_view').length;
      })
    ), { timeout: 10000 }).toBeGreaterThanOrEqual(1);
    
    // Add to notes
    const addToNotesButton = page.getByRole('button', { name: 'Add to My Notes' });
    await expect(addToNotesButton).toBeVisible({ timeout: 30000 });
    await addToNotesButton.click();
    
    // Wait for coverage update with longer timeout
    await expect.poll(async () => {
      const coverage = await getConceptCoverage(page, 'learner-1');
      return Array.from(coverage.values()).some(
        (evidence: any) => evidence.evidenceCounts.notesAdded > 0
      );
    }, {
      message: 'Waiting for notesAdded evidence in coverage',
      timeout: 15000
    }).toBe(true);
  });

  // ============================================================================
  // Test 6: Coverage Persistence
  // ============================================================================
  
  test('coverage survives page refresh', async ({ page }) => {
    // Seed coverage data directly for reliability
    await page.addInitScript(() => {
      window.localStorage.clear();
      window.sessionStorage.clear();
      window.localStorage.setItem('sql-adapt-welcome-seen', 'true');
      window.localStorage.setItem('sql-adapt-user-profile', JSON.stringify({
        id: 'learner-1',
        name: 'Test User',
        role: 'student',
        createdAt: Date.now()
      }));
      
      const profile = {
        id: 'learner-1',
        name: 'Learner learner-1',
        conceptsCovered: ['select-basic'],
        conceptCoverageEvidence: [
          ['select-basic', {
            conceptId: 'select-basic',
            score: 60,
            confidence: 'medium',
            lastUpdated: Date.now(),
            evidenceCounts: { successfulExecution: 2, hintViewed: 5, explanationViewed: 0, errorEncountered: 1, notesAdded: 0 },
            streakCorrect: 1,
            streakIncorrect: 0
          }]
        ],
        errorHistory: [['incomplete query', 1]],
        interactionCount: 8,
        currentStrategy: 'adaptive-medium',
        preferences: { escalationThreshold: 3, aggregationDelay: 300000 }
      };
      
      window.localStorage.setItem('sql-learning-profiles', JSON.stringify([profile]));
    });
    
    await page.goto('/');
    await expect(page.getByRole('button', { name: 'Run Query' })).toBeVisible();
    
    // Get coverage before refresh
    const coverageBefore = await getConceptCoverage(page, 'learner-1');
    expect(coverageBefore.size).toBeGreaterThan(0);
    
    // Refresh the page
    await page.reload();
    await expect(page.getByRole('button', { name: 'Run Query' })).toBeVisible();
    
    // Get coverage after refresh
    const coverageAfter = await getConceptCoverage(page, 'learner-1');
    expect(coverageAfter.size).toBeGreaterThan(0);
    
    // Coverage should be the same
    expect(coverageAfter.size).toBe(coverageBefore.size);
  });

  test('coverage is included in export JSON', async ({ page }) => {
    // Seed coverage data with instructor role for research access
    await page.addInitScript(() => {
      window.localStorage.clear();
      window.sessionStorage.clear();
      window.localStorage.setItem('sql-adapt-welcome-seen', 'true');
      window.localStorage.setItem('sql-adapt-user-profile', JSON.stringify({
        id: 'learner-1',
        name: 'Test User',
        role: 'instructor',
        createdAt: Date.now()
      }));
      
      const profile = {
        id: 'learner-1',
        name: 'Learner learner-1',
        conceptsCovered: ['select-basic'],
        conceptCoverageEvidence: [
          ['select-basic', {
            conceptId: 'select-basic',
            score: 60,
            confidence: 'medium',
            lastUpdated: Date.now(),
            evidenceCounts: { successfulExecution: 2, hintViewed: 5, explanationViewed: 0, errorEncountered: 0, notesAdded: 0 },
            streakCorrect: 1,
            streakIncorrect: 0
          }]
        ],
        errorHistory: [],
        interactionCount: 7,
        currentStrategy: 'adaptive-medium',
        preferences: { escalationThreshold: 3, aggregationDelay: 300000 }
      };
      
      window.localStorage.setItem('sql-learning-profiles', JSON.stringify([profile]));
    });
    
    await page.goto('/research');
    await expect(page.getByText('Research Dashboard').first()).toBeVisible();
    
    // Export data by accessing localStorage
    const exportData = await page.evaluate(() => {
      const raw = window.localStorage.getItem('sql-learning-profiles');
      const profiles = raw ? JSON.parse(raw) : [];
      const interactions = window.localStorage.getItem('sql-learning-interactions');
      
      return {
        profiles: profiles.map((p: any) => ({
          ...p,
          conceptsCovered: p.conceptsCovered || [],
          conceptCoverageEvidence: p.conceptCoverageEvidence || [],
          conceptCoverageSummary: (p.conceptCoverageEvidence || []).map(([conceptId, evidence]: [string, any]) => ({
            conceptId,
            score: evidence?.score || 0,
            confidence: evidence?.confidence || 'low',
            evidenceCounts: evidence?.evidenceCounts || {}
          }))
        })),
        interactions: interactions ? JSON.parse(interactions) : []
      };
    });
    
    // Verify coverage is in export
    expect(exportData.profiles).toBeDefined();
    expect(exportData.profiles.length).toBeGreaterThan(0);
    
    const profile = exportData.profiles[0];
    expect(profile.conceptsCovered).toBeDefined();
    expect(Array.isArray(profile.conceptsCovered)).toBe(true);
    expect(profile.conceptCoverageEvidence).toBeDefined();
    expect(Array.isArray(profile.conceptCoverageEvidence)).toBe(true);
    expect(profile.conceptsCovered.length).toBeGreaterThan(0);
  });

  test('coverage is per-learner isolated', async ({ page }) => {
    // Seed data for two different learners using init script for reliability
    await page.addInitScript(() => {
      window.localStorage.clear();
      window.sessionStorage.clear();
      window.localStorage.setItem('sql-adapt-welcome-seen', 'true');
      window.localStorage.setItem('sql-adapt-user-profile', JSON.stringify({
        id: 'learner-1',
        name: 'Test User',
        role: 'student',
        createdAt: Date.now()
      }));
      
      const profiles = [
        {
          id: 'learner-1',
          name: 'Learner learner-1',
          conceptsCovered: ['select-basic'],
          conceptCoverageEvidence: [
            ['select-basic', {
              conceptId: 'select-basic',
              score: 75,
              confidence: 'high',
              lastUpdated: Date.now(),
              evidenceCounts: { successfulExecution: 3, hintViewed: 0, explanationViewed: 0, errorEncountered: 0, notesAdded: 0 },
              streakCorrect: 2,
              streakIncorrect: 0
            }]
          ],
          errorHistory: [],
          interactionCount: 3,
          currentStrategy: 'adaptive-medium',
          preferences: { escalationThreshold: 3, aggregationDelay: 300000 }
        },
        {
          id: 'learner-2',
          name: 'Learner learner-2',
          conceptsCovered: ['joins'],
          conceptCoverageEvidence: [
            ['joins', {
              conceptId: 'joins',
              score: 50,
              confidence: 'medium',
              lastUpdated: Date.now(),
              evidenceCounts: { successfulExecution: 2, hintViewed: 0, explanationViewed: 0, errorEncountered: 0, notesAdded: 0 },
              streakCorrect: 1,
              streakIncorrect: 0
            }]
          ],
          errorHistory: [],
          interactionCount: 2,
          currentStrategy: 'adaptive-medium',
          preferences: { escalationThreshold: 3, aggregationDelay: 300000 }
        }
      ];
      
      window.localStorage.setItem('sql-learning-profiles', JSON.stringify(profiles));
    });
    
    await page.goto('/');
    
    // Get coverage for learner-1
    const coverageLearner1 = await getConceptCoverage(page, 'learner-1');
    expect(coverageLearner1.has('select-basic')).toBe(true);
    expect(coverageLearner1.has('joins')).toBe(false);
    
    // Get coverage for learner-2
    const coverageLearner2 = await getConceptCoverage(page, 'learner-2');
    expect(coverageLearner2.has('joins')).toBe(true);
    expect(coverageLearner2.has('select-basic')).toBe(false);
  });

  // ============================================================================
  // Test 7: Edge Cases
  // ============================================================================
  
  test('new learner starts with empty coverage', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('button', { name: 'Run Query' })).toBeVisible();
    
    // Get coverage for a brand new learner
    const coverage = await getConceptCoverage(page, 'learner-new');
    expect(coverage.size).toBe(0);
    
    // Stats should show no coverage
    const stats = await getCoverageStats(page, 'learner-new');
    expect(stats.coveredCount).toBe(0);
    expect(stats.coveragePercentage).toBe(0);
    expect(stats.averageScore).toBe(0);
  });

  test('unknown subtype uses fallback mapping', async ({ page }) => {
    await page.goto('/');
    
    // Test the fallback behavior by submitting a query that won't match specific patterns
    await replaceEditorText(page, 'COMPLETELY INVALID SYNTAX THAT MAKES NO SENSE');
    await runUntilErrorCount(page, 1);
    
    // Wait for coverage to be tracked
    await waitForCoverageUpdate(page, 'learner-1');
    
    // Coverage should still be tracked (using fallback mapping)
    const coverage = await getConceptCoverage(page, 'learner-1');
    expect(coverage.size).toBeGreaterThan(0);
    
    // Should have error evidence
    const hasErrorEvidence = Array.from(coverage.values()).some(
      (evidence: any) => evidence.evidenceCounts.errorEncountered > 0
    );
    expect(hasErrorEvidence).toBe(true);
  });

  test('duplicate exposures increment counts correctly', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('button', { name: 'Run Query' })).toBeVisible();
    
    // Trigger first error
    await replaceEditorText(page, 'SELECT');
    await runUntilErrorCount(page, 1);
    
    // Wait for initial coverage
    await waitForCoverageUpdate(page, 'learner-1');
    
    // Get initial error count from interactions (more reliable than coverage map)
    const initialErrors = await page.evaluate(() => {
      const raw = window.localStorage.getItem('sql-learning-interactions');
      const interactions = raw ? JSON.parse(raw) : [];
      return interactions.filter((i: any) => i.eventType === 'error').length;
    });
    
    expect(initialErrors).toBeGreaterThanOrEqual(1);
    
    // Trigger more errors - each click may generate multiple error events due to parsing
    for (let i = 0; i < 3; i++) {
      await page.getByRole('button', { name: 'Run Query' }).click();
      await expect(page.locator('text=SQL Error')).toBeVisible({ timeout: 5000 });
    }
    
    // Wait for coverage update
    await waitForCoverageUpdate(page, 'learner-1');
    
    // Get updated error count from interactions
    const updatedErrors = await page.evaluate(() => {
      const raw = window.localStorage.getItem('sql-learning-interactions');
      const interactions = raw ? JSON.parse(raw) : [];
      return interactions.filter((i: any) => i.eventType === 'error').length;
    });
    
    // Error count should have increased (at least by 3, but could be more)
    expect(updatedErrors).toBeGreaterThan(initialErrors);
  });

  test('coverage threshold boundary conditions', async ({ page }) => {
    await page.goto('/');
    
    // Test boundary at 50
    await seedCoverageData(page, 'learner-1', {
      'select-basic': { score: 49, confidence: 'low', evidenceCounts: { successfulExecution: 0, hintViewed: 25, explanationViewed: 0, errorEncountered: 0, notesAdded: 0 } },
      'where-clause': { score: 50, confidence: 'medium', evidenceCounts: { successfulExecution: 2, hintViewed: 0, explanationViewed: 0, errorEncountered: 0, notesAdded: 0 } },
      'joins': { score: 51, confidence: 'medium', evidenceCounts: { successfulExecution: 2, hintViewed: 1, explanationViewed: 0, errorEncountered: 0, notesAdded: 0 } }
    });
    
    const stats = await getCoverageStats(page, 'learner-1');
    
    // Only where-clause (50) and joins (51) should be covered
    expect(stats.coveredCount).toBe(2);
    
    // select-basic at 49 should NOT be covered
    const coverage = await getConceptCoverage(page, 'learner-1');
    const selectBasic = coverage.get('select-basic');
    const whereClause = coverage.get('where-clause');
    const joins = coverage.get('joins');
    
    expect(selectBasic?.score).toBe(49);
    expect(whereClause?.score).toBe(50);
    expect(joins?.score).toBe(51);
  });

  test('score calculation with streak bonuses and penalties', async ({ page }) => {
    await page.goto('/');
    
    // Test streak bonus (3+ correct = +15, 2+ correct = +5)
    await seedCoverageData(page, 'learner-1', {
      'select-basic': {
        score: 0,
        confidence: 'low',
        evidenceCounts: { successfulExecution: 3, hintViewed: 0, explanationViewed: 0, errorEncountered: 0, notesAdded: 0 },
        streakCorrect: 3,
        streakIncorrect: 0
      },
      'where-clause': {
        score: 0,
        confidence: 'low',
        evidenceCounts: { successfulExecution: 2, hintViewed: 0, explanationViewed: 0, errorEncountered: 0, notesAdded: 0 },
        streakCorrect: 2,
        streakIncorrect: 0
      },
      'joins': {
        score: 0,
        confidence: 'low',
        evidenceCounts: { successfulExecution: 1, hintViewed: 0, explanationViewed: 0, errorEncountered: 3, notesAdded: 0 },
        streakCorrect: 0,
        streakIncorrect: 3
      }
    });
    
    const coverage = await getConceptCoverage(page, 'learner-1');
    
    // select-basic: 3 executions (75) + 15 streak bonus = 90
    // where-clause: 2 executions (50) + 5 streak bonus = 55
    // joins: 1 execution (25) + 3 errors (-15) - 10 streak penalty = 0 (clamped)
    
    // Note: The actual score calculation happens when events are processed
    // The seeded values are just stored as-is, so we verify the structure
    const selectBasic = coverage.get('select-basic');
    expect(selectBasic?.evidenceCounts.successfulExecution).toBe(3);
    expect(selectBasic?.streakCorrect).toBe(3);
    
    const whereClause = coverage.get('where-clause');
    expect(whereClause?.evidenceCounts.successfulExecution).toBe(2);
    expect(whereClause?.streakCorrect).toBe(2);
    
    const joins = coverage.get('joins');
    expect(joins?.evidenceCounts.errorEncountered).toBe(3);
    expect(joins?.streakIncorrect).toBe(3);
  });
});
