import { storage } from '../lib/storage';
import { LearnerProfile } from '../types';
import { sqlProblems } from './problems';
import { getSqlEngagePolicyVersion } from './sql-engage';

/**
 * Generate simulated interaction traces for testing and research comparison
 */
export function generateDemoData() {
  // Clear existing data
  storage.clearAll();

  // Create three learners with different strategies
  const learners: LearnerProfile[] = [
    storage.createDefaultProfile('learner-demo-1', 'hint-only'),
    storage.createDefaultProfile('learner-demo-2', 'adaptive-medium'),
    storage.createDefaultProfile('learner-demo-3', 'adaptive-high'),
  ];

  learners[0].name = 'Alice (Hint-Only)';
  learners[1].name = 'Bob (Adaptive-Medium)';
  learners[2].name = 'Charlie (Adaptive-High)';

  learners.forEach(l => storage.saveProfile(l));

  // Start deterministic sessions for each demo learner and attach them to all events.
  const learnerSessions = new Map<string, string>();
  learners.forEach(l => {
    learnerSessions.set(l.id, storage.startSession(l.id));
  });

  // Simulate interactions for each learner
  const baseTime = Date.now() - 3600000; // 1 hour ago

  // Alice - Hint-Only strategy (struggles more)
  simulateLearnerSession('learner-demo-1', learnerSessions.get('learner-demo-1')!, baseTime, 'hint-only');

  // Bob - Adaptive-Medium (moderate success)
  simulateLearnerSession('learner-demo-2', learnerSessions.get('learner-demo-2')!, baseTime + 100000, 'adaptive-medium');

  // Charlie - Adaptive-High (better performance)
  simulateLearnerSession('learner-demo-3', learnerSessions.get('learner-demo-3')!, baseTime + 200000, 'adaptive-high');

  // Demo data generation complete
}

function simulateLearnerSession(
  learnerId: string,
  sessionId: string,
  startTime: number,
  strategy: string
) {
  let currentTime = startTime;
  const problemsToAttempt = sqlProblems.slice(0, 3); // First 3 problems

  problemsToAttempt.forEach((problem, problemIdx) => {
    // Code change
    currentTime += 5000;
    storage.saveInteraction({
      id: `${learnerId}-${currentTime}`,
      sessionId,
      learnerId,
      timestamp: currentTime,
      eventType: 'code_change',
      problemId: problem.id,
      code: 'SELECT * FROM',
    });

    // Simulate errors based on strategy
    const errorCount = strategy === 'hint-only' ? 5 : strategy === 'adaptive-medium' ? 3 : 2;

    for (let i = 0; i < errorCount; i++) {
      currentTime += 15000;
      const subtype = i === 0 ? 'incomplete query' : 'undefined table';
      
      // Error execution
      storage.saveInteraction({
        id: `${learnerId}-${currentTime}`,
        sessionId,
        learnerId,
        timestamp: currentTime,
        eventType: 'error',
        problemId: problem.id,
        code: `SELECT * FROM ${i === 0 ? '' : 'users'}`,
        error: i === 0 ? 'syntax error near FROM' : 'no such table',
        errorSubtypeId: subtype,
        sqlEngageSubtype: subtype,
        successful: false,
        timeSpent: currentTime - startTime,
      });

      // Request hints
      currentTime += 10000;
      storage.saveInteraction({
        id: `${learnerId}-${currentTime}`,
        sessionId,
        learnerId,
        timestamp: currentTime,
        eventType: 'hint_view',
        problemId: problem.id,
        hintLevel: Math.min(i + 1, 3),
        sqlEngageSubtype: subtype,
        sqlEngageRowId: `demo-row-${i}`,
        policyVersion: getSqlEngagePolicyVersion()
      });

      // For adaptive strategies, add explanation views
      if (strategy !== 'hint-only' && i >= (strategy === 'adaptive-high' ? 1 : 2)) {
        currentTime += 20000;
        storage.saveInteraction({
          id: `${learnerId}-${currentTime}`,
          sessionId,
          learnerId,
          timestamp: currentTime,
          eventType: 'explanation_view',
          problemId: problem.id,
        });

        // Add to textbook for adaptive learners
        storage.saveTextbookUnit(learnerId, {
          id: `unit-${learnerId}-${problem.id}`,
          sessionId,
          type: 'explanation',
          conceptId: problem.concepts[0],
          title: `Understanding ${problem.title}`,
          content: `# ${problem.title}\n\nThis is an auto-generated explanation based on your errors.\n\n## Key Concepts\n\n${problem.concepts.join(', ')}\n\n## Tips\n\n- Review the basic SELECT syntax\n- Make sure to specify the table name\n- Check for typos in table and column names`,
          prerequisites: [],
          addedTimestamp: currentTime,
          sourceInteractionIds: [`error-${i}`],
        });
      }
    }

    // Successful execution
    currentTime += 20000;
    storage.saveInteraction({
      id: `${learnerId}-${currentTime}`,
      sessionId,
      learnerId,
      timestamp: currentTime,
      eventType: 'execution',
      problemId: problem.id,
      code: problem.expectedQuery,
      successful: true,
      timeSpent: currentTime - startTime,
    });
  });
}

export function clearDemoData() {
  storage.clearAll();
}
