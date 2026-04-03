#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const MAP_PATH = path.join(ROOT, 'apps/web/public/textbook-static/concept-map.json');
const CONCEPTS_DIR = path.join(ROOT, 'apps/web/public/textbook-static/concepts');

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function cleanText(value) {
  if (!value) return '';
  return value
    .replace(/\r/g, '')
    .replace(/\x0c/g, ' ')
    .replace(/^#{1,6}\s*/gm, '')
    .replace(/\*\*/g, '')
    .replace(/`{1,3}/g, '')
    .replace(/\[(.+?)\]\((.+?)\)/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

function firstSentence(text, maxLength = 220) {
  const cleaned = cleanText(text);
  if (!cleaned) return '';
  if (cleaned.length <= maxLength) return cleaned;
  const clipped = cleaned.slice(0, maxLength + 1);
  const breakAt = Math.max(clipped.lastIndexOf('.'), clipped.lastIndexOf(';'));
  if (breakAt >= Math.floor(maxLength * 0.45)) {
    return clipped.slice(0, breakAt + 1).trim();
  }
  return `${clipped.slice(0, maxLength).trim()}...`;
}

function parseSections(markdown) {
  const sections = {};
  const lines = markdown.split('\n');
  let section = '';
  let buffer = [];

  for (const line of lines) {
    if (line.startsWith('## ')) {
      if (section) sections[section] = buffer.join('\n').trim();
      section = line.slice(3).trim();
      buffer = [];
    } else {
      buffer.push(line);
    }
  }
  if (section) sections[section] = buffer.join('\n').trim();
  return sections;
}

function parseExamples(examplesSection) {
  if (!examplesSection) return [];
  const blocks = examplesSection.split('\n### ').map((b) => b.trim()).filter(Boolean);
  return blocks.map((block, idx) => {
    const lines = block.split('\n');
    const title = idx === 0 && !block.startsWith('#') && !block.startsWith('###')
      ? (lines[0] || `Example ${idx + 1}`)
      : (lines[0] || `Example ${idx + 1}`);
    const sqlMatch = block.match(/```sql\n([\s\S]*?)```/i);
    const code = cleanText(sqlMatch?.[1] || '');
    const explanation = firstSentence(block.replace(/```sql[\s\S]*?```/gi, '').replace(lines[0], ''), 180);
    return {
      title: cleanText(title),
      code,
      explanation,
    };
  });
}

function parseMistakes(section) {
  if (!section) return [];
  const blocks = section.split('\n### ').map((b) => b.trim()).filter(Boolean);
  return blocks.map((block) => {
    const lines = block.split('\n');
    const title = cleanText(lines[0] || 'Common mistake');
    const incorrectMatch = block.match(/(?:❌|Incorrect)[\s\S]*?```sql\n([\s\S]*?)```/i);
    const correctMatch = block.match(/(?:✅|Correct|Corrected)[\s\S]*?```sql\n([\s\S]*?)```/i);
    const whyMatch = block.match(/(?:💡|Why[^\n:]*:?)([\s\S]*)/i);
    return {
      title,
      incorrect: cleanText(incorrectMatch?.[1] || ''),
      correct: cleanText(correctMatch?.[1] || ''),
      why: firstSentence(whyMatch?.[1] || '', 160),
      raw: firstSentence(block, 200),
    };
  });
}

function noiseSignals(text) {
  if (!text) return 0;
  let score = 0;
  if (/\x0c/.test(text)) score += 1;
  if (/^(?:CHAPTER|FIGURE|TABLE|SECTION)\s+\d+/im.test(text)) score += 1;
  if (/^\d+\s*$/m.test(text)) score += 1;
  if ((text.match(/```/g) || []).length >= 4) score += 1;
  return score;
}

function isConcreteSql(sql) {
  return /\b(SELECT|INSERT\s+INTO|UPDATE\s+\w+|DELETE\s+FROM|CREATE\s+(TABLE|VIEW|INDEX)|ALTER\s+TABLE)\b/i.test(sql || '');
}

function scoreBoolean(value) {
  return value ? 5 : 2;
}

function resolveConceptPath(conceptId, sourceDocId) {
  const suffix = conceptId.includes('/') ? conceptId.split('/').pop() : conceptId;
  const candidates = [];
  if (sourceDocId) candidates.push(path.join(CONCEPTS_DIR, sourceDocId, `${suffix}.md`));
  candidates.push(path.join(CONCEPTS_DIR, `${conceptId}.md`));
  if (suffix && suffix !== conceptId) candidates.push(path.join(CONCEPTS_DIR, `${suffix}.md`));
  return candidates.find((p) => fs.existsSync(p)) || null;
}

const map = readJson(MAP_PATH);
const conceptEntries = Object.entries(map.concepts || {}).slice(0, 15);

const audits = [];
const beforeAfter = [];

