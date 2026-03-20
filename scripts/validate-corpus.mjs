#!/usr/bin/env node
/**
 * validate-corpus.mjs
 *
 * Gate: verifies every concept-map.json entry for the Murach source resolves to an
 * existing markdown file in apps/web/public/textbook-static/concepts/murachs-mysql-3rd-edition/.
 *
 * Also checks for duplicate keys and ambiguous broken mappings.
 *
 * Exit 0 = corpus is consistent.
 * Exit 1 = stale references or other errors found.
 */

import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

const CONCEPT_MAP_PATH = resolve(ROOT, 'apps/web/public/textbook-static/concept-map.json');
const CONCEPTS_BASE = resolve(ROOT, 'apps/web/public/textbook-static/concepts');

function run() {
  // Load concept-map.json
  if (!existsSync(CONCEPT_MAP_PATH)) {
    console.error(`ERROR: concept-map.json not found at ${CONCEPT_MAP_PATH}`);
    process.exit(1);
  }

  const map = JSON.parse(readFileSync(CONCEPT_MAP_PATH, 'utf-8'));
  const conceptKeys = Object.keys(map.concepts);

  console.log(`\nconcept-map.json: ${conceptKeys.length} entries`);
  console.log(`Source docs: ${map.sourceDocIds?.join(', ') || map.sourceDocId || '(unknown)'}\n`);

  let errors = 0;
  let warnings = 0;
  const seenKeys = new Set();

  for (const key of conceptKeys) {
    // Check for duplicates (JSON.parse deduplicates, but validate anyway)
    if (seenKeys.has(key)) {
      console.warn(`  WARN duplicate key: ${key}`);
      warnings++;
    }
    seenKeys.add(key);

    const conceptInfo = map.concepts[key];
    const sourceDocId = conceptInfo.sourceDocId;

    // Determine the plain concept ID (strip namespace prefix)
    const plainId = key.includes('/') ? key.split('/').pop() : key;

    // Candidate file paths (same resolution order as concept-loader.ts)
    const candidates = [];
    if (sourceDocId) {
      candidates.push(resolve(CONCEPTS_BASE, sourceDocId, `${plainId}.md`));
    }
    if (key.includes('/')) {
      candidates.push(resolve(CONCEPTS_BASE, `${key}.md`));           // full namespaced path
      candidates.push(resolve(CONCEPTS_BASE, `${plainId}.md`));       // flat fallback
    } else {
      candidates.push(resolve(CONCEPTS_BASE, `${key}.md`));           // flat path
    }

    const found = candidates.find(p => existsSync(p));

    if (!found) {
      console.error(`  BROKEN: ${key}`);
      console.error(`    Tried:`);
      for (const c of candidates) {
        console.error(`      ${c.replace(ROOT + '/', '')}`);
      }
      errors++;
    }
  }

  console.log(`\n--- Results ---`);
  console.log(`Total entries:   ${conceptKeys.length}`);
  console.log(`Broken links:    ${errors}`);
  console.log(`Warnings:        ${warnings}`);

  if (errors > 0) {
    console.error(`\nFAIL: ${errors} concept-map entries point to missing markdown files.`);
    process.exit(1);
  }

  console.log(`\nPASS: all ${conceptKeys.length} concept-map entries resolve to existing files.`);
  process.exit(0);
}

run();
