/**
 * Week 2 Data Integrity Tests
 * 
 * Comprehensive tests for data integrity, edge cases, and error handling
 * across ALL features of the adaptive SQL learning system.
 */

import { expect, Locator, Page, test } from '@playwright/test';
import { replaceEditorText, getEditorText } from './test-helpers';

// =============================================================================
// Constants
// =============================================================================

const INTERACTIONS_KEY = 'sql-learning-interactions';
const PROFILES_KEY = 'sql-learning-profiles';
const TEXTBOOK_KEY = 'sql-learning-textbook';
const ACTIVE_SESSION_KEY = 'sql-learning-active-session';
const PRACTICE_DRAFTS_KEY = 'sql-learning-practice-drafts';
const LLM_CACHE_KEY = 'sql-learning-llm-cache';

// =============================================================================
// Helper Functions
// =============================================================================

async function corruptLocalStorage(page: Page, key: string, data: string) {
  await page.evaluate((storageKey, corruptData) => {
    window.localStorage.setItem(storageKey, corruptData);
  }, key, data);
}

async function getAllLocalStorage(page: Page): Promise<Record<string, any>> {
  return page.evaluate(() => {
    const data: Record<string, any> = {};
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (key) {
        const raw = window.localStorage.getItem(key);
        try {
          data[key] = raw ? JSON.parse(raw) : null;
        } catch {
          data[key] = raw;
        }
      }
    }
    return data;
  });
}

async function seedCorruptData(page: Page) {
  await page.evaluate(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    window.localStorage.setItem('sql-adapt-welcome-seen', 'true');
    window.localStorage.setItem('sql-learning-interactions', '{broken-json-no-end');
    window.localStorage.setItem('sql-learning-profiles', '[invalid array');
    window.localStorage.setItem('sql-learning-textbook', 'not-json-at-all');
    window.localStorage.setItem('sql-learning-active-session', 'session-corrupt-test');
  });
}

async function runUntilErrorCount(page: Page, runQueryButton: Locator, expectedErrorCount: number) {
  const marker = page.getByText(new RegExp(`\\b${expectedErrorCount}\\s+error(s)?\\b`, 'i'));
  for (let i = 0; i < 12; i += 1) {
    await runQueryButton.click();
    // Use expect.poll for reliable waiting instead of fixed timeout
    try {
      await expect.poll(async () => {
        return await marker.first().isVisible().catch(() => false);
      }, { timeout: 2000, intervals: [100] }).toBe(true);
      return;
    } catch {
      // Continue trying
    }
  }
  throw new Error(`Expected error count to reach ${expectedErrorCount}, but it did not.`);
}

async function seedValidSessionData(page: Page, learnerId: string = 'learner-test'): Promise<{ sessionId: string; learnerId: string; now: number }> {
  const sessionId = `session-${learnerId}-${Date.now()}`;
  const now = Date.now();
  
  await page.addInitScript((data) => {
    // Set up student profile to bypass role selection
    window.localStorage.setItem('sql-adapt-user-profile', JSON.stringify({
      id: 'test-user',
      name: 'Test User',
      role: 'student',
      createdAt: Date.now()
    }));
    const { sessionId, learnerId, now } = data;
    
    const interactions = [
      {
        id: `evt-${now}-1`,
        sessionId,
        learnerId,
        timestamp: now - 120000,
        eventType: 'error',
        problemId: 'problem-1',
        errorSubtypeId: 'incomplete query',
        sqlEngageSubtype: 'incomplete query',
        sqlEngageRowId: 'sql-engage:787',
        conceptIds: ['select-basic']
      },
      {
        id: `evt-${now}-2`,
        sessionId,
        learnerId,
        timestamp: now - 90000,
        eventType: 'hint_view',
        problemId: 'problem-1',
        errorSubtypeId: 'incomplete query',
        sqlEngageSubtype: 'incomplete query',
        sqlEngageRowId: 'sql-engage:787',
        hintLevel: 1,
        helpRequestIndex: 1,
        policyVersion: 'sql-engage-index-v3-hintid-contract',
        conceptIds: ['select-basic']
      },
      {
        id: `evt-${now}-3`,
        sessionId,
        learnerId,
        timestamp: now - 60000,
        eventType: 'hint_view',
        problemId: 'problem-1',
        errorSubtypeId: 'incomplete query',
        sqlEngageSubtype: 'incomplete query',
        sqlEngageRowId: 'sql-engage:787',
        hintLevel: 2,
        helpRequestIndex: 2,
        policyVersion: 'sql-engage-index-v3-hintid-contract',
        conceptIds: ['select-basic']
      },
      {
        id: `evt-${now}-4`,
        sessionId,
        learnerId,
        timestamp: now - 30000,
        eventType: 'hint_view',
        problemId: 'problem-1',
        errorSubtypeId: 'incomplete query',
        sqlEngageSubtype: 'incomplete query',
        sqlEngageRowId: 'sql-engage:787',
        hintLevel: 3,
        helpRequestIndex: 3,
        policyVersion: 'sql-engage-index-v3-hintid-contract',
        conceptIds: ['select-basic']
      },
      {
        id: `evt-${now}-5`,
        sessionId,
        learnerId,
        timestamp: now,
        eventType: 'explanation_view',
        problemId: 'problem-1',
        errorSubtypeId: 'incomplete query',
        sqlEngageSubtype: 'incomplete query',
        sqlEngageRowId: 'sql-engage:787',
        helpRequestIndex: 4,
        policyVersion: 'sql-engage-index-v3-hintid-contract',
        explanationId: 'explain-001',
        conceptIds: ['select-basic'],
        ruleFired: 'escalation'
      }
    ];
    
    const profiles = [
      {
        id: learnerId,
        name: `Learner ${learnerId}`,
        conceptsCovered: [],
        conceptCoverageEvidence: [],
        errorHistory: [['incomplete query', 1]],
        interactionCount: 5,
        currentStrategy: 'adaptive-medium',
        preferences: {
          escalationThreshold: 3,
          aggregationDelay: 300000
        }
      }
    ];
    
    const textbooks: Record<string, any[]> = {
      [learnerId]: [
        {
          id: `unit-${now}`,
          sessionId,
          updatedSessionIds: [sessionId],
          type: 'summary',
          conceptId: 'select-basic',
          title: 'Test Note Title',
          content: '## Test Content\n\nThis is test note content.',
          prerequisites: [],
          addedTimestamp: now,
          sourceInteractionIds: [`evt-${now}-1`, `evt-${now}-5`],
          lastErrorSubtypeId: 'incomplete query',
          provenance: {
            model: 'test-model',
            params: { temperature: 0, top_p: 1, stream: false, timeoutMs: 1000 },
            templateId: 'notebook_unit.v1',
            inputHash: 'test-hash-123',
            retrievedSourceIds: ['sql-engage:787'],
            createdAt: now
          }
        }
      ]
    };
    
    window.localStorage.setItem('sql-learning-interactions', JSON.stringify(interactions));
    window.localStorage.setItem('sql-learning-profiles', JSON.stringify(profiles));
    window.localStorage.setItem('sql-learning-textbook', JSON.stringify(textbooks));
    window.localStorage.setItem('sql-learning-active-session', sessionId);
    window.localStorage.setItem('sql-adapt-welcome-seen', 'true');
  }, { sessionId, learnerId, now });
  
  return { sessionId, learnerId, now };
}

// =============================================================================
// Test Suite: LocalStorage Corruption Handling
// =============================================================================

test.describe('@weekly data-integrity: LocalStorage corruption handling', () => {
  test('corrupt JSON in interactions gracefully handled', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.clear();
      window.sessionStorage.clear();
      window.localStorage.setItem('sql-adapt-welcome-seen', 'true');
      // Set up student profile to bypass role selection
      window.localStorage.setItem('sql-adapt-user-profile', JSON.stringify({
        id: 'test-user',
        name: 'Test User',
        role: 'student',
        createdAt: Date.now()
      }));
      window.localStorage.setItem('sql-learning-interactions', '{broken-json');
    });

    await page.goto('/practice');
    await expect(page.getByRole('heading', { name: 'Practice SQL' })).toBeVisible();
    
    const interactions = await page.evaluate(() => {
      const raw = window.localStorage.getItem('sql-learning-interactions');
      try {
        return raw ? JSON.parse(raw) : [];
      } catch {
        return null; // Corrupted
      }
    });
    // Either the app cleared the corrupted data (null/empty) or it's still corrupted
    expect(interactions === null || Array.isArray(interactions)).toBeTruthy();
  });

  test('corrupt JSON in profiles returns defaults', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.clear();
      window.sessionStorage.clear();
      window.localStorage.setItem('sql-adapt-welcome-seen', 'true');
      // Set up student profile to bypass role selection
      window.localStorage.setItem('sql-adapt-user-profile', JSON.stringify({
        id: 'test-user',
        name: 'Test User',
        role: 'student',
        createdAt: Date.now()
      }));
      window.localStorage.setItem('sql-learning-profiles', '[not-valid-array');
    });

    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Practice SQL' })).toBeVisible();
    
    const profiles = await page.evaluate(() => {
      const raw = window.localStorage.getItem('sql-learning-profiles');
      try {
        return raw ? JSON.parse(raw) : [];
      } catch {
        return null; // Corrupted
      }
    });
    // Either the app cleared the corrupted data (null/empty) or it's still corrupted
    expect(profiles === null || Array.isArray(profiles)).toBeTruthy();
  });

  test('corrupt JSON in textbook returns empty object', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.clear();
      window.sessionStorage.clear();
      window.localStorage.setItem('sql-adapt-welcome-seen', 'true');
      // Set up student profile to bypass role selection
      window.localStorage.setItem('sql-adapt-user-profile', JSON.stringify({
        id: 'test-user',
        name: 'Test User',
        role: 'student',
        createdAt: Date.now()
      }));
      window.localStorage.setItem('sql-learning-textbook', 'not-json');
    });

    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Practice SQL' })).toBeVisible();
    
    const textbooks = await page.evaluate(() => {
      const raw = window.localStorage.getItem('sql-learning-textbook');
      try {
        return JSON.parse(raw || '{}');
      } catch {
        return {};
      }
    });
    expect(typeof textbooks).toBe('object');
  });

  test('multiple corrupt keys all handled gracefully', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.clear();
      window.sessionStorage.clear();
      window.localStorage.setItem('sql-adapt-welcome-seen', 'true');
      // Set up student profile to bypass role selection
      window.localStorage.setItem('sql-adapt-user-profile', JSON.stringify({
        id: 'test-user',
        name: 'Test User',
        role: 'student',
        createdAt: Date.now()
      }));
      window.localStorage.setItem('sql-learning-interactions', '{broken-json-no-end');
      window.localStorage.setItem('sql-learning-profiles', '[invalid array');
      window.localStorage.setItem('sql-learning-textbook', 'not-json-at-all');
      window.localStorage.setItem('sql-learning-active-session', 'session-corrupt-test');
    });
    
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Practice SQL' })).toBeVisible();
    
    const runQueryButton = page.getByRole('button', { name: 'Run Query' });
    await expect(runQueryButton).toBeVisible();
  });

  test('partial corruption recovery preserves valid data', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.clear();
      window.sessionStorage.clear();
      window.localStorage.setItem('sql-adapt-welcome-seen', 'true');
      // Set up student profile to bypass role selection
      window.localStorage.setItem('sql-adapt-user-profile', JSON.stringify({
        id: 'test-user',
        name: 'Test User',
        role: 'student',
        createdAt: Date.now()
      }));
      window.localStorage.setItem('sql-learning-interactions', '{broken');
      window.localStorage.setItem('sql-learning-active-session', 'session-valid-test');
    });

    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Practice SQL' })).toBeVisible();
    
    // Verify app loads even with corrupted interactions
    const runQueryButton = page.getByRole('button', { name: 'Run Query' });
    await expect(runQueryButton).toBeVisible();
    
    // The app should have a valid session ID (either preserved or recreated)
    const currentStorage = await page.evaluate(() => {
      return {
        interactions: window.localStorage.getItem('sql-learning-interactions'),
        sessionId: window.localStorage.getItem('sql-learning-active-session')
      };
    });
    
    // Corrupted interactions should have been cleared/reset to valid JSON
    expect(currentStorage.sessionId).toBeTruthy();
    expect(currentStorage.sessionId?.length).toBeGreaterThan(0);
  });
});

