/**
 * authored-concepts.test.ts
 *
 * Contract gate for the hand-authored concept pages.
 *
 * Most of the concept corpus is machine-extracted from source PDFs, and a
 * portion of it is off-topic or garbled. The concepts listed here were rewritten
 * by hand to fix that. This suite pins the properties that make them usable, so
 * a future regeneration of the corpus cannot quietly replace them with
 * extraction noise again.
 *
 * It reads the shipped markdown on disk and checks it through the same gates
 * the renderer uses, rather than asserting on exact prose.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import {
  isExplanationGarbled,
  isExampleSqlSane,
  toLearnerSafeParagraph,
} from './concept-loader';

const CORPUS_ROOT = resolve(__dirname, '../../../../public/textbook-static');

/** Concepts rewritten by hand; see docs/superpowers/plans for the rationale. */
const AUTHORED_CONCEPTS = [
  'dbms-ramakrishnan-3rd-edition/joins',
  'dbms-ramakrishnan-3rd-edition/where-clause',
  'dbms-ramakrishnan-3rd-edition/subqueries',
  'dbms-ramakrishnan-3rd-edition/group-by',
  'dbms-ramakrishnan-3rd-edition/select-basic',
  'dbms-ramakrishnan-3rd-edition/primary-key',
  'dbms-ramakrishnan-3rd-edition/foreign-key',
  'dbms-ramakrishnan-3rd-edition/1nf',
  'dbms-ramakrishnan-3rd-edition/2nf',
  'dbms-ramakrishnan-3rd-edition/3nf',
  'murachs-mysql-3rd-edition/create-table-murach',
] as const;

/** Duplicate twins merged into the canonical ids above. */
const MERGED_AWAY_CONCEPTS = [
  'murachs-mysql-3rd-edition/joins-murach',
  'murachs-mysql-3rd-edition/where-clause-murach',
  'murachs-mysql-3rd-edition/subqueries-murach',
  'murachs-mysql-3rd-edition/group-by-murach',
] as const;

/** Mirrors parseMarkdownContent's section split, which is module-private. */
function splitSections(markdown: string): Record<string, string> {
  const sections: Record<string, string> = {};
  let current = '';
  let buffer: string[] = [];
  for (const line of markdown.split('\n')) {
    if (line.startsWith('## ')) {
      if (current) sections[current] = buffer.join('\n').trim();
      current = line.replace('## ', '').trim();
      buffer = [];
    } else {
      buffer.push(line);
    }
  }
  if (current) sections[current] = buffer.join('\n').trim();
  return sections;
}

function readConcept(id: string): Record<string, string> {
  const file = resolve(CORPUS_ROOT, 'concepts', `${id}.md`);
  expect(existsSync(file), `${id}.md should exist`).toBe(true);
  return splitSections(readFileSync(file, 'utf8'));
}

function sqlBlocks(section: string): string[] {
  return [...section.matchAll(/```sql\n([\s\S]*?)```/g)].map((match) => match[1].trim());
}

describe('hand-authored concept pages', () => {
  describe.each(AUTHORED_CONCEPTS)('%s', (conceptId) => {
    it('has a definition that survives the learner-safe transform', () => {
      const sections = readConcept(conceptId);
      const definition = toLearnerSafeParagraph(sections['Definition'] ?? '', 320);
      expect(definition.length).toBeGreaterThan(40);
    });

    it('has an explanation the quality gate does not treat as garbled', () => {
      const sections = readConcept(conceptId);
      const raw = sections['Explanation'] ?? '';
      expect(raw.length).toBeGreaterThan(0);
      // Checked raw and post-transform: the renderer runs the gate on the
      // parsed value, but raw artefacts would mean the source is wrong.
      expect(isExplanationGarbled(raw)).toBe(false);
      expect(isExplanationGarbled(toLearnerSafeParagraph(raw, 1800))).toBe(false);
    });

    it('keeps the explanation inside the 1800-character render budget', () => {
      const sections = readConcept(conceptId);
      const compacted = (sections['Explanation'] ?? '').replace(/\s+/g, ' ').trim();
      // toLearnerSafeParagraph clips beyond this, which would truncate the
      // final point mid-argument rather than failing loudly.
      expect(compacted.length).toBeLessThanOrEqual(1800);
    });

    it('provides at least two runnable SQL examples', () => {
      const sections = readConcept(conceptId);
      const blocks = sqlBlocks(sections['Examples'] ?? '');
      const sane = blocks.filter((code) => isExampleSqlSane(code));
      expect(sane.length).toBeGreaterThanOrEqual(2);
    });

    it('documents at least two specific common mistakes', () => {
      const sections = readConcept(conceptId);
      const section = sections['Common Mistakes'] ?? '';
      expect(section).not.toMatch(/No specific mistakes documented/i);

      const blocks = section.split('###').filter((block) => block.trim());
      const complete = blocks.filter(
        (block) => block.includes('❌') && block.includes('✅') && block.includes('💡'),
      );
      expect(complete.length).toBeGreaterThanOrEqual(2);
    });

    it('is marked readable so the renderer does not suppress it', () => {
      const quality = JSON.parse(
        readFileSync(resolve(CORPUS_ROOT, 'concept-quality.json'), 'utf8'),
      );
      const entry = quality.qualityByConcept?.[conceptId];
      expect(entry, `${conceptId} should have a quality entry`).toBeDefined();
      // 'fallback_only' makes assessConceptQuality hide the content entirely.
      expect(entry.readabilityStatus).not.toBe('fallback_only');
      expect(entry.readabilityStatus).not.toBe('garbled');
    });
  });

  describe('merged duplicate concepts', () => {
    it.each(MERGED_AWAY_CONCEPTS)('%s is fully removed', (conceptId) => {
      const file = resolve(CORPUS_ROOT, 'concepts', `${conceptId}.md`);
      expect(existsSync(file), `${conceptId}.md should have been deleted`).toBe(false);

      const map = JSON.parse(readFileSync(resolve(CORPUS_ROOT, 'concept-map.json'), 'utf8'));
      const quality = JSON.parse(
        readFileSync(resolve(CORPUS_ROOT, 'concept-quality.json'), 'utf8'),
      );
      expect(map.concepts[conceptId]).toBeUndefined();
      expect(quality.qualityByConcept[conceptId]).toBeUndefined();
    });
  });

  it('gives every concept a read-time estimate', () => {
    const map = JSON.parse(readFileSync(resolve(CORPUS_ROOT, 'concept-map.json'), 'utf8'));
    const entries = Object.entries(map.concepts) as [string, { estimatedReadTime?: number }][];
    expect(entries.length).toBeGreaterThan(0);
    // ConceptInfo requires this field and ConceptDetailPage renders it directly,
    // so a missing value shows up as a bare " min read" with no number.
    const missing = entries.filter(([, entry]) => typeof entry.estimatedReadTime !== 'number');
    expect(missing.map(([id]) => id)).toEqual([]);
  });
});
