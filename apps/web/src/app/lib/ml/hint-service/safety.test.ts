import { describe, expect, it } from 'vitest';
import { applyHintSafetyLayer } from './safety';

describe('applyHintSafetyLayer answer-leak check', () => {
  it('blocks a real query', () => {
    const r = applyHintSafetyLayer('Try SELECT name FROM employees WHERE salary > 1000', 2, 'x');
    expect(r.fallbackReason).toBe('answer_leak_blocked');
  });

  it('blocks a query with a function and a list', () => {
    const r = applyHintSafetyLayer('Use SELECT id, UPPER(name) FROM employees', 3, 'x');
    expect(r.fallbackReason).toBe('answer_leak_blocked');
  });

  it('allows a hint that names the function without a full query', () => {
    const r = applyHintSafetyLayer(
      'Look for a text function that changes letters to capitals, then apply it to the name column.',
      3,
      'x'
    );
    expect(r.fallbackReason).toBeNull();
  });

  it('allows plain prose that uses the words select and from', () => {
    const r = applyHintSafetyLayer('You need to select the right column from the employees table.', 2, 'x');
    expect(r.fallbackReason).toBeNull();
  });

  it('allows partial patterns with placeholders', () => {
    const r = applyHintSafetyLayer('Try SELECT ___(name) FROM employees', 3, 'x');
    expect(r.fallbackReason).toBeNull();
  });
});