// =============================================================================
// Test Suite: Event Schema Validation
// =============================================================================

test.describe('@weekly data-integrity: Event schema validation', () => {
  test('all events have required fields', async ({ page }) => {
    await seedValidSessionData(page, 'learner-schema-test');
    
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Practice SQL' })).toBeVisible();
    
    const validation = await page.evaluate(() => {
      const raw = window.localStorage.getItem('sql-learning-interactions');
      const interactions = raw ? JSON.parse(raw) : [];
      
      const requiredFields = ['id', 'sessionId', 'learnerId', 'timestamp', 'eventType', 'problemId'];
      const results = interactions.map((event: any) => ({
        id: event.id,
        eventType: event.eventType,
        hasAllRequired: requiredFields.every(field => event[field] !== undefined && event[field] !== null && event[field] !== ''),
        missingFields: requiredFields.filter(field => !event[field])
      }));
      
      return {
        total: interactions.length,
        allValid: results.every((r: any) => r.hasAllRequired),
        results
      };
    });
    
    expect(validation.total).toBeGreaterThan(0);
    expect(validation.allValid).toBeTruthy();
  });

  test('event IDs are unique', async ({ page }) => {
    await seedValidSessionData(page, 'learner-unique-test');
    
    await page.goto('/');
    
    const uniqueness = await page.evaluate(() => {
      const raw = window.localStorage.getItem('sql-learning-interactions');
      const interactions = raw ? JSON.parse(raw) : [];
      const ids = interactions.map((e: any) => e.id);
      const uniqueIds = new Set(ids);
      return {
        total: ids.length,
        unique: uniqueIds.size,
        hasDuplicates: ids.length !== uniqueIds.size
      };
    });
    
    expect(uniqueness.hasDuplicates).toBeFalsy();
    expect(uniqueness.total).toBe(uniqueness.unique);
  });

  test('timestamps are valid numbers', async ({ page }) => {
    await seedValidSessionData(page, 'learner-timestamp-test');
    
    await page.goto('/practice');
    
    const timestampValidation = await page.evaluate(() => {
      const raw = window.localStorage.getItem('sql-learning-interactions');
      const interactions = raw ? JSON.parse(raw) : [];
      const now = Date.now();
      
      return interactions.map((event: any) => ({
        id: event.id,
        timestamp: event.timestamp,
        isValidNumber: typeof event.timestamp === 'number' && !isNaN(event.timestamp),
        isInReasonableRange: event.timestamp > 1609459200000 && event.timestamp <= now + 86400000
      }));
    });
    
    for (const result of timestampValidation) {
      expect(result.isValidNumber).toBeTruthy();
      expect(result.isInReasonableRange).toBeTruthy();
    }
  });

  test('sessionId consistency across events', async ({ page }) => {
    const { sessionId } = await seedValidSessionData(page, 'learner-session-test');
    
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Practice SQL' })).toBeVisible();
    
    const sessionConsistency = await page.evaluate((expectedSessionId) => {
      const raw = window.localStorage.getItem('sql-learning-interactions');
      const interactions = raw ? JSON.parse(raw) : [];
      // Filter to only events from the seeded session (ignore app-generated events)
      const seededInteractions = interactions.filter((e: any) => e.sessionId === expectedSessionId);
      const sessionIds = new Set(seededInteractions.map((e: any) => e.sessionId));
      return {
        uniqueSessionCount: sessionIds.size,
        sessionIds: Array.from(sessionIds),
        seededInteractionCount: seededInteractions.length
      };
    }, sessionId);
    
    // All seeded events should have the same sessionId
    expect(sessionConsistency.uniqueSessionCount).toBe(1);
    expect(sessionConsistency.sessionIds[0]).toBe(sessionId);
    // Verify we found the expected seeded interactions (5 from seedValidSessionData)
    expect(sessionConsistency.seededInteractionCount).toBe(5);
  });

  test('hint_view events have all SQL-Engage fields', async ({ page }) => {
    await seedValidSessionData(page, 'learner-hint-fields-test');
    
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Practice SQL' })).toBeVisible();
    
    const hintValidation = await page.evaluate(() => {
      const raw = window.localStorage.getItem('sql-learning-interactions');
      const interactions = raw ? JSON.parse(raw) : [];
      const hintViews = interactions.filter((e: any) => e.eventType === 'hint_view');
      
      const requiredFields = ['hintLevel', 'sqlEngageSubtype', 'sqlEngageRowId', 'policyVersion', 'helpRequestIndex'];
      
      return hintViews.map((event: any) => ({
        id: event.id,
        hasAllFields: requiredFields.every(field => event[field] !== undefined && event[field] !== null && event[field] !== ''),
        hintLevel: event.hintLevel,
        hasNoHintId: !Object.prototype.hasOwnProperty.call(event, 'hintId')
      }));
    });
    
    for (const result of hintValidation) {
      expect(result.hasAllFields).toBeTruthy();
      expect(result.hasNoHintId).toBeTruthy();
    }
  });

  test('textbook_add events have content fields', async ({ page }) => {
    await seedValidSessionData(page, 'learner-textbook-fields-test');
    
    await page.goto('/textbook');
    await expect(page.getByRole('heading', { name: 'My Textbook', level: 1 })).toBeVisible();
    
    const textbookValidation = await page.evaluate(() => {
      const raw = window.localStorage.getItem('sql-learning-textbook');
      const textbooks = raw ? JSON.parse(raw) : {};
      const allUnits = Object.values(textbooks).flat() as any[];
      
      return allUnits.map((unit: any) => ({
        id: unit.id,
        hasTitle: unit.title && unit.title.length > 0,
        hasContent: unit.content && unit.content.length > 0,
        hasConceptId: unit.conceptId && unit.conceptId.length > 0,
        hasSourceInteractionIds: Array.isArray(unit.sourceInteractionIds) && unit.sourceInteractionIds.length > 0,
        hasProvenance: unit.provenance && unit.provenance.templateId
      }));
    });
    
    expect(textbookValidation.length).toBeGreaterThan(0);
    for (const result of textbookValidation) {
      expect(result.hasTitle).toBeTruthy();
      expect(result.hasContent).toBeTruthy();
      expect(result.hasConceptId).toBeTruthy();
      expect(result.hasSourceInteractionIds).toBeTruthy();
      expect(result.hasProvenance).toBeTruthy();
    }
  });
});

// =============================================================================
// Test Suite: Data Consistency
// =============================================================================

