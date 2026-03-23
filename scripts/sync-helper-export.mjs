#!/usr/bin/env node
/**
 * sync-helper-export.mjs
 *
 * Syncs a PDF-helper export directory into the adaptive repo's textbook-static corpus,
 * then runs validate-corpus.mjs to confirm the result is coherent.
 *
 * Usage:
 *   node scripts/sync-helper-export.mjs <helper-export-dir>
 *
 * The helper export directory must contain:
 *   concept-map.json
 *   textbook-manifest.json          (optional but strongly recommended)
 *   chunks-metadata.json            (optional)
 *   concept-quality.json            (required for full helper corpus — per-concept quality metadata)
 *   textbook-units.json             (required for full helper corpus — static unit identity metadata)
 *   concepts/<docId>/<conceptId>.md (one or more)
 *
 * After sync:
 *   apps/web/public/textbook-static/  is updated in place.
 *
 * Exit 0 = sync succeeded and validate-corpus passed.
 * Exit 1 = validation or structural error.
 */

import { existsSync, statSync, readdirSync, readFileSync, cpSync, copyFileSync, mkdirSync } from 'fs';
import { resolve, dirname, join, relative } from 'path';
import { fileURLToPath } from 'url';
import { execFileSync } from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT       = resolve(__dirname, '..');
const TARGET_DIR = resolve(ROOT, 'apps/web/public/textbook-static');

// ─── Argument parsing ────────────────────────────────────────────────────────

const exportDir = process.argv[2];

if (!exportDir) {
  console.error('Usage: node scripts/sync-helper-export.mjs <helper-export-dir>');
  console.error('');
  console.error('  <helper-export-dir>  Path to the directory produced by the PDF helper.');
  console.error('                       Must contain concept-map.json and a concepts/ subdirectory.');
  process.exit(1);
}

const srcDir = resolve(process.cwd(), exportDir);

// ─── Pre-flight validation of the export directory ───────────────────────────

function abort(msg) {
  console.error(`\nERROR: ${msg}`);
  process.exit(1);
}

if (!existsSync(srcDir)) {
  abort(`Export directory not found: ${srcDir}`);
}
if (!statSync(srcDir).isDirectory()) {
  abort(`Not a directory: ${srcDir}`);
}

const srcConceptMap = join(srcDir, 'concept-map.json');
if (!existsSync(srcConceptMap)) {
  abort(`concept-map.json missing from export directory.\n  Expected: ${srcConceptMap}`);
}

let exportedMap;
try {
  exportedMap = JSON.parse(readFileSync(srcConceptMap, 'utf-8'));
} catch (err) {
  abort(`Failed to parse concept-map.json: ${err.message}`);
}

const exportedSourceDocIds = exportedMap.sourceDocIds
  ?? (exportedMap.sourceDocId ? [exportedMap.sourceDocId] : []);

if (exportedSourceDocIds.length === 0) {
  abort('concept-map.json has no sourceDocIds. The helper export must declare at least one source.');
}

const srcConcepts = join(srcDir, 'concepts');
if (!existsSync(srcConcepts)) {
  abort(`concepts/ directory missing from export directory.\n  Expected: ${srcConcepts}`);
}

// Warn if any declared sourceDocId has no concept directory in the export
for (const docId of exportedSourceDocIds) {
  const docDir = join(srcConcepts, docId);
  if (!existsSync(docDir)) {
    console.warn(`WARN: sourceDocId "${docId}" declared but no concepts/${docId}/ directory found in export.`);
  }
}

console.log(`\nExport directory: ${relative(ROOT, srcDir) || srcDir}`);
console.log(`sourceDocIds declared: [${exportedSourceDocIds.join(', ')}]`);
console.log(`Concept entries: ${Object.keys(exportedMap.concepts ?? {}).length}`);

// ─── Sync files ──────────────────────────────────────────────────────────────

console.log(`\nSyncing into: ${relative(ROOT, TARGET_DIR)}/`);

// 1. Copy concept-map.json (always overwrite)
copyFileSync(srcConceptMap, join(TARGET_DIR, 'concept-map.json'));
console.log('  ✓ concept-map.json');

// 2. Copy textbook-manifest.json if present
const srcManifest = join(srcDir, 'textbook-manifest.json');
if (existsSync(srcManifest)) {
  copyFileSync(srcManifest, join(TARGET_DIR, 'textbook-manifest.json'));
  console.log('  ✓ textbook-manifest.json');
}

// 3. Copy chunks-metadata.json if present
const srcChunks = join(srcDir, 'chunks-metadata.json');
if (existsSync(srcChunks)) {
  copyFileSync(srcChunks, join(TARGET_DIR, 'chunks-metadata.json'));
  console.log('  ✓ chunks-metadata.json');
}

// 4. Copy concept-quality.json (required for full helper-generated corpus)
const srcQuality = join(srcDir, 'concept-quality.json');
if (existsSync(srcQuality)) {
  copyFileSync(srcQuality, join(TARGET_DIR, 'concept-quality.json'));
  console.log('  ✓ concept-quality.json');
} else {
  console.warn('  WARN: concept-quality.json missing from export — concept quality metadata will fall back to concept-map.json entries and local heuristics.');
  console.warn('        For a full helper-generated corpus this file is required.');
}

// 5. Copy textbook-units.json (required for full helper-generated corpus)
const srcTextbookUnits = join(srcDir, 'textbook-units.json');
if (existsSync(srcTextbookUnits)) {
  copyFileSync(srcTextbookUnits, join(TARGET_DIR, 'textbook-units.json'));
  console.log('  ✓ textbook-units.json');
} else {
  console.warn('  WARN: textbook-units.json missing from export — textbook unit metadata will not be available for stable unit identity/rendering.');
  console.warn('        For a full helper-generated corpus this file is required.');
}

// 4. Sync concepts/ subtree (merge: new files overwrite, existing files not in export are kept)
const targetConcepts = join(TARGET_DIR, 'concepts');
mkdirSync(targetConcepts, { recursive: true });

let filesCopied = 0;
function syncConceptsDir(srcBase, destBase) {
  for (const entry of readdirSync(srcBase, { withFileTypes: true })) {
    const srcEntry  = join(srcBase, entry.name);
    const destEntry = join(destBase, entry.name);
    if (entry.isDirectory()) {
      mkdirSync(destEntry, { recursive: true });
      syncConceptsDir(srcEntry, destEntry);
    } else if (entry.isFile()) {
      copyFileSync(srcEntry, destEntry);
      filesCopied++;
    }
  }
}
syncConceptsDir(srcConcepts, targetConcepts);
console.log(`  ✓ concepts/ (${filesCopied} file(s) synced)`);

// ─── Post-sync validation ────────────────────────────────────────────────────

console.log('\nRunning corpus validation...');
try {
  execFileSync(process.execPath, [join(__dirname, 'validate-corpus.mjs')], {
    stdio: 'inherit',
    cwd: ROOT
  });
} catch {
  console.error('\nSync completed but corpus validation FAILED. Fix the issues above before committing.');
  process.exit(1);
}

console.log('\nSync complete. Textbook-static corpus is up to date.');
