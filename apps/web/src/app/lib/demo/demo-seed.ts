/**
 * Demo Dataset Seeder
 * 
 * Provides one-click demo dataset for instructor mode demonstrations.
 * Uses existing storage.importData() and storage.clearAll() - NO secondary storage path.
 * 
 * NON-RESEARCH TELEMETRY: Demo seed/reset operations are operational helpers,
 * not research data. These events are intentionally excluded from research metrics.
 */

import { storage } from '../storage/storage';
import type { 
  UserProfile, 
  InteractionEvent, 
  InstructionalUnit,
  LearnerProfile 
} from '../../types';

// Demo learner profiles (as UserProfile for import)
const DEMO_LEARNER_1: UserProfile = {
  id: 'demo-learner-1',
  name: 'Alex Johnson',
  role: 'student',
  createdAt: Date.now() - 7 * 24 * 60 * 60 * 1000,
};

const DEMO_LEARNER_2: UserProfile = {
  id: 'demo-learner-2',
  name: 'Maria Garcia',
  role: 'student',
  createdAt: Date.now() - 5 * 24 * 60 * 60 * 1000,
};

const DEMO_LEARNERS = [DEMO_LEARNER_1, DEMO_LEARNER_2];

/**
 * Create demo interactions including hint, explanation, and textbook events
 */