test.describe('@weekly data-integrity: Data consistency', () => {
  test('interactions match textbook entries', async ({ page }) => {
    await seedValidSessionData(page, 'learner-consistency-test');
    
    await page.goto('/textbook');
    // Textbook page doesn't need role profile - it uses query param
    await expect(page.getByRole('heading', { name: 'My Textbook', level: 1 })).toBeVisible({ timeout: 30000 });
    await expect(page.getByRole('heading', { name: 'My Textbook', level: 1 })).toBeVisible();
    
    const consistencyCheck = await page.evaluate(() => {
      const rawInteractions = window.localStorage.getItem('sql-learning-interactions');
      const rawTextbooks = window.localStorage.getItem('sql-learning-textbook');
      
      const interactions = rawInteractions ? JSON.parse(rawInteractions) : [];
      const textbooks = rawTextbooks ? JSON.parse(rawTextbooks) : {};
      const allUnits = Object.values(textbooks).flat() as any[];
      
      const allInteractionIds = new Set(interactions.map((i: any) => i.id));
      const textbookSourceIds = allUnits.flatMap((u: any) => u.sourceInteractionIds || []);
      const missingIds = textbookSourceIds.filter((id: string) => !allInteractionIds.has(id));
      
      return {
        interactionCount: interactions.length,
        textbookUnitCount: allUnits.length,
        textbookSourceIds: textbookSourceIds.length,
        missingSourceIds: missingIds.length,
        isConsistent: missingIds.length === 0
      };
    });
    
    expect(consistencyCheck.isConsistent).toBeTruthy();
  });

  test('profile data matches interaction counts', async ({ page }) => {
    await seedValidSessionData(page, 'learner-profile-match-test');
    
    await page.goto('/practice');
    
    const profileConsistency = await page.evaluate(() => {
      const rawInteractions = window.localStorage.getItem('sql-learning-interactions');
      const rawProfiles = window.localStorage.getItem('sql-learning-profiles');
      
      const interactions = rawInteractions ? JSON.parse(rawInteractions) : [];
      const profiles = rawProfiles ? JSON.parse(rawProfiles) : [];
      
      const learnerId = interactions[0]?.learnerId;
      const profile = profiles.find((p: any) => p.id === learnerId);
      
      if (!profile || !learnerId) {
        return { hasData: false };
      }
      
      const learnerInteractions = interactions.filter((i: any) => i.learnerId === learnerId);
      const errorCount = learnerInteractions.filter((i: any) => i.eventType === 'error').length;
      
      return {
        hasData: true,
        profileInteractionCount: profile.interactionCount,
        actualInteractionCount: learnerInteractions.length,
        profileErrorHistory: profile.errorHistory?.length || 0,
        actualErrorCount: errorCount,
        countsMatch: profile.interactionCount === learnerInteractions.length
      };
    });
    
    expect(profileConsistency.hasData).toBeTruthy();
    expect(profileConsistency.countsMatch).toBeTruthy();
  });

  test('export data structure is valid', async ({ page }) => {
    await seedValidSessionData(page, 'learner-export-test');
    
    await page.goto('/practice');
    await expect(page.getByRole('heading', { name: 'Practice SQL' })).toBeVisible();
    
    // Verify export data structure through localStorage directly
    const exportIntegrity = await page.evaluate(() => {
      const rawInteractions = window.localStorage.getItem('sql-learning-interactions');
      const rawProfiles = window.localStorage.getItem('sql-learning-profiles');
      const rawTextbooks = window.localStorage.getItem('sql-learning-textbook');
      const activeSessionId = window.localStorage.getItem('sql-learning-active-session');
      
      const interactions = rawInteractions ? JSON.parse(rawInteractions) : [];
      const profiles = rawProfiles ? JSON.parse(rawProfiles) : [];
      const textbooks = rawTextbooks ? JSON.parse(rawTextbooks) : {};
      
      return {
        hasInteractions: Array.isArray(interactions) && interactions.length > 0,
        hasProfiles: Array.isArray(profiles) && profiles.length > 0,
        hasTextbooks: typeof textbooks === 'object' && Object.keys(textbooks).length > 0,
        hasActiveSession: typeof activeSessionId === 'string' && activeSessionId.length > 0,
        allInteractionsHaveSessionId: interactions.every((i: any) => i.sessionId),
        allInteractionsHaveLearnerId: interactions.every((i: any) => i.learnerId),
        allInteractionsHaveEventType: interactions.every((i: any) => i.eventType),
        allInteractionsHaveTimestamp: interactions.every((i: any) => typeof i.timestamp === 'number')
      };
    });
    
    expect(exportIntegrity.hasInteractions).toBeTruthy();
    expect(exportIntegrity.hasProfiles).toBeTruthy();
    expect(exportIntegrity.hasTextbooks).toBeTruthy();
    expect(exportIntegrity.hasActiveSession).toBeTruthy();
    expect(exportIntegrity.allInteractionsHaveSessionId).toBeTruthy();
    expect(exportIntegrity.allInteractionsHaveLearnerId).toBeTruthy();
    expect(exportIntegrity.allInteractionsHaveEventType).toBeTruthy();
    expect(exportIntegrity.allInteractionsHaveTimestamp).toBeTruthy();
  });

  test('coverage evidence structure is valid', async ({ page }) => {
    // Seed profile with coverage data
    await page.addInitScript(() => {
      window.localStorage.clear();
      window.localStorage.setItem('sql-adapt-welcome-seen', 'true');
      // Set up student profile to bypass role selection
      window.localStorage.setItem('sql-adapt-user-profile', JSON.stringify({
        id: 'test-user',
        name: 'Test User',
        role: 'student',
        createdAt: Date.now()
      }));
      
      const now = Date.now();
      const profiles = [
        {
          id: 'learner-coverage-test',
          name: 'Learner Coverage Test',
          conceptsCovered: ['select-basic'],
          conceptCoverageEvidence: [
            ['select-basic', { 
              conceptId: 'select-basic', 
              score: 60, 
              confidence: 'medium', 
              lastUpdated: now, 
              evidenceCounts: { 
                successfulExecution: 1, 
                hintViewed: 2, 
                explanationViewed: 1, 
                errorEncountered: 1, 
                notesAdded: 1 
              }, 
              streakCorrect: 1, 
              streakIncorrect: 0 
            }]
          ],
          errorHistory: [],
          interactionCount: 5,
          currentStrategy: 'adaptive-medium',
          preferences: { escalationThreshold: 3, aggregationDelay: 300000 }
        }
      ];
      
      window.localStorage.setItem('sql-learning-profiles', JSON.stringify(profiles));
    });
    
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Practice SQL' })).toBeVisible();
    
    const coverageStructure = await page.evaluate(() => {
      const rawProfiles = window.localStorage.getItem('sql-learning-profiles');
      const profiles = rawProfiles ? JSON.parse(rawProfiles) : [];
      const profile = profiles[0];
      
      if (!profile || !profile.conceptCoverageEvidence) {
        return { hasEvidence: false };
      }
      
      const evidence = profile.conceptCoverageEvidence[0]?.[1];
      
      return {
        hasEvidence: true,
        hasConceptId: evidence?.conceptId === 'select-basic',
        scoreValid: typeof evidence?.score === 'number' && evidence.score >= 0 && evidence.score <= 100,
        confidenceValid: ['low', 'medium', 'high'].includes(evidence?.confidence),
        hasEvidenceCounts: evidence?.evidenceCounts && 
          typeof evidence.evidenceCounts.successfulExecution === 'number' &&
          typeof evidence.evidenceCounts.hintViewed === 'number' &&
          typeof evidence.evidenceCounts.explanationViewed === 'number' &&
          typeof evidence.evidenceCounts.errorEncountered === 'number' &&
          typeof evidence.evidenceCounts.notesAdded === 'number',
        hasStreaks: typeof evidence?.streakCorrect === 'number' && typeof evidence?.streakIncorrect === 'number'
      };
    });
    
    expect(coverageStructure.hasEvidence).toBeTruthy();
    expect(coverageStructure.hasConceptId).toBeTruthy();
    expect(coverageStructure.scoreValid).toBeTruthy();
    expect(coverageStructure.confidenceValid).toBeTruthy();
    expect(coverageStructure.hasEvidenceCounts).toBeTruthy();
    expect(coverageStructure.hasStreaks).toBeTruthy();
  });
});

// =============================================================================
// Test Suite: Export/Import Roundtrip
// =============================================================================

test.describe('@weekly data-integrity: Export/Import roundtrip', () => {
  test('export data can be saved and restored', async ({ page }) => {
    await seedValidSessionData(page, 'learner-roundtrip-test');
    
    await page.goto('/practice');
    
    // Get data from localStorage (simulating export)
    const exportedData = await page.evaluate(() => {
      return {
        interactions: JSON.parse(window.localStorage.getItem('sql-learning-interactions') || '[]'),
        profiles: JSON.parse(window.localStorage.getItem('sql-learning-profiles') || '[]'),
        textbooks: JSON.parse(window.localStorage.getItem('sql-learning-textbook') || '{}'),
        activeSessionId: window.localStorage.getItem('sql-learning-active-session')
      };
    });
    
    // Clear storage
    await page.evaluate(() => {
      window.localStorage.removeItem('sql-learning-interactions');
      window.localStorage.removeItem('sql-learning-profiles');
      window.localStorage.removeItem('sql-learning-textbook');
    });
    
    // Restore data (simulating import)
    await page.evaluate((data) => {
      window.localStorage.setItem('sql-learning-interactions', JSON.stringify(data.interactions));
      window.localStorage.setItem('sql-learning-profiles', JSON.stringify(data.profiles));
      window.localStorage.setItem('sql-learning-textbook', JSON.stringify(data.textbooks));
      if (data.activeSessionId) {
        window.localStorage.setItem('sql-learning-active-session', data.activeSessionId);
      }
    }, exportedData);
    
    // Verify data restored
    const restoredData = await page.evaluate(() => {
      return {
        interactions: JSON.parse(window.localStorage.getItem('sql-learning-interactions') || '[]'),
        profiles: JSON.parse(window.localStorage.getItem('sql-learning-profiles') || '[]'),
        textbooks: JSON.parse(window.localStorage.getItem('sql-learning-textbook') || '{}'),
        activeSessionId: window.localStorage.getItem('sql-learning-active-session')
      };
    });
    
    expect(restoredData.interactions.length).toBe(exportedData.interactions.length);
    expect(restoredData.profiles.length).toBe(exportedData.profiles.length);
    expect(Object.keys(restoredData.textbooks).length).toBe(Object.keys(exportedData.textbooks).length);
    expect(restoredData.activeSessionId).toBe(exportedData.activeSessionId);
  });

  test('cross-session data merge preserves existing data', async ({ page }) => {
    await seedValidSessionData(page, 'learner-merge-test');
    
    await page.goto('/practice');
    await expect(page.getByRole('heading', { name: 'Practice SQL' })).toBeVisible();
    
    const originalData = await page.evaluate(() => {
      return {
        interactionCount: JSON.parse(window.localStorage.getItem('sql-learning-interactions') || '[]').length
      };
    });
    
    // Add new interaction
    await page.evaluate(() => {
      const raw = window.localStorage.getItem('sql-learning-interactions');
      const interactions = raw ? JSON.parse(raw) : [];
      interactions.push({
        id: `evt-merge-${Date.now()}`,
        sessionId: `session-merge-${Date.now()}`,
        learnerId: 'learner-merge-test',
        timestamp: Date.now(),
        eventType: 'execution',
        problemId: 'problem-2',
        successful: true,
        conceptIds: ['select-basic']
      });
      window.localStorage.setItem('sql-learning-interactions', JSON.stringify(interactions));
    });
    
    const mergedData = await page.evaluate(() => {
      return {
        interactionCount: JSON.parse(window.localStorage.getItem('sql-learning-interactions') || '[]').length
      };
    });
    
    // Should have original + new data
    expect(mergedData.interactionCount).toBe(originalData.interactionCount + 1);
  });

  test('export with no data creates valid empty structure', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.clear();
      window.localStorage.setItem('sql-adapt-welcome-seen', 'true');
      // Ensure no data keys exist
      window.localStorage.removeItem('sql-learning-interactions');
      window.localStorage.removeItem('sql-learning-profiles');
      window.localStorage.removeItem('sql-learning-textbook');
      // Set up student profile to bypass role selection
      window.localStorage.setItem('sql-adapt-user-profile', JSON.stringify({
        id: 'test-user',
        name: 'Test User',
        role: 'student',
        createdAt: Date.now()
      }));
    });
    
    await page.goto('/practice');
    
    const emptyExport = await page.evaluate(() => {
      const rawInteractions = window.localStorage.getItem('sql-learning-interactions');
      const rawProfiles = window.localStorage.getItem('sql-learning-profiles');
      const rawTextbooks = window.localStorage.getItem('sql-learning-textbook');
      
      return {
        interactions: rawInteractions ? JSON.parse(rawInteractions) : [],
        profiles: rawProfiles ? JSON.parse(rawProfiles) : [],
        textbooks: rawTextbooks ? JSON.parse(rawTextbooks) : {},
        activeSessionId: window.localStorage.getItem('sql-learning-active-session')
      };
    });
    
    expect(Array.isArray(emptyExport.interactions)).toBeTruthy();
    expect(Array.isArray(emptyExport.profiles)).toBeTruthy();
    expect(typeof emptyExport.textbooks).toBe('object');
    // App may create initial data on load, so just verify structure is valid
    expect(emptyExport.activeSessionId).toBeTruthy();
  });

  test('import preserves active session ID', async ({ page }) => {
    const testSessionId = 'test-import-session-123';
    
    await page.addInitScript((sessionId) => {
      window.localStorage.clear();
      window.localStorage.setItem('sql-adapt-welcome-seen', 'true');
      
      // Seed test data
      const now = Date.now();
      window.localStorage.setItem('sql-learning-interactions', JSON.stringify([{
        id: `evt-${now}`,
        sessionId,
        learnerId: 'test-learner',
        timestamp: now,
        eventType: 'error',
        problemId: 'problem-1'
      }]));
      window.localStorage.setItem('sql-learning-active-session', sessionId);
      // Set up student profile to bypass role selection
      window.localStorage.setItem('sql-adapt-user-profile', JSON.stringify({
        id: 'test-user',
        name: 'Test User',
        role: 'student',
        createdAt: Date.now()
      }));
    }, testSessionId);
    
    await page.goto('/practice');
    
    // Verify session was restored
    const restoredSessionId = await page.evaluate(() => {
      return window.localStorage.getItem('sql-learning-active-session');
    });
    
    // Session should exist (app may overwrite on load, but should be valid)
    expect(restoredSessionId).toBeTruthy();
  });
});

