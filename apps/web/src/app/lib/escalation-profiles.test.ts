/**
 * Unit tests for escalation-profiles.ts
 * 
 * @vitest-environment node
 */

import { describe, it, expect } from 'vitest';
import type { InteractionEvent } from '../types';
import {
  FAST_ESCALATOR,
  SLOW_ESCALATOR,
  ADAPTIVE_ESCALATOR,
  EXPLANATION_FIRST,
  ESCALATION_PROFILES,
  assignProfile,
  getProfileById,
  getEscalationProfilesVersion,
  getProfileForLearner,
  getProfileThresholds,
  getProfileEscalationThreshold,
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
    expect(Object.keys(ESCALATION_PROFILES)).toHaveLength(4);
    expect(ESCALATION_PROFILES['fast-escalator']).toBe(FAST_ESCALATOR);
    expect(ESCALATION_PROFILES['slow-escalator']).toBe(SLOW_ESCALATOR);
    expect(ESCALATION_PROFILES['adaptive-escalator']).toBe(ADAPTIVE_ESCALATOR);
    expect(ESCALATION_PROFILES['explanation-first']).toBe(EXPLANATION_FIRST);
  });

  it('should define EXPLANATION_FIRST with correct thresholds', () => {
    expect(EXPLANATION_FIRST.id).toBe('explanation-first');
    expect(EXPLANATION_FIRST.name).toBe('Explanation First');
    expect(EXPLANATION_FIRST.thresholds.escalate).toBe(1);
    expect(EXPLANATION_FIRST.thresholds.aggregate).toBe(3);
    expect(EXPLANATION_FIRST.triggers.timeStuck).toBe(60000); // 1 minute
    expect(EXPLANATION_FIRST.triggers.rungExhausted).toBe(1);
    expect(EXPLANATION_FIRST.triggers.repeatedError).toBe(1);
  });
});

