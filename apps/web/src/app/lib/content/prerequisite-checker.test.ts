import { describe, it, expect } from 'vitest';
import {
  checkPrerequisites,
  checkPrerequisitesBatch,
  getRecommendedNextConcepts,
  getPrerequisiteChain,
  getNewlyUnlockedConcepts,
  getPathToConcept,
  validateConceptGraph
} from './prerequisite-checker';

describe('Prerequisite Checker', () => {
  describe('checkPrerequisites', () => {
    it('should return ready=true for root concepts', () => {
      const status = checkPrerequisites('select-basic', new Set());
      expect(status.ready).toBe(true);
      expect(status.missing).toHaveLength(0);
      expect(status.readinessScore).toBe(100);
    });

    it('should return ready=false when prerequisites are missing', () => {
      const status = checkPrerequisites('where-clause', new Set());
      expect(status.ready).toBe(false);
      expect(status.missing).toContain('select-basic');
      expect(status.readinessScore).toBe(0);
    });

    it('should return ready=true when prerequisites are met', () => {
      const status = checkPrerequisites('where-clause', new Set(['select-basic']));
      expect(status.ready).toBe(true);
      expect(status.missing).toHaveLength(0);
      expect(status.readinessScore).toBe(100);
    });

    it('should calculate partial readiness', () => {
      // joins requires select-basic AND alias
      const status = checkPrerequisites('joins', new Set(['select-basic']));
      expect(status.ready).toBe(false);
      expect(status.missing).toContain('alias');
      expect(status.readinessScore).toBe(50);
    });

    it('should return blockedBy for indirect prerequisites', () => {
      // group-by requires aggregation -> aggregation requires select-basic
      const status = checkPrerequisites('group-by', new Set());
      expect(status.blockedBy.length).toBeGreaterThan(0);
    });
  });

  describe('checkPrerequisitesBatch', () => {
    it('should check multiple concepts at once', () => {
      const results = checkPrerequisitesBatch(
        ['select-basic', 'where-clause', 'joins'],
        new Set(['select-basic'])
      );
      
      expect(results.get('select-basic')?.ready).toBe(true);
      expect(results.get('where-clause')?.ready).toBe(true);
      expect(results.get('joins')?.ready).toBe(false);
    });
  });

  describe('getRecommendedNextConcepts', () => {
    it('should recommend ready concepts', () => {
      const recommendations = getRecommendedNextConcepts(new Set(['select-basic']), 5);
      expect(recommendations.length).toBeGreaterThan(0);
      
      // Should include concepts that only require select-basic
      const whereClause = recommendations.find(r => r.conceptId === 'where-clause');
      expect(whereClause).toBeDefined();
    });

    it('should prioritize by difficulty and unlock potential', () => {
      const recommendations = getRecommendedNextConcepts(new Set(), 10);
      // Root concepts should come first
      expect(recommendations[0].conceptId).toBe('select-basic');
    });
  });

  describe('getPrerequisiteChain', () => {
    it('should return prerequisite chain in learning order', () => {
      const chain = getPrerequisiteChain('group-by');
      expect(chain).toContain('select-basic');
      expect(chain).toContain('aggregation');
      expect(chain.indexOf('select-basic')).toBeLessThan(chain.indexOf('aggregation'));
    });

    it('should return empty array for root concepts', () => {
      const chain = getPrerequisiteChain('select-basic');
      expect(chain).toHaveLength(0);
    });
  });

  describe('getNewlyUnlockedConcepts', () => {
    it('should return concepts unlocked by adding a concept', () => {
      const newlyUnlocked = getNewlyUnlockedConcepts('select-basic', new Set());
      expect(newlyUnlocked).toContain('where-clause');
      expect(newlyUnlocked).toContain('distinct');
    });

    it('should not return already unlocked concepts', () => {
      // Already has select-basic, adding where-clause
      const newlyUnlocked = getNewlyUnlockedConcepts(
        'where-clause', 
        new Set(['select-basic'])
      );
      // Should not include concepts directly unlocked by select-basic
      expect(newlyUnlocked).not.toContain('distinct');
    });
  });

  describe('getPathToConcept', () => {
    it('should return path from current state to target', () => {
      const path = getPathToConcept(new Set(), 'group-by');
      expect(path).toContain('select-basic');
      expect(path).toContain('aggregation');
      expect(path).toContain('group-by');
    });

    it('should skip already covered concepts', () => {
      const path = getPathToConcept(new Set(['select-basic']), 'where-clause');
      expect(path).not.toContain('select-basic');
      expect(path).toContain('where-clause');
    });
  });

  describe('validateConceptGraph', () => {
    it('should confirm the graph has no cycles', () => {
      const validation = validateConceptGraph();
      expect(validation.valid).toBe(true);
    });
  });
});
