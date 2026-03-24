/**
 * concept-resolution-audit.test.ts
 *
 * Repo-level gate: measures how many adaptive internal concept IDs resolve
 * to actual entries in the real shipped corpus (textbook-static/concept-map.json).
 *
 * This test reads the REAL concept-map.json from disk — no mocks.
 * It fails if the resolution rate drops below the required threshold,
 * preventing a corpus sync or compatibility-map regression from silently
 * leaving core learning concepts without textbook backing.
 *
 * REQUIRED THRESHOLD: 100% (30/30) — all core adaptive concept IDs must
 * resolve when the full dual-textbook corpus is present.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { resolveConceptId } from './concept-loader';
import type { ConceptInfo } from './concept-loader';

const CORPUS_ROOT = resolve(__dirname, '../../../../public/textbook-static');
const CONCEPT_MAP_PATH = resolve(CORPUS_ROOT, 'concept-map.json');

// All internal adaptive concept IDs (from concept-graph.ts + alignment-map.json).
// These are the IDs used throughout the app's learning flows.
const INTERNAL_CONCEPT_IDS: readonly string[] = [
  // Basics
  'select-basic',
  'distinct',
  'alias',
  // Filtering
  'where-clause',
  'logical-operators',
  'null-handling',
  'in-operator',
  'between-operator',
  'like-pattern',
  // Joining
  'joins',
  'join-condition-missing',
  'ambiguous-column',
  'self-join',
  'cross-join',
  // Aggregation
  'aggregation',
  'group-by',
  'group-by-error',
  'having-clause',
  // Functions
  'string-functions',
  'date-functions',
  'case-expression',
  // Sorting & Pagination
  'order-by',
  'limit-offset',
  // Advanced
  'subqueries',
  'exist-clause',
  'union',
  'cte',
  'window-functions',
  // Errors
  'syntax-error',
  'missing-from',
];

const REQUIRED_RESOLUTION_RATE = 1.0; // 100% — all core IDs must resolve

describe('Concept resolution audit: internal IDs against real corpus', () => {
  it('concept-map.json is present on disk', () => {
    expect(
      existsSync(CONCEPT_MAP_PATH),
      `concept-map.json not found at ${CONCEPT_MAP_PATH}`
    ).toBe(true);
  });

  it('every internal adaptive concept ID resolves to an existing corpus entry', () => {
    const raw = readFileSync(CONCEPT_MAP_PATH, 'utf-8');
    const map = JSON.parse(raw) as { concepts: Record<string, ConceptInfo> };
    const concepts = map.concepts;

    const unresolved: string[] = [];
    const resolved: Array<{ internal: string; corpus: string }> = [];

    for (const id of INTERNAL_CONCEPT_IDS) {
      const corpusKey = resolveConceptId(id, concepts);
      if (concepts[corpusKey]) {
        resolved.push({ internal: id, corpus: corpusKey });
      } else {
        unresolved.push(id);
      }
    }

    const total = INTERNAL_CONCEPT_IDS.length;
    const resolvedCount = resolved.length;
    const rate = resolvedCount / total;

    // Log resolution summary for debugging when this test fails
    if (unresolved.length > 0) {
      console.error(
        `\nUnresolved internal concept IDs (${unresolved.length}/${total}):\n` +
          unresolved.map(id => `  ❌ ${id}`).join('\n')
      );
      console.info(
        `\nResolved (${resolvedCount}/${total}):\n` +
          resolved.map(r => `  ✅ ${r.internal} → ${r.corpus}`).join('\n')
      );
    }

    expect(
      unresolved,
      `${unresolved.length} of ${total} internal concept IDs did not resolve.\n` +
        `Required resolution rate: ${(REQUIRED_RESOLUTION_RATE * 100).toFixed(0)}%\n` +
        `Actual: ${resolvedCount}/${total} (${(rate * 100).toFixed(1)}%)\n` +
        `Unresolved: ${unresolved.join(', ')}\n\n` +
        `Fix: add or update entries in concept-compatibility-map.ts, or ensure ` +
        `the corpus contains a matching concept for each unresolved ID.`
    ).toHaveLength(0);
  });

  it('resolution rate meets the required threshold', () => {
    const raw = readFileSync(CONCEPT_MAP_PATH, 'utf-8');
    const map = JSON.parse(raw) as { concepts: Record<string, ConceptInfo> };
    const concepts = map.concepts;

    let resolvedCount = 0;
    for (const id of INTERNAL_CONCEPT_IDS) {
      const corpusKey = resolveConceptId(id, concepts);
      if (concepts[corpusKey]) resolvedCount++;
    }

    const rate = resolvedCount / INTERNAL_CONCEPT_IDS.length;

    expect(
      rate,
      `Resolution rate ${(rate * 100).toFixed(1)}% is below required ` +
        `${(REQUIRED_RESOLUTION_RATE * 100).toFixed(0)}%. ` +
        `Run the first test in this suite for a detailed breakdown.`
    ).toBeGreaterThanOrEqual(REQUIRED_RESOLUTION_RATE);
  });

  it('resolved concepts are non-empty (not phantom entries)', () => {
    const raw = readFileSync(CONCEPT_MAP_PATH, 'utf-8');
    const map = JSON.parse(raw) as { concepts: Record<string, ConceptInfo> };
    const concepts = map.concepts;

    const phantom: string[] = [];

    for (const id of INTERNAL_CONCEPT_IDS) {
      const corpusKey = resolveConceptId(id, concepts);
      const entry = concepts[corpusKey];
      if (!entry) continue; // counted as unresolved in other test

      if (!entry.title || entry.title.trim() === '') {
        phantom.push(`${id} → ${corpusKey} (missing title)`);
      }
      if (!entry.definition || entry.definition.trim() === '') {
        phantom.push(`${id} → ${corpusKey} (missing definition)`);
      }
    }

    expect(
      phantom,
      `Resolved concepts with empty title or definition:\n  ${phantom.join('\n  ')}`
    ).toHaveLength(0);
  });
});
