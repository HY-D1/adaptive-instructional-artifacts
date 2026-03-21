/**
 * corpus-contract.test.ts
 *
 * Integration gate: verifies that the shipped textbook-static corpus satisfies
 * the dual-textbook contract before any code runs in the browser.
 *
 * These tests read the actual files on disk.  They fail intentionally on a
 * single-book corpus and pass only when both required textbooks are present.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { spawnSync } from 'child_process';

const CORPUS_ROOT = resolve(
  __dirname,
  '../../../../public/textbook-static'
);

const REQUIRED_SOURCE_DOC_IDS = [
  'murachs-mysql-3rd-edition',
  'dbms-ramakrishnan-3rd-edition',
] as const;

type ConceptEntry = {
  title: string;
  definition: string;
  difficulty: string;
  sourceDocId?: string;
  chunkIds: { definition: string[]; examples: string[]; commonMistakes: string[] };
  relatedConcepts: string[];
  practiceProblemIds: string[];
};

type ConceptMap = {
  version: string;
  sourceDocIds?: string[];
  sourceDocId?: string;
  concepts: Record<string, ConceptEntry>;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function loadConceptMap(): ConceptMap {
  const path = resolve(CORPUS_ROOT, 'concept-map.json');
  expect(existsSync(path), `concept-map.json not found at ${path}`).toBe(true);
  return JSON.parse(readFileSync(path, 'utf-8')) as ConceptMap;
}

function getSourceDocIds(map: ConceptMap): string[] {
  return map.sourceDocIds ?? (map.sourceDocId ? [map.sourceDocId] : []);
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('Corpus contract: dual-textbook requirement', () => {
  it('concept-map.json exists and is valid JSON', () => {
    const map = loadConceptMap();
    expect(map).toBeTruthy();
    expect(typeof map.concepts).toBe('object');
  });

  it('sourceDocIds declares both required textbooks', () => {
    const map = loadConceptMap();
    const declared = getSourceDocIds(map);

    for (const required of REQUIRED_SOURCE_DOC_IDS) {
      expect(
        declared,
        `sourceDocIds is missing "${required}". Found: [${declared.join(', ')}]`
      ).toContain(required);
    }
  });

  it('textbook-manifest.json exists', () => {
    const path = resolve(CORPUS_ROOT, 'textbook-manifest.json');
    expect(existsSync(path), `textbook-manifest.json not found at ${path}`).toBe(true);
  });

  it('per-doc concept directory exists for each required textbook', () => {
    for (const docId of REQUIRED_SOURCE_DOC_IDS) {
      const dir = resolve(CORPUS_ROOT, 'concepts', docId);
      expect(
        existsSync(dir),
        `concept directory missing for "${docId}": ${dir}`
      ).toBe(true);
    }
  });

  it('concept-map.json has at least one entry for each required textbook', () => {
    const map = loadConceptMap();
    const keys = Object.keys(map.concepts);

    for (const docId of REQUIRED_SOURCE_DOC_IDS) {
      const count = keys.filter(k => k.startsWith(`${docId}/`)).length;
      expect(
        count,
        `No concepts found for "${docId}" in concept-map.json`
      ).toBeGreaterThan(0);
    }
  });

  it('every concept-map entry resolves to an existing markdown file', () => {
    const map = loadConceptMap();
    const broken: string[] = [];

    for (const key of Object.keys(map.concepts)) {
      const info = map.concepts[key];
      const plainId = key.includes('/') ? key.split('/').pop()! : key;
      const sourceDocId = info.sourceDocId ?? (key.includes('/') ? key.split('/')[0] : undefined);

      const candidates: string[] = [];
      if (sourceDocId) {
        candidates.push(resolve(CORPUS_ROOT, 'concepts', sourceDocId, `${plainId}.md`));
      }
      candidates.push(resolve(CORPUS_ROOT, 'concepts', `${key}.md`));
      if (key.includes('/')) {
        candidates.push(resolve(CORPUS_ROOT, 'concepts', `${plainId}.md`));
      }

      const found = candidates.some(p => existsSync(p));
      if (!found) {
        broken.push(key);
      }
    }

    expect(
      broken,
      `Broken concept-map entries (no matching .md file):\n  ${broken.join('\n  ')}`
    ).toHaveLength(0);
  });

  it('concept-map.json contains more than one concept per textbook', () => {
    const map = loadConceptMap();
    const keys = Object.keys(map.concepts);

    for (const docId of REQUIRED_SOURCE_DOC_IDS) {
      const count = keys.filter(k => k.startsWith(`${docId}/`)).length;
      // We require at least 3 so a trivial single-stub commit won't slip through.
      expect(
        count,
        `Too few concepts for "${docId}" (found ${count}, need ≥ 3)`
      ).toBeGreaterThanOrEqual(3);
    }
  });
});

// ─── Git-ignore contract ──────────────────────────────────────────────────────

describe('Corpus contract: concept markdown files are not gitignored', () => {
  // git check-ignore --quiet exits 1 when the path is NOT ignored, 0 when it IS ignored.
  function isGitIgnored(repoRelPath: string): boolean {
    const result = spawnSync('git', ['check-ignore', '--quiet', repoRelPath], {
      cwd: resolve(CORPUS_ROOT, '../../../../..'), // repo root
    });
    return result.status === 0;
  }

  it('a Murach concept markdown file is not gitignored', () => {
    const repoRelPath =
      'apps/web/public/textbook-static/concepts/murachs-mysql-3rd-edition/mysql-intro.md';
    expect(
      isGitIgnored(repoRelPath),
      `${repoRelPath} is gitignored — fix .gitignore`
    ).toBe(false);
  });

  it('a Ramakrishnan concept markdown file is not gitignored', () => {
    const repoRelPath =
      'apps/web/public/textbook-static/concepts/dbms-ramakrishnan-3rd-edition/relational-model-ramakrishnan.md';
    expect(
      isGitIgnored(repoRelPath),
      `${repoRelPath} is gitignored — fix .gitignore`
    ).toBe(false);
  });
});