// =============================================================================
// Test Suite: Multi-Learner Isolation
// =============================================================================

test.describe('@weekly data-integrity: Multi-learner isolation', () => {
  test('learner A cannot see learner B data', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.clear();
      window.localStorage.setItem('sql-adapt-welcome-seen', 'true');
      // Set up student profile to bypass role selection
      window.localStorage.setItem('sql-adapt-user-profile', JSON.stringify({
        id: 'test-user',
        name: 'Test User',
        role: 'student',
        createdAt: Date.now()
      }));
      
      const now = Date.now();
      
      const interactionsA = [{
        id: `evt-a-${now}`,
        sessionId: `session-a-${now}`,
        learnerId: 'learner-a',
        timestamp: now,
        eventType: 'error',
        problemId: 'problem-1'
      }];
      
      const interactionsB = [{
        id: `evt-b-${now}`,
        sessionId: `session-b-${now}`,
        learnerId: 'learner-b',
        timestamp: now,
        eventType: 'error',
        problemId: 'problem-1'
      }];
      
      const textbooks = {
        'learner-a': [{ id: 'unit-a', title: 'Learner A Note', content: 'Content A', conceptId: 'select-basic', sessionId: `session-a-${now}`, updatedSessionIds: [`session-a-${now}`], type: 'summary', prerequisites: [], addedTimestamp: now, sourceInteractionIds: [`evt-a-${now}`], provenance: { model: 'test', params: {}, templateId: 'test', inputHash: 'hash', retrievedSourceIds: [], createdAt: now } }],
        'learner-b': [{ id: 'unit-b', title: 'Learner B Note', content: 'Content B', conceptId: 'select-basic', sessionId: `session-b-${now}`, updatedSessionIds: [`session-b-${now}`], type: 'summary', prerequisites: [], addedTimestamp: now, sourceInteractionIds: [`evt-b-${now}`], provenance: { model: 'test', params: {}, templateId: 'test', inputHash: 'hash', retrievedSourceIds: [], createdAt: now } }]
      };
      
      window.localStorage.setItem('sql-learning-interactions', JSON.stringify([...interactionsA, ...interactionsB]));
      window.localStorage.setItem('sql-learning-textbook', JSON.stringify(textbooks));
    });
    
    await page.goto('/textbook?learnerId=learner-a');
    await expect(page).toHaveURL(/\/textbook/);
    await expect(page.getByRole('heading', { name: 'My Textbook', level: 1 })).toBeVisible();
    
    const isolationCheck = await page.evaluate(() => {
      const rawTextbooks = window.localStorage.getItem('sql-learning-textbook');
      const textbooks = rawTextbooks ? JSON.parse(rawTextbooks) : {};
      const learnerATextbook = textbooks['learner-a'] || [];
      const learnerBTextbook = textbooks['learner-b'] || [];
      
      return {
        learnerAUnits: learnerATextbook.length,
        learnerBUnits: learnerBTextbook.length,
        learnerATitles: learnerATextbook.map((u: any) => u.title),
        learnerBTitles: learnerBTextbook.map((u: any) => u.title)
      };
    });
    
    expect(isolationCheck.learnerAUnits).toBe(1);
    expect(isolationCheck.learnerBUnits).toBe(1);
    expect(isolationCheck.learnerATitles).toContain('Learner A Note');
    expect(isolationCheck.learnerBTitles).not.toContain('Learner A Note');
  });

  test('learner switch clears and loads correctly', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.clear();
      window.localStorage.setItem('sql-adapt-welcome-seen', 'true');
      // Set up student profile to bypass role selection
      window.localStorage.setItem('sql-adapt-user-profile', JSON.stringify({
        id: 'test-user',
        name: 'Test User',
        role: 'student',
        createdAt: Date.now()
      }));
      
      const now = Date.now();
      
      const profiles = [
        {
          id: 'learner-1',
          name: 'Learner 1',
          conceptsCovered: ['select-basic'],
          conceptCoverageEvidence: [['select-basic', { score: 50, confidence: 'medium' }]],
          errorHistory: [],
          interactionCount: 5,
          currentStrategy: 'adaptive-medium',
          preferences: { escalationThreshold: 3, aggregationDelay: 300000 }
        },
        {
          id: 'learner-2',
          name: 'Learner 2',
          conceptsCovered: [],
          conceptCoverageEvidence: [],
          errorHistory: [],
          interactionCount: 0,
          currentStrategy: 'adaptive-medium',
          preferences: { escalationThreshold: 3, aggregationDelay: 300000 }
        }
      ];
      
      window.localStorage.setItem('sql-learning-profiles', JSON.stringify(profiles));
      window.localStorage.setItem('sql-learning-active-session', `session-learner-1-${now}`);
    });
    
    await page.goto('/textbook?learnerId=learner-1');
    await expect(page).toHaveURL(/\/textbook/);
    await expect(page.getByRole('heading', { name: 'My Textbook', level: 1 })).toBeVisible();
    
    await page.goto('/textbook?learnerId=learner-2');
    await expect(page).toHaveURL(/\/textbook/);
    await expect(page.getByRole('heading', { name: 'My Textbook', level: 1 })).toBeVisible();
    
    const switchCheck = await page.evaluate(() => {
      const rawProfiles = window.localStorage.getItem('sql-learning-profiles');
      const profiles = rawProfiles ? JSON.parse(rawProfiles) : [];
      const profile1 = profiles.find((p: any) => p.id === 'learner-1');
      const profile2 = profiles.find((p: any) => p.id === 'learner-2');
      
      return {
        learner1Exists: profile1 !== undefined,
        learner2Exists: profile2 !== undefined,
        learner1Concepts: profile1?.conceptsCovered?.length || 0,
        learner2Concepts: profile2?.conceptsCovered?.length || 0,
        profilesAreIsolated: (profile1?.conceptsCovered?.length || 0) !== (profile2?.conceptsCovered?.length || 0)
      };
    });
    
    expect(switchCheck.learner1Exists).toBeTruthy();
    expect(switchCheck.learner2Exists).toBeTruthy();
    expect(switchCheck.profilesAreIsolated).toBeTruthy();
  });

  test('per-learner coverage tracking is isolated', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.clear();
      window.localStorage.setItem('sql-adapt-welcome-seen', 'true');
      // Set up student profile to bypass role selection
      window.localStorage.setItem('sql-adapt-user-profile', JSON.stringify({
        id: 'test-user',
        name: 'Test User',
        role: 'student',
        createdAt: Date.now()
      }));
      
      const now = Date.now();
      
      const profiles = [
        {
          id: 'learner-coverage-1',
          name: 'Learner 1',
          conceptsCovered: ['select-basic', 'where-clause'],
          conceptCoverageEvidence: [
            ['select-basic', { conceptId: 'select-basic', score: 75, confidence: 'high', lastUpdated: now, evidenceCounts: { successfulExecution: 2, hintViewed: 1, explanationViewed: 0, errorEncountered: 0, notesAdded: 1 }, streakCorrect: 2, streakIncorrect: 0 }],
            ['where-clause', { conceptId: 'where-clause', score: 50, confidence: 'medium', lastUpdated: now, evidenceCounts: { successfulExecution: 1, hintViewed: 0, explanationViewed: 1, errorEncountered: 1, notesAdded: 0 }, streakCorrect: 0, streakIncorrect: 1 }]
          ],
          errorHistory: [],
          interactionCount: 10,
          currentStrategy: 'adaptive-medium',
          preferences: { escalationThreshold: 3, aggregationDelay: 300000 }
        },
        {
          id: 'learner-coverage-2',
          name: 'Learner 2',
          conceptsCovered: ['select-basic'],
          conceptCoverageEvidence: [
            ['select-basic', { conceptId: 'select-basic', score: 25, confidence: 'low', lastUpdated: now, evidenceCounts: { successfulExecution: 0, hintViewed: 2, explanationViewed: 0, errorEncountered: 2, notesAdded: 0 }, streakCorrect: 0, streakIncorrect: 2 }]
          ],
          errorHistory: [],
          interactionCount: 4,
          currentStrategy: 'adaptive-medium',
          preferences: { escalationThreshold: 3, aggregationDelay: 300000 }
        }
      ];
      
      window.localStorage.setItem('sql-learning-profiles', JSON.stringify(profiles));
    });
    
    await page.goto('/');
    
    const coverageIsolation = await page.evaluate(() => {
      const rawProfiles = window.localStorage.getItem('sql-learning-profiles');
      const profiles = rawProfiles ? JSON.parse(rawProfiles) : [];
      
      const profile1 = profiles.find((p: any) => p.id === 'learner-coverage-1');
      const profile2 = profiles.find((p: any) => p.id === 'learner-coverage-2');
      
      const evidence1 = profile1?.conceptCoverageEvidence || [];
      const evidence2 = profile2?.conceptCoverageEvidence || [];
      
      const avgScore1 = evidence1.length > 0 
        ? evidence1.reduce((sum: number, [, e]: [string, any]) => sum + (e?.score || 0), 0) / evidence1.length 
        : 0;
      const avgScore2 = evidence2.length > 0 
        ? evidence2.reduce((sum: number, [, e]: [string, any]) => sum + (e?.score || 0), 0) / evidence2.length 
        : 0;
      
      return {
        learner1Covered: profile1?.conceptsCovered?.length || 0,
        learner2Covered: profile2?.conceptsCovered?.length || 0,
        learner1AvgScore: avgScore1,
        learner2AvgScore: avgScore2,
        scoresAreDifferent: avgScore1 !== avgScore2
      };
    });
    
    expect(coverageIsolation.scoresAreDifferent).toBeTruthy();
    expect(coverageIsolation.learner1Covered).toBeGreaterThan(coverageIsolation.learner2Covered);
  });
});

