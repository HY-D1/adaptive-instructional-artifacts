import { describe, it, expect } from 'vitest';
import {
  ESCALATION_POLICIES,
  POLICY_IDS,
  AGGRESSIVE_POLICY,
  CONSERVATIVE_POLICY,
  EXPLANATION_FIRST_POLICY,
  ADAPTIVE_POLICY,
  NO_HINTS_POLICY,
  getPolicyById,
  getHintEnabledPolicies,
  getExperimentalPolicies,
  shouldEscalate,
  getEscalationThreshold,
  getPolicyDefinitionsVersion,
  policiesEqual
} from './policy-definitions';

describe('@weekly Policy Definitions', () => {
  describe('Policy Registry', () => {
    it('should contain all 5 policies', () => {
      expect(Object.keys(ESCALATION_POLICIES)).toHaveLength(5);
      expect(POLICY_IDS).toHaveLength(5);
    });

    it('should have correct policy IDs', () => {
      expect(POLICY_IDS).toContain('aggressive');
      expect(POLICY_IDS).toContain('conservative');
      expect(POLICY_IDS).toContain('explanation_first');
      expect(POLICY_IDS).toContain('adaptive');
      expect(POLICY_IDS).toContain('no_hints');
    });
  });

  describe('Individual Policies', () => {
    it('aggressive policy should have low thresholds', () => {
      expect(AGGRESSIVE_POLICY.thresholds.escalate).toBe(1);
      expect(AGGRESSIVE_POLICY.thresholds.aggregate).toBe(2);
      expect(AGGRESSIVE_POLICY.triggers.timeStuck).toBe(60000);
      expect(AGGRESSIVE_POLICY.hintsEnabled).toBe(true);
      expect(AGGRESSIVE_POLICY.usesBandit).toBe(false);
    });

    it('conservative policy should have high thresholds', () => {
      expect(CONSERVATIVE_POLICY.thresholds.escalate).toBe(3);
      expect(CONSERVATIVE_POLICY.thresholds.aggregate).toBe(4);
      expect(CONSERVATIVE_POLICY.triggers.timeStuck).toBe(300000);
      expect(CONSERVATIVE_POLICY.hintsEnabled).toBe(true);
      expect(CONSERVATIVE_POLICY.usesBandit).toBe(false);
    });

    it('explanation_first policy should skip hints', () => {
      expect(EXPLANATION_FIRST_POLICY.thresholds.escalate).toBe(0);
      expect(EXPLANATION_FIRST_POLICY.hintsEnabled).toBe(false);
      expect(EXPLANATION_FIRST_POLICY.triggers.timeStuck).toBe(0);
    });

    it('adaptive policy should use bandit', () => {
      expect(ADAPTIVE_POLICY.usesBandit).toBe(true);
      expect(ADAPTIVE_POLICY.hintsEnabled).toBe(true);
      expect(ADAPTIVE_POLICY.thresholds.escalate).toBe(2);
    });

    it('no_hints policy should be disabled', () => {
      expect(NO_HINTS_POLICY.thresholds.escalate).toBe(-1);
      expect(NO_HINTS_POLICY.thresholds.aggregate).toBe(-1);
      expect(NO_HINTS_POLICY.hintsEnabled).toBe(false);
      expect(NO_HINTS_POLICY.triggers.timeStuck).toBe(Infinity);
    });
  });

  describe('getPolicyById', () => {
    it('should return policy for valid ID', () => {
      expect(getPolicyById('aggressive')).toBe(AGGRESSIVE_POLICY);
      expect(getPolicyById('conservative')).toBe(CONSERVATIVE_POLICY);
    });

    it('should return undefined for invalid ID', () => {
      expect(getPolicyById('invalid')).toBeUndefined();
    });
  });

  describe('getHintEnabledPolicies', () => {
    it('should return only hint-enabled policies', () => {
      const enabled = getHintEnabledPolicies();
      expect(enabled).toHaveLength(3);
      expect(enabled.every(p => p.hintsEnabled)).toBe(true);
    });

    it('should not include no_hints or explanation_first', () => {
      const enabled = getHintEnabledPolicies();
      const ids = enabled.map(p => p.id);
      expect(ids).not.toContain('no_hints');
      expect(ids).not.toContain('explanation_first');
    });
  });

  describe('getExperimentalPolicies', () => {
    it('should exclude no_hints control', () => {
      const experimental = getExperimentalPolicies();
      expect(experimental.every(p => p.id !== 'no_hints')).toBe(true);
    });

    it('should include 4 policies', () => {
      expect(getExperimentalPolicies()).toHaveLength(4);
    });
  });

  describe('shouldEscalate', () => {
    it('should return false for no_hints', () => {
      expect(shouldEscalate('no_hints', 5)).toBe(false);
    });

    it('should return true immediately for explanation_first on any error', () => {
      expect(shouldEscalate('explanation_first', 1)).toBe(true);
      expect(shouldEscalate('explanation_first', 0)).toBe(false);
    });

    it('should escalate based on threshold for aggressive policy', () => {
      expect(shouldEscalate('aggressive', 0)).toBe(false);
      expect(shouldEscalate('aggressive', 1)).toBe(true);
      expect(shouldEscalate('aggressive', 5)).toBe(true);
    });

    it('should escalate based on threshold for conservative policy', () => {
      expect(shouldEscalate('conservative', 2)).toBe(false);
      expect(shouldEscalate('conservative', 3)).toBe(true);
    });

    it('should return false for unknown policy', () => {
      expect(shouldEscalate('unknown', 10)).toBe(false);
    });
  });

  describe('getEscalationThreshold', () => {
    it('should return policy-specific thresholds', () => {
      expect(getEscalationThreshold('aggressive')).toBe(1);
      expect(getEscalationThreshold('conservative')).toBe(3);
      expect(getEscalationThreshold('adaptive')).toBe(2);
      expect(getEscalationThreshold('explanation_first')).toBe(0);
    });

    it('should return Infinity for no_hints', () => {
      expect(getEscalationThreshold('no_hints')).toBe(Infinity);
    });

    it('should return default for unknown policy', () => {
      expect(getEscalationThreshold('unknown')).toBe(3);
    });
  });

  describe('getPolicyDefinitionsVersion', () => {
    it('should return version string', () => {
      expect(getPolicyDefinitionsVersion()).toBe('policy-definitions-v1');
    });
  });

  describe('policiesEqual', () => {
    it('should return true for identical policies', () => {
      expect(policiesEqual(AGGRESSIVE_POLICY, AGGRESSIVE_POLICY)).toBe(true);
    });

    it('should return false for different policies', () => {
      expect(policiesEqual(AGGRESSIVE_POLICY, CONSERVATIVE_POLICY)).toBe(false);
    });
  });
});
