#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index];
    if (current === '--api-base-url' && argv[index + 1]) {
      args.apiBaseUrl = String(argv[index + 1]).trim();
      index += 1;
    }
  }
  return args;
}

function normalizeText(value) {
  if (typeof value !== 'string') return '';
  return value.replace(/\s+/g, ' ').trim();
}

function tokenSet(value) {
  return new Set((normalizeText(value).toLowerCase().match(/[a-z][a-z0-9_]{2,}/g) || []));
}

function overlapRatio(candidate, source) {
  const a = tokenSet(candidate);
  const b = tokenSet(source);
  if (a.size === 0 || b.size === 0) return 0;
  let shared = 0;
  for (const token of a) {
    if (b.has(token)) shared += 1;
  }
  return shared / a.size;
}

function hasSqlLeak(value) {
  const text = normalizeText(value);
  return /\bselect\s+.+\s+from\s+.+/i.test(text) && !text.includes('___');
}

function hasNoise(value) {
  const text = normalizeText(value);
  if (!text) return true;
  return (
    /\x0c/.test(text) ||
    /^(?:chapter|table|figure)\s+\d+/i.test(text) ||
    /```/.test(text) ||
    text.split(' ').length < 4
  );
}

function scoreBrevity(value, maxChars) {
  const text = normalizeText(value);
  if (!text) return 0;
  if (text.length > maxChars) return 0.35;
  if (text.length < 30) return 0.45;
  return 1;
}

function evaluateUnit(unit) {
  const source = normalizeText(unit.contentMarkdown || '');
  const definition = normalizeText(unit.definitionRefined || unit.displaySummaryRefined || unit.displaySummary || unit.summary || '');
  const example = normalizeText(unit.exampleRefined || '');
  const mistakes = normalizeText(unit.commonMistakesRefined || '');
  const hintV1 = normalizeText(unit.hintV1 || '');
  const hintV2 = normalizeText(unit.hintV2 || '');
  const hintEscalation = normalizeText(unit.hintEscalation || '');

  const clarity = Number((
    (
      (definition.length >= 40 ? 1 : 0.4) +
      (hasNoise(definition) ? 0.2 : 1) +
      (example.length > 0 ? 1 : 0.5)
    ) / 3
  ).toFixed(4));

  const brevity = Number((
    (
      scoreBrevity(definition, 260) +
      scoreBrevity(example, 260) +
      scoreBrevity(hintV2 || hintEscalation || hintV1, 220)
    ) / 3
  ).toFixed(4));

  const groundedness = Number((
    (
      overlapRatio(definition, source) +
      overlapRatio(example, source) +
      overlapRatio(mistakes, source)
    ) / 3
  ).toFixed(4));

  const nonLeakiness = Number((
    (
      (hasSqlLeak(hintV1) ? 0 : 1) +
      (hasSqlLeak(hintV2) ? 0 : 1) +
      (hasSqlLeak(hintEscalation) ? 0 : 1)
    ) / 3
  ).toFixed(4));

  const usefulness = Number((
    (
      (definition.length >= 40 ? 1 : 0.3) +
      (example.length >= 20 ? 1 : 0.3) +
      (mistakes.length >= 20 ? 1 : 0.3) +
      ((hintV1 || hintV2 || hintEscalation) ? 1 : 0.2)
    ) / 4
  ).toFixed(4));

  const tags = [];
  if (clarity < 0.6) tags.push('too_vague');
  if (nonLeakiness < 1) tags.push('too_revealing');
  if (hasNoise(definition) || hasNoise(example)) tags.push('noisy');
  if (hintV1 && hintV2 && hintV1 === hintV2) tags.push('repetitive');
  if (!hintV1 && !hintV2 && !hintEscalation) tags.push('state_confusion');

  const overall = Number(((clarity + brevity + groundedness + nonLeakiness + usefulness) / 5).toFixed(4));
  const isGood = overall >= 0.72 && nonLeakiness >= 1 && groundedness >= 0.3;

  return {
    unitId: unit.unitId,
    docId: unit.docId,
    title: unit.displayTitle || unit.title,
    scores: { clarity, brevity, groundedness, nonLeakiness, usefulness, overall },
    tags,
    snippet: {
      definition,
      example,
      commonMistakes: mistakes,
      hintV1,
      hintV2,
      hintEscalation,
    },
    isGood,
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const apiBaseUrl = args.apiBaseUrl
    || process.env.PLAYWRIGHT_API_BASE_URL
    || process.env.VITE_API_BASE_URL
    || 'http://localhost:3001';

  const manifestUrl = `${apiBaseUrl.replace(/\/+$/, '')}/api/corpus/manifest`;
  const response = await fetch(manifestUrl, { method: 'GET' });
  if (!response.ok) {
    throw new Error(`Failed to load manifest from ${manifestUrl}: HTTP ${response.status}`);
  }
  const payload = await response.json();
  const units = Array.isArray(payload?.data?.units) ? payload.data.units : [];
  const evaluated = units.map(evaluateUnit);

  const sampleTarget = Math.min(10, evaluated.length);
  const strictGood = evaluated.filter((row) => row.isGood).sort((a, b) => b.scores.overall - a.scores.overall);
  const strictGoodTop = strictGood.slice(0, sampleTarget).map((row) => ({ ...row, sampleClass: 'strict_good' }));
  const rankedDesc = [...evaluated].sort((a, b) => b.scores.overall - a.scores.overall);
  const fillNeeded = Math.max(0, sampleTarget - strictGoodTop.length);
  const strictIds = new Set(strictGoodTop.map((row) => row.unitId));
  const bestAvailableFill = rankedDesc
    .filter((row) => !strictIds.has(row.unitId))
    .slice(0, fillNeeded)
    .map((row) => ({ ...row, sampleClass: 'best_available_fill' }));
  const good = [...strictGoodTop, ...bestAvailableFill];
  const weak = [...evaluated]
    .sort((a, b) => a.scores.overall - b.scores.overall)
    .slice(0, sampleTarget)
    .map((row) => ({ ...row, sampleClass: row.isGood ? 'borderline_weak' : 'weak' }));

  const runId = new Date().toISOString().replace(/[^\d]/g, '').slice(0, 14);
  const outDir = path.join(process.cwd(), 'dist', 'beta', 'refinement-audit', runId);
  fs.mkdirSync(outDir, { recursive: true });

  const result = {
    generatedAt: new Date().toISOString(),
    apiBaseUrl,
    manifestUrl,
    unitCount: units.length,
    strictGoodCount: strictGood.length,
    scoreAverages: {
      clarity: Number((evaluated.reduce((sum, row) => sum + row.scores.clarity, 0) / Math.max(evaluated.length, 1)).toFixed(4)),
      brevity: Number((evaluated.reduce((sum, row) => sum + row.scores.brevity, 0) / Math.max(evaluated.length, 1)).toFixed(4)),
      groundedness: Number((evaluated.reduce((sum, row) => sum + row.scores.groundedness, 0) / Math.max(evaluated.length, 1)).toFixed(4)),
      nonLeakiness: Number((evaluated.reduce((sum, row) => sum + row.scores.nonLeakiness, 0) / Math.max(evaluated.length, 1)).toFixed(4)),
      usefulness: Number((evaluated.reduce((sum, row) => sum + row.scores.usefulness, 0) / Math.max(evaluated.length, 1)).toFixed(4)),
    },
    samples: {
      good,
      weak,
    },
  };

  const markdown = [
    '# Refinement Quality Audit',
    '',
    `Generated: ${result.generatedAt}`,
    `Units evaluated: ${result.unitCount}`,
    `API base: ${result.apiBaseUrl}`,
    '',
    '## Average Scores',
    '',
    `- clarity: ${result.scoreAverages.clarity}`,
    `- brevity: ${result.scoreAverages.brevity}`,
    `- groundedness: ${result.scoreAverages.groundedness}`,
    `- nonLeakiness: ${result.scoreAverages.nonLeakiness}`,
    `- usefulness: ${result.scoreAverages.usefulness}`,
    `- strict good count: ${result.strictGoodCount}`,
    '',
    `## Good Samples (${sampleTarget})`,
    '',
    ...good.flatMap((row, idx) => [
      `### ${idx + 1}. ${row.title} (${row.unitId})`,
      `- score: ${row.scores.overall}`,
      `- sample class: ${row.sampleClass}`,
      `- tags: ${row.tags.length > 0 ? row.tags.join(', ') : 'none'}`,
      `- hint v1: ${row.snippet.hintV1 || '(empty)'}`,
      `- hint v2: ${row.snippet.hintV2 || '(empty)'}`,
      '',
    ]),
    `## Weak Samples (${sampleTarget})`,
    '',
    ...weak.flatMap((row, idx) => [
      `### ${idx + 1}. ${row.title} (${row.unitId})`,
      `- score: ${row.scores.overall}`,
      `- sample class: ${row.sampleClass}`,
      `- tags: ${row.tags.join(', ') || 'none'}`,
      `- hint v1: ${row.snippet.hintV1 || '(empty)'}`,
      `- hint v2: ${row.snippet.hintV2 || '(empty)'}`,
      '',
    ]),
  ].join('\n');

  const jsonPath = path.join(outDir, 'refinement-quality-audit.json');
  const markdownPath = path.join(outDir, 'refinement-quality-audit.md');
  fs.writeFileSync(jsonPath, `${JSON.stringify(result, null, 2)}\n`);
  fs.writeFileSync(markdownPath, `${markdown}\n`);

  console.log(JSON.stringify({
    outDir,
    jsonPath,
    markdownPath,
    strictGoodCount: strictGood.length,
    goodCount: good.length,
    weakCount: weak.length,
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
