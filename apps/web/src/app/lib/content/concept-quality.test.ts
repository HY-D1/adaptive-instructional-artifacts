/**
 * Regression tests for concept content quality checks.
 *
 * Covers:
 * 1. isExplanationGarbled — detects garbled extraction output
 * 2. isExampleSqlSane — validates SQL code examples
 * 3. filterSaneExamples — filters contaminated blocks
 * 4. assessConceptQuality — end-to-end quality assessment
 */

import { describe, it, expect } from 'vitest';
import {
  isExplanationGarbled,
  isExampleSqlSane,
  filterSaneExamples,
  assessConceptQuality,
  type LoadedConcept,
  type CodeExample,
} from './concept-loader';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeLoadedConcept(overrides: {
  explanation?: string;
  definition?: string;
  examples?: CodeExample[];
}): LoadedConcept {
  return {
    id: 'test-concept',
    title: 'Test Concept',
    definition: overrides.definition ?? 'A short definition.',
    difficulty: 'beginner',
    estimatedReadTime: 5,
    pageNumbers: [45],
    chunkIds: { definition: [], examples: [], commonMistakes: [] },
    relatedConcepts: [],
    practiceProblemIds: [],
    content: {
      definition: overrides.definition ?? 'A short definition.',
      explanation: overrides.explanation ?? 'A well-formed explanation.',
      examples: overrides.examples ?? [],
      commonMistakes: [],
    },
  };
}

function makeExample(code: string, title = 'Example'): CodeExample {
  return { title, code, explanation: 'Some explanation.' };
}

// ---------------------------------------------------------------------------
// isExplanationGarbled
// ---------------------------------------------------------------------------

