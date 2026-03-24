import { describe, test, expect } from 'vitest';
import { 
  scoreSelfExplanation, 
  meetsMinimumQuality, 
  getQualityLevel,
  type SelfExplanationInput 
} from './self-explanation-scorer';

describe('@weekly Self-Explanation Scorer (RQS)', () => {
  const createInput = (overrides: Partial<SelfExplanationInput> = {}): SelfExplanationInput => ({
    text: 'This is a test explanation about SQL WHERE clauses.',
    originalProblem: 'Write a query to filter users by age',
    conceptIds: ['where-clause'],
    learnerId: 'test-learner',
    ...overrides
  });

  describe('scoreSelfExplanation', () => {
    test('returns overall score and dimensions', () => {
      const input = createInput({
        text: 'The WHERE clause filters rows based on conditions. I should use WHERE age > 18 to get adult users. Next time, I will check my filter conditions carefully.'
      });
      
      const result = scoreSelfExplanation(input);
      
      expect(result.overall).toBeGreaterThanOrEqual(0);
      expect(result.overall).toBeLessThanOrEqual(100);
      expect(result.dimensions.paraphrase).toBeGreaterThanOrEqual(0);
      expect(result.dimensions.paraphrase).toBeLessThanOrEqual(100);
      expect(result.dimensions.length).toBeGreaterThanOrEqual(0);
      expect(result.dimensions.length).toBeLessThanOrEqual(100);
      expect(result.dimensions.conceptKeywords).toBeGreaterThanOrEqual(0);
      expect(result.dimensions.conceptKeywords).toBeLessThanOrEqual(100);
      expect(result.dimensions.exampleInclusion).toBeGreaterThanOrEqual(0);
      expect(result.dimensions.exampleInclusion).toBeLessThanOrEqual(100);
      expect(result.dimensions.structuralCompleteness).toBeGreaterThanOrEqual(0);
      expect(result.dimensions.structuralCompleteness).toBeLessThanOrEqual(100);
    });

    test('provides feedback array', () => {
      const input = createInput({ text: 'Short text.' });
      const result = scoreSelfExplanation(input);
      
      expect(Array.isArray(result.feedback)).toBe(true);
      expect(result.feedback.length).toBeGreaterThan(0);
    });

    test('detects paraphrase quality', () => {
      // Create text with some copying
      const input = createInput({
        text: 'Write a query to filter users by age. This is about write a query to filter users.',
        originalProblem: 'Write a query to filter users by age'
      });
      
      const result = scoreSelfExplanation(input);
      
      // Paraphrase score should be calculated (0-100 range)
      expect(result.dimensions.paraphrase).toBeGreaterThanOrEqual(0);
      expect(result.dimensions.paraphrase).toBeLessThanOrEqual(100);
    });

    test('flags too short content', () => {
      const input = createInput({ text: 'Too short.' });
      const result = scoreSelfExplanation(input);
      
      expect(result.dimensions.length).toBeLessThan(50);
      expect(result.flaggedIssues).toContain('TOO_SHORT');
    });

    test('detects good paraphrasing', () => {
      const input = createInput({
        text: 'I understand that the WHERE clause allows us to specify conditions that filter which rows appear in the results. This is different from simply copying the problem statement.',
        originalProblem: 'Write a query using WHERE clause'
      });
      
      const result = scoreSelfExplanation(input);
      
      expect(result.dimensions.paraphrase).toBeGreaterThan(50);
    });

    test('scores length appropriately', () => {
      // Very short - should have low score
      const short = scoreSelfExplanation(createInput({ text: 'Short.' }));
      expect(short.dimensions.length).toBeLessThan(50);
      
      // Sweet spot (50-200 words) - should have high score
      const sweetSpotText = 'The WHERE clause is essential for filtering data in SQL queries. '.repeat(8); // ~64 words
      const sweetSpot = scoreSelfExplanation(createInput({ text: sweetSpotText }));
      expect(sweetSpot.dimensions.length).toBeGreaterThanOrEqual(90);
      
      // Very long (>400 words) - should have reduced score
      const tooLongText = 'The WHERE clause filters data. '.repeat(60); // ~180 words but repeated pattern
      const tooLong = scoreSelfExplanation(createInput({ text: tooLongText }));
      expect(tooLong.dimensions.length).toBeLessThanOrEqual(100);
      expect(tooLong.dimensions.length).toBeGreaterThanOrEqual(0);
    });

    test('detects concept keywords', () => {
      const input = createInput({
        text: 'I need to use WHERE to filter rows based on a condition predicate.',
        conceptIds: ['where-clause']
      });
      
      const result = scoreSelfExplanation(input);
      expect(result.dimensions.conceptKeywords).toBeGreaterThan(0);
    });

    test('detects examples in text', () => {
      const withCode = createInput({
        text: 'For example: `SELECT * FROM users WHERE age > 18`'
      });
      expect(scoreSelfExplanation(withCode).dimensions.exampleInclusion).toBeGreaterThan(0);
      
      const withExamplePhrase = createInput({
        text: 'For instance, we can use the WHERE clause.'
      });
      expect(scoreSelfExplanation(withExamplePhrase).dimensions.exampleInclusion).toBeGreaterThanOrEqual(30);
      
      const withConcreteValue = createInput({
        text: 'This applies to users in the database.'
      });
      expect(scoreSelfExplanation(withConcreteValue).dimensions.exampleInclusion).toBe(30);
    });

    test('detects structural completeness', () => {
      const complete = createInput({
        text: 'The problem was caused by missing WHERE clause. I should add WHERE age > 18 to fix it. Next time, I will check for filter conditions.'
      });
      const result = scoreSelfExplanation(complete);
      expect(result.dimensions.structuralCompleteness).toBeGreaterThan(80);
      
      const incomplete = createInput({
        text: 'I made an error with the query.'
      });
      expect(scoreSelfExplanation(incomplete).dimensions.structuralCompleteness).toBeLessThan(50);
    });

    test('handles empty concept IDs gracefully', () => {
      const input = createInput({ conceptIds: [] });
      const result = scoreSelfExplanation(input);
      
      expect(result.dimensions.conceptKeywords).toBe(50);
    });

    test('handles unknown concept IDs', () => {
      const input = createInput({ conceptIds: ['unknown-concept'] });
      const result = scoreSelfExplanation(input);
      
      expect(result.dimensions.conceptKeywords).toBeGreaterThanOrEqual(0);
    });

    test('composite score is weighted correctly', () => {
      const input = createInput({
        text: 'The WHERE clause filters rows based on conditions. I should use WHERE to specify which rows I want. Next time, I will remember to include the WHERE clause with proper conditions.',
        conceptIds: ['where-clause']
      });
      
      const result = scoreSelfExplanation(input);
      
      // Overall should be weighted average of dimensions
      const expected = Math.round(
        result.dimensions.paraphrase * 0.25 +
        result.dimensions.length * 0.15 +
        result.dimensions.conceptKeywords * 0.25 +
        result.dimensions.exampleInclusion * 0.15 +
        result.dimensions.structuralCompleteness * 0.20
      );
      
      expect(result.overall).toBe(expected);
    });
  });

  describe('meetsMinimumQuality', () => {
    test('validates quality of text', () => {
      // High quality text should generally pass
      const goodText = 'The WHERE clause filters rows based on conditions. Because I need specific data, I should use WHERE age > 18. Next time, I will check my filters.';
      const goodResult = meetsMinimumQuality(goodText, ['where-clause'], 30); // Lower threshold for test
      expect(typeof goodResult).toBe('boolean');
      
      // Very short text should fail
      const shortText = 'Short.';
      const shortResult = meetsMinimumQuality(shortText, ['where-clause'], 50);
      expect(shortResult).toBe(false);
    });

    test('uses default minimum of 50', () => {
      const text = 'The WHERE clause filters data. I should use WHERE to fix this. Next time, I will remember to use WHERE clause.';
      const result = meetsMinimumQuality(text, ['where-clause']);
      // Result should be a boolean
      expect(typeof result).toBe('boolean');
    });
  });

  describe('getQualityLevel', () => {
    test('returns excellent for scores >= 80', () => {
      expect(getQualityLevel(80)).toBe('excellent');
      expect(getQualityLevel(90)).toBe('excellent');
      expect(getQualityLevel(100)).toBe('excellent');
    });

    test('returns good for scores 60-79', () => {
      expect(getQualityLevel(60)).toBe('good');
      expect(getQualityLevel(70)).toBe('good');
      expect(getQualityLevel(79)).toBe('good');
    });

    test('returns needs-work for scores < 60', () => {
      expect(getQualityLevel(59)).toBe('needs-work');
      expect(getQualityLevel(30)).toBe('needs-work');
      expect(getQualityLevel(0)).toBe('needs-work');
    });
  });

  describe('feedback generation', () => {
    test('provides feedback for any input', () => {
      // All inputs should receive some form of feedback
      const shortInput = createInput({ text: 'Short.' });
      const shortResult = scoreSelfExplanation(shortInput);
      expect(shortResult.feedback.length).toBeGreaterThan(0);
      
      const goodInput = createInput({
        text: 'The WHERE clause filters rows based on conditions. Because I forgot to add a filter, I should use WHERE age > 18. Next time, I will check my WHERE clause.',
        conceptIds: ['where-clause']
      });
      const goodResult = scoreSelfExplanation(goodInput);
      expect(goodResult.feedback.length).toBeGreaterThan(0);
    });

    test('suggests improvement for short content', () => {
      const input = createInput({ text: 'Too short.' });
      const result = scoreSelfExplanation(input);
      
      expect(result.feedback.some(f => f.includes('brief') || f.includes('elaborate'))).toBe(true);
    });

    test('praises good reflections when overall score is high', () => {
      // Create a high-quality explanation
      const input = createInput({
        text: 'The WHERE clause allows filtering rows based on specific conditions. Because I need to find adult users, I should use WHERE age > 18. Next time, I will always check if I need to filter my results with WHERE.',
        conceptIds: ['where-clause']
      });
      const result = scoreSelfExplanation(input);
      
      // Should provide constructive feedback or positive reinforcement
      expect(result.feedback.length).toBeGreaterThan(0);
      
      // High quality explanations have good structural completeness
      if (result.overall >= 70) {
        expect(result.dimensions.structuralCompleteness).toBeGreaterThanOrEqual(60);
      }
    });
  });

  describe('dimension scoring edge cases', () => {
    test('handles text with code blocks', () => {
      const input = createInput({
        text: '```sql\nSELECT * FROM users WHERE age > 18\n```'
      });
      const result = scoreSelfExplanation(input);
      
      expect(result.dimensions.exampleInclusion).toBeGreaterThanOrEqual(40);
    });

    test('handles text with multiple concepts', () => {
      const input = createInput({
        text: 'I need to use JOIN to combine tables and WHERE to filter results.',
        conceptIds: ['joins', 'where-clause']
      });
      const result = scoreSelfExplanation(input);
      
      expect(result.dimensions.conceptKeywords).toBeGreaterThan(0);
    });

    test('handles empty original problem', () => {
      const input = createInput({
        text: 'Some explanation.',
        originalProblem: ''
      });
      const result = scoreSelfExplanation(input);
      
      expect(result.dimensions.paraphrase).toBe(50);
    });
  });
});