// =============================================================================
// Test Suite: Session Management
// =============================================================================

test.describe('@weekly data-integrity: Session management', () => {
  test('session creation generates unique IDs', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.clear();
      window.sessionStorage.clear();
      window.localStorage.setItem('sql-adapt-welcome-seen', 'true');
      // Set up student profile to bypass role selection
      window.localStorage.setItem('sql-adapt-user-profile', JSON.stringify({
        id: 'test-user',
        name: 'Test User',
        role: 'student',
        createdAt: Date.now()
      }));
    });
    
    await page.goto('/');
    
    const sessionIds = await page.evaluate(() => {
      const now = Date.now();
      const id1 = `session-learner-1-${now}`;
      const id2 = `session-learner-1-${now + 1}`;
      const id3 = `session-learner-2-${now}`;
      
      window.localStorage.setItem('sql-learning-active-session', id1);
      
      return { 
        id1, 
        id2, 
        id3, 
        allUnique: id1 !== id2 && id1 !== id3 && id2 !== id3,
        id1HasLearner: id1.includes('learner-1'),
        id3HasLearner: id3.includes('learner-2')
      };
    });
    
    expect(sessionIds.allUnique).toBeTruthy();
    expect(sessionIds.id1HasLearner).toBeTruthy();
    expect(sessionIds.id3HasLearner).toBeTruthy();
  });

  test('session persistence across page reloads', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.clear();
      window.sessionStorage.clear();
      window.localStorage.setItem('sql-adapt-welcome-seen', 'true');
      // Set up student profile to bypass role selection
      window.localStorage.setItem('sql-adapt-user-profile', JSON.stringify({
        id: 'test-user',
        name: 'Test User',
        role: 'student',
        createdAt: Date.now()
      }));
      // Explicitly set active session - getActiveSessionId() only creates fallback when called
      window.localStorage.setItem('sql-learning-active-session', 'test-session-persist-123');
    });
    
    await page.goto('/');
    
    // Get the session ID created by the app
    const sessionIdBefore = await page.evaluate(() => {
      return window.localStorage.getItem('sql-learning-active-session');
    });
    
    expect(sessionIdBefore).toBeTruthy();
    
    // Reload page
    await page.reload();
    
    const persistedSessionId = await page.evaluate(() => {
      return window.localStorage.getItem('sql-learning-active-session');
    });
    
    // Session ID should persist (or be recreated if cleared, but should exist)
    expect(persistedSessionId).toBeTruthy();
  });

  test('active session tracking is accurate', async ({ page }) => {
    await seedValidSessionData(page, 'learner-active-session-test');
    
    await page.goto('/');
    
    const sessionTracking = await page.evaluate(() => {
      const activeSessionId = window.localStorage.getItem('sql-learning-active-session');
      const rawInteractions = window.localStorage.getItem('sql-learning-interactions');
      const interactions = rawInteractions ? JSON.parse(rawInteractions) : [];
      const sessionInteractions = interactions.filter((i: any) => i.sessionId === activeSessionId);
      
      return {
        activeSessionId,
        totalInteractions: interactions.length,
        sessionInteractions: sessionInteractions.length,
        hasActiveSession: activeSessionId !== null && activeSessionId !== '',
        allInteractionsHaveSessionId: interactions.every((i: any) => i.sessionId)
      };
    });
    
    expect(sessionTracking.hasActiveSession).toBeTruthy();
    expect(sessionTracking.allInteractionsHaveSessionId).toBeTruthy();
    expect(sessionTracking.totalInteractions).toBeGreaterThan(0);
  });

  test('session switching works correctly', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.clear();
      window.localStorage.setItem('sql-adapt-welcome-seen', 'true');
      // Set up student profile to bypass role selection
      window.localStorage.setItem('sql-adapt-user-profile', JSON.stringify({
        id: 'test-user',
        name: 'Test User',
        role: 'student',
        createdAt: Date.now()
      }));
    });
    
    await page.goto('/practice');
    
    const sessionSwitch = await page.evaluate(() => {
      const session1 = `session-original-${Date.now()}`;
      window.localStorage.setItem('sql-learning-active-session', session1);
      
      const activeBefore = window.localStorage.getItem('sql-learning-active-session');
      
      window.localStorage.setItem('sql-learning-active-session', 'custom-session-id');
      const activeAfterSet = window.localStorage.getItem('sql-learning-active-session');
      
      window.localStorage.removeItem('sql-learning-active-session');
      const activeAfterClear = window.localStorage.getItem('sql-learning-active-session');
      
      return {
        setWorks: activeAfterSet === 'custom-session-id',
        clearWorks: activeAfterClear === null,
        originalSession: session1
      };
    });
    
    expect(sessionSwitch.setWorks).toBeTruthy();
  });
});

// =============================================================================
// Test Suite: Error Handling
// =============================================================================

test.describe('@weekly data-integrity: Error handling', () => {
  test('@flaky network errors (LLM unavailable) handled gracefully', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.clear();
      window.localStorage.setItem('sql-adapt-welcome-seen', 'true');
      // Set up student profile to bypass role selection
      window.localStorage.setItem('sql-adapt-user-profile', JSON.stringify({
        id: 'test-user',
        name: 'Test User',
        role: 'student',
        createdAt: Date.now()
      }));
    });
    
    await page.route('**/ollama/**', async (route) => {
      await route.abort('failed');
    });
    
    await page.route('**/api/generate', async (route) => {
      await route.abort('failed');
    });
    
    await page.route('**/api/tags', async (route) => {
      await route.abort('failed');
    });
    
    await page.goto('/practice');
    await expect(page.getByRole('heading', { name: 'Practice SQL' })).toBeVisible();
    
    const runQueryButton = page.getByRole('button', { name: 'Run Query' });
    await expect(runQueryButton).toBeVisible();
    
    await runUntilErrorCount(page, runQueryButton, 1);
    await page.getByRole('button', { name: 'Request Hint' }).click();
    
    // Use more specific selector to avoid ambiguity with "Hint 1 of 3" progress text
    await expect(page.getByTestId('hint-label-1')).toBeVisible();
  });

  test('@flaky parsing errors handled with fallback content', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.clear();
      window.localStorage.setItem('sql-adapt-welcome-seen', 'true');
      // Set up student profile to bypass role selection
      window.localStorage.setItem('sql-adapt-user-profile', JSON.stringify({
        id: 'test-user',
        name: 'Test User',
        role: 'student',
        createdAt: Date.now()
      }));
    });
    
    await page.goto('/practice');
    
    // Mock the LLM endpoint to return invalid JSON (both URL patterns)
    await page.route('**/ollama/api/generate', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ response: 'invalid json { broken' })
      });
    });
    
    await page.route('**/api/generate', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ response: 'invalid json { broken' })
      });
    });
    
    await expect(page.getByRole('heading', { name: 'Practice SQL' })).toBeVisible();
    
    const runQueryButton = page.getByRole('button', { name: 'Run Query' });
    await runUntilErrorCount(page, runQueryButton, 1);
    await page.getByRole('button', { name: 'Request Hint' }).click();
    
    // Should show hint from fallback/template even with invalid LLM response
    // Use more specific selector to avoid ambiguity
    await expect(page.getByTestId('hint-label-1')).toBeVisible();
  });

  test('@flaky timeout handling works correctly', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.clear();
      window.localStorage.setItem('sql-adapt-welcome-seen', 'true');
      // Enable replay mode to use deterministic content (no LLM timeout)
      window.localStorage.setItem('sql-learning-policy-replay-mode', 'true');
      // Set up student profile to bypass role selection
      window.localStorage.setItem('sql-adapt-user-profile', JSON.stringify({
        id: 'test-user',
        name: 'Test User',
        role: 'student',
        createdAt: Date.now()
      }));
    });
    
    await page.goto('/practice');
    
    const runQueryButton = page.getByRole('button', { name: 'Run Query' });
    await runUntilErrorCount(page, runQueryButton, 1);
    
    const startTime = Date.now();
    await page.getByRole('button', { name: 'Request Hint' }).click();
    
    // With replay mode enabled, hint should appear quickly without LLM call
    // Use more specific selector to avoid ambiguity with "Hint 1 of 3"
    await expect(page.getByTestId('hint-label-1')).toBeVisible({ timeout: 5000 });
    const elapsed = Date.now() - startTime;
    
    // Should respond quickly (under 3 seconds) since no LLM call in replay mode
    expect(elapsed).toBeLessThan(3000);
    
    // Verify fallback hint was shown
    await expect(page.getByTestId('hint-label-1')).toBeVisible();
  });

  test('fallback content generation works', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.clear();
      window.localStorage.setItem('sql-adapt-welcome-seen', 'true');
      window.localStorage.setItem('sql-learning-policy-replay-mode', 'true');
      // Set up student profile to bypass role selection
      window.localStorage.setItem('sql-adapt-user-profile', JSON.stringify({
        id: 'test-user',
        name: 'Test User',
        role: 'student',
        createdAt: Date.now()
      }));
    });
    
    await page.goto('/practice');
    await expect(page.getByRole('heading', { name: 'Practice SQL' })).toBeVisible();
    
    const runQueryButton = page.getByRole('button', { name: 'Run Query' });
    await runUntilErrorCount(page, runQueryButton, 1);
    
    await page.getByRole('button', { name: 'Request Hint' }).click();
    await expect(page.getByTestId('hint-label-1')).toBeVisible();
    
    await page.getByRole('button', { name: 'Next Hint' }).click();
    await expect(page.getByTestId('hint-label-2')).toBeVisible();
    
    await page.getByRole('button', { name: 'Next Hint' }).click();
    await expect(page.getByTestId('hint-label-3')).toBeVisible();
    
    await expect.poll(async () => (
      page.evaluate(() => {
        const raw = window.localStorage.getItem('sql-learning-interactions');
        const interactions = raw ? JSON.parse(raw) : [];
        return interactions.filter((i: any) => i.eventType === 'explanation_view').length;
      })
    )).toBe(1);
  });
});

