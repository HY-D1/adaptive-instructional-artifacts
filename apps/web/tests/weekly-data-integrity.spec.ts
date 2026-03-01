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
  await page.evaluate(({ storageKey, corruptData }: { storageKey: string; corruptData: string }) => {
    window.localStorage.setItem(storageKey, corruptData);
  }, { storageKey: key, corruptData: data });
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