function createDemoInteractions(): InteractionEvent[] {
  const now = Date.now();
  const interactions: InteractionEvent[] = [];
  
  // === Learner 1: WHERE clause learning journey ===
  const baseTime1 = now - 2 * 24 * 60 * 60 * 1000;
  
  // 1. Code execution - SELECT basics success
  interactions.push({
    id: 'demo-1-exec-1',
    learnerId: DEMO_LEARNER_1.id,
    timestamp: baseTime1,
    eventType: 'execution',
    problemId: 'p1-select-basics',
    problemSetId: 'sql-basics',
    problemNumber: 1,
    code: 'SELECT * FROM users',
    executionTimeMs: 45,
    sessionId: 'demo-sess-1',
  });
  
  // 2. Hint request for WHERE clause problem
  interactions.push({
    id: 'demo-1-hint-req-1',
    learnerId: DEMO_LEARNER_1.id,
    timestamp: baseTime1 + 60000,
    eventType: 'hint_request',
    problemId: 'p2-where-clause',
    problemSetId: 'sql-basics',
    problemNumber: 2,
    sessionId: 'demo-sess-1',
  });
  
  // 3. Hint view (rung 1 - micro-hint)
  interactions.push({
    id: 'demo-1-hint-view-1',
    learnerId: DEMO_LEARNER_1.id,
    timestamp: baseTime1 + 62000,
    eventType: 'hint_view',
    problemId: 'p2-where-clause',
    problemSetId: 'sql-basics',
    problemNumber: 2,
    sessionId: 'demo-sess-1',
    metadata: { rung: 1, conceptId: 'where-clause' },
  });
  
  // 4. Error - syntax issue
  interactions.push({
    id: 'demo-1-error-1',
    learnerId: DEMO_LEARNER_1.id,
    timestamp: baseTime1 + 120000,
    eventType: 'error',
    problemId: 'p2-where-clause',
    problemSetId: 'sql-basics',
    problemNumber: 2,
    sessionId: 'demo-sess-1',
    errorSubtypeId: 'missing-where-predicate',
    code: 'SELECT * FROM users WHERE',
  });
  
  // 5. Guidance escalation (rung 1 -> 2)
  interactions.push({
    id: 'demo-1-escalate-1',
    learnerId: DEMO_LEARNER_1.id,
    timestamp: baseTime1 + 180000,
    eventType: 'guidance_escalate',
    problemId: 'p2-where-clause',
    problemSetId: 'sql-basics',
    problemNumber: 2,
    sessionId: 'demo-sess-1',
    metadata: { fromRung: 1, toRung: 2, trigger: 'error_after_hint' },
  });
  
  // 6. Explanation view (rung 2 - with sources)
  interactions.push({
    id: 'demo-1-expl-view-1',
    learnerId: DEMO_LEARNER_1.id,
    timestamp: baseTime1 + 185000,
    eventType: 'explanation_view',
    problemId: 'p2-where-clause',
    problemSetId: 'sql-basics',
    problemNumber: 2,
    sessionId: 'demo-sess-1',
    metadata: { 
      rung: 2, 
      hasSources: true, 
      conceptIds: ['where-clause', 'sql-syntax', 'comparison-operators'],
      grounded: true,
    },
  });
  
  // 7. Textbook unit created (key event!)
  interactions.push({
    id: 'demo-1-textbook-upsert-1',
    learnerId: DEMO_LEARNER_1.id,
    timestamp: baseTime1 + 300000,
    eventType: 'textbook_unit_upsert',
    problemId: 'p2-where-clause',
    problemSetId: 'sql-basics',
    problemNumber: 2,
    sessionId: 'demo-sess-1',
    metadata: { 
      unitId: 'demo-unit-1', 
      conceptId: 'where-clause',
      action: 'created',
    },
  });
  
  // 8. Success execution
  interactions.push({
    id: 'demo-1-exec-2',
    learnerId: DEMO_LEARNER_1.id,
    timestamp: baseTime1 + 400000,
    eventType: 'execution',
    problemId: 'p2-where-clause',
    problemSetId: 'sql-basics',
    problemNumber: 2,
    code: "SELECT * FROM users WHERE age > 18",
    executionTimeMs: 52,
    sessionId: 'demo-sess-1',
  });
  
  // === Learner 2: JOIN operations journey ===
  const baseTime2 = now - 1 * 24 * 60 * 60 * 1000;
  
  // 9. Hint request
  interactions.push({
    id: 'demo-2-hint-req-1',
    learnerId: DEMO_LEARNER_2.id,
    timestamp: baseTime2,
    eventType: 'hint_request',
    problemId: 'p3-join-operations',
    problemSetId: 'sql-basics',
    problemNumber: 3,
    sessionId: 'demo-sess-2',
  });
  
  // 10. Error on JOIN
  interactions.push({
    id: 'demo-2-error-1',
    learnerId: DEMO_LEARNER_2.id,
    timestamp: baseTime2 + 90000,
    eventType: 'error',
    problemId: 'p3-join-operations',
    problemSetId: 'sql-basics',
    problemNumber: 3,
    sessionId: 'demo-sess-2',
    errorSubtypeId: 'missing-join-condition',
    code: 'SELECT * FROM orders JOIN customers',
  });
  
  // 11. Explanation view
  interactions.push({
    id: 'demo-2-expl-view-1',
    learnerId: DEMO_LEARNER_2.id,
    timestamp: baseTime2 + 150000,
    eventType: 'explanation_view',
    problemId: 'p3-join-operations',
    problemSetId: 'sql-basics',
    problemNumber: 3,
    sessionId: 'demo-sess-2',
    metadata: { 
      rung: 2, 
      hasSources: true, 
      conceptIds: ['join-operations', 'table-relationships'],
    },
  });
  
  // 12. Textbook unit created
  interactions.push({
    id: 'demo-2-textbook-upsert-1',
    learnerId: DEMO_LEARNER_2.id,
    timestamp: baseTime2 + 250000,
    eventType: 'textbook_unit_upsert',
    problemId: 'p3-join-operations',
    problemSetId: 'sql-basics',
    problemNumber: 3,
    sessionId: 'demo-sess-2',
    metadata: { 
      unitId: 'demo-unit-2', 
      conceptId: 'join-operations',
      action: 'created',
    },
  });
  
  // 13. Profile assigned (for HDI/adaptive features)
  interactions.push({
    id: 'demo-1-profile',
    learnerId: DEMO_LEARNER_1.id,
    timestamp: baseTime1 - 3600000,
    eventType: 'profile_assigned',
    problemId: 'system',
    sessionId: 'demo-sess-setup',
    metadata: { profile: 'adaptive', strategy: 'bandit' },
  });
  
  // 14. HDI calculated
  interactions.push({
    id: 'demo-1-hdi',
    learnerId: DEMO_LEARNER_1.id,
    timestamp: baseTime1 + 500000,
    eventType: 'hdi_calculated',
    problemId: 'system',
    sessionId: 'demo-sess-1',
    metadata: { hdi: 0.45, hdiLevel: 'medium' },
  });
  
  return interactions;
}

/**
 * Create demo textbook units
 */
