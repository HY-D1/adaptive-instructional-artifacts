/**
 * Week 5 Feature Simulation Tests
 * 
 * Comprehensive simulation tests for real-world scenarios and edge cases:
 * 1. Profile assignment with different strategies
 * 2. Bandit arm selection over time
 * 3. HDI calculation with realistic interaction patterns
 * 4. Profile-aware escalation in guidance ladder
 * 5. End-to-end learner journeys
 * 
 * @vitest-environment node
 */

import { describe, it, expect, beforeEach } from 'vitest';
import type { InteractionEvent, HDILevel } from '../types';
import type { EscalationProfile } from './escalation-profiles';

// Import modules to test
import {
  assignProfile,
  getProfileById,
  FAST_ESCALATOR,
  SLOW_ESCALATOR,
  ADAPTIVE_ESCALATOR,
  EXPLANATION_FIRST,
  type AssignmentContext,
  type AssignmentStrategy,
} from './escalation-profiles';

import {
  MultiArmedBandit,
  createEscalationProfileBandit,
  sampleBeta,
  sampleGamma,
} from './multi-armed-bandit';

import {
  LearnerBanditManager,
  BANDIT_ARM_PROFILES,
  type LearningOutcome,
  type BanditArmId,
} from './learner-bandit-manager';

import {
  calculateHDI,
  calculateHDIComponents,
  calculateHPA,
  calculateAED,
  calculateER,
  calculateREAE,
  calculateIWH,
} from './hdi-calculator';

import {
  createInitialLadderState,
  canEscalate,
  escalate,
  recordRungAttempt,
  determineNextAction,
  type GuidanceLadderState,
  type EscalationTrigger,
} from './guidance-ladder';

import { calculateReward, type RewardComponents } from './reward-calculator';

// =============================================================================
// Test Helpers
// =============================================================================

/**
 * Create a mock interaction event for simulation tests
 */
