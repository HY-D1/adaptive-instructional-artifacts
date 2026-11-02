import { describe, expect, it } from 'vitest';
import { getProblemsForConcept } from './concept-loader';
import { sqlProblems } from '../../data/problems';

describe('textbook practice resolution', () => {
  it.each([
    ['murachs-mysql-3rd-edition/select-statement-murach', 'select-basic'],
    ['murachs-mysql-3rd-edition/order-by-murach', 'order-by'],
    ['dbms-ramakrishnan-3rd-edition/aggregate-functions', 'aggregation'],
    ['dbms-ramakrishnan-3rd-edition/correlated-subquery', 'correlated-subqueries'],
    ['murachs-mysql-3rd-edition/unions', 'union'],
  ])('resolves %s to existing %s exercises', (id, tag) => {
    expect(getProblemsForConcept(id).map(p => p.id)).toEqual(sqlProblems.filter(p => p.concepts.includes(tag)).map(p => p.id));
    expect(getProblemsForConcept(id).length).toBeGreaterThan(0);
  });
  it('preserves legacy selection and order', () => {
    expect(getProblemsForConcept('select-basic')).toEqual(sqlProblems.filter(p => p.concepts.includes('select-basic')));
  });
  it('does not manufacture practice for unknown or administrative concepts', () => {
    expect(getProblemsForConcept('unknown')).toEqual([]);
    expect(getProblemsForConcept('murachs-mysql-3rd-edition/backup-restore')).toEqual([]);
  });
});