function createDemoTextbookUnits(): Record<string, InstructionalUnit[]> {
  const baseTime = Date.now() - 2 * 24 * 60 * 60 * 1000;
  
  return {
    [DEMO_LEARNER_1.id]: [
      {
        id: 'demo-unit-1',
        type: 'explanation',
        conceptId: 'where-clause',
        conceptIds: ['where-clause', 'sql-syntax', 'comparison-operators'],
        title: 'Understanding the WHERE Clause',
        content: `# Understanding the WHERE Clause

The WHERE clause filters rows based on conditions. It comes after the FROM clause.

## Key Points

- **Position**: Always after FROM, before ORDER BY
- **Operators**: Use =, <>, <, >, <=, >= for comparisons
- **Combining**: Use AND/OR to combine multiple conditions

## Example

\`\`\`sql
SELECT name, age 
FROM users 
WHERE age >= 18 AND status = 'active';
\`\`\`

This query returns only active users who are 18 or older.

## Common Mistakes

1. Forgetting quotes around string values
2. Using = instead of IN for multiple values
3. Missing spaces around operators`,
        contentFormat: 'markdown',
        sourceInteractionIds: ['demo-1-error-1', 'demo-1-escalate-1'],
        provenance: {
          source: 'sql-engage-template',
          sqlEngageHintId: 'where-001',
          alignmentVersion: 'sql-engage-v3',
        },
        status: 'primary',
        createdAt: baseTime + 300000,
        updatedAt: baseTime + 300000,
      },
      {
        id: 'demo-unit-1b',
        type: 'example',
        conceptId: 'comparison-operators',
        conceptIds: ['comparison-operators', 'where-clause'],
        title: 'Comparison Operators Cheat Sheet',
        content: `# Comparison Operators

| Operator | Meaning | Example |
|----------|---------|---------|
| = | Equal to | \`age = 25\` |
| <> or != | Not equal | \`status <> 'deleted'\` |
| < | Less than | \`price < 100\` |
| > | Greater than | \`score > 80\` |
| <= | Less than or equal | \`age <= 18\` |
| >= | Greater than or equal | \`age >= 21\` |

## BETWEEN Shortcut

\`\`\`sql
-- Instead of:
WHERE age >= 18 AND age <= 65

-- Use:
WHERE age BETWEEN 18 AND 65
\`\`\``,
        contentFormat: 'markdown',
        sourceInteractionIds: ['demo-1-exec-2'],
        provenance: {
          source: 'llm-generated',
          modelId: 'demo',
        },
        status: 'primary',
        createdAt: baseTime + 400000,
        updatedAt: baseTime + 400000,
      },
    ],
    [DEMO_LEARNER_2.id]: [
      {
        id: 'demo-unit-2',
        type: 'explanation',
        conceptId: 'join-operations',
        conceptIds: ['join-operations', 'inner-join', 'table-relationships'],
        title: 'INNER JOIN: Connecting Related Tables',
        content: `# INNER JOIN Explained

INNER JOIN returns only rows that have matching values in both tables.

## Syntax

\`\`\`sql
SELECT columns
FROM table1
INNER JOIN table2 ON table1.key = table2.key;
\`\`\`

## Example: Orders and Customers

\`\`\`sql
SELECT c.name, o.order_date, o.total
FROM customers c
INNER JOIN orders o ON c.id = o.customer_id
WHERE o.total > 100;
\`\`\`

## Key Rules

1. **Always specify ON condition** - or you'll get a Cartesian product
2. **Use table aliases** - makes queries readable
3. **Filter after joining** - WHERE clause comes after JOIN`,
        contentFormat: 'markdown',
        sourceInteractionIds: ['demo-2-error-1', 'demo-2-expl-view-1'],
        provenance: {
          source: 'sql-engage-template',
          sqlEngageHintId: 'join-001',
        },
        status: 'primary',
        createdAt: baseTime + 24 * 60 * 60 * 1000 + 250000,
        updatedAt: baseTime + 24 * 60 * 60 * 1000 + 250000,
      },
    ],
  };
}

/**
 * Create learner profiles for storage
 */