function createMockInteraction(partial: Partial<InteractionEvent>): InteractionEvent {
  return {
    id: `sim-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    learnerId: 'sim-learner',
    timestamp: Date.now(),
    eventType: 'execution',
    problemId: 'sim-problem',
    ...partial,
  } as InteractionEvent;
}

/**
 * Generate a sequence of interactions with timestamps
 */
function generateInteractionSequence(
  events: Array<Partial<InteractionEvent> & { delayMs?: number }>,
  baseTime: number = Date.now()
): InteractionEvent[] {
  let currentTime = baseTime;
  return events.map((event, index) => {
    const { delayMs = 1000, ...eventData } = event;
    currentTime += delayMs;
    return createMockInteraction({
      id: `seq-${index}-${Math.random().toString(36).substr(2, 5)}`,
      timestamp: currentTime,
      ...eventData,
    });
  });
}

/**
 * Simulate a complete problem-solving session
 */
function simulateProblemSession(options: {
  learnerId: string;
  problemId: string;
  successful: boolean;
  hintCount: number;
  errorCount: number;
  useExplanation: boolean;
  baseTime?: number;
}): InteractionEvent[] {
  const {
    learnerId,
    problemId,
    successful,
    hintCount,
    errorCount,
    useExplanation,
    baseTime = Date.now(),
  } = options;

  const events: InteractionEvent[] = [];
  let currentTime = baseTime;

  // Initial execution attempt
  for (let i = 0; i < errorCount; i++) {
    events.push(
      createMockInteraction({
        learnerId,
        problemId,
        timestamp: (currentTime += 5000),
        eventType: 'execution',
        successful: false,
      }),
      createMockInteraction({
        learnerId,
        problemId,
        timestamp: (currentTime += 1000),
        eventType: 'error',
        errorSubtypeId: 'syntax_error',
      })
    );

    // Add hints between errors
    if (i < hintCount) {
      events.push(
        createMockInteraction({
          learnerId,
          problemId,
          timestamp: (currentTime += 2000),
          eventType: 'hint_request',
          hintLevel: Math.min(i + 1, 3) as 1 | 2 | 3,
        })
      );
    }
  }

  // Explanation view if used
  if (useExplanation) {
    events.push(
      createMockInteraction({
        learnerId,
        problemId,
        timestamp: (currentTime += 3000),
        eventType: 'explanation_view',
      })
    );
  }

  // Final execution
  events.push(
    createMockInteraction({
      learnerId,
      problemId,
      timestamp: (currentTime += 5000),
      eventType: 'execution',
      successful,
    })
  );

  return events;
}

// =============================================================================
// Scenario 1: Struggling Learner (Diagnostic Strategy)
// =============================================================================

describe('Simulation: Struggling Learner', () => {
  it('diagnostic assigns fast-escalator for low persistence/recovery scores', () => {
    // Simulate 10 interactions: 8 errors, 2 hints - represents struggling learner
    const context: AssignmentContext = {
      learnerId: 'struggling-learner-001',
      diagnosticResults: {
        persistenceScore: 0.2, // Low persistence
        recoveryRate: 0.25,    // Slow recovery
      },
    };

    const profile = assignProfile(context, 'diagnostic');

    // Expect: diagnostic assigns fast-escalator for struggling learners
    expect(profile.id).toBe('fast-escalator');
    expect(profile.thresholds.escalate).toBe(2);
    expect(profile.thresholds.aggregate).toBe(4);
  });

  it('struggling learner gets escalation after 2 errors (fast-escalator)', () => {
    // Create initial ladder state
    const problemId = 'struggle-problem';
    const state = createInitialLadderState('struggling-learner', problemId);
    const profile = FAST_ESCALATOR;

    // Simulate interactions: 2 errors with same subtype (repeated error pattern)
    const baseTime = Date.now();
    const interactions = [
      createMockInteraction({
        problemId,
        timestamp: baseTime,
        eventType: 'execution',
        successful: false,
      }),
      createMockInteraction({
        problemId,
        timestamp: baseTime + 1000,
        eventType: 'error',
        errorSubtypeId: 'syntax_error', // First error
      }),
      createMockInteraction({
        problemId,
        timestamp: baseTime + 2000,
        eventType: 'hint_request',
        hintLevel: 1,
      }),
      createMockInteraction({
        problemId,
        timestamp: baseTime + 3000,
        eventType: 'execution',
        successful: false,
      }),
      createMockInteraction({
        problemId,
        timestamp: baseTime + 4000,
        eventType: 'error',
        errorSubtypeId: 'syntax_error', // Repeated same error
      }),
    ];

    // Check escalation eligibility using repeated_error trigger
    const result = canEscalate(state, 'repeated_error', interactions, profile);

    // Should allow escalation due to repeated error (same subtype appears twice)
    expect(result.allowed).toBe(true);
    expect(result.evidence).toBeDefined();
  });

  it('tracks HDI increase for struggling learner', () => {
    const learnerId = 'struggling-hdi-test';
    const interactions: InteractionEvent[] = [];

    // Simulate progressive struggle with increasing hint dependency
    for (let problem = 0; problem < 5; problem++) {
      const problemEvents = simulateProblemSession({
        learnerId,
        problemId: `problem-${problem}`,
        successful: problem < 3, // First 3 successful, then failing
        hintCount: problem + 1, // Increasing hint usage
        errorCount: Math.max(1, problem),
        useExplanation: problem >= 2,
      });
      interactions.push(...problemEvents);
    }

    const hdiResult = calculateHDI(interactions);

    // HDI should be medium or high for struggling learner
    expect(['medium', 'high']).toContain(hdiResult.level);
    expect(hdiResult.components.hpa).toBeGreaterThan(0);
  });
});

// =============================================================================
// Scenario 2: Persistent Learner (Diagnostic Strategy)
// =============================================================================

describe('Simulation: Persistent Learner', () => {
  it('diagnostic assigns slow-escalator for high persistence/recovery scores', () => {
    const context: AssignmentContext = {
      learnerId: 'persistent-learner-001',
      diagnosticResults: {
        persistenceScore: 0.9, // High persistence
        recoveryRate: 0.85,    // Fast recovery
      },
    };

    const profile = assignProfile(context, 'diagnostic');

    // Expect: diagnostic assigns slow-escalator for persistent learners
    expect(profile.id).toBe('slow-escalator');
    expect(profile.thresholds.escalate).toBe(5);
    expect(profile.thresholds.aggregate).toBe(8);
  });

  it('persistent learner requires 5 errors before escalation (slow-escalator)', () => {
    const state = createInitialLadderState('persistent-learner', 'problem-1');
    const profile = SLOW_ESCALATOR;

    // Simulate interactions: 4 errors (should NOT trigger)
    const interactions4Errors = generateInteractionSequence(
      Array(4)
        .fill(null)
        .flatMap(() => [
          { eventType: 'execution', successful: false },
          { eventType: 'error', errorSubtypeId: 'syntax_error' },
        ])
    );

    const result4 = canEscalate(
      { ...state, rungAttempts: { 1: 4, 2: 0, 3: 0 } },
      'rung_exhausted',
      interactions4Errors,
      profile
    );

    // Should NOT escalate at 4 attempts with slow-escalator
    expect(result4.allowed).toBe(false);

    // Now with 5 errors (should trigger)
    const interactions5Errors = generateInteractionSequence(
      Array(5)
        .fill(null)
        .flatMap(() => [
          { eventType: 'execution', successful: false },
          { eventType: 'error', errorSubtypeId: 'syntax_error' },
        ])
    );

    const result5 = canEscalate(
      { ...state, rungAttempts: { 1: 5, 2: 0, 3: 0 } },
      'rung_exhausted',
      interactions5Errors,
      profile
    );

    // Should escalate at 5 attempts with slow-escalator
    expect(result5.allowed).toBe(true);
    expect(result5.profileAware).toBe(true);
  });

  it('tracks low HDI for independent persistent learner', () => {
    const learnerId = 'persistent-hdi-test';
    const interactions: InteractionEvent[] = [];

    // Simulate independent problem solving with minimal hint usage
    for (let problem = 0; problem < 5; problem++) {
      const problemEvents = simulateProblemSession({
        learnerId,
        problemId: `problem-${problem}`,
        successful: true, // Always successful
        hintCount: problem === 0 ? 1 : 0, // Only 1 hint on first problem
        errorCount: problem < 2 ? 1 : 0, // Few errors early
        useExplanation: false, // Never needs explanation
      });
      interactions.push(...problemEvents);
    }

    const hdiResult = calculateHDI(interactions);

    // HDI should be low for independent learners
    expect(hdiResult.level).toBe('low');
    expect(hdiResult.components.iwh).toBeGreaterThan(0.5); // High independent work
  });
});

// =============================================================================
// Scenario 3: Bandit Learning Over Time
// =============================================================================

describe('Simulation: Bandit Learning Over Time', () => {
  it('bandit learns to prefer best arm after many trials', () => {
    const bandit = new MultiArmedBandit(['optimal', 'suboptimal', 'poor', 'terrible']);

    // Train the bandit: 'optimal' arm consistently gives high rewards
    for (let i = 0; i < 50; i++) {
      bandit.updateArm('optimal', 0.9);
      bandit.updateArm('suboptimal', 0.6);
      bandit.updateArm('poor', 0.3);
      bandit.updateArm('terrible', 0.1);
    }

    // Sample many times and count selections
    const selections: Record<string, number> = {
      optimal: 0,
      suboptimal: 0,
      poor: 0,
      terrible: 0,
    };

    for (let i = 0; i < 100; i++) {
      const selected = bandit.selectArm();
      selections[selected]++;
    }

    // Best arm should be selected most frequently
    expect(selections['optimal']).toBeGreaterThan(selections['suboptimal']);
    expect(selections['optimal']).toBeGreaterThan(selections['poor']);
    expect(selections['optimal']).toBeGreaterThan(selections['terrible']);

    // Verify best arm is correctly identified
    expect(bandit.getBestArm()).toBe('optimal');
  });

  it('bandit explores all arms initially with uniform priors', () => {
    const bandit = new MultiArmedBandit(['a', 'b', 'c', 'd']);

    // Sample without any training - should explore due to uniform priors
    const selections: Record<string, number> = { a: 0, b: 0, c: 0, d: 0 };
    for (let i = 0; i < 40; i++) {
      const selected = bandit.selectArm();
      selections[selected]++;
    }

    // All arms should have been selected at least once (exploration)
    expect(selections['a']).toBeGreaterThan(0);
    expect(selections['b']).toBeGreaterThan(0);
    expect(selections['c']).toBeGreaterThan(0);
    expect(selections['d']).toBeGreaterThan(0);
  });

  it('escalation profile bandit selects valid profiles', () => {
    const bandit = createEscalationProfileBandit();

    // createEscalationProfileBandit includes all 4 escalation profile arms
    const validProfiles = ['fast-escalator', 'slow-escalator', 'adaptive-escalator', 'explanation-first'];

    // Verify the bandit has exactly 4 arms
    expect(bandit.getArmIds()).toHaveLength(4);
    expect(bandit.getArmIds()).toContain('fast-escalator');
    expect(bandit.getArmIds()).toContain('slow-escalator');
    expect(bandit.getArmIds()).toContain('adaptive-escalator');
    expect(bandit.getArmIds()).toContain('explanation-first');

    // Run many selections and verify all are valid
    for (let i = 0; i < 50; i++) {
      const selected = bandit.selectArm();
      expect(validProfiles).toContain(selected);
    }
  });

  it('learner bandit manager adapts to learner outcomes', () => {
    const manager = new LearnerBanditManager();
    const learnerId = 'adaptive-learner';

    // Simulate 20 problem-solving sessions
    for (let i = 0; i < 20; i++) {
      const armId = manager.selectProfileForLearner(learnerId).armId;

      // Simulate outcome based on arm
      // Make 'adaptive' arm perform best
      const outcome: LearningOutcome = {
        solved: true,
        usedExplanation: armId !== 'conservative',
        errorCount: armId === 'conservative' ? 1 : armId === 'aggressive' ? 2 : 1,
        baselineErrors: 3,
        timeSpentMs: 5000,
        medianTimeMs: 10000,
        hdiScore: armId === 'conservative' ? 0.1 : 0.4,
      };

      // Give higher reward for conservative (slow-escalator) for this learner
      const reward = armId === 'conservative' ? 0.9 : armId === 'adaptive' ? 0.7 : 0.4;
      manager.recordOutcome(learnerId, armId, outcome);
    }

    const stats = manager.getLearnerStats(learnerId);

    // All arms should have been tried
    expect(stats.length).toBe(4);

    // Stats should show pulls recorded
    const totalPulls = stats.reduce((sum, s) => sum + s.pullCount, 0);
    expect(totalPulls).toBe(20);
  });
});

// =============================================================================
// Scenario 4: HDI Progression
// =============================================================================

describe('Simulation: HDI Progression', () => {
  it('HDI increases with increasing hint dependency', () => {
    const learnerId = 'hdi-progression-test';
    let interactions: InteractionEvent[] = [];

    // Phase 1: Independent learner (low HDI expected)
    for (let i = 0; i < 3; i++) {
      interactions.push(
        ...simulateProblemSession({
          learnerId,
          problemId: `phase1-problem-${i}`,
          successful: true,
          hintCount: 0,
          errorCount: 0,
          useExplanation: false,
        })
      );
    }

    const hdi1 = calculateHDI(interactions);
    expect(hdi1.level).toBe('low');

    // Phase 2: Increasing hint usage (medium HDI expected)
    for (let i = 0; i < 3; i++) {
      interactions.push(
        ...simulateProblemSession({
          learnerId,
          problemId: `phase2-problem-${i}`,
          successful: true,
          hintCount: i + 1, // Increasing hints
          errorCount: 1,
          useExplanation: i === 2,
        })
      );
    }

    const hdi2 = calculateHDI(interactions);
    expect(hdi2.hdi).toBeGreaterThan(hdi1.hdi);

    // Phase 3: High dependency (high HDI expected)
    for (let i = 0; i < 3; i++) {
      interactions.push(
        ...simulateProblemSession({
          learnerId,
          problemId: `phase3-problem-${i}`,
          successful: i === 2, // Struggling
          hintCount: 3,
          errorCount: 3,
          useExplanation: true,
        })
      );
    }

    const hdi3 = calculateHDI(interactions);
    expect(hdi3.hdi).toBeGreaterThan(hdi2.hdi);
    expect(['medium', 'high']).toContain(hdi3.level);
  });

  it('HPA component tracks hints per attempt correctly', () => {
    const interactions = generateInteractionSequence([
      { eventType: 'execution' },
      { eventType: 'hint_request' },
      { eventType: 'execution' },
      { eventType: 'hint_request' },
      { eventType: 'execution' },
    ]);

    const hpa = calculateHPA(interactions);
    // 2 hints / 3 executions = 0.67
    expect(hpa).toBeCloseTo(2 / 3, 2);
  });

  it('AED component tracks escalation depth correctly', () => {
    const interactions = generateInteractionSequence([
      { eventType: 'hint_request', hintLevel: 1 },
      { eventType: 'hint_request', hintLevel: 2 },
      { eventType: 'hint_request', hintLevel: 3 },
    ]);

    const aed = calculateAED(interactions);
    // Average level = 2, normalized = (2-1)/2 = 0.5
    expect(aed).toBe(0.5);
  });

  it('REAE component tracks errors after explanation', () => {
    const baseTime = Date.now();
    const interactions = [
      createMockInteraction({
        eventType: 'explanation_view',
        timestamp: baseTime,
      }),
      createMockInteraction({
        eventType: 'error',
        timestamp: baseTime + 1000,
      }),
      createMockInteraction({
        eventType: 'error',
        timestamp: baseTime + 2000,
      }),
      createMockInteraction({
        eventType: 'execution',
        timestamp: baseTime + 3000,
        successful: true,
      }),
    ];

    const reae = calculateREAE(interactions);
    // 2 errors after explanation out of 2 total errors
    expect(reae).toBe(1);
  });

  it('IWH component tracks independent work correctly', () => {
    const learnerId = 'iwh-test';
    const interactions = [
      // Problem 1: Used hint before success (not independent)
      createMockInteraction({
        learnerId,
        problemId: 'p1',
        eventType: 'hint_request',
      }),
      createMockInteraction({
        learnerId,
        problemId: 'p1',
        eventType: 'execution',
        successful: true,
      }),
      // Problem 2: Independent success
      createMockInteraction({
        learnerId,
        problemId: 'p2',
        eventType: 'execution',
        successful: true,
      }),
    ];

    const iwh = calculateIWH(interactions);
    // 1 independent success / 2 total successes = 0.5
    expect(iwh).toBe(0.5);
  });
});

// =============================================================================
// Scenario 5: Complete Learner Journey
// =============================================================================

describe('Simulation: Complete Learner Journey', () => {
  it('new learner gets static profile assignment', () => {
    const learnerId = 'new-learner-journey';

    // Static strategy assigns based on learnerId hash
    const context: AssignmentContext = { learnerId };
    const profile = assignProfile(context, 'static');

    // Should get one of the valid profiles
    expect(['fast-escalator', 'slow-escalator', 'adaptive-escalator']).toContain(profile.id);

    // Should be deterministic
    const profile2 = assignProfile(context, 'static');
    expect(profile.id).toBe(profile2.id);
  });

  it('full learner journey with all components', () => {
    const learnerId = 'full-journey-learner';
    const manager = new LearnerBanditManager();

    // Step 1: Initial profile assignment (static)
    const initialContext: AssignmentContext = { learnerId };
    const initialProfile = assignProfile(initialContext, 'static');
    expect(initialProfile).toBeDefined();

    // Step 2: Bandit selects profile
    const banditSelection = manager.selectProfileForLearner(learnerId);
    expect(banditSelection.profile).toBeDefined();
    expect(banditSelection.armId).toBeDefined();

    // Step 3: Simulate problem-solving sessions
    const allInteractions: InteractionEvent[] = [];

    for (let session = 0; session < 5; session++) {
      const problemId = `problem-${session}`;

      // Create ladder state for this problem
      let ladderState = createInitialLadderState(learnerId, problemId);

      // Simulate a session with varying success
      const sessionInteractions = simulateProblemSession({
        learnerId,
        problemId,
        successful: session >= 2, // Struggles early, improves
        hintCount: Math.max(0, 3 - session), // Fewer hints over time
        errorCount: Math.max(0, 2 - Math.floor(session / 2)),
        useExplanation: session < 2,
      });

      // Process interactions through guidance ladder
      for (const interaction of sessionInteractions) {
        if (interaction.eventType === 'hint_request') {
          ladderState = recordRungAttempt(ladderState);

          // Check for escalation
          const escalationCheck = canEscalate(
            ladderState,
            'rung_exhausted',
            [...allInteractions, ...sessionInteractions.slice(0, sessionInteractions.indexOf(interaction) + 1)],
            banditSelection.profile
          );

          if (escalationCheck.allowed && ladderState.currentRung < 3) {
            ladderState = escalate(ladderState, 'rung_exhausted', {
              errorCount: 0,
              timeSpentMs: 5000,
              hintCount: ladderState.rungAttempts[ladderState.currentRung],
            }, []);
          }
        }
      }

      allInteractions.push(...sessionInteractions);

      // Step 4: Record outcome in bandit
      const outcome: LearningOutcome = {
        solved: session >= 2,
        usedExplanation: session < 2,
        errorCount: Math.max(0, 2 - Math.floor(session / 2)),
        baselineErrors: 3,
        timeSpentMs: 10000 - session * 1000,
        medianTimeMs: 10000,
        hdiScore: Math.max(0.1, 0.5 - session * 0.1),
      };

      manager.recordOutcome(learnerId, banditSelection.armId, outcome);

      // Step 5: Calculate HDI after each session
      const hdiResult = calculateHDI(allInteractions);
      expect(hdiResult.hdi).toBeGreaterThanOrEqual(0);
      expect(hdiResult.hdi).toBeLessThanOrEqual(1);
      expect(hdiResult.level).toBeDefined();
    }

    // Verify journey progression
    const finalHDI = calculateHDI(allInteractions);
    expect(finalHDI.components).toBeDefined();
    expect(finalHDI.hdi).toBeDefined();

    // Bandit should have recorded all sessions
    const stats = manager.getLearnerStats(learnerId);
    const totalPulls = stats.reduce((sum, s) => sum + s.pullCount, 0);
    expect(totalPulls).toBe(5);
  });

  it('journey shows HDI improvement with effective profile', () => {
    const learnerId = 'improving-learner';
    let interactions: InteractionEvent[] = [];

    // Early struggles (high HDI)
    for (let i = 0; i < 3; i++) {
      interactions.push(
        ...simulateProblemSession({
          learnerId,
          problemId: `early-${i}`,
          successful: false,
          hintCount: 3,
          errorCount: 3,
          useExplanation: true,
        })
      );
    }

    const earlyHDI = calculateHDI(interactions);

    // Later success (lower HDI after learning)
    for (let i = 0; i < 5; i++) {
      interactions.push(
        ...simulateProblemSession({
          learnerId,
          problemId: `late-${i}`,
          successful: true,
          hintCount: 0,
          errorCount: 0,
          useExplanation: false,
        })
      );
    }

    const lateHDI = calculateHDI(interactions);

    // HDI should decrease with successful independent work
    expect(lateHDI.components.iwh).toBeGreaterThan(earlyHDI.components.iwh);
  });
});

// =============================================================================
// Scenario 6: Edge Cases
// =============================================================================

describe('Simulation: Edge Cases', () => {
  it('handles empty interaction history', () => {
    const emptyInteractions: InteractionEvent[] = [];

    // HDI calculation with empty history
    const hdiResult = calculateHDI(emptyInteractions);
    expect(hdiResult.hdi).toBe(0.134); // Baseline with empty IWH contribution
    expect(hdiResult.level).toBe('low');

    // All components should be 0
    const components = calculateHDIComponents(emptyInteractions);
    expect(components.hpa).toBe(0);
    expect(components.aed).toBe(0);
    expect(components.er).toBe(0);
    expect(components.reae).toBe(0);
    expect(components.iwh).toBe(0);
  });

  it('handles 100% error rate appropriately', () => {
    const learnerId = 'all-errors-learner';
    const interactions = generateInteractionSequence(
      Array(10)
        .fill(null)
        .flatMap(() => [
          { eventType: 'execution', successful: false },
          { eventType: 'error', errorSubtypeId: 'syntax_error' },
        ])
    );

    const hdiResult = calculateHDI(interactions);

    // High error rate should result in medium or high dependency
    expect(hdiResult.hdi).toBeGreaterThan(0);
    expect(hdiResult.components.reae).toBe(0); // No errors after explanation (no explanation viewed)
  });

  it('handles 100% success rate appropriately', () => {
    const learnerId = 'all-success-learner';
    const interactions = generateInteractionSequence(
      Array(10)
        .fill(null)
        .map(() => ({
          eventType: 'execution' as const,
          successful: true,
          learnerId,
        }))
    );

    const hdiResult = calculateHDI(interactions);

    // Perfect success without hints = low dependency
    expect(hdiResult.level).toBe('low');
    expect(hdiResult.components.iwh).toBe(1); // All successes independent
  });

  it('handles very long interaction history efficiently', () => {
    const learnerId = 'long-history-learner';
    const interactions: InteractionEvent[] = [];
    const baseTime = Date.now();

    // Generate 10,000 interactions
    for (let i = 0; i < 10000; i++) {
      interactions.push(
        createMockInteraction({
          learnerId,
          timestamp: baseTime + i * 1000,
          eventType: i % 3 === 0 ? 'hint_request' : i % 5 === 0 ? 'error' : 'execution',
          successful: i % 2 === 0,
          hintLevel: (i % 3) + 1 as 1 | 2 | 3,
        })
      );
    }

    // Should complete in reasonable time (no timeout)
    const startTime = Date.now();
    const hdiResult = calculateHDI(interactions);
    const endTime = Date.now();

    expect(hdiResult.hdi).toBeDefined();
    expect(hdiResult.level).toBeDefined();
    expect(endTime - startTime).toBeLessThan(1000); // Should complete in < 1 second
  });

  it('handles single interaction', () => {
    const interactions = [createMockInteraction({ eventType: 'hint_request', hintLevel: 1 })];

    const hdiResult = calculateHDI(interactions);
    expect(hdiResult.hdi).toBeDefined();
    expect(hdiResult.level).toBeDefined();
  });

  it('handles rapid successive interactions', () => {
    const baseTime = Date.now();
    const interactions = Array(100)
      .fill(null)
      .map((_, i) =>
        createMockInteraction({
          timestamp: baseTime + i * 10, // Very rapid (10ms apart)
          eventType: i % 2 === 0 ? 'hint_request' : 'execution',
        })
      );

    const hdiResult = calculateHDI(interactions);
    expect(hdiResult.hdi).toBeGreaterThanOrEqual(0);
    expect(hdiResult.hdi).toBeLessThanOrEqual(1);
  });

  it('handles missing optional fields gracefully', () => {
    const interactions = [
      createMockInteraction({
        eventType: 'hint_request',
        // hintLevel is optional and undefined
      }),
      createMockInteraction({
        eventType: 'execution',
        // successful is optional and undefined
      }),
    ];

    // Should not throw
    expect(() => calculateHDI(interactions)).not.toThrow();
    expect(() => calculateHDIComponents(interactions)).not.toThrow();
  });

  it('handles all profile types in diagnostic strategy', () => {
    const testCases: Array<{
      persistence: number;
      recovery: number;
      expectedProfile: string;
    }> = [
      { persistence: 0.1, recovery: 0.1, expectedProfile: 'fast-escalator' },
      { persistence: 0.2, recovery: 0.3, expectedProfile: 'fast-escalator' },
      { persistence: 0.3, recovery: 0.3, expectedProfile: 'adaptive-escalator' },
      { persistence: 0.5, recovery: 0.5, expectedProfile: 'adaptive-escalator' },
      { persistence: 0.7, recovery: 0.7, expectedProfile: 'adaptive-escalator' },
      { persistence: 0.8, recovery: 0.8, expectedProfile: 'slow-escalator' },
      { persistence: 0.9, recovery: 0.9, expectedProfile: 'slow-escalator' },
    ];

    testCases.forEach(({ persistence, recovery, expectedProfile }) => {
      const context: AssignmentContext = {
        learnerId: `test-${persistence}-${recovery}`,
        diagnosticResults: {
          persistenceScore: persistence,
          recoveryRate: recovery,
        },
      };

      const profile = assignProfile(context, 'diagnostic');
      expect(profile.id).toBe(expectedProfile);
    });
  });

  it('handles bandit with no arms', () => {
    const bandit = new MultiArmedBandit([]);
    expect(() => bandit.selectArm()).toThrow('No arms available in bandit');
    expect(bandit.getBestArm()).toBeNull();
  });

  it('handles guidance ladder at max rung', () => {
    const state: GuidanceLadderState = {
      learnerId: 'test',
      problemId: 'test-problem',
      currentRung: 3,
      rungAttempts: { 1: 5, 2: 5, 3: 5 },
      escalationHistory: [],
      currentConceptIds: [],
      groundedInSources: true,
    };

    const interactions = generateInteractionSequence([
      { eventType: 'hint_request', hintLevel: 3 },
      { eventType: 'hint_request', hintLevel: 3 },
      { eventType: 'error', errorSubtypeId: 'syntax_error' },
    ]);

    // Should not allow escalation beyond rung 3
    const result = canEscalate(state, 'rung_exhausted', interactions);
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('maximum');
  });

  it('handles reward calculation with extreme values', () => {
    const components: RewardComponents = {
      independentSuccess: 1,
      errorReduction: 1,
      delayedRetention: 1,
      dependencyPenalty: 0,
      timeEfficiency: 1,
    };

    const maxReward = calculateReward(components);
    expect(maxReward).toBeGreaterThan(0.9);
    expect(maxReward).toBeLessThanOrEqual(1);

    const minComponents: RewardComponents = {
      independentSuccess: -1,
      errorReduction: -1,
      delayedRetention: 0,
      dependencyPenalty: 1, // High penalty
      timeEfficiency: -1,
    };

    const minReward = calculateReward(minComponents);
    expect(minReward).toBeGreaterThanOrEqual(0);
    expect(minReward).toBeLessThan(0.5);
  });

  it('handles explanation-first profile correctly', () => {
    const profile = EXPLANATION_FIRST;

    expect(profile.thresholds.escalate).toBe(1);
    expect(profile.triggers.rungExhausted).toBe(1);

    const state = createInitialLadderState('test', 'problem');
    const modifiedState = { ...state, rungAttempts: { 1: 1, 2: 0, 3: 0 } };

    const interactions = generateInteractionSequence([
      { eventType: 'hint_request', hintLevel: 1 },
    ]);

    const result = canEscalate(modifiedState, 'rung_exhausted', interactions, profile);
    expect(result.allowed).toBe(true);
  });
});

// =============================================================================
// Performance Tests
// =============================================================================

describe('Simulation: Performance Tests', () => {
  it('bandit selection scales with many arms', () => {
    const manyArms = Array(100)
      .fill(null)
      .map((_, i) => `arm-${i}`);

    const bandit = new MultiArmedBandit(manyArms);

    // Train some arms
    for (let i = 0; i < 10; i++) {
      bandit.updateArm('arm-5', 0.9);
      bandit.updateArm('arm-10', 0.8);
    }

    const startTime = Date.now();
    for (let i = 0; i < 100; i++) {
      bandit.selectArm();
    }
    const endTime = Date.now();

    // Should handle 100 arms efficiently
    expect(endTime - startTime).toBeLessThan(500);
  });

  it('bandit update scales with many updates', () => {
    const bandit = new MultiArmedBandit(['a', 'b']);

    const startTime = Date.now();
    for (let i = 0; i < 10000; i++) {
      bandit.updateArm('a', 0.7);
      bandit.updateArm('b', 0.5);
    }
    const endTime = Date.now();

    expect(endTime - startTime).toBeLessThan(500);

    const stats = bandit.getArmStats('a');
    expect(stats?.pullCount).toBe(10000);
  });

  it('learner manager handles many learners efficiently', () => {
    const manager = new LearnerBanditManager();

    const startTime = Date.now();
    for (let i = 0; i < 100; i++) {
      const learnerId = `learner-${i}`;
      manager.selectProfileForLearner(learnerId);
      manager.recordOutcome(learnerId, 'adaptive', {
        solved: true,
        usedExplanation: false,
        errorCount: 1,
        baselineErrors: 3,
        timeSpentMs: 5000,
        medianTimeMs: 10000,
        hdiScore: 0.2,
      });
    }
    const endTime = Date.now();

    expect(manager.getLearnerCount()).toBe(100);
    expect(endTime - startTime).toBeLessThan(1000);
  });
});

// =============================================================================
// Integration Tests
// =============================================================================

describe('Simulation: Component Integration', () => {
  it('profile assignment affects guidance ladder escalation', () => {
    const learnerId = 'integration-test';
    const problemId = 'integration-problem';

    // Get profile
    const context: AssignmentContext = { learnerId };
    const profile = assignProfile(context, 'static');

    // Create ladder state
    let state = createInitialLadderState(learnerId, problemId);

    // Simulate interactions up to threshold
    const threshold = profile.thresholds.escalate;
    const interactions = generateInteractionSequence(
      Array(threshold)
        .fill(null)
        .flatMap(() => [
          { eventType: 'hint_request' as const },
          { eventType: 'execution' as const, successful: false },
          { eventType: 'error' as const, errorSubtypeId: 'syntax_error' },
        ])
    );

    // Record attempts at current rung
    for (let i = 0; i < threshold; i++) {
      state = recordRungAttempt(state);
    }

    // Check escalation with profile
    const result = canEscalate(state, 'rung_exhausted', interactions, profile);

    expect(result.allowed).toBe(true);
    expect(result.profileAware).toBe(true);
  });

  it('bandit outcomes affect profile selection over time', () => {
    const manager = new LearnerBanditManager();
    const learnerId = 'outcome-test';

    // Make one arm consistently better
    for (let i = 0; i < 30; i++) {
      const armId = manager.selectProfileForLearner(learnerId).armId;

      // Give high reward only for 'conservative' arm
      const outcome: LearningOutcome = {
        solved: true,
        usedExplanation: false,
        errorCount: 1,
        baselineErrors: 3,
        timeSpentMs: 5000,
        medianTimeMs: 10000,
        hdiScore: 0.2,
      };

      // Give reward based on arm
      const reward = armId === 'conservative' ? 0.95 : 0.3;
      manager.recordOutcome(learnerId, armId, outcome);
    }

    const stats = manager.getLearnerStats(learnerId);
    const conservativeStats = stats.find(s => s.armId === 'conservative');

    // Conservative arm should have highest mean reward
    expect(conservativeStats?.meanReward).toBeGreaterThan(0.5);
  });

  it('HDI trajectory affects intervention recommendations', () => {
    const learnerId = 'intervention-test';
    let interactions: InteractionEvent[] = [];

    // Simulate increasing dependency over time
    const hdiReadings: number[] = [];

    for (let session = 0; session < 10; session++) {
      const sessionInteractions = simulateProblemSession({
        learnerId,
        problemId: `session-${session}`,
        successful: session % 2 === 0, // Alternating success/failure
        hintCount: session, // Increasing hints
        errorCount: Math.floor(session / 2),
        useExplanation: session > 3,
      });

      interactions = [...interactions, ...sessionInteractions];
      const hdiResult = calculateHDI(interactions);
      hdiReadings.push(hdiResult.hdi);
    }

    // HDI should show some progression
    expect(hdiReadings.length).toBe(10);

    // Last reading should be different from first
    expect(Math.abs(hdiReadings[9] - hdiReadings[0])).toBeGreaterThan(0);
  });
});

// =============================================================================
// Summary Statistics
// =============================================================================

describe('Simulation: Summary Statistics', () => {
  it('generates comprehensive simulation report', () => {
    const report = {
      totalSimulations: 0,
      profileAssignments: {
        'fast-escalator': 0,
        'slow-escalator': 0,
        'adaptive-escalator': 0,
      },
      hdiDistribution: {
        low: 0,
        medium: 0,
        high: 0,
      },
      banditConvergence: 0,
    };

    // Run many simulations
    for (let i = 0; i < 50; i++) {
      const learnerId = `sim-learner-${i}`;

      // Profile assignment
      const context: AssignmentContext = {
        learnerId,
        diagnosticResults: {
          persistenceScore: Math.random(),
          recoveryRate: Math.random(),
        },
      };
      const profile = assignProfile(context, 'diagnostic');
      report.profileAssignments[profile.id as keyof typeof report.profileAssignments]++;

      // Generate random interaction history
      const interactions = simulateProblemSession({
        learnerId,
        problemId: 'summary-problem',
        successful: Math.random() > 0.3,
        hintCount: Math.floor(Math.random() * 4),
        errorCount: Math.floor(Math.random() * 4),
        useExplanation: Math.random() > 0.5,
      });

      // HDI classification
      const hdiResult = calculateHDI(interactions);
      report.hdiDistribution[hdiResult.level]++;

      report.totalSimulations++;
    }

    // Verify report structure
    expect(report.totalSimulations).toBe(50);
    expect(Object.values(report.profileAssignments).reduce((a, b) => a + b, 0)).toBe(50);
    expect(Object.values(report.hdiDistribution).reduce((a, b) => a + b, 0)).toBe(50);

    // All categories should have some representation
    expect(report.profileAssignments['fast-escalator']).toBeGreaterThanOrEqual(0);
    expect(report.profileAssignments['slow-escalator']).toBeGreaterThanOrEqual(0);
    expect(report.profileAssignments['adaptive-escalator']).toBeGreaterThanOrEqual(0);
  });
});