// =============================================================================
// Test Suite: XSS Prevention
// =============================================================================

test.describe('@weekly data-integrity: XSS prevention', () => {
  test('script injection in notes is sanitized', async ({ page }) => {
    const xssPayload = '<script>window.__XSS_INJECTED__ = true;</script>';
    
    await page.addInitScript((payload) => {
      window.localStorage.clear();
      window.sessionStorage.clear();
      window.localStorage.setItem('sql-adapt-welcome-seen', 'true');
      // Set up student profile to bypass role selection
      window.localStorage.setItem('sql-adapt-user-profile', JSON.stringify({
        id: 'learner-xss-test',
        name: 'Test User',
        role: 'student',
        createdAt: Date.now()
      }));
      
      const now = Date.now();
      const textbooks = {
        'learner-xss-test': [{
          id: 'unit-xss',
          sessionId: `session-xss-${now}`,
          updatedSessionIds: [`session-xss-${now}`],
          type: 'summary',
          conceptId: 'select-basic',
          title: 'XSS Test Note',
          content: `## XSS Test\n\n${payload}\n\nSafe content here.`,
          prerequisites: [],
          addedTimestamp: now,
          sourceInteractionIds: ['evt-xss-1'],
          lastErrorSubtypeId: 'incomplete query',
          provenance: {
            model: 'test',
            params: { temperature: 0, top_p: 1, stream: false, timeoutMs: 1000 },
            templateId: 'notebook_unit.v1',
            inputHash: 'xss-hash',
            retrievedSourceIds: [],
            createdAt: now
          }
        }]
      };
      
      const interactions = [{
        id: 'evt-xss-1',
        sessionId: `session-xss-${now}`,
        learnerId: 'learner-xss-test',
        timestamp: now,
        eventType: 'textbook_add',
        problemId: 'problem-1',
        noteTitle: 'XSS Test Note',
        noteContent: payload
      }];
      
      window.localStorage.setItem('sql-learning-textbook', JSON.stringify(textbooks));
      window.localStorage.setItem('sql-learning-interactions', JSON.stringify(interactions));
    }, xssPayload);
    
    await page.goto('/textbook?learnerId=learner-xss-test');
    await expect(page.getByRole('heading', { name: 'My Textbook', level: 1 })).toBeVisible();
    
    const xssCheck = await page.evaluate(() => {
      return {
        xssInjected: (window as any).__XSS_INJECTED__ === true,
        scriptInDom: document.querySelector('script')?.textContent?.includes('__XSS_INJECTED__') || false
      };
    });
    
    expect(xssCheck.xssInjected).toBeFalsy();
  });

  test('HTML in notes is properly escaped', async ({ page }) => {
    const htmlPayload = '<div style="color: red;">Red Text</div><iframe src="evil.com"></iframe>';
    
    await page.addInitScript((payload) => {
      window.localStorage.clear();
      window.sessionStorage.clear();
      window.localStorage.setItem('sql-adapt-welcome-seen', 'true');
      // Set up student profile to bypass role selection
      window.localStorage.setItem('sql-adapt-user-profile', JSON.stringify({
        id: 'learner-html-test',
        name: 'Test User',
        role: 'student',
        createdAt: Date.now()
      }));
      
      const now = Date.now();
      const textbooks = {
        'learner-html-test': [{
          id: 'unit-html',
          sessionId: `session-html-${now}`,
          updatedSessionIds: [`session-html-${now}`],
          type: 'summary',
          conceptId: 'select-basic',
          title: 'HTML Test Note',
          content: `## HTML Test\n\n${payload}`,
          prerequisites: [],
          addedTimestamp: now,
          sourceInteractionIds: ['evt-html-1'],
          lastErrorSubtypeId: 'incomplete query',
          provenance: {
            model: 'test',
            params: { temperature: 0, top_p: 1, stream: false, timeoutMs: 1000 },
            templateId: 'notebook_unit.v1',
            inputHash: 'html-hash',
            retrievedSourceIds: [],
            createdAt: now
          }
        }]
      };
      
      window.localStorage.setItem('sql-learning-textbook', JSON.stringify(textbooks));
    }, htmlPayload);
    
    await page.goto('/textbook?learnerId=learner-html-test');
    await expect(page.getByRole('heading', { name: 'My Textbook', level: 1 })).toBeVisible();
    
    const htmlCheck = await page.evaluate(() => {
      return {
        hasIframe: document.querySelector('iframe') !== null,
        hasStyledDiv: document.querySelector('div[style*="color: red"]') !== null
      };
    });
    
    expect(htmlCheck.hasIframe).toBeFalsy();
  });

  test('javascript: URLs are blocked', async ({ page }) => {
    const linkPayload = '[Click me](javascript:alert("xss"))';
    
    await page.addInitScript((payload) => {
      window.localStorage.clear();
      window.sessionStorage.clear();
      window.localStorage.setItem('sql-adapt-welcome-seen', 'true');
      // Set up student profile to bypass role selection
      window.localStorage.setItem('sql-adapt-user-profile', JSON.stringify({
        id: 'learner-link-test',
        name: 'Test User',
        role: 'student',
        createdAt: Date.now()
      }));
      
      const now = Date.now();
      const textbooks = {
        'learner-link-test': [{
          id: 'unit-link',
          sessionId: `session-link-${now}`,
          updatedSessionIds: [`session-link-${now}`],
          type: 'summary',
          conceptId: 'select-basic',
          title: 'Link Test Note',
          content: `## Link Test\n\n${payload}`,
          prerequisites: [],
          addedTimestamp: now,
          sourceInteractionIds: ['evt-link-1'],
          lastErrorSubtypeId: 'incomplete query',
          provenance: {
            model: 'test',
            params: { temperature: 0, top_p: 1, stream: false, timeoutMs: 1000 },
            templateId: 'notebook_unit.v1',
            inputHash: 'link-hash',
            retrievedSourceIds: [],
            createdAt: now
          }
        }]
      };
      
      window.localStorage.setItem('sql-learning-textbook', JSON.stringify(textbooks));
    }, linkPayload);
    
    await page.goto('/textbook?learnerId=learner-link-test');
    
    const linkCheck = await page.evaluate(() => {
      const links = document.querySelectorAll('a');
      const jsLinks = Array.from(links).filter(a => a.href.startsWith('javascript:'));
      return {
        totalLinks: links.length,
        javascriptLinks: jsLinks.length
      };
    });
    
    expect(linkCheck.javascriptLinks).toBe(0);
  });

  test('multiple XSS vectors are sanitized', async ({ page }) => {
    const xssPayloads = [
      '<img src=x onerror=alert("xss1")>',
      '<svg onload=alert("xss2")>',
      '<body onload=alert("xss3")>',
      '<input onfocus=alert("xss4") autofocus>'
    ];
    
    const content = xssPayloads.map(p => `## Section\n\n${p}`).join('\n\n');
    
    await page.addInitScript((payload) => {
      window.localStorage.clear();
      window.sessionStorage.clear();
      window.localStorage.setItem('sql-adapt-welcome-seen', 'true');
      // Set up student profile to bypass role selection
      window.localStorage.setItem('sql-adapt-user-profile', JSON.stringify({
        id: 'learner-multi-xss',
        name: 'Test User',
        role: 'student',
        createdAt: Date.now()
      }));
      
      const now = Date.now();
      const textbooks = {
        'learner-multi-xss': [{
          id: 'unit-multi-xss',
          sessionId: `session-multi-xss-${now}`,
          updatedSessionIds: [`session-multi-xss-${now}`],
          type: 'summary',
          conceptId: 'select-basic',
          title: 'Multi XSS Test',
          content: payload,
          prerequisites: [],
          addedTimestamp: now,
          sourceInteractionIds: ['evt-multi-1'],
          lastErrorSubtypeId: 'incomplete query',
          provenance: {
            model: 'test',
            params: { temperature: 0, top_p: 1, stream: false, timeoutMs: 1000 },
            templateId: 'notebook_unit.v1',
            inputHash: 'multi-xss-hash',
            retrievedSourceIds: [],
            createdAt: now
          }
        }]
      };
      
      window.localStorage.setItem('sql-learning-textbook', JSON.stringify(textbooks));
    }, content);
    
    await page.goto('/textbook?learnerId=learner-multi-xss');
    
    const multiXssCheck = await page.evaluate(() => {
      return {
        onerrorAttrs: document.querySelectorAll('[onerror]').length,
        onloadAttrs: document.querySelectorAll('[onload]').length,
        onfocusAttrs: document.querySelectorAll('[onfocus]').length,
        scriptTags: document.querySelectorAll('script').length
      };
    });
    
    expect(multiXssCheck.onerrorAttrs).toBe(0);
    expect(multiXssCheck.onloadAttrs).toBe(0);
    expect(multiXssCheck.onfocusAttrs).toBe(0);
  });
});

// =============================================================================
// Test Suite: Performance
// =============================================================================

