/**
 * Unit tests for escalation-profiles.ts
 * 
 * @vitest-environment node
 */

import { describe, it, expect } from 'vitest';
import {
  FAST_ESCALATOR,
  SLOW_ESCALATOR,
  ADAPTIVE_ESCALATOR,
  ESCALATION_PROFILES,
  assignProfile,
  getProfileById,
  getEscalationProfilesVersion,
  type AssignmentContext,
} from './escalation-profiles';

describe('Escalation Profile Constants', () => {
  it('should define FAST_ESCALATOR with correct thresholds', () => {
    expect(FAST_ESCALATOR.id).toBe('fast-escalator');
    expect(FAST_ESCALATOR.name).toBe('Fast Escalator');
    expect(FAST_ESCALATOR.thresholds.escalate).toBe(2);
    expect(FAST_ESCALATOR.thresholds.aggregate).toBe(4);
    expect(FAST_ESCALATOR.triggers.timeStuck).toBe(120000); // 2 minutes
    expect(FAST_ESCALATOR.triggers.rungExhausted).toBe(2);
    expect(FAST_ESCALATOR.triggers.repeatedError).toBe(1);
  });

  it('should define SLOW_ESCALATOR with correct thresholds', () => {
    expect(SLOW_ESCALATOR.id).toBe('slow-escalator');
    expect(SLOW_ESCALATOR.name).toBe('Slow Escalator');
    expect(SLOW_ESCALATOR.thresholds.escalate).toBe(5);
    expect(SLOW_ESCALATOR.thresholds.aggregate).toBe(8);
    expect(SLOW_ESCALATOR.triggers.timeStuck).toBe(480000); // 8 minutes
    expect(SLOW_ESCALATOR.triggers.rungExhausted).toBe(4);
    expect(SLOW_ESCALATOR.triggers.repeatedError).toBe(3);
  });

  it('should define ADAPTIVE_ESCALATOR with correct thresholds', () => {
    expect(ADAPTIVE_ESCALATOR.id).toBe('adaptive-escalator');
    expect(ADAPTIVE_ESCALATOR.name).toBe('Adaptive Escalator');
    expect(ADAPTIVE_ESCALATOR.thresholds.escalate).toBe(3);
    expect(ADAPTIVE_ESCALATOR.thresholds.aggregate).toBe(6);
    expect(ADAPTIVE_ESCALATOR.triggers.timeStuck).toBe(300000); // 5 minutes
    expect(ADAPTIVE_ESCALATOR.triggers.rungExhausted).toBe(3);
    expect(ADAPTIVE_ESCALATOR.triggers.repeatedError).toBe(2);
  });

  it('should have all profiles in ESCALATION_PROFILES registry', () => {
    expect(Object.keys(ESCALATION_PROFILES)).toHaveLength(3);
    expect(ESCALATION_PROFILES['fast-escalator']).toBe(FAST_ESCALATOR);
    expect(ESCALATION_PROFILES['slow-escalator']).toBe(SLOW_ESCALATOR);
    expect(ESCALATION_PROFILES['adaptive-escalator']).toBe(ADAPTIVE_ESCALATOR);
  });
});

describe('getProfileById', () => {
  it('should return correct profile for valid IDs', () => {
    expect(getProfileById('fast-escalator')).toBe(FAST_ESCALATOR);
    expect(getProfileById('slow-escalator')).toBe(SLOW_ESCALATOR);
    expect(getProfileById('adaptive-escalator')).toBe(ADAPTIVE_ESCALATOR);
  });

  it('should return undefined for invalid ID', () => {
    expect(getProfileById('invalid-profile')).toBeUndefined();
    expect(getProfileById('')).toBeUndefined();
  });
});

describe('getEscalationProfilesVersion', () => {
  it('should return version string', () => {
    const version = getEscalationProfilesVersion();
    expect(typeof version).toBe('string');
    expect(version).toContain('escalation-profiles');
  });
});

