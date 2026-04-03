#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const DATASET_PATH = path.join(process.cwd(), 'apps/web/src/app/data/sql_engage_dataset.csv');
const MAP_SOURCE_PATH = path.join(process.cwd(), 'apps/web/src/app/data/sql-engage.ts');
const ALLOWED_CONCEPT_IDS = new Set([
  'select-basic',
  'where-clause',
  'joins',
  'aggregation',
  'order-by',
  'subqueries'
]);
const ALLOWED_UNMAPPED_SUBTYPES = new Set([]);

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

function getCanonicalSubtypes() {
  const csvRaw = fs.readFileSync(DATASET_PATH, 'utf8').replace(/\r/g, '');
  const lines = csvRaw.split('\n').map((line) => line.trim()).filter(Boolean);
  if (lines.length === 0) {
    throw new Error(`Dataset is empty: ${DATASET_PATH}`);
  }

  const headers = parseCsvLine(lines[0]);
  const subtypeIndex = headers.indexOf('error_subtype');
  if (subtypeIndex < 0) {
    throw new Error(`Missing error_subtype column in ${DATASET_PATH}`);
  }

  const subtypeSet = new Set();
  for (const line of lines.slice(1)) {
    const cols = parseCsvLine(line);
    const subtype = (cols[subtypeIndex] || '').trim().toLowerCase();
    if (subtype) {
      subtypeSet.add(subtype);
    }
  }
  return subtypeSet;
}

function getSubtypeConceptMap() {
  const source = fs.readFileSync(MAP_SOURCE_PATH, 'utf8');
  const mapLiteralMatch = source.match(/const subtypeToConceptMap: Record<string, string\[]> = \{([\s\S]*?)\n\};/);
  const explicitMapMatch = source.match(/const explicitSubtypeConceptMap: Record<string, string\[]> = \{([\s\S]*?)\n\};/);
  const match = mapLiteralMatch || explicitMapMatch;
  if (!match) {
    throw new Error(`Could not locate subtype concept map literal in ${MAP_SOURCE_PATH}`);
  }

  const literal = `{${match[1]}\n}`;
  const parsed = Function(`"use strict"; return (${literal});`)();
  return Object.fromEntries(
    Object.entries(parsed).map(([subtype, conceptIds]) => [subtype.trim().toLowerCase(), conceptIds])
  );
}

function main() {
  const canonicalSubtypes = getCanonicalSubtypes();
  const subtypeConceptMap = getSubtypeConceptMap();
  const mappedSubtypes = Object.keys(subtypeConceptMap);

  const missingSubtypes = [...canonicalSubtypes].filter(
    (subtype) => !mappedSubtypes.includes(subtype) && !ALLOWED_UNMAPPED_SUBTYPES.has(subtype)
  );
  const unknownSubtypes = mappedSubtypes.filter((subtype) => !canonicalSubtypes.has(subtype));
  const emptyMappings = mappedSubtypes.filter((subtype) => {
    const concepts = subtypeConceptMap[subtype];
    return !Array.isArray(concepts) || concepts.length === 0;
  });
  const invalidConceptMappings = mappedSubtypes
    .flatMap((subtype) =>
      (subtypeConceptMap[subtype] || []).map((conceptId) => ({ subtype, conceptId }))
    )
    .filter(({ conceptId }) => !ALLOWED_CONCEPT_IDS.has(String(conceptId)));

  const hasFailures =
    missingSubtypes.length > 0 ||
    unknownSubtypes.length > 0 ||
    emptyMappings.length > 0 ||
    invalidConceptMappings.length > 0;

  console.log(`Canonical SQL-Engage subtypes: ${canonicalSubtypes.size}`);
  console.log(`Mapped subtypes: ${mappedSubtypes.length}`);

  if (missingSubtypes.length > 0) {
    console.error(`Missing mappings (${missingSubtypes.length}): ${missingSubtypes.join(', ')}`);
  }
  if (unknownSubtypes.length > 0) {
    console.error(`Mapped but non-canonical subtypes (${unknownSubtypes.length}): ${unknownSubtypes.join(', ')}`);
  }
  if (emptyMappings.length > 0) {
    console.error(`Subtypes with empty concept mapping (${emptyMappings.length}): ${emptyMappings.join(', ')}`);
  }
  if (invalidConceptMappings.length > 0) {
    const formatted = invalidConceptMappings
      .map(({ subtype, conceptId }) => `${subtype} -> ${conceptId}`)
      .join(', ');
    console.error(`Mappings using unknown concept IDs (${invalidConceptMappings.length}): ${formatted}`);
  }

  if (hasFailures) {
    process.exit(1);
  }

  console.log('PASS: subtype-to-concept mapping covers canonical SQL-Engage subtypes.');
}

main();