function createLearnerProfiles(): Record<string, LearnerProfile> {
  const now = Date.now();
  return {
    [DEMO_LEARNER_1.id]: {
      id: DEMO_LEARNER_1.id,
      // Use array instead of Set - storage layer expects arrays for serialization
      conceptsCovered: ['select-basics', 'where-clause', 'comparison-operators'] as any,
      lastActive: now - 2 * 24 * 60 * 60 * 1000,
    },
    [DEMO_LEARNER_2.id]: {
      id: DEMO_LEARNER_2.id,
      // Use array instead of Set - storage layer expects arrays for serialization
      conceptsCovered: ['join-operations', 'table-relationships'] as any,
      lastActive: now - 1 * 24 * 60 * 60 * 1000,
    },
  };
}

/**
 * Seed the demo dataset using storage.importData()
 * Creates 2 learners with interactions and textbook units
 */
export function seedDemoDataset(): { 
  success: boolean; 
  learners?: number; 
  interactions?: number; 
  units?: number;
  error?: string;
} {
  try {
    // Check if demo data already exists
    const existingInteractions = storage.getAllInteractions();
    const hasDemoLearners = existingInteractions.some(i => 
      i.learnerId === DEMO_LEARNER_1.id || i.learnerId === DEMO_LEARNER_2.id
    );
    
    if (hasDemoLearners) {
      return { 
        success: false, 
        error: 'Demo data already exists. Reset first if you want to re-seed.' 
      };
    }
    
    // Build data structure matching storage.importData() expectations
    // Keys must match: interactions, profiles, textbooks
    const demoData = {
      exportPolicyVersion: 'demo-seed-v1',
      exportDate: new Date().toISOString(),
      summary: {
        totalInteractions: 0,
        uniqueLearners: [DEMO_LEARNER_1.id, DEMO_LEARNER_2.id],
        uniqueProblems: ['p1-select-basics', 'p2-where-clause', 'p3-join-operations'],
        dateRange: { 
          start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(), 
          end: new Date().toISOString() 
        },
      },
      interactions: createDemoInteractions(),
      textbooks: createDemoTextbookUnits(),  // CHANGED: was 'textbook'
      profiles: Object.values(createLearnerProfiles()),  // CHANGED: was 'learnerProfiles', must be array
      // NOTE: userProfiles are NOT imported via importData() - they are handled separately
    };
    
    // Update summary counts
    demoData.summary.totalInteractions = demoData.interactions.length;
    
    // Use storage.importData to load the demo data
    // IMPORTANT: pass object directly, NOT JSON string
    // NOTE: importData() returns void; success = no exception thrown
    try {
      storage.importData(demoData);
    } catch (importError) {
      return { 
        success: false, 
        error: importError instanceof Error ? importError.message : 'Import failed - check storage quota'
      };
    }
    
    // Count total units
    const totalUnits = Object.values(demoData.textbooks).reduce(
      (sum, units) => sum + units.length, 0
    );
    
    return {
      success: true,
      learners: DEMO_LEARNERS.length,
      interactions: demoData.interactions.length,
      units: totalUnits,
    };
  } catch (error) {
    console.error('[DemoSeed] Failed to seed demo dataset:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

/**
 * Reset demo data using storage.clearAll()
 * Optionally preserves non-demo data if needed
 */
export function resetDemoDataset(): { 
  success: boolean; 
  preservedLearners?: number;
  error?: string 
} {
  try {
    // Check if there's any non-demo data to preserve
    const allInteractions = storage.getAllInteractions();
    const nonDemoInteractions = allInteractions.filter(
      i => !DEMO_LEARNERS.some(dl => dl.id === i.learnerId)
    );
    
    const hasNonDemoData = nonDemoInteractions.length > 0;
    
    if (hasNonDemoData) {
      // Option: Filter out demo data and re-save non-demo
      // For now, we use clearAll() as specified in requirements
      // but this preserves the option to implement filtered reset later
    }
    
    // Use storage.clearAll() - the canonical reset method
    // This clears ALL data including demo data
    storage.clearAll();
    
    return { 
      success: true,
      preservedLearners: 0, // clearAll removes everything
    };
  } catch (error) {
    console.error('[DemoSeed] Failed to reset demo dataset:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

/**
 * Check if demo data exists
 */
export function hasDemoData(): boolean {
  const interactions = storage.getAllInteractions();
  return interactions.some(i => 
    DEMO_LEARNERS.some(dl => dl.id === i.learnerId)
  );
}

/**
 * Get demo learner IDs for filtering
 */
export function getDemoLearnerIds(): string[] {
  return DEMO_LEARNERS.map(l => l.id);
}
