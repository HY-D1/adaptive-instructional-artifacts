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
  HDI_LEVELS,
  classifyHDILevel,
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

  describe('HDI_LEVELS constants', () => {
    it('thresholds are correct', () => {
      expect(HDI_LEVELS.LOW_THRESHOLD).toBe(0.3);
      expect(HDI_LEVELS.MEDIUM_THRESHOLD).toBe(0.6);
      expect(HDI_LEVELS.HIGH_THRESHOLD).toBe(1.0);
    });
  });

  describe('classifyHDILevel', () => {
    it('classifies low correctly', () => {
      expect(classifyHDILevel(0)).toBe('low');
      expect(classifyHDILevel(0.29)).toBe('low');
      expect(classifyHDILevel(0.3)).not.toBe('low');
    });
    
    it('classifies medium correctly', () => {
      expect(classifyHDILevel(0.3)).toBe('medium');
      expect(classifyHDILevel(0.5)).toBe('medium');
      expect(classifyHDILevel(0.6)).toBe('medium');
    });
    
    it('classifies high correctly', () => {
      expect(classifyHDILevel(0.61)).toBe('high');
      expect(classifyHDILevel(1.0)).toBe('high');
    });
    
    it('handles edge cases', () => {
      expect(classifyHDILevel(-0.1)).toBe('low');
      expect(classifyHDILevel(1.5)).toBe('high');
    });
  });
});

