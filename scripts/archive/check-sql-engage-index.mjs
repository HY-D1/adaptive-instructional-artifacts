#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, '..');
const CSV_PATH = path.join(REPO_ROOT, 'apps/web/src/app/data/sql_engage_dataset.csv');

const DEFAULT_SUBTYPE_FALLBACK = 'incomplete query';
const CHECK_SEED = 'sql-engage-index-check';

const SUBTYPE_ALIASES = {
  'unknown column': 'undefined column',
  'no such column': 'undefined column',
  'unknown table': 'undefined table',
  'no such table': 'undefined table',
  'unknown function': 'undefined function',
  'ambiguous column': 'ambiguous reference'
};

function parseCsvLine(line) {
  const values = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    const next = line[i + 1];

    if (ch === '"' && inQuotes && next === '"') {
      current += '"';
      i += 1;
      continue;
    }
    if (ch === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (ch === ',' && !inQuotes) {
      values.push(current.trim());
      current = '';
      continue;
    }

    current += ch;
  }

  values.push(current.trim());
  return values;
}

function parseSqlEngageCsv(csv) {
  const lines = csv
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    return [];
  }

  const headers = parseCsvLine(lines[0]);
  const queryIdx = headers.indexOf('query');
  const subtypeIdx = headers.indexOf('error_subtype');

  if (queryIdx < 0 || subtypeIdx < 0) {
    return [];
  }

  return lines.slice(1).map((line, index) => {
    const cols = parseCsvLine(line);
    return {
      rowId: `sql-engage:${index + 2}`,
      query: cols[queryIdx] || '',
      error_subtype: (cols[subtypeIdx] || '').trim().toLowerCase()
    };
  });
}

function stableHash(input) {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash * 31 + input.charCodeAt(i)) >>> 0;
  }
  return hash;
}

function canonicalizeSubtype(inputSubtype, canonicalSubtypes, fallbackSubtype) {
  const raw = (inputSubtype || '').trim().toLowerCase();
  if (!raw) {
    return fallbackSubtype;
  }

  const aliased = SUBTYPE_ALIASES[raw] || raw;
  if (canonicalSubtypes.has(aliased)) {
    return aliased;
  }

  return fallbackSubtype;
}

function getDeterministicRowId(indexBySubtype, canonicalSubtype, seed) {
  const rows = indexBySubtype[canonicalSubtype] || [];
  if (rows.length === 0) {
    return null;
  }

  const idx = stableHash(`${canonicalSubtype}|${seed}`) % rows.length;
  const rowId = rows[idx]?.rowId?.trim();
  return rowId || null;
}

function main() {
  const csv = fs.readFileSync(CSV_PATH, 'utf8');
  const records = parseSqlEngageCsv(csv);

  if (records.length === 0) {
    console.error('SQL-Engage dataset is empty or malformed.');
    process.exit(1);
  }

  const indexBySubtype = records.reduce((acc, row) => {
    if (!row.error_subtype) {
      return acc;
    }
    if (!acc[row.error_subtype]) {
      acc[row.error_subtype] = [];
    }
    acc[row.error_subtype].push(row);
    return acc;
  }, {});

  const canonicalSubtypeList = Object.keys(indexBySubtype).sort((a, b) => a.localeCompare(b));
  const canonicalSubtypes = new Set(canonicalSubtypeList);

  if (canonicalSubtypeList.length === 0) {
    console.error('No canonical subtypes were parsed from SQL-Engage dataset.');
    process.exit(1);
  }

  if (!canonicalSubtypes.has(DEFAULT_SUBTYPE_FALLBACK)) {
    console.error(`Missing required fallback subtype '${DEFAULT_SUBTYPE_FALLBACK}' in SQL-Engage dataset.`);
    process.exit(1);
  }

  let failures = 0;

  for (const subtype of canonicalSubtypeList) {
    const rowId = getDeterministicRowId(indexBySubtype, subtype, CHECK_SEED);
    console.log(`${subtype} -> ${rowId ?? 'MISSING'}`);
    if (!rowId) {
      failures += 1;
    }
  }

  const unknownCanonicalSubtype = canonicalizeSubtype('totally-unknown-subtype', canonicalSubtypes, DEFAULT_SUBTYPE_FALLBACK);
  const unknownRowId = getDeterministicRowId(indexBySubtype, unknownCanonicalSubtype, CHECK_SEED);
  console.log(`unknown -> ${unknownRowId ?? 'MISSING'} (canonical: ${unknownCanonicalSubtype})`);

  if (unknownCanonicalSubtype !== DEFAULT_SUBTYPE_FALLBACK) {
    console.error(
      `Unknown subtype canonicalization mismatch. Expected '${DEFAULT_SUBTYPE_FALLBACK}', got '${unknownCanonicalSubtype}'.`
    );
    failures += 1;
  }

  if (!unknownRowId) {
    console.error('Unknown subtype did not resolve to a deterministic rowId.');
    failures += 1;
  }

  if (failures > 0) {
    process.exit(1);
  }
}

main();
