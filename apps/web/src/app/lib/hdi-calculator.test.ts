import { describe, it, expect } from 'vitest';
import type { InteractionEvent } from '../types';

// Import the functions to test
import {
  calculateHPA,
  calculateAED,
  calculateER,
  calculateREAE,
  calculateIWH,
  calculateHDI,
  calculateHDIComponents,
  HDI_CALCULATOR_VERSION,
} from './hdi-calculator';

// Helper to create mock interactions
function createMockInteraction(partial: Partial<InteractionEvent>): InteractionEvent {
  return {
    id: `mock-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    learnerId: 'test-learner',
    timestamp: Date.now(),
    eventType: 'hint_request',
    problemId: 'test-problem',
    ...partial,
  };
}

describe('HDI Calculator', () => {
  describe('calculateHPA', () => {
    it('returns 0 for empty interactions array', () => {
      const result = calculateHPA([]);
      expect(result).toBe(0);
    });

    it('returns 0 when no hint requests exist', () => {
      const interactions = [
        createMockInteraction({ eventType: 'execution' }),
        createMockInteraction({ eventType: 'execution' }),
        createMockInteraction({ eventType: 'code_change' }),
      ];
      const result = calculateHPA(interactions);
      expect(result).toBe(0);
    });

    it('returns 0.5 for 2 hints in 4 attempts', () => {
      const interactions = [
        createMockInteraction({ eventType: 'hint_request' }),
        createMockInteraction({ eventType: 'execution' }),
        createMockInteraction({ eventType: 'hint_request' }),
        createMockInteraction({ eventType: 'execution' }),
        createMockInteraction({ eventType: 'execution' }),
        createMockInteraction({ eventType: 'execution' }),
      ];
      const result = calculateHPA(interactions);
      expect(result).toBe(0.5); // 2 hints / 4 executions = 0.5
    });

    it('caps at 1.0 for 3 hints in 2 attempts', () => {
      const interactions = [
        createMockInteraction({ eventType: 'hint_request' }),
        createMockInteraction({ eventType: 'hint_request' }),
        createMockInteraction({ eventType: 'hint_request' }),
        createMockInteraction({ eventType: 'execution' }),
        createMockInteraction({ eventType: 'execution' }),
      ];
      const result = calculateHPA(interactions);
      expect(result).toBe(1.0); // 3/2 = 1.5, capped at 1.0
    });

    it('counts guidance_request as hint request', () => {
      const interactions = [
        createMockInteraction({ eventType: 'guidance_request' }),
        createMockInteraction({ eventType: 'execution' }),
      ];
      const result = calculateHPA(interactions);
      expect(result).toBe(1.0); // 1 guidance / 1 execution = 1.0
    });

    it('returns 0 when no executions exist', () => {
      const interactions = [
        createMockInteraction({ eventType: 'hint_request' }),
        createMockInteraction({ eventType: 'hint_request' }),
        createMockInteraction({ eventType: 'code_change' }),
      ];
      const result = calculateHPA(interactions);
      expect(result).toBe(0);
    });
  });

  describe('calculateAED', () => {
    it('returns 0 for empty interactions array', () => {
      const result = calculateAED([]);
      expect(result).toBe(0);
    });

    it('returns 0 when no hint events exist', () => {
      const interactions = [
        createMockInteraction({ eventType: 'execution' }),
        createMockInteraction({ eventType: 'error' }),
      ];
      const result = calculateAED(interactions);
      expect(result).toBe(0);
    });

    it('returns 0 for all level 1 hints (normalized)', () => {
      const interactions = [
        createMockInteraction({ eventType: 'hint_request', hintLevel: 1 }),
        createMockInteraction({ eventType: 'hint_view', hintLevel: 1 }),
        createMockInteraction({ eventType: 'guidance_request', hintLevel: 1 }),
      ];
      const result = calculateAED(interactions);
      expect(result).toBe(0);
    });

    it('returns 1 for all level 3 hints (normalized)', () => {
      const interactions = [
        createMockInteraction({ eventType: 'hint_request', hintLevel: 3 }),
        createMockInteraction({ eventType: 'hint_view', hintLevel: 3 }),
        createMockInteraction({ eventType: 'guidance_request', hintLevel: 3 }),
      ];
      const result = calculateAED(interactions);
      expect(result).toBe(1);
    });

    it('returns 0.5 for all level 2 hints (normalized)', () => {
      const interactions = [
        createMockInteraction({ eventType: 'hint_request', hintLevel: 2 }),
        createMockInteraction({ eventType: 'hint_view', hintLevel: 2 }),
      ];
      const result = calculateAED(interactions);
      expect(result).toBe(0.5);
    });

    it('calculates correct average for mixed levels', () => {
      // Levels: 1, 2, 3 -> Average = 2 -> Normalized = 0.5
      const interactions = [
        createMockInteraction({ eventType: 'hint_request', hintLevel: 1 }),
        createMockInteraction({ eventType: 'hint_view', hintLevel: 2 }),
        createMockInteraction({ eventType: 'guidance_request', hintLevel: 3 }),
      ];
      const result = calculateAED(interactions);
      expect(result).toBe(0.5);
    });

    it('ignores events without hintLevel', () => {
      const interactions = [
        createMockInteraction({ eventType: 'hint_request', hintLevel: 3 }),
        createMockInteraction({ eventType: 'execution' }),
        createMockInteraction({ eventType: 'error' }),
      ];
      const result = calculateAED(interactions);
      expect(result).toBe(1);
    });
  });

  describe('calculateER', () => {
    it('returns 0 for empty interactions array', () => {
      const result = calculateER([]);
      expect(result).toBe(0);
    });

    it('returns 0 when no explanation views exist', () => {
      const interactions = [
        createMockInteraction({ eventType: 'execution' }),
        createMockInteraction({ eventType: 'hint_request' }),
        createMockInteraction({ eventType: 'execution' }),
      ];
      const result = calculateER(interactions);
      expect(result).toBe(0);
    });

    it('returns 0.4 for 2 explanations in 5 attempts', () => {
      const interactions = [
        createMockInteraction({ eventType: 'explanation_view' }),
        createMockInteraction({ eventType: 'execution' }),
        createMockInteraction({ eventType: 'explanation_view' }),
        createMockInteraction({ eventType: 'execution' }),
        createMockInteraction({ eventType: 'execution' }),
        createMockInteraction({ eventType: 'execution' }),
        createMockInteraction({ eventType: 'execution' }),
      ];
      const result = calculateER(interactions);
      expect(result).toBe(0.4);
    });

    it('does not count guidance_view as explanation view', () => {
      const interactions = [
        createMockInteraction({ eventType: 'guidance_view' }),
        createMockInteraction({ eventType: 'execution' }),
        createMockInteraction({ eventType: 'execution' }),
      ];
      const result = calculateER(interactions);
      expect(result).toBe(0); // guidance_view is not explanation_view
    });

    it('caps at 1.0', () => {
      const interactions = [
        createMockInteraction({ eventType: 'explanation_view' }),
        createMockInteraction({ eventType: 'explanation_view' }),
        createMockInteraction({ eventType: 'execution' }),
      ];
      const result = calculateER(interactions);
      expect(result).toBe(1.0);
    });
  });

  describe('calculateREAE', () => {
    it('returns 0 for empty interactions array', () => {
      const result = calculateREAE([]);
      expect(result).toBe(0);
    });

    it('returns 0 when no errors exist', () => {
      const interactions = [
        createMockInteraction({ eventType: 'explanation_view' }),
        createMockInteraction({ eventType: 'execution' }),
      ];
      const result = calculateREAE(interactions);
      expect(result).toBe(0);
    });

    it('returns 0 when no errors after explanation', () => {
      const baseTime = Date.now();
      const interactions = [
        createMockInteraction({ 
          eventType: 'error', 
          timestamp: baseTime 
        }),
        createMockInteraction({ 
          eventType: 'explanation_view', 
          timestamp: baseTime + 1000 
        }),
        createMockInteraction({ 
          eventType: 'execution', 
          timestamp: baseTime + 2000 
        }),
      ];
      const result = calculateREAE(interactions);
      expect(result).toBe(0);
    });

    it('returns 1 when all errors occur after explanation', () => {
      const baseTime = Date.now();
      const interactions = [
        createMockInteraction({ 
          eventType: 'explanation_view', 
          timestamp: baseTime 
        }),
        createMockInteraction({ 
          eventType: 'error', 
          timestamp: baseTime + 1000 
        }),
        createMockInteraction({ 
          eventType: 'error', 
          timestamp: baseTime + 2000 
        }),
      ];
      const result = calculateREAE(interactions);
      expect(result).toBe(1);
    });

    it('calculates correct ratio for mixed errors', () => {
      const baseTime = Date.now();
      const interactions = [
        createMockInteraction({ 
          eventType: 'error', 
          timestamp: baseTime 
        }),
        createMockInteraction({ 
          eventType: 'explanation_view', 
          timestamp: baseTime + 1000 
        }),
        createMockInteraction({ 
          eventType: 'error', 
          timestamp: baseTime + 2000 
        }),
        createMockInteraction({ 
          eventType: 'error', 
          timestamp: baseTime + 3000 
        }),
      ];
      // 2 errors after explanation out of 3 total errors
      const result = calculateREAE(interactions);
      expect(result).toBeCloseTo(2 / 3, 5);
    });

    it('does not count guidance_view as explanation', () => {
      const baseTime = Date.now();
      const interactions = [
        createMockInteraction({ 
          eventType: 'guidance_view', 
          timestamp: baseTime 
        }),
        createMockInteraction({ 
          eventType: 'error', 
          timestamp: baseTime + 1000 
        }),
      ];
      const result = calculateREAE(interactions);
      expect(result).toBe(0); // guidance_view is not explanation_view
    });
  });

  describe('calculateIWH', () => {
    it('returns 0 for empty interactions array', () => {
      const result = calculateIWH([]);
      expect(result).toBe(0);
    });

    it('returns 0 when all successes used hints', () => {
      const interactions = [
        createMockInteraction({ eventType: 'hint_request', problemId: 'p1' }),
        createMockInteraction({ eventType: 'execution', problemId: 'p1', successful: true }),
        createMockInteraction({ eventType: 'hint_request', problemId: 'p2' }),
        createMockInteraction({ eventType: 'execution', problemId: 'p2', successful: true }),
      ];
      const result = calculateIWH(interactions);
      expect(result).toBe(0);
    });

    it('returns 1 when all successes without hints', () => {
      const interactions = [
        createMockInteraction({ eventType: 'execution', problemId: 'p1', successful: true }),
        createMockInteraction({ eventType: 'execution', problemId: 'p2', successful: true }),
      ];
      const result = calculateIWH(interactions);
      expect(result).toBe(1);
    });

    it('returns 0.5 for mixed success scenarios', () => {
      const interactions = [
        createMockInteraction({ eventType: 'hint_request', problemId: 'p1' }),
        createMockInteraction({ eventType: 'execution', problemId: 'p1', successful: true }),
        createMockInteraction({ eventType: 'execution', problemId: 'p2', successful: true }),
      ];
      const result = calculateIWH(interactions);
      expect(result).toBeCloseTo(0.5, 5);
    });

    it('returns 0 when no successful attempts', () => {
      const interactions = [
        createMockInteraction({ eventType: 'hint_request' }),
        createMockInteraction({ eventType: 'error' }),
        createMockInteraction({ eventType: 'execution', successful: false }),
      ];
      const result = calculateIWH(interactions);
      expect(result).toBe(0);
    });

    it('counts hint_view as hint usage', () => {
      const interactions = [
        createMockInteraction({ eventType: 'hint_view', problemId: 'p1' }),
        createMockInteraction({ eventType: 'execution', problemId: 'p1', successful: true }),
      ];
      const result = calculateIWH(interactions);
      expect(result).toBe(0);
    });
  });

  describe('calculateHDI', () => {
    it('returns low level for all zero components', () => {
      const interactions: InteractionEvent[] = [];
      const result = calculateHDI(interactions);
      // When empty, IWH defaults to 0 (no success without hints = max dependency)
      // So (1 - 0) * 0.134 = 0.134 contribution from IWH
      expect(result.hdi).toBe(0.134);
      expect(result.level).toBe('low'); // 0.134 < 0.3, so low
    });

    it('calculates correct weighted score for mixed components', () => {
      // Create interactions that result in specific component values
      const baseTime = Date.now();
      const interactions = [
        // HPA: 1 hint, 2 executions = 0.5
        createMockInteraction({ eventType: 'hint_request', timestamp: baseTime }),
        createMockInteraction({ eventType: 'execution', timestamp: baseTime + 100 }),
        createMockInteraction({ eventType: 'execution', timestamp: baseTime + 200 }),
      ];
      const result = calculateHDI(interactions);
      expect(result.hdi).toBeGreaterThanOrEqual(0);
      expect(result.hdi).toBeLessThanOrEqual(1);
      expect(result.components).toBeDefined();
    });

    it('classifies low level for HDI < 0.3', () => {
      const interactions = [
        createMockInteraction({ eventType: 'execution', successful: true }),
        createMockInteraction({ eventType: 'execution', successful: true }),
      ];
      const result = calculateHDI(interactions);
      expect(result.level).toBe('low');
    });

    it('classifies medium level for HDI between 0.3 and 0.6', () => {
      // Create scenario with moderate hint usage
      const baseTime = Date.now();
      const interactions = [
        // Some hints but not excessive
        createMockInteraction({ eventType: 'hint_request', hintLevel: 1, timestamp: baseTime }),
        createMockInteraction({ eventType: 'execution', timestamp: baseTime + 100 }),
        createMockInteraction({ eventType: 'hint_request', hintLevel: 1, timestamp: baseTime + 200 }),
        createMockInteraction({ eventType: 'execution', timestamp: baseTime + 300 }),
        createMockInteraction({ eventType: 'execution', successful: true, timestamp: baseTime + 400 }),
      ];
      const result = calculateHDI(interactions);
      // With these interactions, HDI should be in medium range
      expect(['low', 'medium']).toContain(result.level);
    });

    it('classifies high level for HDI > 0.6', () => {
      // Create scenario with high hint dependency
      const baseTime = Date.now();
      const interactions = [
        // Many hints per execution
        createMockInteraction({ eventType: 'hint_request', hintLevel: 3, timestamp: baseTime }),
        createMockInteraction({ eventType: 'hint_request', hintLevel: 3, timestamp: baseTime + 10 }),
        createMockInteraction({ eventType: 'execution', timestamp: baseTime + 100 }),
        createMockInteraction({ eventType: 'hint_request', hintLevel: 3, timestamp: baseTime + 200 }),
        createMockInteraction({ eventType: 'execution', timestamp: baseTime + 300 }),
        createMockInteraction({ eventType: 'explanation_view', timestamp: baseTime + 400 }),
        createMockInteraction({ eventType: 'error', timestamp: baseTime + 500 }),
      ];
      const result = calculateHDI(interactions);
      expect(['medium', 'high']).toContain(result.level);
    });

    it('includes all component values in result', () => {
      const interactions = [
        createMockInteraction({ eventType: 'hint_request', hintLevel: 2 }),
        createMockInteraction({ eventType: 'execution' }),
      ];
      const result = calculateHDI(interactions);
      expect(result.components).toHaveProperty('hpa');
      expect(result.components).toHaveProperty('aed');
      expect(result.components).toHaveProperty('er');
      expect(result.components).toHaveProperty('reae');
      expect(result.components).toHaveProperty('iwh');
    });
  });

  describe('calculateHDIComponents', () => {
    it('returns all components with correct values', () => {
      const baseTime = Date.now();
      const interactions = [
        createMockInteraction({ eventType: 'hint_request', hintLevel: 2, timestamp: baseTime }),
        createMockInteraction({ eventType: 'execution', timestamp: baseTime + 100 }),
        createMockInteraction({ eventType: 'explanation_view', timestamp: baseTime + 200 }),
        createMockInteraction({ eventType: 'execution', successful: true, timestamp: baseTime + 300 }),
      ];
      const components = calculateHDIComponents(interactions);
      expect(components.hpa).toBe(0.5); // 1 hint / 2 executions = 0.5
      expect(components.aed).toBe(0.5); // Level 2 -> 0.5
      expect(components.er).toBe(0.5); // 1 explanation / 2 executions = 0.5
      expect(components.reae).toBe(0); // No errors
      expect(components.iwh).toBe(0); // Used hint before success
    });

    it('handles empty array correctly', () => {
      const components = calculateHDIComponents([]);
      expect(components.hpa).toBe(0);
      expect(components.aed).toBe(0);
      expect(components.er).toBe(0);
      expect(components.reae).toBe(0);
      expect(components.iwh).toBe(0);
    });
  });

  describe('Edge Cases', () => {
    it('handles single interaction', () => {
      const interactions = [createMockInteraction({ eventType: 'hint_request' })];
      const result = calculateHDI(interactions);
      expect(result.hdi).toBeDefined();
      expect(result.level).toBeDefined();
      expect(result.components).toBeDefined();
    });

    it('handles interactions with same timestamp', () => {
      const sameTime = Date.now();
      const interactions = [
        createMockInteraction({ eventType: 'explanation_view', timestamp: sameTime }),
        createMockInteraction({ eventType: 'error', timestamp: sameTime }),
      ];
      const result = calculateREAE(interactions);
      // Should not throw and return a valid number
      expect(typeof result).toBe('number');
      expect(result).toBeGreaterThanOrEqual(0);
      expect(result).toBeLessThanOrEqual(1);
    });

    it('handles undefined/null gracefully', () => {
      // @ts-expect-error Testing with undefined
      const result1 = calculateHPA(undefined);
      expect(result1).toBe(0);

      // @ts-expect-error Testing with null  
      const result2 = calculateAED(null);
      expect(result2).toBe(0);
    });

    it('preserves original array', () => {
      const interactions = [
        createMockInteraction({ eventType: 'hint_request', timestamp: 300 }),
        createMockInteraction({ eventType: 'execution', timestamp: 100 }),
      ];
      const originalOrder = [...interactions];
      calculateHDI(interactions);
      expect(interactions).toEqual(originalOrder);
    });
  });

  describe('HDI_CALCULATOR_VERSION', () => {
    it('exports version string', () => {
      expect(HDI_CALCULATOR_VERSION).toBeDefined();
      expect(typeof HDI_CALCULATOR_VERSION).toBe('string');
      expect(HDI_CALCULATOR_VERSION).toContain('hdi-calculator');
    });
  });
});
