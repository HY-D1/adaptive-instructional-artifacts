/**
 * Demo Data Seeding Module
 * 
 * Provides functions to seed demo data for testing and demonstration purposes.
 * This allows instructors to populate the dashboard with realistic-looking data.
 */

import { storage } from '../storage/storage';
import type { LearnerProfile, InteractionEvent } from '../../types';

const DEMO_LEARNER_IDS = ['demo-learner-1', 'demo-learner-2', 'demo-learner-3'];
const DEMO_STORAGE_KEY = 'sql-adapt-demo-data-seeded';

interface SeedResult {
  success: boolean;
  learners?: number;
  interactions?: number;
  units?: number;
  error?: string;
}

/**
 * Check if demo data has already been seeded
 */
export function hasDemoData(): boolean {
  try {
    return localStorage.getItem(DEMO_STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

/**
 * Mark demo data as seeded
 */
function markDemoDataSeeded(): void {
  try {
    localStorage.setItem(DEMO_STORAGE_KEY, 'true');
  } catch {
    // Ignore storage errors
  }
}

/**
 * Clear demo data marker
 */
function clearDemoDataMarker(): void {
  try {
    localStorage.removeItem(DEMO_STORAGE_KEY);
  } catch {
    // Ignore storage errors
  }
}

/**
 * Generate a sample learner profile
 */
function createDemoProfile(id: string, name: string): LearnerProfile {
  return {
    id,
    name,
    conceptsCovered: new Set(['select-basics', 'where-clause', 'join-operations']),
    lastActive: Date.now() - Math.random() * 86400000,
  };
}

/**
 * Generate sample interaction events for a learner
 */
function createDemoInteractions(learnerId: string): InteractionEvent[] {
  const now = Date.now();
  const interactions: InteractionEvent[] = [];
  const problemIds = ['problem-1', 'problem-2', 'problem-3', 'problem-4', 'problem-5'];
  
  // Create some hint request events
  for (let i = 0; i < 5; i++) {
    interactions.push({
      id: `demo-${learnerId}-hint-${i}`,
      learnerId,
      timestamp: now - Math.random() * 86400000,
      eventType: 'hint_request',
      problemId: problemIds[Math.floor(Math.random() * problemIds.length)],
      rung: Math.floor(Math.random() * 3) + 1 as 1 | 2 | 3,
    });
  }
  
  // Create some error events
  for (let i = 0; i < 3; i++) {
    interactions.push({
      id: `demo-${learnerId}-error-${i}`,
      learnerId,
      timestamp: now - Math.random() * 86400000,
      eventType: 'error',
      problemId: problemIds[Math.floor(Math.random() * problemIds.length)],
      errorSubtypeId: ['syntax-error', 'missing-join-condition', 'aggregate-misuse'][Math.floor(Math.random() * 3)],
    });
  }
  
  // Create profile assignment event
  interactions.push({
    id: `demo-${learnerId}-profile`,
    learnerId,
    timestamp: now - 86400000,
    eventType: 'profile_assigned',
    problemId: 'instructor-dashboard',
    payload: {
      profile: ['fast', 'slow', 'adaptive'][Math.floor(Math.random() * 3)],
      strategy: ['static', 'diagnostic', 'bandit'][Math.floor(Math.random() * 3)],
      reason: 'demo_data',
    },
  });
  
  // Create HDI calculation event
  interactions.push({
    id: `demo-${learnerId}-hdi`,
    learnerId,
    timestamp: now - 43200000,
    eventType: 'hdi_calculated',
    problemId: 'instructor-dashboard',
    payload: {
      hdi: Math.random() * 0.6 + 0.2,
      hdiLevel: ['low', 'medium', 'high'][Math.floor(Math.random() * 3)],
      components: {
        hpa: Math.random(),
        aed: Math.random(),
        er: Math.random(),
        reae: Math.random(),
        iwh: Math.random(),
      },
    },
  });
  
  return interactions;
}

/**
 * Seed the database with demo data
 */
export function seedDemoDataset(): SeedResult {
  try {
    if (hasDemoData()) {
      return { success: false, error: 'Demo data already exists' };
    }
    
    const demoProfiles: LearnerProfile[] = [
      createDemoProfile('demo-learner-1', 'Alice Chen'),
      createDemoProfile('demo-learner-2', 'Bob Martinez'),
      createDemoProfile('demo-learner-3', 'Carol Williams'),
    ];
    
    // Save profiles
    for (const profile of demoProfiles) {
      storage.saveProfile(profile);
    }
    
    // Generate and save interactions
    let allInteractions: InteractionEvent[] = [];
    for (const profile of demoProfiles) {
      const interactions = createDemoInteractions(profile.id);
      allInteractions = [...allInteractions, ...interactions];
    }
    
    // Save interactions one by one using saveInteraction
    for (const interaction of allInteractions) {
      storage.saveInteraction(interaction);
    }
    
    markDemoDataSeeded();
    
    return {
      success: true,
      learners: demoProfiles.length,
      interactions: allInteractions.length,
      units: 0,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Reset all demo data (clears all storage)
 */
export function resetDemoDataset(): SeedResult {
  try {
    // Clear all demo learner profiles
    for (const learnerId of DEMO_LEARNER_IDS) {
      localStorage.removeItem(`sql-adapt-profile-${learnerId}`);
    }
    
    // Clear interactions (filter out demo ones)
    const allInteractions = storage.getAllInteractions();
    const nonDemoInteractions = allInteractions.filter(
      i => !DEMO_LEARNER_IDS.includes(i.learnerId)
    );
    
    // Save back non-demo interactions
    try {
      localStorage.setItem('sql-adapt-interactions', JSON.stringify(nonDemoInteractions));
    } catch {
      // If quota exceeded, just clear all
      localStorage.removeItem('sql-adapt-interactions');
    }
    
    // Clear textbook units from demo learners
    const allUnits = storage.getAllUnits ? storage.getAllUnits() : [];
    const nonDemoUnits = allUnits.filter(
      (u: { learnerId?: string }) => !DEMO_LEARNER_IDS.includes(u.learnerId || '')
    );
    
    try {
      localStorage.setItem('sql-adapt-textbook', JSON.stringify(nonDemoUnits));
    } catch {
      localStorage.removeItem('sql-adapt-textbook');
    }
    
    clearDemoDataMarker();
    
    return {
      success: true,
      learners: 0,
      interactions: nonDemoInteractions.length,
      units: nonDemoUnits.length,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