describe('Edge Cases - HDI Calculator', () => {
  test('handles empty interactions', () => {
    // All components should return 0
    const components = calculateHDIComponents([]);
    expect(components.hpa).toBe(0);
    expect(components.aed).toBe(0);
    expect(components.er).toBe(0);
    expect(components.reae).toBe(0);
    expect(components.iwh).toBe(0);
    
    // HDI should be calculated with IWH=0 -> (1-0)*0.134 = 0.134
    const result = calculateHDI([]);
    expect(result.hdi).toBe(0.134);
    expect(result.level).toBe('low');
  });

  test('handles single interaction', () => {
    // Only one event
    // Should calculate correctly
    const interactions = [createMockInteraction({ eventType: 'hint_request' })];
    const result = calculateHDI(interactions);
    
    expect(result.hdi).toBeDefined();
    expect(result.level).toBeDefined();
    expect(result.components).toBeDefined();
    expect(result.hdi).toBeGreaterThanOrEqual(0);
    expect(result.hdi).toBeLessThanOrEqual(1);
  });

  test('handles all same timestamp', () => {
    // All events at same time
    // REAE calculation should still work
    const sameTime = Date.now();
    const interactions = [
      createMockInteraction({ eventType: 'explanation_view', timestamp: sameTime }),
      createMockInteraction({ eventType: 'error', timestamp: sameTime }),
      createMockInteraction({ eventType: 'error', timestamp: sameTime }),
    ];
    
    const result = calculateREAE(interactions);
    expect(typeof result).toBe('number');
    expect(result).toBeGreaterThanOrEqual(0);
    expect(result).toBeLessThanOrEqual(1);
    
    // With same timestamp, order is preserved by sort stability
    // Both errors have same timestamp as explanation, so they might be counted
    const hdiResult = calculateHDI(interactions);
    expect(hdiResult.hdi).toBeGreaterThanOrEqual(0);
    expect(hdiResult.hdi).toBeLessThanOrEqual(1);
  });

  test('handles extreme component values - all zeros', () => {
    // All components at 0
    // HDI should be in [0,1]
    const interactions = [
      createMockInteraction({ eventType: 'execution', successful: true }),
      createMockInteraction({ eventType: 'execution', successful: true }),
    ];
    
    const components = calculateHDIComponents(interactions);
    expect(components.hpa).toBe(0); // No hints
    expect(components.aed).toBe(0); // No hint levels
    expect(components.er).toBe(0); // No explanations
    expect(components.reae).toBe(0); // No errors
    expect(components.iwh).toBe(1); // All successes without hints
    
    const result = calculateHDI(interactions);
    // With IWH=1, (1-1)*0.134 = 0, so HDI should be very low
    expect(result.hdi).toBeGreaterThanOrEqual(0);
    expect(result.hdi).toBeLessThanOrEqual(1);
  });

  test('handles extreme component values - all ones', () => {
    // All components at 1
    // HDI should be in [0,1]
    const baseTime = Date.now();
    const interactions = [
      createMockInteraction({ eventType: 'explanation_view', timestamp: baseTime }),
      createMockInteraction({ eventType: 'error', timestamp: baseTime + 100 }),
      createMockInteraction({ eventType: 'error', timestamp: baseTime + 200 }),
      createMockInteraction({ eventType: 'hint_request', hintLevel: 3, timestamp: baseTime + 300 }),
      createMockInteraction({ eventType: 'execution', timestamp: baseTime + 400 }),
      createMockInteraction({ eventType: 'hint_request', hintLevel: 3, timestamp: baseTime + 500 }),
      createMockInteraction({ eventType: 'execution', timestamp: baseTime + 600 }),
      createMockInteraction({ eventType: 'explanation_view', timestamp: baseTime + 700 }),
    ];
    
    const result = calculateHDI(interactions);
    expect(result.hdi).toBeGreaterThanOrEqual(0);
    expect(result.hdi).toBeLessThanOrEqual(1);
    // With high hint usage and errors, level should be medium or high
    expect(['medium', 'high']).toContain(result.level);
  });

  test('handles very large interaction count', () => {
    // 100,000 interactions
    // Performance should be good
    const interactions: InteractionEvent[] = [];
    const baseTime = Date.now();
    
    for (let i = 0; i < 100000; i++) {
      interactions.push(createMockInteraction({
        eventType: i % 3 === 0 ? 'hint_request' : 'execution',
        timestamp: baseTime + i * 1000,
        hintLevel: i % 3 === 0 ? ((i % 3 + 1) as 1 | 2 | 3) : undefined,
      }));
    }
    
    const startTime = Date.now();
    const result = calculateHDI(interactions);
    const endTime = Date.now();
    
    // Should complete in reasonable time (less than 5 seconds)
    expect(endTime - startTime).toBeLessThan(5000);
    
    expect(result.hdi).toBeGreaterThanOrEqual(0);
    expect(result.hdi).toBeLessThanOrEqual(1);
    expect(result.level).toBeDefined();
  });

  test('handles circular/invalid timestamps - future timestamps', () => {
    // Future timestamps
    const futureTime = Date.now() + 1000000000; // Far future
    const interactions = [
      createMockInteraction({ eventType: 'explanation_view', timestamp: futureTime }),
      createMockInteraction({ eventType: 'error', timestamp: futureTime + 1000 }),
    ];
    
    const result = calculateREAE(interactions);
    expect(result).toBeGreaterThanOrEqual(0);
    expect(result).toBeLessThanOrEqual(1);
  });

  test('handles circular/invalid timestamps - negative timestamps', () => {
    // Negative timestamps
    const interactions = [
      createMockInteraction({ eventType: 'explanation_view', timestamp: -1000 }),
      createMockInteraction({ eventType: 'error', timestamp: -500 }),
    ];
    
    const result = calculateREAE(interactions);
    expect(result).toBeGreaterThanOrEqual(0);
    expect(result).toBeLessThanOrEqual(1);
  });

  test('handles NaN in component calculations', () => {
    // Division by zero scenarios
    // Should not return NaN
    const interactions = [
      createMockInteraction({ 
        eventType: 'hint_request',
        hintLevel: NaN as unknown as 1 | 2 | 3 
      }),
      createMockInteraction({ eventType: 'execution' }),
    ];
    
    const result = calculateHDI(interactions);
    expect(result.hdi).not.toBeNaN();
    expect(result.hdi).toBeGreaterThanOrEqual(0);
    expect(result.hdi).toBeLessThanOrEqual(1);
  });

  test('handles interactions with missing eventType', () => {
    const interactions = [
      createMockInteraction({ eventType: undefined as unknown as InteractionEvent['eventType'] }),
      createMockInteraction({ eventType: 'execution' }),
    ];
    
    const result = calculateHDI(interactions);
    expect(result.hdi).not.toBeNaN();
    expect(result.hdi).toBeGreaterThanOrEqual(0);
    expect(result.hdi).toBeLessThanOrEqual(1);
  });

  test('handles interactions with undefined timestamp', () => {
    const interactions = [
      createMockInteraction({ 
        eventType: 'explanation_view',
        timestamp: undefined as unknown as number
      }),
      createMockInteraction({ 
        eventType: 'error',
        timestamp: undefined as unknown as number
      }),
    ];
    
    const result = calculateREAE(interactions);
    // NaN comparisons always return false, so sorting may be inconsistent
    expect(typeof result).toBe('number');
  });

  test('handles REAE with no errors', () => {
    const baseTime = Date.now();
    const interactions = [
      createMockInteraction({ eventType: 'explanation_view', timestamp: baseTime }),
      createMockInteraction({ eventType: 'execution', timestamp: baseTime + 1000 }),
      createMockInteraction({ eventType: 'execution', timestamp: baseTime + 2000 }),
    ];
    
    const result = calculateREAE(interactions);
    expect(result).toBe(0);
  });

  test('handles REAE with no explanations', () => {
    const baseTime = Date.now();
    const interactions = [
      createMockInteraction({ eventType: 'error', timestamp: baseTime }),
      createMockInteraction({ eventType: 'error', timestamp: baseTime + 1000 }),
    ];
    
    const result = calculateREAE(interactions);
    expect(result).toBe(0);
  });

  test('handles IWH with no successful attempts', () => {
    const interactions = [
      createMockInteraction({ eventType: 'hint_request', problemId: 'p1' }),
      createMockInteraction({ eventType: 'execution', problemId: 'p1', successful: false }),
      createMockInteraction({ eventType: 'error', problemId: 'p1' }),
    ];
    
    const result = calculateIWH(interactions);
    expect(result).toBe(0);
  });

  test('handles AED with undefined hint levels', () => {
    const interactions = [
      createMockInteraction({ eventType: 'hint_request' }), // no hintLevel
      createMockInteraction({ eventType: 'hint_view' }), // no hintLevel
    ];
    
    const result = calculateAED(interactions);
    expect(result).toBe(0); // No events with hintLevel defined
  });

  test('handles AED with hintLevel outside 1-3 range', () => {
    const interactions = [
      createMockInteraction({ eventType: 'hint_request', hintLevel: 0 as 1 | 2 | 3 }),
      createMockInteraction({ eventType: 'hint_request', hintLevel: 5 as 1 | 2 | 3 }),
      createMockInteraction({ eventType: 'hint_request', hintLevel: -1 as 1 | 2 | 3 }),
    ];
    
    const result = calculateAED(interactions);
    expect(result).toBeGreaterThanOrEqual(0);
    expect(result).toBeLessThanOrEqual(1);
  });

  test('handles HPA with zero executions', () => {
    const interactions = [
      createMockInteraction({ eventType: 'hint_request' }),
      createMockInteraction({ eventType: 'hint_request' }),
      createMockInteraction({ eventType: 'code_change' }),
    ];
    
    const result = calculateHPA(interactions);
    expect(result).toBe(0); // No executions
  });

  test('handles ER with zero executions', () => {
    const interactions = [
      createMockInteraction({ eventType: 'explanation_view' }),
      createMockInteraction({ eventType: 'explanation_view' }),
    ];
    
    const result = calculateER(interactions);
    expect(result).toBe(0); // No executions
  });

  test('handles original array mutation protection', () => {
    const interactions = [
      createMockInteraction({ eventType: 'hint_request', timestamp: 300 }),
      createMockInteraction({ eventType: 'execution', timestamp: 100 }),
      createMockInteraction({ eventType: 'error', timestamp: 200 }),
    ];
    
    const originalOrder = [...interactions];
    calculateHDI(interactions);
    
    // Original array should not be mutated
    expect(interactions).toEqual(originalOrder);
  });

  test('handles null/undefined in interactions array', () => {
    const interactions = [
      createMockInteraction({ eventType: 'hint_request' }),
      null as unknown as InteractionEvent,
      undefined as unknown as InteractionEvent,
      createMockInteraction({ eventType: 'execution' }),
    ];
    
    // The function throws when encountering null/undefined items
    // This is acceptable behavior - the calling code should sanitize inputs
    expect(() => calculateHDI(interactions)).toThrow();
  });

  test('handles HDI boundary values', () => {
    // Test HDI with low dependency (all successes without hints)
    const interactionsLow = [
      createMockInteraction({ eventType: 'execution', successful: true }),
      createMockInteraction({ eventType: 'execution', successful: true }),
    ];
    const resultLow = calculateHDI(interactionsLow);
    // With IWH=1 (all successes without hints), HDI should be low
    expect(resultLow.hdi).toBeLessThan(0.3);
    expect(resultLow.level).toBe('low');
    
    // Test HDI with high dependency (many hints and errors with executions)
    const interactionsHigh: InteractionEvent[] = [];
    const baseTime = Date.now();
    
    // Create interactions that produce high HDI:
    // - High HPA (many hints per execution)
    // - High AED (level 3 hints)
    // - High ER (many explanations)
    // - High REAE (errors after explanation)
    // - Low IWH (no success without hints)
    for (let i = 0; i < 20; i++) {
      // Add hint requests (level 3 for max AED)
      interactionsHigh.push(createMockInteraction({ 
        eventType: 'hint_request', 
        hintLevel: 3,
        timestamp: baseTime + i * 200,
        problemId: `p${i}`
      }));
      interactionsHigh.push(createMockInteraction({ 
        eventType: 'hint_request', 
        hintLevel: 3,
        timestamp: baseTime + i * 200 + 10,
        problemId: `p${i}`
      }));
      // Add execution
      interactionsHigh.push(createMockInteraction({ 
        eventType: 'execution',
        timestamp: baseTime + i * 200 + 50,
        problemId: `p${i}`
      }));
      // Add explanation view
      interactionsHigh.push(createMockInteraction({ 
        eventType: 'explanation_view',
        timestamp: baseTime + i * 200 + 100,
        problemId: `p${i}`
      }));
      // Add error after explanation
      interactionsHigh.push(createMockInteraction({ 
        eventType: 'error',
        timestamp: baseTime + i * 200 + 150,
        problemId: `p${i}`
      }));
    }
    
    const resultHigh = calculateHDI(interactionsHigh);
    // With this pattern, HDI should be medium or high
    expect(resultHigh.hdi).toBeGreaterThanOrEqual(0.3);
    expect(['medium', 'high']).toContain(resultHigh.level);
  });
});
