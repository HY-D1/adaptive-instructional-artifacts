import { describe, it, expect, beforeEach } from 'vitest';
import {
  detectPrerequisiteViolation,
  detectViolationsBatch,
  previewViolation,
  type PrerequisiteViolation
} from './prerequisite-detector';
import type { InteractionEvent, LearnerProfile } from '../../types';

// Helper to create a mock profile
function createMockProfile(coveredConcepts: string[]): LearnerProfile {
  return {
    id: 'test-learner',
    name: 'Test Learner',
    conceptsCovered: new Set(coveredConcepts),
    conceptCoverageEvidence: new Map(),
    errorHistory: new Map(),
    interactionCount: 0,
    currentStrategy: 'adaptive-medium',
    preferences: {
      escalationThreshold: 3,
      aggregationDelay: 60000
    }
  };
}

// Helper to create a mock error event
function createMockErrorEvent(
  conceptIds: string[],
  problemId: string = 'test-problem'
): InteractionEvent {
  return {
    id: 'test-event-1',
    learnerId: 'test-learner',
    timestamp: Date.now(),
    eventType: 'error',
    problemId,
    conceptIds,
    errorSubtypeId: 'syntax-error'
  };
}

describe('Prerequisite Violation Detector', () => {
  describe('detectPrerequisiteViolation', () => {
    it('should return null for non-error events', () => {
      const profile = createMockProfile([]);
      const event: InteractionEvent = {
        id: 'test-event',
        learnerId: 'test-learner',
        timestamp: Date.now(),
        eventType: 'execution',
        problemId: 'test-problem',
        successful: true
      };
      
      const violation = detectPrerequisiteViolation(event, profile);
      expect(violation).toBeNull();
    });

    it('should return null for errors without concept IDs', () => {
      const profile = createMockProfile([]);
      const event: InteractionEvent = {
        id: 'test-event',
        learnerId: 'test-learner',
        timestamp: Date.now(),
        eventType: 'error',
        problemId: 'test-problem'
      };
      
      const violation = detectPrerequisiteViolation(event, profile);
      expect(violation).toBeNull();
    });

    it('should detect violation when prerequisites are missing', () => {
      const profile = createMockProfile([]); // No concepts covered
      const event = createMockErrorEvent(['where-clause']);
      
      const violation = detectPrerequisiteViolation(event, profile);
      expect(violation).not.toBeNull();
      expect(violation?.conceptAttempted).toBe('where-clause');
      expect(violation?.missingPrerequisites).toContain('select-basic');
      expect(violation?.severity).toBeDefined();
    });

    it('should return null when prerequisites are met', () => {
      const profile = createMockProfile(['select-basic']);
      const event = createMockErrorEvent(['where-clause']);
      
      const violation = detectPrerequisiteViolation(event, profile);
      expect(violation).toBeNull();
    });

    it('should detect appropriate severity based on missing prerequisites', () => {
      const profile = createMockProfile([]);
      // window-functions requires multiple prerequisites
      const event = createMockErrorEvent(['window-functions']);
      
      const violation = detectPrerequisiteViolation(event, profile);
      expect(violation).not.toBeNull();
      expect(['medium', 'high']).toContain(violation?.severity);
      expect(violation?.violationDepth).toBeGreaterThan(0);
    });

    it('should include suggested remediation', () => {
      const profile = createMockProfile([]);
      const event = createMockErrorEvent(['where-clause']);
      
      const violation = detectPrerequisiteViolation(event, profile);
      expect(violation?.suggestedRemediation.length).toBeGreaterThan(0);
      expect(violation?.suggestedRemediation).toContain('select-basic');
    });

    it('should detect indirect missing prerequisites', () => {
      const profile = createMockProfile([]);
      const event = createMockErrorEvent(['group-by']);
      
      const violation = detectPrerequisiteViolation(event, profile);
      expect(violation).not.toBeNull();
      expect(violation?.indirectMissing.length).toBeGreaterThan(0);
    });
  });

  describe('detectViolationsBatch', () => {
    it('should detect violations for multiple concepts', () => {
      const profile = createMockProfile([]);
      const violations = detectViolationsBatch(
        ['where-clause', 'joins', 'select-basic'],
        profile,
        {
          learnerId: 'test-learner',
          timestamp: Date.now(),
          problemId: 'test-problem'
        }
      );
      
      // where-clause and joins should have violations, select-basic should not
      expect(violations.length).toBeGreaterThanOrEqual(1);
      const attemptedConcepts = violations.map(v => v.conceptAttempted);
      expect(attemptedConcepts).not.toContain('select-basic');
    });

    it('should not duplicate violations for same concept', () => {
      const profile = createMockProfile([]);
      const violations = detectViolationsBatch(
        ['where-clause', 'where-clause'],
        profile,
        {
          learnerId: 'test-learner',
          timestamp: Date.now(),
          problemId: 'test-problem'
        }
      );
      
      expect(violations.length).toBe(1);
    });
  });

  describe('previewViolation', () => {
    it('should return violation preview when prerequisites are missing', () => {
      const profile = createMockProfile([]);
      const preview = previewViolation('where-clause', profile);
      
      expect(preview).not.toBeNull();
      expect(preview?.conceptAttempted).toBe('where-clause');
      expect(preview?.missingPrerequisites).toContain('select-basic');
    });

    it('should return null when prerequisites are met', () => {
      const profile = createMockProfile(['select-basic']);
      const preview = previewViolation('where-clause', profile);
      
      expect(preview).toBeNull();
    });

    it('should include severity in preview', () => {
      const profile = createMockProfile([]);
      const preview = previewViolation('where-clause', profile);
      
      expect(preview?.severity).toBeDefined();
    });
  });
});