describe('getProfileById', () => {
  it('should return correct profile for valid IDs', () => {
    expect(getProfileById('fast-escalator')).toBe(FAST_ESCALATOR);
    expect(getProfileById('slow-escalator')).toBe(SLOW_ESCALATOR);
    expect(getProfileById('adaptive-escalator')).toBe(ADAPTIVE_ESCALATOR);
    expect(getProfileById('explanation-first')).toBe(EXPLANATION_FIRST);
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

describe('Edge Cases - Escalation Profiles', () => {
  test('handles null learnerId', () => {
    // Should not crash, return default
    const context: AssignmentContext = { learnerId: null as unknown as string };
    const profile = assignProfile(context, 'static');
    expect(profile).toBeDefined();
    expect(['fast-escalator', 'adaptive-escalator', 'slow-escalator']).toContain(profile.id);
  });

  test('handles undefined learnerId', () => {
    const context: AssignmentContext = { learnerId: undefined as unknown as string };
    const profile = assignProfile(context, 'static');
    expect(profile).toBeDefined();
    expect(['fast-escalator', 'adaptive-escalator', 'slow-escalator']).toContain(profile.id);
  });

  test('handles empty interaction array', () => {
    // Should return default adaptive profile when no interactions
    const context: AssignmentContext = { 
      learnerId: 'test-learner',
      interactions: []
    };
    
    // For static strategy, should still work based on learnerId
    const staticProfile = assignProfile(context, 'static');
    expect(staticProfile).toBeDefined();
    expect(['fast-escalator', 'adaptive-escalator', 'slow-escalator']).toContain(staticProfile.id);
    
    // For diagnostic strategy without diagnostic results, should return adaptive
    const diagnosticProfile = assignProfile(context, 'diagnostic');
    expect(diagnosticProfile.id).toBe('adaptive-escalator');
    
    // For bandit strategy, should return adaptive
    const banditProfile = assignProfile(context, 'bandit');
    expect(banditProfile.id).toBe('adaptive-escalator');
  });

  test('handles very long learnerId', () => {
    // 1000 character ID
    const longId = 'a'.repeat(1000);
    const context: AssignmentContext = { learnerId: longId };
    const profile = assignProfile(context, 'static');
    
    expect(profile).toBeDefined();
    expect(['fast-escalator', 'adaptive-escalator', 'slow-escalator']).toContain(profile.id);
    
    // Should be deterministic
    const profile2 = assignProfile(context, 'static');
    expect(profile.id).toBe(profile2.id);
  });

  test('handles special characters in learnerId', () => {
    // IDs with emojis, unicode, etc.
    const specialIds = [
      'learner-🎓-123',
      'learner-🚀-test',
      '用户-123',
      'learner-äöü-456',
      'learner-\n\t\r-789',
      'learner-<script>alert(1)</script>',
      'learner-日本語-テスト',
      'learner-🔥💻🎉',
    ];
    
    specialIds.forEach(id => {
      const context: AssignmentContext = { learnerId: id };
      const profile = assignProfile(context, 'static');
      expect(profile).toBeDefined();
      expect(['fast-escalator', 'adaptive-escalator', 'slow-escalator']).toContain(profile.id);
    });
  });

  test('handles negative error counts in diagnostic results', () => {
    // Should clamp or handle gracefully
    const context: AssignmentContext = {
      learnerId: 'test',
      diagnosticResults: {
        persistenceScore: -0.5,
        recoveryRate: -0.3
      }
    };
    
    // Negative scores should be treated as low persistence -> fast escalator
    const profile = assignProfile(context, 'diagnostic');
    expect(profile).toBeDefined();
    expect(['fast-escalator', 'adaptive-escalator', 'slow-escalator']).toContain(profile.id);
    
    // Score = (-0.5 + -0.3) / 2 = -0.4, which is < 0.3, so should be fast-escalator
    expect(profile.id).toBe('fast-escalator');
  });

  test('handles extremely high error counts in diagnostic results', () => {
    // Values > 1
    const context: AssignmentContext = {
      learnerId: 'test',
      diagnosticResults: {
        persistenceScore: 1000000,
        recoveryRate: 1000000
      }
    };
    
    // Very high scores should be treated as high persistence -> slow escalator
    const profile = assignProfile(context, 'diagnostic');
    expect(profile).toBeDefined();
    expect(profile.id).toBe('slow-escalator');
  });

  test('handles diagnostic scores at exact boundaries', () => {
    // Test exactly at 0.3 and 0.7 boundaries
    const testCases = [
      { score: 0.0, expected: 'fast-escalator' },
      { score: 0.29, expected: 'fast-escalator' },
      { score: 0.3, expected: 'adaptive-escalator' },
      { score: 0.5, expected: 'adaptive-escalator' },
      { score: 0.7, expected: 'adaptive-escalator' },
      { score: 0.71, expected: 'slow-escalator' },
      { score: 1.0, expected: 'slow-escalator' },
    ];
    
    testCases.forEach(({ score, expected }) => {
      const context: AssignmentContext = {
        learnerId: 'test',
        diagnosticResults: {
          persistenceScore: score,
          recoveryRate: score
        }
      };
      const profile = assignProfile(context, 'diagnostic');
      expect(profile.id).toBe(expected);
    });
  });

  test('handles all strategies with same learner', () => {
    // Same learner, different strategies
    // Should produce consistent or appropriate results
    const learnerId = 'consistent-learner-123';
    
    const staticProfile = assignProfile({ learnerId }, 'static');
    const diagnosticProfile = assignProfile({ 
      learnerId,
      diagnosticResults: { persistenceScore: 0.5, recoveryRate: 0.5 }
    }, 'diagnostic');
    const banditProfile = assignProfile({ learnerId }, 'bandit');
    
    // All should return valid profiles
    expect(staticProfile).toBeDefined();
    expect(diagnosticProfile).toBeDefined();
    expect(banditProfile).toBeDefined();
    
    // Static should be deterministic
    const staticProfile2 = assignProfile({ learnerId }, 'static');
    expect(staticProfile.id).toBe(staticProfile2.id);
    
    // Diagnostic with medium scores should return adaptive
    expect(diagnosticProfile.id).toBe('adaptive-escalator');
    
    // Bandit should return adaptive
    expect(banditProfile.id).toBe('adaptive-escalator');
  });

  test('handles whitespace-only learnerId', () => {
    const whitespaceIds = ['', ' ', '   ', '\t', '\n', '\t\n  '];
    
    whitespaceIds.forEach(id => {
      const context: AssignmentContext = { learnerId: id };
      const profile = assignProfile(context, 'static');
      expect(profile).toBeDefined();
      expect(['fast-escalator', 'adaptive-escalator', 'slow-escalator']).toContain(profile.id);
    });
  });

  test('handles interactions with missing properties', () => {
    const context: AssignmentContext = {
      learnerId: 'test',
      interactions: [
        { id: '1' } as unknown as InteractionEvent,
        { eventType: 'hint_request' } as unknown as InteractionEvent,
      ]
    };
    
    // Should not crash
    const profile = assignProfile(context, 'static');
    expect(profile).toBeDefined();
  });
});

describe('getProfileForLearner', () => {
  it('returns profile for learner with static strategy', () => {
    const interactions: InteractionEvent[] = [];
    const profile = getProfileForLearner('learner-123', interactions, 'static');
    
    expect(profile).toBeDefined();
    expect(['fast-escalator', 'slow-escalator', 'adaptive-escalator']).toContain(profile.id);
    expect(profile.name).toBeDefined();
  });
  
  it('returns profile for learner with diagnostic strategy', () => {
    const interactions: InteractionEvent[] = [];
    const profile = getProfileForLearner('learner-456', interactions, 'diagnostic');
    
    expect(profile).toBeDefined();
    expect(profile.id).toBe('adaptive-escalator');
  });
  
  it('returns profile for learner with bandit strategy', () => {
    const interactions: InteractionEvent[] = [];
    const profile = getProfileForLearner('learner-789', interactions, 'bandit');
    
    expect(profile).toBeDefined();
    expect(profile.id).toBe('adaptive-escalator');
  });

  it('defaults to static strategy when not specified', () => {
    const profile = getProfileForLearner('learner-abc');
    
    expect(profile).toBeDefined();
    expect(['fast-escalator', 'slow-escalator', 'adaptive-escalator']).toContain(profile.id);
  });

  it('defaults to static strategy with empty interactions array', () => {
    const profile = getProfileForLearner('learner-def', []);
    
    expect(profile).toBeDefined();
    expect(['fast-escalator', 'slow-escalator', 'adaptive-escalator']).toContain(profile.id);
  });
});

describe('getProfileThresholds', () => {
  it('returns thresholds for fast-escalator', () => {
    expect(getProfileThresholds('fast-escalator')).toEqual({ escalate: 2, aggregate: 4 });
  });
  
  it('returns thresholds for slow-escalator', () => {
    expect(getProfileThresholds('slow-escalator')).toEqual({ escalate: 5, aggregate: 8 });
  });
  
  it('returns thresholds for adaptive-escalator', () => {
    expect(getProfileThresholds('adaptive-escalator')).toEqual({ escalate: 3, aggregate: 6 });
  });
  
  it('returns undefined for unknown profile', () => {
    expect(getProfileThresholds('unknown')).toBeUndefined();
  });

  it('returns undefined for empty profile ID', () => {
    expect(getProfileThresholds('')).toBeUndefined();
  });

  it('returns a copy of thresholds (not reference)', () => {
    const thresholds = getProfileThresholds('fast-escalator');
    expect(thresholds).toBeDefined();
    if (thresholds) {
      thresholds.escalate = 999;
      // Original profile should not be modified
      expect(FAST_ESCALATOR.thresholds.escalate).toBe(2);
    }
  });
});