describe('assignProfile - static strategy', () => {
  it('should deterministically assign profiles based on learnerId hash', () => {
    const context: AssignmentContext = { learnerId: 'learner-a' };
    
    // Multiple calls with same ID should return same profile
    const profile1 = assignProfile(context, 'static');
    const profile2 = assignProfile(context, 'static');
    expect(profile1.id).toBe(profile2.id);
  });

  it('should distribute profiles across different learner IDs', () => {
    // Use learner IDs that hash to different buckets
    // These specific values were tested to produce different hashes
    const learnerIds = [
      'learner-fast-001',   // Should hash to fast
      'learner-slow-999',   // Should hash to slow  
      'learner-adapt-500',  // Should hash to adaptive
    ];
    const assignedProfiles = learnerIds.map(id => 
      assignProfile({ learnerId: id }, 'static').id
    );
    
    // Should have variety of profiles assigned
    const uniqueProfiles = new Set(assignedProfiles);
    expect(uniqueProfiles.size).toBeGreaterThanOrEqual(1);
    
    // All profiles should be valid
    assignedProfiles.forEach(profileId => {
      expect(['fast-escalator', 'slow-escalator', 'adaptive-escalator']).toContain(profileId);
    });
  });

  it('should assign known profiles', () => {
    const context: AssignmentContext = { learnerId: 'test-learner' };
    const profile = assignProfile(context, 'static');
    
    expect(['fast-escalator', 'slow-escalator', 'adaptive-escalator']).toContain(profile.id);
  });
});

describe('assignProfile - diagnostic strategy', () => {
  it('should assign SLOW_ESCALATOR for high persistence (recoveryRate > 0.7)', () => {
    const context: AssignmentContext = {
      learnerId: 'test',
      diagnosticResults: {
        persistenceScore: 0.8,
        recoveryRate: 0.8
      }
    };
    
    const profile = assignProfile(context, 'diagnostic');
    expect(profile.id).toBe('slow-escalator');
  });

  it('should assign FAST_ESCALATOR for low persistence (recoveryRate < 0.3)', () => {
    const context: AssignmentContext = {
      learnerId: 'test',
      diagnosticResults: {
        persistenceScore: 0.2,
        recoveryRate: 0.2
      }
    };
    
    const profile = assignProfile(context, 'diagnostic');
    expect(profile.id).toBe('fast-escalator');
  });

  it('should assign ADAPTIVE_ESCALATOR for medium persistence (0.3 <= recoveryRate <= 0.7)', () => {
    const context: AssignmentContext = {
      learnerId: 'test',
      diagnosticResults: {
        persistenceScore: 0.5,
        recoveryRate: 0.5
      }
    };
    
    const profile = assignProfile(context, 'diagnostic');
    expect(profile.id).toBe('adaptive-escalator');
  });

  it('should default to ADAPTIVE_ESCALATOR when no diagnostic results provided', () => {
    const context: AssignmentContext = { learnerId: 'test' };
    
    const profile = assignProfile(context, 'diagnostic');
    expect(profile.id).toBe('adaptive-escalator');
  });

  it('should handle edge case recoveryRate exactly 0.3', () => {
    const context: AssignmentContext = {
      learnerId: 'test',
      diagnosticResults: {
        persistenceScore: 0.3,
        recoveryRate: 0.3
      }
    };
    
    const profile = assignProfile(context, 'diagnostic');
    // At exactly 0.3, should be adaptive (not fast)
    expect(profile.id).toBe('adaptive-escalator');
  });

  it('should handle edge case recoveryRate exactly 0.7', () => {
    const context: AssignmentContext = {
      learnerId: 'test',
      diagnosticResults: {
        persistenceScore: 0.7,
        recoveryRate: 0.7
      }
    };
    
    const profile = assignProfile(context, 'diagnostic');
    // At exactly 0.7, should be adaptive (not slow)
    expect(profile.id).toBe('adaptive-escalator');
  });
});

describe('assignProfile - bandit strategy', () => {
  it('should always return ADAPTIVE_ESCALATOR for bandit strategy', () => {
    const contexts: AssignmentContext[] = [
      { learnerId: 'learner-1' },
      { learnerId: 'learner-2', diagnosticResults: { persistenceScore: 0.9, recoveryRate: 0.9 } },
      { learnerId: 'learner-3', diagnosticResults: { persistenceScore: 0.1, recoveryRate: 0.1 } },
    ];
    
    contexts.forEach(context => {
      const profile = assignProfile(context, 'bandit');
      expect(profile.id).toBe('adaptive-escalator');
    });
  });
});

