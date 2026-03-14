/**
 * Unit tests for Deterministic Textbook Generator
 * 
 * Tests that the deterministic generator produces:
 * - Valid markdown output
 * - All required sections (root cause, fix, example)
 * - Proper source grounding
 * - Consistent output for same inputs (deterministic)
 * - Coverage for at least 10 error subtypes
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  generateDeterministicExplanation,
  generateDeterministicFromBundle,
  hasRichTemplateForSubtype,
  getTemplateStats,
  DeterministicGenerationParams
} from './deterministic-generator';
import { getErrorTemplate, getErrorTemplateIds } from './error-templates';
import { RetrievalBundle } from './retrieval-bundle';
import { 
  canonicalizeSqlEngageSubtype,
  getDeterministicSqlEngageAnchor 
} from '../../data/sql-engage';

describe('Deterministic Textbook Generator', () => {
  describe('Template Coverage', () => {
    it('should have rich templates for at least 10 error subtypes', () => {
      const templateIds = getErrorTemplateIds();
      expect(templateIds.length).toBeGreaterThanOrEqual(10);
    });

    it('should have templates for all major error categories', () => {
      const requiredSubtypes = [
        'incomplete query',
        'undefined column',
        'undefined table',
        'ambiguous reference',
        'incorrect join usage',
        'aggregation misuse',
        'incorrect group by usage',
        'incorrect having clause',
        'wrong positioning',
        'operator misuse'
      ];

      for (const subtype of requiredSubtypes) {
        expect(
          hasRichTemplateForSubtype(subtype),
          `Expected template for ${subtype}`
        ).toBe(true);
      }
    });

    it('should return a generic template for unknown subtypes', () => {
      const template = getErrorTemplate('unknown-subtype-xyz');
      expect(template.subtypeId).toBe('unknown-error');
      expect(template.title).toContain('SQL Error');
      expect(template.fixSteps.length).toBeGreaterThan(0);
    });
  });

  describe('Template Content Structure', () => {
    it('should have complete template structure for each error type', () => {
      const templateIds = getErrorTemplateIds();
      
      for (const id of templateIds) {
        const template = getErrorTemplate(id);
        
        // Check required fields
        expect(template.subtypeId, `Template ${id}: missing subtypeId`).toBeTruthy();
        expect(template.title, `Template ${id}: missing title`).toBeTruthy();
        expect(template.rootCause.summary, `Template ${id}: missing root cause summary`).toBeTruthy();
        expect(template.rootCause.explanation, `Template ${id}: missing root cause explanation`).toBeTruthy();
        expect(template.fixSteps.length, `Template ${id}: missing fix steps`).toBeGreaterThan(0);
        expect(template.examples.length, `Template ${id}: missing examples`).toBeGreaterThan(0);
        expect(template.preventionTips.length, `Template ${id}: missing prevention tips`).toBeGreaterThan(0);
        expect(template.relatedConcepts.length, `Template ${id}: missing related concepts`).toBeGreaterThan(0);
        
        // Check example structure
        const example = template.examples[0];
        expect(example.before, `Template ${id}: example missing before`).toBeTruthy();
        expect(example.after, `Template ${id}: example missing after`).toBeTruthy();
        expect(example.explanation, `Template ${id}: example missing explanation`).toBeTruthy();
      }
    });

    it('should have educationally useful content length', () => {
      const templateIds = getErrorTemplateIds();
      
      for (const id of templateIds) {
        const template = getErrorTemplate(id);
        
        // Root cause explanation should be substantial
        expect(template.rootCause.explanation.length).toBeGreaterThan(50);
        
        // Should have multiple fix steps
        expect(template.fixSteps.length).toBeGreaterThanOrEqual(3);
        
        // Should have at least one example
        expect(template.examples.length).toBeGreaterThanOrEqual(1);
      }
    });
  });

  describe('Deterministic Generation', () => {
    const mockParams: DeterministicGenerationParams = {
      problemId: 'test-problem-1',
      problemTitle: 'Test Problem',
      errorSubtypeId: 'undefined column',
      code: 'SELECT usr_name FROM users;',
      conceptIds: ['select-basic'],
      hintHistory: [
        { hintLevel: 1, hintText: 'Check your column names' }
      ],
      learnerId: 'test-learner',
      sessionId: 'test-session',
      triggerInteractionIds: ['interaction-1']
    };

    it('should generate valid markdown output', async () => {
      const result = await generateDeterministicExplanation(mockParams);
      
      expect(result.unit).toBeDefined();
      expect(result.unit.content).toBeDefined();
      expect(result.unit.contentFormat).toBe('markdown');
      
      // Check for markdown headers
      expect(result.unit.content).toMatch(/^# /m);
      expect(result.unit.content).toMatch(/## /);
    });

    it('should include all required sections', async () => {
      const result = await generateDeterministicExplanation(mockParams);
      const content = result.unit.content;
      
      // Required sections
      expect(content).toMatch(/Problem Context/i);
      expect(content).toMatch(/Understanding the Error/i);
      expect(content).toMatch(/How to Fix It/i);
      expect(content).toMatch(/Corrected Examples/i);
      expect(content).toMatch(/Prevention Tips/i);
      expect(content).toMatch(/Next Steps/i);
    });

    it('should include source grounding information', async () => {
      const result = await generateDeterministicExplanation(mockParams);
      
      // Should reference SQL-Engage
      expect(result.sourceIds.length).toBeGreaterThan(0);
      expect(result.sourceIds.some(id => id.includes('sql-engage'))).toBe(true);
      
      // Content should mention source
      expect(result.unit.content).toMatch(/sql-engage|SQL-Engage/i);
    });

    it('should be deterministic (same input = same output)', async () => {
      const result1 = await generateDeterministicExplanation(mockParams);
      const result2 = await generateDeterministicExplanation(mockParams);
      
      // Hash should be identical
      expect(result1.inputHash).toBe(result2.inputHash);
      
      // Content should be identical
      expect(result1.unit.content).toBe(result2.unit.content);
      expect(result1.unit.title).toBe(result2.unit.title);
    });

    it('should produce different output for different error subtypes', async () => {
      const result1 = await generateDeterministicExplanation({
        ...mockParams,
        errorSubtypeId: 'undefined column'
      });
      
      const result2 = await generateDeterministicExplanation({
        ...mockParams,
        errorSubtypeId: 'incomplete query'
      });
      
      expect(result1.inputHash).not.toBe(result2.inputHash);
      expect(result1.unit.content).not.toBe(result2.unit.content);
    });

    it('should indicate when rich template was used', async () => {
      const result = await generateDeterministicExplanation(mockParams);
      expect(result.usedRichTemplate).toBe(true);
    });

    it('should track generation metadata', async () => {
      const result = await generateDeterministicExplanation(mockParams);
      
      expect(result.metadata.subtypeId).toBe('undefined column');
      expect(result.metadata.templateTitle).toBeTruthy();
      expect(result.metadata.conceptCount).toBeGreaterThan(0);
      expect(result.metadata.generationTimeMs).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Generation from Retrieval Bundle', () => {
    const mockBundle: RetrievalBundle = {
      learnerId: 'test-learner',
      problemId: 'test-problem',
      problemTitle: 'Test Problem',
      schemaText: 'CREATE TABLE users (id INTEGER, name TEXT);',
      lastErrorSubtypeId: 'undefined column',
      hintHistory: [
        {
          hintLevel: 1,
          hintText: 'Check column names',
          interactionId: 'hint-1',
          helpRequestIndex: 1
        }
      ],
      sqlEngageAnchor: {
        rowId: 'sql-engage:123',
        error_subtype: 'undefined column',
        feedback_target: 'Verify column exists',
        intended_learning_outcome: 'Learn to check schema'
      },
      conceptCandidates: [
        { id: 'select-basic', name: 'Basic SELECT', description: 'Selecting data' }
      ],
      recentInteractionsSummary: {
        errors: 1,
        retries: 0,
        timeSpent: 5000,
        hintCount: 1
      },
      retrievedSourceIds: ['sql-engage:123'],
      triggerInteractionIds: ['interaction-1'],
      pdfPassages: [],
      pdfIndexProvenance: null,
      sourcePassages: [],
      whyRetrieved: {
        trigger: 'error_subtype_match',
        errorSubtypeId: 'undefined column',
        conceptIds: ['select-basic'],
        traceEvidence: {
          errorCount: 1,
          retryCount: 0,
          hintCount: 1,
          timeSpentMs: 5000,
          lastInteractionTypes: ['error']
        }
      },
      conceptSourceRefs: []
    };

    it('should generate from retrieval bundle', async () => {
      const result = await generateDeterministicFromBundle(mockBundle, {
        learnerId: 'test-learner',
        sessionId: 'test-session',
        triggerInteractionIds: ['interaction-1']
      });

      expect(result.unit).toBeDefined();
      expect(result.unit.content).toContain('Test Problem');
    });

    it('should include hint history in generated content', async () => {
      const result = await generateDeterministicFromBundle(mockBundle, {
        learnerId: 'test-learner',
        sessionId: 'test-session',
        triggerInteractionIds: ['interaction-1']
      });

      expect(result.unit.content).toMatch(/Hint History/i);
      expect(result.unit.content).toMatch(/Check column names/i);
    });
  });

  describe('Error Subtype Specific Tests', () => {
    const testCases = [
      {
        subtype: 'incomplete query',
        code: 'SELECT * FROM',
        expectedInContent: ['complete', 'FROM', 'SELECT']
      },
      {
        subtype: 'undefined column',
        code: 'SELECT usr_name FROM users;',
        expectedInContent: ['column', 'exist', 'table']
      },
      {
        subtype: 'ambiguous reference',
        code: 'SELECT id FROM users JOIN orders ON users.id = orders.user_id;',
        expectedInContent: ['ambiguous', 'prefix', 'table']
      },
      {
        subtype: 'incorrect join usage',
        code: 'SELECT * FROM users JOIN orders;',
        expectedInContent: ['JOIN', 'ON', 'condition']
      },
      {
        subtype: 'aggregation misuse',
        code: 'SELECT dept, COUNT(*) FROM employees;',
        expectedInContent: ['GROUP BY', 'aggregate', 'column']
      }
    ];

    for (const testCase of testCases) {
      it(`should generate appropriate content for ${testCase.subtype}`, async () => {
        const params: DeterministicGenerationParams = {
          problemId: 'test-problem',
          problemTitle: 'Test Problem',
          errorSubtypeId: testCase.subtype,
          code: testCase.code,
          conceptIds: ['select-basic'],
          hintHistory: [],
          triggerInteractionIds: ['interaction-1']
        };

        const result = await generateDeterministicExplanation(params);
        
        // Check that expected terms appear in content
        for (const expected of testCase.expectedInContent) {
          expect(
            result.unit.content.toLowerCase(),
            `Expected "${expected}" in content for ${testCase.subtype}`
          ).toContain(expected.toLowerCase());
        }
      });
    }
  });

  describe('Instructional Unit Structure', () => {
    const mockParams: DeterministicGenerationParams = {
      problemId: 'test-problem',
      problemTitle: 'Test Problem',
      errorSubtypeId: 'undefined column',
      code: 'SELECT usr_name FROM users;',
      conceptIds: ['select-basic'],
      hintHistory: [],
      learnerId: 'test-learner',
      triggerInteractionIds: ['interaction-1']
    };

    it('should create valid InstructionalUnit structure', async () => {
      const result = await generateDeterministicExplanation(mockParams);
      const unit = result.unit;

      // Required fields
      expect(unit.id).toMatch(/^unit-deterministic-/);
      expect(unit.type).toBe('explanation');
      expect(unit.conceptId).toBeTruthy();
      expect(unit.conceptIds?.length).toBeGreaterThan(0);
      expect(unit.title).toBeTruthy();
      expect(unit.content).toBeTruthy();
      expect(unit.addedTimestamp).toBeGreaterThan(0);
      expect(unit.sourceInteractionIds).toContain('interaction-1');

      // Provenance
      expect(unit.provenance).toBeDefined();
      expect(unit.provenance?.model).toBe('deterministic-generator');
      expect(unit.provenance?.fallbackReason).toBe('none');
    });

    it('should include proper provenance information', async () => {
      const result = await generateDeterministicExplanation(mockParams);
      const provenance = result.unit.provenance;

      expect(provenance).toBeDefined();
      expect(provenance?.templateId).toBe('deterministic.v1');
      expect(provenance?.inputHash).toBe(result.inputHash);
      expect(provenance?.retrievedSourceIds.length).toBeGreaterThan(0);
      expect(provenance?.parserStatus).toBe('success');
      expect(provenance?.createdAt).toBeGreaterThan(0);
    });

    it('should set lastErrorSubtypeId correctly', async () => {
      const result = await generateDeterministicExplanation(mockParams);
      expect(result.unit.lastErrorSubtypeId).toBe('undefined column');
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty code gracefully', async () => {
      const params: DeterministicGenerationParams = {
        problemId: 'test-problem',
        problemTitle: 'Test Problem',
        errorSubtypeId: 'incomplete query',
        code: '',
        conceptIds: ['select-basic'],
        hintHistory: [],
        triggerInteractionIds: ['interaction-1']
      };

      const result = await generateDeterministicExplanation(params);
      expect(result.unit).toBeDefined();
      expect(result.unit.content).toContain('No query provided');
    });

    it('should handle unknown error subtypes gracefully', async () => {
      const params: DeterministicGenerationParams = {
        problemId: 'test-problem',
        problemTitle: 'Test Problem',
        errorSubtypeId: 'some-unknown-error-type',
        code: 'SELECT * FROM users;',
        conceptIds: ['select-basic'],
        hintHistory: [],
        triggerInteractionIds: ['interaction-1']
      };

      const result = await generateDeterministicExplanation(params);
      // Should still generate a valid unit (uses fallback template)
      expect(result.unit).toBeDefined();
      expect(result.unit.content.length).toBeGreaterThan(200);
      // The unit should have a valid title
      expect(result.unit.title).toBeTruthy();
    });

    it('should handle empty hint history', async () => {
      const params: DeterministicGenerationParams = {
        problemId: 'test-problem',
        problemTitle: 'Test Problem',
        errorSubtypeId: 'undefined column',
        code: 'SELECT usr_name FROM users;',
        conceptIds: ['select-basic'],
        hintHistory: [],
        triggerInteractionIds: ['interaction-1']
      };

      const result = await generateDeterministicExplanation(params);
      // Should not include hint history section when empty
      expect(result.unit.content).not.toMatch(/## Your Hint History/);
    });

    it('should handle missing concept content gracefully', async () => {
      const params: DeterministicGenerationParams = {
        problemId: 'test-problem',
        problemTitle: 'Test Problem',
        errorSubtypeId: 'undefined column',
        code: 'SELECT usr_name FROM users;',
        conceptIds: ['non-existent-concept-id'],
        hintHistory: [],
        triggerInteractionIds: ['interaction-1']
      };

      const result = await generateDeterministicExplanation(params);
      // Should still generate valid content even if concept markdown doesn't exist
      expect(result.unit).toBeDefined();
      expect(result.unit.content.length).toBeGreaterThan(200);
    });
  });
});
