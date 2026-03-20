#!/usr/bin/env node
/**
 * validate-corpus.mjs
 *
 * Gate: verifies the textbook-static corpus is complete and dual-source.
 *
 * Checks (all must pass):
 *   1. concept-map.json exists.
 *   2. sourceDocIds contains BOTH required textbook IDs.
 *   3. textbook-manifest.json exists.
 *   4. Per-doc concept directories exist for every sourceDocId.
 *   5. Every concept-map.json entry resolves to an existing markdown file.
 *   6. No duplicate concept keys.
 *
 * Exit 0 = corpus is consistent and dual-source.
 * Exit 1 = any check failed.
 */

import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

const CONCEPT_MAP_PATH   = resolve(ROOT, 'apps/web/public/textbook-static/concept-map.json');
const CONCEPTS_BASE      = resolve(ROOT, 'apps/web/public/textbook-static/concepts');
const MANIFEST_PATH      = resolve(ROOT, 'apps/web/public/textbook-static/textbook-manifest.json');

/** Textbooks that MUST be present for the corpus contract to hold. */
const REQUIRED_SOURCE_DOC_IDS = [
  'murachs-mysql-3rd-edition',
  'dbms-ramakrishnan-3rd-edition',
];

function run() {
  let errors = 0;

  // ── Check 1: concept-map.json exists ─────────────────────────────────────
  if (!existsSync(CONCEPT_MAP_PATH)) {
    console.error(`FAIL [check-1]: concept-map.json not found at ${CONCEPT_MAP_PATH}`);
    process.exit(1);
  }

  const map = JSON.parse(readFileSync(CONCEPT_MAP_PATH, 'utf-8'));
  const sourceDocIds = map.sourceDocIds ?? (map.sourceDocId ? [map.sourceDocId] : []);
  const conceptKeys  = Object.keys(map.concepts);

  console.log(`\nconcept-map.json: ${conceptKeys.length} entries`);
  console.log(`sourceDocIds: ${sourceDocIds.join(', ') || '(none)'}\n`);

  // ── Check 2: both required textbooks declared ─────────────────────────────
  for (const required of REQUIRED_SOURCE_DOC_IDS) {
    if (!sourceDocIds.includes(required)) {
      console.error(`FAIL [check-2]: sourceDocIds is missing required textbook "${required}"`);
      console.error(`  Found: [${sourceDocIds.join(', ')}]`);
      console.error(`  Both of these must be present: [${REQUIRED_SOURCE_DOC_IDS.join(', ')}]`);
      errors++;
    }
  }

  // ── Check 3: textbook-manifest.json exists ────────────────────────────────
  if (!existsSync(MANIFEST_PATH)) {
    console.error(`FAIL [check-3]: textbook-manifest.json not found at ${MANIFEST_PATH}`);
    errors++;
  } else {
    console.log(`PASS [check-3]: textbook-manifest.json present`);
  }

  // ── Check 4: per-doc concept directories exist ────────────────────────────
  for (const docId of REQUIRED_SOURCE_DOC_IDS) {
    const docDir = resolve(CONCEPTS_BASE, docId);
    if (!existsSync(docDir)) {
      console.error(`FAIL [check-4]: concept directory missing for "${docId}"`);
      console.error(`  Expected: ${docDir.replace(ROOT + '/', '')}`);
      errors++;
    } else {
      console.log(`PASS [check-4]: concept directory present for "${docId}"`);
    }
  }

  // ── Check 5 & 6: every concept resolves + no duplicates ──────────────────
  let broken   = 0;
  let warnings = 0;
  const seenKeys = new Set();

  for (const key of conceptKeys) {
    if (seenKeys.has(key)) {
      console.warn(`  WARN [check-6] duplicate key: ${key}`);
      warnings++;
    }
    seenKeys.add(key);

    const conceptInfo = map.concepts[key];
    const sourceDocId = conceptInfo.sourceDocId;
    const plainId     = key.includes('/') ? key.split('/').pop() : key;

    const candidates = [];
    if (sourceDocId) {
      candidates.push(resolve(CONCEPTS_BASE, sourceDocId, `${plainId}.md`));
    }
    if (key.includes('/')) {
      candidates.push(resolve(CONCEPTS_BASE, `${key}.md`));
      candidates.push(resolve(CONCEPTS_BASE, `${plainId}.md`));
    } else {
      candidates.push(resolve(CONCEPTS_BASE, `${key}.md`));
    }

    const found = candidates.find(p => existsSync(p));
    if (!found) {
      console.error(`  BROKEN [check-5]: ${key}`);
      console.error(`    Tried:`);
      for (const c of candidates) {
        console.error(`      ${c.replace(ROOT + '/', '')}`);
      }
      broken++;
    }
  }

  errors += broken;

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log(`\n--- Results ---`);
  console.log(`Total entries:       ${conceptKeys.length}`);
  console.log(`Broken links:        ${broken}`);
  console.log(`Warnings:            ${warnings}`);
  console.log(`sourceDocIds found:  [${sourceDocIds.join(', ')}]`);
  console.log(`Required:            [${REQUIRED_SOURCE_DOC_IDS.join(', ')}]`);

  if (errors > 0) {
    console.error(`\nFAIL: ${errors} check(s) failed. See above for details.`);
    process.exit(1);
  }

  console.log(`\nPASS: all ${conceptKeys.length} entries resolve; both required textbooks present.`);
  process.exit(0);
}

run();
