import { describe, it, expect } from 'vitest';
import {
  CONCEPT_GRAPH,
  buildConceptGraph,
  getRootConcepts,
  getConceptsByCategory,
  getConceptsByDifficulty,
  getLearningPath,
  getUnlockedConcepts,
  isAdvancedConcept,
  getConceptGraphStats
} from './concept-graph';
import { validateConceptGraph } from '../lib/content/prerequisite-checker';

describe('Concept Graph', () => {
  describe('CONCEPT_GRAPH', () => {
    it('should have 30 concepts defined', () => {
      expect(Object.keys(CONCEPT_GRAPH).length).toBe(30);
    });

    it('should have select-basic as a root concept', () => {
      const selectBasic = CONCEPT_GRAPH['select-basic'];
      expect(selectBasic).toBeDefined();
      expect(selectBasic.prerequisites).toHaveLength(0);
      expect(selectBasic.difficulty).toBe(1);
      expect(selectBasic.category).toBe('basics');
    });

    it('should have where-clause depending on select-basic', () => {
      const whereClause = CONCEPT_GRAPH['where-clause'];
      expect(whereClause).toBeDefined();
      expect(whereClause.prerequisites).toContain('select-basic');
      expect(whereClause.difficulty).toBe(1);
      expect(whereClause.category).toBe('filtering');
    });

    it('should have joins depending on select-basic and alias', () => {
      const joins = CONCEPT_GRAPH['joins'];
      expect(joins).toBeDefined();
      expect(joins.prerequisites).toContain('select-basic');
      expect(joins.prerequisites).toContain('alias');
      expect(joins.difficulty).toBe(2);
      expect(joins.category).toBe('joining');
    });
  });

  describe('buildConceptGraph', () => {
    it('should build a graph with all 30 concepts', () => {
      const graph = buildConceptGraph();
      expect(graph.size).toBe(30);
    });

    it('should derive unlocks from prerequisites', () => {
      const graph = buildConceptGraph();
      const selectBasic = graph.get('select-basic');
      expect(selectBasic?.unlocks).toContain('where-clause');
      expect(selectBasic?.unlocks).toContain('distinct');
      expect(selectBasic?.unlocks).toContain('alias');
      expect(selectBasic?.unlocks).toContain('order-by');
    });
  });

  describe('getRootConcepts', () => {
    it('should return concepts with no prerequisites', () => {
      const roots = getRootConcepts();
      expect(roots).toContain('select-basic');
      expect(roots).toContain('syntax-error');
    });
  });

  describe('getConceptsByCategory', () => {
    it('should return all basics concepts', () => {
      const basics = getConceptsByCategory('basics');
      expect(basics.length).toBeGreaterThan(0);
      expect(basics.every(c => c.category === 'basics')).toBe(true);
    });

    it('should return all filtering concepts', () => {
      const filtering = getConceptsByCategory('filtering');
      expect(filtering.length).toBeGreaterThan(0);
      expect(filtering.every(c => c.category === 'filtering')).toBe(true);
    });

    it('should return all joining concepts', () => {
      const joining = getConceptsByCategory('joining');
      expect(joining.length).toBeGreaterThan(0);
      expect(joining.every(c => c.category === 'joining')).toBe(true);
    });
  });

  describe('getConceptsByDifficulty', () => {
    it('should return beginner concepts (difficulty 1)', () => {
      const beginner = getConceptsByDifficulty(1);
      expect(beginner.length).toBeGreaterThan(0);
      expect(beginner.every(c => c.difficulty === 1)).toBe(true);
    });

    it('should return intermediate concepts (difficulty 2)', () => {
      const intermediate = getConceptsByDifficulty(2);
      expect(intermediate.length).toBeGreaterThan(0);
      expect(intermediate.every(c => c.difficulty === 2)).toBe(true);
    });

    it('should return advanced concepts (difficulty 3)', () => {
      const advanced = getConceptsByDifficulty(3);
      expect(advanced.length).toBeGreaterThan(0);
      expect(advanced.every(c => c.difficulty === 3)).toBe(true);
    });
  });

  describe('getLearningPath', () => {
    it('should return path including prerequisites', () => {
      const path = getLearningPath('where-clause');
      expect(path).toContain('select-basic');
      expect(path).toContain('where-clause');
      expect(path.indexOf('select-basic')).toBeLessThan(path.indexOf('where-clause'));
    });

    it('should handle root concepts', () => {
      const path = getLearningPath('select-basic');
      expect(path).toEqual(['select-basic']);
    });
  });

  describe('getUnlockedConcepts', () => {
    it('should return concepts unlocked by mastering select-basic', () => {
      const unlocked = getUnlockedConcepts('select-basic');
      expect(unlocked).toContain('where-clause');
      expect(unlocked).toContain('distinct');
      expect(unlocked).toContain('alias');
    });
  });

  describe('isAdvancedConcept', () => {
    it('should return true for advanced concepts', () => {
      expect(isAdvancedConcept('self-join')).toBe(true);
      expect(isAdvancedConcept('subqueries')).toBe(true);
      expect(isAdvancedConcept('window-functions')).toBe(true);
    });

    it('should return false for beginner concepts', () => {
      expect(isAdvancedConcept('select-basic')).toBe(false);
      expect(isAdvancedConcept('where-clause')).toBe(false);
    });
  });

  describe('getConceptGraphStats', () => {
    it('should return correct statistics', () => {
      const stats = getConceptGraphStats();
      expect(stats.totalConcepts).toBe(30);
      expect(stats.byCategory.basics).toBeGreaterThan(0);
      expect(stats.byDifficulty[1]).toBeGreaterThan(0);
      expect(stats.avgPrerequisites).toBeGreaterThanOrEqual(0);
      expect(stats.maxDepth).toBeGreaterThan(0);
    });
  });

  describe('validateConceptGraph', () => {
    it('should validate that the graph is a DAG (no cycles)', () => {
      const validation = validateConceptGraph();
      expect(validation.valid).toBe(true);
      expect(validation.cycles).toHaveLength(0);
    });
  });
});