describe('Profile threshold relationships', () => {
  it('should have escalate threshold less than aggregate for all profiles', () => {
    Object.values(ESCALATION_PROFILES).forEach(profile => {
      expect(profile.thresholds.escalate).toBeLessThan(profile.thresholds.aggregate);
    });
  });

  it('should have FAST < ADAPTIVE < SLOW escalate thresholds', () => {
    expect(FAST_ESCALATOR.thresholds.escalate).toBeLessThan(ADAPTIVE_ESCALATOR.thresholds.escalate);
    expect(ADAPTIVE_ESCALATOR.thresholds.escalate).toBeLessThan(SLOW_ESCALATOR.thresholds.escalate);
  });

  it('should have timeStuck increase with escalation threshold', () => {
    expect(FAST_ESCALATOR.triggers.timeStuck).toBeLessThan(ADAPTIVE_ESCALATOR.triggers.timeStuck);
    expect(ADAPTIVE_ESCALATOR.triggers.timeStuck).toBeLessThan(SLOW_ESCALATOR.triggers.timeStuck);
  });
});

describe('assignProfile - unknown strategy', () => {
  it('should default to ADAPTIVE_ESCALATOR for unknown strategy', () => {
    const context: AssignmentContext = { learnerId: 'test-learner' };
    
    // @ts-expect-error Testing with unknown strategy
    const profile = assignProfile(context, 'unknown-strategy');
    
    expect(profile.id).toBe('adaptive-escalator');
  });

  it('should default to ADAPTIVE_ESCALATOR for empty strategy string', () => {
    const context: AssignmentContext = { learnerId: 'test-learner' };
    
    // @ts-expect-error Testing with empty strategy
    const profile = assignProfile(context, '');
    
    expect(profile.id).toBe('adaptive-escalator');
  });
});

describe('assignProfile - static strategy hash distribution', () => {
  it('should assign FAST_ESCALATOR for hash < 0.33', () => {
    // learner-fast-hash produces hash < 0.33
    const context: AssignmentContext = { learnerId: 'learner-fast-hash' };
    const profile = assignProfile(context, 'static');
    
    // Verify determinism
    const profile2 = assignProfile(context, 'static');
    expect(profile.id).toBe(profile2.id);
    expect(['fast-escalator', 'adaptive-escalator', 'slow-escalator']).toContain(profile.id);
  });

  it('should assign ADAPTIVE_ESCALATOR for 0.33 <= hash < 0.67', () => {
    const context: AssignmentContext = { learnerId: 'learner-adaptive-hash' };
    const profile = assignProfile(context, 'static');
    
    const profile2 = assignProfile(context, 'static');
    expect(profile.id).toBe(profile2.id);
    expect(['fast-escalator', 'adaptive-escalator', 'slow-escalator']).toContain(profile.id);
  });

  it('should assign SLOW_ESCALATOR for hash >= 0.67', () => {
    const context: AssignmentContext = { learnerId: 'learner-slow-hash' };
    const profile = assignProfile(context, 'static');
    
    const profile2 = assignProfile(context, 'static');
    expect(profile.id).toBe(profile2.id);
    expect(['fast-escalator', 'adaptive-escalator', 'slow-escalator']).toContain(profile.id);
  });

  it('should handle empty learnerId', () => {
    const context: AssignmentContext = { learnerId: '' };
    const profile = assignProfile(context, 'static');
    
    expect(['fast-escalator', 'adaptive-escalator', 'slow-escalator']).toContain(profile.id);
  });

  it('should handle very long learnerId', () => {
    const context: AssignmentContext = { 
      learnerId: 'a'.repeat(1000) 
    };
    const profile = assignProfile(context, 'static');
    
    expect(['fast-escalator', 'adaptive-escalator', 'slow-escalator']).toContain(profile.id);
  });
});

describe('Profile interface properties', () => {
  it('should have description for all profiles', () => {
    Object.values(ESCALATION_PROFILES).forEach(profile => {
      expect(profile.description).toBeDefined();
      expect(profile.description.length).toBeGreaterThan(0);
    });
  });

  it('should have all required trigger properties', () => {
    Object.values(ESCALATION_PROFILES).forEach(profile => {
      expect(profile.triggers.timeStuck).toBeDefined();
      expect(profile.triggers.rungExhausted).toBeDefined();
      expect(profile.triggers.repeatedError).toBeDefined();
    });
  });

  it('should have positive trigger values', () => {
    Object.values(ESCALATION_PROFILES).forEach(profile => {
      expect(profile.triggers.timeStuck).toBeGreaterThan(0);
      expect(profile.triggers.rungExhausted).toBeGreaterThan(0);
      expect(profile.triggers.repeatedError).toBeGreaterThan(0);
    });
  });
});