describe('isExplanationGarbled', () => {
  it('returns false for empty string', () => {
    expect(isExplanationGarbled('')).toBe(false);
  });

  it('returns false for short well-formed text', () => {
    expect(isExplanationGarbled('A SELECT statement retrieves rows from a table.')).toBe(false);
  });

  it('returns false for a normal paragraph explanation', () => {
    const good = `
The SELECT statement is used to query the database. You can retrieve specific columns
by listing them after SELECT. Use the FROM clause to specify the table. The WHERE clause
filters the results. Aggregates like COUNT and SUM work with GROUP BY.
    `.trim();
    expect(isExplanationGarbled(good)).toBe(false);
  });

  it('returns true for very long text with almost no sentence-ending punctuation', () => {
    // Simulate raw pdftotext dump: lots of words, few periods
    const dump = 'word '.repeat(700); // 3500 chars, zero punctuation
    expect(isExplanationGarbled(dump)).toBe(true);
  });

  it('returns true for text with high density of unrendered Markdown headers', () => {
    const markdown = Array.from({ length: 10 }, (_, i) => `## Section ${i}\nsome text`).join('\n');
    expect(isExplanationGarbled(markdown)).toBe(true);
  });

  it('returns true for text containing a form-feed character (pdftotext page break)', () => {
    const text = 'Normal content.\x0cMore content on next page.';
    expect(isExplanationGarbled(text)).toBe(true);
  });

  it('returns true for text with CHAPTER extraction artefact', () => {
    const text = 'CHAPTER 5\nContent about SELECT.';
    expect(isExplanationGarbled(text)).toBe(true);
  });

  it('returns false for text with some markdown that is not dense enough to trigger', () => {
    // Two headers in a 20-line text is below the 30% threshold
    const text = [
      '## Introduction',
      'SQL SELECT statements retrieve data.',
      'You can filter using WHERE.',
      'Aggregates count rows.',
      'Joins combine tables.',
      '## Summary',
      'This covers the basics of SELECT.',
      'Practice makes perfect.',
      'Review the examples below.',
      'Use the textbook for more detail.',
    ].join('\n');
    expect(isExplanationGarbled(text)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// isExampleSqlSane
// ---------------------------------------------------------------------------

describe('isExampleSqlSane', () => {
  it('returns false for empty string', () => {
    expect(isExampleSqlSane('')).toBe(false);
  });

  it('returns true for a basic SELECT statement', () => {
    expect(isExampleSqlSane('SELECT id, name FROM users;')).toBe(true);
  });

  it('returns true for INSERT statement', () => {
    expect(isExampleSqlSane('INSERT INTO orders (user_id) VALUES (1);')).toBe(true);
  });

  it('returns true for CREATE TABLE', () => {
    expect(isExampleSqlSane('CREATE TABLE products (id INT PRIMARY KEY);')).toBe(true);
  });

  it('returns false for pure prose (no SQL keywords)', () => {
    expect(isExampleSqlSane('This is a description of how relational databases work.')).toBe(false);
  });

  it('returns false for an HTML snippet without SQL keywords', () => {
    expect(isExampleSqlSane('<div class="container"><p>Some text</p></div>')).toBe(false);
  });

  it('is case-insensitive for SQL keywords', () => {
    expect(isExampleSqlSane('select * from orders where id = 1')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// filterSaneExamples
// ---------------------------------------------------------------------------

describe('filterSaneExamples', () => {
  it('returns all examples when all pass SQL check', () => {
    const examples = [
      makeExample('SELECT * FROM users;'),
      makeExample('INSERT INTO orders VALUES (1, 2);'),
    ];
    expect(filterSaneExamples(examples)).toHaveLength(2);
  });

  it('removes examples that contain no SQL keywords', () => {
    const examples = [
      makeExample('SELECT name FROM students;'),
      makeExample('This is garbled text about database concepts and relational theory.'),
      makeExample('Another prose block about normalization and primary keys.'),
    ];
    const result = filterSaneExamples(examples);
    expect(result).toHaveLength(1);
    expect(result[0].code).toContain('SELECT');
  });

  it('returns empty array when all examples are contaminated', () => {
    const examples = [
      makeExample('Garbled explanation text.'),
      makeExample('More export noise without keywords.'),
    ];
    expect(filterSaneExamples(examples)).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// assessConceptQuality
// ---------------------------------------------------------------------------

describe('assessConceptQuality', () => {
  it('returns "good" when explanation is clean and examples are valid SQL', () => {
    const concept = makeLoadedConcept({
      explanation: 'The SELECT statement retrieves rows from a table.',
      examples: [makeExample('SELECT * FROM products;')],
    });
    expect(assessConceptQuality(concept)).toBe('good');
  });

  it('returns "good" when there are no examples (no contamination possible)', () => {
    const concept = makeLoadedConcept({
      explanation: 'The SELECT statement retrieves rows.',
      examples: [],
    });
    expect(assessConceptQuality(concept)).toBe('good');
  });

  it('returns "fallback" when explanation is garbled', () => {
    const garbled = 'word '.repeat(700); // triggers long-text / low-punctuation heuristic
    const concept = makeLoadedConcept({ explanation: garbled });
    expect(assessConceptQuality(concept)).toBe('fallback');
  });

  it('returns "fallback" when all examples fail SQL sanity check', () => {
    const concept = makeLoadedConcept({
      explanation: 'A reasonable explanation about the SELECT statement.',
      examples: [
        makeExample('Garbled prose without any SQL keywords at all.'),
        makeExample('More noise about database concepts and normalization theory.'),
      ],
    });
    expect(assessConceptQuality(concept)).toBe('fallback');
  });

  it('returns "good" when some examples are contaminated but at least one is valid', () => {
    // One bad example does not trigger fallback — only ALL bad does
    const concept = makeLoadedConcept({
      explanation: 'Normal explanation.',
      examples: [
        makeExample('SELECT id FROM users;'),
        makeExample('Some garbled text.'),
      ],
    });
    expect(assessConceptQuality(concept)).toBe('good');
  });

  it('returns "fallback" when explanation has CHAPTER artefact', () => {
    const concept = makeLoadedConcept({
      explanation: 'CHAPTER 3\nContent about joins.',
    });
    expect(assessConceptQuality(concept)).toBe('fallback');
  });
});