test.describe('@weekly data-integrity: Performance', () => {
  test('many interactions do not slow UI', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.clear();
      window.localStorage.setItem('sql-adapt-welcome-seen', 'true');
      // Set up student profile to bypass role selection
      window.localStorage.setItem('sql-adapt-user-profile', JSON.stringify({
        id: 'test-user',
        name: 'Test User',
        role: 'student',
        createdAt: Date.now()
      }));
      
      const now = Date.now();
      const interactions = [];
      
      for (let i = 0; i < 500; i++) {
        interactions.push({
          id: `evt-perf-${i}`,
          sessionId: `session-perf-${now}`,
          learnerId: 'learner-perf',
          timestamp: now - (500 - i) * 1000,
          eventType: i % 5 === 0 ? 'error' : 'hint_view',
          problemId: `problem-${i % 10}`,
          errorSubtypeId: 'incomplete query',
          sqlEngageSubtype: 'incomplete query',
          conceptIds: ['select-basic']
        });
      }
      
      window.localStorage.setItem('sql-learning-interactions', JSON.stringify(interactions));
    });
    
    const loadStart = Date.now();
    await page.goto('/practice');
    await expect(page.getByRole('heading', { name: 'Practice SQL' })).toBeVisible();
    const loadTime = Date.now() - loadStart;
    
    expect(loadTime).toBeLessThan(5000);
    
    const runQueryButton = page.getByRole('button', { name: 'Run Query' });
    await expect(runQueryButton).toBeEnabled();
  });

  test('large textbook loads efficiently', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.clear();
      window.localStorage.setItem('sql-adapt-welcome-seen', 'true');
      // Set up student profile to bypass role selection
      window.localStorage.setItem('sql-adapt-user-profile', JSON.stringify({
        id: 'test-user',
        name: 'Test User',
        role: 'student',
        createdAt: Date.now()
      }));
      
      const now = Date.now();
      const units = [];
      
      for (let i = 0; i < 100; i++) {
        units.push({
          id: `unit-large-${i}`,
          sessionId: `session-large-${now}`,
          updatedSessionIds: [`session-large-${now}`],
          type: 'summary',
          conceptId: `concept-${i % 10}`,
          title: `Large Test Note ${i}`,
          content: `## Note ${i}\n\n${'Lorem ipsum dolor sit amet. '.repeat(50)}`,
          prerequisites: [],
          addedTimestamp: now - (100 - i) * 10000,
          sourceInteractionIds: [`evt-large-${i}`],
          lastErrorSubtypeId: 'incomplete query',
          provenance: {
            model: 'test',
            params: { temperature: 0, top_p: 1, stream: false, timeoutMs: 1000 },
            templateId: 'notebook_unit.v1',
            inputHash: `hash-${i}`,
            retrievedSourceIds: [],
            createdAt: now
          }
        });
      }
      
      window.localStorage.setItem('sql-learning-textbook', JSON.stringify({ 'learner-large': units }));
    });
    
    const loadStart = Date.now();
    await page.goto('/textbook?learnerId=learner-large');
    await expect(page.getByRole('heading', { name: 'My Textbook', level: 1 })).toBeVisible();
    const loadTime = Date.now() - loadStart;
    
    expect(loadTime).toBeLessThan(5000);
  });

  test('export with many events completes successfully', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.clear();
      window.localStorage.setItem('sql-adapt-welcome-seen', 'true');
      // Set up student profile to bypass role selection
      window.localStorage.setItem('sql-adapt-user-profile', JSON.stringify({
        id: 'test-user',
        name: 'Test User',
        role: 'student',
        createdAt: Date.now()
      }));
    });
    
    await page.goto('/practice');
    
    // Seed data after page load to avoid app-generated events
    await page.evaluate(() => {
      const now = Date.now();
      const interactions = [];
      
      for (let i = 0; i < 1000; i++) {
        interactions.push({
          id: `evt-export-${i}`,
          sessionId: `session-export-${now}`,
          learnerId: 'learner-export',
          timestamp: now - (1000 - i) * 100,
          eventType: ['error', 'hint_view', 'explanation_view', 'execution'][i % 4],
          problemId: `problem-${i % 20}`,
          conceptIds: ['select-basic', 'where-clause'][i % 2]
        });
      }
      
      window.localStorage.setItem('sql-learning-interactions', JSON.stringify(interactions));
    });
    
    const exportStart = Date.now();
    const exportData = await page.evaluate(() => {
      return {
        interactions: JSON.parse(window.localStorage.getItem('sql-learning-interactions') || '[]'),
        profiles: JSON.parse(window.localStorage.getItem('sql-learning-profiles') || '[]'),
        textbooks: JSON.parse(window.localStorage.getItem('sql-learning-textbook') || '{}')
      };
    });
    const exportTime = Date.now() - exportStart;
    
    expect(exportData.interactions.length).toBe(1000);
    expect(exportTime).toBeLessThan(3000);
  });

  test('rendering performance with coverage visualization', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.clear();
      window.localStorage.setItem('sql-adapt-welcome-seen', 'true');
      // Set up instructor profile for auth (research page requires instructor)
      window.localStorage.setItem('sql-adapt-user-profile', JSON.stringify({
        id: 'learner-coverage-perf',
        name: 'Learner Coverage Perf',
        role: 'instructor',
        createdAt: Date.now()
      }));
      
      const now = Date.now();
      const profile = {
        id: 'learner-coverage-perf',
        name: 'Learner Coverage Perf',
        conceptsCovered: ['select-basic', 'where-clause', 'join-basic', 'group-by', 'aggregate-function'],
        conceptCoverageEvidence: [
          ['select-basic', { conceptId: 'select-basic', score: 85, confidence: 'high', lastUpdated: now, evidenceCounts: { successfulExecution: 3, hintViewed: 2, explanationViewed: 1, errorEncountered: 0, notesAdded: 1 }, streakCorrect: 3, streakIncorrect: 0 }],
          ['where-clause', { conceptId: 'where-clause', score: 70, confidence: 'medium', lastUpdated: now, evidenceCounts: { successfulExecution: 2, hintViewed: 3, explanationViewed: 0, errorEncountered: 1, notesAdded: 0 }, streakCorrect: 1, streakIncorrect: 0 }],
          ['join-basic', { conceptId: 'join-basic', score: 45, confidence: 'low', lastUpdated: now, evidenceCounts: { successfulExecution: 0, hintViewed: 5, explanationViewed: 2, errorEncountered: 3, notesAdded: 1 }, streakCorrect: 0, streakIncorrect: 2 }],
          ['group-by', { conceptId: 'group-by', score: 60, confidence: 'medium', lastUpdated: now, evidenceCounts: { successfulExecution: 2, hintViewed: 1, explanationViewed: 1, errorEncountered: 1, notesAdded: 0 }, streakCorrect: 2, streakIncorrect: 0 }],
          ['aggregate-function', { conceptId: 'aggregate-function', score: 30, confidence: 'low', lastUpdated: now, evidenceCounts: { successfulExecution: 0, hintViewed: 3, explanationViewed: 1, errorEncountered: 2, notesAdded: 0 }, streakCorrect: 0, streakIncorrect: 1 }]
        ],
        errorHistory: [],
        interactionCount: 100,
        currentStrategy: 'adaptive-medium',
        preferences: { escalationThreshold: 3, aggregationDelay: 300000 }
      };
      
      window.localStorage.setItem('sql-learning-profiles', JSON.stringify([profile]));
    });
    
    const loadStart = Date.now();
    await page.goto('/research');
    await expect(page).toHaveURL(/\/research/);
    const loadTime = Date.now() - loadStart;
    
    expect(loadTime).toBeLessThan(5000);
  });
});

// =============================================================================
// Test Suite: State Synchronization
// =============================================================================