for (const [conceptId, info] of conceptEntries) {
  const conceptPath = resolveConceptPath(conceptId, info.sourceDocId);
  if (!conceptPath) continue;

  const markdown = fs.readFileSync(conceptPath, 'utf8');
  const sections = parseSections(markdown);

  const learnRaw = sections['Explanation'] || sections['What is This?'] || sections.Definition || '';
  const learnAfter = firstSentence(learnRaw, 260);

  const examples = parseExamples(sections.Examples || '');
  const firstExample = examples[0] || { title: '', code: '', explanation: '' };
  const firstExampleAfter = {
    title: firstSentence(firstExample.title || 'Example', 60),
    code: firstSentence(firstExample.code || '', 160),
    explanation: firstSentence(firstExample.explanation || '', 160),
  };

  const mistakes = parseMistakes(sections['Common Mistakes'] || '');
  const firstMistake = mistakes[0] || { title: '', incorrect: '', correct: '', why: '', raw: '' };
  const firstMistakeAfter = [
    firstSentence(firstMistake.title || 'Common mistake', 80),
    firstSentence(firstMistake.why || 'Compare the incorrect and corrected SQL pattern.', 160),
  ].join(' - ');

  const titleClarity = scoreBoolean((info.title || '').length >= 6 && !/^page\s+\d+$/i.test(info.title || ''));
  const learnClarity = scoreBoolean(learnAfter.length >= 40 && noiseSignals(learnRaw) === 0);
  const examplesUsefulness = scoreBoolean(examples.some((ex) => isConcreteSql(ex.code)));
  const mistakesUsefulness = scoreBoolean(mistakes.some((m) => (m.correct && m.why) || (m.correct && m.incorrect)));
  const hasRedundancy = examples.length > 1 && new Set(examples.map((ex) => ex.code)).size < examples.length;
  const jargonNoise = noiseSignals(markdown) > 0;
  const formattingIssues = /```sql\n\s*```/i.test(markdown) || /^###\s*$/m.test(markdown);
  const extractionArtifacts = noiseSignals(markdown) > 0;
  const concreteEnough = examples.some((ex) => isConcreteSql(ex.code));
  const actionableMistakes = mistakes.some((m) => Boolean(m.correct && (m.incorrect || m.why)));

  audits.push({
    conceptId,
    title: info.title,
    sourceDocId: info.sourceDocId || null,
    titleClarity,
    learnClarity,
    examplesUsefulness,
    commonMistakesUsefulness: mistakesUsefulness,
    redundancy: hasRedundancy,
    jargonNoise,
    formattingIssues,
    extractionArtifacts,
    concreteExamples: concreteEnough,
    actionableMistakes,
  });

  if (beforeAfter.length < 10) {
    beforeAfter.push({
      conceptId,
      title: info.title,
      before: {
        learn: firstSentence(learnRaw, 180),
        example: firstSentence([firstExample.title, firstExample.code, firstExample.explanation].filter(Boolean).join(' | '), 180),
        commonMistake: firstSentence(firstMistake.raw || firstMistake.title, 180),
      },
      after: {
        learn: learnAfter,
        example: firstSentence([firstExampleAfter.title, firstExampleAfter.code, firstExampleAfter.explanation].filter(Boolean).join(' | '), 180),
        commonMistake: firstMistakeAfter,
      },
    });
  }
}

const runId = new Date().toISOString().replace(/[^\d]/g, '').slice(0, 14);
const outDir = path.join(ROOT, 'dist', 'beta', 'content-clarity', runId);
fs.mkdirSync(outDir, { recursive: true });

const aggregate = {
  sampledCount: audits.length,
  averageTitleClarity: Number((audits.reduce((sum, row) => sum + row.titleClarity, 0) / Math.max(audits.length, 1)).toFixed(2)),
  averageLearnClarity: Number((audits.reduce((sum, row) => sum + row.learnClarity, 0) / Math.max(audits.length, 1)).toFixed(2)),
  averageExamplesUsefulness: Number((audits.reduce((sum, row) => sum + row.examplesUsefulness, 0) / Math.max(audits.length, 1)).toFixed(2)),
  averageMistakesUsefulness: Number((audits.reduce((sum, row) => sum + row.commonMistakesUsefulness, 0) / Math.max(audits.length, 1)).toFixed(2)),
  noisyCount: audits.filter((row) => row.jargonNoise || row.extractionArtifacts).length,
  formattingIssueCount: audits.filter((row) => row.formattingIssues).length,
};

const payload = {
  generatedAt: new Date().toISOString(),
  runId,
  aggregate,
  audits,
  beforeAfter,
};

const markdown = [
  '# Concept Clarity Audit (15 Sample Payloads)',
  '',
  `Generated: ${payload.generatedAt}`,
  `Run ID: ${runId}`,
  '',
  '## Aggregate',
  '',
  `- Sampled concepts: ${aggregate.sampledCount}`,
  `- Avg title clarity (1-5): ${aggregate.averageTitleClarity}`,
  `- Avg learn clarity (1-5): ${aggregate.averageLearnClarity}`,
  `- Avg examples usefulness (1-5): ${aggregate.averageExamplesUsefulness}`,
  `- Avg common mistakes usefulness (1-5): ${aggregate.averageMistakesUsefulness}`,
  `- Noisy/extraction-artefact payloads: ${aggregate.noisyCount}`,
  `- Formatting issue payloads: ${aggregate.formattingIssueCount}`,
  '',
  '## Ten Before/After Samples',
  '',
  ...beforeAfter.flatMap((entry, idx) => [
    `### ${idx + 1}. ${entry.title} (${entry.conceptId})`,
    '',
    `- Learn (before): ${entry.before.learn || '(empty)'}`,
    `- Learn (after): ${entry.after.learn || '(empty)'}`,
    `- Example (before): ${entry.before.example || '(empty)'}`,
    `- Example (after): ${entry.after.example || '(empty)'}`,
    `- Common Mistake (before): ${entry.before.commonMistake || '(empty)'}`,
    `- Common Mistake (after): ${entry.after.commonMistake || '(empty)'}`,
    '',
  ]),
].join('\n');

fs.writeFileSync(path.join(outDir, 'concept-clarity-audit.json'), `${JSON.stringify(payload, null, 2)}\n`);
fs.writeFileSync(path.join(outDir, 'concept-clarity-audit.md'), `${markdown}\n`);

console.log(JSON.stringify({ outDir, aggregate }, null, 2));
