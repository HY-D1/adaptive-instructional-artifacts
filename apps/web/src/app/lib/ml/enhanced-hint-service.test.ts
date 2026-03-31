import { describe, expect, it } from 'vitest';
import { applyHintSafetyLayer } from './enhanced-hint-service';

describe('enhanced hint safety layer', () => {
  it('blocks rung-1 hints that include SQL keywords', () => {
    const result = applyHintSafetyLayer('Use SELECT name FROM employees', 1, 'incomplete query');
    expect(result.safetyFilterApplied).toBe(true);
    expect(result.fallbackReason).toBe('rung1_sql_keyword_blocked');
    expect(result.content.toLowerCase()).not.toContain('select');
  });

  it('blocks leaked full-answer SQL patterns', () => {
    const result = applyHintSafetyLayer('Try SELECT name FROM employees WHERE salary > 1000', 2, 'where clause');
    expect(result.safetyFilterApplied).toBe(true);
    expect(result.fallbackReason).toBe('answer_leak_blocked');
    expect(result.content.toLowerCase()).not.toContain('select name from employees');
  });

  it('suppresses front-matter style output', () => {
    const result = applyHintSafetyLayer('## Summary\nCheck your clause order.\n## Key Takeaway\nStart from table source.', 3, 'join');
    expect(result.safetyFilterApplied).toBe(true);
    expect(result.content).not.toContain('## Summary');
    expect(result.content).not.toContain('## Key Takeaway');
  });
});