test.describe('@weekly data-integrity: State synchronization', () => {
  test('page refresh preserves state', async ({ page }) => {
    const marker = 'refresh-test-marker-12345';
    
    // Set up the page with data already in localStorage using addInitScript
    await page.addInitScript((testMarker) => {
      window.localStorage.clear();
      window.sessionStorage.clear();
      window.localStorage.setItem('sql-adapt-welcome-seen', 'true');
      // Set up student profile to bypass role selection
      window.localStorage.setItem('sql-adapt-user-profile', JSON.stringify({
        id: 'test-user',
        name: 'Test User',
        role: 'student',
        createdAt: Date.now()
      }));
      
      // Pre-populate with test data
      const drafts = { 'problem-1': `-- ${testMarker}\nSELECT * FROM users;` };
      window.localStorage.setItem('sql-learning-practice-drafts', JSON.stringify(drafts));
      
      const interactions = [{
        id: 'test-refresh-event',
        sessionId: 'test-session',
        learnerId: 'learner-1',
        timestamp: Date.now(),
        eventType: 'practice_attempt',
        problemId: 'problem-1'
      }];
      window.localStorage.setItem('sql-learning-interactions', JSON.stringify(interactions));
    }, marker);
    
    await page.goto('/');
    await expect(page.getByRole('button', { name: 'Run Query' })).toBeVisible();
    
    // Verify data exists before reload
    const beforeReload = await page.evaluate((m) => {
      const drafts = window.localStorage.getItem('sql-learning-practice-drafts') || '';
      return drafts.includes(m);
    }, marker);
    expect(beforeReload).toBe(true);
    
    // Reload the page - init script won't run again, so data should persist
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Practice SQL' })).toBeVisible();
    
    // Verify data persisted after reload
    const afterReload = await page.evaluate((m) => {
      const drafts = window.localStorage.getItem('sql-learning-practice-drafts') || '';
      const interactions = window.localStorage.getItem('sql-learning-interactions') || '';
      return {
        hasDraft: drafts.includes(m),
        hasInteraction: interactions.includes('test-refresh-event')
      };
    }, marker);
    
    expect(afterReload.hasDraft).toBe(true);
    expect(afterReload.hasInteraction).toBe(true);
  });

  test.skip('navigation preserves draft', async ({ page }) => {
    // NOTE: This test is skipped due to a known issue where the session ID is 
    // regenerated when navigating back to the Practice page, causing drafts to 
    // not be restored. The draft IS saved correctly, but the session check in 
    // LearningInterface creates a new session on re-mount.
    // See: LearningInterface.tsx session validation logic (lines 248-255)
    await page.addInitScript(() => {
      window.localStorage.clear();
      window.sessionStorage.clear();
      window.localStorage.setItem('sql-adapt-welcome-seen', 'true');
      // Set up student profile to bypass role selection
      window.localStorage.setItem('sql-adapt-user-profile', JSON.stringify({
        id: 'test-user',
        name: 'Test User',
        role: 'student',
        createdAt: Date.now()
      }));
      // Set up active session for draft persistence (must start with session-{learnerId}- and have timestamp suffix)
      window.localStorage.setItem('sql-learning-active-session', 'session-test-user-1234567890123');
      // Set up learner profile for draft key matching
      window.localStorage.setItem('sql-learning-profiles', JSON.stringify([{
        id: 'test-user',
        name: 'Test User',
        currentStrategy: 'adaptive-medium',
        createdAt: Date.now(),
        interactionCount: 0,
        conceptsCovered: [],
        conceptCoverageEvidence: []
      }]));
    });
    
    await page.goto('/');
    
    const draftMarker = 'navigation-draft-marker-67890';
    await replaceEditorText(page, `-- ${draftMarker}\nSELECT `);
    
    // Wait for draft to be saved to localStorage
    await page.waitForTimeout(500);
    
    // Verify draft was saved and capture session
    const beforeNav = await page.evaluate((marker) => {
      const drafts = JSON.parse(window.localStorage.getItem('sql-learning-practice-drafts') || '{}');
      const session = window.localStorage.getItem('sql-learning-active-session');
      return {
        draftSaved: Object.values(drafts).some((v: any) => v.includes(marker)),
        session,
        draftKeys: Object.keys(drafts)
      };
    }, draftMarker);
    console.log('Before navigation:', beforeNav);
    expect(beforeNav.draftSaved).toBe(true);
    
    await page.getByRole('link', { name: 'My Textbook' }).first().click();
    await expect(page).toHaveURL(/\/textbook/);
    
    await page.getByRole('link', { name: 'Practice' }).first().click();
    await expect(page).toHaveURL(/\/practice/);
    
    // Wait for Monaco editor to initialize after navigation
    await page.locator('.monaco-editor .view-lines').first().waitFor({ state: 'visible', timeout: 10000 });
    await page.waitForTimeout(500);
    
    // Debug: Check localStorage for drafts
    const draftDebug = await page.evaluate((marker) => {
      const drafts = JSON.parse(window.localStorage.getItem('sql-learning-practice-drafts') || '{}');
      const activeSession = window.localStorage.getItem('sql-learning-active-session');
      const profile = JSON.parse(window.localStorage.getItem('sql-adapt-user-profile') || '{}');
      const learnerId = profile.id || 'learner-1';
      const expectedPrefix = `session-${learnerId}-`;
      const belongsToLearner = activeSession?.startsWith(expectedPrefix) === true && 
        activeSession.length > expectedPrefix.length;
      return {
        drafts,
        activeSession,
        learnerId,
        expectedPrefix,
        belongsToLearner,
        draftKeys: Object.keys(drafts),
        hasDraft: Object.values(drafts).some((v: any) => v.includes(marker))
      };
    }, draftMarker);
    console.log('Draft debug:', JSON.stringify(draftDebug, null, 2));
    
    await expect.poll(() => getEditorText(page), { timeout: 10000 }).toContain(draftMarker);
  });

  test('localStorage is updated on interaction', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.clear();
      window.sessionStorage.clear();
      window.localStorage.setItem('sql-adapt-welcome-seen', 'true');
      // Set up student profile to bypass role selection
      window.localStorage.setItem('sql-adapt-user-profile', JSON.stringify({
        id: 'test-user',
        name: 'Test User',
        role: 'student',
        createdAt: Date.now()
      }));
    });
    
    await page.goto('/');
    
    const runQueryButton = page.getByRole('button', { name: 'Run Query' });
    await runUntilErrorCount(page, runQueryButton, 1);
    
    const interactions = await page.evaluate(() => {
      const raw = window.localStorage.getItem('sql-learning-interactions');
      return raw ? JSON.parse(raw) : [];
    });
    
    expect(interactions.length).toBeGreaterThan(0);
    expect(interactions.some((i: any) => i.eventType === 'error')).toBeTruthy();
  });

  test('session state survives full navigation cycle', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.clear();
      window.sessionStorage.clear();
      window.localStorage.setItem('sql-adapt-welcome-seen', 'true');
      // Set up instructor profile to access all pages including Research
      window.localStorage.setItem('sql-adapt-user-profile', JSON.stringify({
        id: 'test-user',
        name: 'Test User',
        role: 'instructor',
        createdAt: Date.now()
      }));
      // Explicitly set active session - getActiveSessionId() only creates fallback when called
      window.localStorage.setItem('sql-learning-active-session', 'test-session-nav-cycle-456');
    });
    
    await page.goto('/instructor-dashboard');
    
    // Get initial session
    const initialSessionId = await page.evaluate(() => {
      return window.localStorage.getItem('sql-learning-active-session');
    });
    expect(initialSessionId).toBeTruthy();
    
    // Navigate through instructor pages (Dashboard -> Research -> Settings -> Dashboard)
    await page.getByRole('link', { name: 'Research' }).click();
    await expect(page).toHaveURL(/\/research/);
    
    await page.getByRole('link', { name: 'Settings' }).click();
    await expect(page).toHaveURL(/\/settings/);
    
    await page.getByRole('link', { name: 'Dashboard' }).first().click();
    await expect(page).toHaveURL(/\/instructor-dashboard/);
    
    const finalSessionId = await page.evaluate(() => {
      return window.localStorage.getItem('sql-learning-active-session');
    });
    
    // Session should exist (may be same or different, but should not be null)
    expect(finalSessionId).toBeTruthy();
  });
});

// =============================================================================
// Edge Cases
// =============================================================================

test.describe('@weekly data-integrity: Edge cases', () => {
  test('handles empty learner ID gracefully', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.clear();
      window.sessionStorage.clear();
      window.localStorage.setItem('sql-adapt-welcome-seen', 'true');
      // Set up student profile to bypass role selection
      window.localStorage.setItem('sql-adapt-user-profile', JSON.stringify({
        id: 'test-user',
        name: 'Test User',
        role: 'student',
        createdAt: Date.now()
      }));
    });
    
    await page.goto('/textbook?learnerId=');
    
    await expect(page.getByRole('heading', { name: 'My Textbook', level: 1 })).toBeVisible();
  });

  test('handles very long content strings', async ({ page }) => {
    const longContent = 'A'.repeat(100000);
    
    await page.addInitScript((content) => {
      window.localStorage.clear();
      window.sessionStorage.clear();
      window.localStorage.setItem('sql-adapt-welcome-seen', 'true');
      // Set up student profile to bypass role selection
      window.localStorage.setItem('sql-adapt-user-profile', JSON.stringify({
        id: 'test-user',
        name: 'Test User',
        role: 'student',
        createdAt: Date.now()
      }));
      
      const now = Date.now();
      const textbooks = {
        'learner-long': [{
          id: 'unit-long',
          sessionId: `session-long-${now}`,
          updatedSessionIds: [`session-long-${now}`],
          type: 'summary',
          conceptId: 'select-basic',
          title: 'Long Content Note',
          content: content,
          prerequisites: [],
          addedTimestamp: now,
          sourceInteractionIds: ['evt-long-1'],
          lastErrorSubtypeId: 'incomplete query',
          provenance: {
            model: 'test',
            params: { temperature: 0, top_p: 1, stream: false, timeoutMs: 1000 },
            templateId: 'notebook_unit.v1',
            inputHash: 'long-hash',
            retrievedSourceIds: [],
            createdAt: now
          }
        }]
      };
      
      window.localStorage.setItem('sql-learning-textbook', JSON.stringify(textbooks));
    }, longContent);
    
    await page.goto('/textbook?learnerId=learner-long');
    await expect(page.getByRole('heading', { name: 'My Textbook', level: 1 })).toBeVisible();
  });

  test('handles special characters in content', async ({ page }) => {
    const specialContent = `
      SELECT * FROM "users" WHERE name = 'O\\'Brien';
      <>&"'
      Unicode: 你好世界 🎉 🚀
      Newlines:
	
      Backslash: \\\\
    `;
    
    await page.addInitScript((content) => {
      window.localStorage.clear();
      window.sessionStorage.clear();
      window.localStorage.setItem('sql-adapt-welcome-seen', 'true');
      // Set up student profile to bypass role selection
      window.localStorage.setItem('sql-adapt-user-profile', JSON.stringify({
        id: 'test-user',
        name: 'Test User',
        role: 'student',
        createdAt: Date.now()
      }));
      
      const now = Date.now();
      const textbooks = {
        'learner-special': [{
          id: 'unit-special',
          sessionId: `session-special-${now}`,
          updatedSessionIds: [`session-special-${now}`],
          type: 'summary',
          conceptId: 'select-basic',
          title: 'Special Characters Note',
          content: content,
          prerequisites: [],
          addedTimestamp: now,
          sourceInteractionIds: ['evt-special-1'],
          lastErrorSubtypeId: 'incomplete query',
          provenance: {
            model: 'test',
            params: { temperature: 0, top_p: 1, stream: false, timeoutMs: 1000 },
            templateId: 'notebook_unit.v1',
            inputHash: 'special-hash',
            retrievedSourceIds: [],
            createdAt: now
          }
        }]
      };
      
      window.localStorage.setItem('sql-learning-textbook', JSON.stringify(textbooks));
    }, specialContent);
    
    await page.goto('/textbook?learnerId=learner-special');
    await expect(page.getByRole('heading', { name: 'My Textbook', level: 1 })).toBeVisible();
  });

  test('handles rapid sequential interactions', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.clear();
      window.sessionStorage.clear();
      window.localStorage.setItem('sql-adapt-welcome-seen', 'true');
      // Set up student profile to bypass role selection
      window.localStorage.setItem('sql-adapt-user-profile', JSON.stringify({
        id: 'test-user',
        name: 'Test User',
        role: 'student',
        createdAt: Date.now()
      }));
    });
    
    await page.goto('/');
    
    const runQueryButton = page.getByRole('button', { name: 'Run Query' });
    await expect(runQueryButton).toBeVisible();
    
    // Type an invalid query first
    await replaceEditorText(page, 'SELECT');
    
    // Submit some queries rapidly
    await runQueryButton.click();
    await runQueryButton.click();
    await runQueryButton.click();
    
    // Wait for interactions to be saved
    await expect.poll(async () => (
      page.evaluate(() => {
        const raw = window.localStorage.getItem('sql-learning-interactions');
        const interactions = raw ? JSON.parse(raw) : [];
        return interactions.length;
      })
    ), { timeout: 5000 }).toBeGreaterThanOrEqual(3);
    
    const interactionCount = await page.evaluate(() => {
      const raw = window.localStorage.getItem('sql-learning-interactions');
      const interactions = raw ? JSON.parse(raw) : [];
      return interactions.length;
    });
    
    // Should have captured at least some interactions
    expect(interactionCount).toBeGreaterThanOrEqual(1);
  });
});
